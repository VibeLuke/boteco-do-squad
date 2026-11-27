// Testes da Fatia 17 (dragão no telhado e dinossauro fugido do circo): agenda (dragão só de noite), funções puras e
// determinísticas, furos e faixas em chão livre, linha de fogo, poças fora da parede, teste varrido da investida,
// molotov e geladeira no motor, tempo para derrubar, regras novas do banco e a ligação no jogo.
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
const F = await import('../src/vivo/feras.ts');
const B = await import('../src/vivo/briga.ts');
const M = await import('../src/vivo/mapa.ts');
const R = await import('./mock-rules.mjs');

let n = 0;
const test = (nome, fn) => {
  fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};
const T0 = Date.UTC(2026, 10, 27, 12, 0);
const E0 = E.epocaDe(T0);
const livre = (x, y) => M.anda(Math.floor(x), Math.floor(y));

test('agenda: o dragão só sai de noite (19 h às 5 h de Brasília), também na época forçada; o dino a qualquer hora', () => {
  let dragoes = 0;
  let dinos = 0;
  let forcadasDia = 0;
  for (let e = E0; e < E0 + 18 * 3000; e++) {
    const a = E.agenda(e);
    if (!a) continue;
    const h = E.horaDe(e * E.EPOCA_MS);
    if (a.tipo === 'dragao') {
      dragoes++;
      assert.ok(h >= 19 || h < 5, `dragão às ${h.toFixed(2)} h`);
    }
    if (a.tipo === 'dino') dinos++;
    if (E.ehForcada(e) && !(h >= 19 || h < 5)) forcadasDia++;
    assert.ok(a.fim - a.aviso <= E.EPOCA_MS, 'evento não cabe na época');
  }
  assert.ok(dragoes > 50, `poucos dragões: ${dragoes}`);
  assert.ok(dinos > 50, `poucos dinos: ${dinos}`);
  assert.ok(forcadasDia > 100);
  // Todo bloco de 3 h ainda tem pelo menos um evento (a forçada nunca fica sem tipo, nem de dia).
  for (let b = Math.floor(E0 / E.EPOCAS_POR_BLOCO); b < Math.floor(E0 / E.EPOCAS_POR_BLOCO) + 2000; b++) {
    let tem = false;
    for (let e = b * E.EPOCAS_POR_BLOCO; e < (b + 1) * E.EPOCAS_POR_BLOCO; e++) if (E.agenda(e)) tem = true;
    assert.ok(tem, `bloco ${b} sem evento`);
  }
  // Os dois cabem na época com o aviso inteiro.
  for (const k of ['dragao', 'dino']) assert.ok(E.EVENTOS[k].telegrafo + E.EVENTOS[k].dura <= E.EPOCA_MS, k);
});

test('funções puras: a mesma semente dá os mesmos furos, sopros, pisões e rota; sementes diferentes variam', () => {
  const d = E.EVENTOS.dragao.dura;
  const z = E.EVENTOS.dino.dura;
  for (const s of [1, 77, 123456, 4294967295]) {
    assert.deepEqual(F.furosDragao(s, d), F.furosDragao(s, d));
    assert.deepEqual(F.soprosDragao(s, d), F.soprosDragao(s, d));
    assert.deepEqual(F.pisoesDragao(s, d), F.pisoesDragao(s, d));
    assert.deepEqual(F.rotaDino(s, M.ENTRADA, z), F.rotaDino(s, M.ENTRADA, z));
  }
  const rotas = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => JSON.stringify(F.rotaDino(s * 7919, M.ENTRADA, z))));
  assert.ok(rotas.size >= 6, `rotas repetidas: ${rotas.size}`);
  const sopros = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => JSON.stringify(F.soprosDragao(s * 7919, d).map((p) => [p.dx, p.dy]))));
  assert.ok(sopros.size >= 6);
});

