/**
 * Churrasco Jurássico (Fatia 20, terceiro portal): corrida de um botão. O churrasqueiro corre sozinho por uma terra
 * de vulcões com o espeto na mão; o único botão pula. Osso no chão e poça de lava: pula. Pterodáctilo voando baixo:
 * NÃO pula (passa por baixo). Picanha: pega. Chega na churrasqueira do fim com espeto sobrando e vence.
 *
 * Tudo puro e determinístico: a pista vem da semente do dia (todo mundo corre a mesma), a velocidade é função da
 * distância e o passo é fixo (1/60 s). A pista é montada com folga de reação e de pulo em toda velocidade, e o teste
 * prova com um robô que toda pista sorteada dá para vencer sem tomar dano.
 */
import { rng } from '../../vivo/eventos';

export const DT = 1 / 60;
/** Gravidade e velocidade do pulo (ladrilhos por segundo): sobe ~2,2 ladrilhos e fica ~0,68 s no ar. */
export const GRAV = 38;
export const PULO_V = 13;
/** Pulo apertado um pouco antes de pousar vale; e dá para pular logo depois de sair da beirada. */
export const BUFFER_S = 0.12;
export const COYOTE_S = 0.08;
/** O corpo do churrasqueiro (ladrilhos). A altura cobre o desenho inteiro, chapéu incluído (29 px de 16 por ladrilho):
 * com 1,0 o chapéu atravessava o pterodáctilo na tela e nada acontecia. */
export const LARG = 0.6;
export const ALT = 1.85;
export const VIDAS = 3;
export const INVULN_S = 1.2;
/** Onde fica a churrasqueira do fim. */
export const FIM_X = 600;
export const VERSAO = 1;

/** Velocidade em função de onde você está: começa em 6 e chega a 12 ladrilhos/s no 500. */
export function vel(x: number): number {
  return Math.min(12, 6 + Math.max(0, x) * 0.012);
}
/** Tempo no ar de um pulo inteiro e quanto chão ele cobre nessa velocidade. */
export const AR_S = (2 * PULO_V) / GRAV;
export const alcancePulo = (v: number) => v * AR_S;

export type TipoItem = 'osso' | 'lava' | 'ptero' | 'picanha';
export interface Item {
  id: number;
  tipo: TipoItem;
  x: number;
  w: number;
  /** Faixa de altura que machuca ou que pega (do chão para cima). */
  y0: number;
  y1: number;
}

export const OSSO_ALT = 0.9;
export const PICANHA_ALTA: readonly [number, number] = [3.2, 3.6];
export const PTERO_Y: readonly [number, number] = [2.0, 2.7];

/** A pista do dia: itens em ordem de x, com folga para reagir e pular em qualquer velocidade. */
export function pista(semente: number): Item[] {
  const r = rng((semente ^ 0xc4a0) >>> 0);
  const out: Item[] = [];
  let x = 14;
  let id = 0;
  while (x < FIM_X - 16) {
    const v = vel(x);
    const jl = alcancePulo(v);
    const reage = v * 0.9 + jl + 1.5;
    const s = r();
    if (s < 0.42) {
      const w = 0.7 + r() * 0.5;
      out.push({ id: id++, tipo: 'osso', x, w, y0: 0, y1: OSSO_ALT });
      // Às vezes uma picanha no alto do pulo, de prêmio para quem pula na hora certa (acima da cabeça de quem só corre).
      if (r() < 0.35) out.push({ id: id++, tipo: 'picanha', x: x + w / 2 - 0.2, w: 0.4, y0: PICANHA_ALTA[0], y1: PICANHA_ALTA[1] });
      x += w + reage + r() * v * 0.8;
    } else if (s < 0.7) {
      const w = Math.max(1.2, Math.min(jl - 2.2, 1.2 + r() * (jl * 0.55 - 1.2)));
      out.push({ id: id++, tipo: 'lava', x, w, y0: -1, y1: 0 });
      x += w + reage + r() * v * 0.8;
    } else if (s < 0.88) {
      out.push({ id: id++, tipo: 'ptero', x, w: 1.0, y0: PTERO_Y[0], y1: PTERO_Y[1] });
      // Depois do pterodáctilo, chão livre o bastante para não precisar pular embaixo dele.
      x += 1.0 + v * 0.9 + 2.5 + r() * v * 0.6;
    } else {
      for (let k = 0; k < 3; k++) out.push({ id: id++, tipo: 'picanha', x: x + k * 0.9, w: 0.4, y0: 0.2, y1: 0.6 });
      x += 3 + v * 0.6;
    }
  }
  return out;
}

