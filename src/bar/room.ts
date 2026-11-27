/**
 * Os cômodos do bar: chão, paredes, portas e móveis que bloqueiam passagem.
 * Tudo em ladrilhos; o desenho fica em render.ts. A grade de passagem de cada cômodo é fixa (os caminhos
 * calculados em dois aparelhos têm de dar o mesmo resultado).
 */
import type { PlayerId } from '../arena/sprites';
import type { Tile } from './iso';
import type { Weapon } from './blood';
import { PESSOAS } from '../turma/index';

/** 'pool' = mesa de sinuca (3×2, desenhada do ladrilho da frente); 'void' = ladrilho ocupado por um móvel grande. */
export type PropKind = 'counter' | 'shelf' | 'stool' | 'table' | 'jukebox' | 'barrel' | 'plant' | 'board' | 'pool' | 'void';

export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** Altura das paredes de fundo, em px. */
  wallH: number;
  props: Prop[];
  /** Ladrilho de entrada da rua (o salão; onde se volta depois de morrer). */
  door: Tile;
  /** Portas desenhadas nas paredes: saída, passagem para outro cômodo ou "em reforma". */
  doors: Door[];
  /** Lousa do placar (tocar abre o placar). */
  board?: Tile;
  /** Lousão da Palavra do Dia na parede da direita: do ladrilho x = from até to (inclusive). */
  chalk?: { from: number; to: number };
  /** Sino pendurado na parede da direita, acima do ladrilho x. */
  bell?: number;
  /** Jukebox do Anagrama da Saideira: tocar nela leva até `stand` e abre o jogo. */
  jukebox?: { at: Tile; stand: Tile };
  /** Mesa de sinuca do Quiz geek: tocar em qualquer ladrilho dela leva até `stand` e abre o quiz. */
  pool?: { tiles: Tile[]; stand: Tile };
  /** Cadeira de cada mesa: onde quem está jogando a cruzada aparece sentado. Chave "x,y" da mesa. */
  seats: Record<string, Tile>;
  /** Cantos onde cada um fica jogado quando está offline (só no salão). */
  hangover?: Record<PlayerId, Tile & { pose: 'ko-flat' | 'ko-bottle' | 'ko-slump' }>;
  /** Armas do modo sangue: tocar em `at` leva até `stand` e põe a arma na mão (cada um tem a sua; nunca acaba). */
  arsenal: ArsenalSpot[];
}

/**
 * Porta numa parede de fundo. Parede L = a da esquerda (ladrilho (0, i)); parede R = a da direita (ladrilho (i, 0)).
 * O ladrilho da porta é a soleira: chegar nele atravessa para `to`, aparecendo em `arrive`.
 */
export interface Door {
  side: 'L' | 'R';
  i: number;
  kind: 'exit' | 'open' | 'reforma';
  to?: string;
  arrive?: Tile;
  label: string;
}

export const doorTile = (d: Door): Tile => (d.side === 'L' ? { x: 0, y: d.i } : { x: d.i, y: 0 });

export interface ArsenalSpot {
  w: Exclude<Weapon, 'soco'>;
  at: Tile;
  stand: Tile;
  /** Desenhar a arma no lugar (a banqueta já é o próprio móvel). Deslocamento em px a partir do centro do ladrilho. */
  draw?: { dx: number; lift: number };
}

/** Onde cada um da turma acorda de ressaca no bar antigo, na ordem da turma. */
const RESSACA: readonly (Tile & { pose: 'ko-flat' | 'ko-bottle' | 'ko-slump' })[] = [
  { x: 1, y: 1, pose: 'ko-slump' },
  { x: 11, y: 3, pose: 'ko-bottle' },
  { x: 9, y: 8, pose: 'ko-flat' },
  { x: 1, y: 9, pose: 'ko-flat' },
  { x: 5, y: 9, pose: 'ko-bottle' },
];
const counter = [3, 4, 5, 6, 7, 8].map((x) => ({ kind: 'counter' as const, x, y: 1 }));
const shelf = [3, 4, 5, 6, 7, 8].map((x) => ({ kind: 'shelf' as const, x, y: 0 }));

