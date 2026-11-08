// El compositor: de unos pocos parámetros a una pieza de murga.
// Corre igual en Node y en el navegador. Todo lo que puede venir de datos viene del modelo
// (herramientas/aprender.js); lo que no, de docs/analisis_de_los_midis.md e INVESTIGACION.md.
//
// Unidad de tiempo: la semicorchea; un compás son 16.

export const PB = 16;
export const CUERDAS = ['bajos', 'segundos', 'primos', 'sobreprimos', 'tercia'];
export const RANGOS = { bajos: [43, 55], segundos: [48, 62], primos: [54, 69], sobreprimos: [60, 74], tercia: [64, 77] };
const MELODIA = [57, 73];   // la melodía va arriba del bloque
const mod = (a, n) => ((a % n) + n) % n;
import { MODOS } from './modos.js';

// ── Azar con semilla ───────────────────────────────────────────────
export class Rng {
  constructor(s) { this.a = (s * 9973 + 17) >>> 0; }
  r() { let t = this.a += 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  uni(a, b) { return a + (b - a) * this.r(); }
  ent(a, b) { return a + Math.floor(this.r() * (b - a + 1)); }
  elegir(l) { return l[Math.floor(this.r() * l.length)]; }
  peso(h) {
    const k = Object.keys(h); let t = 0;
    for (const x of k) t += h[x];
    let u = this.r() * t;
    for (const x of k) { u -= h[x]; if (u <= 0) return x; }
    return k[k.length - 1];
  }
  indicePeso(a) { let t = 0; for (const x of a) t += x; let u = this.r() * t; for (let i = 0; i < a.length; i++) { u -= a[i]; if (u <= 0) return i; } return a.length - 1; }
}

// ── Teoría ─────────────────────────────────────────────────────────
const ROM = { i: 0, ii: 2, iii: 4, iv: 5, v: 7, vi: 9, vii: 11 };
export function acorde(g) {
  const m = /^(b|#)?([ivIV]+)(7|o)?$/.exec(g);
  if (!m) throw new Error('grado desconocido: ' + g);
  const raiz = ROM[m[2].toLowerCase()] + (m[1] === 'b' ? -1 : m[1] === '#' ? 1 : 0);
  const menor = m[2] === m[2].toLowerCase();
  let iv = menor ? [0, 3, 7] : [0, 4, 7];
  if (m[3] === '7') iv = [0, 4, 7, 10];
  if (m[3] === 'o') iv = [0, 3, 6];
  return { g, raiz: mod(raiz, 12), iv, pcs: iv.map(i => mod(raiz + i, 12)) };
}
const ESCALA = { mayor: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10] };

// La escala que suena sobre un acorde: las notas del acorde mandan sobre la escala (la sensible sobre V, etc.)
export function escalaSobre(modo, ac) {
  const e = new Set(ESCALA[modo]);
  for (const p of ac.pcs) {
    if (e.has(p)) continue;
    for (const v of [mod(p - 1, 12), mod(p + 1, 12)]) if (e.has(v)) { e.delete(v); break; }
    e.add(p);
  }
  return e;
}

// ── Mezcla de distribuciones ───────────────────────────────────────
function mezclar(a, b, pa = .5) {
  const r = {};
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) r[k] = pa * (a?.[k] || 0) + (1 - pa) * (b?.[k] || 0);
  return r;
}

const VOCAB = {
  mayor: ['I', 'ii', 'iii', 'IV', 'V', 'V7', 'vi', 'I7', 'II7', 'III7', 'VI7', 'iv', 'bVII'],
  menor: ['i', 'iv', 'V', 'V7', 'bIII', 'bVI', 'bVII', 'I7', 'iio', 'viio'],
};

function tablaArmonia(M, E, modo) {
  const hum = M.cifrados[modo] || {}, det = E.armonia?.[modo]?.pasos || {};
  const V = VOCAB[modo], T = {};
  for (const a of V) {
    const m = mezclar(hum[a], det[a], .65), f = {};
    for (const b of V) if (b !== a) f[b] = (m[b] || 0) + .012;
    // Los pasos que manda la tonalidad, por si la tabla viene flaca
    if (a === 'V7' || a === 'V') f[modo === 'mayor' ? 'I' : 'i'] += .6;
    if (a === 'I7') f[modo === 'mayor' ? 'IV' : 'iv'] += 1;
    if (a === 'II7') f.V += 1;
    if (a === 'III7') f.vi += .5;
    if (a === 'VI7') f.ii += .5;
    T[a] = f;
  }
  return T;
}

// ── Celdas ─────────────────────────────────────────────────────────
// La música sale de gestos reales: de una respiración a otra, 2 o 4 compases con su melodía, sus voces y
// sus acordes. El compositor no inventa notas sueltas: pide la celda que la forma necesita (que empiece
// en la tónica, que termine en la dominante, que tenga esta densidad, que siga bien a la anterior) y
// la varía apenas. Es la idea de la recombinación: el estilo vive en los gestos.
const COSTURA = 1.2;
const TONICA = g => g === 'I' || g === 'i';
const DOMINANTE = g => /^(V7?|v|viio)$/.test(g);

function registro(c, tonica, nota, desde = 0) {
  const tops = c.g.filter(h => h[0] >= desde).map(h => h[2]);
  if (!tops.length) return 60 + tonica;
  const lo = Math.min(...tops), hi = Math.max(...tops);
  let mej = 60 + tonica, md = 1e9;
  for (let k = -2; k <= 2; k++) {
    const off = 60 + tonica + 12 * k;
    // la melodía real vive entre 56 y 69, con centro en 64
    let costo = Math.abs((lo + hi) / 2 + off - 63.5);
    if (hi + off > 71) costo += 3 * (hi + off - 71);
    if (lo + off < 54) costo += 3 * (54 - lo - off);
    if (nota !== null && nota !== undefined) costo += .5 * Math.abs(tops[0] + off - nota);
    if (costo < md) { md = costo; mej = off; }
  }
  return mej;
}

// Cuánto recita una celda: la parte de sus notas que repite la anterior
const repite = c => { if (c.rep === undefined) { let r = 0; for (let i = 1; i < c.g.length; i++) if (c.g[i][2] === c.g[i - 1][2]) r++; c.rep = r / Math.max(1, c.g.length - 1); } return c.rep; };

