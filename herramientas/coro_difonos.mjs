// coro_difonos.mjs — las frases del banco del solista cantadas por el coro entero, para medir si se entiende la letra
// cuando cantan todos: primos con la melodía, segundos y bajos una tercera abajo y sobreprimos una tercera arriba,
// con la cantidad de cantores, los volúmenes y los corrimientos de coro.js. El mismo coro se canta con
// difonos (difonos.js + MBROLA), con formantes (cantor.js) o con las voces de los bancos de UTAU (banco: cada lugar con
// su voz del plantel, bancos/plantel.json); herramientas/solista_jurado.py los juzga.
//
//   node herramientas/coro_difonos.mjs [--motor difonos|formantes|banco] [--voz coro|es2|es1] [--opc desfase=0,retraso=0]
//     [--plantel otro_plantel.json]   (banco: otro reparto de voces, para comparar)
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMbrola } from '../motor/cantor/mbrola.js';
import { cantarDifonos, cantorDifonos, remuestrear, vozDelCantor, DIFERENCIA } from '../motor/cantor/difonos.js';
import { cantar } from '../motor/cantor/cantor.js';
import { CORO, volumenDe } from '../motor/cantor/coro.js';
import { VARIACION } from '../motor/cantor/variacion.js';
import { FRASES, melodia } from './solista.mjs';
import { cantarBanco } from '../motor/cantor/banco.js';
import { crearWorld } from '../motor/cantor/world.js';
import { opcionesDe } from '../motor/cantor/murga_bancos.js';
import { abrirBancoNode, CACHE_NODE } from './banco_node.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRABAJO = resolve(process.env.MURGA_TRABAJO || join(RAIZ, 'murga_trabajo'));
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const MOTOR = arg('motor', 'difonos'), VOZ = arg('voz', 'coro'), SR = 32000;
// --dif reparto=.5,timbre=3: otra diferencia entre cantores (DIFERENCIA de difonos.js), para probar
const DIF = arg('dif') ? { ...DIFERENCIA, ...Object.fromEntries(arg('dif').split(',').map(e => e.split('=')).map(([k, v]) => [k, +v])) } : DIFERENCIA;
const SEMILLA = +arg('semilla', 7);   // otra semilla: otros cantores (para no sacar conclusiones de un solo coro)
const VOCES_PRUEBA = arg('voces') ? arg('voces').split(',') : null;   // --voces es2,es1: otra rueda de voces, para probar
const EXTRA = Object.fromEntries((arg('opc', '') || '').split(',').filter(Boolean).map(e => e.split('=')).map(([k, v]) => [k, +v]));
const SAL = join(TRABAJO, 'solista', 'coro_' + MOTOR + (MOTOR === 'difonos' && VOZ !== 'coro' ? '_' + VOZ : '') + (VOCES_PRUEBA ? '_' + VOCES_PRUEBA.join('') : '') + (arg('dif') ? '_' + arg('dif').replace(/[=,]/g, '') : '') + (SEMILLA !== 7 ? '_s' + SEMILLA : '') + (arg('opc') ? '_' + arg('opc').replace(/[=,]/g, '') : '') + (arg('plantel') ? '_' + basename(arg('plantel'), '.json') : '')); mkdirSync(SAL, { recursive: true });
// cada cuerda: cuánto se corre la melodía (grados de la escala y semitonos)
// (los bajos, con los segundos: la cuerda grave, como en compositor.js; antes iban una octava abajo de la melodía)
const LINEAS = { bajos: { grados: -2, sube: 0 }, segundos: { grados: -2, sube: 0 }, primos: { grados: 0, sube: 0 }, sobreprimos: { grados: 2, sube: 0 } };

const wav = (ruta, x) => {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  writeFileSync(ruta, b);
};
// --voz coro (como la página: es2 y es1 alternadas en cada cuerda) o una sola voz para todos
const mbs = {};
if (MOTOR === 'difonos') for (const v of VOZ === 'coro' ? ['es2', 'es1', 'es4'] : [VOZ]) mbs[v] = await crearMbrola(readFileSync(join(RAIZ, 'motor/vendor/mbrola/mbrola.wasm')), readFileSync(join(RAIZ, 'motor/vendor/mbrola', v)));

