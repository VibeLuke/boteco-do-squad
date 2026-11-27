// Testes da Fatia 9 (luz e cor): mapa de luz da hora de Brasília, véu de cor por evento, pontilhado Bayer, sprite
// de luz pronto, orçamento que desce e sobe de nível e o retângulo sujo do chão de manchas.
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
const L = await import('../src/vivo/luz.ts');

let n = 0;
const test = (nome, fn) => {
  fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};
const lum = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
};

test('Bayer 4×4: cada nível acende exatamente nível × 16 casas, sempre um conjunto que só cresce', () => {
  assert.deepEqual([...L.BAYER4].sort((a, b) => a - b), Array.from({ length: 16 }, (_, i) => i));
  let antes = L.mascaraBayer(0);
  assert.equal(antes.filter(Boolean).length, 0);
  for (let k = 1; k <= 16; k++) {
    const m = L.mascaraBayer(k / 16);
    assert.equal(m.filter(Boolean).length, k);
    for (let i = 0; i < 16; i++) if (antes[i]) assert.ok(m[i]);
    antes = m;
  }
  // Meio nível: tabuleiro de xadrez (nenhuma casa acesa ao lado de outra na mesma linha).
  const meio = L.mascaraBayer(0.5);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) assert.notEqual(meio[y * 4 + x], meio[y * 4 + x + 1]);
  assert.equal(L.mascaraBayer(2).filter(Boolean).length, 16);
});

test('hora de Brasília: UTC−3, de 0 a 24', () => {
  assert.equal(L.horaBrasilia(Date.UTC(2026, 10, 27, 3, 0)), 0);
  assert.equal(L.horaBrasilia(Date.UTC(2026, 10, 27, 1, 30)), 22.5);
  assert.equal(L.horaBrasilia(Date.UTC(2026, 10, 27, 15, 0)), 12);
});

test('luz ambiente: nada de dia, poente quente, noite azul e escura, sem salto nas viradas', () => {
  assert.equal(L.ambienteDaHora(12), null);
  assert.equal(L.ambienteDaHora(7), null);
  const noite = L.ambienteDaHora(23);
  assert.equal(noite, L.ambienteDaHora(2));
  const v = parseInt(noite.slice(1), 16);
  assert.ok((v & 255) > ((v >> 16) & 255), 'noite tem de ser azulada');
  assert.ok(lum(noite) < 130);
  const poente = L.ambienteDaHora(18);
  const pv = parseInt(poente.slice(1), 16);
  assert.ok(((pv >> 16) & 255) > (pv & 255), 'poente tem de ser quente');
  // Sem salto: de 6 em 6 minutos a luminância muda pouco (o 17h começa branco e o 7h termina branco).
  let ant = null;
  for (let h = 0; h < 24; h += 0.1) {
    const c = L.ambienteDaHora(h) ?? '#ffffff';
    if (ant !== null) assert.ok(Math.abs(lum(c) - ant) < 16, `salto às ${h.toFixed(1)}h`);
    ant = lum(c);
  }
});

test('véu de evento: nada sem evento ou com força 0; cresce com a força até o teto', () => {
  assert.equal(L.grading(null, 1), null);
  assert.equal(L.grading('invasao', 0), null);
  const a = L.grading('invasao', 0.5);
  const b = L.grading('invasao', 1);
  assert.ok(a.a < b.a && b.a === L.grading('invasao', 7).a);
  assert.equal(b.modo, 'soft-light');
  assert.equal(L.grading('viajante', 1).modo, 'multiply');
  assert.equal(L.grading('apagao', 1).modo, 'source-over');
  for (const g of L.GRADINGS) assert.ok(L.grading(g, 1).a <= 0.75);
});

test('sprite de luz: o raio é arredondado de 4 em 4 (poucas luzes prontas servem a todas)', () => {
  assert.equal(L.chaveLuz('#fff', 22), L.chaveLuz('#fff', 23));
  assert.notEqual(L.chaveLuz('#fff', 22), L.chaveLuz('#fff', 30));
  assert.notEqual(L.chaveLuz('#fff', 22), L.chaveLuz('#ff0', 22));
  assert.equal(L.chaveLuz('#fff', 1), '#fff|4');
});

test('orçamento: desce acima de 4 ms, sobe abaixo de 2 ms, fica entre os dois e espera 60 quadros', () => {
  assert.equal(L.nivelQualidade(0, 9, 30), 0);
  assert.equal(L.nivelQualidade(0, 4.5, 120), 1);
  assert.equal(L.nivelQualidade(1, 4.5, 120), 2);
  assert.equal(L.nivelQualidade(2, 9, 120), 2);
  assert.equal(L.nivelQualidade(2, 3, 120), 2);
  assert.equal(L.nivelQualidade(2, 1.5, 120), 1);
  assert.equal(L.nivelQualidade(0, 1, 120), 0);
  // Sem pular: na faixa do meio nunca troca.
  for (const p of [2, 2.5, 3.9, 4]) for (const a of [0, 1, 2]) assert.equal(L.nivelQualidade(a, p, 120), a);
});

test('retângulo sujo: junta os pixels pingados e recorta à área', () => {
  let r = null;
  r = L.sujar(r, 10, 5);
  assert.deepEqual(r, { x0: 10, y0: 5, x1: 11, y1: 6 });
  r = L.sujar(r, 3.7, 20, 2);
  assert.deepEqual(r, { x0: 3, y0: 5, x1: 11, y1: 22 });
  assert.deepEqual(L.recortar({ x0: -4, y0: -1, x1: 900, y1: 9 }, 100, 50), { x0: 0, y0: 0, x1: 100, y1: 9 });
  assert.equal(L.recortar({ x0: 120, y0: 0, x1: 130, y1: 5 }, 100, 50), null);
  assert.equal(L.recortar(null, 100, 50), null);
});

test('o desenho usa tudo isso: luz pronta, mapa multiplicado, brilho, véu, sombra pontilhada, manchas por pedaço', () => {
  const v = ler('src/vivo/VivoScreen.tsx');
  assert.doesNotMatch(v, /const brilho = [^\n]*\n[^\n]*createRadialGradient/);
  assert.match(v, /luzPronta\(/);
  assert.match(v, /globalCompositeOperation = 'multiply'/);
  assert.match(v, /ambienteDaHora\(horaFixa \?\? horaBrasilia\(t\)\)/);
  assert.match(v, /nivelQualidade\(/);
  assert.match(v, /grading\(/);
  assert.match(v, /sombraPontilhada|padraoBayer/);
  assert.match(v, /putImageData\(A\.img, 0, 0, /);
  assert.match(v, /ar\.ret = sujar\(ar\.ret, Math\.round\(x\), Math\.round\(y\), tam\);/);
  assert.equal((v.match(/gotas\.length < limiteGotas\(\)/g) ?? []).length, 3);
  assert.match(v, /const limiteGotas = \(\) => \(nivel === 2 \? MAX_GOTAS \/ 2 : MAX_GOTAS\);/);
});

console.log(`# fatia 9: ${n} testes`);
