/**
 * Fatia 9: luz e cor do bar, em funções puras (iguais no Node e no navegador).
 *
 * - Mapa de luz multiplicativo: a cor ambiente da hora (de Brasília) multiplica a cena; as luzes somam por cima dela
 *   no mesmo buffer, então perto do fogo, do neon e do poste a cena volta à cor cheia.
 * - Grading por evento (invasão verde, viajante sépia, apagão): um véu de cor com força de 0 a 1.
 * - Pontilhado Bayer 4×4 para sombra e fumaça (em vez de alfa liso).
 * - Orçamento: o desenho mede o p95 e desce sozinho de nível (sem brilho; luz em meia resolução e menos gotas) quando
 *   passa de 4 ms, e só volta quando fica abaixo de 2 ms (sem ficar pulando).
 * - Retângulo sujo: o chão de manchas reenvia só o pedaço que mudou.
 */

/** Matriz de Bayer 4×4 (limiar 0 a 15 na posição (x mod 4, y mod 4)). */
export const BAYER4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Quais das 16 casas da matriz acendem num nível de 0 a 1 (0 = nenhuma, 1 = todas). */
export function mascaraBayer(nivel: number): boolean[] {
  const n = Math.round(Math.max(0, Math.min(1, nivel)) * 16);
  return BAYER4.map((v) => v < n);
}

/** Hora em Brasília (0 a 24, com fração) de um instante em ms (UTC−3, sem horário de verão). */
export function horaBrasilia(ms: number): number {
  return ((((ms / 3_600_000 - 3) % 24) + 24) % 24);
}

const NOITE = [104, 112, 168] as const; // azul de rua à noite
const POENTE = [236, 180, 150] as const; // laranja-rosado do fim de tarde

const mistura = (a: readonly number[], b: readonly number[], k: number) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
const hex = (c: readonly number[]) => `#${c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;

/**
 * Cor que multiplica a cena na hora `h` (Brasília). `null` de dia (nada a fazer, nenhum custo). Poente das 17 às 19,
 * noite das 19 às 5, amanhecer das 5 às 7.
 */
export function ambienteDaHora(h: number): string | null {
  const BRANCO = [255, 255, 255];
  if (h >= 7 && h < 17) return null;
  if (h >= 17 && h < 18) return hex(mistura(BRANCO, POENTE, h - 17));
  if (h >= 18 && h < 19) return hex(mistura(POENTE, NOITE, h - 18));
  if (h >= 5 && h < 6) return hex(mistura(NOITE, POENTE, h - 5));
  if (h >= 6 && h < 7) return hex(mistura(POENTE, BRANCO, h - 6));
  return hex(NOITE);
}

export const GRADINGS = ['invasao', 'viajante', 'apagao'] as const;
export type Grading = (typeof GRADINGS)[number];

export type ModoVeu = 'multiply' | 'source-over' | 'soft-light';

// Invasão em luz suave (tinge de verde sem apagar a cena); viajante multiplica sépia; apagão cobre de breu.
const VEUS: Record<Grading, { cor: string; a: number; modo: ModoVeu }> = {
  invasao: { cor: '#2cff6a', a: 0.6, modo: 'soft-light' },
  viajante: { cor: '#d8b48a', a: 0.6, modo: 'multiply' },
  apagao: { cor: '#0b0a16', a: 0.72, modo: 'source-over' },
};

/** Véu de cor de um evento com força `k` (0 a 1); `null` = nada a desenhar. */
export function grading(ev: Grading | null, k: number): { cor: string; a: number; modo: ModoVeu } | null {
  if (!ev || !(k > 0)) return null;
  const v = VEUS[ev];
  return { cor: v.cor, a: +(v.a * Math.min(1, k)).toFixed(3), modo: v.modo };
}

/** Raio de luz arredondado (de 4 em 4 px) para o sprite de luz pronto servir a muitas luzes. */
export function chaveLuz(cor: string, r: number): string {
  return `${cor}|${Math.max(4, Math.round(r / 4) * 4)}`;
}

/** Nível de qualidade: 0 = tudo; 1 = sem brilho (bloom); 2 = sem brilho, luz em meia resolução e metade das gotas. */
export type Nivel = 0 | 1 | 2;
export const ORCAMENTO_MS = 4;
export const FOLGA_MS = 2;
/** Quadros medidos antes de decidir (o medidor guarda 120). */
export const AMOSTRA_MIN = 60;

/** Desce um nível quando o p95 do desenho passa do orçamento; sobe um quando fica abaixo da folga. */
export function nivelQualidade(atual: Nivel, p95: number, n: number): Nivel {
  if (n < AMOSTRA_MIN) return atual;
  if (p95 > ORCAMENTO_MS && atual < 2) return (atual + 1) as Nivel;
  if (p95 < FOLGA_MS && atual > 0) return (atual - 1) as Nivel;
  return atual;
}

/** Retângulo (inclusivo em x0, y0; exclusivo em x1, y1). */
export interface Ret {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Junta um pixel (ou bloco `tam × tam`) ao retângulo sujo; `null` = nada sujo ainda. */
export function sujar(r: Ret | null, x: number, y: number, tam = 1): Ret {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  if (!r) return { x0, y0, x1: x0 + tam, y1: y0 + tam };
  return { x0: Math.min(r.x0, x0), y0: Math.min(r.y0, y0), x1: Math.max(r.x1, x0 + tam), y1: Math.max(r.y1, y0 + tam) };
}

/** Recorta o retângulo à área `w × h`; `null` se ficou vazio. */
export function recortar(r: Ret | null, w: number, h: number): Ret | null {
  if (!r) return null;
  const c = { x0: Math.max(0, r.x0), y0: Math.max(0, r.y0), x1: Math.min(w, r.x1), y1: Math.min(h, r.y1) };
  return c.x1 > c.x0 && c.y1 > c.y0 ? c : null;
}