function pedirCelda(rng, C, T, p) {
  const m = p.modo === 'mayor' ? 'M' : 'm';
  const desde = p.desde || 0;
  const ei = desde / 8;
  const prueba = (lista, relajar) => {
    // la costura sólo se puede medir en gestos que arrancan con voces abajo; a los que arrancan en unísono se les
    // aplica la costura media de los otros, así no salen elegidos de más (antes daban 35 % de unísonos contra 27 %
    // en los gestos reales)
    const unisono = new Set(); let sumaCos = 0, nCos = 0;
    const pesos = lista.map(c => {
      if (c.m !== m || c.s !== p.s || c.bat === (p.capela ? 1 : 0)) return 0;
      let w = (c.p === p.parte ? 1.5 : 1) * (p.usadas?.has(c) ? .03 : 1);
      if (p.ini && relajar < 2) w *= p.ini(c.ac[ei]);
      if (p.fin && relajar < 1) w *= p.fin(c.ac[c.ac.length - 1], c.ac[c.ac.length - 2]);
      if (!w) return 0;
      // un gesto quieto en la tónica es lo más fácil de encadenar: si no se lo frena, la pieza no se mueve
      const nt = c.ac.filter(TONICA).length;
      if (nt === c.ac.length) w *= .45; else if (nt >= c.ac.length - 1) w *= .85;
      if (p.antes) { const a = c.ac[ei]; if (a !== p.antes) w *= .15 + Math.min(1, 6 * (T[p.antes]?.[a] || 0)); }
      if (p.tempo && c.bpm && !p.capela) { const r = Math.log(c.bpm / p.tempo) / .3; w *= Math.exp(-r * r); }
      const hb = c.n / (c.s / 16);
      if (p.densidad === 'silabico') w *= hb >= 3.5 ? 1 : .25;
      else if (p.densidad === 'amplio') w *= hb <= 3.2 ? 1 : .2;
      if (p.recita) w *= Math.exp(4 * p.recita * (repite(c) - .42));
      // el gesto que sigue, de otro tema: si no, dos gestos vecinos rearman el pasaje original
      if (p.como) { w *= Math.exp(-Math.abs(c.n - p.como.n) / 6); if (c.f === p.como.f) w *= .08; }
      // los finales aterrizan: ahí se apoya el oído
      if (p.aterriza) { const u = c.g[c.g.length - 1]; w *= u[1] >= 8 ? 1 : u[1] >= 5 ? .6 : .2; }
      if (p.capela) w *= c.v >= 2 ? 1 : .3;
      if (p.momento) w *= c.x >= p.momento[0] && c.x <= p.momento[1] ? 1 : p.gancho ? .08 : .4;
      // la bajada es un gancho: pocos acordes, en el acorde, fácil de cantar
      if (p.gancho) { const ac = new Set(c.ac).size; w *= ac <= 2 ? 1 : ac === 3 ? .6 : .3; if (repite(c) < .25) w *= .6; }
      if (p.nota !== null && p.nota !== undefined) {
        const off = registro(c, p.tonica, p.nota, desde), h = c.g.find(x => x[0] >= desde);
        if (h) {
          w *= Math.exp(-Math.abs(h[2] + off - p.nota) / 4);
          // la costura: que cada voz de abajo tenga a dónde ir sin saltar
          if (p.voces?.length && h[3].length) {
            const abajo = h[3].map(d => h[2] + off - d);
            let suma = 0;
            for (const a of abajo) suma += Math.min(...p.voces.map(v => Math.abs(v - a)));
            const f = Math.exp(-(suma / abajo.length) / COSTURA);
            w *= f; sumaCos += f; nCos++;
          } else if (p.voces?.length > 1 && !h[3].length) unisono.add(c);
        }
      }
      return w;
    });
    if (unisono.size && nCos) { const f = sumaCos / nCos; lista.forEach((c, i) => { if (unisono.has(c)) pesos[i] *= f; }); }
    return pesos.some(x => x > 0) ? lista[rng.indicePeso(pesos)] : null;
  };
  for (const lista of [C.propias, C.todas]) for (let r = 0; r < 3; r++) { const c = prueba(lista, r); if (c) { p.usadas?.add(c); return c; } }
  return null;
}

// Una unidad son 4 compases hechos de dos gestos de 2 compases, de temas distintos: golpes [q,d,top,dist,off]
// relativos a la tónica, y 8 acordes de medio compás. Con esto ninguna cita pasa de 2 compases.
const ultimaNota = u => { const h = u.g[u.g.length - 1]; return h ? h[2] + (h[4] ?? u.off) : null; };
const colocada = (c, off, q0 = 0) => c.g.map(h => [h[0] + q0, h[1], h[2], h[3], off]);
function unir(x, offX, y, offY) {
  return { g: [...colocada(x, offX), ...colocada(y, offY, 32)], ac: [...x.ac, ...y.ac], off: offX };
}