test('dragão: furos em chão livre, nunca o mesmo seguido, cabeça cobre o evento todo e pisa a cada troca', () => {
  for (const [x, y] of F.DRAGAO_FUROS) assert.ok(livre(x, y), `furo em ${x},${y}`);
  const d = E.EVENTOS.dragao.dura;
  for (let s = 1; s < 400; s++) {
    const f = F.furosDragao(s * 104729, d);
    assert.equal(f.length, Math.ceil(d / F.DRAGAO_TROCA_MS));
    for (let i = 1; i < f.length; i++) assert.notEqual(f[i], f[i - 1]);
    assert.deepEqual(F.cabecaDragao(f, d + 5000).furo, F.DRAGAO_FUROS[f[f.length - 1]]);
    assert.deepEqual(F.cabecaDragao(f, -10).furo, F.DRAGAO_FUROS[f[0]]);
    const p = F.pisoesDragao(s * 104729, d);
    assert.equal(p.length, f.length - 1);
    p.forEach((q, i) => assert.deepEqual(q.furo, F.DRAGAO_FUROS[f[i + 1]]));
  }
});

test('sopro: aviso de 1,2 s antes de cada fogo, um por vez, sem repetir a direção, dentro da fase do furo', () => {
  const d = E.EVENTOS.dragao.dura;
  for (let s = 1; s < 300; s++) {
    const so = F.soprosDragao(s * 15485863, d);
    assert.ok(so.length >= 12, `poucos sopros: ${so.length}`);
    for (let i = 0; i < so.length; i++) {
      const a = so[i];
      assert.ok(Math.abs(Math.hypot(a.dx, a.dy) - 1) < 1e-5);
      const fase = Math.floor(a.t0 / F.DRAGAO_TROCA_MS);
      assert.ok(a.t0 - F.FOGO_AVISO_MS >= fase * F.DRAGAO_TROCA_MS, 'aviso começa antes de a cabeça descer');
      assert.ok(a.t0 + F.FOGO_ATIVO_MS <= (fase + 1) * F.DRAGAO_TROCA_MS, 'fogo depois de a cabeça subir');
      if (i) {
        assert.ok(a.t0 - F.FOGO_AVISO_MS >= so[i - 1].t0 + F.FOGO_ATIVO_MS, 'dois sopros ao mesmo tempo');
        assert.ok(a.dx !== so[i - 1].dx || a.dy !== so[i - 1].dy, 'mesma direção seguida');
      }
    }
    const a = so[3];
    assert.equal(F.soproEm(so, a.t0 - F.FOGO_AVISO_MS)?.fase, 'aviso');
    assert.equal(F.soproEm(so, a.t0 - 1)?.fase, 'aviso');
    assert.equal(F.soproEm(so, a.t0)?.fase, 'ativo');
    assert.equal(F.soproEm(so, a.t0 + F.FOGO_ATIVO_MS - 1)?.s.id, a.id);
    assert.notEqual(F.soproEm(so, a.t0 + F.FOGO_ATIVO_MS)?.s.id, a.id);
  }
});

test('linha de fogo: pega quem está na faixa (0,4 a 7 ladrilhos, meia largura 0,55), não atrás nem do lado', () => {
  const s = { id: 0, de: [10.5, 4.5], dx: 1, dy: 0, t0: 0 };
  assert.equal(F.naLinhaFogo(s, 13, 4.5), true);
  assert.equal(F.naLinhaFogo(s, 17.4, 4.9), true);
  assert.equal(F.naLinhaFogo(s, 17.6, 4.5), false); // além dos 7
  assert.equal(F.naLinhaFogo(s, 13, 5.2), false); // do lado
  assert.equal(F.naLinhaFogo(s, 8, 4.5), false); // atrás
  assert.equal(F.naLinhaFogo(s, 10.6, 4.5), false); // embaixo da boca
  const dg = { ...s, dx: Math.SQRT1_2, dy: Math.SQRT1_2 };
  assert.equal(F.naLinhaFogo(dg, 12.5, 6.5), true);
  assert.equal(F.naLinhaFogo(dg, 12.5, 4.5), false);
});

