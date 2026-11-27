// Testes da Fatia 10 (diretor de eventos): agenda pura da hora do servidor (mesma saída em todo lugar, nunca dois
// seguidos, ao menos 1 por bloco de 3 h em 10 mil blocos), chave do dono, escala por jogadores, livro de dano
// comutativo, prêmio da segunda vez, rota da ratazana, golpe em bicho de evento e as regras novas do banco.
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
const E = await import('../src/vivo/eventos.ts');
const B = await import('../src/vivo/briga.ts');
const R = await import('./mock-rules.mjs');

let n = 0;
const test = (nome, fn) => {
  fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};
const T0 = Date.UTC(2026, 10, 27, 12, 0);
const E0 = E.epocaDe(T0);
const B0 = Math.floor(E0 / E.EPOCAS_POR_BLOCO);

/* ------------------------------------------------------------------ agenda */

test('agenda: mesma saída sempre (função pura), cabe na época e começa depois do aviso', () => {
  for (let e = E0; e < E0 + 500; e++) {
    const a = E.agenda(e);
    assert.deepEqual(a, E.agenda(e));
    if (!a) continue;
    assert.ok(a.aviso >= e * E.EPOCA_MS && a.fim <= (e + 1) * E.EPOCA_MS, `época ${e}`);
    assert.equal(a.inicio - a.aviso, E.EVENTOS[a.tipo].telegrafo);
    assert.equal(a.fim - a.inicio, E.EVENTOS[a.tipo].dura);
    assert.ok(E.EVENTOS[a.tipo].telegrafo >= 20_000 && E.EVENTOS[a.tipo].telegrafo <= 60_000);
  }
});

test('agenda em 10 mil blocos de 3 h: nunca dois seguidos, ao menos 1 por bloco, ~1 por hora', () => {
  let total = 0;
  let seguidos = 0;
  let vazios = 0;
  let ant = -9;
  const ultimo = {};
  let intervaloQuebrado = 0;
  for (let b = B0; b < B0 + 10_000; b++) {
    let k = 0;
    for (let i = 0; i < E.EPOCAS_POR_BLOCO; i++) {
      const e = b * E.EPOCAS_POR_BLOCO + i;
      const a = E.agenda(e);
      if (!a) continue;
      k++;
      total++;
      if (ant === e - 1) seguidos++;
      ant = e;
      if (!E.ehForcada(e) && ultimo[a.tipo] !== undefined && e - ultimo[a.tipo] <= E.EVENTOS[a.tipo].intervalo) intervaloQuebrado++;
      ultimo[a.tipo] = e;
    }
    if (!k) vazios++;
  }
  assert.equal(seguidos, 0);
  assert.equal(vazios, 0);
  assert.equal(intervaloQuebrado, 0);
  const porHora = total / 10_000 / 3;
  assert.ok(porHora > 0.6 && porHora < 1.2, String(porHora));
});

test('chave do dono: 0 desliga tudo (até a forçada), 2 dobra a chance, "forçar" põe o evento na época', () => {
  const conta = (cfg) => {
    let k = 0;
    for (let e = E0; e < E0 + 3000; e++) if (E.agenda(e, cfg)) k++;
    return k;
  };
  assert.equal(conta({ mult: 0 }), 0);
  assert.ok(conta({ mult: 2 }) > conta({ mult: 1 }));
  const livre = Array.from({ length: 200 }, (_, i) => E0 + i).find((e) => !E.agenda(e));
  const f = E.agenda(livre, { mult: 1, forcar: { [String(livre)]: 'apagao' } });
  assert.equal(f.tipo, 'apagao');
  assert.equal(E.eventoEm(f.inicio + 1, { mult: 1, forcar: { [String(livre)]: 'apagao' } }).epoca, livre);
  assert.equal(E.faseEvento(f, f.aviso - 1), 'fora');
  assert.equal(E.faseEvento(f, f.aviso), 'aviso');
  assert.equal(E.faseEvento(f, f.inicio), 'andamento');
  assert.equal(E.faseEvento(f, f.fim), 'fora');
});

test('chave do dono vinda do banco: lixo vira o padrão, multiplicador entre 0 e 3, forçar só com tipo conhecido', () => {
  assert.deepEqual(E.sanitizeConfig(null), { mult: 1 });
  assert.deepEqual(E.sanitizeConfig('x'), { mult: 1 });
  assert.equal(E.sanitizeConfig({ mult: 9 }).mult, 3);
  assert.equal(E.sanitizeConfig({ mult: -2 }).mult, 0);
  assert.equal(E.sanitizeConfig({ mult: NaN }).mult, 1);
  assert.deepEqual(E.sanitizeConfig({ mult: 1, forcar: { 123: 'apagao', abc: 'apagao', 7: 'fiscal' } }), { mult: 1, forcar: { 123: 'apagao' } });
});

/* ------------------------------------------------------------------ escala, livro e prêmio */

