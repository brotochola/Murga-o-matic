// papeles.js — lo que se baja en papel: la partitura coral (ABC dibujado con abcjs, y en PDF con jsPDF + svg2pdf.js),
// la letra con los acordes arriba (o el cifrado por compases) y los nombres de los acordes en cifrado americano.
import { acorde } from './compositor.js';

const mod = (a, n) => ((a % n) + n) % n;
const LETRAS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'], PC_LETRA = [0, 2, 4, 5, 7, 9, 11];
const TONICA_MAYOR = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const TONICA_MENOR = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
const NOTAS_ES = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
const INTERVALO = { mayor: [0, 2, 4, 5, 7, 9, 11], menor: [0, 2, 3, 5, 7, 8, 10] };
// las notas fuera de la escala: qué grado se altera (en menor, la sensible y la sexta suben; en mayor, b3 b6 b7)
const CROMA = { mayor: { 1: 1, 3: 2, 6: 3, 8: 5, 10: 6 }, menor: { 1: 1, 4: 2, 6: 3, 9: 5, 11: 6 } };
const ROMANOS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'];
const alter = x => { const a = mod(x + 6, 12) - 6; return a; };
const nombreTonica = (t, modo) => (modo === 'mayor' ? TONICA_MAYOR : TONICA_MENOR)[t];
const letraDe = nombre => LETRAS.indexOf(nombre[0]);
const conAlter = (letra, a) => LETRAS[letra] + (a > 0 ? '#'.repeat(a) : 'b'.repeat(-a));

function deletreo(pc, tonica, modo) {
  const L0 = letraDe(nombreTonica(tonica, modo)), i = mod(pc - tonica, 12);
  let d = INTERVALO[modo].indexOf(i);
  if (d < 0) d = CROMA[modo][i];
  const letra = (L0 + d) % 7;
  return { letra, acc: alter(pc - PC_LETRA[letra]) };
}
function armadura(tonica, modo) {
  const L0 = letraDe(nombreTonica(tonica, modo)), a = new Array(7).fill(0);
  INTERVALO[modo].forEach((iv, d) => { const letra = (L0 + d) % 7; a[letra] = alter(tonica + iv - PC_LETRA[letra]); });
  return a;
}

