// Testes da Fatia 5: animação própria de cada item (lote A) e a Rajada do Fiado (lote C), com a rede.
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
const B = await import('../src/vivo/briga.ts');
const AN = await import('../src/vivo/animArma.ts');
const rede = await import('../src/vivo/rede.ts');
const loja = await import('../src/vivo/loja.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

const T0 = 1_800_000_300_000;
const DT = 1 / 60;
const mundo = (semente = 7) => B.novoMundo('will', T0, semente);
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
/** Deixa só estes NPCs de pé (os outros desmaiados num canto longe). */
function soEstes(m, ids) {
  for (const c of m.corpos) {
    if (c.quem !== 'npc' || ids.includes(c.id)) continue;
    c.estado = 'ko';
    c.koAte = Infinity;
    c.x = 1.5;
    c.y = 13.5;
  }
}
const PD = await import('../src/vivo/poderes.ts');
// Fatia 6: os poderes não giram na mão (são 11, todos de um uso); a conta dos itens é sem eles.
// Fatia 12: entraram 8 (pano, prego, fita, raquete e as 4 receitas): 34.
const ARMAS = Object.keys(B.ARMAS).filter((a) => !PD.ehPoder(a));

/* ------------------------------------------------------------------ Lote A: cada item com o seu movimento */

test('cada item tem movimento próprio: nenhuma assinatura igual entre os 34 itens', () => {
  assert.equal(ARMAS.length, 34);
  const vistos = new Map();
  for (const a of ARMAS) {
    assert.ok(AN.MOVIMENTO[a], `${a} sem movimento`);
    const s = JSON.stringify(AN.assinatura(a));
    assert.ok(!vistos.has(s), `${a} igual a ${vistos.get(s)}`);
    vistos.set(s, a);
  }
});

test('o golpe vai de verdade: preparação para o lado oposto e contato longe dela (giro ou estocada)', () => {
  for (const a of ARMAS) {
    const mv = AN.MOVIMENTO[a];
    let maior = 0;
    let estica = 0;
    for (let u = -1; u <= 0; u += 0.05) {
      const p = AN.poseItem(a, u);
      const c = AN.poseItem(a, 0);
      maior = Math.max(maior, Math.abs(c.ang - p.ang));
      estica = Math.max(estica, c.dx - p.dx);
    }
    // Extintor é jato: não gira nem estoca, o tranco joga o corpo para trás.
    if (mv.recuo) assert.ok(mv.recuo >= 2 && AN.poseItem(a, 0.2).dx < AN.poseItem(a, 0).dx, `${a}: sem tranco`);
    else if (mv.estocada) assert.ok(estica >= 6, `${a}: estocada curta (${estica})`);
    else {
      assert.ok(maior >= 90, `${a}: giro curto (${maior}°)`);
      const longe = Math.abs(AN.poseItem(a, 0).ang - AN.poseItem(a, null).ang);
      assert.ok(longe >= 30, `${a}: o contato fica no descanso (${longe}°)`);
    }
    // E volta ao descanso no fim.
    assert.deepEqual(AN.poseItem(a, 1), AN.poseItem(a, null), `${a} não volta ao descanso`);
  }
});

test('tempo do golpe: −1 no começo da preparação, 0 no contato, 1 no fim; fora de golpe, descanso', () => {
  const g = { antecipa: 200, recupera: 400 };
  assert.equal(AN.tempoGolpe({ fase: 'antes', faseAte: 1200, golpe: g }, 1000), -1);
  assert.equal(AN.tempoGolpe({ fase: 'antes', faseAte: 1200, golpe: g }, 1200), 0);
  assert.equal(AN.tempoGolpe({ fase: 'depois', faseAte: 1600, golpe: g }, 1200), 0);
  assert.equal(AN.tempoGolpe({ fase: 'depois', faseAte: 1600, golpe: g }, 1600), 1);
  assert.equal(AN.tempoGolpe({ fase: 'nada', faseAte: 0, golpe: null }, 0), null);
  // 60 ms antes de 0,05 do follow-through (20 ms) atravessa o contato e cai na preparação.
  assert.ok(Math.abs(AN.voltarNoGolpe(0.05, 60, g) - -0.2) < 1e-9);
  assert.ok(Math.abs(AN.voltarNoGolpe(0.5, 60, g) - 0.35) < 1e-9);
});

test('o contato do motor é o 0 da animação: o dano entra quando a preparação acaba', () => {
  const m = mundo();
  const alvo = m.corpos.find((c) => c.id === 'marrento');
  soEstes(m, [alvo.id]);
  const me = B.eu(m);
  Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0 });
  Object.assign(alvo, { x: 6.4, y: 5.5, vx: 0, vy: 0, humor: 'voltando', rota: null, atordoadoAte: Infinity });
  me.arma = { tipo: 'marreta', usos: 6 };
  rodar(m, DT * 1000, () => ({ soco: true }));
  assert.equal(me.fase, 'antes');
  assert.equal(AN.tempoGolpe(me, m.t), -1, 'começou agora');
  rodar(m, 100);
  const u = AN.tempoGolpe(me, m.t);
  assert.ok(u < 0 && u > -1, `u = ${u}`);
  const ev = rodar(m, B.ARMAS.marreta.antecipa);
  const golpe = ev.find((e) => e.k === 'golpe' && e.arma === 'marreta');
  assert.ok(golpe, 'acertou');
  assert.equal(me.fase, 'depois');
});

