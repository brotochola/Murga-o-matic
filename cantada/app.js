// Murga cantada: el Murga-o-matic compone, un letrista algorítmico escribe la letra para esa melodía y un coro sintético la canta. Sin red.
import { componer } from '../motor/compositor.js';
import { MODELO } from '../motor/modelo.js';
import { tiempos, metrica, silabear, cantores } from './cantor/coro.js';
import { cantar } from './cantor/cantor.js';
import { ecualizar } from './cantor/eq.js';
import { sala, normalizar } from './cantor/mezcla.js';
import { renderBateria } from './cantor/bateria.js';
import { medir, versosDe } from './cantor/letra.js';
import { partesAEscribir } from './cantor/letrista.js';
import { escribirLetraLocal } from './cantor/letrista_local.js';
import { DATOS } from './cantor/datos.js';
import { CURVA } from './cantor/timbre.js';
import { crearPartitura, mostrarProceso } from './vista.js';
const INICIO = { forma: 'presentacion', estilo: 'trasnochada', semilla: 4, tonica: 9, modo: 'menor', largo: 'corta' };

const $ = id => document.getElementById(id);
const SR = 44100;
const NOTAS = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
const ESTILOS = { trasnochada: 'La Trasnochada', catalina: 'Agarrate Catalina', todas: 'todas juntas', muneca: 'La Gran Muñeca', pasteles: 'Metele que son Pasteles' };
const TEMAS = {
  presentacion: ['el barrio que resiste', 'la plata no alcanza', 'el carnaval de antes', 'todos mirando el celular'],
  retirada: ['la despedida del barrio', 'lo que nos llevamos', 'el último tablado', 'volver el año que viene'],
};
const LLAMADAS = Object.fromEntries(DATOS.ritmos.map(r => { const a = DATOS.acompana[r.id]; if (!a || !a[0]) return [r.id, 0]; const c4 = r.compas * 4 / r.tpc; return [r.id, Math.ceil((DATOS.frases[a[0]].ultimo + .05) / c4)]; }));
const S = { P: null, partes: [], textos: [], wav: null, url: null, marcas: [], ocupado: false, semLetra: 1, diags: null, temasLetra: null, editados: new Set(), sel: { i: 0, k: 0 }, sil: null };
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const pausa = () => new Promise(r => setTimeout(r, 0));

// ── Controles ──
function opciones() {
  return { forma: $('forma').value, estilo: $('estilo').value, tonica: +$('tonica').value, modo: $('modo').value, largo: $('largo').value, semilla: Math.max(1, Math.round(+$('semilla').value || 1)) };
}
function llenarSelects() {
  $('tonica').innerHTML = NOTAS.map((n, i) => `<option value="${i}">${n}</option>`).join('');
  $('estilo').innerHTML = Object.entries(ESTILOS).map(([k, v]) => `<option value="${k}">${v[0].toUpperCase() + v.slice(1)}</option>`).join('');
  const o = INICIO;
  $('forma').value = o.forma; $('estilo').value = o.estilo; $('tonica').value = o.tonica; $('modo').value = o.modo; $('largo').value = o.largo; $('semilla').value = o.semilla;
}
function chips() {
  const f = $('forma').value;
  $('temas').innerHTML = TEMAS[f].map(t => `<button type="button" class="chip-tema">${t}</button>`).join('');
  $('temas').querySelectorAll('button').forEach(b => b.onclick = () => { $('tema').value = b.textContent; escribir(true); });
}

// ── Componer ──
function componerPieza() {
  const o = opciones();
  const P = componer(MODELO, { ...o, llamadas: LLAMADAS });
  const { T, fin } = tiempos(P);
  P.total = fin; P.T = T;
  S.P = P;
  S.partes = partesAEscribir(metrica(P), o.forma);
  S.textos = S.partes.map(p => p.versos.map(() => '')); S.sel = { i: 0, k: 0 }; S.diags = null;
  // dónde empieza cada verso, para seguir la letra mientras suena
  S.marcas = [];
  for (const s of P.secs) {
    const i = S.partes.findIndex(p => p.secciones.includes(s.nombre));
    if (i < 0 || !(s.golpes || []).length) continue;
    versosDe(s.golpes.map(g => ({ q: g.q - s.inicio, d: g.d, p: g.top }))).forEach((v, k) => S.marcas.push({ t: T(s.inicio + v.golpes[0].q), i, k }));
  }
  S.marcas.sort((a, b) => a.t - b.t);
  const sils = S.partes.reduce((a, p) => a + p.versos.reduce((b, v) => b + v.silabas, 0), 0);
  const versos = S.partes.reduce((a, p) => a + p.versos.length, 0);
  $('resumen').textContent = `${o.forma === 'retirada' ? 'Retirada' : 'Presentación'} en ${NOTAS[o.tonica]} ${o.modo} · ${ESTILOS[o.estilo]} · ${P.secs.find(s => s.bateria)?.tempo || ''} BPM · ${fmt(fin)} · ${versos} versos, ${sils} sílabas`;
  limpiarAudio();
  chips();
  escribir();
}

