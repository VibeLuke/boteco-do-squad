/**
 * Personalização do personagem (Fatia 1: fica no aparelho). O visual de cada amigo é o de sempre mais as trocas
 * guardadas aqui. Nas próximas fatias o código do visual vai junto da presença, e os itens que caem nos portais
 * destravam opções novas.
 */
import { PLAYER_BY_ID, type Chapeu, type Look, type PlayerId } from '../arena/sprites';

// Fatia 13: as cores do fim de cada lista vêm dos prêmios dos portais (ver portais/portal.ts) e só aparecem no
// painel para quem ganhou; entram no fim para não mudar os códigos que já vão pela rede. Fatia 20: + Churrasco Jurássico.
export const CAMISAS = ['#262b44', '#e43b44', '#3e8948', '#0099db', '#feae34', '#b55088', '#f4f4f4', '#181425', '#ef7d57', '#2ce8f5', '#68386c', '#c28a1f', '#7a9a3a', '#2a6a8a', '#ffd34d', '#b8343c', '#3a9a5a', '#c8b08a', '#4a7a3a'];
export const CALCAS = ['#262b44', '#3a4466', '#c9a86a', '#181425', '#5c3620', '#4a4f5c', '#733e39', '#265c42', '#8a6a3a', '#5a2a6a', '#3a5a9a', '#7a2a3a', '#3a3438', '#d8561a'];
export const CABELOS = ['#181425', '#3b2416', '#5a3a22', '#b86f50', '#feae34', '#c0cbdc', '#e43b44', '#2ce8f5', '#8f6b3a', '#a8e05f', '#fff07a', '#e8c25a', '#ff7a2a', '#9a9aa8', '#ff4a1a'];
export const CORTES: Look['hairStyle'][] = ['curly', 'neat', 'side', 'straight', 'long'];
export const BARBAS = ['nenhuma', 'short', 'full'] as const;
export const ACESSORIOS = ['nenhum', 'turtle', 'necklace', 'nike', 'vneck', 'jacket'] as const;
export const OCULOS = ['com', 'shades', 'none'] as const;
/** Fatia 16: chapéus (prêmios dos portais; só aparecem no painel para quem ganhou). */
export const CHAPEUS = ['nenhum', 'bone', 'palha', 'cartola'] as const;
/**
 * Fatia 16: títulos sob o nome. Cada um vem de um troféu que já fica no banco (`bar/trofeus`): quem não tem o troféu
 * não consegue escolher, e quem recebe só desenha o título se o troféu estiver lá (código falso não vira título).
 */
export const TITULOS = [
  { id: 'nenhum', nome: 'Sem título', trofeu: '' },
  { id: 'rato', nome: 'Exterminador de Ratos', trofeu: 'rabo' },
  { id: 'vela', nome: 'Sopra-Velas', trofeu: 'vela' },
  { id: 'gorjeta', nome: 'Amigo do Visitante', trofeu: 'gorjeta' },
  { id: 'antena', nome: 'Caçador de Disco', trofeu: 'antena' },
  { id: 'ze', nome: 'Detetive do Zé', trofeu: 'sumiuze' },
  // Fatia 17.
  { id: 'dragao', nome: 'Domador de Dragão', trofeu: 'dente' },
  { id: 'dino', nome: 'Babá de Dinossauro', trofeu: 'ovo' },
] as const;
export type IdTitulo = (typeof TITULOS)[number]['id'];

const temTrofeu = (trofeusRaw: unknown, trofeu: string, jogador: string) => {
  const donos = trofeusRaw && typeof trofeusRaw === 'object' ? (trofeusRaw as Record<string, unknown>)[trofeu] : null;
  return !!donos && typeof donos === 'object' && typeof (donos as Record<string, unknown>)[jogador] === 'number';
};
/** Os títulos que o jogador pode usar (os troféus dele no banco), sempre com "Sem título" na frente. */
export const titulosDe = (jogador: string, trofeusRaw: unknown) => TITULOS.filter((t) => !t.trofeu || temTrofeu(trofeusRaw, t.trofeu, jogador));
/** O nome do título a desenhar, ou null (sem título, título desconhecido ou sem o troféu que o dá). */
export function tituloDe(id: string | undefined, jogador: string, trofeusRaw: unknown): string | null {
  const t = TITULOS.find((x) => x.id === id);
  return t && t.trofeu && temTrofeu(trofeusRaw, t.trofeu, jogador) ? t.nome : null;
}
/** Desenho de cada chapéu para listas de texto (troca por Pó, aviso do prêmio). */
export const ICONE_CHAPEU: Record<string, string> = { bone: '🧢', palha: '👒', cartola: '🎩' };

