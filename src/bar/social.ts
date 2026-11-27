/**
 * Conversa e bizarrices do bar (funções puras; a gravação fica em presence.ts).
 *
 * Cada jogador tem a própria fila circular no banco — sem disputa de posição entre aparelhos:
 *   bar/chat/{jogador}/{0..19} = { m: texto, t }        (20 mensagens por pessoa, 100 no total)
 *   bar/fx/{jogador}/{0..9}    = { k: tipo, to, e, t }  (emoji e bizarrices instantâneas)
 *   bar/marks/{jogador}        = { by, n, t }           (bigode de caneta em quem está em ressaca)
 *   bar/rate/{jogador}         = { at }                 (o servidor recusa outra ação em menos de 2 s)
 * O estado de cada efeito sai só do horário do evento: quem abre o bar depois vê o mesmo que os outros.
 */
import { PLAYERS, isPlayerId, type PlayerId } from '../arena/sprites';

export const CHAT_SLOTS = 20;
export const FX_SLOTS = 10;
export const MAX_MSG = 140;
export const RATE_MS = 2000;

export const EMOJIS = ['🍺', '🔥', '💀', '😂', '🥴', '👀'] as const;
export type Emoji = (typeof EMOJIS)[number];

export const PHRASES = [
  'Desce mais uma!',
  'Pendura aí',
  'Tô indo embora… mentira',
  'Saideira é minha!',
  'Quem paga essa?',
  'Bora uma cruzada?',
] as const;

/** Fatia 15: `brinde` (com `to` vazio = levantei o copo; com `to` = brindamos) e `reviver` (levantei o amigo). */
export type FxKind = 'emoji' | 'tapa' | 'amendoim' | 'cerveja' | 'bigode' | 'bola' | 'brinde' | 'reviver';

export interface ChatMsg {
  p: PlayerId;
  m: string;
  t: number;
}
export interface FxEvent {
  p: PlayerId;
  k: FxKind;
  to: PlayerId | '';
  e: string;
  t: number;
}
export interface Mark {
  by: PlayerId;
  n: number;
  t: number;
}

/** Espera de cada bizarrice (no aparelho; o servidor ainda segura 2 s entre quaisquer duas ações). */
export const COOLDOWN_MS: Record<Exclude<FxKind, 'emoji'>, number> = {
  tapa: 5_000,
  amendoim: 4_000,
  cerveja: 20_000,
  bigode: 30_000,
  bola: 8_000,
  brinde: 2_000,
  reviver: 2_000,
};
/** Alcance em ladrilhos. */
export const RANGE: Record<Exclude<FxKind, 'emoji'>, number> = { tapa: 1.6, amendoim: 6, cerveja: 5, bigode: 1.6, bola: 7, brinde: 1.5, reviver: 1.1 };
/** Bizarrices que só existem em certos cômodos (a bola 8 só na sinuca). */
export const ONLY_IN: Partial<Record<Exclude<FxKind, 'emoji'>, string>> = { bola: 'sinuca' };

/** Quanto dura cada coisa na tela. */
export const DUR = {
  balloon: 6_000,
  emoji: 2_200,
  throw: 550,
  /** Bola 8 rolando pelo chão até o pé de alguém. */
  roll: 900,
  hurt: 600,
  beer: 60_000,
};

export function cleanText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_MSG);
}

const KINDS: FxKind[] = ['emoji', 'tapa', 'amendoim', 'cerveja', 'bigode', 'bola', 'brinde', 'reviver'];

export function sanitizeChat(raw: unknown): ChatMsg[] {
  const out: ChatMsg[] = [];
  if (!raw || typeof raw !== 'object') return out;
  for (const [pid, slots] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPlayerId(pid) || !slots || typeof slots !== 'object') continue;
    for (const v of Object.values(slots as Record<string, unknown>)) {
      const e = v as Partial<ChatMsg> | null;
      if (!e || typeof e.m !== 'string' || typeof e.t !== 'number') continue;
      const m = cleanText(e.m);
      if (m) out.push({ p: pid, m, t: e.t });
    }
  }
  return out.sort((a, b) => a.t - b.t || a.p.localeCompare(b.p));
}