// ── Libreto ──
function libreto() {
  const L = $('libreto');
  L.innerHTML = '';
  S.partes.forEach((p, i) => {
    const sec = document.createElement('section');
    sec.className = 'parte';
    const otras = p.secciones.length > 1 ? `<p class="se-canta">Se canta ${p.secciones.length} veces: ${p.secciones.join(' · ')}</p>` : '';
    sec.innerHTML = `<header><h3>${p.nombre}</h3><p class="funcion">${p.funcion}</p>${otras}</header><ol class="versos"></ol>`;
    const ol = sec.querySelector('ol');
    p.versos.forEach((v, k) => {
      const li = document.createElement('li');
      li.className = 'verso'; li.dataset.i = i; li.dataset.k = k;
      const id = `v-${i}-${k}`;
      li.innerHTML = `<label class="sr" for="${id}">Verso ${k + 1} de ${p.nombre}</label>
        <input id="${id}" type="text" autocomplete="off" spellcheck="false" placeholder="${v.silabas} sílaba${v.silabas === 1 ? '' : 's'}${v.silabas > 1 ? ', ' + v.tipo : ''}">
        <span class="cuenta" title="sílabas cantadas / notas del verso"></span>`;
      const inp = li.querySelector('input');
      inp.value = S.textos[i][k];
      inp.addEventListener('input', () => { S.textos[i][k] = inp.value; S.editados.add(i + '|' + k); cuenta(li, inp.value, v.silabas); limpiarAudio(true); actualizarLuego(); });
      inp.addEventListener('focus', () => elegir(i, k, true));
      if (S.sel.i === i && S.sel.k === k) li.classList.add('elegido');
      cuenta(li, inp.value, v.silabas);
      ol.append(li);
    });
    L.append(sec);
  });
  estadoLetra();
}
function cuenta(li, texto, quiere) {
  const c = li.querySelector('.cuenta');
  if (!texto.trim()) { c.textContent = `–/${quiere}`; c.dataset.estado = 'vacio'; return; }
  const n = medir(texto).n;
  c.textContent = `${n}/${quiere}`;
  c.dataset.estado = n === quiere ? 'ok' : Math.abs(n - quiere) <= 2 ? 'cerca' : 'mal';
  c.title = n === quiere ? 'Entra justo: una sílaba por nota' : Math.abs(n - quiere) <= 2 ? 'Entra con algún melisma o nota partida' : 'No entra bien en la música';
}
function estadoLetra() {
  let ok = 0, tot = 0, vacios = 0;
  S.partes.forEach((p, i) => p.versos.forEach((v, k) => { tot++; const t = S.textos[i][k]; if (!t.trim()) vacios++; else if (medir(t).n === v.silabas) ok++; }));
  $('estado-letra').textContent = vacios === tot ? 'Sin letra todavía: el coro va a cantar "la la la".' : `${ok} de ${tot} versos entran justo en la música${vacios ? ` · ${vacios} vacíos (se cantan con "la")` : ''}.`;
}

