# Informe del trabajo nocturno

2026-11-07 20:33 · Windows · placa NVIDIA

| Paso | Estado | Duración |
|---|---|---|
| Elegir fragmentos de coro real | hecho | 1 min |
| Volver a cantarlos con el coro sintético de ahora | hecho | 0 min |
| Medir real contra sintético | hecho | 0 min |
| Buscar la mejor variación entre cantores (6 h) | hecho | 15 min |
| Medir con la variación ajustada | hecho | 1 min |
| Instalar Seed-VC | salteado |  |
| Elegir voces de referencia | salteado |  |
| Ajuste fino de Seed-VC con La Trasnochada | salteado |  |
| Convertir los fragmentos y medirlos | salteado |  |
| Convertir las cuatro demos | salteado |  |
| ¿Se entiende la letra? (Whisper) | salteado |  |

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
| desafinacion | 0.09 | 0.2383 |
| retraso | 0.03 | 0.0457 |
| desfase | 0.014 | 0.0084 |
| vibrato | [0.08, 0.17] | [0.0367, 0.1151] |
| vibratoVel | [5.0, 6.0] | [5.0, 6.0] |
| garganta | 0.025 | 0.0472 |
| pulso | 0.05 | 0.05 |
| aire | [0.8, 1.25] | [0.8, 1.25] |
| vocales | 0 | 0.0412 |
| liderDb | 0 | 1.4945 |
| liderAdelanto | 0 | 0.0 |

Distancia en los fragmentos de ajuste: 9.29 → 4.26; en los de control: 8.92 → 5.61. Si en los de control no mejora, `motor/cantor/variacion.js` queda como estaba.

## Para escuchar

Todo en `D:\xampp\htdocs\Murga-o-matic\murga_trabajo`:

- Coro real: `banco/real/`
- Sintético antes y después del ajuste: `banco/sintetico/` y `banco/sintetico_despues/`
- Convertido con Seed-VC: `banco/para_seedvc/<fragmento>/coro_convertido.wav` (y `coro_sintetico.wav` para comparar)
- Demos: `cantada/<demo>/mezcla_convertida.wav` contra `mezcla_sintetica.wav`

Si `motor/cantor/variacion.js` cambió, mirá el cambio con `git diff`. Este informe se puede subir al repositorio: no tiene audio.
