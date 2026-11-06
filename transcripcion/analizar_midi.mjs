// analizar_midi.mjs — MIDIs de MuScriptor (voces + batería) → estadísticas murgueras
// Uso: node analizar_midi.mjs carpeta_o_archivos.mid ... [--salida analisis]
// Si junto a los .mid hay un indice.json (lo arma murga_lote.py), toma de ahí murga/año/parte.
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import pkg from "@tonejs/midi";
const { Midi } = pkg;

const args = process.argv.slice(2);
const iSal = args.indexOf("--salida");
const SAL = iSal >= 0 ? args.splice(iSal, 2)[1] : "analisis";
const archivos = args.flatMap(a => statSync(a).isDirectory() ? readdirSync(a).filter(f => f.endsWith(".mid")).map(f => join(a, f)) : [a]).sort();
if (!archivos.length) { console.error("Uso: node analizar_midi.mjs carpeta|archivo.mid ... [--salida dir]"); process.exit(1); }
mkdirSync(SAL, { recursive: true });

// ───────── utilidades ─────────
const NOMBRES = ["Do", "Do#", "Re", "Mib", "Mi", "Fa", "Fa#", "Sol", "Lab", "La", "Sib", "Si"];
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] };
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))] };
const hist = arr => arr.reduce((h, k) => (h[k] = (h[k] || 0) + 1, h), {});
const top = (h, n = 15) => Object.fromEntries(Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, n));
const normaliza = h => { const t = Object.values(h).reduce((s, v) => s + v, 0) || 1; return Object.fromEntries(Object.entries(h).map(([k, v]) => [k, +(v / t).toFixed(3)])) };
const sumar = (a, b) => { for (const [k, v] of Object.entries(b || {})) a[k] = (a[k] || 0) + v; return a };

const KMAY = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], KMEN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const corr = (a, b) => { const ma = a.reduce((s, v) => s + v) / 12, mb = b.reduce((s, v) => s + v) / 12; let n = 0, da = 0, db = 0; for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2 } return n / Math.sqrt(da * db || 1) };
function tonalidad(ch) {
  let best = { r: -2 };
  for (let t = 0; t < 12; t++) for (const [modo, perfil] of [["mayor", KMAY], ["menor", KMEN]]) {
    const r = corr(ch, perfil.map((_, i) => perfil[(i - t + 12) % 12]));
    if (r > best.r) best = { t, modo, r };
  }
  return { ...best, nombre: `${NOMBRES[best.t]} ${best.modo}`, r: +best.r.toFixed(2) };
}
const PLANT = [];
for (let r = 0; r < 12; r++) for (const [q, iv] of [["", [0, 4, 7]], ["m", [0, 3, 7]], ["7", [0, 4, 7, 10]], ["dim", [0, 3, 6]]]) PLANT.push({ r, q, pcs: iv.map(i => (r + i) % 12) });
function acorde(ch) {
  const tot = ch.reduce((s, v) => s + v, 0); if (tot <= 0) return null;
  let best = null;
  for (const p of PLANT) {
    const dentro = p.pcs.reduce((s, c) => s + ch[c], 0), fuera = tot - dentro;
    const s = dentro / tot - .5 * fuera / tot - (p.q === "7" ? .12 : p.q === "dim" ? .1 : 0) + .04 * ch[p.r] / tot;
    if (!best || s > best.s) best = { ...p, s };
  }
  return best.s > .35 ? best : null;
}
const GRADOS = ["I", "bII", "II", "bIII", "III", "IV", "#IV", "V", "bVI", "VI", "bVII", "VII"];
const romano = (ac, key) => { let rn = GRADOS[(ac.r - key.t + 12) % 12]; if (ac.q === "m" || ac.q === "dim") rn = rn.replace(/[IV]+/, x => x.toLowerCase()); return rn + (ac.q === "7" ? "7" : ac.q === "dim" ? "°" : "") };

