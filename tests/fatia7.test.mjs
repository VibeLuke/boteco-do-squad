// Testes da Fatia 7 (fechamento): bar antigo fora, fim de linha único, movimento reduzido e limite de clarões,
// livro do caixa, medidor de quadro e o contrato entre database.rules.json e o espelho do Firebase falso.
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
const MV = await import('../src/vivo/movimento.ts');
const CX = await import('../src/vivo/caixa.ts');
const MD = await import('../src/vivo/medidor.ts');
const PD = await import('../src/vivo/poderes.ts');
const B = await import('../src/vivo/briga.ts');
const { TURMA } = await import('../src/turma/turma.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};

/* ------------------------------------------------------------------ contrato regras × espelho */

/** Listas de ids (alternâncias ^(a|b|c)$) de um texto, como conjuntos ordenados; ignora a opção vazia e o `?`. */
function listas(txt) {
  const out = new Set();
  for (const m of txt.matchAll(/\^\(([a-z0-9|[\]]+)\)\??\$/g)) {
    const ids = m[1].split('|').filter(Boolean).sort();
    if (ids.length >= 2) out.add(ids.join('|'));
  }
  return out;
}
/** Números das regras (3+ dígitos) que o espelho precisa ter também (aceita 1e7 e 10_000 no espelho). */
function numeros(txt, espelho) {
  const doEspelho = new Set([...espelho.matchAll(/(?<![\w.])(\d[\d_]*(?:e\d+)?)(?![\w])/g)].map((m) => Number(m[1].replace(/_/g, ''))));
  const faltam = [];
  for (const m of txt.matchAll(/(?<![\w.$])(\d{3,})(?![\w])/g)) if (!doEspelho.has(Number(m[1]))) faltam.push(m[1]);
  return [...new Set(faltam)];
}
/** Diferenças entre as regras e o espelho: listas que só um dos dois tem e números que o espelho não conhece. */
function contrato(regrasTxt, espelhoTxt) {
  const exprs = [];
  (function andar(o) {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && k.startsWith('.')) exprs.push(v);
      else if (v && typeof v === 'object') andar(v);
    }
  })(JSON.parse(regrasTxt));
  const txt = exprs.join('\n');
  const a = listas(txt);
  const b = listas(espelhoTxt);
  return [
    ...[...a].filter((x) => !b.has(x)).map((x) => `só nas regras: ${x}`),
    ...[...b].filter((x) => !a.has(x)).map((x) => `só no espelho: ${x}`),
    ...numeros(txt, espelhoTxt).map((n) => `número só nas regras: ${n}`),
  ];
}

test('contrato: toda lista de ids e todo número das regras existe no espelho do Firebase falso, e vice-versa', () => {
  // O espelho monta a lista de ids a partir da turma (src/turma/turma.ts): expande antes de comparar.
  const espelho = ler('tests/mock-rules.mjs').replaceAll('${IDS_ALT}', TURMA.pessoas.map((p) => p.id).join('|'));
  assert.deepEqual(contrato(ler('database.rules.json'), espelho), []);
});

test('contrato (o medidor reprova): poder novo só nas regras, só no espelho, ou limite trocado de um lado só', () => {
  const regrasTxt = ler('database.rules.json');
  const espelhoTxt = ler('tests/mock-rules.mjs');
  assert.ok(contrato(regrasTxt.replaceAll('|pinga|ima)', '|pinga|ima|bazuca)'), espelhoTxt).length > 0, 'poder novo só nas regras passou');
  assert.ok(contrato(regrasTxt, espelhoTxt.replace('|pinga|ima)$/;', '|pinga|ima|bazuca)$/;')).length > 0, 'poder novo só no espelho passou');
  assert.ok(contrato(regrasTxt.replace('newData.val() <= 10000000', 'newData.val() <= 20000000'), espelhoTxt).length > 0, 'teto trocado só nas regras passou');
});

test('contrato com o jogo: os itens e poderes que a regra aceita na mão são exatamente os do motor', () => {
  const doJogo = Object.keys(B.ARMAS).filter((k) => k !== 'soco' && k !== 'empurrao').sort().join('|');
  const regras = JSON.parse(ler('database.rules.json')).rules.cruzadabotecos.bar.vivo.$player.w['.validate'];
  const lista = /\^\(([a-z|]+)\)\$/.exec(regras)[1].split('|').sort().join('|');
  assert.equal(lista, doJogo);
  assert.ok(PD.PODERES.every((p) => lista.split('|').includes(p)));
});

/* ------------------------------------------------------------------ fechamento */