// "V7" en La menor → "E7"; la letra de la raíz sale del grado, así un bII en La es Bb y no A#
export function nombreAcorde(g, tonica, modo) {
  const a = acorde(g), m = /^(b|#)?([ivIV]+)/.exec(g);
  const grado = ROMANOS.indexOf(m[2].toLowerCase());
  const letra = (letraDe(nombreTonica(tonica, modo)) + grado) % 7;
  const raiz = conAlter(letra, alter(mod(tonica + a.raiz, 12) - PC_LETRA[letra]));
  return raiz + (/o$/.test(g) ? 'dim' : /7$/.test(g) ? '7' : m[2] === m[2].toLowerCase() ? 'm' : '');
}
const cambiosDeAcorde = s => (s.acordes || []).map((g, c, l) => (c && l[c - 1] === g) ? null : { q: s.inicio + (s.pasoAcorde ? s.pasoAcorde[c] : c * 8), g, nombre: nombreAcorde(g, s.tonica, s.modo) }).filter(Boolean);

// ───────────────────────── scripts de vendor/, a pedido ─────────────────────────
const scripts = new Map();
export function cargarScript(url) {
  if (!scripts.has(url)) scripts.set(url, new Promise((ok, mal) => {
    const s = document.createElement('script'); s.src = url; s.async = true;
    s.onload = ok; s.onerror = () => { scripts.delete(url); s.remove(); mal(new Error('no se pudo cargar ' + url.split('/').pop())); };
    document.head.appendChild(s);
  }));
  return scripts.get(url);
}
const vendor = f => new URL('./vendor/' + f, import.meta.url).href;
const cargarAbc = () => window.ABCJS ? Promise.resolve() : cargarScript(vendor('abcjs-basic-min.js'));
async function cargarPdf() {
  if (!window.jspdf) await cargarScript(vendor('jspdf.umd.min.js'));
  if (!window.svg2pdf) await cargarScript(vendor('svg2pdf.umd.min.js'));
}

// ───────────────────────── la partitura en ABC ─────────────────────────
// Cinco pentagramas, de la tercia a los bajos (las cuerdas agudas en clave de sol octavada, como los tenores).
// Semicorcheas como unidad; cada nota se parte en figuras que respetan los tiempos y se liga. La letra va
// debajo de cada pentagrama, sílaba por nota; los acordes arriba de la tercia; el nombre de la sección, el
// tempo y la tonalidad cambian donde cambian. Los calderones de la pieza son calderones.
const VOCES = [
  { k: 'tercia', id: 'T', nombre: 'Tercia', corto: 'T.', clave: 'treble-8', escrito: 12 },
  { k: 'sobreprimos', id: 'S', nombre: 'Sobreprimos', corto: 'Sp.', clave: 'treble-8', escrito: 12 },
  { k: 'primos', id: 'P', nombre: 'Primos', corto: 'P.', clave: 'treble-8', escrito: 12 },
  { k: 'segundos', id: 'G', nombre: 'Segundos', corto: 'Sg.', clave: 'bass', escrito: 0 },
  { k: 'bajos', id: 'B', nombre: 'Bajos', corto: 'B.', clave: 'bass', escrito: 0 },
];
// figura más larga que entra en esta posición del compás sin cruzar el tiempo
function figura(pos, resto) {
  for (const c of [16, 12, 8, 6, 4, 3, 2, 1]) {
    if (c > resto || pos + c > 16) continue;
    if (c === 16 && pos) continue;
    if (c === 12 && pos % 4) continue;
    if (c === 8 && pos % 8) continue;
    if ((c === 6 || c === 4) && pos % 4) continue;
    if (c === 3 && pos % 4 > 1) continue;
    if (c === 2 && pos % 2) continue;
    return c;
  }
  return 1;
}
const textoAbc = (t, mayus) => { let x = t.replace(/‿/g, '~').replace(/\s+/g, '~').replace(/[-_*|\\%]/g, ''); if (mayus) x = x.charAt(0).toUpperCase() + x.slice(1); return x; };

export function abcDe({ pieza, titulo, subtitulo, silabas }) {
  const secs = pieza.secs.filter(s => s.largo > 0);
  const lineas = [
    'X:1', `T:${titulo}`, `T:${subtitulo}`, 'L:1/16', 'M:4/4',
    `Q:1/4=${secs[0]?.tempo || 100}`,
    '%%titlefont Helvetica 18', '%%subtitlefont Helvetica 11', '%%vocalfont Helvetica 10', '%%gchordfont Helvetica 10',
    '%%annotationfont Helvetica 10', '%%voicefont Helvetica 11', '%%tempofont Helvetica 10', '%%measurenb 0',
    `%%score [ ${VOCES.map(v => v.id).join(' ')} ]`,
    `K:${nombreTonica(secs[0].tonica, secs[0].modo)}${secs[0].modo === 'menor' ? 'm' : ''}`,
  ];
  for (const v of VOCES) lineas.push(`V:${v.id} clef=${v.clave} name="${v.nombre}" snm="${v.corto}"`);
  let tonoAnt = `${secs[0].tonica}${secs[0].modo}`, tempoAnt = secs[0].tempo;
  secs.forEach((s, si) => {
    const fin = s.inicio + s.largo, arm = armadura(s.tonica, s.modo);
    const cambios = cambiosDeAcorde(s);
    const tono = `${s.tonica}${s.modo}`, K = `${nombreTonica(s.tonica, s.modo)}${s.modo === 'menor' ? 'm' : ''}`;
    const cambiaTono = tono !== tonoAnt, cambiaTempo = s.tempo !== tempoAnt;
    tonoAnt = tono; tempoAnt = s.tempo;
    // calderones: la primera nota que empieza dentro de un tramo estirado
    const estirados = (s.estirar || []).map(([a, b]) => [s.inicio + a, s.inicio + b]);
    for (const [vi, v] of VOCES.entries()) {
      const evs = (pieza.ev[v.k] || []).filter(e => e[0] >= s.inicio && e[0] < fin).sort((a, b) => a[0] - b[0] || b[2] - a[2]);
      // acordes por ataque: todas las notas que empiezan juntas; la duración llega hasta el ataque que sigue
      const grupos = [];
      for (const e of evs) { const g = grupos[grupos.length - 1]; if (g && g.q === e[0]) { g.ps.push(e[2]); g.d = Math.min(g.d, e[1]); } else grupos.push({ q: e[0], d: e[1], ps: [e[2]] }); }
      grupos.forEach((g, i) => { const sig = grupos[i + 1]?.q ?? fin; g.d = Math.max(1, Math.min(g.d, sig - g.q, fin - g.q)); g.ps = [...new Set(g.ps)].sort((a, b) => a - b); });
      // nota partida para meter dos sílabas (como canta el coro)
      const partidos = [];
      for (const g of grupos) {
        const x = silabas?.get(g.q);
        if (x && x.parte && x.d < g.d && silabas.get(g.q + x.d)) { partidos.push({ ...g, d: x.d }, { q: g.q + x.d, d: g.d - x.d, ps: g.ps }); }
        else partidos.push(g);
      }
      // cortes: compases, y en la tercia también donde cambia el acorde (para escribirlo arriba)
      const cortes = new Set();
      for (let q = s.inicio; q < fin; q += 16) cortes.add(q);
      if (vi === 0) for (const c of cambios) cortes.add(c.q);
      const proximoCorte = x => { let m = fin; for (const c of cortes) if (c > x && c < m) m = c; return m; };
      const inicioCompas = x => s.inicio + Math.floor((x - s.inicio) / 16) * 16;
      let musica = '', letra = [], hayLetra = false, estado = new Map(), compasActual = s.inicio, ponerFermata = new Set();
      for (const [a, b] of estirados) { const g = partidos.find(g => g.q >= a && g.q < b); if (g) ponerFermata.add(g.q); }
      const anotar = q => {
        let t = '';
        if (vi === 0 && q === s.inicio) t += `"^${s.nombre.replace(/"/g, '')}"`;
        if (vi === 0) { const c = cambios.find(c => c.q === q); if (c) t += `"${c.nombre}"`; }
        return t;
      };
      const barra = x => { if (x > s.inicio && x < fin && (x - s.inicio) % 16 === 0) { musica += ' | '; estado = new Map(); compasActual = x; } };
      const tramo = (a, b, alPedazo) => {
        let x = a;
        while (x < b) {
          barra(x);
          const tope = Math.min(b, proximoCorte(x)), pos = x - inicioCompas(x);
          const len = figura(pos, tope - x);
          alPedazo(x, len, x === a, x + len >= b);
          x += len;
        }
      };
      const nota = (m, primeraDelCompas) => {
        const w = m + v.escrito, sp = deletreo(mod(m, 12), s.tonica, s.modo);
        const nat = w - sp.acc, oct = Math.floor(nat / 12) - 1;
        let n = LETRAS[sp.letra];
        n = oct >= 5 ? n.toLowerCase() + "'".repeat(oct - 5) : n + ','.repeat(Math.max(0, 4 - oct));
        const clave = sp.letra + ':' + oct, actual = estado.has(clave) ? estado.get(clave) : arm[sp.letra];
        let pre = '';
        if (primeraDelCompas === 'ligada') return n;     // la ligada que sigue en otro compás no repite la alteración
        if (sp.acc !== actual) { pre = sp.acc === 0 ? '=' : sp.acc > 0 ? '^'.repeat(sp.acc) : '_'.repeat(-sp.acc); estado.set(clave, sp.acc); }
        return pre + n;
      };
      let x = s.inicio;
      const silencio = (a, b) => tramo(a, b, (q, len) => { musica += anotar(q) + 'z' + (len > 1 ? len : '') + ' '; });
      for (const g of partidos) {
        if (g.q > x) silencio(x, g.q);
        tramo(g.q, g.q + g.d, (q, len, primero, ultimo) => {
          const ligadaDeOtroCompas = !primero && q === inicioCompas(q);
          const ns = g.ps.map(m => nota(m, ligadaDeOtroCompas ? 'ligada' : null));
          const cuerpo = (ns.length > 1 ? `[${ns.join('')}]` : ns[0]) + (len > 1 ? len : '');
          musica += anotar(q) + (primero && ponerFermata.has(g.q) ? 'H' : '') + cuerpo + (ultimo ? ' ' : '- ');
          // la letra: la sílaba en el primer pedazo; los pedazos ligados no llevan
          if (!primero) { letra.push('*'); return; }
          const sl = silabas?.get(q);
          if (!sl) { letra.push('*'); return; }
          hayLetra = true;
          letra.push(sl.primera ? textoAbc(sl.texto, sl.inicioVerso) + (sl.fin ? '' : '-') : '_');
        });
        x = g.q + g.d;
      }
      if (x < fin) silencio(x, fin);
      let cabeza = `[V:${v.id}] `;
      if (si > 0 && cambiaTono) cabeza += `[K:${K} clef=${v.clave}] `;
      if (si > 0 && cambiaTempo && vi === 0) cabeza += `[Q:1/4=${s.tempo}] `;
      lineas.push(cabeza + musica.trim() + (si === secs.length - 1 ? ' |]' : ' ||'));
      if (hayLetra) lineas.push('w: ' + letra.join(' '));
    }
  });
  return lineas.join('\n') + '\n';
}

// ───────────────────────── dibujarla ─────────────────────────
const OPCIONES = ancho => ({ staffwidth: ancho, wrap: { minSpacing: 1.6, maxSpacing: 2.6, preferredMeasuresPerLine: 4 }, paddingtop: 10, paddingbottom: 10, paddingleft: 10, paddingright: 10, add_classes: true });
export async function mostrarPartitura(el, datos) {
  await cargarAbc();
  const ancho = Math.max(520, Math.min(980, el.clientWidth - 30));
  el.innerHTML = '';
  const r = window.ABCJS.renderAbc(el, abcDe(datos), OPCIONES(ancho));
  return r[0]?.warnings || [];
}

// svg2pdf no entiende las transformaciones en CSS (abcjs achica así el 8 de la clave y la negra del tempo) ni los
// signos ♯ ♭ en las fuentes del PDF: se pasan a atributos y a # b; y todo el texto va en Helvetica
function paraPdf(svg) {
  for (const el of svg.querySelectorAll('[style*="transform"]')) {
    const st = el.getAttribute('style') || '';
    const m = /transform:\s*scale\(([-\d.]+)(?:\s*,\s*([-\d.]+))?\)/.exec(st), o = /transform-origin:\s*([-\d.]+)px\s+([-\d.]+)px/.exec(st);
    if (!m) continue;
    const sx = +m[1], sy = m[2] != null ? +m[2] : sx, ox = o ? +o[1] : 0, oy = o ? +o[2] : 0;
    el.setAttribute('transform', `${el.getAttribute('transform') || ''} translate(${ox} ${oy}) scale(${sx} ${sy}) translate(${-ox} ${-oy})`.trim());
    el.setAttribute('style', st.replace(/transform(-origin)?\s*:[^;]*;?/g, ''));
  }
  for (const t of svg.querySelectorAll('text')) {
    t.setAttribute('font-family', 'helvetica');
    const w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeValue = n.nodeValue.replace(/♯/g, '#').replace(/♭/g, 'b').replace(/♮/g, '');
  }
}

export async function pdfPartitura(datos) {
  await Promise.all([cargarAbc(), cargarPdf()]);
  const caja = document.createElement('div');
  caja.style.cssText = 'position:fixed;left:-20000px;top:0;width:820px;background:#fff;color:#000';
  document.body.appendChild(caja);
  try {
    window.ABCJS.renderAbc(caja, abcDe(datos), { ...OPCIONES(760), oneSvgPerLine: true });
    const svgs = [...caja.querySelectorAll('svg')];
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight(), M = 34, ancho = W - 2 * M, pie = 18;
    let y = M;
    for (const svg of svgs) {
      const vb = svg.viewBox?.baseVal;
      const w = vb?.width || parseFloat(svg.getAttribute('width')), h = vb?.height || parseFloat(svg.getAttribute('height'));
      if (!w || !h) continue;
      svg.setAttribute('width', w); svg.setAttribute('height', h);
      paraPdf(svg);
      const k = ancho / w, alto = h * k;
      if (y + alto > H - M - pie && y > M) { pdf.addPage(); y = M; }
      await pdf.svg(svg, { x: M, y, width: ancho, height: alto });
      y += alto + 4;
    }
    const n = pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      pdf.setPage(i); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(110);
      pdf.text(`${datos.titulo} · Murga-o-matic`, M, H - 18); pdf.text(`${i} / ${n}`, W - M, H - 18, { align: 'right' });
    }
    return pdf.output('blob');
  } finally { caja.remove(); }
}

