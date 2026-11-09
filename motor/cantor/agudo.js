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
// `desde` y `entero` Hz (la altura que canta MBROLA) y sólo en el medio de las vocales.
import { fftIn, pesoA } from './eq.js';

export const AGUDO = { desde: 230, entero: 330, ref: 120, max: 18, orden: 20, vol: 12 };
const VOCAL = p => 'aeiou'.includes(p);

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
  // sólo en las vocales, y no en sus bordes: las consonantes y el paso a la vocal son lo que hace entender la palabra, y
  // corregidos (aunque sean sonoras: b, d, g, l, m, n, r) se entendía menos (Whisper: de 44 a 49 % de palabras mal).
  // Entra de a poco en los primeros y en los últimos 24 ms de la vocal.
  const voz = new Float32Array(n), R = Math.round(.024 * sr);
  for (const s of g.segs) if (VOCAL(s.p)) {
    const a = Math.max(0, Math.round((s.t0 - g.inicio) * sr)), b = Math.min(n, Math.round((s.t1 - g.inicio) * sr));
    for (let k = a; k < b; k++) voz[k] = Math.max(0, Math.min(1, (k - a) / R, (b - k) / R));
  }
  const ven = new Float64Array(N); for (let i = 0; i < N; i++) ven[i] = .5 - .5 * Math.cos(2 * Math.PI * (i + .5) / N);
  const lag = new Float64Array(P + 1); for (let k = 0; k <= P; k++) lag[k] = Math.exp(-.5 * (2 * Math.PI * 60 * k / sr) ** 2);
  const y = new Float64Array(n + N), norma = new Float64Array(n + N);
  const re = new Float64Array(N), im = new Float64Array(N), r = new Float64Array(P + 1), a = new Float64Array(P + 1), t = new Float64Array(P + 1), seg = new Float64Array(N);
  const rr = new Float64Array(N), ri = new Float64Array(N), Ab = new Float64Array(N / 2 + 1);
  for (let b = 1; b <= N / 2; b++) Ab[b] = pesoA(b * sr / N);
  let Gprev = null, Lsm = 0; const al = 1 - Math.exp(-H / sr / .015);
  for (let c = -N / 2; c < n; c += H) {
    const k0 = c, centro = Math.min(n - 1, Math.max(0, c + N / 2));
    const hz = f0(centro), u = Math.max(0, Math.min(1, (hz - A.desde) / (A.entero - A.desde))), w = u * u * (3 - 2 * u) * voz[centro];
    // donde no hay nada que corregir, la muestra pasa tal cual (sin FFT)
    if (w <= 0) { Gprev = null; Lsm = 0; for (let i = 0; i < N; i++) { const k = k0 + i; if (k >= 0 && k < n) { y[k] += x[k] * ven[i] * ven[i]; norma[k] += ven[i] * ven[i]; } } continue; }
    for (let i = 0; i < N; i++) { const k = k0 + i; re[i] = (k >= 0 && k < n ? x[k] : 0) * ven[i]; im[i] = 0; }
    fftIn(re, im);
    let G = null, PAref = -1;
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
        // y cuánto se oye la versión grave en este momento (ponderación A)
        for (let i = 0; i < N; i++) { rr[i] = seg[i]; ri[i] = 0; }
        fftIn(rr, ri); PAref = 0; for (let b = 1; b <= N / 2; b++) PAref += (rr[b] * rr[b] + ri[b] * ri[b]) * Ab[b];
      }
    }
    // suavizado en el tiempo, armónico por armónico, sólo adentro de la vocal: fuera de ella no queda nada (la cola
    // del suavizado caía en la consonante de después y se la comía: «tres copas» → «tre copa»)
    if (G && Gprev) for (let h = 0; h < G.length; h++) { const p = h < Gprev.length ? Gprev[h] : 0; G[h] = p + (G[h] - p) * al; }
    Gprev = G && G.some(v => Math.abs(v) > .05) ? G : null;
    if (Gprev) {
      const L = G.length, gk = new Float64Array(L + 1);
      for (let h = 0; h < L; h++) gk[h] = Math.pow(10, G[h] / 20);
      gk[L] = 1;   // un armónico más arriba del último, ya sin corregir
      for (let b = 0; b <= N / 2; b++) {
        const fh = b * sr / N / hz - 1, h = Math.floor(fh), fr = fh - h;
        const gn = h < 0 ? gk[0] : h >= L ? 1 : gk[h] * (1 - fr) + gk[h + 1] * fr;
        re[b] *= gn; im[b] *= gn; if (b > 0 && b < N / 2) { re[N - b] = re[b]; im[N - b] = -im[b]; }
      }
    }
    // El volumen: MBROLA canta el agudo más bajo (con la voz cruda, de La 4 para arriba unos 5 dB(A) menos que en Sol 3).
    // Cada momento corregido suena tan fuerte como la misma frase grave, medido con ponderación A.
    let Lobj = 0;
    if (PAref > 0) { let pc = 0; for (let b = 1; b <= N / 2; b++) pc += (re[b] * re[b] + im[b] * im[b]) * Ab[b]; Lobj = w * Math.max(-A.vol, Math.min(A.vol, 10 * Math.log10(PAref / (pc + 1e-20)))); }
    Lsm = PAref > 0 ? Lsm + (Lobj - Lsm) * al : 0;
    if (Math.abs(Lsm) > .01) { const gl = Math.pow(10, Lsm / 20); for (let b = 0; b < N; b++) { re[b] *= gl; im[b] *= gl; } }
    fftIn(re, im, true);
    for (let i = 0; i < N; i++) { const k = k0 + i; if (k >= 0 && k < n) { y[k] += re[i] * ven[i]; norma[k] += ven[i] * ven[i]; } }
  }
  const out = new Float32Array(n);
  for (let k = 0; k < n; k++) out[k] = norma[k] > 1e-9 ? y[k] / norma[k] : x[k];
  return out;
}
