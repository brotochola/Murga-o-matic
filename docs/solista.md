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
| Difonos es2, como en la página (consonantes ×1,1, temblor, vibrato 0,2, emisión) | 7,1 % | 21,1 % |
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
- **Eses.** Las de es2 son castellanas: largas (70 ms), fuertes (de 6 a 13 dB debajo de la vocal) y con el silbido en 5 kHz. Ahora:
  - duran 50 ms;
  - quedan unos 15 dB debajo de la vocal, con el silbido de 4,7 kHz recortado y más agudos arriba de 7,5 kHz, así el centro pasa de 5,7 a 7,1 kHz, más cerca de la s rioplatense;
  - antes de consonante se aspiran, como en el Río de la Plata ("lah luceh"): 32 ms, sin agudos, unos 25 dB debajo de la vocal.

## Cada cuerda

`cantorDifonos(tipo, semilla)` arma un cantor de cada cuerda:

- **Tracto.** Cada cuerda tiene su largo de tracto: los formantes se multiplican por 0,90 en los bajos, 0,95 en los segundos, 1 en los primos y 1,06 en los sobreprimos y la tercia. Se hace como con una cinta: MBROLA canta más agudo y más largo, y las muestras se tocan más rápido.
- **Mañas.** Cada cantor tiene las suyas, chicas y como en `variacion.js`: ±3 % de garganta, su afinación, su vibrato, cuánto pica al entrar y cuánto alarga las consonantes.

`herramientas/voces_difonos.mjs "frase"` canta la misma frase con cantores de cada cuerda, cada uno en su registro.

## En la página

En **Voces**, la opción **Un solista** hace que el primero de los primos cante la melodía con la letra, solo, sobre la batería.

MBROLA está compilado a WebAssembly (85 KB) con `herramientas/compilar_mbrola.sh` y anda en un obrero. La voz es2 pesa 5,6 MB y se baja la primera vez. Una presentación de 4 minutos se canta en menos de un segundo.

MBROLA es AGPL-3.0. La voz es2 se puede usar sólo con MBROLA y copiar libremente mientras no se cobre. Los dos avisos están en `motor/vendor/mbrola/`.

## Lo que falta

- **Que no suene a locutor.** Las voces son de habla: las vocales largas se estiran repitiendo el mismo pedazo y pueden sonar quietas.
- **El acento.** Las voces son españolas, así que no tienen la "sh" rioplatense de «calle» o «llegó» (sale "y").
- **El coro.** Falta sumar los trece cantores, con sus tiempos corridos, y probarlo en la página.
- **La tercia.** Canta hasta Fa 5, cinco veces la altura de la voz grabada, y puede sonar finita.
- **El timbre.** Hay que medirlo contra el coro real, con el banco, para la curva de ecualización.
