// Testes da Fatia 20 (NPC com memória e terceiro portal, sem PWA): memória do NPC (curativo, apelido, reconhecimento,
// leitura sem confiar), Churrasco Jurássico (pista determinística, toda pista vencível por um robô sem dano, pulo
// com folga, lava, pterodáctilo e picanha), economia do portal, regras novas e a ligação no jogo.
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
const tem = (s, re) => assert.ok(re.test(s), `falta no código: ${re}`);
const Me = await import('../src/vivo/memoria.ts');
const C = await import('../src/portais/churrasco/sim.ts');
const P = await import('../src/portais/portal.ts');
const E = await import('../src/vivo/eventos.ts');

let n = 0;
const test = async (nome, fn) => {
  await fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};
const DIA = 86_400_000;

/* ------------------------------------------------------------------ memória dos NPCs */

await test('memória: 1 nocaute dá curativo (some em 7 dias), 3 dão apelido que fica; registrar não muda a memória antiga', () => {
  let m = {};
  assert.deepEqual(Me.estadoNpc(m, 'biriba', 0), { n: 0, curativo: false, apelido: null });
  const m1 = Me.registrarNocaute(m, 'biriba', 1000);
  assert.deepEqual(m, {});
  assert.deepEqual(Me.estadoNpc(m1, 'biriba', 2000), { n: 1, curativo: true, apelido: null });
  assert.equal(Me.estadoNpc(m1, 'biriba', 1000 + Me.CICATRIZ_MS - 1).curativo, true);
  assert.equal(Me.estadoNpc(m1, 'biriba', 1000 + Me.CICATRIZ_MS).curativo, false);
  m = Me.registrarNocaute(Me.registrarNocaute(m1, 'biriba', 5000), 'biriba', 9000);
  const e = Me.estadoNpc(m, 'biriba', 9000 + 30 * DIA);
  assert.equal(e.n, 3);
  assert.equal(e.curativo, false);
  assert.equal(e.apelido, Me.apelidoDe('biriba'));
  assert.ok(Me.APELIDOS.includes(e.apelido));
  assert.equal(Me.estadoNpc(m, 'tiozao', 0).n, 0); // um NPC não herda a memória do outro
  // O apelido é o mesmo em qualquer aparelho (pelo id) e os NPCs não ficam todos iguais.
  assert.equal(Me.apelidoDe('biriba'), Me.apelidoDe('biriba'));
  assert.ok(new Set(['biriba', 'tiozao', 'juninho', 'marrento', 'cabeca', 'mano'].map(Me.apelidoDe)).size >= 3);
});

await test('memória: reconhece só de perto, de pé, quem já apanhou, no máximo a cada 90 s; a fala cita o apelido', () => {
  const e1 = { n: 1, curativo: true, apelido: null };
  const e3 = { n: 3, curativo: false, apelido: 'Queixo de Vidro' };
  assert.equal(Me.deveReconhecer({ n: 0, curativo: false, apelido: null }, 1, true, -1e15, 0), false);
  assert.equal(Me.deveReconhecer(e1, Me.RECONHECE_RAIO, true, -1e15, 0), true);
  assert.equal(Me.deveReconhecer(e1, Me.RECONHECE_RAIO + 0.01, true, -1e15, 0), false);
  assert.equal(Me.deveReconhecer(e1, 1, false, -1e15, 0), false);
  assert.equal(Me.deveReconhecer(e1, 1, true, 0, Me.RECONHECE_ESPERA_MS - 1), false);
  assert.equal(Me.deveReconhecer(e1, 1, true, 0, Me.RECONHECE_ESPERA_MS), true);
  for (let s = 0; s < 200; s++) {
    const f = Me.falaReconhece(e3, E.rng(s));
    assert.ok(f && !f.includes('{a}'));
    if (f.includes('apelido') === false) assert.ok(f.includes('Queixo de Vidro'), f);
    assert.ok(Me.FALAS_RECONHECE.poucas.includes(Me.falaReconhece(e1, E.rng(s))));
  }
  assert.equal(Me.falaReconhece({ n: 0, curativo: false, apelido: null }, E.rng(1)), null);
});

