// Testes da Fatia 15 (interação entre jogadores): o visual do amigo que dorme, a escada de 6 pegadinhas (texto, limite,
// desenho de pé e deitado), reviver quem caiu ficando parado do lado (2 s, uma vez só, reinicia ao andar ou trocar de
// alvo), o brinde (janela de 2 s e 1,5 ladrilho), o canal fx, o livro do bar montado do que o banco já guarda, as
// regras do banco e do espelho (brinde e reviver no fx, marks até 6) e a ligação na tela (B, P, Esc, livro, limpar).
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
const I = await import('../src/vivo/interacoes.ts');
const B = await import('../src/vivo/briga.ts');
const SP = await import('../src/arena/sprites.ts');
const R = await import('./mock-rules.mjs');

let n = 0;
const test = (nome, fn) => {
  fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};
const T0 = 1_800_000_300_000;
const DT = 1 / 60;

/* ------------------------------------------------------------------ visual e pegadinha */

test('amigo offline: usa o último código de visual gravado; lixo ou ausência volta ao padrão', () => {
  const vivo = { will: { lk: 'ab12cd34', on: false }, tati: { lk: 'curto' }, dani: { lk: 12345678 }, vini: null };
  assert.equal(I.lkDoAmigo(vivo, 'will'), 'ab12cd34');
  assert.equal(I.lkDoAmigo(vivo, 'tati'), null);
  assert.equal(I.lkDoAmigo(vivo, 'dani'), null);
  assert.equal(I.lkDoAmigo(vivo, 'vini'), null);
  assert.equal(I.lkDoAmigo(vivo, 'bia'), null);
  assert.equal(I.lkDoAmigo(null, 'will'), null);
  assert.equal(I.lkDoAmigo('x', 'will'), null);
});

test('pegadinha: 6 degraus com texto em ordem, fora da faixa é cortado, e o limite do dia segura', () => {
  assert.equal(I.PEGADINHA_MAX, 6);
  assert.equal(I.textoPegadinha(0), '');
  assert.equal(I.textoPegadinha(1), 'bigode');
  assert.equal(I.textoPegadinha(2), 'bigode e monocelha');
  assert.equal(I.textoPegadinha(3), 'bigode, monocelha e um X na bochecha');
  assert.equal(I.textoPegadinha(6), 'bigode, monocelha, um X na bochecha, um bilhete no peito, a placa "chuta aqui" e o jornal na cara');
  assert.equal(I.textoPegadinha(99), I.textoPegadinha(6));
  assert.equal(I.textoPegadinha(-3), '');
  assert.equal(I.textoPegadinha(2.9), I.textoPegadinha(2));
  assert.equal(I.podeZoar(0, 0), true);
  assert.equal(I.podeZoar(5, 5), true);
  assert.equal(I.podeZoar(6, 0), false, 'cara cheia');
  assert.equal(I.podeZoar(0, 6), false, 'limite do dia');
});

test('desenho: cada degrau de 1 a 6 muda pixels, de pé e deitado; o 6 (jornal) cobre a cara', () => {
  const conta = (g, pinta) => g.flat().filter((c) => c === pinta).length;
  for (const pose of ['front', 'front-a', 'front-b', 'ko-flat']) {
    let antes = JSON.stringify(SP.buildBarGrid('will', pose, 0));
    for (let k = 1; k <= 6; k++) {
      const agora = JSON.stringify(SP.buildBarGrid('will', pose, k));
      assert.notEqual(agora, antes, `${pose}: degrau ${k} não desenhou nada`);
      antes = agora;
    }
  }
  const g6 = SP.buildBarGrid('will', 'front', 6);
  assert.ok(conta(g6, '#c0cbdc') >= 40, 'jornal pequeno demais');
  assert.ok(conta(SP.buildBarGrid('will', 'front', 5), '#c9a86a') >= 20, 'placa pequena demais');
});

test('briga: E no amigo desmaiado sobe um degrau até 6; no 6, só o aviso', () => {
  const m = B.novoMundo('will', T0, 3);
  const amigo = m.corpos.find((c) => c.quem === 'amigo');
  assert.ok(amigo, 'sem amigo dormindo no mundo');
  const me = B.eu(m);
  me.x = amigo.x + 0.4;
  me.y = amigo.y;
  amigo.ink = 0;
  const usar = () => {
    m.eventos.length = 0;
    me.estado = 'normal';
    me.arma = null;
    B.passo(m, { ...B.PARADO, usa: true }, DT);
    for (let i = 0; i < 30; i++) B.passo(m, B.PARADO, DT);
    me.x = amigo.x + 0.4;
    me.y = amigo.y;
  };
  for (let k = 1; k <= 6; k++) {
    usar();
    assert.equal(amigo.ink, k, `degrau ${k}`);
  }
  usar();
  assert.equal(amigo.ink, 6, 'passou de 6');
});

