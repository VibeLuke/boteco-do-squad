// Testes da Fatia 8 (sensação do golpe e marcas no chão): congelamento com teto, tremor só no golpe pesado, clarão
// de 2 quadros, recuo, achatar e esticar, três quedas, micro-ações de quem está parado, rampa das gotas e os
// decalques novos (queimado, rachadura, poça em degrau, pegada). Cada medida tem um caso que passa e um que falha.
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
const I = await import('../src/vivo/impacto.ts');
const D = await import('../src/vivo/decalques.ts');
const B = await import('../src/vivo/briga.ts');
const G = await import('../src/vivo/gente.ts');

let n = 0;
const test = (nome, fn) => {
  fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};
const T0 = 1_800_000_300_000;
const lum = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
};

/* ------------------------------------------------------------------ congelamento, tremor e clarão */

test('congelamento: golpe normal no máximo 110 ms; o leve fica como era', () => {
  assert.equal(I.HITSTOP_MAX, 110);
  assert.equal(I.hitstopDe(B.JAB), 60);
  assert.equal(I.hitstopDe(B.ARMAS.marreta), 110); // era 170
  assert.equal(I.hitstopDe({ hitstop: -5 }), 0);
  for (const [k, a] of Object.entries(B.ARMAS)) assert.ok(I.hitstopDe(a) <= 110, k);
  // Caso que falha: sem o teto, a marreta passaria.
  assert.ok(B.ARMAS.marreta.hitstop > I.HITSTOP_MAX);
});

test('tremor só no golpe pesado, crescendo com o peso do item', () => {
  assert.equal(I.traumaDe(B.JAB), 0);
  assert.equal(I.traumaDe(B.ARMAS.faca), 0);
  assert.ok(Math.abs(I.traumaDe(B.ARMAS.garrafa) - 0.3286) < 0.001);
  assert.equal(I.traumaDe(B.ARMAS.marreta), 0.5);
  const pesados = Object.values(B.ARMAS).filter((a) => a.forte && a.hitstop > 0).sort((a, b) => a.hitstop - b.hitstop);
  for (let i = 1; i < pesados.length; i++) assert.ok(I.traumaDe(pesados[i]) >= I.traumaDe(pesados[i - 1]));
  for (const a of Object.values(B.ARMAS)) assert.ok(I.traumaDe(a) >= 0 && I.traumaDe(a) <= 0.5);
});

test('no motor: soco não sacode, marreta congela 110 ms e sacode 0,5, nocaute congela 160 ms', () => {
  const mundo = () => B.novoMundo('will', T0, 7);
  const alvoDe = (m) => {
    const c = m.corpos.find((o) => o.quem === 'npc' && !o.ausente && o.estado === 'normal');
    c.vida = c.vidaMax = 999;
    return c;
  };
  let m = mundo();
  let a = alvoDe(m);
  B.ferir(m, a, B.eu(m), B.JAB, 1, 0);
  assert.equal(m.trauma, 0);
  assert.equal(m.hitstopAte - m.t, 60);
  assert.equal(a.flashAte - m.t, I.FLASH_MS);
  m = mundo();
  a = alvoDe(m);
  B.ferir(m, a, B.eu(m), B.ARMAS.marreta, 1, 0, 'marreta');
  assert.equal(m.hitstopAte - m.t, 110);
  assert.equal(m.trauma, 0.5);
  m = mundo();
  a = alvoDe(m);
  a.vida = 5;
  B.ferir(m, a, B.eu(m), B.JAB, 1, 0);
  assert.equal(a.estado, 'ko');
  assert.equal(m.hitstopAte - m.t, I.HITSTOP_FINAL);
});

test('a tela também só sacode com o tranco do item no golpe pesado; o clarão tem 1 quadro garantido', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  assert.match(v, /if \(e\.forte\) m\.trauma = Math\.min\(1, m\.trauma \+ mv\.tranco \* 0\.4\);/);
  assert.match(v, /flashQ\.set\(e\.em, 1\);/);
  assert.match(v, /t < c\.flashAte \|\| \(flashQ\.get\(c\.id\) \?\? 0\) > 0/);
  const b = ler('src/vivo/briga.ts');
  // Os dois ramos do `ferir` e o golpe em bicho de evento (Fatia 10).
  assert.equal((b.match(/m\.hitstopAte = Math\.max\(m\.hitstopAte, m\.t \+ hitstopDe\(g\)\);/g) ?? []).length, 3);
  assert.doesNotMatch(b, /sacudir\(m, g\.forte \? 0\.45 : 0\.25\)/);
});

/* ------------------------------------------------------------------ só desenho */

