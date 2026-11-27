import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowLeftRight, ArrowRight, ChevronLeft, ChevronRight, Clock, Hash, Lightbulb, Target, Trophy } from 'lucide-react';
import type { CrosswordPuzzle, DifficultyLevel } from '../types/crossword';
import { DIFFICULTY_CONFIG } from '../engine/difficulty';
import { ALL_PACK, THEME_PACKS, getTheme } from '../data/catalog';
import { useGame } from '../utils/useGame';
import { wordAt } from '../utils/puzzle';
import { buildShareCode, copyText, formatTime } from '../utils/format';
import { Grid } from './Grid';
import { CluesPanel } from './CluesPanel';
import { Toolbar } from './Toolbar';
import { VirtualKeyboard } from './VirtualKeyboard';
import { WinModal } from './WinModal';
import { ThemeIcon } from './ThemeIcon';
import { Arena } from '../arena/Arena';
import { useConnStatus, useScoreTree, useStandings } from '../arena/useScoreboard';
import { safeKey, scoreStore, type Period } from '../arena/scoreStore';
import type { PlayerId } from '../arena/sprites';
import { seenFor } from '../arena/boardWords';
import { decideScoring } from '../arena/history';
import { encodeProgress, loadProgress, saveProgress } from '../utils/progress';
import type { PlacedWord } from '../types/crossword';

/** Todos os temas, com o misto primeiro (o seletor da tela de jogo). */
const TEMAS = [ALL_PACK, ...THEME_PACKS];

/** wait = conferindo o placar; on = soma; off = treino (tabuleiro já pontuado e sem progresso neste aparelho). */
export type ScoringMode = 'wait' | 'on' | 'off';

