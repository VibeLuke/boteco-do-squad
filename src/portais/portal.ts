/**
 * Sistema de portais (Fatia 13), em funções puras.
 *
 * - Portal do dia: sorteado por hash do dia (o dia do bar, que vira às 6 h de Brasília) entre os portais da lista,
 *   sem repetir o de ontem quando há mais de um. O GFA continua fixo no Rocky, fora do sorteio.
 * - Semente do dia por portal: todo mundo joga a mesma ordem de ondas e as mesmas cartas.
 * - Espera de 5 min por portal; 3 runs por portal por dia valem sorteio de prêmio (depois disso a run vale placar e
 *   moeda, só não sorteia). A moeda não tem teto (decisão do dono na Fatia 7: "Sem teto, só medir").
 * - Prêmio em quatro raridades (70, 22, 7 e 1%) com pity suave (a partir de 8 sorteios sem Raro, +4 pontos por
 *   sorteio), duro (o 15º é Raro ou melhor) e Lendário garantido no 60º. O contador só anda em sorteio válido.
 * - Repetido vira Pó de Dimensão (1, 3, 10, 30); 40 de Pó compram um prêmio que falta do mesmo portal. Pó não vira
 *   moeda nem passa para ninguém.
 */
import { hashTexto, rng } from '../vivo/eventos';

export type IdPortal = 'moscas' | 'quermesse' | 'churrasco';
/** Fatia 14: portais revezando (nunca o mesmo dois dias seguidos). Fatia 20: + Churrasco Jurássico. */
export const PORTAIS_DO_DIA: readonly IdPortal[] = ['moscas', 'quermesse', 'churrasco'];
export const NOME_PORTAL: Record<IdPortal, string> = { moscas: 'Moscaria', quermesse: 'Quermesse Maluca', churrasco: 'Churrasco Jurássico' };

export const ESPERA_MS = 5 * 60_000;
export const RUNS_COM_SORTEIO = 3;

/** O portal do dia entre os da lista, sem repetir o de ontem (se der). */
export function portalDoDia<T extends string>(dia: number, lista: readonly T[]): T {
  const n = lista.length;
  if (n === 1) return lista[0];
  // Fórmula fechada (não depende de olhar o resultado de ontem, que dependeria do de anteontem...). A primeira versão
  // comparava com o sorteio cru de ontem e repetia o portal quando ontem tinha sido desempatado (achado na Fatia 14).
  // Com 2 portais, não repetir obriga a alternar.
  if (n === 2) return lista[(dia + (hashTexto('portal|par') % 2)) % 2];
  // Com 3 ou mais: blocos de n dias, cada bloco uma ordem embaralhada da lista (sem repetir dentro do bloco). Na
  // emenda, se o primeiro do bloco é o último do bloco anterior, troca os dois primeiros (a troca não mexe no último,
  // então a emenda seguinte não muda).
  const bloco = (b: number) => {
    const r = rng(hashTexto(`portal|${b}`));
    const p = [...lista];
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    return p;
  };
  const b = Math.floor(dia / n);
  const p = bloco(b);
  if (p[0] === bloco(b - 1)[n - 1]) [p[0], p[1]] = [p[1], p[0]];
  return p[dia - b * n];
}

export const sementeDoDia = (dia: number, portal: string) => hashTexto(`semente|${dia}|${portal}`);

export function podeEntrar(ultima: number, agora: number): boolean {
  return !(ultima > 0) || agora - ultima >= ESPERA_MS;
}

/* ------------------------------------------------------------------ prêmios */

export type Raridade = 'comum' | 'incomum' | 'raro' | 'lendario';
export const RARIDADES: readonly Raridade[] = ['comum', 'incomum', 'raro', 'lendario'];
export const CHANCE: Record<Raridade, number> = { comum: 0.7, incomum: 0.22, raro: 0.07, lendario: 0.01 };
export const PO_REPETIDO: Record<Raridade, number> = { comum: 1, incomum: 3, raro: 10, lendario: 30 };
export const PO_PRECO = 40;
export const NOME_RARIDADE: Record<Raridade, string> = { comum: 'Comum', incomum: 'Incomum', raro: 'Raro', lendario: 'Lendário' };

