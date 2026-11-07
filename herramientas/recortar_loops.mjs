// Los loops de batería, recortados del video "17 ritmos fundamentales de murga" de La Tríada, y su control.
//
//   node herramientas/recortar_loops.mjs              rehace loops/NN.wav y escribe compás y bpm de cada ritmo
//   node herramientas/recortar_loops.mjs --revisar    busca cada loops/NN.wav en el video y mide si está bien cortado
//   node herramientas/recortar_loops.mjs --revisar carpeta    lo mismo con otra carpeta de loops
//
// El audio del video va en murga_trabajo/loops_originales/ (no va al repositorio):
//   yt-dlp -f bestaudio -o "murga_trabajo/loops_originales/%(id)s.%(ext)s" https://www.youtube.com/watch?v=0DSJVulzDYw
//
// Cada loop son dos compases tal como los tocaron: empieza 4 ms antes del ataque del "1" y termina 4 ms antes del
// "1" siguiente, con los bordes en un cruce por cero. Los bateristas aceleran durante cada demostración (el candombe
// va de unos 118 a 126 bpm), así que el largo se mide en el audio, de golpe a golpe, en un tramo parejo: ni la
// entrada ni el final. Calcularlo con el tempo de otra parte del capítulo deja un salto en cada vuelta.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './corpus.js';
import { RITMOS } from './ritmo_loops.js';

const DIR_FF = 'D:/uv/murga/Lib/site-packages/imageio_ffmpeg/binaries';
const FF = join(DIR_FF, readdirSync(DIR_FF).find(f => f.endsWith('.exe')));
const VIDEO = join(RAIZ, 'murga_trabajo', 'loops_originales', '0DSJVulzDYw.webm');
const SR = 44100;

// ritmo: [primera muestra, largo en muestras, ganancia, capítulo del video en s]
const CORTES = {
  3: [2578968, 78770, .684, 49, 68],
  4: [3368446, 246631, .649, 68, 87],      // el único ciclo entero antes del redoble
  6: [4737691, 177358, .679, 96, 123],
  8: [7494442, 168376, .649, 132, 179],
  9: [8403247, 189106, .640, 179, 202],    // el ciclo siguiente es el último y su "1" llega tarde: largo por el patrón
  10: [9210942, 152498, .631, 202, 220],   // empieza en el platillo: el bombo entra 18 ms después
  11: [10109572, 251899, .684, 220, 246],
  13: [13032727, 151923, .600, 275, 306],
  14: [14087644, 152048, .589, 306, 329],
  15: [15113158, 224910, .691, 329, 355],  // el ciclo siguiente ya va al redoble: largo según el pulso del propio ciclo
  17: [17245975, 172872, .683, 377, 408],
  18: [18305072, 220491, .666, 408, 438],
  19: [20260396, 213221, .668, 438, 487],  // en la rumba el "1" es un silencio: el corte cae en un hueco
  20: [22065259, 233858, .551, 487, 519],
};

