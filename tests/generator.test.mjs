import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Allow Node 24's native TypeScript type-stripping to resolve Vite-style extensionless TS imports.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !path.extname(specifier) &&
      context.parentURL
    ) {
      const parentPath = fileURLToPath(context.parentURL);
      const tsCandidate = path.resolve(path.dirname(parentPath), `${specifier}.ts`);
      if (fs.existsSync(tsCandidate)) {
        return nextResolve(pathToFileURL(tsCandidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const { normalizeLetter, normalizeWord } = await import('../src/engine/normalizer.ts');
const { DIFFICULTY_CONFIG } = await import('../src/engine/difficulty.ts');
const { generateCrossword } = await import('../src/engine/generator.ts');

function buildSamplePool() {
  const raw = [
    ['SOL', 'Sol', 'Estrela central do nosso sistema', 1],
    ['LUA', 'Lua', 'Satélite natural da Terra', 1],
    ['MAR', 'Mar', 'Grande massa de água salgada', 1],
    ['RIO', 'Rio', 'Curso natural de água doce', 1],
    ['CEU', 'Céu', 'Abóbada azul acima das nuvens', 1],
    ['ARCO', 'Arco', 'Curva geométrica ou arma antiga', 1],
    ['CASA', 'Casa', 'Moradia habitual de uma família', 1],
    ['VIDA', 'Vida', 'Existência biológica dos seres', 1],
    ['AGUA', 'Água', 'Líquido essencial composto por H2O', 1],
    ['TERRA', 'Terra', 'Terceiro planeta a partir do astro rei', 1],
    ['VENTO', 'Vento', 'Movimento natural de massas de ar', 1],
    ['PEDRA', 'Pedra', 'Fragmento rígido de rocha mineral', 1],
    ['FOGO', 'Fogo', 'Combustão luminosa que libera calor', 1],
    ['NUVEM', 'Nuvem', 'Conjunto visível de gotículas suspensas', 1],
    ['ONDA', 'Onda', 'Oscilação que propaga energia', 1],
    ['RAIO', 'Raio', 'Descarga elétrica intensa na atmosfera', 1],
    ['ORBITA', 'Órbita', 'Trajetória curva ao redor de um corpo', 2],
    ['COMETA', 'Cometa', 'Astro gelado com cauda luminosa', 2],
    ['PLANETA', 'Planeta', 'Corpo celeste que gira em torno de estrela', 2],
    ['ATOMO', 'Átomo', 'Unidade básica da matéria química', 2],
    ['CELULA', 'Célula', 'Menor unidade viva dos organismos', 2],
    ['ENERGIA', 'Energia', 'Capacidade física de realizar trabalho', 2],
    ['MAGMA', 'Magma', 'Rocha fundida no interior terrestre', 2],
    ['CRISTA', 'Crista', 'Ponto mais alto de uma elevação', 2],
    ['CORAL', 'Coral', 'Estrutura calcária formada em recifes', 2],
    ['DELTA', 'Delta', 'Foz triangular formada por sedimentos', 2],
    ['PRISMA', 'Prisma', 'Sólido óptico que decompõe a luz', 2],
    ['SENSOR', 'Sensor', 'Dispositivo que capta estímulos físicos', 2],
    ['VETOR', 'Vetor', 'Grandeza com módulo, direção e sentido', 2],
    ['ESFERA', 'Esfera', 'Superfície perfeitamente redonda no espaço', 2],
    ['NEBULOSA', 'Nebulosa', 'Vasta nuvem interestelar de gás e poeira', 3],
    ['GALAXIA', 'Galáxia', 'Sistema imenso de bilhões de estrelas', 3],
    ['ECLIPSE', 'Eclipse', 'Ocultação temporária de um astro por outro', 3],
    ['GRAVIDADE', 'Gravidade', 'Atração fundamental entre massas no universo', 3],
    ['ISOTOPO', 'Isótopo', 'Variante atômica com diferente número de nêutrons', 3],
    ['SINAPSE', 'Sinapse', 'Junção funcional entre dois neurônios', 3],
    ['ENTROPIA', 'Entropia', 'Medida termodinâmica de desordem do sistema', 3],
    ['ALGORITMO', 'Algoritmo', 'Sequência finita de passos para resolver algo', 3],
    ['QUARTZO', 'Quartzo', 'Mineral cristalino muito abundante na crosta', 3],
    ['FOTON', 'Fóton', 'Partícula elementar portadora da luz', 3],
    ['CATALISE', 'Catálise', 'Aceleração de reação por substância auxiliar', 3],
    ['TEOREMA', 'Teorema', 'Proposição demonstrada logicamente', 3],
    ['PARALAXE', 'Paralaxe', 'Deslocamento aparente por mudança de ângulo', 3],
    ['SPECTRUM', 'Spectrum', 'Faixa contínua de frequências observadas', 3],
    ['ROTA', 'Rota', 'Caminho traçado entre dois pontos', 1],
    ['MAPA', 'Mapa', 'Representação gráfica de um território', 1],
    ['POLO', 'Polo', 'Extremidade de um eixo de rotação', 1],
    ['EIXO', 'Eixo', 'Linha imaginária central de giro', 1],
    ['ECO', 'Eco', 'Reflexão perceptível de uma onda sonora', 1],
    ['LUZ', 'Luz', 'Radiação visível ao olho humano', 1],
    ['SOM', 'Som', 'Vibração mecânica propagada no ar', 1],
    ['COR', 'Cor', 'Percepção visual de comprimentos de onda', 1],
    ['GAS', 'Gás', 'Estado fluido sem forma ou volume fixo', 1],
    ['SAL', 'Sal', 'Composto iônico cristalino solúvel', 1],
    ['ORO', 'Oro', 'Prefixo grego ligado a montanhas', 2],
    ['FASE', 'Fase', 'Etapa distinta de um ciclo periódico', 2],
    ['REDE', 'Rede', 'Conjunto interconectado de nós e enlaces', 2],
    ['BASE', 'Base', 'Fundamento ou substância alcalina', 2],
    ['ACIDO', 'Ácido', 'Substância doadora de prótons em solução', 2],
    ['ION', 'Íon', 'Átomo ou molécula com carga elétrica líquida', 2],
  ];

  return raw.map(([word, display, clue, difficulty]) => ({
    word,
    display,
    clue,
    difficulty,
  }));
}

function validateCrosswordInvariants(puzzle) {
  const cfg = DIFFICULTY_CONFIG[puzzle.difficulty];
  assert.ok(puzzle.rows > 0 && puzzle.cols > 0, 'Puzzle grid must be non-empty');
  assert.ok(puzzle.rows <= cfg.maxRows, `rows ${puzzle.rows} <= maxRows ${cfg.maxRows}`);
  assert.ok(puzzle.cols <= cfg.maxCols, `cols ${puzzle.cols} <= maxCols ${cfg.maxCols}`);
  assert.equal(puzzle.grid.length, puzzle.rows);
  for (const row of puzzle.grid) {
    assert.equal(row.length, puzzle.cols);
  }

  // Exact bounding box check: every border row/col has at least one letter.
  assert.ok(puzzle.grid[0].some((c) => c.letter !== null), 'Top row must not be empty');
  assert.ok(puzzle.grid[puzzle.rows - 1].some((c) => c.letter !== null), 'Bottom row must not be empty');
  assert.ok(puzzle.grid.some((r) => r[0].letter !== null), 'Left col must not be empty');
  assert.ok(puzzle.grid.some((r) => r[puzzle.cols - 1].letter !== null), 'Right col must not be empty');

  // Verify placed words match grid letters, endcaps are empty, and words are unique.
  const seenWords = new Set();
  const acrossSet = new Set();
  const downSet = new Set();

  for (const w of puzzle.words) {
    assert.ok(!seenWords.has(w.word), `Duplicate word in puzzle: ${w.word}`);
    seenWords.add(w.word);
    assert.match(w.word, /^[A-Z]{3,16}$/);

    const len = w.word.length;
    if (w.direction === 'across') {
      assert.ok(w.col + len <= puzzle.cols, `Word ${w.word} out of col bounds`);
      if (w.col > 0) {
        assert.equal(puzzle.grid[w.row][w.col - 1].letter, null, `Left endcap of ${w.word} must be empty`);
      }
      if (w.col + len < puzzle.cols) {
        assert.equal(puzzle.grid[w.row][w.col + len].letter, null, `Right endcap of ${w.word} must be empty`);
      }
      for (let i = 0; i < len; i++) {
        const cell = puzzle.grid[w.row][w.col + i];
        assert.equal(cell.letter, w.word[i], `Letter mismatch for ${w.word} at i=${i}`);
        assert.equal(cell.acrossNumber, w.number, `acrossNumber mismatch at (${w.row},${w.col + i})`);
      }
      acrossSet.add(`${w.row}:${w.col}:${len}`);
    } else {
      assert.ok(w.row + len <= puzzle.rows, `Word ${w.word} out of row bounds`);
      if (w.row > 0) {
        assert.equal(puzzle.grid[w.row - 1][w.col].letter, null, `Top endcap of ${w.word} must be empty`);
      }
      if (w.row + len < puzzle.rows) {
        assert.equal(puzzle.grid[w.row + len][w.col].letter, null, `Bottom endcap of ${w.word} must be empty`);
      }
      for (let i = 0; i < len; i++) {
        const cell = puzzle.grid[w.row + i][w.col];
        assert.equal(cell.letter, w.word[i], `Letter mismatch for ${w.word} at i=${i}`);
        assert.equal(cell.downNumber, w.number, `downNumber mismatch at (${w.row + i},${w.col})`);
      }
      downSet.add(`${w.row}:${w.col}:${len}`);
    }
  }

  // Every maximal horizontal run >= 2 must be an across word, and every maximal vertical run >= 2 must be a down word!
  // This guarantees zero illegal lateral parallel adjacencies or unintended 2+ letter strings.
  let foundAcrossRuns = 0;
  for (let r = 0; r < puzzle.rows; r++) {
    let c = 0;
    while (c < puzzle.cols) {
      if (puzzle.grid[r][c].letter !== null) {
        const start = c;
        while (c < puzzle.cols && puzzle.grid[r][c].letter !== null) c++;
        const runLen = c - start;
        if (runLen >= 2) {
          assert.ok(
            acrossSet.has(`${r}:${start}:${runLen}`),
            `Illegal horizontal run at row=${r}, col=${start}, len=${runLen}`
          );
          foundAcrossRuns++;
        }
      } else {
        c++;
      }
    }
  }
  assert.equal(foundAcrossRuns, puzzle.across.length);

  let foundDownRuns = 0;
  for (let c = 0; c < puzzle.cols; c++) {
    let r = 0;
    while (r < puzzle.rows) {
      if (puzzle.grid[r][c].letter !== null) {
        const start = r;
        while (r < puzzle.rows && puzzle.grid[r][c].letter !== null) r++;
        const runLen = r - start;
        if (runLen >= 2) {
          assert.ok(
            downSet.has(`${start}:${c}:${runLen}`),
            `Illegal vertical run at row=${start}, col=${c}, len=${runLen}`
          );
          foundDownRuns++;
        }
      } else {
        r++;
      }
    }
  }
  assert.equal(foundDownRuns, puzzle.down.length);

  // 100% connected graph check via BFS over occupied grid cells.
  const occupied = [];
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (puzzle.grid[r][c].letter !== null) {
        occupied.push([r, c]);
      } else {
        assert.equal(puzzle.grid[r][c].number, undefined);
        assert.equal(puzzle.grid[r][c].acrossNumber, undefined);
        assert.equal(puzzle.grid[r][c].downNumber, undefined);
      }
    }
  }
  assert.ok(occupied.length > 0);

  const visited = new Set([`${occupied[0][0]}:${occupied[0][1]}`]);
  const queue = [occupied[0]];
  while (queue.length > 0) {
    const [cr, cc] = queue.shift();
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr >= 0 && nr < puzzle.rows && nc >= 0 && nc < puzzle.cols) {
        if (puzzle.grid[nr][nc].letter !== null) {
          const key = `${nr}:${nc}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push([nr, nc]);
          }
        }
      }
    }
  }
  assert.equal(visited.size, occupied.length, 'Crossword graph must be 100% connected');

  // Verify canonical numbering order (left->right, top->bottom).
  let expectedNum = 1;
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      const hasAcrossStart = puzzle.across.some((w) => w.row === r && w.col === c);
      const hasDownStart = puzzle.down.some((w) => w.row === r && w.col === c);
      if (hasAcrossStart || hasDownStart) {
        assert.equal(puzzle.grid[r][c].number, expectedNum);
        expectedNum++;
      } else {
        assert.equal(puzzle.grid[r][c].number, undefined);
      }
    }
  }
}

function runTests() {
  // 1. Normalizer tests
  assert.equal(normalizeLetter('á'), 'A');
  assert.equal(normalizeLetter('Ç'), 'C');
  assert.equal(normalizeLetter('õ'), 'O');
  assert.equal(normalizeLetter('1'), '');
  assert.equal(normalizeWord('GrAvItAçÃo-123!'), 'GRAVITACAO');
  assert.equal(normalizeWord('Coração & Ação'), 'CORACAOACAO');

  // 2. Difficulty config tests
  assert.equal(DIFFICULTY_CONFIG.easy.maxRows, 10);
  assert.equal(DIFFICULTY_CONFIG.easy.freeHints, 5);
  assert.equal(DIFFICULTY_CONFIG.easy.scoreMultiplier, 1);
  assert.equal(DIFFICULTY_CONFIG.medium.maxRows, 13);
  assert.equal(DIFFICULTY_CONFIG.medium.freeHints, 3);
  assert.equal(DIFFICULTY_CONFIG.medium.scoreMultiplier, 1.5);
  assert.equal(DIFFICULTY_CONFIG.hard.maxRows, 16);
  assert.equal(DIFFICULTY_CONFIG.hard.freeHints, 1);
  assert.equal(DIFFICULTY_CONFIG.hard.scoreMultiplier, 2.5);

  const pool = buildSamplePool();

  // 3. Determinism & Seed auto-generation
  const pAuto = generateCrossword({
    entries: pool,
    difficulty: 'easy',
    themeId: 'ciencia',
    themeName: 'Ciência',
  });
  assert.match(pAuto.seed, /^LEX-[A-Z0-9]{4}$/);
  validateCrosswordInvariants(pAuto);

  const pSeedA = generateCrossword({
    entries: pool,
    difficulty: 'medium',
    themeId: 'ciencia',
    themeName: 'Ciência',
    seed: 'LEX-TEST1',
  });
  const pSeedB = generateCrossword({
    entries: pool,
    difficulty: 'medium',
    themeId: 'ciencia',
    themeName: 'Ciência',
    seed: 'LEX-TEST1',
  });
  assert.deepEqual(pSeedA.grid, pSeedB.grid);
  assert.deepEqual(pSeedA.words, pSeedB.words);

  // 4. All 3 difficulty levels across multiple seeds + performance check (< 150ms each)
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const cfg = DIFFICULTY_CONFIG[difficulty];
    for (let s = 1; s <= 5; s++) {
      const t0 = performance.now();
      const puzzle = generateCrossword({
        entries: pool,
        difficulty,
        themeId: 'ciencia',
        themeName: 'Ciência',
        seed: `SEED-${difficulty}-${s}`,
      });
      const elapsed = performance.now() - t0;

      validateCrosswordInvariants(puzzle);
      assert.ok(
        puzzle.words.length >= cfg.minWords && puzzle.words.length <= cfg.maxWords,
        `${difficulty} seed ${s}: word count ${puzzle.words.length} outside [${cfg.minWords}, ${cfg.maxWords}]`
      );
      assert.ok(puzzle.across.length >= 2 && puzzle.down.length >= 2, 'Balanced across & down');
      assert.ok(elapsed < 150, `Generation took ${elapsed.toFixed(1)}ms (>= 150ms limit)`);

      let intersections = 0;
      for (let r = 0; r < puzzle.rows; r++) {
        for (let c = 0; c < puzzle.cols; c++) {
          const cell = puzzle.grid[r][c];
          if (cell.acrossNumber && cell.downNumber) intersections++;
        }
      }
      assert.ok(intersections >= puzzle.words.length - 1, 'Every word connected by crossings');
      console.log(
        `[OK] ${difficulty} #${s}: ${puzzle.words.length} words (${puzzle.across.length}A/${puzzle.down.length}D), ${puzzle.rows}x${puzzle.cols}, ${intersections} crossings, ${elapsed.toFixed(1)}ms`
      );
    }
  }

  // 5. Small pool fallback test
  const smallPool = pool.slice(0, 10);
  const pSmall = generateCrossword({
    entries: smallPool,
    difficulty: 'hard',
    themeId: 'mini',
    themeName: 'Mini',
    seed: 'MINI-1',
  });
  validateCrosswordInvariants(pSmall);
  assert.ok(pSmall.words.length >= 5, 'Small pool fallback should still connect words');

  // 6. Large Misto-like pool + long-word stress test
  const mistoPool = [];
  for (let i = 0; i < 6; i++) {
    for (const entry of pool) {
      const prefix = String.fromCharCode(65 + i);
      const stretched = (entry.word + prefix).slice(0, 14);
      if (stretched.length >= 3) {
        mistoPool.push({
          word: stretched,
          display: entry.display,
          clue: entry.clue,
          difficulty: entry.difficulty,
          themeId: `pack-${i}`,
          themeName: `Tema ${i}`,
        });
      }
    }
  }
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const cfg = DIFFICULTY_CONFIG[difficulty];
    const t0 = performance.now();
    const pMisto = generateCrossword({
      entries: mistoPool,
      difficulty,
      themeId: 'all',
      themeName: 'Desafio Misto',
      seed: `MISTO-${difficulty}`,
    });
    const elapsed = performance.now() - t0;
    validateCrosswordInvariants(pMisto);
    assert.ok(
      pMisto.words.length >= cfg.minWords && pMisto.words.length <= cfg.maxWords,
      `Misto ${difficulty}: ${pMisto.words.length} outside [${cfg.minWords}, ${cfg.maxWords}]`
    );
    assert.ok(elapsed < 150, `Misto ${difficulty} took ${elapsed.toFixed(1)}ms`);
    console.log(
      `[OK] Misto ${difficulty}: ${pMisto.words.length} words, ${pMisto.rows}x${pMisto.cols}, ${elapsed.toFixed(1)}ms`
    );
  }

  console.log('ALL GENERATOR TESTS PASSED');
}

runTests();
