// tomas.js — varias grabaciones del mismo espectáculo, para saber cuánto del análisis es la murga y cuánto el transcriptor.
//
//   node herramientas/tomas.js cortar     busca la retirada de la primera toma de cada espectáculo dentro de las demás
//                                          (shows completos de Tenfield, videos de la tribuna) y escribe desde/hasta
//                                          en transcripcion/tomas.csv
//   node herramientas/tomas.js comparar   después de transcribir (murga_lote.py --lista tomas.csv --carpeta tomas) y
//                                          analizar (MURGA_CARPETA=tomas node herramientas/analizar.js): alinea cada par de
//                                          tomas por el croma de las voces separadas y mide cuánto coinciden las notas,
//                                          la melodía, los acordes y los rasgos del jurado → docs/tomas.md
//
// La alineación es DTW sobre croma de 12 notas cada 0,1 s. Lo que se compara siempre está llevado al tiempo de la
// primera toma de cada espectáculo.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const TRABAJO = join(RAIZ, 'murga_trabajo');
const LISTA = join(RAIZ, 'transcripcion', 'tomas.csv');
const DIR_FF = 'D:/uv/murga/Lib/site-packages/imageio_ffmpeg/binaries';
const FF = existsSync(DIR_FF) ? join(DIR_FF, readdirSync(DIR_FF).find(f => f.startsWith('ffmpeg'))) : 'ffmpeg';
const SR = 11025, HOP = 1102.5, VENT = 4096;   // un cuadro cada 0,1 s

