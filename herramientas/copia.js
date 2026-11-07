// ¿El motor copia? Busca el pasaje más largo de lo generado que sea igual a uno del corpus:
// misma melodía (intervalos, en cualquier tono) y mismo ritmo. Lo que no se mueve no cuenta.
//   node herramientas/copia.js
import { componer, CUERDAS } from '../motor/compositor.js';
import { MODELO } from '../motor/modelo.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TRABAJO } from './corpus.js';
import { cargarAnalisis } from './medir.js';

const N_MIN = 6;

// Fichas: intervalo con la nota anterior y distancia al golpe anterior
function fichas(top) {
  const f = [];
  for (let i = 1; i < top.length; i++) f.push(`${top[i].p - top[i - 1].p}:${top[i].q - top[i - 1].q}`);
  return f;
}
const interesante = f => new Set(f.map(x => x.split(':')[0])).size >= 3;

export function indiceCorpus(lista) {
  const I = new Map();
  for (const an of lista) {
    const top = an.golpes.map(([q, , ps]) => ({ q, p: ps[ps.length - 1] }));
    const f = fichas(top);
    for (let i = 0; i + N_MIN <= f.length; i++) {
      const g = f.slice(i, i + N_MIN);
      if (!interesante(g)) continue;
      const k = g.join(' ');
      if (!I.has(k)) I.set(k, []);
      I.get(k).push([an.nombre, f, i]);
    }
  }
  return I;
}

// Devuelve el largo en notas del pasaje copiado más largo, y de qué tema
export function masLargo(top, I) {
  const f = fichas(top);
  let mej = 0, de = null;
  for (let i = 0; i + N_MIN <= f.length; i++) {
    const g = f.slice(i, i + N_MIN);
    const hits = I.get(g.join(' '));
    if (!hits) continue;
    for (const [nombre, otro, j] of hits) {
      let n = N_MIN;
      while (i + n < f.length && j + n < otro.length && f[i + n] === otro[j + n]) n++;
      if (n > mej) { mej = n; de = nombre; }
    }
  }
  return { largo: mej ? mej + 1 : 0, de };
}

export function melodiaDePieza(P) {
  const top = new Map();
  for (const k of CUERDAS) for (const [q, , p] of P.ev[k]) if (!top.has(q) || top.get(q) < p) top.set(q, p);
  return [...top.entries()].sort((a, b) => a[0] - b[0]).map(([q, p]) => ({ q, p }));
}

if (process.argv[1]?.endsWith('copia.js')) {
  const L = cargarAnalisis();
  const I = indiceCorpus(L);
  console.log(`corpus: ${L.length} tramos, ${I.size} pasajes de ${N_MIN + 1} notas`);
  const peores = [];
  for (const forma of ['presentacion', 'retirada']) for (const estilo of Object.keys(MODELO.estilos)) for (let s = 1; s <= 30; s++) {
    const P = componer(MODELO, { forma, estilo, semilla: s, tonica: s % 12, modo: s % 3 ? 'menor' : 'mayor' });
    const r = masLargo(melodiaDePieza(P), I);
    peores.push({ forma, estilo, s, ...r });
  }
  peores.sort((a, b) => b.largo - a.largo);
  const h = {}; for (const p of peores) h[p.largo] = (h[p.largo] || 0) + 1;
  console.log('largo del pasaje igual (notas): piezas', JSON.stringify(h));
  console.log('peor:', peores[0]);
  const v = peores.map(p => p.largo).sort((a, b) => a - b);
  writeFileSync(join(TRABAJO, 'copia.json'), JSON.stringify({ piezas: v.length, mediana: v[v.length >> 1], maximo: v[v.length - 1] }));
}
