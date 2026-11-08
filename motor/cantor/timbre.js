// Curva del ecualizador de la voz: el coro sintético cantando las notas de La Trasnochada 2020 (presentación, a capela), comparado con la grabación.
export const CURVA = [[100,26.9],[126,16.8],[159,11.7],[200,2.6],[252,4.9],[317,2.2],[400,1.3],[504,-3.1],[635,-4.2],[800,3.7],[1008,-5.6],[1270,7.5],[1600,-0.5],[2016,10.4],[2540,10.2],[3200,18.4],[4032,22],[5080,17.7],[6400,12.4],[8063,19.1],[10159,19.1]];

// Curva del coro de difonos, voz es2: herramientas/curva_difonos.py --voz es2, las mismas notas que CURVA cantadas
// por el coro de formantes (con su curva, que tiene el timbre del coro real) y por el de difonos.
export const CURVA_DIFONOS = [[100, 12.1], [126, 12.1], [159, -0.3], [200, -7.1], [252, -6.8], [317, -3.9], [400, -1.7], [504, -3.0], [635, 3.0], [800, 5.5], [1008, 6.4], [1270, 13.6], [1600, 11.1], [2016, 21.9], [2540, 18.0], [3200, 15.2], [4032, 24.1], [5080, 18.1], [6400, 12.9], [8063, 24.1]];

// Curva del coro de difonos, voz es1: herramientas/curva_difonos.py --voz es1, las mismas notas que CURVA cantadas
// por el coro de formantes (con su curva, que tiene el timbre del coro real) y por el de difonos.
export const CURVA_DIFONOS_ES1 = [[100, 12.2], [126, 7.2], [159, -0.9], [200, -4.5], [252, -3.0], [317, -1.3], [400, -1.1], [504, -0.0], [635, 2.1], [800, 0.4], [1008, -8.8], [1270, 1.6], [1600, -9.5], [2016, -4.7], [2540, 5.6], [3200, 3.2], [4032, 3.8], [5080, 15.9], [6400, 24.2], [8063, 24.2]];
