// Testes da Fase 0 do bar: geometria, caminho, movimento, profundidade, desenho, presença, regras e poses.
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

const { tileToScreen, tileCenter, screenToTile, byDepth, facing } = await import('../src/bar/iso.ts');
const { findPath, nearestWalkable, pathLength } = await import('../src/bar/path.ts');
const { positionAt, WALK_SPEED } = await import('../src/bar/motion.ts');
const { SALAO, walkableFn, blockedSet } = await import('../src/bar/room.ts');
const { Raster, hex } = await import('../src/bar/raster.ts');
const { sanitizePresence, isOnline, lastSeen, OFFLINE_AFTER_MS } = await import('../src/bar/presence.ts');
const { allowed, applyUpdate } = await import('./mock-rules.mjs');
const social = await import('../src/bar/social.ts');
const { PLAYERS, BAR_POSES, buildBarGrid, rotateGrid } = await import('../src/arena/sprites.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

test('iso: toque no centro de cada ladrilho volta para o mesmo ladrilho', () => {
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 12; x++) {
      const c = tileCenter(x, y);
      assert.deepEqual(screenToTile(c.x, c.y), { x, y });
      // Perto das 4 pontas do losango (2 px para dentro) continua o mesmo ladrilho.
      for (const [dx, dy] of [[0, -6], [14, 0], [0, 6], [-14, 0]]) assert.deepEqual(screenToTile(c.x + dx, c.y + dy), { x, y });
    }
  assert.deepEqual(tileToScreen(1, 0), { x: 16, y: 8 });
  assert.deepEqual(tileToScreen(0, 1), { x: -16, y: 8 });
});

test('iso: de costas quando se afasta da câmera, espelhado quando vai para a esquerda', () => {
  assert.deepEqual(facing(1, 0), { back: false, flip: false }); // desce para a direita
  assert.deepEqual(facing(0, 1), { back: false, flip: true }); // desce para a esquerda
  assert.deepEqual(facing(-1, 0), { back: true, flip: true }); // sobe para a esquerda
  assert.deepEqual(facing(0, -1), { back: true, flip: false }); // sobe para a direita
});

const walk = walkableFn(SALAO);

test('salão: porta e cantos de ressaca são pisáveis; móveis bloqueiam', () => {
  assert.ok(walk(SALAO.door.x, SALAO.door.y));
  for (const p of PLAYERS) assert.ok(walk(SALAO.hangover[p.id].x, SALAO.hangover[p.id].y), p.id);
  for (const pr of SALAO.props) assert.ok(!walk(pr.x, pr.y), `${pr.kind} em ${pr.x},${pr.y}`);
  assert.equal(blockedSet(SALAO).size, SALAO.props.length, 'dois móveis no mesmo ladrilho');
  assert.ok(!walk(-1, 0) && !walk(SALAO.cols, 0));
});

test('caminho: contorna o balcão, nunca pisa em móvel nem corta quina', () => {
  const from = { x: 2, y: 0 };
  const to = { x: 9, y: 0 };
  const p = findPath(walk, from, to);
  assert.ok(p.length > 0);
  assert.deepEqual(p.at(-1), to);
  let prev = from;
  for (const t of p) {
    assert.ok(walk(t.x, t.y), `pisou em ${t.x},${t.y}`);
    const dx = t.x - prev.x;
    const dy = t.y - prev.y;
    assert.ok(Math.abs(dx) <= 1 && Math.abs(dy) <= 1, 'pulo');
    if (dx && dy) assert.ok(walk(prev.x + dx, prev.y) && walk(prev.x, prev.y + dy), `cortou quina em ${t.x},${t.y}`);
    prev = t;
  }
  // O balcão (y=1, x 3..8) e a prateleira (y=0) obrigam a descer até y=2? Banquetas em y=2 também: vai a y>=2.
  assert.ok(p.some((t) => t.y >= 2));
});

test('caminho: igual em toda chamada (é o que deixa dois aparelhos sincronizados)', () => {
  const a = JSON.stringify(findPath(walk, { x: 0, y: 7 }, { x: 10, y: 1 }));
  for (let i = 0; i < 5; i++) assert.equal(JSON.stringify(findPath(walk, { x: 0, y: 7 }, { x: 10, y: 1 })), a);
});

