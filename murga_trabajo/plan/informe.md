# Informe del trabajo nocturno

2026-11-08 07:48 · Windows · placa NVIDIA

## Lo que dejó la noche, en corto

- **Seed-VC se probó con 3 de los 12 fragmentos.** Cada uno tardó unos 80 minutos en esta placa. Lo corté a las 07:48 para no pasar las 12 horas.
  - En los dos fragmentos de ajuste baja mucho la distancia al coro real: de 6,92 a 3,24. Lo que más mejora es el ataque y el hueco.
  - En el de control no cambia: de 9,97 a 9,92. Encima, el timbre empeora: de 5,8 a 8,5 dB.
  - Tres fragmentos no alcanzan para decidir nada.
  - Es lento y es un modelo de IA, así que no puede ir dentro del generador. Sirve, como mucho, para ver qué le falta al coro sintético: que entre más rápido y que el hueco sea menos marcado.
- **La variación entre cantores se ajustó y no quedó.** En los fragmentos de ajuste la distancia baja de 6,48 a 4,02, pero en los de control sube de 6,27 a 7,28. El buscador se aprende los fragmentos de ajuste, así que `motor/cantor/variacion.js` sigue con los valores puestos de oído (commit 21f147b).
- **No corrieron por falta de tiempo:** convertir las cuatro demos y la prueba de si se entiende la letra con Whisper (faltaba bajar whisper-small, 1 GB).
- **Para seguir:** si se vuelve a correr `uv run herramientas/trabajo_nocturno.py`, retoma la conversión. Como el paso quedó cortado, vuelve a convertir los 12 fragmentos desde el principio: son unas 16 horas.

| Paso | Estado | Duración |
|---|---|---|
| Elegir fragmentos de coro real | hecho | 1 min |
| Volver a cantarlos con el coro sintético de ahora | hecho | 0 min |
| Medir real contra sintético | hecho | 0 min |
| Buscar la mejor variación entre cantores (3 h) | hecho | 15 min |
| Medir con la variación ajustada | hecho | 1 min |
| Instalar Seed-VC | hecho | 0 min |
| Elegir voces de referencia | hecho | 2 min |
| Ajuste fino de Seed-VC con La Trasnochada | salteado |  |
| Convertir los fragmentos y medirlos | cortado — cortado a las 07:48 por el límite de 12 horas: 3 de 12 fragmentos convertidos (unos 80 min cada uno); las medidas son de esos 3 | 279 min |
| Convertir las cuatro demos | no corrió — sin tiempo: cada demo tardaría más de una hora |  |
| ¿Se entiende la letra? (Whisper) | no corrió — sin tiempo: faltaba bajar whisper-small (1 GB) |  |

## El coro sintético contra el real

Antes del ajuste:

| Fragmento | timbre dB | unísono ancho (real/sint) | una voz (real/sint) | ataque ms (real/sint) | hueco dB (real/sint) | distancia |
|---|---|---|---|---|---|---|
| 01_la_trasnochada_2020_presentacion | 5.4 | — / — | — / — | 66 / 96 | 1.82 / 4.84 | 4.40 |
| 02_agarrate_catalina_2008_presentacion | 7.2 | 0.46 / 0.93 | 0.43 / 0.66 | 40 / 106 | 2.31 / 3.64 | 13.08 |
| 03_la_gran_muneca_2016_final_y_retirada (control) | 5.4 | 0.21 / 0.94 | 0.26 / 0.37 | 96 / 114 | 8.34 / 4.19 | 7.34 |
| 04_la_trasnochada_2017_final_y_retirada | 5.5 | 0.13 / 0.92 | 0.40 / 0.63 | 52 / 85 | 4.81 / 3.01 | 10.86 |
| 05_metele_que_son_pasteles_2020_presentacion | 6.8 | 0.43 / 0.63 | 0.31 / 0.57 | 66 / 112 | 2.21 / 4.17 | 13.06 |
| 06_agarrate_catalina_2008_retirada (control) | 3.7 | 0.39 / 0.86 | 0.31 / 0.52 | 62 / 94 | 4.05 / 3.43 | 9.51 |
| 07_la_gran_muneca_2016_presentacion | 4.8 | 0.55 / 0.91 | 0.39 / 0.54 | 62 / 102 | 3.10 / 4.58 | 8.79 |
| 08_la_trasnochada_2017_presentacion | 5.8 | — / — | — / — | 76 / 99 | 5.96 / 3.84 | 3.57 |
| 09_metele_que_son_pasteles_2020_retirada (control) | 4.3 | 0.33 / 0.82 | 0.37 / 0.62 | 78 / 80 | 4.93 / 3.79 | 8.75 |
| 10_agarrate_catalina_2010_presentacion | 5.3 | 0.70 / 0.89 | 0.44 / 0.62 | 98 / 117 | 6.42 / 4.26 | 8.47 |
| 11_la_gran_muneca_2020_presentacion | 5.0 | 0.25 / 0.79 | 0.31 / 0.56 | 57 / 94 | 1.53 / 4.22 | 12.11 |
| 12_la_trasnochada_2019_final_y_retirada (control) | 4.2 | 0.20 / 0.80 | 0.36 / 0.58 | 62 / 94 | 5.12 / 3.65 | 10.08 |

Distancia media: ajuste 9.29 · control 8.92

Después del ajuste:

