// letrista.js — pide a Claude una letra que entre en la melodía y la corrige hasta que encaja.
// pedir(texto, opciones) es la función que habla con Claude (en la página: la capacidad "sample").
import { medir } from './letra.js';

// Secciones que cantan el mismo texto: todas las bajadas, y la canción final cuando entra el coro
export function grupoDe(nombre) {
  if (nombre.startsWith('Bajada')) return 'Bajada';
  if (nombre.startsWith('Canción final')) return 'Canción final';
  return nombre;
}

function funcion(nombre, tipo, forma) {
  if (nombre.startsWith('Clarinada')) return 'coral lento a capela, con notas largas: frases cortas, solemnes o emotivas';
  if (nombre.startsWith('Canción final')) return 'canción lenta y emotiva antes de la retirada, la parte más poética';
  if (nombre.startsWith('Bajada')) return 'estribillo final pegadizo, que se repite varias veces mientras la murga se va';
  if (nombre.startsWith('Estribillo')) return 'estribillo con todo el coro: la idea central, fácil de recordar';
  if (/otra vuelta|con todo|repetida/.test(nombre)) return 'segunda estrofa sobre la misma música: sigue la idea, con texto nuevo';
  if (/sigue/.test(nombre)) return 'otra estrofa con batería y música nueva: sigue la idea, con texto nuevo';
  return forma === 'retirada' ? 'estrofa con batería: recuerda, agradece, critica con ternura' : 'estrofa con batería: presenta, critica, hace reír';
}

// metrica: salida de coro.metrica(P). Devuelve las partes únicas a escribir.
export function partesAEscribir(metrica, forma) {
  const vistos = new Map();
  for (const s of metrica) {
    const g = grupoDe(s.nombre);
    const firma = s.versos.map(v => v.silabas).join(',');
    // la misma música dentro del grupo canta el mismo texto (el estribillo de la canción final cuando vuelve)
    const igual = [...vistos.values()].find(v => v.grupo === g && v.firma === firma);
    const id = igual ? igual.id : (vistos.has(g) ? s.nombre : g);
    if (!vistos.has(id)) vistos.set(id, { id, nombre: id, grupo: g, firma, funcion: funcion(s.nombre, s.tipo, forma), versos: s.versos.map(v => ({ silabas: v.silabas, tipo: v.tipo, acentos: v.acentos })), secciones: [] });
    vistos.get(id).secciones.push(s.nombre);
  }
  return [...vistos.values()];
}

export function promptLetra({ forma, estilo, tema, partes }) {
  const queEs = forma === 'retirada'
    ? 'La retirada es la despedida: la murga se va, agradece, se pone nostálgica y deja un mensaje.'
    : 'La presentación es el saludo: la murga llega, se presenta al barrio y anuncia de qué va el espectáculo.';
  const lista = partes.map((p, i) => `### p${i + 1}: ${p.nombre} (${p.funcion}). ${p.versos.length} versos:\n` +
    p.versos.map((v, k) => `${k + 1}. ${v.silabas} sílaba${v.silabas === 1 ? '' : 's'}, ${v.silabas === 1 ? 'una exclamación' : v.tipo}`).join('\n')).join('\n\n');
  return `Sos letrista de murga uruguaya. Escribí la letra completa de una ${forma === 'retirada' ? 'retirada' : 'presentación'} de murga${estilo ? `, en el estilo de ${estilo}` : ''}.

Tema: ${tema || (forma === 'retirada' ? 'la despedida del barrio' : 'el saludo al barrio')}

Cómo escribir:
- Castellano rioplatense, con voseo. Lenguaje de murga: imágenes de barrio, humor e ironía con ternura, crítica social sin nombrar personas reales.
- Todo original: no uses versos de murgas, tangos ni canciones que existan.
- ${queEs}
- Que rimen los versos pares de cada parte (asonante alcanza).

Métrica. Es lo más importante, porque cada sílaba cae en una nota:
- Cada verso tiene que tener EXACTAMENTE la cantidad de sílabas cantadas que se pide.
- Se cuentan como se cantan: la vocal final de una palabra y la vocal inicial de la siguiente se juntan en una sola sílaba (sinalefa). Ejemplos: "que el car-na-val" = 4 (que‿el · car · na · val); "la a-le-grí-a" = 4 (la‿a · le · grí · a); "can-ta la ciu-dad" = 5; "y aun-que" = 2.
- "aguda": el verso termina en palabra aguda o monosílabo (can-CIÓN, voz, ca-fé). "llana": termina en palabra llana (BA-rrio, MUR-ga).
- Antes de contestar, separá en sílabas cada verso y contalas.

Partes, en orden:

${lista}

Respondé solo con JSON, sin comentarios: {"partes": [{"id": "p1", "versos": ["primer verso", "segundo verso"]}]}, con exactamente la cantidad de versos de cada parte.`;
}

