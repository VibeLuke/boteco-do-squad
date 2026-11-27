/**
 * Animação de cada item na mão (Fatia 5, lote A): o golpe com item deixa de ser o soco de sempre.
 *
 * O item gira em volta da mão (o pé do desenho do item é o cabo). Ângulo 0 = item em pé; positivo = para a frente
 * (olhando para a direita; a tela espelha para a esquerda). Quadros-chave em tempo normalizado `u`: de −1 (começo da
 * preparação) a 0 (o contato, quando o dano entra) e de 0 a 1 (follow-through e volta ao descanso).
 * Função pura do tempo do golpe: os amigos veem o mesmo movimento na tela deles.
 */
import type { Arma } from './mapa';

/** [u, ângulo em graus, dx px, dy px, escala do item] */
export type Chave = readonly [number, number, number, number, number?];

export type Material = 'vidro' | 'madeira' | 'metal' | 'plastico' | 'terra' | 'gosma' | 'lixo' | 'tijolo' | 'agua' | 'po' | 'carne' | 'brilho';

export interface Mov {
  chaves: readonly Chave[];
  /** Cor do arco de luz que o item deixa (null = sem arco). */
  rastro: string | null;
  /** Estocada: linhas de velocidade em vez de arco. */
  estocada?: boolean;
  /** Imagem fantasma do item (katana). */
  fantasma?: boolean;
  /** Treme na mão (px) o tempo todo do golpe (serra). */
  vibra?: number;
  /** Recuo do corpo no contato (px, extintor). */
  recuo?: number;
  material: Material;
  /** Onomatopeia no impacto. */
  som: string;
  /** Tranco de tela no impacto (0 a 1). */
  tranco: number;
}

const M = (chaves: Chave[], material: Material, som: string, tranco: number, extra: Partial<Mov> = {}): Mov => ({
  chaves,
  rastro: null,
  material,
  som,
  tranco,
  ...extra,
});

