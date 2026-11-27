// Testes da Fatia 18 (Mesa cheia, versão enxuta): regras da Porrinha (vez, palpite repetido recusado, quem acerta
// sai, último perde, rodízio de quem abre), o NPC sempre canta um total válido, partidas simuladas sempre terminam,
// o narrador nunca repete dentro da janela nem fala por cima de si, o boato sempre cita um fato verdadeiro e a ligação
// no jogo.
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
const S = await import('../src/vivo/mesa.ts');
const E = await import('../src/vivo/eventos.ts');

let n = 0;
const test = (nome, fn) => {
  fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};

test('Porrinha: vez certa, palpite repetido recusado, fora da faixa recusado', () => {
  const e = S.novaPorrinha(['eu', 'biriba', 'tiozao']);
  assert.equal(S.vezDe(e), null); // ninguém escondeu ainda
  assert.equal(S.esconder(e, { eu: 2, biriba: 4, tiozao: 0 }).ok, false); // 4 não vale
  assert.equal(S.esconder(e, { eu: 2, biriba: 1, tiozao: 0 }).ok, true);
  assert.equal(S.vezDe(e), 'eu');
  assert.equal(S.palpitar(e, 'biriba', 3).ok, false); // não é a vez dele
  assert.equal(S.palpitar(e, 'eu', 3).ok, true);
  assert.equal(S.palpitar(e, 'biriba', 3).ok, false); // repetido
  assert.equal(S.palpitar(e, 'biriba', 10).ok, false); // acima de 3 × 3
  assert.equal(S.palpitar(e, 'biriba', -1).ok, false);
  assert.equal(S.palpitar(e, 'biriba', 4).ok, true);
  assert.deepEqual(S.palpitesLivres(e), [0, 1, 2, 5, 6, 7, 8, 9]);
  assert.equal(S.palpitar(e, 'tiozao', 2).ok, true);
  assert.equal(S.vezDe(e), null);
});

test('Porrinha: quem acerta o total sai; ninguém acertando, ninguém sai; o último perde; quem abre roda', () => {
  const e = S.novaPorrinha(['eu', 'biriba', 'tiozao']);
  S.esconder(e, { eu: 1, biriba: 1, tiozao: 1 });
  S.palpitar(e, 'eu', 2);
  S.palpitar(e, 'biriba', 4);
  S.palpitar(e, 'tiozao', 5);
  assert.deepEqual(S.revelar(e), { total: 3, acertou: null });
  assert.equal(e.vivos.length, 3);
  assert.equal(e.vivos[e.comeca], 'biriba'); // abriu o eu; agora abre o seguinte
  S.esconder(e, { eu: 3, biriba: 0, tiozao: 2 });
  assert.equal(S.vezDe(e), 'biriba');
  S.palpitar(e, 'biriba', 5);
  S.palpitar(e, 'tiozao', 6);
  S.palpitar(e, 'eu', 4);
  assert.deepEqual(S.revelar(e), { total: 5, acertou: 'biriba' });
  assert.deepEqual(e.vivos, ['eu', 'tiozao']);
  assert.deepEqual(e.saiu, ['biriba']);
  assert.equal(e.perdedor, null);
  assert.equal(e.vivos[e.comeca], 'tiozao'); // abriu o Biriba, que saiu: abre quem vinha depois dele
  S.esconder(e, { eu: 0, tiozao: 2 });
  S.palpitar(e, 'tiozao', 3);
  S.palpitar(e, 'eu', 2);
  assert.deepEqual(S.revelar(e), { total: 2, acertou: 'eu' });
  assert.equal(e.perdedor, 'tiozao');
  assert.equal(S.vezDe(e), null);
  assert.equal(S.esconder(e, { tiozao: 1 }).ok, false);
});

test('NPC: palpite sempre livre, dentro da faixa e coerente com a própria mão', () => {
  for (let s = 1; s < 3000; s++) {
    const r = E.rng(s);
    const e = S.novaPorrinha(['eu', 'biriba', 'tiozao'].slice(0, 2 + (s % 2)), s);
    const maos = Object.fromEntries(e.vivos.map((q) => [q, S.maoNpc(r)]));
    for (const v of Object.values(maos)) assert.ok(v >= 0 && v <= S.PORRINHA_MAX_MAO);
    S.esconder(e, maos);
    while (S.vezDe(e)) {
      const q = S.vezDe(e);
      const p = S.palpiteNpc(e, maos[q], r);
      assert.ok(S.palpitesLivres(e).includes(p), `palpite ${p} não estava livre`);
      assert.equal(S.palpitar(e, q, p).ok, true);
    }
  }
});

