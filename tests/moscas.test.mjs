// Testes da Fatia 13 (Moscaria e portal do dia): a simulação é determinística pela semente, a gravação de entradas
// reproduz a run inteira (mesmos pontos e mesmo passo final), as cartas não oferecem arma no nível 4, o enxame nunca
// passa do teto, a curva de dificuldade bate com os dois bots de régua, o prêmio sobe com os pontos, e o portal
// (dia, espera, pity, Pó, inventário e fantasma) segue as regras do plano. Os casos «deve falhar» provam que os
// medidores pegam o erro: gravação adulterada e semente trocada divergem; pity desligado não garante o Raro.
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

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');
const S = await import('../src/portais/moscas/sim.ts');
const P = await import('../src/portais/portal.ts');
const I = await import('../src/portais/inventario.ts');
const mockRules = await import('./mock-rules.mjs');

let n = 0;
// MOSCAS_LONGO=1 roda a varredura grande do plano (20 sementes no teto, 100 na curva); a cadeia do npm test roda a curta.
const LONGO = !!process.env.MOSCAS_LONGO;
const test = (nome, fn) => {
  const t0 = performance.now();
  fn();
  n++;
  console.log(`ok ${n} - ${nome} (${Math.round(performance.now() - t0)} ms)`);
};

// Bot que anda em círculo de raio 11 em volta do centro e pega sempre a carta `carta(nivel)`; grava como a tela.
// `segueAndando`: escolhe a carta com a direção ainda apertada (como na tela, onde a tecla continua segura).
function botCirculo(semente, carta = (nv) => nv % 3, segueAndando = false) {
  const m = S.novaMoscaria(semente);
  const grav = [];
  const ultimo = { d: -1 };
  for (let it = 0; it < S.PASSOS_RUN * 4 && !m.fim; it++) {
    const dx = m.x - S.CURVA.largura / 2;
    const dy = m.y - S.CURVA.altura / 2;
    const r = Math.hypot(dx, dy);
    let e = { mx: 1, my: 0 };
    if (r >= 0.5) {
      const k = (11 - r) * 0.25;
      e = { mx: -dy / r + (dx / r) * k, my: dx / r + (dy / r) * k };
    }
    if (m.cartas) {
      S.jogarGravando(m, { ...(segueAndando ? e : { mx: 0, my: 0 }), carta: carta(m.nivel) }, grav, ultimo);
      continue;
    }
    // Grita uma vez quando o enxame aperta (para a gravação ter grito também).
    const grita = !m.gritou && m.moscas.length > 60;
    S.jogarGravando(m, { ...e, grita: grita || undefined }, grav, ultimo);
  }
  return { m, grav };
}
function botParado(semente) {
  const m = S.novaMoscaria(semente);
  for (let it = 0; it < S.PASSOS_RUN * 4 && !m.fim; it++) S.passo(m, m.cartas ? { mx: 0, my: 0, carta: 0 } : S.PARADO);
  return m;
}

/* ------------------------------------------------------------------ simulação */

test('mesma semente, mesmo mundo: 3 execuções dão o mesmo hash a cada 500 passos e no fim', () => {
  const rodar = () => {
    const { m } = botCirculo(20261127);
    return { h: S.hashMundo(m), passo: m.passo, pontos: S.pontuacao(m) };
  };
  const a = rodar();
  assert.deepEqual(rodar(), a);
  assert.deepEqual(rodar(), a);
  // E a meio caminho também (não só no fim).
  const h = [];
  for (let k = 0; k < 2; k++) {
    const m = S.novaMoscaria(99);
    const hs = [];
    for (let i = 0; i < 3000 && !m.fim; i++) {
      S.passo(m, m.cartas ? { mx: 0, my: 0, carta: 1 } : S.direcao(1 + (Math.floor(i / 90) % 8)));
      if (i % 500 === 0) hs.push(S.hashMundo(m));
    }
    h.push(hs.join(','));
  }
  assert.equal(h[0], h[1]);
  // Deve falhar: outra semente dá outro mundo.
  assert.notEqual(S.hashMundo(botCirculo(20261128).m), a.h);
});

