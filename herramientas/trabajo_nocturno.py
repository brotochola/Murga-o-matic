# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile", "scipy"]
# ///
"""
trabajo_nocturno.py — deja la compu trabajando sola en el plan de las voces (docs/plan_compu.md).

  1. Elige fragmentos de coro real de tus voces separadas y los vuelve a cantar con el coro sintético.
  2. Mide los dos con la misma vara (timbre, unísono, ataques, huecos). Lo mismo con el coro de difonos.
  3. Busca cuánto tienen que diferenciarse los cantores para parecerse más al real (las horas que le des).
  4. Con placa NVIDIA: instala Seed-VC, elige referencias y convierte los fragmentos y las cuatro demos. También
     mide lo convertido con la misma vara y prueba con Whisper si se entiende la letra.
  5. Escribe murga_trabajo/plan/informe.md con todo.

No deja que la compu se duerma mientras trabaja (Windows, Mac y Linux). Guarda lo hecho: si se corta o lo cortás
con Ctrl+C, al volver a correrlo sigue desde el paso que faltaba. Si un paso falla, lo reintenta una vez y sigue con
los que no dependen de él. Todo lo que pasa queda en murga_trabajo/plan/registro.txt.

Desde la raíz del repositorio:
  uv run herramientas/trabajo_nocturno.py                 todo (3 horas de ajuste)
  uv run herramientas/trabajo_nocturno.py --horas 6       más horas de ajuste
  uv run herramientas/trabajo_nocturno.py --entrenar      además, el ajuste fino de Seed-VC (horas de placa)
  uv run herramientas/trabajo_nocturno.py --sin-seedvc    sólo el banco y el ajuste (no hace falta placa)
  uv run herramientas/trabajo_nocturno.py --lista         qué pasos hay y cuáles ya están
  uv run herramientas/trabajo_nocturno.py --rehacer ajustar,informe
"""
import argparse
import ctypes
import json
import os
import platform
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

import numpy as np
import soundfile as sf

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
TRABAJO = Path(os.environ.get("MURGA_TRABAJO", RAIZ / "murga_trabajo")).resolve()
PLAN, BANCO = TRABAJO / "plan", TRABAJO / "banco"
ESTADO, REGISTRO = PLAN / "estado.json", PLAN / "registro.txt"
UV = shutil.which("uv") or "uv"
HAY_NVIDIA = shutil.which("nvidia-smi") is not None
MURGA_DE = {"trasnochada": "La Trasnochada", "catalina": "Agarrate Catalina", "muneca": "La Gran Muñeca", "pasteles": "Metele que son Pasteles"}


# ───────────────────────── que la compu no se duerma ─────────────────────────
class Despierta:
    def __enter__(self):
        self.p = None
        s = platform.system()
        try:
            if s == "Windows":
                ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001)   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
            elif s == "Darwin":
                self.p = subprocess.Popen(["caffeinate", "-i", "-w", str(os.getpid())])
            elif shutil.which("systemd-inhibit"):
                self.p = subprocess.Popen(["systemd-inhibit", "--what=sleep:idle", "--who=Murga-o-matic", "--why=trabajo nocturno", "--mode=block", "sleep", "infinity"])
            anotar(f"La compu no se va a dormir mientras trabaja ({s}).")
        except Exception as e:  # noqa: BLE001
            anotar(f"No pude evitar que la compu se duerma ({e}): revisá la configuración de energía.")
        return self

    def __exit__(self, *a):
        if platform.system() == "Windows":
            try:
                ctypes.windll.kernel32.SetThreadExecutionState(0x80000000)
            except Exception:  # noqa: BLE001
                pass
        if self.p:
            self.p.terminate()


# ───────────────────────── registro y estado ─────────────────────────
def anotar(t):
    linea = f"[{datetime.now():%H:%M:%S}] {t}"
    print(linea, flush=True)
    with open(REGISTRO, "a", encoding="utf-8") as f:
        f.write(linea + "\n")


