// sw.js — la página sin conexión. Guarda en el navegador los archivos de la página (offline.json, que arma
// herramientas/offline.mjs con un resumen de cada uno) y los sirve desde ahí, con o sin internet.
//
// - Al instalarse guarda el núcleo (la página, el código y el modelo, unos 1,5 MB). Lo demás (las voces de MBROLA,
//   los loops, las muestras del coro, las librerías del PDF y del MP3) se guarda la primera vez que se usa, o todo
//   junto con el botón «Guardar todo» de la página.
// - Cada archivo se guarda con su resumen en la clave (motor/app.js?h=…). Cuando sale una versión nueva, lo que no
//   cambió se copia del guardado anterior en vez de bajarse otra vez.
// - VERSION la reescribe herramientas/offline.mjs: si cambia un archivo cambia este, y el navegador instala el nuevo.
//   El nuevo espera; la página avisa «Hay una versión nueva» y al recargar toma su lugar.
const VERSION = '876a33568c';
const PREFIJO = 'murga-', CACHE = PREFIJO + VERSION, FUENTES = PREFIJO + 'fuentes';
const BASE = new URL('./', self.location).href;

let lista = null;   // ruta → { h, n (núcleo) }
async function laLista() {
  if (lista) return lista;
  const c = await caches.open(CACHE);
  let r = await c.match(BASE + 'offline.json');
  if (!r) r = await fetch(BASE + 'offline.json', { cache: 'no-store' });
  const j = await r.json();
  lista = new Map(j.archivos.map(a => [a.u, a]));
  return lista;
}
const clave = a => BASE + a.u + '?h=' + a.h;

self.addEventListener('install', e => e.waitUntil((async () => {
  const r = await fetch(BASE + 'offline.json', { cache: 'no-store' });
  const j = await r.clone().json();
  if (j.version !== VERSION) throw new Error('offline.json no es de esta versión');
  const c = await caches.open(CACHE);
  await c.put(BASE + 'offline.json', r);
  const viejos = (await caches.keys()).filter(k => k.startsWith(PREFIJO) && k !== CACHE && k !== FUENTES);
  for (const a of j.archivos) {
    const k = clave(a);
    let hecho = false;
    for (const v of viejos) { const x = await (await caches.open(v)).match(k); if (x) { await c.put(k, x); hecho = true; break; } }
    if (!hecho && a.n) { const x = await fetch(BASE + a.u, { cache: 'no-cache' }); if (!x.ok) throw new Error('no se pudo bajar ' + a.u); await c.put(k, x); }
  }
})()));

// Una versión nueva espera a que la página diga «Recargar» (si no, una página abierta mezclaría código viejo y nuevo)
self.addEventListener('message', e => { if (e.data === 'saltar') self.skipWaiting(); });

self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith(PREFIJO) && k !== CACHE && k !== FUENTES) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // las letras de Google: se guardan la primera vez y se renuevan cuando hay internet
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const c = await caches.open(FUENTES), x = await c.match(req);
      const red = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => x || Response.error());
      return x || red;
    })());
    return;
  }
  if (!req.url.startsWith(BASE)) return;
  let ruta = decodeURIComponent(url.pathname.slice(new URL(BASE).pathname.length));
  if (ruta === '' || ruta.endsWith('/')) ruta += 'index.html';
  if (ruta === 'sw.js' || ruta === 'offline.json') return;
  // los bancos no se guardan acá (no están en offline.json): sus miles de pedidos de rango van directo a la red
  if (ruta.startsWith('bancos/') && ruta.endsWith('.zip')) return;
  e.respondWith((async () => {
    const L = await laLista().catch(() => null), a = L && L.get(ruta);
    if (!a) return fetch(req);
    const c = await caches.open(CACHE), k = clave(a);
    const x = await c.match(k);
    if (x) return x;
    const r = await fetch(BASE + a.u);
    if (r.ok) await c.put(k, r.clone());
    return r;
  })());
});
