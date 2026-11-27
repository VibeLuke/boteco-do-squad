/**
 * O motor da briga do Bar Vivo: corpos (você, os NPCs e os amigos desmaiados), golpes com antecipação, combo de 3,
 * knockback com atrito, hit-stop, agarrar e arremessar, armas do cenário, nocaute e a multidão que entra ou foge.
 *
 * Função pura sobre o estado: `passo(mundo, entrada, dt)` muda o mundo e deixa eventos para a tela (sangue, frase,
 * tremida). Sem DOM e sem Math.random: o sorteio sai de uma semente guardada no próprio mundo, então a mesma
 * sequência de entradas dá a mesma briga (é o que os testes conferem).
 */
import { findPath } from '../bar/path';
import { NOME as NOME_AMIGO, PEGADINHA_MAX, type Jogador } from './interacoes';
import { AREAS, BANCADA, RAIO_BANCADA, CANTOS, ARMAS_NO_CHAO, CARRO_MEIO, DEPOSITO, FIM_PATIO, BALCAO_MERCADO, RAIO_MERCADO, JOGOS, RUA, carrosEm, PORTAS, PROPS, QUEBRAVEIS, SARJETA, ENTRADA, JANELA_BRIGA, anda, brigaDaJanela, happyHour, propIdx, zonaDe, MOVEL_ARMA, type AmigoId, type Arma, type Deitado, type Jogo, type Kind } from './mapa';
import { FICHAS, FUNCIONARIOS, MOLHADO_MS, NPCS, clienteAvulso, temperamentoDe, type Npc, type Pose, type Temperamento } from './gente';
import { molhadosEm as molhadosDa, rotinaEm } from './rotina';
import { APARA_ATORDOA, APARA_RECARGA, CARGA_MAX_MS, CHOQUE, ELETRICO_TRAVA, HITSTOP_CARGA_MAX, QUEIMA_DANO_S, STATUS_DA_ARMA, aparou, aplicar, golpeCarregado, nivelCarga, receita, velStatus, type Estados, type Status } from './status';
import { FLASH_MS, HITSTOP_FINAL, hitstopDe, traumaDe } from './impacto';
import { FOGO_DANO_S, FOGO_MS, FOGO_RAIO, IMA_FORCA, IMA_PUXA, PODER, PODERES_NOVOS, ehPoder, empurraoDe, montarDisparo, quando, vooPinga, type Disparo, type PoderNovo } from './poderes';
import { frase, type Tema } from './frases';

/* ------------------------------------------------------------------ números da briga (valores iniciais) */

export const RAIO = 0.28;
export const VEL_EU = 3.4;
export const ATRITO = 9;
/** Corpo arremessado: sai a 9 ladrilhos/s e freia com atrito de voo (≈ 2,8 ladrilhos de alcance). */
export const VEL_ARREMESSO = 9;
export const ATRITO_VOO = 3.2;
export const VIDA_EU = 100;
export const RECUPERA_POR_S = 4;
export const RECUPERA_DEPOIS = 4000;
export const KO_EU_MS = 4000;
export const KO_NPC_MS: readonly [number, number] = [10000, 14000];
export const JANELA_COMBO = 350;
export const RAIO_BRIGA = 5;
export const CALOR_LEAO = 3;
export const CALOR_ESFRIA_MS = 20000;
export const VOLTA_ARMA_MS = 25000;
/** Móvel quebrado: o Seu Zé vai buscar outro no depósito depois disto. */
export const REPOR_MS = 6000;
/** Corpo recolhido: um cliente novo chega pela calçada entre estes tempos. */
export const CHEGADA_MS: readonly [number, number] = [5000, 10000];
/** O Seu Zé carregando um corpo anda mais devagar. */
const CARGA_VEL = 0.75;
export const CERVEJA_MS = 12000;

export interface Golpe {
  dano: number;
  knock: number;
  alcance: number;
  alvos: number;
  antecipa: number;
  recupera: number;
  forte: boolean;
  hitstop: number;
}

export const JAB: Golpe = { dano: 10, knock: 2.5, alcance: 0.95, alvos: 1, antecipa: 70, recupera: 180, forte: false, hitstop: 60 };
export const EMPURRAO: Golpe = { dano: 22, knock: 7, alcance: 1.0, alvos: 2, antecipa: 140, recupera: 320, forte: true, hitstop: 110 };

/** Fatia 6: os 10 poderes novos viram itens de um uso (a carga é o `antes`, o efeito é o `depois`). */
const ARMAS_PODER = Object.fromEntries(
  PODERES_NOVOS.map((p) => [p, { nome: PODER[p].nome, dano: PODER[p].dano, knock: PODER[p].knock, alcance: 0, alvos: 0, antecipa: PODER[p].carga, recupera: PODER[p].dura, forte: true, hitstop: 0, usos: 1 }]),
) as Record<PoderNovo, Golpe & { usos: number; nome: string }>;

export const ARMAS: Record<Arma, Golpe & { usos: number; nome: string }> = {
  ...ARMAS_PODER,
  garrafa: { nome: 'Garrafa', dano: 28, knock: 5, alcance: 1.0, alvos: 1, antecipa: 160, recupera: 380, forte: true, hitstop: 110, usos: 1 },
  caco: { nome: 'Caco de garrafa', dano: 16, knock: 2, alcance: 0.9, alvos: 1, antecipa: 90, recupera: 240, forte: false, hitstop: 70, usos: 3 },
  banqueta: { nome: 'Banqueta', dano: 24, knock: 7, alcance: 1.15, alvos: 2, antecipa: 200, recupera: 420, forte: true, hitstop: 120, usos: 4 },
  taco: { nome: 'Taco de sinuca', dano: 18, knock: 4.5, alcance: 1.45, alvos: 2, antecipa: 170, recupera: 380, forte: true, hitstop: 100, usos: 6 },
  cadeira: { nome: 'Cadeira de plástico', dano: 26, knock: 8, alcance: 1.1, alvos: 3, antecipa: 220, recupera: 460, forte: true, hitstop: 130, usos: 3 },
  cano: { nome: 'Cano enferrujado', dano: 22, knock: 5, alcance: 1.2, alvos: 2, antecipa: 190, recupera: 420, forte: true, hitstop: 110, usos: 5 },
  desentupidor: { nome: 'Desentupidor', dano: 8, knock: 2, alcance: 1.05, alvos: 1, antecipa: 120, recupera: 260, forte: false, hitstop: 80, usos: 8 },
  // Móveis pegos do salão (E de frente para o móvel).
  cadeirao: { nome: 'Cadeira de madeira', dano: 30, knock: 9, alcance: 1.15, alvos: 3, antecipa: 240, recupera: 480, forte: true, hitstop: 140, usos: 4 },
  vaso: { nome: 'Vaso de planta', dano: 24, knock: 5, alcance: 1.0, alvos: 1, antecipa: 180, recupera: 380, forte: true, hitstop: 120, usos: 1 },
  engradado: { nome: 'Engradado', dano: 20, knock: 6, alcance: 1.05, alvos: 2, antecipa: 200, recupera: 420, forte: true, hitstop: 110, usos: 2 },
  lixeira: { nome: 'Lixeira', dano: 18, knock: 7, alcance: 1.1, alvos: 2, antecipa: 200, recupera: 400, forte: true, hitstop: 110, usos: 4 },
  // Mercado negro: forte, mas acaba (gastou, compra outro).
  faca: { nome: 'Faca de churrasco', dano: 15, knock: 1.5, alcance: 0.95, alvos: 1, antecipa: 60, recupera: 160, forte: false, hitstop: 70, usos: 12 },
  socoingles: { nome: 'Soco-inglês', dano: 16, knock: 3.5, alcance: 0.95, alvos: 1, antecipa: 70, recupera: 170, forte: false, hitstop: 80, usos: 20 },
  machadinha: { nome: 'Machadinha', dano: 34, knock: 5, alcance: 1.1, alvos: 1, antecipa: 200, recupera: 420, forte: true, hitstop: 140, usos: 8 },
  serra: { nome: 'Serra elétrica', dano: 26, knock: 2, alcance: 1.2, alvos: 2, antecipa: 120, recupera: 200, forte: true, hitstop: 90, usos: 30 },
  // Fatia 4: achados pelo bar (cada um com o seu jeito).
  frigideira: { nome: 'Frigideira', dano: 18, knock: 3.5, alcance: 1.0, alvos: 1, antecipa: 150, recupera: 340, forte: true, hitstop: 130, usos: 10 },
  bastao: { nome: 'Taco de beisebol', dano: 22, knock: 9, alcance: 1.3, alvos: 2, antecipa: 200, recupera: 420, forte: true, hitstop: 120, usos: 12 },
  violao: { nome: 'Violão', dano: 20, knock: 5, alcance: 1.2, alvos: 2, antecipa: 210, recupera: 440, forte: true, hitstop: 120, usos: 3 },
  extintor: { nome: 'Extintor', dano: 8, knock: 6, alcance: 1.6, alvos: 3, antecipa: 120, recupera: 320, forte: false, hitstop: 60, usos: 15 },
  guardasol: { nome: 'Guarda-sol', dano: 14, knock: 4, alcance: 1.7, alvos: 2, antecipa: 190, recupera: 400, forte: false, hitstop: 90, usos: 6 },
  tijolo: { nome: 'Tijolo', dano: 25, knock: 4, alcance: 0.95, alvos: 1, antecipa: 150, recupera: 360, forte: true, hitstop: 130, usos: 1 },
  espeto: { nome: 'Espeto de churrasco', dano: 14, knock: 1.5, alcance: 1.15, alvos: 1, antecipa: 70, recupera: 180, forte: false, hitstop: 70, usos: 10 },
  placa: { nome: 'Placa "piso molhado"', dano: 16, knock: 4, alcance: 1.1, alvos: 2, antecipa: 180, recupera: 380, forte: true, hitstop: 100, usos: 5 },
  rodo: { nome: 'Rodo', dano: 12, knock: 3.5, alcance: 1.4, alvos: 2, antecipa: 160, recupera: 340, forte: false, hitstop: 80, usos: 8 },
  // Fatia 4: mercado negro.
  katana: { nome: 'Katana', dano: 30, knock: 2.5, alcance: 1.3, alvos: 2, antecipa: 110, recupera: 260, forte: true, hitstop: 110, usos: 15 },
  marreta: { nome: 'Marreta', dano: 38, knock: 10, alcance: 1.1, alvos: 2, antecipa: 330, recupera: 560, forte: true, hitstop: 170, usos: 6 },
  // Fatia 5: a carga é o `antes` (2 s plantado) e o feixe é o `depois`; o dano vai pela frente do feixe (ver rajada).
  rajada: { nome: 'Rajada do Fiado', dano: 100, knock: 14, alcance: 0, alvos: 0, antecipa: 2000, recupera: 1400, forte: true, hitstop: 0, usos: 1 },
  // Fatia 12: ingredientes (fracos sozinhos), a raquete do choque e o que sai das receitas. Nenhuma receita passa
  // as armas pagas do mercado (katana 30/15, soco-inglês 16/20).
  pano: { nome: 'Pano de prato', dano: 3, knock: 1, alcance: 1.0, alvos: 1, antecipa: 80, recupera: 180, forte: false, hitstop: 40, usos: 4 },
  prego: { nome: 'Prego', dano: 6, knock: 0.5, alcance: 0.85, alvos: 1, antecipa: 70, recupera: 170, forte: false, hitstop: 50, usos: 2 },
  fita: { nome: 'Fita isolante', dano: 2, knock: 0.5, alcance: 0.85, alvos: 1, antecipa: 70, recupera: 170, forte: false, hitstop: 40, usos: 2 },
  raquete: { nome: 'Raquete mata-moscas', dano: 8, knock: 2.5, alcance: 1.1, alvos: 1, antecipa: 100, recupera: 240, forte: false, hitstop: 70, usos: 10 },
  molotov: { nome: 'Molotov de cachaça', dano: 18, knock: 4, alcance: 1.0, alvos: 1, antecipa: 160, recupera: 380, forte: true, hitstop: 100, usos: 1 },
  tacoprego: { nome: 'Taco com prego', dano: 24, knock: 4.5, alcance: 1.45, alvos: 2, antecipa: 180, recupera: 400, forte: true, hitstop: 110, usos: 4 },
  espuma: { nome: 'Jato de espuma', dano: 6, knock: 7, alcance: 1.6, alvos: 3, antecipa: 120, recupera: 320, forte: false, hitstop: 60, usos: 6 },
  sococaco: { nome: 'Soco de caco', dano: 14, knock: 3, alcance: 0.95, alvos: 1, antecipa: 70, recupera: 170, forte: false, hitstop: 70, usos: 10 },
};

/** Efeito próprio de cada item novo no alvo: atordoa mais (frigideira, extintor) ou faz escorregar (rodo, placa). */
const ATORDOA: Partial<Record<Arma, number>> = { frigideira: 900, extintor: 1000 };
const ESCORREGA: ReadonlySet<Arma> = new Set<Arma>(['rodo', 'placa']);

/** Arma que corta (mutila no nocaute, no modo sangue) e a chance de arrancar alguma coisa. */
export const CORTE: Partial<Record<Arma, number>> = { serra: 0.9, machadinha: 0.7, katana: 0.8, faca: 0.35, espeto: 0.3, caco: 0.2 };
export type Parte = 'cabeca' | 'braco' | 'perna';
/** Cerveja da geladeira: cura 25, ou 50 na happy hour. */
export const CERVEJA = 25;

/* ------------------------------------------------------------------ estado */

/** `amigo` = desmaiado no canto (offline); `remoto` = amigo online, de pé, movido pela rede. */
export type Quem = 'eu' | 'npc' | 'amigo' | 'remoto';
export type Estado = 'normal' | 'ko' | 'segurado' | 'voando';
export type Humor = 'calmo' | 'briga' | 'foge' | 'voltando' | 'abaixado' | 'arrastando' | 'saindo' | 'limpando';

export interface Corpo {
  id: string;
  quem: Quem;
  nome: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Para onde olha (vetor unitário, em ladrilhos). */
  fx: number;
  fy: number;
  vida: number;
  vidaMax: number;
  estado: Estado;
  andando: boolean;
  pose: Pose;
  /** Golpe em andamento: antecipação até `faseAte`, depois recuperação. */
  fase: 'nada' | 'antes' | 'depois';
  faseAte: number;
  golpe: Golpe | null;
  combo: number;
  comboAte: number;
  buffer: number;
  arma: { tipo: Arma; usos: number } | null;
  segurando: string | null;
  seguradoPor: string | null;
  seguradoDesde: number;
  koAte: number;
  atordoadoAte: number;
  ultimoDano: number;
  flashAte: number;
  /** IA: humor, alvo, de onde fugir e até quando. */
  humor: Humor;
  alvo: string | null;
  fugirDe: [number, number] | null;
  humorAte: number;
  rota: { para: number; pts: [number, number][]; em: number } | null;
  /** Quem jogou este corpo (para o boliche contar quem fez). */
  lancadoPor: string | null;
  /** Arremessado e ainda no ar: atrito de voo (menor que o do knockback). */
  voo: boolean;
  /** Rabiscos na cara (amigos desmaiados). */
  ink: number;
  deitado: Deitado | null;
  /** NPC de turno fora do bar agora (não desenha, não colide, não pensa). */
  ausente: boolean;
  /** Quem é este NPC (frequente ou cliente novo sorteado); null para você e os amigos. */
  npc: Npc | null;
  /** Seu Zé: o serviço em andamento e se já pegou a mobília nova no depósito. */
  tarefa: Tarefa | null;
  carga: boolean;
  /** Último carro que passou por cima (um carro atropela uma vez só). */
  carro: number;
  /** Ao vivo: NPC que um amigo está controlando (marionete aqui: segue o retrato dele, sem pensar). */
  dono: string | null;
  /** Ao vivo: NPC "seu" até esta hora (você bateu, agarrou ou ele brigou com você): você manda o retrato dele. */
  quenteAte: number;
  /** O que foi arrancado no nocaute (só aparece no modo sangue). */
  /** Partes arrancadas (máscara: braço esq. 1, braço dir. 2, perna esq. 4, perna dir. 8, cabeça 16). */
  cortes: number;
  /** Quem arrancou por último (o nocaute por sangramento conta para ele). */
  cortadoPor: string | null;
  /** Até quando não escorrega de novo no molhado. */
  escorregouAte?: number;
  /** Última parada da rotina vista (a Dona Maria fala quando sai para limpar). */
  parada?: number;
  /** Fatia 12: status ativos (até quando), quando apertou aparar por último e quando tentou (recarga). */
  st: Estados;
  aparaEm: number;
  aparaTentou: number;
}

