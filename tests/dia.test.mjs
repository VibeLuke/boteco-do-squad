// Testes da Fase 2 do bar: Palavra do Dia (cores, lista congelada, dia das 6 h, pontos, regras) e os cômodos.
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

const daily = await import('../src/bar/daily.ts');
const day = await import('../src/bar/day.ts');
const { ROOMS, SALAO, LOUSA, walkableFn, doorTile } = await import('../src/bar/room.ts');
const { findPath } = await import('../src/bar/path.ts');
const { applyUpdate } = await import('./mock-rules.mjs');
const { rng } = await import('./aleatorio.mjs');
const here = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};
const brt = (iso) => Date.parse(`${iso}-03:00`);

/** Oráculo das cores, escrito de outro jeito: conta letras que sobram e distribui da esquerda para a direita. */
function oracle(guess, answer) {
  const res = [];
  const pool = {};
  for (let i = 0; i < answer.length; i++) if (guess[i] !== answer[i]) pool[answer[i]] = (pool[answer[i]] || 0) + 1;
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) res.push('V');
    else if (pool[guess[i]] > 0) {
      res.push('A');
      pool[guess[i]] -= 1;
    } else res.push('X');
  }
  return res.join('');
}

test('cores: casos com letra repetida', () => {
  assert.equal(daily.grade('AAAAAA', 'MARAJO'), 'XVXVXX', 'só os dois A no lugar');
  assert.equal(daily.grade('ARARAS', 'MARAJO'), 'AAAXXX', 'só 2 A e 1 R na resposta: o 2º R e o 3º A ficam apagados');
  assert.equal(daily.grade('MARAJO', 'MARAJO'), 'VVVVVV');
  assert.equal(daily.grade('OJARAM', 'MARAJO'), 'AAAAAA');
  assert.equal(daily.grade('LLAMA', 'ALPHA'), 'XVAXV', 'o L verde gasta o único L; o 1º L fica apagado');
});

test('cores: 20 mil chutes sorteados batem com o oráculo', () => {
  const rand = rng(42);
  const pick = (n, abc) => Array.from({ length: n }, () => abc[Math.floor(rand() * abc.length)]).join('');
  for (let i = 0; i < 20_000; i++) {
    const n = 5 + Math.floor(rand() * 3);
    const abc = 'AEIRSTO'.slice(0, 3 + Math.floor(rand() * 5));
    const a = pick(n, abc);
    const g = pick(n, abc);
    assert.equal(daily.grade(g, a), oracle(g, a), `${g} × ${a}`);
  }
});

test('lista congelada: mesma palavra no mesmo dia, para sempre', () => {
  assert.equal(daily.wordOfDay('20783').w, 'MARAJO');
  assert.equal(daily.wordOfDay(20784).w, 'MITOSE');
  assert.equal(daily.wordOfDay(20785).w, 'CORDEL');
  const list = JSON.parse(fs.readFileSync(path.join(here, '..', 'src', 'data', 'palavras-do-dia.json'), 'utf8'));
  assert.equal(list.start, 20783);
  assert.ok(list.words.length >= 670, 'só cresce');
  assert.ok(list.words.every((w) => /^[A-Z]{5,7}$/.test(w.w) && w.c.length > 5), 'de 5 a 7 letras A–Z, com dica');
  assert.equal(new Set(list.words.map((w) => w.w)).size, list.words.length, 'sem repetida');
  assert.equal(daily.wordOfDay(20783 + list.words.length).w, 'MARAJO', 'dá a volta depois da última');
  assert.equal(daily.wordOfDay(20782).w, list.words.at(-1).w, 'antes do início também funciona');
  // A dica não traz a resposta como palavra (nem como começo de palavra).
  const words = (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[^A-Z]+/);
  for (const w of list.words) assert.ok(!words(w.c).some((x) => x.startsWith(w.w)), `dica entrega ${w.w}`);
});

test('dia: vira às 6 h de Brasília, igual à expressão das regras', () => {
  assert.equal(day.dayKey(brt('2026-11-26T06:00:00')), '20783');
  assert.equal(day.dayKey(brt('2026-11-26T05:59:59')), '20782');
  assert.equal(day.startOfDay(brt('2026-11-27T03:00:00')), brt('2026-11-26T06:00:00'));
  const rand = rng(7);
  for (let i = 0; i < 2000; i++) {
    const now = 1_700_000_000_000 + Math.floor(rand() * 4e10);
    const rule = now - ((now - 32400000) % 86400000); // a mesma conta do database.rules.json
    assert.equal(day.startOfDay(now), rule);
    assert.equal(day.dayKey(now), day.dayKey(rule));
    assert.notEqual(day.dayKey(rule - 1), day.dayKey(rule));
  }
  const rules = fs.readFileSync(path.join(here, '..', 'database.rules.json'), 'utf8');
  assert.ok(rules.includes('(now - ((now - 32400000) % 86400000))'));
  assert.equal(day.DAY_SHIFT_MS, 32400000);
  assert.equal(day.DAY_MS, 86400000);
});

