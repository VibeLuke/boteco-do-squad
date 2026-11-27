// Testes da Fatia 4 (26/11): item no lugar do soco (troca no E, jogar fora no K), taco arrastado da sinuca,
// pátio e paredão dos procurados, gore progressivo, Dona Maria, itens novos, banheiro assombrado e o portal.
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
const sprites = await import('../src/arena/sprites.ts');
const gente = await import('../src/vivo/gente.ts');
const rotina = await import('../src/vivo/rotina.ts');
const arte = await import('../src/vivo/arte.ts');
const loja = await import('../src/vivo/loja.ts');
const A = await import('../src/vivo/assombro.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

const T0 = 1_800_000_300_000;
const DT = 1 / 60;
const mundo = (semente = 7) => B.novoMundo('will', T0, semente);
const corpo = (m, id) => m.corpos.find((c) => c.id === id);
function plantar(m, id, x, y) {
  const c = corpo(m, id);
  Object.assign(c, { x, y, humor: 'voltando', rota: null });
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
function soEstes(m, ids) {
  for (const c of m.corpos) {
    if (c.quem !== 'npc' || ids.includes(c.id)) continue;
    c.estado = 'ko';
    c.koAte = Infinity;
    c.x = 1.5;
    c.y = 13.5;
  }
}

/* ------------------------------------------------------------------ Lote A: item no lugar do soco */

test('item substitui o soco: J bate com o item (dano dele) e gasta; K joga fora e o J volta a ser soco', () => {
  const m = mundo();
  soEstes(m, ['marrento']);
  const me = B.eu(m);
  me.arma = { tipo: 'faca', usos: 12 };
  const mar = plantar(m, 'marrento', 0, 0);
  mar.vida = mar.vidaMax = 1e6;
  mar.atordoadoAte = Infinity;
  const bate = () => {
    Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0, fase: 'nada' });
    Object.assign(mar, { x: 6.3, y: 5.5, vx: 0, vy: 0 });
    return rodar(m, 900, (j) => ({ soco: j === 0 })).filter((e) => e.k === 'golpe' && e.de === 'eu');
  };
  const g1 = bate();
  assert.equal(g1.length, 1);
  assert.equal(g1[0].dano, B.ARMAS.faca.dano, 'J não usou a faca');
  assert.equal(g1[0].arma, 'faca');
  assert.equal(me.arma.usos, 11);
  // K: joga fora (arremessa) e volta ao soco.
  Object.assign(me, { x: 5.5, y: 5.5, fx: -1, fy: 0, fase: 'nada' });
  rodar(m, 600, (j) => ({ agarra: j === 0 }));
  assert.equal(me.arma, null, 'K não jogou fora');
  const g2 = bate();
  assert.equal(g2.length, 1);
  assert.equal(g2[0].arma, null, 'depois de jogar fora, o J tinha de ser soco');
});

test('E troca: com item na mão, pegar outro larga o da mão no chão com os usos que sobraram; pegar de volta devolve', () => {
  const m = mundo();
  soEstes(m, []);
  const me = B.eu(m);
  const [gx, gy] = mapa.ARMAS_NO_CHAO[0].at; // garrafa
  me.arma = { tipo: 'faca', usos: 5 };
  Object.assign(me, { x: gx + 0.5, y: gy + 0.5, fx: 1, fy: 0 });
  rodar(m, 50, (k) => ({ usa: k === 0 }));
  assert.equal(me.arma?.tipo, 'garrafa', 'não trocou');
  const largada = m.chao.find((a) => a.solto && a.arma === 'faca');
  assert.ok(largada, 'a faca não ficou no chão');
  assert.equal(largada.usos, 5);
  // A faca largada está no pé: o próximo E troca de volta (a garrafa cai, a faca volta com 5).
  rodar(m, 50, (k) => ({ usa: k === 0 }));
  assert.equal(me.arma?.tipo, 'faca');
  assert.equal(me.arma.usos, 5, 'a faca voltou com usos cheios (devia guardar os 5)');
  assert.ok(!m.chao.some((a) => a.solto && a.arma === 'faca'), 'a faca pega continua no chão');
  assert.ok(m.chao.some((a) => a.solto && a.arma === 'garrafa' && a.usos === B.ARMAS.garrafa.usos));
  // Teto: no máximo MAX_SOLTOS largadas.
  for (let i = 0; i < B.MAX_SOLTOS + 5; i++) {
    me.arma = { tipo: 'faca', usos: 3 };
    Object.assign(me, { x: 10.5 + (i % 3) * 0.01, y: 7.5 });
    m.chao.push({ arma: 'cano', x: 10.5, y: 7.5, volta: 0, solto: true, usos: 2 });
    rodar(m, 50, (k) => ({ usa: k === 0 }));
  }
  assert.ok(m.chao.filter((a) => a.solto).length <= B.MAX_SOLTOS, `${m.chao.filter((a) => a.solto).length} largadas`);
});