export const PITY_SUAVE = 8;
export const PITY_PASSO = 0.04;
export const PITY_DURO = 15;
export const PITY_LENDARIO = 60;

export interface Pity {
  /** Sorteios seguidos sem Raro ou melhor. */
  semRaro: number;
  /** Sorteios seguidos sem Lendário. */
  semLendario: number;
}
export const PITY_ZERO: Pity = { semRaro: 0, semLendario: 0 };

/** Raridade do próximo sorteio, com o pity: `r` é um número de 0 a 1 do sorteio. */
export function raridade(p: Pity, r: number, comPity = true): Raridade {
  if (comPity && p.semLendario + 1 >= PITY_LENDARIO) return 'lendario';
  if (comPity && p.semRaro + 1 >= PITY_DURO) return r < CHANCE.lendario / (CHANCE.raro + CHANCE.lendario) ? 'lendario' : 'raro';
  // Pity suave: a partir do 8º sorteio sem Raro, +4 pontos no Raro (tirados do Comum).
  const extra = comPity ? Math.max(0, p.semRaro + 1 - PITY_SUAVE) * PITY_PASSO : 0;
  if (r < CHANCE.lendario) return 'lendario';
  if (r < CHANCE.lendario + CHANCE.raro + extra) return 'raro';
  if (r < CHANCE.lendario + CHANCE.raro + extra + CHANCE.incomum) return 'incomum';
  return 'comum';
}

export function andarPity(p: Pity, r: Raridade): Pity {
  return {
    semRaro: r === 'raro' || r === 'lendario' ? 0 : p.semRaro + 1,
    semLendario: r === 'lendario' ? 0 : p.semLendario + 1,
  };
}

/* ------------------------------------------------------------------ catálogo */

/** Peça do visual que o prêmio destrava: uma cor nova numa lista que já existe, ou (Fatia 16) um chapéu. */
export type Peca = 'camisa' | 'calca' | 'cabelo' | 'chapeu';
export interface Premio {
  id: string;
  portal: IdPortal;
  nome: string;
  raridade: Raridade;
  peca: Peca;
  /** A cor que entra na lista; no chapéu, o id dele (`bone`, `palha`, `cartola`). */
  cor: string;
}

