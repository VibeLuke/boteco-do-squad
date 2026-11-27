/**
 * Banheiro assombrado (Fatia 4, lote E). Puro: sem DOM, testável no Node.
 *
 * - A lâmpada pisca por um padrão sorteado pela janela do relógio (igual em todo aparelho): apagões de 0,3 a 2 s e
 *   piscadas lentas (no máximo ~2,5 trocas por segundo).
 * - Os sustos são de cada aparelho: enquanto você está lá dentro (de pé e com os sustos ligados), um a cada 45 s,
 *   sorteado sem repetir o último. Todo susto tem prazo máximo e acaba na hora se você sai, cai ou desliga os sustos.
 * - Dano só em você e nunca derruba (a vida para em 1): susto assusta, não mata.
 */
import { eu, type Mundo } from './briga';
import { zonaDe } from './mapa';

export type Susto = 'inquilino' | 'menina' | 'chapeu' | 'toto' | 'reflexo' | 'corredor' | 'radio';
export const SUSTOS: readonly Susto[] = ['inquilino', 'menina', 'chapeu', 'toto', 'reflexo', 'corredor', 'radio'];

/** O nome que aparece na tela quando o susto começa. */
export const NOME_SUSTO: Record<Susto, string> = {
  inquilino: 'O INQUILINO DO BOX 3',
  menina: 'A MENINA DA DESCARGA',
  chapeu: 'CHAPÉU VIVO',
  toto: 'TOTÓ DA JANELA',
  reflexo: 'O REFLEXO ATRASADO',
  corredor: 'O CARA DO CORREDOR',
  radio: 'RÁDIO CHIANDO',
};

/** Prazo máximo de cada susto (ms): passou disso, acaba de qualquer jeito. */
export const PRAZO: Record<Susto, number> = {
  inquilino: 6000,
  menina: 6500,
  chapeu: 12000,
  toto: 2600,
  reflexo: 6000,
  corredor: 4200,
  radio: 5000,
};

export const PRIMEIRO_SUSTO_MS = 9000;
export const INTERVALO_SUSTO_MS = 45000;
/** Quantos golpes (J) arrancam o chapéu vivo da cabeça. */
export const PUXOES_CHAPEU = 6;
export const DANO_INQUILINO = 25;
/** Vida por segundo que o chapéu vivo tira enquanto agarrado. */
export const CHAPEU_POR_S = 3;

/* ------------------------------------------------------------------ lugares do banheiro */

/** O box 3 (a última privada), a privada da menina, a lixeira, a janela do fundo, o espelho e a porta. */
export const LUGAR = {
  box3: [46.5, 0.9] as const,
  privada: [44.5, 0.9] as const,
  lixeira: [47.4, 5.4] as const,
  janela: [45.5, 0.15] as const,
  espelho: [42.1, 2.5] as const,
  porta: [42.1, 4.0] as const,
  radio: [42.6, 2.0] as const,
};

/* ------------------------------------------------------------------ a lâmpada */

