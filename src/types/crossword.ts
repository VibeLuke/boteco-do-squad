export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export type Direction = 'across' | 'down';

export type WordEntry = {
  word: string;
  display: string;
  clue: string;
  difficulty: 1 | 2 | 3;
};

export type ThemePack = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  entries: WordEntry[];
};

export type ThemedWordEntry = WordEntry & {
  themeId: string;
  themeName: string;
};

export type PlacedWord = {
  number: number;
  direction: Direction;
  row: number;
  col: number;
  word: string;
  display: string;
  clue: string;
  difficulty: 1 | 2 | 3;
  themeId: string;
  themeName: string;
};

export type CrosswordCell = {
  row: number;
  col: number;
  letter: string | null;
  number?: number;
  acrossNumber?: number;
  downNumber?: number;
};

export type CrosswordPuzzle = {
  id: string;
  seed: string;
  difficulty: DifficultyLevel;
  themeId: string;
  themeName: string;
  rows: number;
  cols: number;
  grid: CrosswordCell[][];
  words: PlacedWord[];
  across: PlacedWord[];
  down: PlacedWord[];
  generatedAt: number;
};

export type GenerateCrosswordEntry = WordEntry & {
  themeId?: string;
  themeName?: string;
};

export type GenerateCrosswordOptions = {
  entries: readonly GenerateCrosswordEntry[];
  difficulty: DifficultyLevel;
  themeId: string;
  themeName: string;
  seed?: string;
};
