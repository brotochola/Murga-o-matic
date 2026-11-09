// obrero.js — canta un cantor sintético fuera del hilo de la página, así varios cantan a la vez y la página no se traba.
// Tres motores: el de formantes (cantor.js), el de difonos (difonos.js con MBROLA, que se carga la primera vez) y el
// de los bancos de UTAU (banco.js con WORLD; el banco se le presenta antes con { tipo: 'banco', banco, fuente }, y
// lee sus .wav de la carpeta: bancos.js).
import { cantar } from './cantor.js';

const bancos = {};
let mundo = null;
const elMundo = () => (mundo ??= (async () => {
  const [{ crearWorld }, wasm] = await Promise.all([
    import('./world.js'),
    fetch(new URL('../vendor/world/world.wasm', import.meta.url)).then(r => { if (!r.ok) throw new Error('no se pudo bajar WORLD'); return r.arrayBuffer(); }),
  ]);
  return crearWorld(wasm);
})());

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

self.onmessage = async ({ data: { id, notas, opc, motor, tipo, banco, fuente } }) => {
  try {
    if (tipo === 'banco') {
      // un banco nuevo para este obrero: se arma una vez y se devuelve lo que se muestra de él
      bancos[banco] = (async () => {
        const { cargarBanco, medirAlturas } = await import('./bancos.js');
        const b = await cargarBanco(fuente);
        await medirAlturas(b, await elMundo());   // las alturas que el banco no dice
        return b;
      })();
      bancos[banco].catch(() => delete bancos[banco]);
      const { datosDe } = await import('./bancos.js');
      self.postMessage({ id, datos: datosDe(await bancos[banco]) });
      return;
    }
    if (motor === 'banco') {
      if (!bancos[opc.banco]) throw new Error(`el banco «${opc.banco}» no está cargado`);
      const [{ cantarBanco, archivosQueUsa }, b, w] = await Promise.all([import('./banco.js'), bancos[opc.banco], elMundo()]);
      await b.preparar(archivosQueUsa(b, notas, opc));
      const { x, sr, inicio, faltan } = cantarBanco(b, w, notas, { ...opc, cache: b.cacheAnalisis });
      self.postMessage({ id, x, sr, inicio, faltan: [...new Set(faltan || [])] }, [x.buffer]);
      return;
    }
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