/** Dinheiro que cai de quem você nocauteia (pega passando por cima). */
export interface Grana {
  x: number;
  y: number;
  v: number;
  ate: number;
}

/** Serviço do Seu Zé: recolher um corpo ou repor um móvel quebrado (índice em PROPS). */
export type Tarefa = { k: 'corpo'; id: string } | { k: 'repor'; i: number; apos: number };

export interface NoChao {
  arma: Arma;
  x: number;
  y: number;
  /** 0 = está lá; senão, a hora em que volta. */
  volta: number;
  /** Largada por alguém (troca no E): guarda os usos que sobraram e some quando pegam (não volta). */
  solto?: boolean;
  usos?: number;
  /** Fatia 12: arremessada por quem e quando caiu (dá para pegar no ar com K logo depois). */
  dono?: string;
  quica?: number;
}

/** Quantas armas largadas ficam no chão ao mesmo tempo (a mais antiga some). */
export const MAX_SOLTOS = 12;

/** Troca no E: a arma da mão cai no chão com os usos que sobraram. */
function largarNoChao(m: Mundo, c: Corpo) {
  if (!c.arma) return;
  m.chao.push({ arma: c.arma.tipo, x: c.x, y: c.y, volta: 0, solto: true, usos: c.arma.usos });
  const soltos = m.chao.filter((a) => a.solto);
  if (soltos.length > MAX_SOLTOS) m.chao.splice(m.chao.indexOf(soltos[0]), 1);
  c.arma = null;
}

export type Evento =
  | { k: 'golpe'; x: number; y: number; dano: number; forte: boolean; arma: Arma | null; em: string; de: string; dx: number; dy: number }
  | { k: 'ko'; x: number; y: number; em: string; de: string }
  | { k: 'frase'; x: number; y: number; texto: string; cor: string; em?: string; tema?: string }
  | { k: 'parede'; x: number; y: number }
  | { k: 'quebra'; x: number; y: number; arma: Arma }
  // Fatia 12: status que pegou, cruzamento, aparada, carga subindo de nível, receita, item que quicou e pega no ar.
  | { k: 'status'; x: number; y: number; em: string; st: Status }
  | { k: 'cruza'; x: number; y: number; em: string; tipo: 'choque' | 'apaga' | 'chamas' }
  | { k: 'apara'; x: number; y: number; em: string; de: string; arma: Arma }
  | { k: 'carregando'; x: number; y: number; em: string; nivel: 1 | 2 }
  | { k: 'receita'; nome: string; arma: Arma }
  | { k: 'quica'; x: number; y: number; arma: Arma }
  | { k: 'pegou'; arma: Arma }
  | { k: 'jogo'; jogo: Jogo; nome: string }
  | { k: 'porta'; nome: string }
  /** Fatia 17: você abriu a geladeira (com ou sem cerveja liberada): o dinossauro perto leva susto. */
  | { k: 'geladeira'; x: number; y: number }
  | { k: 'happy'; comeca: boolean }
  | { k: 'treta'; a: string; b: string; ia: string; ib: string }
  | { k: 'aviso'; texto: string }
  | { k: 'bigode'; em: string; n: number }
  | { k: 'quebrou'; i: number; kind: Kind; x: number; y: number }
  | { k: 'reposto'; i: number }
  | { k: 'recolhido'; nome: string }
  | { k: 'chegou'; nome: string }
  | { k: 'atropelo'; x: number; y: number; em: string; dir: number }
  /** Modo sangue: arrancou uma parte (cabeça, braço ou perna) no nocaute. */
  | { k: 'escorrega'; x: number; y: number; em: string }
  | { k: 'mutila'; x: number; y: number; em: string; parte: Parte; lado: 'e' | 'd' | null; dx: number; dy: number; arma: Arma | null }
  | { k: 'grana'; v: number }
  | { k: 'levou'; i: number; arma: Arma }
  | { k: 'rocky'; texto: string }
  /** Seu golpe acertou quem é decidido em outro aparelho (amigo online): vai pela rede para o dono aplicar. */
  | { k: 'acerto'; em: string; dano: number; kx: number; ky: number; arma: Arma | null; forte: boolean }
  /** Rajada do Fiado: começou a carregar (o som e a aura) e disparou (o feixe sai de x, y na direção fx, fy). */
  | { k: 'carga'; em: string; x: number; y: number; tipo?: Arma }
  /** Fatia 6: um poder novo disparou (o desenho usa a mesma geometria do motor). */
  | { k: 'poder'; em: string; tipo: PoderNovo; x: number; y: number; fx: number; fy: number; cx: number; cy: number; len: number; alvos: string[] }
  | { k: 'rajada'; em: string; x: number; y: number; fx: number; fy: number; len: number }
  /** Fatia 10: o seu golpe acertou um bicho de evento (ratazana...), que não é corpo do motor. */
  | { k: 'extra'; id: string; x: number; y: number; dano: number; forte: boolean; arma: Arma | null; dx: number; dy: number };

/** Fatia 10: alvo de evento (posição dada pelo evento, função do tempo); o motor só diz se o seu golpe pegou. */
export interface Extra {
  id: string;
  x: number;
  y: number;
  raio: number;
  /** Fatia 11: corpo que o bicho está segurando (o NPC no feixe do disco): o seu golpe não pega nele. */
  protege?: string;
}

export interface Mundo {
  t: number;
  corpos: Corpo[];
  chao: NoChao[];
  /** Feixes da Rajada do Fiado no ar (os de amigos são só desenho: o dano deles vem pela rede). */
  rajadas: Rajada[];
  /** Fatia 6: disparos dos poderes novos no ar e o fogo no chão da Pinga. */
  poderes: Disparo[];
  fogos: { x: number; y: number; ate: number; de: string; zona: ReturnType<typeof zonaDe> }[];
  /** Quanto você aprontou recentemente (o Tonhão vem quando passa de CALOR_LEAO). */
  calor: number;
  hitstopAte: number;
  trauma: number;
  semente: number;
  eventos: Evento[];
  /** Fatia 10: bichos de evento que o seu golpe pode acertar (o desenho põe e tira). */
  extras: Extra[];
  nocautes: number;
  cervejaAte: number;
  fraseAte: number;
  happy: boolean;
  /** Próxima briga que estoura sozinha (hora) e a janela dela. */
  proxBriga: number;
  janela: number;
  /** Móveis quebrados (índice em PROPS → hora) e os ladrilhos que ficaram livres (mesa quebrada não segura ninguém). */
  quebrados: Map<number, number>;
  livres: Set<number>;
  /** Fila de serviço do Seu Zé e os clientes novos a caminho. */
  tarefas: Tarefa[];
  chegadas: { em: number; id: string }[];
  avulsos: number;
  grana: Grana[];
  /** Fatia 12: o item deixado no canto do balcão esperando o par da receita. */
  bancada: { arma: Arma; usos: number } | null;
}

export interface Entrada {
  /** Direção desejada em ladrilhos (comprimento até 1). */
  mx: number;
  my: number;
  soco: boolean;
  agarra: boolean;
  usa: boolean;
  /** Fatia 12: o botão de golpe continua apertado (carga) e o aparar (L). */
  segura?: boolean;
  apara?: boolean;
}

export const PARADO: Entrada = { mx: 0, my: 0, soco: false, agarra: false, usa: false };

/** Ladrilhos liberados por móvel quebrado no mundo que está andando agora (o passo aponta para o dele). */
let LIVRES: ReadonlySet<number> = new Set();

/* ------------------------------------------------------------------ sorteio determinístico */

