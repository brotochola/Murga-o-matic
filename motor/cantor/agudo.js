// agudo.js — las notas agudas de MBROLA con el color de la voz.
//
// MBROLA arma la voz sumando pedazos de la voz grabada de dos períodos de largo (la voz grabada, unos 110 Hz), con
// ventana de Hann, uno por cada período de la nota (Engine/mbrola.c, OverLapAdd). En el grave se pisan dos pedazos; en
// un Do 5, ocho. Cada armónico de la nota toma el espectro del pedazo en un punto que cae entre los armónicos de la voz
// grabada, y lo que hay ahí depende de cómo se suman sus fases: según la nota, un armónico puede salir 20 dB de más o
// de menos, y los valles entre los formantes se llenan. La vocal cambia de color de una nota a la siguiente y suena a
// otra garganta, como un disco acelerado. Medido con la voz cruda: la «e» de es1 en Do 5 y en La# 4 tiene 26 dB de
// diferencia en el segundo armónico; de medio en medio semitono, el brillo (lo de arriba de 1,8 kHz frente al total)
// salta entre dos notas vecinas el doble arriba de Fa# 4 que entre La 3 y Mi 4 (mediana 2,2 contra 1,1 dB), y en
// algunas notas se dispara (esa «e» en La# 4: casi toda la energía arriba de 1,8 kHz, 9 dB más que medio tono arriba).
//
// El arreglo: MBROLA canta la misma frase también grave (todas las alturas en `ref` Hz, los mismos tiempos), que sale
// limpia. De ahí sale la envolvente de cada momento (predicción lineal), y a la versión aguda se le lleva cada armónico
// a esa envolvente, en tramos de 32 ms cada 16 ms (FFT con ventana de Hann; la ganancia se interpola entre armónicos y
// se suaviza en el tiempo). Los formantes quedan donde los pone la vocal y sólo sube la nota. Entra de a poco entre
// `desde` y `entero` Hz (la altura que canta MBROLA) y sólo en los sonidos con voz.
import { fftIn } from './eq.js';

export const AGUDO = { desde: 230, entero: 330, ref: 120, max: 18, orden: 20 };
const CON_VOZ = new Set(['a', 'e', 'i', 'o', 'u', 'w', 'm', 'n', 'J', 'l', 'L', 'r', 'rr', 'b', 'd', 'g', 'jj']);

// el mismo guion con todas las alturas en hz
export function phoGrave(pho, hz) {
  return pho.split('\n').map(l => {
    const t = l.split(' '); if (t.length < 4) return l;
    for (let i = 3; i < t.length; i += 2) t[i] = String(hz);
    return t.join(' ');
  }).join('\n');
}

// la altura que canta MBROLA en cada muestra (lineal entre los puntos del guion; 0 donde no hay)
function alturas(pho, sr) {
  const T = [], H = []; let ms = 0;
  for (const l of pho.split('\n')) {
    const t = l.split(' '); if (t.length < 2) continue;
    const d = +t[1];
    for (let i = 2; i + 1 < t.length; i += 2) { T.push((ms + d * +t[i] / 100) / 1000 * sr); H.push(+t[i + 1]); }
    ms += d;
  }
  return k => {
    if (!T.length || k < T[0] || k > T[T.length - 1]) return 0;
    let lo = 0, hi = T.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= k) lo = m; else hi = m; }
    const f = T[hi] > T[lo] ? (k - T[lo]) / (T[hi] - T[lo]) : 0; return H[lo] + (H[hi] - H[lo]) * f;
  };
}

// ¿hace falta? (alguna altura del guion por encima de `desde`)
export function hayAgudo(pho, A = AGUDO) {
  for (const l of pho.split('\n')) { const t = l.split(' '); for (let i = 3; i < t.length; i += 2) if (+t[i] > A.desde) return true; }
  return false;
}