/** Cada item com o seu movimento. */
export const MOVIMENTO: Record<Arma, Mov> = {
  // Fatia 12: o pano estala como toalha, prego e fita espetam/colam, a raquete abana, as receitas herdam o jeito da
  // arma de base, cada uma com um toque próprio (molotov por baixo, taco com prego em arco, espuma mais baixa, caco em gancho).
  pano: M([[-1, 40, 0, 0], [-0.5, -60, -3, -2], [0, 130, 4, 2, 1.2], [0.25, 150, 4, 3], [1, 40, 0, 0]], 'agua', 'TLEP', 0.1, { rastro: '#c0cbdc' }),
  prego: M([[-1, 85, 0, 0], [-0.5, 85, -3, 0], [0, 85, 7, 0], [0.3, 85, 5, 0], [1, 85, 0, 0]], 'metal', 'TIC', 0.1, { estocada: true }),
  fita: M([[-1, 0, 0, 0], [-0.5, 0, -3, 0], [0, 0, 6, 0], [0.3, 0, 5, 0], [1, 0, 0, 0]], 'plastico', 'SCRIT', 0.08, { estocada: true }),
  raquete: M([[-1, 20, 0, 0], [-0.5, -90, -2, -4], [0, 90, 3, 2], [0.3, 105, 3, 3], [1, 20, 0, 0]], 'brilho', 'BZZT', 0.3, { rastro: '#2ce8f5' }),
  molotov: M([[-1, 25, 0, 0], [-0.5, -60, -3, 2], [0, 110, 4, -2], [0.3, 120, 4, -1], [1, 25, 0, 0]], 'vidro', 'FUUSH', 0.4, { rastro: '#feae34' }),
  tacoprego: M([[-1, 30, 0, 0], [-0.5, -130, -2, -6], [0, 95, 3, 1], [0.3, 110, 3, 2], [1, 30, 0, 0]], 'madeira', 'TOC!', 0.4, { rastro: '#c0cbdc' }),
  espuma: M([[-1, 75, 0, 0], [-0.5, 75, 2, 0], [0, 70, 5, -1], [0.3, 65, -3, 0], [0.6, 70, -1, 0], [1, 75, 0, 0]], 'agua', 'FSSHH', 0.3, { recuo: 3 }),
  sococaco: M([[-1, 0, 0, 0], [-0.5, 10, -4, 0], [0, -10, 9, 0], [0.3, -5, 7, 0], [1, 0, 0, 0]], 'brilho', 'TSC!', 0.2, { estocada: true }),
  garrafa: M([[-1, 25, 0, 0], [-0.5, -100, -2, -4], [0, 95, 3, 2], [0.3, 110, 3, 3], [1, 25, 0, 0]], 'vidro', 'CRASH', 0.35, { rastro: '#c8f0c0' }),
  caco: M([[-1, 40, 0, 0], [-0.6, -20, -2, -1], [0, 120, 4, 3], [0.4, 135, 4, 4], [1, 40, 0, 0]], 'brilho', 'TSC', 0.15, { rastro: '#f4f4f4' }),
  banqueta: M([[-1, 20, 0, 0], [-0.55, -150, -1, -10], [-0.15, -160, -1, -11], [0, 80, 3, 0], [0.35, 100, 3, 2], [1, 20, 0, 0]], 'madeira', 'PÁ', 0.45, { rastro: '#e8b796' }),
  taco: M([[-1, 80, 0, 0], [-0.4, 85, -9, 0], [0, 88, 9, 0], [0.3, 88, 10, 0], [1, 80, 0, 0]], 'po', 'TOC', 0.2, { estocada: true, rastro: '#68aed4' }),
  cadeira: M([[-1, 30, 0, 0], [-0.5, -70, -4, -2], [0, 140, 2, 3, 0.85], [0.4, 165, 1, 4, 1.1], [0.6, 150, 1, 3, 1], [1, 30, 0, 0]], 'plastico', 'PLOFT', 0.4, { rastro: '#f4f4f4' }),
  cano: M([[-1, 20, 0, 0], [-0.5, -120, -2, -5], [0, 70, 3, 1], [0.25, 78, 3, 1], [1, 20, 0, 0]], 'metal', 'CLANG', 0.4, { rastro: '#c0cbdc' }),
  desentupidor: M([[-1, 75, 0, 0], [-0.5, 80, -5, -1], [0, 90, 8, 0, 0.7], [0.25, 90, 9, 0, 1.25], [0.5, 85, 2, 0, 1], [1, 75, 0, 0]], 'gosma', 'PLOP', 0.15, { estocada: true }),
  cadeirao: M([[-1, 15, 0, 0], [-0.6, -165, 0, -13], [-0.2, -170, 0, -14], [0, 85, 3, 1], [0.4, 105, 3, 3], [1, 15, 0, 0]], 'madeira', 'CRAC', 0.55, { rastro: '#e8b796' }),
  vaso: M([[-1, 0, 0, -2], [-0.5, 0, 0, -16], [-0.2, -20, 0, -17], [0, 150, 4, -2], [0.4, 170, 4, 0], [1, 0, 0, -2]], 'terra', 'CRASH', 0.4, { rastro: '#63c74d' }),
  engradado: M([[-1, 90, 0, -2], [-0.5, 90, -6, -2], [0, 95, 8, -5, 1.1], [0.4, 92, 9, -4], [1, 90, 0, -2]], 'madeira', 'TLEC', 0.35, { estocada: true }),
  lixeira: M([[-1, 30, 0, 0], [-0.5, 160, -2, 6], [0, -10, 3, -6], [0.35, -30, 2, -7], [1, 30, 0, 0]], 'lixo', 'BLÉM', 0.4, { rastro: '#8b9bb4' }),
  faca: M([[-1, 85, 0, 0], [-0.5, 85, -3, 0], [0, 85, 7, 0], [0.2, 85, -1, 0], [0.4, 85, 7, 1], [0.6, 85, -1, 0], [1, 85, 0, 0]], 'carne', 'TSC', 0.12, { estocada: true }),
  socoingles: M([[-1, 0, 0, 0], [-0.5, 0, -4, 0], [0, 0, 9, -1], [0.3, 0, 8, -1], [1, 0, 0, 0]], 'brilho', 'PÁ!', 0.25, { estocada: true }),
  machadinha: M([[-1, 20, 0, 0], [-0.5, -140, -2, -6], [0, 100, 3, 2], [0.15, 120, 3, 3], [0.5, 115, 3, 3], [1, 20, 0, 0]], 'madeira', 'TCHAC', 0.45, { rastro: '#c0cbdc' }),
  serra: M([[-1, 75, 0, 0], [-0.5, 70, -3, 0], [0, 85, 6, 0], [0.6, 82, 5, 0], [1, 75, 0, 0]], 'metal', 'VRRRR', 0.3, { vibra: 1.5, estocada: true }),
  frigideira: M([[-1, 30, 0, 0], [-0.5, -80, -6, -1], [0, 60, 6, 0, 0.6], [0.3, 75, 6, 0, 1.15], [0.5, 70, 5, 0, 1], [1, 30, 0, 0]], 'metal', 'TÓIN', 0.35, { rastro: '#94b0c2' }),
  bastao: M([[-1, 20, 0, 0], [-0.6, -110, -5, -4], [-0.2, -125, -6, -5], [0, 100, 4, 0], [0.4, 230, 0, -2], [0.7, 240, -1, -2], [1, 20, 0, 0]], 'madeira', 'PLAU!', 0.55, { rastro: '#f4f4f4' }),
  violao: M([[-1, 10, 0, 0], [-0.55, -150, -1, -11], [0, 95, 3, 1], [0.3, 105, 3, 2], [1, 10, 0, 0]], 'madeira', 'PLÉM', 0.45, { rastro: '#feae34' }),
  extintor: M([[-1, 80, 0, 0], [-0.5, 80, 2, 0], [0, 80, 4, 0], [0.2, 75, -4, 0], [0.6, 78, -2, 0], [1, 80, 0, 0]], 'po', 'PSSHH', 0.3, { recuo: 3 }),
  guardasol: M([[-1, 70, 0, -2], [-0.5, 78, -8, -2], [0, 88, 11, -1], [0.15, 95, 11, -1], [0.3, 82, 10, -1], [1, 70, 0, -2]], 'plastico', 'FLOP', 0.2, { estocada: true }),
  tijolo: M([[-1, 10, 0, 0], [-0.6, -60, -6, -3], [-0.2, -170, -7, -2], [0, 60, 6, -1], [0.4, 120, 4, 2], [1, 10, 0, 0]], 'tijolo', 'TUM', 0.45, { rastro: '#b86f50' }),
  espeto: M([[-1, 85, 0, 0], [-0.45, 85, -6, 0], [0, 88, 10, 0], [0.25, 85, 0, 0], [0.5, 88, 10, 0], [0.7, 86, 0, 0], [1, 85, 0, 0]], 'carne', 'TSC', 0.15, { estocada: true }),
  placa: M([[-1, 25, 0, 0], [-0.5, -90, -5, -2], [0, 120, 3, 1, 0.8], [0.3, 140, 3, 2], [1, 25, 0, 0]], 'plastico', 'PLANC', 0.35, { rastro: '#feae34' }),
  rodo: M([[-1, 120, 0, 2], [-0.5, 175, -7, 4], [0, 75, 7, 4], [0.4, 60, 8, 3], [1, 120, 0, 2]], 'agua', 'SPLASH', 0.25, { rastro: '#9ad0ff' }),
  katana: M([[-1, 30, 0, 0], [-0.7, -150, -3, -5], [0, 150, 5, 3], [0.15, 160, 5, 3], [0.6, 155, 4, 3], [1, 30, 0, 0]], 'brilho', 'SHING', 0.4, { rastro: '#ffffff', fantasma: true }),
  marreta: M([[-1, 10, 0, 0], [-0.5, -140, -3, -8], [-0.15, -175, -4, -12], [0, 100, 4, 3], [0.3, 105, 4, 4], [0.6, 95, 3, 3], [1, 10, 0, 0]], 'tijolo', 'BUUUM', 1, { rastro: '#feae34' }),
  rajada: M([[-1, 0, 0, 0], [1, 0, 0, 0]], 'brilho', '', 0),
  // Fatia 6: poderes não giram na mão (a carga e o efeito são desenhados à parte).
  tampinhas: M([[-1, 0, 0, 0], [1, 0, 0, 0]], 'brilho', '', 0),
  arroto: M([[-1, 0, 0, 0], [1, 0, 0, 0]], 'brilho', '', 0),
  furacao: M([[-1, 0, 0, 0], [1, 0, 0, 0]], 'brilho', '', 0),
  chope: M([[-1, 0, 0, 0], [1, 0, 0, 0]], 'brilho', '', 0),
  pagode: M([[-1, 0, 0, 0], [1, 0, 0, 0]], 'brilho', '', 0),
  raio: M([[-1, 0, 0, 0], [1, 0, 0, 0]], 'brilho', '', 0),
  torresmo: M([[-1, 0, 0, 0], [1, 0, 0, 0]], 'brilho', '', 0),
  garcom: M([[-1, 0, 0, 0], [1, 0, 0, 0]], 'brilho', '', 0),
  pinga: M([[-1, 0, 0, 0], [1, 0, 0, 0]], 'brilho', '', 0),
  ima: M([[-1, 0, 0, 0], [1, 0, 0, 0]], 'brilho', '', 0),
};

