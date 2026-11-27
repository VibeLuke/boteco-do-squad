/**
 * Fatia 8: a sensação do golpe, em funções puras (iguais no Node e no navegador, sem `Math.random`).
 *
 * - Congelamento (hit-stop): o mundo inteiro para, atacante e alvo juntos. O golpe normal fica em no máximo 110 ms
 *   (pausa longa no celular parece travamento); a finalização (nocaute) guarda os seus 160 ms.
 * - Tremor de tela só no golpe pesado, crescendo com o peso do item (o congelamento original dele).
 * - Clarão branco de 2 quadros no alvo.
 * - Só desenho (o motor não muda): recuo do alvo de 1 a 3 px, achatar e esticar, três quedas no nocaute e as
 *   micro-ações de quem está parado. Tudo zera com o movimento reduzido.
 */

/** Teto do congelamento de um golpe normal (ms). */
export const HITSTOP_MAX = 110;
/** Congelamento da finalização (o golpe que derruba). */
export const HITSTOP_FINAL = 160;
/** Clarão branco no alvo: 2 quadros a 60 qps. */
export const FLASH_MS = 34;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Quanto o mundo congela num golpe (ms). */
export function hitstopDe(g: { hitstop: number }): number {
  return Math.max(0, Math.min(HITSTOP_MAX, g.hitstop));
}

/**
 * Quanto o golpe sacode a tela (soma no trauma, 0 a 1). Golpe leve não sacode; o pesado vai de 0,3 (garrafa,
 * empurrão) a 0,5 (marreta), pelo congelamento original do item, que já mede o peso dele.
 */
export function traumaDe(g: { hitstop: number; forte: boolean }): number {
  if (!g.forte) return 0;
  return 0.3 + 0.2 * clamp01((g.hitstop - 100) / 70);
}

/* ------------------------------------------------------------------ só desenho */

