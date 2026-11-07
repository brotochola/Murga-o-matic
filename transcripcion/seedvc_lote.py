"""
seedvc_lote.py — convierte muchas voces con Seed-VC cargando los modelos una sola vez (cargarlos tarda más que
convertir una voz corta). Lo llama convertir_coro.py con el Python de Seed-VC, desde la carpeta de Seed-VC.

  python seedvc_lote.py trabajos.json
  trabajos.json: {"opciones": {"pasos", "fp16", "checkpoint", "config"}, "trabajos": [{"source", "target", "output"}]}
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.getcwd())
import inference  # noqa: E402  (el de Seed-VC)

_cache = {}
_cargar = inference.load_models


def cargar_una_vez(args):
    clave = (args.checkpoint, args.config, bool(args.f0_condition), bool(args.fp16))
    if clave not in _cache:
        _cache[clave] = _cargar(args)
    return _cache[clave]


inference.load_models = cargar_una_vez


def main():
    datos = json.load(open(sys.argv[1], encoding="utf-8"))
    o, trabajos = datos["opciones"], datos["trabajos"]
    for i, t in enumerate(trabajos):
        if os.path.isdir(t["output"]) and any(f.endswith(".wav") for f in os.listdir(t["output"])):
            continue
        args = argparse.Namespace(source=t["source"], target=t["target"], output=t["output"], diffusion_steps=o["pasos"], length_adjust=1.0,
                                  inference_cfg_rate=0.7, f0_condition=True, auto_f0_adjust=False, semi_tone_shift=0,
                                  checkpoint=o.get("checkpoint"), config=o.get("config"), fp16=o["fp16"])
        inference.main(args)
        print(f"  [{i + 1}/{len(trabajos)}] {os.path.basename(t['source'])}", flush=True)


if __name__ == "__main__":
    main()
