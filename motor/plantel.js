// plantel.js — el plantel de la murga en la página: los bancos de voces de UTAU (bancos/plantel.json) y las voces que
// salen de cada uno (docs/plan_cantantes.md). Cada banco es un .zip:
//   - si está en la carpeta bancos/ de la página (en la compu, con herramientas/servir.js), se lee de ahí, de a pedazos;
//   - si no (la página publicada no los trae: no se redistribuyen), queda apagado y se puede buscar el .zip en la
//     compu; Chrome y Edge recuerdan el archivo elegido (su llave, en IndexedDB) para la próxima vez.
// Todos los bancos que estén vienen marcados; desmarcarlos saca sus voces. Las voces de banco se eligen en el inspector
// de cada murguista («banco:MIKE»), y cantan en los obreros con el motor de bancos (cantor/obrero.js).
import { guardarBanco, listarBancos, guardarDato, leerDato, permiso } from './cantor/bancos.js';
import { CUERDAS_DIFONOS, cantorDifonos } from './cantor/difonos.js';
import { VARIACION, VARIACION_DIFONOS, VARIACION_BANCO, GRITO_BANCO, ESTILO, ESTILO_BANCO } from './cantor/variacion.js';

const URL_PLANTEL = new URL('../bancos/plantel.json', import.meta.url);
const urlDelBanco = a => new URL('../bancos/' + encodeURIComponent(a), import.meta.url).href;
// los valores que sólo tienen las voces de banco (los demás son los de siempre: garganta, vibrato, grito...)
export const PARAMS_BANCO = [
  ['tension', 'Tensión', -1, 1, .05, v => `${v > 0 ? '+' : ''}${v.toFixed(2)}`, 'La voz apretada: menos fundamental y más agudos (negativa: más floja).'],
  ['ronquera', 'Ronquera', 0, 1, .05, v => v < .01 ? 'nada' : v.toFixed(2), 'La voz rajada: la altura tiembla rápido y aparece un subarmónico.'],
  ['aire', 'Aire', 0, 1, .05, v => v < .01 ? 'nada' : v.toFixed(2), 'Voz soplada.'],
  ['esfuerzo', 'Esfuerzo', -5, 7, 1, v => `${v > 0 ? '+' : ''}${v} st`, 'Canta con la grabación de una nota más aguda (más esforzada) o más grave (más relajada).'],
  ['modulacion', 'Temblor de la grabación', 0, 1.5, .05, v => v.toFixed(2), 'Cuánto del temblor natural de altura de la grabación queda.'],
];
const META = new Set(['nombre', 'banco', 'carpeta', 'mbrola', 'capa', 'color', 'evitar', 'nota']);
const valoresDe = v => Object.fromEntries(Object.entries(v || {}).filter(([k, x]) => !META.has(k) && typeof x === 'number'));

const P = { bancos: [], voces: [], murga: {}, activos: {}, alCambiar: [], caja: null };
let listoOk; export const listo = new Promise(r => { listoOk = r; });
const avisar = () => { dibujar(); for (const f of P.alCambiar) try { f(); } catch (e) { console.error(e); } };
export const alCambiar = f => P.alCambiar.push(f);

