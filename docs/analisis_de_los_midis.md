# Qué canta una murga de verdad: análisis de 85 tramos de La Trasnochada y Agarrate Catalina, más otras 13 murgas

Este documento mide lo que canta el coro en 42 espectáculos: 515 minutos de canto, 150.573 notas y 62.734 golpes de coro. Es la base del generador: cada regla de acá es algo que el Murga-o-matic hace porque el corpus lo hace.

Todo sale de las herramientas de `herramientas/`, en Node y sin dependencias. Este archivo lo escribe `node herramientas/informe.js`: no se edita a mano.

> **Antes de leer.** Las notas no vienen de partituras: salen de separar las voces con Demucs y transcribirlas con MuScriptor. El transcriptor nunca escuchó una murga y se equivoca; lo que se hizo con esos errores está en la sección 1.2. Los números sirven para comparar y para generar, no como transcripción fiel de cada obra. Los acordes se validaron contra cifrados humanos (sección 5.3).

---

## 0. Lo esencial

1. **Se canta en bloque, y el bloque no cambia a cada rato.** El 77 % de los golpes tiene las mismas voces que el anterior. La textura se mantiene por frase: esto es lo primero que delata a un generador que decide nota por nota.
2. **La melodía es la nota de arriba del bloque.** Se mueve poco: repite el 45 % de las veces, va por grado el 36 %, salta una tercera el 11 % y más que eso el 8 %.
3. **Se recita y se aterriza.** El 40 % de los golpes está en una racha de tres o más notas iguales: el coro dice el texto sobre una nota y después se mueve (baja un grado 34 %, sube un grado 27 %).
4. **Las frases son cortas y terminan en nota larga.** Duran 1,6 compases de cuatro tiempos, unos 7 golpes, y el 69 % termina en una nota larga. Hay aire: nadie canta durante el 13 % del tiempo.
5. **El pulso es de corcheas.** El 81 % de los ataques cae en lugar de corchea. Lo más común es la línea pareja de corcheas, y las frases arrancan en cualquier corchea del compás, no sólo en el 1.
6. **El coro va en terceras.** Dos voces vecinas están a tercera el 63 % de las veces. Las voces interiores casi no saltan: 2,2 % de saltos de cuarta o más.
7. **En los apoyos, la melodía está en el acorde.** El 82 % de las notas fuertes es nota del acorde; en las débiles, el 77 %.
8. **La armonía es tónica y dominante, con color.** En mayor, I 40 %; en menor, i 41 % y V7 15 %. El paso más común es V7 a tónica. Hay dominantes secundarias (I7 hacia el cuarto grado, II7, III7) y bVI y bVII en menor.
9. **La presentación entra a capela.** Mediana de 31 segundos sin batería, y después un bloque largo al mismo tempo, cerca de 123 negras por minuto.
10. **La retirada acelera.** Empieza cerca de 119 y termina cerca de 135: el último tempo es 16 % más rápido que el primero. Tiene pasajes a capela en el medio, la presentación casi nunca.
11. **Las tonalidades suben.** De 113 cambios de tono, 18 son un semitono arriba en el mismo modo: es el cambio más común.
12. **El unísono es real, y es ancho.** El transcriptor anota una voz en el 26 % de los golpes, y en el 82 % de ellos no hay rastro de otra voz, ni arriba ni abajo. Con una ventana angosta parecen impuros (19 % de la energía en los parciales): trece personas no afinan exacto, y la energía se reparte alrededor de cada parcial (36 % con una ventana de ±3 %).
13. **Cada murga tiene su modo.** La Trasnochada: presentación menor (88 %), retirada mayor (80 %); Agarrate Catalina: presentación mayor (71 %), retirada menor (63 %). De Asaltantes con Patente y Cayó la Cabra y Curtidores de Hongos y Doña Bastarda y Falta y Resto y La Gran Muñeca y La Nueva Milonga y Los Diablos Verdes y Metele que son Pasteles y Nos Obligan a Salir y Patos Cabreros y Queso Magro y Un Título Viejo hay muy pocos tramos para decir algo.

---

## 1. Qué se analizó

