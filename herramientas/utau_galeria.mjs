// utau_galeria.mjs — la galería de cantantes: cada voz (bancos de UTAU y difonos de MBROLA) canta la misma frase en
// el registro de cada cuerda, para elegir de oído qué voz va en qué cuerda. Los bancos salen crudos; MBROLA, como el
// que lleva cada cuerda en la página (cantorDifonos).
//
//   node herramientas/utau_galeria.mjs [plantel.json] [frase]   → murga_trabajo/utau/galeria/index.html
//
// plantel.json (por defecto bancos/plantel.json): { "voces": [{ "nombre": "MIKE grave", "banco": "MIKE.zip",
//   "capa": "_dp", ... }, { "nombre": "MBROLA es2", "mbrola": "es2" }] } (o la lista de voces sola). El banco es un
//   .zip de bancos/ o una carpeta («carpeta»): los bancos no van al repositorio.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { abrirBancoNode } from './banco_node.mjs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { melodia } from './solista.mjs';
import { crearBanco, cantarBanco, nombreNota } from '../motor/cantor/banco.js';
import { crearWorld } from '../motor/cantor/world.js';
import { cantarDifonos, cantorDifonos } from '../motor/cantor/difonos.js';
import { crearMbrola } from '../motor/cantor/mbrola.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PL = JSON.parse(readFileSync(process.argv[2] || join(RAIZ, 'bancos', 'plantel.json'), 'utf8'));
const CANTANTES = Array.isArray(PL) ? PL : PL.voces;
const SAL = join(RAIZ, 'murga_trabajo', 'utau', 'galeria');
mkdirSync(SAL, { recursive: true });
const FRASE = process.argv[3] || 'Llegó el carnaval con su bombo y platillo';
// la melodía de solista.mjs va de Sol 3 a Fa# 4: corrida al registro de cada cuerda (RANGOS de compositor.js)
const CUERDAS = [['bajos', -8], ['segundos', -5], ['primos', 0], ['sobreprimos', 3], ['agudo (hasta Do 5)', 6]];
const world = await crearWorld(readFileSync(join(RAIZ, 'motor', 'vendor', 'world', 'world.wasm')));
const mbs = {};
const bancos = new Map();
function banco(carpeta) {
  if (!bancos.has(carpeta)) {
    bancos.set(carpeta, { b: abrirBancoNode(carpeta), cache: new Map() });
  }
  return bancos.get(carpeta);
}
function wav(nombre, x0, sr, inicio = 0) {
  const pad = Math.max(0, Math.round(inicio * sr)), x = new Float32Array(pad + x0.length); x.set(x0, pad);
  let s = 0, c = 0; for (const v of x) if (Math.abs(v) > 1e-4) { s += v * v; c++; }
  const rms = Math.sqrt(s / Math.max(1, c)); let pico = 0; for (const v of x) pico = Math.max(pico, Math.abs(v));
  const g = Math.min(.1 / Math.max(1e-9, rms), .95 / Math.max(1e-9, pico));
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  sr = Math.round(sr); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * g * 32767))), 44 + i * 2);
  writeFileSync(join(SAL, nombre), b);
}
const slug = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const filas = [];
for (const c of CANTANTES) {
  const fila = { ...c, celdas: [] };
  let info = '';
  const donde = c.banco || c.carpeta;
  if (donde) { const { b } = banco(donde); info = `${b.reclist}; grabado en ${b.alturas.map(a => nombreNota(a.midi)).sort().join(', ')}${b.sinArchivo ? `; ${b.sinArchivo} entradas sin su .wav` : ''}`; }
  fila.info = info;
  for (const [cuerda, sube] of CUERDAS) {
    const notas = melodia(FRASE, { tempo: 100, sube });
    const t = performance.now();
    let r;
    if (c.mbrola) {
      mbs[c.mbrola] ??= await crearMbrola(readFileSync(join(RAIZ, 'motor', 'vendor', 'mbrola', 'mbrola.wasm')), readFileSync(join(RAIZ, 'motor', 'vendor', 'mbrola', c.mbrola)));
      const k = cuerda.startsWith('agudo') ? 'sobreprimos' : cuerda;
      r = cantarDifonos(mbs[c.mbrola], notas, { ...cantorDifonos(k, 3, { c: 0 }), voz: c.mbrola, w: c.mbrola !== 'es4', retraso: 0 });
    } else {
      const { b, cache } = banco(donde);
      const { nombre, banco: _b, carpeta, mbrola, nota, ...valores } = c;
      r = cantarBanco(b, world, notas, { semilla: 3, cache, ...valores, capa: c.capa ?? c.color });
    }
    const archivo = `${slug(c.nombre)}_${slug(cuerda)}.wav`;
    wav(archivo, r.x, r.sr, r.inicio);
    const lo = Math.min(...notas.map(n => n.midi)), hi = Math.max(...notas.map(n => n.midi));
    fila.celdas.push({ archivo, rango: `${nombreNota(lo)}–${nombreNota(hi)}` });
    console.log(`${c.nombre} · ${cuerda}: ${((performance.now() - t) / 1000).toFixed(1)} s${r.faltan?.length ? ' · faltan ' + [...new Set(r.faltan)].join(', ') : ''}`);
  }
  filas.push(fila);
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Galería de cantantes</title>
<style>
:root{--fondo:#fafafa;--texto:#222;--suave:#666;--linea:#ddd}
@media (prefers-color-scheme:dark){:root{--fondo:#181818;--texto:#ddd;--suave:#999;--linea:#333}}
body{font:16px/1.45 system-ui,sans-serif;margin:24px auto;max-width:1400px;padding:0 16px;background:var(--fondo);color:var(--texto)}
.tabla{overflow-x:auto}table{border-collapse:collapse;min-width:1000px;width:100%}
th,td{padding:8px;border-bottom:1px solid var(--linea);text-align:left;vertical-align:middle}
thead th{position:sticky;top:0;background:var(--fondo)}th[scope=row]{width:16%}
audio{width:100%;min-width:150px}small{color:var(--suave);font-weight:normal}
</style>
<h1>Galería de cantantes</h1>
<p>Cada voz canta «${esc(FRASE)}» en el registro de cada cuerda (la misma melodía corrida). Los bancos de UTAU salen
crudos, sin ecualizar; MBROLA, como el que lleva cada cuerda en la página. Todo al mismo volumen.</p>
<div class="tabla"><table><thead><tr><th>Cantante</th>${CUERDAS.map(([c], i) => `<th>${esc(c)}<br><small>${esc(filas[0].celdas[i].rango)}</small></th>`).join('')}</tr></thead>
<tbody>${filas.map(f => `<tr><th scope="row">${esc(f.nombre)}<br><small>${esc(f.info || 'difonos de MBROLA')}</small></th>${f.celdas.map(c => `<td><audio controls preload="none" src="${c.archivo}"></audio></td>`).join('')}</tr>`).join('\n')}</tbody></table></div>`;
writeFileSync(join(SAL, 'index.html'), html);
console.log('→ ' + join(SAL, 'index.html'));
