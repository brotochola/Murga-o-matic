// banco_sintetizar.mjs — vuelve a cantar con el coro sintético cada fragmento real del banco: las mismas notas, en los
// mismos segundos (las de la transcripción), con «la» o con la letra si está en murga_trabajo/banco/letras/<id>.txt
// (un verso por línea). Sale en mono, como las voces separadas, para comparar con banco_medir.py.
//
//   node herramientas/banco_sintetizar.mjs [--motor formantes|difonos|banco] [--variacion params.json] [--salida dir] [--solo id] [--exportar]
//     --motor       formantes (cantor.js, el de siempre), difonos (difonos.js con MBROLA y la voz es2) o banco (las voces de
//                   los bancos de UTAU del plantel, bancos/plantel.json: cada lugar con su voz de la «murga»)
//     --voz         con banco: el nombre de una voz del plantel para todos (si no, la murga del plantel)
//     --plantel p   con banco: otro plantel (por defecto bancos/plantel.json)
//     --emision 0   difonos sin la emisión murguera de difonos.js (para medir el timbre crudo)
//     --curva no    sin la curva de ecualización (para medir el timbre crudo, como hace herramientas/curva_difonos.py)
//     --letra frases  sin letra, cada golpe con la sílaba que sigue de las 24 frases de solista.mjs (si no, «la»/«a»)
//     --variacion   cuánto se diferencian los cantores (lo que prueba banco_ajustar.py); si no, motor/cantor/variacion.js
//     --exportar    además, cada cantor por separado y un manifiesto, para transcripcion/convertir_coro.py (Seed-VC)
//     --ids a,b     sólo esos fragmentos      --sala 0.24   cuánta sala se le suma (las grabaciones tienen la suya; 0 = seco)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cantar } from '../motor/cantor/cantor.js';
import { CORO, volumenDe } from '../motor/cantor/coro.js';
import { ecualizar } from '../motor/cantor/eq.js';
import { CURVA } from '../motor/cantor/timbre.js';
import { RANGOS } from '../motor/compositor.js';
import { sala } from '../motor/cantor/mezcla.js';
import { versosDe, silabasCantadas, alinear, partes } from '../motor/cantor/letra.js';
import { VARIACION, VARIACION_DIFONOS } from '../motor/cantor/variacion.js';
import { crearMbrola } from '../motor/cantor/mbrola.js';
import { cantarDifonos, cantorDifonos, remuestrear, vozDelCantor } from '../motor/cantor/difonos.js';
import { cantarBanco } from '../motor/cantor/banco.js';
import { crearWorld } from '../motor/cantor/world.js';
import { opcionesDe } from '../motor/cantor/murga_bancos.js';
import { abrirBancoNode, CACHE_NODE } from './banco_node.mjs';
import { FRASES } from './solista.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRABAJO = resolve(process.env.MURGA_TRABAJO || join(RAIZ, 'murga_trabajo'));
const BANCO = join(TRABAJO, 'banco');
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const SR = 44100;
const variacion = arg('variacion') ? JSON.parse(readFileSync(arg('variacion'), 'utf8')) : null;
const SAL = resolve(arg('salida', join(BANCO, 'sintetico')));
const MOTOR = arg('motor', 'formantes');
// --voz es2|es1: todos con esa voz (para medir el timbre de cada una); --voz coro: como la página (vozDelCantor)
const VOZ = arg('voz', 'coro'), mbs = {};
// --opc brillo=1,color=0: opciones de cada cantor de difonos (las de cantorDifonos), para medir
const OPC = Object.fromEntries((arg('opc', '') || '').split(',').filter(Boolean).map(e => e.split('=')).map(([k, v]) => [k, +v]));
if (MOTOR === 'difonos') for (const v of VOZ === 'coro' ? ['es2', 'es1', 'es4'] : [VOZ]) mbs[v] = await crearMbrola(readFileSync(join(RAIZ, 'motor/vendor/mbrola/mbrola.wasm')), readFileSync(join(RAIZ, 'motor/vendor/mbrola', v)));
// los bancos: el plantel, WORLD y cada banco abierto una vez (con su análisis guardado)
const PL = MOTOR === 'banco' ? JSON.parse(readFileSync(arg('plantel', join(RAIZ, 'bancos', 'plantel.json')), 'utf8')) : null;
const mundo = MOTOR === 'banco' ? await crearWorld(readFileSync(join(RAIZ, 'motor/vendor/world/world.wasm'))) : null;
const bancosAbiertos = new Map();
const elBanco = b => { if (!bancosAbiertos.has(b)) bancosAbiertos.set(b, { b: abrirBancoNode(b), cache: new Map() }); return bancosAbiertos.get(b); };
if (MOTOR === 'banco') for (const v of ['es2', 'es1']) mbs[v] = await crearMbrola(readFileSync(join(RAIZ, 'motor/vendor/mbrola/mbrola.wasm')), readFileSync(join(RAIZ, 'motor/vendor/mbrola', v)));
// los difonos y los bancos llevan su color adentro (difonos.js, cantor por cantor; los bancos, el de sus grabaciones)
const LA_CURVA = arg('curva') === 'no' || MOTOR === 'difonos' || MOTOR === 'banco' ? null : CURVA;
const igualar = (x) => LA_CURVA ? ecualizar(x, SR, LA_CURVA) : Float32Array.from(x);
const solo = arg('solo'), exportar = args.includes('--exportar'), ids = arg('ids') ? new Set(arg('ids').split(',')) : null, cuantaSala = +arg('sala', .24);
mkdirSync(SAL, { recursive: true });

