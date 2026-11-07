# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["numpy", "soundfile", "scipy"]
# ///
"""
convertir_coro.py — pasa el coro sintético del Murga-o-matic por Seed-VC, para que cada voz suene a un murguista
de verdad, y lo vuelve a mezclar con la batería.

Seed-VC (https://github.com/Plachtaa/seed-vc) convierte voz cantada sin entrenar: le alcanza un pedazo de 1 a 25 s de
la voz que tiene que imitar. Respeta la altura y el ritmo de la entrada, así que la música y la letra no cambian:
cambia el timbre. Con un ajuste fino sobre las voces de una murga (unos minutos de GPU) se parece más.

Las referencias salen de tus voces separadas (murga_trabajo/voces/*.flac) y de los análisis del repositorio
(murga_trabajo/analisis/*.json). Se buscan pasajes cantados al unísono, fuertes, con poca batería y en el registro de
cada cuerda. Con --tipo solista (lo normal) se prefieren los pasajes de una sola voz: Seed-VC imita a una persona, y
el coro lo arma la mezcla. Con --tipo coro, los de todo el coro.

Pasos, desde la raíz del repositorio:
  1. node herramientas/exportar_voces.mjs --forma retirada --estilo trasnochada --semilla 47
  2. uv run transcripcion/convertir_coro.py instalar          (una vez: baja Seed-VC y le arma su Python)
  3. uv run transcripcion/convertir_coro.py referencias --murga "La Trasnochada"
  4. uv run transcripcion/convertir_coro.py entrenar --murga "La Trasnochada"      (opcional, con GPU)
  5. uv run transcripcion/convertir_coro.py convertir murga_trabajo/cantada/retirada_trasnochada_47

  convertir deja en la carpeta de la pieza: convertidas/ (cada voz), coro_convertido.wav, mezcla_convertida.wav y,
  para comparar, mezcla_sintetica.wav (las mismas voces sin convertir, mezcladas igual). Si se corta, al volver a
  correrlo sigue desde la voz que faltaba.

Opciones de convertir:
  --pasos 30          difusión: 10 es rápido, 50 es lo mejor
  --referencia a.wav  la misma voz para todos
  --sin-ajuste        no usar el modelo ajustado aunque exista
  --fp32              sin media precisión: si en una GTX 16xx sale ruido o silencio
  --sin-compuerta     no silenciar lo convertido donde la voz sintética calla
  --simular           no llama a Seed-VC; sirve para probar la mezcla

Los modelos de Seed-VC, Whisper, BigVGAN, RMVPE y CAMPPlus se bajan solos de Hugging Face la primera vez (son públicos,
unos 2 GB). Conviene una placa de video NVIDIA: sin ella anda, pero mucho más lento.
"""
import argparse
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import unicodedata
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.ndimage import maximum_filter1d, uniform_filter1d
from scipy.signal import lfilter, resample_poly

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
TRABAJO = Path(os.environ.get("MURGA_TRABAJO", RAIZ / "murga_trabajo")).resolve()
VOCES, ANALISIS = TRABAJO / "voces", TRABAJO / "analisis"
SEEDVC = TRABAJO / "seed-vc"
CANTADA = TRABAJO / "cantada"
REFS, DATASET = CANTADA / "referencias", CANTADA / "dataset"
CONFIG_SVC = "configs/presets/config_dit_mel_seed_uvit_whisper_base_f0_44k.yml"
SR = 44100
# las cuerdas, de la más grave a la más aguda: las referencias se reparten en ese orden según la altura del pasaje
CUERDAS = ["bajos", "segundos", "primos", "sobreprimos", "tercia"]
HAY_NVIDIA = shutil.which("nvidia-smi") is not None

sys.path.insert(0, str(AQUI))
from pureza import medir, unisono  # noqa: E402  (las mismas medidas del unísono que usa el análisis)


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def mostrar(p):
    try:
        return p.relative_to(RAIZ)
    except ValueError:
        return p


def python_seedvc():
    return SEEDVC / ".venv" / ("Scripts/python.exe" if platform.system() == "Windows" else "bin/python")


