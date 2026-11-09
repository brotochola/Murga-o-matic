// banco_node.mjs — abrir un banco de UTAU en Node, desde su carpeta o desde su .zip (los de bancos/), para las
// herramientas. En el navegador hace lo mismo motor/cantor/bancos.js, de a pedazos.
//
//   const banco = abrirBancoNode('bancos/MIKE.zip')       (o una carpeta)
//   const voz = { banco: 'MIKE.zip' }  →  rutaDelBanco(voz.banco) = <repositorio>/bancos/MIKE.zip
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { crearBanco } from '../motor/cantor/banco.js';
import { leerZip, extraer } from '../motor/cantor/zip.js';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const BANCOS = join(RAIZ, 'bancos');
export const rutaDelBanco = b => (isAbsolute(b) ? b : existsSync(join(BANCOS, b)) ? join(BANCOS, b) : resolve(b));
const SIRVE = /\.(wav|ini|map|txt|yaml)$/i;

// las rutas desde la carpeta del banco: la más cercana que tiene su character.txt, prefix.map o character.yaml (el
// .uar de MIKE trae afuera el install.txt de UTAU); si no, si la de arriba la contiene sola, se baja
const DEL_BANCO = /(^|\/)(character\.txt|prefix\.map|character\.yaml)$/i;
function bajar(mapa) {
  const raiz = [...mapa.keys()].filter(r => DEL_BANCO.test(r)).map(r => r.split('/').slice(0, -1).join('/')).sort((a, b) => a.length - b.length)[0];
  if (raiz) return new Map([...mapa].filter(([r]) => r.startsWith(raiz + '/')).map(([r, v]) => [r.slice(raiz.length + 1), v]));
  for (;;) {
    const rutas = [...mapa.keys()], primera = rutas[0]?.split('/')[0];
    if (!primera || !rutas.every(r => r.startsWith(primera + '/'))) return mapa;
    mapa = new Map([...mapa].map(([r, v]) => [r.slice(primera.length + 1), v]));
  }
}
export function abrirBancoNode(ruta) {
  ruta = rutaDelBanco(ruta);
  let mapa = new Map();
  if (statSync(ruta).isDirectory()) {
    (function andar(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else if (SIRVE.test(f)) mapa.set(relative(ruta, p).split(/[\\/]/).join('/'), () => new Uint8Array(readFileSync(p))); } })(ruta);
  } else {
    let lista = leerZip(new Uint8Array(readFileSync(ruta)));
    // el instalador de UTAU (.uar) adentro: si el banco no está afuera, el .uar más grande
    if (!lista.some(e => /(^|\/)oto\.ini$/i.test(e.nombre))) {
      const uar = lista.filter(e => /\.uar$/i.test(e.nombre)).sort((a, b) => b.tamano - a.tamano)[0];
      if (uar) lista = leerZip(extraer(uar, b => inflateRawSync(b)));
    }
    for (const e of lista) if (SIRVE.test(e.nombre)) mapa.set(e.nombre, () => extraer(e, b => inflateRawSync(b)));
  }
  mapa = bajar(mapa);
  return crearBanco([...mapa.keys()], r => { const f = mapa.get(r); try { return f ? f() : null; } catch { return null; } });
}
