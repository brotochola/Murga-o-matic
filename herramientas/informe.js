// Escribe docs/analisis_de_los_midis.md: todo lo que el corpus dice, con los números calculados acá.
//   node herramientas/informe.js
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, TRABAJO } from './corpus.js';
import { cargarAnalisis, medir } from './medir.js';
import { compasesDe, frasesDe, gradoSimple, mod } from './compas.js';
import { RASGOS, rasgosReal } from './jurado.js';
import { bloques, tempoEn, tonoNumEn } from './forma.js';
import { nomPc } from './midi.js';
import { acorde } from '../motor/compositor.js';

const L = cargarAnalisis().sort((a, b) => a.murga.localeCompare(b.murga) || a.anio - b.anio || a.parte.localeCompare(b.parte));
const media = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const pcl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };
const med = a => pcl(a, .5);
const cnt = (h, k, v = 1) => { h[k] = (h[k] || 0) + v; };
const pc = (x, d = 0) => (100 * x).toFixed(d).replace('.', ',') + ' %';
const num = (x, d = 1) => x.toFixed(d).replace('.', ',');
const suma = h => Object.values(h).reduce((a, b) => a + b, 0) || 1;
const topH = (h, n = 10) => { const t = suma(h); return Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, v / t]); };
const tabla = (cab, filas) => `| ${cab.join(' | ')} |\n|${cab.map(() => '---').join('|')}|\n` + filas.map(f => `| ${f.join(' | ')} |`).join('\n') + '\n';
const MURGAS = [...new Set(L.map(a => a.murga))];
const NOMBRE_MOTIVO = { trabado: 'trabas del transcriptor', choque: 'choque a un semitono', extrana: 'ajena a lo que suena', fantasma: 'demasiado corta', aislada: 'aislada', registro: 'fuera de registro', eterna: 'eterna' };
const NOMBRE_ESTILO = { trasnochada: 'La Trasnochada', catalina: 'Agarrate Catalina', muneca: 'La Gran Muñeca', pasteles: 'Metele que son Pasteles', todas: 'todas juntas' };
const esPres = a => a.parte === 'presentacion';
const corto = a => `${a.murga.split(' ').pop()} ${a.anio} ${a.parte.replace(/_/g, ' ')}`;

// ── Medidas ───────────────────────────────────────────────────────
const R = L.map(an => ({ an, r: rasgosReal(an) }));

function ritmo(lista) {
  const pos = new Array(16).fill(0); let compases = 0, golpes = 0;
  const cel = {};
  for (const an of lista) for (const c of compasesDe(an)) {
    if (!c.bat || c.qf - c.q0 !== 16) continue;
    if (c.golpes.length < 2) continue;
    compases++;
    const s = new Set();
    for (const g of c.golpes) { const p = mod(g.pos, 16); pos[p]++; s.add(p); golpes++; }
    for (const m of [0, 8]) { let t = ''; for (let i = m; i < m + 8; i++) t += s.has(i) ? 'x' : '.'; cnt(cel, t); }
  }
  return { pos, compases, golpes, cel };
}

function melodiaDe(lista) {
  const h = { rep: 0, gr: 0, ter: 0, sal: 0 }, dir = { sube: 0, baja: 0 };
  let n = 0, enRacha = 0, rachas = 0, largoRacha = [], tras = {}, trasLarga = 0;
  const fuerte = {}, debil = {}; let fTon = 0, fTot = 0, dTon = 0, dTot = 0;
  for (const an of lista) {
    const G = an.golpes.map(([q, d, ps]) => ({ q, d, t: ps[ps.length - 1] }));
    let i = 0;
    while (i < G.length) {
      let j = i;
      while (j + 1 < G.length && G[j + 1].t === G[i].t && G[j + 1].q - G[j].q <= 6) j++;
      const k = j - i + 1;
      n += k;
      if (k >= 3) {
        enRacha += k; rachas++; largoRacha.push(k);
        const s = G[j + 1];
        if (s && s.q - G[j].q <= 8) { const d = s.t - G[j].t; cnt(tras, d > 0 ? (d <= 2 ? 'sube un grado' : 'sube saltando') : d < 0 ? (d >= -2 ? 'baja un grado' : 'baja saltando') : 'igual'); if (s.d >= 6) trasLarga++; }
      }
      i = j + 1;
    }
    for (let x = 1; x < G.length; x++) {
      if (G[x].q - G[x - 1].q > 8) continue;
      const d = G[x].t - G[x - 1].t, a = Math.abs(d);
      if (!a) h.rep++; else if (a <= 2) h.gr++; else if (a <= 4) h.ter++; else h.sal++;
      if (a) cnt(dir, d > 0 ? 'sube' : 'baja');
    }
    for (const g of G) {
      const c = an.acordes[Math.floor(g.q / 4)];
      if (!c) continue;
      const gr = gradoSimple(c[0], c[1], c[2]);
      let ac; try { ac = acorde(gr); } catch { continue; }
      const iv = mod(g.t - c[0], 12), es = ac.pcs.map(p => mod(p + c[2], 12)).includes(mod(g.t, 12));
      if (mod(g.q, 8) === 0 || g.d >= 4) { cnt(fuerte, iv); fTot++; if (es) fTon++; } else { cnt(debil, iv); dTot++; if (es) dTon++; }
    }
  }
  return { h, dir, n, enRacha, rachas, largoRacha, tras, trasLarga, fuerte, debil, fTon: fTon / (fTot || 1), dTon: dTon / (dTot || 1) };
}

