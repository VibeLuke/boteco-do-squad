// Testes da Dimensão GFA, Fatia 6: cenário destrutível, civis que explodem, polícia que atira, vida e recompensa por mortes.
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

const G = await import('../src/gfa/simulacao.ts');
const F = await import('../src/gfa/fx.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};
const PARADO = { acel: 0, giro: 0, freio: false };
/** Roda `ms` e devolve os eventos; `ent(i)` dá os comandos; `antes(g, i)` mexe no estado a cada passo. */
const rodar = (g, ms, ent = () => PARADO, antes = null) => {
  const ev = [];
  const n = Math.round(ms / 1000 / G.DT_GFA);
  for (let i = 0; i < n && !g.acabou; i++) {
    if (antes) antes(g, i);
    G.passoGfa(g, ent(i));
    ev.push(...g.eventos);
    g.eventos.length = 0;
  }
  return ev;
};
/** Cidade vazia: sem trânsito, pedestres caídos num canto (nada atrapalha o que o teste quer medir). */
const deserto = (semente) => {
  const g = G.novoGfa(semente);
  g.civis.length = 0;
  for (const p of g.pedestres) Object.assign(p, { estado: 'caido', volta: Infinity, x: 1, z: 1, dx: 0, dz: 0 });
  return g;
};
/** Põe um pedestre de pé e parado onde o teste manda. */
const pedestre = (g, i, x, z) => Object.assign(g.pedestres[i], { estado: 'anda', x, z, dx: 0, dz: 0, volta: 0 });
/** Deixa só um objeto no cenário, do tipo e no lugar pedidos. */
const soUm = (g, tipo, x, z) => {
  const o = g.objetos[0];
  Object.assign(o, { tipo, x, z, vida: G.OBJETOS[tipo].vida, estado: 'inteiro', jatoAte: 0 });
  g.objetos.length = 1;
  g.vitrines.length = 0;
  return o;
};
/** Carro na rua do começo (z = 5), apontando para +x, com a velocidade pedida. */
const lancar = (g, vel, x = 61) => Object.assign(g.carro, { x, z: G.RUA / 2, ang: Math.PI / 2, vel, lado: 0, roda: 0 });
const soma = (ev, k) => ev.filter((e) => e.k === k);
/** Motorista de teste: persegue o civil vivo mais perto durante 2/3 do tempo (para haver batida, fogo e explosão); o resto segue `giroBase`. */
const cacar = (g, i, giroBase) => {
  const alvo = g.civis.filter((v) => !v.morto).sort((a, b) => Math.hypot(a.x - g.carro.x, a.z - g.carro.z) - Math.hypot(b.x - g.carro.x, b.z - g.carro.z))[0];
  if (!alvo || i % 600 >= 400) return giroBase;
  let da = Math.atan2(alvo.x - g.carro.x, alvo.z - g.carro.z) - g.carro.ang;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  return Math.max(-1, Math.min(1, da * 2));
};

test('cenário: 300 objetos na calçada (nunca em prédio) e obras de cones no meio da rua; vitrines na fachada; tudo vem da semente', () => {
  const g = G.novoGfa(11);
  const calcada = g.objetos.slice(0, G.N_OBJETOS);
  const obras = g.objetos.slice(G.N_OBJETOS);
  assert.equal(calcada.length, G.N_OBJETOS);
  assert.ok(obras.length >= G.N_OBRAS * G.CONES_POR_OBRA * 0.75 && obras.length % G.CONES_POR_OBRA === 0, `${obras.length} cones de obra`);
  // Cone de obra: na rua, na linha do meio (o trânsito passa a 2,5 m dos lados), fora do cruzamento.
  for (const o of obras) {
    assert.equal(o.tipo, 'cone');
    assert.ok(!G.naCalcada(o.x, o.z) && !G.predio(o.x, o.z), `cone ${o.id} fora da rua`);
    const lx = o.x % G.BLOCO;
    const lz = o.z % G.BLOCO;
    const meioX = Math.abs(lz - G.RUA / 2) < 1e-6 && lx > G.RUA;
    const meioZ = Math.abs(lx - G.RUA / 2) < 1e-6 && lz > G.RUA;
    assert.ok(meioX || meioZ, `cone ${o.id} fora da linha do meio (${lx.toFixed(2)}, ${lz.toFixed(2)})`);
  }
  const tipos = new Set(calcada.map((o) => o.tipo));
  assert.ok(tipos.size >= 9, `só ${tipos.size} tipos`);
  assert.ok(G.TIPOS_OBJETO.every((t) => OBJ_OK(t)));
  for (const o of calcada) {
    const r = G.OBJETOS[o.tipo].raio;
    assert.ok(G.naCalcada(o.x, o.z), `objeto ${o.id} (${o.tipo}) fora da calçada em ${o.x.toFixed(2)},${o.z.toFixed(2)}`);
    for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) assert.ok(!G.predio(o.x + dx, o.z + dz), `objeto ${o.id} (${o.tipo}) toca prédio`);
    assert.equal(o.estado, 'inteiro');
    assert.equal(o.vida, G.OBJETOS[o.tipo].vida);
  }
  // Não ficam um em cima do outro.
  for (const a of g.objetos) for (const b of g.objetos) if (a.id < b.id) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 1.7, 'objetos sobrepostos');
  // Vitrines coladas na fachada de algum prédio (nunca dentro dele nem no meio da rua).
  assert.ok(g.vitrines.length >= 80, `${g.vitrines.length} vitrines`);
  for (const v of g.vitrines) {
    assert.ok(!G.predio(v.x, v.z));
    const lx = v.x % G.BLOCO;
    const lz = v.z % G.BLOCO;
    const naFace = v.eixo === 'x' ? Math.abs(lz - 12.5) < 1e-6 || Math.abs(lz - 21.5) < 1e-6 : Math.abs(lx - 12.5) < 1e-6 || Math.abs(lx - 21.5) < 1e-6;
    assert.ok(naFace, `vitrine ${v.id} fora da fachada`);
  }
  // Mesma semente, mesmo cenário; outra semente, outro.
  const h = G.novoGfa(11);
  const k = G.novoGfa(12);
  assert.deepEqual(h.objetos, g.objetos);
  assert.deepEqual(h.vitrines, g.vitrines);
  assert.notDeepEqual(k.objetos.map((o) => [o.x, o.z]), g.objetos.map((o) => [o.x, o.z]));
});
function OBJ_OK(t) {
  const i = G.OBJETOS[t];
  return i.vida > 0 && i.raio > 0 && i.peso > 0 && i.peso < 0.5;
}

