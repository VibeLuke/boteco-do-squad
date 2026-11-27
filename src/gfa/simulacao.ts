/**
 * Dimensão GFA ("Grand Fiado Auto"), Fatia 4, lote F. A simulação é pura (sem three.js e sem DOM): passo fixo,
 * sorteio com semente, testável no Node. O three.js só desenha o que sai daqui.
 *
 * - Cidade em grade: quarteirões de prédio com calçada em volta, ruas entre eles, muro em volta de tudo.
 * - Carro: modelo de bicicleta (duas rodas virtuais), aceleração, ré, freio e um pouco de derrapagem nas curvas.
 * - Pedestres andam pelas calçadas; quem é atropelado voa, cai e volta depois em outro canto.
 * - Boletos (o nível de procurado): cada atropelo soma; a polícia sai atrás e, se te cercar, a corrida acaba (presa).
 * - A corrida dura 90 s; volta com grana (R$ 5 por morte + bônus de marco, sem teto) e as mortes entram na sua ficha.
 * - Fatia 6: cenário destrutível, civis com vida (pegam fogo e explodem), polícia que atira e a sua vida.
 */

export const DT_GFA = 1 / 60;
export const DURACAO_MS = 90_000;
/** Fatia 6: sem teto. R$ 5 por morte, mais o bônus de cada marco; presa ou destruído leva metade. */
export const GRANA_POR_MORTE = 5;
/** Nome antigo (Fatia 5), mesmo valor. */
export const GRANA_POR_ATROPELO = GRANA_POR_MORTE;
export const MARCOS: readonly { mortes: number; bonus: number }[] = [
  { mortes: 10, bonus: 20 },
  { mortes: 25, bonus: 50 },
  { mortes: 50, bonus: 120 },
  { mortes: 100, bonus: 300 },
];
/** Soma dos bônus dos marcos já atingidos. */
export function bonusMarcos(mortes: number): number {
  return MARCOS.reduce((s, m) => s + (mortes >= m.mortes ? m.bonus : 0), 0);
}
/** O próximo marco a bater (null se já passou de todos). */
export function proximoMarco(mortes: number): { mortes: number; bonus: number } | null {
  return MARCOS.find((m) => mortes < m.mortes) ?? null;
}
/** Fatia 6: vida do seu carro, civis e viaturas; polícia que atira; explosão; cenário. */
export const VIDA_MAX = 100;
export const VIDA_CIVIL = 40;
export const VIDA_VIATURA = 60;
export const POLICIA_BOLETOS = 2;
export const POLICIA_ALCANCE = 25;
export const POLICIA_CADENCIA_MS = 1200;
export const POLICIA_DANO_MIN = 4;
export const POLICIA_DANO_MAX = 8;
export const RAIO_EXPLOSAO = 6;
export const FOGO_MS = 1000;
export const VEL_QUEBRA = 4;
/** Objetos nas calçadas e as obras no meio da rua (cones na linha do meio, entre as duas faixas). */
export const N_OBJETOS = 300;
export const N_OBRAS = 24;
export const CONES_POR_OBRA = 4;
/** Intervalo mínimo entre duas idas ao portal (o Rocky precisa recarregar). */
export const ESPERA_PORTAL_MS = 5 * 60_000;

/* ------------------------------------------------------------------ a cidade */

/** Tamanho de um quarteirão com a rua (unidades), quantos por lado, largura da rua e da calçada. */
export const BLOCO = 24;
export const BLOCOS = 8;
export const RUA = 10;
export const CALCADA = 2.5;
export const MUNDO = BLOCO * BLOCOS + RUA;

/** Onde começa o prédio dentro da célula (a rua fica na borda de cada célula). */
const P0 = RUA + CALCADA;
const P1 = BLOCO - CALCADA;

/** Está dentro de um prédio? (as calçadas e as ruas são livres) */
export function predio(x: number, z: number): boolean {
  if (x < RUA || z < RUA || x > MUNDO - RUA || z > MUNDO - RUA) return false;
  const lx = x % BLOCO;
  const lz = z % BLOCO;
  return lx > P0 && lx < P1 && lz > P0 && lz < P1;
}
export function foraDoMundo(x: number, z: number): boolean {
  return x < 1 || z < 1 || x > MUNDO - 1 || z > MUNDO - 1;
}
/** Altura do prédio de cada quarteirão (para o desenho), igual sempre. */
export function alturaPredio(i: number, j: number): number {
  return 6 + (hash(i * 31 + j * 7 + 3) % 22);
}

/* ------------------------------------------------------------------ sorteio */

