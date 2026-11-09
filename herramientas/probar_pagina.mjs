// Recorre la página como un usuario, en Chrome sin ventana, y cuenta los errores: carga, demos, otra semilla,
// largo, tercia, timbre, estilo, las dos versiones del compositor, tocar, pausa y exportar. Sale con código 1 si algo falla.
//   node herramientas/probar_pagina.mjs [carpeta]      sirve esa carpeta (por defecto, la del repositorio)
//   node herramientas/probar_pagina.mjs --url URL      prueba una página ya publicada
// Chrome: la variable CHROME, o el chrome-headless-shell que instala Playwright. El perfil va a la carpeta
// temporal (o a MURGA_PERFIL).
import { spawn, execFileSync } from 'node:child_process';
import http from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { RAIZ } from './corpus.js';

const args = process.argv.slice(2);
const iUrl = args.indexOf('--url');
const URL_PUBLICADA = iUrl >= 0 ? args[iUrl + 1] : null;
const CARPETA = resolve(URL_PUBLICADA ? '.' : args[0] || RAIZ);
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
const esperar = ms => new Promise(r => setTimeout(r, ms));
// la lista de la página sin conexión tiene que estar al día con los archivos (herramientas/offline.mjs)
if (!URL_PUBLICADA) {
  try { execFileSync(process.execPath, [join(RAIZ, 'herramientas', 'offline.mjs'), '--comprobar'], { stdio: 'inherit' }); }
  catch { console.error('La página sin conexión quedó atrasada: node herramientas/offline.mjs'); process.exitCode = 1; }
}

function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const pw = join(process.env.LOCALAPPDATA || join(process.env.HOME || '', '.cache'), 'ms-playwright');
  const dir = existsSync(pw) && readdirSync(pw).filter(d => d.startsWith('chromium_headless_shell')).sort().pop();
  const exe = dir && ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-headless-shell-mac-x64/chrome-headless-shell'].map(p => join(pw, dir, p)).find(existsSync);
  if (!exe) { console.error('No encontré Chrome: poné su ruta en la variable CHROME.'); process.exit(2); }
  return exe;
}

// Un servidor estático mínimo, que además anota lo que la página pide y no existe
const faltan = [];
let srv = null, url = URL_PUBLICADA;
if (!url) {
  srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = normalize(join(CARPETA, p));
    if (f.startsWith(CARPETA) && existsSync(f) && statSync(f).isFile()) { r.writeHead(200, { 'content-type': TIPOS[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); }
    else { faltan.push(p); r.writeHead(404); r.end(); }
  });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  url = `http://127.0.0.1:${srv.address().port}/`;
}

const PUERTO = 9300 + Math.floor(Math.random() * 500);
const perfil = process.env.MURGA_PERFIL || join(tmpdir(), 'murga_perfil');
const ch = spawn(chrome(), [`--remote-debugging-port=${PUERTO}`, '--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--window-size=1280,900', `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' });
let lista = null;
for (let i = 0; i < 40 && !lista; i++) { await esperar(250); try { lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json(); } catch { } }
const ws = new WebSocket(lista.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; const errores = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend[m.id]) { pend[m.id](m.result); delete pend[m.id]; }
  if (m.method === 'Runtime.exceptionThrown') errores.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 400));
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errores.push('ERR ' + m.params.args.map(a => a.value || a.description).join(' ').slice(0, 400));
  if (m.method === 'Network.loadingFailed' && !m.params.canceled) errores.push('RED ' + m.params.errorText);
};
const env = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const leer = async x => (await env('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value;
await env('Runtime.enable'); await env('Network.enable'); await env('Page.enable');
await env('Page.navigate', { url });

const ESTADO = `document.getElementById("status")?.textContent+" | "+document.getElementById("play")?.textContent+" | filas "+document.querySelectorAll(".mt-sec").length`;
let fallas = 0;
async function listo() {
  await esperar(700);
  let e = '';
  for (let i = 0; i < 120; i++) { await esperar(500); e = await leer(ESTADO); if (/\| Tocar/.test(e) && /filas [1-9]/.test(e)) return e; }
  fallas++; return 'SE PASÓ DEL TIEMPO: ' + e;
}
async function paso(nombre, js) {
  const t = Date.now();
  if (js) await leer(js);
  const e = await listo();
  console.log(nombre.padEnd(20), ((Date.now() - t) / 1000).toFixed(1).padStart(5) + ' s ', e.slice(0, 110));
}
const poner = (i, v) => `(()=>{const x=document.getElementById('${i}');x.value='${v}';x.dispatchEvent(new Event('change'))})()`;

console.log('Probando', url);
await paso('carga');
console.log('demos:', await leer(`[...document.querySelectorAll('#demos button')].map(b=>b.textContent).join(' / ')`));
await paso('demo 1', `document.querySelector('#demos button').click()`);
await paso('demo 4', `document.querySelectorAll('#demos button')[3].click()`);
await paso('otra semilla', `document.getElementById('otra').click()`);
await paso('largo corta', poner('largo', 'corta'));
await paso('tercia', poner('tercia', '0.5'));
await paso('timbre', poner('brillo', '0'));
await paso('estilo', poner('estilo', 'catalina'));
await paso('versión 1', poner('version', '1'));
await paso('versión 2', poner('version', '2'));
await paso('presentación', `document.querySelector('#forma button[data-v=presentacion]').click()`);
const notas = await leer(`Object.values(window.murga.S.pieza.ev).reduce((a,l)=>a+l.length,0)`);
console.log('notas en el coro:', notas);
if (!(notas > 50)) fallas++;
await leer(`document.getElementById('play').click()`);
await esperar(1500);
const t = await leer(`document.getElementById('time').textContent`);
console.log('tocando:', t, '·', await leer(`document.getElementById('play').textContent`));
if (/^0:00 /.test(t)) { console.log('  el tiempo no avanzó'); fallas++; }
await leer(`document.getElementById('play').click()`);
await leer(`document.getElementById('exportar').click()`);
let ex = '';
for (let i = 0; i < 60; i++) { await esperar(1000); ex = await leer(`document.getElementById('expStatus').textContent`); if (ex && !/Mezclando/.test(ex)) break; }
console.log('exportar:', ex);
if (!/Descargado|Guardado/.test(ex)) fallas++;

const pedidos = faltan.filter(p => p !== '/favicon.ico');
if (pedidos.length) console.log('pidió y no estaba:', [...new Set(pedidos)].join(', '));
console.log('errores:', errores.length); errores.slice(0, 10).forEach(x => console.log('  ' + x));
ch.kill(); ws.close(); srv?.close();
process.exit(fallas || errores.length || pedidos.length ? 1 : 0);
