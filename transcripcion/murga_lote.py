# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = [
#   "yt-dlp>=2025.1.1",
#   "imageio-ffmpeg>=0.5",
#   "muscriptor>=0.4",
# ]
# ///
"""
murga_lote.py — busca en YouTube las presentaciones, canciones finales y retiradas
de La Trasnochada y Agarrate Catalina (2020 → 2026), corta esos tramos, los
transcribe a MIDI con MuScriptor (voces + batería) y arma un zip para Claude.

Uso (una sola vez, antes):
  1. Instalar uv:  https://docs.astral.sh/uv/getting-started/installation/
  2. Entrar a https://huggingface.co/MuScriptor/muscriptor-medium y aceptar la licencia
  3. uvx hf auth login        (pegar un token de huggingface.co/settings/tokens)

Después:
  uv run murga_lote.py                     # busca, baja, corta, transcribe, zipea
  uv run murga_lote.py --solo-buscar       # sólo arma plan.csv para revisarlo
  uv run murga_lote.py --modelo small      # más rápido en compus sin GPU
  uv run murga_lote.py --cookies chrome    # si YouTube pide "confirmá que no sos un bot"

plan.csv queda al lado del script: si un video está mal elegido, corregí la url
o los tiempos (desde/hasta en segundos o mm:ss) y volvé a correr; no re-busca ni
re-baja lo que ya está.
"""
import argparse
import csv
import json
import re
import subprocess
import sys
import time
import unicodedata
import zipfile
from pathlib import Path

import imageio_ffmpeg
import yt_dlp

AQUI = Path(__file__).resolve().parent
TRABAJO = AQUI / "murga_trabajo"
AUDIO = TRABAJO / "audio"
CLIPS = TRABAJO / "clips"
SALIDA = TRABAJO / "salida"
PLAN = AQUI / "plan.csv"
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# Espectáculos 2020–2026 (2021 no hubo concurso). El nombre ayuda a la búsqueda.
CATALOGO = [
    ("La Trasnochada", 2020, "El puerto de la memoria"),
    ("La Trasnochada", 2022, "Popular"),
    ("La Trasnochada", 2023, "La historia del Mago Flores"),
    ("La Trasnochada", 2024, "La misma luna"),
    ("La Trasnochada", 2025, "Belleza"),
    ("La Trasnochada", 2026, "Los falsificadores de siempre"),
    ("Agarrate Catalina", 2020, ""),
    ("Agarrate Catalina", 2022, ""),
]
# Videos que ya ubicó Claude (se prueban primero)
CONOCIDOS = {
    ("La Trasnochada", 2022, "retirada"): "https://www.youtube.com/watch?v=bUn5AMKr_3g",
    ("La Trasnochada", 2023, "retirada"): "https://www.youtube.com/watch?v=Il308Wm6J70",
    ("La Trasnochada", 2024, "completo"): "https://www.youtube.com/watch?v=09YKNu-pb0w",
}
PARTES = {
    "presentacion": ["presentacion", "saludo"],
    "cancion_final": ["cancion final", "final"],
    "retirada": ["retirada", "despedida"],
}
MALAS = ["reaccion", "react", "entrevista", "cuple", "cuplé", "tablado ", "karaoke", "cover", "letra", "acordes", "tutorial"]
VENTANA_INICIO = 14 * 60  # de un show completo: primeros 14 min (clarinada + presentación)
VENTANA_FINAL = 20 * 60   # y últimos 20 min (canción final + retirada)


