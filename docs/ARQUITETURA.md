# Arquitetura

O Boteco do Squad é um site estático (React + Vite + TypeScript). Ele não tem servidor próprio: quando há banco, ele
conversa direto com o Firebase Realtime Database pela API REST, e as regras do banco fazem o papel de servidor.

## O princípio

**A simulação é pura e a tela só desenha.** Briga, portais, eventos e cruzadas são funções sobre um estado, com passo
fixo e sorteio por semente. O que vale para isso:

- tudo roda igual no Node, sem navegador, e é assim que os testes funcionam;
- dois aparelhos com o mesmo relógio e a mesma semente veem o mesmo evento, a mesma rota do dragão e o mesmo
  portal do dia, sem servidor para combinar;
- `Math.random` só aparece em desenho, som e efeito, e para criar uma semente nova (o código de um tabuleiro novo),
  nunca dentro da simulação.

```text
 navegador                                                   Firebase Realtime Database
┌──────────────────────────────────────────────────────┐    ┌───────────────────────────────┐
│ App.tsx ── escolhe: Studio · GameScreen · VivoScreen │    │ cruzadabotecos/v1/scores/...  │
│                                                      │    │ cruzadabotecos/bar/...        │
│  telas (components/, vivo/VivoScreen.tsx, portais/)  │    │ (database.rules.json decide   │
│        │ desenha                    ▲ estado         │    │  quem grava o quê e quando)   │
│        ▼                            │                │    └──────────────▲────────────────┘
│  simulação pura (engine/, vivo/briga.ts, portais/*/  │                   │ PUT / PATCH (grava)
│  sim.ts, gfa/simulacao.ts) ── semente + passo fixo   │                   │ EventSource (recebe ao vivo)
│        ▲                                             │                   │
│        │ entradas da rede     arena/scoreStore.ts ───┼───────────────────┤
│        └──────────────────── bar/presence.ts ────────┼───────────────────┘
└──────────────────────────────────────────────────────┘
   sem VITE_FIREBASE_DB_URL: placar no localStorage, bar sozinho no aparelho
```

## As pastas de `src/`

| Pasta | O que mora lá | Arquivos para começar |
|---|---|---|
| `turma/` | quem joga: a única lista de pessoas | `turma.ts` (dados), `index.ts` (ids, regex, dono derivados), `turma.exemplo.ts` |
| `engine/` | o gerador de palavras cruzadas, sem React | `generator.ts` (`generateCrossword`, semente `LEX-XXXX`), `difficulty.ts`, `normalizer.ts` |
| `data/` | conteúdo: temas, palavra do dia, quiz, anagramas | `catalog.ts` (lê `packs/*.json` sozinho), `packs/`, `palavras-do-dia.json`, `quiz.json`, `anagramas.json` |
| `utils/` | liga o gerador à tela das cruzadas | `buildPuzzle.ts`, `useGame.ts`, `scoring.ts`, `storage.ts` |
| `components/` | a interface das cruzadas | `Studio.tsx` (início), `GameScreen.tsx`, `Grid.tsx`, `CluesPanel.tsx` |
| `arena/` | o placar e os bonecos | `scoreStore.ts` (placar), `sprites.ts` (bonecos desenhados em código, grade 24×34), `history.ts` |
| `bar/` | peças do bar: conexão ao vivo, mapa isométrico, painéis | `presence.ts` (toda a rede do bar), `music.ts` (jukebox), `room.ts`, `path.ts`, `DailyPanel.tsx` |
| `vivo/` | o Bar Vivo, o jogo principal | `briga.ts` (motor), `rede.ts`, `eventos.ts`, `VivoScreen.tsx` (a tela) |
| `portais/` | os minijogos do dia | `portal.ts` (rodízio, prêmios, moeda), uma pasta por portal |
| `gfa/` | a Dimensão GFA, portal em 3D | `simulacao.ts` (pura), `GfaTela.tsx` (three.js, carregado só quando abre) |
| `types/` | tipos das cruzadas | `crossword.ts` |

## As partes do jogo

### Palavras cruzadas
- `generateCrossword` (`src/engine/generator.ts`) monta o tabuleiro a partir de `semente::dificuldade::tema`. O mesmo
  código de tabuleiro dá sempre o mesmo tabuleiro, e é isso que o link `#CÓDIGO` compartilha.