function isTouch(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

export interface WinInfo {
  themeId: string;
  code: string;
  score: number;
  elapsed: number;
}

interface Props {
  puzzle: CrosswordPuzzle;
  themeId: string;
  soundOn: boolean;
  onSound: () => void;
  keyboardOn: boolean;
  onKeyboard: () => void;
  onNew: (themeId: string, difficulty: DifficultyLevel) => void;
  onStudio: () => void;
  onWin: (info: WinInfo) => void;
  prevBestScore: number | undefined;
  player: PlayerId | null;
  period: Period;
}

export function GameScreen({
  puzzle,
  themeId,
  soundOn,
  onSound,
  keyboardOn,
  onKeyboard,
  onNew,
  onStudio,
  onWin,
  prevBestScore,
  player,
  period,
}: Props) {
  const code = buildShareCode(puzzle.seed, puzzle.difficulty, themeId);
  const boardKey = safeKey(code);
  const tree = useScoreTree();
  const conn = useConnStatus();

  // Progresso salvo deste jogador neste tabuleiro (lido uma vez: o componente remonta a cada tabuleiro).
  const [saved] = useState(() => (player ? loadProgress(player, code) : null));
  const [mode, setMode] = useState<ScoringMode>(() => (saved ? decideScoring(saved.scoring, false, 'live') : 'wait'));
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set(saved?.seen ?? []));

  // Sem progresso salvo: só decide depois de ver o placar (senão um celular recém-aberto escaparia da trava).
  useEffect(() => {
    if (mode !== 'wait' || !player) return;
    const next = decideScoring(null, !!tree[player]?.[boardKey], conn);
    if (next === 'wait') return;
    if (next === 'on') setSeen(seenFor(player, themeId, boardKey));
    setMode(next);
  }, [mode, player, tree, conn, boardKey, themeId]);

  const game = useGame(puzzle, { seen, initial: saved });
  const { state, active, index } = game;
  const cfg = DIFFICULTY_CONFIG[puzzle.difficulty];
  const theme = getTheme(themeId);

  const { rows, hit } = useStandings(period);

  // Pontos sobem para o placar enquanto se joga (o mesmo tabuleiro nunca soma duas vezes).
  useEffect(() => {
    if (!player || mode !== 'on') return;
    const t = window.setTimeout(() => scoreStore.report(player, code, game.score), state.status === 'won' ? 0 : 450);
    return () => window.clearTimeout(t);
  }, [player, mode, code, game.score, state.status]);

  // Guarda o progresso para retomar (recarregar a página continua a partida, não recomeça do zero).
  const progressRef = useRef<() => void>(() => {});
  progressRef.current = () => {
    if (!player || mode === 'wait') return;
    saveProgress(player, code, encodeProgress(state, mode === 'on', seen));
  };
  useEffect(() => {
    const t = window.setTimeout(() => progressRef.current(), 600);
    return () => window.clearTimeout(t);
  }, [state, mode, seen]);
  useEffect(() => {
    const flush = () => progressRef.current();
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Teclado do próprio celular (campo de texto sobre a casa ativa) quando o teclado do jogo está desligado.
  const nativeInput = !keyboardOn && isTouch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [typing, setTyping] = useState(false);
  const focusInput = useCallback(() => {
    if (nativeInput) inputRef.current?.focus();
  }, [nativeInput]);
  // Botões de pista não roubam o foco do campo (o teclado do celular continua aberto).
  const keepFocus = (e: React.MouseEvent) => {
    if (nativeInput && typing) e.preventDefault();
  };
  const gameSelectClue = game.selectClue;
  const selectClue = useCallback(
    (w: PlacedWord) => {
      gameSelectClue(w);
      focusInput();
    },
    [gameSelectClue, focusInput],
  );
  const repeats = game.repeatKeys.size;
  const repeatWords = useMemo(() => (mode === 'on' ? game.repeatKeys : new Set<string>()), [mode, game.repeatKeys]);

  const [toast, setToast] = useState<{ msg: string; n: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [newRecord, setNewRecord] = useState(false);
  const bestAtStart = useRef(prevBestScore);
  const toastTimer = useRef<number | undefined>(undefined);
  const copyTimer = useRef<number | undefined>(undefined);

  const say = useCallback((msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ msg, n: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
      window.clearTimeout(copyTimer.current);
    },
    [],
  );

  // Vitória: registra e abre o modal após a última letra "assentar".
  const won = state.status === 'won';
  const reported = useRef(saved?.status === 'won');
  useEffect(() => {
    if (!won || reported.current) return;
    reported.current = true;
    setNewRecord(game.score > 0 && (bestAtStart.current === undefined || game.score > bestAtStart.current));
    onWin({ themeId, code, score: game.score, elapsed: state.elapsed });
    const t = window.setTimeout(() => setShowWin(true), 750);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  // Resultado de "Verificar Erros".
  const check = state.checkResult;
  useEffect(() => {
    if (!check) return;
    if (check.wrong > 0) say(`${check.wrong} ${check.wrong === 1 ? 'letra errada' : 'letras erradas'} — destacadas em vermelho.`);
    else if (check.empty > 0) say('Tudo certo até aqui. Continue!');
    else say('Sem erros!');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check?.nonce]);

  // Teclado físico.
  const { type, backspace, clearCell, move, toggleDir, tab } = game;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (showWin) return;
      const onButton = t?.tagName === 'BUTTON';
      switch (e.key) {
        case 'Backspace':
          e.preventDefault();
          backspace();
          return;
        case 'Delete':
          e.preventDefault();
          clearCell();
          return;
        case 'ArrowLeft':
          e.preventDefault();
          move(0, -1);
          return;
        case 'ArrowRight':
          e.preventDefault();
          move(0, 1);
          return;
        case 'ArrowUp':
          e.preventDefault();
          move(-1, 0);
          return;
        case 'ArrowDown':
          e.preventDefault();
          move(1, 0);
          return;
        case 'Tab':
          e.preventDefault();
          tab(e.shiftKey ? -1 : 1);
          return;
        case ' ':
        case 'Enter':
          if (onButton) return;
          e.preventDefault();
          toggleDir();
          return;
        default:
          if (e.key.length === 1) {
            e.preventDefault();
            type(e.key);
          }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [backspace, clearCell, move, tab, toggleDir, type, showWin]);

  const onCopy = useCallback(async () => {
    const ok = await copyText(code);
    say(ok ? `Código ${code} copiado.` : 'Não foi possível copiar. Selecione o código manualmente.');
    if (ok) {
      setCopied(true);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
    }
  }, [code, say]);

  const cross = active
    ? wordAt(puzzle, index, state.r, state.c, active.direction === 'across' ? 'down' : 'across')
    : undefined;
  const pct = game.totalWords ? Math.round((game.doneCount / game.totalWords) * 100) : 0;
  const DirIcon = active?.direction === 'down' ? ArrowDown : ArrowRight;
  const accent = theme?.color ?? '#d97706';

  return (
    <main className="game" style={{ '--tc': accent } as CSSProperties}>
      <div className="game-meta">
        <span className="meta-chip theme-chip">
          <ThemeIcon name={theme?.icon} size={15} />
          {puzzle.themeName}
        </span>
        <span className={`meta-chip diff-chip diff-${puzzle.difficulty}`}>
          {cfg.label} · {puzzle.cols}×{puzzle.rows}
        </span>
        <button type="button" className="meta-chip code-chip-btn mono" onClick={onCopy} title="Copiar código do tabuleiro">
          <Hash size={13} aria-hidden="true" />
          {code}
        </button>
        <label className="meta-chip theme-pick">
          <span>Trocar tema</span>
          <select value={themeId} onChange={(e) => e.target.value !== themeId && onNew(e.target.value, puzzle.difficulty)}>
            {TEMAS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {mode === 'off' && (
        <p className="play-note is-practice" role="status">
          Você já pontuou neste tabuleiro. Pode jogar de novo, mas é treino: não soma no placar.
        </p>
      )}
      {mode === 'on' && repeats > 0 && (
        <p className="play-note" role="status">
          {repeats === 1 ? '1 palavra você já viu' : `${repeats} palavras você já viu`} em outro tabuleiro: valem 0 e estão
          marcadas nas pistas.
        </p>
      )}

      <div className="game-layout">
        <nav className="theme-rail" aria-label="Trocar tema">
          <h2 className="theme-rail-title">Temas</h2>
          <ul>
            {TEMAS.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`theme-opt${t.id === themeId ? ' is-on' : ''}`}
                  aria-current={t.id === themeId ? 'true' : undefined}
                  style={{ '--tc': t.color } as CSSProperties}
                  onClick={() => t.id !== themeId && onNew(t.id, puzzle.difficulty)}
                >
                  <ThemeIcon name={t.icon} size={15} />
                  <span>{t.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="theme-rail-note">Abre um tabuleiro novo no mesmo nível. O que você já fez neste fica salvo.</p>
        </nav>
        <div className="arena-slot">
          <Arena rows={rows} hit={hit} me={player} compact label="Placar da briga ao vivo" />
        </div>
        <section className="board-col" aria-label="Área de jogo">
          <div className="stats-bar" role="status" aria-live="off">
            <div className="stat">
              <Clock size={15} aria-hidden="true" />
              <span className="stat-val mono">{formatTime(state.elapsed)}</span>
              <span className="stat-key">tempo</span>
            </div>
            <div className="stat stat-progress">
              <Target size={15} aria-hidden="true" />
              <span className="stat-val mono">
                {game.doneCount}/{game.totalWords}
              </span>
              <span className="stat-key">palavras</span>
              <span className="progress" aria-hidden="true">
                <i style={{ width: `${pct}%` }} />
              </span>
            </div>
            <div className="stat" title={game.overHints > 0 ? 'Dicas além das grátis custam 20 pts cada' : 'Dicas grátis restantes'}>
              <Lightbulb size={15} aria-hidden="true" />
              <span className="stat-val mono">{game.hintsLeft}</span>
              <span className="stat-key">dicas</span>
            </div>
            <div className="stat stat-score">
              <Trophy size={15} aria-hidden="true" />
              <span className="stat-val mono">{game.score.toLocaleString('pt-BR')}</span>
              <span className="stat-key">{mode === 'off' ? 'treino' : mode === 'wait' ? 'conferindo' : 'pontos'}</span>
            </div>
          </div>

          <div className="active-clue" aria-live="polite">
            <button type="button" className="icon-btn" onMouseDown={keepFocus} onClick={() => tab(-1)} aria-label="Pista anterior" title="Pista anterior (Shift+Tab)">
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <div className="active-body">
              {active ? (
                <>
                  <span className="dir-chip mono">
                    <DirIcon size={13} aria-hidden="true" />
                    {active.number} {active.direction === 'across' ? 'Horizontal' : 'Vertical'}
                  </span>
                  <span className="active-text">{active.clue}</span>
                  <span className="active-len mono">{active.word.length} letras</span>
                </>
              ) : (
                <span className="active-text">Selecione uma célula para começar.</span>
              )}
            </div>
            <button type="button" className="icon-btn" onMouseDown={keepFocus} onClick={toggleDir} aria-label="Alternar direção" title="Alternar direção (Espaço)">
              <ArrowLeftRight size={17} aria-hidden="true" />
            </button>
            <button type="button" className="icon-btn" onMouseDown={keepFocus} onClick={() => tab(1)} aria-label="Próxima pista" title="Próxima pista (Tab)">
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          <Grid game={game} nativeInput={nativeInput} inputRef={inputRef} onTyping={setTyping} />
          {nativeInput && !typing && !won && <p className="native-hint">Toque numa casa para abrir o teclado do celular.</p>}

          <Toolbar
            game={game}
            soundOn={soundOn}
            onSound={onSound}
            keyboardOn={keyboardOn}
            onKeyboard={onKeyboard}
            onNew={() => onNew(themeId, puzzle.difficulty)}
            onCopy={onCopy}
            copied={copied}
          />

          {keyboardOn && <VirtualKeyboard onKey={type} onBackspace={backspace} onToggle={toggleDir} />}
        </section>

        <aside className="clues-col" aria-label="Pistas">
          <CluesPanel
            puzzle={puzzle}
            active={active}
            cross={cross}
            doneWords={game.doneWords}
            repeatWords={repeatWords}
            onSelect={selectClue}
          />
        </aside>
      </div>

      {won && !showWin && (
        <div className="won-banner">
          <Trophy size={16} aria-hidden="true" /> Completo! <button type="button" className="link-btn" onClick={() => setShowWin(true)}>Ver resultado</button>
        </div>
      )}

      {won && showWin && (
        <WinModal
          game={game}
          code={code}
          themeName={puzzle.themeName}
          difficultyLabel={cfg.label}
          newRecord={newRecord}
          onPlayAnother={() => onNew(themeId, puzzle.difficulty)}
          onClose={() => setShowWin(false)}
          onStudio={onStudio}
          onCopy={onCopy}
          practice={mode === 'off'}
          repeats={mode === 'on' ? repeats : 0}
        />
      )}

      <div className={`toast${toast ? ' is-on' : ''}`} role="status" aria-live="polite">
        {toast?.msg}
      </div>
    </main>
  );
}
