/**
 * Poderes especiais do mercado negro (Fatia 6). Todos custam R$ 300, têm um uso só e carregam com o corpo plantado
 * (apanhar na carga cancela sem gastar). A Rajada do Fiado (Fatia 5) segue no caminho próprio dela em `briga.ts`;
 * os 10 novos usam esta tabela e uma geometria pura: para cada disparo, `quando()` diz em quantos ms depois do
 * disparo cada ponto é atingido (ou -1). O motor aplica o dano e o efeito nessa hora; o desenho usa a mesma conta.
 *
 * Nomes, gritos e visuais são nossos (boteco), sem nada de obra com dono.
 */

export const PODERES = ['rajada', 'tampinhas', 'arroto', 'furacao', 'chope', 'pagode', 'raio', 'torresmo', 'garcom', 'pinga', 'ima'] as const;
export type Poder = (typeof PODERES)[number];
/** Os 10 novos (a rajada tem o caminho dela). */
export type PoderNovo = Exclude<Poder, 'rajada'>;
export const PODERES_NOVOS = PODERES.filter((p): p is PoderNovo => p !== 'rajada');

export function ehPoder(a: unknown): a is Poder {
  return typeof a === 'string' && (PODERES as readonly string[]).includes(a);
}

export const PRECO_PODER = 300;

export type Forma = 'circulo' | 'cone' | 'tornado' | 'onda' | 'anel' | 'alvos' | 'ponto' | 'projetil' | 'ima';

export interface DefPoder {
  nome: string;
  /** Fala do vendedor no mercado. */
  papo: string;
  /** Grito/onomatopeia que aparece grande no disparo. */
  grito: string;
  /** Carga (ms, corpo plantado) e duração do efeito (ms). */
  carga: number;
  dura: number;
  forma: Forma;
  /** Dano por alvo (100 = nocaute garantido no NPC decidido aqui). */
  dano: number;
  /** Força do empurrão (ladrilhos/s). */
  knock: number;
  /** Deixa o NPC tonto por (ms). */
  atordoa: number;
  /** Quebra móvel no caminho. */
  quebra: boolean;
  /** Cores: miolo, corpo, borda. */
  cores: [string, string, string];
  /** Parâmetros da forma (raio, alcance, velocidade, largura, quantos alvos...). */
  p: { raio?: number; alcance?: number; vel?: number; largura?: number; meioAngulo?: number; n?: number; passo?: number; atraso?: number };
}

