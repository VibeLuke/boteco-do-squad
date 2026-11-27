/**
 * Quiz geek da mesa de sinuca: as mesmas 10 perguntas para os 5, um conjunto por dia, tiradas das dicas dos pacotes
 * (a dica e 4 palavras para escolher). 15 s por pergunta. Acerto vale 20, mais até 10 pela rapidez (até 300 no dia).
 *
 *   bar/quiz/{jogador}/{0..9} = { o: hora em que abriu, k: opção escolhida (−1 = ainda não respondeu), a: hora da resposta }
 *   placar: scores/{jogador}/QUIZ-{dia}
 *
 * O tempo é do servidor: abrir grava `o`, responder grava `a`, e a regra só aceita cada um uma vez por dia (não dá para
 * reabrir a pergunta e zerar o relógio, nem trocar a resposta). Quem lê confere o acerto pela lista congelada e conta
 * a rapidez por a − o. Nada tem chave por dia: o que é de antes das 6 h é ignorado.
 */
import { PLAYERS, isPlayerId, type PlayerId } from '../arena/sprites';
import { dayKey, startOfDay } from './day';

export const QUIZ_N = 10;
export const ANSWER_MS = 15_000;
/** Folga de rede: resposta que chega até 1,5 s depois do fim ainda vale (sem bônus de rapidez). */
export const GRACE_MS = 1_500;
export const RIGHT_POINTS = 20;
export const SPEED_MAX = 10;
/** Quanto tempo o "ACERTOU/ERROU" fica no ar para a torcida. */
export const FLASH_MS = 2_500;

export interface QuizData {
  start: number;
  themes: string[];
  days: [string, string, number, string[]][][];
}

export interface Question {
  i: number;
  w: string;
  clue: string;
  theme: string;
  options: string[];
  right: number;
}

let cache: QuizData | null = null;
/** Carrega a lista congelada (uma vez por sessão, só quando alguém abre a mesa). */
export async function loadQuiz(): Promise<QuizData> {
  if (!cache) cache = (await import('../data/quiz.json')).default as QuizData;
  return cache;
}

function rngFor(day: number, i: number) {
  let a = (day * 2246822519 + i * 3266489917 + 0x85ebca6b) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** As 10 perguntas do dia, com as opções embaralhadas igual em todo aparelho. */
export function questionsOfDay(data: QuizData, day: string | number): Question[] {
  const d = Number(day);
  const n = data.days.length;
  const set = data.days[(((d - data.start) % n) + n) % n];
  return set.map(([w, clue, ti, wrong], i) => {
    const rand = rngFor(d, i);
    const options = [w, ...wrong];
    for (let k = options.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [options[k], options[j]] = [options[j], options[k]];
    }
    return { i, w, clue, theme: data.themes[ti] ?? '', options, right: options.indexOf(w) };
  });
}

export const quizScoreKey = (day: string) => `QUIZ-${day}`;

export interface QuizEntry {
  /** Hora (do servidor) em que a pergunta abriu. */
  o: number;
  /** Opção escolhida; −1 = ainda não respondeu. */
  k: number;
  /** Hora (do servidor) da resposta; 0 enquanto não respondeu. */
  a: number;
}
export type QuizRecord = (QuizEntry | undefined)[];

/** Registros de hoje de cada um, por pergunta (os de antes das 6 h são ignorados). */
export function sanitizeQuiz(raw: unknown, now: number): Partial<Record<PlayerId, QuizRecord>> {
  const out: Partial<Record<PlayerId, QuizRecord>> = {};
  if (!raw || typeof raw !== 'object') return out;
  const sod = startOfDay(now);
  for (const [pid, qs] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPlayerId(pid) || !qs || typeof qs !== 'object') continue;
    const rec: QuizRecord = Array.from({ length: QUIZ_N }, () => undefined);
    let any = false;
    for (const [key, v] of Object.entries(qs as Record<string, unknown>)) {
      const i = Number(key);
      const e = v as { o?: unknown; k?: unknown; a?: unknown } | null;
      if (!Number.isInteger(i) || i < 0 || i >= QUIZ_N || !e) continue;
      if (typeof e.o !== 'number' || e.o < sod || typeof e.a !== 'number') continue;
      if (typeof e.k !== 'number' || !Number.isInteger(e.k) || e.k < -1 || e.k > 3) continue;
      if (e.k >= 0 && e.a < e.o) continue;
      rec[i] = { o: e.o, k: e.k, a: e.a };
      any = true;
    }
    if (any) out[pid] = rec;
  }
  return out;
}