test('recuo: 1 px no leve, 3 no pesado, para longe e de volta em 120 ms; zero no movimento reduzido', () => {
  assert.deepEqual(I.recuo(0, true, 1, 0), { x: 3, y: 0 });
  assert.deepEqual(I.recuo(0, false, -1, 0), { x: -1, y: 0 });
  assert.deepEqual(I.recuo(0, true, 0, 1), { x: 0, y: 2 });
  assert.deepEqual(I.recuo(I.RECUO_MS, true, 1, 0), { x: 0, y: 0 });
  assert.deepEqual(I.recuo(0, true, 1, 0, true), { x: 0, y: 0 });
  let antes = 99;
  for (let t = 0; t < I.RECUO_MS; t += 10) {
    const r = I.recuo(t, true, 1, 0).x;
    assert.ok(r <= antes && r >= 0);
    antes = r;
  }
});

test('achatar e esticar: começa achatado, passa por esticado, volta a 1 e não muda o volume', () => {
  const e0 = I.esticao(0, true);
  assert.ok(e0.sx > 1.1 && e0.sy < 0.9);
  const meio = Array.from({ length: 30 }, (_, i) => I.esticao((i / 30) * I.ESTICA_MS, true));
  assert.ok(meio.some((e) => e.sx < 1 && e.sy > 1), 'nunca estica');
  for (const e of meio) assert.ok(Math.abs(e.sx * e.sy - 1) < 1e-9);
  assert.deepEqual(I.esticao(I.ESTICA_MS, true), { sx: 1, sy: 1 });
  assert.deepEqual(I.esticao(0, true, true), { sx: 1, sy: 1 });
  assert.ok(I.esticao(0, false).sx < e0.sx);
  const t = I.tamanhoEsticado(24, 34, e0);
  assert.ok(Number.isInteger(t.w) && Number.isInteger(t.h) && t.w > 24 && t.h < 34);
  assert.deepEqual(I.tamanhoEsticado(1, 1, { sx: 0.1, sy: 0.1 }), { w: 1, h: 1 });
});

test('três quedas: fixas pelo nome, todas usadas, ângulos de 30 em 30, acabam deitado', () => {
  const ids = G.NPCS.map((n) => n.id);
  const vs = new Set(ids.map(I.quedaDe));
  assert.equal(vs.size, 3);
  for (const id of ids) assert.equal(I.quedaDe(id), I.quedaDe(id));
  for (const v of I.QUEDAS) {
    let fim;
    for (let t = 0; t < I.QUEDA_MS; t += 5) {
      const p = I.poseQueda(v, t);
      assert.ok(p);
      assert.equal(Math.abs(p.ang) % 30, 0);
      assert.ok(Math.abs(p.ang) <= 90 && p.sy > 0.5 && p.sy <= 1);
      fim = p;
    }
    assert.equal(Math.abs(fim.ang), 90, v);
    assert.equal(I.poseQueda(v, I.QUEDA_MS), null);
    assert.equal(I.poseQueda(v, 50, true), null);
  }
  assert.ok(I.poseQueda('costas', 250).ang < 0 && I.poseQueda('cara', 250).ang > 0);
  assert.equal(I.poseQueda('joelhos', 130).sy < 0.75, true);
  assert.deepEqual(I.deitadoDe('costas'), { pose: 'ko-flat', inverte: true });
  assert.deepEqual(I.deitadoDe('joelhos'), { pose: 'ko-slump', inverte: false });
});

test('micro-ações: respira 1 px num ritmo próprio, olha para o lado ~10% do tempo; nada no reduzido', () => {
  const resp = Array.from({ length: 400 }, (_, i) => I.respiro('pinguco', T0 + i * 10));
  assert.ok(resp.includes(0) && resp.includes(1) && resp.every((x) => x === 0 || x === 1));
  assert.notDeepEqual(resp, Array.from({ length: 400 }, (_, i) => I.respiro('kelly', T0 + i * 10)));
  const olha = Array.from({ length: 6000 }, (_, i) => I.olhadela('pinguco', T0 + i * 10)).filter(Boolean).length / 6000;
  assert.ok(olha > 0.05 && olha < 0.13, String(olha));
  assert.equal(I.respiro('pinguco', T0 + 5, true), 0);
  assert.equal(Array.from({ length: 2000 }, (_, i) => I.olhadela('pinguco', T0 + i * 10, true)).some(Boolean), false);
  const v = ler('src/vivo/VivoScreen.tsx');
  assert.match(v, /respiro\(c\.id, t, calmo\)/);
  assert.match(v, /olhadela\(c\.id, t, reduzidoRef\.current\)/);
  assert.match(v, /const calmo = reduzidoRef\.current;/);
});

/* ------------------------------------------------------------------ gotas */

