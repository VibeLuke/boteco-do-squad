/**
 * Sprites pixel dos jogadores, desenhados em código (sem arquivos de imagem).
 * Cada personagem é montado em camadas numa grade 24×34 e ganha contorno automático.
 * O resultado vira retângulos mesclados por linha, prontos para um <svg shape-rendering="crispEdges">.
 */

import { PESSOAS, type PlayerId } from '../turma/index';
export type { PlayerId };
export type Pose = 'idle' | 'punch' | 'hurt' | 'win';

export const SPRITE_W = 24;
export const SPRITE_H = 34;
const OY = 1; // margem superior para o contorno do cabelo

const OUTLINE = '#181425';
const EYE = '#181425';
const GLARE = '#c0cbdc';
const TEETH = '#ffffff';
const MOUTH = '#5a1a28';

export interface Look {
  skin: string;
  skinShade: string;
  hair: string;
  shirt: string;
  shirtShade: string;
  pants: string;
  shoes: string;
  frame: string;
  /** Pernas de bermuda (pele aparece abaixo do joelho). */
  shorts?: boolean;
  hairStyle: 'curly' | 'neat' | 'side' | 'straight' | 'long';
  beard?: 'full' | 'short';
  beardColor?: string;
  extra?: 'turtle' | 'necklace' | 'nike' | 'vneck' | 'jacket';
  prop?: 'can';
  /** Sem óculos (padrão dos amigos: com) ou de óculos escuros. Usado pelos NPCs e pela personalização. */
  glasses?: 'none' | 'shades';
  /** Fatia 16: chapéu (prêmio de portal). O cabelo acima da aba some; o que cai pelos lados continua. */
  hat?: Chapeu;
}

export type Chapeu = 'bone' | 'palha' | 'cartola';
/** Cores de cada chapéu: base, sombra (aba e lado de baixo), luz (lado de cima) e fita. */
const CHAPEU_COR: Record<Chapeu, { base: string; sombra: string; luz: string; fita: string }> = {
  bone: { base: '#e43b44', sombra: '#a32735', luz: '#ff7a7a', fita: '#f4f4f4' },
  palha: { base: '#e8c25a', sombra: '#b8862a', luz: '#fff07a', fita: '#b8343c' },
  cartola: { base: '#3a4466', sombra: '#262b44', luz: '#6a7aa0', fita: '#feae34' },
};

export interface PlayerDef {
  id: PlayerId;
  name: string;
  color: string;
  tagline: string;
  look: Look;
}

/** A turma vem de src/turma/turma.ts (troque lá para montar o boteco de outra turma). */
export const PLAYERS: PlayerDef[] = PESSOAS.map((p) => ({ id: p.id, name: p.name, color: p.color, tagline: p.tagline, look: p.look }));

export const PLAYER_BY_ID: Record<PlayerId, PlayerDef> = Object.fromEntries(PLAYERS.map((p) => [p.id, p])) as Record<
  PlayerId,
  PlayerDef
>;

export function isPlayerId(v: unknown): v is PlayerId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PLAYER_BY_ID, v);
}

export type Grid = (string | null)[][];

function painter(dy = 0) {
  const g: Grid = Array.from({ length: SPRITE_H }, () => Array<string | null>(SPRITE_W).fill(null));
  const set = (x: number, y: number, c: string) => {
    const yy = y + OY + dy;
    if (x >= 0 && x < SPRITE_W && yy >= 0 && yy < SPRITE_H) g[yy][x] = c;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
  };
  const clear = (x: number, y: number) => {
    const yy = y + OY + dy;
    if (x >= 0 && x < SPRITE_W && yy >= 0 && yy < SPRITE_H) g[yy][x] = null;
  };
  const get = (x: number, y: number) => g[y + OY + dy]?.[x] ?? null;
  return { g, set, rect, clear, get };
}

type P = ReturnType<typeof painter>;

function drawLegs(p: P, L: Look) {
  // Calça/bermuda: y 24..28, duas pernas.
  if (L.shorts) {
    p.rect(8, 24, 15, 25, L.pants);
    p.rect(8, 26, 10, 26, L.pants);
    p.rect(13, 26, 15, 26, L.pants);
    p.rect(8, 27, 10, 28, L.skin);
    p.rect(13, 27, 15, 28, L.skin);
  } else {
    p.rect(8, 24, 15, 25, L.pants);
    p.rect(8, 26, 10, 28, L.pants);
    p.rect(13, 26, 15, 28, L.pants);
  }
  p.rect(7, 29, 10, 30, L.shoes);
  p.rect(13, 29, 16, 30, L.shoes);
  if (L.shoes === '#f4f4f4') {
    p.rect(7, 30, 10, 30, '#c0cbdc');
    p.rect(13, 30, 16, 30, '#c0cbdc');
  }
}

function drawTorso(p: P, L: Look) {
  p.rect(7, 16, 16, 23, L.shirt);
  p.rect(7, 23, 16, 23, L.shirtShade);
  p.rect(10, 15, 13, 15, L.skin); // pescoço
  switch (L.extra) {
    case 'turtle': // estampa verde na camiseta preta
      p.rect(10, 18, 13, 20, '#63c74d');
      p.rect(9, 19, 9, 19, '#3e8948');
      p.rect(14, 19, 14, 19, '#3e8948');
      p.set(11, 18, '#feae34');
      p.set(12, 21, '#3e8948');
      p.set(10, 21, '#3e8948');
      break;
    case 'necklace':
      p.set(9, 16, '#c0cbdc');
      p.set(10, 17, '#c0cbdc');
      p.set(11, 18, '#c0cbdc');
      p.set(12, 18, '#c0cbdc');
      p.set(13, 17, '#c0cbdc');
      p.set(14, 16, '#c0cbdc');
      p.rect(11, 19, 12, 20, '#181425');
      break;
    case 'nike':
      p.set(13, 18, '#262b44');
      p.set(14, 18, '#262b44');
      p.set(12, 19, '#262b44');
      break;
    case 'vneck':
      p.rect(10, 16, 13, 16, L.skin);
      p.rect(11, 17, 12, 17, L.skin);
      p.set(10, 19, '#3a3646');
      p.set(10, 20, '#3a3646');
      break;
    case 'jacket': {
      // Camisa listrada no meio, jaqueta jeans aberta nas laterais.
      for (let y = 16; y <= 23; y++) p.rect(10, y, 13, y, y % 2 === 0 ? '#ef7d57' : '#f4f4f4');
      p.rect(9, 16, 9, 23, '#2f4a78');
      p.rect(14, 16, 14, 23, '#2f4a78');
      p.set(8, 18, '#2f4a78');
      p.set(15, 18, '#2f4a78');
      break;
    }
  }
}

