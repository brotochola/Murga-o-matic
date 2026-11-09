// estudio.js — la página del estudio de voces (estudio.html, docs/plan_cantantes.md). Todo en el navegador: los bancos
// de UTAU se leen de su carpeta (bancos.js), los cantores cantan en obreros (cantor/obrero.js) con el mismo motor que
// la página, y el plantel (las voces con sus valores), la murga (quién canta en cada lugar) y las opciones quedan en
// IndexedDB.
import { guardarBanco, listarBancos, borrarBanco, guardarDato, leerDato, hayLlaves, elegirCarpeta, permiso } from './cantor/bancos.js';
import { LUGARES, CENTRO, prepararMurga, repartir, mezclarMurga, wavEstereo, valoresDe } from './cantor/murga_bancos.js';
import { cantorDifonos } from './cantor/difonos.js';
import { silabasCantadas, partes } from './cantor/letra.js';
import { renderBateria } from './cantor/bateria.js';
import { DATOS } from './cantor/datos.js';
import { leerWav, nombreNota } from './cantor/banco.js';

const $ = id => document.getElementById(id);
const SR = 44100;
if (location.protocol === 'file:') $('sinServidor').hidden = false;
if (!hayLlaves()) $('sinLlaves').hidden = false;

// ── los valores de cada voz: [clave, nombre, mín, máx, paso, para qué voces, qué es] ──
const VALORES = [
  ['tracto', 'Garganta', .85, 1.15, .01, 'todas', 'más de 1: los formantes más arriba (una garganta más chica)'],
  ['transporte', 'Afinación', -.5, .5, .01, 'todas', 'semitonos de más o de menos'],
  ['vibrato', 'Vibrato', 0, .5, .01, 'todas', 'semitonos'],
  ['vibVel', 'Velocidad del vibrato', 4, 7.5, .1, 'todas', 'Hz'],
  ['grito', 'Grito', 0, 1.5, .05, 'todas', 'la boca más abierta, la voz apretada y pareja'],
  ['tension', 'Tensión', -1, 1, .05, 'banco', 'la voz apretada: menos fundamental, más agudos'],
  ['ronquera', 'Ronquera', 0, 1, .05, 'banco', 'la voz rajada: tiembla rápido y con un subarmónico'],
  ['aire', 'Aire', 0, 1, .05, 'banco', 'voz soplada'],
  ['esfuerzo', 'Esfuerzo', -5, 7, 1, 'banco', 'semitonos: canta con la grabación de una nota más aguda (más esforzada)'],
  ['consonantes', 'Dicción', .7, 1.6, .01, 'todas', 'las consonantes más largas (más de 1) o más cortas'],
  ['golpe', 'Golpe', 0, 10, .5, 'todas', 'dB de más al entrar las sílabas acentuadas'],
  ['pique', 'Pique', 0, 1.5, .05, 'todas', 'cuánto entra de abajo la nota, en semitonos'],
  ['caida', 'Caída', 0, 2.5, .05, 'todas', 'cuánto cae al final de la frase, en semitonos'],
  ['modulacion', 'Temblor de la grabación', 0, 1.5, .05, 'banco', 'cuánto del temblor de altura de la grabación queda'],
];
// enojados y gritando: grito fuerte, la voz apretada y un poco rajada, la grabación más aguda (bancos), entradas con
// golpe y de abajo, casi sin vibrato y cayendo al final
const ENOJO = { grito: 1.1, tension: .6, ronquera: .4, aire: .05, esfuerzo: 3, consonantes: 1.15, golpe: 7, pique: .9, caida: 1.2, vibrato: .06 };
const SUBE = { bajos: -8, segundos: -5, primos: 0, sobreprimos: 3, agudo: 6 };
const fmt = (k, v) => k === 'esfuerzo' ? (v > 0 ? '+' : '') + v + ' st' : k === 'tracto' ? (v < 1 ? '' : '+') + Math.round((v - 1) * 100) + ' %' : k === 'golpe' ? v + ' dB' : k === 'vibVel' ? (+v).toFixed(1) + ' Hz' : (+v).toFixed(2);