// cuerdas de murga (centros en MIDI, de Sin Disfraz / Higuera / generador)
const CUERDAS = [["tercia", 71], ["sobreprimos", 68], ["primos", 62], ["segundos", 56], ["bajos", 49]];
const BATERIA = { bombo: [35, 36, 41, 43], redoblante: [37, 38, 39, 40], platillo: [49, 51, 52, 53, 55, 57, 59, 42, 44, 46] };
const instrPerc = p => Object.keys(BATERIA).find(k => BATERIA[k].includes(p)) || "otro";

// ───────── un archivo ─────────
function analizar(path, meta) {
  const m = new Midi(readFileSync(path));
  const H = m.header, ppq = H.ppq, durTot = m.duration;
  const voz = [], perc = [];
  for (const tr of m.tracks) for (const n of tr.notes) {
    const o = { t: n.time, d: n.duration, p: n.midi, v: n.velocity, pista: tr.name || String(tr.instrument.number) };
    (tr.instrument.percussion || tr.channel === 9 ? perc : voz).push(o);
  }
  // pulsos (negras) del mapa de tempo, y compases de las indicaciones de compás
  const beats = []; for (let k = 0; ; k++) { const t = H.ticksToSeconds(k * ppq); beats.push(t); if (t > durTot + 1) break }
  const ts = H.timeSignatures.length ? H.timeSignatures : [{ ticks: 0, timeSignature: [4, 4] }];
  const compases = []; // en pulsos (negras)
  ts.forEach((s, i) => {
    const b0 = s.ticks / ppq, b1 = i + 1 < ts.length ? ts[i + 1].ticks / ppq : beats.length, largo = s.timeSignature[0] * 4 / s.timeSignature[1];
    for (let b = b0; b < b1 - 1e-6; b += largo) compases.push({ b, largo });
  });
  const enPulsos = t => { // segundos → pulsos (interpola)
    let lo = 0, hi = beats.length - 1; if (t <= beats[0]) return 0;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (beats[mid] <= t) lo = mid; else hi = mid }
    return lo + (t - beats[lo]) / ((beats[hi] - beats[lo]) || 1);
  };
  const enCompas = b => { // pulsos → {compás, semicorchea dentro del compás, semicorcheas por compás}
    let lo = 0, hi = compases.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (compases[mid].b <= b) lo = mid; else hi = mid }
    const c = compases[hi].b <= b ? hi : lo, C = compases[c] || { b: 0, largo: 4 };
    const largo16 = Math.round(C.largo * 4);
    return { c, s16: Math.min(largo16 - 1, Math.max(0, Math.round((b - C.b) * 4))), largo16 };
  };
  const notas = voz.filter(n => n.d >= .06 && n.p >= 36 && n.p <= 88).sort((a, b) => a.t - b.t || b.p - a.p)
    .map(n => { const b0 = enPulsos(n.t), b1 = enPulsos(n.t + n.d); return { ...n, b0, b1, q0: Math.round(b0 * 4), q1: Math.max(Math.round(b0 * 4) + 1, Math.round(b1 * 4)) } });
  const golpes = perc.map(n => ({ ...n, b0: enPulsos(n.t), inst: instrPerc(n.p) }));

  // ── bloques: cortes donde el coro calla más de 2 s
  const bloques = []; let cur = null, finCur = 0;
  for (const n of notas) {
    if (!cur || n.t - finCur > 2) { cur = { notas: [] }; bloques.push(cur); finCur = 0 }
    cur.notas.push(n); finCur = Math.max(finCur, n.t + n.d);
  }
  // ── además, cortar donde la batería entra o se va (≥ 4 s de cada lado): separa clarinadas y tramos a capela
  const conBat = t => golpes.filter(g => g.t >= t - 1.5 && g.t < t + 1.5).length >= 4;
  const trozos = [];
  for (const B of bloques) {
    const t0 = B.notas[0].t, t1 = Math.max(...B.notas.map(n => n.t + n.d));
    const cortes = []; let estado = conBat(t0 + 1);
    for (let t = t0 + 1; t < t1 - 1; t += .5) { const e = conBat(t); if (e !== estado) { cortes.push(t); estado = e } }
    const lim = [t0, ...cortes, t1 + 1].filter((t, i, a) => i === 0 || i === a.length - 1 || (t - a[i - 1] >= 4 && a[i + 1] - t >= 4));
    for (let i = 0; i + 1 < lim.length; i++) { const ns = B.notas.filter(n => n.t >= lim[i] && n.t < lim[i + 1]); if (ns.length) trozos.push(ns) }
  }
  const resBloques = trozos.map((ns, i) => analizarBloque(ns, golpes, beats, enCompas, i, compases)).filter(Boolean);
  const coros = resBloques.filter(b => b.tipo !== "solista/hablado");
  return {
    archivo: basename(path), ...meta, duracion_s: +durTot.toFixed(1),
    tempo_bpm: +(60 / median(beats.slice(1, -1).map((b, i) => b - beats[i]).filter(x => x > 0))).toFixed(1),
    compas: ts.map(s => s.timeSignature.join("/")).join(","), notas_voz: notas.length, golpes_bateria: golpes.length,
    bloques: resBloques, global: juntar(coros),
  };
}

