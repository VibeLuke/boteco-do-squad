import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CrosswordPuzzle, DifficultyLevel } from './types/crossword';
import { ALL_THEME_ID, getTheme } from './data/catalog';
import { buildPuzzle } from './utils/buildPuzzle';
import { freshPuzzle } from './arena/boardWords';
import { Header } from './components/Header';
import { Studio } from './components/Studio';
import { GameScreen, type WinInfo } from './components/GameScreen';
import { loadState, saveState, type StoredState, type VisualTheme } from './utils/storage';
import { setSoundEnabled } from './utils/audio';
import { buildShareCode, parseShareCode } from './utils/format';
import { PlayerPicker } from './arena/PlayerPicker';
import { loadPlayer, savePlayer } from './arena/useScoreboard';
import type { PlayerId } from './arena/sprites';
import type { Period } from './arena/scoreStore';

// O Bar Vivo só é baixado quando alguém entra nele: as cruzadas continuam leves. Fatia 6: o bar antigo saiu
// (pedido do dono, 26/11); tudo mora no Bar Vivo.
const VivoScreen = lazy(() => import('./vivo/VivoScreen'));
type QualBar = 'vivo';

interface PendingPlay {
  themeId: string;
  difficulty: DifficultyLevel;
  seed?: string;
}

const PERIOD_KEY = 'cruzadabotecos.period';
function loadPeriod(): Period {
  try {
    const v = localStorage.getItem(PERIOD_KEY);
    return v === 'today' || v === 'week' || v === 'all' ? v : 'all';
  } catch {
    return 'all';
  }
}

interface ActiveGame {
  puzzle: CrosswordPuzzle;
  themeId: string;
  nonce: number;
}

function setHash(code: string | null): void {
  try {
    const base = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', code ? `${base}#${code}` : base);
  } catch {
    /* ambientes sem History API */
  }
}

