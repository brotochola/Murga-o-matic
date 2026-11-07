// Paso 6: la revisión de cada MIDI. Mide si lo transcripto se comporta como un coro y da un veredicto.
// Deja docs/revision_de_los_midis.md; lo que queda marcado se mira a mano en murga_trabajo/revision/.
//   node herramientas/revisar.js
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './corpus.js';
import { cargarAnalisis } from './medir.js';

const mod = (a, n) => ((a % n) + n) % n;
const ESC = { 1: [0, 2, 4, 5, 7, 9, 11], 0: [0, 2, 3, 5, 7, 8, 10, 11] };
const TRIADAS = [];
for (let r = 0; r < 12; r++) for (const iv of [[0, 4, 7], [0, 3, 7]]) TRIADAS.push(iv.map(i => (r + i) % 12));

// Qué tanto de lo que suena en una ventana entra en una sola tríada
export function ajusteTriada(notas) {
  const h = new Array(12).fill(0); let tot = 0;
  for (const n of notas) { const d = Math.min(1.5, n.dur); h[n.p % 12] += d; tot += d; }
  if (!tot) return 1;
  return Math.max(...TRIADAS.map(t => (h[t[0]] + h[t[1]] + h[t[2]]) / tot));
}

export function revisar(an) {
  const N = an.notas.map(([b, fin, p, t]) => ({ b, fin, p, t, dur: fin - b }));
  const largo = an.largo_s;
  let fuera = 0, enAcorde = 0, tot = 0;
  for (const n of N) {
    const a = an.acordes[Math.min(an.acordes.length - 1, Math.floor(n.b))];
    if (!a) continue;
    const iv = mod(n.p - a[2], 12);
    tot += n.dur;
    if (!ESC[a[3]].includes(iv)) fuera += n.dur;
    const ivA = mod(n.p - a[0], 12);
    if ([0, 3, 4, 7, 10].includes(ivA)) enAcorde += n.dur;
  }
  // choques que quedaron
  let choques = 0;
  const orden = [...N].sort((a, b) => a.b - b.b);
  for (let i = 0; i < orden.length; i++) for (let j = i + 1; j < orden.length && orden[j].b < orden[i].fin; j++) {
    const d = Math.abs(orden[i].p - orden[j].p);
    if (d === 1 || d === 11 || d === 13) choques++;
  }
  // ventanas de 4 segundos: ¿forman acorde, o son notas sueltas de un pasaje hablado?
  const flojas = []; let ventanas = 0, sonando = 0;
  for (let t = 0; t + 4 <= largo; t += 2) {
    const v = N.filter(n => n.t >= t && n.t < t + 4);
    ventanas++;
    if (v.length >= 3) sonando++;
    if (v.length < 6) continue;
    const f = ajusteTriada(v);
    if (f < .5) flojas.push(t);
  }
  const ps = N.map(n => n.p).sort((a, b) => a - b);
  // ¿Demucs encontró las voces? Si la pista de voces casi no tiene energía, lo transcripto no es el coro
  const e = an.energia, sum = a => a.reduce((x, y) => x + y * y, 0);
  const vozSobreResto = sum(e.vocals) / Math.max(1e-9, sum(e.other) + sum(e.drums) + sum(e.bass || []));
  const vozQuieta = e.vocals.filter(v => v < .012).length / e.vocals.length;
  const r = {
    nombre: an.nombre, notas: N.length,
    quitadas: Object.values(an.quitadas).reduce((a, b) => a + b, 0) / Math.max(1, N.length),
    fuera: fuera / Math.max(1e-9, tot), enAcorde: enAcorde / Math.max(1e-9, tot),
    choques: choques / Math.max(1, N.length), ajuste: an.ajuste.corchea, libre: an.ajuste.libre,
    sonando: sonando / Math.max(1, ventanas), flojas: flojas.length / Math.max(1, sonando), segFlojos: flojas,
    grave: ps[Math.floor(ps.length * .01)], agudo: ps[Math.floor(ps.length * .99)],
    vozSobreResto, vozQuieta,
  };
  const alertas = [];
  if (r.quitadas > .1) alertas.push(an.quitadas.trabado > .6 * Object.values(an.quitadas).reduce((a, b) => a + b, 0) ? 'recitado o trabas' : 'muchas notas quitadas');
  if (r.fuera > .12) alertas.push('muchas notas fuera de la escala');
  if (r.enAcorde < .6) alertas.push('poco ajuste a los acordes');
  if (r.flojas > .15) alertas.push('pasajes que no forman acorde');
  if (r.ajuste < .3) alertas.push('la grilla calza mal');
  if (r.grave < 41 || r.agudo > 79) alertas.push('registro raro');
  if (vozQuieta > .3) alertas.push('Demucs perdió las voces');
  r.alertas = alertas;
  return r;
}

if (process.argv[1]?.endsWith('revisar.js')) {
  const L = cargarAnalisis().sort((a, b) => a.nombre.localeCompare(b.nombre));
  const R = L.map(revisar);
  const pc = x => (100 * x).toFixed(1).padStart(5);
  console.log('tramo'.padEnd(44) + 'notas quit% fuera acord choq  aj8  flojo  reg  vozQ  alertas');
  for (const r of R) console.log(r.nombre.padEnd(44) + String(r.notas).padStart(5) + pc(r.quitadas) + pc(r.fuera) + pc(r.enAcorde) + pc(r.choques) + r.ajuste.toFixed(2).padStart(6) + pc(r.flojas) + `  ${r.grave}-${r.agudo} ` + pc(r.vozQuieta) + '  ' + r.alertas.join(', '));
  mkdirSync(join(RAIZ, 'docs'), { recursive: true });
  let md = '# Revisión de los MIDI\n\nCada tramo, medido después de la limpieza. `fuera`: tiempo de notas fuera de la escala. `acorde`: tiempo de notas que entran en el acorde detectado. `choques`: pares a un semitono por nota. `flojo`: ventanas de 4 segundos que no forman ninguna tríada, señal de pasaje hablado. `Quitadas`: las notas que sacó la limpieza; donde dice *recitado o trabas*, casi todas son acordes repetidos a máquina que el transcriptor inventa sobre habla o pasajes inaudibles. Los PNG de cada tramo están en `murga_trabajo/revision/`: en rojo, lo que se sacó.\n\n';
  md += '| Tramo | Notas | Quitadas | Fuera | Acorde | Choques | Grilla | Flojo | Registro | Veredicto |\n|---|---|---|---|---|---|---|---|---|---|\n';
  for (const r of R) md += `| ${r.nombre} | ${r.notas} | ${pc(r.quitadas).trim()} % | ${pc(r.fuera).trim()} % | ${pc(r.enAcorde).trim()} % | ${pc(r.choques).trim()} % | ${r.ajuste.toFixed(2)} | ${pc(r.flojas).trim()} % | ${r.grave}–${r.agudo} | ${r.alertas.length ? r.alertas.join(', ') : 'bien'} |\n`;
  writeFileSync(join(RAIZ, 'docs', 'revision_de_los_midis.md'), md);
}