// ── CSV ──
function leerCsv(ruta) {
  const [cab, ...filas] = readFileSync(ruta, 'utf8').replace(/\r/g, '').trim().split('\n');
  const k = cab.split(',');
  return filas.map(l => { const c = []; let s = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { c.push(s); s = ''; } else s += ch; } c.push(s); return Object.fromEntries(k.map((x, i) => [x, c[i] ?? ''])); });
}
function escribirCsv(ruta, filas) {
  const k = Object.keys(filas[0]);
  const esc = v => (/[",]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v);
  writeFileSync(ruta, [k.join(','), ...filas.map(f => k.map(x => esc(f[x] ?? '')).join(','))].join('\n') + '\n');
}
const vid = url => url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)[1];
const audioDe = url => { const v = vid(url); const f = readdirSync(join(TRABAJO, 'audio')).find(x => x.startsWith(v + '.') && !x.endsWith('.part')); return f ? join(TRABAJO, 'audio', f) : null; };

// ── audio y croma ──
function leerAudio(ruta, desde = 0, hasta = 0) {
  const a = ['-v', 'error'];
  if (desde) a.push('-ss', String(desde));
  if (hasta) a.push('-to', String(hasta));
  a.push('-i', ruta, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-');
  const r = spawnSync(FF, a, { maxBuffer: 2 ** 31 - 1 });
  if (r.status) throw new Error('ffmpeg: ' + r.stderr);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
}
// croma por cuadro, de 100 Hz a 1,6 kHz (donde vive el coro)
export function croma(x) {
  const nF = Math.max(0, Math.floor((x.length - VENT) / HOP) + 1), C = new Float32Array(nF * 12);
  const ven = new Float32Array(VENT).map((_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / VENT));
  const pc = new Int8Array(VENT / 2);
  for (let k = 1; k < VENT / 2; k++) { const f = k * SR / VENT; pc[k] = f < 100 || f > 1600 ? -1 : ((Math.round(12 * Math.log2(f / 440)) % 12) + 12 + 9) % 12; }
  const re = new Float64Array(VENT), im = new Float64Array(VENT);
  for (let f = 0; f < nF; f++) {
    const o = Math.round(f * HOP);
    for (let i = 0; i < VENT; i++) { re[i] = x[o + i] * ven[i]; im[i] = 0; }
    fft(re, im);
    const c = new Float64Array(12);
    for (let k = 1; k < VENT / 2; k++) if (pc[k] >= 0) c[pc[k]] += re[k] * re[k] + im[k] * im[k];
    // amplitud relativa al máximo del cuadro, compresión suave y centrado: el coseno compara la forma, no el nivel
    let mx = 1e-12; for (let i = 0; i < 12; i++) { c[i] = Math.sqrt(c[i]); mx = Math.max(mx, c[i]); }
    let me = 0; for (let i = 0; i < 12; i++) { c[i] = Math.log1p(5 * c[i] / mx); me += c[i] / 12; }
    let s = 0; for (let i = 0; i < 12; i++) { c[i] -= me; s += c[i] * c[i]; }
    s = Math.sqrt(s) || 1;
    for (let i = 0; i < 12; i++) C[f * 12 + i] = c[i] / s;
  }
  return { C, n: nF };
}
// promedio móvil de 3 cuadros: menos sensible a la batería y a los ataques
function suavizar({ C, n }, k = 3) {
  const D = new Float32Array(C.length);
  for (let f = 0; f < n; f++) { let s = 0; for (let j = Math.max(0, f - k); j <= Math.min(n - 1, f + k); j++) for (let i = 0; i < 12; i++) D[f * 12 + i] += C[j * 12 + i]; for (let i = 0; i < 12; i++) s += D[f * 12 + i] ** 2; s = Math.sqrt(s) || 1; for (let i = 0; i < 12; i++) D[f * 12 + i] /= s; }
  return { C: D, n };
}
const dist = (A, i, B, j) => { let s = 0; for (let k = 0; k < 12; k++) s += A[i * 12 + k] * B[j * 12 + k]; return 1 - s; };

// DTW de subsecuencia: dónde está la consulta Q (entera) dentro de la larga L. Pasos (1,1), (1,0), (0,1) con peso 1, 1, 1.
export function subDtw(Q, L) {
  const n = Q.n, m = L.n;
  let prev = new Float32Array(m), cur = new Float32Array(m);
  const ini = new Int32Array(m), iniC = new Int32Array(m);
  for (let j = 0; j < m; j++) { prev[j] = dist(Q.C, 0, L.C, j); ini[j] = j; }
  for (let i = 1; i < n; i++) {
    cur[0] = prev[0] + dist(Q.C, i, L.C, 0); iniC[0] = ini[0];
    for (let j = 1; j < m; j++) {
      const d = dist(Q.C, i, L.C, j);
      let b = prev[j - 1], s = ini[j - 1];
      if (prev[j] + .3 < b) { b = prev[j] + .3; s = ini[j]; }          // repetir cuadro de L (la toma va más rápido)
      if (cur[j - 1] + .3 < b) { b = cur[j - 1] + .3; s = iniC[j - 1]; } // saltear cuadro de L (va más lento)
      cur[j] = b + d; iniC[j] = s;
    }
    [prev, cur] = [cur, prev]; ini.set(iniC);
  }
  let mj = 0; for (let j = 1; j < m; j++) if (prev[j] < prev[mj]) mj = j;
  return { desde: ini[mj] * HOP / SR, hasta: (mj + 1) * HOP / SR + VENT / SR, costo: prev[mj] / n };
}

// DTW completo con banda, devuelve el camino como función de tiempo: t de B → t de A
export function alinear(A, B, banda = .15) {
  const n = A.n, m = B.n, W = Math.max(50, Math.round(banda * Math.max(n, m)));
  const INF = 1e30, D = new Float32Array(n * m).fill(INF), P = new Uint8Array(n * m);
  for (let i = 0; i < n; i++) {
    const jc = Math.round(i * m / n), j0 = Math.max(0, jc - W), j1 = Math.min(m - 1, jc + W);
    for (let j = j0; j <= j1; j++) {
      const d = dist(A.C, i, B.C, j);
      if (!i && !j) { D[0] = d; continue; }
      let b = INF, p = 0;
      if (i && j && D[(i - 1) * m + j - 1] < b) { b = D[(i - 1) * m + j - 1]; p = 0; }
      if (i && D[(i - 1) * m + j] + .2 < b) { b = D[(i - 1) * m + j] + .2; p = 1; }
      if (j && D[i * m + j - 1] + .2 < b) { b = D[i * m + j - 1] + .2; p = 2; }
      D[i * m + j] = b + d; P[i * m + j] = p;
    }
  }
  const camino = []; let i = n - 1, j = m - 1;
  while (i > 0 || j > 0) { camino.push([i, j]); const p = P[i * m + j]; if (p === 0) { i--; j--; } else if (p === 1) i--; else j--; if (i < 0 || j < 0) break; }
  camino.push([0, 0]); camino.reverse();
  // de cuadros a segundos, monótono, con interpolación lineal
  const tb = [], ta = [];
  for (const [a, b] of camino) { if (tb.length && b === tb[tb.length - 1]) { ta[ta.length - 1] = (ta[ta.length - 1] + a) / 2; continue; } tb.push(b); ta.push(a); }
  const k = HOP / SR;
  const f = t => { const x = t / k; let lo = 0, hi = tb.length - 1; if (x <= tb[0]) return ta[0] * k; if (x >= tb[hi]) return ta[hi] * k; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tb[mid] <= x) lo = mid; else hi = mid; } return (ta[lo] + (ta[hi] - ta[lo]) * (x - tb[lo]) / (tb[hi] - tb[lo])) * k; };
  return { f, costo: D[n * m - 1] / camino.length };
}