export function sorteia(m: Mundo): number {
  m.semente = (m.semente + 0x6d2b79f5) >>> 0;
  let t = m.semente;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------ montar o mundo */

function corpo(id: string, quem: Quem, nome: string, x: number, y: number, vida: number): Corpo {
  return {
    id, quem, nome, x, y, vx: 0, vy: 0, fx: 0, fy: 1, vida, vidaMax: vida, estado: 'normal', andando: false, pose: 'stand',
    fase: 'nada', faseAte: 0, golpe: null, combo: 0, comboAte: 0, buffer: 0, arma: null, segurando: null, seguradoPor: null,
    seguradoDesde: 0, koAte: 0, atordoadoAte: 0, ultimoDano: -1e12, flashAte: 0, humor: 'calmo', alvo: null, fugirDe: null,
    humorAte: 0, rota: null, lancadoPor: null, voo: false, ink: 0, deitado: null, ausente: false, npc: null, tarefa: null,
    carga: false, carro: -1e9, dono: null, quenteAte: 0, cortes: 0, cortadoPor: null, st: {}, aparaEm: -1e9, aparaTentou: -1e9,
  };
}

export function novoMundo(eu: AmigoId, t: number, semente = 1): Mundo {
  const corpos: Corpo[] = [corpo('eu', 'eu', eu, ENTRADA[0], ENTRADA[1], VIDA_EU)];
  corpos[0].fy = -1;
  for (const n of NPCS) {
    const r = rotinaEm(n, t);
    const c = corpo(n.id, 'npc', n.nome, r.x, r.y, FICHAS[n.tipo].vida);
    c.pose = r.pose;
    c.npc = n;
    c.ausente = n.turno === 'happy' && !happyHour(t);
    corpos.push(c);
  }
  for (const id of Object.keys(CANTOS) as AmigoId[]) {
    if (id === eu) continue;
    const k = CANTOS[id];
    const c = corpo(`amigo:${id}`, 'amigo', id, k.at[0], k.at[1], 1);
    c.estado = 'ko';
    c.deitado = k.pose;
    c.koAte = Infinity;
    corpos.push(c);
  }
  const livres = new Set<number>();
  LIVRES = livres; // o mundo novo passa a valer para a colisão (inclusive a previsão dos amigos)
  return {
    t, corpos, rajadas: [], poderes: [], fogos: [], chao: ARMAS_NO_CHAO.map((a) => ({ arma: a.arma, x: a.at[0] + 0.5, y: a.at[1] + 0.5, volta: 0 })),
    calor: 0, hitstopAte: 0, trauma: 0, semente: semente >>> 0, eventos: [], extras: [], nocautes: 0, cervejaAte: 0, fraseAte: 0,
    happy: happyHour(t), ...agendaBriga(t), quebrados: new Map(), livres, tarefas: [], chegadas: [], avulsos: 0, grana: [], bancada: null,
  };
}

/** A próxima briga sozinha a partir da hora t (a desta janela, se ainda não passou; senão a da seguinte). */
export function agendaBriga(t: number): { proxBriga: number; janela: number } {
  let j = Math.floor(t / JANELA_BRIGA);
  if (brigaDaJanela(j).em <= t) j++;
  return { proxBriga: brigaDaJanela(j).em, janela: j };
}

export const achar = (m: Mundo, id: string | null) => (id ? m.corpos.find((c) => c.id === id) : undefined);
export const eu = (m: Mundo) => m.corpos[0];
const npcDe = (c: Corpo): Npc | undefined => c.npc ?? undefined;
/** Distância em ladrilhos; entre áreas diferentes (salão × banheiro) é infinita: ninguém briga, ouve ou persegue através da parede. */
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  zonaDe(a.x, a.y) === zonaDe(b.x, b.y) ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity;
export const caido = (c: Corpo) => c.estado === 'ko';

/**
 * Fatia 15: quem caiu e levanta sozinho (você, funcionário do bar, amigo online) pode ser levantado por alguém parado do
 * lado. Cliente nocauteado não (fica para o Seu Zé arrastar), nem bicho de evento (levantar o monstro seria tiro no pé),
 * nem quem está sendo arrastado, nem o amigo que dorme no canto.
 */
export function podeLevantar(c: Corpo): boolean {
  if (c.estado !== 'ko' || c.seguradoPor || c.ausente || c.dono || !Number.isFinite(c.koAte) && c.quem !== 'remoto') return false;
  if (c.quem === 'remoto' || c.quem === 'eu') return true;
  return c.quem === 'npc' && !!c.npc && FUNCIONARIOS.includes(c.npc.tipo);
}
/** Levanta agora (o resto do levantar, vida e humor, é o de sempre no próximo passo). */
export function levantar(m: Mundo, c: Corpo): boolean {
  if (!podeLevantar(c) || c.quem === 'remoto') return false;
  c.koAte = m.t;
  return true;
}
const dePe = (c: Corpo) => c.estado === 'normal' || c.estado === 'voando';

/** Frases que sempre saem; as outras respeitam um intervalo, para o narrador não virar ruído. */
const SEMPRE: ReadonlySet<Tema> = new Set<Tema>(['mutila', 'mutila_cabeca', 'ko', 'eu_ko', 'leao', 'leao_vem', 'bigode', 'cerveja', 'ze', 'ze_limpa', 'ze_repoe', 'maria_vem']);
export const INTERVALO_FRASE = 900;

function falar(m: Mundo, c: { x: number; y: number }, tema: Tema, cor = '#feae34') {
  if (!SEMPRE.has(tema)) {
    if (m.t < m.fraseAte) return;
    m.fraseAte = m.t + INTERVALO_FRASE;
  }
  const em = 'id' in c && typeof (c as { id?: unknown }).id === 'string' ? (c as { id: string }).id : undefined;
  m.eventos.push({ k: 'frase', x: c.x, y: c.y, texto: frase(tema, sorteia(m)), cor, em, tema });
}

/* ------------------------------------------------------------------ colisão com o cenário */

function bate(x: number, y: number): boolean {
  const x0 = Math.floor(x - RAIO);
  const x1 = Math.floor(x + RAIO);
  const y0 = Math.floor(y - RAIO);
  const y1 = Math.floor(y + RAIO);
  for (let tx = x0; tx <= x1; tx++)
    for (let ty = y0; ty <= y1; ty++) {
      if (anda(tx, ty) || LIVRES.has(tx * 64 + ty) || (ty === RUA && tx >= 0 && tx <= FIM_PATIO)) continue;
      const cx = Math.max(tx, Math.min(x, tx + 1));
      const cy = Math.max(ty, Math.min(y, ty + 1));
      if ((x - cx) ** 2 + (y - cy) ** 2 < RAIO * RAIO) return true;
    }
  return false;
}

/** Move com deslize nas paredes; devolve se bateu (e em qual eixo). */
function mover(c: Corpo, dx: number, dy: number): boolean {
  let bateu = false;
  if (dx && !bate(c.x + dx, c.y)) c.x += dx;
  else if (dx) bateu = true;
  if (dy && !bate(c.x, c.y + dy)) c.y += dy;
  else if (dy) bateu = true;
  return bateu;
}

/* ------------------------------------------------------------------ dano */

function sacudir(m: Mundo, q: number) {
  m.trauma = Math.min(1, m.trauma + q);
}

/** Aplica um golpe em `alvo` vindo de `de` na direção (dx, dy). */
export function ferir(m: Mundo, alvo: Corpo, de: Corpo, g: Golpe, dx: number, dy: number, arma: Arma | null = null) {
  if (de.quem === 'npc' && de.cortes & 3) g = { ...g, dano: Math.max(1, Math.round(g.dano * fatorBracos(de))) };
  const n = Math.hypot(dx, dy) || 1;
  const ux = dx / n;
  const uy = dy / n;
  if (alvo.quem === 'amigo') {
    // Amigo desmaiado: escorrega um pouco e ronca. Não perde nada.
    alvo.vx += ux * 2.5;
    alvo.vy += uy * 2.5;
    alvo.flashAte = m.t + 60;
    falar(m, alvo, 'chute_amigo', '#94b0c2');
    return;
  }
  if (deFora(alvo)) {
    // Quem bate decide: sangue e congelamento aqui na hora; vida, empurrão e nocaute o aparelho dele aplica
    // (amigo online, ou o NPC que está com um amigo).
    alvo.flashAte = m.t + FLASH_MS;
    m.hitstopAte = Math.max(m.hitstopAte, m.t + hitstopDe(g));
    sacudir(m, traumaDe(g));
    m.eventos.push({ k: 'golpe', x: alvo.x, y: alvo.y, dano: g.dano, forte: g.forte, arma, em: alvo.id, de: de.id, dx: ux, dy: uy });
    // Vai pela rede o seu golpe, e o do NPC que está com você num amigo online.
    // (o NPC que bate num amigo fica com você enquanto bate: na tela dele, vira sua marionete, sem golpe fantasma)
    if (de.quem === 'npc' && !de.dono && alvo.quem === 'remoto') de.quenteAte = m.t + QUENTE_MS;
    if (de.quem === 'eu' || (de.quem === 'npc' && !de.dono && alvo.quem === 'remoto'))
      m.eventos.push({ k: 'acerto', em: alvo.quem === 'remoto' ? alvo.nome : alvo.id, dano: Math.round(g.dano), kx: ux, ky: uy, arma, forte: g.forte });
    if (!caido(alvo)) espalhar(m, alvo, de);
    return;
  }
  // Ao vivo: o NPC que briga com você (ou que um amigo acerta aqui) fica com você por 3 s.
  if (alvo.quem === 'npc' && (de.quem === 'eu' || de.quem === 'remoto')) alvo.quenteAte = m.t + QUENTE_MS;
  if (alvo.quem === 'eu' && de.quem === 'npc' && !de.dono) de.quenteAte = m.t + QUENTE_MS;
  const jaCaido = caido(alvo);
  alvo.vida = Math.max(0, alvo.vida - g.dano);
  alvo.ultimoDano = m.t;
  alvo.flashAte = m.t + FLASH_MS;
  const k = jaCaido ? Math.min(1.5, g.knock) : g.knock;
  alvo.vx += ux * k;
  alvo.vy += uy * k;
  if (!jaCaido) {
    alvo.atordoadoAte = Math.max(alvo.atordoadoAte, m.t + (arma && ATORDOA[arma] ? ATORDOA[arma]! : g.forte ? 450 : 250));
    alvo.fase = 'nada';
    alvo.golpe = null;
    if (arma && (ESCORREGA.has(arma) || arma === 'espuma')) {
      // Rodo, placa e espuma: quem apanha perde o pé e desliza. Fatia 12: molhado, derrapa bem mais longe.
      const mol = (alvo.st.molhado ?? 0) > m.t;
      alvo.atordoadoAte = Math.max(alvo.atordoadoAte, m.t + (mol ? 1300 : 900));
      alvo.vx += ux * (mol ? 5 : 2);
      alvo.vy += uy * (mol ? 5 : 2);
      m.eventos.push({ k: 'escorrega', x: alvo.x, y: alvo.y, em: alvo.id });
    }
  }
  // Fatia 8: golpe normal congela no máximo 110 ms (atacante e alvo juntos: o mundo inteiro para) e só o pesado sacode.
  m.hitstopAte = Math.max(m.hitstopAte, m.t + hitstopDe(g));
  sacudir(m, traumaDe(g));
  m.eventos.push({ k: 'golpe', x: alvo.x, y: alvo.y, dano: g.dano, forte: g.forte, arma, em: alvo.id, de: de.id, dx: ux, dy: uy });
  if (jaCaido && de.quem === 'eu' && sorteia(m) < 0.15) falar(m, alvo, 'chao', '#e43b44');
  if (!jaCaido && alvo.vida > 0 && alvo.quem === 'npc' && arma && CORTE[arma] && sorteia(m) < CORTE[arma]! * Math.min(1, g.dano / 25) * 0.55)
    arrancar(m, alvo, de, arma, false);
  // Fatia 12: o status da arma pega em quem apanhou (e cruza com o que ele já tinha).
  const stArma = arma ? STATUS_DA_ARMA[arma] : undefined;
  if (stArma && !jaCaido && alvo.vida > 0) darStatus(m, alvo, stArma, de);
  if (!jaCaido && alvo.vida <= 0) nocautear(m, alvo, de, arma, g.dano);
  else if (!jaCaido) reagir(m, alvo, de);
  espalhar(m, alvo, de);
}

/* ------------------------------------------------------------------ status (Fatia 12) */

/** Corpo de mentira para nocaute sem dono (fogo que sobrou, raio de evento): não conta ponto para ninguém. */
const semDono = (c: Corpo): Corpo => ({ ...c, id: 'evento', quem: 'npc' });

/**
 * Põe o status `s` em `alvo` e resolve o cruzamento com o que ele já tinha. Status é da simulação deste aparelho:
 * amigo desmaiado, amigo online e NPC de outro aparelho não pegam.
 */
export function darStatus(m: Mundo, alvo: Corpo, s: Status, de: Corpo | null) {
  if (alvo.quem === 'amigo' || deFora(alvo) || alvo.ausente || caido(alvo)) return;
  const r = aplicar(alvo.st, s, m.t);
  alvo.st = r.st;
  if (s === 'eletrico' && r.efeito !== 'apaga') alvo.atordoadoAte = Math.max(alvo.atordoadoAte, m.t + ELETRICO_TRAVA);
  m.eventos.push({ k: 'status', x: alvo.x, y: alvo.y, em: alvo.id, st: s });
  if (!r.efeito) return;
  m.eventos.push({ k: 'cruza', x: alvo.x, y: alvo.y, em: alvo.id, tipo: r.efeito });
  if (r.efeito === 'chamas') {
    m.fogos.push({ x: alvo.x, y: alvo.y, ate: m.t + 4000, de: de?.id ?? alvo.id, zona: zonaDe(alvo.x, alvo.y) });
    return;
  }
  if (r.efeito === 'choque') {
    // Molhado + elétrico: o choque passa para todo molhado em volta (e para o alvo).
    for (const o of m.corpos) {
      if (o.quem === 'amigo' || deFora(o) || o.ausente || caido(o)) continue;
      if (o !== alvo && ((o.st.molhado ?? 0) <= m.t || Math.hypot(o.x - alvo.x, o.y - alvo.y) > CHOQUE.raio)) continue;
      o.atordoadoAte = Math.max(o.atordoadoAte, m.t + CHOQUE.atordoa);
      o.vida = Math.max(0, o.vida - CHOQUE.dano);
      o.ultimoDano = m.t;
      o.flashAte = m.t + FLASH_MS;
      o.fase = 'nada';
      o.golpe = null;
      if (o.vida <= 0) nocautear(m, o, de && de !== o ? de : semDono(o), null, CHOQUE.dano);
    }
    sacudir(m, 0.3);
  }
}

/** Status a cada passo: o fogo queima, o chão molhado da Dona Maria molha, o fogo no chão põe fogo. */
function passoStatus(m: Mundo, dt: number) {
  const poças = molhadosEm(m.t);
  for (const c of m.corpos) {
    if (c.quem === 'amigo' || deFora(c) || c.ausente || caido(c)) continue;
    const z = zonaDe(c.x, c.y);
    if ((c.st.queimando ?? 0) <= m.t + 500 && m.fogos.some((f) => f.zona === z && Math.hypot(c.x - f.x, c.y - f.y) < FOGO_RAIO))
      darStatus(m, c, 'queimando', achar(m, m.fogos.find((f) => Math.hypot(c.x - f.x, c.y - f.y) < FOGO_RAIO)!.de) ?? null);
    if ((c.st.molhado ?? 0) <= m.t + 1000 && poças.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < RAIO_MOLHADO)) darStatus(m, c, 'molhado', null);
    if ((c.st.queimando ?? 0) > m.t && !caido(c)) {
      c.vida = Math.max(0, c.vida - QUEIMA_DANO_S * dt);
      c.ultimoDano = m.t;
      if (c.vida <= 0) nocautear(m, c, semDono(c), null, 0);
    }
  }
}

function nocautear(m: Mundo, alvo: Corpo, de: Corpo, arma: Arma | 'carro' | null = null, dano = 0) {
  alvo.estado = 'ko';
  alvo.fase = 'nada';
  alvo.golpe = null;
  soltar(m, alvo);
  if (alvo.seguradoPor) {
    const h = achar(m, alvo.seguradoPor);
    if (h) h.segurando = null;
    alvo.seguradoPor = null;
  }
  m.hitstopAte = Math.max(m.hitstopAte, m.t + HITSTOP_FINAL);
  sacudir(m, 0.3);
  m.eventos.push({ k: 'ko', x: alvo.x, y: alvo.y, em: alvo.id, de: de.id });
  if (alvo.quem === 'eu') {
    alvo.koAte = m.t + KO_EU_MS;
    falar(m, alvo, 'eu_ko', '#e43b44');
    if (de.id === 'tonhao') {
      // Quem perde sai carregado: o Tonhão arrasta você para a sarjeta.
      de.humor = 'arrastando';
      de.segurando = alvo.id;
      alvo.seguradoPor = de.id;
      alvo.estado = 'segurado';
      alvo.koAte = Infinity;
      de.rota = null;
    }
    return;
  }
  const [a, b] = KO_NPC_MS;
  const nn = npcDe(alvo);
  if (nn && !FUNCIONARIOS.includes(nn.tipo)) {
    // Cliente não levanta: fica no chão até o Seu Zé arrastar para o depósito.
    alvo.koAte = Infinity;
    if (!m.tarefas.some((x) => x.k === 'corpo' && x.id === alvo.id)) m.tarefas.push({ k: 'corpo', id: alvo.id });
  } else alvo.koAte = m.t + a + sorteia(m) * (b - a);
  alvo.humor = 'calmo';
  alvo.alvo = null;
  mutilar(m, alvo, de, arma, dano);
  if (de.quem === 'eu' && alvo.quem === 'npc') soltarGrana(m, alvo);
  if (de.quem === 'eu') {
    m.nocautes++;
    m.calor += 1;
    falar(m, alvo, 'ko', '#e43b44');
    if (m.calor >= CALOR_LEAO) chamarLeao(m);
  }
}

/** As cinco partes que saem (Fatia 4: aos poucos, uma por golpe; a cabeça só no golpe que derruba). */
const PARTES: readonly { bit: number; parte: Parte; lado: 'e' | 'd' | null }[] = [
  { bit: 1, parte: 'braco', lado: 'e' },
  { bit: 2, parte: 'braco', lado: 'd' },
  { bit: 4, parte: 'perna', lado: 'e' },
  { bit: 8, parte: 'perna', lado: 'd' },
  { bit: 16, parte: 'cabeca', lado: null },
];
const TEM_CABECA = 16;
/** Vida que cada toco tira por segundo (sangramento). */
export const SANGRA_POR_TOCO = 0.8;

/** Sem perna anda mancando (50 %); sem as duas, rasteja (25 %). */
export function fatorPernas(c: Corpo): number {
  const n = ((c.cortes >> 2) & 1) + ((c.cortes >> 3) & 1);
  return n === 0 ? 1 : n === 1 ? 0.5 : 0.25;
}
/** Sem um braço bate 30 % mais fraco; sem os dois, só chute e cabeçada (40 %). */
export function fatorBracos(c: Corpo): number {
  const n = (c.cortes & 1) + ((c.cortes >> 1) & 1);
  return n === 0 ? 1 : n === 1 ? 0.7 : 0.4;
}
const tocos = (c: Corpo) => (c.cortes & 1) + ((c.cortes >> 1) & 1) + ((c.cortes >> 2) & 1) + ((c.cortes >> 3) & 1);

/**
 * Arranca a próxima parte: braços primeiro (um lado sorteado), depois as pernas; a cabeça só quando `final` (o golpe
 * que derruba), metade das vezes, ou se não sobrou mais nada.
 */
function arrancar(m: Mundo, alvo: Corpo, de: Corpo, arma: Arma | null, final: boolean): boolean {
  if (alvo.quem !== 'npc' || alvo.cortes & TEM_CABECA) return false;
  const bracos = [1, 2].filter((b) => !(alvo.cortes & b));
  const pernas = [4, 8].filter((b) => !(alvo.cortes & b));
  let bit = 0;
  if (final && (sorteia(m) < 0.5 || (!bracos.length && !pernas.length))) bit = TEM_CABECA;
  else if (bracos.length) bit = bracos[Math.floor(sorteia(m) * bracos.length)];
  else if (pernas.length) bit = pernas[Math.floor(sorteia(m) * pernas.length)];
  if (!bit) return false;
  alvo.cortes |= bit;
  alvo.cortadoPor = de.id;
  const p = PARTES.find((x) => x.bit === bit)!;
  const n = Math.hypot(alvo.x - de.x, alvo.y - de.y) || 1;
  m.eventos.push({ k: 'mutila', x: alvo.x, y: alvo.y, em: alvo.id, parte: p.parte, lado: p.lado, dx: (alvo.x - de.x) / n, dy: (alvo.y - de.y) / n, arma });
  falar(m, alvo, p.parte === 'cabeca' ? 'mutila_cabeca' : 'mutila', '#e43b44');
  return true;
}

/** No nocaute: arma que corta (ou carro, ou pancada muito forte) pode levar mais uma parte, e aí a cabeça pode ir. */
function mutilar(m: Mundo, alvo: Corpo, de: Corpo, arma: Arma | 'carro' | null, dano: number) {
  if (alvo.quem !== 'npc' || alvo.cortes & TEM_CABECA) return;
  const chance = arma === 'carro' ? 0.5 : arma && CORTE[arma] !== undefined ? CORTE[arma]! : dano >= 30 ? 0.12 : 0;
  if (sorteia(m) >= chance) return;
  arrancar(m, alvo, de, arma === 'carro' ? null : arma, true);
}

const MARIA = NPCS.find((n) => n.id === 'maria')!;
/** Onde o chão está molhado agora (a Dona Maria passou o pano há menos de 20 s). Igual em todo aparelho. */
export function molhadosEm(t: number): { x: number; y: number; ate: number }[] {
  return molhadosDa(MARIA, t, MOLHADO_MS);
}
/** Raio da poça (ladrilhos) e a chance, por segundo andando nela, de escorregar. */
export const RAIO_MOLHADO = 0.75;
/** Fatia 6: ela passa 3× mais vezes, então cada poça escorrega menos. */
const ESCORREGA_POR_S = 1.2;

