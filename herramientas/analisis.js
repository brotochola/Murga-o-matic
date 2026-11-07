// El análisis de un tramo: tonalidad, acordes y compases, a partir de las notas del coro.
import { nomPc } from './midi.js';

const mod = (a, n) => ((a % n) + n) % n;

// ── Croma por celda ────────────────────────────────────────────────
// Para cada celda (por defecto un pulso): cuánto suena cada nota, y la nota más grave.
export function croma(notas, porPulso = 1) {
  const fin = Math.ceil(Math.max(...notas.map(n => n.fin), 1));
  const n = fin * porPulso;
  const C = Array.from({ length: n }, () => new Float64Array(12));
  const bajo = new Array(n).fill(null);
  for (const x of notas) {
    const a = x.b * porPulso, b = x.fin * porPulso;
    for (let i = Math.floor(a); i < Math.min(n, Math.ceil(b)); i++) {
      const sol = Math.min(b, i + 1) - Math.max(a, i);
      if (sol <= 0) continue;
      C[i][mod(x.p, 12)] += sol;
      if (sol > .2 && (bajo[i] === null || x.p < bajo[i])) bajo[i] = x.p;
    }
  }
  return { C, bajo, porPulso };
}

// ── Tonalidad ──────────────────────────────────────────────────────
const KMAY = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KMEN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const corr = (a, b) => {
  const ma = a.reduce((s, v) => s + v, 0) / 12, mb = b.reduce((s, v) => s + v, 0) / 12;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? n / Math.sqrt(da * db) : 0;
};
export const TONOS = [];
for (let t = 0; t < 12; t++) for (const modo of ['mayor', 'menor']) TONOS.push({ t, modo, perfil: Array.from({ length: 12 }, (_, i) => (modo === 'mayor' ? KMAY : KMEN)[mod(i - t, 12)]) });
export const nomTono = k => `${nomPc(k.t)} ${k.modo}`;

// Una tonalidad por pulso: ventanas de `largo` pulsos y Viterbi con castigo por cambiar.
export function tonalidades(cr, largo = 32, castigo = 16) {
  const n = cr.C.length, K = TONOS.length;
  const em = Array.from({ length: n }, (_, i) => {
    const v = new Array(12).fill(0);
    for (let j = Math.max(0, i - largo / 2); j < Math.min(n, i + largo / 2); j++) for (let c = 0; c < 12; c++) v[c] += cr.C[j][c];
    return TONOS.map(k => corr(v, k.perfil) * 2);
  });
  const dp = Array.from({ length: n }, () => new Float64Array(K)), de = Array.from({ length: n }, () => new Int16Array(K));
  dp[0].set(em[0]);
  for (let i = 1; i < n; i++) {
    let mej = 0; for (let k = 1; k < K; k++) if (dp[i - 1][k] > dp[i - 1][mej]) mej = k;
    for (let k = 0; k < K; k++) {
      const seguir = dp[i - 1][k], saltar = dp[i - 1][mej] - castigo;
      if (seguir >= saltar) { dp[i][k] = seguir + em[i][k]; de[i][k] = k; } else { dp[i][k] = saltar + em[i][k]; de[i][k] = mej; }
    }
  }
  const camino = new Array(n);
  let k = 0; for (let j = 1; j < K; j++) if (dp[n - 1][j] > dp[n - 1][k]) k = j;
  for (let i = n - 1; i >= 0; i--) { camino[i] = k; k = de[i][k]; }
  return camino.map(i => TONOS[i]);
}

// ── Acordes ────────────────────────────────────────────────────────
// El vocabulario de los cifrados reales: tríadas y séptima de dominante, y poco más.
export const CALIDADES = {
  '': { iv: [0, 4, 7], pena: 0 },
  m: { iv: [0, 3, 7], pena: 0 },
  7: { iv: [0, 4, 7, 10], pena: .03 },
  dim: { iv: [0, 3, 6], pena: .16 },
};

