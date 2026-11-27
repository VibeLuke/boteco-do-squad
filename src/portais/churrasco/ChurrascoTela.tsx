/**
 * Churrasco Jurássico, a tela (Fatia 20). Carregada só quando o portal abre. A simulação é pura (./sim); aqui só se lê
 * o botão, se desenha e se toca o som.
 *
 * Canvas de 400 × 240 esticado sem suavizar, 16 px por ladrilho. Três camadas de fundo andam em velocidades
 * diferentes (vulcões longe, samambaias no meio, chão na frente). Tudo desenhado à mão, ponto a ponto.
 */
import { useEffect, useRef, useState } from 'react';
import { movimentoReduzido } from '../../vivo/movimento';
import { somQuermesse } from '../quermesse/somQuermesse';
import type { AmigoPlacar } from '../quermesse/QuermesseTela';
import { DT, FIM_X, OSSO_ALT, PTERO_Y, VIDAS, novaCorrida, passoC, pontosDe, vel, type Corrida, type Item } from './sim';
import '../quermesse/quermesse.css';

export interface ResultadoChurrasco {
  pontos: number;
  venceu: boolean;
  picanhas: number;
  metros: number;
  segundos: number;
}

interface Props {
  semente: number;
  amigos: AmigoPlacar[];
  onFim: (r: ResultadoChurrasco) => void;
}

const W = 400;
const H = 240;
const T = 16;
/** Linha do chão na tela. */
const GY = 196;
/** O churrasqueiro fica sempre neste x da tela. */
const PX = 84;

/** Ruído fixo por coluna (para o chão não piscar): mesma coluna do mundo, mesmo valor. */
const ruido = (n: number) => {
  let h = Math.imul(n | 0, 2654435761) >>> 0;
  h ^= h >>> 15;
  return (h & 0xffff) / 0xffff;
};

