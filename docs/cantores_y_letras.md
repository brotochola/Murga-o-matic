# Murga cantada: cantores sintéticos y letras

`cantada/` es una página aparte del Murga-o-matic. Usa el mismo compositor (`motor/`) y los mismos loops de batería. Le agrega dos cosas: una letra que entra en la melodía y un coro que la canta. Todo corre en el navegador, sin red ni modelos.

| Archivo | Qué hace |
|---|---|
| `cantada/cantor/letra.js` | Separa en sílabas, encuentra la tónica, junta sinalefas y pasa la letra a fonemas rioplatenses. De la melodía saca los versos y reparte las sílabas en las notas. |
| `cantada/cantor/lexico.js` | Frases de murga, todas originales, etiquetadas por tema y por qué sujeto le cabe a cada acción. |
| `cantada/cantor/letrista_local.js` | El letrista: plantillas, búsqueda por métrica, rima y acentos, y diagnóstico de cada verso. |
| `cantada/cantor/coro.js` | De la pieza y la letra a lo que canta cada uno de los 13 cantores. |
| `cantada/cantor/cantor.js` | El cantor sintético: fuente glótica y formantes. |
| `cantada/cantor/eq.js`, `timbre.js` | Ecualizador de fase lineal y la curva medida contra un coro real. |
| `cantada/cantor/bateria.js`, `mezcla.js` | Loops cortados golpe por golpe, sala y mezcla. |
| `cantada/vista.js` | La partitura sincronizada y el panel "Cómo se hace". |

## 1. De la melodía a los versos

Cada golpe del coro es una sílaba. Una frase son los golpes entre dos respiraciones: un hueco de 3 semicorcheas o más, o una nota larga. Las frases de una o dos notas se pegan a la vecina, como levare o como remate. De cada verso se anota:
- la cantidad de sílabas cantadas;
- si termina agudo o llano: la última nota fuerte y larga lleva el acento final;
- los lugares fuertes, que son el 1 y el 3 del compás y las notas largas.

## 2. El letrista

No usa modelos de lenguaje. Para cada verso:
1. Elige una plantilla según la función de la parte: clarinada, estrofa, despedida, estribillo, canción final o bajada. Una plantilla es, por ejemplo, *sujeto + acción + complemento* o *"aunque" + crítica*.
2. La llena con bloques del léxico. Pesan más los del tema pedido, que sale de palabras clave del texto escrito. Cada acción sólo va con sujetos a los que les cabe.
3. Prueba variantes que estiran o achican: «y», «hoy», «otra vez». Cada una cuesta puntos.
4. Se queda con la de mejor puntaje entre las que tienen las sílabas exactas y el final correcto. El puntaje suma:
   - rima asonante con el verso par anterior;
   - sílabas acentuadas en los lugares fuertes;
   - el tema pedido en al menos uno de cada tres versos.

   Y resta palabras repetidas, bloques sin tema en común y empezar igual que el verso anterior.

El primer verso par de una estrofa fija la rima y prefiere terminaciones con muchas rimas posibles. El último verso de un estribillo o una bajada repite el primero si tienen la misma métrica.

Medido en 36 letras (unos 2000 versos):

| Medida | Resultado |
|---|---|
| Sílabas exactas | 99 % |
| Final correcto | 90 % |
| Versos pares que riman | 82 % |
| Tiempo por letra | 1 a 2 s |

Las sílabas que sobran o faltan se resuelven partiendo una nota o estirando una sílaba sobre dos notas (melisma). Lo decide un algoritmo de programación dinámica que premia las sílabas acentuadas en los tiempos fuertes.

## 3. El cantor

Es síntesis por formantes, tipo Klatt:
- **Fuente:** un pulso glótico de Rosenberg con polyBLEP, más jitter, shimmer y aire.
- **Tracto vocal:** cinco formantes en cascada con polo y cero nasal, más una rama paralela de agudos.
- **Consonantes:** fricción con pasabandas propios y oclusivas con cierre y ráfaga.
- **Timbre por cantor:** cada uno tiene su largo de tracto, vibrato irregular, desafinación y retraso.
- **Cuerdas:** 13 cantores, cuatro primos y la tercia sola.

Las consonantes del ataque se cantan antes del tiempo, y la vocal cae en el golpe.

### Calibrado contra La Trasnochada 2020

- **Timbre:** el coro sintético cantó las mismas notas transcriptas de los primeros 30 s a capela de la presentación 2020. El espectro promedio de las vocales se comparó con la grabación, de 100 Hz a 10 kHz, y la diferencia dio la curva del ecualizador. Error medio después: menos de 3 dB. Antes, la voz tenía 40 dB menos de agudos que el coro real y casi toda la energía entre 400 y 1300 Hz.
- **Consonantes:** se alineó sílaba por sílaba la letra de la despedida 2020: 147 sílabas en 146 golpes, minuto 43:58 del show completo, con el audio ajustado a 5 ms. Como ahí suena la batería, se midieron contrastes: los agudos justo antes de la vocal y cuánto caen los graves.

| Consonante | Coro real | Sintético antes | Sintético ahora |
|---|---|---|---|
| s inicial (agudos sobre la vocal) | +2,5 dB | +6,8 dB | +2,4 dB |
| s final | −0,4 dB: casi no se canta | +2,2 dB | −1,4 dB |
| p t k (caída de graves) | 3,7 dB | 8,2 dB | 4,8 dB |
| s inicial (caída de graves) | 5,7 dB | 7,0 dB | 5,7 dB |
| l m n r (caída de graves) | 2,9 dB | 4,3 dB | 4,1 dB |

En el coro real la energía baja apenas 2,4 dB entre sílabas: trece voces corridas unos milisegundos tapan los cortes de las consonantes. Por eso el sintético canta ligado y las consonantes sonoras casi no cortan la voz.

La letra de la despedida y el audio no están en el repositorio: se usaron sólo para medir.
