import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { CrosswordPuzzle, Direction, PlacedWord } from '../types/crossword';
import { DIFFICULTY_CONFIG } from '../engine/difficulty';
import { normalizeLetter } from '../engine/normalizer';
import {
  buildIndex,
  cellKey,
  emptyMatrix,
  isFilled,
  isWordCorrect,
  wordAt,
  wordCells,
  wordKey,
  type PuzzleIndex,
} from './puzzle';
import { playBackspace, playError, playKey, playOk, playReveal, playVictory, playWord } from './audio';
import { computeScore } from './scoring';
import { decodeProgress, type SavedProgress } from './progress';

/** Quanto custa revelar uma palavra inteira em "dicas". */
export const WORD_HINT_COST = 3;
const NO_WORDS: ReadonlySet<string> = new Set();

export interface GameState {
  letters: string[][];
  locked: boolean[][];
  flagged: number[];
  flagNonce: number;
  r: number;
  c: number;
  dir: Direction;
  hintsUsed: number;
  checks: number;
  revealedLetters: number;
  elapsed: number;
  status: 'playing' | 'won';
  /** Resultado da última verificação (para toast/som). */
  checkResult: { nonce: number; wrong: number; empty: number } | null;
}

type Action =
  | { t: 'type'; letter: string }
  | { t: 'back' }
  | { t: 'clear' }
  | { t: 'move'; dr: number; dc: number }
  | { t: 'select'; r: number; c: number }
  | { t: 'toggle' }
  | { t: 'clue'; word: PlacedWord }
  | { t: 'tab'; delta: number }
  | { t: 'revealLetter' }
  | { t: 'revealWord' }
  | { t: 'check' }
  | { t: 'tick' };

function isSolved(puzzle: CrosswordPuzzle, letters: string[][]): boolean {
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const sol = puzzle.grid[r][c].letter;
      if (sol && letters[r][c] !== sol) return false;
    }
  }
  return true;
}

function cloneMatrix<T>(m: T[][]): T[][] {
  return m.map((row) => row.slice());
}

function initialState(puzzle: CrosswordPuzzle, index: PuzzleIndex, saved?: SavedProgress | null): GameState {
  const first = index.order[0];
  const resumed = saved ? decodeProgress(saved, puzzle) : null;
  if (resumed) {
    // Retoma no primeiro buraco da primeira palavra ainda aberta.
    const open = index.order.find((w) => !isWordCorrect(puzzle, resumed.letters, w)) ?? first;
    const hole = open ? wordCells(open).find(([r, c]) => !resumed.letters[r][c]) ?? [open.row, open.col] : [0, 0];
    return {
      ...resumed,
      flagged: [],
      flagNonce: 0,
      r: hole[0],
      c: hole[1],
      dir: open?.direction ?? 'across',
      checkResult: null,
    };
  }
  return {
    letters: emptyMatrix(puzzle.rows, puzzle.cols, ''),
    locked: emptyMatrix(puzzle.rows, puzzle.cols, false),
    flagged: [],
    flagNonce: 0,
    r: first?.row ?? 0,
    c: first?.col ?? 0,
    dir: first?.direction ?? 'across',
    hintsUsed: 0,
    checks: 0,
    revealedLetters: 0,
    elapsed: 0,
    status: 'playing',
    checkResult: null,
  };
}

