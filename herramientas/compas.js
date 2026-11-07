// De un tramo analizado a compases, frases y acordes por grado: la materia prima de las tablas.
import { CALIDADES } from './analisis.js';

export const mod = (a, n) => ((a % n) + n) % n;
export const GR = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];

// Calidad simplificada: lo que el oído distingue en un coro (la séptima de dominante sí; las otras, casi no)
export function calidadSimple(q) {
  if (q === 'm' || q === 'm7') return 'm';
  if (q === '7') return '7';
  if (q === 'dim' || q === 'dim7') return 'o';
  return '';
}
export function gradoSimple(r, q, t) {
  const s = mod(r - t, 12), c = calidadSimple(q);
  let g = GR[s];
  if (c === 'm' || c === 'o') g = g.replace(/[IV]+/, x => x.toLowerCase());
  return g + (c === 'm' ? '' : c);
}

// Dónde empieza el compás en la semicorchea q: batería si la hay; si no, los acordes.
function rotacion(an, q) {
  const w = Math.max(0, Math.min(an.bateria.length - 1, Math.floor(q / 16)));
  const v = an.bateria[w];
  if (v && v.e > .25 && v.s > .33) return { r: v.r, bat: true, loop: v.loop };
  const b = an.acordes[Math.max(0, Math.min(an.acordes.length - 1, Math.floor(q / 4)))];
  return { r: mod((b ? b[4] : 0) * 4, 16), bat: false, loop: null };
}

export function compasesDe(an) {
  const qMax = an.acordes.length * 4;
  const C = new Map();
  for (let q = 0; q < qMax; q += 2) {
    const { r, bat, loop } = rotacion(an, q);
    const id = Math.floor((q - r) / 16) * 16 + r;
    if (!C.has(id)) C.set(id, { q0: id, bat, loop, golpes: [], acordes: [] });
  }
  const lista = [...C.values()].sort((a, b) => a.q0 - b.q0);
  // Quedan compases solapados donde cambia la rotación: cada uno termina donde empieza el siguiente
  lista.forEach((c, i) => { c.qf = i + 1 < lista.length ? Math.min(lista[i + 1].q0, c.q0 + 16) : c.q0 + 16; });
  const buscar = q => {
    let lo = 0, hi = lista.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lista[m].q0 <= q) lo = m; else hi = m - 1; }
    return lista[lo];
  };
  for (const g of an.golpes) {
    const [q, d, ps, lin] = g;
    const c = buscar(q);
    if (c) c.golpes.push({ q, pos: q - c.q0, d, ps, lin });
  }
  for (const c of lista) {
    const acs = [];
    for (let q = c.q0; q < c.qf; q += 4) {
      const a = an.acordes[Math.floor(q / 4)];
      if (!a) continue;
      acs.push({ pos: q - c.q0, r: a[0], q: a[1], t: a[2], mayor: !!a[3], g: gradoSimple(a[0], a[1], a[2]) });
    }
    c.acordes = acs;
  }
  return lista.filter(c => c.qf > c.q0);
}

// Frases: lo que el coro canta entre dos respiraciones
export function frasesDe(an) {
  const G = an.golpes.map(([q, d, ps, lin]) => ({ q, d, ps, lin }));
  const F = [];
  let act = [];
  for (let i = 0; i < G.length; i++) {
    const g = G[i], sig = G[i + 1];
    act.push(g);
    const hueco = sig ? sig.q - (g.q + g.d) : 99;
    const larga = g.d >= 8;
    if (!sig || hueco >= 3 || (larga && sig.q - g.q >= 8)) { F.push(act); act = []; }
  }
  return F.filter(f => f.length >= 3);
}