test('móvel com item na mão: o E pega o móvel e larga o item no chão (não ignora mais)', () => {
  const m = mundo();
  soEstes(m, ['ze']);
  const me = B.eu(m);
  me.arma = { tipo: 'cano', usos: 3 };
  Object.assign(me, { x: 2.5, y: 5.4, fx: 0, fy: 1 });
  rodar(m, 100, (k) => ({ usa: k === 0 }));
  assert.equal(me.arma?.tipo, 'cadeirao');
  assert.ok(m.chao.some((a) => a.solto && a.arma === 'cano' && a.usos === 3));
});

/* ------------------------------------------------------------------ Lote A: taco arrastado */

const G = await import('../src/vivo/tacoGesto.ts');
const BI = await import('../src/vivo/bilhar.ts');

test('taco: arrastar para baixo dá força (0 → 1 em PUXADA_MAX) com qualquer mira; para cima não; de lado só ajusta fino', () => {
  for (const mira0 of [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: -0.6, y: 0.8 }]) {
    const p0 = { x: 1, y: 0.6 };
    const q = (dx, dy) => G.puxada(mira0, p0, { x: p0.x + dx, y: p0.y + dy });
    assert.equal(q(0, 0).forca, 0);
    assert.equal(q(0, -0.3).forca, 0, 'arrastar para cima deu força');
    assert.ok(Math.abs(q(0, G.PUXADA_MAX / 2).forca - 0.5) < 1e-9, 'meio arrasto para baixo não deu meia força');
    assert.equal(q(0, G.PUXADA_MAX * 3).forca, 1);
    const r = q(0, 0.2);
    assert.ok(Math.abs(r.dx - mira0.x) < 1e-9 && Math.abs(r.dy - mira0.y) < 1e-9, 'arrastar reto para baixo mexeu na mira');
    const lado = q(0.1, 0.2);
    const giro = Math.atan2(mira0.x * lado.dy - mira0.y * lado.dx, mira0.x * lado.dx + mira0.y * lado.dy);
    assert.ok(giro > 0 && giro < 0.05, `ajuste fino errado: ${giro}`);
    assert.ok(Math.abs(Math.hypot(lado.dx, lado.dy) - 1) < 1e-9);
    // Voltar ao ponto do clique = desistência.
    assert.ok(q(0, 0.01).forca < G.FORCA_MIN);
  }
  assert.deepEqual(G.mirar({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 1 }), { x: 0, y: 1 }, 'ponto em cima da branca');
});

test('bola fantasma: na saída, mirando na bola da frente, encosta nela a 2R; mirando para fora do triângulo, nada', () => {
  const m = BI.novaMesa(3);
  const br = m.bolas[0];
  // A bola mais perto da branca na linha da branca.
  const alvo = m.bolas.filter((b) => b.n !== 0).sort((a, b) => Math.hypot(a.x - br.x, a.y - br.y) - Math.hypot(b.x - br.x, b.y - br.y))[0];
  const d = G.mirar(br, alvo);
  const f = G.bolaFantasma(m, br, d);
  assert.ok(f, 'não achou a bola');
  assert.equal(f.n, alvo.n);
  assert.ok(Math.abs(Math.hypot(f.x - alvo.x, f.y - alvo.y) - 2 * BI.R) < 1e-9);
  assert.equal(G.bolaFantasma(m, br, { x: -d.x, y: -d.y }), null, 'mirando para trás achou bola');
});

/* ------------------------------------------------------------------ Lote B: pátio, paredão, mercado */

const { findPath } = await import('../src/bar/path.ts');
const F = await import('../src/vivo/ficha.ts');
const regras = await import('./mock-rules.mjs');

test('pátio: entra pelo portão do muro, chega ao paredão e à banca; o banheiro continua só pela porta', () => {
  const de = { x: Math.floor(mapa.ENTRADA[0]), y: Math.floor(mapa.ENTRADA[1]) };
  for (let y = 0; y <= mapa.FACHADA; y++) {
    const portao = y >= mapa.PORTAO_PATIO[0] && y <= mapa.PORTAO_PATIO[1];
    assert.equal(mapa.anda(mapa.MURO_PATIO, y), portao, `muro em ${mapa.MURO_PATIO},${y}`);
  }
  for (const [x, y] of [[33, 1], [38, 3], [Math.floor(mapa.BALCAO_MERCADO[0]), Math.floor(mapa.BALCAO_MERCADO[1])]])
    assert.ok(findPath(mapa.anda, de, { x, y }, 4000).length > 0, `${x},${y} sem caminho`);
  assert.ok(mapa.PAREDE.some((e) => e.kind === 'procurados' && e.from >= mapa.MURO_PATIO && e.to <= mapa.FIM_PATIO));
  assert.equal(mapa.zonaDe(43, 3), 'banheiro');
  for (let y = 0; y < 6; y++) for (const x of [40, 41]) assert.equal(mapa.anda(x, y), false);
});