test('objeto: bater a 15 m/s num poste quebra, tira velocidade (peso 22%) e solta o evento; hidrante quebrado esguicha 7 s', () => {
  const g = deserto(1);
  const o = soUm(g, 'poste', 70, G.RUA / 2);
  lancar(g, 15);
  let vAntes = 0;
  const ev = rodar(g, 3000, () => PARADO, (gg) => {
    if (o.estado === 'inteiro') vAntes = gg.carro.vel;
  });
  assert.equal(o.estado, 'quebrado');
  assert.equal(o.vida, 0);
  const e = soma(ev, 'objeto');
  assert.equal(e.length, 1);
  assert.ok(e[0].quebrou && e[0].tipo === 'poste' && e[0].forca > 13 && e[0].vx > 5, JSON.stringify(e[0]));
  assert.ok(vAntes > 13.5, `chegou com ${vAntes.toFixed(2)}`);
  // Logo depois da batida o carro está a ~78% da velocidade de antes (menos um fiapo de arrasto).
  const g2 = deserto(1);
  const o2 = soUm(g2, 'poste', 70, G.RUA / 2);
  lancar(g2, 15);
  let v0 = 0;
  let v1 = 0;
  for (let i = 0; i < 400 && o2.estado === 'inteiro'; i++) {
    v0 = g2.carro.vel;
    G.passoGfa(g2, PARADO);
    v1 = g2.carro.vel;
    g2.eventos.length = 0;
  }
  assert.equal(o2.estado, 'quebrado');
  assert.ok(v1 < v0 * 0.8 && v1 > v0 * 0.7, `${v0.toFixed(2)} -> ${v1.toFixed(2)}`);
  // Hidrante: quebra e jorra por 7 s.
  const h = deserto(2);
  const hid = soUm(h, 'hidrante', 70, G.RUA / 2);
  lancar(h, 12);
  rodar(h, 2500);
  assert.equal(hid.estado, 'quebrado');
  assert.ok(Math.abs(hid.jatoAte - (h.t - 0) ) < 7000 + 1);
  assert.ok(hid.jatoAte > h.t, 'sem jato');
});

