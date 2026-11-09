# Reporte de la noche del 9 de noviembre de 2026

El pedido: trabajar toda la noche en la app (compositor, cantantes, UX/UI, letrista, docs), pero sobre todo **que suene
más creíble**. El registro con cada número y cada prueba está en `noche_2026-11-09.md`, en esta misma carpeta.

## Lo principal

| | al empezar | al terminar |
|---|---|---|
| Coro de bancos contra el coro real (banco del coro, ajuste · control; 1 = ya se nota) | 6,31 · 9,77 | **3,67 · 4,83** |
| Lo mismo, con letra (el banco más justo, nuevo) | 3,27 · 4,16 (04:58) | **3,62 · 2,64** |
| Coro de MBROLA contra el coro real | 6,23 · 8,08 | **5,46 · 5,89** |
| Coro de bancos: Whisper, letras mal (semillas 7 y 8) | 25,1 % y 26,6 % | **15,2 % y 14,9 %** |
| Coro de MBROLA: Whisper, letras mal (3 semillas) | 17,2 % | 18,4 % (igual) |
| Solista de MBROLA: Whisper | 16,4 % | **9,2 %** |
| Solista MIKE: Whisper | 8,3 % | **5,6 %** |
| Vibrato de nuestros cantores (los solistas reales: ±40 cents) | ±13 cents | ±39–41 cents |
| Letras: despedidas en presentaciones / versos repetidos (40 letras) | 36 / 49 | **0 / 0** |
| Letrista, tiempo por letra | 7,1 s | **3,8 s** (mismas letras) |

Ocho commits en main, todos subidos: c11f5a1, 4f92f64, 33cb2df, 2358ba3, 92fa8db, 816216c, a210909, a6015e7, más
a712e7e con el registro. Las pruebas de la página, del estudio y de la página con los bancos pasan enteras.

## Cómo medí «creíble»

Todo cambio se juzgó con tres cosas, y no a gusto:

- **El banco del coro.** Doce fragmentos de coros reales y nuestro coro cantando las mismas notas, comparados en
  timbre, «una voz», ataque y hueco. Da una distancia: 1 es «ya se nota». Los fragmentos van en dos grupos, ajuste y
  control, para no sobreajustar: un cambio sirve sólo si mejora los dos.
- **Los solistas de verdad.** 208 pasajes de una sola voz, sacados de 14 murgas (idea 2).
- **Whisper**, para ver que se siga entendiendo la letra (24 frases; 1 o 2 puntos son ruido).

## Las ideas, cómo las hice y qué dieron

### 1. El coro de bancos cantaba «demasiado junto»

- **La idea:** medir el coro de voces UTAU contra el real. Daba 6,31 · 9,77, y casi toda la distancia era «una voz»:
  las grabaciones resintetizadas con WORLD son muy limpias y los 12 cantaban clavados en la misma nota.
- **Cómo:**
  - cada cantor más abierto: 0,25 semitonos por cantor y 0,06 por nota, una desafinación nueva en banco.js;
  - más del temblor natural de la grabación;
  - una curva de color por voz, sacada contra el coro real (`curva_bancos.py`, `curvas_banco.js`);
  - gritan un poco (0,3), porque lo pediste.
- **Resultado:** 6,31 · 9,77 → **4,40 · 6,59** (−30 % · −33 %). El grito cuesta un 5 % y acerca el timbre.

### 2. Los solistas de verdad (un agente)

- **La idea:** separar de las grabaciones los pasajes donde canta uno solo, medir cómo canta y copiarlo.
- **Cómo:** el agente buscó en las 85 voces separadas con Demucs y encontró 670 pasajes de una voz. Para que el
  vibrato no confunda la prueba de «una sola voz», remuestreó la onda siguiendo la altura del cantor. Validó con
  coros armados a mano: 12 copias a ±20 cents pasan sólo el 1 %. Quedaron 208 pasajes estrictos, de 14 murgas, y midió
  todo con WORLD (`solistas_buscar.py`, `solistas_medir.mjs`, `docs/solistas_reales.md`).