test('cada material tem cor e quantidade; toda onomatopeia é curta', () => {
  for (const a of ARMAS) {
    const mv = AN.MOVIMENTO[a];
    assert.ok(AN.RESTO[mv.material].cores.length >= 2);
    assert.ok(mv.som.length >= 2 && mv.som.length <= 6, `${a}: "${mv.som}"`);
    assert.ok(mv.tranco > 0 && mv.tranco <= 1);
  }
});

/* ------------------------------------------------------------------ Lote C: Rajada do Fiado */

test('mercado negro: Rajada do Fiado a R$ 1.000, um uso', () => {
  const it = loja.CATALOGO.find((i) => i.arma === 'rajada');
  assert.equal(it.preco, 300);
  assert.equal(B.ARMAS.rajada.usos, 1);
  const semGrana = loja.comprar(it.arma, 999, loja.CARTEIRA_VAZIA);
  assert.equal(semGrana.ok, false);
});

test('o feixe vai até a borda da área (bar ou banheiro), no máximo 24 ladrilhos', () => {
  assert.equal(B.alcanceRajada(5, 5, 1, 0), 24);
  assert.equal(B.alcanceRajada(44, 3, 1, 0), 4);
  assert.ok(Math.abs(B.alcanceRajada(10, 5, 0, -1) - 5) < 1e-9);
  const r = { x: 0, y: 0, fx: 1, fy: 0, len: 10 };
  assert.equal(B.noFeixe(r, 10, 5, B.RAJADA_RAIO - 0.1), 5);
  assert.equal(B.noFeixe(r, 10, 5, B.RAJADA_RAIO + 0.2), -1, 'fora da largura');
  assert.ok(B.RAJADA_RAIO >= 1.5, 'feixe largo (3 ladrilhos)');
  assert.equal(B.noFeixe(r, 4, 5, 0), -1, 'a frente ainda não chegou');
  assert.equal(B.noFeixe(r, 20, 11, 0), -1, 'depois do fim');
});

/** Você no salão olhando para +x com a rajada na mão; dois NPCs na linha e um fora dela. */
function cenaRajada() {
  const m = mundo(11);
  // Clientes comuns (a Dona Maria e os funcionários seguem a rotina pela hora e voltam para o lugar deles).
  const npcs = ['marrento', 'cabeca', 'pinguco'].map((id) => m.corpos.find((c) => c.id === id));
  soEstes(m, npcs.map((c) => c.id));
  const me = B.eu(m);
  Object.assign(me, { x: 3.5, y: 4.5, fx: 1, fy: 0, vida: 100 });
  me.arma = { tipo: 'rajada', usos: 1 };
  return { m, me, npcs };
}
function posicionar(npcs) {
  const lugares = [[8.5, 4.6], [17.5, 5.6], [8.5, 8.5]];
  npcs.forEach((c, i) => Object.assign(c, { x: lugares[i][0], y: lugares[i][1], vx: 0, vy: 0, humor: 'voltando', rota: null, alvo: null, fase: 'nada', atordoadoAte: Infinity }));
}

