// variacion.js — cuánto se diferencian los cantores sintéticos entre sí. Lo usan cantor.js y coro.js.
// herramientas/banco_ajustar.py lo reescribe con los valores que mejor imitan al coro real (medido con banco_medir.py).
export const VARIACION = {
  desafinacion: 0.09,        // semitonos: cada cantor canta toda la pieza hasta este tanto alto o bajo
  retraso: 0.03,             // segundos: cada cantor entra siempre entre 0 y este tanto tarde
  desfase: 0.014,            // segundos: y en cada nota se corre hasta este tanto, para un lado o el otro
  vibrato: [0.08, 0.17],     // semitonos de profundidad, entre estos dos
  vibratoVel: [5.0, 6.0],    // Hz
  garganta: 0.025,           // largo del tracto: ±2,5 % sobre el de su tipo de voz
  pulso: 0.05,               // forma del pulso de la glotis: ±5 %
  aire: [0.8, 1.25],         // cuánto aire, multiplicando el de su tipo
  vocales: 0,                // cada vocal de cada cantor, F1 y F2 corridos hasta este tanto (0: todos iguales)
  liderDb: 0,                // el primer cantor de cada cuerda, tantos dB más fuerte
  liderAdelanto: 0,          // y tantos segundos adelantado
};
