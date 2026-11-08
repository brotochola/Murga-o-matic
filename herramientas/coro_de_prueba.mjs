// coro_de_prueba.mjs — un coro de murga con las notas conocidas, para medir cuánto se equivocan Demucs y MuScriptor.
//
// Compone piezas con el motor, les pone letra, canta los 13 cantores sintéticos y guarda, por pieza:
//   verdad.json        cada nota de cada cantor (segundos y MIDI) y la cuerda; es lo que el transcriptor debería escribir
//   voces.wav          el coro solo, seco                                  → sin separar: el mejor caso posible
//   mezcla.wav         coro con sala + batería al nivel real (mediana del corpus: batería 8,7 dB debajo del coro)
//   mezcla_fuerte.wav  igual, con la batería fuerte (3 dB debajo, como en el 10 % más fuerte del corpus)
//   tv.wav             mezcla + ruido de público; transcripcion/banco_pruebas.py la pasa por Opus a 128 kb/s, como YouTube
//   voces_mezcla.wav   el coro con sala, exactamente el que va en las mezclas: la separación perfecta
//
//   node herramientas/coro_de_prueba.mjs [--salida murga_trabajo/pruebas/coros] [--solo p3] [--sufijo b]
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { componer } from '../motor/compositor.js';
import { MODELO } from '../motor/modelo.js';
import { tiempos, metrica, silabear, cantores } from '../motor/cantor/coro.js';
import { mezclarCoro, sala } from '../motor/cantor/mezcla.js';
import { renderBateria } from '../motor/cantor/bateria.js';
import { partesAEscribir } from '../motor/cantor/letrista.js';
import { escribirLetraLocal } from '../motor/cantor/letrista_local.js';
import { DATOS } from '../motor/cantor/datos.js';
import { CURVA } from '../motor/cantor/timbre.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const SAL = resolve(arg('salida', join(RAIZ, 'murga_trabajo', 'pruebas', 'coros')));
const SR = 44100;
// --sufijo b: las mismas piezas con la variación entre cantores de ahora (motor/cantor/variacion.js), en otra carpeta
const SUFIJO = arg('sufijo', '');

// Piezas variadas: las dos partes, los dos estilos, mayor y menor, tonos distintos
export const PIEZAS = [
  { id: 'p1', forma: 'presentacion', estilo: 'trasnochada', semilla: 11, tonica: 1, modo: 'menor', largo: 'corta' },
  { id: 'p2', forma: 'retirada', estilo: 'catalina', semilla: 12, tonica: 7, modo: 'mayor', largo: 'corta' },
  { id: 'p3', forma: 'presentacion', estilo: 'catalina', semilla: 13, tonica: 4, modo: 'mayor', largo: 'corta' },
  { id: 'p4', forma: 'retirada', estilo: 'trasnochada', semilla: 14, tonica: 9, modo: 'menor', largo: 'corta' },
  { id: 'p5', forma: 'presentacion', estilo: 'todas', semilla: 15, tonica: 10, modo: 'menor', largo: 'corta' },
];

const LLAMADAS = Object.fromEntries(DATOS.ritmos.map(r => { const a = DATOS.acompana[r.id]; if (!a || !a[0]) return [r.id, 0]; const c4 = r.compas * 4 / r.tpc; return [r.id, Math.ceil((DATOS.frases[a[0]].ultimo + .05) / c4)]; }));

const wav = (ruta, L, R) => {
  const n = L.length, ch = R ? 2 : 1, b = Buffer.alloc(44 + n * 2 * ch);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2 * ch, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2 * ch, 28); b.writeUInt16LE(2 * ch, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2 * ch, 40);
  const q = v => Math.max(-32767, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0, o = 44; i < n; i++) { b.writeInt16LE(q(L[i]), o); o += 2; if (R) { b.writeInt16LE(q(R[i]), o); o += 2; } }
  writeFileSync(ruta, b);
};
const leerWav = archivo => { const b = readFileSync(join(RAIZ, archivo)); const sr = b.readUInt32LE(24); let o = 12; while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4); const m = b.readUInt32LE(o + 4) / 2, d = new Float32Array(m); for (let i = 0; i < m; i++) d[i] = b.readInt16LE(o + 8 + i * 2) / 32768; return { sr, datos: d }; };

// RMS por medio segundo, como la "energia" que guarda murga_lote.py
const rmsMedio = x => { const p = SR / 2, r = []; for (let i = 0; i + p <= x.length; i += p) { let s = 0; for (let j = i; j < i + p; j++) s += x[j] * x[j]; r.push(Math.sqrt(s / p)); } return r; };
// ganancia que deja la batería a `db` del coro, en la mediana de los medios segundos donde suenan los dos
function gananciaBateria(coro, bat, db) {
  const a = rmsMedio(coro), b = rmsMedio(bat), r = [];
  const ta = Math.max(...a) * .1, tb = Math.max(...b) * .1;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] > ta && b[i] > tb) r.push(b[i] / a[i]);
  r.sort((x, y) => x - y);
  return r.length ? Math.pow(10, db / 20) / r[r.length >> 1] : 0;
}
function pico(...xs) { let p = 1e-9; for (const x of xs) for (const v of x) p = Math.max(p, Math.abs(v)); return p; }
// ruido rosa de público con bultos lentos (aplausos, gritos lejanos), a `db` del RMS del coro
function publico(n, rmsCoro, db, semilla) {
  let s = semilla >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const y = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0, env = 0, objetivo = .5;
  for (let i = 0; i < n; i++) {
    const w = r(); b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913;
    if (i % 4410 === 0) objetivo = .3 + .7 * Math.abs(r());
    env += (objetivo - env) * .0002;
    y[i] = (b0 + b1 + b2 + w * .1848) * env;
  }
  let e = 0; for (const v of y) e += v * v; e = Math.sqrt(e / n);
  const k = rmsCoro * Math.pow(10, db / 20) / e; for (let i = 0; i < n; i++) y[i] *= k;
  return y;
}

