// Testes da Dimensão GFA (Fatia 4, lote F): a simulação pura (carro, pedestres, polícia, boletos e prêmio).
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

let passed = 0;
const test = (name, fn) => {
  fn();
  passed++;
  console.log(`ok - ${name}`);
};
const rodar = (g, ms, ent = () => G.PARADO) => {
  const ev = [];
  const n = Math.round(ms / 1000 / G.DT_GFA);
  for (let i = 0; i < n && !g.acabou; i++) {
    G.passoGfa(g, ent(i));
    ev.push(...g.eventos);
    g.eventos.length = 0;
  }
  return ev;
};

test('cidade: o carro nasce na rua, prédios ocupam o miolo dos quarteirões e a calçada é livre', () => {
  const g = G.novoGfa(1);
  assert.ok(!G.predio(g.carro.x, g.carro.z));
  assert.ok(G.predio(G.BLOCO * 3 + G.BLOCO / 2 + 5, G.BLOCO * 3 + G.BLOCO / 2 + 5));
  for (const p of g.pedestres) assert.ok(!G.predio(p.x, p.z), `pedestre ${p.id} dentro de prédio`);
  assert.equal(g.pedestres.length, G.N_PEDESTRES);
});

test('carro: acelera até perto do máximo numa reta, freia, dá ré e nunca atravessa prédio', () => {
  const g = G.novoGfa(2);
  rodar(g, 6000, () => ({ acel: 1, giro: 0, freio: false }));
  assert.ok(g.carro.vel > G.VEL_MAX * 0.6, `só ${g.carro.vel.toFixed(1)}`);
  rodar(g, 2000, () => ({ acel: 0, giro: 0, freio: true }));
  assert.ok(Math.abs(g.carro.vel) < 0.5);
  rodar(g, 2000, () => ({ acel: -1, giro: 0, freio: false }));
  assert.ok(g.carro.vel < -3, 'sem ré');
  // Dirigindo à toa por 60 s (volante e acelerador sorteados): nunca dentro de prédio nem fora do muro.
  const h = G.novoGfa(3);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let giro = 0;
  for (let i = 0; i < 3600; i++) {
    if (i % 40 === 0) giro = r() * 2 - 1;
    G.passoGfa(h, { acel: 1, giro, freio: false });
    h.eventos.length = 0;
    if (h.acabou) break;
    assert.ok(!G.predio(h.carro.x, h.carro.z) && !G.foraDoMundo(h.carro.x, h.carro.z), `entrou no prédio em ${h.carro.x.toFixed(1)},${h.carro.z.toFixed(1)}`);
  }
});

test('atropelo: pedestre na frente do carro rápido voa, cai e volta depois; carro parado não atropela', () => {
  const g = G.novoGfa(4);
  const c = g.carro;
  const p = g.pedestres[0];
  Object.assign(p, { x: c.x + Math.sin(c.ang) * 12, z: c.z + Math.cos(c.ang) * 12, dx: 0, dz: 0 });
  const ev = rodar(g, 3000, () => ({ acel: 1, giro: 0, freio: false }));
  assert.ok(ev.some((e) => e.k === 'atropelo' && e.id === p.id), 'não atropelou');
  assert.equal(g.atropelos, 1);
  assert.ok(g.boletos >= 1);
  assert.notEqual(p.estado, 'anda');
  rodar(g, 10_000);
  assert.equal(p.estado, 'anda', 'não voltou');
  // Parado, encostado: nada.
  const h = G.novoGfa(5);
  const q = h.pedestres[0];
  Object.assign(q, { x: h.carro.x + 0.5, z: h.carro.z, dx: 0, dz: 0 });
  rodar(h, 1000);
  assert.equal(h.atropelos, 0);
});

test('boletos: cada atropelo sobe o nível, a polícia sai atrás e, cercado parado, a corrida acaba presa', () => {
  const g = G.novoGfa(6);
  g.atropelos = 5;
  g.boletos = 3;
  g.boletosAte = g.t + 60_000;
  const ev = rodar(g, 200);
  assert.equal(g.viaturas.length, 3);
  assert.equal(ev.filter((e) => e.k === 'sirene').length, 3);
  // Viatura colada no carro parado: presa em 1,5 s.
  for (const v of g.viaturas) Object.assign(v, { x: g.carro.x + 1.5, z: g.carro.z, vel: 0 });
  const ev2 = rodar(g, 3000);
  assert.ok(g.presa && g.acabou);
  assert.ok(ev2.some((e) => e.k === 'presa'));
  // Sem atropelo novo, o nível cai sozinho.
  const h = G.novoGfa(7);
  h.boletos = 2;
  h.boletosAte = h.t + 100;
  rodar(h, 13_000, (i) => ({ acel: i % 600 < 300 ? 1 : -1, giro: 0.4, freio: false }));
  assert.ok(h.boletos <= 1, `${h.boletos}`);
});

test('corrida: acaba aos 90 s; prêmio com teto, metade se presa; portal uma vez a cada 5 min', () => {
  const g = G.novoGfa(8, 1000);
  const ev = rodar(g, 95_000);
  assert.ok(g.acabou && !g.presa);
  assert.ok(ev.some((e) => e.k === 'fim'));
  assert.ok(Math.abs(g.t - (1000 + G.DURACAO_MS)) < 50);
  g.atropelos = 4;
  assert.deepEqual(G.premio(g), { grana: 20, mortes: 4 });
  g.atropelos = 100;
  assert.equal(G.premio(g).grana, 990);
  g.presa = true;
  assert.equal(G.premio(g).grana, 495);
  assert.equal(G.premio(g).mortes, 100);
  assert.ok(G.podePortal(0, 5));
  assert.ok(!G.podePortal(1_000_000, 1_000_000 + G.ESPERA_PORTAL_MS - 1));
  assert.ok(G.podePortal(1_000_000, 1_000_000 + G.ESPERA_PORTAL_MS));
});

test('determinístico: mesma semente e mesmos comandos = mesma corrida', () => {
  const ent = (i) => ({ acel: Math.sin(i / 50) > -0.3 ? 1 : -1, giro: Math.sin(i / 70), freio: i % 400 > 390 });
  const a = G.novoGfa(9);
  const b = G.novoGfa(9);
  rodar(a, 30_000, ent);
  rodar(b, 30_000, ent);
  assert.deepEqual(JSON.stringify({ c: a.carro, p: a.pedestres, n: a.atropelos }), JSON.stringify({ c: b.carro, p: b.pedestres, n: b.atropelos }));
});

console.log(`\n${passed} testes da Dimensão GFA passaram`);
