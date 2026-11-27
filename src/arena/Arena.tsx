import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Crown, Pause, Play } from 'lucide-react';
import { Sprite } from './Sprite';
import { PLAYER_BY_ID, type PlayerId, type Pose } from './sprites';
import type { Standing } from './scoreStore';
import type { ScoreHit } from './useScoreboard';

/**
 * Arena da briga: os 5 ficam em fila pela classificação e se estapeiam sem parar.
 * - A cada 2,4–4,2 s rola uma treta ambiente (quem está atrás ataca quem está logo à frente,
 *   ou o líder provoca / bate no vice).
 * - Quando alguém pontua, ele parte para cima de quem está logo acima com um golpe maior e "+pontos".
 * - Golpe em 3 fases: antecipação (120 ms), avanço (90 ms, em degraus), impacto com hit-stop (80 ms) e recuo.
 * - Só uma briga por vez; pausa com a aba escondida; com prefers-reduced-motion fica só o balão.
 */

interface FighterState {
  pose: Pose;
  dx: number;
  dy: number;
  dir: 1 | -1;
  dur: number;
  bubble: { text: string; kind: 'pow' | 'say' | 'plus'; n: number } | null;
}

const ATTACK = ['Toma!', 'Pega essa!', 'Hadouken!', 'Combo!', 'Sai da frente!', 'É meu!'];
const POW = ['POW!', 'BAM!', 'KAPOW!', 'TUM!', 'PÁ!', 'CRACK!'];
const TAUNT = ['Saideira é minha!', 'Garçom, desce o placar!', 'Fácil demais!', 'Chora não!', 'Pede música!', 'Quem paga a conta?', 'Respeita o rei!', 'Tá fraco, hein?'];
const LOSE = ['Ai!', 'Foi sorte!', 'Revanche!', 'Me espera...', 'Isso não vale!'];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Props {
  rows: Standing[];
  hit: ScoreHit | null;
  me?: PlayerId | null;
  compact?: boolean;
  label?: string;
}

