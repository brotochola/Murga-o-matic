// Muestra tonalidad y acordes de un tramo, de a cuatro pulsos.
//   node herramientas/ver_acordes.js nombre
import { cargar, nombres } from './corpus.js';
import { croma, tonalidades, acordes, grado, nomTono } from './analisis.js';

for (const n of process.argv.length > 2 ? process.argv.slice(2) : nombres()) {
  const t = cargar(n);
  const cr = croma(t.notas), tn = tonalidades(cr), ac = acordes(cr, tn);
  console.log(`\n${n}  ${t.notas.length} notas, ${ac.length} pulsos, largo ${t.datos.largo_s} s`);
  let lin = '', ult = null, ultT = null;
  for (let i = 0; i < ac.length; i++) {
    const k = nomTono(tn[i]);
    if (k !== ultT) { if (lin) { console.log(lin); lin = ''; } console.log(`  [${k}] desde pulso ${i}`); ultT = k; }
    if (i % 4 === 0) { if (lin) console.log(lin); lin = String(i).padStart(5) + ' '; }
    const g = grado(ac[i], tn[i]);
    lin += (g === ult ? '·' : g).padEnd(7); ult = g;
  }
  console.log(lin);
}