test('mercado separado: E na frente da banca abre o mercado; nada mais interativo disputa a zona', () => {
  const m = mundo();
  soEstes(m, ['muamba']);
  const me = B.eu(m);
  Object.assign(me, { x: mapa.BALCAO_MERCADO[0], y: mapa.BALCAO_MERCADO[1], fx: 0, fy: -1 });
  const ev = rodar(m, 50, (k) => ({ usa: k === 0 }));
  assert.ok(ev.some((e) => e.k === 'jogo' && e.jogo === 'mercado'), JSON.stringify(ev.map((e) => e.k)));
  const [bx, by] = mapa.BALCAO_MERCADO;
  const perto = (x, y) => Math.hypot(x - bx, y - by) < mapa.RAIO_MERCADO + 1.2;
  for (const j of mapa.JOGOS) assert.ok(!perto(j.at[0] + 0.5, j.at[1] + 0.5), `jogo ${j.nome} colado`);
  for (const p of mapa.PORTAS) assert.ok(!perto(p.at[0] + 0.5, p.at[1] + 0.5), 'porta colada');
  for (const a of mapa.ARMAS_NO_CHAO) assert.ok(!perto(a.at[0] + 0.5, a.at[1] + 0.5), `arma ${a.arma} colada`);
  for (const k of Object.values(mapa.CANTOS)) assert.ok(!perto(k.at[0], k.at[1]), 'amigo desmaiado colado');
  assert.ok(Math.hypot(mapa.ROCKY[0] - bx, mapa.ROCKY[1] - by) > 4, 'Rocky colado no mercado');
});

test('ficha: lê o banco com segurança, sobe de 10 em 10 e aponta o mais perigoso; a regra só deixa subir', () => {
  const f = F.sanitizeFicha({ will: { k: 7, t: 1 }, dani: { k: -3 }, tati: 'lixo', vini: { k: 2.9 } });
  assert.deepEqual(f, { vini: 2, will: 7, dani: 0, bia: 0, tati: 0 });
  assert.equal(F.proximoEnvio(5, 5), null);
  assert.equal(F.proximoEnvio(3, 0), 3);
  assert.equal(F.proximoEnvio(37, 4), 14);
  assert.equal(F.maisPerigoso(f), 'will');
  assert.equal(F.maisPerigoso(F.sanitizeFicha(null)), null);
  const now = 1_800_000_000_000;
  const tree = { cruzadabotecos: { bar: { ficha: {} } } };
  const pode = (k, t, cur) => {
    tree.cruzadabotecos.bar.ficha = cur ? { will: cur } : {};
    return regras.allowed(tree, ['cruzadabotecos', 'bar', 'ficha', 'will'], { k, t }, t);
  };
  assert.equal(pode(10, now), true);
  assert.equal(pode(11, now), false, 'primeira gravação acima de 10');
  assert.equal(pode(20, now, { k: 10, t: now - 3000 }), true);
  assert.equal(pode(21, now, { k: 10, t: now - 3000 }), false, 'subiu mais de 10');
  assert.equal(pode(9, now, { k: 10, t: now - 3000 }), false, 'desceu');
  assert.equal(pode(12, now, { k: 10, t: now - 1000 }), false, 'menos de 2 s');
  assert.equal(regras.allowed(tree, ['cruzadabotecos', 'bar', 'ficha', 'zé'], { k: 1, t: now }, now), false);
});

/* ------------------------------------------------------------------ Lote C: gore aos poucos, Dona Maria */

test('gore aos poucos: golpes de serra arrancam uma parte por vez, braços antes das pernas, cabeça nunca em pé', () => {
  let viuPerna = 0;
  for (let sem = 1; sem <= 30; sem++) {
    const m = mundo(sem);
    soEstes(m, ['pinguco']);
    const me = B.eu(m);
    const p = plantar(m, 'pinguco', 6.2, 5.5);
    p.vida = p.vidaMax = 1e6;
    let antes = 0;
    for (let k = 0; k < 60; k++) {
      B.ferir(m, p, me, B.ARMAS.serra, 1, 0, 'serra');
      const novos = m.eventos.splice(0).filter((e) => e.k === 'mutila');
      assert.ok(novos.length <= 1, `semente ${sem}: ${novos.length} partes num golpe só`);
      assert.equal(p.cortes & 16, 0, `semente ${sem}: cabeça saiu com ele de pé`);
      const ganhou = p.cortes & ~antes;
      if (ganhou & 12) assert.equal(antes & 3, 3, `semente ${sem}: perna saiu antes dos dois braços`);
      if (novos.length) assert.equal(ganhou, novos[0].parte === 'braco' ? (novos[0].lado === 'e' ? 1 : 2) : novos[0].lado === 'e' ? 4 : 8);
      antes = p.cortes;
    }
    if (p.cortes & 12) viuPerna++;
    assert.equal(p.estado, 'normal');
  }
  assert.ok(viuPerna >= 20, `só ${viuPerna}/30 chegaram às pernas em 60 golpes`);
  // Soco nunca arranca nada.
  const m = mundo(3);
  soEstes(m, ['pinguco']);
  const p = plantar(m, 'pinguco', 6.2, 5.5);
  p.vida = p.vidaMax = 1e6;
  for (let k = 0; k < 60; k++) B.ferir(m, p, B.eu(m), B.JAB, 1, 0, null);
  assert.equal(p.cortes, 0);
});

