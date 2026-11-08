# Compositor 2: qué cambió y por qué

La versión 1 del compositor es la que se aprobó de oído el 7 de noviembre de 2026. La versión 2 corrige ocho cosas en las que lo generado se apartaba de las murgas reales. Cada cambio se midió contra el corpus antes de quedarse. Los que no movían nada fuera del ruido se descartaron.

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

Además, se descartaban los gestos que arrancan en semicorchea impar, una anacrusa sincopada, aunque la celda queda alineada al medio compás igual. Ahora entran. Las celdas llegan a 16,6 % de golpes en semicorchea impar y lo generado a 16,1 %. Con dos juegos de semillas, la suma de los tres estilos baja de 52,7 a 50,7 y de 53,6 a 52,1.

## 7. La retirada dura lo que una real

En el corpus, una retirada dura 7,8 minutos en la mediana sin la canción final, y 11 con ella. Las generadas en "normal" duraban 5,3 minutos, canción final incluida. En los bloques largos con batería se nota más: los reales van de 100 a 350 s seguidos, y los generados no pasaban de 70.

Ahora la retirada "normal" tiene tres partes en lugar de dos, y la "larga", cuatro. Antes de la tercera parte hay otro pasaje corto a capela. La canción final pasa de 32 a 64 compases (unos 150 s, como en el corpus). Tiene estrofa, estribillo, la estrofa otra vez con el coro y un cierre nuevo. Se probó también volver a cantar el estribillo, pero así la repetición a 32 compases subía de 9 % a 22 %, contra 7 % en las reales.

| Retirada | Antes | Ahora | Real |
|---|---|---|---|
| Duración, mediana | 341 s | 480 s | 573 s |
| Bloques de 4 s o más | 7 | 9 | 9 |
| Pasajes a capela | 3 | 4 | 4 |
| Tiempo a capela | 25 % | 20 % | 18 % |

La repetición en las retiradas queda más cerca de las reales:

| Distancia | 4 compases | 8 | 16 | 24 | 32 |
|---|---|---|---|---|---|
| Real | 11 % | 10 % | 8 % | 8 % | 7 % |
| Antes | 9 % | 20 % | 27 % | 14 % | 9 % |
| Ahora | 9 % | 17 % | 14 % | 11 % | 13 % |

En los rasgos de nota no cambia nada fuera del ruido. Con dos juegos de semillas, la suma de distancias da: todas 18,7 → 17,4 y 20,2 → 19,2; Catalina 20,6 → 20,7 y 21,7 → 20,8; Trasnochada 19,5 → 19,6 y 20,9 → 20,3.

## 8. El modelo aprende de 85 tramos

El corpus pasó de 41 a 85 tramos: se sumaron presentaciones y retiradas de 2023 a 2026 de Doña Bastarda, Asaltantes con Patente, La Nueva Milonga, Cayó la Cabra, La Gran Muñeca y siete murgas más (`transcripcion/videos.csv`). Las cuatro primeras tienen estilo propio en la página. Las demás entran en "todas".

Al aprender se descartan ahora las celdas cuya melodía abarca más de 16 semitonos en dos compases: 33 de 3060. Casi siempre son un salto de octava del transcriptor, cuando la voz de arriba se calla y la de abajo pasa a ser "la melodía". Con esas celdas, en el estilo de La Nueva Milonga salían notas que no se pueden cantar (La 1 a Si 1).

Mismo compositor, modelo de antes contra modelo nuevo, en suma de distancias con dos juegos de semillas, medido contra los 85 tramos:

| Estilo | Modelo de antes | Modelo nuevo |
|---|---|---|
| Todas | 21,0 · 19,8 | 19,1 · 18,1 |
| Agarrate Catalina | 21,9 · 22,4 | 19,8 · 19,2 |
| La Trasnochada | 19,5 · 18,2 | 19,6 · 19,3 |

Lo que más se mueve es la síncopa: 12 % → 16 % de golpes en semicorchea impar (real 19 %). Es el cambio 6, que recién ahora llega al modelo. En el jurado sin espiar, lo generado queda a 1,17 de un espectáculo que el modelo no vio. Dos espectáculos reales quedan entre sí a 1,28. El motor queda más cerca que la mediana real en el 69 % de los casos. La copia: en 540 piezas de los 9 estilos, el pasaje más largo igual a uno real tiene 10 notas en la mediana y 16 como máximo.

## Lo que se probó y no quedó

- **Suavizar los saltos de las voces de abajo en las costuras**, por octava o por la nota del acorde más cercana. Baja los saltos de cuarta, pero sube los de tercera y saca terceras entre voces. En el jurado, sin espiar, no cambió nada (1,32 contra 1,33).
- **Cambiar el peso de la costura, el de la continuidad de la melodía y el del registro.** Con dos juegos de semillas, la mejor combinación ganó un 3 %, del mismo tamaño que el ruido.

## Lo que sigue abierto

- El ámbito de las líneas por compás sigue alto (2,05 semitonos contra 1,68), y la síncopa un poco baja (0,14 contra 0,19).
- Las partes de la retirada siguen siendo más cortas que las reales: el cuerpo de la retirada, sin la canción final, dura 5,2 minutos contra 7,8.
