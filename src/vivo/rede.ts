/**
 * Fatia 3: o Bar Vivo ao vivo, sem servidor de jogo. Tudo aqui é puro (sem DOM nem rede): o que mandar, como ler o
 * que chegou e como pôr os amigos online no seu mundo. A loja (`bar/presence.ts`) grava e escuta; a tela só liga
 * as duas pontas.
 *
 * bar/vivo/{p}          = você: posição, olhar, para onde anda, estado, vida, roupa, quem te nocauteou, hora, on.
 * bar/vgolpe/{p}/{0..9} = seus golpes em amigos (quem bate decide; o aparelho do alvo aplica em si).
 */
import { isPlayerId, type PlayerId } from '../arena/sprites';
import {
  ARMAS,
  VEL_EU,
  achar,
  deslizar,
  entrarRemoto,
  eu,
  golpeNoNpc,
  quebrar,
  rajadaDeFora,
  poderDeFora,
  receberGolpe,
  sairRemoto,
  soltarMarionete,
  type Evento,
  type Mundo,
  type Corpo,
} from './briga';
import { CANTOS, PROPS, QUEBRAVEIS, type AmigoId, type Arma } from './mapa';
import { frase } from './frases';
import { ehPoder, type Poder } from './poderes';
import { IDS, NOME_DE } from '../turma/index';

export type Cod = 'n' | 'k' | 's' | 'v';

export interface EstadoVivo {
  x: number;
  y: number;
  fx: number;
  fy: number;
  mx: number;
  my: number;
  e: Cod;
  vi: number;
  lk: string;
  /** 1 = armando um golpe (quem apanha vê a antecipação). */
  a?: 1;
  /** Fatia 5: o item na mão (os amigos veem o item e o golpe dele). */
  w?: Arma;
  /** Fatia 5: hora (do servidor) em que o seu poder disparou; vai só nos 3 s seguintes. */
  r?: number;
  /** Fatia 6: qual poder disparou na hora `r` (sem `q` = a Rajada do Fiado, como na Fatia 5). */
  q?: Poder;
  por?: PlayerId;
  at: number;
  on: boolean;
}
export type MeuEstado = Omit<EstadoVivo, 'at' | 'on'>;

/** Online = `on` e algum envio nos últimos 25 s (parado manda a cada 10 s). */
export const ONLINE_MS = 25_000;
export const MIN_ENVIO_MS = 120;
export const CORRECAO_MS = 1_000;
export const BATIMENTO_MS = 10_000;
/** Entre um envio e outro o amigo anda sozinho na sua tela por até 1,6 s (a correção vem a cada 1 s andando, + atraso). */
export const PREVER_MS = 1_600;
/** Golpe com mais de 5 s não vale (chegou atrasado ou veio no retrato inteiro de uma reconexão). */
export const IDADE_GOLPE_MS = 5_000;
export const GOLPE_SLOTS = 10;
/** Relógio: acima disso o mundo salta para a hora do servidor; abaixo, é puxado devagar. */
export const SALTO_RELOGIO_MS = 3_000;
export const ARMAS_REDE = ['soco', 'empurrao', ...Object.keys(ARMAS)] as const;

const num = (v: unknown, a: number, b: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function sanitizeVivo(raw: unknown): Partial<Record<PlayerId, EstadoVivo>> {
  const out: Partial<Record<PlayerId, EstadoVivo>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [pid, v] of Object.entries(raw as Record<string, unknown>)) {
    const e = v as Partial<EstadoVivo> | null;
    if (!isPlayerId(pid) || !e || typeof e !== 'object') continue;
    if (!num(e.x, 0, 63) || !num(e.y, 0, 63) || !num(e.fx, -1, 1) || !num(e.fy, -1, 1) || !num(e.mx, -1, 1) || !num(e.my, -1, 1)) continue;
    if (!['n', 'k', 's', 'v'].includes(e.e as string) || !num(e.vi, 0, 100) || typeof e.lk !== 'string' || !/^[0-9a-z-]{8,16}$/.test(e.lk)) continue;
    if (typeof e.at !== 'number' || typeof e.on !== 'boolean') continue;
    out[pid] = { x: e.x, y: e.y, fx: e.fx, fy: e.fy, mx: e.mx, my: e.my, e: e.e as Cod, vi: e.vi, lk: e.lk, at: e.at, on: e.on, ...(e.a === 1 ? { a: 1 as const } : {}), ...(isPlayerId(e.por) ? { por: e.por } : {}), ...(ehArma(e.w) ? { w: e.w } : {}), ...(num(e.r, 0, 1e14) ? { r: e.r } : {}), ...(ehPoder(e.q) ? { q: e.q } : {}) };
  }
  return out;
}

