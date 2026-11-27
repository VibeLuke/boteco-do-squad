// Testes da Fatia 11 (visita do alienígena e invasão): agenda do alien, alvos e fases dos discos pelo livro de dano,
// raio do disco grande, desfecho em três estados, ordem dos prêmios, dano de evento sem atacante, regras novas do
// banco e a ligação no jogo.
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
const I = await import('../src/vivo/invasao.ts');
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

test('agenda: o alien aparece, cabe na época (visita + invasão inteira) e respeita 12 épocas entre um e outro', () => {
  const def = E.EVENTOS.alien;
  assert.ok(def.dura >= I.VISITA_MS + I.INVASAO_MS + 3_000, 'invasão não cabe no evento');
  assert.ok(def.telegrafo + def.dura <= E.EPOCA_MS);
  let ultimo = -1e9;
  let vezes = 0;
  for (let e = E0; e < E0 + 18 * 2000; e++) {
    const a = E.agenda(e);
    if (a?.tipo !== 'alien') continue;
    vezes++;
    if (!E.ehForcada(e)) assert.ok(e - ultimo >= def.intervalo, `alien em ${ultimo} e ${e}`);
    ultimo = e;
    assert.ok(a.fim <= (e + 1) * E.EPOCA_MS);
  }
  assert.ok(vezes > 200, String(vezes));
  const f = E.agenda(E0, { mult: 1, forcar: { [E0]: 'alien' } });
  assert.equal(f?.tipo, 'alien');
});

test('alvos dos discos: mesma semente, mesmos alvos; sem repetir enquanto houver NPC novo; vazio vira ""', () => {
  const npcs = ['ze', 'dona', 'tonhao', 'bebum'];
  const a = I.alvosDiscos(42, npcs);
  assert.deepEqual(a, I.alvosDiscos(42, [...npcs].reverse()), 'depende da ordem da lista');
  assert.equal(a.length, I.N_DISCOS);
  assert.equal(new Set(a.slice(0, 4)).size, 4);
  assert.deepEqual(a.slice(4), a.slice(0, 2));
  assert.notDeepEqual(I.alvosDiscos(43, npcs), a);
  assert.deepEqual(I.alvosDiscos(1, []), Array(I.N_DISCOS).fill(''));
});

test('fase do disco: longe → feixe (8 s) → levou; derrubado se o livro passa da vida; subida do feixe 0 a 1', () => {
  const H = 50;
  for (let k = 0; k < I.N_DISCOS; k++) {
    const t0 = I.ondaDisco(k);
    assert.equal(I.faseDisco(k, t0 - 1, {}, H), 'longe');
    assert.equal(I.faseDisco(k, t0, {}, H), 'feixe');
    assert.equal(I.faseDisco(k, t0 + I.FEIXE_MS - 1, { will: 49 }, H), 'feixe');
    assert.equal(I.faseDisco(k, t0 + I.FEIXE_MS, {}, H), 'levou');
    assert.equal(I.faseDisco(k, t0 + 100, { will: 30, dani: 20 }, H), 'derrubado');
    assert.equal(I.faseDisco(k, t0 + 100, { dani: 20, will: 30 }, H), 'derrubado');
    assert.equal(I.subidaFeixe(k, t0 - 5), 0);
    assert.equal(I.subidaFeixe(k, t0 + I.FEIXE_MS + 5), 1);
    let ant = -1;
    for (let u = 0; u <= I.FEIXE_MS; u += 500) {
      const s = I.subidaFeixe(k, t0 + u);
      assert.ok(s >= ant && s >= 0 && s <= 1);
      ant = s;
    }
  }
  // O último disco abre o feixe e termina dentro da invasão.
  assert.ok(I.ondaDisco(I.N_DISCOS - 1) + I.FEIXE_MS <= I.INVASAO_MS);
});

test('disco grande: chega a 30%, paira no salão, raio avisa 1,2 s, queima 0,4 s, igual para a mesma semente', () => {
  assert.equal(I.varredura(9, I.GRANDE_EM - 1), null);
  assert.equal(I.varredura(9, I.INVASAO_MS), null);
  let avisos = 0;
  let ativos = 0;
  for (let t = I.GRANDE_EM; t < I.INVASAO_MS; t += 50) {
    const l = I.varredura(9, t);
    assert.deepEqual(l, I.varredura(9, t));
    const u = (t - I.GRANDE_EM) % I.VARRE_MS;
    if (u < I.VARRE_AVISO) assert.equal(l?.fase, 'aviso');
    else if (u < I.VARRE_AVISO + I.VARRE_ATIVO) assert.equal(l?.fase, 'ativo');
    else assert.equal(l, null);
    if (l) {
      if (l.fase === 'aviso') avisos++;
      else ativos++;
      assert.ok(l.v >= 1.5 && l.v <= (l.eixo === 'x' ? 19.5 : 8.5), JSON.stringify(l));
    }
    const g = I.posGrande(t);
    assert.ok(g.x > 6 && g.x < 14 && g.y > 2.9 && g.y < 7.1, JSON.stringify(g));
  }
  assert.ok(avisos > ativos * 2 && ativos > 0);
  assert.equal(I.naLinha({ eixo: 'x', v: 5.5 }, 5.9, 3), true);
  assert.equal(I.naLinha({ eixo: 'x', v: 5.5 }, 6.1, 3), false);
  assert.equal(I.naLinha({ eixo: 'y', v: 4.5 }, 0, 4.0), true);
});

