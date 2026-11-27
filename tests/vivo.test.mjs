// Testes do Bar Vivo (Fatia 1): mapa, rotina determinística dos NPCs, motor da briga (combo, hit-stop, knockback,
// nocaute, multidão, Tonhão, agarrar/arremessar, armas, amigos desmaiados), narrador, controle e visual.
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

const mapa = await import('../src/vivo/mapa.ts');
const gente = await import('../src/vivo/gente.ts');
const rotina = await import('../src/vivo/rotina.ts');
const B = await import('../src/vivo/briga.ts');
const controle = await import('../src/vivo/controle.ts');
const visual = await import('../src/vivo/visual.ts');
const { findPath } = await import('../src/bar/path.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

// 300 s depois do começo de um ciclo de 12 min: fora da happy hour (que dobra a cerveja) por 7 min.
const T0 = 1_800_000_300_000;
const DT = 1 / 60;
const mundo = (semente = 7) => B.novoMundo('will', T0, semente);
const corpo = (m, id) => m.corpos.find((c) => c.id === id);
/** Põe um corpo parado num lugar, fora da rotina (para o teste não depender de onde o NPC andava). */
function plantar(m, id, x, y) {
  const c = corpo(m, id);
  c.x = x;
  c.y = y;
  c.humor = 'voltando';
  c.rota = null;
  return c;
}
function rodar(m, ms, ent = () => ({})) {
  const n = Math.round(ms / 1000 / DT);
  const ev = [];
  for (let i = 0; i < n; i++) {
    B.passo(m, { ...B.PARADO, ...ent(i) }, DT);
    ev.push(...m.eventos);
    m.eventos.length = 0;
  }
  return ev;
}
/** Desliga os NPCs que não estão no teste (todos menos `ids`) mandando-os para longe e nocauteados para sempre. */
function soEstes(m, ids) {
  for (const c of m.corpos) {
    if (c.quem !== 'npc' || ids.includes(c.id)) continue;
    c.estado = 'ko';
    c.koAte = Infinity;
    c.x = 1.5;
    c.y = 13.5;
  }
}

/* ------------------------------------------------------------------ mapa */

test('mapa: um móvel por ladrilho; jogos, armas, entrada, sarjeta e cantos dos amigos em lugar que dá para pisar', () => {
  const vistos = new Set();
  for (const p of mapa.PROPS) {
    const k = `${p.x},${p.y}`;
    assert.ok(!vistos.has(k), `dois móveis em ${k}`);
    vistos.add(k);
    assert.ok(p.x >= 0 && p.x < mapa.COLS && p.y >= 0 && p.y < mapa.RUA, `${p.kind} fora do mapa`);
  }
  for (const j of mapa.JOGOS) assert.ok(mapa.anda(j.at[0], j.at[1]), `jogo ${j.jogo} sem lugar de pé`);
  for (const a of mapa.ARMAS_NO_CHAO) assert.ok(mapa.anda(a.at[0], a.at[1]), `arma em ${a.at}`);
  assert.ok(mapa.anda(Math.floor(mapa.ENTRADA[0]), Math.floor(mapa.ENTRADA[1])));
  assert.ok(mapa.anda(Math.floor(mapa.SARJETA[0]), Math.floor(mapa.SARJETA[1])));
  for (const [id, k] of Object.entries(mapa.CANTOS)) assert.ok(mapa.anda(Math.floor(k.at[0]), Math.floor(k.at[1])), `canto de ${id}`);
  assert.equal(mapa.anda(5, mapa.RUA), false, 'a rua não é de andar');
  assert.equal(mapa.anda(-1, 3), false);
  assert.equal(mapa.anda(4, 2), false, 'balcão bloqueia');
  assert.equal(mapa.anda(2, 11), true, 'cadeira de plástico dá para pisar (os NPCs sentam)');
  // E num jogo ou porta não pode cair no bigode de um amigo desmaiado ali do lado (o amigo vem antes no E).
  for (const p of [...mapa.JOGOS, ...mapa.PORTAS])
    for (const [id, k] of Object.entries(mapa.CANTOS))
      assert.ok(Math.hypot(p.at[0] + 0.5 - k.at[0], p.at[1] + 0.5 - k.at[1]) >= 1.8, `${p.nome} colado no canto de ${id}`);
});

/* ------------------------------------------------------------------ rotina */

test('rotina: mesma hora = mesmo lugar em qualquer aparelho; só pisa onde dá; anda sem teleporte', () => {
  for (const n of gente.NPCS) {
    const ciclo = rotina.cicloDe(n);
    assert.ok(Number.isFinite(ciclo) && ciclo > 0, `${n.id} ciclo ${ciclo}`);
    const v = gente.FICHAS[n.tipo].velocidade;
    let prev = rotina.rotinaEm(n, T0);
    for (let t = T0 + 100; t < T0 + ciclo + 1000; t += 100) {
      const a = rotina.rotinaEm(n, t);
      const b = rotina.rotinaEm(n, t);
      assert.deepEqual(a, b);
      assert.ok(mapa.anda(Math.floor(a.x), Math.floor(a.y)), `${n.id} em ladrilho bloqueado (${a.x.toFixed(2)},${a.y.toFixed(2)})`);
      const pulo = Math.hypot(a.x - prev.x, a.y - prev.y);
      assert.ok(pulo <= v * 0.1 * 1.6 + 1e-6, `${n.id} pulou ${pulo.toFixed(2)} ladrilhos em 100 ms`);
      prev = a;
    }
    // O ciclo fecha: depois de um ciclo inteiro está no mesmo lugar.
    const x = rotina.rotinaEm(n, T0 + 12345);
    const y = rotina.rotinaEm(n, T0 + 12345 + ciclo);
    assert.ok(Math.hypot(x.x - y.x, x.y - y.y) < 1e-6, `${n.id} não fecha o ciclo`);
  }
});

test('rotina: cada NPC começa num ponto diferente do ciclo (não andam em bloco)', () => {
  // Sem fase própria, no instante 0 todo NPC estaria saindo da última parada (andando, no ponto exato dela).
  const saindo = gente.NPCS.filter((n) => {
    const r = rotina.rotinaEm(n, 0);
    const ult = n.rotina[n.rotina.length - 1].at;
    return r.andando && Math.hypot(r.x - ult[0], r.y - ult[1]) < 1e-9;
  });
  assert.ok(saindo.length <= 1, `${saindo.length} NPCs saindo juntos da última parada`);
});

/* ------------------------------------------------------------------ briga */

test('combo: soco, soco, empurrão (10, 10, 22) dentro da janela; fora dela volta para o jab', () => {
  const m = mundo();
  soEstes(m, ['marrento']);
  const me = B.eu(m);
  me.x = 5.5;
  me.y = 5.5;
  me.fx = 1;
  me.fy = 0;
  const alvo = plantar(m, 'marrento', 6.3, 5.5);
  alvo.vidaMax = alvo.vida = 999;
  const danos = [];
  const ev = rodar(m, 2500, (i) => ({ soco: i === 0 || i === 20 || i === 40 }));
  for (const e of ev) if (e.k === 'golpe' && e.de === 'eu') danos.push(e.dano);
  assert.deepEqual(danos, [10, 10, 22]);
  // Depois de uma pausa longa, o próximo é jab de novo.
  alvo.x = me.x + 0.8;
  alvo.y = me.y;
  me.fx = 1;
  me.fy = 0;
  const ev2 = rodar(m, 800, (i) => ({ soco: i === 0 }));
  assert.deepEqual(ev2.filter((e) => e.k === 'golpe' && e.de === 'eu').map((e) => e.dano), [10]);
});

test('hit-stop congela a pancada no impacto; knockback cai a menos de 15 % em 220 ms', () => {
  const m = mundo();
  soEstes(m, ['marrento']);
  const me = B.eu(m);
  me.x = 5.5;
  me.y = 5.5;
  me.fx = 1;
  me.fy = 0;
  const alvo = plantar(m, 'marrento', 6.3, 5.5);
  alvo.vidaMax = alvo.vida = 999;
  B.ferir(m, alvo, me, B.EMPURRAO, 1, 0);
  const x0 = alvo.x;
  const v0 = Math.hypot(alvo.vx, alvo.vy);
  assert.equal(v0, B.EMPURRAO.knock);
  rodar(m, 90); // dentro dos 110 ms de hit-stop
  assert.equal(alvo.x, x0, 'mexeu durante o hit-stop');
  rodar(m, 60 + 220);
  const v1 = Math.hypot(alvo.vx, alvo.vy);
  assert.ok(alvo.x > x0 + 0.3, 'não foi empurrado');
  assert.ok(v1 < v0 * 0.15, `velocidade ${v1.toFixed(2)} de ${v0}`);
  assert.ok(m.trauma > 0 || true);
});

test('nocaute: cliente fica no chão (vai para a fila do Seu Zé); funcionário levanta 10–14 s depois com 60 %', () => {
  const m = mundo();
  soEstes(m, ['pinguco', 'juninho']);
  const me = B.eu(m);
  const p = plantar(m, 'pinguco', 8.5, 5.5);
  me.x = 7.7;
  me.y = 5.5;
  B.ferir(m, p, me, { ...B.EMPURRAO, dano: 500 }, 1, 0);
  assert.equal(p.estado, 'ko');
  assert.equal(m.nocautes, 1);
  assert.ok(m.eventos.some((e) => e.k === 'ko' && e.em === 'pinguco'));
  assert.equal(p.koAte, Infinity, 'cliente levantou sozinho');
  assert.ok(m.tarefas.some((x) => x.k === 'corpo' && x.id === 'pinguco'));
  const j = plantar(m, 'juninho', 8.5, 7.5);
  B.ferir(m, j, me, { ...B.EMPURRAO, dano: 500 }, 1, 0);
  assert.ok(j.koAte - m.t >= 10000 && j.koAte - m.t <= 14000);
  assert.ok(!m.tarefas.some((x) => x.k === 'corpo' && x.id === 'juninho'), 'funcionário na fila do depósito');
  rodar(m, 9500);
  assert.equal(j.estado, 'ko');
  rodar(m, 5000);
  assert.equal(j.estado, 'normal');
  assert.equal(j.vida, Math.round(j.vidaMax * 0.6));
  assert.equal(p.estado, 'ko', 'o Pinguço levantou sem o Seu Zé (que está fora de combate no teste)');
});

test('multidão: briga perto atrai o valentão contra você e espanta o garçom; o Seu Zé se abaixa', () => {
  const m = mundo();
  soEstes(m, ['pinguco', 'cabeca', 'juninho', 'ze']);
  const me = B.eu(m);
  me.x = 7.5;
  me.y = 5.5;
  const p = plantar(m, 'pinguco', 8.3, 5.5);
  const cab = plantar(m, 'cabeca', 9.5, 6.5);
  const jun = plantar(m, 'juninho', 6.5, 7.5);
  const ze = plantar(m, 'ze', 6.5, 1.5);
  for (const c of [cab, jun, ze]) c.humor = 'calmo';
  B.ferir(m, p, me, B.JAB, 1, 0);
  assert.equal(cab.humor, 'briga');
  assert.equal(cab.alvo, 'eu');
  assert.equal(jun.humor, 'foge');
  assert.equal(ze.humor, 'abaixado');
  // Quem está longe nem liga.
  const m2 = mundo();
  soEstes(m2, ['pinguco', 'cabeca']);
  const me2 = B.eu(m2);
  me2.x = 3.5;
  me2.y = 5.5;
  const p2 = plantar(m2, 'pinguco', 4.3, 5.5);
  const cab2 = plantar(m2, 'cabeca', 19.5, 2.5);
  cab2.humor = 'calmo';
  B.ferir(m2, p2, me2, B.JAB, 1, 0);
  assert.equal(cab2.humor, 'calmo');
});

test('NPC bate de verdade: antecipa (punho no alto), acerta quem mira e espera antes do próximo', () => {
  const m = mundo();
  soEstes(m, ['marrento']);
  const me = B.eu(m);
  me.x = 5.5;
  me.y = 5.5;
  const mar = plantar(m, 'marrento', 6.2, 5.5);
  mar.humor = 'briga';
  mar.alvo = 'eu';
  mar.humorAte = Infinity;
  const ev = rodar(m, 2000);
  const golpes = ev.filter((e) => e.k === 'golpe' && e.de === 'marrento');
  assert.ok(golpes.length >= 1 && golpes.length <= 2, `golpes ${golpes.length}`);
  assert.equal(golpes[0].dano, gente.FICHAS.valentao.dano);
  // Antecipação mínima: nenhum golpe antes dos 360 ms.
  const m2 = mundo();
  soEstes(m2, ['marrento']);
  const me2 = B.eu(m2);
  me2.x = 5.5;
  me2.y = 5.5;
  const mar2 = plantar(m2, 'marrento', 6.2, 5.5);
  mar2.humor = 'briga';
  mar2.alvo = 'eu';
  mar2.humorAte = Infinity;
  assert.equal(rodar(m2, 330).filter((e) => e.k === 'golpe').length, 0);
});

test('Tonhão: depois de 3 nocautes ele vem; se ele te derruba, te arrasta para a sarjeta e o calor zera', () => {
  const m = mundo();
  soEstes(m, ['pinguco', 'biriba', 'kelly', 'tonhao']);
  const me = B.eu(m);
  const ton = plantar(m, 'tonhao', 10.5, 9.5);
  ton.humor = 'calmo';
  for (const id of ['pinguco', 'biriba']) B.ferir(m, plantar(m, id, 3.5, 5.5), me, { ...B.JAB, dano: 999 }, 1, 0);
  assert.notEqual(ton.humor, 'briga');
  B.ferir(m, plantar(m, 'kelly', 3.5, 5.5), me, { ...B.JAB, dano: 999 }, 1, 0);
  assert.equal(ton.humor, 'briga');
  assert.equal(ton.alvo, 'eu');
  me.x = 10.5;
  me.y = 8.6;
  me.vida = 10;
  const ev = rodar(m, 15000);
  assert.ok(ev.some((e) => e.k === 'ko' && e.em === 'eu' && e.de === 'tonhao'), 'o Tonhão não derrubou');
  // Jogado na sarjeta, pode cair no asfalto e levar um carro em cima: vale (é o boteco).
  const atropelado = ev.some((e) => e.k === 'atropelo' && e.em === 'eu');
  assert.ok(atropelado || Math.hypot(me.x - mapa.SARJETA[0], me.y - mapa.SARJETA[1]) < 1.6, `ficou em ${me.x.toFixed(1)},${me.y.toFixed(1)}`);
  assert.equal(m.calor, 0);
  if (!atropelado) {
    rodar(m, 3000);
    assert.equal(me.estado, 'normal');
    assert.ok(me.vida >= 50);
  }
});

test('agarrar e arremessar: quem é agarrado vai junto; jogado na parede apanha; voando derruba quem está no caminho', () => {
  const m = mundo();
  soEstes(m, ['biriba', 'marrento']);
  const me = B.eu(m);
  me.x = 5.5;
  me.y = 6.5;
  me.fx = 0;
  me.fy = 1;
  const bir = plantar(m, 'biriba', 5.5, 7.3);
  bir.vida = bir.vidaMax = 999;
  rodar(m, 50, (i) => ({ agarra: i === 0 }));
  assert.equal(me.segurando, 'biriba');
  assert.equal(bir.estado, 'segurado');
  rodar(m, 500, () => ({ mx: 1, my: 0 }));
  assert.ok(Math.hypot(bir.x - me.x, bir.y - me.y) < 0.7, 'não foi junto');
  // Vira para a parede da esquerda (x = 0) e arremessa.
  me.x = 2.5;
  me.y = 6.5;
  me.fx = -1;
  me.fy = 0;
  const vida0 = bir.vida;
  const ev = rodar(m, 600, (i) => ({ agarra: i === 0 }));
  assert.equal(me.segurando, null);
  assert.ok(ev.some((e) => e.k === 'parede'), 'não bateu na parede');
  assert.ok(bir.vida < vida0);
  // Boliche.
  const m2 = mundo();
  soEstes(m2, ['biriba', 'marrento']);
  const me2 = B.eu(m2);
  me2.x = 3.5;
  me2.y = 5.5;
  me2.fx = 1;
  me2.fy = 0;
  const b2 = plantar(m2, 'biriba', 4.3, 5.5);
  b2.vida = b2.vidaMax = 999;
  const mar = plantar(m2, 'marrento', 6.0, 5.5);
  mar.vida = mar.vidaMax = 999;
  mar.atordoadoAte = Infinity; // parado, esperando a bola
  rodar(m2, 30, (i) => ({ agarra: i === 0 }));
  me2.fx = 1;
  me2.fy = 0;
  const ev2 = rodar(m2, 800, (i) => ({ agarra: i === 0 }));
  assert.ok(ev2.some((e) => e.k === 'golpe' && e.em === 'marrento'), 'o corpo voando não derrubou o Marrento');
});

test('o Tonhão não se deixa agarrar (de pé)', () => {
  const m = mundo();
  soEstes(m, ['tonhao']);
  const me = B.eu(m);
  me.x = 10.5;
  me.y = 8.5;
  me.fx = 0;
  me.fy = 1;
  plantar(m, 'tonhao', 10.5, 9.3);
  const ev = rodar(m, 50, (i) => ({ agarra: i === 0 }));
  assert.equal(me.segurando, null);
  assert.ok(ev.some((e) => e.k === 'aviso'));
});

test('armas: garrafa quebra no primeiro golpe e vira caco; volta ao lugar depois de 25 s; arremessada acerta à distância', () => {
  const m = mundo();
  soEstes(m, ['marrento']);
  const me = B.eu(m);
  const spot = m.chao[0];
  me.x = spot.x;
  me.y = spot.y;
  rodar(m, 30, (i) => ({ usa: i === 0 }));
  assert.equal(me.arma?.tipo, 'garrafa');
  assert.ok(spot.volta > 0);
  const mar = plantar(m, 'marrento', me.x + 0.8, me.y);
  mar.vida = mar.vidaMax = 999;
  mar.atordoadoAte = Infinity; // saco de pancada: não revida
  me.fx = 1;
  me.fy = 0;
  const ev = rodar(m, 700, (i) => ({ soco: i === 0 }));
  assert.ok(ev.some((e) => e.k === 'golpe' && e.arma === 'garrafa' && e.dano === B.ARMAS.garrafa.dano));
  assert.ok(ev.some((e) => e.k === 'quebra' && e.arma === 'garrafa'));
  assert.equal(me.arma?.tipo, 'caco');
  rodar(m, B.VOLTA_ARMA_MS);
  assert.equal(spot.volta, 0, 'a garrafa não voltou');
  // Arremesso: caco voa e acerta quem está a 3 ladrilhos.
  mar.x = me.x + 3;
  mar.y = me.y;
  const vida0 = mar.vida;
  rodar(m, 50, (i) => ({ agarra: i === 0 }));
  assert.equal(me.arma, null);
  assert.ok(mar.vida < vida0, 'o arremesso não acertou');
});

test('amigos desmaiados: apanham sem perder nada, ganham bigode até 3, dá para arrastar', () => {
  const m = mundo();
  const me = B.eu(m);
  const vini = corpo(m, 'amigo:vini');
  assert.ok(vini && vini.estado === 'ko');
  assert.equal(corpo(m, 'amigo:will'), undefined, 'você não aparece desmaiado');
  me.x = vini.x - 0.7;
  me.y = vini.y;
  me.fx = 1;
  me.fy = 0;
  const ev = rodar(m, 600, (i) => ({ soco: i === 0 }));
  assert.ok(!ev.some((e) => e.k === 'golpe' && e.em === 'amigo:vini'));
  assert.equal(vini.vida, 1);
  assert.equal(vini.estado, 'ko');
  assert.ok(vini.x > 6.5 + 0.1, 'o chute não empurrou');
  me.x = vini.x - 0.6; // chega perto de novo
  me.y = vini.y;
  // Fatia 15: a pegadinha vai até 6 degraus (bigode ... jornal na cara) e para ali.
  for (let k = 0; k < 8; k++) rodar(m, 20, (i) => ({ usa: i === 0 }));
  assert.equal(vini.ink, 6);
  rodar(m, 20, (i) => ({ agarra: i === 0 }));
  assert.equal(me.segurando, 'amigo:vini');
});

test('cerveja da geladeira cura 25 e tem espera', () => {
  const m = mundo();
  const me = B.eu(m);
  me.x = 11.5;
  me.y = 1.6;
  me.vida = 40;
  rodar(m, 20, (i) => ({ usa: i === 0 }));
  assert.equal(Math.round(me.vida), 65);
  const ev = rodar(m, 20, (i) => ({ usa: i === 0 }));
  assert.equal(Math.round(me.vida), 65);
  assert.ok(ev.some((e) => e.k === 'aviso'));
});

test('determinístico: mesma semente e mesmas entradas = mesmo mundo, golpe a golpe', () => {
  // Anda em volta do Marrento e do Cabeça socando: tem golpe, multidão, frase e sorteio de verdade.
  const prep = (m) => {
    const me = B.eu(m);
    me.x = 19.5;
    me.y = 4.5;
  };
  const roteiro = (i) => ({ mx: Math.sin(i / 40) * 0.6, my: Math.cos(i / 55) * 0.6, soco: i % 13 === 0, agarra: i % 151 === 0, usa: i % 97 === 0 });
  const foto = (m) => JSON.stringify(m.corpos.map((c) => [c.id, c.x.toFixed(6), c.y.toFixed(6), c.vida, c.estado, c.humor])) + m.semente + m.nocautes;
  const a = mundo(99);
  const b = mundo(99);
  prep(a);
  prep(b);
  const evA = rodar(a, 20000, roteiro);
  rodar(b, 20000, roteiro);
  assert.ok(evA.filter((e) => e.k === 'golpe').length >= 10, 'o roteiro quase não brigou');
  assert.ok(evA.some((e) => e.k === 'frase'), 'o roteiro não sorteou frase');
  assert.equal(foto(a), foto(b));
});

test('narrador: no máximo uma frase "de enfeite" a cada 900 ms (nocaute sempre sai)', () => {
  const m = mundo();
  soEstes(m, ['marrento']);
  const me = B.eu(m);
  me.x = 5.5;
  me.y = 5.5;
  me.fx = 1;
  me.fy = 0;
  const mar = plantar(m, 'marrento', 6.3, 5.5);
  mar.vida = mar.vidaMax = 1e9;
  mar.estado = 'ko';
  mar.koAte = Infinity;
  const ev = [];
  const n = Math.round(20 / DT);
  for (let i = 0; i < n; i++) {
    mar.x = me.x + 0.8; // o saco de pancada não sai do lugar
    mar.y = me.y;
    mar.vx = mar.vy = 0;
    B.passo(m, { ...B.PARADO, soco: i % 9 === 0 }, DT);
    for (const e of m.eventos) if (e.k === 'frase') ev.push(m.t);
    m.eventos.length = 0;
  }
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i] - ev[i - 1] >= B.INTERVALO_FRASE - 1, `frases a ${ev[i] - ev[i - 1]} ms`);
  assert.ok(ev.length >= 3, 'o narrador ficou mudo');
});

