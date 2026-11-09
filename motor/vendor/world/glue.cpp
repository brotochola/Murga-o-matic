// glue.cpp — WORLD (Morise, BSD) para la página: analiza una grabación en altura (f0), envolvente (sp) y aire (ap),
// y vuelve a sintetizar con otra altura y otro largo. Lo compila herramientas/compilar_world.sh.
// Todo va en double, cuadro por cuadro: sp y ap son cuadros × (fft/2 + 1), seguidos.
#include <stdlib.h>
#include "world/harvest.h"
#include "world/dio.h"
#include "world/stonemask.h"
#include "world/cheaptrick.h"
#include "world/d4c.h"
#include "world/synthesis.h"

static double **filas(double *base, int n, int ancho) {
  double **f = (double **)malloc(sizeof(double *) * (n > 0 ? n : 1));
  for (int i = 0; i < n; i++) f[i] = base + (size_t)i * ancho;
  return f;
}

extern "C" {

void *w_alloc(int bytes) { return malloc(bytes); }
void w_free(void *p) { free(p); }

// el largo de la FFT de CheapTrick y D4C para esta frecuencia y esta altura mínima
int w_fft(int fs, double f0min) {
  CheapTrickOption o; InitializeCheapTrickOption(fs, &o); o.f0_floor = f0min;
  return GetFFTSizeForCheapTrick(fs, &o);
}

int w_cuadros(int fs, int n, double periodo) { return GetSamplesForHarvest(fs, n, periodo); }

// x: n muestras. f0 y tpos: cuadros. sp y ap: cuadros × (fft/2 + 1). harvest 1: Harvest (mejor, más lento); 0: DIO
// con StoneMask. Si f0dado es 1, f0 ya viene calculado y no se busca la altura.
void w_analizar(const double *x, int n, int fs, double periodo, int harvest, double f0min, double f0max, int fft,
                int f0dado, double *f0, double *tpos, double *sp, double *ap) {
  int cuadros = GetSamplesForHarvest(fs, n, periodo);
  if (!f0dado) {
    if (harvest) {
      HarvestOption o; InitializeHarvestOption(&o);
      o.frame_period = periodo; o.f0_floor = f0min; o.f0_ceil = f0max;
      Harvest(x, n, fs, &o, tpos, f0);
    } else {
      DioOption o; InitializeDioOption(&o);
      o.frame_period = periodo; o.f0_floor = f0min; o.f0_ceil = f0max; o.speed = 1; o.allowed_range = 0.1;
      double *f0crudo = (double *)malloc(sizeof(double) * cuadros);
      Dio(x, n, fs, &o, tpos, f0crudo);
      StoneMask(x, n, fs, tpos, f0crudo, cuadros, f0);
      free(f0crudo);
    }
  } else {
    for (int i = 0; i < cuadros; i++) tpos[i] = i * periodo / 1000.0;
  }
  int ancho = fft / 2 + 1;
  double **S = filas(sp, cuadros, ancho), **A = filas(ap, cuadros, ancho);
  CheapTrickOption co; InitializeCheapTrickOption(fs, &co); co.f0_floor = f0min; co.fft_size = fft;
  CheapTrick(x, n, fs, tpos, f0, cuadros, &co, S);
  D4COption dop; InitializeD4COption(&dop); dop.threshold = 0.85;
  D4C(x, n, fs, tpos, f0, cuadros, fft, &dop, A);
  free(S); free(A);
}

// sintetiza `largo` muestras desde cuadros de f0, sp y ap (cuadros cada `periodo` ms)
void w_sintetizar(const double *f0, int cuadros, double *sp, double *ap, int fft, double periodo, int fs, int largo,
                  double *y) {
  int ancho = fft / 2 + 1;
  double **S = filas(sp, cuadros, ancho), **A = filas(ap, cuadros, ancho);
  Synthesis(f0, cuadros, (const double *const *)S, (const double *const *)A, fft, periodo, fs, largo, y);
  free(S); free(A);
}

}
