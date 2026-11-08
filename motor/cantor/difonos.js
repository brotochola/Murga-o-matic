// difonos.js — un cantor por difonos: de notas con sílabas a un guion para MBROLA (formato .pho) y a la curva de
// volumen que se le aplica después. MBROLA pega pedazos de voz grabada (difonos: de la mitad de un sonido a la mitad
// del siguiente), así que las transiciones entre consonante y vocal son de una persona y se entiende lo que dice.
// Lo que canta lo decide este archivo: cuánto dura cada sonido, la altura con su portamento, vibrato y caída, y el
// volumen. No hay redes neuronales: es corte y pegado de grabaciones con PSOLA.
//
// Las voces castellanas de MBROLA (es1, es2, es4) usan SAMPA. Las consonantes cantadas duran menos que habladas: la
// vocal se lleva la nota, como en el canto ligado.

export const SAMPA = {
  a: 'a', e: 'e', i: 'i', o: 'o', u: 'u', j: 'i', w: 'u', l: 'l', r: 'r', R: 'rr', m: 'm', n: 'n', N: 'J',
  B: 'b', D: 'd', G: 'g', b: 'b', d: 'd', g: 'g', p: 'p', t: 't', k: 'k', C: 'tS', f: 'f', s: 's', h: 's', x: 'x', S: 'jj', Z: 'jj',
};
// duraciones cantadas, en segundos
export const DURACION = {
  p: .06, t: .055, k: .065, b: .05, d: .045, g: .05, tS: .08, f: .07, s: .07, x: .075,
  m: .055, n: .05, J: .065, l: .05, L: .06, r: .028, rr: .075, jj: .065, i: .04, u: .04, w: .04,
};
const VOCAL = p => 'aeiou'.includes(p);
import { VARIACION } from './variacion.js';

class Rnd { constructor(s) { this.a = (s * 2654435761 + 7) >>> 0; } r() { let t = this.a += 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } u(a, b) { return a + (b - a) * this.r(); } }

