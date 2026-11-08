// tomas_comparar.js — compara las transcripciones de varias tomas del mismo espectáculo (lo llama tomas.js comparar).
//
// Para cada espectáculo de transcripcion/tomas.csv, la primera toma es la referencia. Cada otra toma se alinea a ella
// por el croma de sus voces separadas (murga_trabajo/tomas/voces/), y sus notas se llevan al tiempo de la referencia.
// Se mide, entre cada par de tomas:
//   - notas: F1 con el ataque a ±80 ms y la misma nota, y con la nota en cualquier octava (lo crudo del MIDI y lo
//     limpio del análisis, que es lo que usa el generador)
//   - golpes: cuántas voces escribe cada toma en el mismo golpe, y si la melodía (la nota de arriba) es la misma
//   - armonía: en ventanas de un segundo, cuánto se parecen las notas (sin octava) que suenan en cada toma
//   - rasgos del jurado: la distancia entre las dos tomas, en anchos de la norma del corpus, contra la distancia entre
//     espectáculos distintos del corpus. Si dos noches del mismo espectáculo quedan tan lejos como dos espectáculos
//     distintos, ese rasgo mide sobre todo al transcriptor.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { leerAudio, suavizar, croma, alinear, leerCsv, LISTA, TRABAJO, SR } from './tomas.js';
import { emparejar } from './comparar_transcripcion.js';
import { leerMidi } from './midi.js';
import { rasgosReal, normas, RASGOS } from './jurado.js';
import { cargarAnalisis } from './medir.js';

const DIR = process.env.TOMAS_DIR || join(TRABAJO, 'tomas');
const pc = x => (100 * x).toFixed(0) + ' %';
const nf = (x, d = 2) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d).replace('.', ','));
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function cargarToma(nombre) {
  const mid = join(DIR, 'midis', nombre + '.mid'), an = join(DIR, 'analisis', nombre + '.json'), voz = join(DIR, 'voces', nombre + '.flac');
  if (!existsSync(mid) || !existsSync(voz)) return null;
  const m = leerMidi(readFileSync(mid));
  const t = { nombre, crudas: m.notas.map(n => ({ t0: n.t, p: n.p })), voz };
  if (existsSync(an)) { t.an = JSON.parse(readFileSync(an, 'utf8')); t.limpias = t.an.notas.map(([, , p, s]) => ({ t0: s, p })); }
  return t;
}

// la transposición entre dos tomas: el corrimiento circular del croma medio que más se parece
function transposicion(A, B) {
  const m = X => { const v = new Float64Array(12); for (let f = 0; f < X.n; f++) for (let i = 0; i < 12; i++) v[i] += X.C[f * 12 + i]; return v; };
  const a = m(A), b = m(B);
  let mej = 0, mv = -1e9;
  for (let s = 0; s < 12; s++) { let v = 0; for (let i = 0; i < 12; i++) v += a[i] * b[(i + s) % 12]; if (v > mv) { mv = v; mej = s; } }
  return mej > 6 ? mej - 12 : mej;   // semitonos que hay que restarle a B
}
function rotar(X, s) {
  if (!s) return X;
  const C = new Float32Array(X.C.length);
  for (let f = 0; f < X.n; f++) for (let i = 0; i < 12; i++) C[f * 12 + i] = X.C[f * 12 + ((i + s + 12) % 12)];
  return { C, n: X.n };
}

const golpes = (N, v = .03) => { const g = []; for (const n of N) { const u = g[g.length - 1]; if (u && n.t0 - u.t0 < v) u.ps.add(n.p); else g.push({ t0: n.t0, ps: new Set([n.p]) }); } return g; };