function texturaDe(lista) {
  let sigue = 0, tot = 0;
  const larga = {}, corta = {};
  for (const an of lista) {
    for (let i = 1; i < an.golpes.length; i++) {
      const a = an.golpes[i - 1], b = an.golpes[i];
      if (b[0] - a[0] > 8) continue;
      tot++; if (a[2].length === b[2].length) sigue++;
    }
    for (const [, d, ps] of an.golpes) cnt(d >= 6 ? larga : corta, Math.min(4, ps.length));
  }
  return { sigue: sigue / (tot || 1), larga, corta };
}

function repeticion(lista) {
  const r = { 1: [0, 0], 2: [0, 0], 4: [0, 0] };
  for (const an of lista) {
    const C = compasesDe(an).filter(c => c.qf - c.q0 === 16);
    for (const span of [1, 2, 4]) for (let i = 0; i + 2 * span <= C.length; i += span) {
      const pos = (l) => { const s = new Set(); l.forEach((c, x) => c.golpes.forEach(g => s.add(g.pos + x * 16))); return s; };
      const A = pos(C.slice(i, i + span)), B = pos(C.slice(i + span, i + 2 * span));
      if (A.size < 4 || B.size < 4) continue;
      let c = 0; for (const x of A) if (B.has(x)) c++;
      r[span][1]++;
      if (2 * c / (A.size + B.size) >= .8) r[span][0]++;
    }
  }
  return r;
}

function formaDe(lista) {
  const f = lista.map(an => {
    const B = bloques(an).filter(b => b.t1 - b.t0 >= 4);
    const cap0 = B.find(b => !b.bat && b.t1 - b.t0 >= 8 && b.t0 < 20);
    const conBat = B.filter(b => b.bat && b.t1 - b.t0 >= 15);
    const tempos = conBat.map(b => tempoEn(an, b.t0, b.t1)).filter(Boolean);
    const tonos = B.filter(b => b.t1 - b.t0 >= 12).map(b => tonoNumEn(an, b.t0, b.t1)).filter(Boolean);
    const cambios = [];
    for (let i = 1; i < tonos.length; i++) { const a = tonos[i - 1], b = tonos[i]; if (a.t !== b.t || a.mayor !== b.mayor) cambios.push({ a, b, sube: mod(b.t - a.t, 12) }); }
    return { an, B, cap0: cap0 ? cap0.t1 - cap0.t0 : 0, t1: tempos[0], tN: tempos[tempos.length - 1], cambios, capMedio: B.filter(b => !b.bat && b !== cap0 && b.t1 - b.t0 >= 8).length };
  });
  return f;
}

function modos(lista) {
  const h = {};
  for (const an of lista) { let m = 0; for (const a of an.acordes) m += a[3] ? 1 : -1; cnt(h, m >= 0 ? 'mayor' : 'menor'); }
  return h;
}