test('caminho: sem saída devolve vazio; tocar num móvel leva ao ladrilho livre mais perto', () => {
  const box = (x, y) => (x === 0 && y === 0) || (x === 2 && y === 2);
  assert.deepEqual(findPath(box, { x: 0, y: 0 }, { x: 2, y: 2 }), []);
  assert.deepEqual(findPath(walk, { x: 1, y: 1 }, { x: 1, y: 1 }), []);
  const near = nearestWalkable(walk, { x: 6, y: 6 }, SALAO.cols, SALAO.rows); // mesa
  assert.ok(near && walk(near.x, near.y));
  assert.ok(Math.abs(near.x - 6) <= 1 && Math.abs(near.y - 6) <= 1);
});

test('movimento: chega na hora certa, anda o caminho e para de frente para onde ia', () => {
  const from = { x: 0, y: 7 };
  const p = findPath(walk, from, { x: 4, y: 7 });
  const len = pathLength(from, p);
  const ms = (len / WALK_SPEED) * 1000;
  const mid = positionAt(from, p, ms / 2);
  assert.ok(mid.moving && mid.x > 1.5 && mid.x < 2.5, `meio em ${mid.x}`);
  const end = positionAt(from, p, ms + 1);
  assert.deepEqual([end.x, end.y, end.moving], [4, 7, false]);
  assert.equal(end.back, false);
  assert.equal(positionAt(from, p, -500).x, 0, 'tempo negativo fica na partida');
  // Quadros da caminhada alternam (há passo a e passo b no trajeto).
  const frames = new Set();
  for (let t = 0; t < ms; t += 20) frames.add(positionAt(from, p, t).frame);
  assert.deepEqual([...frames].sort(), [0, 1, 2, 3]);
});

test('profundidade: quem está mais à frente é desenhado depois; empate respeita a ordem', () => {
  const list = [
    { depth: 5, tie: 1, n: 'boneco' },
    { depth: 5, tie: 0, n: 'mesa' },
    { depth: 2, tie: 0, n: 'balcão' },
    { depth: 9, tie: 0, n: 'planta' },
  ];
  assert.deepEqual(byDepth(list).map((i) => i.n), ['balcão', 'mesa', 'boneco', 'planta']);
});

test('desenho: losango 32×16 sem serrilhado (contagem exata) e caixa pinta as 3 faces', () => {
  const r = new Raster(40, 30);
  const n = r.diamond(20, 12, 16, 8, hex('#ffffff'));
  assert.equal(n, 256, `losango pintou ${n}`); // área exata de 32×16/2
  // Bordas em degrau 2:1: em cada linha a largura muda de 4 em 4 px.
  const widths = [];
  for (let y = 4; y < 20; y++) {
    let w = 0;
    for (let x = 0; x < 40; x++) if (r.data[(y * 40 + x) * 4 + 3]) w++;
    widths.push(w);
  }
  assert.deepEqual(widths, [2, 6, 10, 14, 18, 22, 26, 30, 30, 26, 22, 18, 14, 10, 6, 2]);
  const b = new Raster(40, 40);
  b.box(20, 30, 10, 5, 12, hex('#ff0000'), hex('#00ff00'), hex('#0000ff'));
  const count = (rgb) => {
    let k = 0;
    for (let i = 0; i < b.data.length; i += 4) if (b.data[i] === rgb[0] && b.data[i + 1] === rgb[1] && b.data[i + 2] === rgb[2]) k++;
    return k;
  };
  assert.ok(count([255, 0, 0]) > 0 && count([0, 255, 0]) > 0 && count([0, 0, 255]) > 0);
});

test('desenho: polígono torto bate pixel a pixel com o teste "centro do pixel dentro?"', () => {
  const pts = [[1.3, 0.2], [17.8, 3.1], [6.4, 13.7]];
  const r = new Raster(20, 16);
  r.poly(pts, hex('#ffffff'));
  const inside = (px, py) => {
    let s = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) s = !s;
    }
    return s;
  };
  let diff = 0;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 20; x++) if (!!r.data[(y * 20 + x) * 4 + 3] !== inside(x + 0.5, y + 0.5)) diff++;
  assert.equal(diff, 0, `${diff} pixels diferentes do oráculo`);
});