test('Porrinha simulada: 5 mil partidas sempre terminam com um perdedor, e o NPC acerta mais que o chute', () => {
  let rodadas = 0;
  let acertosNpc = 0;
  let palpitesNpc = 0;
  for (let s = 1; s <= 5000; s++) {
    const r = E.rng(s * 7919);
    const e = S.novaPorrinha(['eu', ...S.PORRINHA_MESA], s);
    for (let k = 0; k < 200 && !e.perdedor; k++) {
      const maos = Object.fromEntries(e.vivos.map((q) => [q, S.maoNpc(r)]));
      S.esconder(e, maos);
      while (S.vezDe(e)) {
        const q = S.vezDe(e);
        const p = q === 'eu' ? S.palpitesLivres(e)[Math.floor(r() * S.palpitesLivres(e).length)] : S.palpiteNpc(e, maos[q], r);
        S.palpitar(e, q, p);
      }
      const total = e.vivos.reduce((t, q) => t + maos[q], 0);
      for (const p of e.palpites) if (p.quem !== 'eu') ((palpitesNpc += 1), (acertosNpc += p.n === total ? 1 : 0));
      S.revelar(e);
      rodadas++;
    }
    assert.ok(e.perdedor, `partida ${s} não terminou`);
    assert.equal(e.saiu.length, 2);
  }
  const taxa = acertosNpc / palpitesNpc;
  console.log(`  rodadas por partida: ${(rodadas / 5000).toFixed(1)}; NPC acerta ${(taxa * 100).toFixed(1)}% dos palpites`);
  assert.ok(taxa > 0.15, 'NPC chutando à toa');
  assert.ok(rodadas / 5000 < 15, 'partida longa demais');
});

test('narrador: 20 mil falas sem repetir variação dentro da janela e sem fala por cima da outra', () => {
  const nr = S.novoNarrador();
  const r = E.rng(42);
  const ultimo = {};
  let t = 0;
  let noAr = null;
  let falas = 0;
  const gs = Object.keys(S.FALAS);
  for (let k = 0; k < 60000; k++) {
    t += Math.floor(r() * 900);
    if (r() < 0.5) S.narrar(nr, gs[Math.floor(r() * gs.length)], t, r, 'Tati');
    assert.ok(nr.fila.length <= S.FILA_MAX);
    const f = S.proximaFala(nr, t);
    if (f) {
      if (noAr) assert.ok(t >= noAr.ate, 'falou por cima');
      noAr = { ate: t + S.duracaoFala(f) };
      falas++;
    }
  }
  assert.ok(falas > 5000, `poucas falas: ${falas}`);
  // A janela: em cada gatilho, as últimas variações escolhidas nunca têm repetição dentro de min(3, variações − 1).
  for (const g of gs) {
    const nr2 = S.novoNarrador();
    const r2 = E.rng(g.length * 31);
    const seq = [];
    for (let k = 0; k < 400; k++) {
      S.narrar(nr2, g, k * 10_000, r2, 'X');
      seq.push(S.proximaFala(nr2, k * 10_000));
    }
    const w = Math.min(S.JANELA_RECENTE, S.FALAS[g].length - 1);
    for (let i = w; i < seq.length; i++) assert.ok(!seq.slice(i - w, i).includes(seq[i]), `${g} repetiu dentro da janela`);
    for (const v of S.FALAS[g]) assert.ok(seq.some((x) => x === v.replace('{x}', 'X')), `${g}: variação nunca usada`);
  }
  void ultimo;
});

test('narrador: fila com prioridade (evento passa na frente do boato), fala velha vence, mesmo gatilho não dobra', () => {
  const nr = S.novoNarrador();
  const r = E.rng(1);
  S.narrar(nr, 'boato', 0, r, 'x');
  assert.equal(S.narrar(nr, 'boato', 0, r, 'y'), false);
  S.narrar(nr, 'evento', 100, r);
  const f = S.proximaFala(nr, 200);
  assert.ok(S.FALAS.evento.includes(f));
  assert.equal(S.proximaFala(nr, 300), null); // ainda no ar
  assert.equal(S.proximaFala(nr, 200 + S.duracaoFala(f) + S.FALA_VENCE_MS), null); // o boato venceu
  for (const [k, v] of Object.entries(S.FALAS)) {
    assert.ok(v.length >= 3 && v.length <= 5, `${k}: ${v.length} variações`);
    assert.ok(S.PRIORIDADE[k] >= 1);
  }
});

