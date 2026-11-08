# Varias tomas del mismo espectáculo

Escrito por `node herramientas/tomas.js comparar`. Cada toma es otra grabación (otra noche, otra cámara, la tribuna, el disco) de la misma retirada. Las tomas se alinean por el croma de sus voces separadas y se comparan sus transcripciones. Lo que coincide entre noches distintas es la murga; lo que no, es sobre todo el transcriptor (también hay algo de interpretación: no se canta igual cada noche).

## asaltantes_2024_retirada

Referencia: **disco** (disco oficial). Notas a ±80 ms; F1 de 100 % es la misma transcripción.

| Toma | Fuente | En común | Transp. | Costo DTW | Notas crudas F1 | Sin octava | Limpias F1 | Golpes en común | Mismas voces | Diferencia de voces | Misma melodía | Armonía |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tf_primera | Tenfield primera rueda | 6:29 | 0 | 0,220 | 46 % | 46 % | 45 % | 58 % | 73 % | 0,36 | 67 % | 77 % |
| tf_segunda | Tenfield segunda rueda | 4:37 | 1 | 0,365 | 24 % | 25 % | 16 % | 45 % | 72 % | 0,40 | 25 % | 49 % |
| tf_liguilla | Tenfield liguilla | 1:38 | 0 | 0,435 | 19 % | 19 % | 20 % | 29 % | 71 % | 0,36 | 45 % | 73 % |
| cu | Carnaval Uruguay | 4:38 | 1 | 0,362 | 27 % | 27 % | 17 % | 44 % | 74 % | 0,31 | 34 % | 52 % |
| fan_vacarnaval | Va Carnaval (tribuna) | 5:38 | 0 | 0,325 | 26 % | 27 % | 20 % | 49 % | 51 % | 0,74 | 32 % | 64 % |

## bastarda_2026_retirada

Referencia: **ebp** (Entre Bombos y Platillos). Notas a ±80 ms; F1 de 100 % es la misma transcripción.

| Toma | Fuente | En común | Transp. | Costo DTW | Notas crudas F1 | Sin octava | Limpias F1 | Golpes en común | Mismas voces | Diferencia de voces | Misma melodía | Armonía |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tf_segunda | Tenfield segunda rueda | 7:24 | 0 | 0,181 | 55 % | 56 % | 55 % | 69 % | 79 % | 0,26 | 70 % | 75 % |
| tf_liguilla | Tenfield liguilla | 6:35 | 0 | 0,225 | 40 % | 40 % | 40 % | 56 % | 73 % | 0,32 | 60 % | 67 % |
| tf_ganadores | Tenfield ronda de ganadores | 7:24 | 0 | 0,249 | 38 % | 38 % | 41 % | 59 % | 69 % | 0,37 | 57 % | 68 % |
| murgas | MURGAS actuación completa | 7:24 | 0 | 0,047 | 25 % | 25 % | 27 % | 53 % | 73 % | 0,36 | 44 % | 73 % |
| fan_granma | GranMa (tribuna) primera rueda | 7:24 | 0 | 0,023 | 76 % | 76 % | 77 % | 85 % | 83 % | 0,21 | 81 % | 84 % |

## trasnochada_2026_retirada

Referencia: **propia** (canal de la murga). Notas a ±80 ms; F1 de 100 % es la misma transcripción.

| Toma | Fuente | En común | Transp. | Costo DTW | Notas crudas F1 | Sin octava | Limpias F1 | Golpes en común | Mismas voces | Diferencia de voces | Misma melodía | Armonía |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| camilo_primera | Camilo (tribuna) primera rueda | 3:00 | 0 | 0,308 | 36 % | 36 % | 37 % | 55 % | 93 % | 0,10 | 69 % | 69 % |
| camilo | Camilo (tribuna) | 7:32 | 0 | 0,236 | 32 % | 32 % | 33 % | 56 % | 86 % | 0,18 | 53 % | 73 % |
| momo_virtual | Momo Virtual (audio) | 4:34 | 1 | 0,261 | 35 % | 35 % | 35 % | 59 % | 77 % | 0,28 | 45 % | 69 % |
| canisha | la canisha (tribuna) | no se alineó: 9 s en común | | | | | | | | | | |

## Rasgos del jurado: ¿miden la murga o el transcriptor?

Distancia mediana entre dos tomas del mismo espectáculo, y entre dos espectáculos distintos del corpus (misma parte), en anchos de la norma del jurado. Una razón cerca de 1 quiere decir que dos noches del mismo espectáculo difieren tanto como dos espectáculos distintos: ese rasgo es sobre todo ruido del transcriptor. Cerca de 0, el rasgo es estable y describe a la murga.

