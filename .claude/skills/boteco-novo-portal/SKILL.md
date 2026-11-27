---
name: boteco-novo-portal
description: Cria um portal (minijogo do dia) no Boteco do Squad, do sim.ts à tela, prêmios, regras e testes. Use quando pedirem "portal novo", "minijogo do dia", "minijogo do Rocky" ou "jogo novo no rodízio".
---

# Portal novo

Modelo: `src/portais/churrasco/` (`sim.ts` + `ChurrascoTela.tsx`) e `tests/fatia20.test.mjs`. A receita completa está
em `docs/COMO_EXPANDIR.md`, seção 4. Siga o checklist na ordem e marque cada item na entrega.

## Checklist

1. `src/portais/<id>/sim.ts`: simulação pura, `DT = 1/60`, pista por semente, `pontosDe`, `VERSAO`.
2. `src/portais/portal.ts`: `IdPortal`, **fim** de `PORTAIS_DO_DIA`, `NOME_PORTAL`, `LIMIAR_SORTEIO`,
   `VERSAO_PORTAL` e um ramo em `moedaDoPortal`.
3. Prêmios em `PREMIOS` com prefixo próprio; cores **no fim** de `CAMISAS`/`CALCAS`/`CABELOS` (`src/vivo/visual.ts`),
   no máximo 36 por lista.
4. `database.rules.molde.json`: o portal em `portais/$portal` e os ids em `inventario/$player/$item` (ordem de
   `PREMIOS`); espelho em `tests/mock-rules.mjs` (`PORTAIS`, `ITENS_PORTAL`); `npm run regras`.
5. `src/bar/presence.ts` (`placarRaw`, `sendPlacar`) e `PORTAL_NOME` em `src/vivo/interacoes.ts`.
6. A tela, com `if (import.meta.env.DEV) window.__<id> = …`, e a ligação em `VivoScreen.tsx` (`lazy`, `placarHoje`,
   `fimDoPortal`, textos do Rocky e da moeda, bloco `portalAberto === '<id>'`).
7. `tests/<id>.test.mjs` no script `test` (com `--import ./tests/turma-dos-testes.mjs`): mesma semente, mesma pista;
   robô vence toda pista sem dano; parado perde.
8. **Desenho igual à caixa de colisão:** meça o topo do desenho em pixels e confira contra a altura da caixa. (No
   churrasco, o chapéu atravessava o pterodáctilo porque a caixa era menor que o desenho.)
9. Atualize os testes que fixam a lista de portais (`quermesse.test.mjs`, `fatia20.test.mjs`) e as entradas de
   `scripts/mutacao.mjs` que passarem a dizer `NÃO ACHEI`.

## Avise na entrega

Acrescentar um portal muda a agenda inteira de `portalDoDia` (o rodízio é em blocos do tamanho da lista): todo mundo
passa a ver outro portal no mesmo dia. Publique as regras antes do site.

## Prova

```sh
npm test
npm run build
node scripts/mutacao.mjs fatia20 "npm test"   # as entradas do portal-modelo continuam MORTA
```

Captura da tela do portal em `npm run dev` (gancho `__<id>`).
