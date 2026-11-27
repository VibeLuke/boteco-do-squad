# Faça o boteco da sua turma

Passo a passo para pôr a sua turma no jogo e publicar o site. Leva uns 30 minutos. Precisa de
[Node 24](https://nodejs.org), [git](https://git-scm.com) e uma conta Google (para o Firebase).

## 1. Copie o repositório

No GitHub, use **Use this template** (ou **Fork**) e depois clone a sua cópia:

```sh
git clone https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
cd SEU-REPOSITORIO
npm ci
```

**Deu certo quando:** `npm ci` termina sem erro. **Erro comum:** Node antigo. `node -v` precisa mostrar 24 ou mais
(com versão antiga, a instalação passa, mas o `npm test` falha ao ler os arquivos `.ts`).

## 2. Ponha a sua turma

Abra `src/turma/turma.ts`. Ele vem com a turma de exemplo (Vini, Will, Dani, Bia e Tati). Troque pelas pessoas da sua
turma, de 2 a 5:

| Campo | O que é | Exemplo |
|---|---|---|
| `id` | 2 a 16 letras minúsculas ou números; vai para o banco. `bot1` a `bot3` são reservados. **Não mude depois de jogar** (os pontos ficam pelo id) | `'dani'` |
| `name` | como aparece no jogo | `'Dani'` |
| `artigo` | `'do'` ou `'da'`: "Synthwave **da** Dani", "caída do sofá" | `'da'` |
| `color` | a cor da pessoa no placar | `'#b55088'` |
| `tagline` | uma frase curta no seletor | `'Cabelo comprido e casaco azul'` |
| `musica` | o estilo da faixa da jukebox quando ela lidera o dia: `rock`, `samba`, `synthwave`, `baiao` ou `lofi` | `'samba'` |
| `vozFina` | opcional; voz mais aguda nos sons | `true` |
| `look` | o desenho do boneco (veja abaixo) | |

E `admin`: o id de quem pode mudar a frequência dos eventos do bar.

**O `look`:**
- Cores (texto `#rrggbb`): `skin` e `skinShade` (pele e sombra da pele), `hair`, `shirt` e `shirtShade`, `pants`,
  `shoes`, `frame` (armação dos óculos).
- `hairStyle`: `'curly'`, `'neat'`, `'side'`, `'straight'` ou `'long'`.
- Opcionais: `shorts: true`; `beard: 'full'` ou `'short'`, com `beardColor`; `extra`: `'turtle'`, `'necklace'`,
  `'nike'` (tênis), `'vneck'` ou `'jacket'`; `prop: 'can'` (uma lata na mão).
- Evite cores quase pretas na roupa e no cabelo: o acabamento não consegue dar sombra e luz, e o boneco fica chapado.

Depois:

```sh
npm run regras        # gera database.rules.json para a sua turma
npm test
npm run dev           # abre em http://localhost:5173
```

**Deu certo quando:** `npm test` termina com `regras em dia com a turma` e a linha `pacotes=… erros=0`, e o seletor
mostra a sua turma.

**Erros comuns:**
- `turma: ...` no `npm run regras`: o motivo vem escrito (id com maiúscula, id repetido, admin fora da turma…).
- `o jogo só conhece a turma por src/turma` reprovado: um id ou um nome da sua turma coincide com algo escrito no
  código (um id que é também uma palavra do jogo, ou um nome igual ao de um NPC). A mensagem diz o arquivo e o
  padrão: troque o id, ou escreva o nome de outro jeito (apelido, acento, sobrenome curto).
- Os outros testes usam a turma de exemplo de propósito (veja `tests/turma-dos-testes.mjs`): deixe
  `src/turma/turma.exemplo.ts` como está.

## 3. Crie o banco

Siga [`docs/FIREBASE.md`](../docs/FIREBASE.md), passos 1 a 3: projeto, banco em modo bloqueado, regras publicadas e
`.env.production` com a URL do banco.

**Deu certo quando:** no console do Firebase, as regras publicadas começam com `"rules"` e citam os ids da sua turma.

## 4. Publique

```sh
npx firebase login
npx firebase use --add
npm run publicar
```

**Deu certo quando:** o comando termina com `Hosting URL: https://SEU-PROJETO.web.app`.

## 5. Confira

Siga [`checklist-publicar.md`](checklist-publicar.md).

## E depois

- Para mudar a turma: edite `turma.ts`, `npm run regras`, publique as regras e depois `npm run publicar`.
- Para criar coisas novas: [`docs/COMO_EXPANDIR.md`](../docs/COMO_EXPANDIR.md).
- Antes de mostrar o site a estranhos: [`docs/CONTEUDO.md`](../docs/CONTEUDO.md) e a seção "Sem login" de
  [`docs/FIREBASE.md`](../docs/FIREBASE.md).
