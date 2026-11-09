// banco.js — un cantor con un banco de voz cantada de UTAU (docs/utau.md). Un banco son grabaciones de una persona
// cantando sílabas, a veces en varias alturas, y un oto.ini que dice dónde empieza y termina cada pedazo. Es corte y
// pegado de grabaciones, como MBROLA: no hay redes neuronales.
//
// Lo que hace este archivo:
//   1. leer el banco: los oto.ini de cada carpeta, el prefix.map (qué altura grabada usar para cada nota) y los .wav;
//   2. pasar nuestras sílabas (ataque, núcleo y coda, de letra.js) a las entradas del banco. Por ahora la reclist
//      VCCV de nJokis: «-ko» (sílaba después de un silencio), «o m» (de la vocal a la consonante), «mo», «pr» + «_ro»
//      (grupos), «oI» (diptongo), «a-» (final);
//   3. ubicarlas en el tiempo como UTAU: el «preutterance» de cada pedazo cae en el momento que le toca (el comienzo
//      de la vocal, en una sílaba), la parte fija («consonante») queda como está y el resto se estira;
//   4. el «resampler» y el «wavtool»: WORLD (world.js) separa cada pedazo en altura, envolvente y aire; los pedazos se
//      funden cuadro por cuadro (envolvente en dB) y se sintetiza la frase entera con nuestra curva de altura
//      (la de guion(), en difonos.js: portamento, vibrato, caída) sin mover los formantes.
import { guion } from './difonos.js';

