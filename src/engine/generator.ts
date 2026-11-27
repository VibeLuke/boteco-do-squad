import type {
  CrosswordCell,
  CrosswordPuzzle,
  DifficultyLevel,
  Direction,
  GenerateCrosswordEntry,
  GenerateCrosswordOptions,
  PlacedWord,
} from '../types/crossword';
import { DIFFICULTY_CONFIG } from './difficulty';
import { normalizeWord } from './normalizer';

const GRID_DIM = 41;
const GRID_CENTER = 20;
const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Approximate Portuguese letter frequencies (normalized 0..1) to favor crossable words.
const LETTER_FREQ: Readonly<Record<string, number>> = {
  A: 1.0,
  E: 0.95,
  O: 0.85,
  S: 0.75,
  R: 0.72,
  I: 0.7,
  N: 0.62,
  D: 0.56,
  M: 0.54,
  U: 0.52,
  T: 0.5,
  C: 0.48,
  L: 0.42,
  P: 0.38,
  V: 0.28,
  G: 0.25,
  B: 0.22,
  F: 0.22,
  Q: 0.16,
  H: 0.15,
  J: 0.1,
  Z: 0.08,
  X: 0.06,
  K: 0.02,
  W: 0.01,
  Y: 0.01,
};

type PreparedCandidate = {
  word: string;
  codes: Uint8Array;
  display: string;
  clue: string;
  difficulty: 1 | 2 | 3;
  themeId: string;
  themeName: string;
  charMask: number;
  connectivityScore: number;
  tierRank: number;
};

type InternalPlacement = {
  candidateIndex: number;
  direction: Direction;
  row: number;
  col: number;
  intersections: number;
};

type Snapshot = {
  placements: InternalPlacement[];
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
  totalIntersections: number;
  acrossCount: number;
  downCount: number;
  score: number;
};

type CandidateMove = {
  candidateIndex: number;
  direction: Direction;
  row: number;
  col: number;
  intersections: number;
  moveScore: number;
};

function generateSeed(): string {
  let code = '';
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * SEED_ALPHABET.length);
    code += SEED_ALPHABET.charAt(idx);
  }
  return `LEX-${code}`;
}

function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

function createPrng(seed: string): () => number {
  let [a, b, c, d] = cyrb128(seed);
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function prepareCandidates(
  entries: readonly GenerateCrosswordEntry[],
  difficulty: DifficultyLevel,
  defaultThemeId: string,
  defaultThemeName: string,
  rand: () => number
): PreparedCandidate[] {
  const config = DIFFICULTY_CONFIG[difficulty];
  const maxAllowedLength = Math.min(config.maxRows, config.maxCols);

  const tierOrder = config.preferredDifficulties;
  const tierRankMap = new Map<1 | 2 | 3, number>();
  tierOrder.forEach((d, idx) => tierRankMap.set(d, idx));

  const seen = new Set<string>();
  const buckets: PreparedCandidate[][] = [[], [], []];

  // Shuffle raw order first so deduplication & sampling are seed-driven.
  const shuffledEntries = entries.slice();
  shuffleInPlace(shuffledEntries, rand);

  for (const entry of shuffledEntries) {
    const normalized = normalizeWord(entry.word || entry.display);
    if (
      normalized.length < config.minWordLength ||
      normalized.length > maxAllowedLength ||
      seen.has(normalized)
    ) {
      continue;
    }
    seen.add(normalized);

    const codes = new Uint8Array(normalized.length);
    let charMask = 0;
    let freqSum = 0;
    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized.charAt(i);
      const code = normalized.charCodeAt(i);
      codes[i] = code;
      charMask |= 1 << (code - 65);
      freqSum += LETTER_FREQ[ch] ?? 0.1;
    }

    const tierRank = tierRankMap.get(entry.difficulty) ?? 2;
    const candidate: PreparedCandidate = {
      word: normalized,
      codes,
      display: entry.display || normalized,
      clue: entry.clue,
      difficulty: entry.difficulty,
      themeId: entry.themeId ?? defaultThemeId,
      themeName: entry.themeName ?? defaultThemeName,
      charMask,
      connectivityScore: freqSum / normalized.length,
      tierRank,
    };
    buckets[tierRank].push(candidate);
  }

  // Sort within each tier favoring words with common letters, with slight random tie-breaking.
  for (const bucket of buckets) {
    bucket.sort((a, b) => {
      const diff = b.connectivityScore - a.connectivityScore;
      if (Math.abs(diff) > 0.08) return diff;
      return rand() - 0.5;
    });
  }

  // Combine tiers preserving difficulty priority while ensuring connector variety in huge pools (e.g. Misto).
  const combined: PreparedCandidate[] = [];
  const tierCaps = [50, 25, 15];
  for (let t = 0; t < buckets.length; t++) {
    const bucket = buckets[t];
    const limit = Math.min(bucket.length, tierCaps[t]);
    for (let i = 0; i < limit; i++) {
      combined.push(bucket[i]);
    }
  }
  // If any tier had fewer than its cap, fill remaining up to 90 from leftover buckets in priority order.
  if (combined.length < 90) {
    for (let t = 0; t < buckets.length; t++) {
      const bucket = buckets[t];
      for (let i = tierCaps[t]; i < bucket.length && combined.length < 90; i++) {
        combined.push(bucket[i]);
      }
    }
  }

  return combined;
}

