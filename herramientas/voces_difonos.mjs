// voces_difonos.mjs — la misma frase cantada por cantores de cada cuerda, con el cantor de difonos (difonos.js +
// MBROLA), para escucharlos uno por uno. La melodía es la del banco del solista, llevada al registro de cada cuerda.
// Sale un wav por cantor y uno por cuerda (sus cantores uno detrás del otro) en murga_trabajo/solista/cuerdas/.
//
//   node herramientas/voces_difonos.mjs ["frase"] [--voz es2] [--opc clave=valor,clave=valor]
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearMbrola } from '../motor/cantor/mbrola.js';
import { cantarDifonos, cantorDifonos, remuestrear } from '../motor/cantor/difonos.js';
import { CORO } from '../motor/cantor/coro.js';
import { melodia } from './solista.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRABAJO = resolve(process.env.MURGA_TRABAJO || join(RAIZ, 'murga_trabajo'));
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const FRASE = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) || 'Vengo a cantarle al barrio que me vio crecer';
const VOZ = arg('voz', 'es2'), SR = 44100;
const EXTRA = Object.fromEntries((arg('opc', '') || '').split(',').filter(Boolean).map(e => e.split('=')).map(([k, v]) => [k, +v]));
const SAL = join(TRABAJO, 'solista', 'cuerdas'); mkdirSync(SAL, { recursive: true });
// la melodía del banco va de Sol 3 a Fa# 4: a cada cuerda, a su registro (compositor.js, RANGOS)
const SUBE = { bajos: -12, segundos: -7, primos: 0, sobreprimos: 5, tercia: 8 };   // cerca de la mediana de cada cuerda en lo que compone
const CUANTOS = { bajos: 2, segundos: 2, primos: 2, sobreprimos: 2, tercia: 1 };

const wav = (ruta, x) => {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  writeFileSync(ruta, b);
};
const mb = await crearMbrola(readFileSync(join(RAIZ, 'motor/vendor/mbrola/mbrola.wasm')), readFileSync(join(RAIZ, 'motor/vendor/mbrola', VOZ)));
const resumen = [];
for (const [cuerda, cfg] of Object.entries(CORO)) {
  const partes = [];
  for (let c = 0; c < CUANTOS[cuerda]; c++) {
    const semilla = 100 + Object.keys(CORO).indexOf(cuerda) * 10 + c;
    const opc = { ...cantorDifonos(cuerda, semilla), ...EXTRA };
    const notas = melodia(FRASE, { sube: SUBE[cuerda] });
    const r = cantarDifonos(mb, notas, opc);
    let y = remuestrear(r.x, r.sr, SR);
    let m = 0; for (const v of y) m = Math.max(m, Math.abs(v)); y = y.map(v => v * .8 / (m || 1));
    const nombre = `${cuerda}_${c + 1}`;
    wav(join(SAL, nombre + '.wav'), y); partes.push(y);
    resumen.push({ nombre, tipo: cfg.tipo, tracto: +opc.tracto.toFixed(3), afinacion: +opc.transporte.toFixed(3), vibrato: +opc.vibrato.toFixed(3), consonantes: +opc.consonantes.toFixed(3), notas: [Math.min(...notas.map(n => n.midi)), Math.max(...notas.map(n => n.midi))] });
  }
  const pausa = new Float32Array(Math.round(.6 * SR)), todo = new Float32Array(partes.reduce((a, p) => a + p.length + pausa.length, 0));
  let k = 0; for (const p of partes) { todo.set(p, k); k += p.length + pausa.length; }
  wav(join(SAL, cuerda + '.wav'), todo);
}
writeFileSync(join(SAL, 'cantores.json'), JSON.stringify({ frase: FRASE, voz: VOZ, extra: EXTRA, cantores: resumen }, null, 1));
console.table(resumen);
