/**
 * Fatia 18 (Mesa cheia, versão enxuta): Porrinha contra a mesa do bar, o narrador do rádio e o mural de boatos.
 * Tudo aqui é puro (sem tela, sem banco): o sorteio vem de um `rng` passado de fora, e o mesmo estado com as mesmas
 * jogadas dá o mesmo resultado em qualquer aparelho.
 */
import { hashTexto, rng } from './eventos';
import type { Linha } from './interacoes';

/* ------------------------------------------------------------------ Porrinha */

/** Cada um esconde de 0 a 3 tampinhas na mão. */
export const PORRINHA_MAX_MAO = 3;
/** Quem fica por último paga a rodada (R$). */
export const PORRINHA_RODADA = 3;
/** Partidas que pagam por dia (a mesa do bar não tem fundo infinito). */
export const PORRINHA_PAGAS_DIA = 5;
/** Os adversários da mesa (NPCs do bar). */
export const PORRINHA_MESA = ['biriba', 'tiozao'] as const;
export const PORRINHA_NOME: Record<string, string> = { eu: 'Você', biriba: 'Biriba', tiozao: 'Tiozão do pagode' };

export interface Porrinha {
  /** Quem ainda está na mesa, na ordem de quem palpita. */
  vivos: string[];
  /** Índice (em `vivos`) de quem abre os palpites desta rodada. */
  comeca: number;
  /** A mão escondida de cada um nesta rodada (null antes de todos esconderem). */
  maos: Record<string, number> | null;
  palpites: { quem: string; n: number }[];
  rodada: number;
  /** Ordem em que saíram (quem acertou o total sai da mesa). */
  saiu: string[];
  perdedor: string | null;
}

export function novaPorrinha(jogadores: readonly string[], comeca = 0): Porrinha {
  return { vivos: [...jogadores], comeca: ((comeca % jogadores.length) + jogadores.length) % jogadores.length, maos: null, palpites: [], rodada: 1, saiu: [], perdedor: null };
}

/** De quem é a vez de palpitar (null com todos já palpitados ou o jogo acabado). */
export function vezDe(e: Porrinha): string | null {
  if (e.perdedor || !e.maos || e.palpites.length >= e.vivos.length) return null;
  return e.vivos[(e.comeca + e.palpites.length) % e.vivos.length];
}

/** Totais que ainda dá para cantar: de 0 a 3 por cabeça, sem repetir o de ninguém. */
export function palpitesLivres(e: Porrinha): number[] {
  const usados = new Set(e.palpites.map((p) => p.n));
  const out: number[] = [];
  for (let n = 0; n <= PORRINHA_MAX_MAO * e.vivos.length; n++) if (!usados.has(n)) out.push(n);
  return out;
}

export function esconder(e: Porrinha, maos: Record<string, number>): { ok: true } | { ok: false; motivo: string } {
  if (e.perdedor) return { ok: false, motivo: 'O jogo acabou.' };
  for (const q of e.vivos) {
    const v = maos[q];
    if (!Number.isInteger(v) || v < 0 || v > PORRINHA_MAX_MAO) return { ok: false, motivo: `Mão inválida de ${PORRINHA_NOME[q] ?? q}.` };
  }
  e.maos = Object.fromEntries(e.vivos.map((q) => [q, maos[q]]));
  e.palpites = [];
  return { ok: true };
}

export function palpitar(e: Porrinha, quem: string, n: number): { ok: true } | { ok: false; motivo: string } {
  if (vezDe(e) !== quem) return { ok: false, motivo: 'Não é a sua vez.' };
  if (!Number.isInteger(n) || n < 0 || n > PORRINHA_MAX_MAO * e.vivos.length) return { ok: false, motivo: `Palpite vai de 0 a ${PORRINHA_MAX_MAO * e.vivos.length}.` };
  if (e.palpites.some((p) => p.n === n)) return { ok: false, motivo: `${n} já foi cantado.` };
  e.palpites.push({ quem, n });
  return { ok: true };
}