| Tramo | Espectáculo | Largo | Notas | Quitadas | Compases | Tonalidades |
|---|---|---|---|---|---|---|
| Catalina 2008 presentacion | El viaje | 4:07 | 1251 | 3 % | 160 | Mib mayor |
| Catalina 2008 retirada | El viaje | 7:30 | 2236 | 9 % | 269 | Fa menor, Fa mayor |
| Catalina 2010 presentacion | Civilización | 4:42 | 1537 | 3 % | 159 | Sib menor, La mayor |
| Catalina 2010 retirada | Civilización | 10:48 | 2946 | 5 % | 419 | Sol mayor, Lab menor |
| Catalina 2011 final y retirada | Gente común | 10:53 | 1877 | 42 % | 356 | Sol menor, Fa# mayor |
| Catalina 2011 presentacion | Gente común | 4:37 | 1490 | 2 % | 196 | Re mayor |
| Catalina 2012 presentacion | La comunidad | 3:47 | 917 | 11 % | 107 | Sol menor, Re menor |
| Catalina 2012 retirada | La comunidad | 6:56 | 2260 | 5 % | 238 | Do# menor, Do mayor |
| Catalina 2019 presentacion | — | 5:05 | 1357 | 3 % | 203 | Sib mayor, La mayor |
| Catalina 2019 retirada | — | 9:33 | 2389 | 13 % | 312 | Mib mayor, Do menor |
| Catalina 2020 final y retirada | — | 11:29 | 2941 | 26 % | 351 | La menor, Sib mayor |
| Catalina 2020 presentacion | — | 4:55 | 1415 | 3 % | 157 | Mi mayor |
| Catalina 2022 cancion final | — | 1:39 | 213 | 1 % | 56 | Do# menor |
| Catalina 2022 presentacion | — | 5:10 | 1737 | 3 % | 185 | Fa mayor, Re menor |
| Catalina 2022 retirada | — | 7:46 | 2698 | 2 % | 281 | Fa mayor, Mi mayor |
| Patente 2023 presentacion | Quién da más | 2:38 | 953 | 2 % | 77 | Sol menor, Re mayor |
| Patente 2023 retirada | Quién da más | 8:10 | 2591 | 4 % | 281 | Mib mayor, Mib menor |
| Patente 2024 retirada | — | 6:56 | 2018 | 21 % | 267 | Sol mayor |
| Patente 2025 presentacion | Qué querés inventar | 2:53 | 986 | 15 % | 98 | Fa mayor |
| Patente 2025 retirada | Qué querés inventar | 6:05 | 1694 | 8 % | 218 | Sol menor, Re mayor |
| Cabra 2025 final y retirada | — | 9:20 | 1756 | 5 % | 320 | Lab menor, Sol mayor |
| Cabra 2025 presentacion | — | 3:20 | 675 | 10 % | 101 | Sib mayor, Sol menor |
| Cabra 2026 presentacion | La república de la vereda | 3:11 | 1106 | 2 % | 97 | Do menor, Do mayor |
| Cabra 2026 retirada | La república de la vereda | 10:47 | 2301 | 22 % | 336 | Sol mayor, Lab menor |
| Hongos 2025 presentacion | — | 3:43 | 1236 | 3 % | 120 | Mib menor, Mib mayor |
| Hongos 2025 retirada | — | 7:02 | 1842 | 4 % | 222 | Sol mayor, Sol menor |
| Bastarda 2024 presentacion | — | 3:51 | 904 | 6 % | 132 | Mib menor, Sol mayor |
| Bastarda 2024 retirada | — | 6:02 | 1660 | 4 % | 190 | La menor, La mayor |
| Bastarda 2025 presentacion | — | 3:04 | 940 | 12 % | 103 | Do# menor |
| Bastarda 2025 retirada | — | 5:46 | 1496 | 9 % | 214 | Si menor, Do menor |
| Bastarda 2026 presentacion | Patria o tumba | 4:26 | 1013 | 4 % | 156 | La menor |
| Bastarda 2026 retirada | Patria o tumba | 7:24 | 2159 | 3 % | 266 | Si menor, Si mayor |
| Resto 2026 presentacion | — | 3:20 | 740 | 3 % | 111 | Mi menor |
| Resto 2026 retirada | — | 8:17 | 2025 | 26 % | 272 | Do mayor, Do menor |
| Muñeca 2016 final y retirada | — | 9:31 | 2848 | 4 % | 264 | Mi mayor, Do mayor |
| Muñeca 2016 presentacion | — | 2:55 | 948 | 4 % | 85 | Re menor, Mib menor |
| Muñeca 2020 presentacion | — | 3:14 | 1171 | 7 % | 114 | Si mayor, Mi mayor |
| Muñeca 2020 retirada | — | 6:49 | 1861 | 3 % | 246 | Mib mayor, Lab mayor |
| Muñeca 2023 presentacion | — | 3:34 | 1345 | 17 % | 109 | Sol mayor, Si menor |
| Muñeca 2023 retirada | — | 6:06 | 1802 | 3 % | 188 | Lab mayor, Lab menor |
| Muñeca 2024 presentacion | — | 3:01 | 1078 | 4 % | 119 | Mi menor, Lab mayor |
| Muñeca 2024 retirada | — | 7:54 | 1794 | 13 % | 264 | Sol menor, Sib mayor |
| Muñeca 2025 presentacion | — | 3:25 | 901 | 4 % | 113 | Sol mayor, Sol menor |
| Muñeca 2025 retirada | — | 6:50 | 1813 | 9 % | 229 | Fa# menor, Fa# mayor |
| Muñeca 2026 presentacion | — | 3:51 | 1236 | 2 % | 144 | Mi menor, Sib mayor |
| Muñeca 2026 retirada | — | 7:24 | 2165 | 3 % | 268 | Re menor, Fa mayor |
| Milonga 2023 final y retirada | — | 9:35 | 2732 | 4 % | 331 | Sib menor, Lab menor |
| Milonga 2023 presentacion | — | 3:43 | 1608 | 4 % | 128 | Si menor, Fa# mayor |
| Milonga 2024 presentacion | — | 4:18 | 1580 | 4 % | 149 | Sol menor, Lab menor |
| Milonga 2024 retirada | — | 6:47 | 2860 | 8 % | 241 | Lab mayor, Do menor |
| Milonga 2026 presentacion | — | 3:45 | 1529 | 4 % | 126 | Do menor, Si menor |
| Milonga 2026 retirada | — | 7:42 | 2340 | 6 % | 257 | Mib mayor, Mib menor |
| Trasnochada 2017 final y retirada | — | 10:23 | 2884 | 4 % | 378 | Mib mayor, Fa# mayor |
| Trasnochada 2017 presentacion | — | 4:30 | 1419 | 3 % | 145 | Fa# menor, Fa menor |
| Trasnochada 2019 final y retirada | — | 12:00 | 3159 | 11 % | 409 | Si menor, Sib mayor |
| Trasnochada 2019 presentacion | — | 3:59 | 1312 | 3 % | 139 | Lab menor, Sol menor |
| Trasnochada 2020 cancion final | El puerto de la memoria | 3:10 | 1038 | 4 % | 85 | Sol mayor, Do mayor |
| Trasnochada 2020 presentacion | El puerto de la memoria | 3:40 | 1335 | 4 % | 105 | Do# menor, Do menor |
| Trasnochada 2020 retirada | El puerto de la memoria | 9:51 | 3200 | 17 % | 323 | Fa# menor, Mi mayor |
| Trasnochada 2022 final y retirada | Popular | 12:50 | 3149 | 14 % | 431 | Lab mayor, La mayor |
| Trasnochada 2022 presentacion | Popular | 4:14 | 1550 | 4 % | 160 | Do menor, Si menor |
| Trasnochada 2023 final y retirada | La historia del Mago Flores | 10:03 | 2287 | 6 % | 320 | La menor, Sib mayor |
| Trasnochada 2023 presentacion | La historia del Mago Flores | 4:12 | 1144 | 14 % | 133 | Lab mayor, Sol mayor |
| Trasnochada 2024 final y retirada | La misma luna | 11:26 | 2716 | 26 % | 341 | Fa# mayor, Mib menor |
| Trasnochada 2024 presentacion | La misma luna | 2:52 | 991 | 5 % | 85 | Sib menor, Fa# mayor |
| Trasnochada 2025 final y retirada | Belleza | 8:49 | 2623 | 12 % | 281 | Re mayor, Do menor |
| Trasnochada 2025 presentacion | Belleza | 3:00 | 967 | 4 % | 98 | Do menor, Si menor |
| Trasnochada 2026 cancion final | Los falsificadores de siempre | 2:36 | 505 | 2 % | 84 | Lab menor, Do# menor |
| Trasnochada 2026 presentacion | Los falsificadores de siempre | 3:44 | 1246 | 2 % | 111 | La menor, Do mayor |
| Trasnochada 2026 retirada | Los falsificadores de siempre | 7:59 | 2435 | 3 % | 269 | Sol mayor, Sol menor |
| Verdes 2026 presentacion | — | 4:17 | 1403 | 2 % | 155 | Fa# mayor, Si mayor |
| Verdes 2026 retirada | — | 6:06 | 2158 | 5 % | 179 | Sib menor, La mayor |
| Pasteles 2020 presentacion | — | 4:35 | 1328 | 21 % | 164 | Fa# mayor, Si mayor |
| Pasteles 2020 retirada | — | 8:06 | 2595 | 2 % | 321 | Mib mayor, Lab mayor |
| Pasteles 2023 final y retirada | — | 11:01 | 3450 | 24 % | 313 | Mi mayor, Si mayor |
| Pasteles 2023 presentacion | — | 2:52 | 1253 | 3 % | 90 | Re mayor, Sib menor |
| Salir 2023 presentacion | — | 3:46 | 1552 | 5 % | 138 | Si menor, Do mayor |
| Salir 2023 retirada | — | 8:24 | 2854 | 10 % | 302 | Si menor, Re mayor |
| Salir 2024 presentacion | — | 2:54 | 1214 | 4 % | 105 | La menor, La mayor |
| Cabreros 2026 presentacion | — | 3:23 | 1132 | 5 % | 118 | Si menor, Sol menor |
| Cabreros 2026 retirada | — | 9:24 | 2523 | 7 % | 313 | Mi mayor, Fa menor |
| Magro 2024 presentacion | — | 4:11 | 1727 | 2 % | 126 | Lab mayor, Fa menor |
| Magro 2024 retirada | — | 6:29 | 2370 | 3 % | 233 | Do mayor, Si menor |
| Viejo 2026 presentacion | — | 3:12 | 1035 | 3 % | 110 | Sol menor, Fa# menor |
| Viejo 2026 retirada | — | 11:35 | 3049 | 5 % | 381 | Si menor, Do# menor |


