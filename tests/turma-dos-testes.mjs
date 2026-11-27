// Pré-carregado em cada teste do jogo (`node --import ./tests/turma-dos-testes.mjs ...`, ver package.json).
//
// Os testes do jogo citam as pessoas da turma pelo id (quem bate em quem, quem senta onde). No kit aberto eles foram
// escritos para a turma de exemplo. Quando o arquivo tests/turma-dos-testes.json diz {"turma": "exemplo"}, este
// arquivo faz esses testes rodarem sempre contra src/turma/turma.exemplo.ts e contra as regras geradas dela, mesmo
// depois que você troca a sua turma em src/turma/turma.ts. Assim o `npm test` continua valendo para a sua turma.
//
// O que confere a SUA turma (tests/turma.test.mjs e `gerar-regras --conferir`) roda sem este arquivo.
// Sem o .json (ou com outro valor), não faz nada: os testes usam a turma de turma.ts.
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MARCADOR = path.join(RAIZ, 'tests', 'turma-dos-testes.json');
const marcador = fs.existsSync(MARCADOR) ? JSON.parse(fs.readFileSync(MARCADOR, 'utf8')) : null;

if (marcador?.turma === 'exemplo') {
  const real = pathToFileURL(path.join(RAIZ, 'src', 'turma', 'turma.ts')).href;
  const exemplo = pathToFileURL(path.join(RAIZ, 'src', 'turma', 'turma.exemplo.ts')).href;
  registerHooks({
    resolve(spec, ctx, next) {
      const r = next(spec, ctx);
      return r.url === real ? { ...r, url: exemplo } : r;
    },
  });

  // As regras que os testes leem do disco são as da turma de exemplo, geradas na hora do mesmo molde.
  const { TURMA } = await import(exemplo);
  const regrasPath = path.join(RAIZ, 'database.rules.json');
  const regras = fs
    .readFileSync(path.join(RAIZ, 'database.rules.molde.json'), 'utf8')
    .replaceAll('{{TURMA}}', TURMA.pessoas.map((p) => p.id).join('|'))
    .replaceAll('{{ADMIN}}', TURMA.admin);
  const original = fs.readFileSync;
  const alvo = (p) => {
    try {
      const s = p instanceof URL ? fileURLToPath(p) : typeof p === 'string' && p.startsWith('file:') ? fileURLToPath(p) : p;
      return typeof s === 'string' && path.resolve(s) === regrasPath;
    } catch {
      return false;
    }
  };
  fs.readFileSync = function (p, opcoes) {
    if (!alvo(p)) return original.apply(this, arguments);
    const enc = typeof opcoes === 'string' ? opcoes : opcoes?.encoding;
    return enc ? regras : Buffer.from(regras, 'utf8');
  };
  syncBuiltinESMExports();
}
