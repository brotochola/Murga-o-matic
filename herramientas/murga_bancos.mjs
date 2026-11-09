// murga_bancos.mjs — una murga cantada con bancos de UTAU (docs/utau.md). Compone una pieza como la página, le escribe
// la letra (el letrista local), reparte los trece cantores (coro.js) y a cada uno le da una voz de cantantes.json según
// su cuerda (reparto.json). Cada cantor lleva los valores de un cantor de difonos (vibrato, entrada, adornos...) sin
// lo que es sólo de MBROLA (su garganta, su color). Batería con los loops reales, sala, y sale un mp3 (ffmpeg).
//
//   node herramientas/murga_bancos.mjs <cantantes.json> <reparto.json> [opciones]
//     --forma retirada  --estilo trasnochada  --semilla 4  --tonica 7  --modo mayor  --largo corta
//     --hasta 60        cortar al final de la primera sección que termine después de ese segundo (0: entera)
//     --letra-semilla 1 --salida murga_trabajo/utau/murga
//
// reparto.json: { "bajos": ["nombre de cantantes.json", ...], "segundos": [...], ... } en el orden de los cantores
// de cada cuerda; si se repite una voz, la repetida lleva otra garganta (tracto 1,04, después 0,96...).
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { componer } from '../motor/compositor.js';
import { MODELO } from '../motor/modelo.js';
import { tiempos, metrica, silabear, cantores } from '../motor/cantor/coro.js';
import { renderBateria } from '../motor/cantor/bateria.js';
import { partesAEscribir } from '../motor/cantor/letrista.js';
import { escribirLetraLocal } from '../motor/cantor/letrista_local.js';
import { DATOS } from '../motor/cantor/datos.js';
import { sala, normalizar } from '../motor/cantor/mezcla.js';
import { cantorDifonos } from '../motor/cantor/difonos.js';
import { crearBanco, cantarBanco, nombreNota } from '../motor/cantor/banco.js';
import { crearWorld } from '../motor/cantor/world.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [rCantantes, rReparto] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!rCantantes || !rReparto) { console.error('uso: node herramientas/murga_bancos.mjs <cantantes.json> <reparto.json> [opciones]'); process.exit(1); }
const CANTANTES = JSON.parse(readFileSync(rCantantes, 'utf8')), REPARTO = JSON.parse(readFileSync(rReparto, 'utf8'));
const op = { forma: arg('forma', 'retirada'), estilo: arg('estilo', 'trasnochada'), semilla: +arg('semilla', 4), tonica: +arg('tonica', 7), modo: arg('modo', 'mayor'), largo: arg('largo', 'corta') };
const HASTA = +arg('hasta', 60), semLetra = +arg('letra-semilla', 1);
const SAL = resolve(arg('salida', join(RAIZ, 'murga_trabajo', 'utau', 'murga')));
mkdirSync(SAL, { recursive: true });
const SR = 44100;
const reloj = Date.now(), seg = () => ((Date.now() - reloj) / 1000).toFixed(0) + ' s';

// 1. la pieza y la letra, como la página (exportar_voces.mjs)
const LLAMADAS = Object.fromEntries(DATOS.ritmos.map(r => { const a = DATOS.acompana[r.id]; if (!a || !a[0]) return [r.id, 0]; const c4 = r.compas * 4 / r.tpc; return [r.id, Math.ceil((DATOS.frases[a[0]].ultimo + .05) / c4)]; }));
const P = componer(MODELO, { ...op, llamadas: LLAMADAS });
const { T, fin } = tiempos(P); P.total = fin; P.T = T;
const M = metrica(P), partes = partesAEscribir(M, op.forma);
const textos = escribirLetraLocal({ forma: op.forma, tema: arg('tema', ''), metrica: M, semilla: op.semilla * 1000 + semLetra }).textos;
const letras = {}; partes.forEach((p, i) => { for (const s of p.secciones) letras[s] = textos[i]; });
const { porQ } = silabear(P, letras);
// el corte: al final de la primera sección que termina después de HASTA
const corte = HASTA > 0 ? (P.secs.find(s => s.t1 >= HASTA)?.t1 ?? fin) : fin;
const largo = corte + 2.2;
console.log(`${op.forma} ${op.estilo}, semilla ${op.semilla}: ${fin.toFixed(1)} s; se canta hasta ${corte.toFixed(1)} s`);
for (const s of P.secs) if (s.t0 < corte) console.log(`  ${s.t0.toFixed(1).padStart(6)}–${s.t1.toFixed(1).padStart(6)} s  ${s.nombre}`);

// 2. los cantores y sus voces
const bancos = new Map();
function banco(carpeta) {
  if (!bancos.has(carpeta)) {
    const rutas = [];
    (function andar(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else rutas.push(relative(carpeta, p).split(/[\\/]/).join('/')); } })(carpeta);
    bancos.set(carpeta, { b: crearBanco(rutas, r => { try { return new Uint8Array(readFileSync(join(carpeta, r))); } catch { return null; } }), cache: new Map() });
  }
  return bancos.get(carpeta);
}
const porNombre = Object.fromEntries(CANTANTES.map(c => [c.nombre, c]));
const GARGANTAS = [1, 1.04, .96, 1.07, .93];
const vecesUsada = new Map();
const lista = cantores(P, porQ, { semilla: op.semilla })
  .map(c => ({ ...c, notas: c.notas.filter(n => n.t0 < corte) })).filter(c => c.notas.length);
