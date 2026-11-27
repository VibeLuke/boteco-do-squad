/**
 * O mapa do Bar Vivo: um lugar contínuo (salão do boteco, salão lateral, beco e calçada) mais o banheiro, que é uma
 * área à parte (entra pela porta do salão). Coordenadas em ladrilhos: o ladrilho (tx, ty) ocupa [tx, tx+1) ×
 * [ty, ty+1); quem está em pé tem posição contínua (o centro do ladrilho é tx+0,5).
 *
 * Cada área tem paredes só nos fundos (y = y0 e x = x0): as bordas da frente ficam abertas, como casa de boneca.
 */
import { PESSOAS, type PlayerId } from '../turma/index';

export const COLS = 48;
export const ROWS = 16;
/** Última linha de dentro do bar; daí em diante é calçada. */
export const FACHADA = 9;
/** Linha do meio-fio (anda) e da rua (não anda). */
export const MEIO_FIO = 14;
export const RUA = 15;
/** A mureta que separa o salão do salão lateral fica nesta coluna, com uma passagem no meio. */
export const DIVISA = 13;
export const PASSAGEM: readonly [number, number] = [4, 6];
/** A grade entre o salão lateral e o beco, com o portão. */
export const GRADE = 22;
export const PORTAO: readonly [number, number] = [6, 7];
/** Fim do beco (última coluna antes do muro do pátio). */
export const FIM_BECO = 27;
/** O muro (grade) entre o beco e o pátio dos fundos, com o portão; e a última coluna do pátio. */
export const MURO_PATIO = 28;
export const PORTAO_PATIO: readonly [number, number] = [5, 6];
export const FIM_PATIO = 39;
export const PAREDE_H = 72;

export type Zona = 'bar' | 'banheiro';

export interface Area {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  /** Até onde vai a parede da esquerda (x = x0), em y. */
  paredeL: number;
}

/** Áreas desenhadas cada uma no seu fundo (a câmera fica presa na área de quem joga). */
export const AREAS: Record<Zona, Area> = {
  bar: { x0: 0, x1: FIM_PATIO + 1, y0: 0, y1: ROWS, paredeL: FACHADA + 1 },
  banheiro: { x0: 42, x1: 48, y0: 0, y1: 6, paredeL: 6 },
};

export function zonaDe(x: number, y: number): Zona {
  const a = AREAS.banheiro;
  return x >= a.x0 && x < a.x1 && y >= a.y0 && y < a.y1 ? 'banheiro' : 'bar';
}

export type Piso = 'taco' | 'lajota' | 'pedra' | 'meio-fio' | 'rua' | 'soleira' | 'beco' | 'xadrez' | 'vazio';

export function pisoDe(x: number, y: number): Piso {
  if (zonaDe(x, y) === 'banheiro') return 'xadrez';
  if (x > FIM_PATIO || x < 0 || y < 0) return 'vazio';
  if (y >= RUA) return 'rua';
  if (y === MEIO_FIO) return 'meio-fio';
  if (y > FACHADA) return 'pedra';
  if (x >= GRADE) return 'beco';
  if (y === FACHADA) return 'soleira';
  return x < DIVISA ? 'taco' : 'lajota';
}

/** Fora (noite): calçada, rua e beco. */
export const ladoDeFora = (x: number, y: number) => zonaDe(x, y) === 'bar' && (y > FACHADA || x >= GRADE);

export type Kind =
  | 'prateleira'
  | 'balcao'
  | 'chopeira'
  | 'banqueta'
  | 'geladeira'
  | 'freezer'
  | 'mesa-bar'
  | 'cadeira-bar'
  | 'mesa-sol'
  | 'cadeira-plastico'
  | 'engradados'
  | 'poste'
  | 'lixeira'
  | 'mureta'
  | 'grade'
  | 'sinuca'
  | 'void'
  | 'fliperama'
  | 'jukebox'
  | 'sofa'
  | 'vaso'
  | 'pilar'
  | 'cacamba'
  | 'barril-fogo'
  | 'churrasqueira'
  | 'privada'
  | 'pia'
  | 'mictorio'
  | 'banca'
  | 'lona';

export interface Prop {
  kind: Kind;
  x: number;
  y: number;
  /** Variação do desenho (cor, garrafas). */
  v: number;
}

