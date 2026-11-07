"""
pureza.py — ¿el transcriptor leyó bien cada golpe? ¿El unísono es de verdad?

Para cada golpe de cada tramo mide, sobre las voces separadas, qué parte de la energía cae en los parciales de
las notas que dijo el transcriptor (la pureza) y a cuántos cents está afinado. En los golpes de una sola voz mira
además si hay otra voz escondida a la tercera o a la quinta, y qué tan ancho es el unísono: trece personas no
afinan exacto, y su energía se reparte alrededor de cada parcial.

Escribe murga_trabajo/pureza.json, que lee herramientas/informe.js (regla 12 del análisis).

Uso (después de herramientas/analizar.js, con las voces separadas en murga_trabajo/voces):
  python pureza.py
"""
import json
from pathlib import Path

import numpy as np
import soundfile as sf

RAIZ = Path(__file__).resolve().parent.parent
TRABAJO = RAIZ / "murga_trabajo"
ANALISIS, VOCES = TRABAJO / "analisis", TRABAJO / "voces"
MURGAS = {"La Trasnochada", "Agarrate Catalina", "La Gran Muñeca", "Metele que son Pasteles"}

SR = 44100
N = 1 << 15                 # ventana para medir: 0,74 s
DESPUES = 0.06              # el golpe se mide hasta un poco después de que termina
MIN_SEG = 0.11
SOLISTA_MAX = 0.40          # si casi toda la energía está a ±0,6 % de los parciales, es una sola persona
OTRA_VOZ = 3                # fundamentales consonantes contra disonantes: arriba de esto hay otra voz

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
    return int(CENTS[k]), float(sc[k] / tot), cum, tot


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


def tramos():
    for f in sorted(ANALISIS.glob("*.json")):
        an = json.loads(f.read_text(encoding="utf-8"))
        if "segs" in an and (VOCES / f"{an['nombre']}.flac").exists() and an["murga"] in MURGAS:
            yield an


def medir_tramo(an, purezas, unisonos):
    x, sr = sf.read(VOCES / f"{an['nombre']}.flac", dtype="float32", always_2d=True)
    x = x.mean(1)
    assert sr == SR
    G, T = an["golpes"], an["segs"]
    n = 0
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
        de, pur, cum, tot = medir(s, ps)
        purezas.setdefault(min(len(ps), 4), []).append(pur)
        if len(ps) == 1:
            ancha, conc = unisono(cum, tot, ps[0], de)
            unisonos.append((otra_voz(cum, ps[0]), ancha, conc))
        n += 1
    return n


def main():
    purezas, unisonos = {}, []
    for an in tramos():
        n = medir_tramo(an, purezas, unisonos)
        print(f"{an['nombre']:44s} {n:5d} golpes medidos", flush=True)
    U = np.array(unisonos)
    pureza = {str(k): round(float(np.median(v)), 3) for k, v in sorted(purezas.items())}
    pureza.update(sinOtraVoz=round(float((U[:, 0] < OTRA_VOZ).mean()), 3), energiaAncha=round(float(np.median(U[:, 1])), 3), solistas=round(float((U[:, 2] > SOLISTA_MAX).mean()), 3))
    (TRABAJO / "pureza.json").write_text(json.dumps(pureza), encoding="utf-8")
    print(json.dumps(pureza))


if __name__ == "__main__":
    main()