export const NOMES: Record<string, string> = {
  curly: 'Cacheado',
  neat: 'Curto',
  side: 'De lado',
  straight: 'Liso',
  long: 'Comprido',
  nenhuma: 'Sem barba',
  short: 'Barba curta',
  full: 'Barbão',
  nenhum: 'Nada',
  turtle: 'Gola alta',
  necklace: 'Corrente',
  nike: 'Tênis de marca genérica',
  vneck: 'Decote',
  jacket: 'Jaqueta',
  com: 'Óculos',
  shades: 'Óculos escuros',
  none: 'Sem óculos',
  bone: 'Boné',
  palha: 'Chapéu de palha',
  cartola: 'Cartola de cartolina',
};

export interface Visual {
  camisa?: string;
  calca?: string;
  cabelo?: string;
  corte?: Look['hairStyle'];
  barba?: (typeof BARBAS)[number];
  acessorio?: (typeof ACESSORIOS)[number];
  oculos?: (typeof OCULOS)[number];
  bermuda?: boolean;
  chapeu?: (typeof CHAPEUS)[number];
  titulo?: IdTitulo;
}

const chave = (id: PlayerId) => `cruzadabotecos.vivo.visual.${id}`;

export function carregar(id: PlayerId): Visual {
  try {
    const v = JSON.parse(localStorage.getItem(chave(id)) ?? '{}');
    return limpar(v);
  } catch {
    return {};
  }
}

export function salvar(id: PlayerId, v: Visual) {
  localStorage.setItem(chave(id), JSON.stringify(limpar(v)));
}

/** Só passa o que existe nas listas (o armazenamento pode ter lixo de versão antiga). */
export function limpar(raw: unknown): Visual {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const v: Visual = {};
  if (typeof r.camisa === 'string' && CAMISAS.includes(r.camisa)) v.camisa = r.camisa;
  if (typeof r.calca === 'string' && CALCAS.includes(r.calca)) v.calca = r.calca;
  if (typeof r.cabelo === 'string' && CABELOS.includes(r.cabelo)) v.cabelo = r.cabelo;
  if (typeof r.corte === 'string' && (CORTES as string[]).includes(r.corte)) v.corte = r.corte as Look['hairStyle'];
  if (typeof r.barba === 'string' && (BARBAS as readonly string[]).includes(r.barba)) v.barba = r.barba as Visual['barba'];
  if (typeof r.acessorio === 'string' && (ACESSORIOS as readonly string[]).includes(r.acessorio)) v.acessorio = r.acessorio as Visual['acessorio'];
  if (typeof r.oculos === 'string' && (OCULOS as readonly string[]).includes(r.oculos)) v.oculos = r.oculos as Visual['oculos'];
  if (typeof r.bermuda === 'boolean') v.bermuda = r.bermuda;
  if (typeof r.chapeu === 'string' && (CHAPEUS as readonly string[]).includes(r.chapeu)) v.chapeu = r.chapeu as Visual['chapeu'];
  if (typeof r.titulo === 'string' && TITULOS.some((t) => t.id === r.titulo)) v.titulo = r.titulo as IdTitulo;
  return v;
}

