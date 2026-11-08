# ¿Cuánto se puede confiar en el transcriptor?

Este documento lo escribe `node herramientas/informe_transcriptor.js`: no se edita a mano.

Todo el corpus sale de separar las voces con Demucs y transcribirlas con MuScriptor. Para saber cuánto se equivocan, y si las perillas que nunca se tocaron cambian algo, se hicieron dos cosas:

1. **Un coro con las notas conocidas.** El motor compone cinco piezas (presentaciones y retiradas, mayor y menor) y los trece cantores sintéticos las cantan, con letra. Se guarda cada nota de cada cantor. Las piezas se mezclan como suena una murga: con sala, con la batería real al nivel mediano del corpus (8,7 dB debajo del coro, medido en los 41 tramos) y con público y la compresión de YouTube (Opus a 128 kb/s). Después pasan por la misma cadena que las murgas reales, con distintas perillas, y lo transcripto se compara nota por nota con la verdad (`herramientas/comparar_transcripcion.js`).
2. **Varias tomas del mismo espectáculo** (sección 4): otras noches, otras cámaras, la tribuna y el disco. Lo que coincide entre noches distintas es la murga; lo que no, es sobre todo el transcriptor.

> Un coro sintético no es un coro de verdad: canta más parejo y su timbre es otro. Los números de la sección 1 a 3 son una cota: lo que el transcriptor pierde con un coro que conoce poco. La sección 4 es con murgas reales.

## Cómo funcionan

**Demucs** (`htdemucs_ft`) separa una grabación en cuatro pistas: voces, batería, bajo y "el resto". Es una red que mira a la vez la forma de onda y el espectrograma, y la versión `_ft` son cuatro redes, una afinada para cada pista. Aprendió con música pop y rock (MUSDB). Por eso la batería de murga no le resulta familiar: buena parte del bombo, los platillos y el redoblante va a parar a "el resto", y en el corpus la percusión se toma como todo lo que no es voz. Las voces sí las separa bien: en el banco quedan a 10-11 dB de las verdaderas (SDR), un valor bueno para música real.

**MuScriptor** es un traductor de audio a notas, como los de texto, de la familia de MT3. Corta el audio en pedazos de 5 s y, para cada uno, escribe una ficha por vez: "empieza la nota 62", "pasaron 40 ms", "termina la 62"… Elige siempre la ficha más probable (búsqueda voraz). Al pedazo siguiente le pasa las notas que quedaron sonando. De ahí salen sus fallas:

- **La cadena.** Si un pedazo sale mal y deja muchas notas abiertas, el siguiente las hereda y la basura se arrastra. Por eso `murga_lote.py` corta la cadena cuando hay más de 8 abiertas.

- **Las trabas.** Sobre habla, aplausos o pasajes casi inaudibles, a veces repite un acorde a tiempo fijo. Las saca `limpiar.js`.

- **El ataque adelantado.** Marca el comienzo de la nota en la consonante, no en la vocal: en el banco, 19-31 ms antes en la mediana y más de 70 ms antes en el 10 % de las notas. La grilla del análisis lo absorbe.

- **Sílabas repetidas.** Dos sílabas seguidas en la misma nota a veces quedan como una nota larga. En el banco pierde el 15 % de las notas repetidas, contra el 10 % del resto.

- **Pocas octavas equivocadas.** Las notas a una octava de la verdadera son el 0,2-0,5 %.

Las perillas que se pueden tocar, y que nunca se habían tocado, son el tamaño del modelo (small, medium, large), la búsqueda con haz (`beam`: probar varias secuencias de fichas en vez de la más probable), la guía (`cfg`: cuánto se ata al audio contra lo que "espera" de la música) y dónde caen los cortes de 5 s. La sección 2 las prueba.

## 1. De dónde sale el error

