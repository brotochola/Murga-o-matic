// probar_estudio.mjs — prueba estudio.html en Chrome sin ventana, de punta a punta, con un banco de verdad: lo copia a
// la carpeta privada del sitio (OPFS, que da las mismas llaves de carpeta que el selector), lo agrega, pone a todos
// enojados, canta una voz, canta la murga hasta el final de la primera sección y recarga para ver que el banco se
// abre solo. Sale con código 1 si algo falla.
//
//   node herramientas/probar_estudio.mjs [banco chico]   (un .zip, por defecto bancos/Sheep Oveja.zip, 27 MB; o una carpeta)
import { spawn } from 'node:child_process';
import http from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync, createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, relative } from 'node:path';
import { RAIZ } from './corpus.js';

const BANCO = resolve(process.argv[2] || join(RAIZ, 'bancos', 'Sheep Oveja.zip')), ES_ZIP = /\.(zip|uar)$/i.test(BANCO);
if (!existsSync(BANCO)) { console.error('uso: node herramientas/probar_estudio.mjs [un .zip o la carpeta de un banco]'); process.exit(2); }
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.wasm': 'application/wasm' };
const esperar = ms => new Promise(r => setTimeout(r, ms));
const archivos = [];
if (!ES_ZIP) (function andar(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else if (/\.(wav|ini|map|txt|yaml)$/i.test(f)) archivos.push(relative(BANCO, p).split(/[\\/]/).join('/')); } })(BANCO);

