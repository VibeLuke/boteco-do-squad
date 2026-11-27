# Boteco do Squad

[![Testes e build](../../actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)
[![Código: MIT](https://img.shields.io/badge/c%C3%B3digo-MIT-blue)](LICENSE)
[![Conteúdo: CC BY 4.0](https://img.shields.io/badge/conte%C3%BAdo-CC%20BY%204.0-lightgrey)](LICENSE-CONTEUDO.md)

Um boteco em pixel art para uma turma de amigos: palavras cruzadas com placar entre vocês, um bar ao vivo onde todo
mundo anda, briga, joga sinuca e escolhe a música, eventos que invadem o bar e minijogos novos a cada dia. Roda no
navegador, sem login e sem servidor próprio: o placar e o bar ao vivo usam o plano gratuito do Firebase, e sem ele o
jogo funciona só no aparelho.

Este repositório é um **kit**: ele vem com uma turma fictícia (Vini, Will, Dani, Bia e Tati) para você trocar pela
sua.

**[▶ Jogar a demo](https://vibeluke.github.io/boteco-do-squad/)**: a versão sem banco, com a turma de exemplo. O
placar fica no seu aparelho e o bar é só seu; nada é gravado em servidor.

## O que tem

- **Palavras cruzadas:** 22 temas e 1.356 palavras diferentes, três dificuldades, tabuleiro por código
  compartilhável e uma trava que evita repetir palavras que você já viu.
- **Placar da turma**, sem login: cada pessoa escolhe o seu boneco e joga.
- **Bar Vivo:** o bar em visão isométrica, ao vivo entre os aparelhos. Briga de desenho animado com armas e poderes,
  sinuca contra bots, jukebox, mesa de porrinha, rádio, NPCs com rotina e memória, e eventos (ratazana, apagão,
  alienígena, dragão, dinossauro).
- **Portais do dia:** um minijogo por dia, em rodízio (Moscaria, Quermesse Maluca e Churrasco Jurássico), com
  prêmios para o visual do boneco. E a Dimensão GFA, uma corrida em 3D que o Rocky abre no bar.
- **Palavra do dia, quiz e anagramas**, iguais para a turma toda.

## Rodar

Precisa do [Node 24](https://nodejs.org).

```sh
npm ci
npm run dev       # http://localhost:5173
npm test          # 463 testes
```

## Faça o boteco da sua turma

O passo a passo está em [`kit/LEIA-ME.md`](kit/LEIA-ME.md): pôr a turma, criar o banco, publicar e conferir.

## Documentação

| Para | Leia |
|---|---|
| entender como o jogo é feito | [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) |
| criar temas, microjogos, portais, eventos, armas, NPCs | [`docs/COMO_EXPANDIR.md`](docs/COMO_EXPANDIR.md) |
| banco, regras e publicação | [`docs/FIREBASE.md`](docs/FIREBASE.md) |
| testes, banco falso, mutação | [`docs/TESTES.md`](docs/TESTES.md) |
| saber o que o jogo mostra (violência, sangue, bebida) | [`docs/CONTEUDO.md`](docs/CONTEUDO.md) |
| contribuir | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| programar com agentes de IA | [`AGENTS.md`](AGENTS.md) |

## Licenças

- **Código:** [MIT](LICENSE).
- **Conteúdo** (palavras, dicas, perguntas e anagramas, as falas dos NPCs e os textos da mesa e do rádio):
  [CC BY 4.0](LICENSE-CONTEUDO.md).
- Bibliotecas, fontes e paletas de terceiros: [`CREDITS.md`](CREDITS.md).

O jogo tem humor adulto de boteco: veja [`docs/CONTEUDO.md`](docs/CONTEUDO.md) antes de publicar para outras pessoas.
