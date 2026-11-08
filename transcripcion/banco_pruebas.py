"""
banco_pruebas.py — pasa los coros de prueba (herramientas/coro_de_prueba.mjs) por la misma cadena que las murgas reales,
con distintas perillas, y guarda lo que escribe el transcriptor para compararlo con la verdad
(herramientas/comparar_transcripcion.js).

Cada caso es  entrada/separador/transcriptor[,opción=valor...]:
  entrada       voces | voces_mezcla | mezcla | mezcla_fuerte | tv            (tv pasa antes por Opus a 128 kb/s)
  separador     ninguno | htdemucs_ft | htdemucs | htdemucs_ft_s4 (4 shifts) | htdemucs_6s
  transcriptor  small | medium | large, con opciones:
                  beam=3      búsqueda con haz en vez de voraz
                  cfg=1.5     guía sin clasificador: cuánto se ata al audio
                  tope=8      notas abiertas que se dejan pasar de un pedazo al siguiente (0 = sin tope)
                  desfase=2.5 corre los pedazos de 5 s agregando silencio al principio
                  fp16=1      pesos en float16 (para que entre "large" en 4 GB)

  python banco_pruebas.py tv/htdemucs_ft/medium tv/ninguno/medium ...
  python banco_pruebas.py --casos casos.txt

Salida: murga_trabajo/pruebas/salidas/<pieza>/<entrada>__<separador>__<transcriptor>.json con las notas
[inicio, fin, midi] en segundos, y el tiempo que tardó. Las voces separadas quedan en murga_trabajo/pruebas/sep/.
"""
import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import imageio_ffmpeg
import numpy as np
import soundfile as sf
import torch

AQUI = Path(__file__).resolve().parent
PRUEBAS = AQUI.parent / "murga_trabajo" / "pruebas"
COROS, SEP, SAL = PRUEBAS / "coros", PRUEBAS / "sep", PRUEBAS / "salidas"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
DEV = "cuda" if torch.cuda.is_available() else "cpu"


def log(*a):
    print(*a, flush=True)


def entrada(pieza, cond):
    """El wav de la entrada; tv pasa por Opus 128 kb/s y vuelve a wav, como un video de YouTube."""
    d = COROS / pieza
    if cond != "tv":
        return d / f"{cond}.wav"
    w = d / "tv_opus.wav"
    if not w.exists():
        o = d / "tv.opus"
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(d / "tv.wav"), "-c:a", "libopus", "-b:a", "128k", str(o)], check=True)
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(o), "-ar", "44100", "-ac", "2", str(w)], check=True)
        o.unlink()
    return w


