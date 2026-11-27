// Amigo de mentira na sinuca (só no banco falso, porta 5180): entra na vaga 2 e taca, como o painel faria.
// Uso (com o npm run mock:firebase de pé): node tests/ferramentas/amigo_sinuca.mjs <mesa 0|1> <ver|entrar|tacar|conferir>
import * as B from '../../src/vivo/bilhar.ts';

const BASE = 'http://localhost:5180/cruzadabotecos/bar/mesa';
const [, , iStr, acao] = process.argv;
const i = Number(iStr);
const ler = async () => (await fetch(`${BASE}/${i}.json`)).json();
const gravar = async (v) => {
  const r = await fetch(`${BASE}/${i}.json`, { method: 'PUT', body: JSON.stringify({ ...v, at: { '.sv': 'timestamp' } }) });
  return r.status;
};
const r4 = (v) => Math.round(v * 10000) / 10000;
const resumo = (r) => {
  const m = B.decodificar(r.e);
  return { a: r.a, b: r.b, n: r.n, v: r.v, tq: r.tq, vez: m?.vez, fim: m?.fim ?? null, dentro: m ? m.bolas.filter((b) => b.dentro).map((b) => b.n) : null };
};

const r = await ler();
if (acao === 'ver') console.log(JSON.stringify(resumo(r)));
else if (acao === 'entrar') {
  console.log('PUT', await gravar({ ...r, b: 'dani', n: r.n + 1, tq: '' }));
  console.log(JSON.stringify(resumo(await ler())));
} else if (acao === 'tacar') {
  const m = B.decodificar(r.e);
  if (!m || m.vez !== 1 || r.v !== 1) throw new Error(`não é a vez da vaga 2 (v=${r.v})`);
  const j = B.pensarBot(m, 'medio', r.n * 31 + 7);
  const tq = [r4(j.dx), r4(j.dy), r4(j.forca), ...(j.branca ? [r4(j.branca.x), r4(j.branca.y)] : [])].join(',');
  const p = tq.split(',').map(Number);
  const base = p.length >= 5 ? (B.posicionarBranca(m, p[3], p[4]) ?? m) : m;
  const depois = B.simular(base, { dx: p[0], dy: p[1], forca: p[2] }).mesa;
  console.log('PUT', await gravar({ ...r, v: depois.vez, e: B.codificar(depois), n: r.n + 1, tq }));
  console.log(JSON.stringify(resumo(await ler())));
} else if (acao === 'conferir') {
  // A última tacada gravada (de quem for) bate com a simulação da mesa de antes? Precisa do estado anterior salvo.
  const fs = await import('node:fs');
  const arq = new URL(`./mesa${i}_antes.json`, import.meta.url);
  if (process.argv[4] === 'salvar') {
    fs.writeFileSync(arq, JSON.stringify(r));
    console.log('salvo n=', r.n);
  } else {
    const antes = JSON.parse(fs.readFileSync(arq, 'utf8'));
    const m = B.decodificar(antes.e);
    const p = r.tq.split(',').map(Number);
    const base = p.length >= 5 ? (B.posicionarBranca(m, p[3], p[4]) ?? m) : m;
    const depois = B.simular(base, { dx: p[0], dy: p[1], forca: p[2] }).mesa;
    console.log(JSON.stringify({ n: [antes.n, r.n], igual: B.codificar(depois) === r.e, vezOk: depois.vez === r.v }));
  }
}
