// Testes da Fatia 14 (Quermesse Maluca). As provas do relatório:
// (1) todo microjogo é puro e determinístico em 100 sementes;
// (2) todo microjogo é ganhável: o bot perfeito vence 100% e quem não aperta nada perde 100%;
// (3) nenhum passa de 6 s na velocidade 1 nem de 3 s na 2 (o chefe, de 10 s);
// (4) a mesma semente dá a mesma ordem, nunca repete o anterior e o chefe cai nas posições 8, 16 e 24;
// (5) a run acaba pela contagem de passos;
// (6) conformidade em todo arquivo de microjogo da pasta (arquivo novo entra no teste sozinho).
// Mais: a janela de cada microjogo medida (300 ms → 150 ms, a dificuldade só vem da velocidade), a pontuação, e a
// calibragem com um bot de reação de 250 ± 80 ms por faixa de rodada.
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
const PASTA = path.join(raiz, 'src/portais/quermesse');
const T = await import('../src/portais/quermesse/tipos.ts');
const Q = await import('../src/portais/quermesse/regente.ts');
const { hashTexto, rng } = await import('../src/vivo/eventos.ts');

let n = 0;
const test = async (nome, fn) => {
  const t0 = performance.now();
  await fn();
  n++;
  console.log(`ok ${n} - ${nome} (${Math.round(performance.now() - t0)} ms)`);
};
const LONGO = !!process.env.QUERMESSE_LONGO;

// Os arquivos de microjogo da pasta: tudo .ts que não é o contrato nem o regente (a tela e o som são .tsx/.ts de nome
// próprio, listados aqui).
const FORA = new Set(['tipos.ts', 'regente.ts', 'somQuermesse.ts']);
const arquivos = fs.readdirSync(PASTA).filter((f) => f.endsWith('.ts') && !FORA.has(f));
const micros = [];
for (const f of arquivos) micros.push({ f, m: (await import(pathToFileURL(path.join(PASTA, f)).href)).micro });

/** Roda um microjogo até o fim com `quem(e, passo)` decidindo a entrada; devolve o resultado e o passo final. */
function jogar(m, semente, vel, quem) {
  const e = m.iniciar(rng(hashTexto(`teste|${m.id}|${semente}`)), vel);
  let i = 0;
  for (; i < 2000 && m.resultado(e) === 'andando'; i++) m.passo(e, quem(e, i));
  return { res: m.resultado(e), passos: i, e };
}

/** Bot de reação: anda como o perfeito, mas só aperta R ms depois que a hora certa abre (R ~ 250 ± 80 ms). */
function botReacao(m, r) {
  let antes = false;
  let quando = -1;
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  return (e, i) => {
    const p = m.pronto(e);
    if (p && !antes && quando < 0) quando = i + Math.max(1, Math.round(((250 + 80 * gauss()) / 1000) * 60));
    antes = p;
    const mov = m.chefe ? { mx: 0, my: 0 } : { ...m.bot(e), acao: false };
    if (i === quando) {
      quando = -1;
      return { ...mov, ...m.resposta(e) };
    }
    return mov;
  };
}

await test('conformidade: todo arquivo de microjogo da pasta cumpre o contrato e está no catálogo', () => {
  assert.ok(micros.length >= 5, `achei ${micros.length} microjogos`);
  const ids = new Set();
  for (const { f, m } of micros) {
    assert.ok(m, `${f} não exporta micro`);
    for (const k of ['id', 'verbo', 'nome', 'segundos', 'iniciar', 'passo', 'resultado', 'pronto', 'bot', 'resposta', 'tempo', 'desenhar']) assert.ok(k in m, `${f}: falta ${k}`);
    assert.match(m.verbo, /^[A-ZÇÃÊ]{3,8}$/, `${f}: instrução de uma palavra`);
    assert.ok(!ids.has(m.id), `id repetido ${m.id}`);
    ids.add(m.id);
    assert.ok(Q.CATALOGO.includes(m), `${f} não está no catálogo do regente`);
    const linhas = fs.readFileSync(path.join(PASTA, f), 'utf8').split('\n').length;
    assert.ok(linhas <= 230, `${f}: ${linhas} linhas (o contrato pede arquivo curto)`);
  }
  assert.equal(Q.CATALOGO.length, micros.length, 'tudo do catálogo está na pasta');
  assert.ok(Q.MICROS.length >= 4 && Q.CHEFES.length >= 1);
});

