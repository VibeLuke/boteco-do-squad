// Testes da Fatia 12 (status, carga, aparar, arremesso recapturável e receitas): a tabela 4 × 4 inteira, o motor
// aplicando cada status pela arma, o choque em área, a poça em chamas, a carga com teto de congelamento, o aparar
// medido contra o impacto do golpe do NPC (inclusive com o mundo congelado), o item que cai e volta para a mão, e as
// receitas do balcão (comutativas, sem passar as armas pagas).
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
const S = await import('../src/vivo/status.ts');
const B = await import('../src/vivo/briga.ts');
const mapa = await import('../src/vivo/mapa.ts');
const loja = await import('../src/vivo/loja.ts');
const R = await import('./mock-rules.mjs');
const G = await import('../src/vivo/gente.ts');

let n = 0;
const test = (nome, fn) => {
  fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};
const T0 = 1_800_000_300_000;
const DT = 1 / 60;
const mundo = (semente = 7) => B.novoMundo('will', T0, semente);
const corpo = (m, id) => m.corpos.find((c) => c.id === id);
function plantar(m, id, x, y) {
  const c = corpo(m, id);
  Object.assign(c, { x, y, vx: 0, vy: 0, humor: 'voltando', rota: null });
  return c;
}
function rodar(m, ms, ent = () => ({})) {
  const k = Math.round(ms / 1000 / DT);
  const ev = [];
  for (let i = 0; i < k; i++) {
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
const ativos = (c, m) => S.ativos(c.st, m.t).sort();

/* ------------------------------------------------------------------ tabela */

test('tabela 4 × 4: simétrica, e a ordem de chegada não muda nem o cruzamento nem o que sobra', () => {
  const t = 1000;
  for (const a of S.STATUS)
    for (const b of S.STATUS) {
      assert.equal(S.TABELA[a][b], S.TABELA[b][a], `${a}×${b}`);
      const ab = S.aplicar(S.aplicar({}, a, t).st, b, t);
      const ba = S.aplicar(S.aplicar({}, b, t).st, a, t);
      assert.equal(ab.efeito, a === b ? null : S.TABELA[a][b], `${a} depois ${b}`);
      assert.equal(ab.efeito, ba.efeito);
      assert.deepEqual(S.ativos(ab.st, t), S.ativos(ba.st, t), `${a}/${b}: sobra diferente`);
    }
  // Os três cruzamentos e o que sobra de cada um.
  const final = (a, b) => S.ativos(S.aplicar(S.aplicar({}, a, 0).st, b, 0).st, 0).sort();
  assert.deepEqual(final('molhado', 'eletrico'), ['eletrico', 'molhado']);
  assert.deepEqual(final('queimando', 'molhado'), []);
  assert.deepEqual(final('grudento', 'queimando'), ['queimando']);
  assert.ok(S.aplicar(S.aplicar({}, 'grudento', 0).st, 'queimando', 0).st.queimando > S.STATUS_MS.queimando, 'a poça em chamas queima mais');
  // Vence o prazo: some sozinho e não cruza mais.
  const vencido = S.aplicar({}, 'molhado', 0).st;
  assert.equal(S.aplicar(vencido, 'eletrico', S.STATUS_MS.molhado + 1).efeito, null);
  assert.equal(S.velStatus(S.aplicar({}, 'grudento', 0).st, 10), S.GRUDE_VEL);
  assert.equal(S.velStatus({}, 10), 1);
});

/* ------------------------------------------------------------------ status no motor */

test('cada status tem fonte na briga: garrafa molha, frigideira gruda, raquete eletrifica (e trava), molotov queima', () => {
  for (const [arma, st] of [['garrafa', 'molhado'], ['frigideira', 'grudento'], ['raquete', 'eletrico'], ['molotov', 'queimando']]) {
    const m = mundo();
    soEstes(m, ['marrento']);
    const me = B.eu(m);
    Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0, arma: { tipo: arma, usos: 5 } });
    const mar = plantar(m, 'marrento', 6.3, 5.5);
    mar.vida = mar.vidaMax = 1e6;
    const ev = rodar(m, 30, (i) => ({ soco: i === 0 }));
    rodar(m, 500);
    assert.ok((mar.st[st] ?? 0) > m.t - 500, `${arma} não deu ${st}`);
  }
  // Elétrico trava um instante além do atordoamento do golpe.
  const m = mundo();
  soEstes(m, ['marrento']);
  const me = B.eu(m);
  Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0, arma: { tipo: 'raquete', usos: 5 } });
  const mar = plantar(m, 'marrento', 6.3, 5.5);
  mar.vida = mar.vidaMax = 1e6;
  const ev = rodar(m, 400, (i) => ({ soco: i === 0 }));
  assert.ok(ev.some((e) => e.k === 'status' && e.st === 'eletrico' && e.em === 'marrento'));
});

