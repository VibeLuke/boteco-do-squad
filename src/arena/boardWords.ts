/** Palavras de cada tabuleiro do placar, remontadas pelo gerador e guardadas em cache neste aparelho. */
import { buildPuzzle } from '../utils/buildPuzzle';
import type { DifficultyLevel } from '../types/crossword';
import { pickLeastSeen, seenWords, type BoardRef } from './history';
import { scoreStore } from './scoreStore';
import type { PlayerId } from './sprites';

const CACHE_KEY = 'cruzadabotecos.words.v1';
let cache: Record<string, string> | null = null;

function load(): Record<string, string> {
  if (cache) return cache;
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    cache = {};
  }
  return cache!;
}

export function wordsOfBoard(key: string, ref: BoardRef): string[] | null {
  const c = load();
  if (typeof c[key] === 'string') return c[key] ? c[key].split(' ') : [];
  try {
    const words = buildPuzzle(ref.themeId, ref.difficulty, ref.seed).words.map((w) => w.word);
    c[key] = words.join(' ');
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    } catch {
      /* cota cheia: fica só na memória */
    }
    return words;
  } catch {
    return null;
  }
}

/** Palavras que este jogador já viu em tabuleiros pontuados (fora o de código `exceptKey`). */
export function seenFor(player: PlayerId, themeId: string, exceptKey: string): Set<string> {
  return seenWords(scoreStore.tree, player, themeId, exceptKey, wordsOfBoard);
}

const TRIES: Record<DifficultyLevel, number> = { easy: 12, medium: 8, hard: 4 };

/** Tabuleiro novo (seed aleatório) com o mínimo de palavras que o jogador já viu. */
export function freshPuzzle(player: PlayerId | null, themeId: string, difficulty: DifficultyLevel) {
  if (!player) return buildPuzzle(themeId, difficulty);
  const seen = seenFor(player, themeId, '');
  if (!seen.size) return buildPuzzle(themeId, difficulty);
  const best = pickLeastSeen(
    () => {
      try {
        return buildPuzzle(themeId, difficulty);
      } catch {
        return null;
      }
    },
    (p) => p.words.map((w) => w.word),
    seen,
    { max: TRIES[difficulty], budgetMs: 220, clock: () => performance.now() },
  );
  return best ? best.board : buildPuzzle(themeId, difficulty);
}
