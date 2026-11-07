"""
banco_inteligibilidad.py — ¿se entiende la letra? Pasa por Whisper (whisper-small, en castellano) el coro real, el
sintético y el convertido con Seed-VC de cada fragmento del banco. Si el fragmento tiene su letra en
murga_trabajo/banco/letras/<id>.txt, cuenta qué parte de las palabras se pierde (WER); si no, deja lo que entendió,
para comparar a ojo. El coro real tampoco va a dar perfecto: lo que importa es la diferencia.

Corre con el Python de Seed-VC, que ya tiene torch y transformers (el modelo se baja solo la primera vez, ~1 GB):
  murga_trabajo/seed-vc/.venv/bin/python herramientas/banco_inteligibilidad.py
"""
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

import soundfile as sf

RAIZ = Path(__file__).resolve().parent.parent
TRABAJO = Path(os.environ.get("MURGA_TRABAJO", RAIZ / "murga_trabajo")).resolve()
BANCO = TRABAJO / "banco"


def normalizar(t):
    t = unicodedata.normalize("NFD", t.lower()).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zñ ]+", " ", t).split()


def wer(ref, hip):
    r, h = normalizar(ref), normalizar(hip)
    if not r:
        return None
    d = list(range(len(h) + 1))
    for i, a in enumerate(r, 1):
        prev, d[0] = d[0], i
        for j, b in enumerate(h, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (a != b))
    return d[len(h)] / len(r)


def main():
    import torch
    import librosa
    from transformers import pipeline
    disp = 0 if torch.cuda.is_available() else ("mps" if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available() else -1)
    asr = pipeline("automatic-speech-recognition", model="openai/whisper-small", device=disp,
                   generate_kwargs={"language": "spanish", "task": "transcribe"})
    frs = json.loads((BANCO / "fragmentos.json").read_text(encoding="utf-8"))
    carpetas = {"real": BANCO / "real", "sintetico": BANCO / "sintetico_ajustado" if (BANCO / "sintetico_ajustado").exists() else BANCO / "sintetico",
                "convertido": BANCO / "seedvc"}
    res = {}
    for f in frs:
        letra_arch = BANCO / "letras" / f"{f['id']}.txt"
        letra = letra_arch.read_text(encoding="utf-8") if letra_arch.exists() else None
        res[f["id"]] = {}
        for nombre, carpeta in carpetas.items():
            ruta = carpeta / f"{f['id']}.wav"
            if not ruta.exists():
                continue
            x, sr = sf.read(ruta, always_2d=True, dtype="float32")
            x = librosa.resample(x.mean(1), orig_sr=sr, target_sr=16000)
            texto = asr({"raw": x, "sampling_rate": 16000})["text"].strip()
            res[f["id"]][nombre] = {"texto": texto, "wer": wer(letra, texto) if letra else None}
            print(f"  {f['id']} · {nombre}: {texto[:90]}", flush=True)
    (BANCO / "inteligibilidad.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Escrito {BANCO / 'inteligibilidad.json'}")


if __name__ == "__main__":
    sys.exit(main())
