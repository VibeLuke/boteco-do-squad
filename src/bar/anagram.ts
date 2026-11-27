/**
 * Anagrama da Saideira (cômodo da Jukebox): os mesmos 5 anagramas para os 5 amigos, um conjunto por dia, com a dica
 * do pacote. As palavras têm 5, 6, 7, 8 e 9 ou 10 letras e valem 40, 60, 80, 100 e 120 pontos; cada letra revelada
 * custa 20 daquela palavra (nunca fica negativo).
 *
 *   bar/ana/{jogador}/{0..4} = { r: letras reveladas, ok: acertou, t }   (um por palavra, refeito a cada dia)
 *   placar: scores/{jogador}/ANA-{dia} = soma das palavras acertadas
 *
 * A letra revelada é gravada antes de aparecer (fechar a aba não devolve a dica). Depois do acerto a palavra fica
 * travada. Nada tem chave por dia: quem lê ignora o que é de antes das 6 h.
 * A lista congelada (src/data/anagramas.json) é carregada só quando alguém abre a jukebox.
 */
import { PLAYERS, isPlayerId, type PlayerId } from '../arena/sprites';
import { dayKey, startOfDay } from './day';
import { normalizeGuess } from './daily';

export const ANA_WORDS = 5;
export const ANA_POINTS = [40, 60, 80, 100, 120] as const;
export const REVEAL_COST = 20;
/** Teto de letras reveladas que a regra aceita (a palavra mais longa tem 10). */
export const MAX_REVEAL = 9;

export interface AnaData {
  start: number;
  themes: string[];
  days: [string, string, number][][];
}

export interface AnaWord {
  i: number;
  w: string;
  clue: string;
  theme: string;
  /** Letras embaralhadas (sempre diferente da palavra). */
  scrambled: string;
  points: number;
}

let cache: AnaData | null = null;
/** Carrega a lista congelada (uma vez por sessão). */
export async function loadAnagrams(): Promise<AnaData> {
  if (!cache) cache = (await import('../data/anagramas.json')).default as AnaData;
  return cache;
}

/** Semente estável a partir do dia e da posição (mesmo embaralhado em todo aparelho). */
function rngFor(day: number, i: number) {
  let a = (day * 2654435761 + i * 40503 + 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Embaralha as letras; se sair igual à palavra (ou quase tudo no lugar), tenta de novo e no fim gira uma casa. */
export function scramble(word: string, day: number, i: number): string {
  const rand = rngFor(day, i);
  let best = word;
  let bestSame = word.length;
  for (let tries = 0; tries < 12; tries++) {
    const a = word.split('');
    for (let k = a.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [a[k], a[j]] = [a[j], a[k]];
    }
    const s = a.join('');
    const same = s.split('').filter((c, k) => c === word[k]).length;
    if (s !== word && same < bestSame) {
      best = s;
      bestSame = same;
      if (same <= Math.floor(word.length / 4)) break;
    }
  }
  return best === word ? word.slice(1) + word[0] : best;
}

/** Os 5 anagramas do dia `day` (posição dia − dia inicial na lista congelada). */
export function setOfDay(data: AnaData, day: string | number): AnaWord[] {
  const d = Number(day);
  const n = data.days.length;
  const set = data.days[(((d - data.start) % n) + n) % n];
  return set.map(([w, clue, ti], i) => ({ i, w, clue, theme: data.themes[ti] ?? '', scrambled: scramble(w, d, i), points: ANA_POINTS[i] }));
}

export const anaScoreKey = (day: string) => `ANA-${day}`;

export interface AnaEntry {
  r: number;
  ok: boolean;
  t: number;
}
export type AnaRecord = (AnaEntry | undefined)[];

/** Registros de hoje de cada um, por palavra (os de antes das 6 h são ignorados). */
export function sanitizeAna(raw: unknown, now: number): Partial<Record<PlayerId, AnaRecord>> {
  const out: Partial<Record<PlayerId, AnaRecord>> = {};
  if (!raw || typeof raw !== 'object') return out;
  const sod = startOfDay(now);
  for (const [pid, words] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPlayerId(pid) || !words || typeof words !== 'object') continue;
    const rec: AnaRecord = Array.from({ length: ANA_WORDS }, () => undefined);
    let any = false;
    // O banco devolve lista ([..]) quando as chaves são 0..4 seguidas; objeto quando faltam algumas.
    for (const [k, v] of Object.entries(words as Record<string, unknown>)) {
      const i = Number(k);
      const e = v as { r?: unknown; ok?: unknown; t?: unknown } | null;
      if (!Number.isInteger(i) || i < 0 || i >= ANA_WORDS || !e) continue;
      if (typeof e.r !== 'number' || !Number.isInteger(e.r) || e.r < 0 || e.r > MAX_REVEAL) continue;
      if (typeof e.ok !== 'boolean' || typeof e.t !== 'number' || e.t < sod) continue;
      rec[i] = { r: e.r, ok: e.ok, t: e.t };
      any = true;
    }
    if (any) out[pid] = rec;
  }
  return out;
}

/** Pontos de uma palavra acertada com `r` letras reveladas. */
export const wordPoints = (i: number, r: number) => Math.max(0, ANA_POINTS[i] - REVEAL_COST * r);

/** Pontos do dia: soma das palavras acertadas. */
export function anaScore(rec: AnaRecord | undefined): number {
  if (!rec) return 0;
  let s = 0;
  rec.forEach((e, i) => {
    if (e?.ok) s += wordPoints(i, e.r);
  });
  return s;
}

export const solvedCount = (rec: AnaRecord | undefined) => (rec ?? []).filter((e) => e?.ok).length;

/** Dá para revelar mais uma letra? (ainda não acertou e sobra pelo menos 1 letra escondida). */
export function canReveal(rec: AnaRecord | undefined, word: AnaWord): boolean {
  const e = rec?.[word.i];
  const r = e?.r ?? 0;
  return !e?.ok && r < word.w.length - 1 && r < MAX_REVEAL;
}

/** O chute acerta a palavra? (sem acento, maiúsculas). */
export const isRight = (guess: string, word: AnaWord) => normalizeGuess(guess) === word.w;

/**
 * Letras que ainda sobram para montar a palavra: o embaralhado sem as reveladas (uma de cada). As reveladas são as
 * primeiras `r` letras da palavra, na ordem.
 */
export function remainingTiles(word: AnaWord, r: number): string[] {
  const left = word.scrambled.split('');
  for (const c of word.w.slice(0, r)) {
    const k = left.indexOf(c);
    if (k >= 0) left.splice(k, 1);
  }
  return left;
}

/** Os 5 na ordem do painel: mais pontos primeiro; empate por quem acertou mais. */
export function anaOrder(all: Partial<Record<PlayerId, AnaRecord>>): PlayerId[] {
  return PLAYERS.map((p, order) => ({ id: p.id, s: anaScore(all[p.id]), n: solvedCount(all[p.id]), order }))
    .sort((a, b) => b.s - a.s || b.n - a.n || a.order - b.order)
    .map((x) => x.id);
}

export { dayKey };
