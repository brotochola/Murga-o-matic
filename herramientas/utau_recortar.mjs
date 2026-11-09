// utau_recortar.mjs — los bancos de UTAU recortados para la versión liviana (herramientas/construir.mjs): sólo los .wav
// que la página puede llegar a usar y, de cada uno, sólo el pedazo que marcan sus oto.ini (con margen).
//
// Qué puede usar la página: las sílabas de muchas murgas (el letrista local, con todas las formas, estilos, tonos,
// modos y temas, el lailareo y un texto con las sílabas del castellano, por los versos escritos a mano), con cada voz
// del plantel en cada lugar, en todas las alturas a las que llega (sus notas, con el «Esfuerzo» de −5 a +7 y la
// afinación). Los oto.ini quedan enteros, con los tiempos corridos: así las sílabas se reparten igual que con el banco
// entero, y una que no quedó se busca en otra altura (banco.js). El nivel de cada .wav va anotado en murga_niveles.txt
// (el de un .wav recortado daría otro). Después, cada .wav va en Opus (96 kbps): el archivo se sigue llamando .wav
// (el oto.ini no cambia) y la página lo decodifica con WebCodecs (motor/cantor/opus.js).
//
// La prueba, banco por banco: el recortado (con sus .wav) tiene las mismas entradas, reclist y alturas; las mismas
// murgas le piden los mismos pedazos; y unas frases cantadas con los dos dan lo mismo. Con Opus: cuánto cambian esas
// frases (el espectro por bandas, en dB), y las frases con .wav y con Opus en murga_trabajo/utau/opus_ab/, para
// escuchar.
//
//   node herramientas/utau_recortar.mjs [--bancos carpeta] [--salida carpeta] [--piezas 60] [--kbps 96] [--wav] [banco.zip ...]
//   (por defecto, de bancos/ a offline/bancos/, la versión liviana; los de bancos/ no se tocan. --wav: sin Opus)
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync, renameSync, rmSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { archivosDelBanco, RAIZ } from './banco_node.mjs';
import { escribirZip } from './zip_escribir.mjs';
import { SALIDA } from './liviana.mjs';
import { crearBanco, frasesDe, cantarBanco, texto, NIVELES } from '../motor/cantor/banco.js';
import { correr } from '../motor/cantor/difonos.js';
import { medirAlturas } from '../motor/cantor/bancos.js';
import { crearWorld } from '../motor/cantor/world.js';
import { prepararMurga, repartir, LUGARES } from '../motor/cantor/murga_bancos.js';
import { CLAVES } from '../motor/cantor/lexico.js';
import { MODELO } from '../motor/modelo.js';

const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const DE = resolve(arg('bancos', join(RAIZ, 'bancos'))), A = resolve(arg('salida', join(SALIDA, 'bancos')));
const N = +arg('piezas', 60);
const SOLO_WAV = args.includes('--wav'), KBPS = arg('kbps', '96') + 'k';
const AB = resolve(arg('ab', join(RAIZ, 'murga_trabajo', 'utau', 'opus_ab')));   // frases con .wav y con Opus, para escuchar
const PL = JSON.parse(readFileSync(join(RAIZ, 'bancos', 'plantel.json'), 'utf8'));
const SIN_VALOR = new Set(['--wav']);
const pedidos = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1]?.startsWith('--') && !SIN_VALOR.has(args[i - 1])));
const ALTO = [-6, 8];        // lo que se corre la nota: el «Esfuerzo» (−5 a +7, motor/plantel.js) y la afinación (±½)
const MARGEN = 60 + 40;      // ms a cada lado: lo que analiza banco.js alrededor de un pedazo (PAD) y un poco más
const reloj = Date.now(), seg = () => ((Date.now() - reloj) / 1000).toFixed(0) + ' s';
const MB = n => (n / 1e6).toFixed(1) + ' MB';

