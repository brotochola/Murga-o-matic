// vista.js — la partitura (piano roll con las cinco cuerdas y la letra, sincronizada con el audio) y el panel
// que muestra paso a paso cómo se hizo el verso elegido.

export const CUERDAS = [
  { k: 'bajos', nombre: 'Bajos', token: '--bajos' },
  { k: 'segundos', nombre: 'Segundos', token: '--segundos' },
  { k: 'primos', nombre: 'Primos', token: '--primos' },
  { k: 'sobreprimos', nombre: 'Sobreprimos', token: '--sobreprimos' },
  { k: 'tercia', nombre: 'Tercia', token: '--tercia' },
];
const NOMBRE_NOTA = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ───────────────────────── Partitura ─────────────────────────
// alElegirNota(nota): se tocó una nota (sin moverla); alMoverNota(nota, semitonos): se la arrastró para arriba o abajo.
// Cada nota de `datos` trae su cuerda y su lugar en la pieza (i), para poder cambiarla.
export function crearPartitura({ lienzo, mapa, leyenda, alBuscar, alElegir, alElegirNota, alMoverNota }) {
  const E = { datos: null, t: 0, vista0: 0, pps: 70, seguir: true, mudas: {}, sel: null, arrastre: null, selNota: null, geo: null };
  const css = () => getComputedStyle(document.documentElement);
  const color = tok => css().getPropertyValue(tok).trim() || '#888';

  // leyenda: los colores de las cuerdas (las silenciadas en la mezcla se ven apagadas)
  if (leyenda) leyenda.innerHTML = CUERDAS.map(c => `<span><i style="background:var(${c.token})"></i>${c.nombre}</span>`).join('');

  function medidas(cv) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { W: r.width, H: r.height, dpr };
  }

  function dibujar() {
    const D = E.datos; if (!D) return;
    const { W, H, dpr } = medidas(lienzo);
    const g = lienzo.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const C = css(), tinta = C.getPropertyValue('--ink').trim(), tenue = C.getPropertyValue('--muted').trim(), linea = C.getPropertyValue('--line').trim(), acento = C.getPropertyValue('--accent').trim(), suave = C.getPropertyValue('--accent-soft').trim(), papel = C.getPropertyValue('--panel').trim();
    const fLetra = C.getPropertyValue('--body').trim(), fUi = C.getPropertyValue('--body').trim();
    const ARRIBA = 24, LETRA = D.silabas.length ? 46 : 0, IZQ = 34, H_roll = H - ARRIBA - LETRA;
    const span = (W - IZQ) / E.pps, t0 = E.vista0, t1 = t0 + span;
    const X = t => IZQ + (t - t0) * E.pps;
    const pMin = D.pMin - 1, pMax = D.pMax + 1, alto = H_roll / (pMax - pMin + 1);
    const Y = p => ARRIBA + (pMax - p) * alto;
    E.geo = { IZQ, ARRIBA, alto, pMax, t0, H_roll };
    // fondo de las octavas (Do) y compases
    g.font = `10px ${fUi}`; g.fillStyle = tenue; g.strokeStyle = linea; g.lineWidth = 1;
    for (let p = Math.ceil(pMin); p <= pMax; p++) if (p % 12 === 0) { g.globalAlpha = .6; g.beginPath(); g.moveTo(IZQ, Y(p) + alto); g.lineTo(W, Y(p) + alto); g.stroke(); g.globalAlpha = 1; g.fillText(`${NOMBRE_NOTA[0]}${Math.floor(p / 12) - 1}`, 2, Y(p) + alto); }
    g.globalAlpha = .35;
    for (const tc of D.compases) if (tc >= t0 - .1 && tc <= t1) { g.beginPath(); g.moveTo(X(tc), ARRIBA); g.lineTo(X(tc), H - LETRA); g.stroke(); }
    g.globalAlpha = 1;
    // secciones
    for (const s of D.secciones) {
      if (s.t1 < t0 || s.t0 > t1) continue;
      const x0 = Math.max(IZQ, X(s.t0)), x1 = Math.min(W, X(s.t1));
      g.fillStyle = s.bateria || s.llamada ? suave : 'transparent'; g.fillRect(x0, 0, x1 - x0, ARRIBA - 4);
      g.strokeStyle = tenue; g.beginPath(); g.moveTo(X(s.t0), 0); g.lineTo(X(s.t0), H - LETRA); g.stroke();
      g.fillStyle = tinta; g.font = `600 11px ${fUi}`;
      const etiqueta = s.nombre + (s.llamada ? ' · batería' : s.bateria ? '' : ' · a capela');
      g.save(); g.beginPath(); g.rect(x0, 0, x1 - x0, ARRIBA); g.clip(); g.fillText(etiqueta, x0 + 5, 15); g.restore();
    }
    // notas
    const ahora = E.t;
    for (const c of CUERDAS) {
      const muda = !!E.mudas[c.k];
      const col = color(c.token);
      for (const n of D.notas) {
        if (n.cuerda !== c.k || n.t1 < t0 || n.t0 > t1) continue;
        const arr = E.arrastre?.nota === n ? E.arrastre.d || 0 : 0;
        const x = X(n.t0), w = Math.max(2, (n.t1 - n.t0) * E.pps - 1.5), y = Y(n.p + arr) + 1, h = Math.max(3, alto - 2);
        const suena = ahora >= n.t0 && ahora < n.t1, elegida = E.selNota && E.selNota.cuerda === n.cuerda && E.selNota.i === n.i;
        g.globalAlpha = muda ? .16 : suena || elegida ? 1 : .8; g.fillStyle = col;
        g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, Math.min(3, h / 2)) : g.rect(x, y, w, h); g.fill();
        if (elegida) { g.globalAlpha = 1; g.strokeStyle = acento; g.lineWidth = 3; g.stroke(); g.strokeStyle = tinta; g.lineWidth = 1; g.stroke(); }
        else if (suena && !muda) { g.globalAlpha = 1; g.strokeStyle = tinta; g.lineWidth = 1.5; g.stroke(); }
      }
    }
    g.globalAlpha = 1;
    // la letra, abajo, cada sílaba donde cae
    if (LETRA) { g.fillStyle = papel; g.fillRect(0, H - LETRA, W, LETRA); }
    g.strokeStyle = linea; g.beginPath(); g.moveTo(0, H - LETRA + .5); g.lineTo(W, H - LETRA + .5); g.stroke();
    g.textBaseline = 'middle';
    let ultimoX = -1e9;
    for (const s of D.silabas) {
      if (s.t1 < t0 - 1 || s.t0 > t1) continue;
      const x = X(s.t0), suena = ahora >= s.t0 && ahora < s.t1, elegida = E.sel && s.i === E.sel.i && s.k === E.sel.k;
      g.font = `${s.acento ? '700 ' : ''}15px ${fLetra}`;
      const w = g.measureText(s.texto).width;
      const fila = x < ultimoX + 3 ? 1 : 0;              // si se pisa con la anterior, baja una fila
      const y = H - LETRA + 15 + fila * 18;
      if (suena) { g.fillStyle = acento; g.globalAlpha = .35; g.fillRect(x - 3, y - 10, w + 6, 20); g.globalAlpha = 1; }
      g.fillStyle = suena || elegida ? tinta : tenue;
      g.fillText(s.texto, x, y);
      if (elegida) { g.fillRect(x, y + 9, w, 1.5); }
      if (s.melisma) { g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(x + w + 2, y + 4); g.lineTo(Math.max(x + w + 4, X(s.t1) - 2), y + 4); g.stroke(); }
      if (fila === 0) ultimoX = x + w;
      // una línea tenue de la sílaba a su nota de arriba
      if (s.p != null && (suena || elegida)) { g.strokeStyle = suena ? acento : tenue; g.globalAlpha = .5; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(x + 1, H - LETRA); g.lineTo(x + 1, Y(s.p) + alto); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
    }
    g.textBaseline = 'alphabetic';
    // cursor
    if (ahora >= t0 && ahora <= t1) { g.strokeStyle = acento; g.lineWidth = 2; g.beginPath(); g.moveTo(X(ahora), 0); g.lineTo(X(ahora), H); g.stroke(); }
    dibujarMapa();
  }

  function dibujarMapa() {
    const D = E.datos; if (!D || !mapa) return;
    const { W, H, dpr } = medidas(mapa);
    const g = mapa.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const C = css(), linea = C.getPropertyValue('--line').trim(), acento = C.getPropertyValue('--accent').trim(), tinta = C.getPropertyValue('--ink').trim();
    const k = W / D.total, pr = D.pMax - D.pMin + 1;
    for (const s of D.secciones) { g.fillStyle = linea; g.globalAlpha = s.bateria ? .55 : .2; g.fillRect(s.t0 * k, 0, (s.t1 - s.t0) * k, H); }
    g.globalAlpha = .75;
    for (const c of CUERDAS) { if (E.mudas[c.k]) continue; g.fillStyle = color(c.token); for (const n of D.notas) if (n.cuerda === c.k) g.fillRect(n.t0 * k, H - 2 - (n.p - D.pMin) / pr * (H - 4), Math.max(1, (n.t1 - n.t0) * k), 1.5); }
    g.globalAlpha = 1;
    const span = (lienzo.getBoundingClientRect().width - 34) / E.pps;
    g.strokeStyle = tinta; g.lineWidth = 1.5; g.strokeRect(E.vista0 * k + .75, .75, Math.max(4, span * k) - 1.5, H - 1.5);
    g.fillStyle = acento; g.fillRect(E.t * k - 1, 0, 2, H);
  }

  function limitar() { const span = (lienzo.getBoundingClientRect().width - 34) / E.pps; E.vista0 = Math.max(0, Math.min(E.vista0, (E.datos?.total || 0) - span * .6)); }

  // la nota que está debajo del puntero (la de arriba de todo si hay varias: la última que se dibujó)
  function notaEn(ev) {
    const G = E.geo, D = E.datos; if (!G || !D || !alElegirNota) return null;
    const r = lienzo.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    if (x < G.IZQ || y < G.ARRIBA || y > G.ARRIBA + G.H_roll) return null;
    const t = G.t0 + (x - G.IZQ) / E.pps, p = G.pMax - Math.floor((y - G.ARRIBA) / G.alto);
    let mejor = null;
    for (const c of CUERDAS) { if (E.mudas[c.k]) continue; for (const n of D.notas) if (n.cuerda === c.k && n.p === p && t >= n.t0 && t <= n.t1) mejor = n; }
    return mejor;
  }
  // tocar o arrastrar la partitura; tocar una nota la elige, y arrastrarla para arriba o abajo le cambia la altura
  lienzo.addEventListener('pointerdown', ev => { const nota = notaEn(ev); E.arrastre = { x: ev.clientX, y: ev.clientY, v0: E.vista0, movio: false, nota, d: 0 }; lienzo.setPointerCapture(ev.pointerId); });
  lienzo.addEventListener('pointermove', ev => {
    const a = E.arrastre;
    if (!a) { lienzo.style.cursor = notaEn(ev) ? 'ns-resize' : ''; return; }
    if (a.nota) { const d = Math.round(-(ev.clientY - a.y) / (E.geo?.alto || 10)); if (d !== a.d) { a.d = d; a.movio = d !== 0 || a.movio; dibujar(); } return; }
    const dx = ev.clientX - a.x;
    if (Math.abs(dx) > 4) { a.movio = true; E.vista0 = a.v0 - dx / E.pps; E.seguirPausa = performance.now(); limitar(); dibujar(); }
  });
  lienzo.addEventListener('pointerup', ev => {
    const a = E.arrastre; E.arrastre = null; if (!a || !E.datos) return;
    if (a.nota) { if (a.d) alMoverNota?.(a.nota, a.d); else alElegirNota?.(a.nota); dibujar(); return; }
    if (a.movio) return;
    const r = lienzo.getBoundingClientRect(), t = E.vista0 + (ev.clientX - r.left - 34) / E.pps;
    // la sílaba más cercana a donde se tocó elige el verso
    let mejor = null, d = 1e9; for (const s of E.datos.silabas) { const e = Math.abs(s.t0 - t); if (e < d) { d = e; mejor = s; } }
    if (mejor && d < 1.5) alElegir?.(mejor.i, mejor.k);
    alBuscar?.(Math.max(0, t));
  });
  if (mapa) {
    const mover = ev => { const r = mapa.getBoundingClientRect(), span = (lienzo.getBoundingClientRect().width - 34) / E.pps; E.vista0 = (ev.clientX - r.left) / r.width * (E.datos?.total || 0) - span / 2; E.seguirPausa = performance.now(); limitar(); dibujar(); };
    mapa.addEventListener('pointerdown', ev => { mapa.setPointerCapture(ev.pointerId); mover(ev); mapa._arr = true; });
    mapa.addEventListener('pointermove', ev => { if (mapa._arr) mover(ev); });
    mapa.addEventListener('pointerup', () => { mapa._arr = false; });
  }
  new ResizeObserver(() => dibujar()).observe(lienzo);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => dibujar());

  return {
    datos(D) {
      let pMin = 99, pMax = 0; for (const n of D.notas) { pMin = Math.min(pMin, n.p); pMax = Math.max(pMax, n.p); }
      E.datos = { ...D, pMin, pMax }; limitar(); dibujar();
    },
    tiempo(t, sonando) {
      E.t = t;
      const span = (lienzo.getBoundingClientRect().width - 34) / E.pps;
      const pausado = E.seguirPausa && performance.now() - E.seguirPausa < 2500;
      if (E.seguir && sonando && !pausado && (t < E.vista0 + span * .1 || t > E.vista0 + span * .7)) { E.vista0 = t - span * .25; limitar(); }
      dibujar();
    },
    elegir(i, k) { E.sel = i == null ? null : { i, k }; dibujar(); },
    elegirNota(n) { E.selNota = n ? { cuerda: n.cuerda, i: n.i } : null; dibujar(); },
    silenciar(m) { E.mudas = { ...m }; dibujar(); },
    irA(t) { const span = (lienzo.getBoundingClientRect().width - 34) / E.pps; E.vista0 = t - span * .15; limitar(); dibujar(); },
    zoom(f) { const span = (lienzo.getBoundingClientRect().width - 34) / E.pps, centro = E.vista0 + span / 2; E.pps = Math.max(25, Math.min(400, E.pps * f)); const s2 = (lienzo.getBoundingClientRect().width - 34) / E.pps; E.vista0 = centro - s2 / 2; limitar(); dibujar(); },
    seguir(v) { E.seguir = v; },
  };
}

