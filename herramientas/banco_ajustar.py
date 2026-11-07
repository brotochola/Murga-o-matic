# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile", "scipy"]
# ///
"""
banco_ajustar.py — busca cuánto tienen que diferenciarse los cantores sintéticos para sonar como el coro real.

Prueba combinaciones de desafinación, retraso, desfase por nota, vibrato, largo de garganta, vocales propias y
cantor que lleva la cuerda (motor/cantor/variacion.js). Cada combinación se canta en los fragmentos de ajuste del
banco (banco_sintetizar.mjs) y se mide contra el coro real (banco_medir.py). Se queda con la de menor distancia.
Es una búsqueda evolutiva simple: varias pruebas a la vez alrededor de la mejor, con pasos que se achican cuando no
mejora. Guarda el estado: si se corta, vuelve a correrlo y sigue.

Al final reescribe motor/cantor/variacion.js con la mejor (mirá el cambio con git diff antes de subirlo) y deja
murga_trabajo/banco/ajuste.json con la historia y la distancia en los fragmentos de control.

  uv run herramientas/banco_ajustar.py [--horas 2] [--paralelo N] [--de-nuevo] [--sin-escribir]
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
sys.path.insert(0, str(AQUI))
import banco_medir as BM  # noqa: E402

BANCO = BM.BANCO
ESTADO, PRUEBAS = BANCO / "ajuste_estado.json", BANCO / "pruebas"
# lo que se busca, con sus límites
LIMITES = {
    "desafinacion": (0.02, 0.30), "desafinaNota": (0.0, 0.12), "retraso": (0.0, 0.06), "desfase": (0.0, 0.035),
    "vibratoLo": (0.0, 0.25), "vibratoHi": (0.02, 0.45), "garganta": (0.0, 0.06),
    "vocales": (0.0, 0.10), "liderDb": (0.0, 4.0), "liderAdelanto": (0.0, 0.025),
}


def leer_actual():
    """Los valores de motor/cantor/variacion.js, para empezar desde ahí."""
    texto = (RAIZ / "motor" / "cantor" / "variacion.js").read_text(encoding="utf-8")
    cuerpo = texto[texto.index("{"): texto.rindex("}") + 1]
    lineas = [l.split("//")[0] for l in cuerpo.splitlines()]
    js = "\n".join(lineas)
    import re
    js = re.sub(r"(\w+)\s*:", r'"\1":', js)
    js = re.sub(r",\s*}", "}", js)
    return json.loads(js)


def a_vector(v):
    return {"desafinacion": v["desafinacion"], "desafinaNota": v.get("desafinaNota", 0), "retraso": v["retraso"], "desfase": v["desfase"], "vibratoLo": v["vibrato"][0], "vibratoHi": v["vibrato"][1],
            "garganta": v["garganta"], "vocales": v["vocales"], "liderDb": v["liderDb"], "liderAdelanto": v["liderAdelanto"]}


def a_variacion(x, base):
    v = dict(base)
    v.update({k: round(float(x[k]), 4) for k in ("desafinacion", "desafinaNota", "retraso", "desfase", "garganta", "vocales", "liderDb", "liderAdelanto")})
    lo, hi = sorted([x["vibratoLo"], x["vibratoHi"]])
    v["vibrato"] = [round(float(lo), 4), round(float(max(hi, lo + .01)), 4)]
    return v


def evaluar(x, base, ids, nombre):
    carpeta = PRUEBAS / nombre
    shutil.rmtree(carpeta, ignore_errors=True)
    carpeta.mkdir(parents=True)
    (carpeta / "variacion.json").write_text(json.dumps(a_variacion(x, base)), encoding="utf-8")
    subprocess.run(["node", str(AQUI / "banco_sintetizar.mjs"), "--variacion", str(carpeta / "variacion.json"), "--salida", str(carpeta), "--ids", ",".join(ids)],
                   check=True, capture_output=True, env=os.environ)
    return carpeta


def puntaje(carpeta, frs):
    R = BM.medir_carpeta(carpeta, frs)
    return R["todos"].get("total", 1e9), R


def escribir_variacion(v, nota):
    comentarios = {
        "desafinacion": "semitonos: cada cantor canta toda la pieza hasta este tanto alto o bajo",
        "retraso": "segundos: cada cantor entra siempre entre 0 y este tanto tarde",
        "desfase": "segundos: y en cada nota se corre hasta este tanto, para un lado o el otro",
        "vibrato": "semitonos de profundidad, entre estos dos", "vibratoVel": "Hz",
        "garganta": "largo del tracto, más o menos este tanto sobre el de su tipo de voz", "pulso": "forma del pulso de la glotis",
        "aire": "cuánto aire, multiplicando el de su tipo", "vocales": "cada vocal de cada cantor, F1 y F2 corridos hasta este tanto",
        "liderDb": "el primer cantor de cada cuerda, tantos dB más fuerte", "liderAdelanto": "y tantos segundos adelantado",
        "desafinaNota": "y además cada nota hasta este tanto alta o baja", "diccion": "cuánto más largas o más cortas hace las consonantes",
        "vibratoEntra": "segundos: cuándo le entra el vibrato en una nota larga", "pique": "cuánto más o menos pica desde abajo al entrar",
        "volumen": "dB: cada cantor un poco más fuerte o más suave",
    }
    lineas = ["// variacion.js — cuánto se diferencian los cantores sintéticos entre sí. Lo usan cantor.js y coro.js.",
              f"// Ajustado por herramientas/banco_ajustar.py: {nota}", "export const VARIACION = {"]
    for k, val in v.items():
        lineas.append(f"  {k}: {json.dumps(val)},".ljust(32) + f"// {comentarios.get(k, '')}")
    lineas.append("};")
    (RAIZ / "motor" / "cantor" / "variacion.js").write_text("\n".join(lineas) + "\n", encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--horas", type=float, default=2.0)
    ap.add_argument("--paralelo", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    ap.add_argument("--de-nuevo", action="store_true")
    ap.add_argument("--sin-escribir", action="store_true")
    a = ap.parse_args()
    frs = BM.fragmentos()
    ajuste = [f for f in frs if not f.get("control")] or frs
    control = [f for f in frs if f.get("control")]
    ids = [f["id"] for f in ajuste]
    base = leer_actual()
    rng = np.random.default_rng(int(time.time()))
    if ESTADO.exists() and not a.de_nuevo:
        E = json.loads(ESTADO.read_text(encoding="utf-8"))
        print(f"Sigo desde la ronda {E['ronda']} (mejor distancia {E['mejor']:.3f})", flush=True)
    else:
        x0 = a_vector(base)
        c = evaluar(x0, base, ids, "inicio")
        p0, _ = puntaje(c, ajuste)
        E = {"ronda": 0, "mejor": p0, "x": x0, "inicial": p0, "sigma": .15, "sin_mejora": 0, "historia": [[0, p0]]}
        print(f"Distancia con los valores de ahora: {p0:.3f}", flush=True)
    fin = time.time() + a.horas * 3600
    while time.time() < fin and E["sigma"] >= .02:
        E["ronda"] += 1
        # varias pruebas alrededor de la mejor
        cands = []
        for j in range(a.paralelo):
            x = {}
            for k, (lo, hi) in LIMITES.items():
                x[k] = float(np.clip(E["x"][k] + rng.normal(0, E["sigma"]) * (hi - lo), lo, hi))
            cands.append(x)
        with ThreadPoolExecutor(a.paralelo) as ex:
            carpetas = list(ex.map(lambda jx: evaluar(jx[1], base, ids, f"r{E['ronda']}_{jx[0]}"), enumerate(cands)))
        puntos = [puntaje(c, ajuste)[0] for c in carpetas]
        j = int(np.argmin(puntos))
        if puntos[j] < E["mejor"] - 1e-4:
            E.update(mejor=puntos[j], x=cands[j], sin_mejora=0)
            print(f"  ronda {E['ronda']}: mejor {puntos[j]:.3f}  {json.dumps({k: round(v, 3) for k, v in cands[j].items()})}", flush=True)
        else:
            E["sin_mejora"] += 1
            if E["sin_mejora"] >= 6:
                E["sigma"] *= .7; E["sin_mejora"] = 0
                print(f"  ronda {E['ronda']}: sin mejora, paso más chico ({E['sigma']:.3f})", flush=True)
        E["historia"].append([E["ronda"], E["mejor"]])
        ESTADO.write_text(json.dumps(E), encoding="utf-8")
        for c in carpetas:
            shutil.rmtree(c, ignore_errors=True)
    # la mejor, en todos los fragmentos (también los de control)
    mejor = a_variacion(E["x"], base)
    c = evaluar(E["x"], base, [f["id"] for f in frs], "mejor")
    _, R = puntaje(c, frs)
    c0 = evaluar(a_vector(base), base, [f["id"] for f in frs], "antes")
    _, R0 = puntaje(c0, frs)
    res = {"antes": {"ajuste": R0["ajuste"], "control": R0["control"]}, "despues": {"ajuste": R["ajuste"], "control": R["control"]},
           "base": base, "variacion": mejor, "rondas": E["ronda"], "historia": E["historia"]}
    (BANCO / "ajuste.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    print(f"\nDistancia en los fragmentos de ajuste: {R0['ajuste'].get('total', 0):.3f} → {R['ajuste'].get('total', 0):.3f}")
    if control:
        print(f"En los de control (no se usaron para ajustar): {R0['control'].get('total', 0):.3f} → {R['control'].get('total', 0):.3f}")
    mejora_control = not control or R["control"].get("total", 1e9) < R0["control"].get("total", 1e9)
    if a.sin_escribir:
        print("No escribo motor/cantor/variacion.js (--sin-escribir).")
    elif not mejora_control:
        print("En los fragmentos de control no mejora: no toco motor/cantor/variacion.js.")
    else:
        escribir_variacion(mejor, f"distancia {R0['todos'].get('total', 0):.2f} → {R['todos'].get('total', 0):.2f} en {len(frs)} fragmentos, {time.strftime('%Y-%m-%d')}")
        print("Escrito motor/cantor/variacion.js: mirá el cambio con git diff.")
    # para escuchar: la versión ajustada queda en banco/sintetico_ajustado
    destino = BANCO / "sintetico_ajustado"
    shutil.rmtree(destino, ignore_errors=True)
    shutil.copytree(c, destino)
    shutil.rmtree(c0, ignore_errors=True)


if __name__ == "__main__":
    main()
