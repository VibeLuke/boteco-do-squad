// Folha de prova do gore aos poucos (Fatia 4): cada NPC inteiro e perdendo parte por parte, em pé e caído.
// Uso: node tests/ferramentas/folha_gore.mjs <saida.png>
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

const ESC = 5;
const CELA = 40;
const etapas = [0, 1, 1 | 2, 1 | 2 | 4, 15, 31];
const POSES = (process.env.POSES || '').split(',').filter(Boolean);
const ids = POSES.length ? POSES : ['pinguco', 'cabeca', 'kelly', 'maria'];
const W = (etapas.length + 2) * CELA * ESC;
const H = ids.length * CELA * ESC;
const px = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) px.set([0x3a, 0x2a, 0x1c, 255], i * 4);
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
function por(g, cx, cy) {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y].length; x++) {
      const c = g[y][x];
      if (!c) continue;
      const rgb = hex(c);
      for (let a = 0; a < ESC; a++)
        for (let b = 0; b < ESC; b++) {
          const X = (cx + x) * ESC + b;
          const Y = (cy + y) * ESC + a;
          if (X < W && Y < H) px.set([...rgb, 255], (Y * W + X) * 4);
        }
    }
}
ids.forEach((id, r) => {
  const L = gente.NPCS.find((n) => n.id === (POSES.length ? 'pinguco' : id)).look;
  const base = !POSES.length ? sprites.buildBarGridLook(L, 'front') : id === 'punch' || id === 'hurt' ? sprites.buildGridLook(L, id) : sprites.buildBarGridLook(L, id);
  etapas.forEach((k, c) => por(sprites.cortarGrid(base, k, id === 'punch' || id === 'hurt' ? id : 'normal'), c * CELA + 8, r * CELA + 3));
  por(sprites.buildDeadCortadoGridLook(L, 1 | 8), etapas.length * CELA + 2, r * CELA + 12);
  por(sprites.buildDeadCortadoGridLook(L, 31), (etapas.length + 1) * CELA + 2, r * CELA + 12);
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
const saida = process.argv[2] || 'folha_gore.png';
fs.writeFileSync(saida, png);
console.log(`${saida}: ${W}×${H}, ${ids.length} NPCs × ${etapas.length + 2} quadros`);
