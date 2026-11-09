// verificar.mjs — que la versión liviana (offline/, herramientas/construir.mjs) esté completa y al día antes de
// publicarla (herramientas/publicar.mjs la corre antes de subir):
//
//   1. al día: construido.json tiene la huella de cada archivo que se usó para armarla; si alguno cambió, apareció o se
//      fue (o cambiaron las herramientas que la arman), está atrasada → npm run offline
//   2. completa: cada archivo de su offline.json está, con su tamaño y su resumen; sw.js tiene la versión de
//      offline.json; están .nojekyll y las licencias de lo que se redistribuye
//   3. los bancos: cada banco del plantel está en offline/bancos/ y se abre; sus .wav van en Opus; tiene las mismas
//      entradas y reclist que el entero (si el entero está en bancos/), y unas murgas nuevas (otras semillas que las
//      del recorte) le piden los mismos pedazos que al entero: si no, el recorte quedó viejo → npm run bancos
//   4. los créditos: cada banco que se publica tiene su autor y un link a su página (los autores piden que se los
//      mencione con un link), y la página los muestra (#creditosBancos en index.html y en motor/plantel.js)
//   5. los topes de GitHub: ningún archivo de 100 MB o más (avisa desde 50) y el sitio publicado, menos de 1 GB
//   6. en Chrome sin ventana, sobre offline/: probar_pagina.mjs (la página entera, sin errores) y probar_voces.mjs
//      (canta con MBROLA y con un banco en Opus, decodificado con WebCodecs)
//
//   node herramientas/verificar.mjs [--rapido] [--piezas 3]     (npm run verificar; --rapido: sin Chrome)
// Sale con 1 si algo falla.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { RAIZ, SALIDA, SOLO_COMPU, TOPE_ARCHIVO, AVISO_ARCHIVO, TOPE_SITIO, huella, plantel, MB, git } from './liviana.mjs';
import { archivosDelBanco } from './banco_node.mjs';
import { leerZip, extraer } from '../motor/cantor/zip.js';
import { esOgg } from '../motor/cantor/opus.js';
import { crearBanco, frasesDe } from '../motor/cantor/banco.js';
import { correr } from '../motor/cantor/difonos.js';
import { medirAlturas } from '../motor/cantor/bancos.js';
import { crearWorld } from '../motor/cantor/world.js';
import { prepararMurga, repartir, LUGARES } from '../motor/cantor/murga_bancos.js';
import { CLAVES } from '../motor/cantor/lexico.js';
import { MODELO } from '../motor/modelo.js';

const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const RAPIDO = args.includes('--rapido'), NPIEZAS = +arg('piezas', 3);
const reloj = Date.now(), seg = () => ((Date.now() - reloj) / 1000).toFixed(0) + ' s';
let mal = 0, ojo = 0;
const ok = (c, t) => { console.log(`${c ? 'bien' : 'MAL '}  ${t}`); if (!c) mal++; return c; };
const aviso = t => { console.log(`ojo   ${t}`); ojo++; };
const titulo = t => console.log(`\n── ${t}`);
const S = p => join(SALIDA, p);

if (!existsSync(S('offline.json')) || !existsSync(S('construido.json'))) {
  console.error(`No está armada la versión liviana en ${SALIDA}: npm run offline (y npm run bancos, para los bancos).`);
  process.exit(1);
}
const PL = plantel();
const publicables = PL.bancos.filter(b => b.publicable === true);

