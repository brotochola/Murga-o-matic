# Murga-o-matic

Generador de murga uruguaya en el navegador. Elegís presentación o retirada, murga, tonalidad y largo, y compone una pieza nueva a partir de lo que canta el coro en grabaciones reales de La Trasnochada y Agarrate Catalina.

- **Batería:** siempre loops reales, del video [17 ritmos fundamentales de murga](https://www.youtube.com/watch?v=0DSJVulzDYw), de La Tríada: Pablo "Lolito" Iribarne (bombo), Raúl García (redoblante) y Gerardo "Batata" Cánepa (platillos).
- **Composición:** recombina gestos reales de dos compases, con su melodía, sus voces y sus acordes, según la forma: pregunta, respuesta, contraste y vuelta. Ningún pasaje copia más de un par de compases, y cada pocas notas hay una variación.
- **Voces:** cada golpe se canta con un recorte real de un golpe con el mismo acorde, afinado con precisión. Sin el banco de recortes, canta con muestras "aah" de FluidR3 y MusyngKite, tomadas de [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts).

Desde la página podés mezclar en vivo, ver el piano-roll y descargar un ZIP con la mezcla en WAV, el coro en MIDI y la estructura.

## Uso local

    node herramientas/servir.js
    # abrir http://localhost:8123

Si se abre `index.html` como archivo, sin servidor, el navegador no deja cargar los audios.

## Cómo está hecho

| Paso | Qué hace | Dónde |
|---|---|---|
| 1 | Baja los videos, corta los tramos, separa voces y transcribe | `transcripcion/murga_lote.py`, `transcripcion/videos.csv` |
| 2 | Limpia y analiza cada MIDI: grilla, golpes, acordes, compás | `herramientas/analizar.js` |
| 3 | Controla cada tramo | `herramientas/revisar.js`, `docs/revision_de_los_midis.md` |
| 4 | Aprende los gestos y las tablas | `herramientas/aprender.js`, `motor/modelo.js` |
| 5 | Arma el banco de voces | `transcripcion/banco.py` |
| 6 | Compone y canta | `motor/compositor.js`, `motor/voz_real.js`, `motor/app.js` |
| 7 | Juzga lo generado contra lo real | `herramientas/jurado.js`, `herramientas/copia.js` |

El análisis completo, con todos los números, está en [docs/analisis_de_los_midis.md](docs/analisis_de_los_midis.md). Las fuentes sobre el coro, en [INVESTIGACION.md](INVESTIGACION.md).

## Lo que no está en el repositorio

`murga_trabajo/` queda fuera de git: los audios, las voces separadas y el banco de recortes son grabaciones ajenas, para uso personal. Sin esa carpeta la página funciona igual, con las muestras de coro.
