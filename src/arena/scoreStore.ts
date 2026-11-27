/**
 * Placar compartilhado do Boteco do Squad.
 *
 * Um registro por jogador por tabuleiro: scores/{jogador}/{código} = { s: pontos, t: quando }.
 * Cada aparelho só grava o próprio registro e só aumenta o valor (o mesmo tabuleiro não soma duas vezes).
 * Os totais são somados na leitura.
 *
 * Online: Firebase Realtime Database pela API REST (PUT + streaming por EventSource), sem SDK.
 * Sem VITE_FIREBASE_DB_URL o placar fica só neste navegador (localStorage, sincroniza entre abas).
 */
import { PLAYERS, isPlayerId, type PlayerId } from './sprites';

export interface ScoreEntry {
  s: number;
  t: number;
}
export type ScoreTree = Partial<Record<PlayerId, Record<string, ScoreEntry>>>;
export type Period = 'today' | 'week' | 'all';
export type ConnStatus = 'local' | 'connecting' | 'live' | 'error';

/** Teto por tabuleiro (o máximo teórico do nível difícil fica bem abaixo). */
export const MAX_SCORE = 20000;

const ROOT = 'cruzadabotecos/v1/scores';
const CACHE_KEY = 'cruzadabotecos.scores.v1';
const PENDING_KEY = 'cruzadabotecos.pending.v1';

function envUrl(): string {
  try {
    const raw = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_FIREBASE_DB_URL ?? '';
    return raw.trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

/** Chaves do Firebase não aceitam . # $ [ ] / — o código do tabuleiro tem pontos. */
export function safeKey(code: string): string {
  return code.replace(/[.#$[\]/\s]/g, '_').slice(0, 64);
}

function validEntry(v: unknown): v is ScoreEntry {
  const e = v as ScoreEntry | null;
  return !!e && typeof e.s === 'number' && Number.isFinite(e.s) && e.s >= 0 && e.s <= MAX_SCORE && typeof e.t === 'number';
}

/** Limpa uma árvore vinda de fora: só os 5 jogadores e registros válidos. */
export function sanitize(raw: unknown): ScoreTree {
  const out: ScoreTree = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [pid, codes] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPlayerId(pid) || !codes || typeof codes !== 'object') continue;
    const clean: Record<string, ScoreEntry> = {};
    for (const [k, v] of Object.entries(codes as Record<string, unknown>)) if (validEntry(v)) clean[k] = { s: Math.round(v.s), t: v.t };
    out[pid] = clean;
  }
  return out;
}

function periodStart(period: Period, now = new Date()): number {
  if (period === 'all') return 0;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') {
    const dow = (d.getDay() + 6) % 7; // segunda = 0
    d.setDate(d.getDate() - dow);
  }
  return d.getTime();
}

export interface Standing {
  id: PlayerId;
  total: number;
  boards: number;
  best: number;
  rank: number;
}

/** Soma por jogador no período; empate desempata por melhor partida e depois pela ordem fixa. */
export function standings(tree: ScoreTree, period: Period, now = new Date()): Standing[] {
  const since = periodStart(period, now);
  const rows = PLAYERS.map((p, order) => {
    let total = 0;
    let boards = 0;
    let best = 0;
    for (const e of Object.values(tree[p.id] ?? {})) {
      if (e.t < since) continue;
      total += e.s;
      boards += 1;
      best = Math.max(best, e.s);
    }
    return { id: p.id, total, boards, best, order };
  });
  rows.sort((a, b) => b.total - a.total || b.best - a.best || a.order - b.order);
  let rank = 0;
  let prev = -1;
  return rows.map((r, i) => {
    if (r.total !== prev) rank = i + 1;
    prev = r.total;
    return { id: r.id, total: r.total, boards: r.boards, best: r.best, rank };
  });
}

/** Aplica um evento do streaming do Firebase (put/patch) numa árvore. */
export function applyStreamEvent(tree: unknown, kind: 'put' | 'patch', path: string, data: unknown): unknown {
  const parts = path.split('/').filter(Boolean);
  const setAt = (node: unknown, keys: string[], value: unknown): unknown => {
    if (!keys.length) return value;
    const base = node && typeof node === 'object' ? { ...(node as Record<string, unknown>) } : {};
    const [k, ...rest] = keys;
    const next = setAt(base[k], rest, value);
    if (next === null || next === undefined) delete base[k];
    else base[k] = next;
    return base;
  };
  if (kind === 'put') return setAt(tree, parts, data);
  let out = tree;
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) out = setAt(out, [...parts, ...k.split('/').filter(Boolean)], v);
  }
  return out;
}

interface Pending {
  player: PlayerId;
  key: string;
  s: number;
  /** Quando o tabuleiro entrou no placar (vem do servidor). Mantém a partida no dia em que começou. */
  t?: number;
}

type Listener = () => void;

class ScoreStore {
  readonly url = envUrl();
  readonly online = this.url.length > 0;
  tree: ScoreTree = {};
  status: ConnStatus = this.online ? 'connecting' : 'local';
  private listeners = new Set<Listener>();
  private started = false;
  private raw: unknown = {};

  constructor() {
    try {
      this.tree = sanitize(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'));
      this.raw = this.tree;
    } catch {
      this.tree = {};
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    this.start();
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private persist() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(this.tree));
    } catch {
      /* cota cheia ou modo privado */
    }
  }