// Cuánto se usa cada grado en los cifrados de murga: una ayuda suave para decidir entre acordes parecidos
const USO = {
  mayor: { '0': .16, '0m': -.1, '07': .02, '2m': .05, '27': .02, '4m': .03, '47': .03, '5': .12, '5m': .03, '7': .12, '77': .12, '9m': .08, '97': .02, '10': .01, '11dim': .01 },
  menor: { '0m': .16, '07': .05, '5m': .12, '7': .1, '77': .12, '3': .08, '8': .08, '10': .08, '2dim': .03, '11dim': .02, '2m': -.05 },
};
const usoDe = (pl, k) => USO[k.modo][String(((pl.r - k.t) % 12 + 12) % 12) + pl.q] ?? -.12;
const PLANTILLAS = [];
for (let r = 0; r < 12; r++) for (const q of Object.keys(CALIDADES)) {
  const pcs = new Set(CALIDADES[q].iv.map(i => (r + i) % 12));
  PLANTILLAS.push({ r, q, pcs, pena: CALIDADES[q].pena, nombre: nomPc(r) + q });
}
export const nomAcorde = a => (a ? a.nombre : '—');

const ESC = { mayor: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10, 11] };
const diatonico = (pl, k) => { const e = ESC[k.modo].map(i => (k.t + i) % 12); return [...pl.pcs].filter(p => e.includes(p)).length / pl.pcs.size; };

// Un acorde por celda, con Viterbi: cambiar de acorde cuesta, y conviene que el bajo sea la fundamental.
export function acordes(cr, tonos, cambio = .9) {
  const n = cr.C.length, P = PLANTILLAS.length, por = cr.porPulso;
  const em = Array.from({ length: n }, (_, i) => {
    const c = cr.C[i]; const tot = c.reduce((s, v) => s + v, 0);
    const r = new Float64Array(P);
    if (tot < .1) return r;  // silencio: el acorde sigue
    const k = tonos[Math.min(tonos.length - 1, Math.floor(i / por))];
    const bajo = cr.bajo[i] === null ? null : mod(cr.bajo[i], 12);
    for (let j = 0; j < P; j++) {
      const pl = PLANTILLAS[j];
      let den = 0; for (const p of pl.pcs) den += c[p];
      let s = (den - .7 * (tot - den)) / tot - pl.pena;
      if (bajo === pl.r) s += .14; else if (bajo !== null && pl.pcs.has(bajo)) s += .03;
      s += .1 * (diatonico(pl, k) - .7) + usoDe(pl, k);
      r[j] = s;
    }
    return r;
  });
  const dp = Array.from({ length: n }, () => new Float64Array(P)), de = Array.from({ length: n }, () => new Int16Array(P));
  dp[0].set(em[0]);
  for (let i = 1; i < n; i++) {
    let mej = 0; for (let k = 1; k < P; k++) if (dp[i - 1][k] > dp[i - 1][mej]) mej = k;
    for (let k = 0; k < P; k++) {
      const seguir = dp[i - 1][k], saltar = dp[i - 1][mej] - cambio;
      if (seguir >= saltar) { dp[i][k] = seguir + em[i][k]; de[i][k] = k; } else { dp[i][k] = saltar + em[i][k]; de[i][k] = mej; }
    }
  }
  const camino = new Array(n);
  let k = 0; for (let j = 1; j < P; j++) if (dp[n - 1][j] > dp[n - 1][k]) k = j;
  for (let i = n - 1; i >= 0; i--) { camino[i] = k; k = de[i][k]; }
  return camino.map(i => PLANTILLAS[i]);
}

// El acorde como grado de la tonalidad: «V7», «iv», «bVII», con el número de semitonos de la tónica.
const GR = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
export function grado(a, k) {
  const s = mod(a.r - k.t, 12);
  let g = GR[s];
  if (a.q.startsWith('m') && a.q !== 'maj7' || a.q.startsWith('dim')) g = g.replace(/[IV]+/, x => x.toLowerCase());
  return g + (a.q === 'm' ? '' : a.q);
}
