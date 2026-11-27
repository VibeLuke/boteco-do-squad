/**
 * Modo sangue (Fase 1b): armas, corações, K.O. e revive. Funções puras; a gravação fica em presence.ts.
 *
 *   bar/hit/{atacante}/{0..29}         = { w: arma, to: alvo, r: cômodo, x, y: ladrilho do alvo no golpe, t: hora do servidor }
 *   bar/cd/{atacante}/{arma}           = { at }   a regra recusa antes da espera da arma
 *   bar/cd/{atacante}/geral            = { at }   10 s entre dois golpes quaisquer
 *   bar/kills/{matador}/{vítima}       = { n, t } ficha corrida do dia (recomeça em 1 no 1º abate do dia)
 *
 * Ninguém grava a própria vida: corações, morte, revive e invencibilidade saem só da lista de golpes,
 * pela mesma conta em todo aparelho (como os efeitos de social.ts). Só entram golpes dos últimos 90 s:
 * com 10 s de espera geral, 10 posições por atacante já guardam todo golpe desse intervalo (a fila tem 30,
 * para as manchas do dia), então a fila circular nunca muda o resultado.
 */
import { PLAYERS, isPlayerId, type PlayerId } from '../arena/sprites';
import { startOfDay } from './day';

export type Weapon = 'soco' | 'garrafa' | 'taco' | 'dardo' | 'banqueta' | 'frigideira';

export interface WeaponDef {
  dmg: number;
  /** Espera para usar de novo (conferida pelo servidor). */
  cd: number;
  /** Alcance em ladrilhos. */
  range: number;
  label: string;
  icon: string;
  /** Do golpe ao impacto (o dardo voa). */
  impact: number;
  /** Grito no impacto. */
  shout: string;
}

export const WEAPONS: Record<Weapon, WeaponDef> = {
  soco: { dmg: 1, cd: 20_000, range: 1.6, label: 'Soco', icon: '👊', impact: 180, shout: 'POW!' },
  garrafa: { dmg: 2, cd: 60_000, range: 1.6, label: 'Garrafa quebrada', icon: '🍾', impact: 200, shout: 'CRASH!' },
  taco: { dmg: 2, cd: 75_000, range: 2.3, label: 'Taco de sinuca', icon: '🎱', impact: 240, shout: 'CRACK!' },
  dardo: { dmg: 1, cd: 45_000, range: 5, label: 'Dardo', icon: '🎯', impact: 450, shout: 'TUC!' },
  banqueta: { dmg: 3, cd: 120_000, range: 1.6, label: 'Banqueta', icon: '🪑', impact: 260, shout: 'KRAKOOM!' },
  frigideira: { dmg: 2, cd: 90_000, range: 1.6, label: 'Frigideira', icon: '🍳', impact: 220, shout: 'BOING!' },
};
export const WEAPON_IDS = Object.keys(WEAPONS) as Weapon[];

export const HEARTS = 3;
export const GLOBAL_CD_MS = 10_000;
/** Os corações enchem de novo 30 s depois do último dano. */
export const HEAL_MS = 30_000;
/** Morto: volta 8 s depois, na porta. */
export const DEAD_MS = 8_000;
/** Invencível por 5 s depois de reviver. */
export const INV_MS = 5_000;
/** Um golpe por vez no mesmo alvo: o segundo que chega em menos de 1 s não conta. */
export const LOCK_MS = 1_000;
/** A frigideira deixa tonto (sem andar nem bater). */
export const STUN_MS = 2_000;
export const HIT_SLOTS = 30;
/** Só golpes desta janela entram na conta (ver o topo do arquivo). */
/** Bastam 10 posições por atacante para guardar todos os golpes desta janela (10 s de espera geral). */
export const HORIZON_MS = 9 * GLOBAL_CD_MS;

export interface Hit {
  p: PlayerId;
  w: Weapon;
  to: PlayerId;
  /** Cômodo onde o golpe aconteceu (corpo e manchas ficam lá). */
  r: string;
  x: number;
  y: number;
  t: number;
}

