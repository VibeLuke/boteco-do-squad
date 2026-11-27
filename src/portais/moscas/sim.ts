/**
 * Moscaria (Fatia 13): o garçom de chinelo num boteco do tamanho de um estádio, moscas gigantes em ondas, armas que
 * disparam sozinhas. Simulação pura e determinística: passo fixo de 1/60 s, sorteio mulberry32 com o estado dentro do
 * mundo (dá para copiar e comparar), mesma semente + mesmas entradas = mesmo fim. A tela só desenha.
 *
 * - A run dura 100 s de jogo (6.000 passos); a rainha chega aos 85 s. Perde ao zerar os copos; ganha matando a
 *   rainha ou chegando vivo aos 100 s.
 * - O jogador só anda; um botão, Gritar, uma vez por run.
 * - A cada nível, 3 cartas sorteadas do mesmo sorteio da semente; escolher é uma entrada com o número do passo (o
 *   mundo fica parado enquanto as cartas estão na mesa).
 *
 * Todos os números de calibragem estão em `CURVA` (ajustados com os dois bots de régua de
 * tests/moscas.test.mjs).
 */

export const DT = 1 / 60;
export const PASSOS_RUN = 6000;
/** Versão das regras: muda quando qualquer número muda (o fantasma de uma versão não vale na outra). */
export const VERSAO = 1;

export const CURVA = {
  /** Arena (unidades = ladrilhos grandes do "estádio"). */
  largura: 64,
  altura: 44,
  velGarcom: 5.5,
  raioGarcom: 0.45,
  copos: 5,
  /** Invulnerável depois de levar dano (s). */
  invul: 1.0,
  /** A mosca precisa pousar (ficar encostada) este tempo para tirar um copo: esbarrão de passagem não dói. */
  pouso: 0.45,
  /** Moscas por segundo: base × (1 + t/40)^1,3, com o teto de vivas. */
  base: 1.1,
  expoente: 1.3,
  tetoVivas: 220,
  /** Onde nascem: num anel fora da tela. */
  raioNasce: 15,
  /** XP do nível n = xpBase × n^xpExp. */
  xpBase: 6,
  xpExp: 1.4,
  /** Raio de pegar XP sem ímã. */
  ima: 3.2,
  rainhaEm: 85,
  /** Gritar: raio e invulnerabilidade. */
  gritoRaio: 9,
  gritoInvul: 1.5,
};

/* ------------------------------------------------------------------ sorteio com estado no mundo */

