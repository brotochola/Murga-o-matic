// zip.js — leer un .zip sin librerías: los bancos de UTAU vienen así (y los .uar del instalador de UTAU también son
// .zip). Lee el directorio central; los archivos van guardados (método 0) o comprimidos con deflate (método 8), que
// descomprime quien llama: en Node, zlib.inflateRawSync; en el navegador, DecompressionStream('deflate-raw').
// Los nombres: UTF-8 si el zip lo dice o si lo son; si no, Shift-JIS, como los de los bancos japoneses (un unzip
// común los deja ilegibles y el oto.ini no encuentra sus .wav).
const utf8 = new TextDecoder('utf-8', { fatal: true });
let sjis = null;
function nombre(b, esUtf8) {
  if (esUtf8) return new TextDecoder('utf-8').decode(b);
  try { return utf8.decode(b); } catch { /* no es UTF-8 */ }
  try { sjis ??= new TextDecoder('shift_jis'); return sjis.decode(b); } catch { return new TextDecoder('latin1').decode(b); }
}

// bytes: Uint8Array del .zip entero → [{ nombre, metodo, comprimido, tamano, datos(): Uint8Array (comprimidos) }]
export function leerZip(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // el final del directorio central: la firma 0x06054b50, buscada desde el final (después puede venir un comentario)
  let fin = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('no es un .zip');
  const n = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const lista = [];
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('el directorio del .zip está roto');
    const flags = v.getUint16(p + 8, true), metodo = v.getUint16(p + 10, true);
    const comprimido = v.getUint32(p + 20, true), tamano = v.getUint32(p + 24, true);
    const ln = v.getUint16(p + 28, true), le = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nom = nombre(bytes.subarray(p + 46, p + 46 + ln), flags & 0x800);
    p += 46 + ln + le + lc;
    if (nom.endsWith('/')) continue;
    lista.push({
      nombre: nom.replace(/\\/g, '/'), metodo, comprimido, tamano,
      datos() {
        const desde = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
        return bytes.subarray(desde, desde + comprimido);
      },
    });
  }
  return lista;
}

// los bytes de una entrada, con la función que descomprime deflate (sincrónica)
export function extraer(e, inflar) {
  if (e.metodo === 0) return e.datos();
  if (e.metodo === 8) return inflar(e.datos());
  throw new Error(`${e.nombre}: método de compresión ${e.metodo} no soportado`);
}