test('fogo não atravessa parede nem móvel: todo ponto que queima tem caminho livre até a boca; sopro tem 2,5 de alcance', () => {
  const d = E.EVENTOS.dragao.dura;
  let pontos = 0;
  for (let s = 1; s < 150; s++)
    for (const a of F.soprosDragao(s * 31337, d)) {
      assert.ok(a.alc >= F.FOGO_ALC_MIN && a.alc <= F.FOGO_COMPR, `alcance ${a.alc}`);
      for (let x = Math.floor(a.de[0]) - 8; x <= a.de[0] + 8; x += 0.25)
        for (let y = Math.floor(a.de[1]) - 8; y <= a.de[1] + 8; y += 0.25) {
          if (!F.naLinhaFogo(a, x, y)) continue;
          pontos++;
          const ao = (x - a.de[0]) * a.dx + (y - a.de[1]) * a.dy;
          for (let k = 0.4; k <= ao; k += 0.05) assert.ok(livre(a.de[0] + a.dx * k, a.de[1] + a.dy * k), `fogo atrás de parede em ${x},${y}`);
        }
    }
  assert.ok(pontos > 10000, `poucos pontos: ${pontos}`);
  // Exemplo medido: do furo (18,5; 5,5) para cima (y −) há parede/móvel a 1,5; esse lado nunca é sorteado.
  assert.ok(F.alcanceFogo([18.5, 5.5], 0, -1) < F.FOGO_ALC_MIN);
});

test('poças de fogo: só em chão onde se anda, duram 8 s e somem; nunca atravessam parede', () => {
  const d = E.EVENTOS.dragao.dura;
  let total = 0;
  for (let s = 1; s < 200; s++) {
    const so = F.soprosDragao(s * 7, d);
    for (const a of so) {
      const p = F.pocasFogo([a], a.t0 + 100);
      total += p.length;
      for (const q of p) assert.ok(livre(q.x, q.y), `poça em ${q.x},${q.y}`);
      // Do furo até cada poça o caminho é chão livre (não pula parede).
      for (const q of p)
        for (let k = 1.2; k <= Math.hypot(q.x - a.de[0], q.y - a.de[1]); k += 0.2) assert.ok(livre(a.de[0] + a.dx * k, a.de[1] + a.dy * k), 'poça atrás de parede');
      assert.equal(F.pocasFogo([a], a.t0 - 1).length, 0);
      assert.equal(F.pocasFogo([a], a.t0 + F.POCA_FOGO_MS).length, 0);
    }
  }
  assert.ok(total > 500, `poucas poças: ${total}`);
});

test('dinossauro: faixas em chão livre, rota sem teleporte, entra e sai pela calçada antes do fim', () => {
  for (const [a, b] of F.FAIXAS_DINO)
    for (let k = 0; k <= 1; k += 0.01) assert.ok(livre(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k), `faixa ${a}→${b}`);
  const z = E.EVENTOS.dino.dura;
  for (let s = 1; s < 300; s++) {
    const r = F.rotaDino(s * 2654435761, M.ENTRADA, z);
    assert.ok(r.filter((t) => t.fase === 'investe').length >= 3, 'poucas investidas');
    assert.deepEqual(r[0].de, M.ENTRADA);
    assert.deepEqual(r[r.length - 1].para, M.ENTRADA);
    assert.ok(r[r.length - 1].t1 <= z, 'não sai antes do fim');
    for (let i = 1; i < r.length; i++) {
      assert.equal(r[i].t0, r[i - 1].t1);
      assert.deepEqual(r[i].de, r[i - 1].para, 'teleporte');
    }
    // Velocidade: trote 2,2 e investida 7 ladrilhos/s (nunca mais).
    for (const t of r)
      if (t.t1 > t.t0) {
        const v = Math.hypot(t.para[0] - t.de[0], t.para[1] - t.de[1]) / ((t.t1 - t.t0) / 1000);
        assert.ok(v <= (t.fase === 'investe' ? F.DINO_INVESTE : F.DINO_TROTE) + 1e-6);
      }
    const faixa = (t) => JSON.stringify([t.de, t.para].map(String).sort());
    const inv = r.filter((t) => t.fase === 'investe');
    for (let i = 1; i < inv.length; i++) assert.notEqual(faixa(inv[i]), faixa(inv[i - 1]), 'mesma faixa em seguida');
    assert.equal(F.posDino(r, z).fora, true);
    assert.equal(F.posDino(r, -1).fora, true);
    const prep = r.find((t) => t.fase === 'prepara');
    const p = F.posDino(r, prep.t0 + 10);
    assert.equal(p.fase, 'prepara');
    assert.deepEqual(p.alvo, r[r.indexOf(prep) + 1].para);
  }
});

