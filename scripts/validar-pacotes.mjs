// Valida os pacotes de palavras: forma, normalização, pista sem resposta, duplicatas e geração.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(spec, ctx, next) {
    if ((spec.startsWith('./') || spec.startsWith('../')) && !path.extname(spec) && ctx.parentURL) {
      const cand = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), `${spec}.ts`);
      if (fs.existsSync(cand)) return next(pathToFileURL(cand).href, ctx);
    }
    return next(spec, ctx);
  },
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { normalizeWord } = await import(pathToFileURL(path.join(root, 'src/engine/normalizer.ts')).href);
const { generateCrossword } = await import(pathToFileURL(path.join(root, 'src/engine/generator.ts')).href);

const dir = path.join(root, 'src/data/packs');
const only = process.argv.slice(2);
const packs = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
  .map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));

const errors = [];
const seen = new Map();
for (const p of packs) {
  for (const e of p.entries) {
    const w = e.word;
    if (normalizeWord(w) !== w) errors.push(`${p.file}: ${w} não está normalizada`);
    if (normalizeWord(e.display) !== w) errors.push(`${p.file}: display "${e.display}" ≠ ${w}`);
    if (w.length < 3 || w.length > 16) errors.push(`${p.file}: ${w} tamanho ${w.length}`);
    if (![1, 2, 3].includes(e.difficulty)) errors.push(`${p.file}: ${w} dificuldade inválida`);
    if (normalizeWord(e.clue).includes(w)) errors.push(`${p.file}: pista de ${w} contém a resposta`);
    if (seen.has(w)) errors.push(`duplicada ${w}: ${seen.get(w)} e ${p.file}`);
    else seen.set(w, p.file);
  }
}

const targets = only.length ? packs.filter((p) => only.includes(p.id)) : packs;
let gens = 0;
for (const p of targets) {
  for (const difficulty of ['easy', 'medium', 'hard']) {
    for (let i = 0; i < 12; i++) {
      try {
        const pz = generateCrossword({ entries: p.entries, difficulty, themeId: p.id, themeName: p.name, seed: `T${i}${difficulty}` });
        if (!pz.words.length) errors.push(`${p.id}/${difficulty}/T${i}: sem palavras`);
        gens++;
      } catch (err) {
        errors.push(`${p.id}/${difficulty}/T${i}: ${err.message}`);
      }
    }
  }
}
// Com pacotes indicados, só os problemas que envolvem esses pacotes reprovam; o resto vira aviso.
const mine = (e) => !only.length || targets.some((p) => e.includes(p.file) || e.startsWith(p.id + '/'));
const fail = errors.filter(mine);
const warn = errors.filter((e) => !mine(e));
console.log(`pacotes=${packs.length} palavras=${seen.size} geracoes=${gens} erros=${fail.length} avisos_antigos=${warn.length}`);
for (const e of fail) console.log(' ERRO ' + e);
process.exit(fail.length ? 1 : 0);
