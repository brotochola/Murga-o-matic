// solistas_medir.mjs — cómo canta un solista: mide, con WORLD (motor/cantor/world.js), los pasajes de una sola voz que
// encontró solistas_buscar.py en las voces separadas de las murgas, y con las mismas cuentas las frases de un solista
// sintético (las de herramientas/solista.mjs). Sin partitura: las notas salen de la altura.
//
//   node herramientas/solistas_medir.mjs [--todos]                los pasajes «estrictos» de murga_trabajo/solistas/segmentos.json
//                                                                 (con --todos, todos los cantados: sale medidas_reales_todos.json)
//   node herramientas/solistas_medir.mjs --sintetico <carpeta> --nombre difonos_es2    los .wav de esa carpeta
//   node herramientas/solistas_medir.mjs --tabla                  junta las medidas_*.json en una tabla (real contra sintéticos)
//     --dio      la altura con DIO (rápido) en lugar de Harvest
//
// Mide: el vibrato (velocidad, amplitud en ± cents, cuándo entra en la nota), el pique al entrar después de un silencio,
// el portamento entre notas (ligadas y a través de una consonante), el temblor rápido de la altura (lo que queda
// sacando la nota y el vibrato), la deriva lenta, el ataque y los cambios de volumen, H1−H2, el brillo (arriba de
// 1,8 kHz), el centroide entre 250 Hz y 1,6 kHz (una pista del primer formante), el aire (aperiodicidad de 1 a 4 kHz), la
// caída al final de la frase, cuánto del tiempo hay voz, el largo de las notas y los huecos de las consonantes.
// Deja murga_trabajo/solistas/medidas_<nombre>.json (cada medida en crudo y su resumen: mediana y cuartiles).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { crearWorld } from '../motor/cantor/world.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOL = join(RAIZ, 'murga_trabajo', 'solistas');
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const FS = 22050, PER = 5, FPS = 1000 / PER;     // cuadros de 5 ms
const MARGEN = .3;
// murgas de mujeres o mixtas entre las de murga_trabajo/voces (a confirmar de oído): se muestran también sin ellas
const MUJERES = ['Cayó la Cabra', 'Doña Bastarda'];                               // los pasajes reales se leen con 0,3 s más de cada lado

// ── cuentas ──
const finito = v => Number.isFinite(v);
const ordenar = a => a.filter(finito).sort((p, q) => p - q);
const cuantil = (a, p) => { const s = ordenar(a); if (!s.length) return NaN; const x = (s.length - 1) * p, i = Math.floor(x), f = x - i; return i + 1 < s.length ? s[i] * (1 - f) + s[i + 1] * f : s[i]; };
const mediana = a => cuantil(a, .5);
const resumen = a => { const s = ordenar(a); return { n: s.length, mediana: r1(cuantil(s, .5)), q1: r1(cuantil(s, .25)), q3: r1(cuantil(s, .75)) }; };
const r1 = v => finito(v) ? Math.round(v * 10) / 10 : null;
// promedio móvil centrado de w cuadros, sólo con los valores finitos, con espejo en los bordes del tramo [a, b)
function promedio(c, a, b, w) {
  const out = new Float64Array(b - a).fill(NaN), h = w >> 1, n = b - a;
  const val = k => { let j = k; if (j < 0) j = -j; if (j >= n) j = 2 * n - 2 - j; j = Math.max(0, Math.min(n - 1, j)); return c[a + j]; };
  for (let k = 0; k < n; k++) { let s = 0, m = 0; for (let j = k - h; j <= k + h; j++) { const v = val(j); if (finito(v)) { s += v; m++; } } if (m >= h) out[k] = s / m; }
  return out;
}
// Savitzky-Golay de orden 2, 9 cuadros (45 ms): deja pasar el vibrato entero y saca lo más rápido
const SG = [-21, 14, 39, 54, 59, 54, 39, 14, -21].map(v => v / 231);

function decodificar(ruta, desde = null, largo = null) {
  const a = ['-v', 'error'];
  if (desde != null) a.push('-ss', String(Math.max(0, desde)), '-t', String(largo));
  a.push('-i', ruta, '-ac', '1', '-ar', String(FS), '-f', 'f32le', '-');
  const b = execFileSync('ffmpeg', a, { maxBuffer: 1 << 30 });
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}

const world = await crearWorld(readFileSync(join(RAIZ, 'motor', 'vendor', 'world', 'world.wasm')));