test('gore aos poucos: sem braço bate mais fraco, sem perna anda mais devagar; os tocos sangram até derrubar', () => {
  const m = mundo(4);
  soEstes(m, ['marrento', 'pinguco']);
  const mar = corpo(m, 'marrento');
  assert.equal(B.fatorBracos(mar), 1);
  mar.cortes = 1;
  assert.equal(B.fatorBracos(mar), 0.7);
  mar.cortes = 3;
  assert.equal(B.fatorBracos(mar), 0.4);
  mar.cortes = 4;
  assert.equal(B.fatorPernas(mar), 0.5);
  mar.cortes = 12;
  assert.equal(B.fatorPernas(mar), 0.25);
  // Andando de verdade (voltando para a rotina): sem uma perna cobre metade do caminho no mesmo tempo.
  const anda = (cortes) => {
    const mm = mundo(4);
    soEstes(mm, ['marrento']);
    const c = plantar(mm, 'marrento', 20.5, 13.5);
    c.cortes = cortes;
    rodar(mm, 400);
    return Math.hypot(c.x - 20.5, c.y - 13.5);
  };
  const d0 = anda(0);
  const d1 = anda(4);
  assert.ok(d0 > 0.5, `nem andou (${d0})`);
  assert.ok(Math.abs(d1 / d0 - 0.5) < 0.08, `sem perna andou ${d1.toFixed(2)} contra ${d0.toFixed(2)}`);
  // Dano real de um NPC sem um braço.
  mar.cortes = 1;
  const p = plantar(m, 'pinguco', 6.2, 5.5);
  p.vida = p.vidaMax = 1e6;
  B.ferir(m, p, mar, { ...B.JAB, dano: 20 }, 1, 0, null);
  const g = m.eventos.splice(0).find((e) => e.k === 'golpe');
  assert.equal(g.dano, 14);
  // Sangramento: dois tocos, vida 3 → cai em ~1,9 s e o nocaute é de quem cortou (conta na ficha e solta grana).
  const m2 = mundo(4);
  soEstes(m2, ['pinguco']);
  const me = B.eu(m2);
  Object.assign(me, { x: 15.5, y: 12.5 });
  const q = plantar(m2, 'pinguco', 6.2, 5.5);
  q.humor = 'calmo';
  q.vida = 3;
  q.cortes = 1 | 4;
  q.cortadoPor = me.id;
  const antes = m2.nocautes;
  const ev = rodar(m2, 1500);
  assert.equal(q.estado, 'normal', 'caiu cedo demais');
  assert.ok(q.vida < 1, `vida ${q.vida}`);
  ev.push(...rodar(m2, 1000));
  assert.equal(q.estado, 'ko');
  assert.ok(ev.some((e) => e.k === 'ko' && e.em === 'pinguco' && e.de === me.id));
  assert.equal(m2.nocautes, antes + 1);
});

test('gore aos poucos: o desenho em pé e caído perde cada parte (com toco), sem cortes é o mesmo boneco', () => {
  const look = gente.NPCS.find((n) => n.id === 'pinguco').look;
  const conta = (g) => g.flat().filter(Boolean).length;
  const inteiro = sprites.buildBarGridLook(look, 'front');
  assert.equal(sprites.cortarGrid(inteiro, 0), inteiro);
  const n0 = conta(inteiro);
  for (const bit of [1, 2, 4, 8, 16]) {
    const g = sprites.cortarGrid(inteiro, bit);
    assert.ok(conta(g) < n0, `bit ${bit}: não perdeu nada`);
    assert.ok(g.flat().includes('#a22633'), `bit ${bit}: sem toco`);
  }
  const tudo = sprites.cortarGrid(inteiro, 31);
  assert.ok(conta(tudo) < n0 * 0.6, `sobrou ${conta(tudo)}/${n0}`);
  // Calça escura da cor do contorno (Kelly) não some junto com o braço: as pernas ficam idênticas.
  const kelly = sprites.buildBarGridLook(gente.NPCS.find((n) => n.id === 'kelly').look, 'front');
  const sem = sprites.cortarGrid(kelly, 1 | 2);
  for (let y = 28; y < kelly.length; y++) assert.deepEqual(sem[y], kelly[y], `linha ${y} das pernas mudou`);
  // Toda pose (andando, de costas, sentado, soco, susto): sem os dois braços, nada sobra fora do tronco.
  for (const pose of ['front', 'front-a', 'front-b', 'back', 'back-a', 'back-b', 'sit', 'punch', 'hurt']) {
    const g0 = pose === 'punch' || pose === 'hurt' ? sprites.buildGridLook(look, pose) : sprites.buildBarGridLook(look, pose);
    const g = sprites.cortarGrid(g0, 3, pose === 'punch' || pose === 'hurt' ? pose : 'normal');
    let fora = 0;
    for (let y = 8; y < 26; y++) for (let x = 0; x < g[y].length; x++) if (g[y][x] && g[y][x] !== '#181425' && (x < 3 || x > 20 || (y > 18 && (x < 5 || x > 18)))) fora++;
    assert.equal(fora, 0, `${pose}: ${fora} px de braço sobrando`);
  }
  const morto = conta(sprites.buildDeadGridLook(look));
  assert.ok(conta(sprites.buildDeadCortadoGridLook(look, 1 | 8)) < morto);
  // A base usa a mesma grade (largura e altura) para não pular de posição.
  assert.equal(tudo.length, inteiro.length);
  assert.equal(tudo[0].length, inteiro[0].length);
});