def correr(cmd, **kw):
    print("  $", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def leer(ruta, desde=0.0, largo=None):
    info = sf.info(ruta)
    x, sr = sf.read(ruta, start=int(desde * info.samplerate),
                    frames=-1 if largo is None else int(largo * info.samplerate), always_2d=True, dtype="float32")
    x = x.mean(1)
    return resample_poly(x, SR, sr).astype(np.float32) if sr != SR else x


# ───────────────────────── instalar ─────────────────────────
def instalar(a):
    if not (SEEDVC / "inference.py").exists():
        SEEDVC.parent.mkdir(parents=True, exist_ok=True)
        if shutil.which("git"):
            correr(["git", "clone", "--depth", "1", "https://github.com/Plachtaa/seed-vc", SEEDVC])
        else:
            print("Bajando Seed-VC (zip)…")
            z = TRABAJO / "seed-vc.zip"
            urllib.request.urlretrieve("https://codeload.github.com/Plachtaa/seed-vc/zip/refs/heads/main", z)
            with zipfile.ZipFile(z) as zf:
                zf.extractall(TRABAJO)
            (TRABAJO / "seed-vc-main").rename(SEEDVC)
            z.unlink()
    uv = shutil.which("uv")
    if not uv:
        sys.exit("Hace falta uv: https://docs.astral.sh/uv/")
    if not python_seedvc().exists():
        correr([uv, "venv", SEEDVC / ".venv", "--python", "3.10"])
    # torch 2.4 con CUDA si hay placa NVIDIA; en una Mac la versión común usa la GPU de Apple
    torch_cmd = [uv, "pip", "install", "--python", python_seedvc(), "torch==2.4.0", "torchvision==0.19.0", "torchaudio==2.4.0"]
    if HAY_NVIDIA:
        torch_cmd += ["--index-url", "https://download.pytorch.org/whl/cu121"]
    correr(torch_cmd)
    # el resto de las dependencias, sin las líneas de torch nocturno del requirements original ni lo que sólo usan
    # las ventanas y la evaluación de Seed-VC (resemblyzer, además, pide compilador en Windows)
    sobran = ("gradio", "freesimplegui", "sounddevice", "resemblyzer", "jiwer")
    req = (SEEDVC / "requirements.txt").read_text(encoding="utf-8").splitlines()
    req = [l for l in req if l.strip() and not l.strip().startswith(("torch", "--", "#")) and "nightly" not in l
           and not l.strip().lower().startswith(sobran)]
    filtrado = SEEDVC / "requirements_murga.txt"
    filtrado.write_text("\n".join(req) + "\n", encoding="utf-8")
    correr([uv, "pip", "install", "--python", python_seedvc(), "-r", filtrado])
    print(f"\nSeed-VC listo en {mostrar(SEEDVC)}. " + ("Usa la placa NVIDIA." if HAY_NVIDIA else "Sin placa NVIDIA: anda, pero lento."))


# ───────────────────────── referencias ─────────────────────────
def tramos_de(murga):
    res = []
    for j in sorted(ANALISIS.glob("*.json")):
        an = json.loads(j.read_text(encoding="utf-8"))
        if "segs" not in an or (murga and slug(an.get("murga", "")) != slug(murga)):
            continue
        flac = VOCES / f"{an['nombre']}.flac"
        if flac.exists():
            res.append((an, flac))
    return res


def solo_por_golpe(an, x):
    """Para cada golpe al unísono: qué parte de su energía está pegada a los parciales (cerca de 1: una persona)."""
    out = {}
    for i, ((q, d, ps, _), (t0, t1)) in enumerate(zip(an["golpes"], an["segs"])):
        if len(ps) != 1 or t1 - t0 < 0.15:
            continue
        s = x[int((t0 + 0.04) * SR): int((t1 - 0.02) * SR)]
        if len(s) < 4000:
            continue
        de, _, cum, tot = medir(s, ps)
        out[i] = unisono(cum, tot, ps[0], de)[1]
    return out


def ventanas(an, largo, paso, solo=None):
    """Los pasajes del tramo, con lo que hace falta para elegir: unísono, densidad, registro, una voz o muchas,
    y cuánto suena la batería al lado de la voz."""
    t_g = np.array([s[0] for s in an["segs"]])
    voz = np.array(an["energia"]["vocals"])
    resto = sum(np.array(an["energia"][k]) for k in ("drums", "other", "bass"))
    out, t = [], 0.0
    fin = min(an["largo_s"], sf.info(VOCES / f"{an['nombre']}.flac").duration)
    while t + largo <= fin:
        idx = np.where((t_g >= t) & (t_g < t + largo))[0]
        if len(idx) >= 10:
            ps = [an["golpes"][i][2] for i in idx]
            a, b = int(t * 2), int((t + largo) * 2)
            v, r = float(voz[a:b].mean()), float(resto[a:b].mean())
            sol = [solo[i] for i in idx if solo and i in solo]
            out.append({"t": round(t, 2), "dens": len(idx) / largo, "unisono": sum(len(p) == 1 for p in ps) / len(ps),
                        "altura": float(np.median([n for p in ps for n in p])), "voz": v, "limpio": v / (v + r + 1e-6),
                        "solo": float(np.mean(sol)) if len(sol) >= 4 else 0.0})
        t += paso
    return out


def cortar(flac, t, largo, destino):
    """Corta un pasaje con fundidos cortos. Devuelve False si el audio no llega (la voz separada es más corta)."""
    x = leer(flac, t, largo)
    if len(x) < largo * SR * .8:
        return False
    f = int(.05 * SR)
    x[:f] *= np.linspace(0, 1, f)
    x[-f:] *= np.linspace(1, 0, f)
    x = x / (np.abs(x).max() + 1e-9) * .7
    destino.parent.mkdir(parents=True, exist_ok=True)
    sf.write(destino, x, SR, subtype="PCM_16")
    return True


def referencias(a):
    tramos = tramos_de(a.murga)
    if not tramos:
        sys.exit(f"No encontré voces separadas de {a.murga or 'ninguna murga'} en {mostrar(VOCES)} con su análisis en {mostrar(ANALISIS)}.")
    todas = []
    for an, flac in tramos:
        solo = solo_por_golpe(an, leer(flac)) if a.tipo == "solista" else None
        todas += [(an, flac, w) for w in ventanas(an, a.largo, 2.0, solo)]
        print(f"  {an['nombre']}: {len(todas)} pasajes", flush=True)
    vmax = max(w["voz"] for *_, w in todas) or 1
    m = slug(a.murga or "todas")
    for viejo in REFS.glob(f"{m}_*.wav"):
        viejo.unlink()
    def calidad(w):
        p = 2.0 * w["unisono"] + 1.5 * w["limpio"] + .8 * w["voz"] / vmax + .15 * min(w["dens"], 4)
        return p + (3.0 * w["solo"] if a.tipo == "solista" else 0)
    # los mejores pasajes, sin pisarse, y mejor de tramos distintos
    cuantos = len(CUERDAS) * a.por_cuerda
    elegidos, libres = [], list(todas)
    while libres and len(elegidos) < cuantos:
        usados = [an["nombre"] for an, _, _ in elegidos]
        x = max(libres, key=lambda x: calidad(x[2]) - .4 * usados.count(x[0]["nombre"]))
        elegidos.append(x)
        libres = [y for y in libres if not (y[0]["nombre"] == x[0]["nombre"] and abs(y[2]["t"] - x[2]["t"]) < a.largo)]
    # los más graves para los bajos y los más agudos para la tercia
    elegidos.sort(key=lambda x: x[2]["altura"])
    indice = {"murga": a.murga, "tipo": a.tipo, "largo": a.largo, "cuerdas": {}}
    for j, cuerda in enumerate(CUERDAS):
        grupo = elegidos[j * len(elegidos) // len(CUERDAS): (j + 1) * len(elegidos) // len(CUERDAS)] or elegidos[-1:]
        indice["cuerdas"][cuerda] = []
        for k, (an, flac, w) in enumerate(grupo):
            destino = REFS / f"{m}_{cuerda}_{k + 1}.wav"
            cortar(flac, w["t"], a.largo, destino)
            indice["cuerdas"][cuerda].append({"archivo": destino.name, "tramo": an["nombre"], "desde": w["t"],
                                              **{c: round(w[c], 3) for c in ("unisono", "solo", "altura", "limpio")}})
            print(f"  {cuerda:<12}{k + 1}  {an['nombre']} {w['t']:.0f}-{w['t'] + a.largo:.0f} s · unísono {w['unisono']:.0%}"
                  + (f" · una voz {w['solo']:.2f}" if a.tipo == "solista" else "")
                  + f" · altura {w['altura']:.1f} · voz limpia {w['limpio']:.0%}")
    (REFS / f"{m}.json").write_text(json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nReferencias en {mostrar(REFS)}. Escuchalas: si alguna tiene mucha batería o es hablada, borrala del índice {m}.json.")


# ───────────────────────── entrenar ─────────────────────────
def entrenar(a):
    if not python_seedvc().exists():
        sys.exit("Primero: uv run transcripcion/convertir_coro.py instalar")
    tramos = tramos_de(a.murga)
    if not tramos:
        sys.exit(f"No encontré voces separadas de {a.murga}.")
    carpeta = DATASET / slug(a.murga or "todas")
    if carpeta.exists():
        shutil.rmtree(carpeta)
    # sólo pasajes cantados (no hablados ni vacíos) y con poca batería; los más limpios de todos los tramos
    pasajes = [(an, flac, w) for an, flac in tramos for w in ventanas(an, 12.0, 12.0) if w["dens"] >= 1.5 and w["limpio"] >= .45]
    pasajes.sort(key=lambda x: -x[2]["limpio"])
    pasajes = pasajes[: int(a.minutos * 60 / 12)]
    pasajes = [(an, flac, w) for an, flac, w in pasajes
               if cortar(flac, w["t"], 12.0, carpeta / f"{an['nombre']}_{int(w['t']):04d}.wav")]
    print(f"Datos: {len(pasajes) * 12 / 60:.1f} min de {len({an['nombre'] for an, _, _ in pasajes})} tramos en {mostrar(carpeta)}")
    if not pasajes:
        sys.exit("No hay pasajes cantados con poca batería para entrenar.")
    nombre = f"murga_{slug(a.murga or 'todas')}"
    correr([python_seedvc(), "train.py", "--config", CONFIG_SVC, "--dataset-dir", carpeta, "--run-name", nombre,
            "--batch-size", a.lote, "--max-steps", a.pasos, "--max-epochs", 1000, "--save-every", 500, "--num-workers", 0], cwd=SEEDVC)
    print(f"Modelo ajustado: {mostrar(SEEDVC / 'runs' / nombre / 'ft_model.pth')}")


# ───────────────────────── después de convertir ─────────────────────────
def envolvente(x, paso):
    n = len(x) // paso
    return np.sqrt((x[: n * paso].reshape(n, paso) ** 2).mean(1) + 1e-12)


def alinear(x, y, max_s=0.15):
    """Seed-VC puede correr la voz unos milisegundos. Se vuelve a poner en su lugar con las envolventes."""
    paso = int(.005 * SR)
    def env(s):   # en dB, con piso a -40 dB: así el ruido de fondo de los silencios no cuenta
        e = envolvente(s, paso)
        return np.log(np.maximum(e, e.max() * .01))
    ex, ey = env(x), env(y)
    ex, ey = ex - ex.mean(), ey - ey.mean()
    k = int(max_s * SR / paso)
    c = [np.dot(ex[max(0, -d): len(ex) - max(0, d)], ey[max(0, d): len(ey) - max(0, -d)]) for d in range(-k, k + 1)]
    d = (int(np.argmax(c)) - k) * paso
    if d > 0:
        y = np.concatenate([y[d:], np.zeros(d, y.dtype)])
    elif d < 0:
        y = np.concatenate([np.zeros(-d, y.dtype), y[:d]])
    return y, d / SR


def compuerta(x, y, umbral_db=-45):
    """Donde la voz sintética calla, la convertida también: Seed-VC a veces inventa ruido en los silencios."""
    paso = int(.01 * SR)
    e = envolvente(x, paso)
    abierto = (e > e.max() * 10 ** (umbral_db / 20)).astype(float)
    abierto = maximum_filter1d(abierto, 9)           # 40 ms de margen antes y después
    abierto = uniform_filter1d(abierto, 4)           # sin clics
    g = np.repeat(abierto, paso)
    g = np.concatenate([g, np.full(len(y) - len(g), g[-1] if len(g) else 1.0)])[: len(y)]
    return y * g


# ───────────────────────── mezcla ─────────────────────────
def sala(L, R, mezcla=.24, largo=1.7):
    """La misma sala de motor/cantor/mezcla.js (Schroeder: seis peines con pasabajos y tres pasatodos),
    escrita como filtros para que numpy la haga rápido."""
    g = 10 ** (-3 * (1100 / SR) / largo)
    out = []
    for x, desfase in ((L, 0), (R, 23)):
        v = x * .15
        acc = np.zeros_like(x)
        for n in (1557, 1617, 1491, 1422, 1277, 1356):
            N = n + desfase
            b = np.zeros(N + 2)
            b[N], b[N + 1] = 1, -.3
            a = np.zeros(N + 1)
            a[0], a[1] = 1, -.3
            a[N] -= .7 * g
            acc += lfilter(b, a, v)
        y = acc
        for n in (225, 556, 441):
            N = n + desfase
            b = np.zeros(N + 1)
            b[0], b[N] = -.5, 1
            a = np.zeros(N + 1)
            a[0], a[N] = 1, -.5
            y = lfilter(b, a, y)
        out.append(x * (1 - mezcla) + y * mezcla * 2)
    return out


def corrido(x, rng):
    """Otro cantor que canta lo mismo: entra unos milisegundos después y se mueve un poco de afinación
    (un retardo que oscila despacio, así no se va corriendo con el tiempo)."""
    n = np.arange(len(x))
    base = rng.uniform(.010, .028) * SR
    amp, f, fase = rng.uniform(.0015, .0035) * SR, rng.uniform(.15, .45), rng.uniform(0, 2 * np.pi)
    pos = n - (base + amp * np.sin(2 * np.pi * f * n / SR + fase))
    return np.interp(pos, n, x, left=0, right=0).astype(np.float32)


def mezclar(man, voces, bat, n):
    """voces: lista de (señal, cantor del manifiesto). Devuelve el coro y la mezcla, en estéreo."""
    L, R = np.zeros(n), np.zeros(n)
    rng = np.random.default_rng(7)
    for x, c in voces:
        copias = c.get("copias") or [{"pan": c["pan"], "ganancia": 1.0}]
        for j, cp in enumerate(copias):
            y = corrido(x, rng) if j else x
            g = c["ganancia"] * (cp["ganancia"] / copias[0]["ganancia"] if c.get("copias") else 1)
            m = min(n, len(y))
            L[:m] += y[:m] * g * np.cos((cp["pan"] + 1) * np.pi / 4)
            R[:m] += y[:m] * g * np.sin((cp["pan"] + 1) * np.pi / 4)
    L, R = sala(L, R, man["sala"]["mezcla"], man["sala"]["largo"])
    coro = np.stack([L, R], 1)
    pc = np.abs(L).max() + 1e-9                      # como la página: la batería se mide contra el canal izquierdo
    b = bat[:n] / (np.abs(bat).max() + 1e-9) * man["bateria"]["relacion"] * pc
    mezcla = coro.copy()
    mezcla[: len(b)] += b[:, None]

    def norm(s):
        return np.tanh(s * 1.15 / (np.abs(s).max() + 1e-9)) / np.tanh(1.15) * .89
    return norm(coro), norm(mezcla)


# ───────────────────────── convertir ─────────────────────────
def referencias_de(murga, unica):
    """Para cada cuerda, la lista de referencias; los cantores de una cuerda se las reparten."""
    if unica:
        return lambda cuerda, k: Path(unica)
    indice = REFS / f"{murga}.json"
    if not indice.exists():
        return None
    cuerdas = json.loads(indice.read_text(encoding="utf-8"))["cuerdas"]

    def elegir(cuerda, k):
        lista = cuerdas.get(cuerda) or next(v for v in cuerdas.values() if v)
        return REFS / lista[k % len(lista)]["archivo"]
    return elegir


def convertir(a):
    pieza = Path(a.pieza).resolve()
    man = json.loads((pieza / "manifiesto.json").read_text(encoding="utf-8"))
    n = int(man["largo"] * SR)
    salida = pieza / "convertidas"
    salida.mkdir(exist_ok=True)
    murga = slug(a.murga or "todas")
    modelo = SEEDVC / "runs" / f"murga_{murga}" / "ft_model.pth"
    usar_modelo = modelo.exists() and not a.sin_ajuste
    ref_de = referencias_de(murga, a.referencia)
    if not a.simular:
        if not python_seedvc().exists():
            sys.exit("Primero: uv run transcripcion/convertir_coro.py instalar")
        if ref_de is None:
            sys.exit(f"Faltan las referencias. Corré: uv run transcripcion/convertir_coro.py referencias --murga \"{a.murga}\"")
    vistos = {}
    voces_conv, voces_sint, informe = [], [], []
    for i, c in enumerate(man["cantores"]):
        k = vistos.get(c["cuerda"], 0)
        vistos[c["cuerda"]] = k + 1
        fuente = pieza / c["archivo"]
        destino = salida / Path(c["archivo"]).name
        ref = ref_de(c["cuerda"], k) if ref_de else None
        if not destino.exists():
            print(f"[{i + 1}/{len(man['cantores'])}] {c['archivo']} ← {ref.name if ref else '(simulado)'}"
                  + (" con el modelo ajustado" if usar_modelo else ""), flush=True)
            if a.simular:
                shutil.copy(fuente, destino)
            else:
                if not ref.exists():
                    sys.exit(f"Falta {ref}")
                tmp = salida / "_tmp"
                shutil.rmtree(tmp, ignore_errors=True)
                cmd = [python_seedvc(), "inference.py", "--source", fuente, "--target", ref, "--output", tmp,
                       "--diffusion-steps", a.pasos, "--length-adjust", "1.0", "--inference-cfg-rate", "0.7",
                       "--f0-condition", "True", "--auto-f0-adjust", "False", "--semi-tone-shift", "0",
                       "--fp16", "True" if HAY_NVIDIA and not a.fp32 else "False"]
                if usar_modelo:
                    cmd += ["--checkpoint", modelo, "--config", SEEDVC / CONFIG_SVC]
                correr(cmd, cwd=SEEDVC)
                shutil.move(str(next(tmp.glob("*.wav"))), destino)
                shutil.rmtree(tmp)
        x, y = leer(fuente), leer(destino)
        y = np.concatenate([y, np.zeros(max(0, len(x) - len(y)), np.float32)])[: len(x)]
        y, corrimiento = alinear(x, y)
        if not a.sin_compuerta:
            y = compuerta(x, y)
        # mismo nivel que la voz sintética, así se mantiene el balance entre cuerdas
        y = y * (np.sqrt((x ** 2).mean()) / (np.sqrt((y ** 2).mean()) + 1e-9))
        voces_sint.append((x, c))
        voces_conv.append((y, c))
        informe.append({"archivo": c["archivo"], "referencia": ref.name if ref else None, "corrimiento_ms": round(corrimiento * 1000, 1)})
    bat = leer(pieza / man["bateria"]["archivo"])
    coro, mezcla = mezclar(man, voces_conv, bat, n)
    sf.write(pieza / "coro_convertido.wav", coro, SR, subtype="PCM_16")
    sf.write(pieza / "mezcla_convertida.wav", mezcla, SR, subtype="PCM_16")
    _, sint = mezclar(man, voces_sint, bat, n)
    sf.write(pieza / "mezcla_sintetica.wav", sint, SR, subtype="PCM_16")
    (pieza / "conversion.json").write_text(json.dumps({"murga": a.murga, "modelo_ajustado": usar_modelo, "pasos": a.pasos,
                                                       "simulado": a.simular, "voces": informe}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nListo: {mostrar(pieza / 'mezcla_convertida.wav')}\nPara comparar: {mostrar(pieza / 'mezcla_sintetica.wav')}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="paso", required=True)
    sub.add_parser("instalar", help="baja Seed-VC y le arma su entorno de Python")
    r = sub.add_parser("referencias", help="elige pedazos de voz real para cada cuerda")
    r.add_argument("--murga", default="La Trasnochada")
    r.add_argument("--tipo", choices=["solista", "coro"], default="solista")
    r.add_argument("--largo", type=float, default=20.0, help="segundos por referencia (Seed-VC usa hasta 25)")
    r.add_argument("--por-cuerda", type=int, default=3, help="referencias distintas por cuerda")
    e = sub.add_parser("entrenar", help="ajuste fino de Seed-VC con las voces de la murga (GPU)")
    e.add_argument("--murga", default="La Trasnochada")
    e.add_argument("--pasos", type=int, default=1000)
    e.add_argument("--lote", type=int, default=2)
    e.add_argument("--minutos", type=float, default=40, help="cuánta voz usar como máximo")
    c = sub.add_parser("convertir", help="convierte cada voz de una pieza exportada y la vuelve a mezclar")
    c.add_argument("pieza", help="carpeta que dejó herramientas/exportar_voces.mjs")
    c.add_argument("--murga", default="La Trasnochada")
    c.add_argument("--pasos", type=int, default=30)
    c.add_argument("--referencia", default=None)
    c.add_argument("--sin-ajuste", action="store_true")
    c.add_argument("--sin-compuerta", action="store_true")
    c.add_argument("--fp32", action="store_true")
    c.add_argument("--simular", action="store_true")
    a = ap.parse_args()
    {"instalar": instalar, "referencias": referencias, "entrenar": entrenar, "convertir": convertir}[a.paso](a)


if __name__ == "__main__":
    main()
