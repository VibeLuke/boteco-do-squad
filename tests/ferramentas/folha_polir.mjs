// Folha antes × depois do acabamento dos bonecos (Fatia 4, lote G): sem e com polir().
// Uso: node tests/ferramentas/folha_polir.mjs <saida.png>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

registerHooks({
  resolve(spec, ctx, next) {
    if ((spec.startsWith('./') || spec.startsWith('../')) && !path.extname(spec) && ctx.parentURL) {
      const cand = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), `${spec}.ts`);
      if (fs.existsSync(cand)) return next(pathToFileURL(cand).href, ctx);
    }
    return next(spec, ctx);
  },
});
const aqui = path.dirname(fileURLToPath(import.meta.url));
const sprites = await import(pathToFileURL(path.join(aqui, '../../src/arena/sprites.ts')).href);
const gente = await import(pathToFileURL(path.join(aqui, '../../src/vivo/gente.ts')).href);

const ESC = 4;
const CELA = 28;
const looks = [
  ...sprites.PLAYERS.map((p) => p.look),
  ...['ze', 'tonhao', 'kelly', 'maria', 'muamba'].map((id) => gente.NPCS.find((n) => n.id === id).look),
];
const quadros = [
  (L) => sprites.buildBarGridLook(L, 'front'),
  (L) => sprites.polir(sprites.buildBarGridLook(L, 'front')),
  (L) => sprites.polir(sprites.buildBarGridLook(L, 'front-a')),
  (L) => sprites.polir(sprites.buildBarGridLook(L, 'back')),
  (L) => sprites.polir(sprites.buildGridLook(L, 'punch')),
];
const W = looks.length * CELA * ESC;
const H = quadros.length * 38 * ESC;
const px = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) px.set([0x8b, 0x9b, 0xb4, 255], i * 4);
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
looks.forEach((L, i) =>
  quadros.forEach((q, j) => {
    const g = q(L);
    for (let y = 0; y < g.length; y++)
      for (let x = 0; x < g[y].length; x++) {
        const c = g[y][x];
        if (!c) continue;
        const rgb = hex(c);
        for (let a = 0; a < ESC; a++)
          for (let b = 0; b < ESC; b++) px.set([...rgb, 255], ((j * 38 + 2 + y) * ESC + a) * W * 4 + ((i * CELA + 2 + x) * ESC + b) * 4);
      }
  }),
);

// PNG mínimo (RGBA 8 bits, sem filtro).
const crcT = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc = (b) => {
  let c = -1;
  for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (t, d) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t), d]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr.set([8, 6, 0, 0, 0], 8);
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) Buffer.from(px.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const saida = process.argv[2] || 'folha_polir.png';
fs.writeFileSync(saida, png);
console.log(`${saida}: ${W}×${H}`);
