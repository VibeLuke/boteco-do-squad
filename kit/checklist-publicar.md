# Checklist de publicação

Marque na ordem. Cada linha diz o que conferir.

## Antes

- [ ] `npm test` passou nesta máquina, com a sua turma em `src/turma/turma.ts`.
- [ ] `database.rules.json` foi gerado agora (`npm run regras`) e não foi editado à mão.
- [ ] `.env.production` tem `VITE_FIREBASE_DB_URL` do **seu** banco, e o arquivo não está no git (`git status` não o
      mostra).

## Banco

- [ ] As regras de `database.rules.json` foram coladas e publicadas no console (**Realtime Database → Regras**).
- [ ] Depois de recarregar a página do console, o texto publicado é o mesmo do arquivo.
- [ ] As regras vieram **antes** do site (passo seguinte).

## Site

- [ ] `npm run publicar` terminou com `Deploy complete!` e a `Hosting URL`.
- [ ] O site abre no celular e no computador.

## Ao vivo

- [ ] Em dois aparelhos, com pessoas diferentes: um vê o outro andando no bar.
- [ ] Uma cruzada terminada num aparelho aparece no placar do outro.
- [ ] O console do navegador (F12) não mostra `401` nem `403` nas gravações.

## Privacidade

- [ ] A turma combinou os nomes e os desenhos que vão no site.
- [ ] O link só foi passado para a turma (o site não aparece em buscador, mas abre para quem tem o link).