test('vida escala com os jogadores da abertura: base · (1 + 0,5 · (n − 1)), de 1 a 5', () => {
  assert.equal(E.vidaEscalada(150, 1), 150);
  assert.equal(E.vidaEscalada(150, 2), 225);
  assert.equal(E.vidaEscalada(150, 5), 450);
  assert.equal(E.vidaEscalada(150, 9), 450);
  assert.equal(E.vidaEscalada(150, 0), 150);
  assert.equal(E.vidaEscalada(150, NaN), 150);
});

test('livro de dano: soma comutativa (qualquer ordem de chegada dá o mesmo desfecho) e ignora lixo', () => {
  const livro = { will: 40, dani: 70, vini: 25 };
  const ordens = [['will', 'dani', 'vini'], ['vini', 'will', 'dani'], ['dani', 'vini', 'will']];
  const restos = ordens.map((o) => E.vidaRestante(150, Object.fromEntries(o.map((k) => [k, livro[k]]))));
  assert.deepEqual(restos, [15, 15, 15]);
  assert.equal(E.somaLivro({ will: 10, x: 'abc', y: -50, z: NaN, w: 1e9 }), 10 + 100_000);
  assert.equal(E.vidaRestante(100, { will: 400 }), 0);
  assert.equal(E.somaLivro(null), 0);
});

test('prêmio: cheio na primeira vez do dia, metade da segunda em diante', () => {
  assert.deepEqual([0, 1, 2, 7].map((k) => E.premio(20, k)), [20, 10, 10, 10]);
  assert.equal(E.premio(15, 1), 8);
});

/* ------------------------------------------------------------------ ratazana */

test('ratazana: rota igual para a mesma semente, sai e volta pela porta antes do fim, sem teleporte', () => {
  const porta = [0.7, 5.5];
  const comidas = [[4.5, 3.4], [6.5, 3.4], [8.5, 3.4], [3.5, 6.4], [8.5, 7.4], [11.5, 1.3], [1.1, 3.5], [10.5, 4.5]];
  const dura = E.EVENTOS.ratazana.dura;
  for (const s of [1, 2, 99, 123456]) {
    const r = E.rotaRato(s, porta, comidas, dura);
    assert.deepEqual(r, E.rotaRato(s, porta, comidas, dura));
    assert.deepEqual(r[0].de, porta);
    assert.deepEqual(r.at(-1).para, porta);
    assert.ok(r.at(-1).t1 <= dura);
    assert.ok(r.filter((p) => p.rouba).every((p) => Math.abs(p.t1 - p.t0 - E.RATO_PAUSA) < 1e-6));
    let ant = E.posRato(r, 0);
    for (let t = 50; t < r.at(-1).t1; t += 50) {
      const p = E.posRato(r, t);
      assert.ok(Math.hypot(p.x - ant.x, p.y - ant.y) <= E.RATO_VEL * 0.05 + 1e-6, `salto em ${t}`);
      assert.equal(p.fora, false);
      ant = p;
    }
    assert.equal(E.posRato(r, r.at(-1).t1).fora, true);
    assert.equal(E.posRato(r, -1).fora, true);
    let roubos = 0;
    for (let t = 0; t <= dura; t += 500) {
      const k = E.roubosAte(r, t);
      assert.ok(k >= roubos);
      roubos = k;
    }
    assert.ok(roubos >= 3, String(roubos));
  }
  // Duas sementes diferentes, duas rotas diferentes.
  assert.notDeepEqual(E.rotaRato(1, porta, comidas, dura), E.rotaRato(2, porta, comidas, dura));
});

test('golpe em bicho de evento: o motor avisa só quando o bicho está perto e na frente', () => {
  const ex = { id: 'rato', x: 5.7, y: 5, raio: 0.45 };
  const c = { x: 5, y: 5, fx: 1, fy: 0 };
  assert.equal(B.acertaExtra(c, 0.95, ex), true);
  assert.equal(B.acertaExtra({ ...c, fx: -1 }, 0.95, ex), false); // de costas
  assert.equal(B.acertaExtra(c, 0.95, { ...ex, x: 7 }), false); // longe
  const m = B.novoMundo('will', T0, 7);
  const me = B.eu(m);
  me.fx = 1;
  me.fy = 0;
  m.extras = [{ id: 'rato', x: me.x + 0.7, y: me.y, raio: 0.45 }];
  const vistos = [];
  for (let i = 0; i < 40; i++) {
    m.eventos.length = 0;
    B.passo(m, { ...B.PARADO, soco: i === 0 }, B.DT);
    vistos.push(...m.eventos.filter((e) => e.k === 'extra'));
    m.extras = [{ id: 'rato', x: me.x + 0.7, y: me.y, raio: 0.45 }];
  }
  assert.equal(vistos.length, 1);
  assert.equal(vistos[0].id, 'rato');
  assert.equal(vistos[0].dano, B.JAB.dano);
});

/* ------------------------------------------------------------------ regras do banco (espelho) */

