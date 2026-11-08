// bloques_forma.mjs — la forma por bloques (con batería / a capela, de 4 s o más), real contra generado.
//   node herramientas/bloques_forma.mjs
import { componer } from '../motor/compositor.js';
import { MODELO } from '../motor/modelo.js';
import { tiempos } from '../motor/cantor/coro.js';
import { cargarAnalisis } from './medir.js';
import { bloques, tempoEn } from './forma.js';
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const resumen = B => { const tot = B.reduce((a, b) => a + b.t1 - b.t0, 0); const cap = B.filter(b => !b.bat && b.t1 - b.t0 >= 4); const capMedio = cap.filter(b => b.t0 > 20 && b.t1 < tot - 5);
  return { largo: tot, nCap: cap.length, nCapMedio: capMedio.length, fracCap: cap.reduce((a, b) => a + b.t1 - b.t0, 0) / tot, durCapMedio: med(capMedio.map(b => b.t1 - b.t0)), nBloques: B.length }; };
const show = (nom, L) => console.log(nom.padEnd(18), ['largo', 'nBloques', 'nCap', 'nCapMedio', 'fracCap', 'durCapMedio'].map(k => (k + ' ' + (med(L.map(x => x[k]).filter(v => v != null)) ?? 0).toFixed(k === 'fracCap' ? 2 : 0)).padEnd(15)).join(''));
const R = cargarAnalisis().filter(a => a.energia);
for (const parte of ['presentacion', 'retirada']) {
  show('real ' + parte, R.filter(a => (parte === 'retirada') === a.parte.includes('retirada')).map(a => resumen(bloques(a).filter(b => b.t1 - b.t0 >= 4))));
  const L = [];
  for (const estilo of ['trasnochada', 'catalina', 'todas']) for (let s = 1; s <= 10; s++) {
    const P = componer(MODELO, { forma: parte, estilo, semilla: s, tonica: s % 12, modo: s % 2 ? 'menor' : 'mayor' });
    const { T } = tiempos(P);
    const B = []; for (const sec of P.secs) { const t0 = T(sec.inicio), t1 = T(sec.inicio + sec.largo); const bat = !!sec.bateria || sec.tipo === 'llamada'; const u = B[B.length - 1]; if (u && u.bat === bat) u.t1 = t1; else B.push({ t0, t1, bat }); }
    L.push(resumen(B));
  }
  show('motor ' + parte, L);
}