test('molhado + elétrico: choque em área atordoa e fere todo molhado perto; quem está seco não leva', () => {
  const m = mundo();
  soEstes(m, ['marrento', 'cabeca', 'tubarao']);
  const me = B.eu(m);
  Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0, arma: { tipo: 'raquete', usos: 5 } });
  const alvo = plantar(m, 'marrento', 6.3, 5.5);
  const vizinho = plantar(m, 'cabeca', 6.3, 6.5);
  const seco = plantar(m, 'tubarao', 6.3, 4.6);
  for (const c of [alvo, vizinho, seco]) c.vida = c.vidaMax = 1e6;
  alvo.st = { molhado: m.t + 5000 };
  vizinho.st = { molhado: m.t + 5000 };
  const v0 = [vizinho.vida, seco.vida];
  const ev = rodar(m, 60, (i) => ({ soco: i === 0 }));
  const ev2 = ev.concat(rodar(m, 400));
  assert.ok(ev2.some((e) => e.k === 'cruza' && e.tipo === 'choque'), 'sem choque');
  assert.equal(vizinho.vida, v0[0] - S.CHOQUE.dano, 'o vizinho molhado não levou o choque');
  assert.ok(vizinho.atordoadoAte >= m.t + S.CHOQUE.atordoa - 600, 'o vizinho não ficou atordoado');
  assert.equal(seco.vida, v0[1], 'o seco levou choque');
});

test('grudento + fogo vira poça em chamas no chão; o fogo queima por segundo; a água apaga', () => {
  const m = mundo();
  soEstes(m, ['marrento']);
  const me = B.eu(m);
  Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0, arma: { tipo: 'molotov', usos: 1 } });
  const mar = plantar(m, 'marrento', 6.3, 5.5);
  mar.vida = mar.vidaMax = 1e6;
  mar.st = { grudento: m.t + 5000 };
  const fogos0 = m.fogos.length;
  const ev = rodar(m, 400, (i) => ({ soco: i === 0 }));
  assert.ok(ev.some((e) => e.k === 'cruza' && e.tipo === 'chamas'));
  assert.equal(m.fogos.length, fogos0 + 1, 'sem poça em chamas');
  assert.ok((mar.st.queimando ?? 0) > m.t);
  assert.ok(!((mar.st.grudento ?? 0) > m.t), 'o óleo devia ter queimado');
  // Queima por segundo (sem ninguém batendo).
  m.fogos.length = 0;
  const v = mar.vida;
  rodar(m, 1000);
  assert.ok(v - mar.vida >= S.QUEIMA_DANO_S * 0.9 && v - mar.vida <= S.QUEIMA_DANO_S * 2.6, String(v - mar.vida));
  // Água apaga.
  B.darStatus(m, mar, 'molhado', null);
  assert.ok(!((mar.st.queimando ?? 0) > m.t));
  // Grudento anda mais devagar (NPC indo a um ponto).
  const anda = (gr) => {
    const m2 = mundo();
    soEstes(m2, ['marrento']);
    const c = plantar(m2, 'marrento', 3.5, 5.5);
    c.humor = 'foge';
    c.fugirDe = [1, 5.5];
    c.humorAte = m2.t + 5000;
    if (gr) c.st = { grudento: m2.t + 5000 };
    rodar(m2, 600);
    return Math.hypot(c.x - 3.5, c.y - 5.5);
  };
  const livre = anda(false);
  const preso = anda(true);
  assert.ok(livre > 0.3 && preso < livre * 0.75, `livre ${livre}, grudento ${preso}`);
});

