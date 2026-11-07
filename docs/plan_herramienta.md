# Plan: Murga-o-matic como herramienta para componer murga

Versión 1, 2026-11-07. Es un plan para discutir antes de construir: todavía no hay código de nada de esto.

## 1. Para qué es

Una herramienta para directores y letristas de murga. Sirve para bocetar, escribir, armonizar, escuchar y ensayar presentaciones y retiradas nuevas. No es un juguete que tira canciones al azar: todo lo que propone se puede editar, fijar y rehacer. Y lo que suena tiene que poder pasar por un coro de murga. Si suena "simpático", es un defecto.

### 1.1 Casos de uso

| # | Caso | Qué hace la herramienta |
|---|---|---|
| 1 | **Bocetar** una presentación o una retirada | Propone forma, armonía, melodía, voces y una letra borrador. El director escucha y cambia lo que no le sirve. |
| 2 | **Escribir letra sobre una melodía**, también una conocida (contrafactum) | Cuenta las sílabas sobre las notas, marca los acentos que caen mal, propone rimas y variantes que calzan. |
| 3 | **Poner música a una letra** | Propone ritmo y melodía que respetan los acentos del texto. |
| 4 | **Armonizar una melodía propia** (cantada al micrófono, tocada o importada en MIDI) | Arma las cuerdas a la manera de la murga: terceras, unísonos que abren en bloque, pedales, lailareo. |
| 5 | **Escuchar** con coro realista, la letra cantada y la batería real | Coro con motores intercambiables y los loops de La Tríada. |
| 6 | **Ensayar** | Guías de audio por cuerda, partitura con letra (MusicXML para MuseScore), MIDI con letra, modo lento y repetición de un pasaje. |
| 7 | **Grabar el banco de voces de la propia murga** | Así el coro sintético suena a ese coro. |

### 1.2 Lo que no es

- No es un editor de audio ni reemplaza a MuseScore. Exporta a ellos.
- No escribe letras con sentido. Escribe borradores métricamente exactos y le da al letrista herramientas para escribir las suyas.
- No usa modelos de AI adentro (sección 2).

## 2. Principios

1. **Sin AI adentro.** La herramienta usa reglas, tablas aprendidas contando datos (como hace hoy el compositor con los MIDI) y sonido sintetizado o grabado con permiso de quien canta. Nada de redes neuronales. La AI solo ayuda a diseñar y escribir el código.
2. **El director manda.** Todo lo generado es una propuesta. Cada parte (forma, armonía, melodía, voces, letra, batería, mezcla) se puede fijar con un candado, y rehacer una parte no mueve las que están fijadas.
3. **El realismo se mide.** El sonido se compara contra coros reales, con medidas y con pruebas a ciegas (sección 13). No vale "a mí me suena bien".
4. **Piezas intercambiables con contratos escritos.** Cada módulo recibe y entrega un formato de datos con versión. El cantor es intercambiable (decidido el 2026-11-07).
5. **Determinismo.** Cada módulo y cada sección usan su propio azar, derivado de la semilla. La misma entrada da la misma salida, y cambiar la letra no cambia la música.
6. **Todo en el navegador.** Corre en GitHub Pages, sin servidor. Lo pesado va en Web Workers, y una vez cargado anda sin internet.
7. **Lo que funciona no se rompe.** La música actual, la que se aprobó de oído, queda igual hasta que se decida cambiarla. Cada cambio se compara pieza por pieza contra la versión anterior: las demos y una grilla de semillas.

## 3. Arquitectura

### 3.1 La cadena

```
parámetros o material del director
        │
        ▼
     Forma ──► Armonía ──► Melodía ──► Voces ──► Prosodia ──► Letra
                              ▲                                 │
                              └──────────── Alineador ◄─────────┘
                                                │
                                                ▼
                        Fonética rioplatense ──► Interpretación ──► Cantor (motor intercambiable) ──┐
                                                                                                    ├──► Mezcla y sala ──► Escucha y exportación
                             Batería (loops reales, llamadas, cortes, golpes) ─────────────────────┘
```

La flecha de la letra a la melodía es la del caso 3: cuando la letra manda, el alineador le pide a la melodía un ritmo que respete los acentos.

### 3.2 El proyecto: un documento que todos leen y escriben

Todo vive en un solo documento, `pieza.json`, con número de versión del formato. Es lo que se guarda y se abre, lo que comparan las pruebas, y de donde salen todas las exportaciones.

