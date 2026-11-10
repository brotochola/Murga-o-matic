import{medir as Q}from"./letra.js";export function grupoDe(w){if(w.startsWith("Bajada"))return"Bajada";if(w.startsWith("Canción final"))return"Canción final";return w}function T(w,H,B){if(w.startsWith("Clarinada"))return"coral lento a capela, con notas largas: frases cortas, solemnes o emotivas";if(w.startsWith("Canción final"))return"canción lenta y emotiva antes de la retirada, la parte más poética";if(w.startsWith("Bajada"))return"estribillo final pegadizo, que se repite varias veces mientras la murga se va";if(w.startsWith("Estribillo"))return"estribillo con todo el coro: la idea central, fácil de recordar";if(/otra vuelta|con todo|repetida/.test(w))return"segunda estrofa sobre la misma música: sigue la idea, con texto nuevo";if(/sigue/.test(w))return"otra estrofa con batería y música nueva: sigue la idea, con texto nuevo";return B==="retirada"?"estrofa con batería: recuerda, agradece, critica con ternura":"estrofa con batería: presenta, critica, hace reír"}export function partesAEscribir(w,H){const B=new Map;for(const F of w){const h=grupoDe(F.nombre),G=F.versos.map((z)=>z.silabas).join(","),C=[...B.values()].find((z)=>z.grupo===h&&z.firma===G),y=C?C.id:B.has(h)?F.nombre:h;if(!B.has(y))B.set(y,{id:y,nombre:y,grupo:h,firma:G,funcion:T(F.nombre,F.tipo,H),versos:F.versos.map((z)=>({silabas:z.silabas,tipo:z.tipo,acentos:z.acentos})),secciones:[]});B.get(y).secciones.push(F.nombre)}return[...B.values()]}export function promptLetra({forma:w,estilo:H,tema:B,partes:F}){const h=w==="retirada"?"La retirada es la despedida: la murga se va, agradece, se pone nostálgica y deja un mensaje.":"La presentación es el saludo: la murga llega, se presenta al barrio y anuncia de qué va el espectáculo.",G=F.map((C,y)=>`### p${y+1}: ${C.nombre} (${C.funcion}). ${C.versos.length} versos:
`+C.versos.map((z,I)=>`${I+1}. ${z.silabas} sílaba${z.silabas===1?"":"s"}, ${z.silabas===1?"una exclamación":z.tipo}`).join(`
`)).join(`

`);return`Sos letrista de murga uruguaya. Escribí la letra completa de una ${w==="retirada"?"retirada":"presentación"} de murga${H?`, en el estilo de ${H}`:""}.

Tema: ${B||(w==="retirada"?"la despedida del barrio":"el saludo al barrio")}

Cómo escribir:
- Castellano rioplatense, con voseo. Lenguaje de murga: imágenes de barrio, humor e ironía con ternura, crítica social sin nombrar personas reales.
- Todo original: no uses versos de murgas, tangos ni canciones que existan.
- ${h}
- Que rimen los versos pares de cada parte (asonante alcanza).

Métrica. Es lo más importante, porque cada sílaba cae en una nota:
- Cada verso tiene que tener EXACTAMENTE la cantidad de sílabas cantadas que se pide.
- Se cuentan como se cantan: la vocal final de una palabra y la vocal inicial de la siguiente se juntan en una sola sílaba (sinalefa). Ejemplos: "que el car-na-val" = 4 (que‿el · car · na · val); "la a-le-grí-a" = 4 (la‿a · le · grí · a); "can-ta la ciu-dad" = 5; "y aun-que" = 2.
- "aguda": el verso termina en palabra aguda o monosílabo (can-CIÓN, voz, ca-fé). "llana": termina en palabra llana (BA-rrio, MUR-ga).
- Antes de contestar, separá en sílabas cada verso y contalas.

Partes, en orden:

${G}

Respondé solo con JSON, sin comentarios: {"partes": [{"id": "p1", "versos": ["primer verso", "segundo verso"]}]}, con exactamente la cantidad de versos de cada parte.`}export function revisar(w,H){const B=[];w.forEach((F,h)=>F.versos.forEach((G,C)=>{const y=H[h]?.[C]??"",z=Q(y);if(z.n!==G.silabas)B.push({parte:h,verso:C,texto:y,tiene:z.n,sils:z.silabas,quiere:G.silabas,tipo:G.tipo})}));return B}export function promptArreglo(w,H,B){return`Estos versos de una letra de murga no tienen las sílabas cantadas que pide la música. Reescribí cada uno con EXACTAMENTE las sílabas pedidas, manteniendo el sentido, la rima con su pareja y el tipo de final. Se cuentan como se cantan: la vocal final de una palabra se junta con la vocal inicial de la siguiente (sinalefa: "que el" = 1, "la a-le-grí-a" = 4). Separá en sílabas y contá antes de contestar.

${B.map((h)=>{const G=H[h.parte]?.[h.verso-1],C=H[h.parte]?.[h.verso+1];return`- p${h.parte+1}, verso ${h.verso+1}: "${h.texto}" se canta en ${h.tiene} sílabas (${h.sils.join("-")}); tiene que tener ${h.quiere}${h.quiere>1?`, ${h.tipo}`:""}.`+(G?` Va después de: "${G}".`:"")+(C?` Antes de: "${C}".`:"")}).join(`
`)}

Respondé solo con JSON: {"arreglos": [{"id": "p1", "verso": 3, "texto": "verso nuevo"}]}`}export async function escribirLetra({pedir:w,forma:H,estilo:B,tema:F,metrica:h,avisar:G=()=>{},signal:C}){const y=partesAEscribir(h,H);G("Escribiendo la letra…");const z=await w(promptLetra({forma:H,estilo:B,tema:F,partes:y}),{signal:C,cache:!1}),I=y.map((O,J)=>{const K=(z?.partes||[]).find((M)=>M.id===`p${J+1}`)?.versos||z?.partes?.[J]?.versos||[];return O.versos.map((M,N)=>String(K[N]??"").trim())});for(let O=1;O<=2;O++){const J=revisar(y,I);if(!J.length)break;G(`Ajustando ${J.length} verso${J.length===1?"":"s"} a la música (ronda ${O})…`);try{const K=await w(promptArreglo(y,I,J),{signal:C,cache:!1});for(const M of K?.arreglos||[]){const N=Number(String(M.id).replace(/\D/g,""))-1,P=Number(M.verso)-1;if(I[N]&&P>=0&&P<I[N].length&&typeof M.texto==="string"){const S=Math.abs(Q(I[N][P]).n-y[N].versos[P].silabas);if(Math.abs(Q(M.texto).n-y[N].versos[P].silabas)<=S)I[N][P]=M.texto.trim()}}}catch(K){if(K?.code==="cancelled")throw K;break}}const R={};y.forEach((O,J)=>{for(const K of O.secciones)R[K]=I[J].slice()});return{letras:R,partes:y,textos:I,malos:revisar(y,I)}}