test('Dona Maria: ciclo de 1 min cravado no relógio (Fatia 6), paradas pisáveis, chão molhado igual em todo aparelho', () => {
  const maria = gente.NPCS.find((n) => n.id === 'maria');
  assert.ok(maria && gente.FUNCIONARIOS.includes(maria.tipo));
  assert.equal(rotina.cicloDe(maria), 60000);
  for (const p of maria.rotina) assert.ok(mapa.anda(Math.floor(p.at[0]), Math.floor(p.at[1])), `parada ${p.at} não é chão`);
  const base = Math.ceil(T0 / 60000) * 60000;
  // No meio do descanso está parada no canto e o chão está seco; em algum momento do ciclo, limpa e molha.
  const r0 = rotina.rotinaEm(maria, base + 20000);
  assert.ok(Math.hypot(r0.x - gente.MARIA_DESCANSO[0], r0.y - gente.MARIA_DESCANSO[1]) < 0.01);
  assert.equal(B.molhadosEm(base + 20000).length, 0);
  let molhou = 0;
  let maxJunto = 0;
  for (let t = base; t < base + 60000; t += 500) {
    const w = B.molhadosEm(t);
    if (w.length) molhou++;
    maxJunto = Math.max(maxJunto, w.length);
    for (const p of w) assert.ok(p.ate > t && p.ate - t <= gente.MOLHADO_MS + 1100 + 1);
  }
  assert.ok(molhou * 500 >= 20000 && molhou * 500 <= 40000, `molhado por ${molhou * 500} ms`);
  assert.ok(maxJunto >= 3, `no máximo ${maxJunto} poças juntas`);
  // Mesmo ciclo seguinte (função pura da hora).
  assert.deepEqual(B.molhadosEm(base + 50000), B.molhadosEm(base + 110000).map((p) => ({ ...p, ate: p.ate - 60000 })));
});

test('Dona Maria: quem anda no molhado escorrega (fica tonto e desliza); ela mesma e quem está parado não', () => {
  const maria = gente.NPCS.find((n) => n.id === 'maria');
  const base = Math.ceil(T0 / 60000) * 60000;
  let tw = 0;
  for (let t = base; t < base + 60000 && !tw; t += 250) {
    const w = B.molhadosEm(t);
    if (w.some((p) => p.ate - t > 5000 && Math.hypot(p.x - 8.5, p.y - 5.5) < 0.01)) tw = t;
  }
  assert.ok(tw, 'a poça de 8,5 × 5,5 nunca molhou');
  let escorregou = 0;
  for (let sem = 1; sem <= 12; sem++) {
    const m = B.novoMundo('will', tw, sem);
    soEstes(m, ['maria']);
    const me = B.eu(m);
    Object.assign(me, { x: 7.9, y: 5.5 });
    const ev = rodar(m, 3000, (i) => ({ mx: Math.floor(i / 20) % 2 ? -1 : 1, my: 0 }));
    if (ev.some((e) => e.k === 'escorrega' && e.em === me.id)) escorregou++;
    assert.ok(!ev.some((e) => e.k === 'escorrega' && e.em === 'maria'));
    // Parado em cima da poça não escorrega.
    const m2 = B.novoMundo('will', tw, sem);
    soEstes(m2, ['maria']);
    Object.assign(B.eu(m2), { x: 8.5, y: 5.5 });
    assert.ok(!rodar(m2, 3000).some((e) => e.k === 'escorrega'));
  }
  assert.ok(escorregou >= 8, `só ${escorregou}/12 escorregaram andando 3 s no molhado`);
});

/* ------------------------------------------------------------------ Lote D: itens novos */

const NOVOS = ['frigideira', 'bastao', 'violao', 'extintor', 'guardasol', 'tijolo', 'espeto', 'placa', 'rodo', 'katana', 'marreta'];

test('itens novos: cada um tem desenho próprio (não o genérico), dano ≤ 40 e lugar no mapa ou no mercado', () => {
  const generico = arte.armaSprite('cadeira');
  const vistos = new Set();
  for (const k of NOVOS) {
    const a = B.ARMAS[k];
    assert.ok(a && a.dano <= 40 && a.usos > 0, k);
    const sp = arte.armaSprite(k);
    let cheios = 0;
    for (let i = 3; i < sp.raster.data.length; i += 4) if (sp.raster.data[i]) cheios++;
    assert.ok(cheios >= 20, `${k}: desenho quase vazio (${cheios} px)`);
    assert.notDeepEqual(sp.raster.data, generico.raster.data, `${k}: caiu no desenho genérico`);
    const assinatura = Buffer.from(sp.raster.data).toString('base64');
    assert.ok(!vistos.has(assinatura), `${k}: desenho repetido`);
    vistos.add(assinatura);
    const noChao = mapa.ARMAS_NO_CHAO.some((x) => x.arma === k);
    const naLoja = loja.CATALOGO.some((x) => x.arma === k);
    assert.ok(noChao !== naLoja, `${k}: tem que estar ou no chão ou no mercado (chão ${noChao}, mercado ${naLoja})`);
  }
  assert.equal(loja.CATALOGO.find((x) => x.arma === 'katana').preco, 120);
  assert.equal(loja.CATALOGO.find((x) => x.arma === 'marreta').preco, 60);
  // Katana e espeto entram no gore; marreta e bastão não.
  assert.ok(B.CORTE.katana > 0 && B.CORTE.espeto > 0 && !B.CORTE.marreta && !B.CORTE.bastao);
});

