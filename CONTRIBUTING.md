# Como contribuir

Obrigado por querer melhorar o boteco. Tema de palavras, microjogo, evento, conserto ou documentação: tudo é bem-vindo.

## Rodar e testar

```sh
npm ci
npm run dev
npm test
npm run build
```

Detalhes (banco falso, ganchos de teste, mutação, fumaça no navegador) em [`docs/TESTES.md`](docs/TESTES.md).

## Antes de começar

- Para algo grande (portal, evento, mudança na rede), abra uma issue com o formulário "Ideia de minijogo, portal ou
  evento" e combine antes de programar.
- Cada tipo de coisa nova tem uma receita em [`docs/COMO_EXPANDIR.md`](docs/COMO_EXPANDIR.md), com os arquivos, os
  testes e as armadilhas.

## Regras da casa

1. **Arquivos em LF e UTF-8 sem BOM.** No Windows, cuidado com editores e com o `>` do PowerShell 5.1 (grava em
   UTF-16).
2. **Listas que viajam pela rede só crescem no fim** (portais, prêmios, cores, faixas, eventos) e as listas por dia
   (palavra do dia, quiz, anagramas) nunca mudam o que já existe.
3. **Simulação com semente.** Nada de `Math.random` em lógica de jogo; só em desenho, som e efeito.
4. **Molde das regras e espelho juntos.** Mudou `database.rules.molde.json`, mude `tests/mock-rules.mjs` e rode
   `npm run regras`.
5. **Nenhuma pessoa real.** Use a turma de exemplo nos testes e nas capturas. Não ponha nome, foto ou dado pessoal de
   ninguém em issue, PR ou conteúdo.
6. **Conteúdo seu:** dicas e textos que você escreveu (não copiados de outro site ou livro), publicados sob CC BY 4.0.

## O que um pull request precisa ter

- testes passando (`npm test`) e build passando (`npm run build`);
- um teste novo para o que mudou;
- se mexeu em arte ou tela: uma captura de antes e depois;
- se mexeu no banco: o molde, o espelho e as regras geradas;
- uma linha **"Não testado"** com o que você não conseguiu rodar (ou "nada").

O modelo de PR já traz essa lista.

## Código de conduta

Todo espaço do projeto segue o [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Falhas de segurança vão pelo caminho de
[`SECURITY.md`](SECURITY.md), não por issue pública.