test('boatos: todo boato cita o fato inteiro do livro; mural igual no mesmo dia, sem fato repetido', () => {
  const linhas = [];
  for (let i = 0; i < 30; i++) linhas.push({ t: 1000 + i, ic: '💥', texto: `Fato número ${i % 7}` }); // fatos repetidos entre os 20 mais novos
  for (const dia of ['2026-11-27', '2026-11-28', '2026-12-01']) {
    const m = S.muralDoDia(linhas, dia);
    assert.equal(m.length, 5);
    assert.deepEqual(m, S.muralDoDia(linhas, dia));
    assert.equal(new Set(m.map((b) => b.fato)).size, 5);
    // Moldura não repete em seguida.
    const molde = (b) => S.MOLDES_BOATO.findIndex((x) => b.texto === x.replace('{f}', b.fato));
    for (let k = 1; k < m.length; k++) assert.notEqual(molde(m[k]), molde(m[k - 1]), `${dia}: moldura repetida`);
    for (const b of m) {
      assert.ok(b.texto.includes(b.fato), b.texto);
      assert.ok(linhas.some((l) => l.texto === b.fato), 'fato inventado');
    }
  }
  assert.notDeepEqual(S.muralDoDia(linhas, '2026-11-27').map((b) => b.fato), S.muralDoDia(linhas, '2026-11-28').map((b) => b.fato));
  assert.deepEqual(S.muralDoDia([], '2026-11-27'), []);
  for (let s = 0; s < 500; s++) {
    const b = S.boatoDe({ t: 1, ic: '🏆', texto: 'Dani ganhou o troféu Rabo de Ratazana' }, E.rng(s));
    assert.ok(b.texto.includes('Dani ganhou o troféu Rabo de Ratazana'));
  }
});

test('resumo da ausência: só o que é novo, do mais novo ao mais velho, no máximo 3 e conta o resto', () => {
  const l = [
    { t: 10, ic: '', texto: 'A' },
    { t: 30, ic: '', texto: 'C' },
    { t: 20, ic: '', texto: 'B' },
    { t: 40, ic: '', texto: 'D' },
    { t: 50, ic: '', texto: 'E' },
  ];
  assert.equal(S.resumoAusencia(l, 50), null);
  assert.equal(S.resumoAusencia(l, 35), 'E; D.');
  assert.equal(S.resumoAusencia(l, 0), 'E; D; C (e mais 2).');
});

test('o jogo liga a mesa: Porrinha na mesa do salão, mural no quadro do fiado, rádio na tela, gatilhos e cobrança', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  const mapa = ler('src/vivo/mapa.ts');
  tem(mapa, /jogo: 'porrinha'/);
  tem(mapa, /jogo: 'mural'/);
  tem(v, /jogo === 'porrinha' &&/);
  tem(v, /const COM_PAINEL[^;]*'porrinha', 'mural'\]/); // o E abre os dois painéis
  tem(v, /jogo === 'mural' &&/);
  tem(v, /className="vivo-radio"/);
  tem(v, /narrar\(narrador\.current, 'ko_eu'/);
  tem(v, /narrar\(narrador\.current, 'evento_fim'/);
  tem(v, /narrar\(narrador\.current, 'voltou'/);
  tem(v, /if \(!livro\.length && \+\+tentativas < 20\) return;/); // espera o livro chegar
  // Perder cobra a rodada (ou vai pro fiado sem saldo); ganhar paga só até o limite do dia.
  tem(v, /PORRINHA_RODADA/);
  tem(v, /if \(contaPorrinha\(player\) < PORRINHA_PAGAS_DIA\)/);
  tem(v, /if \(saldo\(pontos, carteiraRef\.current\) >= PORRINHA_RODADA\)/);
  tem(v, /'porrinha_fiado'/);
});

console.log(`# fatia 18: ${n} testes`);