export const PODER: Record<PoderNovo, DefPoder> = {
  tampinhas: {
    nome: 'Chuva de Tampinhas',
    papo: 'Chuva de Tampinhas. Cai tampinha do céu em tudo em volta de você.',
    grito: 'SAIDEIRAAA!',
    carga: 1200,
    dura: 1800,
    forma: 'circulo',
    dano: 60,
    knock: 5,
    atordoa: 1200,
    quebra: true,
    cores: ['#fef3c0', '#feae34', '#c0cbdc'],
    p: { raio: 5 },
  },
  arroto: {
    nome: 'Arroto Sônico',
    papo: 'Arroto Sônico. Um cone de pressão que joga longe e deixa todo mundo tonto.',
    grito: 'BUUURP!',
    carga: 1000,
    dura: 600,
    forma: 'cone',
    dano: 35,
    knock: 22,
    atordoa: 3000,
    quebra: true,
    cores: ['#f4f4f4', '#a8e05f', '#5a8a3a'],
    p: { alcance: 9, vel: 25, meioAngulo: 0.62 },
  },
  furacao: {
    nome: 'Furacão de Guardanapo',
    papo: 'Furacão de Guardanapo. Um redemoinho que anda pra frente e arremessa quem encosta.',
    grito: 'VUUUUSH!',
    carga: 1000,
    dura: 2600,
    forma: 'tornado',
    dano: 70,
    knock: 16,
    atordoa: 1500,
    quebra: true,
    cores: ['#f4f4f4', '#c0cbdc', '#8b9bb4'],
    p: { raio: 1.5, vel: 6, alcance: 15 },
  },
  chope: {
    nome: 'Tsunami de Chope',
    papo: 'Tsunami de Chope. Uma onda de espuma que varre a área e derruba todo mundo.',
    grito: 'SPLAAASH!',
    carga: 1500,
    dura: 1500,
    forma: 'onda',
    dano: 45,
    knock: 12,
    atordoa: 2000,
    quebra: false,
    cores: ['#fffbe0', '#feae34', '#c27a1a'],
    p: { largura: 3, vel: 14, alcance: 20 },
  },
  pagode: {
    nome: 'Terremoto do Pagode',
    papo: 'Terremoto do Pagode. Um pisão que racha o chão e quebra tudo em volta.',
    grito: 'TUM-TCHÁ!',
    carga: 1400,
    dura: 1000,
    forma: 'anel',
    dano: 55,
    knock: 9,
    atordoa: 2500,
    quebra: true,
    cores: ['#fee761', '#b86f50', '#5a3a2a'],
    p: { raio: 8, vel: 9 },
  },
  raio: {
    nome: 'Raio da Conta Atrasada',
    papo: 'Raio da Conta Atrasada. Seis raios caem em quem está mais perto, um atrás do outro.',
    grito: 'PAGA ESSA!',
    carga: 1600,
    dura: 1600,
    forma: 'alvos',
    dano: 100,
    knock: 8,
    atordoa: 0,
    quebra: false,
    cores: ['#ffffff', '#2ce8f5', '#3b5dc9'],
    p: { raio: 10, n: 6, passo: 180, atraso: 300 },
  },
  torresmo: {
    nome: 'Meteoro de Torresmo',
    papo: 'Meteoro de Torresmo. Um torresmo gigante cai do céu cinco passos na sua frente.',
    grito: 'TORRESMOOO!',
    carga: 1200,
    dura: 1500,
    forma: 'ponto',
    dano: 100,
    knock: 18,
    atordoa: 0,
    quebra: true,
    cores: ['#fff2b0', '#e8a040', '#8a4a20'],
    p: { raio: 3.2, alcance: 5, atraso: 900 },
  },
  garcom: {
    nome: 'Fantasma do Garçom',
    papo: 'Fantasma do Garçom. Um garçom do além passa dando bandejada em até cinco.',
    grito: 'A CONTA, SENHOR!',
    carga: 800,
    dura: 1800,
    forma: 'alvos',
    dano: 80,
    knock: 11,
    atordoa: 1200,
    quebra: false,
    cores: ['#e8f7ff', '#8fd3ff', '#3b5dc9'],
    p: { raio: 8, n: 5, passo: 280, atraso: 250 },
  },
  pinga: {
    nome: 'Bola de Fogo da Pinga',
    papo: 'Bola de Fogo da Pinga. Uma bola de fogo que explode no primeiro que encontrar e deixa o chão pegando fogo.',
    grito: 'FOGO NA PINGA!',
    carga: 1000,
    dura: 1400,
    forma: 'projetil',
    dano: 90,
    knock: 13,
    atordoa: 800,
    quebra: true,
    cores: ['#fff6c0', '#ff8a2a', '#c0282c'],
    p: { raio: 2.5, vel: 12, alcance: 12 },
  },
  ima: {
    nome: 'Ímã do Fiado',
    papo: 'Ímã do Fiado. Puxa todo mundo para um ponto na sua frente e implode.',
    grito: 'VEM PRA CONTA!',
    carga: 1300,
    dura: 1700,
    forma: 'ima',
    dano: 100,
    knock: 16,
    atordoa: 0,
    quebra: true,
    cores: ['#ffd0f0', '#ff4fb0', '#7a1a5a'],
    p: { raio: 2.5, alcance: 3, atraso: 1300 },
  },
};

