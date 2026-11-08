// informe_transcriptor.js — escribe docs/transcriptor.md: cuánto se puede confiar en Demucs + MuScriptor, medido con
// coros de notas conocidas (herramientas/coro_de_prueba.mjs + transcripcion/banco_pruebas.py) y con varias tomas del
// mismo espectáculo (herramientas/tomas.js). No se edita a mano.
//   node herramientas/informe_transcriptor.js
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { medir, emparejar } from './comparar_transcripcion.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRUEBAS = join(RAIZ, 'murga_trabajo', 'pruebas');
const pc = x => (x == null || !Number.isFinite(x) ? '—' : (100 * x).toFixed(1).replace('.', ',') + ' %');
const nf = (x, d = 2) => (x == null || !Number.isFinite(x) ? '—' : x.toFixed(d).replace('.', ','));

// todos los casos, por pieza
const piezas = readdirSync(join(PRUEBAS, 'coros')).filter(p => existsSync(join(PRUEBAS, 'coros', p, 'verdad.json')));
const casos = new Map();
for (const p of piezas) {
  const v = JSON.parse(readFileSync(join(PRUEBAS, 'coros', p, 'verdad.json'), 'utf8'));
  const dir = join(PRUEBAS, 'salidas', p);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const t = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const r = medir(v, t.notas);
    r.segundos = t.segundos; r.sdr = t.separacion?.sdr ?? null; r.largo = v.largo; r.cadenas = t.cadenas_cortadas || 0;
    const k = f.replace('.json', '');
    if (!casos.has(k)) casos.set(k, new Map());
    casos.get(k).set(p, r);
  }
}
// una tabla sobre un conjunto fijo de piezas, para que los casos se puedan comparar entre sí
function fila(caso, ps) {
  const m = casos.get(caso); if (!m) return null;
  const rs = ps.map(p => m.get(p)).filter(Boolean);
  if (rs.length < ps.length) return null;
  const s = f => rs.reduce((a, r) => a + f(r), 0);
  const nRef = s(r => r.ref), nEst = s(r => r.est), G = s(r => r.golpes);
  const f1 = k => { const tp = s(r => r[k].r * r.ref); const p = tp / nEst, rr = tp / nRef; return p + rr ? 2 * p * rr / (p + rr) : 0; };
  const sdrs = rs.filter(r => r.sdr != null);
  return {
    caso, f50: f1('f50'), f100: f1('f100'), prec: s(r => r.f100.p * r.est) / nEst, cob: s(r => r.f100.r * r.ref) / nRef,
    octava: s(r => r.octava * r.ref) / nRef, melodia: s(r => r.melodia * r.golpes) / G, bajo: s(r => r.bajo * r.golpes) / G,
    vv: s(r => r.vocesVerdad * r.golpes) / G, ve: s(r => r.vocesEscritas * r.golpes) / G, uv: s(r => r.unaVozVerdad * r.golpes) / G, ue: s(r => r.unaVozEscrita * r.golpes) / G,
    inventadas: s(r => r.inventadas), sdr: sdrs.length ? sdrs.reduce((a, r) => a + r.sdr, 0) / sdrs.length : null,
    velocidad: s(r => r.segundos) / s(r => r.largo), cadenas: s(r => r.cadenas),
  };
}
const NOMBRE = {
  entrada: { voces: 'coro solo, seco', voces_mezcla: 'coro con sala', mezcla: 'coro y batería', mezcla_fuerte: 'batería fuerte', tv: 'batería, público y Opus' },
  sep: { ninguno: 'sin separar', htdemucs_ft: 'htdemucs_ft', htdemucs: 'htdemucs', htdemucs_ft_s4: 'htdemucs_ft ×4', htdemucs_6s: 'htdemucs_6s' },
};
const describir = c => { const [e, s, t] = c.split('__'); return `${NOMBRE.entrada[e] || e} · ${NOMBRE.sep[s] || s} · ${t.replace(/_/g, ', ').replace('cfg', 'cfg=').replace('beam', 'haz=').replace('desfase', 'desfase=')}`; };
function tabla(lista, ps) {
  const L = ['| Caso | F1 ±100 ms | ±50 ms | Precisión | Cobertura | Octava | Melodía | Bajo | Voces por golpe (verdad → escritas) | Golpes a una voz | Inventadas | SDR voces | Tiempo por s de audio |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const c of lista) { const r = fila(c, ps); if (!r) continue; L.push(`| ${describir(c)} | **${pc(r.f100)}** | ${pc(r.f50)} | ${pc(r.prec)} | ${pc(r.cob)} | ${pc(r.octava)} | ${pc(r.melodia)} | ${pc(r.bajo)} | ${nf(r.vv)} → ${nf(r.ve)} | ${pc(r.uv)} → ${pc(r.ue)} | ${r.inventadas} | ${r.sdr == null ? '—' : nf(r.sdr, 1) + ' dB'} | ${nf(r.velocidad)} s |`); }
  return L.join('\n');
}
const sesgo = existsSync(join(PRUEBAS, 'sesgo_tv__htdemucs_ft__medium.json')) ? JSON.parse(readFileSync(join(PRUEBAS, 'sesgo_tv__htdemucs_ft__medium.json'), 'utf8')) : null;
const base5 = ['p1', 'p2', 'p3', 'p4', 'p5'], var3 = ['p1', 'p2', 'p3'];
const todos = [...casos.keys()];
const L = [];
L.push('# ¿Cuánto se puede confiar en el transcriptor?', '',
  'Este documento lo escribe `node herramientas/informe_transcriptor.js`: no se edita a mano.', '',
  'Todo el corpus sale de separar las voces con Demucs y transcribirlas con MuScriptor. Para saber cuánto se equivocan, y si las perillas que nunca se tocaron cambian algo, se hicieron dos cosas:', '',
  '1. **Un coro con las notas conocidas.** El motor compone cinco piezas (presentaciones y retiradas, mayor y menor) y los trece cantores sintéticos las cantan, con letra. Se guarda cada nota de cada cantor. Las piezas se mezclan como suena una murga: con sala, con la batería real al nivel mediano del corpus (8,7 dB debajo del coro, medido en los 41 tramos) y con público y la compresión de YouTube (Opus a 128 kb/s). Después pasan por la misma cadena que las murgas reales, con distintas perillas, y lo transcripto se compara nota por nota con la verdad (`herramientas/comparar_transcripcion.js`).',
  '2. **Varias tomas del mismo espectáculo** (sección 4): otras noches, otras cámaras, la tribuna y el disco. Lo que coincide entre noches distintas es la murga; lo que no, es sobre todo el transcriptor.', '',
  '> Un coro sintético no es un coro de verdad: canta más parejo y su timbre es otro. Los números de la sección 1 a 3 son una cota: lo que el transcriptor pierde con un coro que conoce poco. La sección 4 es con murgas reales.', '');
L.push('## Cómo funcionan', '',
  '**Demucs** (`htdemucs_ft`) separa una grabación en cuatro pistas: voces, batería, bajo y "el resto". Es una red que mira a la vez la forma de onda y el espectrograma, y la versión `_ft` son cuatro redes, una afinada para cada pista. Aprendió con música pop y rock (MUSDB). Por eso la batería de murga no le resulta familiar: buena parte del bombo, los platillos y el redoblante va a parar a "el resto", y en el corpus la percusión se toma como todo lo que no es voz. Las voces sí las separa bien: en el banco quedan a 10-11 dB de las verdaderas (SDR), un valor bueno para música real.', '',
  '**MuScriptor** es un traductor de audio a notas, como los de texto, de la familia de MT3. Corta el audio en pedazos de 5 s y, para cada uno, escribe una ficha por vez: "empieza la nota 62", "pasaron 40 ms", "termina la 62"… Elige siempre la ficha más probable (búsqueda voraz). Al pedazo siguiente le pasa las notas que quedaron sonando. De ahí salen sus fallas:', '',
  '- **La cadena.** Si un pedazo sale mal y deja muchas notas abiertas, el siguiente las hereda y la basura se arrastra. Por eso `murga_lote.py` corta la cadena cuando hay más de 8 abiertas.', '',
  '- **Las trabas.** Sobre habla, aplausos o pasajes casi inaudibles, a veces repite un acorde a tiempo fijo. Las saca `limpiar.js`.', '',
  '- **El ataque adelantado.** Marca el comienzo de la nota en la consonante, no en la vocal: en el banco, 19-31 ms antes en la mediana y más de 70 ms antes en el 10 % de las notas. La grilla del análisis lo absorbe.', '',
  '- **Sílabas repetidas.** Dos sílabas seguidas en la misma nota a veces quedan como una nota larga. En el banco pierde el 15 % de las notas repetidas, contra el 10 % del resto.', '',
  '- **Pocas octavas equivocadas.** Las notas a una octava de la verdadera son el 0,2-0,5 %.', '',
  'Las perillas que se pueden tocar, y que nunca se habían tocado, son el tamaño del modelo (small, medium, large), la búsqueda con haz (`beam`: probar varias secuencias de fichas en vez de la más probable), la guía (`cfg`: cuánto se ata al audio contra lo que "espera" de la música) y dónde caen los cortes de 5 s. La sección 2 las prueba.', '');
L.push('## 1. De dónde sale el error', '', 'Las cinco piezas (13 minutos, ' + piezas.filter(p => base5.includes(p)).length + ' piezas). Una nota está bien si el ataque cae a menos de 100 ms y la nota es la misma. Con trece cantores, cada uno entra hasta 30-50 ms corrido y la consonante va antes del tiempo, así que ±50 ms es muy estricto para un coro: se muestra también.', '',
  tabla(['voces__ninguno__medium', 'mezcla__ninguno__medium', 'tv__ninguno__medium', 'mezcla__htdemucs_ft__medium', 'tv__htdemucs_ft__medium'], base5), '');
L.push('## 2. Las perillas', '', 'Sobre tres piezas (' + var3.join(', ') + '), con batería, público y Opus, separado con htdemucs_ft salvo que diga otra cosa.', '',
  tabla(['voces_mezcla__ninguno__medium', 'tv__htdemucs_ft__medium', ...todos.filter(c => c.startsWith('tv__') && c !== 'tv__htdemucs_ft__medium' && c !== 'tv__ninguno__medium')], var3), '');
// dos pasadas del mismo audio con los cortes de 5 s corridos: ¿escriben lo mismo?
{
  let n = 0, n100 = 0, na = 0, nb = 0, cerca = 0, sinPar = 0, piezasD = 0;
  const comb = { y: [], o: [] };
  for (const p of var3) {
    const fa = join(PRUEBAS, 'salidas', p, 'tv__htdemucs_ft__medium.json'), fb = join(PRUEBAS, 'salidas', p, 'tv__htdemucs_ft__medium_desfase2.5.json');
    if (!existsSync(fa) || !existsSync(fb)) continue;
    piezasD++;
    const A = JSON.parse(readFileSync(fa, 'utf8')).notas.map(([t0, t1, q]) => ({ t0, t1, p: q })), B = JSON.parse(readFileSync(fb, 'utf8')).notas.map(([t0, t1, q]) => ({ t0, t1, p: q }));
    const r = emparejar(A, B, .06); n += r.pares.length; n100 += emparejar(A, B, .1).pares.length; na += A.length; nb += B.length;
    A.forEach((x, i) => { if (r.ur[i]) return; sinPar++; const d1 = x.t0 % 5, d2 = (x.t0 + 2.5) % 5; if (Math.min(d1, 5 - d1, d2, 5 - d2) < .5) cerca++; });
  }
  if (piezasD) L.push('**¿Escribe siempre lo mismo?** Casi. El mismo audio, pasado dos veces con los cortes de 5 s corridos 2,5 s, da transcripciones que coinciden en el ' + pc(2 * n100 / (na + nb)) + ' de las notas a ±100 ms, la misma vara que contra la verdad, y en el ' + pc(2 * n / (na + nb)) + ' a ±60 ms. Lo que cambia de una pasada a la otra es sobre todo el momento exacto del ataque, en hasta 100 ms, y no tanto qué nota escribe. Las diferencias no se juntan cerca de los cortes: el ' + pc(cerca / sinPar) + ' de las notas sin par a ±60 ms cae a menos de 0,5 s de un corte, cuando al azar sería el 40 %. Como las dos pasadas aciertan lo mismo contra la verdad (89 %) y coinciden más que eso entre ellas, los errores son en buena parte los mismos: el transcriptor se equivoca siempre en los mismos lugares. Por eso juntar dos pasadas no mejora. Quedarse con lo que coincide sube la precisión pero pierde un cuarto de las notas, y sumar todo hace lo contrario.', '');
}
L.push('Ninguna perilla le gana a lo que ya se usaba (htdemucs_ft y MuScriptor medium, búsqueda voraz): el haz, la guía, los cortes corridos y htdemucs quedan a medio punto o menos, y algunas tardan hasta cuatro veces más. El modelo small es 2,4 veces más rápido pero acierta 3 puntos menos, y la melodía 5,5 menos. El modelo large no se pudo probar: sus pesos piden aceptar la licencia en https://huggingface.co/MuScriptor/muscriptor-large con la cuenta de Hugging Face.', '');
const conVar = todos.filter(c => ['p1b', 'p3b'].every(p => casos.get(c).has(p)));
if (conVar.length) L.push('Con la variación entre cantores que ajustó `banco_ajustar.py` (más desafinación y retraso entre cantores, como mide el coro real), en dos piezas:', '', tabla(conVar, ['p1b', 'p3b']), '');
if (sesgo) {
  L.push('## 3. ¿Qué rasgos del análisis mueve el transcriptor?', '', 'Cada rasgo del jurado se calcula dos veces en las cinco piezas: con las notas verdaderas, en su grilla exacta, y con lo que escribe la cadena completa (batería, público, Opus, htdemucs_ft, MuScriptor, la grilla sacada de los ataques y la limpieza de siempre). La diferencia está en anchos de la norma del jurado: menos de 1 no cambia la nota del jurado de forma apreciable (`herramientas/sesgo_transcriptor.js`).', '',
    '| Rasgo | Qué mide | Verdad | Escrito | Sesgo |', '|---|---|---|---|---|');
  for (const r of sesgo.slice(0, 14)) L.push(`| ${r.k} | ${r.nombre} | ${nf(r.verdad)} | ${nf(r.escrito)} | ${nf(r.sesgo, 1)} |`);
  L.push('');
}
const tm = join(RAIZ, 'docs', 'tomas.md');
if (existsSync(tm)) L.push('## 4. Varias tomas del mismo espectáculo', '', 'El detalle está en [tomas.md](tomas.md).', '');
writeFileSync(join(RAIZ, 'docs', 'transcriptor.md'), L.join('\n') + '\n');
console.log(L.join('\n'));
void spawnSync;
