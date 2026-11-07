# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile", "scipy"]
# ///
"""
banco_medir.py — mide con la misma vara el coro real y el sintético, fragmento por fragmento.

Para cada fragmento del banco (banco_fragmentos.py) compara murga_trabajo/banco/real/<id>.wav con <id>.wav de la
carpeta sintética (banco_sintetizar.mjs):
  timbre      espectro promedio de las vocales, en tercios de octava (diferencia media en dB)
  unísono     qué tan ancho suena cada parcial en los golpes de una sola nota, y cuánto se parece a una sola persona
              (las mismas cuentas que transcripcion/pureza.py)
  ataque      cuánto tarda en subir la energía al empezar cada golpe: trece voces corridas suben más despacio
  hueco       cuánto baja la energía entre dos golpes seguidos
  consonantes cuánto brillan los agudos justo antes de cada golpe (sólo cuenta si el fragmento tiene letra)
Y una distancia total: cada término vale 1 cuando la diferencia ya se nota.

  uv run herramientas/banco_medir.py [--sintetico murga_trabajo/banco/sintetico] [--salida medidas.json]
"""
import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
TRABAJO = Path(os.environ.get("MURGA_TRABAJO", RAIZ / "murga_trabajo")).resolve()
BANCO = TRABAJO / "banco"
SR = 44100
sys.path.insert(0, str(RAIZ / "transcripcion"))
from pureza import medir as medir_pureza, unisono  # noqa: E402

CENTROS = [100 * 2 ** (i / 3) for i in range(int(3 * np.log2(10000 / 100)) + 1)]
ESCALA = {"timbre": 3.0, "conc": .05, "ancha": .05, "ataque": 15.0, "hueco": 2.0, "consonantes": 2.0}
# "ancha" depende mucho del ruido de fondo y de lo que deja Demucs: se informa, pero no pesa en la distancia
PESO = {"timbre": .5, "conc": 1.5, "ancha": 0.0, "ataque": 1.0, "hueco": 1.0, "consonantes": 1.0}


def leer(ruta):
    x, sr = sf.read(ruta, always_2d=True, dtype="float32")
    x = x.mean(1)
    assert sr == SR, f"{ruta}: {sr} Hz"
    return x / (np.abs(x).max() + 1e-9)


def golpes_de(f):
    an = json.loads((TRABAJO / "analisis" / f"{f['tramo']}.json").read_text(encoding="utf-8"))
    return [(t0 - f["t0"], min(t1, f["t1"]) - f["t0"], ps) for (q, d, ps, _), (t0, t1) in zip(an["golpes"], an["segs"]) if f["t0"] <= t0 < f["t1"] - .05]


def ltas(x):
    N, H = 4096, 2048
    ventana = np.hanning(N)
    cuadros = np.array([x[o:o + N] * ventana for o in range(0, len(x) - N, H)])
    if not len(cuadros):
        return np.zeros(len(CENTROS))
    S = np.abs(np.fft.rfft(cuadros, axis=1)) ** 2
    fr = np.fft.rfftfreq(N, 1 / SR)
    e = S.sum(1)
    lf, hf = S[:, (fr >= 100) & (fr < 1000)].sum(1), S[:, (fr >= 4000) & (fr < 10000)].sum(1)
    dif = 10 * np.log10((hf + 1e-12) / (lf + 1e-12))
    # sólo vocales: cuadros fuertes y sin eses
    ok = (e >= np.quantile(e, .4)) & (dif <= np.median(dif) + 8)
    S = S[ok].mean(0)
    db = np.array([10 * np.log10(S[(fr >= c / 2 ** (1 / 6)) & (fr < c * 2 ** (1 / 6))].mean() + 1e-20) for c in CENTROS])
    ref = db[[i for i, c in enumerate(CENTROS) if 300 <= c <= 1000]].mean()
    return db - ref


def envolvente(x, paso):
    n = len(x) // paso
    return np.sqrt((x[: n * paso].reshape(n, paso) ** 2).mean(1) + 1e-12)