test('investida: teste varrido pega quem está no caminho mesmo num quadro lento; fora do caminho ou na preparação, não', () => {
  const z = E.EVENTOS.dino.dura;
  const r = F.rotaDino(99, M.ENTRADA, z);
  const inv = r.find((t) => t.fase === 'investe');
  const meio = [(inv.de[0] + inv.para[0]) / 2, (inv.de[1] + inv.para[1]) / 2];
  const tm = (inv.t0 + inv.t1) / 2;
  // Quadro de 300 ms (o bicho anda 2,1 ladrilhos nele): o ponto do meio fica entre dois quadros e ainda pega.
  assert.equal(F.batidaDino(r, tm - 150, tm + 150, meio[0], meio[1]), inv.id);
  // Ver só o ponto do quadro (amostras a cada 300 ms) pularia por cima: prova de que o varrido é preciso.
  const ponto = (u) => F.posDino(r, u);
  const pertoDoPonto = [tm - 150, tm + 150].some((u) => Math.hypot(ponto(u).x - meio[0], ponto(u).y - meio[1]) <= F.DINO_RAIO + 0.3);
  assert.equal(pertoDoPonto, false);
  // Longe da faixa: não pega.
  const nx = -(inv.para[1] - inv.de[1]);
  const ny = inv.para[0] - inv.de[0];
  const nn = Math.hypot(nx, ny);
  assert.equal(F.batidaDino(r, tm - 150, tm + 150, meio[0] + (nx / nn) * 1.5, meio[1] + (ny / nn) * 1.5), null);
  // Na preparação (parado raspando a pata), ficar colado não machuca.
  const prep = r[r.indexOf(inv) - 1];
  assert.equal(F.batidaDino(r, prep.t0, prep.t0 + 200, prep.de[0], prep.de[1]), null);
  // Janela no máximo 250 ms: um quadro de 3 s atrasado não pega quem estava lá 2 s atrás.
  assert.equal(F.batidaDino(r, inv.t0, inv.t1 + 2000, inv.de[0], inv.de[1]), null);
});

