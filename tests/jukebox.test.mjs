// Testes da Fase 3 do bar: Jukebox com o Anagrama da Saideira (lista congelada, embaralhado, pontos, regras) e a
// música de quem lidera.
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
const ana = await import('../src/bar/anagram.ts');
const music = await import('../src/bar/music.ts');
const daily = await import('../src/bar/daily.ts');
const { PLAYERS } = await import('../src/arena/sprites.ts');
const { ROOMS, JUKEBOX, SALAO, walkableFn } = await import('../src/bar/room.ts');
const { applyUpdate } = await import('./mock-rules.mjs');
const history = await import('../src/arena/history.ts');
const scoreStore = await import('../src/arena/scoreStore.ts');
const DATA = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'anagramas.json'), 'utf8'));

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};
const brt = (iso) => Date.parse(`${iso}-03:00`);
const sorted = (w) => w.split('').sort().join('');

test('lista congelada: 204 dias de 5 palavras (5, 6, 7, 8 e 9–10 letras), sem repetir e sem a Palavra do Dia do dia', () => {
  assert.equal(DATA.start, 20783, 'começa em 26/11/2026, como a Palavra do Dia');
  assert.equal(DATA.days.length, 204);
  const seen = new Set();
  DATA.days.forEach((set, d) => {
    assert.equal(set.length, 5, `dia ${d}`);
    const lens = set.map(([w]) => w.length);
    assert.deepEqual(lens.slice(0, 4), [5, 6, 7, 8], `dia ${d}: ${lens}`);
    assert.ok(lens[4] === 9 || lens[4] === 10, `dia ${d}: última com ${lens[4]}`);
    for (const [w, c, t] of set) {
      assert.match(w, /^[A-Z]+$/);
      assert.ok(typeof c === 'string' && c.length > 5, `${w}: dica`);
      assert.ok(Number.isInteger(t) && DATA.themes[t], `${w}: tema`);
      assert.ok(!seen.has(w), `${w} repetida`);
      seen.add(w);
    }
    const pal = daily.wordOfDay(DATA.start + d).w;
    assert.ok(!set.some(([w]) => w === pal), `dia ${d}: ${pal} é a Palavra do Dia`);
  });
  // O gerador se recusa a refazer a lista (a ordem não muda depois de publicada).
  const out = execFileSync(process.execPath, [path.join(root, 'scripts', 'gerar-anagramas.mjs')], { encoding: 'utf8' });
  assert.match(out, /já existe \(congelada\)/);
});

test('embaralhado: nunca igual à palavra, mesmas letras, igual em todo aparelho', () => {
  let close = 0;
  DATA.days.forEach((set, d) => {
    const day = DATA.start + d;
    ana.setOfDay(DATA, day).forEach((w, i) => {
      assert.notEqual(w.scrambled, w.w, `${w.w}`);
      assert.equal(sorted(w.scrambled), sorted(w.w), `${w.w} → ${w.scrambled}`);
      assert.equal(w.scrambled, ana.scramble(w.w, day, i), 'mesma semente, mesmo resultado');
      assert.equal(w.points, ana.ANA_POINTS[i]);
      const same = w.scrambled.split('').filter((c, k) => c === w.w[k]).length;
      if (same > w.w.length / 2) close++;
    });
  });
  assert.ok(close < 20, `embaralhados com mais da metade no lugar: ${close} de 1020`);
  // Referência congelada: versão nova publicada no meio do dia mostra as mesmas peças que a antiga.
  assert.deepEqual(ana.setOfDay(DATA, 20783).map((w) => w.scrambled), ['REARZ', 'SONTAH', 'RCUOLCI', 'DMOBNILA', 'IDLMOURSA']);
  assert.deepEqual(ana.setOfDay(DATA, 20784).map((w) => w.scrambled), ['YSEAI', 'PCAAAM', 'OGRANAR', 'TXPREALI', 'OCHIKTHCC']);
  // Mesmo no pior caso (2 letras, metade das tentativas volta igual) nunca sai a própria palavra.
  for (let d = 0; d < 20_000; d++) assert.equal(ana.scramble('AB', d, d % 5), 'BA', `semente ${d}`);
  // O dia dá a volta na lista (depois de 204 dias recomeça).
  assert.deepEqual(ana.setOfDay(DATA, DATA.start + 204).map((w) => w.w), ana.setOfDay(DATA, DATA.start).map((w) => w.w));
  assert.deepEqual(ana.setOfDay(DATA, DATA.start - 1).map((w) => w.w), ana.setOfDay(DATA, DATA.start + 203).map((w) => w.w));
});

