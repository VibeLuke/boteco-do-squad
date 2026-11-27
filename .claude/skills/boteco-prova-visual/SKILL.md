---
name: boteco-prova-visual
description: Prova visual de mudanças de arte, tela ou colisão no Boteco do Squad (capturas antes e depois, medida de pixel). Use quando pedirem "folha", "captura", "conferir visual", "ficou bom?", ou ao mexer em sprites, cenário, efeitos ou caixa de colisão.
---

# Prova visual

## Passos

1. Antes de mexer, tire a captura "antes" no mesmo ponto em que vai tirar a "depois".
2. Rode `npm run dev` e use o gancho da tela em `window` para chegar ao quadro: `__vivo` (bar: `abrir`, `portal`,
   `forcarEvento`, `avancar`), `__moscas`, `__quermesse`, `__churrasco`, `__gfa` (`foto()` devolve a imagem).
3. Para bonecos e poses: `npm run sprites` (SVG) e `node scripts/folha-bar.mjs` (PNG das poses do bar).
4. Monte a folha: antes e depois lado a lado, com rótulo e os números que importam (tamanho em pixels, cor, posição).
5. **Colisão:** meça o desenho, não estime. Conte o topo e a largura em pixels no sprite e compare com a caixa da
   simulação (a altura em células × 16 px). Ponha um teste que leia os dois.

## Regras

- Olhe na escala do jogo, não só ampliado: um defeito que só aparece em close pesa menos que um que se vê jogando.
- Use a turma de exemplo nas capturas; nunca pessoas reais.
- Escreva o que não foi conferido (por exemplo, "não vi no celular").

## Prova

A folha anexada na entrega, com os números medidos.