test('gravação e replay: a run reproduzida chega ao mesmo passo final, mesmos pontos e mesmo hash', () => {
  for (const [sem, andando] of [[1, false], [77, true], [4242, false], [20261127, true]]) {
    const { m, grav } = botCirculo(sem, undefined, andando);
    const r = S.reproduzir(sem, grav);
    assert.equal(r.passo, m.passo, `semente ${sem}: passo`);
    assert.equal(r.fim, m.fim);
    assert.equal(S.pontuacao(r), S.pontuacao(m));
    assert.equal(S.hashMundo(r), S.hashMundo(m));
    // A gravação é curta (só mudanças): cabe no banco.
    assert.ok(grav.length < 3000, `gravação de ${grav.length} entradas`);
    assert.ok(grav.some((g) => g.grita) && grav.some((g) => g.carta !== undefined), 'gravou grito e carta');
  }
});

test('deve falhar: gravação adulterada (uma direção trocada no meio) diverge do original', () => {
  const { m, grav } = botCirculo(4242);
  const meio = grav.findIndex((g, i) => i > grav.length / 2 && g.carta === undefined && !g.grita);
  const adulterada = grav.map((g, i) => (i === meio ? { ...g, d: ((g.d + 3) % 8) + 1 } : g));
  assert.notEqual(S.hashMundo(S.reproduzir(4242, adulterada)), S.hashMundo(m));
  // E entrada crua (sem quantizar) não é o que se grava: a tela joga a quantizada, então o caminho cru diverge.
  const cru = S.novaMoscaria(4242);
  for (let i = 0; i < 1200 && !cru.fim; i++) S.passo(cru, cru.cartas ? { mx: 0, my: 0, carta: 0 } : { mx: Math.cos(i / 50), my: Math.sin(i / 50) });
  const q = S.novaMoscaria(4242);
  for (let i = 0; i < 1200 && !q.fim; i++) S.passo(q, q.cartas ? { mx: 0, my: 0, carta: 0 } : S.direcao(S.quantizar(Math.cos(i / 50), Math.sin(i / 50))));
  assert.notEqual(S.hashMundo(cru), S.hashMundo(q));
});

test('cartas: as mesmas pela semente, 3 diferentes, e arma no nível 4 (ou passiva no 3) nunca volta', () => {
  const sorteio = (sem) => {
    const m = S.novaMoscaria(sem);
    return JSON.stringify(S.sortearCartas(m));
  };
  assert.equal(sorteio(5), sorteio(5));
  let difere = false;
  for (let s = 1; s < 30; s++) if (sorteio(s) !== sorteio(5)) difere = true;
  assert.ok(difere, 'sementes diferentes variam as cartas');
  for (let s = 1; s <= 200; s++) {
    const m = S.novaMoscaria(s);
    m.armas.chinelo = 4;
    m.armas.raquetes = 4;
    m.passivas.ima = 3;
    const cs = S.sortearCartas(m);
    assert.equal(cs.length, 3);
    assert.equal(new Set(cs.map((c) => c.k + (c.arma ?? c.passiva))).size, 3, 'sem repetir');
    for (const c of cs) {
      assert.ok(!(c.k === 'arma' && (c.arma === 'chinelo' || c.arma === 'raquetes')), `semente ${s}: ofereceu arma no nível 4`);
      assert.ok(!(c.k === 'passiva' && c.passiva === 'ima'), 'ofereceu passiva no 3');
    }
  }
  // Tudo no máximo: não sobra carta, e o jogo não trava esperando escolha.
  const m = S.novaMoscaria(3);
  for (const a of S.ARMAS) m.armas[a] = S.NIVEL_MAX_ARMA;
  for (const p of S.PASSIVAS) m.passivas[p] = S.NIVEL_MAX_PASSIVA;
  assert.equal(S.sortearCartas(m).length, 0);
});

