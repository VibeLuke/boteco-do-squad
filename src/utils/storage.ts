import type { DifficultyLevel } from '../types/crossword';

export type VisualTheme = 'paper' | 'ink';

export interface StoredState {
  visual?: VisualTheme;
  sound: boolean;
  difficulty: DifficultyLevel;
  /** Tabuleiros vencidos por tema (id do tema → total). */
  wins: Record<string, number>;
  /** Melhor pontuação por tema. */
  best: Record<string, number>;
  /** Melhor tempo (segundos) por tema. */
  bestTime: Record<string, number>;
  /** Seeds já vencidas (evita contar duas vezes o mesmo tabuleiro). */
  wonCodes: string[];
  keyboard?: boolean;
}

const KEY = 'lexicon.v1';

const DEFAULTS: StoredState = {
  sound: true,
  difficulty: 'medium',
  wins: {},
  best: {},
  bestTime: {},
  wonCodes: [],
};

export function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const difficulty: DifficultyLevel =
      parsed.difficulty === 'easy' || parsed.difficulty === 'hard' || parsed.difficulty === 'medium'
        ? parsed.difficulty
        : DEFAULTS.difficulty;
    return {
      ...DEFAULTS,
      ...parsed,
      difficulty,
      wins: { ...(parsed.wins ?? {}) },
      best: { ...(parsed.best ?? {}) },
      bestTime: { ...(parsed.bestTime ?? {}) },
      wonCodes: Array.isArray(parsed.wonCodes) ? parsed.wonCodes.slice(-400) : [],
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveState(state: StoredState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* armazenamento indisponível (modo privado, cota): ignora */
  }
}
