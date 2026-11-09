#!/bin/sh
# compilar_world.sh — compila WORLD (el analizador y sintetizador de voz de Morise, licencia BSD) a WebAssembly para el
# cantor de banco (motor/vendor/world/world.wasm). Este script, motor/vendor/world/glue.cpp y el código de WORLD (sin
# cambios, en la versión de abajo) son todo lo que hace falta para rehacer el .wasm. Usa zig como compilador de C++
# (pip install ziglang).
#
#   sh herramientas/compilar_world.sh [carpeta donde clonar WORLD] [python con ziglang]
set -e
VERSION=c794856b537758a3d300757db2e5e31685a822c2
AQUI=$(cd "$(dirname "$0")/.." && pwd)
W=${1:-/tmp/World}
PY=${2:-python3}
[ -d "$W" ] || git clone https://github.com/mmorise/World "$W"
git -C "$W" checkout -q $VERSION
cp "$W/LICENSE.txt" "$AQUI/motor/vendor/world/LICENSE-WORLD.txt"
"$PY" -m ziglang c++ -target wasm32-wasi -O3 -s -fno-exceptions -msimd128 -I"$W/src" \
  -mexec-model=reactor \
  -Wl,--export=w_alloc,--export=w_free,--export=w_fft,--export=w_cuadros,--export=w_analizar,--export=w_sintetizar \
  "$AQUI/motor/vendor/world/glue.cpp" "$W/src/cheaptrick.cpp" "$W/src/common.cpp" "$W/src/d4c.cpp" "$W/src/dio.cpp" \
  "$W/src/fft.cpp" "$W/src/harvest.cpp" "$W/src/matlabfunctions.cpp" "$W/src/stonemask.cpp" "$W/src/synthesis.cpp" \
  -o "$AQUI/motor/vendor/world/world.wasm"
ls -l "$AQUI/motor/vendor/world/world.wasm"
