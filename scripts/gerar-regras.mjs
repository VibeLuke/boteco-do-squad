// Gera o database.rules.json a partir do molde e da turma (src/turma/turma.ts).
// Uso: `npm run regras` grava; `node scripts/gerar-regras.mjs --conferir` só confere (saída 1 se o arquivo estiver velho).
// No molde, {{TURMA}} vira "id1|id2|…" (os ids na ordem da turma) e {{ADMIN}} vira o id de quem mexe nos eventos.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TURMA } from '../src/turma/turma.ts';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOLDE = path.join(RAIZ, 'database.rules.molde.json');
const SAIDA = path.join(RAIZ, 'database.rules.json');

/** Confere a turma e devolve a lista de problemas (vazia = boa). */
export function problemasDaTurma(t) {
  const out = [];
  const ids = t.pessoas.map((p) => p.id);
  if (ids.length < 2 || ids.length > 5) out.push(`a turma tem ${ids.length} pessoas; precisa ter de 2 a 5`);
  for (const id of ids) if (!/^[a-z0-9]{2,16}$/.test(id)) out.push(`id "${id}": use de 2 a 16 letras minúsculas ou números`);
  for (const id of ids) if (/^bot[123]$/.test(id)) out.push(`id "${id}": reservado para os bots da sinuca`);
  if (new Set(ids).size !== ids.length) out.push('há id repetido na turma');
  if (!ids.includes(t.admin)) out.push(`admin "${t.admin}" não está na turma`);
  for (const p of t.pessoas) if (p.artigo !== 'do' && p.artigo !== 'da') out.push(`${p.id}: artigo deve ser "do" ou "da"`);
  return out;
}

export function gerar(molde, t) {
  return molde.replaceAll('{{TURMA}}', t.pessoas.map((p) => p.id).join('|')).replaceAll('{{ADMIN}}', t.admin);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const erros = problemasDaTurma(TURMA);
  if (erros.length) {
    for (const e of erros) console.error('turma: ' + e);
    process.exit(1);
  }
  const texto = gerar(fs.readFileSync(MOLDE, 'utf8'), TURMA);
  JSON.parse(texto);
  if (texto.includes('{{')) {
    console.error('sobrou marcador {{…}} no molde');
    process.exit(1);
  }
  const atual = fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, 'utf8') : '';
  if (process.argv.includes('--conferir')) {
    if (atual !== texto) {
      console.error('database.rules.json está diferente do que a turma gera: rode `npm run regras`');
      process.exit(1);
    }
    console.log('regras em dia com a turma');
  } else {
    fs.writeFileSync(SAIDA, texto);
    console.log(atual === texto ? 'regras já estavam em dia' : 'database.rules.json gerado; publique as regras antes do código');
  }
}
