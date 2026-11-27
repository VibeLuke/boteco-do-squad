// Testes da Fatia 16 (personalização: chapéu e título). O chapéu em toda pose sem crescer a grade, o corte que some
// acima da aba, o código do visual que só cresce quando precisa (8 caracteres para quem não usa chapéu nem título, e
// até 16 aceitos pela rede, pelas regras e pelo espelho), o título que só aparece com o troféu no banco, e os 3
// chapéus na lista fechada de prêmios.
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
const SP = await import('../src/arena/sprites.ts');
const V = await import('../src/vivo/visual.ts');
const I = await import('../src/vivo/interacoes.ts');
const RD = await import('../src/vivo/rede.ts');
const P = await import('../src/portais/portal.ts');
const INV = await import('../src/portais/inventario.ts');
const R = await import('./mock-rules.mjs');

let n = 0;
const test = (nome, fn) => {
  fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};
const CHAPEUS = ['bone', 'palha', 'cartola'];
const POSES = ['front', 'front-a', 'front-b', 'back', 'back-a', 'back-b', 'sit', 'ko-flat', 'ko-bottle', 'ko-slump', 'punch', 'hurt', 'dead'];
const grade = (L, p) => (p === 'punch' || p === 'hurt' ? SP.buildGridLook(L, p) : p === 'dead' ? SP.buildDeadGridLook(L) : SP.buildBarGridLook(L, p, 0));

/* ------------------------------------------------------------------ desenho */

test('chapéu: cada um muda a pose em todas as 13 poses, nos 5 amigos, sem mudar o tamanho da grade', () => {
  for (const id of ['vini', 'will', 'dani', 'bia', 'tati']) {
    const base = SP.PLAYER_BY_ID[id].look;
    for (const p of POSES) {
      const sem = grade(base, p);
      const vistos = new Set([JSON.stringify(sem)]);
      for (const hat of CHAPEUS) {
        const com = grade({ ...base, hat }, p);
        // Em pé a grade é fixa (as âncoras dependem dela). Deitado ela é recortada no corpo e a aba larga da palha
        // passa dos lados da cabeça: cresce por igual dos dois lados (par, até 6), e o centro do boneco não anda.
        const deitado = p.startsWith('ko') || p === 'dead';
        if (!deitado) {
          assert.equal(com.length, sem.length, `${id} ${p} ${hat}: altura`);
          assert.equal(com[0].length, sem[0].length, `${id} ${p} ${hat}: largura`);
        } else {
          // Quanto o corpo anda na tela: o deslocamento do conteúdo dentro da grade menos o da âncora (meio da grade).
          let melhor = { n: -1, dx: 0, dy: 0 };
          for (let dy = -6; dy <= 6; dy++)
            for (let dx = -6; dx <= 6; dx++) {
              let ok = 0;
              for (let y = 0; y < sem.length; y++) for (let x = 0; x < sem[0].length; x++) if (sem[y][x] && com[y + dy]?.[x + dx] === sem[y][x]) ok++;
              if (ok > melhor.n) melhor = { n: ok, dx, dy };
            }
          const anda = (d, a, b) => d - (Math.floor(b / 2) - Math.floor(a / 2));
          assert.ok(Math.abs(anda(melhor.dx, sem[0].length, com[0].length)) <= 1, `${id} ${p} ${hat}: anda ${anda(melhor.dx, sem[0].length, com[0].length)} px na horizontal`);
          assert.ok(Math.abs(anda(melhor.dy, sem.length, com.length)) <= 1, `${id} ${p} ${hat}: anda ${anda(melhor.dy, sem.length, com.length)} px na vertical`);
        }
        vistos.add(JSON.stringify(com));
      }
      assert.equal(vistos.size, 4, `${id} ${p}: algum chapéu não desenhou ou saiu igual a outro`);
    }
  }
});

test('chapéu: o cabelo some acima da aba (de frente e de costas), nos 5 cortes; a borda de cima continua inteira', () => {
  const FOGO = '#ff7a2a';
  // Linha da grade (com a margem de 1) da primeira linha da aba de cada chapéu.
  const aba = { bone: 1 + 4, palha: 1 + 4, cartola: 1 + 5 };
  for (const corte of ['curly', 'neat', 'side', 'straight', 'long'])
    for (const hat of CHAPEUS)
      for (const p of ['front', 'back']) {
        const L = { ...SP.PLAYER_BY_ID.will.look, hair: FOGO, hairStyle: corte, hat };
        const g = SP.buildBarGridLook(L, p, 0);
        for (let y = 0; y < aba[hat]; y++) assert.ok(!g[y].includes(FOGO), `${corte} ${hat} ${p}: cabelo acima da aba na linha ${y}`);
        // Sem chapéu o mesmo corte tem cabelo lá em cima (o teste não passa de graça).
        const sem = SP.buildBarGridLook({ ...L, hat: undefined }, p, 0);
        assert.ok(sem.slice(0, aba[hat]).some((r) => r.includes(FOGO)), `${corte} ${p}: sem chapéu não tem cabelo no alto`);
        // Nada do chapéu na linha 0 (só o contorno pode estar lá).
        assert.ok(g[0].every((c) => c === null || c === '#181425'), `${corte} ${hat} ${p}: chapéu encostou no topo`);
      }
});