/**
 * Detalhes de roupa (Fatia 4, lote G): cinto com fivela, gola, dobras da camisa, punho da manga, vinco da calça e o
 * bico do sapato com brilho. Só repinta pixel que já é daquela peça (a forma do boneco não muda).
 */
function detalhar(p: P, L: Look, costas: boolean) {
  const se = (x: number, y: number, de: string, c: string) => {
    if (p.get(x, y) === de) p.set(x, y, c);
  };
  const cinto = '#3a2a1c';
  for (let x = 8; x <= 15; x++) se(x, 24, L.pants, cinto);
  if (!costas) {
    se(11, 24, cinto, '#c28a1f');
    se(12, 24, cinto, '#feae34');
  }
  // Vinco da calça e dobra no joelho.
  se(9, 27, L.pants, L.shirtShade === L.pants ? '#0b0a10' : tonsDe(L.pants).sombra);
  se(14, 26, L.pants, tonsDe(L.pants).sombra);
  // Camisa: gola (de frente), dobras e o punho das mangas.
  if (!costas && L.extra !== 'vneck' && L.extra !== 'jacket' && L.extra !== 'necklace') for (let x = 10; x <= 13; x++) se(x, 16, L.shirt, L.shirtShade);
  se(9, 21, L.shirt, L.shirtShade);
  se(14, 19, L.shirt, L.shirtShade);
  se(13, 20, L.shirt, L.shirtShade);
  for (const x of [5, 6, 17, 18]) se(x, 18, L.shirt, L.shirtShade);
  // Sapato: bico com brilho e sola clara.
  const luzSapato = tonsDe(L.shoes).luz;
  for (const x of [7, 8, 13, 14]) se(x, 29, L.shoes, luzSapato);
}

function sleeve(L: Look) {
  return L.extra === 'jacket' ? L.shirt : L.shirt;
}

function drawArms(p: P, L: Look, pose: Pose) {
  const s = sleeve(L);
  if (pose === 'idle') {
    p.rect(5, 16, 6, 18, s);
    p.rect(5, 19, 6, 21, L.skin);
    p.rect(17, 16, 18, 18, s);
    p.rect(17, 19, 18, 21, L.skin);
    p.rect(17, 22, 18, 22, L.skinShade);
    if (L.prop === 'can') {
      // Lata vermelha na mão esquerda (lado de fora).
      p.rect(3, 19, 5, 23, '#e43b44');
      p.rect(3, 21, 5, 21, '#f4f4f4');
      p.rect(3, 18, 5, 18, '#c0cbdc');
    } else {
      p.rect(5, 22, 6, 22, L.skinShade);
    }
  } else if (pose === 'punch') {
    // Braço de trás em guarda, braço da frente esticado com o punho.
    p.rect(5, 16, 6, 18, s);
    p.rect(6, 14, 7, 15, L.skin);
    p.rect(17, 16, 18, 18, s);
    p.rect(19, 17, 20, 18, L.skin);
    p.rect(21, 16, 22, 19, L.skin);
    p.set(22, 17, L.skinShade);
    p.set(22, 18, L.skinShade);
    if (L.prop === 'can') p.rect(4, 12, 6, 15, '#e43b44');
  } else if (pose === 'hurt') {
    // Braços abertos para os lados, levando o golpe.
    p.rect(4, 16, 6, 17, s);
    p.rect(2, 14, 3, 15, L.skin);
    p.rect(1, 12, 2, 13, L.skin);
    p.rect(17, 16, 19, 17, s);
    p.rect(20, 14, 21, 15, L.skin);
    p.rect(21, 12, 22, 13, L.skin);
    if (L.prop === 'can') p.rect(0, 9, 2, 11, '#e43b44');
  } else {
    // win: braços em V para cima, por fora da cabeça.
    p.rect(5, 16, 6, 17, s);
    p.rect(3, 14, 4, 15, s);
    p.rect(2, 11, 3, 13, L.skin);
    p.rect(1, 9, 2, 10, L.skin);
    p.rect(17, 16, 18, 17, s);
    p.rect(19, 14, 20, 15, s);
    p.rect(20, 11, 21, 13, L.skin);
    p.rect(21, 9, 22, 10, L.skin);
    if (L.prop === 'can') {
      p.rect(0, 5, 2, 8, '#e43b44');
      p.rect(0, 7, 2, 7, '#f4f4f4');
    }
  }
}

function drawHead(p: P, L: Look) {
  p.rect(6, 4, 17, 14, L.skin);
  p.clear(6, 4);
  p.clear(17, 4);
  p.clear(6, 14);
  p.clear(17, 14);
  p.rect(5, 9, 5, 10, L.skin); // orelhas
  p.rect(18, 9, 18, 10, L.skin);
  p.set(5, 10, L.skinShade);
  p.set(18, 10, L.skinShade);
  p.set(11, 11, L.skinShade); // nariz
  p.set(12, 11, L.skinShade);
}

