// La voz de cada murguista en la página, en Chrome sin ventana: los pasos (la pieza se ve enseguida, sin cantar; las
// voces, con el botón «Cantar las voces»), las caras (con la regla COEP que bloqueaba las de
// DiceBear), toda la murga con una voz (MBROLA, muestras de coro, formantes, un banco) y cuánto suena cada una, y cuánto
// tarda en volver a cantar cuando se cambia un solo murguista (su volumen, su voz).
//   node herramientas/probar_voces.mjs [--sin-coep] [--voces es2,muestras,formantes,banco:MIKE]
// Sirve la carpeta con herramientas/servir.js (los bancos de bancos/*.zip, si están). Sale con 1 si algo falla.
// Lo que mide sirve para NIVEL_MOTOR (motor/app.js): cuánto más fuerte o más bajo sale cada motor que MBROLA.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RAIZ } from './corpus.js';

const args = process.argv.slice(2);
const COEP = !args.includes('--sin-coep');
const iV = args.indexOf('--voces');
const VOCES = (iV >= 0 ? args[iV + 1] : 'es2,muestras,formantes,banco:MIKE').split(',');
const esperar = ms => new Promise(r => setTimeout(r, ms));
let mal = 0;
const ok = (c, t) => { console.log(`${c ? 'bien' : 'MAL '}  ${t}`); if (!c) mal++; };

function chrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const pw = join(process.env.LOCALAPPDATA || join(process.env.HOME || '', '.cache'), 'ms-playwright');
  const dir = existsSync(pw) && readdirSync(pw).filter(d => d.startsWith('chromium_headless_shell')).sort().pop();
  const exe = dir && ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-headless-shell-linux64/chrome-headless-shell'].map(p => join(pw, dir, p)).find(existsSync);
  if (!exe) { console.error('No encontré Chrome: poné su ruta en la variable CHROME.'); process.exit(2); }
  return exe;
}

