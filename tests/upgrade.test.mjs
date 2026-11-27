// Testes do upgrade grande (26/11): bater com o que pegou (móveis e mercado negro, durabilidade), porrete humano,
// mutilação no modo sangue, grana no nocaute, carteira do bar, muambeiro, Rocky e o mapa novo (2 mesas, portal).
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
const B = await import('../src/vivo/briga.ts');
const L = await import('../src/vivo/loja.ts');
const R = await import('../src/vivo/rede.ts');
const PD = await import('../src/vivo/poderes.ts');
const { findPath } = await import('../src/bar/path.ts');
const sprites = await import('../src/arena/sprites.ts');
const regras = await import('./mock-rules.mjs');

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
const idxDe = (kind, x, y) => mapa.PROPS.findIndex((p) => p.kind === kind && p.x === x && p.y === y);

/* ------------------------------------------------------------------ mapa novo */

test('mapa: 2 mesas de sinuca (3×2 cada), quiz no letreiro, portal no beco; tudo onde se pisa e alcançável da entrada', () => {
  assert.equal(mapa.PROPS.filter((p) => p.kind === 'sinuca').length, 2);
  assert.equal(mapa.PROPS.filter((p) => p.kind === 'void').length, 10);
  assert.ok(mapa.PAREDE.some((e) => e.kind === 'portal') && mapa.PAREDE.some((e) => e.kind === 'quiz'));
  assert.ok(!mapa.JOGOS.some((j) => j.nome.includes('sinuca') && j.jogo === 'quiz'), 'quiz ainda na sinuca');
  const de = { x: Math.floor(mapa.ENTRADA[0]), y: Math.floor(mapa.ENTRADA[1]) };
  const chega = (x, y, nome) => {
    const t = { x: Math.floor(x), y: Math.floor(y) };
    assert.ok(mapa.anda(t.x, t.y), `${nome} em ladrilho bloqueado (${x},${y})`);
    if (mapa.zonaDe(t.x, t.y) !== 'bar') return;
    const p = findPath(mapa.anda, de, t, 4000);
    assert.ok(p.length > 0 || (t.x === de.x && t.y === de.y), `${nome} sem caminho da entrada`);
  };
  for (const n of gente.NPCS) for (const p of n.rotina) chega(p.at[0], p.at[1], `parada de ${n.id}`);
  for (const p of gente.LUGARES) chega(p.at[0], p.at[1], 'lugar de cliente');
  for (const j of mapa.JOGOS) chega(j.at[0] + 0.5, j.at[1] + 0.5, j.nome);
  for (const a of mapa.ARMAS_NO_CHAO) chega(a.at[0] + 0.5, a.at[1] + 0.5, `arma ${a.arma}`);
  for (const [id, k] of Object.entries(mapa.CANTOS)) chega(k.at[0], k.at[1], `canto de ${id}`);
  chega(mapa.MUAMBEIRO[0], mapa.MUAMBEIRO[1], 'muambeiro');
  chega(mapa.ROCKY[0], mapa.ROCKY[1], 'Rocky');
  // O E do muambeiro e do Rocky não pode cair no bigode de um amigo desmaiado.
  for (const p of [mapa.MUAMBEIRO, mapa.ROCKY])
    for (const [id, k] of Object.entries(mapa.CANTOS)) assert.ok(Math.hypot(p[0] - k.at[0], p[1] - k.at[1]) >= 1.8, `colado no canto de ${id}`);
});

/* ------------------------------------------------------------------ bater com o que pegou */

