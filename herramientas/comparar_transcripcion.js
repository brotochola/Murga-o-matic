// comparar_transcripcion.js — cuánto acierta el transcriptor sobre un coro con las notas conocidas.
//
//   node herramientas/comparar_transcripcion.js [--casos patrón] [--detalle] [--json salida.json]
//
// Lee murga_trabajo/pruebas/coros/<pieza>/verdad.json y murga_trabajo/pruebas/salidas/<pieza>/*.json
// (transcripcion/banco_pruebas.py) y mide, por caso:
//   - notas: precisión, cobertura y F1 con el ataque a ±50 ms y la misma nota (como mir_eval, sin mirar el final);
//     también con ±100 ms, y con la nota en cualquier octava.
//   - errores de octava: notas escritas una octava arriba o abajo de una verdadera.
//   - voces por golpe: cuántas notas distintas suenan en cada golpe de la verdad y cuántas escribió el transcriptor a ±100 ms.
//     (Trece cantores no atacan juntos: cada uno entra hasta 30-50 ms corrido, y la consonante va antes del tiempo; por eso
//     ±50 ms es muy estricto para un coro, y ±100 ms es la medida que importa.)
//     Es lo que usa el análisis para decir "unísono" o "tres voces".
//   - cobertura por cuerda: qué cuerdas se pierden (bajos, segundos, primos, sobreprimos, tercia).
//   - la melodía: la nota de arriba de cada golpe, ¿es la misma?
//   - el retraso típico de los ataques, y notas inventadas en los pasajes sin coro.
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRUEBAS = join(RAIZ, 'murga_trabajo', 'pruebas');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };

// La verdad que importa: las notas distintas. Varios cantores en la misma nota y el mismo ataque son una nota.
export function notasVerdad(v) {
  const m = new Map();
  for (const c of v.cantores) for (const [t0, t1, p] of c.notas) {
    const k = p + '@' + Math.round(t0 * 100);
    const e = m.get(k);
    if (e) { e.t1 = Math.max(e.t1, t1); e.cuerdas.add(c.cuerda); } else m.set(k, { t0, t1, p, cuerdas: new Set([c.cuerda]) });
  }
  return [...m.values()].sort((a, b) => a.t0 - b.t0 || a.p - b.p);
}

// Emparejamiento uno a uno, voraz por distancia de ataque (alcanza para tolerancias chicas)
export function emparejar(ref, est, tol, igual = (a, b) => a.p === b.p) {
  const pares = [];
  let j0 = 0;
  for (let i = 0; i < ref.length; i++) {
    while (j0 < est.length && est[j0].t0 < ref[i].t0 - tol) j0++;
    for (let j = j0; j < est.length && est[j].t0 <= ref[i].t0 + tol; j++) if (igual(ref[i], est[j])) pares.push([Math.abs(est[j].t0 - ref[i].t0), i, j]);
  }
  pares.sort((a, b) => a[0] - b[0]);
  const ur = new Uint8Array(ref.length), ue = new Uint8Array(est.length), res = [];
  for (const [, i, j] of pares) if (!ur[i] && !ue[j]) { ur[i] = ue[j] = 1; res.push([i, j]); }
  return { pares: res, ur, ue };
}

const prf = (n, nr, ne) => { const p = ne ? n / ne : 0, r = nr ? n / nr : 0; return { p, r, f: p + r ? 2 * p * r / (p + r) : 0 }; };

// golpes de la verdad: ataques a menos de 30 ms son un mismo golpe
function golpes(notas, ventana = .03) {
  const g = [];
  for (const n of notas) { const u = g[g.length - 1]; if (u && n.t0 - u.t0 < ventana) u.notas.push(n); else g.push({ t0: n.t0, notas: [n] }); }
  return g;
}