Las cinco piezas (13 minutos, 5 piezas). Una nota está bien si el ataque cae a menos de 100 ms y la nota es la misma. Con trece cantores, cada uno entra hasta 30-50 ms corrido y la consonante va antes del tiempo, así que ±50 ms es muy estricto para un coro: se muestra también.

| Caso | F1 ±100 ms | ±50 ms | Precisión | Cobertura | Octava | Melodía | Bajo | Voces por golpe (verdad → escritas) | Golpes a una voz | Inventadas | SDR voces | Tiempo por s de audio |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| coro solo, seco · sin separar · medium | **90,1 %** | 69,5 % | 90,1 % | 90,1 % | 0,0 % | 85,4 % | 89,3 % | 2,00 → 1,90 | 38,3 % → 34,5 % | 4 | — | 0,57 s |
| coro y batería · sin separar · medium | **83,4 %** | 68,0 % | 79,6 % | 87,6 % | 0,2 % | 77,8 % | 84,5 % | 2,00 → 1,92 | 38,3 % → 32,4 % | 35 | — | 0,45 s |
| batería, público y Opus · sin separar · medium | **84,2 %** | 68,2 % | 82,2 % | 86,3 % | 0,2 % | 78,4 % | 83,2 % | 2,00 → 1,88 | 38,3 % → 33,6 % | 0 | — | 0,48 s |
| coro y batería · htdemucs_ft · medium | **88,6 %** | 64,2 % | 90,0 % | 87,3 % | 0,2 % | 81,8 % | 85,1 % | 2,00 → 1,86 | 38,3 % → 34,3 % | 2 | 10,4 dB | 0,42 s |
| batería, público y Opus · htdemucs_ft · medium | **89,7 %** | 65,0 % | 91,5 % | 88,1 % | 0,2 % | 83,0 % | 85,3 % | 2,00 → 1,87 | 38,3 % → 34,0 % | 0 | 11,4 dB | 0,43 s |

## 2. Las perillas

Sobre tres piezas (p1, p2, p3), con batería, público y Opus, separado con htdemucs_ft salvo que diga otra cosa.

| Caso | F1 ±100 ms | ±50 ms | Precisión | Cobertura | Octava | Melodía | Bajo | Voces por golpe (verdad → escritas) | Golpes a una voz | Inventadas | SDR voces | Tiempo por s de audio |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| coro con sala · sin separar · medium | **89,9 %** | 61,1 % | 90,6 % | 89,2 % | 0,0 % | 82,8 % | 86,7 % | 1,92 → 1,83 | 41,2 % → 37,5 % | 2 | — | 0,41 s |
| batería, público y Opus · htdemucs_ft · medium | **89,4 %** | 58,4 % | 91,6 % | 87,3 % | 0,1 % | 82,3 % | 84,6 % | 1,92 → 1,78 | 41,2 % → 37,2 % | 0 | 12,1 dB | 0,43 s |
| batería, público y Opus · htdemucs_ft · medium, haz=3 | **89,0 %** | 58,7 % | 91,5 % | 86,7 % | 0,0 % | 82,7 % | 84,0 % | 1,92 → 1,76 | 41,2 % → 37,5 % | 0 | 12,1 dB | 1,71 s |
| batería, público y Opus · htdemucs_ft · medium, cfg=1.5 | **89,1 %** | 57,2 % | 91,4 % | 86,8 % | 0,2 % | 82,0 % | 84,3 % | 1,92 → 1,76 | 41,2 % → 38,6 % | 0 | 12,1 dB | 0,60 s |
| batería, público y Opus · htdemucs_ft · medium, desfase=2.5 | **89,1 %** | 57,2 % | 90,6 % | 87,7 % | 0,2 % | 81,3 % | 84,4 % | 1,92 → 1,81 | 41,2 % → 37,5 % | 0 | 12,1 dB | 0,39 s |
| batería, público y Opus · htdemucs_ft · small | **86,3 %** | 74,9 % | 85,6 % | 87,0 % | 0,4 % | 76,8 % | 83,9 % | 1,92 → 1,82 | 41,2 % → 35,3 % | 0 | 12,1 dB | 0,18 s |
| batería, público y Opus · htdemucs · medium | **88,5 %** | 58,4 % | 90,6 % | 86,5 % | 0,1 % | 80,8 % | 83,3 % | 1,92 → 1,76 | 41,2 % → 35,6 % | 0 | 16,6 dB | 0,39 s |

