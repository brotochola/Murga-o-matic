// murga_bancos.mjs — una murga cantada con bancos de UTAU, en Node (lo mismo que «Cantar la murga» de estudio.html:
// motor/cantor/murga_bancos.js). Compone una pieza como la página, le escribe la letra, reparte los trece cantores y a
// cada uno le da una voz del plantel según su lugar. Batería con los loops reales, sala, y sale un mp3 (ffmpeg).
//
//   node herramientas/murga_bancos.mjs [plantel.json] [reparto.json] [opciones]
//     --forma retirada  --estilo trasnochada  --semilla 56  --tonica 9  --modo mayor  --largo corta
//     --hasta 60        cortar al final de la primera sección que termine después de ese segundo (0: entera)
//     --letra-semilla 1 --salida murga_trabajo/utau/murga
//
// plantel.json (por defecto bancos/plantel.json): { "voces": [{ "nombre": "MIKE grave", "banco": "MIKE.zip",
//   "capa": "_dp", "grito": .8, ... }, { "nombre": "MBROLA es2", "mbrola": "es2" }], "murga": { "bajos0": ... } }.
//   El banco es un .zip de bancos/ (o una carpeta, con «carpeta»).
// reparto.json (si no, la «murga» del plantel): { "bajos0": "nombre", ... } (la murga del estudio) o
//   { "bajos": ["nombre", ...], ... } (por cuerda, en el orden de sus cantores; si faltan voces, se repiten)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { abrirBancoNode } from './banco_node.mjs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { renderBateria } from '../motor/cantor/bateria.js';
import { DATOS } from '../motor/cantor/datos.js';
import { crearBanco, cantarBanco, nombreNota } from '../motor/cantor/banco.js';
import { crearWorld } from '../motor/cantor/world.js';
import { cantarDifonos } from '../motor/cantor/difonos.js';
import { crearMbrola } from '../motor/cantor/mbrola.js';
import { LUGARES, prepararMurga, repartir, mezclarMurga, wavEstereo } from '../motor/cantor/murga_bancos.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [rPlantel, rReparto] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const PL = JSON.parse(readFileSync(rPlantel || join(RAIZ, 'bancos', 'plantel.json'), 'utf8'));
const PLANTEL = Array.isArray(PL) ? PL : PL.voces, REP = rReparto ? JSON.parse(readFileSync(rReparto, 'utf8')) : PL.murga;
if (!REP) { console.error('falta el reparto: el plantel no trae «murga» y no se pasó reparto.json'); process.exit(1); }
// el reparto por cuerda se pasa a la murga por lugar
const MURGA = Object.values(REP).some(Array.isArray)
  ? Object.fromEntries(LUGARES.map(l => { const v = REP[l.cuerda] || REP.primos; return [l.clave, v[l.n % v.length]]; }))
  : REP;
const SAL = resolve(arg('salida', join(RAIZ, 'murga_trabajo', 'utau', 'murga')));
mkdirSync(SAL, { recursive: true });
const SR = 44100;
const reloj = Date.now(), seg = () => ((Date.now() - reloj) / 1000).toFixed(0) + ' s';

const M = prepararMurga({ forma: arg('forma', 'retirada'), estilo: arg('estilo', 'trasnochada'), semilla: +arg('semilla', 56), tonica: +arg('tonica', 9), modo: arg('modo', 'mayor'), largo: arg('largo', 'corta'), hasta: +arg('hasta', 60), letraSemilla: +arg('letra-semilla', 1), tema: arg('tema', '') });
console.log(`${M.op.forma} ${M.op.estilo}, semilla ${M.op.semilla}: ${M.fin.toFixed(1)} s; se canta hasta ${M.corte.toFixed(1)} s`);
for (const s of M.P.secs) if (s.t0 < M.corte) console.log(`  ${s.t0.toFixed(1).padStart(6)}–${s.t1.toFixed(1).padStart(6)} s  ${s.nombre}`);

const bancos = new Map(), mbs = {};
function banco(carpeta) {
  if (!bancos.has(carpeta)) {
    bancos.set(carpeta, { b: abrirBancoNode(carpeta), cache: new Map() });
  }
  return bancos.get(carpeta);
}
const world = await crearWorld(readFileSync(join(RAIZ, 'motor', 'vendor', 'world', 'world.wasm')));
const tareas = repartir(M.lista, PLANTEL, MURGA), cantados = [], reparto = [];
for (const [i, t] of tareas.entries()) {
  const tt = Date.now();
  let r;
  if (t.motor === 'difonos') {
    mbs[t.opc.voz] ??= await crearMbrola(readFileSync(join(RAIZ, 'motor', 'vendor', 'mbrola', 'mbrola.wasm')), readFileSync(join(RAIZ, 'motor', 'vendor', 'mbrola', t.opc.voz)));
    r = cantarDifonos(mbs[t.opc.voz], t.c.notas, t.opc);
  } else {
    const { b, cache } = banco(t.voz.banco || t.voz.carpeta);
    r = cantarBanco(b, world, t.c.notas, { ...t.opc, cache });
  }
  cantados.push({ x: r.x, sr: r.sr, inicio: r.inicio, pan: t.c.pan, ganancia: t.c.ganancia });
  const lo = Math.min(...t.c.notas.map(n => n.midi)), hi = Math.max(...t.c.notas.map(n => n.midi));
  reparto.push({ lugar: t.clave, voz: t.voz.nombre, tracto: +(t.opc.tracto || 1).toFixed(2), notas: `${nombreNota(lo)}–${nombreNota(hi)}`, pan: +t.c.pan.toFixed(2) });
  console.log(`  ${String(i + 1).padStart(2)}/${tareas.length} ${t.clave.padEnd(12)} ${t.voz.nombre} (garganta ${(t.opc.tracto || 1).toFixed(2)}, ${nombreNota(lo)}–${nombreNota(hi)}): ${((Date.now() - tt) / 1000).toFixed(1)} s · ${seg()}`);
}
const leerWavLoop = archivo => { const b = readFileSync(join(RAIZ, archivo)); const sr = b.readUInt32LE(24); let o = 12; while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4); const m = b.readUInt32LE(o + 4) / 2, d = new Float32Array(m); for (let i = 0; i < m; i++) d[i] = b.readInt16LE(o + 8 + i * 2) / 32768; return { sr, datos: d }; };
const bat = await renderBateria(M.P, DATOS, async a => leerWavLoop(a), SR, M.largo);
const { L, R } = mezclarMurga(cantados, SR, M.largo, bat, M.corte);
const nombre = `${M.op.forma}_${M.op.estilo}_${M.op.semilla}`;
const rWav = join(SAL, nombre + '.wav'), rMp3 = join(SAL, nombre + '.mp3');
writeFileSync(rWav, wavEstereo(L, R, SR));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', rWav, '-codec:a', 'libmp3lame', '-b:a', '192k', rMp3]);
writeFileSync(join(SAL, nombre + '_letra.txt'), M.letra + '\n');
writeFileSync(join(SAL, nombre + '_reparto.json'), JSON.stringify({ pieza: { ...M.op, corte: +M.corte.toFixed(2) }, reparto }, null, 1));
console.log(`→ ${rMp3} (${M.corte.toFixed(1)} s cantados, ${tareas.length} cantores, en ${seg()})`);
