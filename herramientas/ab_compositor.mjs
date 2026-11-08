// ab_compositor.mjs — rasgos del jurado por estilo: compositor_v1 contra compositor, mismas semillas. Para cada rasgo,
// la distancia de la mediana de lo generado a la mediana de los tramos reales de ese estilo, en anchos de la norma.
//   node herramientas/ab_compositor.mjs [estilo] [semillas por forma]   (SEM0=1000 corre otras semillas)
import * as V1 from '../motor/compositor_v1.js';
import * as V2 from '../motor/compositor.js';
import { MODELO } from '../motor/modelo.js';
import { rasgos, notasDePieza, normas, rasgosReal, RASGOS } from './jurado.js';
import { cargarAnalisis } from './medir.js';
const SEM0 = +(process.env.SEM0 || 0);
const estilo = process.argv[2] || 'catalina', N = +(process.argv[3] || 16);
const reales = cargarAnalisis().filter(a => a.notas?.length > 200 && (estilo === 'todas' || a.murga.toLowerCase().includes(estilo === 'muneca' ? 'muñeca' : estilo)));
const NR = normas(cargarAnalisis().filter(a => a.notas?.length > 200).map(rasgosReal));
const R = reales.map(rasgosReal);
const med = (L, k) => { const v = L.map(r => r[k]).filter(Number.isFinite).sort((a, b) => a - b); return v[v.length >> 1]; };
const run = M => { const L = []; for (const forma of ['presentacion', 'retirada']) for (let s = 1; s <= N; s++) L.push(rasgos(notasDePieza(M.componer(MODELO, { forma, estilo, semilla: s + SEM0, tonica: (s + SEM0) % 12, modo: (s + SEM0) % 2 ? 'menor' : 'mayor', tercia: +(process.env.TERCIA || 0) })))); return L; };
const A = run(V1), B = run(V2);
const filas = Object.keys(RASGOS).map(k => ({ k, real: med(R, k), a: med(A, k), b: med(B, k), da: Math.abs(med(A, k) - med(R, k)) / NR[k].ancho, db: Math.abs(med(B, k) - med(R, k)) / NR[k].ancho }));
filas.sort(process.env.POR_NUEVO ? (x, y) => y.db - x.db : (x, y) => Math.abs(y.db - y.da) - Math.abs(x.db - x.da));
console.log(`estilo ${estilo}: ${reales.length} tramos reales, ${A.length} piezas por motor. Distancia a la mediana real en anchos (v1 → nuevo)`);
for (const f of filas.slice(0, +(process.env.FILAS || 14))) console.log(f.k.padEnd(12), RASGOS[f.k][1].slice(0, 44).padEnd(45), 'real', f.real.toFixed(2), ' v1', f.a.toFixed(2), ' nuevo', f.b.toFixed(2), '  ', f.da.toFixed(2), '→', f.db.toFixed(2));
const tot = L => L.reduce((s, f) => s + f, 0);
console.log('suma de distancias', tot(filas.map(f => f.da)).toFixed(1), '→', tot(filas.map(f => f.db)).toFixed(1));