test('registro do dia: ontem não conta; acerto sai da última cor; pontos e sino', () => {
  const now = brt('2026-11-26T20:00:00');
  const dia = daily.sanitizeDia(
    {
      will: { g: 'XAXVXX|VVVVVV', t: brt('2026-11-26T19:00:00') },
      bia: { g: 'VVVVVV', t: brt('2026-11-26T05:00:00') },
      tati: { g: 'XXXXXX|XXXXXA', t: brt('2026-11-26T10:00:00') },
      zeca: { g: 'VVVVVV', t: now },
    },
    now,
  );
  assert.deepEqual(Object.keys(dia).sort(), ['tati', 'will']);
  assert.equal(dia.will.n, 2);
  assert.equal(dia.will.ok, true);
  assert.equal(dia.tati.ok, false);
  assert.equal(daily.dailyScore(dia.will, false), 250);
  assert.equal(daily.dailyScore(dia.will, true), 350);
  assert.equal(daily.dailyScore({ g: ['VVVVV'], n: 1, ok: true, t: now }, true), 400);
  assert.equal(daily.dailyScore({ g: Array(6).fill('XXXXX').fill('VVVVV', 5), n: 6, ok: true, t: now }, false), 50);
  assert.equal(daily.dailyScore(dia.tati, true), 0);
  assert.equal(daily.canGuess(dia.will), false, 'acertou: acabou');
  assert.equal(daily.canGuess({ g: Array(6).fill('XXXXX'), n: 6, ok: false, t: now }), false, '6 chutes: acabou');
  assert.equal(daily.canGuess(dia.tati), true);
  assert.deepEqual(daily.nextEntry(dia.tati, 'VVVVVV'), { g: 'XXXXXX|XXXXXA|VVVVVV', n: 3, ok: true });
  assert.equal(daily.sinoToday({ p: 'bia', t: brt('2026-11-26T05:59:00') }, now), null, 'sino de ontem');
  assert.deepEqual(daily.sinoToday({ p: 'bia', t: brt('2026-11-26T08:00:00') }, now), { p: 'bia', t: brt('2026-11-26T08:00:00') });
  assert.deepEqual(daily.boardOrder(dia), ['will', 'tati', 'vini', 'dani', 'bia']);
  assert.equal(daily.scoreKey('20783'), 'DIA-20783');
  assert.equal(daily.normalizeGuess(' marajó! '), 'MARAJO');
});

test('regras: um chute por vez, até 6, nada depois do acerto; recomeça no dia novo', () => {
  const now = brt('2026-11-26T20:00:00');
  const up = (tree, u, t) => applyUpdate(tree, ['cruzadabotecos', 'bar'], u, t);
  const put = (g, n, ok, t) => ({ 'dia/will': { g, n, ok, t } });
  const one = up({}, put('XAXVXX', 1, false, now), now);
  assert.ok(one, '1º chute');
  assert.equal(up({}, put('XAXVXX', 2, false, now), now), null, 'começa no 1');
  const t2 = now + 5000;
  const two = up(one, put('XAXVXX|XXXXXX', 2, false, t2), t2);
  assert.ok(two, '2º chute');
  assert.equal(up(one, put('XAXVXX|XXXXXX|XXXXXX', 3, false, t2), t2), null, 'pulo de contagem');
  assert.equal(up(one, put('VVVVVV|XXXXXX', 2, false, t2), t2), null, 'reescreve o chute antigo');
  assert.equal(up(one, put('XAXVXX', 1, false, t2), t2), null, 'apaga o chute (volta para 1)');
  assert.equal(up(one, put('XAXVXX|XXXXXX', 2, true, t2), t2), null, 'diz que acertou sem as cores verdes');
  let tree = one;
  let g = 'XAXVXX';
  let t = now;
  for (let n = 2; n <= 6; n++) {
    t += 1000;
    g += '|XXXXXX';
    tree = up(tree, put(g, n, false, t), t);
    assert.ok(tree, `chute ${n}`);
  }
  t += 1000;
  assert.equal(up(tree, put(g + '|VVVVVV', 7, true, t), t), null, '7º chute');
  const won = up(one, put('XAXVXX|VVVVVV', 2, true, t2), t2);
  assert.ok(won, 'acerto');
  const t3 = t2 + 1000;
  assert.equal(up(won, put('XAXVXX|VVVVVV|XXXXXX', 3, false, t3), t3), null, 'chute depois do acerto');
  const tomorrow = brt('2026-11-27T06:00:01');
  assert.ok(up(won, put('XXXXXX', 1, false, tomorrow), tomorrow), 'dia novo, 1º chute');
  assert.equal(up(won, put('XAXVXX|VVVVVV|XXXXXX', 3, false, tomorrow), tomorrow), null, 'dia novo não continua o de ontem');
});

