// utau_pagina.mjs — una página para comparar de oído varios bancos de UTAU y MBROLA, fila por fila: lo que dejó
// utau_prueba.mjs en murga_trabajo/utau/<carpeta>/ (filas.json y los wav).
//
//   node herramientas/utau_pagina.mjs longwei_es mike mike_sin_falsete   → murga_trabajo/utau/comparar.html
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..'), U = join(RAIZ, 'murga_trabajo', 'utau');
const carpetas = process.argv.slice(2).filter(c => existsSync(join(U, c, 'filas.json')));
if (!carpetas.length) { console.error('uso: node herramientas/utau_pagina.mjs <carpeta> [<carpeta> ...] (dentro de murga_trabajo/utau)'); process.exit(1); }
const datos = carpetas.map(c => ({ c, ...JSON.parse(readFileSync(join(U, c, 'filas.json'), 'utf8')) }));
const titulo = d => d.banco + (d.evitar ? ` sin ${d.evitar.join(', ')}` : '');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const audio = src => `<audio controls preload="none" src="${src}"></audio>`;
const filas = datos[0].filas.map((f, i) => `<tr><th scope="row">${esc(f.rotulo)}</th>
${datos.map(d => `<td>${audio(`${d.c}/${d.filas[i].nombre}_banco.wav`)}</td>`).join('')}
<td>${audio(`${datos[0].c}/${f.nombre}_mbrola.wav`)}</td></tr>`).join('\n');
const muestras = datos.filter(d => existsSync(join(U, d.c, 'muestra_del_autor.wav')) && !d.evitar)
  .map(d => `<li>${esc(d.banco)}: ${audio(`${d.c}/muestra_del_autor.wav`)}</li>`).join('');
const html = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bancos de UTAU contra MBROLA</title>
<style>
:root{--fondo:#fafafa;--texto:#222;--suave:#666;--linea:#ddd}
@media (prefers-color-scheme:dark){:root{--fondo:#181818;--texto:#ddd;--suave:#999;--linea:#333}}
body{font:16px/1.45 system-ui,sans-serif;margin:24px auto;max-width:1300px;padding:0 16px;background:var(--fondo);color:var(--texto)}
.tabla{overflow-x:auto}table{border-collapse:collapse;min-width:900px;width:100%}
th,td{padding:8px;border-bottom:1px solid var(--linea);text-align:left;vertical-align:middle}
th[scope=row]{font-weight:normal;width:24%}thead th{position:sticky;top:0;background:var(--fondo)}
audio{width:100%;min-width:180px}small,.nota{color:var(--suave)}ul{padding-left:20px}
</style>
<h1>Bancos de UTAU contra MBROLA</h1>
<p>Misma melodía, misma curva de altura (portamento, vibrato, caída) y mismo volumen: cambia sólo la voz. Los bancos salen
crudos (sin curva de timbre); MBROLA, como en la página.</p>
<ul class="nota">
${datos.map(d => `<li><b>${esc(titulo(d))}</b>${d.evitar ? ': sin el falsete, todo con el pecho (el Do 5 estira el Re 4)' : ''}</li>`).join('\n')}
<li><b>MBROLA ${esc(datos[0].voz)}</b>: los difonos de la página</li>
</ul>
${muestras ? `<p>Las muestras que traen los bancos, hechas por sus autores en UTAU:</p><ul>${muestras}</ul>` : ''}
<div class="tabla"><table><thead><tr><th>Qué</th>${datos.map(d => `<th>${esc(titulo(d))}</th>`).join('')}<th>MBROLA ${esc(datos[0].voz)}</th></tr></thead>
<tbody>${filas}</tbody></table></div>`;
writeFileSync(join(U, 'comparar.html'), html);
console.log('→ ' + join(U, 'comparar.html'));
