// Lee MIDI: notas con su tiempo en pulsos (el mapa de tempo del MIDI sigue los pulsos reales)
// y en segundos. Sirve en Node; no depende de nada.

export function leerMidi(bytes) {
  const d = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let i = 0;
  const u8 = () => d[i++];
  const u16 = () => (d[i++] << 8) | d[i++];
  const u32 = () => ((d[i++] << 24) | (d[i++] << 16) | (d[i++] << 8) | d[i++]) >>> 0;
  const vlq = () => { let v = 0, b; do { b = d[i++]; v = (v << 7) | (b & 127); } while (b & 128); return v; };
  const tag = () => String.fromCharCode(d[i++], d[i++], d[i++], d[i++]);

  if (tag() !== 'MThd') throw new Error('no es MIDI');
  const largoCab = u32(); const formato = u16(); const nPistas = u16(); const tpb = u16();
  i += largoCab - 6;

  const notas = [], tempos = [], compases = [], pistas = [];
  for (let p = 0; p < nPistas && i < d.length; p++) {
    if (tag() !== 'MTrk') break;
    const largo = u32(), fin = i + largo;
    let tick = 0, estado = 0, nombre = '';
    const abiertas = new Map();
    while (i < fin) {
      tick += vlq();
      let b = d[i];
      if (b & 128) { estado = b; i++; } else b = estado;
      const tipo = b & 0xf0, canal = b & 15;
      if (b === 0xff) {
        const meta = u8(), n = vlq();
        if (meta === 0x51) tempos.push({ tick, usq: (d[i] << 16) | (d[i + 1] << 8) | d[i + 2] });
        else if (meta === 0x58) compases.push({ tick, num: d[i], den: 2 ** d[i + 1] });
        else if (meta === 3) nombre = new TextDecoder().decode(d.subarray(i, i + n));
        i += n;
      } else if (b === 0xf0 || b === 0xf7) {
        i += vlq();
      } else if (tipo === 0x90 || tipo === 0x80) {
        const nota = u8(), vel = u8(), k = canal * 128 + nota;
        if (tipo === 0x90 && vel > 0) {
          if (!abiertas.has(k)) abiertas.set(k, []);
          abiertas.get(k).push({ tick, vel });
        } else if (abiertas.get(k)?.length) {
          const a = abiertas.get(k).shift();
          notas.push({ tick: a.tick, fin: tick, nota, vel: a.vel, canal, pista: p });
        }
      } else if (tipo === 0xc0 || tipo === 0xd0) i += 1;
      else i += 2;
    }
    i = fin;
    pistas.push(nombre);
  }

  tempos.sort((a, b) => a.tick - b.tick);
  if (!tempos.length || tempos[0].tick > 0) tempos.unshift({ tick: 0, usq: 500000 });
  let seg = 0;
  for (let k = 0; k < tempos.length; k++) {
    tempos[k].seg = seg;
    if (k + 1 < tempos.length) seg += (tempos[k + 1].tick - tempos[k].tick) / tpb * tempos[k].usq / 1e6;
  }
  const aSeg = tick => {
    let lo = 0, hi = tempos.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (tempos[m].tick <= tick) lo = m; else hi = m - 1; }
    return tempos[lo].seg + (tick - tempos[lo].tick) / tpb * tempos[lo].usq / 1e6;
  };
  notas.sort((a, b) => a.tick - b.tick || a.nota - b.nota);
  return {
    formato, tpb, tempos, compases, pistas,
    notas: notas.map(n => ({ b: n.tick / tpb, fin: n.fin / tpb, p: n.nota, t: aSeg(n.tick), tf: aSeg(n.fin), vel: n.vel })),
    aSeg: b => aSeg(b * tpb),
  };
}

const NOM = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
export const nomNota = p => NOM[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1);
export const nomPc = pc => NOM[((pc % 12) + 12) % 12];