- **Lo que encontró:** nuestros cantores vibraban un tercio de lo real y tarde, no entraban desde abajo, no se pasaban
  de la nota al ligar, la nota se movía la mitad y casi no caían al final de las frases:

  | | real | nuestros antes |
  |---|---|---|
  | vibrato | ±40 cents a 5,2 Hz, entra a los 260 ms | ±13, entra a los 390–440 ms |
  | entrada desde abajo | 219 cents | 27 |
  | se pasa al ligar | 34 cents | 1–2 |
  | caída final | 239 cents | 46 |

### 3. Cantar como ellos

- **Cómo:** `guion()` tiene opciones nuevas para pasarse de la nota al ligar, para las caídas y para la entrada desde
  abajo. Los valores van en `variacion.js` (`VARIACION_DIFONOS`, `ESTILO`, `ESTILO_BANCO`) y salen de cantar el solista
  de prueba hasta medir lo real, en cinco tandas.
- **Resultado en el solista:**
  - vibrato ±40,8 (MBROLA) y ±38,6 (MIKE), contra ±40 real;
  - entra a los 266 y 263 ms;
  - se pasa 34 cents;
  - caída de 181 y 217 cents.
- **Whisper:** MBROLA solo pasó de 16,4 % a **9,2 %** de letras mal; MIKE quedó igual (8,3 → 8,7 %).
- **Resultado en el coro (banco del coro):**
  - MBROLA: 6,23 · 8,08 → **5,46 · 5,89**;
  - bancos: 4,40 · 6,59 → **3,86 · 4,94**; al final de la noche, con lo de la idea 10, 3,67 · 4,83.
- **Whisper con el coro de MBROLA, tres semillas:** 17,2 % → 18,4 %, igual dentro del ruido.
- **Un hallazgo:** alargar las consonantes ayuda a MBROLA, pero en los bancos estira la grabación y se entiende menos.
  Por eso cada motor tiene su dicción.

### 4. El coro respira (otro agente)

- **La idea:** en el coro real se oye cuando toman aire, y el nuestro nunca respiraba.
- **Cómo:** el agente midió 2.777 arranques de frase reales, con ventanas de control para restar el ruido de sala:
  - hay soplo antes de un tercio de las frases;
  - el soplo está 34 dB abajo de las vocales, dura 200 ms y termina 90 ms antes de la voz;
  - tiene una joroba en 1,4–1,8 kHz;
  - respiran unos 7 de los 13.

  `respirar()` lo copia: la misma frase respira para todos y cada cantor decide con su semilla. Funciona con MBROLA y
  con los bancos.
- **Resultado:** el banco del coro da lo mismo con y sin respiraciones. Esto se juzga de oído.

### 5. El letrista

- **La idea:** leer letras. Encontré tres problemas: en la presentación se despedían («el adiós», «prometemos
  volver»), en la retirada llegaban («Buenas noches, carnaval») y repetían versos («Abran cancha» tres veces en una
  parte).
- **Cómo:**
  - cada forma saca del léxico lo que no le corresponde;
  - un verso que ya está en la parte paga una multa;
  - los versos cortos pueden ser un fragmento suelto. Los de 4 y 5 sílabas agudas no encontraban nada, y quedaba
    «nos despertamos» repetido y sin entrar.
- **Resultado en 40 letras (2205 versos):**

  | | antes | después |
  |---|---|---|
  | despedidas en presentaciones | 36 | 0 |
  | llegadas en retiradas | 10 | 0 |
  | versos repetidos | 49 | 0 |
  | versos que no entran | 28 | 0 |

### 6. Optimización fácil: el letrista 1,9 veces más rápido

El 70 % del tiempo se iba en partir palabras en sílabas, siempre las mismas. Ahora se guardan (`letra.js`). Las letras
salen idénticas, comparadas una por una, y pasa de 7,1 a 3,8 s por letra con la máquina ocupada.

### 7. El banco del coro, más justo

El banco cantaba todo con «a», sin consonantes, y el término «hueco» castigaba algo que la página no hace. Con
`--letra frases`, cada golpe canta una sílaba de verdad. El estilo nuevo también mejora ahí (MBROLA 5,42 · 6,17 → 4,99 ·
4,87), y se ve que nuestras consonantes cortan de más: el hueco queda en 6,4–7,0 dB, contra 4,8 del real.

### 8. UX/UI

- En el inspector de cada cantante hay tres valores nuevos: **«Entrada desde abajo»**, **«Caída al final»** y
  **«Respiración»**, y el vibrato llega a 0,8.