// El plan de un tema: a pregunta (termina en la dominante), a' responde (misma cabeza, termina en la tónica),
// b contrasta, a'' vuelve la respuesta. Con 8 compases son sólo a y a'.
function planTema(rng, C, T, sec, usadas) {
  const unidades = Math.round(sec.compases / 4);
  const mayor = sec.modo === 'mayor';
  const contraste = mayor ? ['IV', 'vi', 'ii', 'iii'] : ['iv', 'bVI', 'bIII', 'bVII'];
  const ctx = { s: 32, gancho: sec.gancho, recita: sec.recita, modo: sec.modo, parte: sec.parte, tempo: sec.tempo, densidad: sec.densidad, capela: !!sec.capela, momento: sec.momento, tonica: sec.tonica, usadas };
  const pedir = p => {
    const c = pedirCelda(rng, C, T, { ...ctx, ...p });
    return { c, off: registro(c, sec.tonica, p.nota) };
  };
  const finDe = x => { const h = x.c.g[x.c.g.length - 1]; return h[2] + x.off; };
  const vocesFin = x => { const h = x.c.g[x.c.g.length - 1], t = h[2] + x.off; return [t, ...h[3].map(d => t - d)]; };
  const seguir = (x, p) => pedir({ ...p, antes: x.c.ac[3], nota: finDe(x), como: x.c, voces: vocesFin(x) });
  const x1 = pedir({ nota: sec.notaPrev, ini: g => (TONICA(g) ? 1 : .2) });
  const x2 = seguir(x1, { aterriza: true, fin: g => (DOMINANTE(g) ? 1 : TONICA(g) ? .05 : .3) });
  const plan = [unir(x1.c, x1.off, x2.c, x2.off)];
  if (unidades >= 2) {
    const y2 = seguir(x1, { aterriza: true, fin: (g, g1) => (TONICA(g) ? (DOMINANTE(g1) ? 1 : .5) : .01) });
    plan.push(unir(x1.c, x1.off, y2.c, y2.off));
    if (unidades >= 4) {
      const z1 = seguir(y2, { ini: g => (contraste.includes(g) ? 1 : TONICA(g) ? .05 : .2) });
      const z2 = seguir(z1, { aterriza: true, fin: g => (DOMINANTE(g) ? 1 : TONICA(g) ? .1 : .3) });
      // la cuarta frase es nueva y cierra en la tónica: en el corpus el contorno de la melodía vuelve igual a 8 compases
      // sólo en el 10 % de los casos (en v1, que copiaba la segunda frase, en el 41 %)
      const w1 = seguir(z2, { ini: g => (TONICA(g) ? 1 : .3) });
      const w2 = seguir(w1, { aterriza: true, fin: (g, g1) => (TONICA(g) ? (DOMINANTE(g1) ? 1 : .5) : .01) });
      plan.push(unir(z1.c, z1.off, z2.c, z2.off), unir(w1.c, w1.off, w2.c, w2.off));
    }
  }
  return plan.slice(0, unidades);
}

// ── Melodía ────────────────────────────────────────────────────────
// La nota de arriba del coro. Una sola tabla decide: estando en tal nota respecto del acorde que suena,
// en un lugar fuerte o débil del compás, ¿a dónde va? Se sortea un camino de punta a punta, para que
// la frase termine donde tiene que terminar.
const PISO_PASO = 2e-3, RACHA = .55, VARIA_CADA = 8, VARIA_TOPE = 9;
const tipoDe = ac => (ac.iv.length === 4 ? '7' : ac.iv[1] === 4 ? 'M' : ac.iv[2] === 6 ? 'o' : 'm');
const fuerza = g => (mod(g.q, 4) === 0 || g.d >= 4 ? 'f' : 'd');

function pesoPaso(E, g, tonica, de, a) {
  const iv = mod(de - tonica - g.ac.raiz, 12);
  const t = E.pasos?.[tipoDe(g.ac) + fuerza(g) + iv] || E.pasos?.[fuerza(g) + iv];
  const d = Math.max(-12, Math.min(12, a - de));
  if (t) return Math.max(PISO_PASO, t[d] || 0);
  return Math.max(PISO_PASO, E.mov?.[d] || 0);
}

// golpes: [{q,d,ac}]; guia(i): nota sugerida; devuelve una nota por golpe
function melodia(rng, E, sec, golpes, lo, hi, guia, sigma = 2.2) {
  const { tonica, modo } = sec;
  const n = golpes.length;
  if (!n) return [];
  const opciones = golpes.map((g, i) => {
    const esc = escalaSobre(modo, g.ac), o = [];
    for (let p = lo; p <= hi; p++) if (esc.has(mod(p - tonica, 12))) o.push(p);
    const c = guia ? guia(i) : null;
    if (c !== null && c !== undefined && !o.includes(c)) o.push(c);
    return o;
  });
  // Lo único que se le pide a una nota, además del paso: cerrar bien y seguir la guía
  const pedido = golpes.map((g, i) => opciones[i].map(p => {
    let e = 1;
    const enAc = g.ac.pcs.includes(mod(p - tonica, 12));
    if (i === n - 1 || g.final) e *= enAc ? 1 + 8 * Math.max(.01, E.nota?.final?.[mod(p - tonica - g.ac.raiz, 12)] || .01) : .03;
    if (g.fin && !g.fin.includes(mod(p - tonica, 12))) e *= .05;
    if (g.evitar === p) e = 0;
    if (i === 0) e *= enAc ? 1.5 : .3;
    const c = guia ? guia(i) : null;
    // la nota que se varía no puede ser la misma, pero queda cerca: como entre dos versos, cambia por una vecina
    const sg = g.evitar !== undefined ? 1.6 : sigma;
    if (c !== null && c !== undefined) { const d = Math.abs(p - c); e *= Math.exp(-(d * d) / (2 * sg * sg)) * (d === 0 ? 3 : 1); }
    // la frase vive en el medio del registro
    const centro = (lo + hi) / 2, dc = (p - centro) / ((hi - lo) / 2);
    e *= Math.exp(-.5 * dc * dc);
    return e;
  }));
  const beta = pedido.map(e => new Float64Array(e.length));
  beta[n - 1].set(pedido[n - 1]);
  for (let i = n - 2; i >= 0; i--) {
    let mx = 1e-300;
    for (let x = 0; x < opciones[i].length; x++) {
      let t = 0;
      for (let y = 0; y < opciones[i + 1].length; y++) t += pesoPaso(E, golpes[i + 1], tonica, opciones[i][x], opciones[i + 1][y]) * beta[i + 1][y];
      beta[i][x] = t * pedido[i][x];
      if (beta[i][x] > mx) mx = beta[i][x];
    }
    for (let x = 0; x < beta[i].length; x++) beta[i][x] /= mx;
  }
  const res = new Array(n);
  let ult = opciones[0][rng.indicePeso([...beta[0]])];
  res[0] = ult;
  let racha = 1;
  for (let i = 1; i < n; i++) {
    const pesos = opciones[i].map((p, y) => {
      let w = pesoPaso(E, golpes[i], tonica, ult, p) * beta[i][y];
      if (p === ult && racha >= 3) w *= Math.pow(RACHA, racha - 2);
      return w;
    });
    const nota = opciones[i][rng.indicePeso(pesos)];
    racha = nota === ult ? racha + 1 : 1;
    ult = nota;
    res[i] = ult;
  }
  return res;
}

// ── Voces ──────────────────────────────────────────────────────────
const enRango = (k, p) => p >= RANGOS[k][0] && p <= RANGOS[k][1];

