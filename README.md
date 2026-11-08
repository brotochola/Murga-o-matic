# Murga-o-matic

Generador de murga uruguaya en el navegador: **https://brotochola.github.io/Murga-o-matic/**

Elegís presentación o retirada, murga, tono y largo, y compone una pieza nueva con lo que aprendió del coro en 85 presentaciones y retiradas reales de 13 murgas (515 minutos, de 2008 a 2026). La Trasnochada, Agarrate Catalina, La Gran Muñeca, Metele que son Pasteles, Doña Bastarda, Asaltantes con Patente, La Nueva Milonga y Cayó la Cabra tienen estilo propio.

- **Batería:** siempre loops reales, del video [17 ritmos fundamentales de murga](https://www.youtube.com/watch?v=0DSJVulzDYw), de La Tríada: Pablo "Lolito" Iribarne (bombo), Raúl García (redoblante) y Gerardo "Batata" Cánepa (platillos). Para cambiar de tempo, cada golpe del loop se corta y se pone en su lugar nuevo, así la afinación no cambia. Cada loop son dos compases tal como los tocaron, de un "1" al siguiente, en un tramo parejo de cada demostración: los bateristas aceleran mientras tocan, así que el largo se mide en el audio y no se calcula con el tempo. `herramientas/recortar_loops.mjs` los rehace desde el video, y con `--revisar` controla que cada vuelta caiga donde la tocaron.
- **Composición:** recombina gestos reales de dos compases, con su melodía, sus voces y sus acordes, según la forma: pregunta, respuesta, contraste y vuelta. Cada pocas notas cambia una nota débil, y los gestos seguidos vienen de temas distintos: el pasaje igual a un tema real más largo tiene, en la mediana, 10 notas.
- **Voces:** se eligen arriba de todo.
  - *Muestras de coro:* cinco cuerdas (bajos, segundos, primos, sobreprimos y tercia) con muestras "aah" de FluidR3 y MusyngKite, tomadas de [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts). Cada cuerda tiene de dos a cuatro cantores (la tercia es una voz sola), y el timbre se ecualiza hacia el de un coro de murga medido.
  - *Cantores sintéticos:* un letrista algorítmico escribe una letra rioplatense que entra en la melodía, sílaba por nota y con rima, y trece voces de fuente glótica y formantes la cantan. No usa muestras ni modelos de lenguaje, y anda sin conexión. La letra se puede editar o pedir otra, y un panel muestra paso a paso cómo se hizo cada verso. La voz se calibró contra La Trasnochada 2020. Detalles y mediciones en [docs/cantores_y_letras.md](docs/cantores_y_letras.md).
  - *Difonos:* la misma letra la cantan trece cantores armados con difonos (pedacitos de voz grabada) de [MBROLA](https://github.com/numediart/MBROLA), compilado a WebAssembly, con acento rioplatense exagerado de murguista. Cada cuerda tiene su largo de garganta y cada cantor sus mañas. Se entiende mucho más: con el coro entero, Whisper erra el 13 % de las letras, contra el 45 % del coro de formantes. Con «Sólo un solista» canta uno solo la melodía. En «Los cantantes» se puede cambiar cada uno de los trece (voz, garganta, afinación, vibrato, brillo, dicción, volumen, paneo) y escucharlo solo ([docs/solista.md](docs/solista.md)).

Desde la página podés mezclar en vivo y seguir la partitura, con la letra sílaba por sílaba cuando cantan los cantores sintéticos. Se puede bajar:
- la mezcla en **MP3**, tal como suena con los volúmenes de la mezcla;
- la **partitura coral en PDF**: cinco pentagramas, la letra debajo de cada nota y los acordes arriba. También se puede ver en la página;
- la **letra con los acordes** en TXT, o el cifrado por compases si no hay letra;
- un **ZIP** con la mezcla en WAV, el coro en MIDI (con la letra), la estructura y la letra.

Los acordes de cada sección se pueden cambiar desde la tabla de estructura: la melodía y las voces se acomodan solas al acorde nuevo, y el resto de la pieza no cambia. Los cambios de tono siguen lo que hacen las murgas del corpus: casi la mitad cambia también de modo, y de mayor al menor de la misma tónica es de los más comunes ([docs/cambios_de_modo.md](docs/cambios_de_modo.md)).

La dirección vieja `/cantada/` lleva a la página principal con los cantores sintéticos elegidos.

Fuera de la página, con una placa de video, cada cantor se puede pasar por [Seed-VC](https://github.com/Plachtaa/seed-vc) para que suene a las voces reales de una murga: `herramientas/exportar_voces.mjs` exporta las voces y `transcripcion/convertir_coro.py` las convierte y las vuelve a mezclar. Los pasos están en la [sección 4](docs/cantores_y_letras.md#4-voces-de-verdad-con-seed-vc-fuera-de-la-página).

## Uso local

    node herramientas/servir.js
    # abrir http://localhost:8123

Si se abre `index.html` como archivo, sin servidor, el navegador no deja cargar los audios. La página no usa nada de `murga_trabajo/`.

## Cómo está hecho

| Paso | Qué hace | Dónde |
|---|---|---|
| 1 | Baja los videos, corta los tramos, separa voces y transcribe | `transcripcion/murga_lote.py`, `transcripcion/videos.csv` |
| 2 | Limpia y analiza cada MIDI: grilla, golpes, acordes, compás y qué loop toca la batería | `herramientas/analizar.js` |
| 3 | Controla cada tramo | `herramientas/revisar.js` → `docs/revision_de_los_midis.md` |
| 4 | Mide la pureza y el unísono de cada golpe | `transcripcion/pureza.py` |
| 5 | Aprende los gestos y las tablas | `herramientas/aprender.js` → `motor/modelo.js` |
| 5b | Mide cómo cambian de tono y de modo | `herramientas/cambios_de_modo.js` → `motor/modos.js`, [docs/cambios_de_modo.md](docs/cambios_de_modo.md) |
| 5c | Mide el coro sintético contra el real y ajusta cuánto se diferencian los cantores, sola, en tu compu | `herramientas/trabajo_nocturno.py` → `motor/cantor/variacion.js`, [docs/plan_compu.md](docs/plan_compu.md) |
| 6 | Mide el timbre del coro real | `herramientas/timbre.js` → `motor/timbre.js` |
| 7 | Compone y canta | `motor/compositor.js`, `motor/app.js` |
| 8 | Juzga lo generado contra lo real y elige las demos | `herramientas/jurado.js`, `herramientas/copia.js`, `herramientas/demos.js` → `motor/demos.js` |
| 9 | Escribe el análisis | `herramientas/informe.js` → `docs/analisis_de_los_midis.md` |
| 10 | Mide al transcriptor: un coro sintético con las notas conocidas, mezclado como una murga, por la misma cadena | `herramientas/coro_de_prueba.mjs`, `transcripcion/banco_pruebas.py`, `herramientas/comparar_transcripcion.js`, `herramientas/sesgo_transcriptor.js` → [docs/transcriptor.md](docs/transcriptor.md) |
| 11 | Compara varias grabaciones del mismo espectáculo | `transcripcion/tomas.csv`, `herramientas/tomas.js` → [docs/tomas.md](docs/tomas.md) |
| 12 | Compara las dos versiones del compositor contra el corpus | `herramientas/ab_compositor.mjs`, `repeticion.mjs`, `bloques_forma.mjs` → [docs/compositor_2.md](docs/compositor_2.md) |
| 13 | ¿Se entiende lo que canta? Un cantor solo, o el coro entero, canta frases conocidas y Whisper las transcribe | `herramientas/solista.mjs`, `herramientas/coro_difonos.mjs`, `herramientas/voces_difonos.mjs`, `herramientas/solista_jurado.py` → [docs/solista.md](docs/solista.md) |

El análisis completo, con todos los números, está en [docs/analisis_de_los_midis.md](docs/analisis_de_los_midis.md). Cuánto se puede confiar en las transcripciones, en [docs/transcriptor.md](docs/transcriptor.md). Qué cambió en el compositor 2 y por qué, en [docs/compositor_2.md](docs/compositor_2.md); la página deja elegir también la versión 1, la del 7 de noviembre. Las fuentes sobre el coro, en [INVESTIGACION.md](INVESTIGACION.md).

## Para cambiar el motor

En `murga_trabajo/` están los datos de la investigación:

- `midis/`: el MIDI de voces de cada tramo, con su `.json` (tempo, energía de cada parte separada y veces que se cortó la cadena del transcriptor). En `midis/rotos/` quedan las transcripciones que salieron mal.
- `analisis/`: el análisis de cada tramo.
- `revision/`: un piano-roll por tramo.
- `jurado.json`, `copia.json`, `pureza.json` y `lote.log`: los resultados y el registro del lote.

Con eso, sin volver a transcribir, se puede cambiar el aprendizaje, el compositor, el jurado y el informe:

    node herramientas/aprender.js
    node herramientas/jurado.js --ver --sin-espiar
    node herramientas/copia.js
    node herramientas/demos.js
    node herramientas/informe.js

El audio no está en el repositorio: son grabaciones ajenas y pesan más de 2 GB. `transcripcion/murga_lote.py` lo rehace desde `transcripcion/videos.csv` (ver [transcripcion/LEEME.md](transcripcion/LEEME.md)). Hace falta para transcribir otra vez, para `analizar.js`, que escucha la batería separada, y para `pureza.py` y `timbre.js`. `timbre.js` y `ritmo_loops.js` usan el ffmpeg de imageio-ffmpeg del entorno de Python: la ruta está al principio de cada archivo.
