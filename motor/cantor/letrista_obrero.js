// letrista_obrero.js — el letrista en un obrero: escribe la letra sin trabar la página (con una pieza larga tarda un
// par de segundos). Recibe { id, forma, tema, metrica, semilla } (lo de escribirLetraLocal) y devuelve { id, r } o
// { id, error }. Si el obrero no anda, la página escribe la letra ella misma (app.js, letristaEnObrero).
import { escribirLetraLocal } from './letrista_local.js';

self.onmessage = ({ data: { id, ...o } }) => {
  try { self.postMessage({ id, r: escribirLetraLocal(o) }); }
  catch (e) { self.postMessage({ id, error: String(e?.message || e) }); }
};