### 1.1 Cómo se mide

1. **Separar.** `htdemucs_ft` separa las voces. La percusión de murga no queda en la pista de batería: Demucs manda buena parte a "other", así que la percusión se toma como todo lo que no es voz.
2. **Transcribir.** MuScriptor `medium`, restringido a voz, en pedazos de 5 segundos.
3. **Grilla.** El detector de pulso se pierde con la murga, así que la grilla sale de los ataques cantados: se busca el período que encaja a la vez en semicorchea, corchea y negra, en ventanas de 8 segundos, y se une con Viterbi. La negra queda entre 70 y 150.
4. **Golpes.** Las notas que atacan juntas son un golpe. La melodía es la nota de arriba de cada golpe.
5. **Acordes y tonalidad.** Viterbi sobre croma, con el vocabulario y las frecuencias de cifrados reales.
6. **Compás.** La percusión de cada pasaje se compara con los 14 loops de La Tríada para saber dónde cae el 1. A capela, se usa la armonía.

### 1.2 Lo que hubo que sacar

Se quitaron 15.319 notas. Por motivo: trabas del transcriptor 64 %, choque a un semitono 24 %, ajena a lo que suena 9 %, demasiado corta 1 %, aislada 1 %, fuera de registro 0 %, eterna 0 %. Tres fallas del transcriptor enseñaron algo:

- **La cadena de notas abiertas.** MuScriptor le pasa al pedazo siguiente las notas que quedaron sonando. Si un pedazo sale mal, arrastra la basura hasta el final: tres tramos llegaron a más de 60 notas abiertas, y el peor dio 55 511 notas donde hay unas 5 000. En los tramos sanos nunca hubo más de 6. Con un tope de 8 que corta la cadena (`murga_lote.py`) bastó un solo corte en cada uno para rehacerlos, y el pedazo que explotó se descarta entero (`limpiar.js`).
- **Las trabas.** Cuando el modelo no entiende el audio repite un acorde a tiempo fijo, hasta 140 veces. Una línea silábica real sobre un acorde dura unos 10 golpes y tiene ritmo. Las trabas caen en recitados y en pasajes casi inaudibles: en Agarrate Catalina 2019, "Recitado y Retirada", aparecen justo al principio.
- **El falso acorde.** Durante el análisis los golpes de una voz daban tan poca energía en sus parciales que parecían acordes mal transcriptos. No lo eran. La prueba: se compara la energía en las fundamentales consonantes alrededor de la nota (tercera, cuarta, quinta) con la de las disonantes; el ruido llena las dos por igual y una voz real sólo las consonantes. Controlada contra golpes que sí tienen voces, dio que no hay otra voz: es un unísono de trece personas, con los parciales anchos. Lo mide `transcripcion/pureza.py`.
- **Voces perdidas.** En un video de Catalina 2011 Demucs perdió las voces y el modelo inventó notas eternas: el video se reemplazó por otro.

## 2. El ritmo

### 2.1 Dónde ataca el coro

Medido en los 8.195 compases con batería, donde se sabe dónde está el 1. Cada compás de esta tabla son cuatro negras.

| Lugar | **1** | · | 1y | · | **2** | · | 2y | · | **3** | · | 3y | · | **4** | · | 4y | · |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| % de los ataques | 10,3 | 2,2 | 9,9 | 2,4 | 10,4 | 2,3 | 10,3 | 2,5 | 10,0 | 2,3 | 10,0 | 2,4 | 10,0 | 2,3 | 10,3 | 2,2 |


### 2.2 Las células más comunes

Cada célula son dos negras en semicorcheas: `x` es un ataque.

| Célula | Parte |
|---|---|
| `x.x.x.x.` | 12,6 % |
| `........` | 7,5 % |
| `..x.x.x.` | 5,4 % |
| `......x.` | 4,6 % |
| `....x.x.` | 4,5 % |
| `x.......` | 4,3 % |
| `x.x.x...` | 3,8 % |
| `..x...x.` | 3,7 % |
| `x...x...` | 3,4 % |
| `x.x.....` | 3,1 % |
| `x...x.x.` | 3,0 % |
| `x.x...x.` | 2,7 % |


### 2.3 Densidad y frases

| Medida | Agarrate Catalina | Asaltantes con Patente | Cayó la Cabra | Doña Bastarda | La Gran Muñeca | La Nueva Milonga | La Trasnochada | Metele que son Pasteles |
|---|---|---|---|---|---|---|---|---|
| golpes por compás | 4,01 | 3,92 | 3,79 | 4,18 | 4,28 | 5,04 | 4,67 | 4,59 |
| golpes en lugar de corchea | 0,82 | 0,84 | 0,86 | 0,82 | 0,82 | 0,77 | 0,81 | 0,80 |
| notas largas (negra con puntillo o más) | 0,17 | 0,10 | 0,16 | 0,17 | 0,11 | 0,10 | 0,11 | 0,13 |
| largo mediano de frase, en compases | 1,50 | 1,63 | 1,44 | 1,63 | 1,38 | 1,88 | 1,63 | 1,69 |
| golpes por frase, mediana | 5,00 | 8,00 | 7,00 | 7,00 | 6,00 | 9,00 | 8,00 | 8,00 |
| frases que terminan en nota larga | 0,82 | 0,63 | 0,81 | 0,72 | 0,69 | 0,64 | 0,70 | 0,57 |
| parte del tiempo sin nadie cantando | 0,07 | 0,21 | 0,17 | 0,15 | 0,16 | 0,10 | 0,15 | 0,23 |


Compases consecutivos con casi el mismo ritmo: 17 %. Pares de dos compases: 7 %. La repetición de la canción está más lejos, entre estrofas, y dentro de una frase hay secuencias: el mismo motivo un grado más arriba.

## 3. El coro

### 3.1 Cuántas voces

| Voces | Golpes cortos | Golpes largos |
|---|---|---|
| 1 | 26 % | 21 % |
| 2 | 25 % | 17 % |
| 3 | 37 % | 39 % |
| 4 | 12 % | 23 % |


Las cifras de una voz son confiables: la regla 12 muestra que son unísonos reales, o solistas. Al revés no tanto: en los golpes a tres voces suele haber alguna más arriba que el transcriptor no anotó, así que la cantidad de voces está más bien subestimada.

### 3.2 Distancia entre voces vecinas

| Semitonos | Parte |
|---|---|
| 3 | 35 % |
| 4 | 27 % |
| 5 | 19 % |
| 2 | 7 % |
| 7 | 4 % |
| 6 | 2 % |
| 9 | 2 % |
| 8 | 2 % |


### 3.3 Cómo se mueven las líneas

| Movimiento | Parte |
|---|---|
| repite | 57 % |
| grado | 35 % |
| tercera | 6 % |
| cuarta/quinta | 2 % |
| salto | 0 % |