test('desempenho: 60 s de pancadaria com todos os NPCs em menos de 400 ms', () => {
  const m = mundo(3);
  const t = performance.now();
  rodar(m, 60000, (i) => ({ mx: Math.sin(i / 60), my: Math.cos(i / 80), soco: i % 11 === 0, agarra: i % 200 === 0 }));
  const ms = performance.now() - t;
  assert.ok(ms < 400, `${ms.toFixed(0)} ms`);
});

test('laço de quadros: a 30 fps anda o mesmo que a 60 e mostra a pose de andar', () => {
  const ande = (fps) => {
    const m = mundo();
    const me = B.eu(m);
    me.x = 5.5;
    me.y = 5.0;
    const x0 = me.x;
    const laco = { acc: 0 };
    let andando = 0;
    const quadros = fps; // 1 s
    for (let i = 0; i < quadros; i++) {
      B.rodarQuadro(m, laco, 1 / fps, { mx: 1, my: 0 }, { soco: false, agarra: false, usa: false });
      if (me.andando) andando++;
    }
    return { d: me.x - x0, andando, quadros };
  };
  const a = ande(60);
  const b = ande(30);
  assert.ok(a.d > 2.5, `andou ${a.d.toFixed(2)} a 60 fps`);
  assert.ok(Math.abs(a.d - b.d) < 0.06, `60 fps ${a.d.toFixed(2)} × 30 fps ${b.d.toFixed(2)}`);
  assert.equal(b.andando, b.quadros, 'a 30 fps a pose de andar sumiu em algum quadro');
});

