/**
 * A tela do Bar Vivo (Fatia 1, tudo local): o boteco inteiro com câmera que acompanha, joystick e botões (ou
 * teclado), a briga com os NPCs, os amigos desmaiados, o sangue no chão e o narrador debochado.
 */
import { Suspense, lazy, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Activity, Beer, BookOpen, Camera, Droplet, Ghost, LogOut, MessageCircle, Shirt, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import {
  PLAYER_BY_ID,
  buildBarGridLook,
  buildDeadGridLook,
  buildGridLook,
  buildDeadCortadoGridLook,
  buildPedacoGridLook,
  cortarGrid,
  polir,
  type BarPose,
  type ParteCorpo,
  type Grid,
  type Look,
  type PlayerId,
  PLAYERS,
} from '../arena/sprites';
import { TH, TW, byDepth, facing } from '../bar/iso';
import { Raster, hex } from '../bar/raster';
import type { Sprite } from '../bar/render';
import { isSoundEnabled, setSoundEnabled } from '../utils/audio';
import { Arena } from '../arena/Arena';
import { useScoreTree, useStandings } from '../arena/useScoreboard';
import type { Period, Standing } from '../arena/scoreStore';
import { ALL_PACK, THEME_PACKS } from '../data/catalog';
import type { DifficultyLevel } from '../types/crossword';
import { barPresence } from '../bar/presence';
import { balloons } from '../bar/social';
import { jukebox } from '../bar/music';
import { FAIXAS, faixaDaHora, passoAgora, sanitizeJuke, volumeJukebox, type Juke } from './faixas';
import { DailyPanel } from '../bar/DailyPanel';
import { AnagramPanel } from '../bar/AnagramPanel';
import { QuizPanel } from '../bar/QuizPanel';
import { LAYOUTS, armaSprite, carroSprite, enfeiteDe, pintarFundo, spriteDe, telaDe } from './arte';
import { ARMAS, PARADO, RAIO_MOLHADO, RAJADA_VEL, achar, equipar, eu, ferirPorEvento, levantar, molhadosEm, novoMundo, passo, podeLevantar, poseDe, quebrar, rodarQuadro, type Corpo, type Entrada, type Mundo } from './briga';
import { BRINDE_BONUS, BRINDES_DIA, COPO_MS, NOME as NOME_J, PEGADINHAS, PEGADINHAS_DIA, REVIVE_DE_NOVO_MS, REVIVE_MS, REVIVER_ZERO, TROFEU_NOME, brindaram, fxDoBar, haQuanto, livroDoBar, lkDoAmigo, passoReviver, podeZoar, textoPegadinha, type Jogador, type Reviver } from './interacoes';
import { MARIA_DESCANSO, NPCS } from './gente';
import { LUGAR, faltaSusto, luzAgora, novoAssombro, passoAssombro, type Susto } from './assombro';
import { RADIO, spriteSusto } from './assombroArte';
import { MOVIMENTO, RESTO, poseItem, tempoGolpe, voltarNoGolpe, type PoseItem } from './animArma';
import { MAX_FAGULHAS, corJukebox, forcaLuz, montarAmbiente, moscasEm, novoAmbiente, passoAmbiente } from './ambiente';
import { AREAS, CANTOS, ENTRADA, FACHADA, GRADE, JOGOS, PAREDE, PORTAS, PROPS, carrosEm, zonaDe, type AmigoId, type Jogo, type Zona } from './mapa';
import {
  ATORDOA_MS,
  DANO_DINO,
  DANO_FOGO,
  DANO_POCA,
  DINO_RAIO,
  DINO_VIDA,
  DRAGAO_RAIO,
  DRAGAO_VIDA,
  FOGO_AVISO_MS,
  FOGO_COMPR,
  FOGO_LARG,
  GELADEIRA_RAIO,
  PISAO_RAIO,
  POCA_RAIO,
  PREMIO_DINO,
  PREMIO_DRAGAO,
  SONO_MS,
  batidaDino,
  cabecaDragao,
  furosDragao,
  naLinhaFogo,
  pisoesDragao,
  pocasFogo,
  posDino,
  rotaDino,
  soproEm,
  soprosDragao,
  type PosDino,
  type Sopro,
  type TrechoDino,
} from './feras';
import { rng as rngMesa } from './eventos';
import {
  PORRINHA_MAX_MAO,
  PORRINHA_MESA,
  PORRINHA_NOME,
  PORRINHA_PAGAS_DIA,
  PORRINHA_RODADA,
  esconder,
  maoNpc,
  muralDoDia,
  narrar,
  novaPorrinha,
  novoNarrador,
  palpiteNpc,
  palpitar,
  palpitesLivres,
  proximaFala,
  resumoAusencia,
  revelar,
  vezDe,
  type Porrinha,
} from './mesa';
import { CURATIVO_ALT, deveReconhecer, estadoNpc, falaReconhece, registrarNocaute, sanitizeMemoria, type Memoria } from './memoria';
import { ambienteDaHora, chaveLuz, grading, horaBrasilia, mascaraBayer, nivelQualidade, recortar, sujar, type Grading, type Nivel, type Ret } from './luz';
import { falarVoz, tocar, tocarPoder, type Som } from './som';
import { PODER, ehPoder } from './poderes';
import { EVENTOS, RATO_RAIO, RATO_VIDA, agenda, epocaDe, faseEvento, posRato, premio, roubosAte, rotaRato, sanitizeConfig, somaLivro, vidaEscalada, type Agendado, type ConfigEventos, type Ponto, type TipoEvento } from './eventos';
import { dayKey, startOfDay } from '../bar/day';
import { ASSENTO_ALIEN, DANO_RAIO, GRANDE_EM, INVASAO_MS, N_DISCOS, PREMIO_PACIFICO, TROFEU_FINAL, VARRE_MS, VISITA_MS, alvosDiscos, cotaLevados, desfecho, faseDisco, naLinha, posGrande, premioInvasao, subidaFeixe, varredura, vidasInvasao } from './invasao';
import { deitadoDe, esticao, olhadela, poseQueda, quedaDe, rampaGota, recuo, respiro, tamGota, tamanhoEsticado, tomGota } from './impacto';
import { PASSOS_PEGADA, alfaPegada, naPoca, pocaDegrau, queimado, rachadura, type PixelMarca } from './decalques';
import { Medidor, guardarMedidor, medidorLigado, textoMedidor } from './medidor';
import { carregarCaixa, lancar, resumo as resumoCaixa, salvarCaixa, type Caixa } from './caixa';
import { LimiteClarao, lerPrefMovimento, movimentoReduzido, proximaPref, salvarPrefMovimento, sistemaPedeReduzido, type PrefMovimento } from './movimento';
import { coresCarga, desenharFogo, desenharPoder, rgbaDe, type PalcoPoder } from './poderesArte';
import { volumePorDistancia, vozDoTema, type TipoVoz } from './voz';
import { ESPERA_FICHA_MS, ORDEM_FICHA, maisPerigoso, proximoEnvio, sanitizeFicha } from './ficha';
import { SinucaPanel } from './SinucaPanel';
import { ESPERA_PORTAL_MS, podePortal } from '../gfa/simulacao';
import type { ResultadoGfa } from '../gfa/GfaTela';
import type { FantasmaAmigo, ResultadoMoscas } from '../portais/moscas/MoscasTela';
import type { AmigoPlacar, ResultadoQuermesse } from '../portais/quermesse/QuermesseTela';
import type { ResultadoChurrasco } from '../portais/churrasco/ChurrascoTela';
import { NOME_PORTAL, NOME_RARIDADE, PO_PRECO, PORTAIS_DO_DIA, PREMIOS, RUNS_COM_SORTEIO, ESPERA_MS, moedaDoPortal, podeEntrar, portalDoDia, sementeDoDia, sortearPremio, sorteiosDaRun, sorteiosDe, lerFantasma, VERSAO_PORTAL, type IdPortal, type Sorteado } from '../portais/portal';
import { carregarInventario, comprarComPo, coresLiberadas, juntar as juntarInv, limparInventario, runsHoje, saldoPo, salvarInventario, type Inventario } from '../portais/inventario';

/** A Dimensão GFA (three.js) só baixa quando alguém entra no portal. */
const GfaTela = lazy(() => import('../gfa/GfaTela'));
// Fatia 13: o portal do dia (Moscaria), carregado só quando abre.
const MoscasTela = lazy(() => import('../portais/moscas/MoscasTela'));
// Fatia 14: o segundo portal do dia (Quermesse Maluca).
const QuermesseTela = lazy(() => import('../portais/quermesse/QuermesseTela'));
// Fatia 20: o terceiro portal.
const ChurrascoTela = lazy(() => import('../portais/churrasco/ChurrascoTela'));
const PORTAL_KEY = 'cruzadabotecos.portal.v1';
/** Os pedestres da Dimensão GFA são os NPCs do bar (lista fixa: não pode mudar a cada quadro, senão a corrida recomeça). */
const LOOKS_GFA = NPCS.map((n) => n.look);
import { CATALOGO, comprar, ficha, juntar, pontosDe, saldo, sanitizeCarteira, achar as acharGrana, type Carteira } from './loja';
import { BALCAO_MERCADO, BANCADA, MOVEL_ARMA, RAIO_BANCADA, RAIO_MERCADO, propIdx, type Arma } from './mapa';
import { RECEITAS, STATUS, nivelCarga, receita, type Status } from './status';
import { Elo, NPC_ENVIO_MS, decidirRelogio, SALTO_RELOGIO_MS, golpeDoEvento, passoRelogio, sanitizeVGolpes, sanitizeVivo } from './rede';
import { telaParaLadrilho } from './controle';
import {
  ACESSORIOS,
  BARBAS,
  CABELOS,
  CALCAS,
  CAMISAS,
  CHAPEUS,
  CORTES,
  ICONE_CHAPEU,
  NOMES,
  OCULOS,
  carregar,
  codigo,
  deCodigo,
  lookDe,
  salvar,
  tituloDe,
  titulosDe,
  type IdTitulo,
  type Visual,
} from './visual';
import { ADMIN } from '../turma/index';

const GORE_KEY = 'cruzadabotecos.sangue.v1';
/** Sustos do banheiro (criaturas e a luz piscando): ligados por padrão. */
const SUSTOS_KEY = 'cruzadabotecos.sustos.v1';
/** O som de cada susto quando ele começa. */
const SOM_SUSTO: Record<Susto, Som | null> = { inquilino: 'grito', menina: 'chiado', chapeu: 'grito', toto: 'latido', reflexo: null, corredor: 'metal', radio: 'chiado' };
const DT = 1 / 60;

/* ------------------------------------------------------------------ sprites dos corpos */

const canvasOf = new WeakMap<Raster, HTMLCanvasElement>();
function toCanvas(r: Raster): HTMLCanvasElement {
  let c = canvasOf.get(r);
  if (!c) {
    c = document.createElement('canvas');
    c.width = r.w;
    c.height = r.h;
    c.getContext('2d')!.putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
    canvasOf.set(r, c);
  }
  return c;
}

function gridRaster(g: Grid, flip: boolean, branco: boolean): Raster {
  const h = g.length;
  const w = g[0].length;
  const r = new Raster(w, h);
  const W = hex('#ffffff');
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = g[y][x];
      if (c) r.set(flip ? w - 1 - x : x, y, branco ? W : hex(c));
    }
  return r;
}

type PoseBoneco = BarPose | 'punch' | 'hurt' | 'dead';
const bonecos = new Map<string, Sprite>();
/** Sangue no próprio boneco (modo sangue): quanto mais apanhou, mais manchas, sempre nos mesmos pixels. */
function ensanguentar(r: Raster, nivel: number, semente: number) {
  if (nivel <= 0) return;
  let h = semente >>> 0 || 1;
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822519) ^ Math.imul(h ^ (h >>> 13), 3266489917)) >>> 0) / 4294967296;
  const n = nivel * 9;
  const escuro = hex('#73172d');
  const vivo = hex('#a22633');
  for (let i = 0, tentou = 0; i < n && tentou < n * 8; tentou++) {
    const x = Math.floor(rnd() * r.w);
    const y = Math.floor(rnd() * r.h);
    const o = (y * r.w + x) * 4;
    if (r.data[o + 3] < 200 || (r.data[o] < 30 && r.data[o + 1] < 30)) continue; // só na roupa e na pele (não no contorno)
    const c = rnd() < 0.5 ? escuro : vivo;
    r.set(x, y, c);
    if (rnd() < 0.5 && y + 1 < r.h && r.data[o + r.w * 4 + 3] > 200) r.set(x, y + 1, c); // escorre
    i++;
  }
}
/** `cortes`: máscara das partes arrancadas (modo sangue, Fatia 4); o boneco perde braço, perna e cabeça aos poucos. */
function boneco(chave: string, L: Look, pose: PoseBoneco, flip: boolean, ink: number, branco: boolean, sangue = 0, cortes = 0): Sprite {
  const k = `${chave}|${pose}|${flip ? 1 : 0}|${ink}|${branco ? 1 : 0}|${sangue}|${cortes}`;
  let s = bonecos.get(k);
  if (s) return s;
  // Sem as duas pernas não fica de pé: rasteja (o corpo deitado, com o que sobrou).
  const rasteja = (cortes & 12) === 12 && pose !== 'ko-flat' && pose !== 'ko-bottle' && pose !== 'ko-slump';
  const deitado = pose === 'ko-flat' || pose === 'ko-bottle' || pose === 'dead' || rasteja;
  const base = rasteja
    ? buildDeadCortadoGridLook(L, cortes)
    : pose === 'punch' || pose === 'hurt'
      ? buildGridLook(L, pose)
      : pose === 'dead'
        ? cortes
          ? buildDeadCortadoGridLook(L, cortes)
          : buildDeadGridLook(L)
        : buildBarGridLook(L, pose as BarPose, ink);
  const g = cortes && !deitado ? cortarGrid(base, cortes, pose === 'punch' || pose === 'hurt' ? pose : 'normal') : base;
  const raster = gridRaster(polir(g), flip, branco);
  if (!branco) ensanguentar(raster, sangue, [...chave].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  let last = g.length - 1;
  while (last > 0 && g[last].every((c) => !c)) last--;
  s = deitado ? { raster, ax: Math.floor(raster.w / 2), ay: Math.floor(raster.h / 2) + 2 } : { raster, ax: Math.floor(raster.w / 2), ay: last - 1 };
  bonecos.set(k, s);
  return s;
}

/* ------------------------------------------------------------------ sangue, cacos e frases */

interface Gota {
  area: Zona;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  cor: string;
  tam: number;
  mancha: boolean;
  /** Fatia 8: quando nasceu (m.t), para a rampa de cor e o encolhimento pela idade. */
  nasce: number;
}

interface Texto {
  area: Zona;
  x: number;
  y: number;
  texto: string;
  cor: string;
  t0: number;
}

const MAX_GOTAS = 420;
/** Rajada do Fiado comprada e ainda não disparada (volta para a mão ao recarregar a página). */
const RAJADA_KEY = 'cruzadabotecos.rajada.v1';
/** O grito da Rajada do Fiado: em que ponto da carga sai cada sílaba. */
const SILABAS: readonly (readonly [number, string])[] = [[0.06, 'PEN…'], [0.3, 'DU…'], [0.55, 'RA…'], [0.8, 'NA…']];
/** Pedaço arrancado voando (cabeça, braço, perna): gira, quica, deixa rastro e vira decalque no chão. */
interface Pedaco {
  area: Zona;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ang: number;
  va: number;
  sp: Sprite;
  rastro: number;
}
/** Sangue jorrando em arco do toco (por uns segundos). */
interface Jorro {
  area: Zona;
  x: number;
  y: number;
  z: number;
  dx: number;
  ate: number;
  prox: number;
}
const MAX_PEDACOS = 24;
/** Quanto tempo o toco jorra depois de arrancado (ms). */
const JORRO_MS = 4200;
const pedacoSprites = new Map<string, Sprite>();
function pedacoSprite(chave: string, L: Look, parte: ParteCorpo, flip = false): Sprite {
  const k = `${chave}|${parte}|${flip ? 1 : 0}`;
  let s = pedacoSprites.get(k);
  if (!s) {
    const r = gridRaster(polir(buildPedacoGridLook(L, parte)), flip, false);
    s = { raster: r, ax: Math.floor(r.w / 2), ay: Math.floor(r.h / 2) };
    pedacoSprites.set(k, s);
  }
  return s;
}
/** Cor das lascas de cada móvel que quebra. */
const LASCAS: Partial<Record<string, string[]>> = {
  'mesa-bar': ['#8f563b', '#5c3620', '#c28a1f'],
  'cadeira-bar': ['#8f563b', '#5c3620'],
  banqueta: ['#e43b44', '#8b9bb4', '#5c3620'],
  'mesa-sol': ['#feae34', '#c28a1f', '#f4f4f4'],
  'cadeira-plastico': ['#feae34', '#f4f4f4', '#c28a1f'],
  vaso: ['#b86f50', '#3e8948', '#5a3a22'],
  engradados: ['#e43b44', '#feae34', '#3e8948'],
  lixeira: ['#ef7d57', '#4a4f5c', '#f4f4f4'],
};
const SANGUE = ['#7a0f1a', '#a3121f', '#c41e2a', '#e0303c'];
const MOLHO = ['#a8341a', '#d24a22', '#e8642e', '#f08a3c'];

/** Direção na tela (px) de um vetor em ladrilhos. */
const naTela = (dx: number, dy: number) => ({ x: (dx - dy) * (TW / 2), y: (dx + dy) * (TH / 2) });

/** Jogos que já abrem painel; o resto chega com os portais. */
type Painel = Exclude<Jogo, 'fliperama' | 'dardos'>;
const COM_PAINEL: readonly Jogo[] = ['cruzadas', 'palavra', 'anagrama', 'quiz', 'placar', 'mercado', 'bilhar1', 'bilhar2', 'portal', 'jukebox', 'porrinha', 'mural'];
/** Centro da jukebox (para o volume cair com a distância). */
const JUKEBOX_EM = (() => {
  const j = PROPS.find((p) => p.kind === 'jukebox');
  return j ? { x: j.x + 0.5, y: j.y + 0.5 } : { x: 18.5, y: 0.5 };
})();
/** Quebra a fala em linhas de até `max` letras (no máximo 3 linhas). */
function quebrarFala(texto: string, max = 22): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of texto.split(' ')) {
    if (cur && (cur + ' ' + w).length > max) {
      out.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) out.push(cur);
  return out.length > 3 ? [...out.slice(0, 2), out[2].slice(0, max - 1) + '…'] : out;
}

const FICHA_KEY = 'cruzadabotecos.ficha.v1';
function carregarFicha(p: PlayerId): number {
  try {
    const v = JSON.parse(localStorage.getItem(FICHA_KEY) || '{}')[p];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}
function salvarFicha(p: PlayerId, k: number) {
  try {
    const t = JSON.parse(localStorage.getItem(FICHA_KEY) || '{}');
    t[p] = k;
    localStorage.setItem(FICHA_KEY, JSON.stringify(t));
  } catch {
    // sem armazenamento: a ficha vive só no banco
  }
}
const CARTEIRA_KEY = 'cruzadabotecos.carteira.v1';
function carregarCarteira(p: PlayerId): Carteira {
  try {
    return sanitizeCarteira(JSON.parse(localStorage.getItem(CARTEIRA_KEY) || '{}')[p]);
  } catch {
    return { g: 0, a: 0 };
  }
}
function salvarCarteira(p: PlayerId, c: Carteira) {
  try {
    const t = JSON.parse(localStorage.getItem(CARTEIRA_KEY) || '{}');
    t[p] = c;
    localStorage.setItem(CARTEIRA_KEY, JSON.stringify(t));
  } catch {
    /* sem espaço: fica só na memória */
  }
}
/** Letreiros de neon das atividades: onde (ladrilho), a que altura e a cor; acendem mais quando você chega perto. */
/** Desenho do botão de soco quando há um item na mão (o item substitui o soco até acabar ou ser jogado fora). */
const ICONE_ARMA: Record<Arma, string> = {
  garrafa: '🍾', caco: '🔪', banqueta: '🪑', taco: '🎱', cadeira: '🪑', cano: '🔧', desentupidor: '🪠',
  cadeirao: '🪑', vaso: '🪴', engradado: '📦', lixeira: '🗑️', faca: '🔪', socoingles: '🥊', machadinha: '🪓',
  serra: '🪚', frigideira: '🍳', bastao: '🏏', violao: '🎸', extintor: '🧯', guardasol: '⛱️', tijolo: '🧱', espeto: '🍢',
  placa: '⚠️', rodo: '🧹', katana: '🗡️', marreta: '🔨', rajada: '🌟',
  tampinhas: '🪙', arroto: '💨', furacao: '🌪️', chope: '🍺', pagode: '🥁', raio: '⚡', torresmo: '☄️', garcom: '👻', pinga: '🔥', ima: '🧲',
  pano: '🧻', prego: '📌', fita: '🩹', raquete: '🏸', molotov: '🍶', tacoprego: '🏏', espuma: '🫧', sococaco: '🥊',
};

const LETREIROS: readonly { texto: string; at: readonly [number, number]; h: number; cor: string }[] = [
  { texto: 'CRUZADAS', at: [2.5, 2.4], h: 42, cor: '#2ce8f5' },
  { texto: 'PALAVRA DO DIA', at: [0.7, 7.6], h: 60, cor: '#feae34' },
  { texto: 'CERVEJA', at: [11.9, 0.6], h: 52, cor: '#feae34' },
  { texto: 'QUIZ GEEK', at: [16.9, 0.4], h: 66, cor: '#ff4fb0' },
  { texto: 'ANAGRAMA', at: [18.5, 0.5], h: 50, cor: '#63c74d' },
  { texto: 'SINUCA', at: [17.5, 2.5], h: 30, cor: '#2ce8f5' },
  { texto: 'SINUCA', at: [17.5, 6.5], h: 30, cor: '#2ce8f5' },
  { texto: 'MERCADO NEGRO', at: [36.5, 5.0], h: 44, cor: '#e43b44' },
  { texto: 'PROCURADOS', at: [34.0, 0.3], h: 66, cor: '#feae34' },
];

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'week', label: 'Semana' },
  { id: 'all', label: 'Geral' },
];
const LEVELS: { id: DifficultyLevel; label: string }[] = [
  { id: 'easy', label: 'Fácil' },
  { id: 'medium', label: 'Médio' },
  { id: 'hard', label: 'Difícil' },
];

/** Pichações do banheiro (u ao longo da parede do fundo, v de altura, em px da área). */
const PICHACOES: readonly { u: number; v: number; t: string; cor: string }[] = [
  { u: 22, v: 40, t: 'SEU ZÉ DEVE', cor: '#a22633' },
  { u: 24, v: 33, t: 'PRA MIM', cor: '#a22633' },
  { u: 80, v: 44, t: 'AQUI JAZ', cor: '#262b44' },
  { u: 80, v: 38, t: 'MEU RIM', cor: '#262b44' },
  { u: 82, v: 26, t: 'tonhão chora', cor: '#5a6988' },
];

interface Props {
  player: PlayerId;
  onExit: () => void;
  onPlay: (themeId: string, difficulty: DifficultyLevel) => void;
  period: Period;
  onPeriod: (p: Period) => void;
}

/* ------------------------------------------------------------------ a tela */