/* ------------------------------------------------------------------ reviver */

test('reviver: 2 s parado do lado levanta uma vez; andar, sair do raio ou trocar de alvo zera', () => {
  const eu = { x: 0, y: 0 };
  const caidos = [{ id: 'a', x: 0.8, y: 0 }];
  let r = I.REVIVER_ZERO;
  let levantou = 0;
  let quadros = 0;
  for (let i = 0; i < 200; i++) {
    const p = I.passoReviver(r, eu, caidos, true, DT * 1000);
    r = p.r;
    quadros++;
    if (p.levanta) {
      assert.equal(p.levanta, 'a');
      levantou++;
      break;
    }
  }
  assert.equal(levantou, 1);
  assert.ok(quadros >= 119 && quadros <= 121, `levou ${quadros} quadros`);
  assert.deepEqual(r, I.REVIVER_ZERO, 'não zerou depois de levantar');
  // Andou no meio: recomeça do zero.
  r = I.passoReviver(I.REVIVER_ZERO, eu, caidos, true, 1500).r;
  assert.equal(r.ms, 1500);
  r = I.passoReviver(r, eu, caidos, false, 16).r;
  assert.deepEqual(r, I.REVIVER_ZERO);
  // Fora do raio.
  assert.equal(I.passoReviver(I.REVIVER_ZERO, eu, [{ id: 'a', x: I.REVIVE_RAIO + 0.01, y: 0 }], true, 3000).levanta, null);
  // Trocou de alvo (o mais perto mudou): conta de novo.
  r = I.passoReviver(I.REVIVER_ZERO, eu, caidos, true, 1900).r;
  const p = I.passoReviver(r, eu, [...caidos, { id: 'b', x: 0.2, y: 0 }], true, 200);
  assert.equal(p.levanta, null);
  assert.equal(p.r.alvo, 'b');
  assert.equal(p.r.ms, 200);
});

test('levantar: você e funcionário com hora para acordar sim; cliente, bicho de evento, KO infinito, arrastado e quem dorme não; remoto só pelo aparelho dele', () => {
  const m = B.novoMundo('will', T0, 5);
  const me = B.eu(m);
  me.estado = 'ko';
  me.koAte = m.t + B.KO_EU_MS;
  assert.equal(B.podeLevantar(me), true);
  assert.equal(B.levantar(m, me), true);
  B.passo(m, B.PARADO, DT);
  assert.notEqual(me.estado, 'ko', 'levantou mas continuou no chão');

  const FUNC = ['barman', 'leao', 'garcom', 'muambeiro', 'cientista', 'faxineira'];
  const cliente = m.corpos.find((c) => c.quem === 'npc' && c.npc && !FUNC.includes(c.npc.tipo));
  assert.ok(cliente);
  cliente.estado = 'ko';
  cliente.koAte = m.t + 10_000;
  assert.equal(B.podeLevantar(cliente), false, 'cliente não levanta nem com hora marcada');
  const bicho = { ...cliente, id: 'evento:rato', npc: null, koAte: m.t + 5000 };
  assert.equal(B.podeLevantar(bicho), false, 'bicho de evento levantado pelo reviver');
  const npc = m.corpos.find((c) => c.quem === 'npc' && c.npc && FUNC.includes(c.npc.tipo));
  assert.ok(npc, 'sem funcionário no mundo');
  npc.estado = 'ko';
  npc.koAte = Infinity;
  assert.equal(B.podeLevantar(npc), false, 'KO infinito');
  assert.equal(B.levantar(m, npc), false);
  npc.koAte = m.t + 10_000;
  npc.seguradoPor = 'alguem';
  assert.equal(B.podeLevantar(npc), false, 'sendo arrastado');
  npc.seguradoPor = null;
  assert.equal(B.podeLevantar(npc), true);
  assert.equal(B.levantar(m, npc), true);
  assert.equal(npc.koAte, m.t);

  const amigo = m.corpos.find((c) => c.quem === 'amigo');
  amigo.estado = 'ko';
  assert.equal(B.podeLevantar(amigo), false, 'amigo que dorme no canto não levanta');
  const remoto = { ...amigo, quem: 'remoto', id: 'amigo:x', ausente: false, dono: undefined, seguradoPor: null };
  assert.equal(B.podeLevantar(remoto), true);
  assert.equal(B.levantar(m, remoto), false, 'remoto se levanta no aparelho dele');
});

/* ------------------------------------------------------------------ brinde, fx e livro */

