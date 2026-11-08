// Del corpus analizado al modelo que usa el generador: motor/modelo.js
//   node herramientas/aprender.js
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './corpus.js';
import { cargarAnalisis } from './medir.js';
import { compasesDe, frasesDe, gradoSimple, mod } from './compas.js';
import { CIFRADOS } from './cifrados.js';
import { bloques, tempoEn, tonoNumEn } from './forma.js';
import { acorde } from '../motor/compositor.js';

// Un estilo por murga con al menos cuatro tramos; las demás entran sólo en «todas»
const ESTILOS = { trasnochada: 'La Trasnochada', catalina: 'Agarrate Catalina', muneca: 'La Gran Muñeca', pasteles: 'Metele que son Pasteles', bastarda: 'Doña Bastarda', asaltantes: 'Asaltantes con Patente', milonga: 'La Nueva Milonga', cabra: 'Cayó la Cabra' };
const PARTES = { presentacion: 'presentacion', cancion_final: 'final', final_y_retirada: 'retirada', retirada: 'retirada' };
const cnt = (h, k, v = 1) => { h[k] = (h[k] || 0) + v; };
const redondear = (h, d = 3) => { const t = Object.values(h).reduce((a, b) => a + b, 0) || 1; const r = {}; for (const [k, v] of Object.entries(h)) { const x = +(v / t).toFixed(d); if (x > 0) r[k] = x; } return r; };
const pcl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : null; };

// ── Un tramo: secuencia de bloques por compás ─────────────────────
function vistaTramo(an) {
  return { an, C: compasesDe(an) };
}

// ── Celdas ────────────────────────────────────────────────────────
// Una celda es un gesto real: de una respiración a otra que cae justo 2 compases después. Trae juntas
// la melodía, las voces de debajo y los acordes, todo relativo a la tónica. De acá sale la música; el
// compositor las elige y las encadena según la forma.
const CUOTA_CELDAS = 3000;

