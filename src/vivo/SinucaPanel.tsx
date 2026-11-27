/**
 * As duas mesas de sinuca de verdade do salão lateral (bola 8 casual). Quem abre a mesa escolhe a vaga 2: bot
 * (fácil, médio ou difícil) ou aberta para um amigo online. A física e o bot estão em bilhar.ts (puro).
 *
 * Rede: bar/mesa/{0|1} = { a, b (vagas), v (vez), e (bolas, 90 caracteres), n (jogada), tq (a última tacada), at }.
 * Quem taca simula, anima e grava a tacada E o resultado; quem assiste anima a mesma tacada e no fim encaixa no
 * resultado gravado (não depende de a conta dar igual nos dois aparelhos). O bot joga no aparelho de quem abriu.
 * Sem banco (ou com a regra antiga), a mesa contra o bot funciona só no aparelho.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PLAYER_BY_ID, isPlayerId, type PlayerId } from '../arena/sprites';
import { barPresence } from '../bar/presence';
import {
  ALTURA,
  CACAPAS,
  LARGURA,
  R,
  codificar,
  decodificar,
  grupoDe,
  iniciarTacada,
  novaMesa,
  passoFisica,
  pensarBot,
  posicionarBranca,
  simular,
  type EstadoDin,
  type Mesa,
  type NivelBot,
} from './bilhar';
import { online, sanitizeVivo } from './rede';
import { FORCA_MIN, bolaFantasma, mirar, puxada, type Vetor } from './tacoGesto';
import { tocar } from './som';

export interface MesaRede {
  a: string;
  b: string;
  v: 0 | 1;
  e: string;
  n: number;
  tq: string;
  at: number;
}

/** Mesa abandonada há mais de 10 min volta a ficar livre. */
const LIVRE_DEPOIS_MS = 600_000;
const NIVEIS: Record<string, NivelBot> = { bot1: 'facil', bot2: 'medio', bot3: 'dificil' };
const NOME_NIVEL: Record<NivelBot, string> = { facil: 'fácil', medio: 'médio', dificil: 'difícil' };
/** Mesa contra o bot sem banco: guardada na memória enquanto a página está aberta. */
const locais = new Map<number, MesaRede>();

function lerMesa(i: number): MesaRede | null {
  const r = (barPresence.mesaRaw() as Record<string, Partial<MesaRede>> | null)?.[String(i)];
  if (!r || typeof r.e !== 'string' || typeof r.n !== 'number' || typeof r.a !== 'string' || typeof r.b !== 'string') return null;
  return { a: r.a, b: r.b, v: r.v === 1 ? 1 : 0, e: r.e, n: r.n, tq: typeof r.tq === 'string' ? r.tq : '', at: typeof r.at === 'number' ? r.at : 0 };
}

const nomeVaga = (v: string) => (NIVEIS[v] ? `Bot ${NOME_NIVEL[NIVEIS[v]]}` : isPlayerId(v) ? PLAYER_BY_ID[v].name : v ? v : 'vaga aberta');
const r4 = (v: number) => Math.round(v * 10000) / 10000;
/** A mesa para em ~9 s; passou disso sem quadro, a animação encaixa no resultado. */
const ANIM_MAX_MS = 12000;

/** Tacada na rede: direção, força e, com bola na mão, onde a branca foi posta. */
function lerTacada(tq: string): { dx: number; dy: number; forca: number; branca?: { x: number; y: number } } | null {
  const p = tq.split(',').map(Number);
  if (p.length < 3 || p.slice(0, 3).some((v) => !Number.isFinite(v))) return null;
  return { dx: p[0], dy: p[1], forca: p[2], ...(p.length >= 5 && Number.isFinite(p[3]) && Number.isFinite(p[4]) ? { branca: { x: p[3], y: p[4] } } : {}) };
}

const CORES = ['#f4f4f4', '#feae34', '#0099db', '#e43b44', '#8b5cf6', '#ef7d57', '#3e8948', '#a22633', '#181425'];