const ehArma = (w: unknown): w is Arma => typeof w === 'string' && Object.prototype.hasOwnProperty.call(ARMAS, w);

export const online = (e: EstadoVivo | undefined, agora: number): e is EstadoVivo => !!e && e.on && agora - e.at < ONLINE_MS;

/** Direção de andar em 8 sentidos (ou parado): só muda o envio quando muda de verdade. */
export function direcao8(mx: number, my: number): { mx: number; my: number } {
  if (Math.hypot(mx, my) < 0.1) return { mx: 0, my: 0 };
  const a = Math.round(Math.atan2(my, mx) / (Math.PI / 4)) * (Math.PI / 4);
  return { mx: r2(Math.cos(a)) + 0, my: r2(Math.sin(a)) + 0 };
}

export function codDe(c: Corpo): Cod {
  if (c.estado === 'ko') return 'k';
  if (c.estado === 'segurado') return 's';
  if (c.estado === 'voando') return 'v';
  return 'n';
}

/** O que você manda agora (andando só conta se está mesmo andando e de pé). */
export function meuEstado(c: Corpo, dir: { mx: number; my: number }, lk: string, por?: PlayerId, r?: number, q?: Poder): MeuEstado {
  const e = codDe(c);
  const d = e === 'n' && c.andando ? direcao8(dir.mx, dir.my) : { mx: 0, my: 0 };
  return {
    x: r2(Math.max(0, Math.min(63, c.x))),
    y: r2(Math.max(0, Math.min(63, c.y))),
    fx: r2(Math.max(-1, Math.min(1, c.fx))),
    fy: r2(Math.max(-1, Math.min(1, c.fy))),
    ...d,
    e,
    vi: Math.round(Math.max(0, Math.min(100, c.vida))),
    lk,
    ...(e === 'n' && c.fase === 'antes' ? { a: 1 as const } : {}),
    ...(c.arma ? { w: c.arma.tipo } : {}),
    ...(r !== undefined ? { r: Math.round(r) } : {}),
    ...(r !== undefined && q && q !== 'rajada' ? { q } : {}),
    ...(e === 'k' && por ? { por } : {}),
  };
}

/** Manda agora? Na mudança de direção, estado, vida (5+), roupa ou de quem te derrubou; correção andando; batimento parado. */
export function deveEnviar(ant: { s: MeuEstado; em: number } | null, s: MeuEstado, agora: number): boolean {
  if (!ant) return true;
  const dt = agora - ant.em;
  if (dt < MIN_ENVIO_MS) return false;
  const a = ant.s;
  if (s.e !== a.e || s.mx !== a.mx || s.my !== a.my || s.lk !== a.lk || s.a !== a.a || s.w !== a.w || s.r !== a.r || s.q !== a.q || s.por !== a.por || Math.abs(s.vi - a.vi) >= 5) return true;
  const andando = s.mx !== 0 || s.my !== 0;
  if (andando && dt >= CORRECAO_MS) return true;
  // Parado mas deslocado (empurrão, arrastado): corrige.
  if (!andando && Math.hypot(s.x - a.x, s.y - a.y) > 0.3) return true;
  return dt >= BATIMENTO_MS;
}

/** Onde o amigo deve estar agora: a última posição mais o que andou desde então (até 1 s), parando nas paredes. */
export function prever(e: EstadoVivo, agora: number): { x: number; y: number; andando: boolean } {
  if (e.e !== 'n' || (!e.mx && !e.my)) return { x: e.x, y: e.y, andando: false };
  const ms = Math.max(0, Math.min(PREVER_MS, agora - e.at));
  let p = { x: e.x, y: e.y };
  const passos = Math.ceil(ms / 50);
  const k = (VEL_EU * ms) / 1000 / Math.max(1, passos);
  for (let i = 0; i < passos; i++) p = deslizar(p.x, p.y, e.mx * k, e.my * k);
  return { ...p, andando: ms < PREVER_MS };
}

