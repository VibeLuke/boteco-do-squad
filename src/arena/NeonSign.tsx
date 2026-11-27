/**
 * Letreiro de neon de entrada de bar: "Boteco" em rosa, "do Squad" em ciano.
 * Algumas letras são "tubos com defeito" (piscam fora de ritmo, uma quase apagada)
 * e o letreiro inteiro dá um tranco de energia de tempos em tempos.
 */
const WORD_A = 'Boteco';
const WORD_B = 'do\u00a0Squad';
// Índices com defeito: [palavra, letra, tipo]
const FAULTY: Record<string, 'flicker' | 'dying' | 'buzz'> = {
  'a-2': 'flicker', // t
  'a-5': 'buzz', // o final
  'b-3': 'dying', // S
  'b-6': 'flicker', // a
};

function Letters({ word, w }: { word: string; w: 'a' | 'b' }) {
  return (
    <>
      {word.split('').map((ch, i) => {
        const f = FAULTY[`${w}-${i}`];
        return (
          <span key={i} className={`neon-l${f ? ` is-${f}` : ''}`} style={{ animationDelay: `${(i * 0.37 + (w === 'b' ? 1.3 : 0)) % 3}s` }}>
            {ch}
          </span>
        );
      })}
    </>
  );
}

export function NeonSign({ small = false }: { small?: boolean }) {
  return (
    <div className={`neon${small ? ' is-small' : ''}`} role="img" aria-label="Boteco do Squad">
      <div className="neon-board" aria-hidden="true">
        <span className="neon-word neon-a">
          <Letters word={WORD_A} w="a" />
        </span>
        <span className="neon-word neon-b">
          <Letters word={WORD_B} w="b" />
        </span>
        {!small && (
          <span className="neon-sub">
            <span className="neon-dot" />
            aberto · palavras cruzadas · briga liberada
            <span className="neon-dot" />
          </span>
        )}
      </div>
    </div>
  );
}
