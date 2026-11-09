# Plan: armar la murga eligiendo a cada cantante

Lo que se quiere es elegir qué voz canta en cada uno de los 13 lugares del coro y ajustar los valores de cada uno. Las
voces son las de MBROLA o las de los bancos de UTAU (`docs/utau.md`).

## Lo que ya está: el estudio (`estudio.html`)

Lo decidido el 9 de noviembre de 2026:
- **El plantel es un .json** con las propiedades de cada voz:
  `[{ "nombre": "MIKE grave", "banco": "Mike_Normal", "capa": "_dp", "grito": 1.1, "tension": .6, ... },
  { "nombre": "MBROLA es2", "mbrola": "es2" }]`. En Node, los bancos van por su carpeta (`"carpeta"`) en vez de
  `"banco"`.
- **Todo web, sin servidor que cante:** el estudio usa el mismo motor que la página, en sus obreros.
- **Los bancos no se copian.** Se guarda la llave de la carpeta de cada uno (`FileSystemDirectoryHandle`) en el
  navegador, y la próxima vez va solo a buscar los .wav. Chrome y Edge la recuerdan, y piden un clic para dar permiso
  si no se eligió «permitir siempre». Firefox y Safari no la tienen: ahí la carpeta se elige cada vez.

**Lo que tiene el estudio:**
- **Los bancos:** agregar la carpeta de cada uno y ver su reclist, sus alturas grabadas y sus colores. Si un banco no
  dice su altura, se mide de una vocal.
- **Las voces:** cada una con sus deslizadores (garganta, afinación, vibrato, grito, tensión, ronquera, aire,
  esfuerzo, dicción, golpe, pique, caída, respiración, temblor de la grabación) y «Cantar», que canta una frase en el registro
  elegido. Arriba:
  - «Enojados y gritando» y «Como estaban al abrir»;
  - «Cantar todas»;
  - exportar e importar el plantel (también el de Node: su carpeta se busca entre los bancos cargados).
- **La murga:** los 13 lugares, cada uno con su voz; «Repartir solo» (la voz grabada más cerca del registro de su
  cuerda, sin repetir si se puede); y «Cantar la murga», que da el mp3, el wav y la letra.
- **Lo que queda guardado** en el navegador: el plantel, la murga y las opciones.

**Cómo se abre:** desde una dirección web, no como archivo suelto. Puede ser `node herramientas/servir.js` y
<http://localhost:8123/estudio.html>, o la página publicada (`…github.io/Murga-o-matic/estudio.html`).

**Las piezas:**
- `motor/estudio.js`: la página.
- `motor/cantor/bancos.js`: las llaves de las carpetas, IndexedDB, y leer un banco desde el obrero.
- el motor `banco` de `motor/cantor/obrero.js`: canta un cantor con un banco, leyendo antes del disco los .wav que va
  a usar (`archivosQueUsa`).
- `motor/cantor/murga_bancos.js`: las opciones de cada cantor según su voz, la pieza con su letra, el reparto y la
  mezcla. Es lo mismo que usa `herramientas/murga_bancos.mjs` en Node.
- `herramientas/probar_estudio.mjs <banco>`: la prueba de punta a punta en Chrome sin ventana.

**La prueba, con Sheep Oveja:**
- el banco se abre desde una carpeta del sitio;
- una frase tarda 2,7 s;
- la murga hasta la primera sección (37 s, 12 cantores) tarda **16 s** con los obreros de esta compu, contra 92 s
  en Node en un solo hilo;
- al recargar, el banco se abre solo.

## En la página principal (9 de noviembre de 2026)

**Los bancos son .zip en la carpeta `bancos/` del repositorio.** No se suben: los ignora `.gitignore`, porque cada
banco tiene sus condiciones. El repositorio lleva `bancos/plantel.json`, el plantel de siempre, y `bancos/LEEME.md`,
que dice de dónde bajar cada banco.
- **El plantel** tiene:
  - los bancos: archivo, nombre, autor, idioma, de dónde bajarlo y sus condiciones;
  - las voces que salen de cada uno: «MIKE», «MIKE grave» (capa `_dp`)… y sus valores;
  - quién canta en cada uno de los 13 lugares (`murga`).