test(`o enxame nunca passa do teto de 220 vivas (${LONGO ? 20 : 8} sementes × 6.000 passos, garçom imortal)`, () => {
  let pico = 0;
  for (let s = 1; s <= (LONGO ? 20 : 8); s++) {
    const m = S.novaMoscaria(s * 131);
    for (let i = 0; i < S.PASSOS_RUN * 2 && m.passo < S.PASSOS_RUN - 1; i++) {
      m.copos = m.coposMax;
      S.passo(m, m.cartas ? { mx: 0, my: 0, carta: i % 3 } : S.direcao(1 + (Math.floor(i / 120) % 8)));
      pico = Math.max(pico, m.moscas.length);
      assert.ok(m.moscas.length <= S.CURVA.tetoVivas, `semente ${s}: ${m.moscas.length} vivas`);
    }
  }
  assert.ok(pico >= 150, `o teto é exercido de verdade (pico ${pico})`);
});

test(`curva: parado morre antes dos 45 s, quem anda em círculo passa dos 70 s (${LONGO ? 100 : 12} sementes)`, () => {
  let parado45 = 0;
  let circulo70 = 0;
  const N = LONGO ? 100 : 12;
  for (let s = 1; s <= N; s++) {
    if (S.segundos(botParado(s * 7919).passo) < 45) parado45++;
    if (S.segundos(botCirculo(s * 7919).m.passo) >= 70) circulo70++;
  }
  assert.ok(parado45 / N >= 0.9, `parado morreu antes de 45 s em ${parado45}/${N}`);
  assert.ok(circulo70 / N >= 0.6, `círculo passou de 70 s em ${circulo70}/${N}`);
  if (LONGO) console.log(`   parado < 45 s: ${parado45}/${N} · círculo ≥ 70 s: ${circulo70}/${N}`);
});

test('rainha e vitória: ela chega aos 85 s, as 3 fases andam, matá-la vence (+500), e quem dura 100 s também vence', () => {
  // Garçom imortal com todas as armas no máximo: a rainha chega no passo 5.100 e morre antes do fim.
  const forte = () => {
    const m = S.novaMoscaria(31337);
    for (const a of S.ARMAS) m.armas[a] = S.NIVEL_MAX_ARMA;
    return m;
  };
  const m = forte();
  let chegou = -1;
  const fases = new Set();
  for (let i = 0; i < S.PASSOS_RUN * 2 && !m.fim; i++) {
    m.copos = m.coposMax;
    // Anda girando; quando a rainha chega, vai atrás dela.
    const q = m.moscas.find((f) => f.tipo === 'rainha');
    const dir = q ? S.direcao(S.quantizar(q.x - m.x, q.y - m.y)) : S.direcao(1 + (Math.floor(i / 120) % 8));
    S.passo(m, m.cartas ? { mx: 0, my: 0, carta: 0 } : dir);
    if (chegou < 0 && m.ev.some((e) => e.k === 'rainha')) chegou = m.passo;
    const r = m.moscas.find((f) => f.tipo === 'rainha');
    if (r) fases.add(r.vida > (S.MOSCAS.rainha.vida * 2) / 3 ? 1 : r.vida > S.MOSCAS.rainha.vida / 3 ? 2 : 3);
  }
  assert.equal(chegou, Math.round(S.CURVA.rainhaEm / S.DT), 'chegada da rainha: passo 5.100 (85 s)');
  assert.equal(m.fim, 'venceu');
  assert.equal(m.rainhaMorta, true);
  assert.ok(m.passo < S.PASSOS_RUN, `matou antes do fim (passo ${m.passo})`);
  assert.deepEqual([...fases].sort(), [1, 2, 3], 'passou pelas 3 fases');
  const semBonus = Math.floor(m.pontos + Math.floor(m.passosCheio * S.DT) * 5);
  assert.equal(S.pontuacao(m), semBonus + 500);
  // Sem arma nenhuma ninguém mata a rainha: imortal, a run vence por tempo no passo 6.000 exato.
  const t = S.novaMoscaria(31337);
  for (let i = 0; i < S.PASSOS_RUN * 2 && !t.fim; i++) {
    t.copos = t.coposMax;
    t.armas = {};
    S.passo(t, t.cartas ? { mx: 0, my: 0, carta: 0 } : S.PARADO);
  }
  assert.equal(t.fim, 'venceu');
  assert.equal(t.rainhaMorta, false);
  assert.equal(t.passo, S.PASSOS_RUN);
  // Deve falhar: sem copo, perde (e não vence por tempo).
  const p = botParado(31337);
  assert.equal(p.fim, 'perdeu');
  assert.ok(p.passo < S.PASSOS_RUN);
});

