// El jurado: mide lo mismo en los tramos reales y en lo que genera el motor, y lo compara.
//   node herramientas/jurado.js              todas las pruebas
//   node herramientas/jurado.js --ver        además, rasgo por rasgo
//
// Cada rasgo vale 1 si cae entre los percentiles 25 y 75 de lo real, y baja como una campana afuera.
// La nota va de 0 a 10. Hay dos «tontos» de control, para comprobar que el jurado distingue:
//   azar:      notas al azar de la escala, con ritmo al azar
//   monotono:  bloques en una sola nota repetida, sin armonía que se mueva
// Los tramos reales también se juzgan, cada uno contra los demás.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TRABAJO } from './corpus.js';
import { componer, CUERDAS, Rng } from '../motor/compositor.js';
import { MODELO } from '../motor/modelo.js';
import { cargarAnalisis } from './medir.js';
import { croma, tonalidades, acordes } from './analisis.js';
import { golpes, lineas } from './golpes.js';
import { gradoSimple } from './compas.js';

const mod = (a, n) => ((a % n) + n) % n;
const media = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const pcl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

export const RASGOS = {
  // ritmo
  densidad: ['ritmo', 'golpes por compás'],
  corcheas: ['ritmo', 'golpes en lugar de corchea'],
  dist2: ['ritmo', 'golpes a distancia de una corchea'],
  sincopa: ['ritmo', 'golpes en semicorchea impar'],
  largas: ['ritmo', 'notas largas (negra con puntillo o más)'],
  frase: ['ritmo', 'largo mediano de frase, en compases'],
  aire: ['ritmo', 'parte del tiempo sin nadie cantando'],
  golpesFrase: ['ritmo', 'golpes por frase, mediana'],
  aterriza: ['ritmo', 'frases que terminan en nota larga'],
  // melodía (líneas)
  repite: ['melodia', 'la línea repite nota'],
  grado: ['melodia', 'la línea se mueve por grado'],
  tercera: ['melodia', 'la línea salta una tercera'],
  salto: ['melodia', 'la línea salta una cuarta o más'],
  rachaRepite: ['melodia', 'largo de la racha de notas repetidas'],
  rachaLarga: ['melodia', 'racha de notas repetidas, percentil 90'],
  ambito: ['melodia', 'ámbito de la línea por compás, en semitonos'],
  giros: ['melodia', 'cambios de dirección'],
  topRepite: ['melodia', 'la melodía (nota de arriba) repite'],
  topGrado: ['melodia', 'la melodía se mueve por grado'],
  topTercera: ['melodia', 'la melodía salta una tercera'],
  topSalto: ['melodia', 'la melodía salta una cuarta o más'],
  topRacha: ['melodia', 'racha de la melodía en la misma nota'],
  // armonía
  cambio: ['armonia', 'acordes por compás'],
  tonica: ['armonia', 'tiempo en tónica'],
  dominante: ['armonia', 'tiempo en dominante'],
  subdom: ['armonia', 'tiempo en subdominante'],
  resuelve: ['armonia', 'V que va a I'],
  cromat: ['armonia', 'notas fuera de la escala'],
  // voces
  voces: ['voces', 'voces por golpe'],
  unaVoz: ['voces', 'golpes a una voz'],
  tresMas: ['voces', 'golpes a tres voces o más'],
  terceras: ['voces', 'vecinas a distancia de tercera'],
  cuartas: ['voces', 'vecinas a cuarta o quinta'],
  segundas: ['voces', 'vecinas a segunda o menos'],
  span: ['voces', 'de la voz de abajo a la de arriba, en semitonos'],
  paralelas: ['voces', 'dos voces que se mueven juntas'],
  octavas: ['voces', 'golpes con la melodía doblada a la octava'],
  uniMueve: ['voces', 'el unísono se mueve más que el bloque'],
  bloqueLargo: ['voces', 'golpes largos a tres voces o más'],
  texSigue: ['voces', 'mismas voces que el golpe anterior'],
};

