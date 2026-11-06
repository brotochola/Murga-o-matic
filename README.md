# Murga-o-matic

Generador de murga uruguaya en el navegador.

- **Batería:** loops reales del video [17 ritmos fundamentales de murga](https://www.youtube.com/watch?v=0DSJVulzDYw), de La Tríada: Pablo "Lolito" Iribarne (bombo), Raúl García (redoblante) y Gerardo "Batata" Cánepa (platillos).
- **Coro:** cinco cuerdas (bajos, segundos, primos, sobreprimos y tercia) con muestras de voz "aah" de FluidR3 y MusyngKite, tomadas de [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts).
- **Composición:** forma (retirada, presentación o cuplé), melodía de primos con armonización por terceras, pregunta y respuesta, lailareo, clarinada a capela y bajada final.

Desde la página podés mezclar en vivo, ver el piano-roll y descargar un ZIP con la mezcla en WAV, el coro en MIDI y la estructura.

Todo corre en el navegador, sin servidor.

## Uso local

    python3 -m http.server
    # abrir http://localhost:8000

Si se abre `index.html` como archivo, sin servidor, el navegador no deja cargar los audios.
