// murga_bancos.js — una murga cantada con las voces de un plantel (docs/plan_cantantes.md), en Node
// (herramientas/murga_bancos.mjs) y en el navegador (estudio.html): lo mismo en los dos.
//
// El plantel es un .json con las propiedades de cada voz: [{ nombre, banco (o carpeta, en Node) o mbrola, capa,
// evitar, y sus valores: tracto, grito, tension... }]. La murga dice qué voz canta en cada uno de los 13 lugares.
import { componer } from '../compositor.js';
import { MODELO } from '../modelo.js';
import { CORO, tiempos, metrica, silabear, cantores } from './coro.js';
import { partesAEscribir } from './letrista.js';
import { escribirLetraLocal } from './letrista_local.js';
import { DATOS } from './datos.js';
import { sala, normalizar } from './mezcla.js';
import { cantorDifonos, remuestrear } from './difonos.js';

// los 13 lugares, en el orden de coro.js: bajos0, bajos1, segundos0...
export const LUGARES = Object.entries(CORO).flatMap(([cuerda, cfg]) => Array.from({ length: cfg.cantores }, (_, n) => ({ cuerda, n, clave: cuerda + n })));
// dónde canta cómodo cada cuerda (CUERDAS_DIFONOS.centro de difonos.js)
export const CENTRO = { bajos: 52, segundos: 55, primos: 60, sobreprimos: 64, tercia: 64 };

// los valores de una voz: sus números (lo demás dice qué voz es)
const META = new Set(['nombre', 'carpeta', 'banco', 'mbrola', 'capa', 'color', 'evitar', 'notas']);
export const valoresDe = voz => Object.fromEntries(Object.entries(voz || {}).filter(([k, v]) => !META.has(k) && typeof v === 'number'));
// si una voz canta en más de un lugar, cada vez con otra garganta
const GARGANTAS = [1, 1.04, .96, 1.07, .93];

// las opciones de un cantor (c, de coro.js cantores()) con una voz del plantel. veces: cuántas veces ya se usó esa voz.
// Los valores de un cantor de difonos de su cuerda (vibrato, entrada, adornos, retraso...) y encima los de la voz; a
// un banco no le tocan la garganta, el color ni el grito de MBROLA (el grito es el que diga la voz).
export function opcionesDe(c, voz, veces = 0) {
  const base = cantorDifonos(c.cuerda === 'tercia' ? 'sobreprimos' : c.cuerda, c.semilla, { c: c.c || 0 });
  const v = valoresDe(voz), retraso = (base.retraso || 0) + (c.retraso || 0) + (v.retraso || 0);
  if (voz.mbrola) return { motor: 'difonos', opc: { ...base, ...v, voz: voz.mbrola, w: voz.mbrola !== 'es4', tracto: base.tracto * (v.tracto ?? 1) * GARGANTAS[veces % GARGANTAS.length], retraso } };
  const { tracto, color, inclinacion, grito, ...b } = base;
  return { motor: 'banco', opc: { ...b, grito: 0, ...v, tracto: (v.tracto ?? 1) * GARGANTAS[veces % GARGANTAS.length], retraso, semilla: c.semilla, banco: voz.banco, capa: voz.capa ?? voz.color, evitar: voz.evitar } };
}

