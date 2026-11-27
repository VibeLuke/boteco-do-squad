// Gera UMA VEZ a lista congelada do Quiz geek da sinuca (src/data/quiz.json): para cada dia, 10 perguntas tiradas
// das dicas dos pacotes: a dica, a palavra certa e 3 palavras erradas do mesmo pacote (de tamanho parecido).
// Embaralhada com semente fixa; a ordem nunca muda depois de gerada (o dia N usa a posição N − dia inicial).
// No mesmo dia, nem a resposta nem as erradas repetem a Palavra do Dia ou os 5 anagramas (senão um jogo entrega o
// outro). Palavra cuja dica contém a própria palavra fica de fora.
// Para acrescentar dias sem mexer nos antigos: --acrescentar (só põe no fim, com palavras ainda não usadas).
// Uso: node scripts/gerar-quiz.mjs [--acrescentar]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'src', 'data', 'quiz.json');
const append = process.argv.includes('--acrescentar');
if (fs.existsSync(out) && !append) {
  console.log(`já existe (congelada): ${out} — nada feito. Use --acrescentar para pôr dias novos no fim.`);
  process.exit(0);
}

const START = 20783; // 26/11/2026, o mesmo início da Palavra do Dia e do anagrama
const PER_DAY = 10;
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', f), 'utf8'));
const pdd = read('palavras-do-dia.json');
const ana = read('anagramas.json');
const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const mod = (n, m) => ((n % m) + m) % m;
/** Palavras que não podem aparecer no quiz do dia d (Palavra do Dia e os 5 anagramas). */
const bannedOn = (d) => new Set([pdd.words[mod(START + d - pdd.start, pdd.words.length)].w, ...ana.days[mod(START + d - ana.start, ana.days.length)].map((e) => e[0])]);

// Formato compacto: { start, themes: [nome], days: [[[palavra, dica, tema, [errada × 3]] × 10]] }.
const prev = append ? read('quiz.json') : { start: START, themes: [], days: [] };
const used = new Set(prev.days.flat().map((q) => q[0]));
const themes = [...prev.themes];
const themeIdx = (name) => {
  let i = themes.indexOf(name);
  if (i < 0) i = themes.push(name) - 1;
  return i;
};

const packsDir = path.join(root, 'src', 'data', 'packs');
const seen = new Set();
const pool = [];
const packWords = new Map();
for (const f of fs.readdirSync(packsDir).sort()) {
  const pack = JSON.parse(fs.readFileSync(path.join(packsDir, f), 'utf8'));
  const words = [];
  for (const e of pack.entries ?? []) {
    if (typeof e.word !== 'string' || !/^[A-Z]+$/.test(e.word) || typeof e.clue !== 'string') continue;
    words.push(e.word);
    if (seen.has(e.word)) continue;
    seen.add(e.word);
    if (e.word.length < 3 || plain(e.clue).includes(e.word)) continue;
    if (!used.has(e.word)) pool.push({ w: e.word, c: e.clue, t: pack.name });
  }
  packWords.set(pack.name, [...new Set(words)]);
}

let a = 20261128 + prev.days.length;
const rand = () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (list) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};
shuffle(pool);

const days = [...prev.days];
let queue = pool;
while (queue.length >= PER_DAY) {
  const d = days.length;
  const banned = bannedOn(d);
  const today = [];
  const rest = [];
  for (const q of queue) (today.length < PER_DAY && !banned.has(q.w) ? today : rest).push(q);
  if (today.length < PER_DAY) break;
  queue = rest;
  days.push(
    today.map((q) => {
      // Erradas: do mesmo pacote, tamanho parecido (até 2 letras de diferença) quando dá; nunca as proibidas do dia.
      const cands = packWords.get(q.t).filter((w) => w !== q.w && !banned.has(w));
      const near = shuffle(cands.filter((w) => Math.abs(w.length - q.w.length) <= 2));
      const far = shuffle(cands.filter((w) => Math.abs(w.length - q.w.length) > 2));
      const wrong = [...near, ...far].slice(0, 3);
      if (wrong.length < 3) throw new Error(`pacote ${q.t} sem 3 erradas para ${q.w}`);
      return [q.w, q.c, themeIdx(q.t), wrong];
    }),
  );
}
fs.writeFileSync(out, JSON.stringify({ start: prev.start, themes, days }) + '\n', 'utf8');
console.log(`${days.length} dias (${days.length - prev.days.length} novos), ${days.length * PER_DAY} perguntas → ${out}`);
console.log(`sobraram ${queue.length} palavras para a próxima vez`);
