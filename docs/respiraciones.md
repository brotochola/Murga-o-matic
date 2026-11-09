# Las respiraciones de verdad

La pregunta: nuestro coro sintético nunca respira. En las grabaciones se oye que los cantores toman aire antes de las frases. ¿Cuántas veces, cuán fuerte, cuánto dura, cómo suena y cuánto antes de la voz? Se midió en las 85 voces separadas (`murga_trabajo/voces/`, 8,6 horas, 15 murgas) para poner las respiraciones en la síntesis con números.

Herramienta: `herramientas/respiraciones_medir.py` (Python con numpy; sólo mide, no toca el motor). Resultados: `murga_trabajo/respiraciones/medidas.json` (cada arranque medido, con su resumen), y las mismas cuentas con otros umbrales en `medidas_sobre8.json` y `medidas_sobre12.json`.

## Cómo se mide

1. **Cuadros.** La voz y la batería separada de cada tramo, a mono y 32 kHz. Cuadros de 40 ms cada 10 ms. De cada cuadro: el nivel de «voz» (150 Hz–2 kHz), el nivel de «aire» (300 Hz–8 kHz), la potencia en 17 bandas de tercio de octava (200 Hz–10 kHz), la planitud espectral (500 Hz–8 kHz) y la periodicidad (autocorrelación, corregida por la ventana).
2. **Cuándo se canta.** Un cuadro canta si su nivel de voz está a menos de 25 dB de la voz fuerte del tramo (percentil 90), sacando tiras de menos de 80 ms. Un **arranque** es el primer cuadro de una tira que viene después de 0,4 s o más sin cantar. Salieron **2.777 arranques**: 2.662 del coro, 66 de solistas estrictos, 49 de pasajes cantados de una voz menos estrictos.
3. **Coro o solista.** Es solista si el arranque cae a menos de 0,5 s del principio de un pasaje «estricto» de `murga_trabajo/solistas/segmentos.json` (ver `docs/solistas_reales.md`). Los de pasajes de una voz que no llegan a estrictos van aparte («otro»); «una voz» es la suma de los dos (115 arranques). Todo lo demás es coro.
4. **La respiración.** En el segundo antes del arranque se busca la última tira de cuadros que cumple todo esto: no canta, el aire está más de 5 dB arriba del **piso** del tramo (la mediana del aire en los cuadros que están a más de 0,3 s de todo canto), periodicidad menor que 0,6 (no es una nota), planitud mayor que 0,05, dura entre 80 ms y 1,2 s, termina a menos de 0,4 s del arranque y no empieza pegada a la frase anterior (60 ms como mínimo: eso es la cola de la reverberación).
5. **Qué se mide de la tira.** Nivel (potencia media del aire) contra el de las vocales (potencia media del aire de los cuadros que cantan en el primer segundo de la frase); duración; hueco entre el final de la tira y el arranque de la voz; el perfil de bandas (potencia de la tira menos el piso de cada banda, relativa a su banda más fuerte) y su centroide; el pico (dónde cae dentro de la tira, cuánto sube y baja) y cuánto baja el final contra el pico.

## Validación y confianza

El problema de fondo: en una grabación en vivo el hueco entre frases nunca está en silencio (público, sala, platillos que Demucs dejó). Un detector de «ruido antes de la voz» encuentra ruido aunque nadie respire. Por eso hay controles:

- **Control de ventana.** La misma búsqueda, con las mismas reglas, en una ventana que termina 0,9 s antes del arranque, sólo en huecos de 2 s o más (ahí no hay quien respire). Da la tasa de falsos positivos. Se compara contra los mismos 212 arranques del coro (los de hueco largo).
- **Control de batería.** Se calcula la correlación del aire de la voz con el de la batería separada (misma ventana, 0,3 s de margen). Si la tira fuera un plato que se coló, subiría y bajaría junto con la batería. En las tiras confiables la correlación es negativa (mediana −0,43, cuartiles −0,65 y −0,17), y las positivas de más de 0,3 se sacaron de las confiables.
- **Planitud.** Mediana 0,15 (ruido: una nota daría menos de 0,05).

Lo que dicen los controles (coro, 212 arranques con hueco de 2 s o más):

| | con aire | de ésas, separadas del arranque | de ésas, «confiables» |
|---|---|---|---|
| Antes del arranque | 51,9 % | 27,4 % | 11,3 % |
| Control (ventana sin respiración) | 27,8 % | 12,7 % | 0,9 % |

«Separada» es que termina 30 ms o más antes de la voz. «Confiable» es: separada, 15 dB o más sobre el piso, y sin seguir a la batería (correlación 0,3 o menos). Una tira pegada al arranque (menos de 30 ms) puede ser una consonante (la s, la ch) y no un soplo: el 23 % de los arranques del coro tiene una, y se dejaron aparte.