export function Arena({ rows, hit, me, compact = false, label }: Props) {
  const scale = compact ? 2 : 3;
  const order = useMemo(() => rows.map((r) => r.id), [rows]);
  const slotOf = useCallback((id: PlayerId) => order.indexOf(id), [order]);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const leader = rows[0]?.total > 0 ? rows[0].id : null;

  const [fx, setFx] = useState<Record<PlayerId, FighterState>>(() => {
    const init = {} as Record<PlayerId, FighterState>;
    rows.forEach((r, i) => (init[r.id] = { pose: 'idle', dx: 0, dy: 0, dir: i <= 2 ? 1 : -1, dur: 0, bubble: null }));
    return init;
  });
  const [shake, setShake] = useState(0);
  const [paused, setPaused] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const [slotPx, setSlotPx] = useState(120);
  const timers = useRef<number[]>([]);
  const busy = useRef(false);
  const queue = useRef<ScoreHit[]>([]);
  const bubbleN = useRef(0);
  const orderRef = useRef(order);
  orderRef.current = order;

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setSlotPx(el.clientWidth / 5);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const patch = useCallback((id: PlayerId, p: Partial<FighterState>) => {
    setFx((prev) => ({ ...prev, [id]: { ...prev[id], ...p } }));
  }, []);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const say = useCallback(
    (id: PlayerId, text: string, kind: 'pow' | 'say' | 'plus', ms = 1100) => {
      bubbleN.current += 1;
      const n = bubbleN.current;
      patch(id, { bubble: { text, kind, n } });
      later(ms, () => setFx((prev) => (prev[id].bubble?.n === n ? { ...prev, [id]: { ...prev[id], bubble: null } } : prev)));
    },
    [later, patch],
  );

  const facing = useCallback((id: PlayerId): 1 | -1 => (orderRef.current.indexOf(id) <= 2 ? 1 : -1), []);

  const finish = useCallback(() => {
    busy.current = false;
    const next = queue.current.shift();
    if (next) runHitRef.current?.(next);
  }, []);

  /** Golpe completo de `a` em `b`. */
  const attack = useCallback(
    (a: PlayerId, b: PlayerId, opts: { big?: boolean; shout?: string; plus?: number } = {}) => {
      if (a === b) return;
      busy.current = true;
      const sa = orderRef.current.indexOf(a);
      const sb = orderRef.current.indexOf(b);
      const dir: 1 | -1 = sb > sa ? 1 : -1;
      const reach = Math.max(0, Math.abs(sb - sa) * slotPx - 24 * scale * 0.85);
      if (reducedMotion()) {
        if (opts.plus) say(a, `+${opts.plus}`, 'plus', 1600);
        else if (opts.shout) say(a, opts.shout, 'say');
        later(1700, finish);
        return;
      }
      patch(a, { pose: 'idle', dir, dx: -dir * 6, dur: 120 });
      if (opts.plus) say(a, `+${opts.plus}`, 'plus', 1500);
      later(120, () => {
        patch(a, { pose: 'punch', dx: dir * reach, dur: 90 });
        if (opts.shout && !opts.plus) say(a, opts.shout, 'say', 900);
      });
      later(210, () => {
        patch(b, { pose: 'hurt', dir: (-dir as 1 | -1), dx: dir * (opts.big ? 22 : 12), dy: opts.big ? -6 : 0, dur: 80 });
        say(b, pick(POW), 'pow', 650);
        if (opts.big) setShake((s) => s + 1);
      });
      later(520, () => patch(a, { pose: 'idle', dx: 0, dur: 220, dir: facing(a) }));
      later(560, () => patch(b, { dy: 0, dur: 160 }));
      later(820, () => {
        patch(b, { pose: 'idle', dx: 0, dur: 240, dir: facing(b) });
        if (Math.random() < 0.45) say(b, pick(LOSE), 'say', 900);
      });
      later(1150, finish);
    },
    [facing, finish, later, patch, say, scale, slotPx],
  );

  const taunt = useCallback(
    (id: PlayerId) => {
      busy.current = true;
      if (!reducedMotion()) {
        patch(id, { pose: 'win', dy: -10, dur: 120 });
        later(160, () => patch(id, { dy: 0, dur: 120 }));
        later(320, () => patch(id, { dy: -8, dur: 120 }));
        later(460, () => patch(id, { dy: 0, dur: 120 }));
        later(1300, () => patch(id, { pose: 'idle' }));
      }
      say(id, pick(TAUNT), 'say', 1500);
      later(1500, finish);
    },
    [finish, later, patch, say],
  );

  const runHit = useCallback(
    (h: ScoreHit) => {
      const o = orderRef.current;
      const s = o.indexOf(h.id);
      const target = s > 0 ? o[s - 1] : o[1];
      attack(h.id, target, { big: true, plus: h.delta });
    },
    [attack],
  );
  const runHitRef = useRef(runHit);
  runHitRef.current = runHit;

  // Pontos novos: briga grande, na fila se já houver uma rolando.
  const lastHit = useRef(0);
  useEffect(() => {
    if (!hit || hit.n === lastHit.current) return;
    lastHit.current = hit.n;
    if (busy.current) queue.current.push(hit);
    else runHit(hit);
  }, [hit, runHit]);

  // Treta ambiente constante.
  useEffect(() => {
    if (paused || reducedMotion()) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(
        () => {
          if (!document.hidden && !busy.current) {
            const o = orderRef.current;
            const r = Math.random();
            if (r < 0.5) {
              const a = 1 + Math.floor(Math.random() * 4);
              attack(o[a], o[a - 1], { shout: Math.random() < 0.5 ? pick(ATTACK) : undefined });
            } else if (r < 0.75) {
              taunt(o[0]);
            } else {
              attack(o[0], o[1], { shout: pick(ATTACK) });
            }
          }
          loop();
        },
        2400 + Math.random() * 1800,
      );
    };
    loop();
    return () => window.clearTimeout(t);
  }, [attack, paused, taunt]);

  // Ao reordenar, cada um vira para o centro.
  useEffect(() => {
    if (busy.current) return;
    setFx((prev) => {
      const next = { ...prev };
      order.forEach((id, i) => (next[id] = { ...next[id], dir: i <= 2 ? 1 : -1 }));
      return next;
    });
  }, [order]);

  return (
    <section className={`arena${compact ? ' is-compact' : ''}`} aria-label={label ?? 'Placar da briga'}>
      <div className={`arena-stage${shake % 2 ? ' shake-a' : shake ? ' shake-b' : ''}`} ref={stage}>
        <div className="arena-back" aria-hidden="true" />
        {rows.map((r) => {
          const p = PLAYER_BY_ID[r.id];
          const st = fx[r.id];
          const slot = slotOf(r.id);
          const isLeader = leader === r.id;
          return (
            <div
              key={r.id}
              className={`fighter${me === r.id ? ' is-me' : ''}${isLeader ? ' is-leader' : ''}`}
              style={{ left: `${slot * 20 + 10}%`, '--pc': p.color } as CSSProperties}
            >
              <div
                className="fighter-move"
                style={{
                  transform: `translate(${Math.round(st.dx)}px, ${st.dy}px)`,
                  transition: st.dur ? `transform ${st.dur}ms steps(${Math.max(2, Math.round(st.dur / 40))})` : 'none',
                }}
              >
                {isLeader && <span className="fighter-crown" aria-hidden="true" />}
                <div className="fighter-bob" style={{ animationDelay: `${-slot * 170}ms` }}>
                  <Sprite id={r.id} pose={st.pose} scale={scale} flip={st.dir < 0} />
                </div>
                {st.bubble && (
                  <span key={st.bubble.n} className={`bubble bubble-${st.bubble.kind}`} aria-hidden="true">
                    {st.bubble.text}
                  </span>
                )}
              </div>
              <span className="fighter-shadow" aria-hidden="true" />
            </div>
          );
        })}
      </div>
      <ol className="arena-board">
        {rows.map((r) => {
          const p = PLAYER_BY_ID[r.id];
          return (
            <li key={r.id} className={`ab-row${me === r.id ? ' is-me' : ''}`} style={{ '--pc': p.color } as CSSProperties}>
              <span className="ab-rank">{r.rank === 1 && r.total > 0 ? <Crown size={12} aria-label="Líder" /> : `${r.rank}º`}</span>
              <span className="ab-name">{p.name}</span>
              <span className="ab-score">{r.total.toLocaleString('pt-BR')}</span>
              <span className="ab-bar" aria-hidden="true">
                <i style={{ width: `${Math.round((r.total / maxTotal) * 100)}%` }} />
              </span>
            </li>
          );
        })}
      </ol>
      {!compact && (
        <button type="button" className="arena-pause" onClick={() => setPaused((v) => !v)} aria-pressed={paused} title={paused ? 'Soltar a briga' : 'Apartar a briga'}>
          {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
          <span>{paused ? 'Soltar a briga' : 'Apartar'}</span>
        </button>
      )}
    </section>
  );
}