export function revisar(partes, textos) {
  const malos = [];
  partes.forEach((p, i) => p.versos.forEach((v, k) => {
    const t = textos[i]?.[k] ?? '';
    const m = medir(t);
    if (m.n !== v.silabas) malos.push({ parte: i, verso: k, texto: t, tiene: m.n, sils: m.silabas, quiere: v.silabas, tipo: v.tipo });
  }));
  return malos;
}

export function promptArreglo(partes, textos, malos) {
  const lineas = malos.map(m => {
    const ant = textos[m.parte]?.[m.verso - 1], sig = textos[m.parte]?.[m.verso + 1];
    return `- p${m.parte + 1}, verso ${m.verso + 1}: "${m.texto}" se canta en ${m.tiene} sílabas (${m.sils.join('-')}); tiene que tener ${m.quiere}${m.quiere > 1 ? `, ${m.tipo}` : ''}.` +
      (ant ? ` Va después de: "${ant}".` : '') + (sig ? ` Antes de: "${sig}".` : '');
  }).join('\n');
  return `Estos versos de una letra de murga no tienen las sílabas cantadas que pide la música. Reescribí cada uno con EXACTAMENTE las sílabas pedidas, manteniendo el sentido, la rima con su pareja y el tipo de final. Se cuentan como se cantan: la vocal final de una palabra se junta con la vocal inicial de la siguiente (sinalefa: "que el" = 1, "la a-le-grí-a" = 4). Separá en sílabas y contá antes de contestar.

${lineas}

Respondé solo con JSON: {"arreglos": [{"id": "p1", "verso": 3, "texto": "verso nuevo"}]}`;
}

// Escribe la letra entera: un pedido, y hasta dos rondas de arreglos. avisar(texto) para mostrar el avance.
export async function escribirLetra({ pedir, forma, estilo, tema, metrica, avisar = () => { }, signal }) {
  const partes = partesAEscribir(metrica, forma);
  avisar('Escribiendo la letra…');
  const r = await pedir(promptLetra({ forma, estilo, tema, partes }), { signal, cache: false });
  const textos = partes.map((p, i) => {
    const vs = (r?.partes || []).find(x => x.id === `p${i + 1}`)?.versos || r?.partes?.[i]?.versos || [];
    return p.versos.map((_, k) => String(vs[k] ?? '').trim());
  });
  for (let ronda = 1; ronda <= 2; ronda++) {
    const malos = revisar(partes, textos);
    if (!malos.length) break;
    avisar(`Ajustando ${malos.length} verso${malos.length === 1 ? '' : 's'} a la música (ronda ${ronda})…`);
    try {
      const a = await pedir(promptArreglo(partes, textos, malos), { signal, cache: false });
      for (const x of a?.arreglos || []) {
        const i = Number(String(x.id).replace(/\D/g, '')) - 1, k = Number(x.verso) - 1;
        if (textos[i] && k >= 0 && k < textos[i].length && typeof x.texto === 'string') {
          // solo se acepta el arreglo si mejora la cuenta
          const antes = Math.abs(medir(textos[i][k]).n - partes[i].versos[k].silabas), despues = Math.abs(medir(x.texto).n - partes[i].versos[k].silabas);
          if (despues <= antes) textos[i][k] = x.texto.trim();
        }
      }
    } catch (e) { if (e?.code === 'cancelled') throw e; break; }
  }
  // de partes a secciones
  const letras = {};
  partes.forEach((p, i) => { for (const s of p.secciones) letras[s] = textos[i].slice(); });
  return { letras, partes, textos, malos: revisar(partes, textos) };
}
