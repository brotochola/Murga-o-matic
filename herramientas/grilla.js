// La grilla de un tramo, sacada de los ataques del coro.
// El coro canta sílabas en corcheas y semicorcheas muy parejas, así que el pulso se puede leer de ahí.
// Beat This! salta mucho con la batería sincopada de murga: lo usamos sólo para saber el tempo aproximado.
//
// Para cada ventana de 8 segundos se busca el período de semicorchea y la fase que juntan más ataques
// (una transformada de Fourier de los ataques), un Viterbi sigue el período sin dejarlo saltar,
// y la fase se desenrolla ventana a ventana. La grilla sigue el tempo, pero no se deforma sílaba por sílaba.

const VENTANA = 8, SALTO = 1, MIN_FUERZA = .22;

function ataques(notas) {
  const ts = notas.map(n => n.t).sort((a, b) => a - b), O = [];
  for (const t of ts) {
    const u = O[O.length - 1];
    if (u && t - u.t < .03) { u.n++; u.s += t; } else O.push({ t, n: 1, s: t });
  }
  return O.map(o => ({ t: o.s / o.n, w: Math.sqrt(o.n) }));
}

export function grilla(notas, largo, bpmAprox) {
  const O = ataques(notas);
  // La negra de murga va de 70 a 150: Beat This! a veces da el doble o la mitad
  let bpm = bpmAprox;
  while (bpm > 150) bpm /= 2;
  while (bpm < 70) bpm *= 2;
  const p0 = 15 / bpm;
  const P = [];
  for (let p = 15 / 150; p < 15 / 70; p *= 1.0025) P.push(p);
  const nP = P.length;
  const centros = [];
  for (let c = 0; c <= largo + 1e-6; c += SALTO) centros.push(c);
  const T = centros.length;

  // Fuerza y fase de cada período en cada ventana
  const fuerza = Array.from({ length: T }, () => new Float32Array(nP));
  const fase = Array.from({ length: T }, () => new Float32Array(nP));
  let i0 = 0;
  for (let k = 0; k < T; k++) {
    const c = centros[k];
    while (i0 < O.length && O[i0].t < c - VENTANA / 2) i0++;
    const v = [];
    for (let i = i0; i < O.length && O[i].t < c + VENTANA / 2; i++) {
      const u = (O[i].t - c) / VENTANA;
      v.push({ d: O[i].t - c, w: O[i].w * Math.cos(Math.PI * u) ** 2 });
    }
    const tot = v.reduce((s, x) => s + x.w, 0);
    if (tot < 1.5) continue;
    // Si todo cae en corcheas, una grilla más fina también calza: por eso se exige calzar en
    // semicorchea, corchea y negra a la vez. La fase se toma de la corchea.
    for (let j = 0; j < nP; j++) {
      const om = 2 * Math.PI / P[j];
      let re1 = 0, im1 = 0, re2 = 0, im2 = 0, re4 = 0, im4 = 0;
      for (const x of v) {
        const a = om * x.d;
        re1 += x.w * Math.cos(a); im1 += x.w * Math.sin(a);
        re2 += x.w * Math.cos(a / 2); im2 += x.w * Math.sin(a / 2);
        re4 += x.w * Math.cos(a / 4); im4 += x.w * Math.sin(a / 4);
      }
      fuerza[k][j] = (.35 * Math.hypot(re1, im1) + .45 * Math.hypot(re2, im2) + .2 * Math.hypot(re4, im4)) / tot;
      fase[k][j] = Math.atan2(im2, re2);
    }
  }

  // Viterbi sobre el período
  const previo = new Float64Array(nP), atras = Array.from({ length: T }, () => new Int16Array(nP));
  const prior = P.map(p => -.25 * Math.log(p / p0) ** 2 / (.25 * .25));
  for (let j = 0; j < nP; j++) previo[j] = fuerza[0][j] + .02 * prior[j];
  const ALC = 40;  // ±10 % por segundo
  const pena = Array.from({ length: 2 * ALC + 1 }, (_, i) => .02 * Math.abs(i - ALC) + (i === ALC ? 0 : .03));
  for (let k = 1; k < T; k++) {
    const nuevo = new Float64Array(nP);
    for (let j = 0; j < nP; j++) {
      let mej = -Infinity, de = j;
      for (let m = Math.max(0, j - ALC); m <= Math.min(nP - 1, j + ALC); m++) {
        const v = previo[m] - pena[m - j + ALC];
        if (v > mej) { mej = v; de = m; }
      }
      nuevo[j] = mej + fuerza[k][j] + .02 * prior[j];
      atras[k][j] = de;
    }
    previo.set(nuevo);
  }
  let j = 0; for (let m = 1; m < nP; m++) if (previo[m] > previo[j]) j = m;
  const camino = new Array(T);
  for (let k = T - 1; k >= 0; k--) { camino[k] = j; j = atras[k][j]; }

  // Fase desenrollada: n(t) cuenta semicorcheas y vale un entero en cada ataque
  const n = new Float64Array(T), libre = new Array(T).fill(false);
  n[0] = -2 * fase[0][camino[0]] / (2 * Math.PI);
  for (let k = 1; k < T; k++) {
    const p = P[camino[k]], q = P[camino[k - 1]];
    const previsto = n[k - 1] + SALTO * .5 * (1 / p + 1 / q);
    const f = fuerza[k][camino[k]];
    libre[k] = f < MIN_FUERZA;
    if (libre[k]) { n[k] = previsto; continue; }
    const fr = -2 * fase[k][camino[k]] / (2 * Math.PI);   // la fase de la corchea, contada en semicorcheas
    n[k] = fr + 2 * Math.round((previsto - fr) / 2);
  }
  const aSemi = t => {
    const x = t / SALTO, k = Math.max(0, Math.min(T - 2, Math.floor(x)));
    return n[k] + (n[k + 1] - n[k]) * (x - k);
  };
  return {
    aSemi,
    semicorchea: centros.map((_, k) => P[camino[k]]),
    fuerza: centros.map((_, k) => fuerza[k][camino[k]]),
    libre,
    centros,
  };
}

// Qué tan bien calzan los ataques: 1 = clavados, 0 = al azar
export function ajuste(xs, per) {
  let s = 0, c = 0;
  for (const x of xs) { const a = 2 * Math.PI * x / per; s += Math.sin(a); c += Math.cos(a); }
  return Math.hypot(s, c) / Math.max(1, xs.length);
}
