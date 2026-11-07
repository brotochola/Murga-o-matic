// Análisis completo de un tramo. Deja un .json en murga_trabajo/analisis y una imagen de revisión.
//   node herramientas/analizar.js            todos los tramos
//   node herramientas/analizar.js nombre…    sólo esos
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cargar, nombres, TRABAJO, REVISION } from './corpus.js';
import { grilla, ajuste } from './grilla.js';
import { limpiar } from './limpiar.js';
import { croma, tonalidades, acordes, grado, nomTono } from './analisis.js';
import { golpes, lineas } from './golpes.js';
import { dibujar } from './ver_tramo.js';
import { plantillas, ritmoDe, RITMOS } from './ritmo_loops.js';

const ANALISIS = join(TRABAJO, 'analisis');
const mod = (a, n) => ((a % n) + n) % n;
let PL = null;

// Con la batería: qué loop suena y dónde cae el 1, ventana a ventana (cada ventana salta un compás).
// El desplazamiento se sigue con Viterbi; sólo se miran desplazamientos pares porque la grilla
// está amarrada a las corcheas del coro.
function bateria(nombre, g, base, tot) {
  PL ||= plantillas();
  const { ventanas: V } = ritmoDe(nombre, g.aSemi, base, PL, tot);
  const W = V.length;
  const eMax = Math.max(...V.map(v => v.energia), 1e-9);
  const M = V.map(v => {
    const m = new Float64Array(8), l = new Int16Array(8);
    v.fila.forEach((f, i) => { for (let r = 0; r < 32; r += 2) { const k = (r % 16) / 2; if (f[r] > m[k]) { m[k] = f[r]; l[k] = i; } } });
    return { m, l };
  });
  const dp = Array.from({ length: W }, () => new Float64Array(8)), de = Array.from({ length: W }, () => new Int8Array(8));
  dp[0].set(M[0].m);
  for (let w = 1; w < W; w++) {
    let mej = 0; for (let k = 1; k < 8; k++) if (dp[w - 1][k] > dp[w - 1][mej]) mej = k;
    for (let k = 0; k < 8; k++) {
      const a = dp[w - 1][k], c = dp[w - 1][mej] - .8;
      if (a >= c) { dp[w][k] = a + M[w].m[k]; de[w][k] = k; } else { dp[w][k] = c + M[w].m[k]; de[w][k] = mej; }
    }
  }
  const rot = new Array(W);
  let k = 0; for (let j = 1; j < 8; j++) if (dp[W - 1][j] > dp[W - 1][k]) k = j;
  for (let w = W - 1; w >= 0; w--) { rot[w] = k * 2; k = de[w][k]; }
  return V.map((v, w) => ({
    c: v.c, r: rot[w],
    loop: RITMOS[M[w].l[rot[w] / 2]].id,
    s: Math.round(M[w].m[rot[w] / 2] * 100) / 100,
    e: Math.round(v.energia / eMax * 100) / 100,
  }));
}

// De dónde arranca el compás: los cambios de acorde y las notas largas caen en los tiempos fuertes.
// Devuelve, para cada pulso, en qué pulso del compás (0 a 3) cae, y deja cambiar de fase entre secciones.
function compases(ac, G, notas, largoVentana = 32) {
  const n = ac.length;
  const peso = new Float64Array(n);
  for (let i = 1; i < n; i++) if (ac[i].nombre !== ac[i - 1].nombre) peso[i] += 1;
  for (const g of G) {
    const b = g.q / 4;
    if (Number.isInteger(b) && b >= 0 && b < n && g.d >= 6) peso[b] += .6 * Math.min(g.d / 8, 2);
  }
  const em = Array.from({ length: n }, (_, i) => {
    const r = new Float64Array(4);
    for (let j = Math.max(0, i - largoVentana / 2); j < Math.min(n, i + largoVentana / 2); j++) r[mod(j, 4)] += peso[j];
    return r;
  });
  const dp = Array.from({ length: n }, () => new Float64Array(4)), de = Array.from({ length: n }, () => new Int8Array(4));
  dp[0].set(em[0]);
  for (let i = 1; i < n; i++) {
    let mej = 0; for (let k = 1; k < 4; k++) if (dp[i - 1][k] > dp[i - 1][mej]) mej = k;
    for (let k = 0; k < 4; k++) {
      const s = dp[i - 1][k], c = dp[i - 1][mej] - 30;
      if (s >= c) { dp[i][k] = s + em[i][k]; de[i][k] = k; } else { dp[i][k] = c + em[i][k]; de[i][k] = mej; }
    }
  }
  const fase = new Int8Array(n);
  let k = 0; for (let j = 1; j < 4; j++) if (dp[n - 1][j] > dp[n - 1][k]) k = j;
  for (let i = n - 1; i >= 0; i--) { fase[i] = k; k = de[i][k]; }
  return fase;  // el compás arranca en los pulsos con i % 4 === fase[i]
}

