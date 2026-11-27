/**
 * Desenho do bar: fundo (chão e paredes), móveis e bonecos em telas pequenas (1 px lógico = 1 px),
 * ampliadas por número inteiro sem suavização na tela de verdade.
 */
import { buildBarGrid, buildDeadGrid, buildGrid, polir, type BarPose, type Grid, type PlayerId } from '../arena/sprites';
import type { Weapon } from './blood';
import { TH, TW, tileToScreen } from './iso';
import { Raster, hex, type RGBA } from './raster';
import type { Prop, PropKind, Room } from './room';

export const MARGIN = 10;
/** Espaço acima da parede para cabeças e etiquetas. */
const HEADROOM = 8;

export interface Layout {
  /** Tamanho da tela lógica. */
  w: number;
  h: number;
  /** Onde fica o canto de cima do ladrilho (0,0) na tela lógica. */
  ox: number;
  oy: number;
}

export function layoutOf(room: Room): Layout {
  const ox = MARGIN + room.rows * (TW / 2);
  const oy = MARGIN + HEADROOM + room.wallH;
  const w = ox + room.cols * (TW / 2) + MARGIN;
  const h = oy + (room.cols + room.rows) * (TH / 2) + MARGIN + 6;
  return { w, h, ox, oy };
}

/* ----------------------------------------------------------------- fundo: chão e paredes de tijolo */

const FLOOR_A = hex('#5d3c2c');
const FLOOR_B = hex('#4f3224');
const FLOOR_LINE = hex('#3f271c');
const WALL_R = hex('#7d3a3c');
const WALL_L = hex('#5c2b33');
const MORTAR_R = hex('#5e2a2e');
const MORTAR_L = hex('#43202a');
const BASE = hex('#2e1d21');
const CAP = hex('#9c5a4a');
const DOOR = hex('#140f1c');
const DOOR_FRAME = hex('#8f563b');
const EXIT = hex('#63c74d');
const OPEN_LOW = hex('#c46a2c');
const OPEN_HIGH = hex('#8a3f1f');
const OPEN_SIGN = hex('#feae34');
const PLANK = hex('#9c6b43');
const PLANK_DARK = hex('#6b4426');
const WORK_Y = hex('#feae34');
const WORK_K = hex('#181425');
const CHALK = hex('#1f3a2c');
const CHALK_DUST = hex('#3d6b52');
const CHALK_FRAME = hex('#7a4a2e');

