import { useEffect, useRef, type CSSProperties } from 'react';
import { Sprite } from './Sprite';
import { PLAYERS, type PlayerId } from './sprites';

interface Props {
  value: PlayerId | null;
  onPick: (id: PlayerId) => void;
  /** Modal: aparece antes de abrir um tabuleiro quando ninguém foi escolhido. */
  modal?: boolean;
  onClose?: () => void;
}

function Cards({ value, onPick }: Pick<Props, 'value' | 'onPick'>) {
  return (
    <div className="picker" role="radiogroup" aria-label="Quem está jogando?">
      {PLAYERS.map((p) => {
        const on = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            className={`pick-card${on ? ' is-on' : ''}`}
            style={{ '--pc': p.color } as CSSProperties}
            onClick={() => onPick(p.id)}
          >
            <span className="pick-sprite">
              <Sprite id={p.id} pose={on ? 'win' : 'idle'} scale={3} />
            </span>
            <span className="pick-name">{p.name}</span>
            <span className="pick-tag">{on ? 'Sou eu!' : p.tagline}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PlayerPicker({ value, onPick, modal = false, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!modal) return;
    ref.current?.querySelector<HTMLButtonElement>('.pick-card')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, onClose]);

  if (!modal) return <Cards value={value} onPick={onPick} />;
  return (
    <div className="modal-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal picker-modal" role="dialog" aria-modal="true" aria-labelledby="pick-title" ref={ref}>
        <h2 id="pick-title" className="serif modal-title">
          Quem tá no balcão?
        </h2>
        <p className="modal-note">Escolha seu lutador. Os pontos deste aparelho vão para ele.</p>
        <Cards value={value} onPick={onPick} />
      </div>
    </div>
  );
}