test('objeto: abaixo de 4 m/s nada quebra (o objeto aguenta e o carro desliza em volta); a 4,5 m/s o cone cai', () => {
  const g = deserto(3);
  const o = soUm(g, 'poste', 57, G.RUA / 2);
  lancar(g, 3.9, 50);
  let vMax = 0;
  const ev = rodar(g, 3000, () => PARADO, (gg) => {
    vMax = Math.max(vMax, Math.abs(gg.carro.vel));
  });
  assert.ok(vMax < 4);
  assert.equal(o.estado, 'inteiro');
  assert.equal(o.vida, G.OBJETOS.poste.vida);
  assert.equal(soma(ev, 'objeto').length, 0);
  assert.ok(g.carro.x < o.x, 'atravessou o poste');
  // Acelerando devagar contra ele (a 3 m/s) ele segue de pé.
  const h = deserto(3);
  const p = soUm(h, 'poste', 64, G.RUA / 2);
  lancar(h, 3, 50);
  rodar(h, 4000, () => ({ acel: 0.1, giro: 0, freio: false }));
  assert.ok(Math.abs(h.carro.vel) < 4 && p.estado === 'inteiro');
  // Na borda de cima: 4,5 m/s derruba o cone (vida 3).
  const k = deserto(3);
  const cone = soUm(k, 'cone', 53, G.RUA / 2);
  lancar(k, 4.5, 50);
  rodar(k, 1500);
  assert.equal(cone.estado, 'quebrado');
});

test('objeto: a árvore aguenta o primeiro tranco a 10 m/s (só racha e segura o carro) e cai no segundo', () => {
  const g = deserto(4);
  const o = soUm(g, 'arvore', 70, G.RUA / 2);
  lancar(g, 10);
  const ev = rodar(g, 2500);
  const e = soma(ev, 'objeto');
  assert.ok(e.length >= 1 && e[0].quebrou === false, 'a árvore devia só rachar');
  assert.ok(o.vida > 0 && o.vida < G.OBJETOS.arvore.vida);
  assert.equal(o.estado, 'inteiro');
  lancar(g, 14, 60);
  rodar(g, 2500);
  assert.equal(o.estado, 'quebrado');
});

test('vitrine: raspar na fachada a mais de 3 m/s estilhaça; devagar não', () => {
  const g = deserto(5);
  const fachada = 12.5; // prédio (0,0): a face de baixo fica em z = 12,5, a calçada vai de 10 a 12,5
  g.objetos.length = 0;
  g.vitrines.length = 0;
  g.vitrines.push({ id: 0, x: 60, z: fachada, eixo: 'x', comp: 3.6, estado: 'inteira' });
  g.vitrines.push({ id: 1, x: 100, z: fachada, eixo: 'x', comp: 3.6, estado: 'inteira' });
  // Devagar (2 m/s) na calçada, colado na fachada.
  Object.assign(g.carro, { x: 52, z: fachada - 1.2, ang: Math.PI / 2, vel: 2, lado: 0, roda: 0 });
  rodar(g, 1500, () => PARADO);
  assert.equal(g.vitrines[0].estado, 'inteira', 'quebrou devagar');
  // Depressa (10 m/s) raspando.
  Object.assign(g.carro, { x: 90, z: fachada - 1.2, ang: Math.PI / 2, vel: 10, lado: 0, roda: 0 });
  const ev = rodar(g, 1500, () => PARADO);
  assert.equal(g.vitrines[1].estado, 'quebrada');
  assert.deepEqual(soma(ev, 'vitrine').map((e) => e.id), [1]);
});

