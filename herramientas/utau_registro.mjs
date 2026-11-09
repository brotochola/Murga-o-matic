// utau_registro.mjs — ¿pecho o falsete? Para cada altura grabada de un banco, en sus vocales sostenidas: la altura,
// H1−H2 (la fundamental contra el segundo armónico: en falsete la fundamental manda y H1−H2 sube mucho) y el brillo
// (lo de arriba de 1,8 kHz frente al total). Sirve de pista, no de veredicto: se juzga de oído.
//
//   node herramientas/utau_registro.mjs <carpeta del banco> [<otra> ...]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearBanco, nombreNota } from '../motor/cantor/banco.js';
import { crearWorld } from '../motor/cantor/world.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const world = await crearWorld(readFileSync(join(RAIZ, 'motor', 'vendor', 'world', 'world.wasm')));
// las vocales sostenidas de cada reclist: el alias de una vocal sola, o el de empezar con vocal
const VOCALES = ['- a', '- あ', 'a', '- .a', 'a a', 'あ', '- e', '- え', 'e', '- o', '- お', 'o'];

for (const C of process.argv.slice(2)) {
  const rutas = [];
  (function andar(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else rutas.push(relative(C, p).split(/[\\/]/).join('/')); } })(C);
  const banco = crearBanco(rutas, r => { try { return new Uint8Array(readFileSync(join(C, r))); } catch { return null; } });
  console.log(`\n${banco.nombre} (${banco.reclist}, ${banco.entradas.length} entradas${banco.sinArchivo ? `, ${banco.sinArchivo} SIN SU .WAV` : ''})`);
  console.log('sufijo     altura grabada  H1−H2   brillo');
  // los sufijos: los del prefix.map y los colores que aparecen en los alias (_dp, _sf...)
  const sufijos = new Set(banco.alturas.map(a => a.sufijo));
  for (const a of banco.indice.keys()) { const m = /(_[a-zA-Z]{1,3}|_?[A-G]#?\d)$/.exec(a); if (m && VOCALES.some(v => a === v + m[1])) sufijos.add(m[1]); }
  for (const suf of [...sufijos].sort()) {
    const f0s = [], h12 = [], br = [];
    for (const v of VOCALES) {
      const e = banco.indice.get(v + suf); if (!e) continue;
      const w = banco.wav(e.archivo); if (!w) continue;
      // la parte estirable del pedazo: la vocal sostenida
      const a0 = Math.round((e.offset + e.consonante) / 1000 * w.sr), len = e.cutoff < 0 ? -e.cutoff : w.x.length / w.sr * 1000 - e.offset - e.cutoff;
      const a1 = Math.min(w.x.length, Math.round((e.offset + len) / 1000 * w.sr));
      if (a1 - a0 < w.sr * .08) continue;
      const an = world.analizar(Float64Array.from(w.x.subarray(a0, a1)), w.sr, { harvest: false, f0min: 70, f0max: 900 });
      for (let q = 0; q < an.cuadros; q++) {
        const f0 = an.f0[q]; if (!(f0 > 0)) continue;
        const b = h => an.sp[q * an.ancho + Math.round(h * f0 * an.fft / w.sr)];
        let tot = 0, alto = 0; for (let k = 0; k < an.ancho; k++) { const x = an.sp[q * an.ancho + k]; tot += x; if (k * w.sr / an.fft > 1800) alto += x; }
        f0s.push(f0); h12.push(10 * Math.log10(b(1) / b(2))); br.push(10 * Math.log10(alto / tot));
      }
    }
    if (!f0s.length) continue;
    const med = x => { const s = [...x].sort((p, q) => p - q); return s[s.length >> 1]; };
    const f = med(f0s);
    console.log(`${(suf || '(ninguno)').padEnd(10)} ${f.toFixed(0).padStart(4)} Hz ${nombreNota(Math.round(69 + 12 * Math.log2(f / 440))).padEnd(4)} ${med(h12).toFixed(1).padStart(6)} dB ${med(br).toFixed(1).padStart(6)} dB`);
  }
}