// Los rasgos de un conjunto de notas [{p, b, fin}] con su grilla ya resuelta
export function rasgos(notas) {
  const cr = croma(notas), tn = tonalidades(cr), ac = acordes(cr, tn);
  const { G } = golpes(notas);
  lineas(G);
  return rasgosDeGolpes(G, ac, tn);
}

function rasgosDeGolpes(G, ac, tn) {
  const R = {};
  const qMin = G[0].q, qMax = G[G.length - 1].q + G[G.length - 1].d;
  const compases = Math.max(1, (qMax - qMin) / 16);
  R.densidad = G.length / compases;
  R.corcheas = media(G.map(g => (mod(g.q, 2) === 0 ? 1 : 0)));
  const dist = G.slice(1).map((g, i) => g.q - G[i].q);
  R.dist2 = media(dist.map(d => (d === 2 ? 1 : 0)));
  R.sincopa = 1 - R.corcheas;
  R.largas = media(G.map(g => (g.d >= 6 ? 1 : 0)));
  // frases
  const F = []; let ini = G[0].q;
  for (let i = 0; i + 1 < G.length; i++) {
    const hueco = G[i + 1].q - (G[i].q + G[i].d);
    if (hueco >= 3 || (G[i].d >= 8 && G[i + 1].q - G[i].q >= 8)) { F.push((G[i].q + G[i].d - ini) / 16); ini = G[i + 1].q; }
  }
  R.frase = F.length ? pcl(F, .5) : compases;
  {
    // aire, largo de la frase en golpes y cómo termina
    let suena = 0, fin = -1e9;
    for (const g of G) { const a = Math.max(g.q, fin), b = g.q + g.d; if (b > a) suena += b - a; fin = Math.max(fin, b); }
    R.aire = 1 - suena / Math.max(1, qMax - qMin);
    const porFrase = []; let n = 0, largas = 0, frases = 0;
    for (let i = 0; i < G.length; i++) {
      n++;
      const s = G[i + 1];
      const corta = !s || s.q - (G[i].q + G[i].d) >= 3 || (G[i].d >= 8 && s.q - G[i].q >= 8);
      if (corta) { porFrase.push(n); n = 0; frases++; if (G[i].d >= 6) largas++; }
    }
    R.golpesFrase = pcl(porFrase, .5);
    R.aterriza = frases ? largas / frases : 0;
  }
  // líneas
  const mov = { rep: 0, gr: 0, ter: 0, sal: 0, tot: 0 }, rachas = [], ambitos = [];
  let giros = 0, conDir = 0;
  for (const l of [1, 2, 3]) {
    // sólo entre golpes pegados: después de un silencio la voz entra donde quiera, y eso no es un salto
    const conQ = G.map(g => [g.lin[l], g.q, g.d]).filter(x => x[0] !== null);
    const s = conQ.map(x => x[0]);
    let racha = 1, dirU = 0;
    for (let i = 1; i < s.length; i++) {
      if (conQ[i][1] - (conQ[i - 1][1] + conQ[i - 1][2]) >= 3) { rachas.push(racha); racha = 1; dirU = 0; continue; }
      const d = s[i] - s[i - 1], a = Math.abs(d);
      mov.tot++;
      if (a === 0) { mov.rep++; racha++; } else {
        rachas.push(racha); racha = 1;
        if (a <= 2) mov.gr++; else if (a <= 4) mov.ter++; else mov.sal++;
        const dir = Math.sign(d);
        conDir++;
        if (dirU && dir !== dirU) giros++;
        dirU = dir;
      }
    }
    rachas.push(racha);
    const porC = {};
    for (const g of G) if (g.lin[l] !== null) (porC[Math.floor(g.q / 16)] ||= []).push(g.lin[l]);
    for (const v of Object.values(porC)) if (v.length >= 2) ambitos.push(Math.max(...v) - Math.min(...v));
  }
  const t = Math.max(1, mov.tot);
  R.repite = mov.rep / t; R.grado = mov.gr / t; R.tercera = mov.ter / t; R.salto = mov.sal / t;
  R.rachaRepite = media(rachas); R.rachaLarga = pcl(rachas, .9);
  R.ambito = media(ambitos);
  R.giros = conDir ? giros / conDir : 0;
  // la melodía: la nota de arriba
  const top = G.map(g => g.ps[g.ps.length - 1]);
  const tm = { r: 0, g: 0, t: 0, s: 0, n: 0 }, rachaTop = [];
  { let ra = 1;
    for (let i = 1; i < top.length; i++) {
      if (G[i].q - G[i - 1].q > 8) { rachaTop.push(ra); ra = 1; continue; }
      const a = Math.abs(top[i] - top[i - 1]); tm.n++;
      if (a === 0) { tm.r++; ra++; } else { rachaTop.push(ra); ra = 1; if (a <= 2) tm.g++; else if (a <= 4) tm.t++; else tm.s++; }
    }
    rachaTop.push(ra);
  }
  const tn0 = Math.max(1, tm.n);
  R.topRepite = tm.r / tn0; R.topGrado = tm.g / tn0; R.topTercera = tm.t / tn0; R.topSalto = tm.s / tn0; R.topRacha = media(rachaTop);
  // armonía
  let cambios = 0; const pesos = { t: 0, d: 0, s: 0, n: 0 };
  let vs = 0, vI = 0;
  const gr = ac.map((a, i) => gradoSimple(a.r, a.q, tn[i].t));
  for (let i = 0; i < gr.length; i++) {
    const g = gr[i], base = g.replace(/7$|o$/, '');
    pesos.n++;
    if (['I', 'i'].includes(base)) pesos.t++;
    else if (['V', 'v', 'viio', 'vii'].includes(base)) pesos.d++;
    else if (['IV', 'iv', 'ii', 'II', 'bVI'].includes(base)) pesos.s++;
    if (i && g !== gr[i - 1]) {
      cambios++;
      if (/^V7?$/.test(gr[i - 1])) { vs++; if (/^[Ii]$/.test(g)) vI++; }
    }
  }
  R.cambio = cambios / (gr.length / 4);
  R.tonica = pesos.t / pesos.n; R.dominante = pesos.d / pesos.n; R.subdom = pesos.s / pesos.n;
  R.resuelve = vs ? vI / vs : .5;
  const ESC = { mayor: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10, 11] };
  let fuera = 0, todas = 0;
  for (const g of G) {
    const k = tn[Math.min(tn.length - 1, Math.floor(g.q / 4))];
    if (!k) continue;
    for (const p of g.ps) { todas++; if (!ESC[k.modo].includes(mod(p - k.t, 12))) fuera++; }
  }
  R.cromat = todas ? fuera / todas : 0;
  // voces
  const nv = G.map(g => g.ps.length);
  R.voces = media(nv); R.unaVoz = media(nv.map(n => (n === 1 ? 1 : 0))); R.tresMas = media(nv.map(n => (n >= 3 ? 1 : 0)));
  const iv = []; const spans = [];
  for (const g of G) { for (let i = 1; i < g.ps.length; i++) iv.push(g.ps[i] - g.ps[i - 1]); if (g.ps.length >= 2) spans.push(g.ps[g.ps.length - 1] - g.ps[0]); }
  R.terceras = media(iv.map(v => (v === 3 || v === 4 ? 1 : 0)));
  R.cuartas = media(iv.map(v => (v === 5 || v === 7 ? 1 : 0)));
  R.segundas = media(iv.map(v => (v <= 2 ? 1 : 0)));
  R.span = media(spans);
  let par = 0, parT = 0;
  for (let i = 1; i < G.length; i++) {
    const a = G[i - 1], b = G[i];
    if (a.ps.length >= 2 && b.ps.length >= 2) {
      const d1 = b.ps[b.ps.length - 1] - a.ps[a.ps.length - 1], d2 = b.ps[b.ps.length - 2] - a.ps[a.ps.length - 2];
      if (d1 !== 0 || d2 !== 0) { parT++; if (Math.sign(d1) === Math.sign(d2)) par++; }
    }
  }
  R.paralelas = parT ? par / parT : 0;
  const conOct = G.filter(g => g.ps.length >= 2);
  R.octavas = conOct.length ? media(conOct.map(g => (g.ps.slice(0, -1).some(p => (g.ps[g.ps.length - 1] - p) % 12 === 0) ? 1 : 0))) : 0;
  const mov1 = [], movB = [];
  for (let i = 1; i < G.length; i++) { if (G[i].q - G[i - 1].q > 8) continue; (G[i].ps.length === 1 ? mov1 : movB).push(top[i] !== top[i - 1] ? 1 : 0); }
  R.uniMueve = media(mov1) - media(movB);
  const largos = G.filter(g => g.d >= 6);
  R.bloqueLargo = largos.length ? media(largos.map(g => (g.ps.length >= 3 ? 1 : 0))) : 0;
  let sigue = 0, sigueT = 0;
  for (let i = 1; i < G.length; i++) { if (G[i].q - G[i - 1].q > 8) continue; sigueT++; if (G[i].ps.length === G[i - 1].ps.length) sigue++; }
  R.texSigue = sigueT ? sigue / sigueT : 0;
  return R;
}