// Reparte las notas de un golpe entre las cuerdas, por registro
function repartir(sec, g, notas, din, ev) {
  const orden = [...new Set(notas)].sort((x, y) => y - x);
  const q = g.q + sec.inicio;
  if (orden.length === 1) {
    // unísono: todos los que llegan cantan la misma nota
    let alguno = false;
    for (const k of ['segundos', 'primos', 'sobreprimos']) if (enRango(k, orden[0])) { ev[k].push([q, g.d, orden[0], din, false]); alguno = true; }
    if (!alguno) ev.primos.push([q, g.d, orden[0], din, false]);
    return;
  }
  for (const p of orden) {
    const k = p >= 65 ? 'sobreprimos' : p >= 56 ? 'primos' : p >= 48 ? 'segundos' : 'bajos';
    ev[k].push([q, g.d, p, din, false]);
  }
}

// La forma del acorde debajo de la melodía: aprendida; si no hay datos para ese caso, tríada cerrada
function formaBloque(rng, E, sec, g, top, cuantas, prev) {
  const { tonica, modo } = sec, ac = g.ac;
  const iv = mod(top - tonica - ac.raiz, 12);
  const tipo = ac.iv.length === 4 ? '7' : ac.iv[1] === 4 ? 'M' : ac.iv[2] === 6 ? 'o' : 'm';
  const tabla = E.voicing?.[tipo + iv];
  const esc = escalaSobre(modo, ac);
  if (tabla) {
    const h = {};
    for (const [f, w] of Object.entries(tabla)) {
      const dist = f.split(',').map(Number);
      if (dist.length !== cuantas - 1) continue;
      const ps = dist.map(d => top - d);
      // que no aparezca nada ajeno al acorde o a la escala, y que no baje del registro
      if (ps.some(p => p < 43 || !esc.has(mod(p - tonica, 12)))) continue;
      const tonos = ps.filter(p => ac.pcs.includes(mod(p - tonica, 12))).length;
      let v = w * (tonos === ps.length ? 2 : .25);
      // conducción: las voces de abajo se mueven poco; mejor aún si van en paralelo con la melodía
      if (prev?.abajo?.length === ps.length) {
        const salto = ps.reduce((x, p, i) => x + Math.abs(p - prev.abajo[i]), 0) / ps.length;
        v *= Math.exp(-salto / 1.1);
        if (prev.forma === f) v *= 4;
      }
      h[f] = v;
    }
    if (Object.keys(h).length) { const f = rng.peso(h); if (prev) prev.forma = f; return f.split(',').map(d => top - +d); }
  }
  // regla: las notas del acorde más cercanas por debajo
  const r = [];
  for (let p = top - 1; p >= 43 && r.length < cuantas - 1; p--) if (ac.pcs.includes(mod(p - tonica, 12)) && top - p >= 3 && (!r.length || r[r.length - 1] - p >= 3)) r.push(p);
  return r;
}

// Cuántos pasos de escala hay de una nota a otra (con signo), y mover una nota esos pasos por la escala
function pasosEscala(de, a, enEsc) {
  if (de === a) return 0;
  const dir = a > de ? 1 : -1;
  let n = 0;
  for (let p = de + dir; dir > 0 ? p <= a : p >= a; p += dir) if (enEsc(p)) n += dir;
  return n || dir;   // la melodía fue a una nota cromática: cuenta como un paso
}
function moverEscala(p, pasos, enEsc) {
  if (!pasos) return p;
  const dir = pasos > 0 ? 1 : -1;
  let q = p, falta = Math.abs(pasos);
  for (let k = 0; k < 24 && falta; k++) { q += dir; if (enEsc(q)) falta--; }
  return falta ? null : q;
}

function voces(rng, E, sec, g, top, tex, ev, din, prev) {
  let abajo;
  if (g.dist) {
    // la melodía real trae sus voces. Si la nota cambió, las de abajo hacen lo que hace un coro: acompañan en paralelo
    // por la escala (una tercera sigue siendo tercera, mayor o menor según caiga), y si así chocan, se quedan o van a la
    // nota del acorde más cercana. Si igual no queda ninguna, el acorde se arma de nuevo debajo de la melodía: en el
    // corpus el coro casi nunca se queda solo porque la melodía cambió una nota (26,8 % de unísonos en los gestos reales).
    const de = g.guia ?? top, salto = top - de;
    const esc = escalaSobre(sec.modo, g.ac);
    const choca = p => [1, 2, 10, 11, 13].includes(top - p);
    const enEsc = p => esc.has(mod(p - sec.tonica, 12));
    const pasos = salto ? pasosEscala(de, top, enEsc) : 0;
    abajo = g.dist.map(d => de - d).flatMap(p => {
      if (!salto) return [p];
      const par = moverEscala(p, pasos, enEsc);
      if (par !== null && !choca(par)) return [par];
      if (!choca(p) && enEsc(p)) return [p];
      for (const dd of [-1, 1, -2, 2]) { const c = p + dd; if (g.ac.pcs.includes(mod(c - sec.tonica, 12)) && !choca(c)) return [c]; }
      return [];
    }).filter(p => p >= 43 && p < top);
    abajo = [...new Set(abajo)];
    if (!abajo.length && g.dist.length) abajo = formaBloque(rng, E, sec, g, top, g.dist.length + 1, prev);
  } else abajo = tex >= 2 ? formaBloque(rng, E, sec, g, top, tex, prev) : [];
  if (sec.tipo === 'duo') abajo = abajo.slice(0, 1);
  if (prev) prev.abajo = abajo.length ? abajo : prev.abajo;
  repartir(sec, g, [top, ...abajo], din, ev);
  (sec.golpes ||= []).push({ q: g.q + sec.inicio, d: g.d, top, abajo, din, capela: !sec.bateria, pleno: sec.tipo === 'pleno', acorde: g.ac.pcs.map(p => mod(p + sec.tonica, 12)) });
}

// ── Secciones ──────────────────────────────────────────────────────
function acordesAbs(sec, grados) { return grados.map(g => { const a = acorde(g); return { ...a, raizAbs: mod(sec.tonica + a.raiz, 12) }; }); }

