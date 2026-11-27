// Testes da Fase 4 do bar: Mesa de sinuca com o Quiz geek (lista congelada, opções, relógio do servidor, pontos,
// torcida ao vivo, regras) e a bola 8 rolando.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

registerHooks({
  resolve(spec, ctx, next) {
    if ((spec.startsWith('./') || spec.startsWith('../')) && !path.extname(spec) && ctx.parentURL) {
      const cand = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), `${spec}.ts`);
      if (fs.existsSync(cand)) return next(pathToFileURL(cand).href, ctx);
    }
    return next(spec, ctx);
  },
});

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const quiz = await import('../src/bar/quiz.ts');
const social = await import('../src/bar/social.ts');
const daily = await import('../src/bar/daily.ts');
const ana = await import('../src/bar/anagram.ts');
const { SINUCA, JUKEBOX, ROOMS, walkableFn } = await import('../src/bar/room.ts');
const { applyUpdate } = await import('./mock-rules.mjs');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', f), 'utf8'));
const DATA = read('quiz.json');
const ANA = read('anagramas.json');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};
const brt = (iso) => Date.parse(`${iso}-03:00`);
const GOLDEN = [
  ['DRIVER', 'VARIAVEL', 'CURSOR', 'ARQUIVO'],
  ['TARSILA', 'AFRESCO', 'PREFACIO', 'HIPERBOLE'],
];
const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

test('lista congelada: 135 dias de 10 perguntas, respostas sem repetir, erradas do mesmo pacote', () => {
  assert.equal(DATA.start, 20783);
  assert.equal(DATA.days.length, 135);
  const packs = new Map();
  for (const f of fs.readdirSync(path.join(root, 'src', 'data', 'packs'))) {
    const p = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'packs', f), 'utf8'));
    packs.set(p.name, new Set((p.entries ?? []).map((e) => e.word)));
  }
  const seen = new Set();
  DATA.days.forEach((set, d) => {
    assert.equal(set.length, 10, `dia ${d}`);
    const banned = new Set([daily.wordOfDay(DATA.start + d).w, ...ana.setOfDay(ANA, DATA.start + d).map((w) => w.w)]);
    for (const [w, c, t, wrong] of set) {
      assert.match(w, /^[A-Z]{3,}$/);
      assert.ok(!seen.has(w), `${w} repetida`);
      seen.add(w);
      assert.ok(!plain(c).includes(w), `${w}: a dica entrega a resposta`);
      const pack = packs.get(DATA.themes[t]);
      assert.ok(pack && pack.has(w), `${w}: pacote ${DATA.themes[t]}`);
      assert.equal(wrong.length, 3);
      assert.equal(new Set([w, ...wrong]).size, 4, `${w}: opções repetidas`);
      for (const x of wrong) assert.ok(pack.has(x), `${x} não é de ${DATA.themes[t]}`);
      for (const x of [w, ...wrong]) assert.ok(!banned.has(x), `dia ${d}: ${x} é a Palavra do Dia ou anagrama do dia`);
    }
  });
  const out = execFileSync(process.execPath, [path.join(root, 'scripts', 'gerar-quiz.mjs')], { encoding: 'utf8' });
  assert.match(out, /já existe \(congelada\)/);
});

test('opções: 4 diferentes, a certa no lugar marcado, igual em todo aparelho', () => {
  const where = [0, 0, 0, 0];
  DATA.days.forEach((_, d) => {
    for (const q of quiz.questionsOfDay(DATA, DATA.start + d)) {
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options).size, 4);
      assert.equal(q.options[q.right], q.w);
      where[q.right]++;
    }
  });
  // A certa cai espalhada pelas 4 posições (nenhuma com menos de 20 % ou mais de 30 % de 1350).
  for (const n of where) assert.ok(n > 270 && n < 405, `posições da certa: ${where}`);
  // Referência congelada do 1º dia: versão nova publicada no meio do dia mostra as mesmas opções na mesma ordem.
  assert.deepEqual(
    quiz.questionsOfDay(DATA, 20783).map((q) => q.right),
    quiz.questionsOfDay(DATA, 20783).map((q) => q.options.indexOf(q.w)),
  );
  assert.deepEqual(quiz.questionsOfDay(DATA, 20783).slice(0, 2).map((q) => q.options), GOLDEN);
  assert.deepEqual(quiz.questionsOfDay(DATA, 20783 + 135).map((q) => q.w), quiz.questionsOfDay(DATA, 20783).map((q) => q.w), 'dá a volta');
});

