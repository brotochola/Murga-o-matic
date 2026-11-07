// Sirve la página en http://localhost:8123 (el navegador no deja cargar audios desde un archivo suelto).
//   node herramientas/servir.js
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { RAIZ } from './corpus.js';

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const PUERTO = +process.argv[2] || 8123;

http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta.endsWith('/')) ruta += 'index.html';
  const f = normalize(join(RAIZ, ruta));
  // La página no usa nada de murga_trabajo: así se nota enseguida si algo lo pide
  if (!f.startsWith(normalize(RAIZ)) || ruta.startsWith('/murga_trabajo') || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end('no está'); return; }
  res.writeHead(200, { 'content-type': TIPOS[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(f).pipe(res);
}).listen(PUERTO, '127.0.0.1', () => console.log(`Murga-o-matic en http://localhost:${PUERTO}`));