function drawHair(p: P, L: Look) {
  const h = L.hair;
  switch (L.hairStyle) {
    case 'curly': {
      p.rect(5, 1, 18, 7, h);
      p.rect(4, 3, 19, 8, h);
      p.rect(4, 9, 5, 11, h);
      p.rect(18, 9, 19, 11, h);
      for (const x of [5, 8, 11, 14, 17]) p.set(x, 0, h);
      for (const x of [3, 20]) p.set(x, 5, h);
      p.clear(6, 7);
      p.clear(17, 7);
      p.rect(7, 8, 16, 8, L.skin);
      p.set(9, 7, L.skin);
      p.set(14, 7, L.skin);
      // brilho dos cachos
      for (const [x, y] of [
        [7, 2],
        [11, 1],
        [15, 3],
        [6, 5],
        [13, 4],
        [18, 6],
      ])
        p.set(x, y, '#5e3a22');
      break;
    }
    case 'neat': {
      p.rect(6, 2, 17, 6, h);
      p.rect(7, 1, 15, 1, h);
      p.rect(5, 5, 6, 9, h);
      p.rect(17, 5, 18, 9, h);
      p.set(14, 1, '#3a3333');
      p.set(10, 2, '#3a3333');
      p.rect(7, 7, 16, 7, L.skin);
      break;
    }
    case 'side': {
      p.rect(6, 2, 17, 5, h);
      p.rect(7, 1, 16, 1, h);
      p.rect(6, 6, 11, 7, h); // franja varrida para um lado
      p.rect(5, 4, 6, 9, h);
      p.rect(17, 4, 18, 8, h);
      p.set(12, 6, h);
      p.set(9, 2, '#7a5232');
      p.set(14, 3, '#7a5232');
      break;
    }
    case 'straight': {
      // Longo e liso, repartido ao meio, caindo até o peito por trás dos ombros.
      p.rect(6, 1, 17, 5, h);
      p.rect(5, 3, 18, 7, h);
      p.rect(4, 6, 6, 21, h);
      p.rect(17, 6, 19, 21, h);
      p.set(11, 1, '#5a4048');
      p.set(12, 2, '#5a4048');
      p.rect(7, 6, 10, 6, h);
      p.rect(13, 6, 16, 6, h);
      p.rect(7, 7, 16, 7, L.skin);
      p.set(11, 6, L.skin);
      p.set(12, 6, L.skin);
      for (const y of [8, 12, 16, 20]) {
        p.set(5, y, '#5a4048');
        p.set(18, y, '#5a4048');
      }
      break;
    }
    case 'long': {
      p.rect(5, 1, 18, 6, h);
      p.rect(4, 3, 19, 7, h);
      p.rect(3, 6, 6, 17, h);
      p.rect(17, 6, 20, 17, h);
      for (const [x, y] of [
        [2, 9],
        [2, 13],
        [21, 10],
        [21, 14],
        [4, 18],
        [19, 18],
        [6, 0],
        [10, 0],
        [14, 0],
        [17, 0],
      ])
        p.set(x, y, h);
      p.rect(7, 7, 16, 7, L.skin);
      p.set(8, 6, L.skin);
      p.set(15, 6, L.skin);
      for (const [x, y] of [
        [7, 2],
        [12, 1],
        [16, 3],
        [4, 9],
        [19, 12],
        [5, 15],
      ])
        p.set(x, y, '#3d2a30');
      break;
    }
  }
}

/**
 * Fatia 16: o chapéu por cima do cabelo, na mesma grade de 24 × 34 (sem crescer a grade, que mexeria nas âncoras).
 * Tudo acima da aba é apagado (o corte "encolhe sob o chapéu") e o chapéu ocupa as linhas 0 a 5 da cabeça.
 */
function drawHat(p: P, L: Look, costas: boolean) {
  if (!L.hat) return;
  const c = CHAPEU_COR[L.hat];
  const limpar = (ate: number) => {
    for (let y = -1; y <= ate; y++) for (let x = 0; x < SPRITE_W; x++) p.clear(x, y);
  };
  switch (L.hat) {
    case 'bone': {
      // Boné: copa redonda e a pala virada para quem olha (de costas, a fivela).
      limpar(costas ? 5 : 4);
      p.rect(6, 0, 17, costas ? 5 : 4, c.base);
      p.clear(6, 0);
      p.clear(17, 0);
      p.rect(8, 1, 10, 1, c.luz);
      p.rect(11, 0, 12, 0, c.sombra);
      if (costas) {
        p.rect(10, 4, 13, 4, c.sombra);
        p.rect(11, 5, 12, 5, c.fita);
      } else {
        p.rect(5, 5, 18, 5, c.sombra);
        p.rect(6, 4, 17, 4, c.sombra);
        p.rect(7, 4, 16, 4, c.base);
      }
      break;
    }
    case 'palha': {
      // Chapéu de palha: copa baixa trançada, fita vermelha e a aba larga passando da cabeça.
      limpar(3);
      p.rect(7, 0, 16, 3, c.base);
      p.clear(7, 0);
      p.clear(16, 0);
      for (let x = 8; x <= 15; x += 2) p.set(x, 1, c.sombra);
      p.rect(8, 0, 10, 0, c.luz);
      p.rect(7, 3, 16, 3, c.fita);
      p.rect(2, 4, 21, 4, c.base);
      p.rect(3, 5, 20, 5, c.sombra);
      p.set(2, 4, c.sombra);
      p.set(21, 4, c.sombra);
      break;
    }
    case 'cartola': {
      // Cartola de cartolina: copa alta e estreita, faixa dourada, um vinco de papel e a aba fina.
      limpar(4);
      p.rect(8, 0, 15, 4, c.base);
      p.rect(9, 0, 9, 2, c.luz);
      p.set(13, 1, c.luz);
      p.rect(8, 3, 15, 3, c.fita);
      p.rect(5, 5, 18, 5, c.sombra);
      break;
    }
  }
}

function drawBeard(p: P, L: Look) {
  if (!L.beard) return;
  const b = L.beardColor ?? L.hair;
  if (L.beard === 'full') {
    p.rect(6, 11, 6, 14, b);
    p.rect(17, 11, 17, 14, b);
    p.rect(7, 13, 16, 15, b);
    p.rect(9, 16, 14, 16, b);
    p.rect(9, 12, 14, 12, b); // bigode
  } else {
    p.rect(6, 11, 6, 13, b);
    p.rect(17, 11, 17, 13, b);
    p.rect(7, 13, 16, 14, b);
    p.rect(10, 12, 13, 12, b);
    p.set(7, 12, b);
    p.set(16, 12, b);
  }
}

function drawFace(p: P, L: Look, pose: Pose) {
  const f = L.frame;
  // Óculos: duas lentes 4×3, ponte e hastes (os cinco amigos usam óculos).
  if (L.glasses !== 'none') {
    p.rect(7, 9, 10, 11, f);
    p.rect(13, 9, 16, 11, f);
    p.rect(11, 9, 12, 9, f);
    p.set(6, 9, f);
    p.set(17, 9, f);
  }
  if (L.glasses === 'shades' && pose !== 'hurt') {
    p.rect(8, 10, 9, 10, '#0b0a10');
    p.rect(14, 10, 15, 10, '#0b0a10');
    p.set(8, 10, '#5a6988');
    p.set(14, 10, '#5a6988');
  } else if (pose === 'hurt') {
    p.rect(8, 10, 9, 10, '#94b0c2');
    p.rect(14, 10, 15, 10, '#94b0c2');
    p.set(8, 10, EYE);
    p.set(15, 10, EYE);
  } else {
    p.set(8, 10, GLARE);
    p.set(9, 10, EYE);
    p.set(14, 10, EYE);
    p.set(15, 10, GLARE);
  }
  // Boca por pose.
  const mouthY = 13;
  if (pose === 'idle') {
    p.set(10, mouthY - 1, MOUTH);
    p.rect(11, mouthY, 12, mouthY, MOUTH);
    p.set(13, mouthY - 1, MOUTH);
  } else if (pose === 'punch') {
    p.rect(10, mouthY - 1, 13, mouthY, MOUTH);
    p.rect(10, mouthY - 1, 13, mouthY - 1, TEETH);
  } else if (pose === 'hurt') {
    p.rect(11, mouthY - 1, 12, mouthY, MOUTH);
  } else {
    p.rect(10, mouthY - 1, 13, mouthY, MOUTH);
    p.rect(11, mouthY - 1, 12, mouthY - 1, TEETH);
    p.set(9, mouthY - 1, MOUTH);
    p.set(14, mouthY - 1, MOUTH);
  }
}