export const PREMIOS: readonly Premio[] = [
  { id: 'mc-camisa-verde', portal: 'moscas', nome: 'Camisa verde-mosca', raridade: 'comum', peca: 'camisa', cor: '#7a9a3a' },
  { id: 'mc-calca-caqui', portal: 'moscas', nome: 'Calça cáqui de garçom', raridade: 'comum', peca: 'calca', cor: '#8a6a3a' },
  { id: 'mc-cabelo-melado', portal: 'moscas', nome: 'Cabelo melado', raridade: 'comum', peca: 'cabelo', cor: '#8f6b3a' },
  { id: 'mc-camisa-inseticida', portal: 'moscas', nome: 'Camisa azul-inseticida', raridade: 'incomum', peca: 'camisa', cor: '#2a6a8a' },
  { id: 'mc-cabelo-asa', portal: 'moscas', nome: 'Cabelo neon de asa', raridade: 'incomum', peca: 'cabelo', cor: '#a8e05f' },
  { id: 'mc-camisa-rainha', portal: 'moscas', nome: 'Camisa dourada da rainha', raridade: 'raro', peca: 'camisa', cor: '#ffd34d' },
  { id: 'mc-calca-enxame', portal: 'moscas', nome: 'Calça roxa de enxame', raridade: 'raro', peca: 'calca', cor: '#5a2a6a' },
  { id: 'mc-cabelo-coroa', portal: 'moscas', nome: 'Cabelo coroado', raridade: 'lendario', peca: 'cabelo', cor: '#fff07a' },
  // Fatia 14: Quermesse Maluca (6 prêmios, pelo menos um em cada raridade).
  { id: 'qm-camisa-chita', portal: 'quermesse', nome: 'Camisa de chita vermelha', raridade: 'comum', peca: 'camisa', cor: '#b8343c' },
  { id: 'qm-calca-remendo', portal: 'quermesse', nome: 'Calça azul de remendo', raridade: 'comum', peca: 'calca', cor: '#3a5a9a' },
  { id: 'qm-cabelo-milho', portal: 'quermesse', nome: 'Cabelo cor de milho', raridade: 'incomum', peca: 'cabelo', cor: '#e8c25a' },
  { id: 'qm-camisa-bandeirinha', portal: 'quermesse', nome: 'Camisa verde-bandeirinha', raridade: 'incomum', peca: 'camisa', cor: '#3a9a5a' },
  { id: 'qm-calca-quadrilha', portal: 'quermesse', nome: 'Calça vinho da quadrilha', raridade: 'raro', peca: 'calca', cor: '#7a2a3a' },
  { id: 'qm-cabelo-fogueira', portal: 'quermesse', nome: 'Cabelo de fogueira', raridade: 'lendario', peca: 'cabelo', cor: '#ff7a2a' },
  // Fatia 16: chapéus.
  { id: 'mc-chapeu-bone', portal: 'moscas', nome: 'Boné de garçom', raridade: 'incomum', peca: 'chapeu', cor: 'bone' },
  { id: 'qm-chapeu-palha', portal: 'quermesse', nome: 'Chapéu de palha da quadrilha', raridade: 'incomum', peca: 'chapeu', cor: 'palha' },
  { id: 'qm-chapeu-cartola', portal: 'quermesse', nome: 'Cartola de cartolina', raridade: 'raro', peca: 'chapeu', cor: 'cartola' },
  // Fatia 20: Churrasco Jurássico.
  { id: 'ch-camisa-avental', portal: 'churrasco', nome: 'Camisa avental de churrasqueiro', raridade: 'comum', peca: 'camisa', cor: '#c8b08a' },
  { id: 'ch-calca-carvao', portal: 'churrasco', nome: 'Calça cor de carvão', raridade: 'comum', peca: 'calca', cor: '#3a3438' },
  { id: 'ch-cabelo-fumaca', portal: 'churrasco', nome: 'Cabelo cinza-fumaça', raridade: 'incomum', peca: 'cabelo', cor: '#9a9aa8' },
  { id: 'ch-camisa-samambaia', portal: 'churrasco', nome: 'Camisa verde-samambaia', raridade: 'incomum', peca: 'camisa', cor: '#4a7a3a' },
  { id: 'ch-calca-lava', portal: 'churrasco', nome: 'Calça laranja-lava', raridade: 'raro', peca: 'calca', cor: '#d8561a' },
  { id: 'ch-cabelo-brasa', portal: 'churrasco', nome: 'Cabelo de brasa', raridade: 'lendario', peca: 'cabelo', cor: '#ff4a1a' },
];
export const premioPorId = (id: string) => PREMIOS.find((p) => p.id === id);

export interface Sorteado {
  raridade: Raridade;
  premio: Premio;
  /** Já tinha: virou Pó. */
  repetido: boolean;
  po: number;
}

/**
 * Um sorteio de prêmio do portal: raridade pelo pity, item da raridade pelo sorteio (se o portal não tiver item
 * dessa raridade, cai na mais perto abaixo), repetido vira Pó.
 */
export function sortearPremio(portal: IdPortal, p: Pity, tem: ReadonlySet<string>, r1: number, r2: number, comPity = true): { s: Sorteado; pity: Pity } {
  const rar = raridade(p, r1, comPity);
  const doPortal = PREMIOS.filter((x) => x.portal === portal);
  let i = RARIDADES.indexOf(rar);
  let lista = doPortal.filter((x) => x.raridade === RARIDADES[i]);
  while (!lista.length && i > 0) lista = doPortal.filter((x) => x.raridade === RARIDADES[--i]);
  for (let j = RARIDADES.indexOf(rar) + 1; !lista.length && j < RARIDADES.length; j++) lista = doPortal.filter((x) => x.raridade === RARIDADES[j]);
  const premio = lista[Math.min(lista.length - 1, Math.floor(r2 * lista.length))];
  const repetido = tem.has(premio.id);
  return { s: { raridade: rar, premio, repetido, po: repetido ? PO_REPETIDO[rar] : 0 }, pity: andarPity(p, rar) };
}