// ── las piezas ──────────────────────────────────────────────────────────
const ESTILOS = Object.keys(MODELO.estilos), TEMAS = ['', ...CLAVES.map(([re]) => re.source.split('|')[0])];
const LALA = ['la', 'ra', 'la', 'la', 'ra', 'lai', 'la', 'ra'];   // el lailareo de la página (app.js)
// las sílabas del castellano, escritas: cada ataque con cada núcleo y cada coda; la r suave y la rr, entre vocales
const NUCLEOS = ['a', 'e', 'i', 'o', 'u', 'ai', 'au', 'ei', 'eu', 'oi', 'ia', 'ie', 'io', 'iu', 'ua', 'ue', 'ui', 'uo'];
const CODAS = ['', 'n', 's', 'r', 'l', 'd', 'm', 'x', 'c', 'ns'];
const ATAQUES = ['', 'b', 'v', 'k', 'ch', 'd', 'f', 'g', 'j', 'l', 'll', 'y', 'm', 'n', 'ñ', 'p', 'r', 'rr', 's', 't', 'z', 'h',
  'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr', 'tl', 'gw'];
function silaba(at, nuc, coda) {
  const suave = 'ei'.includes(nuc[0]);
  if ((at === 'gw' || at === 'k' && suave) && nuc[0] === 'u') return null;
  const a = at === 'k' ? (suave ? 'qu' : 'c') : at === 'g' ? (suave ? 'gu' : 'g') : at === 'z' ? (suave ? 'c' : 'z') : at === 'gw' ? (suave ? 'gü' : 'gu') : at;
  const s = a + nuc + coda;
  return at === 'r' || at === 'rr' ? 'a' + s : s;   // la r suave y la rr sólo van entre vocales
}
const SINTETICO = [];
for (const pre of ['', 'o']) for (const at of ATAQUES) for (const nuc of NUCLEOS) for (const coda of CODAS) {
  const s = silaba(at, nuc, coda); if (s) SINTETICO.push(pre && !s.startsWith('a') ? pre + s : s);
}
// mezcladas (siempre igual), para que cada coda quede delante de cada ataque
for (let i = SINTETICO.length - 1, x = 7; i > 0; i--) { x = (x * 1103515245 + 12345) & 0x7fffffff; const j = x % (i + 1); [SINTETICO[i], SINTETICO[j]] = [SINTETICO[j], SINTETICO[i]]; }
let cursor = 0;
const silabasDe = w => (w.match(/[aeiouü]+/g) || []).length;
const versosSinteticos = partes => partes.map(p => p.versos.map(v => {
  const w = []; let n = 0;
  while (n < v.silabas && cursor < SINTETICO.length) { const x = SINTETICO[cursor++]; w.push(x); n += silabasDe(x); }
  return w.join(' ') || 'la';
}));

console.log(`armando las piezas (${N} del letrista, 4 de lailareo y las del texto sintético de ${SINTETICO.length} palabras)…`);
const piezas = [];
const op = i => ({ forma: i % 2 ? 'presentacion' : 'retirada', estilo: ESTILOS[i % ESTILOS.length], semilla: 101 + i * 13, tonica: (i * 5) % 12, modo: i % 3 === 2 ? 'menor' : 'mayor', largo: ['corta', 'normal', 'larga'][i % 3], hasta: 0, letraSemilla: 1 + i, tema: TEMAS[i % TEMAS.length] });
for (let i = 0; i < N; i++) piezas.push({ tipo: 'letrista', M: prepararMurga(op(i)) });
for (let i = 0; i < 4; i++) piezas.push({ tipo: 'lailareo', M: prepararMurga({ ...op(N + i), versos: partes => partes.map(p => p.versos.map(v => Array.from({ length: v.silabas }, (_, j) => LALA[j % LALA.length]).join(' '))) }) });
for (let i = 0; cursor < SINTETICO.length; i++) piezas.push({ tipo: 'sintético', M: prepararMurga({ ...op(N + 4 + i), largo: 'larga', versos: versosSinteticos }) });
console.log(`${piezas.length} piezas (${piezas.filter(p => p.tipo === 'sintético').length} con el texto sintético) · ${seg()}`);

