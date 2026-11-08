// offline.mjs — la lista de lo que la página guarda para andar sin conexión (offline.json) y la versión de sw.js.
// Hay que correrlo cada vez que cambia un archivo de la página, antes del commit: si no, el que ya la guardó sigue con
// lo viejo (y un archivo nuevo no se guarda). herramientas/probar_pagina.mjs avisa si quedó atrasado.
//
//   node herramientas/offline.mjs              reescribe offline.json y la VERSION de sw.js
//   node herramientas/offline.mjs --comprobar  sale con código 1 si no están al día
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const comprobar = process.argv.includes('--comprobar');

// lo que usa la página: el resto del repositorio (herramientas, transcripción, documentos, el trabajo) no se guarda
const DE_LA_PAGINA = /^(index\.html|manifest\.webmanifest|iconos\/.+|motor\/.+|loops\/.+|frases\/.+|coro\/.+)$/;
// el núcleo se guarda apenas se abre la página; lo demás, cuando se usa o con «Guardar todo»
const NUCLEO = /^(index\.html|manifest\.webmanifest|iconos\/.+|motor\/(?!vendor\/)(?!.*_v1\.js$).+\.js|motor\/vendor\/mbrola\/mbrola\.wasm)$/;

const archivos = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').filter(f => DE_LA_PAGINA.test(f) && existsSync(join(RAIZ, f))).sort()
  .map(u => {
    const datos = readFileSync(join(RAIZ, u));
    return { u, h: createHash('sha1').update(datos).digest('hex').slice(0, 10), b: statSync(join(RAIZ, u)).size, ...(NUCLEO.test(u) ? { n: 1 } : {}) };
  });
const version = createHash('sha1').update(JSON.stringify(archivos)).digest('hex').slice(0, 10);
const json = JSON.stringify({ version, archivos }, null, 0).replace(/\},\{/g, '},\n{') + '\n';

const rutaSw = join(RAIZ, 'sw.js'), sw = readFileSync(rutaSw, 'utf8');
const swNuevo = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
const rutaJson = join(RAIZ, 'offline.json');
const viejo = existsSync(rutaJson) ? readFileSync(rutaJson, 'utf8') : '';
const total = archivos.reduce((a, x) => a + x.b, 0), nucleo = archivos.filter(x => x.n).reduce((a, x) => a + x.b, 0);

if (comprobar) {
  if (viejo !== json || sw !== swNuevo) { console.error('offline.json o sw.js no están al día: node herramientas/offline.mjs'); process.exit(1); }
  console.log(`al día: versión ${version}`);
} else {
  writeFileSync(rutaJson, json);
  if (sw !== swNuevo) writeFileSync(rutaSw, swNuevo);
  console.log(`versión ${version}: ${archivos.length} archivos, ${(total / 1e6).toFixed(1)} MB (núcleo ${(nucleo / 1e6).toFixed(1)} MB)`);
}