await test('(1) puro e determinístico: 100 sementes, duas execuções com o bot perfeito dão o mesmo estado passo a passo', () => {
  for (const { m } of micros)
    for (let s = 0; s < 100; s++) {
      const a = [];
      const b = [];
      const quem = (lista) => (e) => {
        const x = m.bot(e);
        lista.push(JSON.stringify(e));
        return x;
      };
      jogar(m, s, 1 + (s % 5) * 0.25, quem(a));
      jogar(m, s, 1 + (s % 5) * 0.25, quem(b));
      assert.deepEqual(a, b, `${m.id} semente ${s}`);
    }
});

await test('(2) ganhável: o bot perfeito vence 100% e quem não aperta perde 100% (100 sementes, velocidades 1 a 2)', () => {
  for (const { m } of micros)
    for (const vel of [1, 1.25, 1.5, 1.76, 2])
      for (let s = 0; s < 100; s++) {
        assert.equal(jogar(m, s, vel, (e) => m.bot(e)).res, 'ganhou', `${m.id} vel ${vel} semente ${s}: perfeito perdeu`);
        assert.equal(jogar(m, s, vel, () => T.PARADA).res, 'perdeu', `${m.id} vel ${vel} semente ${s}: parado ganhou`);
      }
  // Apertar a esmo (a cada passo) também não serve: o primeiro aperto fora da hora perde.
  for (const { m } of micros.filter((x) => !x.m.chefe))
    for (let s = 0; s < 50; s++) assert.equal(jogar(m, s, 1, () => ({ mx: 0, my: 0, acao: true })).res, 'perdeu', `${m.id}: apertar sempre ganhou`);
});

await test('apertar um pouco antes da hora perde, em todo microjogo de um aperto (a janela é estreita mesmo)', () => {
  for (const { m } of micros.filter((x) => !x.m.chefe))
    for (let s = 0; s < 40; s++) {
      // Acha o primeiro passo em que a hora certa abre (andando como o perfeito, sem apertar)…
      const e = m.iniciar(rng(hashTexto(`teste|${m.id}|cedo${s}`)), 1); // a mesma semente que jogar() usa abaixo
      let k = -1;
      for (let i = 0; i < 2000 && m.resultado(e) === 'andando'; i++) {
        if (m.pronto(e)) {
          k = i;
          break;
        }
        m.passo(e, { ...m.bot(e), acao: false });
      }
      assert.ok(k > 6, `${m.id} semente ${s}: a hora abriu cedo demais (${k})`);
      // …e aperta 6 passos (100 ms) antes: tem de perder.
      const res = jogar(m, `cedo${s}`, 1, (x, i) => ({ ...m.bot(x), acao: i === k - 6 }));
      assert.equal(res.res, 'perdeu', `${m.id} semente ${s}: apertar 100 ms antes ganhou`);
    }
});

await test('quadrilha: o 3º erro derruba na hora, e segurar a direção não conta como aperto', () => {
  const m = Q.microPorId('dance');
  for (let s = 0; s < 30; s++) {
    // Não aperta nada: perde logo depois que a 3ª seta passa, antes da 4ª chegar.
    const e = m.iniciar(rng(s + 7), 1);
    for (let i = 0; i < 2000 && m.resultado(e) === 'andando'; i++) m.passo(e, T.PARADA);
    assert.equal(e.erros, 3, `semente ${s}: parou com ${e.erros} erros`);
    assert.ok(e.t < e.setas[3].em, 'perdeu antes da 4ª seta');
    // Segura a direção da 1ª seta desde antes da janela até depois: não é aperto dentro da hora, então erra.
    const f = m.iniciar(rng(s + 7), 1);
    const alvo = f.setas[0];
    const [dx, dy] = { 1: [1, 0], 2: [0, 1], 3: [-1, 0], 4: [0, -1] }[alvo.dir];
    for (let i = 0; i < alvo.em + f.meia + 2 && m.resultado(f) === 'andando'; i++) m.passo(f, i >= alvo.em - 2 * f.meia ? { mx: dx, my: dy } : T.PARADA);
    assert.equal(alvo.ok, -1, `semente ${s}: segurar contou como acerto`);
  }
});