const PW = 8200 + Math.floor(Math.random() * 300);
const srv = spawn(process.execPath, [join(RAIZ, 'herramientas', 'servir.js'), String(PW)], { cwd: RAIZ, stdio: 'ignore' });
await esperar(800);
const PUERTO = 9300 + Math.floor(Math.random() * 500);
const perfil = join(process.env.MURGA_PERFIL || tmpdir(), `murga_voces_${Date.now()}`);
const ch = spawn(chrome(), [`--remote-debugging-port=${PUERTO}`, '--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--window-size=1400,1000', `--user-data-dir=${perfil}`, 'about:blank'], { stdio: 'ignore' });
const fin = code => { try { ws.close(); } catch { } ch.kill(); srv.kill(); process.exit(code); };
let lista = null;
for (let i = 0; i < 40 && !lista; i++) { await esperar(250); try { lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json(); } catch { } }
const ws = new WebSocket(lista.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; const errores = [];
const env = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = async e => {
  const m = JSON.parse(e.data);
  if (m.id && pend[m.id]) { pend[m.id](m.result ?? { error: m.error }); delete pend[m.id]; }
  if (m.method === 'Runtime.exceptionThrown') errores.push('EXC ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300));
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) errores.push(m.params.type + ' ' + m.params.args.map(a => a.value || a.description).join(' ').slice(0, 300));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errores.push('log ' + (m.params.entry.text + ' ' + (m.params.entry.url || '')).slice(0, 300));
  // la página con la regla «sólo lo del mismo sitio» (COEP), como la que le ponía al Chrome del dueño otro proyecto
  if (m.method === 'Fetch.requestPaused') {
    const p = m.params, cuerpo = await env('Fetch.getResponseBody', { requestId: p.requestId });
    const headers = (p.responseHeaders || []).filter(h => !/^cross-origin-/i.test(h.name)).concat([{ name: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }, { name: 'Cross-Origin-Opener-Policy', value: 'same-origin' }]);
    env('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: p.responseStatusCode || 200, responseHeaders: headers, body: cuerpo.body });
  }
};
const leer = async x => { const r = await env('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };
await env('Runtime.enable'); await env('Page.enable'); await env('Log.enable');
// (a la página y a los .js: un obrero de una página con COEP no arranca si su script no la trae; el service worker de
// coi-serviceworker se la pone a todo)
if (COEP) await env('Fetch.enable', { patterns: [{ urlPattern: '*index.html*', requestStage: 'Response' }, { urlPattern: `http://127.0.0.1:${PW}/*.js`, requestStage: 'Response' }] });
// arranca con los trece en MBROLA es2 (la primera vuelta, rápida)
const CLAVES = ['bajos0', 'bajos1', 'segundos0', 'segundos1', 'segundos2', 'primos0', 'primos1', 'primos2', 'primos3', 'primos4', 'sobreprimos0', 'sobreprimos1', 'tercia0'];
await env('Page.addScriptToEvaluateOnNewDocument', { source: `try{if(!sessionStorage.getItem('probar_voces')){sessionStorage.setItem('probar_voces','1');localStorage.setItem('murga.cantantes',${JSON.stringify(JSON.stringify(Object.fromEntries(CLAVES.map(k => [k, { voz: 'es2' }]))))})}}catch(e){}` });
await env('Page.navigate', { url: `http://127.0.0.1:${PW}/index.html?nueva&voces=difonos` });

const hasta = async (js, ms) => { const t = Date.now(); while (Date.now() - t < ms) { let v = null; try { v = await leer(js); } catch { } if (v) return v; await esperar(400); } return null; };
const LISTO = `(()=>{const S=window.murga?.S;return !!(S&&S.stems&&!S.cantando&&!document.getElementById('play').disabled)})()`;
const CANTADAS = `(()=>{const S=window.murga?.S;return !!(S&&S.vozHecha&&!S.cantando)})()`;
// espera a que la página empiece a cantar otra vez (S.gen cambia) y a que termine; devuelve los segundos
async function cantaDeNuevo(accion, ms = 900000) {
  // (cambia S.gen cuando se arma la pieza o se corta lo que cantaba; S.cantos, cada vez que termina de cantar)
  const g = await leer(`(window.murga?.S?.gen ?? -1)+'|'+(window.murga?.S?.cantos ?? 0)`), t0 = Date.now();
  await leer(accion);
  if (!await hasta(`(window.murga?.S?.gen ?? -1)+'|'+(window.murga?.S?.cantos ?? 0) !== ${JSON.stringify(g)}`, ms)) return null;
  if (!await hasta(LISTO, ms)) return null;
  return (Date.now() - t0) / 1000;
}
const CANTAR = `document.getElementById('cantarVoces').click()`;
// la energía de lo que cantaron (todas las cuerdas, sin la normalización de la página)
// (cada uno con su voz: las voces están por sección, en S.clips, sin normalizar)
const ENERGIA = `(()=>{const S=window.murga.S;let e=0;for(const clip of S.clips.values())for(const k in clip.cuerdas){const b=clip.cuerdas[k].b;for(let c=0;c<b.numberOfChannels;c++){const x=b.getChannelData(c);for(let i=0;i<x.length;i++)e+=x[i]*x[i]}}return e})()`;

console.log(`página en http://127.0.0.1:${PW}/ ${COEP ? 'con la regla COEP (como el Chrome del dueño)' : 'sin COEP'}`);
const tEntra = Date.now();
if (!await hasta(LISTO, 120000)) { console.log('la página no se armó'); for (const e of errores.slice(0, 10)) console.log('  ' + e); fin(1); }
// al entrar: la música, la letra y la partitura enseguida, y las voces sin cantar
const entrada = await leer(`(()=>{const S=window.murga.S;return {voces:!!S.vozHecha,notas:document.querySelectorAll('#multipista *').length,versos:S.letra.partes.reduce((a,p)=>a+p.versos.length,0),pasos:[...document.querySelectorAll('.etapa')].map(p=>p.className.replace('etapa ','')+': '+p.innerText.replace(/\s+/g,' ').trim()).join(' | ')}})()`);
ok(!entrada.voces && entrada.versos > 0 && entrada.notas > 50, `al entrar, en ${((Date.now() - tEntra) / 1000).toFixed(1)} s: ${entrada.versos} versos, el multipista armado, voces sin cantar`);
console.log('  pasos: ' + entrada.pasos);
console.log('aislada (COEP activa):', await leer('self.crossOriginIsolated'));
// una pieza corta: así cada vuelta tarda menos
const tCorta = await cantaDeNuevo(`(()=>{const s=document.getElementById('largo');s.value='corta';s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
console.log(`pieza corta, armada en ${tCorta} s (sin cantar)`);
// una sección sola: la segunda que tiene voces
const sec = await leer(`(()=>{const S=window.murga.S,s=S.pieza.secs.filter(x=>x.tipo!=='llamada')[1];document.querySelector('[data-panel=cantantes]');return s.nombre})()`);
await leer(`(()=>{const b=[...document.querySelectorAll('.mt-sec')].find(e=>e.textContent.trim()===${JSON.stringify(sec)});b&&b.click()})()`);
const ts = Date.now(); await leer(`document.getElementById('secCantar').click()`);
const unaSec = await hasta(`(()=>{const S=window.murga.S;return !S.cantando&&S.clips.size?[...S.clips.keys()]:null})()`, 600000);
ok(unaSec && unaSec.length === 1 && unaSec[0] === sec, `«Cantar esta sección» («${sec}»): ${((Date.now() - ts) / 1000).toFixed(1)} s, cantadas: ${JSON.stringify(unaSec)} — ${await leer(`document.getElementById('pasoVocesTxt').textContent`)}`);
const t0 = Date.now(); await leer(CANTAR);
const canto = await hasta(CANTADAS, 900000);
ok(!!canto, `«Cantar las voces» (los trece con es2): ${((Date.now() - t0) / 1000).toFixed(1)} s — ${await leer(`document.getElementById('pasoVocesTxt').textContent`)}`);

// las caras: las de DiceBear tienen que verse (o las iniciales si no hay internet), y ningún error de COEP. Se
// cargan cuando se ven (loading=lazy): se abre el panel «Cantantes»
await leer(`document.querySelector('[data-panel=cantantes]').click()`);
await hasta(`[...document.querySelectorAll('#listaCantantes .tarjeta img')].every(i=>i.complete)`, 20000);
const caras = await leer(`(()=>{const im=[...document.querySelectorAll('#listaCantantes .tarjeta img')];return {n:im.length,dicebear:im.filter(i=>/dicebear/.test(i.src)&&i.naturalWidth>0).length,iniciales:im.filter(i=>i.src.startsWith('data:')).length}})()`);
ok(caras.n === 13 && caras.dicebear === 13, `las caras: ${caras.dicebear} de ${caras.n} de DiceBear (${caras.iniciales} con iniciales)`);
const coep = errores.filter(e => /COEP|BLOCKED_BY_RESPONSE/i.test(e));
ok(!coep.length, `errores de COEP: ${coep.length}${coep.length ? ' — ' + coep[0] : ''}`);

// los botones de voces están en «Cantantes»
ok(await leer(`!!document.querySelector('#cantantes #voces') && !document.querySelector('#pPieza #voces')`), 'los botones de voces están en «Cantantes»');
const opciones = await leer(`[...document.getElementById('vozTodos').options].map(o=>o.value)`);
ok(opciones.includes('muestras') && opciones.includes('formantes') && opciones.includes('es2'), `«Toda la murga con»: ${opciones.length} voces (${opciones.slice(0, 6).join(', ')}…)`);

// toda la murga con cada voz: cuánto tarda y cuánto suena
const E = {};
for (const v of VOCES) {
  const hay = await leer(`[...document.getElementById('vozTodos').options].some(o=>o.value===${JSON.stringify(v)}&&!o.disabled)`);
  if (!hay) { console.log(`${v}: no está`); continue; }
  const t = await cantaDeNuevo(`(()=>{const s=document.getElementById('vozTodos');s.value=${JSON.stringify(v)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  const tarjeta = await leer(`document.querySelector('#listaCantantes .tarjeta small')?.textContent`);
  E[v] = await leer(ENERGIA);
  ok(t != null && E[v] > 0, `toda la murga con ${v}: cantó en ${t} s, energía ${E[v].toExponential(3)} (tarjeta: ${tarjeta})`);
}
if (E.es2) for (const v of Object.keys(E)) if (v !== 'es2') console.log(`  ${v} contra es2: ${(10 * Math.log10(E[v] / E.es2)).toFixed(1)} dB  (para igualarlo: × ${Math.sqrt(E.es2 / E[v]).toFixed(3)})`);

// un solo murguista: su volumen y después su voz (con la última voz de toda la murga)
await leer(`[...document.querySelectorAll('#listaCantantes .tarjeta')].find(x=>/Primo 2/.test(x.innerText))?.click()`);
await esperar(500);
const tVol = await cantaDeNuevo(`(()=>{const r=[...document.querySelectorAll('#icParams input[type=range]')].find(r=>/volumen/i.test(r.title));r.value=-4;r.dispatchEvent(new Event('change',{bubbles:true}))})()`);
console.log(`el volumen de un murguista: volvió a sonar en ${tVol} s (incluye 0,4 s de espera) — ${await leer(`document.getElementById('status').textContent`)}`);
const tVoz = await cantaDeNuevo(`(()=>{const s=document.querySelector('#icParams select');s.value='es1';s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
console.log(`la voz de un murguista (a es1): volvió a sonar en ${tVoz} s`);
ok(tVol != null && tVoz != null, 'cambiar un murguista vuelve a cantar');
const vista = await leer(`(()=>{const s=document.querySelector('#icParams select');return {voz:s?.value,params:[...document.querySelectorAll('#icParams .param span')].map(x=>x.textContent).join(', ')}})()`);
console.log(`el inspector: ${JSON.stringify(vista)}`);
// un murguista con muestras: sólo afinación, volumen y paneo
await leer(`(()=>{const s=document.querySelector('#icParams select');s.value='muestras';s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
await esperar(300);
const pm = await leer(`[...document.querySelectorAll('#icParams .param span')].map(x=>x.textContent).join(', ')`);
ok(/Afinación/.test(pm) && !/Vibrato/.test(pm), `el inspector con muestras: ${pm}`);
await hasta(LISTO, 300000);

const otros = errores.filter(e => !/COEP|BLOCKED_BY_RESPONSE/i.test(e));
for (const e of otros.slice(0, 12)) console.log('  ' + e);
ok(!otros.some(e => /^EXC/.test(e)), `excepciones: ${otros.filter(e => /^EXC/.test(e)).length}`);
console.log(mal ? `${mal} cosas mal` : 'todo bien');
fin(mal ? 1 : 0);