function outline(g: Grid) {
  const out = g.map((row) => row.slice());
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      if (g[y][x]) continue;
      const n = (yy: number, xx: number) => yy >= 0 && yy < SPRITE_H && xx >= 0 && xx < SPRITE_W && !!g[yy][xx];
      if (n(y - 1, x) || n(y + 1, x) || n(y, x - 1) || n(y, x + 1)) out[y][x] = OUTLINE;
    }
  }
  return out;
}

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  fill: string;
}

/** Monta a grade colorida de um jogador numa pose. */
export function buildGrid(id: PlayerId, pose: Pose): Grid {
  return buildGridLook(PLAYER_BY_ID[id].look, pose);
}

/** O mesmo para qualquer aparência (os NPCs do bar vivo usam o mesmo corpo dos amigos). */
export function buildGridLook(L: Look, pose: Pose): Grid {
  const p = painter();
  drawLegs(p, L);
  drawTorso(p, L);
  const longHair = L.hairStyle === 'long' || L.hairStyle === 'straight';
  if (longHair) drawHair(p, L); // cabelo longo cai por trás dos ombros
  drawHead(p, L);
  drawBeard(p, L);
  drawFace(p, L, pose);
  drawHair(p, L);
  // O rosto fica por cima do cabelo longo na área da face.
  if (longHair) {
    p.rect(7, 8, 16, 8, L.skin);
    drawFace(p, L, pose);
  }
  drawHat(p, L, false);
  drawArms(p, L, pose);
  detalhar(p, L, false);
  return outline(p.g);
}

const cache = new Map<string, SpriteRect[]>();

/** Retângulos mesclados por linha (1 rect por trecho contínuo da mesma cor). */
export function spriteRects(id: PlayerId, pose: Pose): SpriteRect[] {
  const key = `${id}:${pose}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const g = polir(buildGrid(id, pose));
  const rects: SpriteRect[] = [];
  for (let y = 0; y < SPRITE_H; y++) {
    let x = 0;
    while (x < SPRITE_W) {
      const c = g[y][x];
      if (!c) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < SPRITE_W && g[y][x + w] === c) w++;
      rects.push({ x, y, w, fill: c });
      x += w;
    }
  }
  cache.set(key, rects);
  return rects;
}

/** SVG em texto (para favicon, folha de sprites e testes). */
export function spriteSvg(id: PlayerId, pose: Pose, scale = 8): string {
  const body = spriteRects(id, pose)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.fill}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPRITE_W} ${SPRITE_H}" width="${SPRITE_W * scale}" height="${SPRITE_H * scale}" shape-rendering="crispEdges">${body}</svg>`;
}

/* ------------------------------------------------------------------------------------------------
 * Poses do bar isométrico: de frente e de costas (andando), sentado e três ressacas.
 * De frente serve para quem anda na direção da câmera; de costas, para quem se afasta.
 * As direções da esquerda saem espelhando (o motor vira o desenho).
 * ---------------------------------------------------------------------------------------------- */

export type BarPose =
  | 'front'
  | 'front-a'
  | 'front-b'
  | 'back'
  | 'back-a'
  | 'back-b'
  | 'sit'
  | 'ko-flat'
  | 'ko-bottle'
  | 'ko-slump';

export const BAR_POSES: BarPose[] = ['front', 'front-a', 'front-b', 'back', 'back-a', 'back-b', 'sit', 'ko-flat', 'ko-bottle', 'ko-slump'];

/** Pernas andando: passo "a" = perna da esquerda da tela no ar; "b" = a da direita. */
function drawLegsStep(p: P, L: Look, step: 'a' | 'b') {
  const lower = L.shorts ? L.skin : L.pants;
  p.rect(8, 24, 15, 25, L.pants);
  const lifted = step === 'a' ? [8, 10] : [13, 15];
  const planted = step === 'a' ? [13, 15] : [8, 10];
  // Perna apoiada: inteira.
  p.rect(planted[0], 26, planted[1], 26, L.pants);
  p.rect(planted[0], 27, planted[1], 28, lower);
  p.rect(planted[0] - (step === 'a' ? 0 : 1), 29, planted[1] + (step === 'a' ? 1 : 0), 30, L.shoes);
  // Perna no ar: 2 px mais curta, sapato subido.
  p.rect(lifted[0], 26, lifted[1], 26, L.pants);
  p.rect(lifted[0], 27, lifted[1], 27, lower);
  p.rect(lifted[0], 28, lifted[1], 28, L.shoes);
}

/** Braços balançando ao andar (mão contrária à perna que avança). */
function drawArmsStep(p: P, L: Look, step: 'a' | 'b', back = false) {
  const s = L.shirt;
  p.rect(5, 16, 6, 18, s);
  p.rect(17, 16, 18, 18, s);
  const leftUp = step === 'b';
  p.rect(5, leftUp ? 19 : 20, 6, leftUp ? 20 : 22, L.skin);
  p.rect(17, leftUp ? 20 : 19, 18, leftUp ? 22 : 20, L.skin);
  if (L.prop === 'can') {
    const x0 = back ? 18 : 3;
    const y0 = back ? (leftUp ? 20 : 19) : leftUp ? 19 : 20;
    p.rect(x0, y0, x0 + 2, y0 + 4, '#e43b44');
    p.rect(x0, y0 + 2, x0 + 2, y0 + 2, '#f4f4f4');
  }
}

