import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { scoreStore, standings, type Period, type Standing } from './scoreStore';
import { isPlayerId, type PlayerId } from './sprites';

const PLAYER_KEY = 'cruzadabotecos.player';

export function useScoreTree() {
  return useSyncExternalStore(
    (fn) => scoreStore.subscribe(fn),
    () => scoreStore.tree,
    () => scoreStore.tree,
  );
}

export function useConnStatus() {
  return useSyncExternalStore(
    (fn) => scoreStore.subscribe(fn),
    () => scoreStore.status,
    () => scoreStore.status,
  );
}

export interface ScoreHit {
  id: PlayerId;
  delta: number;
  n: number;
}

/** Classificação do período + o último ganho de pontos detectado (dispara a briga). */
export function useStandings(period: Period): { rows: Standing[]; hit: ScoreHit | null } {
  const tree = useScoreTree();
  const status = useConnStatus();
  const rows = useMemo(() => standings(tree, period), [tree, period]);
  const prev = useRef<Map<PlayerId, number> | null>(null);
  const base = useRef({ period, status });
  const [hit, setHit] = useState<ScoreHit | null>(null);
  const n = useRef(0);

  useEffect(() => {
    const now = new Map(rows.map((r) => [r.id, r.total]));
    const before = prev.current;
    prev.current = now;
    // Trocar Hoje/Semana/Geral ou receber o primeiro retrato do servidor não é ponto novo: só reancora.
    const rebase = base.current.period !== period || (base.current.status !== 'live' && status === 'live');
    base.current = { period, status };
    if (!before || rebase) return;
    let best: ScoreHit | null = null;
    for (const [id, total] of now) {
      const delta = total - (before.get(id) ?? 0);
      if (delta > 0 && (!best || delta > best.delta)) best = { id, delta, n: 0 };
    }
    if (best) {
      n.current += 1;
      setHit({ ...best, n: n.current });
    }
  }, [rows, period, status]);

  return { rows, hit };
}

export function loadPlayer(): PlayerId | null {
  try {
    const v = localStorage.getItem(PLAYER_KEY);
    return isPlayerId(v) ? v : null;
  } catch {
    return null;
  }
}

export function savePlayer(id: PlayerId): void {
  try {
    localStorage.setItem(PLAYER_KEY, id);
  } catch {
    /* ignora */
  }
}
