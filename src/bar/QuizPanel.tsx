import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import { PLAYER_BY_ID, type PlayerId } from '../arena/sprites';
import { scoreStore, safeKey } from '../arena/scoreStore';
import { barPresence } from './presence';
import {
  ANSWER_MS,
  QUIZ_N,
  RIGHT_POINTS,
  SPEED_MAX,
  answerPoints,
  currentQuestion,
  dayKey,
  loadQuiz,
  quizOrder,
  quizScore,
  quizScoreKey,
  rightCount,
  sanitizeQuiz,
  stateOf,
  questionsOfDay,
  type Question,
  type QuizRecord,
} from './quiz';

function useQuiz() {
  return useSyncExternalStore(
    (fn) => barPresence.subscribe(fn),
    () => barPresence.quizRaw,
  );
}

const empty = (): QuizRecord => Array.from({ length: QUIZ_N }, () => undefined);

export function QuizPanel({ player, onClose, say }: { player: PlayerId; onClose: () => void; say: (m: string) => void }) {
  const quizRaw = useQuiz();
  const online = barPresence.online;
  const [qs, setQs] = useState<Question[] | null>(null);
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  /** Treino (sem banco): fica só aqui e não vale ponto. */
  const [practice, setPractice] = useState<QuizRecord>(empty);
  /** Resposta que acabou de sair: mostra certo/errado até tocar em "Próxima". */
  const [shown, setShown] = useState<number | null>(null);
  const now = online ? barPresence.now() : Date.now();
  const day = dayKey(barPresence.now());
  const all = sanitizeQuiz(quizRaw, now);
  const mine = online ? (all[player] ?? empty()) : practice;
  const cur = currentQuestion(mine, now);
  const view = shown ?? cur;
  const q = qs && view !== null ? qs[view] : undefined;
  const e = view !== null ? mine[view] : undefined;
  const state = stateOf(e, now);

  useEffect(() => {
    let alive = true;
    void loadQuiz().then((data) => alive && setQs(questionsOfDay(data, day)));
    return () => {
      alive = false;
    };
  }, [day]);

  // Relógio da tela (o de verdade é a hora do servidor gravada ao abrir).
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 200);
    return () => window.clearInterval(t);
  }, []);

  const points = qs ? quizScore(mine, qs) : 0;
  const scored = scoreStore.tree[player]?.[safeKey(quizScoreKey(day))]?.s ?? 0;
  // Pontuação que não chegou ao placar (aba fechada no meio): manda de novo (o placar só sobe).
  useEffect(() => {
    if (online && points > scored) scoreStore.report(player, quizScoreKey(day), points);
  }, [online, points, scored, player, day]);

  // A pergunta aberta neste painel venceu sem resposta: mostra "Tempo!" (mesmo que a tela tenha demorado a
  // atualizar, como em aba de fundo).
  const openedHere = useRef<number | null>(null);
  const hereState = openedHere.current !== null ? stateOf(mine[openedHere.current], now) : null;
  useEffect(() => {
    if (openedHere.current === null || hereState !== 'tempo' || shown !== null) return;
    setShown(openedHere.current);
    openedHere.current = null;
    say('⏱ Tempo! A bola não caiu');
  }, [hereState, shown, say]);

  const save = async (i: number, rec: { o: number; k: number; a: number }, write: () => Promise<boolean>) => {
    if (!online) {
      setPractice((p) => p.map((x, j) => (j === i ? rec : x)));
      return true;
    }
    setBusy(true);
    const ok = await write();
    setBusy(false);
    if (!ok) say('Não gravou (sem rede?). Tente de novo');
    return ok;
  };

  /** Abre a pergunta da vez: o relógio só começa depois que o banco gravou a hora. */
  const open = async () => {
    if (cur === null || busy) return;
    setShown(null);
    if (await save(cur, { o: Date.now(), k: -1, a: 0 }, () => barPresence.quizOpen(cur))) openedHere.current = cur;
  };

  const answer = async (k: number) => {
    if (view === null || !q || !e || state !== 'aberta' || busy) return;
    const i = view;
    const ok = await save(i, { o: e.o, k, a: Date.now() }, () => barPresence.quizAnswer(i, k, e.o));
    if (!ok) return;
    openedHere.current = null;
    setShown(i);
    if (k === q.right) say(`🎱 Na caçapa! ${q.w}`);
    else say(`Errou: era ${q.w}`);
  };

  // Depois de gravar a resposta, os pontos e o placar.
  const lastAnswered = shown !== null ? mine[shown] : undefined;
  const lastPts = q && lastAnswered ? answerPoints(q, lastAnswered) : 0;

  const remain = e && state === 'aberta' ? Math.max(0, e.o + ANSWER_MS - now) : 0;
  const finished = cur === null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal bar-modal quiz" role="dialog" aria-modal="true" aria-labelledby="quiz-title" onClick={(ev) => ev.stopPropagation()}>
        <button type="button" className="icon-btn bar-modal-x" onClick={onClose} aria-label="Fechar">
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id="quiz-title" className="section-title">
          <span className="serif">Quiz geek da sinuca</span>
        </h2>
        {!online && <p className="bar-note">Sem o placar online: é treino, não vale ponto.</p>}
        <div className="quiz-progress" aria-label={`Pergunta ${Math.min(QUIZ_N, (view ?? QUIZ_N - 1) + 1)} de ${QUIZ_N}`}>
          {Array.from({ length: QUIZ_N }, (_, i) => {
            const s = stateOf(mine[i], now);
            const got = qs && s === 'respondida' ? answerPoints(qs[i], mine[i]) > 0 : false;
            return <i key={i} className={s === 'respondida' ? (got ? 'is-v' : 'is-x') : s === 'tempo' ? 'is-x' : i === view ? 'is-on' : ''} />;
          })}
        </div>

        {!qs ? (
          <p className="bar-note">Arrumando as bolas…</p>
        ) : finished && shown === null ? (
          <p className="daily-result" role="status">
            Fim de jogo: {rightCount(mine, qs)}/{QUIZ_N} na caçapa, {points} pontos. Volte amanhã depois das 6 h!
          </p>
        ) : q && (state === 'aberta' || shown !== null) ? (
          <div className="quiz-q">
            <p className="daily-clue">
              <span className="daily-theme">{q.theme}</span> {q.clue}
            </p>
            {state === 'aberta' && (
              <div className="quiz-clock" role="timer" aria-label={`${Math.ceil(remain / 1000)} segundos`}>
                <span style={{ width: `${(remain / ANSWER_MS) * 100}%` }} className={remain < 5000 ? 'is-late' : ''} />
                <b>{Math.ceil(remain / 1000)}s</b>
              </div>
            )}
            <div className="quiz-options">
              {q.options.map((w, k) => {
                const picked = e && e.k === k;
                const reveal = shown !== null;
                const cls = reveal ? (k === q.right ? ' is-v' : picked ? ' is-x' : ' is-off') : '';
                return (
                  <button key={w} type="button" className={`quiz-opt${cls}`} disabled={busy || state !== 'aberta'} onClick={() => void answer(k)}>
                    {w}
                  </button>
                );
              })}
            </div>
            {shown !== null && (
              <>
                <p className="daily-result" role="status">
                  {stateOf(lastAnswered, now) === 'tempo' ? 'Tempo esgotado: 0 pontos.' : lastPts ? `Na caçapa! +${lastPts} pontos.` : 'Bola fora: 0 pontos.'}
                </p>
                <button type="button" className="btn btn-primary quiz-next" onClick={() => (cur === null ? setShown(null) : void open())} disabled={busy}>
                  {cur === null ? 'Ver o resultado' : `Próxima (${cur + 1}/${QUIZ_N})`}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="quiz-q">
            <p className="bar-note">
              {QUIZ_N} perguntas por dia, {ANSWER_MS / 1000} s cada: escolha a palavra que bate com a dica. Acerto vale {RIGHT_POINTS}, mais até {SPEED_MAX}{' '}
              pela rapidez. Abriu, o relógio corre (fechar o painel não para).
            </p>
            <button type="button" className="btn btn-primary quiz-next" onClick={() => void open()} disabled={busy || cur === null}>
              {cur === 0 ? 'Quebrar o triângulo' : `Pergunta ${(cur ?? 0) + 1}/${QUIZ_N}`}
            </button>
          </div>
        )}

        <h3 className="bar-ficha-title">🎱 Ranking da mesa hoje</h3>
        <ul className="daily-crowd" aria-label="Como os amigos estão indo">
          {qs &&
            quizOrder(all, qs).map((id) => {
              const rec = all[id];
              return (
                <li key={id}>
                  <b style={{ color: PLAYER_BY_ID[id].color }}>{PLAYER_BY_ID[id].name}</b>
                  <span className="quiz-dots" aria-label={`${rightCount(rec, qs)} acertos`}>
                    {Array.from({ length: QUIZ_N }, (_, i) => {
                      const s = stateOf(rec?.[i], now);
                      return <i key={i} className={s === 'respondida' ? (answerPoints(qs[i], rec?.[i]) > 0 ? 'is-v' : 'is-x') : s === 'tempo' ? 'is-x' : s === 'aberta' ? 'is-on' : ''} />;
                    })}
                  </span>
                  <small>{rec ? `${quizScore(rec, qs)} pts` : 'não jogou'}</small>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
}