// ── un pasaje ──
function medirClip(x) {
  const an = world.analizar(Float64Array.from(x), FS, { harvest: !args.includes('--dio'), f0min: 70, f0max: 1000, periodo: PER });
  // Harvest alisa la altura y se come el temblor rápido (un temblor de 0,15 semitonos medido con Harvest da 1,2 cents;
  // con DIO, 5,3): el temblor se mide con DIO + StoneMask, en los cuadros en que las dos coinciden
  const anD = args.includes('--dio') ? an : world.analizar(Float64Array.from(x), FS, { harvest: false, f0min: 70, f0max: 1000, periodo: PER });
  const N = an.cuadros, A = an.ancho, fft = an.fft;
  // el nivel: RMS en 20 ms, en dB
  const lvl = new Float64Array(N), W = Math.round(.02 * FS);
  for (let q = 0; q < N; q++) { const c = Math.round(q * PER / 1000 * FS); let s = 0, m = 0; for (let k = c - (W >> 1); k < c + (W >> 1); k++) if (k >= 0 && k < x.length) { s += x[k] * x[k]; m++; } lvl[q] = 10 * Math.log10(s / Math.max(1, m) + 1e-12); }
  // la altura en cents (MIDI × 100); sin saltos de octava sueltos ni pedacitos de menos de 40 ms. Harvest le pone
  // altura a casi todo (también a las consonantes sordas): hay voz si además D4C dice que abajo de 1 kHz es periódico
  // (su aperiodicidad de 100 Hz a 1 kHz, que en las vocales anda por −25 dB, queda en 0 dB donde no hay voz)
  const c = new Float64Array(N).fill(NaN), cH = new Float64Array(N).fill(NaN);   // cH: la de Harvest sola
  for (let q = 0; q < N; q++) {
    if (an.f0[q] > 0) cH[q] = 6900 + 1200 * Math.log2(an.f0[q] / 440);
    if (!(an.f0[q] > 0)) continue;
    let s = 0, m = 0; for (let k = 1; k < A; k++) { const fr = k * FS / fft; if (fr >= 100 && fr <= 1000) { s += an.ap[q * A + k]; m++; } }
    if (s / m < .5) c[q] = 6900 + 1200 * Math.log2(an.f0[q] / 440);
  }
  const ref = cuantil([...lvl].filter((v, q) => finito(c[q])), .8);
  for (let q = 0; q < N; q++) if (lvl[q] < ref - 35) c[q] = NaN;
  { const m = new Float64Array(N); for (let q = 0; q < N; q++) { const v = []; for (let j = q - 4; j <= q + 4; j++) if (j >= 0 && j < N && finito(c[j])) v.push(c[j]); m[q] = v.length ? mediana(v) : NaN; } for (let q = 0; q < N; q++) if (finito(c[q]) && Math.abs(c[q] - m[q]) > 600) c[q] = NaN; }
  const corridas = [];
  for (let q = 0; q < N;) { if (!finito(c[q])) { q++; continue; } let b = q; while (b < N && finito(c[b])) b++; corridas.push([q, b]); q = b; }
  for (const [a, b] of corridas) if (b - a < 8) for (let q = a; q < b; q++) c[q] = NaN;
  const sonoro = Uint8Array.from(c, v => finito(v) ? 1 : 0);   // la voz tal cual, antes de rellenar los huecos chicos
  // huecos de hasta 20 ms adentro de la voz: se rellenan (no son consonantes)
  let runs = []; for (let q = 0; q < N;) { if (!finito(c[q])) { q++; continue; } let b = q; while (b < N && finito(c[b])) b++; runs.push([q, b]); q = b; }
  for (let i = 1; i < runs.length; i++) { const [a0, b0] = runs[i - 1], [a1] = runs[i]; if (a1 - b0 <= 4) for (let q = b0; q < a1; q++) c[q] = c[b0 - 1] + (c[a1] - c[b0 - 1]) * (q - b0 + 1) / (a1 - b0 + 1); }
  runs = []; for (let q = 0; q < N;) { if (!finito(c[q])) { q++; continue; } let b = q; while (b < N && finito(c[b])) b++; runs.push([q, b]); q = b; }
  if (!runs.length) return null;
  // frases: corridas separadas por menos de 250 ms. Fin de frase: después vienen 200 ms sin voz y 12 dB abajo de lo
  // que suena (con 20 dB casi no había: la sala del teatro deja una cola larga)
  const frases = [];
  for (const r of runs) { const f = frases[frases.length - 1]; if (f && r[0] - f.b < 50) { f.b = r[1]; f.runs.push(r); } else frases.push({ a: r[0], b: r[1], runs: [r] }); }
  // (al final del archivo alcanza con 150 ms: las frases de los bancos terminan con poco silencio)
  const callado = (a, b) => { if (b > N) { if (N - a < 30) return false; b = N; } for (let q = a; q < b; q++) if (finito(c[q]) || lvl[q] > ref - 12) return false; return true; };
  const silencioAntes = q => q >= 20 && callado(q - 20, q);            // 100 ms
  for (const f of frases) f.fin = callado(f.b, f.b + 40);
  // los pozos de volumen adentro de cada frase (las consonantes): un mínimo con 3 dB o más de hondura frente a lo más
  // fuerte de los 150 ms de cada lado; de los que están a menos de 60 ms, el más hondo
  const lv = Float64Array.from(lvl, (v, q) => (lvl[Math.max(0, q - 1)] + v + lvl[Math.min(N - 1, q + 1)]) / 3);
  for (const f of frases) {
    const pozos = [];
    for (let q = f.a + 2; q < f.b - 2; q++) {
      if (!(lv[q] <= lv[q - 1] && lv[q] <= lv[q + 1] && lv[q] <= lv[q - 2] && lv[q] <= lv[q + 2])) continue;
      let iz = -Infinity, de = -Infinity; for (let j = Math.max(f.a, q - 30); j <= q; j++) iz = Math.max(iz, lv[j]); for (let j = q; j <= Math.min(f.b - 1, q + 30); j++) de = Math.max(de, lv[j]);
      const prof = Math.min(iz, de) - lv[q]; if (prof < 3) continue;
      let a = q, b = q; while (a > f.a && lv[a - 1] < lv[q] + prof / 2) a--; while (b < f.b - 1 && lv[b + 1] < lv[q] + prof / 2) b++;
      pozos.push({ q, prof, ms: (b - a + 1) / FPS * 1000 });
    }
    f.pozos = []; for (const p of pozos.sort((x, y) => y.prof - x.prof)) if (f.pozos.every(e => Math.abs(e.q - p.q) >= 12)) f.pozos.push(p);
    f.pozos.sort((x, y) => x.q - y.q);
  }
  const pozosHondos = frases.flatMap(f => f.pozos.filter(p => p.prof >= 6).map(p => p.q));

  // ── las notas: dentro de cada corrida, tramos de altura quieta (sin el vibrato: promedio de 180 ms) ──
  const notas = [];
  for (const [a, b] of runs) {
    if (b - a < 12) continue;
    const m = promedio(c, a, b, 36);
    const est = new Uint8Array(b - a);
    for (let k = 0; k < b - a; k++) { const k0 = Math.max(0, k - 5), k1 = Math.min(b - a - 1, k + 5); est[k] = Math.abs(m[k1] - m[k0]) / ((k1 - k0) / FPS || 1) < 300 ? 1 : 0; }
    let nucleos = [];
    for (let k = 0; k < b - a;) { if (!est[k]) { k++; continue; } let e = k; while (e < b - a && est[e]) e++; if (e - k >= 12) nucleos.push([a + k, a + e]); k = e; }
    const nivel = ([p, q]) => mediana(Array.from(c.subarray(p, q)));
    // núcleos vecinos a menos de 50 cents: la misma nota
    nucleos = nucleos.reduce((acc, n) => { const u = acc[acc.length - 1]; if (u && Math.abs(nivel(u) - nivel(n)) < 50) u[1] = n[1]; else acc.push([...n]); return acc; }, []);
    if (!nucleos.length) { notas.push({ t0: a, t1: b, n0: a, n1: b, L: mediana(Array.from(c.subarray(a, b))), quieta: false, run: [a, b] }); continue; }
    const L = nucleos.map(nivel);
    const borde = k => {   // dónde cruza la mitad entre el núcleo k−1 y el k
      const [, e0] = nucleos[k - 1], [s1] = nucleos[k], I = L[k] - L[k - 1];
      for (let q = Math.max(a, e0 - 12); q < Math.min(b, s1 + 12); q++) if ((c[q] - L[k - 1]) / I >= .5) return q;
      return (e0 + s1) >> 1;
    };
    const bordes = nucleos.map((n, k) => k ? borde(k) : a);
    nucleos.forEach((n, k) => notas.push({ t0: bordes[k], t1: k + 1 < nucleos.length ? bordes[k + 1] : b, n0: n[0], n1: n[1], L: L[k], quieta: true, run: [a, b] }));
  }
  for (const n of notas) n.antes = n.t0 === n.run[0] ? (silencioAntes(n.t0) ? 'silencio' : 'hueco') : 'ligada';
  // una nota quieta con un pozo hondo (6 dB) adentro son dos sílabas en la misma altura, con una consonante sonora
  // en el medio (m, n, l...): se parte
  for (let i = 0; i < notas.length; i++) {
    const n = notas[i]; if (!n.quieta) continue;
    const p = pozosHondos.find(q => q > n.n0 + 12 && q < n.n1 - 12); if (p == null) continue;
    notas.splice(i + 1, 0, { ...n, t0: p, n0: p + 4, antes: 'consonante' });
    n.t1 = p; n.n1 = p - 4;
  }
  for (let i = 0; i < notas.length; i++) notas[i].prev = i ? notas[i - 1] : null;
  const frDe = q => frases.find(f => q >= f.a && q < f.b);

  const R = { duracion: N / FPS, notas: [], vibrato: [], picos: [], portamento: [], cruce: [], temblor: [], deriva: [], ataque: [], ataqueSilaba: [], pendiente: [], contraste: [], caida: [], huecos: [], sordos: [], espectro: [] };
  // ── el vibrato, la deriva y el temblor, nota por nota ──
  for (const n of notas) {
    const dn = (n.t1 - n.t0) / FPS; R.notas.push(dn * 1000);
    if (!n.quieta) continue;
    const a = n.n0, b = n.n1, len = b - a;
    // temblor: lo que queda sacando una parábola de 45 ms (pasa la nota y el vibrato), con la altura de DIO
    if (len >= 30) {
      const cD = q => { const f = anD.f0[q]; if (!(f > 0)) return NaN; const v = 6900 + 1200 * Math.log2(f / 440); return Math.abs(v - c[q]) < 50 ? v : NaN; };
      let s = 0, m = 0;
      for (let q = a + 4; q < b - 4; q++) { let v = 0, ok = true; for (let j = 0; j < 9; j++) { const u = cD(q - 4 + j); if (!finito(u)) { ok = false; break; } v += SG[j] * u; } if (!ok) continue; s += (cD(q) - v) ** 2; m++; }
      if (m >= 15) R.temblor.push(Math.sqrt(s / m));
    }
    if (len < 90) continue;                         // vibrato y deriva: notas de 450 ms o más
    const tend = promedio(c, a, b, 40);             // 200 ms: saca el vibrato
    const r = Array.from({ length: len }, (_, k) => c[a + k] - tend[k]);
    // deriva: cuánto se mueve la nota sin el vibrato, sacando la recta
    { const xs = tend.map((v, k) => k), mx = (len - 1) / 2, my = tend.reduce((s, v) => s + v, 0) / len; let sxy = 0, sxx = 0; for (let k = 0; k < len; k++) { sxy += (k - mx) * (tend[k] - my); sxx += (k - mx) ** 2; } const p = sxy / sxx; let s = 0; for (let k = 0; k < len; k++) s += (tend[k] - my - p * (k - mx)) ** 2; R.deriva.push(Math.sqrt(s / len)); void xs; }
    // velocidad: autocorrelación entre 3 y 9 Hz
    const mu = r.reduce((s, v) => s + v, 0) / len, rr = r.map(v => v - mu);
    const ac = l => { let s = 0; for (let k = 0; k + l < len; k++) s += rr[k] * rr[k + l]; return s / (len - l); };
    const a0 = ac(0); let mejor = -1, L = 0, acs = [];
    for (let l = 20; l <= 70; l++) acs[l] = ac(l) / (a0 || 1);
    for (let l = 21; l < 70; l++) if (acs[l] > acs[l - 1] && acs[l] >= acs[l + 1] && acs[l] > mejor) { mejor = acs[l]; L = l; }
    let vel = NaN; if (L) { const ym = acs[L - 1], y0 = acs[L], yp = acs[L + 1], d = (ym - yp) / (2 * (ym - 2 * y0 + yp) || 1); vel = FPS / (L + Math.max(-.5, Math.min(.5, d))); }
    // amplitud: la mitad de cada subida o bajada entre extremos (en el residuo suavizado)
    const sv = rr.map((v, k) => { let s = 0, w = 0; for (let j = -3; j <= 3; j++) { const u = rr[k + j]; if (u != null) { s += u; w++; } } return s / w; });
    const ext = []; let ult = -1;
    const sep = L ? Math.round(L * .3) : 8;
    for (let k = 1; k < len - 1; k++) {
      const esMax = sv[k] > sv[k - 1] && sv[k] >= sv[k + 1], esMin = sv[k] < sv[k - 1] && sv[k] <= sv[k + 1];
      if (!esMax && !esMin) continue;
      if (ult >= 0 && k - ext[ult].k < sep) { if ((esMax && sv[k] > ext[ult].v && ext[ult].max) || (esMin && sv[k] < ext[ult].v && !ext[ult].max)) ext[ult] = { k, v: sv[k], max: esMax }; continue; }
      if (ult >= 0 && ext[ult].max === esMax) { if ((esMax && sv[k] > ext[ult].v) || (esMin && sv[k] < ext[ult].v)) ext[ult] = { k, v: sv[k], max: esMax }; continue; }
      ext.push({ k, v: sv[k], max: esMax }); ult = ext.length - 1;
    }
    const medios = []; for (let i = 1; i < ext.length; i++) medios.push({ k: (ext[i].k + ext[i - 1].k) / 2, v: Math.abs(ext[i].v - ext[i - 1].v) / 2 });
    const amp = mediana(medios.map(m => m.v));
    const hay = mejor >= .25 && vel >= 3.5 && vel <= 8.5 && amp >= 10;
    // cuándo entra: el primer par de medios ciclos con la mitad de la amplitud de la nota, desde que empieza la nota
    let entra = NaN;
    if (hay) for (let i = 0; i + 1 < medios.length; i++) if (medios[i].v >= amp * .5 && medios[i + 1].v >= amp * .5) { entra = (a + medios[i].k - n.t0) / FPS * 1000; break; }
    R.vibrato.push({ dur: dn, hay, vel: hay ? vel : NaN, amp: hay ? amp : NaN, ampTodas: amp, regular: mejor, entra, nota: n.L / 100 });
  }
  // ── el pique: las notas que empiezan después de un silencio ──
  for (const n of notas) {
    if (n.antes !== 'silencio' || !n.quieta || n.n1 - n.n0 < 30) continue;
    const L = mediana(Array.from(c.subarray(n.n0, Math.min(n.n1, n.n0 + 30))));
    // los primeros períodos suelen ser irregulares: el comienzo es la mediana de 10 a 30 ms; más de una octava es un error
    const ini = mediana([c[n.t0 + 2], c[n.t0 + 3], c[n.t0 + 4], c[n.t0 + 5]]);
    let llega = NaN; for (let q = n.t0; q < n.n1; q++) if (Math.abs(c[q] - L) < 20) { llega = (q - n.t0) / FPS * 1000; break; }
    if (Math.abs(L - ini) < 1200) R.picos.push({ cents: L - ini, ms: llega });
  }
  // ── el portamento: notas ligadas (sin hueco) con un salto de 80 cents o más ──
  for (const n of notas) {
    const p = n.prev; if (!p || !p.quieta || !n.quieta) continue;
    if (n.antes === 'ligada') {
      const L1 = mediana(Array.from(c.subarray(Math.max(p.n0, p.n1 - 20), p.n1))), L2 = mediana(Array.from(c.subarray(n.n0, Math.min(n.n1, n.n0 + 20)))), I = L2 - L1;
      if (Math.abs(I) < 80) continue;
      const q0 = Math.max(p.n0, p.n1 - 12), q1 = Math.min(n.n1, n.n0 + 12);
      const rel = q => { const v = [c[q - 1], c[q], c[q + 1]].filter(finito); return (mediana(v) - L1) / I; };
      let mitad = -1; for (let q = q0; q < q1; q++) if (rel(q) >= .5) { mitad = q; break; }
      if (mitad < 0) continue;
      let t10 = mitad; while (t10 > q0 && rel(t10 - 1) >= .1) t10--;
      let t90 = mitad; while (t90 < q1 && rel(t90) < .9) t90++;
      let sobre = 0; for (let q = t90; q < Math.min(n.n1, t90 + 30); q++) sobre = Math.max(sobre, (rel(q) - 1) * Math.abs(I));
      R.portamento.push({ ms: (t90 - t10) / FPS * 1000, intervalo: I, forma: (mitad - t10) / Math.max(1, t90 - t10), sobre });
    } else if (n.antes === 'hueco') {
      // a través de una consonante: cuánto del salto falta cuando vuelve la voz, y cuánto tarda en llegar
      const gap = n.t0 - p.t1; if (gap > 50) continue;
      const L1 = mediana(Array.from(c.subarray(Math.max(p.n0, p.n1 - 20), p.n1))), L2 = mediana(Array.from(c.subarray(n.n0, Math.min(n.n1, n.n0 + 20)))), I = L2 - L1;
      if (Math.abs(I) < 80) continue;
      const ini = mediana([c[n.t0], c[n.t0 + 1], c[n.t0 + 2]]);
      let llega = NaN; for (let q = n.t0; q < n.n1; q++) if (Math.abs(c[q] - L2) < .1 * Math.abs(I)) { llega = (q - n.t0) / FPS * 1000; break; }
      // y antes de callarse: cuánto se fue hacia la nota que viene
      const fin = mediana([c[p.t1 - 1], c[p.t1 - 2], c[p.t1 - 3]]);
      R.cruce.push({ falta: (L2 - ini) / I, yaSeFue: (fin - L1) / I, llegaMs: llega, hueco: gap / FPS * 1000, intervalo: I });
    }
  }
  // ── la caída al final de la frase ──
  for (const f of frases) {
    if (!f.fin) continue;
    const n = notas.filter(n => n.t1 === f.b && n.quieta).pop(); if (!n || n.t1 - n.t0 < 60) continue;
    const L = mediana(Array.from(c.subarray(n.n0, Math.max(n.n0 + 10, n.t1 - 30))));
    // el final: lo último que suena a menos de 20 dB de la nota (lo de abajo, la altura ya no es confiable)
    const ln = mediana(Array.from(lvl.subarray(n.n0, n.n1)));
    // D4C da por sorda la cola que se apaga: se sigue con la altura de Harvest mientras no salte y suene a menos de
    // 25 dB de la nota
    let e = n.t1; while (e < N && finito(cH[e]) && Math.abs(cH[e] - (finito(c[e - 1]) ? c[e - 1] : cH[e - 1])) < 100 && lvl[e] > ln - 25) e++;
    const cc = q => q < n.t1 ? c[q] : cH[q];
    const fin = mediana([cc(e - 1), cc(e - 2), cc(e - 3), cc(e - 4)]);
    let q = e - 1; while (q > n.t0 && cc(q) < L - 20) q--;
    R.caida.push({ cents: L - fin, ms: (e - 1 - q) / FPS * 1000, nivel: lvl[e - 30] - lvl[e - 1] });
  }
  // ── el volumen: ataques después de un silencio, la pendiente de las notas largas, el contraste entre notas ──
  const amp = q => Math.pow(10, lvl[Math.max(0, Math.min(N - 1, q))] / 20);
  const subida = (q0, q1, q2) => {   // del piso (en [q0, q1)) al pico (en [q1, q2)): del 10 al 90 %, en ms
    let piso = Infinity, pico = 0, kp = q1; for (let q = q0; q < q1; q++) piso = Math.min(piso, amp(q)); for (let q = q1; q < q2; q++) if (amp(q) > pico) { pico = amp(q); kp = q; }
    if (!(pico > piso * 2)) return NaN;
    const u10 = piso + .1 * (pico - piso), u90 = piso + .9 * (pico - piso);
    let a = -1, b = -1; for (let q = q0; q <= kp; q++) { if (a < 0 && amp(q) >= u10) a = q; if (a >= 0 && amp(q) >= u90) { b = q; break; } }
    return a >= 0 && b >= 0 ? (b - a) / FPS * 1000 : NaN;
  };
  for (const n of notas) if (n.antes === 'silencio') R.ataque.push(subida(n.t0 - 20, n.t0, Math.min(N, n.t0 + 40)));
  for (const n of notas) if (n.quieta && n.n1 - n.n0 >= 120) {   // notas de 600 ms o más
    const a = n.n0 + 20, b = n.n1 - 20, len = b - a, mx = (a + b - 1) / 2; let my = 0; for (let q = a; q < b; q++) my += lvl[q]; my /= len;
    let sxy = 0, sxx = 0; for (let q = a; q < b; q++) { sxy += (q - mx) * (lvl[q] - my); sxx += (q - mx) ** 2; }
    R.pendiente.push(sxy / sxx * FPS);
  }
  for (const f of frases) { const ns = notas.filter(n => n.t0 >= f.a && n.t1 <= f.b && n.t1 - n.t0 >= 24); if (ns.length >= 3) { const v = ns.map(n => { let s = 0; for (let q = n.t0; q < n.t1; q++) s += lvl[q]; return s / (n.t1 - n.t0); }); const m = v.reduce((s, x) => s + x, 0) / v.length; R.contraste.push(Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length)); } }
  // ── los huecos de las consonantes: pozos de volumen adentro de las frases ──
  let tiempoFrase = 0, voz = 0, cortes = 0;
  for (const f of frases) {
    tiempoFrase += f.b - f.a;
    const refF = cuantil(Array.from(lv.subarray(f.a, f.b)), .8);
    for (let q = f.a; q < f.b; q++) { if (sonoro[q]) voz++; if (lv[q] < refF - 15) cortes++; }
    for (const p of f.pozos) { R.huecos.push({ db: p.prof, ms: p.ms }); R.ataqueSilaba.push(subida(p.q, p.q + 1, Math.min(f.b, p.q + 30))); }
    // los tramos sin voz adentro de la frase (consonantes sordas): cuánto duran
    for (let q = f.a; q < f.b;) { if (sonoro[q]) { q++; continue; } let e = q; while (e < f.b && !sonoro[e]) e++; if (e - q >= 2) R.sordos.push((e - q) / FPS * 1000); q = e; }
  }
  R.vozEnFrase = voz / Math.max(1, tiempoFrase);
  R.cortes = cortes / Math.max(1, tiempoFrase);
  R.silabasPorSeg = R.huecos.length / Math.max(.1, tiempoFrase / FPS);
  R.tiempoFrase = tiempoFrase / FPS;
  // ── el timbre, en los cuadros de vocal sostenida: H1−H2, brillo, centroide de 250 a 1600 Hz, aire de 1 a 4 kHz ──
  const H = [], BR = [], CE = [], AP = [], NT = [];
  for (const n of notas) if (n.quieta) for (let q = n.n0; q < n.n1; q++) {
    const f0 = an.f0[q]; if (!(f0 > 0) || lvl[q] < ref - 10) continue;
    const fila = an.sp.subarray(q * A, (q + 1) * A), ap = an.ap.subarray(q * A, (q + 1) * A);
    const en = h => { const x = h * f0 * fft / FS, i = Math.floor(x), f = x - i; return i + 1 < A ? fila[i] * (1 - f) + fila[i + 1] * f : NaN; };
    let tot = 0, alto = 0, s = 0, sw = 0, sa = 0, na = 0;
    for (let k = 1; k < A; k++) { const fr = k * FS / fft, e = fila[k]; tot += e; if (fr > 1800) alto += e; if (fr >= 250 && fr <= 1600) { s += fr * e; sw += e; } if (fr >= 1000 && fr <= 4000) { sa += ap[k]; na++; } }
    H.push(10 * Math.log10(en(1) / en(2))); BR.push(10 * Math.log10(alto / tot)); CE.push(s / sw); AP.push(10 * Math.log10(sa / na)); NT.push(c[q] / 100);
  }
  R.espectro = { h1h2: mediana(H), brillo: mediana(BR), centroide: mediana(CE), aire: mediana(AP), nota: mediana(NT), cuadros: H.length, porNota: { H, BR, CE, AP, NT } };
  R.altura = mediana(notas.filter(n => n.quieta).map(n => n.L / 100));
  return R;
}

