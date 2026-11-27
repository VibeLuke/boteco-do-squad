// Testes da Fase 2b do bar: bagunça que fica até as 6 h (móvel caído, poça de cerveja, molho na parede).
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

const mess = await import('../src/bar/mess.ts');
const { positionAt, WALK_SPEED } = await import('../src/bar/motion.ts');
const { ROOMS, walkableFn } = await import('../src/bar/room.ts');
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
const NOW = brt('2026-11-26T22:00:00');
const ONTEM = brt('2026-11-26T05:59:59');
const HOJE_CEDO = brt('2026-11-26T06:00:00');

test('móveis: só o caído de hoje conta; levantado e de antes das 6 h somem', () => {
  const raw = {
    salao: {
      '2-3': { d: true, by: 'will', t: NOW - 1000 },
      '4-4': { d: false, by: 'bia', t: NOW - 500 },
      '5-1': { d: true, by: 'tati', t: ONTEM },
      '6-6': { d: true, by: 'tati', t: HOJE_CEDO },
      'x-1': { d: true, by: 'will', t: NOW },
      '7-7': { d: true, by: 'intruso', t: NOW },
      '8-8': { d: 'sim', by: 'will', t: NOW },
    },
    'Sala!': { '1-1': { d: true, by: 'will', t: NOW } },
  };
  const down = mess.sanitizeProps(raw, NOW);
  assert.deepEqual(Object.keys(down), ['salao']);
  assert.deepEqual(Object.keys(down.salao).sort(), ['2-3', '6-6']);
  assert.ok(mess.isDown(down, 'salao', 2, 3));
  assert.ok(!mess.isDown(down, 'salao', 4, 4), 'levantado');
  assert.ok(!mess.isDown(down, 'salao', 5, 1), 'de ontem: a faxina das 6 h já passou');
  assert.ok(!mess.isDown(down, 'lousa', 2, 3), 'outro cômodo');
  // Às 6 h do dia seguinte tudo some sem ninguém apagar nada.
  assert.deepEqual(mess.sanitizeProps(raw, brt('2026-11-27T06:00:00')), {});
  assert.equal(Object.keys(mess.sanitizeProps(raw, brt('2026-11-27T05:59:59')).salao).length, 2, '5h59 ainda é hoje');
});

test('poças: só as molhadas de hoje; fila de 6 por cômodo reaproveita a vaga vazia e depois a mais antiga', () => {
  const raw = {
    salao: {
      0: { x: 3, y: 3, by: 'will', seco: false, t: NOW - 9000 },
      1: { x: 4, y: 3, by: 'will', seco: true, t: NOW - 8000 },
      2: { x: 5, y: 3, by: 'bia', seco: false, t: ONTEM },
      3: { x: 6, y: 3, by: 'bia', seco: false, t: NOW - 7000 },
      9: { x: 1, y: 1, by: 'bia', seco: false, t: NOW },
      4: { x: 70, y: 3, by: 'bia', seco: false, t: NOW },
    },
  };
  const p = mess.sanitizePocas(raw, NOW).salao;
  assert.deepEqual(p.map((q) => q.slot), [0, 3], 'seca, de ontem, vaga 9 e x 70 ficam de fora; ordem por tempo');
  assert.ok(mess.pocaAt(p, 6, 3));
  assert.ok(!mess.pocaAt(p, 4, 3), 'seca');
  assert.equal(mess.nextPocaSlot(raw, 'salao', NOW), 1, 'a seca vira vaga');
  assert.equal(mess.nextPocaSlot({}, 'lousa', NOW), 0);
  const cheia = { salao: Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [i, { x: i, y: 0, by: 'will', seco: false, t: NOW - 10_000 + (i === 4 ? -5000 : i) }])) };
  assert.equal(mess.nextPocaSlot(cheia, 'salao', NOW), 4, 'cheia: a mais antiga sai');
});

