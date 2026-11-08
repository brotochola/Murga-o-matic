# Un cantor que se entienda

La pregunta: ¿se puede tener un cantor sintético al que se le entienda lo que dice, que no suene tan robótico y que cante más ligado? Se empezó por un cantor solo.

## Cómo se midió

- **Las frases.** Son 24 frases nuestras, que no son letras de murga: «Llegó el carnaval con su bombo y platillo», «Una gaviota cruzaba la rambla»… Se cantan con una melodía simple en Sol mayor, en el registro de un tenor (Sol 3 a Fa# 4): una sílaba por corchea a 100 BPM y la última larga. Lo arma `herramientas/solista.mjs`.
- **El jurado.** Whisper small (sherpa-onnx) transcribe cada frase sin saber el texto, y se cuenta qué parte de las letras sale mal (CER). Cada frase pesa igual y cuenta como mucho 100 %: a veces Whisper alucina con las vocales largas ("siiiii…"). Lo corre `herramientas/solista_jurado.py`.
- **Whisper queda afuera.** Es una red neuronal, pero hace de jurado, como en el banco del coro. Adentro del generador no hay redes neuronales.
- **El ruido de la medida.** Con 24 frases, una diferencia de 1 o 2 puntos es ruido.

| Cantor | Letras mal | Palabras mal |
|---|---|---|
| Formantes (el de los trece cantores sintéticos) | 52,9 % | 87,0 % |
| Difonos, voz es2 | 6,6 % | 20,6 % |
| Difonos es2, con las eses suaves y aspiradas | 6,5 % | 22,2 % |
| Difonos es2, como en la página (consonantes ×1,1, temblor, vibrato 0,2, emisión, eses suaves) | 8,5 % | 25,8 % |
| Lo mismo, con las eses de antes | 7,1 % | 21,1 % |
| Difonos es2, consonantes ×1,2 | 3,7 % | 12,5 % |
| Difonos es2, consonantes ×0,8 (con 12 frases) | 9,4 % | 22,0 % |
| Difonos es2, con aire (ruido que sigue a la voz) | 16,4 % | 32,3 % |
| Difonos, voz es1 | 8,4 % | 30,7 % |
| Difonos, voz es4 | 16,2 % | 35,1 % |
| Para comparar: espeak hablando (12 frases) | 10,2 % | 27,5 % |

## Por qué no se entiende el de formantes

Arma cada sonido con valores fijos de formantes y pasa al siguiente con un suavizado de 18 ms, igual para todos. En el espectrograma se ven bloques. En el habla real, una consonante se reconoce sobre todo por cómo se mueven los formantes al entrar a la vocal (/b/ sube, /d/ va hacia 1.800 Hz, /g/ junta F2 y F3), y eso le falta. Whisper oye, por ejemplo, «Llevo el alabado su amor la hízo» donde dice «Llegó el carnaval con su bombo y platillo».

Arreglarlo es posible: transiciones con loci por consonante, ráfagas y fricativas mejor hechas. Pero es mucho trabajo y no está claro hasta dónde llega. Los sintetizadores de formantes que mejor se entienden, como DECtalk, se siguen oyendo robóticos.

## Difonos

[MBROLA](https://github.com/numediart/MBROLA) es un sintetizador de los años 90, sin redes neuronales. Pega pedacitos de voz grabada, llamados difonos, y les cambia la altura y la duración con PSOLA. Cada difono va de la mitad de un sonido a la mitad del siguiente, así que cada transición entre consonante y vocal es de una persona real.

Las voces castellanas son es1, es2 y es4, las tres de hombre. La es2 se entiende mejor y está grabada a 22 kHz. Las otras dos, a 16 kHz.

Lo que se canta lo decide `motor/cantor/difonos.js`:

- **Duraciones.** Las consonantes del ataque se cantan antes del tiempo, así la vocal cae en el golpe. Duran menos que habladas, y la vocal se lleva la nota, como en el canto ligado. Más cortas se entienden menos (×0,8: 9,4 %) y más largas se entienden más (×1,2: 3,7 %). En la página quedó ×1,1.
- **Altura.** El portamento entre notas va durante la consonante. A eso se suman un vibrato que entra de a poco en las notas largas, una deriva lenta y un temblor rápido, chico. Además, cada frase arranca con un pique desde abajo y termina con una caída.
- **Volumen.** Cada nota suena con su fuerza, las largas crecen un poco y el final de frase se apaga.
- **Emisión.** Más presencia en 2-4 kHz, menos graves y un poco de saturación. No cambia lo que se entiende.
- **Aire.** Un ruido que sigue a la voz empeora mucho lo que se entiende (16,4 %), así que quedó afuera.
- **Eses.** Las de es2 son castellanas: largas (70 ms), fuertes (de 6 a 13 dB debajo de la vocal) y con el silbido en 5 kHz. Con el acento rioplatense exagerado, como el de un murguista:
  - la s del final de la palabra no se canta antes de consonante ni al final de la frase: «lo gurise corren descalzo»;
  - antes de vocal sí se oye, suave y pegada a la palabra siguiente: «la-salas», «mi-samigo-sehperan», «lu-ce-s y empieza»;
  - en los artículos (los, las, unos, unas) antes de consonante queda un soplo: «lah luce»;
  - la de adentro de la palabra se aspira: «fiehta», «dehcalzo». Dura 25 ms, sin agudos, unos 27 dB debajo de la vocal;
  - las demás duran 50 ms y van 8 dB más bajas, sin filtrar. Primero se probaron de 35 ms y sin lo de arriba de 4 kHz, pero así sonaban a t y a chasquido, y se entendían menos (ver «Primero hablar, después cantar»). Entre las tres versiones, de oído ganó esta.

  - la ll y la y suenan "sh", como en el Río de la Plata: «shegué a la cashe cuando la shuvia sha se iba». Estas voces no tienen ese sonido, así que se canta la ll castellana (jj), que ya va hacia el paladar. Después se le deja poca voz, abajo de 900 Hz, y se le suma un soplo entre 2 y 4 kHz, con el pico en 2,5 kHz, unos 10 dB debajo de la vocal. Se probó también armarla desde la s, pero Whisper oía "platizo" y "suvia": las transiciones de la s la delatan. Con la ll castellana entiende «llegó», «platillo», «calle» y «parrilla».

  Whisper erra el 10,1 % de las letras, contra el 8,5 % de antes. La diferencia son casi todas eses finales que no escribe («Juntamos la moneda para el colectivo»): es el acento, no que no se entienda.

## Cada cuerda

`cantorDifonos(tipo, semilla)` arma un cantor de cada cuerda:

- **Tracto.** Cada cuerda tiene su largo de tracto: los formantes se multiplican por 0,90 en los bajos, 0,95 en los segundos, 1 en los primos y la tercia, y 1,03 en los sobreprimos. La tercia canta muy agudo, y con un tracto más corto sonaba chillona. Se hace como con una cinta: MBROLA canta más agudo y más largo, y las muestras se tocan más rápido.
- **Mañas.** Cada cantor tiene las suyas, chicas y como en `variacion.js`: ±3 % de garganta, su afinación, su vibrato, cuánto pica al entrar y cuánto alarga las consonantes.

`herramientas/voces_difonos.mjs "frase"` canta la misma frase con cantores de cada cuerda, cada uno en su registro.

## El coro entero

`herramientas/coro_difonos.mjs` canta las mismas 24 frases con un coro de 12 cantores: primos con la melodía, segundos una tercera abajo, sobreprimos una tercera arriba y bajos una octava abajo. Las cantidades, los volúmenes y el cantor que lleva la cuerda son los de `coro.js`.

| Coro | Letras mal | Palabras mal |
|---|---|---|
| Formantes | 44,5 % | 83,0 % |
| Difonos, con los corrimientos del coro de formantes (cada cantor entra hasta 8 ms tarde y cada nota se corre ±16 ms) | 19,0 % | 46,4 % |
| Difonos, con la mitad de corrimiento (como quedó) | 12,9 % | 37,5 % |
| Difonos, todos juntos al milisegundo | 11,9 % | 29,5 % |

Que los cantores no entren todos juntos es lo que más tapa la letra: cada consonante suena corrida trece veces. Con la mitad de corrimiento se entiende casi como con todos juntos, y el coro no queda clavado.

Para que MBROLA no tenga que cantar minutos de silencio, que lo hacen fallar, cada cantor se canta de a frases: se corta donde hay más de 1,5 s sin notas.

## El timbre, medido

La curva de ecualización del coro de formantes (`CURVA`) salió de comparar ese coro con la entrada a capela de La Trasnochada 2020: con esa curva, el coro de formantes tiene el timbre del coro real. `herramientas/curva_difonos.py` canta esas mismas notas (`banco_sintetizar.mjs --motor difonos`) con los dos coros y compara sus espectros promedio de vocales. Hace tres vueltas de corrección y escribe `CURVA_DIFONOS` en `motor/cantor/timbre.js`. No hace falta el audio real: el puente es la curva de formantes.

- **El coro de difonos crudo es mucho más oscuro que el real:** tiene de 15 a 28 dB menos entre 2 y 8 kHz. El brillo de la voz murguera no está en estas voces de habla.
- **Con la curva**, el error medio es de 2 dB, contra 11,6 dB sin ella. Abajo de 140 Hz la curva sube como mucho 12 dB, para que no retumbe; arriba no pasa de 24.
- **Las eses no pasan por la curva:** se toman de antes de ecualizar y se filtran aparte. Si no, la curva las subiría 20 dB.
- **Se entiende un poco menos con la curva entera:** con el coro, Whisper erra el 15,6 % de las letras. Con la curva al 60 % erra el 12,4 %, y sin curva el 13,5 %; la diferencia entre estos dos es ruido. Quedó al 60 % (`brillo: .6` en `cantorDifonos`), en lugar de la «emisión» puesta a ojo.

## Que el unísono suene a coro

Todos los cantores salían de la misma voz grabada. Para medir cuánto se parecen, se cantan cuatro primos al unísono y se calcula la correlación entre cada par, en ventanas de 100 ms y con el mejor corrimiento de ±25 ms. Cerca de 1 es una misma voz con eco.

| Cuatro primos al unísono | Correlación media entre cantores |
|---|---|
| Formantes | 0,74 |
| Difonos, todos con es2, garganta ±3 % | 0,90 |
| Garganta ±6 % | 0,86 |
| Color propio de cada cantor, ±4 dB | 0,86 |
| Garganta ±6 % y color | 0,82 |
| Uno de cada dos con la voz es1 | 0,55 |
| es1, garganta y color juntos | 0,47 |

Otra voz es lo que más diferencia, porque es otro hombre.

**Los primos todavía sonaban demasiado iguales** (lo oíste vos). Ahora, en cada cuerda:

- **Voces:** el que la lleva canta con es2, el segundo con es1, el tercero con es4 (Valladolid) y el cuarto primo otra vez con es1.
- **Gargantas repartidas:** el que lleva la cuerda en el medio, y los demás 7 % más grande, 6 % más chica, 11 % más grande y 10 % más chica, ±2 % al azar.
- **Color y brillo:** cada uno con su color propio de ±5 dB, y con más o menos brillo, ±2 dB por octava arriba de 1 kHz.
- **Curvas:** es1 y es4 tienen su propia curva de timbre (`CURVA_DIFONOS_ES1`, `CURVA_DIFONOS_ES4`).

| Cuatro primos al unísono | Correlación media entre cantores |
|---|---|
| es2 y es1, garganta ±5 % y color ±3 dB (lo de antes) | 0,58 |
| es2 y es1, gargantas repartidas, color ±5 dB y brillo | 0,53 |
| es2, es1 y es4, gargantas repartidas, color y brillo (como quedó) | 0,29 |

Con el coro de 12 voces se entiende un poco menos. Como el azar de cada cantor mueve el resultado ±2 puntos, se midió con tres coros distintos (semillas 7, 11 y 23):

| Coro | Letras mal (media de tres coros) |
|---|---|
| es2 y es1, lo de antes | 14,8 % |
| es2, es1 y es4, como quedó | 16,5 % |
| es2, es1 y es4, con la mitad de reparto de gargantas | 16,2 % |

## Acentos

Las sílabas acentuadas entran con un golpe de voz: 3 dB de más al entrar, que se van en 60 ms, y 1,5 dB que quedan. Las demás van un poco más suaves, y cada frase crece 1 dB hasta su último acento. Sin letra (en el banco del coro), se acentúa lo que cae en el tiempo.

Para medirlo se rearmaron acá los 12 fragmentos del banco nocturno (las mismas ventanas que elige `banco_fragmentos.py`), cantados por el coro de difonos. El ataque de cada golpe (la subida del 10 al 90 %) y el hueco entre golpes se compararon con lo que midió la compu en el coro real:

| Coro de difonos | Ataque: diferencia con el real | Hueco: diferencia con el real |
|---|---|---|
| Sin golpe de voz | 31 ms | 2,0 dB |
| Golpe de 3 dB (como quedó) | 18 ms | 1,8 dB |
| Golpe de 5 dB | 16 ms | 1,8 dB |

Los ataques del coro sintético eran lentos (unos 87 ms en la mediana, contra 64 en el real); con el golpe de voz se acercan. El coro se entiende igual (13,0 % de letras mal).

## Clicks

Se oían ruiditos justo antes de cada consonante. Había tres causas:

- **Saltos de volumen.** La curva de volumen de cada nota (su fuerza, el golpe de voz de los acentos, el crecer de las notas largas) cambiaba de golpe en el borde de las notas, que cae justo antes de cada consonante: hasta 4,4 dB de una muestra a la otra, 12 saltos por frase. Ahora se suaviza en dB con 6 ms, para los dos lados.
- **Ráfagas y soplos con la curva de las vocales.** La curva de timbre sube 15 a 20 dB los agudos, y a p, t, k, ch, f y j les subía la ráfaga y el soplo. Ahora esas consonantes, como las eses, se sacan antes de la curva y se ponen después, con sólo 4 dB más de agudos. La ráfaga queda 10 dB debajo del pico de la vocal; con la curva entera quedaba a 6.
- **Arranques de golpe.** Después de un silencio, algunas voces (es4) arrancan de golpe, y algunos difonos traen ruiditos en su mitad muda. Ahora cada entrada y cada salida tiene 8 ms de rampa, y los silencios son silencio.

En la onda ya no quedan picos raros en ninguna de las tres voces, y el coro se entiende igual (16,9 % de letras mal, media de tres coros).

## Primero hablar, después cantar

Para separar lo que se pierde por cómo pronuncia de lo que se pierde por cantar, el mismo cantor dice las 24 frases (`solista.mjs --habla`). Cada sílaba dura lo que dura hablando y la altura baja de a poco a lo largo de la frase, sube en las acentuadas y cae al final. Después se va de hablar a cantar de a un paso, siempre con la voz es2:

| Paso | Letras mal |
|---|---|
| espeak hablando (para comparar) | 12,6 % |
| **Hablando, castellano neutro** | **2,6 %** |
| Hablando, una octava más agudo | 4,7 % |
| Ritmo de canto con la altura del habla | 1,7 % |
| Melodía entera, articulación de habla | 4,8 % |
| Con vibrato, golpe de voz y caída, consonantes como habladas | 4,2 % |
| Cantado, consonantes cortas (×1,1) | 6,4 % |
| Cantado, con la curva de timbre | 7,4 % |
| Cantado, eses cortas y filtradas (como estaba) | 12,8 % |
| Con el acento rioplatense (sin eses finales, aspiradas) | 12,5 % |
| Con el acento y la curva | 13,5 % |
| Eses de 50 ms, 8 dB más bajas y sin filtrar, con el acento | 11,5 % |
| Lo mismo, 6 dB más bajas y sin sacar las eses finales | 9,2 % |

- **La pronunciación está bien:** hablando erra el 2,6 %, mejor que espeak.
- **Cantar cuesta poco:** la altura, unos 2 puntos; acortar las consonantes, otros 2. El ritmo y el vibrato, nada.
- **Lo que más costaba eran las eses filtradas.** Cortas (35 ms) y sin lo de arriba de 4 kHz dejan de sonar a s: Whisper oye "t" o nada («Te íbamos cantando», «comparta», «que hiciera» por «crecer»). Probablemente también sonaban a chasquido. Más bajas pero sin filtrar se entienden más.
- **Sacar las eses finales y aspirar las de adentro cuesta unos 2 puntos más**, aun sin contar las eses: con «descalzo sin medio», Whisper corta mal las palabras. Un oyente rioplatense probablemente no tenga ese problema.

## En la página

En **Voces**, la opción **Difonos** hace cantar a los trece cantores, en obreros; la primera vez baja las tres voces (12 MB).

Abajo, en **Los cantantes**, cada uno de los trece se puede cambiar a mano:

- **La voz:** es2, es1 o es4.
- **La forma de cantar:** garganta, afinación, vibrato y su velocidad, brillo, color propio, dicción (cuánto duran las consonantes) y retraso.
- **Adornos:** qué parte de las notas largas de las clarinadas y de los finales adorna (ver abajo).
- **En la mezcla:** volumen y paneo.
- **Solo:** lo hace cantar a él solo, en un par de segundos.
- **Callar:** lo saca del coro.

Los cambios se guardan en el navegador por lugar en el coro (el segundo primo es siempre el segundo primo) y valen para cualquier pieza. «Volver a como salieron» los borra. Una presentación de 4 minutos tarda unos 20 s en una compu de dos núcleos. Con **Sólo un solista**, el primero de los primos canta la melodía con la letra, solo, sobre la batería.

MBROLA está compilado a WebAssembly (85 KB) con `herramientas/compilar_mbrola.sh` y anda en un obrero. La voz es2 pesa 5,6 MB y se baja la primera vez. Una presentación de 4 minutos se canta en menos de un segundo.

MBROLA es AGPL-3.0. La voz es2 se puede usar sólo con MBROLA y copiar libremente mientras no se cobre. Los dos avisos están en `motor/vendor/mbrola/`.

## Lo que agregó el libro entero

Con *Sin Disfraz* completo (Lamolle y Lombardo, 1998; resumen en [INVESTIGACION.md](../INVESTIGACION.md)) cambiaron tres cosas del coro. Valen para los dos coros sintéticos, el de formantes y el de difonos.

- **Cuántos por cuerda.** El libro dice que los sobreprimos son dos o tres contando la tercia, y que los primos se dividen en lisos y altos. El coro era 2 bajos, 3 segundos, 4 primos, 3 sobreprimos y la tercia; ahora es 2, 3, **5, 2** y la tercia. Cada cuerda suena igual de fuerte que antes (la ganancia de cada cantor se divide por la raíz de cuántos son). Con el banco de las 24 frases (media de tres coros), el coro se entiende igual: 18,3 % de letras mal, contra 17,8 % con 4 primos y 3 sobreprimos sobre el mismo código, una diferencia que es ruido. Los adornos no entran en ese banco (las frases no tienen clarinadas ni acordes finales).
- **Dónde se para cada uno.** En las murgas de La Unión, mirando desde el público, los segundos van a la izquierda, los sobreprimos en el centro y los primos a la derecha; en las de La Teja, al revés. El paneo iba de grave a agudo, de izquierda a derecha, que no es ninguna de las dos. Ahora: bajos −0,72, segundos −0,42, sobreprimos −0,02, tercia 0,1 y primos 0,42, cada cantor ±0,12 alrededor. En la página, **Mezcla → Dónde se para cada cuerda** elige La Unión o La Teja (da vuelta todo), también para las muestras y el MIDI.
- **Adornos en las notas largas** (`motor/cantor/adornos.js`). En las clarinadas y en los acordes finales, dice el libro, algunos cantores adornan la nota de su cuerda con vibratos, trinos o melismas, y hasta se pasan a otra voz; hay directores que prefieren un sonido limpio. `coro.js` marca las notas que se pueden adornar: las de 0,9 s o más en la clarinada y en el acorde final, y las de 1,6 s o más en cualquier lado (los finales de frase). En la presentación de demostración son 185 de 4.346 notas. En cada una, el cantor adorna con una probabilidad propia; un 30 % de los cantores no adorna nunca, y el que lleva la cuerda y los bajos adornan la mitad. Cada adorno es una curva de altura sobre la nota:
  - **vibrato** más ancho (× 1,7 a 2,3) en la segunda mitad;
  - **trino** con la nota de arriba de la escala, de 5 a 6,5 vueltas por segundo, durante medio segundo a un segundo (tres vueltas como mínimo);
  - **vuelta** (grupeto): arriba, la nota, abajo, la nota;
  - **pasarse** a otra nota del acorde, la que canta otra cuerda, por una nota de paso; a veces vuelve y a veces se queda.

  Las vecinas salen de la escala del tono, corregida con las notas del acorde que suena (si el acorde trae la sensible, la séptima menor no va). Nunca adorna el primer cuarto de la nota ni los últimos 0,3 s. Mientras cambia de nota, el vibrato casi se apaga. En **La pieza → Adornos en clarinadas y finales** se elige ninguno, algunos (× 1) o muchos (× 1,8).

  El guion de MBROLA lleva como mucho 90 puntos de altura por sonido, así que en una nota de 3 s hay un punto cada 33 ms: el trino no pasa de una vuelta cada cinco puntos.

- **La tercia, hasta Si 4.** El libro dibuja el registro de los sobreprimos de Mi 4 a La 4, con extensión hasta Si 4 («un buen sobreprimo llega fácilmente a un la o un si»), y la tercia no es necesariamente el más agudo. Iba de Re 4 a Re 5, con mediana en La 4; ahora va de Re 4 a Si 4, con mediana en Sol 4.

## El agudo y el grito

En el agudo los cantores sonaban raros. Medido con un cantor que sostiene «a» de Do 3 a Re 5 (`vibrato` 0), MBROLA no se rompe: los armónicos quedan limpios (de 25 a 33 dB sobre lo que hay entre ellos, igual que en el grave) y la vocal mantiene su forma (de 1 a 4 dB de diferencia con la «a» grave). Lo raro es otra cosa: la voz es de habla, a un esfuerzo tranquilo, y subida dos octavas queda como un falsete flojito. Entre 1,5 y 3 kHz tiene de 11 a 15 dB menos que en el total, y arriba de 3 kHz, de 23 a 35 dB menos. Un tenor de murga en La 4 canta con el pecho y al máximo, con mucho más arriba.

La primera versión (`gritar()`) saturaba la voz: la dividía por su envolvente, la pasaba por un polinomio de grado 3 y le agregaba un temblor de volumen al azar. Agregaba armónicos arriba y aspereza. Al oído quedó raro y casi no se notaba. Medido después contra el coro real, se entiende por qué: los agudos ya estaban.

**Lo que mide el coro real.** Quince tramos de 20 s de La Trasnochada 2020 (retirada) contra el coro de difonos entero, 13 cantores al unísono y sin sala, en los tramos con altura clara. Se mide el nivel de los armónicos por bandas, relativo al total:

| | 0–400 Hz | 400–800 | 800–1200 | 1200–1800 | 1800–2500 | 2500–3200 | 3200–4000 | H1−H2 |
|---|---|---|---|---|---|---|---|---|
| coro real | −4,8 | −4,9 | **−8,4** | **−9,8** | −14,4 | −14,0 | −15,4 | **0,9 dB** |
| difonos sin gritar | −4,3 | −5,0 | −9,9 | −11,7 | −11,3 | −14,2 | −16,6 | 3,4 dB |
| difonos gritando (ahora) | −6,0 | −4,8 | **−8,4** | **−10,0** | −10,4 | −13,1 | −16,2 | **0,1 dB** |

H1−H2 es la mediana en cantores solos. Arriba de 2,5 kHz el coro sintético ya tenía lo del real, por la curva de timbre. Le faltaban de 1,5 a 2 dB entre 0,8 y 1,8 kHz y le sobraban 2,5 dB de fundamental frente al segundo armónico. Es lo que cambia en la voz cuando se canta fuerte: se abre la boca y sube el primer formante (Schulman 1989; Traunmüller y Eriksson 2000), y la glotis aprieta más, así que la fundamental pierde frente a lo demás. Un indicio del primer formante, el centro de gravedad de los armónicos entre 250 Hz y 1,6 kHz, da 632 Hz de mediana en el real, 553 Hz sin gritar y 606 Hz gritando.

Además, el coro de difonos se corta entre sílabas. Medido cada 10 ms, está 15 dB abajo de lo que suena un 9,4 % del tiempo, y el real un 3,0 %. En un cantor solo (es1), quedan 15 dB abajo de la vocal casi la mitad de los cuadros de m y n y del 83 al 92 % de los de b, d y g: son consonantes de habla. Cantando fuerte, la voz sigue entera por las consonantes sonoras.

**`esforzar()` en `difonos.js`**, antes de la curva de timbre:

- **Esfuerzo por nota:** grito × (0,75 + 0,35 × fuerza) × (1 + 0,5 × cuántas quintas pasa del centro de su cuerda). El centro va de Mi 3 en los bajos a Mi 4 en los sobreprimos (`CUERDAS_DIFONOS`): como dice el libro, la emisión cambia con el volumen y con el registro.
- **La boca más abierta:** cada 10 ms se busca el primer formante con predicción lineal (ventana de 25 ms, preénfasis 0,9, orden sr/1000 + 2, ventana de retardos de 60 Hz). Es el polo más grave entre 150 Hz y 1,2 kHz y por encima de la fundamental: se encuentra el pico de la envolvente en una grilla y se ajusta con Newton. Un filtro de segundo orden lo corre: ceros donde estaba el polo y polos donde va, 20 % más arriba con esfuerzo 1 (nunca pasa de 1,2 kHz) y con un 30 % menos de ancho de banda. El resto del espectro no se toca. Los coeficientes se interpolan entre cuadros, y un filtro de segundo orden interpolado entre dos estables sigue estable.
- **La voz apretada:** un pozo en la altura de la nota, de 4 dB con esfuerzo 1 (Q 1,2).
- Las dos cosas van sólo en las vocales: una m o una n son casi pura fundamental, y con el pozo se perdían.
- **Parejo:** lo que queda más de 8 dB abajo de la vocal de al lado (el máximo en ±150 ms) sube hasta 14 dB × esfuerzo. Lo que está más de 35 dB abajo, como un silencio o el cierre de una p, no se toca. En un cantor solo, los cuadros cortados bajan de 1.433 a 1.298 con es2 y de 2.061 a 1.386 con es1; en es1, la n pasa de 48 a 15 % y la b de 88 a 48 %. Lo que queda son sobre todo p, t, k, s y j, que se cortan también cantando. En el coro del banco, donde todos se cortan juntos en las sordas, el tiempo 15 dB abajo baja poco: de 9,4 a 8,8 % con una semilla y de 8,6 a 7,4 % con otra.
- **Brillo:** el timbre del coro real sube de 60 % hacia el 100 %, como antes.
- El volumen total del cantor queda igual. Las eses y las consonantes sordas van aparte.

Se entiende un poco menos: con el banco de las 24 frases (media de tres coros), de 18,3 % de letras mal sin gritar a 19,7 % gritando (17,9, 18,9 y 22,2 contra 19,2, 16,9 y 18,9); con el formante 16 % más arriba en vez de 20 %, 18,7 %. Es el precio de que suene gritado, y para el que quiera la letra más clara está «no gritan». Cuesta poco tiempo: un cantor de 68 s tarda de 0,1 a 0,3 s más. En la demo, con los tres valores de **La pieza → Cuánto gritan**, el total de la mezcla (con la batería) cambia así frente a «no gritan»: entre 100 y 400 Hz, −3,8 dB con «sí» y −5,2 dB con «mucho»; entre 0,8 y 3,5 kHz, de +1,4 a +1,9 dB y de +2,0 a +2,5 dB.

**La sala.** Las voces van todas juntas a una reverberación (la batería no). Era ruido blanco de 0,7 s y casi no se oía. Ahora tiene 20 ms antes de empezar, unos primeros rebotes distintos a cada lado y una cola de 1,6 s en los graves y 0,7 s arriba de 2,5 kHz, sin lo de abajo de 120 Hz. En **Mezcla → Sala** se elige cuánta: el valor por defecto (0,5) es casi el doble de lo que se mandaba antes.

## Lo que falta

- **Que no suene a locutor.** Las voces son de habla: las vocales largas se estiran repitiendo el mismo pedazo y pueden sonar quietas.
- **La afinación con intención.** Según el libro, en la murga muchas notas se cantan apenas más altas o más bajas a propósito, y cantadas muy afinadas pierden sabor. Los cantores sintéticos desafinan al azar, no con intención.
- **La emisión según el registro.** El libro dice que la colocación cambia con la cuerda, el volumen y el registro: en el grave, «voz de segundo»; en el agudo, más nasal. El grito ya abre más la vocal en las notas fuertes y agudas, pero lo nasal del agudo no está.
- **Los cortes de las sordas.** En p, t, k y s el coro de difonos se corta entero, porque los cantores se cortan casi juntos: 15 dB abajo un 8 a 9 % del tiempo, contra 3 % en el real. Acortar esos cierres podría costar que se entienda la letra.
- **El timbre.** Hay que medirlo contra el coro real, con el banco, para la curva de ecualización.