export function sanitizeFx(raw: unknown): FxEvent[] {
  const out: FxEvent[] = [];
  if (!raw || typeof raw !== 'object') return out;
  for (const [pid, slots] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPlayerId(pid) || !slots || typeof slots !== 'object') continue;
    for (const v of Object.values(slots as Record<string, unknown>)) {
      const e = v as Partial<FxEvent> | null;
      if (!e || !KINDS.includes(e.k as FxKind) || typeof e.t !== 'number') continue;
      const to = isPlayerId(e.to) ? e.to : '';
      if (e.k !== 'emoji' && !to) continue;
      const emo = e.k === 'emoji' && (EMOJIS as readonly string[]).includes(String(e.e)) ? String(e.e) : '';
      if (e.k === 'emoji' && !emo) continue;
      out.push({ p: pid, k: e.k as FxKind, to, e: emo, t: e.t });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

export function sanitizeMarks(raw: unknown): Partial<Record<PlayerId, Mark>> {
  const out: Partial<Record<PlayerId, Mark>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [pid, v] of Object.entries(raw as Record<string, unknown>)) {
    const e = v as Partial<Mark> | null;
    if (!isPlayerId(pid) || !e || !isPlayerId(e.by) || typeof e.n !== 'number' || typeof e.t !== 'number') continue;
    out[pid] = { by: e.by, n: Math.max(0, Math.min(6, Math.floor(e.n))), t: e.t };
  }
  return out;
}

/** Próxima posição da minha fila circular: a vazia, senão a mais antiga. */
export function nextSlot(mine: Record<string, { t?: number } | null | undefined> | undefined, size: number): number {
  let oldest = 0;
  let oldestT = Infinity;
  for (let i = 0; i < size; i++) {
    const e = mine?.[String(i)];
    if (!e || typeof e.t !== 'number') return i;
    if (e.t < oldestT) {
      oldestT = e.t;
      oldest = i;
    }
  }
  return oldest;
}

/** Último balão de fala de cada um, se ainda está no ar. */
export function balloons(chat: ChatMsg[], now: number): Partial<Record<PlayerId, ChatMsg>> {
  const out: Partial<Record<PlayerId, ChatMsg>> = {};
  for (const c of chat) if (now - c.t >= 0 && now - c.t < DUR.balloon) out[c.p] = c;
  return out;
}

export interface Effects {
  /** Emojis subindo da cabeça: quanto já subiu (0..1). */
  emojis: { e: string; k: number }[];
  /** Levando golpe: até quando, e de quem veio (para empurrar para o lado certo). */
  hurtUntil: number;
  hurtFrom: PlayerId | null;
  hurtKind: 'tapa' | 'amendoim' | 'cerveja' | 'bola' | null;
  /** Molhado de cerveja até. */
  beerUntil: number;
  /** Dando um tapa até. */
  punchUntil: number;
}

export interface Projectile {
  from: PlayerId;
  to: PlayerId;
  k: 'amendoim' | 'cerveja' | 'bola';
  /** 0..1 do voo. */
  k01: number;
}

/** Estado dos efeitos de todos num instante (mesma conta em todo aparelho). */
export function effectsAt(fx: FxEvent[], now: number): { by: Record<PlayerId, Effects>; flying: Projectile[] } {
  const by = Object.fromEntries(
    PLAYERS.map((p) => [p.id, { emojis: [], hurtUntil: 0, hurtFrom: null, hurtKind: null, beerUntil: 0, punchUntil: 0 } as Effects]),
  ) as Record<PlayerId, Effects>;
  const flying: Projectile[] = [];
  for (const f of fx) {
    const age = now - f.t;
    if (age < 0) continue;
    if (f.k === 'emoji') {
      if (age < DUR.emoji) by[f.p].emojis.push({ e: f.e, k: age / DUR.emoji });
      continue;
    }
    if (!f.to) continue;
    if (f.k === 'tapa') {
      by[f.p].punchUntil = Math.max(by[f.p].punchUntil, f.t + 350);
      if (f.t + 120 + DUR.hurt > by[f.to].hurtUntil) {
        by[f.to].hurtUntil = f.t + 120 + DUR.hurt;
        by[f.to].hurtFrom = f.p;
        by[f.to].hurtKind = 'tapa';
      }
    } else if (f.k === 'amendoim' || f.k === 'cerveja') {
      if (age < DUR.throw) flying.push({ from: f.p, to: f.to, k: f.k, k01: age / DUR.throw });
      const land = f.t + DUR.throw;
      if (land + DUR.hurt > by[f.to].hurtUntil) {
        by[f.to].hurtUntil = land + DUR.hurt;
        by[f.to].hurtFrom = f.p;
        by[f.to].hurtKind = f.k;
      }
      if (f.k === 'cerveja') by[f.to].beerUntil = Math.max(by[f.to].beerUntil, land + DUR.beer);
    } else if (f.k === 'bola') {
      if (age < DUR.roll) flying.push({ from: f.p, to: f.to, k: 'bola', k01: age / DUR.roll });
      const land = f.t + DUR.roll;
      if (land + DUR.hurt > by[f.to].hurtUntil) {
        by[f.to].hurtUntil = land + DUR.hurt;
        by[f.to].hurtFrom = f.p;
        by[f.to].hurtKind = 'bola';
      }
    }
  }
  return { by, flying };
}

/** Pode fazer essa bizarrice agora? Devolve o motivo quando não pode. */
export function canAct(
  kind: Exclude<FxKind, 'emoji'>,
  opts: { dist: number; targetOnline: boolean; lastUse: number; lastAny: number; now: number },
): { ok: true } | { ok: false; why: 'longe' | 'espera' | 'ressaca' | 'acordado'; waitMs?: number } {
  if (kind === 'bigode' && opts.targetOnline) return { ok: false, why: 'acordado' };
  if (kind !== 'bigode' && !opts.targetOnline) return { ok: false, why: 'ressaca' };
  const wait = Math.max(opts.lastUse + COOLDOWN_MS[kind] - opts.now, opts.lastAny + RATE_MS - opts.now);
  if (wait > 0) return { ok: false, why: 'espera', waitMs: wait };
  if (opts.dist > RANGE[kind]) return { ok: false, why: 'longe' };
  return { ok: true };
}
