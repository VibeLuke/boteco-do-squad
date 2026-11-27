/**
 * Fatia 11: a visita do alienígena e a invasão, em funções puras de (semente, tempo, livros de dano).
 *
 * - Visita (60 s): o visitante de capacete-aquário senta no balcão e pede uma gelada. Se ninguém o derrubar, ele paga
 *   uma gorjeta cósmica pequena e vai embora (final pacífico).
 * - Morte: se o livro de dano do visitante passa da vida, o primeiro aparelho grava o fim (com o carimbo do servidor) e
 *   a invasão começa a contar dali.
 * - Invasão (120 s): alerta de 6 s; discos pequenos chegam em ondas (6 + 14k s) e abrem um feixe de 8 s sobre um NPC
 *   sorteado; o disco que leva dano suficiente antes do fim do feixe é derrubado e o NPC fica. Aos 36 s (30%) chega o
 *   disco grande, que varre linhas com raio (aviso de 1,2 s) e foge no fim se continuar inteiro.
 * - Desfecho (três estados, pelos livros): vitória (grande derrubado e no máximo `cota` NPCs levados), derrota (grande
 *   inteiro e cota estourada) ou empate (um dos dois).
 */
import { hashTexto, rng, somaLivro, vidaEscalada } from './eventos';

export const VISITA_MS = 60_000;
export const INVASAO_MS = 120_000;
export const ALERTA_MS = 6_000;
export const N_DISCOS = 6;
export const ONDA_MS = 14_000;
export const FEIXE_MS = 8_000;
export const GRANDE_EM = 36_000;
export const VARRE_MS = 8_000;
export const VARRE_AVISO = 1_200;
export const VARRE_ATIVO = 400;

export const ALIEN_VIDA = 120;
export const DISCO_VIDA = 50;
export const GRANDE_VIDA = 300;
export const DANO_RAIO = 18;
/** Onde o visitante senta (na frente do balcão, entre as banquetas). */
export const ASSENTO_ALIEN = [6.5, 3.4] as const;

/** Quando o disco `k` abre o feixe (ms depois da morte do visitante). */
export function ondaDisco(k: number): number {
  return ALERTA_MS + ONDA_MS * k;
}

/** Que NPC cada disco tenta levar: sorteio pela semente, sem repetir enquanto houver NPC novo. */
export function alvosDiscos(semente: number, npcs: readonly string[]): string[] {
  const r = rng(hashTexto(`discos|${semente}`));
  const fila = [...npcs].sort().map((id) => ({ id, k: r() })).sort((a, b) => a.k - b.k).map((o) => o.id);
  return Array.from({ length: N_DISCOS }, (_, k) => fila[k % Math.max(1, fila.length)] ?? '');
}

export type FaseDisco = 'longe' | 'feixe' | 'derrubado' | 'levou';

/**
 * Estado do disco `k` em `tRel` (ms desde a morte), pelo livro de dano dele. Dano só conta enquanto o feixe está
 * aberto (o aparelho não grava depois), então o desfecho é o mesmo em todo aparelho que leu o mesmo livro.
 */
export function faseDisco(k: number, tRel: number, livro: unknown, H: number): FaseDisco {
  const t0 = ondaDisco(k);
  if (tRel < t0) return 'longe';
  if (somaLivro(livro) >= H) return 'derrubado';
  return tRel < t0 + FEIXE_MS ? 'feixe' : 'levou';
}

/** Altura do NPC no feixe (0 a 1): sobe em linha reta durante os 8 s. */
export function subidaFeixe(k: number, tRel: number): number {
  const u = (tRel - ondaDisco(k)) / FEIXE_MS;
  return u <= 0 ? 0 : u >= 1 ? 1 : u * u;
}

/** Onde o disco grande paira: um círculo lento sobre o salão (período de 20 s). */
export function posGrande(tRel: number): { x: number; y: number } {
  const a = ((tRel - GRANDE_EM) / 20_000) * Math.PI * 2;
  return { x: 10 + Math.cos(a) * 3.2, y: 5 + Math.sin(a) * 2 };
}

/**
 * Raio de varredura do disco grande em `tRel`: a cada 8 s uma linha (horizontal ou vertical, sorteada) avisa por
 * 1,2 s e queima por 0,4 s. `null` = nada agora.
 */
export function varredura(semente: number, tRel: number): { eixo: 'x' | 'y'; v: number; fase: 'aviso' | 'ativo' } | null {
  if (tRel < GRANDE_EM || tRel >= INVASAO_MS) return null;
  const i = Math.floor((tRel - GRANDE_EM) / VARRE_MS);
  const u = tRel - GRANDE_EM - i * VARRE_MS;
  if (u >= VARRE_AVISO + VARRE_ATIVO) return null;
  const r = rng(hashTexto(`varre|${semente}|${i}`));
  const eixo = r() < 0.5 ? 'x' : 'y';
  const v = eixo === 'x' ? 1.5 + Math.floor(r() * 19) : 1.5 + Math.floor(r() * 8);
  return { eixo, v, fase: u < VARRE_AVISO ? 'aviso' : 'ativo' };
}

/** O ponto (x, y) está na linha do raio? Meia faixa de 0,55 ladrilho. */
export function naLinha(l: { eixo: 'x' | 'y'; v: number }, x: number, y: number): boolean {
  return Math.abs((l.eixo === 'x' ? x : y) - l.v) < 0.55;
}

/** Quantos NPCs podem ser levados sem perder: 40% dos jogadores, no mínimo 1. */
export function cotaLevados(n: number): number {
  return Math.max(1, Math.ceil(Math.max(1, Math.min(5, n)) * 0.4));
}

export type Desfecho = 'vitoria' | 'empate' | 'derrota';

export function desfecho(levados: number, cota: number, grandeDerrubado: boolean): Desfecho {
  const dentro = levados <= cota;
  if (grandeDerrubado && dentro) return 'vitoria';
  if (!grandeDerrubado && !dentro) return 'derrota';
  return 'empate';
}

/** Gorjeta do final pacífico (por cabeça, igual para qualquer número de jogadores). */
export const PREMIO_PACIFICO = 15;

/**
 * Prêmio por cabeça da invasão (dividido entre os jogadores, com piso). Sempre vitória > pacífico > empate > derrota:
 * matar o visitante paga mais que deixá-lo em paz só se der certo.
 */
export function premioInvasao(d: Desfecho, n: number): number {
  const k = Math.max(1, Math.min(5, Math.floor(n) || 1));
  if (d === 'vitoria') return Math.max(PREMIO_PACIFICO + 5, Math.round(60 / k));
  if (d === 'empate') return Math.max(8, Math.min(PREMIO_PACIFICO - 1, Math.round(30 / k)));
  return Math.max(4, Math.min(7, Math.round(15 / k)));
}

/** Vidas da invasão escaladas pelos jogadores da abertura. */
export function vidasInvasao(n: number): { alien: number; disco: number; grande: number } {
  return { alien: vidaEscalada(ALIEN_VIDA, n), disco: vidaEscalada(DISCO_VIDA, n), grande: vidaEscalada(GRANDE_VIDA, n) };
}

/** Troféu de cada final ("" = empate não dá troféu). */
export const TROFEU_FINAL: Record<'pacifico' | Desfecho, string> = {
  pacifico: 'gorjeta',
  vitoria: 'antena',
  empate: '',
  derrota: 'sumiuze',
};