def norm(s):
    s = unicodedata.normalize("NFD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s.lower())


def clave_murga(m):
    return "trasnochada" if "trasnochada" in norm(m) else "catalina"


def segundos(x):
    x = str(x).strip()
    if not x:
        return None
    if ":" in x:
        p = [float(v) for v in x.split(":")]
        return p[-1] + 60 * p[-2] + (3600 * p[-3] if len(p) > 2 else 0)
    return float(x)


def ydl(extra=None, cookies=None):
    o = {"quiet": True, "no_warnings": True, "ffmpeg_location": FFMPEG}
    if cookies:
        o["cookiesfrombrowser"] = (cookies,)
    o.update(extra or {})
    return yt_dlp.YoutubeDL(o)


def buscar(q, cookies, n=12):
    with ydl({"extract_flat": True}, cookies) as y:
        try:
            r = y.extract_info(f"ytsearch{n}:{q}", download=False)
        except Exception as e:
            print(f"   (falló la búsqueda «{q}»: {e})")
            return []
    return [e for e in (r.get("entries") or []) if e and e.get("id")]


def info(url, cookies):
    with ydl({}, cookies) as y:
        return y.extract_info(url, download=False)


def puntaje(e, murga, anio, show, parte):
    t = norm(e.get("title"))
    d = e.get("duration") or 0
    if clave_murga(murga) not in t:
        return -99
    otras = ["falta y resto", "curtidores", "cayo la cabra", "metele que son pasteles", "momolandia", "araca la cana"]
    if any(o in t for o in otras):
        return -99
    s = 0
    if str(anio) in t:
        s += 4
    elif show and norm(show) in t:
        s += 3
    elif re.search(r"20[12]\d", t):
        return -99  # otro año
    else:
        s -= 2
    if any(norm(m) in t for m in MALAS):
        return -99
    if parte == "completo":
        if not (25 * 60 <= d <= 80 * 60):
            return -99
        s += 2 if "liguilla" in t else (1 if "segunda rueda" in t else 0)
        s += 1 if ("teatro de verano" in t or "completo" in t) else 0
        if any(k in t for ks in PARTES.values() for k in ks if k not in ("final",)):
            s -= 1
    else:
        if not (90 <= d <= 25 * 60):
            return -99
        if any(k in t for k in PARTES[parte]):
            s += 5
        else:
            return -99
        if parte == "cancion_final" and "retirada" in t:
            s += 1  # "canción final y retirada" en un solo video
    return s


def armar_plan(cookies):
    filas = []
    for murga, anio, show in CATALOGO:
        print(f"\n== {murga} {anio} {('«' + show + '»') if show else ''}")
        elegidos = {}
        for parte in list(PARTES) + ["completo"]:
            url = CONOCIDOS.get((murga, anio, parte))
            if url:
                elegidos[parte] = {"url": url, "titulo": "(ubicado por Claude)", "dur": None}
                continue
            q = f"{murga} {anio} " + ({"presentacion": "presentación", "cancion_final": "canción final", "retirada": "retirada", "completo": show or "carnaval completo"}[parte])
            cands = []
            for e in buscar(q, cookies):
                p = puntaje(e, murga, anio, show, parte)
                if p > 0:
                    cands.append((p, e))
            cands.sort(key=lambda x: -x[0])
            if cands:
                e = cands[0][1]
                elegidos[parte] = {"url": f"https://www.youtube.com/watch?v={e['id']}", "titulo": e.get("title"), "dur": e.get("duration")}
            time.sleep(1)
        # Si "canción final" y "retirada" cayeron en el mismo video, queda uno solo
        if "cancion_final" in elegidos and "retirada" in elegidos and elegidos["cancion_final"]["url"] == elegidos["retirada"]["url"]:
            del elegidos["cancion_final"]
        for parte in PARTES:
            if parte in elegidos:
                v = elegidos[parte]
                filas.append(dict(murga=murga, anio=anio, parte=parte, url=v["url"], titulo=v["titulo"], desde="", hasta=""))
            elif "completo" in elegidos:
                v = elegidos["completo"]
                if parte == "presentacion":
                    filas.append(dict(murga=murga, anio=anio, parte="presentacion", url=v["url"], titulo=v["titulo"], desde="0", hasta=str(VENTANA_INICIO)))
                elif not any(f["murga"] == murga and f["anio"] == anio and f["parte"] in ("cancion_final", "retirada", "final_show") for f in filas):
                    filas.append(dict(murga=murga, anio=anio, parte="final_show", url=v["url"], titulo=v["titulo"], desde=f"-{VENTANA_FINAL}", hasta=""))
            else:
                filas.append(dict(murga=murga, anio=anio, parte=parte, url="", titulo="NO ENCONTRADO", desde="", hasta=""))
        for f in filas:
            if f["murga"] == murga and f["anio"] == anio:
                print(f"   {f['parte']:<14} {f['titulo'][:70] if f['titulo'] else ''}  {f['url']}")
    with PLAN.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["murga", "anio", "parte", "url", "titulo", "desde", "hasta"])
        w.writeheader()
        w.writerows(filas)
    print(f"\nPlan guardado en {PLAN}")


