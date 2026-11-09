"""
solistas_buscar.py — busca en las voces separadas (murga_trabajo/voces/*.flac, Demucs) los pasajes donde canta UNA
persona sola: el solista de una introducción, de un verso o de un recitado, no el coro.

La idea es la de pureza.py (trece personas no afinan exacto), pero medida de forma que el vibrato no la engañe:
  - la altura, cuadro a cuadro (cada 10 ms), con YIN sobre la voz entera;
  - la coherencia entre períodos en la banda de 800 Hz a 3 kHz: la correlación de la onda con ella misma corrida
    1, 2 y 3 períodos (buscando el mejor corrimiento cerca de cada uno). Una sola voz se repite casi igual de un
    período al otro, aunque tenga vibrato (el vibrato cambia el período despacio, y el corrimiento se busca cuadro a
    cuadro). En un coro cada cantor está a unos cents del otro: el armónico 8 de dos cantores a 15 cents se corre un
    cuarto de vuelta en 3 períodos, y la suma deja de parecerse a sí misma. Se usa la de 3 períodos (rho3);
  - además, para validar (no para decidir): cuánto se parecen el canal izquierdo y el derecho. Un solista con su
    micrófono suena en el medio; el coro, tomado por varios micrófonos, se abre.

Un pasaje es de solista si dura 2 s o más, hay voz buena parte del tiempo y, en ventanas de medio segundo, la
coherencia mediana de los cuadros con voz pasa el umbral; se cortan donde aparece el coro (0,2 s de cuadros con voz y
coherencia baja). Después se separa lo cantado de lo hablado: cantando, la altura se queda en notas.

La coherencia sola no separa una voz de dos o tres muy juntas (con --validar: doce copias a ±20 cents todavía dan
rho3 0,65). La prueba fuerte es la finura de los parciales (finura()): la onda remuestreada siguiendo la altura del
cantor, vibrato incluido, y el espectro de bloques de 32 períodos; una voz deja cada armónico en su casillero, varias
lo desparraman. Los pasajes «estrictos» (los que mide solistas_medir.mjs) piden además finura de 0,88 o más.
Lo explica docs/solistas_reales.md.

Uso (TEMP=D:\\tmp\\murga, PYTHONUTF8=1):
  D:\\uv\\murga\\Scripts\\python.exe herramientas/solistas_buscar.py [tramo ...]   busca (guarda los cuadros en caché)
      --umbral 0.62     la coherencia mínima (rho3)
      --finura 0.88     la finura mínima de los parciales para que un pasaje sea «estricto» (los que se miden)
      --validar         además: coros artificiales (el mismo solista, copiado y desafinado) y los golpes a varias
                        voces del análisis (coro seguro), contra lo encontrado
      --clips           escribe cada pasaje en murga_trabajo/solistas/clips/ (wav mono, 22 kHz) para escucharlo
Escribe murga_trabajo/solistas/segmentos.json, y murga_trabajo/solistas/cuadros/<tramo>.npz (las medidas de cada
cuadro: con la caché, cambiar el umbral no recalcula nada).
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, resample_poly, sosfiltfilt

RAIZ = Path(__file__).resolve().parent.parent
TRABAJO = RAIZ / "murga_trabajo"
VOCES, ANALISIS = TRABAJO / "voces", TRABAJO / "analisis"
SALIDA = TRABAJO / "solistas"
CACHE = SALIDA / "cuadros"

SR = 16000
HOP = 160                 # 10 ms
W = 480                   # ventana de YIN: 30 ms
TMIN, TMAX = 16, 213      # 1000 Hz a 75 Hz
NFFT = 1024
W2 = 320                  # ventana de la coherencia: 20 ms
LMAX = 700                # hasta 3 períodos de 213 muestras (y un poco)
YIN_UMBRAL = 0.15
BANDA = (800, 3000)

UMBRAL = 0.62             # rho3 mediana de una ventana de 0,5 s: arriba, una sola voz o pocas muy juntas (ver --validar)
FINURA = 0.88             # finura de los parciales (ver finura()): arriba, una sola voz
SONORO_AP = 0.30          # YIN: abajo de esto hay altura
MIN_SEG = 2.0             # segundos
HUECO_MAX = 0.40          # silencio o consonante que no corta un pasaje
CORO_CORTA = 0.20         # tanto tiempo de cuadros con voz de coro corta el pasaje


def leer(nombre):
    x, sr = sf.read(VOCES / f"{nombre}.flac", dtype="float32", always_2d=True)
    assert sr == 44100, sr
    y = resample_poly(x, 160, 441, axis=0).astype(np.float32)
    return y  # (n, canales) a 16 kHz


def cuadros(x, largo, n):
    """n cuadros de `largo` muestras cada HOP, desde 0 (con ceros al final)."""
    falta = (n - 1) * HOP + largo - len(x)
    if falta > 0:
        x = np.concatenate([x, np.zeros(falta, x.dtype)])
    s = x.strides[0]
    return np.lib.stride_tricks.as_strided(x, shape=(n, largo), strides=(HOP * s, s))


def correlaciones(x, n, w, lmax, c0, c1):
    """Para los cuadros c0..c1: r(τ) = Σ a[j] b[j+τ] (a: w muestras, b: w+lmax), la energía de a y la de b corrida."""
    A = cuadros(x, w, n)[c0:c1].astype(np.float64)
    B = cuadros(x, w + lmax, n)[c0:c1].astype(np.float64)
    r = np.fft.irfft(np.conj(np.fft.rfft(A, NFFT)) * np.fft.rfft(B, NFFT), NFFT)[:, : lmax + 1]
    e1 = (A * A).sum(1)
    cs = np.concatenate([np.zeros((len(B), 1)), np.cumsum(B * B, 1)], 1)
    e2 = cs[:, w : w + lmax + 1] - cs[:, : lmax + 1]
    return r, e1, e2


def parabola(y, i):
    """Corrección fraccionaria del extremo en i (vectorizada): devuelve (delta, valor)."""
    ym, y0, yp = y[np.arange(len(i)), i - 1], y[np.arange(len(i)), i], y[np.arange(len(i)), i + 1]
    den = ym - 2 * y0 + yp
    d = np.where(np.abs(den) > 1e-12, 0.5 * (ym - yp) / np.where(den == 0, 1, den), 0.0)
    d = np.clip(d, -0.5, 0.5)
    return d, y0 - 0.25 * (ym - yp) * d


def medir_cuadros(y):
    """Las medidas de cada cuadro de 10 ms: nivel, f0, aperiodicidad de YIN, coherencia a 1, 2 y 3 períodos en la
    banda, y la correlación entre los canales."""
    mono = y.mean(1)
    n = len(mono) // HOP
    sos = butter(4, BANDA, btype="band", fs=SR, output="sos")
    hb = sosfiltfilt(sos, mono).astype(np.float32)
    nivel = np.zeros(n, np.float32)
    f0 = np.zeros(n, np.float32)
    ap = np.ones(n, np.float32)
    rho = np.zeros((n, 3), np.float32)
    tau_ = np.arange(TMAX + 1)
    PASO = 4000
    for c0 in range(0, n, PASO):
        c1 = min(n, c0 + PASO)
        r, e1, e2 = correlaciones(mono, n, W, TMAX, c0, c1)
        nivel[c0:c1] = 10 * np.log10(e1 / W + 1e-10)
        d = e1[:, None] + e2 - 2 * r
        d[:, 0] = 0
        cm = np.cumsum(d[:, 1:], 1)
        cmnd = np.ones_like(d)
        cmnd[:, 1:] = d[:, 1:] * tau_[1:] / np.maximum(cm, 1e-12)
        zona = cmnd[:, TMIN : TMAX - 1]
        bajo = zona < YIN_UMBRAL
        hay = bajo.any(1)
        primero = np.where(hay, bajo.argmax(1), zona.argmin(1))
        # el mínimo local que sigue al primer cruce (dentro de un 25 % más de período)
        ext = np.minimum(zona.shape[1] - 1, primero + np.maximum(3, (primero + TMIN) // 4))
        idx = np.arange(zona.shape[1])[None, :]
        enrango = (idx >= primero[:, None]) & (idx <= ext[:, None])
        i = np.where(enrango, zona, np.inf).argmin(1) + TMIN
        i = np.clip(i, TMIN, TMAX - 2)
        dt, val = parabola(cmnd, i)
        tau = i + dt
        f0[c0:c1] = SR / tau
        ap[c0:c1] = np.clip(val, 0, 2)
        # la coherencia en la banda, cerca de k períodos
        r2, e12, e22 = correlaciones(hb, n, W2, LMAX, c0, c1)
        nr = r2 / np.sqrt(np.maximum(e12[:, None] * e22, 1e-20))
        filas = np.arange(c1 - c0)
        for k in (1, 2, 3):
            centro = np.clip(np.round(k * tau).astype(int), 4, LMAX - 4)
            off = np.arange(-3, 4)
            cand = nr[filas[:, None], centro[:, None] + off[None, :]]
            j = cand.argmax(1) + centro - 3
            j = np.clip(j, 1, LMAX - 1)
            _, v = parabola(nr, j)
            rho[c0:c1, k - 1] = np.clip(v, -1, 1)
    # los canales: correlación de izquierda y derecha, en la banda, en cuadros de 30 ms
    if y.shape[1] > 1:
        L = sosfiltfilt(sos, y[:, 0]).astype(np.float32)
        R = sosfiltfilt(sos, y[:, 1]).astype(np.float32)
        a, b = cuadros(L, W, n), cuadros(R, W, n)
        lr = (a * b).sum(1) / np.sqrt((a * a).sum(1) * (b * b).sum(1) + 1e-12)
    else:
        lr = np.ones(n, np.float32)
    return dict(nivel=nivel, f0=f0, ap=ap, rho=rho, lr=lr.astype(np.float32))


def cargar_cuadros(nombre):
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{nombre}.npz"
    if f.exists():
        z = np.load(f)
        return {k: z[k] for k in z.files}
    q = medir_cuadros(leer(nombre))
    np.savez_compressed(f, **q)
    return q


def mediana_movil(v, ok, w):
    """Mediana de v en ventanas de w cuadros, sólo con los cuadros ok (NaN si hay menos de un tercio)."""
    n = len(v)
    out = np.full(n, np.nan, np.float32)
    h = w // 2
    vv = np.where(ok, v, np.nan)
    cuadros_ = np.lib.stride_tricks.sliding_window_view(np.concatenate([np.full(h, np.nan), vv, np.full(h, np.nan)]), w)[:n]
    cuenta = np.isfinite(cuadros_).sum(1)
    with np.errstate(all="ignore"):
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            med = np.nanmedian(cuadros_, 1)
    out[cuenta >= w // 3] = med[cuenta >= w // 3]
    return out


def clasificar(q, umbral=UMBRAL):
    """Cada cuadro: 0 sin voz, 1 voz de solista, 2 voz de coro (o dudosa). Y la mediana móvil de rho3."""
    nivel, f0, ap, rho = q["nivel"], q["f0"], q["ap"], q["rho"]
    ref = np.percentile(nivel, 95)
    activo = nivel > ref - 30
    sonoro = activo & (ap < SONORO_AP) & (f0 > 75) & (f0 < 1000)
    rm = mediana_movil(rho[:, 2], sonoro, 50)
    cl = np.zeros(len(nivel), np.int8)
    cl[sonoro & (rm >= umbral)] = 1
    cl[sonoro & ~(rm >= umbral)] = 2
    return cl, rm, sonoro, activo


def pasajes(q, umbral=UMBRAL):
    """Los pasajes de solista: tramos de cuadros 1 unidos a través de huecos sin voz, cortados por el coro."""
    cl, rm, sonoro, activo = clasificar(q, umbral)
    n = len(cl)
    segs = []
    i = 0
    while i < n:
        if cl[i] != 1:
            i += 1
            continue
        a = i
        ult = i       # último cuadro de solista
        coro = 0
        hueco = 0
        j = i + 1
        while j < n:
            if cl[j] == 1:
                ult, coro, hueco = j, 0, 0
            elif cl[j] == 2:
                coro += 1
                if coro * HOP / SR >= CORO_CORTA:
                    break
            else:
                hueco += 1
                if hueco * HOP / SR > HUECO_MAX:
                    break
            j += 1
        b = ult + 1
        if (b - a) * HOP / SR >= MIN_SEG:
            segs.append((a, b))
        i = j
    return segs, cl, rm


def describir(q, a, b, cl):
    f0, rho, lr = q["f0"][a:b], q["rho"][a:b], q["lr"][a:b]
    c = cl[a:b]
    s = c == 1
    cents = 1200 * np.log2(f0[s] / 440) + 6900
    # cantado o hablado: qué parte de los cuadros con voz está en una nota. Sin el vibrato (promedio de 180 ms, un
    # ciclo de vibrato), la altura se queda quieta (menos de 70 cents de punta a punta en 120 ms); hablando se mueve
    quieto = 0
    if s.sum() > 20:
        import warnings
        ct = np.where(s, 1200 * np.log2(np.maximum(f0, 1) / 440), np.nan)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            win = np.lib.stride_tricks.sliding_window_view(np.concatenate([np.full(9, np.nan), ct, np.full(8, np.nan)]), 18)
            lisa = np.where(np.isfinite(win).sum(1) >= 12, np.nanmean(win, 1), np.nan)
            win = np.lib.stride_tricks.sliding_window_view(np.concatenate([np.full(6, np.nan), lisa, np.full(6, np.nan)]), 13)
            rango = np.nanmax(win, 1) - np.nanmin(win, 1)
            llenos = np.isfinite(win).sum(1) >= 11
        quieto = float(((rango < 70) & llenos & s).sum() / max(1, s.sum()))
    return dict(
        desde=round(a * HOP / SR, 2), hasta=round(b * HOP / SR, 2), largo=round((b - a) * HOP / SR, 2),
        sonoro=round(float(s.mean()), 3), coro=round(float((c == 2).mean()), 3),
        rho1=round(float(np.median(rho[s, 0])), 3), rho3=round(float(np.median(rho[s, 2])), 3),
        lr=round(float(np.median(lr[s])), 3),
        altura=round(float(np.median(cents)) / 100, 1) if len(cents) else None,
        rango=round(float(np.percentile(cents, 95) - np.percentile(cents, 5)) / 100, 1) if len(cents) > 10 else None,
        enNotas=round(quieto, 3),
    )


PERIODO_W = 48            # muestras por período en la onda «enderezada»
BLOQUE = 32               # períodos por bloque


def finura(x, q, a, b):
    """Qué tan finos son los parciales con la altura del cantor enderezada. Se remuestrea la onda siguiendo su propia
    altura (cuadro a cuadro, vibrato incluido), así cada período dura lo mismo, y se mira el espectro de bloques de 32
    períodos: una sola voz deja cada armónico en su lugar exacto (la energía en ±1 casillero de 32·h); varias voces a
    unos cents una de otra lo desparraman (±1,5 % en el armónico 8 son ±4 casilleros). Devuelve la mediana, en los
    bloques con voz entera, de la energía a ±1 casillero sobre la de ±6, en los armónicos entre 600 Hz y 4 kHz."""
    f0 = q["f0"][a:b].astype(np.float64)
    son = (q["ap"][a:b] < SONORO_AP) & (f0 > 75) & (f0 < 1000)
    vals = []
    i = 0
    n = len(f0)
    while i < n:
        if not son[i]:
            i += 1
            continue
        j = i
        while j < n and son[j]:
            j += 1
        if j - i >= 15:
            ff = f0[i:j].copy()
            # sin saltos sueltos: mediana de 3
            if len(ff) >= 3:
                ff[1:-1] = np.median(np.stack([ff[:-2], ff[1:-1], ff[2:]]), 0)
            s0 = (a + i) * HOP + W // 2
            s1 = (a + j - 1) * HOP + W // 2
            if s1 > len(x) - 1:
                s1 = len(x) - 1
            if s1 - s0 > 0:
                centros = (a + np.arange(i, j)) * HOP + W // 2
                m = np.arange(s0, s1)
                fm = np.exp(np.interp(m, centros, np.log(ff)))
                fase = np.concatenate([[0.0], np.cumsum(fm / SR)])[:-1]
                k = np.arange(int(fase[-1] * PERIODO_W)) / PERIODO_W
                tk = np.interp(k, fase, m)
                xw = np.interp(tk, np.arange(len(x)), x)
                L = BLOQUE * PERIODO_W
                ven = np.hanning(L)
                f0m = float(np.median(ff))
                hs = [h for h in range(2, PERIODO_W // 2 - 1) if 600 <= h * f0m <= 4000]
                for p in range(0, len(xw) - L + 1, L // 2):
                    S = np.abs(np.fft.rfft(xw[p : p + L] * ven)) ** 2
                    e1 = sum(S[BLOQUE * h - 1 : BLOQUE * h + 2].sum() for h in hs)
                    e6 = sum(S[BLOQUE * h - 6 : BLOQUE * h + 7].sum() for h in hs)
                    if e6 > 0 and hs:
                        vals.append(e1 / e6)
        i = j
    return (float(np.median(vals)), len(vals)) if vals else (None, 0)


def murga_de(nombre, an):
    if an and an.get("murga"):
        return an["murga"]
    partes = nombre.split("_")
    k = next(i for i, p in enumerate(partes) if p.isdigit())
    return " ".join(partes[:k]).title()


def analisis(nombre):
    f = ANALISIS / f"{nombre}.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else None


def golpes_a_varias(an):
    """Tiempos de los golpes que el transcriptor leyó con dos o más alturas distintas (no octavas): coro seguro."""
    if not an or "segs" not in an:
        return []
    out = []
    for (_, _, ps, *_), (t0, t1) in zip(an["golpes"], an["segs"]):
        clases = {p % 12 for p in ps}
        if len(clases) >= 2 and t1 - t0 > 0.12:
            out.append((t0, t1))
    return out


def golpes_de_una(an):
    if not an or "segs" not in an:
        return []
    return [(t0, t1) for (_, _, ps, *_), (t0, t1) in zip(an["golpes"], an["segs"]) if len({p % 12 for p in ps}) == 1 and t1 - t0 > 0.12]


# ── validación: coros artificiales ──
def coro_artificial(x, voces, cents, rng, retardo=0.03):
    """El mismo pasaje copiado `voces` veces: cada copia desafinada al azar (±cents, con una deriva lenta de ±cents/2)
    y corrida hasta `retardo` s. Es lo más parecido a un coro que se puede hacer con una sola voz."""
    n = len(x)
    t = np.arange(n) / SR
    y = x.copy()
    for _ in range(voces - 1):
        c = rng.uniform(-cents, cents)
        fase = rng.uniform(0, 6.28)
        dev = c + 0.5 * cents * np.sin(2 * np.pi * rng.uniform(0.2, 0.7) * t + fase)
        rate = 2 ** (dev / 1200)
        pos = np.cumsum(rate) - rate[0] - rng.uniform(0, retardo) * SR
        z = np.interp(pos, np.arange(n), x, left=0, right=0)
        y += z
    return y / voces


def validar(lista, umbral):
    """Toma los pasajes encontrados, arma coros artificiales con ellos y mide si el detector los rechaza."""
    rng = np.random.default_rng(7)
    filas = []
    for nombre, segs in lista:
        if not segs:
            continue
        y = leer(nombre).mean(1)
        for s in segs[:2]:
            a, b = int(s["desde"] * SR), int(min(s["hasta"], s["desde"] + 8) * SR)
            x = y[a:b].astype(np.float64)
            fila = {"tramo": nombre, "desde": s["desde"]}
            for clave, voces, cents in (("solo", 1, 0), ("dos_10c", 2, 10), ("tres_15c", 3, 15), ("seis_15c", 6, 15), ("doce_20c", 12, 20)):
                z = x if voces == 1 else coro_artificial(x, voces, cents, rng)
                q = medir_cuadros(z[:, None].astype(np.float32))
                cl, rm, sonoro, _ = clasificar(q, umbral)
                fila[clave] = round(float((cl == 1).sum() / max(1, sonoro.sum())), 3)
                fila[clave + "_rho3"] = round(float(np.nanmedian(np.where(sonoro, q["rho"][:, 2], np.nan))), 3)
                fi, _ = finura(z.astype(np.float32), q, 0, len(q["f0"]))
                fila[clave + "_finura"] = None if fi is None else round(fi, 3)
            filas.append(fila)
            print(f"  {nombre:44s} {s['desde']:7.1f}  solo {fila['solo']:.2f} ({fila['solo_rho3']:.2f})  "
                  f"2×10c {fila['dos_10c']:.2f} ({fila['dos_10c_rho3']:.2f})  3×15c {fila['tres_15c']:.2f} ({fila['tres_15c_rho3']:.2f})  "
                  f"6×15c {fila['seis_15c']:.2f} ({fila['seis_15c_rho3']:.2f})  12×20c {fila['doce_20c']:.2f} ({fila['doce_20c_rho3']:.2f})  "
                  f"finura {' '.join(str(fila[k + '_finura']) for k in ('solo', 'dos_10c', 'tres_15c', 'seis_15c', 'doce_20c'))}", flush=True)
    return filas


def escribir_clip(nombre, s, i):
    import wave
    (SALIDA / "clips").mkdir(parents=True, exist_ok=True)
    x, sr = sf.read(VOCES / f"{nombre}.flac", dtype="float32", always_2d=True, start=int(s["desde"] * 44100), stop=int(s["hasta"] * 44100))
    y = resample_poly(x.mean(1), 1, 2)
    y = y / (np.abs(y).max() + 1e-9) * 0.8
    with wave.open(str(SALIDA / "clips" / f"{nombre}_{i:02d}_{s['desde']:.0f}s.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050)
        w.writeframes((y * 32767).astype("<i2").tobytes())


def main():
    args = sys.argv[1:]
    umbral = float(args[args.index("--umbral") + 1]) if "--umbral" in args else UMBRAL
    finura_min = float(args[args.index("--finura") + 1]) if "--finura" in args else FINURA
    nombres = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or args[i - 1] not in ("--umbral", "--finura"))]
    if not nombres:
        nombres = sorted(f.stem for f in VOCES.glob("*.flac"))
    SALIDA.mkdir(parents=True, exist_ok=True)
    resultado, lista = [], []
    choque_tot = [0, 0]
    una_tot = [0, 0]
    for nombre in nombres:
        q = cargar_cuadros(nombre)
        segs, cl, rm = pasajes(q, umbral)
        an = analisis(nombre)
        desc = [describir(q, a, b, cl) for a, b in segs]
        varias = golpes_a_varias(an)
        mono = leer(nombre).mean(1) if any(dd["enNotas"] >= 0.45 for dd in desc) and "--sin-finura" not in args else None
        for (a_, b_), d in zip(segs, desc):
            fi, nb = finura(mono, q, a_, b_) if mono is not None and d["enNotas"] >= 0.45 else (None, 0)
            d["finura"] = None if fi is None else round(fi, 3)
            d["bloques"] = nb
        for d in desc:
            d["cantado"] = bool(d["enNotas"] >= 0.45)
            # qué parte del pasaje el transcriptor la leyó a varias voces (coro seguro, o un error del transcriptor)
            tapado = sum(max(0.0, min(t1, d["hasta"]) - max(t0, d["desde"])) for t0, t1 in varias)
            d["aVarias"] = round(tapado / d["largo"], 3)
            # los que se miden: claros, con poco coro alrededor y sin golpes a varias voces
            d["estricto"] = bool(d["cantado"] and d["rho3"] >= 0.75 and d["sonoro"] >= 0.75 and d["coro"] <= 0.05 and d["largo"] >= 3
                                 and d["aVarias"] <= 0.2 and d["finura"] is not None and d["finura"] >= finura_min and d["bloques"] >= 8)
        # contra el análisis: los golpes a varias voces (coro seguro) que caen adentro de un pasaje
        una = golpes_de_una(an)
        adentro = lambda t0, t1: any(d["desde"] <= (t0 + t1) / 2 <= d["hasta"] for d in desc)
        choque = sum(adentro(*g) for g in varias)
        en_una = sum(adentro(*g) for g in una)
        choque_tot[0] += choque; choque_tot[1] += len(varias)
        una_tot[0] += en_una; una_tot[1] += len(una)
        # cuánto del tramo tiene voz, y qué parte de eso es de solista
        sonoro = (cl > 0).sum()
        # el estéreo: cuánto se parecen los canales en los cuadros de solista (adentro de los pasajes) y en los de coro
        adentro_ = np.zeros(len(cl), bool)
        for a, b in segs:
            adentro_[a:b] = True
        lr = q["lr"]
        lrS = float(np.median(lr[(cl == 1) & adentro_])) if ((cl == 1) & adentro_).any() else None
        lrC = float(np.median(lr[cl == 2])) if (cl == 2).any() else None
        fila = dict(tramo=nombre, murga=murga_de(nombre, an), largo=round(len(cl) * HOP / SR, 1),
                    vozSolista=round(float((cl == 1).sum() / max(1, sonoro)), 3),
                    lrSolista=None if lrS is None else round(lrS, 3), lrCoro=None if lrC is None else round(lrC, 3),
                    golpesVarias=len(varias), golpesVariasAdentro=choque, golpesUna=len(una), golpesUnaAdentro=en_una,
                    pasajes=desc)
        resultado.append(fila)
        lista.append((nombre, desc))
        cant = sum(d["cantado"] for d in desc)
        print(f"{nombre:44s} {len(desc):3d} pasajes ({cant} cantados, {sum(d['largo'] for d in desc):6.1f} s)  "
              f"coro adentro {choque}/{len(varias)}  " + "  ".join(f"{d['desde']:.0f}-{d['hasta']:.0f}" for d in desc[:8]), flush=True)
    todos = [d for f in resultado for d in f["pasajes"]]
    resumen = dict(umbral=umbral, tramos=len(resultado), pasajes=len(todos), cantados=sum(d["cantado"] for d in todos),
                   estrictos=sum(d["estricto"] for d in todos), segundosEstrictos=round(sum(d["largo"] for d in todos if d["estricto"]), 1),
                   murgasEstrictos=len({f["murga"] for f in resultado if any(d["estricto"] for d in f["pasajes"])}),
                   segundos=round(sum(d["largo"] for d in todos), 1),
                   segundosCantados=round(sum(d["largo"] for d in todos if d["cantado"]), 1),
                   golpesVariasAdentro=f"{choque_tot[0]}/{choque_tot[1]}", golpesUnaAdentro=f"{una_tot[0]}/{una_tot[1]}")
    print(json.dumps(resumen, ensure_ascii=False))
    out = dict(resumen=resumen, tramos=resultado)
    if "--validar" in args:
        print("validación: coros artificiales (parte de los cuadros con voz que quedan como solista, y la rho3 mediana)")
        out["validacion"] = validar([(n, [d for d in desc if d["cantado"] and d["rho3"] >= 0.75 and d["largo"] >= 3]) for n, desc in lista], umbral)
    if "--clips" in args:
        for nombre, desc in lista:
            for i, d in enumerate(desc):
                escribir_clip(nombre, d, i)
    destino = SALIDA / ("segmentos.json" if len(nombres) > 3 else "segmentos_prueba.json")
    destino.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"→ {destino}")


if __name__ == "__main__":
    main()