function leer(p) {
  const r = spawnSync(FF, ['-v', 'error', '-i', p, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(String(r.stderr));
  const b = r.stdout; return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}
function wav(path, x) {
  const n = x.length, b = Buffer.alloc(44 + 2 * n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + 2 * n, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(2 * SR, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(2 * n, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + 2 * i);
  writeFileSync(path, b);
}

// ── el control ──
function biquad(x, a, b, lo, hi) {   // pasabanda
  const y = new Float32Array(b - a), f0 = Math.sqrt(lo * hi), w0 = 2 * Math.PI * f0 / SR, al = Math.sin(w0) * (hi - lo) / (2 * f0);
  const a0 = 1 + al, a1 = -2 * Math.cos(w0), a2 = 1 - al; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = a; i < b; i++) { const xi = x[i] || 0, v = (al * xi - al * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = xi; y2 = y1; y1 = v; y[i - a] = v; }
  return y;
}
// fuerza de ataque en cuadros de 2 ms: cuánto sube la energía en bombo, redoblante y platillos, suavizada
const H = 88, FPS = SR / H;
function fuerza(x, a, b, sigma) {
  const n = Math.floor((b - a) / H), S = new Float64Array(n);
  for (const [lo, hi] of [[40, 160], [200, 2500], [3000, 10000]]) {
    const y = biquad(x, a, b, lo, hi), E = new Float64Array(n); let tot = 0;
    for (let f = 0; f < n; f++) { let s = 0; for (let j = f * H; j < (f + 1) * H; j++) s += y[j] * y[j]; E[f] = Math.log(1e-9 + s); }
    const O = new Float64Array(n); for (let f = 2; f < n; f++) { O[f] = Math.max(0, E[f] - Math.max(E[f - 1], E[f - 2])); tot += O[f]; }
    for (let f = 0; f < n; f++) S[f] += O[f] / (tot / n + 1e-9);
  }
  const P = new Float64Array(n), k = Math.ceil(2.5 * sigma);
  for (let f = 0; f < n; f++) { let s = 0, w = 0; for (let d = -k; d <= k; d++) if (S[f + d] !== undefined) { const g = Math.exp(-d * d / (2 * sigma * sigma)); s += S[f + d] * g; w += g; } P[f] = s / w; }
  return P;
}
function ncc(A, ia, B, ib, n) {
  if (ia < 0 || ib < 0 || ia + n > A.length || ib + n > B.length) return NaN;
  let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sa += A[ia + i]; sb += B[ib + i]; }
  const ma = sa / n, mb = sb / n;
  for (let i = 0; i < n; i++) { const p = A[ia + i] - ma, q = B[ib + i] - mb; sab += p * q; saa += p * p; sbb += q * q; }
  return sab / Math.sqrt(saa * sbb + 1e-20);
}
// la negra tocada en [a, b): picos de la autocorrelación en 1..16 negras
function negra(V, a, b, q0) {
  const P = fuerza(V, a, b, 3), pts = []; let q = q0 * FPS;
  for (let k = 1; k <= 16; k++) {
    const r = Math.max(6, .06 * q); if (k * q + r > P.length * .6) break;
    let bk = 0, bc = -2; for (let L = Math.round(k * q - r); L <= Math.round(k * q + r); L++) { const c = ncc(P, 0, P, L, P.length - L); if (c > bc) { bc = c; bk = L; } }
    if (bc > .05) pts.push([k, bk, bc]);
    let s = 0, w = 0; for (const [k2, L2, c2] of pts) { s += c2 * L2; w += c2 * k2; } q = s / w;
  }
  let smk = 0, smm = 0; for (const [k, L, c] of pts) { smk += c * k * L; smm += c * k * k; }
  return smk / smm / FPS;
}

function revisar(carpeta) {
  const V = leer(VIDEO); let malos = 0;
  console.log('ritmo                 en el video   largo    costura  pulso   ataque del "1"');
  for (const r of RITMOS) {
    const L = leer(join(carpeta, String(r.id).padStart(2, '0') + '.wav')), n = L.length, [, , , c0s, c1s] = CORTES[r.id];
    const c0 = Math.round(c0s * SR), c1 = Math.min(V.length, Math.round(c1s * SR));
    // dónde está: envolvente de 1 ms en todo el capítulo y después la onda, en los mejores candidatos
    const env = (x, a, b) => { const m = Math.floor((b - a) / 44), E = new Float64Array(m); for (let i = 0; i < m; i++) { let s = 0; for (let j = a + i * 44; j < a + i * 44 + 44; j++) s += x[j] * x[j]; E[i] = Math.sqrt(s); } return E; };
    const EL = env(L, 0, n), EV = env(V, c0, c1), cand = [];
    for (let k = 0; k + EL.length <= EV.length; k++) cand.push([k, ncc(EL, 0, EV, k, EL.length)]);
    cand.sort((x, y) => y[1] - x[1]);
    let p = 0, copia = -2;
    for (const [k] of cand.filter((c, i) => cand.slice(0, i).every(o => Math.abs(o[0] - c[0]) > 100)).slice(0, 5))
      for (let d = -100; d <= 100; d++) { const c = ncc(L, 0, V, c0 + k * 44 + d, n); if (c > copia) { copia = c; p = c0 + k * 44 + d; } }
    // costura: el ciclo del loop contra el ciclo siguiente en el original (±80 ms); 0 = la vuelta cae donde la tocaron
    const a = Math.max(c0, p - n), b = Math.min(c1, p + 2 * n + SR), P = fuerza(V, a, b, 4), f = t => Math.round((t - a) / H), len = Math.round(n / H);
    let s = 0, bc = -2; for (let d = -40; d <= 40; d++) { const c = ncc(P, f(p), P, f(p + n) + d, len); if (c > bc) { bc = c; s = d; } }
    const costura = s * H / SR * 1000;
    // pulso: ocho negras (cuatro en 2/4) medidas dentro del tramo del loop, contra el largo del archivo
    const porCiclo = 2 * r.tpc, T = negra(V, p, p + n, n / SR / porCiclo) * porCiclo, pulso = (T - n / SR) * 1000;
    // ataque del "1": el loop no puede empezar con el golpe ya sonando. Energía de los primeros 5 ms contra la ventana
    // de 5 ms más fuerte de los primeros 60 ms, si ahí hay un golpe de verdad (en la rumba el "1" es un silencio)
    const rms = i0 => { let s = 0; for (let i = i0; i < i0 + 220; i++) s += L[i] * L[i]; return Math.sqrt(s / 220); };
    let pico = 0, todo = 0; for (let i = 0; i < .06 * SR; i += 44) pico = Math.max(pico, rms(i)); for (let i = 0; i + 220 < n; i += 220) todo = Math.max(todo, rms(i));
    const ataque = pico < .25 * todo || rms(0) < .35 * pico;
    const mal = copia < .95 || Math.abs(costura) > 15 || Math.abs(pulso) > 60 || !ataque; malos += mal;
    console.log(`${String(r.id).padStart(2)} ${r.nombre.padEnd(18)} ${(p / SR).toFixed(3).padStart(8)} s  ${(n / SR).toFixed(3)} s  ${(costura >= 0 ? '+' : '') + Math.round(costura)} ms`.padEnd(62) +
      `${(pulso >= 0 ? '+' : '') + Math.round(pulso)} ms`.padEnd(8) + `${ataque ? 'entero' : 'MORDIDO'}${copia < .95 ? `  (no es copia del video: ${copia.toFixed(2)})` : ''}${mal ? '   <- revisar' : ''}`);
  }
  console.log(`\ncostura: cuánto más tarde que el final del loop vuelve el ciclo en el original (bien: ±15 ms).\npulso: ocho negras medidas dentro del loop, menos su largo. Es orientativo: en los ritmos sincopados erra por 40 ms;\n  sirve para los errores grandes, donde la costura puede engancharse un golpe más allá (avisa pasados los ±60 ms).\n${malos ? `${malos} loops para revisar.` : 'Todos bien cortados.'}`);
}

if (!existsSync(VIDEO)) { console.error(`Falta el audio del video en ${VIDEO}. Bajarlo con:\n  yt-dlp -f bestaudio -o "murga_trabajo/loops_originales/%(id)s.%(ext)s" https://www.youtube.com/watch?v=0DSJVulzDYw`); process.exit(1); }
const iR = process.argv.indexOf('--revisar');
if (iR >= 0) revisar(process.argv[iR + 1] || join(RAIZ, 'loops'));
else {
  const V = leer(VIDEO);
  for (const r of RITMOS) {
    const [a, n, g] = CORTES[r.id], x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = V[a + i] * g;
    wav(join(RAIZ, 'loops', String(r.id).padStart(2, '0') + '.wav'), x);
    const compas = +(n / SR / 2).toFixed(4);
    console.log(`${String(r.id).padStart(2)} ${r.nombre.padEnd(18)} "compas":${compas}  "bpm":${(60 * r.tpc / compas).toFixed(1)}`);
  }
  console.log('Compás y bpm van en motor/app.js, motor/cantor/datos.js y en la tabla comp de herramientas/ritmo_loops.js.');
}
