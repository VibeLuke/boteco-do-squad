// Testes da Fase 1b do bar (modo sangue): vida derivada dos golpes, revive, armas, partículas e regras.
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

const blood = await import('../src/bar/blood.ts');
const { rng } = await import('./aleatorio.mjs');
const { applyUpdate, CD_MS } = await import('./mock-rules.mjs');
const { PLAYERS, buildBarGrid, buildDeadGrid } = await import('../src/arena/sprites.ts');
const { lifeAt, WEAPONS, DEAD_MS, INV_MS, HEAL_MS, LOCK_MS, STUN_MS, HEARTS, GLOBAL_CD_MS, HIT_SLOTS, isDead } = blood;
const here = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};
const H = (p, w, to, t, x = 5, y = 5, r = 'salao') => ({ p, w, to, r, x, y, t });
const T0 = 1_800_000_000_000;

test('vida: soco tira 1, cura em 30 s, garrafa + soco mata', () => {
  let s = lifeAt([H('will', 'soco', 'bia', T0)], T0 + 1);
  assert.equal(s.by.bia.hearts, 2);
  assert.equal(lifeAt([H('will', 'soco', 'bia', T0)], T0 + HEAL_MS - 1).by.bia.hearts, 2);
  assert.equal(lifeAt([H('will', 'soco', 'bia', T0)], T0 + HEAL_MS).by.bia.hearts, 3, 'curou');
  const twice = [H('will', 'soco', 'bia', T0), H('tati', 'soco', 'bia', T0 + HEAL_MS)];
  assert.equal(lifeAt(twice, T0 + HEAL_MS + 1).by.bia.hearts, 2, 'curou antes do 2º golpe');
  const close = [H('will', 'soco', 'bia', T0), H('tati', 'soco', 'bia', T0 + HEAL_MS - 1)];
  assert.equal(lifeAt(close, T0 + HEAL_MS).by.bia.hearts, 1, 'ainda não tinha curado');
  const kill = [H('will', 'garrafa', 'bia', T0), H('tati', 'soco', 'bia', T0 + 5000)];
  s = lifeAt(kill, T0 + 5001);
  assert.equal(s.by.bia.hearts, 0);
  assert.ok(isDead(s.by.bia, T0 + 5001));
  assert.equal(s.by.bia.killer.p, 'tati', 'quem deu o último golpe leva o abate');
  assert.deepEqual(s.results.map((r) => r.lethal), [false, true]);
});

test('morte: volta exatamente 8 s depois, com 3 corações e 5 s invencível', () => {
  const hits = [H('will', 'banqueta', 'bia', T0)];
  assert.ok(isDead(lifeAt(hits, T0 + DEAD_MS - 1).by.bia, T0 + DEAD_MS - 1), 'ainda morto a 7,999 s');
  const back = lifeAt(hits, T0 + DEAD_MS).by.bia;
  assert.ok(!isDead(back, T0 + DEAD_MS), 'vivo aos 8 s');
  assert.equal(back.hearts, HEARTS);
  const during = [...hits, H('tati', 'soco', 'bia', T0 + DEAD_MS + INV_MS - 1)];
  const r1 = lifeAt(during, T0 + DEAD_MS + INV_MS).results.at(-1);
  assert.equal(r1.counted, false);
  assert.equal(r1.why, 'invencivel');
  const after = [...hits, H('tati', 'soco', 'bia', T0 + DEAD_MS + INV_MS)];
  assert.equal(lifeAt(after, T0 + DEAD_MS + INV_MS + 1).by.bia.hearts, 2, 'passou a invencibilidade');
  const onCorpse = [...hits, H('tati', 'soco', 'bia', T0 + 3000)];
  assert.equal(lifeAt(onCorpse, T0 + 3001).results.at(-1).why, 'morto', 'não se bate em defunto');
});

