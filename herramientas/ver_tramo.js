// Dibuja un tramo: rollo de notas por pulsos, con la energía de las voces y de la percusión abajo.
//   node herramientas/ver_tramo.js nombre [nombre…]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cargar, nombres, REVISION } from './corpus.js';
import { Lienzo } from './png.js';

const PB = 7, PST = 4, POR_FILA = 228, LO = 38, HI = 82;
const ALTO = (HI - LO) * PST, FRANJA = 16, SEP = 10;

export function dibujar(t, quitadas = new Set(), marcas = []) {
  const N = t.notas;
  const bFin = Math.ceil(Math.max(...N.map(n => n.fin))) + 2;
  const filas = Math.max(1, Math.ceil(bFin / POR_FILA));
  const L = new Lienzo(POR_FILA * PB + 4, filas * (ALTO + FRANJA * 2 + SEP));
  const e = t.datos.energia;
  const resto = e.vocals.map((_, i) => (e.drums[i] || 0) + (e.other[i] || 0) + (e.bass?.[i] || 0));
  const maxV = Math.max(...e.vocals, 1e-6), maxR = Math.max(...resto, 1e-6);
  // de pulsos a segundos, para leer la energía
  const seg = b => t.aSeg(b);
  for (let f = 0; f < filas; f++) {
    const y0 = f * (ALTO + FRANJA * 2 + SEP);
    L.rect(0, y0, L.an, ALTO, [255, 255, 255]);
    // octavas (do) y mi central de referencia
    for (let p = LO; p < HI; p++) if (p % 12 === 0) L.rect(0, y0 + (HI - p) * PST - 1, L.an, 1, [214, 220, 235]);
    for (let b = 0; b <= POR_FILA; b += 4) L.rect(b * PB, y0, 1, ALTO, b % 16 === 0 ? [170, 170, 185] : [232, 232, 238]);
    // energía
    for (let b = 0; b < POR_FILA; b++) {
      const beat = f * POR_FILA + b;
      if (beat > bFin) break;
      const k = Math.floor(seg(beat + .5) * 2);
      const v = (e.vocals[k] || 0) / maxV, r = (resto[k] || 0) / maxR;
      L.rect(b * PB, y0 + ALTO + FRANJA - v * FRANJA, PB, v * FRANJA, [60, 120, 210]);
      L.rect(b * PB, y0 + ALTO + 2 * FRANJA - r * FRANJA, PB, r * FRANJA, [230, 140, 30]);
    }
    for (const m of marcas) {
      const b = m.b - f * POR_FILA;
      if (b >= 0 && b < POR_FILA) L.rect(b * PB, y0, 2, ALTO, m.color || [30, 170, 90]);
    }
  }
  N.forEach((n, i) => {
    const f = Math.floor(n.b / POR_FILA);
    const y0 = f * (ALTO + FRANJA * 2 + SEP);
    const x = (n.b - f * POR_FILA) * PB, w = Math.max(2, (n.fin - n.b) * PB - 1);
    const c = quitadas.has(i) ? [225, 40, 40] : [25, 30, 80];
    L.rect(x, y0 + (HI - n.p) * PST - PST + 1, w, PST - 1, c);
  });
  return L.png();
}

if (process.argv[1]?.endsWith('ver_tramo.js')) {
  mkdirSync(REVISION, { recursive: true });
  const lista = process.argv.length > 2 ? process.argv.slice(2) : nombres();
  for (const n of lista) {
    const t = cargar(n);
    writeFileSync(join(REVISION, n + '.png'), dibujar(t));
    console.log(n, t.notas.length, 'notas');
  }
}