/** Raio em que o Ímã puxa (ladrilhos) e a força (ladrilhos/s). */
export const IMA_PUXA = 7;
export const IMA_FORCA = 9;
/** Fogo no chão da Pinga: quanto dura (ms), raio e dano por segundo em quem fica nele. */
export const FOGO_MS = 6000;
export const FOGO_RAIO = 1.6;
export const FOGO_DANO_S = 12;

/** Um disparo no ar (geometria fixa no momento do disparo). */
export interface Disparo {
  tipo: PoderNovo;
  de: string;
  /** Onde estava quem disparou e para onde olhava (unitário). */
  x: number;
  y: number;
  fx: number;
  fy: number;
  t0: number;
  /** Até onde vai (já cortado pela parede da área). */
  len: number;
  /** Centro do efeito (Torresmo, Ímã, ponto da explosão da Pinga). */
  cx: number;
  cy: number;
  /** Alvos escolhidos no disparo (Raio, Garçom), na ordem em que são atingidos. */
  alvos: string[];
  /** Só desenho (disparo de um amigo). */
  visual: boolean;
  atingidos: Set<string>;
  /** A Pinga já pôs fogo no chão. */
  feito?: boolean;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Quando (ms depois do disparo) o ponto (px, py) — de quem tem `id` — é atingido. -1 = não é.
 * Pura: igual em todo aparelho para o mesmo disparo.
 */
export function quando(d: Disparo, px: number, py: number, id = ''): number {
  const def = PODER[d.tipo];
  const dx = px - d.x;
  const dy = py - d.y;
  const dist = Math.hypot(dx, dy);
  const ao = dx * d.fx + dy * d.fy;
  const lado = Math.abs(dx * d.fy - dy * d.fx);
  switch (def.forma) {
    case 'circulo': {
      if (dist > def.p.raio! || dist < 0.05) return -1;
      // Cada um tem a sua tampinha numa hora própria (fixa pelo id), entre 0,2 e 1,6 s.
      return 200 + (hash(`${d.t0}:${id || `${px.toFixed(1)},${py.toFixed(1)}`}`) % 1400);
    }
    case 'cone': {
      if (dist < 0.05 || dist > def.p.alcance! || ao <= 0) return -1;
      if (Math.acos(Math.max(-1, Math.min(1, ao / dist))) > def.p.meioAngulo!) return -1;
      return (dist / def.p.vel!) * 1000;
    }
    case 'tornado': {
      if (ao < -0.3 || ao > Math.min(d.len, def.p.alcance!) || lado > def.p.raio!) return -1;
      return (Math.max(0, ao) / def.p.vel!) * 1000;
    }
    case 'onda': {
      if (ao < -0.3 || ao > d.len || lado > def.p.largura!) return -1;
      return (Math.max(0, ao) / def.p.vel!) * 1000;
    }
    case 'anel': {
      if (dist > def.p.raio! || dist < 0.05) return -1;
      return (dist / def.p.vel!) * 1000;
    }
    case 'alvos': {
      const i = d.alvos.indexOf(id);
      return i < 0 ? -1 : def.p.atraso! + i * def.p.passo!;
    }
    case 'ponto':
    case 'ima': {
      return Math.hypot(px - d.cx, py - d.cy) <= def.p.raio! ? def.p.atraso! : -1;
    }
    case 'projetil': {
      // A bola voa até (cx, cy) e explode lá.
      const voo = (Math.hypot(d.cx - d.x, d.cy - d.y) / def.p.vel!) * 1000;
      return Math.hypot(px - d.cx, py - d.cy) <= def.p.raio! ? voo : -1;
    }
  }
}

/** Hora (ms depois do disparo) da explosão da Pinga (para o fogo no chão e o desenho). */
export function vooPinga(d: Disparo): number {
  return (Math.hypot(d.cx - d.x, d.cy - d.y) / PODER.pinga.p.vel!) * 1000;
}

/** Onde está o tornado do Furacão `ms` depois do disparo. */
export function centroFuracao(d: Disparo, ms: number): { x: number; y: number } {
  const a = Math.min(Math.min(d.len, PODER.furacao.p.alcance!), (Math.max(0, ms) / 1000) * PODER.furacao.p.vel!);
  return { x: d.x + d.fx * a, y: d.y + d.fy * a };
}

/**
 * Monta o disparo: `alcance(x, y, fx, fy)` dá até onde a área deixa ir; `corpos` são os candidatos a alvo (para
 * Raio, Garçom e o primeiro que a Pinga encontra), já sem quem disparou.
 */
export function montarDisparo(
  tipo: PoderNovo,
  de: string,
  x: number,
  y: number,
  fx: number,
  fy: number,
  t0: number,
  alcance: (x: number, y: number, fx: number, fy: number) => number,
  corpos: readonly { id: string; x: number; y: number }[],
  visual = false,
): Disparo {
  const n = Math.hypot(fx, fy) || 1;
  const ux = fx / n;
  const uy = fy / n;
  const def = PODER[tipo];
  const len = Math.min(alcance(x, y, ux, uy), def.p.alcance ?? 30);
  let cx = x;
  let cy = y;
  let alvos: string[] = [];
  if (def.forma === 'ponto' || def.forma === 'ima') {
    const a = Math.min(def.p.alcance!, Math.max(0, alcance(x, y, ux, uy) - 0.5));
    cx = x + ux * a;
    cy = y + uy * a;
  } else if (def.forma === 'projetil') {
    // Primeiro corpo na linha (até 0,7 de lado) ou a parede.
    let ate = len;
    for (const c of corpos) {
      const dx = c.x - x;
      const dy = c.y - y;
      const ao = dx * ux + dy * uy;
      if (ao > 0.3 && ao < ate && Math.abs(dx * uy - dy * ux) <= 0.7) ate = ao;
    }
    cx = x + ux * ate;
    cy = y + uy * ate;
  } else if (def.forma === 'alvos') {
    alvos = corpos
      .map((c) => ({ id: c.id, d: Math.hypot(c.x - x, c.y - y) }))
      .filter((c) => c.d <= def.p.raio!)
      .sort((a, b) => a.d - b.d || a.id.localeCompare(b.id))
      .slice(0, def.p.n!)
      .map((c) => c.id);
  }
  return { tipo, de, x, y, fx: ux, fy: uy, t0, len, cx, cy, alvos, visual, atingidos: new Set(visual ? [] : [de]) };
}

/** Direção do empurrão em quem é atingido: para fora do centro (círculo, anel, ponto) ou na direção do disparo. */
export function empurraoDe(d: Disparo, px: number, py: number): { x: number; y: number } {
  const def = PODER[d.tipo];
  const radial = def.forma === 'circulo' || def.forma === 'anel' || def.forma === 'ponto' || def.forma === 'ima' || def.forma === 'projetil';
  const ox = radial ? (def.forma === 'circulo' || def.forma === 'anel' ? d.x : d.cx) : d.x;
  const oy = radial ? (def.forma === 'circulo' || def.forma === 'anel' ? d.y : d.cy) : d.y;
  if (!radial) {
    if (def.forma === 'tornado') {
      // O redemoinho arremessa de lado.
      const lado = (px - d.x) * d.fy - (py - d.y) * d.fx >= 0 ? 1 : -1;
      return { x: d.fy * lado * 0.8 + d.fx * 0.6, y: -d.fx * lado * 0.8 + d.fy * 0.6 };
    }
    return { x: d.fx, y: d.fy };
  }
  const vx = px - ox;
  const vy = py - oy;
  const n = Math.hypot(vx, vy);
  return n > 1e-3 ? { x: vx / n, y: vy / n } : { x: d.fx, y: d.fy };
}
