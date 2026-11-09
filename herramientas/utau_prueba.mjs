// utau_prueba.mjs — ¿sirve un banco de UTAU para el agudo? (docs/utau.md). Canta unas frases nuestras con el banco
// (motor/cantor/banco.js, con WORLD) y con los difonos de MBROLA, con la misma melodía, la misma curva de altura y el
// mismo volumen, en tres alturas: la del banco del solista (Sol 3 a Fa# 4), tres semitonos más arriba y seis (hasta
// Do 5). Y una escala de «la» sostenidos de Sol 3 a Do 5. Deja los wav y una página para escucharlos lado a lado en
// murga_trabajo/utau/<banco>/.
//
//   node herramientas/utau_prueba.mjs <carpeta del banco> [--nombre lw] [--voz es2] [--solo escala|frases] [--evitar _F]
//     --evitar _F: no usar esas alturas grabadas (el falsete de MIKE: un sobreprimo canta con el pecho)
//
// El banco no va al repositorio (cada banco tiene sus condiciones de uso): se baja aparte y se le pasa la carpeta.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { silabasCantadas, partes } from '../motor/cantor/letra.js';
import { melodia } from './solista.mjs';
import { crearBanco, cantarBanco, nombreNota } from '../motor/cantor/banco.js';
import { crearWorld } from '../motor/cantor/world.js';
import { cantarDifonos } from '../motor/cantor/difonos.js';
import { crearMbrola } from '../motor/cantor/mbrola.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const CARPETA = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!CARPETA || !existsSync(CARPETA)) { console.error('uso: node herramientas/utau_prueba.mjs <carpeta del banco> [--nombre x] [--voz es2]'); process.exit(1); }
const NOMBRE = arg('nombre', 'banco'), VOZ = arg('voz', 'es2'), SOLO = arg('solo', ''), EVITAR = arg('evitar', '') ? arg('evitar').split(',') : null;
const SAL = join(RAIZ, 'murga_trabajo', 'utau', NOMBRE);
mkdirSync(SAL, { recursive: true });

// el banco, desde la carpeta
const rutas = [];
(function andar(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else rutas.push(relative(CARPETA, p).split('\\').join('/')); } })(CARPETA);
const banco = crearBanco(rutas, r => { try { return new Uint8Array(readFileSync(join(CARPETA, r))); } catch { return null; } });
const world = await crearWorld(readFileSync(join(RAIZ, 'motor', 'vendor', 'world', 'world.wasm')));
const mb = await crearMbrola(readFileSync(join(RAIZ, 'motor', 'vendor', 'mbrola', 'mbrola.wasm')), readFileSync(join(RAIZ, 'motor', 'vendor', 'mbrola', VOZ)));
console.log(`banco «${banco.nombre}»: ${banco.entradas.length} entradas, alturas ${banco.alturas.map(a => (a.sufijo || '(sin sufijo)') + '=' + nombreNota(a.midi)).join(' ')}`);

// el mismo volumen para todo (RMS de lo que suena), así se compara el color y no el volumen
// inicio: en qué segundo de la pieza empieza x. Se pone silencio adelante, así el segundo 0 del wav es el de la
// pieza en los dos motores (y utau_medir.mjs sabe dónde está cada nota).
function wav(nombre, x0, sr, inicio = 0) {
  const pad = Math.max(0, Math.round(inicio * sr)), x = new Float32Array(pad + x0.length); x.set(x0.subarray(Math.max(0, -Math.round(inicio * sr))), pad);
  let s = 0, c = 0; for (const v of x) if (Math.abs(v) > 1e-4) { s += v * v; c++; }
  const rms = Math.sqrt(s / Math.max(1, c)); let pico = 0; for (const v of x) pico = Math.max(pico, Math.abs(v));
  const g = Math.min(.1 / Math.max(1e-9, rms), .95 / Math.max(1e-9, pico));
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  sr = Math.round(sr); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * g * 32767))), 44 + i * 2);
  writeFileSync(join(SAL, nombre), b);
}

