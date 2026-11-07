// Paso 6: saca de cada MIDI lo que una murga no cantaría, y deja dicho por qué.
// Las notas llegan con b y fin en pulsos, de la grilla del coro.
//
// Criterio: sacar poco y con motivo. Un cromatismo con sentido se queda (nota de paso, sensible,
// dominante secundaria); se va lo que no tiene apoyo en nada de lo que suena alrededor.

export const MOTIVOS = {
  trabado: 'el transcriptor repite un acorde a máquina: suele ser recitado o aplausos',
  registro: 'fuera del registro del coro',
  fantasma: 'demasiado corta para ser una sílaba',
  eterna: 'una nota que dura más de lo que respira un coro',
  aislada: 'sola, lejos de todo lo que suena',
  choque: 'choca a un semitono con una voz más firme',
  extrana: 'no pertenece a nada de lo que suena alrededor',
};

const REG_MIN = 41, REG_MAX = 79, MIN_SEG = .07, MAX_SEG = 13;

// Trabas: cuando el modelo no entiende el audio (recitado, un pasaje casi inaudible) repite el mismo acorde
// a tiempo fijo, a veces 140 veces seguidas. Una línea silábica real sobre un acorde dura 2 o 3 segundos,
// unos 10 golpes, y tiene ritmo: lo que delata a la traba es la racha larga y el tiempo mecánico.
const MAX_VOCES = 9, RACHA_GOLPES = 15, RACHA_MUY_LARGA = 30, RACHA_SEG = 5, MECANICO = .35;

export function rachas(notas) {
  const orden = [...notas].sort((a, b) => a.t - b.t);
  const G = [];
  for (const n of orden) {
    const g = G[G.length - 1];
    if (g && n.t - g.t < .02) g.ns.push(n);
    else G.push({ t: n.t, ns: [n] });
  }
  for (const g of G) g.k = [...new Set(g.ns.map(n => n.p))].sort((a, b) => a - b).join(',');
  const R = [];
  for (let i = 0; i < G.length;) {
    let j = i;
    while (j + 1 < G.length && G[j + 1].k === G[i].k && G[j + 1].t - G[j].t < 1.2) j++;
    const L = j - i + 1;
    if (L >= 6) {
      const d = [];
      for (let x = i + 1; x <= j; x++) d.push(G[x].t - G[x - 1].t);
      const m = d.reduce((a, b) => a + b, 0) / d.length;
      const cv = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / d.length) / m;
      R.push({ t: G[i].t, L, seg: G[j].t - G[i].t, cv, k: G[i].k, ns: G.slice(i, j + 1).flatMap(g => g.ns) });
    }
    i = j + 1;
  }
  return R;
}

export function trabas(notas) {
  const malas = new Set();
  for (const r of rachas(notas)) {
    const larga = r.L >= RACHA_GOLPES || r.seg >= RACHA_SEG;
    if (r.L >= RACHA_MUY_LARGA || (larga && r.cv < MECANICO)) for (const n of r.ns) malas.add(n);
  }
  // Un pedazo de 5 segundos donde suenan más notas de las que canta un coro es un pedazo roto del transcriptor
  // (en los tramos sanos nunca hay más de 6 notas abiertas): se va entero.
  {
    const porPedazo = new Map();
    for (const n of notas) { const c = Math.floor(n.t / 5); if (!porPedazo.has(c)) porPedazo.set(c, []); porPedazo.get(c).push(n); }
    for (const [c, ns] of porPedazo) {
      let tope = 0;
      for (const a of ns) { let v = 0; for (const b of ns) if (b.t <= a.t + .02 && b.tf > a.t + .02) v++; if (v > tope) tope = v; }
      if (tope >= MAX_VOCES) { for (const n of notas) if (n.tf > c * 5 && n.t < c * 5 + 5) malas.add(n); }
    }
  }
  // Un pasaje casi todo trabado es recitado: lo poco que queda ahí tampoco es canto
  // (se compara siempre con las trabas originales: si no, la marca se contagia hasta el final del tramo)
  const todas = new Set(malas);
  if (malas.size) {
    const orden = [...notas].sort((a, b) => a.t - b.t);
    const tTotal = orden[orden.length - 1].t;
    for (let t = 0; t < tTotal; t += 2) {
      const v = orden.filter(n => n.t >= t && n.t < t + 10);
      if (v.length >= 8 && v.filter(n => malas.has(n)).length >= .5 * v.length) for (const n of v) todas.add(n);
    }
  }
  return todas;
}