test('brinde: até 2 s e 1,5 ladrilho; um a mais não', () => {
  const a = { t: 1000, x: 0, y: 0 };
  assert.equal(I.brindaram(a, { t: 3000, x: 1.5, y: 0 }), true);
  assert.equal(I.brindaram(a, { t: 3001, x: 0, y: 0 }), false);
  assert.equal(I.brindaram(a, { t: 1000, x: 1.3, y: 0.9 }), false);
  assert.equal(I.brindaram({ t: 5000, x: 0, y: 0 }, { t: 3000, x: 0, y: 0 }), true, 'a ordem não importa');
  assert.equal(I.BRINDE_BONUS, 3);
  assert.equal(I.BRINDES_DIA, 5);
});

test('fx: só brinde e reviver de jogadores válidos, em ordem de tempo; o resto é ignorado', () => {
  const raw = {
    will: { 0: { k: 'brinde', to: '', e: '', t: 30 }, 1: { k: 'tapa', to: 'tati', e: '', t: 10 } },
    tati: { 0: { k: 'reviver', to: 'will', e: '', t: 20 }, 1: { k: 'brinde', to: 'zeca', e: '', t: 5 } },
    zeca: { 0: { k: 'brinde', to: '', e: '', t: 1 } },
    dani: { 0: { k: 'brinde', to: '', t: 'x' } },
  };
  const f = I.fxDoBar(raw);
  assert.deepEqual(f.map((x) => `${x.p}:${x.k}:${x.to}:${x.t}`), ['tati:brinde::5', 'tati:reviver:will:20', 'will:brinde::30']);
  assert.deepEqual(I.fxDoBar(null), []);
  assert.equal(I.fxDoBar(raw, ['tapa']).length, 1);
});

test('livro do bar: cada tipo vira uma linha, mais nova primeiro; brinde dos dois aparelhos vira uma; máximo 20', () => {
  const bar = {
    kills: { will: { tati: { n: 2, t: 100 } }, zeca: { will: { n: 1, t: 999 } } },
    trofeus: { gorjeta: { bia: 200 }, inventado: { will: 300 } },
    evento: { 12: { fim: { p: 'vini', at: 400, como: 'religado' } }, 13: { fim: { p: 'dani', at: 450, como: 'morto' } } },
    marks: { tati: { by: 'will', n: 3, t: 500 } },
    portais: { moscas: { will: { s: 273, f: 0, v: 1, t: 600 } }, quermesse: { bia: { s: 34, t: 650 } } },
    fx: {
      will: { 0: { k: 'brinde', to: 'tati', e: '', t: 700 }, 1: { k: 'brinde', to: '', e: '', t: 690 } },
      tati: { 0: { k: 'brinde', to: 'will', e: '', t: 2700 }, 1: { k: 'reviver', to: 'dani', e: '', t: 800 } },
    },
  };
  const l = I.livroDoBar(bar);
  assert.deepEqual(
    l.map((x) => x.texto),
    [
      'Tati levantou Dani do chão',
      'Will e Tati brindaram',
      'Bia fez 34 pontos na Quermesse Maluca',
      'Will fez 273 pontos na Moscaria',
      'Will zoou Tati dormindo: bigode, monocelha e um X na bochecha',
      'Dani derrubou o bicho do evento',
      'Vini religou a luz do bar',
      'Bia ganhou o troféu Gorjeta Cósmica',
      'Will nocauteou Tati (2× no dia)',
    ],
  );
  // Reviver repetido do mesmo par em menos de 30 s (o amigo demorou a levantar): uma linha; depois disso, outra.
  bar.fx.will[2] = { k: 'reviver', to: 'dani', e: '', t: 900 };
  bar.fx.will[3] = { k: 'reviver', to: 'tati', e: '', t: 1000 };
  bar.fx.will[4] = { k: 'reviver', to: 'tati', e: '', t: 3000 };
  bar.fx.bia = { 0: { k: 'reviver', to: 'tati', e: '', t: 1000 + 30_000 } };
  const rev = I.livroDoBar(bar).filter((x) => x.ic === '🙌').map((x) => x.texto);
  assert.deepEqual(rev, ['Bia levantou Tati do chão', 'Will levantou Tati do chão', 'Will levantou Dani do chão', 'Tati levantou Dani do chão']);
  delete bar.fx.bia;
  for (const k of [2, 3, 4]) delete bar.fx.will[k];
  // Brinde do mesmo par a mais de 10 s: duas linhas.
  bar.fx.tati[0].t = 700 + 10_001;
  assert.equal(I.livroDoBar(bar).filter((x) => x.ic === '🍻').length, 2);
  const muitos = { kills: { will: Object.fromEntries(['tati', 'dani', 'bia', 'vini'].map((v, i) => [v, { n: 1, t: i }])) }, marks: {}, portais: {} };
  for (let i = 0; i < 30; i++) muitos.portais[`moscas`] = { ...(muitos.portais.moscas ?? {}), [['will', 'tati', 'dani', 'bia', 'vini'][i % 5]]: { s: i, t: 100 + i } };
  assert.ok(I.livroDoBar(muitos).length <= 20);
  assert.equal(I.livroDoBar({}, 20).length, 0);
  assert.equal(I.livroDoBar(null).length, 0);
});