test('civil: sem vida pega fogo, explode 1 s depois, mata quem está a pé em 6 m (conta como morte sua) e vira carcaça', () => {
  const g = deserto(6);
  Object.assign(g.carro, { x: 150, z: 5, vel: 0 });
  g.civis.push({ id: 0, x: 80, z: 5, eixo: 'x', sentido: 1, vel: 10, ang: Math.PI / 2, cor: 0, batidoAte: 0, giro: 0, kx: 0, kz: 0, vida: G.VIDA_CIVIL, fogo: false, explodeEm: 0, morto: false, proxDano: 0 });
  const v = g.civis[0];
  pedestre(g, 0, 83, 5); // a 3 m: morre
  pedestre(g, 1, 80, 10.5); // a 5,5 m: morre
  pedestre(g, 2, 80, 14); // a 9 m: vive
  pedestre(g, 3, 80, 5.2).estado = 'caido'; // já no chão: não conta
  g.pedestres[3].volta = Infinity;
  v.vida = 0;
  const ev1 = rodar(g, 500);
  assert.equal(soma(ev1, 'fogo').length, 1);
  assert.equal(soma(ev1, 'explosao').length, 0, 'explodiu antes do tempo');
  assert.equal(g.atropelos, 0);
  const ev2 = rodar(g, 1200);
  const ex = soma(ev2, 'explosao');
  assert.equal(ex.length, 1);
  assert.equal(ex[0].quem, 'civil');
  assert.deepEqual(ex[0].mortos.sort(), [0, 1]);
  assert.equal(g.atropelos, 2, 'as mortes da explosão contam');
  assert.ok(g.boletos >= 1);
  assert.equal(g.pedestres[0].estado, 'voa');
  assert.equal(g.pedestres[2].estado, 'anda');
  assert.ok(v.morto);
  // A carcaça fica onde caiu (não volta a andar na faixa).
  const x0 = v.x;
  const z0 = v.z;
  rodar(g, 4000);
  assert.ok(Math.hypot(v.x - x0, v.z - z0) < 8 && v.vel === 0, 'a carcaça andou');
});

test('civil: a explosão fere o seu carro pela distância (35 × (1 − d/6)) e nem encosta se estiver a mais de 6 m', () => {
  const dano = (dist) => {
    const g = deserto(7);
    // Carcaça-alvo parada em (80,5); o seu carro a `dist` m dela, de lado (fora da caixa de colisão).
    g.civis.push({ id: 0, x: 80, z: 5, eixo: 'x', sentido: 1, vel: 0, ang: 0, cor: 0, batidoAte: Infinity, giro: 0, kx: 0, kz: 0, vida: 0, fogo: false, explodeEm: 0, morto: false, proxDano: 0 });
    Object.assign(g.carro, { x: 80, z: 5 + dist, vel: 0, ang: 0 });
    let explodiu = null;
    for (let i = 0; i < 200 && !explodiu; i++) {
      G.passoGfa(g, PARADO);
      explodiu = g.eventos.find((e) => e.k === 'explosao') ?? null;
      if (explodiu) {
        const d = Math.hypot(explodiu.x - g.carro.x, explodiu.z - g.carro.z);
        return { vida: g.vida, d };
      }
      g.eventos.length = 0;
    }
    return { vida: g.vida, d: Infinity };
  };
  const perto = dano(3);
  assert.ok(perto.d > 2.5 && perto.d < 3.5);
  assert.ok(Math.abs(perto.vida - (G.VIDA_MAX - 35 * (1 - perto.d / G.RAIO_EXPLOSAO))) < 1e-6, `vida ${perto.vida}`);
  assert.ok(perto.vida < 90);
  const longe = dano(9);
  assert.equal(longe.vida, G.VIDA_MAX);
});

test('civil: tiro tira 8 de vida do carro civil quando não há ninguém a pé, e 5 tiros o incendeiam', () => {
  const g = deserto(8);
  g.civis.push({ id: 0, x: 75, z: 5, eixo: 'x', sentido: 1, vel: 0, ang: 0, cor: 0, batidoAte: Infinity, giro: 0, kx: 0, kz: 0, vida: G.VIDA_CIVIL, fogo: false, explodeEm: 0, morto: false, proxDano: 0 });
  Object.assign(g.carro, { x: 50, z: 5, vel: 0, ang: Math.PI / 2 });
  const ev = rodar(g, 1500, () => ({ acel: 0, giro: 0, freio: false, tiro: true }));
  const tiros = soma(ev, 'tiro').filter((e) => e.civ === 0);
  assert.ok(tiros.length >= 5, `${tiros.length} tiros no carro`);
  assert.ok(tiros.every((e) => e.id === -1));
  assert.ok(g.civis[0].fogo, 'não pegou fogo');
  assert.equal(soma(ev, 'fogo').length, 1);
  assert.equal(g.atropelos, 0);
});

/** Segura as viaturas a `dist` m do seu carro (de lado, à direita) para medir só o tiro, sem cerco nem batida. */
const segurar = (dist, boletos, ms, vel = 0, semente = 9) => {
  const g = deserto(semente);
  Object.assign(g.carro, { x: 100, z: 5, ang: Math.PI / 2, vel });
  g.boletos = boletos;
  const ev = rodar(g, ms, () => PARADO, (gg) => {
    gg.boletosAte = gg.t + 60_000;
    gg.carro.vel = vel;
    for (const v of gg.viaturas) Object.assign(v, { x: gg.carro.x - 3, z: gg.carro.z + dist, vel: 0, vida: G.VIDA_VIATURA });
  });
  return { g, ev };
};