test('um golpe por vez: empate na mesma hora vale o primeiro na ordem; 2º em menos de 1 s não conta', () => {
  const tie = [H('will', 'soco', 'vini', T0), H('bia', 'soco', 'vini', T0)];
  const s = lifeAt(blood.sortHits(tie), T0 + 1);
  assert.deepEqual(s.results.map((r) => [r.hit.p, r.counted, r.why ?? '']), [['bia', true, ''], ['will', false, 'ocupado']]);
  // A ordem em que os golpes chegam ao aparelho não muda nada.
  assert.deepEqual(lifeAt(blood.sortHits(tie.slice().reverse()), T0 + 1).by.vini, s.by.vini);
  assert.equal(lifeAt([H('will', 'soco', 'vini', T0), H('bia', 'soco', 'vini', T0 + LOCK_MS - 1)], T0 + LOCK_MS).by.vini.hearts, 2);
  assert.equal(lifeAt([H('will', 'soco', 'vini', T0), H('bia', 'soco', 'vini', T0 + LOCK_MS)], T0 + LOCK_MS).by.vini.hearts, 1);
});

test('defunto não bate; frigideira deixa tonto 2 s', () => {
  const hits = [H('tati', 'banqueta', 'will', T0), H('will', 'soco', 'dani', T0 + 2000)];
  const r = lifeAt(hits, T0 + 2001).results.at(-1);
  assert.equal(r.why, 'atacante-morto');
  const pan = lifeAt([H('bia', 'frigideira', 'dani', T0)], T0 + 1).by.dani;
  assert.equal(pan.stunUntil, T0 + STUN_MS);
  assert.equal(pan.hearts, 1);
});

/** Golpes legais aleatórios (respeitam a espera da arma e a geral, como a regra do servidor). */
function simulate(seed, minutes, eager) {
  const rand = rng(seed);
  const ids = PLAYERS.map((p) => p.id);
  const last = Object.fromEntries(ids.map((id) => [id, {}]));
  const hits = [];
  for (let t = T0; t < T0 + minutes * 60_000; t += 500) {
    for (const p of ids) {
      if (rand() > eager) continue;
      const cd = last[p];
      // Bate com a primeira arma pronta (sorteia por onde começa): briga no limite da espera geral.
      const start = Math.floor(rand() * blood.WEAPON_IDS.length);
      const w = [...blood.WEAPON_IDS.slice(start), ...blood.WEAPON_IDS.slice(0, start)].find((x) => t - (cd[x] ?? -1e15) >= WEAPONS[x].cd);
      if (!w || t - (cd.geral ?? -1e15) < GLOBAL_CD_MS) continue;
      const to = ids.filter((x) => x !== p)[Math.floor(rand() * 4)];
      cd.geral = t;
      cd[w] = t;
      hits.push(H(p, w, to, t));
    }
  }
  return hits;
}
/** O que fica no banco num instante: as 10 posições mais novas de cada atacante. */
/** Garantia mínima: as 10 posições mais novas (a fila real tem 30). */
const bufferAt = (hits, now) => {
  const out = [];
  for (const p of PLAYERS) out.push(...hits.filter((h) => h.p === p.id && h.t <= now).slice(-10));
  return blood.sortHits(out);
};

test('fila circular sobrescrita não muda a vida de ninguém (5 lutadores, 3 × 15 min de briga)', () => {
  let checks = 0;
  for (const [seed, eager] of [[7, 0.08], [99, 0.9], [2026, 0.9]]) {
    const hits = simulate(seed, 15, eager);
    assert.ok(hits.length > 150, `briga de verdade (${hits.length} golpes)`);
    for (let now = T0; now < T0 + 15 * 60_000; now += 1_700) {
      const full = lifeAt(blood.sortHits(hits.filter((h) => h.t <= now)), now).by;
      const buf = lifeAt(bufferAt(hits, now), now).by;
      assert.deepEqual(buf, full, `instante ${now - T0}`);
      checks++;
    }
  }
  assert.ok(checks > 1500);
});