function celdasDe(v, parte, estilo) {
  const R = [];
  const { an, C } = v;
  const G = an.golpes.map(([q, d, ps]) => ({ q, d, ps }));
  const barra = q => { let lo = 0, hi = C.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (C[m].q0 <= q) lo = m; else hi = m - 1; } return C[lo]; };
  // Fronteras de frase: después de un silencio o de aterrizar en una nota larga
  const inicios = G.filter((x, i) => i === 0 || x.q - (G[i - 1].q + G[i - 1].d) >= 2 || G[i - 1].d >= 6 || x.q - G[i - 1].q >= 6).map(x => x.q);
  const qFin = G[G.length - 1].q + 1;
  // segundo en que suena cada pulso, para el tempo de la celda
  const porPulso = [...an.notas].sort((a, b) => a[0] - b[0]);
  const aSeg = q => { let lo = 0, hi = porPulso.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (porPulso[m][0] < q / 4) lo = m + 1; else hi = m; } return porPulso[lo][3]; };
  for (let i = 0; i < inicios.length; i++) {
    for (let j = i + 1; j < inicios.length; j++) {
      const largo = inicios[j] - inicios[i];
      if (largo > 35) break;
      if (Math.abs(largo - 32) > 3) continue;
      const span = 32;
      const c = barra(inicios[i]);
      const rel = mod(inicios[i] - c.q0, 8);   // la murga va en 2/4: una frase puede arrancar en el medio de estos 16
      const corr = rel <= 4 ? rel : rel - 8;
      // una frase puede arrancar en semicorchea impar (una anacrusa sincopada): la celda igual queda alineada al medio
      // compás. Antes se descartaban, y con ellas parte de la síncopa del corpus (celdas 14,3 % → 16,6 %, real 18,6 %).
      const S = inicios[i] - corr;
      const gs = G.filter(x => x.q >= inicios[i] && x.q < inicios[j]);
      if (gs.length < 3) continue;
      // Una sola tonalidad en toda la celda
      const h = {};
      for (let q = S; q < S + span; q += 4) { const a = an.acordes[Math.floor(q / 4)]; if (a) cnt(h, a[2] + ':' + a[3]); }
      const tope = Object.entries(h).sort((a, b) => b[1] - a[1])[0];
      if (!tope || tope[1] < .85 * span / 4) continue;
      const [t, may] = tope[0].split(':').map(Number);
      // Un acorde por medio compás
      const ac = [];
      for (let k = 0; k < span / 8; k++) {
        const x = an.acordes[Math.floor((S + k * 8) / 4)] || an.acordes[Math.floor((S + k * 8 + 4) / 4)];
        ac.push(x ? gradoSimple(x[0], x[1], t) : ac[k - 1] || (may ? 'I' : 'i'));
      }
      // Que el canto caiga sobre el acorde en los lugares fuertes, que tenga pulso y que suene
      let fuertes = 0, enAcorde = 0, pares = 0, suena = 0;
      for (const x of gs) {
        const q = x.q - S;
        if (mod(q, 2) === 0) pares++;
        suena += Math.min(x.d, S + span - x.q);
        if (mod(q, 8) !== 0 && x.d < 4) continue;
        let a; try { a = acorde(ac[Math.max(0, Math.min(ac.length - 1, Math.floor(q / 8)))]); } catch { continue; }
        fuertes++;
        if (a.pcs.includes(mod(x.ps[x.ps.length - 1] - t, 12))) enAcorde++;
      }
      // pares: que tenga pulso. Con 60 % se iban también los gestos sincopados de verdad: las celdas tenían 12,5 % de golpes
      // en semicorchea impar contra 18,6 % en los tramos; con 50 %, 14,3 %, y lo generado se acerca a lo real en los tres
      // estilos (docs/compositor_2.md). Los gestos con la grilla corrida igual se van por los apoyos fuera del acorde.
      if (fuertes < 2 || enAcorde / fuertes < .6 || pares / gs.length < .5 || suena / span < .3) continue;
      // una melodía que abarca más de 16 semitonos en dos compases es casi siempre un salto de octava del transcriptor
      // (la voz de arriba se calla y la de abajo pasa a ser "la melodía"): con esas celdas el compositor llegaba a
      // poner notas que no se pueden cantar (La Nueva Milonga, 33 celdas de 3060)
      const tops = gs.map(x => x.ps[x.ps.length - 1]);
      if (Math.max(...tops) - Math.min(...tops) > 16) continue;
      const t0 = aSeg(gs[0].q), t1 = aSeg(gs[gs.length - 1].q);
      const tonica = 60 + t;
      R.push({
        s: span, n: gs.length, p: parte, e: estilo, m: may ? 'M' : 'm', bat: c.bat ? 1 : 0,
        bpm: tempoEn(an, t0, t1 + 1) || 0, x: +(S / qFin).toFixed(2),
        v: +(gs.reduce((a, x) => a + x.ps.length, 0) / gs.length).toFixed(1),
        ac,
        g: gs.map(x => {
          const top = x.ps[x.ps.length - 1];
          return [x.q - S, Math.max(1, Math.min(x.d, inicios[j] - x.q)), top - tonica, [...new Set(x.ps.slice(0, -1).map(p => top - p))].sort((a, b) => a - b)];
        }),
        src: an.nombre,
      });
    }
  }
  return R;
}

// Reparte la cuota: todas las murgas, todas las partes, y de cada pedazo de cada tema lo más variado posible
function elegirCeldas(L) {
  const grupos = {};
  for (const c of L) (grupos[[c.e, c.p, c.s, c.m].join('|')] ||= []).push(c);
  const total = L.length;
  const res = [];
  for (const lista of Object.values(grupos)) {
    const cuota = Math.ceil(CUOTA_CELDAS * lista.length / total);
    const paso = Math.max(1, lista.length / cuota);
    for (let i = 0; i < lista.length; i += paso) res.push(lista[Math.floor(i)]);
  }
  return res;
}