function drawTorsoBack(p: P, L: Look) {
  const body = L.extra === 'jacket' ? '#2f4a78' : L.shirt;
  p.rect(7, 16, 16, 23, body);
  p.rect(7, 23, 16, 23, L.extra === 'jacket' ? '#24395e' : L.shirtShade);
  if (L.extra === 'jacket') p.rect(11, 17, 12, 22, '#24395e'); // costura das costas
  p.rect(10, 15, 13, 15, L.skin); // nuca
}

function drawHeadBack(p: P, L: Look) {
  p.rect(6, 4, 17, 14, L.skin);
  p.clear(6, 4);
  p.clear(17, 4);
  p.clear(6, 14);
  p.clear(17, 14);
  p.rect(5, 9, 5, 10, L.skin);
  p.rect(18, 9, 18, 10, L.skin);
}

function drawHairBack(p: P, L: Look) {
  const h = L.hair;
  const dots = (pts: number[][], c: string) => {
    for (const [x, y] of pts) p.set(x, y, c);
  };
  switch (L.hairStyle) {
    case 'curly':
      p.rect(5, 1, 18, 12, h);
      p.rect(4, 3, 19, 11, h);
      for (const x of [5, 8, 11, 14, 17]) p.set(x, 0, h);
      dots([[7, 3], [11, 2], [15, 5], [9, 8], [14, 10], [6, 9]], '#5e3a22');
      break;
    case 'neat':
      p.rect(6, 1, 17, 11, h);
      p.rect(5, 4, 18, 9, h);
      dots([[10, 3], [14, 6]], '#3a3333');
      break;
    case 'side':
      p.rect(6, 1, 17, 11, h);
      p.rect(5, 3, 18, 9, h);
      dots([[9, 3], [13, 7]], '#7a5232');
      break;
    case 'straight':
      p.rect(6, 1, 17, 21, h);
      p.rect(5, 3, 18, 21, h);
      p.rect(4, 7, 19, 20, h);
      dots([[11, 4], [11, 8], [11, 12], [11, 16], [11, 20], [15, 6], [15, 10], [15, 14], [15, 18]], '#5a4048');
      break;
    case 'long':
      p.rect(5, 1, 18, 18, h);
      p.rect(4, 3, 19, 17, h);
      p.rect(3, 6, 20, 16, h);
      dots([[2, 9], [21, 11], [2, 14], [21, 15], [6, 19], [17, 19], [6, 0], [12, 0], [17, 0]], h);
      dots([[7, 3], [12, 2], [16, 5], [9, 9], [14, 12], [6, 15], [17, 8]], '#3d2a30');
      break;
  }
  // Hastes dos óculos atrás das orelhas.
  if (L.glasses !== 'none') {
    p.set(5, 9, L.frame);
    p.set(18, 9, L.frame);
  }
}

/** Rosto de quem apagou: olhos fechados (ou em X), boca aberta e uma baba. */
function drawFaceKO(p: P, L: Look, eyes: 'closed' | 'x') {
  const f = L.frame;
  if (L.glasses !== 'none') {
    p.rect(7, 9, 10, 11, f);
    p.rect(13, 9, 16, 11, f);
    p.rect(11, 9, 12, 9, f);
    p.set(6, 9, f);
    p.set(17, 9, f);
    p.rect(8, 10, 9, 10, '#94b0c2');
    p.rect(14, 10, 15, 10, '#94b0c2');
  }
  if (eyes === 'closed') {
    p.rect(8, 10, 9, 10, EYE);
    p.rect(14, 10, 15, 10, EYE);
  } else {
    p.set(8, 10, EYE);
    p.set(15, 10, EYE);
  }
  p.rect(11, 12, 12, 13, MOUTH);
  p.set(12, 14, '#c0cbdc'); // baba
}

function drawUpper(p: P, L: Look, face: 'idle' | 'closed') {
  drawTorso(p, L);
  const longHair = L.hairStyle === 'long' || L.hairStyle === 'straight';
  const paintFace = () => {
    if (face === 'idle') drawFace(p, L, 'idle');
    else drawFaceKO(p, L, 'closed');
  };
  if (longHair) drawHair(p, L);
  drawHead(p, L);
  drawBeard(p, L);
  paintFace();
  drawHair(p, L);
  if (longHair) {
    p.rect(7, 8, 16, 8, L.skin);
    paintFace();
  }
  drawHat(p, L, false);
}

function buildFront(L: Look, step: 'stand' | 'a' | 'b', face: 'idle' | 'closed' = 'idle'): Grid {
  const p = painter();
  if (step === 'stand') drawLegs(p, L);
  else drawLegsStep(p, L, step);
  drawUpper(p, L, face);
  if (step === 'stand') drawArms(p, L, 'idle');
  else drawArmsStep(p, L, step);
  detalhar(p, L, false);
  return p.g;
}

function buildBack(L: Look, step: 'stand' | 'a' | 'b'): Grid {
  const p = painter();
  if (step === 'stand') drawLegs(p, L);
  else drawLegsStep(p, L, step);
  // Cabelo longo cobre os ombros: tronco antes, cabelo por cima.
  drawTorsoBack(p, L);
  drawHeadBack(p, L);
  drawHairBack(p, L);
  drawHat(p, L, true);
  if (step === 'stand') {
    const s = L.shirt;
    p.rect(5, 16, 6, 18, s);
    p.rect(5, 19, 6, 21, L.skin);
    p.rect(17, 16, 18, 18, s);
    p.rect(17, 19, 18, 21, L.skin);
    if (L.prop === 'can') {
      p.rect(18, 19, 20, 23, '#e43b44');
      p.rect(18, 21, 20, 21, '#f4f4f4');
    }
  } else drawArmsStep(p, L, step, true);
  detalhar(p, L, true);
  return p.g;
}

/** Sentado numa banqueta, de frente: tronco 2 px mais baixo, coxas para a frente. */
function buildSit(L: Look, face: 'idle' | 'closed'): Grid {
  const up = painter(2);
  drawUpper(up, L, face);
  drawArms(up, L, 'idle');
  const p = painter();
  const lower = L.shorts ? L.skin : L.pants;
  for (let y = 0; y < SPRITE_H; y++) for (let x = 0; x < SPRITE_W; x++) if (up.g[y][x]) p.g[y][x] = up.g[y][x];
  p.rect(7, 26, 16, 27, L.pants); // coxas vistas de frente
  p.rect(8, 28, 10, 29, lower);
  p.rect(13, 28, 15, 29, lower);
  p.rect(7, 30, 10, 31, L.shoes);
  p.rect(13, 30, 16, 31, L.shoes);
  return p.g;
}