export function analizarTramo(nombre) {
  const t = cargar(nombre);
  const { datos: D } = t;
  const bpm = D.percusion?.bpm || D.mezcla?.bpm || 110;
  const g = grilla(t.notas, D.largo_s, bpm);
  const base = -Math.min(0, Math.floor(Math.min(...t.notas.map(n => g.aSemi(n.t))) / 16) * 16);
  const notas = t.notas.map(n => {
    const b = (g.aSemi(n.t) + base) / 4;
    return { p: n.p, t: n.t, tf: n.tf, b, fin: Math.max(b + .1, (g.aSemi(n.tf) + base) / 4) };
  });
  const L = limpiar(notas);
  const N = L.limpias;
  const cr = croma(N), tn = tonalidades(cr), ac = acordes(cr, tn);
  const { G, ajuste: aj } = golpes(N);
  lineas(G);
  const fase = compases(ac, G, N);
  const xs = N.map(n => n.b * 4);
  const tot = Math.ceil(Math.max(...N.map(n => n.fin))) * 4 + 64;
  const bat = bateria(nombre, g, base, tot);
  return {
    t, g, notas, L, N, cr, tn, ac, G, fase, base, bat,
    ajuste: { semicorchea: ajuste(xs, 1), corchea: ajuste(xs, 2), libre: g.libre.filter(Boolean).length / g.libre.length },
  };
}

function guardar(A) {
  const { t, N, tn, ac, G, fase, g, base, L } = A;
  const D = t.datos;
  const salida = {
    nombre: t.nombre, murga: D.murga, anio: +D.anio, espectaculo: D.espectaculo, parte: D.parte, largo_s: D.largo_s,
    ajuste: A.ajuste, quitadas: L.cuenta, n_notas: N.length,
    bpm: g.semicorchea.map(p => Math.round(150 / p) / 10),
    libre: g.libre.map(x => (x ? 1 : 0)),
    notas: N.map(n => [Math.round(n.b * 1000) / 1000, Math.round(n.fin * 1000) / 1000, n.p, Math.round(n.t * 100) / 100]),
    golpes: G.map(x => [x.q, x.d, x.ps, x.lin]),
    // cuándo suena cada golpe en el audio, en segundos: de acá salen los recortes de voz
    segs: G.map(x => { const t = x.ns.map(n => n.t).sort((a, b) => a - b), f = x.ns.map(n => n.tf).sort((a, b) => a - b); return [Math.round(t[t.length >> 1] * 1000) / 1000, Math.round(f[f.length >> 1] * 1000) / 1000]; }),
    acordes: ac.map((a, i) => [a.r, a.q, tn[i].t, tn[i].modo === 'mayor' ? 1 : 0, fase[i]]),
    base,
    bateria: A.bat,
    energia: D.energia,
  };
  writeFileSync(join(ANALISIS, t.nombre + '.json'), JSON.stringify(salida));
}

if (process.argv[1]?.endsWith('analizar.js')) {
  mkdirSync(ANALISIS, { recursive: true });
  mkdirSync(REVISION, { recursive: true });
  const lista = process.argv.length > 2 ? process.argv.slice(2) : nombres();
  console.log('tramo'.padEnd(44) + 'notas  quit%  aj16 aj8  lib%  tonalidades');
  for (const n of lista) {
    const A = analizarTramo(n);
    guardar(A);
    A.t.datos.energia && writeFileSync(join(REVISION, n + '.png'), dibujar({ ...A.t, notas: A.notas, aSeg: b => A.notas.length ? segDe(A, b) : b }, A.L.indices));
    const tonos = []; let u = '';
    for (const k of A.tn) { const s = nomTono(k); if (s !== u) { tonos.push(s); u = s; } }
    console.log(n.padEnd(44) + String(A.notas.length).padStart(5) + (100 * A.L.quitadas.length / A.notas.length).toFixed(1).padStart(7) + A.ajuste.semicorchea.toFixed(2).padStart(6) + A.ajuste.corchea.toFixed(2).padStart(5) + String(Math.round(100 * A.ajuste.libre)).padStart(5) + '  ' + tonos.slice(0, 6).join(' > ') + '   ' + JSON.stringify(A.L.cuenta));
  }
}

// De pulso (grilla nueva) a segundos, interpolando con las notas
function segDe(A, b) {
  const N = A.notas;
  let lo = 0, hi = A._orden?.length || 0;
  if (!A._orden) { A._orden = [...N].sort((x, y) => x.b - y.b); hi = A._orden.length - 1; } else hi--;
  const O = A._orden;
  if (b <= O[0].b) return O[0].t;
  if (b >= O[O.length - 1].b) return O[O.length - 1].t;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (O[m].b <= b) lo = m; else hi = m; }
  const f = (b - O[lo].b) / Math.max(1e-6, O[hi].b - O[lo].b);
  return O[lo].t + f * (O[hi].t - O[lo].t);
}
