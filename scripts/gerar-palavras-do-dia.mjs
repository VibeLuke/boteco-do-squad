// Gera UMA VEZ a lista congelada da Palavra do Dia (src/data/palavras-do-dia.json): palavras de 5 a 7 letras A–Z
// dos pacotes, com a dica, embaralhadas com semente fixa. A ordem nunca muda depois de gerada: o dia N usa a
// posição N − dia inicial em todo aparelho. Para acrescentar palavras, use --acrescentar (só põe no fim).
// Uso: node scripts/gerar-palavras-do-dia.mjs [--acrescentar]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src', 'data', 'palavras-do-dia.json');
const append = process.argv.includes('--acrescentar');
if (fs.existsSync(out) && !append) {
  console.log(`já existe (congelada): ${out} — nada feito. Use --acrescentar para pôr palavras novas no fim.`);
  process.exit(0);
}

const packsDir = path.join(root, 'src', 'data', 'packs');
const seen = new Set();
const all = [];
for (const f of fs.readdirSync(packsDir).sort()) {
  const pack = JSON.parse(fs.readFileSync(path.join(packsDir, f), 'utf8'));
  for (const e of pack.entries ?? []) {
    if (typeof e.word !== 'string' || !/^[A-Z]{5,7}$/.test(e.word) || seen.has(e.word) || typeof e.clue !== 'string') continue;
    seen.add(e.word);
    all.push({ w: e.word, c: e.clue, t: pack.name });
  }
}

// Embaralhamento com semente fixa (mulberry32 + Fisher–Yates).
let a = 20261126;
const rand = () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
for (let i = all.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1));
  [all[i], all[j]] = [all[j], all[i]];
}

let list = all;
if (append) {
  const cur = JSON.parse(fs.readFileSync(out, 'utf8'));
  const have = new Set(cur.words.map((x) => x.w));
  list = [...cur.words, ...all.filter((x) => !have.has(x.w))];
  console.log(`acrescentadas ${list.length - cur.words.length} no fim`);
}
fs.writeFileSync(out, JSON.stringify({ start: 20783, words: list }, null, 0) + '\n');
console.log(`${list.length} palavras -> ${out}`);