/**
 * Abre as mãos: quem cantou o total certo sai da mesa (ninguém acertou: ninguém sai). Com um só sobrando, ele perdeu.
 * A próxima rodada abre com quem vem depois de quem abriu esta.
 */
export function revelar(e: Porrinha): { total: number; acertou: string | null } {
  if (!e.maos || e.palpites.length < e.vivos.length) throw new Error('Ainda tem gente para palpitar.');
  const total = e.vivos.reduce((s, q) => s + (e.maos![q] ?? 0), 0);
  const acertou = e.palpites.find((p) => p.n === total)?.quem ?? null;
  const abriu = e.vivos[e.comeca % e.vivos.length];
  if (acertou) {
    e.vivos = e.vivos.filter((q) => q !== acertou);
    e.saiu.push(acertou);
  }
  if (e.vivos.length === 1) e.perdedor = e.vivos[0];
  // Quem abre a próxima: o seguinte a quem abriu esta (contando quem continua na mesa).
  const i = e.vivos.indexOf(abriu);
  e.comeca = i >= 0 ? (i + 1) % e.vivos.length : Math.min(e.comeca, e.vivos.length - 1);
  e.maos = null;
  e.palpites = [];
  e.rodada++;
  return { total, acertou };
}

/** A mão de um NPC (0 a 3, sorteada). */
export function maoNpc(r: () => number): number {
  return Math.floor(r() * (PORRINHA_MAX_MAO + 1));
}

/**
 * O palpite de um NPC: a própria mão mais a média dos outros (1,5 por cabeça), com um tranco de ±1 de vez em quando,
 * no total livre mais perto disso.
 */
export function palpiteNpc(e: Porrinha, mao: number, r: () => number): number {
  const alvo = mao + 1.5 * (e.vivos.length - 1) + (r() < 0.4 ? (r() < 0.5 ? -1 : 1) : 0);
  const livres = palpitesLivres(e).filter((n) => n >= mao && n <= mao + PORRINHA_MAX_MAO * (e.vivos.length - 1));
  const pool = livres.length ? livres : palpitesLivres(e);
  return pool.reduce((melhor, n) => (Math.abs(n - alvo) < Math.abs(melhor - alvo) || (Math.abs(n - alvo) === Math.abs(melhor - alvo) && r() < 0.5) ? n : melhor), pool[0]);
}

/* ------------------------------------------------------------------ o narrador do rádio */

export type Gatilho = 'ko_eu' | 'ko_outro' | 'evento' | 'evento_fim' | 'brinde' | 'porrinha_ganhou' | 'porrinha_perdeu' | 'porrinha_fiado' | 'boato' | 'voltou';