| Parte | Contenido |
|---|---|
| `meta` | Título, autor, murga o estilo, parte (presentación, canción final, retirada), semilla, motor de canto, notas. |
| `forma` | Secciones con id, nombre, tipo (clarinada, coro, pleno, dúo, solo de tercia, puente a capela, canción final, bajada, cierre), compases, métrica (2/4, 4/4), tempo, tono y modo, dinámica, calderones, y batería (ritmo, llamada de entrada, corte de salida, fundido). |
| `armonia` | Acordes por medio compás: grado relativo y cifrado absoluto. |
| `golpes` | La unidad rítmica del coro homofónico: inicio en semicorcheas, duración, sección, frase y peso métrico. |
| `voces` | Qué nota canta cada cuerda en cada golpe, o si calla. Además, capas aparte: tercia, contracanto, pedal y lailareo. |
| `letra` | Estrofas, versos y sílabas. Cada sílaba apunta a uno o más golpes (melisma) y dice qué cuerdas la cantan, porque en un contracanto o un lailareo cada cuerda puede decir otra cosa. También lleva fonemas, acento, sinalefa y licencias. |
| `interpretacion` | Dinámica por golpe, articulación (ataque, picado, ligado), respiraciones, calderones y rubato de la clarinada. |
| `candados` | Qué partes están fijadas. |
| `mezcla` | Niveles por cuerda y de la batería, ubicación en el escenario y sala. |
| `historia` | Versiones anteriores, para deshacer y para comparar A/B. |

### 3.3 Módulos

| Módulo | Entra | Sale | Hoy | Qué cambia |
|---|---|---|---|---|
| **Forma** | Parte, estilo, largo, partes opcionales | Secciones | Dentro de `componer()` | Pasa a ser un módulo propio, con editor. |
| **Armonía** | Forma, estilo, modo | Acordes por medio compás | Tablas de `modelo.js` | Candado, edición y cifrado americano. |
| **Melodía** | Forma, armonía y, opcionalmente, moldes de la letra | La línea que lleva la melodía (en general, los primos) | Gestos reales recombinados | Modo "manda la letra" (fase 6). Modo por reglas puras (fase 8, opcional). |
| **Voces** (armonizador) | Melodía, armonía y textura pedida | Notas por cuerda | `voces()` y `formaBloque()` | Armoniza melodías de afuera, controla el rango de cada cuerda y avisa. Lailareo, pedal y contracanto pasan a ser texturas elegibles. |
| **Prosodia** | Golpes y frases | Moldes de verso | No existe | Nuevo (sección 5). |
| **Letra** | Moldes, tema, esquema de rima, candados y la letra del director | Sílabas asignadas a golpes | No existe | Nuevo: el letrista y el taller (sección 4). |
| **Alineador** | Una letra escrita y una melodía | Sílaba por golpe y ajustes de ritmo propuestos | No existe | Nuevo (sección 5). |
| **Fonética** | Sílabas | Fonemas con tiempos: la consonante antes del tiempo, la vocal en el tiempo | No existe | Nuevo, rioplatense y configurable (sección 6). |
| **Interpretación** | Voces, fonemas y forma | Una partitura de canto por cantor | El azar de `renderCuerda()` | Nuevo, con valores medidos del coro real (sección 7). |
| **Cantor** | Partituras de canto | Audio por cuerda | `renderCuerda()` con muestras "aah" | Motores intercambiables (sección 8). |
| **Batería** | Forma y golpes | Audio | `renderPercusion()` con loops rebanados | Editor por sección, golpes que siguen al coro, ensayo solo con bombo (sección 10). |
| **Mezcla y sala** | Audios | Mezcla y pistas separadas | `grafo()` y `procesar()` | Sala medida, escenario y guías de ensayo (sección 9). |
| **Exportación** | Pieza y audios | WAV, pistas, MIDI con letra, MusicXML con letra, texto y proyecto | WAV, MIDI y texto | MusicXML, pistas separadas y guías (sección 12). |
| **Jurados y pruebas** | Todo | Notas y alertas | `jurado.js`, `copia.js`, `probar_*.mjs` | Jurados de letra, de prosodia y de sonido, y prueba a ciegas (sección 13). |

### 3.4 Contratos

**Molde de verso** (de la prosodia a la letra):

```json
{ "frase": "s2-f3", "silabas": 9, "fuertes": [0, 3, 7], "final": "llana",
  "partibles": [7], "ligables": [[4, 5]], "pausaAntes": true, "tema": "despedida" }
```

- `fuertes`: qué sílabas caen en lugar fuerte.
- `partibles`: notas largas que se pueden partir para meter una sílaba más.
- `ligables`: pares de notas que se pueden cantar con una sola sílaba.

**Partitura de canto** (de la interpretación al cantor), una por cantor:

```json
{ "cantor": "primos-2", "cuerda": "primos",
  "voz": { "banco": "primos-juan", "tracto": 0.97, "afinacion": 6 },
  "eventos": [
    { "t0": 12.430, "t1": 12.910,
      "fonemas": [["t", -0.045, 0.0], ["a", 0.0, 0.48]],
      "f0": [[0, 57.0], [0.03, 57.06], [0.4, 56.98]],
      "dinamica": 0.8, "ataque": "seco" } ] }
```

- Los tiempos van en segundos.
- La afinación (`f0`) es una curva en notas MIDI con decimales.
- Los fonemas tienen tiempos relativos al ataque de la nota. Los negativos caen antes del tiempo.
- La partitura de canto no sabe de compases ni de acordes. Por eso cualquier motor puede cantarla.

**Interfaz de un motor de canto:**

```js
export const motor = {
  nombre: 'formantes',
  capacidades: { fonemas: [/* inventario */], rangos: { /* por cuerda */ }, cantoresMax: 16, necesitaBanco: false },
  async preparar(opciones) {},                        // carga bancos y precalcula
  async cantar(partituras, { sr, alProgresar }) {},   // → { stems: { primos: [L, R], ... } }
};
```

El motor corre en un Worker, sobre números en memoria (`Float32Array`), así que el mismo código corre en Node para medir. Web Audio no existe dentro de los Workers, y esta es otra razón para no depender de sus nodos.

**Banco de voz** (para el motor concatenativo): un índice JSON y archivos de audio por unidad. Cada entrada tiene la unidad (por ejemplo "ka"), su tipo (CV, VC o VV), nota, cuerda, cantor, inicio, fin, la zona estable de la vocal y las marcas de pulso. También lleva el permiso de quien la grabó.

### 3.5 Azar y candados

- Cada módulo y cada sección sacan su propio azar de la semilla: `semilla → hash(semilla, módulo, sección, vuelta)`. Rehacer la letra de una estrofa no cambia su melodía ni las demás secciones.
- "Otra" incrementa la vuelta de esa parte: se pueden recorrer alternativas y volver a una anterior.
- Los candados viven en el proyecto.

### 3.6 Rendimiento

| Qué | Meta |
|---|---|
| Componer una pieza | menos de 1 s |
| Letra de una pieza | menos de 0,5 s |
| Canto: primera sección audible | menos de 2 s |
| Canto: pieza entera | menos de 10 s, en segundo plano |
| Editar algo | se rehace solo lo afectado (sección y cuerda), con caché por huella de la entrada |

- Un Worker por cuerda, según los núcleos de la máquina.
- Los bancos de voz se cargan por cuerda y cuando hacen falta. Quedan en caché, para que la herramienta ande sin internet.

## 4. Letra: el letrista y el taller

### 4.1 Base de palabras

- **Base general:** el castellano de Wiktionary (por ejemplo, los extractos legibles de kaikki.org). Trae categoría, género, número, flexiones y pronunciación. Su licencia es CC BY-SA, así que los datos derivados quedan con la misma licencia y con atribución. La alternativa es el diccionario Hunspell es_UY, con licencia libre, pero sin categorías explícitas.
- **Procesado una sola vez:** `herramientas/lexico.js` genera `motor/datos/lexico.json` con palabra, lema, categoría, género, número, persona y tiempo, sílabas, sílaba tónica, claves de rima consonante y asonante, frecuencia y temas.
  - Se carga en dos niveles: unas 10.000 formas comunes primero y el resto después.
  - Meta de tamaño: menos de 400 KB comprimido.
- **Capa murguera y rioplatense**, hecha a mano y revisada por el director:
  - voseo (cantás, tenés, vení);
  - palabras uruguayas y lunfardo (gurí, botija, bo, laburo, guita, bondi);
  - carnaval (tablado, Momo, careta, disfraz, maquillaje, bombo, platillo, redoblante, febrero, corso);
  - lugares (barrios de Montevideo, la rambla, el puerto);
  - tópicos (luna, madrugada, esquina, vereda, boliche, conventillo, mate, vino);
  - emociones, y vocabulario social (laburante, pueblo, patrón).

  Cada palabra lleva sus temas.
- **"Mis palabras":** el director suma sus propias palabras, temas y fórmulas.
- **Ninguna letra real entra a la herramienta.** Solo palabras sueltas y fórmulas genéricas.

### 4.2 Reglas de palabra

Todas son exactas en castellano:

