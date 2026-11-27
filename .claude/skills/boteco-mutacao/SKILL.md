---
name: boteco-mutacao
description: Teste de mutação do Boteco do Squad (scripts/mutacao.mjs): confere se os testes pegam erros plantados de propósito. Use quando perguntarem "os testes pegam isso?", "mutação", "o teste vale?" ou depois de escrever testes novos para uma regra ou simulação.
---

# Teste de mutação

## Como funciona

Cada entrada de `scripts/mutacao.mjs` é `[arquivo, trecho original, trecho com o erro, o que quebra]`. A ferramenta
troca o trecho, roda o comando de teste e espera que ele reprove (`MORTA`). `ESCAPOU` = os testes não pegam aquele erro.
`NÃO ACHEI` = o trecho original mudou e a entrada precisa ser atualizada. Prefixo `eq:` marca uma mutação que não muda
o comportamento.

## Passos

1. **Faça commit antes.** A ferramenta reescreve arquivos do projeto e devolve no fim (também com Ctrl+C); se o
   processo morrer à força, `git checkout -- .` desfaz.
2. Acrescente entradas para o que você mudou: o erro mais provável (limite trocado, condição invertida, linha apagada).
3. Rode o grupo com um comando curto primeiro e com a suíte inteira no fim:

   ```sh
   node scripts/mutacao.mjs <grupo> "node --import ./tests/turma-dos-testes.mjs tests/<arquivo>.test.mjs"
   node scripts/mutacao.mjs <grupo>
   ```

4. Para cada `ESCAPOU`: escreva o teste que pega e rode de novo. Teste o teste nos dois sentidos: passa no código
   certo e reprova com o erro plantado.

## Prova

A linha final `N/M mutações mortas` na entrega, com a lista do que escapou e por quê.
