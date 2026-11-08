# Compositor 2: qué cambió y por qué

La versión 1 del compositor es la que se aprobó de oído el 7 de noviembre de 2026. La versión 2 corrige seis cosas en las que lo generado se apartaba de las murgas reales. Cada cambio se midió contra el corpus antes de quedarse. Los que no movían nada fuera del ruido se descartaron.

La página deja elegir la versión en **Compositor**. La versión 1 viene con su modelo y sus modos de ese día (`motor/compositor_v1.js`, `motor/modelo_v1.js`, `motor/modos_v1.js`), así suena exactamente igual que antes.

## Cómo se midió

- **Rasgos de nota.** Para cada estilo (Catalina, Trasnochada, todas) se generan 80 piezas (40 semillas por forma) con cada versión. Se calcula la mediana de cada uno de los 30 rasgos del jurado y su distancia a la mediana de los tramos reales de ese estilo, en anchos de la norma del jurado. La medida es la suma de las 30 distancias. Con otro juego de 80 semillas la suma cambia hasta ±1,3: eso es el ruido.
- **Repetición.** Para cada ventana de 2 compases, se toma el contorno de la melodía: los intervalos entre notas distintas, sin mirar el ritmo. La ventana cuenta como repetida si a cierta distancia (±2 compases) hay otra con al menos 80 % de los intervalos en común.
- **Forma por bloques.** Los pasajes con batería y a capela de 4 s o más, como en `herramientas/forma.js`.

Las tres medidas se rehacen con `node herramientas/ab_compositor.mjs <estilo> 40`, `node herramientas/repeticion.mjs` y `node herramientas/bloques_forma.mjs`.

## 1. Las voces de abajo no se callan

Cada pocas notas, el compositor cambia una nota débil de la melodía, como cambia una melodía entre dos versos. En la versión 1, las voces de abajo acompañaban el cambio corriéndose los mismos semitonos. Si así quedaban fuera de la escala o chocaban, se callaban, y el golpe quedaba en unísono.

Ahora acompañan por la escala: una tercera sigue siendo tercera, mayor o menor según caiga. Si chocan, se quedan o van a la nota del acorde más cercana. Si no queda ninguna, el acorde se arma de nuevo debajo de la melodía.

Vecinas a distancia de tercera, en Catalina: 0,57 → 0,66 (real 0,66).

## 2. El unísono ya no sale elegido de más

Al elegir el gesto siguiente, se mira la costura: que cada voz de abajo tenga a dónde ir sin saltar. Pero un gesto que arranca en unísono no tiene voces de abajo, así que nunca pagaba esa costura y salía elegido de más. En los gestos reales, el 26,8 % de los golpes son unísonos; en lo generado por la versión 1, el 35 %. Ahora esos gestos pagan la costura media de los otros candidatos. Queda en 26,6 %.

Con los cambios 1 y 2, la suma de distancias en rasgos de nota baja así:

| Estilo | v1 | v2 |
|---|---|---|
| Agarrate Catalina | 24,8 | 20,1 |
| La Trasnochada | 20,4 | 18,5 |
| Todas | 21,0 | 17,9 |

## 3. Menos repetición

| Distancia | 4 compases | 8 | 16 | 24 | 32 |
|---|---|---|---|---|---|
| Real | 10 % | 10 % | 8 % | 7 % | 8 % |
| Versión 1 | 11 % | 41 % | 50 % | 19 % | 7 % |
| Versión 2 | 7 % | 14 % | 23 % | 9 % | 6 % |

En la versión 1, cada tema tenía la forma a a' b a'', y a'' era una copia de a'. Además, cada parte tenía su "otra vuelta", que repetía el tema entero. Así, cada gesto de dos compases sonaba hasta seis veces en 32 compases. Las murgas del corpus repiten el contorno de la melodía en un 7 a 10 % parejo, a cualquier distancia.