- **Silabeo.** Grupos que no se separan (pr, bl, tr…), diptongos y triptongos, hiato con tilde, h muda, y final como vocal y prefijos (sub-, des-) como excepciones.
- **Acento.** Lo da la tilde o, si no hay, las reglas de aguda, llana y esdrújula. Además, hay que distinguir las palabras átonas (artículos, preposiciones, pronombres pegados) de las tónicas. Esto importa para el canto: un "la" artículo puede ir en tiempo débil, un "luz" no.
- **Rima.** Se calcula sobre la pronunciación, no sobre la letra escrita, así que con seseo "casa" rima con "caza".
  - Consonante: igual desde la vocal tónica hasta el final.
  - Asonante: solo las vocales desde la tónica, con las reglas de diptongo.
- **Métrica cantada.**
  - Cuenta las notas, no las sílabas poéticas, aunque las dos cuentas se muestran.
  - La sinalefa (de_a) se aplica o no según la nota que toque.
  - Hiato, sinéresis y diéresis son licencias marcadas.
- **Prueba de oro:** unas 2.000 palabras con silabeo y acento conocidos, sacados de Wiktionary. La meta es 99 % o más de aciertos.

### 4.3 Gramática y estilo

- **Plantillas** en un lenguaje chico y documentado, para que el director escriba las suyas:

  ```
  [DET:g,n] [SUST:g,n|tema] [ADJ:g,n]
  que [VERBO:3s|tema] en [DET] [SUST]
  ¡[INTERJ]! [SUST:tema], [IMPERATIVO:vos]
  ```

- **Concordancia y conjugación:**
  - Concordancia de género y número.
  - Verbos regulares en -ar, -er e -ir, más una tabla de unos 150 irregulares (ser, estar, ir, venir, tener, poder, querer, decir, hacer, volver…).
  - Voseo, y pronombres pegados al verbo.
- **Temas por parte:**
  - Presentación: llegada, saludo, el espectáculo del año, el barrio, la murga.
  - Retirada: despedida, agradecimiento, nostalgia, la noche, volver el año que viene, el carnaval que termina.
  - Bajada: una frase corta y repetible.
  - Canción final: reflexión.
- **Estructura:** estrofas con esquema de rima (cuartetas ABCB o ABAB, pareados), estribillos que vuelven y una bajada que repite con variaciones.
- **Lailareo** para las capas sin texto ("la", "lai", "lar-ra-rá"), con los tres usos documentados en `INVESTIGACION.md`: melodía armonizada, contracanto y pedal.
- **"Sin sentido pero creíble":**
  - Un tema por estrofa, sin repetir palabras y con preferencia por sustantivos concretos.
  - Una lista de combinaciones a evitar, para que no salga algo ofensivo por accidente.

### 4.4 Búsqueda

- Para cada molde (sílabas, lugares fuertes, final y rima) se elige una plantilla y se llenan sus huecos.
  - Se recorre con azar y con vuelta atrás.
  - Se descarta temprano por cantidad de sílabas: cada hueco sabe cuántas sílabas pueden ocupar sus palabras.
- **Puntaje:**
  - Que las tónicas caigan en lugares fuertes, y castigo a una átona en una nota larga y fuerte.
  - La rima, la coherencia de tema y la frecuencia de las palabras.
  - Castigo por repetir.
  - Que el corte entre palabras caiga donde la frase respira.
- Sale una lista de alternativas ordenadas, y el director elige.

### 4.5 El taller del letrista

- **Editor verso por verso**, debajo de la melodía:
  - las sílabas bajo las notas, con las dos cuentas (cantada y poética) y las sinalefas, que se pueden prender y apagar;
  - en rojo, los acentos que caen mal;
  - un color por rima;
  - palabras repetidas y finales de verso.
- **Rimador:** busca por rima consonante o asonante, sílabas, acento, categoría y tema, con rimas rioplatenses.
- **Completar y variar:** termina un verso empezado, da diez variantes con la misma métrica y propone finales que rimen con otro verso.
- **Contrafactum:** se importa una melodía conocida (MIDI) o se marca el ritmo con golpes de tecla, y se escribe encima.
- **Hoja de letra** para los cantores: el texto con los cortes de sílaba que caen en cada nota y los acordes.

## 5. Prosodia y alineador

- **De la melodía al molde:**
  - Las frases salen como hoy: con huecos, notas largas y separación entre golpes.
  - Cada golpe tiene un peso métrico: primer tiempo, tiempo, contratiempo y nota larga.
  - Las anticipaciones sincopadas del candombe cuentan como lugar fuerte anticipado.
  - El final del verso (agudo o llano) sale de dónde cae el último lugar fuerte.
