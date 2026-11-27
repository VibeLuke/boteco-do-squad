/**
 * DANCE (chefe: a quadrilha): 6 setas descem até a linha do "anarriê", no ritmo da sanfona. Na hora em que a seta
 * cruza a linha, aperte a mesma direção (stick, setas ou WASD). Direção errada na hora conta como erro; não apertar
 * também. Acertou 4 das 6, a quadrilha passa; 3 erros, o par tropeça. Vale 3 pontos e dura até 10 s.
 * A janela de cada seta é de 300 ms na velocidade 1, como nos outros.
 */
import { base, janela, passosDe, type Base, type EntradaQ, type Micro } from './tipos';

/** 1 direita, 2 baixo, 3 esquerda, 4 cima. */
type Dir = 1 | 2 | 3 | 4;
interface Seta {
  dir: Dir;
  /** Passo em que cruza a linha. */
  em: number;
  /** 0 pendente, 1 acertou, −1 errou. */
  ok: 0 | 1 | -1;
}
interface E extends Base {
  setas: Seta[];
  /** Meia janela em passos. */
  meia: number;
  /** Direção do passo anterior (só conta quando muda: apertar, não segurar). */
  antes: number;
  acertos: number;
  erros: number;
}

export const N_SETAS = 6;
export const PRECISA = 4;
const VET: Record<Dir, [number, number]> = { 1: [1, 0], 2: [0, 1], 3: [-1, 0], 4: [0, -1] };

/** Direção do stick em 4 (0 = solto). */
export function dir4(mx: number, my: number): number {
  if (Math.hypot(mx, my) < 0.5) return 0;
  return Math.abs(mx) >= Math.abs(my) ? (mx > 0 ? 1 : 3) : my > 0 ? 2 : 4;
}

const atual = (e: E) => e.setas.find((s) => s.ok === 0);
const naHora = (e: E, s: Seta | undefined) => !!s && Math.abs(e.t - s.em) <= e.meia;

function fechar(e: E) {
  // Errou mais do que dá para errar: tropeçou na hora. Senão, decide quando a última seta passar.
  if (e.erros > N_SETAS - PRECISA) e.res = 'perdeu';
  else if (e.setas.every((s) => s.ok !== 0)) e.res = e.acertos >= PRECISA ? 'ganhou' : 'perdeu';
}

export const micro: Micro<E> = {
  id: 'dance',
  verbo: 'DANCE',
  nome: 'Quadrilha',
  chefe: true,
  segundos: 10,
  iniciar(r, vel) {
    const setas: Seta[] = [];
    let ultima = 0;
    for (let i = 0; i < N_SETAS; i++) {
      // Sem repetir a seta anterior (o pé não fica parado).
      let d = (1 + Math.floor(r() * 4)) as Dir;
      if (d === ultima) d = ((d % 4) + 1) as Dir;
      ultima = d;
      setas.push({ dir: d, em: passosDe(1.4 + i * 1.1, vel), ok: 0 });
    }
    return { ...base(vel, this.segundos), setas, meia: Math.max(1, Math.round((janela(vel) / 2) * 60)), antes: 0, acertos: 0, erros: 0 };
  },
  passo(e, ent: EntradaQ) {
    if (e.res !== 'andando') {
      e.t++;
      return;
    }
    const d = dir4(ent.mx, ent.my);
    const apertou = d !== 0 && d !== e.antes;
    e.antes = d;
    const s = atual(e);
    if (apertou && s && naHora(e, s)) {
      s.ok = s.dir === d ? 1 : -1;
      if (s.ok === 1) e.acertos++;
      else e.erros++;
    }
    // Seta que passou da linha sem aperto: erro.
    for (const x of e.setas)
      if (x.ok === 0 && e.t > x.em + e.meia) {
        x.ok = -1;
        e.erros++;
      }
    fechar(e);
    if (e.res !== 'andando') return;
    e.t++;
    if (e.t >= e.dur) e.res = e.acertos >= PRECISA ? 'ganhou' : 'perdeu';
  },
  resultado: (e) => e.res,
  pronto: (e) => e.res === 'andando' && naHora(e, atual(e)),
  // Perfeito: aperta a seta certa no passo exato em que ela cruza a linha (e solta nos outros).
  bot: (e) => {
    const s = atual(e);
    if (!s || e.t !== s.em) return { mx: 0, my: 0 };
    const [x, y] = VET[s.dir];
    return { mx: x, my: y };
  },
  resposta: (e) => {
    const s = atual(e);
    if (!s) return { mx: 0, my: 0 };
    const [x, y] = VET[s.dir];
    return { mx: x, my: y };
  },
  tempo: (e) => ({ t: e.t, dur: e.dur }),
  desenhar(c, e, w, h, q) {
    // Arraial à noite: chão de terra, fogueira ao fundo e varal de lâmpadas.
    c.fillStyle = '#1b2848';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#5c3620';
    c.fillRect(0, h - 70, w, 70);
    for (let i = 0; i < 20; i++) {
      c.fillStyle = (i + Math.floor(q / 15)) % 3 ? '#fee761' : '#feae34';
      c.fillRect(i * 21 + 6, 10 + Math.round(Math.sin(i * 0.7) * 3), 4, 4);
    }
    // Trilha das setas (à direita) e a linha do anarriê.
    const tx = w - 90;
    const linha = 150;
    c.fillStyle = 'rgba(24,20,37,0.6)';
    c.fillRect(tx - 30, 24, 60, h - 100);
    c.fillStyle = '#feae34';
    c.fillRect(tx - 30, linha - 1, 60, 3);
    const passosPorPx = 0.9;
    for (const s of e.setas) {
      const y = Math.round(linha - (s.em - e.t) / passosPorPx);
      if (y < 20 || y > h - 70) continue;
      const cor = s.ok === 1 ? '#63c74d' : s.ok === -1 ? '#e43b44' : '#f4f4f4';
      seta(c, tx, y, s.dir, cor);
    }
    // O par da quadrilha (pula no acerto, tropeça no erro).
    const ultimo = [...e.setas].reverse().find((s) => s.ok !== 0);
    const pulo = ultimo && e.t - ultimo.em < 12 && ultimo.ok === 1 ? 6 : 0;
    const torto = ultimo && e.t - ultimo.em < 12 && ultimo.ok === -1 ? 4 : 0;
    par(c, 110, h - 70 - pulo, torto, q);
    c.fillStyle = '#f4f4f4';
    c.font = '10px VT323, monospace';
    c.fillText(`${e.acertos}/${PRECISA} acertos · ${e.erros} erro(s)`, 16, 40);
  },
};