// Tema: planifica las celdas, varía apenas la melodía y canta. Con opc.de repite otro tema (otra estrofa):
// mismos acordes, mismo ritmo, misma melodía con algún cambio, como cuando cambia la letra.
function tema(rng, E, T, sec, ev, opc = {}) {
  const de = opc.de?.memoria;
  const original = de ? de.plan : planTema(rng, opc.celdas, T, sec, opc.usados);
  const din0 = sec.din, curva = sec.curva || 0;
  const unidades = original.length;
  // Acordes cambiados: {índice de medio compás: grado}. La melodía y las voces de esos golpes se adaptan después,
  // sin tocar el azar del resto (así cambiar un acorde no cambia la pieza entera).
  const cambiar = { ...(opc.cambiar || {}) };
  const ult = original[unidades - 1]?.ac || [];
  if (opc.llegada && opc.rngMod && !(unidades * 8 - 1 in cambiar) && TONICA(ult[7]) && TONICA(ult[6]) && DOMINANTE(ult[5]) && opc.rngMod.r() < opc.llegada) {
    const g = sec.modo === 'mayor' ? 'i' : 'I';   // la llegada en el modo contrario: Do menor … G7 → Do mayor
    cambiar[unidades * 8 - 2] = g; cambiar[unidades * 8 - 1] = g;
  }
  const cambiados = new Set(Object.keys(cambiar).map(Number).filter(i => i >= 0 && i < unidades * 8));
  const plan = cambiados.size ? original.map((u, iu) => ({ ...u, ac: u.ac.map((g, c) => (cambiados.has(iu * 8 + c) ? cambiar[iu * 8 + c] : g)) })) : original;
  const rngAlt = new Rng(sec.inicio * 31 + 7);
  const G = [];
  plan.forEach((u, iu) => {
    const acs = acordesAbs(sec, u.ac);
    for (const h of u.g) {
      const q = h[0] + iu * 64;
      if (q < 0) continue;
      const ia = Math.max(0, Math.min(7, Math.floor(h[0] / 8)));
      G.push({ q, d: h[1], u: iu, ac: acs[ia], guia: h[2] + (h[4] ?? u.off), dist: h[3], tex: h[3].length + 1, final: false, rearm: cambiados.has(iu * 8 + ia) });
    }
  });
  G.sort((a, b) => a.q - b.q);
  // lo que se pisa con el golpe siguiente se recorta
  for (let i = G.length - 2; i >= 0; i--) {
    if (G[i + 1].q === G[i].q) { G.splice(i, 1); continue; }
    G[i].d = Math.min(G[i].d, G[i + 1].q - G[i].q);
  }
  G[G.length - 1].final = true;
  G.forEach((g, i) => { const n = G[i + 1]; if (n && n.q - g.q >= 8) g.final = true; });
  // Variación: cada tantas notas cambia una nota débil, como cambia la melodía entre dos versos.
  // Los apoyos no se tocan: lo que sostiene el gesto sigue igual.
  if (!de) {
    let falta = rng.ent(2, VARIA_CADA), sin = 0;
    for (let i = 1; i < G.length - 1; i++) {
      sin++;
      if (--falta > 0) continue;
      const g = G[i];
      // pasadas muchas notas sin cambio se varía igual, salvo un final: ningún pasaje queda largo igual a un tema real
      if (sin >= VARIA_TOPE && !g.final && g.d < 8 && G[i - 1].guia !== g.guia) { g.evitar = g.guia; sin = 0; falta = rng.ent(VARIA_CADA - 3, VARIA_CADA); continue; }
      // un recitado no se toca: repetir la nota es lo que está diciendo
      const recita = G[i - 1].guia === g.guia || G[i + 1].guia === g.guia;
      if (g.d >= 6 || mod(g.q, 8) === 0 || g.final || G[i + 1].q - g.q > 4 || recita) { falta = 1; continue; }
      g.evitar = g.guia;
      sin = 0;
      falta = rng.ent(VARIA_CADA - 3, VARIA_CADA);
    }
  }
  const tops = G.map(g => g.guia);
  const lo = Math.min(MELODIA[0], ...tops), hi = Math.max(MELODIA[1], ...tops);
  // La última unidad de la forma larga vuelve igual a la segunda: sólo se sortea hasta ahí
  const repiteUlt = !de && unidades >= 4 && original[3] === original[1];
  const unicos = repiteUlt ? G.filter(g => g.u < 3) : G;
  const guia = de ? (i => de.notas[i] ?? unicos[i].guia) : (i => unicos[i].guia);
  const sorteadas = melodia(rng, E, sec, unicos, lo, hi, guia, de ? .5 : .75);
  unicos.forEach((g, i) => { g.nota = sorteadas[i]; });
  if (repiteUlt) {
    const mapa = new Map();
    for (const g of unicos) if (g.u === 1) mapa.set(g.q + 128, g.nota);
    for (const g of G) if (g.u === 3) g.nota = mapa.get(g.q) ?? g.guia;
  }
  const notas = G.map(g => g.nota);
  const notaFinal = notas[notas.length - 1];
  // la melodía sobre los acordes cambiados se acomoda; las voces de abajo se arman de nuevo sobre el acorde
  G.forEach((g, i) => { if (g.rearm) notas[i] = ajustar(notas[i], g, sec, notas[i - 1]); });
  const prev = {};
  const compuesto = G.map((g, i) => {
    const din = Math.round(din0 + 8 * Math.sin(Math.PI * mod(g.q, 64) / 64) + (mod(g.q, 8) === 0 ? 5 : 0) + curva * (g.u / Math.max(1, unidades)));
    if (g.rearm) voces(rngAlt, E, sec, { ...g, dist: null }, notas[i], g.tex, ev, din, prev);
    else voces(rng, E, sec, g, notas[i], g.tex, ev, din, prev);
    if (notas[i] !== g.guia) sec.cambiadas = (sec.cambiadas || 0) + 1;
    return { ...g, nota: notas[i] };
  });
  sec.acordes = plan.flatMap(u => u.ac).slice(0, unidades * 8);
  // lo que repiten otras secciones es el tema como era (los acordes cambiados son de esta sección)
  sec.memoria = { plan: original, notas: G.map(g => g.nota) };
  sec.notaFinal = notaFinal;
  if (cambiados.size) sec.cambiados = [...cambiados].sort((a, b) => a - b);
  return compuesto;
}

// Clarinada: un coral lento a capela, con sus sílabas, que se estira al final de cada frase
function clarinada(rng, E, T, sec, ev, usados, celdas, extra = {}) {
  sec.capela = true; sec.densidad = 'amplio'; sec.tipo = 'clarinada';
  const G = tema(rng, E, T, sec, ev, { usados, celdas, ...extra });
  sec.estirar = [];
  // calderón en la nota larga de cada fin de frase
  for (const g of G) if (g.d >= 6 && (g.final || rng.r() < .4)) sec.estirar.push([g.q, g.q + g.d, rng.uni(1.3, 2.2)]);
  return G;
}