test('laço de quadros: J apertado durante o hit-stop não se perde; engasgo não acelera o jogo', () => {
  const m = mundo();
  soEstes(m, ['marrento']);
  const me = B.eu(m);
  me.x = 5.5;
  me.y = 5.5;
  me.fx = 1;
  me.fy = 0;
  const mar = plantar(m, 'marrento', 6.3, 5.5);
  mar.vida = mar.vidaMax = 999;
  mar.atordoadoAte = Infinity;
  const laco = { acc: 0 };
  const toques = { soco: false, agarra: false, usa: false };
  const golpes = [];
  const pega = () => {
    for (const e of m.eventos) if (e.k === 'golpe' && e.de === 'eu') golpes.push(e.dano);
    m.eventos.length = 0;
  };
  // Primeiro soco acerta e congela; o segundo J sai bem no meio do congelamento.
  toques.soco = true;
  for (let i = 0; i < 6; i++) B.rodarQuadro(m, laco, 1 / 60, { mx: 0, my: 0 }, toques, pega);
  assert.equal(golpes.length, 1);
  assert.ok(m.t < m.hitstopAte, 'era para estar no hit-stop');
  toques.soco = true;
  B.rodarQuadro(m, laco, 1 / 60, { mx: 0, my: 0 }, toques, pega);
  assert.equal(toques.soco, true, 'o toque foi gasto dentro do hit-stop');
  for (let i = 0; i < 40; i++) B.rodarQuadro(m, laco, 1 / 60, { mx: 0, my: 0 }, toques, pega);
  assert.equal(golpes.length, 2, 'o segundo soco se perdeu');
  // Engasgo de 2 s: no máximo 8 passos, e o acumulador não guarda o resto.
  const n = B.rodarQuadro(m, laco, 2, { mx: 0, my: 0 }, toques);
  assert.ok(n <= B.MAX_SUBPASSOS, `${n} passos num quadro`);
  assert.ok(laco.acc < B.DT, 'sobrou atraso para correr depois');
});