function juntar(vistas) {
  const E = {
    celdas: [], tempo: {}, modo: {}, armonia: { mayor: { pasos: {} }, menor: { pasos: {} } },
    mov: {}, final: {}, loops: {}, voicing: {}, pasos: {},
    forma: { capInicial: {}, tempoPrimero: {}, tempoUltimo: {}, tempoCapela: [], capMedio: {}, modula: {}, largoBat: {} },
  };
  for (const v of vistas) {
    const { an, C } = v;
    const parte = PARTES[an.parte] || 'presentacion';
    const bpms = an.bpm.filter(Boolean);
    (E.tempo[parte] ||= []).push(pcl(bpms, .5));
    // modo global: el más frecuente en el tramo
    let may = 0; for (const a of an.acordes) may += a[3] ? 1 : -1;
    cnt(E.modo[parte] ||= {}, may >= 0 ? 'mayor' : 'menor');
    // La forma: pasajes a capela, tempo de cada parte y cambios de tono
    {
      const B = bloques(an).filter(b => b.t1 - b.t0 >= 4);
      const conBat = B.filter(b => b.bat && b.t1 - b.t0 >= 15);
      const F_ = E.forma;
      const cap0 = B.find(b => !b.bat && b.t1 - b.t0 >= 8 && b.t0 < 20);
      (F_.capInicial[parte] ||= []).push(cap0 ? cap0.t1 - cap0.t0 : 0);
      const tempos = conBat.map(b => tempoEn(an, b.t0, b.t1)).filter(Boolean);
      if (tempos.length) { (F_.tempoPrimero[parte] ||= []).push(tempos[0]); (F_.tempoUltimo[parte] ||= []).push(tempos[tempos.length - 1]); }
      for (const b of B) if (!b.bat && b.t1 - b.t0 >= 8) { const v = tempoEn(an, b.t0, b.t1); if (v && tempos.length) F_.tempoCapela.push(v / tempos[0]); }
      (F_.capMedio[parte] ||= []).push(B.filter(b => !b.bat && b !== cap0 && b.t1 - b.t0 >= 8).length);
      for (const b of conBat) (F_.largoBat[parte] ||= []).push(b.t1 - b.t0);
      const tonos = B.filter(b => b.t1 - b.t0 >= 12).map(b => tonoNumEn(an, b.t0, b.t1)).filter(Boolean);
      for (let i = 1; i < tonos.length; i++) {
        const a = tonos[i - 1], b = tonos[i];
        if (a.t === b.t && a.mayor === b.mayor) continue;
        cnt(F_.modula, (a.mayor ? 'M' : 'm') + (b.mayor ? 'M' : 'm') + mod(b.t - a.t, 12));
      }
    }
    // armonía, sólo donde el coro canta
    const seq = [];
    for (const a of an.acordes) {
      const g = gradoSimple(a[0], a[1], a[2]), m = a[3] ? 'mayor' : 'menor';
      const u = seq[seq.length - 1];
      if (u && u.g === g && u.m === m) u.n++; else seq.push({ g, m, n: 1 });
    }
    for (let i = 0; i < seq.length; i++) {
      const s = seq[i], A = E.armonia[s.m];
      if (i && seq[i - 1].m === s.m) { const p = A.pasos[seq[i - 1].g] ||= {}; cnt(p, s.g); }
    }
    for (const c of C) if (c.loop) cnt(E.loops[parte] ||= {}, c.loop);
    E.celdas.push(...celdasDe(v, parte, Object.entries(ESTILOS).find(([, n]) => n === an.murga)?.[0] || 'otra'));
    // La melodía es la nota de arriba de cada golpe
    let prevTop = null, prevQ = -99;
    an.golpes.forEach(([q, d, ps]) => {
      const top = ps[ps.length - 1];
      const a = an.acordes[Math.floor(q / 4)];
      if (!a) { prevTop = null; return; }
      const fuerte = mod(q, 4) === 0 || d >= 4;
      const iv = mod(top - a[0], 12), t = tipoAcorde(a[1]);
      if (prevTop !== null && q - prevQ <= 8) {
        const dlt = Math.max(-12, Math.min(12, top - prevTop));
        cnt(E.mov, dlt);
        // Estando en tal nota respecto del acorde que suena, en este lugar del compás, ¿a dónde va?
        cnt(E.pasos[t + (fuerte ? 'f' : 'd') + mod(prevTop - a[0], 12)] ||= {}, dlt);
        cnt(E.pasos[(fuerte ? 'f' : 'd') + mod(prevTop - a[0], 12)] ||= {}, dlt);
      }
      // qué canta el coro debajo de la melodía
      if (ps.length >= 2) {
        const dist = [...new Set(ps.slice(0, -1).map(p => top - p))].sort((x, y) => x - y).slice(0, 3);
        cnt(E.voicing[t + iv] ||= {}, dist.join(','));
      }
      prevTop = top; prevQ = q;
    });
    // Cómo termina una frase, respecto del acorde
    for (const f of frasesDe(an)) {
      const u = f[f.length - 1];
      const a = an.acordes[Math.floor(u.q / 4)];
      if (a) cnt(E.final, mod(u.ps[u.ps.length - 1] - a[0], 12));
    }
  }
  return E;
}
// Tipo de acorde para las tablas de voces
const tipoAcorde = q => (q === 'm' ? 'm' : q === '7' ? '7' : q === 'dim' ? 'o' : 'M');

