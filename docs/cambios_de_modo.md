# Cómo cambian de tono y de modo las murgas

Pregunta: en los cambios de sección, ¿las murgas pasan de mayor a menor o al revés? En particular, ¿pasan de Do menor a Do mayor después de un Sol7, o al revés? La respuesta sale de los 41 tramos transcriptos del corpus (267 minutos) con `herramientas/cambios_de_modo.js`.

> **Con 85 tramos (8 de noviembre de 2026).** El corpus pasó a 85 tramos de 13 murgas (515 minutos), con presentaciones y retiradas de 2023 a 2026. Hay 281 cambios que duran, y 135 confirmados. La conclusión se refuerza: entre los confirmados, el 56 % cambia de modo, y **de mayor al menor de la misma tónica es ahora el cambio más común** (19 casos; del menor al mayor de la misma tónica, 10). Ahora, "mismo tono, cambia el modo" es el 21 % de los confirmados (antes, el 10 %). Antes del cambio suena la dominante del tono nuevo en el 13 % de los casos. Las llegadas V → I en el modo contrario quedan en 8 % en menor y 4 % en mayor. `motor/modos.js` ya está rehecho con estos números. Las tablas de abajo son las del corpus de 41 tramos.
>
> | Confirmados (135) | |
> |---|---|
> | Otro tono, mismo modo | 44 % |
> | Otro tono y otro modo | 25 % |
> | Mismo tono, cambia el modo | 21 % |
> | A la relativa | 10 % |

## Cómo se midió

- **Tonalidad pulso a pulso:** perfiles de Krumhansl en ventanas de 8 compases, con un camino de Viterbi que castiga cambiar de tono. Es el mismo detector del análisis.
- **Cambios que duran:** cuatro compases o más en cada tono. Cada cambio se confirma con otra familia de perfiles (Aarden-Essen) aplicada a cada tramo entero; si las dos no coinciden, el cambio queda afuera del modelo.
- **Costuras:** un silencio del coro de dos tiempos o más, o la entrada o salida de la batería, a menos de un compás y medio del cambio.
- **Acordes sin ayuda:** el detector del análisis prefiere los acordes de la escala, y por eso casi nunca escribe un I mayor en menor. Acá los acordes salen sólo de las notas.
- **Modo de la llegada:** en cada V o V7 seguido de la tónica, se decide por la tercera que suena en las notas: mayor o menor.

## Lo que muestran

### Cambios de tono

| | Todos (135) | Confirmados (62) |
|---|---|---|
| Otro tono, mismo modo | 52 % | 53 % |
| Otro tono y otro modo | 36 % | 31 % |
| Mismo tono, cambia el modo | 7 % | 10 % |
| A la relativa | 5 % | 6 % |

- **Cambiar de modo es muy común:** casi la mitad de los cambios de tono (47 % de los confirmados) pasa de mayor a menor o al revés. Pero casi siempre cambia también la tónica.
- **Los cambios más frecuentes** (confirmados):
  - subir un semitono en menor: 8;
  - **de mayor al menor de la misma tónica: 6**;
  - subir un semitono en mayor: 5;
  - de menor al mayor sobre el VI (La menor → Fa mayor): 5;
  - de mayor al menor sobre el II (Do → Re menor): 4;
  - a la dominante: 4.
- **De menor al mayor de la misma tónica no se confirmó ninguno.** Sin confirmar hay dos; uno parece un error del detector. En el corpus, el cambio a la misma tónica va de mayor a menor.
- **Son cambios de verdad, no desvíos:** sólo el 2 % vuelve al tono anterior antes de 12 compases.
- **Cómo se llega:** casi siempre de golpe.
  - Justo antes suena la tónica vieja en el 32 % de los casos.
  - La dominante del tono nuevo, en el 15 %.
  - El IV del tono nuevo, en el 8 %.
  - En los cambios de mayor al menor de la misma tónica, la dominante aparece en 2 de 6.
- **Dónde:** dos de cada tres están en retiradas. Sólo el 21 % cae en un silencio del coro o en un cambio de la batería. El resto pasa con la batería sonando, sin un hueco que se note.

### Llegadas V → I

| Pasaje | Llegadas | En el modo contrario |
|---|---|---|
| En menor | 136 | 11 (8 %): 5 siguen al IV, como I7 → iv; sólo una se queda en mayor |
| En mayor | 213 | 5 (2 %) |

O sea: en menor, un Sol7 que llega a Do mayor aparece, pero casi siempre como color de paso (Do7 → Fa menor). No es un cambio de modo.

### Para escuchar