- **Los zips se leen de a pedazos:** `zip.js` lee el directorio del zip y después cada archivo que hace falta, con
  pedidos de un rango de bytes. Eso lo dan GitHub Pages y `servir.js`, que ahora acepta pedidos por pedazos. Lo
  comprimido se descomprime con `DecompressionStream`. Si el .zip trae adentro un .uar (el instalador de UTAU), se
  abre el .uar. La carpeta del banco es la más cercana que tenga su `character.txt`, `prefix.map` o
  `character.yaml`.
- **Node usa los mismos zips:** `herramientas/banco_node.mjs` los abre para las herramientas (galería, murga, registro,
  solista).
- **`herramientas/utau_adelgazar.mjs`** deja en cada .zip sólo lo que el cantor usa: los .wav que nombra algún
  `oto.ini`, los `oto.ini`, el `prefix.map`, el `character.txt` y `.yaml`, y los readme con las condiciones.

**El plantel en «Cantantes»** (`motor/plantel.js`, enganchado en `app.js`):
- **Cada banco del plantel** aparece con su casilla, marcada por defecto si su .zip está. Al pasar el mouse se ven
  quién lo grabó, sus voces y sus condiciones.
- **Si un .zip no está** (la página publicada no los trae), el banco queda apagado y tachado, y ofrece «Buscar el
  archivo…». Chrome y Edge recuerdan el archivo elegido; la próxima vez piden un clic para dar permiso.
- **Desmarcar un banco** saca sus voces: sus lugares cantan con MBROLA.
- **En el inspector de cada murguista,** «Voz» ofrece MBROLA (es2, es1, es4) y las voces de los bancos. Las que no
  están aparecen apagadas y dicen qué falta. Con una voz de banco aparecen también tensión, ronquera, aire, esfuerzo
  y temblor de la grabación.
- **Por defecto,** cada lugar canta con la voz que le da el plantel si su banco está; si no, con MBROLA.
- **Las voces de banco** cantan en los obreros con el motor `banco`. Si algo falla, ese cantor canta con MBROLA.
- **El panel «Cantantes»** se ve siempre (antes se escondía con las muestras de coro, y por eso no aparecían los
  nombres y las caras). Con muestras o formantes, avisa que los murguistas no cantan con su voz y ofrece pasar a
  difonos.

**La prueba** (Chrome sin ventana, con `servir.js`): los 9 bancos aparecen listos y los 13 murguistas, con nombre,
cara y su voz del plantel. Una presentación entera (4:16) cantada con los bancos tarda 147 s, con 2927 pedidos por
pedazos a los zips desde los obreros y ninguno entero. Con `Sheep Oveja.zip` escondido, el plantel dice «8 de 9», su
banco queda apagado con «Buscar el archivo…», su voz aparece apagada en el inspector y su lugar canta con es2.

Lo que sigue, abajo, es el plan original para la página principal.

## Lo que hay hoy en la página

- **La pestaña «Los cantantes»** muestra los 13 murguistas, cada uno con su lugar (`bajos0`, `primos3`…), nombre y
  cara. Hay botones para «Solo» y «Callar», «Otros cantantes» (otro coro, `S.semCoro`) y «Volver a como salieron».
- **El inspector del cantante** tiene:
  - el nombre, la cara y el rango que canta en la pieza;
  - **Voz**: es2, es1 o es4;
  - once deslizadores (`PARAMS` en `app.js`): garganta, afinación, vibrato, velocidad del vibrato, brillo, color
    propio, dicción, adornos, grito, retraso, volumen y paneo;
  - «Volver a como salió», y «Exportar» e «Importar» un murguista (un .json).
- **Lo que se cambia a mano** se guarda en `S.ajustes[lugar]`, con la murga, en el navegador (`murgas.js`).
  Al cambiar un valor, en un momento vuelve a cantar sólo ese cantante.
- **Los bancos todavía no están en la página.** Sólo cantan en Node: `herramientas/murga_bancos.mjs` canta una pieza
  entera con un reparto por cuerda, y `herramientas/utau_galeria.mjs` arma la galería.

## Qué deja tocar UTAU

UTAU tiene cuatro niveles de ajustes. Para cada uno: qué es, y qué tenemos o podemos tener.

