/**
 * Moscaria, a tela (Fatia 13). Carregada só quando o portal abre (import dinâmico). A simulação vem de ./sim (pura);
 * aqui só se desenha, se lê o controle e se grava o que você fez (entradas para a prova e posições para o fantasma).
 *
 * Desenho: canvas 2D em resolução baixa (400 × 240) esticado sem suavizar, câmera que segue o garçom, piso xadrez,
 * mesas gigantes, moscas desenhadas por código (asa batendo), o garçom com a sua aparência do bar.
 */
import { useEffect, useRef, useState } from 'react';
import { buildBarGridLook, polir, type Look } from '../../arena/sprites';
import { movimentoReduzido } from '../../vivo/movimento';
import { FANTASMA_PASSOS, gravarFantasma } from '../portal';
import {
  CURVA,
  MESAS,
  MOSCAS,
  NOME_ARMA,
  NOME_PASSIVA,
  ARMA_NIVEL,
  PASSOS_RUN,
  DT,
  jogarGravando,
  novaMoscaria,
  pontuacao,
  segundos,
  xpDoNivel,
  type Carta,
  type Gravada,
  type Moscaria,
  type Mosca,
} from './sim';
import { desligarEnxame, enxameCom, ligarEnxame, somMosca } from './somMoscas';
import './moscas.css';

export interface ResultadoMoscas {
  pontos: number;
  venceu: boolean;
  rainha: boolean;
  mortas: number;
  nivel: number;
  segundos: number;
  /** Posições 5 vezes por segundo, para o fantasma dos amigos. */
  fantasma: string;
  /** Entradas gravadas (a prova de que a run é reproduzível). */
  entradas: number;
}

export interface FantasmaAmigo {
  nome: string;
  cor: string;
  pts: { x: number; y: number }[];
}

interface Props {
  look: Look;
  semente: number;
  fantasmas: FantasmaAmigo[];
  onFim: (r: ResultadoMoscas) => void;
}

const W = 400;
const H = 240;
const U = 16; // px por unidade