export function paintBackground(room: Room, L: Layout): Raster {
  const r = new Raster(L.w, L.h);
  const at = (tx: number, ty: number) => {
    const p = tileToScreen(tx, ty);
    return { x: L.ox + p.x, y: L.oy + p.y };
  };
  // Chão em tacos alternados com rejunte.
  for (let ty = 0; ty < room.rows; ty++) {
    for (let tx = 0; tx < room.cols; tx++) {
      const p = at(tx, ty);
      r.diamond(p.x, p.y + TH / 2, TW / 2, TH / 2, FLOOR_LINE);
      r.diamond(p.x, p.y + TH / 2, TW / 2 - 2, TH / 2 - 1, (tx + ty) % 2 ? FLOOR_A : FLOOR_B);
    }
  }
  // Paredes de fundo: tijolo com rejunte desencontrado, rodapé e acabamento no topo.
  const o = at(0, 0);
  const wallPixel = (x: number, y: number, side: 'R' | 'L') => {
    const u = side === 'R' ? x - o.x : o.x - x;
    const baseY = o.y + u / 2;
    const v = baseY - y; // altura acima do chão
    if (v < 0 || v >= room.wallH) return;
    for (const d of room.doors) {
      if (d.side !== side) continue;
      const di = d.i;
      if (u >= di * (TW / 2) + 2 && u < (di + 1) * (TW / 2) + 2 && v < 34) {
        const edge = u < di * (TW / 2) + 4 || u >= (di + 1) * (TW / 2) || v >= 32;
        const du = u - di * (TW / 2);
        let c: RGBA = edge ? DOOR_FRAME : DOOR;
        if (!edge && d.kind === 'exit' && v >= 26 && v < 29 && du >= 7 && du < 13) c = EXIT;
        if (!edge && d.kind === 'open') {
          // Passagem aberta: luz quente lá dentro, mais forte embaixo.
          c = v < 12 ? OPEN_LOW : OPEN_HIGH;
          if (v >= 26 && v < 29 && du >= 5 && du < 13) c = OPEN_SIGN;
        }
        if (!edge && d.kind === 'reforma') {
          // Tábuas pregadas em X e faixa de obra amarela e preta.
          const k = Math.floor(du + v * 0.5);
          c = (Math.floor(du) + Math.floor(v)) % 7 === 0 ? PLANK_DARK : PLANK;
          if (v >= 15 && v < 19) c = k % 4 < 2 ? WORK_Y : WORK_K;
        }
        r.set(x, y, c);
        return;
      }
    }
    if (side === 'R' && room.chalk) {
      // Lousão de giz pregado na parede (o texto e as cores dos chutes são escritos por cima no jogo).
      const u0 = room.chalk.from * (TW / 2) + 2;
      const u1 = (room.chalk.to + 1) * (TW / 2) - 2;
      if (u >= u0 && u < u1 && v >= 12 && v < 47) {
        const frame = u < u0 + 2 || u >= u1 - 2 || v < 14 || v >= 45;
        r.set(x, y, frame ? CHALK_FRAME : (Math.floor(u) * 7 + Math.floor(v) * 3) % 23 === 0 ? CHALK_DUST : CHALK);
        return;
      }
    }
    let c: RGBA = side === 'R' ? WALL_R : WALL_L;
    const row = Math.floor(v / 6);
    if (Math.floor(v) % 6 === 0 || (Math.floor(u) + (row % 2) * 8) % 16 === 0) c = side === 'R' ? MORTAR_R : MORTAR_L;
    if (v < 4) c = BASE;
    if (v >= room.wallH - 3) c = CAP;
    r.set(x, y, c);
  };
  const right = at(room.cols, 0);
  const left = at(0, room.rows);
  for (let y = 0; y < L.h; y++) {
    for (let x = Math.floor(o.x); x < Math.ceil(right.x); x++) wallPixel(x, y, 'R');
    for (let x = Math.floor(left.x); x < Math.ceil(o.x); x++) wallPixel(x, y, 'L');
  }
  return r;
}

/* ----------------------------------------------------------------- móveis */

export interface Sprite {
  raster: Raster;
  /** Ponto do desenho que fica no centro do ladrilho. */
  ax: number;
  ay: number;
}

const C = (c: string) => hex(c);

/**
 * Mesa de sinuca de 3×2 ladrilhos, desenhada a partir do ladrilho da frente (o de x e y maiores). Tampo de feltro
 * verde com borda de madeira, 6 caçapas, bolas e o triângulo; laterais e 4 pernas até o chão.
 */
