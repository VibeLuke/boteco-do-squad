/**
 * Fatia 12: status, carga, aparar e receitas, em funções puras (o motor em `briga.ts` só chama).
 *
 * - Quatro status com prazo (`ate` em ms do mundo): queimando (dano por segundo), molhado (só prepara cruzamento),
 *   elétrico (trava curta ao pegar) e grudento (anda mais devagar).
 * - Cruzamento quando um status novo encontra outro ativo, numa tabela 4 × 4 simétrica:
 *   molhado + elétrico = choque em área; queimando + molhado = apaga; grudento + queimando = poça em chamas.
 * - Carga em dois níveis segurando o golpe; aparar numa janela curta antes do impacto, ao custo de um uso;
 *   receitas de dois itens no balcão, comutativas.
 */
import type { Arma } from './mapa';

export type Status = 'queimando' | 'molhado' | 'eletrico' | 'grudento';
export const STATUS: readonly Status[] = ['queimando', 'molhado', 'eletrico', 'grudento'];
export type Estados = Partial<Record<Status, number>>;

/** Quanto dura cada status a partir de quando pega (renova se pegar de novo). */
export const STATUS_MS: Record<Status, number> = { queimando: 3000, molhado: 6000, eletrico: 2000, grudento: 5000 };
export const QUEIMA_DANO_S = 6;
/** Grudento anda a 60% da velocidade. */
export const GRUDE_VEL = 0.6;
/** Elétrico trava o corpo um instante ao pegar. */
export const ELETRICO_TRAVA = 300;
export const CHOQUE = { raio: 1.6, dano: 10, atordoa: 1200 } as const;

export type Cruzamento = 'choque' | 'apaga' | 'chamas' | null;

/** A tabela inteira, escrita à mão (simétrica: a ordem de chegada não muda o resultado). */
export const TABELA: Record<Status, Record<Status, Cruzamento>> = {
  queimando: { queimando: null, molhado: 'apaga', eletrico: null, grudento: 'chamas' },
  molhado: { queimando: 'apaga', molhado: null, eletrico: 'choque', grudento: null },
  eletrico: { queimando: null, molhado: 'choque', eletrico: null, grudento: null },
  grudento: { queimando: 'chamas', molhado: null, eletrico: null, grudento: null },
};

export function ativos(st: Estados, t: number): Status[] {
  return STATUS.filter((s) => (st[s] ?? 0) > t);
}

/** Prioridade quando o novo cruza com mais de um ativo: o choque manda, depois as chamas, depois apagar. */
const ORDEM: Cruzamento[] = ['choque', 'chamas', 'apaga'];

/**
 * Pega o status `novo` em quem já tem `st`. Devolve os status depois e o cruzamento (se houve):
 * - apaga: o fogo some e o molhado também (vira vapor); se o novo era o fogo, ele nem pega;
 * - chamas: o grudento queima (sai) e o fogo pega mais longo; quem chamou põe a poça em chamas no chão;
 * - choque: os dois ficam (quem chamou atordoa a área e dá o dano).
 */
export function aplicar(st: Estados, novo: Status, t: number): { st: Estados; efeito: Cruzamento } {
  const antes = ativos(st, t);
  const cruz = antes.map((s) => TABELA[s][novo]);
  const efeito = ORDEM.find((c) => cruz.includes(c)) ?? null;
  const out: Estados = {};
  for (const s of antes) out[s] = st[s];
  if (efeito === 'apaga') {
    delete out.queimando;
    delete out.molhado;
    return { st: out, efeito };
  }
  out[novo] = Math.max(out[novo] ?? 0, t + STATUS_MS[novo] * (efeito === 'chamas' && novo === 'queimando' ? 1.5 : 1));
  if (efeito === 'chamas') {
    delete out.grudento;
    out.queimando = Math.max(out.queimando ?? 0, t + STATUS_MS.queimando * 1.5);
  }
  return { st: out, efeito };
}

/** Fator de velocidade pelos status (só o grudento mexe). */
export function velStatus(st: Estados, t: number): number {
  return (st.grudento ?? 0) > t ? GRUDE_VEL : 1;
}

/* ------------------------------------------------------------------ carga */

/** Segurou menos que isto: golpe normal. */
export const CARGA_1 = 350;
export const CARGA_2 = 800;
/** Solta sozinho depois disto (não dá para ficar plantado carregando para sempre). */
export const CARGA_MAX_MS = 1500;
/** Teto de congelamento do golpe carregado (o mesmo do nocaute). */
export const HITSTOP_CARGA_MAX = 160;

export type NivelCarga = 0 | 1 | 2;
export function nivelCarga(ms: number): NivelCarga {
  return ms >= CARGA_2 ? 2 : ms >= CARGA_1 ? 1 : 0;
}

/** O golpe com carga: mais dano e empurrão, sempre forte, congelamento maior mas com teto. */
export function golpeCarregado<G extends { dano: number; knock: number; forte: boolean; hitstop: number }>(g: G, n: NivelCarga): G {
  if (n === 0) return g;
  return {
    ...g,
    dano: Math.round(g.dano * (n === 2 ? 2.2 : 1.5)),
    knock: g.knock + (n === 2 ? 6 : 3),
    forte: true,
    hitstop: Math.min(HITSTOP_CARGA_MAX, g.hitstop + (n === 2 ? 60 : 30)),
  };
}

/* ------------------------------------------------------------------ aparar */

/** Apertou aparar até isto antes do impacto: aparou. */
export const APARA_MS = 150;
/** Depois de tentar, espera isto para tentar de novo (sem metralhar o botão). */
export const APARA_RECARGA = 700;
export const APARA_ATORDOA = 700;

/** `aparaEm` = quando apertou; `impacto` = quando o golpe do outro entra (o fim da preparação dele). */
export function aparou(aparaEm: number, impacto: number): boolean {
  const d = impacto - aparaEm;
  return d >= 0 && d <= APARA_MS;
}

/* ------------------------------------------------------------------ receitas */

export const RECEITAS: readonly { a: Arma; b: Arma; da: Arma; nome: string }[] = [
  { a: 'garrafa', b: 'pano', da: 'molotov', nome: 'Garrafa + Pano = Molotov de cachaça' },
  { a: 'taco', b: 'prego', da: 'tacoprego', nome: 'Taco + Prego = Taco com prego' },
  { a: 'extintor', b: 'garrafa', da: 'espuma', nome: 'Extintor + Garrafa = Jato de espuma' },
  { a: 'caco', b: 'fita', da: 'sococaco', nome: 'Caco + Fita = Soco de caco' },
];

/** O que sai de juntar `x` com `y` no balcão (a ordem não importa). */
export function receita(x: Arma, y: Arma): (typeof RECEITAS)[number] | null {
  return RECEITAS.find((r) => (r.a === x && r.b === y) || (r.a === y && r.b === x)) ?? null;
}

/** O status que cada arma deixa em quem apanha. */
export const STATUS_DA_ARMA: Partial<Record<Arma, Status>> = {
  garrafa: 'molhado', // cerveja na cara
  espuma: 'molhado',
  frigideira: 'grudento', // óleo da fritura
  raquete: 'eletrico',
  molotov: 'queimando',
};