const RT = ritmo(L), MEL = melodiaDe(L), TX = texturaDe(L), REP = repeticion(L), FO = formaDe(L);
const M = medir(L);
const totalNotas = L.reduce((s, a) => s + a.n_notas, 0), totalGolpes = L.reduce((s, a) => s + a.golpes.length, 0);
const minutos = L.reduce((s, a) => s + a.largo_s, 0) / 60;
const shows = new Set(L.map(a => a.murga + a.anio)).size;
const quit = {}; for (const a of L) for (const [k, v] of Object.entries(a.quitadas)) cnt(quit, k, v);
const totalQuit = suma(quit);
const jurado = existsSync(join(TRABAJO, 'jurado.json')) ? JSON.parse(readFileSync(join(TRABAJO, 'jurado.json'), 'utf8')) : null;
const copia = existsSync(join(TRABAJO, 'copia.json')) ? JSON.parse(readFileSync(join(TRABAJO, 'copia.json'), 'utf8')) : null;
const pureza = existsSync(join(TRABAJO, 'pureza.json')) ? JSON.parse(readFileSync(join(TRABAJO, 'pureza.json'), 'utf8')) : null;

const pres = FO.filter(f => esPres(f.an)), ret = FO.filter(f => !esPres(f.an) && f.an.parte !== 'cancion_final');
const saltoRet = ret.filter(f => f.t1 && f.tN).map(f => f.tN / f.t1);
const cambiosTodos = FO.flatMap(f => f.cambios);
const subeSemi = cambiosTodos.filter(c => c.a.mayor === c.b.mayor && c.sube === 1).length;
const estiloFila = k => MURGAS.map(m => { const v = R.filter(x => x.an.murga === m).map(x => x.r[k]); return med(v); });
const posNombre = i => (i % 4 === 0 ? `**${i / 4 + 1}**` : i % 2 === 0 ? `${Math.floor(i / 4) + 1}y` : '·');
const totalPos = RT.pos.reduce((a, b) => a + b, 0) || 1;
const parCorchea = RT.pos.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) / totalPos;
const mh = MEL.h, mt = mh.rep + mh.gr + mh.ter + mh.sal;

let d = '';
const P = s => { d += s + '\n'; };

