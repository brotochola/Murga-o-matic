# Plan: un agudo creíble con un banco de voz cantada (UTAU)

Para hacer más adelante. Hoy ninguna cuerda pasa de La 4 (`compositor_2.md`, sección 12), porque arriba de eso los
cantores de difonos no suenan a un adulto cantando agudo.

## Por qué

MBROLA es una voz de **habla**, grabada una sola vez y a una sola altura (unos 110 Hz). Para cantar un Do 5 la estira
casi cinco veces, sumando pedazos de dos períodos de esa voz grave (`solista.md`, «El color en el agudo»). Corregimos
el color y el volumen, pero no alcanza: al oído sigue sonando a «un nene robot». Los programas que cantan creíble en el
agudo graban al cantante **cantando**, y en varias alturas, así nunca hay que estirar mucho.

Un banco de UTAU es justamente eso: grabaciones de una persona cantando sílabas, a veces en tres o cuatro alturas, con
un archivo que dice dónde empieza y termina cada pedazo. Es corte y pegado de grabaciones, como MBROLA: **no hay redes
neuronales**. (Los bancos de DiffSinger o NNSVS que también usa OpenUtau sí son redes: esos no.)

## Qué es un banco de UTAU

- Una carpeta con los `.wav`, un `character.txt` (nombre, imagen, autor), un `readme.txt` con las **condiciones de
  uso**, y un `oto.ini` por carpeta.
- Cada línea del `oto.ini`: `archivo.wav=alias,offset,consonante,cutoff,preutterance,overlap`, en milisegundos
  (convención de UTAU; hay que confirmarla con un banco real):
  - **offset**: dónde empieza el pedazo, desde el principio del archivo;
  - **consonante**: cuánto del principio no se estira (la consonante y el paso a la vocal);
  - **cutoff**: dónde termina (negativo: largo desde el offset; positivo: desde el final del archivo);
  - **preutterance**: qué punto del pedazo cae justo en el comienzo de la nota (la consonante va antes);
  - **overlap**: cuánto se funde con la nota anterior.
- El **alias** dice qué sílaba es. Según cómo se grabó (la «reclist»): **CV** (`ka`), **VCV** (`a ka`, la vocal
  anterior y la sílaba) o **CVVC** (`ka` más `a k`, el paso de vocal a consonante).
- **Varias alturas**: los alias llevan un sufijo (`ka_C4`, `ka_F4`, `ka_A4`), y un `prefix.map` dice qué sufijo usar
  para cada nota. A veces hay además otros colores de voz (fuerte, suave).

## Pasos

### 1. Elegir el banco (con vos, de oído)

- Lo que buscamos: un **hombre**, en **castellano** (mejor rioplatense, por la «sh» de ll/y), grabado **cantando** en
  al menos tres alturas que lleguen a La 4 o Do 5, en CVVC o VCV, y con condiciones de uso que permitan usarlo en un
  proyecto personal y no comercial.
- Dónde buscar: la wiki de UTAU (categoría de bancos en castellano), UtaForum, itch.io (etiqueta utau), blogs de la
  comunidad hispana (Furloidnia).
- Para cada candidato: anotar alturas, reclist, tamaño, condiciones de uso y cómo suena una frase nuestra. Elegís vos.
- **Plan B**: grabar uno propio. Una reclist CVVC en castellano son unas pocas centenas de líneas; grabadas por un
  murguista en tres alturas (Mi 3, La 3, Re 4, por ejemplo) con un buen micrófono, nos da un banco con el acento y la
  emisión de la murga, y sin problemas de licencia.
- Como con las letras y los audios con derechos: **el banco no se sube al repositorio** salvo que su licencia lo
  permita. La página lo carga desde la compu del usuario (un .zip), y lo guarda en el navegador.

### 2. Leer el banco (`motor/cantor/banco.js`)

- Abrir el .zip en el navegador, leer `character.txt`, `prefix.map` y cada `oto.ini` (ojo: muchos están en Shift-JIS,
  no en UTF-8), y armar un índice alias → archivo y parámetros, por altura.
- Decodificar los .wav a medida que hacen falta (no todos de entrada: un banco puede pesar cientos de MB).

### 3. De nuestras sílabas a los alias

