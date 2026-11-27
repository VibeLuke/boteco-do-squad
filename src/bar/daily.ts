/**
 * Palavra do Dia (Canto da lousa): a mesma palavra para os 5, uma por dia, com a dica do pacote.
 * 6 chutes; cada letra volta V (lugar certo), A (existe em outro lugar) ou X (não existe).
 *
 *   bar/dia/{jogador} = { g: "VAXXV|VVVVV", n: chutes, ok: acertou, t }  (um registro por pessoa, refeito a cada dia)
 *   bar/sino          = { p: quem acertou primeiro, t }                   (o primeiro do dia leva o sino)
 *   placar: scores/{jogador}/DIA-{dia} = 300, 250, 200, 150, 100 ou 50 pelo chute, +100 com o sino.
 *
 * Só as cores vão para o banco (os amigos veem o seu progresso sem ver as letras). A tentativa é gravada antes
 * de aparecer na tela: fechar a aba não devolve o chute.
 */
import LIST from '../data/palavras-do-dia.json' with { type: 'json' };
import { PLAYERS, isPlayerId, type PlayerId } from '../arena/sprites';
import { dayKey, startOfDay } from './day';

export const MAX_TRIES = 6;
export const POINTS = [300, 250, 200, 150, 100, 50] as const;
export const SINO_BONUS = 100;

export interface DailyWord {
  day: string;
  w: string;
  clue: string;
  theme: string;
}

const WORDS = (LIST as { start: number; words: { w: string; c: string; t: string }[] }).words;
const START = (LIST as { start: number }).start;

/** Palavra do dia `day` (posição dia − dia inicial na lista congelada). */
export function wordOfDay(day: string | number): DailyWord {
  const d = Number(day);
  const i = (((d - START) % WORDS.length) + WORDS.length) % WORDS.length;
  const e = WORDS[i];
  return { day: String(d), w: e.w, clue: e.c, theme: e.t };
}

export const scoreKey = (day: string) => `DIA-${day}`;

/** Só letras A–Z, sem acento, em maiúscula. */
export function normalizeGuess(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

/** Cores do chute: V no lugar certo; A existe em outro lugar (conta repetidas); X não existe. */
export function grade(guess: string, answer: string): string {
  const out = Array<string>(answer.length).fill('X');
  const left: Record<string, number> = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) out[i] = 'V';
    else left[answer[i]] = (left[answer[i]] ?? 0) + 1;
  }
  for (let i = 0; i < answer.length; i++) {
    if (out[i] === 'V') continue;
    const c = guess[i];
    if (left[c]) {
      out[i] = 'A';
      left[c]--;
    }
  }
  return out.join('');
}

export const solvedPattern = (p: string) => /^V+$/.test(p);

export interface DiaEntry {
  /** Cores de cada chute, em ordem. */
  g: string[];
  n: number;
  ok: boolean;
  t: number;
}

/** Registros de hoje de cada um (os de dias anteriores são ignorados). */
export function sanitizeDia(raw: unknown, now: number): Partial<Record<PlayerId, DiaEntry>> {
  const out: Partial<Record<PlayerId, DiaEntry>> = {};
  if (!raw || typeof raw !== 'object') return out;
  const sod = startOfDay(now);
  for (const [pid, v] of Object.entries(raw as Record<string, unknown>)) {
    const e = v as { g?: unknown; n?: unknown; ok?: unknown; t?: unknown } | null;
    if (!isPlayerId(pid) || !e || typeof e.g !== 'string' || typeof e.t !== 'number' || e.t < sod) continue;
    const g = e.g.split('|').filter((x) => /^[VAX]{5,7}$/.test(x)).slice(0, MAX_TRIES);
    if (!g.length) continue;
    out[pid] = { g, n: g.length, ok: solvedPattern(g[g.length - 1]), t: e.t };
  }
  return out;
}

/** Quem bateu o sino hoje (ou ninguém). */
export function sinoToday(raw: unknown, now: number): { p: PlayerId; t: number } | null {
  const e = raw as { p?: unknown; t?: unknown } | null;
  if (!e || !isPlayerId(e.p) || typeof e.t !== 'number' || e.t < startOfDay(now)) return null;
  return { p: e.p, t: e.t };
}

/** Pontos do dia: pelo número do chute do acerto, mais o sino. */
export function dailyScore(entry: DiaEntry | undefined, rangBell: boolean): number {
  if (!entry || !entry.ok) return 0;
  return POINTS[entry.n - 1] + (rangBell ? SINO_BONUS : 0);
}

/** Pode chutar? (ainda não acertou e tem chute sobrando). */
export function canGuess(entry: DiaEntry | undefined): boolean {
  return !entry || (!entry.ok && entry.n < MAX_TRIES);
}

/** Gravação de um chute: o registro inteiro novo (o servidor confere que só cresceu 1). */
export function nextEntry(entry: DiaEntry | undefined, pattern: string): { g: string; n: number; ok: boolean } {
  const g = [...(entry?.g ?? []), pattern];
  return { g: g.join('|'), n: g.length, ok: solvedPattern(pattern) };
}

/** Os 5 na ordem da lousa: quem acertou com menos chutes primeiro. */
export function boardOrder(dia: Partial<Record<PlayerId, DiaEntry>>): PlayerId[] {
  const rank = (id: PlayerId) => {
    const e = dia[id];
    if (!e) return 99;
    return e.ok ? e.n : 10 + e.n;
  };
  return PLAYERS.map((p) => p.id).sort((a, b) => rank(a) - rank(b));
}

export { dayKey, startOfDay };