// notas: [{t0, t1, midi, vel, sil: {ataque, nucleo, coda}}] en segundos absolutos, ordenadas.
// Devuelve { pho, inicio, fin, segs, ganancia(t) }: el guion empieza en `inicio` (segundos de la pieza).
export function guion(notas, opc = {}) {
  const o = {
    vibrato: .14, vibVel: 5.5, vibEntra: .22, deriva: .05, temblor: 0, pique: .45, caida: .8, consonantes: 1, semilla: 1,
    w: true, transporte: 0, eses: 1, ...opc,
  };
  const rng = new Rnd(o.semilla);
  const sym = p => { const s = SAMPA[p] || 'a'; return s === 'u' && p === 'w' && o.w ? 'w' : s; };
  // las eses de las voces castellanas son largas y silban (pico en 5 kHz): cantadas, más cortas
  const dur = s => (s === 's' ? DURACION.s - .02 * o.eses : DURACION[s] || .05) * o.consonantes;
  const consonante = p => p && !VOCAL(p) && p !== 'j' && p !== 'w';
  const N = notas.length;
  // 1. cuánto se adelanta el ataque de cada nota (se lo roba a la nota anterior, como mucho la mitad)
  const tA = notas.map((n, i) => {
    const d = n.sil.ataque.reduce((a, p) => a + dur(sym(p)), 0);
    const prev = notas[i - 1];
    const libre = prev && n.t0 - prev.t1 < .02 ? (prev.t1 - prev.t0) * .45 : .25;
    return Math.min(d, libre);
  });
  // 2. los segmentos, en tiempo absoluto
  const segs = [];
  const poner = (p, t0, t1, nota, tipo) => { if (t1 - t0 > .004) segs.push({ p, t0, t1, nota, tipo }); };
  for (let i = 0; i < N; i++) {
    const n = notas[i], sig = notas[i + 1];
    const a = n.t0 - tA[i];
    const ligada = sig && sig.t0 - n.t1 < .02;
    const b = ligada ? sig.t0 - tA[i + 1] : n.t1;
    // ataque
    const ata = n.sil.ataque.map(sym), dAta = ata.map(dur), sA = dAta.reduce((x, y) => x + y, 0) || 1;
    let t = a;
    ata.forEach((p, k) => { const d = dAta[k] * tA[i] / sA; poner(p, t, t + d, i, 'ataque'); t += d; });
    t = n.t0;
    // coda al final, núcleo en el medio
    const coda = n.sil.coda.map(sym);
    // la s antes de consonante se aspira, como en el Río de la Plata ("loh guriseh corren"): corta y como un soplo
    const sigFon = ligada ? (sig.sil.ataque[0] || sig.sil.nucleo[0]) : null;
    const aspirada = coda.map((p, k) => p === 's' && o.eses > 0 && (k < coda.length - 1 || consonante(sigFon)));
    let dCoda = coda.map((p, k) => aspirada[k] ? .032 * o.consonantes : dur(p)); const sC = dCoda.reduce((x, y) => x + y, 0);
    if (sC > (b - t) * .35) dCoda = dCoda.map(d => d * (b - t) * .35 / sC);
    const finNuc = b - dCoda.reduce((x, y) => x + y, 0);
    const nuc = (n.sil.nucleo.length ? n.sil.nucleo : ['a']);
    const cortas = nuc.filter(p => !VOCAL(p)).length, largas = nuc.filter(VOCAL);
    const dCorta = Math.min(.045, (finNuc - t) * .2);
    const dLarga = (finNuc - t - cortas * dCorta) / Math.max(1, largas.length);
    for (const p of nuc) { const d = VOCAL(p) ? dLarga : dCorta; poner(sym(p), t, t + d, i, VOCAL(p) ? 'vocal' : 'semi'); t += d; }
    coda.forEach((p, k) => { poner(p, t, t + dCoda[k], i, aspirada[k] ? 'aspirada' : 'coda'); t += dCoda[k]; });
    if (sig && !ligada) { const desde = t, hasta = sig.t0 - tA[i + 1]; if (hasta - desde > .004) segs.push({ p: '_', t0: desde, t1: hasta, nota: -1, tipo: 'silencio' }); }
  }
  // 3. la altura (semitonos), como función del tiempo
  const inicio = segs[0].t0 - .25, fin = segs[segs.length - 1].t1 + .3;
  const fases = [0, 1, 2].map(() => rng.u(0, 6.28)), velVib = rng.u(.97, 1.03);
  const sueltas = new Set(); // notas que empiezan después de un silencio
  for (let i = 0; i < N; i++) if (i === 0 || notas[i].t0 - notas[i - 1].t1 >= .02) sueltas.add(i);
  const finales = new Set(); for (let i = 0; i < N; i++) if (i === N - 1 || notas[i + 1].t0 - notas[i].t1 >= .02) finales.add(i);
  const suave = x => x <= 0 ? 0 : x >= 1 ? 1 : .5 - .5 * Math.cos(Math.PI * x);
  const notaEn = t => { let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (notas[m].t0 - tA[m] <= t) lo = m; else hi = m - 1; } return lo; };
  // temblor: una afinación que tiembla un poco, rápido (ruido filtrado, un valor cada 10 ms)
  const nT = Math.ceil((fin - inicio) / .01) + 2, tiembla = new Float32Array(nT);
  { let y = 0; const g = () => { let u = 0; for (let k = 0; k < 4; k++) u += rng.r(); return (u - 2) * 1.7; }; for (let k = 0; k < nT; k++) { y = .55 * y + .45 * g(); tiembla[k] = y; } }
  const temblor = t => { const x = (t - inicio) / .01, k = Math.max(0, Math.min(nT - 2, Math.floor(x))), f = x - k; return tiembla[k] * (1 - f) + tiembla[k + 1] * f; };
  let fase = 0, tPrev = inicio;
  const altura = t => {
    const i = notaEn(t), n = notas[i], sig = notas[i + 1];
    let m = n.midi;
    // la nota anterior todavía suena durante el ataque: el portamento va del ataque al comienzo de la vocal
    if (!sueltas.has(i) && i > 0 && t < n.t0 + .03) {
      const g0 = n.t0 - tA[i] - .02, x = (t - g0) / (n.t0 + .03 - g0);
      m = notas[i - 1].midi + (n.midi - notas[i - 1].midi) * suave(x);
    }
    if (sueltas.has(i)) m -= o.pique * (1 - suave((t - (n.t0 - tA[i])) / Math.max(.06, tA[i] + .08)));
    // la caída al final de la frase
    if (finales.has(i) && n.t1 - n.t0 > .4) m -= o.caida * suave((t - (n.t1 - .14)) / .14) ** 1.5;
    // vibrato: entra de a poco en las notas largas
    const enNota = t - n.t0, vamp = suave((enNota - o.vibEntra) / .3) * (n.t1 - n.t0 > .3 ? 1 : 0);
    fase += 2 * Math.PI * o.vibVel * velVib * (1 + .05 * Math.sin(1.1 * t + fases[0])) * Math.max(0, t - tPrev); tPrev = t;
    const deriva = o.deriva * (.6 * Math.sin(2 * Math.PI * .7 * t + fases[0]) + .3 * Math.sin(2 * Math.PI * 1.9 * t + fases[1]) + .2 * Math.sin(2 * Math.PI * 3.3 * t + fases[2]));
    return m + o.transporte + o.vibrato * vamp * Math.sin(fase) + deriva + o.temblor * temblor(t);
  };
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  // 4. el guion: duraciones redondeadas sin que se acumule el error
  const lineas = [];
  let msAnt = 0;
  const msHasta = t => Math.round((t - inicio) * 1000);
  const linea = (p, t0, t1, conAltura) => {
    const ms = msHasta(t1) - msAnt; if (ms <= 0) return; msAnt += ms;
    if (!conAltura) { lineas.push(`${p} ${ms}`); return; }
    const paso = Math.max(o.temblor ? .01 : .02, (t1 - t0) / 90), pasos = Math.max(1, Math.round((t1 - t0) / paso)), pts = [];
    for (let k = 0; k <= pasos; k++) { const x = k / pasos; pts.push(`${+(x * 100).toFixed(1)} ${hz(altura(t0 + x * (t1 - t0))).toFixed(1)}`); }
    lineas.push(`${p} ${ms} ${pts.join(' ')}`);
  };
  linea('_', inicio, segs[0].t0, false);
  for (const s of segs) linea(s.p, s.t0, s.t1, s.p !== '_');
  linea('_', segs[segs.length - 1].t1, fin, false);
  // 5. el volumen: cada nota con su fuerza, las largas crecen un poco, y un poco de temblor con el vibrato
  const ganancia = t => {
    const i = notaEn(t), n = notas[i];
    const vel = n.vel ?? .8;
    let db = 20 * Math.log10(.4 + .75 * vel);
    const largo = n.t1 - n.t0;
    if (largo > .5) db += 1.5 * suave((t - n.t0 - .1) / .4);
    if (finales.has(i)) db -= 12 * suave((t - (n.t1 - .12)) / .12);
    return Math.pow(10, db / 20);
  };
  return { pho: lineas.join('\n') + '\n', inicio, fin, segs, ganancia };
}

