---
name: boteco-novo-evento
description: Cria um evento do Bar Vivo do Boteco do Squad (algo que invade o bar numa época de 10 minutos). Use quando pedirem "evento", "bicho no bar", "invasão", "chefão no bar" ou "acontecimento no boteco".
---

# Evento do bar

## Passos

1. `src/vivo/eventos.ts`: o tipo **no fim** de `TIPOS_EVENTO` e a definição em `EVENTOS` (`nome`, `dura`,
   `telegrafo`, `peso`, `intervalo`, `quando?`, `trofeu`). O aviso (`telegrafo`) fica entre 20 e 60 s e
   `telegrafo + dura` cabe na época de 10 minutos.
2. Se o evento tem um bicho com vida, calcule rota e ataques só de `(semente, tempo)` e dos livros de dano, como
   `src/vivo/feras.ts` e `invasao.ts`. Nada de estado que só um aparelho conhece.
3. Regras (`database.rules.molde.json`): o tipo em `config/eventos/forcar/$epoca`, a entidade em
   `evento/$e/dano/$ent` e o troféu em `trofeus/$trofeu`. Espelho em `tests/mock-rules.mjs` (`TIPOS_EVENTO`,
   `ENTIDADES`, `TROFEUS`). `npm run regras`.
4. Textos de aviso e abertura e o desenho em `src/vivo/VivoScreen.tsx` (sem texto próprio, cai no do Apagão).

## Nunca

- Inserir no meio de `TIPOS_EVENTO` (a ordem conta no sorteio por peso e mudaria a agenda de todos).
- Esquecer a regra: nenhum teste liga `TIPOS_EVENTO` às regras, e o banco recusaria o dano em silêncio.

## Prova

```sh
npm test
```

Em `npm run dev`: `__vivo.forcarEvento('<tipo>')`, `__vivo.avancar(ms)` e `__vivo.irPara(...)` para ver aviso,
abertura e fim; tire capturas de cada fase.
