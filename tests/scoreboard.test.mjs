// Testes do placar (soma, períodos, empate, streaming, saneamento) e dos sprites.
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

const { standings, applyStreamEvent, safeKey, sanitize, MAX_SCORE } = await import('../src/arena/scoreStore.ts');
const { PLAYERS, buildGrid, spriteRects, SPRITE_W, SPRITE_H } = await import('../src/arena/sprites.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

const now = new Date(2026, 10, 25, 20, 0, 0); // quarta, 25/11/2026 20h
const today = now.getTime() - 3600_000;
const lastWeek = now.getTime() - 9 * 86400_000;
const monday = new Date(2026, 10, 23, 12).getTime();

test('safeKey troca caracteres proibidos do Firebase', () => {
  assert.equal(safeKey('LEX-7K2Q.M.astronomia'), 'LEX-7K2Q_M_astronomia');
  assert.equal(safeKey('a#b$c[d]e/f'), 'a_b_c_d_e_f');
});

test('standings soma por jogador e ordena', () => {
  const tree = { will: { a: { s: 100, t: today }, b: { s: 50, t: today } }, bia: { c: { s: 120, t: today } } };
  const rows = standings(tree, 'all', now);
  assert.deepEqual(rows.slice(0, 2).map((r) => [r.id, r.total, r.boards, r.rank]), [
    ['will', 150, 2, 1],
    ['bia', 120, 1, 2],
  ]);
  assert.equal(rows.length, 5);
  assert.ok(rows.slice(2).every((r) => r.total === 0 && r.rank === 3));
});

test('períodos: hoje, semana (desde segunda) e geral', () => {
  const tree = { tati: { a: { s: 10, t: today }, b: { s: 20, t: monday }, c: { s: 40, t: lastWeek } } };
  const total = (p) => standings(tree, p, now).find((r) => r.id === 'tati').total;
  assert.equal(total('today'), 10);
  assert.equal(total('week'), 30);
  assert.equal(total('all'), 70);
});

test('empate desempata pela melhor partida', () => {
  const tree = { vini: { a: { s: 50, t: today }, b: { s: 50, t: today } }, dani: { c: { s: 100, t: today } } };
  const rows = standings(tree, 'all', now);
  assert.equal(rows[0].id, 'dani');
  assert.equal(rows[1].id, 'vini');
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[1].rank, 1);
});

test('sanitize descarta jogador desconhecido, valor negativo, acima do teto e lixo', () => {
  const clean = sanitize({
    zeca: { a: { s: 10, t: 1 } },
    will: { ok: { s: 10.4, t: 1 }, neg: { s: -1, t: 1 }, big: { s: MAX_SCORE + 1, t: 1 }, txt: { s: '9', t: 1 }, nul: null },
  });
  assert.deepEqual(clean, { will: { ok: { s: 10, t: 1 } } });
  assert.deepEqual(sanitize(null), {});
});

test('streaming: put na raiz, put em caminho, patch e remoção', () => {
  let t = applyStreamEvent({}, 'put', '/', { will: { a: { s: 1, t: 1 } } });
  t = applyStreamEvent(t, 'put', '/bia/b', { s: 5, t: 2 });
  t = applyStreamEvent(t, 'patch', '/will', { a: { s: 9, t: 3 }, 'c/s': 4 });
  assert.deepEqual(t, { will: { a: { s: 9, t: 3 }, c: { s: 4 } }, bia: { b: { s: 5, t: 2 } } });
  t = applyStreamEvent(t, 'put', '/bia', null);
  assert.equal(t.bia, undefined);
});

test('sprites: 5 jogadores × 4 poses, grade 24×34, todos diferentes', () => {
  assert.deepEqual(PLAYERS.map((p) => p.name), ['Vini', 'Will', 'Dani', 'Bia', 'Tati']);
  const seen = new Set();
  for (const p of PLAYERS) {
    for (const pose of ['idle', 'punch', 'hurt', 'win']) {
      const g = buildGrid(p.id, pose);
      assert.equal(g.length, SPRITE_H);
      assert.ok(g.every((row) => row.length === SPRITE_W));
      const filled = g.flat().filter(Boolean).length;
      assert.ok(filled > 250, `${p.id}/${pose} tem só ${filled} pixels`);
      const sig = JSON.stringify(g);
      assert.ok(!seen.has(sig), `${p.id}/${pose} repetido`);
      seen.add(sig);
      assert.ok(spriteRects(p.id, pose).length < filled, 'mescla por linha deve reduzir retângulos');
    }
  }
});

console.log(`\n${passed} testes do placar e sprites passaram`);
