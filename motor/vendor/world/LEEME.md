# WORLD para el cantor de banco

- **`world.wasm`**: WORLD, el analizador y sintetizador de voz de Masanori Morise (https://github.com/mmorise/World,
  versión `c794856b`), sin cambios, compilado a WebAssembly con `herramientas/compilar_world.sh`. Va con `glue.cpp`,
  que analiza una grabación (DIO o Harvest para la altura, CheapTrick para la envolvente, D4C para el aire) y
  sintetiza desde los cuadros. WORLD tiene licencia BSD modificada (`LICENSE-WORLD.txt`).

Lo usa `motor/cantor/world.js` desde `motor/cantor/banco.js`, el cantor con un banco de voz cantada de UTAU
(`docs/utau.md`). Los bancos no van al repositorio: cada uno tiene sus condiciones de uso.
