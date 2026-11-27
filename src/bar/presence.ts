/**
 * O bar ao vivo: presença, conversa, bizarrices e marcas, numa conexão de streaming só (cruzadabotecos/bar).
 *
 * Presença por batimento, sem biblioteca do Firebase:
 *   bar/presence/{jogador} = { r: cômodo ou "mesa", x, y: de onde saiu, tx, ty: para onde vai, at: hora do servidor,
 *   on: está com o bar aberto }.
 * Cada aparelho manda só o destino de cada toque e um batimento a cada 30 s; os outros recalculam o caminho
 * sozinhos (mesmo mapa, mesmo A*). Quem passa 90 s sem bater, ou fecha o bar, cai em ressaca.
 * Conversa e bizarrices: ver social.ts.
 */
import { PLAYERS, isPlayerId, type PlayerId } from '../arena/sprites';
import { applyStreamEvent } from '../arena/scoreStore';
import type { Tile } from './iso';
import {
  CHAT_SLOTS,
  FX_SLOTS,
  cleanText,
  nextSlot,
  sanitizeChat,
  sanitizeFx,
  sanitizeMarks,
  type ChatMsg,
  type FxEvent,
  type FxKind,
  type Mark,
} from './social';
import { HIT_SLOTS, sanitizeCd, sanitizeHits, weaponWait, type Hit, type Weapon } from './blood';
import { sameDay } from './day';
import { nextEntry, sanitizeDia, sinoToday } from './daily';
import { nextMolhoSlot, nextPocaSlot, propKey } from './mess';
import { GOLPE_SLOTS, aprenderRelogio, soRapido, type MeuEstado, type Relogio, type VGolpeEnvio } from '../vivo/rede';
import { ADMIN } from '../turma/index';

export interface PresenceEntry {
  r: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  at: number;
  on: boolean;
}
export type PresenceTree = Partial<Record<PlayerId, PresenceEntry>>;

export const HEARTBEAT_MS = 30_000;
export const OFFLINE_AFTER_MS = 90_000;
/** "Cômodo" de quem saiu do bar para jogar sentado numa mesa. */
export const SEATED = 'mesa';
const ROOT = 'cruzadabotecos/bar';

const isCoord = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 63;

export function sanitizePresence(raw: unknown): PresenceTree {
  const out: PresenceTree = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [pid, v] of Object.entries(raw as Record<string, unknown>)) {
    const e = v as Partial<PresenceEntry> | null;
    if (!isPlayerId(pid) || !e || typeof e !== 'object') continue;
    if (typeof e.r !== 'string' || !/^[a-z]{1,16}$/.test(e.r)) continue;
    if (![e.x, e.y, e.tx, e.ty].every(isCoord) || typeof e.at !== 'number' || typeof e.on !== 'boolean') continue;
    out[pid] = { r: e.r, x: e.x!, y: e.y!, tx: e.tx!, ty: e.ty!, at: e.at, on: e.on };
  }
  return out;
}

/** Está no bar agora? (aberto e batendo nos últimos 90 s, pela hora do servidor). */
export function isOnline(e: PresenceEntry | undefined, nowServer: number): boolean {
  return !!e && e.on && nowServer - e.at < OFFLINE_AFTER_MS;
}

