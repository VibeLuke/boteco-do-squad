/**
 * Interação entre jogadores (Fatia 15), em funções puras: o visual do amigo que dorme no canto, a pegadinha em quem
 * está desmaiado (o bigode de caneta virou uma escada de 6 zoeiras), reviver quem caiu ficando parado do lado, o
 * brinde de dois amigos perto um do outro, e o livro do bar (os últimos ~20 acontecimentos, montado só com o que o
 * banco já guarda: ninguém grava nada a mais para o livro existir).
 *
 * Tudo vale para cinco amigos e funciona sem os cinco online: o que precisa viajar vai pelos nós que já existem
 * (`marks` para a pegadinha, `fx` para brinde e reviver).
 */
import { IDS, NOME_DE } from '../turma/index';

export const JOGADORES = IDS;
export type Jogador = (typeof JOGADORES)[number];
const ehJogador = (v: unknown): v is Jogador => typeof v === 'string' && (JOGADORES as readonly string[]).includes(v);
export const NOME: Record<Jogador, string> = NOME_DE;

/* ------------------------------------------------------------------ visual do amigo offline */

/** O último código de visual que o amigo gravou (fica no banco com `on: false` quando ele sai). */
export function lkDoAmigo(vivoRaw: unknown, id: string): string | null {
  const e = vivoRaw && typeof vivoRaw === 'object' ? (vivoRaw as Record<string, unknown>)[id] : null;
  const lk = e && typeof e === 'object' ? (e as Record<string, unknown>).lk : null;
  return typeof lk === 'string' && /^[0-9a-z-]{8,16}$/.test(lk) ? lk : null;
}

/* ------------------------------------------------------------------ pegadinha */

/** Cada aperto de E no amigo desmaiado sobe um degrau (o banco guarda só o número, de 0 a 6). */
export const PEGADINHAS = ['bigode', 'monocelha', 'um X na bochecha', 'um bilhete no peito', 'a placa "chuta aqui"', 'o jornal na cara'] as const;
export const PEGADINHA_MAX = PEGADINHAS.length;
/** Degraus por dia que cada um pode subir em cada amigo (no aparelho de quem zoa). */
export const PEGADINHAS_DIA = 6;

/** "bigode, monocelha e um bilhete no peito" (o que tem na cara de quem dormiu com `n` degraus). */
export function textoPegadinha(n: number): string {
  const k = Math.max(0, Math.min(PEGADINHA_MAX, Math.floor(n)));
  const l = PEGADINHAS.slice(0, k);
  if (l.length <= 1) return l.join('');
  return `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`;
}

/** Ainda dá para zoar hoje? `feitas` = degraus que você já subiu nesse amigo hoje. */
export const podeZoar = (n: number, feitas: number) => n < PEGADINHA_MAX && feitas < PEGADINHAS_DIA;

/* ------------------------------------------------------------------ reviver */

/** Ficar parado do lado de quem caiu por 2 s levanta (amigo online ou NPC). */
export const REVIVE_MS = 2000;
export const REVIVE_RAIO = 1.1;
/** Depois de levantar um amigo online, espera isso antes de mandar de novo (o aparelho dele é quem levanta). */
export const REVIVE_DE_NOVO_MS = 8000;

export interface Reviver {
  alvo: string | null;
  /** Ms acumulados parado do lado do mesmo alvo. */
  ms: number;
}
export const REVIVER_ZERO: Reviver = { alvo: null, ms: 0 };

/**
 * Um quadro do reviver: `caidos` são os candidatos (id e posição), `eu` a sua posição, `parado` se você não está
 * andando nem batendo. Devolve o estado novo e, quando completa os 2 s, quem levantar (uma vez).
 */
export function passoReviver(r: Reviver, eu: { x: number; y: number }, caidos: readonly { id: string; x: number; y: number }[], parado: boolean, dtMs: number): { r: Reviver; levanta: string | null } {
  let perto: { id: string; d: number } | null = null;
  for (const c of caidos) {
    const d = Math.hypot(c.x - eu.x, c.y - eu.y);
    if (d <= REVIVE_RAIO && (!perto || d < perto.d)) perto = { id: c.id, d };
  }
  if (!parado || !perto) return { r: REVIVER_ZERO, levanta: null };
  const ms = (r.alvo === perto.id ? r.ms : 0) + dtMs;
  if (ms >= REVIVE_MS) return { r: REVIVER_ZERO, levanta: perto.id };
  return { r: { alvo: perto.id, ms }, levanta: null };
}

/* ------------------------------------------------------------------ brinde */

/** Dois amigos levantam o copo com até 2 s de diferença e a no máximo 1,5 ladrilho: brindaram. */
export const BRINDE_JANELA_MS = 2000;
export const BRINDE_RAIO = 1.5;
export const BRINDE_BONUS = 3;
/** Brindes que pagam por dia (depois disso só a fagulha e o registro no livro). */
export const BRINDES_DIA = 5;
/** Quanto tempo o copo fica levantado na cabeça de quem brindou. */
export const COPO_MS = 1500;

export const brindaram = (a: { t: number; x: number; y: number }, b: { t: number; x: number; y: number }) =>
  Math.abs(a.t - b.t) <= BRINDE_JANELA_MS && Math.hypot(a.x - b.x, a.y - b.y) <= BRINDE_RAIO;

/* ------------------------------------------------------------------ fx (o canal dos dois) */

export interface Fx {
  p: Jogador;
  k: string;
  to: Jogador | '';
  t: number;
}

