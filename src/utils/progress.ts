/**
 * Progresso salvo por jogador + tabuleiro, para retomar de onde parou.
 *
 * É o que impede o "recarrega e digita de novo": reabrir um tabuleiro com progresso salvo continua a partida
 * (com as dicas, verificações e o tempo que já tinha); reabrir um tabuleiro que já está no placar sem progresso
 * salvo neste aparelho vira treino, sem somar.
 */
import type { CrosswordPuzzle } from '../types/crossword';

const KEY = 'cruzadabotecos.progress.v1';
const MAX_SAVED = 40;

export interface SavedProgress {
  /** Uma string por linha; "." = casa vazia. */
  letters: string[];
  /** Uma string por linha; "1" = casa revelada por dica. */
  locked: string[];
  hintsUsed: number;
  checks: number;
  revealedLetters: number;
  elapsed: number;
  status: 'playing' | 'won';
  /** Esta partida soma no placar? */
  scoring: boolean;
  /** Palavras repetidas congeladas no começo da partida. */
  seen: string[];
  at: number;
}

export interface ProgressState {
  letters: string[][];
  locked: boolean[][];
  hintsUsed: number;
  checks: number;
  revealedLetters: number;
  elapsed: number;
  status: 'playing' | 'won';
}

const nat = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export function encodeProgress(state: ProgressState, scoring: boolean, seen: Iterable<string>, at = Date.now()): SavedProgress {
  return {
    letters: state.letters.map((row) => row.map((l) => (/^[A-Z]$/.test(l) ? l : '.')).join('')),
    locked: state.locked.map((row) => row.map((b) => (b ? '1' : '0')).join('')),
    hintsUsed: state.hintsUsed,
    checks: state.checks,
    revealedLetters: state.revealedLetters,
    elapsed: state.elapsed,
    status: state.status,
    scoring,
    seen: [...seen],
    at,
  };
}

/** Valida contra o tabuleiro; devolve null se não bate (outro tamanho, lixo). */
export function decodeProgress(saved: unknown, puzzle: CrosswordPuzzle): ProgressState | null {
  const p = saved as Partial<SavedProgress> | null;
  if (!p || !Array.isArray(p.letters) || !Array.isArray(p.locked)) return null;
  if (p.letters.length !== puzzle.rows || p.locked.length !== puzzle.rows) return null;
  const letters: string[][] = [];
  const locked: boolean[][] = [];
  let solved = true;
  for (let r = 0; r < puzzle.rows; r++) {
    const lr = p.letters[r];
    const kr = p.locked[r];
    if (typeof lr !== 'string' || typeof kr !== 'string' || lr.length !== puzzle.cols || kr.length !== puzzle.cols) return null;
    const row: string[] = [];
    const lrow: boolean[] = [];
    for (let c = 0; c < puzzle.cols; c++) {
      const sol = puzzle.grid[r][c].letter;
      const ch = lr[c];
      const v = sol && /^[A-Z]$/.test(ch) ? ch : '';
      row.push(v);
      lrow.push(!!sol && kr[c] === '1' && v === sol);
      if (sol && v !== sol) solved = false;
    }
    letters.push(row);
    locked.push(lrow);
  }
  return {
    letters,
    locked,
    hintsUsed: nat(p.hintsUsed),
    checks: nat(p.checks),
    revealedLetters: nat(p.revealedLetters),
    elapsed: nat(p.elapsed),
    status: p.status === 'won' && solved ? 'won' : 'playing',
  };
}

const id = (player: string, code: string) => `${player}|${code}`;

function readAll(): Record<string, SavedProgress> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, SavedProgress>) : {};
  } catch {
    return {};
  }
}

export function loadProgress(player: string, code: string): SavedProgress | null {
  const p = readAll()[id(player, code)];
  return p && typeof p === 'object' ? p : null;
}

export function saveProgress(player: string, code: string, p: SavedProgress): void {
  try {
    const all = readAll();
    all[id(player, code)] = p;
    const keys = Object.keys(all);
    if (keys.length > MAX_SAVED) {
      keys
        .sort((a, b) => (all[a]?.at ?? 0) - (all[b]?.at ?? 0))
        .slice(0, keys.length - MAX_SAVED)
        .forEach((k) => delete all[k]);
    }
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* modo privado ou cota cheia */
  }
}
