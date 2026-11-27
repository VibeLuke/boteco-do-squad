import { Lightbulb, Grid3x3, Layers, Zap } from 'lucide-react';
import type { DifficultyLevel } from '../types/crossword';
import { DIFFICULTY_CONFIG } from '../engine/difficulty';
import { formatMultiplier } from '../utils/format';

interface Props {
  value: DifficultyLevel;
  onChange: (d: DifficultyLevel) => void;
}

const LEVELS: DifficultyLevel[] = ['easy', 'medium', 'hard'];

export function DifficultyPicker({ value, onChange }: Props) {
  return (
    <div className="difficulty" role="radiogroup" aria-label="Nível de dificuldade">
      {LEVELS.map((level, i) => {
        const cfg = DIFFICULTY_CONFIG[level];
        const on = value === level;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={on}
            className={`diff-card diff-${level}${on ? ' is-on' : ''}`}
            onClick={() => onChange(level)}
          >
            <span className="diff-top">
              <span className="diff-pips" aria-hidden="true">
                {[0, 1, 2].map((p) => (
                  <i key={p} className={p <= i ? 'on' : ''} />
                ))}
              </span>
              <span className="diff-mult mono" title="Multiplicador de pontos">
                <Zap size={12} aria-hidden="true" />
                {formatMultiplier(cfg.scoreMultiplier)}
              </span>
            </span>
            <span className="diff-label serif">{cfg.label}</span>
            <span className="diff-grid mono">
              <Grid3x3 size={14} aria-hidden="true" />
              até {cfg.maxRows}×{cfg.maxCols}
            </span>
            <span className="diff-meta">
              <span>
                <Layers size={13} aria-hidden="true" /> {cfg.minWords}–{cfg.maxWords} palavras
              </span>
              <span>
                <Lightbulb size={13} aria-hidden="true" /> {cfg.freeHints} {cfg.freeHints === 1 ? 'dica grátis' : 'dicas grátis'}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
