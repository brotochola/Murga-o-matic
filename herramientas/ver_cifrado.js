// Muestra el cifrado detectado de un tramo, acorde por acorde, con su duración en pulsos.
//   node herramientas/ver_cifrado.js nombre [hasta_pulso]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TRABAJO } from './corpus.js';
import { gradoSimple } from './compas.js';
import { nomPc } from './midi.js';
const [n, tope] = process.argv.slice(2);
const an = JSON.parse(readFileSync(join(TRABAJO, 'analisis', n + '.json'), 'utf8'));
const S = [];
an.acordes.forEach(([r, q, t, may], i) => {
  const g = gradoSimple(r, q, t), k = nomPc(t) + (may ? ' mayor' : ' menor');
  const u = S[S.length - 1];
  if (u && u.g === g && u.k === k) u.n++; else S.push({ g, k, n: 1, i });
});
let k = '', lin = '';
for (const s of S) {
  if (tope && s.i > +tope) break;
  if (s.k !== k) { if (lin) console.log('   ' + lin); lin = ''; console.log(`[${s.k}] pulso ${s.i}`); k = s.k; }
  lin += `${s.g}(${s.n}) `;
  if (lin.length > 92) { console.log('   ' + lin); lin = ''; }
}
if (lin) console.log('   ' + lin);