// los bancos: el plantel, WORLD y cada banco abierto una vez
const PL = MOTOR === 'banco' ? JSON.parse(readFileSync(arg('plantel') || join(RAIZ, 'bancos', 'plantel.json'), 'utf8')) : null;
const mundo = MOTOR === 'banco' ? await crearWorld(readFileSync(join(RAIZ, 'motor/vendor/world/world.wasm'))) : null;
const abiertos = new Map(), elBanco = b => { if (!abiertos.has(b)) abiertos.set(b, { b: abrirBancoNode(b), cache: new Map() }); return abiertos.get(b); };
if (MOTOR === 'banco') for (const v of ['es2', 'es1']) mbs[v] = await crearMbrola(readFileSync(join(RAIZ, 'motor/vendor/mbrola/mbrola.wasm')), readFileSync(join(RAIZ, 'motor/vendor/mbrola', v)));
const lista = [];
for (const [k, texto] of FRASES.entries()) {
  let mezcla = new Float32Array(0), n = 0;
  const sumar = (y, g) => { if (y.length > mezcla.length) { const m = new Float32Array(y.length); m.set(mezcla); mezcla = m; } for (let i = 0; i < y.length; i++) mezcla[i] += y[i] * g; };
  for (const [cuerda, L] of Object.entries(LINEAS)) {
    const cfg = CORO[cuerda];
    for (let c = 0; c < cfg.cantores; c++) {
      const sem = SEMILLA * 101 + (n++) * 7, lider = c === 0 && cfg.cantores > 1;
      const g = cfg.ganancia / Math.sqrt(cfg.cantores) * (lider ? Math.pow(10, VARIACION.liderDb / 20) : 1) * volumenDe(sem);
      const ret = lider ? -VARIACION.liderAdelanto : 0;
      const notas = melodia(texto, L).map(x => ({ t0: x.t0, t1: x.t1, midi: x.midi, vel: x.vel, sil: x.sil }));
      if (MOTOR === 'difonos') {
        const voz = VOCES_PRUEBA ? VOCES_PRUEBA[c % VOCES_PRUEBA.length] : VOZ === 'coro' ? vozDelCantor(c) : VOZ;
        const o = { ...cantorDifonos(cuerda, sem, { c, D: DIF }), voz, ...EXTRA };
        const r = cantarDifonos(mbs[voz], notas, { ...o, retraso: o.retraso + ret });
        const y = remuestrear(r.x, r.sr, SR), desde = Math.round(r.inicio * SR), z = new Float32Array(Math.max(0, desde) + y.length);
        z.set(desde >= 0 ? y : y.subarray(-desde), Math.max(0, desde)); sumar(z, g);
      } else if (MOTOR === 'banco') {
        const voz = PL.voces.find(v => v.nombre === PL.murga[cuerda + c]) || PL.voces.find(v => v.mbrola);
        const { motor, opc } = opcionesDe({ cuerda, c, semilla: sem, retraso: ret }, voz);
        const o = { ...opc, ...EXTRA };
        const r = motor === 'banco' ? cantarBanco(elBanco(voz.banco).b, mundo, notas, { ...o, cache: elBanco(voz.banco).cache, cacheMax: CACHE_NODE }) : cantarDifonos(mbs[o.voz] || mbs.es2, notas, o);
        const y = remuestrear(r.x, r.sr, SR), desde = Math.round(r.inicio * SR), z = new Float32Array(Math.max(0, desde) + y.length);
        z.set(desde >= 0 ? y : y.subarray(-desde), Math.max(0, desde)); sumar(z, g);
      } else sumar(cantar(notas, { sr: SR, tipo: cfg.tipo, semilla: sem, retraso: ret }), g);
    }
  }
  let m = 0; for (const v of mezcla) m = Math.max(m, Math.abs(v));
  const nombre = String(k + 1).padStart(2, '0') + '.wav';
  wav(join(SAL, nombre), mezcla.map(v => v * .8 / (m || 1)));
  lista.push({ archivo: nombre, texto });
}
writeFileSync(join(SAL, 'frases.json'), JSON.stringify({ motor: 'coro ' + MOTOR, frases: lista }, null, 1));
console.log(`${lista.length} frases → ${SAL}`);
