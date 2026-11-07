# Cómo se arma el coro de murga: lo que encontré

Este documento separa lo que está documentado en las fuentes de lo que es interpretación mía para el generador.

## Las cuerdas

Según *Sin Disfraz* (Lamolle y Lombardo, 1998), el coro de concurso tiene como máximo 13 voces, organizadas en tres cuerdas que se subdividen:

| Cuerda | Subdivisión | Registro (do4 = do central) |
|---|---|---|
| Segundos | bajos y segundos | do3–do4, rinde mejor por encima de mi3; se extiende a sol2 y re4 |
| Primos | primos lisos y primos altos | sol3–sol4; se extiende a mi3 y la4 |
| Sobreprimos | puede especializarse en **tercia** | mi4–la4; se extiende a do4 y re5 |

- La voz grave no puede ser demasiado grave, porque hay que proyectar al aire libre (*Sin Disfraz*).
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

**Emisión:** nasal, sobre todo en los agudos; "cantar para el costado". Es una emisión potente con resonancia faringo-nasal y un ataque agresivo, algo apretado, lejos del bel canto.

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

Lo que el corpus agrega a estas fuentes: las melodías con secuencias y recitado, la textura estable por frase, la diferencia entre La Trasnochada (recita) y Agarrate Catalina (camina) y que el coro casi nunca canta al unísono, lo que coincide con Fornaro: hoy hay tres o más voces en forma permanente.

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

## "Aquello" (Jaime Roos, arreglo de Milo Lagomarsino)

Es un arreglo coral de candombe a tres voces, no una murga de carnaval, pero muestra tres cosas útiles:
- **Rítmica de candombe:** corchea con puntillo y semicorchea, notas ligadas que anticipan el tiempo, entradas en semicorchea después de un silencio.
- **Movimiento complementario:** cuando una voz sostiene una nota larga, otra sigue con texto.
- **Voces que imitan tambores:** "tum tum", "dm dm", "takatintan" en semicorcheas sobre una nota larga sostenida.

## Fuentes

- Lamolle, G. y Lombardo, E. (1998). *Sin Disfraz*. Extractos: [Coro de murga](http://murgas-del-uruguay.blogspot.com/2012/03/coro-de-murga-extraido-del-libro-sin.html), [Repertorio de la murga](https://murgas-del-uruguay.blogspot.com/2012/03/repertorio-de-la-murga-extraido-del.html)
- Fornaro, M. (2002). [Los cantos inmigrantes se mezclaron… La murga uruguaya](https://www.redalyc.org/pdf/822/82200607.pdf). *TRANS*.
- Higuera Barajas, S. (2019). [Dicen que la murga es…](https://repository.udistrital.edu.co/items/19194ce0-bcba-42b6-a8ac-8c657b9da348). Universidad Distrital. Capítulo 3: transcripciones de Contrafarsa, Agarrate Catalina, Asaltantes con Patente, Don Timoteo y Antimurga BCG.
- Lagomarsino, M. [Aquello (Jaime Roos), arreglo coral a 3 voces](https://milolagomarsino.com/wp-content/uploads/2021/02/AQUELLO-arreglo-coral-3-voces-candombe-uruguay-Milo-Lagomarsino.pdf)
- [Resolución 414/2010, patrimonio cultural (IMPO)](https://www.impo.com.uy/bases/resoluciones/414-2010)
- Lagomarsino, M. [Partitura coral de murga](https://milolagomarsino.com/partitura-coral/de-murga/)
- [La murga estilo uruguayo (CLACSO)](https://biblioteca-repositorio.clacso.edu.ar/bitstream/CLACSO/250231/1/La-murga-estilo-uruguayo.pdf)
- Cortés, S. [Curso de murga uruguaya](https://gusespada.com/cursos/curso-de-murga-uruguaya)
- [Repertorios en la murga hispanouruguaya](https://hispadoc.es/descarga/articulo/2925708.pdf)
- Cifrados: [Contrafarsa, Retirada 2001](https://acordes.lacuerda.net/murga/retirada_2001.shtml), [Retirada 2002](https://acordes.lacuerda.net/murga/retirada_2002), [Agarrate Catalina, Saludo 2010](https://acordes.lacuerda.net/agarrate_catalina/saludo_2010)
