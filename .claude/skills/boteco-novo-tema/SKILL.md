---
name: boteco-novo-tema
description: Cria ou amplia um tema de palavras cruzadas do Boteco do Squad (src/data/packs/*.json). Use quando pedirem "tema de palavras", "pacote", "cruzada nova", "mais palavras" ou "dicas novas".
---

# Tema de palavras cruzadas

## Passos

1. Leia um tema parecido em `src/data/packs/` para pegar o tom das dicas.
2. Crie `src/data/packs/<id>.json` com `id`, `name`, `description`, `icon` (um nome do mapa `ICONS` de
   `src/components/ThemeIcon.tsx`), `color` (`#rrggbb`) e `entries`.
3. Cada entrada: `word` (A–Z sem acento, 3 a 16 letras), `display` (com acento; normalizado tem de dar `word`),
   `clue` (sem a resposta dentro) e `difficulty` 1, 2 ou 3. Mire em 50 a 70 palavras, com as três dificuldades.
4. Não há registro: `src/data/catalog.ts` lê a pasta sozinho.
5. Acrescente o id no fim da linha `validar-pacotes.mjs` do script `test` em `package.json`.

## Nunca

- Reescrever as palavras de um tema que já existe (muda os tabuleiros por semente). Prefira um tema novo.
- Repetir uma palavra que já está em outro tema (o validador reprova).
- Copiar dicas de dicionário, site ou livro: o conteúdo é publicado sob CC BY 4.0.

## Prova

```sh
node scripts/validar-pacotes.mjs <id>     # erros=0
npm test
```

Cite a linha `pacotes=… palavras=… erros=0` na entrega.
