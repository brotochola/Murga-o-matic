# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = [
#   "yt-dlp[default]>=2025.1.1",
#   "imageio-ffmpeg>=0.5",
#   "muscriptor>=0.4",
#   "demucs>=4.1",
#   "soundfile>=0.12",
# ]
# ///
"""
murga_lote.py — de la lista de videos a los MIDI de voces.

  1. videos.csv dice qué tramo de qué video es cada parte de cada espectáculo.
  2. Baja el audio completo de cada video.
  3. Corta el tramo (columnas desde/hasta, en segundos o mm:ss; vacío = todo el video).
  4. Separa voces y batería con Demucs.
  5. Transcribe sólo las voces con MuScriptor. El pulso sale de lo que no es voz,
     que es mucho más estable que la mezcla; si casi no hay percusión, sale de la mezcla.

Lo que ya está hecho no se repite. Todo queda en murga_trabajo/ (fuera de git):
  audio/   el audio completo de cada video
  voces/   las voces separadas de cada tramo (flac)
  bateria/ todo lo que no es voz en cada tramo (flac), para saber qué ritmo usa cada sección
  mp3/     la mezcla de cada tramo, liviana, para escuchar
  midis/   un .mid de sólo voces por tramo, y un .json con el pulso y los datos del tramo

Uso:
  python murga_lote.py               # todo
  python murga_lote.py --solo-bajar  # sólo baja los audios
  python murga_lote.py --solo 2024   # sólo los tramos cuyo nombre contiene ese texto
"""
import argparse
import csv
import ctypes
import json
import re
import shutil
import subprocess
import sys
import time
import unicodedata
from pathlib import Path

import imageio_ffmpeg
import yt_dlp

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
LISTA = AQUI / "videos.csv"
TRABAJO = RAIZ / "murga_trabajo"
AUDIO, CLIPS, VOCES, BATERIA, MP3, MIDIS = (TRABAJO / d for d in ("audio", "clips", "voces", "bateria", "mp3", "midis"))
REGISTRO = TRABAJO / "lote.log"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
# MuScriptor trabaja en pedazos de 5 s y le pasa al siguiente las notas que quedaron abiertas. Si un pedazo
# sale mal, se arrastra la basura hasta el final del tramo (dos tramos llegaron a 76 notas abiertas y 55.000
# notas falsas). En 1.792 cortes de tramos sanos nunca hubo más de 6: pasado este tope se cortan todas.
TOPE_ABIERTAS = 8


def log(*a):
    linea = " ".join(str(x) for x in a)
    print(linea, flush=True)
    with REGISTRO.open("a", encoding="utf-8") as f:
        f.write(linea + "\n")


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def segundos(x):
    x = str(x or "").strip()
    if not x:
        return None
    if ":" in x:
        p = [float(v) for v in x.split(":")]
        return p[-1] + 60 * p[-2] + (3600 * p[-3] if len(p) > 2 else 0)
    return float(x)


def ydl(extra=None, cookies=None):
    o = {"quiet": True, "no_warnings": True, "noprogress": True, "ffmpeg_location": FFMPEG}
    node = shutil.which("node")
    if node:  # sin motor JS, YouTube da "not available" en algunos videos
        o["js_runtimes"] = {"node": {"path": node}}
    if cookies:
        o["cookiesfrombrowser"] = (cookies,)
    o.update(extra or {})
    return yt_dlp.YoutubeDL(o)


def bajar(url, cookies=None):
    vid = re.search(r"(?:v=|youtu\.be/)([\w-]{11})", url).group(1)
    ya = [p for p in AUDIO.glob("*") if p.stem == vid and p.suffix != ".part"]
    if ya:
        return ya[0]
    log(f"   bajando {url}")
    with ydl({"format": "bestaudio/best", "outtmpl": str(AUDIO / f"{vid}.%(ext)s")}, cookies) as y:
        y.download([url])
    return next(p for p in AUDIO.glob("*") if p.stem == vid and p.suffix != ".part")


def duracion(path):
    r = subprocess.run([FFMPEG, "-i", str(path)], capture_output=True, text=True, errors="replace")
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])


def cortar(src, dst, desde, hasta, fmt):
    a = [FFMPEG, "-y", "-loglevel", "error"]
    if desde:
        a += ["-ss", str(desde)]
    if hasta:
        a += ["-to", str(hasta)]
    a += ["-i", str(src)]
    a += ["-ac", "2", "-ar", "44100", str(dst)] if fmt == "wav" else ["-ac", "1", "-ar", "22050", "-b:a", "64k", str(dst)]
    subprocess.run(a, check=True)


