/**
 * Geometria isométrica 2:1 do bar.
 *
 * Ladrilho de 32×16 px. O canto de cima do ladrilho (0,0) é a origem; tx cresce para baixo-direita
 * e ty para baixo-esquerda na tela.
 */
export const TW = 32;
export const TH = 16;

export interface Tile {
  x: number;
  y: number;
}

/** Canto de cima do losango do ladrilho, em pixels relativos à origem. Aceita coordenada fracionária. */
export function tileToScreen(tx: number, ty: number): { x: number; y: number } {
  return { x: (tx - ty) * (TW / 2), y: (tx + ty) * (TH / 2) };
}

/** Centro do losango (onde os pés do boneco pisam). */
export function tileCenter(tx: number, ty: number): { x: number; y: number } {
  const p = tileToScreen(tx, ty);
  return { x: p.x, y: p.y + TH / 2 };
}

/** Ladrilho sob um ponto da tela (relativo à origem). */
export function screenToTile(sx: number, sy: number): Tile {
  const a = sx / (TW / 2);
  const b = sy / (TH / 2);
  return { x: Math.floor((a + b) / 2), y: Math.floor((b - a) / 2) };
}

/** Ordem de desenho: quem está mais "para a frente" (x + y maior) é desenhado depois. */
export function depthOf(x: number, y: number): number {
  return x + y;
}

export interface Drawable {
  depth: number;
  /** Desempate estável: menor primeiro. */
  tie: number;
}

export function byDepth<T extends Drawable>(list: T[]): T[] {
  return list.slice().sort((a, b) => a.depth - b.depth || a.tie - b.tie);
}

/** Para onde o boneco olha ao andar de (x0,y0) para (x1,y1): de frente ou de costas, e se vira para a esquerda. */
export function facing(dx: number, dy: number): { back: boolean; flip: boolean } {
  const sx = dx - dy; // deslocamento horizontal na tela
  const sy = dx + dy; // deslocamento vertical na tela
  // Andando reto para o lado na tela (sy = 0) o boneco fica de frente.
  return { back: sy < 0, flip: sx < 0 };
}
