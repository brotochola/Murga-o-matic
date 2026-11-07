// La forma de cada tramo: bloques con batería o a capela, tempo, tonalidad, y cómo termina.
//   node herramientas/forma.js
import { cargarAnalisis } from './medir.js';
import { nomPc } from './midi.js';

const mediana = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

// Segundos con batería: la energía de lo que no es voz, relativa a la del tramo
export function bloques(an) {
  const e = an.energia, n = e.vocals.length;
  const resto = e.vocals.map((_, i) => (e.drums[i] || 0) + (e.other[i] || 0) + (e.bass?.[i] || 0));
  const ref = [...resto].sort((a, b) => a - b)[Math.floor(n * .8)] || 1;
  const voz = [...e.vocals].sort((a, b) => a - b)[Math.floor(n * .8)] || 1;
  const hay = resto.map(v => v > .28 * ref), canta = e.vocals.map(v => v > .12 * voz);
  // suavizar: 6 segundos
  const liso = hay.map((_, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 6); j <= Math.min(n - 1, i + 6); j++) { s += hay[j] ? 1 : 0; c++; } return s / c > .5; });
  const B = []; let ini = 0;
  for (let i = 1; i <= n; i++) if (i === n || liso[i] !== liso[ini]) { B.push({ t0: ini / 2, t1: i / 2, bat: liso[ini], canta: canta.slice(ini, i).filter(Boolean).length / (i - ini) }); ini = i; }
  // unir bloques muy cortos con el vecino
  for (let i = B.length - 2; i > 0; i--) if (B[i].t1 - B[i].t0 < 5) { B[i - 1].t1 = B[i + 1].t1; B.splice(i, 2); }
  return B;
}

export function tempoEn(an, t0, t1) {
  const v = an.bpm.slice(Math.floor(t0), Math.ceil(t1)).filter(Boolean);
  return v.length ? Math.round(mediana(v)) : null;
}

// La tonalidad más frecuente de un pasaje
export function tonoNumEn(an, t0, t1) {
  const h = {};
  for (const n of an.notas) {
    if (n[3] < t0 || n[3] >= t1) continue;
    const a = an.acordes[Math.min(an.acordes.length - 1, Math.floor(n[0]))];
    if (a) { const k = a[2] + ':' + a[3]; h[k] = (h[k] || 0) + 1; }
  }
  const e = Object.entries(h).sort((a, b) => b[1] - a[1])[0];
  if (!e) return null;
  const [t, m] = e[0].split(':').map(Number);
  return { t, mayor: !!m };
}

function tonoEn(an, t0, t1) {
  const notas = an.notas.filter(n => n[3] >= t0 && n[3] < t1);
  if (!notas.length) return '';
  const h = {};
  for (const n of notas) { const a = an.acordes[Math.min(an.acordes.length - 1, Math.floor(n[0]))]; if (a) { const k = nomPc(a[2]) + (a[3] ? '' : 'm'); h[k] = (h[k] || 0) + 1; } }
  return Object.entries(h).sort((a, b) => b[1] - a[1])[0][0];
}

if (process.argv[1]?.endsWith('forma.js')) {
  const L = cargarAnalisis().sort((a, b) => a.parte.localeCompare(b.parte) || a.murga.localeCompare(b.murga) || a.anio - b.anio);
  let parte = '';
  for (const an of L) {
    if (an.parte !== parte) { parte = an.parte; console.log('\n── ' + parte); }
    const B = bloques(an);
    const txt = B.map(b => `${b.bat ? 'BAT' : 'cap'} ${Math.round(b.t1 - b.t0)}s ${tempoEn(an, b.t0, b.t1) ?? '?'}bpm ${tonoEn(an, b.t0, b.t1)}`).join(' | ');
    console.log(`${(an.murga.split(' ').pop().slice(0, 6) + ' ' + an.anio).padEnd(12)} ${String(Math.round(an.largo_s)).padStart(4)}s  ${txt}`);
  }
}
