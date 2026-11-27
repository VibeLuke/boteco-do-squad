// Testes dos efeitos (Fatia 4, FX): partículas e tremor do GFA, a trilha nossa e o ambiente de cada canto do bar.
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

const G = await import('../src/gfa/simulacao.ts');
const F = await import('../src/gfa/fx.ts');
const T = await import('../src/gfa/trilha.ts');
const A = await import('../src/vivo/ambiente.ts');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};
const andar = (fx, s, g, e) => {
  for (let i = 0; i < Math.round(s * 60); i++) F.passoFx(fx, 1 / 60, g, e);
};

test('GFA: batida solta faíscas (mais com mais força, com teto), treme a câmera e tudo some em 1,5 s', () => {
  const fraco = F.novoFx(1);
  const forte = F.novoFx(1);
  F.faiscas(fraco, 50, 50, 9);
  F.faiscas(forte, 50, 50, 40);
  const luz = (fx) => fx.p.filter((p) => p.luz).length;
  assert.ok(luz(forte) > luz(fraco), `${luz(forte)} > ${luz(fraco)}`);
  assert.ok(luz(forte) <= 40);
  assert.ok(forte.tremor > fraco.tremor && fraco.tremor > 0);
  andar(forte, 1.5);
  assert.equal(forte.p.length, 0);
  assert.equal(forte.tremor, 0);
});

test('GFA: atropelo respinga para a frente do carro, assenta no chão, e o molho de tomate não tem cor de sangue', () => {
  const fx = F.novoFx(2);
  F.respingo(fx, 0, 0, 25, 0, true); // carro para +z
  const mz = fx.p.reduce((s, p) => s + p.vz, 0) / fx.p.length;
  assert.ok(mz > 4, `vai para a frente (vz médio ${mz.toFixed(1)})`);
  andar(fx, 0.5);
  const noChao = fx.p.filter((p) => p.y <= 0.05);
  assert.ok(noChao.length > 0 && noChao.every((p) => p.vx === 0 && p.vz === 0), 'parou no asfalto');
  const molho = F.novoFx(3);
  for (let i = 0; i < 20; i++) F.respingo(molho, 0, 0, 20, 0, false);
  assert.ok(molho.p.every((p) => p.cor !== '#73172d' && p.cor !== '#a22633'));
});

test('GFA: derrapagem solta fumaça e marca no asfalto; reto e sem freio, nada; acelerando, fumacinha do escape', () => {
  const g = G.novoGfa(5);
  const reto = { acel: 0, giro: 0, freio: false };
  Object.assign(g.carro, { vel: 20, lado: 0 });
  assert.equal(F.emDerrapagem(g.carro, reto), false);
  const fx = F.novoFx(4);
  F.passoFx(fx, 0.5, g, reto);
  assert.equal(fx.p.length + fx.marcas.length, 0);
  Object.assign(g.carro, { lado: 4 });
  assert.equal(F.emDerrapagem(g.carro, reto), true);
  for (let i = 0; i < 30; i++) F.passoFx(fx, 1 / 60, g, reto);
  assert.ok(fx.marcas.length >= 8, `${fx.marcas.length} marcas`);
  assert.ok(fx.p.some((p) => !p.luz && p.tam1 > 2), 'fumaça de pneu');
  Object.assign(g.carro, { lado: 0, vel: 15 });
  assert.equal(F.emDerrapagem(g.carro, { acel: 0, giro: 0, freio: true }), true, 'freada forte também derrapa');
  const esc = F.novoFx(6);
  Object.assign(g.carro, { vel: 5 });
  for (let i = 0; i < 30; i++) F.passoFx(esc, 1 / 60, g, { acel: 1, giro: 0, freio: false });
  assert.ok(esc.p.length >= 4 && esc.p.every((p) => p.cor === '#5d275d'));
});