function analizarBloque(ns, golpes, beats, enCompas, idx, compases) {
  const t0 = ns[0].t, t1 = Math.max(...ns.map(n => n.t + n.d)), span = t1 - t0;
  if (span < 2 || ns.length < 8) return null;
  const poli = ns.reduce((s, n) => s + n.d, 0) / span;
  const gs = golpes.filter(g => g.t >= t0 - .5 && g.t <= t1 + .5);
  const densPerc = gs.length / span;
  const bs = beats.filter(b => b >= t0 && b <= t1);
  const bpm = 60 / (median(bs.slice(1).map((b, i) => b - bs[i]).filter(x => x > .15)) || .5);
  const tipo = poli < 1.5 ? "solista/hablado" : densPerc > 1.2 ? "coro con batería" : "coro a capela";

  // tonalidad del bloque
  const ch = new Array(12).fill(0); for (const n of ns) ch[n.p % 12] += n.d;
  const key = tonalidad(ch);

  // ── separación en líneas (streams): por ataque, asignación ordenada que minimiza saltos
  const grupos = []; for (const n of ns) { const g = grupos.at(-1); if (g && n.t - g[0].t < .05) g.push(n); else grupos.push([n]) }
  const tam = grupos.map(g => { const t = g[0].t; return ns.filter(n => n.t <= t + .05 && n.t + n.d > t + .02).length });
  const K = Math.max(2, Math.min(5, Math.round(pct(tam, .9))));
  const lineas = Array.from({ length: K }, (_, i) => ({ ult: 70 - i * 6, finT: -1, notas: [] }));
  for (const g of grupos) {
    const t = g[0].t;
    const libres = lineas.map((l, i) => ({ l, i })).filter(x => x.l.finT <= t + .08); // ya terminó su nota
    const nuevas = [...g].sort((a, b) => b.p - a.p);
    // DP: emparejar nuevas (desc) con libres (desc por índice = por registro), en orden, saltear nota cuesta 24
    const N = nuevas.length, F = libres.length, INF = 1e9;
    const D = Array.from({ length: N + 1 }, () => new Array(F + 1).fill(INF)), P = Array.from({ length: N + 1 }, () => new Array(F + 1).fill(null));
    D[0][0] = 0; for (let j = 1; j <= F; j++) { D[0][j] = 0; P[0][j] = "f" }
    for (let i = 1; i <= N; i++) for (let j = 0; j <= F; j++) {
      if (D[i - 1][j] + 24 < D[i][j]) { D[i][j] = D[i - 1][j] + 24; P[i][j] = "n" }
      if (j > 0) {
        if (D[i][j - 1] < D[i][j]) { D[i][j] = D[i][j - 1]; P[i][j] = "f" }
        const c = D[i - 1][j - 1] + Math.abs(nuevas[i - 1].p - libres[j - 1].l.ult);
        if (c < D[i][j]) { D[i][j] = c; P[i][j] = "m" }
      }
    }
    for (let i = N, j = F; i > 0 || j > 0;) {
      const p = P[i][j]; if (!p) break;
      if (p === "m") { const n = nuevas[i - 1], L = libres[j - 1].l; n.linea = libres[j - 1].i; L.notas.push(n); L.ult = n.p; L.finT = n.t + n.d; i--; j-- }
      else if (p === "n") { nuevas[i - 1].linea = -1; i-- } else j--;
    }
  }
  // nombre de cuerda por registro, respetando el orden de arriba hacia abajo
  const meds = lineas.map(l => median(l.notas.map(n => n.p)) ?? 0);
  let desde = 0;
  const nombres = meds.map((md, i) => {
    let best = desde, bd = 1e9;
    for (let c = desde; c <= CUERDAS.length - (K - i); c++) { const d = Math.abs(CUERDAS[c][1] - md); if (d < bd) { bd = d; best = c } }
    desde = best + 1; return CUERDAS[best][0];
  });

  const statsLinea = (L, nombre) => {
    const v = L.notas; if (v.length < 4) return { cuerda: nombre, notas: v.length };
    const grado = n => (n.p - key.t + 12) % 12;
    const frases = []; let f = [v[0]];
    for (let i = 1; i < v.length; i++) { if (v[i].b0 - v[i - 1].b1 >= .9) { frases.push(f); f = [] } f.push(v[i]) }
    frases.push(f);
    const porCompas = {};
    for (const n of v) { const c = enCompas(n.b0); (porCompas[c.c] ||= { l: c.largo16, on: new Set() }).on.add(c.s16) }
    return {
      cuerda: nombre, notas: v.length,
      rango: [pct(v.map(n => n.p), .05), pct(v.map(n => n.p), .95)], mediana: median(v.map(n => n.p)),
      grados: normaliza(hist(v.map(grado))),
      saltos: normaliza(hist(v.slice(1).map((n, i) => n.p - v[i].p).filter(d => Math.abs(d) <= 12))),
      transiciones: top(hist(v.slice(1).map((n, i) => `${grado(v[i])}>${grado(n)}`)), 40),
      ataque_en_compas: normaliza(hist(v.map(n => enCompas(n.b0).s16))),
      duraciones_16: normaliza(hist(v.map(n => Math.min(16, n.q1 - n.q0)))),
      ritmos_por_compas: top(hist(Object.values(porCompas).map(o => Array.from({ length: o.l }, (_, i) => o.on.has(i) ? "x" : ".").join(""))), 12),
      frases_pulsos: frases.map(f => +(f.at(-1).b1 - f[0].b0).toFixed(1)),
      cadencias: normaliza(hist(frases.filter(f => f.length > 2).map(f => grado(f.at(-1))))),
    };
  };
  const statsLineas = lineas.map((L, i) => statsLinea(L, nombres[i]));

  // ── vertical: intervalos entre líneas vecinas y tipo de movimiento, homorritmia
  const pares = [];
  for (let a = 0; a + 1 < K; a++) {
    const A = lineas[a].notas, B = lineas[a + 1].notas;
    if (A.length < 4 || B.length < 4) continue;
    const suena = (L, q) => L.find(n => n.q0 <= q && n.q1 > q);
    const ataquesA = new Set(A.map(n => n.q0)), ataquesB = new Set(B.map(n => n.q0));
    const comunes = [...ataquesA].filter(q => ataquesB.has(q)).sort((x, y) => x - y);
    const iv = [], mov = [];
    let prev = null;
    for (const q of comunes) {
      const x = suena(A, q), y = suena(B, q); if (!x || !y) continue;
      iv.push(((x.p - y.p) % 12 + 12) % 12);
      if (prev) {
        const dx = x.p - prev[0], dy = y.p - prev[1];
        mov.push(dx === 0 && dy === 0 ? "repetida" : dx === 0 || dy === 0 ? "oblicuo" : Math.sign(dx) !== Math.sign(dy) ? "contrario" : (x.p - y.p) === (prev[0] - prev[1]) ? "paralelo" : "directo");
      }
      prev = [x.p, y.p];
    }
    pares.push({
      lineas: `${nombres[a]}/${nombres[a + 1]}`, intervalos: normaliza(hist(iv)), movimiento: normaliza(hist(mov)),
      homorritmia: +(comunes.length / Math.max(1, Math.min(ataquesA.size, ataquesB.size))).toFixed(2),
    });
  }

  // ── armonía cada 2 pulsos
  const bIni = ns[0].b0 - .5, bFin = Math.max(...ns.map(n => n.b1));
  const acordes = [];
  const ventanas = compases.filter(c => c.b + c.largo > bIni && c.b < bFin).flatMap(c => c.largo >= 4 ? [[c.b, c.largo / 2], [c.b + c.largo / 2, c.largo / 2]] : [[c.b, c.largo]]);
  for (const [b, lv] of ventanas) {
    const c = new Array(12).fill(0);
    for (const n of ns) { const s = Math.max(b, n.b0), e = Math.min(b + lv, n.b1); if (e > s) c[n.p % 12] += e - s }
    const ac = acorde(c); acordes.push(ac ? romano(ac, key) : "·");
  }
  const seq = acordes.filter((a, i) => a !== "·" && a !== acordes[i - 1]);

  // ── batería: patrón de cada instrumento por compás (semicorcheas)
  const bat = {};
  if (gs.length > 8) for (const inst of Object.keys(BATERIA)) {
    const porC = {};
    for (const g of gs.filter(g => g.inst === inst)) { const c = enCompas(g.b0); (porC[c.c] ||= { l: c.largo16, on: new Set() }).on.add(c.s16) }
    const pats = Object.values(porC).map(o => Array.from({ length: o.l }, (_, i) => o.on.has(i) ? "x" : ".").join(""));
    if (pats.length) bat[inst] = top(hist(pats), 6);
  }

  return {
    bloque: idx, desde_s: +t0.toFixed(1), hasta_s: +t1.toFixed(1), tipo, notas: ns.length, polifonia: +poli.toFixed(2), golpes_por_s: +densPerc.toFixed(2),
    tempo_bpm: +bpm.toFixed(1), tonalidad: key, lineas: statsLineas, pares, acordes: seq.join(" "),
    acordes_transiciones: top(hist(seq.slice(1).map((a, i) => `${seq[i]}>${a}`)), 25), bateria: bat,
    _crudo: { lineas: lineas.map(l => l.notas.map(n => [+n.t.toFixed(3), +n.d.toFixed(3), n.p])) },
  };
}