export default function ChurrascoTela({ semente, amigos: amigosProp, onFim }: Props) {
  const [amigos] = useState(amigosProp);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [fase, setFase] = useState<'intro' | 'jogo' | 'fim'>('intro');
  const [hud, setHud] = useState({ vidas: VIDAS, pontos: 0, picanhas: 0, pct: 0 });
  const [resultado, setResultado] = useState<ResultadoChurrasco | null>(null);
  const run = useRef<Corrida>(novaCorrida(semente));
  const pedido = useRef(false);
  const onFimRef = useRef(onFim);
  onFimRef.current = onFim;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['Space', 'Enter', 'KeyJ', 'KeyW', 'ArrowUp'].includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) pedido.current = true;
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (fase !== 'jogo') return;
    const cv = cvRef.current!;
    const c = cv.getContext('2d', { alpha: false })!;
    c.imageSmoothingEnabled = false;
    const k = run.current;
    const calmo = movimentoReduzido();
    const ctl = { pausa: false };
    let quadro = 0;
    let acum = 0;
    let antes = performance.now();
    let raf = 0;
    let acabou = false;
    let ultimoHud = 0;
    let treme = 0;

    const terminar = () => {
      acabou = true;
      const r: ResultadoChurrasco = { pontos: pontosDe(k), venceu: k.venceu, picanhas: k.picanhas, metros: Math.floor(Math.min(k.x, FIM_X)), segundos: Math.round(k.t) };
      somQuermesse(r.venceu ? 'venceu' : 'fim');
      setResultado(r);
      setFase('fim');
    };

    const umPasso = (pulo: boolean) => {
      for (const e of passoC(k, pulo)) {
        if (e.k === 'carne') somQuermesse('ganhou');
        else if (e.k === 'bateu' || e.k === 'caiu') {
          somQuermesse('perdeu');
          treme = calmo ? 0 : 10;
        }
      }
    };

    /* ---------------------------------------------------------------- desenho */
    const px = (x: number, y: number, w: number, h: number, cor: string) => {
      c.fillStyle = cor;
      c.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const telaX = (x: number) => PX + (x - k.x) * T;

    const ceu = () => {
      const faixas: [number, string][] = [
        [0, '#2a1a3a'],
        [50, '#4a2244'],
        [95, '#7a2e40'],
        [130, '#b8482e'],
        [160, '#e8822e'],
      ];
      for (let i = 0; i < faixas.length; i++) {
        const [y0, cor] = faixas[i];
        const y1 = i + 1 < faixas.length ? faixas[i + 1][0] : GY;
        px(0, y0, W, y1 - y0, cor);
        // Emenda pontilhada (xadrez de 2 linhas) entre uma faixa e a outra: sem degradê liso.
        if (i + 1 < faixas.length) {
          c.fillStyle = faixas[i + 1][1];
          for (let x = 0; x < W; x += 2) c.fillRect(x + ((y1 >> 1) % 2), y1 - 2, 1, 1);
          for (let x = 1; x < W; x += 2) c.fillRect(x, y1 - 1, 1, 1);
        }
      }
      // Sol baixo, grande, cortado pelo horizonte.
      c.fillStyle = '#fee761';
      for (let dy = -22; dy <= 0; dy++) {
        const r = Math.floor(Math.sqrt(22 * 22 - dy * dy));
        c.fillRect(300 - r, 150 + dy, r * 2, 1);
      }
    };

    const vulcoes = () => {
      // Camada longe: anda a 15% da corrida.
      const off = (k.x * T * 0.15) % 220;
      for (let i = -1; i < 4; i++) {
        const bx = i * 220 - off;
        const alt = 70 + Math.round(ruido(i + Math.floor((k.x * T * 0.15) / 220)) * 20);
        for (let dy = 0; dy < alt; dy++) {
          const meia = Math.round(10 + dy * 1.15);
          px(bx + 110 - meia, GY - alt + dy, meia * 2, 1, dy < 4 ? '#4a2a3a' : '#3a2238');
        }
        // Boca com brilho de lava e fumaça subindo (parada com "reduzir movimento").
        px(bx + 100, GY - alt, 20, 3, '#f77622');
        px(bx + 104, GY - alt + 1, 12, 1, '#fee761');
        for (let s = 0; s < 4; s++) {
          const sobe = calmo ? s * 10 : (quadro * 0.4 + s * 10) % 40;
          const larg = 8 + Math.round(sobe / 4);
          c.globalAlpha = 0.55 * (1 - sobe / 40);
          px(bx + 110 - larg / 2 + Math.round(Math.sin((sobe + s) / 6) * 3), GY - alt - 6 - sobe, larg, 5, '#5a4a5a');
          c.globalAlpha = 1;
        }
      }
    };

    const samambaias = () => {
      // Camada do meio: 45% da corrida.
      const mundo = k.x * T * 0.45;
      const passo = 46;
      const i0 = Math.floor(mundo / passo) - 1;
      for (let i = i0; i < i0 + Math.ceil(W / passo) + 3; i++) {
        const bx = i * passo - mundo + Math.round(ruido(i * 7) * 20);
        const alt = 22 + Math.round(ruido(i * 13) * 26);
        const cor = '#1e2e22';
        px(bx, GY - alt, 3, alt, '#2a2418');
        // Folhas em leque, caídas.
        for (let f = -3; f <= 3; f++) {
          for (let s = 0; s < 14; s++) {
            const fx = bx + 1 + f * s * 0.55;
            const fy = GY - alt + Math.abs(f) * 1.5 + (s * s) / 18;
            px(fx, fy, 2, 2, cor);
          }
        }
      }
    };

    const chao = (itens: Item[]) => {
      const lavas = itens.filter((it) => it.tipo === 'lava' && telaX(it.x + it.w) > -4 && telaX(it.x) < W + 4);
      const naLava = (sx: number) => lavas.some((it) => sx >= telaX(it.x) && sx < telaX(it.x + it.w));
      for (let sx = 0; sx < W; sx++) {
        if (naLava(sx)) continue;
        const col = Math.floor(k.x * T) + sx - PX;
        px(sx, GY, 1, 3, ruido(col >> 1) < 0.15 ? '#63c74d' : '#3e8948');
        px(sx, GY + 3, 1, H - GY - 3, '#6a4a2a');
        if (ruido(col) < 0.08) px(sx, GY + 8 + Math.floor(ruido(col + 99) * 30), 2, 1, '#4a321e');
        if (ruido(col + 7) < 0.05) px(sx, GY + 6 + Math.floor(ruido(col + 31) * 24), 1, 1, '#8a6a4a');
      }
      // Poças de lava: brilho em cima, bolha subindo, borda escura.
      for (const it of lavas) {
        const x0 = Math.round(telaX(it.x));
        const x1 = Math.round(telaX(it.x + it.w));
        px(x0, GY + 2, x1 - x0, H - GY - 2, '#c0282c');
        px(x0, GY + 4, x1 - x0, H - GY - 4, '#f77622');
        px(x0, GY + 2, x1 - x0, 2, '#fee761');
        px(x0 - 1, GY, 1, H - GY, '#181425');
        px(x1, GY, 1, H - GY, '#181425');
        for (let b = 0; b < 3; b++) {
          const fase = calmo ? 0.5 : ((quadro / 40 + b * 0.37 + it.id * 0.13) % 1);
          const bx = x0 + 3 + Math.round(((b + 1) / 4) * (x1 - x0 - 6));
          px(bx, GY + 10 - fase * 10, 2, 2, '#fee761');
        }
      }
    };

    const osso = (it: Item) => {
      const x0 = Math.round(telaX(it.x));
      const w = Math.round(it.w * T);
      const h = Math.round(OSSO_ALT * T);
      // Osso de dinossauro em pé, cravado no chão: contorno escuro, luz à esquerda.
      px(x0 + 2, GY - h + 3, w - 4, h - 3, '#3a2a2a');
      px(x0 + 3, GY - h + 3, w - 6, h - 3, '#f4f0dc');
      px(x0 + 3, GY - h + 3, 2, h - 3, '#ffffff');
      px(x0, GY - h, w, 5, '#3a2a2a');
      px(x0 + 1, GY - h + 1, Math.floor(w / 2) - 1, 3, '#f4f0dc');
      px(x0 + Math.ceil(w / 2), GY - h + 1, Math.floor(w / 2) - 1, 3, '#e0d8bc');
      px(x0 + 3, GY - 3, w - 6, 3, '#c8bc98');
    };

    const ptero = (it: Item) => {
      const x0 = Math.round(telaX(it.x));
      const yb = GY - Math.round(((PTERO_Y[0] + PTERO_Y[1]) / 2) * T);
      const bate = calmo ? 0 : Math.floor(quadro / 8) % 2;
      // Verde-água com contorno escuro: o roxo de antes sumia no meio das samambaias e dos vulcões.
      // Asa larga (para cima ou para baixo, sem descer abaixo da faixa que machuca), corpo, cabeça virada para
      // quem vem, bico amarelo, crista vermelha para trás.
      const asa: [number, number, number][] = bate
        ? [
            [4, -3, 11],
            [6, -5, 10],
            [8, -7, 9],
            [11, -9, 7],
          ]
        : [
            [4, 3, 11],
            [6, 4, 10],
            [9, 5, 8],
          ];
      const partes: [number, number, number, number, string][] = [
        ...asa.map(([dx, dy, w]) => [dx, dy, w, 2, '#2a8a7a'] as [number, number, number, number, string]),
        [3, -2, 11, 5, '#4ac0a0'],
        [13, -1, 5, 2, '#4ac0a0'],
        [-3, -4, 7, 4, '#4ac0a0'],
        [-7, -3, 4, 2, '#fee761'],
        [3, -6, 5, 2, '#e43b44'],
      ];
      for (const [dx, dy, w, h] of partes) px(x0 + dx - 1, yb + dy - 1, w + 2, h + 2, '#181425');
      for (const [dx, dy, w, h, cor] of partes) px(x0 + dx, yb + dy, w, h, cor);
      // Luz por cima (de onde vem o sol) e o olho.
      px(x0 + 4, yb - 2, 9, 1, '#9af0d0');
      px(x0 - 2, yb - 4, 5, 1, '#9af0d0');
      px(x0 - 1, yb - 3, 1, 1, '#181425');
      // Sombra no chão: avisa que ele está baixo.
      c.globalAlpha = 0.35;
      px(x0 + 1, GY - 1, 14, 2, '#181425');
      c.globalAlpha = 1;
    };

    const picanha = (it: Item) => {
      const x0 = Math.round(telaX(it.x)) - 2;
      const boia = calmo ? 0 : Math.round(Math.sin(quadro / 10 + it.id) * 1.5);
      const y0 = GY - Math.round(it.y1 * T) + boia;
      px(x0, y0, 10, 7, '#181425');
      px(x0 + 1, y0 + 1, 8, 5, '#c0283a');
      px(x0 + 1, y0 + 1, 8, 2, '#f4e0c0');
      px(x0 + 2, y0 + 4, 2, 1, '#e86a7a');
    };

    const churrasqueira = () => {
      const x0 = Math.round(telaX(FIM_X));
      if (x0 > W + 40) return;
      px(x0, GY - 22, 26, 3, '#181425');
      px(x0 + 1, GY - 21, 24, 1, '#8b9bb4');
      px(x0 + 2, GY - 19, 22, 8, '#3a3438');
      px(x0 + 3, GY - 18, 20, 3, '#f77622');
      px(x0 + 4, GY - 11, 2, 11, '#3a3438');
      px(x0 + 20, GY - 11, 2, 11, '#3a3438');
      px(x0 + 30, GY - 46, 2, 46, '#c0cbdc');
      px(x0 + 32, GY - 46, 14, 9, quadro % 20 < 10 || calmo ? '#e43b44' : '#f4f4f4');
      for (let s = 0; s < 3; s++) {
        const sobe = calmo ? s * 8 : (quadro * 0.6 + s * 9) % 30;
        c.globalAlpha = 0.5 * (1 - sobe / 30);
        px(x0 + 8 + s * 4, GY - 26 - sobe, 6, 4, '#c0cbdc');
        c.globalAlpha = 1;
      }
    };

    const cozinheiro = () => {
      const pisca = k.t < k.invAte && Math.floor(k.t * 12) % 2 === 0;
      if (pisca) return;
      const y = GY - Math.round(k.y * T);
      const anda = k.noChao ? Math.floor(k.t * vel(k.x) * 1.6) % 2 : 2;
      const x = PX;
      // Chapéu de cozinheiro, cabeça, camisa vermelha com avental, pernas, braço com o espeto à frente.
      px(x + 1, y - 22, 8, 2, '#181425');
      px(x + 2, y - 27, 6, 5, '#f4f4f4');
      px(x + 1, y - 29, 8, 3, '#f4f4f4');
      px(x + 2, y - 20, 6, 5, '#e8b796');
      px(x + 6, y - 18, 1, 1, '#181425');
      px(x + 1, y - 15, 8, 8, '#c0283a');
      px(x + 2, y - 14, 6, 7, '#f4e9c8');
      if (anda === 2) {
        px(x + 1, y - 7, 3, 5, '#3a3438');
        px(x + 5, y - 7, 3, 4, '#3a3438');
      } else {
        px(x + 1 + anda * 3, y - 7, 3, 7, '#3a3438');
        px(x + 5 - anda * 3, y - 7, 3, 6, '#3a3438');
      }
      px(x + 8, y - 13, 4, 2, '#e8b796');
      px(x + 11, y - 15, 14, 1, '#8b9bb4');
      px(x + 14, y - 17, 3, 4, '#7a3a1a');
      px(x + 18, y - 17, 3, 4, '#c0283a');
      px(x + 22, y - 17, 2, 4, '#7a3a1a');
    };

    const desenhar = () => {
      const dx = treme > 0 ? (treme % 2 ? 2 : -2) : 0;
      if (treme > 0) treme--;
      c.save();
      c.translate(dx, 0);
      ceu();
      vulcoes();
      samambaias();
      const vis = k.itens.filter((it) => telaX(it.x + it.w) > -20 && telaX(it.x) < W + 20);
      chao(vis);
      churrasqueira();
      for (const it of vis) {
        if (it.tipo === 'osso') osso(it);
        else if (it.tipo === 'ptero') ptero(it);
        else if (it.tipo === 'picanha' && !k.pegos.includes(it.id)) picanha(it);
      }
      cozinheiro();
      c.restore();
    };

    const mostrar = (agora: number, ja = false) => {
      desenhar();
      if (ja || k.acabou || agora - ultimoHud > 100) {
        ultimoHud = agora;
        setHud({ vidas: k.vidas, pontos: pontosDe(k), picanhas: k.picanhas, pct: Math.min(100, Math.round((k.x / FIM_X) * 100)) });
      }
      if (k.acabou && !acabou) terminar();
    };

    const laco = (agora: number) => {
      if (acabou) return;
      acum = Math.min(acum + (agora - antes) / 1000, 0.1);
      antes = agora;
      let n = 0;
      while (acum >= DT && n < 6 && !k.acabou && !ctl.pausa) {
        acum -= DT;
        n++;
        const p = pedido.current;
        pedido.current = false;
        umPasso(p);
      }
      quadro++;
      mostrar(agora);
      if (!acabou) raf = requestAnimationFrame(laco);
    };
    raf = requestAnimationFrame(laco);
    // Gancho de teste (só em desenvolvimento): `ctl.pausa` para o quadro automático; `passos(n, pula)` anda à mão.
    if (import.meta.env.DEV)
      (window as unknown as { __churrasco?: unknown }).__churrasco = {
        k,
        ctl,
        passos(n: number, pula?: (k: Corrida, i: number) => boolean) {
          for (let i = 0; i < n && !k.acabou; i++) umPasso(pula ? pula(k, i) : false);
          quadro++;
          mostrar(performance.now(), true);
          return { x: k.x, vidas: k.vidas, picanhas: k.picanhas, acabou: k.acabou, venceu: k.venceu };
        },
        foto: () => cv.toDataURL('image/png'),
      };
    return () => {
      cancelAnimationFrame(raf);
      if (import.meta.env.DEV) delete (window as unknown as { __churrasco?: unknown }).__churrasco;
    };
  }, [fase]);

  const topo = Math.max(10, hud.pontos, ...amigos.map((a) => a.s)) + 2;
  const fala = resultado
    ? resultado.venceu
      ? 'Rocky: — Chegou na churrasqueira com espeto e tudo! Picanha jurássica é outro nível.'
      : resultado.metros >= FIM_X / 2
        ? 'Rocky: — Passou da metade. O pterodáctilo levou o resto do churrasco.'
        : 'Rocky: — Virou carvão cedo, hein. Em 5 minutos o portal abre de novo.'
    : '';

  return (
    <div className="gfa qm" role="dialog" aria-label="Churrasco Jurássico">
      <canvas
        ref={cvRef}
        className="qm-tela"
        width={W}
        height={H}
        onPointerDown={(e) => {
          e.preventDefault();
          pedido.current = true;
        }}
      />
      {fase === 'intro' && (
        <div className="qm-intro">
          <p className="qm-logo">CHURRASCO JURÁSSICO</p>
          <p>
            Rocky: — Do outro lado é tudo vulcão e samambaia, e você corre sozinho com o espeto até a churrasqueira. Um
            botão só: osso e lava, pula; pterodáctilo voando baixo, passa por baixo dele. Picanha no caminho, pega. Você
            tem {VIDAS} espetos.
          </p>
          <p className="qm-nota">Espaço, Enter, J, W ou ↑ pulam. No celular: toque na tela ou no botão.</p>
          {amigos.length > 0 && <p className="qm-nota">Hoje: {amigos.map((a) => `${a.nome} ${a.s}`).join(' · ')}</p>}
          <button type="button" className="btn btn-primary btn-lg" onClick={() => setFase('jogo')}>
            Começar
          </button>
        </div>
      )}
      {fase === 'jogo' && (
        <>
          <div className="qm-hud" aria-live="off">
            <span aria-label={`${hud.vidas} espetos`}>
              {Array.from({ length: VIDAS }, (_, i) => (
                <span key={i} className={i < hud.vidas ? '' : 'qm-apagada'}>
                  🍢
                </span>
              ))}
            </span>
            <span>{hud.pontos} pts</span>
            <span>🥩 {hud.picanhas}</span>
            <span>{hud.pct}%</span>
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
          <button
            type="button"
            className="qm-acao"
            aria-label="Pular"
            onPointerDown={(e) => {
              e.preventDefault();
              pedido.current = true;
            }}
          >
            ↑
          </button>
        </>
      )}
      {fase === 'fim' && resultado && (
        <div className="qm-intro">
          <p className="qm-logo">{resultado.venceu ? 'CHEGOU NA BRASA' : 'VIROU CARVÃO'}</p>
          <p>
            {resultado.pontos}&nbsp;pontos · {resultado.picanhas}&nbsp;picanhas · {resultado.metros}&nbsp;de&nbsp;{FIM_X}&nbsp;m · {resultado.segundos}&nbsp;s
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