test('molho: 5 por pessoa por cômodo, de hoje; a 6ª taca por cima da mais antiga', () => {
  const sp = (s, u, v, t) => ({ s, u, v, t });
  const raw = {
    salao: {
      will: { 0: sp('L', 10, 20, NOW - 50), 1: sp('R', 30, 40, NOW - 40), 2: sp('X', 1, 1, NOW), 3: sp('R', 500, 1, NOW), 4: sp('L', 3, 3, ONTEM) },
      bia: { 0: sp('R', 12, 30, NOW - 10) },
      intruso: { 0: sp('R', 12, 30, NOW) },
    },
  };
  const m = mess.sanitizeMolho(raw, NOW).salao;
  assert.deepEqual(m.map((x) => `${x.p}${x.slot}`), ['will0', 'will1', 'bia0']);
  assert.equal(mess.nextMolhoSlot(raw, 'salao', 'will', NOW), 2, 'vaga inválida conta como vazia');
  assert.equal(mess.nextMolhoSlot(raw, 'salao', 'bia', NOW), 1);
  const cheio = { salao: { will: Object.fromEntries([0, 1, 2, 3, 4].map((i) => [i, sp('L', i, 10, NOW - (i === 2 ? 900 : 100 - i))])) } };
  assert.equal(mess.nextMolhoSlot(cheio, 'salao', 'will', NOW), 2);
});

test('escorregão: a janela cai exatamente quando quem anda pisa na poça (mesma conta do positionAt)', () => {
  const rand = rng(7);
  let checked = 0;
  for (const room of Object.values(ROOMS)) {
    const walk = walkableFn(room);
    const tiles = [];
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if (walk(x, y)) tiles.push({ x, y });
    for (let i = 0; i < 400; i++) {
      const a = tiles[Math.floor(rand() * tiles.length)];
      const b = tiles[Math.floor(rand() * tiles.length)];
      const p = findPath(walk, a, b);
      if (p.length < 2) continue;
      const wet = p[Math.floor(rand() * p.length)];
      const win = mess.slipWindows(a, p, [wet]);
      assert.equal(win.length, 1, 'uma poça no caminho, uma janela');
      const pisou = win[0][0] + mess.SLIP_BEFORE_MS;
      const at = positionAt(a, p, pisou);
      assert.ok(Math.abs(at.x - wet.x) < 1e-6 && Math.abs(at.y - wet.y) < 1e-6, `${room.id}: pisa na poça em ${pisou} ms`);
      assert.ok(mess.slippingAt(win, pisou) !== null);
      assert.equal(mess.slippingAt(win, win[0][1]), null, 'acaba no fim da janela');
      assert.equal(mess.slippingAt(win, win[0][0] - 1), null, 'não começa antes');
      checked++;
    }
  }
  assert.ok(checked > 300, `caminhos checados: ${checked}`);
  assert.deepEqual(mess.slipWindows({ x: 0, y: 0 }, [{ x: 1, y: 0 }], []), [], 'sem poça, sem janela');
  assert.deepEqual(mess.slipWindows({ x: 0, y: 0 }, [{ x: 1, y: 0 }], [{ x: 5, y: 5 }]), [], 'poça fora do caminho');
  const diag = mess.slipWindows({ x: 0, y: 0 }, [{ x: 1, y: 1 }], [{ x: 1, y: 1 }]);
  assert.ok(Math.abs(diag[0][0] + mess.SLIP_BEFORE_MS - (Math.SQRT2 / WALK_SPEED) * 1000) < 1e-9, 'diagonal vale √2');
});

test('bagunça não muda a grade de passagem nem o caminho (dois aparelhos chegam igual)', () => {
  // O caminho é calculado só com a sala; nada da bagunça entra em walkableFn.
  const src = fs.readFileSync(path.join(here, '..', 'src', 'bar', 'room.ts'), 'utf8');
  assert.ok(!/mess|poca|molho/.test(src), 'room.ts não lê bagunça');
  for (const k of mess.KNOCKABLE) assert.ok(['stool', 'table', 'plant', 'barrel'].includes(k));
  // Todo móvel derrubável de todos os cômodos tem desenho caído.
  const render = fs.readFileSync(path.join(here, '..', 'src', 'bar', 'render.ts'), 'utf8');
  const fallen = render.slice(render.indexOf('function paintFallen'), render.indexOf('function paintFallen') + 4000);
  for (const k of mess.KNOCKABLE) assert.ok(fallen.includes(`'${k}'`), `desenho caído: ${k}`);
});

