/**
 * Fatia 10: o diretor de eventos sem servidor. Tudo aqui é função pura da hora do servidor e de uma semente fixa:
 * todo aparelho calcula a mesma agenda, ninguém é "dono" do evento e quem entra no meio se junta.
 *
 * - Época de 10 min. Cada época sorteia evento com chance `p` (0,18 × multiplicador do dono), o tipo por peso entre os
 *   que valem naquela hora e o deslocamento de início dentro da época.
 * - Garantia sem estado: em cada bloco de 3 h (18 épocas) uma época sorteada tem evento forçado.
 * - Nunca dois seguidos: a época logo depois de uma época sorteada (ou ao lado da forçada) fica sem evento.
 * - Cada tipo tem o seu intervalo mínimo (o alienígena, quando entrar, 2 h).
 * - Vida e meta escalam com o número de jogadores; o prêmio cai pela metade na segunda vez do dia e o troféu só sai na
 *   primeira.
 */

export const EPOCA_MS = 10 * 60_000;
export const EPOCAS_POR_BLOCO = 18;
export const P_BASE = 0.18;
/** Sal da agenda (trocar muda a agenda de todo mundo de uma vez). */
export const SAL = 'boteco-agenda-1';

// Fatia 17: dragão e dinossauro entram no fim (a ordem conta no sorteio por peso).
export const TIPOS_EVENTO = ['ratazana', 'apagao', 'alien', 'dragao', 'dino'] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export interface DefEvento {
  nome: string;
  /** Duração depois do início (ms). */
  dura: number;
  /** Aviso antes do início (ms). */
  telegrafo: number;
  peso: number;
  /** Épocas mínimas entre dois do mesmo tipo (contadas pelo sorteio bruto, sem estado). */
  intervalo: number;
  /** Em que horas de Brasília pode acontecer (padrão: qualquer uma). */
  quando?: (h: number) => boolean;
  /** Troféu da primeira vez. */
  trofeu: string;
}

export const EVENTOS: Record<TipoEvento, DefEvento> = {
  ratazana: { nome: 'Ratazana gigante do banheiro', dura: 70_000, telegrafo: 25_000, peso: 3, intervalo: 3, trofeu: 'rabo' },
  apagao: { nome: 'Apagão', dura: 90_000, telegrafo: 20_000, peso: 2, intervalo: 6, trofeu: 'vela' },
  // Fatia 11: visita (60 s) e, se ele morrer, invasão (120 s). No máximo um a cada 2 h (12 épocas).
  alien: { nome: 'Visita do Alienígena', dura: 185_000, telegrafo: 45_000, peso: 4, intervalo: 12, trofeu: 'gorjeta' },
  // Fatia 17: o dragão só de noite (19 h às 5 h de Brasília); o dinossauro a qualquer hora.
  dragao: { nome: 'Dragão no telhado', dura: 120_000, telegrafo: 30_000, peso: 2, intervalo: 6, quando: (h) => h >= 19 || h < 5, trofeu: 'dente' },
  dino: { nome: 'Dinossauro fugido do circo', dura: 90_000, telegrafo: 25_000, peso: 2, intervalo: 6, trofeu: 'ovo' },
};

export interface ConfigEventos {
  /** 0 desliga, 0,5, 1, 2 ou 3 ("festival"). */
  mult: number;
  /** Forçar um tipo numa época (do dono, `bar/config/eventos`). */
  forcar?: Partial<Record<string, TipoEvento>>;
}

export const CONFIG_PADRAO: ConfigEventos = { mult: 1 };

/* ------------------------------------------------------------------ sorteio */

