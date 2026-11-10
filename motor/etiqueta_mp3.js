// etiqueta_mp3.js — el cuadro «Info» con la etiqueta LAME para un MP3 de lamejs, que no la escribe. Sin ella, el MP3
// exportado arranca 25 ms tarde (las 576 muestras que el codificador agrega al principio más las 529 del
// decodificador) y termina con el relleno del último cuadro: con ella, los reproductores que la leen (Chrome, Firefox,
// ffmpeg, foobar, iTunes) sacan las dos cosas y el MP3 dura y arranca como la mezcla.
//
//   etiquetaLame(audio, muestras, sr, kbps) → Uint8Array: el cuadro que va antes de los de audio
//     audio: los bytes que dio lamejs (MPEG-1 capa III, CBR, estéreo); muestras: las que se codificaron (por canal)

const RETARDO = 576;   // el que agrega LAME al principio (los decodificadores le suman sus 529)
const KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const TASAS = [44100, 48000, 32000];

// CRC-16 (el de LAME: polinomio 0x8005 reflejado, desde 0)
function crc16(b, c = 0) {
  for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xa001 : c >>> 1; }
  return c;
}

// cuántos cuadros hay (MPEG-1 capa III: cada uno, 1152 muestras)
function contarCuadros(a) {
  let p = 0, n = 0;
  while (p + 4 <= a.length && a[p] === 0xff && (a[p + 1] & 0xe0) === 0xe0) {
    const kb = KBPS[a[p + 2] >> 4], sr = TASAS[(a[p + 2] >> 2) & 3];
    if (!kb || !sr) break;
    p += Math.floor(144000 * kb / sr) + ((a[p + 2] >> 1) & 1); n++;
  }
  return n;
}

export function etiquetaLame(audio, muestras, sr, kbps) {
  const ib = KBPS.indexOf(kbps), is = TASAS.indexOf(sr);
  if (ib < 1 || is < 0 || audio.length < 4) throw new Error(`MP3 de ${kbps} kbps a ${sr} Hz: sin etiqueta`);
  const cuadros = contarCuadros(audio), largo = Math.floor(144000 * kbps / sr);
  const relleno = cuadros * 1152 - RETARDO - muestras;
  const f = new Uint8Array(largo), v = new DataView(f.buffer);
  // el encabezado, el de los cuadros de audio (el modo de canales incluido) sin el bit de relleno; un cuadro vacío
  f[0] = 0xff; f[1] = 0xfb; f[2] = (ib << 4) | (is << 2); f[3] = audio[3];
  const mono = (audio[3] >> 6) === 3, x = 4 + (mono ? 17 : 32);   // después de la información lateral
  f.set([73, 110, 102, 111], x);                                   // «Info» (CBR; «Xing» es para VBR)
  v.setUint32(x + 4, 0x0f);                                         // trae cuadros, bytes, índice y calidad
  v.setUint32(x + 8, cuadros);
  v.setUint32(x + 12, largo + audio.length);
  for (let i = 0; i < 100; i++) f[x + 16 + i] = Math.floor(i * 256 / 100);   // índice: en CBR, parejo
  v.setUint32(x + 116, 0);                                          // calidad
  const l = x + 120;                                                // la etiqueta LAME
  f.set([...'LAME3.100'].map(c => c.charCodeAt(0)), l);
  f[l + 9] = 0x01;                                                  // revisión 0, CBR
  f[l + 20] = Math.min(255, kbps);
  f[l + 21] = RETARDO >> 4; f[l + 22] = ((RETARDO & 15) << 4) | ((relleno >> 8) & 15); f[l + 23] = relleno & 255;
  f[l + 24] = sr === 44100 ? 0x40 : sr === 48000 ? 0x80 : 0;      // la frecuencia del original
  v.setUint32(l + 28, largo + audio.length);                        // el largo de la música (con este cuadro)
  v.setUint16(l + 32, crc16(audio));                                // el CRC de la música
  v.setUint16(l + 34, crc16(f.subarray(0, l + 34)));                // el CRC de la etiqueta (los primeros 190 bytes)
  return f;
}