function scoreBoard(
  placements: readonly InternalPlacement[],
  candidates: readonly PreparedCandidate[],
  minRow: number,
  maxRow: number,
  minCol: number,
  maxCol: number,
  totalIntersections: number,
  acrossCount: number,
  downCount: number,
  difficulty: DifficultyLevel
): number {
  const count = placements.length;
  if (count === 0) return -1e9;

  const config = DIFFICULTY_CONFIG[difficulty];
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;
  const area = rows * cols;

  let occupiedCells = 0;
  let primaryTierCount = 0;
  const primaryDiff = config.preferredDifficulties[0];
  for (const p of placements) {
    const cand = candidates[p.candidateIndex];
    occupiedCells += cand.codes.length;
    if (cand.difficulty === primaryDiff) {
      primaryTierCount++;
    }
  }
  // Unique cells = total letters - shared intersections (approx).
  const uniqueCells = Math.max(1, occupiedCells - totalIntersections);
  const density = uniqueCells / Math.max(1, area);

  const meetsMin = count >= config.minWords ? 1 : 0;
  const minBalance =
    Math.max(acrossCount, downCount) === 0
      ? 0
      : Math.min(acrossCount, downCount) / Math.max(acrossCount, downCount);
  const aspectBalance = Math.min(rows, cols) / Math.max(rows, cols);

  return (
    meetsMin * 10000 +
    count * 180 +
    totalIntersections * 145 +
    minBalance * 160 +
    aspectBalance * 120 +
    density * 260 +
    (primaryTierCount / count) * 90 -
    area * 1.1
  );
}

class GridWorkspace {
  readonly letters = new Uint8Array(GRID_DIM * GRID_DIM);
  readonly hUsed = new Uint8Array(GRID_DIM * GRID_DIM);
  readonly vUsed = new Uint8Array(GRID_DIM * GRID_DIM);
  readonly placements: InternalPlacement[] = [];
  readonly undoStack: number[][] = [];
  readonly usedCandidate = new Uint8Array(128);

  minRow = GRID_CENTER;
  maxRow = GRID_CENTER;
  minCol = GRID_CENTER;
  maxCol = GRID_CENTER;
  totalIntersections = 0;
  acrossCount = 0;
  downCount = 0;
  gridMask = 0;

  private readonly boundsHistory: Array<[number, number, number, number, number]> = [];

  reset(candidateCount: number): void {
    this.letters.fill(0);
    this.hUsed.fill(0);
    this.vUsed.fill(0);
    this.placements.length = 0;
    this.undoStack.length = 0;
    this.boundsHistory.length = 0;
    if (this.usedCandidate.length < candidateCount) {
      // Safe guard if candidateCount ever exceeded 128
      for (let i = 0; i < this.usedCandidate.length; i++) this.usedCandidate[i] = 0;
    } else {
      this.usedCandidate.fill(0, 0, candidateCount);
    }
    this.minRow = GRID_CENTER;
    this.maxRow = GRID_CENTER;
    this.minCol = GRID_CENTER;
    this.maxCol = GRID_CENTER;
    this.totalIntersections = 0;
    this.acrossCount = 0;
    this.downCount = 0;
    this.gridMask = 0;
  }