- Cada deslizador explica qué hace (antes sólo los de los bancos).
- **«Sólo un solista»** canta con la voz del primer primo del plantel (MIKE), si está.
- La prueba de la página (`probar_pagina.mjs`) pasa entera. Su «el tiempo no avanzó» no era un error de la página: el
  audio tarda un poco en arrancar, y fallaba igual antes de la noche.

### 9. Docs

- `docs/solistas_reales.md` y `docs/respiraciones.md`, nuevos.
- `docs/utau.md`: una sección nueva, «Que suene creíble».
- `docs/cantores_y_letras.md`: las reglas nuevas del letrista.
- README: el estilo y las respiraciones.

### 10. Las voces de banco que no se entendían (un agente)

- **El problema:** con Whisper, el coro entero de bancos se entendía peor que el de MBROLA (25,1 % de letras mal
  contra 16,5 %). Como solista, MIKE se entendía mejor que MBROLA, pero las voces japonesas, la italiana y las
  portuguesas nunca habían pasado por Whisper. Las medí una por una y daban de 17 a 40 %. Sheep Oveja, que es
  castellano, daba 24 %: perdía las consonantes del final de sílaba («esquina esperaba» → «ikinai se vea»).
- **Lo que encontró el agente,** sólo en banco.js:
  - **Un error general:** los pedazos de grabación se mezclaban en dB, y una consonante que se fundía con el silencio
    del pedazo siguiente se apagaba. Ahora se mezclan en potencia, como hace UTAU.
  - **En las notas cortas los pedazos se pisaban:** la sílaba siguiente arrancaba antes que la consonante. Reescribió
    `ubicar` para que cada vocal suene por lo menos el 40 % del camino.
  - **Arreglos en cada tabla de alias:**
    - Oveja: sacó el paso antes de la r y de b, d, g suaves, que metía una «rr» o una «mb» de más;
    - japonesas: las codas, los grupos y un silencio antes de p, t, k;
    - portuguesa: los grupos;
    - italiana: «barrio», que salía «barro».
- **Resultado** (letras mal, cada voz cantando sola, antes → ahora):

  | voz | antes | ahora |
  |---|---|---|
  | MIKE | 8,3 % | **5,6 %** |
  | Sanfu (italiano) | 17,3 % | **9,8 %** |
  | LongWei | 14,0 % | 11,8 % |
  | Sheep Oveja | 24,4 % | 17,3 % |
  | Vincen-oto Legato | 21,5 % | 17,4 % |
  | Sheep Cordeiro (portugués) | 26,8 % | 23,5 % |
  | Vincen-oto Ottava | 27,7 % | 26,0 % |
  | Vincen-oto Rubato | 33,1 % | 27,2 % |
  | Sheep Hitsuji (japonés) | 39,7 % | 27,5 % |

  La nota de cada voz en el plantel ahora dice cuánto se entiende, y se ve en el inspector al pasar el mouse. Además,
  los bancos respiran, y la caché de análisis tiene tope: llegaba a casi 2 GB por proceso.
- **El coro entero de bancos**, con Whisper: de 25,1 % a **15,2 %** de letras mal (semilla 7) y de 26,6 % a **14,9 %**
  (semilla 8). Pasó de entenderse peor que MBROLA a entenderse mejor.
- **La caché:** con el tope de la página (500 MB), las herramientas de Node, que abren los 11 bancos juntos, tardaban
  18 min en el banco con letra. Ahora usan 4 GB y tardan 6 min 39 s, con el mismo resultado. En la página no cambia
  nada: 160 s con 500 MB y 154 s con 1,5 GB, para la presentación de 4:16.

### 11. El pique de los bancos

Yo lo había dejado en 1,2 sin medirlo. Medido, 1,5 da 3,67 · 4,83 en el banco del coro, contra 4,41 · 5,79 con 1,2, y
se entiende igual. Quedó en 1,5.

## Para escuchar

**`murga_trabajo/utau/escuchar_noche.html`.** Es la misma retirada (La Trasnochada, semilla 56, los primeros 60 s, con
batería), en cuatro versiones: bancos antes y ahora, y MBROLA antes y ahora, con su letra. «Antes» es el motor de las
03:28 (commit 1a1838c). Para ver la letra, abrila con `node herramientas/servir.js`; el audio anda igual sin eso.