test('rajada: 2 s de carga plantado (não anda nem vira), depois o feixe acerta na ordem e quebra os móveis do caminho', () => {
  const { m, me, npcs } = cenaRajada();
  let ev = rodar(m, DT * 1000, () => ({ soco: true }));
  assert.ok(ev.some((e) => e.k === 'carga' && e.em === me.id), 'avisou a carga');
  assert.equal(me.fase, 'antes');
  ev = rodar(m, 1800, () => ({ mx: 0, my: 1 }));
  assert.equal(me.x, 3.5, 'não andou carregando');
  assert.equal(me.fx, 1, 'não virou carregando');
  assert.equal(me.arma?.tipo, 'rajada', 'ainda não gastou');
  posicionar(npcs);
  // Anota a hora de cada evento: a frente do feixe chega em cada um no seu tempo.
  ev = [];
  for (let i = 0; i < Math.round(1600 / 1000 / DT); i++) {
    B.passo(m, B.PARADO, DT);
    for (const x of m.eventos) ev.push({ ...x, t: m.t });
    m.eventos.length = 0;
  }
  const disparo = ev.find((e) => e.k === 'rajada');
  assert.ok(disparo, 'disparou');
  assert.equal(me.arma, null, 'um uso');
  const i0 = ev.findIndex((e) => e.k === 'golpe' && e.em === npcs[0].id && e.arma === 'rajada');
  const i1 = ev.findIndex((e) => e.k === 'golpe' && e.em === npcs[1].id && e.arma === 'rajada');
  assert.ok(i0 >= 0 && i1 > i0, `ordem pela frente do feixe (${i0}, ${i1})`);
  const esperado = ((npcs[1].x - npcs[0].x) / B.RAJADA_VEL) * 1000;
  const dt01 = ev[i1].t - ev[i0].t;
  assert.ok(dt01 >= esperado * 0.7, `o segundo apanhou cedo demais (${Math.round(dt01)} ms; a frente leva ${Math.round(esperado)} ms)`);
  assert.ok(!ev.some((e) => e.k === 'golpe' && e.em === npcs[2].id && e.arma === 'rajada'), 'quem está fora da linha não apanha');
  for (const c of npcs.slice(0, 2)) assert.ok(c.estado === 'ko' || c.estado === 'voando', `${c.id} ficou de pé (${c.estado}, vida ${c.vida})`);
  // Todo móvel quebrável dentro do feixe quebrou.
  const r = { x: disparo.x, y: disparo.y, fx: disparo.fx, fy: disparo.fy, len: disparo.len };
  const noCaminho = mapa.PROPS.map((p, k) => [p, k]).filter(([p]) => mapa.QUEBRAVEIS.has(p.kind) && mapa.zonaDe(p.x, p.y) === 'bar' && B.noFeixe(r, 99, p.x + 0.5, p.y + 0.5) >= 0);
  assert.ok(noCaminho.length >= 3, `${noCaminho.length} móveis no caminho`);
  for (const [, k] of noCaminho) assert.ok(m.quebrados.has(k), `móvel ${k} ficou de pé`);
  assert.equal(m.rajadas.length, 1);
  rodar(m, 600);
  assert.equal(m.rajadas.length, 0, 'o feixe some');
});

test('rajada: apanhar na carga cancela sem gastar o item', () => {
  const { m, me, npcs } = cenaRajada();
  rodar(m, DT * 1000, () => ({ soco: true }));
  rodar(m, 500);
  B.ferir(m, me, npcs[0], B.JAB, 1, 0);
  assert.equal(me.fase, 'nada');
  const ev = rodar(m, 2500);
  assert.ok(!ev.some((e) => e.k === 'rajada'), 'não disparou');
  assert.deepEqual(me.arma, { tipo: 'rajada', usos: 1 });
});

test('rajada de amigo: só desenho na sua tela (o dano dele chega pela rede)', () => {
  const { m, npcs } = cenaRajada();
  posicionar(npcs);
  const vida = npcs[0].vida;
  B.rajadaDeFora(m, 'amigo:vini', 4.5, 4.5, 1, 0, m.t);
  assert.equal(m.rajadas[0].visual, true);
  rodar(m, 1500);
  assert.equal(npcs[0].vida, vida);
});

/* ------------------------------------------------------------------ Rede: item na mão, golpe e rajada dos amigos */

test('rede: você manda o item na mão e a hora da rajada; muda o item = manda de novo', () => {
  const m = mundo();
  const me = B.eu(m);
  me.arma = { tipo: 'katana', usos: 15 };
  const s = rede.meuEstado(me, { mx: 0, my: 0 }, 'abcdefgh', undefined, 123456.7);
  assert.equal(s.w, 'katana');
  assert.equal(s.r, 123457);
  me.arma = { tipo: 'marreta', usos: 6 };
  const s2 = rede.meuEstado(me, { mx: 0, my: 0 }, 'abcdefgh');
  assert.equal(rede.deveEnviar({ s, em: 0 }, s2, 500), true);
  const lido = rede.sanitizeVivo({ vini: { ...s2, at: 1, on: true }, dani: { ...s2, w: 'bazuca', at: 1, on: true } });
  assert.equal(lido.vini.w, 'marreta');
  assert.equal(lido.dani.w, undefined, 'item que não existe cai fora');
});

