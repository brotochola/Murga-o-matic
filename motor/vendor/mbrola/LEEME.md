# MBROLA en la página

- **`mbrola.wasm`**: MBROLA 3.4-dev (https://github.com/numediart/MBROLA, versión `274dead1`), sin cambios, compilado a
  WebAssembly con `herramientas/compilar_mbrola.sh`, más `glue.c`, que le pasa un guion .pho entero y devuelve las
  muestras. MBROLA es software libre bajo la licencia AGPL-3.0 (`LICENSE-MBROLA.txt`). El código para rehacer el
  `.wasm` está todo en este repositorio (el script y `glue.c`) y en el de MBROLA, en esa versión.
- **`es2`**: la voz castellana masculina ES2 de MBROLA (TCC Communications, 1998). Se puede usar sólo con el programa
  MBROLA y copiar libremente mientras no se cobre: su aviso, que tiene que ir con ella, está en `es2-LICENCIA.txt`.
  El archivo es el mismo que el del paquete `mbrola-es2` de Debian y Ubuntu.
- **`es1`**: la voz castellana masculina ES1 de MBROLA (Lourdes Aguilar, Alistair Conkie, Rafael Marín, Universitat
  Autònoma de Barcelona, 1998), con las mismas condiciones; su aviso está en `es1-LICENCIA.txt`. Canta uno de cada dos
  cantores de cada cuerda, para que el coro no sea una sola voz.

Lo usa `motor/cantor/mbrola.js` (un WASI mínimo que le hace creer que lee la voz del disco) desde
`motor/cantor/obrero.js`, y el guion lo arma `motor/cantor/difonos.js`.