test('espera: cada arma e a geral de 10 s, pelo horário gravado no banco', () => {
  assert.equal(blood.weaponWait({}, 'garrafa', T0), 0);
  assert.equal(blood.weaponWait({ geral: T0 - 4000 }, 'soco', T0), 6000);
  assert.equal(blood.weaponWait({ geral: T0 - 30_000, garrafa: T0 - 30_000 }, 'garrafa', T0), 30_000);
  const base = { dist: 1, targetOnline: true, targetSeated: false, me: lifeAt([], T0).by.will, them: lifeAt([], T0).by.bia, waitMs: 0, now: T0 };
  assert.deepEqual(blood.canHit('soco', base), { ok: true });
  assert.equal(blood.canHit('soco', { ...base, dist: 2 }).why, 'longe');
  assert.equal(blood.canHit('taco', { ...base, dist: 2 }).ok, true, 'taco alcança 2 ladrilhos');
  assert.equal(blood.canHit('dardo', { ...base, dist: 5 }).ok, true);
  assert.equal(blood.canHit('soco', { ...base, targetSeated: true }).why, 'sentado');
  assert.equal(blood.canHit('soco', { ...base, targetOnline: false }).why, 'ressaca');
  assert.equal(blood.canHit('soco', { ...base, waitMs: 3 }).why, 'espera');
});

test('ficha corrida: dia vira às 6 h de Brasília; abates e mortes somados', () => {
  const brt = (iso) => Date.parse(`${iso}-03:00`);
  assert.notEqual(blood.dayKey(brt('2026-11-26T05:59:59')), blood.dayKey(brt('2026-11-26T06:00:00')));
  assert.equal(blood.dayKey(brt('2026-11-26T06:00:00')), blood.dayKey(brt('2026-11-27T05:59:59')));
  assert.match(blood.dayKey(brt('2026-11-26T12:00:00')), /^[0-9]{5}$/);
  const now = brt('2026-11-26T20:00:00');
  const today = brt('2026-11-26T07:00:00');
  const yesterday = brt('2026-11-26T05:00:00');
  const tally = blood.tallyDay(
    { will: { bia: { n: 2, t: today }, tati: { n: 1, t: today }, vini: { n: 7, t: yesterday } }, bia: { will: { n: 1, t: today }, bia: { n: 9, t: today } }, zeca: { will: { n: 5, t: today } } },
    now,
  );
  assert.deepEqual([tally.will.k, tally.will.d, tally.bia.k, tally.bia.d, tally.tati.d, tally.vini.d], [3, 1, 1, 2, 1, 0], 'ontem não conta');
  const res = lifeAt([H('will', 'banqueta', 'bia', T0)], T0 + 1).results;
  assert.equal(blood.pendingKills(res, 'will', {}).length, 1);
  assert.equal(blood.pendingKills(res, 'will', { bia: { t: T0 + 300 } }).length, 0, 'já anotado');
});

test('defunto: olhos em X e língua para fora, diferente da ressaca, para os 5', () => {
  for (const p of PLAYERS) {
    const dead = buildDeadGrid(p.id);
    const flat = buildBarGrid(p.id, 'ko-flat');
    assert.notDeepEqual(dead, flat, p.id);
    assert.ok(dead.flat().includes('#e43b44'), `${p.id}: língua`);
  }
});

