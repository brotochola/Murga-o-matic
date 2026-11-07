# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile", "scipy"]
# ///
"""
banco_fragmentos.py — elige los fragmentos de coro real contra los que se mide el coro sintético.

Toma pasajes cantados de 12 a 25 s de las voces separadas (murga_trabajo/voces/*.flac), mejor a capela, de todas las
murgas que haya, y siempre la entrada a capela de La Trasnochada 2020 si está. Los corta a murga_trabajo/banco/real/
y anota en murga_trabajo/banco/fragmentos.json de qué tramo y de qué segundos sale cada uno. Uno de cada tres queda
de control: no se usa para ajustar, sólo para ver si el ajuste sirve fuera de lo que se ajustó.

  uv run herramientas/banco_fragmentos.py [--maximo 12] [--largo 20]
"""
import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

RAIZ = Path(__file__).resolve().parent.parent
TRABAJO = Path(os.environ.get("MURGA_TRABAJO", RAIZ / "murga_trabajo")).resolve()
ANALISIS, VOCES, BANCO = TRABAJO / "analisis", TRABAJO / "voces", TRABAJO / "banco"
SR = 44100


def bloques(an):
    """Pasajes con batería o a capela, cada medio segundo (como herramientas/forma.js)."""
    e = an["energia"]
    voz = np.array(e["vocals"])
    resto = np.array(e["drums"]) + np.array(e["other"]) + np.array(e.get("bass", [0] * len(voz)))
    ref = np.sort(resto)[int(len(resto) * .8)] or 1
    hay = resto > .28 * ref
    liso = np.array([hay[max(0, i - 6): i + 7].mean() > .5 for i in range(len(hay))])
    out, ini = [], 0
    for i in range(1, len(liso) + 1):
        if i == len(liso) or liso[i] != liso[ini]:
            out.append((ini / 2, i / 2, bool(liso[ini])))
            ini = i
    return out


def candidatos(an, largo):
    t_g = np.array([s[0] for s in an["segs"]])
    dur = sf.info(VOCES / f"{an['nombre']}.flac").duration    # por si la voz separada es más corta que el análisis
    res = []
    for t0, t1, bat in bloques(an):
        t1 = min(t1, dur)
        t = t0
        while t + 12 <= t1:
            fin = min(t + largo, t1)
            n = int(((t_g >= t) & (t_g < fin)).sum())
            if n >= 2 * (fin - t):            # bien cantado: dos golpes por segundo o más
                res.append({"t0": round(t, 2), "t1": round(fin, 2), "capela": not bat, "golpes": n})
            t += largo
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--maximo", type=int, default=12)
    ap.add_argument("--largo", type=float, default=20.0)
    a = ap.parse_args()
    tramos = []
    for j in sorted(ANALISIS.glob("*.json")):
        an = json.loads(j.read_text(encoding="utf-8"))
        if "segs" in an and (VOCES / f"{an['nombre']}.flac").exists():
            tramos.append(an)
    if not tramos:
        sys.exit(f"No hay voces separadas en {VOCES}: corré antes transcripcion/murga_lote.py")
    elegidos = []
    # siempre la entrada a capela de La Trasnochada 2020, si está
    for an in tramos:
        if an["nombre"] == "la_trasnochada_2020_presentacion":
            c = [x for x in candidatos(an, a.largo) if x["capela"]]
            if c:
                elegidos.append((an, c[0]))
    # después, por murga y por tramo, lo más cantado y a capela primero
    por_murga = {}
    for an in tramos:
        por_murga.setdefault(an["murga"], []).append(an)
    while len(elegidos) < a.maximo:
        agrego = False
        for murga, lista in sorted(por_murga.items()):
            for an in lista:
                if len(elegidos) >= a.maximo or any(e[0] is an for e in elegidos):
                    continue
                c = sorted(candidatos(an, a.largo), key=lambda x: (not x["capela"], -x["golpes"]))
                if c:
                    elegidos.append((an, c[0]))
                    agrego = True
                    break
        if not agrego:
            break
    (BANCO / "real").mkdir(parents=True, exist_ok=True)
    frag = []
    for i, (an, c) in enumerate(elegidos):
        fid = f"{i + 1:02d}_{an['nombre']}"
        info = sf.info(VOCES / f"{an['nombre']}.flac")
        x, sr = sf.read(VOCES / f"{an['nombre']}.flac", start=int(c["t0"] * info.samplerate), frames=int((c["t1"] - c["t0"]) * info.samplerate), always_2d=True, dtype="float32")
        x = x.mean(1)
        if len(x) < SR * 10:
            continue
        if sr != SR:
            x = resample_poly(x, SR, sr).astype(np.float32)
        sf.write(BANCO / "real" / f"{fid}.wav", x / (np.abs(x).max() + 1e-9) * .7, SR, subtype="PCM_16")
        frag.append({"id": fid, "tramo": an["nombre"], "murga": an["murga"], "t0": c["t0"], "t1": c["t1"], "capela": c["capela"], "control": i % 3 == 2})
        print(f"  {fid}  {c['t0']:.0f}-{c['t1']:.0f} s  {'a capela' if c['capela'] else 'con batería'}{'  (control)' if i % 3 == 2 else ''}")
    (BANCO / "fragmentos.json").write_text(json.dumps(frag, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(frag)} fragmentos en {BANCO}")


if __name__ == "__main__":
    main()