/** Bate uma vez com `arma` num pinguço parado na frente e devolve { alvo, ev }. */
function bateCom(arma, sem = 5) {
  const m = mundo(sem);
  soEstes(m, ['pinguco']);
  const me = B.eu(m);
  me.arma = { tipo: arma, usos: B.ARMAS[arma].usos };
  const p = plantar(m, 'pinguco', 0, 0);
  p.vida = p.vidaMax = 1e6;
  Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0, fase: 'nada' });
  Object.assign(p, { x: 6.3, y: 5.5, vx: 0, vy: 0 });
  const ev = [];
  let atordoado = 0;
  const n = Math.round(0.6 / DT);
  for (let i = 0; i < n; i++) {
    B.passo(m, { ...B.PARADO, soco: i === 0 }, DT);
    ev.push(...m.eventos);
    if (m.eventos.some((e) => e.k === 'golpe' && e.em === 'pinguco')) atordoado = p.atordoadoAte - m.t;
    m.eventos.length = 0;
  }
  return { m, me, p, ev, atordoado };
}

test('itens novos: frigideira atordoa o dobro, extintor cega 1 s, rodo e placa fazem escorregar', () => {
  const base = bateCom('garrafa').atordoado;
  assert.ok(base >= 400 && base <= 460, `garrafa ${base}`);
  const fr = bateCom('frigideira');
  assert.ok(fr.atordoado >= 2 * base - 60, `frigideira ${fr.atordoado} contra ${base}`);
  const ex = bateCom('extintor');
  assert.ok(ex.atordoado >= 950, `extintor ${ex.atordoado}`);
  for (const k of ['rodo', 'placa']) {
    const r = bateCom(k);
    assert.ok(r.ev.some((e) => e.k === 'escorrega' && e.em === 'pinguco'), `${k} não fez escorregar`);
    assert.ok(r.atordoado >= 850, `${k}: ${r.atordoado}`);
  }
  assert.ok(!bateCom('bastao').ev.some((e) => e.k === 'escorrega'));
  // Bastão empurra mais longe que a garrafa.
  const vg = bateCom('garrafa').p;
  const vb = bateCom('bastao').p;
  assert.ok(Math.abs(vb.x - 6.3) > Math.abs(vg.x - 6.3) * 1.3, `bastão ${vb.x.toFixed(2)} garrafa ${vg.x.toFixed(2)}`);
});

test('itens novos: o violão quebra no 3º golpe com frase; o tijolo acaba no 1º; a marreta quebra o móvel da frente', () => {
  const m = mundo(6);
  soEstes(m, ['pinguco']);
  const me = B.eu(m);
  me.arma = { tipo: 'violao', usos: 3 };
  const p = plantar(m, 'pinguco', 0, 0);
  p.vida = p.vidaMax = 1e6;
  const ev = [];
  for (let k = 0; k < 3; k++) {
    Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0, fase: 'nada' });
    Object.assign(p, { x: 6.3, y: 5.5, vx: 0, vy: 0, atordoadoAte: 0 });
    ev.push(...rodar(m, 900, (j) => ({ soco: j === 0 })));
  }
  assert.equal(me.arma, null, 'violão não quebrou');
  assert.ok(ev.some((e) => e.k === 'quebra' && e.arma === 'violao'));
  assert.ok(ev.some((e) => e.k === 'frase' && /ACORDE|pagode|Lá menor|violão/.test(e.texto)), 'sem frase do violão');
  assert.equal(bateCom('tijolo').me.arma, null);
  // Marreta: de frente para um móvel que quebra, sem ninguém na frente.
  const i = mapa.PROPS.findIndex((pr, j) => mapa.QUEBRAVEIS.has(pr.kind) && mapa.zonaDe(pr.x, pr.y) === 'bar' && mapa.anda(pr.x - 1, pr.y) && mapa.propIdx(pr.x, pr.y) === j);
  assert.ok(i >= 0, 'nenhum móvel quebrável com chão à esquerda');
  const pr = mapa.PROPS[i];
  for (const arma of ['marreta', 'bastao']) {
    const m2 = mundo(6);
    soEstes(m2, []);
    const eu2 = B.eu(m2);
    eu2.arma = { tipo: arma, usos: B.ARMAS[arma].usos };
    Object.assign(eu2, { x: pr.x - 0.5, y: pr.y + 0.5, fx: 1, fy: 0, fase: 'nada' });
    const ev2 = rodar(m2, 900, (j) => ({ soco: j === 0 }));
    const quebrou = ev2.some((e) => e.k === 'quebrou' && e.i === i);
    if (arma === 'marreta') {
      assert.ok(quebrou, `a marreta não quebrou ${pr.kind}`);
      assert.equal(eu2.arma.usos, B.ARMAS.marreta.usos - 1);
    } else assert.ok(!quebrou, 'o bastão quebrou móvel');
  }
});

/* ------------------------------------------------------------------ Lote E: banheiro assombrado */