class Banco:
    def __init__(self):
        self.seps, self.tr, self.tr_clave = {}, None, None

    def separador(self, nombre):
        if nombre not in self.seps:
            from demucs.api import Separator

            self.libre_transcriptor()
            modelo, shifts = (nombre[:-3], int(nombre[-1])) if re.search(r"_s\d$", nombre) else (nombre, 1)
            self.seps = {nombre: Separator(model=modelo, device=DEV, shifts=shifts, overlap=0.25, progress=False)}
        return self.seps[nombre]

    def separar(self, pieza, cond, sep):
        """Las voces separadas (flac) y su SDR contra las voces verdaderas de la mezcla."""
        if sep == "ninguno":
            return entrada(pieza, cond), None
        dst = SEP / pieza / f"{cond}__{sep}.flac"
        info = dst.with_suffix(".json")
        if dst.exists() and info.exists():
            return dst, json.loads(info.read_text())
        dst.parent.mkdir(parents=True, exist_ok=True)
        s = self.separador(sep)
        t0 = time.time()
        _, stems = s.separate_audio_file(str(entrada(pieza, cond)))
        v = stems["vocals"].cpu().numpy().T
        sf.write(dst, v, s.samplerate, subtype="PCM_16")
        datos = {"segundos": round(time.time() - t0, 1)}
        ref = COROS / pieza / "voces_mezcla.wav"
        if cond in ("mezcla", "mezcla_fuerte", "tv") and ref.exists():
            r, _ = sf.read(ref, dtype="float32")
            n = min(len(r), len(v))
            r, e = r[:n].mean(1), v[:n].mean(1)
            datos["sdr"] = round(float(10 * np.log10((r ** 2).sum() / max(1e-12, ((r - e) ** 2).sum()))), 2)
            a = (e * r).sum() / max(1e-12, (r * r).sum())  # SI-SDR: sin castigar la ganancia
            datos["si_sdr"] = round(float(10 * np.log10(((a * r) ** 2).sum() / max(1e-12, ((a * r - e) ** 2).sum()))), 2)
        info.write_text(json.dumps(datos))
        torch.cuda.empty_cache()
        return dst, datos

    def libre_transcriptor(self):
        if self.tr is not None:
            self.tr, self.tr_clave = None, None
            torch.cuda.empty_cache()

    def transcriptor(self, modelo, fp16, tope):
        from muscriptor.events import OpenNoteTracker
        from muscriptor.transcription_model import TranscriptionModel

        if not hasattr(OpenNoteTracker, "_original"):
            OpenNoteTracker._original = OpenNoteTracker.open_keys
        orig = OpenNoteTracker._original

        def con_tope(tracker):
            k = orig(tracker)
            if self.tope and len(k) > self.tope:
                self.cadenas += 1
                return []
            return k

        OpenNoteTracker.open_keys = con_tope
        self.tope = tope
        clave = (modelo, fp16)
        if self.tr_clave != clave:
            self.libre_transcriptor()
            self.seps = {}
            torch.cuda.empty_cache()
            self.tr = TranscriptionModel.load_model(weights_path=modelo, device=DEV, dtype="float16" if fp16 else None)
            self.tr_clave = clave
        return self.tr

    def transcribir(self, audio, opc):
        from muscriptor.events import NoteEndEvent, NoteStartEvent

        m = self.transcriptor(opc["modelo"], opc.get("fp16", 0), int(opc.get("tope", 8)))
        self.cadenas = 0
        wav = m._load_wav(str(audio), None)
        desfase = float(opc.get("desfase", 0))
        from muscriptor.transcription_model import _SAMPLE_RATE

        if desfase:
            wav = torch.cat([torch.zeros(wav.shape[0], int(desfase * _SAMPLE_RATE), device=wav.device, dtype=wav.dtype), wav], dim=1)
        t0 = time.time()
        notas, abiertas = [], {}
        for e in m.transcribe((wav, _SAMPLE_RATE), instruments=["voice"], beam_size=int(opc.get("beam", 1)), cfg_coef=float(opc.get("cfg", 1.0))):
            if isinstance(e, NoteStartEvent):
                abiertas[e.index] = e
            elif isinstance(e, NoteEndEvent):
                s = abiertas.pop(e.start_event_index)
                notas.append([round(s.start_time - desfase, 4), round(e.end_time - desfase, 4), s.pitch])
        notas = [n for n in notas if n[1] > 0]
        notas.sort()
        torch.cuda.empty_cache()
        return {"notas": notas, "segundos": round(time.time() - t0, 1), "cadenas_cortadas": self.cadenas}


def opciones(txt):
    partes = txt.split(",")
    o = {"modelo": partes[0]}
    for p in partes[1:]:
        k, v = p.split("=")
        o[k] = float(v) if re.match(r"^[\d.]+$", v) else v
    return o


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("casos", nargs="*")
    ap.add_argument("--casos", dest="archivo", default=None)
    ap.add_argument("--piezas", default="", help="p1,p2… (vacío = todas)")
    a = ap.parse_args()
    casos = list(a.casos)
    if a.archivo:
        casos += [l.strip() for l in open(a.archivo, encoding="utf-8") if l.strip() and not l.startswith("#")]
    piezas = a.piezas.split(",") if a.piezas else sorted(p.name for p in COROS.iterdir() if (p / "verdad.json").exists())
    b = Banco()
    # agrupados por transcriptor, para no cargar y descargar modelos a cada rato
    orden = {"medium": 0, "small": 1, "large": 2}
    casos.sort(key=lambda c: orden.get(c.split("/")[2].split(",")[0], 3))  # estable: dentro de cada modelo, el orden dado
    t_total = time.time()
    for c in casos:
        cond, sep, tr = c.split("/")
        opc = opciones(tr)
        for p in piezas:
            dst = SAL / p / f"{cond}__{sep}__{tr.replace('=', '').replace(',', '_')}.json"
            if dst.exists():
                continue
            dst.parent.mkdir(parents=True, exist_ok=True)
            try:
                audio, dsep = b.separar(p, cond, sep)
                r = b.transcribir(audio, opc)
                r.update({"caso": c, "pieza": p, "separacion": dsep})
                dst.write_text(json.dumps(r))
                sdr = f", SDR {dsep['sdr']} dB" if dsep and "sdr" in dsep else ""
                log(f"{p} {c}: {len(r['notas'])} notas en {r['segundos']} s{sdr}")
            except Exception as e:
                log(f"{p} {c}: ERROR {type(e).__name__}: {str(e)[:300]}")
                if "out of memory" in str(e).lower():
                    b.libre_transcriptor()
                    b.seps = {}
                    torch.cuda.empty_cache()
    log(f"FIN DEL BANCO en {(time.time() - t_total) / 60:.0f} min")


if __name__ == "__main__":
    main()
