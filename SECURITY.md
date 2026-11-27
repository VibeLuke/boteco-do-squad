# Segurança

## Versão com correções

Só a última versão do `main` recebe correções.

## O que é e o que não é segredo

- **A URL do banco (`VITE_FIREBASE_DB_URL`) não é segredo.** Ela vai dentro do site publicado, e qualquer pessoa pode
  vê-la. A proteção vem das regras do banco (`database.rules.json`), que dizem quem grava o quê, em que formato e com
  que ritmo.
- **Não há login.** Quem tem o link do site pode gravar dados que as regras aceitam, em nome de qualquer pessoa da
  turma. O jogo foi pensado para um grupo de amigos; para algo aberto ao público, acrescente autenticação (veja
  [`docs/FIREBASE.md`](docs/FIREBASE.md)).
- **Nunca ponha no repositório** chave de conta de serviço, token do Firebase CLI ou arquivo `.env.production` com
  dados de outra pessoa.

## Como reportar uma falha

Falha de segurança é, por exemplo, uma regra que deixa gravar fora do formato, apagar dados de outra pessoa ou escapar
do ritmo, ou um jeito de o site rodar código que não é dele.

1. **Não abra uma issue pública.**
2. Use a aba **Security → Report a vulnerability** deste repositório (aviso privado do GitHub: só quem mantém o
   projeto lê).
3. Conte o caminho do banco, o dado enviado e o que aconteceu. Se puder, mande o teste que mostra a falha no banco
   falso (`tests/mock-rules.mjs`).

Respondemos em até 7 dias. A correção entra nas regras e no espelho do banco falso, com um teste novo.
