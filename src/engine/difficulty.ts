import type { DifficultyLevel } from '../types/crossword';

export type DifficultyConfig = {
  level: DifficultyLevel;
  label: string;
  description: string;
  maxRows: number;
  maxCols: number;
  minWords: number;
  maxWords: number;
  freeHints: number;
  scoreMultiplier: number;
  preferredDifficulties: readonly (1 | 2 | 3)[];
  minWordLength: number;
  maxWordLength: number;
};

export const DIFFICULTY_CONFIG: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    level: 'easy',
    label: 'Fácil',
    description: 'Grade até 10×10 com 6 a 8 palavras acessíveis e 5 dicas grátis.',
    maxRows: 10,
    maxCols: 10,
    minWords: 6,
    maxWords: 8,
    freeHints: 5,
    scoreMultiplier: 1,
    preferredDifficulties: [1, 2, 3],
    minWordLength: 3,
    maxWordLength: 10,
  },
  medium: {
    level: 'medium',
    label: 'Médio',
    description: 'Grade até 13×13 com 10 a 14 palavras variadas e 3 dicas grátis.',
    maxRows: 13,
    maxCols: 13,
    minWords: 10,
    maxWords: 14,
    freeHints: 3,
    scoreMultiplier: 1.5,
    preferredDifficulties: [2, 1, 3],
    minWordLength: 3,
    maxWordLength: 13,
  },
  hard: {
    level: 'hard',
    label: 'Difícil',
    description: 'Grade até 16×16 com 15 a 22 palavras desafiadoras e 1 dica grátis.',
    maxRows: 16,
    maxCols: 16,
    minWords: 15,
    maxWords: 22,
    freeHints: 1,
    scoreMultiplier: 2.5,
    preferredDifficulties: [3, 2, 1],
    minWordLength: 3,
    maxWordLength: 16,
  },
};