| Medida | Agarrate Catalina | Asaltantes con Patente | Cayó la Cabra | Doña Bastarda | La Gran Muñeca | La Nueva Milonga | La Trasnochada | Metele que son Pasteles |
|---|---|---|---|---|---|---|---|---|
| voces por golpe | 2,39 | 2,45 | 2,06 | 2,32 | 2,46 | 2,57 | 2,38 | 2,96 |
| vecinas a distancia de tercera | 0,66 | 0,74 | 0,64 | 0,71 | 0,62 | 0,60 | 0,59 | 0,64 |
| dos voces que se mueven juntas | 0,81 | 0,80 | 0,76 | 0,73 | 0,70 | 0,65 | 0,70 | 0,73 |
| golpes con la melodía doblada a la octava | 0,27 | 0,08 | 0,10 | 0,08 | 0,08 | 0,35 | 0,16 | 0,30 |
| golpes largos a tres voces o más | 0,61 | 0,79 | 0,58 | 0,58 | 0,68 | 0,68 | 0,54 | 0,77 |
| mismas voces que el golpe anterior | 0,76 | 0,81 | 0,83 | 0,75 | 0,77 | 0,77 | 0,79 | 0,69 |


## 4. La melodía

### 4.1 Qué nota del acorde

| Respecto de la raíz | Lugares fuertes | Lugares débiles |
|---|---|---|
| 5 | 27 % | 26 % |
| raíz | 26 % | 23 % |
| 3 | 13 % | 12 % |
| b3 | 9 % | 9 % |
| b7 | 9 % | 9 % |
| 4 | 5 % | 6 % |
| 9 | 4 % | 6 % |
| 6 | 3 % | 4 % |


### 4.2 Recitado y aterrizaje

Hay 5.516 rachas de tres o más notas iguales, de 4 golpes de mediana y hasta 12 en las más largas. Después de una racha, la línea hace esto:

| Sigue | Parte |
|---|---|
| baja un grado | 34 % |
| sube un grado | 27 % |
| sube saltando | 20 % |
| baja saltando | 16 % |
| igual | 2 % |


El 13 % de las veces, esa nota siguiente es una nota larga.

### 4.3 Un ejemplo

Agarrate Catalina 2020, presentación. Grados de la escala y duración en semicorcheas; `_` es silencio:

```
I-V7   _1 3 3 3 2:10
V7-I   _2 4 4 4 3:9
I-ii   _2 5 5 5 4:8
ii-I   _2 6 6 4 3:13
```

Es un mismo gesto, repetir una nota y caer un grado a una nota larga, que sube un grado por vez. La secuencia es el recurso más reconocible del corpus, y ninguna medida de intervalos sueltos la ve.

## 5. La armonía

### 5.1 Los acordes

**En mayor** (53 % del tiempo):

| Acorde | Parte |  | Paso | Parte |
|---|---|---|---|---|
| I | 40 % |  | V7 → I | 7 % |
| V7 | 13 % |  | I → IV | 7 % |
| IV | 13 % |  | I → V7 | 6 % |
| vi | 6 % |  | IV → I | 6 % |
| V | 5 % |  | ii → I | 3 % |
| II7 | 4 % |  | IV → V7 | 3 % |
| ii | 3 % |  | I → V | 3 % |
| iv | 3 % |  | V → I | 2 % |
| I7 | 3 % |  | I → ii | 2 % |


**En menor** (47 % del tiempo):

| Acorde | Parte |  | Paso | Parte |
|---|---|---|---|---|
| i | 41 % |  | V7 → i | 10 % |
| V7 | 15 % |  | i → V7 | 7 % |
| iv | 9 % |  | i → iv | 5 % |
| bVI | 8 % |  | iv → i | 4 % |
| bIII | 5 % |  | i → bVI | 3 % |
| I7 | 5 % |  | i → bVII | 2 % |
| bVII | 4 % |  | bVI → V7 | 2 % |
| V | 3 % |  | iv → V7 | 2 % |
| bVII7 | 1 % |  | bVII → i | 2 % |


### 5.2 Ritmo armónico

Mediana de 0,59 cambios de acorde por compás. El cambio cae por igual en las tres negras siguientes al 1, y a menudo un acorde dura dos compases.

### 5.3 Validación

La detección de acordes se comparó con cifrados humanos de La Cuerda: *Saludo* de Catalina 2010 coincide compás a compás (la grabación está un semitono arriba del cifrado); *Aporofobia* da La menor con `i V7 i iv` e `I7→iv`, y *Retirada a los faros* da Si menor. Los nueve cifrados de `herramientas/cifrados.js` pesan en la armonía junto con lo detectado.

## 6. La forma