test('GFA: as rodas de trás ficam atrás do carro, uma de cada lado', () => {
  const c = { x: 10, z: 10, ang: 0, vel: 0, lado: 0, roda: 0 };
  const [a, b] = F.rodasTras(c);
  assert.ok(a[1] < 10 && b[1] < 10, 'atrás em z');
  assert.ok(Math.abs(a[0] - b[0]) > 1.5, 'uma de cada lado');
  const v = { ...c, ang: Math.PI / 2 }; // aponta para +x
  const [d] = F.rodasTras(v);
  assert.ok(d[0] < 10, 'atrás em x');
});

test('GFA: luz da sirene só com viatura perto, alternando vermelho e azul; linhas de velocidade só em alta', () => {
  const g = G.novoGfa(7);
  assert.equal(F.luzSirene(g, 0).forca, 0);
  g.viaturas.push({ ...g.carro, id: 1, x: g.carro.x + 8, z: g.carro.z });
  assert.ok(Math.abs(F.luzSirene(g, 0).forca - 0.75) < 1e-9);
  assert.notEqual(F.luzSirene(g, 0).cor, F.luzSirene(g, 180).cor);
  g.viaturas[0].x = g.carro.x + 40;
  assert.equal(F.luzSirene(g, 0).forca, 0);
  assert.equal(F.linhasVelocidade(G.VEL_MAX * 0.5, G.VEL_MAX), 0);
  assert.ok(Math.abs(F.linhasVelocidade(G.VEL_MAX, G.VEL_MAX) - 1) < 1e-9);
});

test('GFA: o lote de partículas tem teto (a mais velha cede o lugar)', () => {
  const fx = F.novoFx(8, 50);
  for (let i = 0; i < 20; i++) F.faiscas(fx, 0, 0, 30);
  assert.equal(fx.p.length, 50);
});

test('trilha: o solo fecha 8 compassos (128 semicolcheias) e só usa notas da escala de mi menor', () => {
  const total = T.SOLO.reduce((s, [, d]) => s + d, 0);
  assert.equal(total, 128);
  const escala = new Set([4, 6, 7, 9, 11, 0, 2]); // mi fá# sol lá si dó ré
  for (const [n] of T.SOLO) if (n) assert.ok(escala.has(n % 12), `nota ${n} fora de mi menor`);
  assert.equal(T.ACORDES.length, 8);
  for (const ac of T.ACORDES) for (const n of ac) assert.ok(escala.has(n % 12), `acorde com ${n}`);
});

test('bar: o ambiente sai dos móveis (2 barris de fogo, churrasco, pia, portal, postes, moscas nas caçambas)', () => {
  const a = A.montarAmbiente();
  const tipos = (t) => a.emissores.filter((e) => e.tipo === t);
  assert.equal(tipos('fogo').length, 2);
  assert.equal(tipos('churrasco').length, 1);
  assert.equal(tipos('pia').length, 1);
  assert.equal(tipos('pia')[0].zona, 'banheiro');
  assert.equal(tipos('portal').length, 1);
  assert.equal(a.luzes.filter((l) => l.tipo === 'poste').length, 3);
  assert.equal(a.moscas.length, 3);
  // Salão principal (antes da mureta) também tem efeito: vapor das 2 chopeiras e do freezer, luz das 2 geladeiras.
  const gelado = tipos('gelado');
  assert.equal(gelado.length, 3);
  assert.ok(gelado.every((e) => e.x < 13 && e.y < 9 && e.zona === 'bar'));
  assert.equal(a.luzes.filter((l) => l.tipo === 'geladeira' && l.x < 13).length, 2);
  const nevoa = A.novoAmbiente(() => 0.5);
  for (let i = 0; i < 120; i++) A.passoAmbiente(nevoa, gelado, 'bar', 1 / 60);
  assert.ok(nevoa.p.some((f) => f.tipo === 'nevoa' && f.h < 22), 'o vapor gelado desce');
});

