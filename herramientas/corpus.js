// Carga los tramos transcriptos: el MIDI de voces y los datos del tramo.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leerMidi } from './midi.js';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// MURGA_CARPETA=tomas: las mismas herramientas sobre otra carpeta de trabajo (murga_trabajo/tomas)
export const TRABAJO = join(RAIZ, 'murga_trabajo', process.env.MURGA_CARPETA || '');
export const MIDIS = join(TRABAJO, 'midis');
export const REVISION = join(TRABAJO, 'revision');

export function nombres() {
  if (!existsSync(MIDIS)) return [];
  return readdirSync(MIDIS).filter(f => f.endsWith('.mid') && existsSync(join(MIDIS, f.replace('.mid', '.json')))).map(f => f.replace('.mid', '')).sort();
}

export function cargar(nombre) {
  const datos = JSON.parse(readFileSync(join(MIDIS, nombre + '.json'), 'utf8'));
  const midi = leerMidi(readFileSync(join(MIDIS, nombre + '.mid')));
  return { nombre, datos, notas: midi.notas, tpb: midi.tpb, aSeg: midi.aSeg, tempos: midi.tempos };
}
