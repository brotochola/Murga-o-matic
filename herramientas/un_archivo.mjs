// un_archivo.mjs — la página entera en un solo HTML que anda sin internet y sin servidor: se abre con doble clic.
// Lleva adentro el código (empaquetado con Bun), las voces de MBROLA, los loops, las muestras del coro y las
// librerías del PDF y del MP3, comprimidos (gzip) y en base64. Pesa unos 25 MB.
//
//   bun herramientas/un_archivo.mjs [salida.html]     (por defecto, murga-o-matic.html en la carpeta de trabajo)
//
// Cómo anda sin servidor: el navegador no deja pedir archivos (fetch) ni cargar módulos desde file://. Un guion que
// corre antes de la página atiende esos pedidos con los archivos de adentro: fetch, las librerías (cargarScript de
// papeles.js) y los obreros (que cantan en otro hilo y piden las voces a la página).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof Bun === 'undefined') { console.error('Esto se corre con bun: bun herramientas/un_archivo.mjs'); process.exit(2); }
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SAL = resolve(process.argv[2] || join(RAIZ, 'murga_trabajo', 'un_archivo', 'murga-o-matic.html'));
const VIRT = 'https://murga.local/';

// lo que la página pide por fetch o como librería
const ARCHIVOS = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: RAIZ, encoding: 'utf8' })
  .split('\n').filter(f => /^(motor\/vendor\/.+|loops\/.+|frases\/.+|coro\/.+)$/.test(f)).sort();