def correr(cmd, timeout=None, env=None):
    """Corre un comando mostrando y guardando lo que dice."""
    anotar("$ " + " ".join(str(c) for c in cmd))
    with open(REGISTRO, "a", encoding="utf-8") as reg:
        p = subprocess.Popen([str(c) for c in cmd], cwd=RAIZ, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                             encoding="utf-8", errors="replace", env={**os.environ, "PYTHONIOENCODING": "utf-8", **(env or {})})
        vencido = threading.Event()
        reloj = threading.Timer(timeout, lambda: (vencido.set(), p.kill())) if timeout else None
        if reloj:
            reloj.daemon = True
            reloj.start()
        for linea in p.stdout:
            print("    " + linea, end="", flush=True)
            reg.write("    " + linea)
        codigo = p.wait()
        if reloj:
            reloj.cancel()
        if vencido.is_set():
            raise TimeoutError(f"pasó el tiempo máximo ({timeout / 3600:.1f} h)")
        if codigo:
            raise RuntimeError(f"salió con código {codigo}")


def leer_estado():
    return json.loads(ESTADO.read_text(encoding="utf-8")) if ESTADO.exists() else {}


def guardar_estado(E):
    ESTADO.write_text(json.dumps(E, indent=1, ensure_ascii=False), encoding="utf-8")


# ───────────────────────── los pasos ─────────────────────────
def frs():
    return json.loads((BANCO / "fragmentos.json").read_text(encoding="utf-8"))


def py_seedvc():
    return TRABAJO / "seed-vc" / ".venv" / ("Scripts/python.exe" if platform.system() == "Windows" else "bin/python")


def paso_referencias(a):
    for m in sorted({f["murga"] for f in frs()} | {"La Trasnochada"}):
        try:
            correr([UV, "run", "-q", "transcripcion/convertir_coro.py", "referencias", "--murga", m])
        except RuntimeError as e:
            anotar(f"  sin referencias de {m}: {e}")
    if not list((TRABAJO / "cantada" / "referencias").glob("*.json")):
        raise RuntimeError("no se pudo elegir ninguna referencia")


def murga_con_referencias(m):
    from re import sub
    import unicodedata
    s = sub(r"[^a-z0-9]+", "_", unicodedata.normalize("NFD", m).encode("ascii", "ignore").decode().lower()).strip("_")
    return m if (TRABAJO / "cantada" / "referencias" / f"{s}.json").exists() else "La Trasnochada"


def a_mono(origen, destino):
    x, sr = sf.read(origen, always_2d=True, dtype="float32")
    destino.parent.mkdir(parents=True, exist_ok=True)
    x = x.mean(1)
    sf.write(destino, x / (np.abs(x).max() + 1e-9) * .7, sr, subtype="PCM_16")


def paso_seedvc_banco(a):
    correr(["node", "herramientas/banco_sintetizar.mjs", "--exportar", "--salida", BANCO / "para_seedvc"])
    for f in frs():
        d = BANCO / "para_seedvc" / f["id"]
        correr([UV, "run", "-q", "transcripcion/convertir_coro.py", "convertir", d, "--murga", murga_con_referencias(f["murga"])])
        a_mono(d / "coro_convertido.wav", BANCO / "seedvc" / f"{f['id']}.wav")
        a_mono(d / "coro_sintetico.wav", BANCO / "seedvc_sint" / f"{f['id']}.wav")
    correr([UV, "run", "-q", "herramientas/banco_medir.py", "--sintetico", BANCO / "seedvc", "--salida", BANCO / "medidas_seedvc.json"])
    correr([UV, "run", "-q", "herramientas/banco_medir.py", "--sintetico", BANCO / "seedvc_sint", "--salida", BANCO / "medidas_seedvc_sint.json"])


