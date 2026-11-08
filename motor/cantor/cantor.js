// cantor.js — un cantor sintético: fuente glótica + tracto vocal de formantes (tipo Klatt), en castellano.
// No usa muestras. Calcula las muestras en JS (igual en Node, en un Worker o en la página) y la página las
// toca con Web Audio. Cada cantor tiene su voz: largo de tracto, vibrato, desafinación, aire y retraso.

// ── Fonemas: formantes (Hz, voz masculina), sonoridad, fricción, nasalidad, duración (s) ──
// AV: voz; AF: fricción; AH: aire; N: nasalidad; fc/fb: centro y ancho de la fricción
const V = (F1, F2, F3) => ({ F: [F1, F2, F3], AV: 1, AF: 0, AH: 0, N: 0 });
import { VARIACION } from './variacion.js';

export const FONEMAS = {
  a: V(720, 1290, 2500), e: V(470, 1850, 2550), i: V(300, 2250, 2980), o: V(480, 880, 2450), u: V(330, 760, 2350),
  j: { ...V(290, 2250, 3000), AV: .85, dur: .05 }, w: { ...V(320, 700, 2300), AV: .85, dur: .05 },
  l: { F: [360, 1150, 2700], AV: .96, dur: .05 },
  r: { F: [430, 1450, 2550], AV: .88, dur: .024, tap: 1 },
  R: { F: [430, 1450, 2550], AV: .88, dur: .07, tap: 3 },
  m: { F: [260, 1050, 2300], AV: .94, N: .7, nz: 1000, dur: .06 },
  n: { F: [260, 1500, 2550], AV: .94, N: .7, nz: 1400, dur: .055 },
  N: { F: [260, 2000, 2800], AV: .94, N: .7, nz: 1700, dur: .065 },
  B: { F: [330, 850, 2300], AV: .95, dur: .035 }, D: { F: [380, 1550, 2600], AV: .95, dur: .03 }, G: { F: [340, 1250, 2300], AV: .95, dur: .035 },
  b: { F: [300, 800, 2200], AV: .3, dur: .045, cierre: 1, fc: 900, fb: 1500, rafaga: .35 },
  d: { F: [320, 1600, 2600], AV: .3, dur: .04, cierre: 1, fc: 3500, fb: 2500, rafaga: .4 },
  g: { F: [320, 1300, 2300], AV: .3, dur: .045, cierre: 1, fc: 1900, fb: 1500, rafaga: .4 },
  p: { F: [300, 800, 2200], AV: .35, dur: .016, cierre: 1, fc: 1000, fb: 2500, rafaga: .7 },
  t: { F: [320, 1650, 2650], AV: .35, dur: .015, cierre: 1, fc: 4200, fb: 3000, rafaga: .8 },
  k: { F: [320, 1350, 2350], AV: .35, dur: .018, cierre: 1, fc: 2200, fb: 1600, rafaga: .9 },
  C: { F: [300, 1900, 2700], AV: 0, dur: .05, cierre: 1, fc: 3000, fb: 2200, rafaga: .7, luego: 'S' },
  f: { F: [350, 1100, 2400], AV: .2, AF: .32, fc: 7000, fb: 5000, dur: .085 },
  s: { F: [350, 1600, 2600], AV: .15, AF: 1.8, fc: 6200, fb: 2600, dur: .075 },
  h: { F: null, AV: 0, AF: 0, AH: .45, dur: .05 },                     // s aspirada: aire con la vocal de antes
  x: { F: [350, 1300, 2400], AV: .3, AF: .3, AH: .3, fc: 1800, fb: 1400, dur: .08 },
  S: { F: [300, 1900, 2600], AV: 0, AF: .55, fc: 3300, fb: 2200, dur: .085 },
  Z: { F: [300, 1900, 2600], AV: .6, AF: .3, fc: 3300, fb: 2200, dur: .075 },
};
const ES_VOCAL = p => 'aeiou'.includes(p);

// ── Voces ──
export const TIPOS = {
  bajo: { escala: .93, oq: .62, aire: .2, inclin: .3 },
  baritono: { escala: .97, oq: .58, aire: .2, inclin: .2 },
  tenor: { escala: 1.0, oq: .52, aire: .18, inclin: .1 },
  tenorAlto: { escala: 1.035, oq: .5, aire: .18, inclin: .08 },
};

class Rnd { constructor(s) { this.a = (s * 2654435761 + 7) >>> 0; } r() { let t = this.a += 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } u(a, b) { return a + (b - a) * this.r(); } }