/** Puxa o corpo mostrado para a posição prevista (salta se estiver longe demais, ex. atravessou a porta). */
export function suavizar(c: { x: number; y: number }, alvo: { x: number; y: number }, dt: number) {
  const d = Math.hypot(alvo.x - c.x, alvo.y - c.y);
  if (d > 2.5) {
    c.x = alvo.x;
    c.y = alvo.y;
    return;
  }
  const k = 1 - Math.exp(-12 * dt);
  c.x += (alvo.x - c.x) * k;
  c.y += (alvo.y - c.y) * k;
}

/**
 * Quanto o mundo anda neste quadro (ms) para seguir a hora do servidor: salta se a diferença passar de 3 s; senão
 * corre até 50 % mais rápido ou mais devagar até alcançar (nunca volta no tempo).
 */
export function passoRelogio(dtMs: number, tMundo: number, tServidor: number): number {
  const dif = tServidor - (tMundo + dtMs);
  if (dif > SALTO_RELOGIO_MS) return dtMs + dif;
  const ajuste = Math.max(-0.5 * dtMs, Math.min(0.5 * dtMs, dif * 0.1));
  return dtMs + ajuste;
}

/**
 * Começo da sessão: o mundo nasceu na hora do aparelho. Espera a 1ª medida da hora do servidor (no máximo 1,5 s) e,
 * se o aparelho estava adiantado ou atrasado mais de 1 s, refaz o mundo na hora certa (adiantado, o ajuste fino
 * deixaria tudo em câmera lenta por segundos).
 */
export function decidirRelogio(relogioOk: boolean, desdeMs: number, srv: number, tMundo: number): 'esperar' | 'manter' | 'refazer' {
  if (!relogioOk && desdeMs < 1500) return 'esperar';
  return Math.abs(srv - tMundo) > 1000 ? 'refazer' : 'manter';
}

/* ------------------------------------------------------------------ golpes entre amigos */

export interface VGolpe {
  de: PlayerId;
  slot: number;
  to: string;
  d: number;
  kx: number;
  ky: number;
  w: string;
  f: boolean;
  t: number;
}
export type VGolpeEnvio = Omit<VGolpe, 'de' | 'slot' | 't'>;

export function sanitizeVGolpes(raw: unknown): VGolpe[] {
  const out: VGolpe[] = [];
  if (!raw || typeof raw !== 'object') return out;
  for (const [de, fila] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPlayerId(de) || !fila || typeof fila !== 'object') continue;
    for (const [k, v] of Object.entries(fila as Record<string, unknown>)) {
      const g = v as Partial<VGolpe> | null;
      const slot = Number(k);
      if (!Number.isInteger(slot) || slot < 0 || slot >= GOLPE_SLOTS || !g || typeof g !== 'object') continue;
      if (typeof g.to !== 'string' || !/^[a-z0-9]{2,16}$/.test(g.to) || g.to === de) continue;
      if (!num(g.d, 1, ehPoder(g.w) ? 100 : 40) || !num(g.kx, -1, 1) || !num(g.ky, -1, 1) || typeof g.f !== 'boolean' || typeof g.t !== 'number') continue;
      if (typeof g.w !== 'string' || !(ARMAS_REDE as readonly string[]).includes(g.w)) continue;
      out.push({ de, slot, to: g.to, d: g.d, kx: g.kx, ky: g.ky, w: g.w, f: g.f, t: g.t });
    }
  }
  return out;
}

export const chaveGolpe = (g: VGolpe) => `${g.de}/${g.slot}/${g.t}`;

/** O golpe que vai pela rede a partir do evento do motor. */
export function golpeDoEvento(e: Extract<Evento, { k: 'acerto' }>): VGolpeEnvio {
  return {
    to: e.em,
    d: Math.max(1, Math.min(40, Math.round(e.dano))),
    kx: r2(Math.max(-1, Math.min(1, e.kx))),
    ky: r2(Math.max(-1, Math.min(1, e.ky))),
    w: e.arma ?? (e.forte ? 'empurrao' : 'soco'),
    f: e.forte,
  };
}