export default function VivoScreen({ player, onExit, onPlay, period, onPeriod }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mundo = useRef<Mundo | null>(null);
  const [visual, setVisual] = useState<Visual>(() => carregar(player));
  const visualRef = useRef(visual);
  visualRef.current = visual;
  const [gore, setGore] = useState(() => localStorage.getItem(GORE_KEY) !== '0');
  // Fatia 7: tremor e clarões seguem o "reduzir movimento" do sistema; o botão do menu troca (sistema, reduzido, cheio).
  const [prefMov, setPrefMov] = useState<PrefMovimento>(lerPrefMovimento);
  const [sistemaReduz, setSistemaReduz] = useState(sistemaPedeReduzido);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const ver = () => setSistemaReduz(mq.matches);
    mq.addEventListener('change', ver);
    return () => mq.removeEventListener('change', ver);
  }, []);
  const medidorRef = useRef<HTMLParagraphElement>(null);
  const reduzidoRef = useRef(false);
  reduzidoRef.current = movimentoReduzido(prefMov, sistemaReduz);
  const [sustos, setSustos] = useState(() => localStorage.getItem(SUSTOS_KEY) !== '0');
  const sustosRef = useRef(sustos);
  sustosRef.current = sustos;
  const goreRef = useRef(gore);
  goreRef.current = gore;
  const [som, setSom] = useState(isSoundEnabled());
  const [painel, setPainel] = useState(false);
  const [hud, setHud] = useState({ vida: 100, ko: false, nocautes: 0, arma: '', tipo: '' as Arma | '', usos: 0, usosMax: 0, dica: '', calor: 0, happy: false });
  const [avisos, setAvisos] = useState<{ id: number; texto: string }[]>([]);
  /** Painel de jogo aberto (caderneta, quadro, jukebox, TV/sinuca, lousa). */
  const [jogo, setJogo] = useState<Painel | null>(null);
  const [gfa, setGfa] = useState(false);
  // Fatia 13: inventário dos portais (prêmios, Pó, pity, runs do dia) e a Moscaria aberta.
  const [inv, setInv] = useState<Inventario>(() => carregarInventario(player));
  // Fatia 14: qual portal está aberto (o do dia) e, só em desenvolvimento, o portal forçado para testar o outro.
  const [portalAberto, setPortalAberto] = useState<IdPortal | null>(null);
  const [portalForcado, setPortalForcado] = useState<IdPortal | null>(null);
  const [amigosQm, setAmigosQm] = useState<AmigoPlacar[]>([]);
  const [fantasmasMc, setFantasmasMc] = useState<FantasmaAmigo[]>([]);
  const invRef = useRef(inv);
  // Inventário no banco (Fatia 13): cada prêmio gravado uma vez, Pó com ganho e gasto que só sobem. Aparelho e banco
  // se juntam pelo maior; o que falta no banco sobe de novo (no máximo a cada 2 s; 3 recusas seguidas e desiste até a
  // próxima mudança). Só depois do primeiro retrato do banco, para não regravar o que ainda não chegou.
  const invFila = useRef({ ultimo: 0, falhas: 0, indo: false, timer: 0 });
  const invDoBanco = useCallback((): Inventario => {
    const it = (barPresence.inventarioRaw() as Record<string, unknown>)[player];
    const po = (barPresence.poRaw() as Record<string, unknown>)[player];
    return limparInventario({ ...invRef.current, itens: it && typeof it === 'object' ? Object.keys(it) : [], po: po ?? { g: 0, s: 0 } });
  }, [player]);
  const subirInv = useRef(() => {});
  subirInv.current = () => {
    const f = invFila.current;
    if (f.indo || f.timer || f.falhas >= 3 || !barPresence.retrato) return;
    const banco = invDoBanco();
    const local = invRef.current;
    const faltam = local.itens.filter((x) => !banco.itens.includes(x));
    const poFalta = local.po.g > banco.po.g || local.po.s > banco.po.s;
    if (!faltam.length && !poFalta) return;
    const espera = f.ultimo + 2000 - Date.now();
    if (espera > 0) {
      f.timer = window.setTimeout(() => {
        f.timer = 0;
        subirInv.current();
      }, espera);
      return;
    }
    f.indo = true;
    f.ultimo = Date.now();
    void Promise.all([...faltam.map((x) => barPresence.ganharItem(x)), poFalta ? barPresence.sendPo(local.po.g, local.po.s) : Promise.resolve(true)]).then((oks) => {
      f.indo = false;
      f.falhas = oks.every(Boolean) ? 0 : f.falhas + 1;
    });
  };
  const mudarInv = useCallback(
    (novo: Inventario) => {
      invRef.current = novo;
      setInv(novo);
      salvarInventario(player, novo);
      invFila.current.falhas = 0;
      subirInv.current();
    },
    [player],
  );
  useEffect(() => {
    const ver = () => {
      const j = juntarInv(invRef.current, invDoBanco());
      const a = invRef.current;
      if (j.itens.length !== a.itens.length || j.po.g !== a.po.g || j.po.s !== a.po.s) {
        invRef.current = j;
        setInv(j);
        salvarInventario(player, j);
      }
      subirInv.current();
    };
    ver();
    const sair = barPresence.subscribe(ver);
    return () => {
      sair();
      window.clearTimeout(invFila.current.timer);
      invFila.current.timer = 0;
    };
  }, [player, invDoBanco]);
  // Placar do dia de um portal: o melhor de cada amigo hoje (mesma semente para todos) e, na Moscaria, o fantasma.
  const placarHoje = useCallback((portal: IdPortal) => {
    const raw = (barPresence.placarRaw(portal) ?? {}) as Record<string, { s?: unknown; f?: unknown; v?: unknown; t?: unknown } | undefined>;
    const hoje = startOfDay(barPresence.now());
    const versao = VERSAO_PORTAL[portal];
    return PLAYERS.flatMap((p) => {
      const e = raw[p.id];
      if (!e || typeof e.t !== 'number' || e.t < hoje || typeof e.s !== 'number') return [];
      if (portal !== 'moscas' && e.v !== versao) return [];
      return [{ id: p.id, nome: p.name, cor: p.color, s: e.s, pts: portal === 'moscas' && e.v === versao ? lerFantasma(e.f) : [] }];
    }).sort((a, b) => b.s - a.s);
  }, []);
  // Na Dimensão GFA o bar fica parado (você some de lá): sem andar, sem apanhar.
  const gfaRef = useRef(gfa);
  gfaRef.current = gfa;
  const [portalEm, setPortalEm] = useState(() => Number(localStorage.getItem(PORTAL_KEY)) || 0);
  // Carteira do bar: pontos do placar ÷ 10 + o que achou − o que gastou (aparelho e banco: vale o maior).
  const arvore = useScoreTree();
  const pontos = pontosDe(arvore[player]);
  const [carteira, setCarteira] = useState<Carteira>(() => carregarCarteira(player));
  const carteiraRef = useRef(carteira);
  // Carteira para o banco numa fila só: uma gravação por vez, no máximo a cada 600 ms (a regra recusa < 500 ms), sempre
  // com o valor mais novo. Pegou 3 notas seguidas: a última gravação leva a soma. Recusada (regra antiga, sem rede):
  // tenta mais 3 vezes e desiste; a carteira continua no aparelho.
  const lojaFila = useRef({ enviado: { g: -1, a: -1 }, ultimo: 0, timer: 0, falhas: 0 });
  const enviarLoja = useRef(() => {});
  enviarLoja.current = () => {
    const f = lojaFila.current;
    if (f.timer) return;
    f.timer = window.setTimeout(
      async () => {
        const c = carteiraRef.current;
        f.ultimo = Date.now();
        const ok = await barPresence.sendLoja(c.g, c.a);
        f.timer = 0;
        if (ok) {
          f.enviado = { g: c.g, a: c.a };
          f.falhas = 0;
        } else f.falhas++;
        const agora = carteiraRef.current;
        if ((agora.g !== f.enviado.g || agora.a !== f.enviado.a) && f.falhas <= 3) enviarLoja.current();
      },
      Math.max(0, f.ultimo + 600 - Date.now()),
    );
  };
  useEffect(() => () => window.clearTimeout(lojaFila.current.timer), []);
  // Ficha dos procurados: os nocautes que você causa somam aqui e sobem ao banco aos poucos (+10 por vez, a cada 2 s).
  const fichaLocal = useRef(carregarFicha(player));
  const fichaFila = useRef({ timer: 0, ultimo: 0, falhas: 0, enviado: 0 });
  const enviarFicha = useRef(() => {});
  enviarFicha.current = () => {
    const f = fichaFila.current;
    if (f.timer) return;
    const banco = Math.max(sanitizeFicha(barPresence.fichaRaw())[player], f.enviado);
    if (fichaLocal.current < banco) {
      fichaLocal.current = banco;
      salvarFicha(player, banco);
    }
    const k = proximoEnvio(fichaLocal.current, banco);
    if (k === null || f.falhas > 3) return;
    f.timer = window.setTimeout(
      async () => {
        f.ultimo = Date.now();
        const ok = await barPresence.sendFicha(k);
        f.timer = 0;
        if (ok) {
          f.enviado = Math.max(f.enviado, k);
          f.falhas = 0;
        } else f.falhas++;
        enviarFicha.current();
      },
      Math.max(0, f.ultimo + ESPERA_FICHA_MS - Date.now()),
    );
  };
  const contarMortes = useRef((n: number) => {
    fichaLocal.current += n;
    salvarFicha(player, fichaLocal.current);
    fichaFila.current.falhas = 0;
    enviarFicha.current();
  });
  useEffect(() => {
    enviarFicha.current();
    return () => window.clearTimeout(fichaFila.current.timer);
  }, []);
  const mudarCarteira = useCallback(
    (nova: Carteira) => {
      carteiraRef.current = nova;
      setCarteira(nova);
      salvarCarteira(player, nova);
      lojaFila.current.falhas = 0;
      enviarLoja.current();
    },
    [player],
  );
  useEffect(() => {
    const ver = () => {
      const r = barPresence.lojaRaw();
      if (!r) return;
      const j = juntar(carteiraRef.current, sanitizeCarteira(r));
      if (j.g !== carteiraRef.current.g || j.a !== carteiraRef.current.a) {
        carteiraRef.current = j;
        setCarteira(j);
        salvarCarteira(player, j);
      }
    };
    ver();
    return barPresence.subscribe(ver);
  }, [player]);
  // Livro do caixa (Fatia 7): toda entrada e saída do dia, por origem, para medir a economia.
  const [caixa, setCaixa] = useState<Caixa>(() => carregarCaixa(player));
  const lancarCaixa = useCallback(
    (lado: 'e' | 's', origem: string, v: number) =>
      setCaixa((c) => {
        const n = lancar(c, Date.now(), lado, origem, v);
        salvarCaixa(player, n);
        return n;
      }),
    [player],
  );
  const ganhar = useRef<(v: number, origem: string) => void>(() => {});
  ganhar.current = (v: number, origem: string) => {
    mudarCarteira(acharGrana(carteiraRef.current, v));
    lancarCaixa('e', origem, v);
  };
  const fecharJogo = useCallback(() => setJogo(null), []);
  // Fatia 20: o que cada NPC lembra de você (só neste aparelho): curativo, apelido e reconhecimento.
  const memoria = useRef<Memoria>(carregarMemoria(player));
  const reconheceu = useRef(new Map<string, number>());
  // Fatia 18: o narrador da Rádio Saideira (fila com prioridade, sem repetir e sem falar por cima de si).
  const narrador = useRef(novoNarrador());
  const narrRng = useRef(rngMesa((Date.now() ^ 0x5a1de) >>> 0));
  const [radio, setRadio] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => {
      const f = proximaFala(narrador.current, Date.now());
      if (f) setRadio(f);
      else if (!narrador.current.atual) setRadio(null);
    }, 250);
    return () => window.clearInterval(t);
  }, []);
  // "Enquanto você tava fora": na chegada (com o livro do bar já carregado), um resumo do que aconteceu; depois, um
  // boato do mural de vez em quando.
  useEffect(() => {
    const chave = `cruzadabotecos.visto.v1.${player}`;
    // Espera o livro do bar chegar (até 20 s); só então resume e marca a visita.
    let desde = 0;
    try {
      desde = Number(localStorage.getItem(chave)) || 0;
    } catch {
      /* sem localStorage: sem resumo */
    }
    let tentativas = 0;
    const chegada = window.setInterval(() => {
      const livro = livroDoBar(barPresence.barRaw());
      if (!livro.length && ++tentativas < 20) return;
      window.clearInterval(chegada);
      const r = desde > 0 ? resumoAusencia(livro, desde) : null;
      if (r) narrar(narrador.current, 'voltou', Date.now(), narrRng.current, r);
      try {
        localStorage.setItem(chave, String(Date.now()));
      } catch {
        /* nada */
      }
    }, 1000);
    const boatos = window.setInterval(() => {
      const m = muralDoDia(livroDoBar(barPresence.barRaw()), diaBrasilia(Date.now()));
      if (m.length) narrar(narrador.current, 'boato', Date.now(), narrRng.current, m[Math.floor(narrRng.current() * m.length)].texto);
      try {
        localStorage.setItem(chave, String(Date.now()));
      } catch {
        /* nada */
      }
    }, 150_000);
    return () => {
      window.clearInterval(chegada);
      window.clearInterval(boatos);
    };
  }, [player]);
  const fimPorrinha = (escapou: boolean) => {
    const nome = NOME_J[player as Jogador] ?? 'Você';
    if (escapou) {
      narrar(narrador.current, 'porrinha_ganhou', Date.now(), narrRng.current, nome);
      if (contaPorrinha(player) < PORRINHA_PAGAS_DIA) {
        somarPorrinha(player);
        ganhar.current(PORRINHA_RODADA, 'porrinha');
        avisar(`Você saiu da mesa: quem sobrar paga a rodada. +R$ ${PORRINHA_RODADA}`);
      } else avisar(`Você saiu da mesa. Hoje a mesa já pagou ${PORRINHA_PAGAS_DIA} vezes: agora é só pela glória.`);
      return;
    }
    if (saldo(pontos, carteiraRef.current) >= PORRINHA_RODADA) {
      mudarCarteira({ g: carteiraRef.current.g + PORRINHA_RODADA, a: carteiraRef.current.a });
      lancarCaixa('s', 'porrinha', PORRINHA_RODADA);
      narrar(narrador.current, 'porrinha_perdeu', Date.now(), narrRng.current, nome);
      avisar(`Sobrou pra você: −R$ ${PORRINHA_RODADA} da rodada.`);
    } else {
      narrar(narrador.current, 'porrinha_fiado', Date.now(), narrRng.current, nome);
      avisar('Sem grana pra rodada: o Seu Zé pendurou no fiado (e não cobra, por enquanto).');
    }
  };
  // Chat do bar (Fatia 6): usa bar/chat (as mesmas regras do bar antigo); a fala vira balão em cima da cabeça.
  const chat = useSyncExternalStore(
    (fn) => barPresence.subscribe(fn),
    () => barPresence.chat,
  );
  const [chatAberto, setChatAberto] = useState(false);
  const [chatTexto, setChatTexto] = useState('');
  const [relogioChat, setRelogioChat] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setRelogioChat(Date.now()), 2000);
    return () => window.clearInterval(t);
  }, []);
  const mandarChat = async () => {
    const m = chatTexto.trim();
    if (!m) return;
    if (barPresence.waitMs() > 0) {
      avisar('Calma: uma mensagem a cada 2 s.');
      return;
    }
    const ok = await barPresence.say(m);
    if (ok) setChatTexto('');
    else avisar('A mensagem não saiu (sem rede?). Tenta de novo.');
  };
  // Jukebox (Fatia 6): a faixa do bar inteiro vem de bar/juke; sem escolha, a da hora.
  const [juke, setJuke] = useState<Juke | null>(() => sanitizeJuke(barPresence.jukeRaw()));
  const jukeRef = useRef(juke);
  jukeRef.current = juke;
  useEffect(() => {
    const ver = () => {
      const j = sanitizeJuke(barPresence.jukeRaw());
      setJuke((a) => (a && j && a.s === j.s && a.t === j.t ? a : j));
    };
    ver();
    return barPresence.subscribe(ver);
  }, []);
  const escolherFaixa = async (s: number) => {
    const ok = await barPresence.sendJuke(s);
    if (!ok) avisar('A jukebox ainda está trocando: espere uns segundos.');
    else avisar(s < 0 ? 'Jukebox desligada.' : `Tocando: ${FAIXAS[s].name}`);
  };

  const [level, setLevel] = useState<DifficultyLevel>('medium');
  const [theme, setTheme] = useState<string>(ALL_PACK.id);
  const { rows, hit } = useStandings(period);
  const lider = useRef<Standing | null>(null);
  lider.current = rows[0] && rows[0].total > 0 && (rows.length < 2 || rows[1].total < rows[0].total) ? rows[0] : null;
  // Com painel aberto o teclado e o joystick são do painel, não da briga.
  const travado = useRef(false);
  // Fatia 15: modo foto (congela, esconde a interface, escolhe a pose), livro do bar, quem te zoou dormindo, brinde.
  const fotoRef = useRef<{ on: boolean; pose: PoseBoneco | null }>({ on: false, pose: null });
  const [foto, setFoto] = useState(false);
  const [fotoPose, setFotoPose] = useState<PoseBoneco | null>(null);
  const [livro, setLivro] = useState(false);
  const [zoado, setZoado] = useState<{ quem: string; n: number } | null>(null);
  /** Brinde: quando você levantou o copo (hora do servidor), os copos no alto por corpo e os pares já pagos. */
  const brinde = useRef({ meu: -1e15, copos: new Map<string, number>(), pagos: new Set<string>(), faiscas: [] as { x: number; y: number; ate: number }[] });
  const reviver = useRef<Reviver>(REVIVER_ZERO);
  const conferirBrinde = useRef<(p: string, t: number) => void>(() => {});
  const brindarAgora = useRef<() => void>(() => {});
  const redesenhar = useRef<() => void>(() => {});
  const entrarFoto = useRef<() => void>(() => {});
  entrarFoto.current = () => {
    fotoRef.current = { on: true, pose: null };
    setFotoPose(null);
    setFoto(true);
  };
  const sairFoto = () => {
    fotoRef.current = { on: false, pose: null };
    teclas.current.clear();
    setFoto(false);
  };
  const sairFotoAgora = useRef(sairFoto);
  sairFotoAgora.current = sairFoto;
  const posar = (p: PoseBoneco | null) => {
    fotoRef.current = { on: true, pose: p };
    setFotoPose(p);
    redesenhar.current();
  };
  const salvarFoto = () => {
    const cv = canvasRef.current;
    if (!cv) return;
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    // Hora local de quem tirou (toISOString daria a de Greenwich).
    const d = new Date();
    const dd = (n: number) => String(n).padStart(2, '0');
    a.download = `boteco-${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}-${dd(d.getHours())}${dd(d.getMinutes())}${dd(d.getSeconds())}.png`;
    a.click();
  };
  travado.current = jogo !== null || painel;

  // Entrada: teclas apertadas, joystick (direção na tela) e os toques de botão (consumidos no passo seguinte).
  const teclas = useRef(new Set<string>());
  const stick = useRef({ x: 0, y: 0 });
  const toque = useRef({ soco: false, agarra: false, usa: false, apara: false });
  // Fatia 12: o botão de golpe da tela continua apertado (carga) e o último toque no joystick (toque duplo = aparar).
  const socoPreso = useRef(false);
  const stickToque = useRef(0);

  const avisar = useCallback((texto: string) => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a.slice(-2), { id, texto }]);
    window.setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 2600);
  }, []);

  // Os painéis dos jogos leem e escrevem no Firebase como você (sem pôr ninguém sentado no bar antigo).
  useEffect(() => {
    barPresence.observe(player);
  }, [player]);
  // Quem dormiu zoado fica sabendo quem foi e o que fizeram quando o bar carrega (e limpa quando quiser).
  const limparCara = useRef<() => void>(() => {});
  useEffect(() => {
    let visto = false;
    let vivo = true;
    let timer = 0;
    // A limpeza grava com o carimbo de 2 s (o mesmo do bar): espera a vez e tenta de novo se o banco recusar.
    const limpar = (n: number) => {
      if (!vivo) return;
      timer = window.setTimeout(async () => {
        if (!vivo || (barPresence.marks[player]?.n ?? 0) === 0) return;
        const ok = await barPresence.mark(player, 0);
        if (!ok && n > 0) limpar(n - 1);
      }, barPresence.waitMs() + 150);
    };
    const ver = () => {
      if (visto || barPresence.status !== 'live') return;
      visto = true;
      const mk = barPresence.marks[player];
      if (mk && mk.n > 0) {
        // Fatia 15: não limpa sozinho. A cara fica zoada (os amigos online veem) até você apertar "Limpar a cara".
        setZoado({ quem: PLAYER_BY_ID[mk.by]?.name ?? 'Alguém', n: mk.n });
      }
    };
    ver();
    const des = barPresence.subscribe(ver);
    limparCara.current = () => limpar(4);
    return () => {
      vivo = false;
      window.clearTimeout(timer);
      des();
    };
  }, [player, avisar]);
  useEffect(() => {
    if (!travado.current) return;
    teclas.current.clear();
    stick.current = { x: 0, y: 0 };
    toque.current = { soco: false, agarra: false, usa: false, apara: false };
    socoPreso.current = false;
  }, [jogo, painel]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const m = mundo.current;
      if (!m || gfaRef.current || document.hidden || !isSoundEnabled()) {
        jukebox.stop();
        return;
      }
      const agora = barPresence.now();
      const j = jukeRef.current;
      const s = j ? j.s : faixaDaHora(agora);
      if (s < 0) {
        jukebox.stop();
        return;
      }
      const f = FAIXAS[s];
      const me = eu(m);
      jukebox.setVolume(volumeJukebox(me.x, me.y, JUKEBOX_EM.x, JUKEBOX_EM.y, zonaDe(me.x, me.y) === zonaDe(JUKEBOX_EM.x, JUKEBOX_EM.y)));
      if (jukebox.playing() !== f.id) jukebox.playSong(f, passoAgora(f, j ? j.t : Math.floor(agora / 3_600_000) * 3_600_000, agora));
    }, 300);
    return () => {
      window.clearInterval(t);
      jukebox.stop();
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (travado.current || gfaRef.current) return;
      const k = e.code;
      // Fatia 15: no modo foto o mundo está parado; Esc (ou P) volta, o resto não faz nada.
      if (fotoRef.current.on) {
        if (k === 'Escape' || k === 'KeyP') {
          e.preventDefault();
          sairFotoAgora.current();
        }
        return;
      }
      // Enter (ou T) abre o chat.
      if (k === 'Enter' || k === 'KeyT') {
        e.preventDefault();
        teclas.current.clear();
        setChatAberto(true);
        return;
      }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
      if (!e.repeat) {
        if (k === 'KeyJ' || k === 'Space') toque.current.soco = true;
        if (k === 'KeyK') toque.current.agarra = true;
        if (k === 'KeyE') toque.current.usa = true;
        if (k === 'KeyL') toque.current.apara = true;
        // Fatia 15: B levanta o copo (brinde), P abre o modo foto.
        if (k === 'KeyB') brindarAgora.current();
        if (k === 'KeyP') entrarFoto.current();
      }
      teclas.current.add(k);
    };
    const up = (e: KeyboardEvent) => teclas.current.delete(e.code);
    const blur = () => teclas.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const low = document.createElement('canvas');
    const lc = low.getContext('2d')!;
    // Cada área tem a sua tela lógica: fundo pintado uma vez e o chão de manchas (sangue fica onde caiu).
    const novaArea = (z: Zona) => {
      const L = LAYOUTS[z];
      const cv = document.createElement('canvas');
      cv.width = L.w;
      cv.height = L.h;
      const manchas = new Raster(L.w, L.h);
      // Fatia 9: o chão de manchas reenvia só o retângulo que mudou (`ret`); `tudo` = reenviar inteiro.
      return {
        L, fundo: toCanvas(pintarFundo(z)), manchas, img: new ImageData(manchas.data, L.w, L.h), cv, ctx: cv.getContext('2d')!,
        suja: false, tudo: false, ret: null as Ret | null, em: 0,
      };
    };
    const areas: Record<Zona, ReturnType<typeof novaArea>> = { bar: novaArea('bar'), banheiro: novaArea('banheiro') };
    let zonaVista: Zona | null = null;

    // O mundo segue a hora do servidor (a rotina dos NPCs, a treta e os carros ficam iguais em todo aparelho).
    let m = novoMundo(player as AmigoId, barPresence.now(), Date.now() >>> 0);
    {
      // O poder comprado volta na mão ao recarregar ('1' é a rajada da Fatia 5).
      const guardado = localStorage.getItem(RAJADA_KEY);
      if (guardado) eu(m).arma = { tipo: ehPoder(guardado) ? guardado : 'rajada', usos: 1 };
    }
    mundo.current = m;
    const elo = new Elo(player as AmigoId);
    // Antes de medir a hora do servidor o mundo nasce na hora do aparelho; medida (ou 1,5 s depois), se o aparelho
    // estava adiantado ou atrasado mais de 1 s, o mundo é refeito na hora certa (você fica onde estava).
    const inicio = performance.now();
    let relogioPronto = false;
    const acertarRelogio = (agora: number) => {
      if (relogioPronto) return;
      const srv = barPresence.now();
      const d = decidirRelogio(barPresence.relogioOk, agora - inicio, srv, m.t);
      if (d === 'esperar') return;
      relogioPronto = true;
      if (d === 'manter') return;
      const velho = eu(m);
      m = novoMundo(player as AmigoId, srv, Date.now() >>> 0);
      Object.assign(eu(m), { x: velho.x, y: velho.y, fx: velho.fx, fy: velho.fy, vida: velho.vida, arma: velho.arma });
      mundo.current = m;
      laco.acc = 0;
      if (import.meta.env.DEV) (window as unknown as { __vivo?: { m: Mundo } }).__vivo!.m = m;
    };
    const gotas: Gota[] = [];
    // Ambiente (fogo, fumaça, postes, portal, poeira, goteira, moscas): só enfeite, cada aparelho o seu.
    const amb = montarAmbiente();
    const ambiente = novoAmbiente(Math.random, MAX_FAGULHAS);
    let ambEm = 0;
    const textos: Texto[] = [];
    // Fatia 5: onomatopeias, ondas de choque, chão queimado pela rajada e o grito sílaba por sílaba.
    const onos: (Texto & { grande?: boolean })[] = [];
    const ondas: { area: Zona; x: number; y: number; t0: number; raio: number; cor: string }[] = [];
    const queimados: { area: Zona; ax: number; ay: number; bx: number; by: number; len: number; t0: number }[] = [];
    const silabas = new Map<string, number>();
    const estouradas = new WeakSet<object>();
    // Fatia 7: no máximo 3 clarões de tela cheia por segundo (rajada e poderes).
    const claroes = new LimiteClarao();
    let ultimoTremor = 0;
    // Fatia 9: luz pronta (sprite de gradiente feito uma vez), mapa de luz da hora, brilho, véu de evento, pontilhado e
    // o orçamento que desce de nível sozinho.
    const luzes = new Map<string, HTMLCanvasElement>();
    const luzPronta = (cor: string, r: number) => {
      const k = chaveLuz(cor, r);
      let c = luzes.get(k);
      if (c) return c;
      const R = Number(k.split('|')[1]);
      c = document.createElement('canvas');
      c.width = c.height = R * 2;
      const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(R, R, 0, R, R, R);
      gr.addColorStop(0, cor);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, R * 2, R * 2);
      if (luzes.size < 96) luzes.set(k, c);
      return c;
    };
    const luzesQuadro: { x: number; y: number; r: number; cor: string; a: number }[] = [];
    const mapa = document.createElement('canvas');
    const mc = mapa.getContext('2d')!;
    const bloom = document.createElement('canvas');
    const bc = bloom.getContext('2d')!;
    /** Lâmpadas do salão (só no mapa de luz): o bar de noite fica aceso por dentro, a rua não. */
    const lampadas: { x: number; y: number }[] = [];
    for (let lx = 2.5; lx < GRADE; lx += 4.5) for (let ly = 1.5; ly <= FACHADA; ly += 3.5) lampadas.push({ x: lx, y: ly });
    const veu: { ev: Grading | null; k: number } = { ev: null, k: 0 };
    let horaFixa: number | null = null;

    // Fatia 10: o diretor de eventos. A agenda é função pura da hora do servidor; o banco só guarda a abertura (quantos
    // estavam no bar), o fim (bicho morto, luz religada), o livro de dano de cada um e os troféus.
    const PORTA_RATO: Ponto = [0.7, 5.5];
    const COMIDAS: Ponto[] = [[4.5, 3.4], [6.5, 3.4], [8.5, 3.4], [4.6, 6.5], [9.6, 8.5], [11.5, 1.3], [1.1, 3.5], [10.5, 4.5]];
    const DISJUNTOR: Ponto = [10.5, 0.8];
    const EMERGENCIA: Ponto = [0.6, 5.0];
    /** Gancho de teste: forçar um evento aqui, sem banco. */
    let cfgLocal: ConfigEventos | null = null;
    let agCache: { e: number; ag: Agendado | null; cfg: string } = { e: -1, ag: null, cfg: '' };
    const evNovo = () => ({
      ag: null as Agendado | null,
      fase: 'fora' as 'aviso' | 'andamento' | 'fora',
      n: 1,
      H: 0,
      restante: 0,
      meuDano: 0,
      enviado: 0,
      enviadoEm: 0,
      fim: null as { como: string; p: string; at: number } | null,
      abriu: false,
      fechou: false,
      premiado: false,
      avisou: '',
      lamaEm: 0,
      rato: null as ReturnType<typeof posRato> | null,
      // Fatia 11: dano por bicho (alien, disco0..5, grande), o que já foi gravado, NPCs levados e no feixe.
      danoPor: {} as Record<string, number>,
      enviadoPor: {} as Record<string, number>,
      alvos: [] as string[],
      levados: new Set<string>(),
      derrubados: new Set<string>(),
      levantando: new Map<string, number>(),
      queimouEm: -1,
      acabou: false,
      // Fatia 17: dragão (cabeça no furo, sopros, poças, pisões) e dinossauro (rota, investidas que já te pegaram).
      furos: [] as number[],
      sopros: null as Sopro[] | null,
      pisoesL: [] as { t: number; furo: Ponto }[],
      pisoes: new Set<number>(),
      dragao: null as { fase: number; furo: Ponto } | null,
      sopro: null as { s: Sopro; fase: 'aviso' | 'ativo' } | null,
      pocas: [] as { x: number; y: number; ate: number; id: string }[],
      queimados: new Set<number>(),
      pocaEm: -1e15,
      sonoAte: 0,
      rotaD: null as TrechoDino[] | null,
      dino: null as PosDino | null,
      dinoDtAnt: -1,
      batidas: new Set<number>(),
      atordoaAte: 0,
      // Um susto da geladeira por investida (apertar E sem parar não dá imunidade).
      sustoId: -2,
      pisadaEm: -1e15,
    });
    let ev = evNovo();
    const VEZES_KEY = `cruzadabotecos.eventos.v1.${player}`;
    /** Quantas vezes você já ganhou este evento hoje (o dia vira às 6 h de Brasília); `somar` conta mais uma. */
    const lerVezes = () => {
      const o = JSON.parse(localStorage.getItem(VEZES_KEY) || 'null') as { d?: string; n?: Record<string, number>; p?: string[] } | null;
      const d = dayKey(barPresence.now());
      return { d, n: o && o.d === d && o.n ? o.n : {}, p: o && o.d === d && Array.isArray(o.p) ? o.p.slice(-40) : [] };
    };
    const vezesHoje = (tipo: string, somar = false): number => {
      try {
        const { d, n: hoje, p } = lerVezes();
        const n = typeof hoje[tipo] === 'number' ? hoje[tipo] : 0;
        if (somar) localStorage.setItem(VEZES_KEY, JSON.stringify({ d, n: { ...hoje, [tipo]: n + 1 }, p }));
        return n;
      } catch {
        return 0;
      }
    };
    /**
     * Prêmio de evento uma vez por época neste aparelho: recarregar a página no meio ou no fim do evento não paga de
     * novo. Devolve o valor pago (0 se já tinha pago esta época).
     */
    const pagarEvento = (tipo: string, base: number): number => {
      if (!ev.ag) return 0;
      const chave = `${ev.ag.epoca}:${tipo}`;
      try {
        if (lerVezes().p.includes(chave)) return 0;
        const v = premio(base, vezesHoje(tipo, true));
        const o = lerVezes();
        localStorage.setItem(VEZES_KEY, JSON.stringify({ d: o.d, n: o.n, p: [...o.p, chave] }));
        ganhar.current(v, 'evento');
        narrar(narrador.current, 'evento_fim', Date.now(), narrRng.current, NOME_J[player as Jogador] ?? 'você');
        return v;
      } catch {
        return 0;
      }
    };
    let limpouVelhos = false;
    let nivel: Nivel = 0;
    const custos: number[] = [];
    let nivelEm = 0;
    const limiteGotas = () => (nivel === 2 ? MAX_GOTAS / 2 : MAX_GOTAS);
    const padroes = new Map<string, CanvasPattern>();
    const ancora = { x: 0, y: 0 };
    /** Cor pontilhada (Bayer 4×4) em vez de alfa liso, presa ao mundo (não escorrega quando a câmera anda). */
    const padraoBayer = (cor: string, nivelP: number): CanvasPattern | string => {
      const n = Math.round(Math.max(0, Math.min(1, nivelP)) * 16);
      if (n <= 0) return 'rgba(0,0,0,0)';
      const k = `${cor}|${n}`;
      let p = padroes.get(k);
      if (!p) {
        const c = document.createElement('canvas');
        c.width = c.height = 4;
        const g = c.getContext('2d')!;
        g.fillStyle = cor;
        mascaraBayer(n / 16).forEach((on, i) => on && g.fillRect(i % 4, Math.floor(i / 4), 1, 1));
        p = lc.createPattern(c, 'repeat')!;
        if (padroes.size < 256) padroes.set(k, p);
      }
      p.setTransform(new DOMMatrix([1, 0, 0, 1, -ancora.x, -ancora.y]));
      return p;
    };
    const medidor = { ligado: medidorLigado(), m: new Medidor(), em: 0 };
    const teclaMedidor = (e: KeyboardEvent) => {
      if (e.key !== 'F2') return;
      e.preventDefault();
      medidor.ligado = !medidor.ligado;
      guardarMedidor(medidor.ligado);
      if (medidorRef.current) {
        medidorRef.current.hidden = !medidor.ligado;
        medidorRef.current.textContent = medidor.ligado ? 'medindo…' : '';
      }
    };
    window.addEventListener('keydown', teclaMedidor);
    if (medidorRef.current) medidorRef.current.hidden = !medidor.ligado;
    const pedacos: Pedaco[] = [];
    const jorros: Jorro[] = [];
    const pingaEm = new Map<string, number>();
    // Banheiro assombrado: os sustos são deste aparelho; o espelho guarda você de 1 s atrás.
    const assombro = novoAssombro();
    let sustoVisto = 0;
    let chiadoEm = 0;
    const espelhoHist: { t: number; sp: Sprite }[] = [];
    const cam = { x: 0, y: 0, ok: false };
    let raf = 0;
    let antes = performance.now();
    const laco = { acc: 0 };
    let hudEm = 0;
    let rastroEm = 0;
    let npcEm = 0;
    let npcUltima = '';

    const sangue = () => (goreRef.current ? SANGUE : MOLHO);
    const pingar = (z: Zona, x: number, y: number, cor: string, tam = 1, a = 230) => {
      const c = hex(cor, a);
      const ar = areas[z];
      for (let i = 0; i < tam; i++) for (let j = 0; j < tam; j++) ar.manchas.set(Math.round(x) + i, Math.round(y) + j, c);
      ar.ret = sujar(ar.ret, Math.round(x), Math.round(y), tam);
      ar.suja = true;
    };
    /** Fatia 8: marca pronta (queimado, rachadura, poça) gravada pixel a pixel no chão de manchas. */
    const gravarMarca = (z: Zona, x: number, y: number, px: PixelMarca[], tons: readonly string[]) => {
      for (const p of px) pingar(z, x + p.dx, y + p.dy, tons[p.tom], 1, p.a);
    };
    /** Poças onde dá para pisar (quem passa leva pegada por 8 passos); a Maria limpa e a poça sai da lista. */
    const pocas: { area: Zona; x: number; y: number; r: number; cor: string }[] = [];
    const pocaEm = (z: Zona, x: number, y: number, r: number, cor: string) => {
      const rp = rampaGota(cor);
      gravarMarca(z, Math.round(x), Math.round(y), pocaDegrau(r, (Math.round(x) * 73856093) ^ (Math.round(y) * 19349663) ^ Math.round(m.t)), [rp[2], rp[1], rp[0]]);
      if (r >= 3) {
        pocas.push({ area: z, x: Math.round(x), y: Math.round(y), r, cor: rp[2] });
        if (pocas.length > 24) pocas.shift();
      }
    };
    const poca = (z: Zona, x: number, y: number, r: number) => {
      const s = sangue();
      for (let i = 0; i < r * 9; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * r;
        pingar(z, x + Math.cos(a) * d * 1.6, y + Math.sin(a) * d * 0.8, s[i % 2], 2, 200);
      }
      pocaEm(z, x, y, Math.max(3, r * 1.1), s[0]);
    };
    /** Marcas que caem depois (o torresmo cai 0,9 s depois do disparo; a pinga explode no fim do voo). */
    const marcas: { area: Zona; x: number; y: number; quando: number; tipo: 'queimado' | 'racha'; r: number }[] = [];
    const QUEIMADO = ['#140d0a', '#2a1c14', '#3a2a20'] as const;
    const RACHA = ['#120f18', '#9aa3b8', '#9aa3b8'] as const;
    const marcar = (z: Zona, x: number, y: number, tipo: 'queimado' | 'racha', r: number, quando = m.t) => {
      marcas.push({ area: z, x: Math.round(x), y: Math.round(y), quando, tipo, r });
      if (marcas.length > 16) marcas.shift();
    };
    /** Golpe recente em cada corpo (recuo e achatamento, só desenho) e clarão garantido de 1 quadro desenhado. */
    const impactos = new Map<string, { t0: number; forte: boolean; dx: number; dy: number }>();
    const flashQ = new Map<string, number>();
    /** Quando cada um caiu (a queda de 0,3 s antes de deitar). */
    const caiuEm = new Map<string, number>();
    const pegadas = new Map<string, { k: number; cor: string; x: number; y: number; lado: number }>();
    let pegadaEm = 0;
    const espirrar = (area: Zona, x: number, y: number, z: number, dx: number, dy: number, n: number, cores: readonly string[], forca = 1, mancha = true, tam = 1) => {
      for (let i = 0; i < n && gotas.length < limiteGotas(); i++) {
        const sp = (30 + Math.random() * 90) * forca;
        const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.6;
        gotas.push({
          area, x, y, z, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.6, vz: 20 + Math.random() * 70 * forca,
          cor: cores[Math.floor(Math.random() * cores.length)], tam, mancha, nasce: m.t,
        });
      }
    };

    // Vozes (Fatia 6): quem fala, geme ou grita perto de você soa (some com a distância e em outra área).
    const voz = (id: string | undefined, x: number, y: number, tipo: TipoVoz, tamanho = 12) => {
      if (!id) return;
      const me = eu(m);
      if (zonaDe(x, y) !== zonaDe(me.x, me.y)) return;
      const c = achar(m, id);
      const quem = c?.quem === 'eu' ? player : c?.quem === 'remoto' || c?.quem === 'amigo' ? c.nome : id;
      falarVoz(tipo, quem, tamanho, volumePorDistancia(Math.hypot(x - me.x, y - me.y)));
    };

    const eventos = () => {
      const g = goreRef.current;
      for (const e of m.eventos) {
        switch (e.k) {
          case 'golpe': {
            {
              const alvoVoz = achar(m, e.em);
              if (alvoVoz && alvoVoz.estado !== 'ko') voz(e.em, e.x, e.y, 'dor');
            }
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            const d = naTela(e.dx, e.dy);
            {
              const dn = Math.hypot(d.x, d.y) || 1;
              impactos.set(e.em, { t0: m.t, forte: e.forte, dx: d.x / dn, dy: d.y / dn });
              flashQ.set(e.em, 1);
              if (e.arma === 'raio') marcar(z, p.x, p.y + 1, 'queimado', 6);
              if (e.arma === 'marreta') marcar(z, p.x, p.y + 1, 'racha', 10);
              if (e.arma === 'chope') pocaEm(z, p.x + d.x * 3, p.y + 1, 6, '#e8a040');
            }
            const alvo = achar(m, e.em);
            const n = g ? Math.round(e.dano * 0.9) + 4 : Math.round(e.dano * 0.35) + 2;
            espirrar(z, p.x, p.y, alvo && alvo.estado === 'ko' ? 4 : 17, d.x, d.y, n, sangue(), e.forte ? 1.4 : 1);
            if (g && e.forte && Math.random() < 0.3) espirrar(z, p.x, p.y, 15, d.x, d.y, 1, ['#f4f4f4'], 1.6, true, 1); // dente
            if (g && e.arma === 'caco') espirrar(z, p.x, p.y, 15, d.x, d.y, 8, sangue(), 1.8);
            if (e.arma === 'desentupidor') espirrar(z, p.x, p.y, 16, d.x, d.y, 5, ['#6b7a3a', '#8a9a4a'], 0.9); // o que tinha no desentupidor
            if (e.arma === 'extintor') espirrar(z, p.x - d.x * 8, p.y - d.y * 4, 14, d.x, d.y, 26, ['#f4f4f4', '#c0cbdc', '#e4e4e4'], 1.1, false, 2); // nuvem branca
            if (e.arma === 'frigideira') tocar('parede');
            // Fatia 5: cada item solta o seu material, tem a sua onomatopeia e o seu tranco.
            if (e.arma && !ehPoder(e.arma)) {
              const mv = MOVIMENTO[e.arma];
              const rs = RESTO[mv.material];
              espirrar(z, p.x, p.y, 16, d.x, d.y, rs.n, rs.cores, rs.forca, !['brilho', 'po', 'agua'].includes(mv.material), rs.tam);
              if (mv.som) {
                onos.push({ area: z, x: p.x + 8, y: p.y - 30, texto: mv.som, cor: mv.material === 'metal' || mv.material === 'brilho' ? '#fee761' : '#f4f4f4', t0: m.t });
                if (onos.length > 8) onos.shift();
              }
              // Fatia 8: o tranco do item só sacode a tela no golpe pesado (tremor em todo golpe vira ruído).
              if (e.forte) m.trauma = Math.min(1, m.trauma + mv.tranco * 0.4);
              if (e.arma === 'marreta') {
                ondas.push({ area: z, x: p.x, y: p.y, t0: m.t, raio: 52, cor: '#feae34' });
                ondas.push({ area: z, x: p.x, y: p.y, t0: m.t + 80, raio: 34, cor: '#c0cbdc' });
                for (let i = 0; i < 8; i++) espirrar(z, p.x, p.y, 2, Math.cos(i * 0.785), Math.sin(i * 0.785), 2, ['#8b9bb4', '#5a6988'], 1.2, false, 2);
              }
              if (e.arma === 'frigideira') ondas.push({ area: z, x: p.x, y: p.y - 18, t0: m.t, raio: 22, cor: '#c0cbdc' });
              if (e.arma === 'violao') for (let i = 0; i < 3; i++) onos.push({ area: z, x: p.x - 10 + i * 10, y: p.y - 40 - i * 4, texto: '♪', cor: '#2ce8f5', t0: m.t + i * 60 });
              if (e.arma === 'katana' || e.arma === 'cano' || e.arma === 'serra') tocar('metal');
            }
            if (ehPoder(e.arma)) espirrar(z, p.x, p.y, 16, d.x, d.y, 10, coresCarga(e.arma).faiscas, 2, false, 1);
            tocar(e.forte ? 'forte' : 'soco');
            break;
          }
          case 'carga': {
            // Um poder começou a carregar (seu ou de um amigo): o som (e, na rajada, o grito sílaba por sílaba).
            silabas.set(e.em, 0);
            if (ehPoder(e.tipo) && e.tipo !== 'rajada') tocarPoder(e.tipo, 'carga');
            else tocar('rajadaCarga');
            break;
          }
          case 'poder': {
            const z = zonaDe(e.x, e.y);
            const a = telaDe(e.x, e.y, z);
            const def = PODER[e.tipo];
            onos.push({ area: z, x: a.x, y: a.y - 82, texto: def.grito, cor: def.cores[1], t0: m.t, grande: true });
            if (onos.length > 8) onos.shift();
            voz(e.em, e.x, e.y, 'grito', def.grito.length);
            if (e.em === eu(m).id) localStorage.removeItem(RAJADA_KEY);
            tocarPoder(e.tipo, 'disparo', { alvos: e.alvos, t0: m.t, x: e.x, y: e.y, cx: e.cx, cy: e.cy });
            // Fatia 8: o chão guarda o poder (rachadura do pisão, cratera do torresmo, queimado da pinga).
            if (e.tipo === 'pagode') marcar(z, a.x, a.y + 1, 'racha', 18);
            if (e.tipo === 'torresmo' || e.tipo === 'pinga') {
              const zc = zonaDe(e.cx, e.cy);
              const c = telaDe(e.cx, e.cy, zc);
              const em = e.tipo === 'torresmo' ? (PODER.torresmo.p.atraso ?? 900) : (Math.hypot(e.cx - e.x, e.cy - e.y) / (PODER.pinga.p.vel ?? 12)) * 1000;
              marcar(zc, c.x, c.y, 'queimado', e.tipo === 'torresmo' ? 16 : 13, m.t + em);
              if (e.tipo === 'torresmo') marcar(zc, c.x, c.y, 'racha', 22, m.t + em);
            }
            m.trauma = Math.min(1, m.trauma + 0.35);
            break;
          }
          case 'rajada': {
            const z = zonaDe(e.x, e.y);
            const a = telaDe(e.x, e.y, z);
            const b = telaDe(e.x + e.fx * e.len, e.y + e.fy * e.len, z);
            queimados.push({ area: z, ax: a.x, ay: a.y, bx: b.x, by: b.y, len: e.len, t0: m.t });
            if (queimados.length > 4) queimados.shift();
            onos.push({ area: z, x: a.x, y: a.y - 82, texto: 'NA CONTAAAA!', cor: '#ff4fb0', t0: m.t, grande: true });
            if (e.em === eu(m).id) localStorage.removeItem(RAJADA_KEY);
            tocar('rajadaDisparo');
            break;
          }
          case 'ko': {
            voz(e.em, e.x, e.y, 'ko');
            // Fatia 18: o rádio comenta (você no chão, ou o nome de quem caiu).
            if (e.em === eu(m).id) narrar(narrador.current, 'ko_eu', Date.now(), narrRng.current);
            else {
              const nm = NOME_J[e.em as Jogador] ?? NPCS.find((n) => n.id === e.em)?.nome;
              if (nm) narrar(narrador.current, 'ko_outro', Date.now(), narrRng.current, nm);
            }
            // Fatia 20: o NPC que você derrubou guarda isso (curativo; no 3º, apelido).
            if (e.de === eu(m).id && NPCS.some((n) => n.id === e.em)) {
              const ago = Date.now();
              const antes = estadoNpc(memoria.current, e.em, ago);
              memoria.current = registrarNocaute(memoria.current, e.em, ago);
              salvarMemoria(player, memoria.current);
              const depois = estadoNpc(memoria.current, e.em, ago);
              if (depois.apelido && !antes.apelido) avisar(`${NPCS.find((n) => n.id === e.em)?.nome ?? 'Ele'} ganhou um apelido no bar: "${depois.apelido}".`);
            }
            caiuEm.set(e.em, m.t);
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            if (g) {
              espirrar(z, p.x, p.y, 18, 0, -1, 26, sangue(), 1.5);
              poca(z, p.x + 4, p.y + 1, 5);
            }
            tocar('ko');
            break;
          }
          case 'extra': {
            // Fatia 10: o seu golpe pegou a ratazana (o desentupidor bate em dobro).
            if (ev.ag?.tipo === 'alien' && (e.id === 'alien' || e.id === 'grande' || e.id.startsWith('disco'))) {
              const z = zonaDe(e.x, e.y);
              const p = telaDe(e.x, e.y, z);
              const d = naTela(e.dx, e.dy);
              const dn = Math.hypot(d.x, d.y) || 1;
              ev.danoPor[e.id] = (ev.danoPor[e.id] ?? 0) + Math.round(e.dano);
              impactos.set(e.id, { t0: m.t, forte: e.forte, dx: d.x / dn, dy: d.y / dn });
              flashQ.set(e.id, 1);
              espirrar(z, p.x, p.y, e.id === 'alien' ? 18 : 30, d.x, d.y, 6, e.id === 'alien' ? ['#63c74d', '#2ce8f5'] : ['#fee761', '#8b9bb4'], 1, false, 1);
              onos.push({ area: z, x: p.x + 6, y: p.y - (e.id === 'alien' ? 36 : 44), texto: e.id === 'alien' ? 'BLORP!' : 'KLANG!', cor: '#2ce8f5', t0: m.t });
              if (onos.length > 8) onos.shift();
              tocar(e.forte ? 'forte' : 'metal');
              break;
            }
            // Fatia 17: dragão (a molotov de cachaça o deixa sonolento: seu dano dobra por 10 s) e dinossauro (zonzo
            // da geladeira: seu dano dobra). Os dois só valem no seu aparelho e não mudam a rota de ninguém.
            if ((e.id === 'dragao' && ev.ag?.tipo === 'dragao') || (e.id === 'dino' && ev.ag?.tipo === 'dino')) {
              const z = zonaDe(e.x, e.y);
              const p = telaDe(e.x, e.y, z);
              const d = naTela(e.dx, e.dy);
              const dn = Math.hypot(d.x, d.y) || 1;
              const dragao = e.id === 'dragao';
              if (dragao && e.arma === 'molotov') {
                if (m.t >= ev.sonoAte) avisar('A cachaça deixou o dragão sonolento: seu dano dobra por 10 s.');
                ev.sonoAte = m.t + SONO_MS;
              }
              const k = (dragao ? m.t < ev.sonoAte : m.t < ev.atordoaAte) ? 2 : 1;
              ev.meuDano += Math.round(e.dano * k);
              impactos.set(e.id, { t0: m.t, forte: e.forte, dx: d.x / dn, dy: d.y / dn });
              flashQ.set(e.id, 1);
              espirrar(z, p.x, p.y - (dragao ? 30 : 14), 10, d.x, d.y, 6, dragao ? ['#2a7a6a', '#e8d6a0'] : ['#7a4ab0', '#f4f4f4'], 1, false, 1);
              onos.push({ area: z, x: p.x + 6, y: p.y - (dragao ? 52 : 32), texto: `${dragao ? 'CLANG!' : 'BONK!'}${k === 2 ? ' ×2' : ''}`, cor: '#fee761', t0: m.t });
              if (onos.length > 8) onos.shift();
              tocar(e.forte ? 'forte' : 'soco');
              break;
            }
            if (e.id !== 'rato' || ev.ag?.tipo !== 'ratazana') break;
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            const d = naTela(e.dx, e.dy);
            const dn = Math.hypot(d.x, d.y) || 1;
            const dano = Math.round(e.dano * (e.arma === 'desentupidor' ? 2 : 1));
            ev.meuDano += dano;
            impactos.set('rato', { t0: m.t, forte: e.forte, dx: d.x / dn, dy: d.y / dn });
            flashQ.set('rato', 1);
            espirrar(z, p.x, p.y, 8, d.x, d.y, g ? 8 : 5, g ? sangue() : ['#8b8f99', '#5a5f6a'], 1, g, 1);
            onos.push({ area: z, x: p.x + 6, y: p.y - 20, texto: e.arma === 'desentupidor' ? 'PLOC! ×2' : 'QUIIIK!', cor: '#f4f4f4', t0: m.t });
            if (onos.length > 8) onos.shift();
            tocar(e.forte ? 'forte' : 'soco');
            break;
          }
          case 'geladeira': {
            // Fatia 17: a porta da geladeira abre na cara do dinossauro (perto) e ele fica zonzo 4 s (no seu aparelho).
            if (ev.ag?.tipo === 'dino' && ev.dino && !ev.dino.fora && ev.sustoId !== ev.dino.id && Math.hypot(ev.dino.x - e.x, ev.dino.y - e.y) <= GELADEIRA_RAIO) {
              ev.sustoId = ev.dino.id;
              ev.atordoaAte = m.t + ATORDOA_MS;
              avisar('A porta da geladeira abriu na cara do dinossauro: ele ficou zonzo (4 s, apanha em dobro e não te pega).');
            }
            break;
          }
          // Fatia 12: status, cruzamentos, aparada, carga, receita, item que quica e pega no ar.
          case 'status': {
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            const cores: Record<Status, string[]> = {
              queimando: ['#feae34', '#f77622', '#e43b44'],
              molhado: ['#9ad0ff', '#f4f4f4'],
              eletrico: ['#2ce8f5', '#fee761'],
              grudento: ['#c28a1f', '#8f563b'],
            };
            espirrar(z, p.x, p.y - 14, 6, 0, -1, 14, cores[e.st], 0.7, false, 1);
            break;
          }
          case 'cruza': {
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            const o = { choque: ['BZZZT!', '#2ce8f5'], apaga: ['TSSSS', '#c0cbdc'], chamas: ['FUUUM!', '#feae34'] }[e.tipo];
            onos.push({ area: z, x: p.x + 6, y: p.y - 34, texto: o[0], cor: o[1], t0: m.t });
            if (onos.length > 8) onos.shift();
            if (e.tipo === 'choque') espirrar(z, p.x, p.y - 10, 20, 0, -1, 30, ['#2ce8f5', '#f4f4f4', '#fee761'], 1.3, false, 1);
            else if (e.tipo === 'apaga') espirrar(z, p.x, p.y - 16, 10, 0, -1, 18, ['#c0cbdc', '#f4f4f4'], 1.5, false, 2);
            else espirrar(z, p.x, p.y, 14, 0, -1, 22, ['#feae34', '#f77622', '#e43b44'], 1.2, false, 2);
            tocar(e.tipo === 'choque' ? 'chiado' : e.tipo === 'apaga' ? 'chiado' : 'forte');
            break;
          }
          case 'apara': {
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            espirrar(z, p.x, p.y - 18, 14, 0, -1, 26, ['#f4f4f4', '#fee761', '#c0cbdc'], 1.1, false, 1);
            onos.push({ area: z, x: p.x + 6, y: p.y - 30, texto: 'TCHANG!', cor: '#fee761', t0: m.t });
            if (onos.length > 8) onos.shift();
            tocar('metal');
            break;
          }
          case 'carregando': {
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            espirrar(z, p.x, p.y - 10, e.nivel === 2 ? 12 : 6, 0, -1, 12, e.nivel === 2 ? ['#feae34', '#f77622'] : ['#fee761', '#f4f4f4'], 0.8, false, 1);
            tocar('pega');
            break;
          }
          case 'receita':
            avisar(`${e.nome}! (${ARMAS[e.arma].usos} usos)`);
            tocar('pega');
            break;
          case 'quica': {
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            onos.push({ area: z, x: p.x + 4, y: p.y - 12, texto: 'toc', cor: '#c0cbdc', t0: m.t });
            if (onos.length > 8) onos.shift();
            tocar('parede');
            break;
          }
          case 'pegou':
            avisar(`Pegou de volta: ${ARMAS[e.arma].nome}`);
            tocar('pega');
            break;
          case 'escorrega': {
            voz(e.em, e.x, e.y, 'escorrega');
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            espirrar(z, p.x, p.y, 2, 0, -1, 10, ['#9ad0ff', '#f4f4f4'], 0.8, false);
            tocar('pega');
            break;
          }
          case 'mutila': {
            voz(e.em, e.x, e.y, 'grito');
            // Sem modo sangue, ninguém perde nada (o corpo também é desenhado inteiro).
            if (!g) break;
            const c = achar(m, e.em);
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            // Direção na tela (unitária: `naTela` devolve pixels por ladrilho e jogava o pedaço longe a 1.700 px/s).
            const t0 = naTela(e.dx, e.dy);
            const tn = Math.hypot(t0.x, t0.y) || 1;
            const d = { x: t0.x / tn, y: t0.y / tn };
            if (c && pedacos.length < MAX_PEDACOS) {
              const { chave, L } = lookDoCorpo(c);
              const forca = e.arma === 'serra' ? 1.5 : 1;
              pedacos.push({
                area: z, x: p.x, y: p.y, z: e.parte === 'cabeca' ? 22 : 14, vx: d.x * 85 * forca + (Math.random() - 0.5) * 30,
                vy: d.y * 50 * forca, vz: 100 + Math.random() * 60, ang: 0, va: (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 7),
                sp: pedacoSprite(chave, L, e.parte, e.lado === 'd'), rastro: 0,
              });
            }
            espirrar(z, p.x, p.y, 16, d.x, d.y, 60, sangue(), 2.2);
            espirrar(z, p.x, p.y, 14, -d.x, -d.y, 20, sangue(), 1.2);
            if (Math.random() < 0.6) espirrar(z, p.x, p.y, 15, d.x, d.y, 3, ['#f4f4f4'], 1.8, true, 1); // osso
            poca(z, p.x, p.y + 1, 13);
            const ox = e.parte === 'cabeca' ? 0 : (e.lado === 'd' ? 1 : -1) * (e.parte === 'braco' ? 6 : 3);
            jorros.push({ area: z, x: p.x + ox, y: p.y, z: e.parte === 'cabeca' ? 20 : e.parte === 'braco' ? 15 : 7, dx: ox ? Math.sign(ox) : d.x || 1, ate: m.t + JORRO_MS, prox: 0 });
            if (jorros.length > 6) jorros.shift();
            tocar('ko');
            break;
          }
          case 'quebra': {
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            const cores =
              e.arma === 'garrafa' || e.arma === 'caco'
                ? ['#3e8948', '#63c74d', '#c0cbdc']
                : e.arma === 'cadeira'
                  ? ['#feae34', '#c28a1f']
                  : e.arma === 'cano'
                    ? ['#6b7280', '#8a4a2a']
                    : e.arma === 'desentupidor'
                      ? ['#a22633', '#a96a40']
                      : ['#8f563b', '#5c3620', '#c0cbdc'];
            espirrar(z, p.x, p.y, 14, 0, 1, 14, cores, 1.2, true);
            if (e.arma === 'garrafa') {
              espirrar(z, p.x, p.y, 12, 0, 1, 8, ['#feae34'], 0.8, true); // a cerveja que tinha dentro
              tocar('vidro');
            } else tocar('parede');
            break;
          }
          case 'parede': {
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            espirrar(z, p.x, p.y, 10, 0, -1, 8, ['#8b8f99', '#c0cbdc'], 0.6, false);
            if (g) poca(z, p.x, p.y, 2.5);
            tocar('parede');
            break;
          }
          case 'frase': {
            voz(e.em, e.x, e.y, vozDoTema(e.tema), e.texto.length);
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            textos.push({ area: z, x: p.x, y: p.y - 34, texto: e.texto, cor: e.cor, t0: m.t });
            if (textos.length > 6) textos.shift();
            if (e.texto.startsWith('remédio') || e.texto.includes('cerveja') || e.texto.includes('hidrata')) tocar('cerveja');
            break;
          }
          case 'aviso':
            avisar(e.texto);
            if (e.texto.startsWith('Pegou')) tocar('pega');
            break;
          case 'jogo':
            if (COM_PAINEL.includes(e.jogo)) setJogo(e.jogo as Painel);
            else if (e.jogo === 'fliperama') avisar('Fliperama: TILT. O Seu Zé jura que conserta "semana que vem" (desde 2009).');
            else if (e.jogo === 'dardos') avisar('Dardos: os dardos foram usados numa treta. Só sobrou o alvo.');
            break;
          case 'levou':
            tocar('pega');
            break;
          case 'grana':
            ganhar.current(e.v, 'chao');
            avisar(`+R$ ${e.v} (achado no chão)`);
            tocar('pega');
            break;
          case 'rocky':
            avisar(`Rocky ${e.texto}`);
            break;
          case 'porta':
            avisar(e.nome);
            tocar('pega');
            break;
          case 'happy':
            avisar(e.comeca ? '🍻 HAPPY HOUR! A firma chegou e a cerveja cura em dobro' : 'Acabou a happy hour. A firma foi embora (sem pagar)');
            break;
          case 'treta': {
            avisar(`🥊 ${e.a} × ${e.b}: treta no bar!`);
            // A treta sozinha fica com o primeiro amigo online na ordem fixa (os outros veem a mesma briga).
            if (elo.primeiroOnline())
              for (const id of [e.ia, e.ib]) {
                const c = achar(m, id);
                if (c && !c.dono) c.quenteAte = m.t + 12000;
              }
            break;
          }
          case 'quebrou': {
            // Cacos e lascas do móvel, que ficam no chão (o Seu Zé repõe o móvel, não varre).
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            const cores = LASCAS[e.kind] ?? ['#8f563b', '#5c3620'];
            espirrar(z, p.x, p.y, 10, 0, 1, 26, cores, 1.5, true, 2);
            espirrar(z, p.x, p.y, 6, 0, 1, 12, cores, 0.8, true, 1);
            tocar(e.kind === 'vaso' ? 'vidro' : 'parede');
            break;
          }
          case 'atropelo': {
            const z = zonaDe(e.x, e.y);
            const p = telaDe(e.x, e.y, z);
            const d = naTela(e.dir, -0.3);
            if (g) {
              espirrar(z, p.x, p.y, 14, d.x, d.y, 40, sangue(), 2.2);
              poca(z, p.x + e.dir * 6, p.y, 6);
              espirrar(z, p.x, p.y, 16, d.x, d.y, 2, ['#f4f4f4'], 2, true, 1); // dentes no asfalto
            } else espirrar(z, p.x, p.y, 14, d.x, d.y, 18, sangue(), 1.6);
            tocar('carro');
            break;
          }
          case 'recolhido':
            avisar(`O Seu Zé levou ${e.nome} pro depósito.`);
            break;
          case 'chegou':
            avisar(`Chegou cliente novo: ${e.nome}`);
            break;
          case 'acerto':
            // Você bateu num amigo online: quem bate decide, o aparelho dele aplica.
            barPresence.sendGolpe(golpeDoEvento(e));
            break;
          case 'bigode': {
            const antes = e.n - 1;
            // Fatia 15: até 6 degraus por dia em cada amigo (contados neste aparelho).
            const conta = contaPegadinhas(player, e.em);
            if (!podeZoar(antes, conta)) {
              const c = achar(m, `amigo:${e.em}`);
              if (c && c.quem === 'amigo') c.ink = antes;
              avisar(`Chega de zoar ${NOME_J[e.em as Jogador] ?? e.em} por hoje: a caneta volta amanhã.`);
              break;
            }
            somarPegadinha(player, e.em);
            avisar(`🖊️ ${NOME_J[e.em as Jogador] ?? e.em} ganhou ${PEGADINHAS[e.n - 1] ?? 'mais uma'}.`);
            void barPresence.mark(e.em as PlayerId, e.n).then((ok) => {
              if (ok || !barPresence.online) return;
              const c = achar(m, `amigo:${e.em}`);
              if (c && c.quem === 'amigo' && c.ink === e.n) c.ink = antes;
              avisar('A caneta tá secando: espera 2 s.');
            });
            break;
          }
        }
      }
      m.eventos.length = 0;
    };

    /** Direção do quadro (teclado na frente do joystick), na tela convertida para ladrilhos. */
    const direcao = () => {
      if (travado.current) return { mx: 0, my: 0 };
      const k = teclas.current;
      let ux = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      let uy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
      if (ux || uy) {
        const n = Math.hypot(ux, uy);
        ux /= n;
        uy /= n;
      } else {
        ux = stick.current.x;
        uy = stick.current.y;
      }
      return telaParaLadrilho(ux, uy);
    };

    const entrada = (): Entrada => {
      const k = teclas.current;
      let ux = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      let uy = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
      if (ux || uy) {
        const n = Math.hypot(ux, uy);
        ux /= n;
        uy /= n;
      } else {
        ux = stick.current.x;
        uy = stick.current.y;
      }
      const t = toque.current;
      const segura = k.has('KeyJ') || k.has('Space') || socoPreso.current;
      const e: Entrada = { ...PARADO, ...telaParaLadrilho(ux, uy), soco: t.soco, agarra: t.agarra, usa: t.usa, segura, apara: t.apara };
      t.soco = t.agarra = t.usa = t.apara = false;
      return e;
    };

    // Tela de toque não tem J/K: a dica mostra o desenho do botão (👊 soco, ✊ agarra).
    const toqueSo = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
    const comBotoes = (d: string) => {
      if (!toqueSo) return d;
      const a = eu(m).arma;
      return d.replace(/\bJ:/g, a ? ICONE_ARMA[a.tipo] : '👊').replace(/\bK:/g, a ? '🗑️' : '✊');
    };

    const dicaDe = (): string => {
      const me = eu(m);
      if (me.estado !== 'normal') return '';
      if (apagado() && pertoDisjuntor()) return 'E: religar o disjuntor';
      // Mesma ordem do E no motor: porta, arma no chão, amigo, geladeira, jogo.
      const porta = PORTAS.find((p) => Math.hypot(p.at[0] + 0.5 - me.x, p.at[1] + 0.5 - me.y) < 0.9);
      if (porta) return `E: ${porta.nome}${me.segurando ? ' (solta quem você segura)' : ''}`;
      const a = m.chao.find((a) => a.volta === 0 && Math.hypot(a.x - me.x, a.y - me.y) < 0.85);
      if (a && !me.segurando)
        return me.arma ? `E: trocar ${ARMAS[me.arma.tipo].nome.toLowerCase()} por ${ARMAS[a.arma].nome.toLowerCase()}` : `E: pegar ${ARMAS[a.arma].nome.toLowerCase()}`;
      const amigo = m.corpos.find((o) => o.quem === 'amigo' && Math.hypot(o.x - me.x, o.y - me.y) < 0.9);
      if (amigo) return `E: bigode no ${PLAYER_BY_ID[amigo.nome as PlayerId].name} · K: arrastar · J: chutar`;
      if (me.y < 2.2 && me.x > 10.6 && me.x < 13) return `E: pegar uma cerveja (cura${m.happy ? ' em dobro, é happy hour' : ''})`;
      // Fatia 12: o canto das receitas no balcão.
      if (Math.hypot(me.x - BANCADA[0], me.y - BANCADA[1]) < RAIO_BANCADA && (me.arma || m.bancada)) {
        const b = m.bancada;
        const mao = me.arma;
        if (mao && b) {
          const r = receita(mao.tipo, b.arma);
          return r ? `E: ${r.nome}` : `E: trocar com ${ARMAS[b.arma].nome.toLowerCase()} (não é receita)`;
        }
        if (mao) {
          const pares = RECEITAS.filter((r) => r.a === mao.tipo || r.b === mao.tipo).map((r) => ARMAS[r.a === mao.tipo ? r.b : r.a].nome.toLowerCase());
          return `E: deixar ${ARMAS[mao.tipo].nome.toLowerCase()} no balcão${pares.length ? ` (combina com ${pares.join(' ou ')})` : ''}`;
        }
        if (b) return `E: pegar ${ARMAS[b.arma].nome.toLowerCase()} do balcão`;
      }
      const j = JOGOS.find((j) => Math.hypot(j.at[0] + 0.5 - me.x, j.at[1] + 0.5 - me.y) < 0.9);
      if (j) return `E: ${j.nome}`;
      const mu = achar(m, 'muamba');
      if (mu && mu.estado === 'normal' && (Math.hypot(mu.x - me.x, mu.y - me.y) < 1.2 || Math.hypot(BALCAO_MERCADO[0] - me.x, BALCAO_MERCADO[1] - me.y) < RAIO_MERCADO))
        return 'E: mercado negro (faca, machadinha, serra elétrica…)';
      const ro = achar(m, 'rocky');
      if (ro && ro.estado === 'normal' && Math.hypot(ro.x - me.x, ro.y - me.y) < 1.2) return 'E: falar com o Rocky';
      if (!me.segurando) {
        const i = propIdx(Math.floor(me.x + me.fx * 0.8), Math.floor(me.y + me.fy * 0.8));
        const tipo = i >= 0 && !m.quebrados.has(i) ? MOVEL_ARMA[PROPS[i].kind] : undefined;
        if (tipo) return `E: pegar ${ARMAS[tipo].nome.toLowerCase()} para bater`;
      }
      if (me.segurando) return 'J: bater com ele em quem estiver na frente · K: arremessar';
      if (me.arma) return `J: bater com ${ARMAS[me.arma.tipo].nome.toLowerCase()} (${me.arma.usos}/${ARMAS[me.arma.tipo].usos}) · K: jogar fora`;
      return '';
    };

    const lookDoCorpo = (c: Corpo): { chave: string; L: Look } => {
      if (c.quem === 'eu') return { chave: `eu:${codigo(visualRef.current)}`, L: lookDe(player, visualRef.current) };
      if (c.quem === 'amigo') {
        // Fatia 15: dormindo no canto com o último visual que ele salvou (o código fica no banco quando ele sai).
        const lk = lkDoAmigo(barPresence.vivoRaw(), c.nome);
        return lk ? { chave: `amigo:${c.nome}:${lk}`, L: lookDe(c.nome as PlayerId, deCodigo(lk)) } : { chave: `amigo:${c.nome}`, L: PLAYER_BY_ID[c.nome as PlayerId].look };
      }
      if (c.quem === 'remoto') {
        const lk = elo.estado(c.nome as AmigoId)?.lk ?? '--------';
        return { chave: `remoto:${c.nome}:${lk}`, L: lookDe(c.nome as PlayerId, deCodigo(lk)) };
      }
      return { chave: `npc:${c.id}`, L: c.npc!.look };
    };

    const spriteDoCorpo = (c: Corpo, t: number, semFlash = false, emQueda = false): Sprite => {
      const { chave, L } = lookDoCorpo(c);
      const p = emQueda ? 'hurt' : poseDe(c, t);
      const f = facing(c.fx, c.fy);
      let flip = f.flip;
      // Fatia 8: clarão de 2 quadros no motor e, no mínimo, 1 quadro desenhado (a 20 qps os 34 ms passariam sem quadro).
      const branco = !semFlash && (t < c.flashAte || (flashQ.get(c.id) ?? 0) > 0);
      let pose: PoseBoneco;
      switch (p) {
        case 'ko': {
          // Três jeitos de ficar no chão (fixos pelo nome): de costas vira para o outro lado; de joelhos, encolhido.
          const dd = deitadoDe(quedaDe(c.id));
          if (c.quem !== 'amigo' && dd.inverte) flip = !flip;
          pose =
            c.quem === 'amigo'
              ? (c.deitado ?? 'ko-flat')
              : goreRef.current && c.quem === 'npc'
                ? 'dead'
                : dd.pose;
          break;
        }
        case 'sit':
          pose = 'sit';
          break;
        case 'punch':
        case 'hurt':
          pose = p;
          break;
        case 'walk-a':
          pose = f.back ? 'back-a' : 'front-a';
          break;
        case 'walk-b':
          pose = f.back ? 'back-b' : 'front-b';
          break;
        default:
          pose = f.back ? 'back' : 'front';
          // Micro-ação de quem está parado e calmo: de vez em quando olha para o outro lado.
          if (c.quem === 'npc' && c.humor === 'calmo' && !c.alvo && olhadela(c.id, t, reduzidoRef.current)) flip = !flip;
      }
      // Fatia 15: no modo foto, você posa como escolher.
      if (c.quem === 'eu' && fotoRef.current.on && fotoRef.current.pose) pose = fotoRef.current.pose;
      // Modo sangue: o boneco vai ficando manchado conforme apanha (amigo dormindo não sangra).
      const sangra = goreRef.current && c.quem !== 'amigo' ? Math.max(0, Math.min(3, Math.floor((1 - c.vida / Math.max(1, c.vidaMax)) * 4))) : 0;
      return boneco(chave, L, pose, flip, c.ink, branco, sangra, goreRef.current && c.quem === 'npc' ? c.cortes : 0);
    };

    const desenhar = (agora: number) => {
      const t = m.t;
      const me = eu(m);
      // A câmera mostra só a área onde você está (o banheiro é outra tela, como entrar num cômodo).
      const z = zonaDe(me.x, me.y);
      const A = areas[z];
      const L = A.L;
      if (z !== zonaVista) {
        zonaVista = z;
        cam.ok = false;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      const W = Math.round(cw * dpr);
      const H = Math.round(ch * dpr);
      if (W === 0 || H === 0) return; // tela escondida (aba em segundo plano, painel recolhido): nada a desenhar
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      // Zoom inteiro: no celular de pé o bar enche a altura (sem faixa preta); deitado ou no PC, ~400 px lógicos de largura.
      const alvoW = cw < 700 ? 260 : 400;
      // Mesmo zoom em toda área (pela altura do salão): o banheiro, mais baixo, não dobra o zoom e cabe na tela.
      const S = Math.max(1, Math.round(W / alvoW), Math.round(H / LAYOUTS.bar.h));
      const vw = Math.ceil(W / S);
      const vh = Math.ceil(H / S);
      if (low.width !== vw || low.height !== vh) {
        low.width = vw;
        low.height = vh;
      }
      // Câmera segue você (um pouco acima, para ver para onde anda), presa nas bordas da área.
      const p = telaDe(me.x, me.y, z);
      const clampX = (x: number) => (L.w <= vw ? (L.w - vw) / 2 : Math.max(0, Math.min(L.w - vw, x)));
      const clampY = (y: number) => (L.h <= vh ? (L.h - vh) / 2 : Math.max(0, Math.min(L.h - vh, y)));
      const tx = clampX(p.x - vw / 2);
      const ty = clampY(p.y - vh / 2 - 12);
      if (!cam.ok) {
        cam.x = tx;
        cam.y = ty;
        cam.ok = true;
      }
      cam.x += (tx - cam.x) * 0.12;
      cam.y += (ty - cam.y) * 0.12;
      const sh = reduzidoRef.current ? 0 : m.trauma * m.trauma * 6;
      ultimoTremor = sh;
      const cx = Math.round(cam.x + (Math.random() - 0.5) * 2 * sh);
      const cy = Math.round(cam.y + (Math.random() - 0.5) * 2 * sh);
      ancora.x = cx;
      ancora.y = cy;

      if (A.suja && agora - A.em > 150) {
        const rs = A.tudo ? { x0: 0, y0: 0, x1: A.manchas.w, y1: A.manchas.h } : recortar(A.ret, A.manchas.w, A.manchas.h);
        if (rs) A.ctx.putImageData(A.img, 0, 0, rs.x0, rs.y0, rs.x1 - rs.x0, rs.y1 - rs.y0);
        A.tudo = false;
        A.ret = null;
        A.suja = false;
        A.em = agora;
      }

      lc.fillStyle = '#0e0b16';
      lc.fillRect(0, 0, vw, vh);
      lc.drawImage(A.fundo, -cx, -cy);
      lc.drawImage(A.cv, -cx, -cy);
      // Chão molhado da Dona Maria: brilho azulado no piso (some aos poucos) e a placa amarela por cima.
      const molhados = molhadosEm(t).filter((p) => zonaDe(p.x, p.y) === z);
      for (const p of molhados) {
        const q = telaDe(p.x, p.y, z);
        const resta = Math.min(1, (p.ate - t) / 6000);
        lc.globalAlpha = 0.18 + 0.14 * resta;
        lc.fillStyle = '#9ad0ff';
        lc.beginPath();
        lc.ellipse(Math.round(q.x - cx), Math.round(q.y - cy), RAIO_MOLHADO * TW * 0.55, RAIO_MOLHADO * TH * 0.55, 0, 0, Math.PI * 2);
        lc.fill();
        lc.globalAlpha = 0.55 * resta;
        lc.fillStyle = '#f4f4f4';
        lc.fillRect(Math.round(q.x - cx) - 4, Math.round(q.y - cy) - 1, 2, 1);
        lc.fillRect(Math.round(q.x - cx) + 3, Math.round(q.y - cy) + 1, 3, 1);
        lc.globalAlpha = 1;
      }

      // Rajada do Fiado (Fatia 5): o chão queimado por onde o feixe passou.
      for (let i = queimados.length - 1; i >= 0; i--) {
        const qm = queimados[i];
        const vida = t - qm.t0;
        if (vida > 20000) {
          queimados.splice(i, 1);
          continue;
        }
        if (qm.area !== z) continue;
        const fr = Math.min(1, (vida / 1000) * RAJADA_VEL / Math.max(0.1, qm.len));
        const ex = qm.ax + (qm.bx - qm.ax) * fr;
        const ey = qm.ay + (qm.by - qm.ay) * fr;
        const some = 1 - Math.max(0, (vida - 14000) / 6000);
        lc.lineCap = 'round';
        lc.strokeStyle = `rgba(24,12,10,${(0.62 * some).toFixed(3)})`;
        lc.lineWidth = 26;
        lc.beginPath();
        lc.moveTo(qm.ax - cx, qm.ay - cy);
        lc.lineTo(ex - cx, ey - cy);
        lc.stroke();
        lc.strokeStyle = vida < 2500 ? `rgba(247,118,34,${(0.6 * (1 - vida / 2500)).toFixed(3)})` : `rgba(8,4,4,${(0.4 * some).toFixed(3)})`;
        lc.lineWidth = 5;
        lc.stroke();
        lc.lineCap = 'butt';
      }
      // Fatia 17: o aviso das feras fica no chão (debaixo de quem está em cima dele); o jato de fogo vai por cima.
      if (z === 'bar') desenharChaoFera(t, agora, cx, cy, 'chao');
      type D = { depth: number; tie: number; draw: () => void };
      const lista: D[] = [];
      const put = (sp: Sprite, x: number, y: number, alpha = 1) => {
        if (alpha < 1) lc.globalAlpha = alpha;
        lc.drawImage(toCanvas(sp.raster), Math.round(x - sp.ax - cx), Math.round(y - sp.ay - cy));
        if (alpha < 1) lc.globalAlpha = 1;
      };
      /** Fatia 8: sprite achatado/esticado (px inteiros, pés no lugar) e girado em volta dos pés (a queda). */
      const putForma = (sp: Sprite, x: number, y: number, sx: number, sy: number, ang = 0) => {
        const w0 = sp.raster.w;
        const h0 = sp.raster.h;
        const tm = tamanhoEsticado(w0, h0, { sx, sy });
        if (tm.w === w0 && tm.h === h0 && !ang) return put(sp, x, y);
        lc.save();
        lc.imageSmoothingEnabled = false;
        lc.translate(Math.round(x - cx), Math.round(y - cy));
        if (ang) lc.rotate((ang * Math.PI) / 180);
        lc.drawImage(toCanvas(sp.raster), -Math.round((sp.ax * tm.w) / w0), -Math.round((sp.ay * tm.h) / h0), tm.w, tm.h);
        lc.restore();
      };
      /** O item está atrás do corpo agora (preparação por cima da cabeça)? */
      const atras = (c: Corpo) => !!c.arma && !ehPoder(c.arma.tipo) && !!c.golpe && poseItem(c.arma.tipo, tempoGolpe(c, t)).ang < -40;
      /** O item na mão de `c`, girando em volta da mão no tempo do golpe. */
      const item = (c: Corpo, q: { x: number; y: number }) => {
        const tipo = c.arma!.tipo;
        const f = facing(c.fx, c.fy);
        const s = f.flip ? -1 : 1;
        if (ehPoder(tipo)) {
          // Guardado é uma bolinha na mão; carregando, a esfera e a aura são desenhadas à parte.
          if (c.fase === 'nada') put(armaSprite(tipo), q.x + s * 8, q.y - 8 - (Math.floor(agora / 300) % 2));
          return;
        }
        const sp = armaSprite(tipo);
        const mv = MOVIMENTO[tipo];
        const g = c.golpe;
        const u = g ? tempoGolpe(c, t) : null;
        const p = poseItem(tipo, u);
        const vib = mv.vibra && u !== null ? (Math.random() - 0.5) * 2 * mv.vibra : 0;
        const recuo = mv.recuo && u !== null && u > 0 ? -mv.recuo * Math.sin(Math.min(1, u * 2) * Math.PI) : 0;
        const hx = Math.round(q.x - cx + s * (8 + p.dx + recuo) + vib);
        const hy = Math.round(q.y - cy - 8 + p.dy + vib * 0.5);
        const comp = sp.ay * p.esc;
        const desenha = (pp: PoseItem, alpha: number) => {
          lc.save();
          lc.translate(hx + s * (pp.dx - p.dx), hy + (pp.dy - p.dy));
          lc.scale(s, 1);
          lc.rotate((pp.ang * Math.PI) / 180);
          lc.scale(1, pp.esc);
          lc.globalAlpha = alpha;
          lc.drawImage(toCanvas(sp.raster), -sp.ax, -sp.ay);
          lc.restore();
          lc.globalAlpha = 1;
        };
        // Rastro só na pancada em si (fim da ida e começo da volta), não na preparação.
        if (u !== null && g && u > -0.4 && u < 0.35) {
          const u0 = voltarNoGolpe(u, 60, g);
          const p0 = poseItem(tipo, u0);
          lc.save();
          lc.translate(hx, hy);
          lc.scale(s, 1);
          lc.globalCompositeOperation = 'lighter';
          if (mv.estocada && Math.abs(p.dx - p0.dx) > 2) {
            // Linhas de velocidade atrás da ponta.
            lc.fillStyle = mv.rastro ?? '#f4f4f4';
            lc.globalAlpha = 0.55;
            const d = Math.abs(p.dx - p0.dx);
            for (const oy of [-3, 0, 3]) lc.fillRect(-4 - d, oy - 1, 4 + d + Math.abs(oy), 1);
          } else if (mv.rastro && Math.abs(p.ang - p0.ang) > 25) {
            // Arco de luz entre a pose de agora e a de 60 ms atrás (ângulo do canvas = ângulo do item − 90°).
            const a0 = ((Math.min(p0.ang, p.ang) - 90) * Math.PI) / 180;
            const a1 = ((Math.max(p0.ang, p.ang) - 90) * Math.PI) / 180;
            // Meia-lua fina na ponta do item (não um leque cobrindo o boneco).
            lc.fillStyle = mv.rastro;
            lc.globalAlpha = 0.38;
            lc.beginPath();
            lc.arc(0, 0, comp, a0, a1);
            lc.arc(0, 0, comp * 0.72, a1, a0, true);
            lc.closePath();
            lc.fill();
            lc.globalAlpha = 0.9;
            lc.strokeStyle = '#ffffff';
            lc.lineWidth = 1;
            lc.beginPath();
            lc.arc(0, 0, comp, a0, a1);
            lc.stroke();
          }
          lc.restore();
          lc.globalAlpha = 1;
          if (mv.fantasma) for (const [ms, al] of [[110, 0.2], [55, 0.4]] as const) desenha(poseItem(tipo, voltarNoGolpe(u, ms, g)), al);
        }
        desenha(p, 1);
      };
      PROPS.forEach((pr, i) => {
        if (pr.kind === 'void' || zonaDe(pr.x, pr.y) !== z || m.quebrados.has(i)) return;
        const sp = spriteDe(pr);
        const q = telaDe(pr.x + 0.5, pr.y + 0.5, z);
        lista.push({ depth: pr.x + pr.y + 1, tie: i, draw: () => put(sp, q.x, q.y) });
      });
      // Carros passando na rua (a hora decide onde estão: igual em todo aparelho).
      if (z === 'bar')
        for (const car of carrosEm(t)) {
          const q = telaDe(car.x, car.y, 'bar');
          lista.push({ depth: car.x + car.y + 0.6, tie: 3000 + (car.id % 1000), draw: () => put(carroSprite(car.cor, car.dir), q.x, q.y) });
        }
      // Placa "PISO MOLHADO" em cada poça (pisca nos últimos 3 s).
      molhados.forEach((p, i) => {
        if (p.ate - t < 3000 && Math.floor(agora / 200) % 2) return;
        const q = telaDe(p.x + 0.25, p.y - 0.25, z);
        lista.push({
          depth: p.x + p.y,
          tie: 4500 + i,
          draw: () => {
            const x = Math.round(q.x - cx);
            const y = Math.round(q.y - cy);
            lc.fillStyle = '#181425';
            lc.fillRect(x - 4, y - 12, 9, 12);
            lc.fillStyle = '#feae34';
            lc.fillRect(x - 3, y - 11, 7, 9);
            lc.fillStyle = '#c28a1f';
            lc.fillRect(x - 3, y - 2, 1, 2);
            lc.fillRect(x + 3, y - 2, 1, 2);
            lc.fillStyle = '#181425';
            lc.fillRect(x, y - 10, 1, 4); // "!"
            lc.fillRect(x, y - 5, 1, 1);
          },
        });
      });
      // Grana caída: nota verde que pisca antes de sumir.
      m.grana.forEach((g, i) => {
        if (zonaDe(g.x, g.y) !== z) return;
        if (g.ate - t < 5000 && Math.floor(agora / 150) % 2) return;
        const q = telaDe(g.x, g.y, z);
        lista.push({
          depth: g.x + g.y - 0.3,
          tie: 4000 + i,
          draw: () => {
            const x = Math.round(q.x - cx) - 4;
            const y = Math.round(q.y - cy) - 3 - (Math.floor(agora / 250 + i) % 2);
            lc.fillStyle = '#265c42';
            lc.fillRect(x - 1, y - 1, 10, 6);
            lc.fillStyle = '#63c74d';
            lc.fillRect(x, y, 8, 4);
            lc.fillStyle = '#feae34';
            lc.fillRect(x + 3, y + 1, 2, 2);
          },
        });
      });
      // Fatia 12: o item esperando o par no canto do balcão.
      if (z === 'bar' && m.bancada) {
        // Em cima do tampo (o desenho vai na frente do balcão, mas na altura do tampo).
        const q = telaDe(BANCADA[0], BANCADA[1] - 0.9, z);
        const sp = armaSprite(m.bancada.arma);
        lista.push({ depth: BANCADA[0] + BANCADA[1] + 0.2, tie: 4900, draw: () => put(sp, q.x, q.y - 15) });
      }
      // Fatia 10: a ratazana do evento e o disjuntor na parede do fundo (luz de aviso piscando no apagão).
      if (z === 'bar' && ev.rato && !ev.rato.fora) {
        const r = ev.rato;
        const q = telaDe(r.x, r.y, z);
        lista.push({ depth: r.x + r.y, tie: 5000, draw: () => desenharRato(q.x - cx, q.y - cy, r, t) });
      }
      // Fatia 17: a cabeça do dragão pendurada no furo e o dinossauro do circo.
      if (z === 'bar' && ev.dragao) {
        const f = ev.dragao.furo;
        const q = telaDe(f[0], f[1], z);
        lista.push({ depth: f[0] + f[1], tie: 5000, draw: () => desenharDragao(q.x - cx, q.y - cy, t, agora) });
      }
      if (z === 'bar' && ev.dino && !ev.dino.fora) {
        const r = ev.dino;
        const q = telaDe(r.x, r.y, z);
        lista.push({ depth: r.x + r.y, tie: 5000, draw: () => desenharDino(q.x - cx, q.y - cy, r, t, agora) });
      }
      if (z === 'bar' && ev.ag?.tipo === 'alien' && ev.fase === 'andamento' && !ev.acabou) {
        const vidas = vidasInvasao(ev.n);
        if (ev.fim?.como !== 'morto' && t - ev.ag.inicio < VISITA_MS) {
          const q = telaDe(ASSENTO_ALIEN[0], ASSENTO_ALIEN[1], z);
          lista.push({ depth: ASSENTO_ALIEN[0] + ASSENTO_ALIEN[1], tie: 5002, draw: () => desenharAlien(q.x - cx, q.y - cy, t) });
        }
        if (ev.fim?.como === 'morto') {
          const tRel = t - ev.fim.at;
          for (let k = 0; k < N_DISCOS; k++) {
            const alvo = achar(m, ev.alvos[k]);
            const ent = `disco${k}`;
            if (!alvo || !ev.levantando.has(alvo.id)) continue;
            const q = telaDe(alvo.x, alvo.y, z);
            const falta = 1 - Math.min(1, (ev.danoPor[ent] ?? 0) / vidas.disco);
            lista.push({
              depth: alvo.x + alvo.y + 0.6,
              tie: 5100 + k,
              draw: () => {
                const x = Math.round(q.x - cx);
                const y = Math.round(q.y - cy);
                lc.globalCompositeOperation = 'lighter';
                lc.fillStyle = padraoBayer('#3c8a5a', 0.5);
                lc.fillRect(x - 6, y - 70, 12, 70);
                lc.globalCompositeOperation = 'source-over';
                desenharDisco(x, y - 74, t, false, ent, falta);
              },
            });
          }
          const gF = Math.max(0, vidas.grande - (ev.danoPor.grande ?? 0));
          if (tRel >= GRANDE_EM && tRel < INVASAO_MS && gF > 0) {
            const g = posGrande(tRel);
            const q = telaDe(g.x, g.y, z);
            // A sombra no chão é onde o golpe pega (o disco paira 60 px acima dela).
            lista.push({
              depth: -0.5,
              tie: 1,
              draw: () => {
                lc.fillStyle = padraoBayer('#0e0b16', 0.5);
                lc.beginPath();
                lc.ellipse(Math.round(q.x - cx), Math.round(q.y - cy), 20, 7, 0, 0, Math.PI * 2);
                lc.fill();
              },
            });
            lista.push({ depth: g.x + g.y + 2, tie: 5200, draw: () => desenharDisco(Math.round(q.x - cx), Math.round(q.y - cy) - 60, t, true, 'grande', gF / vidas.grande) });
            const l = varredura(ev.ag.semente, tRel);
            if (l) {
              const a = l.eixo === 'x' ? telaDe(l.v, 0.2, z) : telaDe(0.2, l.v, z);
              const b = l.eixo === 'x' ? telaDe(l.v, 9.8, z) : telaDe(21.8, l.v, z);
              lista.push({
                depth: -1,
                tie: 0,
                draw: () => {
                  // Aviso: tracejado vermelho/laranja piscando (lê no chão escuro e no véu verde); raio: faixa branca.
                  // Movimento reduzido: o aviso fica vermelho parado (sem piscar 8 vezes por segundo).
                  const pisca = !reduzidoRef.current && Math.floor(agora / 120) % 2 === 0;
                  lc.strokeStyle = l.fase === 'aviso' ? (pisca ? '#feae34' : '#e43b44') : '#e8f7ff';
                  lc.lineWidth = l.fase === 'aviso' ? 2 : 4;
                  lc.setLineDash(l.fase === 'aviso' ? [6, 4] : []);
                  lc.beginPath();
                  lc.moveTo(a.x - cx, a.y - cy);
                  lc.lineTo(b.x - cx, b.y - cy);
                  lc.stroke();
                  lc.setLineDash([]);
                },
              });
            }
          }
        }
      }
      if (z === 'bar') {
        const q = telaDe(DISJUNTOR[0], DISJUNTOR[1] - 0.7, z);
        lista.push({
          depth: DISJUNTOR[0] + DISJUNTOR[1] - 0.8,
          tie: 5001,
          draw: () => {
            const x = Math.round(q.x - cx) - 3;
            const y = Math.round(q.y - cy) - 26;
            lc.fillStyle = '#3a3a48';
            lc.fillRect(x, y, 7, 9);
            lc.fillStyle = '#8b9bb4';
            lc.fillRect(x + 1, y + 1, 5, 7);
            lc.fillStyle = '#181425';
            lc.fillRect(x + 3, y + (apagado() ? 5 : 2), 1, 3);
            lc.fillStyle = apagado() && Math.floor(agora / 300) % 2 ? '#e43b44' : '#265c42';
            lc.fillRect(x + 5, y + 1, 1, 1);
          },
        });
      }
      m.chao.forEach((a, i) => {
        if (a.volta || zonaDe(a.x, a.y) !== z) return;
        const q = telaDe(a.x, a.y, z);
        lista.push({ depth: a.x + a.y - 0.2, tie: 1000 + i, draw: () => put(armaSprite(a.arma), q.x, q.y) });
      });
      m.corpos.forEach((c, i) => {
        if (c.ausente || zonaDe(c.x, c.y) !== z) return;
        const q = telaDe(c.x, c.y, z);
        const calmo = reduzidoRef.current;
        const deitado = poseDe(c, t) === 'ko';
        // Fatia 8 (só desenho): a queda de 0,3 s antes de deitar, o recuo e o achatamento de quem apanha e a respiração.
        const cai = deitado && c.quem !== 'amigo' && caiuEm.has(c.id) ? poseQueda(quedaDe(c.id), t - caiuEm.get(c.id)!, calmo) : null;
        const sp = spriteDoCorpo(c, t, false, !!cai);
        const imp = impactos.get(c.id);
        const idadeImp = imp ? t - imp.t0 : Infinity;
        const rc = imp ? recuo(idadeImp, imp.forte, imp.dx, imp.dy, calmo) : { x: 0, y: 0 };
        const es = imp && !deitado ? esticao(idadeImp, imp.forte, calmo) : { sx: 1, sy: 1 };
        const bob = !deitado && c.estado === 'normal' && poseDe(c, t) === 'stand' ? respiro(c.id, t, calmo) : 0;
        const qc = { x: q.x + rc.x, y: q.y + rc.y - bob };
        const giro = cai ? (facing(c.fx, c.fy).flip ? -cai.ang : cai.ang) : 0;
        const segurador = c.seguradoPor ? achar(m, c.seguradoPor) : undefined;
        const depth = segurador ? segurador.x + segurador.y + 0.05 : c.x + c.y - (deitado ? 0.4 : 0);
        lista.push({
          depth,
          tie: 2000 + i,
          draw: () => {
            const ergue = (c.estado === 'segurado' ? 8 : 0) + Math.round((ev.levantando.get(c.id) ?? 0) * 46);
            if (!deitado) {
              // Fatia 9: sombra pontilhada (Bayer, metade das casas) em vez de preto translúcido liso.
              lc.fillStyle = padraoBayer('#0e0b16', 0.5);
              lc.beginPath();
              lc.ellipse(Math.round(q.x - cx), Math.round(q.y - cy), 7, 3, 0, 0, Math.PI * 2);
              lc.fill();
            }
            // Você: anel na sua cor sob os pés (entre 10 bonecos do mesmo corpo).
            if (c.quem === 'eu') {
              lc.strokeStyle = PLAYER_BY_ID[player].color;
              lc.lineWidth = 1;
              lc.beginPath();
              lc.ellipse(Math.round(q.x - cx) + 0.5, Math.round(q.y - cy) + 0.5, 9, 4, 0, 0, Math.PI * 2);
              lc.stroke();
            }
            // Item lá atrás da cabeça (preparação): desenhado antes do corpo, por trás dele.
            if (c.arma && !deitado && atras(c)) item(c, qc);
            if (cai) putForma(sp, qc.x, qc.y - ergue - cai.quique, 1, cai.sy, giro);
            else putForma(sp, qc.x, qc.y - ergue, es.sx, es.sy);
            // Fatia 20: curativo em X na testa de quem apanhou de você nos últimos 7 dias. Vai na passada do corpo
            // (por cima, ele flutuava sobre o guarda-sol); de costas, deitado ou caindo, não aparece.
            if (c.quem === 'npc' && !deitado && !cai && !facing(c.fx, c.fy).back && estadoNpc(memoria.current, c.id, Date.now()).curativo)
              desenharCurativo(Math.round(qc.x - cx), Math.round(qc.y - cy) - ergue - CURATIVO_ALT);
            if (c.quem === 'eu' && !deitado) {
              const ax = Math.round(q.x - cx);
              const ay = Math.round(q.y - cy) - 44 - (Math.floor(agora / 300) % 2);
              lc.fillStyle = PLAYER_BY_ID[player].color;
              lc.fillRect(ax - 2, ay, 5, 1);
              lc.fillRect(ax - 1, ay + 1, 3, 1);
              lc.fillRect(ax, ay + 2, 1, 1);
            }
            // Seu Zé trazendo mobília nova do depósito.
            if (c.carga && !deitado) {
              const bx = Math.round(q.x - cx) - 6;
              const by = Math.round(q.y - cy) - 24 - ergue;
              lc.fillStyle = '#5c3620';
              lc.fillRect(bx, by, 12, 9);
              lc.fillStyle = '#8f563b';
              lc.fillRect(bx + 1, by + 1, 10, 7);
              lc.fillStyle = '#5c3620';
              lc.fillRect(bx + 1, by + 4, 10, 1);
            }
            // Item na mão: cada um com o seu movimento (Fatia 5), arco de luz, linhas de estocada e imagem fantasma.
            if (c.arma && !deitado && !atras(c)) item(c, qc);
            // Fatia 12: os status em cima da cabeça (um ícone de 5 px por status ativo) e a aura da carga.
            const sts = STATUS.filter((s) => (c.st[s] ?? 0) > t);
            if (sts.length && !deitado) desenharStatus(sts, Math.round(qc.x - cx) + 9, Math.round(qc.y - cy) - ergue - 30, agora);
            if (c.quem === 'eu' && c.fase === 'antes' && t > c.faseAte) {
              const n = nivelCarga(t - c.faseAte);
              lc.strokeStyle = n === 2 ? '#f77622' : n === 1 ? '#fee761' : 'rgba(244,244,244,0.5)';
              lc.lineWidth = 1;
              lc.beginPath();
              lc.ellipse(Math.round(q.x - cx), Math.round(q.y - cy), 8 + n * 2 + (Math.floor(agora / 90) % 2), 3 + n, 0, 0, Math.PI * 2);
              lc.stroke();
            }
            // Fatia 15: copo no alto de quem brindou, e o anel de quem está sendo levantado.
            if ((brinde.current.copos.get(c.id) ?? 0) > barPresence.now() && !deitado) {
              // Na mão levantada, colado ao lado da cabeça (mais alto parecia o copo de quem está atrás).
              const bx = Math.round(qc.x - cx) + 8;
              const by = Math.round(qc.y - cy) - 36 - ergue;
              lc.fillStyle = '#f4f4f4';
              lc.fillRect(bx, by, 6, 2);
              lc.fillStyle = '#feae34';
              lc.fillRect(bx, by + 2, 6, 7);
              lc.fillStyle = '#fee761';
              lc.fillRect(bx + 1, by + 3, 2, 5);
              lc.fillStyle = '#c0cbdc';
              lc.fillRect(bx + 6, by + 3, 2, 4);
            }
            if (reviver.current.alvo === c.id && reviver.current.ms > 0) {
              const u = Math.min(1, reviver.current.ms / REVIVE_MS);
              lc.strokeStyle = '#63c74d';
              lc.lineWidth = 2;
              lc.beginPath();
              lc.arc(Math.round(q.x - cx), Math.round(q.y - cy) - 16, 7, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2);
              lc.stroke();
            }
            // Punho no alto: o NPC vai bater (aviso para desviar).
            if (c.quem === 'npc' && c.fase === 'antes') {
              lc.fillStyle = '#e43b44';
              lc.fillRect(Math.round(q.x - cx) - 1, Math.round(q.y - cy) - 44, 2, 6);
              lc.fillRect(Math.round(q.x - cx) - 1, Math.round(q.y - cy) - 36, 2, 2);
            }
            // Vida de quem apanhou há pouco.
            if (c.quem === 'npc' && c.estado !== 'ko' && t - c.ultimoDano < 3000) {
              const w = 16;
              const bx = Math.round(q.x - cx - w / 2);
              const by = Math.round(q.y - cy) - 40;
              lc.fillStyle = '#181425';
              lc.fillRect(bx - 1, by - 1, w + 2, 4);
              lc.fillStyle = '#e43b44';
              lc.fillRect(bx, by, Math.round((w * c.vida) / c.vidaMax), 2);
            }
            // Zzz dos amigos desmaiados.
            if (c.quem === 'amigo' && c.estado === 'ko' && !c.seguradoPor) {
              const k = Math.floor(agora / 600) % 3;
              lc.fillStyle = '#c0cbdc';
              lc.font = '6px VT323, monospace';
              lc.fillText('z'.repeat(k + 1), Math.round(q.x - cx) + 6, Math.round(q.y - cy) - 12 - k * 2);
            }
          },
        });
      });
      // Banheiro assombrado: o radinho na pia (treme quando um susto vem aí) e a coisa da vez.
      if (z === 'banheiro' && sustosRef.current) {
        const falta = faltaSusto(assombro, t);
        const chiando = falta < 3000 || assombro.atual?.k === 'radio';
        const rq = telaDe(LUGAR.radio[0], LUGAR.radio[1], z);
        const treme = chiando ? Math.round(Math.sin(agora / 25)) : 0;
        lista.push({ depth: LUGAR.radio[0] + LUGAR.radio[1] + 0.4, tie: 5000, draw: () => put(RADIO(), rq.x + treme, rq.y - 13) });
        if (chiando && agora > chiadoEm) {
          chiadoEm = agora + 380 + Math.random() * 300;
          if (Math.random() < (assombro.atual ? 0.8 : 0.5)) tocar('chiado');
          if (Math.random() < 0.4) textos.push({ area: z, x: rq.x + 6, y: rq.y - 20, texto: 'ksshh', cor: '#94b0c2', t0: agora });
        }
        const s = assombro.atual;
        if (s && s.k !== 'reflexo' && s.k !== 'radio') {
          const vida = t - s.ini;
          const sp = spriteSusto(s.k, Math.floor(vida / (s.k === 'menina' ? 400 : 160)), s.k === 'menina' && vida >= 3800 ? 1 : 0);
          if (sp) {
            const p = telaDe(s.x, s.y, z);
            const alto = s.k === 'chapeu' && s.agarrado ? 31 : s.k === 'chapeu' ? Math.max(0, Math.sin(Math.min(1, vida / 700) * Math.PI) * 18) : 0;
            const tr0 = s.k === 'chapeu' && s.agarrado ? Math.round(Math.sin(agora / 40)) : 0;
            lista.push({ depth: s.x + s.y + (s.k === 'chapeu' ? 0.08 : 0), tie: 5001, draw: () => put(sp, p.x + tr0, p.y - alto, s.k === 'corredor' ? 0.85 : 1) });
          }
        }
      }
      for (const d of byDepth(lista)) d.draw();
      // O reflexo atrasado: no espelho, você de 1 s atrás (e depois ele sorri sozinho).
      if (z === 'banheiro' && sustosRef.current && assombro.atual?.k === 'reflexo') {
        espelhoHist.push({ t: agora, sp: spriteDoCorpo(me, t, true) });
        while (espelhoHist.length && agora - espelhoHist[0].t > 1500) espelhoHist.shift();
        const velho = [...espelhoHist].reverse().find((h) => agora - h.t >= 1000) ?? espelhoHist[0];
        const ep = telaDe(LUGAR.espelho[0], LUGAR.espelho[1], z);
        const ex = Math.round(ep.x - cx) + 4;
        const ey = Math.round(ep.y - cy) - 43;
        lc.globalAlpha = 0.75;
        lc.drawImage(toCanvas(velho.sp.raster), 4, 0, 16, 14, ex - 8, ey - 7, 16, 14);
        lc.globalAlpha = 1;
        if (t - assombro.atual.ini > 4000) {
          lc.fillStyle = '#a22633';
          lc.fillRect(ex - 4, ey + 3, 8, 2);
          lc.fillStyle = '#f4f4f4';
          lc.fillRect(ex - 3, ey + 3, 6, 1);
        }
      } else espelhoHist.length = 0;
      // Susto novo: som próprio (e o vidro da janela estoura no totó).
      if (assombro.vistos !== sustoVisto) {
        sustoVisto = assombro.vistos;
        const k = assombro.atual?.k;
        const so = k ? SOM_SUSTO[k] : null;
        if (so) tocar(so);
        if (k === 'toto') {
          const jp = telaDe(LUGAR.janela[0], LUGAR.janela[1] + 0.3, 'banheiro');
          espirrar('banheiro', jp.x, jp.y, 26, 0, 1, 18, ['#c0cbdc', '#94b0c2', '#f4f4f4'], 1.4, true, 1);
          tocar('vidro');
        }
      }

      // Pedaços voando (girando).
      for (const pd of pedacos) {
        if (pd.area !== z) continue;
        lc.save();
        lc.translate(Math.round(pd.x - cx), Math.round(pd.y - pd.z - cy));
        lc.rotate(pd.ang);
        lc.drawImage(toCanvas(pd.sp.raster), -pd.sp.ax, -pd.sp.ay);
        lc.restore();
      }
      // Gotas no ar.
      // Fatia 8: rampa dura de 3 tons tirada da cor da própria gota (quente no estouro, escura no fim) e o tamanho pela idade.
      for (const gt of gotas) {
        if (gt.area !== z) continue;
        const idade = t - gt.nasce;
        const tam = tamGota(gt.tam, idade);
        lc.fillStyle = rampaGota(gt.cor)[tomGota(idade)];
        lc.fillRect(Math.round(gt.x - cx), Math.round(gt.y - gt.z - cy), tam, tam);
      }

      // Rajada do Fiado: a carga de quem está carregando e os feixes no ar.
      for (const c of m.corpos) {
        const tipoC = c.arma?.tipo;
        if (!ehPoder(tipoC) || c.fase !== 'antes' || c.ausente || zonaDe(c.x, c.y) !== z) continue;
        const k = Math.max(0, Math.min(1, 1 - (c.faseAte - t) / ARMAS[tipoC].antecipa));
        const cc = coresCarga(tipoC);
        const q = telaDe(c.x, c.y, z);
        const s = facing(c.fx, c.fy).flip ? -1 : 1;
        const bx = Math.round(q.x - cx);
        const by = Math.round(q.y - cy);
        // O resto da tela escurece; o corpo fica por cima, aceso.
        lc.fillStyle = `rgba(12,4,24,${(0.55 * k).toFixed(3)})`;
        lc.fillRect(0, 0, vw, vh);
        const corpo = spriteDoCorpo(c, t, true);
        const cvs = toCanvas(corpo.raster);
        const gl = lc.createRadialGradient(bx, by - 16, 2, bx, by - 16, 26 + 14 * k);
        gl.addColorStop(0, rgbaDe(cc.luz, 0.55 * k));
        gl.addColorStop(1, rgbaDe(cc.luz, 0));
        lc.globalCompositeOperation = 'lighter';
        lc.fillStyle = gl;
        lc.fillRect(bx - 50, by - 66, 100, 100);
        lc.globalCompositeOperation = 'source-over';
        lc.drawImage(cvs, bx - corpo.ax, by - corpo.ay);
        // Aura no contorno: o boneco somando luz, deslocado, tremendo.
        lc.globalCompositeOperation = 'lighter';
        lc.globalAlpha = 0.18 + 0.3 * k;
        const tr = 1 + Math.round(k * 1.5 + Math.random());
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) lc.drawImage(cvs, bx - corpo.ax + ox * tr, by - corpo.ay + oy * tr);
        lc.globalAlpha = 1;
        // A esfera entre as mãos, na frente do peito.
        const ox = bx + s * 11;
        const oy = by - 18;
        const r = 2 + 6.5 * k + Math.sin(agora / 37) * (0.4 + k * 0.8);
        const go = lc.createRadialGradient(ox, oy, 0, ox, oy, r * 4);
        go.addColorStop(0, rgbaDe(cc.halo, 0.75));
        go.addColorStop(1, rgbaDe(cc.halo, 0));
        lc.fillStyle = go;
        lc.fillRect(ox - r * 4, oy - r * 4, r * 8, r * 8);
        lc.fillStyle = cc.corpo;
        lc.beginPath();
        lc.arc(ox, oy, r, 0, Math.PI * 2);
        lc.fill();
        lc.fillStyle = cc.miolo;
        lc.beginPath();
        lc.arc(ox, oy, r * 0.7, 0, Math.PI * 2);
        lc.fill();
        lc.fillStyle = '#ffffff';
        lc.beginPath();
        lc.arc(ox - r * 0.15, oy - r * 0.15, r * 0.4, 0, Math.PI * 2);
        lc.fill();
        // Faíscas sugadas para a esfera.
        const n = Math.round(8 + 28 * k);
        const CORES = cc.faiscas;
        for (let i = 0; i < n; i++) {
          const fz = (agora / 650 + i * 0.137) % 1;
          const d = 38 * (1 - fz) * (0.55 + 0.45 * (((i * 7) % 5) / 4));
          const a = i * 2.399 + agora / 900;
          lc.globalAlpha = fz;
          lc.fillStyle = CORES[i % 4];
          const tam = i % 5 === 0 ? 2 : 1;
          lc.fillRect(Math.round(ox + Math.cos(a) * d), Math.round(oy + Math.sin(a) * d * 0.7), tam, tam);
        }
        // Raios entre a esfera e o corpo no fim da carga.
        if (k > 0.55) {
          lc.globalAlpha = 0.8;
          lc.strokeStyle = Math.floor(agora / 60) % 2 ? cc.raio : '#ffffff';
          lc.lineWidth = 1;
          for (let j = 0; j < 2; j++) {
            lc.beginPath();
            lc.moveTo(ox, oy);
            let px = ox;
            let py = oy;
            for (let st = 0; st < 4; st++) {
              px += -s * (3 + Math.random() * 4);
              py += (Math.random() - 0.5) * 10;
              lc.lineTo(px, py);
            }
            lc.stroke();
          }
        }
        lc.globalCompositeOperation = 'source-over';
        // Pedrinhas subindo do chão.
        if (k > 0.35)
          for (let i = 0; i < 12; i++) {
            const fz = (agora / 900 + i * 0.21) % 1;
            lc.globalAlpha = 1 - fz;
            lc.fillStyle = i % 2 ? '#8b9bb4' : '#5a6988';
            lc.fillRect(bx + ((i * 37) % 36) - 18, Math.round(by + 3 - fz * 28 * k), i % 3 ? 1 : 2, i % 3 ? 1 : 2);
          }
        lc.globalAlpha = 1;
        m.trauma = Math.max(m.trauma, 0.12 + 0.3 * k);
        // O grito da rajada, sílaba por sílaba (os poderes novos gritam no disparo).
        const sil = silabas.get(c.id) ?? 0;
        if (tipoC === 'rajada' && sil < SILABAS.length && k >= SILABAS[sil][0]) {
          onos.push({ area: z, x: q.x - 18 + sil * 12, y: q.y - 44 - sil * 7, texto: SILABAS[sil][1], cor: '#fee761', t0: m.t });
          silabas.set(c.id, sil + 1);
        }
      }
      for (const r of m.rajadas) {
        if (zonaDe(r.x, r.y) !== z) continue;
        const vida = t - r.t0;
        const D = ARMAS.rajada.recupera;
        if (vida < 0 || vida > D + 400) continue;
        const frente = Math.min(r.len, (vida / 1000) * RAJADA_VEL);
        const larg = vida < D - 250 ? 1 : Math.max(0, (D - vida) / 250);
        const a = telaDe(r.x, r.y, z);
        const b = telaDe(r.x + r.fx * frente, r.y + r.fy * frente, z);
        const ax = a.x - cx;
        const ay = a.y - cy - 16;
        const L = Math.hypot(b.x - a.x, b.y - a.y);
        if (larg > 0) {
          const pul = 1 + 0.12 * Math.sin(agora / 28);
          lc.save();
          lc.translate(ax, ay);
          lc.rotate(Math.atan2(b.y - a.y, b.x - a.x));
          lc.globalCompositeOperation = 'lighter';
          const h = 24 * larg * pul;
          const gr = lc.createLinearGradient(0, -h, 0, h);
          gr.addColorStop(0, 'rgba(181,80,136,0)');
          gr.addColorStop(0.5, 'rgba(255,79,176,0.9)');
          gr.addColorStop(1, 'rgba(181,80,136,0)');
          lc.fillStyle = gr;
          lc.fillRect(0, -h, L, h * 2);
          const faixa = (hh: number, cor: string, al: number) => {
            lc.globalAlpha = al;
            lc.fillStyle = cor;
            lc.fillRect(0, -hh / 2, L, hh);
            lc.beginPath();
            lc.arc(L, 0, hh / 2, -Math.PI / 2, Math.PI / 2);
            lc.fill();
          };
          faixa(22 * larg * pul, '#feae34', 0.85);
          faixa(13 * larg, '#fee761', 0.9);
          faixa(6 * larg * pul, '#ffffff', 1);
          // Faixas de energia correndo para fora.
          lc.fillStyle = '#ffffff';
          lc.globalAlpha = 0.7;
          for (let x = (vida * 0.5) % 16; x < L; x += 16) lc.fillRect(x, -7 * larg, 4, 14 * larg);
          // Boca do feixe e a frente.
          lc.globalAlpha = 1;
          for (const [px, rr, cor] of [[0, 15, '#feae34'], [0, 7, '#ffffff'], [L, 19 * pul, '#feae34'], [L, 9, '#ffffff']] as const) {
            lc.fillStyle = cor;
            lc.beginPath();
            lc.arc(px, 0, rr * larg, 0, Math.PI * 2);
            lc.fill();
          }
          lc.restore();
          lc.globalAlpha = 1;
          lc.globalCompositeOperation = 'source-over';
          // Faíscas pelo caminho.
          if (Math.random() < 0.85) {
            const fz = Math.random() * frente;
            const p = telaDe(r.x + r.fx * fz, r.y + r.fy * fz, z);
            espirrar(z, p.x, p.y, 16, Math.random() - 0.5, -1, 3, ['#fee761', '#ffffff', '#ff4fb0'], 1.5, false, 1);
          }
        }
        // Clarão no disparo (limitado a 3 por segundo; brilho suave no modo reduzido).
        const ac = vida < 90 ? claroes.opacidade(`raj:${r.de}:${r.t0}`, t, 0.85 * (1 - vida / 90), reduzidoRef.current) : 0;
        if (ac > 0) {
          lc.fillStyle = `rgba(255,250,230,${ac.toFixed(3)})`;
          lc.fillRect(0, 0, vw, vh);
        }
        // Estouro quando a frente chega no fim.
        if (frente >= r.len && !estouradas.has(r)) {
          estouradas.add(r);
          const p = telaDe(r.x + r.fx * r.len, r.y + r.fy * r.len, z);
          ondas.push({ area: z, x: p.x, y: p.y - 6, t0: m.t, raio: 64, cor: '#fee761' });
          ondas.push({ area: z, x: p.x, y: p.y - 6, t0: m.t + 90, raio: 40, cor: '#ff4fb0' });
          espirrar(z, p.x, p.y, 14, 0, -1, 40, ['#feae34', '#fee761', '#5c3620', '#8b9bb4'], 2, true, 2);
          tocar('forte');
        }
      }
      // Os 10 poderes novos no ar e o fogo da Pinga no chão.
      if (m.poderes.length || m.fogos.length) {
        const palco: PalcoPoder = {
          lc,
          z,
          cx,
          cy,
          vw,
          vh,
          t,
          agora,
          posDe: (id) => {
            const c = achar(m, id);
            return c ? { x: c.x, y: c.y } : null;
          },
          espirrar: (x, y, alt, dx, dy, n, cores, forca, mancha, tam) => espirrar(z, x, y, alt, dx, dy, n, cores, forca, mancha, tam),
          onda: (x, y, raio, cor, atraso = 0) => ondas.push({ area: z, x, y, t0: m.t + atraso, raio, cor }),
          texto: (x, y, texto, cor) => {
            onos.push({ area: z, x, y, texto, cor, t0: m.t });
            if (onos.length > 8) onos.shift();
          },
          tremer: (k) => {
            m.trauma = Math.min(1, m.trauma + k);
          },
          clarao: (chave, alpha) => claroes.opacidade(chave, t, alpha, reduzidoRef.current),
        };
        for (const f of m.fogos) if (f.zona === z) desenharFogo(palco, f);
        for (const d of m.poderes) if (zonaDe(d.x, d.y) === z) desenharPoder(palco, d);
      }
      if (z === 'bar') desenharChaoFera(t, agora, cx, cy, 'fogo');
      // Ondas de choque (marreta, frigideira, estouro da rajada).
      for (let i = ondas.length - 1; i >= 0; i--) {
        const o = ondas[i];
        const k = (t - o.t0) / 450;
        if (k >= 1) {
          ondas.splice(i, 1);
          continue;
        }
        if (o.area !== z || k < 0) continue;
        lc.globalAlpha = 1 - k;
        lc.strokeStyle = o.cor;
        lc.lineWidth = 2;
        lc.beginPath();
        lc.ellipse(Math.round(o.x - cx), Math.round(o.y - cy), o.raio * (0.15 + k), o.raio * (0.15 + k) * 0.5, 0, 0, Math.PI * 2);
        lc.stroke();
        lc.globalAlpha = 1;
      }

      // Ambiente: as luzes (fogo tremendo, poste que falha, portal pulsando, jukebox e fliperamas) e o que solta no ar.
      {
        const dtA = ambEm ? Math.min(0.1, (agora - ambEm) / 1000) : 0;
        ambEm = agora;
        const carros = z === 'bar' ? carrosEm(t) : [];
        passoAmbiente(ambiente, amb.emissores, z, dtA, carros);
        const ponto = (x: number, y: number, h: number) => {
          const q = telaDe(x, y, z);
          return [Math.round(q.x - cx), Math.round(q.y - cy - h)] as const;
        };
        luzesQuadro.length = 0;
        const brilho = (x: number, y: number, r: number, cor: string, a: number) => {
          if (a <= 0.01) return;
          luzesQuadro.push({ x, y, r, cor, a });
          const sp = luzPronta(cor, r);
          lc.globalAlpha = Math.min(1, a);
          lc.drawImage(sp, Math.round(x - sp.width / 2), Math.round(y - sp.height / 2));
          lc.globalAlpha = 1;
        };
        lc.globalCompositeOperation = 'lighter';
        for (const l of amb.luzes) {
          if (l.zona !== z) continue;
          if (apagado() && l.tipo !== 'fogo') continue; // Fatia 10: no apagão só o fogo segue aceso
          const f = forcaLuz(l, t);
          const [x, y] = ponto(l.x, l.y, l.h);
          const cor = l.tipo === 'jukebox' ? corJukebox(t) : l.cor;
          brilho(x, y, l.r, cor, f * (l.tipo === 'poste' ? 0.32 : l.tipo === 'fogo' ? 0.7 : 0.42));
          // Poste: a poça de luz no chão também.
          if (l.tipo === 'poste') {
            const [gx, gy] = ponto(l.x, l.y, 0);
            lc.globalAlpha = f * 0.16;
            lc.fillStyle = l.cor;
            lc.beginPath();
            lc.ellipse(gx, gy, 26, 12, 0, 0, Math.PI * 2);
            lc.fill();
            lc.globalAlpha = 1;
          }
        }
        // Faróis dos carros na rua (o facho vai para onde o carro anda).
        for (const c of carros) {
          const [x, y] = ponto(c.x + c.dir * 1.8, c.y, 4);
          brilho(x, y, 22, '#fff4c8', 0.35);
        }
        lc.globalCompositeOperation = 'source-over';
        // O poste que falha: quando apaga, a calçada em volta escurece.
        for (const l of amb.luzes) {
          if (l.zona !== z || l.tipo !== 'poste') continue;
          const f = forcaLuz(l, t);
          if (f > 0.5) continue;
          const [gx, gy] = ponto(l.x, l.y, 0);
          const gr = lc.createRadialGradient(gx, gy - 10, 4, gx, gy - 10, 56);
          gr.addColorStop(0, 'rgba(6,4,14,0.45)');
          gr.addColorStop(1, 'rgba(6,4,14,0)');
          lc.fillStyle = gr;
          lc.fillRect(gx - 56, gy - 66, 112, 112);
        }
        // Moscas nas caçambas.
        lc.fillStyle = '#181425';
        for (const mo of amb.moscas) {
          if (mo.zona !== z) continue;
          for (const [mx, my, mh] of moscasEm(mo, t)) {
            const [x, y] = ponto(mx, my, mh);
            lc.fillRect(x, y, 1, 1);
          }
        }
        // As partículas.
        for (const f of ambiente.p) {
          if (f.zona !== z) continue;
          const k = f.vida / f.dura;
          if (f.tipo === 'portal') {
            const [ox, oy] = ponto(f.x, f.y, f.h);
            lc.globalCompositeOperation = 'lighter';
            lc.globalAlpha = 1 - k;
            lc.fillStyle = f.cor;
            lc.fillRect(Math.round(ox + Math.cos(f.ang!) * f.raio! * 0.7), Math.round(oy + Math.sin(f.ang!) * f.raio!), 1, 1);
            lc.globalCompositeOperation = 'source-over';
            lc.globalAlpha = 1;
            continue;
          }
          const [x, y] = ponto(f.x, f.y, f.h);
          if (f.tipo === 'nevoa') {
            // Vapor gelado: desce devagar e some.
            lc.globalAlpha = 0.35 * Math.sin(Math.PI * k);
            lc.fillStyle = f.cor;
            lc.beginPath();
            lc.arc(x, y, 1.5 + k * 2.5, 0, Math.PI * 2);
            lc.fill();
          } else if (f.tipo === 'fumaca' || f.tipo === 'escape') {
            lc.fillStyle = padraoBayer(f.cor, (f.tipo === 'escape' ? 0.3 : 0.38) * (1 - k));
            lc.beginPath();
            lc.arc(x, y, f.tam + k * 4, 0, Math.PI * 2);
            lc.fill();
          } else if (f.tipo === 'nota') {
            lc.globalAlpha = 1 - k;
            lc.fillStyle = f.cor;
            const nx = Math.round(x + Math.sin(f.vida * 6) * 2);
            lc.fillRect(nx, y, 2, 2); // cabeça
            lc.fillRect(nx + 1, y - 4, 1, 4); // haste
            lc.fillRect(nx + 2, y - 4, 1, 1); // bandeirinha
          } else if (f.tipo === 'poeira') {
            lc.globalAlpha = 0.85 * Math.sin(Math.PI * k);
            lc.fillStyle = f.cor;
            lc.fillRect(x, y, 1, 1);
          } else {
            // Brasa (some esfriando), gota e respingo.
            if (f.tipo === 'brasa') lc.globalCompositeOperation = 'lighter';
            lc.globalAlpha = f.tipo === 'brasa' ? 1 - k * k : 0.9;
            lc.fillStyle = f.cor;
            lc.fillRect(x, y, 1, f.tipo === 'gota' ? 2 : 1);
            lc.globalCompositeOperation = 'source-over';
          }
          lc.globalAlpha = 1;
        }
      }

      // Fatia 9: mapa de luz da hora (só no salão e na rua): a cor da noite multiplica a cena e as luzes (fogo, neon,
      // poste, geladeira, lâmpadas do salão, faróis) devolvem a cor perto delas. De dia não custa nada.
      const escuro = z === 'bar' && apagado();
      const ambDia = escuro ? '#16142a' : z === 'bar' ? ambienteDaHora(horaFixa ?? horaBrasilia(t)) : null;
      if (ambDia) {
        const esc = nivel === 2 ? 2 : 1;
        const mw = Math.ceil(vw / esc);
        const mh = Math.ceil(vh / esc);
        if (mapa.width !== mw || mapa.height !== mh) {
          mapa.width = mw;
          mapa.height = mh;
        }
        mc.globalCompositeOperation = 'source-over';
        mc.fillStyle = ambDia;
        mc.fillRect(0, 0, mw, mh);
        mc.globalCompositeOperation = 'lighter';
        const acende = (x: number, y: number, r: number, cor: string, a: number) => {
          const sp = luzPronta(cor, r);
          mc.globalAlpha = Math.min(1, a);
          mc.drawImage(sp, (x - sp.width / 2) / esc, (y - sp.height / 2) / esc, sp.width / esc, sp.height / esc);
        };
        if (escuro) {
          // Apagão: só a lanterna do celular de cada um, a luz de emergência e o fogo.
          for (const c of m.corpos) {
            if ((c.quem !== 'eu' && c.quem !== 'remoto') || c.ausente || zonaDe(c.x, c.y) !== z) continue;
            const q = telaDe(c.x, c.y, z);
            acende(q.x - cx + c.fx * 10, q.y - cy - 14 + c.fy * 5, 64, '#fff0c8', 1);
          }
          const qe = telaDe(EMERGENCIA[0], EMERGENCIA[1], z);
          acende(qe.x - cx, qe.y - cy - 36, 44, '#63c74d', 0.8);
        } else
          for (const lp of lampadas) {
            const q = telaDe(lp.x, lp.y, z);
            acende(q.x - cx, q.y - cy - 30, 76, '#c8a878', 0.55);
          }
        for (const l of luzesQuadro) acende(l.x, l.y, l.r * 2, l.cor, l.a * 1.8);
        mc.globalAlpha = 1;
        mc.globalCompositeOperation = 'source-over';
        lc.globalCompositeOperation = 'multiply';
        lc.drawImage(mapa, 0, 0, mw * esc, mh * esc);
        lc.globalCompositeOperation = 'source-over';
      }
      // Brilho (bloom) barato: as luzes do quadro num buffer a 1/4, ampliado com suavização e somado. Some no nível 1.
      if (nivel === 0 && luzesQuadro.length) {
        const bw = Math.ceil(vw / 4);
        const bh = Math.ceil(vh / 4);
        if (bloom.width !== bw || bloom.height !== bh) {
          bloom.width = bw;
          bloom.height = bh;
        } else bc.clearRect(0, 0, bw, bh);
        bc.globalCompositeOperation = 'lighter';
        for (const l of luzesQuadro) {
          const sp = luzPronta(l.cor, l.r);
          bc.globalAlpha = Math.min(1, l.a);
          bc.drawImage(sp, (l.x - sp.width) / 4, (l.y - sp.height) / 4, sp.width / 2, sp.height / 2);
        }
        bc.globalAlpha = 1;
        lc.globalCompositeOperation = 'lighter';
        lc.globalAlpha = ambDia ? 0.55 : 0.3;
        lc.drawImage(bloom, 0, 0, bw * 4, bh * 4);
        lc.globalAlpha = 1;
        lc.globalCompositeOperation = 'source-over';
      }
      // Escuridão do banheiro: penumbra sempre (com sustos) e breu quando a lâmpada apaga, com um halo em volta de você.
      if (z === 'banheiro' && sustosRef.current) {
        const luz = luzAgora(assombro, t, true);
        const a = 0.3 + (1 - luz) * 0.62;
        const pm = telaDe(me.x, me.y, z);
        const px = pm.x - cx;
        const py = pm.y - cy - 12;
        const gr = lc.createRadialGradient(px, py, 5, px, py, luz ? 80 : 30);
        gr.addColorStop(0, `rgba(6,4,14,${(a * 0.2).toFixed(3)})`);
        gr.addColorStop(1, `rgba(6,4,14,${a.toFixed(3)})`);
        lc.fillStyle = gr;
        lc.fillRect(0, 0, vw, vh);
      }

      // Fatia 9: véu de cor do evento (invasão verde, viajante sépia, apagão), por cima da cena e por baixo dos textos.
      const ve = veuEvento(t);
      const vv = grading(ve.ev, ve.k);
      if (vv) {
        lc.globalCompositeOperation = vv.modo;
        lc.globalAlpha = vv.a;
        lc.fillStyle = vv.cor;
        lc.fillRect(0, 0, vw, vh);
        lc.globalAlpha = 1;
        lc.globalCompositeOperation = 'source-over';
      }
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(low, 0, 0, vw * S, vh * S);

      // Letreiros das paredes, escritos na inclinação da parede (a partir do canto do fundo da área).
      const a = AREAS[z];
      const o = telaDe(a.x0, a.y0, z);
      const tr = () => ctx.setTransform(S, S * 0.5, 0, S, (o.x - cx) * S, (o.y - cy) * S);
      const naArea = (k: string) => {
        const e = enfeiteDe(k);
        return e && e.zona === z ? e : null;
      };
      const neon = naArea('neon');
      if (neon) {
        tr();
        const pisca = Math.sin(agora / 180) > -0.92;
        ctx.font = '9px VT323, monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#ff4fb0';
        ctx.shadowBlur = pisca ? 6 * S : 0;
        ctx.fillStyle = pisca ? '#ffb0e0' : '#7a3a60';
        ctx.fillText('BOTECO DO SQUAD', (neon.u0 + neon.u1) / 2, -(neon.base + 4));
        ctx.shadowBlur = 0;
      }
      const tv = naArea('tv');
      if (tv) {
        tr();
        ctx.font = '5px VT323, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f4f4f4';
        ctx.fillText(`0 × 0  ${(Math.floor(agora / 60000) % 90) + 1}'`, (tv.u0 + tv.u1) / 2, -(tv.base + 18));
      }
      // Porta do depósito (atrás do balcão), de onde o Seu Zé tira mobília e onde some com os corpos.
      const dep = naArea('deposito');
      if (dep) {
        tr();
        ctx.textAlign = 'center';
        ctx.font = '4px VT323, monospace';
        ctx.fillStyle = '#feae34';
        ctx.fillText('DEPÓSITO', (dep.u0 + dep.u1) / 2, -(dep.base + 30));
      }
      // Lousa do placar: quem lidera as cruzadas (o placar de verdade abre na lousa).
      const lousa = naArea('lousa');
      if (lousa) {
        tr();
        ctx.textAlign = 'center';
        ctx.font = '5px VT323, monospace';
        ctx.fillStyle = '#e4e4e4';
        const meio = (lousa.u0 + lousa.u1) / 2;
        ctx.fillText('PLACAR', meio, -(lousa.base + 18));
        const l = lider.current;
        ctx.fillStyle = l ? PLAYER_BY_ID[l.id].color : '#a8d8b9';
        ctx.fillText(l ? PLAYER_BY_ID[l.id].name.toUpperCase() : 'NINGUÉM', meio, -(lousa.base + 11));
        ctx.fillStyle = '#a8d8b9';
        ctx.fillText(l ? `${l.total} pts` : 'joga aí', meio, -(lousa.base + 5));
      }
      // Portal na parede do beco: um túnel de anéis que vêm do fundo e giram (profundidade de verdade, sem 3D).
      const portal = naArea('portal');
      if (portal) {
        tr();
        const pcx = (portal.u0 + portal.u1) / 2;
        const pcy = -(portal.base + 29);
        const rx = (portal.u1 - portal.u0) * 0.4;
        const ry = 24;
        const cores = ['#b55088', '#2ce8f5', '#8b5cf6', '#ff4fb0'];
        for (let k = 7; k >= 0; k--) {
          const f = (agora / 1100 + k / 8) % 1; // 0 = fundo, 1 = boca
          const esc = 0.12 + f * 0.8;
          const gira = agora / 700 + k * 0.7;
          ctx.globalAlpha = 0.25 + f * 0.6;
          ctx.strokeStyle = cores[k % cores.length];
          ctx.lineWidth = 0.6 + f * 1.8;
          ctx.beginPath();
          ctx.ellipse(pcx + Math.cos(gira) * (1 - f) * 3, pcy + Math.sin(gira) * (1 - f) * 2, rx * esc, ry * esc, gira * 0.2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(agora / 200);
        ctx.fillStyle = '#f4e9ff';
        ctx.beginPath();
        ctx.ellipse(pcx, pcy, 2.5, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const placaQuiz = naArea('quiz');
      if (placaQuiz) {
        tr();
        ctx.textAlign = 'center';
        ctx.font = '5px VT323, monospace';
        ctx.fillStyle = '#ffd0ea';
        ctx.fillText('10 PERGUNTAS/DIA', (placaQuiz.u0 + placaQuiz.u1) / 2, -(placaQuiz.base + 8));
      }
      // Grafite do muro do beco.
      const graf = naArea('grafite');
      if (graf) {
        tr();
        ctx.textAlign = 'center';
        ctx.font = '7px VT323, monospace';
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#181425';
        // O muro encolheu (o portal ficou com o começo dele): o grafite vai em quatro linhas curtas.
        const meio = (graf.u0 + graf.u1) / 2;
        for (const [txt, u, v, cor] of [
          ['FIADO É', meio, graf.base + 44, '#feae34'],
          ['ROUBO', meio, graf.base + 37, '#feae34'],
          ['O ZÉ É SÓCIO', meio, graf.base + 24, '#2ce8f5'],
          ['DO SAMU', meio, graf.base + 17, '#2ce8f5'],
        ] as const) {
          ctx.strokeText(txt, u, -v);
          ctx.fillStyle = cor;
          ctx.fillText(txt, u, -v);
        }
      }
      // Paredão dos procurados: título, retrato do boneco de cada amigo, nome e mortes (o mais perigoso leva carimbo).
      const proc = naArea('procurados');
      if (proc) {
        const fichas = sanitizeFicha(barPresence.fichaRaw());
        fichas[player] = Math.max(fichas[player], fichaLocal.current);
        const top = maisPerigoso(fichas);
        const larg = (proc.u1 - proc.u0) / ORDEM_FICHA.length;
        const topo = -(proc.base + proc.altura);
        ORDEM_FICHA.forEach((p, k) => {
          const cu = proc.u0 + larg * k + larg / 2;
          tr();
          ctx.textAlign = 'center';
          ctx.font = '6px VT323, monospace';
          ctx.fillStyle = '#6b1a1a';
          ctx.fillText('PROCURADO', cu, topo + 8);
          const lk = p === player ? codigo(visualRef.current) : (elo.estado(p as AmigoId)?.lk ?? '');
          const L = p === player ? lookDe(player, visualRef.current) : lk ? lookDe(p, deCodigo(lk)) : PLAYER_BY_ID[p].look;
          const sp = boneco(`proc:${p}:${lk}`, L, 'front', false, 0, false);
          ctx.drawImage(toCanvas(sp.raster), 4, 0, 16, 16, cu - 8, topo + 11, 16, 16);
          ctx.font = '5px VT323, monospace';
          ctx.fillStyle = '#3a2a1c';
          ctx.fillText(PLAYER_BY_ID[p].name.toUpperCase(), cu, topo + 33);
          ctx.fillStyle = '#a22633';
          ctx.fillText(`☠ ${fichas[p]} ${fichas[p] === 1 ? 'MORTE' : 'MORTES'}`, cu, topo + 39);
          if (p === top) {
            ctx.translate(cu, topo + 20);
            ctx.rotate(-0.35);
            ctx.font = '6px VT323, monospace';
            ctx.fillStyle = 'rgba(228,59,68,0.85)';
            ctx.fillText('ARMADO E BÊBADO', 0, 0);
          }
        });
      }
      if (z === 'banheiro') {
        tr();
        ctx.textAlign = 'center';
        ctx.font = '5px VT323, monospace';
        for (const p of PICHACOES) {
          ctx.fillStyle = p.cor;
          ctx.fillText(p.t, p.u, -p.v);
        }
      }
      // Parede da esquerda: preços, fiado e portas (texto da esquerda para a direita de quem olha).
      for (const e of PAREDE) {
        if (e.side !== 'L' || e.zona !== z) continue;
        const W = (e.to - e.from + 1) * (TW / 2);
        const u = (e.from - a.y0) * (TW / 2) + W;
        ctx.setTransform(S, -S * 0.5, 0, S, (o.x - u - cx) * S, (o.y + u / 2 - cy) * S);
        ctx.textAlign = 'center';
        if (e.kind === 'precos') {
          ctx.font = '5px VT323, monospace';
          ctx.fillStyle = '#e4e4e4';
          ['CERVEJA ..... 12', 'PINGA ........ 5', 'PORÇÃO ...... 30', 'BRIGA .... GRÁTIS'].forEach((l, i) => ctx.fillText(l, W / 2, -(e.h + 18 - i * 4.5)));
        } else if (e.kind === 'fiado') {
          ctx.font = '5px VT323, monospace';
          ctx.fillStyle = '#a22633';
          ctx.fillText('FIADO SÓ', W / 2, -(e.h + 7.5));
          ctx.fillText('AMANHÃ', W / 2, -(e.h + 3));
        } else if (e.kind === 'banheiro') {
          ctx.font = '5px VT323, monospace';
          ctx.fillStyle = '#181425';
          ctx.fillText('INTERDITADO', W / 2, -(e.h + 21.5));
          ctx.fillStyle = '#f4e9c8';
          ctx.fillText('BANHEIRO', W / 2, -(e.h + 9)); // embaixo da faixa (no alto, colava no preço da parede ao lado)
        } else if (e.kind === 'porta') {
          ctx.font = '5px VT323, monospace';
          ctx.fillStyle = '#63c74d';
          ctx.fillText('SAÍDA', W / 2, -(e.h + 28));
        } else if (e.kind === 'espelho') {
          ctx.font = '4px VT323, monospace';
          ctx.fillStyle = '#5a6988';
          ctx.fillText('você tá horrível', W / 2, -(e.h + 9));
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.textAlign = 'center';

      // Letreiros de neon das atividades: sempre acesos e bem mais fortes de perto (brilho em camadas, sem blur).
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.font = `${Math.max(12, Math.round(S * 5.5))}px VT323, monospace`;
      for (const l of LETREIROS) {
        if (zonaDe(l.at[0], l.at[1]) !== z) continue;
        const d = Math.hypot(l.at[0] - me.x, l.at[1] - me.y);
        const perto = Math.max(0, Math.min(1, 1 - (d - 1.2) / 4));
        const pisca = Math.sin(agora / 90 + l.at[0] * 3) > -0.97 ? 1 : 0.4;
        const q = telaDe(l.at[0], l.at[1], z);
        const sx = (q.x - cx) * S;
        const sy = (q.y - cy - l.h) * S;
        ctx.globalAlpha = (0.55 + 0.45 * perto) * pisca;
        ctx.strokeStyle = l.cor;
        for (const [w, a] of [
          [10 * (0.4 + perto), 0.12],
          [6 * (0.4 + perto), 0.22],
          [3, 0.5],
        ] as const) {
          ctx.globalAlpha = a * (0.55 + 0.45 * perto) * pisca;
          ctx.lineWidth = w;
          ctx.strokeText(l.texto, sx, sy);
        }
        ctx.globalAlpha = (0.7 + 0.3 * perto) * pisca;
        ctx.fillStyle = perto > 0.5 ? '#ffffff' : l.cor;
        ctx.fillText(l.texto, sx, sy);
      }
      ctx.globalAlpha = 1;

      // Nomes dos NPCs perto de você e dos amigos desmaiados.
      ctx.font = `${Math.max(11, Math.round(S * 4.5))}px VT323, monospace`;
      for (const c of m.corpos) {
        if (c.quem === 'eu' || c.ausente || zonaDe(c.x, c.y) !== z) continue;
        const d = Math.hypot(c.x - me.x, c.y - me.y);
        if (c.quem === 'remoto') {
          // Amigo online: nome na cor dele e a vida, de qualquer distância.
          const q = telaDe(c.x, c.y, z);
          const deit = poseDe(c, t) === 'ko';
          const sx = (q.x - cx) * S;
          const sy = (q.y - cy - (deit ? 16 : 46)) * S;
          const nome = PLAYER_BY_ID[c.nome as PlayerId].name;
          ctx.fillStyle = PLAYER_BY_ID[c.nome as PlayerId].color;
          ctx.strokeStyle = '#0b0a10';
          ctx.lineWidth = 3;
          ctx.strokeText(nome, sx, sy);
          ctx.fillText(nome, sx, sy);
          // Fatia 16: o título vem no código do visual e só aparece se o troféu que o dá estiver no banco.
          const tit = tituloDe(deCodigo(elo.estado(c.nome as AmigoId)?.lk).titulo, c.nome, barPresence.trofeusRaw());
          if (tit) {
            const fonte = ctx.font;
            const tam = Math.max(10, Math.round(S * 3.6));
            ctx.font = `${tam}px VT323, monospace`;
            ctx.fillStyle = '#f4e9c8';
            ctx.strokeText(tit, sx, sy - tam);
            ctx.fillText(tit, sx, sy - tam);
            ctx.font = fonte;
          }
          const bw = 12 * S;
          const bh = Math.max(2, Math.round(S));
          ctx.fillStyle = '#0b0a10';
          ctx.fillRect(sx - bw / 2 - 1, sy + 3, bw + 2, bh + 2);
          ctx.fillStyle = c.vida > 50 ? '#63c74d' : c.vida > 25 ? '#feae34' : '#e43b44';
          ctx.fillRect(sx - bw / 2, sy + 4, (bw * Math.max(0, c.vida)) / 100, bh);
          continue;
        }
        if (d > 2.2) continue;
        const q = telaDe(c.x, c.y, z);
        const nome = c.quem === 'amigo' ? `${PLAYER_BY_ID[c.nome as PlayerId].name} (${CANTOS[c.nome as AmigoId].onde})` : c.nome;
        const deit = poseDe(c, t) === 'ko';
        ctx.fillStyle = c.quem === 'amigo' ? PLAYER_BY_ID[c.nome as PlayerId].color : '#f4e9c8';
        ctx.strokeStyle = '#0b0a10';
        ctx.lineWidth = 3;
        const sx = (q.x - cx) * S;
        const sy = (q.y - cy - (deit ? 16 : 46)) * S;
        ctx.strokeText(nome, sx, sy);
        ctx.fillText(nome, sx, sy);
        // Fatia 20: o apelido que ele ganhou por sua causa, entre aspas, acima do nome.
        const est = c.quem === 'npc' ? estadoNpc(memoria.current, c.id, Date.now()) : null;
        if (est?.apelido) {
          const fonte = ctx.font;
          const tam = Math.max(10, Math.round(S * 3.6));
          ctx.font = `${tam}px VT323, monospace`;
          ctx.fillStyle = '#feae34';
          ctx.strokeText(`"${est.apelido}"`, sx, sy - tam);
          ctx.fillText(`"${est.apelido}"`, sx, sy - tam);
          ctx.font = fonte;
        }
      }

      // Balões do chat (Fatia 6): a última fala de cada amigo (e a sua), por 6 s, em cima da cabeça.
      const falas = balloons(barPresence.chat, barPresence.now());
      ctx.font = `${Math.max(12, Math.round(S * 4.6))}px VT323, monospace`;
      for (const [p, msg] of Object.entries(falas)) {
        if (!msg) continue;
        const c = p === player ? me : m.corpos.find((b) => b.quem === 'remoto' && b.nome === p);
        if (!c || c.ausente || zonaDe(c.x, c.y) !== z) continue;
        const q = telaDe(c.x, c.y, z);
        const linhas = quebrarFala(msg.m);
        const lh = Math.max(12, Math.round(S * 4.6));
        const w = Math.max(...linhas.map((l) => ctx.measureText(l).width)) + 12;
        const h = linhas.length * lh + 8;
        const bx = (q.x - cx) * S - w / 2;
        const by = (q.y - cy - 58) * S - h;
        ctx.fillStyle = '#f4f4f4';
        ctx.strokeStyle = '#181425';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(bx, by, w, h);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + w / 2 - 5, by + h);
        ctx.lineTo(bx + w / 2, by + h + 7);
        ctx.lineTo(bx + w / 2 + 5, by + h);
        ctx.fill();
        ctx.fillStyle = '#181425';
        linhas.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + 4 + lh * (i + 0.8)));
      }

      // Frases do narrador.
      const fs = Math.max(14, Math.round(S * 6));
      ctx.font = `${fs}px VT323, monospace`;
      for (let i = textos.length - 1; i >= 0; i--) {
        const tx0 = textos[i];
        const k = (t - tx0.t0) / 1500; // relógio do jogo: no hit-stop e na aba parada a frase espera
        if (k >= 1) {
          textos.splice(i, 1);
          continue;
        }
        if (tx0.area !== z) continue;
        ctx.globalAlpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
        const sx = (tx0.x - cx) * S;
        const sy = (tx0.y - cy - k * 20) * S;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#0b0a10';
        ctx.strokeText(tx0.texto, sx, sy);
        ctx.fillStyle = tx0.cor;
        ctx.fillText(tx0.texto, sx, sy);
        ctx.globalAlpha = 1;
      }
      // Onomatopeias dos itens e o grito da rajada (saltam e somem rápido).
      for (let i = onos.length - 1; i >= 0; i--) {
        const o = onos[i];
        const dur = o.grande ? 1400 : 650;
        const k = (t - o.t0) / dur;
        if (k >= 1) {
          onos.splice(i, 1);
          continue;
        }
        if (o.area !== z || k < 0) continue;
        const pop = o.grande ? 2.4 : 1.5;
        const tam = Math.round(fs * pop * (1.25 - 0.25 * Math.min(1, k * 5)));
        ctx.font = `${tam}px VT323, monospace`;
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        const sx = (o.x - cx) * S;
        const sy = (o.y - cy - k * 10) * S;
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#181425';
        ctx.strokeText(o.texto, sx, sy);
        ctx.fillStyle = o.cor;
        ctx.fillText(o.texto, sx, sy);
        ctx.globalAlpha = 1;
      }
      // Fatia 8: o clarão garantido de 1 quadro já foi desenhado.
      for (const [id, n] of flashQ) if (n <= 1) flashQ.delete(id);
        else flashQ.set(id, n - 1);
      for (const [id, im] of impactos) if (t - im.t0 > 400) impactos.delete(id);
    };

    /** Pedaço parado vira parte do chão (desenhado uma vez na camada de manchas, sem custo depois). */
    const carimbar = (pd: Pedaco) => {
      const ar = areas[pd.area];
      const r = pd.sp.raster;
      const cos = Math.cos(pd.ang);
      const sin = Math.sin(pd.ang);
      for (let y = 0; y < r.h; y++)
        for (let x = 0; x < r.w; x++) {
          const o = (y * r.w + x) * 4;
          if (r.data[o + 3] < 128) continue;
          const lx = x - pd.sp.ax;
          const ly = y - pd.sp.ay;
          ar.manchas.set(Math.round(pd.x + lx * cos - ly * sin), Math.round(pd.y + lx * sin + ly * cos), [r.data[o], r.data[o + 1], r.data[o + 2], 255]);
        }
      ar.tudo = ar.suja = true;
    };

    const gravidade = (dt: number, agora: number) => {
      // Fatia 8: marcas que já caíram (rachadura, queimado) entram no chão de manchas uma vez.
      for (let i = marcas.length - 1; i >= 0; i--) {
        const mk = marcas[i];
        if (m.t < mk.quando) continue;
        marcas.splice(i, 1);
        const semente = (mk.x * 73856093) ^ (mk.y * 19349663) ^ mk.r;
        if (mk.tipo === 'queimado') gravarMarca(mk.area, mk.x, mk.y, queimado(mk.r, semente), QUEIMADO);
        else gravarMarca(mk.area, mk.x, mk.y, rachadura(mk.r, semente), RACHA);
      }
      // Pegadas: quem pisa numa poça leva a cor dela por 8 passos, cada vez mais fraca.
      if (agora - pegadaEm > 90 && (pocas.length || pegadas.size)) {
        pegadaEm = agora;
        for (let i = pocas.length - 1; i >= 0; i--) {
          const pc = pocas[i];
          const md = areas[pc.area].manchas;
          if (pc.x < 0 || pc.y < 0 || pc.x >= md.w || pc.y >= md.h || !md.data[(pc.y * md.w + pc.x) * 4 + 3]) pocas.splice(i, 1); // limpou
        }
        for (const c of m.corpos) {
          if (c.ausente || c.estado !== 'normal') continue;
          const zc = zonaDe(c.x, c.y);
          const pc = telaDe(c.x, c.y, zc);
          const pisou = pocas.find((po) => po.area === zc && naPoca(pc.x, pc.y, po));
          if (pisou) {
            pegadas.set(c.id, { k: 0, cor: pisou.cor, x: pc.x, y: pc.y, lado: 0 });
            continue;
          }
          const pg = pegadas.get(c.id);
          if (!pg || Math.hypot(pc.x - pg.x, pc.y - pg.y) < 5) continue;
          const a = alfaPegada(pg.k);
          if (a > 0) {
            const ox = pg.lado ? 1 : -2;
            pingar(zc, pc.x + ox, pc.y, pg.cor, 1, a);
            pingar(zc, pc.x + ox + 1, pc.y, pg.cor, 1, a);
          }
          pg.k++;
          pg.lado ^= 1;
          pg.x = pc.x;
          pg.y = pc.y;
          if (pg.k >= PASSOS_PEGADA) pegadas.delete(c.id);
        }
      }
      // Gotas: gravidade, e ao tocar o chão viram mancha.
      for (let i = gotas.length - 1; i >= 0; i--) {
        const g = gotas[i];
        g.vz -= 320 * dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.z += g.vz * dt;
        if (g.z <= 0) {
          if (g.mancha) pingar(g.area, g.x, g.y, g.cor, g.tam + (Math.random() < 0.3 ? 1 : 0));
          gotas.splice(i, 1);
        }
      }
      // Pedaços: giram, quicam (e = 0,3), escorregam e, parados, viram decalque no chão.
      for (let i = pedacos.length - 1; i >= 0; i--) {
        const pd = pedacos[i];
        pd.vz -= 320 * dt;
        pd.x += pd.vx * dt;
        pd.y += pd.vy * dt;
        pd.z += pd.vz * dt;
        pd.ang += pd.va * dt;
        if (pd.z <= 0) {
          pd.z = 0;
          if (Math.abs(pd.vz) > 25) {
            pd.vz = -pd.vz * 0.3;
            poca(pd.area, pd.x, pd.y, 4);
          } else pd.vz = 0;
          pd.vx *= Math.exp(-6 * dt);
          pd.vy *= Math.exp(-6 * dt);
          pd.va *= Math.exp(-5 * dt);
        }
        if (agora - pd.rastro > 25 && Math.hypot(pd.vx, pd.vy) > 4) {
          pd.rastro = agora;
          pingar(pd.area, pd.x + (Math.random() - 0.5) * 2, pd.y, sangue()[pd.z > 0 ? 1 : 0], 2, 220);
        }
        if (pd.z === 0 && pd.vz === 0 && Math.hypot(pd.vx, pd.vy) < 3) {
          carimbar(pd);
          pedacos.splice(i, 1);
        }
      }
      // A Dona Maria passa o pano: apaga sangue e pedaço do chão em volta dela enquanto faz a faxina.
      const maria = achar(m, 'maria');
      if (maria && !maria.ausente && maria.estado === 'normal' && maria.humor === 'calmo' && Math.hypot(maria.x - MARIA_DESCANSO[0], maria.y - MARIA_DESCANSO[1]) > 0.8) {
        const zm = zonaDe(maria.x, maria.y);
        const ar = areas[zm];
        const q = telaDe(maria.x, maria.y, zm);
        // Fatia 6: o pano pega 1,4 ladrilho em volta dela (era 0,6).
        const rx = TW * 1.4;
        const ry = TH * 1.4;
        const md = ar.manchas;
        let tirou = false;
        for (let yy = Math.floor(q.y - ry); yy <= Math.ceil(q.y + ry); yy++)
          for (let xx = Math.floor(q.x - rx); xx <= Math.ceil(q.x + rx); xx++) {
            if (xx < 0 || yy < 0 || xx >= md.w || yy >= md.h) continue;
            if (((xx - q.x) / rx) ** 2 + ((yy - q.y) / ry) ** 2 > 1) continue;
            const o = (yy * md.w + xx) * 4;
            if (md.data[o + 3]) {
              md.data[o + 3] = 0;
              tirou = true;
            }
          }
        if (tirou) ar.tudo = ar.suja = true;
      }
      // Quem perdeu parte e segue de pé pinga dos tocos por onde anda (rastro de sangue).
      if (goreRef.current)
        for (const c of m.corpos) {
          if (c.quem !== 'npc' || !c.cortes || c.estado !== 'normal' || c.ausente) continue;
          if (agora < (pingaEm.get(c.id) ?? 0)) continue;
          pingaEm.set(c.id, agora + 180 + Math.random() * 160);
          const tocosDe = [
            [1, -6, 15], [2, 6, 15], [4, -3, 7], [8, 3, 7], [16, 0, 20],
          ].filter(([b]) => c.cortes & b);
          const [, ox, oz] = tocosDe[Math.floor(Math.random() * tocosDe.length)];
          const zc = zonaDe(c.x, c.y);
          const pc = telaDe(c.x, c.y, zc);
          const fl = facing(c.fx, c.fy).flip ? -1 : 1;
          if (gotas.length < limiteGotas())
            gotas.push({ area: zc, x: pc.x + ox * fl, y: pc.y, z: oz, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 4, vz: 0, cor: sangue()[Math.random() < 0.5 ? 0 : 1], tam: 1, mancha: true, nasce: m.t });
        }
      // Jorro em arco do toco.
      for (let i = jorros.length - 1; i >= 0; i--) {
        const j = jorros[i];
        if (m.t >= j.ate) {
          jorros.splice(i, 1);
          continue;
        }
        if (agora >= j.prox) {
          j.prox = agora + 70;
          const forca = 0.6 + ((j.ate - m.t) / JORRO_MS) * 0.9; // perde pressão
          for (let k = 0; k < 3 && gotas.length < limiteGotas(); k++)
            gotas.push({
              area: j.area, x: j.x, y: j.y, z: j.z, vx: j.dx * (20 + Math.random() * 30) * forca, vy: (Math.random() - 0.5) * 12,
              vz: (60 + Math.random() * 40) * forca, cor: sangue()[k % 2], tam: 1 + (Math.random() < 0.3 ? 1 : 0), mancha: true, nasce: m.t,
            });
        }
      }
      // Rastro de sangue de quem é arrastado.
      if (goreRef.current && agora - rastroEm > 110) {
        rastroEm = agora;
        for (const c of m.corpos) {
          if (c.estado !== 'segurado' || c.quem === 'amigo') continue;
          if (c.vida > c.vidaMax * 0.5) continue;
          const zc = zonaDe(c.x, c.y);
          const q = telaDe(c.x, c.y, zc);
          pingar(zc, q.x + (Math.random() - 0.5) * 4, q.y + Math.random() * 2, sangue()[1], 2, 170);
        }
      }
    };

    /** Fatia 10: troféu na prateleira (uma vez por jogador; o banco recusa o segundo). */
    const trofeu = (k: string) => {
      const tr = barPresence.trofeusRaw() as Record<string, Record<string, unknown> | undefined>;
      if (tr?.[k]?.[player] || !barPresence.online) return;
      void barPresence.ganharTrofeu(k);
    };
    const apagado = () => ev.ag?.tipo === 'apagao' && ev.fase === 'andamento' && ev.fim?.como !== 'religado';
    const pertoDisjuntor = () => {
      const me = eu(m);
      return me.estado === 'normal' && Math.hypot(me.x - DISJUNTOR[0], me.y - DISJUNTOR[1]) < 1.1;
    };
    const religar = (): boolean => {
      if (!ev.ag || !apagado() || ev.fechou) return false;
      ev.fechou = true;
      ev.fim = { como: 'religado', p: player, at: m.t };
      if (barPresence.online) void barPresence.fecharEvento(ev.ag.epoca, 'religado');
      tocar('pega');
      return true;
    };
    /** Fatia 11: quem o disco levou volta no fim da invasão (ou se o evento acabar antes). */
    const soltarLevados = () => {
      for (const id of ev.levados) {
        const c = achar(m, id);
        if (c) c.ausente = false;
      }
      ev.levados.clear();
    };
    /** Fatia 10: um passo do diretor de eventos (a cada quadro e a cada passo do gancho de teste). */
    const diretor = (agora: number) => {
      // Fatia 20: quem já apanhou de você te reconhece quando você chega perto (no máximo a cada 90 s por NPC).
      {
        const tm = Date.now();
        const me0 = eu(m);
        for (const c of m.corpos) {
          if (c.quem !== 'npc' || c.ausente) continue;
          const est = estadoNpc(memoria.current, c.id, tm);
          if (!deveReconhecer(est, Math.hypot(c.x - me0.x, c.y - me0.y), c.estado === 'normal' && me0.estado === 'normal', reconheceu.current.get(c.id) ?? -1e15, tm)) continue;
          reconheceu.current.set(c.id, tm);
          const f = falaReconhece(est, narrRng.current);
          if (f) m.eventos.push({ k: 'frase', x: c.x, y: c.y, texto: `${c.nome}: — ${f}`, cor: '#f4e9c8', em: c.id });
        }
      }
      const t = m.t;
      const e = epocaDe(t);
      const cfg = cfgLocal ?? sanitizeConfig(barPresence.configEventosRaw());
      const cfgTxt = JSON.stringify(cfg);
      if (agCache.e !== e || agCache.cfg !== cfgTxt) agCache = { e, ag: agenda(e, cfg), cfg: cfgTxt };
      const ag = agCache.ag;
      if (ev.ag?.epoca !== ag?.epoca || ev.ag?.tipo !== ag?.tipo) {
        soltarLevados();
        ev = evNovo();
        ev.ag = ag;
      }
      // Limpeza: evento com mais de 1 h sai do banco (o banco só deixa apagar depois disso).
      if (!limpouVelhos && barPresence.online && barPresence.status === 'live') {
        limpouVelhos = true;
        for (const k of barPresence.epocasGuardadas().filter((k) => k < e - 6).slice(0, 8)) void barPresence.apagarEvento(k);
      }
      m.extras = [];
      const fase = ag ? faseEvento(ag, t) : 'fora';
      ev.fase = fase;
      if (!ag || fase === 'fora') {
        soltarLevados();
        if (ag && ev.rato && !ev.rato.fora && !ev.premiado && ev.avisou !== 'fim') {
          ev.avisou = 'fim';
          avisar('A ratazana sumiu de volta no cano.');
        }
        // Fatia 17: o dragão vai embora se ninguém o derrubou (o dinossauro avisa quando sai pela calçada).
        if (ag && ev.dragao && !ev.premiado && ev.avisou !== 'fim') {
          ev.avisou = 'fim';
          avisar('O dragão bocejou, sacudiu as telhas e foi embora voando.');
        }
        ev.rato = null;
        ev.dragao = null;
        ev.sopro = null;
        ev.pocas = [];
        ev.dino = null;
        return;
      }
      const def = EVENTOS[ag.tipo];
      const raw = (barPresence.eventoRaw(ag.epoca) ?? {}) as Record<string, unknown>;
      const ab = raw.abertura && typeof raw.abertura === 'object' ? (raw.abertura as Record<string, unknown>) : null;
      const nBanco = ab && typeof ab.n === 'number' ? Math.max(1, Math.min(5, Math.floor(ab.n))) : 0;
      const fimRaw = raw.fim && typeof raw.fim === 'object' ? (raw.fim as Record<string, unknown>) : null;
      if (fimRaw && typeof fimRaw.como === 'string' && (!ev.fim || ev.fim.p === player))
        ev.fim = { como: fimRaw.como, p: typeof fimRaw.p === 'string' ? fimRaw.p : '', at: typeof fimRaw.at === 'number' ? fimRaw.at : t };
      if (fase === 'aviso') {
        if (ev.avisou !== 'aviso') {
          ev.avisou = 'aviso';
          avisar(
            ag.tipo === 'ratazana'
              ? 'Glub, glub… tem um barulho estranho no cano do banheiro.'
              : ag.tipo === 'alien'
                ? 'O rádio do bar tá chiando… uma luz verde fraca passa pelo teto.'
                : ag.tipo === 'dragao'
                  ? 'Tem alguma coisa enorme andando no telhado… cai poeira do forro e cheira a carvão.'
                  : ag.tipo === 'dino'
                    ? 'Lá fora, uma corneta de circo desafinada… e passos que fazem tremer os copos.'
                    : 'A luz do bar tá piscando… o Seu Zé olha pro disjuntor.',
          );
          narrar(narrador.current, 'evento', Date.now(), narrRng.current);
        }
        return;
      }
      // Abertura: quem vê o início primeiro grava quantos estavam no bar; todo mundo usa o mesmo número.
      if (!ev.abriu) {
        ev.abriu = true;
        ev.n = Math.max(1, m.corpos.filter((c) => (c.quem === 'eu' || c.quem === 'remoto') && !c.ausente).length);
        if (!nBanco && barPresence.online) void barPresence.abrirEvento(ag.epoca, ev.n);
        avisar(
          ag.tipo === 'ratazana'
            ? `${def.nome}! Ela rouba comida do balcão; o desentupidor bate em dobro.`
            : ag.tipo === 'alien'
              ? 'Um pires pousou na rua. Um visitante de capacete-aquário sentou no balcão e pediu uma gelada. Deixa ele em paz… ou não.'
              : ag.tipo === 'dragao'
                ? 'Dragão no telhado! A cabeça desce por um furo do forro: bate nela. Linha vermelha no chão = fogo em 1 s. Molotov de cachaça (na mão ou jogada) deixa ele sonolento.'
                : ag.tipo === 'dino'
                  ? 'Um dinossauro fugiu do circo! Ele raspa as patas e investe em linha reta; na parede fica tonto. Abrir a geladeira perto dele dá um susto.'
                  : 'Apagão! Alguém chega no disjuntor (fundo do bar, perto da geladeira) e aperta E.',
        );
      }
      if (nBanco) ev.n = nBanco;
      if (ag.tipo === 'alien') {
        const vidas = vidasInvasao(ev.n);
        const danoRaw = (raw.dano && typeof raw.dano === 'object' ? raw.dano : {}) as Record<string, unknown>;
        // Livro de cada bicho com o meu total local por cima (o banco pode estar meio segundo atrás).
        const livro = (ent: string): Record<string, unknown> => {
          const l = { ...((danoRaw[ent] && typeof danoRaw[ent] === 'object' ? danoRaw[ent] : {}) as Record<string, unknown>) };
          l[player] = Math.max(typeof l[player] === 'number' ? (l[player] as number) : 0, ev.danoPor[ent] ?? 0);
          return l;
        };
        // Dano: no máximo 2 gravações por segundo, só do que mudou.
        if (agora - ev.enviadoEm > 500 && barPresence.online) {
          for (const [ent, v] of Object.entries(ev.danoPor))
            if (v > (ev.enviadoPor[ent] ?? 0)) {
              ev.enviadoPor[ent] = v;
              ev.enviadoEm = agora;
              void barPresence.somarDano(ag.epoca, ent, v);
            }
        }
        const morte = ev.fim?.como === 'morto' ? ev.fim.at : null;
        if (morte === null) {
          // Visita: o visitante no balcão (alvo de golpe) até 60 s.
          ev.H = vidas.alien;
          ev.restante = Math.max(0, vidas.alien - somaLivro(livro('alien')));
          if (t - ag.inicio < VISITA_MS) {
            m.extras = [{ id: 'alien', x: ASSENTO_ALIEN[0], y: ASSENTO_ALIEN[1], raio: 0.45 }];
            if (ev.restante <= 0 && !ev.fechou) {
              ev.fechou = true;
              ev.fim = { como: 'morto', p: player, at: t };
              if (barPresence.online) {
                void barPresence.somarDano(ag.epoca, 'alien', (ev.enviadoPor.alien = ev.danoPor.alien ?? 0));
                void barPresence.fecharEvento(ag.epoca, 'morto');
              }
              const q = telaDe(ASSENTO_ALIEN[0], ASSENTO_ALIEN[1], 'bar');
              espirrar('bar', q.x, q.y, 18, 0, -1, 30, ['#63c74d', '#2ce8f5', '#f4f4f4'], 1.4, false, 2);
              avisar('O visitante virou fumaça verde. Cai um comunicador chiando… a sirene toca. Vem aí!');
            }
          } else if (t - ag.inicio > VISITA_MS + 1500 && !ev.premiado) {
            // Final pacífico: ninguém derrubou o visitante; gorjeta cósmica para quem está no bar.
            ev.premiado = true;
            ev.acabou = true;
            if (zonaDe(eu(m).x, eu(m).y) === 'bar') {
              const v = pagarEvento('alien-paz', PREMIO_PACIFICO);
              trofeu(TROFEU_FINAL.pacifico);
              avisar(`O visitante pagou a gelada, deixou uma gorjeta cósmica${v ? ` (+R$ ${v})` : ''} e subiu no pires.`);
            } else avisar('O visitante foi embora em paz.');
          }
          return;
        }
        // Invasão: conta a partir da morte (carimbo do servidor).
        const tRel = t - morte;
        if (ev.acabou || tRel >= INVASAO_MS + 3000) {
          soltarLevados();
          ev.acabou = true;
          return;
        }
        if (ev.avisou !== 'alerta') {
          ev.avisou = 'alerta';
          avisar('📻 "Atenção, população do bar: fiquem calmos." Discos no céu! Bata no disco (ou na base do feixe) antes que levem alguém.');
        }
        // Quem é do happy hour volta sozinho pela porta; o disco só mira os fixos do bar.
        const npcs = m.corpos.filter((c) => c.quem === 'npc' && !c.ausente && c.npc?.turno !== 'happy' && zonaDe(c.x, c.y) === 'bar').map((c) => c.id);
        if (!ev.alvos.length) ev.alvos = alvosDiscos(ag.semente, npcs.length ? npcs : ['ze']);
        ev.levantando.clear();
        let levados = 0;
        for (let k = 0; k < N_DISCOS; k++) {
          const ent = `disco${k}`;
          const f = faseDisco(k, Math.min(tRel, INVASAO_MS), livro(ent), vidas.disco);
          const alvo = achar(m, ev.alvos[k]);
          if (f === 'levou') {
            levados++;
            if (alvo && !ev.levados.has(alvo.id)) {
              ev.levados.add(alvo.id);
              // Quem estava segurando o levado fica de mãos vazias (não segura um corpo que sumiu).
              const h = achar(m, alvo.seguradoPor);
              if (h) h.segurando = null;
              alvo.seguradoPor = null;
              alvo.estado = 'normal';
              alvo.ausente = true;
              avisar(`Levaram ${alvo.npc?.nome ?? 'alguém'}!`);
            }
          }
          if (f === 'derrubado' && !ev.derrubados.has(ent)) {
            ev.derrubados.add(ent);
            if (alvo) {
              const q = telaDe(alvo.x, alvo.y, 'bar');
              espirrar('bar', q.x, q.y - 40, 4, 0, 1, 16, ['#8b9bb4', '#fee761', '#3a4466'], 1.2, false, 2);
            }
          }
          if (f === 'feixe' && alvo && !alvo.ausente) {
            ev.levantando.set(alvo.id, subidaFeixe(k, tRel));
            m.extras.push({ id: ent, x: alvo.x, y: alvo.y, raio: 0.5, protege: alvo.id });
          }
        }
        // O disco grande: aparece a 30%, varre linhas e foge no fim se continuar inteiro.
        const grandeFalta = Math.max(0, vidas.grande - somaLivro(livro('grande')));
        if (tRel >= GRANDE_EM && grandeFalta > 0) {
          const g = posGrande(tRel);
          m.extras.push({ id: 'grande', x: g.x, y: g.y, raio: 0.9 });
          const l = varredura(ag.semente, tRel);
          const me = eu(m);
          const idv = Math.floor((tRel - GRANDE_EM) / VARRE_MS);
          if (l && l.fase === 'ativo' && ev.queimouEm !== idv && naLinha(l, me.x, me.y) && zonaDe(me.x, me.y) === 'bar') {
            ev.queimouEm = idv;
            ferirPorEvento(m, me, DANO_RAIO, l.eixo === 'x' ? 0 : 1, l.eixo === 'x' ? 1 : 0);
          }
        }
        const fim = tRel >= INVASAO_MS || grandeFalta <= 0;
        if (fim && !ev.premiado) {
          ev.premiado = true;
          const d = desfecho(levados, cotaLevados(ev.n), grandeFalta <= 0);
          // Participou = tem dano seu no livro de algum bicho (o do banco conta: recarregar a página não tira o prêmio).
          const meu = (ent: string) => Number(livro(ent)[player]) || 0;
          const participou = ['alien', 'grande', ...Array.from({ length: N_DISCOS }, (_, k) => `disco${k}`)].some((ent) => meu(ent) > 0);
          const v = participou ? pagarEvento(`alien-${d}`, premioInvasao(d, ev.n)) : 0;
          if (TROFEU_FINAL[d] && participou) trofeu(TROFEU_FINAL[d]);
          const frase = d === 'vitoria' ? 'Derrubaram o disco grande! O Seu Zé: "e quem paga a telha?"' : d === 'derrota' ? `Sumiu o Zé (e mais ${Math.max(0, levados - 1)}). O disco grande foi embora rindo.` : 'Meio a meio: o bar sobreviveu, mais ou menos.';
          avisar(`${frase}${v ? ` +R$ ${v}` : ''}`);
          ev.acabou = true;
        }
        return;
      }
      // Fatia 17: dragão e dinossauro (um bicho, um livro de dano, fim "morto", como a ratazana).
      if (ag.tipo === 'dragao' || ag.tipo === 'dino') {
        const ent = ag.tipo;
        const dt = t - ag.inicio;
        ev.H = vidaEscalada(ent === 'dragao' ? DRAGAO_VIDA : DINO_VIDA, ev.n);
        const danoRaw = raw.dano && typeof raw.dano === 'object' ? ((raw.dano as Record<string, unknown>)[ent] as Record<string, unknown> | undefined) : undefined;
        const livro: Record<string, unknown> = { ...(danoRaw && typeof danoRaw === 'object' ? danoRaw : {}) };
        livro[player] = Math.max(typeof livro[player] === 'number' ? (livro[player] as number) : 0, ev.meuDano);
        ev.restante = Math.max(0, ev.H - somaLivro(livro));
        const morto = ev.fim?.como === 'morto' || ev.restante <= 0;
        const me = eu(m);
        // Só o seu jogador leva dano aqui (cada aparelho decide o que acerta o dele).
        const alcancavel = zonaDe(me.x, me.y) === 'bar' && me.estado === 'normal';
        let ultimo: Ponto | null = null;
        if (ent === 'dragao') {
          if (!ev.sopros) {
            ev.furos = furosDragao(ag.semente, def.dura);
            ev.sopros = soprosDragao(ag.semente, def.dura);
            ev.pisoesL = pisoesDragao(ag.semente, def.dura);
          }
          ultimo = ev.dragao?.furo ?? null;
          ev.dragao = morto ? null : cabecaDragao(ev.furos, dt);
          ev.sopro = morto ? null : soproEm(ev.sopros, dt);
          ev.pocas = morto ? [] : pocasFogo(ev.sopros, dt);
          if (ev.dragao) {
            m.extras = [{ id: 'dragao', x: ev.dragao.furo[0], y: ev.dragao.furo[1], raio: DRAGAO_RAIO }];
            // Pisão: na troca de furo, os móveis em volta do furo novo caem (só os pisões de agora; quem chega
            // atrasado não quebra o bar de novo).
            for (const p of ev.pisoesL)
              if (dt >= p.t && !ev.pisoes.has(p.t)) {
                ev.pisoes.add(p.t);
                if (dt - p.t > 3000) continue;
                PROPS.forEach((pr, i) => {
                  if (Math.hypot(pr.x + 0.5 - p.furo[0], pr.y + 0.5 - p.furo[1]) <= PISAO_RAIO) quebrar(m, i, undefined, true);
                });
                if (zonaDe(me.x, me.y) === 'bar') {
                  m.trauma = Math.min(1, m.trauma + 0.5);
                  avisar('BUM! O dragão pisou no telhado e a cabeça desceu em outro furo.');
                }
              }
            const s = ev.sopro;
            if (s?.fase === 'ativo' && alcancavel && !ev.queimados.has(s.s.id) && naLinhaFogo(s.s, me.x, me.y)) {
              ev.queimados.add(s.s.id);
              ferirPorEvento(m, me, DANO_FOGO, s.s.dx, s.s.dy);
            }
            if (alcancavel && agora - ev.pocaEm > 1000 && ev.pocas.some((p) => Math.hypot(p.x - me.x, p.y - me.y) <= POCA_RAIO)) {
              ev.pocaEm = agora;
              ferirPorEvento(m, me, DANO_POCA, 0, 0);
            }
          }
        } else {
          if (!ev.rotaD) ev.rotaD = rotaDino(ag.semente, ENTRADA, def.dura);
          const antes = ev.dino;
          ultimo = antes && !antes.fora ? [antes.x, antes.y] : null;
          ev.dino = morto ? null : posDino(ev.rotaD, dt);
          if (ev.dino && !ev.dino.fora) {
            m.extras = [{ id: 'dino', x: ev.dino.x, y: ev.dino.y, raio: DINO_RAIO }];
            if (alcancavel && m.t >= ev.atordoaAte) {
              const b = batidaDino(ev.rotaD, ev.dinoDtAnt < 0 ? dt : ev.dinoDtAnt, dt, me.x, me.y);
              if (b !== null && !ev.batidas.has(b)) {
                ev.batidas.add(b);
                ferirPorEvento(m, me, DANO_DINO, ev.dino.fx, ev.dino.fy);
              }
            }
            // Os passos da investida balançam a tela em ritmo (o sistema "reduzir movimento" zera o tremor no desenho).
            if (ev.dino.fase === 'investe' && zonaDe(me.x, me.y) === 'bar' && agora - ev.pisadaEm > 280) {
              ev.pisadaEm = agora;
              m.trauma = Math.min(1, m.trauma + 0.12);
            }
          }
          ev.dinoDtAnt = dt;
          if (ev.dino?.fora && antes && !antes.fora && ev.avisou !== 'fugiu') {
            ev.avisou = 'fugiu';
            avisar('O dinossauro achou a saída e voltou correndo pro circo.');
          }
        }
        // Dano: no máximo 2 gravações por segundo, sempre com o total (o banco só deixa crescer).
        if (ev.meuDano > ev.enviado && agora - ev.enviadoEm > 500 && barPresence.online) {
          ev.enviado = ev.meuDano;
          ev.enviadoEm = agora;
          void barPresence.somarDano(ag.epoca, ent, ev.meuDano);
        }
        if (ev.restante <= 0 && !ev.fim && !ev.fechou) {
          ev.fechou = true;
          ev.fim = { como: 'morto', p: player, at: t };
          if (barPresence.online) {
            if (ev.meuDano > ev.enviado) void barPresence.somarDano(ag.epoca, ent, (ev.enviado = ev.meuDano));
            void barPresence.fecharEvento(ag.epoca, 'morto');
          }
        }
        if (ev.fim?.como === 'morto' && !ev.premiado) {
          ev.premiado = true;
          if (ultimo) {
            const q = telaDe(ultimo[0], ultimo[1], 'bar');
            espirrar('bar', q.x, q.y - (ent === 'dragao' ? 30 : 12), 8, 0, -1, 24, ent === 'dragao' ? ['#2a7a6a', '#e8d6a0', '#ff8a2a'] : ['#7a4ab0', '#c8a8e8', '#fee761'], 1.4, false, 2);
          }
          const nome = ent === 'dragao' ? 'O dragão' : 'O dinossauro';
          // O seu dano vem do livro (banco ou local): recarregar a página não tira o prêmio de quem bateu.
          if ((Number(livro[player]) || 0) > 0) {
            const v = pagarEvento(ag.tipo, ent === 'dragao' ? PREMIO_DRAGAO : PREMIO_DINO);
            trofeu(def.trofeu);
            avisar(
              ent === 'dragao'
                ? `${nome} desabou no telhado!${v ? ` +R$ ${v}` : ''} (caiu um dente: vai pra prateleira).`
                : `${nome} capotou de tontura!${v ? ` +R$ ${v}` : ''} (deixou um ovo no balcão: vai pra prateleira).`,
            );
          } else avisar(`${nome} caiu! (você não bateu nele, então não leva nada).`);
        }
      }
      if (ag.tipo === 'ratazana') {
        ev.H = vidaEscalada(RATO_VIDA, ev.n);
        const danoRaw = raw.dano && typeof raw.dano === 'object' ? ((raw.dano as Record<string, unknown>).rato as Record<string, unknown> | undefined) : undefined;
        const livro: Record<string, unknown> = { ...(danoRaw && typeof danoRaw === 'object' ? danoRaw : {}) };
        livro[player] = Math.max(typeof livro[player] === 'number' ? (livro[player] as number) : 0, ev.meuDano);
        ev.restante = Math.max(0, ev.H - somaLivro(livro));
        const rota = rotaRato(ag.semente, PORTA_RATO, COMIDAS, def.dura);
        const morto = ev.fim?.como === 'morto' || ev.restante <= 0;
        const antes = ev.rato;
        ev.rato = morto ? null : posRato(rota, t - ag.inicio);
        if (ev.rato && !ev.rato.fora) {
          m.extras = [{ id: 'rato', x: ev.rato.x, y: ev.rato.y, raio: RATO_RAIO }];
          // Rastro de lama enquanto anda (quem pisa leva pegada).
          if (!ev.rato.rouba && agora - ev.lamaEm > 380) {
            ev.lamaEm = agora;
            const q = telaDe(ev.rato.x, ev.rato.y, 'bar');
            pocaEm('bar', q.x, q.y + 1, 2.4, '#4a3524');
          }
        }
        if (ev.rato?.fora && antes && !antes.fora && ev.avisou !== 'fugiu') {
          ev.avisou = 'fugiu';
          avisar(`A ratazana voltou pro cano levando ${roubosAte(rota, t - ag.inicio)} comidas do balcão.`);
        }
        // Dano: no máximo 2 gravações por segundo, sempre com o total (o banco só deixa crescer).
        if (ev.meuDano > ev.enviado && agora - ev.enviadoEm > 500 && barPresence.online) {
          ev.enviado = ev.meuDano;
          ev.enviadoEm = agora;
          void barPresence.somarDano(ag.epoca, 'rato', ev.meuDano);
        }
        if (ev.restante <= 0 && !ev.fim && !ev.fechou) {
          ev.fechou = true;
          ev.fim = { como: 'morto', p: player, at: t };
          if (barPresence.online) {
            // O golpe final também vai para o livro (sem esperar o meio segundo).
            if (ev.meuDano > ev.enviado) void barPresence.somarDano(ag.epoca, 'rato', (ev.enviado = ev.meuDano));
            void barPresence.fecharEvento(ag.epoca, 'morto');
          }
        }
        if (ev.fim?.como === 'morto' && !ev.premiado) {
          ev.premiado = true;
          if (antes && !antes.fora) {
            const q = telaDe(antes.x, antes.y, 'bar');
            espirrar('bar', q.x, q.y, 6, 0, -1, 18, ['#8b8f99', '#c0cbdc', '#5a5f6a'], 1.2, false, 2);
            if (goreRef.current) poca('bar', q.x, q.y + 1, 4);
          }
          // O seu dano vem do livro (banco ou local): recarregar a página não tira o prêmio de quem bateu.
          if ((Number(livro[player]) || 0) > 0) {
            const v = pagarEvento('ratazana', 20);
            trofeu('rabo');
            avisar(`A ratazana caiu!${v ? ` +R$ ${v}` : ''} (o Rabo de Rato vai pra prateleira).`);
          } else avisar('Derrubaram a ratazana! (você não bateu nela, então não leva nada).');
        }
      }
      if (ag.tipo === 'apagao' && ev.fim?.como === 'religado' && !ev.premiado) {
        ev.premiado = true;
        const quem = PLAYER_BY_ID[ev.fim.p as PlayerId]?.name ?? 'Alguém';
        if (ev.fim.at - ag.inicio <= 60_000 && zonaDe(eu(m).x, eu(m).y) === 'bar') {
          const v = pagarEvento('apagao', 10);
          trofeu('vela');
          avisar(`${quem} religou a luz em ${Math.round((ev.fim.at - ag.inicio) / 1000)} s!${v ? ` +R$ ${v}` : ''}`);
        } else avisar(`${quem} religou a luz.`);
      }
    };
    /** O véu do evento no quadro: o apagão pisca 2 vezes no aviso (escurece, não clareia). */
    const veuEvento = (t: number): { ev: Grading | null; k: number } => {
      if (veu.ev) return veu;
      if (ev.ag?.tipo === 'alien' && ev.fim?.como === 'morto' && !ev.acabou) {
        const u = t - ev.fim.at;
        const k = Math.max(0, Math.min(1, u / 1500, (INVASAO_MS - u) / 1500));
        if (k > 0) return { ev: 'invasao', k };
      }
      if (ev.ag?.tipo === 'apagao' && ev.fase === 'aviso') {
        const u = t - ev.ag.aviso;
        if ((u > 6000 && u < 6250) || (u > 12000 && u < 12250)) return { ev: 'apagao', k: 0.85 };
      }
      return { ev: null, k: 0 };
    };

    // Fatia 11: o alienígena e a invasão. Discos levam NPCs (somem até o fim da invasão), o grande varre linhas.
    const desenharAlien = (x0: number, y0: number, t: number) => {
      const imp = impactos.get('alien');
      const rc = imp ? recuo(t - imp.t0, imp.forte, imp.dx, imp.dy, reduzidoRef.current) : { x: 0, y: 0 };
      const branco = (flashQ.get('alien') ?? 0) > 0;
      const x = Math.round(x0 + rc.x);
      const y = Math.round(y0 + rc.y);
      const p = (dx: number, dy: number, w: number, h: number, cor: string) => {
        lc.fillStyle = branco ? '#ffffff' : cor;
        lc.fillRect(x + dx, y + dy, w, h);
      };
      lc.fillStyle = padraoBayer('#0e0b16', 0.5);
      lc.beginPath();
      lc.ellipse(x, y, 7, 3, 0, 0, Math.PI * 2);
      lc.fill();
      // Macacão prateado, mãos verdes segurando o copo.
      p(-4, -3, 3, 3, '#3a3a48');
      p(1, -3, 3, 3, '#3a3a48');
      p(-6, -16, 12, 13, '#5a6988');
      p(-5, -16, 10, 12, '#8b9bb4');
      p(-1, -14, 2, 8, '#c0cbdc');
      p(-8, -12, 3, 3, '#63c74d');
      p(5, -12, 3, 3, '#63c74d');
      p(6, -17, 3, 5, '#fee761');
      p(6, -17, 3, 1, '#f4f4f4');
      // Cabeça verde com olhos enormes dentro do capacete-aquário (vidro com reflexo).
      p(-5, -27, 10, 10, '#265c42');
      p(-4, -28, 8, 11, '#63c74d');
      p(-3, -24, 3, 3, '#181425');
      p(1, -24, 3, 3, '#181425');
      p(-2, -24, 1, 1, '#f4f4f4');
      p(2, -24, 1, 1, '#f4f4f4');
      if (!branco) {
        lc.strokeStyle = 'rgba(192,203,220,0.85)';
        lc.lineWidth = 1;
        lc.beginPath();
        lc.arc(x + 0.5, y - 23.5, 9, 0, Math.PI * 2);
        lc.stroke();
        lc.fillStyle = 'rgba(232,244,255,0.18)';
        lc.fill();
        lc.fillStyle = 'rgba(255,255,255,0.8)';
        lc.fillRect(x - 6, y - 29, 2, 2);
        lc.fillRect(x - 7, y - 27, 1, 2);
      }
      p(-1, -34, 1, 3, '#8b9bb4');
      p(-2, -35, 3, 1, Math.floor(t / 400) % 2 ? '#e43b44' : '#feae34');
      if (ev.H > 0) {
        lc.fillStyle = '#181425';
        lc.fillRect(x - 11, y - 40, 22, 3);
        lc.fillStyle = '#63c74d';
        lc.fillRect(x - 10, y - 39, Math.max(0, Math.round((20 * ev.restante) / ev.H)), 1);
      }
    };
    /** Disco "pires": casco cinza, cúpula, luzes girando; `grande` = o chefe. */
    const desenharDisco = (x: number, y: number, t: number, grande: boolean, id: string, vida: number) => {
      const s = grande ? 2 : 1;
      const branco = (flashQ.get(id) ?? 0) > 0;
      const c = (cor: string) => (branco ? '#ffffff' : cor);
      lc.fillStyle = c('#3a4466');
      lc.beginPath();
      lc.ellipse(x, y, 11 * s, 3.5 * s, 0, 0, Math.PI * 2);
      lc.fill();
      lc.fillStyle = c('#8b9bb4');
      lc.beginPath();
      lc.ellipse(x, y - 1 * s, 10 * s, 2.5 * s, 0, 0, Math.PI * 2);
      lc.fill();
      lc.fillStyle = c('#9ad0ff');
      lc.beginPath();
      lc.ellipse(x, y - 3 * s, 4 * s, 3 * s, 0, Math.PI, Math.PI * 2);
      lc.fill();
      for (let i = 0; i < 5; i++) {
        const a = t / 300 + (i / 5) * Math.PI * 2;
        lc.fillStyle = Math.sin(a) > 0 ? '#fee761' : '#e43b44';
        lc.fillRect(Math.round(x + Math.cos(a) * 9 * s), Math.round(y + Math.sin(a) * 2 * s), s, s);
      }
      if (vida < 1) {
        lc.fillStyle = '#181425';
        lc.fillRect(Math.round(x - 10 * s), Math.round(y - 9 * s), 20 * s, 3);
        lc.fillStyle = '#2ce8f5';
        lc.fillRect(Math.round(x - 10 * s + 1), Math.round(y - 9 * s + 1), Math.max(0, Math.round((20 * s - 2) * vida)), 1);
      }
    };
    /** Fatia 12: ícones de status de 5 × 5 px em coluna ao lado da cabeça (chama, gota, raio, pingo de óleo), subindo de y. */
    const ICONES_STATUS: Record<Status, { cor: string; px: string }> = {
      queimando: { cor: '#f77622', px: '..#..|.###.|.###.|#####|.###.' },
      molhado: { cor: '#9ad0ff', px: '..#..|.###.|#####|#####|.###.' },
      eletrico: { cor: '#fee761', px: '...##|..##.|.####|.##..|##...' },
      grudento: { cor: '#c28a1f', px: '#####|#####|.#.#.|.#.#.|...#.' },
    };
    const desenharStatus = (sts: Status[], x: number, y: number, agora: number) => {
      sts.forEach((s, i) => {
        const ic = ICONES_STATUS[s];
        const y0 = y - i * 8 - (s === 'queimando' || s === 'eletrico' ? Math.floor(agora / 150) % 2 : 0);
        lc.fillStyle = '#181425';
        lc.fillRect(x - 1, y0 - 1, 7, 7);
        lc.fillStyle = ic.cor;
        ic.px.split('|').forEach((l, yy) => {
          for (let xx = 0; xx < 5; xx++) if (l[xx] === '#') lc.fillRect(x + xx, y0 + yy, 1, 1);
        });
      });
    };
    /**
     * Fatia 17: o que as feras marcam no chão. O sopro do dragão: linha tracejada vermelha 1,2 s antes (piscando, ou
     * fixa com "reduzir movimento") e o jato de fogo; as poças que ele deixa; e a investida do dinossauro (a faixa até
     * a outra ponta enquanto ele raspa as patas).
     */
    const desenharChaoFera = (t: number, agora: number, cx: number, cy: number, camada: 'chao' | 'fogo') => {
      const linha = (ax: number, ay: number, bx: number, by: number, cor: string, tracejada: boolean) => {
        const n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.2));
        lc.fillStyle = cor;
        for (let i = 0; i <= n; i++) {
          if (tracejada && i % 3 === 2) continue;
          const q = telaDe(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, 'bar');
          lc.fillRect(Math.round(q.x - cx) - 2, Math.round(q.y - cy) - 1, 4, 2);
        }
      };
      // A faixa inteira que vai ser atingida (a largura de verdade do golpe), translúcida por baixo da linha.
      const faixa = (ax: number, ay: number, bx: number, by: number, larg: number, cor: string, alfa: number) => {
        const L = Math.hypot(bx - ax, by - ay) || 1;
        const nx = -(by - ay) / L;
        const ny = (bx - ax) / L;
        const n = Math.ceil(L / 0.2);
        const k = Math.max(1, Math.round(larg / 0.2));
        lc.globalAlpha = alfa;
        lc.fillStyle = cor;
        for (let i = 0; i <= n; i++)
          for (let j = -k; j <= k; j++) {
            const q = telaDe(ax + ((bx - ax) * i) / n + nx * j * 0.2, ay + ((by - ay) * i) / n + ny * j * 0.2, 'bar');
            lc.fillRect(Math.round(q.x - cx) - 2, Math.round(q.y - cy) - 1, 4, 3);
          }
        lc.globalAlpha = 1;
      };
      const s = ev.sopro;
      if (s && (s.fase === 'aviso') === (camada === 'chao')) {
        const { de, dx, dy } = s.s;
        const alc = s.s.alc ?? FOGO_COMPR;
        const fim: Ponto = [de[0] + dx * alc, de[1] + dy * alc];
        if (s.fase === 'aviso') {
          const pisca = reduzidoRef.current || Math.floor(agora / 140) % 2 === 0;
          const perto = (t - (ev.ag?.inicio ?? 0) - (s.s.t0 - FOGO_AVISO_MS)) / FOGO_AVISO_MS;
          faixa(de[0] + dx * 0.4, de[1] + dy * 0.4, fim[0], fim[1], FOGO_LARG, '#e43b44', 0.3 + 0.3 * Math.max(0, Math.min(1, perto)));
          linha(de[0] + dx * 0.4, de[1] + dy * 0.4, fim[0], fim[1], pisca ? (perto > 0.6 ? '#ffd0a0' : '#ff4a2a') : '#a01e28', true);
        } else {
          lc.globalCompositeOperation = 'lighter';
          for (let d = 0.4; d <= alc; d += 0.35) {
            const q = telaDe(de[0] + dx * d, de[1] + dy * d, 'bar');
            const h = 6 + Math.round(4 * Math.sin(agora / 50 + d * 3));
            const x = Math.round(q.x - cx);
            const y = Math.round(q.y - cy);
            lc.fillStyle = '#c0282c';
            lc.fillRect(x - 3, y - h, 6, h);
            lc.fillStyle = '#ff8a2a';
            lc.fillRect(x - 2, y - h - 2, 4, h);
            lc.fillStyle = '#fff6c0';
            lc.fillRect(x - 1, y - h - 3, 2, Math.max(1, h >> 1));
          }
          lc.globalCompositeOperation = 'source-over';
        }
      }
      if (camada === 'fogo') return;
      for (const p of ev.pocas) {
        const q = telaDe(p.x, p.y, 'bar');
        const x = Math.round(q.x - cx);
        const y = Math.round(q.y - cy);
        const al = Math.min(1, (p.ate - (t - (ev.ag?.inicio ?? 0))) / 900);
        lc.globalAlpha = 0.4 * al;
        lc.fillStyle = '#1a0e08';
        lc.beginPath();
        lc.ellipse(x, y, POCA_RAIO * 16, POCA_RAIO * 8, 0, 0, Math.PI * 2);
        lc.fill();
        lc.globalAlpha = al;
        for (let i = 0; i < 4; i++) {
          const ox = ((i * 37 + p.id.length * 11) % 13) - 6;
          const h = Math.round((5 + ((i * 3) % 4)) * (0.75 + 0.25 * Math.sin(agora / 70 + i * 1.7)));
          lc.fillStyle = '#c0282c';
          lc.fillRect(x + ox - 1, y - h, 3, h);
          lc.fillStyle = '#ff8a2a';
          lc.fillRect(x + ox, y - h - 1, 1, h - 1);
        }
        lc.globalAlpha = 1;
      }
      const d = ev.dino;
      if (d && !d.fora && d.fase === 'prepara' && d.alvo) {
        const pisca = reduzidoRef.current || Math.floor(agora / 160) % 2 === 0;
        faixa(d.x, d.y, d.alvo[0], d.alvo[1], DINO_RAIO + 0.3, '#feae34', 0.3);
        linha(d.x, d.y, d.alvo[0], d.alvo[1], pisca ? '#fee761' : '#c07a1a', true);
      }
    };

    /** Fatia 20: curativo em X (fita cor de pele com contorno escuro), 5 × 4 px, centrado em (x, y) da tela baixa. */
    const desenharCurativo = (x: number, y: number) => {
      const X: readonly (readonly [number, number])[] = [
        [-2, -1],
        [-1, 0],
        [0, 0],
        [1, 1],
        [1, -1],
        [-1, 1],
      ];
      lc.fillStyle = '#0b0a10';
      for (const [ox, oy] of X) lc.fillRect(x + ox - 1, y + oy - 1, 3, 3);
      lc.fillStyle = '#e8c39e';
      for (const [ox, oy] of X) lc.fillRect(x + ox, y + oy, 1, 1);
    };

    /** Fatia 17: a cabeça do dragão pendurada pelo furo do forro (o pescoço some no alto da tela). */
    const desenharDragao = (x0: number, y0: number, t: number, agora: number) => {
      const imp = impactos.get('dragao');
      const rc = imp ? recuo(t - imp.t0, imp.forte, imp.dx, imp.dy, reduzidoRef.current) : { x: 0, y: 0 };
      const branco = (flashQ.get('dragao') ?? 0) > 0 || (!!imp && t - imp.t0 < 34);
      const balanca = reduzidoRef.current ? 0 : Math.round(Math.sin(agora / 600) * 1.5);
      const x = Math.round(x0 + rc.x) + balanca;
      const y = Math.round(y0 + rc.y);
      const c = (cor: string) => (branco ? '#ffffff' : cor);
      const ret = (dx: number, dy: number, w: number, h: number, cor: string) => {
        lc.fillStyle = c(cor);
        lc.fillRect(x + dx, y + dy, w, h);
      };
      const dorme = m.t < ev.sonoAte;
      const sopro = ev.sopro;
      // Sombra no chão, embaixo do furo.
      lc.fillStyle = padraoBayer('#0e0b16', 0.5);
      lc.beginPath();
      lc.ellipse(x0, y0, 14, 4, 0, 0, Math.PI * 2);
      lc.fill();
      // Pescoço escamado subindo até fora da tela.
      for (let yy = y - 34; yy > y - 34 - 260; yy -= 4) {
        lc.fillStyle = '#1a4a42';
        lc.fillRect(x - 5, yy - 4, 10, 4);
        lc.fillStyle = '#2a7a6a';
        lc.fillRect(x - 4, yy - 4, 8, 3);
        lc.fillStyle = '#e8d6a0';
        lc.fillRect(x - 1, yy - 3, 3, 2);
      }
      // Cabeça (de frente para quem olha): contorno, focinho, chifres, olhos, narinas.
      const LIN: readonly (readonly [number, number, number])[] = [
        [-36, -7, 7], [-35, -9, 9], [-34, -10, 10], [-33, -11, 11], [-32, -11, 11], [-31, -11, 11], [-30, -11, 11], [-29, -10, 10],
        [-28, -9, 9], [-27, -9, 9], [-26, -8, 8], [-25, -8, 8], [-24, -8, 8], [-23, -7, 7], [-22, -6, 6],
      ];
      for (const [dy, a0, a1] of LIN) {
        ret(a0 - 1, dy, a1 - a0 + 2, 1, '#0e2a26');
        ret(a0, dy, a1 - a0, 1, dy <= -33 ? '#3a9a86' : dy >= -26 ? '#e8d6a0' : '#2a7a6a');
      }
      ret(-7, -21, 14, 1, '#0e2a26');
      // Chifres de osso (com contorno: na frente do balcão claro eles sumiam).
      for (const sx of [-1, 1]) {
        const cx0 = sx < 0 ? -11 : 9;
        const cx1 = sx < 0 ? -12 : 10;
        ret(cx0 - 1, -41, 4, 6, '#0e2a26');
        ret(cx1 - 1, -44, 4, 4, '#0e2a26');
        ret(cx0, -40, 2, 5, '#e8e0c8');
        ret(cx1, -43, 2, 3, '#e8e0c8');
      }
      // Sobrancelha de escama, brava, descendo para o meio.
      ret(-10, -35, 2, 1, '#0e2a26');
      ret(-8, -34, 4, 1, '#0e2a26');
      ret(8, -35, 2, 1, '#0e2a26');
      ret(4, -34, 4, 1, '#0e2a26');
      // Olhos: amarelos com fenda, ou fechados com "z" quando a cachaça bate.
      if (dorme) {
        ret(-8, -31, 4, 1, '#0e2a26');
        ret(4, -31, 4, 1, '#0e2a26');
        if (!reduzidoRef.current) {
          const zz = Math.floor(agora / 400) % 3;
          lc.fillStyle = '#c0cbdc';
          lc.font = '8px VT323, monospace';
          lc.fillText('z'.repeat(zz + 1), x + 12, y - 44 - zz * 2);
        }
      } else {
        ret(-8, -32, 4, 3, '#fee761');
        ret(4, -32, 4, 3, '#fee761');
        ret(-6, -32, 1, 3, '#181425');
        ret(6, -32, 1, 3, '#181425');
      }
      // Boca: brasa acesa no aviso, aberta cuspindo fogo no sopro; fumaça nas narinas.
      if (sopro?.fase === 'ativo') {
        ret(-5, -24, 10, 4, '#181425');
        ret(-4, -23, 8, 2, '#ff8a2a');
        ret(-2, -23, 4, 1, '#fff6c0');
      } else {
        ret(-5, -24, 10, 1, '#0e2a26');
        if (sopro?.fase === 'aviso' && (reduzidoRef.current || Math.floor(agora / 120) % 2 === 0)) ret(-3, -23, 6, 1, '#ff4a2a');
      }
      ret(-3, -27, 1, 1, '#0e2a26');
      ret(2, -27, 1, 1, '#0e2a26');
      // Presas para fora da boca.
      ret(-6, -23, 3, 3, '#0e2a26');
      ret(3, -23, 3, 3, '#0e2a26');
      ret(-5, -23, 1, 2, '#f4f4f4');
      ret(4, -23, 1, 2, '#f4f4f4');
      // Vida que falta, por cima.
      if (ev.H > 0) {
        lc.fillStyle = '#181425';
        lc.fillRect(x - 13, y - 50, 26, 3);
        lc.fillStyle = '#e43b44';
        lc.fillRect(x - 12, y - 49, Math.max(0, Math.round((24 * ev.restante) / ev.H)), 1);
      }
    };

    /**
     * Fatia 17: o dinossauro do circo (roxo, placas laranja nas costas, gola de palhaço e chapéu de cone), virado para
     * onde anda. As formas entram numa lista e saem em duas passadas (contorno escuro de 1 px em todas, depois o
     * recheio): a silhueta lê como uma peça só, mesmo na frente da geladeira clara.
     */
    const desenharDino = (x0: number, y0: number, r: PosDino, t: number, agora: number) => {
      const imp = impactos.get('dino');
      const rc = imp ? recuo(t - imp.t0, imp.forte, imp.dx, imp.dy, reduzidoRef.current) : { x: 0, y: 0 };
      const branco = (flashQ.get('dino') ?? 0) > 0 || (!!imp && t - imp.t0 < 34);
      const tremor = r.fase === 'prepara' && !reduzidoRef.current ? (Math.floor(agora / 60) % 2) - 0.5 : 0;
      const x = Math.round(x0 + rc.x + tremor);
      const y = Math.round(y0 + rc.y);
      // Na tela, "para a direita" é x − y crescendo.
      const s = r.fx - r.fy < 0 ? -1 : 1;
      const anda = r.fase === 'anda' || r.fase === 'investe';
      const p = anda ? Math.floor(agora / (r.fase === 'investe' ? 70 : 140)) % 2 : 0;
      const tonto = r.fase === 'tonto' || m.t < ev.atordoaAte;
      const formas: [number, number, number, number, string][] = [];
      const f = (dx: number, dy: number, w: number, h: number, cor: string) => formas.push([dx, dy, w, h, cor]);
      const pinta = (dx: number, dy: number, w: number, h: number, cor: string) => {
        lc.fillStyle = branco ? '#ffffff' : cor;
        lc.fillRect(s > 0 ? x + dx : x - dx - w, y + dy, w, h);
      };
      lc.fillStyle = padraoBayer('#0e0b16', 0.5);
      lc.beginPath();
      lc.ellipse(x, y, 18, 5, 0, 0, Math.PI * 2);
      lc.fill();
      // Rabo (grosso na raiz, afina para trás), pernas alternando, corpo, pescoço e cabeça.
      f(-27, -15, 6, 3, '#563483');
      f(-22, -18, 6, 5, '#563483');
      f(-17, -21, 6, 8, '#634096');
      f(-9 + p * 2, -7, 6, 7, '#3e2462');
      f(3 - p * 2, -7, 6, 7, '#3e2462');
      f(-12, -25, 22, 17, '#7a4ab0');
      f(5, -32, 8, 9, '#7a4ab0');
      f(7, -40, 14, 9, '#7a4ab0');
      f(14, -32, 9, 3, '#634096');
      f(10, -20, 5, 2, '#634096');
      for (const [dx, dy, w, h] of formas) {
        lc.fillStyle = '#181425';
        lc.fillRect((s > 0 ? x + dx : x - dx - w) - 1, y + dy - 1, w + 2, h + 2);
      }
      for (const [dx, dy, w, h, cor] of formas) pinta(dx, dy, w, h, cor);
      // Luz por cima e sombra embaixo (luz vem do alto à esquerda), barriga clara e unhas.
      pinta(-11, -24, 18, 2, '#9a6ad0');
      pinta(8, -39, 11, 1, '#9a6ad0');
      pinta(-12, -10, 22, 2, '#563483');
      pinta(-8, -16, 15, 5, '#c8a8e8');
      pinta(-9 + p * 2, -1, 6, 1, '#181425');
      pinta(3 - p * 2, -1, 6, 1, '#181425');
      // Placas laranja nas costas (circo).
      for (let i = 0; i < 4; i++) {
        pinta(-14 + i * 6, -28, 3, 3, '#181425');
        pinta(-13 + i * 6, -27, 2, 2, i % 2 ? '#feae34' : '#f77622');
      }
      // Dentes, narina e olho (tonto: girando, com estrelas por cima).
      pinta(15, -31, 1, 1, '#f4f4f4');
      pinta(18, -31, 1, 1, '#f4f4f4');
      pinta(21, -31, 1, 1, '#f4f4f4');
      pinta(19, -37, 1, 1, '#181425');
      if (tonto) {
        pinta(12, -38, 3, 3, '#f4f4f4');
        pinta((Math.floor(agora / 120) % 2) + 12, -37 + (Math.floor(agora / 240) % 2), 1, 1, '#181425');
        if (!reduzidoRef.current)
          for (let i = 0; i < 3; i++) {
            const a = agora / 200 + (i * Math.PI * 2) / 3;
            pinta(12 + Math.round(Math.cos(a) * 8), -47 + Math.round(Math.sin(a) * 2), 2, 2, '#fee761');
          }
      } else {
        pinta(12, -38, 3, 2, '#f4f4f4');
        pinta(14, -38, 1, 2, '#181425');
        // Sobrancelha brava quando vai investir.
        if (r.fase !== 'anda') pinta(11, -39, 4, 1, '#181425');
      }
      // Gola de palhaço (branca e vermelha) na base do pescoço.
      for (let i = 0; i < 6; i++) {
        pinta(3 + i * 2, -25 + (i % 2), 2, 3, '#181425');
        pinta(3 + i * 2, -24 + (i % 2), 2, 1, i % 2 ? '#e43b44' : '#f4f4f4');
      }
      // Chapéu de cone com pompom.
      pinta(9, -42, 7, 2, '#181425');
      pinta(10, -42, 5, 1, '#e43b44');
      pinta(10, -44, 5, 2, '#181425');
      pinta(11, -44, 3, 2, '#f4f4f4');
      pinta(11, -46, 3, 2, '#181425');
      pinta(12, -46, 1, 2, '#e43b44');
      pinta(11, -48, 3, 2, '#fee761');
      // Poeira raspando as patas antes de investir.
      if (r.fase === 'prepara' && !reduzidoRef.current) {
        pinta(-14 - p * 2, -3, 3, 2, '#8b9bb4');
        pinta(-18 - p, -5, 2, 2, '#c0cbdc');
      }
      if (ev.H > 0) {
        lc.fillStyle = '#181425';
        lc.fillRect(x - 13, y - 55, 26, 3);
        lc.fillStyle = '#e43b44';
        lc.fillRect(x - 12, y - 54, Math.max(0, Math.round((24 * ev.restante) / ev.H)), 1);
      }
    };

    const desenharRato = (x0: number, y0: number, r: { fx: number; rouba: boolean }, t: number) => {
      const imp = impactos.get('rato');
      const rc = imp ? recuo(t - imp.t0, imp.forte, imp.dx, imp.dy, reduzidoRef.current) : { x: 0, y: 0 };
      const branco = (flashQ.get('rato') ?? 0) > 0 || (!!imp && t - imp.t0 < 34);
      const x = Math.round(x0 + rc.x);
      const y = Math.round(y0 + rc.y);
      const s = r.fx < 0 ? -1 : 1;
      // Retângulo espelhado pela direção (o focinho vai para onde ela anda).
      const ret = (dx: number, dy: number, w: number, h: number, cor: string) => {
        lc.fillStyle = branco ? '#ffffff' : cor;
        lc.fillRect(s > 0 ? x + dx : x - dx - w, y + dy, w, h);
      };
      lc.fillStyle = padraoBayer('#0e0b16', 0.5);
      lc.beginPath();
      lc.ellipse(x, y, 10, 3, 0, 0, Math.PI * 2);
      lc.fill();
      // Rabo pelado ondulando.
      for (let i = 0; i < 13; i++) ret(-11 - i, -8 + Math.round(Math.sin(t / 110 + i * 0.7) * 1.5) + Math.floor(i / 4), 1, 1, '#d08a8a');
      const passo = r.rouba ? 0 : Math.floor(t / 90) % 2;
      // Patas curtas (a de trás e a da frente alternam andando).
      ret(-6 + passo, -4, 3, 4, '#2b2d35');
      ret(5 - passo, -4, 3, 4, '#2b2d35');
      // Corpo gordo em lombada, linha a linha (de cima para baixo): dorso claro, flanco, barriga mais clara, focinho na frente.
      const LINHAS: readonly (readonly [number, number, number])[] = [
        [-16, -3, 2], [-15, -6, 4], [-14, -8, 6], [-13, -9, 7], [-12, -10, 9], [-11, -10, 10], [-10, -10, 11],
        [-9, -10, 12], [-8, -9, 13], [-7, -8, 13], [-6, -7, 10], [-5, -5, 7],
      ];
      for (const [dy, a0, a1] of LINHAS) {
        ret(a0 - 1, dy, a1 - a0 + 2, 1, '#2b2d35');
        ret(a0, dy, a1 - a0, 1, dy <= -15 ? '#9aa0ad' : dy >= -6 ? '#8a8f9c' : '#6b6f7a');
      }
      ret(-3, -17, 5, 1, '#2b2d35');
      ret(-4, -4, 11, 1, '#2b2d35');
      // Orelha, olho, focinho e bigode.
      ret(3, -19, 4, 4, '#2b2d35');
      ret(4, -18, 2, 2, '#d08a8a');
      ret(8, -12, 1, 1, '#e43b44');
      ret(13, -8, 1, 2, '#e8a0a8');
      ret(14, -10, 2, 1, '#c0cbdc');
      ret(14, -7, 2, 1, '#c0cbdc');
      if (r.rouba) ret(11, -6, 4, 3, '#feae34');
      // Vida que falta, por cima.
      if (ev.H > 0) {
        lc.fillStyle = '#181425';
        lc.fillRect(x - 11, y - 24, 22, 3);
        lc.fillStyle = '#e43b44';
        lc.fillRect(x - 10, y - 23, Math.max(0, Math.round((20 * ev.restante) / ev.H)), 1);
      }
    };

    const dev = { pausa: false };
    let nocVistos = m.nocautes;
    // Fatia 15: brinde e reviver chegam pelo fx (cada um lido uma vez).
    let fxEm = 0;
    const fxVistos = new Set<string>();
    const reviverEm = new Map<string, number>();
    const lerFx = (srv: number) => {
      const me = eu(m);
      for (const f of fxDoBar(barPresence.fxRaw())) {
        const chave = `${f.p}|${f.k}|${f.to}|${f.t}`;
        if (fxVistos.has(chave) || f.p === player) continue;
        fxVistos.add(chave);
        if (srv - f.t > 6000) continue;
        if (f.k === 'reviver' && f.to === player && podeLevantar(me) && levantar(m, me)) avisar(`🙌 ${NOME_J[f.p]} te levantou do chão!`);
        if (f.k === 'brinde' && !f.to) {
          brinde.current.copos.set(`amigo:${f.p}`, f.t + COPO_MS);
          conferirBrinde.current(f.p, f.t);
        }
      }
    };
    conferirBrinde.current = (p: string, t: number) => {
      const b = brinde.current;
      const me = eu(m);
      const ele = achar(m, `amigo:${p}`);
      if (!ele || ele.quem !== 'remoto' || !brindaram({ t: b.meu, x: me.x, y: me.y }, { t, x: ele.x, y: ele.y })) return;
      const par = `${p}|${Math.round(b.meu)}`;
      if (b.pagos.has(par)) return;
      b.pagos.add(par);
      b.faiscas.push({ x: (me.x + ele.x) / 2, y: (me.y + ele.y) / 2, ate: barPresence.now() + 700 });
      const n = contaBrindes(player);
      if (n < BRINDES_DIA) {
        somarBrinde(player);
        ganhar.current(BRINDE_BONUS, 'brinde');
        narrar(narrador.current, 'brinde', Date.now(), narrRng.current);
        avisar(`🍻 Você e ${NOME_J[p as Jogador]} brindaram! +R$ ${BRINDE_BONUS}`);
      } else avisar(`🍻 Você e ${NOME_J[p as Jogador]} brindaram!`);
      // Registro no livro do bar (o fx com o par), depois da espera de 2 s do banco.
      window.setTimeout(() => void barPresence.act('brinde', p as PlayerId), barPresence.waitMs() + 150);
    };
    brindarAgora.current = () => {
      const b = brinde.current;
      const srv = barPresence.now();
      if (srv - b.meu < 2000) return;
      b.meu = srv;
      b.copos.set(eu(m).id, srv + COPO_MS);
      void barPresence.act('brinde', '');
      // Quem já levantou o copo há pouco (até 2 s antes) brinda com você agora.
      for (const f of fxDoBar(barPresence.fxRaw())) if (f.k === 'brinde' && !f.to && f.p !== player) conferirBrinde.current(f.p, f.t);
    };
    redesenhar.current = () => desenhar(performance.now());
    const quadro = (agora: number) => {
      const intervalo = agora - antes;
      const t0q = performance.now();
      let dt = (agora - antes) / 1000;
      antes = agora;
      if (dev.pausa || fotoRef.current.on) {
        // Pausa do gancho de teste (ou o modo foto da Fatia 15, que redesenha para mostrar a pose escolhida e segue
        // mandando o batimento: sem ele, em 15 s os amigos veriam você dormindo no canto).
        if (fotoRef.current.on) {
          desenhar(agora);
          const meu = elo.enviar(m, { mx: 0, my: 0 }, codigo(visualRef.current), barPresence.now());
          if (meu) barPresence.sendVivo(meu);
        }
        raf = requestAnimationFrame(quadro);
        return;
      }
      if (dt > 0.25) dt = 0.25;
      acertarRelogio(agora);
      const srv = barPresence.now();
      // Relógio: o mundo anda um pouco mais rápido ou mais devagar até alcançar o servidor (longe demais, salta).
      const passoMs = passoRelogio(dt * 1000, m.t, srv);
      if (passoMs - dt * 1000 > SALTO_RELOGIO_MS) m.t += passoMs - dt * 1000;
      else dt = passoMs / 1000;
      try {
        elo.receber(m, sanitizeVivo(barPresence.vivoRaw()), sanitizeVGolpes(barPresence.golpesRaw()), barPresence.retrato, srv, dt);
        elo.receberNpc(m, barPresence.npcRaw(), srv, dt);
      } catch (err) {
        // Dado torto de alguém não pode parar o seu bar: ignora este quadro da rede.
        if (import.meta.env.DEV) console.warn('rede do Bar Vivo', err);
      }
      const dir = direcao();
      // Fatia 10: o diretor de eventos antes do motor (põe a ratazana como alvo; E no disjuntor religa a luz).
      diretor(agora);
      if (toque.current.usa && apagado() && pertoDisjuntor() && religar()) toque.current.usa = false;
      if (!gfaRef.current)
        rodarQuadro(m, laco, dt, dir, toque.current, () => {
          passoAssombro(assombro, m, sustosRef.current, DT);
          eventos();
        });
      // Pegadinha sincronizada (o banco manda; sem banco, fica o daqui): nos que dormem e, Fatia 15, também em quem
      // acordou e ainda não limpou a cara (você e os amigos online).
      if (barPresence.online)
        for (const c of m.corpos) {
          if (c.quem === 'amigo' || c.quem === 'remoto') c.ink = barPresence.marks[c.nome as PlayerId]?.n ?? 0;
          else if (c.quem === 'eu') c.ink = barPresence.marks[player]?.n ?? 0;
        }
      // Fatia 15: parado do lado de quem caiu por 2 s, levanta (NPC aqui; amigo online, pelo aparelho dele).
      {
        const me = eu(m);
        // Parado de verdade: sem andar, sem bater, sem chat ou painel aberto (quem está digitando não levanta ninguém).
        const ocupado = travado.current || document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
        const parado = !ocupado && Math.hypot(dir.mx, dir.my) < 0.1 && me.estado === 'normal' && !me.golpe && !toque.current.soco;
        // Amigo online que você acabou de levantar fica fora por 8 s (o aparelho dele levanta; não manda de novo).
        const srvAgora = barPresence.now();
        const caidos = m.corpos
          .filter((c) => c !== me && podeLevantar(c) && !(c.quem === 'remoto' && srvAgora - (reviverEm.get(c.id) ?? -1e15) < REVIVE_DE_NOVO_MS))
          .map((c) => ({ id: c.id, x: c.x, y: c.y }));
        const r = passoReviver(reviver.current, me, caidos, parado, dt * 1000);
        reviver.current = r.r;
        if (r.levanta) {
          const c = achar(m, r.levanta);
          if (c?.quem === 'remoto') {
            reviverEm.set(c.id, srvAgora);
            void barPresence.act('reviver', c.nome as PlayerId).then((ok) => {
              if (!ok) reviverEm.delete(c.id);
              avisar(ok ? `🙌 Você levantou ${NOME_J[c.nome as Jogador] ?? c.nome}.` : 'Espera 2 s e fica do lado de novo.');
            });
          }
          else if (c && levantar(m, c)) avisar(`🙌 Você levantou ${c.npc?.nome ?? 'alguém'}.`);
        }
      }
      if (agora - fxEm > 200) {
        fxEm = agora;
        lerFx(srv);
      }
      if (barPresence.falhouEnvio(`vivo/${player}`)) elo.reenviar();
      const meu = elo.enviar(m, dir, codigo(visualRef.current), srv);
      if (meu) barPresence.sendVivo(meu);
      // NPCs que estão com você: 4 retratos por segundo enquanto houver algum (e um vazio para soltar na hora).
      if (agora - npcEm >= NPC_ENVIO_MS) {
        const l = elo.linhaNpc(m);
        if (l || npcUltima) {
          barPresence.sendNpc(l);
          npcUltima = l;
          npcEm = agora;
        }
      }
      gravidade(dt, agora);
      const t0d = performance.now();
      desenhar(agora);
      // Fatia 9: orçamento do desenho. A cada 2 s olha o p95 dos últimos 120 quadros e desce (ou sobe) um nível.
      custos.push(performance.now() - t0d);
      if (custos.length > 120) custos.shift();
      if (agora - nivelEm > 2000) {
        nivelEm = agora;
        const ord = [...custos].sort((a, b) => a - b);
        nivel = nivelQualidade(nivel, ord[Math.floor(0.95 * (ord.length - 1) + 0.5)] ?? 0, ord.length);
      }
      // Medidor de quadro (Fatia 7): ligado por ?medidor=1 ou F2; o texto muda a cada 0,5 s, sem passar pelo React.
      if (medidor.ligado) {
        const fim = performance.now();
        medidor.m.anotar(intervalo, fim - t0q, fim - t0d);
        if (agora - medidor.em > 500 && medidorRef.current) {
          medidor.em = agora;
          medidorRef.current.textContent = `${textoMedidor(medidor.m.resumo())} · nível ${nivel}`;
        }
      }
      if (agora - hudEm > 100) {
        hudEm = agora;
        if (m.nocautes > nocVistos) {
          contarMortes.current(m.nocautes - nocVistos);
          nocVistos = m.nocautes;
        }
        const me = eu(m);
        const novo = {
          vida: Math.round(me.vida),
          ko: me.estado === 'ko' || (me.estado === 'segurado' && !!me.seguradoPor),
          nocautes: m.nocautes,
          arma: me.arma ? ARMAS[me.arma.tipo].nome : '',
          tipo: (me.arma ? me.arma.tipo : '') as Arma | '',
          usos: me.arma ? me.arma.usos : 0,
          usosMax: me.arma ? ARMAS[me.arma.tipo].usos : 0,
          dica: comBotoes(dicaDe()),
          calor: m.calor,
          happy: m.happy,
        };
        // Só re-renderiza quando o HUD muda (com painel aberto, o painel não é redesenhado 10 vezes por segundo).
        setHud((h) => ((Object.keys(novo) as (keyof typeof novo)[]).every((k) => h[k] === novo[k]) ? h : novo));
      }
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    // Gancho de teste (só em desenvolvimento): estado do mundo para conferir pela página.
    if (import.meta.env.DEV)
      (window as unknown as { __vivo?: unknown }).__vivo = {
        m,
        dev,
        // Abre um painel de jogo direto (o portal do dia, a caderneta...), sem andar até o móvel.
        abrir: (p: Painel | null) => setJogo(p),
        // Força o portal do dia (só aqui, em desenvolvimento): null volta ao sorteio.
        portal: (p: IdPortal | null) => setPortalForcado(p),
        elo,
        rede: barPresence,
        gotas,
        pedacos,
        jorros,
        // Fatia 8: marcas que ainda vão cair, poças com pegada e o chão de manchas de cada área.
        marcas,
        pocas,
        areas,
        // Fatia 9: véu de evento, hora fixa (foto do dia e da noite), nível de qualidade e quantas luzes no quadro.
        veu,
        hora: (h: number | null) => {
          horaFixa = h;
        },
        nivel: (n?: Nivel) => {
          if (n !== undefined) nivel = n;
          return nivel;
        },
        luzes: () => luzesQuadro.length,
        // Fatia 10: estado do evento, forçar um evento na época de agora (sem banco), pular a hora e religar a luz.
        evento: () => ({ ...ev }),
        forcarEvento: (tipo: TipoEvento | null) => {
          cfgLocal = tipo ? { mult: 1, forcar: { [String(epocaDe(m.t))]: tipo } } : null;
          agCache = { e: -1, ag: null, cfg: '' };
          ev = evNovo();
          diretor(performance.now());
          return ev.ag;
        },
        irPara: (tAlvo: number) => {
          m.t = tAlvo;
          m.hitstopAte = 0;
          diretor(performance.now());
        },
        religar,
        assombro,
        ambiente,
        textos,
        /** Avança `ms` de jogo na hora (painel escondido não roda quadro): `ent(i)` dá a entrada de cada passo. */
        avancar(ms: number, ent?: (i: number) => Partial<Entrada>) {
          const n = Math.round(ms / 1000 / DT);
          let agora = performance.now();
          for (let i = 0; i < n; i++) {
            diretor(agora);
            passo(m, ent ? { ...PARADO, ...ent(i) } : entrada(), DT);
            passoAssombro(assombro, m, sustosRef.current, DT);
            eventos();
            agora += DT * 1000;
            gravidade(DT, agora);
          }
          cam.ok = false; // câmera já no lugar (sem a corrida suave)
          desenhar(performance.now());
          return { t: m.t, eventos: textos.map((x) => x.texto) };
        },
        desenhar: () => desenhar(performance.now()),
        /** Amplitude do tremor de tela no último desenho (px; 0 no movimento reduzido). */
        tremor: () => ultimoTremor,
      };
    // Fechou a aba ou saiu do bar: os outros veem você voltar a dormir no canto na hora.
    const sair = () => {
      const s = elo.ultimo();
      if (s) barPresence.sendVivo(s, false);
    };
    window.addEventListener('pagehide', sair);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pagehide', sair);
      window.removeEventListener('keydown', teclaMedidor);
      sair();
    };
  }, [player, avisar]);

  /* ---------------------------------------------------------------- joystick */

  const base = useRef<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false });
  const onStick = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    if (e.type === 'pointerdown') {
      el.setPointerCapture(e.pointerId);
      // Fatia 12: dois toques rápidos no joystick = aparar.
      if (e.timeStamp - stickToque.current < 300) toque.current.apara = true;
      stickToque.current = e.timeStamp;
      base.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
    }
    if (!base.current || base.current.id !== e.pointerId) return;
    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      base.current = null;
      stick.current = { x: 0, y: 0 };
      setKnob({ x: 0, y: 0, on: false });
      return;
    }
    const R = r.width * 0.38;
    let dx = e.clientX - base.current.x;
    let dy = e.clientY - base.current.y;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    stick.current = { x: dx / R, y: dy / R };
    setKnob({ x: dx, y: dy, on: true });
  };
  const botao = (k: 'soco' | 'agarra' | 'usa') => (e: React.PointerEvent) => {
    e.preventDefault();
    toque.current[k] = true;
    if (k === 'soco') socoPreso.current = true;
  };
  const soltouSoco = () => {
    socoPreso.current = false;
  };

  const trocarGore = () => {
    const v = !gore;
    setGore(v);
    localStorage.setItem(GORE_KEY, v ? '1' : '0');
  };
  const trocarSustos = () => {
    const v = !sustos;
    setSustos(v);
    localStorage.setItem(SUSTOS_KEY, v ? '1' : '0');
  };
  const trocarMovimento = () => {
    const p = proximaPref(prefMov);
    setPrefMov(p);
    salvarPrefMovimento(p);
    avisar(p === 'sistema' ? `Movimento: igual ao sistema (${sistemaReduz ? 'reduzido' : 'cheio'})` : p === 'reduzido' ? 'Movimento reduzido: sem tremor, clarão suave' : 'Movimento cheio: tremor e clarões');
  };
  // Fatia 10: só o dono (o admin da turma) troca a frequência dos eventos do bar inteiro (bar/config/eventos).
  const trocarEventos = () => {
    const atual = sanitizeConfig(barPresence.configEventosRaw()).mult;
    const ordem = [1, 2, 3, 0, 0.5];
    const prox = ordem[(ordem.indexOf(atual) + 1) % ordem.length] ?? 1;
    void barPresence
      .guardarConfigEventos(prox)
      .then((ok) => avisar(ok ? `Eventos do bar: ${prox === 0 ? 'desligados' : `×${String(prox).replace('.', ',')}`}` : 'Sem conexão com o bar: os eventos ficaram como estavam'));
  };
  const trocarSom = () => {
    const v = !som;
    setSom(v);
    setSoundEnabled(v);
  };

  // Fim de uma run de portal (Fatias 13 e 14): sorteia nas 3 primeiras do dia, paga, grava e sobe o placar do dia.
  const fimDoPortal = (id: IdPortal, r: { pontos: number; venceu: boolean; rainha?: boolean; fantasma?: string }) => {
    setPortalAberto(null);
    const dia = dayKey(barPresence.now());
    const semente = sementeDoDia(Number(dia), id);
    const inv = invRef.current;
    const feitas = runsHoje(inv, dia, id);
    const n = sorteiosDaRun(r.pontos, r.venceu, feitas, id);
    const sorteio = sorteiosDe(semente, player, feitas);
    const tem = new Set(inv.itens);
    let pity = inv.pity;
    let poG = inv.po.g;
    const saiu: Sorteado[] = [];
    for (let i = 0; i < n; i++) {
      const x = sortearPremio(id, pity, tem, sorteio(), sorteio());
      pity = x.pity;
      saiu.push(x.s);
      if (x.s.repetido) poG += x.s.po;
      else tem.add(x.s.premio.id);
    }
    const runs = inv.runs.dia === dia ? inv.runs.n : {};
    mudarInv({
      ...inv,
      itens: [...tem],
      po: { g: poG, s: inv.po.s },
      pity,
      runs: { dia, n: { ...runs, [id]: Math.min(RUNS_COM_SORTEIO, feitas + 1) } },
      ultima: { ...inv.ultima, [id]: Date.now() },
    });
    // Placar do dia: só sobe (o banco recusa baixar no mesmo dia).
    const meu = placarHoje(id).find((x) => x.id === player);
    if (!meu || r.pontos > meu.s) void barPresence.sendPlacar(id, r.pontos, r.fantasma ?? '', VERSAO_PORTAL[id]);
    const v = moedaDoPortal(id, r.pontos, r.venceu, r.rainha);
    if (v > 0) ganhar.current(v, id);
    const premios = saiu.map((x) => (x.repetido ? `${x.premio.nome}, que você já tinha (+${x.po} de Pó)` : `${x.premio.nome} (${NOME_RARIDADE[x.raridade]})!`));
    avisar(`${NOME_PORTAL[id]}: ${r.pontos} pontos, +R$ ${v}${premios.length ? ` · ${premios.join(' · ')}` : ''}`);
  };

  return (
    <main className={`vivo${foto ? ' vivo--foto' : ''}`} onContextMenu={(e) => e.preventDefault()}>
      <canvas ref={canvasRef} className="vivo-canvas" aria-label="O Bar Vivo: ande, brigue, zoe os amigos desmaiados" />
      <div className="vivo-hud">
        <div className="vivo-vida" aria-label={`Vida ${hud.vida}`}>
          <b style={{ color: PLAYER_BY_ID[player].color }}>{PLAYER_BY_ID[player].name}</b>
          <span className="vivo-barra">
            <i style={{ width: `${hud.vida}%` }} className={hud.vida < 35 ? 'is-low' : ''} />
          </span>
          <small>
            💀 {hud.nocautes}
            {hud.calor >= 2 ? ' · o Tonhão tá de olho' : ''}
          </small>
          {hud.happy && <small className="vivo-happy">🍻 happy hour</small>}
          {hud.arma && (
            <small className="vivo-arma">
              ✋ {hud.arma}
              <span className="vivo-dura" aria-label={`Durabilidade ${hud.usos} de ${hud.usosMax}`}>
                <i style={{ width: `${(100 * hud.usos) / Math.max(1, hud.usosMax)}%` }} className={hud.usos <= Math.max(1, hud.usosMax / 4) ? 'is-low' : ''} />
              </span>
              <em>{hud.usos}/{hud.usosMax}</em>
            </small>
          )}
          <small className="vivo-grana">💵 R$ {saldo(pontos, carteira)}</small>
        </div>
        <div className="vivo-menu">
          <button type="button" className={`icon-btn${chatAberto ? ' is-on' : ''}`} onClick={() => setChatAberto((v) => !v)} aria-label="Chat do bar (Enter)">
            <MessageCircle size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" onClick={() => setPainel(true)} aria-label="Visual do personagem">
            <Shirt size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" onClick={() => brindarAgora.current()} aria-label="Levantar o copo: brinde com quem estiver do lado (B)">
            <Beer size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" onClick={() => entrarFoto.current()} aria-label="Modo foto (P)">
            <Camera size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" onClick={() => setLivro(true)} aria-label="Livro do bar">
            <BookOpen size={18} aria-hidden="true" />
          </button>
          <button type="button" className="icon-btn" onClick={trocarSom} aria-label={som ? 'Tirar o som' : 'Ligar o som'}>
            {som ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
          </button>
          <button type="button" className={`icon-btn${gore ? ' is-on' : ''}`} onClick={trocarGore} aria-label={gore ? 'Modo sangue ligado: trocar por molho de tomate' : 'Molho de tomate: ligar o modo sangue'}>
            <Droplet size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`icon-btn${reduzidoRef.current ? '' : ' is-on'}`}
            onClick={trocarMovimento}
            aria-label={`Tremor e clarões: ${prefMov === 'sistema' ? 'igual ao sistema' : prefMov} (${reduzidoRef.current ? 'reduzido' : 'cheio'}). Trocar`}
          >
            <Activity size={18} aria-hidden="true" />
          </button>
          <button type="button" className={`icon-btn${sustos ? ' is-on' : ''}`} onClick={trocarSustos} aria-label={sustos ? 'Sustos do banheiro ligados: desligar' : 'Sustos do banheiro desligados: ligar'}>
            <Ghost size={18} aria-hidden="true" />
          </button>
          {player === ADMIN && (
            <button type="button" className="icon-btn" onClick={trocarEventos} aria-label="Frequência dos eventos do bar (só o dono). Trocar">
              <Sparkles size={18} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onExit} aria-label="Sair do bar">
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="medidor-quadro" ref={medidorRef} hidden aria-live="off" />
      {hud.dica && <p className="vivo-dica">{hud.dica}</p>}
      {chatAberto ? (
        <form
          className="vivo-chat"
          onSubmit={(e) => {
            e.preventDefault();
            void mandarChat();
          }}
        >
          <div className="vivo-chat-log" aria-label="Conversa do bar">
            {chat.slice(-8).map((c) => (
              <p key={`${c.p}-${c.t}`}>
                <b style={{ color: PLAYER_BY_ID[c.p].color }}>{PLAYER_BY_ID[c.p].name}:</b> {c.m}
              </p>
            ))}
            {!chat.length && <p className="vivo-chat-vazio">Ninguém falou nada ainda.</p>}
          </div>
          <div className="vivo-chat-linha">
            <input
              autoFocus
              maxLength={140}
              value={chatTexto}
              onChange={(e) => setChatTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setChatAberto(false);
              }}
              placeholder="Fala aí (Enter manda, Esc fecha)"
              aria-label="Mensagem"
            />
            <button type="submit" className="btn btn-primary">Enviar</button>
            <button type="button" className="icon-btn" onClick={() => setChatAberto(false)} aria-label="Fechar o chat">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : (
        <div className="vivo-chat-recentes" aria-live="polite">
          {chat
            .filter((c) => relogioChat - c.t < 20_000 && relogioChat - c.t > -5_000)
            .slice(-3)
            .map((c) => (
              <p key={`${c.p}-${c.t}`}>
                <b style={{ color: PLAYER_BY_ID[c.p].color }}>{PLAYER_BY_ID[c.p].name}:</b> {c.m}
              </p>
            ))}
        </div>
      )}
      {zoado && !foto && (
        <div className="vivo-zoado" role="status">
          <p>
            🖊️ {zoado.quem} te zoou enquanto você dormia: {textoPegadinha(zoado.n)}. Os amigos estão vendo.
          </p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              limparCara.current();
              setZoado(null);
            }}
          >
            Limpar a cara
          </button>
        </div>
      )}
      {foto && (
        <div className="vivo-fotobar" role="toolbar" aria-label="Modo foto">
          {(
            [
              [null, 'Como está'],
              ['front', 'De pé'],
              ['punch', 'Soco'],
              ['sit', 'Sentado'],
              ['ko-flat', 'Caído'],
            ] as [PoseBoneco | null, string][]
          ).map(([p, nome]) => (
            <button key={nome} type="button" className={`btn${fotoPose === p ? ' is-on' : ''}`} onClick={() => posar(p)}>
              {nome}
            </button>
          ))}
          <button type="button" className="btn btn-primary" onClick={salvarFoto}>
            Salvar foto
          </button>
          <button type="button" className="btn" onClick={sairFoto}>
            Voltar
          </button>
        </div>
      )}
      {livro && (
        <Modal titulo="Livro do bar" id="vivo-livro" onClose={() => setLivro(false)}>
          {(() => {
            const linhas = livroDoBar(barPresence.barRaw());
            const agora = barPresence.now();
            return linhas.length ? (
              <ol className="vivo-livro">
                {linhas.map((l, i) => (
                  <li key={i}>
                    <span aria-hidden="true">{l.ic}</span> {l.texto} <small>{haQuanto(l.t, agora)}</small>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="bar-note">Ainda não aconteceu nada que valha registro. Vai lá fazer história.</p>
            );
          })()}
        </Modal>
      )}
      {jogo === 'porrinha' && <PorrinhaPanel onClose={fecharJogo} onFim={fimPorrinha} />}
      {jogo === 'mural' && (
        <Modal titulo="Mural de boatos" id="vivo-mural" onClose={fecharJogo}>
          {(() => {
            const b = muralDoDia(livroDoBar(barPresence.barRaw()), diaBrasilia(Date.now()));
            return b.length ? (
              <ol className="vivo-livro">
                {b.map((x, i) => (
                  <li key={i}>
                    <span aria-hidden="true">🗣️</span> {x.texto}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="bar-note">Ninguém fez nada digno de fofoca ainda. O quadro do fiado tá limpo… por enquanto.</p>
            );
          })()}
          <p className="bar-note">Todo boato aqui saiu de algo que aconteceu de verdade no bar. Troca todo dia.</p>
        </Modal>
      )}
      {radio && (
        <p className="vivo-radio" role="status">
          <span aria-hidden="true">📻</span> {radio}
        </p>
      )}
      <div className="vivo-avisos" role="status">
        {avisos.map((a) => (
          <p key={a.id}>{a.texto}</p>
        ))}
      </div>
      {hud.ko && <p className="vivo-ko">NOCAUTEADO</p>}
      <div className="vivo-stick" onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick} aria-hidden="true">
        <span style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} className={knob.on ? 'is-on' : ''} />
      </div>
      <div className="vivo-botoes">
        <button type="button" className="vivo-b vivo-b-usa" onPointerDown={botao('usa')} aria-label="Usar (E)">
          E
        </button>
        <button
          type="button"
          className="vivo-b vivo-b-agarra"
          onPointerDown={botao('agarra')}
          aria-label={hud.tipo ? `Jogar fora: ${hud.arma} (K)` : 'Agarrar ou arremessar (K)'}
        >
          {hud.tipo ? '🗑️' : '✊'}
        </button>
        <button
          type="button"
          className={`vivo-b vivo-b-soco${hud.tipo ? ' is-item' : ''}${hud.tipo && hud.usos / Math.max(1, hud.usosMax) <= 0.25 ? ' is-acabando' : ''}`}
          style={hud.tipo ? ({ '--dura': String(Math.min(1, hud.usos / Math.max(1, hud.usosMax))) } as React.CSSProperties) : undefined}
          onPointerDown={botao('soco')}
          onPointerUp={soltouSoco}
          onPointerCancel={soltouSoco}
          onPointerLeave={soltouSoco}
          aria-label={hud.tipo ? `Bater com ${hud.arma}: ${hud.usos} de ${hud.usosMax} usos (J)` : 'Soco (J)'}
        >
          {hud.tipo ? ICONE_ARMA[hud.tipo] : '👊'}
        </button>
      </div>
      <p className="vivo-teclas">WASD/setas anda · J soco (3 seguidos = empurrão; segure para carregar) · K agarra/arremessa · L apara · E usa</p>
      {painel && (
        <VisualPanel
          player={player}
          value={visual}
          onChange={(v) => {
            setVisual(v);
            salvar(player, v);
          }}
          onClose={() => setPainel(false)}
          liberadas={coresLiberadas(inv)}
          trofeus={barPresence.trofeusRaw()}
        />
      )}
      {jogo === 'palavra' && <DailyPanel player={player} onClose={fecharJogo} say={avisar} />}
      {jogo === 'anagrama' && <AnagramPanel player={player} onClose={fecharJogo} say={avisar} />}
      {jogo === 'jukebox' && (
        <Modal titulo="Jukebox" id="vivo-jukebox" onClose={fecharJogo}>
          <p className="bar-note">
            🎵 Escolha a música do bar: todo mundo no salão escuta junto.{' '}
            {juke ? (juke.s < 0 ? `Desligada por ${PLAYER_BY_ID[juke.p as PlayerId]?.name ?? juke.p}.` : `Escolhida por ${PLAYER_BY_ID[juke.p as PlayerId]?.name ?? juke.p}.`) : 'Ninguém escolheu: toca a da hora.'}
          </p>
          <ul className="vivo-juke">
            {FAIXAS.map((f, i) => {
              const agora = juke ? juke.s === i : faixaDaHora(barPresence.now()) === i;
              return (
                <li key={f.id}>
                  <button type="button" className={`btn${agora ? ' btn-primary' : ''}`} onClick={() => void escolherFaixa(i)} aria-pressed={agora}>
                    {agora ? '▶ ' : ''}
                    {f.name}
                    <small> · {f.bpm} bpm</small>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="vivo-juke-acoes">
            <button type="button" className="btn" onClick={() => void escolherFaixa(-1)}>
              ⏹ Desligar
            </button>
            <button type="button" className="btn" onClick={() => setJogo('anagrama')}>
              🔤 Anagrama da Saideira
            </button>
          </div>
          {!som && <p className="bar-note">Seu som está desligado (botão do alto-falante).</p>}
        </Modal>
      )}
      {jogo === 'quiz' && <QuizPanel player={player} onClose={fecharJogo} say={avisar} />}
      {jogo === 'cruzadas' && (
        <Modal titulo="Caderneta de cruzadas" id="vivo-mesa" onClose={fecharJogo}>
          <div className="segmented" role="radiogroup" aria-label="Nível">
            {LEVELS.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={level === l.id} className={level === l.id ? 'is-on' : ''} onClick={() => setLevel(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <label className="bar-field">
            Tema
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value={ALL_PACK.id}>{ALL_PACK.name}</option>
              {THEME_PACKS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => {
                setJogo(null);
                onPlay(theme, level);
              }}
            >
              Encostar no balcão e jogar
            </button>
          </div>
          <p className="bar-note">Seu Zé empresta a caneta (e cobra). Ao terminar, você volta para o bar.</p>
        </Modal>
      )}
      {(jogo === 'bilhar1' || jogo === 'bilhar2') && (
        <Modal titulo={`Sinuca · mesa ${jogo === 'bilhar1' ? 1 : 2}`} id="vivo-sinuca" onClose={fecharJogo}>
          <SinucaPanel player={player} i={jogo === 'bilhar1' ? 0 : 1} avisar={avisar} />
        </Modal>
      )}
      {jogo === 'portal' && (
        <Modal titulo="Portal do Rocky" id="vivo-portal" onClose={fecharJogo}>
          <p className="bar-note">
            Rocky: — Ô, cê aí! Achei uma dimensão onde carro não tem freio e boleto não tem vencimento. A Dimensão GFA. 90
            segundos, você dirige, eu… eu seguro o portal. Acho.
          </p>
          <p className="bar-note">
            R$ 5 por morte, sem teto, e bônus a cada marco (10, 25, 50 e 100). Tudo entra na sua ficha de procurado. Com 2
            boletos a polícia atira e tira a sua vida; cercado ou com o carro destruído, perde metade. Poste, banca, cone e
            vitrine quebram; carro com a vida zerada explode. Setas ou WASD dirigem, espaço freia.
          </p>
          <div className="modal-actions">
            {podePortal(portalEm, Date.now()) ? (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => {
                  setJogo(null);
                  setGfa(true);
                }}
              >
                Entrar no portal
              </button>
            ) : (
              <p className="bar-note">
                Rocky: — O portal tá recarregando. Volta em {Math.ceil((portalEm + ESPERA_PORTAL_MS - Date.now()) / 60000)} min.
              </p>
            )}
          </div>
          {(() => {
            // O portal do dia, sorteado pelo dia do bar entre os portais da lista (nunca o mesmo de ontem). Em
            // desenvolvimento dá para forçar o outro (`__vivo.portal('quermesse')`).
            const dia = dayKey(barPresence.now());
            const id = (import.meta.env.DEV && portalForcado) || portalDoDia(Number(dia), PORTAIS_DO_DIA);
            const feitas = runsHoje(inv, dia, id);
            const ultima = inv.ultima[id] ?? 0;
            const faltam = PREMIOS.filter((x) => x.portal === id && !inv.itens.includes(x.id));
            const saldoP = saldoPo(inv);
            return (
              <section className="vivo-portal-dia" aria-label="Portal do dia">
                <h3 className="section-title">Portal do dia: {NOME_PORTAL[id]}</h3>
                <p className="bar-note">
                  {id === 'moscas'
                    ? 'Rocky: — Esse aqui eu abro um diferente por dia. Hoje é a Moscaria: você de garçom, moscas do tamanho de um cachorro, chinelo que bate sozinho. 100 segundos. Todo mundo do bar pega as mesmas ondas hoje.'
                    : id === 'churrasco'
                      ? 'Rocky: — Esse aqui eu abro um diferente por dia. Hoje é o Churrasco Jurássico: você corre sozinho com o espeto, um botão pula. Osso e lava, pula; pterodáctilo baixo, passa por baixo. 3 espetos, uns 70 segundos. Todo mundo do bar corre a mesma pista hoje.'
                      : 'Rocky: — Esse aqui eu abro um diferente por dia. Hoje é a Quermesse Maluca: barraca atrás de barraca, 5 segundos cada, instrução de uma palavra. 3 fogueiras, 2 minutos. Todo mundo do bar pega a mesma sequência hoje.'}
                </p>
                <p className="bar-note">
                  {id === 'moscas'
                    ? 'Moeda por pontos (sem teto), +R$ 20 se sobreviver e +R$ 40 pela rainha.'
                    : id === 'churrasco'
                      ? 'R$ 1 a cada 3 pontos (sem teto) e +R$ 20 se chegar na churrasqueira.'
                      : 'R$ 3 por ponto (sem teto) e +R$ 20 se chegar ao fim com fogueira acesa.'}{' '}
                  As {RUNS_COM_SORTEIO} primeiras do dia
                  sorteiam peças novas: cores de roupa e cabelo e chapéus ({Math.max(0, RUNS_COM_SORTEIO - feitas)} restando hoje). Peça repetida vira Pó
                  de Dimensão: <b>{saldoP}</b> de Pó. Coleção: {PREMIOS.filter((x) => x.portal === id).length - faltam.length} de{' '}
                  {PREMIOS.filter((x) => x.portal === id).length}.
                </p>
                {(() => {
                  const pl = placarHoje(id);
                  return pl.length ? (
                    <p className="bar-note">
                      Placar de hoje: {pl.map((x) => `${x.nome} ${x.s}`).join(' · ')}.{' '}
                      {id === 'moscas' ? 'Quem já jogou hoje aparece como fantasma na sua run.' : 'Na sua run, a barra mostra até onde cada um chegou.'}
                    </p>
                  ) : null;
                })()}
                {saldoP >= PO_PRECO && faltam.length > 0 && (
                  <div className="vivo-po">
                    {faltam.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        className="btn"
                        onClick={() => {
                          const novo = comprarComPo(inv, x.id);
                          if (!novo) return;
                          mudarInv(novo);
                          avisar(`Trocou ${PO_PRECO} de Pó por: ${x.nome}. Já dá para vestir no Visual.`);
                        }}
                      >
                        {x.peca === 'chapeu' ? (
                          <span className="vivo-po-cor vivo-po-chapeu" aria-hidden="true">
                            {ICONE_CHAPEU[x.cor]}
                          </span>
                        ) : (
                          <span className="vivo-po-cor" style={{ background: x.cor }} aria-hidden="true" />
                        )}{' '}
                        {x.nome} ({NOME_RARIDADE[x.raridade]}) · {PO_PRECO} de Pó
                      </button>
                    ))}
                  </div>
                )}
                <div className="modal-actions">
                  {podeEntrar(ultima, Date.now()) ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-lg"
                      onClick={() => {
                        setJogo(null);
                        if (id === 'moscas') setFantasmasMc(placarHoje('moscas').filter((x) => x.id !== player && x.pts.length));
                        else setAmigosQm(placarHoje(id).filter((x) => x.id !== player).map(({ nome, cor, s }) => ({ nome, cor, s })));
                        setPortalAberto(id);
                      }}
                    >
                      Entrar: {NOME_PORTAL[id]}
                    </button>
                  ) : (
                    <p className="bar-note">Rocky: — Esse também tá recarregando. Volta em {Math.ceil((ultima + ESPERA_MS - Date.now()) / 60000)} min.</p>
                  )}
                </div>
              </section>
            );
          })()}
        </Modal>
      )}
      {portalAberto === 'moscas' && (
        <Suspense fallback={<div className="gfa gfa-carregando">Abrindo o portal…</div>}>
          <MoscasTela
            look={lookDe(player, visual)}
            semente={sementeDoDia(Number(dayKey(barPresence.now())), 'moscas')}
            fantasmas={fantasmasMc}
            onFim={(r: ResultadoMoscas) => fimDoPortal('moscas', { pontos: r.pontos, venceu: r.venceu, rainha: r.rainha, fantasma: r.fantasma })}
          />
        </Suspense>
      )}
      {portalAberto === 'churrasco' && (
        <Suspense fallback={<div className="gfa gfa-carregando">Abrindo o portal…</div>}>
          <ChurrascoTela
            semente={sementeDoDia(Number(dayKey(barPresence.now())), 'churrasco')}
            amigos={amigosQm}
            onFim={(r: ResultadoChurrasco) => fimDoPortal('churrasco', { pontos: r.pontos, venceu: r.venceu })}
          />
        </Suspense>
      )}
      {portalAberto === 'quermesse' && (
        <Suspense fallback={<div className="gfa gfa-carregando">Abrindo o portal…</div>}>
          <QuermesseTela
            semente={sementeDoDia(Number(dayKey(barPresence.now())), 'quermesse')}
            amigos={amigosQm}
            onFim={(r: ResultadoQuermesse) => fimDoPortal('quermesse', { pontos: r.pontos, venceu: r.venceu })}
          />
        </Suspense>
      )}
      {gfa && (
        <Suspense fallback={<div className="gfa gfa-carregando">Abrindo o portal…</div>}>
          <GfaTela
            looks={LOOKS_GFA}
            gore={gore}
            onFim={(r: ResultadoGfa) => {
              setGfa(false);
              const agora = Date.now();
              setPortalEm(agora);
              localStorage.setItem(PORTAL_KEY, String(agora));
              if (r.grana > 0) ganhar.current(r.grana, 'gfa');
              if (r.mortes > 0) contarMortes.current(r.mortes);
              avisar(`Voltou da Dimensão GFA: ${r.mortes} atropelo${r.mortes === 1 ? '' : 's'}, +R$ ${r.grana}${r.destruido ? ' (carro destruído: metade)' : r.presa ? ' (preso pelos boletos: metade)' : ''}`);
            }}
          />
        </Suspense>
      )}
      {jogo === 'mercado' && (
        <Modal titulo="Mercado negro do beco" id="vivo-mercado" onClose={fecharJogo}>
          <p className="bar-note">
            Muambeiro: — Psiu. Mercadoria boa, sem nota. Saldo: <b>R$ {saldo(pontos, carteira)}</b> ({pontos} pts do placar ÷ 10 + R$ {carteira.a} achados − R$ {carteira.g}{' '}
            gastos).
          </p>
          {(() => {
            const r = resumoCaixa(caixa, Date.now());
            const NOME: Record<string, string> = { chao: 'chão', gfa: 'GFA', evento: 'eventos', moscas: 'Moscaria', quermesse: 'Quermesse', brinde: 'brindes' };
            return (
              <p className="bar-note vivo-caixa">
                Livro do caixa: hoje <b>+R$ {r.hoje.entrou}</b>
                {r.hoje.origens.length > 0 && ` (${r.hoje.origens.map(([o, v]) => `${NOME[o] ?? o} ${v}`).join(', ')})`} e <b>−R$ {r.hoje.saiu}</b>; em 7 dias +R$ {r.semana.entrou} e −R$ {r.semana.saiu}.
              </p>
            );
          })()}
          {(() => {
            // Fatia 10: prateleira de troféus dos eventos (quem já ganhou cada um).
            const tr = barPresence.trofeusRaw() as Record<string, Record<string, unknown> | undefined>;
            // Fatia 15: os 5 troféus (os 3 do alienígena, da Fatia 11, não estavam na prateleira).
            const NOMES: Record<string, string> = TROFEU_NOME;
            const itens = Object.entries(NOMES).map(([k, nome]) => {
              const quem = Object.keys(tr?.[k] ?? {})
                .filter((q): q is PlayerId => q in PLAYER_BY_ID)
                .map((q) => PLAYER_BY_ID[q].name);
              return `${nome} (${quem.length ? quem.join(', ') : 'ninguém ainda'})`;
            });
            return <p className="bar-note vivo-trofeus">Prateleira do bar: {itens.join(' · ')}.</p>;
          })()}
          <ul className="vivo-loja">
            {CATALOGO.map((it) => {
              const pode = saldo(pontos, carteira) >= it.preco;
              return (
                <li key={it.arma}>
                  <div>
                    <b>{ARMAS[it.arma].nome}</b> <small>{ficha(it.arma)}</small>
                    <p>{it.papo}</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!pode}
                    onClick={() => {
                      const naMao = mundo.current ? eu(mundo.current).arma?.tipo : undefined;
                      if (mundo.current && ehPoder(eu(mundo.current).arma?.tipo)) {
                        avisar(`Use ${naMao ? ARMAS[naMao].nome : 'o poder'} antes de comprar outra coisa (poder não sai da mão).`);
                        return;
                      }
                      const r = comprar(pontos, carteiraRef.current, it.arma);
                      if (!r.ok) {
                        avisar(r.motivo);
                        return;
                      }
                      mudarCarteira(r.carteira);
                      lancarCaixa('s', it.arma, it.preco);
                      if (mundo.current) equipar(mundo.current, it.arma);
                      // O poder sobrevive a recarregar a página até ser disparado.
                      if (ehPoder(it.arma)) localStorage.setItem(RAJADA_KEY, it.arma);
                      tocar('pega');
                      fecharJogo();
                    }}
                  >
                    R$ {it.preco}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="bar-note">Acaba com o uso: cada golpe gasta um, arremessar gasta tudo. Grana vem do placar e do que cai de quem você derruba.</p>
        </Modal>
      )}
      {jogo === 'placar' && (
        <Modal titulo="Lousa do placar" id="vivo-placar" onClose={fecharJogo}>
          <div className="segmented period-switch" role="radiogroup" aria-label="Período do placar">
            {PERIODS.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={period === p.id} className={period === p.id ? 'is-on' : ''} onClick={() => onPeriod(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <Arena rows={rows} hit={hit} me={player} />
          <p className="bar-note">
            Cada 10 pontos do placar valem R$ 1 no mercado negro do beco. Sua ficha de hoje no bar: {hud.nocautes} {hud.nocautes === 1 ? 'nocaute' : 'nocautes'} (não vale nada, só moral).
          </p>
        </Modal>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ Fatia 15: contas do dia no aparelho */

const hojeDe = () => dayKey(barPresence.now());
function lerConta(chave: string): { dia: string; n: Record<string, number> } {
  try {
    const v = JSON.parse(localStorage.getItem(chave) ?? 'null') as { dia?: unknown; n?: unknown } | null;
    if (v && v.dia === hojeDe() && v.n && typeof v.n === 'object') return { dia: v.dia as string, n: v.n as Record<string, number> };
  } catch {
    /* lixo no armazenamento: recomeça */
  }
  return { dia: hojeDe(), n: {} };
}
function somar(chave: string, k: string) {
  const c = lerConta(chave);
  c.n[k] = (c.n[k] ?? 0) + 1;
  localStorage.setItem(chave, JSON.stringify(c));
}
const contaPegadinhas = (eu: string, alvo: string) => lerConta(`cruzadabotecos.pegadinhas.v1.${eu}`).n[alvo] ?? 0;
const somarPegadinha = (eu: string, alvo: string) => somar(`cruzadabotecos.pegadinhas.v1.${eu}`, alvo);
const contaBrindes = (eu: string) => lerConta(`cruzadabotecos.brindes.v1.${eu}`).n.todos ?? 0;
const somarBrinde = (eu: string) => somar(`cruzadabotecos.brindes.v1.${eu}`, 'todos');
// Fatia 20: a memória dos NPCs fica no aparelho (cada um lembra do que VOCÊ fez).
const MEMORIA_KEY = (eu: string) => `cruzadabotecos.memoria.v1.${eu}`;
function carregarMemoria(eu: string): Memoria {
  try {
    return sanitizeMemoria(JSON.parse(localStorage.getItem(MEMORIA_KEY(eu)) ?? 'null'));
  } catch {
    return {};
  }
}
function salvarMemoria(eu: string, m: Memoria) {
  try {
    localStorage.setItem(MEMORIA_KEY(eu), JSON.stringify(m));
  } catch {
    /* sem localStorage: a memória vive só nesta visita */
  }
}
// Fatia 18: partidas de Porrinha que pagaram hoje.
const contaPorrinha = (eu: string) => lerConta(`cruzadabotecos.porrinha.v1.${eu}`).n.todos ?? 0;
const somarPorrinha = (eu: string) => somar(`cruzadabotecos.porrinha.v1.${eu}`, 'todos');
/** O dia em Brasília (o mural troca à meia-noite de lá, igual para todo mundo). */
const diaBrasilia = (t: number) => new Date(t - 3 * 3_600_000).toISOString().slice(0, 10);

/**
 * Fatia 18: a Porrinha na mesa do salão, contra o Biriba e o Tiozão do pagode. Cada um esconde de 0 a 3 tampinhas;
 * na vez, canta o total (sem repetir o de ninguém); quem acerta sai da mesa; o último paga a rodada. A mesa joga no
 * seu aparelho (os NPCs palpitam pela função pura `palpiteNpc`).
 */
function PorrinhaPanel({ onClose, onFim }: { onClose: () => void; onFim: (escapou: boolean) => void }) {
  const r = useRef(rngMesa((Date.now() ^ 0x9071) >>> 0));
  const jogo = useRef<Porrinha>(novaPorrinha(['eu', ...PORRINHA_MESA], Math.floor(r.current() * 3)));
  const maos = useRef<Record<string, number>>({});
  const [, setVersao] = useState(0);
  const [log, setLog] = useState<string[]>(['Biriba: — Senta aí. Esconde as tampinhas na mão e canta o total.']);
  const [fim, setFim] = useState<string | null>(null);
  const reler = () => setVersao((v) => v + 1);
  const e = jogo.current;
  const nome = (q: string) => PORRINHA_NOME[q] ?? q;
  const fala = (...l: string[]) => setLog((x) => [...x, ...l].slice(-8));
  // NPCs cantam até chegar a sua vez (ou todo mundo ter cantado: aí abre as mãos).
  const mesaJoga = () => {
    const out: string[] = [];
    for (let q = vezDe(e); q && q !== 'eu'; q = vezDe(e)) {
      const p = palpiteNpc(e, maos.current[q], r.current);
      palpitar(e, q, p);
      out.push(`${nome(q)}: — ${p}!`);
    }
    if (!vezDe(e)) out.push(...abrir());
    fala(...out);
    reler();
  };
  const abrir = (): string[] => {
    const mostra = e.vivos.map((q) => `${nome(q)} ${maos.current[q]}`).join(', ');
    const { total, acertou } = revelar(e);
    const l = [`Mãos: ${mostra} = ${total}.`, acertou ? `${nome(acertou)} cantou certo e sai da mesa!` : 'Ninguém acertou. Mais uma.'];
    if (acertou === 'eu') {
      setFim('Você escapou! Quem sobrar paga a rodada.');
      onFim(true);
    } else if (e.perdedor === 'eu') {
      setFim(`Sobrou pra você. A rodada é sua (R$ ${PORRINHA_RODADA}).`);
      onFim(false);
    } else if (e.perdedor) setFim(`Sobrou pro ${nome(e.perdedor)}.`);
    return l;
  };
  const esconderMao = (n: number) => {
    maos.current = Object.fromEntries(e.vivos.map((q) => [q, q === 'eu' ? n : maoNpc(r.current)]));
    esconder(e, maos.current);
    fala(`Rodada ${e.rodada}: você escondeu ${n}.`);
    mesaJoga();
  };
  const cantar = (n: number) => {
    const ok = palpitar(e, 'eu', n);
    if (!ok.ok) return fala(ok.motivo);
    fala(`Você: — ${n}!`);
    mesaJoga();
  };
  const minhaVez = vezDe(e) === 'eu';
  return (
    <Modal titulo="Porrinha" id="vivo-porrinha" onClose={onClose}>
      <ol className="vivo-livro">
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
      {fim ? (
        <p className="bar-note">
          <b>{fim}</b>
        </p>
      ) : !e.maos ? (
        <div className="bar-actions">
          <span className="bar-note">Quantas tampinhas na mão?</span>
          {Array.from({ length: PORRINHA_MAX_MAO + 1 }, (_, n) => (
            <button key={n} type="button" className="pixel-button" onClick={() => esconderMao(n)}>
              {n}
            </button>
          ))}
        </div>
      ) : minhaVez ? (
        <div className="bar-actions">
          <span className="bar-note">Sua vez de cantar o total (você tem {maos.current.eu}):</span>
          {palpitesLivres(e).map((n) => (
            <button key={n} type="button" className="pixel-button" onClick={() => cantar(n)}>
              {n}
            </button>
          ))}
        </div>
      ) : null}
      <p className="bar-note">
        Na mesa: {e.vivos.map(nome).join(', ')}. Quem fica por último paga R$ {PORRINHA_RODADA}; quem escapa ganha a rodada (até {PORRINHA_PAGAS_DIA} por dia).
      </p>
    </Modal>
  );
}
void PEGADINHAS_DIA;

function Modal({ titulo, id, onClose, children }: { titulo: string; id: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal bar-modal" role="dialog" aria-modal="true" aria-labelledby={id} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn bar-modal-x" onClick={onClose} aria-label="Fechar">
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id={id} className="section-title">
          <span className="serif">{titulo}</span>
        </h2>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ painel de visual */

function Preview({ L }: { L: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = buildBarGridLook(L, 'front');
    const r = gridRaster(g, false, false);
    c.width = r.w;
    c.height = r.h;
    c.getContext('2d')!.putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
  }, [L]);
  return <canvas ref={ref} className="vivo-preview" aria-hidden="true" />;
}

function Opcao<T>({ rotulo, lista, valor, nome, onChange }: { rotulo: string; lista: readonly T[]; valor: T; nome: (v: T) => string; onChange: (v: T) => void }) {
  const i = Math.max(0, lista.indexOf(valor));
  const ir = (d: number) => onChange(lista[(i + d + lista.length) % lista.length]);
  return (
    <div className="vivo-opcao">
      <span>{rotulo}</span>
      <button type="button" className="icon-btn" onClick={() => ir(-1)} aria-label={`${rotulo}: anterior`}>
        ◀
      </button>
      <b>{nome(lista[i])}</b>
      <button type="button" className="icon-btn" onClick={() => ir(1)} aria-label={`${rotulo}: próximo`}>
        ▶
      </button>
    </div>
  );
}

function Cores({ rotulo, lista, valor, onChange }: { rotulo: string; lista: readonly string[]; valor: string; onChange: (c: string) => void }) {
  return (
    <div className="vivo-cores" role="radiogroup" aria-label={rotulo}>
      <span>{rotulo}</span>
      {lista.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={c === valor} aria-label={c} className={c === valor ? 'is-on' : ''} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

function VisualPanel({ player, value, onChange, onClose, liberadas, trofeus }: { player: PlayerId; value: Visual; onChange: (v: Visual) => void; onClose: () => void; liberadas: Set<string>; trofeus: unknown }) {
  const L = lookDe(player, value);
  // Fatia 13: cor de prêmio de portal só aparece para quem ganhou.
  const premio = new Set(PREMIOS.map((p) => p.cor));
  const ver = (lista: readonly string[]) => lista.filter((c) => !premio.has(c) || liberadas.has(c));
  const set = (p: Partial<Visual>) => onChange({ ...value, ...p });
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal bar-modal vivo-visual" role="dialog" aria-modal="true" aria-labelledby="vivo-visual-t" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="icon-btn bar-modal-x" onClick={onClose} aria-label="Fechar">
          <X size={18} aria-hidden="true" />
        </button>
        <h2 id="vivo-visual-t" className="section-title">
          <span className="serif">Visual de {PLAYER_BY_ID[player].name}</span>
        </h2>
        <Preview L={L} />
        <Cores rotulo="Camisa" lista={ver(CAMISAS)} valor={L.shirt} onChange={(c) => set({ camisa: c })} />
        <Cores rotulo="Calça" lista={ver(CALCAS)} valor={L.pants} onChange={(c) => set({ calca: c })} />
        <Cores rotulo="Cabelo" lista={ver(CABELOS)} valor={L.hair} onChange={(c) => set({ cabelo: c })} />
        <Opcao rotulo="Corte" lista={CORTES} valor={L.hairStyle} nome={(v) => NOMES[v]} onChange={(v) => set({ corte: v })} />
        <Opcao rotulo="Barba" lista={BARBAS} valor={L.beard ?? 'nenhuma'} nome={(v) => NOMES[v]} onChange={(v) => set({ barba: v as Visual['barba'] })} />
        <Opcao rotulo="Acessório" lista={ACESSORIOS} valor={L.extra ?? 'nenhum'} nome={(v) => NOMES[v]} onChange={(v) => set({ acessorio: v as Visual['acessorio'] })} />
        <Opcao rotulo="Óculos" lista={OCULOS} valor={L.glasses ?? 'com'} nome={(v) => NOMES[v]} onChange={(v) => set({ oculos: v as Visual['oculos'] })} />
        <Opcao rotulo="Perna" lista={[false, true] as const} valor={!!L.shorts} nome={(v) => (v ? 'Bermuda' : 'Calça')} onChange={(v) => set({ bermuda: v })} />
        {/* Fatia 16: chapéu (só os ganhos nos portais) e título (só os dos seus troféus). */}
        <Opcao
          rotulo="Chapéu"
          lista={CHAPEUS.filter((c) => c === 'nenhum' || liberadas.has(c) || c === value.chapeu)}
          valor={L.hat ?? 'nenhum'}
          nome={(v) => (v === 'nenhum' ? 'Sem chapéu' : NOMES[v])}
          onChange={(v) => set({ chapeu: v as Visual['chapeu'] })}
        />
        <Opcao
          rotulo="Título"
          lista={titulosDe(player, trofeus).map((t) => t.id)}
          valor={titulosDe(player, trofeus).some((t) => t.id === value.titulo) ? (value.titulo as IdTitulo) : 'nenhum'}
          nome={(v) => titulosDe(player, trofeus).find((t) => t.id === v)?.nome ?? v}
          onChange={(v) => set({ titulo: v })}
        />
        <p className="bar-note">
          Peças dos portais: {PREMIOS.filter((p) => liberadas.has(p.cor)).length} de {PREMIOS.length} ganhas. Elas caem nos portais do dia (Moscaria e Quermesse Maluca, no Rocky). Os títulos vêm dos
          troféus da prateleira.
        </p>
        <button type="button" className="btn" onClick={() => onChange({})}>
          Voltar ao visual de sempre
        </button>
      </div>
    </div>
  );
}