/* ------------------------------------------------------------------ carga */

test('carga: tocar dá o soco de sempre; segurar dá nível 1 e 2 (mais dano, sempre forte) com congelamento até 160 ms', () => {
  const golpe = (segurarMs) => {
    const m = mundo();
    soEstes(m, ['marrento']);
    const me = B.eu(m);
    Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0 });
    const mar = plantar(m, 'marrento', 6.3, 5.5);
    mar.vida = mar.vidaMax = 1e6;
    let congela = 0;
    const ev = [];
    const k = Math.round(2500 / 1000 / DT);
    for (let i = 0; i < k; i++) {
      const antes = m.hitstopAte;
      if (!ev.some((e) => e.k === 'golpe')) Object.assign(mar, { x: 6.3, y: 5.5, vx: 0, vy: 0, humor: 'voltando', rota: null });
      B.passo(m, { ...B.PARADO, soco: i === 0, segura: i * DT * 1000 < segurarMs }, DT);
      if (!congela && m.hitstopAte > antes && m.eventos.some((e) => e.k === 'golpe' && e.em === 'marrento')) congela = m.hitstopAte - m.t;
      ev.push(...m.eventos);
      m.eventos.length = 0;
    }
    return { golpes: ev.filter((e) => e.k === 'golpe' && e.em === 'marrento'), niveis: ev.filter((e) => e.k === 'carregando').map((e) => e.nivel), congela };
  };
  const tap = golpe(50);
  assert.equal(tap.golpes.length, 1);
  assert.equal(tap.golpes[0].dano, B.JAB.dano);
  assert.deepEqual(tap.niveis, []);
  const n1 = golpe(B.JAB.antecipa + S.CARGA_1 + 100);
  assert.equal(n1.golpes[0].dano, Math.round(B.JAB.dano * 1.5));
  assert.equal(n1.golpes[0].forte, true);
  assert.deepEqual(n1.niveis, [1]);
  const n2 = golpe(B.JAB.antecipa + S.CARGA_2 + 100);
  assert.equal(n2.golpes[0].dano, Math.round(B.JAB.dano * 2.2));
  assert.deepEqual(n2.niveis, [1, 2]);
  assert.ok(n2.congela > 110 && n2.congela <= S.HITSTOP_CARGA_MAX + 1, `congelou ${n2.congela} ms`);
  // Segurar para sempre solta sozinho no teto (1,5 s além da preparação).
  const max = golpe(10_000);
  assert.equal(max.golpes.length, 1);
  // Teto em todas as armas.
  for (const g of [B.JAB, B.EMPURRAO, ...Object.values(B.ARMAS)]) assert.ok(S.golpeCarregado(g, 2).hitstop <= S.HITSTOP_CARGA_MAX);
});

test('carga: apanhar enquanto carrega cancela o golpe (não sai depois)', () => {
  const m = mundo();
  soEstes(m, ['marrento']);
  const me = B.eu(m);
  Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0 });
  const mar = plantar(m, 'marrento', 6.3, 5.5);
  mar.vida = mar.vidaMax = 1e6;
  rodar(m, 300, (i) => {
    Object.assign(mar, { x: 6.3, y: 5.5, vx: 0, vy: 0 });
    return { soco: i === 0, segura: true };
  });
  assert.equal(me.fase, 'antes');
  B.ferirPorEvento(m, me, 5, -1, 0);
  const ev = rodar(m, 1200, () => ({ segura: false }));
  assert.equal(ev.filter((e) => e.k === 'golpe' && e.em === 'marrento').length, 0);
});

/* ------------------------------------------------------------------ aparar */

