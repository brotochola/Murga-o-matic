// El timbre del coro de murga, medido: compara el espectro promedio de las voces reales (separadas con
// Demucs) con el de las muestras que usa la página, y deja la ecualización que acerca unas a otras.
//   node herramientas/timbre.js
import { spawnSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, TRABAJO } from './corpus.js';

const DIR_FF = 'D:/uv/murga/Lib/site-packages/imageio_ffmpeg/binaries';
const FF = join(DIR_FF, readdirSync(DIR_FF).find(f => f.endsWith('.exe')));
const SR = 44100, N = 4096, H = 8192;

function leer(path) {
  const r = spawnSync(FF, ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 31 - 1 });
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4));
}

const cosT = new Float64Array(N / 2), sinT = new Float64Array(N / 2), rev = new Uint16Array(N), ven = new Float64Array(N);
for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos(2 * Math.PI * i / N); sinT[i] = -Math.sin(2 * Math.PI * i / N); }
for (let i = 0, b = Math.log2(N); i < N; i++) { let r = 0; for (let j = 0; j < b; j++) if (i >> j & 1) r |= 1 << (b - 1 - j); rev[i] = r; ven[i] = .5 - .5 * Math.cos(2 * Math.PI * i / N); }
const re = new Float64Array(N), im = new Float64Array(N);
function fft() {
  for (let l = 2; l <= N; l <<= 1) {
    const m = l >> 1, s = N / l;
    for (let i = 0; i < N; i += l) for (let j = 0, k = 0; j < m; j++, k += s) {
      const a = i + j, b = a + m;
      const tr = re[b] * cosT[k] - im[b] * sinT[k], ti = re[b] * sinT[k] + im[b] * cosT[k];
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
}

// Espectro promedio de los cuadros que suenan fuerte
function espectro(x, desde = 0, hasta = x.length) {
  const P = new Float64Array(N / 2);
  let n = 0;
  const rmsTodos = [];
  for (let o = desde; o + N < hasta; o += H) { let e = 0; for (let i = 0; i < N; i += 8) e += x[o + i] ** 2; rmsTodos.push(e); }
  const umbral = [...rmsTodos].sort((a, b) => a - b)[Math.floor(rmsTodos.length * .6)] || 0;
  let f = 0;
  for (let o = desde; o + N < hasta; o += H, f++) {
    if (rmsTodos[f] < umbral) continue;
    let tot = 0;
    for (let i = 0; i < N; i++) { const v = x[o + i] * ven[i]; re[rev[i]] = v; im[i] = 0; }
    fft();
    for (let i = 0; i < N / 2; i++) { const e = re[i] * re[i] + im[i] * im[i]; P[i] += e; tot += e; }
    n++;
  }
  if (n) for (let i = 0; i < N / 2; i++) P[i] /= n;
  return P;
}

const BANDAS = [];
for (let f = 125; f <= 10000; f *= 2 ** (1 / 3)) BANDAS.push(Math.round(f));
function enBandas(P) {
  return BANDAS.map(f => {
    const a = Math.floor(f / 2 ** (1 / 6) * N / SR), b = Math.ceil(f * 2 ** (1 / 6) * N / SR);
    let s = 0; for (let i = a; i < b; i++) s += P[i];
    return 10 * Math.log10(s / (b - a) + 1e-12);
  });
}

// Voces reales
const dirV = join(TRABAJO, 'voces');
const reales = readdirSync(dirV).filter(f => f.endsWith('.flac'));
const R = BANDAS.map(() => 0);
for (const f of reales) {
  const P = enBandas(espectro(leer(join(dirV, f))));
  const ref = P[BANDAS.findIndex(x => x >= 1000)];
  P.forEach((v, i) => { R[i] += (v - ref) / reales.length; });
}
// Muestras: las notas donde más canta el coro
const M = BANDAS.map(() => 0);
let cuenta = 0;
for (const b of ['musyng', 'fluid']) for (let p = 50; p <= 70; p += 2) {
  const x = leer(join(RAIZ, 'coro', b, p + '.mp3'));
  const P = enBandas(espectro(x, Math.round(.09 * SR), Math.min(x.length, Math.round(1.6 * SR))));
  const ref = P[BANDAS.findIndex(q => q >= 1000)];
  P.forEach((v, i) => { M[i] += v - ref; });
  cuenta++;
}
M.forEach((v, i) => { M[i] = v / cuenta; });

console.log('banda   real  muestra  dif');
const dif = BANDAS.map((f, i) => {
  const d = R[i] - M[i];
  console.log(String(f).padStart(5), R[i].toFixed(1).padStart(7), M[i].toFixed(1).padStart(7), d.toFixed(1).padStart(7));
  return d;
});
// Suavizado y tope: una curva amplia, no un peine
const lisa = dif.map((_, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 1); j <= Math.min(dif.length - 1, i + 1); j++) { s += dif[j]; c++; } return Math.max(-12, Math.min(16, s / c)); });
const salida = BANDAS.map((f, i) => [f, +lisa[i].toFixed(1)]);
writeFileSync(join(RAIZ, 'motor', 'timbre.js'), '// Generado por herramientas/timbre.js: frecuencia y ganancia en dB, para que las muestras se acerquen a las voces reales.\nexport const TIMBRE = ' + JSON.stringify(salida) + ';\n');
console.log(reales.length, 'tramos ·', JSON.stringify(salida));