// Después de MBROLA: el volumen de cada nota, las eses más suaves, un poco de aire (ruido que sigue a la voz) y la
// emisión murguera (más presencia en 2-4 kHz, menos barro en los graves, un poco de saturación). x: Float32Array a sr;
// g: el guion.
export function terminar(x, sr, g, opc = {}) {
  const o = { aire: 0, emision: 0, semilla: 1, ...opc };
  const y = new Float32Array(x.length);
  for (let k = 0; k < x.length; k++) y[k] = x[k] * g.ganancia(g.inicio + k / sr);
  const bq = (tipo, f, q, db) => {
    const A = Math.pow(10, db / 40), w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (tipo === 'pico') { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; }
    else if (tipo === 'graves') { const s = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) - (A - 1) * c + s); b1 = 2 * A * ((A - 1) - (A + 1) * c); b2 = A * ((A + 1) - (A - 1) * c - s); a0 = (A + 1) + (A - 1) * c + s; a1 = -2 * ((A - 1) + (A + 1) * c); a2 = (A + 1) + (A - 1) * c - s; }
    else if (tipo === 'agudos') { const s = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * c + s); b1 = -2 * A * ((A - 1) + (A + 1) * c); b2 = A * ((A + 1) + (A - 1) * c - s); a0 = (A + 1) - (A - 1) * c + s; a1 = 2 * ((A - 1) - (A + 1) * c); a2 = (A + 1) - (A - 1) * c - s; }
    else { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }   // pasabanda
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  };
  const filtrar = (z, f) => { let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let k = 0; k < z.length; k++) { const v = f.b0 * z[k] + f.b1 * x1 + f.b2 * x2 - f.a1 * y1 - f.a2 * y2; x2 = x1; x1 = z[k]; y2 = y1; y1 = v; z[k] = v; } };
  const eses = opc.eses ?? 1;
  if (eses > 0) {
    // Las eses: más bajas y sin el silbido de 4-5 kHz (la s rioplatense es más aguda y más suave que la castellana).
    // Las aspiradas, además, sin agudos: un soplo. Se hace sólo sobre cada s, con rampas de 8 ms.
    const r = Math.round(.008 * sr), pre = Math.round(.02 * sr);
    for (const s of g.segs) {
      if (s.p !== 's') continue;
      const asp = s.tipo === 'aspirada';
      const a = Math.round((s.t0 - g.inicio) * sr), b = Math.round((s.t1 - g.inicio) * sr);
      const desde = Math.max(0, a - r - pre), hasta = Math.min(y.length, b + r);
      if (hasta - desde < 8) continue;
      const z = y.slice(desde, hasta);
      filtrar(z, bq('pico', 4700, 1.4, -8 * eses));
      if (asp) { filtrar(z, bq('agudos', 2500, .7, -12 * eses)); }
      else filtrar(z, bq('agudos', 7500, .7, 5 * eses));
      const gan = Math.pow(10, -(asp ? 5 : 2.5) * eses / 20);
      for (let k = Math.max(desde, a - r); k < hasta; k++) {
        const m = Math.min(1, (k - (a - r)) / r, (b + r - k) / r);
        if (m <= 0) continue;
        y[k] = y[k] * (1 - m) + z[k - desde] * gan * m;
      }
    }
  }
  if (o.aire > 0) {
    // ruido entre 1,5 y 5 kHz, con la envolvente de la voz
    const rng = new Rnd(o.semilla * 13 + 1), n = new Float32Array(y.length);
    for (let k = 0; k < n.length; k++) n[k] = rng.r() * 2 - 1;
    filtrar(n, bq('banda', 2800, .7, 0)); filtrar(n, bq('banda', 3200, .5, 0));
    let env = 0; const a = 1 - Math.exp(-1 / (.012 * sr));
    let pn = 0; for (let k = 0; k < n.length; k++) pn += n[k] * n[k]; pn = Math.sqrt(pn / n.length) || 1;
    for (let k = 0; k < y.length; k++) { env += (Math.abs(y[k]) - env) * a; y[k] += n[k] / pn * env * o.aire; }
  }
  if (o.emision > 0) {
    const e = o.emision;
    filtrar(y, bq('graves', 250, .7, -2.5 * e)); filtrar(y, bq('pico', 2900, 1.1, 4.5 * e));
    let m = 0; for (const v of y) m = Math.max(m, Math.abs(v));
    const d = .6 + .4 * e, k = Math.tanh(d);
    for (let i = 0; i < y.length; i++) y[i] = Math.tanh(d * y[i] / (m || 1)) / k * (m || 1);
  }
  return y;
}

