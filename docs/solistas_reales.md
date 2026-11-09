# Los solistas de verdad

La pregunta: ¿cómo canta un solista de murga? Si se mide en las grabaciones, los valores de nuestros cantores (vibrato, pique, caída, temblor, golpe de voz) se pueden poner con números y no a ojo. Se buscaron en las voces separadas los pasajes donde canta una sola persona, se midieron y se compararon con nuestro solista sintético, cantando las 24 frases de `solista.mjs`.

## De dónde salen

- **Las voces.** Las 85 voces separadas con Demucs (htdemucs_ft) de `murga_trabajo/voces/`: presentaciones, retiradas y canciones finales de 15 murgas, de 2008 a 2026. Son 8,6 horas. La batería ya no está.
- **Casi siempre canta el coro entero.** A veces canta uno solo: la entrada de una retirada, un verso, un recitado.

## Cómo se encuentran (`herramientas/solistas_buscar.py`)

La idea es la de `pureza.py`: trece personas no afinan exacto. Pero hay que medirlo de forma que el vibrato no engañe, porque un solista con vibrato también desparrama los armónicos si se mira una ventana larga.

1. **La altura**, cada 10 ms, con YIN sobre la voz entera (de 75 a 1.000 Hz). Hay voz donde YIN encuentra un período claro.
2. **La coherencia** (rho3): la onda entre 800 Hz y 3 kHz, comparada con ella misma corrida tres períodos, buscando el mejor corrimiento en cada cuadro. Una sola voz se repite casi igual de un período a otro, aunque tenga vibrato: el vibrato cambia el período despacio. En un coro cada cantor está a unos cents del otro, cada uno con su vibrato, y la suma deja de parecerse a sí misma. Un pasaje es candidato si dura 2 s o más y la mediana de rho3 en ventanas de medio segundo pasa 0,62. Se corta donde aparece el coro (0,2 s de cuadros con voz y coherencia baja) o en un silencio de más de 0,4 s.
3. **Cantado o hablado.** Sacando el vibrato (un promedio de 180 ms, un ciclo), cantando la altura se queda quieta en notas; hablando se mueve. Es cantado si al menos el 45 % de los cuadros con voz está en una nota.
4. **La finura de los parciales**, la prueba fuerte. Se remuestrea la onda siguiendo la altura del cantor, cuadro a cuadro y con su vibrato, así todos los períodos duran lo mismo. Después se mira el espectro en bloques de 32 períodos. Una sola voz deja cada armónico en su lugar exacto: la energía cae en ±1 casillero. Dos voces a unos cents una de la otra la desparraman: ±10 cents en el armónico 8 son ±1,5 casilleros. La finura es la energía en ±1 casillero sobre la de ±6, en los armónicos entre 600 Hz y 4 kHz.

Los que se miden son los **estrictos**: cantados, rho3 de 0,75 o más, voz en el 75 % del tiempo o más, coro alrededor en el 5 % o menos, 3 s o más, finura de 0,88 o más (en 8 bloques como mínimo) y como mucho un 20 % del pasaje leído a varias voces por el transcriptor.

