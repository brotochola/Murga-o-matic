// exportar_voces.mjs — compone una pieza, le pone letra y guarda cada cantor sintético por separado (seco, sin sala),
// la batería aparte y un manifiesto. Es la entrada de transcripcion/convertir_coro.py, que pasa cada voz por Seed-VC.
//
//   node cantada/herramientas/exportar_voces.mjs [opciones]
//     --forma presentacion|retirada   --estilo trasnochada|catalina|todas|muneca|pasteles
//     --semilla 4  --tonica 9 (0 = Do … 11 = Si)  --modo menor|mayor  --largo corta|normal|larga
//     --tema "la plata no alcanza"    --letra-semilla 1
//     --letra archivo.txt   (un verso por línea, las partes separadas por una línea vacía; si no, la escribe el letrista)
//     --por-cuerda          (un cantor por línea distinta en vez de los 13: convierte más rápido)
//     --salida murga_trabajo/cantada/<nombre>
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { componer } from '../../motor/compositor.js';
import { MODELO } from '../../motor/modelo.js';
import { tiempos, metrica, silabear, cantores } from '../cantor/coro.js';
import { cantar } from '../cantor/cantor.js';
import { ecualizar } from '../cantor/eq.js';
import { renderBateria } from '../cantor/bateria.js';
import { partesAEscribir } from '../cantor/letrista.js';
import { escribirLetraLocal } from '../cantor/letrista_local.js';
import { medir } from '../cantor/letra.js';
import { DATOS } from '../cantor/datos.js';
import { CURVA } from '../cantor/timbre.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const op = {
  forma: arg('forma', 'presentacion'), estilo: arg('estilo', 'trasnochada'), semilla: +arg('semilla', 4), tonica: +arg('tonica', 9),
  modo: arg('modo', 'menor'), largo: arg('largo', 'corta'),
};
const tema = arg('tema', ''), semLetra = +arg('letra-semilla', 1), porCuerda = args.includes('--por-cuerda');
const nombre = `${op.forma}_${op.estilo}_${op.semilla}`;
const SAL = resolve(arg('salida', join(RAIZ, 'murga_trabajo', 'cantada', nombre)));
const SR = 44100;
mkdirSync(join(SAL, 'voces'), { recursive: true });

// la pieza, igual que la página
const LLAMADAS = Object.fromEntries(DATOS.ritmos.map(r => { const a = DATOS.acompana[r.id]; if (!a || !a[0]) return [r.id, 0]; const c4 = r.compas * 4 / r.tpc; return [r.id, Math.ceil((DATOS.frases[a[0]].ultimo + .05) / c4)]; }));
const P = componer(MODELO, { ...op, llamadas: LLAMADAS });
const { T, fin } = tiempos(P); P.total = fin; P.T = T;
const M = metrica(P), partes = partesAEscribir(M, op.forma);

// la letra: de un archivo, o del letrista
let textos;
const archLetra = arg('letra', null);
if (archLetra) {
  const bloques = readFileSync(archLetra, 'utf8').replace(/\r/g, '').split(/\n\s*\n/).map(b => b.split('\n').map(l => l.trim()).filter(Boolean));
  textos = partes.map((p, i) => p.versos.map((_, k) => bloques[i]?.[k] || ''));
} else textos = escribirLetraLocal({ forma: op.forma, tema, metrica: M, semilla: op.semilla * 1000 + semLetra }).textos;
const letras = {}; partes.forEach((p, i) => { for (const s of p.secciones) letras[s] = textos[i]; });
const { porQ } = silabear(P, letras);

// los cantores
let lista = cantores(P, porQ, { semilla: op.semilla });
if (porCuerda) {
  // un cantor por línea distinta: los que cantan lo mismo en una cuerda se juntan (se vuelven a abrir al mezclar)
  const vistas = new Map(); const nueva = [];
  for (const c of lista) { const firma = c.cuerda + '|' + c.notas.map(n => n.midi + '@' + n.t0.toFixed(2)).join(','); if (vistas.has(firma)) { vistas.get(firma).copias.push({ pan: c.pan, ganancia: c.ganancia, semilla: c.semilla }); continue; } c.copias = [{ pan: c.pan, ganancia: c.ganancia, semilla: c.semilla }]; vistas.set(firma, c); nueva.push(c); }
  lista = nueva;
}
const largo = fin + 1.6, n = Math.ceil(largo * SR);
const wav = (ruta, x) => {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  writeFileSync(ruta, b);
};
const manifiesto = { sr: SR, largo, pieza: { ...op, tema, total: fin, nombre }, cantores: [], bateria: null, sala: { mezcla: .24, largo: 1.7 } };
const t0 = Date.now();
lista.forEach((c, i) => {
  // cada cantor seco, con la ecualización calibrada (voz y consonantes juntas), normalizado a -3 dB
  const { voz, ruido } = cantar(c.notas, { sr: SR, tipo: c.tipo, semilla: c.semilla, separar: true });
  const x = new Float32Array(n); x.set(voz.subarray(0, n));
  const e = ecualizar(x, SR, CURVA);
  for (let s = 0; s < Math.min(n, ruido.length); s++) e[s] += ruido[s];
  let pk = 1e-9; for (const v of e) pk = Math.max(pk, Math.abs(v));
  for (let s = 0; s < n; s++) e[s] *= .7 / pk;
  const archivo = `voces/${String(i + 1).padStart(2, '0')}_${c.cuerda}.wav`;
  wav(join(SAL, archivo), e);
  manifiesto.cantores.push({ archivo, cuerda: c.cuerda, tipo: c.tipo, pan: +c.pan.toFixed(3), ganancia: +(c.ganancia * pk / .7).toFixed(5), copias: c.copias || null, notas: c.notas.length, desde: +c.notas[0].t0.toFixed(3), hasta: +c.notas[c.notas.length - 1].t1.toFixed(3) });
  process.stdout.write(`\r  cantor ${i + 1}/${lista.length}`);
});
// batería
const leerWav = archivo => { const b = readFileSync(join(RAIZ, archivo)); const sr = b.readUInt32LE(24); let o = 12; while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4); const m = b.readUInt32LE(o + 4) / 2, d = new Float32Array(m); for (let i = 0; i < m; i++) d[i] = b.readInt16LE(o + 8 + i * 2) / 32768; return { sr, datos: d }; };
const bat = await renderBateria(P, DATOS, async a => leerWav(a), SR, largo);
let pb = 1e-9; for (const v of bat) pb = Math.max(pb, Math.abs(v));
for (let s = 0; s < bat.length; s++) bat[s] *= .7 / pb;
wav(join(SAL, 'bateria.wav'), bat);
manifiesto.bateria = { archivo: 'bateria.wav', relacion: .55 };   // pico de la batería = 0,55 × pico del coro, como en la página
// la letra, para leer y para volver a usar
const txt = partes.map((p, i) => textos[i].join('\n')).join('\n\n') + '\n';
writeFileSync(join(SAL, 'letra.txt'), txt);
writeFileSync(join(SAL, 'manifiesto.json'), JSON.stringify(manifiesto, null, 1));
const exactos = partes.reduce((a, p, i) => a + p.versos.filter((v, k) => medir(textos[i][k]).n === v.silabas).length, 0), total = partes.reduce((a, p) => a + p.versos.length, 0);
console.log(`\n${nombre}: ${lista.length} cantores, ${fin.toFixed(1)} s, ${exactos}/${total} versos justos, en ${((Date.now() - t0) / 1000).toFixed(1)} s → ${SAL}`);
