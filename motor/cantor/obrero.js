// obrero.js — canta un cantor sintético fuera del hilo de la página, así varios cantan a la vez y la página no se traba.
// Dos motores: el de formantes (cantor.js) y el de difonos (difonos.js con MBROLA, que se carga la primera vez).
import { cantar } from './cantor.js';

const voces = {};
async function vozMbrola(nombre) {
  if (!voces[nombre]) voces[nombre] = (async () => {
    const [{ crearMbrola }, wasm, voz] = await Promise.all([
      import('./mbrola.js'),
      fetch(new URL('../vendor/mbrola/mbrola.wasm', import.meta.url)).then(r => { if (!r.ok) throw new Error('no se pudo bajar MBROLA'); return r.arrayBuffer(); }),
      fetch(new URL(`../vendor/mbrola/${nombre}`, import.meta.url)).then(r => { if (!r.ok) throw new Error(`no se pudo bajar la voz ${nombre}`); return r.arrayBuffer(); }),
    ]);
    return crearMbrola(wasm, new Uint8Array(voz));
  })();
  return voces[nombre];
}

self.onmessage = async ({ data: { id, notas, opc, motor } }) => {
  try {
    if (motor === 'difonos') {
      const [{ cantarDifonos }, mb] = await Promise.all([import('./difonos.js'), vozMbrola(opc.voz || 'es2')]);
      const { x, sr, inicio } = cantarDifonos(mb, notas, opc);
      self.postMessage({ id, x, sr, inicio }, [x.buffer]);
      return;
    }
    const { voz, ruido } = cantar(notas, { ...opc, separar: true });
    self.postMessage({ id, voz, ruido }, [voz.buffer, ruido.buffer]);
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
};