/** Quem pode passar por cima: cadeiras (os NPCs sentam nelas). */
const ANDA_POR_CIMA: ReadonlySet<Kind> = new Set<Kind>(['cadeira-bar', 'cadeira-plastico']);

const P = (kind: Kind, x: number, y: number, v = 0): Prop => ({ kind, x, y, v });

function montar(): Prop[] {
  const out: Prop[] = [];
  // Salão: prateleira de garrafas no fundo, balcão de fórmica com azulejo, chopeiras e banquetas.
  for (let x = 2; x <= 9; x++) out.push(P('prateleira', x, 0, x));
  for (let x = 2; x <= 9; x++) out.push(P(x === 4 || x === 7 ? 'chopeira' : 'balcao', x, 2, x));
  for (const x of [3, 5, 7, 9]) out.push(P('banqueta', x, 3, x));
  out.push(P('geladeira', 11, 0, 0), P('geladeira', 12, 0, 1));
  out.push(P('freezer', 0, 3, 0), P('vaso', 0, 0, 0));
  out.push(P('mesa-bar', 3, 6, 0), P('cadeira-bar', 2, 6, 0), P('cadeira-bar', 3, 7, 1));
  out.push(P('mesa-bar', 8, 7, 1), P('cadeira-bar', 9, 7, 0), P('cadeira-bar', 8, 8, 1));
  // Mureta entre o salão e o salão lateral, com a passagem no meio.
  for (let y = 0; y <= FACHADA; y++) if (y < PASSAGEM[0] || y > PASSAGEM[1]) out.push(P('mureta', DIVISA, y, y));
  // Salão lateral: mesa de sinuca 1 (3×2, desenhada do ladrilho da frente), fliperamas, jukebox e o sofá.
  // (A mesa 2 vai no fim da lista: o índice dos móveis viaja na rede e não pode mudar.)
  out.push(P('sinuca', 18, 3, 0));
  for (let x = 16; x <= 18; x++) for (let y = 2; y <= 3; y++) if (x !== 18 || y !== 3) out.push(P('void', x, y));
  out.push(P('fliperama', 15, 0, 0), P('fliperama', 16, 0, 1), P('jukebox', 18, 0, 0));
  out.push(P('sofa', 21, 7, 0), P('sofa', 21, 8, 1));
  out.push(P('pilar', 0, FACHADA, 0), P('pilar', 21, FACHADA, 1));
  // Grade entre o salão lateral e o beco, com o portão.
  for (let y = 0; y <= FACHADA; y++) if (y < PORTAO[0] || y > PORTAO[1]) out.push(P('grade', GRADE, y, y));
  // Beco: caçamba, barril com fogo, engradados, lixeira e o churrasquinho na boca do beco.
  out.push(P('cacamba', 26, 1, 0), P('cacamba', 27, 1, 1));
  out.push(P('barril-fogo', 25, 5, 0), P('engradados', 25, 0, 1), P('engradados', 27, 7, 0), P('lixeira', 27, 4, 0));
  out.push(P('churrasqueira', 24, 10, 0));
  // Calçada: mesas de plástico com guarda-sol de cerveja, cadeiras, engradados, poste e lixeira.
  out.push(P('mesa-sol', 3, 11, 0), P('cadeira-plastico', 2, 11, 0), P('cadeira-plastico', 3, 12, 1));
  out.push(P('mesa-sol', 8, 12, 1), P('cadeira-plastico', 9, 12, 0), P('cadeira-plastico', 8, 11, 1));
  out.push(P('mesa-sol', 15, 11, 2), P('cadeira-plastico', 16, 11, 0), P('cadeira-plastico', 15, 12, 1));
  out.push(P('mesa-sol', 19, 12, 0), P('cadeira-plastico', 18, 12, 1));
  out.push(P('engradados', 11, 10, 0), P('engradados', 12, 10, 1));
  out.push(P('poste', 21, 13, 0), P('lixeira', 0, 13, 0), P('poste', 27, 12, 1));
  // Banheiro (área à parte): duas privadas, mictório, pia com espelho e lixeira.
  out.push(P('privada', 44, 0, 0), P('privada', 46, 0, 1), P('mictorio', 47, 0, 0), P('pia', 42, 2, 0), P('lixeira', 47, 5, 1));
  // Mesa de sinuca 2, embaixo da primeira (o corredor entre as duas leva ao sofá e ao beco).
  out.push(P('sinuca', 18, 7, 1));
  for (let x = 16; x <= 18; x++) for (let y = 6; y <= 7; y++) if (x !== 18 || y !== 7) out.push(P('void', x, y));
  // Pátio dos fundos (Fatia 4): muro de grade com portão, a barraca do mercado negro no canto (lona atrás, banca na
  // frente; o Muambeiro fica entre as duas), poste e o barril de fogo. O paredão dos procurados é pintado no fundo.
  for (let y = 0; y <= FACHADA; y++) if (y < PORTAO_PATIO[0] || y > PORTAO_PATIO[1]) out.push(P('grade', MURO_PATIO, y, y + 3));
  for (let x = 35; x <= 37; x++) out.push(P('lona', x, 5, x - 35));
  for (let x = 35; x <= 37; x++) out.push(P('banca', x, 7, x - 35));
  out.push(P('poste', 33, 9, 0), P('barril-fogo', 30, 8, 1), P('cacamba', 39, 2, 1));
  return out;
}