// ── un banco ────────────────────────────────────────────────────────────
const world = await crearWorld(readFileSync(join(RAIZ, 'motor', 'vendor', 'world', 'world.wasm')));
const abrir = ruta => { const t = archivosDelBanco(ruta), b = crearBanco(t.rutas, t.leer); b.preparar = async () => {}; return { ...t, b }; };
// el formato del .wav y dónde están sus muestras, sin decodificarlas
function partesWav(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), tag = p => String.fromCharCode(...bytes.subarray(p, p + 4));
  let p = 12, fmt = null, datos = null;
  while (p + 8 <= bytes.length) {
    const id = tag(p), n = v.getUint32(p + 4, true);
    if (id === 'fmt ') fmt = bytes.subarray(p + 8, p + 8 + n);
    if (id === 'data') datos = bytes.subarray(p + 8, Math.min(bytes.length, p + 8 + n));
    p += 8 + n + (n & 1);
  }
  if (!fmt || !datos) return null;
  const f = new DataView(fmt.buffer, fmt.byteOffset, fmt.byteLength);
  return { fmt, datos, sr: f.getUint32(4, true), bloque: f.getUint16(12, true) };
}
function wavCon(fmt, datos) {
  const h = new Uint8Array(20 + fmt.length + 8 + datos.length + (datos.length & 1)), v = new DataView(h.buffer);
  const cad = (p, s) => { for (let i = 0; i < 4; i++) h[p + i] = s.charCodeAt(i); };
  cad(0, 'RIFF'); v.setUint32(4, h.length - 8, true); cad(8, 'WAVE'); cad(12, 'fmt '); v.setUint32(16, fmt.length, true); h.set(fmt, 20);
  const p = 20 + fmt.length; cad(p, 'data'); v.setUint32(p + 4, datos.length, true); h.set(datos, p + 8);
  return h;
}
const num = x => String(Math.round(x * 1e6) / 1e6);