test('pontos: 40 a 120 por palavra, 20 por letra revelada, nunca negativo; peças sem as reveladas', () => {
  assert.deepEqual([...ana.ANA_POINTS], [40, 60, 80, 100, 120]);
  assert.equal(ana.wordPoints(0, 0), 40);
  assert.equal(ana.wordPoints(0, 1), 20);
  assert.equal(ana.wordPoints(0, 3), 0, 'não fica negativo');
  assert.equal(ana.wordPoints(4, 2), 80);
  const rec = [{ r: 0, ok: true, t: 1 }, { r: 1, ok: true, t: 1 }, { r: 2, ok: false, t: 1 }, undefined, { r: 0, ok: true, t: 1 }];
  assert.equal(ana.anaScore(rec), 40 + 40 + 120, 'só as acertadas somam');
  assert.equal(ana.solvedCount(rec), 3);
  const w = { i: 0, w: 'ARARA', clue: '', theme: '', scrambled: 'RAAAR', points: 40 };
  assert.deepEqual(ana.remainingTiles(w, 2).sort(), ['A', 'A', 'R'], 'tira um A e um R');
  assert.ok(ana.canReveal(undefined, w));
  assert.ok(ana.canReveal([{ r: 3, ok: false, t: 1 }], w));
  assert.ok(!ana.canReveal([{ r: 4, ok: false, t: 1 }], w), 'sempre sobra 1 letra para o jogador');
  assert.ok(!ana.canReveal([{ r: 0, ok: true, t: 1 }], w), 'acertada não revela');
  assert.ok(ana.isRight('arará', w), 'sem acento e minúscula valem');
  assert.ok(!ana.isRight('RARAA', w));
  assert.equal(ana.anaScoreKey('20783'), 'ANA-20783');
  // A trava das cruzadas lê só chaves de tabuleiro: os pontos do anagrama não viram "palavras já vistas".
  assert.equal(history.parseKey('ANA-20783'), null);
  assert.equal(history.parseKey(scoreStore.safeKey('ANA-20783')), null);
});

test('registro do dia: ontem não conta; formato estragado é ignorado; lista ou objeto', () => {
  const now = brt('2026-11-26T22:00:00');
  const raw = {
    will: [{ r: 0, ok: true, t: now - 1000 }, { r: 2, ok: false, t: now - 900 }],
    bia: { 3: { r: 1, ok: true, t: now - 10 }, 7: { r: 0, ok: true, t: now }, 1: { r: 0, ok: true, t: brt('2026-11-26T05:59:59') } },
    tati: { 0: { r: 1.5, ok: true, t: now }, 1: { r: 10, ok: true, t: now }, 2: { r: 0, ok: 'sim', t: now } },
    intruso: { 0: { r: 0, ok: true, t: now } },
  };
  const all = ana.sanitizeAna(raw, now);
  assert.deepEqual(Object.keys(all).sort(), ['bia', 'will']);
  assert.equal(ana.anaScore(all.will), 40);
  assert.equal(all.bia[1], undefined, 'de antes das 6 h');
  assert.equal(all.bia[3].r, 1);
  assert.equal(ana.anaScore(all.bia), 80);
  assert.deepEqual(ana.anaOrder(all).slice(0, 2), ['bia', 'will']);
  assert.deepEqual(ana.sanitizeAna(raw, brt('2026-11-27T06:00:00')), {}, 'às 6 h some tudo');
});

test('regras: letra revelada só sobe, acerto trava a palavra, dia novo recomeça', () => {
  const now = brt('2026-11-26T20:00:00');
  const up = (tree, u, t) => applyUpdate(tree, ['cruzadabotecos', 'bar'], u, t);
  const put = (p, i, r, ok, t, extra = {}) => ({ [`ana/${p}/${i}`]: { r, ok, t, ...extra } });
  const one = up({}, put('will', 0, 1, false, now), now);
  assert.ok(one, '1ª dica');
  const t2 = now + 1000;
  const two = up(one, put('will', 0, 2, false, t2), t2);
  assert.ok(two, '2ª dica');
  assert.equal(up(two, put('will', 0, 1, false, t2 + 1), t2 + 1), null, 'apagar dica');
  const won = up(two, put('will', 0, 2, true, t2 + 2), t2 + 2);
  assert.ok(won, 'acerto');
  assert.equal(up(won, put('will', 0, 2, false, t2 + 3), t2 + 3), null, 'desfazer acerto');
  assert.equal(up(won, put('will', 0, 3, true, t2 + 3), t2 + 3), null, 'mexer depois do acerto');
  assert.ok(up(won, put('will', 1, 0, true, t2 + 3), t2 + 3), 'outra palavra segue livre');
  assert.equal(up({}, put('will', 5, 0, false, now), now), null, 'palavra 5 não existe');
  assert.equal(up({}, put('intruso', 0, 0, false, now), now), null, 'jogador de fora');
  assert.equal(up({}, put('will', 0, 10, false, now), now), null, 'r acima de 9');
  assert.equal(up({}, put('will', 0, 1.5, false, now), now), null, 'r quebrado');
  assert.equal(up({}, put('will', 0, 0, 'sim', now), now), null, 'ok não booleano');
  assert.equal(up({}, put('will', 0, 0, false, now - 1), now), null, 'hora inventada');
  assert.equal(up({}, put('will', 0, 0, false, now, { s: 40 }), now), null, 'campo a mais');
  const tomorrow = brt('2026-11-27T06:00:01');
  assert.ok(up(won, put('will', 0, 0, false, tomorrow), tomorrow), 'dia novo recomeça do zero');
});