export const SALAO: Room = {
  id: 'salao',
  name: 'Salão do balcão',
  cols: 12,
  rows: 10,
  wallH: 52,
  props: [
    ...shelf,
    ...counter,
    { kind: 'stool', x: 3, y: 2 },
    { kind: 'stool', x: 5, y: 2 },
    { kind: 'stool', x: 7, y: 2 },
    { kind: 'table', x: 2, y: 5 },
    { kind: 'table', x: 6, y: 6 },
    { kind: 'table', x: 9, y: 4 },
    { kind: 'jukebox', x: 11, y: 0 },
    { kind: 'barrel', x: 0, y: 0 },
    { kind: 'plant', x: 11, y: 9 },
    { kind: 'board', x: 10, y: 0 },
  ],
  board: { x: 10, y: 0 },
  seats: { '2,5': { x: 3, y: 5 }, '6,6': { x: 7, y: 6 }, '9,4': { x: 9, y: 5 } },
  door: { x: 0, y: 7 },
  doors: [
    { side: 'L', i: 7, kind: 'exit', label: 'Saída' },
    { side: 'R', i: 9, kind: 'open', to: 'lousa', arrive: { x: 1, y: 4 }, label: 'Canto da lousa' },
    { side: 'R', i: 1, kind: 'open', to: 'jukebox', arrive: { x: 1, y: 4 }, label: 'Jukebox' },
    { side: 'L', i: 2, kind: 'reforma', label: 'Beco dos fundos' },
  ],
  // Onde cada um da turma acorda de ressaca, na ordem da turma (src/turma/turma.ts).
  hangover: Object.fromEntries(
    PESSOAS.map((p, i) => [p.id, RESSACA[i % RESSACA.length]]),
  ) as Record<PlayerId, Tile & { pose: 'ko-flat' | 'ko-bottle' | 'ko-slump' }>,
  arsenal: [
    { w: 'garrafa', at: { x: 8, y: 1 }, stand: { x: 8, y: 2 }, draw: { dx: 4, lift: 18 } },
    { w: 'taco', at: { x: 2, y: 0 }, stand: { x: 2, y: 0 }, draw: { dx: 2, lift: 0 } },
    { w: 'dardo', at: { x: 0, y: 4 }, stand: { x: 0, y: 4 }, draw: { dx: -9, lift: 22 } },
    { w: 'frigideira', at: { x: 0, y: 0 }, stand: { x: 1, y: 0 }, draw: { dx: 1, lift: 20 } },
    { w: 'banqueta', at: { x: 3, y: 2 }, stand: { x: 4, y: 2 } },
    { w: 'banqueta', at: { x: 5, y: 2 }, stand: { x: 4, y: 2 } },
    { w: 'banqueta', at: { x: 7, y: 2 }, stand: { x: 6, y: 2 } },
  ],
};

/** Cômodo 2: Canto da lousa (Palavra do Dia e o sino de quem acerta primeiro). */
export const LOUSA: Room = {
  id: 'lousa',
  name: 'Canto da lousa',
  cols: 8,
  rows: 7,
  wallH: 52,
  props: [
    { kind: 'stool', x: 2, y: 2 },
    { kind: 'stool', x: 6, y: 2 },
    { kind: 'table', x: 5, y: 5 },
    { kind: 'plant', x: 7, y: 6 },
    { kind: 'barrel', x: 0, y: 0 },
  ],
  chalk: { from: 2, to: 5 },
  bell: 6,
  seats: {},
  door: { x: 0, y: 4 },
  doors: [{ side: 'L', i: 4, kind: 'open', to: 'salao', arrive: { x: 9, y: 1 }, label: 'Salão do balcão' }],
  arsenal: [{ w: 'banqueta', at: { x: 2, y: 2 }, stand: { x: 3, y: 2 } }, { w: 'banqueta', at: { x: 6, y: 2 }, stand: { x: 5, y: 2 } }],
};