// ── leer el banco ────────────────────────────────────────────────────────
const NOMBRES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const nombreNota = m => NOMBRES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
export function notaDeNombre(s) {
  const r = /^([A-G])([#b]?)(-?\d)$/.exec(String(s).trim()); if (!r) return null;
  return { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[r[1]] + (r[2] === '#' ? 1 : r[2] === 'b' ? -1 : 0) + 12 * (+r[3] + 1);
}

// muchos oto.ini están en Shift-JIS (los bancos japoneses); los castellanos, en ASCII o UTF-8
export function texto(bytes) {
  const u = new TextDecoder('utf-8').decode(bytes);
  if (!u.includes('�')) return u;
  try { return new TextDecoder('shift_jis').decode(bytes); } catch { return u; }
}

// archivo.wav=alias,offset,consonante,cutoff,preutterance,overlap (ms). cutoff negativo: largo desde el offset;
// positivo: lo que se deja sin usar al final del archivo.
export function leerOto(t, carpeta = '') {
  const L = [];
  for (const linea of t.split(/\r?\n/)) {
    const i = linea.indexOf('='); if (i <= 0) continue;
    const archivo = linea.slice(0, i).trim(), c = linea.slice(i + 1).split(',');
    if (c.length < 6) continue;
    const [offset, consonante, cutoff, pre, overlap] = c.slice(1, 6).map(Number);
    L.push({ archivo: carpeta ? carpeta + '/' + archivo : archivo, alias: c[0] || archivo.replace(/\.wav$/i, ''), offset, consonante, cutoff, pre, overlap });
  }
  return L;
}
export function leerPrefixMap(t) {
  const m = new Map();
  for (const linea of t.split(/\r?\n/)) {
    const [n, prefijo = '', sufijo = ''] = linea.split('\t'), k = notaDeNombre(n || '');
    if (k != null) m.set(k, { prefijo: prefijo.trim(), sufijo: sufijo.trim() });
  }
  return m;
}
export function leerWav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), tag = p => String.fromCharCode(...bytes.subarray(p, p + 4));
  let p = 12, sr = 0, bits = 16, canales = 1, formato = 1, x = null;
  while (p + 8 <= bytes.length) {
    const id = tag(p), n = v.getUint32(p + 4, true);
    if (id === 'fmt ') { formato = v.getUint16(p + 8, true); canales = v.getUint16(p + 10, true); sr = v.getUint32(p + 12, true); bits = v.getUint16(p + 22, true); }
    if (id === 'data') {
      const b = bits / 8, m = Math.floor(Math.min(n, bytes.length - p - 8) / (b * canales)); x = new Float32Array(m);
      for (let i = 0; i < m; i++) {
        const q = p + 8 + i * b * canales;
        x[i] = formato === 3 ? v.getFloat32(q, true) : b === 2 ? v.getInt16(q, true) / 32768 : b === 3 ? ((v.getUint8(q) | v.getUint8(q + 1) << 8 | v.getInt8(q + 2) << 16) / 8388608) : b === 4 ? v.getInt32(q, true) / 2147483648 : (v.getUint8(q) - 128) / 128;
      }
    }
    p += 8 + n + (n & 1);
  }
  if (!x) throw new Error('wav sin datos');
  return { x, sr };
}

// rutas: todas las rutas del banco, relativas a su raíz, con «/». leer(ruta) → Uint8Array (o null si no está).
export function crearBanco(rutas, leer) {
  const base = r => r.split('/').pop().toLowerCase();
  const otos = rutas.filter(r => base(r) === 'oto.ini');
  const entradas = [];
  for (const r of otos) { const b = leer(r); if (b) entradas.push(...leerOto(texto(b), r.split('/').slice(0, -1).join('/'))); }
  const rPrefix = rutas.find(r => r.toLowerCase() === 'prefix.map');
  const prefijos = rPrefix ? leerPrefixMap(texto(leer(rPrefix))) : new Map();
  const rChar = rutas.find(r => r.toLowerCase() === 'character.txt');
  const nombre = rChar ? (/^name=(.*)$/m.exec(texto(leer(rChar)))?.[1] || '').trim() : '';
  const indice = new Map();
  for (const e of entradas) if (!indice.has(e.alias)) indice.set(e.alias, e);
  // las alturas grabadas: cada sufijo del prefix.map, con la nota que dice su nombre o, si no, el medio de sus notas
  const porSufijo = new Map();
  for (const [m, { sufijo }] of prefijos) { if (!porSufijo.has(sufijo)) porSufijo.set(sufijo, []); porSufijo.get(sufijo).push(m); }
  const alturas = [...porSufijo].map(([sufijo, ms]) => {
    const dicho = notaDeNombre(sufijo.replace(/^[_\s-]+/, '').replace(/[_\s-].*$/, ''));
    return { sufijo, midi: dicho ?? ms.sort((a, b) => a - b)[ms.length >> 1] };
  });
  if (!alturas.length) alturas.push({ sufijo: '', midi: 60 });
  const sufijoDe = midi => prefijos.get(Math.round(midi))?.sufijo
    ?? alturas.reduce((a, b) => (Math.abs(b.midi - midi) < Math.abs(a.midi - midi) ? b : a)).sufijo;
  const midiDe = suf => alturas.find(a => a.sufijo === suf)?.midi ?? 60;
  // el pedazo para un alias en una nota: la altura grabada que dice el prefix.map, o la más cercana que lo tenga
  function buscar(alias, midi) {
    const s = sufijoDe(midi);
    const orden = [s, ...alturas.map(a => a.sufijo).filter(x => x !== s).sort((a, b) => Math.abs(midiDe(a) - midi) - Math.abs(midiDe(b) - midi))];
    for (const suf of orden) { const e = indice.get(alias + suf); if (e) return e; }
    return indice.get(alias) || null;
  }
  const existe = new Set();
  for (const a of indice.keys()) {
    existe.add(a);
    for (const { sufijo } of alturas) if (sufijo && a.endsWith(sufijo)) existe.add(a.slice(0, -sufijo.length));
  }
  const wavs = new Map();
  function wav(archivo) {
    if (!wavs.has(archivo)) { const b = leer(archivo); wavs.set(archivo, b ? leerWav(b) : null); }
    return wavs.get(archivo);
  }
  return { nombre, entradas, indice, prefijos, alturas, buscar, existe: a => existe.has(a), wav, sufijoDe };
}

// ── de nuestras sílabas a los alias (reclist VCCV de nJokis) ──────────────
const VOCAL = new Set(['a', 'e', 'i', 'o', 'u']);
const NJ = { a: 'a', e: 'e', i: 'i', o: 'o', u: 'u', l: 'l', r: 'r', R: 'rr', m: 'm', n: 'n', N: 'nJ', B: 'B', D: 'D', G: 'G', b: 'b', d: 'd', g: 'g', p: 'p', t: 't', k: 'k', C: 'ch', f: 'f', s: 's', h: 's', x: 'x', S: 'jj', Z: 'jj', j: 'y', w: 'w' };
const OCLUSIVA = { B: 'b', D: 'd', G: 'g' }, FRICATIVA = { b: 'B', d: 'D', g: 'G' };

// notas de una frase (ligadas, sin silencios) → unidades en orden: { alias, nota, tipo }
//   cv: la sílaba, su preutterance cae en el comienzo de la nota; medio: un diptongo o dos vocales dentro de la nota;
//   antes: un paso (vocal → consonante, consonante → consonante) que se pone justo antes de la unidad que sigue;
//   fin: el final de la frase.
export function aliasFrase(notas, existe, o = {}) {
  const U = [], faltan = [];
  const pon = (alias, nota, tipo, extra) => { if (alias) U.push({ alias, nota, tipo, ...extra }); };
  // el primero que tenga el banco; si ninguno, se anota el que se quería
  const elegir = (...c) => { const a = c.find(x => x && existe(x)); if (!a && c[0]) faltan.push(c[0]); return a || null; };
  // una sílaba: la consonante con su vocal. En nJokis b, d y g oclusivas sólo están después de un silencio («-ba»):
  // después de una nasal se usan esas, y si no, las suaves
  const cv = (k, v) => elegir(k + v, '_' + k + v, '-' + k + v, FRICATIVA[k] && FRICATIVA[k] + v, OCLUSIVA[k] && '-' + OCLUSIVA[k] + v);
  const paso = (c, k) => elegir(c + ' ' + k, (FRICATIVA[k] || OCLUSIVA[k]) && c + ' ' + (FRICATIVA[k] || OCLUSIVA[k]));
  let antes = { tipo: 'silencio' };
  for (let i = 0; i < notas.length; i++) {
    const n = notas[i], sig = notas[i + 1], s = n.sil;
    const nuc = s.nucleo.length ? s.nucleo : ['a'];
    let k0 = nuc.findIndex(p => VOCAL.has(p)); if (k0 < 0) k0 = nuc.length - 1;
    const desliz = nuc.slice(0, k0).map(p => (p === 'j' || p === 'i' ? 'y' : 'w'));
    const vocs = [], aVocal = p => (p === 'j' ? 'i' : p === 'w' ? 'u' : p);
    let k1 = k0; while (k1 < nuc.length && (k1 === k0 || VOCAL.has(nuc[k1]))) vocs.push(aVocal(nuc[k1++]));
    const cola = nuc.slice(k1).map(p => (p === 'j' || p === 'i' ? 'I' : 'U'));
    const K = [...s.ataque.map(p => NJ[p] || p), ...desliz], v1 = vocs[0];
    // 1. la entrada a la sílaba
    const grupo = (sinPaso) => {
      // K no vacío; después de una vocal o de una consonante (el paso ya está puesto)
      const k = K.join('');
      if (K.length === 1) { pon(cv(k, v1), i, 'cv'); return; }
      const todo = existe(k + v1) ? k + v1 : null;
      if (todo) { pon(todo, i, 'cv'); return; }
      const alt = (FRICATIVA[K[0]] || OCLUSIVA[K[0]]) && (FRICATIVA[K[0]] || OCLUSIVA[K[0]]) + K.slice(1).join('');
      const g = elegir(k, '-' + k, alt, alt && alt + v1);
      if (!g) { pon(cv(K[0], v1), i, 'cv'); return; }   // sin el grupo: la primera consonante con la vocal
      pon(g, i, g.endsWith(v1) && g !== k ? 'cv' : 'antes');
      if (!g.endsWith(v1) || g === k) pon(elegir('_' + K[K.length - 1] + v1, K[K.length - 1] + v1), i, 'cv');
    };
    if (antes.tipo === 'silencio') {
      if (!K.length) pon(elegir('- ' + v1, '-' + v1, v1), i, 'cv');
      else {
        const K2 = [OCLUSIVA[K[0]] || K[0], ...K.slice(1)], k = K2.join('');
        const todo = existe('-' + k + v1) ? '-' + k + v1 : null;
        if (todo) pon(todo, i, 'cv');
        else {
          const ent = ['-' + k, '-' + K2[0]].find(existe) || null;
          if (ent) pon(ent, i, 'antes');
          if (ent === '-' + k && K2.length > 1) pon(elegir('_' + K2[K2.length - 1] + v1, K2[K2.length - 1] + v1), i, 'cv');
          else { K.splice(0, K.length, ...K2); grupo(); }
        }
      }
    } else if (antes.tipo === 'vocal') {
      if (!K.length) pon(elegir(antes.v + ' ' + v1, antes.v === 'I' ? '_y' + v1 : antes.v === 'U' ? '_w' + v1 : null, v1), i, 'cv');
      else { pon(paso(antes.v, K[0]), i - 1, 'antes'); grupo(); }
    } else if (antes.tipo === 'consonante') {
      if (!K.length) pon(elegir(antes.c + v1, '_' + antes.c + v1, v1), i, 'cv');
      else { pon(paso(antes.c, K[0]), i - 1, 'antes'); grupo(); }
    } else grupo(); // después de «ar n»: la consonante ya empezó
    // 2. dentro de la nota: dos vocales (sinalefa) y el diptongo
    let v = v1;
    for (const w of vocs.slice(1)) { pon(elegir(v + ' ' + w), i, 'medio', { frac: .4 }); v = w; }
    for (const g of cola) { pon(elegir(v + g, v + ' ' + g.toLowerCase()), i, 'medio', { frac: .62 }); v = g; }
    // 3. la coda y el final
    let coda = s.coda.map(p => NJ[p] || p);
    const sigK0 = sig ? (sig.sil.ataque[0] ? NJ[sig.sil.ataque[0]] : null) : null;
    // acento rioplatense: la s del final de la palabra antes de consonante no se canta («lo gurise corren»)
    if (o.acento !== 0 && s.fin && sig && sigK0 && coda[coda.length - 1] === 's') coda = coda.slice(0, -1);
    if (coda.length > 1) coda = [coda[0]];
    if (coda[0] === 'n' && ['p', 'b', 'B', 'm'].includes(sigK0)) coda[0] = 'm';
    const c = coda[0];
    if (!c) {
      if (!sig) pon(elegir(v + '-', v + '--', v.toLowerCase() + '-'), i, 'fin');
      antes = { tipo: 'vocal', v };
    } else if (c === 'r' && VOCAL.has(v)) {
      if (!sig) { pon(elegir(v + 'r-', v + ' r'), i, 'fin'); antes = { tipo: 'vocal', v }; }
      else if (sigK0 && existe(v + 'r ' + sigK0)) { pon(v + 'r ' + sigK0, i, 'antes'); antes = { tipo: 'r' }; }
      else { pon(elegir(v + ' r'), i, 'antes'); antes = { tipo: 'consonante', c: 'r' }; }
    } else {
      pon(elegir(v + ' ' + c), i, 'antes');
      if (!sig) pon(elegir(c + '-', c + '--'), i, 'fin');
      antes = { tipo: 'consonante', c };
    }
  }
  U.faltan = faltan;
  return U;
}

// ── ubicar las unidades en el tiempo (como UTAU) ──────────────────────────
// Cada unidad: T, el momento en que cae su preutterance. Empieza a sonar en S = T − pre y suena hasta que la siguiente
// lleva «overlap» ms sonando. La parte fija (consonante) va a su velocidad; lo demás se estira o se encoge.
function largoDe(e, wav) {
  const dur = wav ? wav.x.length / wav.sr * 1000 : 1e9;
  const len = e.cutoff < 0 ? -e.cutoff : dur - e.offset - e.cutoff;
  return Math.max(10, Math.min(len, dur - e.offset));
}
export function ubicar(U, notas) {
  for (let k = U.length - 1; k >= 0; k--) {
    const u = U[k], n = notas[u.nota];
    if (u.tipo === 'cv') u.T = n.t0;
    else if (u.tipo === 'medio') u.T = n.t0 + u.frac * (n.t1 - n.t0);
    else if (u.tipo === 'fin') u.T = n.t1 - Math.min(.08, .3 * (n.t1 - n.t0));
    else {
      // antes de la que sigue, con su largo natural
      const s = U[k + 1];
      const E = s ? s.T - s.pre / 1000 + s.ovl / 1000 : n.t1;
      u.T = E + u.pre / 1000 - u.len / 1000;
    }
  }
  // que un paso no se coma la vocal anterior: empieza, como muy temprano, a mitad de camino desde la última sílaba
  let fijo = -Infinity;
  for (let k = 0; k < U.length; k++) {
    const u = U[k];
    if (u.tipo !== 'antes') { fijo = Math.max(fijo, u.T); continue; }
    const sig = U.slice(k + 1).find(x => x.tipo !== 'antes'), hasta = sig ? sig.T - sig.pre / 1000 : u.T + .05;
    const minS = fijo + .45 * Math.max(0, hasta - fijo);
    if (u.T - u.pre / 1000 < minS) u.T = minS + u.pre / 1000;
    fijo = Math.max(fijo, u.T - u.pre / 1000 + .01);
  }
  for (let k = 0; k < U.length; k++) {
    const u = U[k], s = U[k + 1];
    u.S = u.T - u.pre / 1000;
    if (k > 0 && u.S < U[k - 1].S + .012) { u.S = U[k - 1].S + .012; }
  }
  for (let k = 0; k < U.length; k++) {
    const u = U[k], s = U[k + 1];
    u.fundir = s ? Math.max(.012, s.ovl / 1000) : .06;
    u.E = s ? s.S + u.fundir : u.S + u.len / 1000;
    if (!s) u.E = Math.min(u.E, u.T + .25);   // el final: como mucho un cuarto de segundo después de cortar la vocal
  }
}

// ── el resampler y el wavtool, con WORLD ─────────────────────────────────
const PERIODO = 5, PAD = 60;
// analiza el pedazo (con un margen) y lo guarda: f0, envolvente en logaritmo, aire
function analisis(cache, world, banco, e, len) {
  const clave = e.archivo + '|' + e.offset + '|' + len;
  if (cache.has(clave)) return cache.get(clave);
  const w = banco.wav(e.archivo);
  if (!w) { cache.set(clave, null); return null; }
  const desde = Math.max(0, Math.round((e.offset - PAD) / 1000 * w.sr)), hasta = Math.min(w.x.length, Math.round((e.offset + Math.max(len, e.consonante) + PAD) / 1000 * w.sr));
  const x = new Float64Array(hasta - desde); for (let i = 0; i < x.length; i++) x[i] = w.x[desde + i];
  const a = world.analizar(x, w.sr, { periodo: PERIODO, harvest: false, f0min: 70, f0max: 800 });
  const lsp = new Float32Array(a.sp.length); for (let i = 0; i < lsp.length; i++) lsp[i] = Math.log(a.sp[i] + 1e-20);
  const ap = Float32Array.from(a.ap);
  // la altura propia, suavizada (100 ms): lo que se aparta de ella es el temblor natural de la voz, que se conserva
  const f0 = a.f0, liso = new Float64Array(f0.length);
  for (let i = 0; i < f0.length; i++) { let s = 0, c = 0; for (let j = Math.max(0, i - 10); j <= Math.min(f0.length - 1, i + 10); j++) if (f0[j] > 0) { s += Math.log(f0[j]); c++; } liso[i] = c ? s / c : 0; }
  const r = { lsp, ap, f0, liso, cuadros: a.cuadros, ancho: a.ancho, fft: a.fft, sr: w.sr, t0: desde / w.sr * 1000 };
  cache.set(clave, r);
  return r;
}

// notas: [{t0, t1, midi, vel, sil}] como en difonos.js. Devuelve { x, sr, inicio }.
export function cantarBanco(banco, world, notas, opc = {}) {
  const o = { modulacion: 1, cache: new Map(), ...opc };
  if (!notas.length) return { x: new Float32Array(0), sr: 44100, inicio: 0 };
  const g = guion(notas, o);
  // la altura de guion(), una sola pasada en orden (tiene estado: la fase del vibrato)
  const tA0 = g.inicio, nA = Math.ceil((g.fin + .5 - tA0) / (PERIODO / 1000)) + 2, alt = new Float64Array(nA);
  for (let k = 0; k < nA; k++) alt[k] = g.altura(tA0 + k * PERIODO / 1000);
  const alturaEn = t => { const x = (t - tA0) / (PERIODO / 1000), k = Math.max(0, Math.min(nA - 2, Math.floor(x))), f = Math.max(0, Math.min(1, x - k)); return alt[k] * (1 - f) + alt[k + 1] * f; };
  // las frases: notas ligadas
  const frases = [[]];
  notas.forEach((n, i) => { if (i && n.t0 - notas[i - 1].t1 >= .02) frases.push([]); frases[frases.length - 1].push(n); });
  const piezas = [], faltan = [];
  let sr = 44100;
  for (const F of frases) {
    const U = aliasFrase(F, banco.existe, o);
    faltan.push(...U.faltan);
    for (const u of U) {
      u.e = banco.buscar(u.alias, F[u.nota].midi);
      if (!u.e) { faltan.push(u.alias); continue; }
      const w = banco.wav(u.e.archivo); if (w) sr = w.sr;
      u.len = largoDe(u.e, w); u.pre = u.e.pre; u.ovl = Math.max(0, u.e.overlap); u.cons = Math.min(u.e.consonante, u.len);
    }
    const V = U.filter(u => u.e);
    if (!V.length) continue;
    ubicar(V, F);
    piezas.push(sintetizarFrase(V, banco, world, o, alturaEn, g.ganancia));
  }
  if (!piezas.length) return { x: new Float32Array(0), sr, inicio: notas[0].t0, faltan };
  sr = piezas[0].sr;
  const t0 = Math.min(...piezas.map(p => p.inicio)), fin = Math.max(...piezas.map(p => p.inicio + p.x.length / sr));
  const x = new Float32Array(Math.ceil((fin - t0) * sr) + 1);
  for (const p of piezas) { const a = Math.round((p.inicio - t0) * sr); for (let i = 0; i < p.x.length; i++) if (a + i < x.length) x[a + i] += p.x[i]; }
  return { x, sr, inicio: t0, frases: piezas.map(p => p.unidades), faltan };
}

function sintetizarFrase(U, banco, world, o, alturaEn, ganancia) {
  const P = PERIODO / 1000;
  const inicio = Math.floor((Math.min(...U.map(u => u.S)) - .02) / P) * P, fin = Math.max(...U.map(u => u.E)) + .02;
  const cuadros = Math.ceil((fin - inicio) / P) + 1;
  let ancho = 0, fft = 0, sr = 44100;
  const A = U.map(u => { const a = analisis(o.cache, world, banco, u.e, u.len); if (a) { ancho = a.ancho; fft = a.fft; sr = a.sr; } return a; });
  const lsp = new Float64Array(cuadros * ancho), ap = new Float64Array(cuadros * ancho), peso = new Float64Array(cuadros);
  const voz = new Float64Array(cuadros), tiembla = new Float64Array(cuadros), pesoVoz = new Float64Array(cuadros);
  U.forEach((u, k) => {
    const a = A[k]; if (!a || a.ancho !== ancho) return;
    const L = u.E - u.S, cons = u.cons / 1000, len = u.len / 1000, ult = k === U.length - 1;
    const entra = k === 0 ? Math.max(.01, u.ovl / 1000) : U[k - 1].fundir, sale = ult ? .06 : u.fundir;
    const q0 = Math.max(0, Math.ceil((u.S - inicio) / P)), q1 = Math.min(cuadros - 1, Math.floor((u.E - inicio) / P));
    for (let q = q0; q <= q1; q++) {
      const t = inicio + q * P, d = t - u.S;
      // el tiempo dentro del pedazo
      let src;
      if (ult || u.tipo === 'fin') src = d;                                       // el final: a su velocidad, cortado
      else if (L >= cons) src = d <= cons ? d : cons + (d - cons) * Math.max(0, len - cons) / Math.max(1e-3, L - cons);
      else src = d * cons / L;
      const ms = u.e.offset + src * 1000, x = (ms - a.t0) / PERIODO, j = Math.max(0, Math.min(a.cuadros - 2, Math.floor(x))), f = Math.max(0, Math.min(1, x - j));
      let w = Math.min(1, d / entra, (u.E - t) / sale);
      if (w <= 0) continue;
      w = .5 - .5 * Math.cos(Math.PI * w);
      const b0 = j * ancho, b1 = (j + 1) * ancho, bq = q * ancho;
      for (let m = 0; m < ancho; m++) {
        lsp[bq + m] += w * (a.lsp[b0 + m] * (1 - f) + a.lsp[b1 + m] * f);
        ap[bq + m] += w * (a.ap[b0 + m] * (1 - f) + a.ap[b1 + m] * f);
      }
      peso[q] += w;
      const f0a = a.f0[j], f0b = a.f0[j + 1], sonora = (f0a > 0 ? 1 - f : 0) + (f0b > 0 ? f : 0);
      voz[q] += w * sonora;
      const fa = f0a > 0 ? f0a : f0b, la = a.liso[j] || a.liso[j + 1];
      if (fa > 0 && la) { tiembla[q] += w * (Math.log(fa) - la); pesoVoz[q] += w; }
    }
  });
  const f0 = new Float64Array(cuadros), amp = new Float64Array(cuadros);
  for (let q = 0; q < cuadros; q++) {
    const bq = q * ancho, p = peso[q];
    if (p < 1e-6) { for (let m = 0; m < ancho; m++) { lsp[bq + m] = Math.exp(-46); ap[bq + m] = 1; } continue; }
    for (let m = 0; m < ancho; m++) { lsp[bq + m] = Math.exp(lsp[bq + m] / p); ap[bq + m] = Math.min(1, Math.max(0, ap[bq + m] / p)); }
    amp[q] = Math.min(1, p);
    const t = inicio + q * P;
    if (voz[q] / p >= .5) f0[q] = 440 * Math.pow(2, (alturaEn(t) - 69) / 12) * (pesoVoz[q] > 0 ? Math.exp(o.modulacion * tiembla[q] / pesoVoz[q]) : 1);
  }
  const y = world.sintetizar({ f0, sp: lsp, ap, fft, periodo: PERIODO, fs: sr });
  const x = new Float32Array(y.length);
  for (let i = 0; i < y.length; i++) {
    const u = i / sr / P, q = Math.min(cuadros - 2, Math.floor(u)), f = u - q, t = inicio + i / sr;
    x[i] = y[i] * (amp[q] * (1 - f) + amp[q + 1] * f) * ganancia(t);
  }
  return { x, sr, inicio, unidades: U.map(u => ({ alias: u.alias, archivo: u.e.archivo, T: +u.T.toFixed(3), S: +u.S.toFixed(3), E: +u.E.toFixed(3) })) };
}
