import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { PLAYER_BY_ID, type PlayerId } from '../arena/sprites';
import { scoreStore, safeKey } from '../arena/scoreStore';
import { barPresence } from './presence';
import { normalizeGuess } from './daily';
import {
  ANA_POINTS,
  ANA_WORDS,
  REVEAL_COST,
  anaOrder,
  anaScore,
  anaScoreKey,
  canReveal,
  dayKey,
  isRight,
  loadAnagrams,
  remainingTiles,
  sanitizeAna,
  setOfDay,
  solvedCount,
  wordPoints,
  type AnaRecord,
  type AnaWord,
} from './anagram';

function useAna() {
  return useSyncExternalStore(
    (fn) => barPresence.subscribe(fn),
    () => barPresence.anaRaw,
  );
}

/** Quais peças o texto digitado usa (a primeira livre de cada letra). null = letra que não está nas peças. */
function tileUsage(tiles: string[], typed: string): (number | null)[] {
  const used = new Set<number>();
  return typed.split('').map((c) => {
    const k = tiles.findIndex((t, i) => t === c && !used.has(i));
    if (k < 0) return null;
    used.add(k);
    return k;
  });
}

/** Só as letras que cabem nas peças que sobram (na ordem digitada). */
function fitTyped(tiles: string[], raw: string, max: number): string {
  const used = new Set<number>();
  let out = '';
  for (const c of normalizeGuess(raw)) {
    const k = tiles.findIndex((t, i) => t === c && !used.has(i));
    if (k < 0) continue;
    used.add(k);
    out += c;
    if (out.length >= max) break;
  }
  return out;
}

