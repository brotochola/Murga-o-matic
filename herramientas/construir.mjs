// construir.mjs — la versión liviana del Murga-o-matic, para usar sin internet en la compu: una carpeta aparte
// (Murga-o-matic-offline/, al lado del repositorio) con sólo lo que hace falta para usar la app: la página, sus voces,
// los bancos recortados y un servidor chico (servir.mjs; abrir.bat lo arranca y abre Chrome).
//
//   - sólo los archivos que la página usa (una lista fija: nada de herramientas, documentos, licencias, fuentes del
//     WebAssembly ni el estudio de voces, que la página ya no abre)
//   - el código minificado archivo por archivo (bun build --no-bundle --minify): las rutas y los módulos quedan
//     iguales (guardadas.js lee motor/cantor/*.js por su ruta y los obreros se cargan por su dirección)
//   - los loops y las frases en Opus a 96 kbps y las muestras del coro a 64 kbps (ffmpeg), en vez de WAV y MP3
//   - las voces de MBROLA comprimidas con gzip (mbrola.js las abre con DecompressionStream)
//   - offline.json y sw.js de la carpeta, para que también ande cerrando el servidor (menos los bancos)
//   - los bancos: los que deja herramientas/utau_recortar.mjs en su bancos/ (no se tocan al reconstruir)
//
// Con --web, la versión para publicar (herramientas/publicar.mjs, en GitHub Pages): sin los bancos de UTAU (son de
// uso personal: no se pueden publicar; el que los tiene los elige con «Buscar el archivo»), sin servidor, y con las
// licencias de lo que se redistribuye (las voces de MBROLA las piden), cantada/ (direcciones viejas) y .nojekyll.
//
//   node herramientas/construir.mjs [carpeta] [--web]   (por defecto ../Murga-o-matic-offline, o ../Murga-o-matic-web;
//                                                         hacen falta bun y ffmpeg)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { armarOffline } from './offline.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), WEB = args.includes('--web');
const SAL = resolve(args.find(a => !a.startsWith('--')) || join(RAIZ, '..', WEB ? 'Murga-o-matic-web' : 'Murga-o-matic-offline'));
if (SAL === RAIZ || RAIZ.startsWith(SAL + sep)) throw new Error('la carpeta de salida no puede ser el repositorio ni contenerlo');
// se vacía antes de armarla: sólo si es una que armó esta herramienta (o una nueva, o con los bancos solos)
if (existsSync(SAL) && readdirSync(SAL).some(f => f !== 'bancos') && !(existsSync(join(SAL, 'offline.json')) && existsSync(join(SAL, 'motor'))))
  throw new Error(`${SAL} no parece una carpeta de construir.mjs (no tiene offline.json y motor/): no la vacío`);
const PUERTO = 8124;
const reloj = Date.now(), seg = () => ((Date.now() - reloj) / 1000).toFixed(0) + ' s';
const MB = n => (n / 1e6).toFixed(2) + ' MB';

// lo que va: la página y lo que pide (el código, menos el del estudio; de vendor/, las librerías, los WebAssembly y las
// voces de MBROLA)
const VAN = /^(index\.html|manifest\.webmanifest|sw\.js|iconos\/.+|motor\/(?!estudio\.js$)(?!vendor\/).+\.js|motor\/vendor\/[^/]+\.js|motor\/vendor\/mbrola\/(mbrola\.wasm|es\d+)|motor\/vendor\/world\/world\.wasm|loops\/.+\.wav|frases\/.+\.wav|coro\/.+\.mp3|bancos\/plantel\.json)$/;
// en la web, además: las licencias y de dónde salen los WebAssembly, y las direcciones viejas
const VAN_WEB = /^(motor\/vendor\/.*(LICEN[CS][EI]A?|LEEME|glue).*|cantada\/index\.html|bancos\/LEEME\.md)$/;
const rutas = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').filter(r => (VAN.test(r) || WEB && VAN_WEB.test(r)) && existsSync(join(RAIZ, r))).sort();

