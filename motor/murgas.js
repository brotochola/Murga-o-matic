// murgas.js — las murgas guardadas en este navegador (IndexedDB): la pieza entera (con lo que se le cambió a mano), la
// letra, los cantantes y la mezcla. Una murga es un objeto con `id`, `nombre`, `cambiada` (ms) y `resumen`, más lo que
// arma app.js (foto()). Al abrirla no se vuelve a componer: la pieza viene guardada.
const BASE = 'murga-o-matic', VERSION = 1, TABLA = 'murgas';
let db = null;
function abrir() {
  if (db) return db;
  db = new Promise((ok, mal) => {
    if (!globalThis.indexedDB) { mal(new Error('este navegador no guarda datos (IndexedDB)')); return; }
    const r = indexedDB.open(BASE, VERSION);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(TABLA)) d.createObjectStore(TABLA, { keyPath: 'id' }).createIndex('cambiada', 'cambiada'); };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
    r.onblocked = () => mal(new Error('la base de datos está abierta en otra pestaña con otra versión'));
  });
  db.catch(() => { db = null; });
  return db;
}
const pedido = (modo, hacer) => abrir().then(d => new Promise((ok, mal) => {
  const t = d.transaction(TABLA, modo), r = hacer(t.objectStore(TABLA));
  t.oncomplete = () => ok(r?.result); t.onerror = () => mal(t.error); t.onabort = () => mal(t.error || new Error('se canceló'));
}));

export const guardarMurga = m => pedido('readwrite', s => s.put(m));
export const leerMurga = id => pedido('readonly', s => s.get(id));
export const borrarMurga = id => pedido('readwrite', s => s.delete(id));
// la lista, de la más reciente a la más vieja, sin la pieza (sólo lo que hace falta para elegir)
export function listarMurgas() {
  return abrir().then(d => new Promise((ok, mal) => {
    const out = [], r = d.transaction(TABLA, 'readonly').objectStore(TABLA).index('cambiada').openCursor(null, 'prev');
    r.onsuccess = () => { const c = r.result; if (!c) { ok(out); return; } const m = c.value; out.push({ id: m.id, nombre: m.nombre, resumen: m.resumen, cambiada: m.cambiada }); c.continue(); };
    r.onerror = () => mal(r.error);
  }));
}
export const nuevoId = () => globalThis.crypto?.randomUUID?.() || 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
