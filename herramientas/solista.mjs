// solista.mjs — un cantor solo, cantando frases conocidas, para medir si se entiende lo que dice.
// Las frases son nuestras (no son letras de murga) y la melodía es simple: una sílaba por corchea, la última larga.
// Sale un wav por frase en murga_trabajo/solista/<motor>/, y herramientas/solista_jurado.py las transcribe y las
// compara con el texto.
//
//   node herramientas/solista.mjs [--motor formantes|difonos:es2[:opción=valor...]|mbrola:es2] [--tempo 100] [--midi 0]
//     difonos:es2:consonantes=1.1:vibrato=.2   el cantor de la página (motor/cantor/difonos.js) con esas opciones
//     mbrola:es2                               el primer guion, más simple, con el programa mbrola instalado
//     banco --banco <carpeta>                  un banco de voz cantada de UTAU (motor/cantor/banco.js, docs/utau.md)
//     --habla                                  dicha en lugar de cantada (prosodia de habla, sin vibrato)
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { silabasCantadas, partes } from '../motor/cantor/letra.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TRABAJO = resolve(process.env.MURGA_TRABAJO || join(RAIZ, 'murga_trabajo'));
const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const MOTOR = arg('motor', 'formantes'), TEMPO = +arg('tempo', 100), SUBE = +arg('midi', 0), HABLA = args.includes('--habla');
const SAL = resolve(arg('salida', join(TRABAJO, 'solista', (HABLA ? 'habla_' : '') + MOTOR.replace(/[:/]/g, '_').replace(/=/g, ''))));
mkdirSync(SAL, { recursive: true });

export const FRASES = [
  'Vengo a cantarle al barrio que me vio crecer',
  'La luna se asoma detrás del tablado',
  'Los gurises corren descalzos por la vereda',
  'Mi vieja tendía la ropa en el fondo',
  'Se apagan las luces y empieza la fiesta',
  'Un perro dormido junto a la parrilla',
  'Llegó el carnaval con su bombo y platillo',
  'Fumando en la esquina esperaba el ómnibus',
  'Con la garganta rota cantamos igual',
  'Que nadie nos quite la alegría del pueblo',
  'El viento de enero nos trae la noticia',
  'Tres copas de vino y un beso robado',
  'Mañana temprano se va la comparsa',
  'El chiquilín vende diarios en la feria',
  'Pintamos la cara de blanco y de rojo',
  'Una gaviota cruzaba la rambla',
  'La radio del almacén pasaba un tango',
  'Juntamos las monedas para el colectivo',
  'Mi abuelo contaba historias del puerto',
  'La lluvia golpeaba el techo de chapa',
  'Seguimos cantando aunque nadie nos mire',
  'El último tren se perdió en la neblina',
  'Bailamos descalzos en medio de la calle',
  'Volvemos a casa con el sol en la espalda',
];