// ── 1. al día ──
titulo('1. al día con el repositorio');
const hecho = JSON.parse(readFileSync(S('construido.json'), 'utf8')), ahora = huella();
const cambiados = Object.keys(ahora).filter(r => r in hecho.huella && hecho.huella[r] !== ahora[r]);
const nuevos = Object.keys(ahora).filter(r => !(r in hecho.huella)), idos = Object.keys(hecho.huella).filter(r => !(r in ahora));
const lista = (l, n = 6) => l.slice(0, n).join(', ') + (l.length > n ? ` y ${l.length - n} más` : '');
let head = ''; try { head = git(RAIZ, 'rev-parse', '--short', 'HEAD'); } catch { /* sin git */ }
const cuando = d => { const x = new Date(d), p = n => String(n).padStart(2, '0'); return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()} a las ${p(x.getHours())}:${p(x.getMinutes())}`; };
console.log(`      armada de ${hecho.commit || '?'}${hecho.sucio ? ' (con cambios sin commit)' : ''} el ${cuando(hecho.fecha)}; ahora el repositorio está en ${head || '?'}`);
ok(!cambiados.length && !nuevos.length && !idos.length, cambiados.length || nuevos.length || idos.length
  ? `atrasada: ${[cambiados.length && `cambiaron ${lista(cambiados)}`, nuevos.length && `aparecieron ${lista(nuevos)}`, idos.length && `se fueron ${lista(idos)}`].filter(Boolean).join('; ')} → npm run offline`
  : `armada con los ${Object.keys(ahora).length} archivos de ahora`);
if (hecho.sucio) aviso('se armó con cambios sin commit: lo publicado tiene que salir de un commit (npm run publicar la rearma)');

// ── 2. completa ──
titulo('2. completa');
const off = JSON.parse(readFileSync(S('offline.json'), 'utf8'));
const malos = [];
for (const a of off.archivos) {
  const p = S(a.u);
  if (!existsSync(p)) { malos.push(`${a.u} no está`); continue; }
  const d = readFileSync(p);
  if (d.length !== a.b) malos.push(`${a.u} pesa ${d.length} en vez de ${a.b}`);
  else if (createHash('sha1').update(d).digest('hex').slice(0, 10) !== a.h) malos.push(`${a.u} cambió`);
}
ok(!malos.length, malos.length ? `offline.json: ${lista(malos)}` : `los ${off.archivos.length} archivos de offline.json están, con su tamaño y su resumen`);
const sw = existsSync(S('sw.js')) ? readFileSync(S('sw.js'), 'utf8') : '';
ok(sw.includes(`const VERSION = '${off.version}';`), `sw.js con la versión de offline.json (${off.version})`);
const deben = ['index.html', '.nojekyll', 'manifest.webmanifest', 'bancos/plantel.json', 'motor/vendor/mbrola/LICENSE-MBROLA.txt', 'motor/vendor/world/LICENSE-WORLD.txt',
  ...readdirSync(join(RAIZ, 'motor', 'vendor', 'mbrola')).filter(f => /^es\d+$/.test(f)).map(f => `motor/vendor/mbrola/${f}-LICENCIA.txt`)];
const faltan = deben.filter(f => !existsSync(S(f)));
ok(!faltan.length, faltan.length ? `faltan ${faltan.join(', ')}` : `la página, .nojekyll y las licencias (MBROLA, sus voces, WORLD)`);

// ── 3. los bancos ──
titulo('3. los bancos de UTAU');
const world = await crearWorld(readFileSync(join(RAIZ, 'motor', 'vendor', 'world', 'world.wasm')));
const abrir = ruta => { const t = archivosDelBanco(ruta), b = crearBanco(t.rutas, t.leer); b.preparar = async () => {}; return b; };
// unas murgas que el recorte no usó (utau_recortar.mjs arma las suyas con las semillas 101 + 13 i)
const ESTILOS = Object.keys(MODELO.estilos), TEMAS = ['', ...CLAVES.map(([re]) => re.source.split('|')[0])];
const piezas = Array.from({ length: NPIEZAS }, (_, k) => {
  const i = 500 + k * 7;
  return prepararMurga({ forma: k % 2 ? 'presentacion' : 'retirada', estilo: ESTILOS[i % ESTILOS.length], semilla: 7 + i * 31, tonica: (i * 7) % 12, modo: k % 3 === 2 ? 'menor' : 'mayor', largo: ['corta', 'normal', 'larga'][k % 3], hasta: 0, letraSemilla: 9000 + i, tema: TEMAS[(i * 3) % TEMAS.length] });
});
console.log(`      ${piezas.length} murgas nuevas para probar el recorte · ${seg()}`);
const alturas = b => b.alturas.map(c => c.prefijo + '|' + c.sufijo + '|' + c.midi).join(' ');
for (const bp of PL.bancos) {
  const archivo = bp.archivo, ruta = S('bancos/' + archivo), entero = join(RAIZ, 'bancos', archivo);
  if (!ok(existsSync(ruta), `${archivo}: ${existsSync(ruta) ? MB(statSync(ruta).size) : 'no está en offline/bancos/ → npm run bancos'}`)) continue;
  // el .zip y sus .wav en Opus (los muy cortos, de menos de un cuadro de Opus, quedan en .wav)
  let zip;
  try { zip = leerZip(new Uint8Array(readFileSync(ruta))); } catch (e) { ok(false, `${archivo}: no se abre (${e.message})`); continue; }
  const wavs = zip.filter(e => /\.wav$/i.test(e.nombre));
  const enOpus = wavs.filter(e => esOgg(extraer(e, x => inflateRawSync(x)))).length;
  ok(wavs.length > 0 && enOpus >= wavs.length * .98, `   ${wavs.length} .wav, ${enOpus} en Opus${zip.some(e => /(^|\/)oto\.ini$/i.test(e.nombre)) ? '' : ' · SIN oto.ini'}`);
  if (!existsSync(entero)) { aviso(`   el banco entero no está en bancos/: no se puede comparar el recorte`); continue; }
  // contra el entero: las mismas entradas, reclist y alturas, y los mismos pedazos para unas murgas nuevas
  const b = abrir(entero), nb = abrir(ruta);
  await medirAlturas(b, world); await medirAlturas(nb, world);
  const dif = [];
  if (nb.reclist !== b.reclist) dif.push(`reclist ${nb.reclist} en vez de ${b.reclist}`);
  if (nb.entradas.length !== b.entradas.length) dif.push(`${nb.entradas.length} entradas en vez de ${b.entradas.length}`);
  if (alturas(nb) !== alturas(b)) dif.push(`alturas ${alturas(nb)} en vez de ${alturas(b)}`);
  let comparados = 0, distintos = 0, pedazos = 0, faltantes = 0;
  const ejemplos = new Set();
  for (const M of piezas) for (const v of PL.voces.filter(x => x.banco === archivo)) {
    const MURGA = Object.fromEntries(LUGARES.map(l => [l.clave, v.nombre]));
    for (const t of repartir(M.lista, PL.voces, MURGA)) {
      if (t.motor !== 'banco') continue;
      for (const esf of [-5, 0, 7]) {
        const o = { ...t.opc, esfuerzo: esf };
        const p1 = frasesDe(b, correr(t.c.notas, o), o).flatMap(f => f.U.map(u => u.e?.archivo ?? '-'));
        const p2 = frasesDe(nb, correr(t.c.notas, o), o).flatMap(f => f.U.map(u => u.e?.archivo ?? '-'));
        comparados++; pedazos += p1.length;
        let d = p1.length !== p2.length;
        for (let i = 0; i < Math.min(p1.length, p2.length); i++) if (p1[i] !== p2[i]) { d = true; faltantes++; if (ejemplos.size < 3) ejemplos.add(`${v.nombre}: ${p1[i]}`); }
        if (d) distintos++;
      }
    }
  }
  if (distintos) dif.push(`${distintos} de ${comparados} cantores piden otros pedazos (${faltantes} de ${pedazos}; por ejemplo ${[...ejemplos].join(', ')}) → npm run bancos`);
  ok(!dif.length, dif.length ? `   contra el entero: ${dif.join('; ')}` : `   igual que el entero: ${b.entradas.length} entradas, ${b.reclist}; ${comparados} cantores de ${piezas.length} murgas nuevas piden los mismos ${pedazos} pedazos · ${seg()}`);
}

// ── 4. los créditos ──
titulo('4. los créditos');
const sinCredito = publicables.filter(b => !b.autor || !/^https?:\/\/\S+$/.test(b.web || '')).map(b => b.nombre);
ok(!sinCredito.length, sinCredito.length ? `sin autor o sin link a su página: ${sinCredito.join(', ')} (bancos/plantel.json)` : `los ${publicables.length} bancos que se publican tienen su autor con link: ${[...new Set(publicables.map(b => b.autor))].join(', ')}`);
const noPublicables = PL.bancos.filter(b => b.publicable !== true);
if (noPublicables.length) aviso(`no se publican (sin "publicable": true en el plantel): ${noPublicables.map(b => b.nombre).join(', ')}`);
const idx = existsSync(S('index.html')) ? readFileSync(S('index.html'), 'utf8') : '', pl = existsSync(S('motor/plantel.js')) ? readFileSync(S('motor/plantel.js'), 'utf8') : '';
ok(idx.includes('id="creditosBancos"') && pl.includes('creditosBancos'), 'la página los nombra en «Cómo funciona» y en el plantel');

// ── 5. los topes ──
titulo('5. los topes de GitHub');
const fuera = new Set([...SOLO_COMPU, ...noPublicables.map(b => 'bancos/' + b.archivo)]);
let total = 0; const grandes = [], avisos = [];
(function andar(d, rel) {
  for (const f of readdirSync(d)) {
    const p = join(d, f), r = rel ? rel + '/' + f : f;
    if (statSync(p).isDirectory()) { andar(p, r); continue; }
    if (fuera.has(r)) continue;
    const n = statSync(p).size; total += n;
    if (n >= TOPE_ARCHIVO) grandes.push(`${r} (${MB(n)})`); else if (n >= AVISO_ARCHIVO) avisos.push(`${r} (${MB(n)})`);
  }
})(SALIDA, '');
ok(!grandes.length, grandes.length ? `archivos de 100 MB o más (GitHub no los acepta): ${grandes.join(', ')}` : 'ningún archivo de 100 MB o más');
if (avisos.length) aviso(`de más de 50 MB (GitHub avisa, pero los acepta): ${avisos.join(', ')}`);
ok(total < TOPE_SITIO, `lo publicado pesa ${MB(total)} (GitHub Pages: hasta 1 GB)`);

// ── 6. en Chrome ──
if (RAPIDO) console.log('\n(sin Chrome: --rapido)');
else {
  titulo('6. en Chrome sin ventana');
  const correrPrueba = (nombre, a) => {
    console.log(`      node herramientas/${nombre} ${a.join(' ')}`);
    try { execFileSync(process.execPath, [join(RAIZ, 'herramientas', nombre), ...a], { cwd: RAIZ, stdio: 'inherit' }); return true; } catch { return false; }
  };
  ok(correrPrueba('probar_pagina.mjs', [SALIDA]), `la página entera, sin errores · ${seg()}`);
  // (con MIKE si está: es el que canta más rápido la murga entera, 93 s contra 104 de LongWei y 115 de Rubato)
  const sirve = v => v.banco && publicables.some(b => b.archivo === v.banco) && existsSync(S('bancos/' + v.banco));
  const banco = PL.voces.find(v => v.nombre === 'MIKE' && sirve(v)) || PL.voces.find(sirve);
  ok(correrPrueba('probar_voces.mjs', ['--carpeta', SALIDA, '--voces', ['es2', banco && 'banco:' + banco.nombre].filter(Boolean).join(',')]), `canta con MBROLA${banco ? ` y con ${banco.nombre} (Opus)` : ''} · ${seg()}`);
}

console.log(`\n${mal ? `MAL: ${mal} cosas para arreglar` : 'Todo bien: la versión liviana está completa y al día'}${ojo ? ` (${ojo} avisos)` : ''} · ${seg()}`);
process.exitCode = mal ? 1 : 0;