export function rasgosReal(an) {
  const notas = an.notas.map(([b, fin, p]) => ({ b, fin, p }));
  return rasgos(notas);
}

export function notasDePieza(P) {
  const N = [];
  for (const k of CUERDAS) for (const [q, d, p] of P.ev[k]) N.push({ b: q / 4, fin: (q + d) / 4, p });
  return N.sort((a, b) => a.b - b.b || a.p - b.p);
}

function azar(semilla) {
  const r = new Rng(semilla), N = [], esc = [0, 2, 3, 5, 7, 8, 10];
  let b = 0;
  while (b < 200) {
    const d = r.elegir([.25, .5, .5, .75, 1, 1.5]);
    const vs = r.ent(1, 4);
    for (let i = 0; i < vs; i++) N.push({ b, fin: b + d, p: 45 + 12 * r.ent(0, 2) + r.elegir(esc) });
    b += d + (r.r() < .15 ? r.elegir([.5, 1]) : 0);
  }
  return N;
}
function monotono(semilla) {
  const r = new Rng(semilla), N = [], t = 57 + r.ent(0, 4);
  for (let b = 0; b < 200; b += .5) { N.push({ b, fin: b + .5, p: t }); N.push({ b, fin: b + .5, p: t + 4 }); N.push({ b, fin: b + .5, p: t - 3 }); }
  return N;
}

