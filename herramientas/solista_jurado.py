# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile", "scipy", "sherpa-onnx"]
# ///
"""
solista_jurado.py — ¿se entiende lo que canta el solista? Transcribe cada frase con Whisper (sherpa-onnx, en la compu,
sin internet una vez bajado el modelo) y la compara con el texto: errores por letra (CER) y por palabra (WER).

Whisper es una red neuronal: es el jurado, afuera del generador, como el banco del coro.

  uv run herramientas/solista_jurado.py murga_trabajo/solista/<motor> [otra carpeta ...] [--modelo dir]

El modelo: https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.tar.bz2
(desarmado en murga_trabajo/jurado/, o donde diga --modelo o SOLISTA_JURADO).
"""
import argparse
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

RAIZ = Path(__file__).resolve().parent.parent


def normal(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[^a-zñ ]", " ", t.replace("ñ", "ñ"))
    return re.sub(r"\s+", " ", t).strip()


def lev(a, b):
    d = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, y in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (x != y))
    return d[len(b)]


def reconocedor(carpeta, hilos):
    import sherpa_onnx
    c = Path(carpeta)
    enc = next(c.glob("*encoder*.int8.onnx"), None) or next(c.glob("*encoder*.onnx"))
    dec = next(c.glob("*decoder*.int8.onnx"), None) or next(c.glob("*decoder*.onnx"))
    tok = next(c.glob("*tokens.txt"))
    return sherpa_onnx.OfflineRecognizer.from_whisper(encoder=str(enc), decoder=str(dec), tokens=str(tok), language="es", task="transcribe", num_threads=hilos)


def transcribir(rec, ruta):
    x, sr = sf.read(ruta, dtype="float32", always_2d=True)
    x = x.mean(1)
    if sr != 16000:
        g = np.gcd(sr, 16000)
        x = resample_poly(x, 16000 // g, sr // g).astype(np.float32)
    s = rec.create_stream()
    s.accept_waveform(16000, x)
    rec.decode_stream(s)
    return s.result.text.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("carpetas", nargs="+")
    ap.add_argument("--modelo", default=os.environ.get("SOLISTA_JURADO", str(RAIZ / "murga_trabajo" / "jurado" / "sherpa-onnx-whisper-small")))
    ap.add_argument("--hilos", type=int, default=os.cpu_count() or 2)
    ap.add_argument("--detalle", action="store_true")
    a = ap.parse_args()
    rec = reconocedor(a.modelo, a.hilos)
    resumen = []
    for carpeta in a.carpetas:
        c = Path(carpeta)
        F = json.loads((c / "frases.json").read_text(encoding="utf-8"))
        filas, ec, nc, ew, nw = [], 0, 0, 0, 0
        for f in F["frases"]:
            oido = transcribir(rec, c / f["archivo"])
            ref, hyp = normal(f["texto"]), normal(oido)
            e_c, e_w = lev(ref.replace(" ", ""), hyp.replace(" ", "")), lev(ref.split(), hyp.split())
            ec += e_c; nc += len(ref.replace(" ", "")); ew += e_w; nw += len(ref.split())
            filas.append({"archivo": f["archivo"], "texto": f["texto"], "oido": oido, "cer": e_c / max(1, len(ref.replace(" ", ""))), "wer": e_w / max(1, len(ref.split()))})
            if a.detalle:
                print(f"  {f['archivo']}  {filas[-1]['cer']:.0%}  «{oido}»", flush=True)
        # cada frase pesa igual y cuenta como mucho 100 %: si Whisper alucina ("siiiiii…") no se come el promedio
        r = {"carpeta": str(c), "motor": F.get("motor"), "cer": float(np.mean([min(1, f["cer"]) for f in filas])), "wer": float(np.mean([min(1, f["wer"]) for f in filas])),
             "cer_total": ec / max(1, nc), "frases": filas}
        (c / "jurado.json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
        resumen.append(r)
        print(f"{F.get('motor', c.name):24s} letras mal {r['cer']:6.1%}   palabras mal {r['wer']:6.1%}", flush=True)
    return resumen


if __name__ == "__main__":
    main()
