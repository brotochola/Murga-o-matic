// Mide todos los tramos analizados e imprime las tablas: la base del documento de análisis y del modelo.
//   node herramientas/medir.js [--murga Trasnochada] [--parte presentacion]
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TRABAJO } from './corpus.js';
import { compasesDe, frasesDe, gradoSimple, mod } from './compas.js';
import { nomPc } from './midi.js';

const DIR = join(TRABAJO, 'analisis');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
export const cargarAnalisis = () => (existsSync(DIR) ? readdirSync(DIR) : []).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(DIR, f), 'utf8')));

const cnt = (h, k, v = 1) => { h[k] = (h[k] || 0) + v; };
const top = (h, n = 14) => { const t = Object.values(h).reduce((a, b) => a + b, 0) || 1; return Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${Math.round(100 * v / t)}%`).join('   '); };
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const pc = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

export function medir(lista) {
  const M = { tramos: [], ritmo8: {}, ritmo16: {}, largoNota: {}, grados: { mayor: {}, menor: {} }, bigramas: { mayor: {}, menor: {} }, cuatro: { mayor: {}, menor: {} }, cambioAcorde: {}, voces: {}, vecinas: {}, mov: {}, tipoNota: {}, finFrase: {}, inicioFrase: {}, largoFrase: {}, loops: {} };
  for (const an of lista) {
    const C = compasesDe(an), F = frasesDe(an);
    const conB = C.filter(c => c.bat).length;
    const bpm = med(an.bpm);
    M.tramos.push({ nombre: an.nombre, parte: an.parte, murga: an.murga, anio: an.anio, largo: an.largo_s, bpm, compases: C.length, conBat: conB, frases: F.length, notas: an.n_notas });
    for (const c of C) {
      if (c.loop) cnt(M.loops, c.loop);
      if (c.golpes.length >= 2 && c.qf - c.q0 === 16) {
        let s = ''; const set = new Set(c.golpes.map(g => g.pos));
        for (let i = 0; i < 16; i++) s += set.has(i) ? 'x' : '.';
        cnt(M.ritmo16, s);
        cnt(M.ritmo8, s.slice(0, 8)); cnt(M.ritmo8, s.slice(8));
      }
      const acs = c.acordes;
      for (const a of acs) {
        cnt(M.grados[a.mayor ? 'mayor' : 'menor'], a.g);
      }
      for (let i = 1; i < acs.length; i++) if (acs[i].g !== acs[i - 1].g) cnt(M.cambioAcorde, acs[i].pos);
    }
    // bigramas de acordes, sin repetir
    const seq = [];
    for (const a of an.acordes) { const g = gradoSimple(a[0], a[1], a[2]); if (!seq.length || seq[seq.length - 1][0] !== g) seq.push([g, a[3] ? 'mayor' : 'menor', 1]); else seq[seq.length - 1][2]++; }
    for (let i = 1; i < seq.length; i++) if (seq[i][1] === seq[i - 1][1]) cnt(M.bigramas[seq[i][1]], seq[i - 1][0] + ' → ' + seq[i][0]);
    for (let i = 3; i < seq.length; i++) if (seq[i][1] === seq[i - 3][1]) cnt(M.cuatro[seq[i][1]], seq.slice(i - 3, i + 1).map(s => s[0]).join(' '));
    for (const [q, d, ps, lin] of an.golpes) {
      cnt(M.voces, ps.length);
      cnt(M.largoNota, Math.min(d, 16));
      for (let i = 1; i < ps.length; i++) cnt(M.vecinas, ps[i] - ps[i - 1]);
      const a = an.acordes[Math.floor(q / 4)];
      if (a) for (const p of ps) {
        const iv = mod(p - a[0], 12);
        const r = q % 4 === 0;
        cnt(M.tipoNota, (r ? 'tiempo ' : 'otro   ') + iv);
      }
    }
    for (const l of [0, 1, 2, 3]) {
      const s = an.golpes.map(g => g[3][l]).filter(x => x !== null);
      for (let i = 1; i < s.length; i++) { const d = Math.abs(s[i] - s[i - 1]); cnt(M.mov, d === 0 ? 'repite' : d <= 2 ? 'grado' : d <= 4 ? 'tercera' : d <= 7 ? 'cuarta/quinta' : 'salto'); }
    }
    for (const f of F) {
      const largoQ = f[f.length - 1].q + f[f.length - 1].d - f[0].q;
      cnt(M.largoFrase, Math.round(largoQ / 16 * 2) / 2);
      cnt(M.inicioFrase, mod(f[0].q - (C.find(c => c.q0 <= f[0].q && f[0].q < c.qf)?.q0 ?? 0), 16));
    }
  }
  return M;
}

if (process.argv[1]?.endsWith('medir.js')) {
  let L = cargarAnalisis();
  if (arg('murga')) L = L.filter(a => a.murga.includes(arg('murga')));
  if (arg('parte')) L = L.filter(a => a.parte.includes(arg('parte')));
  const M = medir(L);
  console.log(`${L.length} tramos`);
  for (const t of M.tramos) console.log(`  ${t.nombre.padEnd(46)} ${String(Math.round(t.largo)).padStart(4)} s  ${String(t.bpm).padStart(5)} bpm  ${String(t.compases).padStart(4)} comp (${Math.round(100 * t.conBat / t.compases)}% bat)  ${String(t.frases).padStart(3)} frases`);
  console.log('\nvoces por golpe   ', top(M.voces));
  console.log('intervalo vecinas ', top(M.vecinas));
  console.log('movimiento líneas ', top(M.mov));
  console.log('largo de nota (16)', top(M.largoNota));
  console.log('largo de frase    ', top(M.largoFrase));
  console.log('inicio de frase   ', top(M.inicioFrase));
  console.log('cambio de acorde  ', top(M.cambioAcorde));
  console.log('loops             ', top(M.loops));
  console.log('\nritmos de medio compás\n  ', top(M.ritmo8, 16));
  console.log('\nritmos de compás\n  ', top(M.ritmo16, 12));
  for (const m of ['mayor', 'menor']) {
    console.log(`\n${m}: acordes   `, top(M.grados[m], 16));
    console.log(`${m}: pasos     `, top(M.bigramas[m], 16));
    console.log(`${m}: de a cuatro`, top(M.cuatro[m], 12));
  }
  const tn = {}; for (const [k, v] of Object.entries(M.tipoNota)) cnt(tn, k, v);
  console.log('\nnota respecto de la fundamental\n  ', top(tn, 24));
}