  canPlace(
    codes: Uint8Array,
    direction: Direction,
    row: number,
    col: number,
    maxRows: number,
    maxCols: number,
    requireIntersection: boolean
  ): number {
    const len = codes.length;
    if (direction === 'across') {
      if (row < 1 || row >= GRID_DIM - 1 || col < 1 || col + len >= GRID_DIM - 1) {
        return -1;
      }
      if (this.placements.length > 0) {
        const nMinR = row < this.minRow ? row : this.minRow;
        const nMaxR = row > this.maxRow ? row : this.maxRow;
        const nMinC = col < this.minCol ? col : this.minCol;
        const endC = col + len - 1;
        const nMaxC = endC > this.maxCol ? endC : this.maxCol;
        if (nMaxR - nMinR + 1 > maxRows || nMaxC - nMinC + 1 > maxCols) {
          return -1;
        }
      }

      const rowBase = row * GRID_DIM;
      if (this.letters[rowBase + col - 1] !== 0 || this.letters[rowBase + col + len] !== 0) {
        return -1;
      }

      let intersections = 0;
      for (let i = 0; i < len; i++) {
        const c = col + i;
        const idx = rowBase + c;
        const existing = this.letters[idx];
        if (existing !== 0) {
          if (existing !== codes[i] || this.hUsed[idx] !== 0) {
            return -1;
          }
          intersections++;
        } else {
          if (
            this.letters[(row - 1) * GRID_DIM + c] !== 0 ||
            this.letters[(row + 1) * GRID_DIM + c] !== 0
          ) {
            return -1;
          }
        }
      }

      if (requireIntersection && intersections === 0) {
        return -1;
      }
      return intersections;
    } else {
      if (col < 1 || col >= GRID_DIM - 1 || row < 1 || row + len >= GRID_DIM - 1) {
        return -1;
      }
      if (this.placements.length > 0) {
        const nMinR = row < this.minRow ? row : this.minRow;
        const endR = row + len - 1;
        const nMaxR = endR > this.maxRow ? endR : this.maxRow;
        const nMinC = col < this.minCol ? col : this.minCol;
        const nMaxC = col > this.maxCol ? col : this.maxCol;
        if (nMaxR - nMinR + 1 > maxRows || nMaxC - nMinC + 1 > maxCols) {
          return -1;
        }
      }

      if (
        this.letters[(row - 1) * GRID_DIM + col] !== 0 ||
        this.letters[(row + len) * GRID_DIM + col] !== 0
      ) {
        return -1;
      }

      let intersections = 0;
      for (let i = 0; i < len; i++) {
        const r = row + i;
        const idx = r * GRID_DIM + col;
        const existing = this.letters[idx];
        if (existing !== 0) {
          if (existing !== codes[i] || this.vUsed[idx] !== 0) {
            return -1;
          }
          intersections++;
        } else {
          if (
            this.letters[r * GRID_DIM + col - 1] !== 0 ||
            this.letters[r * GRID_DIM + col + 1] !== 0
          ) {
            return -1;
          }
        }
      }

      if (requireIntersection && intersections === 0) {
        return -1;
      }
      return intersections;
    }
  }

