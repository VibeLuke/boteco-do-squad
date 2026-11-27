// Motor da sinuca "bola 8" casual, vista de cima (módulo puro: sem DOM, sem dependência).
//
// Mesa normalizada 2,0 × 1,0 (x para a direita, y para baixo). Bola de raio R = 0,045 (57 mm numa mesa de 2,54 m).
// A física é determinística: passo fixo DT, só + − × ÷ e Math.sqrt/min/max/abs dentro da simulação (nada de
// sin/cos/hypot/ceil/floor/round no passo), então dois aparelhos que partem da mesma Mesa chegam ao mesmo resultado.
// Toda Mesa devolvida por este módulo fica "quantizada" na grade de 3 casas do codec, para que
// simular(decodificar(codificar(m)), t) seja idêntico a simular(m, t).
//
// Convenção dos eventos { k, n, t, ... }:
//   'bate'   : choque entre duas bolas. n = MENOR número do par, m = o maior. A branca é sempre n = 0, então a
//              "primeira bola tocada pela branca" é o m do primeiro 'bate' com n === 0. v = velocidade relativa.
//   'tabela' : n = bola que bateu na tabela, v = velocidade do impacto.
//   'caçapa' : n = bola encaçapada, c = índice da caçapa (0..5, ver CACAPAS).
//   t = tempo de simulação em segundos.

// ---------------------------------------------------------------------------------------------------------------
// Constantes e geometria
// ---------------------------------------------------------------------------------------------------------------

export const LARGURA = 2.0;
export const ALTURA = 1.0;
export const R = 0.045;
export const RAIO_CANTO = 1.9 * R;
export const RAIO_MEIO = 1.6 * R;

export type Cacapa = { x: number; y: number; r: number };
/** 0..3 = cantos (esq-cima, dir-cima, esq-baixo, dir-baixo); 4..5 = meio dos lados compridos (cima, baixo). */
export const CACAPAS: readonly Cacapa[] = [
  { x: 0, y: 0, r: RAIO_CANTO },
  { x: LARGURA, y: 0, r: RAIO_CANTO },
  { x: 0, y: ALTURA, r: RAIO_CANTO },
  { x: LARGURA, y: ALTURA, r: RAIO_CANTO },
  { x: LARGURA / 2, y: 0, r: RAIO_MEIO },
  { x: LARGURA / 2, y: ALTURA, r: RAIO_MEIO },
];

export const DT = 1 / 240; // passo fixo da física (s)
export const VEL_MAX = 5; // velocidade inicial da branca com forca = 1 (unidades/s)
export const ATRITO = 0.6; // desaceleração de rolamento constante (unidades/s²)
export const REST_TABELA = 0.75; // restituição na tabela (referência da pesquisa: 0,6–0,9)
export const REST_BOLAS = 0.95; // restituição bola-bola (Dr. Dave: 0,92–0,98); 1 = elástica ideal
export const LIMIAR_PARADO = 0.35 * R; // abaixo disto (~0,35 raio/s) a bola para
export const TEMPO_MAX = 30; // trava de segurança da simulação (s); na prática a mesa para em ~9 s
export const MARCA_CABECEIRA = { x: 0.5, y: 0.5 };
export const MARCA_PE = { x: 1.5, y: 0.5 }; // ponta do triângulo

const D = 2 * R;
const D2 = D * D;
const FOLGA = 1e-9;

// ---------------------------------------------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------------------------------------------

export type Grupo = 'lisas' | 'listradas' | null;
export type Bola = { n: number; x: number; y: number; dentro: boolean };
export type Fim = { vencedor: 0 | 1; motivo: string };
export type Mesa = {
  bolas: Bola[]; // bolas[n].n === n; 0 = branca, 1–7 lisas, 8 = oito, 9–15 listradas
  vez: 0 | 1;
  grupo: [Grupo, Grupo];
  bolaNaMao: boolean;
  fim: null | Fim;
  tacadas: number;
};
export type Evento = { k: 'bate' | 'tabela' | 'caçapa'; n: number; t: number; m?: number; c?: number; v?: number };
export type Tacada = { dx: number; dy: number; forca: number };
export type BolaDin = { n: number; x: number; y: number; vx: number; vy: number; dentro: boolean };
export type EstadoDin = { bolas: BolaDin[]; t: number; acc: number; eventos: Evento[] };
export type Quadro = { t: number; bolas: Bola[] };
export type Resultado = {
  mesa: Mesa;
  eventos: Evento[];
  quadros?: Quadro[];
  duracao: number;
  parou: boolean;
};
export type OpcoesSimular = { gravarACada?: number; tempoMax?: number };

// ---------------------------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------------------------

/** Quantiza na grade de milésimos (a mesma do codec). Fora da simulação. */
function q(v: number): number {
  return Math.round(v * 1000) / 1000;
}

export function grupoDe(n: number): Grupo {
  if (n >= 1 && n <= 7) return 'lisas';
  if (n >= 9 && n <= 15) return 'listradas';
  return null;
}

function oposto(g: 'lisas' | 'listradas'): 'lisas' | 'listradas' {
  return g === 'lisas' ? 'listradas' : 'lisas';
}

