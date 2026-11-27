// Turma configurável (abertura do código, Fase 2): uma fonte só para quem joga, regras geradas a partir dela e
// nenhum id fixo espalhado pelo jogo.
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
let n = 0;
const test = async (nome, fn) => {
  await fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};

const T = await import('../src/turma/index.ts');
const Ex = await import('../src/turma/turma.exemplo.ts');
const G = await import('../scripts/gerar-regras.mjs');
const molde = ler('database.rules.molde.json');

await test('a turma e a de exemplo passam na conferência; turma torta é recusada com o motivo', () => {
  assert.deepEqual(G.problemasDaTurma(T.TURMA), []);
  assert.deepEqual(G.problemasDaTurma(Ex.TURMA), []);
  const um = (mudar) => G.problemasDaTurma(mudar(structuredClone(Ex.TURMA)));
  assert.match(um((t) => ({ ...t, pessoas: t.pessoas.slice(0, 1) })).join(), /de 2 a 5/);
  assert.match(um((t) => ({ ...t, pessoas: [...t.pessoas, { ...t.pessoas[0], id: 'zeze' }] })).join(), /de 2 a 5/);
  assert.match(um((t) => ((t.pessoas[1].id = t.pessoas[0].id), t)).join(), /repetido/);
  assert.match(um((t) => ((t.pessoas[0].id = 'Dani'), t)).join(), /minúsculas/);
  assert.match(um((t) => ((t.pessoas[0].id = 'bot2'), t)).join(), /reservado/);
  assert.match(um((t) => ({ ...t, admin: 'ninguem' })).join(), /admin/);
  assert.match(um((t) => ((t.pessoas[0].artigo = 'de'), t)).join(), /artigo/);
});

await test('regras geradas: as do repositório batem com a turma; uma turma de 3 gera regras válidas para o Firebase', async () => {
  assert.equal(G.gerar(molde, T.TURMA), ler('database.rules.json'));
  const tres = { admin: 'bia', pessoas: Ex.TURMA.pessoas.slice(2) };
  assert.deepEqual(G.problemasDaTurma(tres), []);
  const texto = G.gerar(molde, tres);
  assert.ok(!texto.includes('{{'));
  const regras = JSON.parse(texto);
  assert.equal(texto.split('dani|bia|tati').length - 1, 41);
  assert.ok(!/[(|](vini|will)[|)]/.test(texto), 'quem saiu da turma não fica nas regras');
  assert.match(JSON.stringify(regras), /val\(\) === 'bia'/);
  // O Firebase só aceita ^ no começo e $ no fim de cada regex.
  for (const m of texto.matchAll(/matches\(\/(.*?)\/\)/g)) {
    const r = m[1];
    assert.ok(!r.slice(1).includes('^') || r.slice(1).replace(/\[\^/g, '').indexOf('^') < 0, `^ no meio: ${r}`);
    assert.ok(r.indexOf('$') === -1 || r.indexOf('$') === r.length - 1, `$ no meio: ${r}`);
  }
});

await test('o jogo só conhece a turma por src/turma: nenhum id ou nome fixo fora dela', () => {
  const arquivos = [];
  const andar = (d) => {
    for (const e of fs.readdirSync(path.join(raiz, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) andar(rel);
      else if (/\.(ts|tsx)$/.test(e.name) && !rel.startsWith('src/turma/')) arquivos.push(rel);
    }
  };
  andar('src');
  assert.ok(arquivos.length > 100);
  // Um id que também é palavra comum (como em autoComplete) só conta no padrão de lista "id1|id2|…".
  // Chave de objeto só conta com valor de dado (`id: {`, `id: 'x'`, `id: 3`), não anotação de tipo (`lu: number`).
  const proibidos = T.IDS.filter((id) => id !== 'will').map((id) => new RegExp(`['"\`]${id}['"\`]|\\b${id}\\s*:\\s*[{['"\`\\d-]`));
  proibidos.push(new RegExp(T.IDS.join('\\|')), ...T.PESSOAS.filter((p) => p.name !== 'Will').map((p) => new RegExp(`\\b${p.name}\\b`)));
  const achados = [];
  for (const a of arquivos) {
    const s = ler(a);
    for (const r of proibidos) if (r.test(s)) achados.push(`${a}: ${r}`);
  }
  assert.deepEqual(achados, []);
});

await test('tudo que depende da turma sai dela: ficha, rede, cantos, músicas, voz, banco falso e dono', async () => {
  const ids = [...T.IDS];
  const F = await import('../src/vivo/ficha.ts');
  const Rd = await import('../src/vivo/rede.ts');
  const Mp = await import('../src/vivo/mapa.ts');
  const Mu = await import('../src/bar/music.ts');
  const Sp = await import('../src/arena/sprites.ts');
  const MR = await import('./mock-rules.mjs');
  assert.deepEqual([...F.ORDEM_FICHA], ids);
  assert.deepEqual([...Rd.ORDEM], ids);
  assert.deepEqual(Object.keys(Mp.CANTOS), ids);
  assert.deepEqual(Sp.PLAYERS.map((p) => p.id), ids);
  assert.deepEqual(Mu.SONG_IDS, [...ids, 'casa']);
  for (const p of T.PESSOAS) {
    assert.ok(Mu.SONGS[p.id].name.endsWith(` ${p.artigo} ${p.name}`), Mu.SONGS[p.id].name);
    assert.ok(Mu.SONGS[p.id].drums.length > 0);
  }
  // Os cinco cantos continuam onde estavam (a ordem da turma escolhe o canto).
  assert.deepEqual(Mp.CANTOS[ids[0]].at, [6.5, 3.6]);
  if (ids.length >= 5) assert.deepEqual(Mp.CANTOS[ids[4]].at, [25.5, 7.5]);
  // "do" → caído, debruçado…; "da" → caída, debruçada… (o canto 2, "debaixo da mesa", não muda).
  T.PESSOAS.forEach((p, i) => {
    if (i !== 1) assert.equal(Mp.CANTOS[p.id].onde.split(' ')[0].endsWith('a'), p.artigo === 'da', Mp.CANTOS[p.id].onde);
  });
  for (const id of ids) assert.ok(MR.PLAYERS.test(id));
  // A jukebox só aceita faixa posta por alguém da turma (IDS_RE fechado na lista, não em "qualquer id").
  const Fx = await import('../src/vivo/faixas.ts');
  for (const id of ids) assert.ok(Fx.sanitizeJuke({ s: 0, p: id, t: 1 }), `jukebox recusou ${id}`);
  assert.equal(Fx.sanitizeJuke({ s: 0, p: 'intruso', t: 1 }), null, 'jukebox aceitou quem não é da turma');
  assert.ok(!T.IDS_RE.test('intruso') && !T.IDS_RE.test(`${ids[0]}x`));
  assert.ok(!MR.PLAYERS.test('bot1') && !MR.PLAYERS.test('fulano'));
  assert.equal(T.ADMIN, T.TURMA.admin);
  assert.match(ler('src/vivo/VivoScreen.tsx'), /player === ADMIN &&/);
  assert.match(ler('src/bar/presence.ts'), /this\.me === ADMIN/);
});

console.log(`\n${n} testes da turma passaram`);