test('chapéu com a pegadinha: o jornal (degrau 6) ainda cobre a cara; bigode continua visível sob a aba', () => {
  const L = { ...SP.PLAYER_BY_ID.vini.look, hat: 'palha' };
  const g0 = JSON.stringify(SP.buildBarGridLook(L, 'front', 0));
  const g1 = JSON.stringify(SP.buildBarGridLook(L, 'front', 1));
  const g6 = SP.buildBarGridLook(L, 'front', 6);
  assert.notEqual(g0, g1, 'bigode sumiu sob o chapéu');
  assert.ok(g6.flat().filter((c) => c === '#c0cbdc').length >= 40, 'jornal coberto pelo chapéu');
});

/* ------------------------------------------------------------------ código */

test('código: sem chapéu nem título fica com 8 (igual à Fatia 15); com eles vai a 10 e volta igual', () => {
  const antigo = { camisa: '#e43b44', calca: '#3a4466', cabelo: '#feae34', corte: 'long', barba: 'short', acessorio: 'jacket', oculos: 'shades', bermuda: true };
  assert.equal(V.codigo(antigo), '11441511', 'o código de 8 mudou (quebraria quem não atualizou)');
  assert.equal(V.codigo({}), '--------', 'visual de sempre');
  assert.equal(V.codigo({ ...antigo, chapeu: 'nenhum', titulo: 'nenhum' }), V.codigo(antigo));
  const novo = { ...antigo, chapeu: 'cartola', titulo: 'gorjeta' };
  const c = V.codigo(novo);
  assert.equal(c.length, 10);
  assert.equal(c.slice(0, 8), V.codigo(antigo), 'as 8 primeiras posições mudaram');
  assert.deepEqual(V.deCodigo(c), V.limpar(novo));
  assert.equal(V.codigo({ chapeu: 'bone' }), '--------1-');
  assert.deepEqual(V.deCodigo('--------1-'), { chapeu: 'bone' });
  assert.deepEqual(V.deCodigo('---------3'), { titulo: 'gorjeta' });
});

test('código: o de 8 de antes vale sem chapéu; um de 16 (versão futura) lê o que conhece; 17 ou lixo cai no padrão', () => {
  assert.equal(V.deCodigo('3k2-1-0-').chapeu, undefined);
  assert.deepEqual(V.deCodigo('3k2-1-0-'), V.deCodigo('3k2-1-0-'.padEnd(8, '-')));
  const futuro = '3k2-1-0-2' + '1' + 'zzzzzz';
  assert.equal(futuro.length, 16);
  assert.equal(V.deCodigo(futuro).chapeu, 'palha');
  assert.equal(V.deCodigo(futuro).titulo, 'rato');
  assert.deepEqual(V.deCodigo(futuro + 'z'), {});
  assert.deepEqual(V.deCodigo('3k2-1-0'), {});
  assert.deepEqual(V.deCodigo('3K2-1-0-'), {});
  assert.deepEqual(V.deCodigo('--------z-'), {}, 'chapéu fora da lista vira nada');
  // A rede e o amigo offline aceitam de 8 a 16.
  const vivo = (lk) => ({ will: { x: 5, y: 5, fx: 1, fy: 0, mx: 0, my: 0, e: 'n', vi: 100, lk, at: 1, on: true } });
  assert.ok(RD.sanitizeVivo(vivo('3k2-1-0-')).will);
  assert.ok(RD.sanitizeVivo(vivo('3k2-1-0-21')).will);
  assert.ok(RD.sanitizeVivo(vivo(futuro)).will);
  assert.equal(RD.sanitizeVivo(vivo(futuro + 'z')).will, undefined);
  assert.equal(I.lkDoAmigo({ will: { lk: '3k2-1-0-21' } }, 'will'), '3k2-1-0-21');
  assert.equal(I.lkDoAmigo({ will: { lk: futuro + 'z' } }, 'will'), null);
});

test('visual: chapéu "nenhum" tira o chapéu; o chapéu salvo entra no Look', () => {
  const base = { ...SP.PLAYER_BY_ID.dani.look, hat: 'bone' };
  assert.equal(V.aplicar(base, { chapeu: 'nenhum' }).hat, undefined);
  assert.equal(V.aplicar(SP.PLAYER_BY_ID.dani.look, { chapeu: 'palha' }).hat, 'palha');
  assert.equal(V.aplicar(SP.PLAYER_BY_ID.dani.look, {}).hat, undefined);
  assert.deepEqual(V.limpar({ chapeu: 'coroa', titulo: 'rei' }), {});
});