/** "visto há 3 h" para a etiqueta de quem está em ressaca. */
export function lastSeen(e: PresenceEntry | undefined, nowServer: number): string {
  if (!e) return 'nunca apareceu';
  const min = Math.max(0, Math.floor((nowServer - e.at) / 60_000));
  if (min < 1) return 'saiu agora';
  if (min < 60) return `visto há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `visto há ${h} h`;
  return `visto há ${Math.floor(h / 24)} d`;
}

function envUrl(): string {
  try {
    const raw = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_FIREBASE_DB_URL ?? '';
    return raw.trim().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export type BarStatus = 'local' | 'connecting' | 'live' | 'error';
type Listener = () => void;
type Raw = Record<string, unknown>;

const sub = (o: unknown, k: string): Raw => (o && typeof o === 'object' ? (((o as Raw)[k] as Raw) ?? {}) : {});

class BarStore {
  readonly url = envUrl();
  readonly online = this.url.length > 0;
  tree: PresenceTree = {};
  chat: ChatMsg[] = [];
  fx: FxEvent[] = [];
  marks: Partial<Record<PlayerId, Mark>> = {};
  hits: Hit[] = [];
  /** Hora do meu último uso de cada arma (vem do banco: recarregar a página não zera a espera). */
  cd: Partial<Record<Weapon | 'geral', number>> = {};
  /** bar/kills inteiro (pequeno: um registro por par de lutadores). */
  killsRaw: unknown = {};
  /** bar/dia e bar/sino (Palavra do Dia), filtrados pelo dia na hora de usar. */
  diaRaw: unknown = {};
  sinoRaw: unknown = null;
  /** Bagunça de cenário (bar/mess, bar/poca, bar/molho), filtrada pelo dia na hora de usar. */
  /** Anagrama da Saideira (bar/ana), filtrado pelo dia na hora de usar. */
  anaRaw: unknown = {};
  /** Quiz da sinuca (bar/quiz), filtrado pelo dia na hora de usar. */
  quizRaw: unknown = {};
  messRaw: unknown = {};
  pocaRaw: unknown = {};
  molhoRaw: unknown = {};
  status: BarStatus = this.online ? 'connecting' : 'local';
  /** hora do servidor − hora local, medida na resposta de cada gravação. */
  offset = 0;
  /** Sentado numa mesa jogando: sair da tela do bar não derruba. */
  seated = false;
  private listeners = new Set<Listener>();
  private es: EventSource | null = null;
  private raw: Raw = {};
  private beat: number | undefined;
  private me: PlayerId | null = null;
  private whereNow: (() => Tile) | null = null;
  private lastAny = 0;
  private relogio: Relogio = { offset: 0, rtt: Infinity, em: -Infinity };
  /** Conta os retratos inteiros (conexão e reconexão): o que veio neles é passado para o Bar Vivo. */
  retrato = 0;
  /** Ao vivo (Fatia 3): uma gravação por vez em cada caminho, a próxima leva só o mais novo. */
  private pendente = new Map<string, unknown>();
  private voando = new Set<string>();
  private falhou = new Set<string>();
  /** Recusas seguidas do servidor (regras sem o ao vivo): passado o limite, o Bar Vivo segue sozinho, calado. */
  private recusas = 0;
  private golpeEm: number[] = Array(GOLPE_SLOTS).fill(-Infinity);

  now(): number {
    return Date.now() + this.offset;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  /** Recalcula as listas a partir do bruto; a minha presença local vale enquanto a gravação não volta. */
  private derive() {
    const fresh = sanitizePresence(sub(this.raw, 'presence'));
    const me = this.me;
    if (me && this.tree[me] && (!fresh[me] || fresh[me]!.at < this.tree[me]!.at)) fresh[me] = this.tree[me];
    this.tree = fresh;
    this.chat = sanitizeChat(sub(this.raw, 'chat'));
    this.fx = sanitizeFx(sub(this.raw, 'fx'));
    this.marks = sanitizeMarks(sub(this.raw, 'marks'));
    this.hits = sanitizeHits(sub(this.raw, 'hit'));
    this.cd = me ? sanitizeCd(sub(sub(this.raw, 'cd'), me)) : {};
    this.killsRaw = sub(this.raw, 'kills');
    this.diaRaw = sub(this.raw, 'dia');
    this.sinoRaw = (this.raw as Raw).sino ?? null;
    this.anaRaw = sub(this.raw, 'ana');
    this.quizRaw = sub(this.raw, 'quiz');
    this.messRaw = sub(this.raw, 'mess');
    this.pocaRaw = sub(this.raw, 'poca');
    this.molhoRaw = sub(this.raw, 'molho');
  }

  private connect() {
    if (!this.online || this.es || typeof EventSource === 'undefined') return;
    const es = new EventSource(`${this.url}/${ROOT}.json`);
    this.es = es;
    const onData = (kind: 'put' | 'patch') => (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data) as { path: string; data: unknown };
        const next = applyStreamEvent(this.raw, kind, msg.path, msg.data);
        this.raw = next && typeof next === 'object' ? (next as Raw) : {};
        if (kind === 'put' && msg.path === '/') this.retrato++;
        // O ao vivo (posições, golpes, NPCs) chega várias vezes por segundo: o laço de quadros lê o bruto direto.
        if (soRapido(kind, msg.path, msg.data) && this.status === 'live') return;
        this.derive();
        this.status = 'live';
        this.emit();
      } catch {
        /* evento malformado */
      }
    };
    es.addEventListener('put', onData('put') as EventListener);
    es.addEventListener('patch', onData('patch') as EventListener);
    es.onerror = () => {
      this.status = es.readyState === EventSource.CLOSED ? 'error' : 'connecting';
      this.emit();
    };
  }

  /** Aplica no bruto local (aparece na hora, antes do servidor confirmar). */
  private applyLocal(paths: Record<string, unknown>) {
    this.raw = applyStreamEvent(this.raw, 'patch', '/', paths) as Raw;
    this.derive();
    this.emit();
  }

  private learnOffset(serverAt: unknown, t0: number, t1: number) {
    if (aprenderRelogio(this.relogio, serverAt, t0, t1)) this.offset = this.relogio.offset;
  }

  /* ------------------------------------------------------------ ao vivo (Fatia 3) */

  /** Bruto do ao vivo, para o laço de quadros (sem cópia nem conferência: quem lê passa pelo sanitize). */
  vivoRaw(): unknown {
    return sub(this.raw, 'vivo');
  }
  golpesRaw(): unknown {
    return sub(this.raw, 'vgolpe');
  }
  npcRaw(): unknown {
    return sub(this.raw, 'npc');
  }
  /** Já mediu a hora do servidor (antes disso o `at` do ao vivo pode cair fora da janela da regra). */
  get relogioOk(): boolean {
    return this.relogio.em > -Infinity;
  }
  /** O servidor recusa o ao vivo (regras antigas): o Bar Vivo fica só no aparelho. */
  get aoVivo(): boolean {
    return this.online && this.recusas < 5;
  }
  /** A última gravação deste caminho falhou (o laço manda o estado de novo, já atualizado). */
  falhouEnvio(caminho: string): boolean {
    return this.falhou.delete(caminho);
  }

  private gravar(caminho: string, corpo: unknown, keepalive = false) {
    if (!this.aoVivo) return;
    if (keepalive) {
      void fetch(`${this.url}/${ROOT}/${caminho}.json`, { method: 'PUT', body: JSON.stringify(corpo), keepalive }).catch(() => undefined);
      return;
    }
    this.pendente.set(caminho, corpo);
    if (!this.voando.has(caminho)) void this.bombear(caminho);
  }

  private async bombear(caminho: string) {
    this.voando.add(caminho);
    try {
      while (this.pendente.has(caminho)) {
        const corpo = this.pendente.get(caminho);
        this.pendente.delete(caminho);
        const t0 = Date.now();
        let ok = false;
        try {
          const res = await fetch(`${this.url}/${ROOT}/${caminho}.json`, { method: 'PUT', body: JSON.stringify(corpo) });
          ok = res.ok;
          // Recusa antes de medir o relógio pode ser só a hora torta do aparelho: não conta.
          if ((res.status === 401 || res.status === 403) && this.relogioOk) this.recusas++;
          if (ok) {
            this.recusas = 0;
            const b = (await res.json()) as { sv?: number } | null;
            this.learnOffset(b?.sv, t0, Date.now());
          }
        } catch {
          /* sem rede */
        }
        if (!ok) {
          // O laço refaz o estado (o que ia já envelheceu); espera um pouco antes de tentar de novo.
          this.falhou.add(caminho);
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    } finally {
      this.voando.delete(caminho);
    }
  }

  /** Você no Bar Vivo: posição, direção, estado (hora pelo servidor; `sv` mede o relógio a cada envio). */
  sendVivo(s: MeuEstado, on = true) {
    const me = this.me;
    if (!me) return;
    // O servidor quer 100 ms entre um envio e outro: o "saí" logo depois de um passo vai com a hora empurrada.
    const at = Math.max(Math.round(this.now()), this.vivoAt + 100);
    this.vivoAt = at;
    this.gravar(`vivo/${me}`, { ...s, at, on, sv: { '.sv': 'timestamp' } }, !on);
  }
  private vivoAt = 0;

  /** Golpe num amigo (quem bate decide): cada posição da fila só regrava depois de 1 s (senão o golpe se perde). */
  sendGolpe(g: VGolpeEnvio): boolean {
    const me = this.me;
    if (!me || !this.aoVivo) return false;
    const agora = Date.now();
    let slot = -1;
    for (let i = 0; i < GOLPE_SLOTS; i++) if (agora - this.golpeEm[i] >= 1100 && (slot < 0 || this.golpeEm[i] < this.golpeEm[slot])) slot = i;
    if (slot < 0) return false;
    this.golpeEm[slot] = agora;
    void fetch(`${this.url}/${ROOT}/vgolpe/${me}/${slot}.json`, { method: 'PUT', body: JSON.stringify({ ...g, t: { '.sv': 'timestamp' } }) })
      .then((r) => {
        if ((r.status === 401 || r.status === 403) && this.relogioOk) this.recusas++;
      })
      .catch(() => undefined);
    return true;
  }

  /** Carteira do bar no banco (gasto e achado), só leitura. */
  lojaRaw(): unknown {
    return this.me ? (sub(this.raw, 'loja') as Raw)[this.me] ?? null : null;
  }

  /** Mesas de sinuca (bar/mesa/0 e 1), só leitura. */
  mesaRaw(): unknown {
    return sub(this.raw, 'mesa');
  }

  /** Jukebox do Bar Vivo (bar/juke), só leitura. */
  jukeRaw(): unknown {
    return sub(this.raw, 'juke');
  }

  /** Ficha dos procurados (nocautes de cada amigo). */
  fichaRaw(): unknown {
    return sub(this.raw, 'ficha');
  }

  /**
   * Grava fora do ao vivo (carteira, mesa de sinuca): recusa aqui não conta para desligar o ao vivo, e o jogo segue
   * no aparelho (quem chama decide o que fazer com o false).
   */
  private async gravarSolto(caminho: string, corpo: unknown): Promise<boolean> {
    if (!this.online || !this.me) return false;
    const t0 = Date.now();
    try {
      const res = await fetch(`${this.url}/${ROOT}/${caminho}.json`, { method: 'PUT', body: JSON.stringify(corpo) });
      if (!res.ok) return false;
      const b = (await res.json()) as { t?: number; at?: number } | null;
      this.learnOffset(b?.t ?? b?.at, t0, Date.now());
      return true;
    } catch {
      return false;
    }
  }

  /* ------------------------------------------------------------ Fatia 10: diretor de eventos */

  /** Chave do dono (`bar/config/eventos`): multiplicador e "forçar X na época Y". Só leitura aqui. */
  configEventosRaw(): unknown {
    return (sub(this.raw, 'config') as Raw).eventos ?? null;
  }
  /** O evento da época `e` (abertura, fim e livros de dano), como veio do banco. */
  eventoRaw(e: number): unknown {
    return (sub(this.raw, 'evento') as Raw)[String(e)] ?? null;
  }
  /** Épocas com evento guardado no banco (para limpar as velhas). */
  epocasGuardadas(): number[] {
    return Object.keys(sub(this.raw, 'evento')).filter((k) => /^[0-9]{1,9}$/.test(k)).map(Number);
  }
  /** Prateleira de troféus do bar: `{troféu: {jogador: quando}}`. */
  trofeusRaw(): unknown {
    return sub(this.raw, 'trofeus');
  }
  /** Primeiro a ver o início grava a abertura (o banco só aceita uma): `n` = jogadores no bar naquela hora. */
  abrirEvento(e: number, n: number): Promise<boolean> {
    return this.gravarSolto(`evento/${e}/abertura`, { n, at: { '.sv': 'timestamp' } });
  }
  /** O instante que muda a história (bicho morto, luz religada), gravado uma vez só. */
  fecharEvento(e: number, como: 'morto' | 'religado'): Promise<boolean> {
    return this.me ? this.gravarSolto(`evento/${e}/fim`, { como, p: this.me, at: { '.sv': 'timestamp' } }) : Promise.resolve(false);
  }
  /** O seu total de dano num bicho do evento (só cresce; o banco recusa diminuir). */
  somarDano(e: number, ent: string, total: number): Promise<boolean> {
    return this.me ? this.gravarSolto(`evento/${e}/dano/${ent}/${this.me}`, Math.round(total)) : Promise.resolve(false);
  }
  /** Troféu na prateleira (uma vez por jogador). */
  ganharTrofeu(trofeu: string): Promise<boolean> {
    return this.me ? this.gravarSolto(`trofeus/${trofeu}/${this.me}`, { '.sv': 'timestamp' }) : Promise.resolve(false);
  }
  /** Apaga um evento velho (o banco só deixa 1 h depois da abertura). */
  apagarEvento(e: number): Promise<boolean> {
    return this.gravarSolto(`evento/${e}`, null);
  }
  /** Só o dono: multiplicador dos eventos (0 desliga, até 3) e forçar um tipo numa época. */
  guardarConfigEventos(mult: number, forcar?: Record<string, string>): Promise<boolean> {
    return this.me === ADMIN
      ? this.gravarSolto('config/eventos', { mult, p: this.me, t: { '.sv': 'timestamp' }, ...(forcar && Object.keys(forcar).length ? { forcar } : {}) })
      : Promise.resolve(false);
  }

  /* ------------------------------------------------------------ Fatia 13: portais */

  /** Prêmios dos portais de cada um: `{jogador: {item: quando}}` (cada item gravado uma vez). */
  inventarioRaw(): unknown {
    return sub(this.raw, 'inventario');
  }
  /** Pó de Dimensão (ganho e gasto, só sobem) de cada um. */
  poRaw(): unknown {
    return sub(this.raw, 'po');
  }
  /** Placar do dia de um portal: `{jogador: {s, f (fantasma), v, t}}`; vale só o que tem `t` de hoje. */
  placarRaw(portal: 'moscas' | 'quermesse' | 'churrasco'): unknown {
    return (sub(this.raw, 'portais') as Raw)[portal] ?? null;
  }
  /* ------------------------------------------------------------ Fatia 15: interação */

  /** O `fx` cru (`{jogador: {slot: {k, to, e, t}}}`), para o brinde e o reviver. */
  fxRaw(): unknown {
    return sub(this.raw, 'fx');
  }
  /** O bar inteiro como chegou (só leitura), para o livro do bar. */
  barRaw(): unknown {
    return this.raw;
  }
  ganharItem(id: string): Promise<boolean> {
    return this.me ? this.gravarSolto(`inventario/${this.me}/${id}`, { '.sv': 'timestamp' }) : Promise.resolve(false);
  }
  sendPo(g: number, s: number): Promise<boolean> {
    return this.me ? this.gravarSolto(`po/${this.me}`, { g, s, t: { '.sv': 'timestamp' } }) : Promise.resolve(false);
  }
  /** Melhor run do dia num portal (o banco só aceita subir no mesmo dia; dia novo recomeça). */
  sendPlacar(portal: 'moscas' | 'quermesse' | 'churrasco', s: number, f: string, v: number): Promise<boolean> {
    return this.me ? this.gravarSolto(`portais/${portal}/${this.me}`, { s, f, v, t: { '.sv': 'timestamp' } }) : Promise.resolve(false);
  }

  sendLoja(g: number, a: number): Promise<boolean> {
    return this.me ? this.gravarSolto(`loja/${this.me}`, { g, a, t: { '.sv': 'timestamp' } }) : Promise.resolve(false);
  }

  /** Escolhe a faixa da jukebox para o bar inteiro (-1 desliga). O servidor só aceita troca a cada 3 s. */
  sendJuke(s: number): Promise<boolean> {
    return this.me ? this.gravarSolto('juke', { s, p: this.me, t: { '.sv': 'timestamp' } }) : Promise.resolve(false);
  }

  sendFicha(k: number): Promise<boolean> {
    return this.me ? this.gravarSolto(`ficha/${this.me}`, { k, t: { '.sv': 'timestamp' } }) : Promise.resolve(false);
  }

  sendMesa(i: 0 | 1, m: { a: string; b: string; v: 0 | 1; e: string; n: number; tq: string }): Promise<boolean> {
    return this.gravarSolto(`mesa/${i}`, { ...m, at: { '.sv': 'timestamp' } });
  }

  /** Retrato dos NPCs que estão com você (linha compacta). */
  sendNpc(l: string) {
    const me = this.me;
    if (!me) return;
    this.gravar(`npc/${me}`, { at: { '.sv': 'timestamp' }, l });
  }

  private async putPresence(player: PlayerId, e: Omit<PresenceEntry, 'at'>, keepalive = false): Promise<void> {
    if (!this.online) return;
    const t0 = Date.now();
    try {
      // Sem Content-Type: requisição simples (sem pré-voo de CORS); funciona com keepalive ao fechar a aba.
      const res = await fetch(`${this.url}/${ROOT}/presence/${player}.json`, {
        method: 'PUT',
        body: JSON.stringify({ ...e, at: { '.sv': 'timestamp' } }),
        keepalive,
      });
      if (!res.ok || keepalive) return;
      const body = (await res.json()) as { at?: number };
      this.learnOffset(body.at, t0, Date.now());
      const mine = this.tree[player];
      if (typeof body.at === 'number' && mine && mine.tx === e.tx && mine.ty === e.ty && mine.x === e.x && mine.y === e.y) {
        this.tree = { ...this.tree, [player]: { ...mine, at: body.at } };
        this.emit();
      }
    } catch {
      /* sem rede: o próximo batimento tenta de novo */
    }
  }

  /** Gravação em várias posições de uma vez, junto com o carimbo de ritmo (o servidor recusa < 2 s). */
  private async patch(paths: Record<string, unknown>): Promise<boolean> {
    if (!this.online) return true;
    const t0 = Date.now();
    try {
      const res = await fetch(`${this.url}/${ROOT}.json`, { method: 'PATCH', body: JSON.stringify(paths) });
      if (!res.ok) return false;
      const body = (await res.json()) as Raw;
      const me = this.me;
      const stamp = me ? ((body[`rate/${me}`] ?? body[`cd/${me}/geral`]) as { at?: number } | undefined) : undefined;
      this.learnOffset(stamp?.at, t0, Date.now());
      return true;
    } catch {
      return false;
    }
  }

  private setLocal(player: PlayerId, e: Omit<PresenceEntry, 'at'>) {
    this.tree = { ...this.tree, [player]: { ...e, at: this.now() } };
    this.emit();
  }

  private startBeat() {
    window.clearInterval(this.beat);
    this.beat = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      this.heartbeat();
    }, HEARTBEAT_MS);
  }

  /** Entra no bar: de onde estava (mesma sala, se ainda online), levantando da mesa, ou pela porta do salão. */
  join(player: PlayerId, door: Tile, whereNow: () => Tile) {
    this.me = player;
    this.whereNow = whereNow;
    this.seated = false;
    this.connect();
    const prev = this.tree[player];
    const alive = prev && isOnline(prev, this.now());
    const e =
      alive && prev!.r !== SEATED
        ? { r: prev!.r, x: prev!.tx, y: prev!.ty, tx: prev!.tx, ty: prev!.ty, on: true }
        : alive
          ? { r: 'salao', x: prev!.x, y: prev!.y, tx: prev!.x, ty: prev!.y, on: true }
          : { r: 'salao', x: door.x, y: door.y, tx: door.x + 1, ty: door.y, on: true };
    this.setLocal(player, e);
    void this.putPresence(player, e);
    this.startBeat();
    // Quem entra acordado limpa o bigode de caneta da cara.
    if ((this.marks[player]?.n ?? 0) > 0) void this.mark(player, 0);
  }

  /**
   * Bar Vivo: liga a leitura do bar e se identifica para os jogos (Palavra do Dia, anagrama, quiz) sem gravar
   * presença (a presença ao vivo do Bar Vivo é a Fatia 3). Grava só o carimbo de ritmo, que já existe nas regras,
   * para medir a hora do servidor (o relógio do quiz e o dia das 6 h dependem dela).
   */
  observe(player: PlayerId) {
    this.me = player;
    this.connect();
    // O carimbo mede a hora do servidor; recusado (recarregou a página em menos de 2 s), tenta de novo.
    const tentar = (n: number) => {
      if (!this.online || this.relogioOk || this.me !== player) return;
      this.lastAny = 0;
      const st = this.stamp();
      if (st)
        void this.patch(st).then((ok) => {
          if (!ok && n > 0) window.setTimeout(() => tentar(n - 1), 2100);
        });
    };
    tentar(3);
  }

  /** Batimento: regrava a posição atual (se ainda anda, recomeça o mesmo destino de onde está). */
  heartbeat() {
    const me = this.me;
    const cur = me ? this.tree[me] : undefined;
    if (!me || !cur) return;
    const here = cur.r === SEATED || !this.whereNow ? { x: cur.x, y: cur.y } : this.whereNow();
    const e = { r: cur.r, x: here.x, y: here.y, tx: cur.r === SEATED ? here.x : cur.tx, ty: cur.r === SEATED ? here.y : cur.ty, on: true };
    this.setLocal(me, e);
    void this.putPresence(me, e);
  }

  move(from: Tile, to: Tile) {
    const me = this.me;
    const cur = me ? this.tree[me] : undefined;
    if (!me || !cur) return;
    const e = { r: cur.r, x: from.x, y: from.y, tx: to.x, ty: to.y, on: true };
    this.setLocal(me, e);
    void this.putPresence(me, e);
  }

  /** Senta na mesa para jogar: continua "no bar" (batimento segue) enquanto a cruzada está aberta. */
  sit(seat: Tile) {
    const me = this.me;
    if (!me) return;
    this.seated = true;
    const e = { r: SEATED, x: seat.x, y: seat.y, tx: seat.x, ty: seat.y, on: true };
    this.setLocal(me, e);
    void this.putPresence(me, e);
    this.startBeat();
  }

  /** Sai do bar (fechar a tela ou a aba): cai em ressaca na hora para os outros. */
  leave() {
    const me = this.me;
    window.clearInterval(this.beat);
    this.beat = undefined;
    this.seated = false;
    if (!me) return;
    const cur = this.tree[me];
    const here = cur?.r === SEATED || !this.whereNow ? { x: cur?.x ?? 0, y: cur?.y ?? 0 } : this.whereNow();
    const e = { r: cur?.r === SEATED ? 'salao' : (cur?.r ?? 'salao'), x: here.x, y: here.y, tx: here.x, ty: here.y, on: false };
    this.setLocal(me, e);
    void this.putPresence(me, e, true);
    this.me = null;
  }

  /** Quanto falta para poder mandar outra coisa (limite de 2 s do servidor). */
  waitMs(): number {
    return Math.max(0, this.lastAny + 2000 - Date.now());
  }

  private stamp(): Record<string, unknown> | null {
    const me = this.me;
    if (!me || this.waitMs() > 0) return null;
    this.lastAny = Date.now();
    return { [`rate/${me}`]: { at: { '.sv': 'timestamp' } } };
  }

  private localStamp(paths: Record<string, unknown>): Record<string, unknown> {
    const now = this.now();
    return Object.fromEntries(
      Object.entries(paths).map(([k, v]) => [
        k,
        v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, b && typeof b === 'object' && '.sv' in b ? now : b])) : v,
      ]),
    );
  }

  /** Mostra na hora; se o servidor recusar, volta cada posição ao que era (o stream não avisa de recusa). */
  private async send(paths: Record<string, unknown>): Promise<boolean> {
    const before = Object.fromEntries(
      Object.keys(paths).map((k) => [k, k.split('/').reduce<unknown>((n, s) => (n && typeof n === 'object' ? (n as Raw)[s] : undefined), this.raw) ?? null]),
    );
    this.applyLocal(this.localStamp(paths));
    const ok = await this.patch(paths);
    if (!ok) this.applyLocal(before);
    return ok;
  }

  /** Mensagem no chat (vira balão em cima da cabeça). */
  async say(text: string): Promise<boolean> {
    const me = this.me;
    const m = cleanText(text);
    const st = this.stamp();
    if (!me || !m || !st) return false;
    const slot = nextSlot(sub(sub(this.raw, 'chat'), me) as Record<string, { t?: number }>, CHAT_SLOTS);
    return this.send({ ...st, [`chat/${me}/${slot}`]: { m, t: { '.sv': 'timestamp' } } });
  }

  /** Emoji ou bizarrice contra alguém. */
  async act(k: FxKind, to: PlayerId | '', e = ''): Promise<boolean> {
    const me = this.me;
    const st = this.stamp();
    if (!me || !st) return false;
    const slot = nextSlot(sub(sub(this.raw, 'fx'), me) as Record<string, { t?: number }>, FX_SLOTS);
    return this.send({ ...st, [`fx/${me}/${slot}`]: { k, to, e, t: { '.sv': 'timestamp' } } });
  }

  /** Pegadinha no desmaiado (n = degraus, de 0 a 6: bigode, monocelha, X, bilhete, placa, jornal; 0 limpa). */
  async mark(target: PlayerId, n: number): Promise<boolean> {
    const me = this.me;
    if (!me) return false;
    const st = this.stamp() ?? (n === 0 ? { [`rate/${me}`]: { at: { '.sv': 'timestamp' } } } : null);
    if (!st) return false;
    return this.send({ ...st, [`marks/${target}`]: { by: me, n: Math.max(0, Math.min(6, n)), t: { '.sv': 'timestamp' } } });
  }

  /** Quanto falta para usar a arma (espera dela e a geral de 10 s), pela hora do servidor. */
  weaponWait(w: Weapon): number {
    return weaponWait(this.cd, w, this.now());
  }

  /** Golpe: carimbo geral + carimbo da arma + o golpe, numa gravação só (o servidor confere as esperas). */
  async attack(w: Weapon, to: PlayerId, at: Tile, room: string): Promise<boolean> {
    const me = this.me;
    if (!me || me === to || this.weaponWait(w) > 0) return false;
    const slot = nextSlot(sub(sub(this.raw, 'hit'), me) as Record<string, { t?: number }>, HIT_SLOTS);
    const sv = { '.sv': 'timestamp' };
    return this.send({
      [`cd/${me}/geral`]: { at: sv },
      [`cd/${me}/${w}`]: { at: sv },
      [`hit/${me}/${slot}`]: { w, to, r: room, x: Math.max(0, Math.min(63, Math.round(at.x))), y: Math.max(0, Math.min(63, Math.round(at.y))), t: sv },
    });
  }

  /** Anota um abate na ficha corrida do dia (só quando o meu golpe foi o letal, conferido pela conta de vida). */
  async recordKill(victim: PlayerId, hitT: number): Promise<boolean> {
    const me = this.me;
    if (!me) return false;
    const cur = sub(sub(this.killsRaw, me), victim) as { n?: number; t?: number };
    if (typeof cur.t === 'number' && cur.t >= hitT) return true; // já anotado
    const today = typeof cur.t === 'number' && typeof cur.n === 'number' && sameDay(cur.t, this.now());
    const n = today ? cur.n! + 1 : 1;
    return this.send({ [`kills/${me}/${victim}`]: { n, t: { '.sv': 'timestamp' } } });
  }

  /** Volta à vida na porta do salão (de qualquer cômodo). */
  respawn(door: Tile) {
    const me = this.me;
    const cur = me ? this.tree[me] : undefined;
    if (!me || !cur || cur.r === SEATED) return;
    const e = { r: 'salao', x: door.x, y: door.y, tx: door.x + 1, ty: door.y, on: true };
    this.setLocal(me, e);
    void this.putPresence(me, e);
  }

  /** Anagrama: grava letras reveladas (r) e o acerto da palavra i. A regra só deixa r subir e trava depois do acerto. */
  async ana(i: number, r: number, ok: boolean): Promise<boolean> {
    const me = this.me;
    if (!me || !this.online) return false;
    return this.send({ [`ana/${me}/${i}`]: { r, ok, t: { '.sv': 'timestamp' } } });
  }

  /** Quiz: abre a pergunta i (o relógio começa na hora do servidor; a regra não deixa reabrir no mesmo dia). */
  async quizOpen(i: number): Promise<boolean> {
    const me = this.me;
    if (!me || !this.online) return false;
    return this.send({ [`quiz/${me}/${i}`]: { o: { '.sv': 'timestamp' }, k: -1, a: 0 } });
  }

  /** Quiz: responde a pergunta i com a opção k (uma vez só; a hora da resposta é a do servidor). */
  async quizAnswer(i: number, k: number, openedAt: number): Promise<boolean> {
    const me = this.me;
    if (!me || !this.online) return false;
    return this.send({ [`quiz/${me}/${i}`]: { o: openedAt, k, a: { '.sv': 'timestamp' } } });
  }

  /** Derruba (down = true) ou levanta um móvel. */
  async knock(room: string, at: Tile, down: boolean): Promise<boolean> {
    const me = this.me;
    const st = this.stamp();
    if (!me || !st) return false;
    return this.send({ ...st, [`mess/${room}/${propKey(at.x, at.y)}`]: { d: down, by: me, t: { '.sv': 'timestamp' } } });
  }

  /** Derrama uma poça de cerveja no chão. */
  async spill(room: string, at: Tile): Promise<boolean> {
    const me = this.me;
    const st = this.stamp();
    if (!me || !st) return false;
    const slot = nextPocaSlot(this.pocaRaw, room, this.now());
    return this.send({ ...st, [`poca/${room}/${slot}`]: { x: at.x, y: at.y, by: me, seco: false, t: { '.sv': 'timestamp' } } });
  }

  /** Seca uma poça (a posição fica livre para a próxima). */
  async dry(room: string, slot: number, at: Tile): Promise<boolean> {
    const me = this.me;
    const st = this.stamp();
    if (!me || !st) return false;
    return this.send({ ...st, [`poca/${room}/${slot}`]: { x: at.x, y: at.y, by: me, seco: true, t: { '.sv': 'timestamp' } } });
  }

  /** Taca molho de tomate na parede (lado L ou R, u ao longo da parede, v de altura). */
  async sauce(room: string, side: 'L' | 'R', u: number, v: number): Promise<boolean> {
    const me = this.me;
    const st = this.stamp();
    if (!me || !st) return false;
    const slot = nextMolhoSlot(this.molhoRaw, room, me, this.now());
    const clamp = (n: number, hi: number) => Math.max(0, Math.min(hi, Math.round(n)));
    return this.send({ ...st, [`molho/${room}/${me}/${slot}`]: { s: side, u: clamp(u, 400), v: clamp(v, 80), t: { '.sv': 'timestamp' } } });
  }

  /** Muda de cômodo pela porta: aparece na soleira do outro lado e dá um passo para dentro. */
  changeRoom(to: string, arrive: Tile) {
    const me = this.me;
    if (!me) return;
    const e = { r: to, x: arrive.x, y: arrive.y, tx: arrive.x, ty: arrive.y, on: true };
    this.setLocal(me, e);
    void this.putPresence(me, e);
  }

  /**
   * Um chute da Palavra do Dia: grava as cores ANTES de mostrar (fechar a aba não devolve o chute).
   * Se acertou e ninguém bateu o sino hoje, tenta o sino na mesma gravação; se outro bateu antes, grava sem.
   * Devolve se gravou e se o sino ficou com você.
   */
  async guess(pattern: string): Promise<{ saved: boolean; bell: boolean }> {
    const me = this.me;
    if (!me || !this.online) return { saved: false, bell: false };
    const now = this.now();
    const entry = sanitizeDia(this.diaRaw, now)[me];
    const next = nextEntry(entry, pattern);
    const dia = { [`dia/${me}`]: { ...next, t: { '.sv': 'timestamp' } } };
    if (next.ok && !sinoToday(this.sinoRaw, now)) {
      if (await this.send({ ...dia, sino: { p: me, t: { '.sv': 'timestamp' } } })) return { saved: true, bell: true };
    }
    return { saved: await this.send(dia), bell: false };
  }

  players(): PlayerId[] {
    return PLAYERS.map((p) => p.id);
  }
}

export const barPresence = new BarStore();