/** FNV-1a: o mesmo número para o mesmo nome em todo aparelho. */
export function hashTexto(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const RECUO_MS = 120;

/**
 * Recuo do alvo na tela (px inteiros), para longe de quem bateu: 1 px no golpe leve, 3 no pesado, saindo rápido e
 * voltando devagar. `dx, dy` = direção do golpe na tela (unitária). `idade` = ms desde o golpe.
 */
export function recuo(idade: number, forte: boolean, dx: number, dy: number, calmo = false): { x: number; y: number } {
  if (calmo || !(idade >= 0) || idade >= RECUO_MS) return { x: 0, y: 0 };
  const u = idade / RECUO_MS;
  const a = (forte ? 3 : 1) * (1 - u) * (1 - u);
  return { x: Math.round(dx * a) || 0, y: Math.round(dy * a * 0.5) || 0 };
}

export const ESTICA_MS = 150;

/**
 * Achatar e esticar o corpo de quem apanha: começa achatado (mais largo, mais baixo), passa por esticado e volta a
 * 1. `sx * sy` fica perto de 1 (o volume não muda).
 */
export function esticao(idade: number, forte: boolean, calmo = false): { sx: number; sy: number } {
  if (calmo || !(idade >= 0) || idade >= ESTICA_MS) return { sx: 1, sy: 1 };
  const u = idade / ESTICA_MS;
  const s = (forte ? 0.16 : 0.08) * (1 - u) * (1 - u) * Math.cos(u * Math.PI * 1.5);
  return { sx: 1 + s, sy: 1 / (1 + s) };
}

/** Tamanho em px inteiros de um sprite `w × h` achatado/esticado (nunca menor que 1). */
export function tamanhoEsticado(w: number, h: number, e: { sx: number; sy: number }): { w: number; h: number } {
  return { w: Math.max(1, Math.round(w * e.sx)), h: Math.max(1, Math.round(h * e.sy)) };
}

export const QUEDAS = ['costas', 'cara', 'joelhos'] as const;
export type Queda = (typeof QUEDAS)[number];
export const QUEDA_MS = 300;

/** Qual das três quedas cada um tem (fixa pelo nome: o mesmo boneco cai sempre do mesmo jeito em todo aparelho). */
export function quedaDe(id: string): Queda {
  return QUEDAS[hashTexto(id) % 3];
}

/**
 * Pose da queda no tempo (`idade` em ms desde o nocaute): ângulo em graus (de 30 em 30, como quadros de pixel art;
 * positivo = para a frente), quanto o corpo encolhe na altura (joelhos dobrando) e o quique no fim (px para cima).
 * `null` = a queda acabou (desenha deitado).
 */
export function poseQueda(v: Queda, idade: number, calmo = false): { ang: number; sy: number; quique: number } | null {
  if (calmo || !(idade >= 0) || idade >= QUEDA_MS) return null;
  const u = idade / QUEDA_MS;
  const passo30 = (k: number) => Math.min(90, Math.floor(k * 4) * 30);
  if (v === 'joelhos') {
    // Dobra os joelhos (até 60% da altura) e depois tomba para a frente.
    if (u < 0.45) return { ang: 0, sy: 1 - 0.4 * (u / 0.45), quique: 0 };
    const k = (u - 0.45) / 0.55;
    return { ang: passo30(k * k), sy: 0.6, quique: 0 };
  }
  // Costas e cara: tomba acelerando (k²) e quica 2 px no último quarto.
  const ang = passo30(Math.min(1, (u / 0.75) ** 2));
  const quique = u >= 0.75 ? Math.round(2 * Math.sin(((u - 0.75) / 0.25) * Math.PI)) : 0;
  return { ang: v === 'costas' && ang ? -ang : ang, sy: 1, quique };
}

/** Como fica deitado depois da queda: de costas olha para o outro lado; de joelhos acaba encolhido. */
export function deitadoDe(v: Queda): { pose: 'ko-flat' | 'ko-slump'; inverte: boolean } {
  if (v === 'joelhos') return { pose: 'ko-slump', inverte: false };
  return { pose: 'ko-flat', inverte: v === 'costas' };
}

/** Respiração de quem está parado: 0 ou 1 px para cima, num ritmo próprio de cada um. */
export function respiro(id: string, t: number, calmo = false): number {
  if (calmo) return 0;
  const h = hashTexto(id);
  const periodo = 1400 + (h % 600);
  const fase = (((t + (h >>> 10)) % periodo) + periodo) % periodo;
  return fase < periodo * 0.45 ? 1 : 0;
}

/** Olhadela para o lado: de tempos em tempos (6 a 11 s, cada um no seu), olha para trás por 0,7 s. */
export function olhadela(id: string, t: number, calmo = false): boolean {
  if (calmo) return false;
  const h = hashTexto(`olha:${id}`);
  const periodo = 6000 + (h % 5000);
  const fase = (((t + (h >>> 8)) % periodo) + periodo) % periodo;
  return fase < 700;
}

/* ------------------------------------------------------------------ gotas */

function hexRgb(cor: string): [number, number, number] {
  let h = cor.replace('#', '');
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [255, 0, 255];
}

const rgbHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

const rampas = new Map<string, readonly [string, string, string]>();

/**
 * Rampa dura de 3 tons tirada da cor da própria gota (o dente continua branco, a espuma continua espuma): claro
 * (40% para o branco), a cor, escuro (35% para o preto).
 */
export function rampaGota(cor: string): readonly [string, string, string] {
  let r = rampas.get(cor);
  if (r) return r;
  const [R, G, B] = hexRgb(cor);
  r = [rgbHex(R + (255 - R) * 0.4, G + (255 - G) * 0.4, B + (255 - B) * 0.4), cor, rgbHex(R * 0.65, G * 0.65, B * 0.65)];
  if (rampas.size < 256) rampas.set(cor, r);
  return r;
}

/** Qual tom da rampa pela idade da gota (ms): quente no estouro, a cor no voo, escura no fim. */
export function tomGota(idade: number): 0 | 1 | 2 {
  return idade < 60 ? 0 : idade < 280 ? 1 : 2;
}

/** Tamanho pela idade: 1 px maior no estouro, encolhe 1 px no fim do voo (a de 1 px fica com 1). */
export function tamGota(tam: number, idade: number): number {
  if (idade < 50) return tam + 1;
  if (idade > 420) return Math.max(1, tam - 1);
  return tam;
}