function seta(c: CanvasRenderingContext2D, x: number, y: number, d: Dir, cor: string) {
  c.save();
  c.translate(x, y);
  c.rotate([0, Math.PI / 2, Math.PI, -Math.PI / 2][d - 1]);
  c.fillStyle = '#181425';
  c.fillRect(-11, -5, 14, 10);
  c.fillStyle = cor;
  c.fillRect(-10, -4, 12, 8);
  c.beginPath();
  c.moveTo(2, -10);
  c.lineTo(12, 0);
  c.lineTo(2, 10);
  c.fill();
  c.restore();
}

function par(c: CanvasRenderingContext2D, x: number, y: number, torto: number, q: number) {
  const balanco = Math.floor(q / 10) % 2 ? 1 : -1;
  // Ele: camisa xadrez e chapéu de palha.
  c.fillStyle = '#262b44';
  c.fillRect(x - 6, y - 12, 4, 12);
  c.fillRect(x + 1, y - 12, 4, 12);
  c.fillStyle = '#e43b44';
  c.fillRect(x - 8 + torto, y - 28, 16, 16);
  c.fillStyle = '#f4f4f4';
  c.fillRect(x - 4 + torto, y - 24, 3, 3);
  c.fillRect(x + 2 + torto, y - 18, 3, 3);
  c.fillStyle = '#e8b796';
  c.fillRect(x - 5 + torto, y - 38, 10, 10);
  c.fillStyle = '#feae34';
  c.fillRect(x - 9 + torto, y - 40, 18, 3);
  c.fillRect(x - 5 + torto, y - 45, 10, 5);
  // Ela: vestido de chita que gira.
  const ex = x + 34;
  c.fillStyle = '#b55088';
  c.fillRect(ex - 12 + balanco, y - 16, 24, 16);
  c.fillStyle = '#fee761';
  for (let i = 0; i < 4; i++) c.fillRect(ex - 10 + i * 6 + balanco, y - 12 + (i % 2) * 5, 2, 2);
  c.fillStyle = '#e43b44';
  c.fillRect(ex - 6, y - 28, 12, 12);
  c.fillStyle = '#e8b796';
  c.fillRect(ex - 5, y - 38, 10, 10);
  c.fillStyle = '#3b2416';
  c.fillRect(ex - 7, y - 40, 3, 12);
  c.fillRect(ex + 4, y - 40, 3, 12);
  // De mãos dadas.
  c.fillStyle = '#e8b796';
  c.fillRect(x + 8 + torto, y - 22, ex - x - 14 - torto, 2);
}