/* ------------------------------------------------------------------ o elo: rede ↔ mundo */

/**
 * Liga o que chegou da rede ao seu mundo, quadro a quadro: amigos entram e saem, andam (previstos e suavizados),
 * caem; golpes neles chegam em você. E decide o que você manda.
 */
/**
 * O golpe do amigo na sua tela (Fatia 5): o item na mão dele, a preparação enquanto `a` = 1, o follow-through quando
 * `a` cai e, na Rajada do Fiado, a carga (com som) e o feixe quando chega uma hora de disparo nova.
 */
export function lerGolpeRemoto(m: Mundo, corpo: Corpo, e: EstadoVivo, antes: EstadoVivo | undefined) {
  corpo.arma = e.w ? { tipo: e.w, usos: 1 } : null;
  const g = e.w ? ARMAS[e.w] : null;
  if (e.a && corpo.estado === 'normal') {
    if (corpo.fase !== 'antes') {
      corpo.fase = 'antes';
      corpo.golpe = g;
      corpo.faseAte = m.t + (g?.antecipa ?? 100);
      if (ehPoder(e.w)) m.eventos.push({ k: 'carga', em: corpo.id, x: corpo.x, y: corpo.y, tipo: e.w });
    }
  } else if (corpo.fase === 'antes' && corpo.estado === 'normal' && g) {
    corpo.fase = 'depois';
    corpo.faseAte = m.t + g.recupera;
  } else if (corpo.fase !== 'depois' || m.t >= corpo.faseAte || corpo.estado !== 'normal') {
    corpo.fase = 'nada';
    corpo.golpe = null;
  }
  if (e.r && e.r !== antes?.r && Math.abs(m.t - e.r) < 2500) {
    const q = e.q ?? 'rajada';
    if (q === 'rajada') rajadaDeFora(m, corpo.id, corpo.x, corpo.y, e.fx, e.fy, e.r);
    else poderDeFora(m, corpo.id, q, corpo.x, corpo.y, e.fx, e.fy, e.r);
    corpo.golpe = ARMAS[q];
    corpo.fase = 'depois';
    corpo.faseAte = e.r + ARMAS[q].recupera;
  }
}

export class Elo {
  private vistos = new Set<string>();
  private retrato = -1;
  private ant: { s: MeuEstado; em: number } | null = null;
  private estados = new Map<PlayerId, EstadoVivo>();
  /** Quem te derrubou (para mandar junto e o outro contar o nocaute). */
  private porMim: PlayerId | null = null;

  readonly me: AmigoId;

  constructor(me: AmigoId) {
    this.me = me;
  }

