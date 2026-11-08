// adornos.js — lo que hace cada cantor con las notas largas de las clarinadas y de los finales.
//
// Sin Disfraz (Lamolle y Lombardo, 1998), en el capítulo del coro: en las clarinadas y en los acordes finales (dos o
// tres compases en que todos cantan, por ejemplo, la «a»), cada cuerda canta en teoría una sola nota, pero algunos la
// adornan con vibratos, trinos y melismas distintos, y hasta se pasan de una voz a otra. Sale una movilidad que no se
// puede escribir en la partitura. No lo hacen todas las murgas: hay directores que prefieren un sonido más limpio.
//
// Acá eso es una curva de altura (semitonos) que se suma a la nota y un factor para el vibrato. Lo usan los dos motores
// (cantor.js y difonos.js); coro.js marca qué notas se pueden adornar y qué tienen cerca (nota.larga).
//
//   contexto(P)               → (q, p, seg) → { abajo, arriba, otras } o null: lo que coro.js pone en nota.larga
//   adornar(notas, opc)       → por nota: null o { altura(t), vibrato(t) }
//   cuantoAdorna(cuerda, semilla, c) → 0..1: la probabilidad de que ese cantor adorne una nota larga

class Rnd { constructor(s) { this.a = (s * 2654435761 + 7) >>> 0; } r() { let t = this.a += 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } u(a, b) { return a + (b - a) * this.r(); } }
const mod = (a, n) => ((a % n) + n) % n;
const suave = x => x <= 0 ? 0 : x >= 1 ? 1 : .5 - .5 * Math.cos(Math.PI * x);

export const ADORNOS = {
  cuanto: .45,       // en promedio, la probabilidad de que un cantor adorne una nota larga (los «algunos» del libro)
  limpios: .3,       // y esta parte de los cantores no adorna nunca
  minimo: .9,        // segundos: una nota más corta no se adorna
  largaSola: 1.6,    // fuera de las clarinadas y del acorde final, sólo las notas de este largo o más (los finales de frase)
};

const ESCALA = { mayor: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10] };

// Para cada nota larga de una pieza: su vecina de arriba y de abajo en la escala (con las notas del acorde que suena:
// si el acorde trae la sensible, la séptima menor no va) y las otras notas que suenan con ella, para pasarse de voz.
export function contexto(P) {
  const secs = P.secs || [];
  const todas = [];
  for (const k of ['bajos', 'segundos', 'primos', 'sobreprimos']) for (const e of P.ev?.[k] || []) todas.push([e[0], e[0] + e[1], e[2]]);
  todas.sort((a, b) => a[0] - b[0]);
  const desde = q => { let lo = 0, hi = todas.length; while (lo < hi) { const m = (lo + hi) >> 1; if (todas[m][0] < q - 64) lo = m + 1; else hi = m; } return lo; };
  const seccion = q => { let lo = 0, hi = secs.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (secs[m].inicio <= q) lo = m; else hi = m - 1; } return secs[lo]; };
  return (q, p, seg) => {
    const s = seccion(q);
    if (!s) return null;
    const especial = s.tipo === 'clarinada' || s.tipo === 'cierre';
    if (!(seg >= ADORNOS.largaSola || (especial && seg >= ADORNOS.minimo))) return null;
    const suenan = new Set();
    for (let i = desde(q); i < todas.length && todas[i][0] <= q; i++) if (todas[i][1] > q) suenan.add(todas[i][2]);
    const ton = s.tonica ?? 0, esc = new Set(ESCALA[s.modo === 'mayor' ? 'mayor' : 'menor']);
    for (const x of suenan) { const pc = mod(x - ton, 12); if (!esc.has(pc)) { esc.delete(mod(pc - 1, 12)); esc.delete(mod(pc + 1, 12)); esc.add(pc); } }
    const vecina = dir => { for (let k = 1; k <= 2; k++) if (esc.has(mod(p + dir * k - ton, 12))) return dir * k; return dir * 2; };
    const otras = [...suenan].map(x => x - p).filter(d => d !== 0 && Math.abs(d) <= 7 && Math.abs(d) >= 2).sort((a, b) => Math.abs(a) - Math.abs(b));
    return { abajo: vecina(-1), arriba: vecina(1), otras };
  };
}

// Cuánto adorna cada cantor: unos nada, otros bastante. El que lleva la cuerda y los bajos, menos (sostienen el
// acorde); la tercia, más (es la que se escapa del coro). Siempre igual para la misma semilla.
export function cuantoAdorna(cuerda, semilla, c = 0, A = ADORNOS) {
  const r = new Rnd(semilla * 89 + 41), rasgo = r.r();
  if (rasgo < A.limpios) return 0;
  let x = A.cuanto * (.55 + .9 * (rasgo - A.limpios) / (1 - A.limpios));
  if (c === 0 && cuerda !== 'tercia') x *= .5;
  if (cuerda === 'bajos') x *= .6;
  if (cuerda === 'tercia') x *= 1.4;
  return Math.min(1, +x.toFixed(2));
}