test('regras: o sino é do primeiro que acerta no dia, junto com o acerto', () => {
  const now = brt('2026-11-26T20:00:00');
  const up = (tree, u, t) => applyUpdate(tree, ['cruzadabotecos', 'bar'], u, t);
  const win = (p, t) => ({ [`dia/${p}`]: { g: 'VVVVVV', n: 1, ok: true, t } });
  const first = up({}, { ...win('will', now), sino: { p: 'will', t: now } }, now);
  assert.ok(first, 'primeiro');
  const t2 = now + 3000;
  assert.equal(up(first, { ...win('bia', t2), sino: { p: 'bia', t: t2 } }, t2), null, 'segundo no mesmo dia');
  assert.ok(up(first, win('bia', t2), t2), 'o segundo grava o acerto sem o sino');
  assert.equal(up({}, { sino: { p: 'will', t: now } }, now), null, 'sino sem acerto');
  assert.equal(up({}, { 'dia/will': { g: 'XXXXXX', n: 1, ok: false, t: now }, sino: { p: 'will', t: now } }, now), null, 'sino com erro');
  assert.equal(up({}, { ...win('will', now), sino: { p: 'bia', t: now } }, now), null, 'sino para outro');
  const tomorrow = brt('2026-11-27T06:00:01');
  assert.ok(up(first, { ...win('bia', tomorrow), sino: { p: 'bia', t: tomorrow } }, tomorrow), 'dia novo, sino livre');
});

test('cômodos: portas levam a ladrilhos pisáveis, ida e volta se encontram, tudo alcançável', () => {
  for (const room of Object.values(ROOMS)) {
    const walk = walkableFn(room);
    assert.ok(walk(room.door.x, room.door.y), `${room.id}: entrada`);
    for (const d of room.doors) {
      const t = doorTile(d);
      assert.ok(walk(t.x, t.y), `${room.id}: soleira ${d.label}`);
      if (d.kind !== 'open') continue;
      const other = ROOMS[d.to];
      assert.ok(other, `${room.id}: destino ${d.to}`);
      assert.ok(walkableFn(other)(d.arrive.x, d.arrive.y), `${room.id} → ${d.to}: chegada`);
      // A porta de volta fica a um passo de onde se chega.
      const back = other.doors.find((x) => x.kind === 'open' && x.to === room.id);
      assert.ok(back, `${d.to} tem porta de volta`);
      const bt = doorTile(back);
      assert.ok(Math.abs(bt.x - d.arrive.x) + Math.abs(bt.y - d.arrive.y) === 1, `${d.to}: chega ao lado da porta de volta`);
      assert.ok(findPath(walkableFn(other), d.arrive, bt).length > 0, 'dá para voltar andando');
    }
    for (const a of room.arsenal) assert.ok(walk(a.stand.x, a.stand.y), `${room.id}: lugar de pegar ${a.w}`);
    if (room.chalk) {
      assert.ok(room.chalk.from >= 0 && room.chalk.to < room.cols);
      assert.ok(walk(Math.round((room.chalk.from + room.chalk.to) / 2), 1), 'frente do lousão');
    }
  }
  assert.deepEqual(SALAO.doors.filter((d) => d.kind === 'open').map((d) => d.to).sort(), ['jukebox', 'lousa']);
  assert.ok(LOUSA.chalk && LOUSA.bell !== undefined);
  assert.equal(SALAO.doors.filter((d) => d.kind === 'reforma').length, 1, 'o beco ainda aparece fechado');
});

console.log(`\n${passed} testes da Palavra do Dia e dos cômodos passaram`);
