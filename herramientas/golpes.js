// De notas sueltas a lo que canta el coro: golpes (sílabas en bloque) sobre una grilla de semicorcheas,
// y las líneas que los atraviesan.

// El retardo sistemático de los ataques respecto de la grilla (en semicorcheas), con la media circular.
export function retardo(notas) {
  let s = 0, c = 0;
  for (const n of notas) { const a = 2 * Math.PI * (n.b * 4); s += Math.sin(a); c += Math.cos(a); }
  const fase = Math.atan2(s, c) / (2 * Math.PI);
  const ajuste = Math.hypot(s, c) / Math.max(1, notas.length);  // 1 = todo clavado en la grilla, 0 = al azar
  return { fase, ajuste };
}

// Agrupa los ataques en golpes: q es la semicorchea, d cuánto dura, ps las notas de grave a agudo.
export function golpes(notas) {
  const { fase, ajuste } = retardo(notas);
  const mapa = new Map();
  for (const n of notas) {
    const q = Math.round(n.b * 4 - fase);
    const qf = Math.max(q + 1, Math.round(n.fin * 4 - fase));
    if (!mapa.has(q)) mapa.set(q, []);
    mapa.get(q).push({ p: n.p, q, qf, t: n.t, tf: n.tf });
  }
  const G = [...mapa.entries()].sort((a, b) => a[0] - b[0]).map(([q, ns]) => {
    const unicas = [...new Map(ns.map(n => [n.p, n])).values()].sort((a, b) => a.p - b.p);
    return { q, ns: unicas, ps: unicas.map(n => n.p), d: Math.max(...unicas.map(n => n.qf - q)) };
  });
  // Un ataque suelto que cae a una semicorchea de un golpe grande es el mismo golpe, cantado apenas corrido
  for (let i = 1; i < G.length; i++) {
    const a = G[i - 1], b = G[i];
    if (b.q - a.q !== 1) continue;
    const [chico, grande] = b.ps.length < a.ps.length ? [b, a] : [a, b];
    if (chico.ps.length === 1 && grande.ps.length >= 2 && !grande.ps.includes(chico.ps[0])) {
      const n = chico.ns[0];
      grande.ns.push({ ...n, q: grande.q });
      grande.ns.sort((x, y) => x.p - y.p);
      grande.ps = grande.ns.map(x => x.p);
      grande.d = Math.max(grande.d, n.qf - grande.q);
      chico.borrar = true;
    }
  }
  return { G: G.filter(g => !g.borrar), fase, ajuste };
}

// Hasta K líneas que no se cruzan: cada golpe reparte sus notas para moverse lo menos posible.
export function lineas(G, K = 4, centros = [50, 57, 63, 69]) {
  const previo = [...centros];
  const combos = (m, n) => {
    const r = [], a = [];
    const f = (i) => { if (a.length === m) { r.push([...a]); return; } for (let j = i; j < n; j++) { a.push(j); f(j + 1); a.pop(); } };
    f(0);
    return r;
  };
  const CACHE = {};
  for (const g of G) {
    const ps = g.ps.length > K ? [g.ps[0], ...g.ps.slice(-K + 1)] : g.ps;
    const c = CACHE[ps.length] ||= combos(ps.length, K);
    let mej = null, cm = Infinity;
    for (const op of c) {
      let s = 0;
      op.forEach((l, i) => { s += Math.abs(ps[i] - previo[l]) + .15 * Math.abs(ps[i] - centros[l]); });
      if (s < cm) { cm = s; mej = op; }
    }
    g.lin = new Array(K).fill(null);
    mej.forEach((l, i) => { g.lin[l] = ps[i]; previo[l] = previo[l] * .3 + ps[i] * .7; });
  }
  return G;
}