- Nuestras notas ya traen la sílaba partida en ataque, núcleo y coda (`coro.js`, `silabear`). Hay que pasarlas a los
  alias del banco: con CVVC, `ma` + `a l` + `la`…; con VCV, `- ma`, `a la`…
- Una tabla por reclist, y reglas para lo que falte (una consonante que el banco no tiene se reemplaza por la más
  parecida; la «sh» rioplatense, si el banco no la tiene, como hoy: la ll castellana más el soplo).
- Mantener lo que ya aprendimos: las eses aspiradas o comidas del acento, las consonantes cortas del canto ligado.

### 4. El «resampler»: cada nota

- Elegir la grabación de la altura más cercana a la nota (así se estira poco, como mucho medio intervalo entre
  alturas grabadas).
- Cortar el pedazo (offset a cutoff), dejar la parte fija como está y estirar la vocal hasta el largo de la nota.
- Llevarla a la altura exacta y a nuestra curva de altura (portamento, vibrato, caída: lo que hoy calcula `guion()`),
  sin mover los formantes. Para eso, **WORLD** (el analizador y sintetizador de voz de Morise, en C++, licencia BSD),
  compilado a WebAssembly como hicimos con MBROLA (`compilar_mbrola.sh`): separa la altura, la envolvente y el aire, y
  vuelve a sintetizar con otra altura y otro largo. Es lo que usan los resamplers de UTAU más comunes. Alternativa más
  simple para empezar: PSOLA en JavaScript, que con estiramientos chicos (menos de un tercio) anda bien.

### 5. El «wavtool»: pegar las notas

- Poner cada pedazo de modo que su preutterance caiga en el comienzo de la nota, y fundirlo con el anterior durante el
  overlap. Aplicar el volumen de cada nota (`ganancia` de `guion()`).

### 6. En la página

- Un tercer motor, `banco`, al lado de difonos, en el obrero (`obrero.js`), con la misma entrada (notas con sílabas) y
  la misma salida (muestras a su frecuencia).
- Cada cantante elige su voz: es1, es2, es4 o el banco. En el inspector de cantantes de la página nueva.
- Volver a medir lo que hoy está ajustado para MBROLA: la curva de timbre contra el coro real, el grito, el volumen.
  Mucho puede sobrar: la voz ya viene cantada.
- Si suena creíble, devolverle el rango a los sobreprimos (Si 4 o Do 5) para los cantantes con banco.

### 7. Medir

- De oído, con vos: la misma línea de los sobreprimos (`melodia_original` y sus versiones más graves) cantada por el
  banco, contra MBROLA.
- Whisper (`solista_jurado.py`): que se entienda la letra por lo menos como hoy.
- Contra el coro real (`armonicos.py`, `envolvente.py`): bandas y H1−H2.
- Cuánto tarda.

## Primera prueba (9 de noviembre de 2026)

Se armaron los pasos 2 a 5 en Node, para escuchar antes de tocar la página.