/** Cômodo 3: Jukebox (Anagrama da Saideira; a música é a de quem lidera o placar de hoje). */
export const JUKEBOX: Room = {
  id: 'jukebox',
  name: 'Jukebox',
  cols: 9,
  rows: 8,
  wallH: 52,
  props: [
    { kind: 'jukebox', x: 4, y: 0 },
    { kind: 'stool', x: 1, y: 2 },
    { kind: 'stool', x: 7, y: 2 },
    { kind: 'table', x: 2, y: 5 },
    { kind: 'table', x: 6, y: 5 },
    { kind: 'barrel', x: 8, y: 0 },
    { kind: 'plant', x: 8, y: 7 },
  ],
  jukebox: { at: { x: 4, y: 0 }, stand: { x: 4, y: 1 } },
  seats: {},
  door: { x: 0, y: 4 },
  doors: [
    { side: 'L', i: 4, kind: 'open', to: 'salao', arrive: { x: 1, y: 1 }, label: 'Salão do balcão' },
    { side: 'R', i: 6, kind: 'open', to: 'sinuca', arrive: { x: 1, y: 4 }, label: 'Mesa de sinuca' },
  ],
  arsenal: [{ w: 'banqueta', at: { x: 1, y: 2 }, stand: { x: 2, y: 2 } }, { w: 'banqueta', at: { x: 7, y: 2 }, stand: { x: 6, y: 2 } }],
};

/** Mesa de sinuca de 3×2 a partir do ladrilho do fundo-esquerdo (x0, y0). */
const poolAt = (x0: number, y0: number): Prop[] => {
  const out: Prop[] = [];
  for (let y = y0; y < y0 + 2; y++) for (let x = x0; x < x0 + 3; x++) out.push({ kind: x === x0 + 2 && y === y0 + 1 ? 'pool' : 'void', x, y });
  return out;
};

/** Cômodo 4: Mesa de sinuca (Quiz geek; a torcida vê o placar ao vivo e solta emojis). */
export const SINUCA: Room = {
  id: 'sinuca',
  name: 'Mesa de sinuca',
  cols: 10,
  rows: 8,
  wallH: 52,
  props: [
    ...poolAt(3, 3),
    { kind: 'stool', x: 1, y: 1 },
    { kind: 'stool', x: 8, y: 6 },
    { kind: 'table', x: 8, y: 2 },
    { kind: 'barrel', x: 9, y: 0 },
    { kind: 'plant', x: 0, y: 7 },
  ],
  pool: {
    tiles: [3, 4, 5].flatMap((x) => [3, 4].map((y) => ({ x, y }))),
    stand: { x: 4, y: 5 },
  },
  seats: {},
  door: { x: 0, y: 4 },
  doors: [{ side: 'L', i: 4, kind: 'open', to: 'jukebox', arrive: { x: 6, y: 1 }, label: 'Jukebox' }],
  arsenal: [
    { w: 'taco', at: { x: 6, y: 0 }, stand: { x: 6, y: 1 }, draw: { dx: 2, lift: 0 } },
    { w: 'banqueta', at: { x: 1, y: 1 }, stand: { x: 2, y: 1 } },
    { w: 'banqueta', at: { x: 8, y: 6 }, stand: { x: 7, y: 6 } },
  ],
};

export const ROOMS: Record<string, Room> = { salao: SALAO, lousa: LOUSA, jukebox: JUKEBOX, sinuca: SINUCA };

export function doorAt(room: Room, x: number, y: number): Door | undefined {
  return room.doors.find((d) => {
    const t = doorTile(d);
    return t.x === x && t.y === y;
  });
}

export function arsenalAt(room: Room, x: number, y: number): ArsenalSpot | undefined {
  return room.arsenal.find((a) => a.at.x === x && a.at.y === y);
}

export function tableAt(room: Room, x: number, y: number): Prop | undefined {
  return room.props.find((p) => p.kind === 'table' && p.x === x && p.y === y);
}

export function blockedSet(room: Room): Set<string> {
  return new Set(room.props.map((p) => `${p.x},${p.y}`));
}

export function walkableFn(room: Room) {
  const blocked = blockedSet(room);
  return (x: number, y: number) => x >= 0 && y >= 0 && x < room.cols && y < room.rows && !blocked.has(`${x},${y}`);
}