const principales = ['La Trasnochada', 'Agarrate Catalina'].filter(m => MURGAS.includes(m));
const extras = MURGAS.filter(m => !principales.includes(m));
P(`# Qué canta una murga de verdad: análisis de ${L.length} tramos de ${principales.join(' y ')}${extras.length ? `, más ${extras.join(' y ')}` : ''}`);
P('');
P(`Este documento mide lo que canta el coro en ${shows} espectáculos: ${num(minutos, 0)} minutos de canto, ${totalNotas.toLocaleString('es-AR')} notas y ${totalGolpes.toLocaleString('es-AR')} golpes de coro. Es la base del generador: cada regla de acá es algo que el Murga-o-matic hace porque el corpus lo hace.`);
P('');
P('Todo sale de las herramientas de `herramientas/`, en Node y sin dependencias. Este archivo lo escribe `node herramientas/informe.js`: no se edita a mano.');
P('');
P('> **Antes de leer.** Las notas no vienen de partituras: salen de separar las voces con Demucs y transcribirlas con MuScriptor. El transcriptor nunca escuchó una murga y se equivoca; lo que se hizo con esos errores está en la sección 1.2. Los números sirven para comparar y para generar, no como transcripción fiel de cada obra. Los acordes se validaron contra cifrados humanos (sección 5.3).');
P('');
P('---');
P('');
P('## 0. Lo esencial');
P('');
const reglas = [
  `**Se canta en bloque, y el bloque no cambia a cada rato.** El ${pc(TX.sigue)} de los golpes tiene las mismas voces que el anterior. La textura se mantiene por frase: esto es lo primero que delata a un generador que decide nota por nota.`,
  `**La melodía es la nota de arriba del bloque.** Se mueve poco: repite el ${pc(mh.rep / mt)} de las veces, va por grado el ${pc(mh.gr / mt)}, salta una tercera el ${pc(mh.ter / mt)} y más que eso el ${pc(mh.sal / mt)}.`,
  `**Se recita y se aterriza.** El ${pc(MEL.enRacha / MEL.n)} de los golpes está en una racha de tres o más notas iguales: el coro dice el texto sobre una nota y después se mueve (${topH(MEL.tras, 2).map(([k, v]) => `${k} ${pc(v)}`).join(', ')}).`,
  `**Las frases son cortas y terminan en nota larga.** Duran ${num(med(R.map(x => x.r.frase)))} compases de cuatro tiempos, unos ${num(med(R.map(x => x.r.golpesFrase)), 0)} golpes, y el ${pc(med(R.map(x => x.r.aterriza)))} termina en una nota larga. Hay aire: nadie canta durante el ${pc(med(R.map(x => x.r.aire)))} del tiempo.`,
  `**El pulso es de corcheas.** El ${pc(parCorchea)} de los ataques cae en lugar de corchea. Lo más común es la línea pareja de corcheas, y las frases arrancan en cualquier corchea del compás, no sólo en el 1.`,
  `**El coro va en terceras.** Dos voces vecinas están a tercera el ${pc(((M.vecinas[3] || 0) + (M.vecinas[4] || 0)) / suma(M.vecinas))} de las veces. Las voces interiores casi no saltan: ${pc((M.mov['cuarta/quinta'] + (M.mov.salto || 0)) / suma(M.mov), 1)} de saltos de cuarta o más.`,
  `**En los apoyos, la melodía está en el acorde.** El ${pc(MEL.fTon)} de las notas fuertes es nota del acorde; en las débiles, el ${pc(MEL.dTon)}.`,
  `**La armonía es tónica y dominante, con color.** En mayor, I ${pc((M.grados.mayor.I || 0) / suma(M.grados.mayor))}; en menor, i ${pc((M.grados.menor.i || 0) / suma(M.grados.menor))} y V7 ${pc((M.grados.menor.V7 || 0) / suma(M.grados.menor))}. El paso más común es V7 a tónica. Hay dominantes secundarias (I7 hacia el cuarto grado, II7, III7) y bVI y bVII en menor.`,
  `**La presentación entra a capela.** Mediana de ${num(med(pres.map(f => f.cap0)), 0)} segundos sin batería, y después un bloque largo al mismo tempo, cerca de ${num(med(pres.map(f => f.t1).filter(Boolean)), 0)} negras por minuto.`,
  `**La retirada acelera.** Empieza cerca de ${num(med(ret.map(f => f.t1).filter(Boolean)), 0)} y termina cerca de ${num(med(ret.map(f => f.tN).filter(Boolean)), 0)}: el último tempo es ${num(med(saltoRet) * 100 - 100, 0)} % más rápido que el primero. Tiene pasajes a capela en el medio, la presentación casi nunca.`,
  `**Las tonalidades suben.** De ${cambiosTodos.length} cambios de tono, ${subeSemi} son un semitono arriba en el mismo modo: es el cambio más común.`,
  `**El unísono es real, y es ancho.** El transcriptor anota una voz en el ${pc((M.voces[1] || 0) / suma(M.voces))} de los golpes, y en el ${pc(pureza?.sinOtraVoz ?? 0)} de ellos no hay rastro de otra voz, ni arriba ni abajo. Con una ventana angosta parecen impuros (${pc(pureza?.['1'] ?? 0)} de la energía en los parciales): trece personas no afinan exacto, y la energía se reparte alrededor de cada parcial (${pc(pureza?.energiaAncha ?? 0)} con una ventana de ±3 %).`,
  `**Cada murga tiene su modo.** ${principales.map(m => { const p = modos(L.filter(a => a.murga === m && esPres(a))), r = modos(L.filter(a => a.murga === m && !esPres(a))); return `${m}: presentación ${topH(p, 1)[0]?.[0]} (${pc(topH(p, 1)[0]?.[1] || 0)}), retirada ${topH(r, 1)[0]?.[0]} (${pc(topH(r, 1)[0]?.[1] || 0)})`; }).join('; ')}. De ${extras.join(' y ')} hay muy pocos tramos para decir algo.`,
];
reglas.forEach((r, i) => P(`${i + 1}. ${r}`));
P('');
P('---');
P('');
P('## 1. Qué se analizó');
P('');
P(tabla(['Tramo', 'Espectáculo', 'Largo', 'Notas', 'Quitadas', 'Compases', 'Tonalidades'], L.map(a => {
  const C = compasesDe(a);
  const q = suma(a.quitadas) === 1 && !Object.keys(a.quitadas).length ? 0 : Object.values(a.quitadas).reduce((s, x) => s + x, 0);
  const tn = {}; for (const c of a.acordes) cnt(tn, nomPc(c[2]) + (c[3] ? ' mayor' : ' menor'));
  return [corto(a), a.espectaculo || '—', (s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`)(Math.round(a.largo_s)), a.n_notas, pc(q / (q + a.n_notas)), C.length, topH(tn, 2).map(([k]) => k).join(', ')];
})));
P('');
P('### 1.1 Cómo se mide');
P('');
P('1. **Separar.** `htdemucs_ft` separa las voces. La percusión de murga no queda en la pista de batería: Demucs manda buena parte a "other", así que la percusión se toma como todo lo que no es voz.');
P('2. **Transcribir.** MuScriptor `medium`, restringido a voz, en pedazos de 5 segundos.');
P('3. **Grilla.** El detector de pulso se pierde con la murga, así que la grilla sale de los ataques cantados: se busca el período que encaja a la vez en semicorchea, corchea y negra, en ventanas de 8 segundos, y se une con Viterbi. La negra queda entre 70 y 150.');
P('4. **Golpes.** Las notas que atacan juntas son un golpe. La melodía es la nota de arriba de cada golpe.');
P('5. **Acordes y tonalidad.** Viterbi sobre croma, con el vocabulario y las frecuencias de cifrados reales.');
P('6. **Compás.** La percusión de cada pasaje se compara con los 14 loops de La Tríada para saber dónde cae el 1. A capela, se usa la armonía.');
P('');
P('### 1.2 Lo que hubo que sacar');
P('');
P(`Se quitaron ${totalQuit.toLocaleString('es-AR')} notas. Por motivo: ${topH(quit, 8).map(([k, v]) => `${NOMBRE_MOTIVO[k] || k} ${pc(v)}`).join(', ')}. Tres fallas del transcriptor enseñaron algo:`);
P('');
P('- **La cadena de notas abiertas.** MuScriptor le pasa al pedazo siguiente las notas que quedaron sonando. Si un pedazo sale mal, arrastra la basura hasta el final: tres tramos llegaron a más de 60 notas abiertas, y el peor dio 55 511 notas donde hay unas 5 000. En los tramos sanos nunca hubo más de 6. Con un tope de 8 que corta la cadena (`murga_lote.py`) bastó un solo corte en cada uno para rehacerlos, y el pedazo que explotó se descarta entero (`limpiar.js`).');
P('- **Las trabas.** Cuando el modelo no entiende el audio repite un acorde a tiempo fijo, hasta 140 veces. Una línea silábica real sobre un acorde dura unos 10 golpes y tiene ritmo. Las trabas caen en recitados y en pasajes casi inaudibles: en Agarrate Catalina 2019, "Recitado y Retirada", aparecen justo al principio.');
P('- **El falso acorde.** Durante el análisis los golpes de una voz daban tan poca energía en sus parciales que parecían acordes mal transcriptos. No lo eran. La prueba: se compara la energía en las fundamentales consonantes alrededor de la nota (tercera, cuarta, quinta) con la de las disonantes; el ruido llena las dos por igual y una voz real sólo las consonantes. Controlada contra golpes que sí tienen voces, dio que no hay otra voz: es un unísono de trece personas, con los parciales anchos. Lo mide `transcripcion/pureza.py`.');
P('- **Voces perdidas.** En un video de Catalina 2011 Demucs perdió las voces y el modelo inventó notas eternas: el video se reemplazó por otro.');
P('');
P('## 2. El ritmo');
P('');
P('### 2.1 Dónde ataca el coro');
P('');
P(`Medido en los ${RT.compases.toLocaleString('es-AR')} compases con batería, donde se sabe dónde está el 1. Cada compás de esta tabla son cuatro negras.`);
P('');
P(tabla(['Lugar', ...Array.from({ length: 16 }, (_, i) => posNombre(i))], [['% de los ataques', ...RT.pos.map(v => num(100 * v / totalPos, 1))]]));
P('');
P('### 2.2 Las células más comunes');
P('');
P('Cada célula son dos negras en semicorcheas: `x` es un ataque.');
P('');
P(tabla(['Célula', 'Parte'], topH(RT.cel, 12).map(([k, v]) => ['`' + k + '`', pc(v, 1)])));
P('');
P('### 2.3 Densidad y frases');
P('');
const filaR = (k, d = 2) => [RASGOS[k][1], ...estiloFila(k).map(v => num(v, d))];
P(tabla(['Medida', ...MURGAS], ['densidad', 'corcheas', 'largas', 'frase', 'golpesFrase', 'aterriza', 'aire'].map(k => filaR(k))));
P('');
P(`Compases consecutivos con casi el mismo ritmo: ${pc(REP[1][0] / (REP[1][1] || 1))}. Pares de dos compases: ${pc(REP[2][0] / (REP[2][1] || 1))}. La repetición de la canción está más lejos, entre estrofas, y dentro de una frase hay secuencias: el mismo motivo un grado más arriba.`);
P('');
P('## 3. El coro');
P('');
P('### 3.1 Cuántas voces');
P('');
P(tabla(['Voces', 'Golpes cortos', 'Golpes largos'], [1, 2, 3, 4].map(n => [n, pc((TX.corta[n] || 0) / suma(TX.corta)), pc((TX.larga[n] || 0) / suma(TX.larga))])));
P('');
P('Las cifras de una voz son confiables: la regla 12 muestra que son unísonos reales, o solistas. Al revés no tanto: en los golpes a tres voces suele haber alguna más arriba que el transcriptor no anotó, así que la cantidad de voces está más bien subestimada.');
P('');
P('### 3.2 Distancia entre voces vecinas');
P('');
P(tabla(['Semitonos', 'Parte'], topH(M.vecinas, 8).map(([k, v]) => [k, pc(v)])));
P('');
P('### 3.3 Cómo se mueven las líneas');
P('');
P(tabla(['Movimiento', 'Parte'], topH(M.mov, 5).map(([k, v]) => [k, pc(v)])));
P('');
P(tabla(['Medida', ...MURGAS], ['voces', 'terceras', 'paralelas', 'octavas', 'bloqueLargo', 'texSigue'].map(k => filaR(k))));
P('');
P('## 4. La melodía');
P('');
P('### 4.1 Qué nota del acorde');
P('');
const nomIv = i => ['raíz', 'b9', '9', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'][i];
P(tabla(['Respecto de la raíz', 'Lugares fuertes', 'Lugares débiles'], topH(MEL.fuerte, 8).map(([k, v]) => [nomIv(+k), pc(v), pc((MEL.debil[k] || 0) / suma(MEL.debil))])));
P('');
P('### 4.2 Recitado y aterrizaje');
P('');
P(`Hay ${MEL.rachas.toLocaleString('es-AR')} rachas de tres o más notas iguales, de ${num(med(MEL.largoRacha), 0)} golpes de mediana y hasta ${pcl(MEL.largoRacha, .98)} en las más largas. Después de una racha, la línea hace esto:`);
P('');
P(tabla(['Sigue', 'Parte'], topH(MEL.tras, 5).map(([k, v]) => [k, pc(v)])));
P('');
P(`El ${pc(MEL.trasLarga / (MEL.rachas || 1))} de las veces, esa nota siguiente es una nota larga.`);
P('');
P('### 4.3 Un ejemplo');
P('');
P('Agarrate Catalina 2020, presentación. Grados de la escala y duración en semicorcheas; `_` es silencio:');
P('');
P('```');
P('I-V7   _1 3 3 3 2:10');
P('V7-I   _2 4 4 4 3:9');
P('I-ii   _2 5 5 5 4:8');
P('ii-I   _2 6 6 4 3:13');
P('```');
P('');
P('Es un mismo gesto, repetir una nota y caer un grado a una nota larga, que sube un grado por vez. La secuencia es el recurso más reconocible del corpus, y ninguna medida de intervalos sueltos la ve.');
P('');
P('## 5. La armonía');
P('');
P('### 5.1 Los acordes');
P('');
for (const m of ['mayor', 'menor']) {
  P(`**En ${m}** (${pc(suma(M.grados[m]) / (suma(M.grados.mayor) + suma(M.grados.menor)))} del tiempo):`);
  P('');
  P(tabla(['Acorde', 'Parte', '', 'Paso', 'Parte'], (() => { const a = topH(M.grados[m], 9), b = topH(M.bigramas[m], 9); return a.map((x, i) => [x[0], pc(x[1]), '', b[i]?.[0] ?? '', b[i] ? pc(b[i][1]) : '']); })()));
  P('');
}
P('### 5.2 Ritmo armónico');
P('');
P(`Mediana de ${num(med(R.map(x => x.r.cambio)), 2)} cambios de acorde por compás. El cambio cae por igual en las tres negras siguientes al 1, y a menudo un acorde dura dos compases.`);
P('');
P('### 5.3 Validación');
P('');
P('La detección de acordes se comparó con cifrados humanos de La Cuerda: *Saludo* de Catalina 2010 coincide compás a compás (la grabación está un semitono arriba del cifrado); *Aporofobia* da La menor con `i V7 i iv` e `I7→iv`, y *Retirada a los faros* da Si menor. Los nueve cifrados de `herramientas/cifrados.js` pesan en la armonía junto con lo detectado.');
P('');
P('## 6. La forma');
P('');
P(tabla(['Tramo', 'A capela al inicio', 'Tempo al entrar', 'Tempo final', 'A capela en el medio', 'Cambios de tono'], FO.map(f => [corto(f.an), f.cap0 ? Math.round(f.cap0) + ' s' : '—', f.t1 ?? '—', f.tN ?? '—', f.capMedio, f.cambios.length])));
P('');
P('La retirada tiene dos velocidades: una parte lenta, un puente a capela y una parte rápida que termina en la bajada. Los tempos de los pasajes a capela no se pueden medir bien: no hay pulso de batería y el coro respira, por eso el generador los pone un poco más lentos y los estira en los finales de frase.');
P('');
P('## 7. Las murgas');
P('');
P(tabla(['Medida', ...MURGAS], Object.keys(RASGOS).filter(k => ['densidad', 'largas', 'repite', 'grado', 'ambito', 'topRepite', 'topSalto', 'cambio', 'tonica', 'cromat', 'voces', 'terceras', 'paralelas', 'span'].includes(k)).map(k => filaR(k))));
P('');
{
  const rep = m => med(R.filter(x => x.an.murga === m).map(x => x.r.repite)), gra = m => med(R.filter(x => x.an.murga === m).map(x => x.r.grado));
  P(`La diferencia más clara es cómo se mueven las líneas: **La Trasnochada recita** (repite nota el ${pc(rep('La Trasnochada'))} de las veces, por grado el ${pc(gra('La Trasnochada'))}) y **Agarrate Catalina camina** (repite el ${pc(rep('Agarrate Catalina'))}, por grado el ${pc(gra('Agarrate Catalina'))}). El generador conserva esa diferencia porque cada murga usa sólo sus gestos.`);
  P('');
}
const epoca = a => (a.anio <= 2012 ? '2008–2012' : '2017–2026');
const cat = R.filter(x => x.an.murga === 'Agarrate Catalina');
if (cat.length) {
  P('Catalina tiene dos épocas en el corpus:');
  P('');
  P(tabla(['Medida', '2008–2012', '2019–2022'], ['densidad', 'largas', 'topRepite', 'cambio', 'voces', 'paralelas'].map(k => [RASGOS[k][1], num(med(cat.filter(x => epoca(x.an) === '2008–2012').map(x => x.r[k])), 2), num(med(cat.filter(x => epoca(x.an) !== '2008–2012').map(x => x.r[k])), 2)])));
  P('');
}
P('## 8. Qué hace el generador con esto');
P('');
P('La primera versión sorteaba nota por nota con tablas aprendidas y sacaba buenos promedios, pero no sonaba a frases: el coro cambiaba de textura a cada golpe y no respiraba. Leer las melodías reales al lado de las generadas mostró lo que ninguna medida veía (reglas 1, 3 y 4 y la sección 4.3). Por eso cambió de raíz:');
P('');
P('1. **Gestos reales.** Aprende celdas de dos compases, de una respiración a la siguiente, con melodía, voces y acordes juntos, relativas a la tónica.');
P("2. **Forma.** Pide las celdas según lo que la forma necesita: `a` pregunta y termina en la dominante, `a'` repite la cabeza y responde en la tónica, `b` contrasta, `a''` vuelve. Con la densidad, el tempo y el momento de la pieza pedidos.");
P('3. **Costuras.** Elige el gesto siguiente por el acorde, la nota y que cada voz de abajo tenga a dónde ir sin saltar.');
P('4. **Variación.** Cada pocas notas cambia una nota débil, como cambia la melodía entre dos versos. Los apoyos no se tocan, y las voces de abajo acompañan en paralelo o se quedan.');
P('5. **Voces.** Canta con muestras de coro "aah", con dos a cuatro cantores por cuerda (la tercia es una voz sola), cada uno con su desafinación, su retraso y su lugar en el estéreo. El timbre se ecualiza hacia el espectro medido de las voces reales (`herramientas/timbre.js`).');
P('');
P('También se probó cantar cada golpe con el recorte de un golpe real con el mismo acorde. Se descartó: el objetivo es el coro en MIDI, con la batería real. Ese código (`motor/voz_real.js` y `transcripcion/banco.py`) quedó en el commit 9f48010.');
P('');
P('## 9. Cómo saber si suena creíble');
P('');
if (jurado) {
  P('### 9.1 El jurado');
  P('');
  P(`Mide ${Object.keys(RASGOS).length} rasgos y puntúa de 0 a 10 según cuánto cae cada uno dentro de lo normal. Cada tramo real se juzga contra los demás. Los dos controles tontos muestran que el jurado no regala nada.`);
  P('');
  P(tabla(['', 'Total', 'Ritmo', 'Melodía', 'Armonía', 'Voces'], jurado.filas.map(f => [f.nombre.replace(/presentacion/, 'presentación').replace(/· (\w+)$/, (_, e) => '· ' + (NOMBRE_ESTILO[e] || e)), ...['total', 'ritmo', 'melodia', 'armonia', 'voces'].map(k => num(f[k]))])));
  P('');
  if (jurado.estilos?.trasnochada) {
    const e = jurado.estilos;
    P('Las notas más bajas de Catalina no son un defecto: el jurado usa una vara hecha sobre todo con La Trasnochada, y lo real de Catalina también baja con ella. Lo justo es juzgar cada estilo contra su murga y contra la otra:');
    P('');
    P(tabla(['', 'Contra La Trasnochada', 'Contra Agarrate Catalina'], [
      ['Motor, estilo Trasnochada', num(e.trasnochada.motor[0]), num(e.trasnochada.motor[1])],
      ['Trasnochada real', num(e.trasnochada.real[0]), num(e.trasnochada.real[1])],
      ['Motor, estilo Catalina', num(e.catalina.motor[0]), num(e.catalina.motor[1])],
      ['Catalina real', num(e.catalina.real[0]), num(e.catalina.real[1])],
    ]));
    P('');
  }
  if (jurado.sinEspiar) {
    P('### 9.2 Sin haber visto');
    P('');
    P(`Se saca un espectáculo entero, se genera con el resto y se mide la distancia a ese espectáculo, en desvíos estándar por rasgo. Mediana del motor: **${num(jurado.sinEspiar.motor, 2)}**. Mediana entre dos espectáculos reales: **${num(jurado.sinEspiar.real, 2)}**. En ${pc(jurado.sinEspiar.filas.filter(f => f.dGen <= f.med).length / jurado.sinEspiar.filas.length)} de los casos el motor queda más cerca del espectáculo que la mediana de los otros espectáculos reales. ${jurado.sinEspiar.motor <= 1.05 * jurado.sinEspiar.real ? 'En estos rasgos, una pieza generada no se distingue de otro espectáculo real.' : 'Está dentro del rango real, sin llegar a confundirse con él.'} El rasgo que más lo separa son los saltos de las líneas interiores, que en lo real casi no existen. Apretar la selección en las costuras entre gestos no los corrigió, así que su origen sigue abierto.`);
    P('');
  }
}
if (copia) {
  P('### 9.3 ¿Copia?');
  P('');
  P(`Se busca el pasaje más largo de cada pieza generada igual a uno del corpus, con los mismos intervalos y el mismo ritmo, en ${copia.piezas} piezas. Mediana ${copia.mediana} notas, máximo ${copia.maximo}. Con celdas de cuatro compases y casi sin variación llegaba a 32 notas: era un collage. Por eso la unidad es de dos compases, y hay un tope de notas seguidas sin cambiar. Las rachas de notas iguales no cuentan: repetir una nota no es copiar.`);
  P('');
}
P('Lo que los números no pueden decir lo dice el oído: si suena a murga lo juzga quien la conoce.');
P('');
P('## 10. Lo que falta medir');
P('');
P('- **Letra y sílabas.** El corpus no tiene texto. Con la letra se podría medir la relación entre acentos y música.');
P('- **Solistas.** Falta separar el solista del coro: el transcriptor los mezcla.');
P('- **Contracantos.** Con voces mezcladas en una pista, las líneas interiores son aproximadas.');
P('- **Más murgas.** Las diferencias entre dos murgas pueden ser de estas murgas y no de un estilo.');
P('');
P('## 11. Cómo usar las herramientas');
P('');
P('```');
P('node herramientas/analizar.js        # de los MIDI a murga_trabajo/analisis/*.json, con un PNG por tramo');
P('node herramientas/revisar.js         # el control de cada tramo: docs/revision_de_los_midis.md');
P('node herramientas/aprender.js        # motor/modelo.js');
P('python transcripcion/pureza.py       # pureza y unísono de cada golpe (regla 12)');
P('node herramientas/jurado.js --ver --sin-espiar');
P('node herramientas/copia.js');
P('node herramientas/informe.js         # este documento');
P('node herramientas/servir.js          # la página, en http://localhost:8123');
P('```');

writeFileSync(join(RAIZ, 'docs', 'analisis_de_los_midis.md'), d);
console.log(`docs/analisis_de_los_midis.md: ${d.split('\n').length} líneas`);