// el repositorio, y el banco en /_banco/ (para copiarlo a la carpeta privada del sitio)
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/_banco/lista.json') { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(archivos)); return; }
  if (p === '/_banco.zip') { r.writeHead(200, { 'content-type': 'application/zip' }); r.end(readFileSync(BANCO)); return; }
  const base = p.startsWith('/_banco/') ? BANCO : RAIZ, f = normalize(join(base, p.replace(/^\/_banco\//, '/')));
  if (f.startsWith(base) && existsSync(f) && statSync(f).isFile()) {
    // de a pedazos, como herramientas/servir.js (los bancos de bancos/ se leen así)
    const tam = statSync(f).size, m = /^bytes=(\d+)-(\d*)$/.exec(q.headers.range || ''), tipo = TIPOS[extname(f)] || 'application/octet-stream';
    if (m) { const a = +m[1], z = m[2] === '' ? tam - 1 : Math.min(tam - 1, +m[2]); if (a > z) { r.writeHead(416); r.end(); return; } r.writeHead(206, { 'content-type': tipo, 'content-range': `bytes ${a}-${z}/${tam}`, 'content-length': z - a + 1 }); createReadStream(f, { start: a, end: z }).pipe(r); }
    else { r.writeHead(200, { 'content-type': tipo }); r.end(readFileSync(f)); }
  }
  else { r.writeHead(404); r.end(); }
});
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${srv.address().port}/estudio.html`;

function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const pw = join(process.env.LOCALAPPDATA || join(process.env.HOME || '', '.cache'), 'ms-playwright');
  const dir = existsSync(pw) && readdirSync(pw).filter(d => d.startsWith('chromium_headless_shell')).sort().pop();
  const exe = dir && ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-headless-shell-linux64/chrome-headless-shell'].map(p => join(pw, dir, p)).find(existsSync);
  if (!exe) { console.error('No encontré Chrome: poné su ruta en la variable CHROME.'); process.exit(2); }
  return exe;
}
const PUERTO = 9300 + Math.floor(Math.random() * 500);
const perfil = join(process.env.MURGA_PERFIL || tmpdir(), 'murga_estudio_' + Date.now());
const ch = spawn(chrome(), [`--remote-debugging-port=${PUERTO}`, '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' });
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
};
const env = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const leer = async (x, espera = true) => { const r = await env('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: espera }); if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };
await env('Runtime.enable'); await env('Page.enable');
let fallas = 0;
const ok = (bien, que) => { console.log(`${bien ? 'bien' : 'MAL '}  ${que}`); if (!bien) fallas++; };
async function hasta(js, ms = 120000) { const t = Date.now(); while (Date.now() - t < ms) { const v = await leer(js); if (v) return v; await esperar(400); } return null; }

await env('Page.navigate', { url });
ok(await hasta('!!window.estudio', 20000), 'abre el estudio');
// el banco a la carpeta privada del sitio
const t0 = Date.now();
const copiados = ES_ZIP ? await leer(`(async () => {
  const raiz = await navigator.storage.getDirectory(), h = await raiz.getFileHandle('banco_de_prueba.zip', { create: true }), w = await h.createWritable();
  await w.write(await (await fetch('/_banco.zip')).arrayBuffer()); await w.close(); window.__zip = h; return 1;
})()`) : await leer(`(async () => {
  const raiz = await navigator.storage.getDirectory(), dir = await raiz.getDirectoryHandle('banco_de_prueba', { create: true });
  const lista = await (await fetch('/_banco/lista.json')).json();
  for (const ruta of lista) {
    const partes = ruta.split('/'); let d = dir;
    for (const p of partes.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
    const f = await d.getFileHandle(partes[partes.length - 1], { create: true }), w = await f.createWritable();
    await w.write(await (await fetch('/_banco/' + ruta.split('/').map(encodeURIComponent).join('/'))).arrayBuffer()); await w.close();
  }
  window.__dir = dir; return lista.length;
})()`);
ok(ES_ZIP ? copiados === 1 : copiados === archivos.length, `copia el banco a la carpeta del sitio (${copiados} archivos, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
await leer(ES_ZIP ? `window.estudio.agregarCarpeta({ zip: window.__zip }, 'banco_de_prueba', false)` : `window.estudio.agregarCarpeta({ handle: window.__dir }, 'banco_de_prueba', false)`);
const info = await leer(`document.getElementById('bancos').innerText`);
ok(/entradas/.test(info), 'agrega el banco: ' + info.replace(/\s+/g, ' ').slice(0, 160));
const voces = await leer(`window.estudio.S.plantel.map(v => v.nombre).join(', ')`);
ok(voces.split(', ').length >= 3, 'el plantel: ' + voces);
const deCarpeta = await hasta(`window.estudio.S.bancos.filter(b => b.url && b.listo).length`, 60000);
ok(deCarpeta >= 1, `los bancos de bancos/ se cargan solos: ${deCarpeta}`);
// todos enojados, y que cante la voz del banco
await leer(`document.getElementById('enojados').click()`);
const grito = await leer(`window.estudio.S.plantel.find(v => v.banco)?.grito`);
ok(grito > 1, `«Enojados y gritando» le sube el grito (${grito})`);
const iBanco = await leer(`window.estudio.S.plantel.findIndex(v => v.banco)`);
const t1 = Date.now();
await leer(`window.estudio.cantarVoz(${iBanco})`);
const est = await leer(`document.querySelector('#voz${iBanco} .estado').textContent`);
ok(/^en /.test(est), `canta la voz del banco en el navegador: ${est} (${((Date.now() - t1) / 1000).toFixed(1)} s con la carga)`);
const dur = await leer(`new Promise(r => { const a = document.querySelector('#voz${iBanco} audio'); if (a.readyState >= 1) r(a.duration); else a.onloadedmetadata = () => r(a.duration); })`);
ok(dur > 3 && dur < 9, `el audio dura ${dur?.toFixed(2)} s`);
const iMb = await leer(`window.estudio.S.plantel.findIndex(v => v.mbrola)`);
await leer(`window.estudio.cantarVoz(${iMb})`);
ok(/^en /.test(await leer(`document.querySelector('#voz${iMb} .estado').textContent`)), 'canta una voz de MBROLA');
// la murga, hasta el final de la primera sección
await leer(`(() => { const h = document.getElementById('hasta'); h.value = 10; h.onchange(); document.getElementById('cantarMurga').click(); })()`);
const t2 = Date.now();
const fin = await hasta(`/^(Lista|No salió)/.test(document.getElementById('estadoMurga').textContent) && document.getElementById('estadoMurga').textContent`, 600000);
ok(/^Lista/.test(fin || ''), `canta la murga: ${fin} (${((Date.now() - t2) / 1000).toFixed(0)} s)`);
const mp3 = await leer(`(async () => { const a = document.getElementById('bajarMp3'); if (!a.href) return 0; return (await (await fetch(a.href)).blob()).size; })()`);
ok(mp3 > 100000, `el mp3 pesa ${(mp3 / 1e6).toFixed(2)} MB`);
// recargar: el banco se abre solo (la llave quedó guardada)
await env('Page.reload');
await esperar(1500);
const abierto = await hasta(`window.estudio && window.estudio.S.bancos.some(b => b.listo) && document.getElementById('bancos').innerText`, 30000);
ok(!!abierto, 'al recargar, el banco se abre solo');
ok(await leer(`window.estudio.S.plantel.find(v => v.banco)?.grito`) > 1, 'y el plantel guardado sigue enojado');

for (const e of errores) console.log('  ' + e);
if (errores.length) fallas++;
console.log(fallas ? `${fallas} cosas mal` : 'todo bien');
ws.close(); ch.kill(); srv.close();
process.exit(fallas ? 1 : 0);