// ── qué voces hay ──
const bancoDe = a => P.bancos.find(b => b.archivo === a);
const disponible = v => !!v && (v.mbrola || (bancoDe(v.banco)?.estado === 'listo' && P.activos[v.banco] !== false));
export const vozDe = valor => (typeof valor === 'string' && valor.startsWith('banco:') ? P.voces.find(v => v.nombre === valor.slice(6)) : null);
export const esDeBanco = valor => typeof valor === 'string' && valor.startsWith('banco:');
export const nombreDeVoz = valor => (esDeBanco(valor) ? valor.slice(6) : valor);
export const vozDisponible = valor => disponible(vozDe(valor));
// un valor propio de la voz del plantel (su grito, su tensión...), si lo tiene
export const valorDeVoz = (valor, k) => valoresDe(vozDe(valor))[k];
// las voces de banco para la lista del inspector: [{ valor, nombre, nota, disponible, por qué no }]
export function vocesDeBanco() {
  return P.voces.filter(v => v.banco).map(v => {
    const b = bancoDe(v.banco), ok = disponible(v);
    return { valor: 'banco:' + v.nombre, nombre: v.nombre, nota: v.nota || '', disponible: ok, falta: ok ? '' : !b ? 'su banco no está en el plantel' : P.activos[v.banco] === false ? 'su banco está desmarcado en el plantel' : b.estado === 'permiso' ? 'falta dar permiso para leer su .zip' : `falta el archivo ${v.banco}` };
  });
}
// la voz de un lugar según el plantel (bajos0, primos3...), si su banco está; si no, null (canta MBROLA)
export function vozDeLugar(clave) {
  const n = P.murga[clave], v = n && P.voces.find(x => x.nombre === n);
  return v && v.banco && disponible(v) ? 'banco:' + v.nombre : null;
}
// las opciones del motor de bancos para una voz: o, las de un cantor de difonos (cantorDifonos + lo cambiado a mano);
// manuales, lo cambiado a mano (gana sobre los valores de la voz). La garganta de difonos es la de MBROLA para esa
// cuerda: para un banco cuenta sólo lo que cada cantor tiene de más o de menos.
// c: el número del cantor en su cuerda. Los cantores de banco cantan más abiertos que los de MBROLA (VARIACION_BANCO,
// medida contra el coro real): su desafinación y su vibrato salen de la misma semilla con esa variación.
export function opcionesBanco(valor, cuerda, o, manuales = {}, c = 0) {
  const v = vozDe(valor); if (!disponible(v)) return null;
  const { tracto, color, inclinacion, voz, w, memo, ...b } = o;
  const T = CUERDAS_DIFONOS[cuerda]?.tracto || 1;
  const vb = cantorDifonos(cuerda, o.semilla, { c, V: { ...VARIACION, ...VARIACION_DIFONOS, ...VARIACION_BANCO }, E: { ...ESTILO, ...ESTILO_BANCO } });
  // el grito de MBROLA (0,6 con «Gritan», por cantor y por «Cuánto gritan»), llevado al de los bancos (GRITO_BANCO)
  const abiertos = { grito: (o.grito ?? .6) / .6 * GRITO_BANCO, transporte: vb.transporte, vibrato: vb.vibrato, vibVel: vb.vibVel, vibEntra: vb.vibEntra, consonantes: vb.consonantes, pique: vb.pique, pasa: vb.pasa, caida: vb.caida, desafinaNota: VARIACION_BANCO.desafinaNota, modulacion: VARIACION_BANCO.modulacion, temblor: VARIACION_BANCO.temblor };
  return { ...b, ...abiertos, ...valoresDe(v), ...Object.fromEntries(Object.entries(manuales).filter(([k]) => k !== 'voz' && k !== 'tracto')), tracto: (manuales.tracto ?? tracto ?? T) / T * (valoresDe(v).tracto ?? 1), banco: v.banco, capa: v.capa, evitar: v.evitar };
}
// presentarle un banco a un obrero (una vez por obrero)
const presentados = new WeakMap();
export function presentar(w, archivo, enObrero) {
  if (!presentados.has(w)) presentados.set(w, new Map());
  const m = presentados.get(w);
  if (!m.has(archivo)) { const b = bancoDe(archivo); const p = enObrero(w, { tipo: 'banco', banco: archivo, fuente: b.fuente }); m.set(archivo, p); p.catch(() => m.delete(archivo)); }
  return m.get(archivo);
}

