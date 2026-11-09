// world.js — WORLD (Morise, BSD; compilado a WebAssembly en motor/vendor/world/) en la página, en un Worker o en Node.
// Separa una grabación de voz en altura (f0), envolvente (sp: los formantes) y aire (ap), y vuelve a sintetizar con
// otra altura y otro largo sin mover los formantes. Es lo que usan los «resamplers» de UTAU más comunes.
//
//   const w = await crearWorld(bytesWasm);
//   const a = w.analizar(muestras, fs);          → { f0, sp, ap, cuadros, ancho, fft, periodo, fs }
//   const y = w.sintetizar({ ...a, f0: otraF0 }) → Float64Array

export async function crearWorld(wasm) {
  let memoria = null;
  const wasi = { fd_close: () => 0, fd_seek: () => 0, fd_write: () => 0 };
  const modulo = wasm instanceof WebAssembly.Module ? wasm : await WebAssembly.compile(wasm);
  const inst = await WebAssembly.instantiate(modulo, { wasi_snapshot_preview1: wasi });
  const X = inst.exports; memoria = X.memory;
  X._initialize?.();
  const pedir = n => { const p = X.w_alloc(Math.max(8, n * 8)); if (!p) throw new Error('WORLD: sin memoria'); return p; };
  const escribir = (p, a) => new Float64Array(memoria.buffer, p, a.length).set(a);
  const leer = (p, n) => new Float64Array(memoria.buffer, p, n).slice();

  return {
    // periodo: ms entre cuadros. harvest: la búsqueda de altura buena (lenta); si no, DIO + StoneMask.
    // f0: si ya se conoce la altura (otro análisis del mismo archivo), no se busca.
    analizar(x, fs, { periodo = 5, harvest = true, f0min = 70, f0max = 800, f0 = null } = {}) {
      const n = x.length, fft = X.w_fft(fs, f0min), ancho = fft / 2 + 1, cuadros = X.w_cuadros(fs, n, periodo);
      const px = pedir(n), pf = pedir(cuadros), pt = pedir(cuadros), ps = pedir(cuadros * ancho), pa = pedir(cuadros * ancho);
      escribir(px, x);
      if (f0) escribir(pf, f0);
      X.w_analizar(px, n, fs, periodo, harvest ? 1 : 0, f0min, f0max, fft, f0 ? 1 : 0, pf, pt, ps, pa);
      const r = { f0: leer(pf, cuadros), sp: leer(ps, cuadros * ancho), ap: leer(pa, cuadros * ancho), cuadros, ancho, fft, periodo, fs };
      for (const p of [px, pf, pt, ps, pa]) X.w_free(p);
      return r;
    },
    sintetizar({ f0, sp, ap, fft, periodo, fs, largo }) {
      const cuadros = f0.length, ancho = fft / 2 + 1;
      largo ??= Math.round((cuadros - 1) * periodo / 1000 * fs) + 1;
      const pf = pedir(cuadros), ps = pedir(cuadros * ancho), pa = pedir(cuadros * ancho), py = pedir(largo);
      escribir(pf, f0); escribir(ps, sp); escribir(pa, ap);
      X.w_sintetizar(pf, cuadros, ps, pa, fft, periodo, fs, largo, py);
      const y = leer(py, largo);
      for (const p of [pf, ps, pa, py]) X.w_free(p);
      return y;
    },
  };
}
