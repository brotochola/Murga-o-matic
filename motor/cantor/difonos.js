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
import { VARIACION, VARIACION_DIFONOS, ESTILO } from './variacion.js';
import * as TIMBRES from './timbre.js';
import { ecualizar, ponderarA } from './eq.js';
import { adornar, cuantoAdorna } from './adornos.js';
import { AGUDO, hayAgudo, phoGrave, corregirAgudo } from './agudo.js';

class Rnd { constructor(s) { this.a = (s * 2654435761 + 7) >>> 0; } r() { let t = this.a += 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } u(a, b) { return a + (b - a) * this.r(); } }

// notas: [{t0, t1, midi, vel, sil: {ataque, nucleo, coda}}] en segundos absolutos, ordenadas.
// Devuelve { pho, inicio, fin, segs, ganancia(t) }: el guion empieza en `inicio` (segundos de la pieza).
export function guion(notas, opc = {}) {
  const o = {
    vibrato: .14, vibVel: 5.5, vibEntra: .22, deriva: .05, temblor: 0, pique: .45, caida: .8, consonantes: 1, semilla: 1,
    // eses: 50 ms (esesCortas .57), más bajas y sin filtrar (en terminar: esesFiltro 0, esesDb 8). Cortas y filtradas
    // sonaban a t (Whisper oía «Te íbamos» por «Seguimos») y a chasquido.
    w: true, transporte: 0, eses: 1, esesCortas: .57, acento: 1, sheismo: 1, golpe: 0, arco: 0, adornos: 0,
    // lo que se midió en los solistas de verdad (docs/solistas_reales.md): pasa, semitonos que se pasa de la nota al
    // ligar un salto y vuelve en 100 ms; piqueVa, segundos después del comienzo de la vocal en que termina de llegar
    // desde abajo; caidaProb, qué parte de los finales de frase caen; caidaLargo, en cuántos segundos; suelta, en cuántos
    // segundos se apaga (12 dB) el final de la frase; crece, dB que crecen las notas largas
    pasa: 0, piqueVa: .08, caidaProb: 1, caidaLargo: .14, suelta: .12, crece: 1.5, ...opc,
  };
  const rng = new Rnd(o.semilla);
  // ll e y: la "sh" rioplatense ("shegó", "cashe"). Estas voces no la tienen: se canta la ll castellana (jj, que ya
  // va hacia el paladar como la sh) y terminar() le suma el soplo de la sh y le deja poca voz
  const SH = p => o.sheismo > 0 && (p === 'Z' || p === 'S');
  const conW = o.w && o.voz !== 'es4';      // es4 no tiene la w: va como u
  const sym = p => { const s = SAMPA[p] || 'a'; return s === 'u' && p === 'w' && conW ? 'w' : s; };
  // las eses de las voces castellanas son largas y silban (pico en 5 kHz): cantadas, la mitad
  const dur = s => (s === 's' ? DURACION.s - .035 * (o.esesCortas ?? o.eses) : DURACION[s] || .05) * o.consonantes;
  const consonante = p => p && !VOCAL(p) && p !== 'j' && p !== 'w';
  const N = notas.length;
  // 1. cuánto se adelanta el ataque de cada nota (se lo roba a la nota anterior, como mucho la mitad)
  const tA = notas.map((n, i) => {
    const d = n.sil.ataque.reduce((a, p) => a + (SH(p) ? DURACION.jj * o.consonantes : dur(sym(p))), 0);
    const prev = notas[i - 1];
    const libre = prev && n.t0 - prev.t1 < .02 ? (prev.t1 - prev.t0) * .45 : .25;
    return Math.min(d, libre);
  });
  const sueltaPrev = i => notas[i].t0 - notas[i - 1].t1 >= .02;
  // 2. los segmentos, en tiempo absoluto
  const segs = [];
  const poner = (p, t0, t1, nota, tipo) => { if (t1 - t0 > .004) segs.push({ p, t0, t1, nota, tipo }); };
  for (let i = 0; i < N; i++) {
    const n = notas[i], sig = notas[i + 1];
    const a = n.t0 - tA[i];
    const ligada = sig && sig.t0 - n.t1 < .02;
    const b = ligada ? sig.t0 - tA[i + 1] : n.t1;
    // ataque
    // después de un silencio la r es siempre fuerte (y es4 no tiene el difono de silencio a r suave)
    const ata = n.sil.ataque.map((p, k) => k === 0 && p === 'r' && (i === 0 || sueltaPrev(i)) ? 'rr' : sym(p)), dAta = ata.map((p, k) => SH(n.sil.ataque[k]) ? DURACION.jj * o.consonantes : dur(p)), sA = dAta.reduce((x, y) => x + y, 0) || 1;
    let t = a;
    ata.forEach((p, k) => { const d = dAta[k] * tA[i] / sA; poner(p, t, t + d, i, SH(n.sil.ataque[k]) ? 'sh' : 'ataque'); t += d; });
    t = n.t0;
    // coda al final, núcleo en el medio
    // Acento rioplatense, exagerado como en la murga. La s del final de la palabra:
    //   antes de vocal se oye, suave, pegada a la palabra siguiente ("la-salas", "lu-ce-s y");
    //   en los artículos antes de consonante queda un soplo ("lah luce");
    //   si no, no se canta ("lo gurise corren").
    // La de adentro de la palabra se aspira ("fiehta"): corta y como un soplo.
    let coda = n.sil.coda.map(sym);
    const sigFon = ligada ? (sig.sil.ataque[0] || sig.sil.nucleo[0]) : null;
    const tipos = coda.map(() => 'coda');
    if (o.acento > 0) coda.forEach((p, k) => { if (p === 's') tipos[k] = 'aspirada'; });
    if (o.acento > 0 && n.sil.fin && coda[coda.length - 1] === 's') {
      if (ligada && !consonante(sigFon)) tipos[coda.length - 1] = 'ligada';
      else if (!(ligada && n.sil.articulo)) { coda = coda.slice(0, -1); tipos.pop(); }
    } else if (o.acento <= 0 && o.eses > 0) coda.forEach((p, k) => { if (p === 's' && (k < coda.length - 1 || consonante(sigFon))) tipos[k] = 'aspirada'; });
    const aspirada = tipos.map(t => t === 'aspirada');
    let dCoda = coda.map((p, k) => tipos[k] === 'aspirada' ? .025 * o.consonantes : tipos[k] === 'ligada' ? .03 * o.consonantes : dur(p)); const sC = dCoda.reduce((x, y) => x + y, 0);
    if (sC > (b - t) * .35) dCoda = dCoda.map(d => d * (b - t) * .35 / sC);
    const finNuc = b - dCoda.reduce((x, y) => x + y, 0);
    const nuc = (n.sil.nucleo.length ? n.sil.nucleo : ['a']);
    const cortas = nuc.filter(p => !VOCAL(p)).length, largas = nuc.filter(VOCAL);
    const dCorta = Math.min(.045, (finNuc - t) * .2);
    const dLarga = (finNuc - t - cortas * dCorta) / Math.max(1, largas.length);
    for (const p of nuc) { const d = VOCAL(p) ? dLarga : dCorta; poner(sym(p), t, t + d, i, VOCAL(p) ? 'vocal' : 'semi'); t += d; }
    coda.forEach((p, k) => { poner(p, t, t + dCoda[k], i, tipos[k]); t += dCoda[k]; });
    if (sig && !ligada) { const desde = t, hasta = sig.t0 - tA[i + 1]; if (hasta - desde > .004) segs.push({ p: '_', t0: desde, t1: hasta, nota: -1, tipo: 'silencio' }); }
  }
  // 3. la altura (semitonos), como función del tiempo
  const inicio = segs[0].t0 - .25, fin = segs[segs.length - 1].t1 + .3;
  const fases = [0, 1, 2].map(() => rng.u(0, 6.28)), velVib = rng.u(.97, 1.03);
  const sueltas = new Set(); // notas que empiezan después de un silencio
  for (let i = 0; i < N; i++) if (i === 0 || notas[i].t0 - notas[i - 1].t1 >= .02) sueltas.add(i);
  const finales = new Set(); for (let i = 0; i < N; i++) if (i === N - 1 || notas[i + 1].t0 - notas[i].t1 >= .02) finales.add(i);
  // los finales que caen: cada uno a su azar (de la semilla y del momento de la nota, no del orden)
  const caen = new Set([...finales].filter(i => o.caidaProb >= 1 || azarDe(Math.round(o.semilla * 31 + 5), Math.round(notas[i].t0 * 1000)) < o.caidaProb));
  const suave = x => x <= 0 ? 0 : x >= 1 ? 1 : .5 - .5 * Math.cos(Math.PI * x);
  const notaEn = t => { let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (notas[m].t0 - tA[m] <= t) lo = m; else hi = m - 1; } return lo; };
  // temblor: una afinación que tiembla un poco, rápido (ruido filtrado, un valor cada 10 ms)
  const nT = Math.ceil((fin - inicio) / .01) + 2, tiembla = new Float32Array(nT);
  { let y = 0; const g = () => { let u = 0; for (let k = 0; k < 4; k++) u += rng.r(); return (u - 2) * 1.7; }; for (let k = 0; k < nT; k++) { y = .55 * y + .45 * g(); tiembla[k] = y; } }
  const temblor = t => { const x = (t - inicio) / .01, k = Math.max(0, Math.min(nT - 2, Math.floor(x))), f = x - k; return tiembla[k] * (1 - f) + tiembla[k + 1] * f; };
  let fase = 0, tPrev = inicio;
  // los adornos de las notas largas de las clarinadas y de los finales (adornos.js; con su propio azar)
  const adorno = adornar(notas, { cuanto: o.adornos, semilla: o.semilla });
  const altura = t => {
    if (t < tPrev - 1e-6) { fase = 0; tPrev = inicio; } // otra pasada desde el principio (banco.js): el mismo vibrato
    const i = notaEn(t), n = notas[i], sig = notas[i + 1];
    let m = n.midi;
    // la nota anterior todavía suena durante el ataque: el portamento va del ataque al comienzo de la vocal
    if (!sueltas.has(i) && i > 0 && t < n.t0 + .03) {
      const g0 = n.t0 - tA[i] - .02, x = (t - g0) / (n.t0 + .03 - g0);
      m = notas[i - 1].midi + (n.midi - notas[i - 1].midi) * suave(x);
    }
    // al ligar un salto, se pasa de la nota y vuelve (como mucho la mitad del salto)
    if (o.pasa && !sueltas.has(i) && i > 0) {
      const d = n.midi - notas[i - 1].midi;
      if (Math.abs(d) >= .8) {
        const llega = n.t0 + .03, medio = (n.t0 - tA[i] - .02 + llega) / 2;
        const h = t < medio ? 0 : t < llega ? suave((t - medio) / (llega - medio)) : 1 - suave((t - llega) / .1);
        m += Math.sign(d) * Math.min(o.pasa, Math.abs(d) * .5) * h;
      }
    }
    if (sueltas.has(i)) m -= o.pique * (1 - suave((t - (n.t0 - tA[i])) / Math.max(.06, tA[i] + o.piqueVa)));
    // la caída al final de la frase
    if (caen.has(i) && n.t1 - n.t0 > .4) m -= o.caida * suave((t - (n.t1 - o.caidaLargo)) / o.caidaLargo) ** 1.5;
    // vibrato: entra de a poco en las notas largas
    const enNota = t - n.t0;
    let vamp = suave((enNota - o.vibEntra) / .3) * (n.t1 - n.t0 > .3 ? 1 : 0);
    fase += 2 * Math.PI * o.vibVel * velVib * (1 + .05 * Math.sin(1.1 * t + fases[0])) * Math.max(0, t - tPrev); tPrev = t;
    const deriva = o.deriva * (.6 * Math.sin(2 * Math.PI * .7 * t + fases[0]) + .3 * Math.sin(2 * Math.PI * 1.9 * t + fases[1]) + .2 * Math.sin(2 * Math.PI * 3.3 * t + fases[2]));
    const ad = adorno[i];
    if (ad) { m += ad.altura(t); vamp *= ad.vibrato(t); }
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
  // 5. el volumen: cada nota con su fuerza, las largas crecen un poco. Las sílabas acentuadas entran con un golpe de
  // voz (golpe: dB de más al entrar, que se van en 60 ms, y la mitad que queda) y las otras un poco más suaves; cada
  // frase crece hasta su último acento (arco, en dB).
  const arcoDe = new Float32Array(N);
  if (o.arco) { let a = 0; for (let i = 0; i <= N; i++) if (i === N || sueltas.has(i)) { if (i > a) { let u = a; for (let j = a; j < i; j++) if (notas[j].sil.acento) u = j; for (let j = a; j < i; j++) arcoDe[j] = o.arco * Math.min(1, (j - a) / Math.max(1, u - a)); } a = i; } }
  const ganancia = t => {
    const i = notaEn(t), n = notas[i];
    const vel = n.vel ?? .8;
    let db = 20 * Math.log10(.4 + .75 * vel) + arcoDe[i];
    if (o.golpe) db += n.sil.acento ? o.golpe * (.5 + (t < n.t0 - .01 ? 0 : Math.exp(-(t - n.t0 + .01) / .06))) : -o.golpe * .25;
    const largo = n.t1 - n.t0;
    if (largo > .5) db += o.crece * suave((t - n.t0 - .1) / .4);
    if (finales.has(i)) db -= 12 * suave((t - (n.t1 - o.suelta)) / o.suelta);
    return Math.pow(10, db / 20);
  };
  // altura(t) en semitonos MIDI, con estado (la fase del vibrato): se pide con t creciente. La usa también banco.js.
  return { pho: lineas.join('\n') + '\n', inicio, fin, segs, ganancia, notas, altura };
}

