// cambios_de_modo.js — ¿cómo cambian de tono y de modo las murgas? Mira los 41 tramos transcriptos.
//
// Dos niveles:
//  1. Cambios de tonalidad que duran (cuatro compases o más de cada lado): de qué a qué, si caen en una costura
//     (un silencio del coro o la entrada o salida de la batería) y qué acorde suena justo antes.
//  2. Llegadas a la tónica después de un acorde de dominante (V o V7 → I): cuántas veces el acorde de llegada
//     tiene el modo contrario al del pasaje (Do menor … G7 → Do mayor, o al revés) y qué pasa después.
//
// El detector de acordes del análisis favorece los acordes de la escala (por eso casi nunca escribe I en menor).
// Acá los acordes se estiman sin esa ayuda, sólo con las notas, y el modo de la llegada sale de su tercera.
//
//   node herramientas/cambios_de_modo.js            → informe en la consola y murga_trabajo/cambios_de_modo.json
//   node herramientas/cambios_de_modo.js --modelo   → además escribe motor/modos.js, que usa el compositor
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { croma, tonalidades } from './analisis.js';

const MINIMO = +(process.argv.find(a => a.startsWith('--minimo='))?.split('=')[1] || 16);   // pulsos de cada lado
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(RAIZ, 'murga_trabajo', 'analisis');
const mod = (a, n) => ((a % n) + n) % n;
const NOM = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const PARTE = p => p === 'presentacion' ? 'presentación' : p === 'cancion_final' ? 'canción final' : 'retirada';

// ── acordes sin preferencia de tonalidad ──
const CAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], dim: [0, 3, 6] };
const PL = []; for (let r = 0; r < 12; r++) for (const [q, iv] of Object.entries(CAL)) PL.push({ r, q, pcs: new Set(iv.map(i => (r + i) % 12)), pena: q === '7' ? .03 : q === 'dim' ? .16 : 0 });
function acordesLibres(cr, cambio = .9) {
  const n = cr.C.length, P = PL.length;
  const em = cr.C.map((c, i) => {
    const tot = c.reduce((s, v) => s + v, 0), r = new Float64Array(P);
    if (tot < .1) return r;
    const bajo = cr.bajo[i] === null ? null : mod(cr.bajo[i], 12);
    PL.forEach((pl, j) => { let den = 0; for (const p of pl.pcs) den += c[p]; let s = (den - .7 * (tot - den)) / tot - pl.pena; if (bajo === pl.r) s += .14; else if (bajo !== null && pl.pcs.has(bajo)) s += .03; r[j] = s; });
    return r;
  });
  const dp = em.map(() => new Float64Array(P)), de = em.map(() => new Int16Array(P));
  dp[0].set(em[0]);
  for (let i = 1; i < n; i++) { let mej = 0; for (let k = 1; k < P; k++) if (dp[i - 1][k] > dp[i - 1][mej]) mej = k;
    for (let k = 0; k < P; k++) { const a = dp[i - 1][k], b = dp[i - 1][mej] - cambio; if (a >= b) { dp[i][k] = a + em[i][k]; de[i][k] = k; } else { dp[i][k] = b + em[i][k]; de[i][k] = mej; } } }
  const camino = new Array(n); let k = 0; for (let j = 1; j < P; j++) if (dp[n - 1][j] > dp[n - 1][k]) k = j;
  for (let i = n - 1; i >= 0; i--) { camino[i] = PL[k]; k = de[i][k]; }
  return camino;
}