test('luz do banheiro: igual em todo aparelho, apagões de 0,3 a 2 s e nunca mais de 3 trocas por segundo', () => {
  let apagou = 0;
  let calmas = 0;
  for (let w = 0; w < 400; w++) {
    const ap = A.apagoes(w);
    assert.deepEqual(ap, A.apagoes(w));
    if (!ap.length) calmas++;
    for (const [a, b] of ap) {
      assert.ok(b - a >= 300 && b - a <= 2000, `janela ${w}: ${b - a} ms`);
      assert.ok(a >= 0 && b <= 6000);
      apagou++;
    }
  }
  assert.ok(apagou > 200 && calmas > 80, `apagões ${apagou}, janelas calmas ${calmas}`);
  // Trocas por segundo, em janelas de 1 s deslizando de 100 em 100 ms, por 10 min de relógio.
  const t0 = 1_800_000_000_000;
  const amostra = [];
  for (let t = t0; t < t0 + 600_000; t += 10) amostra.push(A.luzBanheiro(t));
  let pior = 0;
  for (let i = 0; i + 100 <= amostra.length; i += 10) {
    let trocas = 0;
    for (let j = i + 1; j < i + 100; j++) if (amostra[j] !== amostra[j - 1]) trocas++;
    pior = Math.max(pior, trocas);
  }
  assert.ok(pior <= 6, `${pior} trocas (acende+apaga) num segundo`); // 6 trocas = 3 piscadas por segundo
});

function noBanheiro(sem = 3) {
  const m = mundo(sem);
  soEstes(m, []);
  const me = B.eu(m);
  Object.assign(me, { x: 44.5, y: 3.5, vida: me.vidaMax });
  const a = A.novoAssombro(sem);
  const andar = (ms, ligado = true, ent = () => ({})) => {
    const ev = [];
    const n = Math.round(ms / 1000 / DT);
    for (let i = 0; i < n; i++) {
      B.passo(m, { ...B.PARADO, ...ent(i) }, DT);
      A.passoAssombro(a, m, ligado, DT);
      ev.push(...m.eventos);
      m.eventos.length = 0;
    }
    return ev;
  };
  return { m, me, a, andar };
}

test('sustos: o primeiro vem aos 9 s, um a cada 45 s, sem repetir o último; cada um acaba no prazo', () => {
  const { a, andar } = noBanheiro(11);
  andar(8500);
  assert.equal(a.vistos, 0, 'susto antes dos 9 s');
  andar(700);
  assert.equal(a.vistos, 1);
  const tipos = [a.atual.k];
  for (let k = 0; k < 8; k++) {
    andar(A.INTERVALO_SUSTO_MS + 12_500);
    tipos.push(a.ultimo === tipos[tipos.length - 1] ? (a.atual?.k ?? a.ultimo) : a.ultimo);
  }
  assert.ok(a.vistos >= 8, `só ${a.vistos} sustos em ~8 min`);
  // Sem repetir em seguida e sem susto preso.
  const { a: a2, andar: andar2 } = noBanheiro(12);
  let ultimo = null;
  let maxDur = 0;
  let ini = 0;
  for (let i = 0; i < 60 * 60 * 12; i++) {
    andar2(1000 / 60);
    if (a2.atual && a2.atual.ini !== ini) {
      assert.notEqual(a2.atual.k, ultimo, 'repetiu o susto');
      ultimo = a2.atual.k;
      ini = a2.atual.ini;
    }
    if (a2.atual) maxDur = Math.max(maxDur, a2.atual.fim - a2.atual.ini);
  }
  assert.ok(a2.vistos >= 14, `${a2.vistos} sustos em 12 min`);
  assert.ok(maxDur <= Math.max(...Object.values(A.PRAZO)));
});

test('sustos: sair do banheiro, cair ou desligar acaba na hora; desligado não assusta nem pisca', () => {
  const { me, a, andar } = noBanheiro(5);
  andar(9500);
  assert.ok(a.atual);
  Object.assign(me, { x: 10.5, y: 5.5 });
  andar(50);
  assert.equal(a.atual, null);
  assert.equal(a.dentroDesde, null);
  Object.assign(me, { x: 44.5, y: 3.5 });
  andar(9500);
  assert.ok(a.atual);
  andar(50, false);
  assert.equal(a.atual, null);
  const vistos = a.vistos;
  andar(120_000, false);
  assert.equal(a.vistos, vistos);
  for (let t = 0; t < 60_000; t += 50) assert.equal(A.luzAgora(a, 1_800_000_000_000 + t, false), 1);
});

/** Força o próximo susto a ser `k`. */
function forcar(a, k) {
  a.ultimo = null;
  const i = A.SUSTOS.indexOf(k);
  a.sorteia = () => (i + 0.5) / A.SUSTOS.length;
}

