// bancos.js — los bancos de UTAU en el navegador (docs/plan_cantantes.md). No se copian: se guarda la llave de la
// carpeta de cada uno (FileSystemDirectoryHandle, de Chrome y Edge) en IndexedDB, con el permiso de leerla, y los .wav
// se leen del disco cuando una frase los necesita. En los navegadores sin esa llave (Firefox, Safari) se elige la
// carpeta cada vez (<input webkitdirectory>) y vale por esa sesión.
//
// Del lado de la página: guardar y listar los bancos, pedir permiso, y guardar datos sueltos (el plantel, la murga).
// Del lado del obrero: cargarBanco(fuente), que arma el banco (banco.js) leyendo de la carpeta.
import { crearBanco } from './banco.js';
import { desdeUrl, desdeBlob, abrirZip, leerEntrada, fuenteDeEntrada } from './zip.js';
import { esOgg, oggAWav } from './opus.js';

// ── IndexedDB ────────────────────────────────────────────────────────────
const BASE = 'murga-o-matic-estudio', VERSION = 1;
let db = null;
function abrir() {
  if (db) return db;
  db = new Promise((ok, mal) => {
    if (!globalThis.indexedDB) { mal(new Error('este navegador no guarda datos (IndexedDB)')); return; }
    const r = indexedDB.open(BASE, VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('bancos')) d.createObjectStore('bancos', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('datos')) d.createObjectStore('datos', { keyPath: 'clave' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  db.catch(() => { db = null; });
  return db;
}
const pedido = (tabla, modo, hacer) => abrir().then(d => new Promise((ok, mal) => {
  const t = d.transaction(tabla, modo), r = hacer(t.objectStore(tabla));
  t.oncomplete = () => ok(r?.result); t.onerror = () => mal(t.error); t.onabort = () => mal(t.error || new Error('se canceló'));
}));
// un banco guardado: { id, nombre, handle, agregado } (la llave de su carpeta, no sus archivos)
export const guardarBanco = b => pedido('bancos', 'readwrite', s => s.put(b));
export const listarBancos = () => pedido('bancos', 'readonly', s => s.getAll());
export const borrarBanco = id => pedido('bancos', 'readwrite', s => s.delete(id));
export const guardarDato = (clave, valor) => pedido('datos', 'readwrite', s => s.put({ clave, valor }));
export const leerDato = clave => pedido('datos', 'readonly', s => s.get(clave)).then(r => r?.valor);

// ── la carpeta y su permiso ─────────────────────────────────────────────
export const hayLlaves = () => typeof globalThis.showDirectoryPicker === 'function';
export const elegirCarpeta = () => globalThis.showDirectoryPicker({ id: 'banco-utau', mode: 'read' });
// ¿se puede leer? Con pedir, lo pide (hace falta un clic del usuario para eso)
export async function permiso(handle, pedir = false) {
  const o = { mode: 'read' };
  if ((await handle.queryPermission(o)) === 'granted') return true;
  return pedir && (await handle.requestPermission(o)) === 'granted';
}

// ── leer un banco (en el obrero) ────────────────────────────────────────
// Sólo hacen falta los .wav y los textos del banco (las .frq, .llsm, imágenes... no)
const SIRVE = /\.(wav|ini|map|txt|yaml)$/i;
// fuente: un .zip ({ url } en la web, como bancos/MIKE.zip; { zip: File o FileSystemFileHandle } elegido de la
// compu), una carpeta ({ handle }, con permiso) o sus archivos ({ archivos: [{ ruta, file }] }, de un
// <input webkitdirectory>). Devuelve { rutas, leer(ruta) → Promise<Uint8Array> }, con las rutas desde la carpeta del
// banco (si se eligió la de arriba, la que la contiene sola, se baja hasta la que tiene sus archivos)
export async function abrirFuente(fuente) {
  const mapa = new Map();
  if (fuente.url || fuente.zip) {
    let f = fuente.url ? await desdeUrl(fuente.url) : desdeBlob(fuente.zip.getFile ? await fuente.zip.getFile() : fuente.zip);
    let lista = await abrirZip(f);
    // el instalador de UTAU (.uar) adentro del .zip: si el banco no está afuera, el .uar más grande
    if (!lista.some(e => /(^|\/)oto\.ini$/i.test(e.nombre))) {
      const uar = lista.filter(e => /\.uar$/i.test(e.nombre)).sort((a, b) => b.tamano - a.tamano)[0];
      if (uar) { f = await fuenteDeEntrada(f, uar); lista = await abrirZip(f); }
    }
    for (const e of lista) if (SIRVE.test(e.nombre)) mapa.set(e.nombre, { f, e });
  } else if (fuente.handle) {
    const andar = async (dir, pre) => {
      for await (const [nombre, h] of dir.entries()) {
        if (h.kind === 'directory') await andar(h, pre + nombre + '/');
        else if (SIRVE.test(nombre)) mapa.set(pre + nombre, h);
      }
    };
    await andar(fuente.handle, '');
  } else for (const { ruta, file } of fuente.archivos) if (SIRVE.test(ruta)) mapa.set(ruta, file);
  // la carpeta del banco: la más cercana que tiene su character.txt, prefix.map o character.yaml (el .uar de MIKE trae
  // afuera el install.txt de UTAU); si no, la carpeta que contiene sola a otra se baja
  let rutas = [...mapa.keys()], carpeta = fuente.handle?.name || (fuente.url ? decodeURIComponent(fuente.url.split('/').pop()).replace(/\.zip$/i, '') : '') || (fuente.zip?.name || '').replace(/\.zip$/i, '');
  const raiz = rutas.filter(r => /(^|\/)(character\.txt|prefix\.map|character\.yaml)$/i.test(r)).map(r => r.split('/').slice(0, -1).join('/')).sort((a, b) => a.length - b.length)[0];
  if (raiz) {
    carpeta = raiz.split('/').pop();
    const viejo = [...mapa.entries()]; mapa.clear();
    for (const [r, h] of viejo) if (r.startsWith(raiz + '/')) mapa.set(r.slice(raiz.length + 1), h);
    rutas = [...mapa.keys()];
  }
  for (;;) {
    const primera = rutas[0]?.split('/')[0];
    if (!primera || !rutas.every(r => r.startsWith(primera + '/'))) break;
    carpeta = primera;
    rutas = rutas.map(r => r.slice(primera.length + 1));
    const viejo = [...mapa.entries()]; mapa.clear();
    for (const [r, h] of viejo) mapa.set(r.slice(primera.length + 1), h);
  }
  const leer = async r => {
    const h = mapa.get(r); if (!h) return null;
    if (h.e) return leerEntrada(h.f, h.e);
    const f = h.getFile ? await h.getFile() : h;
    return new Uint8Array(await f.arrayBuffer());
  };
  return { rutas, leer, carpeta };
}

// el banco listo para cantar: los textos se leen de entrada; los .wav, con banco.preparar(archivos) antes de cantar
// (archivosQueUsa, en banco.js). El análisis de WORLD de cada pedazo queda en banco.cacheAnalisis.
export async function cargarBanco(fuente) {
  const { rutas, leer, carpeta } = await abrirFuente(fuente);
  const bytes = new Map();
  const esTexto = r => /(^|\/)(oto\.ini|prefix\.map|character\.txt|character\.yaml|murga_niveles\.txt)$/i.test(r);
  await Promise.all(rutas.filter(esTexto).map(async r => bytes.set(r, await leer(r))));
  // los .wav se sueltan apenas banco.js los decodifica (se queda con las muestras)
  const banco = crearBanco(rutas, r => { const b = bytes.get(r) || null; if (b && /\.wav$/i.test(r)) bytes.delete(r); return b; });
  // (un banco de la versión liviana trae sus .wav en Opus: se decodifican acá, opus.js)
  banco.preparar = async archivos => {
    const faltan = archivos.filter(a => !bytes.has(a) && !banco.yaLeido(a));
    for (let i = 0; i < faltan.length; i += 16) await Promise.all(faltan.slice(i, i + 16).map(async a => { try { let b = await leer(a); if (esOgg(b)) b = await oggAWav(b); if (b) bytes.set(a, b); } catch { /* no está */ } }));
  };
  banco.cacheAnalisis = new Map();
  banco.carpeta = carpeta;
  return banco;
}

// la altura grabada de las capas que no la dicen (un banco de una sola altura, sin prefix.map): la mediana de la altura
// de una vocal sostenida, medida con WORLD
const VOCALES = ['- a', 'a', '- あ', 'あ', 'a a', '- e', 'e', '- o', 'o'];
export async function medirAlturas(banco, world) {
  for (const c of banco.alturas.filter(x => x.supuesta)) {
    const e = VOCALES.map(v => banco.indice.get(c.prefijo + v + c.sufijo)).find(Boolean);
    if (!e) continue;
    await banco.preparar([e.archivo]);
    const w = banco.wav(e.archivo); if (!w) continue;
    const len = e.cutoff < 0 ? -e.cutoff : w.x.length / w.sr * 1000 - e.offset - e.cutoff;
    const a0 = Math.round(e.offset / 1000 * w.sr), a1 = Math.min(w.x.length, Math.round((e.offset + len) / 1000 * w.sr));
    if (a1 - a0 < w.sr * .1) continue;
    const an = world.analizar(Float64Array.from(w.x.subarray(a0, a1)), w.sr, { harvest: false, f0min: 60, f0max: 900 });
    const f = [...an.f0].filter(x => x > 0).sort((p, q) => p - q);
    if (f.length < 5) continue;
    c.midi = Math.round(69 + 12 * Math.log2(f[f.length >> 1] / 440)); c.supuesta = false;
  }
}

// lo que se muestra de un banco: nombre, reclist, alturas grabadas (y las capas con color)
export function datosDe(banco) {
  const capas = banco.alturas.map(a => ({ prefijo: a.prefijo || '', sufijo: a.sufijo || '', color: a.color || '', midi: a.midi }));
  // los colores sueltos (sufijos que no están en el prefix.map, como «_dp» y «_sf» de MIKE)
  const sueltos = new Set();
  for (const a of banco.indice.keys()) { const m = /(_[a-z]{2,3})$/.exec(a); if (m && !capas.some(c => c.sufijo === m[1])) sueltos.add(m[1]); }
  return { nombre: banco.nombre, carpeta: banco.carpeta, reclist: banco.reclist, entradas: banco.entradas.length, sinArchivo: banco.sinArchivo, capas, sueltos: [...sueltos].filter(s => [...banco.indice.keys()].filter(a => a.endsWith(s)).length > 50) };
}