  place(
    candidateIndex: number,
    cand: PreparedCandidate,
    direction: Direction,
    row: number,
    col: number,
    intersections: number
  ): void {
    const codes = cand.codes;
    const len = codes.length;
    const changed: number[] = [];

    this.boundsHistory.push([
      this.minRow,
      this.maxRow,
      this.minCol,
      this.maxCol,
      this.gridMask,
    ]);

    if (this.placements.length === 0) {
      this.minRow = row;
      this.maxRow = direction === 'down' ? row + len - 1 : row;
      this.minCol = col;
      this.maxCol = direction === 'across' ? col + len - 1 : col;
    } else {
      if (row < this.minRow) this.minRow = row;
      if (col < this.minCol) this.minCol = col;
      const endR = direction === 'down' ? row + len - 1 : row;
      const endC = direction === 'across' ? col + len - 1 : col;
      if (endR > this.maxRow) this.maxRow = endR;
      if (endC > this.maxCol) this.maxCol = endC;
    }

    if (direction === 'across') {
      const rowBase = row * GRID_DIM;
      for (let i = 0; i < len; i++) {
        const idx = rowBase + col + i;
        this.hUsed[idx] = 1;
        if (this.letters[idx] === 0) {
          this.letters[idx] = codes[i];
          changed.push(idx);
        }
      }
      this.acrossCount++;
    } else {
      for (let i = 0; i < len; i++) {
        const idx = (row + i) * GRID_DIM + col;
        this.vUsed[idx] = 1;
        if (this.letters[idx] === 0) {
          this.letters[idx] = codes[i];
          changed.push(idx);
        }
      }
      this.downCount++;
    }

    this.gridMask |= cand.charMask;
    this.totalIntersections += intersections;
    this.usedCandidate[candidateIndex] = 1;
    this.undoStack.push(changed);
    this.placements.push({
      candidateIndex,
      direction,
      row,
      col,
      intersections,
    });
  }

  unplace(candidates: readonly PreparedCandidate[]): void {
    const last = this.placements.pop();
    const changed = this.undoStack.pop();
    const prevBounds = this.boundsHistory.pop();
    if (!last || !changed || !prevBounds) return;

    const len = candidates[last.candidateIndex].codes.length;
    if (last.direction === 'across') {
      const rowBase = last.row * GRID_DIM;
      for (let i = 0; i < len; i++) {
        this.hUsed[rowBase + last.col + i] = 0;
      }
      this.acrossCount--;
    } else {
      for (let i = 0; i < len; i++) {
        this.vUsed[(last.row + i) * GRID_DIM + last.col] = 0;
      }
      this.downCount--;
    }

    for (let i = 0; i < changed.length; i++) {
      this.letters[changed[i]] = 0;
    }

    this.usedCandidate[last.candidateIndex] = 0;
    this.totalIntersections -= last.intersections;
    this.minRow = prevBounds[0];
    this.maxRow = prevBounds[1];
    this.minCol = prevBounds[2];
    this.maxCol = prevBounds[3];
    this.gridMask = prevBounds[4];
  }

  collectAnchorCellsByLetter(): number[][] {
    const byLetter: number[][] = Array.from({ length: 26 }, () => []);
    for (let r = this.minRow; r <= this.maxRow; r++) {
      const rowBase = r * GRID_DIM;
      for (let c = this.minCol; c <= this.maxCol; c++) {
        const idx = rowBase + c;
        const code = this.letters[idx];
        if (code !== 0 && (this.hUsed[idx] === 0 || this.vUsed[idx] === 0)) {
          byLetter[code - 65].push(idx);
        }
      }
    }
    return byLetter;
  }
}