function makeReducer(puzzle: CrosswordPuzzle, index: PuzzleIndex) {
  const activeWord = (s: GameState): PlacedWord | undefined => wordAt(puzzle, index, s.r, s.c, s.dir);

  const finish = (s: GameState): GameState => (isSolved(puzzle, s.letters) ? { ...s, status: 'won', flagged: [] } : s);

  const focusWord = (s: GameState, w: PlacedWord): GameState => {
    const cells = wordCells(w);
    const target = cells.find(([r, c]) => !s.letters[r][c]) ?? cells[0];
    return { ...s, r: target[0], c: target[1], dir: w.direction };
  };

  return (s: GameState, a: Action): GameState => {
    if (a.t === 'tick') return s.status === 'playing' ? { ...s, elapsed: s.elapsed + 1 } : s;
    if (s.status === 'won') {
      return s;
    }
    switch (a.t) {
      case 'type': {
        if (!isFilled(puzzle, s.r, s.c)) return s;
        let next = s;
        if (!s.locked[s.r][s.c]) {
          const letters = cloneMatrix(s.letters);
          letters[s.r][s.c] = a.letter;
          next = {
            ...s,
            letters,
            flagged: s.flagged.filter((k) => k !== cellKey(s.r, s.c)),
          };
        }
        const w = activeWord(next);
        if (w) {
          const cells = wordCells(w);
          const i = cells.findIndex(([r, c]) => r === next.r && c === next.c);
          const nxt = cells[i + 1];
          if (nxt) next = { ...next, r: nxt[0], c: nxt[1] };
        }
        return finish(next);
      }
      case 'back': {
        const w = activeWord(s);
        if (s.letters[s.r][s.c] && !s.locked[s.r][s.c]) {
          const letters = cloneMatrix(s.letters);
          letters[s.r][s.c] = '';
          return { ...s, letters, flagged: s.flagged.filter((k) => k !== cellKey(s.r, s.c)) };
        }
        if (!w) return s;
        const cells = wordCells(w);
        const i = cells.findIndex(([r, c]) => r === s.r && c === s.c);
        const prev = cells[i - 1];
        if (!prev) return s;
        let letters = s.letters;
        let flagged = s.flagged;
        if (!s.locked[prev[0]][prev[1]]) {
          letters = cloneMatrix(s.letters);
          letters[prev[0]][prev[1]] = '';
          flagged = s.flagged.filter((k) => k !== cellKey(prev[0], prev[1]));
        }
        return { ...s, letters, flagged, r: prev[0], c: prev[1] };
      }
      case 'clear': {
        if (!s.letters[s.r][s.c] || s.locked[s.r][s.c]) return s;
        const letters = cloneMatrix(s.letters);
        letters[s.r][s.c] = '';
        return { ...s, letters, flagged: s.flagged.filter((k) => k !== cellKey(s.r, s.c)) };
      }
      case 'move': {
        const horizontal = a.dr === 0;
        const axis: Direction = horizontal ? 'across' : 'down';
        if (s.dir !== axis && wordAt(puzzle, index, s.r, s.c, axis)) {
          return { ...s, dir: axis };
        }
        let r = s.r + a.dr;
        let c = s.c + a.dc;
        while (r >= 0 && c >= 0 && r < puzzle.rows && c < puzzle.cols && !isFilled(puzzle, r, c)) {
          r += a.dr;
          c += a.dc;
        }
        if (r < 0 || c < 0 || r >= puzzle.rows || c >= puzzle.cols) return s;
        const dir = wordAt(puzzle, index, r, c, axis) ? axis : s.dir;
        return { ...s, r, c, dir: wordAt(puzzle, index, r, c, dir) ? dir : axis };
      }
      case 'select': {
        if (!isFilled(puzzle, a.r, a.c)) return s;
        const other: Direction = s.dir === 'across' ? 'down' : 'across';
        if (a.r === s.r && a.c === s.c) {
          return wordAt(puzzle, index, a.r, a.c, other) ? { ...s, dir: other } : s;
        }
        const dir = wordAt(puzzle, index, a.r, a.c, s.dir) ? s.dir : other;
        return { ...s, r: a.r, c: a.c, dir };
      }
      case 'toggle': {
        const other: Direction = s.dir === 'across' ? 'down' : 'across';
        return wordAt(puzzle, index, s.r, s.c, other) ? { ...s, dir: other } : s;
      }
      case 'clue':
        return focusWord(s, a.word);
      case 'tab': {
        const list = index.order;
        if (!list.length) return s;
        const cur = activeWord(s);
        const i = cur ? list.findIndex((w) => wordKey(w) === wordKey(cur)) : -1;
        const nxt = list[(i + a.delta + list.length) % list.length];
        return focusWord(s, nxt);
      }
      case 'revealLetter': {
        const w = activeWord(s);
        if (!w) return s;
        const cells = wordCells(w);
        const wrong = (r: number, c: number): boolean => s.letters[r][c] !== puzzle.grid[r][c].letter;
        const target = wrong(s.r, s.c) ? ([s.r, s.c] as const) : cells.find(([r, c]) => wrong(r, c));
        if (!target) return s;
        const [tr, tc] = target;
        const letters = cloneMatrix(s.letters);
        const locked = cloneMatrix(s.locked);
        letters[tr][tc] = puzzle.grid[tr][tc].letter ?? '';
        locked[tr][tc] = true;
        return finish({
          ...s,
          letters,
          locked,
          r: tr,
          c: tc,
          hintsUsed: s.hintsUsed + 1,
          revealedLetters: s.revealedLetters + 1,
          flagged: s.flagged.filter((k) => k !== cellKey(tr, tc)),
        });
      }
      case 'revealWord': {
        const w = activeWord(s);
        if (!w) return s;
        const cells = wordCells(w).filter(([r, c]) => s.letters[r][c] !== puzzle.grid[r][c].letter);
        if (!cells.length) return s;
        const letters = cloneMatrix(s.letters);
        const locked = cloneMatrix(s.locked);
        const gone = new Set<number>();
        for (const [r, c] of cells) {
          letters[r][c] = puzzle.grid[r][c].letter ?? '';
          locked[r][c] = true;
          gone.add(cellKey(r, c));
        }
        return finish({
          ...s,
          letters,
          locked,
          hintsUsed: s.hintsUsed + WORD_HINT_COST,
          revealedLetters: s.revealedLetters + cells.length,
          flagged: s.flagged.filter((k) => !gone.has(k)),
        });
      }
      case 'check': {
        const flagged: number[] = [];
        let empty = 0;
        for (let r = 0; r < puzzle.rows; r++) {
          for (let c = 0; c < puzzle.cols; c++) {
            const sol = puzzle.grid[r][c].letter;
            if (!sol) continue;
            const v = s.letters[r][c];
            if (!v) empty++;
            else if (v !== sol) flagged.push(cellKey(r, c));
          }
        }
        return {
          ...s,
          flagged,
          flagNonce: s.flagNonce + 1,
          checks: s.checks + (flagged.length ? 1 : 0),
          checkResult: { nonce: s.flagNonce + 1, wrong: flagged.length, empty },
        };
      }
      default:
        return s;
    }
  };
}