export function clonarMesa(m: Mesa): Mesa {
  return {
    bolas: m.bolas.map((b) => ({ n: b.n, x: b.x, y: b.y, dentro: b.dentro })),
    vez: m.vez,
    grupo: [m.grupo[0], m.grupo[1]],
    bolaNaMao: m.bolaNaMao,
    fim: m.fim ? { vencedor: m.fim.vencedor, motivo: m.fim.motivo } : null,
    tacadas: m.tacadas,
  };
}

/** Gerador pseudoaleatório pequeno (mulberry32), determinístico pela semente. Fora da física. */
function criarRng(semente: number): () => number {
  let a = (Number.isFinite(semente) ? Math.trunc(semente) : 0) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Mesa nova
// ---------------------------------------------------------------------------------------------------------------

/** Cria a mesa: triângulo padrão com a 8 no meio (3ª fila), resto sorteado pela semente, branca na cabeceira. */
export function novaMesa(semente: number): Mesa {
  const rng = criarRng(semente);
  // posições do triângulo (linha a linha). Espaçamentos em milésimos exatos: 0,080 em x e 0,092 em y (> 2R).
  const pos: { x: number; y: number }[] = [];
  for (let f = 0; f < 5; f++) {
    for (let k = 0; k <= f; k++) {
      pos.push({ x: q(MARCA_PE.x + f * 0.08), y: q(MARCA_PE.y + (2 * k - f) * 0.046) });
    }
  }
  const resto: number[] = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  for (let i = resto.length - 1; i > 0; i--) {
    const j = Math.trunc(rng() * (i + 1));
    const tmp = resto[i];
    resto[i] = resto[j];
    resto[j] = tmp;
  }
  const ordem: number[] = new Array(15);
  let c = 0;
  for (let i = 0; i < 15; i++) ordem[i] = i === 4 ? 8 : resto[c++];
  // cantos de trás (posições 10 e 14): um de cada grupo, como no jogo real
  if (grupoDe(ordem[10]) === grupoDe(ordem[14])) {
    for (let i = 0; i < 15; i++) {
      if (i === 4 || i === 10 || i === 14) continue;
      if (grupoDe(ordem[i]) !== grupoDe(ordem[10])) {
        const tmp = ordem[i];
        ordem[i] = ordem[14];
        ordem[14] = tmp;
        break;
      }
    }
  }
  const bolas: Bola[] = new Array(16);
  bolas[0] = { n: 0, x: MARCA_CABECEIRA.x, y: MARCA_CABECEIRA.y, dentro: false };
  for (let i = 0; i < 15; i++) {
    const n = ordem[i];
    bolas[n] = { n, x: pos[i].x, y: pos[i].y, dentro: false };
  }
  return { bolas, vez: 0, grupo: [null, null], bolaNaMao: false, fim: null, tacadas: 0 };
}

// ---------------------------------------------------------------------------------------------------------------
// Codec compacto (90 caracteres)
// ---------------------------------------------------------------------------------------------------------------

export const MOTIVOS: readonly string[] = [
  'Encaçapou a 8 depois de limpar o grupo',
  'Encaçapou a 8 antes de limpar o grupo',
  'Encaçapou a 8 com falta',
  'Fim de jogo',
];
const M_LIMPOU = 0;
const M_CEDO = 1;
const M_FALTA = 2;
const M_GENERICO = 3;

const SENT_DENTRO = 60466175; // 'zzzzz' em base 36; maior que qualquer posição válida (2.002.001)
const TAM_CODIGO = 90;

function pad36(v: number, n: number): string {
  let s = v.toString(36);
  while (s.length < n) s = '0' + s;
  return s;
}

/** Formato: 'B' vez g0 g1 mão fim(2) tacadas(3, base 36) + 16 × posição(5, base 36: x‰ × 1001 + y‰, 'zzzzz' = dentro). */
export function codificar(m: Mesa): string {
  const g = (x: Grupo): string => (x === 'lisas' ? 'l' : x === 'listradas' ? 't' : '-');
  let fim = '--';
  if (m.fim) {
    let i = MOTIVOS.indexOf(m.fim.motivo);
    if (i < 0) i = M_GENERICO;
    fim = String(m.fim.vencedor) + i.toString(36);
  }
  let s = 'B' + m.vez + g(m.grupo[0]) + g(m.grupo[1]) + (m.bolaNaMao ? '1' : '0') + fim;
  s += pad36(Math.min(46655, Math.max(0, Math.trunc(m.tacadas))), 3);
  for (let n = 0; n < 16; n++) {
    const b = m.bolas[n];
    if (b.dentro) s += 'zzzzz';
    else s += pad36(Math.round(b.x * 1000) * 1001 + Math.round(b.y * 1000), 5);
  }
  return s;
}

/** Lê o texto de codificar(); devolve null para qualquer lixo (tamanho, caracteres, valores ou estado incoerente). */
export function decodificar(s: string): Mesa | null {
  if (typeof s !== 'string' || s.length !== TAM_CODIGO) return null;
  if (!/^B[01][lt-][lt-][01](--|[01][0-9a-z])[0-9a-z]{3}[0-9a-z]{80}$/.test(s)) return null;
  const vez = s.charAt(1) === '0' ? 0 : 1;
  const gc = (c: string): Grupo => (c === 'l' ? 'lisas' : c === 't' ? 'listradas' : null);
  const g0 = gc(s.charAt(2));
  const g1 = gc(s.charAt(3));
  if ((g0 === null) !== (g1 === null)) return null;
  if (g0 !== null && g0 === g1) return null;
  const bolaNaMao = s.charAt(4) === '1';
  let fim: Fim | null = null;
  if (s.charAt(5) !== '-') {
    const mi = parseInt(s.charAt(6), 36);
    if (mi >= MOTIVOS.length) return null;
    fim = { vencedor: s.charAt(5) === '0' ? 0 : 1, motivo: MOTIVOS[mi] };
  } else if (s.charAt(6) !== '-') return null;
  const tacadas = parseInt(s.slice(7, 10), 36);
  const bolas: Bola[] = [];
  for (let n = 0; n < 16; n++) {
    const v = parseInt(s.slice(10 + n * 5, 15 + n * 5), 36);
    if (v === SENT_DENTRO) {
      bolas.push({ n, x: 0, y: 0, dentro: true });
      continue;
    }
    const xi = Math.trunc(v / 1001);
    const yi = v % 1001;
    if (xi > 2000) return null;
    bolas.push({ n, x: xi / 1000, y: yi / 1000, dentro: false });
  }
  if (bolas[0].dentro && !bolaNaMao) return null;
  for (let i = 0; i < 16; i++) {
    if (bolas[i].dentro) continue;
    for (let j = i + 1; j < 16; j++) {
      if (bolas[j].dentro) continue;
      const dx = bolas[i].x - bolas[j].x;
      const dy = bolas[i].y - bolas[j].y;
      if (dx * dx + dy * dy < R * R) return null; // sobrepostas pela metade: lixo
    }
  }
  return { bolas, vez, grupo: [g0, g1], bolaNaMao, fim, tacadas };
}

// ---------------------------------------------------------------------------------------------------------------
// Posicionar a branca (bola na mão)
// ---------------------------------------------------------------------------------------------------------------

function livre(bolas: readonly { n: number; x: number; y: number; dentro: boolean }[], x: number, y: number): boolean {
  if (!(x >= R && x <= LARGURA - R && y >= R && y <= ALTURA - R)) return false;
  for (const c of CACAPAS) {
    const dx = x - c.x;
    const dy = y - c.y;
    const r = c.r + 0.005;
    if (dx * dx + dy * dy <= r * r) return false;
  }
  for (const b of bolas) {
    if (b.n === 0 || b.dentro) continue;
    const dx = x - b.x;
    const dy = y - b.y;
    if (dx * dx + dy * dy < D2 - FOLGA) return false;
  }
  return true;
}

/** Posição válida para a branca: dentro da mesa, fora das bocas das caçapas e sem encostar em outra bola. */
export function posicaoLivre(m: Mesa, x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && livre(m.bolas, q(x), q(y));
}

/** Põe a branca em (x, y) se houver bola na mão e a posição for livre. Devolve a Mesa nova ou null. */
export function posicionarBranca(m: Mesa, x: number, y: number): Mesa | null {
  if (!m.bolaNaMao || m.fim) return null;
  if (!posicaoLivre(m, x, y)) return null;
  const novo = clonarMesa(m);
  novo.bolas[0] = { n: 0, x: q(x), y: q(y), dentro: false };
  return novo;
}

/** Lugar de reserva para a branca: a cabeceira, ou o primeiro ponto livre de uma grade. */
function lugarLivre(m: Mesa): { x: number; y: number } {
  if (livre(m.bolas, MARCA_CABECEIRA.x, MARCA_CABECEIRA.y)) return { x: MARCA_CABECEIRA.x, y: MARCA_CABECEIRA.y };
  for (let i = 1; i <= 19; i++) {
    for (let j = 1; j <= 9; j++) {
      const x = q(i * 0.1);
      const y = q(j * 0.1);
      if (livre(m.bolas, x, y)) return { x, y };
    }
  }
  return { x: MARCA_CABECEIRA.x, y: MARCA_CABECEIRA.y };
}

// ---------------------------------------------------------------------------------------------------------------
// Física (estado dinâmico)
// ---------------------------------------------------------------------------------------------------------------

/** Monta o estado dinâmico de uma tacada. Não muta a mesa de entrada. */
export function iniciarTacada(m: Mesa, tac: Tacada): EstadoDin {
  const bolas: BolaDin[] = m.bolas.map((b) => ({ n: b.n, x: b.x, y: b.y, vx: 0, vy: 0, dentro: b.dentro }));
  const br = bolas[0];
  if (br.dentro) {
    const p = lugarLivre(m);
    br.x = p.x;
    br.y = p.y;
    br.dentro = false;
  }
  let forca = tac.forca;
  if (!Number.isFinite(forca)) forca = 0;
  forca = Math.min(1, Math.max(0, forca));
  const len = Math.sqrt(tac.dx * tac.dx + tac.dy * tac.dy);
  if (Number.isFinite(len) && len > 1e-9 && forca > 0) {
    const v = forca * VEL_MAX;
    br.vx = (tac.dx / len) * v;
    br.vy = (tac.dy / len) * v;
  }
  return { bolas, t: 0, acc: 0, eventos: [] };
}

/** Há alguma bola em movimento? */
export function emMovimento(e: EstadoDin): boolean {
  for (const b of e.bolas) if (!b.dentro && (b.vx !== 0 || b.vy !== 0)) return true;
  return false;
}

function subpasso(e: EstadoDin, h: number): void {
  const bolas = e.bolas;
  const nb = bolas.length;
  const t = e.t;
  // 1) atrito de rolamento constante + movimento
  const moveu: boolean[] = [];
  for (let i = 0; i < nb; i++) {
    const b = bolas[i];
    moveu.push(false);
    if (b.dentro || (b.vx === 0 && b.vy === 0)) continue;
    const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const ns = sp - ATRITO * h;
    if (ns < LIMIAR_PARADO) {
      b.vx = 0;
      b.vy = 0;
      continue;
    }
    const f = ns / sp;
    b.vx *= f;
    b.vy *= f;
    b.x += b.vx * h;
    b.y += b.vy * h;
    moveu[i] = true;
  }
  // 2) caçapas: só captura bola que se moveu (bola parada não é "afundada" por arredondamento)
  for (let i = 0; i < nb; i++) {
    if (!moveu[i]) continue;
    const b = bolas[i];
    for (let c = 0; c < CACAPAS.length; c++) {
      const cp = CACAPAS[c];
      const dx = b.x - cp.x;
      const dy = b.y - cp.y;
      if (dx * dx + dy * dy < cp.r * cp.r) {
        b.dentro = true;
        b.vx = 0;
        b.vy = 0;
        b.x = cp.x;
        b.y = cp.y;
        e.eventos.push({ k: 'caçapa', n: b.n, t, c });
        break;
      }
    }
  }
  // 3) tabelas (quique com restituição; a boca da caçapa já foi tratada acima: ali a bola cai, não quica)
  for (let i = 0; i < nb; i++) {
    const b = bolas[i];
    if (b.dentro) continue;
    let bateu = 0;
    if (b.x < R) {
      b.x = R;
      if (b.vx < 0) {
        bateu = -b.vx;
        b.vx = -b.vx * REST_TABELA;
      }
    } else if (b.x > LARGURA - R) {
      b.x = LARGURA - R;
      if (b.vx > 0) {
        bateu = b.vx;
        b.vx = -b.vx * REST_TABELA;
      }
    }
    if (b.y < R) {
      b.y = R;
      if (b.vy < 0) {
        const v = -b.vy;
        if (v > bateu) bateu = v;
        b.vy = -b.vy * REST_TABELA;
      }
    } else if (b.y > ALTURA - R) {
      b.y = ALTURA - R;
      if (b.vy > 0) {
        if (b.vy > bateu) bateu = b.vy;
        b.vy = -b.vy * REST_TABELA;
      }
    }
    if (bateu > 0.05) e.eventos.push({ k: 'tabela', n: b.n, t, v: bateu });
  }
  // 4) colisões bola-bola (elásticas, massas iguais): troca a componente normal e separa as sobrepostas.
  for (let passe = 0; passe < 4; passe++) {
    let mexeu = false;
    for (let i = 0; i < nb; i++) {
      const a = bolas[i];
      if (a.dentro) continue;
      for (let j = i + 1; j < nb; j++) {
        const c = bolas[j];
        if (c.dentro) continue;
        const dx = c.x - a.x;
        if (dx >= D || dx <= -D) continue;
        const dy = c.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= D2) continue;
        const d = Math.sqrt(d2);
        let nx = 1;
        let ny = 0;
        if (d > 1e-9) {
          nx = dx / d;
          ny = dy / d;
        }
        const meio = (D - d) / 2 + FOLGA;
        a.x -= nx * meio;
        a.y -= ny * meio;
        c.x += nx * meio;
        c.y += ny * meio;
        const rvn = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        if (rvn > 1e-6) {
          const imp = (rvn * (1 + REST_BOLAS)) / 2; // massas iguais: cada bola recebe metade do impulso
          a.vx -= imp * nx;
          a.vy -= imp * ny;
          c.vx += imp * nx;
          c.vy += imp * ny;
          e.eventos.push({ k: 'bate', n: a.n < c.n ? a.n : c.n, m: a.n < c.n ? c.n : a.n, t, v: rvn });
        }
        mexeu = true;
      }
    }
    if (!mexeu) break;
  }
  // 5) a separação pode ter empurrado alguém contra a tabela: reenquadra (sem quique)
  for (let i = 0; i < nb; i++) {
    const b = bolas[i];
    if (b.dentro) continue;
    if (b.x < R) b.x = R;
    else if (b.x > LARGURA - R) b.x = LARGURA - R;
    if (b.y < R) b.y = R;
    else if (b.y > ALTURA - R) b.y = ALTURA - R;
  }
}