// notas: [{t0, t1, midi, larga?}] (larga, de contexto()). opc: { cuanto (0..1), semilla }.
// Cada nota adornable se adorna con probabilidad `cuanto`, de una de cuatro maneras:
//   vibrato: más ancho y un poco más lento en la segunda mitad;
//   trino: va y viene con la nota de arriba, a 5-6,5 vueltas por segundo, de medio segundo a un segundo;
//   grupeto: arriba, la nota, abajo, la nota (una vuelta rápida);
//   pasarse: se va a otra nota del acorde (la que canta otra cuerda), por una nota de paso, y a veces vuelve.
// Nunca en el primer cuarto de la nota ni en los últimos 0,3 s (ahí está la caída del final).
export function adornar(notas, opc = {}) {
  const cuanto = opc.cuanto ?? 0;
  const res = notas.map(() => null);
  if (!(cuanto > 0)) return res;
  const r = new Rnd((opc.semilla || 1) * 97 + 13);
  notas.forEach((n, i) => {
    const L = n.t1 - n.t0, ctx = n.larga;
    // un sorteo por nota aunque no se adorne, para que cambiar `cuanto` no cambie los adornos de las otras notas
    const sorteo = r.r(), tipoU = r.r(), u = [r.r(), r.r(), r.r(), r.r()];
    if (!ctx || L < ADORNOS.minimo || sorteo >= cuanto) return;
    const ini = n.t0 + Math.max(.25, .25 * L), fin = n.t1 - .3;
    if (fin - ini < .35) return;
    const pesos = [['vibrato', 2], ['trino', 3], ['grupeto', 2.5], ['pasarse', ctx.otras?.length ? 2.5 : 0]];
    let acc = tipoU * pesos.reduce((a, [, w]) => a + w, 0), tipo = 'vibrato';
    for (const [t, w] of pesos) { if (acc < w) { tipo = t; break; } acc -= w; }
    const lerp = (a, b, x) => a + (b - a) * x;
    // el guion de MBROLA lleva como mucho 90 puntos de altura por sonido: el adorno no puede ser más rápido que eso
    const paso = Math.max(.02, L / 90);
    if (tipo === 'vibrato') {
      const ts = lerp(ini, Math.max(ini, (n.t0 + n.t1) / 2), u[0]), k = lerp(1.7, 2.3, u[1]);
      res[i] = { tipo, altura: () => 0, vibrato: t => 1 + (k - 1) * suave((t - ts) / .4) };
      return;
    }
    if (tipo === 'trino') {
      const f = Math.min(lerp(5, 6.5, u[0]), 1 / (5 * paso));
      const ts = lerp(ini, Math.max(ini, fin - .6), u[1]);
      const vueltas = Math.max(3, Math.floor(Math.min(lerp(.55, 1.1, u[2]), fin - ts) * f));
      const te = ts + vueltas / f, a = ctx.arriba;
      // cada vuelta: sube y baja (un coseno afilado, así se queda un poco en cada nota)
      const forma = x => { const s = .5 - .5 * Math.cos(2 * Math.PI * x); return s * s * (3 - 2 * s); };
      res[i] = { tipo, altura: t => t <= ts || t >= te ? 0 : a * forma((t - ts) * f), vibrato: t => t > ts - .1 && t < te + .1 ? .25 : 1 };
      return;
    }
    // grupeto y pasarse: escalones con portamento corto
    const esc = [];   // [tiempo, semitonos]
    let ts;
    if (tipo === 'grupeto') {
      const d = lerp(.1, .15, u[0]);
      ts = lerp(ini, Math.max(ini, fin - 4 * d), u[1]);
      [ctx.arriba, 0, ctx.abajo, 0].forEach((v, k) => esc.push([ts + k * d, v]));
    } else {
      const meta = ctx.otras[u[0] < .7 ? 0 : Math.min(ctx.otras.length - 1, 1)];
      const d = lerp(.12, .18, u[1]);
      ts = lerp(ini, Math.max(ini, (ini + fin) / 2), u[2]);
      let t = ts;
      if (Math.abs(meta) > 2) { esc.push([t, meta > 0 ? ctx.arriba : ctx.abajo]); t += d; }
      esc.push([t, meta]);
      const queda = Math.min(fin, t + d + lerp(.5, 1.1, u[3]));
      if (u[3] < .5 && queda < fin - .15) esc.push([queda, 0]);   // vuelve; si no, se queda en la otra voz
    }
    // el vibrato casi se va mientras cambia de nota y vuelve cuando se queda en una
    const port = .035;
    res[i] = { tipo, altura: t => { let v = 0, prev = 0; for (const [tk, x] of esc) { v += (x - prev) * suave((t - tk) / port); prev = x; } return v; },
      vibrato: t => esc.some(([tk]) => t > tk - .08 && t < tk + .16) ? .3 : 1 };
  });
  return res;
}