/** Escurece uma cor (#rrggbb) para a sombra da roupa. */
export function sombra(c: string, k = 0.68): string {
  const n = (i: number) => Math.round(parseInt(c.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0');
  return `#${n(1)}${n(3)}${n(5)}`;
}

export function aplicar(base: Look, v: Visual): Look {
  const L: Look = { ...base };
  if (v.camisa) {
    L.shirt = v.camisa;
    L.shirtShade = sombra(v.camisa);
  }
  if (v.calca) L.pants = v.calca;
  if (v.cabelo) {
    L.hair = v.cabelo;
    if (L.beard) L.beardColor = v.cabelo;
  }
  if (v.corte) L.hairStyle = v.corte;
  if (v.barba) {
    if (v.barba === 'nenhuma') delete L.beard;
    else {
      L.beard = v.barba;
      L.beardColor = L.beardColor ?? L.hair;
    }
  }
  if (v.acessorio) {
    if (v.acessorio === 'nenhum') delete L.extra;
    else L.extra = v.acessorio;
  }
  if (v.oculos) L.glasses = v.oculos === 'com' ? undefined : v.oculos;
  if (v.bermuda !== undefined) L.shorts = v.bermuda;
  if (v.chapeu) {
    if (v.chapeu === 'nenhum') delete L.hat;
    else L.hat = v.chapeu as Chapeu;
  }
  return L;
}

export const lookDe = (id: PlayerId, v: Visual = carregar(id)): Look => aplicar(PLAYER_BY_ID[id].look, v);

/**
 * Chave curta do visual (cache dos sprites e presença): um caractere em base 36 por campo. Fatia 16: a 9ª posição é o
 * chapéu e a 10ª o título; sem os dois, o código continua com 8 (quem ainda não atualizou segue vendo esse amigo).
 */
export function codigo(v: Visual): string {
  const c = (i: number | undefined) => (i === undefined || i < 0 ? '-' : i.toString(36));
  const ch = v.chapeu && v.chapeu !== 'nenhum' ? CHAPEUS.indexOf(v.chapeu) : undefined;
  const ti = v.titulo && v.titulo !== 'nenhum' ? TITULOS.findIndex((t) => t.id === v.titulo) : undefined;
  const cauda = ch === undefined && ti === undefined ? '' : c(ch) + c(ti);
  return [
    c(v.camisa ? CAMISAS.indexOf(v.camisa) : undefined),
    c(v.calca ? CALCAS.indexOf(v.calca) : undefined),
    c(v.cabelo ? CABELOS.indexOf(v.cabelo) : undefined),
    c(v.corte ? CORTES.indexOf(v.corte) : undefined),
    c(v.barba ? BARBAS.indexOf(v.barba) : undefined),
    c(v.acessorio ? ACESSORIOS.indexOf(v.acessorio) : undefined),
    c(v.oculos ? OCULOS.indexOf(v.oculos) : undefined),
    v.bermuda === undefined ? '-' : v.bermuda ? '1' : '0',
  ].join('') + cauda;
}

/** Código de visual aceito na rede: 8 (até a Fatia 15) a 16 caracteres (posições futuras são ignoradas). */
export const CODIGO_OK = /^[0-9a-z-]{8,16}$/;

/** O contrário de `codigo`: a roupa que um amigo mandou pela rede (lixo vira "visual de sempre"). */
export function deCodigo(s: unknown): Visual {
  if (typeof s !== 'string' || !CODIGO_OK.test(s)) return {};
  const i = (k: number) => (s[k] === '-' ? -1 : parseInt(s[k], 36));
  const de = <T,>(lista: readonly T[], k: number): T | undefined => (i(k) >= 0 && i(k) < lista.length ? lista[i(k)] : undefined);
  const raw: Record<string, unknown> = {
    camisa: de(CAMISAS, 0),
    calca: de(CALCAS, 1),
    cabelo: de(CABELOS, 2),
    corte: de(CORTES, 3),
    barba: de(BARBAS, 4),
    acessorio: de(ACESSORIOS, 5),
    oculos: de(OCULOS, 6),
    bermuda: s[7] === '1' ? true : s[7] === '0' ? false : undefined,
    chapeu: s.length > 8 ? de(CHAPEUS, 8) : undefined,
    titulo: s.length > 9 ? de(TITULOS, 9)?.id : undefined,
  };
  return limpar(raw);
}