export function medir(verdad, est) {
  const ref = notasVerdad(verdad);
  const E = est.map(([t0, t1, p]) => ({ t0, t1, p })).sort((a, b) => a.t0 - b.t0 || a.p - b.p);
  const r50 = emparejar(ref, E, .05), r100 = emparejar(ref, E, .1);
  const oct = emparejar(ref, E, .05, (a, b) => a.p % 12 === b.p % 12);
  // errores de octava: escritas a ±12 de una verdadera que no se acertó exacta
  const sinPar = ref.filter((_, i) => !r50.ur[i]), estSinPar = E.filter((_, j) => !r50.ue[j]);
  const o2 = emparejar(sinPar, estSinPar, .05, (a, b) => Math.abs(a.p - b.p) === 12);
  const semi = emparejar(sinPar, estSinPar, .05, (a, b) => Math.abs(a.p - b.p) === 1 || Math.abs(a.p - b.p) === 2);
  // retraso de los ataques acertados
  const ds = r50.pares.map(([i, j]) => E[j].t0 - ref[i].t0).sort((a, b) => a - b);
  // cobertura por cuerda: la nota verdadera se acertó (la cuerda la canta, sola o con otras)
  const porCuerda = {};
  ref.forEach((n, i) => { for (const c of n.cuerdas) { const x = porCuerda[c] || (porCuerda[c] = { n: 0, ok: 0, sola: 0, okSola: 0 }); x.n++; if (r50.ur[i]) x.ok++; if (n.cuerdas.size === 1) { x.sola++; if (r50.ur[i]) x.okSola++; } } });
  // voces por golpe: distintas notas en la verdad contra distintas notas escritas cerca de ese ataque
  const G = golpes(ref);
  const matriz = {};
  let melOk = 0, melN = 0, bajoOk = 0;
  let j0 = 0;
  for (const g of G) {
    while (j0 < E.length && E[j0].t0 < g.t0 - .1) j0++;
    const cerca = []; for (let j = j0; j < E.length && E[j].t0 <= g.t0 + .1; j++) cerca.push(E[j]);
    const nv = new Set(g.notas.map(n => n.p)).size, ne = new Set(cerca.map(n => n.p)).size;
    const k = Math.min(nv, 5) + '→' + Math.min(ne, 5);
    matriz[k] = (matriz[k] || 0) + 1;
    const top = Math.max(...g.notas.map(n => n.p));
    melN++; if (cerca.length && Math.max(...cerca.map(n => n.p)) === top) melOk++;
    if (cerca.length && Math.min(...cerca.map(n => n.p)) === Math.min(...g.notas.map(n => n.p))) bajoOk++;
  }
  // notas inventadas lejos de cualquier nota verdadera (más de 300 ms de todo ataque y fuera de toda nota sonando)
  const sonando = t => ref.some(n => t >= n.t0 - .3 && t <= n.t1 + .3);
  const inventadas = E.filter(n => !sonando(n.t0)).length;
  const vozUna = (() => { let a = 0, b = 0; for (const [k, v] of Object.entries(matriz)) { if (k.endsWith('→1')) a += v; b += v; } return a / Math.max(1, b); })();
  const vozUnaVerdad = (() => { let a = 0, b = 0; for (const [k, v] of Object.entries(matriz)) { if (k.startsWith('1→')) a += v; b += v; } return a / Math.max(1, b); })();
  const mediaVoces = arr => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length);
  const vv = [], ve = [];
  for (const [k, v] of Object.entries(matriz)) { const [a, b] = k.split('→').map(Number); for (let i = 0; i < v; i++) { vv.push(a); ve.push(b); } }
  return {
    ref: ref.length, est: E.length,
    f50: prf(r50.pares.length, ref.length, E.length), f100: prf(r100.pares.length, ref.length, E.length), fClase: prf(oct.pares.length, ref.length, E.length),
    octava: o2.pares.length / ref.length, vecina: semi.pares.length / ref.length,
    retraso: ds.length ? { p50: ds[ds.length >> 1], p10: ds[Math.floor(ds.length * .1)], p90: ds[Math.floor(ds.length * .9)] } : null,
    porCuerda, matriz, golpes: G.length, melodia: melOk / melN, bajo: bajoOk / melN, inventadas, unaVozEscrita: vozUna, unaVozVerdad: vozUnaVerdad,
    vocesVerdad: mediaVoces(vv), vocesEscritas: mediaVoces(ve),
  };
}