/** Quem anda no molhado pode escorregar: fica tonto, desliza para a frente e leva bronca do narrador. */
function escorregar(m: Mundo, dt: number) {
  const poças = molhadosEm(m.t);
  if (!poças.length) return;
  for (const c of m.corpos) {
    if (c.ausente || c.dono || c.estado !== 'normal' || c.id === 'maria' || !c.andando) continue;
    if (c.quem !== 'eu' && c.quem !== 'npc') continue;
    if (m.t < (c.escorregouAte ?? 0) || m.t < c.atordoadoAte) continue;
    if (!poças.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < RAIO_MOLHADO)) continue;
    if (sorteia(m) >= 1 - Math.exp(-ESCORREGA_POR_S * dt)) continue;
    c.escorregouAte = m.t + 3000;
    c.atordoadoAte = m.t + 900;
    c.vx += c.fx * 3.2;
    c.vy += c.fy * 3.2;
    m.eventos.push({ k: 'escorrega', x: c.x, y: c.y, em: c.id });
    falar(m, c, 'escorregou', '#68aed4');
  }
}

/** Tocos sangram: o NPC perde vida aos poucos e, se zerar, cai (conta para quem cortou). */
function sangrar(m: Mundo, dt: number) {
  for (const c of m.corpos) {
    if (c.quem !== 'npc' || c.dono || c.ausente || c.estado !== 'normal' || !tocos(c)) continue;
    c.vida = Math.max(0, c.vida - tocos(c) * SANGRA_POR_TOCO * dt);
    if (c.vida <= 0) nocautear(m, c, (c.cortadoPor && achar(m, c.cortadoPor)) || c, null, 0);
  }
}

/** Quem você derruba deixa cair uns trocados. */
function soltarGrana(m: Mundo, alvo: Corpo) {
  const n = 1 + Math.floor(sorteia(m) * 3);
  for (let i = 0; i < n; i++) {
    const a = sorteia(m) * Math.PI * 2;
    const r = 0.2 + sorteia(m) * 0.45;
    const x = alvo.x + Math.cos(a) * r;
    const y = alvo.y + Math.sin(a) * r;
    if (bate(x, y)) continue;
    m.grana.push({ x, y, v: 2 + Math.floor(sorteia(m) * 5), ate: m.t + GRANA_MS });
  }
}
export const GRANA_MS = 40_000;

function chamarLeao(m: Mundo) {
  const l = achar(m, 'tonhao');
  if (!l || caido(l) || l.humor === 'briga' || l.humor === 'arrastando') return;
  l.humor = 'briga';
  l.alvo = 'eu';
  l.humorAte = Infinity;
  falar(m, l, 'leao_vem', '#e43b44');
}

/** O próprio alvo reage ao apanhar. */
function reagir(m: Mundo, alvo: Corpo, de: Corpo) {
  if (alvo.quem !== 'npc') return;
  const n = npcDe(alvo)!;
  if (n.tipo === 'barman') {
    soltar(m, alvo);
    alvo.tarefa = null;
    alvo.humor = 'abaixado';
    alvo.humorAte = m.t + 6000;
    falar(m, alvo, 'ze', '#feae34');
    return;
  }
  if (n.tipo === 'leao' && de.quem === 'eu') {
    chamarLeao(m);
    return;
  }
  const temp = temperamentoDe(n);
  if (FICHAS[n.tipo].dano > 0 && (temp === 'entra' || temp === 'sorteia' || n.tipo === 'valentao' || alvo.vida > alvo.vidaMax * 0.4)) {
    alvo.humor = 'briga';
    alvo.alvo = de.id;
    alvo.humorAte = m.t + 15000;
  } else {
    fugir(m, alvo, de);
  }
}

function fugir(m: Mundo, c: Corpo, de: { x: number; y: number }) {
  c.humor = 'foge';
  c.fugirDe = [de.x, de.y];
  c.humorAte = m.t + 3500 + sorteia(m) * 2000;
  c.rota = null;
}

/** A briga atrai os valentes e espanta os medrosos em volta. */
function espalhar(m: Mundo, alvo: Corpo, de: Corpo) {
  const contra = alvo.quem === 'eu' ? alvo : de.quem === 'eu' ? de : de;
  for (const c of m.corpos) {
    if (c.quem !== 'npc' || c === alvo || c === de || caido(c) || c.estado !== 'normal' || c.ausente) continue;
    if (c.humor !== 'calmo' && c.humor !== 'voltando') continue;
    if (dist(c, alvo) > RAIO_BRIGA) continue;
    const n = npcDe(c)!;
    const temp: Temperamento = temperamentoDe(n);
    if (n.tipo === 'barman') {
      c.humor = 'abaixado';
      c.humorAte = m.t + 5000;
      if (sorteia(m) < 0.4) falar(m, c, 'ze_abaixa', '#feae34');
      continue;
    }
    if (n.tipo === 'leao' || n.tipo === 'muambeiro' || n.tipo === 'cientista') continue; // ficam no posto
    const entra = temp === 'entra' || (temp === 'sorteia' && sorteia(m) < 0.5);
    if (entra && FICHAS[n.tipo].dano > 0) {
      c.humor = 'briga';
      c.alvo = contra.id;
      c.humorAte = m.t + 15000;
      if (sorteia(m) < 0.5) falar(m, c, 'entra', '#2ce8f5');
    } else {
      fugir(m, c, alvo);
      if (sorteia(m) < 0.3) falar(m, c, 'foge', '#94b0c2');
    }
  }
}

/* ------------------------------------------------------------------ golpes */

function golpeDe(c: Corpo): Golpe {
  if (c.arma) return ARMAS[c.arma.tipo];
  if (c.quem === 'npc') {
    const f = FICHAS[npcDe(c)!.tipo];
    return { dano: f.dano, knock: 3.5, alcance: 1.05, alvos: 1, antecipa: f.antecipa, recupera: f.recupera, forte: false, hitstop: 70 };
  }
  return c.combo === 2 ? EMPURRAO : JAB;
}

function comecarGolpe(m: Mundo, c: Corpo) {
  if (c.quem === 'eu' && !c.arma) c.combo = m.t <= c.comboAte ? (c.combo + 1) % 3 : 0;
  const g = golpeDe(c);
  c.golpe = g;
  c.fase = 'antes';
  c.faseAte = m.t + g.antecipa;
  if (ehPoder(c.arma?.tipo)) m.eventos.push({ k: 'carga', em: c.id, x: c.x, y: c.y, tipo: c.arma!.tipo });
}

/** Quem está ao alcance e na frente (o mais perto primeiro). */
/**
 * Fatia 11: dano de evento (raio do disco grande) sem atacante: não conta nocaute para ninguém, não esquenta o
 * Tonhão, e derruba com o nocaute de sempre (sem perder moeda nem item).
 */
export function ferirPorEvento(m: Mundo, alvo: Corpo, dano: number, dx: number, dy: number) {
  if (alvo.ausente || caido(alvo) || alvo.estado !== 'normal') return;
  const n = Math.hypot(dx, dy) || 1;
  alvo.vida = Math.max(0, alvo.vida - dano);
  alvo.ultimoDano = m.t;
  alvo.flashAte = m.t + FLASH_MS;
  alvo.vx += (dx / n) * 6;
  alvo.vy += (dy / n) * 6;
  alvo.atordoadoAte = Math.max(alvo.atordoadoAte, m.t + 450);
  // Como um golpe: apanhar cancela o golpe que estava preparando (e a carga).
  alvo.fase = 'nada';
  alvo.golpe = null;
  m.hitstopAte = Math.max(m.hitstopAte, m.t + 90);
  sacudir(m, 0.35);
  m.eventos.push({ k: 'golpe', x: alvo.x, y: alvo.y, dano, forte: true, arma: null, em: alvo.id, de: 'evento', dx: dx / n, dy: dy / n });
  // Quem derruba é o evento: um corpo de mentira, de NPC, para o nocaute não contar ponto para ninguém.
  if (alvo.vida <= 0) nocautear(m, alvo, { ...alvo, id: 'evento', quem: 'npc' }, null, dano);
}

/** O golpe de `c` (com alcance `alcance`) pega o bicho `ex`? Mesma regra do corpo: perto e na frente. */
export function acertaExtra(c: { x: number; y: number; fx: number; fy: number }, alcance: number, ex: Extra): boolean {
  const dx = ex.x - c.x;
  const dy = ex.y - c.y;
  const d = Math.hypot(dx, dy);
  if (d > alcance + ex.raio) return false;
  return d < 0.2 || (dx * c.fx + dy * c.fy) / d >= 0.3;
}

export function naFrente(m: Mundo, c: Corpo, alcance: number, max: number, incluiCaidos = true): Corpo[] {
  const out: { c: Corpo; d: number }[] = [];
  for (const o of m.corpos) {
    if (o === c || o.estado === 'segurado' || o.ausente) continue;
    if (!incluiCaidos && caido(o)) continue;
    const dx = o.x - c.x;
    const dy = o.y - c.y;
    const d = Math.hypot(dx, dy);
    if (d > alcance + RAIO || d < 1e-6) continue;
    if ((dx * c.fx + dy * c.fy) / d < 0.3) continue;
    out.push({ c: o, d });
  }
  // De pé antes de caído: o soco vai em quem ainda está brigando.
  out.sort((a, b) => Number(caido(a.c)) - Number(caido(b.c)) || a.d - b.d);
  return out.slice(0, max).map((o) => o.c);
}

function soltarGolpe(m: Mundo, c: Corpo) {
  const g = c.golpe!;
  if (c.arma?.tipo === 'rajada') {
    dispararRajada(m, c);
    c.arma = null; // um uso só (e só aqui: apanhar na carga cancela sem gastar)
    c.fase = 'depois';
    c.faseAte = m.t + g.recupera;
    return;
  }
  if (ehPoder(c.arma?.tipo)) {
    dispararPoder(m, c, c.arma!.tipo as PoderNovo);
    c.arma = null;
    c.fase = 'depois';
    c.faseAte = m.t + g.recupera;
    return;
  }
  // Fatia 12: segurou o botão além da preparação = golpe carregado (o fim da preparação ficou em `faseAte`).
  const nivel = c.quem === 'eu' ? nivelCarga(m.t - c.faseAte) : 0;
  if (nivel) {
    c.golpe = golpeCarregado(g, nivel);
    return soltarGolpeCom(m, c, c.golpe, nivel);
  }
  return soltarGolpeCom(m, c, g, 0);
}

function soltarGolpeCom(m: Mundo, c: Corpo, g: Golpe, nivel: number) {
  const alvos = naFrente(m, c, g.alcance, g.alvos);
  // Fatia 12: você aparou (apertou L até 150 ms antes deste golpe entrar, de frente e com item na mão).
  for (let i = alvos.length - 1; i >= 0; i--) {
    const a = alvos[i];
    if (a.quem !== 'eu' || !a.arma || ehPoder(a.arma.tipo) || !aparou(a.aparaEm, m.t)) continue;
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    if ((dx * a.fx + dy * a.fy) / d < 0.3) continue;
    alvos.splice(i, 1);
    a.aparaEm = -1e9;
    const arma = a.arma.tipo;
    c.atordoadoAte = Math.max(c.atordoadoAte, m.t + APARA_ATORDOA);
    c.vx += (dx / d) * 4;
    c.vy += (dy / d) * 4;
    m.hitstopAte = Math.max(m.hitstopAte, m.t + 90);
    sacudir(m, 0.25);
    m.eventos.push({ k: 'apara', x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, em: a.id, de: c.id, arma });
    gastarArma(m, a); // custa um uso (a garrafa vira caco na hora)
  }
  if (c.quem === 'npc' && c.alvo) {
    // NPC só acerta quem ele está mirando (não sai socando o amigo dele).
    const a = alvos.find((o) => o.id === c.alvo);
    alvos.length = 0;
    if (a) alvos.push(a);
  }
  // Fatia 11: bater no disco não acerta quem ele está levando (salvar o Zé não vira briga com o Zé).
  if (c.quem === 'eu' && m.extras.some((x) => x.protege)) {
    const prot = new Set(m.extras.map((x) => x.protege));
    for (let i = alvos.length - 1; i >= 0; i--) if (prot.has(alvos[i].id)) alvos.splice(i, 1);
  }
  for (const a of alvos) ferir(m, a, c, g, a.x - c.x, a.y - c.y, c.arma?.tipo ?? null);
  // Fatia 10: o seu golpe também pega bicho de evento na frente (o dano vai para o livro de dano do evento).
  if (c.quem === 'eu')
    for (const ex of m.extras)
      if (acertaExtra(c, g.alcance, ex)) {
        m.hitstopAte = Math.max(m.hitstopAte, m.t + hitstopDe(g));
        sacudir(m, traumaDe(g));
        m.eventos.push({ k: 'extra', id: ex.id, x: ex.x, y: ex.y, dano: g.dano, forte: g.forte, arma: c.arma?.tipo ?? null, dx: ex.x - c.x, dy: ex.y - c.y });
      }
  // Marreta: o móvel da frente quebra de uma vez (gasta um uso mesmo sem acertar ninguém).
  if (c.arma?.tipo === 'marreta') {
    const i = propIdx(Math.floor(c.x + c.fx * 0.9), Math.floor(c.y + c.fy * 0.9));
    if (quebrar(m, i, c) && !alvos.length) gastarArma(m, c);
  }
  if (alvos.length && c.quem === 'eu' && !c.arma && c.combo === 2 && sorteia(m) < 0.4) falar(m, c, 'combo', '#feae34');
  // Golpe carregado que pegou: congela mais que o normal (o teto do normal é 110 ms), até o teto do nocaute.
  if (nivel && alvos.length) m.hitstopAte = Math.max(m.hitstopAte, m.t + Math.min(HITSTOP_CARGA_MAX, g.hitstop));
  if (alvos.length && c.arma) gastarArma(m, c);
  c.fase = 'depois';
  c.faseAte = m.t + g.recupera;
  if (c.quem === 'eu') c.comboAte = m.t + g.recupera + JANELA_COMBO;
}

/** Frase do narrador de cada item novo (o violão fala quando quebra; os outros às vezes). */
const FALA_ARMA: Partial<Record<Arma, Tema>> = {
  frigideira: 'frigideira', bastao: 'bastao', violao: 'violao', extintor: 'extintor', guardasol: 'guardasol', tijolo: 'tijolo',
  espeto: 'espeto', placa: 'placa', rodo: 'rodo', katana: 'katana', marreta: 'marreta',
};

function gastarArma(m: Mundo, c: Corpo) {
  const a = c.arma!;
  a.usos--;
  if (a.tipo === 'garrafa') {
    m.eventos.push({ k: 'quebra', x: c.x + c.fx * 0.6, y: c.y + c.fy * 0.6, arma: 'garrafa' });
    if (c.quem === 'eu') falar(m, c, 'garrafa', '#63c74d');
    c.arma = { tipo: 'caco', usos: ARMAS.caco.usos };
    return;
  }
  if (a.tipo === 'cadeira' && c.quem === 'eu' && sorteia(m) < 0.5) falar(m, c, 'cadeira', '#feae34');
  if (a.tipo === 'desentupidor' && c.quem === 'eu' && sorteia(m) < 0.5) falar(m, c, 'desentupidor', '#b55088');
  if (c.quem === 'eu' && FALA_ARMA[a.tipo] && (a.usos <= 0 || sorteia(m) < 0.35)) falar(m, c, FALA_ARMA[a.tipo]!, '#feae34');
  if (a.usos <= 0) {
    m.eventos.push({ k: 'quebra', x: c.x + c.fx * 0.6, y: c.y + c.fy * 0.6, arma: a.tipo });
    c.arma = null;
  }
}

/* ------------------------------------------------------------------ agarrar, arremessar, usar */

function soltar(m: Mundo, c: Corpo) {
  if (!c.segurando) return;
  const s = achar(m, c.segurando);
  c.segurando = null;
  if (!s) return;
  s.seguradoPor = null;
  if (s.estado === 'segurado') s.estado = s.vida <= 0 || s.quem === 'amigo' ? 'ko' : 'normal';
}