/** O boneco do bar num canvas (frente parada e passo). */
function bonecoCanvas(L: Look, pose: 'front' | 'front-a' | 'front-b'): HTMLCanvasElement {
  const g = polir(buildBarGridLook(L, pose));
  const cv = document.createElement('canvas');
  cv.width = g[0].length;
  cv.height = g.length;
  const ctx = cv.getContext('2d')!;
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y].length; x++) {
      const c = g[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  return cv;
}

const COR_MOSCA: Record<Mosca['tipo'], [string, string, string]> = {
  // corpo, sombra do corpo, olho
  comum: ['#3a4466', '#262b44', '#e43b44'],
  rapida: ['#265c42', '#193c3e', '#feae34'],
  gorda: ['#68386c', '#3e2731', '#e43b44'],
  cuspidora: ['#8f563b', '#5c3620', '#63c74d'],
  rainha: ['#c28a1f', '#8f563b', '#e43b44'],
};

/**
 * A rainha tem desenho próprio (o quadrado das outras ficava um bloco chapado nesse tamanho): cabeça com olhos
 * compostos, tórax, abdômen listrado, asas com nervura batendo e 6 pernas, luz de cima à esquerda. Na fase 3 o
 * abdômen pulsa em vermelho.
 */
function desenharRainha(c: CanvasRenderingContext2D, f: Mosca, x: number, y: number, passo: number, calmo: boolean) {
  const r = Math.round(MOSCAS.rainha.raio * U);
  const bate = calmo ? 0 : Math.floor((passo + f.id) / 4) % 2;
  const fase3 = f.vida <= MOSCAS.rainha.vida / 3;
  const px = (cor: string, dx: number, dy: number, w: number, h: number) => {
    c.fillStyle = cor;
    c.fillRect(x + dx, y + dy, w, h);
  };
  // Sombra larga no chão.
  c.fillStyle = 'rgba(14,11,22,0.4)';
  c.beginPath();
  c.ellipse(x, y + r + 2, r * 1.1, 4, 0, 0, Math.PI * 2);
  c.fill();
  // Asas (atrás do corpo): duas folhas translúcidas com nervura, abrindo e fechando.
  for (const lado of [-1, 1]) {
    c.save();
    c.translate(x + lado * 6, y - 6);
    c.rotate(lado * (bate ? 0.55 : 0.25));
    c.fillStyle = 'rgba(192,203,220,0.55)';
    c.beginPath();
    c.ellipse(lado * 14, -4, 15, 7, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(244,244,244,0.75)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(lado * 26, -6);
    c.moveTo(lado * 8, -2);
    c.lineTo(lado * 20, 2);
    c.stroke();
    c.restore();
  }
  // Pernas (3 de cada lado, finas e escuras).
  for (let i = 0; i < 3; i++)
    for (const lado of [-1, 1]) {
      const yy = -2 + i * 7;
      // Saem da borda do corpo (±10) para fora e dobram para baixo.
      px('#3e2731', lado < 0 ? -16 : 10, yy, 6, 2);
      px('#3e2731', lado < 0 ? -18 : 16, yy + 1, 2, 5);
    }
  // Abdômen listrado (embaixo), com luz em cima.
  const ab = fase3 && Math.floor(passo / 6) % 2 ? '#e43b44' : '#c28a1f';
  px('#5c3620', -11, 1, 22, 20);
  px(ab, -10, 1, 20, 18);
  px('#feae34', -9, 2, 8, 2);
  for (let i = 0; i < 3; i++) px('#3e2731', -10, 6 + i * 5, 20, 2);
  px('#3e2731', -3, 19, 6, 3);
  // Tórax.
  px('#5c3620', -9, -10, 18, 12);
  px('#8f563b', -8, -10, 16, 10);
  px('#c28a1f', -7, -9, 6, 2);
  // Cabeça com os olhos compostos vermelhos dos lados.
  px('#3e2731', -8, -19, 16, 10);
  px('#e43b44', -10, -19, 7, 8);
  px('#e43b44', 3, -19, 7, 8);
  px('#f4f4f4', -9, -18, 2, 2);
  px('#f4f4f4', 4, -18, 2, 2);
  px('#a22633', -6, -13, 3, 2);
  px('#a22633', 7, -13, 3, 2);
  // Coroa de tampinha de garrafa.
  px('#feae34', -6, -24, 12, 3);
  for (let i = -6; i <= 4; i += 3) px('#feae34', i, -26, 2, 2);
  px('#e43b44', -1, -23, 2, 1);
  // Vida da rainha.
  px('#181425', -16, -32, 32, 3);
  px('#e43b44', -15, -31, Math.max(0, Math.round((30 * f.vida) / MOSCAS.rainha.vida)), 1);
}

function desenharMosca(c: CanvasRenderingContext2D, f: Mosca, x: number, y: number, passo: number, calmo: boolean) {
  if (f.tipo === 'rainha') {
    desenharRainha(c, f, x, y, passo, calmo);
    return;
  }
  const r = Math.max(3, Math.round(MOSCAS[f.tipo].raio * U));
  const [corpo, sombra, olho] = COR_MOSCA[f.tipo];
  const asa = calmo ? 0 : (Math.floor((passo + f.id * 3) / 3) % 2) * 2;
  // Sombra no chão.
  c.fillStyle = 'rgba(14,11,22,0.35)';
  c.fillRect(x - r, y + r - 1, r * 2, 2);
  // Asas (translúcidas, batendo).
  c.fillStyle = 'rgba(192,203,220,0.7)';
  c.fillRect(x - r - 2, y - r + asa, r, Math.max(2, r - 1));
  c.fillRect(x + 2, y - r + asa, r, Math.max(2, r - 1));
  // Corpo.
  c.fillStyle = sombra;
  c.fillRect(x - r + 1, y - r + 2, r * 2 - 2, r * 2 - 2);
  c.fillStyle = corpo;
  c.fillRect(x - r + 1, y - r + 1, r * 2 - 3, r * 2 - 3);
  // Olhos grandes.
  const o = Math.max(1, Math.round(r / 3));
  c.fillStyle = olho;
  c.fillRect(x - o - 1, y - r + 1, o, o);
  c.fillRect(x + 1, y - r + 1, o, o);
  if (f.tipo === 'gorda' && f.vida < MOSCAS.gorda.vida) {
    c.fillStyle = '#e43b44';
    c.fillRect(x - r, y - r - 4, Math.round((2 * r * f.vida) / MOSCAS.gorda.vida), 1);
  }
}

function textoCarta(c: Carta, m: Moscaria): { titulo: string; nivel: string } {
  if (c.k === 'arma') {
    const n = (m.armas[c.arma] ?? 0) + 1;
    return { titulo: NOME_ARMA[c.arma], nivel: n === 1 ? 'nova' : `nível ${n}` };
  }
  const n = (m.passivas[c.passiva] ?? 0) + 1;
  return { titulo: NOME_PASSIVA[c.passiva], nivel: `nível ${n}` };
}

export default function MoscasTela({ look: lookProp, semente, fantasmas: fantasmasProp, onFim }: Props) {
  // O visual e os fantasmas ficam os da abertura: o bar redesenha várias vezes por segundo (objetos novos a cada vez),
  // e o laço do jogo não pode recomeçar por isso (perderia a gravação e o fantasma da run).
  const [look] = useState(lookProp);
  const [fantasmas] = useState(fantasmasProp);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [fase, setFase] = useState<'intro' | 'jogo' | 'fim'>('intro');
  const [hud, setHud] = useState({ copos: CURVA.copos, max: CURVA.copos, resta: 100, nivel: 1, xp: 0, xpMax: xpDoNivel(1), pontos: 0, combo: 0, gritou: false, rainha: false });
  const [cartas, setCartas] = useState<Carta[] | null>(null);
  const [resultado, setResultado] = useState<ResultadoMoscas | null>(null);
  const mundo = useRef<Moscaria>(novaMoscaria(semente));
  const teclas = useRef(new Set<string>());
  const stick = useRef({ x: 0, y: 0 });
  const pedido = useRef<{ grita: boolean; carta?: number }>({ grita: false });
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false });
  const base = useRef<{ x: number; y: number; id: number } | null>(null);
  const onFimRef = useRef(onFim);
  onFimRef.current = onFim;

  // Teclado: WASD/setas andam, espaço grita, 1/2/3 escolhem carta.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat && e.code === 'Space') pedido.current.grita = true;
      if (!e.repeat && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) pedido.current.carta = Number(e.code.slice(5)) - 1;
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
    const m = mundo.current;
    const calmo = movimentoReduzido();
    const grav: Gravada[] = [];
    const ultimo = { d: -1 };
    const amostras: { x: number; y: number }[] = [{ x: m.x, y: m.y }];
    const boneco = [bonecoCanvas(look, 'front'), bonecoCanvas(look, 'front-a'), bonecoCanvas(look, 'front-b')];
    const flashes: { k: 'chinelada' | 'jato' | 'vento' | 'grito'; x: number; y: number; ang: number; r: number; t: number }[] = [];
    const mortes: { x: number; y: number; t: number; cor: string }[] = [];
    let tremor = 0;
    let acum = 0;
    let antes = performance.now();
    let raf = 0;
    let acabou = false;
    let ultimoHud = 0;
    // Só o gancho de teste liga: o quadro automático para de andar a simulação (a aba visível não briga com o teste).
    const ctl = { pausa: false };
    ligarEnxame();

    const entrada = () => {
      const k = teclas.current;
      let ux = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      let uy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
      if (!ux && !uy) {
        ux = stick.current.x;
        uy = stick.current.y;
      }
      const p = pedido.current;
      const e = { mx: ux, my: uy, grita: p.grita || undefined, carta: m.cartas ? p.carta : undefined };
      p.grita = false;
      if (m.cartas && p.carta !== undefined) p.carta = undefined;
      return e;
    };

    const terminar = () => {
      acabou = true;
      desligarEnxame();
      const r: ResultadoMoscas = {
        pontos: pontuacao(m),
        venceu: m.fim === 'venceu',
        rainha: m.rainhaMorta,
        mortas: m.mortas,
        nivel: m.nivel,
        segundos: Math.round(segundos(m.passo)),
        fantasma: gravarFantasma(amostras),
        entradas: grav.length,
      };
      somMosca(r.venceu ? 'venceu' : 'perdeu');
      setResultado(r);
      setFase('fim');
    };

    const desenhar = (agora: number) => {
      const cx = Math.round(m.x * U - W / 2 + (tremor && !calmo ? (Math.random() - 0.5) * tremor : 0));
      const cy = Math.round(m.y * U - H / 2 + (tremor && !calmo ? (Math.random() - 0.5) * tremor : 0));
      tremor = Math.max(0, tremor - 0.5);
      // Piso xadrez de boteco (fora da arena, parede escura).
      c.fillStyle = '#1a0f2e';
      c.fillRect(0, 0, W, H);
      const ini = Math.floor(cx / (U * 2));
      const jni = Math.floor(cy / (U * 2));
      for (let i = ini; i <= ini + W / (U * 2) + 1; i++)
        for (let j = jni; j <= jni + H / (U * 2) + 1; j++) {
          if (i < 0 || j < 0 || i * 2 >= CURVA.largura || j * 2 >= CURVA.altura) continue;
          c.fillStyle = (i + j) % 2 ? '#c9a86a' : '#8f563b';
          c.fillRect(i * U * 2 - cx, j * U * 2 - cy, U * 2, U * 2);
        }
      // Borda da arena.
      c.strokeStyle = '#e43b44';
      c.lineWidth = 2;
      c.strokeRect(-cx, -cy, CURVA.largura * U, CURVA.altura * U);
      // Faixas no chão (fita amarela e poça de chope).
      for (const fx of m.faixas) {
        c.fillStyle = fx.k === 'fita' ? 'rgba(254,231,97,0.55)' : 'rgba(254,174,52,0.45)';
        c.beginPath();
        c.ellipse(fx.x * U - cx, fx.y * U - cy, fx.r * U, fx.r * U * 0.6, 0, 0, Math.PI * 2);
        c.fill();
      }
      // Mesas gigantes (tampo de madeira, borda e pés).
      for (const t of MESAS) {
        const x = t.x * U - cx;
        const y = t.y * U - cy;
        c.fillStyle = '#3e2731';
        c.fillRect(x + 2, y + t.h * U, t.w * U - 4, 6);
        c.fillStyle = '#a96a40';
        c.fillRect(x, y, t.w * U, t.h * U);
        c.fillStyle = '#c28a1f';
        c.fillRect(x, y, t.w * U, 3);
        c.fillStyle = '#e8b796';
        c.fillRect(x + 6, y + 6, 10, 3);
      }
      // Gemas de XP (gotinhas verdes).
      for (const g of m.gemas) {
        c.fillStyle = g.xp > 1 ? '#2ce8f5' : '#63c74d';
        c.fillRect(Math.round(g.x * U - cx) - 2, Math.round(g.y * U - cy) - 2, 4, 4);
      }
      // Fantasmas dos amigos (o mesmo dia, a mesma semente).
      const idx = Math.floor(m.passo / FANTASMA_PASSOS);
      for (const f of fantasmas) {
        const p = f.pts[Math.min(idx, f.pts.length - 1)];
        if (!p || idx >= f.pts.length + 5) continue;
        c.globalAlpha = 0.45;
        c.fillStyle = f.cor;
        c.fillRect(Math.round(p.x * U - cx) - 5, Math.round(p.y * U - cy) - 14, 10, 14);
        c.globalAlpha = 1;
        c.fillStyle = '#f4f4f4';
        c.font = '8px VT323, monospace';
        c.fillText(f.nome, Math.round(p.x * U - cx) - 8, Math.round(p.y * U - cy) - 17);
      }
      // Moscas.
      for (const f of m.moscas) desenharMosca(c, f, Math.round(f.x * U - cx), Math.round(f.y * U - cy), m.passo, calmo);
      // Cuspes (bola de caldo).
      for (const s of m.cuspes) {
        c.fillStyle = '#8f563b';
        c.fillRect(Math.round(s.x * U - cx) - 3, Math.round(s.y * U - cy) - 3, 6, 6);
        c.fillStyle = '#c28a1f';
        c.fillRect(Math.round(s.x * U - cx) - 2, Math.round(s.y * U - cy) - 2, 2, 2);
      }
      // Raquetes em órbita.
      const nr = m.armas.raquetes;
      if (nr) {
        const A = ARMA_NIVEL.raquetes;
        const i = nr - 1;
        for (let k = 0; k < A.n[i]; k++) {
          const a = m.passo * DT * A.giro[i] + (k / A.n[i]) * Math.PI * 2;
          const x = Math.round((m.x + Math.cos(a) * A.raio[i]) * U - cx);
          const y = Math.round((m.y + Math.sin(a) * A.raio[i]) * U - cy);
          c.fillStyle = '#feae34';
          c.fillRect(x - 4, y - 5, 8, 8);
          c.fillStyle = '#124e89';
          c.fillRect(x - 3, y - 4, 6, 6);
          c.fillStyle = '#2ce8f5';
          c.fillRect(x - 1, y - 4, 1, 6);
        }
      }
      // Golpes no ar (arco da chinelada, cone do jato, anel do vento, onda do grito).
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        const u = (agora - f.t) / (f.k === 'grito' ? 500 : 160);
        if (u >= 1) {
          flashes.splice(i, 1);
          continue;
        }
        const x = f.x * U - cx;
        const y = f.y * U - cy;
        c.globalAlpha = 1 - u;
        if (f.k === 'chinelada') {
          c.strokeStyle = '#f4f4f4';
          c.lineWidth = 3;
          c.beginPath();
          c.arc(x, y, f.r * U * (0.7 + 0.3 * u), f.ang - 1.1, f.ang + 1.1);
          c.stroke();
        } else if (f.k === 'jato') {
          c.fillStyle = 'rgba(154,208,255,0.6)';
          c.beginPath();
          c.moveTo(x, y);
          c.arc(x, y, f.r * U, f.ang - 0.35, f.ang + 0.35);
          c.closePath();
          c.fill();
        } else {
          c.strokeStyle = f.k === 'grito' ? '#fee761' : '#c0cbdc';
          c.lineWidth = 2;
          c.beginPath();
          c.arc(x, y, f.r * U * u, 0, Math.PI * 2);
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      // Mortes: um respingo que some.
      for (let i = mortes.length - 1; i >= 0; i--) {
        const d = mortes[i];
        const u = (agora - d.t) / 300;
        if (u >= 1) {
          mortes.splice(i, 1);
          continue;
        }
        c.fillStyle = d.cor;
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          c.fillRect(Math.round(d.x * U - cx + Math.cos(a) * u * 8), Math.round(d.y * U - cy + Math.sin(a) * u * 8), 2, 2);
        }
      }
      // O garçom (pisca invulnerável).
      const pisca = m.passo < m.invulAte && Math.floor(agora / 80) % 2 === 0;
      if (!pisca) {
        const andando = Math.hypot(stick.current.x, stick.current.y) > 0.3 || teclas.current.size > 0;
        const b = boneco[andando ? 1 + (Math.floor(agora / 140) % 2) : 0];
        const bx = Math.round(m.x * U - cx - b.width / 2);
        const by = Math.round(m.y * U - cy - b.height + 4);
        c.fillStyle = 'rgba(14,11,22,0.4)';
        c.fillRect(bx + 4, by + b.height - 3, b.width - 8, 3);
        c.drawImage(b, bx, by);
      }
    };

    // Um passo da simulação mais os efeitos de tela e som dos eventos dele.
    const umPasso = (agora: number, ent: ReturnType<typeof entrada>) => {
      jogarGravando(m, ent, grav, ultimo);
      if (m.passo % FANTASMA_PASSOS === 0 && amostras.length * FANTASMA_PASSOS <= m.passo) amostras.push({ x: m.x, y: m.y });
      for (const e of m.ev) {
        if (e.k === 'chinelada') {
          flashes.push({ k: 'chinelada', x: e.x, y: e.y, ang: e.ang, r: e.alcance, t: agora });
          somMosca('chinelada');
        } else if (e.k === 'jato') flashes.push({ k: 'jato', x: e.x, y: e.y, ang: e.ang, r: e.alcance, t: agora });
        else if (e.k === 'vento') flashes.push({ k: 'vento', x: e.x, y: e.y, ang: 0, r: e.r, t: agora });
        else if (e.k === 'grito') {
          flashes.push({ k: 'grito', x: e.x, y: e.y, ang: 0, r: CURVA.gritoRaio, t: agora });
          somMosca('grito');
          tremor = 6;
        } else if (e.k === 'morreu') {
          mortes.push({ x: e.x, y: e.y, t: agora, cor: COR_MOSCA[e.tipo][0] });
          if (mortes.length > 40) mortes.shift();
          somMosca('morreu');
        } else if (e.k === 'dano') {
          somMosca('dano');
          tremor = 5;
        } else if (e.k === 'cuspe') somMosca('cuspe');
        else if (e.k === 'nivel') somMosca('nivel');
        else if (e.k === 'rainha') somMosca('rainha');
      }
    };

    const mostrar = (agora: number, hudJa = false) => {
      setCartas((atual) => (atual === m.cartas ? atual : m.cartas));
      desenhar(agora);
      if (hudJa || m.fim || agora - ultimoHud > 120) {
        ultimoHud = agora;
        enxameCom(m.moscas.length);
        setHud({
          copos: m.copos,
          max: m.coposMax,
          resta: Math.max(0, Math.ceil((PASSOS_RUN - m.passo) * DT)),
          nivel: m.nivel,
          xp: m.xp,
          xpMax: xpDoNivel(m.nivel),
          pontos: pontuacao(m),
          combo: m.combo,
          gritou: m.gritou,
          rainha: m.rainha && !m.rainhaMorta,
        });
      }
      if (m.fim && !acabou) terminar();
    };

    const quadro = (agora: number) => {
      if (acabou) return;
      acum = Math.min(acum + (agora - antes) / 1000, 0.1);
      antes = agora;
      let passos = 0;
      while (acum >= DT && passos < 6 && !m.fim && !ctl.pausa) {
        acum -= DT;
        passos++;
        umPasso(agora, entrada());
      }
      mostrar(agora);
      if (!acabou) raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    // Gancho de teste (só em desenvolvimento): numa aba em segundo plano o quadro automático não roda, então o teste
    // avança a simulação à mão. `ent(i)` devolve a entrada do passo i (padrão: a do teclado e do joystick).
    type Ent = ReturnType<typeof entrada>;
    if (import.meta.env.DEV)
      (window as unknown as { __moscas?: unknown }).__moscas = {
        m,
        grav,
        ctl,
        passos(n: number, ent?: (i: number) => Partial<Ent>) {
          const agora = performance.now();
          for (let i = 0; i < n && !m.fim; i++) umPasso(agora, { ...entrada(), ...(ent ? ent(i) : {}) } as Ent);
          mostrar(agora, true);
          return { passo: m.passo, copos: m.copos, vivas: m.moscas.length, nivel: m.nivel, pontos: pontuacao(m), fim: m.fim, cartas: m.cartas };
        },
        foto: () => cv.toDataURL('image/png'),
      };
    return () => {
      cancelAnimationFrame(raf);
      desligarEnxame();
      if (import.meta.env.DEV) delete (window as unknown as { __moscas?: unknown }).__moscas;
    };
  }, [fase, look, fantasmas]);

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

  return (
    <div className="gfa mc" role="dialog" aria-label="Moscaria">
      <canvas ref={cvRef} className="mc-tela" width={W} height={H} />
      {fase === 'intro' && (
        <div className="mc-intro">
          <p className="mc-logo">MOSCARIA</p>
          <p>
            Rocky: — Abri o portal na hora do almoço de uma dimensão onde as moscas cresceram. Você é o garçom. Anda que o
            chinelo bate sozinho; sobe de nível e escolhe o que levar. A rainha chega aos 85 s.
          </p>
          <p className="mc-nota">WASD ou setas andam · espaço grita (uma vez) · 1, 2, 3 escolhem a carta. No celular: joystick e o botão 📣.</p>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => {
              setFase('jogo');
            }}
          >
            Começar
          </button>
        </div>
      )}
      {fase !== 'intro' && (
        <div className="mc-hud" aria-live="polite">
          <span aria-label={`${hud.copos} de ${hud.max} copos`}>
            {'🍺'.repeat(Math.max(0, hud.copos))}
            <span className="mc-vazio">{'🍺'.repeat(Math.max(0, hud.max - hud.copos))}</span>
          </span>
          <span>⏱ {hud.resta}s</span>
          <span className="mc-xp" role="progressbar" aria-label={`Nível ${hud.nivel}`} aria-valuemin={0} aria-valuemax={hud.xpMax} aria-valuenow={hud.xp}>
            <i style={{ width: `${Math.min(100, (hud.xp / Math.max(1, hud.xpMax)) * 100)}%` }} />
            <b>Nv {hud.nivel}</b>
          </span>
          <span>
            {hud.pontos} pts{hud.combo >= 10 ? ` · combo ${hud.combo}` : ''}
          </span>
          {hud.rainha && <span className="mc-rainha">👑 A RAINHA</span>}
        </div>
      )}
      {fase === 'jogo' && (
        <>
          <div className="vivo-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} aria-hidden="true">
            <span style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} className={knob.on ? 'is-on' : ''} />
          </div>
          <button
            type="button"
            className="mc-gritar"
            disabled={hud.gritou}
            aria-label="Gritar (espaço): uma vez por run"
            onPointerDown={(e) => {
              e.preventDefault();
              pedido.current.grita = true;
            }}
          >
            📣
          </button>
        </>
      )}
      {fase === 'jogo' && cartas && (
        <div className="mc-cartas" role="dialog" aria-label="Subiu de nível: escolha uma">
          <p>Subiu de nível! Escolha uma:</p>
          <div>
            {cartas.map((ct, i) => {
              const tx = textoCarta(ct, mundo.current);
              return (
                <button key={i} type="button" className="mc-carta" onClick={() => (pedido.current.carta = i)}>
                  <small>{i + 1}</small>
                  <b>{tx.titulo}</b>
                  <span>{tx.nivel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {fase === 'fim' && resultado && (
        <div className="mc-intro">
          <p className="mc-logo">{resultado.rainha ? 'A RAINHA CAIU' : resultado.venceu ? 'SOBREVIVEU' : 'O ENXAME VENCEU'}</p>
          <p>
            {resultado.pontos} pontos · {resultado.mortas} moscas · nível {resultado.nivel} · {resultado.segundos} s
          </p>
          <p>
            {resultado.rainha
              ? 'Rocky: — A RAINHA?! Vou mandar empalhar e pendurar atrás do balcão. Ninguém vai acreditar.'
              : resultado.venceu
                ? 'Rocky: — Aguentou os 100 segundos! Fecha, fecha, fecha… uma passou pelo portal. Deixa, é só uma.'
                : 'Rocky: — Puxei você pelo avental bem na hora. Respira, que em 5 minutos o portal abre de novo.'}
          </p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => onFimRef.current(resultado)}>
            Voltar ao bar
          </button>
        </div>
      )}
    </div>
  );
}