const FRASES = ['Prometemos volver a la calle', 'Llegó el carnaval con su bombo y platillo', 'Con la garganta rota cantamos igual'];
const SUBE = [0, 3, 6];
const filas = [], cache = new Map(), registro = {};
const opcDifonos = { w: VOZ !== 'es4', semilla: 3, voz: VOZ };
function cantar(nombre, notas, rotulo) {
  let t = performance.now();
  const b = cantarBanco(banco, world, notas, { semilla: 3, cache, evitar: EVITAR });
  const tb = (performance.now() - t) / 1000;
  t = performance.now();
  const d = cantarDifonos(mb, notas, opcDifonos);
  const td = (performance.now() - t) / 1000;
  wav(nombre + '_banco.wav', b.x, b.sr, b.inicio);
  wav(nombre + '_mbrola.wav', d.x, d.sr, d.inicio);
  registro[nombre] = b.frases;
  const dur = notas[notas.length - 1].t1 - notas[0].t0;
  filas.push({ nombre, rotulo, tb, td, dur });
  console.log(`${nombre}: ${rotulo} — banco ${tb.toFixed(1)} s, mbrola ${td.toFixed(1)} s (dura ${dur.toFixed(1)} s)${b.faltan.length ? ' · el banco no tiene: ' + [...new Set(b.faltan)].join(', ') : ''}`);
}

if (SOLO !== 'frases') {
  // la escala: «la» sostenidos, un segundo cada uno, de Sol 3 a Do 5
  const notasEsc = [55, 59, 62, 64, 67, 69, 72], esc = [];
  let t = .35;
  for (const m of notasEsc) { const s = silabasCantadas('la')[0]; esc.push({ t0: t, t1: t + 1.1, midi: m, vel: .8, sil: { ...partes(s.fon), fin: true, acento: true } }); t += 1.6; }
  cantar('escala', esc, 'escala de «la»: ' + notasEsc.map(nombreNota).join(', '));
}
if (SOLO !== 'escala') {
  FRASES.forEach((f, k) => SUBE.forEach(s => {
    const notas = melodia(f, { tempo: 100, sube: s });
    const lo = Math.min(...notas.map(n => n.midi)), hi = Math.max(...notas.map(n => n.midi));
    cantar(`frase${k + 1}_${s ? '+' + s : '0'}`, notas, `«${f}», de ${nombreNota(lo)} a ${nombreNota(hi)}`);
  }));
}
writeFileSync(join(SAL, 'unidades.json'), JSON.stringify(registro, null, 1));
writeFileSync(join(SAL, 'filas.json'), JSON.stringify({ banco: banco.nombre, evitar: EVITAR, voz: VOZ, filas }, null, 1));
// la muestra que trae el banco (character.txt: sample=...), para oír cómo suena en manos de su autor
const rChar = rutas.find(r => r.toLowerCase() === 'character.txt');
const rMuestra = rChar && (/^sample=(.*)$/m.exec(readFileSync(join(CARPETA, rChar), 'latin1'))?.[1] || '').trim();
const hayMuestra = rMuestra && existsSync(join(CARPETA, rMuestra));
if (hayMuestra) writeFileSync(join(SAL, 'muestra_del_autor.wav'), readFileSync(join(CARPETA, rMuestra)));

// la página para escuchar
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Banco de UTAU contra MBROLA</title>
<style>body{font:16px/1.4 system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;background:#fafafa;color:#222}
table{border-collapse:collapse;width:100%}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left;vertical-align:middle}
audio{width:100%;min-width:200px}small{color:#666}@media(prefers-color-scheme:dark){body{background:#181818;color:#ddd}td,th{border-color:#333}small{color:#999}}</style>
<h1>Banco «${banco.nombre}» contra MBROLA (${VOZ})</h1>
<p>Misma melodía, misma curva de altura (portamento, vibrato, caída) y mismo volumen. Cambia sólo la voz. Todas las
grabaciones van al mismo volumen. MBROLA sale como en la página (con su curva de timbre y las eses); el banco, crudo.</p>
${hayMuestra ? `<p>La muestra que trae el banco, hecha por su autor en UTAU: <audio controls preload="none" src="muestra_del_autor.wav"></audio></p>` : ''}
<table><tr><th>Qué</th><th>Banco (WORLD)</th><th>MBROLA</th></tr>
${filas.map(f => `<tr><td>${f.rotulo}<br><small>${f.nombre} · banco ${f.tb.toFixed(1)} s, MBROLA ${f.td.toFixed(1)} s para ${f.dur.toFixed(1)} s</small></td>
<td><audio controls preload="none" src="${f.nombre}_banco.wav"></audio></td><td><audio controls preload="none" src="${f.nombre}_mbrola.wav"></audio></td></tr>`).join('\n')}
</table>`;
writeFileSync(join(SAL, 'escuchar.html'), html);
console.log('→ ' + join(SAL, 'escuchar.html'));