// ───────────────────────── El proceso, verso a verso ─────────────────────────
const SIMBOLO = { Z: 'll/y (sh)', C: 'ch', R: 'rr', N: 'ñ', B: 'b suave', D: 'd suave', G: 'g suave', j: 'i deslizada', w: 'u deslizada', x: 'j', h: 's aspirada' };
const fon = arr => arr.length ? arr.map(p => SIMBOLO[p] ? `<abbr title="${SIMBOLO[p]}">${p}</abbr>` : p).join(' ') : '<span class="nada">—</span>';
const NOMBRE_PUNTO = { rima: 'rima', acentos: 'acentos en tiempos fuertes', tema: 'tema', repeticion: 'palabras repetidas', relleno: 'relleno («hoy», «y», «otra vez»)', coherencia: 'partes que no combinan', inicio: 'empieza igual que el anterior' };

// mini partitura del verso: cajas por nota (ancho = duración), altura por nota, puntos en los lugares fuertes
function cajitas(det, conSilabas) {
  if (!det) return '';
  const gs = det.golpes, q0 = gs[0].q, qf = Math.max(...gs.map(g => g.q + g.d)), ps = gs.map(g => g.p), pMin = Math.min(...ps), pMax = Math.max(...ps);
  const W = Math.max(260, (qf - q0) * 14), H = 64, X = q => 4 + (q - q0) / (qf - q0) * (W - 8), Y = p => 8 + (pMax - p) / Math.max(1, pMax - pMin) * 26;
  const fuertes = new Set(det.acentos);
  let svg = `<svg class="cajitas" viewBox="0 0 ${W} ${conSilabas ? H + 36 : H}" width="${W}" height="${conSilabas ? H + 36 : H}" role="img" aria-label="Las notas del verso">`;
  gs.forEach((g, i) => {
    const x = X(g.q), w = Math.max(3, X(g.q + g.d) - x - 2), y = Y(g.p);
    svg += `<rect x="${x}" y="${y}" width="${w}" height="9" rx="2" class="nota-caja"/>`;
    if (fuertes.has(i + 1)) svg += `<circle cx="${x + 3}" cy="${H - 14}" r="3.5" class="fuerte"/>`;
    svg += `<text x="${x + 1}" y="${H - 2}" class="num">${i + 1}</text>`;
  });
  if (conSilabas) {
    let finAnterior = -1e9, fila = 0;
    for (const r of det.reparto) {
      const a = r.notas[0], b = r.notas[r.notas.length - 1], x = X(a.q), x2 = X(b.q + b.d);
      // si la sílaba se pisa con la anterior, va una fila más abajo
      fila = x < finAnterior + 2 && fila === 0 ? 1 : 0;
      const y = H + 14 + fila * 15, ancho = r.texto.length * 7;
      if (fila === 0) finAnterior = x + ancho;
      svg += `<text x="${x + 1}" y="${y}" class="sil${r.acento ? ' acentuada' : ''}">${esc(r.texto)}</text>`;
      if (r.notas.length > 1) svg += `<line x1="${x + 1}" y1="${y + 4}" x2="${x2 - 3}" y2="${y + 4}" class="melisma"/>`;
      if (a.parte) svg += `<line x1="${x - 1}" y1="${Y(a.p) - 2}" x2="${x - 1}" y2="${Y(a.p) + 11}" class="corte"/>`;
    }
  }
  return `<div class="cajitas-marco">${svg}</svg></div>`;
}

