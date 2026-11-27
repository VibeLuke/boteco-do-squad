/**
 * Quem frequenta o Bar Vivo: os NPCs, com aparência, temperamento, números de briga e a rotina do dia (pontos por
 * onde passam e quanto tempo ficam em cada um). A rotina é dado puro: a posição sai de (rotina, hora) em rotina.ts.
 */
import type { Look } from '../arena/sprites';

export type Tipo = 'barman' | 'leao' | 'valentao' | 'bebado' | 'garcom' | 'cliente' | 'muambeiro' | 'cientista' | 'faxineira';

/** Como reage quando estoura uma briga por perto. */
export type Temperamento = 'entra' | 'foge' | 'sorteia' | 'protege';

export interface Ficha {
  vida: number;
  dano: number;
  /** Ladrilhos por segundo andando (correndo para a briga é 1,4×). */
  velocidade: number;
  /** Antecipação do golpe (o punho no alto avisando) e a espera depois. */
  antecipa: number;
  recupera: number;
  temperamento: Temperamento;
}

export const FICHAS: Record<Tipo, Ficha> = {
  barman: { vida: 90, dano: 0, velocidade: 2.4, antecipa: 0, recupera: 0, temperamento: 'protege' },
  leao: { vida: 220, dano: 16, velocidade: 3.0, antecipa: 420, recupera: 700, temperamento: 'protege' },
  valentao: { vida: 120, dano: 12, velocidade: 2.8, antecipa: 360, recupera: 620, temperamento: 'entra' },
  bebado: { vida: 70, dano: 7, velocidade: 1.9, antecipa: 480, recupera: 900, temperamento: 'sorteia' },
  garcom: { vida: 80, dano: 0, velocidade: 3.2, antecipa: 0, recupera: 0, temperamento: 'foge' },
  cliente: { vida: 70, dano: 9, velocidade: 2.4, antecipa: 420, recupera: 800, temperamento: 'foge' },
  // O muambeiro defende o ponto dele; o cientista é bêbado e imprevisível.
  muambeiro: { vida: 150, dano: 14, velocidade: 2.6, antecipa: 380, recupera: 650, temperamento: 'protege' },
  cientista: { vida: 80, dano: 8, velocidade: 2.0, antecipa: 460, recupera: 850, temperamento: 'sorteia' },
  // A faxineira só limpa: apanhou, foge resmungando.
  faxineira: { vida: 80, dano: 0, velocidade: 3.4, antecipa: 0, recupera: 0, temperamento: 'foge' },
};

export type Pose = 'stand' | 'sit';

/** Um ponto da rotina: onde parar, por quanto tempo (ms) e em que pose. */
export interface Parada {
  at: readonly [number, number];
  ms: number;
  pose?: Pose;
}

export interface Npc {
  id: string;
  nome: string;
  tipo: Tipo;
  /** Temperamento próprio, quando foge do padrão do tipo (a Dona Cida entra na briga de bolsa). */
  temperamento?: Temperamento;
  look: Look;
  rotina: readonly Parada[];
  /** Só aparece na happy hour (chega pela calçada e vai embora quando acaba). */
  turno?: 'happy';
  /**
   * Ciclo fixo (ms) presos ao relógio do servidor, sem deslocamento próprio: a primeira parada estica até fechar
   * o ciclo (a Dona Maria sai para limpar a cada 3 min cravados).
   */
  ciclo?: number;
}

const pele = {
  clara: ['#f2c9a5', '#d9a27f'],
  media: ['#d9a07a', '#b8805c'],
  morena: ['#a86b48', '#87523a'],
  escura: ['#6e4430', '#56331f'],
} as const;

function look(
  skin: keyof typeof pele,
  hair: string,
  shirt: string,
  shirtShade: string,
  pants: string,
  extra: Partial<Look> = {},
): Look {
  return {
    skin: pele[skin][0],
    skinShade: pele[skin][1],
    hair,
    shirt,
    shirtShade,
    pants,
    shoes: '#2b2b35',
    frame: '#181425',
    hairStyle: 'neat',
    glasses: 'none',
    ...extra,
  };
}

/** A Dona Maria descansa aqui (perto do depósito) e sai para a faxina a cada 1 min (Fatia 6: era 3 min). */
export const MARIA_DESCANSO: readonly [number, number] = [1.5, 1.5];
/** Quanto tempo o chão fica molhado depois que ela passa (ms). */
export const MOLHADO_MS = 8000;

