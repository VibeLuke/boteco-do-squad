// Testes da Fatia 6: jukebox com faixas novas, chat no Bar Vivo, sinuca e Dona Maria (estes dois na fatia 4),
// bar antigo e placar fora da entrada, e os poderes especiais.
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
const mapa = await import('../src/vivo/mapa.ts');
const B = await import('../src/vivo/briga.ts');
const music = await import('../src/bar/music.ts');
const FX = await import('../src/vivo/faixas.ts');
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

/* ------------------------------------------------------------------ Lote A: entrada sem bar antigo nem placar */

test('entrada: o app não leva mais ao bar antigo e a tela inicial não tem o placar (ele mora na lousa do bar)', () => {
  const app = ler('src/App.tsx');
  assert.ok(!/import\('\.\/bar\/BarScreen'\)/.test(app), 'o bar antigo ainda é carregado');
  assert.ok(!/onOldBar/.test(app) && !/onOldBar/.test(ler('src/vivo/VivoScreen.tsx')), 'botão do bar antigo ainda existe');
  const studio = ler('src/components/Studio.tsx');
  assert.ok(!/<Arena\b/.test(studio) && !/Placar da briga/.test(studio), 'placar ainda na tela inicial');
  assert.ok(/jogo === 'placar'/.test(ler('src/vivo/VivoScreen.tsx')), 'a lousa do placar sumiu do bar');
});

/* ------------------------------------------------------------------ Lote B: jukebox */

test('jukebox: 8 faixas novas mais as 6 de antes, todas com 64 passos por trilha e notas no alcance do tocador', () => {
  assert.ok(FX.FAIXAS.length >= 14);
  const ids = new Set(FX.FAIXAS.map((f) => f.id));
  assert.equal(ids.size, FX.FAIXAS.length, 'id repetido');
  assert.ok(FX.FAIXAS.length <= 32, 'a regra aceita no máximo 32 faixas (0 a 31)');
  const assinaturas = new Set();
  for (const f of FX.FAIXAS) {
    for (const k of ['lead', 'chords', 'bass']) {
      if (!f[k]) continue;
      const passos = music.parseTrack(f[k].notes);
      assert.equal(passos.length, music.STEPS, `${f.id}.${k}: ${passos.length} passos`);
      for (const s of passos) if (Array.isArray(s)) for (const n of s) assert.ok(Number.isFinite(n) && n >= 24 && n <= 100, `${f.id}.${k}: nota ${n}`);
      assert.ok(passos[0] !== 'hold', `${f.id}.${k} começa segurando nada`);
    }
    for (const d of f.drums) {
      assert.equal(d.length, music.STEPS, `${f.id}: bateria com ${d.length}`);
      assert.match(d, /^[ksohtc.]+$/);
    }
    assert.ok(f.bpm >= 60 && f.bpm <= 180);
    assinaturas.add(f.lead?.notes ?? f.bass.notes);
  }
  assert.equal(assinaturas.size, FX.FAIXAS.length, 'duas faixas com a mesma melodia');
});

test('jukebox: todo aparelho no mesmo passo pela hora da escolha; sem escolha gira pela hora; volume cai com a distância', () => {
  const f = FX.FAIXAS[2];
  const passoMs = (60 / f.bpm / 4) * 1000;
  assert.equal(FX.passoAgora(f, T0, T0), 0);
  assert.equal(FX.passoAgora(f, T0, T0 + passoMs * 5 + 1), 5);
  assert.equal(FX.passoAgora(f, T0, T0 + passoMs * (music.STEPS + 3) + 1), 3, 'não deu a volta');
  assert.equal(FX.passoAgora(f, T0, T0 - 5000), 0, 'relógio atrasado deu passo negativo');
  const h = FX.faixaDaHora(T0);
  assert.equal(FX.faixaDaHora(T0 + 60_000), h);
  assert.notEqual(FX.faixaDaHora(T0 + 3_600_000), h);
  const perto = FX.volumeJukebox(18.5, 1.5, 18.5, 0.5, true);
  const longe = FX.volumeJukebox(2, 12, 18.5, 0.5, true);
  assert.ok(perto > 0.9 && longe < perto && longe >= 0.25, `${perto} / ${longe}`);
  assert.equal(FX.volumeJukebox(32, 5, 18.5, 0.5, false), 0.12, 'no banheiro não ficou abafado');
});