test('presença: limpa lixo, online só com batimento recente, "visto há"', () => {
  const now = 1_800_000_000_000;
  const tree = sanitizePresence({
    will: { r: 'salao', x: 1, y: 2, tx: 3, ty: 4, at: now - 1000, on: true },
    bia: { r: 'salao', x: 1, y: 2, tx: 3, ty: 4, at: now - OFFLINE_AFTER_MS - 1, on: true },
    tati: { r: 'salao', x: 1, y: 2, tx: 3, ty: 4, at: now, on: false },
    zeca: { r: 'salao', x: 1, y: 2, tx: 3, ty: 4, at: now, on: true },
    vini: { r: 'SALAO!', x: 1, y: 2, tx: 3, ty: 4, at: now, on: true },
    dani: { r: 'salao', x: 1.5, y: 2, tx: 3, ty: 4, at: now, on: true },
  });
  assert.deepEqual(Object.keys(tree).sort(), ['bia', 'tati', 'will']);
  assert.equal(isOnline(tree.will, now), true);
  assert.equal(isOnline(tree.bia, now), false, 'passou de 90 s sem batimento');
  assert.equal(isOnline(tree.tati, now), false, 'fechou o bar');
  assert.equal(isOnline(undefined, now), false);
  assert.equal(lastSeen(tree.bia, now), 'visto há 1 min');
  assert.equal(lastSeen({ ...tree.will, at: now - 3 * 3600_000 }, now), 'visto há 3 h');
  assert.equal(lastSeen(undefined, now), 'nunca apareceu');
});

test('regras do banco (Firebase falso): presença válida passa, o resto é recusado', () => {
  const now = 1_800_000_000_000;
  const k = ['cruzadabotecos', 'bar', 'presence', 'will'];
  const ok = { r: 'salao', x: 1, y: 7, tx: 4, ty: 7, at: now, on: true };
  assert.equal(allowed({}, k, ok, now), true);
  assert.equal(allowed({}, ['cruzadabotecos', 'bar', 'presence', 'zeca'], ok, now), false, 'jogador desconhecido');
  assert.equal(allowed({}, k, { ...ok, at: now - 5000 }, now), false, 'hora que não é a do servidor');
  assert.equal(allowed({}, k, { ...ok, x: 99 }, now), false, 'fora da grade');
  assert.equal(allowed({}, k, { ...ok, hack: 1 }, now), false, 'campo estranho');
  assert.equal(allowed({}, k, null, now), false, 'apagar');
  const tree = { cruzadabotecos: { bar: { presence: { will: { ...ok, at: now - 100 } } } } };
  assert.equal(allowed(tree, k, ok, now), false, 'gravação a menos de 200 ms da anterior');
  // Placar continua com as regras de antes.
  const s = ['cruzadabotecos', 'v1', 'scores', 'will', 'LEX-AAAA_M_all'];
  assert.equal(allowed({}, s, { s: 10, t: now }, now), true);
  assert.equal(allowed({ cruzadabotecos: { v1: { scores: { will: { 'LEX-AAAA_M_all': { s: 50, t: 1 } } } } } }, s, { s: 10, t: now }, now), false);
});

test('regras: o arquivo database.rules.json tem o nó de presença com as mesmas exigências', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'database.rules.json'), 'utf8'));
  const bar = rules.rules.cruzadabotecos.bar;
  assert.equal(bar['.read'], true);
  const pres = bar.presence;
  const node = pres.$player;
  for (const f of ['r', 'x', 'y', 'tx', 'ty', 'at', 'on', '$other']) assert.ok(node[f], `falta ${f}`);
  assert.match(node['.write'], /vini\|will\|dani\|bia\|tati/);
  assert.match(node['.write'], />= 200/);
  assert.match(node.at['.validate'], /=== now/);
  assert.equal(node.$other['.validate'], false);
});

test('poses do bar: 5 jogadores × 10 poses, todas diferentes; deitado é a pose em pé girada', () => {
  const seen = new Set();
  for (const p of PLAYERS) {
    for (const pose of BAR_POSES) {
      const g = buildBarGrid(p.id, pose);
      const filled = g.flat().filter(Boolean).length;
      assert.ok(filled > 200, `${p.id}/${pose} só ${filled} px`);
      const sig = JSON.stringify(g);
      assert.ok(!seen.has(sig), `${p.id}/${pose} repetida`);
      seen.add(sig);
      if (pose === 'ko-flat' || pose === 'ko-bottle') assert.ok(g[0].length > g.length, `${p.id}/${pose} não está deitado`);
      else assert.ok(g.length > g[0].length, `${p.id}/${pose} não está em pé`);
    }
  }
  const sq = [['a', null], ['b', 'c']];
  assert.deepEqual(rotateGrid(sq), [['b', 'a'], ['c', null]]);
});