/** Um quantum fixo de DT, em sub-passos se a bola mais rápida andaria mais que R/2 por sub-passo. */
function quantum(e: EstadoDin): void {
  let v2 = 0;
  for (const b of e.bolas) {
    if (b.dentro) continue;
    const s = b.vx * b.vx + b.vy * b.vy;
    if (s > v2) v2 = s;
  }
  const vmax = Math.sqrt(v2);
  let nsub = 1;
  while (nsub < 64 && (vmax * DT) / nsub > R / 2) nsub++;
  const h = DT / nsub;
  e.t += DT;
  for (let s = 0; s < nsub; s++) subpasso(e, h);
}

/**
 * Avança a física em `dt` segundos de tempo real (padrão DT). O tempo é consumido em quanta fixos de DT guardados
 * num acumulador do estado, então o resultado final NÃO depende de como o dt foi fatiado (60 fps, 144 fps, irregular).
 * Devolve true enquanto ainda houver bola se mexendo.
 */
export function passoFisica(e: EstadoDin, dt: number = DT): boolean {
  if (!(dt > 0)) return emMovimento(e);
  e.acc += dt;
  while (e.acc >= DT * (1 - 1e-9) && emMovimento(e)) {
    e.acc -= DT;
    quantum(e);
  }
  if (!emMovimento(e)) e.acc = 0;
  return emMovimento(e);
}

