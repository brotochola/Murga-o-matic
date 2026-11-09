// utau_medir.mjs — mide lo que cantó utau_prueba.mjs: la altura de cada nota sostenida de la escala (mediana, en cents
// contra la pedida), cuánto tiempo la voz queda 15 dB abajo de lo que suena (cortes), y el brillo (lo de arriba de
// 1,8 kHz frente al total) nota por nota, banco contra MBROLA.
//
//   node herramientas/utau_medir.mjs murga_trabajo/utau/<banco>
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerWav, nombreNota } from '../motor/cantor/banco.js';
import { crearWorld } from '../motor/cantor/world.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const D = resolve(process.argv[2] || join(RAIZ, 'murga_trabajo', 'utau', 'banco'));
const world = await crearWorld(readFileSync(join(RAIZ, 'motor', 'vendor', 'world', 'world.wasm')));
const NOTAS = [55, 59, 62, 64, 67, 69, 72];

function medir(archivo) {
  const { x, sr } = leerWav(new Uint8Array(readFileSync(archivo)));
  const a = world.analizar(Float64Array.from(x), sr, { harvest: false, f0min: 70, f0max: 900 });
  const P = a.periodo / 1000, filas = [];
  NOTAS.forEach((m, k) => {
    // la vocal sostenida: de 0,3 a 0,9 s después del comienzo de la nota (las notas empiezan cada 1,6 s desde 0,35)
    const t0 = .35 + 1.6 * k, q0 = Math.round((t0 + .3) / P), q1 = Math.round((t0 + .9) / P);
    const cents = [], brillo = [];
    for (let q = q0; q < q1 && q < a.cuadros; q++) {
      if (a.f0[q] > 0) cents.push(1200 * Math.log2(a.f0[q] / (440 * 2 ** ((m - 69) / 12))));
      let tot = 0, alto = 0;
      for (let b = 0; b < a.ancho; b++) { const f = b * sr / a.fft, e = a.sp[q * a.ancho + b]; tot += e; if (f > 1800) alto += e; }
      brillo.push(10 * Math.log10(alto / tot));
    }
    cents.sort((p, q) => p - q); brillo.sort((p, q) => p - q);
    filas.push({ nota: nombreNota(m), cents: cents.length ? cents[cents.length >> 1] : NaN, sonoro: cents.length / (q1 - q0), brillo: brillo[brillo.length >> 1] });
  });
  // cortes: cuadros de 10 ms 15 dB abajo del nivel de lo que suena (el percentil 80), mientras se canta
  const W = Math.round(.01 * sr), e = [];
  for (let i = 0; i + W <= x.length; i += W) { let s = 0; for (let j = 0; j < W; j++) s += x[i + j] ** 2; e.push(10 * Math.log10(s / W + 1e-12)); }
  const ord = [...e].sort((p, q) => p - q), ref = ord[Math.floor(ord.length * .8)];
  let cantando = 0, abajo = 0;
  NOTAS.forEach((m, k) => { const a0 = Math.round((.35 + 1.6 * k) / .01), a1 = Math.round((.35 + 1.6 * k + 1.1) / .01); for (let i = a0; i < a1 && i < e.length; i++) { cantando++; if (e[i] < ref - 15) abajo++; } });
  return { filas, cortes: abajo / Math.max(1, cantando) };
}
for (const quien of ['banco', 'mbrola']) {
  const f = join(D, `escala_${quien}.wav`);
  if (!existsSync(f)) continue;
  const r = medir(f);
  console.log(`\n${quien}: ${(r.cortes * 100).toFixed(1)} % del tiempo cantando, 15 dB abajo`);
  console.log('nota   cents  sonoro  brillo (dB arriba de 1,8 kHz)');
  for (const x of r.filas) console.log(`${x.nota.padEnd(5)} ${x.cents.toFixed(0).padStart(6)} ${(x.sonoro * 100).toFixed(0).padStart(6)} % ${x.brillo.toFixed(1).padStart(7)}`);
}