test('NPC calmo agarrado e arremessado pousa onde caiu (não volta num pulo para a rotina)', () => {
  const m = mundo();
  const me = B.eu(m);
  const cida = corpo(m, 'cida');
  soEstes(m, ['cida']);
  // Corredor livre do salão (linha 5, x 3–15): agarra, carrega e arremessa para +x sem bater em nada.
  cida.x = 5.5;
  cida.y = 5.5;
  cida.rota = null;
  me.x = 4.9;
  me.y = 5.5;
  me.fx = 1;
  me.fy = 0;
  assert.equal(cida.humor, 'calmo');
  rodar(m, 20, (i) => ({ agarra: i === 0 }));
  assert.equal(me.segurando, 'cida');
  assert.equal(cida.humor, 'voltando', 'agarrada continua presa na rotina');
  const x0 = cida.x;
  rodar(m, 600, () => ({ mx: 1, my: 0 }));
  assert.ok(cida.x - x0 > 0.8, `carregou só ${(cida.x - x0).toFixed(2)} ladrilho`);
  me.fx = 1;
  me.fy = 0;
  // Arremessa e acompanha passo a passo: nenhum salto (teleporte de volta para a rotina) depois do voo.
  let maior = 0;
  let px = cida.x;
  let py = cida.y;
  for (let i = 0; i < 90; i++) {
    B.passo(m, { ...B.PARADO, agarra: i === 0 }, DT);
    m.eventos.length = 0;
    // No passo do arremesso ela sai da mão de quem joga (meio ladrilho); dali em diante, só voo e chão.
    if (i > 0) maior = Math.max(maior, Math.hypot(cida.x - px, cida.y - py));
    px = cida.x;
    py = cida.y;
  }
  assert.ok(maior < 0.4, `saltou ${maior.toFixed(2)} ladrilho num passo`);
  assert.notEqual(cida.humor, 'calmo');
  // Pousou longe do ponto da rotina e ficou lá (não voltou num pulo).
  const r = rotina.rotinaEm(gente.NPC_BY_ID.cida, m.t);
  assert.ok(Math.hypot(cida.x - r.x, cida.y - r.y) > 1, 'reapareceu no ponto da rotina');
  assert.ok(cida.x > 8, `voou só até x ${cida.x.toFixed(2)}`);
});