await test('memória do localStorage: lixo vira vazio; entradas tortas saem, as boas ficam', () => {
  assert.deepEqual(Me.sanitizeMemoria(null), {});
  assert.deepEqual(Me.sanitizeMemoria('oi'), {});
  const m = Me.sanitizeMemoria({
    biriba: { n: 2, ultimo: 50 },
    tiozao: { n: 0, ultimo: 5 },
    juninho: { n: 1.5, ultimo: 5 },
    mano: { n: 1, ultimo: -1 },
    'Nome Com Espaço': { n: 1, ultimo: 1 },
    cabeca: { n: 1e9, ultimo: 1 },
    marrento: 'x',
  });
  assert.deepEqual(m, { biriba: { n: 2, ultimo: 50 } });
});

/* ------------------------------------------------------------------ Churrasco Jurássico */

/** Robô: pula no último quadro em que pular agora ainda passa limpo pelo que vem (testa o futuro numa cópia). */
function robo(c) {
  const limpo = (pulaEm) => {
    const k = structuredClone(c);
    const d0 = k.danos;
    for (let i = 0; i < 90 && !k.acabou; i++) passo(k, i === pulaEm);
    return k.danos === d0;
  };
  const passo = (k, p) => C.passoC(k, p);
  if (!c.noChao) return false;
  // Se seguir sem pular por 1 s não machuca, não pula.
  if (limpo(-1)) return false;
  // Pula agora se pular no próximo quadro já não dá.
  return limpo(0) && !limpo(1) ? true : !limpo(1) && limpo(0);
}

await test('pista: mesma semente, mesma pista; itens em ordem; nada fora da corrida; semente diferente muda', () => {
  const a = C.pista(123);
  assert.deepEqual(a, C.pista(123));
  assert.notDeepEqual(a.map((i) => i.tipo), C.pista(124).map((i) => i.tipo));
  for (let i = 1; i < a.length; i++) assert.ok(a[i].x >= a[i - 1].x, 'fora de ordem');
  assert.ok(a.every((i) => i.x > 10 && i.x + i.w < C.FIM_X));
  for (const t of ['osso', 'lava', 'ptero', 'picanha']) assert.ok(a.some((i) => i.tipo === t), t);
});

await test('toda pista dá para vencer: o robô termina 150 pistas sorteadas sem tomar dano', () => {
  let tempo = 0;
  let pontos = 0;
  let max = 0;
  for (let s = 1; s <= 150; s++) {
    const c = C.novaCorrida(s * 2654435761);
    for (let i = 0; i < 60 * 200 && !c.acabou; i++) C.passoC(c, robo(c));
    assert.equal(c.venceu, true, `pista ${s} não terminou`);
    assert.equal(c.danos, 0, `pista ${s}: robô tomou dano`);
    tempo += c.t;
    pontos += C.pontosDe(c);
    max = Math.max(max, C.pontosDe(c));
  }
  console.log(`  corrida perfeita: ${(tempo / 150).toFixed(1)} s, ${Math.round(pontos / 150)} pontos (máx. ${max})`);
  assert.ok(tempo / 150 > 50 && tempo / 150 < 90, 'duração fora do alvo');
});

await test('sem apertar nada, o churrasqueiro perde os 3 espetos e a corrida acaba antes da churrasqueira', () => {
  const c = C.novaCorrida(77);
  let ev = [];
  for (let i = 0; i < 60 * 200 && !c.acabou; i++) ev = ev.concat(C.passoC(c, false));
  assert.equal(c.acabou, true);
  assert.equal(c.venceu, false);
  assert.equal(c.vidas, 0);
  assert.ok(c.x < C.FIM_X);
  assert.ok(ev.some((e) => e.k === 'bateu' || e.k === 'caiu'));
  assert.equal(ev.filter((e) => e.k === 'fim').length, 1);
});

await test('pulo: sobe ~2,2 e fica ~0,68 s no ar; aperto antes de pousar vale (buffer); pulo no ar não dobra', () => {
  const c = C.novaCorrida(1);
  c.itens = [];
  C.passoC(c, true);
  let topo = 0;
  let quadros = 1;
  while (!c.noChao) {
    C.passoC(c, false);
    topo = Math.max(topo, c.y);
    quadros++;
  }
  assert.ok(Math.abs(topo - (C.PULO_V * C.PULO_V) / (2 * C.GRAV)) < 0.15, `topo ${topo}`);
  assert.ok(Math.abs(quadros / 60 - C.AR_S) < 0.05);
  // Pulo duplo: apertar no ar não sobe de novo.
  C.passoC(c, true);
  for (let i = 0; i < 20; i++) C.passoC(c, false);
  const vyAntes = c.vy;
  C.passoC(c, true);
  assert.ok(c.vy <= vyAntes);
  // Buffer: aperto 5 quadros antes de pousar pula assim que pousa.
  const b = C.novaCorrida(1);
  b.itens = [];
  C.passoC(b, true);
  let i = 0;
  while (b.y > 0.5 || b.vy > 0) (C.passoC(b, false), i++);
  C.passoC(b, true);
  let pulou = false;
  for (let k = 0; k < 12; k++) if (C.passoC(b, false).some((e) => e.k === 'pulo')) pulou = true;
  assert.ok(pulou, 'buffer não pulou');
});

