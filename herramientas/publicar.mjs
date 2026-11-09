// publicar.mjs — la versión liviana (offline/) a la rama gh-pages de GitHub, de donde la sirve GitHub Pages
// (https://brotochola.github.io/murga-o-matic/), con los bancos de UTAU recortados y en Opus: sus autores dieron
// permiso para publicarlos, con un link a cada uno (la página los nombra).
//
//   1. sale de lo commiteado: con cambios sin commit en lo que va a la página, no publica
//   2. rearma la página (construir.mjs, unos segundos; los bancos de offline/bancos/ quedan) y la verifica entera
//      (verificar.mjs, con Chrome): si algo falla, no publica
//   3. la sube como un solo commit, sin historia, que reemplaza al anterior en gh-pages: el repositorio de GitHub no
//      crece con cada versión publicada. El commit se arma en este mismo repositorio con un índice aparte (no toca
//      main ni la carpeta de trabajo) y queda en refs/publicado/gh-pages, así que cada vez sube sólo lo que cambió
//      (los bancos, una sola vez). No van abrir.bat, servir.mjs ni construido.json (son para la compu), ni los bancos
//      que en bancos/plantel.json no dicen "publicable": true.
//
// La primera vez, en GitHub: Settings → Pages → «Deploy from a branch», rama gh-pages, carpeta / (root).
//
//   node herramientas/publicar.mjs              (npm run publicar, o publicar.bat)
//   node herramientas/publicar.mjs --sin-subir  arma, verifica y hace el commit, sin subir
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RAIZ, SALIDA, SOLO_COMPU, PAGINA, rutasFuente, plantel, git } from './liviana.mjs';

const SIN_SUBIR = process.argv.includes('--sin-subir');
const REF = 'refs/publicado/gh-pages', REMOTA = 'refs/remotes/origin/gh-pages';
const intentar = f => { try { return f(); } catch { return ''; } };

// 1. lo commiteado (un archivo nuevo de la página sin agregar también cuenta: construir.mjs lo usaría)
const cambios = git(RAIZ, 'status', '--porcelain', '--untracked-files=no');
const sinAgregar = new Set(git(RAIZ, 'ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean));
const nuevos = rutasFuente().filter(r => sinAgregar.has(r));
if (cambios || nuevos.length) {
  console.error('Hay cambios sin commit: commiteá antes de publicar (lo publicado sale de un commit).');
  console.error((cambios + (nuevos.length ? '\n' + nuevos.map(r => '?? ' + r).join('\n') : '')).trim());
  process.exit(1);
}
const commit = git(RAIZ, 'rev-parse', '--short', 'HEAD'), rama = git(RAIZ, 'rev-parse', '--abbrev-ref', 'HEAD');

// 2. armada y verificada
const node = (archivo, ...a) => execFileSync(process.execPath, [join(RAIZ, 'herramientas', archivo), ...a], { cwd: RAIZ, stdio: 'inherit' });
node('construir.mjs');
try { node('verificar.mjs'); } catch { console.error('\nNo publico: la verificación encontró problemas (arriba).'); process.exit(1); }

// 3. el commit: lo de offline/, menos lo que es para la compu y los bancos que no se publican
const fuera = [...SOLO_COMPU, ...plantel().bancos.filter(b => b.publicable !== true).map(b => 'bancos/' + b.archivo)];
const tmp = mkdtempSync(join(tmpdir(), 'murga-publicar-'));
let nuevo, igual = false;
try {
  const gitDir = git(RAIZ, 'rev-parse', '--absolute-git-dir');
  const env = { ...process.env, GIT_DIR: gitDir, GIT_WORK_TREE: SALIDA, GIT_INDEX_FILE: join(tmp, 'index') };
  const g = (...a) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.safecrlf=false', ...a], { cwd: SALIDA, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 }).trim();
  // (-f: lo que ignoren las reglas de git de la compu, como un *.zip global, igual va)
  g('add', '-A', '-f', '--', '.', ...fuera.map(f => `:(exclude,literal)${f}`));
  const arbol = g('write-tree');
  const antes = intentar(() => git(RAIZ, 'rev-parse', '--verify', '-q', REMOTA + '^{tree}')) || intentar(() => git(RAIZ, 'rev-parse', '--verify', '-q', REF + '^{tree}'));
  igual = arbol === antes;
  nuevo = g('commit-tree', arbol, '-m', `Murga-o-matic publicado desde ${rama} ${commit}`);
  git(RAIZ, 'update-ref', REF, nuevo);
  const archivos = g('ls-tree', '-r', '--name-only', arbol).split('\n').length;
  console.log(`\nEl commit ${nuevo.slice(0, 7)}: ${archivos} archivos de offline/ (sin ${fuera.join(', ')})`);
} finally { rmSync(tmp, { recursive: true, force: true }); }

if (SIN_SUBIR) { console.log(`Armado, verificado y commiteado en ${REF} (sin subir).`); process.exit(0); }
if (igual) { console.log(`Ya estaba publicada así (la misma versión que la última vez): no subo nada. ${PAGINA}`); process.exit(0); }
const origen = git(RAIZ, 'remote', 'get-url', 'origin');
console.log(`Subiendo a gh-pages (${origen})…`);
execFileSync('git', ['push', '--force', 'origin', `${REF}:refs/heads/gh-pages`], { cwd: RAIZ, stdio: 'inherit' });
console.log(`\nPublicado (${rama} ${commit}) en la rama gh-pages: ${PAGINA} (tarda un par de minutos en verse)`);
console.log('La primera vez: en GitHub, Settings → Pages → «Deploy from a branch», rama gh-pages, carpeta / (root).');
if (!intentar(() => git(RAIZ, 'branch', '-r', '--contains', 'HEAD'))) console.log(`Ojo: el commit ${commit} todavía no está en GitHub (git push), y lo publicado dice que salió de ahí.`);