  /** Lê a rede. `retrato` muda a cada retrato inteiro (conexão e reconexão): o que veio nele conta como já visto. */
  receber(m: Mundo, vivo: Partial<Record<PlayerId, EstadoVivo>>, golpes: VGolpe[], retrato: number, agora: number, dt: number) {
    if (retrato !== this.retrato) {
      this.retrato = retrato;
      for (const g of golpes) this.vistos.add(chaveGolpe(g));
    }
    for (const id of Object.keys(CANTOS) as AmigoId[]) {
      if (id === this.me) continue;
      const e = vivo[id];
      const corpo = achar(m, `amigo:${id}`);
      if (!corpo) continue;
      if (!online(e, agora)) {
        if (corpo.quem === 'remoto') {
          sairRemoto(m, id);
          m.eventos.push({ k: 'aviso', texto: `${nomeDe(id)} saiu do bar (voltou a dormir no canto).` });
        }
        this.estados.delete(id);
        continue;
      }
      const antes = this.estados.get(id);
      if (corpo.quem !== 'remoto') {
        entrarRemoto(m, id);
        corpo.x = e.x;
        corpo.y = e.y;
        m.eventos.push({ k: 'aviso', texto: `${nomeDe(id)} entrou no bar!` });
      }
      const alvo = prever(e, agora);
      suavizar(corpo, alvo, dt);
      corpo.fx = e.fx;
      corpo.fy = e.fy;
      corpo.andando = alvo.andando;
      corpo.vida = e.vi;
      corpo.estado = e.e === 'k' || e.e === 's' ? 'ko' : e.e === 'v' ? 'voando' : 'normal';
      lerGolpeRemoto(m, corpo, e, antes);
      // Você derrubou ele (na hora em que ele cai, não em toda leitura).
      if (antes && antes.e !== 'k' && e.e === 'k' && e.por === this.me) {
        m.nocautes++;
        m.eventos.push({ k: 'ko', x: corpo.x, y: corpo.y, em: corpo.id, de: 'eu' });
        m.eventos.push({ k: 'frase', x: corpo.x, y: corpo.y, texto: frase('ko', Math.random()), cor: '#e43b44' });
      }
      this.estados.set(id, e);
    }
    // Golpes novos.
    const me = eu(m);
    for (const g of golpes) {
      const k = chaveGolpe(g);
      if (this.vistos.has(k)) continue;
      this.vistos.add(k);
      if (g.de === this.me || agora - g.t > IDADE_GOLPE_MS) continue;
      if (g.to === this.me) {
        const caiu = me.estado === 'ko';
        receberGolpe(m, g.de as AmigoId, g.d, g.kx, g.ky, g.w, g.f);
        if (!caiu && me.estado === 'ko') this.porMim = g.de;
      } else if (g.to in CANTOS) {
        // Briga dos outros: só o sangue (o alvo cuida da vida dele).
        const alvo = achar(m, `amigo:${g.to}`);
        if (alvo && alvo.quem === 'remoto')
          m.eventos.push({ k: 'golpe', x: alvo.x, y: alvo.y, dano: g.d, forte: g.f, arma: null, em: alvo.id, de: `amigo:${g.de}`, dx: g.kx, dy: g.ky });
      } else {
        // Golpe num NPC: quem está com ele aplica (você, se ele é seu ou acabou de esfriar); nos outros, o sangue.
        const n = m.corpos.find((c) => c.id === g.to && c.quem === 'npc' && !c.ausente);
        if (!n) continue;
        if (!n.dono && n.quenteAte > m.t - 1000) golpeNoNpc(m, n, g.de as AmigoId, g.d, g.kx, g.ky, g.w, g.f);
        else if (n.dono)
          m.eventos.push({ k: 'golpe', x: n.x, y: n.y, dano: g.d, forte: g.f, arma: null, em: n.id, de: `amigo:${g.de}`, dx: g.kx, dy: g.ky });
      }
    }
    if (me.estado === 'normal') this.porMim = null;
  }

  /** O que mandar agora (ou null). */
  enviar(m: Mundo, dir: { mx: number; my: number }, lk: string, agora: number): MeuEstado | null {
    const me = eu(m);
    // O seu disparo mais novo dos últimos 3 s (rajada ou poder novo) vai junto com qual foi.
    let ult: { t0: number; q: Poder } | undefined;
    for (const r of m.rajadas) if (r.de === me.id && !r.visual && m.t - r.t0 < 3000 && (!ult || r.t0 > ult.t0)) ult = { t0: r.t0, q: 'rajada' };
    for (const d of m.poderes) if (d.de === me.id && !d.visual && m.t - d.t0 < 3000 && (!ult || d.t0 > ult.t0)) ult = { t0: d.t0, q: d.tipo };
    const s = meuEstado(me, dir, lk, this.porMim ?? undefined, ult?.t0, ult?.q);
    if (!deveEnviar(this.ant, s, agora)) return null;
    this.ant = { s, em: agora };
    return s;
  }

  /** Esquece o último envio (a gravação falhou: manda de novo no próximo quadro). */
  reenviar() {
    this.ant = null;
  }

