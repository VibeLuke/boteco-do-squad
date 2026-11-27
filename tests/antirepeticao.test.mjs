// Trava contra pontuar de novo: palavras repetidas, tabuleiro reaberto, chute letra a letra e retomada.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

registerHooks({
  resolve(spec, ctx, next) {
    if ((spec.startsWith('./') || spec.startsWith('../')) && !path.extname(spec) && ctx.parentURL) {
      const cand = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), `${spec}.ts`);
      if (fs.existsSync(cand)) return next(pathToFileURL(cand).href, ctx);
    }
    return next(spec, ctx);
  },
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { generateCrossword } = await import('../src/engine/generator.ts');
const { parseKey, seenWords, overlap, pickLeastSeen, decideScoring, relevantTheme } = await import('../src/arena/history.ts');
const { computeScore } = await import('../src/utils/scoring.ts');
const { encodeProgress, decodeProgress } = await import('../src/utils/progress.ts');
const { wordCells } = await import('../src/utils/puzzle.ts');

const packDir = path.join(root, 'src/data/packs');
const packs = fs.readdirSync(packDir).map((f) => JSON.parse(fs.readFileSync(path.join(packDir, f), 'utf8')));
const ALL = packs.flatMap((p) => p.entries.map((e) => ({ ...e, themeId: p.id, themeName: p.name })));
const build = (themeId, difficulty, seed) => {
  const pack = packs.find((p) => p.id === themeId);
  const entries = themeId === 'all' ? ALL : pack.entries;
  return generateCrossword({ entries, difficulty, themeId, themeName: pack?.name ?? 'Misto', seed });
};
const wordsOf = (_key, ref) => build(ref.themeId, ref.difficulty, ref.seed).words.map((w) => w.word);

// Placar de um jogador com os três tabuleiros de Anime no médio (amostra de uso real).
const WILL_TREE = {
  will: {
    'LEX-AF94_M_anime-hq': { s: 195, t: 1795661434827 },
    'LEX-AV33_M_anime-hq': { s: 390, t: 1795661337929 },
    'LEX-GRMP_M_anime-hq': { s: 1415, t: 1795655347271 },
  },
  tati: { 'LEX-8L8B_M_games-classicos': { s: 1653, t: 1795660756591 } },
};

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

test('parseKey lê as chaves reais do placar', () => {
  assert.deepEqual(parseKey('LEX-AV33_M_anime-hq'), { seed: 'LEX-AV33', difficulty: 'medium', themeId: 'anime-hq' });
  assert.deepEqual(parseKey('LEX-XNHK_D_all'), { seed: 'LEX-XNHK', difficulty: 'hard', themeId: 'all' });
  assert.deepEqual(parseKey('MEU_SEED_F_fantasia-scifi-rpg'), { seed: 'MEU_SEED', difficulty: 'easy', themeId: 'fantasia-scifi-rpg' });
  assert.equal(parseKey('lixo'), null);
});

test('gerador é determinístico (base para remontar o histórico em qualquer aparelho)', () => {
  const a = build('anime-hq', 'medium', 'LEX-GRMP').words.map((w) => `${w.word}@${w.row},${w.col},${w.direction}`);
  const b = build('anime-hq', 'medium', 'LEX-GRMP').words.map((w) => `${w.word}@${w.row},${w.col},${w.direction}`);
  assert.deepEqual(a, b);
});

test('mesmo código, mesmo tabuleiro mesmo em aparelho lento (sem corte por relógio)', () => {
  const sig = (p) => p.words.map((w) => `${w.word}@${w.row},${w.col},${w.direction}`).join('|');
  const real = Date.now;
  let changed = 0;
  for (let i = 0; i < 30; i++) {
    const seed = `LEX-C${i}`;
    const fast = sig(build('anime-hq', 'medium', seed));
    let t = real();
    Date.now = () => (t += 1000); // cada consulta ao relógio "leva" 1 s
    try {
      if (sig(build('anime-hq', 'medium', seed)) !== fast) changed++;
    } finally {
      Date.now = real;
    }
  }
  assert.equal(changed, 0, `${changed}/30 tabuleiros mudaram com o relógio lento`);
});

test('o caso relatado: AV33 repete 9 das 14 palavras de GRMP', () => {
  const grmp = new Set(wordsOf('', parseKey('LEX-GRMP_M_anime-hq')));
  const av33 = wordsOf('', parseKey('LEX-AV33_M_anime-hq'));
  assert.equal(overlap(av33, grmp), 9);
});

test('seenWords junta só os tabuleiros do jogador, fora o atual e nos temas que repetem', () => {
  const seen = seenWords(WILL_TREE, 'will', 'anime-hq', 'LEX-AV33_M_anime-hq', wordsOf);
  const expected = new Set([...wordsOf('', parseKey('LEX-AF94_M_anime-hq')), ...wordsOf('', parseKey('LEX-GRMP_M_anime-hq'))]);
  assert.deepEqual([...seen].sort(), [...expected].sort());
  assert.equal(seenWords(WILL_TREE, 'will', 'astronomia', '', wordsOf).size, 0, 'outro tema não conta');
  assert.equal(seenWords(WILL_TREE, 'bia', 'anime-hq', '', wordsOf).size, 0, 'outro jogador não conta');
  assert.ok(relevantTheme('all', 'anime-hq') && relevantTheme('anime-hq', 'all') && !relevantTheme('anime-hq', 'astronomia'));
});