// ---------------------------------------------------------------- Fase 1: conversa e bizarrices

test('chat e efeitos: limpa lixo, ordena por hora, emoji só da lista', () => {
  const chat = social.sanitizeChat({
    will: { 0: { m: '  oi   gente ', t: 20 }, 1: { m: '', t: 5 }, 2: { m: 'x'.repeat(300), t: 30 } },
    bia: { 0: { m: 'fala', t: 10 } },
    zeca: { 0: { m: 'invasor', t: 1 } },
  });
  assert.deepEqual(chat.map((c) => [c.p, c.m.length, c.t]), [['bia', 4, 10], ['will', 8, 20], ['will', 140, 30]]);
  const fx = social.sanitizeFx({
    will: {
      0: { k: 'emoji', to: '', e: '🍺', t: 3 },
      1: { k: 'emoji', to: '', e: '💩', t: 4 },
      2: { k: 'tapa', to: 'bia', e: '', t: 2 },
      3: { k: 'tapa', to: '', e: '', t: 5 },
      4: { k: 'bomba', to: 'bia', e: '', t: 6 },
    },
  });
  assert.deepEqual(fx.map((f) => [f.k, f.e || f.to]), [['tapa', 'bia'], ['emoji', '🍺']]);
  assert.deepEqual(social.sanitizeMarks({ will: { by: 'bia', n: 9, t: 1 }, tati: { by: 'zeca', n: 1, t: 1 } }), { will: { by: 'bia', n: 6, t: 1 } }); // Fatia 15: teto 6
});

test('fila circular: usa a posição vazia, depois a mais antiga', () => {
  assert.equal(social.nextSlot(undefined, 3), 0);
  assert.equal(social.nextSlot({ 0: { t: 5 }, 1: { t: 9 } }, 3), 2);
  assert.equal(social.nextSlot({ 0: { t: 5 }, 1: { t: 2 }, 2: { t: 9 } }, 3), 1);
});

test('balões duram 6 s; efeitos saem só do horário (quem chega depois vê o mesmo)', () => {
  const chat = [
    { p: 'will', m: 'a', t: 1000 },
    { p: 'will', m: 'b', t: 3000 },
    { p: 'bia', m: 'c', t: 100 },
  ];
  const b = social.balloons(chat, 6500);
  assert.equal(b.will.m, 'b');
  assert.equal(b.bia, undefined, 'balão da Bia já saiu');
  const fx = [
    { p: 'will', k: 'tapa', to: 'bia', e: '', t: 10_000 },
    { p: 'tati', k: 'cerveja', to: 'vini', e: '', t: 10_000 },
    { p: 'dani', k: 'emoji', to: '', e: '🔥', t: 10_000 },
  ];
  const mid = social.effectsAt(fx, 10_200);
  assert.ok(mid.by.will.punchUntil > 10_200, 'Will ainda está no soco');
  assert.equal(mid.by.bia.hurtFrom, 'will');
  assert.equal(mid.by.bia.hurtKind, 'tapa');
  assert.equal(mid.flying.length, 1, 'cerveja ainda no ar');
  assert.ok(Math.abs(mid.flying[0].k01 - 200 / social.DUR.throw) < 1e-9);
  assert.equal(mid.by.dani.emojis.length, 1);
  const t30 = 10_000 + social.DUR.throw + 30_000;
  const later = social.effectsAt(fx, t30);
  assert.equal(later.flying.length, 0);
  assert.ok(later.by.vini.beerUntil > t30, 'ainda molhado aos 30 s');
  const t61 = 10_000 + social.DUR.throw + social.DUR.beer + 1;
  const gone = social.effectsAt(fx, t61);
  assert.ok(gone.by.vini.beerUntil < t61, 'secou depois de 60 s');
  assert.equal(gone.by.dani.emojis.length, 0);
});