function paintPool(): Sprite {
  const W = 3;
  const D = 2;
  const H = 13;
  const ax = 52;
  const ay = 52;
  const r = new Raster(92, 66);
  // Ponto (x, y) do chão, em ladrilhos relativos ao centro do ladrilho da frente, levantado h px.
  const P = (x: number, y: number, h = 0): [number, number] => [ax + (x - y) * (TW / 2), ay + (x + y) * (TH / 2) - h];
  const x0 = -(W - 0.5);
  const x1 = 0.5;
  const y0 = -(D - 0.5);
  const y1 = 0.5;
  // Pernas (só as 3 que aparecem).
  for (const [lx, ly] of [
    [x0 + 0.15, y1 - 0.15],
    [x1 - 0.15, y1 - 0.15],
    [x1 - 0.15, y0 + 0.15],
  ]) {
    const [px, py] = P(lx, ly);
    r.rect(Math.round(px) - 1, Math.round(py) - H + 2, 3, H - 2, C('#2b1912'));
    r.rect(Math.round(px) - 1, Math.round(py) - H + 2, 1, H - 2, C('#4a2c22'));
  }
  // Laterais da frente (avental de madeira).
  const apron = 5;
  r.poly([P(x0, y1, H), P(x1, y1, H), P(x1, y1, H - apron), P(x0, y1, H - apron)], C('#5c3620'));
  r.poly([P(x1, y1, H), P(x1, y0, H), P(x1, y0, H - apron), P(x1, y1, H - apron)], C('#7a4a2e'));
  // Borda de madeira e feltro.
  r.poly([P(x0, y0, H), P(x1, y0, H), P(x1, y1, H), P(x0, y1, H)], C('#a96a40'));
  const i = 0.2;
  r.poly([P(x0 + i, y0 + i, H), P(x1 - i, y0 + i, H), P(x1 - i, y1 - i, H), P(x0 + i, y1 - i, H)], C('#2e7d4a'));
  r.poly([P(x0 + i, y0 + i, H), P(x1 - i, y0 + i, H), P(x1 - i, y0 + i + 0.08, H), P(x0 + i, y0 + i + 0.08, H)], C('#1f5c37'));
  // Caçapas: 4 cantos e o meio dos lados compridos.
  const mid = (x0 + x1) / 2;
  for (const [cx, cy] of [
    [x0 + i, y0 + i],
    [x1 - i, y0 + i],
    [x1 - i, y1 - i],
    [x0 + i, y1 - i],
    [mid, y0 + i],
    [mid, y1 - i],
  ]) {
    const [px, py] = P(cx, cy, H);
    r.rect(Math.round(px) - 1, Math.round(py) - 1, 3, 2, C('#0b0a10'));
  }
  // Bolas: o triângulo de um lado e a branca do outro.
  const balls: [number, number, string][] = [
    [x0 + 0.7, y0 + 0.95, '#feae34'],
    [x0 + 0.55, y0 + 0.8, '#e43b44'],
    [x0 + 0.55, y0 + 1.1, '#0099db'],
    [x0 + 0.4, y0 + 0.65, '#63c74d'],
    [x0 + 0.4, y0 + 0.95, '#14101c'],
    [x0 + 0.4, y0 + 1.25, '#b55088'],
    [x1 - 0.7, y0 + 0.95, '#f4f4f4'],
  ];
  for (const [bx, by, c] of balls) {
    const [px, py] = P(bx, by, H);
    r.rect(Math.round(px) - 1, Math.round(py) - 1, 2, 2, C(c));
  }
  // Taco largado em cima da mesa.
  const [t0x, t0y] = P(x1 - 0.45, y0 + 0.6, H + 1);
  const [t1x, t1y] = P(x0 + 1.4, y1 - 0.35, H + 1);
  for (let k = 0; k <= 1; k += 1 / 40) r.set(Math.round(t0x + (t1x - t0x) * k), Math.round(t0y + (t1y - t0y) * k), C(k < 0.25 ? '#ead4aa' : '#8f563b'));
  return { raster: r, ax, ay };
}