**Los bancos.** Hay muy pocos bancos de hombre en castellano, y ninguno rioplatense. Se bajó el que mejor se ajusta
y se puede bajar sin trámites: **LW_Symphonia_es v1.0** (deadbyte, <https://lw-winery.carrd.co/>). Es un barítono
cantado, en VCCV de nJokis, con cinco alturas (La♭ 2, Re 3, Sol 3, Do 4 y Mi 4), unas 830 entradas por altura y
141 MB. Su autor avisa que no es hablante nativo. Las condiciones no hablan del uso personal; el comercial pide
licencia, y redistribuirlo pide permiso. Otros candidatos:

- **MIKE** (AkuP, 2016, <http://utau.wikidot.com/utau:mike>): castellano nativo, con una reclist propia del
  autor. Grabado en Fa#3 / Sol 3, Re 4 y falsete en La#4 (457 Hz), más dos colores aparte: grave (La#2) y suave
  (Do 3). Pesa 245 MB. Su `prefix.map` usa el falsete de Do 5 para arriba. El uso comercial pide permiso. Está en
  Icedrive, que hay que bajar a mano desde un navegador (`Mike_Normal.uar` es un .zip).
- **Koru Fivet RETAKE**: barítono nativo con 13 alturas y expresiones. No tiene descarga pública.
- **Kreic Umine**: VCV. No se encontró la descarga.

**Lo que se armó:**

- `herramientas/compilar_world.sh` compila WORLD a `motor/vendor/world/world.wasm` (149 KB), con zig, como MBROLA.
  `motor/cantor/world.js` lo carga.
- `motor/cantor/banco.js` lee el banco: los `oto.ini`, el `prefix.map` y los `.wav`. Pasa nuestras sílabas a las
  entradas del banco, con una tabla por reclist:
  - la VCCV de nJokis (LongWei): «-pr _ro o m me e t te»;
  - la de AkuP (MIKE): «- ba», «a m» + «ma», la coda junto con la consonante que sigue («an t»), «as R» para
    cortar, «a ra» para la r simple. La reconoce sola.

  Ubica los pedazos en el tiempo como UTAU (el preutterance en el comienzo de la vocal, la parte fija a su velocidad,
  el resto estirado). Los funde cuadro por cuadro, con la envolvente en logaritmo, y sintetiza la frase entera con
  WORLD. Lleva cada archivo al mismo nivel (el de su 30 % más fuerte), como UTAU: en MIKE, la carpeta de Sol 3
  estaba de 6 a 15 dB abajo de la de Re 4. Con `evitar` no usa una altura grabada, por ejemplo el falsete
  (`_F`).
- La altura y el volumen son los de `guion()` (portamento, vibrato, caída), los mismos que usa MBROLA: `guion()`
  ahora devuelve también `altura`. Los guiones de MBROLA no cambian: 456 guiones iguales a los de antes.
- Del pedazo grabado se conserva el temblor natural de la altura: lo que se aparta de su altura suavizada a 100 ms.
- `herramientas/utau_prueba.mjs <carpeta del banco>` canta una escala de «la» y tres frases en tres alturas, con el
  banco y con MBROLA, y deja una página para escucharlas lado a lado en `murga_trabajo/utau/<banco>/`.
  Para escuchar y cambiar las voces está `estudio.html` (`docs/plan_cantantes.md`).
- `herramientas/utau_medir.mjs` mide la escala.
- `solista.mjs --motor banco --banco <carpeta>` canta las 24 frases del solista con el banco.

**Lo medido:**

- **Altura.** Cada nota sostenida de la escala, de Sol 3 a Do 5, queda a entre −4 y +3 cents de la pedida, con los
  dos bancos.
- **Cobertura.** En las 24 frases, a LongWei le faltan tres de 704 unidades: «rry» (barrio, que se canta «barro»),
  «s y» e «IU». A MIKE no le falta ninguna de 597.
- **Tiempo.** Analizar cada pedazo tarda de 0,3 a 1 s (44,1 kHz, DIO). Con los pedazos ya analizados, una frase de
  4 a 5 s tarda de 0,5 a 1,9 s. MBROLA tarda 0,1 a 0,3 s.
- **Brillo.** Lo de arriba de 1,8 kHz frente al total, en la «a» sostenida de Sol 4 a Do 5, da:
  - LongWei crudo, de −16 a −18 dB;
  - MIKE crudo, −13 dB (−16 en el Do 5 con falsete);
  - MBROLA, con su curva de timbre, de −8 a −10 dB.

  Los bancos todavía no tienen curva de timbre.
- **Cortes.** Mientras se canta la escala, la voz queda 15 dB abajo un 6 % del tiempo con los bancos y un 14,5 % con
  MBROLA.
- **Se entiende.** MIKE se entiende mejor que MBROLA en el registro de siempre, y casi igual en el agudo; LongWei,
  peor en el agudo. Whisper sobre las 24 frases (letras mal / palabras mal):

| | Sol 3 a Fa# 4 | seis semitonos arriba (hasta Do 5) |
|---|---|---|
| MIKE | 8,3 % / 32,3 % | 13,5 % / 42,4 % (con falsete); 12,8 % / 41,9 % (sin falsete) |
| LW_Symphonia_es | 14,0 % / 39,2 % | 22,7 % / 48,5 % |
| difonos es2 (como en la página) | 16,4 % / 35,7 % | 15,6 % / 36,2 % |

Con 24 frases, una diferencia de 1 o 2 puntos es ruido. Whisper además alucina: con MBROLA, en las dos alturas, oyó
«(Cantando)» en la frase 23 (85 %).

**Lo que falta en los bancos en castellano: voz de pecho en el agudo.** LongWei llega a Mi 4 y MIKE a Re 4 (más un
falsete). Un sobreprimo canta Do 5 con el pecho. Por eso el paso que sigue es buscar bancos de hombre de otros idiomas
con voz de pecho o «power» grabada entre La 4 y Do 5, y pasarles nuestras sílabas con otra tabla. Lo que encaja de
cada idioma:
- **Italiano:** tiene la rr, la l, la ñ, la sh y codas en l, r, n y s.
- **Japonés:** es donde hay más bancos. Tiene las cinco vocales, la r simple y la sh, que es la ll/y rioplatense. Le
  faltan la rr, la l y las codas.
- **Portugués de Brasil:** tiene sh, zh y codas, pero las vocales nasales hay que esquivarlas.

Falta lo principal: el veredicto de oído sobre el agudo.

## Más cantantes, para todas las cuerdas

La idea creció: no sólo un agudo para los sobreprimos, sino muchos cantantes distintos, uno por murguista, para todas
las cuerdas. Así se va a poder armar una murga eligiendo a cada integrante, en el inspector de cantantes que hace la
otra sesión.

**Los bancos que hay ahora.** Ninguno va al repositorio; se bajan aparte (`herramientas/utau_desarmar.mjs`
desarma el .zip con los nombres bien).

| Banco | Idioma, reclist | Grabado en | Condiciones |
|---|---|---|---|
| LW_Symphonia_es | castellano (no nativo), VCCV nJokis | La♭2, Re 3, Sol 3, Do#4, Mi 4 | comercial con licencia; no redistribuir |
| MIKE (AkuP) | castellano nativo, propia | Fa#3, Re 4, falsete La#4; colores grave (La#2) y suave (Do 3) | comercial con permiso |
| Sheep Oveja (EdusheeP, <https://sites.google.com/view/edusheep/sheep>) | castellano, CVVC silábica | Re 3 | no dice |
| Vincen-oto Legato (snowsorry, <https://snowsorry-voicebanks.carrd.co/>) | japonés CVVC, con l, rr, zh y codas | Mi 3, Sol 3, Si 3, Fa 4, La 4, Re 5 | personal con crédito; comercial con permiso; sin derivados ni redistribución |
| Vincen-oto Ottava | japonés CVVC, igual | Sol#3, Fa 4, Do 5 | las mismas |
| Vincen-oto Rubato | japonés VCV | La 2, Re 3, La 3, Re#4, Sol#4, La#4, Re#5 | las mismas |

| Sheep Cordeiro V3 (EdusheeP) | portugués de Brasil, BRAPA | Do 3, Fa 3, La 3 (cubre de Fa 2 a Fa 5 estirando) | no dice |
| Sheep Hitsuji V3 (EdusheeP) | japonés CV (sin pasos: las codas se pierden) | La 2, Do 3, Mi 3, La 3, Si 3, Fa 4 | no dice |
| Sanfu Jurani (Rafu, <https://rafup.altervista.org>) | italiano CVVC de MakkuPizza: rr de verdad, gn, S, tS | Si 2, Sol 3, Do 4 (oscuro) | pide crédito por los dibujos |

Las tres Sheep son la misma voz en tres idiomas. Para el castellano, el portugués trae lo que a los bancos en
castellano les falta: la r gutural («h»), que es la jota; la «j» ([ʒ]), que es la ll/y rioplatense; y la «sh». No
tiene la rr de lengua: va la r simple. Los bancos de OpenUtau dicen sus alturas en el `character.yaml` (subbanks:
un prefijo como «C3_», un sufijo, un color y las notas que cubre), y `banco.js` los lee como el `prefix.map`.

En italiano y portugués hay muy pocos bancos de hombre, y ninguno con voz de pecho en el agudo. Los tres KEI de
Rosaaah (portugués) ya no están en Drive. Sanfu (italiano CVVC, Do 3, Sol 3 y Do 4) no dice si es voz de hombre.
ZIL (italiano) es una voz andrógina, en BowlRoll. Al oído, MBROLA es4 suena malísimo.

(Las alturas son las medidas; a veces el nombre de la carpeta dice otra. Las condiciones de Vincen-oto dicen
también: crédito al banco y a su autor, y nada R18.)

**Las tablas.** `banco.js` reconoce la reclist de cada banco y tiene una tabla para cada una. La japonesa canta la
sílaba en kana («か»), y lo que no está en japonés lo acerca: la l, la rr y la zh van con letras cuando el banco las
tiene («la», «rra», «zha»); la jota con la h japonesa; la s aspirada con un soplo («a hh»). En los bancos VCV la
sílaba viene con la vocal de antes («a か»). Con las 24 frases, a ninguno de los seis le falta nada que importe.

**Más cantantes con los mismos bancos:**
- **Capa:** con `capa: '_dp'` se canta con otra grabación entera del banco (MIKE grave o suave), o con un color del `character.yaml`. (No es el `color` de los cantores de difonos.)
- **Garganta:** con `tracto: 1.06` se corren la envolvente y el aire en frecuencia, sin tocar la altura. Con 0,92,
  1 y 1,08, el centro de los formantes de MIKE da 754, 792 y 828 Hz.
- **Cada murguista con sus valores:** `cantarBanco` le pasa a `guion()` las mismas opciones que los cantores de
  difonos (vibrato, deriva, pique, caída, adornos, golpe, arco, semilla).

**¿Pecho o falsete?** `herramientas/utau_registro.mjs <carpeta>` mide, en las vocales sostenidas de cada altura
grabada, H1−H2 (la fundamental contra el segundo armónico) y el brillo. Es una pista; se decide de oído. De
referencia, MIKE: su Re 4 de pecho da −14 dB y su falsete, +6 dB.

| | H1−H2 | brillo |
|---|---|---|
| Ottava, Do 5 | −13,9 dB | −13,3 dB |
| Ottava, Fa 4 | −12,1 dB | −8,8 dB |
| Rubato, Sol#4 | −12,0 dB | −6,5 dB |
| Rubato, La#4 | −6,3 dB | −8,1 dB |
| Legato, La 4 | +1,1 dB | −18,5 dB |

Ottava y Rubato parecen tener voz plena en el agudo; Legato, más liviana. Vincen-oto figura como «alto» (Re 3 a
Re 5): puede sonar joven.

**La galería.** `herramientas/utau_galeria.mjs [plantel.json]` deja `murga_trabajo/utau/galeria/index.html`. Cada
voz del plantel (por defecto, `bancos/plantel.json`: los bancos, los colores de MIKE y MBROLA) canta la misma frase en
el registro de cada cuerda: bajos, segundos, primos, sobreprimos, y el agudo hasta Do 5. En esta compu, 12 voces
tardaron 84 s para 60 celdas.

**Para la página (paso 6).** Lo que va a necesitar el inspector de cantantes:
- **Cada murguista con un banco lleva:** `voz: 'banco'` y `banco: { id, capa, evitar, tracto }`, más los valores de
  siempre. El `tracto` de las cuerdas (0,9 en los bajos…) es para MBROLA: un banco ya es una voz, y su garganta va
  alrededor de 1.
- **Los bancos los carga el usuario desde su compu** (un .zip) y quedan guardados en el navegador; se identifican
  por su nombre (`character.txt`). `motor/cantor/zip.js` lee el .zip, con los nombres en Shift-JIS; deflate se
  descomprime con `DecompressionStream`.
- **El obrero** (`obrero.js`) suma un motor `banco`, con la misma entrada (notas con sílabas) y la misma salida.
  `crearBanco` lee los archivos de forma sincrónica: antes de cantar, el obrero descomprime los .wav que la frase va
  a usar.
- **Lo que tarda:** el análisis de cada pedazo (0,3 a 1 s por archivo) se guarda; con eso, una frase de 4 a 5 s
  tarda de 0,5 a 1,9 s.

## Riesgos

- **Licencia**: muchos bancos no dejan redistribuirlos o piden crédito; por eso se cargan desde la compu.
- **Hay pocos bancos de hombres en castellano**, y casi ninguno rioplatense. Puede que el plan B (grabar) sea el camino.
- **Calidad desigual**: el `oto.ini` de muchos bancos está hecho a mano y con errores; puede hacer falta corregirlo.
- **Tamaño y tiempo**: un banco con varias alturas pesa mucho, y WORLD es más lento que MBROLA.

## Lo que hay que decidir

1. Qué banco, o si grabamos uno.
2. Si los graves siguen con MBROLA y el banco es sólo para el agudo, o todos los cantantes con el banco.
