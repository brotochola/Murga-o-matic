// multipista.js — la pieza como un multipista, a lo Timba-o-matic: una fila por cosa y el tiempo de izquierda a derecha,
// en compases (todos del mismo ancho, aunque cambie el tempo). Arriba los compases (tocar uno salta ahí), las secciones
// (elegir una), los acordes (cambiarlos), la letra; después una pista por cuerda con sus notas (elegir una nota,
// arrastrarla para arriba o abajo) y la batería con el loop de cada compás (cambiarlo). Cada pista tiene su M, S y
// volumen. La letra, de lejos, va verso por verso; de cerca, sílaba por sílaba debajo de su nota: nunca apilada.
// Las pistas se dibujan en un lienzo por sección (así una retirada larga con mucho zoom no pasa el máximo de un lienzo).
import { CUERDAS } from './vista.js';

const ARRIBA_ABAJO = ['tercia', 'sobreprimos', 'primos', 'segundos', 'bajos'];
const ALTO = { tercia: 44, sobreprimos: 60, primos: 72, segundos: 64, bajos: 56 };
const COLOR_TIPO = { clarinada: '--accent', coro: '--primos', pleno: '--sobreprimos', duo: '--tercia', llamada: '--segundos', cierre: '--muted' };
const ZOOMS = [0, 32, 64, 128, 240];   // px por compás; 0 = que entre toda la pieza
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Las filas de los cantantes (una cuerda desplegada con ▸): en cada sección, un bloque que dice si su voz ya está
// cantada (♪), si quedó vieja (cambió algo desde que cantó) o si falta; tocándolo se canta esa sección. Con M y S, se
// lo calla o se lo escucha solo, en vivo. Su estilo va con el multipista.
const VOZ_TXT = { cantada: 'cantada', vieja: 'cambió desde que cantó: tocá para cantarla de nuevo', falta: 'sin cantar: tocá para cantarla' };
const VOZ_MARCA = { cantada: '♪', vieja: '↻ vieja', falta: '+ cantar' };
if (typeof document !== 'undefined' && !document.getElementById('mt-cantor-css')) {
  const st = document.createElement('style'); st.id = 'mt-cantor-css';
  st.textContent = `.mt-desp{border:0;background:transparent;color:var(--muted);cursor:pointer;padding:0;font-size:11px;width:14px;flex:none;line-height:1}
.mt-desp:hover{color:var(--ink)}
.mt-cantor .mt-c{height:22px}
.mt-cantor .mt-h{padding-left:24px;font-size:12px;gap:4px}
.mt-cantor .mt-h i{width:3px;opacity:.55}
.mt-cantor .mt-h b{font-weight:500;cursor:pointer;flex:0 1 auto}
.mt-cantor .mt-h small{color:var(--muted);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto;min-width:0}
.mt-cantor.muda .mt-c{opacity:.4}
.mt-voz{position:absolute;top:3px;bottom:3px;border-radius:4px;font:10px/14px var(--body);padding:0 4px;overflow:hidden;white-space:nowrap;text-align:left;cursor:pointer;color:var(--ink)}
.mt-voz.cantada{background:color-mix(in srgb,var(--ok) 28%,var(--panel));border:1px solid color-mix(in srgb,var(--ok) 60%,var(--line))}
.mt-voz.vieja{background:color-mix(in srgb,var(--accent) 22%,var(--panel));border:1px solid var(--accent)}
.mt-voz.falta{background:transparent;border:1px dashed var(--line);color:var(--muted)}
.mt-voz:hover{filter:brightness(1.08)}`;
  document.head.append(st);
}