export default function App() {
  const [stored, setStored] = useState<StoredState>(() => loadState());
  const [visual, setVisual] = useState<VisualTheme>(() =>
    document.documentElement.getAttribute('data-theme') === 'ink' ? 'ink' : 'paper',
  );
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Teclado do jogo fica desligado por padrão: no celular entra o teclado do próprio aparelho.
  const [keyboardOn, setKeyboardOn] = useState<boolean>(() => loadState().keyboard ?? false);
  const nonce = useRef(0);
  const [player, setPlayer] = useState<PlayerId | null>(() => loadPlayer());
  const [picker, setPicker] = useState<{ pending: PendingPlay | null; bar?: boolean } | null>(null);
  // O Bar Vivo é a tela inicial de quem já escolheu quem é (link de tabuleiro compartilhado abre o tabuleiro).
  const [inBar, setInBarRaw] = useState<QualBar | false>(() => (loadPlayer() && !window.location.hash.replace(/^#/, '') ? 'vivo' : false));
  const lastBar = useRef<QualBar>('vivo');
  const setInBar = useCallback((v: QualBar | boolean) => {
    if (v === true) v = lastBar.current;
    if (v) lastBar.current = v;
    setInBarRaw(v);
  }, []);
  // Partida aberta numa mesa do bar: ao sair dela, volta para o bar.
  const fromBar = useRef(false);
  const [period, setPeriodState] = useState<Period>(() => loadPeriod());
  const setPeriod = (p: Period) => {
    setPeriodState(p);
    try {
      localStorage.setItem(PERIOD_KEY, p);
    } catch {
      /* ignora */
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', visual);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', visual === 'ink' ? '#140f1f' : '#f3e3c3');
  }, [visual]);

  useEffect(() => {
    setSoundEnabled(stored.sound);
  }, [stored.sound]);

  const persist = useCallback((patch: (s: StoredState) => StoredState) => {
    setStored((prev) => {
      const next = patch(prev);
      saveState(next);
      return next;
    });
  }, []);

  const playerRef = useRef(player);
  playerRef.current = player;

  const start = useCallback(
    (themeId: string, difficulty: DifficultyLevel, seed?: string) => {
      try {
        // Código compartilhado abre exatamente aquele tabuleiro; tabuleiro novo evita palavras que o jogador já viu.
        const puzzle: CrosswordPuzzle = seed
          ? buildPuzzle(themeId, difficulty, seed)
          : freshPuzzle(playerRef.current, themeId, difficulty);
        nonce.current += 1;
        setError(null);
        setGame({ puzzle, themeId, nonce: nonce.current });
        setHash(buildShareCode(puzzle.seed, puzzle.difficulty, themeId));
        persist((s) => ({ ...s, difficulty }));
        window.scrollTo({ top: 0 });
      } catch (err) {
        console.error(err);
        setError(
          getTheme(themeId)
            ? 'Não foi possível montar este tabuleiro. Tente outra seed ou outro nível.'
            : `Tema "${themeId}" não existe neste catálogo.`,
        );
        setGame(null);
      }
    },
    [persist],
  );

  // Ninguém escolhido neste aparelho: pergunta quem joga antes de abrir o tabuleiro.
  const play = useCallback(
    (themeId: string, difficulty: DifficultyLevel, seed?: string) => {
      if (!playerRef.current) {
        setPicker({ pending: { themeId, difficulty, seed } });
        return;
      }
      start(themeId, difficulty, seed);
    },
    [start],
  );

  const choosePlayer = useCallback(
    (id: PlayerId) => {
      const changed = id !== playerRef.current;
      savePlayer(id);
      setPlayer(id);
      playerRef.current = id;
      const pending = picker?.pending;
      const toBar = picker?.bar;
      setPicker(null);
      if (toBar) setInBar('vivo');
      else if (pending) start(pending.themeId, pending.difficulty, pending.seed);
      // Trocar de jogador no meio da partida abre um tabuleiro novo: o próximo não herda as respostas que acabou de ver.
      else if (changed && game) start(game.themeId, game.puzzle.difficulty);
    },
    [picker, start, game],
  );

  // Abre tabuleiros compartilhados via #CÓDIGO.
  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    const parsed = parseShareCode(raw, { difficulty: stored.difficulty, themeId: ALL_THEME_ID });
    if (parsed) play(parsed.themeId, parsed.difficulty, parsed.seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterBar = useCallback(() => {
    if (!playerRef.current) {
      setPicker({ pending: null, bar: true });
      return;
    }
    setGame(null);
    setHash(null);
    setInBar('vivo');
  }, []);

  const toStudio = useCallback(() => {
    if (fromBar.current && game) {
      fromBar.current = false;
      setGame(null);
      setHash(null);
      setInBar(true);
      window.scrollTo({ top: 0 });
      return;
    }
    fromBar.current = false;
    setInBar(false);
    setGame(null);
    setHash(null);
    window.scrollTo({ top: 0 });
  }, [game]);

  const playFromBar = useCallback(
    (themeId: string, difficulty: DifficultyLevel) => {
      fromBar.current = true;
      setInBar(false);
      start(themeId, difficulty);
    },
    [start],
  );

  const onWin = useCallback(
    (info: WinInfo) => {
      persist((s) => {
        const already = s.wonCodes.includes(info.code);
        const wins = { ...s.wins };
        if (!already) wins[info.themeId] = (wins[info.themeId] ?? 0) + 1;
        const best = { ...s.best };
        if (info.score > (best[info.themeId] ?? -1)) best[info.themeId] = info.score;
        const bestTime = { ...s.bestTime };
        if (info.elapsed < (bestTime[info.themeId] ?? Infinity)) bestTime[info.themeId] = info.elapsed;
        return { ...s, wins, best, bestTime, wonCodes: already ? s.wonCodes : [...s.wonCodes, info.code].slice(-400) };
      });
    },
    [persist],
  );

  const prevBest = useMemo(
    () => (game ? stored.best[game.themeId] : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game?.nonce],
  );

  const changeVisual = (v: VisualTheme) => {
    setVisual(v);
    persist((s) => ({ ...s, visual: v }));
  };

  return (
    <div className="app">
      <Header
        view={game || inBar ? 'game' : 'studio'}
        visual={visual}
        onVisual={changeVisual}
        onHome={toStudio}
        player={player}
        onPlayer={() => setPicker({ pending: null })}
      />
      {inBar && player ? (
        <Suspense fallback={<main className="bar-loading">Abrindo o bar…</main>}>
          <VivoScreen player={player} onExit={toStudio} onPlay={playFromBar} period={period} onPeriod={setPeriod} />
        </Suspense>
      ) : game ? (
        <GameScreen
          key={`${game.nonce}-${player ?? ''}`}
          puzzle={game.puzzle}
          themeId={game.themeId}
          soundOn={stored.sound}
          onSound={() => persist((s) => ({ ...s, sound: !s.sound }))}
          keyboardOn={keyboardOn}
          onKeyboard={() => {
            const next = !keyboardOn;
            setKeyboardOn(next);
            persist((s) => ({ ...s, keyboard: next }));
          }}
          onNew={(themeId, difficulty) => play(themeId, difficulty)}
          onStudio={toStudio}
          onWin={onWin}
          prevBestScore={prevBest}
          player={player}
          period={period}
        />
      ) : (
        <Studio
          difficulty={stored.difficulty}
          onDifficulty={(d) => persist((s) => ({ ...s, difficulty: d }))}
          stored={stored}
          error={error}
          onPlay={play}
          onError={setError}
          player={player}
          onPlayer={choosePlayer}
          onEnterBar={enterBar}
        />
      )}
      {picker && <PlayerPicker modal value={player} onPick={choosePlayer} onClose={() => setPicker(null)} />}
    </div>
  );
}
