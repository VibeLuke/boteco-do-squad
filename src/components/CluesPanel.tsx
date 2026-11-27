import { useEffect, useRef } from 'react';
import { ArrowDown, ArrowRight, Check } from 'lucide-react';
import type { CrosswordPuzzle, PlacedWord } from '../types/crossword';
import { wordKey } from '../utils/puzzle';

interface Props {
  puzzle: CrosswordPuzzle;
  active: PlacedWord | undefined;
  cross: PlacedWord | undefined;
  doneWords: Set<string>;
  /** Palavras que o jogador já viu em outro tabuleiro (valem 0). */
  repeatWords?: ReadonlySet<string>;
  onSelect: (w: PlacedWord) => void;
}

const NONE: ReadonlySet<string> = new Set();

function scrollToItem(container: HTMLElement | null, key: string): void {
  if (!container) return;
  const el = container.querySelector<HTMLElement>(`[data-key="${key}"]`);
  if (!el) return;
  const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
  container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}

function ClueList({
  title,
  icon,
  words,
  active,
  cross,
  doneWords,
  repeatWords,
  onSelect,
  listRef,
}: {
  title: string;
  icon: JSX.Element;
  words: PlacedWord[];
  active: PlacedWord | undefined;
  cross: PlacedWord | undefined;
  doneWords: Set<string>;
  repeatWords: ReadonlySet<string>;
  onSelect: (w: PlacedWord) => void;
  listRef: React.RefObject<HTMLDivElement>;
}) {
  const doneN = words.filter((w) => doneWords.has(wordKey(w))).length;
  return (
    <section className="clue-section" aria-label={title}>
      <header className="clue-head">
        <span className="clue-title serif">
          {icon}
          {title}
        </span>
        <span className="clue-count mono">
          {doneN}/{words.length}
        </span>
      </header>
      <div className="clue-scroll" ref={listRef}>
        <ul className="clue-list">
          {words.map((w) => {
            const key = wordKey(w);
            const isActive = !!active && wordKey(active) === key;
            const isCross = !!cross && wordKey(cross) === key;
            const done = doneWords.has(key);
            const repeat = repeatWords.has(key);
            return (
              <li key={key} data-key={key}>
                <button
                  type="button"
                  className={`clue${isActive ? ' is-active' : ''}${isCross ? ' is-cross' : ''}${done ? ' is-done' : ''}${repeat ? ' is-repeat' : ''}`}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => onSelect(w)}
                >
                  <span className="clue-num mono">{w.number}</span>
                  <span className="clue-text">
                    {w.clue}
                    {repeat && <span className="clue-repeat mono"> repetida · 0 pts</span>}
                  </span>
                  <span className="clue-len mono">{done ? <Check size={13} aria-label="Concluída" /> : w.word.length}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function CluesPanel({ puzzle, active, cross, doneWords, repeatWords = NONE, onSelect }: Props) {
  const acrossRef = useRef<HTMLDivElement>(null);
  const downRef = useRef<HTMLDivElement>(null);
  const activeKey = active ? wordKey(active) : '';
  const crossKey = cross ? wordKey(cross) : '';

  useEffect(() => {
    if (active) scrollToItem(active.direction === 'across' ? acrossRef.current : downRef.current, activeKey);
    if (cross) scrollToItem(cross.direction === 'across' ? acrossRef.current : downRef.current, crossKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, crossKey]);

  return (
    <div className="clues-panel">
      <ClueList
        title="Horizontais"
        icon={<ArrowRight size={16} aria-hidden="true" />}
        words={puzzle.across}
        active={active}
        cross={cross}
        doneWords={doneWords}
        repeatWords={repeatWords}
        onSelect={onSelect}
        listRef={acrossRef}
      />
      <ClueList
        title="Verticais"
        icon={<ArrowDown size={16} aria-hidden="true" />}
        words={puzzle.down}
        active={active}
        cross={cross}
        doneWords={doneWords}
        repeatWords={repeatWords}
        onSelect={onSelect}
        listRef={downRef}
      />
    </div>
  );
}
