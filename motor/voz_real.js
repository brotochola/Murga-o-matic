// El coro de verdad: canta cada golpe de la pieza con un recorte real de ese golpe en una murga.
// Para cada golpe se busca el recorte con el mismo acorde a una altura cercana, se lo afina al centésimo
// (cada recorte trae su afinación medida) y se lo pega en el tiempo. Las sílabas no dicen nada: son las
// consonantes y las vocales que estaban ahí. Los recortes salen de transcripcion/banco.py y no van a git.
const BASE = 'murga_trabajo/banco/';
const mod = (a, n) => ((a % n) + n) % n;
const FIEL = 2;   // cuánto peor puede ser un recorte de la grabación de la frase antes de salir a buscar otro

class Azar {
  constructor(s) { this.a = (s * 7919 + 13) >>> 0; }
  r() { let t = this.a += 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  uni(a, b) { return a + (b - a) * this.r(); }
}

const cache = new Map();

export async function hayBanco() {
  try { const r = await fetch(BASE + 'banco.json'); return r.ok ? await r.json() : null; } catch { return null; }
}

// Baja un banco: un flac con todos los recortes y un índice [inicio, largo, altura, forma, fuente, pureza, nota]
export function cargarBanco(estilo, ctx) {
  if (!cache.has(estilo)) {
    cache.set(estilo, (async () => {
      const [idx, audio] = await Promise.all([
        fetch(BASE + estilo + '.json').then(r => { if (!r.ok) throw new Error('no está el banco de ' + estilo); return r.json(); }),
        fetch(BASE + estilo + '.flac').then(r => { if (!r.ok) throw new Error('no está el audio de ' + estilo); return r.arrayBuffer(); }).then(b => ctx.decodeAudioData(b)),
      ]);
      const x = audio.getChannelData(0);
      const porNota = new Map();
      const r = idx.r.map(([i, n, p, d, s, pur, nota, bat], k) => {
        const pcs = new Set([0, ...d.map(v => mod(v, 12))]);
        const o = { id: estilo + k, i, n, p, d, s: estilo + s, pur, pcs, x, bat };
        if (!porNota.has(nota)) porNota.set(nota, []);
        porNota.get(nota).push(o);
        return o;
      });
      return { sr: idx.sr, antes: idx.antes, r, porNota };
    })().catch(e => { cache.delete(estilo); throw e; }));
  }
  return cache.get(estilo);
}

// Lo que importa no es que el recorte traiga las mismas voces, sino que no traiga una nota ajena a la armonía.
function costoForma(rec, pcs, h) {
  let c = 0;
  for (const p of rec.pcs) {
    if (pcs.has(p)) continue;
    const enAcorde = h.acorde?.includes(mod(h.top - p, 12));
    c += enAcorde ? .5 : 3.6;                           // otra nota del acorde suena bien; una ajena lo desafina
  }
  for (const p of pcs) if (!rec.pcs.has(p)) c += .8;    // una de menos sólo lo adelgaza
  return c;
}

// Cuánto le cuesta a un recorte cantar un golpe: altura, acorde, largo y limpieza
function costo(B, r, h, pcs, durSeg) {
  const sh = Math.abs(r.p - h.top);
  // transponer mucho cambia las vocales: sólo si no queda otra
  let c = sh <= 1 ? sh * .5 : sh <= 3 ? .5 + (sh - 1) * 1.3 : 3.1 + (sh - 3) * 3;
  c += costoForma(r, pcs, h);
  const disp = (r.n / B.sr - B.antes) * Math.pow(2, (r.p - h.top) / 12);
  c += disp < durSeg ? Math.min(4, (durSeg - disp) * 3.5) : Math.min(.9, (disp / durSeg - 1) * .22);
  if (h.capela && r.bat) c += 1.4;   // a capela no puede colarse el bombo
  return c + (1 - r.pur) * 1.5;
}

const pcsDe = h => new Set([0, ...h.abajo.map(p => mod(h.top - p, 12))]);
function* cercanos(B, top) { for (let n = top - 5; n <= top + 5; n++) yield* (B.porNota.get(n) || []); }

function elegir(B, h, durSeg, ctx, rng) {
  const pcs = pcsDe(h);
  let mej = null, cm = Infinity;
  for (const r of cercanos(B, h.top)) {
    let c = costo(B, r, h, pcs, durSeg);
    if (ctx.src === r.s) c -= FIEL;
    c += (ctx.usos.get(r.id) || 0) * 1.3 + rng.r() * .5;
    if (c < cm) { cm = c; mej = r; }
  }
  return mej;
}

// Una frase se canta con una sola grabación: la que mejor cubre todos sus golpes.
// Un coro no cambia de sala en medio de una frase.
function fuenteDe(B, frase, ctx, rng) {
  const total = new Map();
  for (const [h, dur] of frase) {
    const pcs = pcsDe(h), mejor = new Map();
    for (const r of cercanos(B, h.top)) {
      const c = costo(B, r, h, pcs, dur) + (ctx.usos.get(r.id) || 0) * 1.3;
      if (!mejor.has(r.s) || c < mejor.get(r.s)) mejor.set(r.s, c);
    }
    for (const [s, c] of mejor) { const t = total.get(s) || [0, 0]; t[0] += c; t[1]++; total.set(s, t); }
  }
  let mej = null, cm = Infinity;
  for (const [s, [c, n]] of total) {
    // lo que la fuente no cubre pesa como un recorte malo
    const v = (c + (frase.length - n) * 8) / frase.length + rng.r() * .3 + (s === ctx.anterior ? -.4 : 0);
    if (v < cm) { cm = v; mej = s; }
  }
  return mej;
}

const hann = k => .5 - .5 * Math.cos(2 * Math.PI * k);

// Pega un recorte en L y R: lee a la velocidad que lo afina, corta o sostiene hasta dur
function pegar(L, R, SR, B, r, top, t0, dur, g, gl, gr, rng, cola = .03) {
  const rate = Math.pow(2, (top - r.p) / 12) * (B.sr / SR);
  const antes = Math.round(B.antes / rate * B.sr * (SR / B.sr));
  const x = r.x, ini = r.i, fin = r.i + r.n - 2;
  const lee = pos => { const j = Math.floor(pos), f = pos - j; return x[j] + (x[j + 1] - x[j]) * f; };
  const i0 = Math.round(t0 * SR) - antes;
  const total = antes + Math.round(dur * SR);
  const caida = Math.round(cola * SR);   // antes de una respiración la nota se apaga en la sala
  const len = L.length;
  // parte directa: hasta donde alcance el recorte
  const directo = Math.min(total + caida, Math.floor((fin - ini) / rate));
  const finDir = directo;
  const larga = total + caida > directo;
  // Si hay que sostener, el recorte se funde con las ventanas a lo largo de una ventana entera
  const W = Math.round(.2 * SR), H = W >> 2;
  const xf = Math.min(W, directo >> 1);
  for (let s = 0; s < directo; s++) {
    const o = i0 + s;
    if (o < 0 || o >= len) continue;
    let e = 1;
    if (larga) { if (s > finDir - xf) e = (finDir - s) / xf; } else if (s > directo - caida) e = (directo - s) / caida;
    const v = lee(ini + s * rate) * g * e;
    L[o] += v * gl; R[o] += v * gr;
  }
  if (!larga) return;
  // sostener: ventanas tomadas de la parte estable del recorte, con posiciones al azar
  const z0 = ini + Math.round(.1 * B.sr), z1 = fin - Math.round(.06 * B.sr);
  const hueco = z1 - z0 - W * rate;
  if (hueco < 0) return;
  const norm = .5;   // ventanas de Hann a un cuarto: suman 2; se compensa
  for (let s = finDir - W; s < total; s += H) {
    const p0 = z0 + rng.r() * hueco;
    const quedan = total + caida - s;
    for (let k = 0; k < W; k++) {
      const o = i0 + s + k;
      if (o < 0 || o >= len) continue;
      let e = hann(k / W) * norm;
      if (s + k > total) e *= Math.max(0, (total + caida - s - k) / caida);
      if (k > quedan) break;
      const v = lee(p0 + k * rate) * g * e;
      L[o] += v * gl; R[o] += v * gr;
    }
  }
}

// golpes: [{q, d, top, abajo, din}]; T: de semicorcheas a segundos
export function cantar(golpes, T, total, bancos, semilla, SR) {
  const len = Math.ceil(total * SR);
  const L = new Float32Array(len), R = new Float32Array(len);
  const rng = new Azar(semilla);
  const ctx = { src: null, usos: new Map(), datos: { golpes: 0, igual: 0, salto: 0, corto: 0 } };
  const orden = [...golpes].sort((a, b) => a.q - b.q);
  let faltan = 0;
  const durDe = i => { const t0 = T(orden[i].q), sig = orden[i + 1]; return Math.min(T(orden[i].q + orden[i].d), sig ? T(sig.q) : t0 + 3) - t0; };
  let finFrase = -1;
  orden.forEach((h, i) => {
    const t0 = T(h.q);
    const dur = durDe(i);
    // Cada frase, de un banco y de una grabación
    if (i > finFrase) {
      let j = i;
      while (j + 1 < orden.length && orden[j + 1].q - orden[j].q - orden[j].d < 3 && j - i < 24) j++;
      finFrase = j;
      ctx.banco = bancos[Math.floor(rng.r() * bancos.length)];
      const frase = []; for (let x = i; x <= j; x++) frase.push([orden[x], durDe(x)]);
      ctx.anterior = ctx.src;
      ctx.src = fuenteDe(ctx.banco, frase, ctx, rng);
    }
    const B = ctx.banco;
    const fuenteFrase = ctx.src;
    const r = elegir(B, h, dur, ctx, rng);
    if (!r) { faltan++; return; }
    if (fuenteFrase !== r.s) ctx.datos.fueraDeFuente = (ctx.datos.fueraDeFuente || 0) + 1;
    ctx.usos.set(r.id, (ctx.usos.get(r.id) || 0) + 1);
    const pcsH = pcsDe(h);
    ctx.datos.golpes++;
    if (costoForma(r, pcsH, h) === 0) ctx.datos.igual++;
    for (const p of r.pcs) if (!pcsH.has(p) && !h.acorde?.includes(mod(h.top - p, 12))) { ctx.datos.ajenas = (ctx.datos.ajenas || 0) + 1; break; }
    ctx.datos.salto += Math.abs(r.p - h.top);
    if ((r.n / B.sr - B.antes) * Math.pow(2, (r.p - h.top) / 12) < dur) ctx.datos.corto++;
    const g = Math.pow(h.din / 100, 1.7) * rng.uni(.92, 1.05);
    const pan = rng.uni(-.1, .1);
    const sigH = orden[i + 1];
    const cola = Math.max(.03, Math.min(.26, (sigH ? T(sigH.q) : t0 + dur + 1) - t0 - dur));
    pegar(L, R, SR, B, r, h.top, t0, dur, g, Math.cos((pan + 1) * Math.PI / 4) * 1.41, Math.sin((pan + 1) * Math.PI / 4) * 1.41, rng, cola);
    // Coro pleno: en las notas largas, otra toma del mismo golpe a los costados. En lo silábico no:
    // ahí se sumarían dos palabras distintas y se borra todo; en una vocal larga se suman las voces.
    if (h.pleno && dur > .4) {
      ctx.usos.set(r.id, (ctx.usos.get(r.id) || 0) + 4);
      const r2 = elegir(B, h, dur, ctx, rng);
      if (r2 && r2 !== r) {
        ctx.usos.set(r2.id, (ctx.usos.get(r2.id) || 0) + 1);
        const lado = rng.r() < .5 ? -.55 : .55;
        pegar(L, R, SR, B, r2, h.top, t0 + rng.uni(.008, .03), dur, g * .72, Math.cos((lado + 1) * Math.PI / 4) * 1.41, Math.sin((lado + 1) * Math.PI / 4) * 1.41, rng, cola);
      }
      ctx.usos.set(r.id, ctx.usos.get(r.id) - 4);
    }
  });
  // lo que queda debajo del coro es bombo que se coló en la separación
  pasaAltos(L, SR, 115); pasaAltos(R, SR, 115);
  estanteGrave(L, SR, 230, -4.5); estanteGrave(R, SR, 230, -4.5);
  // ancho: una copia apenas corrida en cada lado, como dos filas de cantores
  const a = Math.round(.0137 * SR), b = Math.round(.0211 * SR);
  for (let i = len - 1; i >= b; i--) { L[i] += .3 * L[i - a]; R[i] += .3 * R[i - b]; }
  return { L, R, faltan, datos: ctx.datos };
}

// Filtro de estante grave (RBJ): baja lo que queda debajo de fc
function estanteGrave(x, SR, fc, db) {
  const A = Math.pow(10, db / 40), w = 2 * Math.PI * fc / SR, cw = Math.cos(w), al = Math.sin(w) / Math.SQRT2, ra = 2 * Math.sqrt(A) * al;
  const a0 = (A + 1) + (A - 1) * cw + ra;
  const b0 = A * ((A + 1) - (A - 1) * cw + ra) / a0, b1 = 2 * A * ((A - 1) - (A + 1) * cw) / a0, b2 = A * ((A + 1) - (A - 1) * cw - ra) / a0;
  const a1 = -2 * ((A - 1) + (A + 1) * cw) / a0, a2 = ((A + 1) + (A - 1) * cw - ra) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y;
  }
}

function pasaAltos(x, SR, fc) {
  const w = Math.tan(Math.PI * fc / SR), q = Math.SQRT1_2, n = 1 / (1 + w / q + w * w);
  const a0 = n, a1 = -2 * n, a2 = n, b1 = 2 * (w * w - 1) * n, b2 = (1 - w / q + w * w) * n;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i], y = a0 * v + a1 * x1 + a2 * x2 - b1 * y1 - b2 * y2;
    x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y;
  }
}