// x: lo que cantó MBROLA (agudo); ref: la misma frase grave (phoGrave); g: el guion (para saber qué suena con voz).
// Devuelve x corregido (un Float32Array nuevo, del mismo largo).
export function corregirAgudo(x, ref, sr, g, A = AGUDO) {
  const N = 512, H = N / 2, P = A.orden, n = x.length, f0 = alturas(g.pho, sr);
  const voz = new Uint8Array(n);
  for (const s of g.segs) if (CON_VOZ.has(s.p)) { const a = Math.max(0, Math.round((s.t0 - g.inicio) * sr)), b = Math.min(n, Math.round((s.t1 - g.inicio) * sr)); voz.fill(1, a, b); }
  const ven = new Float64Array(N); for (let i = 0; i < N; i++) ven[i] = .5 - .5 * Math.cos(2 * Math.PI * (i + .5) / N);
  const lag = new Float64Array(P + 1); for (let k = 0; k <= P; k++) lag[k] = Math.exp(-.5 * (2 * Math.PI * 60 * k / sr) ** 2);
  const y = new Float64Array(n + N), norma = new Float64Array(n + N);
  const re = new Float64Array(N), im = new Float64Array(N), r = new Float64Array(P + 1), a = new Float64Array(P + 1), t = new Float64Array(P + 1), seg = new Float64Array(N);
  let Gprev = null, hzG = 0; const al = 1 - Math.exp(-H / sr / .015);
  for (let c = -N / 2; c < n; c += H) {
    const k0 = c, centro = Math.min(n - 1, Math.max(0, c + N / 2));
    const hz = f0(centro), u = Math.max(0, Math.min(1, (hz - A.desde) / (A.entero - A.desde))), w = u * u * (3 - 2 * u) * voz[centro];
    if (hz > 0) hzG = hz;   // (donde el guion no tiene altura, la ganancia que se va apagando sigue en los armónicos de antes)
    // donde no hay nada que corregir, la muestra pasa tal cual (sin FFT)
    if (w <= 0 && !Gprev) { for (let i = 0; i < N; i++) { const k = k0 + i; if (k >= 0 && k < n) { y[k] += x[k] * ven[i] * ven[i]; norma[k] += ven[i] * ven[i]; } } continue; }
    for (let i = 0; i < N; i++) { const k = k0 + i; re[i] = (k >= 0 && k < n ? x[k] : 0) * ven[i]; im[i] = 0; }
    fftIn(re, im);
    let G = null;
    if (w > 0) {
      // la envolvente de la versión grave: predicción lineal con ventana de retardos (no se queda con sus armónicos)
      for (let i = 0; i < N; i++) { const k = k0 + i; seg[i] = (k >= 0 && k < ref.length ? ref[k] : 0) * ven[i]; }
      for (let m = 0; m <= P; m++) { let s = 0; for (let i = m; i < N; i++) s += seg[i] * seg[i - m]; r[m] = s * lag[m]; }
      if (r[0] > 1e-9) {
        r[0] *= 1.0001; a.fill(0); a[0] = 1; let err = r[0];
        for (let m = 1; m <= P; m++) { let s = r[m]; for (let i = 1; i < m; i++) s += a[i] * r[m - i]; const km = -s / err; t.set(a); for (let i = 1; i < m; i++) a[i] = t[i] + km * t[m - i]; a[m] = km; err *= 1 - km * km; if (err <= 0) break; }
        const K = Math.floor(.45 * sr / hz), Pm = new Float64Array(K), Q = new Float64Array(K);
        let sP = 0, sQ = 0;
        for (let h = 1; h <= K; h++) {
          const b0 = Math.max(1, Math.ceil((h - .5) * hz * N / sr)), b1 = Math.min(N / 2, Math.floor((h + .5) * hz * N / sr));
          let p = 0; for (let b = b0; b <= b1; b++) p += re[b] * re[b] + im[b] * im[b];
          // A(e^jω) = Σ a_m e^(−jωm), con las potencias por multiplicación
          const om = 2 * Math.PI * h * hz / sr, cr = Math.cos(om), ci = -Math.sin(om); let ar = 0, ai = 0, zr = 1, zi = 0;
          for (let m = 0; m <= P; m++) { ar += a[m] * zr; ai += a[m] * zi; const nr = zr * cr - zi * ci; zi = zr * ci + zi * cr; zr = nr; }
          Pm[h - 1] = p + 1e-12; Q[h - 1] = 1 / (ar * ar + ai * ai); sP += Pm[h - 1]; sQ += Q[h - 1];
        }
        G = new Float64Array(K);
        for (let h = 0; h < K; h++) G[h] = w * Math.max(-A.max, Math.min(A.max, 10 * Math.log10(Q[h] * sP / sQ / Pm[h])));
      }
    }
    // suavizado en el tiempo, armónico por armónico (donde no corrige, vuelve a 0 dB de a poco)
    if (!G && Gprev) G = new Float64Array(Gprev.length);
    if (G && Gprev) for (let h = 0; h < G.length; h++) { const p = h < Gprev.length ? Gprev[h] : 0; G[h] = p + (G[h] - p) * al; }
    Gprev = G && G.some(v => Math.abs(v) > .05) ? G : null;
    if (Gprev) {
      const L = G.length, gk = new Float64Array(L + 1);
      for (let h = 0; h < L; h++) gk[h] = Math.pow(10, G[h] / 20);
      gk[L] = 1;   // un armónico más arriba del último, ya sin corregir
      for (let b = 0; b <= N / 2; b++) {
        const fh = b * sr / N / hzG - 1, h = Math.floor(fh), fr = fh - h;
        const gn = h < 0 ? gk[0] : h >= L ? 1 : gk[h] * (1 - fr) + gk[h + 1] * fr;
        re[b] *= gn; im[b] *= gn; if (b > 0 && b < N / 2) { re[N - b] = re[b]; im[N - b] = -im[b]; }
      }
    }
    fftIn(re, im, true);
    for (let i = 0; i < N; i++) { const k = k0 + i; if (k >= 0 && k < n) { y[k] += re[i] * ven[i]; norma[k] += ven[i] * ven[i]; } }
  }
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) out[k] = norma[k] > 1e-9 ? y[k] / norma[k] : x[k];
  return out;
}