// ── Plan: de notas con sílabas a segmentos de fonemas en el tiempo ──
// nota: {t0, t1, midi, vel (0..1), sil: {ataque:[], nucleo:[], coda:[]}}
function planificar(notas, rng, diccion = 1) {
  const seg = [];       // {t0, t1, p (fonema), nota (índice), f0 (midi)}
  for (let i = 0; i < notas.length; i++) {
    const n = notas[i], prev = notas[i - 1];
    const sil = n.sil || { ataque: [], nucleo: ['a'], coda: [] };
    const largo = n.t1 - n.t0;
    // el ataque se canta antes del tiempo, para que la vocal caiga en el golpe
    const durA = sil.ataque.map(p => (FONEMAS[p]?.dur || .05) * (largo < .18 ? .75 : 1) * diccion);
    let tA = durA.reduce((a, b) => a + b, 0);
    const libre = prev ? Math.max(0, n.t0 - (prev.t0 + Math.min(.08, (prev.t1 - prev.t0) * .5))) : .2;
    const esc = tA > 0 ? Math.min(1, libre / tA, .14 / tA) : 1;
    let t = n.t0 - tA * esc;
    // si la nota anterior todavía suena, se le recorta el final
    if (prev && seg.length) { for (let k = seg.length - 1; k >= 0 && seg[k].t1 > t; k--) { seg[k].t1 = Math.max(seg[k].t0 + .01, t); } }
    sil.ataque.forEach((p, k) => { const d = durA[k] * esc; seg.push({ t0: t, t1: t + d, p, nota: i }); t += d; });
    t = n.t0;
    // coda al final de la nota
    const durC = sil.coda.map(p => Math.min(p === 's' ? .045 : (FONEMAS[p]?.dur || .05), largo * .25));
    const tC = durC.reduce((a, b) => a + b, 0);
    const fv = n.t1 - tC;
    // núcleo: semivocales cortas en los bordes, la vocal en el medio
    const nuc = sil.nucleo.length ? sil.nucleo : ['a'];
    const iv = nuc.findIndex(ES_VOCAL);
    const antes = nuc.slice(0, Math.max(0, iv)), vocales = nuc.slice(Math.max(0, iv)).filter(ES_VOCAL), despues = nuc.slice(Math.max(0, iv)).filter(p => !ES_VOCAL(p));
    const dG = Math.min(.05, (fv - t) * .2);
    for (const p of antes) { seg.push({ t0: t, t1: t + dG, p, nota: i }); t += dG; }
    const finV = fv - despues.length * Math.min(.07, (fv - t) * .3);
    const cadaV = (finV - t) / Math.max(1, vocales.length);
    for (const p of vocales) { seg.push({ t0: t, t1: t + cadaV, p, nota: i }); t += cadaV; }
    for (const p of despues) { const d = (fv - t) / Math.max(1, despues.length); seg.push({ t0: t, t1: t + d, p, nota: i }); t += d; }
    sil.coda.forEach((p, k) => { seg.push({ t0: t, t1: t + durC[k], p, nota: i, coda: true }); t += durC[k]; });
  }
  return seg;
}

