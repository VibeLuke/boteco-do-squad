---
name: boteco-regras-firebase
description: Muda, gera, confere e publica as regras do Firebase Realtime Database do Boteco do Squad (database.rules.molde.json, tests/mock-rules.mjs). Use quando pedirem "regra", "banco", "publicar regras", "campo novo no banco", "permission denied" ou "401/403".
---

# Regras do banco

## Como as regras são feitas

- A fonte é `database.rules.molde.json`. `npm run regras` troca `{{TURMA}}` pelos ids da turma e `{{ADMIN}}` pelo
  dono e grava `database.rules.json`. Nunca edite o gerado à mão.
- `tests/mock-rules.mjs` repete as mesmas regras em JavaScript para o banco falso e os testes. **Mude os dois juntos.**

## Passos

1. Mude o molde e o espelho.
2. `npm run regras`.
3. `npm test`: confere o contrato molde × espelho, o gerado × turma e os limites do console do Firebase (`^` só no
   começo, `$` só no fim, sem `(?...)`; o banco falso aceitaria, o console não).
4. Teste no banco falso (`npm run mock:firebase` + `npx vite --mode mocktest --port 5181`).
5. **Publique as regras antes do site**: cole `database.rules.json` no console (Realtime Database → Regras),
   publique, recarregue e confira que o texto publicado é o do arquivo (por exemplo, compare um hash do texto antes e
   depois de recarregar).

## Nunca

- Abrir `.write` genérico ou deixar apagar dados (só eventos com mais de uma hora podem sair).
- Afrouxar uma regra para "fazer passar": descubra que campo o cliente grava e acrescente só ele.
- Gravar no banco de outra pessoa para testar.

## Prova

A saída de `npm test` e, depois de publicar, a conferência do texto publicado.
