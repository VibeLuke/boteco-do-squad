# AGENTS.md

Instruções para agentes de IA (Claude Code, Codex, Cursor e outros) que trabalham neste repositório. O jogo e a
documentação são em português do Brasil.

## Comandos

```sh
npm ci                                  # instalar
npm run dev                             # http://localhost:5173
npm test                                # suíte inteira (Node 24); para na 1ª falha
node tests/<arquivo>.test.mjs           # um arquivo (os do jogo: com --import ./tests/turma-dos-testes.mjs)
npm run build                           # tsc --noEmit + vite build
npm run regras                          # gera database.rules.json da turma
node scripts/validar-pacotes.mjs <id>   # valida um tema de palavras
node scripts/mutacao.mjs <grupo> "<comando>"   # teste de mutação (reescreve arquivos; faça commit antes)
```

## Mapa

- `src/turma/`: quem joga (única fonte). `src/engine/`: gerador de cruzadas. `src/data/`: conteúdo.
- `src/vivo/briga.ts`: motor do Bar Vivo (puro, passo fixo de 1/60 s, semente). `src/vivo/VivoScreen.tsx`: a tela
  (5.400 linhas; ponha lógica nova num arquivo puro ao lado).
- `src/bar/presence.ts`: toda a rede (REST + EventSource, sem SDK). `database.rules.molde.json`: as regras.
- `src/portais/`: portais do dia; `src/gfa/`: a Dimensão GFA.
- `tests/mock-rules.mjs`: espelho das regras em JavaScript para o banco falso e os testes.

Mais em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) e receitas em [`docs/COMO_EXPANDIR.md`](docs/COMO_EXPANDIR.md).

## Skills

Em `.claude/skills/` há um roteiro por tarefa comum, com passos, invariantes e a prova que encerra a entrega:
`boteco-novo-tema`, `boteco-novo-microjogo`, `boteco-novo-portal`, `boteco-novo-evento`, `boteco-regras-firebase`,
`boteco-prova-visual` e `boteco-mutacao`. Agentes que não leem skills podem abrir o `SKILL.md` direto.

## As 5 regras que nunca se quebram

1. **Regras antes do código.** Nada que grava campo novo vai ao ar antes de as regras do banco aceitarem.
2. **Listas que viajam pela rede só crescem no fim**, e listas por dia nunca mudam o que já existe.
3. **Semente, não acaso**, em toda simulação. `Math.random` só em desenho, som e efeito.
4. **LF e UTF-8 sem BOM** em todo arquivo de texto.
5. **Nunca grave no banco de outra pessoa.** Teste no banco falso (`npm run mock:firebase`) ou no seu.

## Armadilhas que já custaram caro

- **Molde e espelho:** mudar `database.rules.molde.json` sem mudar `tests/mock-rules.mjs` reprova os testes de
  contrato; o banco falso aceita regex que o console do Firebase recusa (`^` e `$` só nas pontas, sem `(?...)`).
- **Importe arquivo, não pasta,** em `src/`: `'../turma/index'`, não `'../turma'` (o carregador dos testes no Node não
  resolve pasta).
- **Desenho maior que a caixa de colisão:** confira o topo do desenho contra a altura da caixa (o chapéu atravessava
  o pterodáctilo).
- **Contagens fixas nos testes** (armas, poderes, dias): acrescentar algo reprova de propósito; atualize o número no
  mesmo commit.
- **Turma:** os testes do jogo rodam com a turma de exemplo (`tests/turma-dos-testes.mjs`); não edite
  `src/turma/turma.exemplo.ts` para "consertar" um teste.
- **Teste de tempo do gerador** pode falhar com a máquina ocupada; rode de novo antes de concluir que quebrou.

## Como entregar

- Rode `npm test` e `npm run build` e cite os números da saída (quantos testes, quais arquivos).
- Para mudança visual, gere uma captura (ganchos `__vivo`, `__quermesse`, `__churrasco`, `__moscas`, `__gfa` em
  `npm run dev`) e compare antes e depois.
- Diga o que ficou **não testado**.