- **Ajustes chicos** con costo: partir una nota larga para meter una sílaba, o ligar dos notas cortas en una sílaba. Así la melodía manda sin trabar a la letra.
- **Cuando manda la letra:** los acentos del texto se vuelven un molde de ritmo, y la melodía elige gestos o reglas que lo respeten. Necesita cambios en el módulo de melodía (fase 6).
- **Estilos:** La Trasnochada recita (repite notas), así que pide más sílabas por compás; Agarrate Catalina camina por grado. Los moldes heredan esas diferencias.

## 6. Fonética rioplatense para cantar

- **Del texto a los sonidos,** con opciones:
  - seseo, siempre;
  - "ll" e "y" como [ʃ] o [ʒ];
  - la "j" como [h] suave;
  - la "s" al final de sílaba plena, aspirada o muda;
  - la "d" entre vocales firme o débil;
  - "r" simple y "rr" vibrante;
  - b, d y g suaves entre vocales;
  - la sinalefa como diptongo.
- **El tiempo del canto:**
  - La consonante del ataque va antes del tiempo: una oclusiva dura de 30 a 60 ms, la "s" de 80 a 120 ms, una nasal unos 60 ms y la "r" simple unos 20 ms.
  - La vocal entra en el tiempo, y la consonante final va al cierre de la nota.
  - En los agudos de primos y sobreprimos, las vocales se abren.
- **Dicción de coro:** un parámetro decide si todos atacan la consonante juntos o con la dispersión natural. Se mide en el coro real (sección 7).
- **Inventario de fonemas** documentado, con símbolos fijos: es parte del contrato con el cantor.

## 7. Interpretación: de la partitura al canto

- **Mapa de tiempo:** calderones, rubato en la clarinada, que va a las indicaciones del director, y aceleración en la retirada (regla 10 del análisis).
- **Cada cantor tiene:**
  - su retraso al atacar;
  - su desafinación y su deriva lenta;
  - su vibrato (velocidad, profundidad y demora);
  - su entrada desde abajo;
  - su manera de soltar la nota y de respirar al empezar la frase;
  - la dinámica por golpe, con acento en lo fuerte e hinchazón en las notas largas.
- **Valores medidos del coro real.** Son las voces separadas, que quedan en la máquina local y solo se usan para investigar:
  - el ancho del unísono (regla 12: 36 % de la energía a ±3 % de cada parcial);
  - el vibrato y la deriva, siguiendo la afinación de los unísonos con YIN;
  - la dispersión de los ataques;
  - las curvas de dinámica.

  Estos valores son los de fábrica. El director los mueve con perillas como "más prolijo" o "más de barrio".
- **Perfiles por murga:** La Trasnochada y Agarrate Catalina no cantan igual. Cada una tiene su perfil de interpretación.
- **Emisión** (`INVESTIGACION.md`): nasal, sobre todo en los agudos, potente, con resonancia faringo-nasal y un ataque agresivo, algo apretado. Son metas para los motores.

## 8. El cantor: motores intercambiables

| Motor | Cómo funciona | Realismo esperable | Trabajo | Licencia y datos |
|---|---|---|---|---|
| **Muestras "aah"** (hoy) | Muestras de coro afinadas y ecualizadas | Bueno en la "a"; no dice sílabas | Hecho | FluidR3 y MusyngKite |
| **Formantes** (100 % procedural) | Fuente glotal (pulso, ruido de aire, temblor) y tracto vocal (resonancias en cascada y en paralelo, nasal y consonantes) | Bajo a medio: se entiende, pero se nota sintético | Medio | Propio |
| **Muestras con filtros** | La "aah" a la que se le cambia la envolvente para hacer otras vocales, más consonantes sintéticas | Medio en las vocales; flojo en la "i" y la "e" | Bajo a medio | Las muestras de hoy |
| **Concatenativo con banco propio** | Unidades grabadas por cantores reales, pegadas y afinadas | **Alto**: así funcionan Vocaloid y UTAU, sin AI | Alto, porque hay que grabar | Grabación con permiso |
| **eSpeak-ng o MBROLA** | Voces de habla clásicas | Bajo, robótico | Bajo | Solo de referencia: MBROLA no es libre y eSpeak-ng es GPL |

Hay que decirlo claro: **el motor de formantes no va a pasar por un coro real.** Sirve para tener todo andando de punta a punta, para bocetar sin banco y como versión procedural. El camino al realismo es el concatenativo con voces grabadas.

### 8.1 Motor de formantes

- **Fuente:** un pulso glotal (modelo de Rosenberg o LF) con inclinación espectral variable, para que pueda sonar apretado o suelto, más ruido de aire sincronizado con el pulso, temblor de afinación y de volumen, y vibrato.
- **Tracto:**
  - cinco resonancias que se mueven por fonema, con transiciones suaves (coarticulación);
  - un par polo y cero para las nasales;
  - el racimo de formantes altos, entre 2,5 y 3,5 kHz, que da el "filo" de la voz murguera.