async function recortar(archivo) {
  const voces = PL.voces.filter(v => v.banco === archivo);
  const ruta = join(DE, archivo), salida = join(A, archivo);
  const { rutas, leer, b } = abrir(ruta);
  // las alturas que el banco no dice se miden como en la página, y esos .wav quedan
  const quedan = new Set(), medidos = new Set();
  b.preparar = async a => { for (const f of a) medidos.add(f); };
  await medirAlturas(b, world);
  b.preparar = async () => {};
  for (const f of medidos) quedan.add(f);
  // las sílabas que canta cada voz (en cualquier lugar) y entre qué notas
  const porVoz = voces.map(v => ({ v, alias: new Set(), lo: 1e9, hi: -1e9, curva: [] }));
  for (const [k, { M }] of piezas.entries()) {
    for (const x of porVoz) {
      const MURGA = Object.fromEntries(LUGARES.map(l => [l.clave, x.v.nombre]));
      for (const t of repartir(M.lista, PL.voces, MURGA)) {
        if (t.motor !== 'banco') continue;
        for (const { F, U } of frasesDe(b, correr(t.c.notas, t.opc), t.opc)) for (const u of U) {
          x.alias.add(u.alias); const m = F[u.nota].midi; if (m < x.lo) x.lo = m; if (m > x.hi) x.hi = m;
        }
      }
      x.curva[k] = x.alias.size;
    }
  }
  // cada sílaba en cada altura a la que llega la voz: el pedazo que le toca
  for (const x of porVoz) for (const a of x.alias) for (let m = Math.floor(x.lo) + ALTO[0]; m <= Math.ceil(x.hi) + ALTO[1]; m++) {
    const e = b.buscar(a, m, x.v.evitar, x.v.capa ?? x.v.color); if (e) quedan.add(e.archivo);
  }
  // el pedazo de cada .wav que queda: desde el primer offset hasta el final más lejano, con margen
  const deArchivo = new Map();
  for (const e of b.entradas) { const k = e.archivo.toLowerCase(); if (!deArchivo.has(k)) deArchivo.set(k, []); deArchivo.get(k).push(e); }
  const porNombre = new Map(rutas.map(r => [r.toLowerCase(), r]));
  const cortes = new Map(), wavs = [], niveles = [];
  let antes = 0, despues = 0;
  for (const f of quedan) {
    const r = porNombre.get(f.toLowerCase()), bytes = r && leer(r), w = bytes && partesWav(bytes);
    if (!w) continue;
    // (el mismo .wav nombrado con otras mayúsculas en otro oto.ini: va una vez, con el nivel para cada nombre)
    if (cortes.has(f.toLowerCase())) { niveles.push(`${f}\t${crearBanco([r], () => bytes).wav(r).nivel}`); continue; }
    const muestras = Math.floor(w.datos.length / w.bloque), dur = muestras / w.sr * 1000;
    let a = Infinity, z = 0;
    for (const e of deArchivo.get(f.toLowerCase()) || []) {
      const len = e.cutoff < 0 ? -e.cutoff : dur - e.offset - e.cutoff;
      a = Math.min(a, e.offset - MARGEN);
      z = Math.max(z, e.offset + Math.max(len, e.consonante, e.pre, e.overlap) + MARGEN);
    }
    // el comienzo, en ms enteros y muestras enteras (de a 10 ms: 441 muestras a 44,1 kHz), para que los offsets
    // corridos caigan en las mismas muestras
    a = w.sr % 100 === 0 ? Math.max(0, Math.floor(a / 10) * 10) : 0;
    const desde = Math.min(Math.round(a * w.sr / 1000), muestras), z0 = Math.max(desde, Math.min(muestras, Math.ceil(z * w.sr / 1000)));
    cortes.set(f.toLowerCase(), { a: desde * 1000 / w.sr, z: z0 * 1000 / w.sr, dur });
    wavs.push({ nombre: r, datos: wavCon(w.fmt, w.datos.subarray(desde * w.bloque, z0 * w.bloque)) });
    // el nivel, el del .wav entero (como lo calcula banco.js)
    niveles.push(`${f}\t${crearBanco([r], () => bytes).wav(r).nivel}`);
    antes += bytes.length; despues += wavs[wavs.length - 1].datos.length;
  }
  // los textos del banco, con los oto.ini corridos
  const textos = [];
  for (const r of rutas.filter(r => !/\.wav$/i.test(r))) {
    let d = leer(r); if (!d) continue;
    if (/(^|\/)oto\.ini$/i.test(r)) {
      const carpeta = r.split('/').slice(0, -1).join('/');
      const lineas = texto(d).split(/\r?\n/).map(l => {
        const i = l.indexOf('='); if (i <= 0) return l;
        const c = l.slice(i + 1).split(','); if (c.length < 6) return l;
        const k = ((carpeta ? carpeta + '/' : '') + l.slice(0, i).trim()).toLowerCase(), x = cortes.get(k);
        if (!x) return l;
        const off = +c[1], cut = +c[3]; if (!Number.isFinite(off) || !Number.isFinite(cut)) return l;
        c[1] = num(off - x.a);
        if (cut >= 0) c[3] = num(x.z - (x.dur - cut));   // lo que se deja al final, medido desde el nuevo final
        return l.slice(0, i) + '=' + c.join(',');
      });
      d = new TextEncoder().encode(lineas.join('\n'));
    }
    textos.push({ nombre: r, datos: d });
  }
  textos.push({ nombre: NIVELES, datos: new TextEncoder().encode(niveles.join('\n') + '\n') });
  mkdirSync(A, { recursive: true });
  const conWav = salida + '.wav.tmp', bytesWav = escribirZip(conWav, [...textos, ...wavs]);

  // ── la prueba del recorte (con los .wav) ──
  const n = abrir(conWav), nb = n.b, problemas = [];
  if (nb.reclist !== b.reclist) problemas.push(`reclist ${nb.reclist} en vez de ${b.reclist}`);
  if (nb.entradas.length !== b.entradas.length) problemas.push(`${nb.entradas.length} entradas en vez de ${b.entradas.length}`);
  await medirAlturas(nb, world);
  const alt = x => x.alturas.map(c => c.prefijo + '|' + c.sufijo + '|' + c.midi).join(' ');
  if (alt(nb) !== alt(b)) problemas.push(`alturas ${alt(nb)} en vez de ${alt(b)}`);
  // las mismas murgas piden los mismos pedazos (con el esfuerzo de un extremo al otro)
  let comparadas = 0, distintas = 0;
  const muestra = [...piezas.filter(p => p.tipo === 'letrista').slice(0, 6), ...piezas.filter(p => p.tipo !== 'letrista').slice(0, 3)];
  for (const { M } of muestra) for (const v of voces) {
    const MURGA = Object.fromEntries(LUGARES.map(l => [l.clave, v.nombre]));
    for (const t of repartir(M.lista, PL.voces, MURGA)) {
      if (t.motor !== 'banco') continue;
      for (const esf of [-5, 0, 7]) {
        const o = { ...t.opc, esfuerzo: esf };
        const p1 = frasesDe(b, correr(t.c.notas, o), o).flatMap(f => f.U.map(u => u.e?.archivo ?? '-')).join('|');
        const p2 = frasesDe(nb, correr(t.c.notas, o), o).flatMap(f => f.U.map(u => u.e?.archivo ?? '-')).join('|');
        comparadas++; if (p1 !== p2) distintas++;
      }
    }
  }
  if (distintas) problemas.push(`${distintas} de ${comparadas} cantores piden otros pedazos`);
  // unas frases cantadas con los dos bancos
  let peor = 0;
  for (const v of voces) {
    const MURGA = Object.fromEntries(LUGARES.map(l => [l.clave, v.nombre]));
    const t = repartir(piezas[0].M.lista, PL.voces, MURGA).find(x => x.motor === 'banco');
    const notas = t.c.notas.filter(x => x.t0 < t.c.notas[0].t0 + 6);
    const r1 = cantarBanco(b, world, notas, { ...t.opc, cache: new Map() }), r2 = cantarBanco(nb, world, notas, { ...t.opc, cache: new Map() });
    let d = Math.abs(r1.x.length - r2.x.length) ? 1 : 0, pico = 1e-9;
    for (let i = 0; i < Math.min(r1.x.length, r2.x.length); i++) { d = Math.max(d, Math.abs(r1.x[i] - r2.x[i])); pico = Math.max(pico, Math.abs(r1.x[i])); }
    peor = Math.max(peor, d / pico);
  }
  if (peor > 1e-4) problemas.push(`las frases cantadas difieren (${(peor * 100).toFixed(3)} % del pico)`);

  // ── los .wav en Opus (el nombre queda: adentro va un Ogg; motor/cantor/opus.js) ──
  let bytes = bytesWav, opus = '';
  if (SOLO_WAV || problemas.length) renameSync(conWav, salida);
  else {
    // (los muy cortos, de menos de un cuadro de Opus, quedan en .wav)
    const enc = await enParalelo(wavs, 8, async w => (w.datos.length > 44 + 4000 ? { nombre: w.nombre, datos: await aOpus(w.datos) } : w));
    bytes = escribirZip(salida, [...textos, ...enc]);
    // cuánto cambia lo cantado: las mismas frases con los .wav recortados y con los Opus (el espectro por bandas)
    const ob = abrir(salida).b;
    await medirAlturas(ob, world);
    if (alt(ob) !== alt(b)) problemas.push(`con Opus, alturas ${alt(ob)} en vez de ${alt(b)}`);
    const difs = [];
    mkdirSync(AB, { recursive: true });
    for (const v of voces) {
      const MURGA = Object.fromEntries(LUGARES.map(l => [l.clave, v.nombre]));
      const t = repartir(piezas[0].M.lista, PL.voces, MURGA).find(x => x.motor === 'banco');
      const notas = t.c.notas.filter(x => x.t0 < t.c.notas[0].t0 + 12);
      const r1 = cantarBanco(nb, world, notas, { ...t.opc, cache: new Map() }), r2 = cantarBanco(ob, world, notas, { ...t.opc, cache: new Map() });
      difs.push(distanciaEspectral(aFrecuencia(r1, r2.sr), r2));   // a la misma frecuencia (si no, la medida no da cero)
      writeFileSync(join(AB, `${v.nombre} - wav.wav`), wavMono(r1.x, r1.sr)); writeFileSync(join(AB, `${v.nombre} - opus.wav`), wavMono(r2.x, r2.sr));
    }
    rmSync(conWav);
    opus = ` · en Opus ${KBPS}bps: ${MB(bytesWav)} → ${MB(bytes)}, lo cantado cambia ${difs.map(d => d.toFixed(2)).join('/')} dB`;
  }
  const totalWavs = rutas.filter(r => /\.wav$/i.test(r)).length;
  console.log(`${archivo.padEnd(26)} ${MB(statSync(ruta).size).padStart(9)} → ${MB(bytes).padStart(9)}  · ${quedan.size}/${totalWavs} .wav, ${MB(antes)} → ${MB(despues)} sin comprimir`
    + ` · sílabas ${porVoz.map(x => x.alias.size).join('/')} · recortado: ${(peor * 100).toFixed(4)} %${opus}`
    + ` · ${problemas.length ? 'PROBLEMAS: ' + problemas.join('; ') : 'bien'} · ${seg()}`);
  return { antes: statSync(ruta).size, despues: bytes, problemas };
}