/** Retrato do estado dinâmico como Mesa (posições quantizadas; bola na caçapa vira x = y = 0). */
export function mesaDoEstado(antes: Mesa, e: EstadoDin): Mesa {
  const m = clonarMesa(antes);
  for (let i = 0; i < 16; i++) {
    const b = e.bolas[i];
    m.bolas[i] = b.dentro ? { n: i, x: 0, y: 0, dentro: true } : { n: i, x: q(b.x), y: q(b.y), dentro: false };
  }
  return m;
}

/** Fecha a tacada: pega o estado final da física e aplica as regras. Usada por `simular` e pela UI quadro a quadro. */
export function fecharTacada(antes: Mesa, e: EstadoDin): { mesa: Mesa; eventos: Evento[] } {
  const depois = mesaDoEstado(antes, e);
  const eventos = e.eventos.map((v) => ({ ...v }));
  return { mesa: aplicarRegras(antes, depois, eventos), eventos };
}

/**
 * Simula uma tacada inteira. Não muta `m`. `aoPasso` é chamado a cada quantum (estado dinâmico vivo: não guarde a
 * referência). Com `opcoes.gravarACada = N` devolve também `quadros` (um a cada N quanta, mais o inicial e o final).
 */
export function simular(
  m: Mesa,
  tac: Tacada,
  aoPasso?: (e: EstadoDin) => void,
  opcoes?: OpcoesSimular,
): Resultado {
  if (m.fim) return { mesa: clonarMesa(m), eventos: [], duracao: 0, parou: true };
  const e = iniciarTacada(m, tac);
  const tmax = opcoes && opcoes.tempoMax !== undefined ? opcoes.tempoMax : TEMPO_MAX;
  const grav = opcoes && opcoes.gravarACada && opcoes.gravarACada > 0 ? Math.trunc(opcoes.gravarACada) : 0;
  const quadros: Quadro[] | undefined = grav ? [] : undefined;
  const foto = (): void => {
    if (quadros) quadros.push({ t: e.t, bolas: mesaDoEstado(m, e).bolas });
  };
  foto();
  let passos = 0;
  while (emMovimento(e) && e.t < tmax) {
    passoFisica(e, DT);
    passos++;
    if (aoPasso) aoPasso(e);
    if (grav && passos % grav === 0) foto();
  }
  if (grav && passos % grav !== 0) foto();
  const parou = !emMovimento(e);
  const f = fecharTacada(m, e);
  const r: Resultado = { mesa: f.mesa, eventos: f.eventos, duracao: e.t, parou };
  if (quadros) r.quadros = quadros;
  return r;
}