export const NPCS: readonly Npc[] = [
  {
    // Fatia 4: a faxineira que passa o pano no sangue (e deixa o chão molhado). Fatia 6: de minuto em minuto, mais ligeira.
    id: 'maria',
    nome: 'Dona Maria',
    tipo: 'faxineira',
    look: look('morena', '#8b9bb4', '#68aed4', '#3b5dc9', '#5a6988', { hairStyle: 'curly', shoes: '#f4f4f4' }),
    ciclo: 60000,
    rotina: [
      { at: MARIA_DESCANSO, ms: 1000 },
      { at: [4.5, 4.5], ms: 1100 },
      { at: [8.5, 5.5], ms: 1100 },
      { at: [11.5, 4.5], ms: 1100 },
      { at: [14.5, 5.5], ms: 1100 },
      { at: [19.5, 5.5], ms: 1100 },
      { at: [19.5, 8.5], ms: 1100 },
      { at: [15.5, 8.5], ms: 1100 },
      { at: [10.5, 8.5], ms: 1100 },
      { at: [6.5, 7.5], ms: 1100 },
      { at: [2.5, 5.5], ms: 1100 },
    ],
  },
  {
    // Mercado negro do beco: vende o que acaba (faca, soco-inglês, machadinha, serra elétrica).
    id: 'muamba',
    nome: 'Muambeiro',
    tipo: 'muambeiro',
    look: look('morena', '#181425', '#262b44', '#181425', '#3a4466', { hairStyle: 'neat', glasses: 'shades', beard: 'short', beardColor: '#181425', extra: 'jacket' }),
    rotina: [
      { at: [36.5, 6.3], ms: 9000 },
      { at: [36.4, 6.4], ms: 3000 },
    ],
  },
  {
    // Cientista bêbado do portal, amigo do Mortier (sátira com cara, roupa e falas próprias).
    id: 'rocky',
    nome: 'Rocky',
    tipo: 'cientista',
    look: look('clara', '#f4f4f4', '#dfe9e4', '#a9bcb4', '#5a4a3a', { hairStyle: 'curly', beard: 'full', beardColor: '#c0cbdc', extra: 'jacket', frame: '#2ce8f5' }),
    rotina: [
      { at: [25.6, 1.6], ms: 7000 },
      { at: [24.4, 1.5], ms: 2500 },
      { at: [25.2, 2.4], ms: 3500 },
    ],
  },
  {
    id: 'ze',
    nome: 'Seu Zé',
    tipo: 'barman',
    look: look('media', '#d7d7d7', '#f4f4f4', '#c0cbdc', '#3a4466', { hairStyle: 'side', beard: 'short', beardColor: '#d7d7d7', glasses: undefined, frame: '#8b9bb4', extra: 'vneck' }),
    rotina: [
      { at: [3.5, 1.5], ms: 5000 },
      { at: [6.5, 1.5], ms: 4000 },
      { at: [9.5, 1.5], ms: 6000 },
      { at: [10.5, 1.5], ms: 3000 },
    ],
  },
  {
    id: 'tonhao',
    nome: 'Tonhão',
    tipo: 'leao',
    look: look('escura', '#181425', '#181425', '#0b0a10', '#262b44', { glasses: 'shades', extra: 'jacket', shoes: '#0b0a10' }),
    rotina: [
      { at: [1.5, 9.5], ms: 9000 },
      { at: [10.5, 9.5], ms: 7000 },
      { at: [16.5, 9.5], ms: 7000 },
      { at: [7.5, 8.5], ms: 5000 },
    ],
  },
  {
    id: 'juninho',
    nome: 'Garçom Juninho',
    tipo: 'garcom',
    look: look('clara', '#b86f50', '#f4f4f4', '#c0cbdc', '#181425', { hairStyle: 'side' }),
    rotina: [
      { at: [10.5, 3.5], ms: 2500 },
      { at: [4.5, 5.5], ms: 3000 },
      { at: [7.5, 7.5], ms: 3000 },
      { at: [4.5, 10.5], ms: 3000 },
      { at: [9.5, 11.5], ms: 2500 },
      { at: [14.5, 11.5], ms: 3000 },
      { at: [11.5, 8.5], ms: 2000 },
    ],
  },
  {
    id: 'marrento',
    nome: 'Marrento',
    tipo: 'valentao',
    look: look('morena', '#181425', '#e43b44', '#a22633', '#262b44', { beard: 'short', beardColor: '#181425', extra: 'necklace' }),
    rotina: [
      { at: [19.5, 3.5], ms: 10000 },
      { at: [17.5, 5.5], ms: 8000 },
      { at: [20.5, 3.5], ms: 9000 },
    ],
  },
  {
    id: 'cabeca',
    nome: 'Cabeça',
    tipo: 'valentao',
    look: look('clara', '#feae34', '#3e8948', '#265c42', '#4a4f5c', { hairStyle: 'curly', extra: 'nike' }),
    rotina: [
      { at: [20.5, 6.5], ms: 9000 },
      { at: [15.5, 5.5], ms: 7000 },
      { at: [19.5, 2.5], ms: 8000 },
    ],
  },
  {
    id: 'pinguco',
    nome: 'Pinguço',
    tipo: 'bebado',
    look: look('media', '#5a3a22', '#feae34', '#c28a1f', '#5c3620', { hairStyle: 'curly', beard: 'full', beardColor: '#5a3a22', prop: 'can' }),
    rotina: [
      { at: [8.5, 3.5], ms: 15000 },
      { at: [6.5, 11.5], ms: 8000 },
      { at: [12.5, 12.5], ms: 6000 },
    ],
  },
  {
    id: 'biriba',
    nome: 'Biriba',
    tipo: 'bebado',
    look: look('escura', '#3a2a22', '#0099db', '#006b9e', '#c9a86a', { shorts: true, hairStyle: 'side' }),
    rotina: [
      { at: [13.5, 13.5], ms: 10000 },
      { at: [1.5, 11.5], ms: 8000 },
      { at: [10.5, 5.5], ms: 10000 },
    ],
  },
  {
    id: 'cida',
    nome: 'Dona Cida',
    tipo: 'cliente',
    temperamento: 'entra',
    look: look('morena', '#c0cbdc', '#b55088', '#8a3a68', '#733e39', { hairStyle: 'long', glasses: undefined, frame: '#b55088' }),
    rotina: [
      { at: [2.5, 11.5], ms: 30000, pose: 'sit' },
      { at: [3.5, 12.5], ms: 20000, pose: 'sit' },
    ],
  },
  {
    id: 'ricardao',
    nome: 'Ricardão',
    tipo: 'cliente',
    look: look('clara', '#3b2416', '#2ce8f5', '#0099db', '#3a4466', { hairStyle: 'neat', extra: 'jacket' }),
    rotina: [
      { at: [16.5, 11.5], ms: 25000, pose: 'sit' },
      { at: [14.5, 13.5], ms: 8000 },
    ],
  },
  {
    id: 'kelly',
    nome: 'Kelly',
    tipo: 'cliente',
    temperamento: 'sorteia',
    look: look('media', '#733e39', '#68386c', '#45283c', '#181425', { hairStyle: 'straight', extra: 'vneck' }),
    rotina: [
      { at: [15.5, 12.5], ms: 25000, pose: 'sit' },
      { at: [17.5, 13.5], ms: 8000 },
    ],
  },
  // Fatia 2: a fila do banheiro, o banheiro, o beco, a calçada e o salão mais cheios.
  {
    id: 'apertado',
    nome: 'Apertado da fila',
    tipo: 'cliente',
    temperamento: 'sorteia',
    look: look('clara', '#5a3a22', '#ef7d57', '#b8481f', '#3a4466', { hairStyle: 'side' }),
    rotina: [
      { at: [1.5, 6.5], ms: 20000 },
      { at: [1.5, 7.5], ms: 6000 },
      { at: [2.5, 5.5], ms: 8000 },
    ],
  },
  {
    id: 'chorao',
    nome: 'Chorão do espelho',
    tipo: 'bebado',
    look: look('media', '#181425', '#5a6988', '#3a4466', '#262b44', { hairStyle: 'straight', glasses: undefined, frame: '#181425' }),
    rotina: [
      { at: [43.5, 2.5], ms: 30000 },
      { at: [45.5, 3.5], ms: 12000 },
    ],
  },
  {
    id: 'mano',
    nome: 'Mano do beco',
    tipo: 'valentao',
    look: look('escura', '#181425', '#262b44', '#181c30', '#4a4f5c', { extra: 'jacket', glasses: 'shades' }),
    rotina: [
      { at: [24.5, 2.5], ms: 12000 },
      { at: [26.5, 5.5], ms: 10000 },
      { at: [23.5, 8.5], ms: 8000 },
    ],
  },
  {
    id: 'grafiteiro',
    nome: 'Grafiteiro',
    tipo: 'cliente',
    look: look('morena', '#63c74d', '#feae34', '#c28a1f', '#5c3620', { hairStyle: 'curly', extra: 'nike' }),
    rotina: [
      { at: [25.5, 1.6], ms: 25000 },
      { at: [23.5, 1.6], ms: 15000 },
    ],
  },
  {
    id: 'toninho',
    nome: 'Seu Toninho do churrasquinho',
    tipo: 'barman',
    look: look('media', '#c0cbdc', '#f4f4f4', '#c0cbdc', '#733e39', { hairStyle: 'neat', beard: 'short', beardColor: '#c0cbdc' }),
    rotina: [
      { at: [23.5, 10.6], ms: 40000 },
      { at: [24.5, 11.5], ms: 8000 },
    ],
  },
  {
    id: 'motoboy',
    nome: 'Motoboy',
    tipo: 'cliente',
    temperamento: 'sorteia',
    look: look('clara', '#3b2416', '#e43b44', '#a22633', '#181425', { hairStyle: 'neat', extra: 'jacket' }),
    rotina: [
      { at: [10.5, 13.5], ms: 15000 },
      { at: [18.5, 13.5], ms: 10000 },
      { at: [25.5, 13.5], ms: 9000 },
    ],
  },
  {
    id: 'tiozao',
    nome: 'Tiozão do pagode',
    tipo: 'bebado',
    look: look('morena', '#2b2b35', '#f4f4f4', '#c0cbdc', '#5c3620', { hairStyle: 'neat', beard: 'full', beardColor: '#2b2b35', prop: 'can' }),
    rotina: [
      { at: [2.5, 6.5], ms: 30000, pose: 'sit' },
      { at: [8.5, 8.5], ms: 25000, pose: 'sit' },
    ],
  },
  {
    id: 'tubarao',
    nome: 'Tubarão da sinuca',
    tipo: 'valentao',
    look: look('clara', '#5a3a22', '#68386c', '#45283c', '#181425', { hairStyle: 'side', beard: 'short', beardColor: '#5a3a22', extra: 'vneck' }),
    rotina: [
      { at: [16.5, 4.5], ms: 12000 },
      { at: [20.5, 5.5], ms: 10000 },
      { at: [19.5, 6.5], ms: 8000 },
    ],
  },
  // Happy hour: chegam pela calçada, lotam o balcão e vão embora quando acaba.
  {
    id: 'happy1',
    nome: 'Estagiário da firma',
    tipo: 'bebado',
    turno: 'happy',
    look: look('clara', '#feae34', '#0099db', '#006b9e', '#3a4466', { hairStyle: 'side', extra: 'turtle' }),
    rotina: [
      { at: [4.5, 3.6], ms: 30000 },
      { at: [10.5, 4.5], ms: 10000 },
    ],
  },
  {
    id: 'happy2',
    nome: 'Gerente de sexta',
    tipo: 'valentao',
    turno: 'happy',
    look: look('media', '#3b2416', '#c0cbdc', '#8b9bb4', '#262b44', { hairStyle: 'neat', extra: 'vneck', glasses: undefined }),
    rotina: [
      { at: [10.5, 3.4], ms: 25000 },
      { at: [11.5, 5.5], ms: 12000 },
    ],
  },
  {
    id: 'happy3',
    nome: 'Moça do RH',
    tipo: 'cliente',
    temperamento: 'entra',
    turno: 'happy',
    look: look('escura', '#181425', '#e43b44', '#a22633', '#181425', { hairStyle: 'long' }),
    rotina: [
      { at: [8.5, 3.6], ms: 28000 },
      { at: [7.5, 5.5], ms: 9000 },
    ],
  },
  {
    id: 'happy4',
    nome: 'Cara do TI',
    tipo: 'cliente',
    turno: 'happy',
    look: look('clara', '#181425', '#181425', '#0b0a10', '#3a4466', { hairStyle: 'curly', glasses: undefined }),
    rotina: [
      { at: [11.5, 3.5], ms: 30000 },
      { at: [5.5, 7.5], ms: 10000 },
    ],
  },
];

