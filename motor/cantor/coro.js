// coro.js — de una pieza del Murga-o-matic + una letra a lo que canta cada cantor.
import { versosDe, silabasCantadas, alinear, partes } from './letra.js';

export const CORO = {
  bajos: { cantores: 2, tipo: 'bajo', pan: -.55, ganancia: .8 },
  segundos: { cantores: 3, tipo: 'baritono', pan: -.25, ganancia: .85 },
  primos: { cantores: 4, tipo: 'tenor', pan: .05, ganancia: 1 },
  sobreprimos: { cantores: 3, tipo: 'tenorAlto', pan: .35, ganancia: .8 },
  tercia: { cantores: 1, tipo: 'tenorAlto', pan: .6, ganancia: .7 },
};

// Tiempo de cada semicorchea (igual que la página: cada sección a su tempo, con calderones)
export function tiempos(P) {
  const local = (s, x) => { let u = x; for (const [a, b, f] of s.estirar || []) u += (f - 1) * Math.max(0, Math.min(x, b) - a); return u * s.paso; };
  let t = 0;
  for (const s of P.secs) { s.paso = 60 / (s.tempo * 4); s.t0 = t; s.t1 = t + local(s, s.largo); t = s.t1; }
  const L = P.secs;
  const T = q => { let lo = 0, hi = L.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (L[m].inicio <= q) lo = m; else hi = m - 1; } const s = L[lo]; return s.t0 + local(s, q - s.inicio); };
  return { T, fin: t };
}

// Las secciones con letra y sus versos (sílabas, acentos) — lo que se le pide al letrista
export function metrica(P) {
  return P.secs.filter(s => (s.golpes || []).length && s.tipo !== 'cierre' && s.tipo !== 'llamada').map(s => {
    const V = versosDe(s.golpes.map(g => ({ q: g.q - s.inicio, d: g.d, p: g.top })));
    return { nombre: s.nombre, tipo: s.tipo, repite: s.nombre.includes('repetida') || s.nombre.includes('otra vuelta'), versos: V.map(v => ({ silabas: v.silabas, acentos: v.acentos.map(a => a + 1), tipo: v.tipo, golpes: v.golpes })) };
  });
}

// letras: { [nombreSección]: [verso, verso, ...] } → mapa q absoluto → qué sílaba canta el coro ahí
export function silabear(P, letras) {
  const porQ = new Map();
  const informe = [], detalle = new Map();
  for (const s of P.secs) {
    const L = letras[s.nombre];
    if (!L || !(s.golpes || []).length) continue;
    const V = versosDe(s.golpes.map(g => ({ q: g.q - s.inicio, d: g.d, p: g.top })));
    V.forEach((v, i) => {
      const texto = L[i] ?? '';
      const sils = texto.trim() ? silabasCantadas(texto) : [];
      let r = sils.length ? alinear(sils, v.golpes) : null;
      if (!r) {
        // no entra ni con melismas ni partiendo notas: lo que sobra va en "la", lo que falta se canta con la última vocal
        const relleno = v.golpes.map((g, k) => ({ sil: sils[k] || { texto: 'la', fon: ['l', 'a'], acento: false }, notas: [g] }));
        r = { reparto: relleno, costo: 99 };
      }
      informe.push({ seccion: s.nombre, verso: i, texto, silabas: sils.length, notas: v.golpes.length, costo: +r.costo.toFixed(2) });
      detalle.set(s.nombre + '|' + i, { golpes: v.golpes.map(g => ({ q: s.inicio + g.q, d: g.d, p: g.p })), acentos: v.acentos.map(a => a + 1), tipo: v.tipo,
        reparto: r.reparto.map(({ sil, notas }) => ({ texto: sil.texto, acento: sil.acento, fin: sil.fin !== false, fon: partes(sil.fon), notas: notas.map(g => ({ q: s.inicio + g.q, d: g.d, p: g.p, parte: !!g.parte })) })) });
      for (const { sil, notas } of r.reparto) {
        const p = partes(sil.fon);
        notas.forEach((g, k) => {
          const ultima = k === notas.length - 1;
          const vocal = p.nucleo.filter(x => 'aeiou'.includes(x)).slice(-1);
          const parte = k === 0 ? { ataque: p.ataque, nucleo: p.nucleo, coda: ultima ? p.coda : [] } : { ataque: [], nucleo: vocal.length ? vocal : ['a'], coda: ultima ? p.coda : [] };
          porQ.set(s.inicio + g.q, { sil: parte, texto: sil.texto, d: g.d, parte: !!g.parte, melisma: notas.length > 1 });
        });
      }
    });
  }
  return { porQ, informe, detalle };
}

// Qué canta cada cantor: notas con su sílaba y en segundos
export function cantores(P, porQ, { semilla = 1 } = {}) {
  const { T } = tiempos(P);
  const res = [];
  let n = 0;
  for (const [k, cfg] of Object.entries(CORO)) {
    const ev = (P.ev[k] || []).slice().sort((a, b) => a[0] - b[0] || b[2] - a[2]);
    // golpes partidos en dos sílabas: la nota de cada cuerda también se parte
    const ev2 = [];
    for (const e of ev) {
      const [q, d] = e;
      const a = porQ.get(q);
      if (a && a.parte && a.d < d) {
        const b = porQ.get(q + a.d);
        ev2.push([q, a.d, e[2], e[3], e[4], a.sil]);
        ev2.push([q + a.d, d - a.d, e[2], e[3], e[4], b ? b.sil : a.sil]);
      } else ev2.push([...e, a ? a.sil : null]);
    }
    // varias notas a la vez en una cuerda: se reparten los cantores
    const porAtaque = new Map();
    for (const e of ev2) { if (!porAtaque.has(e[0])) porAtaque.set(e[0], []); porAtaque.get(e[0]).push(e); }
    const lineas = Array.from({ length: cfg.cantores }, () => []);
    let ultLa = -99;
    for (const [q, grupo] of porAtaque) {
      grupo.sort((a, b) => b[2] - a[2]);
      for (let c = 0; c < cfg.cantores; c++) {
        const e = grupo[Math.min(grupo.length - 1, Math.floor(c * grupo.length / cfg.cantores))];
        if (e[4] && c > 0) continue;   // solo
        const [qq, d, p, din] = e;
        let sil = e[5];
        if (!sil) { sil = { ataque: q - ultLa > 2 ? ['l'] : [], nucleo: ['a'], coda: [] }; }
        const t0 = T(qq), t1 = T(qq + d);
        lineas[c].push({ t0, t1: t0 + (t1 - t0) * (d >= 3 ? .97 : .9), midi: p, vel: Math.pow((din || 90) / 127, 1.3), sil });
      }
      ultLa = q + (grupo[0][1] || 1);
    }
    lineas.forEach((notas, c) => {
      if (!notas.length) return;
      // ligado: el coro de murga no corta entre sílabas seguidas
      for (let i = 0; i + 1 < notas.length; i++) { const hueco = notas[i + 1].t0 - notas[i].t1; if (hueco > 0 && hueco < .25) notas[i].t1 = notas[i + 1].t0; }
      res.push({ cuerda: k, tipo: cfg.tipo, semilla: semilla * 101 + (n++) * 7, pan: Math.max(-1, Math.min(1, cfg.pan + (c - (cfg.cantores - 1) / 2) * .12)), ganancia: cfg.ganancia / Math.sqrt(cfg.cantores), notas });
    });
  }
  return res;
}