/** Desenha um móvel numa tela própria: centro do ladrilho em (16, top + 8). */
function paintProp(kind: PropKind, seedX: number): Sprite {
  if (kind === 'pool') return paintPool();
  if (kind === 'void') return { raster: new Raster(1, 1), ax: 0, ay: 0 };
  const top = 46;
  const r = new Raster(TW + 2, top + TH + 2);
  const cx = TW / 2 + 1;
  const cy = top + TH / 2;
  switch (kind) {
    case 'counter': {
      r.box(cx, cy, 16, 8, 18, C('#b7794a'), C('#7a4a2e'), C('#5c3620'));
      r.diamond(cx, cy - 18, 16, 8, C('#c98b58'));
      r.diamond(cx, cy - 18, 13, 6, C('#a96a40'));
      if (seedX % 2 === 0) {
        // Chopeira: duas torneiras prateadas.
        r.rect(cx - 3, cy - 27, 1, 7, C('#c0cbdc'));
        r.rect(cx + 2, cy - 27, 1, 7, C('#c0cbdc'));
        r.rect(cx - 4, cy - 28, 7, 2, C('#8b9bb4'));
      } else {
        // Copo de chope com espuma.
        r.rect(cx - 1, cy - 24, 3, 5, C('#feae34'));
        r.rect(cx - 1, cy - 25, 3, 1, C('#f4f4f4'));
      }
      break;
    }
    case 'shelf': {
      r.box(cx, cy, 16, 8, 26, C('#4a2c22'), C('#3a2219'), C('#2b1912'));
      const bottles = ['#3e8948', '#b86f50', '#c0cbdc', '#733e39', '#3e8948', '#feae34'];
      for (let i = 0; i < 4; i++) {
        const bx = cx - 9 + i * 5;
        const by = cy - 26 - 2 + (i % 2);
        const col = C(bottles[(seedX + i) % bottles.length]);
        r.rect(bx, by - 7, 3, 7, col);
        r.rect(bx + 1, by - 10, 1, 3, col);
        r.set(bx, by - 6, C('#ffffff'));
      }
      break;
    }
    case 'stool': {
      r.rect(cx - 1, cy - 11, 1, 11, C('#4a4f5c'));
      r.rect(cx + 1, cy - 11, 1, 11, C('#333845'));
      r.box(cx, cy - 11, 6, 3, 3, C('#e43b44'), C('#a22633'), C('#73172d'));
      break;
    }
    case 'table': {
      r.rect(cx - 1, cy - 12, 3, 12, C('#2b1912'));
      r.diamond(cx, cy, 6, 3, C('#2b1912'));
      r.box(cx, cy - 12, 13, 6, 3, C('#a96a40'), C('#7a4a2e'), C('#5c3620'));
      // Dois copos e um petisco.
      r.rect(cx - 6, cy - 21, 3, 5, C('#feae34'));
      r.rect(cx - 6, cy - 22, 3, 1, C('#f4f4f4'));
      r.rect(cx + 3, cy - 20, 3, 4, C('#e43b44'));
      r.diamond(cx, cy - 15, 3, 1, C('#ead4aa'));
      break;
    }
    case 'jukebox': {
      r.box(cx, cy, 12, 6, 32, C('#ef7d57'), C('#b13e53'), C('#73172d'));
      for (let i = 0; i < 4; i++) r.rect(cx - 10 + i * 2, cy - 26 + i, 1, 18, C(i % 2 ? '#2ce8f5' : '#feae34'));
      r.rect(cx + 3, cy - 24, 6, 6, C('#2ce8f5'));
      r.rect(cx + 4, cy - 23, 4, 4, C('#0099db'));
      break;
    }
    case 'barrel': {
      r.box(cx, cy, 10, 5, 20, C('#8f563b'), C('#6b3d2a'), C('#4a2a1c'));
      r.rect(cx - 10, cy - 5, 20, 1, C('#5a6988'));
      r.rect(cx - 10, cy - 15, 20, 1, C('#5a6988'));
      break;
    }
    case 'board': {
      // Lousa de giz em cavalete, de frente: o texto (líder do placar) é escrito por cima na tela de verdade.
      r.rect(cx - 12, cy - 6, 2, 6, C('#5c3620'));
      r.rect(cx + 10, cy - 6, 2, 6, C('#5c3620'));
      r.rect(cx - 15, cy - 40, 30, 35, C('#7a4a2e'));
      r.rect(cx - 13, cy - 38, 26, 31, C('#1f3a2c'));
      r.rect(cx - 13, cy - 38, 26, 1, C('#2c5240'));
      r.rect(cx - 10, cy - 10, 5, 1, C('#e4e4e4')); // giz no aparador
      r.rect(cx - 15, cy - 6, 30, 2, C('#5c3620'));
      break;
    }
    case 'plant': {
      r.box(cx, cy, 6, 3, 8, C('#be4a2f'), C('#a23d26'), C('#7a2c1c'));
      const leaves: [number, number][] = [
        [0, -12], [-3, -14], [3, -15], [-5, -18], [5, -19], [0, -20], [-2, -24], [2, -23], [-6, -22], [6, -24],
      ];
      for (const [dx, dy] of leaves) r.rect(cx + dx - 1, cy + dy, 3, 3, C(dy < -18 ? '#63c74d' : '#3e8948'));
      break;
    }
  }
  return { raster: r, ax: cx, ay: cy };
}

