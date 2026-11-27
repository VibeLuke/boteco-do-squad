# Como expandir

Uma receita por tipo de coisa nova. Cada uma diz os arquivos, o teste que cobre e a armadilha que o código impõe.
Antes de qualquer uma, leia as [regras que valem para tudo](#regras-que-valem-para-tudo) no fim.

Os testes que contam quantidades fixas (34 armas, 11 poderes, 204 dias de anagrama…) **vão reprovar de propósito**
quando você acrescentar algo. Isso é esperado: atualize o número no teste junto com a mudança, no mesmo commit.

## 1. Tema de palavras cruzadas

1. Crie `src/data/packs/<id>.json`:

   ```json
   {
     "id": "boteco",
     "name": "Boteco",
     "description": "Petiscos, jogos de mesa e a última rodada",
     "icon": "ChefHat",
     "color": "#f77622",
     "entries": [
       { "word": "SAIDEIRA", "display": "Saideira", "clue": "A última rodada antes de ir embora", "difficulty": 1 },
       { "word": "TORRESMO", "display": "Torresmo", "clue": "Pele de porco frita até estalar", "difficulty": 1 }
     ]
   }
   ```

   - `word`: só A–Z, sem acento, de 3 a 16 letras. `display`: como aparece (pode ter acento), e normalizado tem de dar
     `word`.
   - `difficulty`: 1, 2 ou 3. O fácil usa palavras até 10 letras; o médio, até 13; o difícil, até 16.
   - `icon`: um nome de ícone do Lucide que esteja no mapa `ICONS` de `src/components/ThemeIcon.tsx` (`Atom`,
     `ChefHat`, `Gamepad2`, `Music`, `Trophy`…). Nome desconhecido vira um ícone genérico; para um novo, importe-o do
     `lucide-react` e acrescente ao mapa.
   - Os temas atuais têm de 57 a 71 palavras. Com menos de umas 30, o difícil (15 a 22 palavras por tabuleiro) fica
     repetitivo.
2. **Não há registro:** `src/data/catalog.ts` lê todo `packs/*.json` sozinho, e o tema entra também no "Misto".
3. Valide: `node scripts/validar-pacotes.mjs boteco`. Reprova palavra mal normalizada, tamanho fora de 3–16,
   dificuldade inválida, dica que contém a resposta e **palavra repetida em outro tema**. Depois gera 36 tabuleiros do
   tema.
4. Para o `npm test` validar o tema novo sempre, acrescente o id ao fim da linha `validar-pacotes.mjs` do script `test`
   em `package.json`.

**Armadilha:** mudar as palavras de um tema **que já existe** muda os tabuleiros gerados daquele tema (o código do
tabuleiro é semente sobre a lista). Placar antigo continua valendo, mas a trava contra repetição passa a remontar
palavras diferentes. Prefira um tema novo a reescrever um antigo.

## 2. Palavra do dia, quiz e anagramas

As três listas (`src/data/palavras-do-dia.json`, `quiz.json`, `anagramas.json`) começam no dia `start` (20783 =
26/11/2026) e **a posição é o dia**: o dia de hoje é `(dia − start) mod tamanho`. O dia vira às 6h de Brasília.

- Para acrescentar dias: `node scripts/gerar-palavras-do-dia.mjs --acrescentar` (e `gerar-anagramas.mjs`,
  `gerar-quiz.mjs`). Sem `--acrescentar`, os scripts se recusam a refazer ("já existe (congelada)").
- Os geradores tiram palavras dos temas, sem repetir no mesmo dia a Palavra do Dia, os 5 anagramas e as respostas do
  quiz.
- **Nunca edite nem reordene o que já está lá**: mudaria o dia de hoje para todo mundo.
- **Armadilha:** `tests/jukebox.test.mjs` fixa 204 dias de anagrama e `tests/sinuca.test.mjs` fixa 135 dias de quiz
  (e as contagens derivadas). Atualize os números depois de acrescentar.

## 3. Microjogo da Quermesse

A Quermesse encadeia microjogos de poucos segundos que aceleram (`src/portais/quermesse/regente.ts`).

1. Copie um microjogo curto, como `src/portais/quermesse/pesque.ts` (108 linhas) ou `acerte.ts`, para `<id>.ts` e troque `id`, `verbo` (de 3 a 8
   letras maiúsculas, é o que aparece na tela), `nome` e `segundos`.
2. Implemente o contrato `Micro<E>` de `tipos.ts`: `iniciar`, `passo`, `resultado` (`'andando' | 'ganhou' |
   'perdeu'`), `pronto`, `bot` (a entrada perfeita), `resposta`, `tempo` e `desenhar`. Use `janela(vel)` para a janela
   de acerto e `DT` (1/60 s) como passo.
3. Registre em `regente.ts`: acrescente o import e ponha o micro em `MICROS` (ou em `CHEFES`, se for chefe).
4. `node --import ./tests/turma-dos-testes.mjs tests/quermesse.test.mjs`. O teste de conformidade importa **todo** `.ts` da pasta e exige, para cada um:
   - campos do contrato, `verbo` válido, `id` único, presença no `CATALOGO`, no máximo 230 linhas;
   - o `bot` vence 100% e ficar parado perde 100% (100 sementes, em 5 velocidades); apertar sempre perde;
   - duração de até 6 s (chefe 10 s) e janela média de 18 passos na velocidade 1.

**Armadilha:** qualquer `.ts` auxiliar novo nessa pasta é tratado como microjogo. Se precisar de um, ponha o nome dele
no conjunto `FORA` de `tests/quermesse.test.mjs`.

## 4. Portal novo

É a receita mais longa. Use o `churrasco` como modelo (`src/portais/churrasco/sim.ts` e `ChurrascoTela.tsx`).

1. **Simulação pura** em `src/portais/<id>/sim.ts`: passo fixo (`DT = 1/60`), pista por semente, `pontosDe`, e uma
   constante `VERSAO`.
2. **`src/portais/portal.ts`:** acrescente o id em `IdPortal` e **no fim** de `PORTAIS_DO_DIA`; preencha
   `NOME_PORTAL`, `LIMIAR_SORTEIO` e `VERSAO_PORTAL` (o TypeScript exige); dê um ramo próprio em `moedaDoPortal` (sem
   ele, o portal cai na fórmula da Moscaria).
3. **Prêmios:** acrescente em `PREMIOS`, com prefixo próprio (`mc-`, `qm-`, `ch-`…). Cores novas vão **no fim** de
   `CAMISAS`, `CALCAS` ou `CABELOS` (`src/vivo/visual.ts`), com no máximo 36 itens por lista (o código do visual usa
   um caractere em base 36 por item).
4. **Regras e espelho:** em `database.rules.molde.json`, ponha o portal na regex de `portais/$portal` e os ids novos
   na lista de `inventario/$player/$item`, na mesma ordem de `PREMIOS`. Repita em `tests/mock-rules.mjs`
   (`PORTAIS` e `ITENS_PORTAL`). Rode `npm run regras`.
5. **Tipos soltos que o compilador não pega:** `src/bar/presence.ts` (`placarRaw` e `sendPlacar` listam os portais) e
   `PORTAL_NOME` em `src/vivo/interacoes.ts`.
6. **A tela** `src/portais/<id>/<Id>Tela.tsx`, com o gancho de teste só em desenvolvimento
   (`if (import.meta.env.DEV) window.__<id> = …`), e a ligação em `src/vivo/VivoScreen.tsx`: o `lazy` da tela, o
   `placarHoje`, o `fimDoPortal`, os textos do Rocky e da moeda (sem texto próprio, cai no da Quermesse) e o bloco
   `portalAberto === '<id>'`.
7. **Testes** (um arquivo novo `tests/<id>.test.mjs`, acrescentado ao script `test` do `package.json`, com o
   `--import ./tests/turma-dos-testes.mjs` dos outros):
   - mesma semente, mesma pista;
   - um robô vence toda pista sorteada sem dano;
   - parado perde;
   - **o desenho cabe na caixa de colisão.** No churrasco, o chapéu do cozinheiro atravessava o pterodáctilo porque a
     caixa (`ALT`) era menor que o desenho; o teste lê o topo do desenho e confere `ALT * 16 >= topo`.

**Armadilhas:**
- Acrescentar um portal muda a agenda inteira de `portalDoDia` (com 3 ou mais portais, o rodízio é em blocos
  embaralhados do tamanho da lista), não só o fim. Todo mundo passa a ver outro portal no mesmo dia, ao mesmo tempo.
- Testes que fixam a lista de portais: `tests/quermesse.test.mjs` (lista do dia, regex das regras, `juntar().ultima`) e
  `tests/fatia20.test.mjs`. O teste das cores do churrasco exige que elas sejam as últimas de cada lista: ao pôr cores
  de outro portal depois, atualize esse teste.
- `scripts/mutacao.mjs` tem trechos literais de `PORTAIS_DO_DIA` e da regex: atualize as entradas que passarem a dizer
  `NÃO ACHEI`.

## 5. Evento do bar

1. `src/vivo/eventos.ts`: o tipo **no fim** de `TIPOS_EVENTO` (a ordem conta no sorteio por peso) e a definição em
   `EVENTOS` (`nome`, `dura`, `telegrafo`, `peso`, `intervalo`, `quando?`, `trofeu`). Aviso (`telegrafo`) entre 20 e
   60 s, e `telegrafo + dura` cabendo na época de 10 minutos.
2. Regras: o tipo na regex de `config/eventos/forcar/$epoca`; se o evento tem um bicho que leva dano, a entidade na
   regex de `evento/$e/dano/$ent`; o troféu em `trofeus/$trofeu`. Espelho em `tests/mock-rules.mjs` (`TIPOS_EVENTO`,
   `ENTIDADES`, `TROFEUS`).
3. Tela: as mensagens de aviso e abertura em `VivoScreen.tsx` (sem texto próprio, cai no do Apagão) e o desenho.
4. Testar no navegador, com `npm run dev`: `__vivo.forcarEvento(...)`, `__vivo.irPara(...)` e `__vivo.avancar(ms)`.

**Armadilha:** nenhum teste liga `TIPOS_EVENTO` à regex das regras. Esqueça a regra e o evento funciona sozinho no
aparelho, mas o banco recusa o dano.

## 6. Arma, poder ou móvel

- **Arma:** o tipo em `Arma` (`src/vivo/mapa.ts`), a entrada em `ARMAS` (`src/vivo/briga.ts`: `dano`, `knock`,
  `alcance`, `usos`…), o movimento em `MOVIMENTO` (`src/vivo/animArma.ts`) e o desenho em `armaSprite`
  (`src/vivo/arte.ts`). Onde ela aparece: no chão (`ARMAS_NO_CHAO`), num móvel (`MOVEL_ARMA`) ou na loja (`CATALOGO`
  de `loja.ts`), nunca no chão e na loja ao mesmo tempo.
- **Poder:** `PODERES`, `PODERES_NOVOS` e `PODER` em `src/vivo/poderes.ts`.
- **Regras:** a arma na regex de `vivo/$player/w` (sem `soco`/`empurrao`) e de `vgolpe/$player/$slot/w`; o poder em
  `vivo/$player/q`. Espelho em `tests/mock-rules.mjs` (`GOLPES`, `NA_MAO`, `PODERES`).
- **Limites:** dano até 40 por golpe; até 100 só para poder (a rede corta, `src/vivo/rede.ts`, e a regra recusa).

**Armadilhas:** `tests/fatia5.test.mjs` fixa 34 armas e `tests/fatia6.test.mjs` fixa 11 poderes. `tests/fatia12.test.mjs`
confere o fim da regex `GOLPES` do espelho e `tests/fatia7.test.mjs` exige que a lista de armas das regras seja igual a
`ARMAS`. Cada movimento precisa de uma assinatura própria (`fatia5`).

## 7. NPC

- `src/vivo/gente.ts`: a entrada em `NPCS` (`id`, `nome`, `tipo`, `look`, `rotina` de paradas `{ at: [x, y], ms }`).
  A rotina é uma função pura da hora (`rotinaEm`, `src/vivo/rotina.ts`): mesma hora, mesmo lugar em todo aparelho.
- Id com 2 a 16 letras minúsculas ou números. Os testes exigem de 20 a 30 NPCs, cada um numa área só, sem teleporte
  e com paradas alcançáveis.
- **Falas:** `src/vivo/frases.ts` é por tema (`FRASES`), não por NPC. Fala nova é um tema novo e uma chamada a
  `falar()` em `briga.ts`.

## 8. Cosmético (prêmio)

O prêmio é um item de `PREMIOS` de um portal (receita 4). A tela sorteia no fim da corrida (`sortearPremio`, com
raridade e "pity") e grava em `bar/inventario/{pessoa}/{item}`, que só aceita os ids da lista fechada das regras e só
grava uma vez. Chapéus são `Chapeu` em `src/arena/sprites.ts` e `CHAPEUS` em `visual.ts`.

## 9. A turma

Veja [`kit/LEIA-ME.md`](../kit/LEIA-ME.md). Em resumo: edite `src/turma/turma.ts`, rode `npm run regras` e publique
as regras.

## Regras que valem para tudo

1. **Regras antes do código.** Publique as regras novas no banco antes do site novo.
2. **Listas que viajam pela rede só crescem no fim:** portais, prêmios, cores, cortes, chapéus, títulos, faixas da
   jukebox, eventos. A posição é o que vai para o banco ou para o código do visual. Nenhum teste genérico confere isso.
3. **Semente, não acaso, na simulação.** Use o `rng`/`sorteia` da simulação; `Math.random` só em desenho, som e efeito.
   O determinismo é conferido pelos testes de "mesma semente, mesmo resultado".
4. **LF e UTF-8 sem BOM.** O `.gitattributes` força LF; `tests/fatia7.test.mjs` reprova `\r\n` em parte das pastas.
5. **Regex do Firebase com `^` e `$` só nas pontas**, sem `(?...)`: `tests/regras-firebase.test.mjs` confere.
6. **Molde e espelho juntos:** mudou `database.rules.molde.json`, mude `tests/mock-rules.mjs` e rode `npm run regras`.
   Uma regra nova que usa a lista da turma (`{{TURMA}}`) muda a contagem de 41 em `tests/turma.test.mjs`.
7. **Nunca grave no banco de outra pessoa.** Teste no banco falso ou no seu.
