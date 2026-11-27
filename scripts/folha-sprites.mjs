// Gera a folha de sprites (5 jogadores × 4 poses) em SVG para conferência visual.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PLAYERS, spriteRects, SPRITE_W, SPRITE_H } = await import(pathToFileURL(path.join(root, 'src/arena/sprites.ts')).href);
const poses = ['idle', 'punch', 'hurt', 'win'];
const S = 6, PAD = 12, LABEL = 20;
const cw = SPRITE_W * S + PAD, ch = SPRITE_H * S + PAD + LABEL;
let body = '';
PLAYERS.forEach((p, row) => {
  poses.forEach((pose, col) => {
    const ox = PAD + col * cw, oy = PAD + row * ch;
    body += `<g transform="translate(${ox} ${oy + LABEL}) scale(${S})">` +
      spriteRects(p.id, pose).map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`).join('') + '</g>';
    body += `<text x="${ox}" y="${oy + 14}" font-family="monospace" font-size="13" fill="#fff">${p.name} · ${pose}</text>`;
  });
});
const W = PAD + poses.length * cw, H = PAD + PLAYERS.length * ch;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#2a2138"/>${body}</svg>`;
const out = process.argv[2] ?? path.join(root, 'docs', 'folha-sprites.svg');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg);
console.log(`folha ${W}x${H} -> ${out}; rects/sprite:`, PLAYERS.map((p) => p.id + '=' + spriteRects(p.id, 'idle').length).join(' '));