test('bar: o fogo tremula, o poste 0 fica firme e o poste 1 falha de vez em quando (pela hora, igual em todo aparelho)', () => {
  const a = A.montarAmbiente();
  const fogo = a.luzes.find((l) => l.tipo === 'fogo');
  const firme = a.luzes.find((l) => l.tipo === 'poste' && l.v === 0);
  const falha = a.luzes.find((l) => l.tipo === 'poste' && l.v === 1);
  const vals = [];
  for (let t = 0; t < 7000; t += 10) vals.push(A.forcaLuz(fogo, t));
  assert.ok(Math.max(...vals) - Math.min(...vals) > 0.3, 'tremula');
  assert.ok(Math.min(...vals) > 0.3 && Math.max(...vals) <= 1);
  let apagado = 0;
  for (let t = 0; t < 7000; t += 10) {
    assert.equal(A.forcaLuz(firme, t), 1);
    if (A.forcaLuz(falha, t) < 0.5) apagado++;
  }
  assert.ok(apagado > 20 && apagado < 140, `${apagado} de 700 apagado`);
  assert.equal(A.forcaLuz(falha, 1000), A.forcaLuz(falha, 1000 + 7000 * 9), 'ciclo pela hora');
});

test('bar: cada área só solta o que é dela (no banheiro, a pia pinga e a gota vira respingo; no bar, brasa sobe)', () => {
  const a = A.montarAmbiente();
  const ban = A.novoAmbiente(() => 0.37);
  let viuRespingo = false;
  for (let i = 0; i < 300; i++) {
    A.passoAmbiente(ban, a.emissores, 'banheiro', 1 / 60);
    if (ban.p.some((f) => f.tipo === 'respingo')) viuRespingo = true;
  }
  assert.ok(ban.p.every((f) => f.zona === 'banheiro'));
  assert.ok(ban.p.every((f) => f.tipo === 'gota' || f.tipo === 'respingo'));
  assert.ok(viuRespingo, 'a gota caiu e respingou');
  let s = 9;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const bar = A.novoAmbiente(rnd);
  for (let i = 0; i < 120; i++) A.passoAmbiente(bar, a.emissores, 'bar', 1 / 60);
  const brasas = bar.p.filter((f) => f.tipo === 'brasa');
  assert.ok(brasas.length > 5, `${brasas.length} brasas`);
  assert.ok(brasas.some((f) => f.h > 20), 'subiram');
  const poeira = bar.p.filter((f) => f.tipo === 'poeira');
  assert.ok(poeira.length > 0 && poeira.every((f) => f.x < 22.5 && f.y < 9.5), 'poeira só no salão');
  assert.ok(bar.p.some((f) => f.tipo === 'portal'), 'portal girando');
  assert.ok(bar.p.every((f) => f.zona === 'bar'));
});

test('bar: portal puxa as partículas em espiral para dentro; teto de partículas respeitado', () => {
  const a = A.montarAmbiente();
  const amb = A.novoAmbiente(Math.random, 40);
  for (let i = 0; i < 600; i++) A.passoAmbiente(amb, a.emissores, 'bar', 1 / 60);
  assert.ok(amb.p.length <= 40);
  const p = { tipo: 'portal', zona: 'bar', x: 0, y: 0, h: 22, vx: 0, vy: 0, vh: 0, vida: 0, dura: 1, cor: '#fff', tam: 1, ang: 0, raio: 15 };
  const so = A.novoAmbiente(Math.random);
  so.p.push(p);
  A.passoAmbiente(so, [], 'banheiro', 0.5);
  assert.ok(p.raio < 15 && p.ang > 0);
});

test('bar: moscas rodam perto da caçamba', () => {
  const m = { x: 26.5, y: 1.5 };
  for (let t = 0; t < 5000; t += 97)
    for (const [x, y, h] of A.moscasEm(m, t)) {
      assert.ok(Math.hypot(x - m.x, y - m.y) < 0.6);
      assert.ok(h > 10 && h < 35);
    }
  assert.notDeepEqual(A.moscasEm(m, 0), A.moscasEm(m, 300));
});

console.log(`\n${passed} testes dos efeitos passaram`);