test('motor: golpe com a molotov na cabeça avisa a arma; abrir a geladeira avisa onde (com ou sem cerveja)', () => {
  const m = B.novoMundo('will', T0, 7);
  const me = B.eu(m);
  me.x = 10.5;
  me.y = 4.5;
  me.fx = 1;
  me.fy = 0;
  me.arma = { tipo: 'molotov', usos: 1 };
  const vistos = [];
  for (let i = 0; i < 40; i++) {
    m.extras = [{ id: 'dragao', x: me.x + 0.8, y: me.y, raio: F.DRAGAO_RAIO }];
    m.eventos.length = 0;
    B.passo(m, { ...B.PARADO, soco: i === 0 }, B.DT);
    vistos.push(...m.eventos.filter((e) => e.k === 'extra'));
  }
  assert.equal(vistos.length, 1);
  assert.equal(vistos[0].id, 'dragao');
  assert.equal(vistos[0].arma, 'molotov');
  // Jogada (K): a garrafa voa, acerta a cabeça a 2 ladrilhos e quebra nela.
  const m2 = B.novoMundo('will', T0, 7);
  const eu2 = B.eu(m2);
  Object.assign(eu2, { x: 8.5, y: 4.5, fx: 1, fy: 0, arma: { tipo: 'molotov', usos: 1 } });
  const jogada = [];
  const quebras = [];
  let golpesNaJogada = 0;
  for (let i = 0; i < 60; i++) {
    m2.extras = [{ id: 'dragao', x: 10.5, y: 4.5, raio: F.DRAGAO_RAIO }];
    m2.eventos.length = 0;
    B.passo(m2, { ...B.PARADO, agarra: i === 0 }, B.DT);
    jogada.push(...m2.eventos.filter((e) => e.k === 'extra'));
    quebras.push(...m2.eventos.filter((e) => e.k === 'quebra'));
    if (i === 0) golpesNaJogada = m2.eventos.filter((e) => e.k === 'golpe').length;
  }
  // A garrafa para na cabeça: quebra ali e não segue voando até quem está atrás.
  assert.equal(quebras.length, 1);
  assert.ok(Math.abs(quebras[0].x - 10.5) <= F.DRAGAO_RAIO + 0.05, `quebrou em ${quebras[0].x}`);
  assert.equal(golpesNaJogada, 0);
  assert.equal(jogada.length, 1);
  assert.equal(jogada[0].id, 'dragao');
  assert.equal(jogada[0].arma, 'molotov');
  // Geladeira: duas vezes seguidas (a segunda bate na espera da cerveja) e as duas avisam.
  me.x = 11.5;
  me.y = 1.6;
  me.arma = null;
  let gel = 0;
  for (let i = 0; i < 40; i++) {
    m.eventos.length = 0;
    B.passo(m, { ...B.PARADO, usa: i === 0 || i === 20 }, B.DT);
    gel += m.eventos.filter((e) => e.k === 'geladeira').length;
  }
  assert.equal(gel, 2);
  // Longe da geladeira: nada.
  me.x = 5.5;
  me.y = 5.5;
  m.eventos.length = 0;
  B.passo(m, { ...B.PARADO, usa: true }, B.DT);
  assert.equal(m.eventos.filter((e) => e.k === 'geladeira').length, 0);
});

test('tempo para derrubar só no soco: dá trabalho sozinho e com 5 não passa de metade do evento', () => {
  const golpe = (B.JAB.antecipa + B.JAB.recupera) / 1000;
  const seg = (vida, k = 1) => Math.ceil(vida / (B.JAB.dano * k)) * golpe;
  for (const [ent, vida, dura] of [
    ['dragao', F.DRAGAO_VIDA, E.EVENTOS.dragao.dura],
    ['dino', F.DINO_VIDA, E.EVENTOS.dino.dura],
  ]) {
    const s1 = seg(E.vidaEscalada(vida, 1));
    const s5 = seg(E.vidaEscalada(vida, 5)) / 5;
    console.log(`  ${ent}: sozinho ${s1.toFixed(1)} s de soco seguido; com 5, ${s5.toFixed(1)} s cada`);
    assert.ok(s1 >= 5, `${ent} cai rápido demais`);
    assert.ok(s1 <= dura / 1000 / 2, `${ent} não cai sozinho em metade do evento`);
    assert.ok(s5 <= dura / 1000 / 2);
  }
  // Sono e susto dobram o dano.
  assert.ok(seg(F.DRAGAO_VIDA, 2) < seg(F.DRAGAO_VIDA) * 0.55);
});