test('gotas: rampa dura de 3 tons tirada da própria cor (o dente continua branco)', () => {
  const [c, b, e] = I.rampaGota('#a31a2b');
  assert.equal(b, '#a31a2b');
  assert.ok(lum(c) > lum(b) && lum(b) > lum(e));
  assert.equal(I.rampaGota('#f4f4f4')[0], '#f8f8f8');
  assert.ok(lum(I.rampaGota('#f4f4f4')[2]) > 140);
  assert.equal(I.rampaGota('#a31a2b'), I.rampaGota('#a31a2b')); // guardada
  assert.deepEqual([0, 59, 60, 279, 280, 900].map(I.tomGota), [0, 0, 1, 1, 2, 2]);
  assert.deepEqual([0, 100, 500].map((t) => I.tamGota(2, t)), [3, 2, 1]);
  assert.equal(I.tamGota(1, 500), 1);
});

test('toda gota nasce com a idade (o tipo obriga) e cai com a cor base, não com o tom envelhecido', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  const pushes = v.match(/gotas\.push\(\{[\s\S]*?\}\);/g) ?? [];
  assert.equal(pushes.length, 3);
  for (const p of pushes) assert.match(p, /nasce: m\.t/);
  assert.match(v, /if \(g\.mancha\) pingar\(g\.area, g\.x, g\.y, g\.cor,/);
});

/* ------------------------------------------------------------------ decalques */

test('queimado: mesmo desenho para a mesma semente, mais escuro no meio, dentro do raio', () => {
  const a = D.queimado(13, 101);
  assert.deepEqual(a, D.queimado(13, 101));
  assert.notDeepEqual(a, D.queimado(13, 102));
  assert.ok(a.length > 100);
  for (const p of a) {
    assert.ok(Math.abs(p.dx) <= 16 && Math.abs(p.dy) <= 9 && p.a > 0 && p.a <= 255);
  }
  const meio = a.find((p) => p.dx === 0 && p.dy === 0);
  assert.equal(meio.tom, 0);
  assert.ok(meio.a >= Math.max(...a.map((p) => p.a)) - 1);
});

test('rachadura: 3 a 5 trincas a partir do centro, finas e dentro do raio', () => {
  for (const s of [1, 2, 3, 77]) {
    const r = D.rachadura(18, s);
    assert.deepEqual(r, D.rachadura(18, s));
    const escuros = r.filter((p) => p.tom === 0);
    assert.ok(escuros.length >= 18 && escuros.length < 18 * 9, String(escuros.length));
    for (const p of r) assert.ok(Math.hypot(p.dx, p.dy * 2) <= 18 * 1.6 + 2);
    assert.equal(new Set(r.map((p) => `${p.dx},${p.dy}`)).size, r.length);
  }
});

test('poça em degrau: borda escura, miolo e 2 pixels de brilho no alto', () => {
  const p = D.pocaDegrau(6.6, 505);
  assert.deepEqual(p, D.pocaDegrau(6.6, 505));
  assert.equal(p.filter((x) => x.tom === 2).length, 2);
  const borda = p.filter((x) => x.tom === 0).length;
  const miolo = p.filter((x) => x.tom === 1).length;
  assert.ok(borda > 10 && miolo > 10);
  const brilho = p.filter((x) => x.tom === 2);
  const topo = Math.min(...p.map((x) => x.dy));
  assert.ok(brilho.every((x) => x.dy <= topo + 2));
  assert.ok(p.some((x) => x.dx === 0 && x.dy === 0));
  // Caso que falha: poça pequena demais (o tamanho de antes) quase não tem miolo.
  assert.ok(D.pocaDegrau(2, 505).filter((x) => x.tom === 1).length < miolo / 3);
});

test('pegadas: somem em 8 passos, sempre mais fracas; pisar é dentro da elipse do chão', () => {
  const a = Array.from({ length: 10 }, (_, k) => D.alfaPegada(k));
  assert.equal(a[0], 190);
  for (let k = 1; k < D.PASSOS_PEGADA; k++) assert.ok(a[k] < a[k - 1] && a[k] > 0);
  assert.equal(a[8], 0);
  assert.equal(D.alfaPegada(-1), 0);
  const poca = { x: 100, y: 50, r: 6 };
  assert.equal(D.naPoca(105, 50, poca), true);
  assert.equal(D.naPoca(100, 54, poca), false);
  assert.equal(D.naPoca(107, 50, poca), false);
});

test('o chão guarda os poderes: rachadura do pagode e da marreta, queimado da pinga, do raio e do torresmo', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  assert.match(v, /if \(e\.tipo === 'pagode'\) marcar\(z, a\.x, a\.y \+ 1, 'racha', 18\);/);
  assert.match(v, /if \(e\.tipo === 'torresmo'\) marcar\(zc, c\.x, c\.y, 'racha', 22, m\.t \+ em\);/);
  assert.match(v, /if \(e\.arma === 'raio'\) marcar\(/);
  assert.match(v, /if \(e\.arma === 'marreta'\) marcar\(/);
  assert.match(v, /if \(e\.arma === 'chope'\) pocaEm\(/);
  // As marcas atrasadas só entram quando chega a hora.
  assert.match(v, /if \(m\.t < mk\.quando\) continue;/);
});

console.log(`# fatia 8: ${n} testes`);