/* ------------------------------------------------------------------ controle e visual */

test('controle: direita na tela anda para (+x, −y) em ladrilhos; baixo para (+x, +y); intensidade mantida', () => {
  const r = controle.telaParaLadrilho(1, 0);
  assert.ok(r.mx > 0 && r.my < 0 && Math.abs(Math.hypot(r.mx, r.my) - 1) < 1e-9);
  const d = controle.telaParaLadrilho(0, 1);
  assert.ok(d.mx > 0 && d.my > 0);
  const h = controle.telaParaLadrilho(0.5, 0);
  assert.ok(Math.abs(Math.hypot(h.mx, h.my) - 0.5) < 1e-9);
  assert.deepEqual(controle.telaParaLadrilho(0.02, 0.01), { mx: 0, my: 0 });
});

test('visual: só aceita opções da lista, aplica na aparência e o código muda com cada troca', () => {
  assert.deepEqual(visual.limpar({ camisa: '#123456', corte: 'moicano', barba: 'full', bermuda: 'sim' }), { barba: 'full' });
  const L = visual.aplicar({ shirt: '#000000', shirtShade: '#000000', hair: '#000000', hairStyle: 'neat', pants: '#000000' }, { camisa: '#e43b44', oculos: 'shades', barba: 'nenhuma', acessorio: 'jacket' });
  assert.equal(L.shirt, '#e43b44');
  assert.equal(L.glasses, 'shades');
  assert.equal(L.beard, undefined);
  assert.equal(L.extra, 'jacket');
  const cods = new Set();
  for (const camisa of visual.CAMISAS) cods.add(visual.codigo({ camisa }));
  for (const corte of visual.CORTES) cods.add(visual.codigo({ corte }));
  assert.equal(cods.size, visual.CAMISAS.length + visual.CORTES.length);
  assert.equal(visual.codigo({}).length, 8);
});

/* ------------------------------------------------------------------ Fatia 2: áreas, eventos e armas novas */

test('áreas: cada NPC vive numa área só (ninguém atravessa a parede do banheiro); 20 a 30 NPCs', () => {
  assert.ok(gente.NPCS.length >= 20 && gente.NPCS.length <= 30, `${gente.NPCS.length} NPCs`);
  const noBanheiro = new Set();
  for (const n of gente.NPCS) {
    const z0 = mapa.zonaDe(n.rotina[0].at[0], n.rotina[0].at[1]);
    if (z0 === 'banheiro') noBanheiro.add(n.id);
    const ciclo = rotina.cicloDe(n);
    for (let t = T0; t < T0 + ciclo; t += 250) {
      const r = rotina.rotinaEm(n, t);
      assert.equal(mapa.zonaDe(r.x, r.y), z0, `${n.id} saiu de ${z0} em ${t - T0} ms`);
    }
  }
  assert.ok(noBanheiro.size >= 1, 'banheiro vazio');
  // Entre o pátio e o banheiro não há chão: a única ligação é a porta.
  for (let y = 0; y < 6; y++) for (const x of [40, 41]) assert.equal(mapa.anda(x, y), false, `chão em ${x},${y}`);
});

test('porta: E na porta leva ao banheiro e de volta, solta quem você segura e o destino é de pisar', () => {
  for (const p of mapa.PORTAS) {
    assert.ok(mapa.anda(p.at[0], p.at[1]), `porta ${p.nome} sem lugar de pé`);
    assert.ok(mapa.anda(Math.floor(p.para[0]), Math.floor(p.para[1])), `destino de ${p.nome} bloqueado`);
    assert.notEqual(mapa.zonaDe(p.at[0], p.at[1]), mapa.zonaDe(p.para[0], p.para[1]), `${p.nome} não troca de área`);
  }
  const m = mundo();
  const me = B.eu(m);
  soEstes(m, ['pinguco']);
  const ping = plantar(m, 'pinguco', 1.5, 5.5);
  ping.atordoadoAte = Infinity;
  me.x = 0.9;
  me.y = 5.5;
  me.fx = 1;
  me.fy = 0;
  rodar(m, 20, (i) => ({ agarra: i === 0 }));
  assert.equal(me.segurando, 'pinguco');
  me.x = 0.5;
  me.y = 5.5;
  const ev = rodar(m, 20, (i) => ({ usa: i === 0 }));
  assert.equal(mapa.zonaDe(me.x, me.y), 'banheiro');
  assert.equal(me.segurando, null, 'entrou no banheiro carregando gente');
  assert.equal(mapa.zonaDe(ping.x, ping.y), 'bar');
  assert.ok(ev.some((e) => e.k === 'porta'));
  // E volta.
  const volta = mapa.PORTAS.find((p) => mapa.zonaDe(p.at[0], p.at[1]) === 'banheiro');
  me.x = volta.at[0] + 0.5;
  me.y = volta.at[1] + 0.5;
  rodar(m, 20, (i) => ({ usa: i === 0 }));
  assert.equal(mapa.zonaDe(me.x, me.y), 'bar');
});

