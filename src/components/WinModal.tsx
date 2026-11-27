import { useMemo, type CSSProperties } from 'react';
import { Award, CheckCheck, Clock, Copy, Lightbulb, RotateCcw, Sparkles, Star, Target } from 'lucide-react';
import type { GameApi } from '../utils/useGame';
import { formatTime } from '../utils/format';

interface Props {
  game: GameApi;
  code: string;
  themeName: string;
  difficultyLabel: string;
  newRecord: boolean;
  onPlayAnother: () => void;
  onClose: () => void;
  onStudio: () => void;
  onCopy: () => void;
  /** Tabuleiro já pontuado antes: esta partida não somou. */
  practice?: boolean;
  /** Palavras repetidas (valeram 0). */
  repeats?: number;
}

const COLORS = ['#e0a93a', '#1f9a78', '#d9534f', '#3cc6b7', '#8b6fd6', '#f2c14e'];

export function WinModal({
  game,
  code,
  themeName,
  difficultyLabel,
  newRecord,
  onPlayAnother,
  onClose,
  onStudio,
  onCopy,
  practice = false,
  repeats = 0,
}: Props) {
  const { state, score, totalWords, totalCells, timeBonus } = game;
  const pieces = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => ({
        left: (i * 37 + Math.random() * 18) % 100,
        delay: Math.random() * 0.9,
        dur: 2.4 + Math.random() * 2.2,
        drift: (Math.random() - 0.5) * 220,
        rot: Math.random() * 720 - 360,
        color: COLORS[i % COLORS.length],
        w: 6 + Math.random() * 7,
        h: 9 + Math.random() * 9,
      })),
    [],
  );

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="confetti" aria-hidden="true">
        {pieces.map((p, i) => (
          <i
            key={i}
            style={
              {
                left: `${p.left}%`,
                width: p.w,
                height: p.h,
                background: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.dur}s`,
                '--drift': `${p.drift}px`,
                '--rot': `${p.rot}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="win-title">
        <div className="modal-seal" aria-hidden="true">
          <Award size={34} strokeWidth={1.6} />
        </div>
        <p className="eyebrow modal-eyebrow">
          <Sparkles size={13} aria-hidden="true" /> {themeName} · {difficultyLabel}
        </p>
        <h2 id="win-title" className="serif modal-title">
          Tabuleiro completo!
        </h2>
        {newRecord && (
          <p className="record-badge">
            <Star size={13} aria-hidden="true" /> Novo recorde neste tema
          </p>
        )}
        <div className="score-big">
          <span className="mono">{score.toLocaleString('pt-BR')}</span>
          <small>pontos</small>
        </div>
        <dl className="stats-grid">
          <div>
            <dt>
              <Clock size={14} aria-hidden="true" /> Tempo
            </dt>
            <dd className="mono">{formatTime(state.elapsed)}</dd>
          </div>
          <div>
            <dt>
              <Target size={14} aria-hidden="true" /> Palavras
            </dt>
            <dd className="mono">
              {totalWords}/{totalWords}
            </dd>
          </div>
          <div>
            <dt>
              <Lightbulb size={14} aria-hidden="true" /> Dicas usadas
            </dt>
            <dd className="mono">{state.hintsUsed}</dd>
          </div>
          <div>
            <dt>
              <CheckCheck size={14} aria-hidden="true" /> Verificações
            </dt>
            <dd className="mono">{state.checks}</dd>
          </div>
        </dl>
        <p className="modal-note">
          {totalCells} letras · bônus de tempo <b className="mono">+{timeBonus}</b> · multiplicador{' '}
          <b className="mono">×{String(game.multiplier).replace('.', ',')}</b>
        </p>
        {practice && <p className="modal-note is-practice">Treino: este tabuleiro já estava no placar, então não somou.</p>}
        {!practice && repeats > 0 && (
          <p className="modal-note">
            {repeats === 1 ? '1 palavra repetida valeu 0' : `${repeats} palavras repetidas valeram 0`} e o bônus de tempo
            contou só as palavras novas.
          </p>
        )}
        <button type="button" className="code-chip mono" onClick={onCopy} title="Copiar código para repetir este tabuleiro">
          {code}
          <Copy size={13} aria-hidden="true" />
        </button>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={onPlayAnother} autoFocus>
            <RotateCcw size={16} aria-hidden="true" /> Jogar Outro
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Ver tabuleiro
          </button>
          <button type="button" className="btn btn-ghost" onClick={onStudio}>
            Balcão
          </button>
        </div>
      </div>
    </div>
  );
}