test('polícia: com 2 boletos as duas viaturas atiram em você (4 a 8 de dano por acerto, ~1,2 s por viatura); com 0 ou 1 boleto não atira', () => {
  const { g, ev } = segurar(12, 2, 10_000);
  assert.equal(g.viaturas.length, 2);
  const tiros = soma(ev, 'tiroPolicia');
  assert.ok(tiros.length >= 12 && tiros.length <= 18, `${tiros.length} tiros em 10 s`);
  const acertos = tiros.filter((t) => t.acerto);
  assert.ok(acertos.length >= 4 && acertos.length < tiros.length, `${acertos.length} acertos`);
  assert.ok(tiros.every((t) => (t.acerto ? t.dano >= 4 && t.dano <= 8 : t.dano === 0)));
  const total = acertos.reduce((s, t) => s + t.dano, 0);
  assert.ok(Math.abs(g.vida - (G.VIDA_MAX - total)) < 1e-9, `vida ${g.vida} x ${G.VIDA_MAX - total}`);
  assert.ok(g.vida < G.VIDA_MAX && g.vida > 20, `vida ${g.vida.toFixed(1)} depois de 10 s parado a 12 m`);
  console.log(`   (10 s parado a 12 m com 2 boletos: ${tiros.length} tiros, ${acertos.length} acertos, vida ${g.vida.toFixed(1)})`);
  // Mesma cena, mesma semente: mesmo resultado.
  const outra = segurar(12, 2, 10_000);
  assert.equal(outra.g.vida, g.vida);
  for (const b of [0, 1]) {
    const s = segurar(12, b, 10_000);
    assert.equal(soma(s.ev, 'tiroPolicia').length, 0, `${b} boleto(s) atirou`);
    assert.equal(s.g.vida, G.VIDA_MAX);
  }
  // Longe (30 m, além do alcance de 25) não atira, mesmo com 4 boletos.
  const longe = segurar(30, 4, 6000);
  assert.equal(soma(longe.ev, 'tiroPolicia').length, 0);
});

test('polícia: a chance de acertar cai com a distância e com a sua velocidade', () => {
  const c = G.chanceAcerto;
  assert.ok(c(5, 0) > c(15, 0) && c(15, 0) > c(25, 0));
  assert.ok(c(10, 0) > c(10, 15) && c(10, 15) > c(10, 30));
  assert.ok(c(0, 0) <= 0.9 && c(25, 30) >= 0.1);
  // Parado e a 12 m acerta mais do que a 30 m/s (medido com viaturas seguradas).
  const lento = segurar(12, 2, 15_000, 0);
  const rapido = segurar(12, 2, 15_000, 28);
  const taxa = (r) => {
    const t = soma(r.ev, 'tiroPolicia');
    return t.filter((x) => x.acerto).length / t.length;
  };
  assert.ok(taxa(lento) > taxa(rapido), `${taxa(lento).toFixed(2)} x ${taxa(rapido).toFixed(2)}`);
});

test('vida zero: o carro explode, a corrida acaba como destruído e leva metade da grana; presa também leva metade', () => {
  const g = deserto(10);
  Object.assign(g.carro, { x: 100, z: 5, ang: Math.PI / 2, vel: 0 });
  g.boletos = 3;
  g.atropelos = 10; // R$ 70 brutos
  g.vida = 14;
  const ev = rodar(g, 30_000, () => PARADO, (gg) => {
    gg.boletosAte = gg.t + 60_000;
    for (const v of gg.viaturas) Object.assign(v, { x: gg.carro.x - 3, z: gg.carro.z + 8, vel: 0, vida: G.VIDA_VIATURA });
  });
  assert.ok(g.acabou && g.destruido && !g.presa, 'devia acabar destruído');
  assert.equal(g.vida, 0);
  assert.ok(soma(ev, 'destruido').length === 1);
  assert.ok(soma(ev, 'explosao').some((e) => e.quem === 'eu'));
  assert.ok(g.t < 20_000, `levou ${g.t} ms`);
  assert.deepEqual(G.premio(g), { grana: 35, mortes: 10 });
  const livre = { ...g, destruido: false };
  assert.equal(G.premio(livre).grana, 70);
  assert.equal(G.premio({ ...livre, presa: true }).grana, 35);
  // Depois de acabar, nada anda.
  const t = g.t;
  G.passoGfa(g, PARADO);
  assert.equal(g.t, t);
});