// ── un tramo ──
function analizar(an) {
  const notas = an.notas.map(([b, fin, p, t]) => ({ b, fin, p, t }));
  if (notas.length < 50) return null;
  const cr = croma(notas), n = cr.C.length;
  const tn = tonalidades(cr), ac = acordesLibres(cr);
  // segundos de cada pulso (para ubicar la batería y los ejemplos)
  const pares = notas.map(x => [x.b, x.t]).sort((a, b) => a[0] - b[0]);
  const tDe = b => { let lo = 0, hi = pares.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pares[m][0] <= b) lo = m; else hi = m - 1; } const [b0, t0] = pares[lo], [b1, t1] = pares[Math.min(pares.length - 1, lo + 1)]; return b1 > b0 ? t0 + (b - b0) * (t1 - t0) / (b1 - b0) : t0 + (b - b0) * .5; };
  // costuras: silencios del coro de un compás o más, y entradas o salidas de la batería
  const suena = new Float64Array(n); for (const x of notas) for (let i = Math.floor(x.b); i < Math.min(n, Math.ceil(x.fin)); i++) suena[i] = 1;
  const silencios = []; for (let i = 0, ini = -1; i <= n; i++) { if (i < n && !suena[i]) { if (ini < 0) ini = i; } else if (ini >= 0) { if (i - ini >= 2) silencios.push([ini, i]); ini = -1; } }
  const bat = []; { const e = an.energia, m = e.vocals.length, resto = e.vocals.map((_, i) => (e.drums[i] || 0) + (e.other[i] || 0) + (e.bass?.[i] || 0)); const ref = [...resto].sort((a, b) => a - b)[Math.floor(m * .8)] || 1; const hay = resto.map(v => v > .28 * ref);
    const liso = hay.map((_, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 6); j <= Math.min(m - 1, i + 6); j++) { s += hay[j] ? 1 : 0; c++; } return s / c > .5; });
    for (let i = 1; i < m; i++) if (liso[i] !== liso[i - 1]) bat.push(i / 2); }
  const bDe = t => { let lo = 0, hi = pares.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pares[m][1] <= t) lo = m; else hi = m - 1; } return pares[lo][0]; };
  const batB = bat.map(bDe);
  const costura = b => {
    const s = silencios.find(([a, c]) => b >= a - 3 && b <= c + 3);
    if (s) return 'silencio';
    if (batB.some(x => Math.abs(x - b) <= 6)) return 'batería';
    return null;
  };
  // segmentos de tonalidad
  const seg = []; for (let i = 0, ini = 0; i <= n; i++) if (i === n || tn[i].t !== tn[ini].t || tn[i].modo !== tn[ini].modo) { seg.push({ a: ini, b: i, t: tn[ini].t, modo: tn[ini].modo }); ini = i; }
  const largos = seg.filter(s => s.b - s.a >= MINIMO && [...Array(s.b - s.a).keys()].some(k => suena[s.a + k]));
  const cambios = [];
  for (let i = 1; i < largos.length; i++) {
    const A = largos[i - 1], B = largos[i];
    if (A.t === B.t && A.modo === B.modo) continue;
    // dónde está la costura de verdad: el corte que mejor separa las dos tonalidades
    const perfil = (k, lo, hi) => { const v = new Array(12).fill(0); for (let j = Math.max(0, lo); j < Math.min(n, hi); j++) for (let c = 0; c < 12; c++) v[c] += cr.C[j][c]; return v; };
    const KMAY = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], KMEN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    const corr = (v, t, modo) => { const K = Array.from({ length: 12 }, (_, i) => (modo === 'mayor' ? KMAY : KMEN)[mod(i - t, 12)]); const ma = v.reduce((s, x) => s + x, 0) / 12, mk = K.reduce((s, x) => s + x, 0) / 12; let num = 0, da = 0, dk = 0; for (let j = 0; j < 12; j++) { num += (v[j] - ma) * (K[j] - mk); da += (v[j] - ma) ** 2; dk += (K[j] - mk) ** 2; } return da && dk ? num / Math.sqrt(da * dk) : 0; };
    let mejor = B.a, pm = -9;
    for (let s = Math.max(A.a + 8, B.a - 20); s <= Math.min(B.b - 8, B.a + 20); s++) { const p = corr(perfil(0, s - 16, s), A.t, A.modo) + corr(perfil(0, s, s + 16), B.t, B.modo); if (p > pm) { pm = p; mejor = s; } }
    // el corte cae en un silencio si lo hay cerca
    const sil = silencios.find(([a, c]) => mejor >= a - 4 && mejor <= c + 4);
    const corte = sil ? sil[1] : mejor;
    // el último acorde antes del corte (con algo sonando) y el primero después
    let j = corte - 1; while (j > 0 && !suena[j]) j--;
    let k2 = corte; while (k2 < n - 1 && !suena[k2]) k2++;
    const igual = (x, y) => x.r === y.r && x.q === y.q;
    // si el corte cae adentro de un acorde, ése es el puente; "antes" es el anterior distinto
    let ja = j; if (igual(ac[j], ac[k2])) { while (ja > 0 && (igual(ac[ja], ac[k2]) || !suena[ja])) ja--; }
    const antes = ac[ja], despues = ac[k2];
    const contexto = []; { let last = null; for (let q = Math.max(0, corte - 16); q < Math.min(n, corte + 12); q++) { if (!suena[q]) continue; const nm = NOM[ac[q].r] + ac[q].q; if (nm !== last) { contexto.push((q >= corte && (contexto.length && !contexto.includes('|')) ? '| ' : '') + nm); last = nm; } } }
    const gradoEn = (x, t) => mod(x.r - t, 12);
    const esV = (x, t) => gradoEn(x, t) === 7 && (x.q === '' || x.q === '7');
    // qué es el acorde de antes para el tono nuevo (o para el viejo)
    function funcionDe(x, A, B) {
      if (esV(x, B.t)) return 'dominante del nuevo';
      if (gradoEn(x, B.t) === 5) return x.q === 'm' ? 'iv menor del nuevo' : 'IV del nuevo';
      if (gradoEn(x, A.t) === 0) return 'tónica del viejo';
      if (esV(x, A.t)) return 'dominante del viejo';
      if (gradoEn(x, B.t) === 0) return 'tónica del nuevo (ya)';
      return 'otro';
    }
    // segunda opinión: otra familia de perfiles (Aarden-Essen) sobre cada segmento entero
    const AEM = [17.77, .15, 14.93, .16, 19.80, 11.36, .29, 22.06, .15, 8.15, .23, 4.95], AEm = [18.26, .74, 14.05, 16.86, .70, 14.44, .70, 18.62, 4.57, 1.93, 7.38, 1.76];
    const clave2 = (lo, hi) => { const v = perfil(0, lo, hi); let mej = null, pm2 = -9; for (let t = 0; t < 12; t++) for (const [modo, K0] of [['mayor', AEM], ['menor', AEm]]) { const K = Array.from({ length: 12 }, (_, i) => K0[mod(i - t, 12)]); const ma = v.reduce((x, y) => x + y, 0) / 12, mk = K.reduce((x, y) => x + y, 0) / 12; let num = 0, da = 0, dk = 0; for (let j = 0; j < 12; j++) { num += (v[j] - ma) * (K[j] - mk); da += (v[j] - ma) ** 2; dk += (K[j] - mk) ** 2; } const c = da && dk ? num / Math.sqrt(da * dk) : 0; if (c > pm2) { pm2 = c; mej = { t, modo }; } } return mej; };
    const kA = clave2(A.a, A.b), kB = clave2(B.a, B.b);
    const confirmado = kA.t === A.t && kA.modo === A.modo && kB.t === B.t && kB.modo === B.modo;
    cambios.push({ confirmado,
      de: { t: A.t, modo: A.modo }, a: { t: B.t, modo: B.modo }, clave: (A.modo === 'mayor' ? 'M' : 'm') + (B.modo === 'mayor' ? 'M' : 'm') + mod(B.t - A.t, 12),
      donde: costura(corte), t: tDe(corte),
      antes: { acorde: NOM[antes.r] + antes.q, dominanteDelNuevo: esV(antes, B.t), dominanteDelViejo: esV(antes, A.t), tonicaDelViejo: gradoEn(antes, A.t) === 0,
        ivMenorDelNuevo: gradoEn(antes, B.t) === 5 && antes.q === 'm', funcion: funcionDe(antes, A, B) },
      vuelve: !!(largos[i + 1] && largos[i + 1].t === A.t && largos[i + 1].modo === A.modo && B.b - B.a < 48),
      despues: { acorde: NOM[despues.r] + despues.q, tonicaDelNuevo: gradoEn(despues, B.t) === 0 }, contexto: contexto.join(' '),
    });
  }
  // llegadas V → I: la tercera del acorde de llegada contra el modo del pasaje
  const corridas = []; for (let i = 0, ini = 0; i <= n; i++) if (i === n || ac[i].r !== ac[ini].r || ac[i].q !== ac[ini].q) { if (ac[ini] && [...Array(i - ini).keys()].some(k => suena[ini + k])) corridas.push({ a: ini, b: i, x: ac[ini] }); ini = i; }
  const llegadas = [];
  for (let i = 1; i < corridas.length; i++) {
    const D = corridas[i - 1], Y = corridas[i];
    if (!(D.x.q === '' || D.x.q === '7') || mod(Y.x.r - D.x.r, 12) !== 5) continue;   // V(7) → I
    const ctx = tn[Math.max(0, D.a - 4)];                                           // la tonalidad del pasaje antes de la dominante
    if (ctx.t !== Y.x.r) continue;                                                  // sólo llegadas a la tónica del pasaje
    // la tercera, de las notas mismas
    let may = 0, men = 0; for (let k = Y.a; k < Math.min(Y.b, Y.a + 4); k++) { may += cr.C[k][mod(Y.x.r + 4, 12)]; men += cr.C[k][mod(Y.x.r + 3, 12)]; }
    if (may + men < .3) continue;                                                   // quinta vacía: no se sabe
    const modoLlegada = may > 1.5 * men ? 'mayor' : men > 1.5 * may ? 'menor' : null;
    if (!modoLlegada) continue;
    const contrario = modoLlegada !== ctx.modo;
    // ¿se queda en el modo nuevo (cambio de modo) o vuelve (color)? Mira la tonalidad 8 pulsos después
    const luego = tn[Math.min(n - 1, Y.a + 8)];
    const queda = contrario && luego.t === Y.x.r && luego.modo === modoLlegada;
    const sigue = corridas[i + 1]?.x, haciaIV = sigue && mod(sigue.r - Y.x.r, 12) === 5;
    llegadas.push({ ctx: ctx.modo, modoLlegada, contrario, queda, conSeptima: Y.x.q === '7', haciaIV, d7: D.x.q === '7', donde: costura(Y.a), t: tDe(Y.a) });
  }
  return { cambios, llegadas, largo: an.largo_s };
}

