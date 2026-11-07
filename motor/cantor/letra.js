// letra.js — castellano rioplatense para cantar: sílabas, acentos, sinalefas, fonemas,
// versos a partir de una melodía y el reparto de las sílabas en las notas.
// Sin dependencias: corre igual en Node y en el navegador.

const FUERTES = 'aeoáéíóú';           // las débiles con tilde (í, ú) cuentan como fuertes: hacen hiato
const VOCALES = 'aeiouáéíóúü';
const INSEPARABLES = new Set(['pl', 'pr', 'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'tr', 'kl', 'kr', 'tl']);
// Monosílabos y palabras que se dicen sin acento propio
const ATONAS = new Set(('a al ante con de del desde el en entre hacia hasta la las le les lo los me mi mis nos os para por que ' +
  'se sin so su sus te tu tus un una unos unas y e o u ni pero mas como cuando donde si aunque porque pues tan cual').split(' '));

const quitarTilde = c => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' })[c] || c;
const esVocal = c => VOCALES.includes(c);

// Normaliza: minúsculas, sin signos, números a letras básicos
export function palabras(texto) {
  return texto.toLowerCase()
    .replace(/[“”"«»¿?¡!.,;:()\[\]…\-–—]/g, ' ')
    .split(/\s+/).filter(Boolean)
    .map(w => w.replace(/[^a-záéíóúüñ']/g, '')).filter(Boolean);
}

// Unidades ortográficas de una palabra: digrafos juntos, h muda afuera, qu/gu sin la u
function unidades(w) {
  const u = [];
  for (let i = 0; i < w.length; i++) {
    const c = w[i], n = w[i + 1], nn = w[i + 2];
    if (c === 'c' && n === 'h') { u.push({ t: 'C', s: 'ch' }); i++; continue; }
    if (c === 'l' && n === 'l') { u.push({ t: 'C', s: 'll' }); i++; continue; }
    if (c === 'r' && n === 'r') { u.push({ t: 'C', s: 'rr' }); i++; continue; }
    if ((c === 'q' || c === 'g') && n === 'u' && nn && 'eiéí'.includes(nn)) { u.push({ t: 'C', s: c === 'q' ? 'qu' : 'gu' }); i++; continue; }
    if (c === 'h') continue;                           // muda
    if (c === "'") continue;
    if (c === 'y') {
      // vocal si va sola, al final después de vocal, o entre consonantes; consonante si precede vocal
      const sigVocal = n && esVocal(n);
      if (!sigVocal && (i === w.length - 1 || !n || !esVocal(n))) { u.push({ t: 'V', s: 'y' }); continue; }
      u.push({ t: 'C', s: 'y' }); continue;
    }
    u.push({ t: esVocal(c) ? 'V' : 'C', s: c });
  }
  return u;
}

const debil = s => s === 'i' || s === 'u' || s === 'ü' || s === 'y';

// Sílabas ortográficas de una palabra (arreglo de strings de unidades)
export function silabas(w) {
  const u = unidades(w);
  if (!u.length) return [];
  // núcleos: vocales seguidas que forman diptongo/triptongo
  const nucleos = [];
  for (let i = 0; i < u.length; i++) {
    if (u[i].t !== 'V') continue;
    const prev = nucleos[nucleos.length - 1];
    if (prev && prev.fin === i - 1) {
      const a = u[i - 1].s, b = u[i].s;
      const hiato = (!debil(a) && !debil(b)) || 'íú'.includes(a) || 'íú'.includes(b) || (a === b);
      if (!hiato) { prev.fin = i; continue; }
    }
    nucleos.push({ ini: i, fin: i });
  }
  if (!nucleos.length) return [u.map(x => x.s).join('')];
  // consonantes entre núcleos
  const cortes = [];
  for (let k = 0; k + 1 < nucleos.length; k++) {
    const a = nucleos[k].fin + 1, b = nucleos[k + 1].ini;   // consonantes en [a, b)
    const n = b - a;
    let corte;
    if (n <= 1) corte = a;
    else if (n === 2) corte = INSEPARABLES.has(u[a].s + u[a + 1].s) ? a : a + 1;
    else if (n === 3) corte = INSEPARABLES.has(u[a + 1].s + u[a + 2].s) ? a + 1 : a + 2;
    else corte = a + 2;
    cortes.push(corte);
  }
  const res = [];
  let ini = 0;
  for (const c of cortes) { res.push(u.slice(ini, c)); ini = c; }
  res.push(u.slice(ini));
  return res.map(s => s.map(x => x.s).join(''));
}

// Índice de la sílaba tónica (o -1 si la palabra es átona)
export function tonica(w, sils = silabas(w)) {
  if (sils.length === 1) return ATONAS.has(w) ? -1 : 0;
  if (ATONAS.has(w)) return -1;
  const conTilde = sils.findIndex(s => /[áéíóú]/.test(s));
  if (conTilde >= 0) return conTilde;
  const ult = w[w.length - 1];
  return 'aeiouns'.includes(ult) ? sils.length - 2 : sils.length - 1;
}

// Fonemas de una sílaba. Símbolos: vocales a e i o u; semivocales j w; p t k b d g (B D G suaves),
// f s x (jota) S (sh) Z (ll/y rioplatense) C (ch) m n N (ñ) l r (simple) R (múltiple), h (s aspirada)
function fonemasSilaba(sil, ctx) {
  const f = [];
  const s = sil;
  for (let i = 0; i < s.length; i++) {
    const c = s[i], n = s[i + 1], prev = f[f.length - 1];
    const v = 'aeiouáéíóúü'.includes(c);
    if (c === 'c' && n === 'h') { f.push('C'); i++; continue; }
    if (c === 'l' && n === 'l') { f.push('Z'); i++; continue; }
    if (c === 'r' && n === 'r') { f.push('R'); i++; continue; }
    if (c === 'q' && n === 'u') { f.push('k'); i++; continue; }
    if (c === 'g' && n === 'u' && s[i + 2] && 'eiéí'.includes(s[i + 2])) { f.push('g'); i++; continue; }
    if (v) { f.push(quitarTilde(c)); continue; }
    switch (c) {
      case 'y': f.push(i === s.length - 1 || !n ? 'i' : 'Z'); break;
      case 'c': f.push(n && 'eiéí'.includes(n) ? 's' : 'k'); break;
      case 'z': f.push('s'); break;
      case 'g': f.push(n && 'eiéí'.includes(n) ? 'x' : 'g'); break;
      case 'j': f.push('x'); break;
      case 'v': f.push('b'); break;
      case 'w': f.push('w'); break;
      case 'x': f.push(i === 0 && ctx.inicioPalabra ? 's' : 'k', 's'); break;
      case 'ñ': f.push('N'); break;
      case 'r': f.push((i === 0 && (ctx.inicioPalabra || ctx.trasNLS)) ? 'R' : 'r'); break;
      case 'k': f.push('k'); break;
      case 'h': break;
      default: f.push(c);
    }
  }
  // semivocales: en un grupo de vocales, la débil átona junto a otra vocal es deslizada
  const voc = x => 'aeiou'.includes(x);
  for (let i = 0; i < f.length; i++) {
    if ((f[i] === 'i' || f[i] === 'u') && ((voc(f[i - 1]) && !(f[i - 1] === f[i])) || voc(f[i + 1]))) {
      const tildada = /[íú]/.test(sil);
      if (!tildada) f[i] = f[i] === 'i' ? 'j' : 'w';
    }
  }
  // si quedaron solo semivocales (p. ej. "muy" → m w i), la última es el núcleo
  if (!f.some(voc)) { for (let i = f.length - 1; i >= 0; i--) if (f[i] === 'j' || f[i] === 'w') { f[i] = f[i] === 'j' ? 'i' : 'u'; break; } }
  return f;
}

const VOC = new Set(['a', 'e', 'i', 'o', 'u']);
// Divide fonemas de una sílaba en ataque, núcleo (con semivocales) y coda
export function partes(f) {
  let a = 0; while (a < f.length && !VOC.has(f[a]) && f[a] !== 'j' && f[a] !== 'w') a++;
  let b = f.length; while (b > a && !VOC.has(f[b - 1]) && f[b - 1] !== 'j' && f[b - 1] !== 'w') b--;
  return { ataque: f.slice(0, a), nucleo: f.slice(a, b), coda: f.slice(b) };
}

// Texto de un verso → sílabas cantadas (con sinalefa) con su texto, fonemas y acento
export function silabasCantadas(texto, { sinalefa = true } = {}) {
  const ws = palabras(texto);
  const out = [];
  ws.forEach((w, iw) => {
    const sils = silabas(w), t = tonica(w, sils);
    sils.forEach((s, i) => {
      const prevSil = i > 0 ? sils[i - 1] : (iw > 0 ? silabas(ws[iw - 1]).slice(-1)[0] : '');
      const ctx = { inicioPalabra: i === 0, trasNLS: /[nls]$/.test(prevSil) };
      out.push({ texto: s, palabra: iw, fon: fonemasSilaba(s, ctx), acento: i === t, inicio: i === 0, fin: i === sils.length - 1 });
    });
  });
  // consonantes suaves (b d g entre vocales o tras vocal/l/r) y s aspirada antes de consonante
  const flat = out.flatMap((s, i) => s.fon.map((p, j) => ({ i, j, p })));
  for (let k = 0; k < flat.length; k++) {
    const { i, j, p } = flat[k], ant = flat[k - 1]?.p, sig = flat[k + 1]?.p;
    if ('bdg'.includes(p) && ant && !['m', 'n', 'N'].includes(ant) && !(p === 'd' && ant === 'l')) out[i].fon[j] = p.toUpperCase();
    // (la s antes de consonante se mantiene: aspirada, sintetizada, se oye como un soplido raro)
  }
  if (!sinalefa) return out;
  // sinalefa: fin de palabra en vocal + palabra que empieza en vocal → una sola sílaba cantada
  const res = [];
  for (const s of out) {
    const prev = res[res.length - 1];
    const empiezaVocal = s.inicio && 'aeiouj'.includes(s.fon[0]) && !(s.fon[0] === 'j' && s.texto.startsWith('y') && s.fon.length > 1 && false);
    const terminaVocal = prev && prev.fin && 'aeiouj'.includes(prev.fon[prev.fon.length - 1]);
    if (prev && empiezaVocal && terminaVocal && !(prev.acento && s.acento)) {
      // la vocal átona se hace deslizada si es i/u, si no se juntan las dos vocales en el núcleo
      const pf = prev.fon.map((p, k) => (k === prev.fon.length - 1 && (p === 'i' || p === 'u') && !prev.acento) ? (p === 'i' ? 'j' : 'w') : p);
      const sf = s.fon.map((p, k) => (k === 0 && (p === 'i' || p === 'u') && !s.acento) ? (p === 'i' ? 'j' : 'w') : p);
      const unida = [...pf, ...sf];
      res[res.length - 1] = { texto: prev.texto + '‿' + s.texto, palabra: s.palabra, fon: unida, acento: prev.acento || s.acento, inicio: prev.inicio, fin: s.fin, sinalefa: true };
    } else res.push({ ...s });
  }
  return res;
}

// ── Métrica de la melodía ──────────────────────────────────────────
// golpes: [{q, d}] en semicorcheas (q relativo al compás de 16). Devuelve versos: [{golpes, fuerza[]}]
export function fuerzaGolpe(g, compas = 16) {
  const pos = ((g.q % compas) + compas) % compas;
  let f = pos === 0 ? 3 : pos % 8 === 0 ? 2 : pos % 4 === 0 ? 1 : 0;
  if (g.d >= 8) f += 2; else if (g.d >= 4) f += 1;
  return f;
}

export function versosDe(golpes, { compas = 16 } = {}) {
  const V = [];
  let act = [];
  for (let i = 0; i < golpes.length; i++) {
    const g = golpes[i], sig = golpes[i + 1];
    act.push(g);
    const hueco = sig ? sig.q - (g.q + g.d) : 99;
    if (!sig || hueco >= 3 || (g.d >= 8 && sig.q - g.q >= 8) || act.length >= 14) { V.push(act); act = []; }
  }
  // frases de una o dos notas sueltas: se pegan a la siguiente (levare) o a la anterior (remate)
  for (let i = 0; i < V.length; i++) {
    if (V[i].length > 2 || V.length < 2) continue;
    const sig = V[i + 1], ant = V[i - 1], fin = V[i][V[i].length - 1];
    if (sig && sig[0].q - (fin.q + fin.d) <= 8) { V[i + 1] = V[i].concat(sig); V.splice(i, 1); i--; }
    else if (ant) { V[i - 1] = ant.concat(V[i]); V.splice(i, 1); i--; }
  }
  return V.map(gs => {
    const fuerza = gs.map(g => fuerzaGolpe(g, compas));
    // acento final: la última nota fuerte (si la última es débil y corta, la penúltima: verso llano)
    let fin = gs.length - 1;
    if (gs.length >= 2 && fuerza[fin] < fuerza[fin - 1] && gs[fin].d < 6) fin--;
    const acentos = fuerza.map((f, i) => f >= 2 ? i : -1).filter(i => i >= 0);
    if (!acentos.includes(fin)) acentos.push(fin);
    return { golpes: gs, fuerza, silabas: gs.length, acentoFinal: fin, acentos: acentos.sort((a, b) => a - b), tipo: fin === gs.length - 1 ? 'aguda' : fin === gs.length - 2 ? 'llana' : 'esdrújula' };
  });
}

// ── Reparto de sílabas en notas ────────────────────────────────────
// DP: cada sílaba toma 1 nota, o 2 notas (melisma), o dos sílabas parten una nota (recitado).
// Premia que las sílabas acentuadas caigan en notas fuertes.
export function alinear(sils, golpes) {
  const S = sils.length, N = golpes.length;
  const fz = golpes.map(g => g.f ?? fuerzaGolpe(g));
  const INF = 1e9;
  const D = Array.from({ length: S + 1 }, () => new Float64Array(N + 1).fill(INF));
  const P = Array.from({ length: S + 1 }, () => new Array(N + 1).fill(null));
  D[0][0] = 0;
  const costo1 = (s, n) => { const a = sils[s].acento, f = fz[n]; return a ? (f >= 2 ? 0 : f === 1 ? .6 : 1.4) : (f >= 4 ? .9 : f >= 3 ? .4 : 0); };
  for (let s = 0; s <= S; s++) for (let n = 0; n <= N; n++) {
    const d = D[s][n]; if (d >= INF) continue;
    if (s < S && n < N) { const c = d + costo1(s, n); if (c < D[s + 1][n + 1]) { D[s + 1][n + 1] = c; P[s + 1][n + 1] = 'uno'; } }
    if (s < S && n + 1 < N) { const c = d + 1.2 + costo1(s, n) + (golpes[n].p === golpes[n + 1].p ? .8 : 0); if (c < D[s + 1][n + 2]) { D[s + 1][n + 2] = c; P[s + 1][n + 2] = 'melisma'; } }
    if (s + 1 < S && n < N && golpes[n].d >= 2) { const c = d + 1.0 + costo1(s, n) + (golpes[n].d < 3 ? .8 : 0) + (sils[s + 1].acento ? .7 : 0); if (c < D[s + 2][n + 1]) { D[s + 2][n + 1] = c; P[s + 2][n + 1] = 'parte'; } }
  }
  if (D[S][N] >= INF) return null;
  // reconstruir: devuelve por sílaba la lista de notas [{q, d, p?}] que canta
  const res = [];
  for (let s = S, n = N; s > 0 || n > 0;) {
    const op = P[s][n];
    if (op === 'uno') { res.unshift({ sil: sils[s - 1], notas: [golpes[n - 1]] }); s--; n--; }
    else if (op === 'melisma') { res.unshift({ sil: sils[s - 1], notas: [golpes[n - 2], golpes[n - 1]] }); s--; n -= 2; }
    else if (op === 'parte') {
      const g = golpes[n - 1], d1 = Math.max(1, Math.floor(g.d / 2));
      res.unshift({ sil: sils[s - 1], notas: [{ ...g, q: g.q + d1, d: g.d - d1, parte: true }] });
      res.unshift({ sil: sils[s - 2], notas: [{ ...g, d: d1, parte: true }] });
      s -= 2; n--;
    } else break;
  }
  return { reparto: res, costo: D[S][N] };
}

// Cuántas sílabas cantadas tiene un verso y dónde quedan los acentos (para validar la letra pedida)
export function medir(texto) {
  const s = silabasCantadas(texto);
  return { n: s.length, acentos: s.map((x, i) => x.acento ? i : -1).filter(i => i >= 0), silabas: s.map(x => x.texto) };
}
