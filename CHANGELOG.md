# Mudanças

Todas as mudanças que importam para quem usa o kit ficam aqui. O formato segue o
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [1.0.0] - 2026-11-27

Primeira versão aberta.

### Adicionado
- Palavras cruzadas com 22 temas, três dificuldades e trava contra repetir palavras já vistas.
- Placar sem login, por pessoa da turma, ao vivo pelo Firebase Realtime Database (ou só no aparelho, sem banco).
- Bar Vivo: o bar em pixel art com briga, poderes, sinuca, jukebox, mesa de jogos, eventos e NPCs.
- Portais de minijogos com rodízio diário, prêmios e moeda.
- Palavra do dia, quiz e anagramas.
- Turma configurável em `src/turma/turma.ts`, com regras do banco geradas por `npm run regras`.
- Turma de exemplo (fictícia): Vini, Will, Dani, Bia e Tati.
- Documentação: arquitetura, como expandir, Firebase, testes e o passo a passo em `kit/`.