const isCoord = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 63;

export function sanitizeHits(raw: unknown): Hit[] {
  const out: Hit[] = [];
  if (!raw || typeof raw !== 'object') return out;
  for (const [pid, slots] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPlayerId(pid) || !slots || typeof slots !== 'object') continue;
    for (const v of Object.values(slots as Record<string, unknown>)) {
      const e = v as Partial<Hit> | null;
      if (!e || !(typeof e.w === 'string' && e.w in WEAPONS) || !isPlayerId(e.to) || e.to === pid) continue;
      if (!isCoord(e.x) || !isCoord(e.y) || typeof e.t !== 'number') continue;
      const r = typeof e.r === 'string' && /^[a-z]{1,16}$/.test(e.r) ? e.r : 'salao';
      out.push({ p: pid, w: e.w as Weapon, to: e.to, r, x: e.x!, y: e.y!, t: e.t });
    }
  }
  return sortHits(out);
}

/** Ordem do servidor; empate na mesma hora decide pelo nome (igual em todo aparelho). */
export function sortHits(h: Hit[]): Hit[] {
  return h.slice().sort((a, b) => a.t - b.t || (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));
}

export interface Life {
  hearts: number;
  /** Morreu em (0 = nunca, nesta janela). */
  deadAt: number;
  deadUntil: number;
  invUntil: number;
  stunUntil: number;
  /** O golpe que matou (corpo fica no ladrilho dele). */
  killer: Hit | null;
  /** Último golpe que contou (para o recuo e o grito). */
  last: Hit | null;
  lastDmgAt: number;
}

export interface HitResult {
  hit: Hit;
  counted: boolean;
  why?: 'morto' | 'invencivel' | 'ocupado' | 'atacante-morto';
  lethal: boolean;
  /** Corações do alvo depois do golpe. */
  after: number;
}

const fresh = (): Life => ({ hearts: HEARTS, deadAt: 0, deadUntil: 0, invUntil: 0, stunUntil: 0, killer: null, last: null, lastDmgAt: -Infinity });

export const isDead = (l: Life, t: number) => l.deadAt > 0 && t >= l.deadAt && t < l.deadUntil;

/** Vida de todos num instante: repete os golpes da janela em ordem. */
export function lifeAt(hits: Hit[], now: number): { by: Record<PlayerId, Life>; results: HitResult[] } {
  const by = Object.fromEntries(PLAYERS.map((p) => [p.id, fresh()])) as Record<PlayerId, Life>;
  const lockUntil: Partial<Record<PlayerId, number>> = {};
  const results: HitResult[] = [];
  const from = now - HORIZON_MS;
  for (const h of hits) {
    if (h.t > now || h.t < from || h.p === h.to) continue;
    const a = by[h.p];
    const v = by[h.to];
    // Revive e cura até a hora do golpe.
    if (v.deadUntil && h.t >= v.deadUntil && v.hearts <= 0) {
      v.hearts = HEARTS;
      v.lastDmgAt = -Infinity;
    }
    if (h.t - v.lastDmgAt >= HEAL_MS) v.hearts = HEARTS;
    let why: HitResult['why'];
    if (isDead(a, h.t)) why = 'atacante-morto';
    else if (isDead(v, h.t)) why = 'morto';
    else if (h.t < v.invUntil) why = 'invencivel';
    else if (h.t < (lockUntil[h.to] ?? 0)) why = 'ocupado';
    if (why) {
      results.push({ hit: h, counted: false, why, lethal: false, after: v.hearts });
      continue;
    }
    lockUntil[h.to] = h.t + LOCK_MS;
    v.hearts = Math.max(0, v.hearts - WEAPONS[h.w].dmg);
    v.lastDmgAt = h.t;
    v.last = h;
    const lethal = v.hearts === 0;
    if (lethal) {
      v.deadAt = h.t;
      v.deadUntil = h.t + DEAD_MS;
      v.invUntil = v.deadUntil + INV_MS;
      v.killer = h;
      v.stunUntil = 0;
    } else if (h.w === 'frigideira') v.stunUntil = h.t + STUN_MS;
    results.push({ hit: h, counted: true, lethal, after: v.hearts });
  }
  for (const p of PLAYERS) {
    const l = by[p.id];
    if (l.deadUntil && now >= l.deadUntil && l.hearts <= 0) {
      l.hearts = HEARTS;
      l.lastDmgAt = -Infinity;
    }
    if (now - l.lastDmgAt >= HEAL_MS) l.hearts = HEARTS;
  }
  return { by, results };
}