// ── buscar los bancos ──
async function probarUrl(b) {
  try { const r = await fetch(urlDelBanco(b.archivo), { headers: { Range: 'bytes=0-0' } }); if (r.ok) { r.body?.cancel?.(); return true; } } catch { /* sin red o sin servidor */ }
  return false;
}
async function ubicar(b) {
  if (await probarUrl(b)) { b.estado = 'listo'; b.donde = 'carpeta'; b.fuente = { url: urlDelBanco(b.archivo) }; return; }
  const g = (await listarBancos().catch(() => [])).find(x => x.id === 'zip:' + b.archivo);
  if (g?.handle) {
    b.handle = g.handle;
    if (await permiso(g.handle).catch(() => false)) { b.estado = 'listo'; b.donde = 'archivo'; b.fuente = { zip: g.handle }; return; }
    b.estado = 'permiso'; return;
  }
  b.estado = 'falta';
}
async function buscarArchivo(b) {
  try {
    let fuente, recordado = false;
    if (typeof showOpenFilePicker === 'function') {
      const [h] = await showOpenFilePicker({ id: 'banco-utau', types: [{ description: 'Banco de voces de UTAU (.zip)', accept: { 'application/zip': ['.zip', '.uar'] } }] });
      await guardarBanco({ id: 'zip:' + b.archivo, nombre: b.nombre, handle: h, agregado: Date.now() }); b.handle = h; fuente = { zip: h }; recordado = true;
    } else {
      const f = await new Promise(ok => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.zip,.uar'; i.onchange = () => ok(i.files[0]); i.click(); });
      if (!f) return; fuente = { zip: f };
    }
    b.estado = 'listo'; b.donde = recordado ? 'archivo' : 'sesion'; b.fuente = fuente; P.activos[b.archivo] = true;
    guardarDato('plantel.activos', P.activos).catch(() => {});
    avisar();
  } catch (e) { if (e?.name !== 'AbortError') { b.error = e?.message || String(e); dibujar(); } }
}
async function darPermiso(b) {
  try { if (b.handle && await permiso(b.handle, true)) { b.estado = 'listo'; b.donde = 'archivo'; b.fuente = { zip: b.handle }; avisar(); } }
  catch (e) { b.error = e?.message || String(e); dibujar(); }
}

// ── en la página ──
export async function iniciarPlantel(caja) {
  P.caja = caja;
  try {
    const j = await (await fetch(URL_PLANTEL)).json();
    P.bancos = (j.bancos || []).map(b => ({ ...b, estado: 'buscando' })); P.voces = j.voces || []; P.murga = j.murga || {};
    P.activos = (await leerDato('plantel.activos').catch(() => null)) || {};
    dibujar();
    await Promise.all(P.bancos.map(ubicar));
  } catch (e) { console.warn('el plantel no está:', e); P.error = e?.message || String(e); }
  listoOk(); avisar();
}
const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ESTADO = {
  buscando: ['buscando…', 'Buscando el .zip en la carpeta bancos/ de la página.'],
  listo: ['listo', ''],
  falta: ['falta el archivo', 'No está en la carpeta bancos/ de la página (la página publicada no trae los bancos: no se pueden redistribuir). Bajalo de la página de su autor y elegilo con «Buscar el archivo».'],
  permiso: ['falta el permiso', 'Ya lo elegiste antes: el navegador pide un clic para volver a leerlo.'],
};
export function dibujar() {
  const caja = P.caja; if (!caja) return;
  if (P.error) { caja.innerHTML = `<p class="hint">No encontré el plantel (bancos/plantel.json): ${esc(P.error)}.</p>`; return; }
  const n = P.bancos.filter(b => b.estado === 'listo' && P.activos[b.archivo] !== false).length;
  caja.innerHTML = `<div class="pl-cab"><h3>El plantel</h3><span class="hint">${n} de ${P.bancos.length} bancos cantando</span></div>
    <p class="hint">Los bancos de voces que puede usar la murga: grabaciones de cantantes de verdad (UTAU), cada una en un .zip. Marcá los que querés; sus voces aparecen en «Voz» de cada murguista, y por defecto cada lugar canta con la voz que le toca. Un banco que no está se apaga y sus lugares cantan con MBROLA. Pasá el mouse por cada uno para ver quién lo grabó y sus condiciones de uso.</p>
    <ul class="pl-lista"></ul>`;
  const ul = caja.querySelector('.pl-lista');
  for (const b of P.bancos) {
    const li = document.createElement('li'), ok = b.estado === 'listo', [rot, ayuda] = ESTADO[b.estado] || ['', ''];
    const voces = P.voces.filter(v => v.banco === b.archivo).map(v => v.nombre);
    li.className = 'pl-banco ' + b.estado + (ok && P.activos[b.archivo] === false ? ' apagado' : '');
    li.title = `${b.nombre} — ${b.autor || ''}${b.idioma ? ` · ${b.idioma}` : ''}\nVoces: ${voces.join(', ')}\nCondiciones: ${b.condiciones || '—'}\nArchivo: bancos/${b.archivo}${b.donde === 'archivo' ? ' (elegido de la compu)' : b.donde === 'sesion' ? ' (elegido por esta sesión)' : ''}`;
    li.innerHTML = `<label class="chk"><input type="checkbox" ${ok && P.activos[b.archivo] !== false ? 'checked' : ''} ${ok ? '' : 'disabled'}> <b>${esc(b.nombre)}</b></label>
      <small>${esc(b.idioma || '')} · ${voces.length === 1 ? 'una voz' : voces.length + ' voces'}: ${esc(voces.join(', '))}</small>
      <span class="pl-estado" title="${esc(ayuda)}">${esc(rot)}</span>
      <span class="pl-acc"></span>`;
    const chk = li.querySelector('input');
    chk.title = ok ? 'Desmarcado, sus voces no cantan (sus lugares pasan a MBROLA)' : 'Falta el archivo: buscalo para poder marcarlo';
    chk.onchange = () => { P.activos[b.archivo] = chk.checked; guardarDato('plantel.activos', P.activos).catch(() => {}); avisar(); };
    const acc = li.querySelector('.pl-acc');
    if (b.estado === 'falta' || b.estado === 'permiso' || b.donde === 'sesion') {
      const bt = document.createElement('button'); bt.className = 'btn'; bt.textContent = b.estado === 'permiso' ? 'Dar permiso' : 'Buscar el archivo…';
      bt.title = b.estado === 'permiso' ? 'El navegador pregunta si la página puede leer el .zip que elegiste la otra vez' : `Elegir ${b.archivo} (o el .zip tal como lo baja su autor) desde la compu`;
      bt.onclick = () => (b.estado === 'permiso' ? darPermiso(b) : buscarArchivo(b)); acc.append(bt);
    }
    if (b.web) { const a = document.createElement('a'); a.href = b.web; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'de dónde bajarlo'; a.title = 'La página del autor del banco'; acc.append(a); }
    if (b.error) { const e = document.createElement('small'); e.className = 'pl-error'; e.textContent = b.error; li.append(e); }
    ul.append(li);
  }
}
// los estilos del plantel, con las variables de la página
const css = document.createElement('style');
css.textContent = `.plantel{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:0 0 14px;background:var(--well)}
.plantel .pl-cab{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.plantel h3{margin:0;font-size:15px}
.pl-lista{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:6px}
.pl-banco{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:6px 10px}
.pl-banco label{font-size:14px}.pl-banco small{color:var(--muted);flex:1 1 220px;min-width:0}
.pl-estado{font-size:12px;font-weight:600;color:var(--ok)}.pl-banco.falta .pl-estado,.pl-banco.permiso .pl-estado{color:var(--mal)}.pl-banco.buscando .pl-estado{color:var(--muted)}
.pl-banco.falta,.pl-banco.permiso,.pl-banco.apagado{opacity:.75}.pl-banco.falta b,.pl-banco.permiso b{text-decoration:line-through;text-decoration-thickness:1px}
.pl-acc{display:flex;gap:8px;align-items:center}.pl-acc a{font-size:12px;color:var(--muted)}.pl-error{color:var(--mal);flex-basis:100%}`;
document.head.append(css);