export interface PoseItem {
  ang: number;
  dx: number;
  dy: number;
  esc: number;
}

/** Golpe de quem está com o item: fase, fim da fase e os tempos do golpe. */
export interface EmGolpe {
  fase: 'nada' | 'antes' | 'depois';
  faseAte: number;
  golpe: { antecipa: number; recupera: number } | null;
}

/** Onde o golpe está em `t` (ms): −1..0 na preparação, 0..1 depois do contato; null fora de golpe. */
export function tempoGolpe(c: EmGolpe, t: number): number | null {
  const g = c.golpe;
  if (!g || c.fase === 'nada') return null;
  if (c.fase === 'antes') return Math.max(-1, Math.min(0, -(c.faseAte - t) / Math.max(1, g.antecipa))) + 0; // + 0: sem −0 no contato
  return Math.max(0, Math.min(1, 1 - (c.faseAte - t) / Math.max(1, g.recupera)));
}

/** O mesmo `u` de `ms` atrás (atravessa o contato: o arco de luz liga a ida com a volta). */
export function voltarNoGolpe(u: number, ms: number, g: { antecipa: number; recupera: number }): number {
  if (u > 0) {
    const r = u * g.recupera - ms;
    if (r >= 0) return r / g.recupera;
    return Math.max(-1, r / Math.max(1, g.antecipa));
  }
  return Math.max(-1, u - ms / Math.max(1, g.antecipa));
}