test('móvel vira arma: E de frente para a cadeira de madeira pega, J bate (30), gasta uso e quebra no fim; o Zé repõe', () => {
  const m = mundo();
  soEstes(m, ['marrento', 'ze']);
  const me = B.eu(m);
  const i = idxDe('cadeira-bar', 2, 6);
  assert.ok(i >= 0);
  Object.assign(me, { x: 2.5, y: 5.4, fx: 0, fy: 1 });
  const ev = rodar(m, 100, (k) => ({ usa: k === 0 }));
  assert.equal(me.arma?.tipo, 'cadeirao', 'não pegou a cadeira');
  assert.equal(me.arma.usos, B.ARMAS.cadeirao.usos);
  assert.ok(m.quebrados.has(i), 'a cadeira continua no lugar');
  assert.ok(ev.some((e) => e.k === 'levou' && e.i === i));
  assert.ok(m.tarefas.some((x) => x.k === 'repor' && x.i === i), 'o Zé não vai repor');
  // Bate até acabar (alvo que não cai nem foge).
  const mar = plantar(m, 'marrento', 0, 0);
  mar.vida = mar.vidaMax = 1e6;
  mar.atordoadoAte = Infinity;
  const danos = [];
  for (let k = 0; k < 8 && me.arma; k++) {
    Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0, fase: 'nada' });
    Object.assign(mar, { x: 6.3, y: 5.5, vx: 0, vy: 0 });
    for (const e of rodar(m, 900, (j) => ({ soco: j === 0 }))) if (e.k === 'golpe' && e.de === 'eu') danos.push(e.dano);
  }
  assert.equal(danos.length, B.ARMAS.cadeirao.usos, `bateu ${danos.length} vezes`);
  assert.ok(danos.every((d) => d === 30));
  assert.equal(me.arma, null, 'a cadeira não quebrou no fim');
});

