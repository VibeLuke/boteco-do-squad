// Folha de conferência das poses do bar (5 jogadores × 10 poses) em PNG, sem dependências.
// Uso: node scripts/folha-bar.mjs [saida.png] [--rabiscos]   (--rabiscos: ressacas com 0 a 3 rabiscos de caneta)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PLAYERS, BAR_POSES, buildBarGrid } = await import(pathToFileURL(path.join(root, 'src/arena/sprites.ts')).href);

const INK = process.argv.includes('--rabiscos');
const COLS = INK
  ? ['ko-flat', 'ko-bottle', 'ko-slump'].flatMap((pose) => [0, 1, 2, 3].map((ink) => ({ pose, ink })))
  : BAR_POSES.map((pose) => ({ pose, ink: 0 }));
const S = 5; // ampliação
const CELL_W = 36 * S;
const CELL_H = 36 * S;
const PAD = 8;
const W = PAD + COLS.length * (CELL_W + PAD);
const H = PAD + PLAYERS.length * (CELL_H + PAD);
const px = Buffer.alloc(W * H * 4);
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const fill = (x0, y0, w, h, [r, g, b]) => {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * W + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
};
fill(0, 0, W, H, hex('#2a2138'));
PLAYERS.forEach((p, row) => {
  COLS.forEach(({ pose, ink }, col) => {
    const g = buildBarGrid(p.id, pose, ink);
    const ox = PAD + col * (CELL_W + PAD);
    const oy = PAD + row * (CELL_H + PAD);
    fill(ox, oy, CELL_W, CELL_H, hex('#3a2f4f'));
    // Ancorado embaixo e centralizado, como no motor.
    const bx = ox + Math.floor((CELL_W - g[0].length * S) / 2);
    const by = oy + CELL_H - g.length * S - S;
    g.forEach((r, y) => r.forEach((c, x) => c && fill(bx + x * S, by + y * S, S, S, hex(c))));
  });
});

// PNG mínimo (IHDR + IDAT + IEND).
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
const out = arg ?? path.join(root, 'docs', INK ? 'folha-bar-rabiscos.png' : 'folha-bar.png');
fs.writeFileSync(out, png);
console.log(`folha do bar ${W}x${H} (${COLS.map((c) => c.pose + (c.ink ? '+' + c.ink : '')).join(', ')}) -> ${out}`);