  /**
   * NPCs que estão com os amigos: cada um vira marionete do dono (segue o retrato dele); em disputa fica com quem
   * já estava, e entre dois livres, com quem vem primeiro na ordem fixa. Sem retrato recente, volta à rotina.
   */
  receberNpc(m: Mundo, raw: unknown, agora: number, dt: number) {
    const donoDe = new Map<string, { p: AmigoId; e: NpcRede }>();
    for (const p of ORDEM) {
      if (p === this.me) continue;
      const r = (raw as Record<string, { at?: unknown; l?: unknown }> | null)?.[p];
      if (!r || typeof r.at !== 'number' || typeof r.l !== 'string' || agora - r.at > NPC_VALE_MS) continue;
      const { npcs, quebrados } = lerLinhaNpc(r.l);
      for (const e of npcs) if (!donoDe.has(e.id)) donoDe.set(e.id, { p, e });
      for (const i of quebrados) if (!m.quebrados.has(i)) quebrar(m, i);
    }
    const eu0 = ORDEM.indexOf(this.me);
    for (const c of m.corpos) {
      if (c.quem !== 'npc' || c.ausente) continue;
      const d = donoDe.get(c.id);
      if (!d) {
        if (c.dono) soltarMarionete(m, c);
        continue;
      }
      if (!c.dono && c.quenteAte > m.t && eu0 < ORDEM.indexOf(d.p)) continue; // fica comigo
      if (!c.dono) {
        // Virou marionete: quem segurava larga, e ele larga quem segurava.
        if (c.seguradoPor) {
          const h = achar(m, c.seguradoPor);
          if (h) h.segurando = null;
          c.seguradoPor = null;
        }
        if (c.segurando) {
          const s = achar(m, c.segurando);
          if (s) {
            s.seguradoPor = null;
            if (s.estado === 'segurado') s.estado = s.vida > 0 ? 'normal' : 'ko';
          }
          c.segurando = null;
        }
        c.quenteAte = 0;
        c.rota = null;
        c.tarefa = null;
      }
      c.dono = d.p;
      const antes = { x: c.x, y: c.y };
      suavizar(c, d.e, dt);
      c.fx = d.e.fx;
      c.fy = d.e.fy;
      c.vida = d.e.vi;
      c.estado = d.e.e === 'k' ? 'ko' : d.e.e === 's' ? 'segurado' : d.e.e === 'v' ? 'voando' : 'normal';
      if (c.estado === 'ko') c.koAte = Infinity;
      c.fase = d.e.a && c.estado === 'normal' ? 'antes' : 'nada';
      c.cortes = d.e.cortes;
      c.andando = c.estado === 'normal' && Math.hypot(c.x - antes.x, c.y - antes.y) > 0.2 * dt;
    }
  }

  /** Os NPCs que estão com você agora (e os móveis quebrados nos últimos 6 s), numa linha só. */
  linhaNpc(m: Mundo): string {
    return linhaNpc(m);
  }

  /** Você é o primeiro online na ordem fixa (a treta sozinha fica com você). */
  primeiroOnline(): boolean {
    const eu0 = ORDEM.indexOf(this.me);
    return ![...this.estados.keys()].some((p) => ORDEM.indexOf(p as AmigoId) < eu0);
  }

  /** O último estado lido de um amigo online (roupa, vida) para desenhar. */
  estado(id: AmigoId): EstadoVivo | undefined {
    return this.estados.get(id);
  }

  ultimo(): MeuEstado | null {
    return this.ant?.s ?? null;
  }
}

const NOMES: Record<AmigoId, string> = NOME_DE;
const nomeDe = (id: AmigoId) => NOMES[id];

/* ------------------------------------------------------------------ relógio e leitura rápida */

export interface Relogio {
  offset: number;
  rtt: number;
  em: number;
}

/**
 * Hora do servidor pela gravação mais rápida: a amostra só vale se o vai-e-volta foi quase o menor já visto (o meio
 * do caminho é onde o erro é menor); passados 60 s sem amostra boa, aceita a que vier (a rede pode ter piorado).
 */
export function aprenderRelogio(r: Relogio, serverAt: unknown, t0: number, t1: number): boolean {
  if (typeof serverAt !== 'number' || !Number.isFinite(serverAt) || t1 < t0) return false;
  const rtt = t1 - t0;
  const velho = t1 - r.em >= 60_000;
  if (rtt > r.rtt + 15 && !velho) return false;
  r.offset = serverAt - (t0 + t1) / 2;
  r.rtt = velho ? rtt : Math.min(rtt, r.rtt);
  r.em = t1;
  return true;
}