function hash(n: number): number {
  let h = (n | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
function rng(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ estado */

export interface Carro {
  x: number;
  z: number;
  /** Para onde o carro aponta (rad; 0 = +z). */
  ang: number;
  vel: number;
  /** Velocidade de lado (derrapagem), que o atrito some. */
  lado: number;
  /** Ângulo das rodas da frente (para o desenho). */
  roda: number;
}

export interface Pedestre {
  id: number;
  /** Qual boneco do bar ele usa (índice na lista de aparências). */
  look: number;
  x: number;
  z: number;
  /** Direção em que anda pela calçada. */
  dx: number;
  dz: number;
  estado: 'anda' | 'voa' | 'caido';
  vx: number;
  vz: number;
  /** Altura (voando) e velocidade para cima. */
  y: number;
  vy: number;
  /** Quando volta (caído). */
  volta: number;
  giro: number;
}

export interface Viatura extends Carro {
  id: number;
  /** Fatia 6: vida, próximo tiro em você (ms) e o descanso entre duas batidas. */
  vida: number;
  proxTiro: number;
  proxDano: number;
}

/** Fatia 6: objetos do cenário que o carro derruba. */
export type TipoObjeto = 'poste' | 'hidrante' | 'lixeira' | 'banca' | 'banco' | 'arvore' | 'cone' | 'orelhao' | 'placa' | 'ponto';
export interface InfoObjeto {
  vida: number;
  /** Raio da base (m). */
  raio: number;
  /** Fração da velocidade que o carro perde ao quebrar (poste e árvore seguram mais). */
  peso: number;
  /** Fica no meio da calçada (os outros, rente à rua). */
  grande: boolean;
  /** Peso do sorteio. */
  freq: number;
}
export const OBJETOS: Record<TipoObjeto, InfoObjeto> = {
  poste: { vida: 20, raio: 0.3, peso: 0.22, grande: false, freq: 14 },
  hidrante: { vida: 10, raio: 0.4, peso: 0.1, grande: false, freq: 9 },
  lixeira: { vida: 8, raio: 0.45, peso: 0.07, grande: false, freq: 16 },
  banca: { vida: 26, raio: 1.2, peso: 0.16, grande: true, freq: 4 },
  banco: { vida: 14, raio: 0.9, peso: 0.1, grande: false, freq: 10 },
  arvore: { vida: 28, raio: 0.6, peso: 0.3, grande: false, freq: 14 },
  cone: { vida: 3, raio: 0.35, peso: 0.03, grande: false, freq: 12 },
  orelhao: { vida: 9, raio: 0.45, peso: 0.08, grande: false, freq: 6 },
  placa: { vida: 8, raio: 0.3, peso: 0.08, grande: false, freq: 9 },
  ponto: { vida: 26, raio: 1.2, peso: 0.16, grande: true, freq: 3 },
};
export const TIPOS_OBJETO = Object.keys(OBJETOS) as TipoObjeto[];
export interface Objeto {
  id: number;
  tipo: TipoObjeto;
  x: number;
  z: number;
  /** Giro em Y (0 = comprimento ao longo de x). */
  ang: number;
  vida: number;
  estado: 'inteiro' | 'quebrado';
  /** Hidrante quebrado: até quando solta o jato d'água. */
  jatoAte: number;
}
/** Vidro de loja no térreo, colado na fachada; `eixo` é a direção em que ele corre. */
export interface Vitrine {
  id: number;
  x: number;
  z: number;
  eixo: 'x' | 'z';
  comp: number;
  estado: 'inteira' | 'quebrada';
}

/** Carro civil (Fatia 5): anda na faixa da rua, num eixo; bateu, fica rodando parado um tempo. */
export interface Civil {
  id: number;
  x: number;
  z: number;
  /** Eixo em que anda ('x' ou 'z') e o sentido (1 ou -1). */
  eixo: 'x' | 'z';
  sentido: number;
  vel: number;
  ang: number;
  cor: number;
  /** Até quando fica parado girando depois de uma batida. */
  batidoAte: number;
  giro: number;
  /** Tranco da batida (m/s): o carro batido desliza para fora do caminho e para aos poucos. */
  kx: number;
  kz: number;
  /** Fatia 6: vida; zerou, pega fogo e explode em FOGO_MS; depois fica de carcaça (morto). */
  vida: number;
  fogo: boolean;
  explodeEm: number;
  morto: boolean;
  /** Descanso entre dois danos de batida (ms). */
  proxDano: number;
}

export interface Gfa {
  t: number;
  fim: number;
  carro: Carro;
  pedestres: Pedestre[];
  viaturas: Viatura[];
  /** Fatia 5: trânsito de carros civis. */
  civis: Civil[];
  /** Fatia 5: o vidro do motorista (0 fechado, 1 aberto) e o próximo tiro (ms). */
  janela: number;
  proxTiro: number;
  /** Mortes (atropelo ou tiro: contam igual). */
  atropelos: number;
  /** Nível de procurado (0 a 5). */
  boletos: number;
  /** Até quando o nível fica (sem atropelo novo, cai um a cada 12 s). */
  boletosAte: number;
  /** Tempo acumulado cercado pela polícia (ms); passou de 1,5 s, acabou. */
  cercado: number;
  presa: boolean;
  /** Fatia 6: vida do seu carro (0 a VIDA_MAX); zerou, explode e a corrida acaba. */
  vida: number;
  destruido: boolean;
  /** Fatia 6: cenário destrutível (objetos de calçada e vitrines). */
  objetos: Objeto[];
  vitrines: Vitrine[];
  /** Contador de ids de viatura (uma nova a cada nascimento). */
  proxViatura: number;
  acabou: boolean;
  eventos: EventoGfa[];
  sorteia: () => number;
}

export type EventoGfa =
  | { k: 'atropelo'; x: number; z: number; id: number; vel: number }
  | { k: 'batida'; x: number; z: number; forca: number }
  /** Fatia 5: tiro de dentro do carro (de x0, z0 até x, z); id = quem morreu (−1 = errou); civ = carro civil atingido. */
  | { k: 'tiro'; x0: number; z0: number; x: number; z: number; id: number; civ?: number }
  | { k: 'boletos'; n: number }
  | { k: 'sirene'; id: number }
  | { k: 'presa' }
  | { k: 'fim' }
  /** Fatia 6: o carro bateu num objeto (quebrou ou só rachou); vx, vz = para onde voam os cacos. */
  | { k: 'objeto'; id: number; tipo: TipoObjeto; x: number; z: number; quebrou: boolean; forca: number; vx: number; vz: number }
  | { k: 'vitrine'; id: number; x: number; z: number; eixo: 'x' | 'z' }
  /** Civil sem vida: pegou fogo (explode em FOGO_MS). */
  | { k: 'fogo'; id: number }
  /** Explosão (civil, viatura ou o seu carro); `mortos` = pedestres que ela matou. */
  | { k: 'explosao'; x: number; z: number; quem: 'civil' | 'viatura' | 'eu'; mortos: number[] }
  /** Tiro da viatura em você. */
  | { k: 'tiroPolicia'; id: number; x0: number; z0: number; x: number; z: number; acerto: boolean; dano: number }
  /** Você tomou dano (de tiro, batida de viatura ou explosão). */
  | { k: 'dano'; v: number }
  /** Bateu um marco de mortes: bônus em R$. */
  | { k: 'marco'; mortes: number; bonus: number }
  | { k: 'destruido' };

export interface Entrada {
  /** -1 (ré/freio) a 1 (acelera). */
  acel: number;
  /** -1 (esquerda) a 1 (direita). */
  giro: number;
  freio: boolean;
  /** Fatia 5: segurando = para o carro, abre o vidro e atira. */
  tiro?: boolean;
}
export const PARADO: Entrada = { acel: 0, giro: 0, freio: false };

/** Um ponto de calçada sorteado (para pedestre nascer e voltar). */
function pontoDeCalcada(r: () => number): { x: number; z: number; dx: number; dz: number } {
  const i = Math.floor(r() * BLOCOS);
  const j = Math.floor(r() * BLOCOS);
  const lado = Math.floor(r() * 4);
  const f = P0 + r() * (P1 - P0);
  const c = RUA + CALCADA / 2;
  const d = BLOCO - CALCADA / 2;
  const [lx, lz, dx, dz] = lado === 0 ? [f, c, 1, 0] : lado === 1 ? [f, d, -1, 0] : lado === 2 ? [c, f, 0, 1] : [d, f, 0, -1];
  return { x: i * BLOCO + lx, z: j * BLOCO + lz, dx, dz };
}

/** Fatia 5: rua cheia (eram 48). */
export const N_PEDESTRES = 110;
export const N_CIVIS = 14;

export function novoGfa(semente: number, t0 = 0, looks = 12): Gfa {
  const r = rng(semente);
  const pedestres: Pedestre[] = [];
  for (let id = 0; id < N_PEDESTRES; id++) {
    const p = pontoDeCalcada(r);
    pedestres.push({ id, look: Math.floor(r() * looks), ...p, estado: 'anda', vx: 0, vz: 0, y: 0, vy: 0, volta: 0, giro: 0 });
  }
  const civis: Civil[] = [];
  for (let id = 0; id < N_CIVIS; id++) {
    // Faixa da mão (a 2,5 m do meio da rua), numa rua sorteada, em qualquer ponto dela.
    const eixo: 'x' | 'z' = id % 2 ? 'x' : 'z';
    const sentido = r() < 0.5 ? 1 : -1;
    const rua = Math.floor(r() * (BLOCOS + 1)) * BLOCO + RUA / 2 + sentido * 2.5 * (eixo === 'z' ? -1 : 1);
    const pos = RUA / 2 + r() * (MUNDO - RUA);
    civis.push({ id, x: eixo === 'z' ? rua : pos, z: eixo === 'z' ? pos : rua, eixo, sentido, vel: 8 + r() * 5, ang: 0, cor: id % 6, batidoAte: 0, giro: 0, kx: 0, kz: 0, vida: VIDA_CIVIL, fogo: false, explodeEm: 0, morto: false, proxDano: 0 });
  }
  return {
    t: t0,
    fim: t0 + DURACAO_MS,
    carro: { x: RUA / 2 + BLOCO * 2, z: RUA / 2, ang: Math.PI / 2, vel: 0, lado: 0, roda: 0 },
    pedestres,
    viaturas: [],
    civis,
    janela: 0,
    proxTiro: 0,
    atropelos: 0,
    boletos: 0,
    boletosAte: 0,
    cercado: 0,
    presa: false,
    vida: VIDA_MAX,
    destruido: false,
    ...gerarCenario(semente),
    proxViatura: 0,
    acabou: false,
    eventos: [],
    sorteia: r,
  };
}

/** Está na calçada? (dentro do quarteirão, fora do prédio; a rua e o cruzamento não contam) */
export function naCalcada(x: number, z: number): boolean {
  if (x < RUA || z < RUA || x > MUNDO - RUA || z > MUNDO - RUA) return false;
  return x % BLOCO >= RUA && z % BLOCO >= RUA && !predio(x, z);
}

/**
 * Fatia 6: o cenário vem só da semente, por um sorteio à parte (não mexe no sorteio da corrida): ~300 objetos nas
 * calçadas, de ponta a ponta do quarteirão (rente à rua; banca e ponto de ônibus no meio), obras com cones na linha
 * do meio das ruas (o trânsito passa dos lados) e vitrines coladas nas fachadas.
 */
function gerarCenario(semente: number): { objetos: Objeto[]; vitrines: Vitrine[] } {
  const r = rng(hash(semente) ^ 0x5ce4a210);
  const soma = TIPOS_OBJETO.reduce((s, t) => s + OBJETOS[t].freq, 0);
  const objetos: Objeto[] = [];
  for (let tent = 0; objetos.length < N_OBJETOS && tent < N_OBJETOS * 30; tent++) {
    let q = r() * soma;
    let tipo = TIPOS_OBJETO[0];
    for (const t of TIPOS_OBJETO) {
      q -= OBJETOS[t].freq;
      if (q < 0) {
        tipo = t;
        break;
      }
    }
    const info = OBJETOS[tipo];
    const i = Math.floor(r() * BLOCOS);
    const j = Math.floor(r() * BLOCOS);
    const lado = Math.floor(r() * 4);
    // Ao longo da calçada inteira (da esquina à esquina); os grandes ficam longe da esquina.
    const f = info.grande ? P0 + 1.8 + r() * (P1 - P0 - 3.6) : RUA + 0.9 + r() * (BLOCO - RUA - 1.8);
    // Distância da beira da rua: rente (0,55 a 1,05 m) ou no meio da calçada (os grandes).
    const dist = info.grande ? CALCADA / 2 : 0.55 + r() * 0.5;
    const lc = lado % 2 === 0 ? RUA + dist : BLOCO - dist;
    const x = i * BLOCO + (lado < 2 ? f : lc);
    const z = j * BLOCO + (lado < 2 ? lc : f);
    if (objetos.some((o) => Math.hypot(o.x - x, o.z - z) < 1.8 + info.raio)) continue;
    objetos.push({ id: objetos.length, tipo, x, z, ang: lado < 2 ? 0 : Math.PI / 2, vida: info.vida, estado: 'inteiro', jatoAte: 0 });
  }
  // Obras: fileira de cones na linha do meio de um trecho de rua (fora do cruzamento).
  for (let n = 0, tent = 0; n < N_OBRAS && tent < N_OBRAS * 20; tent++) {
    const noX = r() < 0.5;
    const k = Math.floor(r() * (BLOCOS + 1));
    const i = Math.floor(r() * BLOCOS);
    const meio = k * BLOCO + RUA / 2;
    const ini = i * BLOCO + RUA + 2 + r() * (BLOCO - RUA - 4 - (CONES_POR_OBRA - 1) * 2.2);
    const pts = Array.from({ length: CONES_POR_OBRA }, (_, c) => (noX ? { x: ini + c * 2.2, z: meio } : { x: meio, z: ini + c * 2.2 }));
    if (pts.some((q) => objetos.some((o) => Math.hypot(o.x - q.x, o.z - q.z) < 2))) continue;
    for (const q of pts) objetos.push({ id: objetos.length, tipo: 'cone', x: q.x, z: q.z, ang: noX ? 0 : Math.PI / 2, vida: OBJETOS.cone.vida, estado: 'inteiro', jatoAte: 0 });
    n++;
  }
  const vitrines: Vitrine[] = [];
  for (let i = 0; i < BLOCOS; i++)
    for (let j = 0; j < BLOCOS; j++)
      for (let lado = 0; lado < 4; lado++) {
        if (r() >= 0.45) continue;
        const f = P0 + 2.4 + r() * (P1 - P0 - 4.8);
        const face = lado % 2 === 0 ? P0 : P1;
        const noX = lado < 2;
        vitrines.push({ id: vitrines.length, x: i * BLOCO + (noX ? f : face), z: j * BLOCO + (noX ? face : f), eixo: noX ? 'x' : 'z', comp: 3.6, estado: 'inteira' });
      }
  return { objetos, vitrines };
}

/* ------------------------------------------------------------------ física do carro */

export const VEL_MAX = 30;
const VEL_RE = 9;
const ACEL = 22;
const FREIO = 34;
const ARRASTO = 0.15;
const ENTRE_EIXOS = 2.6;
const VOLANTE = 0.55;
export const RAIO_CARRO = 1.3;

/** Anda o carro um passo (o mesmo modelo serve para o seu e para as viaturas). */
function dirigir(c: Carro, e: Entrada, dt: number, maxVel = VEL_MAX): number {
  // Acelerador, ré e freio.
  if (e.freio) c.vel -= Math.sign(c.vel) * Math.min(Math.abs(c.vel), FREIO * dt);
  else if (e.acel > 0) c.vel += ACEL * e.acel * dt * (1 - Math.max(0, c.vel) / maxVel);
  else if (e.acel < 0) c.vel += (c.vel > 0.5 ? -FREIO : -ACEL * 0.6) * -e.acel * dt;
  c.vel -= c.vel * ARRASTO * dt;
  c.vel = Math.max(-VEL_RE, Math.min(maxVel, c.vel));
  // Volante: menos ângulo em alta (estável), e a curva vira de lado (derrapa um pouco).
  const alvo = e.giro * VOLANTE * (1 - 0.55 * Math.min(1, Math.abs(c.vel) / maxVel));
  c.roda += (alvo - c.roda) * Math.min(1, dt * 10);
  const giro = (c.vel / ENTRE_EIXOS) * Math.tan(c.roda);
  c.ang += giro * dt;
  c.lado += -giro * c.vel * 0.06 * dt;
  c.lado -= c.lado * Math.min(1, 6 * dt);
  // Anda; prédio e muro param o carro (e devolvem a força da batida).
  const fx = Math.sin(c.ang);
  const fz = Math.cos(c.ang);
  const nx = c.x + (fx * c.vel + fz * c.lado) * dt;
  const nz = c.z + (fz * c.vel - fx * c.lado) * dt;
  const bate = (x: number, z: number) =>
    foraDoMundo(x, z) || predio(x + RAIO_CARRO * 0.7, z) || predio(x - RAIO_CARRO * 0.7, z) || predio(x, z + RAIO_CARRO * 0.7) || predio(x, z - RAIO_CARRO * 0.7);
  if (!bate(nx, nz)) {
    c.x = nx;
    c.z = nz;
    return 0;
  }
  // Escorrega pela parede: tenta só um eixo.
  const forca = Math.abs(c.vel);
  if (!bate(nx, c.z)) c.x = nx;
  else if (!bate(c.x, nz)) c.z = nz;
  c.vel *= -0.25;
  c.lado = 0;
  return forca;
}

/* ------------------------------------------------------------------ o passo */

const RAIO_ATROPELO = 1.7;
const VEL_ATROPELO = 5;
const VOLTA_MS = 9000;
const BOLETO_A_CADA = 2;
const BOLETO_CAI_MS = 12_000;
const CERCO_MS = 1500;
const RAIO_CERCO = 3.2;
/** Tiro: alcance, cadência, e o vidro (abre em 0,25 s). */
export const ALCANCE_TIRO = 32;
export const TIRO_MS = 200;
const JANELA_POR_S = 4;
/** Carro civil contra o seu: caixa de 4,2 × 2 (meio comprimento + meio de cada lado). */
const ENCOSTA_FRENTE = 4.1;
const ENCOSTA_LADO = 2.0;
/** Até onde o civil enxerga você parado na faixa dele (freia atrás e espera). */
const FREIA_ATRAS = 7.5;
/** Carro batido não passa do muro (a faixa da beira fica a 2,5 m dele). */
const BORDA_CIVIL = 2;
/** Dano ao civil: por m/s de batida e por tiro. */
const DANO_BATIDA_CIVIL = 1.4;
const DANO_TIRO_CIVIL = 8;
/** Tiro sem alvo vivo: até onde acerta objeto/vitrine e quanto tira do objeto. */
export const ALCANCE_OBJETO = 20;
export const DANO_TIRO_OBJETO = 6;
/** Duas viaturas, ou uma viatura e você, não se atravessam: distância mínima entre os centros. */
const SEPARA_VIATURA = 2.5;

/** Chance de a viatura acertar você: cai com a distância e com a sua velocidade. */
export function chanceAcerto(dist: number, vel: number): number {
  return Math.max(0.1, Math.min(0.9, 0.85 - 0.45 * (dist / POLICIA_ALCANCE) - 0.02 * Math.abs(vel)));
}

/** Você levou dano (a corrida acaba em zero, mais abaixo). */
function ferir(g: Gfa, dano: number) {
  if (dano <= 0 || g.acabou) return;
  g.vida = Math.max(0, g.vida - dano);
  g.eventos.push({ k: 'dano', v: dano });
}

function quebrarObjeto(g: Gfa, o: Objeto, forca: number, vx: number, vz: number) {
  o.vida = 0;
  o.estado = 'quebrado';
  if (o.tipo === 'hidrante') o.jatoAte = g.t + 7000;
  g.eventos.push({ k: 'objeto', id: o.id, tipo: o.tipo, x: o.x, z: o.z, quebrou: true, forca, vx, vz });
}

function quebrarVitrine(g: Gfa, vt: Vitrine) {
  vt.estado = 'quebrada';
  g.eventos.push({ k: 'vitrine', id: vt.id, x: vt.x, z: vt.z, eixo: vt.eixo });
}

/**
 * Explosão (civil, viatura ou você): mata quem anda a pé em volta (conta como morte sua), empurra e fere os carros,
 * fere o seu se estiver perto e quebra o cenário. `exceto` = o civil que explodiu.
 */
function explodir(g: Gfa, x: number, z: number, quem: 'civil' | 'viatura' | 'eu', exceto = -1) {
  const R = RAIO_EXPLOSAO;
  const mortos: number[] = [];
  g.eventos.push({ k: 'explosao', x, z, quem, mortos });
  for (const p of g.pedestres) {
    if (p.estado !== 'anda') continue;
    const dx = p.x - x;
    const dz = p.z - z;
    const d = Math.hypot(dx, dz);
    if (d >= R) continue;
    const f = 1 - d / R;
    const ux = d > 0.01 ? dx / d : 1;
    const uz = d > 0.01 ? dz / d : 0;
    matar(g, p, ux * (8 + 14 * f), uz * (8 + 14 * f), 9 + 10 * f);
    mortos.push(p.id);
  }
  for (const v of g.civis) {
    if (v.id === exceto) continue;
    const dx = v.x - x;
    const dz = v.z - z;
    const d = Math.hypot(dx, dz);
    if (d >= R * 1.2) continue;
    const f = 1 - d / (R * 1.2);
    const ux = d > 0.01 ? dx / d : 1;
    const uz = d > 0.01 ? dz / d : 0;
    if (!v.morto) v.vida -= 30 * f;
    v.kx += ux * 14 * f;
    v.kz += uz * 14 * f;
    v.batidoAte = Math.max(v.batidoAte, g.t + 2000);
    v.giro += (g.sorteia() < 0.5 ? -1 : 1) * 4 * f;
  }
  for (const v of g.viaturas) {
    const d = Math.hypot(v.x - x, v.z - z);
    if (d >= R) continue;
    v.vida -= 25 * (1 - d / R);
    v.vel *= 0.6;
  }
  if (quem !== 'eu') {
    const d = Math.hypot(g.carro.x - x, g.carro.z - z);
    if (d < R) {
      ferir(g, 35 * (1 - d / R));
      g.carro.vel *= 0.85;
    }
  }
  for (const o of g.objetos) {
    if (o.estado !== 'inteiro') continue;
    const dx = o.x - x;
    const dz = o.z - z;
    const d = Math.hypot(dx, dz);
    if (d >= R) continue;
    o.vida -= 40 * (1 - d / R) + 8;
    if (o.vida <= 0) quebrarObjeto(g, o, 12, (dx / (d || 1)) * 8, (dz / (d || 1)) * 8);
  }
  for (const vt of g.vitrines) if (vt.estado === 'inteira' && Math.hypot(vt.x - x, vt.z - z) < R + 3) quebrarVitrine(g, vt);
}

/**
 * O carro contra os objetos da calçada: acima de VEL_QUEBRA ele derruba (dano = quanto passa de 3 m/s; poste e árvore
 * seguram mais e tiram mais velocidade); abaixo, o objeto aguenta e o carro só desliza em volta.
 */
function colidirObjetos(g: Gfa) {
  const c = g.carro;
  const v = Math.abs(c.vel);
  const sg = c.vel >= 0 ? 1 : -1;
  const fx = Math.sin(c.ang) * sg;
  const fz = Math.cos(c.ang) * sg;
  const px = c.x + fx * 1.3;
  const pz = c.z + fz * 1.3;
  for (const o of g.objetos) {
    if (o.estado !== 'inteiro') continue;
    const info = OBJETOS[o.tipo];
    const lim = info.raio + 1.0;
    const dp = Math.hypot(o.x - px, o.z - pz);
    const dc = Math.hypot(o.x - c.x, o.z - c.z);
    if (dp >= lim && dc >= lim) continue;
    if (v > VEL_QUEBRA) {
      o.vida -= (v - 3) * 2.4;
      const vx = fx * v * 0.6;
      const vz = fz * v * 0.6;
      if (o.vida <= 0) {
        quebrarObjeto(g, o, v, vx, vz);
        c.vel *= 1 - info.peso;
        continue;
      }
      g.eventos.push({ k: 'objeto', id: o.id, tipo: o.tipo, x: o.x, z: o.z, quebrou: false, forca: v, vx, vz });
      c.vel *= 0.35;
    } else c.vel *= 0.97;
    // Aguentou: o carro sai de dentro dele (desliza em volta).
    const [qx, qz, d] = dp <= dc ? [px, pz, dp] : [c.x, c.z, dc];
    const ov = lim - d;
    const tx = c.x + ((qx - o.x) / (d || 1)) * ov;
    const tz = c.z + ((qz - o.z) / (d || 1)) * ov;
    if (!predio(tx, tz) && !foraDoMundo(tx, tz)) {
      c.x = tx;
      c.z = tz;
    }
  }
}

/** Raspar na fachada (a mais de 3 m/s) estilhaça a vitrine. */
function rasparVitrines(g: Gfa) {
  const c = g.carro;
  if (Math.abs(c.vel) < 3) return;
  for (const vt of g.vitrines) {
    if (vt.estado !== 'inteira') continue;
    const ao = vt.eixo === 'x' ? c.x - vt.x : c.z - vt.z;
    const lado = vt.eixo === 'x' ? c.z - vt.z : c.x - vt.x;
    if (Math.abs(lado) < 1.7 && Math.abs(ao) < vt.comp / 2 + 1.0) quebrarVitrine(g, vt);
  }
}

/** Alguém morreu (atropelo ou tiro): voa, conta e sobe o boleto do mesmo jeito. */
function matar(g: Gfa, p: Pedestre, vx: number, vz: number, vy: number) {
  p.estado = 'voa';
  p.vx = vx;
  p.vz = vz;
  p.vy = vy;
  p.giro = (g.sorteia() < 0.5 ? -1 : 1) * (6 + Math.hypot(vx, vz) * 0.3);
  g.atropelos++;
  for (const m of MARCOS) if (g.atropelos === m.mortes) g.eventos.push({ k: 'marco', mortes: m.mortes, bonus: m.bonus });
  const novo = Math.min(5, Math.floor(g.atropelos / BOLETO_A_CADA) + (g.atropelos > 0 ? 1 : 0));
  if (novo > g.boletos) {
    g.boletos = novo;
    g.eventos.push({ k: 'boletos', n: novo });
  }
  g.boletosAte = g.t + BOLETO_CAI_MS;
}

/** Atira no pedestre de pé mais perto (até ALCANCE_TIRO), pela janela do lado dele. */
function atirar(g: Gfa) {
  const c = g.carro;
  let alvo: Pedestre | null = null;
  let melhor = ALCANCE_TIRO;
  for (const p of g.pedestres) {
    if (p.estado !== 'anda') continue;
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < melhor) {
      melhor = d;
      alvo = p;
    }
  }
  const fx = Math.sin(c.ang);
  const fz = Math.cos(c.ang);
  // Lado da janela: o do alvo (sem alvo, atira para a esquerda do carro, a janela do motorista).
  // Fatia 6: sem ninguém de pé no alcance, o tiro vai no carro civil mais perto (tira vida dele).
  let carro: Civil | null = null;
  if (!alvo) {
    let m = ALCANCE_TIRO;
    for (const v of g.civis) {
      if (v.morto) continue;
      const d = Math.hypot(v.x - c.x, v.z - c.z);
      if (d < m) {
        m = d;
        carro = v;
      }
    }
  }
  // Sem carro também: o objeto de pé ou a vitrine inteira mais perto (até 20 m).
  let obj: Objeto | null = null;
  let vit: Vitrine | null = null;
  if (!alvo && !carro) {
    let m = ALCANCE_OBJETO;
    for (const o of g.objetos) {
      if (o.estado !== 'inteiro') continue;
      const d = Math.hypot(o.x - c.x, o.z - c.z);
      if (d < m) {
        m = d;
        obj = o;
      }
    }
    for (const v of g.vitrines) {
      if (v.estado !== 'inteira') continue;
      const d = Math.hypot(v.x - c.x, v.z - c.z);
      if (d < m) {
        m = d;
        vit = v;
        obj = null;
      }
    }
  }
  const mira = alvo ?? carro ?? obj ?? vit;
  const tx = mira ? mira.x : c.x + fz * 20;
  const tz = mira ? mira.z : c.z - fx * 20;
  const lado = (tx - c.x) * fz - (tz - c.z) * fx >= 0 ? 1 : -1;
  const x0 = c.x + fz * lado * 1.05;
  const z0 = c.z - fx * lado * 1.05;
  g.eventos.push(carro ? { k: 'tiro', x0, z0, x: tx, z: tz, id: -1, civ: carro.id } : { k: 'tiro', x0, z0, x: tx, z: tz, id: alvo ? alvo.id : -1 });
  if (carro) carro.vida -= DANO_TIRO_CIVIL;
  if (obj) {
    obj.vida -= DANO_TIRO_OBJETO;
    const d = Math.hypot(tx - x0, tz - z0) || 1;
    if (obj.vida <= 0) quebrarObjeto(g, obj, 8, ((tx - x0) / d) * 6, ((tz - z0) / d) * 6);
    else g.eventos.push({ k: 'objeto', id: obj.id, tipo: obj.tipo, x: obj.x, z: obj.z, quebrou: false, forca: 4, vx: 0, vz: 0 });
  }
  if (vit) quebrarVitrine(g, vit);
  if (!alvo) return;
  const d = Math.hypot(tx - x0, tz - z0) || 1;
  matar(g, alvo, ((tx - x0) / d) * 9, ((tz - z0) / d) * 9, 5);
}

/** Trânsito: anda na faixa; na borda do mundo dá a volta na faixa do outro sentido; bateu, roda parado. */
function passoCivis(g: Gfa, dt: number) {
  const c = g.carro;
  for (const v of g.civis) {
    // Fatia 6: sem vida, pega fogo; passado FOGO_MS explode e fica de carcaça.
    if (!v.fogo && !v.morto && v.vida <= 0) {
      v.fogo = true;
      v.explodeEm = g.t + FOGO_MS;
      v.batidoAte = Math.max(v.batidoAte, v.explodeEm + 500);
      g.eventos.push({ k: 'fogo', id: v.id });
    }
    if (v.fogo && !v.morto && g.t >= v.explodeEm) {
      v.morto = true;
      v.vel = 0;
      explodir(g, v.x, v.z, 'civil', v.id);
    }
    const parado = v.morto || g.t < v.batidoAte;
    // Você no referencial dele: ao longo da faixa (ao) e de lado (lat).
    const dirx = v.eixo === 'x' ? v.sentido : 0;
    const dirz = v.eixo === 'z' ? v.sentido : 0;
    const ao = (c.x - v.x) * dirx + (c.z - v.z) * dirz;
    const lat = (c.x - v.x) * dirz - (c.z - v.z) * dirx;
    const naFrente = Math.abs(lat) < ENCOSTA_LADO + 0.4 && ao > 0 && ao < FREIA_ATRAS;
    if (parado) {
      v.ang += v.giro * dt;
      v.giro *= 1 - 1.5 * dt;
      const nx = Math.max(BORDA_CIVIL, Math.min(MUNDO - BORDA_CIVIL, v.x + v.kx * dt));
      const nz = Math.max(BORDA_CIVIL, Math.min(MUNDO - BORDA_CIVIL, v.z + v.kz * dt));
      if (predio(nx, nz)) {
        v.kx = 0;
        v.kz = 0;
      } else {
        v.x = nx;
        v.z = nz;
      }
      v.kx *= 1 - 2 * dt;
      v.kz *= 1 - 2 * dt;
    } else if (naFrente) {
      // Você parado (atirando) na faixa dele: ele freia atrás e espera.
    } else {
      // Empurrado para fora da faixa (batida, explosão): primeiro volta de lado, parado, e só depois anda. Se um
      // prédio estiver no caminho de volta, reaparece na faixa (a faixa é rua de ponta a ponta, nunca prédio).
      const off = v.sentido * 2.5 * (v.eixo === 'z' ? -1 : 1);
      const lado = v.eixo === 'z' ? v.x : v.z;
      const faixa = Math.round((lado - RUA / 2 - off) / BLOCO) * BLOCO + RUA / 2 + off;
      const fora = faixa - lado;
      if (Math.abs(fora) > 0.5) {
        const passo = Math.sign(fora) * Math.min(Math.abs(fora), 4 * dt);
        const nx = v.eixo === 'z' ? v.x + passo : v.x;
        const nz = v.eixo === 'z' ? v.z : v.z + passo;
        if (predio(nx, nz)) {
          if (v.eixo === 'z') v.x = faixa;
          else v.z = faixa;
        } else {
          v.x = nx;
          v.z = nz;
        }
      } else {
        const ds = v.sentido * v.vel * dt;
        if (v.eixo === 'z') v.z += ds;
        else v.x += ds;
        const volta = fora * Math.min(1, 2 * dt);
        if (v.eixo === 'z') v.x += volta;
        else v.z += volta;
      }
      v.ang = v.eixo === 'z' ? (v.sentido > 0 ? 0 : Math.PI) : v.sentido > 0 ? Math.PI / 2 : -Math.PI / 2;
      const p = v.eixo === 'z' ? v.z : v.x;
      if (p > MUNDO - RUA / 2 || p < RUA / 2) {
        // Volta pela faixa do outro sentido (a mão troca de lado: 5 m para o lado).
        v.sentido = -v.sentido;
        if (v.eixo === 'z') {
          v.x -= 5 * v.sentido;
          v.z = Math.max(RUA / 2, Math.min(MUNDO - RUA / 2, v.z));
        } else {
          v.z += 5 * v.sentido;
          v.x = Math.max(RUA / 2, Math.min(MUNDO - RUA / 2, v.x));
        }
      }
    }
    // Encostou (caixa contra caixa): separa sempre pelo lado que entrou menos; com força, é batida e ele roda.
    const entraFrente = ENCOSTA_FRENTE - Math.abs(ao);
    const entraLado = ENCOSTA_LADO - Math.abs(lat);
    if (entraFrente > 0 && entraLado > 0) {
      // Quanto você precisa sair (pelo lado que entrou menos).
      let sx: number;
      let sz: number;
      if (entraFrente < entraLado) {
        const s = Math.sign(ao) || 1;
        sx = dirx * s * entraFrente;
        sz = dirz * s * entraFrente;
      } else {
        const s = Math.sign(lat) || 1;
        sx = dirz * s * entraLado;
        sz = -dirx * s * entraLado;
      }
      if (parado) {
        // Carro já batido (rodando) é empurrado: você passa por cima do estrago em vez de empacar nele.
        const nx = Math.max(BORDA_CIVIL, Math.min(MUNDO - BORDA_CIVIL, v.x - sx));
        const nz = Math.max(BORDA_CIVIL, Math.min(MUNDO - BORDA_CIVIL, v.z - sz));
        if (!predio(nx, nz)) {
          // O que o muro ou o prédio não deixou ele andar, você anda.
          sx -= v.x - nx;
          sz -= v.z - nz;
          v.x = nx;
          v.z = nz;
        }
        c.vel *= 1 - 0.5 * dt;
      }
      c.x += sx;
      c.z += sz;
      const forca = Math.abs(c.vel) + (naFrente ? 0 : v.vel * 0.5);
      if (forca > 4) {
        const nova = !parado;
        if (!v.morto && g.t >= v.proxDano) {
          v.vida -= forca * DANO_BATIDA_CIVIL;
          v.proxDano = g.t + 350;
        }
        // Tranco: para a frente do seu carro e para um lado (o lado livre), tirando o destroço do caminho.
        const hx = Math.sin(c.ang) * (Math.sign(c.vel) || 1);
        const hz = Math.cos(c.ang) * (Math.sign(c.vel) || 1);
        const vv = Math.max(4, Math.abs(c.vel));
        const ladoDele = (v.x - c.x) * hz - (v.z - c.z) * hx;
        let roda = Math.abs(ladoDele) > 0.3 ? Math.sign(ladoDele) : g.sorteia() < 0.5 ? -1 : 1;
        const livre = (r: number) => {
          const px = v.x + (hx * 0.7 + hz * r * 0.5) * vv * 0.4;
          const pz = v.z + (hz * 0.7 - hx * r * 0.5) * vv * 0.4;
          return px > BORDA_CIVIL && px < MUNDO - BORDA_CIVIL && pz > BORDA_CIVIL && pz < MUNDO - BORDA_CIVIL && !predio(px, pz);
        };
        if (!livre(roda) && livre(-roda)) roda = -roda;
        v.kx = (hx * 0.7 + hz * roda * 0.5) * vv;
        v.kz = (hz * 0.7 - hx * roda * 0.5) * vv;
        v.batidoAte = Math.max(v.batidoAte, g.t + 2500);
        if (nova) {
          v.giro = roda * (3 + forca * 0.25);
          c.vel *= -0.3;
          g.eventos.push({ k: 'batida', x: (c.x + v.x) / 2, z: (c.z + v.z) / 2, forca });
        }
      }
    }
  }
}

export function passoGfa(g: Gfa, e: Entrada, dt = DT_GFA) {
  if (g.acabou) return;
  g.t += dt * 1000;
  const c = g.carro;
  // Fatia 5: segurando o tiro, o carro freia forte, o vidro desce e o tiro sai com o carro quase parado.
  const forca = dirigir(c, e.tiro ? { acel: 0, giro: 0, freio: true } : e, dt);
  if (forca > 8) g.eventos.push({ k: 'batida', x: c.x, z: c.z, forca });
  colidirObjetos(g);
  rasparVitrines(g);
  g.janela = Math.max(0, Math.min(1, g.janela + (e.tiro ? 1 : -1) * JANELA_POR_S * dt));
  if (e.tiro && g.janela >= 1 && Math.abs(c.vel) < 3 && g.t >= g.proxTiro) {
    g.proxTiro = g.t + TIRO_MS;
    atirar(g);
  }
  passoCivis(g, dt);

  // Pedestres.
  for (const p of g.pedestres) {
    if (p.estado === 'anda') {
      p.x += p.dx * 1.4 * dt;
      p.z += p.dz * 1.4 * dt;
      // Chegou ao canto do quarteirão: vira para continuar na calçada (ou dá meia-volta).
      if (predio(p.x + p.dx * 1.5, p.z + p.dz * 1.5) || foraDoMundo(p.x + p.dx * 2, p.z + p.dz * 2) || ((p.x % BLOCO) < RUA && (p.z % BLOCO) < RUA)) {
        p.dx = -p.dx;
        p.dz = -p.dz;
      }
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d < RAIO_ATROPELO && Math.abs(c.vel) > VEL_ATROPELO) {
        const fx = Math.sin(c.ang) * Math.sign(c.vel);
        const fz = Math.cos(c.ang) * Math.sign(c.vel);
        const v = Math.abs(c.vel);
        matar(g, p, fx * v * 0.8 + (g.sorteia() - 0.5) * 4, fz * v * 0.8 + (g.sorteia() - 0.5) * 4, 4 + v * 0.35);
        c.vel *= 0.85;
        g.eventos.push({ k: 'atropelo', x: p.x, z: p.z, id: p.id, vel: v });
      }
    } else if (p.estado === 'voa') {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.y += p.vy * dt;
      p.vy -= 22 * dt;
      p.vx *= 1 - 0.8 * dt;
      p.vz *= 1 - 0.8 * dt;
      if (predio(p.x, p.z) || foraDoMundo(p.x, p.z)) {
        p.vx = -p.vx * 0.3;
        p.vz = -p.vz * 0.3;
        p.x += p.vx * dt * 2;
        p.z += p.vz * dt * 2;
      }
      if (p.y <= 0 && p.vy < 0) {
        p.y = 0;
        p.estado = 'caido';
        p.volta = g.t + VOLTA_MS;
      }
    } else if (g.t >= p.volta) {
      Object.assign(p, pontoDeCalcada(g.sorteia), { estado: 'anda', y: 0, vy: 0, vx: 0, vz: 0, giro: 0 });
    }
  }

  // Boletos baixam com o tempo sem atropelo.
  if (g.boletos > 0 && g.t >= g.boletosAte) {
    g.boletos--;
    g.boletosAte = g.t + BOLETO_CAI_MS;
    g.eventos.push({ k: 'boletos', n: g.boletos });
  }

  // Viaturas: uma por boleto (até 4), nascem longe e caçam o carro.
  const querem = Math.min(4, g.boletos);
  while (g.viaturas.length < querem) {
    const id = g.proxViatura++;
    const canto = [
      [RUA / 2, RUA / 2],
      [MUNDO - RUA / 2, RUA / 2],
      [RUA / 2, MUNDO - RUA / 2],
      [MUNDO - RUA / 2, MUNDO - RUA / 2],
    ].sort((a, b) => Math.hypot(b[0] - c.x, b[1] - c.z) - Math.hypot(a[0] - c.x, a[1] - c.z))[id % 4];
    g.viaturas.push({ id, x: canto[0], z: canto[1], ang: 0, vel: 0, lado: 0, roda: 0, vida: VIDA_VIATURA, proxTiro: g.t + 900 + (id % 4) * 250, proxDano: 0 });
    g.eventos.push({ k: 'sirene', id });
  }
  while (g.viaturas.length > querem) g.viaturas.pop();
  let perto = 0;
  const mortas: Viatura[] = [];
  for (const v of g.viaturas) {
    const dx = c.x - v.x;
    const dz = c.z - v.z;
    const d = Math.hypot(dx, dz);
    // Mira no carro: diferença de ângulo vira volante; perto, freia para não passar.
    let da = Math.atan2(dx, dz) - v.ang;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    const giro = Math.max(-1, Math.min(1, da * 2));
    const preso = dirigir(v, { acel: d > 6 ? 1 : 0.3, giro, freio: d < 3 && v.vel > 6 }, dt, VEL_MAX * 0.82);
    // Bateu no prédio: dá ré girando para se soltar.
    if (preso) v.ang += Math.sign(da || 1) * 0.6;
    if (d < RAIO_CERCO) perto++;
    // Fatia 6: viatura e carro não se atravessam; batida forte fere os dois (a viatura leva mais).
    const ex = c.x - v.x;
    const ez = c.z - v.z;
    const dd = Math.hypot(ex, ez);
    if (dd < SEPARA_VIATURA) {
      const rel = Math.hypot(Math.sin(c.ang) * c.vel - Math.sin(v.ang) * v.vel, Math.cos(c.ang) * c.vel - Math.cos(v.ang) * v.vel);
      if (rel > 5 && g.t >= v.proxDano) {
        v.proxDano = g.t + 600;
        ferir(g, (rel - 5) * 0.6);
        v.vida -= (rel - 5) * 2.2;
        g.eventos.push({ k: 'batida', x: (c.x + v.x) / 2, z: (c.z + v.z) / 2, forca: rel });
      }
      const nx = dd > 0.01 ? ex / dd : 1;
      const nz = dd > 0.01 ? ez / dd : 0;
      const ov = SEPARA_VIATURA - dd;
      v.x -= nx * ov * 0.6;
      v.z -= nz * ov * 0.6;
      const tx = c.x + nx * ov * 0.4;
      const tz = c.z + nz * ov * 0.4;
      if (!predio(tx, tz) && !foraDoMundo(tx, tz)) {
        c.x = tx;
        c.z = tz;
      }
      v.vel *= 0.5;
      c.vel *= 0.85;
    }
    // Fatia 6: com POLICIA_BOLETOS ou mais, a viatura a menos de POLICIA_ALCANCE atira em você.
    if (g.boletos >= POLICIA_BOLETOS && dd <= POLICIA_ALCANCE) {
      if (g.t >= v.proxTiro) {
        v.proxTiro = g.t + POLICIA_CADENCIA_MS;
        const acerto = g.sorteia() < chanceAcerto(dd, c.vel);
        const dano = acerto ? POLICIA_DANO_MIN + g.sorteia() * (POLICIA_DANO_MAX - POLICIA_DANO_MIN) : 0;
        g.eventos.push({ k: 'tiroPolicia', id: v.id, x0: v.x + Math.sin(v.ang) * 1.5, z0: v.z + Math.cos(v.ang) * 1.5, x: c.x, z: c.z, acerto, dano });
        ferir(g, dano);
      }
    } else v.proxTiro = Math.max(v.proxTiro, g.t + 600);
    if (v.vida <= 0) mortas.push(v);
  }
  for (const v of mortas) {
    g.viaturas.splice(g.viaturas.indexOf(v), 1);
    explodir(g, v.x, v.z, 'viatura');
  }
  // Vida zero: o carro explode e a corrida acaba (leva metade da grana, como na prisão).
  if (g.vida <= 0) {
    g.destruido = true;
    g.acabou = true;
    explodir(g, c.x, c.z, 'eu');
    g.eventos.push({ k: 'destruido' });
    return;
  }
  if (perto > 0 && Math.abs(c.vel) < 8) g.cercado += dt * 1000 * perto;
  else g.cercado = Math.max(0, g.cercado - dt * 1000 * 0.5);
  if (g.cercado >= CERCO_MS) {
    g.presa = true;
    g.acabou = true;
    g.eventos.push({ k: 'presa' });
    return;
  }
  if (g.t >= g.fim) {
    g.acabou = true;
    g.eventos.push({ k: 'fim' });
  }
}

/** Grana bruta de N mortes: R$ 5 cada, mais os bônus dos marcos já batidos (sem teto). */
export function granaBruta(mortes: number): number {
  return mortes * GRANA_POR_MORTE + bonusMarcos(mortes);
}

/** O que você leva de volta: grana (presa ou destruído leva metade) e as mortes para a ficha. */
export function premio(g: Gfa): { grana: number; mortes: number } {
  const bruto = granaBruta(g.atropelos);
  return { grana: g.presa || g.destruido ? Math.floor(bruto / 2) : bruto, mortes: g.atropelos };
}

/** Pode ir ao portal agora? (uma corrida a cada 5 min neste aparelho) */
export function podePortal(ultima: number, agora: number): boolean {
  return !(ultima > 0) || agora - ultima >= ESPERA_PORTAL_MS;
}