export const NPC_BY_ID: Record<string, Npc> = Object.fromEntries(NPCS.map((n) => [n.id, n]));

export const temperamentoDe = (n: Npc): Temperamento => n.temperamento ?? FICHAS[n.tipo].temperamento;

/* ------------------------------------------------------------------ clientes novos (chegam quando alguém é recolhido) */

/** Funcionário levanta do nocaute; cliente nocauteado é recolhido pelo Seu Zé e dá lugar a outro. */
/** Quem trabalha (ou "trabalha") no bar levanta sozinho do nocaute, em vez de ser recolhido. */
export const FUNCIONARIOS: readonly Tipo[] = ['barman', 'leao', 'garcom', 'muambeiro', 'cientista', 'faxineira'];

export const APELIDOS = [
  'Coach de Boteco', 'Primo do Zé', 'Cara do Uber', 'Ex do Biriba', 'Turista Perdido', 'Influencer da Firma',
  'Torcedor Rouco', 'Fiscal da Prefeitura', 'Moço do Pix', 'Tio do Pavê', 'Vendedor de Curso', 'Noivo Fugido',
  'DJ de Aniversário', 'Cantor de Karaokê', 'Gerente de Nada', 'Sócio Oculto', 'Corintiano Sofrido', 'Rapaz da Academia',
  'Guru do Bitcoin', 'Garota do Pagode', 'Cobrador de Fiado', 'Estudante de Direito',
] as const;

