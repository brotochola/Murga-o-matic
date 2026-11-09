// banco_alias.mjs — qué pedazos del banco le tocan a cada sílaba de una frase, para revisar las tablas de banco.js
// sin cantar. Por cada nota: la sílaba, sus fonemas y las unidades (alias, tipo) que eligió aliasFrase; con «!» las
// que el banco no tiene y con «?» lo que se quería y no estaba (faltan).
//
//   node herramientas/banco_alias.mjs <banco> [--evitar _F] [--frase "texto" | --n 3,7] [--oto]
//     sin --frase ni --n: las 24 frases del solista. --oto: también el archivo y los números de cada pedazo.
import { abrirBancoNode } from './banco_node.mjs';
import { aliasFrase } from '../motor/cantor/banco.js';
import { FRASES, melodia } from './solista.mjs';

const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const nombre = args[0];
if (!nombre || nombre.startsWith('--')) { console.log('uso: node herramientas/banco_alias.mjs <banco> [--evitar _F] [--frase "texto" | --n 3,7] [--oto]'); process.exit(1); }
const banco = abrirBancoNode(nombre), evitar = arg('evitar') ? arg('evitar').split(',') : null, oto = args.includes('--oto');
const frases = arg('frase') ? [arg('frase')] : arg('n') ? arg('n').split(',').map(k => FRASES[+k - 1]) : FRASES;
console.log(`${nombre}: reclist ${banco.reclist}, ${banco.entradas.length} entradas`);
const todas = new Map();
for (const texto of frases) {
  const notas = melodia(texto);
  const U = aliasFrase(notas, banco.existe, { reclist: banco.reclist });
  console.log('\n' + texto);
  notas.forEach((n, i) => {
    const us = U.filter(u => u.nota === i).map(u => {
      const e = banco.buscar(u.alias, n.midi, evitar);
      return (e ? '' : '!') + `[${u.alias}]` + (u.tipo === 'cv' ? '' : u.tipo[0]) + (oto && e ? `(${e.archivo.split('/').pop()} ${e.offset}/${e.consonante}/${e.cutoff}/${e.pre}/${e.overlap})` : '');
    });
    console.log(`  ${n.texto.padEnd(10)} ${n.fon.join(' ').padEnd(12)} ${us.join(' ')}`);
  });
  if (U.faltan.length) { console.log('  ? ' + U.faltan.join(' | ')); for (const f of U.faltan) todas.set(f, (todas.get(f) || 0) + 1); }
}
if (todas.size) console.log('\nfaltan en total: ' + [...todas].sort((a, b) => b[1] - a[1]).map(([a, k]) => `${a} ×${k}`).join(', '));