// ---------------------------------------------------------------------------------------------------------------
// Regras casuais da bola 8
// ---------------------------------------------------------------------------------------------------------------

/** Bolas do grupo `g` ainda na mesa (segundo `mesa`). */
function restantesDo(mesa: Mesa, g: 'lisas' | 'listradas'): number[] {
  const r: number[] = [];
  for (let n = 1; n <= 15; n++) if (n !== 8 && grupoDe(n) === g && !mesa.bolas[n].dentro) r.push(n);
  return r;
}

/**
 * Aplica as regras a uma tacada já simulada. `antes` = mesa antes da tacada; `depois` = posições finais (dentro/x/y);
 * `eventos` = eventos da tacada em ordem. Devolve a Mesa nova (vez, grupos, bola na mão, fim, tacadas).
 *
 * Decisões onde o pedido deixa margem (documentadas):
 *  - bolas encaçapadas na quebra (tacadas === 0) não definem grupo, e quem as fez (sem falta) continua;
 *  - falta com bola encaçapada e mesa aberta: a bola fica fora e os grupos continuam abertos;
 *  - "limpou o grupo" vale pela mesa ANTES da tacada: encaçapar a última do grupo e a 8 juntas = derrota;
 *  - a 8 encaçapada em qualquer momento sem grupo limpo (inclusive na quebra) = derrota; com falta = derrota.
 */