test('regras: golpe só com o carimbo geral e o da própria arma; esperas pelo servidor', () => {
  const base = ['cruzadabotecos', 'bar'];
  const now = T0;
  const online = (t = now - 1000, extra = {}) => ({
    cruzadabotecos: { bar: { presence: { bia: { r: 'salao', x: 3, y: 3, tx: 3, ty: 3, at: t, on: true, ...extra } } } },
  });
  const sv = { at: now };
  const hit = (w = 'soco', to = 'bia', r = 'salao') => ({ w, to, r, x: 3, y: 3, t: now });
  const up = (tree, u, t = now) => applyUpdate(tree, base, u, t);
  const ok = up(online(), { 'cd/will/geral': sv, 'cd/will/soco': sv, 'hit/will/0': hit() });
  assert.ok(ok, 'golpe válido');
  assert.equal(up(online(), { 'hit/will/0': hit() }), null, 'sem carimbo nenhum');
  assert.equal(up(online(), { 'cd/will/geral': sv, 'hit/will/0': hit() }), null, 'sem o carimbo da arma');
  assert.equal(up(online(), { 'cd/will/geral': sv, 'cd/will/soco': sv, 'hit/will/0': hit('garrafa') }), null, 'carimbo de outra arma');
  assert.equal(up(online(), { 'cd/will/soco': sv, 'hit/will/0': hit() }), null, 'sem o geral');
  assert.equal(up(online(), { 'cd/bia/geral': sv, 'cd/bia/soco': sv, 'hit/will/0': hit() }), null, 'carimbo de outro');
  assert.equal(up(online(now - 91_000), { 'cd/will/geral': sv, 'cd/will/soco': sv, 'hit/will/0': hit() }), null, 'alvo em ressaca');
  assert.equal(up(online(now - 1000, { r: 'mesa' }), { 'cd/will/geral': sv, 'cd/will/soco': sv, 'hit/will/0': hit() }), null, 'alvo jogando na mesa');
  assert.equal(up(online(now - 1000, { on: false }), { 'cd/will/geral': sv, 'cd/will/soco': sv, 'hit/will/0': hit() }), null, 'alvo saiu');
  assert.equal(up(online(), { 'cd/will/geral': sv, 'cd/will/soco': sv, 'hit/will/0': hit('soco', 'will') }), null, 'em si mesmo');
  assert.equal(up(online(), { 'cd/will/geral': sv, 'cd/will/bomba': sv, 'hit/will/0': hit('bomba') }), null, 'arma inventada');
  assert.ok(up(online(), { 'cd/will/geral': sv, 'cd/will/soco': sv, 'hit/will/29': hit() }), 'posição 29 existe');
  assert.equal(up(online(), { 'cd/will/geral': sv, 'cd/will/soco': sv, 'hit/will/30': hit() }), null, 'posição 30 não existe');
  assert.equal(up(online(), { 'cd/will/geral': sv, 'cd/will/soco': sv, 'hit/will/0': hit('soco', 'bia', 'lousa') }), null, 'alvo em outro cômodo');
  assert.equal(up(online(), { 'cd/will/geral': sv, 'cd/will/soco': sv, 'hit/will/0': { w: 'soco', to: 'bia', x: 3, y: 3, t: now } }), null, 'sem o cômodo');
  // Esperas: geral de 10 s e a da arma.
  const t9 = now + 9_999;
  assert.equal(up(ok, { 'cd/will/geral': { at: t9 }, 'cd/will/garrafa': { at: t9 }, 'hit/will/1': { ...hit('garrafa'), t: t9 } }, t9), null, 'geral < 10 s');
  const t10 = now + 10_000;
  assert.ok(up(ok, { 'cd/will/geral': { at: t10 }, 'cd/will/garrafa': { at: t10 }, 'hit/will/1': { ...hit('garrafa'), t: t10 } }, t10), 'outra arma aos 10 s');
  const t19 = now + 19_999;
  assert.equal(up(ok, { 'cd/will/geral': { at: t19 }, 'cd/will/soco': { at: t19 }, 'hit/will/1': { ...hit(), t: t19 } }, t19), null, 'soco < 20 s');
  const t20 = now + 20_000;
  assert.ok(up(ok, { 'cd/will/geral': { at: t20 }, 'cd/will/soco': { at: t20 }, 'hit/will/1': { ...hit(), t: t20 } }, t20), 'soco aos 20 s');
});