test('regras publicáveis espelham o mock', () => {
  const bar = JSON.parse(fs.readFileSync(path.join(root, 'database.rules.json'), 'utf8')).rules.cruzadabotecos.bar;
  const n = bar.ana.$player.$i;
  assert.match(n['.write'], /\$i\.matches\(\/\^\[0-4\]\$\/\)/);
  assert.match(n['.write'], /newData\.child\('r'\)\.val\(\) >= data\.child\('r'\)\.val\(\)/);
  assert.match(n['.write'], /data\.child\('ok'\)\.val\(\) === false/);
  assert.match(n['.write'], /\(now - \(\(now - 32400000\) % 86400000\)\)/, 'o mesmo dia das 6 h');
  assert.match(n.r['.validate'], /<= 9/);
  assert.match(n.r['.validate'], /% 1 === 0/);
  assert.equal(n.t['.validate'], 'newData.val() === now');
  assert.equal(n.$other['.validate'], false);
  assert.equal(ana.MAX_REVEAL, 9);
});

test('música: 6 estilos de 64 passos, notas tocáveis, bateria válida; toca a de quem lidera sozinho', () => {
  for (const id of music.SONG_IDS) {
    const s = music.SONGS[id];
    assert.equal(s.id, id);
    assert.ok(s.bpm >= 60 && s.bpm <= 180, `${id}: bpm`);
    for (const k of ['lead', 'chords', 'bass']) {
      if (!s[k]) continue;
      const steps = music.parseTrack(s[k].notes);
      assert.equal(steps.length, music.STEPS, `${id}.${k}: ${steps.length} passos`);
      assert.notEqual(steps[0], 'hold', `${id}.${k}: começa segurando nada`);
      for (const st of steps) if (Array.isArray(st)) for (const n of st) assert.ok(Number.isInteger(n) && n >= 28 && n <= 96, `${id}.${k}: nota ${n}`);
      assert.ok(s[k].gain > 0 && s[k].gain <= 0.2, `${id}.${k}: volume`);
    }
    for (const d of s.drums) assert.match(d, /^[kshotc.]{64}$/, `${id}: bateria`);
  }
  for (const p of PLAYERS) assert.ok(music.SONGS[p.id], `${p.name} tem música`);
  const tot = (pairs) => pairs.map(([id, total]) => ({ id, total }));
  assert.equal(music.songFor(tot([['bia', 300], ['will', 120]])), 'bia');
  assert.equal(music.songFor(tot([['bia', 300], ['will', 300]])), 'casa', 'empate no topo');
  assert.equal(music.songFor(tot([['vini', 0], ['will', 0]])), 'casa', 'ninguém pontuou');
  assert.equal(music.songFor([]), 'casa');
  assert.equal(music.noteLength(music.parseTrack('60 - - . 62 -'), 0), 3);
  assert.equal(music.noteLength(music.parseTrack('60 - - . 62 -'), 4), 2);
});

test('cômodo da jukebox: porta aberta no salão, jukebox tocável e alcançável', () => {
  assert.equal(ROOMS.jukebox, JUKEBOX);
  const door = SALAO.doors.find((d) => d.to === 'jukebox');
  assert.ok(door && door.kind === 'open', 'o salão abriu a porta da jukebox');
  assert.ok(!SALAO.doors.some((d) => d.kind === 'reforma' && /jukebox/i.test(d.label)), 'sem placa de reforma da jukebox');
  const j = JUKEBOX.jukebox;
  assert.ok(JUKEBOX.props.some((p) => p.kind === 'jukebox' && p.x === j.at.x && p.y === j.at.y));
  assert.ok(walkableFn(JUKEBOX)(j.stand.x, j.stand.y), 'dá para ficar na frente');
  assert.equal(Math.abs(j.stand.x - j.at.x) + Math.abs(j.stand.y - j.at.y), 1, 'de frente, colado');
  assert.ok(JUKEBOX.doors.some((d) => d.kind === 'open' && d.to === 'sinuca'), 'a jukebox leva à sinuca');
});

console.log(`\n${passed} testes da jukebox passaram`);