await test('(3) duração: até 6 s na velocidade 1 e 3 s na 2 (o chefe até 10 s), e a janela cai de 300 para 150 ms', () => {
  for (const { m } of micros) {
    const teto = m.chefe ? 10 : 6;
    for (let s = 0; s < 30; s++) {
      assert.ok(m.tempo(m.iniciar(rng(s + 1), 1)).dur <= teto * 60, `${m.id}: passa de ${teto} s`);
      assert.ok(m.tempo(m.iniciar(rng(s + 1), 2)).dur <= (teto / 2) * 60, `${m.id}: passa de ${teto / 2} s na 2`);
    }
    // A primeira janela aberta (com o movimento do perfeito, sem apertar) dura ~18 passos na 1 e ~9 na 2.
    for (const [vel, alvo] of [[1, (T.JANELA_MS * 60) / 1000], [2, (T.JANELA_MS * 30) / 1000]]) {
      const medidas = [];
      for (let s = 0; s < 30; s++) {
        const e = m.iniciar(rng(hashTexto(`janela|${m.id}|${s}`)), vel);
        let abre = -1;
        let i = 0;
        for (; i < 2000 && m.resultado(e) === 'andando'; i++) {
          const p = m.pronto(e);
          if (p && abre < 0) abre = i;
          if (!p && abre >= 0) break;
          // Até abrir, anda como o perfeito; aberta, fica parado esperando (como quem espera o pato passar).
          m.passo(e, abre >= 0 || m.chefe ? T.PARADA : { ...m.bot(e), acao: false });
        }
        // Fechou (ou o microjogo acabou com ela aberta, como a fogueira que chega em quem não pulou).
        if (abre >= 0) medidas.push(i - abre);
      }
      const media = medidas.reduce((a, b) => a + b, 0) / medidas.length;
      assert.ok(medidas.length >= 25, `${m.id}: janela medida em ${medidas.length} de 30`);
      assert.ok(Math.abs(media - alvo) <= 3, `${m.id} vel ${vel}: janela média ${media.toFixed(1)} passos (alvo ${alvo})`);
    }
  }
});

await test('(4) ordem: a mesma semente dá a mesma ordem, nunca repete o anterior, e o chefe cai em 8, 16 e 24', () => {
  for (let s = 1; s <= 200; s++) {
    const o = Q.ordem(s);
    assert.deepEqual(Q.ordem(s), o);
    assert.equal(o.length, Q.ORDEM_N);
    for (let i = 1; i < o.length; i++) assert.notEqual(o[i], o[i - 1], `semente ${s}, posição ${i + 1}`);
    o.forEach((id, i) => assert.equal(Q.microPorId(id).chefe === true, (i + 1) % 8 === 0, `semente ${s}, posição ${i + 1}: ${id}`));
  }
  assert.notDeepEqual(Q.ordem(1), Q.ordem(2));
  // Os 4 microjogos aparecem (a ordem não fica presa em dois).
  const vistos = new Set(Q.ordem(7));
  for (const m of Q.MICROS) assert.ok(vistos.has(m.id), m.id);
  // E a run segue a ordem.
  const q = Q.novaQuermesse(7);
  const feitos = [q.id];
  for (let i = 0; i < Q.PASSOS_RUN && !q.fim; i++) {
    Q.passoQ(q, Q.microPorId(q.id).bot(q.e));
    for (const ev of q.ev) if (ev.k === 'aviso') feitos.push(ev.id);
  }
  assert.deepEqual(feitos, Q.ordem(7).slice(0, feitos.length));
  assert.ok(feitos.length >= 17, `a run perfeita passou por ${feitos.length} microjogos (chefes em 8 e 16)`);
});