class Herramientas:
    """Demucs, MuScriptor y Beat This! se cargan una vez y quedan listos."""

    def __init__(self, a):
        import numpy as np
        import soundfile as sf
        import torch
        from beat_this.inference import Audio2Beats
        from muscriptor.events import OpenNoteTracker
        from muscriptor.transcription_model import _SAMPLE_RATE, NoteStartEvent, TranscriptionModel
        from muscriptor.utils.beats import detect_grid

        self.np, self.sf, self.torch = np, sf, torch
        self.detect_grid, self.NoteStartEvent, self.sr = detect_grid, NoteStartEvent, _SAMPLE_RATE
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        log(f"Cargando modelos en {self.device}…")
        self.a, self._demucs, self.cadenas = a, None, 0
        abiertas = OpenNoteTracker.open_keys

        def con_tope(tracker):
            k = abiertas(tracker)
            if len(k) <= TOPE_ABIERTAS:
                return k
            self.cadenas += 1
            return []

        OpenNoteTracker.open_keys = con_tope
        self.modelo = TranscriptionModel.load_model(weights_path=a.modelo, device=self.device)
        self.beats = Audio2Beats(checkpoint_path="final0", device=self.device, dbn=False)

    @property
    def demucs(self):
        if self._demucs is None:
            from demucs.api import Separator

            self._demucs = Separator(model=self.a.demucs, device=self.device, shifts=self.a.shifts, overlap=0.25, progress=False)
        return self._demucs

    def separar(self, wav, flac_voces, flac_resto):
        """Guarda las voces y todo lo demás, y devuelve la energía de cada pista cada medio segundo.

        Demucs manda buena parte del bombo, los platillos y el redoblante a "other",
        así que la percusión de murga es "todo lo que no es voz", no la pista "drums".
        """
        _, stems = self.demucs.separate_audio_file(str(wav))
        sr = self.demucs.samplerate
        self.sf.write(flac_voces, stems["vocals"].cpu().numpy().T, sr, subtype="PCM_16")
        resto = (stems["drums"] + stems["bass"] + stems["other"]).mean(0).cpu().numpy()
        self.sf.write(flac_resto, self.np.clip(resto, -1, 1), sr, subtype="PCM_16")
        paso, energia = sr // 2, {}
        for k in ("vocals", "drums", "bass", "other"):
            x = stems[k].mean(0).cpu().numpy()
            n = len(x) // paso
            rms = self.np.sqrt((x[: n * paso].reshape(n, paso) ** 2).mean(1))
            energia[k] = [round(float(v), 4) for v in rms]
        self.torch.cuda.empty_cache()
        return energia

    def pulso(self, audio):
        """El pulso de un audio: la grilla para el MIDI y los tiempos crudos para analizar."""
        wav = self.modelo._load_wav(str(audio), None)
        try:
            g = self.detect_grid(wav, self.sr, device=self.device)
        except Exception as e:  # pasaje a capela: pocos pulsos
            log(f"   sin pulso en {Path(audio).parent.name}: {e}")
            return None, {"bpm": None, "beats": [], "downbeats": []}
        _, downbeats = self.beats(wav.mean(dim=0).detach().cpu().numpy(), self.sr)
        ibi = self.np.diff(g.beats)
        return g, {
            "bpm": round(float(g.bpm), 2),
            "pulsos_por_compas": g.beats_per_bar,
            "constante": bool(g.steady),
            "variacion": round(float(ibi.std() / ibi.mean()), 4),
            "beats": [round(float(b), 3) for b in g.beats],
            "downbeats": [round(float(b), 3) for b in downbeats],
        }

    def transcribir(self, flac_voces, flac_resto, wav_mezcla, mid):
        t0 = time.time()
        self.cadenas = 0
        eventos = list(self.modelo.transcribe(str(flac_voces), instruments=["voice"]))
        t1 = time.time()
        inicios = [e.start_time for e in eventos if isinstance(e, self.NoteStartEvent)]
        g_res, res = self.pulso(flac_resto)
        g_mez, mez = self.pulso(wav_mezcla)
        # Sin voces el pulso es más estable; si casi no hay percusión, sale de la mezcla
        usa_resto = g_res is not None and len(res["beats"]) >= 0.6 * len(mez["beats"])
        grilla = g_res if usa_resto else g_mez
        if grilla is not None:
            grilla = grilla.with_onset_delay(inicios)
        mid.write_bytes(self.modelo.events_to_midi_bytes(iter(eventos), beat_grid=grilla))
        self.torch.cuda.empty_cache()
        return {
            "notas": len(inicios),
            "pulso_de": "percusion" if usa_resto else "mezcla",
            "retardo_inicios_s": None if grilla is None or grilla.onset_delay is None else round(float(grilla.onset_delay), 4),
            "percusion": res,
            "mezcla": mez,
            "segundos_transcribir": round(t1 - t0, 1),
            "cadenas_cortadas": self.cadenas,
        }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solo-bajar", action="store_true")
    ap.add_argument("--solo", default="", help="sólo los tramos cuyo nombre contiene este texto")
    ap.add_argument("--modelo", default="medium", help="small | medium | large")
    ap.add_argument("--demucs", default="htdemucs_ft", help="htdemucs | htdemucs_ft")
    ap.add_argument("--shifts", type=int, default=1)
    ap.add_argument("--cookies", default=None, help="chrome | firefox | edge …")
    ap.add_argument("--lista", default=str(LISTA), help="otra lista: tomas.csv tiene varias tomas del mismo espectáculo")
    ap.add_argument("--carpeta", default="", help="subcarpeta de murga_trabajo para voces, batería, mp3 y midis (vacío = las de siempre)")
    a = ap.parse_args()
    if a.carpeta:
        global VOCES, BATERIA, MP3, MIDIS, CLIPS
        base = TRABAJO / a.carpeta
        CLIPS, VOCES, BATERIA, MP3, MIDIS = (base / d for d in ("clips", "voces", "bateria", "mp3", "midis"))

    for d in (AUDIO, CLIPS, VOCES, BATERIA, MP3, MIDIS):
        d.mkdir(parents=True, exist_ok=True)
    if sys.platform == "win32":  # que Windows no se duerma mientras corre
        ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001)

    filas = list(csv.DictReader(Path(a.lista).open(encoding="utf-8")))
    for f in filas:  # en tomas.csv cada fila es una toma de un espectáculo
        f["nombre"] = f"{f['espectaculo']}__{f['toma']}" if "toma" in f else f"{slug(f['murga'])}_{f['anio']}_{f['parte']}"
    filas = [f for f in filas if a.solo in f["nombre"]]

    h = None
    t_total = time.time()
    hechos = errores = 0
    for i, f in enumerate(filas, 1):
        n = f["nombre"]
        mid = MIDIS / f"{n}.mid"
        log(f"\n[{i}/{len(filas)}] {n}")
        try:
            src = bajar(f["url"], a.cookies)
            if a.solo_bajar:
                continue
            if mid.exists():
                log("   ya estaba")
                continue
            if h is None:
                h = Herramientas(a)
            t0 = time.time()
            dur = duracion(src)
            desde, hasta = segundos(f["desde"]), segundos(f["hasta"])
            if desde is not None and desde < 0:
                desde = max(0, dur + desde)
            wav, flac, bat = CLIPS / f"{n}.wav", VOCES / f"{n}.flac", BATERIA / f"{n}.flac"
            cortar(src, wav, desde, hasta, "wav")
            cortar(src, MP3 / f"{n}.mp3", desde, hasta, "mp3")
            largo = duracion(wav)
            viejo = MIDIS / f"{n}.json"
            if flac.exists() and bat.exists() and viejo.exists():  # rehacer sólo la transcripción
                energia = json.loads(viejo.read_text(encoding="utf-8"))["energia"]
            else:
                energia = h.separar(wav, flac, bat)
            t1 = time.time()
            log(f"   separado en {t1 - t0:.0f} s ({largo:.0f} s de audio)")
            datos = h.transcribir(flac, bat, wav, mid)
            (MIDIS / f"{n}.json").write_text(
                json.dumps({**f, "inicio_s": desde or 0, "largo_s": round(largo, 1), **datos, "energia": energia}, ensure_ascii=False),
                encoding="utf-8",
            )
            wav.unlink()
            hechos += 1
            p = datos["percusion" if datos["pulso_de"] == "percusion" else "mezcla"]
            log(f"   {datos['notas']} notas, {p['bpm']} BPM, pulso de {datos['pulso_de']}, {time.time() - t0:.0f} s en total")
        except Exception as e:
            errores += 1
            log(f"   ERROR: {type(e).__name__}: {str(e)[:300]}")
    log(f"\nListo: {hechos} tramos nuevos, {errores} errores, {(time.time() - t_total) / 60:.0f} minutos.")


if __name__ == "__main__":
    main()