// De la frecuencia de la voz (16 o 22,05 kHz) a la de la página: sinc con ventana de Kaiser, tabla precalculada.
const TABLA = (() => {
  const H = 16, R = 256, t = new Float32Array(H * R + 1), I0 = x => { let s = 1, d = 1; for (let k = 1; k < 25; k++) { d *= (x / 2 / k) ** 2; s += d; } return s; }, b = 8.6;
  for (let i = 0; i <= H * R; i++) { const x = i / R, w = I0(b * Math.sqrt(Math.max(0, 1 - (x / H) ** 2))) / I0(b); t[i] = (x === 0 ? 1 : Math.sin(Math.PI * x * .94) / (Math.PI * x)) * w * (x === 0 ? .94 : 1); }
  return { H, R, t };
})();
export function remuestrear(x, srIn, srOut) {
  if (srIn === srOut) return Float32Array.from(x);
  const { H, R, t } = TABLA, paso = srIn / srOut, esc = Math.min(1, srOut / srIn), n = Math.floor(x.length / paso);
  const y = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const p = k * paso, c = Math.floor(p);
    let s = 0;
    for (let j = c - H + 1; j <= c + H; j++) {
      if (j < 0 || j >= x.length) continue;
      const d = Math.abs(p - j) * esc * R, i = d | 0; if (i >= H * R) continue;
      s += x[j] * (t[i] + (t[i + 1] - t[i]) * (d - i));
    }
    y[k] = s * esc;
  }
  return y;
}

