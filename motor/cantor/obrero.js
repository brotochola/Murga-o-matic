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

// La memoria de cantores enteros (bancos y formantes; los de difonos tienen la suya, por frase: difonos.js): si un
// cantor vuelve con las mismas notas y opciones (la página cambió a otro de su cuerda, su volumen o su paneo), sale de
// acá en vez de cantar otra vez. En 16 bits; hasta MEMO_MAX muestras por obrero (unos 130 MB), sale el menos usado.
// La clave es todo lo que canta (JSON de opciones y notas): con el vibrato de una pasada, una frase depende de las de
// antes, así que no se guarda por frase como en difonos.js.
const MEMO = new Map(); let memoN = 0; const MEMO_MAX = 64e6;
// cada arreglo con su escala (los de formantes pasan de 1 antes de mezclarse)
function a16(x) { let p = 1; for (const v of x) if (Math.abs(v) > p) p = Math.abs(v); const k = 32767 / p; return { q: Int16Array.from(x, v => Math.round(v * k)), p }; }
const a32 = ({ q, p }) => { const k = p / 32767; return Float32Array.from(q, v => v * k); };
function recordar(clave, r, arrays) {
  const m = { ...r }; let n = 0;
  for (const k of arrays) { m[k] = a16(r[k]); n += r[k].length; }
  m.n = n; MEMO.set(clave, m); memoN += n;
  for (const [c, v] of MEMO) { if (memoN <= MEMO_MAX) break; MEMO.delete(c); memoN -= v.n; }
}
function deMemoria(clave, arrays) {
  const m = MEMO.get(clave); if (!m) return null;
  MEMO.delete(clave); MEMO.set(clave, m);
  const r = { ...m }; delete r.n;
  for (const k of arrays) r[k] = a32(m[k]);
  return r;
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
      const clave = 'banco|' + JSON.stringify([opc, notas]), m = deMemoria(clave, ['x']);
      if (m) { self.postMessage({ id, ...m }, [m.x.buffer]); return; }
      const [{ cantarBanco, archivosQueUsa }, b, w] = await Promise.all([import('./banco.js'), bancos[opc.banco], elMundo()]);
      await b.preparar(archivosQueUsa(b, notas, opc));
      const { x, sr, inicio, faltan } = cantarBanco(b, w, notas, { ...opc, cache: b.cacheAnalisis });
      const r = { x, sr, inicio, faltan: [...new Set(faltan || [])] };
      recordar(clave, r, ['x']);
      self.postMessage({ id, ...r }, [x.buffer]);
      return;
    }
    if (motor === 'difonos') {
      const [{ cantarDifonos }, mb] = await Promise.all([import('./difonos.js'), vozMbrola(opc.voz || 'es2')]);
      const { x, sr, inicio } = cantarDifonos(mb, notas, opc);
      self.postMessage({ id, x, sr, inicio }, [x.buffer]);
      return;
    }
    // los de formantes: con memo, la misma memoria que los bancos (la página lo pide cuando canta cada uno con su voz)
    const clave = opc.memo ? 'formantes|' + JSON.stringify([opc, notas]) : null, m = clave && deMemoria(clave, ['voz', 'ruido']);
    if (m) { self.postMessage({ id, ...m }, [m.voz.buffer, m.ruido.buffer]); return; }
    const { voz, ruido } = cantar(notas, { ...opc, separar: true });
    if (clave) recordar(clave, { voz, ruido }, ['voz', 'ruido']);
    self.postMessage({ id, voz, ruido }, [voz.buffer, ruido.buffer]);
  } catch (e) {
    self.postMessage({ id, error: String(e?.message || e) });
  }
};