export function AnagramPanel({ player, onClose, say }: { player: PlayerId; onClose: () => void; say: (m: string) => void }) {
  const anaRaw = useAna();
  const now = barPresence.now();
  const day = dayKey(now);
  const [words, setWords] = useState<AnaWord[] | null>(null);
  const online = barPresence.online;
  const all = sanitizeAna(anaRaw, now);
  /** Treino (sem banco): fica só aqui e não vale ponto. */
  const [practice, setPractice] = useState<AnaRecord>(() => Array.from({ length: ANA_WORDS }, () => undefined));
  const mine: AnaRecord = online ? (all[player] ?? Array.from({ length: ANA_WORDS }, () => undefined)) : practice;
  const [active, setActive] = useState(0);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void loadAnagrams().then((data) => {
      if (!alive) return;
      const set = setOfDay(data, day);
      setWords(set);
    });
    return () => {
      alive = false;
    };
  }, [day]);

  // Abre na primeira palavra ainda não acertada.
  const opened = useRef(false);
  useEffect(() => {
    if (!words || opened.current) return;
    opened.current = true;
    const first = words.findIndex((w) => !mine[w.i]?.ok);
    if (first >= 0) setActive(first);
  }, [words, mine]);

  const myPoints = online ? anaScore(mine) : 0;
  const scored = scoreStore.tree[player]?.[safeKey(anaScoreKey(day))]?.s ?? 0;
  // Acertou mas a pontuação não chegou ao placar (aba fechada no meio): manda de novo (o placar só sobe).
  useEffect(() => {
    if (online && myPoints > scored) scoreStore.report(player, anaScoreKey(day), myPoints);
  }, [online, myPoints, scored, player, day]);

  const word = words?.[active];
  const entry = word ? mine[word.i] : undefined;
  const r = entry?.r ?? 0;
  const solved = !!entry?.ok;
  const tiles = useMemo(() => (word ? remainingTiles(word, r) : []), [word, r]);
  const usage = tileUsage(tiles, typed);
  const need = word ? word.w.length - r : 0;

  useEffect(() => {
    setTyped('');
    if (!solved) inputRef.current?.focus({ preventScroll: true });
  }, [active, r, solved]);

  /** Grava (ou guarda no treino) o registro novo da palavra. */
  const save = async (w: AnaWord, nr: number, ok: boolean): Promise<boolean> => {
    if (!online) {
      setPractice((p) => p.map((e, i) => (i === w.i ? { r: nr, ok, t: Date.now() } : e)));
      return true;
    }
    setBusy(true);
    const done = await barPresence.ana(w.i, nr, ok);
    setBusy(false);
    if (!done) say('Não gravou (sem rede?). Tente de novo');
    return done;
  };

  const reveal = async () => {
    if (!word || busy || !canReveal(mine, word)) return;
    // A letra só aparece depois que o banco aceitou o custo.
    if (await save(word, r + 1, false)) say(`Dica: a ${r + 1}ª letra é ${word.w[r]} (−${REVEAL_COST})`);
  };

  const check = async (attempt: string) => {
    if (!word || busy || solved) return;
    const full = word.w.slice(0, r) + attempt;
    if (full.length !== word.w.length) return;
    if (!isRight(full, word)) {
      setShake((n) => n + 1);
      setTyped('');
      say('Não é essa. Embaralha de novo na cabeça…');
      return;
    }
    if (!(await save(word, r, true))) return;
    const pts = wordPoints(word.i, r);
    if (online) {
      const total = anaScore(mine.map((e, i) => (i === word.i ? { r, ok: true, t: now } : e)));
      scoreStore.report(player, anaScoreKey(day), total);
    }
    say(online ? `🎵 ${word.w}! +${pts} pontos` : `🎵 ${word.w}! (treino)`);
    const next = words!.findIndex((w) => w.i !== word.i && !mine[w.i]?.ok);
    if (next >= 0) setActive(next);
  };

  const type = (raw: string) => {
    const t = fitTyped(tiles, raw, need);
    setTyped(t);
    if (t.length === need) void check(t);
  };

  const done = solvedCount(mine);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal bar-modal ana" role="dialog" aria-modal="true" aria-labelledby="ana-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn bar-modal-x" onClick={onClose} aria-label="Fechar">
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id="ana-title" className="section-title">
          <span className="serif">Anagrama da Saideira</span>
        </h2>
        {!online && <p className="bar-note">Sem o placar online: é treino, não vale ponto.</p>}
        {!words ? (
          <p className="bar-note">Escolhendo o disco…</p>
        ) : (
          <>
            <div className="ana-tabs" role="tablist" aria-label="Os 5 anagramas de hoje">
              {words.map((w) => {
                const e = mine[w.i];
                return (
                  <button
                    key={w.i}
                    type="button"
                    role="tab"
                    aria-selected={w.i === active}
                    className={`ana-tab${w.i === active ? ' is-on' : ''}${e?.ok ? ' is-ok' : ''}`}
                    onClick={() => setActive(w.i)}
                  >
                    <b>{w.w.length}</b>
                    <small>{e?.ok ? `+${wordPoints(w.i, e.r)}` : `${Math.max(0, ANA_POINTS[w.i] - REVEAL_COST * (e?.r ?? 0))}`}</small>
                  </button>
                );
              })}
            </div>

            {word && (
              <div className="ana-word">
                <p className="daily-clue">
                  <span className="daily-theme">{word.theme}</span> {word.clue}
                </p>
                <div key={shake} className={`ana-slots${shake ? ' is-shake' : ''}`} style={{ ['--len' as string]: word.w.length }} aria-label="Sua resposta">
                  {word.w.split('').map((c, k) => {
                    const ch = solved ? c : k < r ? c : (typed[k - r] ?? '');
                    return (
                      <span key={k} className={`daily-cell ${solved ? 'is-v' : k < r ? 'is-a' : ch ? 'is-typing' : ''}`}>
                        {ch}
                      </span>
                    );
                  })}
                </div>
                {solved ? (
                  <p className="daily-result" role="status">
                    Acertou{r ? ` com ${r} letra${r > 1 ? 's' : ''} de dica` : ' sem dica'}: {wordPoints(word.i, r)} pontos.
                  </p>
                ) : (
                  <>
                    <div className="ana-tiles" aria-label="Letras embaralhadas">
                      {tiles.map((c, k) => (
                        <button
                          key={k}
                          type="button"
                          className={`ana-tile${usage.includes(k) ? ' is-used' : ''}`}
                          disabled={busy || usage.includes(k)}
                          onClick={() => type(typed + c)}
                          aria-label={`Letra ${c}`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <form
                      className="bar-say daily-say"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void check(typed);
                      }}
                    >
                      <input
                        ref={inputRef}
                        type="text"
                        value={typed}
                        onChange={(e) => type(e.target.value)}
                        placeholder={`${need} letras`}
                        aria-label={`Resposta: faltam ${need} letras`}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        enterKeyHint="send"
                        disabled={busy}
                      />
                      <button type="button" className="btn btn-ghost" onClick={() => setTyped(typed.slice(0, -1))} disabled={!typed || busy} aria-label="Apagar a última letra">
                        ⌫
                      </button>
                    </form>
                    <button type="button" className="btn btn-ghost ana-reveal" onClick={() => void reveal()} disabled={busy || !canReveal(mine, word)}>
                      💡 Revelar a {r + 1}ª letra (−{REVEAL_COST})
                    </button>
                  </>
                )}
              </div>
            )}
            <p className="bar-note daily-legend">
              {ANA_POINTS.join(', ')} pontos; cada letra revelada custa {REVEAL_COST}. Hoje: {done}/{ANA_WORDS}
              {online ? `, ${myPoints} pontos` : ''}.
            </p>
          </>
        )}

        <h3 className="bar-ficha-title">🎵 Quem está mandando na jukebox</h3>
        <ul className="daily-crowd" aria-label="Como os amigos estão indo">
          {anaOrder(all).map((id) => {
            const rec = all[id];
            return (
              <li key={id}>
                <b style={{ color: PLAYER_BY_ID[id].color }}>{PLAYER_BY_ID[id].name}</b>
                <span className="ana-dots" aria-label={`${solvedCount(rec)} de ${ANA_WORDS}`}>
                  {Array.from({ length: ANA_WORDS }, (_, i) => (
                    <i key={i} className={rec?.[i]?.ok ? 'is-v' : rec?.[i]?.r ? 'is-a' : 'is-x'} />
                  ))}
                </span>
                <small>{rec ? `${anaScore(rec)} pts` : 'não jogou'}</small>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