/* ------------------------------------------------------------------ título */

test('título: só com o troféu no banco; quem não tem não escolhe e o código falso não vira título', () => {
  const trofeus = { gorjeta: { will: 100 }, rabo: { tati: 50 }, antena: { will: 'x' } };
  assert.deepEqual(V.titulosDe('will', trofeus).map((t) => t.id), ['nenhum', 'gorjeta']);
  assert.deepEqual(V.titulosDe('tati', trofeus).map((t) => t.id), ['nenhum', 'rato']);
  assert.deepEqual(V.titulosDe('dani', trofeus).map((t) => t.id), ['nenhum']);
  assert.deepEqual(V.titulosDe('dani', null).map((t) => t.id), ['nenhum']);
  assert.equal(V.tituloDe('gorjeta', 'will', trofeus), 'Amigo do Visitante');
  assert.equal(V.tituloDe('gorjeta', 'tati', trofeus), null, 'título sem o troféu');
  assert.equal(V.tituloDe('antena', 'will', trofeus), null, 'troféu com lixo no lugar da hora');
  assert.equal(V.tituloDe('nenhum', 'will', trofeus), null);
  assert.equal(V.tituloDe(undefined, 'will', trofeus), null);
  for (const t of V.TITULOS.slice(1)) assert.ok(I.TROFEU_NOME[t.trofeu], `título ${t.id} com troféu que não existe`);
});

/* ------------------------------------------------------------------ prêmios e regras */

test('prêmios: 3 chapéus nos portais, na lista fechada do banco e do espelho; dá para comprar com Pó e vestir', () => {
  const ch = P.PREMIOS.filter((x) => x.peca === 'chapeu');
  assert.deepEqual(ch.map((x) => x.cor).sort(), ['bone', 'cartola', 'palha']);
  assert.ok(ch.some((x) => x.portal === 'moscas') && ch.some((x) => x.portal === 'quermesse'));
  for (const x of ch) assert.ok(V.CHAPEUS.includes(x.cor), `${x.id}: chapéu que o visual não conhece`);
  const now = 1_800_000_000_000;
  for (const x of ch) assert.equal(R.allowed({}, ['cruzadabotecos', 'bar', 'inventario', 'will', x.id], now, now), true, x.id);
  const regras = ler('database.rules.json');
  for (const x of ch) assert.ok(regras.includes(`|${x.id}`), `${x.id} fora das regras`);
  const inv = INV.limparInventario({ itens: [], po: { g: 200, s: 0 } });
  const comprou = INV.comprarComPo(inv, 'qm-chapeu-cartola');
  assert.ok(comprou && comprou.itens.includes('qm-chapeu-cartola'));
  assert.ok(INV.coresLiberadas(comprou).has('cartola'));
  // O sorteio da Quermesse acha os chapéus (raridade incomum e rara).
  let viu = 0;
  for (let a = 0; a < 50; a++)
    for (let b = 0; b < 10; b++) if (P.sortearPremio('quermesse', { semRaro: 0, semLendario: 0 }, new Set(), a / 50, b / 10, false).s.premio.peca === 'chapeu') viu++;
  assert.ok(viu > 0, 'sorteio nunca dá chapéu');
  assert.ok(viu < 500 * 0.3, `chapéu demais no sorteio: ${viu} de 500`);
});

test('regras: o código do visual vai de 8 a 16 no banco e no espelho', () => {
  const regras = ler('database.rules.json');
  assert.ok(regras.includes('matches(/^[0-9a-z-]{8,16}$/)'));
  assert.ok(!regras.includes('matches(/^[0-9a-z-]{8}$/)'), 'sobrou o limite de 8');
  assert.ok(ler('tests/mock-rules.mjs').includes("/^[0-9a-z-]{8,16}$/.test(value.lk)"));
  JSON.parse(regras);
});

test('tela: painel com chapéu e título, título acima do nome do amigo online e o chapéu na troca por Pó', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  for (const s of ['rotulo="Chapéu"', 'rotulo="Título"', 'titulosDe(player, trofeus)', 'tituloDe(deCodigo(elo.estado(c.nome as AmigoId)?.lk).titulo', 'ICONE_CHAPEU[x.cor]', 'trofeus={barPresence.trofeusRaw()}', "lista={CHAPEUS.filter((c) => c === 'nenhum' || liberadas.has(c) || c === value.chapeu)}"])
    assert.ok(v.includes(s), `falta ${s}`);
  assert.ok(!v.includes('repetida (+'), 'sobrou "repetida", que não serve para chapéu');
});

console.log(`\n${n} testes da Fatia 16 passaram`);