def demos():
    r = subprocess.run(["node", "-e", "import('./motor/demos.js').then(m=>console.log(JSON.stringify(m.DEMOS)))"], cwd=RAIZ, capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def paso_seedvc_demos(a):
    for d in demos():
        nombre = f"{d['forma']}_{d['estilo']}_{d['semilla']}"
        correr(["node", "herramientas/exportar_voces.mjs", "--forma", d["forma"], "--estilo", d["estilo"], "--semilla", d["semilla"],
                "--tonica", d["tonica"], "--modo", d["modo"], "--largo", "normal", "--por-cuerda"])
        correr([UV, "run", "-q", "transcripcion/convertir_coro.py", "convertir", TRABAJO / "cantada" / nombre, "--murga", murga_con_referencias(MURGA_DE.get(d["estilo"], "La Trasnochada"))])


def paso_inteligibilidad(a):
    if not py_seedvc().exists():
        raise RuntimeError("hace falta el Python de Seed-VC (paso seedvc_instalar)")
    correr([py_seedvc(), "herramientas/banco_inteligibilidad.py"])


def paso_medir_despues(a):
    correr(["node", "herramientas/banco_sintetizar.mjs", "--salida", BANCO / "sintetico_despues"])
    correr([UV, "run", "-q", "herramientas/banco_medir.py", "--sintetico", BANCO / "sintetico_despues", "--salida", BANCO / "medidas_despues.json"])


def paso_difonos(a):
    # el coro de difonos de la página (es2 y es1, con su curva y sus acentos), con la misma vara que el de formantes
    correr(["node", "herramientas/banco_sintetizar.mjs", "--motor", "difonos", "--salida", BANCO / "sintetico_difonos"])
    correr([UV, "run", "-q", "herramientas/banco_medir.py", "--sintetico", BANCO / "sintetico_difonos", "--salida", BANCO / "medidas_difonos.json"])


def pasos(a):
    con_placa = not a.sin_seedvc and (HAY_NVIDIA or a.seedvc_sin_placa)
    P = [
        ("fragmentos", "Elegir fragmentos de coro real", [], lambda: correr([UV, "run", "-q", "herramientas/banco_fragmentos.py", "--maximo", a.fragmentos]), .05, True),
        ("sintetizar", "Volver a cantarlos con el coro sintético de ahora", ["fragmentos"], lambda: correr(["node", "herramientas/banco_sintetizar.mjs"]), .05, True),
        ("medir_antes", "Medir real contra sintético", ["sintetizar"], lambda: correr([UV, "run", "-q", "herramientas/banco_medir.py", "--salida", BANCO / "medidas_antes.json"]), .05, True),
        ("difonos", "Cantarlos con el coro de difonos y medirlo", ["fragmentos"], lambda: paso_difonos(a), .1, True),
        ("ajustar", f"Buscar la mejor variación entre cantores ({a.horas:g} h)", ["fragmentos"], lambda: correr([UV, "run", "-q", "herramientas/banco_ajustar.py", "--horas", a.horas] + (["--paralelo", os.environ["MURGA_PARALELO"]] if os.environ.get("MURGA_PARALELO") else []), timeout=(a.horas + 1) * 3600), a.horas + .2, True),
        ("medir_despues", "Medir con la variación ajustada", ["ajustar"], lambda: paso_medir_despues(a), .1, True),
        ("seedvc_instalar", "Instalar Seed-VC", [], lambda: correr([UV, "run", "-q", "transcripcion/convertir_coro.py", "instalar"], timeout=3 * 3600), .5, con_placa),
        ("seedvc_referencias", "Elegir voces de referencia", ["seedvc_instalar", "fragmentos"], lambda: paso_referencias(a), .1, con_placa),
        ("seedvc_entrenar", "Ajuste fino de Seed-VC con La Trasnochada", ["seedvc_referencias"], lambda: correr([UV, "run", "-q", "transcripcion/convertir_coro.py", "entrenar", "--murga", "La Trasnochada"], timeout=10 * 3600), 2, con_placa and a.entrenar),
        ("seedvc_banco", "Convertir los fragmentos y medirlos", ["seedvc_referencias", "medir_despues"], lambda: paso_seedvc_banco(a), 1, con_placa),
        ("seedvc_demos", "Convertir las cuatro demos", ["seedvc_referencias", "medir_despues"], lambda: paso_seedvc_demos(a), 2, con_placa),
        ("inteligibilidad", "¿Se entiende la letra? (Whisper)", ["seedvc_banco"], lambda: paso_inteligibilidad(a), .3, con_placa),
        ("informe", "Escribir el informe", [], lambda: escribir_informe(a), 0, True),
    ]
    return [dict(id=i, nombre=n, depende=d, hacer=f, horas=h, activo=act) for i, n, d, f, h, act in P]


# ───────────────────────── el informe ─────────────────────────
def json_o_nada(ruta):
    try:
        return json.loads(Path(ruta).read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return None


def escribir_informe(a):
    E = leer_estado()
    L = ["# Informe del trabajo nocturno", "", f"{datetime.now():%Y-%m-%d %H:%M} · {platform.system()} · {'placa NVIDIA' if HAY_NVIDIA else 'sin placa NVIDIA'}", "",
         "| Paso | Estado | Duración |", "|---|---|---|"]
    for p in pasos(a):
        if p["id"] == "informe":
            continue
        e = E.get(p["id"], {})
        dur = f"{(e['fin'] - e['inicio']) / 60:.0f} min" if e.get("fin") and e.get("inicio") else ""
        L.append(f"| {p['nombre']} | {e.get('estado', 'no corrió' if p['activo'] else 'salteado')}{(' — ' + e['error']) if e.get('error') else ''} | {dur} |")
    sys.path.insert(0, str(AQUI))
    try:
        import banco_medir as BM
    except Exception:  # noqa: BLE001
        BM = None
    antes, despues, aj = json_o_nada(BANCO / "medidas_antes.json"), json_o_nada(BANCO / "medidas_despues.json"), json_o_nada(BANCO / "ajuste.json")
    if antes and BM:
        L += ["", "## El coro sintético contra el real", "", "Antes del ajuste:", "", BM.tabla(antes)]
    if despues and BM:
        L += ["", "Después del ajuste:", "", BM.tabla(despues)]
    dif = json_o_nada(BANCO / "medidas_difonos.json")
    if dif and BM:
        L += ["", "## El coro de difonos contra el real", "", "El de la página: voces es2 y es1 de MBROLA, con su curva de timbre, sus acentos y el acento rioplatense.", "", BM.tabla(dif)]
        if antes:
            L += ["", f"Distancia media, formantes contra difonos: ajuste {antes['ajuste'].get('total', 0):.2f} → {dif['ajuste'].get('total', 0):.2f}; "
                  f"control {antes['control'].get('total', 0):.2f} → {dif['control'].get('total', 0):.2f}."]
    if aj:
        L += ["", "### La variación entre cantores", "", "| Qué | Antes | Ajustada |", "|---|---|---|"]
        base = aj.get("base", {})
        for k, v in aj["variacion"].items():
            L.append(f"| {k} | {json.dumps(base.get(k, '—'))} | {json.dumps(v)} |")
        L += ["", f"Distancia en los fragmentos de ajuste: {aj['antes']['ajuste'].get('total', 0):.2f} → {aj['despues']['ajuste'].get('total', 0):.2f}; "
              f"en los de control: {aj['antes']['control'].get('total', 0):.2f} → {aj['despues']['control'].get('total', 0):.2f}. "
              "Si en los de control no mejora, `motor/cantor/variacion.js` queda como estaba."]
    sv, ss = json_o_nada(BANCO / "medidas_seedvc.json"), json_o_nada(BANCO / "medidas_seedvc_sint.json")
    if sv and ss and BM:
        L += ["", "## Seed-VC", "", "Las mismas voces, sin convertir y convertidas, mezcladas igual:", "", "Sin convertir:", "", BM.tabla(ss), "", "Convertidas:", "", BM.tabla(sv)]
    it = json_o_nada(BANCO / "inteligibilidad.json")
    if it:
        L += ["", "## ¿Se entiende la letra?", "", "| Fragmento | Real | Sintético | Convertido |", "|---|---|---|---|"]
        for fid, r in it.items():
            celda = lambda k: (f"{r[k]['wer']:.0%} perdido · " if r.get(k, {}).get("wer") is not None else "") + (r.get(k, {}).get("texto", "—")[:60].replace("|", "/"))
            L.append(f"| {fid} | {celda('real')} | {celda('sintetico')} | {celda('convertido')} |")
    L += ["", "## Para escuchar", "",
          f"Todo en `{TRABAJO}`:", "",
          "- Coro real: `banco/real/`",
          "- Sintético antes y después del ajuste: `banco/sintetico/` y `banco/sintetico_despues/`",
          "- El coro de difonos: `banco/sintetico_difonos/`",
          "- Convertido con Seed-VC: `banco/para_seedvc/<fragmento>/coro_convertido.wav` (y `coro_sintetico.wav` para comparar)",
          "- Demos: `cantada/<demo>/mezcla_convertida.wav` contra `mezcla_sintetica.wav`", "",
          "Si `motor/cantor/variacion.js` cambió, mirá el cambio con `git diff`. Este informe se puede subir al repositorio: no tiene audio."]
    (PLAN / "informe.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    anotar(f"Informe: {PLAN / 'informe.md'}")


# ───────────────────────── correr el plan ─────────────────────────
def main():
    try:
        sys.stdout.reconfigure(errors="replace")   # consolas de Windows que no tienen ✓
    except Exception:  # noqa: BLE001
        pass
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--horas", type=float, default=3.0, help="horas para buscar la variación entre cantores")
    ap.add_argument("--fragmentos", type=int, default=12)
    ap.add_argument("--entrenar", action="store_true", help="hacer también el ajuste fino de Seed-VC")
    ap.add_argument("--sin-seedvc", action="store_true")
    ap.add_argument("--seedvc-sin-placa", action="store_true", help="intentar Seed-VC sin placa NVIDIA (Mac o CPU: muy lento)")
    ap.add_argument("--lista", action="store_true")
    ap.add_argument("--rehacer", default="", help="pasos a hacer de nuevo, separados por coma")
    ap.add_argument("--de-nuevo", action="store_true", help="olvidar todo lo hecho")
    a = ap.parse_args()
    PLAN.mkdir(parents=True, exist_ok=True)
    E = {} if a.de_nuevo else leer_estado()
    for p in a.rehacer.split(","):
        E.pop(p.strip(), None)
    P = pasos(a)
    total = sum(p["horas"] for p in P if p["activo"] and E.get(p["id"], {}).get("estado") != "hecho")
    print(f"\nPlan ({'con' if HAY_NVIDIA else 'sin'} placa NVIDIA), unas {total:.1f} horas si todo anda:")
    for p in P:
        print(f"  {'✓' if E.get(p['id'], {}).get('estado') == 'hecho' else '·' if p['activo'] else '–'} {p['id']:<20} {p['nombre']}")
    if a.lista:
        return
    if not shutil.which("node"):
        sys.exit("Hace falta Node.js (https://nodejs.org).")
    anotar("Empieza el trabajo nocturno")
    with Despierta():
        try:
            for p in P:
                if not p["activo"] or E.get(p["id"], {}).get("estado") == "hecho":
                    continue
                falta = [d for d in p["depende"] if E.get(d, {}).get("estado") != "hecho" and any(q["id"] == d and q["activo"] for q in P)]
                if falta:
                    E[p["id"]] = {"estado": "salteado", "error": "falló " + ", ".join(falta)}
                    guardar_estado(E)
                    anotar(f"— {p['nombre']}: salteado (falló {', '.join(falta)})")
                    continue
                for intento in (1, 2):
                    anotar(f"▶ {p['nombre']}" + (" (segundo intento)" if intento == 2 else ""))
                    E[p["id"]] = {"estado": "corriendo", "inicio": time.time(), "intentos": intento}
                    guardar_estado(E)
                    try:
                        p["hacer"]()
                        E[p["id"]].update(estado="hecho", fin=time.time())
                        guardar_estado(E)
                        anotar(f"✓ {p['nombre']} ({(E[p['id']]['fin'] - E[p['id']]['inicio']) / 60:.0f} min)")
                        break
                    except Exception as e:  # noqa: BLE001
                        E[p["id"]].update(estado="falló", fin=time.time(), error=str(e)[:200])
                        guardar_estado(E)
                        anotar(f"✗ {p['nombre']}: {e}")
        except KeyboardInterrupt:
            anotar("Cortado a mano. Al volver a correrlo, sigue desde donde quedó.")
            for k, v in E.items():
                if v.get("estado") == "corriendo":
                    v["estado"] = "cortado"
            guardar_estado(E)
            return
    hechos = sum(1 for p in P if E.get(p["id"], {}).get("estado") == "hecho")
    anotar(f"Terminó: {hechos} de {sum(1 for p in P if p['activo'])} pasos. Informe en {PLAN / 'informe.md'}")


if __name__ == "__main__":
    main()
