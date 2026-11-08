// mbrola.js — MBROLA (el programa, compilado a WebAssembly en motor/vendor/mbrola/) andando en la página, en un
// Worker o en Node. Le damos un guion .pho y devuelve las muestras. La voz (es1, es2...) se carga como un archivo en
// memoria: el WebAssembly cree que la abre del disco, por eso hay un WASI mínimo acá abajo.
//
//   const mb = await crearMbrola(bytesWasm, bytesVoz);  mb.frecuencia  →  16000
//   const muestras = mb.cantar(pho);                   →  Int16Array

export async function crearMbrola(wasm, voz) {
  const archivos = new Map([['voz', voz instanceof Uint8Array ? voz : new Uint8Array(voz)]]);
  const abiertos = new Map(); // fd → { datos, pos }
  let proximo = 4, memoria = null, salida = '';
  const vista = () => new DataView(memoria.buffer);
  const bytes = () => new Uint8Array(memoria.buffer);
  const texto = (p, n) => new TextDecoder().decode(bytes().subarray(p, p + n));
  class Salir extends Error { constructor(c) { super('mbrola salió con ' + c); this.codigo = c; } }
  const EBADF = 8, ENOENT = 44;
  const wasi = {
    fd_prestat_get(fd, p) { if (fd !== 3) return EBADF; const v = vista(); v.setUint8(p, 0); v.setUint32(p + 4, 1, true); return 0; },
    fd_prestat_dir_name(fd, p, n) { if (fd !== 3) return EBADF; bytes()[p] = 47; return 0; },
    fd_fdstat_get(fd, p) {
      const v = vista(); v.setUint8(p, fd < 3 ? 2 : fd === 3 ? 3 : 4); v.setUint16(p + 2, 0, true);
      v.setBigUint64(p + 8, 0xffffffffffffffffn, true); v.setBigUint64(p + 16, 0xffffffffffffffffn, true); return 0;
    },
    fd_fdstat_set_flags() { return 0; },
    path_open(dirfd, dirflags, pp, pn, oflags, rb, ri, fdflags, pfd) {
      const nombre = texto(pp, pn).replace(/^\/+/, '');
      if (!archivos.has(nombre)) return ENOENT;
      const fd = proximo++; abiertos.set(fd, { datos: archivos.get(nombre), pos: 0 });
      vista().setUint32(pfd, fd, true); return 0;
    },
    fd_read(fd, iovs, n, pleidos) {
      const a = abiertos.get(fd); if (!a) return EBADF;
      const v = vista(), b = bytes(); let total = 0;
      for (let i = 0; i < n; i++) {
        const p = v.getUint32(iovs + i * 8, true), l = v.getUint32(iovs + i * 8 + 4, true);
        const k = Math.min(l, a.datos.length - a.pos); if (k <= 0) break;
        b.set(a.datos.subarray(a.pos, a.pos + k), p); a.pos += k; total += k; if (k < l) break;
      }
      v.setUint32(pleidos, total, true); return 0;
    },
    fd_seek(fd, desde, como, pnueva) {
      const a = abiertos.get(fd); if (!a) return EBADF;
      const d = Number(desde); a.pos = como === 0 ? d : como === 1 ? a.pos + d : a.datos.length + d;
      vista().setBigUint64(pnueva, BigInt(a.pos), true); return 0;
    },
    fd_close(fd) { abiertos.delete(fd); return 0; },
    fd_write(fd, iovs, n, pesc) {
      const v = vista(); let total = 0;
      for (let i = 0; i < n; i++) { const p = v.getUint32(iovs + i * 8, true), l = v.getUint32(iovs + i * 8 + 4, true); salida += texto(p, l); total += l; }
      v.setUint32(pesc, total, true); return 0;
    },
    proc_exit(c) { throw new Salir(c); },
  };
  const modulo = wasm instanceof WebAssembly.Module ? wasm : await WebAssembly.compile(wasm);
  const inst = await WebAssembly.instantiate(modulo, { wasi_snapshot_preview1: wasi });
  const X = inst.exports; memoria = X.memory;
  X._initialize?.();
  const cadena = s => { const b = new TextEncoder().encode(s + '\0'); const p = X.mb_alloc(b.length); bytes().set(b, p); return p; };
  const error = () => { const p = X.mb_alloc(512); X.mb_error(p, 512); const m = texto(p, bytes().subarray(p, p + 512).indexOf(0)); X.mb_free(p); return m || salida; };
  const pv = cadena('/voz');
  if (X.mb_init(pv) < 0) throw new Error('MBROLA no pudo abrir la voz: ' + error());
  // MBROLA guarda estado de una síntesis a la otra (la fase del último período): para que el mismo guion dé siempre
  // las mismas muestras, se guarda la memoria recién abierta la voz y se repone antes de cada guion.
  const foto = bytes().slice(), fotoPos = new Map([...abiertos].map(([fd, a]) => [fd, a.pos])), fotoProximo = proximo;
  return {
    frecuencia: X.mb_freq(),
    cantar(pho) {
      bytes().set(foto, 0); bytes().fill(0, foto.length);
      for (const fd of [...abiertos.keys()]) if (!fotoPos.has(fd)) abiertos.delete(fd);
      for (const [fd, pos] of fotoPos) abiertos.get(fd).pos = pos;
      proximo = fotoProximo;
      const p = cadena(pho);
      const n = X.mb_synth(p); X.mb_free(p);
      if (n < 0) throw new Error('MBROLA: ' + error());
      return new Int16Array(memoria.buffer, X.mb_res(), n).slice();
    },
  };
}
