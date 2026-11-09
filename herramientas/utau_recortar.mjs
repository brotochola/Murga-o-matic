// utau_recortar.mjs — los bancos de UTAU recortados para la versión liviana (herramientas/construir.mjs): sólo los .wav
// que la página puede llegar a usar y, de cada uno, sólo el pedazo que marcan sus oto.ini (con margen).
//
// Qué puede usar la página: las sílabas de muchas murgas (el letrista local, con todas las formas, estilos, tonos,
// modos y temas, el lailareo y un texto con las sílabas del castellano, por los versos escritos a mano), con cada voz
// del plantel en cada lugar, en todas las alturas a las que llega (sus notas, con el «Esfuerzo» de −5 a +7 y la
// afinación). Los oto.ini quedan enteros, con los tiempos corridos: así las sílabas se reparten igual que con el banco
// entero, y una que no quedó se busca en otra altura (banco.js). El nivel de cada .wav va anotado en murga_niveles.txt
// (el de un .wav recortado daría otro).
//
// La prueba, banco por banco: el recortado tiene las mismas entradas, reclist y alturas; las mismas murgas le piden
// los mismos pedazos; y unas frases cantadas con los dos dan lo mismo.
//
//   node herramientas/utau_recortar.mjs [--bancos carpeta] [--salida carpeta] [--piezas 60] [banco.zip ...]
//   (por defecto, de bancos/ a liviana/bancos/; los bancos de bancos/ no se tocan)
import { readFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { archivosDelBanco, RAIZ } from './banco_node.mjs';
import { escribirZip } from './zip_escribir.mjs';
import { crearBanco, frasesDe, cantarBanco, texto, NIVELES } from '../motor/cantor/banco.js';
import { correr } from '../motor/cantor/difonos.js';
import { medirAlturas } from '../motor/cantor/bancos.js';
import { crearWorld } from '../motor/cantor/world.js';
import { prepararMurga, repartir, LUGARES } from '../motor/cantor/murga_bancos.js';
import { CLAVES } from '../motor/cantor/lexico.js';
import { MODELO } from '../motor/modelo.js';

const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const DE = resolve(arg('bancos', join(RAIZ, 'bancos'))), A = resolve(arg('salida', join(RAIZ, 'liviana', 'bancos')));
const N = +arg('piezas', 60);
const PL = JSON.parse(readFileSync(join(RAIZ, 'bancos', 'plantel.json'), 'utf8'));
const pedidos = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
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
  const bytes = escribirZip(salida, [...textos, ...wavs]);

  // ── la prueba ──
  const n = abrir(salida), nb = n.b, problemas = [];
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
  // ¿alcanzaron las piezas? las sílabas nuevas del último cuarto
  const satur = porVoz.map(x => { const q = Math.floor(piezas.length * .75); return x.curva[piezas.length - 1] - x.curva[q - 1]; });
  const totalWavs = rutas.filter(r => /\.wav$/i.test(r)).length;
  console.log(`${archivo.padEnd(26)} ${MB(statSync(ruta).size).padStart(9)} → ${MB(bytes).padStart(9)}  · ${quedan.size}/${totalWavs} .wav, ${MB(antes)} → ${MB(despues)} sin comprimir`
    + ` · sílabas ${porVoz.map(x => x.alias.size).join('/')} (nuevas en el último cuarto: ${satur.join('/')})`
    + ` · frases: ${(peor * 100).toFixed(4)} % · ${problemas.length ? 'PROBLEMAS: ' + problemas.join('; ') : 'bien'} · ${seg()}`);
  return { antes: statSync(ruta).size, despues: bytes, problemas };
}

const cuales = pedidos.length ? pedidos : [...new Set(PL.voces.filter(v => v.banco).map(v => v.banco))].filter(a => existsSync(join(DE, a)));
let T0 = 0, T1 = 0, mal = 0;
for (const a of cuales) { const r = await recortar(a); T0 += r.antes; T1 += r.despues; if (r.problemas.length) mal++; }
console.log(`en total: ${MB(T0)} → ${MB(T1)}${mal ? ` · ${mal} bancos con problemas` : ''} · ${seg()}`);
if (mal) process.exitCode = 1;