// junta bloques/archivos en un perfil (sumas ponderadas por cantidad de notas)
function juntar(bloques) {
  const g = { bloques: bloques.length, segundos: 0, por_cuerda: {}, pares: {}, acordes_transiciones: {}, tonalidades: {}, tempos: [], bateria: {} };
  for (const b of bloques) {
    g.segundos += b.hasta_s - b.desde_s; g.tempos.push(b.tempo_bpm);
    g.tonalidades[b.tonalidad.modo] = (g.tonalidades[b.tonalidad.modo] || 0) + 1;
    sumar(g.acordes_transiciones, b.acordes_transiciones);
    for (const l of b.lineas) {
      if (!l.grados) continue;
      const c = g.por_cuerda[l.cuerda] ||= { notas: 0, grados: {}, saltos: {}, transiciones: {}, ataque_en_compas: {}, duraciones_16: {}, ritmos_por_compas: {}, cadencias: {}, frases_pulsos: [], rango: [99, 0] };
      const w = l.notas; c.notas += w;
      for (const k of ["grados", "saltos", "ataque_en_compas", "duraciones_16", "cadencias"]) sumar(c[k], Object.fromEntries(Object.entries(l[k]).map(([a, v]) => [a, v * w])));
      sumar(c.transiciones, l.transiciones); sumar(c.ritmos_por_compas, l.ritmos_por_compas);
      c.frases_pulsos.push(...l.frases_pulsos); c.rango = [Math.min(c.rango[0], l.rango[0]), Math.max(c.rango[1], l.rango[1])];
    }
    for (const p of b.pares) {
      const c = g.pares[p.lineas] ||= { n: 0, intervalos: {}, movimiento: {}, homorritmia: 0 };
      c.n++; sumar(c.intervalos, p.intervalos); sumar(c.movimiento, p.movimiento); c.homorritmia += p.homorritmia;
    }
    for (const [inst, pats] of Object.entries(b.bateria)) sumar(g.bateria[inst] ||= {}, pats);
  }
  for (const c of Object.values(g.por_cuerda)) {
    for (const k of ["grados", "saltos", "ataque_en_compas", "duraciones_16", "cadencias"]) c[k] = normaliza(c[k]);
    c.transiciones = top(c.transiciones, 40); c.ritmos_por_compas = top(c.ritmos_por_compas, 15);
    c.frase_mediana_pulsos = median(c.frases_pulsos); delete c.frases_pulsos;
  }
  for (const c of Object.values(g.pares)) { c.intervalos = normaliza(c.intervalos); c.movimiento = normaliza(c.movimiento); c.homorritmia = +(c.homorritmia / c.n).toFixed(2) }
  g.acordes_transiciones = top(g.acordes_transiciones, 30);
  for (const k of Object.keys(g.bateria)) g.bateria[k] = top(g.bateria[k], 6);
  g.tempo_mediano = median(g.tempos); delete g.tempos; g.segundos = Math.round(g.segundos);
  return g;
}