export interface GameApi {
  state: GameState;
  puzzle: CrosswordPuzzle;
  index: PuzzleIndex;
  active: PlacedWord | undefined;
  activeKeys: Set<number>;
  flaggedSet: Set<number>;
  doneWords: Set<string>;
  doneCells: Set<number>;
  doneCount: number;
  totalWords: number;
  filled: number;
  totalCells: number;
  hintsLeft: number;
  freeHints: number;
  overHints: number;
  multiplier: number;
  score: number;
  timeBonus: number;
  /** wordKey das palavras repetidas (já vistas pelo jogador; valem 0). */
  repeatKeys: Set<string>;
  newWords: number;
  type: (raw: string) => void;
  backspace: () => void;
  clearCell: () => void;
  move: (dr: number, dc: number) => void;
  select: (r: number, c: number) => void;
  toggleDir: () => void;
  selectClue: (w: PlacedWord) => void;
  tab: (delta: number) => void;
  revealLetter: () => void;
  revealWord: () => void;
  check: () => void;
}

export interface GameOptions {
  /** Palavras que este jogador já viu em outro tabuleiro pontuado. */
  seen?: ReadonlySet<string>;
  /** Progresso salvo para retomar (lido só na montagem). */
  initial?: SavedProgress | null;
}

export function useGame(puzzle: CrosswordPuzzle, opts: GameOptions = {}): GameApi {
  const index = useMemo(() => buildIndex(puzzle), [puzzle]);
  const reducer = useMemo(() => makeReducer(puzzle, index), [puzzle, index]);
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(puzzle, index, opts.initial));
  const seen = opts.seen ?? NO_WORDS;

  const active = wordAt(puzzle, index, state.r, state.c, state.dir);

  const activeKeys = useMemo(() => {
    const set = new Set<number>();
    if (active) for (const [r, c] of wordCells(active)) set.add(cellKey(r, c));
    return set;
  }, [active]);

  const flaggedSet = useMemo(() => new Set(state.flagged), [state.flagged]);

  const { doneWords, doneCells } = useMemo(() => {
    const words = new Set<string>();
    const cells = new Set<number>();
    for (const w of index.order) {
      if (isWordCorrect(puzzle, state.letters, w)) {
        words.add(wordKey(w));
        for (const [r, c] of wordCells(w)) cells.add(cellKey(r, c));
      }
    }
    return { doneWords: words, doneCells: cells };
  }, [index, puzzle, state.letters]);

  // Timer: conta apenas com a aba visível e o jogo em andamento.
  useEffect(() => {
    if (state.status !== 'playing') return;
    const id = window.setInterval(() => {
      if (!document.hidden) dispatch({ t: 'tick' });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.status]);

  // Sons de evento: palavra concluída, vitória, verificação.
  const prevDone = useRef<number>(0);
  const prevStatus = useRef<GameState['status']>('playing');
  useEffect(() => {
    if (state.status === 'won' && prevStatus.current !== 'won') {
      playVictory();
    } else if (doneWords.size > prevDone.current && state.status === 'playing') {
      playWord();
    }
    prevDone.current = doneWords.size;
    prevStatus.current = state.status;
  }, [doneWords, state.status]);

  const lastCheck = useRef(0);
  useEffect(() => {
    const res = state.checkResult;
    if (!res || res.nonce === lastCheck.current) return;
    lastCheck.current = res.nonce;
    if (res.wrong > 0) playError();
    else playOk();
  }, [state.checkResult]);

  const type = useCallback((raw: string) => {
    const L = String(normalizeLetter(raw) ?? '');
    if (!/^[A-Z]$/.test(L)) return;
    playKey();
    dispatch({ t: 'type', letter: L });
  }, []);
  const backspace = useCallback(() => {
    playBackspace();
    dispatch({ t: 'back' });
  }, []);
  const clearCell = useCallback(() => dispatch({ t: 'clear' }), []);
  const move = useCallback((dr: number, dc: number) => dispatch({ t: 'move', dr, dc }), []);
  const select = useCallback((r: number, c: number) => dispatch({ t: 'select', r, c }), []);
  const toggleDir = useCallback(() => dispatch({ t: 'toggle' }), []);
  const selectClue = useCallback((word: PlacedWord) => dispatch({ t: 'clue', word }), []);
  const tab = useCallback((delta: number) => dispatch({ t: 'tab', delta }), []);
  const revealLetter = useCallback(() => {
    playReveal();
    dispatch({ t: 'revealLetter' });
  }, []);
  const revealWord = useCallback(() => {
    playReveal();
    dispatch({ t: 'revealWord' });
  }, []);
  const check = useCallback(() => dispatch({ t: 'check' }), []);

  const cfg = DIFFICULTY_CONFIG[puzzle.difficulty];
  const freeHints = cfg.freeHints;
  const hintsLeft = Math.max(0, freeHints - state.hintsUsed);
  const overHints = Math.max(0, state.hintsUsed - freeHints);

  let filled = 0;
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (puzzle.grid[r][c].letter && state.letters[r][c]) filled++;
    }
  }

  const result = useMemo(
    () =>
      computeScore(
        puzzle,
        {
          letters: state.letters,
          locked: state.locked,
          hintsUsed: state.hintsUsed,
          checks: state.checks,
          elapsed: state.elapsed,
          won: state.status === 'won',
        },
        { freeHints, multiplier: cfg.scoreMultiplier },
        seen,
      ),
    [puzzle, state.letters, state.locked, state.hintsUsed, state.checks, state.elapsed, state.status, freeHints, cfg.scoreMultiplier, seen],
  );

  return {
    state,
    puzzle,
    index,
    active,
    activeKeys,
    flaggedSet,
    doneWords,
    doneCells,
    doneCount: doneWords.size,
    totalWords: index.order.length,
    filled,
    totalCells: index.totalCells,
    hintsLeft,
    freeHints,
    overHints,
    multiplier: cfg.scoreMultiplier,
    score: result.score,
    timeBonus: result.timeBonus,
    repeatKeys: result.repeatKeys,
    newWords: result.newWords,
    type,
    backspace,
    clearCell,
    move,
    select,
    toggleDir,
    selectClue,
    tab,
    revealLetter,
    revealWord,
    check,
  };
}