function agarrar(m: Mundo, c: Corpo) {
  if (c.segurando) {
    // Arremessa quem está segurando.
    const s = achar(m, c.segurando)!;
    c.segurando = null;
    s.seguradoPor = null;
    s.estado = s.vida <= 0 || s.quem === 'amigo' ? 'ko' : 'voando';
    s.lancadoPor = c.id;
    s.voo = true;
    s.vx = c.fx * VEL_ARREMESSO;
    s.vy = c.fy * VEL_ARREMESSO;
    s.x = c.x + c.fx * 0.55;
    s.y = c.y + c.fy * 0.55;
    if (bate(s.x, s.y)) {
      s.x = c.x;
      s.y = c.y;
    }
    s.flashAte = m.t + 60;
    sacudir(m, 0.2);
    return;
  }
  if (c.arma) {
    arremessarArma(m, c);
    return;
  }
  // Fatia 12: o item que você acabou de jogar ainda está quicando perto: K pega de volta.
  const volta = m.chao.find((q) => q.solto && q.dono === c.id && q.quica !== undefined && m.t - q.quica <= PEGA_MS && Math.hypot(q.x - c.x, q.y - c.y) <= PEGA_RAIO);
  if (volta) {
    m.chao.splice(m.chao.indexOf(volta), 1);
    c.arma = { tipo: volta.arma, usos: volta.usos ?? ARMAS[volta.arma].usos };
    m.eventos.push({ k: 'pegou', arma: volta.arma });
    return;
  }
  const cand = naFrente(m, c, 0.95, 4).filter((o) => (o.id !== 'tonhao' || caido(o)) && !deFora(o));
  const s = cand[0];
  if (!s) {
    if (achar(m, 'tonhao') && naFrente(m, c, 0.95, 4).some((o) => o.id === 'tonhao'))
      m.eventos.push({ k: 'aviso', texto: 'O Tonhão é maior que você.' });
    return;
  }
  c.segurando = s.id;
  s.seguradoPor = c.id;
  s.seguradoDesde = m.t;
  if (s.quem === 'npc' && c.quem === 'eu') s.quenteAte = m.t + QUENTE_MS;
  s.estado = 'segurado';
  s.fase = 'nada';
  s.golpe = null;
  // Saiu da rotina: quando pousar, volta andando (não reaparece no ponto da rotina).
  if (s.quem === 'npc' && s.humor === 'calmo') {
    s.humor = 'voltando';
    s.rota = null;
    s.pose = 'stand';
  }
}

/** Joga a arma da mão em linha reta: acerta o primeiro que estiver no caminho (até 5 ladrilhos). */
function arremessarArma(m: Mundo, c: Corpo) {
  // Poder especial (R$ 300) não vai para o chão nem some num arremesso.
  if (ehPoder(c.arma?.tipo)) {
    m.eventos.push({ k: 'aviso', texto: `${ARMAS[c.arma!.tipo].nome} não sai da mão: segure J para carregar e disparar.` });
    return;
  }
  const a = c.arma!;
  c.arma = null;
  const g = { ...ARMAS[a.tipo], dano: Math.round(ARMAS[a.tipo].dano * 1.2), knock: ARMAS[a.tipo].knock + 2 };
  // Fatia 12: o último ponto livre do voo (é onde o item cai se não quebrar; nunca dentro de parede ou móvel).
  let lx = c.x;
  let ly = c.y;
  const cai = (x: number, y: number) => {
    // A molotov sempre quebra e põe fogo; a garrafa vira caco no chão; o resto gasta um uso e cai inteiro.
    if (a.tipo === 'molotov') {
      m.eventos.push({ k: 'quebra', x, y, arma: a.tipo });
      m.fogos.push({ x: lx, y: ly, ate: m.t + 4000, de: c.id, zona: zonaDe(lx, ly) });
      return;
    }
    const tipo: Arma = a.tipo === 'garrafa' ? 'caco' : a.tipo;
    const usos = a.tipo === 'garrafa' ? ARMAS.caco.usos : a.usos - 1;
    if (a.tipo === 'garrafa') m.eventos.push({ k: 'quebra', x, y, arma: a.tipo });
    if (usos <= 0) {
      if (a.tipo !== 'garrafa') m.eventos.push({ k: 'quebra', x, y, arma: a.tipo });
      return;
    }
    m.chao.push({ arma: tipo, x: lx, y: ly, volta: 0, solto: true, usos, dono: c.id, quica: m.t });
    const soltos = m.chao.filter((q) => q.solto);
    if (soltos.length > MAX_SOLTOS) m.chao.splice(m.chao.indexOf(soltos[0]), 1);
    m.eventos.push({ k: 'quica', x: lx, y: ly, arma: tipo });
  };
  for (let s = 0.4; s <= 5; s += 0.2) {
    const x = c.x + c.fx * s;
    const y = c.y + c.fy * s;
    if (bate(x, y)) {
      cai(x, y);
      quebrar(m, propIdx(Math.floor(x), Math.floor(y)));
      return;
    }
    // Móvel baixo no caminho (cadeira, banqueta): a garrafa quebra e leva junto.
    const baixo = propIdx(Math.floor(x), Math.floor(y));
    if (baixo >= 0 && !m.quebrados.has(baixo) && QUEBRAVEIS.has(PROPS[baixo].kind) && Math.hypot(PROPS[baixo].x + 0.5 - x, PROPS[baixo].y + 0.5 - y) < 0.35) {
      cai(x, y);
      quebrar(m, baixo);
      return;
    }
    const o = m.corpos.find((o) => o !== c && o.estado !== 'segurado' && !o.ausente && Math.hypot(o.x - x, o.y - y) < 0.45);
    if (o) {
      ferir(m, o, c, g, c.fx, c.fy, a.tipo);
      cai(o.x, o.y);
      if (c.quem === 'eu') falar(m, o, 'arremesso', '#2ce8f5');
      return;
    }
    // Fatia 17: o arremesso acerta as feras (a cabeça do dragão, o dinossauro) e a garrafa quebra nelas.
    const fera = c.quem === 'eu' ? m.extras.find((ex) => (ex.id === 'dragao' || ex.id === 'dino') && Math.hypot(ex.x - x, ex.y - y) < ex.raio) : undefined;
    if (fera) {
      m.eventos.push({ k: 'extra', id: fera.id, x: fera.x, y: fera.y, dano: g.dano, forte: true, arma: a.tipo, dx: c.fx, dy: c.fy });
      cai(lx, ly);
      return;
    }
    // Só conta como chão de cair o ladrilho que existe, é andável e não tem móvel (fora do mapa não serve).
    if (baixo < 0 && anda(Math.floor(x), Math.floor(y))) {
      lx = x;
      ly = y;
    }
  }
  cai(c.x + c.fx * 5, c.y + c.fy * 5);
}

/**
 * Fatia 12: E no canto do balcão. Item na mão e balcão vazio: deixa lá. Item na mão e outro no balcão: se forem
 * par de receita, sai o resultado (usos cheios); se não, troca. Mão vazia: pega o que está lá.
 */
function bancada(m: Mundo, c: Corpo) {
  const b = m.bancada;
  const mao = c.arma;
  if (mao && !b) {
    m.bancada = { arma: mao.tipo, usos: mao.usos };
    c.arma = null;
    m.eventos.push({ k: 'aviso', texto: `${ARMAS[mao.tipo].nome} no balcão. Traga o par para a receita.` });
    return;
  }
  if (!mao && b) {
    c.arma = { tipo: b.arma, usos: b.usos };
    m.bancada = null;
    m.eventos.push({ k: 'aviso', texto: `Na mão: ${ARMAS[b.arma].nome} (${b.usos} usos)` });
    return;
  }
  if (!mao || !b) return;
  const r = receita(mao.tipo, b.arma);
  if (!r) {
    m.bancada = { arma: mao.tipo, usos: mao.usos };
    c.arma = { tipo: b.arma, usos: b.usos };
    m.eventos.push({ k: 'aviso', texto: `${ARMAS[mao.tipo].nome} com ${ARMAS[b.arma].nome} não dá em nada. Trocou.` });
    return;
  }
  m.bancada = null;
  c.arma = { tipo: r.da, usos: ARMAS[r.da].usos };
  m.eventos.push({ k: 'receita', nome: r.nome, arma: r.da });
}

/** Fatia 12: quanto tempo depois de cair o item arremessado ainda dá para pegar no ar (K) e de que distância. */
export const PEGA_MS = 600;
export const PEGA_RAIO = 1.6;

function usar(m: Mundo, c: Corpo) {
  // Porta para outra área (soltando quem estiver segurando).
  const porta = PORTAS.find((p) => Math.hypot(p.at[0] + 0.5 - c.x, p.at[1] + 0.5 - c.y) < 0.9);
  if (porta) {
    soltar(m, c);
    c.x = porta.para[0];
    c.y = porta.para[1];
    c.vx = c.vy = 0;
    m.eventos.push({ k: 'porta', nome: porta.nome });
    return;
  }
  // Arma no chão.
  // Com uma na mão, troca: a da mão cai aqui com os usos que sobraram (não a que acabou de cair).
  const a = m.chao.find((a) => a.volta === 0 && Math.hypot(a.x - c.x, a.y - c.y) < 0.85);
  if (a && !c.segurando) {
    if (ehPoder(c.arma?.tipo)) {
      m.eventos.push({ k: 'aviso', texto: `${ARMAS[c.arma!.tipo].nome} não sai da mão: segure J para carregar e disparar.` });
      return;
    }
    const usos = a.solto && a.usos ? a.usos : ARMAS[a.arma].usos;
    if (a.solto) m.chao.splice(m.chao.indexOf(a), 1);
    else a.volta = m.t + VOLTA_ARMA_MS;
    largarNoChao(m, c);
    c.arma = { tipo: a.arma, usos };
    m.eventos.push({ k: 'aviso', texto: `Na mão: ${ARMAS[a.arma].nome} (${usos} usos)` });
    return;
  }
  // Amigo desmaiado: a pegadinha sobe um degrau (bigode, monocelha, X, bilhete, placa, jornal).
  const amigo = m.corpos.find((o) => o.quem === 'amigo' && dist(o, c) < 0.9);
  if (amigo) {
    if (amigo.ink >= PEGADINHA_MAX) {
      m.eventos.push({ k: 'aviso', texto: `Não cabe mais nada na cara de ${NOME_AMIGO[amigo.nome as Jogador] ?? amigo.nome}.` });
      return;
    }
    amigo.ink = Math.min(PEGADINHA_MAX, amigo.ink + 1);
    m.eventos.push({ k: 'bigode', em: amigo.nome, n: amigo.ink });
    falar(m, amigo, 'bigode', '#f4f4f4');
    return;
  }
  // Geladeira: cerveja cura (com espera).
  if (c.y < 2.2 && c.x > 10.6 && c.x < 13) {
    if (c.quem === 'eu') m.eventos.push({ k: 'geladeira', x: c.x, y: c.y });
    if (m.t < m.cervejaAte) {
      m.eventos.push({ k: 'aviso', texto: 'Seu Zé: — Calma, a geladeira não é infinita.' });
      return;
    }
    c.vida = Math.min(c.vidaMax, c.vida + (m.happy ? CERVEJA * 2 : CERVEJA));
    m.cervejaAte = m.t + CERVEJA_MS;
    falar(m, c, 'cerveja', '#feae34');
    return;
  }
  // Fatia 12: o canto do balcão das receitas (depois da porta, da arma no chão e da geladeira).
  if (c.quem === 'eu' && Math.hypot(c.x - BANCADA[0], c.y - BANCADA[1]) < RAIO_BANCADA && (c.arma || m.bancada) && !ehPoder(c.arma?.tipo)) {
    bancada(m, c);
    return;
  }
  // Jogo do bar.
  const j = JOGOS.find((j) => Math.hypot(j.at[0] + 0.5 - c.x, j.at[1] + 0.5 - c.y) < 0.9);
  if (j) {
    m.eventos.push({ k: 'jogo', jogo: j.jogo, nome: j.nome });
    return;
  }
  // Mercado negro (o muambeiro tem de estar de pé) e o Rocky.
  const mu = achar(m, 'muamba');
  if (mu && !caido(mu) && !mu.dono && (dist(mu, c) < 1.2 || Math.hypot(BALCAO_MERCADO[0] - c.x, BALCAO_MERCADO[1] - c.y) < RAIO_MERCADO)) {
    m.eventos.push({ k: 'jogo', jogo: 'mercado', nome: 'Mercado negro' });
    return;
  }
  const ro = achar(m, 'rocky');
  if (ro && !caido(ro) && dist(ro, c) < 1.2) {
    const texto = frase('rocky', sorteia(m));
    falar(m, ro, 'rocky_arroto', '#2ce8f5');
    m.eventos.push({ k: 'rocky', texto });
    m.eventos.push({ k: 'jogo', jogo: 'portal', nome: 'Portal do Rocky' });
    return;
  }
  // Móvel na sua frente vira arma (o Seu Zé repõe depois).
  if (!c.segurando) {
    const tx = Math.floor(c.x + c.fx * 0.8);
    const ty = Math.floor(c.y + c.fy * 0.8);
    const i = propIdx(tx, ty);
    const tipo = i >= 0 ? MOVEL_ARMA[PROPS[i].kind] : undefined;
    if (tipo && !m.quebrados.has(i) && ehPoder(c.arma?.tipo)) {
      m.eventos.push({ k: 'aviso', texto: `${ARMAS[c.arma!.tipo].nome} não sai da mão: segure J para carregar e disparar.` });
      return;
    }
    if (tipo && !m.quebrados.has(i)) {
      levar(m, i);
      largarNoChao(m, c);
      c.arma = { tipo, usos: ARMAS[tipo].usos };
      m.eventos.push({ k: 'levou', i, arma: tipo });
      m.eventos.push({ k: 'aviso', texto: `Pegou: ${ARMAS[tipo].nome}` });
      return;
    }
  }
  const ze = achar(m, 'ze');
  if (ze && dist(ze, c) < 1.9) falar(m, ze, 'ze', '#feae34');
}

/* ------------------------------------------------------------------ andar com rota (NPC) */

function irPara(m: Mundo, c: Corpo, tx: number, ty: number, vel: number, dt: number): number {
  vel *= fatorPernas(c) * velStatus(c.st, m.t);
  const d = Math.hypot(tx - c.x, ty - c.y);
  if (d < 0.05) return d;
  const destino = Math.floor(tx) * 64 + Math.floor(ty);
  if (!c.rota || c.rota.para !== destino || m.t - c.rota.em > 700) {
    const path = findPath(anda, { x: Math.floor(c.x), y: Math.floor(c.y) }, { x: Math.floor(tx), y: Math.floor(ty) }, 600);
    c.rota = { para: destino, pts: path.map((p) => [p.x + 0.5, p.y + 0.5] as [number, number]), em: m.t };
  }
  let [nx, ny] = [tx, ty];
  while (c.rota.pts.length > 1 && Math.hypot(c.rota.pts[0][0] - c.x, c.rota.pts[0][1] - c.y) < 0.35) c.rota.pts.shift();
  if (c.rota.pts.length > 1) [nx, ny] = c.rota.pts[0];
  const dx = nx - c.x;
  const dy = ny - c.y;
  const n = Math.hypot(dx, dy) || 1;
  const s = Math.min(n, vel * dt);
  mover(c, (dx / n) * s, (dy / n) * s);
  c.fx = dx / n;
  c.fy = dy / n;
  c.andando = true;
  return d;
}

/* ------------------------------------------------------------------ cérebro dos NPCs */