// ── La letra: letrista algorítmico, sin red ──
function escribir(otra) {
  if (otra) S.semLetra++;
  const o = opciones();
  $('estado-letra-gen').textContent = 'Escribiendo la letra…';
  $('escribir').disabled = true; $('otra-letra').disabled = true;
  setTimeout(() => {
    const t0 = performance.now();
    const r = escribirLetraLocal({ forma: o.forma, tema: $('tema').value.trim(), metrica: metrica(S.P), semilla: o.semilla * 1000 + S.semLetra });
    S.textos = r.textos.map(t => t.slice()); S.diags = r.diags; S.temasLetra = r.temas; S.editados.clear();
    libreto(); limpiarAudio(true); actualizarVistas();
    $('estado-letra-gen').textContent = `Letra escrita en ${((performance.now() - t0) / 1000).toFixed(1)} s. Editala a mano si querés, o pedí otra.`;
    $('escribir').disabled = false; $('otra-letra').disabled = false;
  }, 30);
}
function lailareo() {
  const s = ['la', 'ra', 'la', 'la', 'ra', 'lai', 'la', 'ra'];
  S.textos = S.partes.map(p => p.versos.map(v => Array.from({ length: v.silabas }, (_, j) => s[j % s.length]).join(' ')));
  S.diags = null; S.editados.clear();
  libreto(); limpiarAudio(true); actualizarVistas();
}

// ── Cantar ──
function letrasPorSeccion() {
  const L = {};
  S.partes.forEach((p, i) => { for (const s of p.secciones) L[s] = S.textos[i].map(t => t.trim()); });
  return L;
}
const cacheWav = new Map();
async function cargarWav(archivo) {
  if (!cacheWav.has(archivo)) cacheWav.set(archivo, (async () => {
    const r = await fetch('../' + archivo); if (!r.ok) throw new Error(`no se pudo bajar ${archivo}`);
    const buf = await r.arrayBuffer();
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OAC(1, 1, SR);
    const ab = await new Promise((ok, mal) => { const p = ctx.decodeAudioData(buf, ok, mal); if (p?.catch) p.catch(mal); });
    return { sr: ab.sampleRate, datos: ab.getChannelData(0) };
  })());
  return cacheWav.get(archivo);
}
async function cantarTodo() {
  if (S.ocupado || !S.P) return;
  S.ocupado = true; $('cantar').disabled = true; $('descargar').disabled = true;
  const prog = $('progreso'), est = $('estado-canto');
  try {
    const P = S.P;
    const { porQ } = silabear(P, letrasPorSeccion());
    const lista = cantores(P, porQ, { semilla: opciones().semilla });
    const largo = P.total + 1.6, n = Math.ceil(largo * SR);
    const L = new Float32Array(n), R = new Float32Array(n), RL = new Float32Array(n), RR = new Float32Array(n);
    for (let i = 0; i < lista.length; i++) {
      const c = lista[i];
      est.textContent = `Cantando: ${c.cuerda} (${i + 1} de ${lista.length} cantores)`; prog.value = i / (lista.length + 3);
      await pausa();
      const { voz, ruido } = cantar(c.notas, { sr: SR, tipo: c.tipo, semilla: c.semilla, separar: true });
      const gl = Math.cos((c.pan + 1) * Math.PI / 4) * c.ganancia, gr = Math.sin((c.pan + 1) * Math.PI / 4) * c.ganancia;
      const m = Math.min(n, voz.length);
      for (let s = 0; s < m; s++) { L[s] += voz[s] * gl; R[s] += voz[s] * gr; RL[s] += ruido[s] * gl; RR[s] += ruido[s] * gr; }
    }
    est.textContent = 'Dándole el color del coro real…'; prog.value = (lista.length + 1) / (lista.length + 3); await pausa();
    const EL = ecualizar(L, SR, CURVA), ER = ecualizar(R, SR, CURVA);
    for (let s = 0; s < n; s++) { EL[s] += RL[s]; ER[s] += RR[s]; }
    est.textContent = 'Sumando la batería de La Tríada…'; prog.value = (lista.length + 2) / (lista.length + 3); await pausa();
    const bat = await renderBateria(P, DATOS, cargarWav, SR, largo);
    sala(EL, ER, SR, { mezcla: .24, largo: 1.7 });
    let pc = 1e-9, pb = 1e-9; for (let s = 0; s < n; s++) { pc = Math.max(pc, Math.abs(EL[s])); pb = Math.max(pb, Math.abs(bat[s])); }
    const kb = .55 * pc / pb;
    for (let s = 0; s < n; s++) { EL[s] += bat[s] * kb; ER[s] += bat[s] * kb; }
    normalizar(EL, ER);
    S.wav = wav(EL, ER, SR);
    if (S.url) URL.revokeObjectURL(S.url);
    S.url = URL.createObjectURL(new Blob([S.wav], { type: 'audio/wav' }));
    const a = $('audio'); a.src = S.url; a.hidden = false;
    prog.value = 1; est.textContent = `Listo: ${fmt(P.total)}. Mientras suena, se marca el verso que se canta.`;
    $('descargar').disabled = !S.downloads;
    try { await a.play(); } catch { }
  } catch (e) {
    est.textContent = `No se pudo cantar: ${e?.message || e}`;
  } finally { S.ocupado = false; $('cantar').disabled = false; }
}
function limpiarAudio(soloAviso) {
  if (soloAviso && S.wav) { $('estado-canto').textContent = 'Cambió la letra: tocá Cantar para escucharla.'; return; }
  const a = $('audio'); a.pause(); a.hidden = true; a.removeAttribute('src');
  S.wav = null; $('descargar').disabled = true; $('progreso').value = 0;
  $('estado-canto').textContent = 'Tocá Cantar: tarda unos segundos en armar las voces.';
}