function cortar() {
  const filas = leerCsv(LISTA);
  const porShow = new Map(); for (const f of filas) { if (!porShow.has(f.espectaculo)) porShow.set(f.espectaculo, []); porShow.get(f.espectaculo).push(f); }
  for (const [show, tomas] of porShow) {
    const ref = tomas[0], ra = audioDe(ref.url);
    if (!ra) { console.log(`${show}: falta el audio de la referencia`); continue; }
    const xr = leerAudio(ra), Q = suavizar(croma(xr)), durRef = xr.length / SR;
    console.log(`\n${show}: referencia ${ref.toma}, ${(durRef / 60).toFixed(1)} min`);
    const cortos = [];
    for (const t of tomas.slice(1)) { const a = audioDe(t.url); if (!a) continue; const x = leerAudio(a); if (x.length / SR < durRef * 1.6) cortos.push({ toma: t.toma, Q: suavizar(croma(x)) }); }
    for (const t of tomas.slice(1)) {
      const a = audioDe(t.url);
      if (!a) { console.log(`  ${t.toma}: falta el audio`); continue; }
      const x = leerAudio(a), dur = x.length / SR;
      if (dur < durRef * 1.6) { console.log(`  ${t.toma}: ${(dur / 60).toFixed(1)} min, ya es un corte: se usa entero`); t.desde = ''; t.hasta = ''; continue; }
      const L = suavizar(croma(x));
      // se busca con cada corte corto del espectáculo y se queda con el que mejor encaja (el disco puede no parecerse al vivo)
      let r = { ...subDtw(Q, L), con: ref.toma };
      for (const c of cortos) { if (r.costo < .4) break; const rc = { ...subDtw(c.Q, L), con: c.toma }; if (rc.costo < r.costo) r = rc; }
      // un poco de aire a cada lado, por si la referencia empieza tarde
      t.desde = Math.max(0, r.desde - 3).toFixed(1); t.hasta = Math.min(dur, r.hasta + 3).toFixed(1);
      console.log(`  ${t.toma}: ${(dur / 60).toFixed(1)} min → ${mmss(r.desde)}–${mmss(r.hasta)} (${((r.hasta - r.desde) / 60).toFixed(1)} min), costo ${r.costo.toFixed(3)} con ${r.con}`);
    }
  }
  escribirCsv(LISTA, filas);
  console.log(`\nEscrito ${LISTA}`);
}
const mmss = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

export { leerAudio, suavizar, leerCsv, LISTA, TRABAJO, SR };

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cmd = process.argv[2];
  if (cmd === 'cortar') cortar();
  else if (cmd === 'comparar') (await import('./tomas_comparar.js')).comparar();
  else console.log('uso: node herramientas/tomas.js cortar|comparar');
}