/** Gira a grade 90° no sentido horário (o boneco deita com a cabeça para a direita). */
export function rotateGrid(g: Grid): Grid {
  const H = g.length;
  const W = g[0].length;
  const out: Grid = Array.from({ length: W }, () => Array<string | null>(H).fill(null));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[x][H - 1 - y] = g[y][x];
  return out;
}

/** Corta linhas e colunas vazias das bordas. */
export function trimGrid(g: Grid): Grid {
  const emptyRow = (r: (string | null)[]) => r.every((c) => !c);
  let top = 0;
  let bottom = g.length - 1;
  while (top < bottom && emptyRow(g[top])) top++;
  while (bottom > top && emptyRow(g[bottom])) bottom--;
  const rows = g.slice(top, bottom + 1);
  const W = rows[0].length;
  let left = 0;
  let right = W - 1;
  while (left < right && rows.every((r) => !r[left])) left++;
  while (right > left && rows.every((r) => !r[right])) right--;
  return rows.map((r) => r.slice(left, right + 1));
}

/**
 * Pegadinha no desmaiado, antes de deitar: 1 = bigode, 2 = + monocelha, 3 = + "X" na bochecha (caneta); Fatia 15:
 * 4 = + bilhete no peito, 5 = + placa "chuta aqui" na barriga, 6 = + jornal aberto na cara.
 */
function inkFace(g: Grid, n: number, dy = 0) {
  const ink = '#181425';
  const pinta = (x: number, y: number, c: string) => {
    const row = g[y + OY + dy];
    if (row && x >= 0 && x < SPRITE_W) row[x] = c;
  };
  const put = (x: number, y: number) => pinta(x, y, ink);
  if (n >= 1) {
    for (let x = 9; x <= 14; x++) put(x, 12);
    put(8, 11);
    put(15, 11);
  }
  if (n >= 2) for (let x = 8; x <= 15; x++) put(x, 8);
  if (n >= 3) {
    put(16, 12);
    put(17, 13);
    put(17, 12);
    put(16, 13);
  }
  if (n >= 4) {
    // Bilhete dobrado no peito, com duas linhas de letra.
    for (let y = 17; y <= 20; y++) for (let x = 10; x <= 14; x++) pinta(x, y, '#f4f4f4');
    for (const y of [18, 19]) for (let x = 11; x <= 13; x++) pinta(x, y, x === 12 && y === 19 ? '#f4f4f4' : '#3a4466');
  }
  if (n >= 5) {
    // Placa de papelão na barriga com a seta do "chuta aqui".
    for (let y = 22; y <= 25; y++) for (let x = 7; x <= 16; x++) pinta(x, y, '#c9a86a');
    for (let x = 9; x <= 14; x++) pinta(x, 23, '#5c3620');
    pinta(13, 22, '#5c3620');
    pinta(13, 24, '#5c3620');
    for (const x of [9, 11]) pinta(x, 24, '#5c3620');
  }
  if (n >= 6) {
    // Jornal aberto em cima da cara (cobre os rabiscos), com as colunas de texto.
    for (let y = 5; y <= 13; y++) for (let x = 6; x <= 17; x++) pinta(x, y, '#c0cbdc');
    for (const y of [7, 9, 11]) for (let x = 8; x <= 15; x += 2) pinta(x, y, '#5a6988');
    for (let y = 5; y <= 13; y++) pinta(11, y, '#8b9bb4');
  }
}

/** Defunto do modo sangue: deitado, óculos voados, olhos em X e língua de fora. */
export function buildDeadGrid(id: PlayerId): Grid {
  return buildDeadGridLook(PLAYER_BY_ID[id].look);
}

export function buildDeadGridLook(L: Look): Grid {
  return trimGrid(rotateGrid(outline(deadFront(L))));
}

/** Parte que o modo sangue arranca no nocaute. */
export type ParteCorpo = 'cabeca' | 'braco' | 'perna';
const TOCO = '#a22633';
const CARNE = '#e43b44';

/** Defunto sem a cabeça, sem um braço ou sem uma perna (o toco em carne viva). */
export function buildMutiladoGridLook(L: Look, parte: ParteCorpo): Grid {
  const g = deadFront(L);
  const apaga = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y + OY]) g[y + OY][x] = null;
  };
  const pinta = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y + OY]) g[y + OY][x] = c;
  };
  if (parte === 'cabeca') {
    apaga(0, -OY, SPRITE_W - 1, 14);
    pinta(9, 14, 14, 15, TOCO);
    pinta(10, 14, 13, 14, CARNE);
    pinta(11, 13, 12, 13, '#f4f4f4'); // osso do pescoço
  } else if (parte === 'braco') {
    apaga(2, 16, 6, 24);
    pinta(6, 16, 7, 18, TOCO);
    pinta(6, 17, 6, 17, CARNE);
  } else {
    apaga(6, 26, 11, 31);
    pinta(8, 26, 10, 26, TOCO);
    pinta(9, 26, 9, 26, '#f4f4f4');
  }
  return trimGrid(rotateGrid(outline(g)));
}

/**
 * Despedaçar aos poucos (Fatia 4): máscara de partes arrancadas. Bits: braço esq. 1, braço dir. 2, perna esq. 4,
 * perna dir. 8, cabeça 16 ("esq." = lado esquerdo de quem olha o boneco de frente).
 */
export const CORTE_BRACO_E = 1;
export const CORTE_BRACO_D = 2;
export const CORTE_PERNA_E = 4;
export const CORTE_PERNA_D = 8;
export const CORTE_CABECA = 16;

/** Regiões (coordenadas da grade crua, y sem a margem) de cada parte e o desenho do toco que fica. */
type Regiao = { bit: number; apaga: [number, number, number, number]; toco: [number, number, number, number]; osso?: [number, number] };
const REGIOES: readonly Regiao[] = [
  { bit: CORTE_BRACO_E, apaga: [0, 16, 6, 25], toco: [6, 16, 7, 18], osso: [6, 17] },
  { bit: CORTE_BRACO_D, apaga: [17, 16, 23, 25], toco: [16, 16, 17, 18], osso: [17, 17] },
  { bit: CORTE_PERNA_E, apaga: [5, 26, 11, 33], toco: [7, 26, 10, 26], osso: [9, 26] },
  { bit: CORTE_PERNA_D, apaga: [12, 26, 18, 33], toco: [13, 26, 16, 26], osso: [14, 26] },
];