| Tramo | A capela al inicio | Tempo al entrar | Tempo final | A capela en el medio | Cambios de tono |
|---|---|---|---|---|---|
| Catalina 2008 presentacion | 33 s | 137 | 137 | 0 | 0 |
| Catalina 2008 retirada | 72 s | 99 | 149 | 2 | 1 |
| Catalina 2010 presentacion | 51 s | 131 | 131 | 0 | 1 |
| Catalina 2010 retirada | 53 s | 130 | 149 | 7 | 5 |
| Catalina 2011 final y retirada | 22 s | 127 | 147 | 6 | 3 |
| Catalina 2011 presentacion | 37 s | 146 | 146 | 0 | 0 |
| Catalina 2012 presentacion | 63 s | 86 | 134 | 0 | 1 |
| Catalina 2012 retirada | — | 113 | 140 | 2 | 1 |
| Catalina 2019 presentacion | 69 s | 136 | 136 | 0 | 1 |
| Catalina 2019 retirada | — | 98 | 144 | 2 | 2 |
| Catalina 2020 final y retirada | — | 100 | 143 | 4 | 2 |
| Catalina 2020 presentacion | 60 s | 130 | 130 | 0 | 0 |
| Catalina 2022 cancion final | — | 117 | 117 | 0 | 0 |
| Catalina 2022 presentacion | 41 s | 124 | 124 | 0 | 0 |
| Catalina 2022 retirada | — | 115 | 144 | 2 | 0 |
| Patente 2023 presentacion | 12 s | 111 | 111 | 0 | 1 |
| Patente 2023 retirada | — | 150 | 130 | 3 | 1 |
| Patente 2024 retirada | 43 s | 143 | 138 | 2 | 0 |
| Patente 2025 presentacion | 16 s | 121 | 121 | 1 | 0 |
| Patente 2025 retirada | — | 127 | 121 | 3 | 2 |
| Cabra 2025 final y retirada | 18 s | 118 | 139 | 6 | 3 |
| Cabra 2025 presentacion | 27 s | 90 | 130 | 0 | 2 |
| Cabra 2026 presentacion | — | 88 | 115 | 0 | 0 |
| Cabra 2026 retirada | — | 119 | 108 | 4 | 5 |
| Hongos 2025 presentacion | 33 s | 124 | 124 | 1 | 1 |
| Hongos 2025 retirada | 36 s | 93 | 130 | 2 | 4 |
| Bastarda 2024 presentacion | 39 s | 90 | 131 | 0 | 0 |
| Bastarda 2024 retirada | 91 s | 122 | 122 | 1 | 1 |
| Bastarda 2025 presentacion | 11 s | 124 | 124 | 0 | 0 |
| Bastarda 2025 retirada | 87 s | 137 | 136 | 1 | 3 |
| Bastarda 2026 presentacion | — | 149 | 129 | 1 | 0 |
| Bastarda 2026 retirada | 26 s | 128 | 141 | 2 | 0 |
| Resto 2026 presentacion | 20 s | 137 | 117 | 1 | 0 |
| Resto 2026 retirada | — | 130 | 122 | 4 | 2 |
| Muñeca 2016 final y retirada | 30 s | 94 | 114 | 2 | 3 |
| Muñeca 2016 presentacion | 20 s | 107 | 107 | 0 | 1 |
| Muñeca 2020 presentacion | 12 s | 126 | 132 | 0 | 1 |
| Muñeca 2020 retirada | 30 s | 119 | 139 | 2 | 2 |
| Muñeca 2023 presentacion | 38 s | 117 | 117 | 1 | 1 |
| Muñeca 2023 retirada | 35 s | 125 | 125 | 1 | 1 |
| Muñeca 2024 presentacion | 43 s | 126 | 126 | 0 | 1 |
| Muñeca 2024 retirada | 96 s | 120 | 132 | 2 | 2 |
| Muñeca 2025 presentacion | 40 s | 126 | 126 | 1 | 1 |
| Muñeca 2025 retirada | 41 s | 100 | 131 | 1 | 2 |
| Muñeca 2026 presentacion | 41 s | 126 | 126 | 0 | 1 |
| Muñeca 2026 retirada | 32 s | 115 | 138 | 3 | 3 |
| Milonga 2023 final y retirada | 47 s | 124 | 131 | 3 | 3 |
| Milonga 2023 presentacion | 35 s | 123 | 123 | 0 | 1 |
| Milonga 2024 presentacion | — | 134 | 130 | 0 | 0 |
| Milonga 2024 retirada | 57 s | 127 | 127 | 0 | 1 |
| Milonga 2026 presentacion | 53 s | 116 | 116 | 1 | 1 |
| Milonga 2026 retirada | 62 s | 109 | 135 | 1 | 2 |
| Trasnochada 2017 final y retirada | — | 119 | 130 | 4 | 3 |
| Trasnochada 2017 presentacion | 32 s | 119 | 119 | 0 | 1 |
| Trasnochada 2019 final y retirada | 15 s | 109 | 139 | 2 | 2 |
| Trasnochada 2019 presentacion | 31 s | 130 | 127 | 1 | 3 |
| Trasnochada 2020 cancion final | 51 s | 97 | 97 | 1 | 1 |
| Trasnochada 2020 presentacion | 32 s | 102 | 107 | 1 | 1 |
| Trasnochada 2020 retirada | — | 96 | 128 | 3 | 4 |
| Trasnochada 2022 final y retirada | — | 113 | 86 | 4 | 3 |
| Trasnochada 2022 presentacion | 22 s | 129 | 127 | 0 | 1 |
| Trasnochada 2023 final y retirada | 29 s | 96 | 129 | 3 | 1 |
| Trasnochada 2023 presentacion | 37 s | 86 | 127 | 0 | 1 |
| Trasnochada 2024 final y retirada | — | 117 | 135 | 1 | 2 |
| Trasnochada 2024 presentacion | 14 s | 112 | 112 | 0 | 0 |
| Trasnochada 2025 final y retirada | — | 93 | 130 | 2 | 1 |
| Trasnochada 2025 presentacion | 25 s | 117 | 117 | 0 | 1 |
| Trasnochada 2026 cancion final | — | 115 | 115 | 0 | 0 |
| Trasnochada 2026 presentacion | 18 s | 116 | 116 | 0 | 0 |
| Trasnochada 2026 retirada | 72 s | 132 | 132 | 2 | 0 |
| Verdes 2026 presentacion | — | 150 | 128 | 1 | 2 |
| Verdes 2026 retirada | — | 100 | 126 | 3 | 1 |
| Pasteles 2020 presentacion | 18 s | 133 | 139 | 3 | 0 |
| Pasteles 2020 retirada | 75 s | 150 | 136 | 1 | 1 |
| Pasteles 2023 final y retirada | — | 88 | 135 | 3 | 2 |
| Pasteles 2023 presentacion | 37 s | 123 | 128 | 0 | 1 |
| Salir 2023 presentacion | — | 117 | 117 | 0 | 0 |
| Salir 2023 retirada | 36 s | 123 | 139 | 2 | 1 |
| Salir 2024 presentacion | 16 s | 117 | 117 | 0 | 1 |
| Cabreros 2026 presentacion | 42 s | 123 | 128 | 1 | 1 |
| Cabreros 2026 retirada | 33 s | 120 | 141 | 5 | 4 |
| Magro 2024 presentacion | 13 s | 121 | 121 | 1 | 1 |
| Magro 2024 retirada | 37 s | 135 | 135 | 0 | 1 |
| Viejo 2026 presentacion | — | 113 | 129 | 1 | 1 |
| Viejo 2026 retirada | — | 97 | 139 | 5 | 2 |