test('regras: tipos, entidades e troféus novos no banco e no espelho; o resto continua negado', () => {
  const regras = ler('database.rules.json');
  assert.match(regras, /\(ratazana\|apagao\|alien\|dragao\|dino\)/);
  assert.match(regras, /\(rato\|alien\|grande\|disco\[0-5\]\|dragao\|dino\)/);
  assert.match(regras, /\(rabo\|vela\|gorjeta\|antena\|sumiuze\|dente\|ovo\)/);
  const now = T0;
  const ev = (...k) => ['cruzadabotecos', 'bar', 'evento', '2999999', ...k];
  let db = {};
  assert.equal(R.allowed(db, ev('abertura'), { n: 2, at: now }, now), true);
  db = { cruzadabotecos: { bar: { evento: { 2999999: { abertura: { n: 2, at: now } } } } } };
  for (const ent of ['dragao', 'dino']) assert.equal(R.allowed(db, ev('dano', ent, 'will'), 10, now), true, ent);
  for (const ent of ['dragão', 'dinossauro', 'dragao2']) assert.equal(R.allowed(db, ev('dano', ent, 'will'), 10, now), false, ent);
  for (const t of ['dente', 'ovo']) assert.equal(R.allowed({}, ['cruzadabotecos', 'bar', 'trofeus', t, 'will'], now, now), true, t);
  for (const t of ['escama', 'ovo2']) assert.equal(R.allowed({}, ['cruzadabotecos', 'bar', 'trofeus', t, 'will'], now, now), false, t);
});

test('o jogo liga as feras: diretor, dano no livro, prêmio uma vez, geladeira, sono, desenho e aviso no chão', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  assert.match(v, /if \(ag\.tipo === 'dragao' \|\| ag\.tipo === 'dino'\)/);
  assert.match(v, /void barPresence\.somarDano\(ag\.epoca, ent, ev\.meuDano\);/);
  assert.match(v, /pagarEvento\(ag\.tipo, ent === 'dragao' \? PREMIO_DRAGAO : PREMIO_DINO\)/);
  assert.match(v, /if \(ev\.fim\?\.como === 'morto' && !ev\.premiado\)/);
  assert.match(v, /case 'geladeira':/);
  assert.match(v, /ev\.atordoaAte = m\.t \+ ATORDOA_MS/);
  assert.match(v, /ev\.sustoId !== ev\.dino\.id && /); // um susto por investida
  assert.match(v, /ev\.sonoAte = m\.t \+ SONO_MS/);
  assert.match(v, /ferirPorEvento\(m, me, DANO_FOGO/);
  assert.match(v, /ferirPorEvento\(m, me, DANO_POCA/);
  assert.match(v, /ferirPorEvento\(m, me, DANO_DINO/);
  assert.match(v, /desenharDragao\(/);
  assert.match(v, /desenharDino\(/);
  // O aviso fica no chão (antes da lista de profundidade); o jato vai por cima.
  const iChao = v.indexOf("desenharChaoFera(t, agora, cx, cy, 'chao')");
  assert.ok(iChao > 0 && iChao < v.indexOf('const lista: D[] = [];'), 'aviso das feras fora da camada do chão');
  assert.ok(v.indexOf("desenharChaoFera(t, agora, cx, cy, 'fogo')") > v.indexOf('const lista: D[] = [];'));
  // O dano do fogo e da investida é uma vez por sopro / por investida.
  assert.match(v, /!ev\.queimados\.has\(s\.s\.id\)/);
  assert.match(v, /!ev\.batidas\.has\(b\)/);
  // Movimento reduzido: o aviso do chão para de piscar.
  assert.match(v, /reduzidoRef\.current \|\| Math\.floor\(agora \/ 140\)/);
  // O nome dos troféus e títulos novos.
  assert.match(ler('src/vivo/interacoes.ts'), /dente: 'Dente de Dragão'/);
  assert.match(ler('src/vivo/visual.ts'), /id: 'dino', nome: 'Babá de Dinossauro', trofeu: 'ovo'/);
});

console.log(`# fatia 17: ${n} testes`);