/** Arranca as partes da máscara de uma grade crua (sem contorno), deixando o toco. */
/** Poses com braço fora do lugar de sempre: o soco (punho no rosto, braço esticado) e o susto (braços para cima). */
export type PoseCorte = 'normal' | 'punch' | 'hurt';
const BRACOS_POSE: Record<Exclude<PoseCorte, 'normal'>, readonly Regiao[]> = {
  punch: [
    { bit: CORTE_BRACO_E, apaga: [4, 12, 6, 15], toco: [5, 16, 6, 16], osso: [6, 16] },
    { bit: CORTE_BRACO_D, apaga: [19, 15, 23, 19], toco: [18, 16, 18, 18], osso: [18, 17] },
  ],
  hurt: [
    { bit: CORTE_BRACO_E, apaga: [0, 8, 3, 15], toco: [4, 16, 5, 16], osso: [4, 16] },
    { bit: CORTE_BRACO_D, apaga: [19, 11, 23, 15], toco: [18, 16, 19, 16], osso: [19, 16] },
  ],
};
const regioesDe = (pose: PoseCorte) => (pose === 'normal' ? REGIOES : [...BRACOS_POSE[pose], ...REGIOES.filter((r) => r.bit > CORTE_BRACO_D)]);

function cortarCru(g: Grid, cortes: number, pose: PoseCorte = 'normal') {
  const apaga = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y + OY] && x >= 0 && x < SPRITE_W) g[y + OY][x] = null;
  };
  const pinta = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y + OY] && x >= 0 && x < SPRITE_W) g[y + OY][x] = c;
  };
  for (const r of regioesDe(pose)) {
    if (!(cortes & r.bit)) continue;
    apaga(...r.apaga);
    pinta(...r.toco, TOCO);
    if (r.osso) pinta(r.osso[0], r.osso[1], r.osso[0], r.osso[1], '#f4f4f4');
  }
  if (cortes & CORTE_CABECA) {
    apaga(0, -OY, SPRITE_W - 1, 14);
    pinta(9, 14, 14, 15, TOCO);
    pinta(10, 14, 13, 14, CARNE);
    pinta(11, 13, 12, 13, '#f4f4f4');
  }
}

/**
 * Boneco em pé (qualquer pose já com contorno) sem as partes da máscara: apaga a região (mais 1 px do contorno),
 * pinta o toco e refaz o contorno só onde faltou.
 */
export function cortarGrid(g: Grid, cortes: number, pose: PoseCorte = 'normal'): Grid {
  if (!cortes) return g;
  // Tira só o anel do contorno (pixel da cor do contorno encostado no vazio): calça ou olho escuro da mesma cor ficam.
  const vazio = (y: number, x: number) => y < 0 || y >= g.length || x < 0 || x >= SPRITE_W || !g[y][x];
  const cru: Grid = g.map((r, y) => r.map((c, x) => (c === OUTLINE && (vazio(y - 1, x) || vazio(y + 1, x) || vazio(y, x - 1) || vazio(y, x + 1)) ? null : c)));
  // Arranca as partes, pinta o toco e refaz o contorno em volta do que sobrou.
  cortarCru(cru, cortes, pose);
  return outline(cru);
}

/** Defunto (ou quem rasteja sem as pernas) sem as partes da máscara, deitado. */
export function buildDeadCortadoGridLook(L: Look, cortes: number): Grid {
  const g = deadFront(L);
  cortarCru(g, cortes);
  return trimGrid(rotateGrid(outline(g)));
}

/** O pedaço arrancado (rola pelo chão): a cabeça de olhos em X, um braço ou uma perna, com o toco vermelho. */
export function buildPedacoGridLook(L: Look, parte: ParteCorpo): Grid {
  const g = deadFront(L);
  const [x0, y0, x1, y1] = parte === 'cabeca' ? [3, -OY, 20, 15] : parte === 'braco' ? [2, 16, 6, 23] : [6, 26, 11, 31];
  const out: Grid = [];
  for (let y = y0; y <= y1; y++) out.push((g[y + OY] ?? []).slice(x0, x1 + 1).map((c) => c ?? null));
  // Toco na ponta que foi arrancada.
  const corte = parte === 'cabeca' ? out.length - 1 : 0;
  const linha = out[corte];
  for (let x = 0; x < linha.length; x++) if (linha[x] || parte !== 'cabeca') linha[x] = x % 2 ? TOCO : CARNE;
  if (parte === 'cabeca') for (let x = 0; x < linha.length; x++) if (!(g[14 + OY]?.[x + x0])) linha[x] = null;
  return trimGrid(outlineLivre(out));
}

/** Contorno escuro em volta de uma grade de qualquer tamanho. */
function outlineLivre(g: Grid): Grid {
  const H = g.length + 2;
  const W = (g[0]?.length ?? 0) + 2;
  const out: Grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => g[y - 1]?.[x - 1] ?? null));
  const viz = (x: number, y: number) => !!out[y]?.[x];
  const res = out.map((r) => r.slice());
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (!out[y][x] && (viz(x - 1, y) || viz(x + 1, y) || viz(x, y - 1) || viz(x, y + 1))) res[y][x] = '#0b0a10';
  return res;
}

function deadFront(L: Look): Grid {
  const g = buildFront(L, 'stand', 'closed');
  const put = (x: number, y: number, c: string) => {
    const row = g[y + OY];
    if (row && x >= 0 && x < SPRITE_W) row[x] = c;
  };
  for (let y = 9; y <= 11; y++) for (let x = 7; x <= 16; x++) put(x, y, L.skin);
  for (const ox of [7, 14]) {
    for (const [dx, dy] of [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]]) put(ox + dx, 9 + dy, EYE);
  }
  put(11, 12, MOUTH);
  put(12, 12, MOUTH);
  put(12, 13, '#e43b44');
  put(12, 14, '#e43b44');
  return g;
}

/** Monta a grade de uma pose do bar (já com contorno e sem bordas vazias). `ink` = rabiscos na cara (ressaca). */
export function buildBarGrid(id: PlayerId, pose: BarPose, ink = 0): Grid {
  return buildBarGridLook(PLAYER_BY_ID[id].look, pose, ink);
}