test('prêmio sobe com os pontos: moeda e sorteios nunca caem quando a pontuação sobe', () => {
  for (const venceu of [false, true])
    for (const rainha of [false, true]) {
      let antes = -1;
      for (let p = 0; p <= 5000; p += 7) {
        const v = P.moedaMoscas(p, venceu, rainha);
        assert.ok(v >= antes, `moeda caiu em ${p}`);
        antes = v;
      }
    }
  assert.equal(P.moedaMoscas(0, false, false), 0);
  assert.equal(P.moedaMoscas(500, true, true), 100 + 20 + 40);
  // Sem teto (decisão do dono): 10 mil pontos pagam 2 mil.
  assert.equal(P.moedaMoscas(10000, false, false), 2000);
  let s0 = -1;
  for (let p = 0; p <= 200; p++) {
    const s = P.sorteiosDaRun(p, false, 0);
    assert.ok(s >= s0);
    s0 = s;
  }
  assert.equal(P.sorteiosDaRun(40, true, 0), 2);
  assert.equal(P.sorteiosDaRun(39, false, 0), 0);
  // Depois de 3 runs no dia, nada de sorteio (a moeda segue).
  assert.equal(P.sorteiosDaRun(9999, true, P.RUNS_COM_SORTEIO), 0);
});

/* ------------------------------------------------------------------ portal */

test('portal do dia: determinístico e nunca repete o de ontem numa lista de 3', () => {
  const lista = ['a', 'b', 'c'];
  for (let d = 20000; d < 21000; d++) {
    assert.equal(P.portalDoDia(d, lista), P.portalDoDia(d, lista));
    assert.notEqual(P.portalDoDia(d, lista), P.portalDoDia(d - 1, lista), `dia ${d}`);
  }
  const conta = { a: 0, b: 0, c: 0 };
  for (let d = 20000; d < 23000; d++) conta[P.portalDoDia(d, lista)]++;
  for (const k of lista) assert.ok(conta[k] > 700, `${k} saiu ${conta[k]} vezes em 3000 dias`);
  // Com um portal só, é ele todo dia.
  assert.equal(P.portalDoDia(20500, P.PORTAIS_DO_DIA), 'moscas');
  assert.equal(P.sementeDoDia(20500, 'moscas'), P.sementeDoDia(20500, 'moscas'));
  assert.notEqual(P.sementeDoDia(20500, 'moscas'), P.sementeDoDia(20501, 'moscas'));
});

test('espera de 5 min entre entradas, pelo relógio simulado', () => {
  const T = 1_800_000_000_000;
  assert.equal(P.podeEntrar(0, T), true);
  assert.equal(P.podeEntrar(T, T + P.ESPERA_MS - 1), false);
  assert.equal(P.podeEntrar(T, T + P.ESPERA_MS), true);
  assert.equal(P.podeEntrar(Number.NaN, T), true);
});