- **Trava contra repetição:** o placar guarda o código de cada tabuleiro pontuado. Como o gerador é determinístico,
  `seenWords` (`src/arena/history.ts`) remonta as palavras que a pessoa já viu, e `freshPuzzle`
  (`src/arena/boardWords.ts`) sorteia alguns tabuleiros candidatos e fica com o que repete menos. Palavra repetida vale
  0 ponto (`src/utils/scoring.ts`), e um tabuleiro já pontuado abre em modo treino (`decideScoring`).

### Placar
- `src/arena/scoreStore.ts` guarda `cruzadabotecos/v1/scores/{pessoa}/{tabuleiro}` = `{ s, t }`. A pontuação só sobe
  (regra do banco).
- Sem banco, o placar fica no `localStorage` e passa entre abas; `exportCode` e `importCode` levam para outro aparelho.

### Bar Vivo
- **Motor:** `src/vivo/briga.ts`. Passo fixo de 1/60 s (`DT`), até 8 subpassos por quadro (`rodarQuadro`), sorteio por
  `sorteia(m)` sobre `m.semente`. Armas em `ARMAS`, poderes em `poderes.ts`, NPCs em `gente.ts`.
- **Rede:** `src/vivo/rede.ts` é o lado puro (o que enviar, o que aceitar); `src/bar/presence.ts` faz a conexão. Cada
  pessoa grava a própria posição em `bar/vivo/{pessoa}` e os golpes em `bar/vgolpe/{pessoa}/{0..9}`; todos recebem
  tudo por um único `EventSource` em `cruzadabotecos/bar.json`.
- **Eventos:** `src/vivo/eventos.ts` divide o tempo em épocas de 10 minutos e decide, só pelo relógio do servidor, se
  há evento (ratazana, apagão, alienígena, dragão, dinossauro). `feras.ts` e `invasao.ts` calculam dragão, dinossauro
  e alienígena a partir de `(semente, tempo)` e dos livros de dano gravados no banco.
- **Mesa e rádio:** `mesa.ts` (porrinha, narrador, mural de boatos). **Memória dos NPCs:** `memoria.ts`, só no
  aparelho.
- **Tela:** `VivoScreen.tsx` (cerca de 5.400 linhas) desenha tudo num canvas e abre os portais sob demanda (`lazy`).
  É o arquivo mais difícil de mexer; prefira pôr lógica nova num arquivo puro ao lado e só chamá-la daqui.

### Portais
- `src/portais/portal.ts` escolhe o portal do dia (`portalDoDia`, por `PORTAIS_DO_DIA`), a semente do dia, o sorteio
  de prêmios com raridade e "pity", e a moeda de cada portal.
- Cada portal tem a sua pasta, com a simulação pura separada da tela: `moscas/` e `churrasco/` têm um `sim.ts`; a
  `quermesse/` tem um arquivo por microjogo, encadeados por `regente.ts`.
- A Dimensão GFA (`src/gfa/`) não entra no rodízio do dia: é o portal do Rocky, aberto por um modal do Bar Vivo.
- Prêmios ficam em `bar/inventario/{pessoa}/{item}` e só se ganham, nunca se perdem.

## O banco

As regras (`database.rules.json`) são geradas de `database.rules.molde.json` pela turma (`npm run regras`) e fecham
tudo por padrão: a raiz não lê nem grava, e cada nó diz o formato exato, o ritmo máximo e quem pode gravar. Ninguém
apaga nada (a única exceção são os eventos antigos). Detalhes em [`FIREBASE.md`](FIREBASE.md).

O banco falso dos testes (`tests/mock-firebase.mjs`) aplica as mesmas regras, escritas de novo em JavaScript em
`tests/mock-rules.mjs`. **Toda mudança no molde tem de ser repetida no espelho**, e há testes que conferem os dois.

## Onde mexer com cuidado

- **Listas que viajam pela rede** (portais, prêmios, cores dos bonecos, faixas, eventos): a posição é o que vai para o
  banco. Acrescente só no fim.
- **Listas congeladas por dia** (palavra do dia, quiz, anagramas): a posição é o dia. Acrescente só no fim.
- **Regras antes do código:** ao publicar algo que grava um campo novo, publique as regras primeiro, senão o banco
  recusa e o bar se cala sozinho depois de 5 recusas seguidas.