// Estadística de cada rasgo en lo real
export function normas(reales) {
  const N = {};
  for (const k of Object.keys(RASGOS)) {
    const v = reales.map(r => r[k]).filter(x => Number.isFinite(x));
    const p25 = pcl(v, .25), p75 = pcl(v, .75), p10 = pcl(v, .1), p50 = pcl(v, .5), p90 = pcl(v, .9);
    N[k] = { p10, p25, p50, p75, p90, ancho: Math.max((p75 - p25) * .75, (Math.abs(p50) + .02) * .15, 1e-3) };
  }
  return N;
}
export function valorar(x, n) {
  if (!Number.isFinite(x)) return 0;
  if (x >= n.p25 && x <= n.p75) return 1;
  const d = x < n.p25 ? n.p25 - x : x - n.p75;
  return Math.exp(-.5 * (d / n.ancho) ** 2);
}
export function nota(R, N) {
  const rub = {};
  for (const k of Object.keys(RASGOS)) (rub[RASGOS[k][0]] ||= []).push(valorar(R[k], N[k]));
  const res = Object.fromEntries(Object.entries(rub).map(([k, v]) => [k, 10 * media(v)]));
  res.total = media(Object.values(res));
  return res;
}

// ¿Cada estilo suena a su murga? Se lo juzga contra las normas de esa murga y contra las de la otra.
// Si el motor captó la diferencia, cada uno tiene que parecerse más a la suya. De referencia, lo mismo con los tramos reales.
function estilos(reales) {
  const MUR = { trasnochada: 'La Trasnochada', catalina: 'Agarrate Catalina' };
  const nor = Object.fromEntries(Object.entries(MUR).map(([k, m]) => [k, normas(reales.filter(x => x.an.murga === m).map(x => x.R))]));
  const res = {};
  console.log('\ncontra las normas de cada murga'.padEnd(46) + 'Trasnochada  Catalina');
  for (const [k, m] of Object.entries(MUR)) {
    const P = [];
    for (const forma of ['presentacion', 'retirada']) for (const s of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) P.push(rasgos(notasDePieza(componer(MODELO, { forma, estilo: k, semilla: s, tonica: mod(s * 5, 12), modo: MODELO.estilos[k]?.modo?.[forma]?.mayor >= .5 ? 'mayor' : 'menor' }))));
    const a = media(P.map(r => nota(r, nor.trasnochada).total)), b = media(P.map(r => nota(r, nor.catalina).total));
    console.log(`motor, estilo ${m}`.padEnd(45) + a.toFixed(1).padStart(8) + b.toFixed(1).padStart(11));
    const propios = reales.filter(x => x.an.murga === m), otra = k === 'trasnochada' ? 'catalina' : 'trasnochada';
    const dePropia = media(propios.map(x => nota(x.R, normas(reales.filter(y => y.an.murga === m && y !== x).map(y => y.R))).total));
    const deOtra = media(propios.map(x => nota(x.R, nor[otra]).total));
    const [c, d] = k === 'trasnochada' ? [dePropia, deOtra] : [deOtra, dePropia];
    console.log(`real, ${m}`.padEnd(45) + c.toFixed(1).padStart(8) + d.toFixed(1).padStart(11));
    res[k] = { motor: [a, b], real: [c, d] };
  }
  return res;
}

