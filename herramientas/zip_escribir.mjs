// zip_escribir.mjs — escribir un .zip sin librerías (lo lee motor/cantor/zip.js): los nombres en UTF-8 y cada archivo
// comprimido con deflate sólo si gana algo.
//
//   escribirZip('salida.zip', [{ nombre: 'oto.ini', datos: Uint8Array }, ...])  → bytes escritos
import { openSync, writeSync, closeSync } from 'node:fs';
import { deflateRawSync, crc32 } from 'node:zlib';

export function escribirZip(ruta, archivos) {
  const fd = openSync(ruta, 'w'), centro = [];
  let pos = 0;
  const escribir = b => { writeSync(fd, b); pos += b.length; };
  try {
    for (const { nombre: n, datos } of archivos) {
      const crudo = Buffer.from(datos.buffer, datos.byteOffset, datos.byteLength), nombre = Buffer.from(n, 'utf8'), crc = crc32(crudo);
      let metodo = 0, cuerpo = crudo;
      const comp = deflateRawSync(crudo, { level: 6 });
      if (comp.length < crudo.length * .99) { metodo = 8; cuerpo = comp; }
      const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt16LE(metodo, 8);
      h.writeUInt32LE(crc, 14); h.writeUInt32LE(cuerpo.length, 18); h.writeUInt32LE(crudo.length, 22); h.writeUInt16LE(nombre.length, 26);
      centro.push({ nombre, metodo, crc, comp: cuerpo.length, tam: crudo.length, local: pos });
      escribir(h); escribir(nombre); escribir(cuerpo);
    }
    const desde = pos;
    for (const c of centro) {
      const h = Buffer.alloc(46); h.writeUInt32LE(0x02014b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(20, 6); h.writeUInt16LE(0x800, 8); h.writeUInt16LE(c.metodo, 10);
      h.writeUInt32LE(c.crc, 16); h.writeUInt32LE(c.comp, 20); h.writeUInt32LE(c.tam, 24); h.writeUInt16LE(c.nombre.length, 28); h.writeUInt32LE(c.local, 42);
      escribir(h); escribir(c.nombre);
    }
    const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(centro.length, 8); fin.writeUInt16LE(centro.length, 10); fin.writeUInt32LE(pos - desde, 12); fin.writeUInt32LE(desde, 16);
    escribir(fin);
  } finally { closeSync(fd); }
  return pos;
}