// ───────────────────────── letra con acordes ─────────────────────────
// Cada acorde arriba de la sílaba donde empieza a sonar. Las partes sin letra van como cifrado por compases.
const base = c => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// dónde empieza cada sílaba en el verso escrito (o null si no se puede seguir)
function posiciones(texto, sils) {
  const out = []; let p = 0;
  for (const s of sils) {
    let ini = null;
    for (const parte of s.texto.split('‿')) for (const ch of parte) {
      while (p < texto.length && base(texto[p]) !== base(ch)) {
        if (/[a-zñ]/.test(base(texto[p])) && base(texto[p]) !== 'h') return null;   // se saltearía una letra: no coincide
        p++;
      }
      if (p >= texto.length) return null;
      if (ini === null) ini = p;
      p++;
    }
    while (ini > 0 && /h/i.test(texto[ini - 1])) ini--;   // la h muda va con la sílaba que sigue
    out.push(ini);
  }
  return out;
}
// cómo se escribe cada sílaba en el verso (con su h, sus mayúsculas y sus signos), o null
export function escritas(texto, sils) {
  const t = (texto || '').trim(), pos = t ? posiciones(t, sils) : null;
  if (!pos) return null;
  return pos.map((p, j) => t.slice(p, j + 1 < pos.length ? pos[j + 1] : t.length).trim());
}
function reconstruir(sils) {
  let t = ''; const pos = [];
  sils.forEach(s => { pos.push(t.length); t += s.texto.replace(/‿/g, ' ') + (s.fin ? ' ' : ''); });
  return { texto: t.trimEnd(), pos };
}
function lineaDeAcordes(marcas) {
  let l = '';
  for (const { col, nombre } of marcas.sort((a, b) => a.col - b.col)) {
    const c = Math.max(col, l.length ? l.length + 1 : 0);
    l = l.padEnd(c) + nombre;
  }
  return l;
}
function cifrado(s, desde = s.inicio) {
  const fin = s.inicio + s.largo, cambios = cambiosDeAcorde(s);
  const enQ = q => { let a = null; for (const c of cambios) if (c.q <= q) a = c; return a?.nombre || '—'; };
  const compases = [];
  for (let q = desde; q < fin; q += 16) { const a = enQ(q), b = q + 8 < fin ? enQ(q + 8) : a; compases.push(a === b ? a : `${a} ${b}`); }
  const filas = [];
  for (let i = 0; i < compases.length; i += 4) filas.push('| ' + compases.slice(i, i + 4).map(c => c.padEnd(9)).join('| ') + '|');
  return filas;
}
export function textoConAcordes({ pieza, titulo, subtitulo, versos }) {
  const out = [titulo, subtitulo, '', 'Cifrado americano: A = La, B = Si, C = Do, D = Re, E = Mi, F = Fa, G = Sol; m = menor, 7 = séptima, dim = disminuido.', ''];
  const vistos = [];
  for (const s of pieza.secs) {
    if (s.largo <= 0) continue;
    const textura = s.tipo === 'llamada' ? 'llamada de batería' : s.bateria ? 'con batería' : 'a capela';
    out.push(`[${s.nombre}]  ${NOTAS_ES[s.tonica]} ${s.modo} · ${s.tempo} BPM · ${textura}`);
    const vs = versos?.get(s.nombre);
    const firma = JSON.stringify([vs?.map(v => v.texto), s.acordes, s.tonica, s.modo]);
    const igual = vistos.find(x => x.firma === firma);
    if (igual && vs?.length) { out.push(`(igual que «${igual.nombre}»)`, ''); continue; }
    vistos.push({ firma, nombre: s.nombre });
    if (s.tipo === 'llamada') { out.push('(batería sola)', ''); continue; }
    if (!vs?.length) { out.push(...cifrado(s), ''); continue; }
    const cambios = cambiosDeAcorde(s);
    vs.forEach((v, k) => {
      if (!v.silabas.length) return;
      const ini = k === 0 ? s.inicio : v.silabas[0].q0, finV = vs[k + 1]?.silabas[0]?.q0 ?? s.inicio + s.largo;
      // el acorde que suena cuando arranca el verso, y los que cambian mientras dura
      let previo = null; for (const c of cambios) if (c.q <= v.silabas[0].q0) previo = c;
      const lista = cambios.filter(c => c.q > v.silabas[0].q0 && c.q < finV && c.q >= ini);
      if (previo) lista.unshift({ ...previo, q: v.silabas[0].q0 });
      let texto = v.texto.trim(), pos = texto ? posiciones(texto, v.silabas) : null;
      if (!pos) ({ texto, pos } = reconstruir(v.silabas));
      const marcas = lista.map(c => {
        let j = v.silabas.findIndex(x => c.q >= x.q0 && c.q < x.q1);
        if (j < 0) j = v.silabas.findIndex(x => x.q0 >= c.q);
        const col = j < 0 ? texto.length + 1 : pos[j];
        return { col, nombre: c.nombre };
      });
      // si dos acordes caen en la misma sílaba, queda el último
      const unicas = []; for (const m of marcas) { const u = unicas.find(x => x.col === m.col); if (u) u.nombre = m.nombre; else unicas.push(m); }
      out.push(lineaDeAcordes(unicas), texto);
    });
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
}