// ── juntar las medidas de muchos pasajes ──
function juntar(lista) {
  const todo = k => lista.flatMap(r => r[k]);
  const vib = todo('vibrato'), largas = vib.filter(v => v.dur >= .45);
  const con = largas.filter(v => v.hay);
  const pick = (a, k) => a.map(v => v[k]);
  // el timbre en el mismo registro que los sintéticos (Sol 3 a Mi 4: MIDI 55 a 64)
  const enRango = k => lista.flatMap(r => r.espectro.porNota[k].filter((_, i) => r.espectro.porNota.NT[i] >= 54.5 && r.espectro.porNota.NT[i] <= 64.5));
  return {
    pasajes: lista.length, segundos: r1(lista.reduce((s, r) => s + r.duracion, 0)),
    altura: resumen(lista.map(r => r.altura)),
    vibrato: { notasLargas: largas.length, conVibrato: r1(100 * con.length / Math.max(1, largas.length)), velocidadHz: resumen(pick(con, 'vel')), amplitudCents: resumen(pick(con, 'amp')), entraMs: resumen(pick(con, 'entra')), amplitudTodasLasLargas: resumen(pick(largas, 'ampTodas')), regularidad: resumen(pick(largas, 'regular').map(v => v * 100)) },
    pique: { n: todo('picos').length, cents: resumen(pick(todo('picos'), 'cents')), llegaMs: resumen(pick(todo('picos'), 'ms')), desdeAbajo30: r1(100 * todo('picos').filter(p => p.cents > 30).length / Math.max(1, todo('picos').length)) },
    portamento: { n: todo('portamento').length, ms: resumen(pick(todo('portamento'), 'ms')), forma: resumen(pick(todo('portamento'), 'forma').map(v => v * 100)), sobreCents: resumen(pick(todo('portamento'), 'sobre')), intervaloCents: resumen(pick(todo('portamento'), 'intervalo').map(Math.abs)) },
    cruce: { n: todo('cruce').length, falta: resumen(pick(todo('cruce'), 'falta').map(v => v * 100)), yaSeFue: resumen(pick(todo('cruce'), 'yaSeFue').map(v => v * 100)), llegaMs: resumen(pick(todo('cruce'), 'llegaMs')), huecoMs: resumen(pick(todo('cruce'), 'hueco')) },
    temblorCents: resumen(todo('temblor')), derivaCents: resumen(todo('deriva')),
    ataqueMs: resumen(todo('ataque')), ataqueSilabaMs: resumen(todo('ataqueSilaba')), pendienteDbS: resumen(todo('pendiente')), contrasteDb: resumen(todo('contraste')),
    caida: { n: todo('caida').length, cents: resumen(pick(todo('caida'), 'cents')), ms: resumen(pick(todo('caida'), 'ms')), nivelDb: resumen(pick(todo('caida'), 'nivel')), cae50: r1(100 * todo('caida').filter(v => v.cents > 50).length / Math.max(1, todo('caida').length)) },
    vozEnFrase: resumen(lista.map(r => 100 * r.vozEnFrase)), cortes15dB: resumen(lista.map(r => 100 * r.cortes)),
    notasMs: resumen(todo('notas')), silabasPorSeg: resumen(lista.map(r => r.silabasPorSeg)),
    huecoDb: resumen(pick(todo('huecos'), 'db')), huecoMs: resumen(pick(todo('huecos'), 'ms')), sordoMs: resumen(todo('sordos')),
    h1h2: resumen(lista.map(r => r.espectro.h1h2)), brillo: resumen(lista.map(r => r.espectro.brillo)), centroide: resumen(lista.map(r => r.espectro.centroide)), aire: resumen(lista.map(r => r.espectro.aire)),
    enRegistro: { cuadros: enRango('H').length, h1h2: r1(mediana(enRango('H'))), brillo: r1(mediana(enRango('BR'))), centroide: r1(mediana(enRango('CE'))), aire: r1(mediana(enRango('AP'))) },
  };
}
const sinCrudo = r => { const { espectro, ...resto } = r; const { porNota, ...e } = espectro; return { ...resto, espectro: e }; };