// ── Síntesis ──
export function cantar(notas, opc = {}) {
  const sr = opc.sr || 32000;
  const tipo = TIPOS[opc.tipo || 'tenor'];
  const rng = new Rnd(opc.semilla || 1);
  const V = { ...VARIACION, ...(opc.variacion || {}) };                                // cuánto varía cada cantor (variacion.js)
  const escala = tipo.escala * rng.u(1 - V.garganta, 1 + V.garganta) * (opc.escalaFormantes || 1);
  const vibF = rng.u(V.vibratoVel[0], V.vibratoVel[1]), vibA = rng.u(V.vibrato[0], V.vibrato[1]) * (opc.vibrato ?? 1);   // semitonos: el coro de murga casi no vibra
  const desaf = rng.u(-V.desafinacion, V.desafinacion) + (opc.desafinacion || 0);      // semitonos
  const retraso = rng.u(0, V.retraso) + (opc.retraso || 0);
  const oq = tipo.oq * rng.u(1 - V.pulso, 1 + V.pulso), aire = tipo.aire * rng.u(V.aire[0], V.aire[1]);
  // cada cantor dice cada vocal un poco a su manera (con otro azar, para no correr el del resto)
  const rv = new Rnd((opc.semilla || 1) * 31 + 5), propias = {};
  for (const v of 'aeiou') propias[v] = [1 + rv.u(-V.vocales, V.vocales), 1 + rv.u(-V.vocales, V.vocales)];
  // sus mañas: cuánto anticipa las consonantes, cuándo le entra el vibrato, cuánto pica desde abajo al entrar
  const diccion = 1 + rv.u(-V.diccion, V.diccion), vibEntra = rv.u(V.vibratoEntra[0], V.vibratoEntra[1]), pique = 1 + rv.u(-V.pique, V.pique);
  const rn = new Rnd((opc.semilla || 1) * 53 + 11);                                   // y cada nota, un poco más alta o más baja
  const nasalBase = opc.nasal ?? .18;                                                 // emisión murguera
  const ns = notas.map(n => { const j = rng.u(-V.desfase, V.desfase); return { ...n, t0: n.t0 + retraso + j, t1: n.t1 + retraso + j, dn: rn.u(-V.desafinaNota, V.desafinaNota) }; });
  const seg = planificar(ns, rng, diccion);
  if (!seg.length) return opc.separar ? { voz: new Float32Array(0), ruido: new Float32Array(0) } : new Float32Array(0);
  const T = Math.max(...ns.map(n => n.t1)) + .4;
  const len = Math.ceil(T * sr), out = new Float32Array(len), outR = opc.separar ? new Float32Array(len) : out;
  const CR = 32, nC = Math.ceil(len / CR);
  // pistas de control (una por cuadro de CR muestras)
  const cAV = new Float32Array(nC), cAF = new Float32Array(nC), cAH = new Float32Array(nC), cN = new Float32Array(nC), cNZ = new Float32Array(nC).fill(270);
  const cF = [0, 1, 2].map(() => new Float32Array(nC)), cFC = new Float32Array(nC).fill(4000), cFB = new Float32Array(nC).fill(2000), cF0 = new Float32Array(nC);
  const cRaf = new Float32Array(nC), cCierre = new Float32Array(nC);
  // objetivos por segmento, con la vocal vecina para los fonemas sin formantes propios
  let k = 0;
  const vocalCerca = (i) => { for (let d = 1; d < 6; d++) { for (const j of [i - d, i + d]) { const s = seg[j]; if (s && ES_VOCAL(s.p)) return FONEMAS[s.p].F; } } return FONEMAS.a.F; };
  let fObj = [...FONEMAS.a.F];
  for (let c = 0; c < nC; c++) {
    const t = c * CR / sr;
    while (k < seg.length - 1 && seg[k].t1 <= t) k++;
    const s = seg[k];
    const n = ns[s.nota];
    let av = 0, af = 0, ah = 0, nas = 0, nz = 270, fc = 4000, fb = 2000, raf = 0, cierre = 0;
    if (t >= s.t0 && t < s.t1) {
      const F = FONEMAS[s.p] || FONEMAS.a;
      av = F.AV ?? 1; af = (F.AF || 0) * (s.coda && s.p === 's' ? .2 : 1); ah = F.AH || 0; nas = F.N || 0; nz = F.nz || 270; fc = F.fc || 4000; fb = F.fb || 2000;
      fObj = F.F ? [...F.F] : vocalCerca(k);
      if (V.vocales && propias[s.p]) { fObj[0] *= propias[s.p][0]; fObj[1] *= propias[s.p][1]; }
      const x = (t - s.t0) / Math.max(1e-3, s.t1 - s.t0);
      if (F.tap) { const ph = (x * F.tap) % 1; av *= ph > .3 && ph < .7 ? .25 : 1; }
      if (F.cierre) {
        // cierre y ráfaga: la ráfaga en el último 18 %; ch sigue con fricción de sh
        cierre = x > .82 ? 0 : 1;
        if (x > .82) { raf = F.rafaga; af = .3; av = av > 0 ? Math.max(av, .25) : 0; }
        if (F.luego && x > .55) { af = FONEMAS[F.luego].AF; fc = FONEMAS[F.luego].fc; fb = FONEMAS[F.luego].fb; }
      }
      if (ES_VOCAL(s.p) || s.p === 'j' || s.p === 'w') nas = Math.max(nas, nasalBase);
      // la última vocal antes de un silencio se apaga
      const sig = seg[k + 1];
      if ((!sig || sig.t0 - s.t1 > .02) && s.t1 - t < .06) av *= Math.max(0, (s.t1 - t) / .06);
      const vel = n.vel ?? .8;
      av *= vel; af *= Math.sqrt(vel); ah *= vel;
    }
    cAV[c] = av; cAF[c] = af; cAH[c] = ah; cN[c] = nas; cNZ[c] = nz; cFC[c] = fc; cFB[c] = fb; cRaf[c] = raf; cCierre[c] = cierre;
    for (let j = 0; j < 3; j++) cF[j][c] = fObj[j];
    // f0: la nota que corresponde (las consonantes del ataque ya van en la altura nueva)
    cF0[c] = (n.midi + desaf + n.dn);
  }
  // suavizado (coarticulación): formantes 18 ms, amplitudes 5 ms, f0 28 ms (portamento)
  const suavizar = (a, tau) => { const g = 1 - Math.exp(-CR / sr / tau); let y = a[0]; for (let i = 0; i < a.length; i++) { y += (a[i] - y) * g; a[i] = y; } };
  cF.forEach(a => suavizar(a, .018)); suavizar(cAV, .006); suavizar(cAF, .004); suavizar(cAH, .006); suavizar(cN, .015); suavizar(cNZ, .015); suavizar(cFC, .01); suavizar(cCierre, .004);
  // f0 con portamento y "pique" desde abajo al empezar después de un silencio
  const f0s = new Float32Array(nC);
  {
    const g = 1 - Math.exp(-CR / sr / .028); let y = cF0[0] - .5;
    let tNota = -1, notaAnt = -1, fase = rng.u(0, 6.28), deriva = 0, vprof = 1;
    for (let c = 0; c < nC; c++) {
      const t = c * CR / sr;
      if (cF0[c] !== cF0[c - 1]) { tNota = t; if (cAV[c] < .05) y = cF0[c] - rng.u(.3, .6) * pique; }
      y += (cF0[c] - y) * g;
      // vibrato: entra a los 0,25 s de la nota, de a poco
      const enNota = t - tNota, vamp = Math.max(0, Math.min(1, (enNota - vibEntra) / .3));
      fase += 2 * Math.PI * vibF * (1 + .06 * Math.sin(t * 1.3 + vibF)) * CR / sr;
      deriva += (rng.r() - .5) * .004 - deriva * .002; vprof += (rng.r() - .5) * .02 - (vprof - 1) * .01;
      f0s[c] = y + vibA * vprof * vamp * Math.sin(fase) + deriva;
      notaAnt = cF0[c];
    }
  }
  // ── el bucle de muestras ──
  const pi2 = 2 * Math.PI / sr;
  const res = () => ({ a: 0, b: 0, c: 0, y1: 0, y2: 0 });
  const setRes = (r, F, BW) => { const C = -Math.exp(-pi2 * BW), B = 2 * Math.exp(-pi2 * BW / 2) * Math.cos(pi2 * F); r.c = C; r.b = B; r.a = 1 - B - C; };
  const R = [res(), res(), res(), res(), res()], NP = res(), NZ = res();
  // rama paralela de agudos (3-10 kHz): los formantes altos que un tracto en cascada de cinco polos no tiene
  const HA = res(), HB = res(); let hpx = 0, hpy = 0;
  const kHP = Math.exp(-2 * Math.PI * 2800 / sr), agudos = opc.agudos ?? .12;
  // fricción: dos pasabanda en serie (ganancia 1 en el centro), sin graves
  const bp = () => ({ b0: 0, a1: 0, a2: 0, x1: 0, x2: 0, y1: 0, y2: 0 });
  const setBP = (f, F, BWf) => { const w = pi2 * F, al = Math.sin(w) * Math.sinh(Math.log(2) / 2 * (BWf / F) * w / Math.sin(w)), a0 = 1 + al; f.b0 = al / a0; f.a1 = -2 * Math.cos(w) / a0; f.a2 = (1 - al) / a0; };
  const BP1 = bp(), BP2 = bp();
  const pasa = (f, x) => { const y = f.b0 * x - f.b0 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2; f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y; return y; };
  const PR = res(); setRes(PR, 2900 * escala, 900);   // formante del cantor: el brillo de la emisión murguera
  const brillo = opc.brillo ?? .55;
  let z1 = 0, z2 = 0;      // antirresonador
  let ph = 0, ruido = 1 + Math.floor(rng.r() * 2147483000), tilt = 0, desvio = 0, per = 1, grave = 0, frLP = 0;
  const BW = [75, 95, 120, 170, 280];
  for (let c = 0; c < nC; c++) {
    const av = cAV[c], af = cAF[c] + cRaf[c] * .9, ah = cAH[c] + aire * av, nas = cN[c];
    const s0 = c * CR, s1 = Math.min(len, s0 + CR);
    if (av < 1e-4 && af < 1e-4 && ah < 1e-4) { R.forEach(r => { r.y1 *= .5; r.y2 *= .5; }); continue; }
    const f0 = 440 * Math.pow(2, (f0s[c] - 69) / 12);
    // F1 sigue a la fundamental en lo agudo (los cantores abren la vocal)
    let F1 = cF[0][c] * escala, F2 = cF[1][c] * escala, F3 = cF[2][c] * escala;
    if (F1 < f0 * 1.08) F1 = f0 * 1.08;
    // en lo agudo los armónicos quedan lejos: formantes más anchos, para que el vibrato no los prenda y apague
    setRes(R[0], F1, Math.max(BW[0], .3 * f0) + nas * 60); setRes(R[1], F2, Math.max(BW[1], .3 * f0)); setRes(R[2], F3, Math.max(BW[2], .3 * f0));
    setRes(R[3], 3300 * escala, 260); setRes(R[4], 4400 * escala, 380);
    setRes(HA, 5200 * escala, 2200); setRes(HB, Math.min(7800 * escala, sr * .4), 3000);
    setRes(NP, 270, 100);
    const fz = 270 + (cNZ[c] - 270) * nas;
    // antirresonador: inversa del resonador en fz
    const Cz = -Math.exp(-pi2 * 110), Bz = 2 * Math.exp(-pi2 * 55) * Math.cos(pi2 * fz), Az = 1 - Bz - Cz;
    { const fc = Math.min(cFC[c], sr * .42); setBP(BP1, fc, Math.min(cFB[c], fc * 1.6)); setBP(BP2, fc, Math.min(cFB[c] * 1.4, fc * 1.8)); }
    const cie = cCierre[c];
    const dt = f0 / sr;
    const te = oq, tp = oq * .76, tn = oq * .24, A = Math.PI / (2 * tn);
    for (let s = s0; s < s1; s++) {
      // fuente glótica (derivada del flujo de Rosenberg) con polyBLEP en el cierre
      ph += dt * per;
      if (ph >= 1) { ph -= 1; per = 1 + (rng.r() - .5) * .012; desvio = (rng.r() - .5) * .06; }
      let g;
      if (ph < tp) g = .5 * Math.PI / tp * Math.sin(Math.PI * ph / tp);
      else if (ph < te) g = -A * Math.sin(Math.PI * (ph - tp) / (2 * tn));
      else g = 0;
      let tt = ph - te; if (tt < 0) tt += 1;
      if (tt < dt) { const x = tt / dt; g += A * .5 * (x + x - x * x - 1); }
      else if (tt > 1 - dt) { const x = (tt - 1) / dt; g += A * .5 * (x * x + x + x + 1); }
      g *= .08 * av * (1 + desvio);
      // inclinación espectral (voz más oscura en los graves)
      tilt += (g - tilt) * (1 - tipo.inclin * .8);
      ruido = (ruido * 16807) % 2147483647; const w = ruido / 1073741823.5 - 1;
      let x = tilt + w * ah * .3 * (ph < te ? 1 : .4);
      // nasal: polo y cero
      let y = NP.a * x + NP.b * NP.y1 + NP.c * NP.y2; NP.y2 = NP.y1; NP.y1 = y;
      const zz = (y - Bz * z1 - Cz * z2) / Az; z2 = z1; z1 = y; y = zz;
      x = y * nas + x * (1 - nas);
      // agudos: la fuente pasada por un pasaaltos y dos resonancias anchas
      const src = x; hpy = kHP * (hpy + src - hpx); hpx = src;
      let ha = HA.a * hpy + HA.b * HA.y1 + HA.c * HA.y2; HA.y2 = HA.y1; HA.y1 = ha;
      let hb = HB.a * hpy + HB.b * HB.y1 + HB.c * HB.y2; HB.y2 = HB.y1; HB.y1 = hb;
      for (let r = 0; r < 5; r++) { const o = R[r]; const v = o.a * x + o.b * o.y1 + o.c * o.y2; o.y2 = o.y1; o.y1 = v; x = v; }
      // fricción en paralelo
      ruido = (ruido * 16807) % 2147483647; const w2 = ruido / 1073741823.5 - 1;
      frLP += (pasa(BP2, pasa(BP1, w2)) - frLP) * .75; const fr = frLP;   // sin el siseo de arriba de 10 kHz
      // durante un cierre (b d g) solo pasa el murmullo grave
      grave += (x - grave) * .035; if (cie > .01) x = x * (1 - cie) + grave * cie * 1.5;
      const pr = PR.a * x + PR.b * PR.y1 + PR.c * PR.y2; PR.y2 = PR.y1; PR.y1 = pr;
      out[s] = x + brillo * (pr - x) + agudos * (hpy * .5 + ha + hb); outR[s] += fr * af * 1.1;
    }
  }
  return opc.separar ? { voz: out, ruido: outR } : out;
}