/** Um NPC brigando com você na sua frente: devolve o instante do impacto do golpe dele (fim da preparação). */
function briga(arma, aparaAntes, comCongelamento = false) {
  const m = mundo();
  soEstes(m, ['marrento']);
  const me = B.eu(m);
  Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0, arma: arma ? { tipo: arma, usos: 5 } : null });
  me.vida = me.vidaMax = 1e6;
  const mar = plantar(m, 'marrento', 6.3, 5.5);
  Object.assign(mar, { humor: 'briga', alvo: 'eu', humorAte: m.t + 60_000, fx: -1, fy: 0 });
  let impacto = 0;
  const ev = [];
  for (let i = 0; i < 600; i++) {
    if (!impacto && mar.fase === 'antes') impacto = mar.faseAte;
    const apertar = impacto && aparaAntes !== null && m.t + DT * 1000 >= impacto - aparaAntes && !ev.apertou;
    if (apertar) {
      ev.apertou = true;
      if (comCongelamento) m.hitstopAte = m.t + 100;
    }
    Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0, vx: 0, vy: 0 });
    B.passo(m, { ...B.PARADO, apara: !!apertar }, DT);
    ev.push(...m.eventos);
    m.eventos.length = 0;
    if (impacto && m.t > impacto + 300) break;
  }
  return { m, me, mar, ev, impacto };
}

test('aparar: L até 150 ms antes do golpe entrar anula o dano, atordoa quem bateu e gasta um uso (garrafa vira caco)', () => {
  const ok = briga('taco', 100);
  assert.ok(ok.impacto > 0, 'o NPC não bateu');
  assert.ok(ok.ev.some((e) => e.k === 'apara'), 'não aparou');
  assert.equal(ok.ev.filter((e) => e.k === 'golpe' && e.em === 'eu').length, 0, 'apanhou mesmo aparando');
  assert.equal(ok.me.arma.usos, 4);
  assert.ok(ok.mar.atordoadoAte >= ok.impacto + S.APARA_ATORDOA - 50);
  const garrafa = briga('garrafa', 60);
  assert.ok(garrafa.ev.some((e) => e.k === 'apara'));
  assert.equal(garrafa.me.arma?.tipo, 'caco', 'a garrafa não quebrou na aparada');
  // Cedo demais, sem nada na mão, ou sem apertar: apanha.
  const cedo = briga('taco', 400);
  assert.ok(!cedo.ev.some((e) => e.k === 'apara'));
  assert.ok(cedo.ev.some((e) => e.k === 'golpe' && e.em === 'eu'));
  const semNada = briga(null, 100);
  assert.ok(semNada.ev.some((e) => e.k === 'aviso' && /aparar/.test(e.texto)));
  assert.ok(semNada.ev.some((e) => e.k === 'golpe' && e.em === 'eu'));
  // Apertar com o mundo congelado (no meio de uma pancada) ainda vale.
  const gelo = briga('taco', 120, true);
  assert.ok(gelo.ev.some((e) => e.k === 'apara'), 'o aparar sumiu no congelamento');
  // As NPCs preparam o golpe por mais tempo que a janela (dá para ver e reagir).
  const preparos = Object.values(G.FICHAS).map((f) => f.antecipa).filter((a) => a > 0);
  assert.ok(Math.min(...preparos) > S.APARA_MS * 2, String(Math.min(...preparos)));
});

/* ------------------------------------------------------------------ arremesso */

test('arremesso recapturável: gasta um uso e cai inteiro no chão livre; garrafa vira caco; de um uso quebra; molotov põe fogo', () => {
  const joga = (arma, usos) => {
    const m = mundo();
    soEstes(m, []);
    const me = B.eu(m);
    Object.assign(me, { x: 5.5, y: 5.5, fx: 1, fy: 0, arma: { tipo: arma, usos } });
    const n0 = m.chao.length;
    const f0 = m.fogos.length;
    const ev = rodar(m, 50, (i) => ({ agarra: i === 0 }));
    const novo = m.chao.slice(n0);
    return { m, ev, novo, fogo: m.fogos.length - f0 };
  };
  const taco = joga('taco', 6);
  assert.equal(taco.novo.length, 1);
  assert.equal(taco.novo[0].arma, 'taco');
  assert.equal(taco.novo[0].usos, 5);
  assert.ok(mapa.anda(Math.floor(taco.novo[0].x), Math.floor(taco.novo[0].y)), 'caiu dentro de parede');
  assert.ok(mapa.propIdx(Math.floor(taco.novo[0].x), Math.floor(taco.novo[0].y)) < 0, 'caiu dentro de móvel');
  const gar = joga('garrafa', 1);
  assert.equal(gar.novo[0]?.arma, 'caco');
  assert.ok(gar.ev.some((e) => e.k === 'quebra' && e.arma === 'garrafa'));
  const tij = joga('tijolo', 1);
  assert.equal(tij.novo.length, 0);
  assert.ok(tij.ev.some((e) => e.k === 'quebra' && e.arma === 'tijolo'));
  const mol = joga('molotov', 1);
  assert.equal(mol.fogo, 1);
  assert.equal(mol.novo.length, 0);
});