function pensar(m: Mundo, c: Corpo, dt: number) {
  const n = npcDe(c)!;
  const f = FICHAS[n.tipo];
  c.andando = false;
  if (m.t < c.atordoadoAte) return;
  if (c.humor !== 'calmo') c.pose = 'stand';

  if (n.tipo === 'barman' && (c.humor === 'calmo' || c.humor === 'voltando' || c.humor === 'limpando') && trabalhar(m, c, f.velocidade, dt)) return;

  if (c.humor === 'arrastando') {
    const s = achar(m, c.segurando);
    if (!s) {
      c.humor = 'voltando';
      return;
    }
    if (irPara(m, c, SARJETA[0], SARJETA[1], f.velocidade * 0.8, dt) < 0.4) {
      soltar(m, c);
      s.estado = 'ko';
      s.koAte = m.t + 1500;
      s.vx = 0;
      s.vy = 2.5;
      m.calor = 0;
      falar(m, c, 'leao', '#e43b44');
      c.humor = 'voltando';
      c.alvo = null;
    }
    return;
  }

  if (c.humor === 'saindo') {
    if (irPara(m, c, ENTRADA[0], ENTRADA[1] + 2, f.velocidade, dt) < 0.5) {
      c.ausente = true;
      c.humor = 'calmo';
      c.rota = null;
    }
    return;
  }

  if (c.humor === 'briga') {
    const a = achar(m, c.alvo);
    if (!a || caido(a) || a.ausente || a.estado === 'segurado' || dist(a, c) > 9 || m.t > c.humorAte) {
      c.humor = 'voltando';
      c.alvo = null;
      c.fase = 'nada';
      return;
    }
    const d = dist(a, c);
    if (c.fase === 'nada') {
      if (d > 0.85) {
        irPara(m, c, a.x, a.y, f.velocidade * 1.4, dt);
      } else {
        c.fx = (a.x - c.x) / (d || 1);
        c.fy = (a.y - c.y) / (d || 1);
        comecarGolpe(m, c);
      }
    }
    return;
  }

  if (c.humor === 'foge' || c.humor === 'abaixado') {
    if (m.t > c.humorAte) {
      c.humor = 'voltando';
      return;
    }
    if (c.humor === 'abaixado') {
      c.pose = 'sit';
      return;
    }
    const [ox, oy] = c.fugirDe!;
    const dx = c.x - ox;
    const dy = c.y - oy;
    const k = Math.hypot(dx, dy) || 1;
    const v = f.velocidade * 1.3 * dt * velStatus(c.st, m.t);
    if (mover(c, (dx / k) * v, (dy / k) * v)) {
      // Encurralado: tenta de lado.
      mover(c, (-dy / k) * v, (dx / k) * v);
    }
    c.fx = dx / k;
    c.fy = dy / k;
    c.andando = true;
    return;
  }

  const r = rotinaEm(n, m.t);
  if (c.humor === 'voltando') {
    if (irPara(m, c, r.x, r.y, f.velocidade, dt) < 0.3) {
      c.humor = 'calmo';
      c.rota = null;
    }
    return;
  }
  // Calmo: segue a rotina (igual em todo aparelho).
  if (n.tipo === 'faxineira' && c.parada !== r.i) {
    if (r.i === 1 && c.parada === 0) falar(m, c, 'maria_vem', '#68aed4');
    else if (r.i > 1 && sorteia(m) < 0.3) falar(m, c, 'maria_limpa', '#68aed4');
    c.parada = r.i;
  }
  c.x = r.x;
  c.y = r.y;
  if (r.andando) {
    const k = Math.hypot(r.dx, r.dy) || 1;
    c.fx = r.dx / k;
    c.fy = r.dy / k;
  }
  c.andando = r.andando;
  c.pose = r.pose;
}

/** Escolhe dois NPCs de briga, calmos e perto um do outro, e solta a treta. */
export function tretaSozinha(m: Mundo, sorteio: number): boolean {
  const cand = m.corpos.filter((c) => {
    if (c.quem !== 'npc' || c.ausente || c.dono || c.estado !== 'normal' || c.humor !== 'calmo') return false;
    const n = npcDe(c)!;
    return FICHAS[n.tipo].dano > 0 && n.tipo !== 'leao' && n.tipo !== 'muambeiro' && n.tipo !== 'cientista' && zonaDe(c.x, c.y) === 'bar';
  });
  if (cand.length < 2) return false;
  const a = cand[sorteio % cand.length];
  const b = cand.filter((o) => o !== a && dist(o, a) < 7).sort((p, q) => dist(p, a) - dist(q, a))[0];
  if (!b) return false;
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    x.humor = 'briga';
    x.alvo = y.id;
    x.humorAte = m.t + 12000;
    x.rota = null;
    x.pose = 'stand';
  }
  falar(m, a, 'treta', '#e43b44');
  m.eventos.push({ k: 'treta', a: a.nome, b: b.nome, ia: a.id, ib: b.id });
  return true;
}

/* ------------------------------------------------------------------ o passo */

export function passo(m: Mundo, ent: Entrada, dt: number) {
  m.t += dt * 1000;
  m.trauma = Math.max(0, m.trauma - 1.8 * dt);
  m.calor = Math.max(0, m.calor - (dt * 1000) / CALOR_ESFRIA_MS);
  for (const a of m.chao) if (a.volta && m.t >= a.volta) a.volta = 0;
  passoRajadas(m);
  passoPoderes(m, dt);
  // Fatia 12: o aparar entra mesmo durante o congelamento (senão o botão some no meio da pancada).
  const eu0 = eu(m);
  if (ent.apara && eu0.estado === 'normal' && m.t - eu0.aparaTentou >= APARA_RECARGA) {
    eu0.aparaTentou = m.t;
    if (eu0.arma && !ehPoder(eu0.arma.tipo)) eu0.aparaEm = m.t;
    else m.eventos.push({ k: 'aviso', texto: 'Para aparar, precisa de alguma coisa na mão.' });
  }
  if (m.t < m.hitstopAte) return; // congela a pancada no impacto
  LIVRES = m.livres;

  const me = eu(m);
  const t = m.t;
  passoStatus(m, dt);
  chegarClientes(m, t);

  // Você.
  me.andando = false;
  if (me.estado === 'ko' && t >= me.koAte && !me.seguradoPor) {
    me.estado = 'normal';
    me.vida = Math.max(me.vida, 50);
  }
  if (me.estado === 'normal') {
    if (t - me.ultimoDano > RECUPERA_DEPOIS) me.vida = Math.min(me.vidaMax, me.vida + RECUPERA_POR_S * dt);
    const livre = t >= me.atordoadoAte;
    const len = Math.hypot(ent.mx, ent.my);
    // Carregando ou disparando a rajada: pé no chão e mira travada.
    const plantado = !!me.golpe && GOLPES_PODER.has(me.golpe) && me.fase !== 'nada';
    if (livre && len > 0.1 && !plantado) {
      const k = Math.min(1, len);
      me.fx = ent.mx / len;
      me.fy = ent.my / len;
      const vel = VEL_EU * k * (me.segurando ? 0.65 : 1) * (me.fase === 'antes' ? 0.3 : 1) * velStatus(me.st, t);
      mover(me, me.fx * vel * dt, me.fy * vel * dt);
      me.andando = true;
    }
    if (livre && ent.soco) {
      if (me.segurando) {
        const s = achar(m, me.segurando)!;
        const outros = naFrente(m, me, 1.35, 2, false).filter((o) => o !== s && o.quem !== 'amigo');
        if (outros.length) {
          // Porrete humano: quem você segura vira arma (e apanha junto).
          for (const o of outros) ferir(m, o, me, { ...EMPURRAO, dano: 16, knock: 6.5, alvos: 2 }, o.x - me.x, o.y - me.y);
          ferir(m, s, me, { ...JAB, dano: 6, knock: 0, hitstop: 0 }, me.fx, me.fy);
          falar(m, me, 'porrete', '#feae34');
        } else {
          ferir(m, s, me, { ...JAB, dano: 9, knock: 0 }, me.fx, me.fy);
          if (sorteia(m) < 0.3) falar(m, me, 'joelhada', '#feae34');
        }
      } else if (me.fase === 'nada') comecarGolpe(m, me);
      else me.buffer = t + 200;
    }
    if (livre && ent.agarra) agarrar(m, me);
    if (livre && ent.usa) usar(m, me);
  }

  // Golpes em andamento (você e NPCs).
  for (const c of m.corpos) {
    // O soco do amigo online (e do NPC com ele) é decidido no aparelho dele: aqui só aparece a pose.
    if (deFora(c)) continue;
    if (c.estado !== 'normal') {
      c.fase = 'nada';
      continue;
    }
    if (c.fase === 'antes' && t >= c.faseAte) {
      // Fatia 12: você segurando o botão (sem poder na mão, sem ninguém seguro) carrega até 1,5 s.
      const segura = c.quem === 'eu' && !!ent.segura && !ehPoder(c.arma?.tipo) && !c.segurando;
      if (segura && t - c.faseAte < CARGA_MAX_MS) {
        const n = nivelCarga(t - c.faseAte);
        const antes = nivelCarga(t - DT * 1000 - c.faseAte);
        if (n > antes) m.eventos.push({ k: 'carregando', x: c.x, y: c.y, em: c.id, nivel: n as 1 | 2 });
      } else soltarGolpe(m, c);
    }
    else if (c.fase === 'depois' && t >= c.faseAte) {
      c.fase = 'nada';
      c.golpe = null;
      if (c.quem === 'eu' && c.buffer >= t) {
        c.buffer = 0;
        comecarGolpe(m, c);
      }
    }
  }

  // Happy hour: a turma chega pela calçada e vai embora quando acaba.
  const hh = happyHour(t);
  if (hh !== m.happy) {
    m.happy = hh;
    m.eventos.push({ k: 'happy', comeca: hh });
    if (hh) falar(m, me, 'happy', '#feae34');
  }
  for (const c of m.corpos) {
    if (c.quem !== 'npc' || npcDe(c)!.turno !== 'happy') continue;
    if (hh && c.ausente) {
      c.ausente = false;
      c.x = ENTRADA[0];
      c.y = ENTRADA[1] + 2;
      c.estado = 'normal';
      c.vida = c.vidaMax;
      c.humor = 'voltando';
      c.rota = null;
    } else if (!hh && !c.ausente && c.estado === 'normal' && (c.humor === 'calmo' || c.humor === 'voltando')) {
      c.humor = 'saindo';
      c.rota = null;
    }
  }

  // A briga que estoura sozinha entre dois NPCs (hora sorteada por janela, igual em todo aparelho).
  if (t >= m.proxBriga) {
    tretaSozinha(m, brigaDaJanela(m.janela).sorteio);
    const prox = agendaBriga(t + 1);
    m.proxBriga = prox.proxBriga;
    m.janela = prox.janela;
  }

  // NPCs.
  for (const c of m.corpos) {
    if (c.quem !== 'npc' || c.ausente || c.dono) continue;
    if (c.estado === 'ko' && t >= c.koAte) {
      c.estado = 'normal';
      c.cortes = 0;
      c.cortadoPor = null;
      c.vida = Math.round(c.vidaMax * 0.6);
      c.humor = 'voltando';
      c.atordoadoAte = t + 600;
    }
    if (c.estado === 'normal') pensar(m, c, dt);
    // Quem está segurado se solta depois de um tempo (se ainda tiver força).
    if (c.estado === 'segurado' && c.vida > 0 && t - c.seguradoDesde > 2500) {
      const h = achar(m, c.seguradoPor);
      if (h) h.segurando = null;
      c.seguradoPor = null;
      c.estado = 'normal';
      c.atordoadoAte = t + 300;
      reagir(m, c, h ?? me);
    }
  }

  // Física: knockback com atrito, voo, boliche, segurados acompanhando quem segura.
  const atrito = Math.exp(-ATRITO * dt);
  const atritoVoo = Math.exp(-ATRITO_VOO * dt);
  for (const c of m.corpos) {
    if (c.ausente || deFora(c)) continue;
    if (c.estado === 'segurado') {
      const h = achar(m, c.seguradoPor);
      if (h) {
        const nx = h.x + h.fx * 0.55;
        const ny = h.y + h.fy * 0.55;
        if (!bate(nx, ny)) {
          c.x = nx;
          c.y = ny;
        }
        c.fx = -h.fx;
        c.fy = -h.fy;
      }
      c.vx = c.vy = 0;
      continue;
    }
    const sp = Math.hypot(c.vx, c.vy);
    if (c.voo && sp < 1) c.voo = false;
    if (sp < 0.05 || (c.estado === 'voando' && !c.voo)) {
      c.vx = c.vy = 0;
      if (c.estado === 'voando') {
        c.estado = 'normal';
        c.atordoadoAte = Math.max(c.atordoadoAte, t + 600);
      }
      continue;
    }
    let bateu = mover(c, c.vx * dt, c.vy * dt);
    // Voando em cima de móvel: quebra. Mesa no caminho quebra e o corpo passa por cima dela.
    if (sp > (c.voo ? 2.5 : 4)) {
      const i = moveisPerto(m, c, bateu);
      if (i >= 0 && quebrar(m, i, c)) {
        const lancou = achar(m, c.lancadoPor) ?? me;
        if (c.quem !== 'amigo') ferir(m, c, lancou, { ...JAB, dano: 8, knock: 0, forte: true, hitstop: 70 }, -c.vx, -c.vy);
        c.vx *= 0.75;
        c.vy *= 0.75;
        if (bateu) bateu = mover(c, c.vx * dt, c.vy * dt);
      }
    }
    if (bateu && sp > (c.voo ? 2.5 : 4)) {
      m.eventos.push({ k: 'parede', x: c.x, y: c.y });
      const lancou = achar(m, c.lancadoPor) ?? me;
      if (c.quem !== 'amigo') {
        ferir(m, c, lancou, { ...JAB, dano: 10, knock: 0, forte: true, hitstop: 80 }, -c.vx, -c.vy);
        if (lancou.quem === 'eu' && sorteia(m) < 0.5) falar(m, c, 'parede', '#feae34');
      }
      c.vx *= -0.25;
      c.vy *= -0.25;
    }
    // Boliche: corpo voando derruba quem está no caminho.
    if (sp > (c.voo ? 3 : 4.5)) {
      for (const o of m.corpos) {
        if (o === c || !dePe(o) || o.estado === 'voando' || o.quem === 'amigo' || deFora(o) || o.ausente) continue;
        if (Math.hypot(o.x - c.x, o.y - c.y) > 0.55) continue;
        const lancou = achar(m, c.lancadoPor) ?? me;
        if (o === lancou) continue;
        ferir(m, o, lancou, { ...JAB, dano: 12, knock: sp * 0.6, forte: true, hitstop: 90 }, c.vx, c.vy);
        if (c.quem !== 'amigo') ferir(m, c, lancou, { ...JAB, dano: 8, knock: 0, forte: false, hitstop: 0 }, -c.vx, -c.vy);
        if (lancou.quem === 'eu') falar(m, o, 'arremesso', '#2ce8f5');
        c.vx *= 0.5;
        c.vy *= 0.5;
      }
    }
    c.vx *= c.voo ? atritoVoo : atrito;
    c.vy *= c.voo ? atritoVoo : atrito;
  }

  atropelar(m, t);
  sangrar(m, dt);
  escorregar(m, dt);
  for (let i = m.grana.length - 1; i >= 0; i--) {
    const g = m.grana[i];
    if (t >= g.ate) m.grana.splice(i, 1);
    else if (me.estado === 'normal' && Math.hypot(g.x - me.x, g.y - me.y) < 0.55) {
      m.grana.splice(i, 1);
      m.eventos.push({ k: 'grana', v: g.v });
    }
  }

  // Ninguém em pé fica um dentro do outro.
  const solidos = m.corpos.filter((c) => c.estado === 'normal' && !c.ausente);
  for (let i = 0; i < solidos.length; i++)
    for (let j = i + 1; j < solidos.length; j++) {
      const a = solidos[i];
      const b = solidos[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= 0.5 || d < 1e-6) continue;
      const push = (0.5 - d) / 2;
      // Quem está na rotina calma não é empurrado (a rotina manda); empurra só o outro.
      const aFixo = (a.quem === 'npc' && a.humor === 'calmo') || deFora(a);
      const bFixo = (b.quem === 'npc' && b.humor === 'calmo') || deFora(b);
      if (!aFixo) mover(a, (-dx / d) * push * (bFixo ? 2 : 1), (-dy / d) * push * (bFixo ? 2 : 1));
      if (!bFixo) mover(b, (dx / d) * push * (aFixo ? 2 : 1), (dy / d) * push * (aFixo ? 2 : 1));
    }
}