// la carpeta, limpia (menos los bancos recortados, que son de utau_recortar.mjs; en la web no van)
mkdirSync(SAL, { recursive: true });
for (const f of readdirSync(SAL)) if (WEB || f !== 'bancos') rmSync(join(SAL, f), { recursive: true, force: true });

// los audios cambian de nombre: el código los pide con el nuevo (y avisa si no encontró lo que esperaba)
const AUDIO = [
  [/\b(loops|frases)\/(\d+)\.wav\b/g, '$1/$2.ogg'],
  [/(coro\/\$\{[^}`]+\}\/\$\{[^}`]+\})\.mp3`/g, '$1.ogg`'],
];
const ESPERADOS = { 'motor/app.js': 19, 'motor/cantor/datos.js': 17 };
function cambiarAudios(r, t) {
  let n = 0;
  for (const [re, por] of AUDIO) t = t.replace(re, (...m) => { n++; return por.replace(/\$(\d)/g, (_, k) => m[k]); });
  if ((ESPERADOS[r] ?? 0) !== n) throw new Error(`${r}: ${n} rutas de audio cambiadas, se esperaban ${ESPERADOS[r] ?? 0} (¿cambió el código?)`);
  return t;
}

// bun: en Windows, el bun.exe (el «bun» de npm es un .cmd, que Node no corre sin una consola)
const BUN = process.platform !== 'win32' ? 'bun' : (process.env.PATH || '').split(';').flatMap(d => [join(d, 'bun.exe'), join(d, 'node_modules', 'bun', 'bin', 'bun.exe')]).find(existsSync) || 'bun';

const hechas = [];
const destino = r => { const d = join(SAL, r); mkdirSync(dirname(d), { recursive: true }); return d; };
let js = 0;
for (const r of rutas) {
  const o = join(RAIZ, r);
  if (/^motor\/.+\.js$/.test(r) && !r.startsWith('motor/vendor/')) {
    // el código: con las rutas nuevas de los audios, minificado
    const tmp = destino(r) + '.fuente.js';
    writeFileSync(tmp, cambiarAudios(r, readFileSync(o, 'utf8')));
    execFileSync(BUN, ['build', '--no-bundle', '--minify', tmp, '--outfile', destino(r)], { stdio: 'pipe' });
    rmSync(tmp); hechas.push(r); js++;
  } else if (/^(loops|frases|coro)\//.test(r)) {
    const nueva = r.replace(/\.(wav|mp3)$/, '.ogg'), kbps = r.startsWith('coro/') ? '64k' : '96k';
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', o, '-map_metadata', '-1', '-c:a', 'libopus', '-b:a', kbps, '-vbr', 'on', '-application', 'audio', destino(nueva)]);
    hechas.push(nueva);
  } else if (/^motor\/vendor\/mbrola\/es\d+$/.test(r)) {
    writeFileSync(destino(r), gzipSync(readFileSync(o), { level: 9 })); hechas.push(r);
  } else { copyFileSync(o, destino(r)); hechas.push(r); }
}
console.log(`${hechas.length} archivos (${js} de código minificados, audios en Opus) · ${seg()}`);

// lo que guarda el navegador para andar sin el servidor, y la versión de sw.js
const off = armarOffline(SAL, hechas);
writeFileSync(join(SAL, 'offline.json'), off.json);
writeFileSync(join(SAL, 'sw.js'), off.swNuevo);