// La prueba de no haber visto: se saca un espectáculo entero del corpus, se genera sólo con el resto,
// y se mide qué tan lejos cae de ese espectáculo. La regla es la distancia entre dos espectáculos reales.
function sinEspiar(reales) {
  const zs = {};
  for (const k of Object.keys(RASGOS)) { const v = reales.map(x => x.R[k]); const m = media(v), s = Math.sqrt(media(v.map(x => (x - m) ** 2))) || 1; zs[k] = [m, s]; }
  const dist = (a, b) => Math.sqrt(media(Object.keys(RASGOS).map(k => ((a[k] - b[k]) / zs[k][1]) ** 2)));
  const shows = [...new Set(reales.map(x => x.an.murga + '|' + x.an.anio))];
  const fuentes = MODELO.fuentes || [];
  const filas = [];
  for (const sh of shows) {
    const [murga, anio] = sh.split('|');
    const propios = reales.filter(x => x.an.murga === murga && String(x.an.anio) === anio);
    const otros = reales.filter(x => !propios.includes(x));
    const fuera = new Set(propios.map(x => fuentes.indexOf(x.an.nombre)));
    const M = { ...MODELO, celdas: MODELO.celdas.filter(c => !fuera.has(c.f)) };
    for (const p of propios) {
      const forma = p.an.parte === 'presentacion' ? 'presentacion' : 'retirada';
      const est = murga === 'La Trasnochada' ? 'trasnochada' : murga === 'Agarrate Catalina' ? 'catalina' : 'todas';
      const gen = [1, 2, 3].map(s => rasgos(notasDePieza(componer(M, { forma, estilo: est, semilla: s * 11 + p.an.anio, tonica: 9, modo: 'menor' }))));
      const dGen = media(gen.map(g => dist(g, p.R)));
      const dReal = otros.filter(o => (o.an.parte === 'presentacion') === (p.an.parte === 'presentacion')).map(o => dist(o.R, p.R)).sort((a, b) => a - b);
      filas.push({ n: p.an.nombre, dGen, med: dReal[dReal.length >> 1], p10: dReal[Math.floor(dReal.length * .1)], p90: dReal[Math.floor(dReal.length * .9)] });
    }
  }
  console.log('\nsin espiar: distancia a un espectáculo que el motor no vio (0 = idéntico)');
  for (const f of filas) console.log(`  ${f.n.padEnd(44)} motor ${f.dGen.toFixed(2)}   otros espectáculos reales ${f.p10.toFixed(2)} / ${f.med.toFixed(2)} / ${f.p90.toFixed(2)}`);
  console.log(`  mediana: motor ${pcl(filas.map(f => f.dGen), .5).toFixed(2)}, real contra real ${pcl(filas.map(f => f.med), .5).toFixed(2)}; el motor queda más cerca que la mediana real en ${Math.round(100 * media(filas.map(f => (f.dGen <= f.med ? 1 : 0))))} % de los casos`);
  return { motor: pcl(filas.map(f => f.dGen), .5), real: pcl(filas.map(f => f.med), .5), filas };
}