**¿No será el transcriptor, que borra las repeticiones?** Se controló con el banco de prueba (ver [transcriptor.md](transcriptor.md)). Las piezas de la versión 1 se cantaron con el coro sintético, se mezclaron con batería, público y Opus, y se transcribieron con la cadena de siempre. En la verdad repiten 41 % a 8 compases y 46 % a 16. Transcriptas, 26 % y 35 %. El transcriptor conserva dos tercios de las repeticiones: si las murgas repitieran como la versión 1, en el corpus se mediría alrededor de 30 %, no 10 %.

Ahora a'' es material nuevo que cierra en la tónica, y las partes "siguen" con material nuevo, en el mismo tono. Se repiten lo que sí se repite en las murgas: el estribillo de la presentación, la canción final con el coro y la bajada.

Una salvedad. La bajada se repite en las murgas: está documentado, y el compositor la repite cuatro veces. En los videos del corpus, el final de las retiradas no muestra repeticiones, ni en las notas ni en el croma del audio de las voces. Probablemente los videos cortan antes, o la bajada va cambiando (por ejemplo, sube de tono a cada vuelta). Por eso la bajada quedó como estaba.

Este cambio sube un poco la distancia de rasgos de nota en "todas" (17,9 → 19,5): con más costuras entre gestos, hay algún salto más en la melodía. El cambio 4 lo compensa.

## 4. La nota que varía cambia por una vecina

La nota débil que se cambia quedaba libre, y a veces saltaba. Ahora tiene que ser otra nota, pero cerca: un tirón de 1,6 semitonos hacia la original.

| Estilo | Antes | Después |
|---|---|---|
| Agarrate Catalina | 20,1 | 19,6 |
| La Trasnochada | 18,3 | 18,0 |
| Todas | 19,5 | 17,1 |

Los saltos de cuarta o más en las líneas bajan de 1,84 a 1,24 anchos de la norma. La copia no cambia: el pasaje más largo igual a uno real tiene 9 notas en la mediana y 16 como máximo, en 300 piezas.

## 5. Menos a capela en la retirada

En las retiradas generadas, el coro cantaba a capela el 38 % del tiempo; en las reales, el 17 %. La mayor parte venía de la canción final, que arrancaba con 16 compases sin batería. En el corpus, la canción final va casi siempre con batería, en 9 de 12 tramos y por 150 a 180 s seguidos, a veces con una entrada corta a capela. Además, la clarinada del medio duraba 27 s, y los pasajes a capela del medio duran 16 s en la mediana.

Ahora la canción final va con batería y la clarinada del medio tiene 4 compases. Queda a capela el 25 % del tiempo, con pasajes del medio de 15 s.

## 6. Los gestos sincopados entran al modelo

Al aprender, un gesto de dos compases se descartaba si menos del 60 % de sus golpes caían en semicorchea par. La idea era tirar los gestos con la grilla corrida, pero también se iban los sincopados de verdad. Los tramos tienen 18,6 % de golpes en semicorchea impar; las celdas del modelo, 12,5 %; y lo generado, 12,4 %. El banco de prueba dice que la grilla de los tramos no infla la síncopa: si algo, la baja un poco (0,4 anchos).

Con el umbral en 50 %, las celdas quedan en 14,3 %. La suma de distancias, con el modelo de antes, baja en los tres estilos: Catalina 20,0 → 18,3, Trasnochada 18,0 → 17,3, todas 17,7 → 17,1. Con 40 % casi no entra más síncopa (14,5 %), así que quedó 50 %. Los gestos con la grilla corrida se siguen yendo por el otro filtro: que los apoyos caigan en el acorde.

## Lo que se probó y no quedó

- **Suavizar los saltos de las voces de abajo en las costuras**, por octava o por la nota del acorde más cercana. Baja los saltos de cuarta, pero sube los de tercera y saca terceras entre voces. En el jurado, sin espiar, no cambió nada (1,32 contra 1,33).
- **Cambiar el peso de la costura, el de la continuidad de la melodía y el del registro.** Con dos juegos de semillas, la mejor combinación ganó un 3 %, del mismo tamaño que el ruido.

## Lo que sigue abierto

- El ámbito de las líneas por compás sigue alto (2,05 semitonos contra 1,68), y la síncopa un poco baja (0,14 contra 0,19).
- Las retiradas generadas duran 5,6 minutos en "normal". Las reales, unos 8.
