import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { PLAYER_BY_ID, type PlayerId } from '../arena/sprites';
import { scoreStore, safeKey } from '../arena/scoreStore';
import { barPresence } from './presence';
import {
  MAX_TRIES,
  POINTS,
  SINO_BONUS,
  boardOrder,
  canGuess,
  dailyScore,
  dayKey,
  grade,
  normalizeGuess,
  sanitizeDia,
  scoreKey,
  sinoToday,
  wordOfDay,
} from './daily';

const LETTERS_KEY = 'cruzadabotecos.dia.v1';

/** As letras de cada chute ficam só neste aparelho (o banco guarda só as cores). */
function loadLetters(player: PlayerId, day: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(LETTERS_KEY) || '{}') as Record<string, string[]>;
    const v = all[`${player}:${day}`];
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function saveLetters(player: PlayerId, day: string, letters: string[]) {
  try {
    const all = JSON.parse(localStorage.getItem(LETTERS_KEY) || '{}') as Record<string, string[]>;
    // Guarda só os 3 dias mais recentes.
    const keep = Object.keys(all)
      .filter((k) => !k.startsWith(`${player}:`) || Number(k.split(':')[1]) >= Number(day) - 2)
      .reduce<Record<string, string[]>>((o, k) => ((o[k] = all[k]), o), {});
    keep[`${player}:${day}`] = letters;
    localStorage.setItem(LETTERS_KEY, JSON.stringify(keep));
  } catch {
    /* sem armazenamento: as cores continuam no banco */
  }
}

function useDia() {
  return useSyncExternalStore(
    (fn) => barPresence.subscribe(fn),
    () => barPresence.diaRaw,
  );
}
function useSino() {
  return useSyncExternalStore(
    (fn) => barPresence.subscribe(fn),
    () => barPresence.sinoRaw,
  );
}

const COLOR: Record<string, string> = { V: 'is-v', A: 'is-a', X: 'is-x' };