test('regras: móvel, poça e molho só com o carimbo de ritmo de quem faz, no formato certo', () => {
  const up = (tree, u, t) => applyUpdate(tree, ['cruzadabotecos', 'bar'], u, t);
  const rate = (p, t) => ({ [`rate/${p}`]: { at: t } });
  const knock = (p, k, t, extra = {}) => ({ ...rate(p, t), [`mess/salao/${k}`]: { d: true, by: p, t, ...extra } });
  assert.ok(up({}, knock('will', '3-2', NOW), NOW), 'derrubar');
  assert.equal(up({}, { 'mess/salao/3-2': { d: true, by: 'will', t: NOW } }, NOW), null, 'sem carimbo');
  assert.equal(up({}, { ...rate('bia', NOW), 'mess/salao/3-2': { d: true, by: 'will', t: NOW } }, NOW), null, 'carimbo de outro');
  assert.equal(up({}, knock('will', '3-2', NOW, { t: NOW - 1 }), NOW), null, 'hora inventada');
  assert.equal(up({}, knock('will', '3_2', NOW), NOW), null, 'chave errada');
  assert.equal(up({}, knock('will', '3-2', NOW, { lixo: 1 }), NOW), null, 'campo a mais');
  assert.equal(up({}, knock('will', '3-2', NOW, { d: 'sim' }), NOW), null, 'd não booleano');
  assert.equal(up({}, { ...rate('will', NOW), 'mess/Salao/3-2': { d: true, by: 'will', t: NOW } }, NOW), null, 'cômodo inválido');
  const t1 = up({}, knock('will', '3-2', NOW), NOW);
  assert.equal(up(t1, knock('will', '3-3', NOW + 1500), NOW + 1500), null, 'ritmo de 2 s');
  assert.ok(up(t1, knock('will', '3-3', NOW + 2000), NOW + 2000), 'depois de 2 s');

  const poca = (p, slot, t, extra = {}) => ({ ...rate(p, t), [`poca/salao/${slot}`]: { x: 3, y: 4, by: p, seco: false, t, ...extra } });
  assert.ok(up({}, poca('bia', 0, NOW), NOW), 'poça');
  assert.ok(up({}, poca('bia', 5, NOW, { seco: true }), NOW), 'secar');
  assert.equal(up({}, poca('bia', 6, NOW), NOW), null, 'vaga 6 não existe');
  assert.equal(up({}, poca('bia', 0, NOW, { x: 64 }), NOW), null, 'fora do mapa');
  assert.equal(up({}, poca('bia', 0, NOW, { by: 'will' }), NOW), null, 'em nome de outro');
  assert.equal(up({}, { 'poca/salao/0': { x: 3, y: 4, by: 'bia', seco: false, t: NOW } }, NOW), null, 'poça sem carimbo');

  const molho = (p, dono, slot, t, extra = {}) => ({ ...rate(p, t), [`molho/salao/${dono}/${slot}`]: { s: 'R', u: 30, v: 20, t, ...extra } });
  assert.ok(up({}, molho('tati', 'tati', 4, NOW), NOW), 'molho');
  assert.equal(up({}, molho('tati', 'will', 0, NOW), NOW), null, 'na vaga de outro');
  assert.equal(up({}, molho('tati', 'tati', 5, NOW), NOW), null, 'vaga 5 não existe');
  assert.equal(up({}, molho('tati', 'tati', 0, NOW, { s: 'C' }), NOW), null, 'parede que não existe');
  assert.equal(up({}, molho('tati', 'tati', 0, NOW, { v: 81 }), NOW), null, 'acima do teto');
  assert.equal(up({}, molho('tati', 'tati', 0, NOW, { u: -1 }), NOW), null, 'antes do canto');
  assert.equal(up({}, molho('tati', 'tati', 0, NOW, { p: 'tati' }), NOW), null, 'campo a mais');
});

test('regras publicáveis espelham o mock (mesmas vagas, faixas e campos)', () => {
  const bar = JSON.parse(fs.readFileSync(path.join(here, '..', 'database.rules.json'), 'utf8')).rules.cruzadabotecos.bar;
  const m = bar.mess.$room.$prop;
  assert.match(m['.write'], /\^\[0-9\]\{1,2\}-\[0-9\]\{1,2\}\$/);
  assert.match(m['.validate'], /'d', 'by', 't'/);
  const p = bar.poca.$room.$slot;
  assert.match(p['.write'], /\^\[0-5\]\$/);
  assert.match(p.x['.validate'], /<= 63/);
  const o = bar.molho.$room.$player.$slot;
  assert.match(o['.write'], /\^\[0-4\]\$/);
  assert.match(o['.write'], /child\('rate'\)\.child\(\$player\)/, 'carimbo do dono da vaga');
  assert.match(o.u['.validate'], /<= 400/);
  assert.match(o.v['.validate'], /<= 80/);
  for (const node of [m, p, o]) assert.equal(node.$other['.validate'], false, 'campo a mais é recusado');
  assert.equal(mess.POCA_SLOTS, 6);
  assert.equal(mess.MOLHO_SLOTS, 5);
});

console.log(`\n${passed} testes da bagunça passaram`);
