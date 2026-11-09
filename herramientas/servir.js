// Sirve la página en http://localhost:8123 (el navegador no deja cargar audios desde un archivo suelto).
//   node herramientas/servir.js
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { RAIZ } from './corpus.js';

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
const PUERTO = +process.argv[2] || 8123;

http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const f = normalize(join(RAIZ, ruta));
  // La página no usa nada de murga_trabajo: así se nota enseguida si algo lo pide
  if (!f.startsWith(normalize(RAIZ)) || ruta.startsWith('/murga_trabajo') || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end('no está'); return; }
  const tipo = TIPOS[extname(f)] || 'application/octet-stream', tam = statSync(f).size;
  // pedazos (Range): los bancos de voces (bancos/*.zip) se leen de a un archivo por vez, sin bajar el .zip entero
  const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (rango) {
    const a = rango[1] === '' ? Math.max(0, tam - +rango[2]) : +rango[1], z = rango[1] === '' || rango[2] === '' ? tam - 1 : Math.min(tam - 1, +rango[2]);
    if (a > z || a >= tam) { res.writeHead(416, { 'content-range': `bytes */${tam}` }); res.end(); return; }
    res.writeHead(206, { 'content-type': tipo, 'content-range': `bytes ${a}-${z}/${tam}`, 'content-length': z - a + 1, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(f, { start: a, end: z }).pipe(res); return;
  }
  res.writeHead(200, { 'content-type': tipo, 'content-length': tam, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
  if (req.method === 'HEAD') { res.end(); return; }
  createReadStream(f).pipe(res);
}).listen(PUERTO, '127.0.0.1', () => console.log(`Murga-o-matic en http://localhost:${PUERTO}`));
