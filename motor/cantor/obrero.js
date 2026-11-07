// obrero.js — canta un cantor sintético fuera del hilo de la página, así varios cantan a la vez y la página no se traba.
import { cantar } from './cantor.js';

self.onmessage = ({ data: { id, notas, opc } }) => {
  try {
    const { voz, ruido } = cantar(notas, { ...opc, separar: true });
    self.postMessage({ id, voz, ruido }, [voz.buffer, ruido.buffer]);
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
};
