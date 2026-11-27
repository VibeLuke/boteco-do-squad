---
name: boteco-novo-microjogo
description: Cria um microjogo da Quermesse do Boteco do Squad (src/portais/quermesse/). Use quando pedirem "microjogo", "barraca", "Quermesse", "minijogo de poucos segundos" ou "chefe da Quermesse".
---

# Microjogo da Quermesse

## Passos

1. Leia `src/portais/quermesse/tipos.ts` (contrato `Micro<E>`) e copie um micro curto (`pesque.ts` ou `acerte.ts`)
   para `<id>.ts`.
2. Troque `id` (único), `verbo` (3 a 8 maiúsculas, o que aparece na tela), `nome` e `segundos`.
3. Implemente `iniciar`, `passo`, `resultado`, `pronto`, `bot` (a entrada perfeita), `resposta`, `tempo` e `desenhar`.
   Passo fixo `DT`; janela de acerto com `janela(vel)`; sorteio pelo `r` que o regente passa, nunca `Math.random`.
4. Registre em `src/portais/quermesse/regente.ts`: import e `MICROS` (ou `CHEFES`).

## Invariantes que o teste impõe

- até 230 linhas; o `bot` vence 100% e ficar parado perde 100% (100 sementes, 5 velocidades); apertar sempre perde;
- duração até 6 s (chefe 10 s), e no máximo metade disso na velocidade 2;
- janela média de 18 passos na velocidade 1 e 9 na velocidade 2 (±3);
- todo `.ts` da pasta é tratado como microjogo: arquivo auxiliar novo entra em `FORA` no teste.

## Prova

```sh
node --import ./tests/turma-dos-testes.mjs tests/quermesse.test.mjs
npm test
```

Em `npm run dev`, use `window.__quermesse` para ver o micro rodando e tire uma captura.