/* ------------------------------------------------------------------ quebradeira, Seu Zé e clientes novos */

/** Móvel quebrável que o corpo voando está atingindo: o do ladrilho à frente (se bateu) ou um baixo embaixo dele. */
function moveisPerto(m: Mundo, c: Corpo, bateu: boolean): number {
  const sx = Math.sign(c.vx);
  const sy = Math.sign(c.vy);
  const cand: [number, number][] = bateu
    ? [[Math.floor(c.x + sx * (RAIO + 0.08)), Math.floor(c.y)], [Math.floor(c.x), Math.floor(c.y + sy * (RAIO + 0.08))]]
    : [[Math.floor(c.x), Math.floor(c.y)]];
  for (const [tx, ty] of cand) {
    const i = propIdx(tx, ty);
    if (i < 0 || m.quebrados.has(i) || !QUEBRAVEIS.has(PROPS[i].kind)) continue;
    if (!bateu && Math.hypot(tx + 0.5 - c.x, ty + 0.5 - c.y) > 0.6) continue;
    return i;
  }
  return -1;
}

/** Quebra o móvel `i` (se quebra e ainda está inteiro): libera o ladrilho e põe na fila do Seu Zé. */
export function quebrar(m: Mundo, i: number, quem?: Corpo, calado = false): boolean {
  if (i < 0 || m.quebrados.has(i) || !QUEBRAVEIS.has(PROPS[i].kind)) return false;
  const p = PROPS[i];
  m.quebrados.set(i, m.t);
  if (!anda(p.x, p.y)) m.livres.add(p.x * 64 + p.y);
  m.tarefas.push({ k: 'repor', i, apos: m.t + REPOR_MS });
  m.eventos.push({ k: 'quebrou', i, kind: p.kind, x: p.x + 0.5, y: p.y + 0.5 });
  sacudir(m, 0.3);
  if (!calado) falar(m, quem ?? { x: p.x + 0.5, y: p.y + 0.5 }, 'quebrou', '#ef7d57');
  return true;
}

/* ------------------------------------------------------------------ Rajada do Fiado (Fatia 5) */

/** Meia largura do feixe (ladrilhos), alcance máximo e a velocidade da frente (ladrilhos/s). */
export const RAJADA_RAIO = 1.5;
export const RAJADA_MAX = 24;
export const RAJADA_VEL = 40;

export interface Rajada {
  de: string;
  x: number;
  y: number;
  fx: number;
  fy: number;
  len: number;
  t0: number;
  /** Só desenho (feixe de um amigo: o dano dele vem pela rede). */
  visual: boolean;
  atingidos: Set<string>;
}

/** Até onde o feixe vai: a borda da área de quem atira (bar ou banheiro), no máximo RAJADA_MAX. */
export function alcanceRajada(x: number, y: number, fx: number, fy: number): number {
  const a = AREAS[zonaDe(x, y)];
  let t = RAJADA_MAX;
  if (fx > 1e-6) t = Math.min(t, (a.x1 - x) / fx);
  if (fx < -1e-6) t = Math.min(t, (a.x0 - x) / fx);
  if (fy > 1e-6) t = Math.min(t, (a.y1 - y) / fy);
  if (fy < -1e-6) t = Math.min(t, (a.y0 - y) / fy);
  return Math.max(0, t);
}

/** Ponto (px, py) dentro do feixe até a frente `ate`? Devolve a distância ao longo dele (ou -1). */
export function noFeixe(r: { x: number; y: number; fx: number; fy: number; len: number }, ate: number, px: number, py: number): number {
  const dx = px - r.x;
  const dy = py - r.y;
  const ao = dx * r.fx + dy * r.fy;
  if (ao < -0.3 || ao > Math.min(ate, r.len)) return -1;
  return Math.abs(dx * r.fy - dy * r.fx) <= RAJADA_RAIO ? Math.max(0, ao) : -1;
}

const GOLPE_RAJADA: Golpe = { dano: 100, knock: 14, alcance: 0, alvos: 0, antecipa: 0, recupera: 0, forte: true, hitstop: 0 };

function dispararRajada(m: Mundo, c: Corpo) {
  const n = Math.hypot(c.fx, c.fy) || 1;
  const fx = c.fx / n;
  const fy = c.fy / n;
  const x = c.x + fx * 0.5;
  const y = c.y + fy * 0.5;
  const len = alcanceRajada(x, y, fx, fy);
  m.rajadas.push({ de: c.id, x, y, fx, fy, len, t0: m.t, visual: false, atingidos: new Set([c.id]) });
  m.eventos.push({ k: 'rajada', em: c.id, x, y, fx, fy, len });
  sacudir(m, 1);
  // O tranco joga quem atira um pouco para trás.
  c.vx -= fx * 3;
  c.vy -= fy * 3;
}

/** Feixe de um amigo (veio pela rede): só o desenho e o tremor; quem apanha decide no aparelho dele. */
export function rajadaDeFora(m: Mundo, de: string, x: number, y: number, fx: number, fy: number, t0: number) {
  const n = Math.hypot(fx, fy) || 1;
  const ux = fx / n;
  const uy = fy / n;
  const ox = x + ux * 0.5;
  const oy = y + uy * 0.5;
  const len = alcanceRajada(ox, oy, ux, uy);
  m.rajadas.push({ de, x: ox, y: oy, fx: ux, fy: uy, len, t0, visual: true, atingidos: new Set() });
  m.eventos.push({ k: 'rajada', em: de, x: ox, y: oy, fx: ux, fy: uy, len });
  sacudir(m, 0.8);
}

/** A frente do feixe anda: quem ela alcança voa nocauteado, o móvel que ela alcança quebra. */
function passoRajadas(m: Mundo) {
  for (let i = m.rajadas.length - 1; i >= 0; i--) {
    const r = m.rajadas[i];
    const vida = m.t - r.t0;
    if (vida > ARMAS.rajada.recupera + 400) {
      m.rajadas.splice(i, 1);
      continue;
    }
    if (r.visual || vida > ARMAS.rajada.recupera) continue;
    const frente = (vida / 1000) * RAJADA_VEL;
    const de = achar(m, r.de);
    if (!de) continue;
    const zona = zonaDe(r.x, r.y);
    for (const o of m.corpos) {
      if (r.atingidos.has(o.id) || o.ausente || o.estado === 'segurado' || zonaDe(o.x, o.y) !== zona) continue;
      if (noFeixe(r, frente, o.x, o.y) < 0) continue;
      r.atingidos.add(o.id);
      // Nocaute garantido em quem é decidido aqui (até o Tonhão); amigo e NPC de outro aparelho levam o teto da regra (100).
      const dano = o.quem === 'npc' && !deFora(o) ? Math.max(100, Math.ceil(o.vida) + 1) : 100;
      ferir(m, o, de, { ...GOLPE_RAJADA, dano }, r.fx, r.fy, 'rajada');
    }
    PROPS.forEach((p, k) => {
      if (m.quebrados.has(k) || !QUEBRAVEIS.has(p.kind) || zonaDe(p.x, p.y) !== zona) return;
      if (noFeixe(r, frente, p.x + 0.5, p.y + 0.5) >= 0) quebrar(m, k, de, true);
    });
  }
}

/* ------------------------------------------------------------------ Poderes novos (Fatia 6) */

/** Os golpes dos 11 poderes (corpo plantado na carga e no disparo). */
const GOLPES_PODER: ReadonlySet<Golpe> = new Set<Golpe>([ARMAS.rajada, ...PODERES_NOVOS.map((p) => ARMAS[p])]);

/** Candidatos a alvo de um disparo (mesma área, de pé, sem quem disparou). */
function candidatos(m: Mundo, de: string, x: number, y: number) {
  const z = zonaDe(x, y);
  return m.corpos.filter((o) => o.id !== de && !o.ausente && o.estado !== 'segurado' && !caido(o) && o.quem !== 'amigo' && zonaDe(o.x, o.y) === z);
}

function dispararPoder(m: Mundo, c: Corpo, tipo: PoderNovo) {
  const n = Math.hypot(c.fx, c.fy) || 1;
  const x = c.x + (c.fx / n) * 0.5;
  const y = c.y + (c.fy / n) * 0.5;
  const d = montarDisparo(tipo, c.id, x, y, c.fx, c.fy, m.t, alcanceRajada, candidatos(m, c.id, c.x, c.y));
  m.poderes.push(d);
  m.eventos.push({ k: 'poder', em: c.id, tipo, x: d.x, y: d.y, fx: d.fx, fy: d.fy, cx: d.cx, cy: d.cy, len: d.len, alvos: d.alvos });
  sacudir(m, 0.8);
  c.vx -= d.fx * 2;
  c.vy -= d.fy * 2;
}

/** Disparo de um amigo (veio pela rede): só o desenho e o tremor; quem apanha decide no aparelho dele. */
export function poderDeFora(m: Mundo, de: string, tipo: PoderNovo, x: number, y: number, fx: number, fy: number, t0: number) {
  const n = Math.hypot(fx, fy) || 1;
  const d = montarDisparo(tipo, de, x + (fx / n) * 0.5, y + (fy / n) * 0.5, fx, fy, t0, alcanceRajada, candidatos(m, de, x, y), true);
  m.poderes.push(d);
  m.eventos.push({ k: 'poder', em: de, tipo, x: d.x, y: d.y, fx: d.fx, fy: d.fy, cx: d.cx, cy: d.cy, len: d.len, alvos: d.alvos });
  sacudir(m, 0.6);
}

/** Cada disparo aplica o efeito na hora em que a geometria dele chega em cada um (e nos móveis). */
function passoPoderes(m: Mundo, dt: number) {
  for (let i = m.poderes.length - 1; i >= 0; i--) {
    const d = m.poderes[i];
    const def = PODER[d.tipo];
    const vida = m.t - d.t0;
    if (vida > def.dura + 600) {
      m.poderes.splice(i, 1);
      continue;
    }
    if (d.visual || vida > def.dura) continue;
    const de = achar(m, d.de);
    if (!de) continue;
    const zona = zonaDe(d.x, d.y);
    // Ímã: antes de implodir, puxa quem é decidido aqui para o ponto (amigo só leva o dano e o empurrão).
    if (def.forma === 'ima' && vida < def.p.atraso!)
      for (const o of m.corpos) {
        if (o.id === d.de || o.quem !== 'npc' || deFora(o) || o.ausente || caido(o) || zonaDe(o.x, o.y) !== zona) continue;
        const vx = d.cx - o.x;
        const vy = d.cy - o.y;
        const dd = Math.hypot(vx, vy);
        if (dd > IMA_PUXA || dd < 0.6) continue;
        // Arrasta pelo chão (com colisão, sem a pancada de parede: móvel no caminho só segura).
        const passo = Math.min(dd - 0.5, IMA_FORCA * dt);
        mover(o, (vx / dd) * passo, (vy / dd) * passo);
        o.vx = o.vy = 0;
        o.atordoadoAte = Math.max(o.atordoadoAte, m.t + 150);
      }
    for (const o of m.corpos) {
      if (d.atingidos.has(o.id) || o.ausente || o.estado === 'segurado' || o.quem === 'amigo' || zonaDe(o.x, o.y) !== zona) continue;
      const q = quando(d, o.x, o.y, o.id);
      if (q < 0 || vida < q) continue;
      d.atingidos.add(o.id);
      const dano = def.dano >= 100 ? (o.quem === 'npc' && !deFora(o) ? Math.max(100, Math.ceil(o.vida) + 1) : 100) : def.dano;
      const e = empurraoDe(d, o.x, o.y);
      ferir(m, o, de, { dano, knock: def.knock, alcance: 0, alvos: 0, antecipa: 0, recupera: 0, forte: true, hitstop: 0 }, e.x, e.y, d.tipo);
      if (def.atordoa && o.estado === 'normal' && !deFora(o)) o.atordoadoAte = Math.max(o.atordoadoAte, m.t + def.atordoa);
      if (d.tipo === 'chope' && o.estado === 'normal' && !deFora(o)) {
        o.escorregouAte = m.t + 2000;
        m.eventos.push({ k: 'escorrega', x: o.x, y: o.y, em: o.id });
      }
    }
    if (def.quebra)
      PROPS.forEach((p, k) => {
        if (m.quebrados.has(k) || !QUEBRAVEIS.has(p.kind) || zonaDe(p.x, p.y) !== zona) return;
        const q = quando(d, p.x + 0.5, p.y + 0.5, `movel${k}`);
        if (q >= 0 && vida >= q) quebrar(m, k, de, true);
      });
    if (d.tipo === 'pinga' && !d.feito && vida >= vooPinga(d)) {
      d.feito = true;
      m.fogos.push({ x: d.cx, y: d.cy, ate: m.t + FOGO_MS, de: d.de, zona });
    }
  }
  // Fogo no chão: NPC decidido aqui que fica nele queima (e cai, se zerar).
  for (let i = m.fogos.length - 1; i >= 0; i--) {
    const f = m.fogos[i];
    if (m.t >= f.ate) {
      m.fogos.splice(i, 1);
      continue;
    }
    const de = achar(m, f.de);
    for (const o of m.corpos) {
      if (o.quem !== 'npc' || deFora(o) || o.ausente || o.estado !== 'normal' || zonaDe(o.x, o.y) !== f.zona) continue;
      if (Math.hypot(o.x - f.x, o.y - f.y) > FOGO_RAIO) continue;
      o.vida = Math.max(0, o.vida - FOGO_DANO_S * dt);
      o.ultimoDano = m.t;
      if (o.vida <= 0) nocautear(m, o, de ?? o, null, 0);
    }
  }
}

/** Tira o móvel do lugar sem quebrar (você pegou): o Seu Zé traz outro do depósito depois. */
function levar(m: Mundo, i: number) {
  const p = PROPS[i];
  m.quebrados.set(i, m.t);
  if (!anda(p.x, p.y)) m.livres.add(p.x * 64 + p.y);
  m.tarefas.push({ k: 'repor', i, apos: m.t + REPOR_MS });
}

/** Põe na sua mão uma arma comprada (mercado negro): a que estava na mão cai no chão de vez. */
export function equipar(m: Mundo, tipo: Arma) {
  const me = eu(m);
  if (me.arma) m.eventos.push({ k: 'quebra', x: me.x + me.fx * 0.4, y: me.y + me.fy * 0.4, arma: me.arma.tipo });
  me.arma = { tipo, usos: ARMAS[tipo].usos };
  m.eventos.push({ k: 'aviso', texto: `Na mão: ${ARMAS[tipo].nome} (${ARMAS[tipo].usos} usos)` });
}