**1. El banco** (`oto.ini`, `prefix.map`, `character.yaml`). Dice dónde empieza y termina cada pedazo, qué altura
grabada usar en cada nota y los colores que trae (normal, suave, fuerte, falsete…).
- Ya lo leemos.
- Corregir el `oto.ini` es arreglar el banco, no el cantante: queda afuera de este plan.

**2. La nota** (el archivo de la canción, UST o USTX):
- la sílaba;
- el preutterance y el overlap propios de esa nota;
- de dónde empieza a leer el pedazo (STP);
- la curva de altura (portamento y vibrato con largo, período, profundidad, entrada y salida);
- la envolvente de volumen.

Nuestra curva de altura y nuestro volumen salen de `guion()`, igual que con MBROLA. Tocarlos nota por nota es lo que
ya empezó el inspector de la nota.

**3. Las expresiones de OpenUtau.** Valen para una nota o para una parte de la pista:

| Expresión | Qué hace | Rango (por defecto) |
|---|---|---|
| VEL, velocidad | lo rápido de las consonantes | 0–200 (100) |
| VOL, volumen | volumen de la nota | 0–200 (100) |
| ATK y DEC, ataque y caída | la envolvente al entrar y al salir | 0–200 (100) y 0–100 (0) |
| GEN, género | corre los formantes | −100 a 100 (0) |
| BRE, aire | soplo en la voz | 0–100 (0) |
| LPF, filtro | menos agudos | 0–100 (0) |
| MOD, modulación | cuánto del temblor de altura de la grabación se conserva | 0–100 (0) |
| SHFT, corrimiento | usar la grabación de otra altura | −36 a 36 (0) |
| CLR, color | qué color del banco (normal, suave, fuerte…) | según el banco |
| ALT, alternativo | otra toma del mismo alias | 0–16 (0) |

**4. Los flags del resampler.** El resampler es el programa que estira y afina cada pedazo, y cada uno trae los
suyos. Los más usados:
- **Del de UTAU:**
  - **g**, género (−100 a 100);
  - **t**, afinación en cents;
  - **P**, compresor, el volumen parejo (0–100, por defecto 86);
  - **B** e **Y**, aire;
  - **H** y **h**, menos agudos o menos graves;
  - **F**, fuerza de los formantes;
  - **W**, voz metálica.
- **De Moresampler:**
  - **Mt**, tensión de las cuerdas vocales;
  - **Mb**, aire;
  - **Mo**, boca más abierta;
  - **Mr**, resonancia (el «formante del cantante», cerca de 3 kHz);
  - **Md**, sequedad;
  - **MC**, aspereza;
  - **MG**, ronquera;
  - **MD**, distorsión;
  - **ME**, formantes marcados;
  - **A**, volumen que sigue al vibrato;
  - **b**, volumen de las consonantes sordas;
  - **e**, estirar en vez de repetir.