function collectBestMoves(
  ws: GridWorkspace,
  candidates: readonly PreparedCandidate[],
  difficulty: DifficultyLevel,
  rand: () => number,
  maxMovesToKeep: number
): CandidateMove[] {
  const config = DIFFICULTY_CONFIG[difficulty];
  const byLetter = ws.collectAnchorCellsByLetter();
  const curRows = ws.maxRow - ws.minRow + 1;
  const curCols = ws.maxCol - ws.minCol + 1;
  const preferDirection: Direction = ws.acrossCount <= ws.downCount ? 'across' : 'down';

  const moves: CandidateMove[] = [];
  const candidateLimit = Math.min(candidates.length, 64);

  for (let ci = 0; ci < candidateLimit; ci++) {
    if (ws.usedCandidate[ci] !== 0) continue;
    const cand = candidates[ci];
    if ((cand.charMask & ws.gridMask) === 0) continue;

    const codes = cand.codes;
    const len = codes.length;
    const seenPositions = new Set<number>();

    for (let i = 0; i < len; i++) {
      const anchors = byLetter[codes[i] - 65];
      if (anchors.length === 0) continue;

      for (let a = 0; a < anchors.length; a++) {
        const idx = anchors[a];
        const ar = Math.floor(idx / GRID_DIM);
        const ac = idx - ar * GRID_DIM;

        // If cell is currently only covered vertically (vUsed=1, hUsed=0), try placing 'across'.
        if (ws.hUsed[idx] === 0) {
          const startC = ac - i;
          const posKey = (ar << 12) | (startC << 1) | 0;
          if (!seenPositions.has(posKey)) {
            seenPositions.add(posKey);
            const intersections = ws.canPlace(
              codes,
              'across',
              ar,
              startC,
              config.maxRows,
              config.maxCols,
              true
            );
            if (intersections > 0) {
              const nMinC = startC < ws.minCol ? startC : ws.minCol;
              const nMaxC = startC + len - 1 > ws.maxCol ? startC + len - 1 : ws.maxCol;
              const newCols = nMaxC - nMinC + 1;
              const expansion = Math.max(0, newCols - curCols);
              const aspectDiff = Math.abs(curRows - newCols);

              const moveScore =
                intersections * 55 +
                (cand.tierRank === 0 ? 14 : cand.tierRank === 1 ? 6 : 0) +
                (preferDirection === 'across' ? 12 : 0) +
                cand.connectivityScore * 12 -
                expansion * 5 -
                aspectDiff * 2.5 +
                rand() * 5;

              moves.push({
                candidateIndex: ci,
                direction: 'across',
                row: ar,
                col: startC,
                intersections,
                moveScore,
              });
            }
          }
        }

        // If cell is currently only covered horizontally (hUsed=1, vUsed=0), try placing 'down'.
        if (ws.vUsed[idx] === 0) {
          const startR = ar - i;
          const posKey = (startR << 12) | (ac << 1) | 1;
          if (!seenPositions.has(posKey)) {
            seenPositions.add(posKey);
            const intersections = ws.canPlace(
              codes,
              'down',
              startR,
              ac,
              config.maxRows,
              config.maxCols,
              true
            );
            if (intersections > 0) {
              const nMinR = startR < ws.minRow ? startR : ws.minRow;
              const nMaxR = startR + len - 1 > ws.maxRow ? startR + len - 1 : ws.maxRow;
              const newRows = nMaxR - nMinR + 1;
              const expansion = Math.max(0, newRows - curRows);
              const aspectDiff = Math.abs(newRows - curCols);

              const moveScore =
                intersections * 55 +
                (cand.tierRank === 0 ? 14 : cand.tierRank === 1 ? 6 : 0) +
                (preferDirection === 'down' ? 12 : 0) +
                cand.connectivityScore * 12 -
                expansion * 5 -
                aspectDiff * 2.5 +
                rand() * 5;

              moves.push({
                candidateIndex: ci,
                direction: 'down',
                row: startR,
                col: ac,
                intersections,
                moveScore,
              });
            }
          }
        }
      }
    }
  }

  moves.sort((a, b) => b.moveScore - a.moveScore);
  if (moves.length > maxMovesToKeep) {
    moves.length = maxMovesToKeep;
  }
  return moves;
}