test('viatura: bater forte nela tira vida dos dois (a dela mais) e ela explode, sai da pista e outra nasce longe', () => {
  const g = deserto(11);
  g.boletos = 2;
  Object.assign(g.carro, { x: 100, z: 5, ang: Math.PI / 2, vel: 0 });
  rodar(g, 100, () => PARADO, (gg) => {
    gg.boletosAte = gg.t + 60_000;
  });
  assert.equal(g.viaturas.length, 2);
  const alvo = g.viaturas[0];
  const idAntigo = alvo.id;
  Object.assign(alvo, { x: 115, z: 5, ang: -Math.PI / 2, vel: 8, vida: 12 });
  Object.assign(g.carro, { x: 100, z: 5, ang: Math.PI / 2, vel: 22 });
  const vida0 = g.vida;
  const ev = rodar(g, 1500, () => ({ acel: 1, giro: 0, freio: false }), (gg) => {
    gg.boletosAte = gg.t + 60_000;
    for (const v of gg.viaturas) if (v.id !== idAntigo) Object.assign(v, { x: 20, z: 190, vel: 0 });
  });
  assert.ok(soma(ev, 'explosao').some((e) => e.quem === 'viatura'), 'a viatura não explodiu');
  assert.ok(!g.viaturas.some((v) => v.id === idAntigo), 'a viatura destruída continua na pista');
  assert.equal(g.viaturas.length, 2, 'outra devia nascer');
  assert.ok(g.vida < vida0, 'a batida não tirou vida de você');
  assert.ok(vida0 - g.vida < 50,`tirou demais: ${(vida0 - g.vida).toFixed(1)}`);
});

test('recompensa: R$ 5 por morte e bônus por marco, sem teto; presa ou destruído leva metade', () => {
  const g = G.novoGfa(12);
  const pagar = (m, esperado) => {
    g.atropelos = m;
    assert.equal(G.premio(g).grana, esperado, `${m} mortes`);
    assert.equal(G.premio(g).mortes, m);
  };
  pagar(0, 0);
  pagar(1, 5);
  pagar(9, 45);
  pagar(10, 70);
  pagar(24, 140);
  pagar(25, 195);
  pagar(49, 5 * 49 + 70);
  pagar(50, 440);
  pagar(99, 5 * 99 + 190);
  pagar(100, 990);
  pagar(1000, 5000 + 490);
  g.presa = true;
  assert.equal(G.premio(g).grana, 2745);
  g.presa = false;
  g.destruido = true;
  g.atropelos = 25;
  assert.equal(G.premio(g).grana, 97);
  assert.deepEqual(G.MARCOS.map((m) => [m.mortes, m.bonus]), [[10, 20], [25, 50], [50, 120], [100, 300]]);
  assert.deepEqual(G.proximoMarco(0), { mortes: 10, bonus: 20 });
  assert.deepEqual(G.proximoMarco(10), { mortes: 25, bonus: 50 });
  assert.equal(G.proximoMarco(100), null);
  assert.equal(G.GRANA_POR_MORTE, 5);
  assert.equal(G.TETO_GRANA, undefined, 'o teto saiu');
});

test('recompensa: a 10ª morte solta o evento do marco (+R$ 20) uma vez só', () => {
  const g = deserto(13);
  Object.assign(g.carro, { x: 100, z: 5, ang: Math.PI / 2, vel: 0 });
  g.atropelos = 8;
  pedestre(g, 0, 110, 5);
  pedestre(g, 1, 112, 5);
  pedestre(g, 2, 114, 5);
  const ev = rodar(g, 2000, () => ({ acel: 0, giro: 0, freio: false, tiro: true }), (gg) => {
    gg.boletosAte = gg.t + 60_000;
  });
  assert.ok(g.atropelos >= 11, `${g.atropelos} mortes`);
  const m = soma(ev, 'marco');
  assert.deepEqual(m, [{ k: 'marco', mortes: 10, bonus: 20 }]);
  assert.equal(G.premio({ ...g, presa: false, destruido: false }).grana, g.atropelos * 5 + 20);
});

