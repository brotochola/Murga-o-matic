// mezcla.js — junta cantores y batería en estéreo, con una sala chica (reverberación de Schroeder)
import { cantar } from './cantor.js';
import { ecualizar } from './eq.js';

export function sala(L, R, sr, { mezcla = .16, largo = 1.0 } = {}) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map(n => Math.round(n * sr / 44100));
  const aps = [225, 556, 441].map(n => Math.round(n * sr / 44100));
  const g = Math.pow(10, -3 * (1100 / sr) / largo);   // decaimiento
  const proc = (x, desfase) => {
    const out = new Float32Array(x.length);
    const cb = combs.map(n => ({ b: new Float32Array(n + desfase), i: 0, f: 0 }));
    for (let s = 0; s < x.length; s++) {
      let acc = 0; const v = x[s] * .15;
      for (const c of cb) { const o = c.b[c.i]; c.f = o * .7 + c.f * .3; c.b[c.i] = v + c.f * g * 1.0; c.i = (c.i + 1) % c.b.length; acc += o; }
      out[s] = acc;
    }
    let y = out;
    for (const n of aps) { const b = new Float32Array(n + desfase); let i = 0; const z = new Float32Array(y.length); for (let s = 0; s < y.length; s++) { const o = b[i]; const v = y[s] + o * .5; b[i] = v; z[s] = o - v * .5; i = (i + 1) % b.length; } y = z; }
    return y;
  };
  const wl = proc(L, 0), wr = proc(R, 23);
  for (let s = 0; s < L.length; s++) { L[s] = L[s] * (1 - mezcla) + wl[s] * mezcla * 2; R[s] = R[s] * (1 - mezcla) + wr[s] * mezcla * 2; }
}

// cantores: [{tipo, semilla, pan, ganancia, notas}] → {L, R}. La voz pasa por el ecualizador (curva medida
// contra un coro real); el ruido de las consonantes va aparte, para que el ecualizador no lo infle.
export function mezclarCoro(lista, sr, largo, alAvanzar, { curva = null, ruido = 1 } = {}) {
  const n = Math.ceil(largo * sr), L = new Float32Array(n), R = new Float32Array(n), RL = new Float32Array(n), RR = new Float32Array(n);
  lista.forEach((c, i) => {
    const { voz, ruido: z } = cantar(c.notas, { sr, tipo: c.tipo, semilla: c.semilla, retraso: c.retraso, separar: true });
    const gl = Math.cos((c.pan + 1) * Math.PI / 4) * c.ganancia, gr = Math.sin((c.pan + 1) * Math.PI / 4) * c.ganancia;
    for (let s = 0; s < Math.min(n, voz.length); s++) { L[s] += voz[s] * gl; R[s] += voz[s] * gr; RL[s] += z[s] * gl; RR[s] += z[s] * gr; }
    alAvanzar?.(i + 1, lista.length);
  });
  const EL = curva ? ecualizar(L, sr, curva) : L, ER = curva ? ecualizar(R, sr, curva) : R;
  for (let s = 0; s < n; s++) { EL[s] += RL[s] * ruido; ER[s] += RR[s] * ruido; }
  return { L: EL, R: ER };
}

export function normalizar(L, R, pico = .89) {
  let p = 1e-9; for (let s = 0; s < L.length; s++) p = Math.max(p, Math.abs(L[s]), Math.abs(R[s]));
  const k = 1.15 / p, t = Math.tanh(1.15);
  for (let s = 0; s < L.length; s++) { L[s] = Math.tanh(L[s] * k) / t * pico; R[s] = Math.tanh(R[s] * k) / t * pico; }
}