/** Os `fx` do bar (brinde e reviver; o resto é do bar antigo), em ordem de tempo. */
export function fxDoBar(raw: unknown, tipos: readonly string[] = ['brinde', 'reviver']): Fx[] {
  const out: Fx[] = [];
  if (!raw || typeof raw !== 'object') return out;
  for (const [p, slots] of Object.entries(raw as Record<string, unknown>)) {
    if (!ehJogador(p) || !slots || typeof slots !== 'object') continue;
    for (const v of Object.values(slots as Record<string, unknown>)) {
      const e = v as Record<string, unknown> | null;
      if (!e || typeof e.k !== 'string' || !tipos.includes(e.k) || typeof e.t !== 'number') continue;
      out.push({ p, k: e.k, to: ehJogador(e.to) ? e.to : '', t: e.t });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/* ------------------------------------------------------------------ livro do bar */

export const TROFEU_NOME: Record<string, string> = {
  rabo: 'Rabo de Rato',
  vela: 'Vela de Aniversário',
  gorjeta: 'Gorjeta Cósmica',
  antena: 'Antena de Disco',
  sumiuze: 'Cartaz "Sumiu o Zé"',
  dente: 'Dente de Dragão',
  ovo: 'Ovo de Dinossauro',
};
const PORTAL_NOME: Record<string, string> = { moscas: 'Moscaria', quermesse: 'Quermesse Maluca', churrasco: 'Churrasco Jurássico' };

export interface Linha {
  t: number;
  ic: string;
  texto: string;
}

/**
 * O livro: tudo que tem dono e hora no banco vira uma linha (nocautes, troféus, fim de evento, pegadinha, recorde de
 * portal, brinde, quem levantou quem), da mais nova para a mais velha, no máximo `max`. O brinde é gravado pelos dois
 * aparelhos: duas linhas do mesmo par a menos de 10 s viram uma; o mesmo reviver repetido em 30 s, também.
 */
export function livroDoBar(bar: unknown, max = 20): Linha[] {
  const b = (bar && typeof bar === 'object' ? bar : {}) as Record<string, unknown>;
  const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
  const out: Linha[] = [];
  for (const [quem, vitimas] of Object.entries(obj(b.kills)))
    for (const [vit, v] of Object.entries(obj(vitimas))) {
      const e = obj(v);
      if (!ehJogador(quem) || !ehJogador(vit) || typeof e.t !== 'number' || typeof e.n !== 'number' || e.n < 1) continue;
      out.push({ t: e.t, ic: '💥', texto: `${NOME[quem]} nocauteou ${NOME[vit]}${e.n > 1 ? ` (${e.n}× no dia)` : ''}` });
    }
  for (const [tr, donos] of Object.entries(obj(b.trofeus)))
    for (const [quem, t] of Object.entries(obj(donos)))
      if (ehJogador(quem) && typeof t === 'number' && TROFEU_NOME[tr]) out.push({ t, ic: '🏆', texto: `${NOME[quem]} ganhou o troféu ${TROFEU_NOME[tr]}` });
  for (const ev of Object.values(obj(b.evento))) {
    const f = obj(obj(ev).fim);
    if (!ehJogador(f.p) || typeof f.at !== 'number') continue;
    out.push({ t: f.at, ic: f.como === 'religado' ? '💡' : '⚔️', texto: f.como === 'religado' ? `${NOME[f.p]} religou a luz do bar` : `${NOME[f.p]} derrubou o bicho do evento` });
  }
  for (const [alvo, v] of Object.entries(obj(b.marks))) {
    const e = obj(v);
    if (!ehJogador(alvo) || !ehJogador(e.by) || typeof e.t !== 'number' || typeof e.n !== 'number' || e.n < 1) continue;
    out.push({ t: e.t, ic: '🖊️', texto: `${NOME[e.by]} zoou ${NOME[alvo]} dormindo: ${textoPegadinha(e.n)}` });
  }
  for (const [portal, jogs] of Object.entries(obj(b.portais)))
    for (const [quem, v] of Object.entries(obj(jogs))) {
      const e = obj(v);
      if (!ehJogador(quem) || typeof e.t !== 'number' || typeof e.s !== 'number' || !PORTAL_NOME[portal]) continue;
      out.push({ t: e.t, ic: '🌀', texto: `${NOME[quem]} fez ${e.s} pontos na ${PORTAL_NOME[portal]}` });
    }
  const pares: { a: string; t: number }[] = [];
  for (const f of fxDoBar(b.fx)) {
    if (!f.to) continue;
    if (f.k === 'reviver') {
      // Quem levanta o mesmo amigo de novo em menos de 30 s (ele demorou a levantar) vira uma linha só.
      const par = `${f.p}>${f.to}`;
      if (pares.some((x) => x.a === par && Math.abs(x.t - f.t) < 30_000)) continue;
      pares.push({ a: par, t: f.t });
      out.push({ t: f.t, ic: '🙌', texto: `${NOME[f.p]} levantou ${NOME[f.to]} do chão` });
    }
    if (f.k === 'brinde') {
      const par = [f.p, f.to].sort().join('+');
      if (pares.some((x) => x.a === par && Math.abs(x.t - f.t) < 10_000)) continue;
      pares.push({ a: par, t: f.t });
      out.push({ t: f.t, ic: '🍻', texto: `${NOME[f.p]} e ${NOME[f.to]} brindaram` });
    }
  }
  return out.sort((a, b) => b.t - a.t).slice(0, max);
}

/** "agora", "há 5 min", "há 2 h", "há 3 dias". */
export function haQuanto(t: number, agora: number): string {
  const s = Math.max(0, Math.round((agora - t) / 1000));
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}
