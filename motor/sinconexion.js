// sinconexion.js — la página sin internet: registra sw.js, cuenta cuánto hay guardado, guarda todo con un botón,
// ofrece instalarla como app y avisa cuando hay una versión nueva. (En la compu de desarrollo no se registra,
// para no servir archivos viejos mientras se edita; con ?offline=1 sí.)
const $ = id => document.getElementById(id);
const BASE = new URL('../', import.meta.url).href;
const sw = navigator.serviceWorker;
const MB = b => (b / 1e6).toLocaleString('es', { maximumFractionDigits: 1 }) + ' MB';
const desarrollo = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && !new URLSearchParams(location.search).has('offline');
const app = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const texto = t => { $('sinredTexto').textContent = t; };

// la lista de la versión que está sirviendo el sw (la guardó al instalarse); si todavía no hay, la de la red
async function laLista() {
  const r = (await caches.match(BASE + 'offline.json')) || (await fetch(BASE + 'offline.json', { cache: 'no-store' }));
  return r.json();
}
async function cuanto(j) {
  const c = await caches.open('murga-' + j.version);
  const falta = [];
  let b = 0;
  for (const a of j.archivos) { if (await c.match(BASE + a.u + '?h=' + a.h)) b += a.b; else falta.push(a); }
  return { b, total: j.archivos.reduce((x, a) => x + a.b, 0), falta };
}
async function mostrar() {
  try {
    const j = await laLista(), { b, total, falta } = await cuanto(j);
    $('guardarTodo').textContent = falta.length ? `Guardar todo (${MB(total)})` : 'Todo guardado';
    $('guardarTodo').disabled = !falta.length;
    texto(falta.length
      ? `Guardado en este navegador: ${MB(b)} de ${MB(total)}. Lo que usás se guarda solo; con «Guardar todo» queda todo para cantar sin internet: las tres voces de difonos, las muestras del coro, la batería, la partitura y el MP3.`
      : `Todo guardado (${MB(total)}): la página anda sin internet${app ? '' : ', desde este navegador o instalada como app'}.`);
  } catch (e) { texto('Todavía no se pudo leer qué hay guardado: recargá la página con internet.'); }
}

async function guardarTodo() {
  const btn = $('guardarTodo'), barra = $('sinredAvance');
  btn.disabled = true;
  try {
    await sw.ready;
    if (!sw.controller) await new Promise(r => sw.addEventListener('controllerchange', r, { once: true }));
    try { await navigator.storage?.persist?.(); } catch (e) {}
    const j = await laLista(), { b, total, falta } = await cuanto(j);
    let hecho = b, i = 0, errores = 0;
    barra.hidden = false; barra.value = hecho / total;
    const uno = async () => {
      while (i < falta.length) {
        const a = falta[i++];
        try { const r = await fetch(BASE + a.u); if (!r.ok) throw new Error(r.status); await r.arrayBuffer(); hecho += a.b; } catch (e) { errores++; }
        barra.value = hecho / total; texto(`Guardando: ${MB(hecho)} de ${MB(total)}…`);
      }
    };
    await Promise.all([uno(), uno(), uno()]);
    barra.hidden = true;
    await mostrar();
    if (errores) texto(`Faltaron ${errores} archivos (¿se cortó internet?). Volvé a apretar «Guardar todo».`);
  } catch (e) { barra.hidden = true; texto('No se pudo guardar: ' + (e?.message || e)); btn.disabled = false; }
}

// instalar como app: Chrome y Android avisan que se puede; en iPhone es a mano
let pedido = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); pedido = e; $('instalar').hidden = false; });
addEventListener('appinstalled', () => { $('instalar').hidden = true; });
$('instalar').onclick = async () => { if (!pedido) return; pedido.prompt(); await pedido.userChoice.catch(() => {}); pedido = null; $('instalar').hidden = true; };
if (/iPhone|iPad|iPod/.test(navigator.userAgent) && !app) $('sinredIos').hidden = false;

// una versión nueva queda esperando hasta que se aprieta «Recargar»
function avisar(w) {
  $('avisoVersion').hidden = false;
  $('recargar').onclick = () => { sw.addEventListener('controllerchange', () => location.reload(), { once: true }); w.postMessage('saltar'); };
}

if (!sw || !window.caches) { texto('Este navegador no puede guardar la página para usarla sin internet.'); $('guardarTodo').disabled = true; }
else if (desarrollo) { texto('En la compu de desarrollo la página no se guarda (para no servir archivos viejos mientras se edita); con ?offline=1 en la dirección, sí.'); $('guardarTodo').disabled = true; }
else {
  $('guardarTodo').onclick = guardarTodo;
  sw.register(BASE + 'sw.js').then(reg => {
    if (reg.waiting && sw.controller) avisar(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && sw.controller) avisar(w); if (w.state === 'activated') mostrar(); });
    });
    mostrar();
  }).catch(e => texto('No se pudo preparar la página para usarla sin internet: ' + (e?.message || e)));
}
