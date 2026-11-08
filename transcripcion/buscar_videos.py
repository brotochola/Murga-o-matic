"""
buscar_videos.py — busca en YouTube candidatos para cada parte de cada espectáculo y los lista para elegir a mano.

  python buscar_videos.py consultas.txt > candidatos.tsv

consultas.txt: una consulta por línea ("Doña Bastarda 2025 retirada"). Las líneas con # se saltean.
Sale una fila por video: consulta, id, duración en segundos, canal y título. No baja nada.
"""
import shutil
import sys
import time

import yt_dlp


def main():
    consultas = [l.strip() for l in open(sys.argv[1], encoding="utf-8") if l.strip() and not l.startswith("#")]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 12
    o = {"quiet": True, "no_warnings": True, "extract_flat": True}
    node = shutil.which("node")
    if node:
        o["js_runtimes"] = {"node": {"path": node}}
    vistos = set()
    with yt_dlp.YoutubeDL(o) as y:
        for q in consultas:
            try:
                r = y.extract_info(f"ytsearch{n}:{q}", download=False)
            except Exception as e:
                print(f"{q}\tERROR\t\t\t{e}", flush=True)
                continue
            for e in r.get("entries") or []:
                if not e or not e.get("id"):
                    continue
                marca = "" if e["id"] not in vistos else "(repetido)"
                vistos.add(e["id"])
                print(f"{q}\t{e['id']}\t{e.get('duration') or ''}\t{e.get('channel') or ''}\t{e.get('title') or ''}\t{marca}", flush=True)
            time.sleep(0.5)


if __name__ == "__main__":
    main()
