"""
banco.py — el coro de verdad: recortes de golpes reales para que el generador cante con voces de murga.

Cada golpe que el transcriptor leyó bien (la energía del audio cae en los parciales de las notas que dijo)
se recorta de las voces separadas, se le mide la afinación real y se iguala su color con el resto del banco.
El generador elige para cada golpe de la pieza un recorte con el mismo acorde a una altura cercana.

Los recortes son pedacitos de grabaciones ajenas: quedan en murga_trabajo/banco, fuera de git, para uso
personal. Sin banco, la página canta con las muestras "aah".

Uso (después de herramientas/analizar.js):
  python banco.py
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

RAIZ = Path(__file__).resolve().parent.parent
TRABAJO = RAIZ / "murga_trabajo"
ANALISIS, VOCES, BANCO = TRABAJO / "analisis", TRABAJO / "voces", TRABAJO / "banco"
ESTILOS = {"La Trasnochada": "trasnochada", "Agarrate Catalina": "catalina", "La Gran Muñeca": "muneca", "Metele que son Pasteles": "pasteles"}

SR = 44100
N = 1 << 15                 # ventana para medir: 0,74 s
ANTES = 0.04                # el recorte arranca antes del ataque: las consonantes están ahí
DESPUES = 0.06
PUREZA_MIN = 0.42           # energía en los parciales esperados
# Un unísono de trece personas no afina exacto: su energía se reparte alrededor de cada parcial, y con la ventana
# angosta parece impuro. Se lo mide con una ventana de ±3 %, y se pide que no haya otra voz cerca.
UNISONO_MIN = 0.55          # energía a ±3 % de los parciales
SOLISTA_MAX = 0.40          # parciales demasiado finos: es una sola persona, no el coro
OTRA_VOZ_MAX = 1.5          # fundamentales consonantes contra disonantes, arriba y abajo
TOPE_UNISONO = 10           # el unísono es un solo acorde por nota, y un tercio de los golpes
CORTOS, LARGOS = 0.30, 0.70
TOPE_CELDA = 3              # recortes por (nota de arriba, forma del acorde, largo)
TOPE_NOTA = 90              # recortes por (nota de arriba, largo)
MIN_SEG = 0.11
BANDAS = np.geomspace(100, 12000, 24)
PUREZAS = {}
UNISONOS = []

FR = np.fft.rfftfreq(N, 1 / SR)
BANDA = (FR > 90) & (FR < 4000)
CENTS = np.arange(-60, 61, 5)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def medir(s, ps):
    """Afinación del golpe en cents y qué parte de la energía cae en los parciales de sus notas."""
    if len(s) > N:
        m = len(s) // 2
        s = s[m - N // 2 : m + N // 2]
    S = np.abs(np.fft.rfft(s * np.hanning(len(s)), N)) ** 2
    tot = S[BANDA].sum() + 1e-12
    cum = np.concatenate(([0.0], np.cumsum(S)))
    f0 = np.array([hz(p) for p in ps])[None, :, None]
    h = np.arange(1, 7)[None, None, :]
    de = (2 ** (CENTS / 1200))[:, None, None]
    f = f0 * h * de
    i = (f * N / SR).astype(int)
    w = np.maximum(2, (f * 0.012 * N / SR).astype(int))
    v = f < 4000
    ini = np.clip(i - w, 0, len(S))
    fin = np.clip(i + w + 1, 0, len(S))
    sc = ((cum[fin] - cum[ini]) * v).sum(axis=(1, 2))
    k = int(np.argmax(sc))
    return int(CENTS[k]), float(sc[k] / tot), S, cum, tot


def banda(cum, f):
    i = int(f * 0.985 * N / SR)
    j = int(f * 1.015 * N / SR) + 1
    return (cum[j] - cum[i]) / max(1, j - i)


def otra_voz(cum, p):
    """¿Hay otra voz? Energía en las fundamentales consonantes contra las disonantes. El ruido llena las dos;
    una voz a la tercera o a la quinta, sólo las consonantes. Se mira arriba y abajo de la nota."""
    r = 0.0
    for s in (1, -1):
        con = np.mean([banda(cum, hz(p + s * k)) for k in (3, 4, 5, 7)])
        dis = np.mean([banda(cum, hz(p + s * k)) for k in (1, 2, 6, 11)])
        r = max(r, con / (dis + 1e-9))
    return float(r)


def unisono(cum, tot, p, de):
    """Energía a ±3 % de los parciales, y cuánta de ella está en ±0,6 %: si es casi toda, es una sola voz."""
    an, fi = 0.0, 0.0
    for h in range(1, 8):
        f = hz(p + de / 100) * h
        if f > 4000:
            break
        i = int(f * N / SR)
        w1, w2 = max(1, int(f * 0.006 * N / SR)), max(2, int(f * 0.03 * N / SR))
        fi += cum[min(len(cum) - 1, i + w1 + 1)] - cum[max(0, i - w1)]
        an += cum[min(len(cum) - 1, i + w2 + 1)] - cum[max(0, i - w2)]
    return an / tot, fi / (an + 1e-12)


def espectro(s):
    if len(s) < 2048:
        return None
    S = np.abs(np.fft.rfft(s * np.hanning(len(s)))) ** 2
    fr = np.fft.rfftfreq(len(s), 1 / SR)
    return np.array([S[(fr >= a) & (fr < b)].mean() if ((fr >= a) & (fr < b)).any() else 0 for a, b in zip(BANDAS[:-1], BANDAS[1:])])


def tramos():
    for f in sorted(ANALISIS.glob("*.json")):
        an = json.loads(f.read_text(encoding="utf-8"))
        if "segs" in an and (VOCES / f"{an['nombre']}.flac").exists() and an["murga"] in ESTILOS:
            yield an


def candidatos(an):
    x, sr = sf.read(VOCES / f"{an['nombre']}.flac", dtype="float32", always_2d=True)
    x = x.mean(1)
    assert sr == SR
    G, T = an["golpes"], an["segs"]
    res, afin, esp = [], [], []
    # ¿Hay batería en este momento? La energía de lo que no es voz, cada medio segundo
    e = an["energia"]
    resto = np.array(e["drums"]) + np.array(e["other"]) + np.array(e["bass"])
    hay = resto > 0.28 * np.percentile(resto, 80)
    for i, ((q, d, ps, _), (t0, t1)) in enumerate(zip(G, T)):
        sig = T[i + 1][0] if i + 1 < len(T) else t1 + 1
        fin = min(t1 + DESPUES, sig + 0.015)
        dur = fin - t0
        if dur < MIN_SEG or dur > 6:
            continue
        a = int((t0 + min(0.05, dur * 0.25)) * SR)
        b = int((fin - min(0.03, dur * 0.15)) * SR)
        s = x[a:b]
        if len(s) < 3000:
            continue
        de, pur, _, cum, tot = medir(s, ps)
        afin.append((dur, de))
        PUREZAS.setdefault(min(len(ps), 4), []).append(pur)
        if len(ps) == 1:
            # Un solo golpe de coro al unísono: otra vara
            otra = otra_voz(cum, ps[0])
            an, conc = unisono(cum, tot, ps[0], de)
            UNISONOS.append((otra, an, conc))
            pur = an * 0.8 if an >= UNISONO_MIN and conc <= SOLISTA_MAX and otra <= OTRA_VOZ_MAX else 0.0
        rms = float(np.sqrt((s**2).mean()))
        if pur < PUREZA_MIN:
            continue
        top = ps[-1]
        dist = sorted({top - p for p in ps[:-1]})
        res.append({"t0": t0, "fin": fin, "dur": dur, "ps": ps, "top": top, "dist": dist, "de": de, "pur": pur, "rms": rms, "q": q, "d": d, "bat": int(hay[min(len(hay) - 1, int(t0 * 2))])})
        e = espectro(s)
        if e is not None and dur > 0.25:
            esp.append(e)
    med = np.median([r["rms"] for r in res]) if res else 1
    res = [r for r in res if r["rms"] > 0.55 * med]
    # La afinación de cada golpe corto es ruidosa: se apoya en la de todo el tramo
    tono = float(np.median([d for u, d in afin if u > 0.35])) if afin else 0.0
    for r in res:
        peso = min(1.0, max(0.0, (r["dur"] - 0.15) / 0.5))
        r["cents"] = peso * r["de"] + (1 - peso) * tono
    ltas = 10 * np.log10(np.median(esp, axis=0) + 1e-12) if esp else None
    return x, res, ltas, tono


def clase(dur):
    return 0 if dur < CORTOS else 1 if dur < LARGOS else 2


def elegir(C):
    """Lo mejor de cada lugar, repartido entre tramos para que no quede todo de uno."""
    C = sorted(C, key=lambda c: -c["pur"] * (1 + min(c["dur"], 2) * 0.15))
    celda, nota, por_src, res = {}, {}, {}, []
    for c in C:
        kc = (c["top"], tuple(c["dist"]), clase(c["dur"]))
        kn = (c["top"], clase(c["dur"]))
        ks = (c["src"], c["top"], tuple(c["dist"]), clase(c["dur"]))
        uni = not c["dist"]
        if celda.get(kc, 0) >= (TOPE_UNISONO if uni else TOPE_CELDA) or nota.get(kn, 0) >= TOPE_NOTA or por_src.get(ks, 0) >= (3 if uni else 1):
            continue
        celda[kc] = celda.get(kc, 0) + 1
        nota[kn] = nota.get(kn, 0) + 1
        por_src[ks] = por_src.get(ks, 0) + 1
        res.append(c)
    return res


def igualar(s, curva):
    """Lleva el color del tramo al color mediano del banco (filtro por FFT, hasta ±9 dB)."""
    n = len(s)
    S = np.fft.rfft(s, 2 * n)
    fr = np.fft.rfftfreq(2 * n, 1 / SR)
    c = (BANDAS[:-1] * BANDAS[1:]) ** 0.5
    g = 10 ** (np.interp(np.log(fr + 1), np.log(c), curva) / 20)
    return np.fft.irfft(S * g)[:n]


def main():
    BANCO.mkdir(parents=True, exist_ok=True)
    por = {}
    ltas = {}
    audio = {}
    for an in tramos():
        n = an["nombre"]
        x, res, l, tono = candidatos(an)
        print(f"{n:44s} {len(res):5d} candidatos  afinación {tono:+.0f} c", flush=True)
        if l is None or not res:
            continue
        ltas[n] = l
        for r in res:
            r["src"] = n
        por.setdefault(ESTILOS[an["murga"]], []).extend(res)
        audio[n] = None
        del x
    cen = np.median(list(ltas.values()), axis=0)
    # Un tramo muy opaco o muy finito no se puede arreglar con ecualización: afuera
    malos = {n for n, l in ltas.items() if abs((l - cen)[-6:].mean() - (l - cen)[:12].mean()) > 14}
    if malos:
        print("sin usar por el color:", ", ".join(sorted(malos)))
    fuentes = sorted(ltas)
    resumen = {}
    for estilo, C in por.items():
        el = elegir([c for c in C if c["src"] not in malos])
        el.sort(key=lambda c: (c["src"], c["t0"]))
        trozos, indice = [], []
        pos = 0
        por_src = {}
        for c in el:
            por_src.setdefault(c["src"], []).append(c)
        for src, lista in por_src.items():
            x, _ = sf.read(VOCES / f"{src}.flac", dtype="float32", always_2d=True)
            x = x.mean(1)
            curva = np.clip(cen - ltas[src], -9, 9)
            for c in lista:
                a = max(0, int((c["t0"] - ANTES) * SR))
                b = min(len(x), int(c["fin"] * SR))
                s = igualar(x[a:b], curva)
                # sin ataque de clic y con cola suave
                n = len(s)
                f1, f2 = min(n // 4, int(0.004 * SR)), min(n // 3, int(0.012 * SR))
                s[:f1] *= np.linspace(0, 1, f1)
                s[-f2:] *= np.linspace(1, 0, f2)
                pasivo = s[int(ANTES * SR) :]
                rms = float(np.sqrt((pasivo**2).mean())) + 1e-6
                s *= 0.16 / rms
                s = np.clip(s, -1, 1)
                indice.append([pos, n, round(c["top"] + c["cents"] / 100, 2), c["dist"], fuentes.index(src), round(c["pur"], 2), c["top"], c["bat"]])
                trozos.append(s.astype(np.float32))
                trozos.append(np.zeros(int(0.02 * SR), np.float32))
                pos += n + int(0.02 * SR)
            del x
        audio = np.concatenate(trozos)
        sf.write(BANCO / f"{estilo}.flac", audio, SR, subtype="PCM_16")
        seg = len(audio) / SR
        d = np.array([x[1] / SR for x in indice])
        resumen[estilo] = {"recortes": len(indice), "segundos": round(seg), "sr": SR, "antes": ANTES}
        (BANCO / f"{estilo}.json").write_text(json.dumps({"sr": SR, "antes": ANTES, "fuentes": fuentes, "r": indice}, ensure_ascii=False), encoding="utf-8")
        print(f"{estilo}: {len(indice)} recortes, {seg:.0f} s, cortos {np.mean(d < CORTOS):.0%}, largos {np.mean(d >= LARGOS):.0%}, {(BANCO / f'{estilo}.flac').stat().st_size / 1e6:.0f} MB")
    (BANCO / "banco.json").write_text(json.dumps(resumen, ensure_ascii=False), encoding="utf-8")
    U = np.array(UNISONOS)
    pureza = {str(k): round(float(np.median(v)), 3) for k, v in sorted(PUREZAS.items())}
    pureza.update(sinOtraVoz=round(float((U[:, 0] < 3).mean()), 3), energiaAncha=round(float(np.median(U[:, 1])), 3), solistas=round(float((U[:, 2] > SOLISTA_MAX).mean()), 3))
    (TRABAJO / "pureza.json").write_text(json.dumps(pureza), encoding="utf-8")


if __name__ == "__main__":
    main()