// Melodía: Sol mayor, registro de tenor (Sol 3 a Mi 4). Arco: sube y baja, cambia de nota cada una o dos sílabas.
const ESCALA = [55, 57, 59, 60, 62, 64, 66, 67];
const grado = i => [55, 57, 59, 60, 62, 64, 66][((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
// grados: la misma melodía corrida por la escala (−2: una tercera abajo, como los segundos)
export function melodia(texto, { tempo = TEMPO, inicio = .35, sube = SUBE, grados = 0 } = {}) {
  const sils = silabasCantadas(texto);
  const corchea = 30 / tempo;
  const ultAcento = sils.map(s => s.acento).lastIndexOf(true);
  const notas = [];
  let t = inicio;
  sils.forEach((s, i) => {
    const p = i / Math.max(1, sils.length - 1);
    let g = Math.round(1 + 4 * Math.sin(Math.PI * Math.min(1, p * 1.15)) + (i % 3 === 2 ? 1 : 0));
    if (i >= ultAcento) g = i === ultAcento ? 1 : 0;
    let d = corchea;
    if (i === ultAcento) d = sils.length - 1 > i ? corchea * 3 : corchea * 5;
    else if (i > ultAcento) d = corchea * 3;
    else if (s.acento && i % 2 === 1) d = corchea * 1.5;
    notas.push({ t0: t, t1: t + d, midi: grado(Math.max(0, Math.min(7, g)) + grados) + sube, vel: s.acento ? .85 : .75, sil: { ...partes(s.fon), fin: s.fin, articulo: s.articulo, acento: s.acento }, texto: s.texto, fon: s.fon });
    t += d;
  });
  return notas;
}

// Habla: la misma frase dicha, no cantada. Cada sílaba dura lo que dura hablando (las acentuadas más, la última
// todavía más), la altura baja de a poco a lo largo de la frase (declinación), sube en las acentuadas y cae al final.
// Sirve para separar lo que se pierde por cómo pronuncia de lo que se pierde por cantar.
export function habla(texto, { inicio = .35, ritmo = 1 } = {}) {
  const sils = silabasCantadas(texto, { sinalefa: true });
  const ultAcento = sils.map(s => s.acento).lastIndexOf(true);
  const notas = [];
  let t = inicio;
  sils.forEach((s, i) => {
    const p = i / Math.max(1, sils.length - 1), largo = s.fon.length;
    let d = (.1 + .03 * largo) * (s.acento ? 1.25 : 1) * (i >= ultAcento ? 1.3 : 1) * ritmo;
    if (i === sils.length - 1) d *= 1.4;
    let m = 47.5 - 3 * p + (s.acento ? 1.5 : 0);
    if (i === ultAcento) m += .8;
    if (i > ultAcento) m -= 2.5 * (i - ultAcento);
    notas.push({ t0: t, t1: t + d, midi: m, vel: .8, sil: { ...partes(s.fon), fin: s.fin, articulo: s.articulo, acento: s.acento }, texto: s.texto, fon: s.fon });
    t += d;
  });
  return notas;
}
// lo que no se usa hablando
export const HABLADO = { vibrato: 0, temblor: 0, deriva: .03, pique: 0, caida: 0, golpe: 0, arco: 0, consonantes: 1.4, brillo: 0 };

const wav = (ruta, x, sr) => {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  sr = Math.round(sr); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  writeFileSync(ruta, b);
};
const normalizar = (x, pico = .8) => { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); const g = m > 0 ? pico / m : 1; return x.map(v => v * g); };

// ── MBROLA: de nuestros fonemas a los de las voces castellanas (SAMPA) ──
const A_SAMPA = { a: 'a', e: 'e', i: 'i', o: 'o', u: 'u', j: 'i', w: 'u', l: 'l', r: 'r', R: 'rr', m: 'm', n: 'n', N: 'J', B: 'b', D: 'd', G: 'g', b: 'b', d: 'd', g: 'g', p: 'p', t: 't', k: 'k', C: 'tS', f: 'f', s: 's', h: 's', x: 'x', S: 'jj', Z: 'jj' };
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function pho(notas, { vibrato = .12, vel = 5.6, sinW = false } = {}) {
  // cada sílaba: las consonantes del ataque antes del tiempo, la vocal hasta el final de la nota, la coda al final
  const L = [];
  const dur = { p: 70, t: 65, k: 75, b: 55, d: 50, g: 55, tS: 90, f: 85, s: 80, x: 85, m: 60, n: 55, J: 70, l: 55, L: 70, r: 30, rr: 80, jj: 75, i: 45, u: 45 };
  let t = 0;
  const empezar = notas[0].t0 - notas[0].sil.ataque.reduce((a, p) => a + (dur[A_SAMPA[p]] || 60) / 1000, 0);
  L.push(`_ ${Math.round(Math.max(.05, empezar) * 1000)}`); t = Math.max(.05, empezar);
  notas.forEach((n, i) => {
    const sig = notas[i + 1];
    const ata = sig ? sig.sil.ataque.map(p => A_SAMPA[p]) : [];
    const tAtaSig = ata.reduce((a, p) => a + (dur[p] || 60) / 1000, 0);
    const f = hz(n.midi), fSig = sig ? hz(sig.midi) : f;
    // el núcleo: semivocales cortas, la vocal larga
    const nuc = n.sil.nucleo.map(p => ({ p, s: A_SAMPA[p] === 'u' && !sinW && p === 'w' ? 'w' : A_SAMPA[p], larga: 'aeiou'.includes(p) }));
    const coda = n.sil.coda.map(p => A_SAMPA[p]);
    const tCoda = coda.reduce((a, p) => a + (dur[p] || 60) / 1000, 0);
    const fin = n.t1 - tAtaSig - tCoda;
    const tCortas = nuc.filter(x => !x.larga).length * .045;
    const largas = nuc.filter(x => x.larga);
    const cadaL = Math.max(.04, (fin - t - tCortas) / Math.max(1, largas.length));
    for (const x of nuc) {
      const d = x.larga ? cadaL : .045;
      const puntos = [];
      if (x.larga && d > .25) {
        // vibrato: entra a los 0,2 s, de a poco
        for (let q = 0; q <= 1.0001; q += Math.min(1, .025 / d)) {
          const tt = q * d, a = Math.max(0, Math.min(1, (tt - .2) / .3));
          puntos.push(`${Math.round(q * 100)} ${(f * Math.pow(2, vibrato * a * Math.sin(2 * Math.PI * vel * tt) / 12)).toFixed(1)}`);
        }
      } else puntos.push(`0 ${f.toFixed(1)}`, `100 ${f.toFixed(1)}`);
      L.push(`${x.s} ${Math.round(d * 1000)} ${puntos.join(' ')}`); t += d;
    }
    for (const p of coda) { const d = (dur[p] || 60) / 1000; L.push(`${p} ${Math.round(d * 1000)} 0 ${f.toFixed(1)} 100 ${f.toFixed(1)}`); t += d; }
    if (sig) {
      const hueco = sig.t0 - tAtaSig - t;
      if (hueco > .03) { L.push(`_ ${Math.round(hueco * 1000)}`); t += hueco; }
      for (const p of ata) { const d = (dur[p] || 60) / 1000; L.push(`${p} ${Math.round(d * 1000)} 0 ${fSig.toFixed(1)} 100 ${fSig.toFixed(1)}`); t += d; }
    }
  });
  L.push('_ 300');
  return L.join('\n') + '\n';
}

async function cantarFrase(notas) {
  if (MOTOR === 'formantes') {
    const { cantar } = await import('../motor/cantor/cantor.js');
    const sr = 32000;
    const x = cantar(notas, { sr, tipo: 'tenor', semilla: 3, variacion: { desfase: 0, retraso: 0, desafinacion: 0, desafinaNota: 0 } });
    return { x, sr };
  }
  if (MOTOR.startsWith('formantes2')) {
    const { cantar } = await import('../motor/cantor/solista.js');
    const sr = 32000;
    return { x: cantar(notas, { sr, semilla: 3 }), sr };
  }
  if (MOTOR.startsWith('mbrola:')) {
    const voz = MOTOR.split(':')[1];
    const txt = pho(notas, { sinW: voz === 'es4' });
    const tmp = join(SAL, '_tmp.pho'); writeFileSync(tmp, txt);
    const sal = join(SAL, '_tmp.wav');
    execFileSync('mbrola', ['-e', `/usr/share/mbrola/${voz}/${voz}`, tmp, sal], { stdio: ['ignore', 'ignore', 'pipe'] });
    return { archivo: sal, pho: txt };
  }
  if (MOTOR.startsWith('difonos:')) {
    // lo mismo que la página: difonos.js arma el guion y MBROLA (el WebAssembly de motor/vendor) pega los difonos
    const [, voz, ...extra] = MOTOR.split(':');
    const opc = Object.fromEntries(extra.map(e => e.split('=')).map(([k, v]) => [k, +v]));
    const { cantarDifonos } = await import('../motor/cantor/difonos.js');
    const mb = await vozMbrola(voz);
    const r = cantarDifonos(mb, notas, { w: voz !== 'es4', semilla: 3, voz, ...(HABLA ? HABLADO : {}), ...opc });
    return { x: r.x, sr: r.sr };
  }
  if (MOTOR === 'banco' || MOTOR.startsWith('banco:')) {
    // un banco de UTAU (motor/cantor/banco.js con WORLD): la carpeta del banco va en --banco
    const { cantarBanco } = await import('../motor/cantor/banco.js');
    const { banco, world } = await bancoUtau();
    const opc = Object.fromEntries(MOTOR.split(':').slice(1).map(e => e.split('=')).map(([k, v]) => [k, +v]));
    const r = cantarBanco(banco, world, notas, { semilla: 3, cache: cacheBanco, ...(HABLA ? HABLADO : {}), ...opc });
    return { x: r.x, sr: r.sr };
  }
  throw new Error('motor desconocido: ' + MOTOR);
}

let elBanco = null; const cacheBanco = new Map();
async function bancoUtau() {
  if (elBanco) return elBanco;
  const carpeta = arg('banco');
  if (!carpeta || !existsSync(carpeta)) throw new Error('falta --banco <carpeta del banco de UTAU>');
  const { readdirSync, statSync } = await import('node:fs');
  const { relative } = await import('node:path');
  const { crearBanco } = await import('../motor/cantor/banco.js');
  const { crearWorld } = await import('../motor/cantor/world.js');
  const rutas = [];
  (function andar(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) andar(p); else rutas.push(relative(carpeta, p).split(/[\\/]/).join('/')); } })(carpeta);
  const banco = crearBanco(rutas, r => { try { return new Uint8Array(readFileSync(join(carpeta, r))); } catch { return null; } });
  const world = await crearWorld(readFileSync(join(RAIZ, 'motor', 'vendor', 'world', 'world.wasm')));
  return (elBanco = { banco, world });
}