test('efeitos: objeto quebrado solta cacos que caem, quicam e somem; hidrante esguicha; explosão e vidro soltam luz e cacos', () => {
  const fx = F.novoFx(3);
  F.quebrarObjeto(fx, 'poste', 70, 5, 8, 0, 15);
  assert.ok(fx.detritos.length >= 6 && fx.detritos.length === 8);
  assert.ok(fx.detritos.every((d) => d.cor.startsWith('#')));
  for (let i = 0; i < 90; i++) F.passoFx(fx, 1 / 60);
  assert.ok(fx.detritos.every((d) => d.y >= d.tam / 2 - 1e-9), 'caco abaixo do chão');
  assert.ok(fx.detritos.some((d) => d.parado), 'nenhum caco parou');
  for (let i = 0; i < 60 * 17; i++) F.passoFx(fx, 1 / 60);
  assert.equal(fx.detritos.length, 0, 'cacos eternos');
  // O limite de cacos vale.
  const lotado = F.novoFx(4);
  for (let i = 0; i < 40; i++) F.quebrarObjeto(lotado, 'banca', 70, 5, 3, 3, 10);
  assert.ok(lotado.detritos.length <= F.MAX_DETRITOS);
  // Vidro e explosão.
  const v = F.novoFx(5);
  F.estilhacar(v, 60, 12.5, 'x');
  assert.equal(v.detritos.length, 12);
  assert.ok(v.detritos.every((d) => Math.abs(d.x - 60) <= 1.8 + 1e-9 && d.z === 12.5));
  const e = F.novoFx(6);
  F.explosao(e, 80, 5);
  assert.ok(e.p.some((p) => p.luz) && e.p.some((p) => !p.luz) && e.detritos.length === 14 && e.tremor >= 0.25);
  // Jato d'água e chamas saem de g.
  const g = deserto(14);
  const o = soUm(g, 'hidrante', 70, 5);
  Object.assign(o, { estado: 'quebrado', jatoAte: g.t + 7000 });
  Object.assign(g.carro, { x: 60, z: 5, vel: 0 });
  const j = F.novoFx(7);
  for (let i = 0; i < 30; i++) F.passoFx(j, 1 / 60, g, PARADO);
  const agua = j.p.filter((p) => p.cor === '#68aed4' || p.cor === '#c0cbdc');
  assert.ok(agua.length >= 6, `${agua.length} gotas`);
  // Hidrante seco (jato acabou) não esguicha mais.
  o.jatoAte = 0;
  const seco = F.novoFx(7);
  for (let i = 0; i < 30; i++) F.passoFx(seco, 1 / 60, g, PARADO);
  assert.equal(seco.p.filter((p) => p.cor === '#68aed4').length, 0);
  // Carro civil em chamas solta labaredas.
  g.civis.push({ id: 0, x: 66, z: 5, eixo: 'x', sentido: 1, vel: 0, ang: 0, cor: 0, batidoAte: Infinity, giro: 0, kx: 0, kz: 0, vida: 0, fogo: true, explodeEm: 1e9, morto: false, proxDano: 0 });
  const f = F.novoFx(8);
  for (let i = 0; i < 30; i++) F.passoFx(f, 1 / 60, g, PARADO);
  assert.ok(f.p.some((p) => p.cor === '#f77622' || p.cor === '#fee761'), 'sem chama');
});

test('determinístico: mesma semente e mesmos comandos (com polícia, explosões e cenário quebrando) = mesma corrida, bit a bit', () => {
  let gAtual = null;
  const ent = (i) => ({ acel: 1, giro: cacar(gAtual, i, Math.sin(i / 45)), freio: false, tiro: i % 700 > 600 });
  const estado = (g) => JSON.stringify({ c: g.carro, v: g.vida, p: g.pedestres, o: g.objetos, vt: g.vitrines, ci: g.civis, vi: g.viaturas, n: g.atropelos, b: g.boletos, t: g.t });
  const roda = (sem) => {
    const g = G.novoGfa(sem);
    gAtual = g;
    g.boletos = 3;
    const ev = rodar(g, 45_000, ent, (gg) => {
      gg.boletosAte = gg.t + 60_000;
    });
    return { g, ev };
  };
  const a = roda(21);
  const b = roda(21);
  assert.equal(estado(a.g), estado(b.g));
  assert.equal(JSON.stringify(a.ev), JSON.stringify(b.ev));
  assert.notEqual(estado(roda(22).g), estado(a.g));
  const quebrados = a.g.objetos.filter((o) => o.estado === 'quebrado').length;
  console.log(`   (45 s dirigindo à toa: ${quebrados} objetos quebrados, ${a.g.vitrines.filter((v) => v.estado === 'quebrada').length} vitrines, vida ${a.g.vida.toFixed(1)}, ${a.g.atropelos} mortes, ${a.g.civis.filter((c) => c.morto).length} carcaças)`);
});