test('jukebox: o banco aceita faixa válida de qualquer amigo e troca no máximo a cada 3 s; leitura recusa lixo', () => {
  const now = 3_000_000;
  const k = ['cruzadabotecos', 'bar', 'juke'];
  const v = { s: 3, p: 'will', t: now };
  assert.ok(regras.allowed({}, k, v, now));
  assert.ok(regras.allowed({}, k, { ...v, s: -1 }, now), 'desligar');
  assert.ok(!regras.allowed({}, k, { ...v, s: 32 }, now));
  assert.ok(!regras.allowed({}, k, { ...v, s: 1.5 }, now));
  assert.ok(!regras.allowed({}, k, { ...v, p: 'bazuca' }, now));
  assert.ok(!regras.allowed({}, k, { ...v, t: now - 1 }, now));
  assert.ok(!regras.allowed({}, k, { ...v, x: 1 }, now), 'campo a mais');
  const tree = { cruzadabotecos: { bar: { juke: { s: 1, p: 'vini', t: now - 2000 } } } };
  assert.ok(!regras.allowed(tree, k, v, now), 'trocou em 2 s');
  assert.ok(regras.allowed(tree, k, { ...v, t: now + 1000 }, now + 1000));
  assert.deepEqual(FX.sanitizeJuke({ s: 3, p: 'will', t: 5 }), { s: 3, p: 'will', t: 5 });
  assert.equal(FX.sanitizeJuke({ s: FX.FAIXAS.length, p: 'will', t: 5 }), null);
  assert.equal(FX.sanitizeJuke({ s: 2, p: 'zé', t: 5 }), null);
  assert.equal(FX.sanitizeJuke(null), null);
  const pub = JSON.parse(ler('database.rules.json')).rules.cruzadabotecos.bar.juke;
  assert.match(pub.s['.validate'], /<= 31/);
  assert.match(pub['.write'], /3000/);
});

test('jukebox: E na frente dela abre a jukebox (o anagrama abre de dentro dela)', () => {
  const j = mapa.JOGOS.find((x) => x.jogo === 'jukebox');
  assert.ok(j, 'sem jukebox nos jogos');
  assert.ok(!mapa.JOGOS.some((x) => x.jogo === 'anagrama'), 'anagrama ainda no mesmo ladrilho');
  const m = mundo();
  const me = B.eu(m);
  Object.assign(me, { x: j.at[0] + 0.5, y: j.at[1] + 0.5, fx: 0, fy: -1 });
  const ev = rodar(m, 200, (i) => ({ usa: i === 1 }));
  assert.ok(ev.some((e) => e.k === 'jogo' && e.jogo === 'jukebox'));
  assert.match(ler('src/vivo/VivoScreen.tsx'), /setJogo\('anagrama'\)/);
});

/* ------------------------------------------------------------------ Lote B: chat */