test('regras: ficha corrida sobe de 1 em 1, uma vez a cada 13 s, só logo depois de um golpe; recomeça no dia novo', () => {
  const now = Date.parse('2026-11-26T20:00:00-03:00');
  const hitTree = { cruzadabotecos: { bar: { cd: { will: { geral: { at: now - 2000 } } } } } };
  const up = (tree, u, t = now) => applyUpdate(tree, ['cruzadabotecos', 'bar'], u, t);
  const first = up(hitTree, { ['kills/will/bia']: { n: 1, t: now } });
  assert.ok(first);
  assert.equal(up(hitTree, { ['kills/will/bia']: { n: 2, t: now } }), null, 'começa em 1');
  assert.equal(up(hitTree, { ['kills/will/will']: { n: 1, t: now } }), null, 'em si mesmo');
  assert.equal(up({}, { ['kills/will/bia']: { n: 1, t: now } }), null, 'sem golpe recente');
  const t12 = now + 12_999;
  const fresh = (t) => ({ ...first, cruzadabotecos: { bar: { ...first.cruzadabotecos.bar, cd: { will: { geral: { at: t - 1000 } } } } } });
  assert.equal(up(fresh(t12), { ['kills/will/bia']: { n: 2, t: t12 } }, t12), null, '< 13 s');
  const t13 = now + 13_000;
  assert.ok(up(fresh(t13), { ['kills/will/bia']: { n: 2, t: t13 } }, t13), '13 s depois');
  assert.equal(up(fresh(t13), { ['kills/will/bia']: { n: 5, t: t13 } }, t13), null, 'pulo');
  // No dia seguinte (depois das 6 h) a contagem recomeça em 1.
  const next = Date.parse('2026-11-27T06:00:05-03:00');
  assert.equal(up(fresh(next), { ['kills/will/bia']: { n: 2, t: next } }, next), null, 'dia novo não continua a de ontem');
  assert.ok(up(fresh(next), { ['kills/will/bia']: { n: 1, t: next } }, next), 'dia novo começa em 1');
});

test('regras: as esperas são as mesmas no jogo, no Firebase falso e em database.rules.json', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(here, '..', 'database.rules.json'), 'utf8'));
  const cd = rules.rules.cruzadabotecos.bar.cd.$player;
  const want = { geral: GLOBAL_CD_MS, ...Object.fromEntries(blood.WEAPON_IDS.map((w) => [w, WEAPONS[w].cd])) };
  assert.deepEqual(CD_MS, want, 'Firebase falso');
  for (const [k, ms] of Object.entries(want)) assert.ok(cd[k]['.write'].includes(`>= ${ms})`), `${k}: ${ms}`);
  assert.deepEqual(Object.keys(cd).sort(), Object.keys(want).sort(), 'nenhuma arma a mais ou a menos');
  const w = rules.rules.cruzadabotecos.bar.hit.$player.$slot.w['.validate'];
  for (const k of blood.WEAPON_IDS) assert.ok(w.includes(k), k);
});

test('regras: cada newData.parent() sobe até o nó bar (erro aqui só apareceria ao publicar)', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(here, '..', 'database.rules.json'), 'utf8'));
  let checked = 0;
  const walk = (node, depth) => {
    for (const [k, v] of Object.entries(node)) {
      if (k === '.write' && typeof v === 'string') {
        for (const m of v.matchAll(/newData((?:\.parent\(\))+)\.child\('(rate|cd|dia)'\)/g)) {
          assert.equal(m[1].split('.parent()').length - 1, depth, v.slice(0, 80));
          checked++;
        }
      } else if (v && typeof v === 'object') walk(v, depth + 1);
    }
  };
  walk(rules.rules.cruzadabotecos.bar, 0);
  assert.equal(checked, 10, 'chat, fx, marks, os 2 carimbos do golpe, os 2 do sino e os 3 da bagunça');
});

console.log(`\n${passed} testes do modo sangue passaram`);