// ── el estado (lo que se guarda) ──
const S = {
  bancos: [],        // [{ id, nombre, handle?, archivos?, datos, listo, sesion }]
  plantel: [],       // [{ nombre, banco | mbrola, capa?, evitar?, ...valores }]
  murga: {},         // { bajos0: nombre de una voz, ... }
  opciones: { frase: 'Llegó el carnaval con su bombo y platillo', cuerda: 'primos', auto: true, forma: 'retirada', estilo: 'trasnochada', semilla: 56, hasta: 60 },
};
let alAbrir = null;  // el plantel como estaba al abrir la página
const VOCES_MBROLA = [{ nombre: 'MBROLA es2', mbrola: 'es2' }, { nombre: 'MBROLA es1', mbrola: 'es1' }];
let guardarTm = null;
function guardar() {
  clearTimeout(guardarTm);
  guardarTm = setTimeout(() => {
    Promise.all([guardarDato('plantel', S.plantel), guardarDato('murga', S.murga), guardarDato('opciones', S.opciones)])
      .catch(e => { $('estadoVoces').textContent = 'No se pudo guardar en el navegador: ' + e.message; });
  }, 400);
}

// ── los obreros ──
const N = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
let pedidos = 0;
const obreros = Array.from({ length: N }, () => {
  const w = new Worker(new URL('./cantor/obrero.js', import.meta.url), { type: 'module' });
  w.pend = new Map(); w.bancos = new Map(); w.carga = 0;
  w.onmessage = ({ data }) => { const p = w.pend.get(data.id); if (!p) return; w.pend.delete(data.id); w.carga--; if (data.error) p.mal(new Error(data.error)); else p.ok(data); };
  w.onerror = e => { for (const p of w.pend.values()) p.mal(new Error(e.message || 'el obrero se cayó')); w.pend.clear(); w.carga = 0; };
  return w;
});
const pedir = (w, msg) => new Promise((ok, mal) => { const id = ++pedidos; w.carga++; w.pend.set(id, { ok, mal }); w.postMessage({ ...msg, id }); });
const fuenteDe = b => (b.url ? { url: b.url } : b.zip ? { zip: b.zip } : b.handle ? { handle: b.handle } : { archivos: b.archivos });
function presentar(w, b) {
  if (!w.bancos.has(b.id)) { const p = pedir(w, { tipo: 'banco', banco: b.id, fuente: fuenteDe(b) }); w.bancos.set(b.id, p); p.catch(() => w.bancos.delete(b.id)); }
  return w.bancos.get(b.id);
}
// canta en el obrero con menos trabajo (si es de banco, primero se lo presenta)
async function cantarEnObrero(motor, notas, opc) {
  const w = obreros.reduce((a, b) => (b.carga < a.carga ? b : a));
  if (motor === 'banco') {
    const b = S.bancos.find(x => x.id === opc.banco);
    if (!b || !b.listo) throw new Error(`el banco «${opc.banco}» no está (o falta su permiso)`);
    await presentar(w, b);
  }
  return pedir(w, { motor, notas, opc });
}