Los mp3 sueltos están en `murga_trabajo/utau/`:
- `murga_antes_bancos/`;
- `murga_noche3/`;
- `murga_antes_mbrola/`;
- `murga_noche3_mbrola/`.

Las frases de prueba de cada voz de banco, ya arregladas, están en `murga_trabajo/solista/solo_<voz>_arreglo/`.

## Lo que no funcionó

- Más corrimiento en el tiempo entre cantores: empeora (5,31 · 9,16).
- Abrir todavía más a los cantores de banco (0,30 y 0,08 por nota): mejora el ajuste y empeora el control. Era
  sobreajuste.
- En MBROLA:
  - brillo 0,8: peor;
  - dicción 1: el ataque empeora;
  - grito 0,9 o 0,3: sin ganador claro.
- Esfuerzo (cantar con la grabación de una nota más aguda): empate, y queda en 0.
- La entrada desde abajo medida en el solista salta mucho, porque hay pocas entradas por prueba. Quedaron valores
  intermedios.
- El compositor: su jurado le da casi 1,00 en todos los rasgos, así que no encontré nada fácil para ganar ahí.
- **Corregir el color de MBROLA contra el coro real** (`resto`, quedó apagado): le sobran graves y le falta el filo de
  3–4 kHz, igual en ajuste y en control. El timbre se acerca (5,8 → 4,3 dB), pero los ataques empeoran y la distancia
  total también (4,99 · 4,87 → 5,49 · 5,27; sólo los agudos, 4,91 · 5,23).
- **Emparejar las consonantes sonoras de MBROLA** (`huecoParejo` 6 o 4): casi igual, porque el hueco hondo lo hacen las
  sordas (p, t, k, s).
- **En el agente de los bancos:** cantar la ll como «y»; sacarle el paso a la r en Legato (empeoró 17,6 → 25,6); el
  mismo arreglo en Cordeiro (igual).

## Lo que queda para seguir

1. **Escuchar.** Los números dicen «más cerca del coro real» y «se entiende igual o mejor», pero el juicio es tuyo.
   Sobre todo:
   - las respiraciones: son lo medido, pero nadie las escuchó;
   - la caída al final de las frases: 2,5 semitonos en MBROLA, en el 40 % de los finales.

   Todo se ajusta en el inspector, o en `ESTILO`, `ESTILO_BANCO` y `RESPIRA`.
2. **Las consonantes cortan de más.** Con letra, el hueco entre sílabas queda en 6,4–7,0 dB, contra 4,8 del coro real
   (en los solistas: 12–14 contra 7). Falta un «parejo» del volumen en las consonantes, que no sea gritar.
3. **El banco del coro con letra de verdad.** Hoy usa sílabas de las 24 frases. Con la letra real de los 12 fragmentos
   (transcripta a mano), sería del todo justo.
4. **Las voces japonesas** siguen en 26–27 % de letras mal (Ottava, Rubato, Hitsuji). Whisper oye la jota como «hu» y
   la r japonesa como l o n. Hay dos caminos:
   - ponerlas en las cuerdas que no llevan la melodía;
   - buscar más bancos en castellano o en italiano: Sanfu, en italiano, quedó casi como MIKE.
5. **El timbre de MBROLA** es lo que más lo separa ahora del coro real (5–6 dB). La corrección directa (`resto`) acerca
   el color pero estropea los ataques. Habría que aplicarla sólo en el centro de las vocales, o buscar por qué el
   ataque se mide más lento.
6. **Whisper salta mucho** de una semilla a otra (Oveja daba 24 y 33 %). Para decidir algo fino, conviene medir con 3
   semillas.
7. **El reparto por defecto** (`bancos/plantel.json`): entre los primos, que llevan la melodía, cantan Hitsuji y
   Ottava, de las que menos se entienden. Las cambiaría por voces más claras, pero también cambia el color de la murga:
   lo decidís vos. La nota de cada voz ya dice cuánto se entiende.
8. **Para borrar a mano** (el sistema no me dejó): `D:\bancos_utau`, `D:\tmp\utau` y `D:\tmp\prueba_murga_zip`, que
   quedaron de antes de la noche.
