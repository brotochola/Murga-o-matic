#!/bin/sh
# compilar_mbrola.sh — compila MBROLA a WebAssembly para la página (motor/vendor/mbrola/mbrola.wasm).
# MBROLA es AGPL-3.0: este script, motor/vendor/mbrola/glue.c y el código de MBROLA (sin cambios, en la versión de
# abajo) son todo lo que hace falta para rehacer el .wasm. Usa zig como compilador de C (pip install ziglang).
#
#   sh herramientas/compilar_mbrola.sh [carpeta donde clonar MBROLA]
set -e
VERSION=274dead162f2826dc38c208fba92efeddb724c33
AQUI=$(cd "$(dirname "$0")/.." && pwd)
M=${1:-/tmp/MBROLA}
[ -d "$M" ] || git clone https://github.com/numediart/MBROLA "$M"
git -C "$M" checkout -q $VERSION
python3 -m ziglang cc -target wasm32-wasi -O2 -s -DLIBRARY -DLITTLE_ENDIAN -D__linux \
  -Wno-incompatible-function-pointer-types \
  -I"$M/Parser" -I"$M/Standalone" -I"$M/Misc" -I"$M/LibOneChannel" -I"$M/Engine" -I"$M/Database" \
  -mexec-model=reactor \
  -Wl,--export=mb_init,--export=mb_freq,--export=mb_alloc,--export=mb_free,--export=mb_res,--export=mb_synth,--export=mb_error \
  "$AQUI/motor/vendor/mbrola/glue.c" "$M/LibOneChannel/lib1.c" -o "$AQUI/motor/vendor/mbrola/mbrola.wasm"
ls -l "$AQUI/motor/vendor/mbrola/mbrola.wasm"