function buildPuzzle(
  snapshot: Snapshot,
  candidates: readonly PreparedCandidate[],
  seed: string,
  difficulty: DifficultyLevel,
  themeId: string,
  themeName: string
): CrosswordPuzzle {
  if (snapshot.placements.length === 0) {
    return {
      id: `${themeId}-${difficulty}-${seed}`,
      seed,
      difficulty,
      themeId,
      themeName,
      rows: 0,
      cols: 0,
      grid: [],
      words: [],
      across: [],
      down: [],
      generatedAt: Date.now(),
    };
  }

  const rows = snapshot.maxRow - snapshot.minRow + 1;
  const cols = snapshot.maxCol - snapshot.minCol + 1;

  const grid: CrosswordCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r,
      col: c,
      letter: null,
    }))
  );

  type RawPlaced = {
    direction: Direction;
    row: number;
    col: number;
    cand: PreparedCandidate;
  };

  const rawWords: RawPlaced[] = snapshot.placements.map((p) => ({
    direction: p.direction,
    row: p.row - snapshot.minRow,
    col: p.col - snapshot.minCol,
    cand: candidates[p.candidateIndex],
  }));

  const acrossStarts = new Map<number, RawPlaced>();
  const downStarts = new Map<number, RawPlaced>();

  for (const rw of rawWords) {
    const key = rw.row * cols + rw.col;
    if (rw.direction === 'across') {
      acrossStarts.set(key, rw);
    } else {
      downStarts.set(key, rw);
    }

    const len = rw.cand.word.length;
    for (let i = 0; i < len; i++) {
      const rr = rw.direction === 'down' ? rw.row + i : rw.row;
      const cc = rw.direction === 'across' ? rw.col + i : rw.col;
      grid[rr][cc].letter = rw.cand.word.charAt(i);
    }
  }

  // Canonical numbering: left-to-right, top-to-bottom.
  let nextNumber = 1;
  const across: PlacedWord[] = [];
  const down: PlacedWord[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = r * cols + c;
      const startsAcross = acrossStarts.get(key);
      const startsDown = downStarts.get(key);
      if (!startsAcross && !startsDown) continue;

      const num = nextNumber++;
      grid[r][c].number = num;

      if (startsAcross) {
        const pw: PlacedWord = {
          number: num,
          direction: 'across',
          row: startsAcross.row,
          col: startsAcross.col,
          word: startsAcross.cand.word,
          display: startsAcross.cand.display,
          clue: startsAcross.cand.clue,
          difficulty: startsAcross.cand.difficulty,
          themeId: startsAcross.cand.themeId,
          themeName: startsAcross.cand.themeName,
        };
        across.push(pw);
        for (let i = 0; i < pw.word.length; i++) {
          grid[pw.row][pw.col + i].acrossNumber = num;
        }
      }

      if (startsDown) {
        const pw: PlacedWord = {
          number: num,
          direction: 'down',
          row: startsDown.row,
          col: startsDown.col,
          word: startsDown.cand.word,
          display: startsDown.cand.display,
          clue: startsDown.cand.clue,
          difficulty: startsDown.cand.difficulty,
          themeId: startsDown.cand.themeId,
          themeName: startsDown.cand.themeName,
        };
        down.push(pw);
        for (let i = 0; i < pw.word.length; i++) {
          grid[pw.row + i][pw.col].downNumber = num;
        }
      }
    }
  }

  const words = [...across, ...down].sort((a, b) => {
    if (a.number !== b.number) return a.number - b.number;
    return a.direction === b.direction ? 0 : a.direction === 'across' ? -1 : 1;
  });

  return {
    id: `${themeId}-${difficulty}-${seed}`,
    seed,
    difficulty,
    themeId,
    themeName,
    rows,
    cols,
    grid,
    words,
    across,
    down,
    generatedAt: Date.now(),
  };
}

/**
 * Generates a deterministic, connected, valid crossword puzzle for the given
 * entries, difficulty level, theme metadata, and optional seed.
 */