// Cada cuerda con su largo de tracto (los formantes, más graves en los bajos) y cada cantor con sus mañas, chicas,
// como en variacion.js: un poco más alto o más bajo, su vibrato, su garganta, cuánto pica al entrar y cuánto alarga
// las consonantes. Devuelve las opciones para cantarDifonos.
export const TIPOS_DIFONOS = { bajo: { tracto: .9 }, baritono: { tracto: .95 }, tenor: { tracto: 1 }, tenorAlto: { tracto: 1.06 } };
export function cantorDifonos(tipo, semilla, V = VARIACION) {
  const r = new Rnd(semilla * 17 + 3), T = TIPOS_DIFONOS[tipo] || TIPOS_DIFONOS.tenor;
  return {
    semilla, tracto: T.tracto * r.u(1 - V.garganta, 1 + V.garganta),
    transporte: r.u(-V.desafinacion, V.desafinacion),
    vibrato: r.u(V.vibrato[0], V.vibrato[1]), vibVel: r.u(V.vibratoVel[0], V.vibratoVel[1]), vibEntra: r.u(V.vibratoEntra[0], V.vibratoEntra[1]),
    pique: .45 * r.u(1 - V.pique, 1 + V.pique), consonantes: 1.1 * r.u(1 - V.diccion * .5, 1 + V.diccion * .5),
    temblor: .04, emision: 1,
  };
}

// Un cantor entero: guion → MBROLA → volumen, eses, aire y emisión. mb: lo que devuelve crearMbrola.
// Devuelve { x, sr, inicio }: las muestras a la frecuencia `sr`, empezando en el segundo `inicio` de la pieza.
// El largo del tracto (opc.tracto) se hace como con una cinta: MBROLA canta más agudo y más largo, y las muestras se
// tocan más rápido (sr más alta); la altura y los tiempos vuelven a su lugar y los formantes suben `tracto` veces.
// (La página las pasa a su frecuencia con Web Audio; en Node, con remuestrear.)
export function cantarDifonos(mb, notas, opc = {}) {
  const F = mb.frecuencia, a = Math.round(F * (opc.tracto || 1)) / F;
  if (!notas.length) return { x: new Float32Array(0), sr: F * a, inicio: 0 };
  const ns = a === 1 ? notas : notas.map(n => ({ ...n, t0: n.t0 * a, t1: n.t1 * a, midi: n.midi - 12 * Math.log2(a) }));
  const o = a === 1 ? opc : { ...opc, consonantes: (opc.consonantes ?? 1) * a, vibVel: (opc.vibVel ?? 5.5) / a, vibEntra: (opc.vibEntra ?? .22) * a };
  const g = guion(ns, o);
  const crudo = mb.cantar(g.pho), x = new Float32Array(crudo.length);
  for (let k = 0; k < x.length; k++) x[k] = crudo[k] / 32768;
  return { x: terminar(x, F, g, o), sr: F * a, inicio: g.inicio / a };
}