const world = await crearWorld(readFileSync(join(RAIZ, 'motor', 'vendor', 'world', 'world.wasm')));
const reparto = [];
const L = new Float32Array(Math.ceil(largo * SR)), R = new Float32Array(L.length);
lista.forEach((c, i) => {
  const nombres = REPARTO[c.cuerda] || REPARTO.primos;
  const voz = porNombre[nombres[(c.c || 0) % nombres.length]];
  if (!voz?.carpeta) throw new Error(`${c.cuerda} ${c.c}: no hay voz de banco en el reparto (${nombres[(c.c || 0) % nombres.length]})`);
  const k = vecesUsada.get(voz.nombre) || 0; vecesUsada.set(voz.nombre, k + 1);
  const tracto = (voz.tracto || 1) * GARGANTAS[k % GARGANTAS.length];
  // los valores de un cantor de difonos de esa cuerda, sin la garganta ni el color de MBROLA
  const { tracto: _t, color: _c, inclinacion: _i, ...base } = cantorDifonos(c.cuerda === 'tercia' ? 'sobreprimos' : c.cuerda, c.semilla, { c: c.c || 0 });
  const { b, cache } = banco(voz.carpeta);
  const t = Date.now();
  const r = cantarBanco(b, world, c.notas, { ...base, retraso: (base.retraso || 0) + (c.retraso || 0), semilla: c.semilla, cache, capa: voz.capa ?? voz.color, evitar: voz.evitar, tracto });
  if (r.sr !== SR) throw new Error(`${voz.nombre}: ${r.sr} Hz (falta remuestrear)`);
  // cada cantor al mismo nivel (su pico), y después su ganancia y su lugar, como en la página
  let pk = 1e-9; for (const v of r.x) pk = Math.max(pk, Math.abs(v));
  const g = c.ganancia * .5 / pk, gl = Math.cos((c.pan + 1) * Math.PI / 4) * g, gr = Math.sin((c.pan + 1) * Math.PI / 4) * g;
  const a = Math.round(r.inicio * SR);
  for (let s = 0; s < r.x.length; s++) { const j = a + s; if (j >= 0 && j < L.length) { L[j] += r.x[s] * gl; R[j] += r.x[s] * gr; } }
  const lo = Math.min(...c.notas.map(n => n.midi)), hi = Math.max(...c.notas.map(n => n.midi));
  reparto.push({ cuerda: c.cuerda, c: c.c || 0, voz: voz.nombre, tracto: +tracto.toFixed(2), notas: `${nombreNota(lo)}–${nombreNota(hi)}`, pan: +c.pan.toFixed(2) });
  console.log(`  ${String(i + 1).padStart(2)}/${lista.length} ${c.cuerda.padEnd(11)} ${voz.nombre} (garganta ${tracto.toFixed(2)}, ${nombreNota(lo)}–${nombreNota(hi)}): ${((Date.now() - t) / 1000).toFixed(1)} s · ${seg()}`);
});

// 3. la sala sobre las voces, la batería, y todo junto
sala(L, R, SR, { mezcla: .24, largo: 1.7 });
let pv = 1e-9; for (let s = 0; s < L.length; s++) pv = Math.max(pv, Math.abs(L[s]), Math.abs(R[s]));
const leerWavLoop = archivo => { const b = readFileSync(join(RAIZ, archivo)); const sr = b.readUInt32LE(24); let o = 12; while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4); const m = b.readUInt32LE(o + 4) / 2, d = new Float32Array(m); for (let i = 0; i < m; i++) d[i] = b.readInt16LE(o + 8 + i * 2) / 32768; return { sr, datos: d }; };
const bat = await renderBateria(P, DATOS, async a => leerWavLoop(a), SR, largo);
let pb = 1e-9; for (const v of bat) pb = Math.max(pb, Math.abs(v));
const gb = .55 * pv / pb;   // el pico de la batería, 0,55 del pico del coro, como en la página
for (let s = 0; s < L.length; s++) {
  // después del corte, la batería se apaga en 2 s
  const f = s / SR < corte ? 1 : Math.max(0, 1 - (s / SR - corte) / 2);
  const v = (bat[s] || 0) * gb * f; L[s] += v; R[s] += v;
}
normalizar(L, R);
// 4. el wav y el mp3
const nombre = `${op.forma}_${op.estilo}_${op.semilla}`;
const rWav = join(SAL, nombre + '.wav'), rMp3 = join(SAL, nombre + '.mp3');
{
  const n = L.length, b = Buffer.alloc(44 + n * 4);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), 44 + i * 4); b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), 46 + i * 4); }
  writeFileSync(rWav, b);
}
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', rWav, '-codec:a', 'libmp3lame', '-b:a', '192k', rMp3]);
writeFileSync(join(SAL, nombre + '_letra.txt'), partes.map((p, i) => textos[i].join('\n')).join('\n\n') + '\n');
writeFileSync(join(SAL, nombre + '_reparto.json'), JSON.stringify({ pieza: { ...op, corte: +corte.toFixed(2) }, reparto }, null, 1));
console.log(`→ ${rMp3} (${corte.toFixed(1)} s cantados, ${lista.length} cantores, en ${seg()})`);