**Lo que encontró.** 670 pasajes de una voz (47 minutos): 398 cantados (30 minutos) y 272 hablados o dudosos, que quedan afuera. De los cantados, **208 son estrictos: 20 minutos de 59 tramos y 14 murgas**. No están parejos: La Trasnochada tiene 62, Agarrate Catalina 42, La Nueva Milonga 31, La Gran Muñeca 19, Doña Bastarda 12 y las otras nueve, de 1 a 9. Metele que son Pasteles no tiene ninguno. Los solistas cantan agudo: la mediana es Mi 4 (MIDI 64,3; la mitad de los pasajes, entre Do# 4 y Sol 4), un tono arriba de nuestras frases (Re 4).

Cada pasaje, con sus medidas, está en `murga_trabajo/solistas/segmentos.json`, y para escucharlo, en `murga_trabajo/solistas/clips/` (`<tramo>_<número>_<segundo>s.wav`, mono, 22 kHz). El más claro de cada murga, para escuchar primero:

| Murga | Archivo | Desde, s |
|---|---|---|
| La Nueva Milonga | `la_nueva_milonga_2023_final_y_retirada_17_259s.wav` | 259,5 |
| Patos Cabreros | `patos_cabreros_2026_retirada_15_472s.wav` | 472,3 |
| Agarrate Catalina | `agarrate_catalina_2019_retirada_02_153s.wav` | 153,5 |
| Curtidores de Hongos | `curtidores_de_hongos_2025_presentacion_00_18s.wav` | 17,9 |
| Doña Bastarda | `dona_bastarda_2024_presentacion_01_147s.wav` | 147,4 |
| Falta y Resto | `falta_y_resto_2026_retirada_02_157s.wav` | 156,9 |
| Los Diablos Verdes | `los_diablos_verdes_2026_retirada_08_94s.wav` | 93,5 |
| La Gran Muñeca | `la_gran_muneca_2025_retirada_01_26s.wav` | 25,8 |
| La Trasnochada | `la_trasnochada_2026_cancion_final_05_89s.wav` | 88,8 |
| Cayó la Cabra | `cayo_la_cabra_2025_presentacion_02_154s.wav` | 154,5 |

## Cómo se validó

No hay un oído que haya marcado los solos, así que se probó de cuatro formas. Ninguna es una prueba completa; juntas dicen bastante.

- **El coro seguro.** Los golpes que el transcriptor leyó con dos o más notas distintas (no octavas) son, casi seguro, el coro. De 45.812, caen adentro de algún pasaje 698 (1,5 %). En los estrictos, la mediana del pasaje tapado por esos golpes es 0 %, y el 90 % tiene menos del 11 %. En los tramos que se miraron de cerca (la entrada a capela de La Trasnochada 2020, la retirada de Agarrate Catalina 2008), en los acordes YIN casi no encuentra un período: el coro a varias voces ni siquiera llega a ser candidato.
- **Un cruce con `pureza.py`.** De los golpes de una sola nota, el 33 % cae en un pasaje de una voz. `pureza.py`, con otra cuenta (la energía pegada a los parciales en golpes de 0,74 s), había estimado que el 33,7 % de esos golpes eran de solista. Es casualidad que den tan parecido, pero las dos cuentas cuentan la misma historia.
- **El estéreo.** No se usa para decidir. Un solista con su micrófono suena en el medio; el coro, tomado por varios micrófonos, se abre. En los 19 tramos donde el estéreo dice algo (el coro con correlación entre canales menor a 0,97), los cuadros de solista se parecen más entre canales que los de coro en los 19: 0,958 contra 0,881 de mediana.
- **Coros artificiales.** Se tomaron 113 candidatos (hasta dos por tramo) y se les sumaron copias del mismo pasaje, cada una desafinada al azar, con una deriva lenta y corrida hasta 30 ms. Es la prueba más dura posible: las copias tienen el mismo vibrato y las mismas consonantes, cosa que dos personas nunca tienen. Qué parte pasa la finura:

| | Una voz (el original) | 2 voces a ±10 cents | 3 a ±15 | 6 a ±15 | 12 a ±20 |
|---|---|---|---|---|---|
| Finura, mediana | 0,96 | 0,88 | 0,82 | 0,77 | 0,71 |
| Pasan con 0,88 (como quedó) | 95 % | 50 % | 22 % | 10 % | 1 % |
| Pasan con 0,95 | 59 % | 13 % | 3 % | 0 % | 0 % |

  Con la segunda voz, la finura baja en los 113. La coherencia sola (rho3) separaba mucho menos: con 12 copias a ±20 cents quedaba en 0,65 de mediana, arriba del umbral.

**Lo que queda dudoso:** dos personas cantando muy juntas (un dúo al unísono, o el solista doblado por otro de su cuerda) pueden pasar como una. Por eso todo se midió también con finura de 0,95 o más (127 pasajes): los números casi no cambian (ver abajo). Además Cayó la Cabra y Doña Bastarda son, si no me equivoco, murgas de mujeres (conviene confirmarlo de oído); sin ellas tampoco cambia nada.

## Cómo se mide (`herramientas/solistas_medir.mjs`)

Con WORLD (`motor/cantor/world.js`), a 22 kHz y cada 5 ms. Las notas salen de la altura, sin partitura: tramos donde la altura sin vibrato se queda quieta, cortados donde la voz se interrumpe o donde hay un pozo de volumen de 6 dB (dos sílabas en la misma nota, con una m o una l en el medio).

- **La altura** con Harvest. Harvest le pone altura casi a todo, así que hay voz donde además D4C dice que abajo de 1 kHz la onda es periódica.
- **El temblor** con DIO. Harvest alisa la altura y se come el temblor rápido: el difonos de calibración, con temblor 0,15, da 1,2 cents con Harvest y 4,7 con DIO.
- **Vibrato:** en las notas de 450 ms o más. Se le saca a la altura un promedio de 200 ms y queda el vibrato. La velocidad sale de la autocorrelación (de 3 a 9 Hz). La amplitud es la mitad de cada subida o bajada, en ± cents, y es lo mismo que el `vibrato` de `guion()` × 100. Entra cuando dos medios ciclos seguidos llegan a la mitad de la amplitud de la nota, contado desde que empieza la nota. Hay vibrato si es regular (autocorrelación de 0,25 o más), entre 3,5 y 8,5 Hz, y de ±10 cents o más.
- **Pique:** en las notas después de un silencio (100 ms sin voz), la diferencia entre la nota y el comienzo (la mediana de 10 a 30 ms después de que aparece la voz: los primeros períodos suelen ser irregulares), y cuánto tarda en quedar a 20 cents. Más de una octava se toma por un error y no cuenta.
- **Portamento:** en los saltos de 80 cents o más sin cortar la voz, el tiempo del 10 al 90 % del salto, la forma y cuánto se pasa. A través de una consonante: qué parte del salto falta cuando vuelve la voz, y cuánto tarda en llegar.
- **Temblor:** lo que queda sacando una parábola de 45 ms (deja pasar la nota y el vibrato), en cents RMS. **Deriva:** cuánto se mueve la nota sin vibrato en las notas largas, sacando la recta.
- **Volumen:** el ataque después de un silencio y el de cada sílaba (del 10 al 90 %), la pendiente de las notas de 600 ms o más, y el contraste entre las notas de cada frase.
- **Caída final:** en la última nota de cada frase (después vienen 200 ms sin voz y 12 dB abajo; con 20 dB casi no había, por la cola de la sala), la nota contra lo último que suena (D4C da por sorda la cola que se apaga: ahí se sigue con la altura de Harvest).
- **Timbre**, en las vocales sostenidas: H1−H2, el brillo (arriba de 1,8 kHz frente al total), el centroide entre 250 Hz y 1,6 kHz (una pista del primer formante) y el aire (la aperiodicidad de D4C entre 1 y 4 kHz). Como los solistas cantan más agudo que nuestras frases, se da también en el mismo registro: Sol 3 a Mi 4.
- **Consonantes:** los pozos de volumen adentro de las frases (3 dB o más frente a lo más fuerte de los 150 ms de cada lado): hondura y ancho a media hondura. Además, cuánto tiempo hay voz dentro de la frase y cuánto queda 15 dB abajo.

**La medida, probada.** Con tonos armados a mano (vibrato de ±15, 40 y 80 cents a 5,5 Hz, que entra a los 0,3 s en 0,3 s), da ±15, ±40,8 y ±81,8 cents, 5,6 Hz, y entra a los 462 ms (la mitad de la amplitud llega a los 450 ms). Con el difonos de siempre (vibrato 0,14 a 5,5 Hz): ±13,3 cents a 5,7 Hz. El portamento de `guion()` (del ataque a 30 ms después del comienzo de la vocal, con forma de coseno) da 60 ms, que es lo que tiene que dar.

**Cuánto rinde cada valor de `guion()`.** Con las 24 frases, lo que se pide y lo que se mide no siempre es lo mismo:

| Valor | Se pide | Se mide |
|---|---|---|
| vibrato (difonos) | 0,14 / 0,40 | ±13,3 / ±28,5 cents: MBROLA se come parte de un vibrato ancho |
| vibrato (bancos, WORLD) | 0,14 | ±12,7 (MIKE) y ±14,8 (Ottava) |
| vibEntra | 0,22 s (y 0,3 s de entrada) | entra a los 440 ms en difonos y a los 360 a 390 en los bancos: unos 0,2 s más |
| temblor (difonos) | 0 / 0,04 / 0,15 | 3,7 / 3,8 / 4,7 cents (la voz de MBROLA ya tiembla 3,7) |
| deriva (difonos) | 0,05 / 0,15 | 3,3 / 4,9 cents |
| pique (difonos) | 0,45 | 27 cents: cuando empieza la vocal ya pasó buena parte |
| caida (difonos) | 0,8 / 1,5 | 46 / 90 cents |

## Real contra sintético

Lo real es la mediana de los 208 pasajes y, entre paréntesis, los cuartiles (la mitad de los casos está entre esos dos). «Murgas» es la mediana de las medianas de cada murga con 3 pasajes o más (cada murga pesa igual), y entre corchetes la menor y la mayor. Los sintéticos son las 24 frases de `solista.mjs`: difonos es2 tal como lo canta `solista.mjs` (los valores de `guion()` por defecto), difonos «como en la página» (temblor 0,04, golpe 3, arco 1, consonantes 1,1, brillo 0,6, grito 0,6) y los bancos MIKE (sin su falsete) y Vincen-oto Ottava con los valores por defecto. La tabla entera, con todo, en `murga_trabajo/solistas/tabla.md`.

| Medida | Real | Murgas | Difonos es2 | Difonos «página» | MIKE | Ottava |
|---|---|---|---|---|---|---|
| Altura (MIDI) | 64,3 (61,3–66,6) | 65,1 | 62 | 62 | 61 | 61,9 |
| Notas largas con vibrato | 63 % | 59 % | 37 % | 56 % | 44 % | 47 % |
| **Vibrato, ± cents** | **40 (26–55)** | 37,5 [12…49] | 13,3 | 13,5 | 12,7 | 14,8 |
| Vibrato, Hz | 5,2 (4,8–5,7) | 5,1 | 5,7 | 5,6 | 5,5 | 5,1 |
| **Vibrato: entra a los, ms** | **260 (179–394)** | 241 | 443 | 395 | 390 | 358 |
| **Pique al entrar, cents** | **219 (34–499)** | 206 | 27 | 32 | 22 | −49 |
| Pique: llega a la nota en, ms | 80 (43–175) | 60 | 20 | 10 | 50 | 25 |
| Portamento ligado, ms | 50 (30–115) | 50 | 60 (55–70) | 60 | 40 | 45 |
| **Portamento: se pasa, cents** | **34 (15–72)** | 34 | 1 | 2 | 22 | 22 |
| Consonante en el medio: falta al volver la voz | 22 % | 27 % | 15 % | 11 % | 25 % | 19 % |
| Temblor rápido, cents RMS | 4,1 (2,9–5,9) | 4,0 | 3,7 | 3,8 | 2,1 | 2,6 |
| **Deriva en notas largas, cents RMS** | **7,6 (5,1–11,3)** | 7,7 | 3,3 | 3,0 | 2,9 | 4,7 |
| Ataque después de un silencio, ms | 55 (30–91) | 55 | 70 | 60 | 65 | 75 |
| **Ataque de sílaba, ms** | **35 (20–65)** | 38 | 55 | 45 | 50 | 70 |
| Notas largas, dB/s | −0,7 (−2,3–0,1) | −0,7 | −0,3 | −1,6 | +1,8 | +0,9 |
| Contraste entre notas, dB | 2,2 | 2,4 | 2,4 | 2,7 | 1,8 | 1,8 |
| **Caída final, cents** | **239 (21–526)** | 270 | 46 | 52 | 150 | 28 |
| Caída final, ms | 70 (5–120) | 65 | 38 | 38 | 60 | 18 |
| Finales que caen más de 50 cents | 68 % | — | 38 % | 54 % | 100 % | 0 % |
| Volumen en los últimos 150 ms, dB menos | 12,4 | 12,7 | 25,3 | 23,7 | 35,0 | 31,8 |
| Tiempo 15 dB abajo dentro de la frase | 4,5 % | 4,4 % | 8,2 % | 7,0 % | 6,0 % | 7,2 % |
| Largo de las notas, ms | 380 (225–650) | 379 | 305 | 315 | 320 | 325 |
| **Pozo de consonante, dB** | **7,3 (4,4–12,7)** | 7,2 | 13,8 | 8,8 | 12,3 | 14,4 |
| Pozo de consonante, ms | 65 (40–100) | 70 | 55 | 55 | 55 | 60 |
| Tramo sin voz dentro de la frase, ms | 65 (30–105) | 65 | 40 | 40 | 45 | 40 |
| En Sol 3–Mi 4: H1−H2, dB | −3,8 | −5,0 | +0,5 | −2,0 | −3,5 | −5,6 |
| En Sol 3–Mi 4: brillo, dB | −10,7 | −8,0 [−24…−3] | −9,4 | −12,2 | −11,6 | −12,9 |
| En Sol 3–Mi 4: centroide, Hz | 651 | 696 | 659 | 647 | 703 | 674 |
| En Sol 3–Mi 4: aire, dB | −9,2 | −9,2 | −9,7 | −9,6 | −12,8 | −13,8 |

**Si se cambia la muestra, los números casi no se mueven.** Con finura de 0,95 o más (127 pasajes, donde un dúo pasa sólo el 13 % de las veces): vibrato ±37,6 cents a 5,1 Hz, entra a los 255 ms, temblor 3,8, deriva 6,9, portamento 50 ms y se pasa 32,5 cents, pique 202 cents, caída 279 cents. Sin las murgas de mujeres: ±40,2 cents, 5,2 Hz, 268 ms. Sin La Trasnochada (la que más pasajes tiene): ±39,2 cents, 5,1 Hz, 225 ms. Sólo los pasajes en Sol 3–Mi 4 (109): ±41,7 cents, 5,3 Hz, 276 ms.

**Por murga**, lo principal (las que tienen pocos pasajes dicen poco):

| Murga | Pasajes | Vibrato Hz | ± cents | Entra, ms | Portamento, ms | Temblor | H1−H2 | Brillo | Altura |
|---|---|---|---|---|---|---|---|---|---|
| La Trasnochada | 62 | 5,5 | 41,6 | 303 | 50 | 4,1 | −4,9 | −15,9 | 62 |
| Agarrate Catalina | 42 | 5,1 | 37,5 | 241 | 50 | 4,4 | −9,8 | −5,9 | 65,5 |
| La Nueva Milonga | 31 | 5,1 | 47,7 | 233 | 45 | 3,9 | −11,8 | −6,6 | 65,2 |
| La Gran Muñeca | 19 | 5,2 | 40,2 | 260 | 60 | 4,0 | −9,3 | −6,8 | 65,4 |
| Doña Bastarda | 12 | 5,1 | 44,4 | 195 | 40 | 3,7 | −11,7 | −6,4 | 65,9 |
| Los Diablos Verdes | 9 | 5,1 | 48,6 | 160 | 50 | 4,6 | 1,1 | −20,0 | 64,7 |
| Cayó la Cabra | 7 | 5,0 | 28,7 | 176 | 65 | 5,0 | −4,2 | −5,7 | 61 |
| Patos Cabreros | 7 | 5,3 | 32,0 | 225 | 50 | 3,5 | −14,9 | −6,2 | 67 |
| Asaltantes con Patente | 6 | 3,8 | 13,3 | 308 | 73 | 4,9 | −9,3 | −4,7 | 64,9 |

El vibrato ancho y lento, que entra temprano, está en casi todas. El brillo cambia 15 dB de una murga a otra: eso es la grabación (micrófonos, transmisión), no la voz.

## Lo que dicen los números

- **El vibrato es lo que más falta.** Los solistas vibran ±40 cents a 5,2 Hz; los nuestros, ±13 a 5,5 o 5,7. Es tres veces más ancho, un poco más lento, y entra antes: a los 260 ms de empezada la nota, contra 390 a 440.
- **Entran de abajo, mucho.** Después de un silencio, la voz arranca unos 2 semitonos abajo (mediana 219 cents) y llega a la nota en 80 ms. Los nuestros arrancan 30 cents abajo y llegan en 10 a 20 ms. Son sólo 47 entradas y varían mucho (un cuarto, menos de 34 cents; otro cuarto, más de 5 semitonos): es una costumbre fuerte, no una regla.
- **Se pasan de la nota.** El portamento dura lo mismo que el nuestro (50 contra 60 ms), pero al llegar se pasan 34 cents y vuelven. El de difonos llega clavado (1 o 2 cents). Parte de eso puede ser el vibrato que arranca, pero aun así es mucho más que lo nuestro.
- **La nota se mueve.** Sin el vibrato, la altura de una nota larga se mueve 7,6 cents (RMS); la nuestra, 3. El temblor rápido es parecido (4,1 contra 3,7 en difonos), pero los bancos son más quietos (2,1 a 2,6).
- **Las sílabas atacan más rápido y se cortan menos.** El ataque de cada sílaba es de 35 ms, contra 45 a 70. El pozo de cada consonante es de 7 dB, contra 12 a 14 (8,8 con el grito de la página), y un poco más ancho (65 contra 55 ms). La voz queda 15 dB abajo un 4,5 % del tiempo de la frase, contra 6 a 8 %: lo mismo que se había visto en el coro (3 contra 9 %).
- **Las notas largas no crecen.** Los solistas bajan un poco (−0,7 dB/s). `guion()` les suma 1,5 dB a las notas de más de 0,5 s, y en los bancos se nota: +0,9 y +1,8 dB/s.
- **Al final de la frase caen más y se apagan más despacio.** Dos de cada tres finales caen más de 50 cents (mediana 239 cents en 70 ms); en difonos, 46 cents. Y en los últimos 150 ms el volumen baja 12 dB, contra 24 a 35 en los nuestros. Son sólo 19 finales, y la sala del teatro estira la cola.
- **El timbre, en el mismo registro, anda cerca.** H1−H2 da −3,8 dB en lo real, −3,5 en MIKE y −5,6 en Ottava; difonos sin gritar tiene demasiada fundamental (+0,5) y con el grito de la página baja a −2,0. El centroide (el primer formante) está en 650 a 700 Hz en todos. Los bancos son un poco oscuros (brillo −11,6 y −12,9 contra −10,7, y −8 en la mediana de las murgas) y demasiado limpios: su aperiodicidad está 4 dB abajo de la real (−12,8 y −13,8 contra −9,2). Difonos tiene la misma que lo real.

## Valores propuestos

No se tocó nada de `motor/`. Lo que sigue es para probar, y para juzgar de oído y con el banco del coro.

| Valor | Ahora | Propuesto | Por qué |
|---|---|---|---|
| `vibrato` (bancos) | 0,14 (página: 0,12–0,30) | **0,40** (cada cantor entre 0,25 y 0,55) | lo real es ±40 (26–55); en los bancos lo pedido sale casi igual |
| `vibrato` (difonos) | 0,14 (página: 0,09–0,24) | **0,6** para el solista, a verificar | MBROLA rinde menos: 0,40 da ±28,5. Medir con `solistas_medir.mjs` hasta que dé ±35–40 |
| `vibVel` | 5,5 (página: 4,8–6,2) | **5,2** (cada cantor entre 4,8 y 5,7) | 5,2 Hz (4,8–5,7) |
| `vibEntra` | 0,22 s (página: 0,15–0,4) | **0,05 s** (entre 0 y 0,15), con la entrada de 0,3 s | entra a los 260 ms (179–394); lo nuestro llega unos 0,2 s después de `vibEntra` |
| `pique` | 0,45 | **1,5** (cada cantor entre 0,5 y 3), y que dure más: que siga hasta unos 0,1 s después de empezar la vocal (hoy termina a los 0,08 s del golpe) | arrancan 219 cents abajo y llegan en 80 ms; con 0,45 se ven 27 cents en 10–20 ms |
| un «pasarse» nuevo en el portamento | no hay | **20 a 30 cents** más allá de la nota de llegada, que vuelven en unos 100 ms | se pasan 34 cents (15–72); difonos, 1 o 2 |
| `deriva` | 0,05 | **0,2** | 7,6 cents contra 3,3; con 0,15 se miden 4,9, y la cuenta da 0,2 a 0,27 |
| `temblor` (difonos) | 0 (página: 0,04) | **0,05** | la voz de MBROLA ya tiembla casi como la real (3,7 contra 4,1) |
| `temblor` (bancos) | 0 (`VARIACION_BANCO`: 0,08 con `modulacion` 1,5) | **0,15**, o lo de `VARIACION_BANCO` si medido llega a 4 cents | los bancos tiemblan 2,1–2,6 contra 4,1; 0,15 de temblor suma unos 3 cents |
| `golpe` | 0 (página: 3) | **4** | ataque de sílaba de 35 ms; sin golpe 55, con golpe 3, 45 |
| el crecer de las notas largas (+1,5 dB en `ganancia`) | +1,5 dB | **0** (o −0,5) | lo real baja 0,7 dB/s; los bancos suben 0,9 y 1,8 |
| el final de la frase (−12 dB en 0,12 s) | — | **−12 dB en 0,25 s** | lo real baja 12 dB en 150 ms; los nuestros, 24 a 35 |
| `caida` | 0,8 | **1,5** (cada cantor entre 0 y 3), en dos de cada tres finales, en unos 0,25 s | caen 239 cents en 70 ms, el 68 % más de 50; con 0,8 se ven 46 cents en 38 ms |
| `consonantes` | 1 (página: 1,1) | **1,2** | pozos de 65 ms y tramos sin voz de 65 ms, contra 55 y 40; además, con 1,2 se entendía más (3,7 % de letras mal) |
| pozos de las consonantes en los bancos | sin grito (`GRITO_BANCO` 0) | lo «parejo» de `esforzar()` (o grito 0,5) | pozos de 7 dB contra 12–14; con el grito de la página, difonos baja a 8,8 |
| `grito` (difonos, solista) | 0,6 en la página | **0,8 a 1** | H1−H2 −3,8 real; sin grito +0,5, con 0,6 −2,0 |
| `brillo` (difonos) | 0,6 | **0,8** | con 0,6 y grito queda −12,2 dB contra −10,7 |
| `tension` (bancos) | 0 | **0,25** | brillo −11,6 y −12,9 contra −10,7 (−8 en la mediana de las murgas); 0,25 son 1 dB por octava arriba de 1 kHz |
| `aire` (bancos) | 0 | **0,05 a 0,1**, con cuidado | aperiodicidad −12,8 y −13,8 contra −9,2. Pero la sala y Demucs ensucian lo real, y en difonos el aire hacía entender mucho menos |
| `ronquera` (bancos) | 0 | **0** | el temblor real es de 4 cents: no hay voz rajada para copiar (ronquera 1 hace temblar ±3,5 %, unos 60 cents) |
| `esfuerzo` (bancos) | 0 | sin datos | esto no lo mide |

## Cuidado con

- **Demucs.** Deja pedacitos del coro y de los platillos, y ensucia la onda: sube la aperiodicidad y el temblor medidos, y puede ablandar los ataques. Lo real tiembla, como mucho, lo que dice la tabla.
- **La sala.** El Teatro de Verano y los tablados rebotan: la cola llena los pozos de las consonantes (que en seco serían más hondos), estira el final de las frases y sube el aire. Esas tres medidas son, para lo real, un techo o un piso, no el valor exacto.
- **El micrófono y la transmisión.** El brillo cambia 15 dB entre murgas. Por eso el timbre no se debería ajustar fino con esto: sirve la dirección (los bancos, un poco más brillantes y menos limpios), no el decimal.
- **El registro.** Los solistas cantan un tono más agudo que nuestras frases, y muchos llegan a Sol 4 y La 4. El timbre se comparó también en Sol 3–Mi 4; lo de altura (vibrato, pique, portamento) casi no cambia con el registro (ver arriba).
- **Pocos casos en las entradas y los finales.** 47 entradas después de un silencio y 19 finales de frase, con mucha dispersión. El vibrato (258 notas), el portamento (934 saltos) y el temblor (1.005 notas) son firmes.
- **Dúos.** Dos personas muy juntas pueden pasar como una (ver la validación). Con la muestra más estricta los números son los mismos.
- **Los sintéticos se cantaron con `motor/` como estaba a las 3:30 de esta noche**, y con `solista.mjs`, que no usa `cantorDifonos()` ni `VARIACION_BANCO`. El difonos «como en la página» es una aproximación con valores fijos.
- **Las notas sin partitura.** Salen de la altura, así que dos sílabas en la misma nota pegadas con una consonante sonora a veces quedan como una sola. Les pasa igual a lo real y a lo sintético.

## Para repetirlo

```
set TEMP=D:\tmp\murga & set PYTHONUTF8=1
D:\uv\murga\Scripts\python.exe herramientas/solistas_buscar.py --validar --clips      (la primera vez, unos 25 min)
node herramientas/solista.mjs --motor difonos:es2 --salida murga_trabajo/solistas/sinteticos/difonos_es2
node herramientas/solista.mjs --motor banco --banco "MIKE.zip" --evitar _F --salida murga_trabajo/solistas/sinteticos/banco_mike
node herramientas/solistas_medir.mjs                                                   (los 208 pasajes, unos 10 min)
node herramientas/solistas_medir.mjs --sintetico murga_trabajo/solistas/sinteticos/difonos_es2 --nombre difonos_es2
node herramientas/solistas_medir.mjs --tabla
```

`solistas_buscar.py` guarda las medidas de cada cuadro en `murga_trabajo/solistas/cuadros/`: con eso, cambiar un umbral tarda segundos (`--umbral`, `--finura`), menos la finura, que vuelve a leer las voces. Para probar un valor nuevo, se canta el solista con ese valor (`--motor difonos:es2:vibrato=.6`) y se mide: la columna aparece sola en la tabla.
