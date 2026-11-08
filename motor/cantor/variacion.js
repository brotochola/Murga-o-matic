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
