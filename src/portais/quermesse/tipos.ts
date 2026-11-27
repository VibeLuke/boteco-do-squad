/**
 * Contrato dos microjogos da Quermesse Maluca (Fatia 14). Cada microjogo é um arquivo desta pasta que exporta
 * `micro: Micro<E>`: começa com o sorteio e a velocidade, anda um passo fixo de 1/60 s com a entrada do jogador e diz
 * se ganhou, perdeu ou segue andando. Tudo puro e determinístico (o sorteio vem de fora), então o mesmo microjogo
 * roda igual no Node e no navegador, e o teste de conformidade passa em todo arquivo novo da pasta sem mexer no motor.
 *
 * A dificuldade vem só da velocidade: a "janela" (quanto tempo a hora certa fica aberta) é de 300 ms na velocidade 1
 * e cai pela metade na velocidade 2. O tempo de cada microjogo também encolhe com a velocidade (6 s → 3 s).
 */
export const DT = 1 / 60;

/** Entrada de um passo: direção do stick (−1 a 1), `acao` = apertou agora (borda, não segurar). */
export interface EntradaQ {
  mx: number;
  my: number;
  acao?: boolean;
}
export const PARADA: EntradaQ = { mx: 0, my: 0 };

export type Resultado = 'andando' | 'ganhou' | 'perdeu';

/** Janela da hora certa na velocidade 1 (ms). Calibrada: o relatório sugeria 400 ms, mas com 300 o bot de reação de
 * 250 ± 80 ms vence 68% nas rodadas 1–6, 49% nas 7–12 e 34% depois (a meta era 70, 50 e 30). */
export const JANELA_MS = 300;
/** Janela em segundos na velocidade `vel`. */
export const janela = (vel: number) => JANELA_MS / 1000 / vel;
/** Duração em passos de `s` segundos na velocidade `vel` (o microjogo encolhe junto). */
export const passosDe = (s: number, vel: number) => Math.round(s / vel / DT);

export interface Micro<E> {
  id: string;
  /** Instrução de uma palavra, no topo da tela. */
  verbo: string;
  /** Nome da barraca. */
  nome: string;
  /** Chefe: 10 s e vale 3 pontos. */
  chefe?: boolean;
  /** Tempo máximo em segundos na velocidade 1 (o teste confere ≤ 6, ou ≤ 10 no chefe). */
  segundos: number;
  iniciar(r: () => number, vel: number): E;
  passo(e: E, ent: EntradaQ): void;
  resultado(e: E): Resultado;
  /** A deixa: é a hora certa de apertar (o bot de reação reage a ela). */
  pronto(e: E): boolean;
  /** Jogador perfeito. */
  bot(e: E): EntradaQ;
  /** O aperto certo para a hora certa (o bot de reação usa: na Quadrilha é a direção da seta, nos outros é `acao`). */
  resposta(e: E): EntradaQ;
  /** Passos andados e o total (para a barra do pavio). */
  tempo(e: E): { t: number; dur: number };
  desenhar(c: CanvasRenderingContext2D, e: E, w: number, h: number, quadro: number): void;
}

/** Estado comum: tempo, duração, resultado. Os microjogos estendem este. */
export interface Base {
  t: number;
  dur: number;
  vel: number;
  res: Resultado;
}

export function base(vel: number, segundos: number): Base {
  return { t: 0, dur: passosDe(segundos, vel), vel, res: 'andando' };
}

/** Anda o relógio: estourou o tempo sem ganhar, perdeu. */
export function relogio(e: Base) {
  if (e.res !== 'andando') return;
  e.t++;
  if (e.t >= e.dur) e.res = 'perdeu';
}

/** Leva `de` até `para` com passo máximo `v`. */
export const aproximar = (de: number, para: number, v: number) => (Math.abs(para - de) <= v ? para : de + Math.sign(para - de) * v);
