// letrista_local.js — escribe letras de murga sin red y sin modelos: una gramática de bloques del léxico y una búsqueda
// que, para cada verso, prueba cientos de combinaciones y se queda con la que tiene exactamente las sílabas cantadas
// que pide la melodía, el final (agudo o llano) correcto, rima con su pareja y pone los acentos en los tiempos fuertes.
import { silabasCantadas, medir } from './letra.js';
import { partesAEscribir } from './letrista.js';
import { SUJETOS, ACCIONES, COMPLEMENTOS, CRITICAS, SALUDOS, DESPEDIDAS, VOCATIVOS, FRAGMENTOS, EXCLAMACIONES, CLAVES } from './lexico.js';

class Rng {
  constructor(s) { this.a = (s * 2654435761 + 12345) >>> 0; }
  r() { let t = this.a += 0x6d2b79f5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  peso(items, w) { let tot = 0; for (const x of items) tot += w(x); let u = this.r() * tot; for (const x of items) { u -= w(x); if (u <= 0) return x; } return items[items.length - 1]; }
}

// Plantillas de verso por función de la parte (bloques en mayúscula; lo demás va literal)
const PLANTILLAS = {
  clarinada: [['FRAG', 3], ['SAL', 2], ['VOC', 1], ['COMP', 2], ['CL', 2], ['y CL', 1], ['NOS', 1], ['SAL , VOC', 1], ['que CL', 1], ['NOS COMP', 1], ['CL COMP', 1]],
  estrofa: [['CL', 2], ['CL COMP', 4], ['NOS COMP', 3], ['NOS', 1], ['y CL', 2], ['y CL COMP', 2], ['que CL', 1], ['que CL COMP', 1], ['aunque CRIT', 2], ['aunque CRIT COMP', 1],
    ['mientras CRIT', 1], ['CRIT', 2], ['CRIT COMP', 1], ['porque CRIT', 1], ['SAL', 1], ['SAL , VOC', 1], ['SAL , NOS', 1], ['VOC , NOS COMP', 1], ['COMP , NOS', 1], ['COMP , CL', 1], ['y NOS COMP', 1]],
  despedida: [['DESP , VOC', 2], ['DESP , COMP', 2], ['NOS COMP', 3], ['y CL COMP', 2], ['CL COMP', 2], ['aunque CRIT', 1], ['VOC , NOS', 1], ['y NOS', 1], ['que CL COMP', 1], ['DESP', 1], ['NOS', 1], ['CL', 1]],
  estribillo: [['SAL , VOC', 2], ['NOS COMP', 3], ['CL COMP', 3], ['SAL , COMP', 1], ['y CL COMP', 1], ['VOC , NOS', 1], ['que CL COMP', 1], ['NOS', 1], ['CL', 1]],
  cancion: [['CL COMP', 4], ['CL', 2], ['y CL', 2], ['COMP', 1], ['VOC , COMP', 1], ['NOS COMP', 2], ['que CL COMP', 1], ['y NOS COMP', 1], ['FRAG', 1]],
  bajada: [['DESP , COMP', 2], ['NOS COMP', 3], ['DESP , VOC', 2], ['CL COMP', 2], ['DESP', 1], ['y NOS COMP', 1], ['NOS', 1]],
};
// terminación (tipo y rima) de cada bloque, para buscar rimas sin probar a ciegas
const FIN = new Map();
const finDe = t => { if (!FIN.has(t)) FIN.set(t, finalDe(silabasCantadas(t))); return FIN.get(t); };
// sólo sujetos a los que les cabe alguna acción
const SUJETOS_OK = SUJETOS.filter(x => ACCIONES.some(a => a.para.some(p => x.e.includes(p))));
const ATONAS = new Set('a al con de del el en la las lo los me mi mis nos para por que se sin su sus te tu un una y o ya hoy aunque mientras porque como'.split(' '));

function funcionDe(nombre, forma) {
  if (nombre.startsWith('Clarinada')) return 'clarinada';
  if (nombre.startsWith('Canción final')) return 'cancion';
  if (nombre.startsWith('Bajada')) return 'bajada';
  if (nombre.startsWith('Estribillo')) return 'estribillo';
  return forma === 'retirada' ? 'despedida' : 'estrofa';
}

export function temasDe(tema, forma) {
  const base = forma === 'retirada' ? ['despedida', 'memoria', 'barrio'] : ['saludo', 'fiesta', 'barrio'];
  const pedidos = [];
  const t = (tema || '').toLowerCase();
  for (const [re, k] of CLAVES) if (re.test(t)) pedidos.push(k);
  return { base, pedidos };
}

// La vocal que rima de una sílaba: la fuerte si hay, si no la última
const vocal = s => { const v = s.fon.filter(p => 'aeiou'.includes(p)); return v.find(p => 'aeo'.includes(p)) || v[v.length - 1] || 'a'; };
export function finalDe(sils) {
  const n = sils.length; if (!n) return { tipo: '', rima: '' };
  if (sils[n - 1].acento) return { tipo: 'aguda', rima: vocal(sils[n - 1]) };
  if (n >= 2 && sils[n - 2].acento) return { tipo: 'llana', rima: vocal(sils[n - 2]) + vocal(sils[n - 1]) };
  if (n >= 3 && sils[n - 3].acento) return { tipo: 'esdrújula', rima: vocal(sils[n - 3]) + vocal(sils[n - 1]) };
  // sin acento propio al final (palabra átona): se toma como llana
  return { tipo: 'llana', rima: vocal(sils[Math.max(0, n - 2)]) + vocal(sils[n - 1]) };
}
const palabrasContenido = txt => txt.toLowerCase().replace(/[^a-záéíóúüñ ]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && !ATONAS.has(w));

// Arma un verso a partir de una plantilla. Devuelve {texto, temas[]}
function expandir(plantilla, rng, ctx) {
  let previos = [], incoherencia = 0, ultimo = false;
  const rimaOk = t => { if (!ultimo || !ctx.rimaQuerida) return 1; const f = finDe(t); return f.rima === ctx.rimaQuerida && f.tipo === ctx.tipoQuerido ? 7 : 1; };
  const peso0 = x => Math.max(.05, 1 + (x.t || []).reduce((a, t) => a + (ctx.pedidos.includes(t) ? 3 : ctx.base.includes(t) ? 1.2 : 0) + (previos.includes(t) ? 2.5 : 0), 0) - (ctx.usados.has(x.s) ? .9 : 0));
  const peso = x => peso0(x) * rimaOk(x.n && ctx.nos ? x.n : x.s);
  const temas = [], partes = [];
  const toks = plantilla.split(' ');
  for (let it = 0; it < toks.length; it++) {
    const tok = toks[it];
    ultimo = it === toks.length - 1;
    let x = null;
    switch (tok) {
      case 'CL': {
        const suj = rng.peso(SUJETOS_OK, peso);
        ctx.nos = false; const acc = rng.peso(ACCIONES.filter(a => a.para.some(p => suj.e.includes(p))), peso);
        const ya = rng.r() < .15 && !acc.s.startsWith('no ') ? 'ya ' : '';
        partes.push(suj.s + ' ' + ya + acc.s); temas.push(...suj.t, ...acc.t); previos = [...acc.t, ...suj.t]; ctx.tocados.push(suj.s, acc.s); continue;
      }
      case 'NOS': ctx.nos = true; x = rng.peso(ACCIONES.filter(a => a.n), peso); ctx.nos = false; partes.push((rng.r() < .12 && !x.n.startsWith('no ') ? 'ya ' : '') + x.n); temas.push(...x.t); previos = x.t; ctx.tocados.push(x.s); continue;
      case 'COMP': x = rng.peso(COMPLEMENTOS, peso); break;
      case 'CRIT': x = rng.peso(CRITICAS, peso); break;
      case 'SAL': x = rng.peso(SALUDOS, peso); break;
      case 'DESP': x = rng.peso(DESPEDIDAS, peso); break;
      case 'VOC': if (partes.length && /,$/.test(partes[partes.length - 1]) && /,/.test(partes[partes.length - 1].slice(0, -1))) { partes[partes.length - 1] = partes[partes.length - 1].slice(0, -1); continue; } x = rng.peso(VOCATIVOS, peso); break;
      case 'FRAG': x = rng.peso(FRAGMENTOS, peso); break;
      case ',': if (partes.length) partes[partes.length - 1] += ','; continue;
      default: partes.push(tok); continue;
    }
    if (previos.length && x.t && !x.t.some(t => previos.includes(t))) incoherencia++;
    partes.push(x.s); temas.push(...(x.t || [])); previos = x.t || []; ctx.tocados.push(x.s);
  }
  return { texto: partes.join(' ').replace(/\s+,/g, ',').replace(/,$/, ''), temas, incoherencia };
}

// Variantes que estiran o achican un verso sin romperlo
function variantes(texto, primero, conVerbo) {
  const v = [[texto, 0]];
  if (conVerbo && !primero && !/^(y|que|aunque|mientras|porque|hoy) /i.test(texto)) v.push(['y ' + texto, .5]);
  if (conVerbo && !/^(y|que|aunque|mientras|porque|hoy) /i.test(texto) && !/,/.test(texto)) v.push(['hoy ' + texto, .8]);
  if (!/(otra vez|de nuevo|una vez más|,)/.test(texto)) v.push([texto + ' otra vez', .7], [texto + ' de nuevo', .9]);
  if (/^(y|hoy) /.test(texto)) v.push([texto.replace(/^(y|hoy) /, ''), 0]);
  if (/ ya /.test(texto)) v.push([texto.replace(' ya ', ' '), 0]);
  return v;
}

const RIMAS_RICAS = new Set(['a', 'o', 'e', 'ao', 'ia', 'ea', 'oa', 'aa', 'io']);
function puntaje(c, verso, rima, ctx) {
  const d = { rima: 0, acentos: 0, tema: 0, repeticion: 0 };
  if (rima) d.rima = c.fin.rima === rima ? 4 : -1.5;
  // el que fija la rima de la estrofa elige una terminación con muchas rimas posibles
  else if (ctx.fijaRima) d.rima = RIMAS_RICAS.has(c.fin.rima) ? .8 : -.6;
  // acentos en los lugares fuertes de la melodía
  if (verso.acentos?.length) { const acs = new Set(verso.acentos); let ok = 0; c.sils.forEach((s, i) => { if (s.acento && acs.has(i + 1)) ok++; }); d.acentos = 1.6 * ok / acs.size; }
  // temas: el pedido tiene que aparecer en al menos un verso de cada tres
  for (const t of c.temas) d.tema += ctx.pedidos.includes(t) ? .35 : ctx.base.includes(t) ? .12 : 0;
  if (ctx.pedidos.length && c.temas.some(t => ctx.pedidos.includes(t))) d.tema += ctx.faltaTema ? 1.6 : .4;
  // repetir palabras dentro de la parte o de la letra
  const vistas = new Set();
  for (const w of palabrasContenido(c.texto)) { if (vistas.has(w)) d.repeticion -= 2; vistas.add(w); if (ctx.enParte.has(w)) d.repeticion -= 1.2; else if (ctx.enLetra.has(w)) d.repeticion -= .25; }
  c.desglose = d;
  return d.rima + d.acentos + d.tema + d.repeticion;
}
const NOMBRE_BLOQUE = { CL: 'sujeto + acción', NOS: 'nosotros + acción', COMP: 'complemento', CRIT: 'crítica', SAL: 'saludo', DESP: 'despedida', VOC: 'vocativo', FRAG: 'fragmento' };
export const leerPlantilla = tpl => tpl.split(' ').filter(t => t !== ',').map(t => NOMBRE_BLOQUE[t] || '«' + t + '»').join(' + ');

// Un verso: devuelve el mejor candidato (exacto si lo encuentra)
function verso(v, rima, rng, ctx, funcion) {
  const n = v.silabas;
  if (n <= 3) {
    const cortos = n === 1 ? ['ay', 'ay', 'ay', 'sí', 'oh'] : n === 2 ? ['ay, sí', 'por vos', 'la la', 'ay, ay, ay'] : EXCLAMACIONES.concat(FRAGMENTOS.map(f => f.s));
    let op = cortos.filter(e => medir(e).n === n && (n === 1 || finalDe(silabasCantadas(e)).tipo === v.tipo));
    const nuevos = op.filter(e => !ctx.cortos.has(e) || e === 'ay');
    if (nuevos.length) op = nuevos;
    if (op.length) { const t = op[Math.floor(rng.r() * op.length)]; ctx.cortos.add(t); return { texto: t, exacto: true, diag: { tipo: 'corto', opciones: op.slice(0, 8) } }; }
  }
  const pl = PLANTILLAS[funcion];
  let mejor = null, cerca = null, intentos = 0, probados = 0, exactos = 0, conRima = 0;
  const descartes = { silabas: [], final: [], rima: [] }, top = [];
  const MAX = rima ? 1800 : 900;
  while (intentos++ < MAX) {
    ctx.tocados = [];
    const critica = ctx.pedidos.some(t => t === 'crisis' || t === 'pantallas' || t === 'lucha');
    const tpl = rng.peso(ctx.primero ? pl.filter(x => !/^(y|que|aunque|mientras|porque) /.test(x[0])) : pl, x => x[1] * (critica && /CRIT/.test(x[0]) ? 2.2 : 1))[0];
    const base = expandir(tpl, rng, ctx);
    for (const [texto, costo] of variantes(base.texto, ctx.primero, /CL|NOS|CRIT/.test(tpl))) {
      probados++;
      const sils = silabasCantadas(texto);
      const dif = Math.abs(sils.length - n);
      const fin = finalDe(sils);
      const c = { texto, sils, fin, temas: base.temas, tocados: ctx.tocados.slice(), tpl };
      if (dif === 0 && fin.tipo === v.tipo) {
        exactos++;
        const repiteInicio = c.texto.split(' ')[0] === ctx.anterior;
        c.p = puntaje(c, v, rima, ctx) - costo - .9 * base.incoherencia - (repiteInicio ? .8 : 0);
        c.desglose.relleno = -costo; c.desglose.coherencia = -.9 * base.incoherencia; c.desglose.inicio = repiteInicio ? -.8 : 0;
        if (rima && fin.rima === rima) conRima++;
        else if (rima && descartes.rima.length < 3 && !descartes.rima.some(x => x.texto === texto)) descartes.rima.push({ texto, motivo: 'termina en «' + fin.rima + '» y la estrofa rima en «' + rima + '»' });
        if (!top.some(x => x.texto === texto)) { top.push({ texto, p: +c.p.toFixed(2) }); top.sort((a, b) => b.p - a.p); top.length = Math.min(top.length, 4); }
        if (!mejor || c.p > mejor.p) mejor = c;
      } else {
        if (dif !== 0 && dif <= 3 && descartes.silabas.length < 3) descartes.silabas.push({ texto, motivo: sils.length + ' sílabas cantadas; la melodía pide ' + n });
        else if (dif === 0 && fin.tipo !== v.tipo && descartes.final.length < 2) descartes.final.push({ texto, motivo: 'termina ' + fin.tipo + '; la melodía pide ' + v.tipo });
        if (dif <= 2 && (!cerca || dif < cerca.dif || (dif === cerca.dif && fin.tipo === v.tipo))) { c.dif = dif; cerca = c; }
      }
    }
    // cortar antes si ya hay uno muy bueno
    if (mejor && intentos > 120 && (rima ? mejor.fin.rima === rima && mejor.p > 4.5 : mejor.p > 1.4)) break;
  }
  const elegido = mejor || cerca;
  const diag = { tipo: 'busqueda', intentos: intentos - 1, probados, exactos, conRima, rima, plantilla: elegido ? leerPlantilla(elegido.tpl) : '', puntaje: mejor ? +mejor.p.toFixed(2) : null, desglose: mejor?.desglose || null,
    descartes: [...descartes.silabas, ...descartes.final, ...descartes.rima].slice(0, 5), otros: top.filter(x => x.texto !== elegido?.texto).slice(0, 3), temas: [...new Set(elegido?.temas || [])] };
  if (!elegido) return { texto: Array.from({ length: n }, (_, i) => i % 3 === 2 ? 'ra' : 'la').join(' '), exacto: false, diag };
  for (const t of elegido.tocados) ctx.usados.add(t);
  return { texto: elegido.texto, exacto: !!mejor, fin: elegido.fin, temas: elegido.temas, diag };
}

const mayuscula = t => t ? t[0].toUpperCase() + t.slice(1) : t;

// Escribe toda la letra. metrica: salida de coro.metrica(P). Mismo formato de salida que el letrista con Claude.
export function escribirLetraLocal({ forma, tema, metrica, semilla = 1 }) {
  const partes = partesAEscribir(metrica, forma);
  const rng = new Rng(semilla * 7919 + 17);
  const { base, pedidos } = temasDe(tema, forma);
  const ctx = { base, pedidos, usados: new Set(), enLetra: new Set(), enParte: new Set(), tocados: [] };
  const diags = [];
  const textos = partes.map(p => {
    const dp = []; diags.push(dp);
    const funcion = funcionDe(p.nombre, forma);
    ctx.enParte = new Set(); ctx.cortos = new Set(); ctx.anterior = '';
    const out = [], rimas = {}; let conTema = 0;
    p.versos.forEach((v, k) => {
      // estribillo y bajada: el último verso vuelve al primero (el gancho) si entra igual
      if ((funcion === 'estribillo' || funcion === 'bajada') && k === p.versos.length - 1 && k >= 3 && p.versos[0].silabas === v.silabas && p.versos[0].tipo === v.tipo) { out.push(out[0]); dp.push({ tipo: 'gancho', funcion }); return; }
      // riman los versos pares (2.º, 4.º…) entre sí, si tienen el mismo tipo de final
      const par = k % 2 === 1;
      const rima = par ? rimas[v.tipo] : null;
      ctx.primero = k === 0; ctx.fijaRima = par && !rimas[v.tipo]; ctx.faltaTema = conTema < Math.ceil((k + 1) / 3);
      ctx.rimaQuerida = rima; ctx.tipoQuerido = v.tipo;
      const r = verso(v, rima, rng, ctx, funcion);
      if (par && r.fin && !rimas[v.tipo] && r.fin.tipo === v.tipo) rimas[v.tipo] = r.fin.rima;
      out.push(r.texto); dp.push({ ...r.diag, funcion }); ctx.anterior = r.texto.split(' ')[0]; if (r.temas?.some(t => ctx.pedidos.includes(t))) conTema++;
      for (const w of palabrasContenido(r.texto)) { ctx.enParte.add(w); ctx.enLetra.add(w); }
    });
    out[0] = mayuscula(out[0]);
    return out;
  });
  const letras = {};
  partes.forEach((p, i) => { for (const s of p.secciones) letras[s] = textos[i].slice(); });
  const malos = [];
  partes.forEach((p, i) => p.versos.forEach((v, k) => { const m = medir(textos[i][k]); if (m.n !== v.silabas) malos.push({ parte: i, verso: k, tiene: m.n, quiere: v.silabas }); }));
  return { letras, partes, textos, malos, diags, temas: { base, pedidos } };
}