/** 3 a 5 jeitos de dizer cada coisa ({x} vira o nome, o bicho ou o resumo). */
export const FALAS: Record<Gatilho, readonly string[]> = {
  ko_eu: [
    'E cai! Cai o freguês no assoalho do Boteco do Squad!',
    'Alguém chama a ambulância… ou pelo menos traz um copo d’água.',
    'Que tombo, minha gente. Dez pontos pra queda, zero pro estilo.',
    'Lá vai mais um tirar um cochilo no chão. O Seu Zé que lute.',
  ],
  ko_outro: [
    '{x} foi pro chão! O salão vai à loucura!',
    'E {x} beija a lona do boteco!',
    'Atenção, ouvintes: {x} saiu de combate. Alguém anota.',
    '{x} pediu a conta… do jeito mais doído.',
  ],
  evento: [
    'Interrompemos a programação para um aviso urgente do Boteco do Squad!',
    'Ouvintes, tem coisa estranha acontecendo no bar. Fiquem ligados.',
    'Aqui é a Rádio Saideira, e eu não estou gostando nada disso.',
  ],
  evento_fim: [
    'E acabou! {x} resolveu o problema do bar. Palmas!',
    'Missão cumprida: {x} salvou a noite do boteco.',
    'O bar respira aliviado. Quem resolveu? {x}, é claro.',
  ],
  brinde: [
    'Tim-tim! Brinde registrado pela Rádio Saideira.',
    'Copos pro alto! Amizade é isso aí.',
    'Mais um brinde, mais uma história pro livro do bar.',
  ],
  porrinha_ganhou: [
    'Na Porrinha, {x} cantou na mosca e saiu da mesa!',
    'Que leitura de mão! {x} acertou o total.',
    '{x} adivinhou as tampinhas de todo mundo. Tem pacto, só pode.',
    'Olho clínico de {x} na Porrinha!',
  ],
  porrinha_perdeu: [
    'Sobrou pra {x}: paga a rodada da Porrinha!',
    '{x} ficou por último na Porrinha. Bota na conta!',
    'E quem paga a saideira é… {x}!',
  ],
  porrinha_fiado: [
    '{x} perdeu na Porrinha e pendurou no fiado. O Seu Zé anotou.',
    'Sem grana pra rodada? {x} vai no caderninho do fiado.',
    'Fiado de novo, {x}? A lousa já tá ficando pequena.',
  ],
  boato: [
    'Corre à boca pequena aqui no bar: {x}',
    'A Rádio Saideira apurou: {x}',
    'Fofoca da hora, direto do balcão: {x}',
    'Não fui eu que falei, mas… {x}',
  ],
  voltou: [
    'Olha quem voltou! Enquanto você tava fora: {x}',
    'Bem-vindo de volta ao Boteco do Squad. Perdeu isso aqui: {x}',
    'Chegou atrasado, hein? Resumo da ópera: {x}',
  ],
};

/** Quantas falas recentes de cada gatilho não podem se repetir (no máximo variações − 1). */
export const JANELA_RECENTE = 3;
/** Fila curta: o rádio não acumula falas velhas. */
export const FILA_MAX = 3;
/** Fala que espera mais que isso na fila perde a graça e sai. */
export const FALA_VENCE_MS = 10_000;
/** Prioridade (maior fala antes). */
export const PRIORIDADE: Record<Gatilho, number> = {
  evento: 5,
  evento_fim: 5,
  ko_eu: 4,
  porrinha_perdeu: 4,
  porrinha_fiado: 4,
  porrinha_ganhou: 3,
  voltou: 3,
  ko_outro: 2,
  brinde: 2,
  boato: 1,
};

export interface Narrador {
  recentes: Partial<Record<Gatilho, number[]>>;
  fila: { g: Gatilho; texto: string; t: number }[];
  /** Até quando a fala atual ocupa o rádio. */
  ate: number;
  atual: string | null;
}

export function novoNarrador(): Narrador {
  return { recentes: {}, fila: [], ate: 0, atual: null };
}

/** Quanto tempo uma fala fica no ar (lida com calma, sem tapar a próxima). */
export function duracaoFala(texto: string): number {
  return Math.max(2500, Math.min(7000, 1600 + 50 * texto.length));
}

/**
 * Põe uma fala na fila. Escolhe uma variação que não saiu nas últimas `JANELA_RECENTE` do mesmo gatilho; o mesmo
 * gatilho não entra duas vezes na fila; com a fila cheia, sai a de menor prioridade (a mais velha no empate).
 */
export function narrar(n: Narrador, g: Gatilho, t: number, r: () => number, x = ''): boolean {
  if (n.fila.some((f) => f.g === g)) return false;
  const vars = FALAS[g];
  const rec = n.recentes[g] ?? [];
  const janela = Math.min(JANELA_RECENTE, vars.length - 1);
  const livres = vars.map((_, i) => i).filter((i) => !rec.slice(-janela).includes(i));
  const i = livres[Math.floor(r() * livres.length)];
  n.recentes[g] = [...rec, i].slice(-JANELA_RECENTE);
  n.fila.push({ g, texto: vars[i].replace('{x}', x), t });
  if (n.fila.length > FILA_MAX) {
    let pior = 0;
    for (let k = 1; k < n.fila.length; k++) if (PRIORIDADE[n.fila[k].g] < PRIORIDADE[n.fila[pior].g]) pior = k;
    n.fila.splice(pior, 1);
  }
  return true;
}