// la pieza, su letra y los cantores (como la página: exportar_voces.mjs), cortada al final de la primera sección que
// termina después de `hasta` segundos (0: entera)
export function prepararMurga({ forma = 'retirada', estilo = 'trasnochada', semilla = 56, tonica = 9, modo = 'mayor', largo = 'corta', hasta = 60, letraSemilla = 1, tema = '' } = {}) {
  const op = { forma, estilo, semilla, tonica, modo, largo };
  const LLAMADAS = Object.fromEntries(DATOS.ritmos.map(r => { const a = DATOS.acompana[r.id]; if (!a || !a[0]) return [r.id, 0]; const c4 = r.compas * 4 / r.tpc; return [r.id, Math.ceil((DATOS.frases[a[0]].ultimo + .05) / c4)]; }));
  const P = componer(MODELO, { ...op, llamadas: LLAMADAS });
  const { T, fin } = tiempos(P); P.total = fin; P.T = T;
  const M = metrica(P), partes = partesAEscribir(M, forma);
  const textos = escribirLetraLocal({ forma, tema, metrica: M, semilla: semilla * 1000 + letraSemilla }).textos;
  const letras = {}; partes.forEach((p, i) => { for (const s of p.secciones) letras[s] = textos[i]; });
  const { porQ } = silabear(P, letras);
  const corte = hasta > 0 ? (P.secs.find(s => s.t1 >= hasta)?.t1 ?? fin) : fin;
  const lista = cantores(P, porQ, { semilla }).map(c => ({ ...c, notas: c.notas.filter(n => n.t0 < corte) })).filter(c => c.notas.length);
  return { P, op, partes, textos, corte, largo: corte + 2.2, fin, lista, letra: partes.map((p, i) => textos[i].join('\n')).join('\n\n') };
}

// a cada cantor, su voz y sus opciones. murga: { [lugar]: nombre de una voz del plantel }
export function repartir(lista, plantel, murga) {
  const porNombre = Object.fromEntries(plantel.map(v => [v.nombre, v])), veces = new Map();
  return lista.map(c => {
    const clave = c.cuerda + (c.c || 0), voz = porNombre[murga[clave]] || plantel.find(v => v.mbrola) || plantel[0];
    const k = veces.get(voz.nombre) || 0; veces.set(voz.nombre, k + 1);
    return { c, clave, voz, ...opcionesDe(c, voz, k) };
  });
}

// lo que cantó cada uno ([{ x, sr, inicio, pan, ganancia }]) junto, con la sala sobre las voces y la batería (los loops
// reales, el pico de la batería 0,55 del del coro, como en la página). bat: Float32Array a sr, o null.
export function mezclarMurga(cantados, sr, largo, bat, corte) {
  const L = new Float32Array(Math.ceil(largo * sr)), R = new Float32Array(L.length);
  for (const r of cantados) {
    const x = r.sr === sr ? r.x : remuestrear(r.x, r.sr, sr);
    let pk = 1e-9; for (const v of x) pk = Math.max(pk, Math.abs(v));
    const g = r.ganancia * .5 / pk, gl = Math.cos((r.pan + 1) * Math.PI / 4) * g, gr = Math.sin((r.pan + 1) * Math.PI / 4) * g;
    const a = Math.round(r.inicio * sr);
    for (let s = 0; s < x.length; s++) { const j = a + s; if (j >= 0 && j < L.length) { L[j] += x[s] * gl; R[j] += x[s] * gr; } }
  }
  sala(L, R, sr, { mezcla: .24, largo: 1.7 });
  if (bat) {
    let pv = 1e-9; for (let s = 0; s < L.length; s++) pv = Math.max(pv, Math.abs(L[s]), Math.abs(R[s]));
    let pb = 1e-9; for (const v of bat) pb = Math.max(pb, Math.abs(v));
    const gb = .55 * pv / pb;
    for (let s = 0; s < L.length; s++) { const f = s / sr < corte ? 1 : Math.max(0, 1 - (s / sr - corte) / 2); const v = (bat[s] || 0) * gb * f; L[s] += v; R[s] += v; }
  }
  normalizar(L, R);
  return { L, R };
}

// un wav estéreo de 16 bits
export function wavEstereo(L, R, sr) {
  const n = L.length, b = new ArrayBuffer(44 + n * 4), v = new DataView(b);
  const tx = (p, s) => { for (let i = 0; i < s.length; i++) v.setUint8(p + i, s.charCodeAt(i)); };
  tx(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); tx(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); tx(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { v.setInt16(44 + i * 4, Math.max(-32767, Math.min(32767, Math.round(L[i] * 32767))), true); v.setInt16(46 + i * 4, Math.max(-32767, Math.min(32767, Math.round(R[i] * 32767))), true); }
  return new Uint8Array(b);
}
