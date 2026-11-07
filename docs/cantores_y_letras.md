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

## 4. Voces de verdad, con Seed-VC (fuera de la página)

La página canta con el sintetizador de formantes y así va a seguir: anda en cualquier navegador y sin red. Para que suene a murguistas de verdad hay un camino aparte, que corre en tu computadora: cada cantor sintético pasa por [Seed-VC](https://github.com/Plachtaa/seed-vc), un conversor de voz cantada. Seed-VC conserva la altura y el ritmo de la entrada y le cambia el timbre por el de una voz de referencia de 1 a 25 segundos. La música, la letra y el reparto de sílabas no cambian.

| Archivo | Qué hace |
|---|---|
| `cantada/herramientas/exportar_voces.mjs` | Compone la pieza como la página y escribe la letra con el letrista. Guarda cada cantor seco y ecualizado, la batería y un `manifiesto.json` con paneo, ganancia y sala. |
| `transcripcion/convertir_coro.py` | Instala Seed-VC, elige las referencias, hace el ajuste fino si se pide, convierte cada voz y vuelve a mezclar. |

### Pasos

Desde la raíz del repositorio, con las voces separadas de `murga_lote.py` en `murga_trabajo/voces/`:

```bash
node cantada/herramientas/exportar_voces.mjs --forma retirada --estilo trasnochada --semilla 47 --por-cuerda
uv run transcripcion/convertir_coro.py instalar                      # una vez: Seed-VC y su Python 3.10
uv run transcripcion/convertir_coro.py referencias --murga "La Trasnochada"
uv run transcripcion/convertir_coro.py entrenar --murga "La Trasnochada"   # opcional
uv run transcripcion/convertir_coro.py convertir murga_trabajo/cantada/retirada_trasnochada_47
```

- `exportar_voces.mjs` acepta las mismas opciones que la página: `--forma`, `--estilo`, `--semilla`, `--tonica`, `--modo`, `--largo` y `--tema`. Con `--letra archivo.txt` canta una letra propia: un verso por línea y las partes separadas por una línea vacía.
- Con `--por-cuerda`, los cantores que cantan exactamente lo mismo se exportan una sola vez: hay menos voces para convertir. En la mezcla se vuelven a abrir con un retardo de 10 a 28 ms que oscila despacio, así cada copia se mueve entre 2 y 17 cents de afinación y no se va corriendo con el tiempo.
- `convertir` deja en la carpeta de la pieza `convertidas/` (cada voz), `coro_convertido.wav` y `mezcla_convertida.wav`. Para comparar deja también `mezcla_sintetica.wav`: las mismas voces sin convertir, mezcladas igual. Si se corta, al volver a correrlo sigue desde la voz que faltaba.
- La primera vez Seed-VC baja sus modelos de Hugging Face: el conversor, Whisper, BigVGAN, RMVPE y CAMPPlus, unos 2 GB. Son públicos y no piden cuenta.

### Las referencias

Seed-VC imita a una persona. Por eso `referencias` busca, en los tramos de la murga pedida, pasajes de 20 s que cumplan esto:
- se cantan al unísono, según los golpes del análisis;
- hay una sola voz, medido con las mismas cuentas de `pureza.py`: cuánta energía está pegada a los parciales;
- la voz suena fuerte y la batería poco, según la energía de cada parte separada.

Toma los mejores pasajes sin que se pisen, mejor de tramos distintos. Los ordena por altura: los más graves van para los bajos y los más agudos para la tercia. Por defecto son tres por cuerda, y los cantores de cada cuerda se los reparten. Con `--tipo coro` prefiere pasajes de todo el coro en vez de solistas. Las referencias quedan en `murga_trabajo/cantada/referencias/` con un índice `.json`: conviene escucharlas y sacar del índice las que tengan mucha batería o sean habladas.

### El ajuste fino

`entrenar` corta pasajes cantados de 12 s con poca batería, hasta 40 minutos, y corre el `train.py` de Seed-VC con el preset de voz cantada a 44,1 kHz durante 1000 pasos. El modelo queda en `murga_trabajo/seed-vc/runs/murga_<murga>/` y `convertir` lo usa solo si existe. Con `--sin-ajuste` lo ignora. Si la placa se queda sin memoria, se puede bajar a `--lote 1`.

### Después de convertir

Cada voz convertida se corrige antes de mezclar:
1. **Se alinea** con la sintética por la envolvente, en pasos de 5 ms: Seed-VC puede correrla unos milisegundos.
2. **Se silencia** donde la sintética calla, con 40 ms de margen, porque el conversor a veces inventa ruido en los silencios.
3. **Se lleva al mismo nivel** que la sintética, así se mantiene el balance entre cuerdas.

La mezcla es la de la página: la misma sala de Schroeder, los mismos paneos y ganancias, y la batería con el pico en 0,55 del pico del coro.

### Qué está probado y qué no

| Prueba | Resultado |
|---|---|
| Mezcla en Python de las voces exportadas contra la mezcla de la página, misma pieza, 13 cantores | Diferencia a −72 dB de la señal: el ruido de 16 bits |
| Elegir referencias en un tramo de 10 minutos de La Trasnochada, con la grabación completa en lugar de las voces separadas | 15 pasajes sin pisarse, en 2 s |
| Alineación ante corrimientos de −37 a +90 ms | Los encuentra con un error de 5 ms o menos |
| Compuerta sobre ruido agregado en los silencios | El ruido baja de −32 dB a −62 dB respecto de la voz |
| Dependencias de Seed-VC con Python 3.10 | Se resuelven en Linux, Windows y Mac, todas con ruedas o en Python puro, sin compilador |
| `instalar` en Linux sin placa de video | Termina bien: clona Seed-VC, arma su Python 3.10 e instala torch 2.4 y el resto |
| `entrenar`, sin correr el entrenamiento | Corta los pasajes más limpios y arma bien la llamada a `train.py` |
| La conversión misma | **Sin probar**: hace falta bajar los modelos de Hugging Face y una placa de video |

Lo que más puede fallar es la articulación. Seed-VC saca el contenido de la voz de entrada con Whisper. Si Whisper no reconoce bien las sílabas del cantor sintético, la voz convertida va a sonar a murga pero masticada. Si pasa, conviene probar con más pasos de difusión (`--pasos 50`) y con el ajuste fino. Si una GTX de la serie 16 devuelve ruido o silencio, el problema es la media precisión: hay que agregar `--fp32`.