async function empaquetar(entrada, url) {
  const r = await Bun.build({ entrypoints: [join(RAIZ, entrada)], target: 'browser', format: 'esm', minify: true, define: { 'import.meta.url': JSON.stringify(VIRT + url) } });
  if (!r.success) throw new Error(r.logs.join('\n'));
  if (r.outputs.length !== 1) throw new Error(entrada + ': salió en más de un pedazo');
  const t = await r.outputs[0].text();
  if (/\bimport\s*\(|\bimport\.meta\b/.test(t)) throw new Error(entrada + ': quedó un import sin resolver');
  return t;
}
const sinCerrar = t => t.replace(/<\/(script)/gi, '<\\/$1');
const app = await empaquetar('motor/app.js', 'motor/app.js');
const obrero = await empaquetar('motor/cantor/obrero.js', 'motor/cantor/obrero.js');
if (/^\s*export\b|\bexport\s*\{/m.test(obrero)) throw new Error('el obrero no puede exportar nada');

// el obrero no puede pedir archivos: se los pide a la página, que le contesta con los de adentro
const PRE_OBRERO = `const __esperan={};let __k=0;self.addEventListener('message',e=>{const d=e.data;if(d&&d.__archivo&&__esperan[d.__n]){e.stopImmediatePropagation();const f=__esperan[d.__n];delete __esperan[d.__n];f(d.buf?new Response(d.buf):new Response(null,{status:404}));}});self.fetch=u=>new Promise(r=>{const n=++__k;__esperan[n]=r;self.postMessage({__archivo:String(u&&u.url||u),__n:n});});\n`;

// antes de la página: los archivos de adentro, para fetch, las librerías y los obreros
const PRELUDIO = `(()=>{const VIRT=${JSON.stringify(VIRT)};const caja=new Map();for(const s of document.querySelectorAll('script[data-ruta]'))caja.set(s.dataset.ruta,s);
const doc=location.href.replace(/[?#].*$/,'').replace(/[^/]*$/,'');
const ruta=u=>{u=String(u&&u.url||u);if(u.startsWith(VIRT))return u.slice(VIRT.length);if(u.startsWith(doc))return u.slice(doc.length);if(!/^[a-z][a-z0-9+.-]*:/i.test(u))return u.replace(/^\\.\\//,'');return null};
const listos=new Map(),fetchOriginal=window.fetch.bind(window);
const bytes=r=>{if(!listos.has(r))listos.set(r,(async()=>{const s=caja.get(r);const gz=await (await fetchOriginal('data:application/octet-stream;base64,'+s.textContent.trim())).blob();return new Response(gz.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()})());return listos.get(r)};
const TIPOS={wav:'audio/wav',mp3:'audio/mpeg',js:'text/javascript',wasm:'application/wasm'};
window.fetch=async(u,o)=>{const r=ruta(u);if(r!=null&&caja.has(r))return new Response((await bytes(r)).slice(0),{headers:{'content-type':TIPOS[r.split('.').pop()]||'application/octet-stream'}});if(r!=null&&!/^data:|^blob:/.test(String(u)))return new Response(null,{status:404,statusText:'no está en el archivo'});return fetchOriginal(u,o)};
const scripts=new Map();window.__cargarScript=url=>{const r=ruta(url);if(!scripts.has(r))scripts.set(r,(async()=>{if(!caja.has(r))throw new Error('no se pudo cargar '+r);const t=new TextDecoder().decode(await bytes(r));const s=document.createElement('script');s.textContent=t;document.head.appendChild(s)})());return scripts.get(r)};
const W=window.Worker;let urlObrero=null;
window.Worker=function(u,o){if(!String(u).includes('obrero.js'))return new W(u,o);if(!urlObrero)urlObrero=URL.createObjectURL(new Blob([caja.get('__obrero.js').textContent],{type:'text/javascript'}));const w=new W(urlObrero);
w.addEventListener('message',async e=>{const d=e.data;if(!d||!d.__archivo)return;e.stopImmediatePropagation();const r=ruta(d.__archivo);if(r==null||!caja.has(r)){w.postMessage({__archivo:1,__n:d.__n});return}const buf=(await bytes(r)).slice(0);w.postMessage({__archivo:1,__n:d.__n,buf},[buf])});return w};})();`;

let html = readFileSync(join(RAIZ, 'index.html'), 'utf8');
const quitar = (re, que) => { if (!re.test(html)) throw new Error('no encontré ' + que); html = html.replace(re, ''); };
quitar(/<link rel="manifest"[^>]*>\n?/, 'el manifiesto');
quitar(/<link rel="apple-touch-icon"[^>]*>\n?/, 'el ícono de iPhone');
quitar(/\s*<section class="panel sinred"[\s\S]*?<\/section>\n?/, 'el panel Sin conexión');
quitar(/<script type="module" src="motor\/sinconexion\.js"><\/script>\n?/, 'sinconexion.js');
const icono = 'data:image/svg+xml;base64,' + readFileSync(join(RAIZ, 'iconos/icono.svg')).toString('base64');
html = html.replace(/<link rel="icon" href="[^"]*"/, `<link rel="icon" href="${icono}"`);
html = html.replace('<title>Murga-o-matic</title>', '<title>Murga-o-matic (sin conexión)</title>');
let datos = '';
let crudo = 0, dentro = 0;
for (const f of ARCHIVOS) {
  const b = readFileSync(join(RAIZ, f)), z = gzipSync(b, { level: 9 }).toString('base64');
  crudo += b.length; dentro += z.length;
  datos += `<script type="text/plain" data-ruta="${f}">${z}</script>\n`;
}
datos += `<script type="text/plain" data-ruta="__obrero.js">${sinCerrar(PRE_OBRERO + obrero)}</script>\n`;
const pagina = `${datos}<script>${PRELUDIO}</script>\n<script type="module">${sinCerrar(app)}</script>`;
const antes = html.length;
html = html.replace('<script type="module" src="motor/app.js"></script>', () => pagina);
if (html.length === antes) throw new Error('no encontré el script de la página');
mkdirSync(dirname(SAL), { recursive: true });
writeFileSync(SAL, html);
console.log(`${SAL}: ${(html.length / 1e6).toFixed(1)} MB (${ARCHIVOS.length} archivos, ${(crudo / 1e6).toFixed(1)} MB sin comprimir; código ${(app.length / 1e6).toFixed(2)} + ${(obrero.length / 1e6).toFixed(2)} MB)`);