  private start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    if (!this.online) {
      // Outras abas do mesmo navegador.
      window.addEventListener('storage', (e) => {
        if (e.key !== CACHE_KEY) return;
        try {
          this.tree = sanitize(JSON.parse(e.newValue || '{}'));
          this.emit();
        } catch {
          /* ignora */
        }
      });
      return;
    }
    this.connect();
    window.addEventListener('online', () => void this.flush());
    void this.flush();
  }

  private connect() {
    if (typeof EventSource === 'undefined') {
      this.status = 'error';
      this.emit();
      return;
    }
    const es = new EventSource(`${this.url}/${ROOT}.json`);
    const onData = (kind: 'put' | 'patch') => (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data) as { path: string; data: unknown };
        if (kind === 'put' && msg.path === '/') this.raw = msg.data ?? {};
        else this.raw = applyStreamEvent(this.raw, kind, msg.path, msg.data);
        this.tree = this.mergePending(sanitize(this.raw));
        this.status = 'live';
        this.persist();
        this.emit();
      } catch {
        /* evento malformado: ignora */
      }
    };
    es.addEventListener('put', onData('put') as EventListener);
    es.addEventListener('patch', onData('patch') as EventListener);
    es.addEventListener('cancel', () => {
      this.status = 'error';
      this.emit();
    });
    es.onerror = () => {
      // O EventSource reconecta sozinho; só sinaliza.
      this.status = es.readyState === EventSource.CLOSED ? 'error' : 'connecting';
      this.emit();
    };
  }

  /** Mantém visível o que ainda não subiu para o servidor. */
  private mergePending(tree: ScoreTree): ScoreTree {
    const pend = this.pending();
    if (!pend.length) return tree;
    const out: ScoreTree = { ...tree };
    for (const p of pend) {
      const cur = out[p.player]?.[p.key];
      if (!cur || cur.s < p.s) out[p.player] = { ...(out[p.player] ?? {}), [p.key]: { s: p.s, t: cur?.t ?? p.t ?? Date.now() } };
    }
    return out;
  }

  private pending(): Pending[] {
    try {
      const v = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
      return Array.isArray(v) ? v.filter((p) => isPlayerId(p?.player) && typeof p?.key === 'string' && typeof p?.s === 'number') : [];
    } catch {
      return [];
    }
  }

  private setPending(list: Pending[]) {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-200)));
    } catch {
      /* ignora */
    }
  }

  private async put(p: Pending): Promise<boolean> {
    try {
      const res = await fetch(`${this.url}/${ROOT}/${p.player}/${encodeURIComponent(p.key)}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s: p.s, t: typeof p.t === 'number' ? p.t : { '.sv': 'timestamp' } }),
      });
      // 401/403: a regra recusou (valor menor que o já gravado ou fora do teto). Não adianta repetir.
      return res.ok || res.status === 401 || res.status === 403;
    } catch {
      return false;
    }
  }

  private flushing = false;
  async flush(): Promise<void> {
    if (!this.online || this.flushing) return;
    this.flushing = true;
    try {
      const left: Pending[] = [];
      for (const p of this.pending()) if (!(await this.put(p))) left.push(p);
      this.setPending(left);
    } finally {
      this.flushing = false;
    }
  }

  /** Registra a pontuação atual de um jogador num tabuleiro (só sobe, nunca desce). */
  report(player: PlayerId, code: string, score: number): void {
    const s = Math.max(0, Math.min(MAX_SCORE, Math.round(score)));
    const key = safeKey(code);
    const cur = this.tree[player]?.[key];
    if (cur && cur.s >= s) return;
    if (!cur && s === 0) return;
    // Melhorar um tabuleiro antigo não o puxa para "Hoje": o horário é o da primeira gravação.
    // Só reaproveita horário vindo do servidor (relógio do celular adiantado seria recusado pela regra t <= now).
    const serverT = (this.raw as Record<string, Record<string, { t?: unknown }> | undefined>)?.[player]?.[key]?.t;
    const keepT = typeof serverT === 'number' && Number.isFinite(serverT) ? serverT : undefined;
    this.tree = { ...this.tree, [player]: { ...(this.tree[player] ?? {}), [key]: { s, t: cur ? cur.t : Date.now() } } };
    this.persist();
    this.emit();
    if (this.online) {
      const list = this.pending().filter((p) => !(p.player === player && p.key === key));
      list.push(keepT === undefined ? { player, key, s } : { player, key, s, t: keepT });
      this.setPending(list);
      void this.flush();
    }
  }

  /** Exporta o placar local em texto (backup / levar para outro aparelho no modo local). */
  exportCode(): string {
    return btoa(unescape(encodeURIComponent(JSON.stringify(this.tree))));
  }

  importCode(code: string): boolean {
    try {
      const incoming = sanitize(JSON.parse(decodeURIComponent(escape(atob(code.trim())))));
      const merged: ScoreTree = { ...this.tree };
      for (const pid of Object.keys(incoming) as PlayerId[]) {
        const mine = { ...(merged[pid] ?? {}) };
        for (const [k, e] of Object.entries(incoming[pid] ?? {})) if (!mine[k] || mine[k].s < e.s) mine[k] = e;
        merged[pid] = mine;
      }
      this.tree = merged;
      this.persist();
      this.emit();
      return true;
    } catch {
      return false;
    }
  }
}

export const scoreStore = new ScoreStore();