/** mulberry32 com o estado guardado em `m.s` (o mundo inteiro é dado puro: dá para clonar e comparar). */
export function sortear(m: { s: number }): number {
  m.s = (m.s + 0x6d2b79f5) >>> 0;
  let t = m.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* ------------------------------------------------------------------ moscas */

export type TipoMosca = 'comum' | 'rapida' | 'gorda' | 'cuspidora' | 'rainha';
export const MOSCAS: Record<TipoMosca, { vida: number; vel: number; raio: number; xp: number }> = {
  comum: { vida: 1, vel: 2.2, raio: 0.4, xp: 1 },
  rapida: { vida: 1, vel: 4.0, raio: 0.35, xp: 1 },
  gorda: { vida: 6, vel: 1.4, raio: 0.7, xp: 3 },
  cuspidora: { vida: 3, vel: 1.7, raio: 0.5, xp: 2 },
  // 120 de vida (era 300): caçando a rainha com a evolução normal, 10 de 20 runs a matam nos 15 s; rodeando, nenhuma.
  rainha: { vida: 120, vel: 2.0, raio: 1.6, xp: 0 },
};

export interface Mosca {
  id: number;
  tipo: TipoMosca;
  x: number;
  y: number;
  vida: number;
  /** Passo em que nasceu (o zigue-zague e o cuspe contam daqui). */
  nasceu: number;
  /** Até quando fica lenta (fita) e atordoada (ventilador). */
  lentaAte: number;
  /** Empurrão em andamento. */
  vx: number;
  vy: number;
  /** Último passo em que cada raquete pegou (não pega de novo no mesmo giro). */
  pegaRaq: number;
  proxCuspe: number;
  /** Passos seguidos encostada no garçom (pousou quando chega em CURVA.pouso). */
  pouso: number;
}

export interface Cuspe {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ate: number;
}

export interface Gema {
  x: number;
  y: number;
  xp: number;
}

/* ------------------------------------------------------------------ armas e passivas */

export type Arma = 'chinelo' | 'inseticida' | 'raquetes' | 'ventilador' | 'fita' | 'chope';
export type Passiva = 'velocidade' | 'ima' | 'vida' | 'recarga';
export const ARMAS: readonly Arma[] = ['chinelo', 'inseticida', 'raquetes', 'ventilador', 'fita', 'chope'];
export const PASSIVAS: readonly Passiva[] = ['velocidade', 'ima', 'vida', 'recarga'];
export const NIVEL_MAX_ARMA = 4;
export const NIVEL_MAX_PASSIVA = 3;

export const NOME_ARMA: Record<Arma, string> = {
  chinelo: 'Chinelada',
  inseticida: 'Jato de inseticida',
  raquetes: 'Raquetes em órbita',
  ventilador: 'Ventilador de teto',
  fita: 'Fita pega-mosca',
  chope: 'Poça de chope quente',
};
export const NOME_PASSIVA: Record<Passiva, string> = {
  velocidade: 'Tênis de garçom (+10% de passo)',
  ima: 'Bandeja-ímã (pega XP de mais longe)',
  vida: 'Copo extra (+1 copo e enche um)',
  recarga: 'Café passado (armas 8% mais rápidas)',
};

/** Números de cada arma por nível (índice 0 = nível 1). */
export const ARMA_NIVEL = {
  chinelo: { cada: [0.8, 0.7, 0.6, 0.5], alcance: [2.6, 2.9, 3.2, 3.6], dano: [1, 2, 2, 3], arco: [2.4, 2.6, 2.9, 3.3] },
  inseticida: { cada: [0.3, 0.27, 0.24, 0.2], alcance: [3.2, 3.8, 4.4, 5.0], dano: [1, 1, 1, 2], arco: [0.6, 0.7, 0.8, 0.9] },
  raquetes: { n: [2, 2, 3, 4], raio: [2.2, 2.4, 2.6, 2.8], giro: [3.0, 3.4, 3.8, 4.2], dano: [1, 2, 2, 3] },
  ventilador: { cada: [2.2, 2.0, 1.8, 1.5], raio: [3.0, 3.6, 4.2, 5.0], empurra: [6, 7, 8, 10], dano: [0, 1, 1, 1] },
  fita: { cada: [3.0, 2.6, 2.2, 1.8], dura: [5, 6, 7, 8], raio: [1.1, 1.3, 1.5, 1.7], dano: [1, 1, 2, 2] },
  chope: { cada: [1.6, 1.4, 1.2, 1.0], dura: [3, 3.5, 4, 4.5], raio: [1.0, 1.2, 1.4, 1.6], dano: [2, 2, 3, 4] },
} as const;

export type Carta = { k: 'arma'; arma: Arma } | { k: 'passiva'; passiva: Passiva };

export interface Faixa {
  /** Fita (gruda e fere) ou poça de chope (fere). */
  k: 'fita' | 'chope';
  x: number;
  y: number;
  r: number;
  ate: number;
  dano: number;
}

/* ------------------------------------------------------------------ mundo */

export interface Entrada {
  /** Direção desejada (comprimento até 1). */
  mx: number;
  my: number;
  grita?: boolean;
  /** Carta escolhida (0 a 2) quando as cartas estão na mesa. */
  carta?: number;
}
export const PARADO: Entrada = { mx: 0, my: 0 };

export interface Mesa {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** As mesas gigantes (fixas: o estádio é o mesmo em toda run; a semente muda as ondas e as cartas). */
export const MESAS: readonly Mesa[] = [
  { x: 14, y: 10, w: 5, h: 3 },
  { x: 44, y: 10, w: 5, h: 3 },
  { x: 14, y: 31, w: 5, h: 3 },
  { x: 44, y: 31, w: 5, h: 3 },
  { x: 29, y: 6, w: 6, h: 2 },
  { x: 29, y: 36, w: 6, h: 2 },
  { x: 6, y: 20, w: 2, h: 4 },
  { x: 56, y: 20, w: 2, h: 4 },
];

export interface Moscaria {
  semente: number;
  s: number;
  passo: number;
  fim: null | 'venceu' | 'perdeu';
  x: number;
  y: number;
  /** Para onde olha (a chinelada vai para lá). */
  fx: number;
  fy: number;
  copos: number;
  coposMax: number;
  invulAte: number;
  gritou: boolean;
  xp: number;
  nivel: number;
  armas: Partial<Record<Arma, number>>;
  passivas: Partial<Record<Passiva, number>>;
  cartas: Carta[] | null;
  /** Próximo passo em que cada arma dispara. */
  prox: Partial<Record<Arma, number>>;
  moscas: Mosca[];
  cuspes: Cuspe[];
  gemas: Gema[];
  faixas: Faixa[];
  /** Fração de mosca acumulada para nascer (densidade não inteira por passo). */
  nascer: number;
  proxId: number;
  rainha: boolean;
  rainhaMorta: boolean;
  mortas: number;
  combo: number;
  pontos: number;
  /** Passos de vida cheia (5 pontos por segundo). */
  passosCheio: number;
  /** Eventos do último passo (só para a tela: som e brilho). */
  ev: Ev[];
}

export type Ev =
  | { k: 'chinelada'; x: number; y: number; ang: number; alcance: number }
  | { k: 'jato'; x: number; y: number; ang: number; alcance: number }
  | { k: 'vento'; x: number; y: number; r: number }
  | { k: 'morreu'; x: number; y: number; tipo: TipoMosca }
  | { k: 'dano'; de: 'pouso' | 'cuspe' | 'rainha' }
  | { k: 'cuspe'; x: number; y: number }
  | { k: 'nivel'; nivel: number }
  | { k: 'grito'; x: number; y: number }
  | { k: 'rainha' }
  | { k: 'fim'; como: 'venceu' | 'perdeu' };

export function novaMoscaria(semente: number): Moscaria {
  return {
    semente: semente >>> 0,
    s: semente >>> 0,
    passo: 0,
    fim: null,
    x: CURVA.largura / 2,
    y: CURVA.altura / 2,
    fx: 1,
    fy: 0,
    copos: CURVA.copos,
    coposMax: CURVA.copos,
    invulAte: 0,
    gritou: false,
    xp: 0,
    nivel: 1,
    armas: { chinelo: 1 },
    passivas: {},
    cartas: null,
    prox: {},
    moscas: [],
    cuspes: [],
    gemas: [],
    faixas: [],
    nascer: 0,
    proxId: 1,
    rainha: false,
    rainhaMorta: false,
    mortas: 0,
    combo: 0,
    pontos: 0,
    passosCheio: 0,
    ev: [],
  };
}

/* ------------------------------------------------------------------ contas puras */

export const segundos = (passo: number) => passo * DT;
/** Moscas por segundo no tempo t (s). */
export const densidade = (t: number) => CURVA.base * Math.pow(1 + t / 40, CURVA.expoente);
/** XP para sair do nível n. */
export const xpDoNivel = (n: number) => Math.round(CURVA.xpBase * Math.pow(n, CURVA.xpExp));
/** Multiplicador do combo (1 + combo/20, teto ×3). */
export const multCombo = (combo: number) => Math.min(3, 1 + combo / 20);

/** Pontuação final: mortas com combo (somadas no caminho) + 500 pela rainha + 5 por segundo de vida cheia. */
export function pontuacao(m: Moscaria): number {
  return Math.floor(m.pontos + (m.rainhaMorta ? 500 : 0) + Math.floor(m.passosCheio * DT) * 5);
}

const recargaDe = (m: Moscaria) => Math.pow(0.92, m.passivas.recarga ?? 0);
const velDe = (m: Moscaria) => CURVA.velGarcom * (1 + 0.1 * (m.passivas.velocidade ?? 0));
const imaDe = (m: Moscaria) => CURVA.ima * (1 + 0.4 * (m.passivas.ima ?? 0));

function dentroMesa(x: number, y: number, r: number): Mesa | null {
  for (const t of MESAS) if (x > t.x - r && x < t.x + t.w + r && y > t.y - r && y < t.y + t.h + r) return t;
  return null;
}

/** Tira o ponto de dentro de uma mesa pelo lado mais perto (e de fora da arena). */
function empurrarFora(p: { x: number; y: number }, r: number) {
  const t = dentroMesa(p.x, p.y, r);
  if (t) {
    const d = [p.x - (t.x - r), t.x + t.w + r - p.x, p.y - (t.y - r), t.y + t.h + r - p.y];
    const i = d.indexOf(Math.min(...d));
    if (i === 0) p.x = t.x - r;
    else if (i === 1) p.x = t.x + t.w + r;
    else if (i === 2) p.y = t.y - r;
    else p.y = t.y + t.h + r;
  }
  p.x = Math.max(r, Math.min(CURVA.largura - r, p.x));
  p.y = Math.max(r, Math.min(CURVA.altura - r, p.y));
}

/** As 3 cartas do nível: sem arma no nível 4 nem passiva no 3, sem repetir; se faltar, completa com o que der. */
export function sortearCartas(m: Moscaria): Carta[] {
  const todas: Carta[] = [
    ...ARMAS.filter((a) => (m.armas[a] ?? 0) < NIVEL_MAX_ARMA).map((a) => ({ k: 'arma', arma: a }) as Carta),
    ...PASSIVAS.filter((p) => (m.passivas[p] ?? 0) < NIVEL_MAX_PASSIVA).map((p) => ({ k: 'passiva', passiva: p }) as Carta),
  ];
  const out: Carta[] = [];
  while (out.length < 3 && todas.length) out.push(todas.splice(Math.floor(sortear(m) * todas.length), 1)[0]);
  return out;
}

function escolher(m: Moscaria, i: number) {
  const c = m.cartas![Math.max(0, Math.min(m.cartas!.length - 1, Math.floor(i)))];
  if (c.k === 'arma') m.armas[c.arma] = (m.armas[c.arma] ?? 0) + 1;
  else {
    m.passivas[c.passiva] = (m.passivas[c.passiva] ?? 0) + 1;
    if (c.passiva === 'vida') {
      m.coposMax++;
      m.copos = Math.min(m.coposMax, m.copos + 1);
    }
  }
  m.cartas = null;
}

/* ------------------------------------------------------------------ nascer */

function tipoNoTempo(m: Moscaria, t: number): TipoMosca {
  const r = sortear(m);
  if (t < 15) return 'comum';
  if (t < 25) return r < 0.6 ? 'comum' : r < 0.85 ? 'rapida' : 'gorda';
  if (t < 40) return r < 0.55 ? 'comum' : r < 0.75 ? 'rapida' : r < 0.88 ? 'gorda' : 'cuspidora';
  return r < 0.45 ? 'comum' : r < 0.7 ? 'rapida' : r < 0.85 ? 'gorda' : 'cuspidora';
}

function nascerMosca(m: Moscaria, tipo: TipoMosca, ang: number, raio = CURVA.raioNasce) {
  const p = { x: m.x + Math.cos(ang) * raio, y: m.y + Math.sin(ang) * raio };
  empurrarFora(p, MOSCAS[tipo].raio);
  m.moscas.push({ id: m.proxId++, tipo, x: p.x, y: p.y, vida: MOSCAS[tipo].vida, nasceu: m.passo, lentaAte: 0, vx: 0, vy: 0, pegaRaq: -999, proxCuspe: m.passo + 120, pouso: 0 });
}

function ondas(m: Moscaria) {
  const t = segundos(m.passo);
  // A rainha chega aos 85 s, do lado oposto ao que o garçom olha.
  if (!m.rainha && t >= CURVA.rainhaEm) {
    m.rainha = true;
    // Com o enxame no teto, a mosca mais longe do garçom dá lugar à rainha (o teto vale para todas, rainha inclusa).
    const vivas = m.moscas.filter((o) => o.vida > 0);
    if (vivas.length >= CURVA.tetoVivas) {
      let longe = vivas[0];
      for (const o of vivas) if (Math.hypot(o.x - m.x, o.y - m.y) > Math.hypot(longe.x - m.x, longe.y - m.y)) longe = o;
      m.moscas.splice(m.moscas.indexOf(longe), 1);
    }
    nascerMosca(m, 'rainha', Math.atan2(-m.fy, -m.fx), 12);
    m.ev.push({ k: 'rainha' });
  }
  const dobro = t >= 70 ? 2 : 1;
  m.nascer += densidade(t) * dobro * DT;
  while (m.nascer >= 1) {
    m.nascer -= 1;
    if (m.moscas.filter((o) => o.vida > 0).length >= CURVA.tetoVivas) {
      m.nascer = 0;
      break;
    }
    const tipo = tipoNoTempo(m, t);
    // De 40 a 70 s, ondas em pinça: metade nasce de um lado e metade do outro.
    const ang = t >= 40 && t < 70 ? (sortear(m) < 0.5 ? 0 : Math.PI) + (sortear(m) - 0.5) * 0.9 : sortear(m) * Math.PI * 2;
    nascerMosca(m, tipo, ang);
  }
}

/* ------------------------------------------------------------------ dano nas moscas */

function ferirMosca(m: Moscaria, f: Mosca, dano: number) {
  if (f.vida <= 0 || dano <= 0) return;
  f.vida -= dano;
  if (f.vida > 0) return;
  m.mortas++;
  m.combo++;
  m.pontos += multCombo(m.combo);
  m.ev.push({ k: 'morreu', x: f.x, y: f.y, tipo: f.tipo });
  if (f.tipo === 'rainha') {
    m.rainhaMorta = true;
    return;
  }
  m.gemas.push({ x: f.x, y: f.y, xp: MOSCAS[f.tipo].xp });
  // A gorda solta 3 comuns quando estoura.
  if (f.tipo === 'gorda')
    for (let i = 0; i < 3 && m.moscas.filter((o) => o.vida > 0).length < CURVA.tetoVivas; i++) {
      const a = (i / 3) * Math.PI * 2 + sortear(m);
      m.moscas.push({ id: m.proxId++, tipo: 'comum', x: f.x + Math.cos(a) * 0.8, y: f.y + Math.sin(a) * 0.8, vida: 1, nasceu: m.passo, lentaAte: 0, vx: 0, vy: 0, pegaRaq: -999, proxCuspe: 0, pouso: 0 });
    }
}

const angDif = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

function armas(m: Moscaria) {
  const p = m.passo;
  const rec = recargaDe(m);
  const olhar = Math.atan2(m.fy, m.fx);
  const pronta = (a: Arma, cada: number) => {
    if ((m.prox[a] ?? 0) > p) return false;
    m.prox[a] = p + Math.max(1, Math.round((cada * rec) / DT));
    return true;
  };
  // As armas de mira vão na mosca mais perto (o garçom foge olhando para a frente; o chinelo acerta quem vem atrás).
  let maisPerto: Mosca | null = null;
  let melhor = Infinity;
  for (const f of m.moscas) {
    const d = Math.hypot(f.x - m.x, f.y - m.y);
    if (d < melhor) {
      melhor = d;
      maisPerto = f;
    }
  }
  const mira = maisPerto ? Math.atan2(maisPerto.y - m.y, maisPerto.x - m.x) : olhar;
  const nc = m.armas.chinelo;
  if (nc) {
    const A = ARMA_NIVEL.chinelo;
    const i = nc - 1;
    if (pronta('chinelo', A.cada[i])) {
      m.ev.push({ k: 'chinelada', x: m.x, y: m.y, ang: mira, alcance: A.alcance[i] });
      for (const f of m.moscas) {
        const d = Math.hypot(f.x - m.x, f.y - m.y);
        if (d < A.alcance[i] + MOSCAS[f.tipo].raio && angDif(Math.atan2(f.y - m.y, f.x - m.x), mira) < A.arco[i] / 2) ferirMosca(m, f, A.dano[i]);
      }
    }
  }
  const ni = m.armas.inseticida;
  if (ni) {
    const A = ARMA_NIVEL.inseticida;
    const i = ni - 1;
    if (pronta('inseticida', A.cada[i])) {
      const ang = mira;
      m.ev.push({ k: 'jato', x: m.x, y: m.y, ang, alcance: A.alcance[i] });
      for (const f of m.moscas) {
        const d = Math.hypot(f.x - m.x, f.y - m.y);
        if (d < A.alcance[i] + MOSCAS[f.tipo].raio && angDif(Math.atan2(f.y - m.y, f.x - m.x), ang) < A.arco[i] / 2) ferirMosca(m, f, A.dano[i]);
      }
    }
  }
  const nr = m.armas.raquetes;
  if (nr) {
    const A = ARMA_NIVEL.raquetes;
    const i = nr - 1;
    const giro = p * DT * A.giro[i];
    for (let k = 0; k < A.n[i]; k++) {
      const a = giro + (k / A.n[i]) * Math.PI * 2;
      const rx = m.x + Math.cos(a) * A.raio[i];
      const ry = m.y + Math.sin(a) * A.raio[i];
      for (const f of m.moscas)
        if (p - f.pegaRaq >= 30 && Math.hypot(f.x - rx, f.y - ry) < 0.6 + MOSCAS[f.tipo].raio) {
          f.pegaRaq = p;
          ferirMosca(m, f, A.dano[i]);
        }
    }
  }
  const nv = m.armas.ventilador;
  if (nv) {
    const A = ARMA_NIVEL.ventilador;
    const i = nv - 1;
    if (pronta('ventilador', A.cada[i])) {
      m.ev.push({ k: 'vento', x: m.x, y: m.y, r: A.raio[i] });
      for (const f of m.moscas) {
        const dx = f.x - m.x;
        const dy = f.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > A.raio[i] || f.tipo === 'rainha') continue;
        f.vx += (dx / d) * A.empurra[i];
        f.vy += (dy / d) * A.empurra[i];
        f.lentaAte = Math.max(f.lentaAte, p + 30);
        ferirMosca(m, f, A.dano[i]);
      }
    }
  }
  for (const [a, k] of [['fita', 'fita'], ['chope', 'chope']] as const) {
    const n = m.armas[a];
    if (!n) continue;
    const A = ARMA_NIVEL[a];
    const i = n - 1;
    if (pronta(a, A.cada[i])) m.faixas.push({ k, x: m.x, y: m.y, r: A.raio[i], ate: p + Math.round(A.dura[i] / DT), dano: A.dano[i] });
  }
  // Faixas no chão: ferem uma vez por segundo quem está em cima; a fita ainda deixa lento.
  m.faixas = m.faixas.filter((fx) => fx.ate > p);
  const porSegundo = p % 60 === 0;
  for (const fx of m.faixas)
    for (const f of m.moscas) {
      if (Math.hypot(f.x - fx.x, f.y - fx.y) > fx.r + MOSCAS[f.tipo].raio) continue;
      if (fx.k === 'fita') f.lentaAte = Math.max(f.lentaAte, p + 6);
      if (porSegundo) ferirMosca(m, f, fx.dano);
    }
}

/* ------------------------------------------------------------------ o passo */

function levarDano(m: Moscaria, de: 'pouso' | 'cuspe' | 'rainha') {
  if (m.passo < m.invulAte) return;
  m.copos--;
  m.combo = 0;
  m.invulAte = m.passo + Math.round(CURVA.invul / DT);
  m.ev.push({ k: 'dano', de });
}

export function passo(m: Moscaria, e: Entrada) {
  m.ev = [];
  if (m.fim) return;
  // Cartas na mesa: o mundo para até escolher.
  if (m.cartas) {
    if (e.carta !== undefined) escolher(m, e.carta);
    return;
  }
  m.passo++;
  // Andar.
  const len = Math.hypot(e.mx, e.my);
  if (len > 0.05) {
    const k = Math.min(1, len);
    m.fx = e.mx / len;
    m.fy = e.my / len;
    const v = velDe(m) * k * DT;
    const p = { x: m.x + m.fx * v, y: m.y + m.fy * v };
    empurrarFora(p, CURVA.raioGarcom);
    m.x = p.x;
    m.y = p.y;
  }
  // Gritar: uma vez por run, limpa as comuns e rápidas em volta e dá um respiro.
  if (e.grita && !m.gritou) {
    m.gritou = true;
    m.invulAte = Math.max(m.invulAte, m.passo + Math.round(CURVA.gritoInvul / DT));
    m.ev.push({ k: 'grito', x: m.x, y: m.y });
    for (const f of m.moscas)
      if ((f.tipo === 'comum' || f.tipo === 'rapida') && Math.hypot(f.x - m.x, f.y - m.y) < CURVA.gritoRaio) ferirMosca(m, f, 99);
  }
  ondas(m);
  armas(m);
  // Moscas andam até o garçom (a rápida em zigue-zague, a cuspidora mantém distância e cospe).
  for (const f of m.moscas) {
    if (f.vida <= 0) continue;
    const M = MOSCAS[f.tipo];
    let dx = m.x - f.x;
    let dy = m.y - f.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    let vel = M.vel * (f.lentaAte > m.passo ? 0.3 : 1);
    if (f.tipo === 'rapida') {
      const z = Math.sin((m.passo - f.nasceu) * DT * 6) * 0.8;
      const ox = -dy * z;
      const oy = dx * z;
      dx += ox;
      dy += oy;
    }
    if (f.tipo === 'cuspidora') {
      if (d < 6) vel *= -0.6;
      else if (d < 7.5) vel = 0;
      if (m.passo >= f.proxCuspe && d < 12) {
        f.proxCuspe = m.passo + 90;
        m.cuspes.push({ x: f.x, y: f.y, vx: (dx / Math.hypot(dx, dy)) * 6, vy: (dy / Math.hypot(dx, dy)) * 6, ate: m.passo + 150 });
        m.ev.push({ k: 'cuspe', x: f.x, y: f.y });
      }
    }
    if (f.tipo === 'rainha') {
      // Fase 1 (vida > 2/3): ronda e chama comuns. Fase 2: investe. Fase 3: cospe em leque.
      const fase = f.vida > (M.vida * 2) / 3 ? 1 : f.vida > M.vida / 3 ? 2 : 3;
      const u = m.passo - f.nasceu;
      if (fase === 1) {
        const ox = -dy;
        const oy = dx;
        dx = dx * 0.4 + ox * 0.6;
        dy = dy * 0.4 + oy * 0.6;
        if (u % 90 === 0) for (let i = 0; i < 4 && m.moscas.length < CURVA.tetoVivas; i++) nascerMosca(m, 'comum', sortear(m) * Math.PI * 2, 3);
      } else if (fase === 2) vel *= u % 120 < 40 ? 3.2 : 0.6;
      else if (u % 75 === 0)
        for (let i = -2; i <= 2; i++) {
          const a = Math.atan2(dy, dx) + i * 0.3;
          m.cuspes.push({ x: f.x, y: f.y, vx: Math.cos(a) * 5.5, vy: Math.sin(a) * 5.5, ate: m.passo + 180 });
        }
    }
    const n = Math.hypot(dx, dy) || 1;
    const p = { x: f.x + (dx / n) * vel * DT + f.vx * DT, y: f.y + (dy / n) * vel * DT + f.vy * DT };
    f.vx *= 0.9;
    f.vy *= 0.9;
    empurrarFora(p, M.raio);
    f.x = p.x;
    f.y = p.y;
    if (Math.hypot(f.x - m.x, f.y - m.y) < M.raio + CURVA.raioGarcom) {
      f.pouso++;
      if (f.tipo === 'rainha' || f.pouso >= Math.round(CURVA.pouso / DT)) {
        f.pouso = 0;
        levarDano(m, f.tipo === 'rainha' ? 'rainha' : 'pouso');
      }
    } else f.pouso = 0;
  }
  m.moscas = m.moscas.filter((f) => f.vida > 0);
  // Cuspes voam em linha reta e somem.
  for (const c of m.cuspes) {
    c.x += c.vx * DT;
    c.y += c.vy * DT;
    if (Math.hypot(c.x - m.x, c.y - m.y) < 0.3 + CURVA.raioGarcom) {
      levarDano(m, 'cuspe');
      c.ate = 0;
    }
  }
  m.cuspes = m.cuspes.filter((c) => c.ate > m.passo && !dentroMesa(c.x, c.y, 0));
  // XP: a gema perto do ímã vem até você.
  const ima = imaDe(m);
  for (const g of m.gemas) {
    const dx = m.x - g.x;
    const dy = m.y - g.y;
    const d = Math.hypot(dx, dy);
    if (d < ima) {
      g.x += (dx / (d || 1)) * Math.min(d, 9 * DT);
      g.y += (dy / (d || 1)) * Math.min(d, 9 * DT);
    }
    if (Math.hypot(m.x - g.x, m.y - g.y) < 0.5) {
      m.xp += g.xp;
      g.xp = 0;
    }
  }
  m.gemas = m.gemas.filter((g) => g.xp > 0);
  if (m.gemas.length > 400) m.gemas.splice(0, m.gemas.length - 400);
  if (m.copos === m.coposMax) m.passosCheio++;
  // Subiu de nível: cartas na mesa (se ainda houver o que oferecer).
  if (m.xp >= xpDoNivel(m.nivel)) {
    m.xp -= xpDoNivel(m.nivel);
    m.nivel++;
    m.ev.push({ k: 'nivel', nivel: m.nivel });
    const c = sortearCartas(m);
    if (c.length) m.cartas = c;
  }
  // Fim.
  if (m.copos <= 0) m.fim = 'perdeu';
  else if (m.rainhaMorta || m.passo >= PASSOS_RUN) m.fim = 'venceu';
  if (m.fim) m.ev.push({ k: 'fim', como: m.fim });
}

/** Impressão digital do mundo (para comparar duas execuções). */
export function hashMundo(m: Moscaria): string {
  const r = (v: number) => Math.round(v * 1e6);
  const partes = [m.passo, m.fim, r(m.x), r(m.y), m.copos, m.xp, m.nivel, m.mortas, m.combo, r(m.pontos), m.s, m.moscas.length, ...m.moscas.map((f) => `${f.id}:${r(f.x)}:${r(f.y)}:${f.vida}`)];
  let h = 2166136261;
  const txt = partes.join('|');
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/* ------------------------------------------------------------------ gravação de entradas (replay) */

/** Entrada gravada: direção quantizada em 8 direções + parado (0 a 8), grito e carta. */
export interface Gravada {
  passo: number;
  d: number;
  grita?: boolean;
  carta?: number;
}

const DIRS: readonly [number, number][] = [[0, 0], [1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071]];
/** A direção do stick vira uma das 8 (mais parado): é o que se grava e o que se joga (gravação e jogo batem). */
export function quantizar(mx: number, my: number): number {
  if (Math.hypot(mx, my) < 0.3) return 0;
  const a = Math.atan2(my, mx);
  return 1 + (((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8);
}
export const direcao = (d: number): Entrada => ({ mx: DIRS[d]?.[0] ?? 0, my: DIRS[d]?.[1] ?? 0 });

/**
 * Joga um passo gravando: a direção vira uma das 9, e grava-se no máximo uma entrada por chamada (só quando muda a
 * direção, grita ou escolhe carta). É o mesmo caminho na tela e nos testes.
 */
export function jogarGravando(m: Moscaria, e: Entrada, grav: Gravada[], ultimo: { d: number }) {
  const d = quantizar(e.mx, e.my);
  if (d !== ultimo.d || e.grita || e.carta !== undefined) {
    grav.push({ passo: m.passo, d, ...(e.grita ? { grita: true } : {}), ...(e.carta !== undefined ? { carta: e.carta } : {}) });
    ultimo.d = d;
  }
  passo(m, { ...direcao(d), grita: e.grita, carta: e.carta });
}

/**
 * Roda uma run inteira a partir das entradas gravadas: a cada chamada usa no máximo uma entrada (a do passo atual),
 * e a direção vale até a próxima mudança. Com as cartas na mesa o passo não anda, então várias entradas do mesmo
 * passo entram uma por chamada, na ordem.
 */
export function reproduzir(semente: number, grav: readonly Gravada[], maxIter = PASSOS_RUN * 4): Moscaria {
  const m = novaMoscaria(semente);
  let i = 0;
  let d = 0;
  for (let it = 0; it < maxIter && !m.fim; it++) {
    let e: Entrada = direcao(d);
    if (i < grav.length && grav[i].passo <= m.passo) {
      const g = grav[i++];
      d = g.d;
      e = { ...direcao(d), grita: g.grita, carta: g.carta };
    }
    passo(m, e);
  }
  return m;
}