async function pieza(op) {
  const dir = join(SAL, op.id + SUFIJO);
  if (existsSync(join(dir, 'verdad.json')) && !args.includes('--rejilla')) { console.log(`${op.id}: ya estaba`); return; }
  mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  const P = componer(MODELO, { ...op, llamadas: LLAMADAS });
  const { T, fin } = tiempos(P); P.total = fin; P.T = T;
  const M = metrica(P), partes = partesAEscribir(M, op.forma);
  const { textos } = escribirLetraLocal({ forma: op.forma, tema: '', metrica: M, semilla: op.semilla * 1000 + 1 });
  const letras = {}; partes.forEach((p, i) => { for (const s of p.secciones) letras[s] = textos[i]; });
  const { porQ } = silabear(P, letras);
  const lista = cantores(P, porQ, { semilla: op.semilla });
  const largo = fin + 1.6, n = Math.ceil(largo * SR);
  // la grilla exacta: el segundo de cada semicorchea (con los calderones de los pasajes a capela)
  const rejilla = []; for (let q = 0; q <= P.secs.at(-1).inicio + P.secs.at(-1).largo; q++) rejilla.push(+T(q).toFixed(4));
  if (args.includes('--rejilla')) { const v = JSON.parse(readFileSync(join(dir, 'verdad.json'), 'utf8')); v.rejilla = rejilla; writeFileSync(join(dir, 'verdad.json'), JSON.stringify(v)); console.log(`${op.id}${SUFIJO}: rejilla agregada`); return; }

  // la verdad: cada cantor con sus notas, y las secciones (con o sin batería, tempo)
  const verdad = {
    pieza: op, largo: +largo.toFixed(3), rejilla,
    secciones: P.secs.map(s => ({ nombre: s.nombre, tipo: s.tipo, t0: +s.t0.toFixed(3), t1: +s.t1.toFixed(3), tempo: s.tempo, bateria: !!s.bateria })),
    cantores: lista.map(c => ({ cuerda: c.cuerda, tipo: c.tipo, notas: c.notas.map(x => [+x.t0.toFixed(4), +x.t1.toFixed(4), x.midi]) })),
  };

  const coro = mezclarCoro(lista, SR, largo, null, { curva: CURVA });
  const k = .5 / pico(coro.L, coro.R);
  for (let i = 0; i < n; i++) { coro.L[i] *= k; coro.R[i] *= k; }
  wav(join(dir, 'voces.wav'), coro.L, coro.R);
  const S = { L: Float32Array.from(coro.L), R: Float32Array.from(coro.R) };
  sala(S.L, S.R, SR, { mezcla: .24, largo: 1.7 });
  const mono = new Float32Array(n); for (let i = 0; i < n; i++) mono[i] = (S.L[i] + S.R[i]) / 2;

  const bat = await renderBateria(P, DATOS, async a => leerWav(a), SR, largo);
  const mezclar = (db, ruidoDb) => {
    const g = gananciaBateria(mono, bat, db);
    const L = new Float32Array(n), R = new Float32Array(n);
    let pub = null;
    if (ruidoDb != null) { let e = 0; for (const v of mono) e += v * v; pub = publico(n, Math.sqrt(e / n), ruidoDb, op.semilla * 7 + 3); }
    for (let i = 0; i < n; i++) { const b = (bat[i] || 0) * g, z = pub ? pub[i] : 0; L[i] = S.L[i] + b * .95 + z; R[i] = S.R[i] + b * 1.05 + z * .9; }
    return { L, R, g };
  };
  const m = mezclar(-8.7), mf = mezclar(-3), tv = mezclar(-8.7, -24);
  // todas al mismo pico, para que las voces separadas se puedan comparar con voces_mezcla
  const kk = .89 / pico(m.L, m.R, mf.L, mf.R, tv.L, tv.R);
  const esc = x => { for (let i = 0; i < n; i++) x[i] *= kk; return x; };
  wav(join(dir, 'mezcla.wav'), esc(m.L), esc(m.R));
  wav(join(dir, 'mezcla_fuerte.wav'), esc(mf.L), esc(mf.R));
  wav(join(dir, 'tv.wav'), esc(tv.L), esc(tv.R));
  wav(join(dir, 'voces_mezcla.wav'), esc(Float32Array.from(S.L)), esc(Float32Array.from(S.R)));
  verdad.ganancias = { voces_mezcla: kk, bateria_mediana: m.g * kk, bateria_fuerte: mf.g * kk };
  writeFileSync(join(dir, 'verdad.json'), JSON.stringify(verdad));
  writeFileSync(join(dir, 'letra.txt'), partes.map((p, i) => textos[i].join('\n')).join('\n\n') + '\n');
  const nn = verdad.cantores.reduce((a, c) => a + c.notas.length, 0);
  console.log(`${op.id}: ${op.forma} ${op.estilo}, ${fin.toFixed(1)} s, ${lista.length} cantores, ${nn} notas de cantor, en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const solo = arg('solo', null);
  for (const op of PIEZAS) if (!solo || op.id === solo) await pieza(op);
}
