/**
 * Dinheiro do bar e o mercado negro do beco. Puro (sem DOM): a tela guarda e mostra.
 *
 * Saldo = pontos do placar ÷ 10 (cruzadas, Palavra do Dia, anagrama, quiz) + o que você achou no chão (grana que cai
 * de quem você nocauteia) − o que já gastou. Gasto e achado ficam no aparelho e, se o banco aceitar, em
 * `bar/loja/{você}` (só sobem; vale o maior dos dois, então trocar de aparelho não zera nada).
 */
import { ARMAS } from './briga';
import type { Arma } from './mapa';
import { PODER, PODERES_NOVOS, PRECO_PODER } from './poderes';

export interface Item {
  arma: Arma;
  preco: number;
  /** A frase de venda do muambeiro. */
  papo: string;
}

/** O que o muambeiro vende: arma forte que acaba (cada golpe gasta um uso; arremessar gasta tudo). */
export const CATALOGO: readonly Item[] = [
  { arma: 'faca', preco: 15, papo: 'Faca de churrasco. Corta picanha e desaforo.' },
  { arma: 'socoingles', preco: 20, papo: 'Soco-inglês. Original de Taubaté.' },
  { arma: 'machadinha', preco: 35, papo: 'Machadinha. Pra quem não tem paciência com fila.' },
  { arma: 'marreta', preco: 60, papo: 'Marreta. Abre parede, abre mesa, abre caminho.' },
  { arma: 'serra', preco: 80, papo: 'Serra elétrica. Gasolina inclusa, consciência não.' },
  { arma: 'katana', preco: 120, papo: 'Katana. Veio do Japão. Ou de Guarulhos, não lembro.' },
  { arma: 'rajada', preco: PRECO_PODER, papo: 'Rajada do Fiado. Grita, carrega e manda tudo pra conta. Um uso só, sem troco.' },
  // Fatia 6: mais 10 poderes, todos a R$ 300 e de um uso.
  ...PODERES_NOVOS.map((p) => ({ arma: p, preco: PRECO_PODER, papo: `${PODER[p].papo} Um uso só.` })),
];

/** Cada R$ 1 do bar vale 10 pontos de placar. */
export const PONTOS_POR_REAL = 10;

export interface Carteira {
  /** Total gasto no mercado negro (só sobe). */
  g: number;
  /** Total achado no chão (só sobe). */
  a: number;
}

export const CARTEIRA_VAZIA: Carteira = { g: 0, a: 0 };

export function saldo(pontos: number, c: Carteira): number {
  return Math.max(0, Math.floor(Math.max(0, pontos) / PONTOS_POR_REAL) + c.a - c.g);
}

/** Soma os pontos de um jogador em todos os placares (qualquer chave). */
export function pontosDe(placar: Record<string, { s?: unknown }> | undefined): number {
  let t = 0;
  for (const v of Object.values(placar ?? {})) if (v && typeof v.s === 'number' && Number.isFinite(v.s) && v.s > 0) t += v.s;
  return t;
}

const inteiro = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export function sanitizeCarteira(raw: unknown): Carteira {
  const r = raw as Partial<Carteira> | null;
  return r && typeof r === 'object' ? { g: inteiro(r.g), a: inteiro(r.a) } : { ...CARTEIRA_VAZIA };
}

/** O aparelho e o banco podem estar em dia de jeitos diferentes: vale o maior de cada (os dois só sobem). */
export function juntar(x: Carteira, y: Carteira): Carteira {
  return { g: Math.max(x.g, y.g), a: Math.max(x.a, y.a) };
}

export type Compra = { ok: true; carteira: Carteira; item: Item } | { ok: false; motivo: string };

/** Compra um item: confere o saldo e devolve a carteira nova (não mexe na mão: a tela equipa). */
export function comprar(pontos: number, c: Carteira, arma: Arma): Compra {
  const item = CATALOGO.find((i) => i.arma === arma);
  if (!item) return { ok: false, motivo: 'Isso o muambeiro não tem.' };
  const s = saldo(pontos, c);
  if (s < item.preco) return { ok: false, motivo: `Falta R$ ${item.preco - s}. Muambeiro não vende fiado.` };
  return { ok: true, carteira: { g: c.g + item.preco, a: c.a }, item };
}

/** Grana achada no chão entra na carteira. */
export function achar(c: Carteira, v: number): Carteira {
  return { g: c.g, a: c.a + Math.max(0, Math.floor(v)) };
}

/** Descrição curta do item (dano e quantos usos) para a vitrine. */
export function ficha(arma: Arma): string {
  const a = ARMAS[arma];
  return `${a.dano} de dano · ${a.usos} usos`;
}