Otra prueba, la de la forma: **el perfil de bandas de las tiras de verdad no es el del control.** Las confiables tienen la energía abajo (de 200 a 700 Hz, entre 10 y 16 dB bajo el pico); lo que el control encuentra es ruido que sube hacia los agudos (de 200 a 450 Hz, entre 19 y 22 dB bajo el pico: público y platillos). La respiración tiene cuerpo en los medios; el residuo, no.

**Cuánta confianza:**

- *Que hay respiraciones audibles antes de las frases y que son una fracción menor de las frases:* confianza buena. El exceso sobre el control es de 24 puntos, y no cambia mucho con el umbral (corregida, 33 %, 36 % y 31 % con 5, 8 y 12 dB).
- *El porcentaje:* es un **piso**. Una inhalación más baja que el ruido de sala no se ve. Corregida por falsos positivos: (51,9 − 27,8) / (100 − 27,8) = **33 % de los arranques del coro**. Las «confiables» (seguras, 92 % limpias) son el 10 % de todos los arranques. La verdad está entre 33 % y, quizá, la mitad.
- *Los parámetros:* los de las **confiables** son buenos para el nivel, la duración y el espectro (92 % limpias, pero sólo las más fuertes: el nivel real promedio puede ser unos 2 o 3 dB más bajo). Los de «todas» y «separadas» tienen mezcla de ruido de sala (la mitad de las separadas son falsas, según el control), y salen más flojas y más cortas.
- *La forma de la envolvente:* confianza baja. Los cuadros son de 10 ms con ventana de 40 ms, y el pico cae en cualquier lugar (cuartiles 0,12 a 0,79 de la tira).
- *Los solistas:* son pocos (66 arranques, 21 con tira separada, 11 confiables), y casi no tienen huecos de 2 s para el control (2 pareados). La tasa corregida para ellos tomando la del control del coro (27,8 %) es (56,1 − 27,8) / (100 − 27,8) = 39 %. Con ±12 puntos de error, no se distingue de la del coro.
- *No se pudo oír.* La validación es por números. Quedan en `murga_trabajo/respiraciones/clips/` (los wav no van al repositorio) 6 trozos del coro con respiración, 6 de solistas, y 3 de cada uno sin respiración (voz desde 1,2 s antes del arranque, subida 12 dB) para escucharlos: `python herramientas/respiraciones_medir.py --clips 6`.
- Murgas de mujeres o mixtas entre las del lote (Cayó la Cabra, Doña Bastarda) tienen la misma tasa que las otras (55 y 56 %); la tasa por murga va de 26 % (La Nueva Milonga) a 68 % (Los Diablos Verdes) sin fila clara por año.

## La tabla

Coro (2.662 arranques) y solistas (66), tiras «separadas» y «confiables». Mediana (cuartiles).

| | Coro, confiables (n=271) | Coro, separadas (n=693) | Solista, separadas (n=21) | Una voz, separadas (n=39) |
|---|---|---|---|---|
| Hay aire antes del arranque (todas) | 48,6 % (33 % corregido) | | 56,1 % | 57,4 % |
| Nivel contra las vocales de la frase, dB | −34,0 (−41,0 a −25,9) | −35,7 (−42,7 a −29,1) | −31,7 (−38,8 a −29,1) | −33,4 (−40,3 a −28,0) |
| Duración, ms | 200 (140–320) | 190 (120–320) | 150 (130–260) | 180 (135–315) |
| Hueco hasta la voz, ms | 90 (45–160) | 100 (50–180) | 120 (80–190) | 110 (60–170) |
| Centroide, Hz | 2.080 (1.610–3.500) | 2.000 (1.480–3.020) | 1.980 (1.850–4.290) | 2.530 (1.870–4.370) |
| Pico dentro de la tira (0 a 1) | 0,49 (0,12–0,79) | 0,44 (0,11–0,79) | 0,53 (0,24–0,67) | 0,53 (0,24–0,77) |
| Subida al pico, ms | 70 (20–150) | 60 (20–130) | 80 (50–130) | 90 (50–145) |
| Bajada del pico al corte, ms | 90 (30–190) | 90 (30–190) | 90 (40–120) | 90 (40–155) |
| Final contra el pico, dB | −4,9 (−10,8 a −2,2) | −4,7 (−9,1 a −2,1) | −3,2 (−9,8 a −1,7) | −6,2 (−10,2 a −2,0) |
| Sobre el piso de sala, dB | 21,3 (17,8–27,3) | 14,5 (10,3–21,3) | 17,3 (13,2–21,6) | 17,3 (12,6–23,4) |

Fila de arriba: tasas con todas las tiras de aire (coro: 1.293 de 2.662; solista: 37 de 66; una voz: 66 de 115). De «separadas» sólo son el 26 % (coro), 32 % (solista) y 34 % (una voz) de los arranques.

Perfil de bandas del coro (dB bajo la banda más fuerte; potencia por tercio de octava, mediana):