const RAPIDO = /^\/(vivo|npc|vgolpe)(\/|$)/;
/** Evento do stream que só mexe no ao vivo (lido pelo laço de quadros, sem redesenhar os painéis). */
export function soRapido(kind: 'put' | 'patch', path: string, data: unknown): boolean {
  if (RAPIDO.test(path)) return true;
  if (kind === 'patch' && path === '/' && data && typeof data === 'object') {
    const ks = Object.keys(data);
    return ks.length > 0 && ks.every((k) => RAPIDO.test(`/${k}`));
  }
  return false;
}

/* ------------------------------------------------------------------ NPC com dono (linha compacta) */

/** Ordem fixa dos amigos (desempate de quem fica com o NPC e de quem é dono da treta sozinha). */
export const ORDEM: readonly AmigoId[] = IDS;
/** Retrato de NPC com mais de 1,5 s não vale (o dono manda 4 por segundo enquanto o NPC é dele). */
export const NPC_VALE_MS = 1_500;
export const NPC_ENVIO_MS = 250;
const MAX_NPC_LINHA = 30;

export interface NpcRede {
  id: string;
  x: number;
  y: number;
  vi: number;
  e: Cod;
  fx: number;
  fy: number;
  a: boolean;
  /** O que foi arrancado (o modo sangue de quem olha desenha igual ao do dono). */
  cortes: number;
}
/** Máscara de partes arrancadas num caractere (base 32: 0–v). */
const deCortes = (s: string | undefined) => (s && /^[0-9a-v]$/.test(s) ? parseInt(s, 32) : 0);

const r1 = (v: number) => Math.round(v * 10) / 10;

/** `id,x,y,vida,estado,fx,fy,armando;…|quebrados` (até 30 NPCs: cabe nos 1500 caracteres da regra). */
export function linhaNpc(m: Mundo): string {
  const partes: string[] = [];
  for (const c of m.corpos) {
    if (c.quem !== 'npc' || c.dono || c.ausente || c.quenteAte <= m.t) continue;
    if (partes.length >= MAX_NPC_LINHA) break;
    partes.push([c.id, r2(c.x), r2(c.y), Math.round(Math.max(0, Math.min(999, c.vida))), codDe(c), r1(c.fx), r1(c.fy), c.fase === 'antes' ? 1 : 0, (c.cortes & 31).toString(32)].join(','));
  }
  if (!partes.length) return '';
  const q = [...m.quebrados].filter(([, t]) => m.t - t < 6000).map(([i]) => i);
  return partes.join(';') + (q.length ? `|${q.join(',')}` : '');
}

export function lerLinhaNpc(l: string): { npcs: NpcRede[]; quebrados: number[] } {
  const npcs: NpcRede[] = [];
  const quebrados: number[] = [];
  if (typeof l !== 'string' || l.length > 1500 || !l) return { npcs, quebrados };
  const [corpo, q] = l.split('|');
  for (const parte of corpo.split(';')) {
    const [id, x, y, vi, e, fx, fy, a, mu] = parte.split(',');
    const n: NpcRede = { id, x: Number(x), y: Number(y), vi: Number(vi), e: e as Cod, fx: Number(fx), fy: Number(fy), a: a === '1', cortes: deCortes(mu) };
    if (!/^[a-z0-9]{2,16}$/.test(id ?? '') || !num(n.x, 0, 63) || !num(n.y, 0, 63) || !num(n.vi, 0, 999)) continue;
    if (!['n', 'k', 's', 'v'].includes(n.e) || !num(n.fx, -1, 1) || !num(n.fy, -1, 1)) continue;
    npcs.push(n);
    if (npcs.length >= MAX_NPC_LINHA) break;
  }
  for (const i of (q ?? '').split(',')) {
    // Só móvel que existe e quebra (índice torto travava o laço de quadros de todo mundo).
    const n = Number(i);
    if (/^[0-9]{1,4}$/.test(i) && n < PROPS.length && QUEBRAVEIS.has(PROPS[n].kind) && !quebrados.includes(n)) quebrados.push(n);
  }
  return { npcs, quebrados };
}
