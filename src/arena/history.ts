/**
 * Histórico de palavras por jogador, tirado do próprio placar.
 *
 * Cada chave do placar é o código do tabuleiro (SEED_NIVEL_TEMA). O gerador é determinístico, então
 * dá para remontar o tabuleiro e saber quais palavras o jogador já viu, em qualquer aparelho, sem gravar
 * nada a mais no banco.
 */
import type { DifficultyLevel } from '../types/crossword';
import type { ScoreTree } from './scoreStore';
import type { PlayerId } from './sprites';

export interface BoardRef {
  seed: string;
  difficulty: DifficultyLevel;
  themeId: string;
}

const LETTER: Record<string, DifficultyLevel> = { F: 'easy', M: 'medium', D: 'hard' };

/** "LEX-AV33_M_anime-hq" → { seed: "LEX-AV33", difficulty: "medium", themeId: "anime-hq" }. */
export function parseKey(key: string): BoardRef | null {
  const m = /^(.+)_([FMD])_([a-z0-9-]+)$/.exec(key);
  if (!m) return null;
  return { seed: m[1], difficulty: LETTER[m[2]], themeId: m[3] };
}

/** O Misto puxa palavras de todos os temas; um tema puxa dele mesmo e do Misto. */
export function relevantTheme(current: string, other: string): boolean {
  return current === 'all' || other === 'all' || other === current;
}

export type WordsOf = (key: string, ref: BoardRef) => string[] | null;

/** Palavras dos tabuleiros que o jogador já pontuou (fora o atual), nos temas que podem repetir. */
export function seenWords(
  tree: ScoreTree,
  player: PlayerId,
  themeId: string,
  exceptKey: string,
  wordsOf: WordsOf,
): Set<string> {
  const out = new Set<string>();
  for (const [key, entry] of Object.entries(tree[player] ?? {})) {
    if (key === exceptKey || !entry || entry.s <= 0) continue;
    const ref = parseKey(key);
    if (!ref || !relevantTheme(themeId, ref.themeId)) continue;
    for (const w of wordsOf(key, ref) ?? []) out.add(w);
  }
  return out;
}

export function overlap(words: readonly string[], seen: ReadonlySet<string>): number {
  let n = 0;
  for (const w of words) if (seen.has(w)) n++;
  return n;
}

export interface PickOptions {
  /** Máximo de tabuleiros sorteados. */
  max: number;
  /** Para de sortear depois deste tempo (celular é mais lento). */
  budgetMs: number;
  clock?: () => number;
}

/** Sorteia alguns tabuleiros e fica com o que tem menos palavras já vistas. */
export function pickLeastSeen<P>(
  make: () => P | null,
  wordsOfBoard: (p: P) => readonly string[],
  seen: ReadonlySet<string>,
  opts: PickOptions,
): { board: P; repeats: number; tried: number } | null {
  const clock = opts.clock ?? (() => Date.now());
  const t0 = clock();
  let best: { board: P; repeats: number } | null = null;
  let tried = 0;
  while (tried < Math.max(1, opts.max)) {
    const p = make();
    tried++;
    if (p) {
      const repeats = overlap(wordsOfBoard(p), seen);
      if (!best || repeats < best.repeats) best = { board: p, repeats };
      if (repeats === 0) break;
    }
    if (clock() - t0 >= opts.budgetMs && best) break;
  }
  return best ? { ...best, tried } : null;
}

/**
 * Esta partida soma no placar?
 * - progresso salvo neste aparelho manda (retomar continua como estava);
 * - sem progresso e o tabuleiro já está no placar do jogador: treino;
 * - sem resposta do servidor ainda: espera (um celular recém-aberto não pode escapar da trava).
 */
export function decideScoring(savedScoring: boolean | null, hasEntry: boolean, conn: string): 'wait' | 'on' | 'off' {
  if (savedScoring !== null) return savedScoring ? 'on' : 'off';
  if (hasEntry) return 'off';
  if (conn === 'connecting') return 'wait';
  return 'on';
}