// ── principal ──
if (args.includes('--tabla')) tabla();
else if (arg('sintetico')) {
  const D = resolve(arg('sintetico')), nombre = arg('nombre', basename(D));
  const lista = [];
  for (const f of readdirSync(D).filter(f => /\.wav$/i.test(f) && !f.startsWith('_')).sort()) {
    const r = medirClip(decodificar(join(D, f)));
    if (r) { r.archivo = f; lista.push(r); }
    process.stdout.write('.');
  }
  const res = { nombre, fuente: D, total: juntar(lista), pasajes: lista.map(sinCrudo) };
  writeFileSync(join(SOL, `medidas_${nombre}.json`), JSON.stringify(res, null, 1));
  console.log(`\n${nombre}: ${lista.length} frases → medidas_${nombre}.json`);
  console.log(JSON.stringify(res.total, null, 1));
} else {
  const seg = JSON.parse(readFileSync(join(SOL, 'segmentos.json'), 'utf8'));
  const lista = [];
  for (const t of seg.tramos) for (const p of t.pasajes) {
    if (!(args.includes('--todos') ? p.cantado : p.estricto)) continue;
    const x = decodificar(join(RAIZ, 'murga_trabajo', 'voces', `${t.tramo}.flac`), p.desde - MARGEN, p.largo + 2 * MARGEN);
    const r = medirClip(x);
    if (!r) continue;
    Object.assign(r, { tramo: t.tramo, murga: t.murga, desde: p.desde, hasta: p.hasta });
    lista.push(r);
    console.log(`${t.tramo.padEnd(44)} ${String(p.desde).padStart(7)} s  ${r.notas.length} notas, vibrato en ${r.vibrato.filter(v => v.hay).length}/${r.vibrato.length}, altura ${r1(r.altura)}`);
  }
  const porMurga = {};
  for (const m of [...new Set(lista.map(r => r.murga))]) porMurga[m] = juntar(lista.filter(r => r.murga === m));
  const nombre = args.includes('--todos') ? 'reales_todos' : 'reales';
  // las murgas de mujeres (o mixtas): para ver si cambian algo frente a los cantores sintéticos, que son hombres
  const hombres = lista.filter(r => !MUJERES.includes(r.murga));
  const res = { nombre, total: juntar(lista), sinMujeres: juntar(hombres), porMurga, pasajes: lista.map(sinCrudo) };
  writeFileSync(join(SOL, `medidas_${nombre}.json`), JSON.stringify(res, null, 1));
  console.log(`${lista.length} pasajes → medidas_${nombre}.json`);
  console.log(JSON.stringify(res.total, null, 1));
}