test('bar antigo fora: BarScreen.tsx, gore.ts e folha-sangue.mjs não existem e ninguém os importa', () => {
  for (const f of ['src/bar/BarScreen.tsx', 'src/bar/gore.ts', 'scripts/folha-sangue.mjs']) assert.ok(!fs.existsSync(path.join(raiz, f)), `${f} ainda existe`);
  const todos = [];
  (function andar(d) {
    for (const n of fs.readdirSync(path.join(raiz, d))) {
      const p = path.join(d, n);
      if (fs.statSync(path.join(raiz, p)).isDirectory()) andar(p);
      else if (/\.(ts|tsx|mjs)$/.test(n)) todos.push(p);
    }
  })('src');
  for (const d of ['tests', 'scripts']) for (const n of fs.readdirSync(path.join(raiz, d))) if (/\.mjs$/.test(n)) todos.push(path.join(d, n));
  for (const f of todos) {
    if (f.endsWith('fatia7.test.mjs')) continue;
    assert.ok(!/(from |import\()['"][^'"]*(bar\/gore|BarScreen|folha-sangue)/.test(ler(f)), `${f} ainda importa o bar antigo`);
  }
});

test('fim de linha: .gitattributes com eol=lf e nenhum arquivo de código com CRLF', () => {
  assert.match(ler('.gitattributes'), /^\* text=auto eol=lf$/m);
  for (const d of ['src/vivo', 'src/gfa', 'tests']) {
    for (const n of fs.readdirSync(path.join(raiz, d))) {
      if (!/\.(ts|tsx|mjs|css)$/.test(n)) continue;
      assert.ok(!ler(path.join(d, n)).includes('\r\n'), `${d}/${n} tem CRLF`);
    }
  }
});

/* ------------------------------------------------------------------ movimento e clarões */

test('movimento: a preferência manda; em "sistema" vale o que o aparelho pede; o botão gira sistema → reduzido → cheio', () => {
  assert.equal(MV.movimentoReduzido('sistema', true), true);
  assert.equal(MV.movimentoReduzido('sistema', false), false);
  assert.equal(MV.movimentoReduzido('reduzido', false), true);
  assert.equal(MV.movimentoReduzido('cheio', true), false);
  assert.equal(MV.proximaPref('sistema'), 'reduzido');
  assert.equal(MV.proximaPref('reduzido'), 'cheio');
  assert.equal(MV.proximaPref('cheio'), 'sistema');
  // Sem localStorage (Node): cai no padrão, sem quebrar.
  assert.equal(MV.lerPrefMovimento(), 'sistema');
});

test('clarões: no máximo 3 começam por segundo (o 4º é cortado inteiro); depois de 1 s volta a deixar', () => {
  const L = new MV.LimiteClarao();
  assert.deepEqual([0, 100, 200, 300].map((t, i) => L.fator(`c${i}`, t)), [1, 1, 1, 0]);
  // O mesmo clarão, visto de novo nos quadros seguintes, mantém a decisão (não corta no meio nem reacende).
  assert.equal(L.fator('c0', 250), 1);
  assert.equal(L.fator('c3', 350), 0);
  assert.equal(L.fator('c4', 1050), 1, 'o primeiro saiu da janela');
  // Rajada de 20 clarões em 2 s: nunca mais de 3 por janela de 1 s.
  const L2 = new MV.LimiteClarao();
  const aceitos = [];
  for (let i = 0; i < 20; i++) if (L2.fator(`x${i}`, i * 100)) aceitos.push(i * 100);
  for (const t of aceitos) assert.ok(aceitos.filter((u) => u >= t && u < t + 1000).length <= 3, `janela em ${t}`);
  assert.ok(aceitos.length >= 6);
});

test('clarões: no modo reduzido viram brilho suave (até 0,18); cortado continua cortado', () => {
  const L = new MV.LimiteClarao();
  assert.equal(L.opacidade('a', 0, 0.85, false), 0.85);
  assert.equal(L.opacidade('b', 10, 0.85, true), MV.BRILHO_REDUZIDO);
  assert.equal(L.opacidade('c', 20, 0.1, true), 0.1);
  L.fator('d', 30);
  assert.equal(L.opacidade('e', 40, 0.85, false), 0);
});

test('movimento na tela: tremor zero no reduzido (bar e GFA), todo clarão de tela cheia passa pelo limitador', () => {
  const vivo = ler('src/vivo/VivoScreen.tsx');
  assert.match(vivo, /const sh = reduzidoRef\.current \? 0 : m\.trauma \* m\.trauma \* 6;/);
  assert.match(vivo, /claroes\.opacidade\(`raj:/);
  assert.match(vivo, /clarao: \(chave, alpha\) => claroes\.opacidade\(chave, t, alpha, reduzidoRef\.current\)/);
  assert.match(vivo, /onClick=\{trocarMovimento\}/);
  const arte = ler('src/vivo/poderesArte.ts');
  assert.match(arte, /const a = p\.clarao\(/);
  assert.equal((arte.match(/fillRect\(0, 0, p\.vw, p\.vh\)/g) ?? []).length, 1, 'clarão desenhado fora do limitador');
  const gfa = ler('src/gfa/GfaTela.tsx');
  assert.match(gfa, /const calmo = movimentoReduzido\(\);/);
  assert.match(gfa, /const tr = calmo \? 0 :/);
  assert.match(gfa, /claroes\.fator\(/);
});

/* ------------------------------------------------------------------ livro do caixa */

const H = (d, h = 12) => Date.parse(`2026-11-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00-03:00`);

test('caixa: entradas e saídas somam por origem no dia; o dia vira às 6 h de Brasília', () => {
  let c = {};
  c = CX.lancar(c, H(27, 10), 'e', 'gfa', 45);
  c = CX.lancar(c, H(27, 11), 'e', 'gfa', 30);
  c = CX.lancar(c, H(27, 12), 'e', 'chao', 12);
  c = CX.lancar(c, H(27, 13), 's', 'raio', 300);
  c = CX.lancar(c, H(28, 5), 'e', 'chao', 8); // antes das 6 h: ainda é o dia 27
  const r = CX.resumo(c, H(27, 23));
  assert.deepEqual(r.hoje, { entrou: 95, saiu: 300, origens: [['gfa', 75], ['chao', 20]] });
  const r2 = CX.resumo(c, H(28, 7));
  assert.equal(r2.hoje.entrou, 0);
  assert.deepEqual(r2.semana, { entrou: 95, saiu: 300, dias: 1 });
});

test('caixa: ignora valor zero, negativo ou NaN; não muda o livro de entrada; guarda só os últimos 30 dias', () => {
  const c0 = {};
  assert.equal(CX.lancar(c0, H(27), 'e', 'gfa', 0), c0);
  assert.equal(CX.lancar(c0, H(27), 'e', 'gfa', -5), c0);
  assert.equal(CX.lancar(c0, H(27), 'e', 'gfa', NaN), c0);
  const c1 = CX.lancar(c0, H(27), 'e', 'gfa', 10);
  assert.deepEqual(c0, {});
  let c = {};
  const base = H(1);
  for (let i = 0; i < 40; i++) c = CX.lancar(c, base + i * 86_400_000, 'e', 'chao', 1);
  assert.equal(Object.keys(c).length, CX.DIAS_GUARDADOS);
  assert.ok(c1);
});

test('caixa: a leitura do aparelho joga fora lixo (chave que não é dia, origem estranha, valor inválido)', () => {
  const s = CX.sanitizeCaixa({ 20784: { e: { gfa: 10, 'x y': 5, chao: -1 }, s: { raio: 300 } }, abc: { e: { gfa: 1 } }, 20785: 'lixo' });
  assert.deepEqual(s, { 20784: { e: { gfa: 10 }, s: { raio: 300 } } });
  assert.deepEqual(CX.sanitizeCaixa(null), {});
});

test('caixa na tela: chão e GFA entram com a origem, a compra sai com o item, o mercado mostra hoje e 7 dias', () => {
  const vivo = ler('src/vivo/VivoScreen.tsx');
  assert.match(vivo, /ganhar\.current\(e\.v, 'chao'\)/);
  assert.match(vivo, /ganhar\.current\(r\.grana, 'gfa'\)/);
  assert.match(vivo, /lancarCaixa\('s', it\.arma, it\.preco\)/);
  assert.match(vivo, /Livro do caixa: hoje/);
});

/* ------------------------------------------------------------------ medidor de quadro */

test('medidor: qps pela média dos intervalos, p50/p95 do custo, pior intervalo e fração de quadros lentos', () => {
  const m = new MD.Medidor();
  for (let i = 0; i < 100; i++) m.anotar(i % 10 === 0 ? 50 : 16, 2 + (i % 10) / 10, 1);
  m.anotar(5000, 1, 1); // aba escondida: não conta
  m.anotar(0, 1, 1);
  const r = m.resumo();
  assert.equal(r.n, 100);
  assert.ok(Math.abs(r.qps - 1000 / 19.4) < 0.01, `${r.qps}`);
  assert.equal(r.piorIntervalo, 50);
  assert.equal(r.lentos, 0.1);
  assert.ok(r.quadroP50 >= 2.4 && r.quadroP50 <= 2.5, `${r.quadroP50}`);
  assert.ok(r.quadroP95 >= 2.9, `${r.quadroP95}`);
  assert.match(MD.textoMedidor(r), /^52 qps · quadro 2,\d\/2,9 ms · desenho p95 1,0 ms · pior 50 ms · lentos 10%$/);
  // Guarda só a janela dos últimos 120 quadros.
  for (let i = 0; i < 300; i++) m.anotar(10, 1, 1);
  assert.equal(m.resumo().n, 120);
  assert.equal(Math.round(m.resumo().qps), 100);
});

test('medidor na tela: ligado por ?medidor=1 ou F2, no bar e no GFA', () => {
  assert.equal(MD.medidorLigado('?medidor=1'), false, 'sem localStorage no Node: fica desligado, sem quebrar');
  const vivo = ler('src/vivo/VivoScreen.tsx');
  assert.match(vivo, /medidor\.m\.anotar\(intervalo, fim - t0q, fim - t0d\)/);
  assert.match(vivo, /e\.key !== 'F2'/);
  assert.match(ler('src/gfa/GfaTela.tsx'), /medidor\.m\.anotar\(intervalo, fim - t0q, fim - t0d\)/);
});

console.log(`\n${passed} testes da Fatia 7 passaram`);
