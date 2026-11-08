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
  - las demás duran 35 ms, filtradas, sin lo de arriba de 4 kHz, y quedan unos 24 dB debajo de la vocal.

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

## En la página

En **Voces**, la opción **Difonos** hace cantar a los trece cantores, en obreros. Una presentación de 4 minutos tarda unos 20 s en una compu de dos núcleos. Con **Sólo un solista**, el primero de los primos canta la melodía con la letra, solo, sobre la batería.

MBROLA está compilado a WebAssembly (85 KB) con `herramientas/compilar_mbrola.sh` y anda en un obrero. La voz es2 pesa 5,6 MB y se baja la primera vez. Una presentación de 4 minutos se canta en menos de un segundo.

MBROLA es AGPL-3.0. La voz es2 se puede usar sólo con MBROLA y copiar libremente mientras no se cobre. Los dos avisos están en `motor/vendor/mbrola/`.

## Lo que falta

- **Que no suene a locutor.** Las voces son de habla: las vocales largas se estiran repitiendo el mismo pedazo y pueden sonar quietas.
- **El acento.** Las voces son españolas, así que no tienen la "sh" rioplatense de «calle» o «llegó» (sale "y").
- **El coro.** Todos los cantores salen de la misma voz grabada. Con la garganta, la afinación y el vibrato de cada uno se diferencian, pero falta escuchar si el unísono suena a coro o a una voz con eco.
- **La tercia.** Sonaba demasiado aguda. El compositor la ponía con mediana en Do 5 y hasta Fa 5, que es el registro excepcional. Ahora va de Re 4 a Re 5, con mediana en La 4, como el registro normal de Sin Disfraz (fa4–do5). Sólo cambia la tercia: en 48 piezas de prueba, las demás cuerdas quedan idénticas.
- **El timbre.** Hay que medirlo contra el coro real, con el banco, para la curva de ecualización.
