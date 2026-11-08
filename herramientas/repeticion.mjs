// repeticion.mjs — ¿cuánto vuelve el contorno de la melodía a 4, 8, 16, 24 y 32 compases? En lo real, en lo que genera el
// compositor y en el banco de prueba (verdad y transcripto), para ver cuánta repetición borra el transcriptor.
//   node herramientas/repeticion.mjs
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { componer } from '../motor/compositor.js';
import { MODELO } from '../motor/modelo.js';
import { cargarAnalisis } from './medir.js';
import { grilla } from './grilla.js';
import { limpiar } from './limpiar.js';
import { golpes } from './golpes.js';
import { notasVerdad } from './comparar_transcripcion.js';
const W = 32, LAGS = [2, 4, 8, 12, 16];
// melodía (nota de arriba) por ventana de 2 compases: secuencia de intervalos entre golpes, sin ritmo.
// Similitud: la subsecuencia común más larga de intervalos / largo de la más corta (contorno igual aunque cambie el ritmo)
function lcs(a, b) { const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, () => new Int16Array(n + 1)); for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] + 1 : Math.max(d[i - 1][j], d[i][j - 1]); return d[m][n]; }
function medir(G) {  // G: [{q, top}]
  const porV = new Map();
  for (const g of G) { const w = Math.floor(g.q / W); if (!porV.has(w)) porV.set(w, []); porV.get(w).push(g.top); }
  const seq = new Map(); for (const [w, t] of porV) { const s = []; for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1]) s.push(t[i] - t[i - 1]); seq.set(w, s); }
  const out = {};
  for (const L of LAGS) { let si = 0, n = 0; for (const [w, a] of seq) { if (a.length < 3) continue; let mej = 0; for (const dl of [-1, 0, 1]) { const b = seq.get(w + L + dl); if (!b || b.length < 3) continue; mej = Math.max(mej, lcs(a, b) / Math.min(a.length, b.length)); } if (seq.has(w + L)) { n++; if (mej >= .8) si++; } } out[L] = n ? si / n : 0; }
  return out;
}
const prom = (L, k) => (100 * L.reduce((s, r) => s + r[k], 0) / L.length).toFixed(0) + '%';
const show = (n, L) => console.log(n.padEnd(16) + LAGS.map(k => prom(L, k).padStart(6)).join(''));
console.log('contorno de la melodía igual (≥80 % de intervalos en común, sin mirar el ritmo). Compases: ' + LAGS.map(L => String(2 * L).padStart(6)).join(''));
const reales = cargarAnalisis().filter(a => a.golpes?.length > 100);
show('real', reales.map(a => medir(a.golpes.map(([q, d, ps]) => ({ q, top: ps[ps.length - 1] })))));
const M = [];
for (const forma of ['presentacion', 'retirada']) for (const estilo of ['trasnochada', 'catalina', 'todas']) for (let s = 1; s <= 8; s++) M.push(medir(componer(MODELO, { forma, estilo, semilla: s, tonica: s % 12, modo: s % 2 ? 'menor' : 'mayor' }).golpes.map(g => ({ q: g.q, top: g.top })).sort((a, b) => a.q - b.q)));
show('motor', M);
const D = fileURLToPath(new URL('../murga_trabajo/pruebas/', import.meta.url));
const V = [], E = [];
for (const p of ['p1', 'p2', 'p3', 'p4', 'p5']) {
  const fe = D + 'salidas/' + p + '/tv__htdemucs_ft__medium.json'; if (!existsSync(fe)) continue;
  const v = JSON.parse(readFileSync(D + 'coros/' + p + '/verdad.json')), e = JSON.parse(readFileSync(fe));
  const R = v.rejilla; const aQ = t => { let lo = 0, hi = R.length - 1; if (t <= R[0]) return 0; if (t >= R[hi]) return hi; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (R[m] <= t) lo = m; else hi = m; } return lo + (t - R[lo]) / (R[hi] - R[lo]); };
  const gv = new Map(); for (const n of notasVerdad(v)) { const q = Math.round(aQ(n.t0)); gv.set(q, Math.max(gv.get(q) ?? 0, n.p)); }
  V.push(medir([...gv].map(([q, top]) => ({ q, top })).sort((a, b) => a.q - b.q)));
  const tempos = v.secciones.filter(x => x.bateria).map(x => x.tempo).sort((a, b) => a - b);
  const N0 = e.notas.map(([t0, t1, p]) => ({ t: t0, tf: t1, p }));
  const g = grilla(N0, v.largo, tempos[tempos.length >> 1] || 120);
  const base = -Math.min(0, Math.floor(Math.min(...N0.map(n => g.aSemi(n.t))) / 16) * 16);
  const est = limpiar(N0.map(n => { const b = (g.aSemi(n.t) + base) / 4; return { p: n.p, t: n.t, tf: n.tf, b, fin: Math.max(b + .1, (g.aSemi(n.tf) + base) / 4) }; })).limpias;
  E.push(medir(golpes(est).G.map(x => ({ q: x.q, top: x.ps[x.ps.length - 1] }))));
}
show('banco verdad', V); show('banco escrito', E);
for (const parte of ['presentacion', 'retirada']) {
  show('real ' + parte.slice(0, 4), reales.filter(a => (parte === 'retirada') === a.parte.includes('retirada') && a.parte !== 'cancion_final').map(a => medir(a.golpes.map(([q, d, ps]) => ({ q, top: ps[ps.length - 1] })))));
  const L = []; for (const estilo of ['trasnochada', 'catalina', 'todas']) for (let s = 1; s <= 8; s++) { const P = componer(MODELO, { forma: parte, estilo, semilla: s, tonica: s % 12, modo: s % 2 ? 'menor' : 'mayor' }); L.push(medir(P.golpes.map(g => ({ q: g.q, top: g.top })).sort((a, b) => a.q - b.q))); }
  show('motor ' + parte.slice(0, 4), L);
  // sin la bajada (la retirada real también la repite, pero queda al final)
  if (parte === 'retirada') { const L2 = []; for (const estilo of ['trasnochada', 'catalina', 'todas']) for (let s = 1; s <= 8; s++) { const P = componer(MODELO, { forma: parte, estilo, semilla: s, tonica: s % 12, modo: s % 2 ? 'menor' : 'mayor' }); const b = P.secs.find(x => x.nombre === 'Bajada'); L2.push(medir(P.golpes.filter(g => !b || g.q < b.inicio).map(g => ({ q: g.q, top: g.top })).sort((a, b) => a.q - b.q))); } show('motor ret s/baj', L2); }
}
// control: la bajada real (último cuarto de las retiradas) sí se repite: ¿lo ve la medida?
{
  const R = reales.filter(a => a.parte.includes('retirada'));
  const tramo = (a, d, h) => { const qs = a.golpes.map(g => g[0]); const q0 = Math.min(...qs), q1 = Math.max(...qs); return a.golpes.filter(([q]) => q >= q0 + d * (q1 - q0) && q <= q0 + h * (q1 - q0)).map(([q, dd, ps]) => ({ q, top: ps[ps.length - 1] })); };
  show('real ret 0-50%', R.map(a => medir(tramo(a, 0, .5))));
  show('real ret 75-100%', R.map(a => medir(tramo(a, .75, 1))));
}