export const PROPS: readonly Prop[] = montar();

const bloq = new Set<number>();
for (const p of PROPS) if (!ANDA_POR_CIMA.has(p.kind)) bloq.add(p.x * 64 + p.y);

/** Dá para pisar neste ladrilho? (A rua, o vão entre as áreas e fora do mapa, não.) */
export function anda(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= COLS || y >= RUA) return false;
  if (pisoDe(x, y) === 'vazio') return false;
  return !bloq.has(x * 64 + y);
}

export function propEm(x: number, y: number): Prop | undefined {
  return PROPS.find((p) => p.x === x && p.y === y);
}

/* ------------------------------------------------------------------ enfeites das paredes (pintados no fundo) */

export type Enfeite =
  | 'neon'
  | 'tv'
  | 'precos'
  | 'fiado'
  | 'banheiro'
  | 'relogio'
  | 'dardos'
  | 'cartaz'
  | 'calendario'
  | 'lousa'
  | 'grafite'
  | 'espelho'
  | 'porta'
  | 'deposito'
  | 'quiz'
  | 'portal'
  | 'procurados'
  | 'janela';

export interface NaParede {
  kind: Enfeite;
  /** 'R' = parede do fundo (ao longo de x, em y = y0 da área); 'L' = parede da esquerda (ao longo de y, em x = x0). */
  side: 'R' | 'L';
  zona: Zona;
  from: number;
  to: number;
  /** Altura da base do enfeite, em px acima do chão. */
  h: number;
}

export const PAREDE: readonly NaParede[] = [
  { kind: 'relogio', side: 'R', zona: 'bar', from: 1, to: 1, h: 40 },
  { kind: 'deposito', side: 'R', zona: 'bar', from: 1, to: 1, h: 0 },
  { kind: 'neon', side: 'R', zona: 'bar', from: 3, to: 8, h: 50 },
  { kind: 'tv', side: 'R', zona: 'bar', from: 10, to: 11, h: 46 },
  { kind: 'lousa', side: 'R', zona: 'bar', from: 14, to: 14, h: 24 },
  { kind: 'quiz', side: 'R', zona: 'bar', from: 16, to: 17, h: 30 },
  { kind: 'dardos', side: 'R', zona: 'bar', from: 20, to: 21, h: 30 },
  { kind: 'portal', side: 'R', zona: 'bar', from: 23, to: 24, h: 2 },
  { kind: 'grafite', side: 'R', zona: 'bar', from: 25, to: 27, h: 6 },
  { kind: 'fiado', side: 'L', zona: 'bar', from: 1, to: 2, h: 34 },
  { kind: 'banheiro', side: 'L', zona: 'bar', from: 5, to: 6, h: 0 },
  { kind: 'precos', side: 'L', zona: 'bar', from: 7, to: 8, h: 26 },
  { kind: 'procurados', side: 'R', zona: 'bar', from: 29, to: 38, h: 10 },
  { kind: 'janela', side: 'R', zona: 'banheiro', from: 45, to: 45, h: 44 },
  { kind: 'espelho', side: 'L', zona: 'banheiro', from: 2, to: 2, h: 30 },
  { kind: 'porta', side: 'L', zona: 'banheiro', from: 4, to: 5, h: 0 },
];