export function buildBarGridLook(L: Look, pose: BarPose, ink = 0): Grid {
  switch (pose) {
    // Fatia 15: de pé também mostra a pegadinha (quem acordou zoado anda assim até limpar a cara).
    case 'front': {
      const g = buildFront(L, 'stand');
      inkFace(g, ink);
      return outline(g);
    }
    case 'front-a': {
      const g = buildFront(L, 'a');
      inkFace(g, ink);
      return outline(g);
    }
    case 'front-b': {
      const g = buildFront(L, 'b');
      inkFace(g, ink);
      return outline(g);
    }
    case 'back':
      return outline(buildBack(L, 'stand'));
    case 'back-a':
      return outline(buildBack(L, 'a'));
    case 'back-b':
      return outline(buildBack(L, 'b'));
    case 'sit':
      return outline(buildSit(L, 'idle'));
    case 'ko-flat': {
      const g = buildFront(L, 'stand', 'closed');
      inkFace(g, ink);
      return trimGrid(rotateGrid(outline(g)));
    }
    case 'ko-bottle': {
      const g = buildFront(L, 'stand', 'closed');
      const put = (x: number, y: number, c: string) => {
        const row = g[y + OY];
        if (row && x >= 0 && x < SPRITE_W) row[x] = c;
      };
      // Garrafa verde abraçada (antes de deitar).
      for (let y = 15; y <= 23; y++) for (let x = 19; x <= 21; x++) put(x, y, '#3e8948');
      for (let y = 12; y <= 14; y++) put(20, y, '#3e8948');
      for (let y = 18; y <= 20; y++) for (let x = 19; x <= 21; x++) put(x, y, '#ead4aa');
      put(20, 11, '#b86f50');
      inkFace(g, ink);
      return trimGrid(rotateGrid(outline(g)));
    }
    case 'ko-slump': {
      // Sentado no chão encostado, cabeça caída para o lado.
      const g = buildSit(L, 'closed');
      inkFace(g, ink, 2);
      const out: Grid = g.map((r) => r.slice());
      const headBottom = 17 + OY;
      for (let y = 0; y <= headBottom; y++) out[y].fill(null);
      for (let y = 0; y <= headBottom; y++) {
        for (let x = 0; x < SPRITE_W; x++) {
          const c = g[y][x];
          if (c && y + 2 < SPRITE_H && x + 2 < SPRITE_W) out[y + 2][x + 2] = c;
        }
      }
      return outline(out);
    }
  }
}

/* ------------------------------------------------------------------ acabamento (Fatia 4, lote G) */

const hexRgb = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const rgbHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

function rgbHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
/** Puxa o matiz em direção a `alvo` (graus) por `f` (0..1), pelo caminho mais curto. */
const puxa = (h: number, alvo: number, f: number) => h + ((((alvo - h + 540) % 360) - 180) * f);

const rampa = new Map<string, { luz: string; sombra: string; borda: string }>();
/** Os tons de cada cor: luz (mais clara, puxando para o amarelo), sombra (mais escura, puxando para o roxo) e borda. */
export function tonsDe(c: string): { luz: string; sombra: string; borda: string } {
  let t = rampa.get(c);
  if (t) return t;
  const [h, s, l] = rgbHsl(hexRgb(c));
  const cinza = s < 0.08;
  t = {
    luz: hslHex(cinza ? h : puxa(h, 50, 0.1), cinza ? s : s * 0.95, l + (1 - l) * 0.24),
    sombra: hslHex(cinza ? 245 : puxa(h, 245, 0.1), cinza ? 0.1 : Math.min(1, s * 1.05), l * 0.76),
    borda: hslHex(cinza ? 245 : puxa(h, 245, 0.15), cinza ? 0.15 : s * 0.55, Math.min(0.17, l * 0.3)),
  };
  rampa.set(c, t);
  return t;
}

/** Cores que não ganham volume (olho, brilho do olho, dente, boca, toco, osso): detalhe de 1 pixel fica como está. */
const SEM_VOLUME = new Set<string>([OUTLINE, EYE, GLARE, TEETH, MOUTH, '#a22633', '#e43b44', '#f4f4f4', '#0b0a10']);

/**
 * Acabamento do boneco pronto (com contorno): volume em 3 tons com luz de cima à esquerda e contorno colorido
 * (o anel escuro ganha o tom escuro da cor de dentro, como no pixel art feito à mão). A forma não muda: nenhum pixel
 * aparece ou some, só muda de cor, então os cortes do gore e as poses continuam valendo.
 */
export function polir(g: Grid): Grid {
  const H = g.length;
  const W = g[0]?.length ?? 0;
  const conta = new Map<string, number>();
  for (const r of g) for (const c of r) if (c) conta.set(c, (conta.get(c) ?? 0) + 1);
  const de = (x: number, y: number) => (y >= 0 && y < H && x >= 0 && x < W ? g[y][x] : null);
  const out = g.map((r) => r.slice());
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = g[y][x];
      if (!c) continue;
      if (c === OUTLINE) {
        // Só o anel de fora (encostado no vazio) vira contorno colorido; o escuro de dentro (armação, cinto) fica.
        if (de(x, y - 1) && de(x, y + 1) && de(x - 1, y) && de(x + 1, y)) continue;
        // Pega a cor de dentro (de cima, dos lados, de baixo) e escurece; sem vizinho, fica o preto.
        const viz = [de(x, y - 1), de(x - 1, y), de(x + 1, y), de(x, y + 1)].find((v) => v && v !== OUTLINE && !SEM_VOLUME.has(v));
        // A sola (contorno de baixo, sem nada embaixo) fica no preto, para o boneco pisar firme.
        if (viz && de(x, y + 1)) out[y][x] = tonsDe(viz).borda;
        continue;
      }
      if (SEM_VOLUME.has(c) || (conta.get(c) ?? 0) < 6) continue;
      const t = tonsDe(c);
      // Borda do corpo = vazio ou o contorno de fora (a armação dos óculos e o cinto, por dentro, não contam).
      const borda = (xx: number, yy: number) => {
        const v = de(xx, yy);
        return !v || (v === OUTLINE && (!de(xx, yy - 1) || !de(xx, yy + 1) || !de(xx - 1, yy) || !de(xx + 1, yy)));
      };
      // Sombra na borda direita e embaixo (luz vem de cima, à esquerda).
      if (borda(x + 1, y) || (borda(x, y + 1) && y > 4)) out[y][x] = t.sombra;
      // Luz na borda de cima e na esquerda (só onde não é sombra).
      else if (borda(x, y - 1) || (borda(x - 1, y) && de(x + 1, y) === c)) out[y][x] = t.luz;
    }
  return out;
}