const suave = (x: number) => x * x * (3 - 2 * x);
const entra = (x: number) => x * x; // acelera até o contato
const sai = (x: number) => 1 - (1 - x) * (1 - x); // freia depois dele

/** Pose do item no `u` do golpe (null = descanso, a primeira chave). */
export function poseItem(arma: Arma, u: number | null): PoseItem {
  const k = MOVIMENTO[arma].chaves;
  const at = u ?? k[0][0];
  let i = 0;
  while (i < k.length - 2 && at > k[i + 1][0]) i++;
  const a = k[i];
  const b = k[i + 1];
  const span = b[0] - a[0] || 1;
  const x = Math.max(0, Math.min(1, (at - a[0]) / span));
  const e = b[0] === 0 ? entra(x) : a[0] === 0 ? sai(x) : suave(x);
  const lerp = (p: number, q: number) => p + (q - p) * e;
  return { ang: lerp(a[1], b[1]), dx: lerp(a[2], b[2]), dy: lerp(a[3], b[3]), esc: lerp(a[4] ?? 1, b[4] ?? 1) };
}

/** Assinatura do movimento (para provar que não há dois itens iguais): a pose em 9 pontos do golpe. */
export function assinatura(arma: Arma): number[] {
  const out: number[] = [];
  for (const u of [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1]) {
    const p = poseItem(arma, u);
    out.push(Math.round(p.ang), Math.round(p.dx), Math.round(p.dy), Math.round(p.esc * 10));
  }
  return out;
}

/** Cores e tamanho do que cada material solta no impacto. */
export const RESTO: Record<Material, { cores: readonly string[]; n: number; forca: number; tam: number }> = {
  vidro: { cores: ['#3e8948', '#63c74d', '#c8f0c0', '#feae34'], n: 14, forca: 1.4, tam: 1 },
  madeira: { cores: ['#8f563b', '#5c3620', '#e8b796'], n: 14, forca: 1.3, tam: 2 },
  metal: { cores: ['#fee761', '#feae34', '#ffffff', '#8a4a2a'], n: 12, forca: 1.8, tam: 1 },
  plastico: { cores: ['#f4f4f4', '#feae34', '#c0cbdc'], n: 10, forca: 1.2, tam: 2 },
  terra: { cores: ['#5c3620', '#8f563b', '#3e8948', '#63c74d', '#b86f50'], n: 18, forca: 1.2, tam: 2 },
  gosma: { cores: ['#6b7a3a', '#8a9a4a'], n: 8, forca: 0.9, tam: 1 },
  lixo: { cores: ['#f4f4f4', '#feae34', '#c0cbdc', '#3e8948', '#5c3620'], n: 12, forca: 1.4, tam: 2 },
  tijolo: { cores: ['#b86f50', '#8a4a2a', '#e8b796'], n: 16, forca: 1.4, tam: 2 },
  agua: { cores: ['#9ad0ff', '#f4f4f4', '#68aed4'], n: 14, forca: 1.2, tam: 1 },
  po: { cores: ['#f4f4f4', '#c0cbdc', '#68aed4'], n: 12, forca: 1, tam: 2 },
  carne: { cores: ['#a22633', '#e43b44', '#5c3620'], n: 6, forca: 1.1, tam: 1 },
  brilho: { cores: ['#ffffff', '#fee761', '#c0cbdc'], n: 8, forca: 1.6, tam: 1 },
};