export function aplicarRegras(antes: Mesa, depois: Mesa, eventos: readonly Evento[]): Mesa {
  if (antes.fim) return clonarMesa(antes);
  const m = clonarMesa(depois);
  const eu = antes.vez;
  const ele: 0 | 1 = eu === 0 ? 1 : 0;
  m.vez = eu;
  m.grupo = [antes.grupo[0], antes.grupo[1]];
  m.fim = null;
  m.bolaNaMao = false;
  m.tacadas = antes.tacadas + 1;

  const caiu: number[] = [];
  for (const ev of eventos) if (ev.k === 'caçapa' && caiu.indexOf(ev.n) < 0) caiu.push(ev.n);
  const brancaCaiu = caiu.indexOf(0) >= 0;
  let primeira = -1;
  for (const ev of eventos) {
    if (ev.k === 'bate' && ev.n === 0 && ev.m !== undefined) {
      primeira = ev.m;
      break;
    }
  }

  const gEu = antes.grupo[eu];
  const limpou = gEu !== null && restantesDo(antes, gEu).length === 0;
  const legal = (n: number): boolean => {
    if (gEu === null) return n !== 8;
    if (limpou) return n === 8;
    return grupoDe(n) === gEu;
  };
  const falta = brancaCaiu || primeira < 0 || !legal(primeira);

  // a 8 caiu: acaba o jogo
  if (caiu.indexOf(8) >= 0) {
    const venceu = !falta && limpou;
    const motivo = falta ? M_FALTA : venceu ? M_LIMPOU : M_CEDO;
    m.fim = { vencedor: venceu ? eu : ele, motivo: MOTIVOS[motivo] };
    return m;
  }

  // grupos: a primeira bola encaçapada depois da quebra, em tacada sem falta
  if (!falta && antes.grupo[eu] === null && antes.tacadas > 0) {
    for (const n of caiu) {
      const g = grupoDe(n);
      if (n !== 0 && g !== null) {
        m.grupo[eu] = g;
        m.grupo[ele] = oposto(g);
        break;
      }
    }
  }

  if (falta) {
    m.vez = ele;
    m.bolaNaMao = true;
    return m;
  }
  const gAgora = m.grupo[eu];
  let acertou = false;
  for (const n of caiu) {
    if (n === 0) continue;
    if (gAgora === null || grupoDe(n) === gAgora) acertou = true;
  }
  m.vez = acertou ? eu : ele;
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// Bot (ghost ball)
// ---------------------------------------------------------------------------------------------------------------

export type NivelBot = 'facil' | 'medio' | 'dificil';
export type JogadaBot = { dx: number; dy: number; forca: number; branca?: { x: number; y: number } };

type Cand = { n: number; dx: number; dy: number; d1: number; d2: number; cos: number; fac: number };
type Pt = { n: number; x: number; y: number };

const TEMPO_SIM_BOT = 6; // s de simulação por candidato (o suficiente para ver quem cai e onde a branca para)
const RUIDO = {
  facil: { ang: 0.052, forca: 0.15 }, // 3°
  medio: { ang: 0.021, forca: 0.08 }, // 1,2°
  dificil: { ang: 0.007, forca: 0.03 }, // 0,4°
};

/** Distância do ponto (px,py) ao segmento (ax,ay)-(bx,by). */
function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy;
  let u = l2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
  u = Math.min(1, Math.max(0, u));
  const cx = ax + u * vx - px;
  const cy = ay + u * vy - py;
  return Math.sqrt(cx * cx + cy * cy);
}

/** Números das bolas que a vez atual pode tocar primeiro (e tentar encaçapar). */
function alvosLegais(m: Mesa): number[] {
  const g = m.grupo[m.vez];
  const r: number[] = [];
  if (g === null) {
    for (let n = 1; n <= 15; n++) if (n !== 8 && !m.bolas[n].dentro) r.push(n);
    return r;
  }
  for (const n of restantesDo(m, g)) r.push(n);
  if (r.length === 0 && !m.bolas[8].dentro) r.push(8);
  return r;
}

/** Tacadas "ghost ball" possíveis da branca em (cx,cy), ordenadas da mais fácil para a mais difícil. */
function candidatos(bolas: readonly Bola[], cx: number, cy: number, alvos: readonly number[]): Cand[] {
  const mesa: Pt[] = [];
  for (const b of bolas) if (b.n !== 0 && !b.dentro) mesa.push({ n: b.n, x: b.x, y: b.y });
  const out: Cand[] = [];
  for (const n of alvos) {
    const t = bolas[n];
    if (t.dentro) continue;
    for (const p of CACAPAS) {
      const vx = p.x - t.x;
      const vy = p.y - t.y;
      const d2 = Math.sqrt(vx * vx + vy * vy);
      if (d2 < 1e-6) continue;
      const ux = vx / d2;
      const uy = vy / d2;
      const gx = t.x - D * ux;
      const gy = t.y - D * uy;
      if (gx < R || gx > LARGURA - R || gy < R || gy > ALTURA - R) continue; // a branca não chega lá
      const ax = gx - cx;
      const ay = gy - cy;
      const d1 = Math.sqrt(ax * ax + ay * ay);
      if (d1 < 1e-6) continue;
      const dx = ax / d1;
      const dy = ay / d1;
      const cos = dx * ux + dy * uy;
      if (cos < 0.25) continue; // corte fino demais
      let livreCam = true;
      for (const o of mesa) {
        if (o.n === n) continue;
        if (distSeg(o.x, o.y, cx, cy, gx, gy) < D - 0.002 || distSeg(o.x, o.y, t.x, t.y, p.x, p.y) < D - 0.002) {
          livreCam = false;
          break;
        }
      }
      if (!livreCam) continue;
      out.push({ n, dx, dy, d1, d2, cos, fac: cos / (1 + d1 + 2 * d2) });
    }
  }
  out.sort((a, b) => b.fac - a.fac);
  return out;
}

