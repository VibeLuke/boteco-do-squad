/**
 * O gesto do taco na sinuca (sem barra): mira com o ponteiro, clica e segura para travar a mira e arrasta PARA BAIXO
 * na tela para carregar a força (pedido do dono, 26/11); arrastar de lado ajusta a mira fino; soltar taca. A mesa é
 * desenhada sem girar, então "para baixo" na tela é +y da mesa. Funções puras, em metros da mesa.
 */
import { R, type Mesa } from './bilhar';

/** Puxada (em metros da mesa) que dá força máxima. */
export const PUXADA_MAX = 0.55;
/** Arrasto de lado mexe a mira com esta fração da sensibilidade (ajuste fino). */
export const AJUSTE_FINO = 0.3;
/** Força menor que isso ao soltar é desistência. */
export const FORCA_MIN = 0.04;

export interface Vetor {
  x: number;
  y: number;
}

/** Direção unitária da branca até o ponto (ou a de antes, se o ponto está em cima da branca). */
export function mirar(branca: Vetor, p: Vetor, antes: Vetor = { x: 1, y: 0 }): Vetor {
  const dx = p.x - branca.x;
  const dy = p.y - branca.y;
  const n = Math.hypot(dx, dy);
  return n > 1e-3 ? { x: dx / n, y: dy / n } : antes;
}

/**
 * Enquanto segura: `mira0` é a mira travada no clique, `p0` onde clicou e `p` onde o ponteiro está.
 * Arrastar para baixo dá força (qualquer que seja a mira); para cima não; de lado gira a mira devagar.
 */
export function puxada(mira0: Vetor, p0: Vetor, p: Vetor): { dx: number; dy: number; forca: number } {
  const baixo = p.y - p0.y;
  const lado = p.x - p0.x;
  const forca = Math.max(0, Math.min(1, baixo / PUXADA_MAX));
  const giro = lado * AJUSTE_FINO;
  const c = Math.cos(giro);
  const s = Math.sin(giro);
  return { dx: mira0.x * c - mira0.y * s, dy: mira0.x * s + mira0.y * c, forca };
}

/**
 * Bola fantasma: onde a branca encosta na primeira bola seguindo a mira (só bolas, sem tabela).
 * Devolve o centro da branca no choque e a bola atingida, ou null se não acerta nenhuma.
 */
export function bolaFantasma(m: Mesa, branca: Vetor, d: Vetor): { x: number; y: number; n: number } | null {
  let melhor: { t: number; n: number } | null = null;
  const r2 = (2 * R) ** 2;
  for (const b of m.bolas) {
    if (b.n === 0 || b.dentro) continue;
    const ox = branca.x - b.x;
    const oy = branca.y - b.y;
    const meio = ox * d.x + oy * d.y;
    const c = ox * ox + oy * oy - r2;
    const disc = meio * meio - c;
    if (disc < 0) continue;
    const t = -meio - Math.sqrt(disc);
    if (t > 1e-4 && (!melhor || t < melhor.t)) melhor = { t, n: b.n };
  }
  return melhor ? { x: branca.x + d.x * melhor.t, y: branca.y + d.y * melhor.t, n: melhor.n } : null;
}