test('arremesso de todo ladrilho do salão, nas 4 direções: o item sempre cai em chão livre (nunca em parede ou móvel)', () => {
  const m = mundo();
  soEstes(m, []);
  for (const c of m.corpos) if (c.quem !== 'eu') c.ausente = true;
  const me = B.eu(m);
  let jogadas = 0;
  for (let x = 0; x < 22; x++)
    for (let y = 0; y < 14; y++) {
      if (!mapa.anda(x, y) || mapa.propIdx(x, y) >= 0 || mapa.zonaDe(x + 0.5, y + 0.5) !== 'bar') continue;
      for (const [fx, fy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n0 = m.chao.length;
        Object.assign(me, { x: x + 0.5, y: y + 0.5, vx: 0, vy: 0, fx, fy, estado: 'normal', fase: 'nada', segurando: null, arma: { tipo: 'taco', usos: 6 }, atordoadoAte: 0 });
        m.hitstopAte = 0;
        B.passo(m, { ...B.PARADO, agarra: true }, DT);
        m.eventos.length = 0;
        const novo = m.chao.slice(n0);
        m.chao.length = n0;
        m.quebrados.clear();
        m.livres.clear();
        if (!novo.length) continue;
        jogadas++;
        const tx = Math.floor(novo[0].x);
        const ty = Math.floor(novo[0].y);
        assert.ok(mapa.anda(tx, ty) && mapa.propIdx(tx, ty) < 0, `de ${x},${y} para ${fx},${fy}: caiu em ${novo[0].x.toFixed(2)},${novo[0].y.toFixed(2)}`);
      }
    }
  assert.ok(jogadas > 200, String(jogadas));
});

test('pegar no ar: K logo depois de o item cair perto devolve à mão; tarde demais, não', () => {
  const tenta = (esperaMs) => {
    const m = mundo();
    soEstes(m, []);
    const me = B.eu(m);
    // De frente para a parede do fundo (y = 0) a um ladrilho: o item bate e cai do seu lado.
    Object.assign(me, { x: 3.5, y: 1.6, fx: 0, fy: -1, arma: { tipo: 'taco', usos: 6 } });
    rodar(m, 20, (i) => ({ agarra: i === 0 }));
    assert.equal(me.arma, null);
    rodar(m, esperaMs);
    const ev = rodar(m, 30, (i) => ({ agarra: i === 0 }));
    return { me, ev };
  };
  const cedo = tenta(200);
  assert.deepEqual(cedo.me.arma, { tipo: 'taco', usos: 5 });
  assert.ok(cedo.ev.some((e) => e.k === 'pegou'));
  const tarde = tenta(B.PEGA_MS + 200);
  assert.equal(tarde.me.arma, null);
});

/* ------------------------------------------------------------------ receitas */

test('receitas: comutativas, resultado existe e não passa as armas pagas do mercado (dano × usos)', () => {
  const pagas = loja.CATALOGO.filter((i) => B.ARMAS[i.arma] && B.ARMAS[i.arma].alcance > 0);
  const minPago = Math.min(...pagas.map((i) => B.ARMAS[i.arma].dano * B.ARMAS[i.arma].usos));
  for (const r of S.RECEITAS) {
    assert.equal(S.receita(r.a, r.b), r);
    assert.equal(S.receita(r.b, r.a), r);
    assert.ok(B.ARMAS[r.da], r.da);
    assert.ok(B.ARMAS[r.da].dano * B.ARMAS[r.da].usos < minPago, `${r.da} passa a arma paga mais fraca (${minPago})`);
  }
  assert.equal(S.receita('garrafa', 'taco'), null);
  // Os ingredientes estão no chão do bar.
  for (const a of ['pano', 'prego', 'fita', 'raquete']) assert.ok(mapa.ARMAS_NO_CHAO.some((x) => x.arma === a), `${a} não está no mapa`);
});

test('balcão: deixa um, junta com o par e sai a receita; par errado troca; mão vazia pega', () => {
  const m = mundo();
  soEstes(m, []);
  const me = B.eu(m);
  const noBalcao = () => Object.assign(me, { x: mapa.BANCADA[0], y: mapa.BANCADA[1], fx: 0, fy: -1 });
  noBalcao();
  me.arma = { tipo: 'garrafa', usos: 1 };
  rodar(m, 20, (i) => ({ usa: i === 0 }));
  assert.deepEqual(m.bancada, { arma: 'garrafa', usos: 1 });
  assert.equal(me.arma, null);
  me.arma = { tipo: 'taco', usos: 3 };
  noBalcao();
  rodar(m, 20, (i) => ({ usa: i === 0 }));
  assert.deepEqual(me.arma, { tipo: 'garrafa', usos: 1 }, 'par errado não trocou');
  assert.deepEqual(m.bancada, { arma: 'taco', usos: 3 });
  // Pega o taco de volta (mão vazia) e põe a garrafa; vem o pano e sai a molotov.
  me.arma = { tipo: 'pano', usos: 4 };
  m.bancada = { arma: 'garrafa', usos: 1 };
  noBalcao();
  const ev = rodar(m, 20, (i) => ({ usa: i === 0 }));
  assert.deepEqual(me.arma, { tipo: 'molotov', usos: B.ARMAS.molotov.usos });
  assert.equal(m.bancada, null);
  assert.ok(ev.some((e) => e.k === 'receita' && e.arma === 'molotov'));
  me.arma = null;
  m.bancada = { arma: 'fita', usos: 2 };
  noBalcao();
  rodar(m, 20, (i) => ({ usa: i === 0 }));
  assert.deepEqual(me.arma, { tipo: 'fita', usos: 2 });
});

/* ------------------------------------------------------------------ regras e tela */

test('regras: os 8 itens novos podem ir na mão e no golpe pela rede (banco e espelho)', () => {
  const regras = ler('database.rules.json');
  for (const a of ['pano', 'prego', 'fita', 'raquete', 'molotov', 'tacoprego', 'espuma', 'sococaco']) {
    assert.equal((regras.match(new RegExp(`\\|${a}[|)]`, 'g')) ?? []).length, 2, `${a} nas regras`);
  }
  const mock = ler('tests/mock-rules.mjs');
  assert.match(mock, /\|pinga\|ima\|pano\|prego\|fita\|raquete\|molotov\|tacoprego\|espuma\|sococaco\)\$\/;\nconst NA_MAO/);
  assert.ok(R.allowed !== undefined);
});

test('tela: segurar J carrega, L e toque duplo no joystick aparam, ícones de status e o item no balcão aparecem', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  assert.match(v, /const segura = k\.has\('KeyJ'\) \|\| k\.has\('Space'\) \|\| socoPreso\.current;/);
  assert.match(v, /if \(k === 'KeyL'\) toque\.current\.apara = true;/);
  assert.match(v, /if \(e\.timeStamp - stickToque\.current < 300\) toque\.current\.apara = true;/);
  assert.match(v, /onPointerUp=\{soltouSoco\}/);
  assert.match(v, /desenharStatus\(sts,/);
  assert.match(v, /if \(z === 'bar' && m\.bancada\)/);
  for (const k of ['status', 'cruza', 'apara', 'carregando', 'receita', 'quica', 'pegou']) assert.match(v, new RegExp(`case '${k}':`));
});

console.log(`# fatia 12: ${n} testes`);
