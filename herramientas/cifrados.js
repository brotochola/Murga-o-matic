// Cifrados de murga escritos por personas (La Cuerda y GuitarTabsExplorer), pasados a grados.
// Sirven para dos cosas: medir el detector de acordes y darle al modelo una armonía de la que fiarse.
//
// tono: la tónica en semitonos desde do. Los que están en el corpus dicen a qué tramo corresponden.

export const CIFRADOS = [
  { titulo: 'Saludo 2010', murga: 'Agarrate Catalina', tramo: 'agarrate_catalina_2010_presentacion', parte: 'presentacion', modo: 'menor',
    tema: ['i bVII bVI bIII', 'V i bVI V', 'i bVII bVI bIII', 'V i bVI V'] },
  { titulo: 'Aporofobia', murga: 'Agarrate Catalina', tramo: 'agarrate_catalina_2020_final_y_retirada', parte: 'cancion_final', modo: 'menor',
    tema: ['i V i', 'V i', 'iv i', 'V i I7', 'iv i', 'V i'] },
  { titulo: 'El viaje', murga: 'Agarrate Catalina', tramo: 'agarrate_catalina_2008_retirada', parte: 'retirada', modo: 'mayor',
    tema: ['I IV I', 'IV V', 'IV V vi V IV', 'I IV V I', 'IV V IV', 'I', 'IV V'] },
  { titulo: 'Vidas comunes', murga: 'Agarrate Catalina', tramo: 'agarrate_catalina_2011_final_y_retirada', parte: 'cancion_final', modo: 'mayor',
    tema: ['I IV I V', 'I IV V V', 'I IV I V', 'I IV V V', 'IV IV', 'I I', 'V V', 'IV IV'] },
  { titulo: 'Retirada 2019', murga: 'Agarrate Catalina', tramo: 'agarrate_catalina_2019_retirada', parte: 'retirada', modo: 'mayor',
    tema: ['vi V V', 'V I V', 'I V V', 'I III', 'V I V', 'V V I', 'V I', 'V', 'v I'] },
  { titulo: 'Retirada a los faros (a capela)', murga: 'La Trasnochada', tramo: 'la_trasnochada_2019_final_y_retirada', parte: 'clarinada', modo: 'menor',
    tema: ['i', 'i', 'V', 'iv', 'i', 'bVII iv', 'bVI V', 'i', 'iv', 'V7', 'i', 'iv', 'V7', 'i', 'bVII', 'i', 'bVII', 'i', 'iv bVII bIII', 'V', 'i', 'i', 'iv', 'V', 'i'] },
  { titulo: 'Retirada a los faros', murga: 'La Trasnochada', tramo: 'la_trasnochada_2019_final_y_retirada', parte: 'retirada', modo: 'menor',
    tema: ['i', 'iv', 'V i', 'i', 'iv', 'V7', 'i', 'iv', 'bIII', 'V7', 'i', 'i iv', 'bIII', 'V7', 'i', 'iv', 'bIII', 'V7 i', 'bVII', 'bIII', 'V7', 'i', 'iv', 'V7', 'i', 'bVII bIII', 'bVI V7 i', 'i iv', 'V7', 'i', 'bVII bIII', 'bVI V7 i', 'i', 'iv', 'bVII', 'bIII', 'V', 'i'] },
  { titulo: 'Canción final', murga: 'La Trasnochada', parte: 'cancion_final', modo: 'mayor',
    tema: ['I', 'IV I', 'IV I', 'IV I', 'V7 I', 'IV I', 'V7 I', 'IV I', 'V7 I', 'IV I', 'V7 I', 'IV I'] },
  { titulo: 'Canción final (otra)', murga: 'La Trasnochada', parte: 'cancion_final', modo: 'mayor',
    tema: ['I IV', 'V I IV I', 'I IV', 'V vi', 'ii IV', 'I', 'V', 'ii IV', 'I', 'V'] },
];

// Del corpus de cifrados: qué grados se usan y qué sigue a qué
export function vocabulario(lista = CIFRADOS) {
  const uso = {}, pasos = {};
  for (const c of lista) {
    const sec = c.tema.join(' ').split(/\s+/);
    for (let i = 0; i < sec.length; i++) {
      const k = c.modo + ':' + sec[i];
      uso[k] = (uso[k] || 0) + 1;
      if (i && sec[i] !== sec[i - 1]) { const p = c.modo + ':' + sec[i - 1] + ' ' + sec[i]; pasos[p] = (pasos[p] || 0) + 1; }
    }
  }
  return { uso, pasos };
}
