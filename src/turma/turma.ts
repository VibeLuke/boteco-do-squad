/**
 * A turma do boteco: a única lista de quem joga. Tudo o que depende de quem joga (placar, lutadores, Bar Vivo, rede,
 * jukebox, regras do banco) sai daqui. Para montar o boteco de outra turma, troque só este arquivo e rode
 * `npm run regras` (gera o database.rules.json).
 *
 * Regras de cada pessoa:
 * - `id`: letras minúsculas e números, de 2 a 16 (vai para o banco e para a regex das regras). Não mude depois de
 *   jogar: os pontos ficam guardados por id.
 * - `artigo`: "do" ou "da" ("Samba do Fulano", "Synthwave da Fulana"); também escolhe "caído" ou "caída" nos textos.
 * - `musica`: o estilo da faixa da jukebox quando essa pessoa lidera o dia (ver ESTILOS em src/bar/music.ts).
 * - `look`: o visual do lutador (ver Look em src/arena/sprites.ts).
 * - De 2 a 5 pessoas (são 5 cantos no bar para quem está fora). A ordem é a ordem da ficha e dos cantos.
 * - `admin`: o id de quem pode mexer na frequência dos eventos do bar.
 */
import type { Look } from '../arena/sprites';

export type Estilo = 'rock' | 'samba' | 'synthwave' | 'baiao' | 'lofi';

export interface PessoaDef {
  id: string;
  name: string;
  artigo: 'do' | 'da';
  color: string;
  tagline: string;
  musica: Estilo;
  vozFina?: boolean;
  look: Look;
}

export const TURMA = {
  admin: 'will',
  pessoas: [
    {
      id: 'vini',
      name: 'Vini',
      artigo: 'do',
      color: '#feae34',
      tagline: 'Cabelo bagunçado e bermuda o ano todo',
      musica: 'rock',
      look: {
        skin: '#f2c9a5',
        skinShade: '#d9a27f',
        hair: '#8f563b',
        shirt: '#5a6988',
        shirtShade: '#3a4466',
        pants: '#c9a86a',
        shoes: '#1d1f2a',
        frame: '#2d2d3a',
        shorts: true,
        hairStyle: 'curly',
        extra: 'turtle',
      } satisfies Look,
    },
    {
      id: 'will',
      name: 'Will',
      artigo: 'do',
      color: '#0099db',
      tagline: 'Barba curta e camisa de time',
      musica: 'samba',
      look: {
        skin: '#c48e68',
        skinShade: '#a06c4a',
        hair: '#1f1a1a',
        shirt: '#e43b44',
        shirtShade: '#a32735',
        pants: '#262b44',
        shoes: '#4a4f5c',
        frame: '#181425',
        hairStyle: 'neat',
        beard: 'short',
        beardColor: '#1f1a1a',
        extra: 'vneck',
      } satisfies Look,
    },
    {
      id: 'dani',
      name: 'Dani',
      artigo: 'da',
      color: '#b55088',
      tagline: 'Cabelo comprido e casaco azul',
      musica: 'synthwave',
      look: {
        skin: '#d9a27f',
        skinShade: '#b9805e',
        hair: '#2a1a14',
        shirt: '#3a4466',
        shirtShade: '#262b44',
        pants: '#1d1f2a',
        shoes: '#f4f4f4',
        frame: '#181425',
        hairStyle: 'long',
        extra: 'jacket',
      } satisfies Look,
    },
    {
      id: 'bia',
      name: 'Bia',
      artigo: 'da',
      color: '#63c74d',
      tagline: 'Cabelo escorrido e colar de prata',
      musica: 'baiao',
      vozFina: true,
      look: {
        skin: '#f6d0ad',
        skinShade: '#ddab86',
        hair: '#4a2c20',
        shirt: '#8a4a7a',
        shirtShade: '#6a3560',
        pants: '#3a3550',
        shoes: '#141219',
        frame: '#181425',
        hairStyle: 'straight',
        extra: 'necklace',
      } satisfies Look,
    },
    {
      id: 'tati',
      name: 'Tati',
      artigo: 'da',
      color: '#e43b44',
      tagline: 'Cabelo ruivo de lado e camiseta verde',
      musica: 'lofi',
      vozFina: true,
      look: {
        skin: '#e6b48c',
        skinShade: '#c48e68',
        hair: '#b86f50',
        shirt: '#63c74d',
        shirtShade: '#3e8948',
        pants: '#1a1822',
        shoes: '#f4f4f4',
        frame: '#181425',
        hairStyle: 'side',
        extra: 'nike',
      } satisfies Look,
    },
  ],
} as const satisfies { admin: string; pessoas: readonly PessoaDef[] };
