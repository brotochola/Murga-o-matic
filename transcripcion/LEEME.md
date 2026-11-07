# De los videos a los MIDI

`murga_lote.py` hace todo el camino:

1. `videos.csv` dice qué tramo de qué video es cada parte de cada espectáculo. Los tiempos van en `desde` y `hasta`, en segundos o mm:ss; un `desde` negativo cuenta desde el final; vacío es todo el video.
2. Baja el audio completo de cada video.
3. Corta el tramo.
4. Separa voces y todo lo demás con Demucs (`htdemucs_ft`).
5. Transcribe sólo las voces con MuScriptor. Cada MIDI es sólo voces.

Lo ya hecho no se repite. Todo queda en `murga_trabajo/`. Al repositorio van los MIDI, los análisis y los resultados; el audio no, porque son grabaciones ajenas y pesan más de 2 GB.

## Una sola vez

1. Instalá [uv](https://docs.astral.sh/uv/) y creá un entorno con Python 3.12.
2. Instalá PyTorch con CUDA y las dependencias que figuran al principio de `murga_lote.py`. En una GTX 1650 de 4 GB entran Demucs y MuScriptor `medium`, a alrededor de 1,2 segundos de cómputo por segundo de audio en total.
3. Entrá a https://huggingface.co/MuScriptor/muscriptor-medium con tu cuenta y tocá **Agree and access**: es la licencia no comercial de los pesos.
4. Iniciá sesión con `uvx hf auth login` y un token de lectura.

yt-dlp necesita Node instalado: sin un motor JS, YouTube contesta "not available" en algunos videos.

## Correr

```bash
python murga_lote.py                      # todo
python murga_lote.py --solo-bajar         # sólo baja los audios
python murga_lote.py --solo 2024          # sólo los tramos cuyo nombre tiene ese texto
python murga_lote.py --cookies firefox    # si YouTube pide confirmar que no sos un robot
```

Para rehacer un tramo, sacá su `.mid` de `murga_trabajo/midis/`. Si las voces separadas y el `.json` siguen ahí, no repite Demucs.

Después:

```bash
node ../herramientas/analizar.js          # limpia y analiza
node ../herramientas/revisar.js           # control de cada tramo
node ../herramientas/aprender.js          # el modelo del generador
python pureza.py                          # pureza y unísono de cada golpe, sobre las voces
```

## Qué mirar

`revisar.js` avisa cuando un tramo tiene muchas notas quitadas o fuera de la escala, o cuando Demucs perdió las voces. El sidecar `.json` de cada MIDI trae `cadenas_cortadas`: las veces que MuScriptor se trabó y hubo que cortarle la cadena de notas abiertas. La explicación está en `docs/analisis_de_los_midis.md`, sección 1.2.
