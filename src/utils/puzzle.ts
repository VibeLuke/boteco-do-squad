import type { CrosswordPuzzle, Direction, PlacedWord } from '../types/crossword';

export type Pos = readonly [number, number];

export interface PuzzleIndex {
  across: Map<number, PlacedWord>;
  down: Map<number, PlacedWord>;
  order: PlacedWord[];
  totalCells: number;
}

export const cellKey = (r: number, c: number): number => r * 1000 + c;
export const wordKey = (w: PlacedWord): string => `${w.direction}-${w.number}`;

export function buildIndex(puzzle: CrosswordPuzzle): PuzzleIndex {
  const across = new Map<number, PlacedWord>();
  const down = new Map<number, PlacedWord>();
  for (const w of puzzle.across) across.set(w.number, w);
  for (const w of puzzle.down) down.set(w.number, w);
  let totalCells = 0;
  for (const row of puzzle.grid) for (const cell of row) if (cell.letter) totalCells++;
  return { across, down, order: [...puzzle.across, ...puzzle.down], totalCells };
}

export function wordCells(w: PlacedWord): Pos[] {
  const out: Pos[] = [];
  for (let i = 0; i < w.word.length; i++) {
    out.push(w.direction === 'across' ? [w.row, w.col + i] : [w.row + i, w.col]);
  }
  return out;
}

export function wordAt(
  puzzle: CrosswordPuzzle,
  index: PuzzleIndex,
  r: number,
  c: number,
  dir: Direction,
): PlacedWord | undefined {
  const cell = puzzle.grid[r]?.[c];
  if (!cell || !cell.letter) return undefined;
  const num = dir === 'across' ? cell.acrossNumber : cell.downNumber;
  if (num == null) return undefined;
  return (dir === 'across' ? index.across : index.down).get(num);
}

export function isFilled(puzzle: CrosswordPuzzle, r: number, c: number): boolean {
  return !!puzzle.grid[r]?.[c]?.letter;
}

export function emptyMatrix<T>(rows: number, cols: number, value: T): T[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => value));
}

export function isWordCorrect(puzzle: CrosswordPuzzle, letters: string[][], w: PlacedWord): boolean {
  for (const [r, c] of wordCells(w)) {
    if (letters[r]?.[c] !== puzzle.grid[r]?.[c]?.letter) return false;
  }
  return true;
}