// Acorde final de fuerza, a cinco voces, con calderón
function cierre(rng, sec, ev, grado) {
  const ac = acordesAbs(sec, [grado])[0];
  const q = sec.inicio;
  const d = sec.largo;
  const pcs = ac.pcs;
  const elegir = (k, centro) => {
    let mej = null, md = 99;
    for (let p = RANGOS[k][0]; p <= RANGOS[k][1]; p++) if (pcs.includes(mod(p - sec.tonica, 12))) { const x = Math.abs(p - centro); if (x < md) { md = x; mej = p; } }
    return mej;
  };
  const notas = [];
  for (const [k, c] of [['bajos', 48], ['segundos', 55], ['primos', 62], ['sobreprimos', 67], ['tercia', 72]]) {
    const p = elegir(k, c);
    if (p !== null) { ev[k].push([q, d, p, 112, k === 'tercia']); if (k !== 'tercia') notas.push(p); }
  }
  notas.sort((a, b) => b - a);
  (sec.golpes ||= []).push({ q, d, top: notas[0], abajo: notas.slice(1), din: 112, capela: true });
  sec.acordes = [grado];
}

// Remate de la tercia sobre las notas largas: una línea que adorna y baja
function tercia(rng, sec, compuesto, ev, cuanto) {
  const { tonica, modo } = sec;
  for (let i = 0; i < compuesto.length; i++) {
    const g = compuesto[i];
    if (g.d < 6 || rng.r() > cuanto) continue;
    const esc = escalaSobre(modo, g.ac);
    let p = g.nota + 12;
    while (p > RANGOS.tercia[1]) p -= 12;
    if (p < RANGOS.tercia[0]) p += 12;
    const paso = (x, dir) => { let y = x + dir; while (!esc.has(mod(y - tonica, 12))) y += dir; return y; };
    let t = g.q + sec.inicio + 2, fin = g.q + sec.inicio + g.d - 1;
    const din = sec.din - 4;
    let x = paso(p, 1);
    while (t < fin) {
      const dur = t + 2 <= fin ? rng.elegir([1, 1, 2]) : 1;
      if (x >= RANGOS.tercia[0] && x <= RANGOS.tercia[1]) ev.tercia.push([t, dur, x, din, true]);
      t += dur;
      x = paso(x, rng.r() < .65 ? -1 : 1);
    }
  }
}

// ── La pieza ───────────────────────────────────────────────────────
const LOOP_DEFECTO = 6;   // Base de murga: lo que más suena en el corpus

// Para cambiar de tempo, la página corta los loops golpe por golpe: conviene el que queda cerca de su tempo, que suena
// casi como fue grabado. Tempo nativo de cada loop de murga, y cuánto pesa cada uno (la Base de murga es lo que más
// suena en el corpus).
const NATIVO = { 3: 134.2, 4: 85.7, 6: 119.7, 8: 125.5, 9: 112.3 };
const PESO_LOOP = { 3: 1, 4: 1, 6: 3, 8: 1, 9: 1 };

function elegirLoop(rng, E, parte, opcion, tempo) {
  if (opcion) return opcion;
  const h = E.loops?.[parte] || {};
  const f = {};
  for (const k of Object.keys(NATIVO)) {
    const r = Math.log(tempo / NATIVO[k]) / .09;
    f[k] = PESO_LOOP[k] * ((h[k] || 0) + .05) * Math.exp(-r * r);
  }
  return Object.values(f).some(v => v > 1e-6) ? +rng.peso(f) : LOOP_DEFECTO;
}

// Un cambio de tono de los que hace el corpus (herramientas/cambios_de_modo.js): de qué modo a qué modo y a qué
// distancia. Pesan los de la murga elegida y los de todas; los que aparecen una sola vez quedan afuera (pueden ser
// errores del detector). Lo más común es subir un semitono en el mismo modo; cambiar de modo es casi la mitad de los
// cambios, pero casi siempre con otra tónica (de menor al mayor del VI, de mayor al menor del IV).
function modular(rng, estilo, { tonica, modo }) {
  const de = modo === 'mayor' ? 'M' : 'm', todas = MODOS.cambios.todas, propia = estilo !== 'todas' ? MODOS.cambios[estilo] || {} : {};
  const h = {};
  for (const [k, n] of Object.entries(todas)) if (k[0] === de && n >= 2) h[k] = n + 2 * (propia[k] || 0);
  const k = rng.peso(h);
  return { tonica: mod(tonica + +k.slice(2), 12), modo: k[1] === 'M' ? 'mayor' : 'menor' };
}
// El grado, en el tono de la sección, de un acorde dado por su distancia a la tónica (para escribir V7 del tono nuevo)
const GRADO_DE = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];

// Una nota que quedó sobre un acorde nuevo: en los lugares fuertes va a la nota del acorde más cercana, en los
// débiles a la escala que suena sobre él. Lo menos posible, y del lado de la nota anterior.
function ajustar(p, g, sec, antes) {
  const { tonica, modo } = sec, esc = escalaSobre(modo, g.ac);
  const fuerte = fuerza(g) === 'f' || g.final;
  const ok = x => (fuerte ? g.ac.pcs.includes(mod(x - tonica, 12)) : esc.has(mod(x - tonica, 12)));
  if (ok(p)) return p;
  for (let d = 1; d <= 6; d++) {
    const c = [p - d, p + d].filter(ok);
    if (c.length) return c.length === 1 || antes == null ? c[0] : c.sort((a, b) => Math.abs(a - antes) - Math.abs(b - antes))[0];
  }
  return p;
}