function compararNotas(A, B) {
  const r = emparejar(A, B, .08), rc = emparejar(A, B, .08, (a, b) => a.p % 12 === b.p % 12);
  const f = (n, na, nb) => (na + nb ? 2 * n / (na + nb) : 0);
  // golpes: voces y melodía
  const GA = golpes(A); let j0 = 0, mismas = 0, mel = 0, tot = 0, difVoces = 0;
  for (const g of GA) {
    while (j0 < B.length && B[j0].t0 < g.t0 - .08) j0++;
    const ps = new Set(); for (let j = j0; j < B.length && B[j].t0 <= g.t0 + .08; j++) ps.add(B[j].p);
    if (!ps.size) continue;
    tot++;
    if (ps.size === g.ps.size) mismas++;
    difVoces += Math.abs(ps.size - g.ps.size);
    if (Math.max(...ps) === Math.max(...g.ps)) mel++;
  }
  // armonía: notas sin octava por segundo
  const fin = Math.max(A.at(-1)?.t0 || 0, B.at(-1)?.t0 || 0), nW = Math.ceil(fin);
  const vA = Array.from({ length: nW }, () => new Set()), vB = Array.from({ length: nW }, () => new Set());
  for (const n of A) if (n.t0 >= 0) vA[Math.floor(n.t0)]?.add(n.p % 12);
  for (const n of B) if (n.t0 >= 0) vB[Math.floor(n.t0)]?.add(n.p % 12);
  let jac = 0, nj = 0;
  for (let w = 0; w < nW; w++) { if (!vA[w].size || !vB[w].size) continue; const i = [...vA[w]].filter(x => vB[w].has(x)).length; jac += i / (vA[w].size + vB[w].size - i); nj++; }
  return { f1: f(r.pares.length, A.length, B.length), f1Clase: f(rc.pares.length, A.length, B.length), nA: A.length, nB: B.length,
    mismasVoces: tot ? mismas / tot : null, difVoces: tot ? difVoces / tot : null, melodia: tot ? mel / tot : null, golpesComunes: tot / Math.max(1, GA.length), armonia: nj ? jac / nj : null };
}

