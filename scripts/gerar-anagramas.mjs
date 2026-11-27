// Gera UMA VEZ a lista congelada do Anagrama da Saideira (src/data/anagramas.json): para cada dia, 5 palavras dos
// pacotes (uma de 5, 6, 7 e 8 letras e uma de 9 ou 10), com a dica. Embaralhadas com semente fixa; a ordem nunca
// muda depois de gerada: o dia N usa a posição N − dia inicial em todo aparelho. A palavra da Palavra do Dia
// daquele mesmo dia nunca entra no anagrama do dia (troca com a seguinte da fila).
// Para acrescentar dias novos sem mexer nos antigos, use --acrescentar (só põe no fim, com palavras ainda não usadas).
// Uso: node scripts/gerar-anagramas.mjs [--acrescentar]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src', 'data', 'anagramas.json');
const append = process.argv.includes('--acrescentar');
if (fs.existsSync(out) && !append) {
  console.log(`já existe (congelada): ${out} — nada feito. Use --acrescentar para pôr dias novos no fim.`);
  process.exit(0);
}

const START = 20783; // 26/11/2026, o mesmo início da Palavra do Dia
const BUCKETS = [[5], [6], [7], [8], [9, 10]];
const pdd = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'palavras-do-dia.json'), 'utf8'));
// Formato compacto: { start, themes: [nome], days: [[[palavra, dica, índice do tema] × 5]] }.
const prev = append ? JSON.parse(fs.readFileSync(out, 'utf8')) : { start: START, themes: [], days: [] };
const used = new Set(prev.days.flat().map((e) => e[0]));
const themes = [...prev.themes];
const themeIdx = (name) => {
  let i = themes.indexOf(name);
  if (i < 0) i = themes.push(name) - 1;
  return i;
};

const packsDir = path.join(root, 'src', 'data', 'packs');
const seen = new Set();
const buckets = BUCKETS.map(() => []);
for (const f of fs.readdirSync(packsDir).sort()) {
  const pack = JSON.parse(fs.readFileSync(path.join(packsDir, f), 'utf8'));
  for (const e of pack.entries ?? []) {
    if (typeof e.word !== 'string' || !/^[A-Z]+$/.test(e.word) || seen.has(e.word) || typeof e.clue !== 'string') continue;
    // Palavra que é anagrama de si mesma só com letras iguais (ex.: "AAAAA") não serve.
    if (new Set(e.word).size < 2) continue;
    seen.add(e.word);
    const b = BUCKETS.findIndex((lens) => lens.includes(e.word.length));
    if (b >= 0 && !used.has(e.word)) buckets[b].push({ w: e.word, c: e.clue, t: pack.name });
  }
}

// Embaralhamento com semente fixa (mulberry32 + Fisher–Yates), uma fila por tamanho.
let a = 20261127 + prev.days.length;
const rand = () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
for (const list of buckets) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

const n = Math.min(...buckets.map((l) => l.length));
const days = [...prev.days];
for (let k = 0; k < n; k++) {
  const d = days.length;
  const pal = pdd.words[(((START + d - pdd.start) % pdd.words.length) + pdd.words.length) % pdd.words.length].w;
  const set = buckets.map((list, b) => {
    // A Palavra do Dia de hoje não entra: troca de lugar com a seguinte da mesma fila.
    if (list[k].w === pal && k + 1 < list.length) [list[k], list[k + 1]] = [list[k + 1], list[k]];
    return [list[k].w, list[k].c, themeIdx(list[k].t)];
  });
  days.push(set);
}
fs.writeFileSync(out, JSON.stringify({ start: prev.start, themes, days }) + '\n', 'utf8');
console.log(`${days.length} dias (${days.length - prev.days.length} novos), ${days.length * 5} palavras → ${out}`);
console.log('por fila:', buckets.map((l, i) => `${BUCKETS[i].join('/')}: ${l.length}`).join(', '));