if (process.argv[1]?.endsWith('jurado.js')) {
  const ver = process.argv.includes('--ver');
  const L = cargarAnalisis();
  const reales = L.map(a => ({ an: a, R: rasgosReal(a) }));
  console.log(`${L.length} tramos reales`);
  // cada real, contra los demás
  const notasReales = reales.map((x, i) => nota(x.R, normas(reales.filter((_, j) => j !== i).map(y => y.R))));
  const N = normas(reales.map(x => x.R));
  const salida = { filas: [] };
  const fila = (nom, l) => {
    console.log(nom.padEnd(30) + ['total', 'ritmo', 'melodia', 'armonia', 'voces'].map(k => media(l.map(n => n[k])).toFixed(1).padStart(8)).join(''));
    salida.filas.push({ nombre: nom, ...Object.fromEntries(['total', 'ritmo', 'melodia', 'armonia', 'voces'].map(k => [k, media(l.map(n => n[k]))])) });
  };
  console.log(''.padEnd(30) + ['total', 'ritmo', 'melodía', 'armonía', 'voces'].map(k => k.padStart(8)).join(''));
  fila('tramos reales', notasReales);
  const semillas = [1, 2, 3, 4, 5, 6, 7, 8];
  const gen = {};
  for (const forma of ['presentacion', 'retirada']) {
    for (const est of Object.keys(MODELO.estilos)) {
      const P = semillas.map(s => rasgos(notasDePieza(componer(MODELO, { forma, estilo: est, semilla: s, tonica: mod(s * 5, 12), modo: s % 3 ? 'menor' : 'mayor' }))));
      gen[forma + ' · ' + est] = P;
      fila(forma + ' · ' + est, P.map(r => nota(r, N)));
    }
  }
  if (process.argv.includes('--sin-espiar')) salida.sinEspiar = sinEspiar(reales);
  salida.estilos = estilos(reales);
  fila('tonto · azar', semillas.map(s => nota(rasgos(azar(s)), N)));
  fila('tonto · monótono', semillas.map(s => nota(rasgos(monotono(s)), N)));
  writeFileSync(join(TRABAJO, 'jurado.json'), JSON.stringify(salida));
  if (ver) {
    const todos = Object.values(gen).flat();
    console.log('\n' + 'rasgo'.padEnd(46) + '  p10    p50    p90  | motor   nota');
    for (const k of Object.keys(RASGOS)) {
      const n = N[k], x = media(todos.map(r => r[k]));
      console.log(`${(RASGOS[k][0].slice(0, 3) + ' ' + RASGOS[k][1]).padEnd(46)}${n.p10.toFixed(2).padStart(6)} ${n.p50.toFixed(2).padStart(6)} ${n.p90.toFixed(2).padStart(6)}  | ${x.toFixed(2).padStart(6)}  ${valorar(x, n).toFixed(2)}`);
    }
  }
}
