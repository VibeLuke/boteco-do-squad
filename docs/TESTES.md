# Testes

Precisa do **Node 24** (os testes e os scripts importam `.ts` direto, com a leitura nativa de TypeScript do Node; é a
versão que o CI usa).

## `npm test`

Roda, em sequência, cada arquivo `tests/*.test.mjs` e duas conferências: as regras do banco em dia com a turma
(`node scripts/gerar-regras.mjs --conferir`) e os temas de palavras (`node scripts/validar-pacotes.mjs` com 4 ids:
só erros desses temas reprovam; os dos outros aparecem como `avisos_antigos`). Para na primeira falha.

- Não há framework de teste: cada arquivo é um script com uma função `test()` própria e `node:assert/strict`.
- A saída mostra `ok - nome` ou `ok N - nome` por teste e um resumo por arquivo (`20 testes do bar passaram`, ou
  `# fatia 20: 11 testes`). Uma falha aparece como o erro do `assert` e encerra a cadeia.
- Os testes carregam o código de `src/` direto no Node (um gancho `registerHooks` resolve `import '../x'` para
  `../x.ts`). Por isso, no `src/`, importe arquivos, não pastas: `'../turma/index'`, nunca `'../turma'`.
- Cenários aleatórios usam `rng(semente)` de `tests/aleatorio.mjs`: o mesmo teste sorteia sempre igual.
- O teste do gerador mede tempo; numa máquina muito ocupada ele pode passar do limite. Rode de novo com a máquina
  livre antes de concluir que algo quebrou.

Um arquivo só: `node --import ./tests/turma-dos-testes.mjs tests/bar.test.mjs` (o `--import` prende o teste à turma
de exemplo; veja abaixo). O `tests/turma.test.mjs`, que confere a sua turma, roda sem ele.

## A turma dos testes

Os testes do jogo citam as pessoas pelo id. Eles foram escritos para a turma de exemplo, e
`tests/turma-dos-testes.mjs` (com o marcador `tests/turma-dos-testes.json`) faz cada um usar
`src/turma/turma.exemplo.ts` e as regras geradas dela, mesmo depois que você troca a turma em `turma.ts`. Por isso
não edite `turma.exemplo.ts`.

## Banco falso

`tests/mock-firebase.mjs` imita a API REST do Firebase (`GET`, `PUT`, `PATCH` e o `EventSource`) com as mesmas regras,
reescritas em `tests/mock-rules.mjs`. Recusa responde 401, como o de verdade. Desliga sozinho depois de 15 minutos.

Para jogar no navegador contra o banco falso:

```sh
npm run mock:firebase                       # porta 5180
```

Em outro terminal, crie `.env.mocktest.local` com a linha `VITE_FIREBASE_DB_URL=http://localhost:5180` (salve em
UTF-8; no PowerShell 5.1, não use `>` para isso) e rode:

```sh
npx vite --mode mocktest --port 5181
```

Abra duas abas anônimas em `http://localhost:5181` com pessoas diferentes para ver o bar ao vivo.

**Atenção:** o banco falso aceita algumas expressões regulares que o console do Firebase recusa. O teste
`tests/regras-firebase.test.mjs` confere o arquivo de verdade contra os limites do console (`^` só no começo, `$` só no
fim, sem `(?...)`).

## Ganchos no navegador (só em `npm run dev`)

Em desenvolvimento, cada tela expõe o seu estado em `window` para teste e captura: `__vivo` (o mundo do Bar Vivo,
`abrir`, `portal`, `rede`), `__moscas`, `__quermesse`, `__churrasco` e `__gfa` (com `avancar(ms, entrada)` e `foto()`).
No site publicado eles não existem.

## Teste de fumaça no navegador

```sh
npm run dev -- --port 5179
npm run fumaca:pw                           # em outro terminal
```

Abre o site com o Playwright, escolhe uma pessoa, entra no bar e confere o canvas, o gancho `__vivo`, pelo menos 10
corpos e nenhum erro de página. Só aceita endereço local (`localhost` ou `127.0.0.1`): num site publicado ele gravaria
no banco de verdade. Na primeira vez, o Playwright pede `npx playwright install chromium`.

## Teste de mutação

```sh
npm run mutacao                              # todos os grupos com npm test (demora)
node scripts/mutacao.mjs turma               # só um grupo
node scripts/mutacao.mjs turma "node tests/turma.test.mjs"   # com um comando mais curto
```

Cada entrada de `scripts/mutacao.mjs` planta um erro de propósito num arquivo (por exemplo, "a regra aceita qualquer
id"), roda os testes e espera que eles reprovem (`MORTA`). `ESCAPOU` quer dizer que os testes não pegam aquele erro;
`NÃO ACHEI`, que o trecho mudou e a entrada precisa ser atualizada.

- A ferramenta **reescreve arquivos do projeto** enquanto roda e devolve o original no fim (também com Ctrl+C).
  Faça commit antes; se o processo morrer à força, `git checkout` desfaz.
- Entrada que não muda o comportamento leva o prefixo `eq:` no texto e não reprova a rodada.

## Folhas visuais

`npm run sprites` gera a folha dos bonecos (SVG) e `node scripts/folha-bar.mjs` a das poses do bar (PNG). Use para
comparar antes e depois quando mexer em arte.