test('pontos: 20 pelo acerto + até 10 pela rapidez; depois de 16,5 s não vale; errou ou não respondeu, 0', () => {
  const q = { i: 0, w: 'X', clue: '', theme: '', options: ['A', 'B', 'C', 'D'], right: 2 };
  const at = (ms, k = 2) => quiz.answerPoints(q, { o: 1000, k, a: 1000 + ms });
  assert.equal(at(0), 30);
  assert.equal(at(7500), 25);
  assert.equal(at(15000), 20);
  assert.equal(at(16500), 20, 'folga de rede');
  assert.equal(at(16501), 0, 'depois da folga');
  assert.equal(at(1000, 1), 0, 'errou');
  assert.equal(quiz.answerPoints(q, { o: 1000, k: -1, a: 0 }), 0, 'não respondeu');
  assert.equal(quiz.answerPoints(q, undefined), 0);
  assert.equal(quiz.answerPoints(q, { o: 1000, k: 2, a: 999 }), 0, 'resposta antes de abrir');
  assert.equal(quiz.quizScoreKey('20783'), 'QUIZ-20783');
  const qs = quiz.questionsOfDay(DATA, 20783);
  const full = qs.map((x) => ({ o: 0, k: x.right, a: 0 }));
  assert.equal(quiz.quizScore(full, qs), 300, 'teto do dia');
});

test('estado e pergunta da vez: aberta volta, respondida e vencida pulam, fim = null', () => {
  const now = 100_000;
  assert.equal(quiz.stateOf(undefined, now), 'fechada');
  assert.equal(quiz.stateOf({ o: now - 16_500, k: -1, a: 0 }, now), 'aberta');
  assert.equal(quiz.stateOf({ o: now - 16_501, k: -1, a: 0 }, now), 'tempo');
  assert.equal(quiz.stateOf({ o: now - 99_000, k: 0, a: now - 98_000 }, now), 'respondida');
  const rec = Array.from({ length: 10 }, () => undefined);
  assert.equal(quiz.currentQuestion(rec, now), 0);
  rec[0] = { o: now - 50_000, k: 1, a: now - 49_000 };
  rec[1] = { o: now - 30_000, k: -1, a: 0 };
  rec[2] = { o: now - 3_000, k: -1, a: 0 };
  assert.equal(quiz.currentQuestion(rec, now), 2, 'volta para a aberta');
  rec[2] = { o: now - 3_000, k: 0, a: now - 1_000 };
  assert.equal(quiz.currentQuestion(rec, now), 3);
  for (let i = 3; i < 10; i++) rec[i] = { o: now - 40_000, k: -1, a: 0 };
  assert.equal(quiz.currentQuestion(rec, now), null);
});

test('registro do dia: ontem não conta; formato estragado e jogador de fora são ignorados', () => {
  const now = brt('2026-11-26T22:00:00');
  const raw = {
    will: [{ o: now - 5000, k: 1, a: now - 2000 }, { o: brt('2026-11-26T05:59:00'), k: 1, a: now }],
    bia: { 3: { o: now - 1000, k: -1, a: 0 }, 11: { o: now, k: 0, a: now }, 4: { o: now, k: 7, a: now }, 5: { o: now, k: 0, a: now - 10 } },
    intruso: { 0: { o: now, k: 0, a: now } },
  };
  const all = quiz.sanitizeQuiz(raw, now);
  assert.deepEqual(Object.keys(all).sort(), ['bia', 'will']);
  assert.ok(all.will[0] && !all.will[1], 'pergunta aberta antes das 6 h');
  assert.ok(all.bia[3] && !all.bia[4] && !all.bia[5]);
  assert.deepEqual(quiz.sanitizeQuiz(raw, brt('2026-11-27T06:00:00')), {});
});

