// utau_adelgazar.mjs — deja en cada banco de bancos/ sólo lo que el cantor usa: los .wav que nombra algún oto.ini, los
// oto.ini, el prefix.map, el character.txt y el character.yaml, y los readme (las condiciones de uso y los créditos).
// Afuera: imágenes, .frq y .llsm (las tablas de otros resamplers), .pmk, .dll, demos, comentarios. El .zip nuevo trae la
// carpeta del banco en la raíz (sin el .uar ni las carpetas de arriba) y los nombres en UTF-8; cada archivo va
// comprimido sólo si gana algo. Antes de reemplazar el viejo, abre el nuevo y comprueba que tiene las mismas entradas
// y que ninguna se quedó sin su .wav.
//
//   node herramientas/utau_adelgazar.mjs [banco.zip ...]     (sin nada: todos los de bancos/)
import { readFileSync, writeFileSync, readdirSync, renameSync, statSync, unlinkSync, openSync, writeSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync, deflateRawSync, crc32 } from 'node:zlib';
import { leerZip, extraer } from '../motor/cantor/zip.js';
import { leerOto, texto } from '../motor/cantor/banco.js';
import { BANCOS, abrirBancoNode } from './banco_node.mjs';

const DEL_BANCO = /(^|\/)(character\.txt|prefix\.map|character\.yaml)$/i;
const LEEME = /(readme|l[eé]eme|terms|tos|licen[cs]|condic|規約|説明|credit)[^/]*\.(txt|md)$/i;

function adelgazar(archivo) {
  const ruta = join(BANCOS, archivo), antes = statSync(ruta).size;
  let lista = leerZip(new Uint8Array(readFileSync(ruta)));
  if (!lista.some(e => /(^|\/)oto\.ini$/i.test(e.nombre))) {
    const uar = lista.filter(e => /\.uar$/i.test(e.nombre)).sort((a, b) => b.tamano - a.tamano)[0];
    if (uar) lista = leerZip(extraer(uar, b => inflateRawSync(b)));
  }
  const datos = e => extraer(e, b => inflateRawSync(b));
  // la carpeta del banco
  const raiz = lista.map(e => e.nombre).filter(r => DEL_BANCO.test(r)).map(r => r.split('/').slice(0, -1).join('/')).sort((a, b) => a.length - b.length)[0] ?? '';
  const dentro = lista.filter(e => !raiz || e.nombre.startsWith(raiz + '/')).map(e => ({ e, r: raiz ? e.nombre.slice(raiz.length + 1) : e.nombre }));
  // los .wav que nombra algún oto.ini
  const usados = new Set();
  for (const { e, r } of dentro) if (/(^|\/)oto\.ini$/i.test(r)) for (const o of leerOto(texto(datos(e)), r.split('/').slice(0, -1).join('/'))) usados.add(o.archivo.toLowerCase());
  const quedan = dentro.filter(({ r }) => /\.wav$/i.test(r) ? usados.has(r.toLowerCase()) : /(^|\/)oto\.ini$/i.test(r) || (!r.includes('/') && (DEL_BANCO.test(r) || LEEME.test(r))));
  // el .zip nuevo
  const nuevo = ruta + '.nuevo', fd = openSync(nuevo, 'w'), centro = [];
  let pos = 0;
  const escribir = b => { writeSync(fd, b); pos += b.length; };
  for (const { e, r } of quedan) {
    const crudo = datos(e), nombre = Buffer.from(r, 'utf8'), crc = crc32(crudo);
    let metodo = 0, cuerpo = crudo;
    const comp = deflateRawSync(crudo, { level: 6 });
    if (comp.length < crudo.length * .99) { metodo = 8; cuerpo = comp; }
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt16LE(metodo, 8);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(cuerpo.length, 18); h.writeUInt32LE(crudo.length, 22); h.writeUInt16LE(nombre.length, 26);
    centro.push({ nombre, metodo, crc, comp: cuerpo.length, tam: crudo.length, local: pos });
    escribir(h); escribir(nombre); escribir(Buffer.from(cuerpo.buffer, cuerpo.byteOffset, cuerpo.length));
  }
  const desde = pos;
  for (const c of centro) {
    const h = Buffer.alloc(46); h.writeUInt32LE(0x02014b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(20, 6); h.writeUInt16LE(0x800, 8); h.writeUInt16LE(c.metodo, 10);
    h.writeUInt32LE(c.crc, 16); h.writeUInt32LE(c.comp, 20); h.writeUInt32LE(c.tam, 24); h.writeUInt16LE(c.nombre.length, 28); h.writeUInt32LE(c.local, 42);
    escribir(h); escribir(c.nombre);
  }
  const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(centro.length, 8); fin.writeUInt16LE(centro.length, 10); fin.writeUInt32LE(pos - desde, 12); fin.writeUInt32LE(desde, 16);
  escribir(fin); closeSync(fd);
  // la prueba: el banco viejo y el nuevo, con las mismas entradas y ninguna sin su .wav
  const viejo = abrirBancoNode(ruta), b = abrirBancoNode(nuevo);
  if (b.entradas.length !== viejo.entradas.length || b.sinArchivo > viejo.sinArchivo || b.reclist !== viejo.reclist || b.alturas.length !== viejo.alturas.length) {
    unlinkSync(nuevo);
    throw new Error(`${archivo}: el nuevo no da lo mismo (${b.entradas.length}/${viejo.entradas.length} entradas, ${b.sinArchivo} sin .wav, ${b.reclist}/${viejo.reclist})`);
  }
  renameSync(nuevo, ruta);
  const despues = statSync(ruta).size;
  console.log(`${archivo.padEnd(26)} ${(antes / 1e6).toFixed(0).padStart(4)} → ${(despues / 1e6).toFixed(0).padStart(4)} MB  ${lista.length} → ${quedan.length} archivos (${b.entradas.length} entradas, ${b.reclist})`);
  return [antes, despues];
}
const cuales = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(BANCOS).filter(f => /\.zip$/i.test(f));
let A = 0, D = 0;
for (const z of cuales) { const [a, d] = adelgazar(z); A += a; D += d; }
console.log(`en total: ${(A / 1e6).toFixed(0)} → ${(D / 1e6).toFixed(0)} MB`);
