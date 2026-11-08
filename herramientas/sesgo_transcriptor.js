// sesgo_transcriptor.js — ¿qué rasgos del jurado cambia el transcriptor? Sobre los coros de prueba, que tienen las notas
// verdaderas, calcula cada rasgo (herramientas/jurado.js) dos veces: con la verdad y con lo que escribió el transcriptor
// después de la misma limpieza que se hace con las murgas reales. La diferencia es el sesgo del transcriptor en ese rasgo,
// y se compara con el ancho de la norma del corpus real: un sesgo de 1 ancho ya mueve la nota del jurado.
//
//   node herramientas/sesgo_transcriptor.js [--caso tv__htdemucs_ft__medium] [--sin-limpiar]
//
// La grilla es la verdadera en las dos: los segundos pasan a pulsos con la grilla exacta de la pieza. Así el
// sesgo es sólo de las notas, no de la grilla.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rasgos, normas, rasgosReal, RASGOS } from './jurado.js';
import { cargarAnalisis } from './medir.js';
import { limpiar } from './limpiar.js';
import { notasVerdad } from './comparar_transcripcion.js';
import { grilla } from './grilla.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRUEBAS = join(RAIZ, 'murga_trabajo', 'pruebas');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const CASO = arg('caso', 'tv__htdemucs_ft__medium');
const LIMPIAR = !args.includes('--sin-limpiar');
// --grilla-exacta: lo escrito se pasa a pulsos con la grilla verdadera (sólo el error de las notas). Si no, con la grilla
// que analizar.js saca de los ataques, como en las murgas reales (el error de las notas más el de la grilla).
const EXACTA = args.includes('--grilla-exacta');
// --adelanto 0.025: corre los ataques escritos tantos segundos más tarde antes de cuantizar
const ADELANTO = +arg('adelanto', 0);

// segundos → pulsos con la grilla exacta de la pieza (el segundo de cada semicorchea); si no está, con el tempo de cada sección
function mapaRejilla(R) {
  return t => { if (t <= R[0]) return 0; let lo = 0, hi = R.length - 1; if (t >= R[hi]) return hi / 4; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (R[m] <= t) lo = m; else hi = m; } return (lo + (t - R[lo]) / Math.max(1e-6, R[hi] - R[lo])) / 4; };
}
function mapa(secs) {
  let b = 0; const S = secs.map(s => { const r = { ...s, b0: b }; b += (s.t1 - s.t0) * s.tempo / 60; return r; });
  return t => { let s = S[0]; for (const x of S) if (x.t0 <= t) s = x; return s.b0 + (t - s.t0) * s.tempo / 60; };
}
function aPulsos(N, aB) { return N.map(n => ({ b: aB(n.t0), fin: aB(n.t1), p: n.p, t: n.t0, tf: n.t1 })).sort((a, b) => a.b - b.b || a.p - b.p); }

const corpus = cargarAnalisis().filter(a => a.notas?.length > 200).map(rasgosReal);
const N = normas(corpus);
const claves = Object.keys(RASGOS);
const filas = Object.fromEntries(claves.map(k => [k, { v: [], e: [] }]));
let piezas = 0;
for (const p of readdirSync(join(PRUEBAS, 'coros'))) {
  const fv = join(PRUEBAS, 'coros', p, 'verdad.json'), fe = join(PRUEBAS, 'salidas', p, CASO + '.json');
  if (!existsSync(fv) || !existsSync(fe)) continue;
  const v = JSON.parse(readFileSync(fv, 'utf8')), e = JSON.parse(readFileSync(fe, 'utf8'));
  const aB = v.rejilla ? mapaRejilla(v.rejilla) : mapa(v.secciones);
  const ver = aPulsos(notasVerdad(v), aB);
  const crudas = e.notas.map(([t0, t1, p]) => ({ t0: t0 + ADELANTO, t1: t1 + ADELANTO, p }));
  let est;
  if (EXACTA) est = aPulsos(crudas, aB);
  else {
    // igual que analizarTramo: grilla de los ataques, desde el tempo aproximado
    const tempos = v.secciones.filter(x => x.bateria).map(x => x.tempo).sort((a, b) => a - b);
    const N0 = crudas.map(n => ({ t: n.t0, tf: n.t1, p: n.p }));
    const g = grilla(N0, v.largo, tempos[tempos.length >> 1] || 120);
    const base = -Math.min(0, Math.floor(Math.min(...N0.map(n => g.aSemi(n.t))) / 16) * 16);
    est = N0.map(n => { const b = (g.aSemi(n.t) + base) / 4; return { p: n.p, t: n.t, tf: n.tf, b, fin: Math.max(b + .1, (g.aSemi(n.tf) + base) / 4) }; }).sort((a, b) => a.b - b.b || a.p - b.p);
  }
  if (LIMPIAR) est = limpiar(est).limpias;
  const rv = rasgos(ver), re = rasgos(est);
  for (const k of claves) { filas[k].v.push(rv[k]); filas[k].e.push(re[k]); }
  piezas++;
}
const media = a => a.filter(Number.isFinite).reduce((s, x) => s + x, 0) / Math.max(1, a.filter(Number.isFinite).length);
const out = claves.map(k => { const mv = media(filas[k].v), me = media(filas[k].e); return { k, nombre: RASGOS[k][1], grupo: RASGOS[k][0], verdad: mv, escrito: me, sesgo: (me - mv) / N[k].ancho, p50: N[k].p50 }; });
out.sort((a, b) => Math.abs(b.sesgo) - Math.abs(a.sesgo));
const nf = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '—');
console.log(`Caso ${CASO}, ${piezas} piezas${LIMPIAR ? ', con la limpieza de siempre' : ', sin limpiar'}. Sesgo en anchos de la norma del jurado.\n`);
console.log('| Rasgo | Qué mide | Verdad | Escrito | Sesgo | Mediana real |');
console.log('|---|---|---|---|---|---|');
for (const r of out) console.log(`| ${r.k} | ${r.nombre} | ${nf(r.verdad)} | ${nf(r.escrito)} | ${nf(r.sesgo, 1)} | ${nf(r.p50)} |`);
writeFileSync(join(PRUEBAS, `sesgo_${CASO}${LIMPIAR ? '' : '_crudo'}${EXACTA ? '_exacta' : ''}${ADELANTO ? '_ad' + ADELANTO : ''}.json`), JSON.stringify(out, null, 1));