/* ------------------------------------------------------------------ pontos de interesse */

export type Jogo = 'cruzadas' | 'palavra' | 'anagrama' | 'quiz' | 'placar' | 'fliperama' | 'dardos' | 'bilhar1' | 'bilhar2' | 'mercado' | 'portal' | 'jukebox' | 'porrinha' | 'mural';

/** Onde fica cada jogo e onde se para para usar (o ladrilho de pé na frente do objeto). */
export const JOGOS: readonly { jogo: Jogo; nome: string; at: readonly [number, number] }[] = [
  { jogo: 'cruzadas', nome: 'Caderneta de cruzadas (no balcão)', at: [2, 3] },
  { jogo: 'palavra', nome: 'Palavra do Dia (quadro de preços)', at: [1, 8] },
  { jogo: 'quiz', nome: 'Quiz geek (TV)', at: [10, 2] },
  { jogo: 'quiz', nome: 'Quiz geek (letreiro)', at: [16, 1] },
  { jogo: 'bilhar1', nome: 'Mesa de sinuca 1', at: [15, 3] },
  { jogo: 'bilhar2', nome: 'Mesa de sinuca 2', at: [15, 7] },
  // Fatia 6: a jukebox toca música para o bar inteiro; o Anagrama da Saideira abre de dentro dela.
  { jogo: 'jukebox', nome: 'Jukebox', at: [18, 1] },
  { jogo: 'placar', nome: 'Lousa do placar', at: [14, 1] },
  { jogo: 'fliperama', nome: 'Fliperama', at: [15, 1] },
  { jogo: 'dardos', nome: 'Dardos', at: [20, 1] },
  // Fatia 18: a Porrinha na mesa do salão (Biriba e Tiozão do pagode) e o mural de boatos no quadro do fiado.
  { jogo: 'porrinha', nome: 'Porrinha (mesa do Biriba)', at: [4, 6] },
  { jogo: 'mural', nome: 'Mural de boatos (quadro do fiado)', at: [1, 1] },
];

/** Portas que levam de uma área para outra (fica de pé no ladrilho e usa). */
export const PORTAS: readonly { at: readonly [number, number]; para: readonly [number, number]; nome: string }[] = [
  { at: [0, 5], para: [43.0, 4.5], nome: 'Banheiro (interditado, mas quem liga)' },
  { at: [42, 4], para: [1.0, 5.5], nome: 'Voltar para o salão' },
];

/** Armas que dá para pegar do cenário (voltam ao lugar depois de um tempo). */
export type Arma =
  | 'garrafa'
  | 'caco'
  | 'banqueta'
  | 'taco'
  | 'cadeira'
  | 'cano'
  | 'desentupidor'
  // móveis que dá para pegar e usar
  | 'cadeirao'
  | 'vaso'
  | 'engradado'
  | 'lixeira'
  // do mercado negro (acabam: gastou, compra outro)
  | 'faca'
  | 'socoingles'
  | 'machadinha'
  | 'serra'
  // Fatia 4: o que se acha pelo bar, pátio e calçada (e o que a Dona Maria larga)
  | 'frigideira'
  | 'bastao'
  | 'violao'
  | 'extintor'
  | 'guardasol'
  | 'tijolo'
  | 'espeto'
  | 'placa'
  | 'rodo'
  // Fatia 4: mercado negro
  | 'katana'
  | 'marreta'
  // Fatia 5: o poder especial (R$ 1.000, um uso)
  | 'rajada'
  // Fatia 6: os 10 poderes novos (ver poderes.ts).
  | 'tampinhas'
  | 'arroto'
  | 'furacao'
  | 'chope'
  | 'pagode'
  | 'raio'
  | 'torresmo'
  | 'garcom'
  | 'pinga'
  | 'ima'
  // Fatia 12: ingredientes das receitas do balcão, a raquete (choque) e o que sai das receitas.
  | 'pano'
  | 'prego'
  | 'fita'
  | 'raquete'
  | 'molotov'
  | 'tacoprego'
  | 'espuma'
  | 'sococaco';