test('torcida: mostra quem está jogando, o relógio e o ACERTOU/ERROU por 2,5 s; nada quando parado', () => {
  const qs = quiz.questionsOfDay(DATA, 20783);
  const now = 1_000_000;
  assert.equal(quiz.liveOf({}, qs, now), null);
  const open = { bia: [{ o: now - 4000, k: -1, a: 0 }] };
  assert.deepEqual(quiz.liveOf(open, qs, now), { p: 'bia', i: 0, phase: 'aberta', ms: 11000, done: 0, points: 0 });
  const right = { will: [{ o: now - 6000, k: qs[0].right, a: now - 1000 }] };
  const l = quiz.liveOf(right, qs, now);
  assert.equal(l.phase, 'acertou');
  assert.equal(l.points, 20 + Math.round(10 * (1 - 5000 / 15000)));
  const wrong = { will: [{ o: now - 6000, k: (qs[0].right + 1) % 4, a: now - 1000 }] };
  assert.equal(quiz.liveOf(wrong, qs, now).phase, 'errou');
  assert.equal(quiz.liveOf(wrong, qs, now + 1499).phase, 'errou', '2,499 s depois ainda aparece');
  assert.equal(quiz.liveOf(wrong, qs, now + 1500), null, 'some aos 2,5 s');
  const late = { tati: [{ o: now - 17_000, k: -1, a: 0 }] };
  assert.equal(quiz.liveOf(late, qs, now).phase, 'tempo');
  // Duas pessoas: vale a atividade mais recente.
  assert.equal(quiz.liveOf({ ...open, will: [{ o: now - 1000, k: -1, a: 0 }] }, qs, now).p, 'will');
  // A mais recente vence mesmo quando vem depois na lista dos amigos (Will vem antes de Bia).
  assert.equal(quiz.liveOf({ will: [{ o: now - 4000, k: -1, a: 0 }], bia: [{ o: now - 1000, k: -1, a: 0 }] }, qs, now).p, 'bia');
});

test('regras: abre uma vez por dia, responde uma vez, hora do servidor, nada de reabrir para zerar o relógio', () => {
  const now = brt('2026-11-26T20:00:00');
  const up = (tree, u, t) => applyUpdate(tree, ['cruzadabotecos', 'bar'], u, t);
  const put = (p, i, o, k, a, extra = {}) => ({ [`quiz/${p}/${i}`]: { o, k, a, ...extra } });
  const opened = up({}, put('will', 0, now, -1, 0), now);
  assert.ok(opened, 'abrir');
  const t2 = now + 4000;
  assert.equal(up(opened, put('will', 0, t2, -1, 0), t2), null, 'reabrir zerando o relógio');
  const answered = up(opened, put('will', 0, now, 2, t2), t2);
  assert.ok(answered, 'responder');
  assert.equal(up(answered, put('will', 0, now, 1, t2 + 1), t2 + 1), null, 'trocar a resposta');
  assert.equal(up(opened, put('will', 0, now + 3000, 2, t2), t2), null, 'responder mexendo na hora de abrir');
  assert.equal(up(opened, put('will', 0, now, 2, t2 - 1), t2), null, 'hora da resposta inventada');
  assert.equal(up({}, put('will', 1, now, 2, now), now), null, 'responder sem abrir');
  assert.equal(up({}, put('will', 0, now, 0, 0), now), null, 'abrir já respondendo');
  assert.equal(up({}, put('will', 0, now - 1, -1, 0), now), null, 'abrir com hora inventada');
  assert.equal(up(opened, put('will', 0, now, 4, t2), t2), null, 'opção 4');
  assert.equal(up(opened, put('will', 0, now, 1.5, t2), t2), null, 'opção quebrada');
  assert.equal(up({}, put('will', 10, now, -1, 0), now), null, 'pergunta 10');
  assert.equal(up({}, put('intruso', 0, now, -1, 0), now), null, 'jogador de fora');
  assert.equal(up({}, put('will', 0, now, -1, 0, { s: 30 }), now), null, 'campo a mais');
  const tomorrow = brt('2026-11-27T06:00:01');
  assert.ok(up(answered, put('will', 0, tomorrow, -1, 0), tomorrow), 'dia novo abre de novo');
});