test('desfecho em três estados, cota de levados e prêmio: vitória > pacífico > empate > derrota para 1 a 5', () => {
  assert.equal(I.cotaLevados(1), 1);
  assert.equal(I.cotaLevados(3), 2);
  assert.equal(I.cotaLevados(5), 2);
  assert.equal(I.desfecho(1, 1, true), 'vitoria');
  assert.equal(I.desfecho(2, 1, true), 'empate');
  assert.equal(I.desfecho(0, 1, false), 'empate');
  assert.equal(I.desfecho(3, 2, false), 'derrota');
  for (let k = 1; k <= 5; k++) {
    const v = I.premioInvasao('vitoria', k);
    const e = I.premioInvasao('empate', k);
    const d = I.premioInvasao('derrota', k);
    assert.ok(v > I.PREMIO_PACIFICO && I.PREMIO_PACIFICO > e && e > d && d > 0, `${k}: ${v} ${e} ${d}`);
  }
  assert.equal(I.TROFEU_FINAL.empate, '');
  assert.deepEqual(I.vidasInvasao(1), { alien: I.ALIEN_VIDA, disco: I.DISCO_VIDA, grande: I.GRANDE_VIDA });
  assert.equal(I.vidasInvasao(3).grande, E.vidaEscalada(I.GRANDE_VIDA, 3));
});

test('dano de evento sem atacante: derruba você com o nocaute de sempre, sem contar para ninguém', () => {
  const m = B.novoMundo('will', T0, 7);
  const me = B.eu(m);
  const grana = m.chao.length;
  let golpes = 0;
  for (let i = 0; i < 30 && me.estado !== 'ko'; i++) {
    me.atordoadoAte = 0;
    B.ferirPorEvento(m, me, I.DANO_RAIO, 1, 0);
    golpes++;
  }
  assert.equal(me.estado, 'ko');
  assert.equal(golpes, Math.ceil(me.vidaMax / I.DANO_RAIO));
  const ko = m.eventos.find((e) => e.k === 'ko');
  assert.equal(ko?.de, 'evento');
  assert.ok(m.eventos.filter((e) => e.k === 'golpe').every((e) => e.de === 'evento'));
  assert.equal(m.chao.length, grana, 'soltou coisa no chão');
  // Quem já caiu ou está fora não leva mais.
  const v = me.vida;
  B.ferirPorEvento(m, me, 50, 1, 0);
  assert.equal(me.vida, v);
});

test('bater no disco não acerta o NPC que ele está levando (sem o disco, o mesmo soco acerta)', () => {
  const golpe = (protege) => {
    const m = B.novoMundo('will', T0, 7);
    const me = B.eu(m);
    const npc = m.corpos.find((c) => c.quem === 'npc' && !c.ausente);
    me.x = npc.x - 0.7;
    me.y = npc.y;
    me.fx = 1;
    me.fy = 0;
    const vida = npc.vida;
    const extras = () => [{ id: 'disco0', x: npc.x, y: npc.y, raio: 0.5, ...(protege ? { protege: npc.id } : {}) }];
    m.extras = extras();
    let noDisco = 0;
    for (let i = 0; i < 40; i++) {
      m.eventos.length = 0;
      me.x = npc.x - 0.7;
      me.y = npc.y;
      B.passo(m, { ...B.PARADO, soco: i === 0 }, B.DT);
      noDisco += m.eventos.filter((e) => e.k === 'extra').length;
      m.extras = extras();
    }
    return { npcApanhou: npc.vida < vida, noDisco };
  };
  assert.deepEqual(golpe(true), { npcApanhou: false, noDisco: 1 });
  assert.deepEqual(golpe(false), { npcApanhou: true, noDisco: 1 });
  assert.match(ler('src/vivo/VivoScreen.tsx'), /raio: 0\.5, protege: alvo\.id \}/);
});