// la letra que suena, marcada
function seguir() {
  const t = $('audio').currentTime;
  partitura.tiempo(t, !$('audio').paused);
  let m = null; for (const x of S.marcas) { if (x.t <= t + .05) m = x; else break; }
  document.querySelectorAll('.verso.sonando').forEach(e => e.classList.remove('sonando'));
  if (!m || $('audio').paused && t === 0) return;
  const li = document.querySelector(`.verso[data-i="${m.i}"][data-k="${m.k}"]`);
  if (li) li.classList.add('sonando');
}


// ── Partitura y proceso ──
const partitura = crearPartitura({
  lienzo: $('roll'), mapa: $('mapa'), leyenda: $('leyenda'),
  alBuscar: t => { const a = $('audio'); if (a.src && !a.hidden) { a.currentTime = Math.min(t, (a.duration || t)); } partitura.tiempo(t, false); },
  alElegir: (i, k) => elegir(i, k, false, true),
});
function datosPartitura() {
  const P = S.P, T = P.T;
  const notas = [];
  for (const [k, evs] of Object.entries(P.ev)) for (const [q, d, p] of evs) notas.push({ t0: T(q), t1: T(q + d), p, cuerda: k });
  const silabas = [];
  for (const s of P.secs) {
    const i = S.partes.findIndex(p => p.secciones.includes(s.nombre)); if (i < 0) continue;
    for (let k = 0; S.sil.detalle.has(s.nombre + '|' + k); k++) {
      const det = S.sil.detalle.get(s.nombre + '|' + k);
      det.reparto.forEach((r, j) => { const a = r.notas[0], b = r.notas[r.notas.length - 1]; silabas.push({ t0: T(a.q), t1: T(b.q + b.d), texto: r.texto, acento: r.acento, melisma: r.notas.length > 1, p: a.p, i, k, j }); });
    }
  }
  silabas.sort((a, b) => a.t0 - b.t0);
  const compases = []; for (const s of P.secs) for (let q = s.inicio; q < s.inicio + s.largo; q += 16) compases.push(T(q));
  return { notas, silabas, compases, secciones: P.secs.map(s => ({ t0: s.t0, t1: s.t1, nombre: s.nombre, bateria: s.bateria, llamada: s.tipo === 'llamada' })), total: P.total };
}
function actualizarVistas() {
  if (!S.P) return;
  S.sil = silabear(S.P, letrasPorSeccion());
  partitura.datos(datosPartitura());
  partitura.elegir(S.sel.i, S.sel.k);
  proceso();
}
let temporizador = null;
function actualizarLuego() { clearTimeout(temporizador); temporizador = setTimeout(actualizarVistas, 350); }
function proceso() {
  const { i, k } = S.sel, p = S.partes[i]; if (!p) return;
  const texto = S.textos[i]?.[k] || '';
  mostrarProceso($('proceso'), { P: S.P, partes: S.partes, i, k, texto, n: medir(texto).n, diag: S.diags?.[i]?.[k], det: S.sil?.detalle.get(p.secciones[0] + '|' + k), temas: S.temasLetra, editado: S.editados.has(i + '|' + k), forma: opciones().forma });
  $('proceso').querySelectorAll('[data-ir]').forEach(b => b.onclick = () => {
    const lista = S.partes.flatMap((pp, ii) => pp.versos.map((_, kk) => [ii, kk]));
    const pos = lista.findIndex(([ii, kk]) => ii === i && kk === k), sig = lista[Math.max(0, Math.min(lista.length - 1, pos + +b.dataset.ir))];
    elegir(sig[0], sig[1], false, false, true);
  });
}
function elegir(i, k, desdeLetra, desdePartitura, mover) {
  S.sel = { i, k };
  document.querySelectorAll('.verso.elegido').forEach(e => e.classList.remove('elegido'));
  const li = document.querySelector(`.verso[data-i="${i}"][data-k="${k}"]`); if (li) li.classList.add('elegido');
  partitura.elegir(i, k);
  if (desdeLetra || mover) { const m = S.marcas.find(x => x.i === i && x.k === k); if (m) partitura.irA(m.t); }
  proceso();
}
let animando = false;
function cuadro() { seguir(); if (!$('audio').paused) requestAnimationFrame(cuadro); else animando = false; }