// Después de MBROLA: el volumen de cada nota, las eses más suaves, un poco de aire (ruido que sigue a la voz) y la
// emisión murguera (más presencia en 2-4 kHz, menos barro en los graves, un poco de saturación). x: Float32Array a sr;
// g: el guion.
export function terminar(x, sr, g, opc = {}) {
  const curvaDeLaVoz = TIMBRES['CURVA_DIFONOS' + (opc.voz && opc.voz !== 'es2' ? '_' + opc.voz.toUpperCase() : '')] || TIMBRES.CURVA_DIFONOS || null;
  const o = { aire: 0, emision: 0, grito: 0, semilla: 1, curva: curvaDeLaVoz, brillo: 1, eses: 1, esesFiltro: 0, esesDb: 8, ruidos: 1, ...opc };
  // gritando, la voz se acerca al timbre entero del coro real (brillo 1): el grito sube el brillo hasta un 70 % de lo
  // que le falta
  const brillo = o.brillo + (1 - o.brillo) * Math.min(1, o.grito) * .7;
  if (o.curva && brillo !== 1) o.curva = o.curva.map(([f, db]) => [f, db * brillo]);
  if (o.color > 0 || o.inclinacion) {
    // el color propio de este cantor: unas ondas suaves en dB sobre la escala de frecuencias (de 400 Hz a 5 kHz), y su
    // brillo (inclinación, dB por octava arriba de 1 kHz)
    const rc = new Rnd((o.semilla || 1) * 61 + 9), ondas = [0, 1, 2].map(() => [rc.u(1.5, 4), rc.u(0, 6.28)]);
    const base = o.curva || [[100, 0], [10000, 0]], fs = base.map(p => p[0]);
    o.curva = fs.map((f, i) => {
      const x = Math.log2(f / 400); let d = 0; for (const [k, ph] of ondas) d += Math.sin(k * x + ph);
      const w = f < 300 ? 0 : f > 6000 ? .5 : 1;
      return [f, base[i][1] + (o.color || 0) * w * d / 1.7 + (o.inclinacion || 0) * Math.max(0, Math.log2(f / 1000))];
    });
  }
  // el volumen: la curva de cada nota cambia de golpe en el borde de las notas (justo antes de cada consonante), y un
  // salto de volumen es un click. Se suaviza en dB, para los dos lados (sin correrla), con 6 ms, y se interpola.
  const PASO = 32, nc = Math.ceil(x.length / PASO) + 2, cg = new Float32Array(nc);
  for (let j = 0; j < nc; j++) cg[j] = 20 * Math.log10(Math.max(1e-6, g.ganancia(g.inicio + j * PASO / sr)));
  { const al = 1 - Math.exp(-PASO / sr / .006); let v = cg[0]; for (let j = 0; j < nc; j++) { v += (cg[j] - v) * al; cg[j] = v; } v = cg[nc - 1]; for (let j = nc - 1; j >= 0; j--) { v += (cg[j] - v) * al; cg[j] = v; } }
  const pre = new Float32Array(x.length);
  for (let k = 0; k < x.length; k++) { const u = k / PASO, j = u | 0, f = u - j; pre[k] = x[k] * Math.pow(10, (cg[j] * (1 - f) + cg[j + 1] * f) / 20); }
  // después de un silencio algunas voces (es4) arrancan de golpe: 8 ms de entrada, y 8 ms de salida antes del silencio
  {
    const R = Math.round(.008 * sr), S = g.segs, cerca = (t, d) => Math.round((t - g.inicio) * sr) + d;
    for (let i = 0; i < S.length; i++) {
      if (S[i].p === '_') continue;
      if (i === 0 || S[i - 1].p === '_') { const a = cerca(S[i].t0, 0); for (let k = 0; k < R; k++) if (a + k >= 0 && a + k < pre.length) pre[a + k] *= .5 - .5 * Math.cos(Math.PI * k / R); }
      if (i === S.length - 1 || S[i + 1].p === '_') { const b = cerca(S[i].t1, 0); for (let k = 0; k < R; k++) if (b - 1 - k >= 0 && b - 1 - k < pre.length) pre[b - 1 - k] *= .5 - .5 * Math.cos(Math.PI * k / R); }
    }
    // y en los silencios, silencio (algunos difonos traen ruiditos en su mitad muda)
    const callar = (a, b) => { for (let k = Math.max(0, a); k < Math.min(pre.length, b); k++) pre[k] = 0; };
    callar(0, cerca(S[0].t0, 0));
    for (const q of S) if (q.p === '_') callar(cerca(q.t0, 0), cerca(q.t1, 0));
    callar(cerca(S[S.length - 1].t1, 0), pre.length);
  }
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
  // Las eses (y la sh) se sacan de la voz antes de la curva y se ponen después, filtradas aparte: la curva sube 20 dB
  // los agudos, y además repartiría su ruido 40 ms antes y después de cada s.
  const eses = o.eses, r = Math.round(.006 * sr), previo = Math.round(.02 * sr), n = pre.length;
  // Lo mismo con las consonantes sordas de golpe y de soplo (p t k ch f j): la curva de las vocales les subía la ráfaga
  // y el soplo, y sonaban como chasquidos antes de cada sílaba. Van aparte, más suaves arriba (ruidos: 0 a 1).
  const SORDAS = new Set(['p', 't', 'k', 'tS', 'f', 'x']);
  // (la ráfaga de p t k ch cae justo en el borde con la vocal: se toman también los 12 ms siguientes)
  const RAFAGA = new Set(['p', 't', 'k', 'tS']);
  const lasEses = g.segs.filter(s => (eses > 0 && (s.p === 's' || s.tipo === 'sh')) || (o.ruidos > 0 && SORDAS.has(s.p))).map(s => ({ s, a: Math.round((s.t0 - g.inicio) * sr), b: Math.round((s.t1 - g.inicio + (RAFAGA.has(s.p) ? .012 : 0)) * sr) }));
  const rampa = (k, a, b) => Math.min(1, (k - (a - r)) / r, (b + r - k) / r);
  let voz = pre;
  if (o.curva && lasEses.length) {
    voz = Float32Array.from(pre);
    for (const { a, b } of lasEses) for (let k = Math.max(0, a - r); k < Math.min(n, b + r); k++) { const m = rampa(k, a, b); if (m > 0) voz[k] *= 1 - m; }
  }
  if (o.grito > 0 && g.notas?.length) esforzar(voz === pre ? (voz = Float32Array.from(pre)) : voz, sr, g, o);
  // el timbre del coro real (curva medida en herramientas/curva_difonos.py): las vocales mucho más brillantes
  const y = o.curva ? ecualizar(voz, sr, o.curva) : Float32Array.from(voz);
  // La curva cambia el color, no el volumen de cada momento: es de tercios de octava y muy dentada, y en el agudo, con
  // pocos armónicos, cada nota cae en otro pozo o en otro pico (de Fa# 4 a La 4, 2 a 4 dB(A) menos que en Re 5). Se le
  // devuelve a cada momento el volumen que tenía antes de la curva (ponderación A, 25 ms), relativo al de toda la frase.
  if (o.curva) igualarVolumen(y, voz, sr);
  // Las eses: más bajas y filtradas, sin el silbido de arriba de 4 kHz. Las aspiradas, más todavía: un soplo. La sh: un
  // ruido un poco más fuerte que la s, en una banda de 2 a 4 kHz con el pico en 2,5 kHz (sin lo agudo de la s).
  for (const { s, a, b } of lasEses) {
    const asp = s.tipo === 'aspirada', sh = s.tipo === 'sh';
    const desde = Math.max(0, a - r - previo), hasta = Math.min(n, b + r);
    if (hasta - desde < 8) continue;
    const z = pre.slice(desde, hasta);
    let gan;
    if (SORDAS.has(s.p)) {
      // las sordas, como salen de la voz pero sin el chasquido: la ráfaga de t, k, p y ch y el soplo de f y j tienen
      // de 8 a 21 dB más agudos que las vocales (en tramos de 3 ms, de 4 a 10 kHz). Más suaves arriba de 3,5 kHz.
      filtrar(z, bq('agudos', 3500, .7, -10 * o.ruidos));
      gan = Math.pow(10, -(s.p === 'tS' ? 5 : s.p === 't' ? 4 : 2) * o.ruidos / 20);
    } else if (sh) {
      const rng = new Rnd((o.semilla || 1) * 29 + a), w = new Float32Array(z.length);
      for (let k = 0; k < z.length; k++) w[k] = rng.r() * 2 - 1;
      filtrar(w, bq('banda', 2500, 1, 0)); filtrar(w, bq('banda', 3000, .8, 0)); filtrar(w, bq('agudos', 4500, .7, -14));
      let pw = 0, pz = 0; for (let k = 0; k < z.length; k++) { pw += w[k] * w[k]; pz += z[k] * z[k]; }
      const esc = .35 * Math.sqrt(pz / (pw || 1));
      const voz = z.slice(); filtrar(voz, bq('agudos', 900, .7, -24));
      for (let k = 0; k < z.length; k++) z[k] = w[k] * esc + voz[k] * .35;
      gan = 1;
    } else {
      const fi = asp ? eses : (o.esesFiltro ?? eses);   // cuánto se filtra (aparte de cuánto se acorta: esesCortas)
      filtrar(z, bq('pico', 5000, 1.2, -6 * fi));
      filtrar(z, bq('agudos', asp ? 2500 : 4000, .7, -14 * fi));
      filtrar(z, bq('agudos', asp ? 2500 : 6000, .7, -10 * fi));
      gan = Math.pow(10, (-(asp ? 6 : 4) * fi - (asp ? 0 : o.esesDb || 0)) / 20);   // esesDb: más bajas, sin filtrarlas
    }
    for (let k = Math.max(desde, a - r); k < hasta; k++) {
      const m = rampa(k, a, b); if (m <= 0) continue;
      y[k] = (o.curva ? y[k] : y[k] * (1 - m)) + z[k - desde] * gan * m;
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

// una ganancia en dB por tramo de `paso` muestras, interpolada (en amplitud) entre tramos
function aplicarDb(y, db, paso) {
  const g = Float32Array.from(db, v => Math.pow(10, v / 20));
  for (let k = 0; k < y.length; k++) { const u = k / paso, j = u | 0, f = u - j; y[k] *= g[j] + (g[Math.min(g.length - 1, j + 1)] - g[j]) * f; }
}
// y tiene que sonar, momento a momento, como x (ponderación A, tramos de 32 muestras suavizados `tau` s de ida y vuelta),
// con el mismo volumen total que tenía y: se corrige sólo la forma, como mucho ±`max` dB, donde x suena.
function igualarVolumen(y, x, sr, tau = .025, max = 6) {
  const PASO = 32, xA = ponderarA(x, sr), yA = ponderarA(y, sr), nb = Math.ceil(y.length / PASO), ex = new Float64Array(nb), ey = new Float64Array(nb);
  for (let j = 0; j < nb; j++) { const k1 = Math.min(y.length, (j + 1) * PASO); for (let k = j * PASO; k < k1; k++) { ex[j] += xA[k] * xA[k]; ey[j] += yA[k] * yA[k]; } }
  let tx = 0, ty = 0; for (let j = 0; j < nb; j++) { tx += ex[j]; ty += ey[j]; }
  if (!(tx > 0 && ty > 0)) return;
  const al = 1 - Math.exp(-PASO / sr / tau);
  for (const e of [ex, ey]) { let v = e[0]; for (let j = 0; j < nb; j++) { v += (e[j] - v) * al; e[j] = v; } v = e[nb - 1]; for (let j = nb - 1; j >= 0; j--) { v += (e[j] - v) * al; e[j] = v; } }
  let mx = 0; for (const v of ex) mx = Math.max(mx, v);
  const k0 = ty / tx, gd = new Float32Array(nb + 1);
  for (let j = 0; j < nb; j++) gd[j] = ex[j] > mx * 1e-4 && ey[j] > 0 ? Math.max(-max, Math.min(max, 10 * Math.log10(ex[j] * k0 / ey[j]))) : 0;
  gd[nb] = gd[nb - 1];
  aplicarDb(y, gd, PASO);
}

// El grito: cantar con esfuerzo. Las voces de MBROLA son de habla, a un esfuerzo tranquilo; el coro de murga canta al
// máximo, al aire libre. Comparado con el coro real (La Trasnochada 2020, nivel de los armónicos por bandas, coro
// contra coro), el de difonos tenía los agudos que hacían falta (la curva de timbre ya los pone), pero le faltaban de
// 1,5 a 2 dB entre 0,8 y 1,8 kHz, le sobraban 2,5 dB de fundamental (H1−H2: 3,4 dB contra 0,9) y se cortaba entre
// sílabas (15 dB abajo un 9 % del tiempo, contra 3 %). Es lo que cambia cuando se canta fuerte (docs/solista.md):
//   - la boca se abre más y el primer formante sube (Schulman 1989; Traunmüller y Eriksson 2000): la vocal suena
//     abierta, gritada. Cada 10 ms se busca el primer formante (predicción lineal: el polo más grave entre 150 Hz y
//     1,2 kHz, por encima de la fundamental) y un filtro de segundo orden lo corre: ceros donde estaba, polos donde
//     va (más arriba y un poco más angosto, la resonancia más marcada). El resto del espectro no se toca. En el agudo
//     (desde `agudo` Hz de la altura que canta MBROLA) el formante se queda donde está;
//   - la glotis aprieta más: la fundamental baja frente a los demás armónicos (un pozo en la altura de la nota);
//   - la voz sigue entera por las consonantes sonoras (m n l b d g), que en el habla caen 15 o 20 dB.
// Cuánto, por nota: grito × (0,75 + 0,35 × fuerza) × (1 + 0,5 × cuánto pasa del centro de su cuerda, en quintas: de −1
// a +1,4): más en las notas fuertes y en las agudas (Sin Disfraz: la colocación cambia con el volumen y el registro).
// Con 1, el formante sube un 20 %, la fundamental baja 4 dB y las consonantes sonoras suben hasta 14 dB. Reemplaza a
// una saturación (más armónicos arriba, que ya estaban: sonaba raro y casi no se notaba). Las sordas y las eses no
// pasan por acá.
export const ESFUERZO = { formante: .2, angosto: .3, fundamental: 4, techo: 1200, agudo: 280, parejo: 14, hueco: 8, puerta: 35 };
export function esforzar(x, sr, g, o) {
  const N = g.notas, centro = o.centro ?? N.reduce((a, n) => a + n.midi, 0) / N.length, E = ESFUERZO;
  const PASO = 32, nc = Math.ceil(x.length / PASO) + 2, esf = new Float32Array(nc), f0 = new Float32Array(nc);
  for (const n of N) {
    const e = o.grito * (.75 + .35 * (n.vel ?? .8)) * (1 + .5 * Math.max(-1, Math.min(1.4, (n.midi - centro) / 7)));
    const a = Math.max(0, Math.floor(((n.t0 - .06) - g.inicio) * sr / PASO)), b = Math.min(nc, Math.ceil((n.t1 - g.inicio) * sr / PASO));
    const hz = 440 * Math.pow(2, (n.midi - 69) / 12);
    for (let j = a; j < b; j++) { esf[j] = Math.max(esf[j], e); f0[j] = hz; }
  }
  { const al = 1 - Math.exp(-PASO / sr / .04); let v = esf[0]; for (let j = 0; j < nc; j++) { v += (esf[j] - v) * al; esf[j] = v; } }
  // el formante y la fundamental cambian en las vocales (una m o una n son casi pura fundamental: con el pozo se
  // perdían)
  const voc = new Float32Array(nc);
  for (const q of g.segs) if (VOCAL(q.p)) { const a = Math.max(0, Math.round((q.t0 - g.inicio) * sr / PASO)), b = Math.min(nc, Math.round((q.t1 - g.inicio) * sr / PASO)); for (let j = a; j < b; j++) voc[j] = 1; }
  { const al = 1 - Math.exp(-PASO / sr / .015); let v = voc[0]; for (let j = 0; j < nc; j++) { v += (voc[j] - v) * al; voc[j] = v; } v = voc[nc - 1]; for (let j = nc - 1; j >= 0; j--) { v += (voc[j] - v) * al; voc[j] = v; } }
  for (let j = 1; j < nc; j++) if (!f0[j]) f0[j] = f0[j - 1];
  for (let j = nc - 2; j >= 0; j--) if (!f0[j]) f0[j] = f0[j + 1];
  const efz = k => { const u = k / PASO, j = Math.min(nc - 2, u | 0), f = u - j; return esf[j] * (1 - f) + esf[j + 1] * f; };
  const xA = ponderarA(x, sr);

  // 1. el primer formante, cada 10 ms (ventana de 25 ms, preénfasis, orden sr/1000 + 2, ventana de retardos de 60 Hz)
  const H = Math.round(.01 * sr), W = Math.round(.025 * sr), P = Math.round(sr / 1000) + 2, nf = Math.ceil(x.length / H) + 1;
  const ven = new Float32Array(W); for (let i = 0; i < W; i++) ven[i] = .5 - .5 * Math.cos(2 * Math.PI * (i + .5) / W);
  const lag = new Float32Array(P + 1); for (let k = 0; k <= P; k++) lag[k] = Math.exp(-.5 * (2 * Math.PI * 60 * k / sr) ** 2);
  const NG = 48, gw = new Float32Array(NG); for (let i = 0; i < NG; i++) gw[i] = 2 * Math.PI * 150 * Math.pow(E.techo / 150, i / (NG - 1)) / sr;
  const gc = new Float32Array(NG * (P + 1)), gs = new Float32Array(NG * (P + 1));
  for (let i = 0; i < NG; i++) for (let k = 0; k <= P; k++) { gc[i * (P + 1) + k] = Math.cos(gw[i] * k); gs[i * (P + 1) + k] = Math.sin(gw[i] * k); }
  const C = new Float32Array(nf * 4);   // por cuadro: b1 b2 a1 a2 (sin cambio: b = a = 0)
  const seg = new Float32Array(W), r = new Float64Array(P + 1), a = new Float64Array(P + 1), t = new Float64Array(P + 1);
  let umbral = 0; for (let k = 0; k < x.length; k++) umbral = Math.max(umbral, Math.abs(x[k])); umbral = (umbral * .01) ** 2 * W * .375;
  for (let j = 0; j < nf; j++) {
    const c = j * H, e = efz(Math.min(x.length - 1, c)) * voc[Math.min(nc - 1, Math.round(c / PASO))];
    if (e < .02) continue;
    let prev = 0;
    for (let i = 0; i < W; i++) { const k = c - (W >> 1) + i, v = k >= 0 && k < x.length ? x[k] : 0; seg[i] = (v - .9 * prev) * ven[i]; prev = v; }
    for (let k = 0; k <= P; k++) { let s = 0; for (let i = k; i < W; i++) s += seg[i] * seg[i - k]; r[k] = s * lag[k]; }
    if (r[0] < umbral) continue;
    r[0] *= 1.0001;
    // Levinson
    a.fill(0); a[0] = 1; let err = r[0];
    for (let m = 1; m <= P; m++) {
      let s = r[m]; for (let i = 1; i < m; i++) s += a[i] * r[m - i];
      const km = -s / err; t.set(a);
      for (let i = 1; i < m; i++) a[i] = t[i] + km * t[m - i];
      a[m] = km; err *= 1 - km * km; if (err <= 0) break;
    }
    // el pico de la envolvente más grave por encima de la fundamental (un mínimo de |A|)
    const hz0 = f0[Math.min(nc - 1, Math.round(c / PASO))], piso = Math.max(150, 1.15 * hz0) * 2 * Math.PI / sr;
    const m2 = new Float32Array(NG);
    for (let i = 0; i < NG; i++) { let re = 0, im = 0; for (let k = 0; k <= P; k++) { re += a[k] * gc[i * (P + 1) + k]; im -= a[k] * gs[i * (P + 1) + k]; } m2[i] = re * re + im * im; }
    let ib = -1; for (let i = 1; i < NG - 1; i++) if (gw[i] >= piso && m2[i] < m2[i - 1] && m2[i] <= m2[i + 1]) { ib = i; break; }
    if (ib < 0) continue;
    // y el polo, con Newton sobre z^P·A(z), desde ahí
    let zr = .96 * Math.cos(gw[ib]), zi = .96 * Math.sin(gw[ib]), ok = false;
    for (let it = 0; it < 12; it++) {
      let qr = 1, qi = 0, dr = 0, di = 0;
      for (let k = 1; k <= P; k++) { const ndr = dr * zr - di * zi + qr, ndi = dr * zi + di * zr + qi; dr = ndr; di = ndi; const nqr = qr * zr - qi * zi + a[k], nqi = qr * zi + qi * zr; qr = nqr; qi = nqi; }
      const den = dr * dr + di * di; if (den < 1e-20) break;
      const sr_ = (qr * dr + qi * di) / den, si = (qi * dr - qr * di) / den;
      zr -= sr_; zi -= si;
      if (sr_ * sr_ + si * si < 1e-14) { ok = true; break; }
    }
    const rad = Math.hypot(zr, zi), th = Math.atan2(zi, zr);
    if (!ok || rad < .7 || rad > .998 || th < piso * .95 || Math.abs(th - gw[ib]) > 2 * Math.PI * 250 / sr) continue;
    let th2 = Math.min(th * (1 + E.formante * e), Math.max(th, 2 * Math.PI * E.techo / sr)), rz = rad, ang = E.angosto;
    // En el agudo el formante se queda donde está. Los armónicos quedan tan separados que la predicción lineal no lo
    // ve: su polo cae justo sobre un armónico, y los ceros lo borraban (en un Do 5, 10 dB menos de segundo armónico,
    // con el polo nuevo entre dos armónicos, donde no había nada que subir), y al oído la voz se iba de lugar. Desde
    // `agudo` Hz (la altura que canta MBROLA) el corrimiento se apaga en 100 Hz, y el ancho de banda de los ceros no baja
    // de medio f0; ahí el grito es la voz apretada y pareja.
    const al = Math.max(0, Math.min(1, (hz0 - E.agudo) / 100)), su = al * al * (3 - 2 * al);
    if (su > 0) { th2 += su * (th - th2); ang *= 1 - su; rz = Math.min(rad, Math.exp(-Math.PI * su * .5 * hz0 / sr)); }
    const rad2 = Math.min(.996, Math.pow(rz, 1 - ang * Math.min(1.5, e)));
    C[j * 4] = -2 * rz * Math.cos(th); C[j * 4 + 1] = rz * rz; C[j * 4 + 2] = -2 * rad2 * Math.cos(th2); C[j * 4 + 3] = rad2 * rad2;
  }
  // 2. el filtro que corre el formante (coeficientes interpolados entre cuadros: un segundo orden estable sigue estable)
  //    y el pozo en la fundamental (pico negativo, Q 1,2, recalculado cada 32 muestras; o.pozoAgudo: cuánto queda del
  //    pozo en el agudo, desde `agudo` Hz, de 0 a 1)
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, p1 = 0, p2 = 0, q1 = 0, q2 = 0, pb0 = 1, pb1 = 0, pb2 = 0, pa1 = 0, pa2 = 0;
  for (let k = 0; k < x.length; k++) {
    if (k % PASO === 0) {
      const j = Math.min(nc - 1, k / PASO), e = esf[j], ua = Math.max(0, Math.min(1, (f0[j] - E.agudo) / 100)), db = -E.fundamental * e * voc[j] * (1 - ua * ua * (3 - 2 * ua) * (1 - (o.pozoAgudo ?? 1)));
      if (db > -.05) { pb0 = 1; pb1 = pb2 = pa1 = pa2 = 0; }
      else {
        const A = Math.pow(10, db / 40), w = 2 * Math.PI * Math.min(f0[j], sr * .45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * 1.2), a0 = 1 + al / A;
        pb0 = (1 + al * A) / a0; pb1 = -2 * cs / a0; pb2 = (1 - al * A) / a0; pa1 = -2 * cs / a0; pa2 = (1 - al / A) / a0;
      }
    }
    const u = k / H, j = u | 0, f = u - j, i0 = j * 4, i1 = Math.min(nf - 1, j + 1) * 4;
    let b1 = C[i0] * (1 - f) + C[i1] * f, b2 = C[i0 + 1] * (1 - f) + C[i1 + 1] * f, a1 = C[i0 + 2] * (1 - f) + C[i1 + 2] * f, a2 = C[i0 + 3] * (1 - f) + C[i1 + 3] * f;
    const v = x[k];
    const w1 = v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = w1;
    const w2 = pb0 * w1 + pb1 * p1 + pb2 * p2 - pa1 * q1 - pa2 * q2; p2 = p1; p1 = w1; q2 = q1; q1 = w2;
    y[k] = w2;
  }
  // el volumen, momento a momento: el pozo saca fundamental, más en las notas agudas, y si se repone el volumen del
  // cantor entero las agudas quedan de 2 a 4 dB(A) más bajas. Se compara lo que se oye (ponderación A) antes y después de
  // los filtros, en tramos de 32 muestras suavizados 25 ms de ida y vuelta, y se le devuelve a cada momento lo que perdió.
  {
    const yA = ponderarA(y, sr), nb = Math.ceil(y.length / PASO), ex = new Float64Array(nb), ey = new Float64Array(nb);
    for (let j = 0; j < nb; j++) { const k1 = Math.min(y.length, (j + 1) * PASO); for (let k = j * PASO; k < k1; k++) { ex[j] += xA[k] * xA[k]; ey[j] += yA[k] * yA[k]; } }
    const al = 1 - Math.exp(-PASO / sr / .025);
    for (const e of [ex, ey]) { let v = e[0]; for (let j = 0; j < nb; j++) { v += (e[j] - v) * al; e[j] = v; } v = e[nb - 1]; for (let j = nb - 1; j >= 0; j--) { v += (e[j] - v) * al; e[j] = v; } }
    let mx = 0; for (const v of ex) mx = Math.max(mx, v);
    const gd = new Float32Array(nb + 1);
    for (let j = 0; j < nb; j++) gd[j] = ex[j] > mx * 1e-5 && ey[j] > 0 ? Math.max(-6, Math.min(8, 10 * Math.log10(ex[j] / ey[j]))) : 0;
    gd[nb] = gd[nb - 1];
    aplicarDb(y, gd, PASO);
  }
  // 3. parejo: las consonantes sonoras (m n l b d g r) con la voz entera, no 15 o 20 dB abajo de la vocal como en el
  //    habla (eran el 60 a 90 % de los cortes del coro). Lo que queda más de `hueco` dB abajo de la vocal de al lado
  //    (el máximo en ±150 ms) sube hasta parejo × esfuerzo dB; lo que está más de `puerta` dB abajo (silencio, el
  //    cierre de una p) no se toca. Suavizado de ida y vuelta (8 ms), sin correrlo.
  if (E.parejo > 0) {
    const nb = Math.ceil(y.length / PASO), L = new Float32Array(nb), G = new Float32Array(nb + 1);
    for (let j = 0; j < nb; j++) { let s = 0; const k1 = Math.min(y.length, (j + 1) * PASO); for (let k = j * PASO; k < k1; k++) s += y[k] * y[k]; L[j] = 10 * Math.log10(s / PASO + 1e-14); }
    const V = Math.round(.15 * sr / PASO);
    for (let j = 0; j < nb; j++) {
      let ref = -280; for (let i = Math.max(0, j - V); i <= Math.min(nb - 1, j + V); i++) if (L[i] > ref) ref = L[i];
      const d = ref - L[j], e = esf[Math.min(nc - 1, j)];
      G[j] = d > E.puerta ? 0 : Math.min(E.parejo * e, Math.max(0, d - E.hueco));
    }
    G[nb] = G[nb - 1];
    { const al = 1 - Math.exp(-PASO / sr / .008); let v = G[0]; for (let j = 0; j <= nb; j++) { v += (G[j] - v) * al; G[j] = v; } v = G[nb]; for (let j = nb; j >= 0; j--) { v += (G[j] - v) * al; G[j] = v; } }
    aplicarDb(y, G, PASO);
  }
  // el mismo volumen que antes, como lo oye el oído (la mezcla ya tiene sus niveles)
  const yA = ponderarA(y, sr); let e0 = 0, e1 = 0; for (let k = 0; k < y.length; k++) { e0 += xA[k] * xA[k]; e1 += yA[k] * yA[k]; }
  const kg = e1 > 0 ? Math.sqrt(e0 / e1) : 1;
  for (let k = 0; k < x.length; k++) x[k] = y[k] * kg;
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
// (La tercia canta muy agudo: con el tracto del primo suena menos finita.)
// centro: desde dónde empieza a gritar más (el medio de lo cómodo para la cuerda; esforzar(), en midi)
export const CUERDAS_DIFONOS = { bajos: { tracto: .9, centro: 52 }, segundos: { tracto: .95, centro: 55 }, primos: { tracto: 1, centro: 60 }, sobreprimos: { tracto: 1.03, centro: 64 }, tercia: { tracto: 1, centro: 64 } };
// Todos salen de dos voces grabadas: para que no suenen iguales, cada cantor de una cuerda tiene otra garganta (el que
// la lleva en el medio, los demás más grandes o más chicos: TRACTO), su propio color (timbre: dB de más o de menos en
// unas pocas zonas del espectro) y más o menos brillo (inclinación: dB por octava arriba de 1 kHz). Siempre lo mismo
// para la misma semilla.
export const DIFERENCIA = { garganta: .02, timbre: 5, inclinacion: 2, reparto: 1 };
export const TRACTO = [0, .07, -.06, .11, -.1];
// Y no todos con la misma voz: en cada cuerda, el que la lleva canta con es2 (y el solista), el segundo con es1 y el
// tercero con es4 (otros dos hombres, grabados a 16 kHz); el cuarto primo, otra vez con es1.
export const VOCES = ['es2', 'es1', 'es4', 'es1', 'es2'];
export const vozDelCantor = c => VOCES[c % VOCES.length];
// V: la variación entre cantores (VARIACION con la de difonos encima); E: sus mañas (ESTILO, o ESTILO_BANCO encima).
export function cantorDifonos(cuerda, semilla, { c = 0, V = { ...VARIACION, ...VARIACION_DIFONOS }, D = DIFERENCIA, E = ESTILO } = {}) {
  const r = new Rnd(semilla * 17 + 3), T = CUERDAS_DIFONOS[cuerda] || CUERDAS_DIFONOS.primos;
  return {
    semilla, tracto: T.tracto * (1 + (D.reparto ?? 1) * TRACTO[c % TRACTO.length]) * r.u(1 - D.garganta, 1 + D.garganta), color: D.timbre, inclinacion: r.u(-D.inclinacion, D.inclinacion),
    transporte: r.u(-V.desafinacion, V.desafinacion),
    vibrato: r.u(V.vibrato[0], V.vibrato[1]), vibVel: r.u(V.vibratoVel[0], V.vibratoVel[1]), vibEntra: r.u(V.vibratoEntra[0], V.vibratoEntra[1]),
    pique: E.pique * r.u(1 - V.pique, 1 + V.pique), consonantes: E.consonantes * r.u(1 - V.diccion * .5, 1 + V.diccion * .5),
    // los tiempos, la mitad que en el coro de formantes: con todo, el coro de difonos se entiende mucho menos (19 % de
    // letras mal contra 13 %, herramientas/coro_difonos.mjs)
    retraso: r.u(0, V.retraso * .5), desfase: V.desfase * .5,
    // el timbre del coro real, al 60 %: con la curva entera el coro se entiende un poco menos (15,6 % contra 12,4 %)
    temblor: .04, brillo: .6,
    // los acentos con golpe de voz: el ataque se acerca al del coro real (de 31 a 18 ms de diferencia en el banco; con
    // 4, el ataque de sílaba del solista baja de 55 a 45 ms, el real es de 35)
    golpe: E.golpe, arco: 1,
    // cuánto adorna las notas largas de las clarinadas y de los finales (adornos.js; algunos nada)
    adornos: cuantoAdorna(cuerda, semilla, c),
    // cuánto grita (esforzar(): la boca más abierta, la voz apretada y pareja, más brillo); cada uno un poco distinto
    grito: +(.6 * new Rnd(semilla * 43 + 19).u(.8, 1.2)).toFixed(2), centro: T.centro,
    // las mañas de los solistas de verdad (ESTILO, variacion.js); la caída, cada uno la suya (con el mismo azar, después
    // de todo lo anterior: lo de arriba no cambia)
    pasa: E.pasa, piqueVa: E.piqueVa, deriva: E.deriva, crece: E.crece, caidaProb: E.caidaProb, caidaLargo: E.caidaLargo,
    caida: +(E.caida * r.u(.5, 1.5)).toFixed(2),
  };
}

// Los tiempos de cada cantor: entra siempre un poco tarde (retraso) y cada nota se corre un poco (desfase), sin
// romper el ligado: si dos notas iban pegadas, siguen pegadas. El desfase de cada nota sale de su semilla y de su
// momento (no de cuántas notas vinieron antes): si un verso nuevo parte una nota, las frases que siguen quedan iguales
// y la memoria de frases las encuentra.
const azarDe = (a, b) => { let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
export function correr(notas, opc) {
  const ret = opc.retraso || 0, des = opc.desfase || 0;
  if (!ret && !des) return notas;
  const sem = Math.round((opc.semilla || 1) * 53 + 11);
  const t0 = notas.map(n => n.t0 + ret + (des ? -des + 2 * des * azarDe(sem, Math.round(n.t0 * 400)) : 0));
  return notas.map((n, i) => {
    const sig = notas[i + 1], pegada = sig && sig.t0 - n.t1 < .02;
    const a = Math.max(t0[i], i ? t0[i - 1] + .03 : -1e9);
    return { ...n, t0: a, t1: pegada ? Math.max(a + .03, t0[i + 1]) : Math.max(a + .03, n.t1 + (a - n.t0)) };
  });
}

// La memoria de frases (opc.memo): lo que ya se cantó, por la voz, las opciones y las notas de cada frase, en 16 bits.
// En la página cada cantante canta siempre en el mismo obrero, así que al cambiar un cantante o un verso sólo se canta
// lo que cambió. Hasta MEMO_MAX muestras (unos 130 MB por obrero: los trece cantantes de una pieza de cuatro minutos,
// si hay un solo obrero); las que hace más que no se usan salen primero.
const MEMO = new Map(); let memoN = 0; const MEMO_MAX = 64e6;

// Un cantor entero: guion → MBROLA (y en las frases agudas, el color corregido: agudo.js) → volumen, eses, aire y
// emisión. mb: lo que devuelve crearMbrola. opc.agudo = false (o 0): sin corregir el agudo.
// Devuelve { x, sr, inicio }: las muestras a la frecuencia `sr`, empezando en el segundo `inicio` de la pieza.
// El largo del tracto (opc.tracto) se hace como con una cinta: MBROLA canta más agudo y más largo, y las muestras se
// tocan más rápido (sr más alta); la altura y los tiempos vuelven a su lugar y los formantes suben `tracto` veces.
// (La página las pasa a su frecuencia con Web Audio; en Node, con remuestrear.)
export function cantarDifonos(mb, notas, opc = {}) {
  const F = mb.frecuencia, a = Math.round(F * (opc.tracto || 1)) / F;
  if (!notas.length) return { x: new Float32Array(0), sr: F * a, inicio: 0 };
  notas = correr(notas, opc);
  const ns = a === 1 ? notas : notas.map(n => ({ ...n, t0: n.t0 * a, t1: n.t1 * a, midi: n.midi - 12 * Math.log2(a) }));
  const o = a === 1 ? opc : { ...opc, consonantes: (opc.consonantes ?? 1) * a, vibVel: (opc.vibVel ?? 5.5) / a, vibEntra: (opc.vibEntra ?? .22) * a, ...(opc.centro != null ? { centro: opc.centro - 12 * Math.log2(a) } : {}) };
  // De a frases, cortadas en cada respiración de más de 0,6 s: MBROLA no aguanta silencios de minutos (se pasa de rango),
  // así tampoco canta el silencio, y con frases cortas la memoria sirve más (cambia un verso: se canta esa frase). Cada
  // frase lleva 0,25 s de silencio antes y 0,3 s después, y con 0,6 s no se pisan.
  const frases = [[]];
  ns.forEach((n, i) => { if (i && n.t0 - ns[i - 1].t1 > .6 * a) frases.push([]); frases[frases.length - 1].push(n); });
  const partes = frases.map((f, k) => {
    // si esta frase ya se cantó igual (la página cambió otro cantante, u otro verso), sale de la memoria
    const clave = o.memo ? (o.voz || '') + '|' + F + '|' + k + '|' + JSON.stringify(o) + '|' + JSON.stringify(f) : null;
    if (clave && MEMO.has(clave)) { const m = MEMO.get(clave); MEMO.delete(clave); MEMO.set(clave, m); return { x: Float32Array.from(m.x, v => v / 32767), inicio: m.inicio }; }
    const g = guion(f, { ...o, semilla: (o.semilla || 1) * 7 + k });
    const crudo = mb.cantar(g.pho); let x = new Float32Array(crudo.length);
    for (let j = 0; j < x.length; j++) x[j] = crudo[j] / 32768;
    // en el agudo MBROLA le cambia el color a la vocal: se corrige con la misma frase cantada grave (agudo.js)
    if ((o.agudo ?? true) && hayAgudo(g.pho)) {
      const gr = mb.cantar(phoGrave(g.pho, AGUDO.ref)), ref = new Float32Array(gr.length);
      for (let j = 0; j < ref.length; j++) ref[j] = gr[j] / 32768;
      x = corregirAgudo(x, ref, F, g);
    }
    const y = terminar(x, F, g, o);
    if (clave) {
      MEMO.set(clave, { x: Int16Array.from(y, v => Math.round(Math.max(-1, Math.min(1, v)) * 32767)), inicio: g.inicio }); memoN += y.length;
      for (const [c, m] of MEMO) { if (memoN <= MEMO_MAX) break; MEMO.delete(c); memoN -= m.x.length; }
    }
    return { x: y, inicio: g.inicio };
  });
  const t0 = partes[0].inicio, fin = Math.max(...partes.map(p => p.inicio + p.x.length / F));
  const x = new Float32Array(Math.ceil((fin - t0) * F) + 1);
  for (const p of partes) x.set(p.x, Math.round((p.inicio - t0) * F));
  return { x, sr: F * a, inicio: t0 / a };
}