test('sustos: o inquilino persegue e acerta 25 (sem derrubar); o chapéu vivo sai com 6 golpes ou no prazo', () => {
  const { me, a, andar } = noBanheiro(7);
  forcar(a, 'inquilino');
  const ev = andar(9100 + 6000);
  assert.ok(ev.some((e) => e.k === 'frase' && e.texto === A.NOME_SUSTO.inquilino));
  assert.ok(ev.some((e) => e.k === 'golpe' && e.de === 'susto' && e.dano === A.DANO_INQUILINO), 'o inquilino não acertou 25');
  assert.ok(me.vidaMax - me.vida >= A.DANO_INQUILINO - 3, `vida ${me.vida}`);
  assert.equal(a.atual, null);
  // Vida baixa: o susto não derruba.
  const b = noBanheiro(8);
  forcar(b.a, 'inquilino');
  b.andar(9100);
  b.me.vida = 5; // a vida volta sozinha: baixa só quando ele já saiu do box
  let menor = Infinity;
  for (let i = 0; i < 6000 / 50; i++) {
    b.andar(50);
    menor = Math.min(menor, b.me.vida);
  }
  assert.ok(menor >= 1 && b.me.estado === 'normal', `vida mínima ${menor}, ${b.me.estado}`);
  // Chapéu vivo: agarra e só sai na marra.
  const c = noBanheiro(9);
  forcar(c.a, 'chapeu');
  c.andar(9000 + 2500);
  assert.ok(c.a.atual?.k === 'chapeu' && c.a.atual.agarrado, 'não agarrou');
  const v0 = c.me.vida;
  const evC = c.andar(1000);
  const pulsos = evC.filter((e) => e.k === 'golpe' && e.de === 'susto').length;
  assert.ok(pulsos >= 1 && pulsos <= 2, `${pulsos} respingos em 1 s (piscava todo quadro)`);
  assert.ok(v0 - c.me.vida > 2, 'agarrado não tira vida');
  let ev2 = [];
  for (let k = 0; k < 6 && c.a.atual; k++) ev2 = ev2.concat(c.andar(700, true, (i) => ({ soco: i === 0 })));
  assert.equal(c.a.atual, null, `ainda agarrado depois de ${c.a.atual?.puxoes} puxões`);
  assert.ok(ev2.some((e) => e.k === 'frase' && /ARRANCOU/.test(e.texto)));
  // Sem apertar nada: larga no prazo.
  const d = noBanheiro(10);
  forcar(d.a, 'chapeu');
  d.andar(9000 + A.PRAZO.chapeu + 200);
  assert.equal(d.a.atual, null);
  assert.ok(d.me.vida >= 1);
});

test('sustos: todos os 7 rodam até o fim sem travar e voltam a fila', () => {
  for (const k of A.SUSTOS) {
    const { a, andar } = noBanheiro(20);
    forcar(a, k);
    andar(9100);
    assert.equal(a.atual?.k, k);
    andar(A.PRAZO[k] + 1000);
    assert.equal(a.atual, null, `${k} não acabou`);
    assert.equal(a.ultimo, k);
    assert.ok(a.prox > 0 && Number.isFinite(a.prox));
  }
});

/* ------------------------------------------------------------------ Lote G: acabamento dos bonecos */

test('acabamento: a forma não muda (nenhum pixel nasce ou some), a armação dos óculos fica e o boneco ganha volume', () => {
  for (const pl of sprites.PLAYERS) {
    for (const pose of ['front', 'back', 'front-a']) {
      const g = sprites.buildBarGridLook(pl.look, pose);
      const p = sprites.polir(g);
      let mudou = 0;
      for (let y = 0; y < g.length; y++)
        for (let x = 0; x < g[y].length; x++) {
          assert.equal(!!p[y][x], !!g[y][x], `${pl.id} ${pose}: forma mudou em ${x},${y}`);
          if (p[y][x] !== g[y][x]) mudou++;
        }
      assert.ok(mudou >= 60, `${pl.id} ${pose}: só ${mudou} px ganharam tom`);
      const cores = new Set(p.flat());
      const temVolume = (c) => cores.has(sprites.tonsDe(c).sombra) && cores.has(sprites.tonsDe(c).luz);
      const comVolume = [pl.look.shirt, pl.look.skin, pl.look.pants, pl.look.hair].filter(temVolume).length;
      assert.ok(comVolume >= 2, `${pl.id} ${pose}: só ${comVolume} peça(s) com sombra e luz`);
    }
    // Contorno de dentro (armação escura dos óculos) continua da cor dele.
    const g = sprites.buildBarGridLook(pl.look, 'front');
    const p = sprites.polir(g);
    for (let y = 1; y < g.length - 1; y++)
      for (let x = 1; x < g[y].length - 1; x++)
        if (g[y][x] === '#181425' && g[y - 1][x] && g[y + 1][x] && g[y][x - 1] && g[y][x + 1]) assert.equal(p[y][x], '#181425', `${pl.id}: contorno de dentro mudou`);
  }
  // Tons: a sombra é mais escura e a luz mais clara que a cor base; a borda é a mais escura.
  const lum = (c) => parseInt(c.slice(1, 3), 16) * 0.3 + parseInt(c.slice(3, 5), 16) * 0.59 + parseInt(c.slice(5, 7), 16) * 0.11;
  for (const c of ['#f2c9a5', '#262b44', '#3e8948', '#e43b44', '#8b9bb4']) {
    const t = sprites.tonsDe(c);
    assert.ok(lum(t.sombra) < lum(c) && lum(t.luz) > lum(c) && lum(t.borda) < lum(t.sombra), c);
  }
});

console.log(`\n${passed} testes da Fatia 4 passaram`);
