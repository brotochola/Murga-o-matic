// publicar.mjs — la versión liviana para la web (construir.mjs --web: sin los bancos de UTAU, que no se pueden
// publicar) a la rama gh-pages de GitHub, de donde la sirve GitHub Pages (https://brotochola.github.io/Murga-o-matic/).
//
// Se arma en ../Murga-o-matic-web y se sube como un solo commit que reemplaza al anterior: así el repositorio no crece
// con cada versión publicada. Sale de lo que está commiteado (si hay cambios sin commit, no publica) y el commit dice
// de qué rama y commit salió.
//
// La primera vez, en GitHub: Settings → Pages → «Deploy from a branch», rama gh-pages, carpeta / (root).
//
//   node herramientas/publicar.mjs              (npm run publicar)
//   node herramientas/publicar.mjs --sin-subir  arma y commitea en ../Murga-o-matic-web, sin subir
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = resolve(RAIZ, '..', 'Murga-o-matic-web');
const SIN_SUBIR = process.argv.includes('--sin-subir');
const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (git(RAIZ, 'status', '--porcelain')) { console.error('Hay cambios sin commit: commiteá antes de publicar (lo publicado sale de un commit).'); process.exit(1); }
const commit = git(RAIZ, 'rev-parse', '--short', 'HEAD'), rama = git(RAIZ, 'rev-parse', '--abbrev-ref', 'HEAD');
const origen = git(RAIZ, 'remote', 'get-url', 'origin');

execFileSync(process.execPath, [join(RAIZ, 'herramientas', 'construir.mjs'), WEB, '--web'], { stdio: 'inherit' });

// un repositorio de un commit en la carpeta armada, que se sube a gh-pages en lugar del que había
rmSync(join(WEB, '.git'), { recursive: true, force: true });
git(WEB, 'init', '-q', '-b', 'gh-pages');
git(WEB, 'add', '-A');
git(WEB, 'commit', '-q', '-m', `Murga-o-matic publicado desde ${rama} ${commit}`);
if (SIN_SUBIR) { console.log(`Armado y commiteado en ${WEB} (sin subir).`); process.exit(0); }
execFileSync('git', ['push', '--force', origen, 'gh-pages:gh-pages'], { cwd: WEB, stdio: 'inherit' });
console.log(`Publicado (${rama} ${commit}) en la rama gh-pages: https://brotochola.github.io/Murga-o-matic/ (tarda un par de minutos)`);
