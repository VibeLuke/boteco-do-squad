/** Onde o boneco está num caminho depois de X ms andando (função pura: todo aparelho chega à mesma conta). */
import { facing, type Tile } from './iso';

/** Velocidade de caminhada, em ladrilhos por segundo. */
export const WALK_SPEED = 3.2;
/** Passos por ladrilho (troca de quadro da caminhada). */
const STEPS_PER_TILE = 2;

export interface Pose {
  x: number;
  y: number;
  back: boolean;
  flip: boolean;
  moving: boolean;
  /** 0..3: parado, passo a, parado, passo b. */
  frame: number;
}

export function positionAt(from: Tile, path: Tile[], elapsedMs: number, speed = WALK_SPEED, rest?: { back: boolean; flip: boolean }): Pose {
  let dist = Math.max(0, (elapsedMs / 1000) * speed);
  let px = from.x;
  let py = from.y;
  let face = rest ?? { back: false, flip: false };
  let travelled = 0;
  for (const t of path) {
    const seg = px !== t.x && py !== t.y ? Math.SQRT2 : 1;
    face = facing(t.x - px, t.y - py);
    if (dist < seg) {
      const k = dist / seg;
      travelled += dist;
      return {
        x: px + (t.x - px) * k,
        y: py + (t.y - py) * k,
        ...face,
        moving: true,
        frame: Math.floor(travelled * STEPS_PER_TILE * 2) % 4,
      };
    }
    dist -= seg;
    travelled += seg;
    px = t.x;
    py = t.y;
  }
  return { x: px, y: py, ...face, moving: false, frame: 0 };
}