def medidas(x, golpes, con_letra):
    m = {"ltas": ltas(x).round(2).tolist()}
    # unísono: golpes de una sola nota
    an, co = [], []
    for t0, t1, ps in golpes:
        if len(ps) != 1 or t1 - t0 < .15:
            continue
        s = x[int((t0 + .04) * SR): int((t1 - .02) * SR)]
        if len(s) < 4000:
            continue
        de, _, cum, tot = medir_pureza(s, ps)
        a, c = unisono(cum, tot, ps[0], de)
        an.append(a); co.append(c)
    m["ancha"] = float(np.median(an)) if an else None
    m["conc"] = float(np.median(co)) if co else None
    # ataque: del 10 al 90 % de la subida, en milisegundos
    paso = int(.002 * SR)
    env = envolvente(x, paso)
    sube = []
    for t0, t1, _ in golpes:
        i0, i1 = int((t0 - .05) * SR / paso), int((t0 + .15) * SR / paso)
        if i0 < 0 or i1 >= len(env):
            continue
        tramo = env[i0:i1]
        base, pico = tramo[:25].min(), tramo.max()
        if pico < 2 * base:
            continue
        a = np.argmax(tramo >= base + .1 * (pico - base)); b = np.argmax(tramo >= base + .9 * (pico - base))
        if b > a:
            sube.append((b - a) * paso / SR * 1000)
    m["ataque"] = float(np.median(sube)) if sube else None
    # hueco entre golpes seguidos
    paso5 = int(.005 * SR)
    e5 = 20 * np.log10(envolvente(x, paso5))
    huecos = []
    for (a0, a1, _), (b0, b1, _) in zip(golpes, golpes[1:]):
        if b0 - a1 > .1 or b0 - a0 < .12:
            continue
        ca, cb = int((a0 + a1) / 2 * SR / paso5), int((b0 + b1) / 2 * SR / paso5)
        lo, hi = int((b0 - .06) * SR / paso5), int((b0 + .03) * SR / paso5)
        if hi >= len(e5) or cb >= len(e5) or lo < 0:
            continue
        huecos.append((e5[ca] + e5[cb]) / 2 - e5[lo:hi].min())
    m["hueco"] = float(np.median(huecos)) if huecos else None
    # consonantes: agudos antes del golpe contra la vocal
    if con_letra:
        cons = []
        for t0, t1, _ in golpes:
            a, b = int((t0 - .06) * SR), int(t0 * SR)
            c, d = int((t0 + (t1 - t0) * .4) * SR), int((t0 + (t1 - t0) * .6) * SR)
            if a < 0 or d >= len(x) or d - c < 512:
                continue
            def hf(s):
                S = np.abs(np.fft.rfft(s * np.hanning(len(s)))) ** 2
                fr = np.fft.rfftfreq(len(s), 1 / SR)
                return 10 * np.log10((S[(fr >= 4000) & (fr < 10000)].sum() + 1e-12) / (S[(fr >= 100) & (fr < 1000)].sum() + 1e-12))
            cons.append(hf(x[a:b]) - hf(x[c:d]))
        m["consonantes"] = float(np.median(cons)) if cons else None
    return m


def comparar(real, sint):
    d = {"timbre": float(np.mean(np.abs(np.array(real["ltas"]) - np.array(sint["ltas"]))))}
    for k in ("conc", "ancha", "ataque", "hueco", "consonantes"):
        if real.get(k) is not None and sint.get(k) is not None:
            d[k] = abs(real[k] - sint[k])
    d["total"] = sum(PESO[k] * v / ESCALA[k] for k, v in d.items())
    return d


def fragmentos():
    return json.loads((BANCO / "fragmentos.json").read_text(encoding="utf-8"))


def medidas_reales(frs):
    """Las del coro real no cambian: se guardan."""
    cache = BANCO / "real_medidas.json"
    viejas = json.loads(cache.read_text(encoding="utf-8")) if cache.exists() else {}
    for f in frs:
        if f["id"] not in viejas:
            viejas[f["id"]] = medidas(leer(BANCO / "real" / f"{f['id']}.wav"), golpes_de(f), (BANCO / "letras" / f"{f['id']}.txt").exists())
    cache.write_text(json.dumps(viejas), encoding="utf-8")
    return viejas


def medir_carpeta(carpeta, frs=None):
    frs = frs or fragmentos()
    reales = medidas_reales(frs)
    res = []
    for f in frs:
        ruta = Path(carpeta) / f"{f['id']}.wav"
        if not ruta.exists():
            continue
        s = medidas(leer(ruta), golpes_de(f), (BANCO / "letras" / f"{f['id']}.txt").exists())
        res.append({"id": f["id"], "control": f.get("control", False), "real": reales[f["id"]], "sintetico": s, "diferencia": comparar(reales[f["id"]], s)})
    def resumen(lista):
        if not lista:
            return {}
        ks = set().union(*[r["diferencia"].keys() for r in lista])
        return {k: float(np.mean([r["diferencia"][k] for r in lista if k in r["diferencia"]])) for k in ks}
    return {"fragmentos": res, "ajuste": resumen([r for r in res if not r["control"]]), "control": resumen([r for r in res if r["control"]]),
            "todos": resumen(res)}


def tabla(R):
    filas = ["| Fragmento | timbre dB | unísono ancho (real/sint) | una voz (real/sint) | ataque ms (real/sint) | hueco dB (real/sint) | distancia |", "|---|---|---|---|---|---|---|"]
    f2 = lambda v: "—" if v is None else f"{v:.2f}"
    f0 = lambda v: "—" if v is None else f"{v:.0f}"
    for r in R["fragmentos"]:
        a, b, d = r["real"], r["sintetico"], r["diferencia"]
        filas.append(f"| {r['id']}{' (control)' if r['control'] else ''} | {d['timbre']:.1f} | {f2(a['ancha'])} / {f2(b['ancha'])} | {f2(a['conc'])} / {f2(b['conc'])} | "
                     f"{f0(a['ataque'])} / {f0(b['ataque'])} | {f2(a['hueco'])} / {f2(b['hueco'])} | {d['total']:.2f} |")
    filas.append(f"\nDistancia media: ajuste {R['ajuste'].get('total', 0):.2f} · control {R['control'].get('total', 0):.2f}")
    return "\n".join(filas)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sintetico", default=str(BANCO / "sintetico"))
    ap.add_argument("--salida", default=None)
    a = ap.parse_args()
    R = medir_carpeta(a.sintetico)
    print(tabla(R))
    if a.salida:
        Path(a.salida).write_text(json.dumps(R, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
