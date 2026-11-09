# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile"]
# ///
"""
curva_bancos.py — el color de cada voz de banco (bancos/plantel.json) contra el coro real: la curva que lleva el
espectro de sus vocales al del coro real, como CURVA_DIFONOS para MBROLA, pero medida directo contra las grabaciones.

Para cada voz de banco del plantel, el banco del coro (banco_sintetizar.mjs --motor banco --voz <voz>) canta los
fragmentos de ajuste con esa voz en todos los lugares, seco (sin sala, sin curva). La curva es el espectro promedio de
las vocales del coro real (banco_medir.ltas, en tercios de octava) menos el de esa voz, en los mismos fragmentos,
suavizada entre bandas vecinas y limitada a ±12 dB. Los fragmentos de control no se usan: sirven para ver después si
la curva sirve o sólo copia los de ajuste. Escribe motor/cantor/curvas_banco.js.

  D:\\uv\\murga\\Scripts\\python.exe herramientas/curva_bancos.py [--fragmentos 3] [--voces "MIKE,Sanfu"]
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
sys.path.insert(0, str(AQUI))
from banco_medir import CENTROS, leer, ltas  # noqa: E402

BANCO = RAIZ / "murga_trabajo" / "banco"
arg = lambda k, d=None: sys.argv[sys.argv.index("--" + k) + 1] if "--" + k in sys.argv else d
N_FR = int(arg("fragmentos", "3"))
PL = json.loads((RAIZ / "bancos" / "plantel.json").read_text(encoding="utf-8"))
voces = [v for v in PL["voces"] if v.get("banco")]
if arg("voces"):
    quiero = set(arg("voces").split(","))
    voces = [v for v in voces if v["nombre"] in quiero]
frs = json.loads((BANCO / "fragmentos.json").read_text(encoding="utf-8"))
ajuste = [f for f in frs if not f.get("control")][:N_FR]
ids = ",".join(f["id"] for f in ajuste)
real = np.mean([ltas(leer(BANCO / "real" / f"{f['id']}.wav")) for f in ajuste], axis=0)
print(f"fragmentos de ajuste: {ids}")

curvas = {}
anterior = RAIZ / "motor" / "cantor" / "curvas_banco.js"
for v in voces:
    clave = f"{v['banco']}|{v.get('capa', '')}"
    if clave in curvas:
        continue
    with tempfile.TemporaryDirectory(dir=os.environ.get("TEMP")) as sal:
        r = subprocess.run(["node", str(AQUI / "banco_sintetizar.mjs"), "--motor", "banco", "--voz", v["nombre"], "--ids", ids, "--sala", "0", "--opc", "colorReal=0", "--salida", sal],
                           capture_output=True, text=True, cwd=RAIZ)
        if r.returncode:
            print(f"{v['nombre']}: no cantó\n{r.stderr[-600:]}")
            continue
        voz = np.mean([ltas(leer(Path(sal) / f"{f['id']}.wav")) for f in ajuste], axis=0)
    d = real - voz
    d = np.convolve(np.pad(d, 1, mode="edge"), [.25, .5, .25], mode="valid")   # suavizada entre bandas vecinas
    d = np.clip(d, -12, 12)
    curvas[clave] = [[int(c), round(float(x), 1)] for c, x in zip(CENTROS, d)]
    print(f"{v['nombre']:22s} diferencia media antes {np.abs(real - voz).mean():.1f} dB  ·  " + " ".join(f"{int(c)}:{x:+.0f}" for c, x in zip(CENTROS[::3], d[::3])))

texto = ("// curvas_banco.js — el color de cada voz de banco contra el coro real (lo escribe herramientas/curva_bancos.py).\n"
         "// Clave: «archivo del banco|capa» («MIKE.zip|_dp»). Valor: [[Hz, dB], ...], como CURVA_DIFONOS en timbre.js.\n"
         f"// Fragmentos de ajuste del banco del coro: {ids}.\n"
         "export const CURVAS_BANCO = {\n" + "".join(f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(c)},\n" for k, c in curvas.items()) + "};\n")
anterior.write_text(texto, encoding="utf-8")
print(f"→ {anterior} ({len(curvas)} curvas)")
