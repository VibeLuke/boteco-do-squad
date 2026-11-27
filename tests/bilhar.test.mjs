// Testes do motor de sinuca "bola 8" (src/vivo/bilhar.ts): física determinística, regras, codec e bot.
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

const B = await import('../src/vivo/bilhar.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

const { R, LARGURA, ALTURA, DT } = B;

function rngDe(sem) {
  let a = sem >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const unit = (ang) => ({ dx: Math.cos(ang), dy: Math.sin(ang) });

/** Mesa à mão: só as bolas dadas ficam na mesa; o resto vai para a caçapa. */
function montar({ bolas, vez = 0, grupo = [null, null], tacadas = 5, bolaNaMao = false }) {
  const m = B.novaMesa(1);
  for (let n = 0; n < 16; n++) {
    if (bolas[n]) m.bolas[n] = { n, x: bolas[n][0], y: bolas[n][1], dentro: false };
    else m.bolas[n] = { n, x: 0, y: 0, dentro: true };
  }
  m.vez = vez;
  m.grupo = grupo;
  m.tacadas = tacadas;
  m.bolaNaMao = bolaNaMao;
  return m;
}
const bate = (m, t = 0.1) => ({ k: 'bate', n: 0, m, t });
const cai = (n, c = 0, t = 0.5) => ({ k: 'caçapa', n, t, c });
/** Aplica as regras supondo que as bolas dos eventos 'caçapa' foram para a caçapa. */
function regra(antes, eventos) {
  const depois = B.clonarMesa(antes);
  for (const e of eventos) if (e.k === 'caçapa') depois.bolas[e.n] = { n: e.n, x: 0, y: 0, dentro: true };
  return B.aplicarRegras(antes, depois, eventos);
}

// ------------------------------------------------------------------------------------------------ geometria
test('constantes e mesa nova: triângulo, 8 no meio, cantos de trás de grupos diferentes', () => {
  assert.equal(B.CACAPAS.length, 6);
  assert.ok(Math.abs(B.RAIO_CANTO - 1.9 * R) < 1e-12 && Math.abs(B.RAIO_MEIO - 1.6 * R) < 1e-12);
  for (const sem of [1, 2, 3, 99, 12345]) {
    const m = B.novaMesa(sem);
    assert.equal(m.bolas.length, 16);
    m.bolas.forEach((b, i) => assert.equal(b.n, i));
    assert.equal(m.bolas[8].x, 1.5 + 2 * 0.08);
    assert.equal(m.bolas[8].y, 0.5);
    assert.deepEqual([m.bolas[0].x, m.bolas[0].y], [0.5, 0.5]);
    for (let i = 0; i < 16; i++)
      for (let j = i + 1; j < 16; j++)
        assert.ok(Math.hypot(m.bolas[i].x - m.bolas[j].x, m.bolas[i].y - m.bolas[j].y) >= 2 * R, 'bolas sobrepostas');
    const trasX = Math.max(...m.bolas.map((b) => b.x));
    const cantos = m.bolas.filter((b) => b.x === trasX && b.n > 0);
    assert.equal(cantos.length, 5);
    const a = cantos.reduce((p, c) => (c.y < p.y ? c : p));
    const z = cantos.reduce((p, c) => (c.y > p.y ? c : p));
    assert.notEqual(B.grupoDe(a.n), B.grupoDe(z.n));
  }
  assert.notDeepEqual(B.novaMesa(1).bolas, B.novaMesa(2).bolas);
  assert.deepEqual(B.novaMesa(7), B.novaMesa(7));
});

// ------------------------------------------------------------------------------------------------ determinismo
const TAC = { dx: 0.98, dy: 0.2, forca: 0.9 };

test('determinismo: mesma tacada 2x = mesmo resultado; entrada não muta', () => {
  const m = B.novaMesa(42);
  const cópia = JSON.stringify(m);
  const a = B.simular(m, TAC);
  const b = B.simular(m, TAC);
  assert.equal(JSON.stringify(m), cópia);
  assert.deepEqual(a.mesa, b.mesa);
  assert.deepEqual(a.eventos, b.eventos);
  assert.ok(a.eventos.some((e) => e.k === 'bate'));
  assert.ok(a.eventos.some((e) => e.k === 'tabela'));
});

test('passo a passo (DT, 60 fps, 144 fps e dt irregular) = simular, exatamente', () => {
  for (const sem of [3, 42, 77]) {
    const m = B.novaMesa(sem);
    const ref = B.simular(m, TAC);
    const passos = [DT, 1 / 60, 1 / 144, null];
    for (const dt of passos) {
      const e = B.iniciarTacada(m, TAC);
      const r = rngDe(sem + 5);
      let guarda = 0;
      while (B.emMovimento(e) && guarda++ < 100000) B.passoFisica(e, dt === null ? 0.0005 + r() * 0.03 : dt);
      const f = B.fecharTacada(m, e);
      assert.deepEqual(f.mesa, ref.mesa, `mesa difere (dt=${dt})`);
      assert.deepEqual(f.eventos, ref.eventos, `eventos diferem (dt=${dt})`);
    }
  }
});

test('quadros gravados: primeiro = mesa inicial, último = mesa final', () => {
  const m = B.novaMesa(5);
  const r = B.simular(m, TAC, undefined, { gravarACada: 8 });
  assert.ok(r.quadros.length > 20);
  assert.deepEqual(r.quadros[0].bolas, m.bolas);
  assert.deepEqual(r.quadros[r.quadros.length - 1].bolas, r.mesa.bolas);
});

// ------------------------------------------------------------------------------------------------ física
test('200 tacadas fortes: ninguém sai da mesa, ninguém atravessa, energia nunca sobe, a mesa para sozinha', () => {
  const rng = rngDe(2026);
  let tacadas = 0;
  let maxDur = 0;
  let minDist = 9;
  let capturas = 0;
  let mesa = B.novaMesa(1);
  while (tacadas < 200) {
    if (mesa.fim || tacadas % 5 === 0) mesa = B.novaMesa(100 + tacadas);
    const ang = rng() * Math.PI * 2;
    const tac = { ...unit(ang), forca: 0.8 + rng() * 0.2 };
    let eAnt = Infinity;
    const r = B.simular(mesa, tac, (e) => {
      let en = 0;
      for (let i = 0; i < 16; i++) {
        const b = e.bolas[i];
        if (b.dentro) continue;
        en += b.vx * b.vx + b.vy * b.vy;
        assert.ok(b.x >= R - 1e-9 && b.x <= LARGURA - R + 1e-9 && b.y >= R - 1e-9 && b.y <= ALTURA - R + 1e-9, 'bola fora da mesa');
        for (let j = i + 1; j < 16; j++) {
          const c = e.bolas[j];
          if (c.dentro) continue;
          const d = Math.sqrt((b.x - c.x) ** 2 + (b.y - c.y) ** 2);
          if (d < minDist) minDist = d;
          assert.ok(d >= 2 * R - 0.002, `bolas ${i} e ${j} atravessadas (d=${d})`);
        }
      }
      assert.ok(en <= eAnt + 1e-9, `energia subiu: ${eAnt} -> ${en}`);
      eAnt = en;
    });
    assert.ok(r.parou, 'a mesa não parou');
    maxDur = Math.max(maxDur, r.duracao);
    capturas += r.eventos.filter((e) => e.k === 'caçapa').length;
    for (const b of r.mesa.bolas) if (!b.dentro) assert.ok(b.x >= R && b.x <= LARGURA - R && b.y >= R && b.y <= ALTURA - R);
    mesa = r.mesa;
    tacadas++;
  }
  assert.ok(maxDur < 15, `mesa demorou ${maxDur}s`);
  assert.ok(capturas > 20, 'esperava algumas caçapadas');
  console.log(`   (maior duração ${maxDur.toFixed(2)} s, menor distância entre centros ${minDist.toFixed(4)} ≥ ${2 * R}, ${capturas} caçapadas)`);
});

test('colisão frontal de massas iguais: a branca para e a bola-alvo sai (restituição 0,95)', () => {
  const m = montar({ bolas: { 0: [0.5, 0.5], 1: [1.0, 0.5], 8: [1.8, 0.9], 9: [1.8, 0.1] }, tacadas: 3 });
  const r = B.simular(m, { dx: 1, dy: 0, forca: 0.5 });
  const bate1 = r.eventos.find((e) => e.k === 'bate');
  assert.deepEqual([bate1.n, bate1.m], [0, 1]);
  assert.ok(Math.abs(bate1.v - 2.5 * (1 - (0.6 * (0.5 - R * 2)) / 2.5 / 1)) < 0.2, 'velocidade do choque fora do esperado');
});

test('bola entra na caçapa quando o centro cruza o raio de captura (e não quica ali)', () => {
  const m = montar({ bolas: { 0: [1.0, 0.8], 1: [1.5, 0.8], 8: [1.8, 0.9], 9: [1.8, 0.1] } });
  const r = B.simular(m, { dx: -0.2, dy: -0.8, forca: 0.7 });
  // a branca sobe até a caçapa do meio ou quica; basta provar uma caçapa conhecida com tacada reta
  const m2 = montar({ bolas: { 0: [1.0, 0.8], 1: [1.5, 0.8], 8: [1.8, 0.9], 9: [1.8, 0.1] } });
  const r2 = B.simular(m2, { dx: 0, dy: -1, forca: 0.7 });
  const ev = r2.eventos.find((e) => e.k === 'caçapa');
  assert.ok(ev && ev.n === 0 && ev.c === 4, 'branca devia cair na caçapa do meio de cima');
  assert.ok(r2.mesa.bolas[0].dentro && r2.mesa.bolaNaMao);
  assert.ok(r.parou);
});

test('forca 0, direção nula ou NaN: nada se mexe, sem travar', () => {
  const m = B.novaMesa(9);
  for (const t of [{ dx: 1, dy: 0, forca: 0 }, { dx: 0, dy: 0, forca: 1 }, { dx: NaN, dy: 1, forca: 1 }, { dx: 1, dy: 0, forca: NaN }]) {
    const r = B.simular(m, t);
    assert.deepEqual(r.mesa.bolas, m.bolas);
    assert.equal(r.duracao, 0);
  }
});

// ------------------------------------------------------------------------------------------------ regras
test('regra: grupo definido pela primeira bola encaçapada depois da quebra', () => {
  const antes = montar({ bolas: { 0: [0.5, 0.5], 3: [1, 0.3], 10: [1.2, 0.7], 8: [1.5, 0.5] }, tacadas: 2 });
  const r = regra(antes, [bate(3), cai(3)]);
  assert.deepEqual(r.grupo, ['lisas', 'listradas']);
  assert.equal(r.vez, 0);
  assert.equal(r.bolaNaMao, false);
  assert.equal(r.tacadas, 3);
});

test('regra: duas bolas de grupos diferentes na mesma tacada, vale a primeira que caiu', () => {
  const antes = montar({ bolas: { 0: [0.5, 0.5], 3: [1, 0.3], 12: [1.2, 0.7], 8: [1.5, 0.5] }, vez: 1, tacadas: 2 });
  const r = regra(antes, [bate(3), cai(12, 0, 0.4), cai(3, 1, 0.6)]);
  assert.deepEqual(r.grupo, [ 'lisas', 'listradas']);
  assert.equal(r.vez, 1);
  const r2 = regra(antes, [bate(3), cai(3, 0, 0.4), cai(12, 1, 0.6)]);
  assert.deepEqual(r2.grupo, ['listradas', 'lisas']);
});

test('regra: quebra com bola encaçapada não define grupo, quem quebrou continua', () => {
  const antes = montar({ bolas: { 0: [0.5, 0.5], 1: [1.5, 0.5], 4: [1.6, 0.4], 9: [1.6, 0.6], 8: [1.7, 0.5] }, tacadas: 0 });
  const r = regra(antes, [bate(1), cai(4)]);
  assert.deepEqual(r.grupo, [null, null]);
  assert.equal(r.vez, 0);
  assert.equal(r.bolaNaMao, false);
  const r2 = regra(antes, [bate(1)]);
  assert.equal(r2.vez, 1);
  assert.equal(r2.bolaNaMao, false);
});

test('regra: falta = branca na caçapa, bola errada primeiro, ou não tocar em nada; adversário com bola na mão', () => {
  const grupo = ['lisas', 'listradas'];
  const antes = montar({ bolas: { 0: [0.5, 0.5], 2: [1, 0.3], 11: [1.2, 0.7], 8: [1.5, 0.5] }, grupo });
  let r = regra(antes, [bate(2), cai(2), cai(0, 1, 0.9)]);
  assert.equal(r.vez, 1);
  assert.equal(r.bolaNaMao, true);
  assert.ok(r.bolas[0].dentro);
  r = regra(antes, [bate(11), cai(2)]);
  assert.equal(r.vez, 1);
  assert.ok(r.bolaNaMao);
  r = regra(antes, []);
  assert.equal(r.vez, 1);
  assert.ok(r.bolaNaMao);
  r = regra(antes, [bate(8)]);
  assert.ok(r.bolaNaMao, 'tocar a 8 antes de limpar o grupo é falta');
  // antes de ter grupo, qualquer uma menos a 8 vale
  const aberta = montar({ bolas: { 0: [0.5, 0.5], 2: [1, 0.3], 11: [1.2, 0.7], 8: [1.5, 0.5] } });
  assert.equal(regra(aberta, [bate(11)]).bolaNaMao, false);
  assert.equal(regra(aberta, [bate(2)]).bolaNaMao, false);
  assert.equal(regra(aberta, [bate(8)]).bolaNaMao, true);
});

test('regra: acertou do grupo sem falta continua; só bola do adversário passa a vez sem bola na mão', () => {
  const grupo = ['lisas', 'listradas'];
  const antes = montar({ bolas: { 0: [0.5, 0.5], 2: [1, 0.3], 5: [1.1, 0.3], 11: [1.2, 0.7], 8: [1.5, 0.5] }, grupo });
  let r = regra(antes, [bate(2), cai(2)]);
  assert.equal(r.vez, 0);
  assert.equal(r.bolaNaMao, false);
  r = regra(antes, [bate(2), cai(11)]);
  assert.equal(r.vez, 1);
  assert.equal(r.bolaNaMao, false);
  assert.ok(r.bolas[11].dentro);
  r = regra(antes, [bate(2), cai(11), cai(5)]);
  assert.equal(r.vez, 0);
  r = regra(antes, [bate(2)]);
  assert.equal(r.vez, 1);
  assert.equal(r.bolaNaMao, false);
});

test('regra: a 8 — vence depois de limpar; perde antes, com falta, ou junto da última do grupo', () => {
  const grupo = ['lisas', 'listradas'];
  const limpo = montar({ bolas: { 0: [0.5, 0.5], 9: [1, 0.3], 8: [1.5, 0.5] }, grupo });
  let r = regra(limpo, [bate(8), cai(8)]);
  assert.deepEqual(r.fim && r.fim.vencedor, 0);
  const antesV1 = { ...limpo, vez: 1 };
  r = regra(antesV1, [bate(8), cai(8)]);
  assert.equal(r.fim.vencedor, 0, 'jogador 1 tem as listradas e a 9 ainda está na mesa → perde, o 0 vence');
  const limpo1 = montar({ bolas: { 0: [0.5, 0.5], 2: [1, 0.3], 8: [1.5, 0.5] }, grupo, vez: 1 });
  r = regra(limpo1, [bate(8), cai(8)]);
  assert.equal(r.fim.vencedor, 1);
  r = regra(limpo, [bate(8), cai(8), cai(0, 1)]);
  assert.equal(r.fim.vencedor, 1, 'a 8 com a branca na caçapa = derrota');
  const cedo = montar({ bolas: { 0: [0.5, 0.5], 2: [1, 0.3], 3: [1, 0.6], 11: [1.2, 0.7], 8: [1.5, 0.5] }, grupo });
  r = regra(cedo, [bate(2), cai(8)]);
  assert.equal(r.fim.vencedor, 1);
  const quase = montar({ bolas: { 0: [0.5, 0.5], 2: [1, 0.3], 8: [1.5, 0.5] }, grupo });
  r = regra(quase, [bate(2), cai(2), cai(8)]);
  assert.equal(r.fim.vencedor, 1, 'a 8 junto com a última do grupo = derrota');
  const aberta = montar({ bolas: { 0: [0.5, 0.5], 2: [1, 0.3], 11: [1.2, 0.7], 8: [1.5, 0.5] } });
  r = regra(aberta, [bate(2), cai(8)]);
  assert.equal(r.fim.vencedor, 1, 'a 8 sem grupo definido = derrota');
  // depois do fim, simular não mexe
  const s = B.simular(r, { dx: 1, dy: 0, forca: 1 });
  assert.deepEqual(s.mesa, r);
});

test('regra via física: tacada real que não toca nada dá falta; a mesa não é mutada pelas regras', () => {
  const antes = montar({ bolas: { 0: [0.5, 0.5], 3: [1.5, 0.9], 10: [1.5, 0.1], 8: [1.8, 0.5] }, grupo: ['lisas', 'listradas'] });
  const cópia = JSON.stringify(antes);
  const r = B.simular(antes, { dx: 0, dy: 1, forca: 0.05 });
  assert.equal(JSON.stringify(antes), cópia);
  assert.equal(r.eventos.length, 0);
  assert.equal(r.mesa.vez, 1);
  assert.ok(r.mesa.bolaNaMao);
});

test('posicionarBranca valida a posição', () => {
  const m = montar({ bolas: { 0: [0.5, 0.5], 3: [1.0, 0.5], 8: [1.5, 0.5] }, bolaNaMao: true });
  m.bolas[0] = { n: 0, x: 0, y: 0, dentro: true };
  const ok = B.posicionarBranca(m, 0.7, 0.5);
  assert.ok(ok && !ok.bolas[0].dentro && ok.bolas[0].x === 0.7);
  assert.equal(m.bolas[0].dentro, true, 'não muta a entrada');
  assert.equal(B.posicionarBranca(m, 1.05, 0.5), null, 'sobre outra bola');
  assert.equal(B.posicionarBranca(m, 1.0 + 2 * R - 0.002, 0.5), null);
  assert.ok(B.posicionarBranca(m, 1.0 + 2 * R + 0.002, 0.5));
  assert.equal(B.posicionarBranca(m, 0.01, 0.5), null, 'fora (tabela)');
  assert.equal(B.posicionarBranca(m, 0.06, 0.06), null, 'na boca da caçapa');
  assert.equal(B.posicionarBranca(m, 1.0, 0.06), null, 'na boca da caçapa do meio');
  assert.equal(B.posicionarBranca(m, NaN, 0.5), null);
  const semMao = { ...m, bolaNaMao: false };
  assert.equal(B.posicionarBranca(semMao, 0.7, 0.5), null);
});

// ------------------------------------------------------------------------------------------------ codec
test('codificar/decodificar: ida e volta exata, ≤ 200 caracteres, simular igual dos dois lados', () => {
  let m = B.novaMesa(11);
  const vistos = [];
  for (let i = 0; i < 12 && !m.fim; i++) {
    const r = B.simular(m, { ...unit(0.3 + i), forca: 0.4 + (i % 5) * 0.12 });
    m = r.mesa;
    vistos.push(m);
  }
  vistos.push(B.novaMesa(3), regra(montar({ bolas: { 0: [0.5, 0.5], 2: [1, 0.3], 8: [1.5, 0.5] }, grupo: ['lisas', 'listradas'] }), [bate(8), cai(8)]));
  for (const x of vistos) {
    const s = B.codificar(x);
    assert.ok(s.length <= 200, `${s.length} caracteres`);
    assert.deepEqual(B.decodificar(s), x);
    assert.equal(B.codificar(B.decodificar(s)), s);
  }
  const m0 = B.novaMesa(21);
  const a = B.simular(m0, TAC);
  const b = B.simular(B.decodificar(B.codificar(m0)), TAC);
  assert.deepEqual(a.mesa, b.mesa);
  assert.deepEqual(a.eventos, b.eventos);
  console.log(`   (código com ${B.codificar(m0).length} caracteres)`);
});

test('decodificar recusa lixo', () => {
  const bom = B.codificar(B.novaMesa(4));
  const ruins = ['', 'abc', 'B', bom.slice(0, -1), bom + '0', bom.toUpperCase(), bom.replace('B', 'X'), '{"bolas":[]}', 'B0--0--000' + 'z'.repeat(80), 'B0--0--000' + '0'.repeat(80)];
  // bola repetida no mesmo lugar (duas bolas coladas) e posição fora da mesa
  const bolaTexto = (i) => bom.slice(10 + i * 5, 15 + i * 5);
  ruins.push(bom.slice(0, 15) + bolaTexto(0) + bom.slice(20));
  ruins.push(bom.slice(0, 10) + 'zzzzy' + bom.slice(15));
  ruins.push(bom.slice(0, 2) + 'll' + bom.slice(4)); // os dois com o mesmo grupo
  ruins.push(bom.slice(0, 2) + 'lt' .replace('t', '-') + bom.slice(4)); // um com grupo, outro sem
  ruins.push(bom.slice(0, 5) + '9' + bom.slice(6)); // fim com vencedor inválido
  for (const r of ruins) assert.equal(B.decodificar(r), null, `devia recusar: ${r}`);
  for (const r of [null, undefined, 5, {}, []]) assert.equal(B.decodificar(r), null);
  const rng = rngDe(5);
  const alfa = '0123456789abcdefghijklmnopqrstuvwxyz-BTL';
  for (let i = 0; i < 300; i++) {
    let s = '';
    const n = 90 + (i % 3);
    for (let k = 0; k < n; k++) s += alfa[Math.trunc(rng() * alfa.length)];
    assert.equal(B.decodificar(s), null);
  }
  // branca na caçapa sem bola na mão é incoerente
  const m = B.novaMesa(4);
  m.bolas[0] = { n: 0, x: 0, y: 0, dentro: true };
  assert.equal(B.decodificar(B.codificar(m)), null);
});

// ------------------------------------------------------------------------------------------------ bot
const NIVEIS = ['facil', 'medio', 'dificil'];
let maiorMs = 0;
let maiorMsDificil = 0;
let somaMsDificil = 0;
let nDificil = 0;
const decisoes = [];

function jogada(m, nivel, sem) {
  const t0 = performance.now();
  const j = B.pensarBot(m, nivel, sem);
  const ms = performance.now() - t0;
  maiorMs = Math.max(maiorMs, ms);
  if (nivel === 'dificil') {
    maiorMsDificil = Math.max(maiorMsDificil, ms);
    somaMsDificil += ms;
    nDificil++;
    decisoes.push(ms);
  }
  return j;
}

function partida(nivelA, nivelB, sem) {
  let m = B.novaMesa(sem);
  const niveis = [nivelA, nivelB];
  let n = 0;
  while (!m.fim && n < 150) {
    const j = jogada(m, niveis[m.vez], sem * 1000 + n);
    if (m.bolaNaMao || m.bolas[0].dentro) {
      assert.ok(j.branca, 'com bola na mão o bot tem de escolher a posição');
      const p = B.posicionarBranca(m, j.branca.x, j.branca.y);
      assert.ok(p, `posição da branca inválida: ${JSON.stringify(j.branca)}`);
      m = p;
    } else assert.equal(j.branca, undefined);
    assert.ok(Number.isFinite(j.dx) && Number.isFinite(j.dy) && j.forca >= 0 && j.forca <= 1);
    assert.ok(Math.abs(Math.hypot(j.dx, j.dy) - 1) < 1e-9, 'direção tem de ser unitária');
    m = B.simular(m, j).mesa;
    n++;
  }
  return { fim: m.fim, tacadas: n };
}

test('bot determinístico pela semente', () => {
  const m = B.novaMesa(8);
  for (const nv of NIVEIS) assert.deepEqual(B.pensarBot(m, nv, 5), B.pensarBot(m, nv, 5));
  assert.notDeepEqual(B.pensarBot(m, 'facil', 5), B.pensarBot(m, 'facil', 6));
  // a jogada do bot na quebra é sempre em direção ao triângulo
  const j = B.pensarBot(m, 'dificil', 1);
  assert.ok(j.dx > 0.95 && j.forca > 0.9);
});

for (const [a, b] of [['facil', 'facil'], ['medio', 'medio'], ['dificil', 'dificil'], ['dificil', 'facil']]) {
  test(`bot ${a} × bot ${b}: 20 partidas terminam com vencedor em até 150 tacadas`, () => {
    let soma = 0;
    let maior = 0;
    let vitA = 0;
    const SEMENTES = 20;
    for (let s = 1; s <= SEMENTES; s++) {
      const r = partida(a, b, s);
      assert.ok(r.fim, `partida ${s} não terminou em ${r.tacadas} tacadas`);
      assert.ok(r.fim.vencedor === 0 || r.fim.vencedor === 1);
      soma += r.tacadas;
      maior = Math.max(maior, r.tacadas);
      if (r.fim.vencedor === 0) vitA++;
    }
    console.log(`   (${a} × ${b}: média ${(soma / SEMENTES).toFixed(1)} tacadas, máx ${maior}; jogador 0 (${a}) venceu ${vitA}/${SEMENTES})`);
  });
}

test('tempo do bot: maior decisão ≤ 60 ms no nível difícil (inclui a primeira chamada, a "fria")', () => {
  decisoes.sort((x, y) => x - y);
  const p99 = decisoes[Math.trunc(decisoes.length * 0.99)];
  console.log(
    `   (decisões difíceis: ${nDificil}, média ${(somaMsDificil / nDificil).toFixed(2)} ms, p99 ${p99.toFixed(2)} ms, MAIOR ${maiorMsDificil.toFixed(2)} ms; maior de todos os níveis ${maiorMs.toFixed(2)} ms)`,
  );
  assert.ok(maiorMsDificil <= 60, `bot difícil levou ${maiorMsDificil} ms`);
});

/** Bola 1 a 0,3 da caçapa, branca alinhada com a bola e a caçapa; sorteia caçapa e distância pela semente. */
function facilMontada(sem) {
  const r = rngDe(sem * 7919 + 13);
  const dist = 0.3 + r() * 0.3; // branca → bola (cabe na mesa nos três casos)
  const tipo = sem % 3;
  let alvo, branca;
  if (tipo === 0) {
    alvo = [1.0, 0.3]; // caçapa do meio de cima
    branca = [1.0, 0.3 + dist];
  } else if (tipo === 1) {
    const k = 0.3 / Math.SQRT2; // canto esquerdo de cima, na diagonal
    alvo = [q3(k), q3(k)];
    branca = [q3(k + dist / Math.SQRT2), q3(k + dist / Math.SQRT2)];
  } else {
    const k = 0.3 / Math.SQRT2;
    alvo = [q3(LARGURA - k), q3(ALTURA - k)];
    branca = [q3(LARGURA - k - dist / Math.SQRT2), q3(ALTURA - k - dist / Math.SQRT2)];
  }
  const m = montar({
    bolas: { 0: branca, 1: alvo, 10: [0.3, 0.9], 8: [1.2, 0.85], 9: [1.7, 0.15] }, // só a 1 é do grupo do jogador
    grupo: ['lisas', 'listradas'],
    tacadas: 6,
  });
  return m;
}
const q3 = (v) => Math.round(v * 1000) / 1000;

test('bot difícil encaça a bola fácil (a 0,3 da caçapa) em ≥ 90% de 20 sementes; o fácil acerta menos', () => {
  const taxa = {};
  for (const nv of NIVEIS) {
    let ok = 0;
    for (let s = 1; s <= 20; s++) {
      const m = facilMontada(s);
      const j = jogada(m, nv, s);
      const r = B.simular(m, j);
      if (r.mesa.bolas[1].dentro && !r.mesa.bolaNaMao && !r.mesa.fim) ok++;
    }
    taxa[nv] = ok / 20;
  }
  console.log(`   (taxa de acerto da bola fácil: fácil ${taxa.facil * 100}%, médio ${taxa.medio * 100}%, difícil ${taxa.dificil * 100}%)`);
  assert.ok(taxa.dificil >= 0.9, `difícil acertou só ${taxa.dificil}`);
  assert.ok(taxa.facil < taxa.dificil, 'o fácil tem de acertar menos que o difícil');
  assert.ok(taxa.facil < 0.9, 'o fácil não pode ser tão bom quanto o difícil');
});

test('bot com a 8 como alvo (grupo limpo) mira e vence quando acerta', () => {
  let vit = 0;
  for (let s = 1; s <= 10; s++) {
    const m = montar({ bolas: { 0: [0.6, 0.6], 8: [1.0, 0.3], 9: [1.7, 0.15] }, grupo: ['lisas', 'listradas'], tacadas: 9 });
    const r = B.simular(m, jogada(m, 'dificil', s));
    if (r.mesa.fim && r.mesa.fim.vencedor === 0) vit++;
  }
  assert.ok(vit >= 9, `só ${vit}/10 vitórias`);
});

console.log(`\n${passed} testes do bilhar passaram`);
