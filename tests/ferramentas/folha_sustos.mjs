// Folha das criaturas do banheiro assombrado (Fatia 4), saída do mesmo desenho do jogo.
// Uso: node tests/ferramentas/folha_sustos.mjs <saida.png>
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
const arteS = await import(pathToFileURL(path.join(aqui, '../../src/vivo/assombroArte.ts')).href);

const ESC = 6;
const CELA = 52;
const ids = [['inquilino', 0], ['inquilino', 1], ['menina', 0], ['menina', 0, 1], ['chapeu', 0], ['toto', 0], ['corredor', 0], ['radio', 0]];
const W = ids.length * CELA * ESC;
const H = CELA * ESC;
const px = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) px.set([0x8b, 0x9b, 0xb4, 255], i * 4);
ids.forEach((id, k) => {
  const r = arteS.spriteSusto(id[0], id[1], id[2] ?? 0).raster;
  const ox = k * CELA + Math.floor((CELA - r.w) / 2);
  const oy = Math.floor((CELA - r.h) / 2);
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const o = (y * r.w + x) * 4;
      if (!r.data[o + 3]) continue;
      for (let a = 0; a < ESC; a++)
        for (let b = 0; b < ESC; b++) px.set([r.data[o], r.data[o + 1], r.data[o + 2], 255], (((oy + y) * ESC + a) * W + (ox + x) * ESC + b) * 4);
    }
});

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
const saida = process.argv[2] || 'folha_sustos.png';
fs.writeFileSync(saida, png);
console.log(`${saida}: ${W}×${H}, ${ids.length} itens`);
