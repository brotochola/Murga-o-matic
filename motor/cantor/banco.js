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
import { guion, correr, esforzar } from './difonos.js';
import { ecualizar } from './eq.js';
import { CURVAS_BANCO } from './curvas_banco.js';

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
// los subbanks del character.yaml de OpenUtau: [{ color, prefijo, sufijo, rangos: [[desde, hasta], ...] }]. Un YAML
// chico, siempre con la misma forma: se lee línea por línea.
export function leerSubbancos(t) {
  const out = []; let dentro = false, sb = null;
  for (const l of t.split(/\r?\n/)) {
    if (/^﻿?subbanks\s*:/.test(l)) { dentro = true; continue; }
    if (!dentro) continue;
    if (/^\S/.test(l) && !/^-/.test(l)) break;       // otra clave de arriba: se terminó la lista
    const k = /^\s*(-\s*)?(color|prefix|suffix|tone_ranges)\s*:\s*(.*)$/.exec(l);
    if (k) {
      if (k[1] || !sb) { sb = { color: '', prefijo: '', sufijo: '', rangos: [] }; out.push(sb); }
      const v = k[3].trim().replace(/^["']|["']$/g, '');
      if (k[2] === 'color') sb.color = v; else if (k[2] === 'prefix') sb.prefijo = v; else if (k[2] === 'suffix') sb.sufijo = v;
      continue;
    }
    const r = /^\s*-\s*["']?([A-G][#b]?\d)(?:\s*-\s*([A-G][#b]?\d))?["']?\s*$/.exec(l);
    if (r && sb) { const a = notaDeNombre(r[1]), b = notaDeNombre(r[2] || r[1]); if (a != null && b != null) sb.rangos.push([Math.min(a, b), Math.max(a, b)]); }
  }
  return out;
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
  const nombre = rChar ? (/^name=(.*)$/im.exec(texto(leer(rChar)))?.[1] || '').trim() : '';
  const rYaml = rutas.find(r => r.toLowerCase() === 'character.yaml');
  const subbancos = rYaml ? leerSubbancos(texto(leer(rYaml))) : [];
  const indice = new Map();
  for (const e of entradas) if (!indice.has(e.alias)) indice.set(e.alias, e);
  // entradas cuyo .wav no está (un .zip japonés desarmado con los nombres mal, en Shift-JIS, queda así: ver zip.js)
  const hay = new Set(rutas.map(r => r.toLowerCase()));
  const sinArchivo = entradas.filter(e => !hay.has(e.archivo.toLowerCase())).length;
  // las capas del banco: cada altura grabada (o color) es un prefijo y un sufijo que se le ponen al alias («C3_» y
  // «» en los bancos de OpenUtau, «» y «_E4» en los de UTAU), con las notas que cubre. Salen de los subbanks del
  // character.yaml de OpenUtau o, si no hay, del prefix.map de UTAU.
  const capas = [];
  const capa = (prefijo, sufijo, color) => {
    let c = capas.find(x => x.prefijo === prefijo && x.sufijo === sufijo && x.color === color);
    if (!c) { c = { prefijo, sufijo, color, notas: new Set() }; capas.push(c); }
    return c;
  };
  for (const sb of subbancos) { const c = capa(sb.prefijo, sb.sufijo, sb.color); for (const [a, b] of sb.rangos) for (let m = a; m <= b; m++) c.notas.add(m); }
  if (!subbancos.length) for (const [m, { prefijo, sufijo }] of prefijos) capa(prefijo, sufijo, '').notas.add(m);
  // la nota grabada de cada capa: la que dice su nombre; si no (un falsete «_F»): si cubre hasta lo más agudo, su
  // nota más grave; si cubre hasta lo más grave, la más aguda; si no, la del medio
  const notaEn = s => notaDeNombre(String(s).replace(/^[_\s-]+/, '').replace(/[_\s-].*$/, ''));
  for (const c of capas) {
    const ms = [...c.notas].sort((a, b) => a - b);
    c.midi = notaEn(c.sufijo) ?? notaEn(c.prefijo) ?? (!ms.length ? 60 : ms[ms.length - 1] >= 100 ? ms[0] : ms[0] <= 25 ? ms[ms.length - 1] : ms[ms.length >> 1]);
    // supuesta: ni el nombre ni las notas dicen la altura (un banco de una sola altura, sin prefix.map): hay que medirla
    c.supuesta = notaEn(c.sufijo) == null && notaEn(c.prefijo) == null && !ms.length;
  }
  if (!capas.length) capas.push({ prefijo: '', sufijo: '', color: '', notas: new Set(), midi: 60, supuesta: true });
  const alturas = capas;
  const colores = new Set(capas.map(c => c.color).filter(Boolean));
  const sufijoDe = midi => (capas.find(c => c.notas.has(Math.round(midi))) || capas[0]).sufijo;
  // el pedazo para un alias en una nota: la capa que cubre esa nota (la del color pedido), o la más cercana que lo
  // tenga. evitar: sufijos, prefijos o colores que no se usan (por ejemplo el falsete, «_F»: un sobreprimo canta con
  // el pecho). color: un color del character.yaml o, si no, un sufijo que se prueba primero en cualquier nota (los
  // colores de MIKE, «_dp», grave, y «_sf», suave, que no están en su prefix.map)
  function buscar(alias, midi, evitar = null, color = null) {
    const m = Math.round(midi);
    if (color && !colores.has(color)) { const e = indice.get(alias + color); if (e) return e; }
    const quiero = color && colores.has(color) ? color : '';
    const fuera = c => evitar?.some(x => x && (x === c.sufijo || x === c.prefijo || x === c.color));
    const orden = capas.filter(c => !fuera(c))
      .map(c => ({ c, d: (c.notas.has(m) ? 0 : 100 + Math.abs(c.midi - m)) + (c.color === quiero ? 0 : 1000) }))
      .sort((a, b) => a.d - b.d);
    for (const { c } of orden) { const e = indice.get(c.prefijo + alias + c.sufijo); if (e) return e; }
    return indice.get(alias) || null;
  }
  const existe = new Set();
  for (const a of indice.keys()) {
    existe.add(a);
    for (const { prefijo, sufijo } of capas) {
      if ((prefijo || sufijo) && a.length > prefijo.length + sufijo.length && a.startsWith(prefijo) && a.endsWith(sufijo)) existe.add(a.slice(prefijo.length, a.length - sufijo.length));
    }
  }
  const wavs = new Map();
  function wav(archivo) {
    if (!wavs.has(archivo)) {
      const b = leer(archivo), w = b ? leerWav(b) : null;
      // el nivel del archivo: el de su 30 % más fuerte (de a 10 ms), que son las vocales. Cada altura (y a veces cada
      // archivo) se grabó a otro volumen; UTAU lo empareja normalizando
      if (w) {
        const W = Math.max(1, Math.round(.01 * w.sr)), e = [];
        for (let i = 0; i + W <= w.x.length; i += W) { let s = 0; for (let j = 0; j < W; j++) s += w.x[i + j] ** 2; e.push(s / W); }
        e.sort((p, q) => q - p);
        const k = Math.max(1, Math.round(e.length * .3)); let s = 0; for (let j = 0; j < k; j++) s += e[j];
        w.nivel = Math.sqrt(s / k) || 1e-3;
      }
      // (lo que no se pudo leer no se recuerda: en el navegador los .wav se leen del disco antes de cantar, y uno que
      // todavía no estaba puede llegar después; ver archivosQueUsa)
      if (!w) return null;
      wavs.set(archivo, w);
    }
    return wavs.get(archivo);
  }
  // la reclist: la de AkuP corta con «a R»; la CVVC castellana común (la del fonetizador silábico de OpenUtau), con
  // «a -»; la VCCV de nJokis, con «a-»
  const reclist = existe.has('か') && (existe.has('- あ') || existe.has('a あ')) ? 'japones'
    : existe.has('-b a') && existe.has('b a') ? 'brapa'
    : existe.has('-ka') && existe.has('a R') && existe.has('a rr') ? 'makku'
    : existe.has('a R') && existe.has('- a') ? 'akup' : existe.has('a -') && existe.has('- a') && existe.has('a b') ? 'cvvc' : 'njokis';
  return { nombre, entradas, indice, prefijos, alturas, buscar, existe: a => existe.has(a), wav, yaLeido: a => wavs.has(a), sufijoDe, reclist, sinArchivo };
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
  // (una copia: la reclist de AkuP le pasa la coda a la sílaba que sigue, y las notas son de quien llama)
  if (o.reclist === 'makku') o = { ...o, mapa: MK };
  const f = { akup: aliasAkup, cvvc: aliasCvvc, japones: aliasJapones, brapa: aliasBrapa }[o.reclist] || aliasNjokis;
  return f(notas.map(n => ({ ...n, sil: { ...n.sil } })), existe, o);
}

// ── un banco japonés CVVC (Vincen-oto): la sílaba en kana («か»), el paso de la vocal a la consonante en romaji
// («a k»), «- あ» para empezar con vocal, «a R» para cortar, «a い» entre vocales, «ai» el diptongo. Muchos traen
// además sonidos de otros idiomas: la l («la»), la rr («rra»), la zh («zha»), que es la ll/y rioplatense, y sus pasos
// («a l», «a s»). Lo que el japonés no tiene se acerca: la jota con la h japonesa, la s aspirada con un soplo («a hh»).
const KANA = {
  '': ['あ', 'い', 'う', 'え', 'お'], k: ['か', 'き', 'く', 'け', 'こ'], g: ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  s: ['さ', 'すぃ', 'す', 'せ', 'そ'], t: ['た', 'てぃ', 'とぅ', 'て', 'と'], d: ['だ', 'でぃ', 'どぅ', 'で', 'ど'],
  n: ['な', 'に', 'ぬ', 'ね', 'の'], x: ['は', 'ひ', 'ほぅ', 'へ', 'ほ'], b: ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
  p: ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'], m: ['ま', 'み', 'む', 'め', 'も'], r: ['ら', 'り', 'る', 'れ', 'ろ'],
  f: ['ふぁ', 'ふぃ', 'ふ', 'ふぇ', 'ふぉ'], C: ['ちゃ', 'ち', 'ちゅ', 'ちぇ', 'ちょ'], S: ['しゃ', 'し', 'しゅ', 'しぇ', 'しょ'],
  N: ['にゃ', 'に', 'にゅ', 'にぇ', 'にょ'], j: ['や', 'い', 'ゆ', 'いぇ', 'よ'], w: ['わ', 'うぃ', 'う', 'うぇ', 'うぉ'],
};
// consonante + y: きゃ, びゃ... (yōon)
// (sin t, d ni s: ちゃ, じゃ y しゃ son otra consonante; «dia» va «でぃ» + «i あ»)
const YOON = { k: 'き', g: 'ぎ', b: 'び', p: 'ぴ', m: 'み', r: 'り', n: 'に', x: 'ひ', C: 'ち' };
const YO = ['ゃ', null, 'ゅ', 'ぇ', 'ょ'];
// las sílabas que un banco japonés de siempre puede no tener, y la más parecida
const KANA_ALT = { 'ふぁ': 'は', 'ふぃ': 'ひ', 'ふぇ': 'へ', 'ふぉ': 'ほ', 'いぇ': 'え', 'ほぅ': 'ふ', 'すぃ': 'し', 'ずぃ': 'じ', 'てぃ': 'ち', 'とぅ': 'つ', 'でぃ': 'じ', 'どぅ': 'ず', 'うぃ': 'い', 'うぇ': 'え', 'うぉ': 'お' };
const LATINO = { l: 'l', R: 'rr', Z: 'zh' };                 // las sílabas con letras: «la», «rra», «zha»
const ROMAJI = { k: 'k', g: 'g', s: 's', t: 't', d: 'd', n: 'n', x: 'h', b: 'b', p: 'p', m: 'm', r: 'r', R: 'rr', l: 'l', f: 'f', C: 'ch', S: 'sh', Z: 'zh', N: 'n', j: 'y', w: 'w', h: 'hh' };
const SUAVE = { B: 'b', D: 'd', G: 'g', h: 's' };
const IV = { a: 0, i: 1, u: 2, e: 3, o: 4 };
function aliasJapones(notas, existe, o = {}) {
  const U = [], faltan = [];
  const pon = (alias, nota, tipo, extra) => { if (alias) U.push({ alias, nota, tipo, ...extra }); };
  const elegir = (...c) => { const a = c.find(x => x && existe(x)); if (!a && c[0]) faltan.push(c[0]); return a || null; };
  const fon = p => SUAVE[p] && p !== 'h' ? SUAVE[p] : p;     // b, d y g suaves: las de siempre
  // la sílaba de una consonante (nuestra) con una vocal
  const sil = (c, v) => {
    if (!c) return KANA[''][IV[v]];
    if (LATINO[c] && existe(LATINO[c] + v)) return LATINO[c] + v;
    if (c === 'Z') return sil('S', v);
    if (c === 'l') return sil('r', v);
    if (c === 'R') return sil('r', v);
    if (c === 'h') return sil('s', v);
    const k = KANA[c]?.[IV[v]] || KANA[''][IV[v]];
    return existe(k) || !KANA_ALT[k] ? k : KANA_ALT[k];
  };
  let antes = { tipo: 'silencio' };
  for (let i = 0; i < notas.length; i++) {
    const n = notas[i], sig = notas[i + 1], s = n.sil;
    const { desliz, vocs, cola } = nucleoDe(s);
    const K = s.ataque.map(fon), v1 = vocs[0];
    // el ataque: lo que no es la última consonante va solo (un grupo: «p» + «ら» no existe en japonés: la primera
    // consonante con su paso y la segunda como sílaba)
    const c0 = K[K.length - 1] || null;
    let cv = null, extra = [];
    if (desliz.length && c0 && desliz[0] === 'y' && YOON[c0] && YO[IV[v1]] && existe(YOON[c0] + YO[IV[v1]])) cv = YOON[c0] + YO[IV[v1]];
    else if (desliz.length && !c0) cv = sil(desliz[0] === 'y' ? 'j' : 'w', v1);
    else if (desliz.length) { cv = sil(c0, desliz[0] === 'y' ? 'i' : 'u'); extra = [desliz[0] === 'y' ? 'i' : 'u']; }
    else cv = sil(c0, v1);
    const paso = (v, c) => elegir(v + ' ' + ROMAJI[c], c === 'R' && v + ' r', c === 'l' && v + ' r');
    // en los bancos VCV la sílaba viene con la vocal de antes («a か») o con el silencio («- か»): una sola unidad
    if (antes.tipo === 'silencio') {
      if (!K.length && !desliz.length) cv = elegir('- ' + KANA[''][IV[v1]], KANA[''][IV[v1]]);
      else if (existe('- ' + cv)) cv = '- ' + cv;
    } else if (antes.tipo === 'vocal') {
      if (!K.length && !desliz.length) cv = elegir(antes.v + ' ' + KANA[''][IV[v1]], KANA[''][IV[v1]]);
      else if (existe(antes.v + ' ' + cv)) cv = antes.v + ' ' + cv;
      else if (K.length) pon(paso(antes.v, K[0]), i - 1, 'antes');
    } else if (antes.tipo === 'consonante') {
      if (!K.length && !desliz.length) cv = sil(antes.c, v1);
      else if (K.length && antes.c === 'n') pon(elegir('n ' + ROMAJI[K[0]]), i - 1, 'antes');
    }
    // los grupos (pr, bl, tr): la primera consonante, sola, con el paso de la vocal anterior; la segunda, sílaba
    if (K.length > 1 && antes.tipo === 'vocal') { /* el paso a K[0] ya está */ }
    pon(existe(cv) ? cv : elegir(cv), i, 'cv');
    // dentro de la nota: la vocal que sigue a una deslizada, las vocales que siguen y el diptongo
    let v = extra[0] || v1;
    for (const w of [...(extra.length ? [v1] : []), ...vocs.slice(1)]) { pon(elegir(v + ' ' + KANA[''][IV[w]]), i, 'medio', { frac: .3 }); v = w; }
    let dipt = null;
    if (cola.length) { const g = cola[0] === 'I' ? 'i' : 'u'; if (existe(v + g)) { dipt = v + g; pon(dipt, i, 'medio', { frac: .62 }); } else pon(elegir(v + ' ' + KANA[''][IV[g]]), i, 'medio', { frac: .62 }); v = g; }
    // la coda y el final
    let coda = s.coda.map(fon);
    const sigK0 = sig?.sil.ataque[0] ? fon(sig.sil.ataque[0]) : null;
    if (o.acento !== 0 && s.fin && sig && sigK0 && ['s', 'h'].includes(coda[coda.length - 1])) coda = coda.slice(0, -1);
    if (coda.length > 1) coda = [coda[0]];
    if (coda[0] === 'n' && ['p', 'b', 'm'].includes(sigK0)) coda[0] = 'm';
    const c = coda[0];
    if (!c) {
      if (!sig) pon(elegir((dipt || v) + ' R', v + ' R'), i, 'fin');
      antes = { tipo: 'vocal', v };
    } else {
      // la s aspirada de adentro de la palabra: un soplo («a hh»)
      const pc = c === 'h' || c === 's' && !s.fin ? elegir(v + ' hh', v + ' s') : paso(v, c);
      if (!sig) { pon(pc, i, 'antes'); pon(elegir(c === 'n' ? 'n R' : c === 'l' ? 'L R' : null), i, 'fin'); }
      else pon(pc, i, 'antes');
      antes = { tipo: 'consonante', c };
    }
  }
  U.faltan = faltan.filter(Boolean);
  return U;
}

// ── BRAPA, la reclist del portugués de Brasil (Sheep Cordeiro, KEI): la sílaba con un espacio («b a»), «-b a» al
// empezar con consonante, «- a» con vocal, «a b» de la vocal a la consonante, «a -» y «b -» al cortar, «a b-» la
// vocal con la consonante final. Tiene lo que el rioplatense necesita y el castellano de los bancos no: la r gutural
// («h»), que es la jota; la «j» ([ʒ]), que es la ll/y; la «sh». No tiene la rr de lengua: va la r simple.
const BR = { a: 'a', e: 'e', i: 'i', o: 'o', u: 'u', l: 'l', r: 'r', R: 'r', m: 'm', n: 'n', N: 'nh', B: 'b', D: 'd', G: 'g', b: 'b', d: 'd', g: 'g', p: 'p', t: 't', k: 'k', C: 'ch', f: 'f', s: 's', h: 'h', x: 'h', S: 'sh', Z: 'j', j: 'y', w: 'w' };
function aliasBrapa(notas, existe, o = {}) {
  const U = [], faltan = [];
  const pon = (alias, nota, tipo, extra) => { if (alias) U.push({ alias, nota, tipo, ...extra }); };
  const elegir = (...c) => { const a = c.find(x => x && existe(x)); if (!a && c[0]) faltan.push(c[0]); return a || null; };
  let antes = { tipo: 'silencio' };
  for (let i = 0; i < notas.length; i++) {
    const n = notas[i], sig = notas[i + 1], s = n.sil;
    const { desliz, vocs, cola } = nucleoDe(s);
    const K = s.ataque.map(p => BR[p] || p), v1 = vocs[0];
    // la deslizada: «bien» = «b i» + «i e» (o «y e»)
    const vAtaque = desliz.length ? (desliz[0] === 'y' ? 'i' : 'u') : v1;
    const c0 = K[K.length - 1];
    // los grupos (pr, bl): la primera consonante con su paso o sola, la segunda con la vocal
    if (antes.tipo === 'silencio') {
      if (!K.length) pon(elegir('- ' + vAtaque, vAtaque), i, 'cv');
      else {
        if (K.length > 1) pon(elegir('- ' + K[0]), i, 'antes');
        pon(elegir('-' + c0 + ' ' + vAtaque, c0 + ' ' + vAtaque), i, 'cv');
      }
    } else if (antes.tipo === 'vocal') {
      if (!K.length) pon(elegir(antes.v + ' ' + vAtaque, vAtaque), i, 'cv');
      else { pon(elegir(antes.v + ' ' + K[0]), i - 1, 'antes'); pon(elegir(c0 + ' ' + vAtaque), i, 'cv'); }
    } else {
      if (!K.length) pon(elegir(antes.c + ' ' + vAtaque, vAtaque), i, 'cv');
      else pon(elegir(c0 + ' ' + vAtaque), i, 'cv');
    }
    let v = vAtaque;
    for (const w of [...(desliz.length ? [v1] : []), ...vocs.slice(1), ...cola.map(g => g === 'I' ? 'i' : 'u')]) {
      // de una vocal a otra: el paso, o (si es una deslizada) «y i» / «w u», o la vocal sola
      pon(elegir(v + ' ' + w, w === 'i' ? 'y i' : w === 'u' ? 'w u' : null, w), i, 'medio', { frac: w === v1 && desliz.length ? .3 : .62 }); v = w;
    }
    let coda = s.coda.map(p => BR[p] || p);
    const sigK0 = sig?.sil.ataque[0] ? BR[sig.sil.ataque[0]] : null;
    if (o.acento !== 0 && s.fin && sig && sigK0 && ['s', 'h'].includes(coda[coda.length - 1])) coda = coda.slice(0, -1);
    if (coda.length > 1) coda = [coda[0]];
    if (coda[0] === 'n' && ['p', 'b', 'm'].includes(sigK0)) coda[0] = 'm';
    const c = coda[0];
    if (!c) {
      if (!sig) pon(elegir(v + ' -'), i, 'fin');
      antes = { tipo: 'vocal', v };
    } else if (!sig) {
      pon(elegir(v + ' ' + c + '-', v + ' ' + c), i, 'fin');
      antes = { tipo: 'silencio' };
    } else {
      pon(elegir(v + ' ' + c), i, 'antes');
      antes = { tipo: 'consonante', c };
    }
  }
  U.faltan = faltan;
  return U;
}

// ── la CVVC castellana común (Sheep Oveja; la del fonetizador silábico de OpenUtau): «- a» o «- l» al empezar, «a b»
// + «ba», la consonante sola en los grupos («p» + «ra»), «a -» y «b -» al cortar, «a e» entre vocales. La deslizada
// va como vocal («bien» = «bi» + «i e»). La jota es «j», la s aspirada «h», la ñ «nh» y la ll/y rioplatense «ll».
const CV_ = { a: 'a', e: 'e', i: 'i', o: 'o', u: 'u', l: 'l', r: 'r', R: 'rr', m: 'm', n: 'n', N: 'nh', B: 'b', D: 'd', G: 'g', b: 'b', d: 'd', g: 'g', p: 'p', t: 't', k: 'k', C: 'ch', f: 'f', s: 's', h: 'h', x: 'j', S: 'll', Z: 'll', j: 'y', w: 'w' };
function aliasCvvc(notas, existe, o = {}) {
  const U = [], faltan = [];
  const pon = (alias, nota, tipo, extra) => { if (alias) U.push({ alias, nota, tipo, ...extra }); };
  const elegir = (...c) => { const a = c.find(x => x && existe(x)); if (!a && c[0]) faltan.push(c[0]); return a || null; };
  let antes = { tipo: 'silencio' };
  for (let i = 0; i < notas.length; i++) {
    const n = notas[i], sig = notas[i + 1], s = n.sil;
    const { desliz, vocs, cola } = nucleoDe(s);
    const K = s.ataque.map(p => CV_[p] || p);
    // la deslizada de antes de la vocal, como vocal: «bien» = «bi» + «i e», «bueno» = «bu» + «u e»
    const vs = [...desliz.map(d => (d === 'y' ? 'i' : 'u')), ...vocs], v1 = vs[0];
    const ultimaK = K[K.length - 1];
    // la sílaba: la última consonante con la vocal; las de antes (un grupo), solas («p» + «ra»)
    const silaba = () => { for (const c of K.slice(0, -1)) pon(['' + c].find(existe) || null, i, 'antes'); pon(elegir(ultimaK + v1, v1), i, 'cv'); };
    if (antes.tipo === 'silencio') {
      if (!K.length) pon(elegir('- ' + v1, v1), i, 'cv');
      else { pon(['- ' + K[0]].find(existe) || null, i, 'antes'); silaba(); }
    } else if (antes.tipo === 'vocal') {
      if (!K.length) pon(elegir(antes.v + ' ' + v1, v1), i, 'cv');
      else { pon(elegir(antes.v + ' ' + K[0]), i - 1, 'antes'); silaba(); }
    } else {
      if (!K.length) pon(elegir(antes.c + v1, v1), i, 'cv');
      else silaba();
    }
    // dentro de la nota: las vocales que siguen y el diptongo
    let v = v1;
    for (const w of [...vs.slice(1), ...cola.map(g => g.toLowerCase())]) { pon(elegir(v + ' ' + w), i, 'medio', { frac: vs.length > 1 && w === vs[1] ? .3 : .62 }); v = w; }
    // la coda y el final
    let coda = s.coda.map(p => CV_[p] || p);
    const sigK0 = sig?.sil.ataque[0] ? CV_[sig.sil.ataque[0]] : null;
    if (o.acento !== 0 && s.fin && sig && sigK0 && ['s', 'h'].includes(coda[coda.length - 1])) coda = coda.slice(0, -1);
    if (coda.length > 1) coda = [coda[0]];
    if (coda[0] === 'n' && ['p', 'b', 'm'].includes(sigK0)) coda[0] = 'm';
    const c = coda[0];
    if (!c) {
      if (!sig) pon(elegir(v + ' -', v + '-'), i, 'fin');
      antes = { tipo: 'vocal', v };
    } else {
      pon(elegir(v + ' ' + c), i, 'antes');
      if (!sig) pon(elegir(c + ' -'), i, 'fin');
      antes = { tipo: 'consonante', c };
    }
  }
  U.faltan = faltan;
  return U;
}

// el núcleo de una sílaba: deslizadas de antes (y, w), vocales, deslizadas de después (I, U)
function nucleoDe(s) {
  const nuc = s.nucleo.length ? s.nucleo : ['a'];
  let k0 = nuc.findIndex(p => VOCAL.has(p)); if (k0 < 0) k0 = nuc.length - 1;
  const desliz = nuc.slice(0, k0).map(p => (p === 'j' || p === 'i' ? 'y' : 'w'));
  const vocs = [], aVocal = p => (p === 'j' ? 'i' : p === 'w' ? 'u' : p);
  let k1 = k0; while (k1 < nuc.length && (k1 === k0 || VOCAL.has(nuc[k1]))) vocs.push(aVocal(nuc[k1++]));
  const cola = nuc.slice(k1).map(p => (p === 'j' || p === 'i' ? 'I' : 'U'));
  return { desliz, vocs, cola };
}

// ── la reclist de AkuP (MIKE): «- ba» al empezar, «a m» + «ma», la coda junto con la consonante que sigue («an t»,
// «as k», «ar t»), el final con «a R» o «as R», la r simple de a dos vocales («a ra»), la ñ como «nh», la jota como
// «j». Sin b, d y g suaves: van las de siempre. La sh rioplatense (ll, y) va como «y». El diptongo se junta con la
// consonante que sigue («aI m»), como dice su readme: «hay mas» = [- a][aI m][ma][as R].
const AK = { a: 'a', e: 'e', i: 'i', o: 'o', u: 'u', l: 'l', r: 'r', R: 'rr', m: 'm', n: 'n', N: 'nh', B: 'b', D: 'd', G: 'g', b: 'b', d: 'd', g: 'g', p: 'p', t: 't', k: 'k', C: 'ch', f: 'f', s: 's', h: 's', x: 'j', S: 'y', Z: 'y', j: 'y', w: 'w' };
function aliasAkup(notas, existe, o = {}) {
  const U = [], faltan = [];
  const pon = (alias, nota, tipo, extra) => { if (alias) U.push({ alias, nota, tipo, ...extra }); };
  const elegir = (...c) => { const a = c.find(x => x && existe(x)); if (!a && c[0]) faltan.push(c[0]); return a || null; };
  let antes = { tipo: 'silencio' };
  for (let i = 0; i < notas.length; i++) {
    const n = notas[i], sig = notas[i + 1], s = n.sil;
    const { desliz, vocs, cola } = nucleoDe(s);
    const K = [...s.ataque.map(p => AK[p] || p), ...desliz], v1 = vocs[0], k = K.join('');
    // 1. la entrada
    if (antes.tipo === 'listo') {
      // la coda de antes ya trajo la consonante («an t»): sólo la sílaba
      pon(elegir(k + v1, K[0] + v1), i, 'cv');
    } else if (antes.tipo === 'silencio') {
      if (!K.length) pon(elegir('- ' + v1, v1), i, 'cv');
      else if (existe('- ' + k + v1)) pon('- ' + k + v1, i, 'cv');
      else if (K[0] === 'r' && existe('- rr' + K.slice(1).join('') + v1)) pon('- rr' + K.slice(1).join('') + v1, i, 'cv');
      else { pon(['- ' + K[0]].find(existe) || null, i, 'antes'); pon(elegir(k + v1, K[0] + v1), i, 'cv'); }
    } else if (antes.tipo === 'vocal') {
      const v = antes.v;
      if (!K.length) pon(elegir(v + ' ' + v1, v1), i, 'cv');
      else if (K.length === 1 && (K[0] === 'r' || K[0] === 'y') || K[0] === 'r' && (K[1] === 'y' || K[1] === 'w')) {
        // la r simple y la y van de a dos vocales: «a ra», «a ya»
        pon(elegir(v + ' ' + k + v1, k + v1), i, 'cv');
      } else { pon(elegir(v + ' ' + K[0]), i - 1, 'antes'); pon(elegir(k + v1, K[0] + v1), i, 'cv'); }
    } else pon(elegir(k + v1, K[0] + v1, v1), i, 'cv');
    // 2. dentro de la nota: dos vocales (sinalefa)
    let v = v1;
    for (const w of vocs.slice(1)) { pon(elegir(v + ' ' + w), i, 'medio', { frac: .4 }); v = w; }
    let diptongo = cola.length ? v + cola[cola.length - 1] : null;   // «aI»: se junta con lo que sigue
    // 3. la coda y el final
    let coda = s.coda.map(p => AK[p] || p);
    const sigK = sig ? [...sig.sil.ataque.map(p => AK[p] || p), ...nucleoDe(sig.sil).desliz] : null, sigK0 = sigK?.[0] || null;
    if (o.acento !== 0 && s.fin && sig && sigK0 && coda[coda.length - 1] === 's') coda = coda.slice(0, -1);
    if (coda.length > 1) coda = [coda[0]];
    if (coda[0] === 'n' && ['p', 'b', 'm'].includes(sigK0)) coda[0] = 'm';
    let c = coda[0];
    if (c && diptongo) { pon(elegir(v + ' ' + cola[0].toLowerCase()), i, 'medio', { frac: .62 }); diptongo = null; v = cola[0].toLowerCase(); }
    if (c === 'r' && sig && !sigK0) { c = null; sig.sil = { ...sig.sil, ataque: ['r', ...sig.sil.ataque] }; }   // «ve-ra»
    if (!c) {
      const vf = diptongo || v;
      if (!sig) pon(elegir(vf + ' R', v + ' R'), i, 'fin');
      else if (diptongo && sigK0) { pon(elegir(diptongo + ' ' + sigK0) || elegir(v + ' ' + cola[0].toLowerCase()), i, 'antes'); antes = existe(diptongo + ' ' + sigK0) ? { tipo: 'listo' } : { tipo: 'vocal', v: cola[0].toLowerCase() }; continue; }
      else if (diptongo) { pon(elegir(v + ' ' + cola[0].toLowerCase()), i, 'medio', { frac: .62 }); v = cola[0].toLowerCase(); }
      antes = { tipo: 'vocal', v };
    } else if (!sig) {
      pon(elegir(v + c + ' R', v + ' ' + c), i, 'fin');
      antes = { tipo: 'silencio' };
    } else if (sigK0) {
      // la coda con la consonante que sigue («an t»); si no está, la vocal a la coda («a n») y después la sílaba
      if (existe(v + c + ' ' + sigK0)) { pon(v + c + ' ' + sigK0, i, 'antes'); antes = { tipo: 'listo' }; }
      else { pon(elegir(v + ' ' + c), i, 'antes'); antes = { tipo: 'consonante', c }; }
    } else {
      // la coda antes de vocal pasa a la sílaba que sigue («e-la-mor»)
      pon(elegir(v + ' ' + c), i, 'antes');
      sig.sil = { ...sig.sil, ataque: [c === 'nh' ? 'N' : c === 'rr' ? 'R' : c === 'j' ? 'x' : c === 'y' ? 'Z' : c] };
      antes = { tipo: 'consonante', c };
    }
  }
  U.faltan = faltan;
  return U;
}

// ── la italiana CVVC de MakkuPizza (Sanfu) es casi la de nJokis: «-ka», «a k» + «ka», «pr» + «_ra». Cambia el final
// («a R», y «al-» para una coda al final) y los sonidos: la rr de verdad («a rr» + «ra»), la ñ «gn», la sh «S», la ch
// «tS»; sin b, d y g suaves. La ll/y rioplatense va como «S»; la jota, que el italiano no tiene, como «k».
const MK = { a: 'a', e: 'e', i: 'i', o: 'o', u: 'u', l: 'l', r: 'r', R: 'rr', m: 'm', n: 'n', N: 'gn', B: 'b', D: 'd', G: 'g', b: 'b', d: 'd', g: 'g', p: 'p', t: 't', k: 'k', C: 'tS', f: 'f', s: 's', h: 's', x: 'k', S: 'S', Z: 'S', j: 'y', w: 'w' };

function aliasNjokis(notas, existe, o = {}) {
  const MAPA = o.mapa || NJ;
  const U = [], faltan = [];
  const pon = (alias, nota, tipo, extra) => { if (alias) U.push({ alias, nota, tipo, ...extra }); };
  // el primero que tenga el banco; si ninguno, se anota el que se quería
  const elegir = (...c) => { const a = c.find(x => x && existe(x)); if (!a && c[0]) faltan.push(c[0]); return a || null; };
  // una sílaba: la consonante con su vocal. En nJokis b, d y g oclusivas sólo están después de un silencio («-ba»):
  // después de una nasal se usan esas, y si no, las suaves
  const cv = (k, v) => elegir(k + v, '_' + k + v, '-' + k + v, FRICATIVA[k] && FRICATIVA[k] + v, OCLUSIVA[k] && '-' + OCLUSIVA[k] + v, k === 'rr' && 'r' + v);
  // (después de un diptongo: «I p» en nJokis, «i p» en la italiana)
  const paso = (c, k) => elegir(c + ' ' + k, (FRICATIVA[k] || OCLUSIVA[k]) && c + ' ' + (FRICATIVA[k] || OCLUSIVA[k]), c !== c.toLowerCase() && c.toLowerCase() + ' ' + k);
  let antes = { tipo: 'silencio' };
  for (let i = 0; i < notas.length; i++) {
    const n = notas[i], sig = notas[i + 1], s = n.sil;
    const nuc = s.nucleo.length ? s.nucleo : ['a'];
    let k0 = nuc.findIndex(p => VOCAL.has(p)); if (k0 < 0) k0 = nuc.length - 1;
    const desliz = nuc.slice(0, k0).map(p => (p === 'j' || p === 'i' ? 'y' : 'w'));
    const vocs = [], aVocal = p => (p === 'j' ? 'i' : p === 'w' ? 'u' : p);
    let k1 = k0; while (k1 < nuc.length && (k1 === k0 || VOCAL.has(nuc[k1]))) vocs.push(aVocal(nuc[k1++]));
    const cola = nuc.slice(k1).map(p => (p === 'j' || p === 'i' ? 'I' : 'U'));
    const K = [...s.ataque.map(p => MAPA[p] || p), ...desliz], v1 = vocs[0];
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
    let coda = s.coda.map(p => MAPA[p] || p);
    const sigK0 = sig ? (sig.sil.ataque[0] ? MAPA[sig.sil.ataque[0]] : null) : null;
    // acento rioplatense: la s del final de la palabra antes de consonante no se canta («lo gurise corren»)
    if (o.acento !== 0 && s.fin && sig && sigK0 && coda[coda.length - 1] === 's') coda = coda.slice(0, -1);
    if (coda.length > 1) coda = [coda[0]];
    if (coda[0] === 'n' && ['p', 'b', 'B', 'm'].includes(sigK0)) coda[0] = 'm';
    const c = coda[0];
    if (!c) {
      if (!sig) pon(elegir(v + '-', v + '--', v.toLowerCase() + '-', v + ' R', v.toLowerCase() + ' R'), i, 'fin');
      antes = { tipo: 'vocal', v };
    } else if (!sig && existe(v + c + '-')) {
      pon(v + c + '-', i, 'fin');   // la vocal con la coda al final, de una («al-», en la italiana)
      antes = { tipo: 'silencio' };
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
  // que un paso (o el final) no se coma la vocal anterior: empieza, como muy temprano, a mitad de camino desde la
  // última sílaba
  let fijo = -Infinity;
  for (let k = 0; k < U.length; k++) {
    const u = U[k];
    if (u.tipo !== 'antes' && u.tipo !== 'fin') { fijo = Math.max(fijo, u.T); continue; }
    if (fijo === -Infinity) continue;
    const sig = U.slice(k + 1).find(x => x.tipo !== 'antes'), hasta = u.tipo === 'fin' ? u.T : sig ? sig.T - sig.pre / 1000 : u.T + .05;
    const minS = fijo + (u.tipo === 'fin' ? .5 : .45) * Math.max(0, hasta - fijo);
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
    // el final: como mucho un cuarto de segundo después de cortar la vocal. Si el banco no tiene con qué terminar
    // (un banco CV), la última sílaba se estira hasta el final de su nota
    if (!s && u.tipo === 'fin') u.E = Math.min(u.E, u.T + .25);
    else if (!s && (u.tipo === 'cv' || u.tipo === 'medio')) u.E = Math.max(u.S + .05, notas[u.nota].t1);
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

// las frases de un cantor (notas ligadas) y, en cada una, sus unidades con el pedazo del banco que le toca
function frasesDe(banco, notas, o) {
  const frases = [[]];
  notas.forEach((n, i) => { if (i && n.t0 - notas[i - 1].t1 >= .02) frases.push([]); frases[frases.length - 1].push(n); });
  return frases.map(F => {
    const U = aliasFrase(F, banco.existe, { reclist: banco.reclist, ...o });
    // capa: una grabación entera del banco, con otro color (MIKE grave «_dp»). No es el `color` de difonos.js (las
    // ondas del timbre de cada cantor de MBROLA), que llega en las mismas opciones. esfuerzo (semitonos, el SHFT de
    // OpenUtau): la grabación de una altura más aguda que la nota (más esforzada) o más grave (más relajada)
    for (const u of U) u.e = banco.buscar(u.alias, F[u.nota].midi + (o.esfuerzo || 0), o.evitar, o.capa);
    return { F, U };
  });
}
// los .wav que va a usar un cantor: en el navegador se leen del disco antes de cantar (bancos.js), porque
// cantarBanco los pide de una
export function archivosQueUsa(banco, notas, opc = {}) {
  const o = { ...opc };
  const s = new Set();
  for (const { U } of frasesDe(banco, correr(notas, o), o)) for (const u of U) if (u.e) s.add(u.e.archivo);
  return [...s];
}

// notas: [{t0, t1, midi, vel, sil}] como en difonos.js. Devuelve { x, sr, inicio }.
export function cantarBanco(banco, world, notas, opc = {}) {
  const o = { modulacion: 1, cache: new Map(), ...opc };
  if (!notas.length) return { x: new Float32Array(0), sr: 44100, inicio: 0 };
  // cada cantor entra un poco tarde y corre un poco cada nota, como los de difonos (retraso, desfase)
  notas = correr(notas, o);
  const g = guion(notas, o);
  // la altura de guion(), una sola pasada en orden (tiene estado: la fase del vibrato)
  const tA0 = g.inicio, nA = Math.ceil((g.fin + .5 - tA0) / (PERIODO / 1000)) + 2, alt = new Float64Array(nA);
  for (let k = 0; k < nA; k++) alt[k] = g.altura(tA0 + k * PERIODO / 1000);
  const alturaEn = t => { const x = (t - tA0) / (PERIODO / 1000), k = Math.max(0, Math.min(nA - 2, Math.floor(x))), f = Math.max(0, Math.min(1, x - k)); return alt[k] * (1 - f) + alt[k + 1] * f; };
  const piezas = [], faltan = [];
  let sr = 44100;
  for (const { F, U } of frasesDe(banco, notas, o)) {
    faltan.push(...U.faltan);
    for (const u of U) {
      if (!u.e) { faltan.push(u.alias); continue; }
      const w = banco.wav(u.e.archivo); if (w) sr = w.sr;
      // dicción (consonantes, el VEL de UTAU al revés): la parte fija del pedazo (la consonante y el paso a la vocal)
      // más larga (más de 1) o más corta; el preutterance y el overlap, con ella
      const k = Math.max(.5, Math.min(2, o.consonantes ?? 1));
      u.k = k; u.lenSrc = largoDe(u.e, w); u.consSrc = Math.min(u.e.consonante, u.lenSrc);
      u.cons = u.consSrc * k; u.len = u.lenSrc + u.consSrc * (k - 1); u.pre = u.e.pre * k; u.ovl = Math.max(0, u.e.overlap) * k;
      // normalizar (0 a 1): cuánto se lleva cada archivo al mismo nivel
      u.lg = w ? 2 * (o.normalizar ?? 1) * Math.log(.1 / w.nivel) : 0;
    }
    const V = U.filter(u => u.e);
    if (!V.length) continue;
    ubicar(V, F);
    const p = sintetizarFrase(V, banco, world, o, alturaEn, g.ganancia);
    // el grito, como los cantores de difonos (esforzar(): la boca más abierta, la voz apretada y pareja), sobre la voz
    // ya sintetizada
    if (o.grito > 0) esforzar(p.x, p.sr, { ...g, inicio: p.inicio }, o);
    // el color de esta voz contra el coro real (curvas_banco.js, de herramientas/curva_bancos.mjs), en la proporción
    // colorReal (0 a 1; por defecto entera). Cambia el color, no el volumen del cantor.
    const curva = o.curva ?? CURVAS_BANCO[`${o.banco}|${o.capa || ''}`], cr = o.colorReal ?? 1;
    if (curva && cr > 0) {
      let e0 = 0; for (const v of p.x) e0 += v * v;
      const y = ecualizar(p.x, p.sr, cr === 1 ? curva : curva.map(([f, db]) => [f, db * cr]));
      let e1 = 0; for (const v of y) e1 += v * v;
      const k = e1 > 0 ? Math.sqrt(e0 / e1) : 1; for (let i = 0; i < y.length; i++) p.x[i] = y[i] * k;
    }
    piezas.push(p);
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
  const A = U.map(u => { const a = analisis(o.cache, world, banco, u.e, u.lenSrc); if (a) { ancho = a.ancho; fft = a.fft; sr = a.sr; } return a; });
  const lsp = new Float64Array(cuadros * ancho), ap = new Float64Array(cuadros * ancho), peso = new Float64Array(cuadros);
  const voz = new Float64Array(cuadros), tiembla = new Float64Array(cuadros), pesoVoz = new Float64Array(cuadros);
  U.forEach((u, k) => {
    const a = A[k]; if (!a || a.ancho !== ancho) return;
    const L = u.E - u.S, cons = u.cons / 1000, consS = u.consSrc / 1000, lenS = u.lenSrc / 1000, ult = k === U.length - 1;
    const entra = k === 0 ? Math.max(.01, u.ovl / 1000) : U[k - 1].fundir, sale = ult ? .06 : u.fundir;
    const q0 = Math.max(0, Math.ceil((u.S - inicio) / P)), q1 = Math.min(cuadros - 1, Math.floor((u.E - inicio) / P));
    for (let q = q0; q <= q1; q++) {
      const t = inicio + q * P, d = t - u.S;
      // el tiempo dentro del pedazo
      let src;
      // la parte fija va con la dicción (d / k); el final, después, a su velocidad y cortado; lo demás se estira
      if (u.tipo === 'fin' || ult && u.tipo === 'antes') src = d <= cons ? d / u.k : consS + (d - cons);
      else if (L >= cons) src = d <= cons ? d / u.k : consS + (d - cons) * Math.max(0, lenS - consS) / Math.max(1e-3, L - cons);
      else src = d * consS / L;
      const ms = u.e.offset + src * 1000, x = (ms - a.t0) / PERIODO, j = Math.max(0, Math.min(a.cuadros - 2, Math.floor(x))), f = Math.max(0, Math.min(1, x - j));
      let w = Math.min(1, d / entra, (u.E - t) / sale);
      if (w <= 0) continue;
      w = .5 - .5 * Math.cos(Math.PI * w);
      const b0 = j * ancho, b1 = (j + 1) * ancho, bq = q * ancho;
      for (let m = 0; m < ancho; m++) {
        lsp[bq + m] += w * (a.lsp[b0 + m] * (1 - f) + a.lsp[b1 + m] * f + u.lg);
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
  // la garganta (tracto, como en difonos.js): más de 1, una garganta más corta, con los formantes más arriba; la
  // envolvente y el aire se corren en frecuencia, la altura no
  const a = o.tracto || 1, filaL = new Float64Array(ancho), filaA = new Float64Array(ancho);
  // la voz, como los flags de los resamplers de UTAU (docs/plan_cantantes.md):
  //   tensión (Mt): la voz apretada, menos fundamental y más agudos: 4 dB por octava × tensión, alrededor de 1 kHz
  //     (de −6 dB en 350 Hz a +9 dB en 5 kHz con tensión 1); negativa, más floja;
  //   aire (BRE, Mb): el aire de WORLD sube arriba de 300 Hz, hasta todo aire en 2 kHz con aire 1;
  //   ronquera (MG, MC): la voz rajada: la altura tiembla rápido (hasta ±3,5 % con 1), un poco de ruido entre 1 y
  //     5 kHz, y después de sintetizar, un subarmónico (el volumen sube y baja a la mitad de la altura).
  const tension = o.tension || 0, aire = Math.max(0, Math.min(1, o.aire || 0)), ronq = Math.max(0, Math.min(1, o.ronquera || 0));
  const suave = (x, a, b) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const gT = new Float64Array(ancho), sA = new Float64Array(ancho), sR = new Float64Array(ancho);
  for (let m = 0; m < ancho; m++) {
    const fr = Math.max(1, m * sr / fft);
    gT[m] = 4 * tension * Math.max(-1.5, Math.min(2.3, Math.log2(fr / 1000))) * Math.LN10 / 10;
    sA[m] = aire * suave(fr, 300, 2000);
    sR[m] = .35 * ronq * suave(fr, 1000, 2500) * (1 - suave(fr, 5000, 8000));
  }
  let azar = (o.semilla || 1) * 2654435761 >>> 0, jit = 0;
  const rnd = () => { azar = (Math.imul(azar ^ (azar >>> 15), 2246822519) + 3266489917) >>> 0; return azar / 4294967296 - .5; };
  for (let q = 0; q < cuadros; q++) {
    const bq = q * ancho, p = peso[q];
    if (p < 1e-6) { for (let m = 0; m < ancho; m++) { lsp[bq + m] = Math.exp(-46); ap[bq + m] = 1; } continue; }
    if (a !== 1) {
      for (let m = 0; m < ancho; m++) { filaL[m] = lsp[bq + m]; filaA[m] = ap[bq + m]; }
      for (let m = 0; m < ancho; m++) { const x = Math.min(ancho - 1, m / a), j = Math.min(ancho - 2, Math.floor(x)), f = x - j; lsp[bq + m] = filaL[j] * (1 - f) + filaL[j + 1] * f; ap[bq + m] = filaA[j] * (1 - f) + filaA[j + 1] * f; }
    }
    for (let m = 0; m < ancho; m++) {
      lsp[bq + m] = Math.exp(lsp[bq + m] / p + gT[m]);
      const v = Math.min(1, Math.max(0, ap[bq + m] / p));
      ap[bq + m] = 1 - (1 - v) * (1 - sA[m]) * (1 - sR[m]);
    }
    amp[q] = Math.min(1, p);
    const t = inicio + q * P;
    jit = .4 * jit + .6 * rnd() * 2;
    if (voz[q] / p >= .5) f0[q] = 440 * Math.pow(2, (alturaEn(t) - 69) / 12) * (pesoVoz[q] > 0 ? Math.exp(o.modulacion * tiembla[q] / pesoVoz[q]) : 1) * Math.exp(.035 * ronq * jit);
    if (o.depurar) o.depurar.push({ t: +t.toFixed(3), peso: +p.toFixed(2), voz: +(voz[q] / p).toFixed(2), f0: +f0[q].toFixed(1), db: +(10 * Math.log10(lsp.subarray(bq, bq + ancho).reduce((s, v) => s + v, 0))).toFixed(1) });
  }
  const y = world.sintetizar({ f0, sp: lsp, ap, fft, periodo: PERIODO, fs: sr });
  const x = new Float32Array(y.length);
  let fase = 0;
  for (let i = 0; i < y.length; i++) {
    const u = i / sr / P, q = Math.min(cuadros - 2, Math.floor(u)), f = u - q, t = inicio + i / sr;
    let v = y[i] * (amp[q] * (1 - f) + amp[q + 1] * f) * ganancia(t);
    // el subarmónico de la ronquera: el volumen sube y baja a la mitad de la altura (un período fuerte, uno flojo)
    if (ronq > 0) { const fq = f0[q] > 0 && f0[q + 1] > 0 ? f0[q] * (1 - f) + f0[q + 1] * f : 0; if (fq > 0) { fase += Math.PI * fq / sr; v *= 1 + .5 * ronq * Math.cos(fase); } }
    x[i] = v;
  }
  return { x, sr, inicio, unidades: U.map(u => ({ alias: u.alias, archivo: u.e.archivo, T: +u.T.toFixed(3), S: +u.S.toFixed(3), E: +u.E.toFixed(3) })) };
}