test('rede: o golpe do amigo aparece inteiro (preparação, follow-through) e a rajada dele vira feixe na sua tela', () => {
  const m = mundo();
  const c = m.corpos.find((x) => x.id === 'amigo:vini');
  c.estado = 'normal';
  const base = { x: 5, y: 5, fx: 1, fy: 0, mx: 0, my: 0, e: 'n', vi: 100, lk: 'abcdefgh', at: 1, on: true };
  rede.lerGolpeRemoto(m, c, { ...base, w: 'bastao', a: 1 }, { ...base, w: 'bastao' });
  assert.equal(c.fase, 'antes');
  assert.equal(c.golpe, B.ARMAS.bastao);
  assert.equal(c.arma.tipo, 'bastao');
  rede.lerGolpeRemoto(m, c, { ...base, w: 'bastao' }, { ...base, w: 'bastao', a: 1 });
  assert.equal(c.fase, 'depois');
  assert.ok(c.faseAte > m.t);
  m.t = c.faseAte + 1;
  rede.lerGolpeRemoto(m, c, { ...base, w: 'bastao' }, { ...base, w: 'bastao' });
  assert.equal(c.fase, 'nada');
  // Carga e disparo.
  rede.lerGolpeRemoto(m, c, { ...base, w: 'rajada', a: 1 }, { ...base, w: 'rajada' });
  assert.ok(m.eventos.some((e) => e.k === 'carga' && e.em === c.id));
  rede.lerGolpeRemoto(m, c, { ...base, r: m.t - 100 }, { ...base, w: 'rajada', a: 1 });
  assert.equal(m.rajadas.length, 1);
  assert.equal(m.rajadas[0].visual, true);
  assert.ok(m.eventos.some((e) => e.k === 'rajada'));
  // A mesma hora de novo não repete o feixe.
  rede.lerGolpeRemoto(m, c, { ...base, r: m.t - 100 }, { ...base, r: m.t - 100 });
  assert.equal(m.rajadas.length, 1);
});

test('rede: a linha dos NPCs com todos os móveis quebrados cabe nos 1.500 caracteres', () => {
  const m = mundo();
  mapa.PROPS.forEach((p, k) => {
    if (mapa.QUEBRAVEIS.has(p.kind)) m.quebrados.set(k, m.t);
  });
  for (const c of m.corpos) if (c.quem === 'npc') c.quenteAte = m.t + 10_000;
  const l = rede.linhaNpc(m);
  assert.ok(l.length <= 1500, `${l.length} caracteres`);
  const { quebrados } = rede.lerLinhaNpc(l);
  assert.ok(quebrados.length > 10);
});

/* ------------------------------------------------------------------ Lote B: GFA mais denso, trânsito, tiro e gore */

const G = await import('../src/gfa/simulacao.ts');
const F = await import('../src/gfa/fx.ts');
const correr = (g, ms, ent = () => G.PARADO) => {
  const ev = [];
  for (let i = 0; i < Math.round(ms / 1000 / G.DT_GFA) && !g.acabou; i++) {
    G.passoGfa(g, ent(i));
    ev.push(...g.eventos);
    g.eventos.length = 0;
  }
  return ev;
};

test('GFA: rua cheia (110 pedestres na calçada) e 14 carros civis que nunca entram em prédio nem saem do mundo', () => {
  const g = G.novoGfa(21);
  assert.equal(g.pedestres.length, 110);
  assert.ok(g.pedestres.every((p) => !G.predio(p.x, p.z)));
  assert.equal(g.civis.length, 14);
  const ini = g.civis.map((v) => [v.x, v.z]);
  // Carro parado num canto, longe do trânsito, por 30 s.
  Object.assign(g.carro, { x: 2, z: 2 });
  correr(g, 30_000);
  for (const v of g.civis) {
    assert.ok(!G.predio(v.x, v.z), `civil ${v.id} dentro de prédio (${v.x.toFixed(1)}, ${v.z.toFixed(1)})`);
    assert.ok(v.x >= 0 && v.z >= 0 && v.x <= G.MUNDO && v.z <= G.MUNDO);
  }
  assert.ok(g.civis.every((v, i) => Math.hypot(v.x - ini[i][0], v.z - ini[i][1]) > 1), 'todos andaram');
});

test('GFA: bater num carro civil é batida (você toma o tranco e ele fica rodando)', () => {
  const g = G.novoGfa(3);
  const v = g.civis[0];
  Object.assign(g.carro, { x: v.x, z: v.z - 2, ang: 0, vel: 15 });
  const ev = correr(g, 200, () => ({ acel: 1, giro: 0, freio: false }));
  assert.ok(ev.some((e) => e.k === 'batida'), 'sem batida');
  assert.ok(v.batidoAte > g.t, 'o civil não rodou');
});