// ── los bancos ──
const idDe = nombre => { let id = nombre || 'banco', k = 2; while (S.bancos.some(b => b.id === id)) id = `${nombre} (${k++})`; return id; };
async function abrirBanco(b) {
  // el primer obrero lo lee y dice qué es (hasta entonces no está listo: se dibuja «leyendo…»)
  b.cargando = true; dibujarBancos();
  try { const r = await presentar(obreros[0], b); b.datos = r.datos; b.listo = true; b.error = null; }
  catch (e) { b.listo = false; b.error = e.message; }
  b.cargando = false;
  dibujarBancos(); dibujarVoces(); dibujarLugares();
}
async function agregarCarpeta(fuente, nombreCarpeta, sesion) {
  const b = { id: idDe(nombreCarpeta), nombre: nombreCarpeta, agregado: Date.now(), sesion, ...fuente };
  S.bancos.push(b);
  $('estadoBancos').textContent = `Leyendo «${nombreCarpeta}»…`;
  await abrirBanco(b);
  if (!b.listo) { $('estadoBancos').textContent = `No pude leer «${nombreCarpeta}»: ${b.error}`; return; }
  if (!sesion && !b.url) await guardarBanco({ id: b.id, nombre: b.nombre, handle: b.handle || b.zip, esZip: !!b.zip, agregado: b.agregado, datos: b.datos });
  // una voz por banco, y una más por cada color suelto (MIKE grave, MIKE suave)
  const base = b.datos.nombre || b.nombre;
  const nuevas = [{ nombre: base, banco: b.id }, ...b.datos.sueltos.map(s => ({ nombre: `${base} ${s}`, banco: b.id, capa: s }))];
  for (const v of nuevas) if (!S.plantel.some(x => x.nombre === v.nombre)) S.plantel.push(v);
  $('estadoBancos').textContent = `«${base}»: ${b.datos.entradas} entradas, ${b.datos.reclist}. ${nuevas.length > 1 ? `Suma ${nuevas.length} voces.` : 'Suma una voz.'}`;
  guardar(); dibujarBancos(); dibujarVoces(); dibujarLugares();
}
// un .zip suelto (el banco tal como lo baja su autor): por esta sesión (Chrome y Edge lo recuerdan)
$('agregarZip').onclick = async () => {
  try {
    let zip, nombre;
    if (typeof showOpenFilePicker === 'function') { const [h] = await showOpenFilePicker({ id: 'banco-utau', types: [{ description: 'Banco de UTAU (.zip)', accept: { 'application/zip': ['.zip', '.uar'] } }] }); zip = h; nombre = h.name; }
    else { const f = await new Promise(ok => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.zip,.uar'; i.onchange = () => ok(i.files[0]); i.click(); }); if (!f) return; zip = f; nombre = f.name; }
    await agregarCarpeta({ zip }, nombre.replace(/\.(zip|uar)$/i, ''), !zip.getFile);
  } catch (e) { if (e.name !== 'AbortError') $('estadoBancos').textContent = 'No se pudo: ' + e.message; }
};
$('agregarBanco').onclick = async () => {
  if (!hayLlaves()) { $('carpetaSesion').click(); return; }
  try { const h = await elegirCarpeta(); await agregarCarpeta({ handle: h }, h.name, false); }
  catch (e) { if (e.name !== 'AbortError') $('estadoBancos').textContent = 'No se pudo: ' + e.message; }
};
$('carpetaSesion').onchange = async e => {
  const fs = [...e.target.files]; if (!fs.length) return;
  const archivos = fs.map(f => ({ ruta: f.webkitRelativePath || f.name, file: f }));
  await agregarCarpeta({ archivos }, archivos[0].ruta.split('/')[0], true);
  e.target.value = '';
};
$('permisos').onclick = async () => {
  for (const b of S.bancos.filter(x => x.handle && !x.listo)) {
    try { if (await permiso(b.handle, true)) await abrirBanco(b); } catch (e) { b.error = e.message; }
  }
  dibujarBancos();
};
function rango(b) {
  const ms = (b.datos?.capas || []).map(c => c.midi).filter(Number.isFinite);
  return ms.length ? [Math.min(...ms), Math.max(...ms)] : null;
}
function dibujarBancos() {
  const caja = $('bancos'); caja.innerHTML = '';
  for (const b of S.bancos) {
    const d = document.createElement('div'); d.className = 'banco';
    const r = rango(b), dt = b.datos;
    const q = document.createElement('div'); q.className = 'que';
    q.innerHTML = '<b></b><small></small>';
    q.querySelector('b').textContent = dt?.nombre || b.nombre;
    q.querySelector('small').textContent = b.cargando ? 'leyendo…' : !b.listo || !dt ? (b.error ? 'no se pudo leer: ' + b.error : 'falta el permiso para leerlo')
      : `${dt.reclist}, ${dt.entradas} entradas${r ? `, grabado de ${nombreNota(r[0])} a ${nombreNota(r[1])}` : ''}${dt.sueltos.length ? `, colores ${dt.sueltos.join(' ')}` : ''}${b.deLaCarpeta ? ' · de la carpeta bancos/' : b.sesion ? ' · sólo por esta sesión' : ''}${dt.sinArchivo ? ` · ${dt.sinArchivo} entradas sin su .wav` : ''}`;
    d.append(q);
    if (b.handle && !b.listo) { const p = document.createElement('button'); p.textContent = 'Dar permiso'; p.onclick = async () => { if (await permiso(b.handle, true)) await abrirBanco(b); }; d.append(p); }
    const x = document.createElement('button'); x.textContent = 'Quitar'; x.title = 'Lo saca del estudio (no toca la carpeta)';
    x.onclick = async () => { S.bancos = S.bancos.filter(y => y !== b); if (!b.sesion) await borrarBanco(b.id); dibujarBancos(); dibujarVoces(); dibujarLugares(); };
    d.append(x); caja.append(d);
  }
  $('permisos').hidden = !S.bancos.some(b => b.handle && !b.listo);
  if (!S.bancos.length) caja.innerHTML = '<p class="estado">Todavía no hay bancos: agregá la carpeta de uno.</p>';
}

// ── la frase de prueba: la melodía simple de herramientas/solista.mjs ──
const grado = i => [55, 57, 59, 60, 62, 64, 66][((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
function frase(texto, sube) {
  const sils = silabasCantadas(texto), corchea = 30 / 100, ult = sils.map(s => s.acento).lastIndexOf(true);
  let t = .35;
  return sils.map((s, i) => {
    const p = i / Math.max(1, sils.length - 1);
    let g = Math.round(1 + 4 * Math.sin(Math.PI * Math.min(1, p * 1.15)) + (i % 3 === 2 ? 1 : 0));
    if (i >= ult) g = i === ult ? 1 : 0;
    let d = corchea;
    if (i === ult) d = sils.length - 1 > i ? corchea * 3 : corchea * 5; else if (i > ult) d = corchea * 3; else if (s.acento && i % 2 === 1) d = corchea * 1.5;
    const n = { t0: t, t1: t + d, midi: grado(Math.max(0, Math.min(7, g))) + sube, vel: s.acento ? .85 : .75, sil: { ...partes(s.fon), fin: s.fin, articulo: s.articulo, acento: s.acento } };
    t += d; return n;
  });
}

// ── las voces ──
const motorDe = v => (v.mbrola ? 'mbrola' : 'banco');
const bancoDe = v => S.bancos.find(b => b.id === v.banco);
// lo de base de un cantor de la cuerda elegida (como en la murga), para mostrar en cada deslizador
function base(v) {
  const c = S.opciones.cuerda === 'agudo' ? 'sobreprimos' : S.opciones.cuerda;
  const b = cantorDifonos(c, 3, { c: 0 });
  return v.mbrola ? { ...b, tracto: 1 } : { ...b, grito: 0, tracto: 1, modulacion: 1 };
}
const valor = (v, k) => v[k] ?? base(v)[k] ?? 0;
function infoVoz(v) {
  if (v.mbrola) return 'difonos de MBROLA';
  const b = bancoDe(v);
  if (!b) return `falta el banco «${v.banco}»`;
  if (!b.listo) return `${b.nombre}: falta el permiso para leer su carpeta`;
  const r = rango(b);
  return `${b.datos.nombre || b.nombre} · ${b.datos.reclist}${r ? ` · grabado de ${nombreNota(r[0])} a ${nombreNota(r[1])}` : ''}${v.capa ? ` · color ${v.capa}` : ''}${v.evitar ? ` · sin ${v.evitar.join(', ')}` : ''}`;
}
function dibujarVoces() {
  const caja = $('voces'); caja.innerHTML = '';
  S.plantel.forEach((v, i) => {
    const d = document.createElement('section'); d.className = 'voz'; d.id = 'voz' + i;
    d.innerHTML = '<div class="cabeza"><input aria-label="Nombre de la voz"><button class="quitar" title="Sacarla del plantel">Quitar</button></div><p class="info"></p><div class="params"></div><div class="acciones"><button class="fuerte cantar">Cantar</button><button class="volver">Volver a como estaba</button><span class="estado"></span></div><audio controls preload="none"></audio>';
    const nom = d.querySelector('.cabeza input'); nom.value = v.nombre;
    nom.onchange = () => { const viejo = v.nombre, nuevo = nom.value.trim() || viejo; if (S.plantel.some(x => x !== v && x.nombre === nuevo)) { nom.value = viejo; return; } v.nombre = nuevo; for (const k in S.murga) if (S.murga[k] === viejo) S.murga[k] = nuevo; guardar(); dibujarLugares(); };
    d.querySelector('.info').textContent = infoVoz(v);
    const ps = d.querySelector('.params');
    for (const [k, nombre, mn, mx, paso, para, ayuda] of VALORES) {
      if (para !== 'todas' && para !== motorDe(v)) continue;
      const l = document.createElement('label'); l.className = 'param'; l.title = ayuda;
      l.innerHTML = '<span></span><input type="range"><output></output>';
      l.querySelector('span').textContent = nombre;
      const r = l.querySelector('input'); r.min = mn; r.max = mx; r.step = paso; r.value = valor(v, k); r.dataset.k = k; r.setAttribute('aria-label', `${nombre}: ${ayuda}`);
      const o = l.querySelector('output'); o.textContent = fmt(k, +r.value);
      r.oninput = () => { o.textContent = fmt(k, +r.value); };
      r.onchange = () => { v[k] = +r.value; marcar(i); guardar(); if (S.opciones.auto) cantarVoz(i); };
      ps.append(l);
    }
    d.querySelector('.cantar').onclick = () => cantarVoz(i);
    d.querySelector('.volver').onclick = () => { const antes = alAbrir.find(x => x.nombre === v.nombre); for (const [k] of VALORES) { if (antes && antes[k] != null) v[k] = antes[k]; else delete v[k]; } refrescar(i); guardar(); cantarVoz(i); };
    d.querySelector('.quitar').onclick = () => { S.plantel.splice(i, 1); guardar(); dibujarVoces(); dibujarLugares(); };
    caja.append(d); marcar(i);
  });
}
function refrescar(i) {
  const d = $('voz' + i), v = S.plantel[i]; if (!d) return;
  for (const r of d.querySelectorAll('input[type=range]')) { r.value = valor(v, r.dataset.k); r.closest('label').querySelector('output').textContent = fmt(r.dataset.k, +r.value); }
  marcar(i);
}
function marcar(i) {
  const d = $('voz' + i), v = S.plantel[i]; if (!d) return;
  const antes = alAbrir?.find(x => x.nombre === v.nombre);
  d.classList.toggle('cambiada', JSON.stringify(valoresDe(v)) !== JSON.stringify(valoresDe(antes)));
  for (const r of d.querySelectorAll('input[type=range]')) r.closest('label').classList.toggle('tocado', v[r.dataset.k] != null);
}
function wavMono(x, sr) {
  let pk = 1e-9; for (const v of x) pk = Math.max(pk, Math.abs(v));
  const g = .89 / pk, n = x.length, b = new ArrayBuffer(44 + n * 2), dv = new DataView(b);
  const tx = (p, s) => { for (let k = 0; k < s.length; k++) dv.setUint8(p + k, s.charCodeAt(k)); };
  tx(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); tx(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  sr = Math.round(sr); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); tx(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let k = 0; k < n; k++) dv.setInt16(44 + k * 2, Math.max(-32767, Math.min(32767, Math.round(x[k] * g * 32767))), true);
  return new Blob([b], { type: 'audio/wav' });
}
async function cantarVoz(i) {
  const v = S.plantel[i], d = $('voz' + i); if (!d) return;
  const est = d.querySelector('.estado'), a = d.querySelector('audio');
  est.textContent = 'cantando…'; const t = performance.now();
  try {
    const cuerda = S.opciones.cuerda === 'agudo' ? 'sobreprimos' : S.opciones.cuerda;
    const notas = frase(S.opciones.frase, SUBE[S.opciones.cuerda] ?? 0);
    const b = cantorDifonos(cuerda, 3, { c: 0 }), val = valoresDe(v);
    let r;
    if (v.mbrola) r = await cantarEnObrero('difonos', notas, { ...b, ...val, tracto: b.tracto * (val.tracto ?? 1), voz: v.mbrola, w: v.mbrola !== 'es4', retraso: 0 });
    else { const { tracto, color, inclinacion, grito, retraso, desfase, ...bb } = b; r = await cantarEnObrero('banco', notas, { ...bb, grito: 0, ...val, semilla: 3, banco: v.banco, capa: v.capa, evitar: v.evitar }); }
    if (a.src) URL.revokeObjectURL(a.src);
    a.src = URL.createObjectURL(wavMono(r.x, r.sr));
    est.textContent = `en ${((performance.now() - t) / 1000).toFixed(1)} s${r.faltan?.length ? ` · le faltan ${r.faltan.slice(0, 4).join(', ')}` : ''}`;
    await a.play().catch(() => {});
  } catch (e) { est.textContent = 'no pudo: ' + e.message; }
}
$('enojados').onclick = () => {
  S.plantel.forEach((v, i) => { for (const [k, , , , , para] of VALORES) if (ENOJO[k] != null && (para === 'todas' || para === motorDe(v))) v[k] = v.mbrola && k === 'grito' ? 1.3 : ENOJO[k]; refrescar(i); });
  guardar(); $('estadoVoces').textContent = 'Todos enojados y gritando. «Cantar todas» para escucharlos.';
};
$('comoEstaban').onclick = () => { S.plantel = JSON.parse(JSON.stringify(alAbrir)); guardar(); dibujarVoces(); dibujarLugares(); $('estadoVoces').textContent = 'Como estaban al abrir el estudio.'; };
$('todas').onclick = async () => {
  $('estadoVoces').textContent = `Cantando ${S.plantel.length} voces…`;
  await Promise.all(S.plantel.map((_, i) => cantarVoz(i)));
  $('estadoVoces').textContent = 'Cantaron todas.';
};
for (const id of ['frase', 'cuerda', 'auto']) $(id).onchange = () => { S.opciones[id] = id === 'auto' ? $(id).checked : $(id).value; guardar(); if (id === 'cuerda') S.plantel.forEach((_, i) => refrescar(i)); };
$('exportar').onclick = () => {
  const b = new Blob([JSON.stringify({ plantel: S.plantel, murga: S.murga }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'plantel.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
};
$('importar').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text()), lista = Array.isArray(j) ? j : j.plantel;
    if (!Array.isArray(lista) || !lista.every(v => v && typeof v.nombre === 'string')) throw new Error('no es un plantel (una lista de voces con nombre)');
    // un plantel de Node dice la carpeta del banco: se busca un banco cargado con esa carpeta
    const base = s => String(s).split(/[\\/]/).filter(Boolean).pop();
    for (const v of lista) if (v.carpeta && !v.banco) { const b = S.bancos.find(x => x.datos && (x.datos.carpeta === base(v.carpeta) || x.nombre === base(v.carpeta))); if (b) v.banco = b.id; delete v.carpeta; }
    S.plantel = lista; if (j.murga) S.murga = j.murga;
    const faltan = lista.filter(v => !v.mbrola && !bancoDe(v)).map(v => v.nombre);
    $('estadoVoces').textContent = `Plantel de ${lista.length} voces.${faltan.length ? ` Sin su banco: ${faltan.join(', ')}.` : ''}`;
    guardar(); dibujarVoces(); dibujarLugares();
  } catch (er) { $('estadoVoces').textContent = 'No se pudo importar: ' + er.message; }
  e.target.value = '';
};

// ── la murga: los trece lugares ──
const NOMBRE = { bajos: 'Bajo', segundos: 'Segundo', primos: 'Primo', sobreprimos: 'Sobreprimo', tercia: 'Tercia' };
function dibujarLugares() {
  const caja = $('lugares'); caja.innerHTML = '';
  for (const l of LUGARES) {
    const d = document.createElement('label'); d.className = 'lugar';
    d.innerHTML = `<i style="background:var(--${l.cuerda})"></i><b>${NOMBRE[l.cuerda]}${l.cuerda === 'tercia' ? '' : ' ' + (l.n + 1)}</b><select></select>`;
    const s = d.querySelector('select'); s.setAttribute('aria-label', `Quién canta: ${NOMBRE[l.cuerda]} ${l.n + 1}`);
    for (const v of S.plantel) { const o = document.createElement('option'); o.value = o.textContent = v.nombre; if (S.murga[l.clave] === v.nombre) o.selected = true; s.append(o); }
    if (!S.plantel.some(v => v.nombre === S.murga[l.clave])) { s.selectedIndex = -1; }
    s.onchange = () => { S.murga[l.clave] = s.value; guardar(); };
    caja.append(d);
  }
}
// repartir solo: a cada lugar la voz grabada más cerca del registro de su cuerda, sin repetir en la misma cuerda si se
// puede (y MBROLA sólo si no hay bancos que le queden)
function repartirSolo() {
  const usadas = new Map(), enCuerda = new Map();
  for (const l of LUGARES) {
    let mejor = null, costo = Infinity;
    for (const v of S.plantel) {
      let c;
      if (v.mbrola) c = 6;
      else { const b = bancoDe(v); if (!b?.listo) continue; const r = rango(b); c = r ? Math.max(0, r[0] - CENTRO[l.cuerda], CENTRO[l.cuerda] - r[1]) : 3; }
      c += 4 * (enCuerda.get(l.cuerda + '|' + v.nombre) || 0) + 1.5 * (usadas.get(v.nombre) || 0);
      if (c < costo) { costo = c; mejor = v; }
    }
    if (!mejor) continue;
    S.murga[l.clave] = mejor.nombre;
    usadas.set(mejor.nombre, (usadas.get(mejor.nombre) || 0) + 1);
    enCuerda.set(l.cuerda + '|' + mejor.nombre, (enCuerda.get(l.cuerda + '|' + mejor.nombre) || 0) + 1);
  }
  guardar(); dibujarLugares();
}
$('repartir').onclick = repartirSolo;
for (const id of ['forma', 'estilo', 'semilla', 'hasta']) $(id).onchange = () => { S.opciones[id] = id === 'semilla' || id === 'hasta' ? +$(id).value : $(id).value; guardar(); };

let lame = null;
const cargarLame = () => (lame ??= new Promise((ok, mal) => { if (window.lamejs) return ok(); const s = document.createElement('script'); s.src = new URL('./vendor/lame.min.js', import.meta.url).href; s.onload = ok; s.onerror = () => { lame = null; mal(new Error('no se pudo cargar lamejs')); }; document.head.append(s); }));
async function aMp3(L, R) {
  await cargarLame();
  const enc = new window.lamejs.Mp3Encoder(2, SR, 192), B = 1152 * 32, partes = [];
  const a16 = x => { const y = new Int16Array(x.length); for (let k = 0; k < x.length; k++) y[k] = Math.max(-32767, Math.min(32767, Math.round(x[k] * 32767))); return y; };
  const l16 = a16(L), r16 = a16(R);
  for (let k = 0; k < l16.length; k += B) { const m = enc.encodeBuffer(l16.subarray(k, k + B), r16.subarray(k, k + B)); if (m.length) partes.push(new Uint8Array(m)); if ((k / B) % 20 === 19) await new Promise(r => setTimeout(r)); }
  const f = enc.flush(); if (f.length) partes.push(new Uint8Array(f));
  return new Blob(partes, { type: 'audio/mpeg' });
}
$('cantarMurga').onclick = async () => {
  const est = $('estadoMurga'), boton = $('cantarMurga'); boton.disabled = true;
  const t0 = performance.now(), seg = () => ((performance.now() - t0) / 1000).toFixed(0) + ' s';
  try {
    if (LUGARES.some(l => !S.plantel.some(v => v.nombre === S.murga[l.clave]))) repartirSolo();
    est.textContent = 'Componiendo y escribiendo la letra…';
    await new Promise(r => setTimeout(r, 30));
    const o = S.opciones;
    const M = prepararMurga({ forma: o.forma, estilo: o.estilo, semilla: o.semilla, tonica: 9, modo: 'mayor', largo: 'corta', hasta: o.hasta });
    const tareas = repartir(M.lista, S.plantel, S.murga);
    let hechos = 0;
    est.textContent = `Cantando: 0 de ${tareas.length} cantores…`;
    const cantados = await Promise.all(tareas.map(async t => {
      const r = await cantarEnObrero(t.motor, t.c.notas, t.opc);
      hechos++; est.textContent = `Cantando: ${hechos} de ${tareas.length} cantores (${seg()})…`;
      return { x: r.x, sr: r.sr, inicio: r.inicio, pan: t.c.pan, ganancia: t.c.ganancia };
    }));
    est.textContent = 'La batería y la mezcla…';
    const cargar = async a => { const b = new Uint8Array(await (await fetch(new URL('../' + a, import.meta.url))).arrayBuffer()); const w = leerWav(b); return { sr: w.sr, datos: w.x }; };
    const bat = await renderBateria(M.P, DATOS, cargar, SR, M.largo);
    const { L, R } = mezclarMurga(cantados, SR, M.largo, bat, M.corte);
    const wav = new Blob([wavEstereo(L, R, SR)], { type: 'audio/wav' });
    est.textContent = 'El mp3…';
    const mp3 = await aMp3(L, R);
    const nombre = `${o.forma}_${o.estilo}_${o.semilla}`;
    for (const [id, b, ext] of [['bajarMp3', mp3, 'mp3'], ['bajarWav', wav, 'wav']]) { const a = $(id); if (a.href) URL.revokeObjectURL(a.href); a.href = URL.createObjectURL(b); a.download = `${nombre}.${ext}`; }
    const au = $('murgaAudio'); if (au.src) URL.revokeObjectURL(au.src); au.src = URL.createObjectURL(mp3); au.hidden = false; $('bajar').hidden = false;
    $('murgaLetra').textContent = M.letra; $('murgaLetra').hidden = false;
    est.textContent = `Lista: ${M.corte.toFixed(0)} s cantados por ${tareas.length} cantores, en ${seg()}.`;
  } catch (e) { console.error(e); est.textContent = 'No salió: ' + e.message; }
  boton.disabled = false;
};

// para las pruebas (herramientas/probar_estudio.mjs) y para mirar desde la consola
window.estudio = { S, agregarCarpeta, cantarVoz, repartirSolo };

// ── al abrir: lo guardado ──
(async () => {
  try {
    const [plantel, murga, opciones, bancos] = await Promise.all([leerDato('plantel'), leerDato('murga'), leerDato('opciones'), listarBancos()]);
    if (opciones) Object.assign(S.opciones, opciones);
    // el plantel de siempre (bancos/plantel.json) y sus bancos de la carpeta bancos/, si están
    const base = await fetch(new URL('../bancos/plantel.json', import.meta.url)).then(r => r.json()).catch(() => null);
    S.plantel = plantel?.length ? plantel : base?.voces ? JSON.parse(JSON.stringify(base.voces)) : JSON.parse(JSON.stringify(VOCES_MBROLA));
    S.murga = murga || base?.murga || {};
    for (const bb of base?.bancos || []) {
      const url = new URL('../bancos/' + encodeURIComponent(bb.archivo), import.meta.url).href;
      const hay = await fetch(url, { headers: { Range: 'bytes=0-0' } }).then(r => { r.body?.cancel?.(); return r.ok; }).catch(() => false);
      if (hay) S.bancos.push({ id: bb.archivo, nombre: bb.nombre, url, sesion: true, listo: false, deLaCarpeta: true });
    }
    S.bancos.push(...(bancos || []).map(b => ({ ...b, listo: false })));   // y los que se agregaron a mano (carpetas o .zip)
  } catch (e) { $('estadoBancos').textContent = 'No pude leer lo guardado: ' + e.message; S.plantel = JSON.parse(JSON.stringify(VOCES_MBROLA)); }
  alAbrir = JSON.parse(JSON.stringify(S.plantel));
  $('frase').value = S.opciones.frase; $('cuerda').value = S.opciones.cuerda; $('auto').checked = S.opciones.auto;
  for (const id of ['forma', 'estilo', 'semilla', 'hasta']) $(id).value = S.opciones[id];
  dibujarBancos(); dibujarVoces(); dibujarLugares();
  // los bancos con permiso ya dado se abren solos; los otros esperan un clic («Dar permiso»)
  for (const b of S.bancos) {
    if (b.url) abrirBanco(b);
    else if (b.handle && await permiso(b.handle).catch(() => false)) { if (b.esZip) { b.zip = b.handle; delete b.handle; } abrirBanco(b); }
  }
})();