/** Pontos para a run contar como "jogou direito" (vale 1 sorteio), por portal. */
export const LIMIAR_SORTEIO: Record<IdPortal, number> = { moscas: 40, quermesse: 8, churrasco: 30 };

/** Quantos sorteios a run dá (só nas 3 primeiras do dia): 1 se jogou direito, +1 se venceu. */
export function sorteiosDaRun(pontos: number, venceu: boolean, runsHoje: number, portal: IdPortal = 'moscas'): number {
  if (runsHoje >= RUNS_COM_SORTEIO) return 0;
  return (pontos >= LIMIAR_SORTEIO[portal] ? 1 : 0) + (venceu ? 1 : 0);
}

/** Moeda da run da Moscaria: sobe com os pontos, mais um bônus por vencer e outro pela rainha. Sem teto. */
export function moedaMoscas(pontos: number, venceu: boolean, rainha: boolean): number {
  return Math.max(0, Math.floor(pontos / 5)) + (venceu ? 20 : 0) + (rainha ? 40 : 0);
}

/** Moeda da run da Quermesse: R$ 3 por ponto, +R$ 20 se chegou ao fim com fogueira acesa. Sem teto. */
export function moedaQuermesse(pontos: number, venceu: boolean): number {
  return Math.max(0, Math.floor(pontos)) * 3 + (venceu ? 20 : 0);
}

/** Moeda da run do Churrasco Jurássico: R$ 1 a cada 3 pontos, +R$ 20 se chegou na churrasqueira. Sem teto. */
export function moedaChurrasco(pontos: number, venceu: boolean): number {
  return Math.max(0, Math.floor(pontos / 3)) + (venceu ? 20 : 0);
}

/** Moeda da run, por portal. */
export function moedaDoPortal(portal: IdPortal, pontos: number, venceu: boolean, rainha = false): number {
  if (portal === 'churrasco') return moedaChurrasco(pontos, venceu);
  return portal === 'quermesse' ? moedaQuermesse(pontos, venceu) : moedaMoscas(pontos, venceu, rainha);
}

/** Sorteios da run com o sorteio determinístico da semente do dia, do jogador e do número da run. */
export function sorteiosDe(semente: number, jogador: string, run: number): () => number {
  return rng(hashTexto(`premio|${semente}|${jogador}|${run}`));
}

/* ------------------------------------------------------------------ fantasma (o que os amigos veem) */

/** Posição amostrada 5 vezes por segundo, em 2 caracteres base 36 por eixo (0 a 1.295 em décimos de unidade). */
export const FANTASMA_PASSOS = 12;
/** Versão da simulação da Moscaria (igual a `VERSAO` de moscas/sim): fantasma de outra versão não aparece. */
export const VERSAO_MOSCAS = 1;
/** Versão do regente da Quermesse (placar de outra versão não conta). */
export const VERSAO_QUERMESSE = 1;
/** Fatia 20: versão de cada portal (placar de outra versão não aparece). Igual a `VERSAO` de churrasco/sim. */
export const VERSAO_CHURRASCO = 1;
export const VERSAO_PORTAL: Record<IdPortal, number> = { moscas: VERSAO_MOSCAS, quermesse: VERSAO_QUERMESSE, churrasco: VERSAO_CHURRASCO };
export const FANTASMA_MAX = 2400;

export function gravarFantasma(pontos: readonly { x: number; y: number }[]): string {
  const c = (v: number) => Math.max(0, Math.min(1295, Math.round(v * 10))).toString(36).padStart(2, '0');
  return pontos.map((p) => c(p.x) + c(p.y)).join('').slice(0, FANTASMA_MAX);
}

export function lerFantasma(s: unknown): { x: number; y: number }[] {
  if (typeof s !== 'string' || !/^[0-9a-z]*$/.test(s) || s.length % 4 || s.length > FANTASMA_MAX) return [];
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < s.length; i += 4) out.push({ x: parseInt(s.slice(i, i + 2), 36) / 10, y: parseInt(s.slice(i + 2, i + 4), 36) / 10 });
  return out;
}
