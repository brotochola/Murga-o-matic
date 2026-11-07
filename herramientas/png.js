// Un PNG simple, sin dependencias, para mirar rollos de notas.
import { deflateSync } from 'node:zlib';

const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };

export class Lienzo {
  constructor(an, al, fondo = [250, 250, 248]) {
    this.an = an; this.al = al; this.px = new Uint8Array(an * al * 3);
    for (let i = 0; i < an * al; i++) { this.px[i * 3] = fondo[0]; this.px[i * 3 + 1] = fondo[1]; this.px[i * 3 + 2] = fondo[2]; }
  }
  rect(x, y, w, h, c) {
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.an, Math.round(x + w)), y1 = Math.min(this.al, Math.round(y + h));
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
      const k = (j * this.an + i) * 3;
      this.px[k] = c[0]; this.px[k + 1] = c[1]; this.px[k + 2] = c[2];
    }
  }
  png() {
    const { an, al, px } = this;
    const crudo = Buffer.alloc((an * 3 + 1) * al);
    for (let j = 0; j < al; j++) { crudo[j * (an * 3 + 1)] = 0; Buffer.from(px.buffer, j * an * 3, an * 3).copy(crudo, j * (an * 3 + 1) + 1); }
    const trozo = (tipo, dato) => {
      const l = Buffer.alloc(4); l.writeUInt32BE(dato.length);
      const t = Buffer.concat([Buffer.from(tipo), dato]);
      const c = Buffer.alloc(4); c.writeUInt32BE(crc(t));
      return Buffer.concat([l, t, c]);
    };
    const ih = Buffer.alloc(13); ih.writeUInt32BE(an, 0); ih.writeUInt32BE(al, 4); ih[8] = 8; ih[9] = 2;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', ih), trozo('IDAT', deflateSync(crudo, { level: 6 })), trozo('IEND', Buffer.alloc(0))]);
  }
}
