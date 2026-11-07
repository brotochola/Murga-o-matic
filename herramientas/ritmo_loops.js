// Qué ritmo toca la batería en cada momento, y dónde cae el 1.
// Compara la percusión separada de cada tramo con los loops de La Tríada: cada loop son dos compases
// exactos, así que además de decir el ritmo, dice dónde empieza el compás.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, TRABAJO } from './corpus.js';

const DIR_FF = 'D:/uv/murga/Lib/site-packages/imageio_ffmpeg/binaries';
const FF = join(DIR_FF, readdirSync(DIR_FF).find(f => f.endsWith('.exe')));
const SR = 22050, N = 1024, H = 221;   // cuadros de 10 ms
export const RITMOS = [
  [3, 'Marcha camión 2/4', 2], [4, 'Marcha camión 4/4', 4], [6, 'Base de murga', 4], [8, 'Candombe', 4], [9, "Pa'l costado", 4],
  [10, 'Plena', 4], [11, 'Bossa nova', 4], [13, 'Conga', 4], [14, 'Beat', 4], [15, 'Bolero moderno', 4], [17, 'Son cubano', 4],
  [18, 'Montuno cubano', 4], [19, 'Rumba cubana', 4], [20, 'Miles Davis', 4],
].map(([id, nombre, tpc]) => ({ id, nombre, tpc }));

function leerAudio(path) {
  const r = spawnSync(FF, ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(String(r.stderr));
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4));
}

// FFT radix 2 real, sobre arreglos reutilizados
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

const BANDAS = [[40, 160], [200, 2500], [3000, 10000]].map(([a, b]) => [Math.round(a * N / SR), Math.round(b * N / SR)]);

// Para cada cuadro y banda: cuánto sube la energía (los golpes)
export function golpesPorBanda(path) {
  const x = leerAudio(path);
  const nF = Math.max(0, Math.floor((x.length - N) / H));
  const F = BANDAS.map(() => new Float32Array(nF));
  const prev = BANDAS.map(() => 0);
  for (let f = 0; f < nF; f++) {
    const o = f * H;
    for (let i = 0; i < N; i++) { re[rev[i]] = x[o + i] * ven[i]; im[i] = 0; }
    fft();
    BANDAS.forEach(([a, b], k) => {
      let e = 0;
      for (let i = a; i < b; i++) e += re[i] * re[i] + im[i] * im[i];
      const l = Math.log1p(e * 40);
      F[k][f] = Math.max(0, l - prev[k]);
      prev[k] = l;
    });
  }
  return { F, nF, hz: SR / H };
}

// Plantilla de un loop: golpes por semicorchea, en las tres bandas, siempre en 32 semicorcheas
export function plantillas() {
  return RITMOS.map(r => {
    const { F, nF, hz } = golpesPorBanda(join(RAIZ, 'loops', String(r.id).padStart(2, '0') + '.wav'));
    const durS = r.tpc === 2 ? 16 : 32;
    const largo = nF / hz; // el archivo trae más de dos compases en algunos loops: se usa lo que dura el compás real
    const comp = { 3: .894, 4: 2.7999, 6: 2.0055, 8: 1.9122, 9: 2.1376, 10: 1.7264, 11: 2.8521, 13: 1.7319, 14: 1.7248, 15: 2.5466, 17: 1.9632, 18: 2.4945, 19: 2.4165, 20: 2.6557 }[r.id];
    const seg16 = comp / (r.tpc * 4);
    const V = new Float64Array(3 * 32);
    F.forEach((b, k) => {
      for (let f = 0; f < nF; f++) {
        const q = f / hz / seg16;
        if (q >= durS * Math.max(1, Math.round(largo / (seg16 * durS))) - .5) break;
        V[k * 32 + Math.round(q) % durS] += b[f];
        if (durS === 16) V[k * 32 + 16 + Math.round(q) % 16] += b[f];
      }
    });
    return { ...r, V: normal(V) };
  });
}

function normal(v) {
  const m = v.reduce((s, x) => s + x, 0) / v.length;
  let d = 0; for (let i = 0; i < v.length; i++) { v[i] -= m; d += v[i] * v[i]; }
  d = Math.sqrt(d) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= d;
  return v;
}

// Para un tramo ya analizado: ritmo y desplazamiento del compás por ventanas de 4 compases
export function ritmoDe(nombre, aSemi, base, P, tot) {
  const { F, nF, hz } = golpesPorBanda(join(TRABAJO, 'bateria', nombre + '.flac'));
  const S = [0, 1, 2].map(() => new Float64Array(tot));
  for (let k = 0; k < 3; k++) for (let f = 0; f < nF; f++) {
    const q = Math.round(aSemi(f / hz) + base);
    if (q >= 0 && q < tot) S[k][q] += F[k][f];
  }
  const VENT = 64, SALTO = 16, res = [];
  for (let c = 0; c + VENT <= tot; c += SALTO) {
    const V = new Float64Array(96);
    for (let k = 0; k < 3; k++) for (let q = c; q < c + VENT; q++) V[k * 32 + (q % 32)] += S[k][q];
    const energia = V.reduce((s, x) => s + x, 0) / VENT;
    normal(V);
    const fila = P.map(pl => {
      const R = new Float32Array(32);
      for (let r = 0; r < 32; r++) {
        let s = 0;
        for (let k = 0; k < 3; k++) for (let i = 0; i < 32; i++) s += V[k * 32 + (i + r) % 32] * pl.V[k * 32 + i];
        R[r] = s;
      }
      return R;
    });
    res.push({ c, energia, fila });
  }
  return { ventanas: res, S };
}