// ── Opus y la comparación ──────────────────────────────────────────────
// el .wav en Ogg Opus, con la frecuencia del original anotada en el OpusHead (ffmpeg anota los 48 kHz a los que
// remuestrea; la página vuelve a la del original al decodificar, motor/cantor/opus.js)
function aOpus(wav) {
  const sr = partesWav(wav).sr;
  return new Promise((ok, mal) => {
    const p = spawn('ffmpeg', ['-loglevel', 'error', '-f', 'wav', '-i', 'pipe:0', '-map_metadata', '-1', '-c:a', 'libopus', '-b:a', KBPS, '-vbr', 'on', '-application', 'audio', '-f', 'ogg', 'pipe:1']);
    const out = []; let err = '';
    p.stdout.on('data', d => out.push(d)); p.stderr.on('data', d => { err += d; });
    p.on('error', mal);
    p.on('close', c => { if (c) { mal(new Error('ffmpeg: ' + err)); return; } try { ok(conTasa(new Uint8Array(Buffer.concat(out)), sr)); } catch (e) { mal(e); } });
    p.stdin.end(Buffer.from(wav.buffer, wav.byteOffset, wav.byteLength));
  });
}
// la primera página del Ogg (la del OpusHead, sola) con otra frecuencia del original, y su CRC de nuevo
const CRC_OGG = Uint32Array.from({ length: 256 }, (_, i) => { let r = i << 24; for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1; return r >>> 0; });
function conTasa(ogg, sr) {
  const v = new DataView(ogg.buffer, ogg.byteOffset, ogg.byteLength), nseg = ogg[26], cab = 27 + nseg, largo = cab + ogg.subarray(27, cab).reduce((a, x) => a + x, 0);
  if (String.fromCharCode(...ogg.subarray(cab, cab + 8)) !== 'OpusHead') throw new Error('la primera página no es el OpusHead');
  v.setUint32(cab + 12, sr, true); v.setUint32(22, 0, true);
  let c = 0; for (let i = 0; i < largo; i++) c = ((c << 8) ^ CRC_OGG[((c >>> 24) ^ ogg[i]) & 255]) >>> 0;
  v.setUint32(22, c, true);
  return ogg;
}
// lo cantado, llevado a otra frecuencia de muestreo (con ffmpeg)
function aFrecuencia(r, sr) {
  if (r.sr === sr) return r;
  const o = execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'f32le', '-ar', String(r.sr), '-ac', '1', '-i', 'pipe:0', '-ar', String(sr), '-f', 'f32le', 'pipe:1'], { input: Buffer.from(r.x.buffer, r.x.byteOffset, r.x.byteLength), maxBuffer: 1 << 30 });
  return { x: new Float32Array(o.buffer.slice(o.byteOffset, o.byteOffset + o.length)), sr };
}
async function enParalelo(cosas, n, f) {
  const r = new Array(cosas.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < cosas.length) { const k = i++; r[k] = await f(cosas[k]); } }));
  return r;
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let L = 2; L <= n; L <<= 1) {
    const ang = -2 * Math.PI / L, h = L >> 1;
    for (let i = 0; i < n; i += L) for (let k = 0; k < h; k++) {
      const c = Math.cos(ang * k), s = Math.sin(ang * k), p = i + k, q = p + h;
      const xr = re[q] * c - im[q] * s, xi = re[q] * s + im[q] * c;
      re[q] = re[p] - xr; im[q] = im[p] - xi; re[p] += xr; im[p] += xi;
    }
  }
}
// la energía en bandas de un tercio de octava (200 Hz a 16 kHz: cada una con varios puntos del espectro, a 44,1 y a
// 48 kHz), por muestra del cuadro (cuadros de 40 ms cada 20 ms), en dB
function bandas(x, sr) {
  const N = 4096, paso = Math.round(sr * .02), L = Math.round(sr * .04), lim = [];
  for (let f = 200; f < 16000; f *= 2 ** (1 / 3)) lim.push(f);
  const banda = new Int16Array(N / 2).fill(-1);
  for (let k = 1; k < N / 2; k++) { const j = lim.findIndex(l => l > k * sr / N) - 1; if (j >= 0 && j < lim.length - 1) banda[k] = j; }
  const out = [];
  for (let a = 0; a + L <= x.length; a += paso) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < L; i++) re[i] = x[a + i] * (.5 - .5 * Math.cos(2 * Math.PI * i / L));
    fft(re, im);
    const e = new Float64Array(lim.length - 1);
    for (let k = 1; k < N / 2; k++) if (banda[k] >= 0) e[banda[k]] += (re[k] * re[k] + im[k] * im[k]) / L;
    out.push(Array.from(e, v => 10 * Math.log10(v + 1e-12)));
  }
  return out;
}
// el promedio, en los cuadros que suenan, de la diferencia (eficaz, entre bandas) en dB
function distanciaEspectral(r1, r2) {
  const A = bandas(r1.x, r1.sr), B = bandas(r2.x, r2.sr), n = Math.min(A.length, B.length);
  const nivel = A.map(f => Math.max(...f)), tope = Math.max(...nivel);
  let s = 0, c = 0;
  for (let i = 0; i < n; i++) {
    if (nivel[i] < tope - 40) continue;
    let d = 0, m = 0;
    for (let j = 0; j < A[i].length; j++) if (A[i][j] > nivel[i] - 50) { d += (A[i][j] - B[i][j]) ** 2; m++; }
    if (m) { s += Math.sqrt(d / m); c++; }
  }
  return c ? s / c : 0;
}
function wavMono(x, sr) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  let pico = 1e-9; for (const v of x) pico = Math.max(pico, Math.abs(v));
  const k = pico > .99 ? .99 / pico : 1;
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i] * k)) * 32767), 44 + i * 2);
  return b;
}

const cuales = pedidos.length ? pedidos : [...new Set(PL.voces.filter(v => v.banco).map(v => v.banco))].filter(a => existsSync(join(DE, a)));
let T0 = 0, T1 = 0, mal = 0;
for (const a of cuales) { const r = await recortar(a); T0 += r.antes; T1 += r.despues; if (r.problemas.length) mal++; }
console.log(`en total: ${MB(T0)} → ${MB(T1)}${mal ? ` · ${mal} bancos con problemas` : ''} · ${seg()}`);
if (mal) process.exitCode = 1;
