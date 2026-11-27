/**
 * Quermesse Maluca, a tela (Fatia 14). Carregada só quando o portal abre. O regente e os microjogos são puros (./regente,
 * um arquivo por barraca); aqui só se lê o controle, se desenha e se toca o som.
 *
 * Canvas de 400 × 240 esticado sem suavizar. Cada microjogo desenha o próprio fundo; por cima vão o pavio (a barra de
 * tempo que queima), o verbo grande no aviso e o "BOA!" ou "XI!" do resultado. O placar dos amigos de hoje fica numa
 * barra de progresso ("Fulano chegou a 14"), sem replay.
 */
import { useEffect, useRef, useState } from 'react';
import { movimentoReduzido } from '../../vivo/movimento';
import { FOGUEIRAS, PASSOS_RUN, microPorId, novaQuermesse, passoQ, type Quermesse } from './regente';
import { DT, type EntradaQ } from './tipos';
import { somQuermesse } from './somQuermesse';
import './quermesse.css';

export interface ResultadoQuermesse {
  pontos: number;
  venceu: boolean;
  vencidos: number;
  jogados: number;
  segundos: number;
}

export interface AmigoPlacar {
  nome: string;
  cor: string;
  s: number;
}

interface Props {
  semente: number;
  amigos: AmigoPlacar[];
  onFim: (r: ResultadoQuermesse) => void;
}

const W = 400;
const H = 240;

