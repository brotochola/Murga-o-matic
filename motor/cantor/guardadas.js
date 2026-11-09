// guardadas.js — las voces ya cantadas, guardadas en el navegador (IndexedDB), para que al recargar la página no se
// vuelvan a cantar. Cada entrada es un cantor cantando un pedazo de la pieza (en la página, un murguista en una
// sección): la clave sale de todo lo que canta (el motor, sus opciones y sus notas con sus sílabas) y de la versión
// del código que canta (el texto de motor/cantor/*.js y las voces de motor/vendor, según offline.json): si cambia el
// código, lo guardado deja de servir solo. Se guarda en 16 bits, cada arreglo con su escala.
// Hasta TOPE bytes (o la mitad de lo que el navegador le da a la página): cuando se pasa, salen las menos usadas.
// Lo usan los obreros (obrero.js); la página puede borrarlas o contarlas (borrarTodo, cuanto).
const DB = 'murga-voces', VOCES = 'voces', USOS = 'usos', TOPE = 1e9;
let base = null, version = null, quedan = 0;

function abrir() {
  return base ??= new Promise((ok, mal) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore(VOCES, { keyPath: 'k' }); d.createObjectStore(USOS, { keyPath: 'k' }).createIndex('usado', 'usado'); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => { base = null; mal(r.error); };
  });
}
const hecho = t => new Promise((ok, mal) => { t.oncomplete = () => ok(); t.onerror = t.onabort = () => mal(t.error); });
const pedido = r => new Promise((ok, mal) => { r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });

// un resumen corto de un texto largo (las notas de un cantor son decenas de KB): SHA-256, o FNV si no hay crypto.subtle
async function resumen(t) {
  if (globalThis.crypto?.subtle) {
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
    return [...h.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let a = 0x811c9dc5, b = 0x01000193;
  for (let i = 0; i < t.length; i++) { a = Math.imul(a ^ t.charCodeAt(i), 0x01000193); b = Math.imul(b ^ t.charCodeAt(i), 0x5bd1e995); }
  return (a >>> 0).toString(16) + (b >>> 0).toString(16) + t.length.toString(16);
}

// la versión del código que canta: el texto de cada motor/cantor/*.js (aunque offline.json esté atrasado mientras se
// edita) y los resúmenes de las voces y los wasm de motor/vendor
function laVersion() {
  return version ??= (async () => {
    try {
      const raiz = new URL('../../', import.meta.url);
      const j = await (await fetch(new URL('offline.json', raiz), { cache: 'no-cache' })).json();
      const cantor = j.archivos.map(a => a.u).filter(u => /^motor\/cantor\/[^/]+\.js$/.test(u)).sort();
      const vendor = j.archivos.filter(a => /^motor\/vendor\/(mbrola|world)\//.test(a.u)).map(a => a.u + ':' + a.h).sort();
      const textos = await Promise.all(cantor.map(u => fetch(new URL(u, raiz)).then(r => r.ok ? r.text() : '')));
      return await resumen(textos.join('\n\0\n') + '\n' + vendor.join('\n'));
    } catch { return 'sin-version'; }
  })();
}

export async function claveDe(texto) { return resumen((await laVersion()) + '\n' + texto); }

// cada arreglo con su escala (los de formantes pasan de 1 antes de mezclarse)
function a16(x) { let p = 1; for (const v of x) if (Math.abs(v) > p) p = Math.abs(v); const k = 32767 / p; return { q: Int16Array.from(x, v => Math.round(v * k)), p }; }
const a32 = ({ q, p }) => { const k = p / 32767; return Float32Array.from(q, v => v * k); };

// lo guardado con esta clave (los arreglos de vuelta en Float32), o null
export async function leer(k, arreglos) {
  try {
    const d = await abrir(), t = d.transaction([VOCES, USOS], 'readwrite');
    const g = await pedido(t.objectStore(VOCES).get(k));
    if (!g) return null;
    t.objectStore(USOS).put({ k, usado: Date.now(), n: g.n });
    const r = { ...g.r };
    for (const a of arreglos) r[a] = a32(g.r[a]);
    return r;
  } catch { return null; }
}

// guarda r con esta clave. Los arreglos se pasan a 16 bits enseguida (antes de cualquier espera), así quien llama
// puede transferirlos después de llamar
export function guardar(k, r, arreglos) {
  const g = { ...r }; let n = 0;
  for (const a of arreglos) { g[a] = a16(r[a]); n += g[a].q.byteLength; }
  return (async () => {
    try {
      const d = await abrir(), t = d.transaction([VOCES, USOS], 'readwrite');
      t.objectStore(VOCES).put({ k, r: g, n });
      t.objectStore(USOS).put({ k, usado: Date.now(), n });
      await hecho(t);
      if (++quedan % 20 === 1) await podar();
    } catch { /* sin lugar o sin IndexedDB: se canta igual */ }
  })();
}

// si se pasa del tope, salen las menos usadas hasta quedar en el 80 %
async function podar() {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const tope = Math.min(TOPE, est?.quota ? est.quota / 2 : TOPE);
  let usado = est?.usage ?? 0;
  if (usado <= tope) return;
  const d = await abrir(), t = d.transaction([VOCES, USOS], 'readwrite'), usos = t.objectStore(USOS), voces = t.objectStore(VOCES);
  await new Promise(ok => {
    const c = usos.index('usado').openCursor();
    c.onsuccess = () => { const x = c.result; if (!x || usado <= tope * .8) return ok(); voces.delete(x.value.k); x.delete(); usado -= x.value.n || 0; x.continue(); };
    c.onerror = () => ok();
  });
  await hecho(t).catch(() => {});
}

// cuántas hay y cuánto pesan
export async function cuanto() {
  try {
    const d = await abrir(), t = d.transaction(USOS, 'readonly');
    const todos = await pedido(t.objectStore(USOS).getAll());
    return { n: todos.length, bytes: todos.reduce((a, x) => a + (x.n || 0), 0) };
  } catch { return { n: 0, bytes: 0 }; }
}

export async function borrarTodo() {
  try { const d = await abrir(), t = d.transaction([VOCES, USOS], 'readwrite'); t.objectStore(VOCES).clear(); t.objectStore(USOS).clear(); await hecho(t); } catch { }
}

// la versión se calcula apenas se carga (en cada obrero), así no hace esperar a la primera voz
laVersion();