// las voces: la de la página (motor/vendor/mbrola) o las del paquete mbrola-esN de Debian y Ubuntu
const voces = {};
async function vozMbrola(voz) {
  if (voces[voz]) return voces[voz];
  const { crearMbrola } = await import('../motor/cantor/mbrola.js');
  const ruta = [join(RAIZ, 'motor', 'vendor', 'mbrola', voz), `/usr/share/mbrola/${voz}/${voz}`].find(existsSync);
  if (!ruta) throw new Error(`no encuentro la voz ${voz} de MBROLA`);
  return (voces[voz] = await crearMbrola(readFileSync(join(RAIZ, 'motor', 'vendor', 'mbrola', 'mbrola.wasm')), readFileSync(ruta)));
}

// Sólo si se corre directo (otros scripts importan FRASES y melodia)
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await principal();

async function principal() {
const lista = [];
for (const [k, texto] of FRASES.entries()) {
  const notas = HABLA ? habla(texto) : melodia(texto);
  const r = await cantarFrase(notas);
  const nombre = String(k + 1).padStart(2, '0') + '.wav';
  if (r.archivo) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', r.archivo, '-af', 'loudnorm=I=-20:TP=-2', '-ar', '32000', join(SAL, nombre)]);
    writeFileSync(join(SAL, nombre.replace('.wav', '.pho')), r.pho);
  } else wav(join(SAL, nombre), normalizar(r.x), r.sr);
  if (r.pho && !r.archivo) writeFileSync(join(SAL, nombre.replace('.wav', '.pho')), r.pho);
  lista.push({ archivo: nombre, texto, notas: notas.map(n => ({ t0: +n.t0.toFixed(3), t1: +n.t1.toFixed(3), midi: n.midi, sil: n.texto })) });
}
writeFileSync(join(SAL, 'frases.json'), JSON.stringify({ motor: MOTOR, tempo: TEMPO, frases: lista }, null, 1));
console.log(`${lista.length} frases → ${SAL}`);
}