// ───────── todos ─────────
const indices = {};
for (const a of archivos) { const ip = join(dirname(a), "indice.json"); if (!indices[ip] && existsSync(ip)) indices[ip] = JSON.parse(readFileSync(ip, "utf8")) }
const metaDe = a => { const ip = join(dirname(a), "indice.json"); const f = (indices[ip] || []).find(x => x.archivo === basename(a)); return f ? { murga: f.murga, anio: +f.anio, parte: f.parte, video: f.url, inicio_s: f.inicio_s } : {} };
const todos = [];
for (const a of archivos) {
  const r = analizar(a, metaDe(a));
  todos.push(r);
  const { bloques, ...sinBloques } = r;
  writeFileSync(join(SAL, basename(a).replace(/\.mid$/, ".json")), JSON.stringify(r));
  console.log(`\n${r.archivo}  ${r.duracion_s}s  ${r.tempo_bpm} BPM  ${r.compas}  voz ${r.notas_voz} notas, batería ${r.golpes_bateria}`);
  for (const b of bloques) console.log(`  [${b.desde_s}–${b.hasta_s}s] ${b.tipo.padEnd(16)} ${b.tonalidad.nombre.padEnd(10)} ${String(b.tempo_bpm).padStart(5)} BPM  poli ${b.polifonia}  líneas: ${b.lineas.map(l => `${l.cuerda}(${l.notas})`).join(" ")}  ${b.acordes.split(" ").slice(0, 10).join(" ")}`);
}
// perfiles por parte del espectáculo y total
const perfiles = {};
const grupo = (k, r) => (perfiles[k] ||= []).push(...r.bloques.filter(b => b.tipo !== "solista/hablado"));
for (const r of todos) { grupo("todo", r); if (r.parte) grupo(r.parte, r); if (r.murga) grupo(r.murga, r) }
const estilo = Object.fromEntries(Object.entries(perfiles).map(([k, bs]) => [k, juntar(bs)]));
writeFileSync(join(SAL, "estilo.json"), JSON.stringify(estilo, null, 1));
console.log(`\n→ ${SAL}/estilo.json  (${Object.keys(estilo).join(", ")})`);