def bajar(url, cookies):
    vid = re.search(r"(?:v=|youtu\.be/)([\w-]{11})", url).group(1)
    ya = list(AUDIO.glob(f"{vid}.*"))
    if ya:
        return ya[0], vid
    print(f"   bajando {url}")
    with ydl({"format": "bestaudio/best", "outtmpl": str(AUDIO / f"{vid}.%(ext)s")}, cookies) as y:
        y.download([url])
    return next(AUDIO.glob(f"{vid}.*")), vid


def duracion(path):
    r = subprocess.run([FFMPEG, "-i", str(path)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", r.stderr)
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])


def cortar(src, dst, desde, hasta, fmt):
    a = [FFMPEG, "-y", "-loglevel", "error"]
    if desde:
        a += ["-ss", str(desde)]
    if hasta:
        a += ["-to", str(hasta)]
    a += ["-i", str(src)]
    a += ["-ac", "2", "-ar", "44100", str(dst)] if fmt == "wav" else ["-ac", "1", "-ar", "22050", "-b:a", "48k", str(dst)]
    subprocess.run(a, check=True)


def chequear_hf():
    try:
        from huggingface_hub import whoami
        print(f"Hugging Face: sesión de {whoami()['name']}")
    except Exception:
        print("\nFalta iniciar sesión en Hugging Face (lo pide la licencia de los pesos de MuScriptor):\n"
              "  1. https://huggingface.co/MuScriptor/muscriptor-medium → «Agree and access»\n"
              "  2. uvx hf auth login   (o export HF_TOKEN=hf_...)\n")
        sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solo-buscar", action="store_true")
    ap.add_argument("--rebuscar", action="store_true", help="ignora plan.csv y vuelve a buscar")
    ap.add_argument("--modelo", default="medium", help="small | medium | large")
    ap.add_argument("--device", default="auto", help="auto | cpu | cuda | mps")
    ap.add_argument("--cookies", default=None, help="chrome | firefox | safari | edge …")
    ap.add_argument("--sin-audio", action="store_true", help="no incluir los mp3 de los tramos en el zip")
    a = ap.parse_args()

    for d in (AUDIO, CLIPS, SALIDA):
        d.mkdir(parents=True, exist_ok=True)
    sin_urls = PLAN.exists() and not any(f["url"] for f in csv.DictReader(PLAN.open(encoding="utf-8")))
    if a.rebuscar or not PLAN.exists() or sin_urls:
        armar_plan(a.cookies)
    if a.solo_buscar:
        return
    chequear_hf()

    filas = list(csv.DictReader(PLAN.open(encoding="utf-8")))
    log = []
    for f in filas:
        if not f["url"]:
            continue
        nombre = f"{clave_murga(f['murga'])}_{f['anio']}_{f['parte']}"
        mid = SALIDA / f"{nombre}.mid"
        print(f"\n▶ {nombre}")
        try:
            src, vid = bajar(f["url"], a.cookies)
            dur = duracion(src)
            desde, hasta = segundos(f["desde"]), segundos(f["hasta"])
            if desde is not None and desde < 0:
                desde = max(0, dur + desde)
            wav = CLIPS / f"{nombre}.wav"
            cortar(src, wav, desde, hasta, "wav")
            if not a.sin_audio:
                cortar(src, SALIDA / f"{nombre}.mp3", desde, hasta, "mp3")
            if not mid.exists():
                t0 = time.time()
                cmd = [sys.executable, "-m", "muscriptor", "transcribe", str(wav), "-o", str(mid),
                       "--instruments", "voice,drums", "--model", a.modelo, "--device", a.device]
                subprocess.run(cmd, check=True)
                print(f"   transcripto en {time.time() - t0:.0f} s")
            log.append({**f, "archivo": mid.name, "inicio_s": desde or 0, "duracion_video_s": round(dur, 1)})
        except Exception as e:
            print(f"   ✗ {e}")
            log.append({**f, "error": str(e)})

    (SALIDA / "indice.json").write_text(json.dumps(log, ensure_ascii=False, indent=1), encoding="utf-8")
    z = AQUI / "murgas_para_claude.zip"
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(SALIDA.iterdir()):
            zf.write(p, p.name)
        zf.write(PLAN, PLAN.name)
    print(f"\nListo → {z}  ({z.stat().st_size / 1e6:.1f} MB). Subilo al chat.")


if __name__ == "__main__":
    main()
