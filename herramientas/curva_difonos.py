# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile"]
# ///
"""
curva_difonos.py — la curva de ecualización del coro de difonos, medida contra el coro real.

La curva del coro de formantes (CURVA, en motor/cantor/timbre.js) salió de comparar ese coro con la entrada a capela
de La Trasnochada 2020: el coro de formantes con su curva tiene el timbre del coro real. Acá se cantan las mismas notas
con el coro de formantes (con su curva) y con el de difonos (crudo, sin curva ni emisión), y la diferencia de sus
espectros promedio de vocales (banco_medir.ltas) es la curva de los difonos. No hace falta el audio real: el puente es
la curva de formantes. Escribe CURVA_DIFONOS en motor/cantor/timbre.js.

  uv run herramientas/curva_difonos.py [--voz es2|es1]
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
import banco_medir as BM  # noqa: E402

TRAMO, T0, T1 = "la_trasnochada_2020_presentacion", 0.5, 20.5   # el primer fragmento del banco (a capela)


VOZ = sys.argv[sys.argv.index("--voz") + 1] if "--voz" in sys.argv else "es2"
NOMBRE = "CURVA_DIFONOS" + ("" if VOZ == "es2" else "_" + VOZ.upper())


def cantar(trabajo, motor, extra):
    sal = Path(trabajo) / f"canto_{motor}"
    env = {**os.environ, "MURGA_TRABAJO": str(trabajo)}
    subprocess.run(["node", str(AQUI / "banco_sintetizar.mjs"), "--motor", motor, "--voz", VOZ, "--salida", str(sal), "--sala", "0", *extra], check=True, env=env, capture_output=True)
    return BM.ltas(BM.leer(sal / "intro.wav"))


def main():
    with tempfile.TemporaryDirectory() as t:
        (Path(t) / "banco").mkdir()
        os.symlink(RAIZ / "murga_trabajo" / "analisis", Path(t) / "analisis")
        (Path(t) / "banco" / "fragmentos.json").write_text(json.dumps([{"id": "intro", "tramo": TRAMO, "murga": "La Trasnochada", "t0": T0, "t1": T1, "capela": True}]))
        objetivo = cantar(t, "formantes", [])
        # la curva entera y sin el color de cada cantor (en la página va al 60 %, brillo de cantorDifonos)
        MIDE = ["--opc", "brillo=1,color=0"]
        crudo = cantar(t, "difonos", ["--curva", "no", *MIDE])
        ref = [i for i, c in enumerate(BM.CENTROS) if 300 <= c <= 1000]
        suavizar = lambda v, k: np.convolve(np.pad(v, 1, mode="edge"), k, mode="valid")
        def escribir(curva):
            texto = (RAIZ / "motor" / "cantor" / "timbre.js").read_text(encoding="utf-8")
            marca = f"\n// Curva del coro de difonos, voz {VOZ}"
            antes, _, despues = texto.partition(marca)
            despues = despues.split("\n// Curva del coro de difonos", 1)
            resto = ("\n// Curva del coro de difonos" + despues[1]) if len(despues) > 1 else ""
            texto = (antes.rstrip("\n") + "\n" + marca + ": herramientas/curva_difonos.py --voz " + VOZ + ", las mismas notas que CURVA cantadas\n"
                     "// por el coro de formantes (con su curva, que tiene el timbre del coro real) y por el de difonos.\n"
                     f"export const {NOMBRE} = " + json.dumps([[round(c), round(float(v), 1)] for c, v in zip(BM.CENTROS, curva)]) + ";\n" + resto)
            (RAIZ / "motor" / "cantor" / "timbre.js").write_text(texto, encoding="utf-8")
        # primero, la diferencia suavizada (de a tres tercios de octava); después, dos vueltas corrigiendo lo que falta.
        # Sin pasarse de ±24 dB.
        graves = np.array([c < 140 for c in BM.CENTROS])     # abajo de 140 Hz, como mucho +12 dB: si no, retumba
        tope = lambda v: np.clip(np.where(graves, np.minimum(v, 12), v), -24, 24)
        curva = tope(suavizar(objetivo - crudo, [.25, .5, .25]))
        curva -= curva[ref].mean()
        for vuelta in range(3):
            escribir(curva)
            con = cantar(t, "difonos", MIDE)
            print(f"vuelta {vuelta + 1}: error medio {np.abs(objetivo - con).mean():.1f} dB", flush=True)
            if vuelta < 2:
                curva = tope(curva + suavizar(objetivo - con, [.15, .7, .15]))
                curva -= curva[ref].mean()
        print("frecuencia  objetivo  crudo  con curva")
        for c, a, b, d in zip(BM.CENTROS, objetivo, crudo, con):
            print(f"{c:8.0f}  {a:7.1f}  {b:6.1f}  {d:6.1f}")
        print(f"error medio: crudo {np.abs(objetivo - crudo).mean():.1f} dB, con la curva {np.abs(objetivo - con).mean():.1f} dB")


if __name__ == "__main__":
    main()