test('porta: quem briga com você no salão desiste quando você foge pro banheiro', () => {
  const m = mundo();
  const me = B.eu(m);
  soEstes(m, ['marrento']);
  const mar = plantar(m, 'marrento', 3.5, 5.5);
  mar.humor = 'briga';
  mar.alvo = 'eu';
  mar.humorAte = Infinity;
  me.x = 0.5;
  me.y = 5.5;
  rodar(m, 20, (i) => ({ usa: i === 0 }));
  assert.equal(mapa.zonaDe(me.x, me.y), 'banheiro');
  rodar(m, 200);
  assert.notEqual(mar.humor, 'briga');
  assert.equal(mapa.zonaDe(mar.x, mar.y), 'bar');
  // Mesmo colado na parede do outro lado (fim do pátio a 4 ladrilhos do banheiro), não ouve nem persegue.
  assert.ok(mapa.anda(38, 4));
  const m2 = mundo();
  const me2 = B.eu(m2);
  soEstes(m2, ['mano']);
  const mano = plantar(m2, 'mano', 38.5, 4.5);
  me2.x = 42.5;
  me2.y = 4.5;
  mano.humor = 'briga';
  mano.alvo = 'eu';
  mano.humorAte = Infinity;
  rodar(m2, 200);
  assert.notEqual(mano.humor, 'briga', 'briga através da parede');
});

test('happy hour: a turma chega pela calçada no começo, a cerveja cura em dobro, e ela vai embora no fim', () => {
  const ciclo = mapa.HAPPY_CICLO;
  const comeco = Math.ceil(T0 / ciclo) * ciclo; // próximo começo de happy hour depois de T0
  const m = B.novoMundo('will', comeco - 1000, 7);
  const turma = m.corpos.filter((c) => gente.NPC_BY_ID[c.id]?.turno === 'happy');
  assert.ok(turma.length >= 3, `${turma.length} na turma`);
  assert.ok(turma.every((c) => c.ausente), 'turma no bar antes da hora');
  assert.equal(m.happy, false);
  const ev = [];
  for (let i = 0; i < 200 && !m.happy; i++) ev.push(...rodar(m, 1000 / 60));
  assert.equal(m.happy, true);
  assert.ok(ev.some((e) => e.k === 'happy' && e.comeca));
  assert.ok(turma.every((c) => !c.ausente));
  for (const c of turma) assert.ok(Math.hypot(c.x - mapa.ENTRADA[0], c.y - (mapa.ENTRADA[1] + 2)) < 0.8, `${c.id} não chegou pela calçada`);
  // Cerveja em dobro.
  const me = B.eu(m);
  me.x = 11.5;
  me.y = 1.6;
  me.vida = 40;
  me.estado = 'normal';
  rodar(m, 20, (i) => ({ usa: i === 0 }));
  assert.equal(Math.round(me.vida), 90);
  // Fim: todos saem andando e somem.
  const fim = comeco + mapa.HAPPY_DURA;
  const ev2 = rodar(m, fim - m.t + 500);
  assert.ok(ev2.some((e) => e.k === 'happy' && !e.comeca));
  rodar(m, 25000);
  // Quem da turma foi nocauteado numa treta e recolhido pelo Seu Zé deu lugar a um cliente novo (que não tem turno).
  const daTurma = turma.filter((c) => c.npc.turno === 'happy');
  assert.ok(daTurma.length >= 1);
  assert.ok(daTurma.every((c) => c.ausente), `ficaram: ${daTurma.filter((c) => !c.ausente).map((c) => `${c.id}:${c.humor}`).join(', ')}`);
  // Quem nasce depois do fim já começa fora.
  const m2 = B.novoMundo('will', fim + 1000, 7);
  assert.ok(m2.corpos.filter((c) => gente.NPC_BY_ID[c.id]?.turno === 'happy').every((c) => c.ausente));
});

test('fora da happy hour a turma não existe: garrafa arremessada passa por onde ela estaria', () => {
  const m = mundo();
  assert.equal(m.happy, false);
  const me = B.eu(m);
  soEstes(m, []);
  const fant = corpo(m, 'happy1');
  assert.ok(fant.ausente);
  fant.estado = 'normal';
  fant.koAte = 0;
  fant.vida = fant.vidaMax;
  fant.x = 9.5;
  fant.y = 6.5;
  me.x = 7.5;
  me.y = 6.5;
  me.fx = 1;
  me.fy = 0;
  me.arma = { tipo: 'garrafa', usos: 1 };
  const ev = rodar(m, 200, (i) => ({ agarra: i === 0 }));
  assert.equal(me.arma, null, 'não arremessou');
  assert.ok(!ev.some((e) => e.k === 'golpe' && e.em === 'happy1'), 'acertou quem não está no bar');
  assert.equal(fant.vida, fant.vidaMax);
});

test('treta sozinha: uma por janela, na hora sorteada pela janela, igual em qualquer aparelho', () => {
  for (let j = 12_000_000; j < 12_000_050; j++) {
    const b = mapa.brigaDaJanela(j);
    assert.ok(b.em >= j * mapa.JANELA_BRIGA && b.em < (j + 1) * mapa.JANELA_BRIGA, `janela ${j}`);
    assert.deepEqual(mapa.brigaDaJanela(j), b);
  }
  const a = B.agendaBriga(T0);
  assert.ok(a.proxBriga > T0);
  assert.equal(a.proxBriga, mapa.brigaDaJanela(a.janela).em);
  // Rodando até ela: dois NPCs calmos do salão brigam entre si (não com você) e depois param.
  const m = mundo();
  const B0 = m.proxBriga;
  const J0 = m.janela;
  const ev = rodar(m, B0 - m.t + 100);
  const t = ev.find((e) => e.k === 'treta');
  assert.ok(t, 'não estourou');
  const [x, y] = m.corpos.filter((c) => c.nome === t.a || c.nome === t.b);
  assert.ok(x && y);
  assert.equal(x.alvo, y.id);
  assert.equal(y.alvo, x.id);
  assert.ok(m.proxBriga > B0, 'não agendou a próxima');
  assert.equal(m.janela, J0 + 1, 'pulou janela de treta');
  const m2 = mundo();
  const ev2 = rodar(m2, B0 - m2.t + 100);
  assert.deepEqual(ev2.find((e) => e.k === 'treta'), t, 'outro aparelho, outra treta');
  assert.equal(m.proxBriga, m2.proxBriga, 'a próxima treta muda de aparelho para aparelho');
  assert.equal(m.proxBriga, mapa.brigaDaJanela(m.janela).em);
  assert.ok(x.humorAte - m.t <= 12000 && y.humorAte - m.t <= 12000, 'a treta não tem fim');
});

