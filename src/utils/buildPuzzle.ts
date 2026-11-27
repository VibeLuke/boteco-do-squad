import type { CrosswordPuzzle, DifficultyLevel } from '../types/crossword';
import { generateCrossword } from '../engine/generator';
import { ALL_ENTRIES, ALL_THEME_ID, getTheme } from '../data/catalog';

/** Monta o tabuleiro de um tema. Mesmo seed + nível + tema = mesmo tabuleiro em qualquer aparelho. */
export function buildPuzzle(themeId: string, difficulty: DifficultyLevel, seed?: string): CrosswordPuzzle {
  const pack = getTheme(themeId);
  if (!pack) throw new Error(`Tema desconhecido: ${themeId}`);
  const entries = themeId === ALL_THEME_ID ? ALL_ENTRIES : pack.entries;
  return generateCrossword({ entries, difficulty, themeId: pack.id, themeName: pack.name, seed });
}