// ── todo el corpus ──
const archivos = readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const filas = [];
for (const f of archivos) {
  const an = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  const r = analizar(an); if (!r) continue;
  filas.push({ nombre: an.nombre, murga: an.murga, anio: an.anio, parte: an.parte, ...r });
}
const pct = (a, b) => b ? `${Math.round(100 * a / b)} %` : '—';
const C = filas.flatMap(f => f.cambios.map(c => ({ ...c, nombre: f.nombre, murga: f.murga, parte: f.parte })));
const L = filas.flatMap(f => f.llegadas.map(c => ({ ...c, nombre: f.nombre, murga: f.murga, parte: f.parte })));
const cuenta = (lista, fn) => { const h = {}; for (const x of lista) { const k = fn(x); h[k] = (h[k] || 0) + 1; } return Object.entries(h).sort((a, b) => b[1] - a[1]); };
const tipo = c => c.de.t === c.a.t ? (c.de.modo === c.a.modo ? '—' : 'mismo tono, cambia el modo') : c.de.modo !== c.a.modo && mod(c.a.t - c.de.t, 12) === (c.de.modo === 'menor' ? 3 : 9) ? 'a la relativa' : c.de.modo === c.a.modo ? 'otro tono, mismo modo' : 'otro tono y otro modo';