test('bizarrice: espera, alcance, ressaca e "acordado"', () => {
  const base = { dist: 1, targetOnline: true, lastUse: 0, lastAny: 0, now: 100_000 };
  assert.deepEqual(social.canAct('tapa', base), { ok: true });
  assert.equal(social.canAct('tapa', { ...base, dist: 3 }).why, 'longe');
  assert.equal(social.canAct('amendoim', { ...base, dist: 5 }).ok, true);
  const w = social.canAct('cerveja', { ...base, lastUse: 100_000 - 5_000 });
  assert.equal(w.why, 'espera');
  assert.equal(w.waitMs, 15_000);
  assert.equal(social.canAct('tapa', { ...base, lastAny: 100_000 - 500 }).why, 'espera', 'limite geral de 2 s');
  assert.equal(social.canAct('tapa', { ...base, targetOnline: false }).why, 'ressaca');
  assert.equal(social.canAct('bigode', base).why, 'acordado');
  assert.equal(social.canAct('bigode', { ...base, targetOnline: false }).ok, true);
});

test('regras: chat e bizarrice só junto com o carimbo de ritmo; 2 s entre ações; tudo ou nada', () => {
  const now = 1_800_000_000_000;
  const base = ['cruzadabotecos', 'bar'];
  const up = (tree, u, t = now) => applyUpdate(tree, base, u, t);
  const ok = up({}, { 'rate/will': { at: now }, 'chat/will/0': { m: 'oi', t: now } });
  assert.ok(ok, 'mensagem com carimbo passa');
  assert.equal(up({}, { 'chat/will/0': { m: 'oi', t: now } }), null, 'sem carimbo');
  assert.equal(up({}, { 'rate/bia': { at: now }, 'chat/will/0': { m: 'oi', t: now } }), null, 'carimbo de outro');
  const t15 = now + 1500;
  assert.equal(up(ok, { 'rate/will': { at: t15 }, 'chat/will/1': { m: 'de novo', t: t15 } }, t15), null, '1,5 s depois');
  const t2 = now + 2000;
  assert.ok(up(ok, { 'rate/will': { at: t2 }, 'chat/will/1': { m: 'de novo', t: t2 } }, t2), '2 s depois');
  assert.equal(up({}, { 'rate/will': { at: now }, 'chat/will/20': { m: 'oi', t: now } }), null, 'posição 20 não existe');
  assert.equal(up({}, { 'rate/will': { at: now }, 'chat/will/0': { m: 'x'.repeat(141), t: now } }), null, 'texto longo');
  assert.ok(up({}, { 'rate/will': { at: now }, 'fx/will/9': { k: 'cerveja', to: 'bia', e: '', t: now } }));
  assert.equal(up({}, { 'rate/will': { at: now }, 'fx/will/0': { k: 'bomba', to: 'bia', e: '', t: now } }), null, 'tipo inventado');
  assert.equal(up({}, { 'rate/will': { at: now }, 'fx/will/0': { k: 'tapa', to: 'zeca', e: '', t: now } }), null, 'alvo inventado');
  assert.ok(up({}, { 'rate/will': { at: now }, 'marks/bia': { by: 'will', n: 1, t: now } }), 'bigode');
  assert.equal(up({}, { 'rate/will': { at: now }, 'marks/bia': { by: 'tati', n: 1, t: now } }), null, 'assinando por outro');
  assert.equal(up({}, { 'rate/will': { at: now }, 'marks/bia': { by: 'will', n: 7, t: now } }), null, 'pegadinha demais (Fatia 15: teto 6)');
  const t3 = now + 3000;
  assert.equal(up(ok, { 'rate/will': { at: t3 }, 'chat/will/0': null }, t3), null, 'apagar');
});

test('regras: database.rules.json tem chat, fx, marks e rate amarrados ao carimbo', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'database.rules.json'), 'utf8'));
  const bar = rules.rules.cruzadabotecos.bar;
  assert.ok(bar.rate.$player['.write'].includes("now - data.child('at').val() >= 2000"));
  for (const n of ['chat', 'fx']) assert.ok(bar[n].$player.$slot['.write'].includes("child('rate').child($player).child('at').val() === now"), n);
  assert.ok(bar.marks.$player['.write'].includes("child('rate').child(newData.child('by').val())"));
  assert.ok(bar.chat.$player.$slot.m['.validate'].includes('<= 140'));
});

console.log(`\n${passed} testes do bar passaram`);