/** Móvel que vira arma na mão (E de frente para ele); o Seu Zé repõe depois. */
export const MOVEL_ARMA: Partial<Record<Kind, Arma>> = {
  'cadeira-bar': 'cadeirao',
  'cadeira-plastico': 'cadeira',
  banqueta: 'banqueta',
  vaso: 'vaso',
  engradados: 'engradado',
  lixeira: 'lixeira',
};

/** Onde ficam o portal e o Rocky (beco) e o muambeiro, atrás da banca do mercado negro (pátio). */
export const PORTAL: readonly [number, number] = [24, 0.2];
export const MUAMBEIRO: readonly [number, number] = [36.5, 6.3];
/** Na frente da banca: daqui (até RAIO_MERCADO) o E abre o mercado. */
export const BALCAO_MERCADO: readonly [number, number] = [36.5, 8.5];
export const RAIO_MERCADO = 1.7;
export const ROCKY: readonly [number, number] = [25.6, 1.6];

export const ARMAS_NO_CHAO: readonly { arma: Arma; at: readonly [number, number] }[] = [
  { arma: 'garrafa', at: [4, 5] },
  { arma: 'garrafa', at: [9, 6] },
  { arma: 'garrafa', at: [4, 10] },
  { arma: 'garrafa', at: [14, 12] },
  { arma: 'taco', at: [16, 5] },
  { arma: 'banqueta', at: [10, 4] },
  { arma: 'cadeira', at: [7, 13] },
  { arma: 'cano', at: [24, 3] },
  { arma: 'garrafa', at: [26, 8] },
  { arma: 'desentupidor', at: [45, 3] },
  // Fatia 4: cozinha atrás do balcão, canto do pagode, parede do salão, calçada, pátio e o canto da Dona Maria.
  { arma: 'frigideira', at: [7, 1] },
  { arma: 'violao', at: [19, 1] },
  { arma: 'extintor', at: [1, 8] },
  { arma: 'guardasol', at: [12, 12] },
  { arma: 'espeto', at: [17, 11] },
  { arma: 'bastao', at: [31, 4] },
  { arma: 'tijolo', at: [33, 3] },
  { arma: 'placa', at: [2, 4] },
  { arma: 'rodo', at: [0, 1] },
  // Fatia 12: o pano da Dona Maria, o prego do pátio, a fita atrás do balcão e a raquete mata-moscas.
  { arma: 'pano', at: [1, 6] },
  { arma: 'prego', at: [30, 4] },
  { arma: 'fita', at: [8, 1] },
  { arma: 'raquete', at: [12, 4] },
];

/** Fatia 12: o canto do balcão onde se juntam dois itens (E com um item na mão). */
export const BANCADA: readonly [number, number] = [10.5, 3.5];
export const RAIO_BANCADA = 0.85;

export type AmigoId = PlayerId;
export type Deitado = 'ko-slump' | 'ko-flat' | 'ko-bottle';

/** Onde cada amigo fica desmaiado quando não está jogando. */
/** Os 5 cantos, na ordem da turma (src/turma/turma.ts). O texto tem a forma "do" e a "da". */
const CANTOS_POS: readonly { at: readonly [number, number]; pose: Deitado; onde: readonly [string, string] }[] = [
  { at: [6.5, 3.6], pose: 'ko-slump', onde: ['debruçado no balcão', 'debruçada no balcão'] },
  { at: [8.5, 13.5], pose: 'ko-flat', onde: ['debaixo da mesa da calçada', 'debaixo da mesa da calçada'] },
  { at: [20.4, 8.5], pose: 'ko-flat', onde: ['caído do sofá', 'caída do sofá'] },
  { at: [21.4, 4.6], pose: 'ko-slump', onde: ['encostado na grade do beco', 'encostada na grade do beco'] },
  { at: [25.5, 7.5], pose: 'ko-bottle', onde: ['abraçado na garrafa, no beco', 'abraçada na garrafa, no beco'] },
];
export const CANTOS: Record<AmigoId, { at: readonly [number, number]; pose: Deitado; onde: string }> = Object.fromEntries(
  PESSOAS.map((p, i) => {
    const c = CANTOS_POS[i % CANTOS_POS.length];
    return [p.id, { at: c.at, pose: c.pose, onde: c.onde[p.artigo === 'da' ? 1 : 0] }];
  }),
) as Record<AmigoId, { at: readonly [number, number]; pose: Deitado; onde: string }>;