test('pity: 100 mil jogadores simulados têm Raro ou melhor até o 15º sorteio; sem pity, não', () => {
  const rng = (s) => () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const r = rng(1234);
  let falhaCom = 0;
  let falhaSem = 0;
  for (let j = 0; j < 100_000; j++) {
    for (const comPity of [true, false]) {
      let p = P.PITY_ZERO;
      let achou = false;
      for (let k = 0; k < 15 && !achou; k++) {
        const x = P.sortearPremio('moscas', p, new Set(), r(), r(), comPity);
        p = x.pity;
        if (x.s.raridade === 'raro' || x.s.raridade === 'lendario') achou = true;
      }
      if (!achou) comPity ? falhaCom++ : falhaSem++;
    }
  }
  assert.equal(falhaCom, 0);
  // Deve falhar sem pity: (0,92)^15 ≈ 28,6 % dos jogadores ficam sem Raro.
  assert.ok(falhaSem > 25_000 && falhaSem < 32_000, `sem pity: ${falhaSem}`);
  // Contador forçado em 14: o 15º é Raro (ou Lendário) com qualquer sorteio; sem pity, o mesmo sorteio dá Comum.
  for (const x of [0.02, 0.5, 0.99]) assert.ok(['raro', 'lendario'].includes(P.raridade({ semRaro: 14, semLendario: 14 }, x)));
  assert.equal(P.raridade({ semRaro: 14, semLendario: 14 }, 0.99, false), 'comum');
  // Lendário garantido no 60º.
  assert.equal(P.raridade({ semRaro: 0, semLendario: 59 }, 0.99), 'lendario');
  // Sem pity a tabela é 70/22/7/1 (±1 ponto em 100 mil).
  const t = { comum: 0, incomum: 0, raro: 0, lendario: 0 };
  for (let j = 0; j < 100_000; j++) t[P.raridade(P.PITY_ZERO, r(), false)]++;
  for (const k of P.RARIDADES) assert.ok(Math.abs(t[k] / 1000 - P.CHANCE[k] * 100) < 1, `${k}: ${t[k] / 1000} %`);
});

test('repetido vira Pó; comprar com Pó tira 40 e destrava a cor; o resto recusa', () => {
  const tem = new Set(P.PREMIOS.map((x) => x.id));
  const x = P.sortearPremio('moscas', P.PITY_ZERO, tem, 0.9, 0.1);
  assert.equal(x.s.repetido, true);
  assert.equal(x.s.po, P.PO_REPETIDO[x.s.raridade]);
  let inv = I.limparInventario({ itens: [], po: { g: 45, s: 0 } });
  assert.equal(I.saldoPo(inv), 45);
  const novo = I.comprarComPo(inv, 'mc-cabelo-coroa');
  assert.ok(novo);
  assert.equal(I.saldoPo(novo), 5);
  assert.ok(I.coresLiberadas(novo).has('#fff07a'));
  assert.equal(I.comprarComPo(novo, 'mc-camisa-verde'), null, 'sem saldo');
  inv = I.limparInventario({ itens: ['mc-camisa-verde'], po: { g: 100, s: 0 } });
  assert.equal(I.comprarComPo(inv, 'mc-camisa-verde'), null, 'já tem');
  assert.equal(I.comprarComPo(inv, 'inventado'), null, 'item que não existe');
  // Cor de prêmio não liberada para quem não tem.
  assert.equal(I.coresLiberadas(I.limparInventario(null)).size, 0);
});