export function generateCrossword(options: GenerateCrosswordOptions): CrosswordPuzzle {
  const trimmedSeed = options.seed?.trim();
  const seed = trimmedSeed && trimmedSeed.length > 0 ? trimmedSeed : generateSeed();
  const rand = createPrng(`${seed}::${options.difficulty}::${options.themeId}`);

  const config = DIFFICULTY_CONFIG[options.difficulty];
  const candidates = prepareCandidates(
    options.entries,
    options.difficulty,
    options.themeId,
    options.themeName,
    rand
  );

  if (candidates.length === 0) {
    return buildPuzzle(
      {
        placements: [],
        minRow: 0,
        maxRow: 0,
        minCol: 0,
        maxCol: 0,
        totalIntersections: 0,
        acrossCount: 0,
        downCount: 0,
        score: 0,
      },
      candidates,
      seed,
      options.difficulty,
      options.themeId,
      options.themeName
    );
  }

  const targetMaxWords = Math.min(config.maxWords, candidates.length);
  const ws = new GridWorkspace();

  let bestOverall: Snapshot | null = null;
  const maxAttempts = candidates.length === 1 ? 1 : 22;

  // Sem corte por relógio: o mesmo código tem de montar o mesmo tabuleiro em qualquer aparelho.
  // (Havia um corte aos 95 ms; em celular lento ele trocava ~1 em cada 5 tabuleiros do mesmo código.)
  for (let attempt = 0; attempt < maxAttempts; attempt++) {

    ws.reset(candidates.length);

    // Pick a varied anchor word from the top candidates.
    const anchorPoolSize = Math.min(candidates.length, 10);
    const anchorIdx = attempt % anchorPoolSize;
    const anchor = candidates[anchorIdx];
    const anchorDir: Direction = attempt % 2 === 0 ? 'across' : 'down';
    const halfLen = Math.floor(anchor.codes.length / 2);
    const startRow = anchorDir === 'across' ? GRID_CENTER : GRID_CENTER - halfLen;
    const startCol = anchorDir === 'across' ? GRID_CENTER - halfLen : GRID_CENTER;

    ws.place(anchorIdx, anchor, anchorDir, startRow, startCol, 0);

    let bestAttempt: Snapshot = {
      placements: ws.placements.slice(),
      minRow: ws.minRow,
      maxRow: ws.maxRow,
      minCol: ws.minCol,
      maxCol: ws.maxCol,
      totalIntersections: ws.totalIntersections,
      acrossCount: ws.acrossCount,
      downCount: ws.downCount,
      score: scoreBoard(
        ws.placements,
        candidates,
        ws.minRow,
        ws.maxRow,
        ws.minCol,
        ws.maxCol,
        ws.totalIntersections,
        ws.acrossCount,
        ws.downCount,
        options.difficulty
      ),
    };

    let nodesVisited = 0;
    let backtracks = 0;
    const maxNodes = 75;
    const maxBacktracks = 16;

    const search = (): boolean => {
      nodesVisited++;
      const curScore = scoreBoard(
        ws.placements,
        candidates,
        ws.minRow,
        ws.maxRow,
        ws.minCol,
        ws.maxCol,
        ws.totalIntersections,
        ws.acrossCount,
        ws.downCount,
        options.difficulty
      );

      if (curScore > bestAttempt.score) {
        bestAttempt = {
          placements: ws.placements.slice(),
          minRow: ws.minRow,
          maxRow: ws.maxRow,
          minCol: ws.minCol,
          maxCol: ws.maxCol,
          totalIntersections: ws.totalIntersections,
          acrossCount: ws.acrossCount,
          downCount: ws.downCount,
          score: curScore,
        };
      }

      if (ws.placements.length >= targetMaxWords) {
        return true;
      }
      if (nodesVisited >= maxNodes || backtracks >= maxBacktracks) {
        return false;
      }

      const branchLimit = ws.placements.length < 5 ? 3 : 2;
      const moves = collectBestMoves(ws, candidates, options.difficulty, rand, branchLimit);
      if (moves.length === 0) {
        backtracks++;
        return false;
      }

      for (let i = 0; i < moves.length; i++) {
        const move = moves[i];
        ws.place(
          move.candidateIndex,
          candidates[move.candidateIndex],
          move.direction,
          move.row,
          move.col,
          move.intersections
        );
        const reachedTarget = search();
        ws.unplace(candidates);

        if (reachedTarget) {
          return true;
        }
        if (nodesVisited >= maxNodes || backtracks >= maxBacktracks) {
          break;
        }
      }

      backtracks++;
      return false;
    };

    search();

    if (!bestOverall || bestAttempt.score > bestOverall.score) {
      bestOverall = bestAttempt;
    }

    // If we already hit targetMaxWords with strong crossing density after >= 10 attempts, we can finish early.
    if (
      attempt >= 9 &&
      bestOverall.placements.length >= targetMaxWords &&
      bestOverall.totalIntersections >= bestOverall.placements.length
    ) {
      break;
    }
  }

  return buildPuzzle(
    bestOverall!,
    candidates,
    seed,
    options.difficulty,
    options.themeId,
    options.themeName
  );
}