/** Onde quem chega aparece e onde o leão de chácara joga quem ele expulsa. */
export const ENTRADA: readonly [number, number] = [6.5, 11.5];
/** Onde o Seu Zé some com o que recolhe e de onde traz mobília nova (a porta atrás do balcão). */
export const DEPOSITO: readonly [number, number] = [1.5, 0.6];

/** O que quebra quando alguém voa em cima (ou leva uma garrafa arremessada): o Seu Zé repõe do depósito. */
export const QUEBRAVEIS: ReadonlySet<Kind> = new Set<Kind>(['mesa-bar', 'cadeira-bar', 'mesa-sol', 'cadeira-plastico', 'banqueta', 'vaso', 'engradados', 'lixeira']);
const PROP_IDX = new Map(PROPS.map((p, i) => [p.x * 64 + p.y, i]));
/** Índice do móvel no ladrilho (ou -1). */
export const propIdx = (x: number, y: number): number => PROP_IDX.get(x * 64 + y) ?? -1;
export const SARJETA: readonly [number, number] = [11.5, 14.5];

/* ------------------------------------------------------------------ hora do bar (igual em todo aparelho) */

/** Happy hour: 4 minutos a cada 12 (pela hora do servidor). */
export const HAPPY_CICLO = 12 * 60_000;
export const HAPPY_DURA = 4 * 60_000;
export const happyHour = (t: number) => ((t % HAPPY_CICLO) + HAPPY_CICLO) % HAPPY_CICLO < HAPPY_DURA;

/** Carros na rua: um por janela de 6 s, com sentido, velocidade e cor sorteados pela própria janela (igual em todo aparelho). */
export const JANELA_CARRO = 6000;
/** Comprimento do carro (ladrilhos) e por onde ele entra e sai, além da ponta da rua. */
export const CARRO_MEIO = 1.25;
const CARRO_DE = -4;
const CARRO_ATE = FIM_PATIO + 5;

export interface Carro {
  id: number;
  x: number;
  y: number;
  dir: 1 | -1;
  vel: number;
  cor: number;
}

function hashJ(j: number): number {
  let h = 2166136261 ^ (j * 2654435761);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}

export function carroDaJanela(j: number): { sai: number; dir: 1 | -1; vel: number; cor: number; vem: boolean } {
  const h = hashJ(j);
  return {
    sai: j * JANELA_CARRO + (h % 2500),
    dir: h & 1 ? 1 : -1,
    vel: 7 + ((h >>> 3) % 50) / 10,
    cor: (h >>> 9) % 6,
    // Uma janela em cada cinco a rua fica vazia (dá para atravessar).
    vem: (h >>> 13) % 5 !== 0,
  };
}

/** Os carros que estão na rua na hora t (função pura da hora). */
export function carrosEm(t: number): Carro[] {
  const out: Carro[] = [];
  const j0 = Math.floor(t / JANELA_CARRO);
  for (let j = j0 - 2; j <= j0; j++) {
    const c = carroDaJanela(j);
    if (!c.vem || t < c.sai) continue;
    const andou = (c.vel * (t - c.sai)) / 1000;
    const x = c.dir > 0 ? CARRO_DE + andou : CARRO_ATE - andou;
    if (x < CARRO_DE || x > CARRO_ATE) continue;
    out.push({ id: j, x, y: RUA + 0.5, dir: c.dir, vel: c.vel, cor: c.cor });
  }
  return out;
}

/** A briga que estoura sozinha: uma por janela de 150 s, num instante sorteado pela própria janela. */
export const JANELA_BRIGA = 150_000;
export function brigaDaJanela(j: number): { em: number; sorteio: number } {
  let h = 2166136261 ^ j;
  h = Math.imul(h ^ (h >>> 13), 16777619);
  h = Math.imul(h ^ (h >>> 7), 2246822519);
  h = (h ^ (h >>> 16)) >>> 0;
  return { em: j * JANELA_BRIGA + 20_000 + (h % 100_000), sorteio: h };
}