/** Lugares do salão e da calçada onde um cliente novo pode ficar (paradas dos frequentes, sem funcionário e sem turno). */
export const LUGARES: readonly Parada[] = (() => {
  const vistos = new Set<string>();
  const out: Parada[] = [];
  for (const n of NPCS) {
    if (n.turno || FUNCIONARIOS.includes(n.tipo)) continue;
    for (const p of n.rotina) {
      if (p.at[0] >= 30) continue; // banheiro fica para quem já mora lá
      const k = `${p.at[0]},${p.at[1]}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      out.push(p);
    }
  }
  return out;
})();

const CAMISAS_NPC = ['#e43b44', '#3e8948', '#0099db', '#feae34', '#b55088', '#f4f4f4', '#ef7d57', '#2ce8f5', '#68386c', '#c28a1f', '#5a6988'];
const CALCAS_NPC = ['#262b44', '#3a4466', '#c9a86a', '#181425', '#5c3620', '#4a4f5c'];
const CABELOS_NPC = ['#181425', '#3b2416', '#5a3a22', '#b86f50', '#feae34', '#c0cbdc', '#e43b44'];
const CORTES_NPC: Look['hairStyle'][] = ['curly', 'neat', 'side', 'straight', 'long'];
const TIPOS_AVULSO: readonly Tipo[] = ['cliente', 'cliente', 'bebado', 'valentao'];

/** Um cliente novo sorteado (`r` devolve 0..1; o motor passa o sorteio dele, que é determinístico). */
export function clienteAvulso(n: number, r: () => number): Npc {
  const de = <T,>(l: readonly T[]) => l[Math.floor(r() * l.length) % l.length];
  const camisa = de(CAMISAS_NPC);
  const peles = Object.keys(pele) as (keyof typeof pele)[];
  const extra: Partial<Look> = { hairStyle: de(CORTES_NPC) };
  if (r() < 0.35) extra.beard = r() < 0.5 ? 'short' : 'full';
  if (r() < 0.2) extra.glasses = 'shades';
  if (r() < 0.3) extra.shorts = true;
  const sombra = (c: string) =>
    `#${[1, 3, 5].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * 0.68).toString(16).padStart(2, '0')).join('')}`;
  const paradas: Parada[] = [];
  const quantas = 2 + Math.floor(r() * 2);
  const usadas = new Set<Parada>();
  for (let i = 0; i < quantas; i++) {
    const p = de(LUGARES);
    if (usadas.has(p)) continue;
    usadas.add(p);
    paradas.push({ ...p, ms: 8000 + Math.floor(r() * 20000) });
  }
  for (let k = 0; paradas.length < 2; k++) {
    const p = LUGARES[(n * 7 + k) % LUGARES.length];
    if (!usadas.has(p)) {
      usadas.add(p);
      paradas.push({ ...p, ms: 12000 });
    }
  }
  return {
    id: `avulso${n}`,
    nome: de(APELIDOS),
    tipo: de(TIPOS_AVULSO),
    look: look(de(peles), de(CABELOS_NPC), camisa, sombra(camisa), de(CALCAS_NPC), extra),
    rotina: paradas,
  };
}
