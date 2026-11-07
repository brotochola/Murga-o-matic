// Dibuja una pieza generada, como las imágenes de revisión de los tramos reales.
//   node herramientas/ver_pieza.js retirada 3 [estilo] [salida.png]
import { writeFileSync } from 'node:fs';
import { componer, CUERDAS } from '../motor/compositor.js';
import { MODELO } from '../motor/modelo.js';
import { Lienzo } from './png.js';

const [forma = 'presentacion', semilla = '1', estilo = 'todas', sal = 'D:/tmp/murga/pieza.png'] = process.argv.slice(2);
const P = componer(MODELO, { forma, semilla: +semilla, estilo, tonica: 9, modo: 'menor' });
const PB = 7, PST = 4, POR_FILA = 228, LO = 38, HI = 82, ALTO = (HI - LO) * PST, SEP = 12;
const beats = P.total / 4, filas = Math.max(1, Math.ceil(beats / POR_FILA));
const L = new Lienzo(POR_FILA * PB + 4, filas * (ALTO + SEP));
for (let f = 0; f < filas; f++) {
  const y0 = f * (ALTO + SEP);
  L.rect(0, y0, L.an, ALTO, [255, 255, 255]);
  for (let p = LO; p < HI; p++) if (p % 12 === 0) L.rect(0, y0 + (HI - p) * PST - 1, L.an, 1, [214, 220, 235]);
  for (let b = 0; b <= POR_FILA; b += 4) L.rect(b * PB, y0, 1, ALTO, b % 16 === 0 ? [170, 170, 185] : [232, 232, 238]);
}
const color = { bajos: [190, 50, 40], segundos: [200, 120, 20], primos: [30, 40, 120], sobreprimos: [15, 135, 125], tercia: [140, 60, 180] };
for (const k of CUERDAS) for (const [q, d, p] of P.ev[k]) {
  const b = q / 4, f = Math.floor(b / POR_FILA), y0 = f * (ALTO + SEP);
  L.rect((b - f * POR_FILA) * PB, y0 + (HI - p) * PST - PST + 1, Math.max(2, d / 4 * PB - 1), PST - 1, color[k]);
}
for (const s of P.secs) { const b = s.inicio / 4, f = Math.floor(b / POR_FILA); L.rect((b - f * POR_FILA) * PB, f * (ALTO + SEP), 2, ALTO, s.bateria ? [30, 170, 90] : [230, 40, 40]); }
writeFileSync(sal, L.png());
console.log(P.secs.map(s => `${s.nombre} (${s.compases})`).join(' · '));
