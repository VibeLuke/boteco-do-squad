/**
 * Pontuação do tabuleiro.
 *
 * - Uma letra só vale quando a palavra dela fecha certa (chutar A–Z numa casa não move o placar).
 * - Casa revelada por dica não vale.
 * - Palavra que o jogador já viu num tabuleiro pontuado antes ("repetida") vale 0.
 * - O bônus de tempo da vitória é proporcional à fração de palavras novas.
 */
import type { CrosswordPuzzle } from '../types/crossword';
import { cellKey, isWordCorrect, wordCells, wordKey } from './puzzle';

export const POINTS_PER_LETTER = 10;
export const OVER_HINT_PENALTY = 20;
export const CHECK_PENALTY = 10;
export const SECONDS_PAR_PER_CELL = 8;

export interface ScoreInput {
  letters: string[][];
  locked: boolean[][];
  hintsUsed: number;
  checks: number;
  elapsed: number;
  won: boolean;
}

export interface ScoreRules {
  freeHints: number;
  multiplier: number;
}

export interface ScoreResult {
  score: number;
  /** Casas que estão pontuando (palavra nova fechada, letra digitada pelo jogador). */
  scoringCells: number;
  timeBonus: number;
  /** wordKey das palavras repetidas (valem 0). */
  repeatKeys: Set<string>;
  newWords: number;
  totalWords: number;
}

export function computeScore(
  puzzle: CrosswordPuzzle,
  input: ScoreInput,
  rules: ScoreRules,
  seen: ReadonlySet<string>,
): ScoreResult {
  const repeatKeys = new Set<string>();
  const scoring = new Set<number>();
  let newWords = 0;
  let totalCells = 0;
  for (let r = 0; r < puzzle.rows; r++) for (let c = 0; c < puzzle.cols; c++) if (puzzle.grid[r][c].letter) totalCells++;

  for (const w of puzzle.words) {
    const repeated = seen.has(w.word);
    if (repeated) repeatKeys.add(wordKey(w));
    else newWords++;
    if (repeated || !isWordCorrect(puzzle, input.letters, w)) continue;
    for (const [r, c] of wordCells(w)) if (!input.locked[r]?.[c]) scoring.add(cellKey(r, c));
  }

  const totalWords = puzzle.words.length;
  const overHints = Math.max(0, input.hintsUsed - rules.freeHints);
  const fullBonus = input.won ? Math.max(0, totalCells * SECONDS_PAR_PER_CELL - input.elapsed) : 0;
  const timeBonus = totalWords ? Math.round((fullBonus * newWords) / totalWords) : 0;
  const raw = scoring.size * POINTS_PER_LETTER - overHints * OVER_HINT_PENALTY - input.checks * CHECK_PENALTY + timeBonus;
  return {
    score: Math.max(0, Math.round(raw * rules.multiplier)),
    scoringCells: scoring.size,
    timeBonus,
    repeatKeys,
    newWords,
    totalWords,
  };
}