export type QState = 'fechada' | 'aberta' | 'respondida' | 'tempo';

/** Como está a pergunta agora: nunca aberta, aberta com o relógio correndo, respondida ou com o tempo esgotado. */
export function stateOf(e: QuizEntry | undefined, now: number): QState {
  if (!e) return 'fechada';
  if (e.k >= 0) return 'respondida';
  return now - e.o <= ANSWER_MS + GRACE_MS ? 'aberta' : 'tempo';
}

/** Pontos de uma resposta: 20 pelo acerto + até 10 pela rapidez (no prazo; depois do prazo não vale). */
export function answerPoints(q: Question, e: QuizEntry | undefined): number {
  if (!e || e.k < 0 || e.k !== q.right) return 0;
  const ms = e.a - e.o;
  if (ms < 0 || ms > ANSWER_MS + GRACE_MS) return 0;
  return RIGHT_POINTS + Math.round(SPEED_MAX * Math.max(0, 1 - ms / ANSWER_MS));
}

export function quizScore(rec: QuizRecord | undefined, qs: Question[]): number {
  if (!rec) return 0;
  return qs.reduce((s, q) => s + answerPoints(q, rec[q.i]), 0);
}

export const rightCount = (rec: QuizRecord | undefined, qs: Question[]) => qs.filter((q) => answerPoints(q, rec?.[q.i]) > 0).length;

/** Pergunta da vez: a aberta com tempo (volta para ela) ou a primeira ainda fechada. null = terminou. */
export function currentQuestion(rec: QuizRecord | undefined, now: number): number | null {
  for (let i = 0; i < QUIZ_N; i++) {
    const s = stateOf(rec?.[i], now);
    if (s === 'aberta' || s === 'fechada') return i;
  }
  return null;
}

export interface Live {
  p: PlayerId;
  /** Pergunta (0..9) que está no ar ou que acabou de ser respondida. */
  i: number;
  phase: 'aberta' | 'acertou' | 'errou' | 'tempo';
  /** ms que faltam (aberta) ou desde o fim (as outras). */
  ms: number;
  done: number;
  points: number;
}

/** Quem está jogando agora (para a torcida): a atividade mais recente dos últimos segundos. */
export function liveOf(all: Partial<Record<PlayerId, QuizRecord>>, qs: Question[], now: number): Live | null {
  let best: Live | null = null;
  let bestT = -Infinity;
  for (const p of PLAYERS) {
    const rec = all[p.id];
    if (!rec) continue;
    const done = rec.filter((e) => e && stateOf(e, now) !== 'aberta').length;
    const points = quizScore(rec, qs);
    rec.forEach((e, i) => {
      if (!e) return;
      const s = stateOf(e, now);
      let t: number;
      let live: Live | null = null;
      if (s === 'aberta') {
        t = e.o;
        live = { p: p.id, i, phase: 'aberta', ms: Math.max(0, e.o + ANSWER_MS - now), done, points };
      } else if (s === 'respondida') {
        t = e.a;
        if (now - e.a < FLASH_MS) live = { p: p.id, i, phase: answerPoints(qs[i], e) > 0 ? 'acertou' : 'errou', ms: now - e.a, done, points };
      } else {
        t = e.o + ANSWER_MS + GRACE_MS;
        if (now - t < FLASH_MS) live = { p: p.id, i, phase: 'tempo', ms: now - t, done, points };
      }
      if (live && t > bestT) {
        best = live;
        bestT = t;
      }
    });
  }
  return best;
}

/** Os 5 na ordem do painel: mais pontos, depois mais acertos. */
export function quizOrder(all: Partial<Record<PlayerId, QuizRecord>>, qs: Question[]): PlayerId[] {
  return PLAYERS.map((p, order) => ({ id: p.id, s: quizScore(all[p.id], qs), n: rightCount(all[p.id], qs), order }))
    .sort((a, b) => b.s - a.s || b.n - a.n || a.order - b.order)
    .map((x) => x.id);
}

export { dayKey };