function juntar(rs) {
  const s = k => rs.reduce((a, r) => a + k(r), 0);
  const nRef = s(r => r.ref), nEst = s(r => r.est);
  const tp = (f, r) => f(r).r * r.ref;
  const f = key => prf(s(r => tp(x => x[key], r)), nRef, nEst);
  const porCuerda = {};
  for (const r of rs) for (const [c, x] of Object.entries(r.porCuerda)) { const y = porCuerda[c] || (porCuerda[c] = { n: 0, ok: 0, sola: 0, okSola: 0 }); for (const k in x) y[k] += x[k]; }
  const matriz = {}; for (const r of rs) for (const [k, v] of Object.entries(r.matriz)) matriz[k] = (matriz[k] || 0) + v;
  const G = s(r => r.golpes);
  return {
    piezas: rs.length, ref: nRef, est: nEst, f50: f('f50'), f100: f('f100'), fClase: f('fClase'),
    octava: s(r => r.octava * r.ref) / nRef, vecina: s(r => r.vecina * r.ref) / nRef,
    melodia: s(r => r.melodia * r.golpes) / G, bajo: s(r => r.bajo * r.golpes) / G, inventadas: s(r => r.inventadas),
    retraso: rs[0].retraso ? rs.map(r => r.retraso?.p50 ?? 0).sort((a, b) => a - b)[rs.length >> 1] : null,
    porCuerda, matriz, unaVozEscrita: s(r => r.unaVozEscrita * r.golpes) / G, unaVozVerdad: s(r => r.unaVozVerdad * r.golpes) / G,
    vocesVerdad: s(r => r.vocesVerdad * r.golpes) / G, vocesEscritas: s(r => r.vocesEscritas * r.golpes) / G,
    segundos: s(r => r.segundos || 0), sdr: rs.some(r => r.sdr != null) ? s(r => r.sdr || 0) / rs.filter(r => r.sdr != null).length : null,
  };
}

const pc = x => (100 * x).toFixed(1).replace('.', ',') + ' %';
const nf = (x, d = 2) => x == null ? '—' : x.toFixed(d).replace('.', ',');

function main() {
  const filtro = arg('casos', '');
  const piezas = readdirSync(join(PRUEBAS, 'coros')).filter(p => existsSync(join(PRUEBAS, 'coros', p, 'verdad.json')));
  const porCaso = new Map();
  for (const p of piezas) {
    const v = JSON.parse(readFileSync(join(PRUEBAS, 'coros', p, 'verdad.json'), 'utf8'));
    const dir = join(PRUEBAS, 'salidas', p);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const caso = f.replace('.json', '');
      if (filtro && !caso.includes(filtro)) continue;
      const t = JSON.parse(readFileSync(join(dir, f), 'utf8'));
      const r = medir(v, t.notas);
      r.segundos = t.segundos; r.sdr = t.separacion?.sdr ?? null; r.pieza = p;
      if (!porCaso.has(caso)) porCaso.set(caso, []);
      porCaso.get(caso).push(r);
    }
  }
  const filas = [...porCaso].map(([caso, rs]) => ({ caso, ...juntar(rs) })).sort((a, b) => b.f50.f - a.f50.f);
  console.log('| Caso | Piezas | F1 ±50 ms | Precisión | Cobertura | F1 ±100 ms | F1 sin octava | Octava | Vecina | Melodía | Bajo | Voces verdad → escritas | Una voz verdad → escrita | Inventadas | SDR | Seg. |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of filas) console.log(`| ${r.caso} | ${r.piezas} | ${pc(r.f50.f)} | ${pc(r.f50.p)} | ${pc(r.f50.r)} | ${pc(r.f100.f)} | ${pc(r.fClase.f)} | ${pc(r.octava)} | ${pc(r.vecina)} | ${pc(r.melodia)} | ${pc(r.bajo)} | ${nf(r.vocesVerdad)} → ${nf(r.vocesEscritas)} | ${pc(r.unaVozVerdad)} → ${pc(r.unaVozEscrita)} | ${r.inventadas} | ${nf(r.sdr, 1)} | ${Math.round(r.segundos)} |`);
  if (args.includes('--detalle')) for (const r of filas) {
    console.log(`\n### ${r.caso}`);
    console.log('Cobertura por cuerda (todas sus notas / las que canta sola):', Object.entries(r.porCuerda).map(([c, x]) => `${c} ${pc(x.ok / x.n)} / ${x.sola ? pc(x.okSola / x.sola) : '—'}`).join(', '));
    const M = r.matriz, filasM = [1, 2, 3, 4, 5];
    console.log('Voces por golpe, verdad (filas) → escritas (columnas 0..5):');
    for (const a of filasM) { const fila = [0, 1, 2, 3, 4, 5].map(b => M[a + '→' + b] || 0); const t = fila.reduce((x, y) => x + y, 0); if (t) console.log(`  ${a}: ` + fila.map(x => String(Math.round(100 * x / t)).padStart(3) + '%').join(' ') + `  (${t} golpes)`); }
  }
  if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify(filas, null, 1));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
