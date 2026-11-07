// Prueba el compositor con miles de combinaciones de parámetros: que no tire excepciones, que no deje secciones
// vacías y que no saque notas inválidas o que no se puedan cantar (las muestras van de 40 a 76, y la página corre
// la más cercana hasta 4 semitonos). Sale con código 1 si encuentra algo.
// Aparte cuenta, sin fallar, las notas fuera del rango de su cuerda.
//   node herramientas/probar_compositor.mjs
import { componer, CUERDAS, RANGOS } from '../motor/compositor.js';
import { MODELO } from '../motor/modelo.js';

let n = 0, malos = 0, notas = 0; const prob = {}, fuera = {}; const t0 = Date.now();
const anota = (k, o) => { prob[k] = prob[k] || { n: 0, ej: o }; prob[k].n++; };
const estilos = Object.keys(MODELO.estilos);
for (const forma of ['presentacion', 'retirada']) for (const estilo of estilos) for (const modo of ['menor', 'mayor']) for (const largo of ['corta', 'normal', 'larga'])
  for (const tonica of [0, 3, 6, 9, 11]) for (const clarinada of [true, false]) for (const modula of [true, false]) for (const tempo of [null, 70, 170])
    for (const cancionFinal of forma === 'retirada' ? [true, false] : [true]) {
      const op = { forma, estilo, modo, largo, tonica, clarinada, modula, tempo, cancionFinal, semilla: (n % 97) + 1, tercia: (n % 2) * .35, recita: (n % 3) - 1, llamadas: { 6: 1, 3: 1, 4: 1, 8: 1, 9: 1 } };
      n++;
      try {
        const P = componer(MODELO, op);
        if (!P.golpes.length) anota('sin golpes', op);
        for (const s of P.secs) if (s.tipo !== 'llamada' && s.tipo !== 'cierre' && !(s.golpes || []).length) anota('sección vacía: ' + s.nombre, op);
        for (const h of P.golpes) if (!Number.isFinite(h.top) || !Number.isFinite(h.q) || !Number.isFinite(h.d) || h.d <= 0) anota('golpe inválido', op);
        for (const k of CUERDAS) for (const e of P.ev[k]) {
          notas++;
          if (!Number.isFinite(e[2]) || !Number.isFinite(e[3])) anota('nota inválida', op);
          else if (e[2] < 36 || e[2] > 80) anota('nota que no se puede cantar: ' + e[2], op);
          else if (e[2] < RANGOS[k][0] - 2 || e[2] > RANGOS[k][1] + 2) fuera[k] = (fuera[k] || 0) + 1;
        }
        if (!(P.total > 0)) anota('largo total', op);
      } catch (e) { malos++; anota('EXCEPCIÓN ' + e.message.slice(0, 80), op); }
    }
console.log(n, 'combinaciones,', malos, 'excepciones,', ((Date.now() - t0) / 1000).toFixed(1) + ' s');
console.log('notas a más de 2 semitonos del rango de su cuerda:', Object.entries(fuera).map(([k, v]) => `${k} ${v}`).join(', ') || 'ninguna', `(de ${notas.toLocaleString('es-AR')})`);
for (const [k, v] of Object.entries(prob).sort((a, b) => b[1].n - a[1].n).slice(0, 14))
  console.log(String(v.n).padStart(6), k, '  ej:', JSON.stringify({ forma: v.ej.forma, estilo: v.ej.estilo, modo: v.ej.modo, largo: v.ej.largo, tonica: v.ej.tonica }));
process.exit(Object.keys(prob).length ? 1 : 0);