/** Móvel derrubado: continua no mesmo ladrilho, deitado no chão. */
function paintFallen(kind: PropKind): Sprite {
  const top = 46;
  const r = new Raster(TW + 2, top + TH + 2);
  const cx = TW / 2 + 1;
  const cy = top + TH / 2;
  switch (kind) {
    case 'stool': {
      // Assento de lado no chão e as pernas apontando para a parede.
      r.rect(cx - 2, cy - 3, 11, 1, C('#4a4f5c'));
      r.rect(cx - 2, cy - 1, 11, 1, C('#333845'));
      r.rect(cx - 7, cy - 5, 4, 6, C('#a22633'));
      r.rect(cx - 8, cy - 4, 1, 4, C('#73172d'));
      r.rect(cx - 6, cy - 5, 2, 1, C('#e43b44'));
      break;
    }
    case 'table': {
      // Tampo tombado de quina (a face de cima virada para quem olha), pé deitado e os copos no chão.
      r.diamond(cx - 1, cy + 3, 9, 3, C('#c28a1f'));
      r.diamond(cx - 2, cy + 2, 5, 1, C('#feae34'));
      for (let i = 0; i < 20; i++) {
        const x = cx - 13 + i;
        const y0 = cy - 18 + Math.floor(i / 2);
        r.rect(x, y0, 1, 13, C('#a96a40'));
        r.rect(x, y0 + 13, 1, 2, C('#5c3620'));
        if (i === 0 || i === 19) r.rect(x, y0, 1, 15, C('#7a4a2e'));
      }
      for (let i = 2; i < 18; i += 5) r.rect(cx - 13 + i, cy - 16 + Math.floor(i / 2), 1, 9, C('#8f563b'));
      // Pé saindo do meio do tampo, deitado, com a base redonda em pé na ponta.
      r.rect(cx - 2, cy - 9, 12, 3, C('#2b1912'));
      r.rect(cx - 2, cy - 9, 12, 1, C('#4a2c22'));
      r.diamond(cx + 10, cy - 8, 2, 5, C('#2b1912'));
      // Copo caído e cacos.
      r.rect(cx + 5, cy + 1, 4, 2, C('#feae34'));
      r.rect(cx + 9, cy + 1, 1, 2, C('#f4f4f4'));
      r.rect(cx - 8, cy + 5, 1, 1, C('#f4f4f4'));
      r.rect(cx + 2, cy + 6, 1, 1, C('#f4f4f4'));
      r.rect(cx + 11, cy + 3, 2, 1, C('#e43b44'));
      break;
    }
    case 'plant': {
      // Vaso de lado, terra espalhada, folhas no chão.
      r.rect(cx - 6, cy - 6, 8, 6, C('#a23d26'));
      r.rect(cx - 6, cy - 6, 8, 1, C('#be4a2f'));
      r.rect(cx + 2, cy - 5, 1, 4, C('#7a2c1c'));
      r.diamond(cx + 6, cy, 5, 2, C('#4a2c22'));
      for (const [dx, dy] of [[5, -4], [8, -3], [10, -5], [7, -6], [11, -2]]) r.rect(cx + dx, cy + dy, 3, 2, C(dy < -4 ? '#63c74d' : '#3e8948'));
      break;
    }
    case 'barrel': {
      // Barril deitado: aros em pé.
      r.rect(cx - 10, cy - 10, 20, 10, C('#8f563b'));
      r.rect(cx - 10, cy - 10, 20, 2, C('#a8693f'));
      r.rect(cx - 10, cy - 2, 20, 2, C('#6b3d2a'));
      r.rect(cx - 6, cy - 10, 1, 10, C('#5a6988'));
      r.rect(cx + 5, cy - 10, 1, 10, C('#5a6988'));
      r.diamond(cx + 10, cy - 5, 2, 5, C('#4a2a1c'));
      break;
    }
    default:
      return paintProp(kind, 0);
  }
  return { raster: r, ax: cx, ay: cy };
}

const propCache = new Map<string, Sprite>();
export function propSprite(p: Prop, down = false): Sprite {
  const key = `${p.kind}:${p.x % 2}:${down ? 1 : 0}`;
  let s = propCache.get(key);
  if (!s) {
    s = down ? paintFallen(p.kind) : paintProp(p.kind, p.x);
    propCache.set(key, s);
  }
  return s;
}

/* ----------------------------------------------------------------- bonecos */

function gridRaster(g: Grid, flip: boolean): Raster {
  const h = g.length;
  const w = g[0].length;
  const r = new Raster(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = g[y][x];
      if (c) r.set(flip ? w - 1 - x : x, y, hex(c));
    }
  return r;
}