(Fuentes: <https://saoirse042.github.io/ResamplerDocs/resampler>,
<https://saoirse042.github.io/ResamplerDocs/moresampler>, la página «Getting Started» de la wiki de OpenUtau.)

## Qué le damos a cada cantante

Nuestro «resampler» es WORLD: separa altura, envolvente y aire. Eso hace fácil casi todo lo de arriba sin redes
neuronales.

**Los valores que comparten las dos clases de voces** (ya están en el inspector, salvo que se diga):
- **Voz:** cuál de las de MBROLA, o cuál banco y con qué color (CLR). La de banco **es nueva**.
- **Garganta:** `tracto`. En difonos ya está; en el banco ya anda (es el GEN de UTAU) y **falta en el inspector**.
- **Afinación, vibrato, velocidad del vibrato, adornos, retraso, volumen y paneo:** iguales para las dos.
- **Dicción:** en difonos, lo que duran las consonantes. En el banco sería el VEL de UTAU: la parte fija del pedazo
  más rápida o más lenta. **Falta en el banco.**
- **Grito:** `esforzar()` de `difonos.js`, que es la boca más abierta (Mo), la voz apretada (Mt) y el volumen parejo.
  Hoy se aplica sólo después de MBROLA. **Se puede pasar al banco**: corre sobre la voz ya sintetizada.
- **Brillo y color propio:** la ecualización de cada cantor (`terminar()`), que también **se puede pasar al banco**.
- **Entrada desde abajo, caída al final y respiración** (nuevos, la noche del 9 de noviembre): `pique`, `caida` y
  `respira`, en el inspector de la página y en el estudio. Por defecto, lo medido en los solistas y en el coro real
  (`docs/solistas_reales.md`, `docs/respiraciones.md`; los valores, en `ESTILO` y `ESTILO_BANCO` de `variacion.js`).

**Sólo para los bancos, nuevos:**
- **Sin falsete:** `evitar` (que no use una altura o un color). Ya está en `banco.js`.
- **Aire** (BRE, Mb): subir el aire de WORLD en las vocales.
- **Tensión** (Mt): menos fundamental y más agudos, como cuando la voz se aprieta.
- **Ronquera** (MG, MC): un temblor rápido de altura y volumen, y un poco de ruido. La voz rajada de murga; habría
  que medirla contra el coro real.
- **Temblor de la grabación** (MOD): `modulacion`, ya está (por defecto 1, todo).
- **Esfuerzo** (SHFT): usar la grabación de una altura más aguda que la nota, que suena más esforzada; o más grave,
  más relajada.
- **Respiraciones:** muchos bancos traen respiraciones grabadas («br», «-bre»), que podrían ir entre frase y frase.
  Por ahora, `respirar()` (difonos.js) sintetiza el soplo medido en el coro real para las dos clases de voces; las
  grabadas quedan para probar.

**El acento, para las dos:** cómo se dicen la ll/y (sh, zh o ll), la jota (h, o k en los bancos que no tienen
jota), las eses (aspiradas, comidas o enteras) y la rr (de verdad o simple). Hoy `guion()` tiene `acento` y
`sheismo`, y las tablas de `banco.js` eligen lo que tiene cada banco. Como valor del cantante sería un «Acento:
rioplatense / neutro».

**Lo que queda afuera:** corregir el `oto.ini` y las curvas nota por nota (eso es del inspector de la nota).

## Cómo se arma la murga en la página

**1. El plantel: las voces que hay.**
- **Las de MBROLA** vienen con la página. es4, al oído, «malísimo»: o se saca o queda al final de la lista.
- **Los bancos los carga cada uno** desde su compu, porque no se pueden redistribuir:
  - un botón «Cargar un banco…» recibe el .zip, `zip.js` lo lee con los nombres en Shift-JIS, y queda guardado en el
    navegador (IndexedDB, pidiendo almacenamiento persistente: un banco pesa de 30 a 400 MB);
  - del banco se muestran el nombre, el autor, la web, el idioma y sus condiciones (los que piden crédito, como
    Vincen-oto, lo piden también en «Cómo funciona»);
  - al cargarlo se mide solo: sus alturas grabadas y sus colores (`utau_registro.mjs` hace eso hoy en Node), y con
    eso, para qué cuerdas sirve y si el agudo es de pecho o falsete.
- **Cada color de un banco es una voz más** del plantel: «MIKE», «MIKE grave», «MIKE suave».

**2. Elegir la voz de un lugar**, en el inspector:
- **La lista de voces** va agrupada: MBROLA; los bancos, con su idioma; y «Cargar un banco…».
- **Al lado de cada voz,** qué tan bien le queda a esta cuerda. Por ejemplo: «grabado de Sol 3 a Re 4: le queda
  bien»; «la estira 7 semitonos»; «arriba de Do 5 usa falsete».
- **«Escuchar la voz»:** una frase corta en el registro de este lugar, como una celda de la galería.
- **Los deslizadores** son los comunes, más los de banco cuando la voz es de banco: color, sin falsete, aire,
  tensión, ronquera, temblor de la grabación, esfuerzo.

**3. Armar todo de una**, en la pestaña «Los cantantes»:
- **«Repartir las voces»:** le da a cada lugar una voz del plantel que le quede bien a su cuerda. Trata de no repetir
  voces en la misma cuerda; si repite, la repetida lleva otra garganta, como hace hoy `murga_bancos.mjs`. Lo que se
  eligió a mano no se toca.
- **Formaciones guardadas:** una formación son los 13 lugares con su voz y sus valores, con nombre. Se pueden
  guardar varias («la de las demos», «todos de banco»…), aplicarlas a cualquier murga, y exportarlas o importarlas
  como el murguista de hoy.
- **Lo que viaja en un archivo:** el banco no viaja, sólo su nombre. Si otro navegador no lo tiene cargado, ese
  lugar canta con es2 y se avisa cuál banco falta.
- **Lo que ya guarda la murga:** los ajustes de cada lugar, en `S.ajustes`. Sólo se suma la voz de banco:
  `voz: 'banco'` y `banco: { id, capa, evitar, tracto }`, como dice `docs/utau.md`.

## Lo que hace falta en el motor

Esto es de esta sesión, en `motor/cantor/`:

1. **`bancos.js` (nuevo).** Guarda y lee los bancos en IndexedDB: el .zip entero, y el índice de sus entradas. Arma
   el banco (`crearBanco`) y, antes de cantar una frase, descomprime sólo los .wav que va a usar
   (`DecompressionStream`). También mide el banco al cargarlo.
2. **El análisis de WORLD, guardado.** Cada pedazo tarda de 0,3 a 1 s; guardado por banco en IndexedDB, la segunda
   vez no se analiza.
3. **`obrero.js`, un motor `banco`.** Recibe la misma entrada que el de difonos y da la misma salida. Lee el banco
   desde IndexedDB, que también se usa desde un Worker, y lleva la memoria de frases que ya cantó, como difonos
   (`memo`).
4. **`cantarBanco`, los valores nuevos:** dicción (VEL), aire, tensión, ronquera, esfuerzo y respiraciones. El grito,
   el brillo y el color propio, pasados de `difonos.js`.
5. **`repartir(plantel, cuerdas)`:** el reparto automático, en el motor, para que lo usen la página y las
   herramientas.

**Lo que tardaría**, estimado desde `murga_bancos.mjs` (12 cantores, 74 s de pieza, 123 s en esta compu, en un solo
hilo): unos 0,14 s por segundo cantado y por cantor.
- Una retirada de 4 minutos con 13 cantores: unos 7 minutos en un hilo, unos 2 con cuatro obreros. Más el primer
  análisis de cada banco.
- Cambiar un cantante, después: unos 30 s.

Hay que medirlo en el navegador.

## Quién hace qué, para no pisarnos

- **Esta sesión:** `motor/cantor/banco.js`, `world.js`, `zip.js`, `bancos.js` (nuevo), el motor `banco` de
  `obrero.js` y las herramientas.
- **La sesión de la interfaz:** `motor/app.js`, `index.html`, `motor/vista.js` y `motor/murgas.js`.
- **Lo que comparten:** cómo se escribe la voz de banco de un lugar, en `S.ajustes`. Se acuerda antes, en
  `docs/utau.md`.

## En qué orden

1. **Las decisiones de abajo.**
2. **Motor:** `bancos.js`, el motor `banco` en el obrero y el análisis guardado. Se puede probar sin interfaz,
   cantando una murga en la página con un reparto fijo.
3. **Interfaz:** «Cargar un banco…», la lista de voces del inspector y «Escuchar la voz».
4. **Motor:** los valores nuevos (dicción, aire, tensión, ronquera, esfuerzo) y el grito, el brillo y el color en el
   banco. **Interfaz:** sus deslizadores.
5. **«Repartir las voces» y las formaciones guardadas.**
6. **Medir:**
   - de oído, con vos;
   - Whisper, para ver si se entiende la letra con cada voz;
   - el coro contra el real (bandas y H1−H2, como en `solista.md`);
   - el tiempo en el navegador.

## Lo que hay que decidir

1. **es4:** ¿se saca del reparto de siempre de la página (el tercer cantor de cada cuerda)? En el estudio ya no está.
2. **Cargar los bancos:** decidido: la carpeta de cada uno, recordada por su llave (ver arriba). Queda: ¿también un
   .zip, para los que vienen así?
3. **El inspector:** ¿todos los deslizadores a la vista, o los comunes a la vista y los de banco en «Más»?
4. **Repartir las voces:** ¿automático al cargar el primer banco, o sólo con el botón?
5. **Ronquera y grito:** ¿se miden contra el coro real antes de ponerlos, o primero de oído?