test('GFA: segurar o tiro para o carro, abre o vidro e atira 5 vezes por segundo no pedestre mais perto', () => {
  const g = G.novoGfa(8);
  Object.assign(g.carro, { x: G.RUA / 2 + G.BLOCO * 3, z: G.RUA / 2 + G.BLOCO * 3, vel: 20, ang: 0 });
  const t0 = g.t;
  let primeiro = null;
  const tiros = [];
  for (let i = 0; i < Math.round(3 / G.DT_GFA); i++) {
    G.passoGfa(g, { acel: 1, giro: 0, freio: false, tiro: true });
    for (const e of g.eventos) if (e.k === 'tiro') {
      tiros.push(e);
      if (!primeiro) primeiro = { dt: g.t - t0, vel: Math.abs(g.carro.vel), janela: g.janela };
    }
    g.eventos.length = 0;
  }
  assert.ok(primeiro && primeiro.dt >= 250 && primeiro.vel < 3 && primeiro.janela === 1, `atirou antes de parar e abrir o vidro: ${JSON.stringify(primeiro)}`);
  assert.ok(Math.abs(g.carro.vel) < 3, `não parou (${g.carro.vel})`);
  assert.equal(g.janela, 1);
  assert.ok(tiros.length >= 10 && tiros.length <= 15, `${tiros.length} tiros em 3 s`);
  const certos = tiros.filter((e) => e.id >= 0);
  assert.ok(certos.length >= 8, `${certos.length} acertos`);
  assert.equal(g.atropelos, certos.length, 'cada morte de tiro conta como atropelo');
  // Soltou: o vidro sobe.
  correr(g, 300, () => G.PARADO);
  assert.equal(g.janela, 0);
});

test('GFA: o tiro vai no mais perto de pé (e não em quem já caiu)', () => {
  const g = G.novoGfa(8);
  const c = g.carro;
  Object.assign(c, { x: 100, z: 100, vel: 0, ang: 0 });
  for (const p of g.pedestres) Object.assign(p, { x: 1, z: 1 });
  const [a, b, caido] = g.pedestres;
  Object.assign(a, { x: 108, z: 100 });
  Object.assign(b, { x: 104, z: 103 });
  Object.assign(caido, { x: 101, z: 101, estado: 'caido', volta: Infinity });
  const tiros = correr(g, 700, () => ({ acel: 0, giro: 0, freio: false, tiro: true })).filter((e) => e.k === 'tiro');
  assert.equal(tiros[0].id, b.id, 'o primeiro tiro foi em outro');
  assert.equal(tiros[1].id, a.id);
});

test('GFA: morte de tiro sobe boleto e paga igual ao atropelo (Fatia 6: R$ 5 por morte e marcos, sem teto)', () => {
  const g = G.novoGfa(8);
  Object.assign(g.carro, { x: G.RUA / 2 + G.BLOCO * 3, z: G.RUA / 2 + G.BLOCO * 3, vel: 0, ang: 0 });
  correr(g, 1200, () => ({ acel: 0, giro: 0, freio: false, tiro: true }));
  const k = g.atropelos;
  assert.ok(k >= 3, `${k} mortes`);
  assert.equal(g.boletos, Math.min(5, Math.floor(k / 2) + 1));
  assert.deepEqual(G.premio(g), { grana: k * G.GRANA_POR_MORTE + G.bonusMarcos(k), mortes: k });
});

test('GFA: sem ninguém no alcance, o tiro sai e não mata ninguém', () => {
  const g = G.novoGfa(8);
  for (const p of g.pedestres) Object.assign(p, { x: 1, z: 1 });
  Object.assign(g.carro, { x: G.MUNDO - 6, z: G.MUNDO - 6, vel: 0 });
  const tiros = correr(g, 1200, () => ({ acel: 0, giro: 0, freio: false, tiro: true })).filter((e) => e.k === 'tiro');
  assert.ok(tiros.length >= 3 && tiros.every((e) => e.id === -1));
  assert.equal(g.atropelos, 0);
});