test('regras publicáveis espelham o mock; a bola entra nos efeitos', () => {
  const bar = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8')).rules.cruzadabotecos.bar;
  const n = bar.quiz.$player.$i;
  assert.match(n['.write'], /\$i\.matches\(\/\^\[0-9\]\$\/\)/);
  assert.match(n['.write'], /newData\.child\('o'\)\.val\(\) === now && newData\.child\('k'\)\.val\(\) === -1 && newData\.child\('a'\)\.val\(\) === 0/);
  assert.match(n['.write'], /data\.child\('k'\)\.val\(\) === -1 && newData\.child\('o'\)\.val\(\) === data\.child\('o'\)\.val\(\)/);
  assert.match(n['.write'], /newData\.child\('a'\)\.val\(\) === now\)\)$/);
  assert.match(n['.write'], /\(now - \(\(now - 32400000\) % 86400000\)\)/);
  assert.match(n.k['.validate'], />= -1 && newData\.val\(\) <= 3/);
  assert.equal(n.$other['.validate'], false);
  assert.match(bar.fx.$player.$slot.k['.validate'], /\|bola[|)]/); // Fatia 15: brinde e reviver vêm depois
  // A bola com o carimbo de ritmo, como as outras bizarrices.
  const now = brt('2026-11-26T20:00:00');
  const ok = applyUpdate({}, ['cruzadabotecos', 'bar'], { 'rate/will': { at: now }, 'fx/will/0': { k: 'bola', to: 'bia', e: '', t: now } }, now);
  assert.ok(ok);
  assert.equal(applyUpdate({}, ['cruzadabotecos', 'bar'], { 'fx/will/0': { k: 'bola', to: 'bia', e: '', t: now } }, now), null, 'sem carimbo');
});

test('bola 8: rola 0,9 s pelo chão, acerta o pé (PLOC) e só existe na sinuca', () => {
  const t = 50_000;
  const fx = social.sanitizeFx({ will: { 0: { k: 'bola', to: 'bia', e: '', t } } });
  assert.equal(fx.length, 1);
  const mid = social.effectsAt(fx, t + 450);
  assert.equal(mid.flying.length, 1);
  assert.equal(mid.flying[0].k, 'bola');
  assert.ok(Math.abs(mid.flying[0].k01 - 0.5) < 1e-9);
  const hit = social.effectsAt(fx, t + 950);
  assert.equal(hit.flying.length, 0);
  assert.equal(hit.by.bia.hurtKind, 'bola');
  assert.equal(hit.by.bia.hurtUntil, t + social.DUR.roll + social.DUR.hurt);
  assert.equal(social.ONLY_IN.bola, 'sinuca');
  assert.ok(social.COOLDOWN_MS.bola >= 5000);
  assert.ok(social.canAct('bola', { dist: 7, targetOnline: true, lastUse: 0, lastAny: 0, now: 1e9 }).ok);
  assert.ok(!social.canAct('bola', { dist: 7.1, targetOnline: true, lastUse: 0, lastAny: 0, now: 1e9 }).ok, 'longe');
});

test('cômodo da sinuca: porta da jukebox, mesa 3×2 bloqueada, beira alcançável e taco na parede', () => {
  assert.equal(ROOMS.sinuca, SINUCA);
  assert.ok(JUKEBOX.doors.some((d) => d.kind === 'open' && d.to === 'sinuca'));
  const walk = walkableFn(SINUCA);
  const tiles = SINUCA.pool.tiles;
  assert.equal(tiles.length, 6);
  for (const p of tiles) assert.ok(!walk(p.x, p.y), `mesa em ${p.x},${p.y} bloqueia`);
  const front = SINUCA.props.filter((p) => p.kind === 'pool');
  assert.equal(front.length, 1);
  const maxDepth = Math.max(...tiles.map((p) => p.x + p.y));
  assert.equal(front[0].x + front[0].y, maxDepth, 'desenhada do ladrilho da frente');
  assert.equal(SINUCA.props.filter((p) => p.kind === 'void').length, 5);
  const st = SINUCA.pool.stand;
  assert.ok(walk(st.x, st.y), 'beira da mesa');
  assert.ok(tiles.some((p) => Math.abs(p.x - st.x) + Math.abs(p.y - st.y) === 1), 'colada na mesa');
  assert.ok(SINUCA.arsenal.some((a) => a.w === 'taco' && walk(a.stand.x, a.stand.y)));
});

console.log(`\n${passed} testes da sinuca passaram`);