test('durabilidade: toda arma tem nome, dano ≤ 40 (regra do golpe entre amigos; a Rajada do Fiado até 100), usos > 0 e desenho; o golpe da rede aceita todas', () => {
  for (const [k, a] of Object.entries(B.ARMAS)) {
    assert.ok(a.nome && a.usos > 0 && a.dano > 0 && a.dano <= (PD.ehPoder(k) ? 100 : 40), k);
    assert.ok(R.ARMAS_REDE.includes(k), `${k} fora da rede`);
  }
  const regras = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'));
  const w = regras.rules.cruzadabotecos.bar.vgolpe.$player.$slot.w['.validate'];
  for (const k of R.ARMAS_REDE) assert.ok(new RegExp(w.match(/\/(.*)\//)[1]).test(k), `regra recusa ${k}`);
  for (const [k, t] of Object.entries(mapa.MOVEL_ARMA)) assert.ok(mapa.QUEBRAVEIS.has(k) && B.ARMAS[t], k);
});

test('porrete humano: segurando um, J bate com ele em quem está na frente (16) e ele apanha junto; sem ninguém, joelhada', () => {
  const m = mundo();
  soEstes(m, ['pinguco', 'biriba']);
  const me = B.eu(m);
  Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0 });
  const pin = plantar(m, 'pinguco', 6.2, 5.5);
  pin.atordoadoAte = Infinity;
  rodar(m, 50, (k) => ({ agarra: k === 0 }));
  assert.equal(me.segurando, 'pinguco');
  const bir = plantar(m, 'biriba', 6.6, 5.5);
  bir.vida = bir.vidaMax = 999;
  const ev = rodar(m, 300, (k) => ({ soco: k === 0 }));
  assert.ok(ev.some((e) => e.k === 'golpe' && e.em === 'biriba' && e.dano === 16), 'não bateu com o corpo');
  assert.ok(ev.some((e) => e.k === 'golpe' && e.em === 'pinguco' && e.dano === 6));
  assert.ok(ev.some((e) => e.k === 'frase' && /PORRETE|reciclável|cara roxa|FREGUÊS/.test(e.texto)));
  // Sem ninguém na frente: a joelhada de antes (9).
  bir.x = 12;
  const ev2 = rodar(m, 300, (k) => ({ soco: k === 0 }));
  assert.ok(ev2.some((e) => e.k === 'golpe' && e.em === 'pinguco' && e.dano === 9));
});

/* ------------------------------------------------------------------ gore, grana */

test('mutilação: serra no nocaute arranca (cabeça ou braço, aos poucos) quase sempre; soco fraco nunca', () => {
  let arrancou = 0;
  let soco = 0;
  const partes = new Set();
  for (let sem = 1; sem <= 40; sem++) {
    const m = mundo(sem);
    soEstes(m, ['pinguco']);
    const me = B.eu(m);
    const p = plantar(m, 'pinguco', 6.2, 5.5);
    p.vida = 5;
    B.ferir(m, p, me, B.ARMAS.serra, 1, 0, 'serra');
    const ev = m.eventos.splice(0);
    const mu = ev.find((e) => e.k === 'mutila');
    if (mu) {
      arrancou++;
      partes.add(mu.parte);
      const bit = mu.parte === 'cabeca' ? 16 : mu.parte === 'braco' ? (mu.lado === 'e' ? 1 : 2) : mu.lado === 'e' ? 4 : 8;
      assert.equal(p.cortes, bit);
    }
    const m2 = mundo(sem);
    soEstes(m2, ['pinguco']);
    const p2 = plantar(m2, 'pinguco', 6.2, 5.5);
    p2.vida = 5;
    B.ferir(m2, p2, B.eu(m2), B.JAB, 1, 0, null);
    if (m2.eventos.some((e) => e.k === 'mutila')) soco++;
  }
  assert.ok(arrancou >= 30, `serra arrancou só ${arrancou}/40`);
  assert.equal(soco, 0);
  // No golpe que derruba um corpo inteiro: a cabeça ou o primeiro braço (a perna só sai depois dos braços).
  assert.deepEqual([...partes].sort(), ['braco', 'cabeca'], `só ${[...partes]}`);
});

test('mutilação: o Tonhão (funcionário) levanta inteiro; o desenho sem cabeça e o pedaço existem e não são vazios', () => {
  const m = mundo(3);
  soEstes(m, ['tonhao']);
  const t = plantar(m, 'tonhao', 6.2, 5.5);
  t.cortes = 31;
  t.estado = 'ko';
  t.koAte = m.t + 100;
  rodar(m, 300);
  assert.equal(t.estado, 'normal');
  assert.equal(t.cortes, 0);
  const look = gente.NPCS[0].look;
  const conta = (g) => g.flat().filter(Boolean).length;
  const inteiro = conta(sprites.buildDeadGridLook(look));
  for (const parte of ['cabeca', 'braco', 'perna']) {
    const g = sprites.buildMutiladoGridLook(look, parte);
    assert.ok(conta(g) < inteiro, `${parte}: o corpo não perdeu nada`);
    assert.ok(g.flat().includes('#a22633'), `${parte}: sem toco`);
    assert.ok(conta(sprites.buildPedacoGridLook(look, parte)) > 8, `${parte}: pedaço vazio`);
  }
});

test('grana: quem você nocauteia deixa cair; passando por cima entra na carteira; some se ninguém pega', () => {
  const m = mundo(5);
  soEstes(m, ['pinguco']);
  const me = B.eu(m);
  Object.assign(me, { x: 9.5, y: 5.5 });
  const p = plantar(m, 'pinguco', 6.2, 5.5);
  p.vida = 1;
  B.ferir(m, p, me, B.JAB, 1, 0, null);
  m.eventos.length = 0;
  assert.ok(m.grana.length >= 1 && m.grana.length <= 3, `${m.grana.length} notas`);
  const total = m.grana.reduce((s, g) => s + g.v, 0);
  rodar(m, 300); // passa o congelamento do nocaute
  let pego = 0;
  for (const g of [...m.grana]) {
    Object.assign(me, { x: g.x, y: g.y });
    for (const e of rodar(m, 50)) if (e.k === 'grana') pego += e.v;
  }
  assert.equal(pego, total);
  assert.equal(m.grana.length, 0);
  // Nocaute feito por NPC não dá grana; nota esquecida some.
  const m2 = mundo(5);
  soEstes(m2, ['pinguco', 'marrento']);
  const p2 = plantar(m2, 'pinguco', 6.2, 5.5);
  p2.vida = 1;
  B.ferir(m2, p2, corpo(m2, 'marrento'), B.JAB, 1, 0, null);
  assert.equal(m2.grana.length, 0);
  m2.grana.push({ x: 20, y: 12, v: 3, ate: m2.t + 100 });
  rodar(m2, 300);
  assert.equal(m2.grana.length, 0);
});

test('limites: amigo nunca é arrancado; nota não cai dentro de móvel; móvel já levado não se pega de novo', () => {
  // Amigo desmaiado ou online apanha de serra, mas nunca perde pedaço (só NPC entra no gore).
  for (let sem = 1; sem <= 20; sem++) {
    const m = mundo(sem);
    soEstes(m, []);
    const amigo = m.corpos.find((c) => c.quem === 'amigo');
    assert.ok(amigo, 'sem amigo no mundo');
    // Em pé, como o amigo online (o desmaiado já está caído e nem chega ao nocaute).
    Object.assign(amigo, { quem: 'remoto', x: 6.2, y: 5.5, estado: 'normal', vida: 3, deitado: null });
    B.ferir(m, amigo, B.eu(m), B.ARMAS.serra, 1, 0, 'serra');
    assert.equal(amigo.cortes, 0, `semente ${sem}: arrancou pedaço de amigo`);
    assert.ok(!m.eventos.some((e) => e.k === 'mutila'));
  }
  // Nocaute colado na mesa de sinuca: as notas caem só no chão livre.
  const [px, py] = [15.6, 6.5];
  assert.ok([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6].some((a) => !mapa.anda(Math.floor(px + Math.cos(a) * 0.65), Math.floor(py + Math.sin(a) * 0.65))), 'o ponto do teste não encosta em nada');
  let notas = 0;
  for (let sem = 1; sem <= 40; sem++) {
    const m = mundo(sem);
    soEstes(m, ['pinguco']);
    const p = plantar(m, 'pinguco', px, py);
    p.vida = 1;
    B.ferir(m, p, B.eu(m), B.JAB, 1, 0, null);
    for (const g of m.grana) {
      notas++;
      assert.ok(mapa.anda(Math.floor(g.x), Math.floor(g.y)), `semente ${sem}: nota dentro de móvel em ${g.x.toFixed(2)},${g.y.toFixed(2)}`);
    }
  }
  assert.ok(notas > 20, `só ${notas} notas caíram`);
  // A cadeira pega some do lugar: o E no mesmo ladrilho não dá outra.
  const m = mundo();
  soEstes(m, ['ze']);
  const me = B.eu(m);
  Object.assign(me, { x: 2.5, y: 5.4, fx: 0, fy: 1 });
  rodar(m, 100, (k) => ({ usa: k === 0 }));
  assert.equal(me.arma?.tipo, 'cadeirao');
  me.arma = null;
  Object.assign(me, { x: 2.5, y: 5.4, fx: 0, fy: 1 });
  const ev = rodar(m, 100, (k) => ({ usa: k === 0 }));
  assert.equal(me.arma, null, 'pegou a mesma cadeira duas vezes');
  assert.ok(!ev.some((e) => e.k === 'levou'));
});

/* ------------------------------------------------------------------ muambeiro, Rocky, carteira */

test('muambeiro: E abre o mercado; derrubado não vende e levanta depois (não é recolhido)', () => {
  const m = mundo();
  soEstes(m, ['muamba']);
  const me = B.eu(m);
  const mu = plantar(m, 'muamba', 26.5, 3.5);
  Object.assign(me, { x: 25.6, y: 3.5, fx: 1, fy: 0 });
  assert.ok(rodar(m, 50, (k) => ({ usa: k === 0 })).some((e) => e.k === 'jogo' && e.jogo === 'mercado'));
  mu.vida = 1;
  B.ferir(m, mu, corpo(m, 'ze'), B.JAB, 1, 0, null);
  assert.equal(mu.estado, 'ko');
  assert.ok(!m.tarefas.some((x) => x.k === 'corpo' && x.id === 'muamba'), 'o Zé vai sumir com o muambeiro');
  assert.ok(!rodar(m, 50, (k) => ({ usa: k === 0 })).some((e) => e.k === 'jogo' && e.jogo === 'mercado'));
  rodar(m, 15000);
  assert.equal(mu.estado, 'normal', 'o muambeiro não levantou');
});

test('Rocky: E dá uma fala dele (sátira, cita o Mortier às vezes); não entra em treta', () => {
  const m = mundo();
  soEstes(m, ['rocky']);
  const me = B.eu(m);
  const ro = plantar(m, 'rocky', 25.6, 1.6);
  Object.assign(me, { x: 24.8, y: 1.6, fx: 1, fy: 0 });
  const falas = new Set();
  for (let k = 0; k < 30; k++) for (const e of rodar(m, 1000, (j) => ({ usa: j === 0 }))) if (e.k === 'rocky') falas.add(e.texto);
  assert.ok(falas.size >= 3, `${falas.size} falas`);
  assert.ok([...falas].some((f) => f.includes('Mortier')));
  assert.equal(ro.humor === 'briga', false);
});

test('equipar (compra): a arma comprada vai para a mão com os usos cheios; a antiga cai de vez (não volta para o chão)', () => {
  const m = mundo();
  const me = B.eu(m);
  me.arma = { tipo: 'cano', usos: 2 };
  const nChao = m.chao.length;
  B.equipar(m, 'serra');
  assert.deepEqual(me.arma, { tipo: 'serra', usos: B.ARMAS.serra.usos });
  assert.equal(m.chao.length, nChao);
  assert.ok(m.eventos.some((e) => e.k === 'quebra' && e.arma === 'cano'));
});

test('carteira: saldo = pontos ÷ 10 + achado − gasto; sem saldo não compra; banco e aparelho juntam pelo maior', () => {
  assert.equal(L.pontosDe({ a: { s: 1415 }, b: { s: 195 }, c: { s: 'x' }, d: null }), 1610);
  assert.equal(L.saldo(1610, { g: 0, a: 0 }), 161);
  assert.equal(L.saldo(1610, { g: 150, a: 7 }), 18);
  assert.equal(L.saldo(0, { g: 50, a: 10 }), 0, 'saldo negativo');
  const sem = L.comprar(100, { g: 0, a: 0 }, 'serra');
  assert.equal(sem.ok, false);
  assert.match(sem.motivo, /Falta R\$ 70/);
  const ok = L.comprar(800, { g: 0, a: 0 }, 'serra');
  assert.ok(ok.ok);
  assert.deepEqual(ok.carteira, { g: 80, a: 0 });
  assert.equal(L.comprar(800, { g: 0, a: 0 }, 'garrafa').ok, false, 'vendeu o que não tem');
  assert.deepEqual(L.juntar({ g: 30, a: 2 }, { g: 10, a: 9 }), { g: 30, a: 9 });
  assert.deepEqual(L.achar({ g: 1, a: 2 }, 3.7), { g: 1, a: 5 });
  assert.deepEqual(L.sanitizeCarteira({ g: -3, a: 'x' }), { g: 0, a: 0 });
  for (const it of L.CATALOGO) assert.ok(B.ARMAS[it.arma] && it.preco > 0 && it.papo);
  // Com zero de placar dá para comprar a faca depois de algumas brigas (a grana do chão chega).
  assert.ok(L.saldo(0, { g: 0, a: 15 }) >= L.CATALOGO[0].preco);
});

test('regras loja e mesa: carteira só sobe; mesa avança de 1 em 1 (ou recomeça); vaga só amigo, bot ou aberta', () => {
  const now = 5_000_000;
  const kl = ['cruzadabotecos', 'bar', 'loja', 'will'];
  assert.ok(regras.allowed({}, kl, { g: 10, a: 2, t: now }, now));
  const db = regras.setAt({}, kl, { g: 10, a: 2, t: now });
  assert.ok(!regras.allowed(db, kl, { g: 5, a: 2, t: now + 600 }, now + 600), 'gasto desceu');
  assert.ok(!regras.allowed(db, kl, { g: 12, a: 2, t: now + 100 }, now + 100), 'sem espera');
  assert.ok(regras.allowed(db, kl, { g: 12, a: 3, t: now + 600 }, now + 600));
  const km = ['cruzadabotecos', 'bar', 'mesa', '1'];
  const mesa = { a: 'will', b: 'bot2', v: 0, e: 'x'.repeat(90), n: 0, tq: '', at: now };
  assert.ok(regras.allowed({}, km, mesa, now));
  assert.ok(!regras.allowed({}, km, { ...mesa, b: 'ze' }, now));
  assert.ok(!regras.allowed({}, ['cruzadabotecos', 'bar', 'mesa', '2'], mesa, now));
  const dm = regras.setAt({}, km, mesa);
  assert.ok(regras.allowed(dm, km, { ...mesa, n: 1, at: now + 50 }, now + 50));
  assert.ok(!regras.allowed(dm, km, { ...mesa, n: 5, at: now + 50 }, now + 50), 'pulou jogada');
  assert.ok(regras.allowed(dm, km, { ...mesa, n: 0, at: now + 50 }, now + 50), 'revanche');
});

test('rede: NPC arrancado vai no retrato (quem olha desenha igual)', () => {
  const m = mundo();
  const c = corpo(m, 'marrento');
  c.quenteAte = m.t + 3000;
  c.cortes = 1 | 8;
  c.estado = 'ko';
  const l = R.linhaNpc(m);
  assert.equal(R.lerLinhaNpc(l).npcs[0].cortes, 9);
  assert.equal(R.lerLinhaNpc('marrento,1,1,1,n,0,0,0').npcs[0].cortes, 0);
  assert.equal(R.lerLinhaNpc('marrento,1,1,1,n,0,0,0,?').npcs[0].cortes, 0, 'lixo vira inteiro');
});

console.log(`\n${passed} testes do upgrade passaram`);