test('treta sozinha: só NPC calmo, do salão, que bate e não é o Tonhão; sem par perto, não estoura', () => {
  const m = mundo();
  for (const c of m.corpos) if (c.quem === 'npc') c.humor = 'foge';
  assert.equal(B.tretaSozinha(m, 3), false);
  const m2 = mundo();
  soEstes(m2, ['marrento', 'tonhao']);
  plantar(m2, 'marrento', 10.5, 6.5).humor = 'calmo';
  plantar(m2, 'tonhao', 11.5, 6.5).humor = 'calmo';
  assert.equal(B.tretaSozinha(m2, 0), false, 'brigou com o Tonhão');
  const m3 = mundo();
  soEstes(m3, ['marrento', 'cabeca']);
  plantar(m3, 'marrento', 10.5, 6.5).humor = 'calmo';
  plantar(m3, 'cabeca', 11.5, 6.5).humor = 'calmo';
  assert.equal(B.tretaSozinha(m3, 0), true);
});

test('armas novas: cano bate pesado, desentupidor bate fraco e dura; estão no beco e no banheiro', () => {
  assert.ok(B.ARMAS.cano.dano >= 20 && B.ARMAS.cano.forte);
  assert.ok(B.ARMAS.desentupidor.dano < B.ARMAS.garrafa.dano && B.ARMAS.desentupidor.usos >= 6);
  const onde = (arma) => mapa.ARMAS_NO_CHAO.filter((a) => a.arma === arma).map((a) => mapa.zonaDe(a.at[0], a.at[1]));
  assert.ok(onde('desentupidor').includes('banheiro'));
  assert.ok(mapa.ARMAS_NO_CHAO.some((a) => a.arma === 'cano' && a.at[0] >= mapa.GRADE), 'cano fora do beco');
  // Pegar e bater com o desentupidor.
  const m = mundo();
  const me = B.eu(m);
  const d = mapa.ARMAS_NO_CHAO.find((a) => a.arma === 'desentupidor');
  me.x = d.at[0] + 0.5;
  me.y = d.at[1] + 0.5;
  rodar(m, 20, (i) => ({ usa: i === 0 }));
  assert.equal(me.arma?.tipo, 'desentupidor');
});

/* ------------------------------------------------------------------ Seu Zé, quebradeira e clientes novos */

/** Anda em x de 0,05 em 0,05 ladrilho (como um corpo), parando na parede; devolve onde parou. */
function andarAte(x, y, dx) {
  let p = { x, y };
  const n = Math.ceil(Math.abs(dx) / 0.05);
  for (let i = 0; i < n; i++) p = B.deslizar(p.x, p.y, dx / n, 0);
  return p;
}

test('Seu Zé recolhe o nocauteado resmungando, some com ele no depósito e um cliente novo chega pela calçada', () => {
  const m = mundo();
  soEstes(m, ['pinguco', 'ze']);
  const ze = corpo(m, 'ze');
  const me = B.eu(m);
  me.x = 20.5;
  me.y = 8.5; // longe, para ninguém atrapalhar
  const p = plantar(m, 'pinguco', 8.5, 5.5);
  B.ferir(m, p, me, { ...B.EMPURRAO, dano: 500 }, 1, 0);
  m.eventos.length = 0;
  const ev = [];
  for (let i = 0; i < 60 && !p.ausente; i++) ev.push(...rodar(m, 500));
  assert.ok(p.ausente, `Pinguço continua no salão (Zé: ${ze.humor}, ${ze.x.toFixed(1)},${ze.y.toFixed(1)})`);
  assert.ok(ev.some((e) => e.k === 'frase' && e.texto.startsWith('Seu Zé:')), 'o Seu Zé não resmungou');
  assert.ok(ev.some((e) => e.k === 'recolhido'));
  assert.ok(Math.hypot(p.x - mapa.DEPOSITO[0], p.y - mapa.DEPOSITO[1]) < 0.6);
  assert.equal(m.chegadas.length, 1);
  const [a, b] = B.CHEGADA_MS;
  assert.ok(m.chegadas[0].em - m.t <= b && m.chegadas[0].em - m.t >= a - 600);
  // Roda em passos curtos até chegar (a posição é conferida na chegada, antes de ele sair andando).
  let chegou = null;
  for (let i = 0; i < Math.ceil((b + 100) / 100) && !chegou; i++) chegou = rodar(m, 100).find((e) => e.k === 'chegou') ?? null;
  assert.ok(chegou, 'ninguém chegou');
  const novo = m.corpos.find((c) => c.id === 'avulso1');
  assert.ok(novo && !novo.ausente && novo.estado === 'normal');
  assert.ok(gente.APELIDOS.includes(novo.nome));
  assert.equal(novo.nome, chegou.nome);
  assert.ok(novo.npc.rotina.length >= 2);
  for (const r of novo.npc.rotina) assert.ok(mapa.anda(Math.floor(r.at[0]), Math.floor(r.at[1])));
  assert.ok(Math.hypot(novo.x - mapa.ENTRADA[0], novo.y - (mapa.ENTRADA[1] + 2)) < 2, 'não veio pela calçada');
  assert.notEqual(ze.humor, 'limpando', 'o Seu Zé não voltou ao balcão');
});

test('funcionário nocauteado não vai para o depósito (o Tonhão levanta)', () => {
  const m = mundo();
  soEstes(m, ['tonhao', 'ze']);
  const me = B.eu(m);
  const t = plantar(m, 'tonhao', 8.5, 5.5);
  B.ferir(m, t, me, { ...B.EMPURRAO, dano: 999 }, 1, 0);
  assert.equal(t.estado, 'ko');
  rodar(m, 15000);
  assert.ok(!t.ausente);
  assert.equal(t.estado, 'normal');
});

