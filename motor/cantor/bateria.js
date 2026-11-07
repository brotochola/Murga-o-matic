// bateria.js — los loops reales de La Tríada, cortados golpe por golpe para cambiar de tempo sin cambiar
// la afinación (lo mismo que hace la página del Murga-o-matic), sobre arreglos: anda en Node y en el navegador.
// cargar(archivo) → Promise<{sr, datos: Float32Array}>

function rebanadas(x, sr) {
  const h = Math.round(.004 * sr), m = Math.floor(x.length / h);
  const E = new Float32Array(m);
  for (let i = 0; i < m; i++) { let s = 0; for (let j = i * h; j < (i + 1) * h; j++) s += x[j] * x[j]; E[i] = Math.log(1e-7 + s); }
  const O = [0]; let ult = 0;
  for (let i = 5; i < m - 1; i++) { let p = 0; for (let k = 2; k <= 5; k++) p += E[i - k]; if (E[i] - p / 4 > 1.2 && i - ult >= 10 && E[i] >= E[i + 1] - .2) { O.push(Math.max(0, (i - 2) * h) / sr); ult = i; } }
  return O;
}

function pegar(y, sr, x, xsr, when, rate, dur) {
  const O = rebanadas(x, xsr), fin = x.length / xsr, ln = fin / rate;
  const fi = Math.round(.0015 * sr), fo = Math.round(.002 * sr), k = xsr / sr;
  for (let t = 0; t < dur; t += ln) for (let i = 0; i < O.length; i++) {
    const a = O[i], b = i + 1 < O.length ? O[i + 1] : fin, w = t + a / rate;
    if (w >= dur) break;
    const L = Math.round(Math.min(b - a + .006, (b - a) / rate + .002) * sr), i0 = Math.round((when + w) * sr), s0 = a * xsr;
    for (let j = 0; j < L && i0 + j < y.length; j++) {
      const src = s0 + j * k, si = Math.floor(src); if (si + 1 >= x.length) break;
      let e = 1; if (i && j < fi) e = j / fi; else if (j > L - fo) e = (L - j) / fo;
      if (i0 + j >= 0) y[i0 + j] += (x[si] + (x[si + 1] - x[si]) * (src - si)) * e;
    }
  }
}
function pegarTal(y, sr, x, xsr, when, dur, fade = 0) {
  const k = xsr / sr, n = Math.min(Math.round(dur * sr), Math.floor((x.length - 1) / k)), f = Math.round(fade * sr);
  for (let j = 0; j < n; j++) { const i = Math.round(when * sr) + j; if (i < 0 || i >= y.length) continue; const src = j * k, si = Math.floor(src); let e = 1; if (f && j > n - f) e = (n - j) / f; y[i] += (x[si] + (x[si + 1] - x[si]) * (src - si)) * e; }
}

export async function renderBateria(P, datos, cargar, sr, largo) {
  const y = new Float32Array(Math.ceil(largo * sr));
  const secs = P.secs;
  for (let i = 0; i < secs.length; i++) {
    const s = secs[i];
    const ritmo = datos.ritmos.find(r => r.id === s.loop) || datos.ritmos.find(r => r.id === 6);
    const [, corte] = datos.acompana[ritmo.id] || [null, null];
    if (s.tipo === 'llamada') {
      const sigR = secs[i + 1]?.loop ?? s.loop; const [ll] = datos.acompana[sigR] || [null];
      if (ll) { const f = datos.frases[ll]; const a = await cargar(f.archivo); pegarTal(y, sr, a.datos, a.sr, s.t1 - f.ultimo, f.seg); }
      continue;
    }
    if (!s.bateria) continue;
    const loop = await cargar(ritmo.archivo);
    const rate = s.tempo / ritmo.bpm;
    const sig = secs[i + 1];
    const hayCorte = corte && sig && !sig.bateria && sig.tipo !== 'llamada';
    let finLoop = s.t1; if (hayCorte) finLoop = s.t1 - datos.frases[corte].ultimo;
    const ini = y.length;
    pegar(y, sr, loop.datos, loop.sr, s.t0, rate, finLoop - s.t0);
    if (s.fade) { const a = Math.round(s.t0 * sr), b = Math.min(y.length, Math.round(s.t1 * sr)); for (let j = a; j < b; j++) y[j] *= 1 - .7 * (j - a) / (b - a); }
    if (hayCorte) { const f = datos.frases[corte]; const a = await cargar(f.archivo); pegarTal(y, sr, a.datos, a.sr, finLoop, Math.min(f.seg, f.ultimo + .9), .5); }
    void ini;
  }
  return y;
}