await test('(5) a run acaba pela contagem de passos: perfeito vence no passo 7.200 com as 3 fogueiras; parado perde antes', () => {
  for (const s of [1, 2, 3]) {
    const q = Q.novaQuermesse(s);
    let ganhos = 0;
    let chefes = 0;
    let bonus = 0;
    while (!q.fim) {
      Q.passoQ(q, Q.microPorId(q.id).bot(q.e));
      for (const ev of q.ev) {
        if (ev.k === 'ganhou') ganhos++;
        if (ev.k === 'ganhou' && ev.pontos === 3) chefes++;
        if (ev.k === 'bonus') bonus++;
      }
    }
    assert.equal(q.fim, 'venceu');
    assert.equal(q.passo, Q.PASSOS_RUN);
    assert.equal(q.fogueiras, 3);
    // Pontos: 1 por microjogo, chefe 3, +1 a cada 5 seguidos, +2 por fogueira no fim.
    assert.equal(q.pontos, ganhos + 2 * chefes + bonus + 2 * 3);
    assert.equal(bonus, Math.floor(ganhos / 5));
    const p = Q.novaQuermesse(s);
    while (!p.fim) Q.passoQ(p, T.PARADA);
    assert.equal(p.fim, 'perdeu');
    assert.equal(p.fogueiras, 0);
    assert.equal(p.pontos, 0);
    assert.ok(p.passo < Q.PASSOS_RUN);
  }
  // A velocidade sobe ×1,12 a cada 3 e para em 2.
  assert.equal(Q.velDe(0), 1);
  assert.equal(Q.velDe(2), 1);
  assert.equal(Q.velDe(3), 1.12);
  assert.ok(Math.abs(Q.velDe(9) - 1.12 ** 3) < 1e-12);
  assert.equal(Q.velDe(100), 2);
});

await test('calibragem: bot de reação 250 ± 80 ms, a vitória cai com a rodada', () => {
  const N = LONGO ? 400 : 60;
  const faixas = [[1, 6], [7, 12], [13, 99]];
  const taxa = [];
  for (const [a, b] of faixas) {
    let v = 0;
    let t = 0;
    for (let s = 0; s < N; s++)
      for (let k = a; k <= Math.min(b, 18); k++) {
        const m = Q.MICROS[(s + k) % Q.MICROS.length];
        const r = rng(hashTexto(`calib|${s}|${k}`));
        if (jogar(m, s * 31 + k, Q.velDe(k - 1), botReacao(m, r)).res === 'ganhou') v++;
        t++;
      }
    taxa.push(v / t);
  }
  console.log(`   vitória do bot de reação: rodadas 1–6 ${(taxa[0] * 100).toFixed(0)}% · 7–12 ${(taxa[1] * 100).toFixed(0)}% · 13–18 ${(taxa[2] * 100).toFixed(0)}%`);
  assert.ok(taxa[0] > taxa[1] && taxa[1] > taxa[2], 'cai com a rodada');
  assert.ok(taxa[0] >= 0.55 && taxa[0] <= 0.85, 'rodadas 1–6 perto de 70%');
  assert.ok(taxa[1] >= 0.35 && taxa[1] <= 0.65, 'rodadas 7–12 perto de 50%');
  assert.ok(taxa[2] >= 0.15 && taxa[2] <= 0.45, 'depois perto de 30%');
});

const P = await import('../src/portais/portal.ts');
const I = await import('../src/portais/inventario.ts');
const R = await import('./mock-rules.mjs');
const ler = (p) => fs.readFileSync(path.join(raiz, p), 'utf8');

