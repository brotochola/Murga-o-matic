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

| Regla | Origen |
|---|---|
| Primos con la melodía; sobreprimos una tercera arriba y segundos una abajo, corregidas a nota del acorde en tiempo fuerte; bajos en la fundamental | documentado |
| Una estrofa con la melodía en los segundos y los primos arriba | documentado (melodía repartida); la elección de la estrofa es mía |
| Tercia con contracanto: ataca donde la melodía no ataca, prefiere el contratiempo, va en sentido contrario y por grado conjunto | documentado ("se separa para contrapuntear", "contramelodías sincopadas"); el algoritmo es mío |
| Estribillo que arranca al unísono y se abre a voces | documentado (unísono para dar fuerza); la ubicación es mía |
| Lailareo en pedal sobre la quinta | documentado |
| Clarinada a capela al inicio de la presentación, con golpes sueltos de batería | documentado |
| Salpicón: 4 compases de solista y 4 de coro | documentado (pares de cuartetas, solista contra coro) |
| Bajada: el final del estribillo repetido 3 veces mientras se apaga | documentado |
| Motivo con forma A A' y secuencia de un grado | interpretación (rasgos de las fuentes populares: marcha, tango, canción) |

## Pendiente

Las transcripciones del capítulo 3 de Higuera (2019) muestran qué hace cada voz en clarinadas, bajadas, lailareos y contracantos de Agarrate Catalina, Asaltantes con Patente, Contrafarsa y Don Timoteo. Con ese PDF se pueden ajustar los contracantos nota a nota.

## Fuentes

- Lamolle, G. y Lombardo, E. (1998). *Sin Disfraz*. Extractos: [Coro de murga](http://murgas-del-uruguay.blogspot.com/2012/03/coro-de-murga-extraido-del-libro-sin.html), [Repertorio de la murga](https://murgas-del-uruguay.blogspot.com/2012/03/repertorio-de-la-murga-extraido-del.html)
- Fornaro, M. (2002). [Los cantos inmigrantes se mezclaron… La murga uruguaya](https://www.redalyc.org/pdf/822/82200607.pdf). *TRANS*.
- Higuera Barajas, S. (2019). [Dicen que la murga es…](https://repository.udistrital.edu.co/items/19194ce0-bcba-42b6-a8ac-8c657b9da348). Universidad Distrital.
- [Resolución 414/2010, patrimonio cultural (IMPO)](https://www.impo.com.uy/bases/resoluciones/414-2010)
- Lagomarsino, M. [Partitura coral de murga](https://milolagomarsino.com/partitura-coral/de-murga/)
- [La murga estilo uruguayo (CLACSO)](https://biblioteca-repositorio.clacso.edu.ar/bitstream/CLACSO/250231/1/La-murga-estilo-uruguayo.pdf)
- Cortés, S. [Curso de murga uruguaya](https://gusespada.com/cursos/curso-de-murga-uruguaya)
- [Repertorios en la murga hispanouruguaya](https://hispadoc.es/descarga/articulo/2925708.pdf)
- Cifrados: [Contrafarsa, Retirada 2001](https://acordes.lacuerda.net/murga/retirada_2001.shtml), [Retirada 2002](https://acordes.lacuerda.net/murga/retirada_2002), [Agarrate Catalina, Saludo 2010](https://acordes.lacuerda.net/agarrate_catalina/saludo_2010)