test('GFA: despedaçar solta cabeça, 2 braços e 2 pernas; os que vêm na câmera grudam na tela; sem sangue, ninguém perde nada', () => {
  const fx = F.novoFx(5);
  fx.cam = { x: 0, y: 6, z: -10 };
  let praTela = 0;
  for (let i = 0; i < 4 && !praTela; i++) {
    fx.pedacos.length = 0;
    F.despedacar(fx, 0, 0, 0, 12, 0, true);
    praTela = fx.pedacos.filter((p) => p.praTela).length;
  }
  assert.equal(fx.pedacos.length, 5);
  assert.deepEqual(fx.pedacos.map((p) => p.parte).sort(), ['braco', 'braco', 'cabeca', 'perna', 'perna']);
  assert.ok(praTela >= 1 && praTela <= 2, `${praTela} na câmera`);
  for (let i = 0; i < 120; i++) F.passoFx(fx, 1 / 60);
  assert.equal(fx.naTela.filter((n) => n.parte).length, praTela, 'os que vieram na câmera grudaram');
  for (let i = 0; i < 360; i++) F.passoFx(fx, 1 / 60);
  assert.ok(fx.pedacos.every((p) => p.parado), 'os outros pararam no chão');
  const limpo = F.novoFx(6);
  limpo.cam = { x: 0, y: 6, z: -4 };
  for (let i = 0; i < 20; i++) F.despedacar(limpo, 0, 0, 0, 12, 0, false);
  assert.equal(limpo.pedacos.length, 0);
  assert.ok(limpo.naTela.length > 0 && limpo.naTela.every((n) => !n.gore && n.parte === null), 'de perto, só molho na tela');
});

test('GFA: clarão do tiro solta luz na boca e uma cápsula que cai', () => {
  const fx = F.novoFx(9);
  F.clarao(fx, 0, 0, 1, 0);
  assert.ok(fx.p.filter((p) => p.luz).length >= 7);
  assert.ok(fx.p.some((p) => p.cor === '#feae34' && p.chao), 'cápsula');
});

/* ------------------------------------------------------------------ Brechas: a vida do item de R$ 1.000, o lado de quem recebe, o trânsito */

const regras = await import('./mock-rules.mjs');

test('rajada não sai da mão: K não joga, E não troca por item do chão nem por móvel, nocaute não tira', () => {
  const m = mundo();
  const me = B.eu(m);
  soEstes(m, []);
  Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0 });
  me.arma = { tipo: 'rajada', usos: 1 };
  let ev = rodar(m, 300, (i) => ({ agarra: i === 0 }));
  assert.deepEqual(me.arma, { tipo: 'rajada', usos: 1 }, 'K jogou a rajada');
  assert.ok(ev.some((e) => e.k === 'aviso' && /não sai da mão/.test(e.texto)));
  // Item no chão bem embaixo de você.
  m.chao.push({ arma: 'katana', x: me.x, y: me.y, volta: 0, solto: true, usos: 15 });
  ev = rodar(m, 300, (i) => ({ usa: i === 0 }));
  assert.equal(me.arma.tipo, 'rajada', 'E trocou pelo item do chão');
  assert.ok(m.chao.some((a) => a.arma === 'katana'), 'a katana sumiu');
  // Móvel na frente (cadeira de plástico da calçada).
  const i = mapa.PROPS.findIndex((p) => p.kind === 'cadeira-plastico');
  const p = mapa.PROPS[i];
  m.chao.length = 0;
  Object.assign(me, { x: p.x - 0.3, y: p.y + 0.5, fx: 1, fy: 0 });
  rodar(m, 300, (k) => ({ usa: k === 0 }));
  assert.equal(me.arma.tipo, 'rajada', 'E trocou pelo móvel');
  assert.ok(!m.quebrados.has(i), 'levou o móvel mesmo assim');
  // Nocaute.
  B.ferir(m, me, m.corpos.find((c) => c.id === 'marrento'), { ...B.JAB, dano: 999 }, 1, 0);
  assert.equal(me.estado, 'ko');
  assert.equal(me.arma?.tipo, 'rajada', 'o nocaute tirou a rajada');
});

test('quem recebe a rajada pela rede: o golpe de 100 passa no filtro e nocauteia; outros itens seguem no teto de 40', () => {
  const lidos = rede.sanitizeVGolpes({
    vini: {
      0: { to: 'will', d: 100, kx: 1, ky: 0, w: 'rajada', f: true, t: 1 },
      1: { to: 'will', d: 41, kx: 1, ky: 0, w: 'katana', f: true, t: 1 },
      2: { to: 'will', d: 101, kx: 1, ky: 0, w: 'rajada', f: true, t: 1 },
    },
  });
  assert.deepEqual(lidos.map((g) => g.slot), [0]);
  assert.equal(B.golpeRecebido(100, 'rajada', true).dano, 100);
  assert.equal(B.golpeRecebido(100, 'katana', true).dano, 40);
  const m = mundo();
  const me = B.eu(m);
  me.vida = 100;
  me.estado = 'normal';
  B.receberGolpe(m, 'vini', 100, 1, 0, 'rajada', true);
  assert.equal(me.estado, 'ko');
});