export function DailyPanel({ player, onClose, say }: { player: PlayerId; onClose: () => void; say: (m: string) => void }) {
  const diaRaw = useDia();
  const sinoRaw = useSino();
  const now = barPresence.now();
  const day = dayKey(now);
  const word = useMemo(() => wordOfDay(day), [day]);
  const dia = sanitizeDia(diaRaw, now);
  const mine = dia[player];
  const sino = sinoToday(sinoRaw, now);
  const online = barPresence.online;
  const [letters, setLetters] = useState<string[]>(() => loadLetters(player, day));
  /** Treino (sem banco): os chutes ficam só aqui e não valem ponto. */
  const [practice, setPractice] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const patterns = online ? (mine?.g ?? []) : practice.map((g) => grade(g, word.w));
  const shown = online ? letters : practice;
  const solved = patterns.length > 0 && /^V+$/.test(patterns[patterns.length - 1]);
  const over = solved || patterns.length >= MAX_TRIES;
  const scored = scoreStore.tree[player]?.[safeKey(scoreKey(day))]?.s ?? 0;
  const myPoints = online ? dailyScore(mine, sino?.p === player) : 0;

  // Acertou mas a pontuação não chegou ao placar (aba fechada no meio): manda de novo (o placar só sobe).
  useEffect(() => {
    if (online && myPoints > scored) scoreStore.report(player, scoreKey(day), myPoints);
  }, [online, myPoints, scored, player, day]);

  useEffect(() => {
    if (!over) inputRef.current?.focus({ preventScroll: true });
  }, [over]);

  const submit = async () => {
    const g = normalizeGuess(text);
    if (g.length !== word.w.length) {
      say(`A palavra tem ${word.w.length} letras`);
      return;
    }
    const pattern = grade(g, word.w);
    if (!online) {
      setPractice((p) => [...p, g]);
      setText('');
      return;
    }
    if (!canGuess(mine)) return;
    setBusy(true);
    // Grava as cores antes de mostrar: o chute só aparece depois que o banco aceitou.
    const res = await barPresence.guess(pattern);
    setBusy(false);
    if (!res.saved) {
      say('O chute não gravou (sem rede?). Tente de novo');
      return;
    }
    // Chutes feitos em outro aparelho não têm letras aqui: ficam vazios (aparecem como "?").
    const next = [...Array.from({ length: mine?.n ?? 0 }, (_, i) => letters[i] ?? ''), g];
    setLetters(next);
    saveLetters(player, day, next);
    setText('');
    if (/^V+$/.test(pattern)) {
      const n = (mine?.n ?? 0) + 1;
      const pts = POINTS[n - 1] + (res.bell ? SINO_BONUS : 0);
      scoreStore.report(player, scoreKey(day), pts);
      say(res.bell ? `🔔 Sino é seu! +${pts} pontos` : `Acertou no ${n}º chute! +${pts} pontos`);
    } else if ((mine?.n ?? 0) + 1 >= MAX_TRIES) say(`Acabaram os chutes. Era ${word.w}`);
  };

  const rows = Array.from({ length: MAX_TRIES }, (_, i) => i);
  const len = word.w.length;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal bar-modal daily" role="dialog" aria-modal="true" aria-labelledby="daily-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn bar-modal-x" onClick={onClose} aria-label="Fechar">
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id="daily-title" className="section-title">
          <span className="serif">Palavra do Dia</span>
        </h2>
        <p className="daily-clue">
          <span className="daily-theme">{word.theme}</span> {word.clue}
        </p>
        {!online && <p className="bar-note">Sem o placar online: é treino, não vale ponto.</p>}

        <div className="daily-grid" style={{ ['--len' as string]: len }} aria-label="Seus chutes">
          {rows.map((i) => (
            <div key={i} className="daily-row">
              {Array.from({ length: len }, (_, j) => {
                const p = patterns[i];
                const ch = p ? shown[i]?.[j] || '?' : i === patterns.length && !over ? (normalizeGuess(text)[j] ?? '') : '';
                return (
                  <span key={j} className={`daily-cell ${p ? COLOR[p[j]] : i === patterns.length && !over ? 'is-typing' : ''}`}>
                    {ch}
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        {over ? (
          <p className="daily-result" role="status">
            {solved
              ? online
                ? `Acertou no ${patterns.length}º chute: ${myPoints} pontos${sino?.p === player ? ' (com o sino 🔔)' : ''}.`
                : `Acertou no ${patterns.length}º chute (treino).`
              : `Acabaram os chutes. Era ${word.w}.`}
          </p>
        ) : (
          <form
            className="bar-say daily-say"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) void submit();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={text}
              maxLength={len + 4}
              onChange={(e) => setText(e.target.value)}
              placeholder={`${len} letras`}
              aria-label={`Chute de ${len} letras`}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="send"
              disabled={busy}
            />
            <button type="submit" className="btn btn-primary" disabled={busy || normalizeGuess(text).length !== len}>
              Chutar
            </button>
          </form>
        )}
        <p className="bar-note daily-legend">
          <span className="daily-cell is-v">A</span> lugar certo <span className="daily-cell is-a">A</span> em outro lugar{' '}
          <span className="daily-cell is-x">A</span> não tem · {POINTS[0]} a {POINTS[MAX_TRIES - 1]} pontos, +{SINO_BONUS} para quem bate o sino
        </p>

        <h3 className="bar-ficha-title">{sino ? `🔔 ${PLAYER_BY_ID[sino.p].name} bateu o sino` : '🔔 Ninguém bateu o sino ainda'}</h3>
        <ul className="daily-crowd" aria-label="Como os amigos estão indo (só as cores)">
          {boardOrder(dia).map((id) => {
            const e = dia[id];
            return (
              <li key={id}>
                <b style={{ color: PLAYER_BY_ID[id].color }}>{PLAYER_BY_ID[id].name}</b>
                <span className="daily-mini">
                  {(e?.g ?? []).map((p, i) => (
                    <span key={i} className="daily-mini-row">
                      {p.split('').map((c, j) => (
                        <i key={j} className={COLOR[c]} />
                      ))}
                    </span>
                  ))}
                </span>
                <small>{!e ? 'não jogou' : e.ok ? `acertou no ${e.n}º` : e.n >= MAX_TRIES ? 'não acertou' : `${e.n}/${MAX_TRIES}`}</small>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