Los cambios de mayor al menor de la misma tónica que se confirmaron, con el minuto del tramo. Los acordes son los que estima el detector; la barra marca el cambio.

| Tramo | Minuto | Cambio | Acordes |
|---|---|---|---|
| Agarrate Catalina 2008, retirada | 4:11 | Fa mayor → Fa menor, en un silencio | Sol7 Do7 \| Lab \| Sibm |
| Agarrate Catalina 2010, retirada | 4:28 | Lab mayor → Lab menor | Sibm Lab Fa# \| Lab7 \| Sol |
| La Gran Muñeca 2016, presentación | 1:50 | Mib mayor → Mib menor | Mib Sib7 \| Labm |
| La Trasnochada 2019, presentación | 2:38 | Lab mayor → Lab menor, con la batería | Lab Sibm Lab7 Do# \| Labm |
| La Trasnochada 2020, retirada | 6:05 | Fa mayor → Fa menor | Re7 Fa Sib7 Sibm \| Fam |
| La Trasnochada 2026, retirada | 6:08 | Sol mayor → Sol menor | Re7 Solm \| Lam \| Solm |

La lista completa, con todos los cambios confirmados, queda en `murga_trabajo/cambios_de_modo.json` al correr la herramienta.

### Lo que dicen las fuentes

- Los cifrados de La Cuerda de Contrafarsa (ver [INVESTIGACION.md](../INVESTIGACION.md)) muestran el caso contrario: la Retirada 2002 empieza en Sol# menor y una nota dice que desde cierto punto la armonía pasa a mayor.
- Ese tramo no está en el corpus. Puede que en otras murgas o épocas el cambio a mayor sea más común que en estas cuatro.
- No encontramos textos sobre armonía de murga que traten los cambios de modo.

### Límites

- Las notas vienen de MuScriptor. Si confundió la tercera de un acorde, el modo sale mal; por eso el modelo usa sólo los cambios que confirman las dos familias de perfiles.
- Los números son chicos: 62 cambios confirmados en cuatro murgas.
- Las costuras sin silencio ni cambio de batería no se detectan, así que el 21 % es un piso.

## Cómo lo usa el compositor

`node herramientas/cambios_de_modo.js --modelo` escribe `motor/modos.js` y el compositor lo lee:

1. **Qué cambio de tono hacer.**
   - Se sortea entre los cambios confirmados que aparecen al menos dos veces.
   - Los de la murga elegida pesan el triple.
   - Antes, la tabla era a mano y sólo admitía unos pocos cambios.
   - Ahora, desde mayor, el cambio a la misma tónica en menor es uno de los más probables. Desde menor, lo más probable es subir un semitono o ir al mayor del VI.
2. **Cómo prepararlo.**
   - Los cambios se deciden antes de componer la sección anterior.
   - En el 15 % de los casos, el último compás de esa sección pasa a la dominante del tono nuevo. Cuando el cambio es de mayor al menor de la misma tónica, la proporción sube a un tercio.
   - Si no, el cambio llega de golpe, como en la mayoría del corpus.
3. **La llegada en el modo contrario.** Cuando una sección termina en V → I, a veces la tónica final llega en el otro modo: 4,4 % en menor y 2,3 % en mayor. Se descuentan los I7 que van al IV, porque esos ya los trae el vocabulario de acordes.
4. **Melodía y voces sobre el acorde nuevo.**
   - Las notas fuertes de la melodía van a la nota del acorde más cercana, y las débiles a la escala que suena sobre él.
   - Las voces de abajo se arman de nuevo sobre el acorde.
   - Esto usa un azar aparte, así que el resto de la pieza no cambia: en 239 de 240 piezas de prueba, todo lo que viene antes del primer cambio de tono es idéntico a la versión anterior.
   - Sobre los acordes cambiados, ninguna nota fuerte queda fuera del acorde. En el resto de la pieza, el 19 % sí queda fuera: son las notas de paso de los gestos reales.

El jurado da casi lo mismo que antes (mediana de 8,1–8,7, según la murga y la parte). Las demos se volvieron a elegir con `herramientas/demos.js`.

## Cambiar los acordes desde la página

En la tabla de estructura, «Cambiar acordes» abre la grilla de la sección: dos acordes por compás. Al elegir otro acorde, la pieza se vuelve a componer con la misma regla de arriba: la melodía se acomoda, las voces se rearman y el resto no cambia. Con cantores sintéticos, la letra se queda, aunque la hayas editado. Los acordes que cambió el compositor (la preparación o la llegada en el otro modo) aparecen con borde punteado, y los tuyos, resaltados.
