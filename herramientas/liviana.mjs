// liviana.mjs — lo que comparten construir.mjs, verificar.mjs, publicar.mjs y utau_recortar.mjs: dónde va la versión
// liviana (offline/, adentro del repositorio, que git ignora), qué archivos del repositorio lleva y su huella (para
// saber si quedó atrasada).
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SALIDA = join(RAIZ, 'offline');
export const PUERTO = 8124;
export const PAGINA = 'https://brotochola.github.io/murga-o-matic/';   // (en minúscula: con mayúscula, 404)
// lo que queda en offline/ para usarla en la compu, pero no se publica
export const SOLO_COMPU = ['abrir.bat', 'servir.mjs', 'construido.json'];
// GitHub no acepta archivos de más de 100 MB (avisa desde 50) y GitHub Pages no publica sitios de más de 1 GB
export const TOPE_ARCHIVO = 100e6, AVISO_ARCHIVO = 50e6, TOPE_SITIO = 1e9;

// lo que va: la página y lo que pide (el código, menos el del estudio; de vendor/, las librerías, los WebAssembly y las
// voces de MBROLA), las licencias de lo que se redistribuye (MBROLA pide que su aviso vaya con las voces), el plantel
// y su LEEME (los créditos de los bancos) y las direcciones viejas (cantada/)
const VAN = /^(index\.html|manifest\.webmanifest|sw\.js|iconos\/.+|motor\/(?!estudio\.js$)(?!vendor\/).+\.js|motor\/vendor\/[^/]+\.js|motor\/vendor\/mbrola\/(mbrola\.wasm|es\d+)|motor\/vendor\/world\/world\.wasm|motor\/vendor\/.*(LICEN[CS][EI]A?|LEEME|glue).*|loops\/.+\.wav|frases\/.+\.wav|coro\/.+\.mp3|bancos\/(plantel\.json|LEEME\.md)|cantada\/index\.html)$/;
// y las herramientas que la arman: si cambian, la versión armada también queda atrasada
const ARMAN = ['herramientas/construir.mjs', 'herramientas/liviana.mjs', 'herramientas/offline.mjs'];

export function rutasFuente() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter(r => VAN.test(r) && existsSync(join(RAIZ, r))).sort();
}
const resumen = b => createHash('sha1').update(b).digest('hex').slice(0, 12);
// la huella de lo que se arma: { ruta: resumen } de cada archivo que va y de las herramientas
export const huella = (rutas = rutasFuente()) => Object.fromEntries([...rutas, ...ARMAN].map(r => [r, resumen(readFileSync(join(RAIZ, r)))]));
export const resumenDe = resumen;

export const plantel = () => JSON.parse(readFileSync(join(RAIZ, 'bancos', 'plantel.json'), 'utf8'));
export const MB = n => (n / 1e6).toFixed(1) + ' MB';
export const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
