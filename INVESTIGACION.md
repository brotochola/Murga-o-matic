# Cómo se arma el coro de murga: lo que encontré

Este documento separa lo que está documentado en las fuentes de lo que es interpretación mía para el generador.

## Las cuerdas

Según *Sin Disfraz* (Lamolle y Lombardo, 1998), el coro de concurso tiene como máximo 13 voces, organizadas en tres cuerdas que se subdividen:

| Cuerda | Subdivisión | Registro (do4 = do central) |
|---|---|---|
| Segundos | bajos y segundos | do3–do4, rinde mejor por encima de mi3; se extiende a sol2 y re4 |
| Primos | primos lisos y primos altos | sol3–sol4; se extiende a mi3 y la4 |
| Sobreprimos (dos o tres) | puede especializarse en **tercia** | mi4–la4; se extiende a do4 y si4 («un buen sobreprimo llega fácilmente a un la o un si») |

- La voz grave no puede ser demasiado grave, porque hay que proyectar al aire libre (*Sin Disfraz*).
- El director «da el tono» a la cuerda de primos, que lleva el canto principal, y a esa voz «se pegan» los segundos, los sobreprimos y los bajos; arriba va la tercia, «la voz más característica de la murga» ([Crisis](https://revistacrisis.com.ar/notas/murgas-uruguayas-el-sonido-de-la-bohemia)). El material educativo de Ceibal enumera las voces de grave a agudo: bajos, segundos, primos y sobreprimos, en coros de 13 a 15 ([Ceibal](https://rea.ceibal.edu.uy/elp/murga_son_las_mil_esquinas/coro_de_murga.html)). Ninguna de las dos da registros.
- La voz principal no suele ser la más aguda (resolución de patrimonio 414/2010, IMPO).
- La tercia tiene un carácter más solista. No es necesariamente la voz más aguda y a menudo **se separa del coro para contrapuntearlo** (Fornaro, 2002).

## Cómo se arregla

**Documentado:**
- En principio los primos llevan la melodía y las otras cuerdas armonizan arriba y abajo. En la práctica no es rígido: las melodías de mucho registro se reparten entre cuerdas (*Sin Disfraz*).
- El arreglo se basa en partes corales armonizadas por terceras, alternadas con solos, dúos y tríos (*Sin Disfraz*; Fornaro).
- Se usan unísonos para dar fuerza, notas pedales y pregunta y respuesta (*Sin Disfraz*).
- Antes se cantaba sobre todo a dos voces y los sobreprimos aparecían de vez en cuando. Hoy hay tres o más voces en forma permanente (Fornaro).
- Hay terceras y quintas paralelas, con séptimas de dominante, dominantes secundarias y acordes con sexta agregada de vez en cuando. Predomina la textura homofónica, porque la batería cumple el papel rítmico que en un coro a capela tendrían voces independientes (Lagomarsino).
- El lailareo funciona como melodía principal, como contracanto o como notas pedales. Hay ejemplos de Agarrate Catalina, 2006 y 2010 (Higuera, 2019, índice de figuras).
- Los contracantos agregan contramelodías sincopadas (tesis "La murga estilo uruguayo", CLACSO, sobre un tema de Falta y Resto).
- Hay cuerdas que suenan más metálicas, nasales o incisivas según la función y la intención expresiva (curso de Solana Cortés).
- Cuplés y salpicones llevan arreglos más simples que la presentación y la retirada (*Sin Disfraz*).

**Emisión:** nasal, sobre todo en los agudos; "cantar para el costado". Es una emisión potente con resonancia faringo-nasal y un ataque agresivo, algo apretado, lejos del bel canto. *Sin Disfraz* matiza: no hay una sola colocación, depende de la cuerda, del volumen y del registro, y lo de la colocación nasal es un mito (se da, pero no es la única); ver más abajo.

## Las partes del espectáculo

- **Clarinada:** tema breve a capela, o con intervenciones no rítmicas de la batería. Puede abrir una de las "puntas" del espectáculo. Los ejemplos transcritos por Higuera son de presentaciones (Don Timoteo, 2015 y 2017).
- **Presentación o saludo:** unos 5 minutos; exige mucha concisión al letrista y al arreglador.
- **Cuplé:** la parte central, armada con picos de tensión. Formato tradicional: un cupletero solista, presentado como ajeno al grupo, y el coro que lo cuestiona.
- **Salpicón:** pares de cuartetas en pregunta y respuesta. La primera presenta un tema de actualidad y la segunda lo cierra con humor o con un remate social.
- **Canción final:** melodía lenta y reflexiva antes de la retirada.
- **Retirada o despedida:** hasta unos 10 minutos. Es más larga que la presentación y suele tener el arreglo más cuidado. **No tiene final formal: un pasaje se repite mientras la murga baja del escenario, hasta que el sonido se apaga.** Ese pasaje es la **bajada**.

## Melodías

- Por tradición son contrafacta: melodías conocidas (tangos, marchas, pasodobles, boleros, rock nacional e internacional, canciones del año) con letra nueva. La melodía conocida deja la atención libre para la letra.

## Armonía en cifrados reales

En cifrados de Contrafarsa y Agarrate Catalina (La Cuerda):

- **Mayor:** I–IV–V; frases que cierran en V (semicadencia); I7 de paso hacia IV; iv menor prestado.
- **Menor:** colores de menor natural: i–VII–VI–V (cadencia andaluza), i–VII–VI–III–V–i.
- **Retiradas que cambian de modo:** la Retirada 2001 de Contrafarsa termina en menor; la de 2002 empieza en menor y pasa a mayor.

## Cómo lo usa el generador

Este documento es de antes de tener corpus. Desde que hay transcripciones propias, la melodía, las voces, la armonía, los tempos y los largos salen de los datos: están en [docs/analisis_de_los_midis.md](docs/analisis_de_los_midis.md). Lo que el generador sigue tomando de estas fuentes es el plan:

| Regla | Origen |
|---|---|
| Registros de las cuerdas | *Sin Disfraz*; se reparte con lo medido (la melodía real vive entre 56 y 69 MIDI) |
| Clarinada a capela al inicio de la presentación y de la retirada, con calderones | Higuera, 3.2.2.1; el corpus confirma la entrada a capela |
| Canción final lenta antes de la retirada, con menos voces al principio | fuentes populares e Higuera; la densidad la pide el generador |
| Retirada sin final formal: la bajada se repite y se apaga | documentado (*Sin Disfraz*, Higuera) |
| Bajada con una vuelta a capela | Higuera, 3.2.2.2: es usual en concurso |
| Batería por loops, con la llamada que corresponde al entrar | video de La Tríada; elección del proyecto |

Lo que el corpus agrega a estas fuentes: las melodías con secuencias y recitado, la textura estable por frase y la diferencia entre La Trasnochada (recita) y Agarrate Catalina (camina). También matiza a Fornaro: hoy hay tres o más voces casi siempre, pero el unísono sigue vivo. En el 27 % de los golpes el transcriptor anota una sola voz, y en el 81 % de esos no hay rastro de otra: es un unísono real de todo el coro (regla 12 del análisis).

## Lo que muestran las transcripciones (Higuera, 2019, cap. 3)

**Cuerdas y funciones**
- Según Lombardo y Riquero, las subdivisiones dependen más del arreglo que del registro: sirven para ampliar la armonía o generar tensiones. En las bajadas suele haber una misma línea melódica en las tres cuerdas.
- Registros de la tabla de *Sin Disfraz*: sobreprimos y tercia, fa4–do5 (excepcional do4–fa5); primos, sol3–sol4; segundos y bajos, do3–do4 (excepcional sol2–re4). Tabaré Cardozo no recomienda bajar de re3, o como mucho de do3, porque se pierde potencia y se desafina.
- **Segundos:** son el soporte armónico y rara vez salen de la tríada (fundamental, tercera y quinta). A veces imitan la línea de un bajo eléctrico: en "Canto a los hijos" (Don Timoteo, 2017, arreglo de Lombardo), sobreprimos y segundos caminan en negras con "la" mientras los primos dicen el texto en semicorcheas. A veces llevan la melodía, en frases donde los demás no la cantan: en la Retirada 2002 de Contrafarsa, los bajos tienen la melodía y arriba suenan golpes de "ah" en contratiempo.
- **Primos:** llevan la melodía principal, en textura homofónica o contrapuntística.
- **Sobreprimos:** normalmente acompañan a los primos por arriba y amplían los acordes en el agudo. A veces llevan la melodía.
- **Tercia:** tiene carácter de solista y remata los pasajes corales con una línea potente y melismática. Es la voz que más busca el sonido pregonero. En la Presentación 2010 de Agarrate Catalina entra sola cuando el coro termina la frase.

**Armonía:** melodías armonizadas a tres voces consonantes (1, 3 y 5 del acorde), con tensiones (7.ª, 9.ª, 13.ª) en algunos cierres o en pasajes entre secciones (Tabaré Cardozo).

**Antes:** solo había primos y segundos. Casi todos cantaban al unísono y una tercera voz, que bien podría ser la tercia, cantaba la misma melodía una octava arriba. Las armonías se hacían de oído (Lombardo).

**Lailareo**, en tres usos:
1. *Melodía principal armonizada:* las tres cuerdas en paralelo, mismo ritmo sincopado (Agarrate Catalina, 2006).
2. *Contracanto:* sobreprimos y primos con el texto en terceras; los segundos meten "lai-la" sincopados en los huecos (Agarrate Catalina, 2006).
3. *Notas pedales:* sobreprimos y segundos sostienen la misma nota a la octava en blanca con puntillo más negra ("La… lai"), y los primos cantan el texto en el medio (Agarrate Catalina, 2010).

En la Despedida de Asaltantes con Patente (1932), primos y segundos cantan el texto en paralelo. Cuando la melodía queda en una nota larga, las tercias responden a dos voces con "lar-ra-rá lai-ra-rá".

**Clarinada:** solo voces, sin tempo y a las indicaciones de quien dirige. Suele iniciar la presentación y la retirada, y también puede anteceder a la bajada. Es triádica, pero admite tensiones y agregados: segundas mayores, cuartas justas, cromatismo descendente y contracantos de los segundos. Usa calderones y cambios de compás (Don Timoteo, 2015 y 2017).

**Bajada:** es un gancho que se repite para que el público no lo olvide. La armonía es muy triádica y las melodías de todas las voces son fáciles de cantar. En el concurso es usual que la repetición vaya sin batería, con contracantos en las cuerdas que no llevan la melodía o en las tercias (Asaltantes 2007; Agarrate Catalina 2008 y 2019).

**Canciones finales y retiradas:** a veces las cantan pocos cantantes con guitarra, y la batería entra recién en la sección final. Las retiradas pueden tener pasajes sin batería, solo con guitarra.

**Batería:** la marcha camión se usa sobre todo en retiradas y saludos. Su versión en 2/4 da una base más cerrada y rápida para acelerar hacia la siguiente sección, como en las bajadas de Contrafarsa de 2000 y 2002. El candombeado, también llamado "murga", se usa sobre todo en presentaciones y bajadas. Los platillos pueden dejar la base para acentuar un ritmo del coro o responder a una frase cantada.

## El libro entero: *Sin Disfraz* (1998)

Hasta acá había leído dos extractos de un blog. Con el libro completo (escaneado; lo pasé por OCR para leerlo, el texto no está en el repositorio) aparecen más cosas. Lo que se usa en el generador está marcado con **→**.

**El coro**
- Trece voces: el reglamento permite diecisiete integrantes, menos el director y los tres de la batería. Los sobreprimos son **dos o tres, contando la tercia**; los primos se dividen en lisos y altos. **→** el coro sintético pasó de 2 bajos, 3 segundos, 4 primos, 3 sobreprimos y la tercia a 2, 3, **5, 2** y la tercia (`motor/cantor/coro.js`).
- **Dónde se para cada cuerda.** Las murgas de La Unión suelen formar con los segundos a la izquierda del público, los sobreprimos en el centro y los primos a la derecha; las de La Teja, al revés. **→** el paneo sigue esa formación, con un botón para elegir La Unión o La Teja. Antes iba de grave a agudo, de izquierda a derecha, que no es ninguna de las dos.
- **Registros.** Los dibujos de los registros en pentagrama confirman la tabla de arriba, salvo el techo de los sobreprimos: si4, no re5. **→** la tercia del compositor va hasta si4 (antes hasta re5). Los sobreprimos siguen llegando a do5 cuando la melodía sube (el 4,5 % de sus notas en 56 piezas de prueba): el libro dice que cantan «hasta donde lleguen».
- **La voz grave es aguda** para ser grave, porque se canta fuerte y al aire libre.
- **La melodía se reparte.** Las partes graves de una melodía amplia las cantan los segundos y las agudas los primos o los sobreprimos, así que cada cuerda pasa todo el tiempo de la melodía a una segunda voz y de vuelta. Cantada sola en el ensayo, una cuerda parece no tener «ni pies ni cabeza».
- **Los sobreprimos rinden más en notas largas** o repitiendo una nota que en sucesiones de notas breves, porque cantan en el techo de su registro y a gran volumen. También son comunes los unísonos y las notas pedales de uno o dos compases en una o dos voces mientras el resto se mueve.
- **Clarinadas y finales.** En las clarinadas y en los acordes finales (dos o tres compases en que todos cantan, por ejemplo, la «a»), cada cuerda canta en teoría una nota, pero algunos la adornan con vibratos, trinos o melismas distintos, y hasta se pasan a otra voz. El resultado es una movilidad imposible de transcribir. No todas las murgas lo hacen: hay directores que prefieren un sonido más limpio. **→** `motor/cantor/adornos.js`: en esas notas cada cantor adorna a su manera (vibrato más ancho, trino, vuelta o pasarse a otra nota del acorde), con un control «ninguno / algunos / muchos».
- **Afinación con sabor.** Muchas veces un do no es do sino un poquito más alto o más bajo, y cantado muy afinado la interpretación pierde sabor. Es intuitivo; confundirlo con desafinar es un error. (Todavía no se usa: el cantor sintético desafina al azar, no con intención.)

**La emisión**
- No hay una sola colocación: depende de la cuerda, de si se canta al máximo de volumen y de si se está en el agudo o en el grave de la cuerda. A un primo que no llega a una nota grave se le pide «voz de segundo».
- Los segundos pueden cantar con una emisión metálica, «como salida de un caño», o más parecida a un mugido.
- La colocación nasal es un mito: se da, pero no es la única. En un mismo solo la voz puede pasar de «de garganta» a totalmente nasal, como recurso expresivo y para pasar del grave al agudo.
- El sonido de siempre de la murga es «latoso». Desde que el concurso puntúa la «buena dicción», muchas murgas lo abandonaron en parte, porque esa forma de cantar y la buena dicción no suelen ir juntas. (Para este proyecto es una tensión: Whisper premia la dicción.) Los equipos de amplificación también cambiaron la emisión.
- «Cantar pa'l costado» viene de la torsión del cuello y la mandíbula de los murguistas, sobre todo los de antes, al cantar.
- Antes los solistas cantaban más liso; hoy hay voces con mucho vibrato. Las murgas de La Unión tienen fama de emisión más «de murga vieja» y de darle más lugar a los sobreprimos y tercias.

**Los arreglos**
- El arreglador «murguea» una música: se imagina el fraseo sobre el candombeado y la marcha camión, y puede meter cada frase en uno o en dos compases. En el ejemplo del libro, la marcha camión va a unas 90 negras por minuto y el candombeado a unas 130.
- Desde los ochenta casi todos los directores arreglan con la guitarra: en los tiempos fuertes la melodía canta una nota del acorde, y las otras voces van de acorde en acorde por notas de paso. Llevado al extremo, una parte del coro hace sólo los acordes con «lai larai» o «mmm» mientras otra canta la melodía.
- Los arreglos viejos tienen «desobediencias» armónicas que se repiten a propósito: por ejemplo, los primos suben la sensible y los segundos, un momento después, cantan la natural.
- Las puntas (saludo y retirada) llevan arreglos más trabajados que el medio (cuplés y salpicones); el medio tiene un ritmo más picado y bailable. Para la retirada se eligen melodías más tristes, muchas del tango.
- En los cuplés tradicionales, las partes solistas iban con un ritmo muy lento y el estribillo del coro con otro más rápido.
- En las estrofas del salpicón es común la armonía tónica, dominante, tónica, dominante de la subdominante, subdominante, tónica, dominante, tónica, y sobre la última tónica entra el estribillo.

**La batería**
- Durante la clarinada la batería no marca un ritmo: refuerza con rulos de redoblante, platillazos sueltos y golpes de bombo, y la clarinada termina cuando arranca un ritmo definido. (No se usa todavía.)
- El capítulo transcribe golpe por golpe una docena de ritmos y los distintos golpes de cada instrumento. El generador usa loops reales de La Tríada, así que no los necesita por ahora.

## "Aquello" (Jaime Roos, arreglo de Milo Lagomarsino)

Es un arreglo coral de candombe a tres voces, no una murga de carnaval, pero muestra tres cosas útiles:
- **Rítmica de candombe:** corchea con puntillo y semicorchea, notas ligadas que anticipan el tiempo, entradas en semicorchea después de un silencio.
- **Movimiento complementario:** cuando una voz sostiene una nota larga, otra sigue con texto.
- **Voces que imitan tambores:** "tum tum", "dm dm", "takatintan" en semicorcheas sobre una nota larga sostenida.

## Fuentes

- Lamolle, G. y Lombardo, E. (1998). *Sin Disfraz: la murga vista de adentro*. Montevideo: Taller Uruguayo de Música Popular. Leído entero; extractos en línea: [Coro de murga](http://murgas-del-uruguay.blogspot.com/2012/03/coro-de-murga-extraido-del-libro-sin.html), [Repertorio de la murga](https://murgas-del-uruguay.blogspot.com/2012/03/repertorio-de-la-murga-extraido-del.html)
- Fornaro, M. (2002). [Los cantos inmigrantes se mezclaron… La murga uruguaya](https://www.redalyc.org/pdf/822/82200607.pdf). *TRANS*.
- Higuera Barajas, S. (2019). [Dicen que la murga es…](https://repository.udistrital.edu.co/items/19194ce0-bcba-42b6-a8ac-8c657b9da348). Universidad Distrital. Capítulo 3: transcripciones de Contrafarsa, Agarrate Catalina, Asaltantes con Patente, Don Timoteo y Antimurga BCG.
- Lagomarsino, M. [Aquello (Jaime Roos), arreglo coral a 3 voces](https://milolagomarsino.com/wp-content/uploads/2021/02/AQUELLO-arreglo-coral-3-voces-candombe-uruguay-Milo-Lagomarsino.pdf)
- [Resolución 414/2010, patrimonio cultural (IMPO)](https://www.impo.com.uy/bases/resoluciones/414-2010)
- Lagomarsino, M. [Partitura coral de murga](https://milolagomarsino.com/partitura-coral/de-murga/)
- [La murga estilo uruguayo (CLACSO)](https://biblioteca-repositorio.clacso.edu.ar/bitstream/CLACSO/250231/1/La-murga-estilo-uruguayo.pdf)
- Cortés, S. [Curso de murga uruguaya](https://gusespada.com/cursos/curso-de-murga-uruguaya)
- [Repertorios en la murga hispanouruguaya](https://hispadoc.es/descarga/articulo/2925708.pdf)
- Cifrados: [Contrafarsa, Retirada 2001](https://acordes.lacuerda.net/murga/retirada_2001.shtml), [Retirada 2002](https://acordes.lacuerda.net/murga/retirada_2002), [Agarrate Catalina, Saludo 2010](https://acordes.lacuerda.net/agarrate_catalina/saludo_2010)