- **Consonantes:**
  - fricción con ruido filtrado según el lugar de la boca;
  - explosiones en las oclusivas;
  - en la "r", un corte breve;
  - las nasales y la "l", con sus resonancias propias.
- **Por cantor:** el tamaño del tracto escalado entre −4 % y +4 %, para que no sean clones.
- **Sintonía:** se ajusta contra el espectro medido del coro real, como se hizo con `herramientas/timbre.js`.

### 8.2 Motor concatenativo

- **Unidades:** consonante más vocal (CV), vocal más consonante (VC), transiciones entre vocales (VV) y vocales sostenidas, grabadas en varias notas por cuerda y con dos dinámicas.
- **Síntesis:**
  - Se elige la unidad más cercana en nota y contexto.
  - Se afina y se estira: TD-PSOLA para cambios chicos y el vocoder WORLD para cambios grandes. WORLD es procesamiento de señal clásico, no AI, con licencia BSD, y usa la misma familia de técnicas que los "resamplers" de UTAU.
  - Se funde en la zona estable de la vocal, y se suavizan las envolventes en las uniones.
- **Coro:** cada cantor usa la voz de otra persona, o por lo menos otra toma. Así la textura de coro es real y no un chorus.

### 8.3 El estudio: grabar el banco

- **Lista de grabación** para el castellano rioplatense:
  - todas las CV (unas 18 consonantes por 5 vocales);
  - los cierres VC más comunes (n, s o aspirada, l, r);
  - las transiciones VV;
  - las vocales sostenidas, en tres notas por cuerda;
  - los extras murgueros ("lai", "la", "ra").

  Unas 300 a 500 unidades, de 15 a 20 minutos de canto por persona.
- **Página "Estudio":**
  - nota guía y clic;
  - muestra la unidad, graba con el micrófono y revisa sola si hay afinación fuera, saturación, ruido o largo raro;
  - permite repetir la toma y muestra el avance;
  - registra el permiso de cada cantor (nombre y uso permitido).
- **Procesado:** corte por energía y afinación, borde entre consonante y vocal, marcas de pulso, nivelación, igualación de color entre cantores y compresión para la web (MP3 u Opus).
- **Tamaño:** de 5 a 15 MB por persona.
  - Se empieza con una o dos personas por cuerda, más variaciones sintéticas, y se mide si agregar más gente suma realismo.
  - Los bancos se cargan por cuerda y cuando hacen falta.
- **Privacidad:** un banco de personas reales se publica solo con su permiso. Si no, queda local: la página carga un archivo del disco.

### 8.4 Cómo sale un coro y no trece solistas

- Cada cuerda tiene sus cantores: la murga de concurso tiene hasta 13 voces en el coro. Por defecto: bajos 2, segundos 3, primos 4, sobreprimos 3 y tercia 1.
- No hay dos cantores con el mismo audio: cambian la unidad, la toma, la afinación, el retraso y el vibrato. Así no aparece el "sonido de fase" de las copias.
- El unísono tiene que sonar ancho, con el valor medido en la regla 12.

## 9. Sala y mezcla

- **Metas medidas en las grabaciones reales** (en la máquina local, sin publicarlas):
  - el espectro del coro;
  - el balance entre voces y batería por sección (ya tenemos las partes separadas por Demucs);
  - cuánta compresión tiene;
  - la sala: el Teatro de Verano es al aire libre, con reflexiones tempranas y una cola corta.

  La respuesta de la sala se sintetiza para que se parezca a lo medido. Medirla desde una grabación es aproximado.
- **Escenario:** cada cuerda en su lugar del estéreo, según la formación que diga el director, y la batería atrás.
- **Masterización:** compresión suave y limitador, hasta la sonoridad de las grabaciones reales.
- **Modos:**
  - "tablado", el realista;
  - "estudio", seco, para escuchar las voces;
  - "ensayo", con una cuerda adelante.

## 10. Batería

- Quedan los loops de La Tríada, rebanados para cambiar de tempo sin cambiar la afinación.
- Por sección: el ritmo, la llamada, el corte, el fundido y los cambios de tempo.
- **Golpes que siguen al coro:** los platillos pueden dejar la base para acentuar un ritmo del coro o responderle (documentado en `INVESTIGACION.md`).
  - Se hacen con golpes sueltos sacados de los mismos loops.
  - Lo mismo sirve para remates, cortes y finales.
- **Ensayo:** solo bombo, o clic.

## 11. Edición e interfaz