test('regras (espelho): item na mão e hora da rajada no vivo; rajada com dano até 100 no vgolpe; o resto recusa', () => {
  const now = 3_000_000;
  const kv = ['cruzadabotecos', 'bar', 'vivo', 'will'];
  const vivo = { x: 5, y: 5, fx: 1, fy: 0, mx: 0, my: 0, e: 'n', vi: 100, lk: 'abcdefgh', at: now, on: true, sv: now };
  assert.ok(regras.allowed({}, kv, { ...vivo, w: 'rajada', r: now - 500 }, now));
  assert.ok(regras.allowed({}, kv, { ...vivo, w: 'katana' }, now));
  assert.ok(!regras.allowed({}, kv, { ...vivo, w: 'bazuca' }, now));
  assert.ok(!regras.allowed({}, kv, { ...vivo, w: 'soco' }, now), 'soco não é item na mão');
  assert.ok(!regras.allowed({}, kv, { ...vivo, r: now - 20_000 }, now), 'hora de disparo velha');
  const kg = ['cruzadabotecos', 'bar', 'vgolpe', 'will', '3'];
  const golpe = { to: 'vini', d: 100, kx: 1, ky: 0, w: 'rajada', f: true, t: now };
  assert.ok(regras.allowed({}, kg, golpe, now));
  assert.ok(!regras.allowed({}, kg, { ...golpe, d: 101 }, now));
  assert.ok(!regras.allowed({}, kg, { ...golpe, w: 'katana', d: 41 }, now));
  assert.ok(regras.allowed({}, kg, { ...golpe, w: 'katana', d: 40 }, now));
  // A regra publicada tem o mesmo desenho (texto): poder (rajada e os da Fatia 6) até 100, o resto até 40.
  const pub = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules.cruzadabotecos.bar;
  assert.match(pub.vgolpe.$player.$slot.d['.validate'], /<= 40 \|\| \(newData\.val\(\) <= 100 && newData\.parent\(\)\.child\('w'\)\.val\(\)\.matches\(\/\^\(rajada\|/);
  assert.match(pub.vivo.$player.w['.validate'], /rajada/);
  assert.ok(!/[(|](soco|empurrao)[|)]/.test(pub.vivo.$player.w['.validate']), 'soco e empurrão na lista do vivo');
});

test('GFA: parado na faixa para atirar, o carro civil freia atrás e nunca entra no seu', () => {
  const g = G.novoGfa(4);
  const v = g.civis.find((x) => x.eixo === 'z' && x.sentido === 1);
  // Seu carro parado na faixa dele, 12 m à frente.
  Object.assign(g.carro, { x: v.x, z: v.z + 12, vel: 0, ang: 0 });
  let menor = Infinity;
  for (let i = 0; i < Math.round(5 / G.DT_GFA); i++) {
    G.passoGfa(g, { acel: 0, giro: 0, freio: false, tiro: true });
    g.eventos.length = 0;
    const ao = (g.carro.z - v.z) * v.sentido;
    if (Math.abs(g.carro.x - v.x) < 2) menor = Math.min(menor, Math.abs(ao));
  }
  assert.ok(menor >= 4.0, `entrou no seu carro (${menor.toFixed(2)} m de centro a centro)`);
  assert.ok(menor < 8, 'nem chegou perto');
});

test('GFA: em 60 s de corrida com trânsito, nenhum carro civil fica dentro do seu', () => {
  const g = G.novoGfa(12);
  let pior = 0;
  let batidas = 0;
  for (let i = 0; i < Math.round(60 / G.DT_GFA) && !g.acabou; i++) {
    const fase = Math.floor(i / 180) % 4;
    G.passoGfa(g, { acel: 1, giro: fase === 1 ? 0.7 : fase === 3 ? -0.7 : 0, freio: false });
    g.eventos.length = 0;
    for (const v of g.civis) {
      const dirx = v.eixo === 'x' ? v.sentido : 0;
      const dirz = v.eixo === 'z' ? v.sentido : 0;
      const ao = Math.abs((g.carro.x - v.x) * dirx + (g.carro.z - v.z) * dirz);
      const lat = Math.abs((g.carro.x - v.x) * dirz - (g.carro.z - v.z) * dirx);
      if (ao < 4.1 && lat < 2.0) pior = Math.max(pior, Math.min(4.1 - ao, 2.0 - lat));
      assert.ok(!G.predio(v.x, v.z), `civil ${v.id} dentro de prédio aos ${Math.round(g.t)} ms`);
      assert.ok(v.x >= 2 && v.x <= G.MUNDO - 2 && v.z >= 2 && v.z <= G.MUNDO - 2, `civil ${v.id} fora do mapa`);
      batidas += g.t < v.batidoAte ? 1 : 0;
    }
  }
  assert.ok(pior < 0.6, `ficou ${pior.toFixed(2)} m dentro de um civil`);
});

test('GFA: bater de frente num civil joga o destroço para o lado livre (nunca contra o muro) e você segue', () => {
  // Rua da beira do mapa (z = RUA/2): o único lado livre é para dentro da cidade.
  const g = G.novoGfa(2);
  g.pedestres.length = 0;
  const v = g.civis.find((x) => x.eixo === 'z');
  g.civis = [v];
  Object.assign(g.carro, { x: 60, z: G.RUA / 2, ang: Math.PI / 2, vel: 20 });
  Object.assign(v, { x: 64.5, z: G.RUA / 2, vel: 0, batidoAte: 0 });
  let tranco = null;
  for (let i = 0; i < 60; i++) {
    G.passoGfa(g, { acel: 1, giro: 0, freio: false });
    if (!tranco && g.eventos.some((e) => e.k === 'batida')) tranco = { kx: v.kx, kz: v.kz };
    g.eventos.length = 0;
  }
  assert.ok(tranco, 'não houve batida');
  assert.ok(tranco.kx > 5, `o destroço não foi para a frente (kx ${tranco.kx.toFixed(1)})`);
  assert.ok(tranco.kz > 3, `o destroço foi para o muro (kz ${tranco.kz.toFixed(1)})`);
  for (let i = 0; i < 180; i++) {
    G.passoGfa(g, { acel: 1, giro: 0, freio: false });
    g.eventos.length = 0;
  }
  assert.ok(g.carro.x > v.x + 2, 'não passou do destroço');
  assert.ok(g.carro.vel > 10, `empacou (${g.carro.vel.toFixed(1)} m/s)`);
});

test('GFA: encostar devagar num civil já batido empurra ele (você não fica preso atrás)', () => {
  const g = G.novoGfa(2);
  g.pedestres.length = 0;
  const v = g.civis.find((x) => x.eixo === 'z');
  g.civis = [v];
  Object.assign(g.carro, { x: 60, z: G.RUA / 2, ang: Math.PI / 2, vel: 2 });
  Object.assign(v, { x: 64.3, z: G.RUA / 2, vel: 0, batidoAte: 1e9, kx: 0, kz: 0, giro: 0 });
  const x0 = g.carro.x;
  // Força baixa (só arrasto, sem tranco novo): segura o acelerador em 0,25.
  for (let i = 0; i < 60; i++) {
    G.passoGfa(g, { acel: 0.25, giro: 0, freio: false });
    g.eventos.length = 0;
    if (Math.abs(g.carro.vel) > 3.5) g.carro.vel = 3.5;
  }
  assert.ok(g.carro.x - x0 > 1.5, `ficou preso atrás (${(g.carro.x - x0).toFixed(2)} m)`);
  assert.ok(v.x > 64.3 + 1, 'o civil não foi empurrado');
});

test('GFA: caçando carro civil por 60 s (3 sementes), o destroço nunca entra em prédio nem passa do muro', () => {
  let batidas = 0;
  for (const sem of [5, 6, 7]) {
    const g = G.novoGfa(sem);
    g.pedestres.length = 0;
    for (let i = 0; i < Math.round(60 / G.DT_GFA); i++) {
      const c = g.carro;
      let alvo = g.civis[0];
      for (const v of g.civis) if (Math.hypot(v.x - c.x, v.z - c.z) < Math.hypot(alvo.x - c.x, alvo.z - c.z)) alvo = v;
      let da = Math.atan2(alvo.x - c.x, alvo.z - c.z) - c.ang;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      // Preso: dá ré de lado por um tempo.
      const re = i % 300 > 260;
      G.passoGfa(g, { acel: re ? -1 : 1, giro: re ? 1 : Math.max(-1, Math.min(1, da * 2)), freio: false });
      batidas += g.eventos.filter((e) => e.k === 'batida').length;
      g.eventos.length = 0;
      g.acabou = false;
      // Fatia 6: carro (seu e civil) tem vida e explode; aqui só interessa para onde o destroço vai.
      g.vida = 999;
      for (const v of g.civis) v.vida = 999;
      for (const v of g.civis) {
        assert.ok(!G.predio(v.x, v.z), `semente ${sem}: civil ${v.id} dentro de prédio aos ${Math.round(g.t)} ms`);
        assert.ok(v.x >= 2 && v.x <= G.MUNDO - 2 && v.z >= 2 && v.z <= G.MUNDO - 2, `semente ${sem}: civil ${v.id} fora do mapa`);
      }
    }
  }
  console.log('    batidas no teste do destroço:', batidas);
  assert.ok(batidas >= 6, `só ${batidas} batidas (o teste não exercitou o destroço)`);
});

console.log(`\n${passed} testes da Fatia 5 passaram`);