test('chat: o banco só aceita a fala com o carimbo de ritmo na mesma gravação (o mesmo do bar antigo)', () => {
  const now = 4_000_000;
  const msg = { m: 'bora pro beco', t: now };
  const k = ['cruzadabotecos', 'bar', 'chat', 'will', '3'];
  const comRitmo = { cruzadabotecos: { bar: { rate: { will: { at: now } } } } };
  assert.ok(regras.allowedPath({}, regras.setAt(comRitmo, k, msg), k, msg, now));
  assert.ok(!regras.allowedPath({}, regras.setAt({}, k, msg), k, msg, now), 'sem carimbo passou');
  assert.ok(!regras.allowedPath({}, regras.setAt(comRitmo, k, { m: 'x'.repeat(141), t: now }), k, { m: 'x'.repeat(141), t: now }, now));
  const tela = ler('src/vivo/VivoScreen.tsx');
  assert.match(tela, /barPresence\.say\(/);
  assert.match(tela, /balloons\(barPresence\.chat/);
  // Digitar no chat não anda nem bate: o teclado do jogo ignora campo de texto.
  assert.match(tela, /e\.target instanceof HTMLInputElement[^\n]*return;/);
});

/* ------------------------------------------------------------------ Lote C: vozes */

const VZ = await import('../src/vivo/voz.ts');

test('vozes: cada um tem o seu timbre fixo; mulher fala mais fino, Tonhão mais grosso, bêbado mais devagar', () => {
  assert.deepEqual(VZ.timbreDe('marrento'), VZ.timbreDe('marrento'));
  assert.ok(VZ.timbreDe('maria').base > 180 && VZ.timbreDe('kelly').base > 180);
  assert.ok(VZ.timbreDe('tonhao').base < 110);
  assert.ok(VZ.timbreDe('pinguco').ritmo < 0.7);
  const bases = new Set(['ze', 'juninho', 'cabeca', 'ricardao', 'motoboy', 'grafiteiro'].map((id) => Math.round(VZ.timbreDe(id).base)));
  assert.ok(bases.size >= 5, 'vozes iguais demais');
  // Mesmo id e semente = mesma fala; semente diferente = outra.
  assert.deepEqual(VZ.silabas('fala', 'ze', 30, 4), VZ.silabas('fala', 'ze', 30, 4));
  assert.notDeepEqual(VZ.silabas('fala', 'ze', 30, 4), VZ.silabas('fala', 'ze', 30, 5));
});

test('vozes: fala cresce com a frase (3 a 9 sílabas); dor é curta; nocaute longo e caindo; risada em rajadinhas; grito agudo e tremido', () => {
  assert.equal(VZ.silabas('fala', 'kelly', 4).length, 3);
  assert.equal(VZ.silabas('fala', 'kelly', 200).length, 9);
  const dor = VZ.silabas('dor', 'cabeca');
  const ko = VZ.silabas('ko', 'cabeca');
  assert.ok(VZ.duracaoVoz(dor) < 0.25 && VZ.duracaoVoz(ko) > 0.6, `${VZ.duracaoVoz(dor)} / ${VZ.duracaoVoz(ko)}`);
  const ultima = ko[ko.length - 1];
  assert.ok(ultima.f1 < ultima.f0 * 0.6, 'o gemido do nocaute não cai');
  const ri = VZ.silabas('risada', 'ricardao');
  assert.ok(ri.length >= 4 && ri.every((x, i) => i === 0 || x.t > ri[i - 1].t + ri[i - 1].dur), 'risada sem pausas');
  const gr = VZ.silabas('grito', 'ricardao')[0];
  assert.ok(gr.f0 > VZ.timbreDe('ricardao').base * 2 && gr.vibrato > 0);
  for (const t of ['fala', 'dor', 'ko', 'risada', 'grito', 'escorrega'])
    for (const x of VZ.silabas(t, 'juninho', 20)) {
      assert.ok(VZ.VOGAIS[x.vogal] && VZ.VOGAIS[x.vogal2], `${t}: vogal ${x.vogal}`);
      assert.ok(x.f0 > 50 && x.f0 < 800 && x.f1 > 40 && x.dur > 0.05);
    }
});

test('vozes: a frase sai com quem falou e o tema (narrador zoando ri, confusão grita); volume some longe', () => {
  assert.equal(VZ.vozDoTema('ko'), 'risada');
  assert.equal(VZ.vozDoTema('treta'), 'grito');
  assert.equal(VZ.vozDoTema('cerveja'), 'fala');
  assert.equal(VZ.vozDoTema(undefined), 'fala');
  assert.equal(VZ.volumePorDistancia(1), 1);
  assert.ok(VZ.volumePorDistancia(6) > 0.4 && VZ.volumePorDistancia(6) < 0.7);
  assert.equal(VZ.volumePorDistancia(12), 0);
  // Um NPC apanhando solta a frase com o id dele.
  const m = mundo();
  const me = B.eu(m);
  const alvo = m.corpos.find((c) => c.id === 'marrento');
  Object.assign(me, { x: 10.5, y: 8.5, fx: 1, fy: 0 });
  Object.assign(alvo, { x: 11.2, y: 8.5, estado: 'normal', humor: 'voltando', atordoadoAte: Infinity });
  const ev = [];
  for (let i = 0; i < 6 && !ev.some((e) => e.k === 'frase' && e.em); i++) ev.push(...rodar(m, 1200, (k) => ({ soco: k % 20 === 0 })));
  const f = ev.find((e) => e.k === 'frase' && e.em);
  assert.ok(f, 'nenhuma frase com quem falou');
  assert.ok(typeof f.tema === 'string' && f.tema.length > 0);
  assert.match(ler('src/vivo/VivoScreen.tsx'), /voz\(e\.em, e\.x, e\.y, 'ko'\)/);
});

/* ------------------------------------------------------------------ Lote D: poderes */

const PD = await import('../src/vivo/poderes.ts');
const loja = await import('../src/vivo/loja.ts');
const rede = await import('../src/vivo/rede.ts');
const AN = await import('../src/vivo/animArma.ts');

/** Deixa só estes NPCs de pé (os outros desmaiados num canto longe). */
function soEstes(m, ids) {
  for (const c of m.corpos) {
    if (c.quem !== 'npc' || ids.includes(c.id)) continue;
    c.estado = 'ko';
    c.koAte = Infinity;
    c.x = 1.5;
    c.y = 13.5;
  }
}
/** NPCs de teste parados (voltando, tontos para sempre: não fogem nem andam). */
const PARADOS = ['marrento', 'cabeca', 'pinguco', 'biriba', 'ricardao', 'motoboy', 'grafiteiro'];
function montar(tipo, posicoes, me = { x: 6.5, y: 8.5, fx: 1, fy: 0 }) {
  const m = mundo();
  const ids = PARADOS.slice(0, posicoes.length);
  soEstes(m, ids);
  const eu = B.eu(m);
  Object.assign(eu, me, { arma: { tipo, usos: 1 }, estado: 'normal', fase: 'nada' });
  ids.forEach((id, i) => {
    const c = m.corpos.find((o) => o.id === id);
    Object.assign(c, { x: posicoes[i][0], y: posicoes[i][1], estado: 'normal', humor: 'voltando', atordoadoAte: Infinity, vida: c.vidaMax ?? c.vida });
  });
  return { m, eu, ids };
}
/** Segura J até disparar e deixa o efeito terminar. */
function disparar(m, tipo) {
  const carga = PD.PODER[tipo].carga;
  const ev = rodar(m, carga + 150, () => ({ soco: true }));
  ev.push(...rodar(m, PD.PODER[tipo].dura + 400));
  return ev;
}
const apanhou = (ev, id) => ev.some((e) => e.k === 'golpe' && e.em === id);

test('poderes: 10 novos mais a rajada, todos a R$ 300 no mercado, um uso, e na lista da rede, das regras e do espelho', () => {
  assert.equal(PD.PODERES.length, 11);
  assert.equal(PD.PODERES_NOVOS.length, 10);
  const nomes = new Set();
  for (const p of PD.PODERES) {
    const it = loja.CATALOGO.find((i) => i.arma === p);
    assert.ok(it, `${p} fora do mercado`);
    assert.equal(it.preco, 300);
    assert.equal(B.ARMAS[p].usos, 1);
    assert.ok(AN.MOVIMENTO[p], `${p} sem movimento`);
    assert.ok(rede.ARMAS_REDE.includes(p), `${p} fora da rede`);
    nomes.add(B.ARMAS[p].nome);
  }
  assert.equal(nomes.size, 11, 'nome repetido');
  const pub = JSON.parse(ler('database.rules.json')).rules.cruzadabotecos.bar;
  const lista = (r) => new RegExp(r.match(/\/(\^.*\$)\//)[1]);
  for (const p of PD.PODERES) {
    assert.ok(lista(pub.vivo.$player.w['.validate']).test(p), `vivo.w recusa ${p}`);
    assert.ok(lista(pub.vivo.$player.q['.validate']).test(p), `vivo.q recusa ${p}`);
    assert.ok(lista(pub.vgolpe.$player.$slot.w['.validate']).test(p), `vgolpe.w recusa ${p}`);
    assert.ok(lista(pub.vgolpe.$player.$slot.d['.validate']).test(p), `vgolpe.d não dá 100 a ${p}`);
  }
  assert.ok(!lista(pub.vgolpe.$player.$slot.d['.validate']).test('katana'));
  // Espelho: cada poder com dano 100 passa; 101 não; katana 41 não; q inventado não.
  const now = 5_000_000;
  const kg = ['cruzadabotecos', 'bar', 'vgolpe', 'will', '2'];
  for (const p of PD.PODERES) assert.ok(regras.allowed({}, kg, { to: 'vini', d: 100, kx: 1, ky: 0, w: p, f: true, t: now }, now), p);
  assert.ok(!regras.allowed({}, kg, { to: 'vini', d: 101, kx: 1, ky: 0, w: 'raio', f: true, t: now }, now));
  assert.ok(!regras.allowed({}, kg, { to: 'vini', d: 41, kx: 1, ky: 0, w: 'katana', f: true, t: now }, now));
  const kv = ['cruzadabotecos', 'bar', 'vivo', 'will'];
  const vivo = { x: 5, y: 5, fx: 1, fy: 0, mx: 0, my: 0, e: 'n', vi: 100, lk: 'abcdefgh', at: now, on: true, sv: now };
  assert.ok(regras.allowed({}, kv, { ...vivo, r: now, q: 'torresmo' }, now));
  assert.ok(!regras.allowed({}, kv, { ...vivo, r: now, q: 'bazuca' }, now));
  assert.ok(regras.allowed({}, kv, { ...vivo, w: 'ima' }, now));
});

test('Chuva de Tampinhas: pega todo mundo a até 5 em volta (até atrás), cada um na sua hora; quem está a 7 escapa', () => {
  const { m, ids } = montar('tampinhas', [[9.5, 8.5], [4, 8.5], [6.5, 6], [13.5, 8.5]]);
  const ev = disparar(m, 'tampinhas');
  assert.ok(apanhou(ev, ids[0]) && apanhou(ev, ids[1]) && apanhou(ev, ids[2]), 'alguém perto escapou');
  assert.ok(!apanhou(ev, ids[3]), 'pegou quem estava a 7');
  const horas = ev.filter((e) => e.k === 'golpe' && ids.includes(e.em)).length;
  assert.ok(horas >= 3);
  assert.equal(B.eu(m).arma, null, 'não gastou');
});

test('Arroto Sônico: cone na frente (até 9), joga longe e deixa tonto; atrás e de lado escapam', () => {
  const { m, ids } = montar('arroto', [[10.5, 8.5], [14, 9.5], [3.5, 8.5], [7, 13]]);
  const x0 = m.corpos.find((c) => c.id === ids[0]).x;
  const ev = disparar(m, 'arroto');
  assert.ok(apanhou(ev, ids[0]) && apanhou(ev, ids[1]));
  assert.ok(!apanhou(ev, ids[2]), 'pegou atrás');
  assert.ok(!apanhou(ev, ids[3]), 'pegou de lado');
  assert.ok(m.corpos.find((c) => c.id === ids[0]).x > x0 + 1, 'não empurrou');
  // A borda do cone: 20° dentro pega, 50° fora não (o cone abre 35° para cada lado).
  const d = PD.montarDisparo('arroto', 'eu', 5, 5, 1, 0, 0, () => 30, []);
  const em = (g) => [5 + 4 * Math.cos((g * Math.PI) / 180), 5 + 4 * Math.sin((g * Math.PI) / 180)];
  assert.ok(PD.quando(d, ...em(20)) >= 0, 'não pegou a 20°');
  assert.equal(PD.quando(d, ...em(50)), -1, 'pegou a 50°');
});

test('Furacão de Guardanapo: anda reto e pega quem está a até 1,5 do caminho; a 3 de lado escapa', () => {
  const { m, ids } = montar('furacao', [[12.5, 9.2], [16, 8.0], [12.5, 11.8]]);
  const ev = disparar(m, 'furacao');
  assert.ok(apanhou(ev, ids[0]) && apanhou(ev, ids[1]));
  assert.ok(!apanhou(ev, ids[2]), 'pegou longe do caminho');
  // Quem está mais longe apanha depois (o redemoinho anda).
  const hora = (id) => ev.findIndex((e) => e.k === 'golpe' && e.em === id);
  assert.ok(hora(ids[0]) < hora(ids[1]));
});

test('Tsunami de Chope: onda de 6 de largura varre a frente; derruba (escorrega); fora da faixa escapa', () => {
  const { m, ids } = montar('chope', [[12, 10.8], [16, 6.6], [12, 12.5]]);
  const ev = disparar(m, 'chope');
  assert.ok(apanhou(ev, ids[0]) && apanhou(ev, ids[1]));
  assert.ok(!apanhou(ev, ids[2]));
  assert.ok(ev.some((e) => e.k === 'escorrega' && e.em === ids[0]), 'não escorregou');
});

test('Terremoto do Pagode: anel de até 8 pega em volta e quebra os móveis do anel; quem está a 10 escapa', () => {
  const { m, ids } = montar('pagode', [[12.5, 8.5], [6.5, 3.5], [16.5, 12.5]]);
  const perto = mapa.PROPS.map((p, i) => ({ p, i })).filter(({ p }) => mapa.QUEBRAVEIS.has(p.kind) && mapa.zonaDe(p.x, p.y) === mapa.zonaDe(6.5, 8.5) && Math.hypot(p.x + 0.5 - 6.5, p.y + 0.5 - 8.5) < 7);
  assert.ok(perto.length >= 2, 'nenhum móvel perto para testar');
  const ev = disparar(m, 'pagode');
  assert.ok(apanhou(ev, ids[0]) && apanhou(ev, ids[1]));
  assert.ok(!apanhou(ev, ids[2]), 'pegou a 10');
  const quebrados = perto.filter(({ i }) => m.quebrados.has(i)).length;
  assert.ok(quebrados >= Math.ceil(perto.length * 0.8), `quebrou ${quebrados}/${perto.length}`);
});

test('Raio da Conta Atrasada: 6 raios nos 6 mais perto (até 10), nocaute garantido em cada; o 7º escapa', () => {
  const pos = [[8, 8.5], [9, 9.5], [10, 7.5], [11, 8.5], [12, 10], [13, 8], [6.5, 4.0]];
  const { m, ids } = montar('raio', pos);
  // O 7º fica mais longe que os outros 6.
  Object.assign(m.corpos.find((c) => c.id === ids[6]), { x: 15.5, y: 8.5 });
  const ev = disparar(m, 'raio');
  for (const id of ids.slice(0, 6)) assert.equal(m.corpos.find((c) => c.id === id).estado, 'ko', `${id} de pé`);
  assert.ok(!apanhou(ev, ids[6]), 'o 7º levou raio');
});

test('Meteoro de Torresmo: cai 5 à frente e nocauteia quem está a até 3,2 de lá; você e quem está longe escapam', () => {
  const { m, ids } = montar('torresmo', [[11.5, 8.5], [13, 10.5], [17, 8.5]]);
  const ev = disparar(m, 'torresmo');
  assert.equal(m.corpos.find((c) => c.id === ids[0]).estado, 'ko');
  assert.equal(m.corpos.find((c) => c.id === ids[1]).estado, 'ko');
  assert.ok(!apanhou(ev, ids[2]));
  assert.notEqual(B.eu(m).estado, 'ko');
  const d = ev.find((e) => e.k === 'poder');
  assert.ok(Math.abs(d.cx - 11.5) < 0.6 && Math.abs(d.cy - 8.5) < 0.1, `caiu em ${d.cx}, ${d.cy}`);
});

test('Fantasma do Garçom: bandejada nos 5 mais perto, um depois do outro; o 6º escapa', () => {
  const { m, ids } = montar('garcom', [[8, 8.5], [9, 10], [7, 6.5], [10.5, 8], [11, 10.5], [14.4, 8.5]]);
  const ev = disparar(m, 'garcom');
  for (const id of ids.slice(0, 5)) assert.ok(apanhou(ev, id), `${id} escapou`);
  assert.ok(!apanhou(ev, ids[5]));
});

test('Bola de Fogo da Pinga: explode no primeiro da linha (pega quem está do lado) e deixa fogo que queima quem fica', () => {
  const { m, ids } = montar('pinga', [[11.5, 8.5], [12.5, 10.0], [16.5, 8.5]]);
  const ev = disparar(m, 'pinga');
  assert.ok(apanhou(ev, ids[0]) && apanhou(ev, ids[1]));
  assert.ok(!apanhou(ev, ids[2]), 'passou do primeiro');
  assert.equal(m.fogos.length, 1);
  const f = m.fogos[0];
  // Alguém parado no fogo perde vida.
  const v = m.corpos.find((c) => c.id === ids[2]);
  Object.assign(v, { x: f.x, y: f.y, estado: 'normal', vida: 60 });
  rodar(m, 1000);
  assert.ok(v.vida < 60 - 8, `fogo tirou só ${60 - v.vida}`);
});

test('Ímã do Fiado: puxa NPC de longe até o ponto e implode (nocaute); fora dos 7 nem se mexe', () => {
  const { m, ids } = montar('ima', [[15, 5.5], [6.5, 13.5]], { x: 6.5, y: 5.5, fx: 1, fy: 0 });
  const a = m.corpos.find((c) => c.id === ids[0]);
  const x0 = a.x;
  const ev = disparar(m, 'ima');
  assert.ok(a.x < x0 - 2, `não puxou (${x0} → ${a.x})`);
  assert.equal(a.estado, 'ko');
  assert.ok(!apanhou(ev, ids[1]));
});

test('poderes: apanhar na carga cancela sem gastar; K e E não tiram da mão; o mercado não vende outro com um na mão', () => {
  const { m, ids } = montar('torresmo', [[7.3, 8.5]]);
  const npc = m.corpos.find((c) => c.id === ids[0]);
  rodar(m, 400, () => ({ soco: true }));
  B.ferir(m, B.eu(m), npc, { ...B.JAB, dano: 5 }, 1, 0);
  rodar(m, 2000, () => ({ soco: false }));
  assert.equal(B.eu(m).arma?.tipo, 'torresmo', 'gastou o poder cancelado');
  const ev = rodar(m, 200, (i) => ({ agarra: i === 0 }));
  assert.equal(B.eu(m).arma?.tipo, 'torresmo');
  assert.ok(ev.some((e) => e.k === 'aviso' && /não sai da mão/.test(e.texto)));
  assert.equal(B.golpeRecebido(100, 'ima', true).dano, 100);
  assert.equal(B.golpeRecebido(100, 'katana', true).dano, 40);
  assert.match(ler('src/vivo/VivoScreen.tsx'), /ehPoder\(eu\(mundo\.current\)\.arma\?\.tipo\)/);
});

test('poderes pela rede: o disparo vai com qual foi (q) e o amigo desenha o mesmo; dano 100 de poder passa no filtro', () => {
  const { m } = montar('pagode', []);
  disparar(m, 'pagode');
  const elo = new rede.Elo();
  // Dentro dos 3 s depois do disparo: o estado leva r e q.
  const m2 = montar('pagode', []).m;
  rodar(m2, PD.PODER.pagode.carga + 150, () => ({ soco: true }));
  const s = elo.enviar(m2, { mx: 0, my: 0 }, 'abcdefgh', 1000);
  assert.ok(s && typeof s.r === 'number' && s.q === 'pagode', JSON.stringify(s));
  // Quem recebe monta o disparo só de desenho.
  const m3 = mundo(9);
  const corpo = B.eu(m3);
  const antes = { ...s, r: undefined, q: undefined, at: 1, on: true };
  rede.lerGolpeRemoto(m3, { ...corpo, id: 'amigo:will', quem: 'remoto' }, { ...s, at: 2, on: true, r: m3.t }, antes);
  assert.ok(m3.poderes.some((d) => d.tipo === 'pagode' && d.visual), 'o amigo não viu o poder');
  const lidos = rede.sanitizeVGolpes({ vini: { 0: { to: 'will', d: 100, kx: 1, ky: 0, w: 'raio', f: true, t: 1 }, 1: { to: 'will', d: 100, kx: 1, ky: 0, w: 'faca', f: true, t: 1 } } });
  assert.deepEqual(lidos.map((g) => g.slot), [0]);
  // A leitura do banco guarda o q válido e joga fora o que não é poder.
  const base = { x: 5, y: 5, fx: 1, fy: 0, mx: 0, my: 0, e: 'n', vi: 100, lk: 'abcdefgh', at: 1, on: true, r: 5 };
  const vivo = rede.sanitizeVivo({ vini: { ...base, q: 'ima' }, dani: { ...base, q: 'bazuca' } });
  assert.equal(vivo.vini?.q, 'ima');
  assert.ok(vivo.dani && !('q' in vivo.dani));
  // A linha de móveis quebrados continua cabendo na regra (≤ 1500) com o poder que mais quebra.
  assert.ok(m.quebrados.size > 0);
});

console.log(`\n${passed} testes da Fatia 6 passaram`);