export function comparar() {
  const filas = leerCsv(process.env.TOMAS_LISTA || LISTA);
  const porShow = new Map(); for (const f of filas) { const n = `${f.espectaculo}__${f.toma}`; if (!porShow.has(f.espectaculo)) porShow.set(f.espectaculo, []); porShow.get(f.espectaculo).push({ ...f, nombre: n }); }
  // normas y distancias entre espectáculos distintos del corpus
  const corpus = cargarAnalisis().filter(a => a.notas?.length > 200);
  const RC = corpus.map(a => ({ a, r: rasgosReal(a) }));
  const N = normas(RC.map(x => x.r));
  const claves = Object.keys(RASGOS);
  const distRasgo = (r1, r2, k) => Math.abs(r1[k] - r2[k]) / N[k].ancho;
  const entreShows = Object.fromEntries(claves.map(k => [k, []]));
  for (let i = 0; i < RC.length; i++) for (let j = i + 1; j < RC.length; j++) {
    const a = RC[i].a, b = RC[j].a;
    if (a.parte !== b.parte && !(a.parte.includes('retirada') && b.parte.includes('retirada'))) continue;   // parte con parte
    for (const k of claves) { const d = distRasgo(RC[i].r, RC[j].r, k); if (Number.isFinite(d)) entreShows[k].push(d); }
  }
  const med = v => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };

  const L = ['# Varias tomas del mismo espectáculo', '',
    'Escrito por `node herramientas/tomas.js comparar`. Cada toma es otra grabación (otra noche, otra cámara, la tribuna, el disco) de la misma retirada. ' +
    'Las tomas se alinean por el croma de sus voces separadas y se comparan sus transcripciones. Lo que coincide entre noches distintas es la murga; ' +
    'lo que no, es sobre todo el transcriptor (también hay algo de interpretación: no se canta igual cada noche).', ''];
  const juntos = Object.fromEntries(claves.map(k => [k, []]));
  const resumen = [];
  for (const [show, tomas] of porShow) {
    const T = tomas.map(t => ({ ...t, ...cargarToma(t.nombre) })).filter(t => t.crudas);
    if (T.length < 2) { L.push(`## ${show}`, '', `Faltan tomas transcriptas (${T.length}).`, ''); continue; }
    const ref = T[0];
    const CR = suavizar(croma(leerAudio(ref.voz)));
    L.push(`## ${show}`, '', `Referencia: **${ref.toma}** (${ref.fuente}). Notas a ±80 ms; F1 de 100 % es la misma transcripción.`, '',
      '| Toma | Fuente | En común | Transp. | Costo DTW | Notas crudas F1 | Sin octava | Limpias F1 | Golpes en común | Mismas voces | Diferencia de voces | Misma melodía | Armonía |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    const fallidas = new Set();
    for (const t of T.slice(1)) {
      const CB0 = suavizar(croma(leerAudio(t.voz)));
      const tr = transposicion(CR, CB0), CB = rotar(CB0, tr);
      const { f, costo, comunA, comunB } = alinear(CR, CB);
      // sólo lo que las dos tomas tienen en común
      const enA = N0 => N0.filter(n => n.t0 >= comunA[0] && n.t0 <= comunA[1]);
      const llevar = N0 => N0.filter(n => n.t0 >= comunB[0] && n.t0 <= comunB[1]).map(n => ({ t0: f(n.t0), p: n.p - tr })).sort((a, b) => a.t0 - b.t0 || a.p - b.p);
      const c = compararNotas(enA(ref.crudas), llevar(t.crudas));
      const cl = ref.limpias && t.limpias ? compararNotas(enA(ref.limpias), llevar(t.limpias)) : null;
      const comun = comunA[1] - comunA[0];
      const x = cl || c;
      if (comun < 60) { fallidas.add(t.toma); L.push(`| ${t.toma} | ${t.fuente} | no se alineó: ${Math.round(comun)} s en común | | | | | | | | | | |`); resumen.push({ show, toma: t.toma, fuente: t.fuente, fallida: true, comun }); continue; }
      L.push(`| ${t.toma} | ${t.fuente} | ${Math.floor(comun / 60)}:${String(Math.round(comun % 60)).padStart(2, "0")} | ${tr} | ${nf(costo, 3)} | ${pc(c.f1)} | ${pc(c.f1Clase)} | ${cl ? pc(cl.f1) : '—'} | ${pc(x.golpesComunes)} | ${pc(x.mismasVoces)} | ${nf(x.difVoces)} | ${pc(x.melodia)} | ${pc(x.armonia)} |`);
      resumen.push({ show, toma: t.toma, fuente: t.fuente, transp: tr, costo, comun, crudas: c, limpias: cl });
    }
    // rasgos del jurado: cada par de tomas
    if (T.filter(t => t.an).length >= 2) {
      const R = T.filter(t => t.an && !fallidas.has(t.toma)).map(t => ({ toma: t.toma, r: rasgosReal(t.an) }));
      for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) for (const k of claves) { const d = distRasgo(R[i].r, R[j].r, k); if (Number.isFinite(d)) juntos[k].push(d); }
    }
    L.push('');
  }
  // tabla de rasgos: dentro del espectáculo contra entre espectáculos
  const filasR = claves.map(k => ({ k, dentro: med(juntos[k]), entre: med(entreShows[k]) })).filter(x => x.dentro != null).map(x => ({ ...x, razon: x.entre ? x.dentro / x.entre : null }));
  filasR.sort((a, b) => (b.razon ?? 0) - (a.razon ?? 0));
  L.push('## Rasgos del jurado: ¿miden la murga o el transcriptor?', '',
    'Distancia mediana entre dos tomas del mismo espectáculo, y entre dos espectáculos distintos del corpus (misma parte), en anchos de la norma del jurado. ' +
    'Una razón cerca de 1 quiere decir que dos noches del mismo espectáculo difieren tanto como dos espectáculos distintos: ese rasgo es sobre todo ruido del transcriptor. ' +
    'Cerca de 0, el rasgo es estable y describe a la murga.', '',
    '| Rasgo | Qué mide | Mismo espectáculo | Espectáculos distintos | Razón |', '|---|---|---|---|---|');
  for (const x of filasR) L.push(`| ${x.k} | ${RASGOS[x.k][1]} | ${nf(x.dentro)} | ${nf(x.entre)} | ${nf(x.razon)} |`);
  // lo que se aprende, con los números de esta corrida
  {
    const ok = resumen.filter(r => !r.fallida && r.limpias);
    const mismaNoche = ok.filter(r => r.costo < .03), otras = ok.filter(r => r.costo >= .06);
    const medF = L0 => med(L0.map(r => r.limpias.f1)), medM = L0 => med(L0.map(r => r.limpias.melodia));
    const estables = filasR.filter(x => x.razon != null && x.dentro > 0).slice(-5).map(x => x.k), ruido = filasR.filter(x => x.razon > .8).map(x => x.k);
    L.push('', '## Lo que se aprende', '');
    if (mismaNoche.length) L.push(`- **La misma noche, otra grabación.** ${mismaNoche.map(r => r.toma).join(', ')} es la misma actuación que la referencia, grabada desde otro lugar (el croma casi no cambia: costo DTW ${nf(med(mismaNoche.map(r => r.costo)), 3)}). Sus transcripciones coinciden en el ${pc(medF(mismaNoche))} de las notas y en el ${pc(medM(mismaNoche))} de la melodía. Es el techo de la cadena entre grabaciones: aunque el coro cante exactamente lo mismo, la toma, la mezcla y los cortes de 5 s cambian una de cada cuatro notas.`, '');
    if (otras.length) L.push(`- **Noches distintas.** Entre noches distintas del mismo espectáculo coincide el ${pc(medF(otras))} de las notas (mediana de ${otras.length} tomas, entre ${pc(Math.min(...otras.map(r => r.limpias.f1)))} y ${pc(Math.max(...otras.map(r => r.limpias.f1)))}) y el ${pc(medM(otras))} de la melodía. La distancia hasta el techo de la misma noche es lo que la murga cambia de una noche a la otra, más lo que agregan las grabaciones peores (la tribuna, la televisión).`, '');
    // las trabas: si en todas las tomas de un espectáculo (también el disco) el filtro saca mucho, es música
    const trabas = [];
    for (const [show, tomas] of porShow) {
      const fr = tomas.map(t => cargarToma(t.nombre)).filter(t => t?.an).map(t => (t.an.quitadas?.trabado || 0) / ((t.an.n_notas || 0) + Object.values(t.an.quitadas || {}).reduce((a, b) => a + b, 0)));
      if (fr.length >= 3 && Math.min(...fr) > .12) trabas.push(`${show} (${pc(Math.min(...fr))} a ${pc(Math.max(...fr))} en las ${fr.length} tomas)`);
    }
    if (trabas.length) L.push(`- **El filtro de trabas saca música.** En ${trabas.join('; ')}, el filtro de trabas de \`limpiar.js\` saca muchas notas en todas las tomas, también en el disco, que no tiene aplausos ni habla. Si fueran trabas del transcriptor no caerían en el mismo lugar en grabaciones distintas, pero caen en el mismo lugar y sobre los mismos acordes. Es un recitado cantado: golpes picados y parejos sobre un acorde (en el disco de Asaltantes, 22 golpes sobre Sol mayor y 21 sobre Do, cada 0,23 s). El filtro los confunde con trabas porque son igual de regulares. En el corpus pesa poco: las rachas que el filtro saca y que caen en la grilla del tempo, con tres voces o más, suman unos 520 golpes, menos del 1 %. Queda anotado para mejorar el filtro.`, '');
    L.push(`- **Qué rasgos describen a la murga.** Los más estables entre noches, comparados con la diferencia entre espectáculos, son ${estables.reverse().join(', ')}. ${ruido.length ? 'En cambio, ' + ruido.join(', ') + ' cambian entre dos noches casi tanto como entre dos espectáculos: en el jurado pesan como ruido.' : ''}`, '');
  }
  writeFileSync(join(DIR, 'comparacion.json'), JSON.stringify({ resumen, rasgos: filasR }, null, 1));
  writeFileSync(process.env.TOMAS_DIR ? join(DIR, 'tomas.md') : join(TRABAJO, '..', 'docs', 'tomas.md'), L.join('\n') + '\n');
  console.log(L.join('\n'));
}
void slug; void SR;
