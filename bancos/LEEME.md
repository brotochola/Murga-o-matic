# Los bancos de voces

Acá van los bancos de voz cantada de UTAU que usan la página (en «Cantantes → El plantel») y `estudio.html`, cada uno
en un .zip, enteros, tal como los baja su autor. **No están en el repositorio**: pesan 1,65 GB y varios pasan los 100 MB
que acepta GitHub. Se bajan de la página de su autor y se dejan acá, con el nombre que dice `plantel.json`.

**La página publicada sí los trae**, recortados y en Opus (142 MB), con permiso de sus autores (noviembre de 2026),
que piden que se los mencione con un link a su página: la página los nombra en el plantel y en «Cómo funciona». Los
recorta `npm run bancos` (de esta carpeta a `offline/bancos/`) y los publica `npm run publicar` (ver el README).

| Archivo | Banco | Autor | Su página |
|---|---|---|---|
| `LongWei Symphonia ES.zip` | LW_Symphonia_es v1.0 | deadbyte (LW) | <https://lw-winery.carrd.co/> |
| `MIKE.zip` | Mike_Normal (VCCV) | AkuP (Miguel Rocha) | <http://utau.wikidot.com/utau:mike> (Icedrive: bajar a mano) |
| `Sheep Oveja.zip`, `Sheep Cordeiro.zip`, `Sheep Hitsuji.zip` | Sheep | EdusheeP | <https://sites.google.com/view/edusheep/sheep> |
| `Vincen-oto Legato.zip`, `Vincen-oto Ottava.zip`, `Vincen-oto Rubato.zip` | Vincen-oto | snowsorry | <https://snowsorry-voicebanks.carrd.co/> |
| `Sanfu.zip` | Sanfu Jurani CVVC ITA V2 | Rafu | <https://rafup.altervista.org/vbs/Sanfu_Jurani_CVVC_ITA_V2.zip> |

- **MIKE.zip** es el `Mike_Normal.uar` que trae el .zip original, que también sirve: la página abre el .uar de
  adentro.
- **El zip tal como lo baja su autor** sirve: con carpetas, con los nombres en japonés (Shift-JIS), comprimido o no.
- **Si un banco no está** (ni en esta carpeta ni en la página publicada), sus voces aparecen apagadas. Con «Buscar el
  archivo» se elige el .zip desde la compu, y Chrome y Edge lo recuerdan para la próxima vez.

`plantel.json` dice los bancos (archivo, autor, su página, condiciones y si se publica: `"publicable": true`), las
voces que salen de cada uno (con su color y sus valores) y quién canta en cada uno de los 13 lugares de la murga.