| Fragmento | timbre dB | unísono ancho (real/sint) | una voz (real/sint) | ataque ms (real/sint) | hueco dB (real/sint) | distancia |
|---|---|---|---|---|---|---|
| 01_la_trasnochada_2020_presentacion | 5.0 | — / — | — / — | 66 / 104 | 1.82 / 5.05 | 4.97 |
| 02_agarrate_catalina_2008_presentacion | 6.7 | 0.46 / 0.91 | 0.43 / 0.41 | 40 / 74 | 2.31 / 3.67 | 4.54 |
| 03_la_gran_muneca_2016_final_y_retirada (control) | 6.1 | 0.21 / 0.91 | 0.26 / 0.37 | 96 / 96 | 8.34 / 5.01 | 6.00 |
| 04_la_trasnochada_2017_final_y_retirada | 6.3 | 0.13 / 0.89 | 0.40 / 0.45 | 52 / 74 | 4.81 / 2.77 | 5.04 |
| 05_metele_que_son_pasteles_2020_presentacion | 6.4 | 0.43 / 0.59 | 0.31 / 0.37 | 66 / 64 | 2.21 / 3.24 | 3.66 |
| 06_agarrate_catalina_2008_retirada (control) | 3.3 | 0.39 / 0.83 | 0.31 / 0.50 | 62 / 92 | 4.05 / 3.48 | 8.70 |
| 07_la_gran_muneca_2016_presentacion | 4.7 | 0.55 / 0.84 | 0.39 / 0.39 | 62 / 84 | 3.10 / 4.43 | 3.07 |
| 08_la_trasnochada_2017_presentacion | 5.7 | — / — | — / — | 76 / 50 | 5.96 / 3.68 | 3.81 |
| 09_metele_que_son_pasteles_2020_retirada (control) | 4.5 | 0.33 / 0.82 | 0.37 / 0.39 | 78 / 100 | 4.93 / 4.73 | 2.73 |
| 10_agarrate_catalina_2010_presentacion | 4.9 | 0.70 / 0.87 | 0.44 / 0.42 | 98 / 88 | 6.42 / 4.01 | 3.19 |
| 11_la_gran_muneca_2020_presentacion | 4.8 | 0.25 / 0.81 | 0.31 / 0.41 | 57 / 65 | 1.53 / 4.34 | 5.80 |
| 12_la_trasnochada_2019_final_y_retirada (control) | 4.1 | 0.20 / 0.78 | 0.36 / 0.32 | 62 / 106 | 5.12 / 4.60 | 5.00 |

Distancia media: ajuste 4.26 · control 5.61

### La variación entre cantores

| Qué | Antes | Ajustada |
|---|---|---|
| desafinacion | 0.17 | 0.2032 |
| desafinaNota | 0.06 | 0.0 |
| retraso | 0.008 | 0.017 |
| desfase | 0.016 | 0.0113 |
| vibrato | [0.09, 0.24] | [0.02, 0.2044] |
| vibratoVel | [4.8, 6.2] | [4.8, 6.2] |
| vibratoEntra | [0.15, 0.4] | [0.15, 0.4] |
| garganta | 0.03 | 0.0283 |
| pulso | 0.06 | 0.06 |
| aire | [0.75, 1.3] | [0.75, 1.3] |
| vocales | 0.03 | 0.0539 |
| diccion | 0.25 | 0.25 |
| pique | 0.4 | 0.4 |
| volumen | 1.5 | 1.5 |
| liderDb | 1.0 | 1.8903 |
| liderAdelanto | 0.006 | 0.0 |

Distancia en los fragmentos de ajuste: 6.48 → 4.02; en los de control: 6.27 → 7.28. Si en los de control no mejora, `motor/cantor/variacion.js` queda como estaba.

## Seed-VC

Las mismas voces, sin convertir y convertidas, mezcladas igual:

Sin convertir:

| Fragmento | timbre dB | unísono ancho (real/sint) | una voz (real/sint) | ataque ms (real/sint) | hueco dB (real/sint) | distancia |
|---|---|---|---|---|---|---|
| 01_la_trasnochada_2020_presentacion | 5.2 | — / — | — / — | 66 / 100 | 1.82 / 4.55 | 4.49 |
| 02_agarrate_catalina_2008_presentacion | 7.2 | 0.46 / 0.92 | 0.43 / 0.55 | 40 / 94 | 2.31 / 4.42 | 9.36 |
| 03_la_gran_muneca_2016_final_y_retirada (control) | 5.8 | 0.21 / 0.93 | 0.26 / 0.48 | 96 / 100 | 8.34 / 4.02 | 9.97 |

Distancia media: ajuste 6.92 · control 9.97

Convertidas:

| Fragmento | timbre dB | unísono ancho (real/sint) | una voz (real/sint) | ataque ms (real/sint) | hueco dB (real/sint) | distancia |
|---|---|---|---|---|---|---|
| 01_la_trasnochada_2020_presentacion | 6.5 | — / — | — / — | 66 / 77 | 1.82 / 2.74 | 2.28 |
| 02_agarrate_catalina_2008_presentacion | 4.2 | 0.46 / 0.78 | 0.43 / 0.41 | 40 / 76 | 2.31 / 3.21 | 4.20 |
| 03_la_gran_muneca_2016_final_y_retirada (control) | 8.5 | 0.21 / 0.85 | 0.26 / 0.47 | 96 / 92 | 8.34 / 4.41 | 9.92 |

Distancia media: ajuste 3.24 · control 9.92

## Para escuchar

Todo en `D:\xampp\htdocs\Murga-o-matic\murga_trabajo`:

- Coro real: `banco/real/`
- Sintético antes y después del ajuste: `banco/sintetico/` y `banco/sintetico_despues/`
- Convertido con Seed-VC: `banco/para_seedvc/<fragmento>/coro_convertido.wav` (y `coro_sintetico.wav` para comparar)
- Demos: `cantada/<demo>/mezcla_convertida.wav` contra `mezcla_sintetica.wav`

Si `motor/cantor/variacion.js` cambió, mirá el cambio con `git diff`. Este informe se puede subir al repositorio: no tiene audio.
