/**
 * Regente da Quermesse Maluca (Fatia 14): só encadeia os microjogos. A run começa com 3 fogueiras; cada microjogo
 * vencido vale 1 ponto (o chefe vale 3) e +1 a cada 5 seguidos sem erro; perder ou estourar o tempo apaga uma
 * fogueira. A cada 3 microjogos a velocidade sobe ×1,12 (teto ×2,0); a cada 8, o chefe. A run tem teto de 120 s
 * contado em passos (7.200), nunca em relógio; chegou ao fim com fogueira acesa, venceu e ganha +2 por fogueira.
 * A ordem vem da semente do dia, sem repetir o microjogo anterior: todo mundo do bar pega a mesma sequência.
 */
import { hashTexto, rng } from '../../vivo/eventos';
import { micro as acerte } from './acerte';
import { micro as dance } from './dance';
import { micro as pesque } from './pesque';
import { micro as quebre } from './quebre';
import { micro as salte } from './salte';
import { PARADA, type EntradaQ, type Micro, type Resultado } from './tipos';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Qualquer = Micro<any>;
export const MICROS: readonly Qualquer[] = [pesque, quebre, salte, acerte];
export const CHEFES: readonly Qualquer[] = [dance];
export const CATALOGO: readonly Qualquer[] = [...MICROS, ...CHEFES];
export const microPorId = (id: string) => CATALOGO.find((m) => m.id === id)!;

export const PASSOS_RUN = 7200;
/** Verbo grande na tela com a fogueira piscando antes de cada microjogo (0,5 s). */
export const AVISO = 30;
/** Pausa do resultado (0,4 s): o doce voando, o peixe subindo. */
export const PAUSA = 24;
export const FOGUEIRAS = 3;
export const CHEFE_CADA = 8;
export const SOBE_CADA = 3;
export const FATOR = 1.12;
export const VEL_MAX = 2;
/** Posições pré-sorteadas (a run mais rápida possível não passa de ~40 microjogos em 120 s). */
export const ORDEM_N = 64;

export const velDe = (jogados: number) => Math.min(VEL_MAX, Math.pow(FATOR, Math.floor(jogados / SOBE_CADA)));

/** A ordem do dia: posição 8, 16, 24... é chefe; nas outras, um microjogo diferente do anterior. */
export function ordem(semente: number, n = ORDEM_N): string[] {
  const r = rng(hashTexto(`ordem|${semente}`));
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    if (i % CHEFE_CADA === 0) {
      out.push(CHEFES[(i / CHEFE_CADA - 1) % CHEFES.length].id);
      continue;
    }
    const antes = out[out.length - 1];
    const opcoes = MICROS.filter((m) => m.id !== antes);
    out.push(opcoes[Math.floor(r() * opcoes.length)].id);
  }
  return out;
}

export type EvQ =
  | { k: 'aviso'; id: string; verbo: string; i: number; vel: number; chefe: boolean }
  | { k: 'ganhou'; id: string; pontos: number }
  | { k: 'perdeu'; id: string; fogueiras: number }
  | { k: 'bonus' }
  | { k: 'acelerou'; vel: number }
  | { k: 'fim'; como: 'venceu' | 'perdeu' };

export interface Quermesse {
  semente: number;
  passo: number;
  fase: 'aviso' | 'jogo' | 'pausa' | 'fim';
  faseT: number;
  /** Posição atual na ordem (1 é o primeiro). */
  i: number;
  ordem: string[];
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  e: any;
  vel: number;
  fogueiras: number;
  vencidos: number;
  jogados: number;
  seguidos: number;
  pontos: number;
  ultimo: Resultado | null;
  fim: null | 'venceu' | 'perdeu';
  ev: EvQ[];
}

export function novaQuermesse(semente: number): Quermesse {
  const q: Quermesse = {
    semente: semente >>> 0,
    passo: 0,
    fase: 'aviso',
    faseT: AVISO,
    i: 1,
    ordem: ordem(semente >>> 0),
    id: '',
    e: null,
    vel: 1,
    fogueiras: FOGUEIRAS,
    vencidos: 0,
    jogados: 0,
    seguidos: 0,
    pontos: 0,
    ultimo: null,
    fim: null,
    ev: [],
  };
  preparar(q);
  return q;
}

function preparar(q: Quermesse) {
  q.id = q.ordem[(q.i - 1) % q.ordem.length];
  const m = microPorId(q.id);
  // O sorteio de cada posição só depende da semente e da posição (igual para todos, jogue como jogar).
  q.e = m.iniciar(rng(hashTexto(`qm|${q.semente}|${q.i}`)), q.vel);
  q.fase = 'aviso';
  q.faseT = AVISO;
  q.ev.push({ k: 'aviso', id: q.id, verbo: m.verbo, i: q.i, vel: q.vel, chefe: !!m.chefe });
}

function encerrar(q: Quermesse, como: 'venceu' | 'perdeu') {
  q.fim = como;
  q.fase = 'fim';
  if (como === 'venceu') q.pontos += 2 * q.fogueiras;
  q.ev.push({ k: 'fim', como });
}

/** Um passo de 1/60 s da run inteira. */
export function passoQ(q: Quermesse, ent: EntradaQ) {
  q.ev = [];
  if (q.fim) return;
  q.passo++;
  const m = microPorId(q.id);
  if (q.fase === 'aviso') {
    if (--q.faseT <= 0) q.fase = 'jogo';
  } else if (q.fase === 'jogo') {
    m.passo(q.e, ent);
    const r = m.resultado(q.e);
    if (r !== 'andando') {
      q.ultimo = r;
      q.jogados++;
      if (r === 'ganhou') {
        q.vencidos++;
        q.seguidos++;
        const p = m.chefe ? 3 : 1;
        q.pontos += p;
        q.ev.push({ k: 'ganhou', id: q.id, pontos: p });
        if (q.seguidos % 5 === 0) {
          q.pontos++;
          q.ev.push({ k: 'bonus' });
        }
      } else {
        q.fogueiras--;
        q.seguidos = 0;
        q.ev.push({ k: 'perdeu', id: q.id, fogueiras: q.fogueiras });
      }
      q.fase = 'pausa';
      q.faseT = PAUSA;
    }
  } else if (q.fase === 'pausa') {
    m.passo(q.e, PARADA);
    if (--q.faseT <= 0) {
      if (q.fogueiras <= 0) {
        encerrar(q, 'perdeu');
        return;
      }
      const antes = q.vel;
      q.i++;
      q.vel = velDe(q.jogados);
      if (q.vel !== antes) q.ev.push({ k: 'acelerou', vel: q.vel });
      preparar(q);
    }
  }
  if (q.passo >= PASSOS_RUN && !q.fim) encerrar(q, q.fogueiras > 0 ? 'venceu' : 'perdeu');
}

/** Pontos para o placar e a moeda (já com as fogueiras que sobraram, se venceu). */
export const pontuacaoQ = (q: Quermesse) => q.pontos;