test('regras: dano do alien, do grande e de 6 discos; troféus novos; forçar o alien', () => {
  const now = T0;
  const ev = (...k) => ['cruzadabotecos', 'bar', 'evento', '2999999', ...k];
  const db = R.setAt({}, ev('abertura'), { n: 2, at: now });
  for (const ent of ['alien', 'grande', 'disco0', 'disco5']) assert.equal(R.allowed(db, ev('dano', ent, 'will'), 10, now), true, ent);
  for (const ent of ['disco6', 'disco', 'alienx']) assert.equal(R.allowed(db, ev('dano', ent, 'will'), 10, now), false, ent);
  for (const t of ['gorjeta', 'antena', 'sumiuze']) assert.equal(R.allowed({}, ['cruzadabotecos', 'bar', 'trofeus', t, 'will'], now, now), true, t);
  const cfg = ['cruzadabotecos', 'bar', 'config', 'eventos'];
  assert.equal(R.allowed({}, cfg, { mult: 1, p: 'will', t: now, forcar: { 2999999: 'alien' } }, now), true);
  // O arquivo de regras do console diz o mesmo.
  const regras = ler('database.rules.json');
  assert.match(regras, /\(rato\|alien\|grande\|disco\[0-5\]\|dragao\|dino\)/); // Fatia 17: + dragão e dino
  assert.match(regras, /\(rabo\|vela\|gorjeta\|antena\|sumiuze\|dente\|ovo\)/);
  assert.match(regras, /\(ratazana\|apagao\|alien\|dragao\|dino\)/);
});

test('teto de entidades: no máximo 1 feixe aberto por vez, então no máximo 2 bichos de golpe (disco + grande)', () => {
  let maxFeixe = 0;
  for (let t = 0; t <= I.INVASAO_MS; t += 100) {
    let abertos = 0;
    for (let k = 0; k < I.N_DISCOS; k++) if (I.faseDisco(k, t, {}, 50) === 'feixe') abertos++;
    maxFeixe = Math.max(maxFeixe, abertos);
  }
  assert.equal(maxFeixe, 1);
  assert.ok(I.ONDA_MS > I.FEIXE_MS);
  // Movimento reduzido: o aviso do raio não pisca.
  assert.match(ler('src/vivo/VivoScreen.tsx'), /const pisca = !reduzidoRef\.current && /);
});

test('recarregar a página: não paga de novo na mesma época, não perde o prêmio de quem bateu, nem segura corpo sumido', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  // Um pagamento por época e por tipo, guardado no aparelho; todos os prêmios de evento passam por ele.
  assert.match(v, /const chave = `\$\{ev\.ag\.epoca\}:\$\{tipo\}`;\n.*\n\s+if \(lerVezes\(\)\.p\.includes\(chave\)\) return 0;/);
  // Fatia 17: + 1 chamada para as duas feras (dragão e dinossauro), com o tipo do evento.
  assert.equal((v.match(/pagarEvento\('/g) ?? []).length + (v.match(/pagarEvento\(`/g) ?? []).length + (v.match(/pagarEvento\(ag\.tipo, /g) ?? []).length, 5);
  assert.equal((v.match(/ganhar\.current\(v, 'evento'\)/g) ?? []).length, 1, 'prêmio de evento pago fora do pagarEvento');
  // O dano que dá direito ao prêmio vem do livro (banco + local), não só do contador da sessão.
  assert.match(v, /if \(\(Number\(livro\[player\]\) \|\| 0\) > 0\) \{/);
  assert.match(v, /\.some\(\(ent\) => meu\(ent\) > 0\)/);
  // Levado enquanto alguém o segurava: solta.
  assert.match(v, /if \(h\) h\.segurando = null;\n\s+alvo\.seguradoPor = null;/);
  assert.match(v, /if \(!ag \|\| fase === 'fora'\) \{\n\s+soltarLevados\(\);/);
});

test('o jogo usa a invasão: discos pelo livro, NPC levado some e volta, raio só no salão, véu verde', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  assert.match(v, /const f = faseDisco\(k, Math\.min\(tRel, INVASAO_MS\), livro\(ent\), vidas\.disco\);/);
  assert.match(v, /alvo\.ausente = true;/);
  assert.match(v, /soltarLevados\(\);\n        ev = evNovo\(\);/);
  assert.match(v, /naLinha\(l, me\.x, me\.y\) && zonaDe\(me\.x, me\.y\) === 'bar'/);
  assert.match(v, /ferirPorEvento\(m, me, DANO_RAIO/);
  assert.match(v, /return \{ ev: 'invasao', k \};/);
  assert.match(v, /c\.npc\?\.turno !== 'happy'/);
});

console.log(`# fatia 11: ${n} testes`);
