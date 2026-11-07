// Elige las mejores semillas según el jurado: las demos que ofrece la página.
//   node herramientas/demos.js [semillas por caso]
// Pruebas muchas semillas y se queda con la mejor de cada caso, pidiendo además que no copie.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './corpus.js';
import { componer } from '../motor/compositor.js';
import { MODELO } from '../motor/modelo.js';
import { cargarAnalisis } from './medir.js';
import { rasgos, rasgosReal, normas, nota, notasDePieza } from './jurado.js';
import { indiceCorpus, masLargo, melodiaDePieza } from './copia.js';

const N_SEM = +process.argv[2] || 60;
const L = cargarAnalisis();
const N = normas(L.map(rasgosReal));
const I = indiceCorpus(L);
const modoDe = (estilo, forma) => { const h = MODELO.estilos[estilo]?.modo?.[forma]; return h && h.mayor >= h.menor ? 'mayor' : 'menor'; };
const TONOS = { trasnochada: { presentacion: 11, retirada: 9 }, catalina: { presentacion: 9, retirada: 9 }, todas: { presentacion: 9, retirada: 9 } };
const casos = [];
for (const estilo of ['trasnochada', 'catalina']) for (const forma of ['presentacion', 'retirada']) casos.push({ estilo, forma });

const demos = [];
for (const c of casos) {
  const modo = modoDe(c.estilo, c.forma), tonica = TONOS[c.estilo]?.[c.forma] ?? 9;
  const R = [];
  for (let s = 1; s <= N_SEM; s++) {
    const op = { forma: c.forma, estilo: c.estilo, semilla: s, tonica, modo };
    const P = componer(MODELO, op);
    const n = nota(rasgos(notasDePieza(P)), N);
    const cop = masLargo(melodiaDePieza(P), I).largo;
    R.push({ s, n: n.total, cop });
  }
  const buenos = R.filter(r => r.cop <= 10).sort((a, b) => b.n - a.n);
  const m = buenos[0] || R.sort((a, b) => b.n - a.n)[0];
  demos.push({ ...c, modo, tonica, semilla: m.s, nota: +m.n.toFixed(1) });
  console.log(`${c.forma.padEnd(13)} ${c.estilo.padEnd(12)} ${modo.padEnd(6)} semilla ${String(m.s).padEnd(4)} nota ${m.n.toFixed(1)}  copia ${m.cop}  (mediana ${R.map(r => r.n).sort((a, b) => a - b)[R.length >> 1].toFixed(1)})`);
}
writeFileSync(join(RAIZ, 'motor', 'demos.js'), '// Generado por herramientas/demos.js: las semillas que mejor le caen al jurado.\nexport const DEMOS = ' + JSON.stringify(demos) + ';\n');
