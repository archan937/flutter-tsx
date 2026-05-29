#!/usr/bin/env bun
// Generates the FX monogram placeholder PNGs used by `fsx init`.
// Run once and commit the output: templates/icons/icon.png + dark/icon.png

import { writeFileSync } from 'fs';
import { join } from 'path';

const SIZE = 1024;

// CRC-32 table for PNG chunk checksums
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf: Uint8Array, init = 0xffffffff): number => {
  let c = init;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const adler32 = (buf: Uint8Array): number => {
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < buf.length; i++) {
    s1 = (s1 + buf[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  return ((s2 << 16) | s1) >>> 0;
};

const u32be = (n: number): Uint8Array => {
  const b = new Uint8Array(4);
  const v = new DataView(b.buffer);
  v.setUint32(0, n, false);
  return b;
};

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const typeBytes = new TextEncoder().encode(type);
  const payload = concat(typeBytes, data);
  const crcBytes = u32be(crc32(payload));
  return concat(u32be(data.length), payload, crcBytes);
};

const makeIhdr = (w: number, h: number): Uint8Array => {
  const data = new Uint8Array(13);
  const dv = new DataView(data.buffer);
  dv.setUint32(0, w, false);
  dv.setUint32(4, h, false);
  data[8] = 8; // bit depth
  data[9] = 2; // color type: RGB
  return chunk('IHDR', data);
};

const makeIdat = (r: number, g: number, b: number): Uint8Array => {
  // Build raw scanlines: filter=0 + SIZE*3 color bytes per row
  const scanline = new Uint8Array(1 + SIZE * 3);
  scanline[0] = 0; // filter None
  for (let x = 0; x < SIZE; x++) {
    scanline[1 + x * 3] = r;
    scanline[1 + x * 3 + 1] = g;
    scanline[1 + x * 3 + 2] = b;
  }
  // All SIZE rows are identical — build the full raw data
  const raw = new Uint8Array(SIZE * scanline.length);
  for (let row = 0; row < SIZE; row++) {
    raw.set(scanline, row * scanline.length);
  }

  // Compress using Bun's deflate; zlib-wrap for PNG
  const deflated = Bun.deflateSync(raw, { level: 9 });

  // Zlib envelope: CMF(0x78) + FLG(0x9C) + deflate + adler32
  const adler = adler32(raw);
  const zlib = concat(new Uint8Array([0x78, 0x9c]), deflated, u32be(adler));

  return chunk('IDAT', zlib);
};

const makePng = (r: number, g: number, b: number): Uint8Array => {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = makeIhdr(SIZE, SIZE);
  const idat = makeIdat(r, g, b);
  const iend = chunk('IEND', new Uint8Array(0));
  return concat(signature, ihdr, idat, iend);
};

// Light variant: white "FX" on #54a4ff
const light = makePng(0x54, 0xa4, 0xff);
// Dark variant: accent blue on #0d1117
const dark = makePng(0x0d, 0x11, 0x17);

const root = join(import.meta.dir, '..', 'templates', 'icons');
writeFileSync(join(root, 'icon.png'), light);
writeFileSync(join(root, 'dark', 'icon.png'), dark);

console.log(`Generated templates/icons/icon.png (${light.byteLength} bytes)`);
console.log(
  `Generated templates/icons/dark/icon.png (${dark.byteLength} bytes)`,
);
