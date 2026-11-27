import { useState, type CSSProperties, type FormEvent } from 'react';
import { ArrowRight, Beer, Hash, Shuffle, Trophy } from 'lucide-react';
import type { DifficultyLevel } from '../types/crossword';
import { ALL_ENTRIES, ALL_THEME_ID, THEME_PACKS } from '../data/catalog';
import { DifficultyPicker } from './DifficultyPicker';
import { ThemeIcon } from './ThemeIcon';
import type { StoredState } from '../utils/storage';
import { parseShareCode } from '../utils/format';
import { NeonSign } from '../arena/NeonSign';
import { PlayerPicker } from '../arena/PlayerPicker';
import type { PlayerId } from '../arena/sprites';

interface Props {
  difficulty: DifficultyLevel;
  onDifficulty: (d: DifficultyLevel) => void;
  stored: StoredState;
  error: string | null;
  onPlay: (themeId: string, difficulty: DifficultyLevel, seed?: string) => void;
  onError: (msg: string | null) => void;
  player: PlayerId | null;
  onPlayer: (id: PlayerId) => void;
  onEnterBar: () => void;
}

export function Studio({
  difficulty,
  onDifficulty,
  stored,
  error,
  onPlay,
  onError,
  player,
  onPlayer,
  onEnterBar,
}: Props) {
  const [code, setCode] = useState('');
  const totalWins = Object.values(stored.wins).reduce((a, b) => a + b, 0);
  const mixedWins = stored.wins[ALL_THEME_ID] ?? 0;

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseShareCode(code, { difficulty, themeId: ALL_THEME_ID });
    if (!parsed) {
      onError('Código inválido. Use algo como LEX-7K2Q ou LEX-7K2Q.M.astronomia.');
      return;
    }
    onError(null);
    onPlay(parsed.themeId, parsed.difficulty, parsed.seed);
  };

  return (
    <main className="studio">
      <section className="hero">
        <NeonSign />
        <p className="hero-lede">
          Palavras cruzadas de games, geek e cultura pop. Cada palavra certa vira ponto na lousa do bar — e ponto vira
          sopapo no balcão.
        </p>
        <button type="button" className="btn btn-primary btn-lg bar-enter" onClick={onEnterBar}>
          <Beer size={18} aria-hidden="true" /> Entrar no bar
        </button>
      </section>

      <section className="panel-section" aria-labelledby="sec-player">
        <h2 id="sec-player" className="section-title">
          <span className="step mono">01</span>
          <span className="serif">Quem está jogando?</span>
        </h2>
        <PlayerPicker value={player} onPick={onPlayer} />
      </section>

      <section className="panel-section" aria-labelledby="sec-level">
        <h2 id="sec-level" className="section-title">
          <span className="step mono">02</span>
          <span className="serif">Nível da rodada</span>
        </h2>
        <DifficultyPicker value={difficulty} onChange={onDifficulty} />
      </section>

      <section className="panel-section" aria-labelledby="sec-special">
        <h2 id="sec-special" className="section-title">
          <span className="step mono">03</span>
          <span className="serif">Desafios especiais</span>
        </h2>
        <div className="special-row">
          <button type="button" className="mixed-card" onClick={() => onPlay(ALL_THEME_ID, difficulty)}>
            <span className="mixed-glow" aria-hidden="true" />
            <span className="mixed-icon">
              <Shuffle size={26} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <span className="mixed-body">
              <span className="mixed-kicker mono">DESAFIO MISTO</span>
              <span className="mixed-title serif">Todos os temas, uma só grade</span>
              <span className="mixed-desc">
                Palavras de {THEME_PACKS.length} áreas do conhecimento misturadas. Para quem gosta de surpresa.
              </span>
              <span className="mixed-foot mono">
                <span>{ALL_ENTRIES.length} palavras</span>
                {mixedWins > 0 && (
                  <span className="wins-chip">
                    <Trophy size={12} aria-hidden="true" /> {mixedWins}
                  </span>
                )}
              </span>
            </span>
            <ArrowRight className="mixed-arrow" size={22} aria-hidden="true" />
          </button>

          <form className="seed-card" onSubmit={submitCode}>
            <span className="seed-kicker mono">
              <Hash size={13} aria-hidden="true" /> JOGAR POR CÓDIGO
            </span>
            <label htmlFor="seed-input" className="seed-title serif">
              Repita ou compartilhe um tabuleiro
            </label>
            <div className="seed-field">
              <input
                id="seed-input"
                className="mono"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) onError(null);
                }}
                placeholder="LEX-7K2Q.M.games-classicos"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby="seed-help"
                aria-invalid={error ? true : undefined}
              />
              <button type="submit" className="btn btn-primary" disabled={!code.trim()}>
                Jogar
              </button>
            </div>
            <p id="seed-help" className={`seed-help${error ? ' is-error' : ''}`} role={error ? 'alert' : undefined}>
              {error ??
                'Cole o código completo (seed·nível·tema) para o mesmo tabuleiro. Só a seed usa o nível atual no Desafio Misto.'}
            </p>
          </form>
        </div>
      </section>

      <section className="panel-section" aria-labelledby="sec-themes">
        <h2 id="sec-themes" className="section-title">
          <span className="step mono">04</span>
          <span className="serif">Escolha o tema</span>
        </h2>
        <div className="theme-grid">
          {THEME_PACKS.map((pack) => {
            const wins = stored.wins[pack.id] ?? 0;
            return (
              <button
                key={pack.id}
                type="button"
                className="theme-card"
                style={{ '--tc': pack.color } as CSSProperties}
                onClick={() => onPlay(pack.id, difficulty)}
              >
                <span className="theme-icon">
                  <ThemeIcon name={pack.icon} size={24} />
                </span>
                <span className="theme-name serif">{pack.name}</span>
                <span className="theme-desc">{pack.description}</span>
                <span className="theme-foot mono">
                  <span>{pack.entries.length} palavras</span>
                  <span className={`wins-chip${wins ? ' has' : ''}`} title="Tabuleiros vencidos neste tema">
                    <Trophy size={12} aria-hidden="true" /> {wins}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {THEME_PACKS.length === 0 && <p className="empty-note">Nenhum tema encontrado em src/data/packs.</p>}
      </section>

      <footer className="app-footer">
        <span className="serif">Boteco do Squad</span>
        <span>
          {THEME_PACKS.length} temas · {ALL_ENTRIES.length} palavras · {totalWins} vitórias neste aparelho. Beba água.
        </span>
      </footer>
    </main>
  );
}