const spriteCache = new Map<string, Sprite>();
/** Poses do bar mais o soco e o "levou" da arena (mesmo tamanho de grade). */
export type AnyPose = BarPose | 'punch' | 'hurt' | 'dead';
/** Boneco pronto para desenhar; em pé ancorado nos pés, deitado ancorado no meio. */
export function playerSprite(id: PlayerId, pose: AnyPose, flip: boolean, ink = 0): Sprite {
  const key = `${id}:${pose}:${flip ? 1 : 0}:${ink}`;
  let s = spriteCache.get(key);
  if (!s) {
    const g = pose === 'punch' || pose === 'hurt' ? buildGrid(id, pose) : pose === 'dead' ? buildDeadGrid(id) : buildBarGrid(id, pose, ink);
    const raster = gridRaster(polir(g), flip);
    const lying = pose === 'ko-flat' || pose === 'ko-bottle' || pose === 'dead';
    // Em pé: os pés (últimas linhas pintadas) pisam 2 px abaixo do centro do ladrilho.
    let lastRow = g.length - 1;
    while (lastRow > 0 && g[lastRow].every((c) => !c)) lastRow--;
    s = lying
      ? { raster, ax: Math.floor(raster.w / 2), ay: Math.floor(raster.h / 2) + 2 }
      : { raster, ax: Math.floor(raster.w / 2), ay: lastRow - 1 };
    spriteCache.set(key, s);
  }
  return s;
}

/* ----------------------------------------------------------------- armas */

/** Arma pequena (para o chão do salão e para a mão de quem pegou). Ancorada na base. */
export function weaponSprite(w: Weapon): Sprite {
  const key = `arma:${w}`;
  let s = spriteCache.get(key);
  if (s) return s;
  const r = new Raster(16, 22);
  const cx = 8;
  const by = 20;
  switch (w) {
    case 'soco':
      r.rect(cx - 3, by - 6, 6, 5, C('#ead4aa'));
      r.rect(cx - 3, by - 6, 6, 1, C('#c28569'));
      break;
    case 'garrafa':
      // Garrafa verde com o fundo quebrado em ponta.
      r.rect(cx - 1, by - 16, 2, 4, C('#3e8948'));
      r.rect(cx - 2, by - 12, 4, 9, C('#3e8948'));
      r.set(cx - 1, by - 11, C('#a8e4a0'));
      r.set(cx - 2, by - 3, C('#c0cbdc'));
      r.set(cx + 1, by - 2, C('#c0cbdc'));
      r.set(cx, by - 3, C('#c0cbdc'));
      break;
    case 'taco':
      // Encostado, inclinado.
      for (let i = 0; i < 20; i++) r.rect(cx - 4 + Math.floor(i / 3), by - i, 1, 1, C(i < 7 ? '#5c3620' : i > 17 ? '#2ce8f5' : '#d6a46c'));
      break;
    case 'dardo':
      // Alvo de dardos pendurado e 2 dardos.
      r.diamond(cx, by - 12, 6, 6, C('#181425'));
      r.diamond(cx, by - 12, 5, 5, C('#e43b44'));
      r.diamond(cx, by - 12, 3, 3, C('#ead4aa'));
      r.diamond(cx, by - 12, 1, 1, C('#e43b44'));
      r.rect(cx + 2, by - 14, 4, 1, C('#feae34'));
      r.rect(cx - 5, by - 9, 4, 1, C('#feae34'));
      break;
    case 'banqueta':
      r.rect(cx - 1, by - 9, 1, 9, C('#4a4f5c'));
      r.rect(cx + 1, by - 9, 1, 9, C('#333845'));
      r.box(cx, by - 9, 5, 2, 2, C('#e43b44'), C('#a22633'), C('#73172d'));
      break;
    case 'frigideira':
      r.diamond(cx - 2, by - 6, 5, 3, C('#262b44'));
      r.diamond(cx - 2, by - 6, 4, 2, C('#3a4466'));
      r.rect(cx + 2, by - 7, 6, 1, C('#5c3620'));
      break;
  }
  s = { raster: r, ax: cx, ay: by };
  spriteCache.set(key, s);
  return s;
}

/** Sombra em losango sob quem está em pé. */
export function shadow(): Sprite {
  const r = new Raster(17, 7);
  r.diamond(8, 3, 8, 3, [0, 0, 0, 90]);
  return { raster: r, ax: 8, ay: 3 };
}