| Rasgo | Qué mide | Mismo espectáculo | Espectáculos distintos | Razón |
|---|---|---|---|---|
| tonica | tiempo en tónica | 1,05 | 0,93 | 1,13 |
| subdom | tiempo en subdominante | 0,85 | 0,98 | 0,86 |
| topRacha | racha de la melodía en la misma nota | 0,62 | 0,88 | 0,71 |
| topTercera | la melodía salta una tercera | 0,65 | 0,91 | 0,71 |
| aire | parte del tiempo sin nadie cantando | 0,49 | 0,71 | 0,69 |
| dominante | tiempo en dominante | 0,63 | 0,91 | 0,69 |
| cromat | notas fuera de la escala | 0,65 | 1,00 | 0,66 |
| giros | cambios de dirección | 0,38 | 0,58 | 0,65 |
| resuelve | V que va a I | 0,62 | 1,00 | 0,61 |
| topSalto | la melodía salta una cuarta o más | 0,54 | 0,91 | 0,60 |
| paralelas | dos voces que se mueven juntas | 0,41 | 0,75 | 0,54 |
| topRepite | la melodía (nota de arriba) repite | 0,51 | 0,99 | 0,51 |
| frase | largo mediano de frase, en compases | 0,44 | 0,89 | 0,50 |
| golpesFrase | golpes por frase, mediana | 0,44 | 0,89 | 0,50 |
| dist2 | golpes a distancia de una corchea | 0,39 | 0,85 | 0,46 |
| segundas | vecinas a segunda o menos | 0,43 | 0,94 | 0,45 |
| texSigue | mismas voces que el golpe anterior | 0,19 | 0,43 | 0,44 |
| rachaRepite | largo de la racha de notas repetidas | 0,40 | 0,93 | 0,43 |
| uniMueve | el unísono se mueve más que el bloque | 0,47 | 1,12 | 0,42 |
| terceras | vecinas a distancia de tercera | 0,27 | 0,63 | 0,42 |
| topGrado | la melodía se mueve por grado | 0,42 | 1,03 | 0,41 |
| cuartas | vecinas a cuarta o quinta | 0,40 | 0,97 | 0,41 |
| tercera | la línea salta una tercera | 0,36 | 0,90 | 0,40 |
| grado | la línea se mueve por grado | 0,41 | 1,02 | 0,40 |
| sincopa | golpes en semicorchea impar | 0,37 | 0,96 | 0,39 |
| corcheas | golpes en lugar de corchea | 0,12 | 0,30 | 0,39 |
| ambito | ámbito de la línea por compás, en semitonos | 0,34 | 0,90 | 0,38 |
| densidad | golpes por compás | 0,33 | 0,89 | 0,37 |
| bloqueLargo | golpes largos a tres voces o más | 0,30 | 0,80 | 0,37 |
| aterriza | frases que terminan en nota larga | 0,33 | 0,92 | 0,35 |
| octavas | golpes con la melodía doblada a la octava | 0,28 | 0,80 | 0,35 |
| cambio | acordes por compás | 0,28 | 0,82 | 0,34 |
| repite | la línea repite nota | 0,32 | 0,95 | 0,33 |
| tresMas | golpes a tres voces o más | 0,30 | 0,94 | 0,32 |
| largas | notas largas (negra con puntillo o más) | 0,29 | 0,93 | 0,31 |
| salto | la línea salta una cuarta o más | 0,25 | 0,83 | 0,30 |
| span | de la voz de abajo a la de arriba, en semitonos | 0,23 | 0,88 | 0,27 |
| unaVoz | golpes a una voz | 0,16 | 0,76 | 0,20 |
| voces | voces por golpe | 0,15 | 0,75 | 0,19 |
| rachaLarga | racha de notas repetidas, percentil 90 | 0,00 | 1,33 | 0,00 |

## Lo que se aprende

- **La misma noche, otra grabación.** fan_granma es la misma actuación que la referencia, grabada desde otro lugar (el croma casi no cambia: costo DTW 0,023). Sus transcripciones coinciden en el 77 % de las notas y en el 81 % de la melodía. Es el techo de la cadena entre grabaciones: aunque el coro cante exactamente lo mismo, la toma, la mezcla y los cortes de 5 s cambian una de cada cuatro notas.

- **Noches distintas.** Entre noches distintas del mismo espectáculo coincide el 35 % de las notas (mediana de 11 tomas, entre 16 % y 55 %) y el 53 % de la melodía. La distancia hasta el techo de la misma noche es lo que la murga cambia de una noche a la otra, más lo que agregan las grabaciones peores (la tribuna, la televisión).

- **El filtro de trabas saca música.** En asaltantes_2024_retirada (18 % a 28 % en las 6 tomas), el filtro de trabas de `limpiar.js` saca muchas notas en todas las tomas, también en el disco, que no tiene aplausos ni habla. Si fueran trabas del transcriptor no caerían en el mismo lugar en grabaciones distintas, pero caen en el mismo lugar y sobre los mismos acordes. Es un recitado cantado: golpes picados y parejos sobre un acorde (en el disco de Asaltantes, 22 golpes sobre Sol mayor y 21 sobre Do, cada 0,23 s). El filtro los confunde con trabas porque son igual de regulares. En el corpus pesa poco: las rachas que el filtro saca y que caen en la grilla del tempo, con tres voces o más, suman unos 520 golpes, menos del 1 %. Queda anotado para mejorar el filtro.

- **Qué rasgos describen a la murga.** Los más estables entre noches, comparados con la diferencia entre espectáculos, son voces, unaVoz, span, salto, largas. En cambio, tonica, subdom cambian entre dos noches casi tanto como entre dos espectáculos: en el jurado pesan como ruido.

