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

- **MIKE**: castellano nativo, VCCV, Sol 3, Re 4 y falsete. Está en Icedrive, que hay que bajar a mano desde un
  navegador.
- **Koru Fivet RETAKE**: barítono nativo con 13 alturas y expresiones. No tiene descarga pública.
- **Kreic Umine**: VCV. No se encontró la descarga.

**Lo que se armó:**

- `herramientas/compilar_world.sh` compila WORLD a `motor/vendor/world/world.wasm` (149 KB), con zig, como MBROLA.
  `motor/cantor/world.js` lo carga.
- `motor/cantor/banco.js` lee el banco: los `oto.ini`, el `prefix.map` y los `.wav`. Pasa nuestras sílabas a las
  entradas de nJokis, por ejemplo «-pr _ro o m me e t te». Las ubica en el tiempo como UTAU (el preutterance en el
  comienzo de la vocal, la parte fija a su velocidad, el resto estirado). Las funde cuadro por cuadro, con la envolvente
  en logaritmo, y sintetiza la frase entera con WORLD.
- La altura y el volumen son los de `guion()` (portamento, vibrato, caída), los mismos que usa MBROLA: `guion()`
  ahora devuelve también `altura`. Los guiones de MBROLA no cambian: 456 guiones iguales a los de antes.
- Del pedazo grabado se conserva el temblor natural de la altura: lo que se aparta de su altura suavizada a 100 ms.
- `herramientas/utau_prueba.mjs <carpeta del banco>` canta una escala de «la» y tres frases en tres alturas, con el
  banco y con MBROLA, y deja una página para escucharlas lado a lado en `murga_trabajo/utau/<banco>/`.
- `herramientas/utau_medir.mjs` mide la escala.
- `solista.mjs --motor banco --banco <carpeta>` canta las 24 frases del solista con el banco.

**Lo medido:**

- **Altura.** Cada nota sostenida de la escala, de Sol 3 a Do 5, queda a entre 0 y 3 cents de la pedida.
- **Cobertura.** En las 24 frases hay 704 unidades, y al banco le faltan tres: «rry» (barrio, que se canta «barro»),
  «s y» e «IU».
- **Tiempo.** Analizar cada pedazo tarda de 0,3 a 1 s (44,1 kHz, DIO). Con los pedazos ya analizados, una frase de
  4 a 5 s tarda de 0,5 a 1,9 s. MBROLA tarda 0,1 a 0,3 s.
- **Brillo.** Lo de arriba de 1,8 kHz frente al total, en la «a» sostenida: el banco crudo da −16 dB de Sol 4 a
  Do 5, y MBROLA, con su curva de timbre, de −8 a −10 dB. El banco todavía no tiene curva de timbre.
- **Se entiende igual en el registro de siempre, y menos en el agudo.** Whisper sobre las 24 frases (letras mal /
  palabras mal):

| | Sol 3 a Fa# 4 | seis semitonos arriba (hasta Do 5) |
|---|---|---|
| banco LW_Symphonia_es | 15,0 % / 43,1 % | 22,9 % / 51,5 % |
| difonos es2 (como en la página) | 16,4 % / 35,7 % | 15,6 % / 36,2 % |

Con 24 frases, una diferencia de 1 o 2 puntos es ruido. Whisper además alucina: con MBROLA, en las dos alturas, oyó
«(Cantando)» en la frase 23 (85 %); con el banco en el agudo, «ven, ven, ven…» en la 14 (que cuenta 100 %).

Falta lo principal: el veredicto de oído sobre el agudo.

## Riesgos

- **Licencia**: muchos bancos no dejan redistribuirlos o piden crédito; por eso se cargan desde la compu.
- **Hay pocos bancos de hombres en castellano**, y casi ninguno rioplatense. Puede que el plan B (grabar) sea el camino.
- **Calidad desigual**: el `oto.ini` de muchos bancos está hecho a mano y con errores; puede hacer falta corregirlo.
- **Tamaño y tiempo**: un banco con varias alturas pesa mucho, y WORLD es más lento que MBROLA.

## Lo que hay que decidir

1. Qué banco, o si grabamos uno.
2. Si los graves siguen con MBROLA y el banco es sólo para el agudo, o todos los cantantes con el banco.