export interface Corrida {
  x: number;
  y: number;
  vy: number;
  noChao: boolean;
  coyote: number;
  buffer: number;
  vidas: number;
  invAte: number;
  t: number;
  picanhas: number;
  pegos: number[];
  danos: number;
  acabou: boolean;
  venceu: boolean;
  itens: Item[];
}

export type EventoC = { k: 'pulo' } | { k: 'bateu'; tipo: TipoItem } | { k: 'caiu' } | { k: 'carne' } | { k: 'chegou' } | { k: 'fim' };

export function novaCorrida(semente: number): Corrida {
  return { x: 0, y: 0, vy: 0, noChao: true, coyote: 0, buffer: 0, vidas: VIDAS, invAte: 0, t: 0, picanhas: 0, pegos: [], danos: 0, acabou: false, venceu: false, itens: pista(semente) };
}

const sobre = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

/** Um passo de 1/60 s. `pulo` é o aperto deste quadro (não o botão segurado). */
export function passoC(c: Corrida, pulo: boolean, dt = DT): EventoC[] {
  const ev: EventoC[] = [];
  if (c.acabou) return ev;
  c.t += dt;
  c.x += vel(c.x) * dt;
  c.buffer = pulo ? BUFFER_S : Math.max(0, c.buffer - dt);
  c.coyote = c.noChao ? COYOTE_S : Math.max(0, c.coyote - dt);
  if (c.buffer > 0 && c.coyote > 0) {
    c.vy = PULO_V;
    c.noChao = false;
    c.coyote = 0;
    c.buffer = 0;
    ev.push({ k: 'pulo' });
  }
  if (!c.noChao) {
    c.vy -= GRAV * dt;
    c.y += c.vy * dt;
    if (c.y <= 0) {
      c.y = 0;
      c.vy = 0;
      c.noChao = true;
    }
  }
  const meio = c.x + LARG / 2;
  const inv = c.t < c.invAte;
  for (const it of c.itens) {
    if (it.x > c.x + 2) break;
    if (it.x + it.w < c.x - 1) continue;
    if (it.tipo === 'picanha') {
      if (!c.pegos.includes(it.id) && sobre(c.x, c.x + LARG, it.x, it.x + it.w) && sobre(c.y, c.y + ALT, it.y0, it.y1)) {
        c.pegos.push(it.id);
        c.picanhas++;
        ev.push({ k: 'carne' });
      }
      continue;
    }
    if (it.tipo === 'lava') {
      // Pisou na lava: perde um espeto e reaparece do outro lado.
      if (c.noChao && meio >= it.x && meio <= it.x + it.w) {
        if (!inv) {
          c.vidas--;
          c.danos++;
          c.invAte = c.t + INVULN_S;
        }
        c.x = it.x + it.w + 0.2;
        ev.push({ k: 'caiu' });
      }
      continue;
    }
    if (!inv && sobre(c.x, c.x + LARG, it.x, it.x + it.w) && sobre(c.y, c.y + ALT, it.y0, it.y1)) {
      c.vidas--;
      c.danos++;
      c.invAte = c.t + INVULN_S;
      ev.push({ k: 'bateu', tipo: it.tipo });
    }
  }
  if (c.vidas <= 0) {
    c.acabou = true;
    ev.push({ k: 'fim' });
  } else if (c.x >= FIM_X) {
    c.acabou = true;
    c.venceu = true;
    ev.push({ k: 'chegou' }, { k: 'fim' });
  }
  return ev;
}

/** Pontos: 1 por 10 ladrilhos corridos e 5 por picanha. */
export function pontosDe(c: Corrida): number {
  return Math.floor(Math.min(c.x, FIM_X) / 10) + 5 * c.picanhas;
}