const wav = (ruta, x) => {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  writeFileSync(ruta, b);
};
const LA = { ataque: ['l'], nucleo: ['a'], coda: [] }, A = { ataque: [], nucleo: ['a'], coda: [] };
// --letra frases: sin la letra de verdad, cada golpe canta la sílaba que sigue de las 24 frases de solista.mjs (las
// consonantes de una letra en castellano, que hacen los huecos entre sílabas como en el coro real). Si no, «la» después
// de un silencio y «a» en lo ligado: sin consonantes, el hueco entre golpes queda chato.
const CORRIDA = arg('letra') === 'frases' ? FRASES.flatMap(t => silabasCantadas(t).map(x => partes(x.fon))) : null;

const fragmentos = JSON.parse(readFileSync(join(BANCO, 'fragmentos.json'), 'utf8')).filter(f => (!solo || f.id === solo) && (!ids || ids.has(f.id)));
for (const f of fragmentos) {
  const an = JSON.parse(readFileSync(join(TRABAJO, 'analisis', f.tramo + '.json'), 'utf8'));
  // los golpes del fragmento, con sus segundos
  const G = [];
  an.golpes.forEach(([q, d, ps], i) => { const [t0, t1] = an.segs[i]; if (t0 >= f.t0 && t0 < f.t1 - .05) G.push({ q, d, ps: [...ps].sort((a, b) => b - a), t0: t0 - f.t0, t1: Math.min(t1, f.t1) - f.t0, i: G.length }); });
  // sílaba de cada golpe: la letra si está, si no «la»
  const silDe = new Map();
  const archLetra = join(BANCO, 'letras', f.id + '.txt');
  if (existsSync(archLetra)) {
    const lineas = readFileSync(archLetra, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const V = versosDe(G.map(g => ({ q: g.q - G[0].q, d: g.d, p: g.ps[0], i: g.i })));
    V.forEach((v, k) => {
      const texto = lineas[k]; if (!texto) return;
      const r = alinear(silabasCantadas(texto), v.golpes); if (!r) return;
      for (const { sil, notas } of r.reparto) {
        const p = partes(sil.fon);
        notas.forEach((n, j) => {
          const g = G[n.i], ultima = j === notas.length - 1;
          const vocal = p.nucleo.filter(x => 'aeiou'.includes(x)).slice(-1);
          const s = j === 0 ? { ataque: p.ataque, nucleo: p.nucleo, coda: ultima ? p.coda : [] } : { ataque: [], nucleo: vocal.length ? vocal : ['a'], coda: ultima ? p.coda : [] };
          // nota partida en dos sílabas: cada mitad con su tiempo
          const t0 = g.t0 + (n.q - (g.q - G[0].q)) / g.d * (g.t1 - g.t0), t1 = t0 + n.d / g.d * (g.t1 - g.t0);
          (silDe.get(g.i) || silDe.set(g.i, []).get(g.i)).push({ s, t0, t1 });
        });
      }
    });
  }
  // de cada golpe, qué canta cada cuerda (como el compositor: por registro; en unísono, todos los que llegan)
  const lineas = Object.fromEntries(Object.entries(CORO).map(([k, c]) => [k, Array.from({ length: c.cantores }, () => [])]));
  let finAnt = -1, kCorrida = 0;
  for (const g of G) {
    const porCuerda = { bajos: [], segundos: [], primos: [], sobreprimos: [], tercia: [] };
    if (g.ps.length === 1) { for (const k of ['bajos', 'segundos', 'primos', 'sobreprimos']) if (g.ps[0] >= RANGOS[k][0] && g.ps[0] <= RANGOS[k][1]) porCuerda[k].push(g.ps[0]); if (!Object.values(porCuerda).some(l => l.length)) porCuerda.primos.push(g.ps[0]); }
    else {
      for (const p of g.ps) porCuerda[p >= 70 && g.ps.length >= 3 ? 'tercia' : p >= 65 ? 'sobreprimos' : p >= 56 ? 'primos' : p >= 48 ? 'segundos' : 'bajos'].push(p);
      // bajos y segundos, una sola cuerda grave: si el golpe no les da nota, cantan la más grave (como compositor.js)
      const grave = g.ps[g.ps.length - 1];
      for (const k of ['bajos', 'segundos']) if (!porCuerda[k].length && grave >= RANGOS[k][0] && grave <= RANGOS[k][1]) porCuerda[k].push(grave);
    }
    // sin letra, «la»; acentuada si cae en el tiempo (para el cantor de difonos, que marca los acentos)
    const silabas = silDe.get(g.i) || [{ s: { ...(CORRIDA ? CORRIDA[kCorrida++ % CORRIDA.length] : g.t0 - finAnt > .15 ? LA : A), acento: g.q % 4 === 0 }, t0: g.t0, t1: g.t1 }];
    for (const [k, ps] of Object.entries(porCuerda)) {
      if (!ps.length) continue;
      const n = lineas[k].length;
      for (let c = 0; c < n; c++) {
        const p = ps[Math.min(ps.length - 1, Math.floor(c * ps.length / n))];
        for (const x of silabas) lineas[k][c].push({ t0: x.t0, t1: x.t0 + (x.t1 - x.t0) * (g.d >= 3 ? .97 : .9), midi: p, vel: .8, sil: x.s });
      }
    }
    finAnt = g.t1;
  }
  // cantan (siempre los mismos cantores, así dos variaciones se comparan con el mismo azar)
  const largo = f.t1 - f.t0, n = Math.ceil(largo * SR), voz = new Float32Array(n), ruido = new Float32Array(n);
  const cantores = []; let idx = 0;
  for (const [k, ls] of Object.entries(lineas)) ls.forEach((notas, c) => {
    if (!notas.length) return;
    for (let i = 0; i + 1 < notas.length; i++) { const h = notas[i + 1].t0 - notas[i].t1; if (h > 0 && h < .25) notas[i].t1 = notas[i + 1].t0; }
    const V = { ...VARIACION, ...(MOTOR === 'difonos' ? VARIACION_DIFONOS : {}), ...(variacion || {}) }, lider = c === 0 && ls.length > 1;
    const cfg = CORO[k], semilla = 1000 + idx * 7;
    const ganancia = cfg.ganancia / Math.sqrt(cfg.cantores) * (lider && V.liderDb ? Math.pow(10, V.liderDb / 20) : 1) * volumenDe(semilla, V);
    const ret = lider && V.liderAdelanto ? -V.liderAdelanto : 0;
    let r;
    if (MOTOR === 'difonos') {
      // el cantor de difonos de la página: su cuerda (tracto) y sus mañas; sale a la frecuencia de la voz y se pasa a SR
      const voz = VOZ === 'coro' ? vozDelCantor(c) : VOZ;
      const o = { ...cantorDifonos(k, semilla, { c, V }), voz, ...OPC, ...(arg('emision') != null ? { emision: +arg('emision') } : {}), ...(arg('curva') === 'no' ? { curva: null } : {}) };
      const d = cantarDifonos(mbs[voz], notas, { ...o, retraso: o.retraso + ret });
      const y = remuestrear(d.x, d.sr, SR), desde = Math.round(d.inicio * SR), z = new Float32Array(n);
      for (let s = 0; s < y.length; s++) { const j = desde + s; if (j >= 0 && j < n) z[j] = y[s]; }
      r = { voz: z, ruido: new Float32Array(n) };
    } else if (MOTOR === 'banco') {
      // la voz del lugar según la murga del plantel (o --voz para todos), con las opciones de un cantor de su cuerda
      const nombre = VOZ !== 'coro' ? VOZ : PL.murga[k + c], voz = PL.voces.find(v => v.nombre === nombre) || PL.voces.find(v => v.mbrola);
      const { motor, opc } = opcionesDe({ cuerda: k, c, semilla, retraso: ret }, voz, 0, variacion || null);
      const o = { ...opc, ...OPC };
      const d = motor === 'banco' ? cantarBanco(elBanco(voz.banco).b, mundo, notas, { ...o, cache: elBanco(voz.banco).cache, cacheMax: CACHE_NODE }) : cantarDifonos(mbs[o.voz] || mbs.es2, notas, o);
      const y = d.sr === SR ? d.x : remuestrear(d.x, d.sr, SR), desde = Math.round(d.inicio * SR), z = new Float32Array(n);
      for (let s = 0; s < y.length; s++) { const j = desde + s; if (j >= 0 && j < n) z[j] = y[s]; }
      r = { voz: z, ruido: new Float32Array(n) };
    } else r = cantar(notas, { sr: SR, tipo: cfg.tipo, semilla, separar: true, variacion: variacion || undefined, retraso: ret });
    const m = Math.min(n, r.voz.length);
    for (let s = 0; s < m; s++) { voz[s] += r.voz[s] * ganancia; ruido[s] += r.ruido[s] * ganancia; }
    cantores.push({ k, c, ganancia, pan: Math.max(-1, Math.min(1, cfg.pan + (c - (cfg.cantores - 1) / 2) * .12)), r, n: notas.length });
    idx++;
  });
  const e = igualar(voz);
  for (let s = 0; s < n; s++) e[s] += ruido[s];
  if (cuantaSala > 0) { const R = Float32Array.from(e); sala(e, R, SR, { mezcla: cuantaSala, largo: 1.7 }); }
  let pk = 1e-9; for (const v of e) pk = Math.max(pk, Math.abs(v));
  for (let s = 0; s < n; s++) e[s] *= .7 / pk;
  wav(join(SAL, f.id + '.wav'), e);
  if (exportar) {
    // cada cantor seco y ecualizado, con un manifiesto como el de exportar_voces.mjs (la batería, en silencio)
    const dir = join(SAL, f.id); mkdirSync(join(dir, 'voces'), { recursive: true });
    const man = { sr: SR, largo, pieza: { nombre: f.id, murga: f.murga }, cantores: [], bateria: { archivo: 'bateria.wav', relacion: 0 }, sala: { mezcla: .24, largo: 1.7 } };
    cantores.forEach((x, i) => {
      const y = new Float32Array(n); y.set(x.r.voz.subarray(0, n));
      const z = igualar(y); for (let s = 0; s < Math.min(n, x.r.ruido.length); s++) z[s] += x.r.ruido[s];
      let p = 1e-9; for (const v of z) p = Math.max(p, Math.abs(v)); for (let s = 0; s < n; s++) z[s] *= .7 / p;
      const archivo = `voces/${String(i + 1).padStart(2, '0')}_${x.k}.wav`; wav(join(dir, archivo), z);
      man.cantores.push({ archivo, cuerda: x.k, tipo: CORO[x.k].tipo, pan: +x.pan.toFixed(3), ganancia: +(x.ganancia * p / .7).toFixed(5), copias: null, notas: x.n });
    });
    wav(join(dir, 'bateria.wav'), new Float32Array(n));
    writeFileSync(join(dir, 'manifiesto.json'), JSON.stringify(man, null, 1));
  }
  process.stdout.write(`  ${f.id}: ${G.length} golpes, ${cantores.length} cantores${silDe.size ? ', con letra' : ''}\n`);
}