test('inventário: limpar descarta lixo, e juntar aparelho com banco só cresce', () => {
  const lixo = I.limparInventario({ itens: ['mc-camisa-verde', 7, 'xx', 'mc-camisa-verde'], po: { g: -5, s: 99 }, pity: { semRaro: 'a' } });
  assert.deepEqual(lixo.itens, ['mc-camisa-verde']);
  assert.deepEqual(lixo.po, { g: 0, s: 0 });
  assert.equal(lixo.pity.semRaro, 0);
  const a = I.limparInventario({ itens: ['mc-camisa-verde'], po: { g: 30, s: 10 }, runs: { dia: '20500', n: { moscas: 2 } }, ultima: { moscas: 500 } });
  const b = I.limparInventario({ itens: ['mc-cabelo-asa'], po: { g: 50, s: 0 }, runs: { dia: '20499', n: { moscas: 3 } }, ultima: { moscas: 900 } });
  for (const j of [I.juntar(a, b), I.juntar(b, a)]) {
    assert.deepEqual([...j.itens].sort(), ['mc-cabelo-asa', 'mc-camisa-verde']);
    assert.equal(j.po.g, 50);
    assert.equal(j.po.s, 10);
    assert.equal(j.runs.dia, '20500');
    assert.equal(j.ultima.moscas, 900);
  }
  assert.equal(I.runsHoje(a, '20500', 'moscas'), 2);
  assert.equal(I.runsHoje(a, '20501', 'moscas'), 0);
});

test('fantasma: grava e lê de volta com erro ≤ 0,05; uma run inteira cabe em 2.400 caracteres; lixo vira vazio', () => {
  const pts = [];
  for (let i = 0; i <= S.PASSOS_RUN; i += P.FANTASMA_PASSOS) pts.push({ x: (i / S.PASSOS_RUN) * S.CURVA.largura, y: (i % 440) / 10 });
  const txt = P.gravarFantasma(pts);
  assert.ok(txt.length <= P.FANTASMA_MAX && /^[0-9a-z]*$/.test(txt));
  assert.equal(txt.length, pts.length * 4);
  const lido = P.lerFantasma(txt);
  assert.equal(lido.length, pts.length);
  for (let i = 0; i < pts.length; i++) {
    assert.ok(Math.abs(lido[i].x - pts[i].x) <= 0.05 && Math.abs(lido[i].y - pts[i].y) <= 0.05);
  }
  for (const ruim of ['abc', 'ZZZZ', 12, null, '0'.repeat(2404), 'a-bc']) assert.deepEqual(P.lerFantasma(ruim), []);
  // O que a tela grava numa run inteira (uma amostra a cada 12 passos) cabe no limite.
  assert.ok((S.PASSOS_RUN / P.FANTASMA_PASSOS + 1) * 4 <= P.FANTASMA_MAX);
});

