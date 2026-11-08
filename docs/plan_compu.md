# Plan para tu compu: medir y mejorar las voces

Hasta ahora, el coro sintético se calibró a mano y con un solo pasaje. Además, Seed-VC no se pudo probar porque necesita placa de video y bajar modelos. Este plan hace las dos cosas en tu compu, sola, con un solo comando. Usa las voces separadas que ya tenés de `murga_lote.py`.

## Qué hace

1. **Arma un banco de prueba.** Elige 12 fragmentos de coro real de 20 s de tus voces separadas, de todas las murgas que haya, mejor a capela. Siempre incluye la entrada de La Trasnochada 2020. Uno de cada tres queda de control: no se usa para ajustar, sólo para ver si el ajuste sirve fuera de lo ajustado.
2. **Vuelve a cantarlos** con el coro sintético: las mismas notas en los mismos segundos de la transcripción, con «la», o con la letra si se la das (ver abajo).
3. **Mide los dos con la misma vara.** Cada término de la distancia vale 1 cuando la diferencia ya se nota.

   | Medida | Qué mira |
   |---|---|
   | Timbre | El espectro promedio de las vocales |
   | Unísono | Qué tan ancho suena cada nota cuando cantan todos lo mismo, y cuánto se parece a una sola persona |
   | Ataque | Cuánto tarda en subir la energía en cada golpe: trece personas corridas suben más despacio que una |
   | Hueco | Cuánto baja la energía entre sílabas |

   Lo mismo con el **coro de difonos** de la página (paso `difonos`): así se ve si se acerca más al real que el de formantes en timbre, unísono, ataques y huecos. Acá, sin el audio real, sólo se pudo medir contra los números del informe anterior ([solista.md](solista.md)).
4. **Busca la mejor variación entre cantores**, durante las horas que le des. Prueba combinaciones de:
   - desafinación, retraso y desfase por nota;
   - vibrato y largo de garganta;
   - vocales propias de cada cantor, que es nuevo;
   - un cantor que lleva cada cuerda, un poco más fuerte y adelantado, que también es nuevo.

   Se queda con la que más se acerca al coro real. Si también mejora en los fragmentos de control, la escribe en `motor/cantor/variacion.js`. Si no, no toca nada.
5. **Con placa NVIDIA:**
   - instala Seed-VC y elige referencias de cada murga;
   - convierte los fragmentos y los mide con la misma vara, contra las mismas voces sin convertir mezcladas igual. Así se ve si Seed-VC acerca o aleja;
   - convierte las cuatro demos.
   - prueba con Whisper si se entiende la letra en el real, en el sintético y en el convertido.
6. **Escribe un informe:** `murga_trabajo/plan/informe.md`.

## Lo que hace falta

- El repositorio actualizado: `git pull`.
- [Node.js](https://nodejs.org) y [uv](https://docs.astral.sh/uv/).
- Las voces separadas en `murga_trabajo/voces/`, que ya tenés de `transcripcion/murga_lote.py`.
- Para Seed-VC:
  - una placa NVIDIA (la GTX 1650 de 4 GB debería alcanzar para convertir);
  - unos 8 GB libres;
  - internet la primera vez, para bajar Seed-VC, torch y los modelos.

## Correrlo

Desde la raíz del repositorio:

```bash
uv run herramientas/trabajo_nocturno.py --lista          # qué va a hacer
uv run herramientas/trabajo_nocturno.py                  # todo, con 3 horas de búsqueda
uv run herramientas/trabajo_nocturno.py --horas 6        # más horas de búsqueda
uv run herramientas/trabajo_nocturno.py --entrenar       # además, el ajuste fino de Seed-VC
uv run herramientas/trabajo_nocturno.py --sin-seedvc     # sólo el banco y la búsqueda
```

Cuánto tarda, a ojo:
- El banco y las medidas: unos minutos.
- La búsqueda: lo que le des con `--horas`.
- Instalar Seed-VC: de 10 a 30 minutos, según la conexión.
- Convertir los 12 fragmentos y las 4 demos: del orden de un par de horas con la placa. Es una estimación, no lo pude medir.
- El ajuste fino, con `--entrenar`: algunas horas más.

### Que la compu se quede laburando

- El script no deja que la compu se suspenda mientras trabaja, en Windows, Mac y Linux. Dejala enchufada.
- En una notebook, cerrar la tapa puede suspenderla igual. Dejala abierta, o configurá que al cerrar la tapa no haga nada.
- Si se corta o lo cortás con Ctrl+C, volvé a correr el mismo comando: sigue desde el paso que faltaba.
- Si un paso falla, lo reintenta una vez y sigue con los que no dependen de él. El informe dice qué falló.
- Todo lo que pasa queda en `murga_trabajo/plan/registro.txt`.
- Para repetir un paso: `--rehacer ajustar,informe`. Para empezar de cero: `--de-nuevo`.

## Con letra (opcional, mejor)

Sin letra, el coro sintético canta «la», y entonces las consonantes y la inteligibilidad no se pueden medir. Para medirlas, poné la letra de un fragmento en `murga_trabajo/banco/letras/<id del fragmento>.txt`, un verso por línea, con el mismo nombre que su audio en `murga_trabajo/banco/real/`. Después volvé a correr:

```bash
uv run herramientas/trabajo_nocturno.py --rehacer sintetizar,medir_antes,ajustar,medir_despues,seedvc_banco,inteligibilidad,informe
```

La despedida de La Trasnochada 2020, que ya alineamos, sirve.

## Al final

1. **Leé el informe.** Tiene:
   - las distancias antes y después;
   - la variación nueva;
   - Seed-VC contra sin convertir;
   - lo que entendió Whisper;
   - qué archivos escuchar.
2. **Escuchá.** Para comparar:
   - `banco/real/` contra `banco/sintetico/` (antes) y `banco/sintetico_despues/` (después);
   - en `banco/para_seedvc/<fragmento>/`, `coro_convertido.wav` contra `coro_sintetico.wav`;
   - en `cantada/<demo>/`, las mezclas de las demos.
3. **Revisá el cambio.** Si `motor/cantor/variacion.js` cambió, miralo con `git diff`. Si te gusta cómo suena, se sube y la página lo usa.
4. **Mandame el informe.** Subí `murga_trabajo/plan/informe.md` al repositorio (no tiene audio) o pegámelo, y sigo desde ahí.

## Las piezas

| Archivo | Qué hace |
|---|---|
| `herramientas/trabajo_nocturno.py` | Corre todo en orden, no deja dormir a la compu, guarda lo hecho y escribe el informe |
| `herramientas/banco_fragmentos.py` | Elige y corta los fragmentos reales |
| `herramientas/banco_sintetizar.mjs` | Los vuelve a cantar; con `--exportar`, cada cantor aparte para Seed-VC |
| `herramientas/banco_medir.py` | Las medidas y la distancia |
| `herramientas/banco_ajustar.py` | La búsqueda de la variación |
| `herramientas/banco_inteligibilidad.py` | Whisper sobre real, sintético y convertido |
| `transcripcion/convertir_coro.py`, `transcripcion/seedvc_lote.py` | Seed-VC. Ahora convierte todas las voces cargando los modelos una sola vez; si eso falla, convierte de a una |
| `motor/cantor/variacion.js` | Cuánto se diferencian los cantores; lo usan la página y las herramientas |