test('regras: abertura e fim criados uma vez só; dano só cresce e exige abertura; troféu uma vez por jogador', () => {
  const now = T0;
  const ev = (...k) => ['cruzadabotecos', 'bar', 'evento', '2999999', ...k];
  let db = {};
  // Dano antes da abertura: negado.
  assert.equal(R.allowed(db, ev('dano', 'rato', 'will'), 10, now), false);
  assert.equal(R.allowed(db, ev('abertura'), { n: 0, at: now }, now), false);
  assert.equal(R.allowed(db, ev('abertura'), { n: 6, at: now }, now), false);
  assert.equal(R.allowed(db, ev('abertura'), { n: 2, at: now - 5 }, now), false);
  assert.equal(R.allowed(db, ev('abertura'), { n: 2, at: now }, now), true);
  db = R.setAt(db, ev('abertura'), { n: 2, at: now });
  assert.equal(R.allowed(db, ev('abertura'), { n: 3, at: now }, now), false, 'segunda abertura passou');
  assert.equal(R.allowed(db, ev('dano', 'rato', 'will'), 10, now), true);
  db = R.setAt(db, ev('dano', 'rato', 'will'), 10);
  assert.equal(R.allowed(db, ev('dano', 'rato', 'will'), 9, now), false, 'dano diminuiu');
  assert.equal(R.allowed(db, ev('dano', 'rato', 'will'), 25, now), true);
  assert.equal(R.allowed(db, ev('dano', 'rato', 'zeca'), 25, now), false);
  assert.equal(R.allowed(db, ev('dano', 'fiscal', 'will'), 25, now), false);
  assert.equal(R.allowed(db, ev('dano', 'rato', 'will'), 100_001, now), false);
  assert.equal(R.allowed(db, ev('fim'), { como: 'morto', p: 'dani', at: now }, now), true);
  assert.equal(R.allowed(db, ev('fim'), { como: 'fugiu', p: 'dani', at: now }, now), false);
  db = R.setAt(db, ev('fim'), { como: 'morto', p: 'dani', at: now });
  assert.equal(R.allowed(db, ev('fim'), { como: 'morto', p: 'will', at: now }, now), false, 'segundo fim passou');
  assert.equal(R.allowed({}, ev('fim'), { como: 'religado', p: 'will', at: now }, now), false, 'fim sem abertura');
  assert.equal(R.allowed(db, ['cruzadabotecos', 'bar', 'evento', 'abc', 'abertura'], { n: 1, at: now }, now), false);
  const tr = ['cruzadabotecos', 'bar', 'trofeus', 'rabo', 'will'];
  assert.equal(R.allowed(db, tr, now, now), true);
  assert.equal(R.allowed(R.setAt(db, tr, now), tr, now + 1, now + 1), false, 'troféu duas vezes');
  assert.equal(R.allowed(db, ['cruzadabotecos', 'bar', 'trofeus', 'coroa', 'will'], now, now), false);
});

test('regras: chave do dono só com p = will; evento pode ser apagado só 1 h depois da abertura', () => {
  const now = T0;
  const cfg = ['cruzadabotecos', 'bar', 'config', 'eventos'];
  assert.equal(R.allowed({}, cfg, { mult: 2, p: 'will', t: now }, now), true);
  assert.equal(R.allowed({}, cfg, { mult: 2, p: 'dani', t: now }, now), false);
  assert.equal(R.allowed({}, cfg, { mult: 4, p: 'will', t: now }, now), false);
  assert.equal(R.allowed({}, cfg, { mult: 1, p: 'will', t: now, forcar: { 2999999: 'apagao' } }, now), true);
  assert.equal(R.allowed({}, cfg, { mult: 1, p: 'will', t: now, forcar: { 2999999: 'fiscal' } }, now), false);
  assert.equal(R.allowed({}, cfg, { mult: 1, p: 'will', t: now, extra: 1 }, now), false);
  const ev = ['cruzadabotecos', 'bar', 'evento', '2999999'];
  const db = R.setAt({}, [...ev, 'abertura'], { n: 1, at: now });
  assert.equal(R.allowed(db, ev, null, now + 60_000), false, 'apagou evento recente');
  assert.equal(R.allowed(db, ev, null, now + 3_600_001), true);
  assert.equal(R.allowed(R.setAt({}, [...ev, 'dano', 'rato', 'will'], 3), ev, null, now), true, 'sem abertura pode apagar');
  assert.equal(R.allowed(db, ['cruzadabotecos', 'bar', 'loja', 'will'], null, now + 9e9), false, 'apagou fora do evento');
});

test('o jogo usa o diretor: a cada quadro e no gancho de teste, E no disjuntor religa, extras no motor', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  assert.equal((v.match(/diretor\((agora|performance\.now\(\))\);/g) ?? []).length >= 4, true);
  assert.match(v, /if \(toque\.current\.usa && apagado\(\) && pertoDisjuntor\(\) && religar\(\)\) toque\.current\.usa = false;/);
  assert.match(v, /m\.extras = \[\{ id: 'rato'/);
  assert.match(v, /void barPresence\.somarDano\(ag\.epoca, 'rato', ev\.meuDano\);/);
  assert.match(v, /ev\.meuDano > ev\.enviado && agora - ev\.enviadoEm > 500/);
});

console.log(`# fatia 10: ${n} testes`);