- **Vistas:**
  - Pieza: forma en el tiempo y candados.
  - Letra: el taller.
  - Partitura: piano-roll por cuerda, con golpes y acordes, donde se editan las notas.
  - Mezcla, Estudio y Exportar.
- **Acciones:** rehacer una parte o una sección, comparar dos versiones, deshacer y rehacer, guardar y abrir el proyecto, y autoguardado.
- **Para ensayar y dirigir:**
  - Tocar a menor velocidad sin cambiar el tono.
  - Repetir un pasaje.
  - Cuenta de entrada.
  - Transportar la pieza entera.
  - Un informe de rangos por cuerda ("los primos llegan al la4 en el compás 23"), cuánto tiempo pasa cada cuerda en el agudo y dónde puede respirar.
  - Duración de cada parte contra una meta: la presentación ronda los 5 minutos y la retirada llega a 10.
- **Que se escuche rápido:** la primera sección suena mientras se cantan las otras.
- **Celular:** escuchar y leer la letra anda en el teléfono. Editar es para la computadora.

## 12. Exportación

- **Audio:**
  - la mezcla en WAV;
  - una pista por cuerda y otra para la batería;
  - una guía de ensayo por cuerda (esa cuerda +6 dB, el resto −10 dB; opcionalmente solo con bombo).
- **MIDI:** una pista por cuerda, con la letra (evento de letra por sílaba), los acordes como texto, marcas de sección y el mapa de tempo.
- **MusicXML:** una parte por cuerda, con la letra bajo las notas, cifrado, secciones y marcas de ensayo. Se abre en MuseScore, Sibelius o Finale.
- **Texto:** hoja de letra con cortes de sílaba y acordes, y cancionero con cifrado para guitarra (la canción final y algunas retiradas llevan guitarra).
- **El proyecto:** `pieza.json`.

## 13. Evaluación y pruebas

### 13.1 Pruebas automáticas

| Prueba | Qué controla |
|---|---|
| Silabeo, acento, rima, sinalefa, conjugación, fonética | Prueba de oro y casos de borde |
| `probar_letra.mjs` | Miles de moldes: sílabas exactas, rimas válidas, concordancia, sin repetir |
| `probar_prosodia.mjs` | Que los moldes coincidan con las frases, y que las tónicas caigan en lugar fuerte |
| `probar_canto.mjs` | Que el audio no tenga valores inválidos ni saturación, que cada nota esté en su tiempo (±10 ms) y afinada (±10 cents, medido con YIN sobre lo cantado) |
| `probar_compositor.mjs` y `probar_pagina.mjs` | Ya existen y se amplían |
| Comparación de versiones | Las demos y una grilla de semillas contra la versión anterior: cada diferencia se explica |

### 13.2 Jurados

- **Música:** `jurado.js` y `copia.js`, como hoy.
- **Letra:** rasgos medidos sobre letras reales que el director cargue en su máquina, sin publicarlas: largo de versos, esquemas de rima, campos de palabras y repeticiones. Además, el director lee y puntúa estrofas.
- **Sonido:** contra las voces separadas reales, que quedan locales: distancia de espectro, espectro de modulación (cuánto late el volumen en la frecuencia de las sílabas), dispersión de ataques, ancho del unísono y afinación.

### 13.3 Prueba a ciegas

- Una página mezcla fragmentos de coro real (solo en la máquina local) con fragmentos de cada motor. El director, y otros murguistas si se puede, puntúan de 0 a 100 cuánto suena a coro de murga, sin saber cuál es cuál. El real va escondido como referencia.
- El puntaje se guarda por versión de cada motor: así se ve si el realismo avanza o si nos estamos engañando.
- **Meta final del motor concatenativo:** que en fragmentos de 10 segundos el director no distinga con seguridad el sintético del real. Antes hay metas intermedias por fase.

## 14. Fases

Cada fase deja algo útil por sí sola y tiene un criterio para darla por terminada.