export function componer(M, op) {
  // la tercia arranca apagada, como en la página: así el jurado, la copia y las demos miden lo que se escucha por defecto
  const o = { forma: 'presentacion', estilo: 'todas', tonica: 9, modo: 'menor', tempo: null, largo: 'normal', semilla: 1, clarinada: true, modula: true, tercia: 0, cancionFinal: true, recita: 0, ...op };
  const E = M.estilos[o.estilo] || M.estilos.todas;
  const F = E.forma || {};
  const rng = new Rng(o.semilla);
  // los cambios de tono y su preparación se sortean aparte: así no corren el azar de la melodía y las voces
  const rngMod = new Rng(o.semilla * 7919 + 101);
  const ev = Object.fromEntries(CUERDAS.map(k => [k, []]));
  const secs = [];
  const usados = new Set();
  const parte = o.forma === 'retirada' ? 'retirada' : 'presentacion';
  const propias = (M.celdas || []).filter(c => o.estilo === 'todas' || c.e === o.estilo);
  const celdas = { propias, todas: M.celdas || [] };
  // Los tempos: el de la primera parte y el de la última salen del corpus
  const tPri = o.tempo || Math.round(F.tempoPrimero?.[parte] || E.tempo?.[parte]?.p50 || 115);
  const razon = (F.tempoUltimo?.[parte] && F.tempoPrimero?.[parte]) ? Math.max(1, Math.min(1.45, F.tempoUltimo[parte] / F.tempoPrimero[parte])) : 1;
  const tUlt = Math.round(tPri * razon);
  // En los pasajes a capela el tempo es libre y medirlo es poco confiable: va un poco más lento que la batería
  const tCap = Math.round(tPri * .82);
  const loop = elegirLoop(rng, E, parte, o.ritmo, tPri);
  const loopUlt = Math.abs(tUlt - tPri) > 8 ? elegirLoop(rng, E, parte, o.ritmo, tUlt) : loop;
  let ini = 0;
  const T = { mayor: tablaArmonia(M, E, 'mayor'), menor: tablaArmonia(M, E, 'menor') };
  const nueva = s => {
    const sec = { tonica: o.tonica, modo: o.modo, din: 88, bateria: true, loop, tempo: tPri, parte, densidad: 'medio', tipo: 'coro', recita: o.recita, ...s, inicio: ini };
    sec.largo = (sec.compases || 0) * PB;
    secs.push(sec);
    return sec;
  };
  const cerrar = sec => { ini = sec.inicio + sec.largo; };
  const veces = { corta: 1, normal: 2, larga: 3 }[o.largo] || 2;

  // Cuando la batería entra después de un pasaje a capela, entra con su llamada
  const llamada = (l = loop) => {
    const n = o.llamadas?.[l];
    const prev = secs[secs.length - 1];
    if (!n || !prev || prev.bateria || prev.tipo === 'llamada') return;
    cerrar(nueva({ nombre: 'Llamada', tipo: 'llamada', compases: n, bateria: false, loop: l, acordes: [], tonica: prev.tonica, modo: prev.modo }));
  };
  // Acordes que cambian en una sección: los que pide la persona (o.acordes[nombre]) y, si la sección que sigue
  // cambia de tono, a veces el último compás pasa a la dominante del tono nuevo (como en el corpus: 11 % de los
  // cambios; 29 % cuando pasa de mayor al menor de la misma tónica). Si no, a veces la llegada final a la tónica
  // es en el modo contrario.
  const cambiosDe = (s, prepara) => {
    const c = {}, ult = s.compases * 2;
    if (prepara && (prepara.tonica !== s.tonica || prepara.modo !== s.modo)) {
      const p = prepara.tonica === s.tonica && prepara.modo === 'menor' ? MODOS.preparar.aMenorMismoTono.dominante : MODOS.preparar.todos.dominante;
      if (rngMod.r() < p) { const g = GRADO_DE[mod(prepara.tonica + 7 - s.tonica, 12)] + '7'; c[ult - 2] = g; c[ult - 1] = g; s.prepara = g; }
    }
    return { cambiar: { ...c, ...(o.acordes?.[s.nombre] || {}) }, llegada: prepara ? 0 : MODOS.llegadaContraria[s.modo] || 0, rngMod };
  };
  const temaSec = (nombre, compases, cfg = {}) => {
    if (cfg.bateria !== false) llamada(cfg.loop ?? loop);
    const { prepara, ...resto } = cfg;
    const s = nueva({ nombre, compases, ...resto });
    s.notaPrev = secs[secs.length - 2]?.notaFinal ?? null;
    const c = tema(rng, E, T[s.modo], s, ev, { usados, de: cfg.de, celdas, ...cambiosDe(s, prepara) });
    delete s.de;
    if (o.tercia > 0 && cfg.conTercia !== false) tercia(rng, s, c, ev, o.tercia);
    cerrar(s);
    return s;
  };
  const clar = (nombre, cfg = {}) => {
    // el largo sale de cuánto dura en el corpus la entrada a capela
    const seg = cfg.segundos ?? (F.capInicial?.[parte] || 40);
    const porComp = 240 / tCap;
    const compases = Math.max(8, Math.min(16, 8 * Math.round(seg / porComp / 8)));
    const { prepara, ...resto } = cfg;
    const s = nueva({ nombre, compases, bateria: false, din: 96, tempo: tCap, ...resto });
    clarinada(rng, E, T[s.modo], s, ev, usados, celdas, cambiosDe(s, prepara));
    cerrar(s);
    return s;
  };

  if (o.forma === 'retirada') {
    // En el corpus una retirada dura 7,8 min en la mediana sin la canción final, y 11 con ella: lleva una parte más
    // que la presentación (normal: tres partes)
    const partes = { corta: 1, normal: 3, larga: 4 }[o.largo] || 3;
    let tono = { tonica: o.tonica, modo: o.modo };
    // los cambios de tono se deciden antes, para que la sección de antes los pueda preparar
    const t1 = o.modula && partes >= 2 ? modular(rngMod, o.estilo, tono) : tono;
    const t2 = o.modula && rngMod.r() < .5 ? modular(rngMod, o.estilo, t1) : t1;
    if (o.cancionFinal) {
      // en el corpus la canción final va casi siempre con batería (150 a 180 s seguidos), a veces con una entrada corta
      // a capela. Estrofa, estribillo, la estrofa otra vez con el coro y un cierre: una sola vuelta repetida, porque
      // en el corpus el contorno de la melodía se repite poco a cualquier distancia (herramientas/repeticion.mjs)
      const tc = Math.round(tPri * .92);
      const can = temaSec('Canción final', 16, { densidad: 'amplio', din: 82, tipo: 'duo', conTercia: false, tempo: tc });
      if (partes >= 2) temaSec('Canción final, estribillo', 16, { densidad: 'medio', din: 90, tipo: 'pleno', curva: 8, tempo: tc });
      temaSec('Canción final, con el coro', 16, { din: 92, tipo: 'pleno', tempo: tc, de: can });
      if (partes >= 2) temaSec('Canción final, cierre', 16, { densidad: 'medio', din: 98, tipo: 'pleno', curva: 8, tempo: tc });
    }
    if (o.clarinada) clar('Clarinada', tono);
    const pri = temaSec('Primera parte', 16, { densidad: 'medio', din: 88, momento: [0, .6], ...tono });
    temaSec('Primera parte, sigue', 16, { din: 94, tipo: 'pleno', curva: 6, densidad: 'medio', momento: [.1, .7], ...tono, prepara: partes >= 2 ? (o.clarinada ? null : t1) : t2 });
    const NOMBRES = [, , 'Segunda', 'Tercera', 'Cuarta'];
    for (let k = 2; k <= partes; k++) {
      const ult = k === partes, d = 2 * (k - 2), m = .1 * (k - 2);
      // los pasajes a capela del medio duran 16 s en la mediana del corpus: cuatro compases lentos con sus calderones.
      // Las retiradas reales tienen cuatro (con la clarinada y la bajada a capela): van antes de la segunda y la tercera parte
      if (o.clarinada && k <= 3) clar(k === 2 ? 'Clarinada del medio' : 'Clarinada, antes de la tercera parte', { ...tono, compases: 4, segundos: 16, prepara: k === 2 ? t1 : null });
      tono = t1;
      temaSec(`${NOMBRES[k]} parte`, 16, { densidad: 'silabico', din: Math.min(100, 92 + 2 * d), tempo: tUlt, loop: loopUlt, momento: [Math.min(.6, .4 + m), 1], ...tono });
      temaSec(`${NOMBRES[k]} parte, sigue`, 16, { din: Math.min(102, 98 + d), tipo: 'pleno', tempo: tUlt, loop: loopUlt, densidad: 'silabico', momento: [Math.min(.7, .5 + m), 1], ...tono, curva: 6, prepara: ult ? t2 : null });
    }
    tono = t2;
    llamada(8);
    const bajada = nueva({ nombre: 'Bajada', compases: 8, densidad: 'medio', din: 104, tipo: 'pleno', loop: 8, tempo: tUlt, momento: [.78, 1], gancho: true, ...tono });
    const melBajada = tema(rng, E, T[bajada.modo], bajada, ev, { usados, celdas, cambiar: o.acordes?.[bajada.nombre] || {} });
    cerrar(bajada);
    const repetir = (nombre, cfg = {}) => {
      const s = nueva({ ...bajada, nombre, ...cfg, inicio: ini, golpes: [] });
      s.inicio = ini;
      const prev = {};
      const alt = new Rng(s.inicio * 31 + 7);
      for (const g of melBajada) { if (g.rearm) voces(alt, E, s, { ...g, dist: null }, g.nota, Math.max(g.tex, 2), ev, s.din, prev); else voces(rng, E, s, { ...g }, g.nota, Math.max(g.tex, 2), ev, s.din, prev); }
      s.repite = bajada.nombre;
      if (cfg.conTercia) tercia(rng, s, melBajada, ev, .6);
      s.acordes = bajada.acordes;
      cerrar(s);
      return s;
    };
    repetir('Bajada, a capela', { bateria: false, din: 96, conTercia: true });
    repetir('Bajada otra vez', { din: 104 });
    repetir('Bajada, que se va', { din: 102, fade: true });
    repetir('Bajada, que se apaga', { din: 96, fade: true, fadeFinal: true });
  } else {
    if (o.clarinada) clar('Clarinada');
    let tono = { tonica: o.tonica, modo: o.modo };
    const t1 = o.modula && veces >= 2 ? modular(rngMod, o.estilo, tono) : tono;
    const t2 = o.modula && veces >= 3 ? modular(rngMod, o.estilo, t1) : t1;
    const pri = temaSec('Primera parte', 16, { densidad: 'medio', din: 88, momento: [0, .6], ...tono });
    temaSec('Primera parte, sigue', 16, { din: 92, tipo: 'pleno', densidad: 'medio', momento: [.1, .7], ...tono, prepara: t1 });
    if (veces >= 2) {
      tono = t1;
      const seg = temaSec('Segunda parte', 16, { densidad: 'silabico', din: 94, momento: [.3, 1], ...tono });
      temaSec('Segunda parte, sigue', 16, { din: 97, tipo: 'pleno', densidad: 'silabico', momento: [.4, 1], ...tono });
    }
    const est = temaSec('Estribillo', 16, { densidad: 'medio', din: 98, tipo: 'pleno', curva: 8, tempo: tUlt, momento: [.5, 1], ...tono });
    if (veces >= 2) temaSec('Estribillo, con todo', 16, { din: 102, tipo: 'pleno', curva: 8, tempo: tUlt, ...tono, de: est, prepara: t2 });
    if (veces >= 3) {
      tono = t2;
      temaSec('Tercera parte', 16, { densidad: 'silabico', din: 98, tempo: tUlt, momento: [.5, 1], ...tono });
      temaSec('Estribillo final', 16, { din: 104, tipo: 'pleno', curva: 8, tempo: tUlt, ...tono, de: est });
    }
    const f = nueva({ nombre: 'Final', tipo: 'cierre', compases: 2, bateria: false, golpe: true, din: 112, tempo: tUlt, ...tono });
    cierre(rng, f, ev, f.modo === 'mayor' ? 'I' : 'i');
    cerrar(f);
  }
  // La bajada no termina: se va apagando
  for (const s of secs) {
    if (!s.fade) continue;
    for (const k of CUERDAS) for (const e of ev[k]) {
      if (e[0] < s.inicio || e[0] >= s.inicio + s.largo) continue;
      const x = (e[0] - s.inicio) / s.largo;
      e[3] = Math.round(e[3] * (s.fadeFinal ? .62 - .5 * x : 1 - .38 * x));
    }
    for (const h of s.golpes || []) { const x = (h.q - s.inicio) / s.largo; h.din = Math.round(h.din * (s.fadeFinal ? .62 - .5 * x : 1 - .38 * x)); }
  }
  return { opciones: o, secs, ev, total: ini, golpes: secs.flatMap(s => s.golpes || []) };
}