// ── Archivos ──
function wav(L, R, sr) {
  const n = L.length, b = new ArrayBuffer(44 + n * 4), v = new DataView(b);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0, o = 44; i < n; i++, o += 4) { v.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true); v.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
  return b;
}
const CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
const crc32 = d => { let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(archivos) {
  const enc = new TextEncoder(), partes = [], central = []; let off = 0;
  for (const { nombre, datos } of archivos) {
    const nb = enc.encode(nombre), crc = crc32(datos), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true); h.setUint32(18, datos.length, true); h.setUint32(22, datos.length, true); h.setUint16(26, nb.length, true);
    partes.push(new Uint8Array(h.buffer), nb, datos);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, datos.length, true); c.setUint32(24, datos.length, true); c.setUint16(28, nb.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nb);
    off += 30 + nb.length + datos.length;
  }
  const tam = central.reduce((a, x) => a + x.length, 0), fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true); fin.setUint32(12, tam, true); fin.setUint32(16, off, true);
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)]);
}
async function descargar() {
  if (!S.wav || !S.downloads) return;
  const o = opciones();
  const texto = [`Murga cantada · ${o.forma} · ${NOTAS[o.tonica]} ${o.modo} · ${ESTILOS[o.estilo]} · semilla ${o.semilla}`, $('tema').value ? `Tema: ${$('tema').value}` : '', '']
    .concat(S.partes.flatMap((p, i) => [p.nombre.toUpperCase() + (p.secciones.length > 1 ? `  (se canta ${p.secciones.length} veces)` : ''), ...S.textos[i].map(t => t || '(la la la)'), ''])).join('\n');
  const nombre = `murga_cantada_${o.forma}_${o.estilo}_${o.semilla}`;
  try {
    await S.downloads.save({ filename: nombre + '.zip', data: zip([{ nombre: nombre + '.wav', datos: new Uint8Array(S.wav) }, { nombre: 'letra.txt', datos: new TextEncoder().encode(texto) }]) });
    $('estado-canto').textContent = 'Descargado.';
  } catch (e) { if (e?.code !== 'declined') $('estado-canto').textContent = 'No se pudo descargar en esta vista.'; }
}

// ── Arranque ──
llenarSelects();
setTimeout(componerPieza, 0);
$('componer').onclick = componerPieza;
$('otra').onclick = () => { $('semilla').value = 1 + Math.floor(Math.random() * 999); componerPieza(); };
$('forma').onchange = chips;
$('escribir').onclick = () => escribir(false);
$('otra-letra').onclick = () => escribir(true);
$('tema').addEventListener('keydown', e => { if (e.key === 'Enter') escribir(true); });
$('lailareo').onclick = lailareo;
$('cantar').onclick = cantarTodo;
$('descargar').onclick = descargar;
$('audio').addEventListener('timeupdate', seguir);
$('audio').addEventListener('play', () => { if (!animando) { animando = true; requestAnimationFrame(cuadro); } });
$('audio').addEventListener('seeked', seguir);
$('zoom-mas').onclick = () => partitura.zoom(1.4);
$('zoom-menos').onclick = () => partitura.zoom(1 / 1.4);
$('seguir').onchange = e => partitura.seguir(e.target.checked);
(async () => {
  const c = window.claude;
  S.downloads = c?.use ? await c.use('downloads').catch(() => null) : null;
  if (!S.downloads) $('descargar').hidden = true;
})();