| Fase | Qué se hace | Criterio de terminado |
|---|---|---|
| **F0. Contratos y esqueleto** | Formato `pieza.json` con validación. Azar por módulo y sección. El compositor actual pasa a escribir el proyecto. Las exportaciones salen del proyecto. | Las demos y 2.400 piezas de la grilla salen idénticas a las de hoy. |
| **F1. Palabras** | Léxico, silabeo, acento, rima, sinalefa y fonética, con pruebas. El rimador en la página. | 99 % o más en la prueba de oro. El director usa el rimador y le sirve. |
| **F2. Letra** | Prosodia, letrista, alineador y el taller. MIDI y MusicXML con letra, aunque el coro siga diciendo "aah". | El 100 % de los versos con las sílabas exactas. El director revisa 20 estrofas y las da por creíbles como borrador. |
| **F3. Formantes** | Motor de formantes, interpretación y medición. A/B contra las muestras. | El director entiende el 80 % o más de una lista de sílabas de prueba, y el espectro queda a ±6 dB del coro real. |
| **F4. Concatenativo** | El estudio y un piloto con una persona en una cuerda. Después, el coro entero. | La prueba a ciegas mejora fase a fase hasta la meta de la sección 13.3. |
| **F5. Editor** | Candados, rehacer por partes, deshacer y proyecto. Guías de ensayo y pistas separadas. | El director arma una presentación entera con la herramienta. |
| **F6. Material propio** | Armonizador de melodías propias, entrada por micrófono (YIN o pYIN, sin AI), importar MIDI y el modo "manda la letra". | Una melodía cantada por el director sale armonizada a cuatro cuerdas y con su letra alineada. |
| **F7. Sala y batería** | Sala y mezcla medidas, editor de batería y modo sin internet. | El balance de voz y batería cae dentro del rango real, y la página anda sin conexión. |
| **F8. Reglas puras (opcional)** | Un compositor 100 % por reglas, a partir de las 13 reglas del análisis. | Iguala o supera a los gestos en el jurado y en la prueba sin espiar. |

**Dependencias:**
- F0 va antes que todo.
- F1 va antes que F2.
- F3 necesita los fonemas de F1, pero puede empezar en paralelo a F2 con letras de prueba.
- F4 usa la interfaz de F3.
- F5 puede avanzar en paralelo una vez que esté F2.

## 15. Riesgos

| Riesgo | Cómo bajarlo |
|---|---|
| La síntesis no llega a sonar real | Motor concatenativo con voces grabadas, y prueba a ciegas para no engañarnos |
| Grabar el banco (tiempo, calidad, permiso) | Lista de 15 a 20 minutos por persona, guía, controles automáticos y permiso escrito |
| Licencia del léxico (CC BY-SA) | Atribución y la misma licencia para los datos derivados, o usar Hunspell |
| Rendimiento en el navegador | Workers, caché, rehacer solo lo cambiado y presupuesto de tamaño de los bancos |
| Que la herramienta se vuelva complicada | Construirla alrededor de cómo trabaja el director, probando con él en cada fase |
| Derechos de autor | Ni letras ni grabaciones reales en lo publicado. Los loops de La Tríada salen de un video público: conviene pedirles permiso. |
| Que el proyecto crezca sin fin | Fases cerradas, cada una útil por sí sola |

## 16. Lo decidido y lo pendiente

**Decidido:**
- No usar modelos de AI dentro de la herramienta.
- El cantor es intercambiable.
- Las voces con recortes de grabaciones reales se descartaron, y la batería son los loops reales.

**Propuesto, falta confirmar:**
- Que la melodía mande, con ajustes chicos, y que exista también el modo en que manda la letra.
- Un tema por estrofa.
- Que el bloque cante la misma letra y la tercia adorne.
- Que el compositor siga con los gestos reales hasta la fase 8.
- Que la tonada rioplatense sea configurable.

## 17. Preguntas para el director

1. ¿Cómo trabajás: letra primero, música primero o contrafactum sobre melodías conocidas?
2. ¿Qué versos y rimas usás en presentaciones y retiradas? ¿De cuántas sílabas, en cuartetas, con estribillo?
3. ¿Cuál es la formación en el escenario (orden de las cuerdas) y cuántos cantores tiene cada cuerda en tu murga?
4. Sobre la dicción: ¿la "s" se aspira al cantar? ¿"sh" o "zh"? ¿Cuánto vibrato tiene el coro?
5. ¿Tu murga grabaría el banco de voces? ¿Con qué equipo?
6. ¿Con qué ensayan: MuseScore, cifrado, de oído? ¿Les servirían guías en audio?
7. ¿Hacen falta el cuplé y el salpicón, o alcanza con presentación, canción final y retirada?
8. ¿Qué palabras, temas o fórmulas usás siempre?

## 18. Qué se reutiliza

- `motor/compositor.js` se divide en forma, armonía, melodía y voces, sin cambiar la música (F0).
- `motor/app.js` se divide en interfaz y render. El motor de canto "muestras" es el `renderCuerda()` de hoy; la batería y la mezcla siguen como están.
- `motor/modelo.js` sigue siendo el dato de armonía, melodía y voces.
- `herramientas/` conserva el análisis y el jurado. Se suman el armado del léxico, las mediciones de interpretación y sala, y las pruebas nuevas.
- `murga_trabajo/` sigue siendo la fuente de las mediciones. El audio queda local.