function compactar(E) {
  const med = a => (a?.length ? pcl(a, .5) : null);
  const porParte = h => Object.fromEntries(Object.entries(h).map(([k, v]) => [k, med(v)]));
  const forma = {
    capInicial: porParte(E.forma.capInicial), tempoPrimero: porParte(E.forma.tempoPrimero), tempoUltimo: porParte(E.forma.tempoUltimo),
    tempoCapela: med(E.forma.tempoCapela), capMedio: porParte(E.forma.capMedio), largoBat: porParte(E.forma.largoBat), modula: redondear(E.forma.modula),
  };
  const armonia = {};
  for (const m of ['mayor', 'menor']) {
    const pasos = {};
    for (const [k, h] of Object.entries(E.armonia[m].pasos)) { const tot = Object.values(h).reduce((a, b) => a + b, 0); if (tot >= 2) pasos[k] = redondear(h); }
    armonia[m] = { pasos };
  }
  const voicing = {};
  for (const [k, h] of Object.entries(E.voicing)) {
    // sólo las formas que aparecen de verdad
    const orden = Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, 14);
    const tot = orden.reduce((a, x) => a + x[1], 0);
    if (tot >= 4) voicing[k] = Object.fromEntries(orden.map(([f, v]) => [f, +(v / tot).toFixed(3)]));
  }
  const pasos = {};
  for (const [k, h] of Object.entries(E.pasos)) {
    const tot = Object.values(h).reduce((a, b) => a + b, 0);
    if (tot >= 12) { const r = redondear(h, 3); pasos[k] = Object.fromEntries(Object.entries(r).filter(([, v]) => v >= .004)); }
  }
  const tempo = {};
  for (const [p, a] of Object.entries(E.tempo)) tempo[p] = { p10: pcl(a, .1), p50: pcl(a, .5), p90: pcl(a, .9) };
  const modo = {}; for (const [p, h] of Object.entries(E.modo)) modo[p] = redondear(h);
  const loops = {}; for (const [p, h] of Object.entries(E.loops)) loops[p] = redondear(h);
  return { tempo, modo, armonia, mov: redondear(E.mov), nota: { final: redondear(E.final) }, loops, voicing, forma, pasos };
}

// Armonía de los cifrados humanos: pesa en todos los estilos
function armoniaCifrados() {
  const P = { mayor: {}, menor: {} };
  for (const c of CIFRADOS) {
    const s = c.tema.join(' ').split(/\s+/);
    for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1]) cnt(P[c.modo][s[i - 1]] ||= {}, s[i]);
  }
  return { mayor: Object.fromEntries(Object.entries(P.mayor).map(([k, h]) => [k, redondear(h)])), menor: Object.fromEntries(Object.entries(P.menor).map(([k, h]) => [k, redondear(h)])) };
}

if (process.argv[1]?.endsWith('aprender.js')) {
  const L = cargarAnalisis();
  const V = L.map(vistaTramo);
  const estilos = { todas: compactar(juntar(V)) };
  for (const [k, nombre] of Object.entries(ESTILOS)) {
    const v = V.filter(x => x.an.murga === nombre);
    if (v.length) estilos[k] = compactar(juntar(v));
  }
  const crudas = juntar(V).celdas;
  const fuentes = L.map(a => a.nombre);
  const celdas = elegirCeldas(crudas).map(({ src, ...c }) => ({ ...c, f: fuentes.indexOf(src) }));
  const modelo = {
    celdas,
    fuentes,
    corpus: { tramos: L.length, por: Object.fromEntries(Object.entries(ESTILOS).map(([k, n]) => [k, L.filter(a => a.murga === n).length])) },
    cifrados: armoniaCifrados(),
    estilos,
  };
  mkdirSync(join(RAIZ, 'motor'), { recursive: true });
  const txt = '// Generado por herramientas/aprender.js: no se edita a mano.\nexport const MODELO = ' + JSON.stringify(modelo) + ';\n';
  writeFileSync(join(RAIZ, 'motor', 'modelo.js'), txt);
  console.log(`modelo: ${L.length} tramos, ${(txt.length / 1024).toFixed(0)} KB; celdas ${celdas.length} de ${crudas.length}`);
  const cuenta = {}; for (const c of celdas) cnt(cuenta, [c.e, c.p, c.s, c.m, c.bat ? 'bat' : 'cap'].join(' '));
  console.log(Object.entries(cuenta).sort().map(([k, v]) => k + ': ' + v).join(' | '));
}