export function crearMultipista(raiz, cb = {}) {
  const E = { D: null, bw: 64, zoom: 2, mudas: {}, solos: {}, vols: {}, sel: null, selNota: null, selSec: null, t: 0, seguir: true, sonando: false, arrastre: null, lienzos: [] };
  raiz.innerHTML = `<div class="mt" tabindex="-1"><div class="mt-in"><div class="mt-cabezal" aria-hidden="true"></div></div></div>`;
  const mt = raiz.querySelector('.mt'), inn = raiz.querySelector('.mt-in'), cabezal = raiz.querySelector('.mt-cabezal');
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const HEAD = () => parseFloat(getComputedStyle(raiz).getPropertyValue('--mt-head')) || 170;
  const X = q => q / 16 * E.bw;
  const callada = k => !!E.mudas[k] || (Object.values(E.solos).some(Boolean) && !E.solos[k]);

  function anchoCompas() {
    const D = E.D; if (!D) return 64;
    const z = ZOOMS[E.zoom];
    if (z) return z;
    return Math.max(4, (mt.clientWidth - HEAD() - 4) / D.compases);
  }

  // q de un tiempo (la inversa de T: búsqueda binaria, T crece)
  function qDe(t) { const D = E.D; let lo = 0, hi = D.totalQ; for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (D.T(m) <= t) lo = m; else hi = m; } return lo; }

  function fila(clase, cabeza, contenido = '') {
    const f = document.createElement('div'); f.className = 'mt-row ' + clase;
    f.innerHTML = `<div class="mt-h">${cabeza}</div><div class="mt-c" style="width:${X(E.D.totalQ)}px">${contenido}</div>`;
    inn.insertBefore(f, cabezal); return f;
  }

  function armar() {
    const D = E.D; if (!D) return;
    E.bw = anchoCompas();
    for (const f of [...inn.querySelectorAll('.mt-row')]) f.remove();
    E.lienzos = [];
    const W = X(D.totalQ);
    // compases
    let regla = '';
    const paso = E.bw < 10 ? 16 : E.bw < 22 ? 8 : E.bw < 40 ? 4 : E.bw < 90 ? 2 : 1;
    for (let c = 0; c < D.compases; c++) regla += `<span class="mt-n${c % paso ? ' chico' : ''}" style="left:${c * E.bw}px;width:${E.bw}px">${c % paso ? '' : c + 1}</span>`;
    fila('mt-regla', '<b>Compás</b>', regla).querySelector('.mt-c').onclick = ev => { const r = ev.currentTarget.getBoundingClientRect(); cb.alBuscar?.(D.T(Math.max(0, (ev.clientX - r.left) / E.bw * 16))); };
    // secciones
    let secs = '';
    D.secciones.forEach((s, i) => { secs += `<button class="mt-sec${E.selSec === s.nombre ? ' elegida' : ''}${s.bateria ? '' : ' capela'}${s.cantada ? ' cantada' : ''}" data-i="${i}" style="left:${X(s.q0) + 1}px;width:${Math.max(4, X(s.q1) - X(s.q0) - 2)}px;--c:var(${COLOR_TIPO[s.tipo] || '--muted'})" title="${esc(s.nombre)} · ${esc(s.textura)}">${esc(s.nombre)}</button>`; });
    const fs = fila('mt-secs', '<b>Secciones</b>', secs);
    fs.querySelectorAll('.mt-sec').forEach(b => b.onclick = () => cb.alElegirSeccion?.(D.secciones[+b.dataset.i].nombre));
    // acordes (dos por compás)
    let acs = '';
    for (const s of D.secciones) s.acordes.forEach((a, j) => {
      const q = s.q0 + j * 8; if (q >= s.q1) return;
      const fin = j === s.acordes.length - 1 ? s.q1 : Math.min(s.q1, q + 8), igual = j > 0 && s.acordes[j - 1].nombre === a.nombre && !a.cambiado;
      // el que cambia lleva el nombre y llega hasta el próximo cambio; los medios compases iguales van encima, sin nada escrito
      let hasta = j + 1; while (hasta < s.acordes.length && s.acordes[hasta].nombre === a.nombre && !s.acordes[hasta].cambiado) hasta++;
      const finTexto = hasta >= s.acordes.length ? s.q1 : Math.min(s.q1, s.q0 + hasta * 8), ancho = igual ? X(fin) - X(q) : X(finTexto) - X(q);
      acs += `<button class="mt-ac${a.cambiado ? ' cambiado' : ''}${igual ? ' igual' : ''}${s.editable ? '' : ' fijo'}" data-s="${esc(s.nombre)}" data-j="${j}" style="left:${X(q)}px;width:${Math.max(6, ancho)}px" title="${esc(a.nombre)} (${esc(a.grado)})" aria-label="Compás ${Math.floor(q / 16) + 1}: ${esc(a.nombre)}">${!igual && ancho >= 16 ? esc(a.nombre) : ''}</button>`;
    });
    const fa = fila('mt-acs', '<b>Acordes</b>', acs);
    fa.querySelectorAll('.mt-ac').forEach(b => b.onclick = ev => { ev.stopPropagation(); cb.alAcorde?.(b.dataset.s, +b.dataset.j, b); });
    // la letra
    if (D.versos.length) {
      let le = '';
      if (E.bw < 120) for (const v of D.versos) le += `<button class="mt-verso${E.sel && E.sel.i === v.i && E.sel.k === v.k ? ' elegido' : ''}" data-i="${v.i}" data-k="${v.k}" data-q="${v.q0}" style="left:${X(v.q0)}px;width:${Math.max(4, X(v.q1) - X(v.q0) - 2)}px" title="${esc(v.texto)}">${esc(v.texto)}</button>`;
      else D.silabas.forEach((s, j) => {   // de cerca, sílaba por sílaba en dos renglones: cada una tiene lugar hasta la que sigue en su renglón
        const sig = D.silabas[j + 2], fin = Math.max(s.q1, sig && sig.q0 > s.q0 ? Math.min(sig.q0, s.q0 + 32) : s.q1);
        le += `<span class="mt-sil${s.acento ? ' acento' : ''}${E.sel && E.sel.i === s.i && E.sel.k === s.k ? ' elegido' : ''}" data-i="${s.i}" data-k="${s.k}" data-q="${s.q0}" style="left:${X(s.q0)}px;top:${j % 2 ? 16 : 1}px;width:${Math.max(4, X(fin) - X(s.q0) - 1)}px" title="${esc(s.texto)}">${esc(s.texto)}</span>`;
      });
      const fl = fila('mt-letra' + (E.bw < 120 ? '' : ' silabas'), '<b>Letra</b>', le);
      fl.querySelector('.mt-c').onclick = ev => { const b = ev.target.closest('[data-i]'); if (b) cb.alElegirVerso?.(+b.dataset.i, +b.dataset.k, +b.dataset.q); };
    }
    // una pista por cuerda
    for (const k of ARRIBA_ABAJO) {
      const notas = D.notas.filter(n => n.cuerda === k); if (!notas.length) continue;
      const nombre = CUERDAS.find(c => c.k === k)?.nombre || k;
      const abierta = !!D.porCantante && (D.desplegadas || []).includes(k);
      const desp = D.porCantante ? `<button class="mt-desp" aria-expanded="${abierta}" title="${abierta ? 'Plegar' : 'Desplegar'} los cantantes de ${nombre.toLowerCase()}: qué cantó cada uno en cada sección">${abierta ? '▾' : '▸'}</button>` : '';
      const f = fila('mt-pista' + (callada(k) ? ' muda' : ''), `<i style="background:var(--${k})"></i>${desp}<b>${nombre}</b><span class="mt-ms"><button class="mt-m" aria-pressed="${!!E.mudas[k]}" title="Silenciar">M</button><button class="mt-s" aria-pressed="${!!E.solos[k]}" title="Sólo esta">S</button></span><input type="range" min="0" max="1.5" step="0.05" value="${E.vols[k] ?? 1}" aria-label="Volumen de ${nombre}">`);
      f.dataset.k = k;
      f.querySelector('.mt-m').onclick = () => cb.alMudo?.(k); f.querySelector('.mt-s').onclick = () => cb.alSolo?.(k);
      f.querySelector('.mt-desp')?.addEventListener('click', ev => { ev.stopPropagation(); cb.alDesplegar?.(k); });
      const vol = f.querySelector('input'); vol.oninput = () => cb.alVolumen?.(k, +vol.value); vol.onchange = () => cb.alVolumenFin?.(k);
      let lo = 99, hi = 0; for (const n of notas) { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); }
      const rango = { lo: lo - 1, hi: hi + 1 }, alto = Math.max(ALTO[k], Math.min(132, (rango.hi - rango.lo + 1) * (mt.clientWidth < 520 ? 3.5 : 5)));   // al menos 5 px por semitono (3,5 en el teléfono)
      f.style.setProperty('--alto', alto + 'px'); f.dataset.base = alto;
      const c = f.querySelector('.mt-c');
      for (const s of D.secciones) {
        const cv = document.createElement('canvas'); cv.className = 'mt-lienzo';
        cv.style.left = X(s.q0) + 'px'; cv.style.width = Math.max(1, X(s.q1) - X(s.q0)) + 'px';
        c.append(cv); E.lienzos.push({ cv, k, s, rango, h: alto, notas: notas.filter(n => n.q < s.q1 && n.q + n.d > s.q0) });
      }
      for (const ct of (abierta && D.cantantes?.[k]) || []) {
        let bl = '';
        for (const p of ct.partes) { const w = Math.max(4, X(p.q1) - X(p.q0) - 2); bl += `<button class="mt-voz ${p.estado}" data-sec="${esc(p.seccion)}" data-estado="${p.estado}" style="left:${X(p.q0) + 1}px;width:${w}px" title="${esc(ct.nombre)} en «${esc(p.seccion)}»: ${VOZ_TXT[p.estado]}">${w > 46 ? VOZ_MARCA[p.estado] : ''}</button>`; }
        const fc = fila('mt-cantor' + (ct.mudo ? ' muda' : ''), `<i style="background:var(--${k})"></i><b title="Ver y cambiar a ${esc(ct.nombre)}">${esc(ct.nombre)}</b><small title="${esc(ct.voz)}">${esc(ct.voz)}</small><span class="mt-ms"><button class="mt-m" aria-pressed="${ct.mudo}" title="Callarlo">M</button><button class="mt-s" aria-pressed="${ct.solo}" title="Escucharlo solo">S</button></span>`, bl);
        fc.dataset.k = k; fc.dataset.clave = ct.clave;
        fc.querySelector('.mt-h b').onclick = () => cb.alCantor?.(ct.clave);
        fc.querySelector('.mt-m').onclick = () => cb.alMudoCantor?.(ct.clave); fc.querySelector('.mt-s').onclick = () => cb.alSoloCantor?.(ct.clave);
        fc.querySelectorAll('.mt-voz').forEach(b => b.onclick = ev => { ev.stopPropagation(); if (b.dataset.estado === 'cantada') cb.alElegirSeccion?.(b.dataset.sec); else cb.alCantor?.(ct.clave, b.dataset.sec); });
      }
    }
    // la batería: el loop de cada compás
    let ba = '';
    for (const b of D.bateria) ba += `<button class="mt-bat${b.id || b.fijo ? '' : ' sin'}${b.propio ? ' cambiado' : ''}${b.fijo ? ' fijo' : ''}${b.igual && !b.propio ? ' igual' : ''}" data-q="${b.q}" style="left:${X(b.q)}px;width:${Math.max(4, X(Math.min(16, D.totalQ - b.q)) - 1)}px" title="Compás ${b.q / 16 + 1}: ${esc(b.nombre)}">${E.bw >= 28 && (!b.igual || b.propio) ? esc(b.corto) : ''}</button>`;
    const fb = fila('mt-bateria' + (callada('bateria') ? ' muda' : ''), `<i style="background:var(--bateria)"></i><b>Batería</b><span class="mt-ms"><button class="mt-m" aria-pressed="${!!E.mudas.bateria}" title="Silenciar">M</button><button class="mt-s" aria-pressed="${!!E.solos.bateria}" title="Sólo esta">S</button></span><input type="range" min="0" max="1.5" step="0.05" value="${E.vols.bateria ?? .42}" aria-label="Volumen de la batería">`, ba);
    fb.dataset.k = 'bateria';
    fb.querySelector('.mt-m').onclick = () => cb.alMudo?.('bateria'); fb.querySelector('.mt-s').onclick = () => cb.alSolo?.('bateria');
    const vb = fb.querySelector('input'); vb.oninput = () => cb.alVolumen?.('bateria', +vb.value); vb.onchange = () => cb.alVolumenFin?.('bateria');
    fb.querySelectorAll('.mt-bat').forEach(b => b.onclick = ev => { ev.stopPropagation(); cb.alBateria?.(+b.dataset.q, b); });
    inn.style.width = (HEAD() + W) + 'px';
    E.escalaV = 1; ajustarAlto(true);
    dibujarPistas(); moverCabezal();
  }

  // Las pistas de las cuerdas se escalan parejo para llenar el alto que hay: si no entran, se achican (hasta un mínimo)
  // antes de tener que hacer scroll; si sobra lugar, se agrandan (hasta una vez y media) y las notas son más fáciles de
  // tocar. En el teléfono la página se desplaza y el multipista tiene el alto que necesita, así que no se toca nada (si
  // no, el alto dependería de sí mismo). El alto de cada pista sigue el rango de sus notas (ver armar); acá sólo se escala.
  function ajustarAlto(sinDibujar) {
    const pistas = [...inn.querySelectorAll('.mt-pista')], disp = mt.clientHeight;
    if (!pistas.length || !disp) return;
    const otras = [...inn.querySelectorAll('.mt-row:not(.mt-pista)')].reduce((a, f) => a + f.offsetHeight, 0);
    const base = pistas.reduce((a, f) => a + (+f.dataset.base || 0), 0);
    const esc = base && matchMedia('(min-width:821px)').matches ? Math.floor(Math.max(.55, Math.min(1.5, (disp - otras - pistas.length) / base)) * 20) / 20 : 1;
    if (esc === E.escalaV) return;
    E.escalaV = esc;
    for (const f of pistas) {
      const alto = Math.max(32, Math.round(+f.dataset.base * esc)); f.style.setProperty('--alto', alto + 'px');
      for (const L of E.lienzos) if (L.k === f.dataset.k) L.h = alto;
    }
    if (!sinDibujar) dibujarPistas();
  }

  function dibujarPistas() {
    const dpr = window.devicePixelRatio || 1, linea = css('--line'), tinta = css('--ink'), acento = css('--accent'), pozo = css('--well'), gris = css('--muted');
    for (const L of E.lienzos) {
      const { cv, k, s, rango, notas, h } = L, w = Math.max(1, X(s.q1) - X(s.q0));
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      const alto = h / (rango.hi - rango.lo + 1), Y = p => (rango.hi - p) * alto;
      // un compás sí y uno no, un poco más oscuro; el principio de la sección, más marcado
      g.fillStyle = pozo; g.globalAlpha = .45;
      for (let q = s.q0; q < s.q1; q += 16) if ((q / 16) % 2 === 1) g.fillRect(X(q - s.q0), 0, Math.min(X(16), w - X(q - s.q0)), h);
      g.strokeStyle = linea; g.lineWidth = 1; g.globalAlpha = .6;
      for (let q = s.q0 + 16; q < s.q1; q += 16) { const x = X(q - s.q0) + .5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.strokeStyle = gris; g.globalAlpha = .55; g.beginPath(); g.moveTo(.5, 0); g.lineTo(.5, h); g.stroke();
      g.globalAlpha = 1; g.fillStyle = css('--' + k);
      for (const n of notas) {
        const arr = E.arrastre?.nota === n ? E.arrastre.d : 0;
        const x = X(n.q - s.q0), ww = Math.max(2, X(n.d) - 1), y = Y(n.p + arr) + .5, hh = Math.max(2, alto - 1);
        g.globalAlpha = callada(k) ? .3 : .9; g.beginPath(); g.roundRect ? g.roundRect(x, y, ww, hh, Math.min(2.5, hh / 2)) : g.rect(x, y, ww, hh); g.fill();
        if (E.selNota && E.selNota.cuerda === k && E.selNota.i === n.i) { g.globalAlpha = 1; g.strokeStyle = acento; g.lineWidth = 2.5; g.stroke(); g.strokeStyle = tinta; g.lineWidth = 1; g.stroke(); }
      }
      g.globalAlpha = 1;
      L.geo = { alto, rango };
    }
  }

  // tocar o arrastrar una nota
  function notaDe(ev) {
    const cv = ev.target.closest?.('.mt-lienzo'); if (!cv) return null;
    const L = E.lienzos.find(l => l.cv === cv); if (!L || !L.geo) return null;
    const r = cv.getBoundingClientRect(), q = L.s.q0 + (ev.clientX - r.left) / E.bw * 16, p = L.geo.rango.hi - Math.floor((ev.clientY - r.top) / L.geo.alto);
    let mejor = null; for (const n of L.notas) if (q >= n.q && q <= n.q + n.d && Math.abs(n.p - p) <= 1 && (!mejor || Math.abs(n.p - p) < Math.abs(mejor.p - p))) mejor = n;
    return { L, n: mejor, q };
  }
  inn.addEventListener('pointerdown', ev => {
    const h = notaDe(ev); if (!h) return;
    if (h.n) { E.arrastre = { nota: h.n, L: h.L, y: ev.clientY, d: 0 }; ev.target.setPointerCapture?.(ev.pointerId); ev.preventDefault(); }
    else cb.alElegirSeccion?.(h.L.s.nombre);
  });
  inn.addEventListener('pointermove', ev => {
    const a = E.arrastre;
    if (!a) { const h = notaDe(ev); if (h) ev.target.style.cursor = h.n ? 'ns-resize' : ''; return; }
    const d = Math.round(-(ev.clientY - a.y) / (a.L.geo?.alto || 8)); if (d !== a.d) { a.d = d; dibujarPistas(); }
  });
  inn.addEventListener('pointerup', () => { const a = E.arrastre; E.arrastre = null; if (!a) return; if (a.d) cb.alMoverNota?.(a.nota, a.d); else cb.alElegirNota?.(a.nota); dibujarPistas(); });

  function moverCabezal() {
    const D = E.D; if (!D) return;
    const x = HEAD() + X(qDe(E.t));
    cabezal.style.transform = `translateX(${x}px)`;
    if (E.seguir && E.sonando) { const v0 = mt.scrollLeft, w = mt.clientWidth; if (x < v0 + HEAD() + 20 || x > v0 + w * .8) mt.scrollLeft = x - HEAD() - w * .2; }
  }
  // si cambia el ancho y se ve toda la pieza, se arma de nuevo; si cambia el alto (la sección de abajo, la ventana), se
  // escalan las pistas
  let anchoVisto = 0, cuadro = 0;
  new ResizeObserver(() => {
    if (!E.D) return;
    const w = mt.clientWidth, cambio = w !== anchoVisto; anchoVisto = w;
    if (cambio && !ZOOMS[E.zoom]) { armar(); return; }
    cancelAnimationFrame(cuadro); cuadro = requestAnimationFrame(() => ajustarAlto());
  }).observe(mt);

  return {
    datos(D) { E.D = D; armar(); },
    tiempo(t, sonando) { E.t = t; E.sonando = sonando; moverCabezal(); },
    seccionEn(t) { const D = E.D; if (!D) return null; const q = qDe(t); return D.secciones.find(s => q >= s.q0 && q < s.q1)?.nombre || null; },
    qEn(t) { return E.D ? qDe(t) : 0; },
    // dónde está una nota en la pantalla (para poner el globito al lado)
    rectNota(n) {
      const L = E.lienzos.find(l => l.k === n.cuerda && l.notas.some(x => x.i === n.i)); if (!L || !L.geo) return null;
      const x = L.notas.find(y => y.i === n.i), r = L.cv.getBoundingClientRect(), left = r.left + X(x.q - L.s.q0), top = r.top + (L.geo.rango.hi - x.p) * L.geo.alto;
      const width = Math.max(2, X(x.d)), height = L.geo.alto; return { left, top, width, height, right: left + width, bottom: top + height };
    },
    elegir(i, k) { E.sel = i == null ? null : { i, k }; raiz.querySelectorAll('.mt-verso,.mt-sil').forEach(b => b.classList.toggle('elegido', +b.dataset.i === i && +b.dataset.k === k)); },
    elegirNota(n) { E.selNota = n ? { cuerda: n.cuerda, i: n.i } : null; if (E.D) dibujarPistas(); },
    elegirSeccion(nombre) { E.selSec = nombre; if (E.D) raiz.querySelectorAll('.mt-sec').forEach(b => b.classList.toggle('elegida', E.D.secciones[+b.dataset.i]?.nombre === nombre)); },
    silenciar(mudas, solos = {}) {
      E.mudas = { ...mudas }; E.solos = { ...solos };
      for (const f of inn.querySelectorAll('.mt-pista,.mt-bateria')) {
        const k = f.dataset.k; f.classList.toggle('muda', callada(k));
        f.querySelector('.mt-m')?.setAttribute('aria-pressed', !!E.mudas[k]); f.querySelector('.mt-s')?.setAttribute('aria-pressed', !!E.solos[k]);
      }
      if (E.D) dibujarPistas();
    },
    volumenes(v) { E.vols = { ...v }; for (const f of inn.querySelectorAll('.mt-pista,.mt-bateria')) { const r = f.querySelector('input[type=range]'); if (r && E.vols[f.dataset.k] != null) r.value = E.vols[f.dataset.k]; } },
    irA(t) { const D = E.D; if (!D) return; mt.scrollLeft = Math.max(0, X(qDe(t)) - mt.clientWidth * .2); },
    zoom(z) { E.zoom = Math.max(0, Math.min(ZOOMS.length - 1, z)); if (E.D) { const centro = (mt.scrollLeft + mt.clientWidth / 2 - HEAD()) / E.bw; armar(); mt.scrollLeft = centro * E.bw - mt.clientWidth / 2 + HEAD(); } },
    get nivelZoom() { return E.zoom; },
    seguir(v) { E.seguir = v; },
    redibujar() { if (E.D) armar(); },
  };
}