La retirada tiene dos velocidades: una parte lenta, un puente a capela y una parte rápida que termina en la bajada. Los tempos de los pasajes a capela no se pueden medir bien: no hay pulso de batería y el coro respira, por eso el generador los pone un poco más lentos y los estira en los finales de frase.

## 7. Las murgas

| Medida | Agarrate Catalina | Asaltantes con Patente | Cayó la Cabra | Doña Bastarda | La Gran Muñeca | La Nueva Milonga | La Trasnochada | Metele que son Pasteles |
|---|---|---|---|---|---|---|---|---|
| golpes por compás | 4,01 | 3,92 | 3,79 | 4,18 | 4,28 | 5,04 | 4,67 | 4,59 |
| notas largas (negra con puntillo o más) | 0,17 | 0,10 | 0,16 | 0,17 | 0,11 | 0,10 | 0,11 | 0,13 |
| la línea repite nota | 0,45 | 0,52 | 0,59 | 0,61 | 0,61 | 0,65 | 0,67 | 0,60 |
| la línea se mueve por grado | 0,47 | 0,42 | 0,45 | 0,35 | 0,35 | 0,29 | 0,30 | 0,33 |
| ámbito de la línea por compás, en semitonos | 2,01 | 1,64 | 1,51 | 1,60 | 1,50 | 1,65 | 1,40 | 1,95 |
| la melodía (nota de arriba) repite | 0,34 | 0,39 | 0,44 | 0,42 | 0,44 | 0,55 | 0,50 | 0,51 |
| la melodía salta una cuarta o más | 0,10 | 0,06 | 0,10 | 0,10 | 0,08 | 0,08 | 0,08 | 0,12 |
| acordes por compás | 0,62 | 0,55 | 0,58 | 0,60 | 0,61 | 0,66 | 0,63 | 0,51 |
| tiempo en tónica | 0,43 | 0,41 | 0,46 | 0,45 | 0,46 | 0,42 | 0,44 | 0,56 |
| notas fuera de la escala | 0,05 | 0,05 | 0,08 | 0,06 | 0,09 | 0,07 | 0,06 | 0,10 |
| voces por golpe | 2,39 | 2,45 | 2,06 | 2,32 | 2,46 | 2,57 | 2,38 | 2,96 |
| vecinas a distancia de tercera | 0,66 | 0,74 | 0,64 | 0,71 | 0,62 | 0,60 | 0,59 | 0,64 |
| de la voz de abajo a la de arriba, en semitonos | 8,39 | 7,18 | 6,84 | 7,12 | 7,18 | 9,12 | 7,58 | 8,93 |
| dos voces que se mueven juntas | 0,81 | 0,80 | 0,76 | 0,73 | 0,70 | 0,65 | 0,70 | 0,73 |


La diferencia más clara es cómo se mueven las líneas: **La Trasnochada recita** (repite nota el 67 % de las veces, por grado el 30 %) y **Agarrate Catalina camina** (repite el 45 %, por grado el 47 %). El generador conserva esa diferencia porque cada murga usa sólo sus gestos.

Catalina tiene dos épocas en el corpus:

| Medida | 2008–2012 | 2019–2022 |
|---|---|---|
| golpes por compás | 4,01 | 4,32 |
| notas largas (negra con puntillo o más) | 0,17 | 0,18 |
| la melodía (nota de arriba) repite | 0,41 | 0,31 |
| acordes por compás | 0,66 | 0,62 |
| voces por golpe | 2,62 | 2,23 |
| dos voces que se mueven juntas | 0,79 | 0,81 |


## 8. Qué hace el generador con esto

La primera versión sorteaba nota por nota con tablas aprendidas y sacaba buenos promedios, pero no sonaba a frases: el coro cambiaba de textura a cada golpe y no respiraba. Leer las melodías reales al lado de las generadas mostró lo que ninguna medida veía (reglas 1, 3 y 4 y la sección 4.3). Por eso cambió de raíz:

1. **Gestos reales.** Aprende celdas de dos compases, de una respiración a la siguiente, con melodía, voces y acordes juntos, relativas a la tónica.
2. **Forma.** Pide las celdas según lo que la forma necesita: `a` pregunta y termina en la dominante, `a'` repite la cabeza y responde en la tónica, `b` contrasta, `a''` vuelve. Con la densidad, el tempo y el momento de la pieza pedidos.
3. **Costuras.** Elige el gesto siguiente por el acorde, la nota y que cada voz de abajo tenga a dónde ir sin saltar.
4. **Variación.** Cada pocas notas cambia una nota débil, como cambia la melodía entre dos versos. Los apoyos no se tocan, y las voces de abajo acompañan en paralelo o se quedan.
5. **Voces.** Canta con muestras de coro "aah", con dos a cuatro cantores por cuerda (la tercia es una voz sola), cada uno con su desafinación, su retraso y su lugar en el estéreo. El timbre se ecualiza hacia el espectro medido de las voces reales (`herramientas/timbre.js`).