/** Força que faz a bola-alvo chegar à caçapa com velocidade `extra` (somada à necessária) depois do choque. */
function forcaPara(c: Cand, extra: number): number {
  const cosv = Math.max(c.cos, 0.3);
  const vt = Math.sqrt(2 * ATRITO * c.d2) + extra; // (a perda de 5% no choque entra na folga `extra`)
  const vc = vt / cosv;
  const v0 = Math.sqrt(vc * vc + 2 * ATRITO * c.d1);
  return Math.min(1, Math.max(0.08, v0 / VEL_MAX));
}

/** Facilidade (0..~0.6) da melhor tacada de quem está na vez, com a branca onde ela parou. */
function facilidadeMesa(f: Mesa): number {
  if (f.fim || f.bolas[0].dentro) return 0;
  const cs = candidatos(f.bolas, f.bolas[0].x, f.bolas[0].y, alvosLegais(f));
  return cs.length ? cs[0].fac : 0;
}

/** Nota de uma tacada simulada, do ponto de vista de quem atirou. */
function pontuar(antes: Mesa, r: Resultado): number {
  const f = r.mesa;
  const eu = antes.vez;
  if (f.fim) return f.fim.vencedor === eu ? 10000 : -10000;
  const gEu = f.grupo[eu];
  let meus = 0;
  let dele = 0;
  for (const ev of r.eventos) {
    if (ev.k !== 'caçapa' || ev.n === 0 || ev.n === 8) continue;
    if (gEu === null || grupoDe(ev.n) === gEu) meus++;
    else dele++;
  }
  let s = meus * 80 - dele * 60;
  if (f.bolaNaMao) return s - 300; // falta
  if (f.vez === eu) {
    s += 40 + 80 * facilidadeMesa(f);
  } else {
    s -= 10 + 30 * facilidadeMesa(f); // não vale entregar mesa fácil ao adversário
  }
  const br = f.bolas[0];
  for (const c of CACAPAS) {
    const dx = br.x - c.x;
    const dy = br.y - c.y;
    if (dx * dx + dy * dy < 9 * R * R) s -= 15; // branca parada perto de caçapa
  }
  return s;
}

/** Gira (dx,dy) por um ângulo pequeno eps (rad) sem sin/cos e renormaliza. */
function girar(dx: number, dy: number, eps: number): { dx: number; dy: number } {
  const nx = dx - eps * dy;
  const ny = dy + eps * dx;
  const l = Math.sqrt(nx * nx + ny * ny);
  return { dx: nx / l, dy: ny / l };
}

function gauss(rng: () => number): number {
  return (rng() + rng() + rng() + rng() - 2) * 1.7320508075688772;
}