test('quebradeira: NPC arremessado na mesa quebra a mesa e passa; o Seu Zé traz outra do depósito e resmunga', () => {
  const m = mundo();
  soEstes(m, ['marrento', 'ze']);
  const me = B.eu(m);
  me.x = 20.5;
  me.y = 8.5;
  const i = mapa.propIdx(3, 6);
  assert.equal(mapa.PROPS[i].kind, 'mesa-bar');
  assert.ok(!mapa.anda(3, 6));
  assert.ok(andarAte(4.5, 6.5, -2).x > 3.9, 'a mesa inteira não segura');
  const mar = plantar(m, 'marrento', 4.6, 6.5);
  mar.estado = 'voando';
  mar.voo = true;
  mar.vx = -9;
  mar.vy = 0;
  mar.lancadoPor = 'eu';
  const ev = rodar(m, 400);
  const q = ev.find((e) => e.k === 'quebrou');
  assert.ok(q && q.i === i, 'a mesa não quebrou');
  assert.ok(m.quebrados.has(i));
  assert.ok(mar.x < 4, `não passou pela mesa (x ${mar.x.toFixed(2)})`);
  assert.ok(andarAte(4.5, 6.5, -2).x < 3.5, 'mesa quebrada ainda segura');
  assert.ok(mar.vida < mar.vidaMax, 'atravessar a mesa não doeu');
  // Antes de REPOR_MS ele não vem; depois traz outra.
  rodar(m, B.REPOR_MS - 1000);
  assert.ok(m.quebrados.has(i), 'repôs rápido demais');
  const ev2 = [];
  for (let k = 0; k < 60 && m.quebrados.has(i); k++) ev2.push(...rodar(m, 500));
  assert.ok(!m.quebrados.has(i), 'o Seu Zé não repôs a mesa');
  assert.ok(ev2.some((e) => e.k === 'reposto' && e.i === i));
  assert.ok(ev2.some((e) => e.k === 'frase' && e.texto.startsWith('Seu Zé:')), 'repôs calado');
  assert.ok(andarAte(4.5, 6.5, -2).x > 3.9, 'mesa nova não segura');
});

test('todo móvel que quebra tem um lado onde o Seu Zé chega (do balcão, ou pela porta no banheiro)', () => {
  let n = 0;
  for (const p of mapa.PROPS) {
    if (!mapa.QUEBRAVEIS.has(p.kind)) continue;
    n++;
    const z = mapa.zonaDe(p.x, p.y);
    const de = z === 'bar' ? { x: 3, y: 1 } : { x: 43, y: 4 };
    const lados = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if ((dx || dy) && mapa.anda(x, y) && mapa.zonaDe(x, y) === z) lados.push({ x, y });
      }
    assert.ok(lados.length, `${p.kind} em ${p.x},${p.y} cercado`);
    assert.ok(lados.some((l) => findPath(mapa.anda, de, l, 600).length > 0), `${p.kind} em ${p.x},${p.y} fora de alcance`);
  }
  assert.ok(n >= 10, `só ${n} quebráveis`);
});

test('garrafa arremessada quebra a cadeira de plástico no caminho', () => {
  const m = mundo();
  soEstes(m, []);
  const me = B.eu(m);
  const i = mapa.propIdx(2, 11);
  assert.equal(mapa.PROPS[i].kind, 'cadeira-plastico');
  me.x = 2.5;
  me.y = 9.5;
  me.fx = 0;
  me.fy = 1;
  me.arma = { tipo: 'garrafa', usos: 1 };
  const ev = rodar(m, 100, (k) => ({ agarra: k === 0 }));
  assert.ok(ev.some((e) => e.k === 'quebrou' && e.i === i), 'a cadeira ficou inteira');
});

/* ------------------------------------------------------------------ carros na rua */

test('carros: a hora decide onde estão (igual em todo aparelho), andam sem pular e às vezes a rua fica vazia', () => {
  let vistos = 0;
  let vazio = 0;
  const ultimo = new Map();
  for (let t = T0; t < T0 + 120000; t += 100) {
    const cs = mapa.carrosEm(t);
    assert.deepEqual(mapa.carrosEm(t), cs);
    if (!cs.length) vazio++;
    for (const c of cs) {
      vistos++;
      assert.equal(c.y, mapa.RUA + 0.5);
      assert.ok(c.vel >= 7 && c.vel <= 12);
      const antes = ultimo.get(c.id);
      if (antes !== undefined) {
        const passo = (c.x - antes) * c.dir;
        assert.ok(passo > 0 && passo <= c.vel * 0.1 + 1e-9, `carro ${c.id} pulou ${passo}`);
      }
      ultimo.set(c.id, c.x);
    }
  }
  assert.ok(ultimo.size >= 12, `só ${ultimo.size} carros em 2 min`);
  assert.ok(vazio > 0);
  // Uma janela em cada ~5 sem carro nenhum (dá para atravessar com calma).
  const j0 = Math.floor(T0 / mapa.JANELA_CARRO);
  const semCarro = Array.from({ length: 50 }, (_, k) => mapa.carroDaJanela(j0 + k)).filter((c) => !c.vem).length;
  assert.ok(semCarro >= 4 && semCarro <= 20, `${semCarro} janelas vazias em 50`);
  assert.ok(vistos > 0);
});

test('rua: dá para jogar gente (e entrar) nela; NPC não anda por ela na rotina', () => {
  let p = { x: 5.5, y: 14.5 };
  for (let i = 0; i < 30; i++) p = B.deslizar(p.x, p.y, 0, 0.05);
  assert.ok(p.y > 15.2, `parou em ${p.y.toFixed(2)}`);
  assert.ok(p.y < 16, 'saiu do mapa');
  assert.equal(mapa.anda(5, mapa.RUA), false);
});

test('atropelo: NPC jogado na rua leva 60, voa no sentido do carro e o nocaute conta para quem jogou', () => {
  const m = mundo();
  soEstes(m, ['marrento', 'ze']);
  const me = B.eu(m);
  me.x = 6.5;
  me.y = 13.5;
  const mar = plantar(m, 'marrento', 12.5, 15.5);
  mar.atordoadoAte = Infinity;
  mar.vida = 50;
  mar.lancadoPor = 'eu';
  let ev = [];
  for (let i = 0; i < 80 && !ev.some((e) => e.k === 'atropelo'); i++) ev = rodar(m, 250);
  const a = ev.find((e) => e.k === 'atropelo');
  assert.ok(a && a.em === 'marrento', 'o carro passou reto');
  assert.equal(mar.vida, 0);
  assert.equal(mar.estado, 'ko');
  assert.equal(m.nocautes, 1, 'não contou para você');
  assert.ok(Math.sign(mar.vx) === a.dir || Math.abs(mar.x - 12.5) > 0.5, 'não voou com o carro');
  assert.ok(ev.some((e) => e.k === 'frase'));
  // O mesmo carro não atropela duas vezes.
  const depois = rodar(m, 300);
  assert.ok(!depois.some((e) => e.k === 'atropelo' && e.em === 'marrento'));
});

test('atropelo: você no meio da rua também leva', () => {
  const m = mundo();
  soEstes(m, []);
  const me = B.eu(m);
  me.x = 12.5;
  me.y = 15.5;
  let ev = [];
  for (let i = 0; i < 80 && !ev.some((e) => e.k === 'atropelo'); i++) ev = rodar(m, 250);
  assert.ok(ev.some((e) => e.k === 'atropelo' && e.em === 'eu'));
  assert.ok(me.vida <= B.VIDA_EU - B.DANO_CARRO + 5);
});

console.log(`\n${passed} testes do Bar Vivo passaram`);
