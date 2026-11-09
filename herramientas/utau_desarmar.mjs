// utau_desarmar.mjs — desarma el .zip de un banco de UTAU con los nombres bien (Shift-JIS en los bancos japoneses),
// y los .uar (el instalador de UTAU, que es otro .zip) que traiga adentro.
//
//   node herramientas/utau_desarmar.mjs <banco.zip> <carpeta de destino>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { leerZip, extraer } from '../motor/cantor/zip.js';

const [zip, destino] = process.argv.slice(2);
if (!zip || !destino) { console.error('uso: node herramientas/utau_desarmar.mjs <banco.zip> <carpeta de destino>'); process.exit(1); }
let n = 0;
function desarmar(bytes, dest) {
  const raiz = resolve(dest);
  for (const e of leerZip(bytes)) {
    const ruta = resolve(raiz, e.nombre);
    if (!ruta.startsWith(raiz + sep)) { console.warn('se saltea (fuera de la carpeta):', e.nombre); continue; }
    const datos = extraer(e, b => inflateRawSync(b));
    if (/\.uar$/i.test(e.nombre)) { desarmar(datos, ruta.replace(/\.uar$/i, '')); continue; }
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, datos);
    n++;
  }
}
desarmar(new Uint8Array(readFileSync(zip)), destino);
console.log(`${n} archivos → ${resolve(destino)}`);