test('sorteio com o histórico do Will repete bem menos que 9 palavras', () => {
  const seen = seenWords(WILL_TREE, 'will', 'anime-hq', '', wordsOf);
  let i = 0;
  const seeds = Array.from({ length: 40 }, (_, k) => `LEX-T${k}Z`);
  // Sem o sorteio: o primeiro tabuleiro que vier.
  const naive = overlap(wordsOf('', { seed: seeds[0], difficulty: 'medium', themeId: 'anime-hq' }), seen);
  const best = pickLeastSeen(
    () => build('anime-hq', 'medium', seeds[i++]),
    (p) => p.words.map((w) => w.word),
    seen,
    { max: 8, budgetMs: 10_000 },
  );
  console.log(`  palavras já vistas pelo Will: ${seen.size}; 1º tabuleiro sem sorteio repete ${naive}; com sorteio (8) repete ${best.repeats}`);
  assert.ok(best.repeats < 9, `repetiu ${best.repeats}`);
  assert.ok(best.repeats <= naive);
  assert.equal(best.tried, 8);
});

test('pickLeastSeen respeita o tempo e para no primeiro tabuleiro sem repetição', () => {
  let t = 0;
  let n = 0;
  const r = pickLeastSeen(() => ({ w: ['A', 'B'] }), (p) => p.w, new Set(['A']), { max: 50, budgetMs: 5, clock: () => (t += 3) });
  assert.equal(r.tried, 2, 'tempo esgotado depois do 2º');
  const z = pickLeastSeen(() => ({ w: n++ === 1 ? ['C'] : ['A'] }), (p) => p.w, new Set(['A']), { max: 50, budgetMs: 1e9 });
  assert.equal(z.repeats, 0);
  assert.equal(z.tried, 2);
});

// --- Pontuação
const puzzle = build('anime-hq', 'easy', 'LEX-TEST');
const empty = () => puzzle.grid.map((row) => row.map(() => ''));
const noLock = () => puzzle.grid.map((row) => row.map(() => false));
const rules = { freeHints: 99, multiplier: 1 };
const fill = (letters, w) => {
  for (const [r, c] of wordCells(w)) letters[r][c] = puzzle.grid[r][c].letter;
};
const input = (letters, extra = {}) => ({ letters, locked: noLock(), hintsUsed: 0, checks: 0, elapsed: 0, won: false, ...extra });

test('chute letra a letra não pontua: só a palavra fechada vale', () => {
  const w = puzzle.words[0];
  const letters = empty();
  const [r, c] = wordCells(w)[0];
  letters[r][c] = puzzle.grid[r][c].letter;
  assert.equal(computeScore(puzzle, input(letters), rules, new Set()).score, 0, 'uma letra certa sozinha = 0');
  fill(letters, w);
  assert.equal(computeScore(puzzle, input(letters), rules, new Set()).score, w.word.length * 10);
});

test('palavra repetida vale 0 e marca a pista', () => {
  const w = puzzle.words[0];
  const letters = empty();
  fill(letters, w);
  const res = computeScore(puzzle, input(letters), rules, new Set([w.word]));
  assert.equal(res.score, 0);
  assert.equal(res.repeatKeys.size, 1);
  assert.equal(res.newWords, puzzle.words.length - 1);
});

test('casa revelada não vale; bônus de tempo só pela fração de palavras novas', () => {
  const letters = empty();
  for (const w of puzzle.words) fill(letters, w);
  const cells = puzzle.grid.flat().filter((x) => x.letter).length;
  const all = computeScore(puzzle, input(letters, { won: true }), rules, new Set());
  assert.equal(all.timeBonus, cells * 8);
  assert.equal(all.score, cells * 10 + cells * 8);
  const half = new Set(puzzle.words.slice(0, puzzle.words.length / 2).map((w) => w.word));
  const rep = computeScore(puzzle, input(letters, { won: true }), rules, half);
  assert.equal(rep.timeBonus, Math.round((cells * 8 * (puzzle.words.length - half.size)) / puzzle.words.length));
  const locked = noLock();
  const [r, c] = wordCells(puzzle.words[0])[0];
  locked[r][c] = true;
  const withHint = computeScore(puzzle, input(letters, { locked }), rules, new Set());
  assert.equal(withHint.score, (cells - 1) * 10);
});

// --- Tabuleiro reaberto
test('reabrir um tabuleiro que já está no placar sem progresso salvo vira treino', () => {
  assert.equal(decideScoring(null, true, 'live'), 'off');
  assert.equal(decideScoring(null, true, 'connecting'), 'off', 'cache local já mostra o registro');
  assert.equal(decideScoring(null, false, 'connecting'), 'wait', 'sem servidor ainda: não decide');
  assert.equal(decideScoring(null, false, 'live'), 'on');
  assert.equal(decideScoring(true, true, 'live'), 'on', 'retomando a própria partida continua valendo');
  assert.equal(decideScoring(false, false, 'live'), 'off', 'treino salvo continua treino');
});

test('progresso salvo volta igual e não aceita lixo nem tamanho errado', () => {
  const letters = empty();
  fill(letters, puzzle.words[0]);
  const locked = noLock();
  const [r, c] = wordCells(puzzle.words[0])[1];
  locked[r][c] = true;
  const state = { letters, locked, hintsUsed: 2, checks: 1, revealedLetters: 1, elapsed: 77, status: 'won' };
  const saved = JSON.parse(JSON.stringify(encodeProgress(state, true, ['SEIYA'], 1)));
  const back = decodeProgress(saved, puzzle);
  assert.deepEqual(back.letters, letters);
  assert.deepEqual(back.locked, locked);
  assert.equal(back.elapsed, 77);
  assert.equal(back.status, 'playing', '"won" sem o tabuleiro resolvido não vale');
  assert.equal(decodeProgress({ ...saved, letters: saved.letters.slice(1) }, puzzle), null);
  assert.equal(decodeProgress(null, puzzle), null);
});

console.log(`\n${passed} testes da trava contra repetição passaram`);