await test('portais revezando: o dia reveza, cada um tem seus prêmios, e as contas de um não apagam as do outro', () => {
  // Fatia 20: entrou o Churrasco Jurássico (no fim da lista).
  assert.deepEqual([...P.PORTAIS_DO_DIA], ['moscas', 'quermesse', 'churrasco']);
  // Nunca o mesmo dois dias seguidos.
  for (let d = 20000; d < 20400; d++) assert.notEqual(P.portalDoDia(d, P.PORTAIS_DO_DIA), P.portalDoDia(d - 1, P.PORTAIS_DO_DIA));
  // A primeira versão repetia quando ontem tinha sido desempatado; 10 mil dias com listas de 2 a 6 portais.
  for (const lista of [['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd', 'e', 'f']]) {
    const conta = Object.fromEntries(lista.map((x) => [x, 0]));
    for (let d = 20000; d < 30000; d++) {
      const hoje = P.portalDoDia(d, lista);
      assert.notEqual(hoje, P.portalDoDia(d - 1, lista), `${lista.length} portais, dia ${d}`);
      conta[hoje]++;
    }
    for (const x of lista) assert.ok(Math.abs(conta[x] - 10000 / lista.length) < 10000 / lista.length / 5, `${x}: ${conta[x]} dias`);
  }
  // Prêmios da Quermesse: pelo menos um por raridade, cores únicas e no fim das listas do visual.
  const qm = P.PREMIOS.filter((x) => x.portal === 'quermesse');
  for (const r of P.RARIDADES) assert.ok(qm.some((x) => x.raridade === r), `quermesse sem ${r}`);
  assert.equal(new Set(P.PREMIOS.map((x) => x.cor)).size, P.PREMIOS.length, 'cor repetida entre prêmios');
  const sorteio = rng(99);
  for (let i = 0; i < 2000; i++) {
    const x = P.sortearPremio('quermesse', { semRaro: i % 20, semLendario: i % 70 }, new Set(), sorteio(), sorteio());
    assert.equal(x.s.premio.portal, 'quermesse');
  }
  // Raridade sem item no portal sobe até achar (nunca lê lista vazia).
  const so = P.PREMIOS.filter((x) => x.portal === 'moscas');
  assert.ok(so.length);
  // Contas: gravar a Quermesse não zera a Moscaria (e vice-versa), e juntar guarda o maior de cada.
  const inv = I.limparInventario({ runs: { dia: '20500', n: { moscas: 2, quermesse: 1 } }, ultima: { moscas: 500, quermesse: 900 } });
  assert.equal(I.runsHoje(inv, '20500', 'quermesse'), 1);
  assert.equal(I.runsHoje(inv, '20500', 'moscas'), 2);
  assert.equal(inv.ultima.quermesse, 900);
  const j = I.juntar(inv, I.limparInventario({ ultima: { moscas: 800, quermesse: 100 } }));
  // Fatia 20: o inventário completa cada portal do dia, então o Churrasco aparece zerado.
  assert.deepEqual(j.ultima, { moscas: 800, quermesse: 900, churrasco: 0 });
  // Sorteio e moeda por portal.
  assert.equal(P.sorteiosDaRun(8, false, 0, 'quermesse'), 1);
  assert.equal(P.sorteiosDaRun(7, false, 0, 'quermesse'), 0);
  assert.equal(P.sorteiosDaRun(39, false, 0, 'moscas'), 0);
  assert.equal(P.moedaDoPortal('quermesse', 20, true), 80);
  assert.equal(P.moedaDoPortal('moscas', 500, true, true), 160);
  let antes = -1;
  for (let p = 0; p < 200; p++) {
    const v = P.moedaQuermesse(p, false);
    assert.ok(v >= antes);
    antes = v;
  }
});

await test('regras: prêmios qm- valem, placar em portais/quermesse vale, portal inventado não', () => {
  const now = 1_800_000_300_000;
  for (const x of P.PREMIOS) assert.equal(R.allowed({}, ['cruzadabotecos', 'bar', 'inventario', 'will', x.id], now, now), true, x.id);
  const pl = (portal) => ['cruzadabotecos', 'bar', 'portais', portal, 'will'];
  assert.equal(R.allowed({}, pl('quermesse'), { s: 14, f: '', v: 1, t: now }, now), true);
  // Fatia 20: o churrasco virou portal de verdade; o inventado agora é outro.
  assert.equal(R.allowed({}, pl('churrasco'), { s: 14, f: '', v: 1, t: now }, now), true);
  assert.equal(R.allowed({}, pl('pescaria'), { s: 14, f: '', v: 1, t: now }, now), false);
  const regras = JSON.parse(ler('database.rules.json')).rules.cruzadabotecos.bar;
  assert.match(regras.portais.$portal.$player['.write'], /\$portal\.matches\(\/\^\(moscas\|quermesse\|churrasco\)\$\/\)/);
});

await test('a tela não recomeça o laço quando o bar redesenha, e o gancho de teste só existe em desenvolvimento', () => {
  const src = ler('src/portais/quermesse/QuermesseTela.tsx');
  assert.match(src, /const \[amigos\] = useState\(amigosProp\);/);
  assert.match(src, /\}, \[fase\]\);/);
  const i = src.indexOf('__quermesse = {');
  assert.match(src.slice(Math.max(0, i - 200), i), /if \(import\.meta\.env\.DEV\)/);
  const vivo = ler('src/vivo/VivoScreen.tsx');
  assert.match(vivo, /amigos=\{amigosQm\}/);
  assert.match(vivo, /\(import\.meta\.env\.DEV && portalForcado\) \|\| portalDoDia/);
});

console.log(`\n${n} testes da Quermesse passaram`);