export default function QuermesseTela({ semente, amigos: amigosProp, onFim }: Props) {
  // Os amigos ficam os da abertura: o bar redesenha várias vezes por segundo e o laço não pode recomeçar por isso.
  const [amigos] = useState(amigosProp);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [fase, setFase] = useState<'intro' | 'jogo' | 'fim'>('intro');
  const [hud, setHud] = useState({ fogueiras: FOGUEIRAS, pontos: 0, i: 1, vel: 1, resta: 120 });
  const [resultado, setResultado] = useState<ResultadoQuermesse | null>(null);
  const run = useRef<Quermesse>(novaQuermesse(semente));
  const teclas = useRef(new Set<string>());
  const stick = useRef({ x: 0, y: 0 });
  const pedido = useRef({ acao: false });
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false });
  const base = useRef<{ x: number; y: number; id: number } | null>(null);
  const onFimRef = useRef(onFim);
  onFimRef.current = onFim;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'KeyJ'].includes(e.code)) e.preventDefault();
      if (!e.repeat && ['Space', 'Enter', 'KeyJ'].includes(e.code)) pedido.current.acao = true;
      teclas.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => teclas.current.delete(e.code);
    const blur = () => teclas.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => {
    if (fase !== 'jogo') return;
    const cv = cvRef.current!;
    const c = cv.getContext('2d', { alpha: false })!;
    c.imageSmoothingEnabled = false;
    const q = run.current;
    const calmo = movimentoReduzido();
    const ctl = { pausa: false };
    let quadro = 0;
    let acum = 0;
    let antes = performance.now();
    let raf = 0;
    let acabou = false;
    let ultimoHud = 0;

    const entrada = (): EntradaQ => {
      const k = teclas.current;
      let mx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      let my = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
      if (!mx && !my) {
        mx = stick.current.x;
        my = stick.current.y;
      }
      const acao = pedido.current.acao;
      pedido.current.acao = false;
      return { mx, my, acao: acao || undefined };
    };

    const terminar = () => {
      acabou = true;
      const r: ResultadoQuermesse = { pontos: q.pontos, venceu: q.fim === 'venceu', vencidos: q.vencidos, jogados: q.jogados, segundos: Math.round(q.passo * DT) };
      somQuermesse(r.venceu ? 'venceu' : 'fim');
      setResultado(r);
      setFase('fim');
    };

    const umPasso = (ent: EntradaQ) => {
      passoQ(q, ent);
      for (const e of q.ev) {
        if (e.k === 'aviso') somQuermesse(e.chefe ? 'chefe' : 'aviso', e.i, e.vel);
        else if (e.k === 'ganhou') somQuermesse('ganhou');
        else if (e.k === 'perdeu') somQuermesse('perdeu');
        else if (e.k === 'acelerou') somQuermesse('acelerou');
      }
    };

    const desenhar = () => {
      const m = microPorId(q.id);
      m.desenhar(c, q.e, W, H, quadro);
      // Pavio: a corda queima da direita para a esquerda; a faísca pisca na ponta.
      const { t, dur } = m.tempo(q.e);
      const resta = q.fase === 'aviso' ? 1 : Math.max(0, 1 - t / dur);
      const larg = Math.round((W - 24) * resta);
      c.fillStyle = 'rgba(24,20,37,0.75)';
      c.fillRect(0, H - 12, W, 12);
      c.fillStyle = '#8f563b';
      c.fillRect(12, H - 7, larg, 3);
      c.fillStyle = '#c28a1f';
      for (let x = 12; x < 12 + larg; x += 6) c.fillRect(x, H - 7, 3, 1);
      if (q.fase === 'jogo') {
        c.fillStyle = quadro % 4 < 2 ? '#fee761' : '#f77622';
        c.fillRect(12 + larg - 2, H - 9, 5, 5);
        if (!calmo) {
          c.fillStyle = '#e43b44';
          c.fillRect(12 + larg + 2, H - 11 + (quadro % 3), 2, 2);
        }
      }
      if (q.fase === 'aviso') {
        // Verbo grande no meio, com a fogueira acesa embaixo (o alfa sobe devagar: sem flash).
        c.fillStyle = 'rgba(24,20,37,0.72)';
        c.fillRect(0, 0, W, H);
        c.textAlign = 'center';
        c.fillStyle = m.chefe ? '#e43b44' : '#fee761';
        c.font = '44px VT323, monospace';
        c.fillText(m.verbo + '!', W / 2, H / 2 + 6);
        c.font = '14px VT323, monospace';
        c.fillStyle = '#f4f4f4';
        c.fillText(m.chefe ? `CHEFE · ${m.nome} · vale 3` : `${m.nome} · nº ${q.i}`, W / 2, H / 2 + 28);
        c.textAlign = 'start';
      } else if (q.fase === 'pausa' || q.fase === 'fim') {
        const ok = q.ultimo === 'ganhou';
        c.textAlign = 'center';
        c.font = '36px VT323, monospace';
        c.fillStyle = '#181425';
        c.fillText(ok ? 'BOA!' : 'XI!', W / 2 + 2, 62);
        c.fillStyle = ok ? '#63c74d' : '#e43b44';
        c.fillText(ok ? 'BOA!' : 'XI!', W / 2, 60);
        c.textAlign = 'start';
      }
    };

    const mostrar = (agora: number, ja = false) => {
      desenhar();
      if (ja || q.fim || agora - ultimoHud > 100) {
        ultimoHud = agora;
        setHud({ fogueiras: q.fogueiras, pontos: q.pontos, i: q.i, vel: q.vel, resta: Math.max(0, Math.ceil((PASSOS_RUN - q.passo) * DT)) });
      }
      if (q.fim && !acabou) terminar();
    };

    const laco = (agora: number) => {
      if (acabou) return;
      acum = Math.min(acum + (agora - antes) / 1000, 0.1);
      antes = agora;
      let n = 0;
      while (acum >= DT && n < 6 && !q.fim && !ctl.pausa) {
        acum -= DT;
        n++;
        umPasso(entrada());
      }
      quadro++;
      mostrar(agora);
      if (!acabou) raf = requestAnimationFrame(laco);
    };
    raf = requestAnimationFrame(laco);
    // Gancho de teste (só em desenvolvimento): `ctl.pausa` para o quadro automático; `passos(n, ent)` anda à mão.
    if (import.meta.env.DEV)
      (window as unknown as { __quermesse?: unknown }).__quermesse = {
        q,
        ctl,
        /** O microjogo atual (o teste usa o bot perfeito dele). */
        micro: () => microPorId(q.id),
        passos(n: number, ent?: (q: Quermesse, i: number) => Partial<EntradaQ>) {
          for (let i = 0; i < n && !q.fim; i++) umPasso({ ...entrada(), ...(ent ? ent(q, i) : {}) });
          quadro++;
          mostrar(performance.now(), true);
          return { passo: q.passo, id: q.id, fase: q.fase, i: q.i, fogueiras: q.fogueiras, pontos: q.pontos, fim: q.fim };
        },
        foto: () => cv.toDataURL('image/png'),
      };
    return () => {
      cancelAnimationFrame(raf);
      if (import.meta.env.DEV) delete (window as unknown as { __quermesse?: unknown }).__quermesse;
    };
  }, [fase]);

  const onStick = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    if (e.type === 'pointerdown') {
      el.setPointerCapture(e.pointerId);
      base.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
    }
    if (!base.current || base.current.id !== e.pointerId) return;
    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      base.current = null;
      stick.current = { x: 0, y: 0 };
      setKnob({ x: 0, y: 0, on: false });
      return;
    }
    const R = r.width * 0.38;
    let dx = e.clientX - base.current.x;
    let dy = e.clientY - base.current.y;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    stick.current = { x: dx / R, y: dy / R };
    setKnob({ x: dx, y: dy, on: true });
  };

  // Barra dos amigos: cada um no ponto em que chegou hoje; você anda por ela.
  const topo = Math.max(10, hud.pontos, ...amigos.map((a) => a.s)) + 2;
  const fala = resultado
    ? resultado.venceu
      ? 'Rocky: — Ainda tem fogueira acesa! Quermesse dessas eu nunca vi. Leva uma paçoca.'
      : resultado.vencidos >= 8
        ? 'Rocky: — Passou do chefe e tudo. Apagou a última, mas foi bonito.'
        : 'Rocky: — Apagou tudo… e a sanfona nem esquentou. Em 5 minutos o portal abre de novo.'
    : '';

  return (
    <div className="gfa qm" role="dialog" aria-label="Quermesse Maluca">
      <canvas ref={cvRef} className="qm-tela" width={W} height={H} />
      {fase === 'intro' && (
        <div className="qm-intro">
          <p className="qm-logo">QUERMESSE MALUCA</p>
          <p>
            Rocky: — Do outro lado do portal é São João o ano inteiro. Cada barraca é um desafio de 5 segundos e a
            instrução é uma palavra só. Você tem 3 fogueiras: errou, apaga uma. A cada 8 barracas, a quadrilha.
          </p>
          <p className="qm-nota">Espaço, Enter ou J apertam · setas ou WASD andam (e dançam). No celular: joystick e o botão !.</p>
          {amigos.length > 0 && <p className="qm-nota">Hoje: {amigos.map((a) => `${a.nome} ${a.s}`).join(' · ')}</p>}
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setFase('jogo')}>
            Começar
          </button>
        </div>
      )}
      {fase === 'jogo' && (
        <>
          <div className="qm-hud" aria-live="off">
            <span aria-label={`${hud.fogueiras} fogueiras`}>
              {Array.from({ length: FOGUEIRAS }, (_, i) => (
                <span key={i} className={i < hud.fogueiras ? '' : 'qm-apagada'}>
                  🔥
                </span>
              ))}
            </span>
            <span>{hud.pontos} pts</span>
            <span>nº {hud.i}</span>
            <span>×{hud.vel.toFixed(2)}</span>
            <span>⏱ {hud.resta}s</span>
          </div>
          {amigos.length > 0 && (
            <div className="qm-amigos" aria-label="Placar de hoje">
              {amigos.map((a) => (
                <span key={a.nome} className={hud.pontos > a.s ? 'qm-passou' : ''} style={{ left: `${(a.s / topo) * 100}%`, borderColor: a.cor }} title={`${a.nome}: ${a.s}`}>
                  {a.nome}
                </span>
              ))}
              <i style={{ width: `${(hud.pontos / topo) * 100}%` }} />
            </div>
          )}
          <div className="vivo-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} aria-hidden="true">
            <span className={knob.on ? 'is-on' : ''} style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
          </div>
          <button
            type="button"
            className="qm-acao"
            aria-label="Apertar"
            onPointerDown={(e) => {
              e.preventDefault();
              pedido.current.acao = true;
            }}
          >
            !
          </button>
        </>
      )}
      {fase === 'fim' && resultado && (
        <div className="qm-intro">
          <p className="qm-logo">{resultado.venceu ? 'FOGUEIRA ACESA' : 'FOGUEIRAS APAGADAS'}</p>
          <p>
            {resultado.pontos}&nbsp;pontos · {resultado.vencidos}&nbsp;de&nbsp;{resultado.jogados}&nbsp;barracas · {resultado.segundos}&nbsp;s
          </p>
          <p>{fala}</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => onFimRef.current(resultado)}>
            Voltar ao bar
          </button>
        </div>
      )}
    </div>
  );
}