También se probó cantar cada golpe con el recorte de un golpe real con el mismo acorde. Se descartó: el objetivo es el coro en MIDI, con la batería real. Ese código (`motor/voz_real.js` y `transcripcion/banco.py`) quedó en el commit 9f48010.

## 9. Cómo saber si suena creíble

### 9.1 El jurado

Mide 40 rasgos y puntúa de 0 a 10 según cuánto cae cada uno dentro de lo normal. Cada tramo real se juzga contra los demás. Los dos controles tontos muestran que el jurado no regala nada.

|  | Total | Ritmo | Melodía | Armonía | Voces |
|---|---|---|---|---|---|
| tramos reales | 9,0 | 9,1 | 8,8 | 8,8 | 9,1 |
| presentación · todas juntas | 9,4 | 9,8 | 9,3 | 8,6 | 9,8 |
| presentación · La Trasnochada | 9,2 | 9,9 | 8,8 | 8,8 | 9,4 |
| presentación · Agarrate Catalina | 8,8 | 8,6 | 8,5 | 8,6 | 9,4 |
| presentación · La Gran Muñeca | 9,3 | 9,2 | 9,4 | 8,9 | 9,6 |
| presentación · Metele que son Pasteles | 8,6 | 8,7 | 7,7 | 8,9 | 9,1 |
| presentación · Doña Bastarda | 9,1 | 9,7 | 9,2 | 9,2 | 8,2 |
| presentación · Asaltantes con Patente | 8,8 | 9,7 | 9,1 | 7,9 | 8,4 |
| presentación · La Nueva Milonga | 8,8 | 9,4 | 7,9 | 8,6 | 9,2 |
| presentación · Cayó la Cabra | 9,2 | 9,3 | 9,4 | 9,2 | 9,0 |
| retirada · todas juntas | 9,4 | 9,8 | 9,0 | 8,9 | 9,8 |
| retirada · La Trasnochada | 9,3 | 9,9 | 8,7 | 9,5 | 9,3 |
| retirada · Agarrate Catalina | 8,6 | 8,6 | 7,4 | 8,6 | 9,6 |
| retirada · La Gran Muñeca | 9,3 | 9,5 | 9,2 | 8,6 | 9,7 |
| retirada · Metele que son Pasteles | 9,0 | 8,9 | 7,8 | 9,7 | 9,6 |
| retirada · Doña Bastarda | 9,3 | 9,9 | 9,6 | 9,0 | 8,7 |
| retirada · Asaltantes con Patente | 9,2 | 9,6 | 9,2 | 9,0 | 9,1 |
| retirada · La Nueva Milonga | 9,0 | 9,7 | 7,6 | 9,2 | 9,3 |
| retirada · Cayó la Cabra | 9,2 | 9,2 | 9,4 | 9,4 | 8,8 |
| tonto · azar | 4,7 | 5,4 | 1,7 | 5,1 | 6,6 |
| tonto · monótono | 1,9 | 1,1 | 0,7 | 2,2 | 3,8 |


Las notas más bajas de Catalina no son un defecto: el jurado usa una vara hecha sobre todo con La Trasnochada, y lo real de Catalina también baja con ella. Lo justo es juzgar cada estilo contra su murga y contra la otra:

|  | Contra La Trasnochada | Contra Agarrate Catalina |
|---|---|---|
| Motor, estilo Trasnochada | 9,1 | 8,1 |
| Trasnochada real | 8,8 | 7,8 |
| Motor, estilo Catalina | 7,5 | 9,3 |
| Catalina real | 7,3 | 8,8 |


### 9.2 Sin haber visto

Se saca un espectáculo entero, se genera con el resto y se mide la distancia a ese espectáculo, en desvíos estándar por rasgo. Mediana del motor: **1,17**. Mediana entre dos espectáculos reales: **1,28**. En 69 % de los casos el motor queda más cerca del espectáculo que la mediana de los otros espectáculos reales. En estos rasgos, una pieza generada no se distingue de otro espectáculo real. El rasgo que más lo separa son los saltos de las líneas interiores, que en lo real casi no existen. Apretar la selección en las costuras entre gestos no los corrigió, así que su origen sigue abierto.

### 9.3 ¿Copia?

Se busca el pasaje más largo de cada pieza generada igual a uno del corpus, con los mismos intervalos y el mismo ritmo, en 540 piezas. Mediana 10 notas, máximo 16. Con celdas de cuatro compases y casi sin variación llegaba a 32 notas: era un collage. Por eso la unidad es de dos compases, y hay un tope de notas seguidas sin cambiar. Las rachas de notas iguales no cuentan: repetir una nota no es copiar.

Lo que los números no pueden decir lo dice el oído: si suena a murga lo juzga quien la conoce.

## 10. Lo que falta medir

- **Letra y sílabas.** El corpus no tiene texto. Con la letra se podría medir la relación entre acentos y música.
- **Solistas.** Falta separar el solista del coro: el transcriptor los mezcla.
- **Contracantos.** Con voces mezcladas en una pista, las líneas interiores son aproximadas.
- **Más murgas.** Las diferencias entre dos murgas pueden ser de estas murgas y no de un estilo.

## 11. Cómo usar las herramientas

```
node herramientas/analizar.js        # de los MIDI a murga_trabajo/analisis/*.json, con un PNG por tramo
node herramientas/revisar.js         # el control de cada tramo: docs/revision_de_los_midis.md
node herramientas/aprender.js        # motor/modelo.js
python transcripcion/pureza.py       # pureza y unísono de cada golpe (regla 12)
node herramientas/jurado.js --ver --sin-espiar
node herramientas/copia.js
node herramientas/informe.js         # este documento
node herramientas/servir.js          # la página, en http://localhost:8123
```