**¿Escribe siempre lo mismo?** Casi. El mismo audio, pasado dos veces con los cortes de 5 s corridos 2,5 s, da transcripciones que coinciden en el 90,6 % de las notas a ±100 ms, la misma vara que contra la verdad, y en el 78,8 % a ±60 ms. Lo que cambia de una pasada a la otra es sobre todo el momento exacto del ataque, en hasta 100 ms, y no tanto qué nota escribe. Las diferencias no se juntan cerca de los cortes: el 41,9 % de las notas sin par a ±60 ms cae a menos de 0,5 s de un corte, cuando al azar sería el 40 %. Como las dos pasadas aciertan lo mismo contra la verdad (89 %) y coinciden más que eso entre ellas, los errores son en buena parte los mismos: el transcriptor se equivoca siempre en los mismos lugares. Por eso juntar dos pasadas no mejora. Quedarse con lo que coincide sube la precisión pero pierde un cuarto de las notas, y sumar todo hace lo contrario.

Ninguna perilla le gana a lo que ya se usaba (htdemucs_ft y MuScriptor medium, búsqueda voraz): el haz, la guía, los cortes corridos y htdemucs quedan a medio punto o menos, y algunas tardan hasta cuatro veces más. El modelo small es 2,4 veces más rápido pero acierta 3 puntos menos, y la melodía 5,5 menos. El modelo large no se pudo probar: sus pesos piden aceptar la licencia en https://huggingface.co/MuScriptor/muscriptor-large con la cuenta de Hugging Face.

## 3. ¿Qué rasgos del análisis mueve el transcriptor?

Cada rasgo del jurado se calcula dos veces en las cinco piezas: con las notas verdaderas, en su grilla exacta, y con lo que escribe la cadena completa (batería, público, Opus, htdemucs_ft, MuScriptor, la grilla sacada de los ataques y la limpieza de siempre). La diferencia está en anchos de la norma del jurado: menos de 1 no cambia la nota del jurado de forma apreciable (`herramientas/sesgo_transcriptor.js`).

| Rasgo | Qué mide | Verdad | Escrito | Sesgo |
|---|---|---|---|---|
| subdom | tiempo en subdominante | 0,16 | 0,22 | 1,2 |
| frase | largo mediano de frase, en compases | 1,41 | 1,63 | 0,9 |
| topTercera | la melodía salta una tercera | 0,10 | 0,12 | 0,9 |
| largas | notas largas (negra con puntillo o más) | 0,17 | 0,21 | 0,8 |
| densidad | golpes por compás | 4,25 | 3,74 | -0,8 |
| aire | parte del tiempo sin nadie cantando | 0,12 | 0,07 | -0,6 |
| topGrado | la melodía se mueve por grado | 0,40 | 0,36 | -0,6 |
| aterriza | frases que terminan en nota larga | 0,75 | 0,83 | 0,6 |
| dominante | tiempo en dominante | 0,26 | 0,24 | -0,5 |
| octavas | golpes con la melodía doblada a la octava | 0,19 | 0,24 | 0,4 |
| tercera | la línea salta una tercera | 0,06 | 0,07 | 0,4 |
| tonica | tiempo en tónica | 0,44 | 0,42 | -0,4 |
| cromat | notas fuera de la escala | 0,06 | 0,08 | 0,4 |
| bloqueLargo | golpes largos a tres voces o más | 0,47 | 0,42 | -0,3 |

