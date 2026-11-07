// Zoom de un pasaje: node herramientas/zoom.js nombre desde hasta [salida.png]
import { writeFileSync } from 'node:fs';
import { cargar } from './corpus.js';
import { Lienzo } from './png.js';
const [nombre, d, h, sal] = process.argv.slice(2);
const t = cargar(nombre), b0 = +d, b1 = +h;
const N = t.notas.filter(n => n.fin > b0 && n.b < b1);
const lo = Math.min(...N.map(n => n.p)) - 2, hi = Math.max(...N.map(n => n.p)) + 2;
const PB = Math.min(40, Math.floor(1560 / (b1 - b0))), PS = 12;
const L = new Lienzo((b1 - b0) * PB + 2, (hi - lo) * PS);
const pcNegra = [1, 3, 6, 8, 10];
for (let p = lo; p < hi; p++) { const y = (hi - 1 - p) * PS; L.rect(0, y, L.an, PS, pcNegra.includes(p % 12) ? [238, 240, 246] : [252, 252, 254]); if (p % 12 === 0) L.rect(0, y + PS - 1, L.an, 1, [120, 130, 170]); }
for (let i = 0; i <= (b1 - b0) * 4; i++) { const b = i / 4; L.rect(b * PB, 0, 1, L.al, i % 16 === 0 ? [90, 90, 100] : i % 4 === 0 ? [170, 170, 185] : [232, 232, 238]); }
for (const n of N) L.rect((n.b - b0) * PB + 1, (hi - 1 - n.p) * PS + 1, Math.max(3, (n.fin - n.b) * PB - 2), PS - 2, [25, 40, 120]);
writeFileSync(sal || 'D:/tmp/murga/zoom.png', L.png());
console.log('pulsos', b0, b1, 'notas', N.length, 'rango', lo + 2, hi - 2, 'do en líneas');