test('há quanto: agora, minutos, horas e dias', () => {
  assert.equal(I.haQuanto(0, 59_000), 'agora');
  assert.equal(I.haQuanto(0, 60_000), 'há 1 min');
  assert.equal(I.haQuanto(0, 3_599_000), 'há 59 min');
  assert.equal(I.haQuanto(0, 3_600_000), 'há 1 h');
  assert.equal(I.haQuanto(0, 86_400_000), 'há 1 dia');
  assert.equal(I.haQuanto(0, 3 * 86_400_000), 'há 3 dias');
  assert.equal(I.haQuanto(5000, 0), 'agora', 'relógio adiantado');
});

/* ------------------------------------------------------------------ regras */

test('regras: fx aceita brinde e reviver (com o carimbo de 2 s) e recusa tipo inventado; marks vai até 6', () => {
  const now = T0;
  const db = { cruzadabotecos: { bar: { rate: { will: { at: now } } } } };
  const fx = (k, to = '') => [['cruzadabotecos', 'bar', 'fx', 'will', '0'], { k, to, e: '', t: now }];
  assert.equal(R.allowed(db, ...fx('brinde'), now), true);
  assert.equal(R.allowed(db, ...fx('brinde', 'tati'), now), true);
  assert.equal(R.allowed(db, ...fx('reviver', 'tati'), now), true);
  assert.equal(R.allowed(db, ...fx('abraco', 'tati'), now), false);
  assert.equal(R.allowed(db, ...fx('reviver', 'zeca'), now), false);
  const semCarimbo = { cruzadabotecos: { bar: { rate: { will: { at: now - 3000 } } } } };
  assert.equal(R.allowed(semCarimbo, ...fx('brinde'), now), false, 'sem o carimbo da espera');
  const mk = (n) => [['cruzadabotecos', 'bar', 'marks', 'tati'], { by: 'will', n, t: now }];
  assert.equal(R.allowed(db, ...mk(6), now), true);
  assert.equal(R.allowed(db, ...mk(0), now), true);
  assert.equal(R.allowed(db, ...mk(7), now), false);
  const regras = ler('database.rules.json');
  JSON.parse(regras);
  assert.ok(regras.includes('emoji|tapa|amendoim|cerveja|bigode|bola|brinde|reviver'), 'banco sem brinde/reviver');
  const marks = regras.slice(regras.indexOf('"marks": {'), regras.indexOf('"marks": {') + 900);
  assert.ok(marks.includes('newData.val() <= 6'), 'marks no banco não vai até 6');
  assert.ok(!marks.includes('newData.val() <= 3'), 'sobrou o limite antigo');
  const social = ler('src/bar/social.ts');
  assert.ok(/brinde: 1\.5/.test(social) && /reviver: 1\.1/.test(social));
});

/* ------------------------------------------------------------------ tela */

test('tela: B brinda, P e Esc no modo foto, livro, limpar a cara, sem limpeza automática e os 5 troféus', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  for (const s of ["k === 'KeyB'", "k === 'KeyP'", "k === 'Escape'", 'Limpar a cara', 'Livro do bar', 'vivo--foto', 'Salvar foto', 'passoReviver(', 'lerFx(', 'lkDoAmigo(', 'TROFEU_NOME', 'contaPegadinhas(', 'contaBrindes(', '< REVIVE_DE_NOVO_MS))', 'if (!podeZoar(antes, conta)) {', 'const ocupado = travado.current', 'if (fotoRef.current.on) {\n          desenhar(agora);\n          const meu = elo.enviar(']) assert.ok(v.includes(s), `falta ${s}`);
  assert.ok(!/te bigodeou[^\n]*\n\s*limpar\(4\)/.test(v), 'voltou a limpar a cara sozinho');
  assert.ok(v.includes("c.quem === 'amigo' || c.quem === 'remoto'"), 'pegadinha não aparece em quem está de pé');
  const css = ler('src/pixel.css');
  for (const s of ['.vivo--foto .vivo-hud', '.vivo-fotobar', '.vivo-zoado', '.vivo-livro']) assert.ok(css.includes(s), `css sem ${s}`);
  const pres = ler('src/bar/presence.ts');
  assert.ok(pres.includes('fxRaw(): unknown') && pres.includes('barRaw(): unknown'));
});

console.log(`\n${n} testes da Fatia 15 passaram`);