export function limpiar(notas) {
  const N = notas.map((n, i) => ({ ...n, i, motivo: null }));
  const porTiempo = [...N].sort((a, b) => a.b - b.b);

  for (const n of trabas(N)) n.motivo = 'trabado';
  for (const n of N) {
    if (n.motivo) continue;
    if (n.p < REG_MIN || n.p > REG_MAX) n.motivo = 'registro';
    else if (n.tf - n.t < MIN_SEG) n.motivo = 'fantasma';
    else if (n.tf - n.t > MAX_SEG) n.motivo = 'eterna';
  }

  // Vecinas en tiempo (ventana móvil)
  const vivas = () => porTiempo.filter(n => !n.motivo);
  const cerca = (lista, x, antes, despues) => {
    let lo = 0, hi = lista.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (lista[m].b < x.b - antes) lo = m + 1; else hi = m; }
    const r = [];
    for (let i = lo; i < lista.length && lista[i].b <= x.fin + despues; i++) if (lista[i] !== x) r.push(lista[i]);
    return r;
  };

  // Aislada: nadie a menos de una quinta en el pulso de alrededor
  let V = vivas();
  for (const n of V) {
    const dur = n.fin - n.b;
    if (dur >= 1.5) continue;
    const c = cerca(V, n, 1, 1);
    if (!c.some(o => Math.abs(o.p - n.p) <= 7)) n.motivo = 'aislada';
  }

  // Choque: dos voces a un semitono (o séptima mayor, novena menor) que suenan juntas buena parte del tiempo
  V = vivas();
  for (const n of V) {
    if (n.motivo) continue;
    for (const o of cerca(V, n, 4, 0)) {
      if (o.motivo) continue;
      const iv = Math.abs(o.p - n.p);
      if (iv !== 1 && iv !== 11 && iv !== 13) continue;
      const juntas = Math.min(n.fin, o.fin) - Math.max(n.b, o.b);
      const corta = Math.min(n.fin - n.b, o.fin - o.b);
      if (juntas < .5 * corta || juntas < .25) continue;
      const debil = (n.fin - n.b) <= (o.fin - o.b) ? n : o;
      debil.motivo = 'choque';
      if (debil === n) break;
    }
  }

  // Extraña: su nota casi no aparece en los dos compases de alrededor, y no es nota de paso
  V = vivas();
  for (const n of V) {
    const dur = n.fin - n.b;
    if (dur >= 1) continue;
    const c = cerca(V, n, 8, 8);
    const pc = ((n.p % 12) + 12) % 12;
    let tot = 0, misma = 0;
    for (const o of c) {
      const d = o.fin - o.b;
      tot += d;
      if (o.p % 12 === pc) misma += d;
    }
    if (tot < 2) continue;
    const paso = c.some(o => Math.abs(o.b - n.fin) < .4 && Math.abs(o.p - n.p) <= 2) && c.some(o => Math.abs(o.fin - n.b) < .4 && Math.abs(o.p - n.p) <= 2);
    if (misma / tot < .025 && !paso) n.motivo = 'extrana';
  }

  const quitadas = N.filter(n => n.motivo);
  const cuenta = {};
  for (const n of quitadas) cuenta[n.motivo] = (cuenta[n.motivo] || 0) + 1;
  return { limpias: N.filter(n => !n.motivo), quitadas, cuenta, indices: new Set(quitadas.map(n => n.i)) };
}