function tabla() {
  const archivos = readdirSync(SOL).filter(f => /^medidas_.+\.json$/.test(f));
  const J = Object.fromEntries(archivos.map(f => { const j = JSON.parse(readFileSync(join(SOL, f), 'utf8')); return [j.nombre, j]; }));
  const M = Object.fromEntries(Object.entries(J).map(([k, j]) => [k, j.total]));
  if (J.reales) M['reales sin mujeres'] = J.reales.sinMujeres;
  const sint = Object.keys(M).filter(k => !k.startsWith('reales')).sort();
  const orden = ['reales', 'murgas', 'reales sin mujeres', ...(M.reales_todos ? ['reales_todos'] : []), ...sint].filter(k => k === 'murgas' ? J.reales : M[k]);
  const fmt = s => s && typeof s === 'object' ? (s.mediana != null ? `${s.mediana} (${s.q1}–${s.q3})` : '—') : (typeof s === 'number' ? String(s) : s == null ? '—' : String(s));
  // la columna «murgas»: la mediana de las medianas de cada murga (cada murga pesa igual) y el rango entre murgas
  const PM = J.reales ? Object.values(J.reales.porMurga).filter(t => t.pasajes >= 3) : [];
  const deMurgas = f => { const v = PM.map(t => { try { const x = f(t); return x && x.mediana != null ? x.mediana : (typeof x === 'number' ? x : NaN); } catch { return NaN; } }).filter(finito); return v.length ? `${r1(mediana(v))} [${r1(Math.min(...v))}…${r1(Math.max(...v))}]` : '—'; };
  const filas = [
    ['Altura de las notas (MIDI)', t => t.altura],
    ['Notas largas (≥ 450 ms) con vibrato, %', t => t.vibrato.conVibrato],
    ['Vibrato: velocidad, Hz', t => t.vibrato.velocidadHz],
    ['Vibrato: amplitud, ± cents', t => t.vibrato.amplitudCents],
    ['Vibrato: entra a los, ms', t => t.vibrato.entraMs],
    ['Pique al entrar, cents (+ = desde abajo)', t => t.pique.cents],
    ['Pique: llega a la nota en, ms', t => t.pique.llegaMs],
    ['Portamento ligado, ms (10 → 90 %)', t => t.portamento.ms],
    ['Portamento: forma (% del tiempo hasta la mitad)', t => t.portamento.forma],
    ['Portamento: se pasa, cents', t => t.portamento.sobreCents],
    ['A través de consonante: falta al volver la voz, %', t => t.cruce.falta],
    ['A través de consonante: llega en, ms', t => t.cruce.llegaMs],
    ['Temblor rápido (sin nota ni vibrato), cents RMS', t => t.temblorCents],
    ['Deriva lenta en notas largas, cents RMS', t => t.derivaCents],
    ['Ataque después de silencio, ms (10 → 90 %)', t => t.ataqueMs],
    ['Ataque de sílaba, ms', t => t.ataqueSilabaMs],
    ['Notas largas: pendiente, dB/s', t => t.pendienteDbS],
    ['Contraste entre notas de la frase, dB', t => t.contrasteDb],
    ['Caída final, cents', t => t.caida.cents],
    ['Caída final, ms', t => t.caida.ms],
    ['Finales que caen más de 50 cents, %', t => t.caida.cae50],
    ['Caída final del volumen (150 ms), dB', t => t.caida.nivelDb],
    ['Voz dentro de la frase, %', t => t.vozEnFrase],
    ['15 dB abajo dentro de la frase, %', t => t.cortes15dB],
    ['Largo de las notas, ms', t => t.notasMs],
    ['Pozos de consonante por segundo', t => t.silabasPorSeg],
    ['Pozo de consonante: hondura, dB', t => t.huecoDb],
    ['Pozo de consonante: ancho, ms', t => t.huecoMs],
    ['Tramo sin voz adentro de la frase, ms', t => t.sordoMs],
    ['H1−H2, dB', t => t.h1h2],
    ['Brillo (arriba de 1,8 kHz), dB', t => t.brillo],
    ['Centroide 250–1600 Hz, Hz', t => t.centroide],
    ['Aire (aperiodicidad 1–4 kHz), dB', t => t.aire],
    ['En Sol 3–Mi 4: H1−H2, dB', t => t.enRegistro.h1h2],
    ['En Sol 3–Mi 4: brillo, dB', t => t.enRegistro.brillo],
    ['En Sol 3–Mi 4: centroide, Hz', t => t.enRegistro.centroide],
    ['En Sol 3–Mi 4: aire, dB', t => t.enRegistro.aire],
    ['Pasajes (o frases) medidos', t => t.pasajes],
    ['Segundos', t => t.segundos],
  ];
  const lineas = [`| Medida | ${orden.join(' | ')} |`, `|---|${orden.map(() => '---').join('|')}|`];
  for (const [nom, f] of filas) lineas.push(`| ${nom} | ${orden.map(k => { if (k === 'murgas') return deMurgas(f); try { return fmt(f(M[k])); } catch { return '—'; } }).join(' | ')} |`);
  // y por murga, lo principal
  if (J.reales) {
    lineas.push('', '| Murga | Pasajes | Vibrato Hz | Vibrato ± cents | Entra ms | Pique cents | Portamento ms | Temblor cents | H1−H2 dB | Brillo dB | Altura |', '|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [m, t] of Object.entries(J.reales.porMurga).sort((a, b) => b[1].pasajes - a[1].pasajes)) lineas.push(`| ${m} | ${t.pasajes} | ${t.vibrato.velocidadHz.mediana} | ${t.vibrato.amplitudCents.mediana} | ${t.vibrato.entraMs.mediana} | ${t.pique.cents.mediana} | ${t.portamento.ms.mediana} | ${t.temblorCents.mediana} | ${t.h1h2.mediana} | ${t.brillo.mediana} | ${t.altura.mediana} |`);
  }
  const md = lineas.join('\n');
  writeFileSync(join(SOL, 'tabla.md'), md + '\n');
  console.log(md);
}