/** Pode bater agora? */
export function canHit(
  w: Weapon,
  o: { dist: number; targetOnline: boolean; targetSeated: boolean; me: Life; them: Life; waitMs: number; now: number },
): { ok: true } | { ok: false; why: 'morto' | 'tonto' | 'ressaca' | 'sentado' | 'defunto' | 'invencivel' | 'espera' | 'longe'; waitMs?: number } {
  if (isDead(o.me, o.now)) return { ok: false, why: 'morto' };
  if (o.now < o.me.stunUntil) return { ok: false, why: 'tonto' };
  if (!o.targetOnline) return { ok: false, why: 'ressaca' };
  if (o.targetSeated) return { ok: false, why: 'sentado' };
  if (isDead(o.them, o.now)) return { ok: false, why: 'defunto' };
  if (o.now < o.them.invUntil) return { ok: false, why: 'invencivel' };
  if (o.waitMs > 0) return { ok: false, why: 'espera', waitMs: o.waitMs };
  if (o.dist > WEAPONS[w].range) return { ok: false, why: 'longe' };
  return { ok: true };
}

/** Quanto falta para a arma e para a espera geral, pelas horas gravadas em bar/cd/{eu}. */
export function weaponWait(cd: Partial<Record<Weapon | 'geral', number>>, w: Weapon, now: number): number {
  const own = (cd[w] ?? -Infinity) + WEAPONS[w].cd - now;
  const all = (cd.geral ?? -Infinity) + GLOBAL_CD_MS - now;
  return Math.max(0, own, all);
}

export function sanitizeCd(raw: unknown): Partial<Record<Weapon | 'geral', number>> {
  const out: Partial<Record<Weapon | 'geral', number>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of [...WEAPON_IDS, 'geral'] as const) {
    const at = ((raw as Record<string, unknown>)[k] as { at?: unknown } | undefined)?.at;
    if (typeof at === 'number') out[k] = at;
  }
  return out;
}

export { dayKey } from './day';

export interface Tally {
  k: number;
  d: number;
}

/**
 * Abates e mortes de hoje: kills/{matador}/{vítima} = { n: abates no dia, t: hora do último }.
 * Um registro por par, que recomeça em 1 no primeiro abate do dia (o banco não cresce com os dias).
 */
export function tallyDay(raw: unknown, now: number): Record<PlayerId, Tally> {
  const out = Object.fromEntries(PLAYERS.map((p) => [p.id, { k: 0, d: 0 }])) as Record<PlayerId, Tally>;
  if (!raw || typeof raw !== 'object') return out;
  const sod = startOfDay(now);
  for (const [killer, victims] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPlayerId(killer) || !victims || typeof victims !== 'object') continue;
    for (const [victim, v] of Object.entries(victims as Record<string, unknown>)) {
      const e = v as { n?: unknown; t?: unknown } | null;
      if (!isPlayerId(victim) || victim === killer || typeof e?.n !== 'number' || e.n < 0 || typeof e.t !== 'number' || e.t < sod) continue;
      out[killer].k += Math.floor(e.n);
      out[victim].d += Math.floor(e.n);
    }
  }
  return out;
}

/** Abate ainda não anotado: golpe letal meu cujo horário é mais novo que a última anotação contra a vítima. */
export function pendingKills(results: HitResult[], me: PlayerId, mine: Record<string, { t?: number } | undefined>): Hit[] {
  return results.filter((r) => r.lethal && r.hit.p === me && (mine[r.hit.to]?.t ?? 0) < r.hit.t).map((r) => r.hit);
}
