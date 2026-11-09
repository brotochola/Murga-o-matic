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

// ── de a pedazos (en el navegador): un banco pesa cientos de MB y no hace falta tenerlo entero ────────────────────
// Una fuente de bytes: { tamano, leer(desde, hasta) → Promise<Uint8Array> }.
export const desdeBytes = b => ({ tamano: b.length, leer: async (a, z) => b.subarray(a, z) });
export const desdeBlob = blob => ({ tamano: blob.size, leer: async (a, z) => new Uint8Array(await blob.slice(a, z).arrayBuffer()) });
// una dirección: con pedidos de un rango de bytes si el servidor los acepta (GitHub Pages, servir.js); si no, entero
export async function desdeUrl(url) {
  const r = await fetch(url, { headers: { Range: 'bytes=0-0' } });
  if (r.status === 404) throw new Error('no está');
  if (!r.ok) throw new Error(`el servidor dice ${r.status}`);
  const cr = r.headers.get('content-range');
  if (r.status === 206 && cr) {
    await r.arrayBuffer();
    const tamano = +cr.split('/')[1];
    // (un archivo vacío, como el oto.ini de la raíz de LongWei, no se pide: un rango de cero bytes es un error 416)
    return { tamano, leer: async (a, z) => { if (z <= a) return new Uint8Array(0); const q = await fetch(url, { headers: { Range: `bytes=${a}-${z - 1}` } }); if (q.status !== 206) throw new Error(`el servidor dejó de dar pedazos (${q.status})`); return new Uint8Array(await q.arrayBuffer()); } };
  }
  return desdeBytes(new Uint8Array(await r.arrayBuffer()));
}
// deflate en el navegador
export async function inflarAsync(b) {
  const s = new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
// el directorio de un .zip desde una fuente: [{ nombre, metodo, comprimido, tamano, local }]
export async function abrirZip(f) {
  const cola = Math.min(f.tamano, 65557), fin0 = f.tamano - cola, t = await f.leer(fin0, f.tamano);
  const vt = new DataView(t.buffer, t.byteOffset, t.byteLength);
  let fin = -1;
  for (let i = t.length - 22; i >= 0; i--) if (vt.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('no es un .zip');
  const n = vt.getUint16(fin + 10, true), largo = vt.getUint32(fin + 12, true), desde = vt.getUint32(fin + 16, true);
  const d = await f.leer(desde, desde + largo), v = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const lista = [];
  for (let k = 0, p = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('el directorio del .zip está roto');
    const flags = v.getUint16(p + 8, true), metodo = v.getUint16(p + 10, true);
    const comprimido = v.getUint32(p + 20, true), tamano = v.getUint32(p + 24, true);
    const ln = v.getUint16(p + 28, true), le = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true), local = v.getUint32(p + 42, true);
    const nom = nombre(d.subarray(p + 46, p + 46 + ln), flags & 0x800);
    p += 46 + ln + le + lc;
    if (!nom.endsWith('/')) lista.push({ nombre: nom.replace(/\\/g, '/'), metodo, comprimido, tamano, local });
  }
  return lista;
}
// dónde empiezan los datos de una entrada (después de su encabezado local)
async function datosDe(f, e) {
  if (e.desde == null) { const h = await f.leer(e.local, e.local + 30), v = new DataView(h.buffer, h.byteOffset, 30); e.desde = e.local + 30 + v.getUint16(26, true) + v.getUint16(28, true); }
  return e.desde;
}
// los bytes de una entrada
export async function leerEntrada(f, e, inflar = inflarAsync) {
  const a = await datosDe(f, e), b = await f.leer(a, a + e.comprimido);
  if (e.metodo === 0) return b;
  if (e.metodo === 8) return inflar(b);
  throw new Error(`${e.nombre}: método de compresión ${e.metodo} no soportado`);
}
// un .zip adentro de otro (el .uar del instalador de UTAU): si está guardado sin comprimir, se lee de a pedazos del de
// afuera; si no, se descomprime entero
export async function fuenteDeEntrada(f, e, inflar = inflarAsync) {
  if (e.metodo === 0) { const a = await datosDe(f, e); return { tamano: e.tamano, leer: (x, z) => f.leer(a + x, a + z) }; }
  return desdeBytes(await leerEntrada(f, e, inflar));
}
