// eq.js — ecualizador de fase lineal (FIR por muestreo en frecuencia) aplicado con FFT por bloques.
// curva: [[Hz, dB], ...] (interpolada en escala logarítmica)
function fftIn(re, im, inv = false) {
  const N = re.length;
  for (let i = 1, j = 0; i < N; i++) { let b = N >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let l = 2; l <= N; l <<= 1) {
    const a = (inv ? 2 : -2) * Math.PI / l, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < N; i += l) { let cr = 1, ci = 0; for (let k = 0; k < l / 2; k++) { const u = i + k, v = u + l / 2, tr = re[v] * cr - im[v] * ci, ti = re[v] * ci + im[v] * cr; re[v] = re[u] - tr; im[v] = im[u] - ti; re[u] += tr; im[u] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
  if (inv) for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
}
export function gananciaEn(curva, f) {
  if (f <= curva[0][0]) return curva[0][1];
  for (let i = 1; i < curva.length; i++) if (f <= curva[i][0]) { const [f0, g0] = curva[i - 1], [f1, g1] = curva[i]; const u = Math.log(f / f0) / Math.log(f1 / f0); return g0 + (g1 - g0) * u; }
  return curva[curva.length - 1][1];
}
export function disenar(curva, sr, M = 2048) {
  const re = new Float64Array(M), im = new Float64Array(M);
  for (let k = 0; k <= M / 2; k++) { const g = Math.pow(10, gananciaEn(curva, Math.max(20, k * sr / M)) / 20); re[k] = g; if (k && k < M / 2) re[M - k] = g; }
  fftIn(re, im, true);
  // centrar y ventanear: fase lineal, retardo M/2
  const h = new Float32Array(M);
  for (let n = 0; n < M; n++) { const src = (n + M / 2) % M; h[n] = re[src] * (.5 - .5 * Math.cos(2 * Math.PI * n / (M - 1))); }
  return h;
}
export function ecualizar(x, sr, curva) {
  const M = 2048, h = disenar(curva, sr, M), N = 8192, B = N - M;
  const hr = new Float64Array(N), hi = new Float64Array(N); hr.set(h); fftIn(hr, hi);
  const y = new Float32Array(x.length);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let o = 0; o < x.length; o += B) {
    re.fill(0); im.fill(0);
    for (let i = 0; i < B && o + i < x.length; i++) re[i] = x[o + i];
    fftIn(re, im);
    for (let k = 0; k < N; k++) { const a = re[k] * hr[k] - im[k] * hi[k], b = re[k] * hi[k] + im[k] * hr[k]; re[k] = a; im[k] = b; }
    fftIn(re, im, true);
    for (let i = 0; i < N; i++) { const j = o + i - M / 2; if (j >= 0 && j < y.length) y[j] += re[i]; }
  }
  return y;
}