export function mostrarProceso(el, info) {
  if (!info) { el.innerHTML = ''; return; }
  const { P, partes, i, k, texto, diag, det, temas, editado, forma } = info;
  const p = partes[i], v = p.versos[k];
  const secs = P.secs.filter(s => s.tipo !== 'cierre');
  const n = v.silabas;
  const linea = (t, d) => `<li class="paso"><h4>${t}</h4>${d}</li>`;

  // 1. la música
  const paso1 = `<p>El Murga-o-matic armó una ${forma === 'retirada' ? 'retirada' : 'presentación'} de ${secs.length} secciones. Cada una encadena gestos de dos compases (melodía, voces y acordes juntos) tomados de 41 tramos reales transcriptos.</p>
    <div class="secciones">${secs.map(s => `<span class="sec${p.secciones.includes(s.nombre) ? ' esta' : ''}">${esc(s.nombre)}<small>${s.compases || ''} comp · ${s.tempo} BPM · ${s.tipo === 'llamada' ? 'llamada de batería' : s.bateria ? 'batería' : 'a capela'}</small></span>`).join('')}</div>`;
  // 2. lo que pide la melodía
  const finTxt = v.tipo === 'aguda' ? 'aguda: el verso tiene que terminar en una palabra con acento al final (can-<b>CIÓN</b>, <b>VOZ</b>), porque la última nota es la fuerte' : v.tipo === 'llana' ? 'llana: la última nota es débil y el acento va en la anterior (<b>BA</b>-rrio)' : 'esdrújula';
  const paso2 = `<p>El verso ${k + 1} de <b>${esc(p.nombre)}</b> tiene <b>${n} nota${n === 1 ? '' : 's'}</b> seguidas, sin respirar: pide <b>${n} sílaba${n === 1 ? '' : 's'} cantada${n === 1 ? '' : 's'}</b>. Termina ${finTxt}.</p>
    ${cajitas(det, false)}
    <p class="nota">Cada caja es una nota (el ancho es lo que dura). Los puntos marcan los lugares fuertes del compás o las notas largas: ahí conviene que caigan las sílabas acentuadas (${(v.acentos || []).join(', ')}).</p>`;
  // 3. cómo se eligió la letra
  let paso3;
  if (editado) paso3 = `<p>Este verso lo escribiste vos. El silabeo lo cuenta igual: <b>${info.n} sílabas</b> cantadas.</p>`;
  else if (!diag) paso3 = `<p>Sin datos de cómo se escribió este verso.</p>`;
  else if (diag.tipo === 'gancho') paso3 = `<p>Es el último verso ${diag.funcion === 'bajada' ? 'de la bajada' : 'del estribillo'} y tiene la misma métrica que el primero, así que lo repite: es el gancho que la gente se lleva.</p>`;
  else if (diag.tipo === 'corto') paso3 = `<p>Con ${n === 1 ? 'una sola nota' : n + ' notas'} no entra una frase: se usa una interjección o un fragmento corto que tenga ${n} sílaba${n === 1 ? '' : 's'}${n > 1 ? ' y termine ' + v.tipo : ''}. Opciones: ${diag.opciones.map(o => `«${esc(o)}»`).join(', ')}.</p>`;
  else {
    const d = diag.desglose || {};
    const puntos = Object.entries(d).filter(([, x]) => Math.abs(x) > .005).map(([kk, x]) => `<span class="punto-p ${x >= 0 ? 'mas' : 'menos'}">${NOMBRE_PUNTO[kk] || kk} ${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}</span>`).join('');
    const temasTxt = temas ? `Temas que pesan: ${temas.pedidos.length ? `<b>${temas.pedidos.join(', ')}</b> (del tema que escribiste) y ` : ''}${temas.base.join(', ')} (de la ${forma === 'retirada' ? 'retirada' : 'presentación'}).` : '';
    paso3 = `<p>El letrista no usa ningún modelo de lenguaje: arma versos con frases de murga de un léxico propio, siguiendo plantillas para esta parte (${diag.funcion}). ${temasTxt}</p>
      <div class="cifras"><span><b>${diag.probados}</b> versos armados</span><span><b>${diag.exactos}</b> con ${n} sílabas y final ${v.tipo}</span>${diag.rima ? `<span><b>${diag.conRima}</b> además riman en «${diag.rima}»</span>` : ''}</div>
      <p>Se quedó con el de mejor puntaje, armado como <i>${esc(diag.plantilla)}</i>:</p>
      <p class="elegido">«${esc(texto)}» <span class="total">${diag.puntaje != null ? diag.puntaje.toFixed(1) : ''}</span></p>
      <div class="puntos">${puntos}</div>
      ${diag.rima ? '' : (k % 2 === 1 ? '<p class="nota">Es el primer verso par de la estrofa con este final: fija la rima y prefiere terminaciones con muchas rimas posibles.</p>' : '<p class="nota">Los versos impares no necesitan rimar.</p>')}
      ${diag.otros?.length ? `<p class="sub">Otros finalistas</p><ul class="lista">${diag.otros.map(o => `<li>«${esc(o.texto)}» <span class="total">${o.p.toFixed(1)}</span></li>`).join('')}</ul>` : ''}
      ${diag.descartes?.length ? `<p class="sub">Algunos descartados</p><ul class="lista descartes">${diag.descartes.map(o => `<li>«${esc(o.texto)}» <span>${esc(o.motivo)}</span></li>`).join('')}</ul>` : ''}`;
  }
  // 4. sílaba por nota
  let paso4 = '<p>Sin letra en este verso: el coro canta «la».</p>';
  if (det && det.reparto.length) {
    const mel = det.reparto.filter(r => r.notas.length > 1).length, cortes = det.reparto.filter(r => r.notas[0].parte).length / 2, sinal = det.reparto.filter(r => r.texto.includes('‿')).length;
    const partesTxt = [mel ? `${mel} sílaba${mel > 1 ? 's' : ''} estirada${mel > 1 ? 's' : ''} en dos notas (melisma)` : '', cortes ? `${Math.round(cortes)} nota${cortes > 1 ? 's' : ''} partida${cortes > 1 ? 's' : ''} para meter dos sílabas` : ''].filter(Boolean).join(' y ');
    paso4 = `<p>${partesTxt ? `Las sílabas no coincidían con las notas: ${partesTxt}.` : 'Una sílaba por nota.'} ${sinal ? `El signo ‿ es una sinalefa: la vocal final de una palabra y la inicial de la siguiente se cantan en una sola nota (${sinal} en este verso).` : ''} Las sílabas en negrita llevan el acento.</p>
      ${cajitas(det, true)}`;
  }
  // 5. cómo se canta
  let paso5 = '';
  if (det && det.reparto.length) {
    paso5 = `<div class="tabla-marco"><table class="fonemas"><thead><tr><th>Sílaba</th><th>Antes del golpe</th><th>En el golpe</th><th>Al final</th></tr></thead><tbody>
      ${det.reparto.map(r => `<tr><td class="${r.acento ? 'acentuada' : ''}">${esc(r.texto)}</td><td>${fon(r.fon.ataque)}</td><td>${fon(r.fon.nucleo)}</td><td>${fon(r.fon.coda)}${r.fon.coda.includes('s') ? ' <small>(casi muda)</small>' : ''}</td></tr>`).join('')}
      </tbody></table></div>
      <ul class="lista">
        <li>La consonante se canta un poco antes del tiempo y la vocal cae justo en el golpe, como hacen los coros.</li>
        <li>Cada voz es un modelo de fuente y filtro: un pulso de la glotis pasa por los formantes de la vocal que toca, con consonantes de ruido, cierres y nasales. No hay grabaciones de voces.</li>
        <li>Cantan 13 voces: 2 bajos, 3 segundos, 4 primos, 3 sobreprimos y la tercia, cada una con su largo de garganta, vibrato, desafinación y retraso.</li>
        <li>El color se ajustó midiendo contra La Trasnochada 2020: el espectro quedó a menos de 3 dB, y la s final casi no suena, como en la grabación real.</li>
      </ul>`;
  }
  el.innerHTML = `<header class="proceso-cabeza"><div><p class="sub">Verso ${k + 1} de ${esc(p.nombre)}</p><p class="verso-grande">«${esc(texto || '…')}»</p></div>
      <div class="nav"><button type="button" data-ir="-1" aria-label="Verso anterior">←</button><button type="button" data-ir="1" aria-label="Verso siguiente">→</button></div></header>
    <ol class="pasos">
      ${linea('La música', paso1)}
      ${linea('Lo que pide la melodía', paso2)}
      ${linea('Cómo se eligió la letra', paso3)}
      ${linea('Sílaba por nota', paso4)}
      ${paso5 ? linea('Cómo se canta', paso5) : ''}
    </ol>`;
}
