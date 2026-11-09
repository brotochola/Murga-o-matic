// variacion.js — cuánto se diferencian los cantores sintéticos entre sí. Lo usan cantor.js y coro.js.
// Elegido a oído y medido contra La Trasnochada 2020 a capela, 4 fragmentos (herramientas/banco_medir.py): la distancia
// bajó de 12,0 a 6,8 en los de ajuste y de 9,7 a 7,8 en los de control. herramientas/banco_ajustar.py lo puede reescribir.
export const VARIACION = {
  desafinacion: 0.17,         // semitonos: cada cantor canta toda la pieza hasta este tanto alto o bajo
  desafinaNota: 0.06,         // y además cada nota hasta este tanto alta o baja
  retraso: 0.008,             // segundos: cada cantor entra siempre entre 0 y este tanto tarde
  desfase: 0.016,             // y en cada nota se corre hasta este tanto, para un lado o el otro
  vibrato: [0.09, 0.24],      // semitonos de profundidad, entre estos dos
  vibratoVel: [4.8, 6.2],     // Hz
  vibratoEntra: [0.15, 0.4],  // segundos: cuándo le entra el vibrato en una nota larga
  garganta: 0.03,             // largo del tracto: ±3 % sobre el de su tipo de voz
  pulso: 0.06,                // forma del pulso de la glotis: ±6 %
  aire: [0.75, 1.3],          // cuánto aire, multiplicando el de su tipo
  vocales: 0.03,              // cada vocal de cada cantor, F1 y F2 corridos hasta un 3 %
  diccion: 0.25,              // cuánto más largas o más cortas hace las consonantes que el resto
  pique: 0.4,                 // cuánto más o menos pica desde abajo al entrar después de un silencio
  volumen: 1.5,               // dB: cada cantor un poco más fuerte o más suave
  liderDb: 1.0,               // el primer cantor de cada cuerda, tantos dB más fuerte
  liderAdelanto: 0.006,       // y tantos segundos adelantado
};

// Cómo canta un murguista, medido en los solistas de verdad (docs/solistas_reales.md: 208 pasajes de una sola voz de 14
// murgas, con herramientas/solistas_medir.mjs), para los cantores de difonos y de banco (no para los de formantes, que
// usan la variación de arriba). Vibran ±40 cents (de 26 a 55) a 5,2 Hz y el vibrato les entra a los 260 ms: los nuestros
// vibraban ±13 y les entraba a los 390–440 ms. Medido la noche del 9 de noviembre de 2026
// (murga_trabajo/plan/noche_2026-11-09.md): con esto y ESTILO, la distancia al coro real (banco del coro) bajó de 6,23 a
// 5,82 (ajuste) y de 8,08 a 6,14 (control) con MBROLA, y de 4,40 a 3,86 y de 6,59 a 4,94 con los bancos.
export const VARIACION_DIFONOS = {
  vibrato: [0.30, 0.60],      // semitonos (lo pedido; MBROLA rinde un poco menos, WORLD casi igual)
  vibratoVel: [4.8, 5.7],     // Hz
  vibratoEntra: [0, 0.15],    // segundos (más los 0,3 s en que crece: llega a la mitad a los 250 ms)
};
// Y sus mañas (opciones de guion(), difonos.js): entran desde abajo (pique, semitonos; real: 219 cents, que llegan en
// 80 ms), se pasan de la nota al ligar un salto (pasa; real: 34 cents, que vuelven), la nota se mueve (deriva; real 7,6
// cents contra 3), las notas largas no crecen (crece, dB; real −0,7 dB/s, los bancos crecían +1,8), y caen al final de
// algunas frases (caida, semitonos, cada cantor entre la mitad y una vez y media; caidaProb, qué parte de los finales;
// real: el 68 % cae más de 50 cents, mediana 239), con golpe de voz en los acentos (golpe, dB). Los valores salen de
// cantar el solista de prueba hasta medir lo real: con estos, Whisper erra el 9,2 % de las letras de MBROLA (antes 16,4)
// y el 8,7 % de MIKE (antes 8,3).
export const ESTILO = { consonantes: 1.2, pique: 1.5, piqueVa: 0.1, pasa: 0.35, deriva: 0.2, crece: 0.5, caida: 2.5, caidaProb: 0.4, caidaLargo: 0.25, golpe: 4 };
// La dicción (consonantes, cuánto se alargan): con MBROLA, 1,2 hace entender más (coro entero: 17,0 % de letras mal contra
// 19,3 %); con los bancos estira el pedazo grabado y se entiende menos (MIKE solo: 11,9 % contra 8,2 %), así que 1.
// WORLD rinde distinto: con los bancos se mide más pique, más pasarse y la misma caída con menos
export const ESTILO_BANCO = { consonantes: 1, pique: 1.2, pasa: 0.15, caida: 1.5 };

// Los cantores de banco (voces de UTAU, motor/cantor/banco.js) cantaban demasiado juntos con la variación de arriba:
// sus grabaciones, resintetizadas con WORLD, son más limpias que MBROLA, y en el banco del coro la energía de cada
// armónico quedaba más pegada a la nota que en el coro real («una voz» 0,40–0,68 contra 0,30–0,44). Medido la noche del
// 9 de noviembre de 2026 (murga_trabajo/plan/noche_2026-11-09.md): con esto, y las curvas de color de cada voz
// (curvas_banco.js), la distancia al coro real bajó de 6,31 a 4,27 en los fragmentos de ajuste y de 9,77 a 6,01 en los
// de control. Más apertura (0,30 y 0,08 por nota) mejoraba los de ajuste y empeoraba los de control.
export const VARIACION_BANCO = {
  desafinacion: 0.25,         // semitonos, en vez de 0,17 (el vibrato, el de VARIACION_DIFONOS: antes 0,12–0,30)
  desafinaNota: 0.06,         // cada nota hasta este tanto alta o baja (banco.js)
  modulacion: 1.5,            // cuánto del temblor de altura de la grabación queda (1: el de la grabación)
  temblor: 0.08,              // semitonos de temblor rápido de la afinación (difonos.js guion), en vez de 0,04
};
// Cuánto gritan los cantores de banco (esforzar() de difonos.js), con «Gritan, como en el tablado»: la mitad que los
// de MBROLA (0,6). En el banco del coro, gritar acerca el timbre al del coro real (de 4,0 a 3,7 dB en los de ajuste)
// pero llena los huecos entre sílabas: con 0,3 la distancia de los 12 fragmentos sube de 4,85 a 5,12, con 0,6 a 5,32.
// «Gritan mucho» lo multiplica por 1,6 y «No gritan» lo apaga, como a los de MBROLA.
export const GRITO_BANCO = 0.3;