/** A próxima fala a ir ao ar (null enquanto a atual não terminou ou com a fila vazia). */
export function proximaFala(n: Narrador, t: number): string | null {
  if (t < n.ate) return null;
  n.atual = null;
  n.fila = n.fila.filter((f) => t - f.t <= FALA_VENCE_MS);
  if (!n.fila.length) return null;
  let k = 0;
  for (let j = 1; j < n.fila.length; j++) if (PRIORIDADE[n.fila[j].g] > PRIORIDADE[n.fila[k].g]) k = j;
  const [f] = n.fila.splice(k, 1);
  n.atual = f.texto;
  n.ate = t + duracaoFala(f.texto);
  return f.texto;
}

/* ------------------------------------------------------------------ boatos (sempre de um fato verdadeiro) */

export const MOLDES_BOATO: readonly string[] = [
  'Dizem por aí que {f}.',
  'Psiu… {f}. Mas não fui eu que contei.',
  'O Seu Zé jura de pé junto que {f}.',
  'Tá na boca do povo: {f}.',
  'Ninguém confirma, mas {f}.',
];

export interface Boato {
  texto: string;
  /** O fato do livro do bar de onde o boato saiu (o boato sempre cita ele inteiro). */
  fato: string;
  t: number;
}

/** O boato de um fato (o fato vai inteiro, só ganha a moldura de fofoca); `evitar` é a moldura do boato anterior. */
export function boatoDe(l: Linha, r: () => number, evitar = -1): Boato & { molde: number } {
  let i = Math.floor(r() * MOLDES_BOATO.length);
  if (i === evitar) i = (i + 1) % MOLDES_BOATO.length;
  return { texto: MOLDES_BOATO[i].replace('{f}', l.texto), fato: l.texto, t: l.t, molde: i };
}

/** O mural do dia: até `n` boatos de fatos diferentes, tirados dos mais recentes, iguais para todo mundo no mesmo dia. */
export function muralDoDia(linhas: readonly Linha[], dia: string, n = 5): Boato[] {
  const r = rng(hashTexto(`mural|${dia}`));
  const vistos = new Set<string>();
  const pool = linhas.filter((l) => (vistos.has(l.texto) ? false : (vistos.add(l.texto), true))).slice(0, 20);
  const out: (Boato & { molde: number })[] = [];
  while (pool.length && out.length < n) out.push(boatoDe(pool.splice(Math.floor(r() * pool.length), 1)[0], r, out.length ? out[out.length - 1].molde : -1));
  // A moldura não se repete em seguida (na ordem em que o mural mostra, do mais novo ao mais velho).
  const lista = out.sort((a, b) => b.t - a.t);
  for (let k = 1; k < lista.length; k++)
    if (lista[k].molde === lista[k - 1].molde) {
      const i = (lista[k].molde + 1 + (k + 1 < lista.length && lista[k + 1].molde === (lista[k].molde + 1) % MOLDES_BOATO.length ? 1 : 0)) % MOLDES_BOATO.length;
      lista[k] = { ...lista[k], molde: i, texto: MOLDES_BOATO[i].replace('{f}', lista[k].fato) };
    }
  return lista.map(({ molde: _m, ...b }) => b);
}

/** "Enquanto você tava fora": até 3 fatos novos desde a última visita, do mais novo para o mais velho. */
export function resumoAusencia(linhas: readonly Linha[], desde: number, max = 3): string | null {
  const novos = linhas.filter((l) => l.t > desde).sort((a, b) => b.t - a.t);
  if (!novos.length) return null;
  const parte = novos.slice(0, max).map((l) => l.texto);
  const resto = novos.length - parte.length;
  return `${parte.join('; ')}${resto > 0 ? ` (e mais ${resto})` : ''}.`;
}
