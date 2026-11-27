/**
 * Caminho na grade do bar (A* em 8 direções, sem cortar quina de móvel).
 * Determinístico: dois aparelhos com o mesmo mapa calculam o mesmo caminho — é assim que cada um anima os outros
 * recebendo só "de onde" e "para onde".
 */
import type { Tile } from './iso';

export type Walkable = (x: number, y: number) => boolean;

const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 1],
  [0, 1, 1],
  [-1, 0, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
  [1, -1, Math.SQRT2],
];

function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

/** Pode ir de (x,y) para (x+dx, y+dy)? Diagonal só se as duas laterais estiverem livres. */
function canStep(walk: Walkable, x: number, y: number, dx: number, dy: number): boolean {
  if (!walk(x + dx, y + dy)) return false;
  if (dx !== 0 && dy !== 0) return walk(x + dx, y) && walk(x, y + dy);
  return true;
}

/**
 * Caminho de `from` até `to`: lista de ladrilhos sem o de partida, terminando em `to`.
 * Vazio se já está lá ou se não há caminho.
 */
export function findPath(walk: Walkable, from: Tile, to: Tile, maxNodes = 4000): Tile[] {
  if (from.x === to.x && from.y === to.y) return [];
  if (!walk(to.x, to.y)) return [];
  const key = (x: number, y: number) => x * 4096 + y;
  const g = new Map<number, number>([[key(from.x, from.y), 0]]);
  const parent = new Map<number, number>();
  // Fila simples ordenada por (f, h, ordem de chegada): poucos ladrilhos, não precisa de heap.
  const open: { x: number; y: number; f: number; h: number; n: number }[] = [
    { x: from.x, y: from.y, f: octile(from.x, from.y, to.x, to.y), h: 0, n: 0 },
  ];
  const closed = new Set<number>();
  let counter = 0;
  while (open.length && closed.size < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i];
      const b = open[bi];
      if (a.f < b.f - 1e-9 || (Math.abs(a.f - b.f) <= 1e-9 && (a.h < b.h - 1e-9 || (Math.abs(a.h - b.h) <= 1e-9 && a.n < b.n)))) bi = i;
    }
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cur.x === to.x && cur.y === to.y) {
      const out: Tile[] = [];
      let k = ck;
      while (k !== key(from.x, from.y)) {
        out.push({ x: Math.floor(k / 4096), y: k % 4096 });
        k = parent.get(k)!;
      }
      return out.reverse();
    }
    const cg = g.get(ck)!;
    for (const [dx, dy, cost] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!canStep(walk, cur.x, cur.y, dx, dy)) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const ng = cg + cost;
      if (ng < (g.get(nk) ?? Infinity) - 1e-9) {
        g.set(nk, ng);
        parent.set(nk, ck);
        const h = octile(nx, ny, to.x, to.y);
        open.push({ x: nx, y: ny, f: ng + h, h, n: ++counter });
      }
    }
  }
  return [];
}

/** Ladrilho livre mais perto de `t` (tocar numa mesa leva para o lado dela). */
export function nearestWalkable(walk: Walkable, t: Tile, cols: number, rows: number): Tile | null {
  if (walk(t.x, t.y)) return t;
  let best: Tile | null = null;
  let bd = Infinity;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!walk(x, y)) continue;
      const d = octile(x, y, t.x, t.y);
      if (d < bd - 1e-9) {
        bd = d;
        best = { x, y };
      }
    }
  }
  return best;
}

export function pathLength(from: Tile, path: Tile[]): number {
  let len = 0;
  let px = from.x;
  let py = from.y;
  for (const t of path) {
    len += px !== t.x && py !== t.y ? Math.SQRT2 : 1;
    px = t.x;
    py = t.y;
  }
  return len;
}