export function hashTexto(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32. */
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

export const epocaDe = (t: number) => Math.floor(t / EPOCA_MS);
export const horaDe = (t: number) => ((((t / 3_600_000 - 3) % 24) + 24) % 24);

/** A época forçada do bloco `b` (1 a 16 dentro do bloco: nunca na ponta, então duas forçadas nunca ficam lado a lado). */
export function forcadaDoBloco(b: number): number {
  return 1 + Math.floor(rng(hashTexto(`${SAL}|bloco|${b}`))() * (EPOCAS_POR_BLOCO - 2));
}

export function ehForcada(e: number): boolean {
  const b = Math.floor(e / EPOCAS_POR_BLOCO);
  return e - b * EPOCAS_POR_BLOCO === forcadaDoBloco(b);
}

/** Tipos que valem no início da época `e`. */
function elegiveis(e: number): TipoEvento[] {
  const h = horaDe(e * EPOCA_MS);
  return TIPOS_EVENTO.filter((k) => !EVENTOS[k].quando || EVENTOS[k].quando!(h));
}

function porPeso(tipos: TipoEvento[], x: number): TipoEvento | null {
  const total = tipos.reduce((s, k) => s + EVENTOS[k].peso, 0);
  if (!total) return null;
  let a = x * total;
  for (const k of tipos) {
    a -= EVENTOS[k].peso;
    if (a < 0) return k;
  }
  return tipos[tipos.length - 1];
}

/** Sorteio bruto da época (sem as regras de vizinhança): tipo e deslocamento, ou nada. */
export function sorteioBruto(e: number, cfg: ConfigEventos = CONFIG_PADRAO): { tipo: TipoEvento; x: number } | null {
  if (!(cfg.mult > 0)) return null;
  const r = rng(hashTexto(`${SAL}|${e}`));
  const sorte = r();
  const qual = r();
  const x = r();
  const forcado = cfg.forcar?.[String(e)];
  if (forcado && TIPOS_EVENTO.includes(forcado)) return { tipo: forcado, x };
  const tipos = elegiveis(e);
  if (ehForcada(e)) {
    const t = porPeso(tipos, qual);
    return t ? { tipo: t, x } : null;
  }
  if (sorte >= P_BASE * cfg.mult) return null;
  const t = porPeso(tipos, qual);
  return t ? { tipo: t, x } : null;
}

export interface Agendado {
  tipo: TipoEvento;
  epoca: number;
  /** Começo do aviso, início e fim (ms, hora do servidor). */
  aviso: number;
  inicio: number;
  fim: number;
  /** Semente do evento (rota, alvos), igual em todo aparelho. */
  semente: number;
}

/**
 * O evento da época `e`, se houver. A forçada (do bloco ou do dono) sempre acontece; uma sorteada só acontece se a
 * época anterior não sorteou nada, se nenhuma vizinha é forçada e se o mesmo tipo não saiu nas últimas `intervalo`
 * épocas. Cabe inteiro dentro da época (aviso + duração).
 */
export function agenda(e: number, cfg: ConfigEventos = CONFIG_PADRAO): Agendado | null {
  const s = sorteioBruto(e, cfg);
  if (!s) return null;
  const forcada = ehForcada(e) || !!cfg.forcar?.[String(e)];
  if (!forcada) {
    if (sorteioBruto(e - 1, cfg)) return null;
    if (ehForcada(e - 1) || ehForcada(e + 1)) return null;
    for (let k = 1; k <= EVENTOS[s.tipo].intervalo; k++) if (sorteioBruto(e - k, cfg)?.tipo === s.tipo) return null;
  }
  const def = EVENTOS[s.tipo];
  const folga = Math.max(0, EPOCA_MS - def.telegrafo - def.dura);
  const aviso = e * EPOCA_MS + Math.floor(s.x * folga);
  return { tipo: s.tipo, epoca: e, aviso, inicio: aviso + def.telegrafo, fim: aviso + def.telegrafo + def.dura, semente: hashTexto(`${SAL}|ev|${e}`) };
}

/** O evento em andamento (ou no aviso) na hora `t`, se houver. */
export function eventoEm(t: number, cfg: ConfigEventos = CONFIG_PADRAO): Agendado | null {
  const a = agenda(epocaDe(t), cfg);
  return a && t >= a.aviso && t < a.fim ? a : null;
}

/** Fase do evento na hora `t`: aviso, andamento ou fora. */
export function faseEvento(a: Agendado, t: number): 'aviso' | 'andamento' | 'fora' {
  if (t < a.aviso || t >= a.fim) return 'fora';
  return t < a.inicio ? 'aviso' : 'andamento';
}

/** Lê a chave do dono (`bar/config/eventos`) sem confiar no que veio: lixo vira o padrão. */
export function sanitizeConfig(raw: unknown): ConfigEventos {
  if (!raw || typeof raw !== 'object') return CONFIG_PADRAO;
  const o = raw as Record<string, unknown>;
  const mult = typeof o.mult === 'number' && Number.isFinite(o.mult) ? Math.max(0, Math.min(3, o.mult)) : 1;
  const forcar: Partial<Record<string, TipoEvento>> = {};
  if (o.forcar && typeof o.forcar === 'object')
    for (const [k, v] of Object.entries(o.forcar as Record<string, unknown>))
      if (/^[0-9]{1,9}$/.test(k) && typeof v === 'string' && (TIPOS_EVENTO as readonly string[]).includes(v)) forcar[k] = v as TipoEvento;
  return Object.keys(forcar).length ? { mult, forcar } : { mult };
}

/* ------------------------------------------------------------------ escala, livro de dano e prêmio */

/** Vida escalada pelos jogadores presentes na abertura: base · (1 + 0,5 · (n − 1)). */
export function vidaEscalada(base: number, n: number): number {
  const k = Math.max(1, Math.min(5, Math.floor(n) || 1));
  return Math.round(base * (1 + 0.5 * (k - 1)));
}

/** Soma de um livro de dano (`{jogador: total}`), ignorando lixo e negativos. */
export function somaLivro(livro: unknown): number {
  if (!livro || typeof livro !== 'object') return 0;
  let s = 0;
  for (const v of Object.values(livro as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v) && v > 0) s += Math.min(v, 100_000);
  return s;
}

/** Quanto falta (0 = morreu). Comutativo: a ordem de chegada das gravações não muda o desfecho. */
export function vidaRestante(H: number, livro: unknown): number {
  return Math.max(0, H - somaLivro(livro));
}

/** Prêmio pela vez do dia: cheio na primeira, metade na segunda em diante (arredondado). */
export function premio(base: number, vezesHoje: number): number {
  return vezesHoje <= 0 ? base : Math.round(base / 2);
}

/* ------------------------------------------------------------------ a ratazana (rota pela semente) */

export type Ponto = readonly [number, number];

/** Um trecho da rota: anda de `de` até `para` entre `t0` e `t1` (ms desde o início), ou fica parado roubando. */
export interface Trecho {
  de: Ponto;
  para: Ponto;
  t0: number;
  t1: number;
  rouba: boolean;
}

/** Ladrilhos por segundo (mais rápida que um bêbado, mais lenta que quem corre atrás). */
export const RATO_VEL = 2.4;
/** Quanto fica parada em cada comida (a janela para bater nela). */
export const RATO_PAUSA = 3500;
export const RATO_VIDA = 150;
export const RATO_RAIO = 0.45;

/**
 * Rota da ratazana: sai da porta do banheiro, passa por comidas sorteadas pela semente (para em cada uma roubando) e
 * volta para a porta antes do fim. Igual em todo aparelho.
 */
export function rotaRato(semente: number, porta: Ponto, comidas: readonly Ponto[], dura: number): Trecho[] {
  const r = rng(semente);
  // Até 3 voltas pelas comidas (embaralhadas a cada volta), enquanto o tempo deixa.
  const ordem: Ponto[] = [];
  for (let v = 0; v < 3; v++) ordem.push(...comidas.map((c) => ({ c, k: r() })).sort((a, b) => a.k - b.k).map((o) => o.c));
  const ms = (a: Ponto, b: Ponto) => (Math.hypot(b[0] - a[0], b[1] - a[1]) / RATO_VEL) * 1000;
  const out: Trecho[] = [];
  let aqui = porta;
  let t = 0;
  for (const c of ordem) {
    const ida = ms(aqui, c);
    // Só vai se ainda dá para roubar e voltar para a porta antes do fim.
    if (t + ida + RATO_PAUSA + ms(c, porta) > dura) break;
    out.push({ de: aqui, para: c, t0: t, t1: t + ida, rouba: false });
    t += ida;
    out.push({ de: c, para: c, t0: t, t1: t + RATO_PAUSA, rouba: true });
    t += RATO_PAUSA;
    aqui = c;
  }
  out.push({ de: aqui, para: porta, t0: t, t1: t + ms(aqui, porta), rouba: false });
  return out;
}

/** Onde está a ratazana `dt` ms depois do início; `fora` = já voltou para o cano (ou ainda não saiu). */
export function posRato(rota: readonly Trecho[], dt: number): { x: number; y: number; fx: number; fy: number; rouba: boolean; fora: boolean } {
  const ult = rota[rota.length - 1];
  if (!(dt >= 0) || dt >= ult.t1) return { x: ult.para[0], y: ult.para[1], fx: -1, fy: 0, rouba: false, fora: true };
  const tr = rota.find((p) => dt < p.t1) ?? ult;
  const k = tr.t1 > tr.t0 ? (dt - tr.t0) / (tr.t1 - tr.t0) : 1;
  const dx = tr.para[0] - tr.de[0];
  const dy = tr.para[1] - tr.de[1];
  const n = Math.hypot(dx, dy) || 1;
  return { x: tr.de[0] + dx * k, y: tr.de[1] + dy * k, fx: dx / n || 1, fy: dy / n, rouba: tr.rouba, fora: false };
}

/** Quantas comidas a ratazana já levou até `dt` (paradas que terminaram). */
export function roubosAte(rota: readonly Trecho[], dt: number): number {
  return rota.filter((p) => p.rouba && dt >= p.t1).length;
}