const JANELA_LUZ = 6000;
function hash(n: number): number {
  let h = (n | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
/** Gerador simples (mulberry32) para os sorteios locais. */
export function rng(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Trechos apagados [início, fim) dentro da janela de luz `w` (ms relativos ao começo da janela). */
export function apagoes(w: number): [number, number][] {
  const r = rng(hash(w));
  const out: [number, number][] = [];
  const tipo = r();
  if (tipo < 0.35) return out; // janela calma
  if (tipo < 0.7) {
    // Piscadas lentas: 2 ou 3 apagadas de 350 ms com 400 ms aceso entre elas.
    const n = 2 + Math.floor(r() * 2);
    let t = Math.floor(r() * (JANELA_LUZ - n * 750));
    for (let i = 0; i < n; i++) {
      out.push([t, t + 350]);
      t += 750;
    }
    return out;
  }
  // Apagão de 0,3 a 2 s.
  const d = 300 + Math.floor(r() * 1700);
  const ini = Math.floor(r() * (JANELA_LUZ - d));
  out.push([ini, ini + d]);
  return out;
}

/** Brilho da lâmpada na hora `t` (1 acesa, 0 apagada), igual em todo aparelho. */
export function luzBanheiro(t: number): number {
  const w = Math.floor(t / JANELA_LUZ);
  const r = t - w * JANELA_LUZ;
  return apagoes(w).some(([a, b]) => r >= a && r < b) ? 0 : 1;
}

/* ------------------------------------------------------------------ os sustos */

export interface Ativo {
  k: Susto;
  ini: number;
  fim: number;
  /** Onde a coisa está (ladrilhos). */
  x: number;
  y: number;
  /** Chapéu vivo: agarrado na cabeça e quantos puxões já levou. */
  agarrado: boolean;
  puxoes: number;
  /** Já acertou você (o inquilino pega uma vez só). */
  pegou: boolean;
  /** Dor acumulada do chapéu vivo (vira um respingo a cada 3 de vida, sem piscar todo quadro). */
  dor: number;
}

export interface Assombro {
  /** Quando você entrou (null = fora do banheiro). */
  dentroDesde: number | null;
  prox: number;
  atual: Ativo | null;
  ultimo: Susto | null;
  /** Luz forçada apagada até (o susto apaga a luz). */
  escuroAte: number;
  /** Fase do seu golpe no passo anterior (conta cada J novo). */
  faseAntes: string;
  sorteia: () => number;
  /** Quantos sustos já começaram (para os testes e a tela). */
  vistos: number;
}

export function novoAssombro(semente = Date.now()): Assombro {
  return { dentroDesde: null, prox: Infinity, atual: null, ultimo: null, escuroAte: 0, faseAntes: 'nada', sorteia: rng(semente), vistos: 0 };
}

/** A luz que você vê agora (os sustos desligados deixam a lâmpada quieta). */
export function luzAgora(a: Assombro, t: number, ligado: boolean): number {
  if (!ligado) return 1;
  if (t < a.escuroAte) return 0;
  return luzBanheiro(t);
}

/** Quanto falta para o próximo susto (o rádio chia mais forte quando está perto). */
export function faltaSusto(a: Assombro, t: number): number {
  return a.atual ? 0 : Math.max(0, a.prox - t);
}

function acabar(a: Assombro, t: number, apagar = 0) {
  if (a.atual) a.ultimo = a.atual.k;
  a.atual = null;
  if (apagar) a.escuroAte = Math.max(a.escuroAte, t + apagar);
  a.prox = t + INTERVALO_SUSTO_MS;
}

function comecar(a: Assombro, m: Mundo, k: Susto) {
  const t = m.t;
  const me = eu(m);
  const at: Record<Susto, readonly [number, number]> = {
    inquilino: LUGAR.box3,
    menina: LUGAR.privada,
    chapeu: LUGAR.lixeira,
    toto: LUGAR.janela,
    reflexo: LUGAR.espelho,
    corredor: [LUGAR.porta[0], 3.0],
    radio: LUGAR.radio,
  };
  const [x, y] = at[k];
  a.atual = { k, ini: t, fim: t + PRAZO[k], x, y, agarrado: false, puxoes: 0, pegou: false, dor: 0 };
  a.vistos++;
  a.faseAntes = me.fase;
  m.eventos.push({ k: 'frase', x: me.x, y: me.y - 1.2, texto: NOME_SUSTO[k], cor: '#c0cbdc' });
  if (k === 'menina' || k === 'corredor') a.escuroAte = t + 250;
}

/** Tira vida sua sem derrubar (para em 1) e espirra sangue na tela. */
function machucar(m: Mundo, dano: number, dx: number, dy: number) {
  const me = eu(m);
  const antes = me.vida;
  me.vida = Math.max(1, me.vida - dano);
  if (me.vida < antes) {
    me.flashAte = m.t + 80;
    me.ultimoDano = m.t;
    m.eventos.push({ k: 'golpe', x: me.x, y: me.y, dano: Math.round(antes - me.vida), forte: dano >= 10, arma: null, em: me.id, de: 'susto', dx, dy });
  }
}

/**
 * Um passo dos sustos (chame depois do `passo` do mundo, com o mesmo dt em segundos). `ligado` = sustos ligados.
 */
export function passoAssombro(a: Assombro, m: Mundo, ligado: boolean, dt: number) {
  const t = m.t;
  const me = eu(m);
  const dentro = ligado && zonaDe(me.x, me.y) === 'banheiro' && me.estado === 'normal';
  if (!dentro) {
    if (a.atual) acabar(a, t);
    a.dentroDesde = null;
    a.prox = Infinity;
    a.faseAntes = me.fase;
    return;
  }
  if (a.dentroDesde === null) {
    a.dentroDesde = t;
    a.prox = t + PRIMEIRO_SUSTO_MS;
  }
  const novoGolpe = me.fase === 'antes' && a.faseAntes !== 'antes';
  a.faseAntes = me.fase;

  if (!a.atual) {
    if (t < a.prox) return;
    const opcoes = SUSTOS.filter((k) => k !== a.ultimo);
    comecar(a, m, opcoes[Math.floor(a.sorteia() * opcoes.length)]);
    return;
  }
  const s = a.atual;
  if (t >= s.fim) {
    acabar(a, t, s.k === 'inquilino' || s.k === 'menina' ? 700 : 0);
    return;
  }
  const dx = me.x - s.x;
  const dy = me.y - s.y;
  const d = Math.hypot(dx, dy) || 1;
  const vida = t - s.ini;
  switch (s.k) {
    case 'inquilino': {
      // Sai do box depois de 0,8 s e persegue um pouco mais devagar que você; pegou, some no apagão.
      if (vida < 800) break;
      const v = 2.6 * dt;
      s.x += (dx / d) * Math.min(v, d);
      s.y += (dy / d) * Math.min(v, d);
      if (!s.pegou && Math.hypot(me.x - s.x, me.y - s.y) < 0.55) {
        s.pegou = true;
        machucar(m, DANO_INQUILINO, dx / d, dy / d);
        me.vx += (dx / d) * 4;
        me.vy += (dy / d) * 4;
        me.atordoadoAte = Math.max(me.atordoadoAte, t + 500);
        acabar(a, t, 900);
      }
      break;
    }
    case 'menina': {
      // Engatinha em trancos (anda a cada 400 ms), a luz apaga aos 3 s e, quando volta, ela está do seu lado.
      if (vida < 3000) {
        if (Math.floor(vida / 400) % 2 === 0) {
          const v = 1.6 * dt;
          s.x += (dx / d) * Math.min(v, d);
          s.y += (dy / d) * Math.min(v, d);
        }
      } else if (vida < 3800) {
        a.escuroAte = Math.max(a.escuroAte, s.ini + 3800);
      } else {
        s.x = me.x + 0.55;
        s.y = me.y + 0.1;
      }
      break;
    }
    case 'chapeu': {
      if (!s.agarrado) {
        // Pula da lixeira e agarra na cabeça.
        const v = 4.5 * dt;
        s.x += (dx / d) * Math.min(v, d);
        s.y += (dy / d) * Math.min(v, d);
        if (Math.hypot(me.x - s.x, me.y - s.y) < 0.35) {
          s.agarrado = true;
          m.eventos.push({ k: 'frase', x: me.x, y: me.y - 1.2, texto: 'APERTA J PRA ARRANCAR!', cor: '#e43b44' });
        }
        break;
      }
      s.x = me.x;
      s.y = me.y;
      const antes = me.vida;
      me.vida = Math.max(1, me.vida - CHAPEU_POR_S * dt);
      s.dor += antes - me.vida;
      if (s.dor >= 3) {
        s.dor = 0;
        me.flashAte = t + 60;
        me.ultimoDano = t;
        m.eventos.push({ k: 'golpe', x: me.x, y: me.y, dano: 3, forte: false, arma: null, em: me.id, de: 'susto', dx: 0, dy: -1 });
      }
      if (novoGolpe) s.puxoes++;
      if (s.puxoes >= PUXOES_CHAPEU) {
        m.eventos.push({ k: 'frase', x: me.x, y: me.y - 1.2, texto: 'ARRANCOU O CHAPÉU!', cor: '#63c74d' });
        m.eventos.push({ k: 'golpe', x: me.x, y: me.y, dano: 6, forte: true, arma: null, em: me.id, de: 'susto', dx: 0, dy: -1 });
        acabar(a, t);
      }
      break;
    }
    case 'toto': {
      // Atravessa o vidro, pula para a frente e foge pela esquerda.
      if (vida < 900) s.y = LUGAR.janela[1] + (vida / 900) * 1.8;
      else s.x -= 3.5 * dt;
      break;
    }
    case 'corredor': {
      // Passa atrás da porta, de cima para baixo, devagar.
      s.y = 3.0 + (vida / PRAZO.corredor) * 2.2;
      break;
    }
    default:
      break;
  }
}