console.log(`Mínimo ${MINIMO} pulsos de cada lado. ${filas.length} tramos, ${Math.round(filas.reduce((a, f) => a + f.largo, 0) / 60)} minutos\n`);
console.log(`1. CAMBIOS DE TONALIDAD QUE DURAN (4 compases o más de cada lado): ${C.length}`);
for (const [k, v] of cuenta(C, tipo)) console.log(`   ${k.padEnd(30)} ${String(v).padStart(3)}  ${pct(v, C.length)}`);
const par = C.filter(c => c.de.t === c.a.t);
console.log(`\n   Mismo tono, cambia el modo: ${par.length} (de menor a mayor ${par.filter(c => c.de.modo === 'menor').length}, de mayor a menor ${par.filter(c => c.de.modo === 'mayor').length})`);
console.log(`     en una costura: ${pct(par.filter(c => c.donde).length, par.length)} (silencio ${par.filter(c => c.donde === 'silencio').length}, batería ${par.filter(c => c.donde === 'batería').length}); el resto, en medio de una frase`);
console.log(`     antes del cambio suena la dominante: ${pct(par.filter(c => c.antes.dominanteDelNuevo).length, par.length)}; la tónica vieja: ${pct(par.filter(c => c.antes.tonicaDelViejo).length, par.length)}`);
console.log(`     arranca en la tónica nueva: ${pct(par.filter(c => c.despues.tonicaDelNuevo).length, par.length)}`);
console.log(`     por parte: ${cuenta(par, c => PARTE(c.parte)).map(([k, v]) => k + ' ' + v).join(', ')}`);
for (const c of par) console.log(`       ${c.nombre.padEnd(40)} ${mmss(c.t).padStart(6)}  ${NOM[c.de.t]} ${c.de.modo} → ${c.a.modo}  ${c.donde || 'en la frase'} · ${c.contexto}`);
console.log(`\n   Antes del cambio (todos): ${cuenta(C, c => c.antes.funcion).map(([k, v]) => `${k} ${pct(v, C.length)}`).join(', ')}`);
console.log(`   Antes del cambio (mismo tono, otro modo): ${cuenta(par, c => c.antes.funcion).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`   Vuelve al tono de antes en menos de 12 compases: ${pct(C.filter(c => c.vuelve).length, C.length)}`);
console.log(`   Todos los cambios, en una costura: ${pct(C.filter(c => c.donde).length, C.length)}; con la dominante del tono nuevo justo antes: ${pct(C.filter(c => c.antes.dominanteDelNuevo).length, C.length)}`);
console.log(`   Por clave (de→a, intervalo en semitonos): ${cuenta(C, c => c.clave).slice(0, 14).map(([k, v]) => k + ' ' + v).join(', ')}`);

const CC = C.filter(c => c.confirmado), parC = CC.filter(c => c.de.t === c.a.t);
console.log(`\n   CONFIRMADOS por otra familia de perfiles (Aarden-Essen): ${CC.length} de ${C.length}`);
for (const [k, v] of cuenta(CC, tipo)) console.log(`     ${k.padEnd(30)} ${String(v).padStart(3)}  ${pct(v, CC.length)}`);
console.log(`     cambian de modo (con la tónica que sea): ${pct(CC.filter(c => c.de.modo !== c.a.modo).length, CC.length)} · mismo tono, otro modo: ${parC.length} (a menor ${parC.filter(c => c.a.modo === 'menor').length}, a mayor ${parC.filter(c => c.a.modo === 'mayor').length})`);
console.log(`     por clave: ${cuenta(CC, c => c.clave).map(([k, v]) => k + ' ' + v).join(', ')}`);
console.log(`     antes del cambio: ${cuenta(CC, c => c.antes.funcion).map(([k, v]) => `${k} ${pct(v, CC.length)}`).join(', ')}; en una costura ${pct(CC.filter(c => c.donde).length, CC.length)}`);
console.log(`     por parte: ${cuenta(CC, c => PARTE(c.parte)).map(([k, v]) => k + ' ' + v).join(', ')}`);

console.log(`\n2. LLEGADAS V → I A LA TÓNICA DEL PASAJE: ${L.length}`);
for (const ctx of ['menor', 'mayor']) {
  const l = L.filter(x => x.ctx === ctx), c = l.filter(x => x.contrario);
  console.log(`   En ${ctx}: ${l.length} llegadas; con el modo contrario ${c.length} (${pct(c.length, l.length)})`);
  console.log(`     de esas: con séptima (I7) ${c.filter(x => x.conSeptima).length}, siguen al IV ${c.filter(x => x.haciaIV).length}, se quedan en el modo nuevo ${c.filter(x => x.queda).length}, en una costura ${c.filter(x => x.donde).length}`);
}
const quedan = L.filter(x => x.queda);
for (const x of quedan) console.log(`       ${x.nombre.padEnd(40)} ${mmss(x.t).padStart(6)}  ${x.ctx} → llega en ${x.modoLlegada}${x.donde ? ' · ' + x.donde : ''}`);

const resumen = {
  tramos: filas.length,
  cambios: { total: C.length, porTipo: Object.fromEntries(cuenta(C, tipo)), porClave: Object.fromEntries(cuenta(C, c => c.clave)),
    enCostura: C.filter(c => c.donde).length, conDominante: C.filter(c => c.antes.dominanteDelNuevo).length },
  paralelos: { total: par.length, menorAMayor: par.filter(c => c.de.modo === 'menor').length, mayorAMenor: par.filter(c => c.de.modo === 'mayor').length,
    enCostura: par.filter(c => c.donde).length, conDominante: par.filter(c => c.antes.dominanteDelNuevo).length, tonicaVieja: par.filter(c => c.antes.tonicaDelViejo).length,
    porParte: Object.fromEntries(cuenta(par, c => c.parte)), ejemplos: par.map(c => ({ tramo: c.nombre, t: mmss(c.t), de: `${NOM[c.de.t]} ${c.de.modo}`, a: c.a.modo, donde: c.donde, antes: c.antes.acorde, despues: c.despues.acorde })) },
  llegadas: Object.fromEntries(['menor', 'mayor'].map(ctx => { const l = L.filter(x => x.ctx === ctx), c = l.filter(x => x.contrario); return [ctx, { total: l.length, contrario: c.length, conSeptima: c.filter(x => x.conSeptima).length, haciaIV: c.filter(x => x.haciaIV).length, queda: c.filter(x => x.queda).length, enCostura: c.filter(x => x.donde).length }]; })),
};
resumen.confirmados = { total: CC.length, porClave: Object.fromEntries(cuenta(CC, c => c.clave)), porTipo: Object.fromEntries(cuenta(CC, tipo)), cambianModo: CC.filter(c => c.de.modo !== c.a.modo).length,
  ejemplos: CC.map(c => ({ tramo: c.nombre, t: mmss(c.t), de: `${NOM[c.de.t]} ${c.de.modo}`, a: `${NOM[c.a.t]} ${c.a.modo}`, clave: c.clave, donde: c.donde, contexto: c.contexto })) };
resumen.antes = { todos: Object.fromEntries(cuenta(C, c => c.antes.funcion)), paralelos: Object.fromEntries(cuenta(par, c => c.antes.funcion)) };
resumen.vuelve = C.filter(c => c.vuelve).length;
writeFileSync(join(RAIZ, 'murga_trabajo', 'cambios_de_modo.json'), JSON.stringify(resumen, null, 1));
if (process.argv.includes('--modelo')) {
  // Lo que usa el compositor: qué cambio de tono elegir (por murga y en total) y cómo prepararlo
  const porMurga = {};
  for (const c of CC) { const k = { 'La Trasnochada': 'trasnochada', 'Agarrate Catalina': 'catalina', 'La Gran Muñeca': 'muneca', 'Metele que son Pasteles': 'pasteles', 'Doña Bastarda': 'bastarda', 'Asaltantes con Patente': 'asaltantes', 'La Nueva Milonga': 'milonga', 'Cayó la Cabra': 'cabra' }[c.murga] || 'otra'; (porMurga[k] ||= {})[c.clave] = (porMurga[k][c.clave] || 0) + 1; }
  porMurga.todas = Object.fromEntries(cuenta(CC, c => c.clave));
  const prep = lista => { const n = lista.length || 1; return { dominante: +(lista.filter(c => c.antes.funcion === 'dominante del nuevo').length / n).toFixed(3), ivMenor: +(lista.filter(c => c.antes.funcion === 'iv menor del nuevo').length / n).toFixed(3) }; };
  const L_ = ctx => { const l = L.filter(x => x.ctx === ctx), c = l.filter(x => x.contrario && !x.haciaIV); return +(c.length / (l.length || 1)).toFixed(3); };
  const modos = { cambios: porMurga, preparar: { todos: prep(CC), aMenorMismoTono: prep(parC.filter(c => c.a.modo === 'menor')), aMayorMismoTono: prep(parC.filter(c => c.a.modo === 'mayor')) },
    llegadaContraria: { menor: L_('menor'), mayor: L_('mayor') }, tramos: filas.length, minimoPulsos: MINIMO };
  writeFileSync(join(RAIZ, 'motor', 'modos.js'), '// Generado por herramientas/cambios_de_modo.js --modelo: cómo cambian de tono las murgas del corpus.\nexport const MODOS = ' + JSON.stringify(modos) + ';\n');
  console.log('\nEscrito motor/modos.js');
}
export { resumen };