export function SinucaPanel({ player, i, avisar }: { player: PlayerId; i: 0 | 1; avisar: (t: string) => void }) {
  const [rede, setRede] = useState<MesaRede | null>(() => lerMesa(i) ?? locais.get(i) ?? null);
  const redeRef = useRef(rede);
  redeRef.current = rede;
  const [vaga2, setVaga2] = useState('bot2');
  const [forca, setForca] = useState(0);
  const [mira, setMira] = useState({ dx: 1, dy: 0 });
  const [branca, setBranca] = useState<{ x: number; y: number } | null>(null);
  const [animando, setAnimando] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const anim = useRef<{ e: EstadoDin; desde: number; fim: () => void } | null>(null);
  /** Última jogada animada aqui (para não reanimar a própria tacada quando ela volta pela rede). */
  const vista = useRef(rede?.n ?? -1);

  const mesa = useMemo(() => (rede ? decodificar(rede.e) : null), [rede]);
  const livre = !rede || rede.a === '' || barPresence.now() - rede.at > LIVRE_DEPOIS_MS || (!!mesa?.fim && rede.a !== player && rede.b !== player);
  const meuLado: 0 | 1 | null = rede && !livre ? (rede.a === player ? 0 : rede.b === player ? 1 : null) : null;
  const vagaDaVez = rede && mesa ? (mesa.vez === 0 ? rede.a : rede.b) : '';
  const minhaVez = !!mesa && !mesa.fim && meuLado !== null && mesa.vez === meuLado && !animando;
  const adversario = rede ? (meuLado === 0 ? rede.b : rede.a) : '';
  const vivos = sanitizeVivo(barPresence.vivoRaw());
  const advSaiu = isPlayerId(adversario) && !online(vivos[adversario], barPresence.now());

  // Mesa nova chegando pela rede: anima a tacada de quem jogou e encaixa no resultado gravado.
  const animar = useCallback((antes: Mesa, tq: string, depois: Mesa | null, aoFim?: () => void) => {
    const t = lerTacada(tq);
    if (!t) {
      aoFim?.();
      return;
    }
    const base = t.branca ? (posicionarBranca(antes, t.branca.x, t.branca.y) ?? antes) : antes;
    // Aba escondida não desenha quadro: encaixa direto no resultado gravado.
    if (document.hidden) {
      aoFim?.();
      return;
    }
    const e = iniciarTacada(base, t);
    setAnimando(true);
    tocar('soco');
    anim.current = {
      e,
      desde: performance.now(),
      fim: () => {
        anim.current = null;
        setAnimando(false);
        aoFim?.();
        void depois;
      },
    };
  }, []);

  useEffect(() => {
    const ver = () => {
      const r = lerMesa(i);
      const atual = redeRef.current;
      if (!r || (atual && r.n === atual.n && r.at === atual.at && r.e === atual.e)) return;
      // Tacada de outra pessoa: anima a partir da mesa de antes (se eu tinha a de antes).
      if (atual && r.n === atual.n + 1 && r.n > vista.current && r.tq && !anim.current) {
        const antes = decodificar(atual.e);
        const depois = decodificar(r.e);
        vista.current = r.n;
        if (antes)
          animar(antes, r.tq, depois, () => {
            // Pode ter chegado outra jogada durante a animação: encaixa na mais nova, nunca volta para trás.
            setRede(lerMesa(i) ?? r);
          });
        else setRede(r);
        return;
      }
      vista.current = Math.max(vista.current, r.n);
      setRede(r);
    };
    return barPresence.subscribe(ver);
  }, [i, animar]);

  /** Grava a mesa (no banco, se der; senão fica no aparelho). */
  const publicar = useCallback(
    (novo: MesaRede) => {
      vista.current = Math.max(vista.current, novo.n);
      locais.set(i, novo);
      setRede(novo);
      void barPresence.sendMesa(i, novo).then((ok) => {
        if (!ok && (isPlayerId(novo.b) && novo.b !== player)) avisar('A mesa não chegou ao banco (sem conexão): o amigo não vê a jogada.');
      });
    },
    [i, player, avisar],
  );

  /**
   * Taca: a física é determinística, então o resultado sai na hora (`simular`) e vai para o banco antes da animação.
   * Assim a jogada não se perde se a aba esconder ou fechar no meio da tacada; a animação aqui é só para ver.
   */
  const tacar = useCallback(
    (antes: Mesa, t: { dx: number; dy: number; forca: number; branca?: { x: number; y: number } }) => {
      const r = redeRef.current;
      if (!r) return;
      // Tudo com os números arredondados que vão no banco: quem assiste simula exatamente a mesma tacada.
      const tq = [r4(t.dx), r4(t.dy), r4(t.forca), ...(t.branca ? [r4(t.branca.x), r4(t.branca.y)] : [])].join(',');
      const lida = lerTacada(tq);
      if (!lida) return;
      const base = lida.branca ? (posicionarBranca(antes, lida.branca.x, lida.branca.y) ?? antes) : antes;
      const tac = { dx: lida.dx, dy: lida.dy, forca: lida.forca };
      const depois = simular(base, tac).mesa;
      tocar('soco');
      if (!document.hidden) {
        setAnimando(true);
        anim.current = {
          e: iniciarTacada(base, tac),
          desde: performance.now(),
          fim: () => {
            anim.current = null;
            setAnimando(false);
            if (depois.fim) tocar('ko');
          },
        };
      }
      publicar({ ...r, v: depois.vez, e: codificar(depois), n: r.n + 1, tq, at: barPresence.now() });
    },
    [publicar],
  );

  // Aba escondida no meio da tacada: o quadro para, então a animação termina na hora (o resultado já está gravado).
  // E uma trava de tempo para quando o navegador segura os quadros sem esconder a aba: a vez do bot não fica presa.
  useEffect(() => {
    const ver = () => {
      if (document.hidden && anim.current) anim.current.fim();
    };
    const trava = window.setInterval(() => {
      if (anim.current && performance.now() - anim.current.desde > ANIM_MAX_MS) anim.current.fim();
    }, 1000);
    document.addEventListener('visibilitychange', ver);
    return () => {
      window.clearInterval(trava);
      document.removeEventListener('visibilitychange', ver);
    };
  }, []);

  // Vez do bot: joga no aparelho de quem abriu a mesa (vaga 1), um tempinho depois para parecer que pensa.
  useEffect(() => {
    if (!rede || !mesa || mesa.fim || animando || rede.a !== player || !NIVEIS[vagaDaVez]) return;
    const id = window.setTimeout(() => {
      const r = redeRef.current;
      const m = r ? decodificar(r.e) : null;
      if (!r || !m || m.fim || anim.current) return;
      const j = pensarBot(m, NIVEIS[vagaDaVez], r.n * 7919 + i * 31 + 1);
      tacar(m, j);
    }, 900);
    return () => window.clearTimeout(id);
  }, [rede, mesa, animando, player, vagaDaVez, i, tacar]);

  // Desenho (e a física da animação), quadro a quadro.
  useEffect(() => {
    let raf = 0;
    let antes = performance.now();
    const quadro = (agora: number) => {
      const dt = Math.min(0.05, (agora - antes) / 1000);
      antes = agora;
      const a = anim.current;
      if (a && !passoFisica(a.e, dt)) a.fim();
      desenhar();
      raf = requestAnimationFrame(quadro);
    };
    const desenhar = () => {
      const cv = canvasRef.current;
      if (!cv) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(cv.clientWidth * dpr);
      const H = Math.round(cv.clientHeight * dpr);
      if (cv.width !== W || cv.height !== H) {
        cv.width = W;
        cv.height = H;
      }
      const ctx = cv.getContext('2d')!;
      const borda = 0.09;
      const esc = W / (LARGURA + borda * 2);
      const ox = borda * esc;
      const oy = borda * esc;
      const X = (x: number) => ox + x * esc;
      const Y = (y: number) => oy + y * esc;
      ctx.fillStyle = '#5c3620';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#3a2214';
      ctx.fillRect(ox * 0.4, oy * 0.4, W - ox * 0.8, H - oy * 0.8);
      ctx.fillStyle = '#1f6b3a';
      ctx.fillRect(ox, oy, LARGURA * esc, ALTURA * esc);
      ctx.fillStyle = '#25804a';
      ctx.fillRect(ox, oy, LARGURA * esc, 3 * dpr);
      for (const c of CACAPAS) {
        ctx.fillStyle = '#0b0a10';
        ctx.beginPath();
        ctx.arc(X(c.x), Y(c.y), c.r * esc, 0, Math.PI * 2);
        ctx.fill();
      }
      const r = redeRef.current;
      const m = r ? decodificar(r.e) : null;
      const bolas = anim.current ? anim.current.e.bolas : (m?.bolas ?? []);
      // Bola na mão: a branca segue onde você pôs.
      for (const b of bolas) {
        if (b.dentro) continue;
        let x = b.x;
        let y = b.y;
        if (b.n === 0 && !anim.current && brancaRef.current) {
          x = brancaRef.current.x;
          y = brancaRef.current.y;
        }
        const raio = R * esc;
        ctx.fillStyle = '#0b0a10';
        ctx.beginPath();
        ctx.arc(X(x) + raio * 0.15, Y(y) + raio * 0.2, raio, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = b.n === 0 ? '#f4f4f4' : CORES[b.n > 8 ? b.n - 8 : b.n];
        ctx.beginPath();
        ctx.arc(X(x), Y(y), raio, 0, Math.PI * 2);
        ctx.fill();
        if (b.n > 8) {
          // Listrada: faixa branca no meio.
          ctx.save();
          ctx.beginPath();
          ctx.arc(X(x), Y(y), raio, 0, Math.PI * 2);
          ctx.clip();
          ctx.fillStyle = '#f4f4f4';
          ctx.fillRect(X(x) - raio, Y(y) - raio, raio * 2, raio * 0.55);
          ctx.fillRect(X(x) - raio, Y(y) + raio * 0.45, raio * 2, raio * 0.55);
          ctx.restore();
        }
        if (b.n > 0) {
          ctx.fillStyle = b.n === 8 ? '#f4f4f4' : '#181425';
          ctx.font = `${Math.round(raio * 1.1)}px VT323, monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(b.n), X(x), Y(y) + 1);
        }
      }
      // Mira: linha da branca até onde você aponta, mais o taco do lado de trás.
      const mv = miraRef.current;
      if (mv.ativa && m && !anim.current) {
        const br = brancaRef.current ?? m.bolas[0];
        const bx = X(br.x);
        const by = Y(br.y);
        ctx.strokeStyle = 'rgba(244,244,244,0.55)';
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        const fant = bolaFantasma(m, br, { x: mv.dx, y: mv.dy });
        const ate = fant ? Math.hypot(fant.x - br.x, fant.y - br.y) : 0.9;
        ctx.lineTo(bx + mv.dx * esc * ate, by + mv.dy * esc * ate);
        ctx.stroke();
        ctx.setLineDash([]);
        if (fant) {
          // Bola fantasma (onde a branca encosta) e para onde a bola atingida sai.
          const alvo = m.bolas[fant.n];
          ctx.strokeStyle = 'rgba(244,244,244,0.8)';
          ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath();
          ctx.arc(X(fant.x), Y(fant.y), R * esc, 0, Math.PI * 2);
          ctx.stroke();
          const ox = alvo.x - fant.x;
          const oy = alvo.y - fant.y;
          const on = Math.hypot(ox, oy) || 1;
          ctx.beginPath();
          ctx.moveTo(X(alvo.x), Y(alvo.y));
          ctx.lineTo(X(alvo.x + (ox / on) * 0.3), Y(alvo.y + (oy / on) * 0.3));
          ctx.stroke();
        }
        const recuo = (0.06 + forcaRef.current * 0.25) * esc;
        ctx.strokeStyle = '#c28a1f';
        ctx.lineWidth = 4 * dpr;
        ctx.beginPath();
        ctx.moveTo(bx - mv.dx * (R * esc + recuo), by - mv.dy * (R * esc + recuo));
        ctx.lineTo(bx - mv.dx * (R * esc + recuo + esc * 0.9), by - mv.dy * (R * esc + recuo + esc * 0.9));
        ctx.stroke();
        // Medidor de força na borda direita: enche de baixo para cima conforme arrasta para baixo.
        const f = forcaRef.current;
        if (f > 0) {
          const mw = 8 * dpr;
          const mh = H * 0.7;
          const mx = W - mw - 6 * dpr;
          const my = (H - mh) / 2;
          ctx.fillStyle = 'rgba(24,20,37,0.75)';
          ctx.fillRect(mx - 2 * dpr, my - 2 * dpr, mw + 4 * dpr, mh + 4 * dpr);
          ctx.fillStyle = f < 0.5 ? '#63c74d' : f < 0.85 ? '#feae34' : '#e43b44';
          ctx.fillRect(mx, my + mh * (1 - f), mw, mh * f);
        }
      }
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Refs que o desenho lê sem recriar o laço.
  const miraRef = useRef({ ...mira, ativa: false });
  miraRef.current = { ...mira, ativa: minhaVez };
  const forcaRef = useRef(forca);
  forcaRef.current = forca;
  const brancaRef = useRef(branca);
  brancaRef.current = branca;

  const ponto = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const borda = 0.09;
    const esc = r.width / (LARGURA + borda * 2);
    return { x: (ev.clientX - r.left) / esc - borda, y: (ev.clientY - r.top) / esc - borda };
  };
  // O taco na mesa: o ponteiro mira (a branca olha para ele); clicar e segurar trava a mira; arrastar para baixo carrega
  // a força; de lado, ajusta a mira fino; soltar taca; voltar ao ponto do clique desiste.
  const podeTacar = minhaVez && !(mesa?.bolaNaMao && !branca);
  const puxe = useRef<{ mira0: Vetor; p0: Vetor } | null>(null);
  const [puxando, setPuxando] = useState(false);
  const onMove = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    if (!minhaVez || !mesa) return;
    const p = ponto(ev);
    const pu = puxe.current;
    if (pu) {
      const r = puxada(pu.mira0, pu.p0, p);
      setMira({ dx: r.dx, dy: r.dy });
      setForca(r.forca);
      return;
    }
    const d = mirar(branca ?? mesa.bolas[0], p, { x: mira.dx, y: mira.dy });
    setMira({ dx: d.x, dy: d.y });
  };
  const onDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    if (!minhaVez || !mesa) return;
    // Bola na mão: o primeiro toque põe a branca (se o lugar estiver livre); depois, mira.
    if (mesa.bolaNaMao && !branca) {
      const p = ponto(ev);
      if (posicionarBranca(mesa, p.x, p.y)) setBranca(p);
      else avisar('Ali não cabe a branca.');
      return;
    }
    try {
      ev.currentTarget.setPointerCapture(ev.pointerId);
    } catch {
      // ponteiro sem captura (raro): segue sem ela
    }
    const p = ponto(ev);
    // No toque não há "passar por cima": o próprio toque mira. No mouse, a mira já veio do movimento.
    const d = ev.pointerType === 'mouse' ? { x: mira.dx, y: mira.dy } : mirar(branca ?? mesa.bolas[0], p, { x: mira.dx, y: mira.dy });
    setMira({ dx: d.x, dy: d.y });
    puxe.current = { mira0: d, p0: p };
    setPuxando(true);
    setForca(0);
  };
  const onUp = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const pu = puxe.current;
    if (!pu) return;
    const r = puxada(pu.mira0, pu.p0, ponto(ev));
    puxe.current = null;
    setPuxando(false);
    setForca(0);
    if (r.forca >= FORCA_MIN && podeTacar) daVez(r.forca, { dx: r.dx, dy: r.dy });
  };
  const onCancel = () => {
    puxe.current = null;
    setPuxando(false);
    setForca(0);
  };
  // Teclado: setas giram a mira; segurar espaço puxa o taco (enche em ~1,2 s); soltar taca.
  const carga = useRef(0);
  const onTecla = (ev: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (!podeTacar) return;
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      ev.preventDefault();
      const a = Math.atan2(mira.dy, mira.dx) + (ev.key === 'ArrowLeft' ? -1 : 1) * (ev.shiftKey ? 0.004 : 0.03);
      setMira({ dx: Math.cos(a), dy: Math.sin(a) });
    } else if (ev.key === ' ' && !ev.repeat && !carga.current) {
      ev.preventDefault();
      setPuxando(true);
      setForca(0);
      carga.current = window.setInterval(() => setForca((f) => Math.min(1, f + 0.025)), 30);
    }
  };
  const onSoltaTecla = (ev: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (ev.key !== ' ' || !carga.current) return;
    ev.preventDefault();
    window.clearInterval(carga.current);
    carga.current = 0;
    setPuxando(false);
    const f = forcaRef.current;
    setForca(0);
    if (f >= FORCA_MIN && podeTacar) daVez(f);
  };
  useEffect(() => () => window.clearInterval(carga.current), []);

  const abrir = () => {
    const m = novaMesa((Date.now() >>> 0) ^ (i * 977));
    setBranca(null);
    publicar({ a: player, b: vaga2, v: 0, e: codificar(m), n: 0, tq: '', at: barPresence.now() });
  };
  const entrar = () => {
    if (!rede) return;
    publicar({ ...rede, b: player, n: rede.n + 1, tq: '', at: barPresence.now() });
  };
  const revanche = () => {
    if (!rede) return;
    const m = novaMesa((Date.now() >>> 0) ^ (i * 977));
    setBranca(null);
    publicar({ ...rede, v: 0, e: codificar(m), n: 0, tq: '', at: barPresence.now() });
  };
  const largar = () => {
    if (!rede) return;
    setBranca(null);
    publicar({ a: '', b: '', v: 0, e: codificar(novaMesa(1)), n: 0, tq: '', at: barPresence.now() });
  };
  const daVez = (f: number, dir: { dx: number; dy: number } = mira) => {
    if (!mesa) return;
    const t = { ...dir, forca: f, ...(mesa.bolaNaMao && branca ? { branca } : {}) };
    setBranca(null);
    tacar(mesa, t);
  };

  const grupoTxt = (lado: 0 | 1) => {
    const g = mesa?.grupo[lado];
    return g ? (g === 'lisas' ? 'lisas (1–7)' : 'listradas (9–15)') : 'mesa aberta';
  };
  const restam = (lado: 0 | 1) => {
    const g = mesa?.grupo[lado];
    return g && mesa ? mesa.bolas.filter((b) => b.n !== 0 && b.n !== 8 && !b.dentro && grupoDe(b.n) === g).length : null;
  };

  return (
    <div className="vivo-sinuca">
      {livre ? (
        <div className="vivo-sinuca-vagas">
          <p className="bar-note">
            Mesa {i + 1} livre. Vaga 1: <b>{PLAYER_BY_ID[player].name}</b>. Vaga 2:
          </p>
          <div className="segmented" role="radiogroup" aria-label="Quem joga na vaga 2">
            {(['bot1', 'bot2', 'bot3', ''] as const).map((v) => (
              <button key={v || 'aberta'} type="button" role="radio" aria-checked={vaga2 === v} className={vaga2 === v ? 'is-on' : ''} onClick={() => setVaga2(v)}>
                {v ? nomeVaga(v) : 'Aberta (amigo online)'}
              </button>
            ))}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={abrir}>
              Arrumar as bolas
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="vivo-sinuca-placar">
            <span className={mesa?.vez === 0 ? 'is-vez' : ''}>
              {nomeVaga(rede!.a)} · {grupoTxt(0)}
              {restam(0) !== null ? ` · faltam ${restam(0)}` : ''}
            </span>
            <span className={mesa?.vez === 1 ? 'is-vez' : ''}>
              {nomeVaga(rede!.b)} · {grupoTxt(1)}
              {restam(1) !== null ? ` · faltam ${restam(1)}` : ''}
            </span>
          </p>
          <canvas
            ref={canvasRef}
            className={`vivo-sinuca-mesa${puxando ? ' is-puxando' : ''}`}
            tabIndex={0}
            onPointerMove={onMove}
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
            onKeyDown={onTecla}
            onKeyUp={onSoltaTecla}
            aria-label={`Mesa de sinuca ${i + 1}: mire, clique e segure, arraste para baixo para carregar e solte para tacar (teclado: setas e espaço)`}
          />
          {mesa?.fim ? (
            <div className="vivo-sinuca-fim">
              <p>
                🎱 <b>{nomeVaga(mesa.fim.vencedor === 0 ? rede!.a : rede!.b)}</b> venceu. {mesa.fim.motivo}.
              </p>
              {meuLado !== null && (
                <div className="modal-actions">
                  <button type="button" className="btn btn-primary" onClick={revanche}>
                    Revanche
                  </button>
                  <button type="button" className="btn" onClick={largar}>
                    Largar a mesa
                  </button>
                </div>
              )}
            </div>
          ) : meuLado === null ? (
            <div className="modal-actions">
              {rede!.b === '' && rede!.a !== player ? (
                <button type="button" className="btn btn-primary" onClick={entrar}>
                  Pegar a vaga 2 contra {nomeVaga(rede!.a)}
                </button>
              ) : (
                <p className="bar-note">Mesa ocupada: você está assistindo.</p>
              )}
            </div>
          ) : (
            <div className="vivo-sinuca-controles">
              {rede!.b === '' ? (
                <p className="bar-note">Esperando um amigo online pegar a vaga 2…</p>
              ) : minhaVez ? (
                <>
                  <p className="bar-note">
                    {mesa?.bolaNaMao && !branca
                      ? 'Bola na mão: toque na mesa para pôr a branca.'
                      : puxando
                        ? `Força ${Math.round(forca * 100)} %: solte para tacar (volte ao ponto do clique para desistir).`
                        : 'Sua vez: mire, clique e segure, arraste para baixo para carregar e solte.'}
                  </p>
                </>
              ) : (
                <p className="bar-note">{animando ? 'Rolando…' : `Vez de ${nomeVaga(vagaDaVez)}…`}</p>
              )}
              {advSaiu && (
                <button type="button" className="btn" onClick={largar}>
                  {nomeVaga(adversario)} saiu do bar: encerrar a mesa
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
