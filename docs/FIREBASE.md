# Firebase: banco e site

O jogo funciona sem banco: o placar fica no aparelho e o bar fica só para quem está nele. Com o banco, a turma vê o
placar e o bar ao vivo. Tudo cabe no plano gratuito (Spark), sem cartão.

## 1. Criar o projeto e o banco

1. Em <https://console.firebase.google.com>, crie um projeto (o Google Analytics pode ficar desligado).
2. Em **Build → Realtime Database**, crie o banco e escolha **modo bloqueado**.
3. Copie a URL do banco. Ela tem o formato `https://SEU-PROJETO-default-rtdb.firebaseio.com` (ou com o nome da
   região, se você escolheu outra).

## 2. Gerar e publicar as regras da sua turma

As regras dizem quem grava o quê. Elas são geradas a partir da turma:

```sh
npm run regras        # gera database.rules.json a partir de src/turma/turma.ts
```

No console, em **Realtime Database → Regras**, apague o que estiver lá, cole o conteúdo de `database.rules.json` e
clique em **Publicar**. Recarregue a página e confira que o texto continua o mesmo.

- **Regras antes do código:** sempre que trocar a turma ou atualizar o kit, publique as regras novas antes do site
  novo. Com as regras velhas, o banco recusa o que é novo e o bar se cala.
- `npm test` reprova se `database.rules.json` não bater com a turma.

## 3. Ligar o site ao banco

Crie o arquivo `.env.production` na raiz (ele não vai para o git) com uma linha:

```text
VITE_FIREBASE_DB_URL=https://SEU-PROJETO-default-rtdb.firebaseio.com
```

O `npm run build` põe essa URL dentro do site. **Ela não é segredo**: quem abre o site consegue vê-la. A proteção vem
das regras.

## 4. Publicar o site

O caminho mais simples é o Firebase Hosting do mesmo projeto:

```sh
npx firebase login
npx firebase use --add          # escolha o seu projeto
npm run publicar                # testes, build e deploy
```

O site sai em `https://SEU-PROJETO.web.app`. O `firebase.json` já serve a pasta `dist`, guarda os arquivos de
`/assets` em cache e manda os buscadores não listarem o site (veja abaixo como mudar).

Qualquer hospedagem de site estático também serve (GitHub Pages, Netlify, Cloudflare Pages): publique a pasta `dist`
depois do `npm run build`. O build usa caminhos relativos (`base: './'`), então funciona numa subpasta.

## 5. Conferir

- Abra o site em dois aparelhos com pessoas diferentes e entre no bar: um vê o outro andar.
- Faça uma cruzada: os pontos aparecem no placar do outro aparelho.
- Se o bar ficar sozinho, abra o console do navegador: `401` ou `403` nas gravações quer dizer que as regras
  publicadas não são as da sua turma.

## O que as regras guardam

Tudo mora em `cruzadabotecos/`. Só dois nós são legíveis, e cada nó aceita só o formato que o jogo grava:

- `v1/scores/{pessoa}/{tabuleiro}`: os pontos de cada tabuleiro (só sobem).
- `bar/...`: presença, posição no Bar Vivo, golpes, chat, efeitos, bagunça, Palavra do Dia, quiz, anagramas, jukebox,
  sinuca, carteira, eventos e seus livros de dano, troféus, inventário dos portais e a melhor corrida do dia.

Os dias viram às 6h de Brasília. Ninguém apaga nada, com uma exceção: o registro de um evento pode ser apagado uma
hora depois de aberto.

## Limites do plano Spark

Para um grupo de amigos, sobra:

- 100 conexões simultâneas (cada aba aberta no bar é uma);
- 1 GB guardado;
- 10 GB baixados por mês.

Confira os números atuais em <https://firebase.google.com/pricing>.

## Sem login: o que isso quer dizer

O jogo não pede senha: quem abre o site escolhe quem é. As regras garantem o formato e o ritmo, mas **qualquer pessoa
com o link pode jogar em nome de alguém da turma**. Para um grupo de amigos, é o combinado. Se o site for ficar aberto
ao público:

- não divulgue o link da sua turma;
- considere o [App Check](https://firebase.google.com/docs/app-check) (barra gravações que não vêm do seu site);
- para identidade de verdade, seria preciso acrescentar Firebase Authentication e trocar as regras para usar
  `auth.uid` (não incluído no kit).

## Listar ou não nos buscadores

O kit vem como "site de turma, não listado": a linha `<meta name="robots" content="noindex, nofollow">` do
`index.html`, o `public/robots.txt` e o cabeçalho `X-Robots-Tag` do `firebase.json`. Para aparecer em buscador, tire os
três.
