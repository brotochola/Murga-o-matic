// opus.js — los .wav de un banco guardados en Opus (la versión liviana, herramientas/utau_recortar.mjs): el archivo
// sigue llamándose .wav (así el oto.ini no cambia), pero adentro trae un Ogg Opus. Se decodifica con WebCodecs
// (AudioDecoder, que en Chrome anda también en un Worker) y vuelve como un .wav de muestras en coma flotante, que
// banco.js lee como cualquier otro.
//
// Opus decodifica siempre a 48 kHz; el .wav vuelve a la frecuencia del original (la que dice el OpusHead, casi siempre
// 44,1 kHz): a 48 kHz WORLD analiza con el doble de puntos (fft 4096 en vez de 2048) y canta más lento.
//
//   esOgg(bytes) → true si empieza con «OggS»
//   await oggAWav(bytes) → Uint8Array con un .wav (float32, a la frecuencia del original)
//   (en Node, herramientas/banco_node.mjs decodifica con ffmpeg y usa remuestrear y wavFloat de acá)

export const esOgg = b => !!b && b.length > 4 && b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53;

// los paquetes del Ogg (un paquete puede seguir en la página siguiente) y la posición del final (en muestras a 48 kHz)
function paquetesOgg(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength), paquetes = [];
  let p = 0, pedazos = [], fin = 0;
  while (p + 27 <= b.length) {
    if (!(b[p] === 0x4f && b[p + 1] === 0x67 && b[p + 2] === 0x67 && b[p + 3] === 0x53)) throw new Error('el Ogg está roto');
    const granulo = v.getBigInt64(p + 6, true), n = b[p + 26];
    if (granulo >= 0n) fin = Number(granulo);
    let q = p + 27 + n;
    for (let i = 0; i < n; i++) {
      const largo = b[p + 27 + i];
      pedazos.push(b.subarray(q, q + largo)); q += largo;
      if (largo < 255) {
        const t = pedazos.reduce((a, x) => a + x.length, 0), x = new Uint8Array(t);
        let k = 0; for (const s of pedazos) { x.set(s, k); k += s.length; }
        paquetes.push(x); pedazos = [];
      }
    }
    p = q;
  }
  return { paquetes, fin };
}
// el OpusHead: canales, pre-skip (lo que el codificador agrega al principio, a 48 kHz) y la frecuencia del original
export function cabezaOpus(cab) {
  if (!cab || String.fromCharCode(...cab.subarray(0, 8)) !== 'OpusHead') throw new Error('no es Opus');
  const v = new DataView(cab.buffer, cab.byteOffset, cab.byteLength);
  return { canales: cab[9], salto: v.getUint16(10, true), tasa: v.getUint32(12, true) || 48000 };
}
export const cabezaDeOgg = b => cabezaOpus(paquetesOgg(b).paquetes[0]);
// cuántas muestras (a 48 kHz) trae un paquete de Opus: el TOC dice el largo de cada cuadro y cuántos cuadros van
function muestrasDe(pk) {
  const toc = pk[0], cfg = toc >> 3, c = toc & 3;
  const ms = cfg < 12 ? [10, 20, 40, 60][cfg & 3] : cfg < 16 ? [10, 20][cfg & 1] : [2.5, 5, 10, 20][cfg & 3];
  const cuadros = c === 0 ? 1 : c < 3 ? 2 : (pk[1] & 0x3f);
  return Math.round(ms * 48 * cuadros);
}

// otra frecuencia de muestreo: un sinc con ventana de Kaiser (±24 muestras, corte al 95 % de la mitad de la menor de
// las dos), leído de una tabla
const TABLA = 512, MEDIO = 24, BETA = 8.6;
let tabla = null, tablaCorte = 0;
function i0(x) { let s = 1, t = 1; for (let k = 1; k < 40; k++) { t *= (x / (2 * k)) ** 2; s += t; if (t < 1e-12 * s) break; } return s; }
export function remuestrear(x, de, a) {
  if (de === a) return x;
  const r = a / de, corte = Math.min(1, r) * .95, ancho = Math.ceil(MEDIO / corte);
  if (!tabla || tablaCorte !== corte) {
    tabla = new Float64Array(ancho * TABLA + 2); tablaCorte = corte;
    const d = i0(BETA);
    for (let i = 0; i < tabla.length; i++) {
      const t = i / TABLA, u = t / ancho;
      tabla[i] = u >= 1 ? 0 : corte * (t === 0 ? 1 : Math.sin(Math.PI * corte * t) / (Math.PI * corte * t)) * i0(BETA * Math.sqrt(1 - u * u)) / d;
    }
  }
  const n = Math.round(x.length * r), y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = i / r, k0 = Math.floor(c);
    let s = 0;
    for (let k = Math.max(0, k0 - ancho + 1), k1 = Math.min(x.length - 1, k0 + ancho); k <= k1; k++) {
      const f = Math.abs(c - k) * TABLA, j = f | 0;
      if (j + 1 >= tabla.length) continue;
      s += x[k] * (tabla[j] + (tabla[j + 1] - tabla[j]) * (f - j));
    }
    y[i] = s;
  }
  return y;
}
// un .wav de un canal en float32
export function wavFloat(x, sr) {
  const n = x.length, w = new Uint8Array(44 + n * 4), v = new DataView(w.buffer);
  const cad = (p, s) => { for (let i = 0; i < 4; i++) w[p + i] = s.charCodeAt(i); };
  cad(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); cad(8, 'WAVE'); cad(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 3, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 32, true);
  cad(36, 'data'); v.setUint32(40, n * 4, true);
  new Float32Array(w.buffer, 44, n).set(x);
  return w;
}

export async function oggAWav(bytes) {
  const { paquetes, fin } = paquetesOgg(bytes);
  const { canales, salto, tasa } = cabezaOpus(paquetes[0]);
  // sin «description»: el decodificador no sabe del pre-skip y lo devuelve todo; se saca acá
  const salida = [];
  let error = null;
  const dec = new AudioDecoder({
    output: d => { const x = new Float32Array(d.numberOfFrames); d.copyTo(x, { planeIndex: 0, format: 'f32-planar' }); salida.push(x); d.close(); },
    error: e => { error = e; },
  });
  dec.configure({ codec: 'opus', sampleRate: 48000, numberOfChannels: canales });
  let t = 0;
  for (const pk of paquetes.slice(2)) {
    if (!pk.length) continue;
    dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(t * 1e6 / 48000), data: pk }));
    t += muestrasDe(pk);
  }
  await dec.flush(); dec.close();
  if (error) throw error;
  // a 48 kHz, sin el pre-skip y hasta el final que dice el Ogg (el primer canal)
  const total = salida.reduce((a, x) => a + x.length, 0), n = Math.max(0, Math.min(total - salto, fin - salto));
  const m = new Float32Array(n);
  let k = -salto;
  for (const x of salida) {
    for (let i = 0; i < x.length; i++, k++) if (k >= 0 && k < n) m[k] = x[i];
    if (k >= n) break;
  }
  return wavFloat(remuestrear(m, 48000, tasa), tasa);
}