| Hz | 224 | 281 | 355 | 447 | 561 | 710 | 894 | 1118 | 1414 | 1789 | 2236 | 2806 | 3550 | 4472 | 5612 | 7099 | 8944 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Confiables | −14,4 | −14,1 | −16,4 | −15,2 | −12,1 | −10,3 | −9,6 | −10,5 | −3,6 | −4,3 | −9,1 | −8,4 | −7,5 | −12,6 | −10,5 | −12,9 | −14,2 |
| Separadas | −11,3 | −11,1 | −14,4 | −13,0 | −10,9 | −9,6 | −8,9 | −9,6 | −3,6 | −4,7 | −8,8 | −7,7 | −7,2 | −12,2 | −10,5 | −13,0 | −13,2 |
| Control (no es respiración) | −21,6 | −19,8 | −20,4 | −19,1 | −16,5 | −14,5 | −10,8 | −10,6 | −6,6 | −7,8 | −10,9 | −8,6 | −9,0 | −8,5 | −8,4 | −10,2 | −9,1 |

La curva es ancha: de 560 Hz a 3,5 kHz queda a menos de 10 dB del pico, con una joroba en 1,4–1,8 kHz (6 a 7 dB sobre los vecinos) y caídas parejas hacia abajo (−14 dB) y hacia arriba (−13 dB a 9 kHz). Es potencia por tercio de octava (cada banda con su ancho): un ruido blanco subiría 1 dB por banda, así que esto es más bien un ruido rosa con cuerpo en los medios. Los solistas dan una curva parecida, con la joroba un poco más marcada en 1,8 kHz (−3 dB; n=21, no firme).

## Lo que conviene poner en la síntesis

El nivel es **contra las vocales de la frase que sigue, medidas en la misma banda de 300 Hz a 8 kHz** (potencia media de los cuadros que cantan, primer segundo). Todo es por cantor, salvo lo que diga que es del coro.

| Parámetro | Valor | Rango para repartir entre cantores y frases |
|---|---|---|
| Frases con respiración audible | 35 % de los arranques después de 0,4 s sin cantar (10 % bien fuertes) | subir hasta 50 % si se quiere que se oiga más; con hueco largo (2 s o más) no cambia la tasa |
| Cuándo | Sólo en arranques que siguen a 0,4 s o más sin canto | no hay diferencia clara por largo de hueco (45 % con 0,4–0,7 s, 52 % con 2 s o más: medido con el ruido incluido) |
| Nivel contra las vocales | −33 dB | −42 a −26 dB (cuartiles) |
| Duración | 190 ms | 130 a 320 ms |
| Hueco entre el final del soplo y el inicio de la voz | 90 ms | 40 a 180 ms |
| Envolvente | sube unos 70 ms hasta el pico y baja unos 90 ms; el corte final es ~5 dB bajo el pico: una campana ancha, no una rampa, y sin cola | el pico en 0,1 a 0,8 de la duración |
| Color | ruido filtrado con la curva de la tabla de bandas (confiables); centroide ~2 kHz | suavizar la joroba de 1,4–1,8 kHz a +3 dB si suena a silbido; centroide entre 1,5 y 3,5 kHz |
| Cantores del coro que respiran por frase | 7 de 13 (rango 5 a 9) | ver abajo |
| Dispersión de entradas entre cantores | σ ≈ 80 ms alrededor del promedio de la frase (±150 ms de lado a lado) | ver abajo |

**Cuántos de los 13.** En el coro el nivel del soplo contra las vocales es el de un cantor multiplicado por la fracción que respira (potencias que se suman sin coherencia, con las vocales pasando lo mismo). Medido: coro −35,7 dB, solista −31,7 dB (separadas), o −33,2 contra −31,5 (todas): da una fracción de 0,4 a 0,7, es decir 5 a 9 de 13. Con un solista de sólo 21 casos el error es de ±3 dB: el número es sólo para elegir de dónde partir (7 de 13), no un valor firme. Si en el motor cada cantor ya tiene su nivel propio, usar −32 dB por cantor y que 7 de 13 respiren; si se hace un soplo de coro entero, usar −35 dB.

**Dispersión.** La duración del soplo del coro es mayor que la del solista (190 contra 150–180 ms): la diferencia, como suma en cuadratura, da una dispersión de entradas de unos 90 ms. El hueco hasta la voz no cambia entre coro y solista. Hay que tomarlo como orden de magnitud (60 a 100 ms): sale de la diferencia entre dos medianas de 20 a 40 ms de error.

## Qué no se midió

- A capela contra con instrumentos: las voces separadas no traen el acompañamiento y no hay forma de saber cuál de las frases iba a capela. No se pudo separar.
- Soplos adentro de la frase (entre versos con menos de 0,4 s): no se midieron.
- La respiración por cantor, ni el timbre individual (nasal, boca o nariz): el coro llega mezclado.
- Con otro piso de sala (otro umbral) el porcentaje cambia, pero la corrección no: 33 %, 36 % y 31 % con 5, 8 y 12 dB sobre el piso, y las confiables suben de 10 % a 13 %.