test('invariantes: com cenário, polícia e explosões, o carro nunca entra em prédio e nenhum civil fica dentro dele (3 sementes)', () => {
  for (const sem of [31, 32, 33]) {
    const g = G.novoGfa(sem);
    let s = sem * 7919;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    let giro = 0;
    let n = 0;
    for (let i = 0; i < 60 * 60 && !g.acabou; i++) {
      if (i % 50 === 0) giro = r() * 2 - 1;
      g.boletosAte = g.t + 60_000;
      if (i === 5) g.boletos = 3;
      G.passoGfa(g, { acel: 1, giro: cacar(g, i, giro), freio: false });
      g.eventos.length = 0;
      n++;
      assert.ok(!G.predio(g.carro.x, g.carro.z) && !G.foraDoMundo(g.carro.x, g.carro.z), `carro em prédio (sem ${sem}, passo ${i})`);
      for (const v of g.civis) {
        assert.ok(!G.predio(v.x, v.z), `civil ${v.id} em prédio (sem ${sem}, passo ${i})`);
        if (!g.acabou) {
          const ao = Math.abs(g.carro.x - v.x);
          const lat = Math.abs(g.carro.z - v.z);
          // Caixas 4,2 × 2 (qualquer orientação): o centro do seu carro não fica dentro da caixa do civil parado de lado.
          assert.ok(Math.hypot(ao, lat) > 1.0, `civil ${v.id} dentro do seu carro (sem ${sem}, passo ${i})`);
        }
      }
    }
    console.log(`   (semente ${sem}: ${n} passos, ${g.objetos.filter((o) => o.estado === 'quebrado').length} objetos quebrados, ${g.atropelos} mortes, vida ${g.vida.toFixed(0)}${g.destruido ? ', destruído' : ''})`);
    assert.ok(n > 200, `corrida acabou cedo demais (${n} passos)`);
  }
});


test('tiro sem ninguém nem carro no alcance: acerta o objeto mais perto (até 20 m) e quebra a lixeira em 2 tiros; longe, nada', () => {
  const g = deserto(8);
  const o = soUm(g, 'lixeira', 58, 11);
  Object.assign(g.carro, { x: 50, z: 5, vel: 0, ang: Math.PI / 2 });
  const ev = rodar(g, 1500, () => ({ acel: 0, giro: 0, freio: false, tiro: true }));
  const nele = soma(ev, 'tiro').filter((e) => Math.abs(e.x - 58) < 1e-6 && Math.abs(e.z - 11) < 1e-6);
  assert.ok(nele.length >= 2, `${nele.length} tiros na lixeira`);
  assert.equal(o.estado, 'quebrado');
  assert.equal(soma(ev, 'objeto').filter((e) => e.quebrou).length, 1);
  // Mais longe que o alcance: o tiro vai para o lado e nada quebra.
  const g2 = deserto(8);
  const o2 = soUm(g2, 'lixeira', 50 + G.ALCANCE_OBJETO + 2, 11);
  Object.assign(g2.carro, { x: 50, z: 5, vel: 0, ang: Math.PI / 2 });
  const ev2 = rodar(g2, 1500, () => ({ acel: 0, giro: 0, freio: false, tiro: true }));
  assert.equal(o2.estado, 'inteiro');
  assert.equal(soma(ev2, 'objeto').length, 0);
  // Vitrine inteira no alcance também estilhaça no tiro.
  const g3 = deserto(8);
  g3.objetos.length = 0;
  g3.vitrines.length = 1;
  Object.assign(g3.vitrines[0], { x: 60, z: 12.5, eixo: 'x', estado: 'inteira' });
  Object.assign(g3.carro, { x: 50, z: 5, vel: 0, ang: Math.PI / 2 });
  const ev3 = rodar(g3, 600, () => ({ acel: 0, giro: 0, freio: false, tiro: true }));
  assert.equal(g3.vitrines[0].estado, 'quebrada');
  assert.equal(soma(ev3, 'vitrine').length, 1);
});
console.log(`\n${passed} testes da Fatia 6 do GFA passaram`);