await test('lava tira 1 espeto e põe do outro lado; pterodáctilo pega quem pula; picanha soma 5 pontos uma vez só', () => {
  const lava = C.novaCorrida(1);
  lava.itens = [{ id: 0, tipo: 'lava', x: 2, w: 1.5, y0: -1, y1: 0 }];
  const ev = [];
  for (let i = 0; i < 60; i++) ev.push(...C.passoC(lava, false));
  assert.equal(lava.vidas, C.VIDAS - 1);
  assert.ok(ev.some((e) => e.k === 'caiu'));
  assert.ok(lava.x > 3.5);
  const pt = C.novaCorrida(1);
  pt.itens = [{ id: 0, tipo: 'ptero', x: 3, w: 1, y0: C.PTERO_Y[0], y1: C.PTERO_Y[1] }];
  for (let i = 0; i < 60; i++) C.passoC(pt, false);
  assert.equal(pt.vidas, C.VIDAS, 'por baixo do pterodáctilo não machuca');
  const pt2 = C.novaCorrida(1);
  pt2.itens = [{ id: 0, tipo: 'ptero', x: 3, w: 1, y0: C.PTERO_Y[0], y1: C.PTERO_Y[1] }];
  for (let i = 0; i < 60; i++) C.passoC(pt2, i === 18);
  assert.equal(pt2.vidas, C.VIDAS - 1, 'pulando nele machuca');
  const ca = C.novaCorrida(1);
  ca.itens = [{ id: 0, tipo: 'picanha', x: 2, w: 0.4, y0: 0.2, y1: 0.6 }];
  for (let i = 0; i < 60; i++) C.passoC(ca, false);
  assert.equal(ca.picanhas, 1);
  assert.equal(C.pontosDe(ca), Math.floor(ca.x / 10) + 5);
  // O que se vê é o que bate: a caixa do corpo cobre o desenho do cozinheiro (chapéu no topo, 29 px), o pterodáctilo
  // fica acima dela (passar por baixo não encosta nem na tela) e a picanha alta só vem com pulo.
  const tela = ler('src/portais/churrasco/ChurrascoTela.tsx');
  const topo = Math.max(...[...tela.matchAll(/px\(x \+ \d+, y - (\d+),/g)].map((m) => Number(m[1])));
  assert.equal(topo, 29, 'topo do chapéu');
  assert.ok(C.ALT * 16 >= topo, 'caixa do corpo cobre o desenho');
  assert.ok(C.PTERO_Y[0] > C.ALT, 'pterodáctilo acima de quem só corre');
  assert.ok(C.PICANHA_ALTA[0] > C.ALT, 'picanha alta não vem sem pulo');
  const alto = C.novaCorrida(1);
  alto.itens = [{ id: 0, tipo: 'picanha', x: 3, w: 0.4, y0: C.PICANHA_ALTA[0], y1: C.PICANHA_ALTA[1] }];
  for (let i = 0; i < 60; i++) C.passoC(alto, false);
  assert.equal(alto.picanhas, 0, 'correndo não pega a picanha alta');
});

await test('portal: Churrasco entra no rodízio do dia; prêmios novos; moeda e sorteio do portal', async () => {
  assert.ok(P.PORTAIS_DO_DIA.includes('churrasco'));
  assert.equal(P.NOME_PORTAL.churrasco, 'Churrasco Jurássico');
  const meus = P.PREMIOS.filter((x) => x.portal === 'churrasco');
  assert.ok(meus.length >= 5);
  for (const r of ['comum', 'incomum', 'raro', 'lendario']) assert.ok(meus.some((x) => x.raridade === r), r);
  assert.equal(new Set(P.PREMIOS.map((x) => x.id)).size, P.PREMIOS.length);
  // Em 3000 dias, os 3 portais aparecem e nunca o mesmo dois dias seguidos.
  const visto = new Set();
  for (let d = 20000; d < 23000; d++) {
    const h = P.portalDoDia(d, P.PORTAIS_DO_DIA);
    visto.add(h);
    assert.notEqual(h, P.portalDoDia(d - 1, P.PORTAIS_DO_DIA));
  }
  assert.equal(visto.size, 3);
  assert.equal(P.moedaDoPortal('churrasco', 90, true), 30 + 20);
  assert.equal(P.moedaDoPortal('churrasco', 0, false), 0);
  assert.equal(P.sorteiosDaRun(P.LIMIAR_SORTEIO.churrasco, false, 0, 'churrasco'), 1);
  assert.equal(P.sorteiosDaRun(P.LIMIAR_SORTEIO.churrasco - 1, false, 0, 'churrasco'), 0);
  assert.equal(P.VERSAO_PORTAL.churrasco, C.VERSAO);
  // Cada cor de prêmio novo existe na lista do Visual da peça, no fim (o índice das antigas não muda).
  const V = await import('../src/vivo/visual.ts');
  const lista = { camisa: V.CAMISAS, calca: V.CALCAS, cabelo: V.CABELOS };
  for (const x of meus) {
    const l = lista[x.peca];
    assert.ok(l.indexOf(x.cor) >= l.length - 2, `${x.id} fora do fim da lista`);
    assert.ok(l.length <= 36, 'lista maior que um dígito de base 36');
  }
});

await test('regras: o portal e os prêmios novos entram no banco e no espelho', async () => {
  const regras = ler('database.rules.json');
  tem(regras, /\(moscas\|quermesse\|churrasco\)/);
  for (const x of P.PREMIOS.filter((p) => p.portal === 'churrasco')) tem(regras, new RegExp(x.id));
  const R = await import('./mock-rules.mjs');
  const now = Date.UTC(2026, 10, 27, 15);
  assert.equal(R.allowed({}, ['cruzadabotecos', 'bar', 'portais', 'churrasco', 'will'], { s: 40, t: now, f: '', v: 1 }, now), true);
  assert.equal(R.allowed({}, ['cruzadabotecos', 'bar', 'portais', 'churrasqueira', 'will'], { s: 40, t: now, f: '', v: 1 }, now), false);
});

await test('o jogo liga a fatia: memória no nocaute, curativo, apelido, reconhecimento, tela do portal', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  tem(v, /if \(e\.de === eu\(m\)\.id && NPCS\.some\(\(n\) => n\.id === e\.em\)\)/);
  tem(v, /memoria\.current = registrarNocaute\(memoria\.current, e\.em, ago\);/);
  tem(v, /salvarMemoria\(player, memoria\.current\);/);
  // O curativo vai na passada do corpo (o que está na frente cobre), não por cima de tudo; de costas e deitado, não.
  tem(v, /if \(c\.quem === 'npc' && !deitado && !cai && !facing\(c\.fx, c\.fy\)\.back && estadoNpc\(memoria\.current, c\.id, Date\.now\(\)\)\.curativo\)\n\s*desenharCurativo\(/);
  assert.ok(v.indexOf('desenharCurativo(Math.round') > v.indexOf('else putForma(sp, qc.x, qc.y - ergue, es.sx, es.sy);'), 'curativo depois do corpo');
  assert.ok(v.indexOf('desenharCurativo(Math.round') > v.indexOf('const lista: D[] = [];'), 'curativo dentro da lista ordenada');
  assert.equal(Me.CURATIVO_ALT, 24);
  tem(v, /if \(est\?\.apelido\)/);
  tem(v, /deveReconhecer\(est,/);
  tem(v, /portalAberto === 'churrasco' &&/);
  tem(v, /VERSAO_PORTAL\[/);
  // O rádio continua narrando o nocaute de outro (o if da memória vem DEPOIS do if/else do rádio, sem quebrar o par).
  tem(v, /narrar\(narrador\.current, 'ko_eu'[^\n]*\n\s*else \{\n[^\n]*\n\s*if \(nm\) narrar\(narrador\.current, 'ko_outro'[^\n]*\n\s*\}\n\s*\/\/ Fatia 20: o NPC que você derrubou/);
});

console.log(`# fatia 20: ${n} testes`);