// en la web: que GitHub Pages no la pase por Jekyll
if (WEB) writeFileSync(join(SAL, '.nojekyll'), '');
// en la compu: el servidor y cómo se abre
else writeFileSync(join(SAL, 'servir.mjs'), `// servir.mjs — el Murga-o-matic liviano en http://localhost:${PUERTO} (abrir.bat lo arranca y abre Chrome).
// Sirve los archivos de esta carpeta; los bancos de voces (bancos/*.zip), de a pedazos.
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const RAIZ = dirname(fileURLToPath(import.meta.url));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.ogg': 'audio/ogg', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.zip': 'application/zip', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const PUERTO = +process.argv[2] || ${PUERTO};
const servidor = http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const f = normalize(join(RAIZ, ruta));
  if (!f.startsWith(normalize(RAIZ)) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end('no está'); return; }
  const tipo = TIPOS[extname(f)] || 'application/octet-stream', tam = statSync(f).size;
  const rango = /^bytes=(\\d*)-(\\d*)$/.exec(req.headers.range || '');
  if (rango) {
    const a = rango[1] === '' ? Math.max(0, tam - +rango[2]) : +rango[1], z = rango[1] === '' || rango[2] === '' ? tam - 1 : Math.min(tam - 1, +rango[2]);
    if (a > z || a >= tam) { res.writeHead(416, { 'content-range': \`bytes */\${tam}\` }); res.end(); return; }
    res.writeHead(206, { 'content-type': tipo, 'content-range': \`bytes \${a}-\${z}/\${tam}\`, 'content-length': z - a + 1, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(f, { start: a, end: z }).pipe(res); return;
  }
  res.writeHead(200, { 'content-type': tipo, 'content-length': tam, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(f).pipe(res);
});
servidor.on('error', e => { if (e.code === 'EADDRINUSE') { console.log('Ya estaba andando en http://localhost:' + PUERTO); process.exit(0); } throw e; });
servidor.listen(PUERTO, '127.0.0.1', () => console.log('Murga-o-matic en http://localhost:' + PUERTO + ' (cerrando esta ventana se apaga)'));
`);
if (!WEB) writeFileSync(join(SAL, 'abrir.bat'), [
  '@echo off',
  'rem Murga-o-matic sin internet: arranca el servidor de esta carpeta (si no estaba andando) y abre Chrome.',
  'rem Hace falta Node. El servidor queda en una ventana minimizada: cerrandola se apaga. Sin el servidor la',
  'rem pagina abre igual (la guarda el navegador), pero los bancos de voces no. Los bancos son de uso personal.',
  'cd /d "%~dp0"',
  'start "Murga-o-matic" /min node servir.mjs',
  'timeout /t 1 /nobreak >nul',
  `set CHROME=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe`,
  // (?offline=1: en localhost la página sólo se guarda en el navegador si se lo pide, motor/sinconexion.js)
  `if exist "%CHROME%" (start "" "%CHROME%" --app=http://localhost:${PUERTO}/?offline=1) else (start "" http://localhost:${PUERTO}/?offline=1)`,
  '',
].join('\r\n'));

// lo que pesa
const pesos = new Map();
const sumar = (k, b) => pesos.set(k, (pesos.get(k) || 0) + b);
(function andar(d, rel) {
  for (const f of readdirSync(d)) {
    const p = join(d, f), r = rel ? rel + '/' + f : f;
    if (f === '.git') continue;
    if (statSync(p).isDirectory()) andar(p, r);
    else sumar(r.startsWith('bancos/') && r.endsWith('.zip') ? 'bancos de UTAU' : r.startsWith('motor/vendor/mbrola/es') ? 'voces de MBROLA' : /^(loops|frases|coro)\//.test(r) ? 'loops, frases y coro' : r.startsWith('motor/vendor/') ? 'librerías y WebAssembly' : 'página y código', statSync(p).size);
  }
})(SAL, '');
const total = [...pesos.values()].reduce((a, b) => a + b, 0);
for (const [k, b] of [...pesos].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(24)} ${MB(b).padStart(10)}`);
console.log(`→ ${SAL}: ${MB(total)} (sin los bancos ${MB(total - (pesos.get('bancos de UTAU') || 0))}; núcleo ${MB(off.nucleo)}) · ${seg()}`);
if (!WEB && !pesos.get('bancos de UTAU')) console.log('  (no hay bancos: node herramientas/utau_recortar.mjs los deja en la carpeta bancos/ de acá)');