/** Centro do ladrilho de pisar mais perto de (x, y): o próprio, ou o vizinho livre mais próximo (até 2 de distância). */
function pisavel(x: number, y: number): [number, number] {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (anda(tx, ty)) return [x, y];
  let melhor: [number, number] = [x, y];
  let d = Infinity;
  for (let r = 1; r <= 2 && d === Infinity; r++)
    for (let dx = -r; dx <= r; dx++)
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !anda(tx + dx, ty + dy) || zonaDe(tx + dx, ty + dy) !== zonaDe(tx, ty)) continue;
        const cx = tx + dx + 0.5;
        const cy = ty + dy + 0.5;
        const dd = Math.hypot(cx - x, cy - y);
        if (dd < d) {
          d = dd;
          melhor = [cx, cy];
        }
      }
  return melhor;
}

/** Anda até (tx, ty) mesmo em outra área: vai até a porta da área dele e atravessa. */
function irParaLonge(m: Mundo, c: Corpo, tx: number, ty: number, vel: number, dt: number): number {
  const za = zonaDe(c.x, c.y);
  if (za === zonaDe(tx, ty)) return irPara(m, c, tx, ty, vel, dt);
  const porta = PORTAS.find((p) => zonaDe(p.at[0], p.at[1]) === za);
  if (!porta) return Infinity;
  if (irPara(m, c, porta.at[0] + 0.5, porta.at[1] + 0.5, vel, dt) < 0.4) {
    c.x = porta.para[0];
    c.y = porta.para[1];
    c.rota = null;
  }
  return Infinity;
}

/** Próximo serviço do Seu Zé: corpo no chão primeiro (que ninguém esteja segurando), depois mobília vencida. */
function proximaTarefa(m: Mundo, ze: Corpo): Tarefa | null {
  for (const x of m.tarefas) {
    if (x.k !== 'corpo') continue;
    const b = achar(m, x.id);
    if (b && !b.ausente && !b.dono && b.estado === 'ko' && (!b.seguradoPor || b.seguradoPor === ze.id)) return x;
  }
  return m.tarefas.find((x) => x.k === 'repor' && m.t >= x.apos) ?? null;
}

const tirar = (m: Mundo, x: Tarefa) => {
  const i = m.tarefas.indexOf(x);
  if (i >= 0) m.tarefas.splice(i, 1);
};

/** O Seu Zé faz o serviço (sempre resmungando). Devolve se está trabalhando neste passo. */
function trabalhar(m: Mundo, c: Corpo, vel: number, dt: number): boolean {
  // Limpa da fila o que não tem mais o que fazer (corpo que sumiu ou levantou).
  for (const x of [...m.tarefas]) {
    if (x.k !== 'corpo') continue;
    const b = achar(m, x.id);
    if (!b || b.ausente || (b.estado !== 'ko' && b.estado !== 'segurado')) tirar(m, x);
  }
  if (c.tarefa && !m.tarefas.includes(c.tarefa)) c.tarefa = null;
  if (!c.tarefa) {
    c.tarefa = proximaTarefa(m, c);
    if (!c.tarefa) {
      if (c.humor === 'limpando') {
        c.humor = 'voltando';
        c.rota = null;
      }
      return false;
    }
    c.humor = 'limpando';
    c.rota = null;
    c.carga = false;
  }
  const x = c.tarefa;
  if (x.k === 'corpo') {
    const b = achar(m, x.id)!;
    if (b.seguradoPor && b.seguradoPor !== c.id) {
      c.tarefa = null; // alguém pegou antes (volta para a fila)
      return true;
    }
    if (c.segurando !== b.id) {
      const [bx, by] = pisavel(b.x, b.y);
      const falta = irParaLonge(m, c, bx, by, vel, dt);
      if (zonaDe(b.x, b.y) === zonaDe(c.x, c.y) && (Math.hypot(b.x - c.x, b.y - c.y) < 0.9 || falta < 0.35)) {
        c.segurando = b.id;
        b.seguradoPor = c.id;
        b.seguradoDesde = m.t;
        b.estado = 'segurado';
        falar(m, c, 'ze_limpa', '#feae34');
      }
      return true;
    }
    if (irParaLonge(m, c, DEPOSITO[0], DEPOSITO[1], vel * CARGA_VEL, dt) < 0.45) {
      c.segurando = null;
      b.seguradoPor = null;
      b.estado = 'ko';
      b.ausente = true;
      b.x = DEPOSITO[0];
      b.y = DEPOSITO[1];
      b.vx = b.vy = 0;
      tirar(m, x);
      c.tarefa = null;
      m.eventos.push({ k: 'recolhido', nome: b.nome });
      const [a, z] = CHEGADA_MS;
      m.chegadas.push({ em: m.t + a + sorteia(m) * (z - a), id: b.id });
    }
    return true;
  }
  // Repor: primeiro o depósito, depois o lugar do móvel.
  const p = PROPS[x.i];
  if (!c.carga) {
    if (irParaLonge(m, c, DEPOSITO[0], DEPOSITO[1], vel, dt) < 0.45) c.carga = true;
    return true;
  }
  const [px, py] = pisavel(p.x + 0.5, p.y + 0.5);
  const falta = irParaLonge(m, c, px, py, vel * CARGA_VEL, dt);
  if (zonaDe(px, py) === zonaDe(c.x, c.y) && (Math.hypot(p.x + 0.5 - c.x, p.y + 0.5 - c.y) < 1.15 || falta < 0.35)) {
    m.quebrados.delete(x.i);
    m.livres.delete(p.x * 64 + p.y);
    c.carga = false;
    tirar(m, x);
    c.tarefa = null;
    m.eventos.push({ k: 'reposto', i: x.i });
    falar(m, c, 'ze_repoe', '#feae34');
  }
  return true;
}

/** Dano do carro (quase sempre nocaute) e a velocidade com que joga o corpo. */
export const DANO_CARRO = 60;
const VEL_CARRO_JOGA = 11;

/** Quem está na faixa quando o carro passa é atropelado (você também; amigo online cuida do próprio corpo). */
function atropelar(m: Mundo, t: number) {
  const carros = carrosEm(t);
  if (!carros.length) return;
  for (const car of carros) {
    for (const c of m.corpos) {
      if (c.ausente || deFora(c) || c.estado === 'segurado' || c.carro === car.id) continue;
      if (c.y < RUA - 0.05 || Math.abs(c.x - car.x) > CARRO_MEIO + 0.2) continue;
      c.carro = car.id;
      const dir = car.dir;
      const motorista = (c.lancadoPor && achar(m, c.lancadoPor)) || c;
      m.eventos.push({ k: 'atropelo', x: c.x, y: c.y, em: c.id, dir });
      m.eventos.push({ k: 'golpe', x: c.x, y: c.y, dano: DANO_CARRO, forte: true, arma: null, em: c.id, de: 'carro', dx: dir, dy: -0.3 });
      m.hitstopAte = Math.max(m.hitstopAte, t + 150);
      sacudir(m, 0.7);
      falar(m, c, 'atropelo', '#feae34');
      if (c.quem === 'amigo') {
        // Desmaiado não perde nada: só sai rolando.
        c.vx = dir * 6;
        c.vy = -2;
        continue;
      }
      const ja = caido(c);
      soltar(m, c);
      c.vida = Math.max(0, c.vida - DANO_CARRO);
      c.ultimoDano = t;
      c.flashAte = t + 90;
      c.vx = dir * VEL_CARRO_JOGA;
      c.vy = -3.5;
      c.voo = true;
      c.lancadoPor = motorista.id;
      if (c.estado === 'normal') {
        c.estado = 'voando';
        c.fase = 'nada';
        c.golpe = null;
      }
      if (!ja && c.vida <= 0) nocautear(m, c, motorista, 'carro', DANO_CARRO); // conta para quem jogou (você, se foi você)
    }
  }
}

/** Clientes novos chegando pela calçada no lugar de quem foi recolhido. */
function chegarClientes(m: Mundo, t: number) {
  for (let k = m.chegadas.length - 1; k >= 0; k--) {
    const ch = m.chegadas[k];
    if (t < ch.em) continue;
    m.chegadas.splice(k, 1);
    const b = achar(m, ch.id);
    if (!b) continue;
    m.avulsos++;
    const n = clienteAvulso(m.avulsos, () => sorteia(m));
    Object.assign(b, {
      id: n.id, nome: n.nome, npc: n, vida: FICHAS[n.tipo].vida, vidaMax: FICHAS[n.tipo].vida, estado: 'normal', ausente: false,
      x: ENTRADA[0], y: ENTRADA[1] + 2, vx: 0, vy: 0, koAte: 0, humor: 'voltando', alvo: null, rota: null, ink: 0, arma: null,
      pose: 'stand', fase: 'nada', golpe: null, voo: false, lancadoPor: null, seguradoPor: null, segurando: null,
      dono: null, quenteAte: 0, cortes: 0, cortadoPor: null,
    } satisfies Partial<Corpo>);
    m.eventos.push({ k: 'chegou', nome: n.nome });
  }
}

/* ------------------------------------------------------------------ amigos online (Fatia 3) */

/** Golpe de cada arma recebido pela rede (o dano vem na mensagem, limitado; empurrão e congelamento daqui). */
export function golpeRecebido(dano: number, arma: string, forte: boolean): Golpe {
  const base = arma in ARMAS ? ARMAS[arma as Arma] : forte ? EMPURRAO : JAB;
  return { ...base, dano: Math.max(1, Math.min(ehPoder(arma) ? 100 : 40, Math.round(dano))), forte };
}

/** Amigo entrou no bar: levanta do canto e vira corpo de pé movido pela rede. */
export function entrarRemoto(m: Mundo, id: AmigoId): Corpo | undefined {
  const c = achar(m, `amigo:${id}`);
  if (!c || c.quem === 'remoto') return c;
  // Quem estava arrastando o desmaiado larga (ele acordou).
  if (c.seguradoPor) {
    const h = achar(m, c.seguradoPor);
    if (h) h.segurando = null;
    c.seguradoPor = null;
  }
  c.quem = 'remoto';
  c.ink = 0;
  c.estado = 'normal';
  c.koAte = 0;
  c.deitado = null;
  c.vida = c.vidaMax = VIDA_EU;
  c.vx = c.vy = 0;
  c.voo = false;
  return c;
}

/** Amigo saiu: volta a dormir no canto dele. */
export function sairRemoto(m: Mundo, id: AmigoId) {
  const c = achar(m, `amigo:${id}`);
  if (!c || c.quem !== 'remoto') return;
  const k = CANTOS[id];
  c.quem = 'amigo';
  c.estado = 'ko';
  c.koAte = Infinity;
  c.deitado = k.pose;
  c.x = k.at[0];
  c.y = k.at[1];
  c.vx = c.vy = 0;
  c.vida = c.vidaMax = 1;
  c.andando = false;
  c.fase = 'nada';
}

/**
 * Um amigo te acertou (chegou pela rede): aplica em você como golpe de verdade, vindo do corpo dele (ou de onde
 * ele estava, se já saiu). Nocaute por amigo não chama o Tonhão nem conta calor.
 */
export function receberGolpe(m: Mundo, de: AmigoId, dano: number, kx: number, ky: number, arma: string, forte: boolean) {
  const me = eu(m);
  if (me.estado === 'ko' || (me.estado === 'segurado' && me.seguradoPor)) return;
  const quem = achar(m, `amigo:${de}`) ?? me;
  ferir(m, me, quem, golpeRecebido(dano, arma, forte), kx, ky, arma in ARMAS ? (arma as Arma) : null);
}

/** Quanto tempo o NPC fica "seu" depois do último contato. */
export const QUENTE_MS = 3000;

/** Corpo movido pela rede: amigo online ou NPC que está com um amigo. */
export const deFora = (c: Corpo) => c.quem === 'remoto' || !!c.dono;

/** Um amigo acertou um NPC que está com você (chegou pela rede): aplica de verdade, vindo do corpo dele. */
export function golpeNoNpc(m: Mundo, c: Corpo, de: AmigoId, dano: number, kx: number, ky: number, arma: string, forte: boolean) {
  if (c.quem !== 'npc' || c.dono || c.ausente) return;
  const quem = achar(m, `amigo:${de}`);
  if (!quem) return;
  ferir(m, c, quem, golpeRecebido(dano, arma, forte), kx, ky, arma in ARMAS ? (arma as Arma) : null);
}

/** O NPC deixou de ser marionete (o dono soltou ou saiu): volta à rotina aqui (caído, o Seu Zé recolhe). */
export function soltarMarionete(m: Mundo, c: Corpo) {
  if (!c.dono) return;
  c.dono = null;
  c.vx = c.vy = 0;
  c.voo = false;
  c.fase = 'nada';
  c.golpe = null;
  c.seguradoPor = null;
  if (c.estado === 'ko' || c.vida <= 0) {
    c.estado = 'ko';
    c.vida = 0;
    if (c.npc && FUNCIONARIOS.includes(c.npc.tipo)) c.koAte = m.t + 4000;
    else {
      c.koAte = Infinity;
      if (!m.tarefas.some((x) => x.k === 'corpo' && x.id === c.id)) m.tarefas.push({ k: 'corpo', id: c.id });
    }
    return;
  }
  c.estado = 'normal';
  c.humor = 'voltando';
  c.alvo = null;
  c.rota = null;
}

/** Desliza (x, y) por (dx, dy) parando nas paredes, como um corpo andando (para prever o amigo entre envios). */
export function deslizar(x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  const c = { x, y } as Corpo;
  mover(c, dx, dy);
  return { x: c.x, y: c.y };
}

/** O mundo visto por quem desenha: tudo que é corpo, com a pose do boneco. */
export function poseDe(c: Corpo, t: number): 'stand' | 'walk-a' | 'walk-b' | 'sit' | 'punch' | 'hurt' | 'ko' {
  if (c.estado === 'ko' || (c.estado === 'segurado' && (c.vida <= 0 || c.quem !== 'npc'))) return 'ko';
  if (c.estado === 'voando' || t < c.atordoadoAte || c.estado === 'segurado') return 'hurt';
  if (c.fase === 'antes' || (c.fase === 'depois' && t < c.faseAte - (c.golpe?.recupera ?? 0) * 0.5)) return 'punch';
  if (c.pose === 'sit' && !c.andando) return 'sit';
  if (c.andando) return Math.floor(t / 160) % 2 ? 'walk-a' : 'walk-b';
  return 'stand';
}

/* ------------------------------------------------------------------ o laço de quadros (tempo real) */

export const DT = 1 / 60;
/** No máximo 8 passos por quadro: depois de um engasgo o jogo não corre acelerado para recuperar. */
export const MAX_SUBPASSOS = 8;

export interface Toques {
  soco: boolean;
  agarra: boolean;
  usa: boolean;
}

/**
 * Avança o mundo pelo tempo de um quadro em passos fixos de 1/60 s. A direção vale em todos os passos (a 30 fps
 * anda o mesmo que a 60); os toques valem no primeiro passo que não estiver congelado pelo hit-stop (apertar J
 * durante o impacto não perde o soco). Devolve quantos passos deu.
 */
export function rodarQuadro(m: Mundo, laco: { acc: number }, dt: number, dir: { mx: number; my: number }, toques: Toques, aoPasso?: () => void): number {
  laco.acc = Math.min(laco.acc + Math.max(0, Math.min(dt, 0.25)), MAX_SUBPASSOS * DT);
  let n = 0;
  while (laco.acc >= DT - 1e-9) {
    const congelado = m.t + DT * 1000 < m.hitstopAte;
    const vale = !congelado && (toques.soco || toques.agarra || toques.usa);
    passo(m, { mx: dir.mx, my: dir.my, soco: vale && toques.soco, agarra: vale && toques.agarra, usa: vale && toques.usa }, DT);
    if (vale) toques.soco = toques.agarra = toques.usa = false;
    aoPasso?.();
    laco.acc -= DT;
    n++;
  }
  return n;
}