test('regras: prêmio gravado uma vez, Pó que só sobe (gasto ≤ ganho), placar do dia que só sobe e recomeça no dia novo', () => {
  const R = mockRules;
  const now = 1_800_000_300_000;
  const sod = now - ((now - 32400000) % 86400000);
  const inv = (p, i) => ['cruzadabotecos', 'bar', 'inventario', p, i];
  // Todo prêmio do catálogo passa na regra; item inventado, jogador de fora e valor que não é a hora do servidor, não.
  for (const x of P.PREMIOS) assert.equal(R.allowed({}, inv('will', x.id), now, now), true, x.id);
  assert.equal(R.allowed({}, inv('will', 'mc-camisa-falsa'), now, now), false);
  assert.equal(R.allowed({}, inv('zeca', 'mc-camisa-verde'), now, now), false);
  assert.equal(R.allowed({}, inv('will', 'mc-camisa-verde'), now - 1, now), false);
  const comItem = R.setAt({}, inv('will', 'mc-camisa-verde'), now - 5000);
  assert.equal(R.allowed(comItem, inv('will', 'mc-camisa-verde'), now, now), false, 'regravar o mesmo prêmio');
  assert.equal(R.allowed(comItem, inv('will', 'mc-camisa-verde'), null, now), false, 'apagar prêmio');
  const po = ['cruzadabotecos', 'bar', 'po', 'will'];
  assert.equal(R.allowed({}, po, { g: 10, s: 0, t: now }, now), true);
  assert.equal(R.allowed({}, po, { g: 10, s: 11, t: now }, now), false, 'gasto maior que o ganho');
  const comPo = R.setAt({}, po, { g: 50, s: 40, t: now - 1000 });
  assert.equal(R.allowed(comPo, po, { g: 53, s: 40, t: now }, now), true);
  assert.equal(R.allowed(comPo, po, { g: 49, s: 40, t: now }, now), false, 'ganho desceu');
  assert.equal(R.allowed(comPo, po, { g: 50, s: 39, t: now }, now), false, 'gasto desceu (devolveria o Pó)');
  assert.equal(R.allowed(R.setAt({}, po, { g: 50, s: 40, t: now - 100 }), po, { g: 60, s: 40, t: now }, now), false, 'menos de 500 ms');
  const pl = ['cruzadabotecos', 'bar', 'portais', 'moscas', 'will'];
  const f = P.gravarFantasma([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
  assert.equal(R.allowed({}, pl, { s: 300, f, v: 1, t: now }, now), true);
  assert.equal(R.allowed({}, pl, { s: 300, f: f + 'a', v: 1, t: now }, now), false, 'fantasma torto');
  assert.equal(R.allowed({}, pl, { s: 300, f: 'a'.repeat(2404), v: 1, t: now }, now), false, 'fantasma grande demais');
  assert.equal(R.allowed({}, pl, { s: 300, f, v: 1, t: now, x: 1 }, now), false, 'campo a mais');
  const ontem = R.setAt({}, pl, { s: 900, f, v: 1, t: sod - 1 });
  assert.equal(R.allowed(ontem, pl, { s: 10, f, v: 1, t: now }, now), true, 'dia novo recomeça');
  const hoje = R.setAt({}, pl, { s: 900, f, v: 1, t: sod + 1 });
  assert.equal(R.allowed(hoje, pl, { s: 10, f, v: 1, t: now }, now), false, 'no mesmo dia não baixa');
  assert.equal(R.allowed(hoje, pl, { s: 901, f, v: 1, t: now }, now), true);
  // O arquivo do console diz o mesmo.
  const regras = JSON.parse(ler('database.rules.json')).rules.cruzadabotecos.bar;
  // A lista fechada de prêmios do console é exatamente o catálogo (portal novo exige regra nova).
  assert.ok(regras.inventario.$player.$item['.write'].includes(`$item.matches(/^(${P.PREMIOS.map((x) => x.id).join('|')})$/)`));
  assert.match(regras.po.$player['.validate'], /child\('s'\)\.val\(\) <= newData\.child\('g'\)\.val\(\)/);
  assert.match(regras.portais.$portal.$player['.write'], /data\.child\('t'\)\.val\(\) < \(now - \(\(now - 32400000\) % 86400000\)\)/);
  assert.match(regras.portais.$portal.$player.f['.validate'], /length <= 2400 && newData\.val\(\)\.length % 4 === 0/);
  assert.equal(P.VERSAO_MOSCAS, S.VERSAO, 'a versão do portal é a da simulação');
});

test('a tela não recomeça o laço quando o bar redesenha (visual e fantasmas fixos na abertura)', () => {
  const src = ler('src/portais/moscas/MoscasTela.tsx');
  assert.match(src, /const \[look\] = useState\(lookProp\);/);
  assert.match(src, /const \[fantasmas\] = useState\(fantasmasProp\);/);
  const vivo = ler('src/vivo/VivoScreen.tsx');
  assert.match(vivo, /fantasmas=\{fantasmasMc\}/);
  assert.doesNotMatch(vivo, /fantasmas=\{\[\]\}/);
});

test('o gancho de teste da tela só existe em desenvolvimento', () => {
  const src = ler('src/portais/moscas/MoscasTela.tsx');
  const i = src.indexOf('__moscas = {');
  assert.ok(i > 0);
  assert.match(src.slice(Math.max(0, i - 200), i), /if \(import\.meta\.env\.DEV\)/);
});

console.log(`\n${n} testes da Moscaria passaram`);
