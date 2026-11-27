/**
 * Fatia 20: NPCs com memória (versão enxuta, inspirada na ideia de "inimigo que lembra de você", sem copiar sistema
 * nenhum). Cada NPC lembra, no seu aparelho, quantas vezes VOCÊ o derrubou: com 1 nocaute ele aparece de curativo
 * (some depois de 7 dias sem apanhar de novo) e te reconhece quando você chega perto; com 3, ganha um apelido que fica.
 * Puro: o relógio e o sorteio vêm de fora.
 */
import { hashTexto } from './eventos';

export interface MemNpc {
  /** Quantas vezes você derrubou este NPC. */
  n: number;
  /** Hora do último nocaute (ms). */
  ultimo: number;
}
export type Memoria = Record<string, MemNpc>;

/** O curativo some depois disso sem apanhar de novo. */
export const CICATRIZ_MS = 7 * 86_400_000;
/** Nocautes para o apelido (que não some). */
export const APELIDO_N = 3;
/** O mesmo NPC não te reconhece de novo antes disso. */
export const RECONHECE_ESPERA_MS = 90_000;
/** Distância para ele te notar (ladrilhos). */
export const RECONHECE_RAIO = 1.6;
/** Altura do curativo acima do pé, na testa (px da tela baixa): o sangue da cabeça nasce a 22; 30 caía no alto do cabelo. */
export const CURATIVO_ALT = 24;

/** Apelidos do bar (o de cada NPC é fixo, pelo id: todo aparelho dá o mesmo). */
export const APELIDOS: readonly string[] = [
  'Queixo de Vidro',
  'Beija-Lona',
  'Tapete do Boteco',
  'Freguês do Chão',
  'Saco de Pancada',
  'Dorminhoco do Salão',
  'Rei do Assoalho',
];

export function apelidoDe(npc: string): string {
  return APELIDOS[hashTexto(`apelido|${npc}`) % APELIDOS.length];
}

/** Lê do localStorage sem confiar: lixo vira memória vazia; números negativos, quebrados ou absurdos saem. */
export function sanitizeMemoria(raw: unknown): Memoria {
  const out: Memoria = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z0-9_-]{1,24}$/.test(k) || !v || typeof v !== 'object') continue;
    const e = v as Record<string, unknown>;
    if (!Number.isInteger(e.n) || (e.n as number) < 1 || (e.n as number) > 100_000) continue;
    if (typeof e.ultimo !== 'number' || !Number.isFinite(e.ultimo) || e.ultimo < 0) continue;
    out[k] = { n: e.n as number, ultimo: e.ultimo };
  }
  return out;
}

/** Mais um nocaute seu neste NPC (devolve memória nova; não mexe na antiga). */
export function registrarNocaute(mem: Memoria, npc: string, t: number): Memoria {
  const e = mem[npc];
  return { ...mem, [npc]: { n: (e?.n ?? 0) + 1, ultimo: Math.max(t, e?.ultimo ?? 0) } };
}

export interface EstadoNpc {
  n: number;
  curativo: boolean;
  apelido: string | null;
}

export function estadoNpc(mem: Memoria, npc: string, t: number): EstadoNpc {
  const e = mem[npc];
  if (!e) return { n: 0, curativo: false, apelido: null };
  return { n: e.n, curativo: t - e.ultimo < CICATRIZ_MS, apelido: e.n >= APELIDO_N ? apelidoDe(npc) : null };
}

/** O que o NPC diz ao te reconhecer (null se ele nunca apanhou de você). */
export const FALAS_RECONHECE = {
  poucas: ['Ei, você de novo? Ainda tô com o curativo.', 'Olha quem chegou… o do soco.', 'Vou ficar de olho em você, hein.', 'Nem vem que hoje eu tô esperto.'],
  apelido: ['Me chamam de {a} por sua causa!', 'Lá vem o culpado do meu apelido.', '{a}… valeu, viu? Agora o bar inteiro me chama assim.', 'Se me chamar de {a} de novo, eu choro.'],
} as const;

export function falaReconhece(e: EstadoNpc, r: () => number): string | null {
  if (e.n < 1) return null;
  const l = e.apelido ? FALAS_RECONHECE.apelido : FALAS_RECONHECE.poucas;
  return l[Math.floor(r() * l.length)].replace('{a}', e.apelido ?? '');
}

/** Ele te reconhece agora? Perto, de pé, já apanhou de você e não falou isso há pouco. */
export function deveReconhecer(e: EstadoNpc, dist: number, emPe: boolean, ultimaFala: number, t: number): boolean {
  return e.n >= 1 && emPe && dist <= RECONHECE_RAIO && t - ultimaFala >= RECONHECE_ESPERA_MS;
}