/** Tacadas de segurança: bate numa bola legal com força justa, desviando do caminho bloqueado. */
function segurancas(m: Mesa, alvos: readonly number[], mais: boolean): Tacada[] {
  const c = m.bolas[0];
  const ordem = alvos.slice().sort((a, b) => {
    const da = (m.bolas[a].x - c.x) ** 2 + (m.bolas[a].y - c.y) ** 2;
    const db = (m.bolas[b].x - c.x) ** 2 + (m.bolas[b].y - c.y) ** 2;
    return da - db;
  });
  const out: Tacada[] = [];
  for (const n of ordem.slice(0, 3)) {
    const t = m.bolas[n];
    const vx = t.x - c.x;
    const vy = t.y - c.y;
    const d = Math.sqrt(vx * vx + vy * vy);
    if (d < 1e-6) continue;
    const ux = vx / d;
    const uy = vy / d;
    const f = Math.min(1, Math.max(0.1, (Math.sqrt(2 * ATRITO * (d + 0.1)) + 0.1) / VEL_MAX));
    for (const off of [0, 1.4 * R, -1.4 * R]) {
      const px = t.x - uy * off; // ponto de mira, deslocado de lado
      const py = t.y + ux * off;
      let ok = true;
      for (const o of m.bolas) {
        if (o.n === 0 || o.n === n || o.dentro) continue;
        if (distSeg(o.x, o.y, c.x, c.y, px, py) < D - 0.002) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const ax = px - c.x;
      const ay = py - c.y;
      const l = Math.sqrt(ax * ax + ay * ay);
      out.push({ dx: ax / l, dy: ay / l, forca: f });
      if (mais) out.push({ dx: ax / l, dy: ay / l, forca: Math.min(1, f * 1.7) });
      break;
    }
  }
  if (out.length === 0 && ordem.length > 0) {
    const t = m.bolas[ordem[0]];
    const vx = t.x - c.x;
    const vy = t.y - c.y;
    const l = Math.sqrt(vx * vx + vy * vy) || 1;
    out.push({ dx: vx / l, dy: vy / l, forca: 0.35 });
  }
  return out;
}

/** Escolhe onde pôr a branca: avalia uma grade só pela geometria (sem simular) e fica com a mais fácil. */
function escolherBranca(m: Mesa, nivel: NivelBot, rng: () => number): { x: number; y: number } {
  const alvos = alvosLegais(m);
  const pts: { x: number; y: number; fac: number }[] = [];
  for (let i = 1; i <= 15; i++) {
    for (let j = 1; j <= 7; j++) {
      const x = q(i * 0.12);
      const y = q(j * 0.12);
      if (!livre(m.bolas, x, y)) continue;
      const cs = candidatos(m.bolas, x, y, alvos);
      pts.push({ x, y, fac: cs.length ? cs[0].fac : 0 });
    }
  }
  if (pts.length === 0) return lugarLivre(m);
  pts.sort((a, b) => b.fac - a.fac);
  if (nivel === 'facil') {
    const k = Math.min(pts.length, 12);
    const p = pts[Math.trunc(rng() * k)];
    return { x: p.x, y: p.y };
  }
  return { x: pts[0].x, y: pts[0].y };
}

/** Escolhe a tacada (sem ruído) para uma mesa em que a branca já está posicionada. */
function planejar(mesa: Mesa, nivel: NivelBot, rng: () => number): Tacada {
  const c0 = mesa.bolas[0];
  // quebra: bate com força na ponta do triângulo
  if (mesa.tacadas === 0) {
    let ponta = -1;
    for (let n = 1; n <= 15; n++) {
      if (mesa.bolas[n].dentro) continue;
      if (ponta < 0 || mesa.bolas[n].x < mesa.bolas[ponta].x) ponta = n;
    }
    if (ponta > 0) {
      const vx = mesa.bolas[ponta].x - c0.x;
      const vy = mesa.bolas[ponta].y - c0.y;
      const l = Math.sqrt(vx * vx + vy * vy) || 1;
      return { dx: vx / l, dy: vy / l, forca: nivel === 'dificil' ? 1 : nivel === 'medio' ? 0.85 : 0.7 };
    }
  }
  const alvos = alvosLegais(mesa);
  const cs = candidatos(mesa.bolas, c0.x, c0.y, alvos);

  if (nivel === 'facil') {
    if (cs.length === 0) return segurancas(mesa, alvos, false)[0] ?? { dx: 1, dy: 0, forca: 0.3 };
    const c = cs[Math.trunc(rng() * Math.min(3, cs.length))];
    return { dx: c.dx, dy: c.dy, forca: forcaPara(c, 0.5 + rng() * 0.9) };
  }

  const topo = nivel === 'medio' ? 10 : 20;
  const extras = nivel === 'medio' ? [0.6] : [0.35, 1.1];
  let melhor: Tacada | null = null;
  let melhorS = -Infinity;
  const tentar = (t: Tacada): void => {
    const s = pontuar(mesa, simular(mesa, t, undefined, { tempoMax: TEMPO_SIM_BOT }));
    if (s > melhorS) {
      melhorS = s;
      melhor = t;
    }
  };
  for (const c of cs.slice(0, topo)) {
    for (const ex of extras) tentar({ dx: c.dx, dy: c.dy, forca: forcaPara(c, ex) });
  }
  // sem tacada que encaçape do grupo: compara com as de segurança
  if (melhor === null || melhorS < 60) {
    for (const t of segurancas(mesa, alvos, nivel === 'dificil')) tentar(t);
  }
  return melhor ?? { dx: 1, dy: 0, forca: 0.3 };
}

/**
 * Pensa a jogada do bot. Determinístico pela semente. Com bola na mão devolve também `branca` (onde pô-la, já
 * validado por posicionarBranca); a tacada devolvida vale para a branca nessa posição.
 * Custo limitado por contagem (nunca pelo relógio): no máximo ~45 simulações de até 6 s de mesa no nível difícil (20 candidatos × 2 forças + segurança).
 */
export function pensarBot(m: Mesa, nivel: NivelBot, semente: number): JogadaBot {
  const rng = criarRng(semente);
  if (m.fim) return { dx: 1, dy: 0, forca: 0 };
  let mesa = m;
  let branca: { x: number; y: number } | undefined;
  if (m.bolaNaMao || m.bolas[0].dentro) {
    let pos = escolherBranca(m, nivel, rng);
    let novo = m.bolaNaMao ? posicionarBranca(m, pos.x, pos.y) : null;
    if (novo === null) {
      pos = lugarLivre(m);
      novo = m.bolaNaMao ? posicionarBranca(m, pos.x, pos.y) : null;
    }
    if (novo !== null) {
      mesa = novo;
      branca = { x: pos.x, y: pos.y };
    }
  }
  const base = planejar(mesa, nivel, rng);
  const ru = RUIDO[nivel];
  const g = girar(base.dx, base.dy, gauss(rng) * ru.ang);
  const forca = Math.min(1, Math.max(0.05, base.forca * (1 + gauss(rng) * ru.forca)));
  const out: JogadaBot = { dx: g.dx, dy: g.dy, forca };
  if (branca) out.branca = branca;
  return out;
}
