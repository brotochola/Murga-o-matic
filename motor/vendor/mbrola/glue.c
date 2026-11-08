/* glue.c — MBROLA (LibOneChannel) para WebAssembly: un guion .pho entero entra, las muestras salen. */
#include <stdlib.h>
#include <string.h>
#include "common.h"
#include "parser_export.h"
#include "onechannel.h"

static short *res = NULL;
static int res_n = 0, res_cap = 0;

static int drenar(void) {
  int i;
  for (;;) {
    if (res_cap - res_n < 4096) {
      res_cap = res_cap ? res_cap * 2 : 1 << 16;
      res = (short *)realloc(res, res_cap * sizeof(short));
      if (!res) return -1;
    }
    i = read_MBR(res + res_n, 4096);
    if (i < 0) return -1;
    if (i == 0) return 0;
    res_n += i;
  }
}

/* con un difono que la voz no tiene, sigue (como mbrola -e) en lugar de cortar todo el guion */
int mb_init(char *db) { int r = init_MBR(db); if (r >= 0) setNoError_MBR(1); return r; }
int mb_freq(void) { return getFreq_MBR(); }
void *mb_alloc(int n) { return malloc(n); }
void mb_free(void *p) { free(p); }
short *mb_res(void) { return res; }
int mb_error(char *buf, int n) { return lastErrorStr_MBR(buf, n); }

/* devuelve cuántas muestras hay en mb_res(), o -1 */
int mb_synth(char *pho) {
  char linea[4096];
  char *p = pho, *q;
  res_n = 0;
  reset_MBR();
  while (*p) {
    size_t n;
    q = strchr(p, '\n');
    n = q ? (size_t)(q - p) : strlen(p);
    if (n > sizeof(linea) - 2) n = sizeof(linea) - 2;
    memcpy(linea, p, n); linea[n] = '\n'; linea[n + 1] = 0;
    if (write_MBR(linea) < 0) return -1;
    if (drenar() < 0) return -1;
    p = q ? q + 1 : p + n;
  }
  if (write_MBR("#\n") < 0) return -1;
  if (drenar() < 0) return -1;
  return res_n;
}
