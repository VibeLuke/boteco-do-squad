/**
 * Dimensão GFA ("Grand Fiado Auto"), a tela (Fatia 4, lote F). Carregada só quando o portal abre (import dinâmico):
 * o three.js fica num pedaço à parte e não pesa no bar. A simulação vem de ./simulacao (pura); aqui só se desenha.
 *
 * Desenho: cidade baixa em polígonos chapados, renderizada em resolução baixa e esticada sem suavizar (cara de pixel),
 * pedestres como placas com os próprios bonecos do bar, carro e viaturas de caixas.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { buildBarGridLook, buildPedacoGridLook, cortarGrid, polir, type Look } from '../arena/sprites';
import { Medidor, medidorLigado, textoMedidor } from '../vivo/medidor';
import { BRILHO_REDUZIDO, LimiteClarao, movimentoReduzido } from '../vivo/movimento';
import { tocar } from '../vivo/som';
import { clarao, COR_OBJETO, despedacar, emDerrapagem, estilhacar, explosao, faiscas, linhasVelocidade, luzSirene, novoFx, passoFx, quebrarObjeto as quebrarFx, respingo, MAX_DETRITOS, MAX_PARTICULAS, MAX_PEDACOS_GFA, type ParteGfa, type Particula } from './fx';
import './gfa6.css';
import { tocarTrilha, type Trilha } from './trilha';
import {
  BLOCO,
  BLOCOS,
  CALCADA,
  DT_GFA,
  MUNDO,
  N_CIVIS,
  RUA,
  VEL_MAX,
  alturaPredio,
  novoGfa,
  passoGfa,
  premio,
  proximoMarco,
  TIPOS_OBJETO,
  VIDA_MAX,
  type Entrada,
  type Gfa,
  type TipoObjeto,
} from './simulacao';

export interface ResultadoGfa {
  grana: number;
  mortes: number;
  presa: boolean;
  /** Fatia 6: o carro explodiu (vida zero); leva metade da grana, como na prisão. */
  destruido?: boolean;
}

interface Props {
  /** Aparências dos pedestres (os NPCs do bar) e a sua. */
  looks: Look[];
  /** Modo sangue: sangue de verdade ou molho de tomate. */
  gore: boolean;
  onFim: (r: ResultadoGfa) => void;
}

type Fase = 'intro' | 'corrida' | 'fim';

/** O boneco do bar numa textura (para a placa do pedestre). */
function texturaBoneco(L: Look, pose: 'front' | 'front-a' | 'front-b'): unknown {
  const g = polir(buildBarGridLook(L, pose));
  const cv = document.createElement('canvas');
  cv.width = g[0].length;
  cv.height = g.length;
  const ctx = cv.getContext('2d')!;
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y].length; x++) {
      const c = g[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Uma grade de pixels numa textura (pedaço, tronco). */
function texturaGrid(g: (string | null | undefined)[][]): unknown {
  const cv = document.createElement('canvas');
  cv.width = g[0]?.length ?? 1;
  cv.height = g.length;
  const ctx = cv.getContext('2d')!;
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y].length; x++) {
      const c = g[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Janelas dos prédios (uma textura só para todos). */
function texturaJanelas(): unknown {
  const cv = document.createElement('canvas');
  cv.width = 16;
  cv.height = 32;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#5a6988';
  ctx.fillRect(0, 0, 16, 32);
  for (let y = 1; y < 32; y += 4)
    for (let x = 1; x < 16; x += 4) {
      const acesa = (x * 7 + y * 13) % 5 < 2;
      ctx.fillStyle = acesa ? '#feae34' : '#262b44';
      ctx.fillRect(x, y, 2, 2);
    }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Carro de caixas: carroceria, cabine, rodas, faróis (e a sirene, na viatura). */
function montarCarro(cor: string, viatura: boolean) {
  const grupo = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4.2), new THREE.MeshLambertMaterial({ color: cor }));
  corpo.position.y = 0.75;
  grupo.add(corpo);
  const cabine = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2), new THREE.MeshLambertMaterial({ color: viatura ? '#f4f4f4' : '#262b44' }));
  cabine.position.set(0, 1.5, -0.3);
  grupo.add(cabine);
  const rodaGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 8);
  const rodaMat = new THREE.MeshLambertMaterial({ color: '#181425' });
  for (const [x, z] of [
    [-1, 1.3],
    [1, 1.3],
    [-1, -1.3],
    [1, -1.3],
  ]) {
    const r = new THREE.Mesh(rodaGeo, rodaMat);
    r.rotation.z = Math.PI / 2;
    r.position.set(x, 0.42, z);
    grupo.add(r);
  }
  const farol = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: '#feae34' }));
  farol.position.set(0, 0.8, 2.12);
  grupo.add(farol);
  let sirene: { a: unknown; b: unknown } | null = null;
  if (viatura) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: '#e43b44' }));
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: '#2ce8f5' }));
    a.position.set(-0.35, 1.97, -0.3);
    b.position.set(0.35, 1.97, -0.3);
    grupo.add(a, b);
    sirene = { a, b };
  }
  // Seu carro (Fatia 5): vidro dos dois lados (desce para atirar) e o braço com a arma, escondido.
  const janelas: unknown[] = [];
  let arma: unknown = null;
  if (!viatura) {
    const vidro = new THREE.MeshLambertMaterial({ color: '#68aed4' });
    for (const lado of [-1, 1]) {
      const j = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 1.4), vidro);
      j.position.set(lado * 0.86, 1.55, -0.3);
      grupo.add(j);
      janelas.push(j);
    }
    const braco = new THREE.Group();
    const pele = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.8), new THREE.MeshLambertMaterial({ color: '#e8b796' }));
    pele.position.z = 0.4;
    const manga = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.3), new THREE.MeshLambertMaterial({ color: '#e43b44' }));
    manga.position.z = 0.1;
    const cano = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.42), new THREE.MeshLambertMaterial({ color: '#181425' }));
    cano.position.set(0, 0.06, 0.95);
    braco.add(pele, manga, cano);
    braco.visible = false;
    grupo.add(braco);
    arma = braco;
  }
  return { grupo, sirene, janelas, arma };
}

/** Céu de fim de tarde synthwave (roxo em cima, rosa no horizonte), uma textura de fundo. */
function texturaCeu(): unknown {
  const cv = document.createElement('canvas');
  cv.width = 2;
  cv.height = 64;
  const ctx = cv.getContext('2d')!;
  const gr = ctx.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, '#140c2c');
  gr.addColorStop(0.45, '#3b1f5c');
  gr.addColorStop(0.75, '#b55088');
  gr.addColorStop(1, '#f77622');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 2, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Funde várias peças (caixas, cilindros, cones) numa geometria só, com cor por vértice: um objeto = uma chamada de desenho. */
function fundir(partes: { geo: any; cor: string; x?: number; y?: number; z?: number }[]) {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (const p of partes) {
    const geo = p.geo.toNonIndexed();
    geo.translate(p.x ?? 0, p.y ?? 0, p.z ?? 0);
    const gp = geo.getAttribute('position');
    const gn = geo.getAttribute('normal');
    c.set(p.cor);
    for (let i = 0; i < gp.count; i++) {
      pos.push(gp.getX(i), gp.getY(i), gp.getZ(i));
      nor.push(gn.getX(i), gn.getY(i), gn.getZ(i));
      col.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/** O desenho de cada objeto do cenário (poucos polígonos, chapado, base no chão). */
function modeloObjeto(tipo: TipoObjeto) {
  const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const Cl = (rt: number, rb: number, h: number, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n);
  const Cn = (r: number, h: number, n = 8) => new THREE.ConeGeometry(r, h, n);
  const k = COR_OBJETO[tipo];
  switch (tipo) {
    case 'poste':
      return fundir([{ geo: Cl(0.1, 0.14, 6, 6), cor: k[0], y: 3 }, { geo: B(1.2, 0.12, 0.12), cor: k[0], x: 0.5, y: 5.9 }, { geo: B(0.45, 0.14, 0.26), cor: k[2], x: 1.0, y: 5.8 }]);
    case 'hidrante':
      return fundir([{ geo: Cl(0.22, 0.26, 0.75), cor: k[0], y: 0.375 }, { geo: Cl(0.3, 0.3, 0.14), cor: k[1], y: 0.8 }, { geo: B(0.7, 0.14, 0.14), cor: k[2], y: 0.5 }]);
    case 'lixeira':
      return fundir([{ geo: Cl(0.38, 0.32, 0.85), cor: k[0], y: 0.425 }, { geo: Cl(0.42, 0.42, 0.1), cor: k[1], y: 0.9 }]);
    case 'banca':
      return fundir([{ geo: B(2.2, 1.7, 2.2), cor: k[0], y: 0.85 }, { geo: B(2.7, 0.15, 2.7), cor: k[1], y: 1.78 }, { geo: B(1.5, 0.5, 0.1), cor: k[2], y: 1.2, z: 1.12 }]);
    case 'banco':
      return fundir([{ geo: B(1.8, 0.1, 0.55), cor: k[0], y: 0.5 }, { geo: B(1.8, 0.45, 0.08), cor: k[1], y: 0.8, z: -0.25 }, { geo: B(0.1, 0.5, 0.5), cor: k[2], x: -0.8, y: 0.25 }, { geo: B(0.1, 0.5, 0.5), cor: k[2], x: 0.8, y: 0.25 }]);
    case 'arvore':
      return fundir([{ geo: Cl(0.14, 0.22, 2.2, 6), cor: k[2], y: 1.1 }, { geo: Cn(1.6, 3.2, 7), cor: k[0], y: 3.6 }, { geo: Cn(1.2, 2.2, 7), cor: k[1], y: 5.1 }]);
    case 'cone':
      return fundir([{ geo: Cn(0.28, 0.7), cor: k[0], y: 0.35 }, { geo: B(0.7, 0.06, 0.7), cor: '#262b44', y: 0.03 }, { geo: Cl(0.17, 0.2, 0.1), cor: k[1], y: 0.4 }]);
    case 'orelhao':
      return fundir([{ geo: B(0.5, 1.4, 0.45), cor: k[0], y: 0.7 }, { geo: B(0.62, 0.12, 0.55), cor: k[2], y: 1.46 }, { geo: B(0.3, 0.2, 0.05), cor: k[1], y: 1.1, z: 0.25 }]);
    case 'placa':
      return fundir([{ geo: Cl(0.04, 0.04, 2.4, 6), cor: k[2], y: 1.2 }, { geo: B(1.1, 0.45, 0.05), cor: k[0], y: 2.3 }, { geo: B(0.9, 0.08, 0.06), cor: k[1], y: 2.3 }]);
    default:
      return fundir([{ geo: B(0.12, 2.4, 0.12), cor: k[2], x: -1.3, y: 1.2, z: -0.4 }, { geo: B(0.12, 2.4, 0.12), cor: k[2], x: 1.3, y: 1.2, z: -0.4 }, { geo: B(3.1, 0.14, 1.3), cor: k[0], y: 2.45 }, { geo: B(2.2, 0.1, 0.4), cor: k[2], y: 0.5, z: -0.35 }, { geo: B(3, 1.4, 0.06), cor: k[1], y: 1.3, z: -0.55 }]);
  }
}
/** O que sobra no lugar: tamanho do entulho/toco por objeto (caixa unitária esticada). */
const ENTULHO: Record<TipoObjeto, [number, number, number]> = {
  poste: [0.3, 0.4, 0.3],
  hidrante: [0.35, 0.3, 0.35],
  lixeira: [0.7, 0.25, 0.7],
  banca: [2, 0.5, 2],
  banco: [1.6, 0.2, 0.5],
  arvore: [0.5, 0.6, 0.5],
  cone: [0.5, 0.08, 0.5],
  orelhao: [0.5, 0.2, 0.5],
  placa: [0.2, 0.3, 0.2],
  ponto: [2.6, 0.3, 1.2],
};

/**
 * Pontos de partícula com tamanho e opacidade por ponto (o PointsMaterial do three não tem os dois): um shader curto.
 * `luz` soma luz (faísca, poste, sirene); sem ela, cobre (fumaça, sangue). Bolinhas (a tela baixa já dá o pixel).
 */
function materialPontos(luz: boolean, escala: { value: number }) {
  return new THREE.ShaderMaterial({
    uniforms: { uEscala: escala },
    vertexShader: `
      attribute vec4 cor;
      attribute float tam;
      uniform float uEscala;
      varying vec4 vCor;
      void main() {
        vCor = cor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, tam * uEscala / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec4 vCor;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        if (vCor.a < 0.01 || dot(d, d) > 0.25) discard;
        gl_FragColor = vCor;
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: luz ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** Um lote de pontos com espaço para `n` (a tela enche o começo e manda desenhar só esses). */
function lotePontos(n: number, luz: boolean, escala: { value: number }) {
  const pos = new Float32Array(n * 3);
  const cor = new Float32Array(n * 4);
  const tam = new Float32Array(n);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('cor', new THREE.BufferAttribute(cor, 4));
  geo.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
  geo.setDrawRange(0, 0);
  const pts = new THREE.Points(geo, materialPontos(luz, escala));
  pts.frustumCulled = false;
  return { pts, geo, pos, cor, tam };
}

export default function GfaTela({ looks, gore, onFim }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [fase, setFase] = useState<Fase>('intro');
  const [hud, setHud] = useState<{ resta: number; atropelos: number; boletos: number; kmh: number; grana: number; presa: boolean; vida: number; prox: { mortes: number; bonus: number } | null }>({ resta: 90, atropelos: 0, boletos: 0, kmh: 0, grana: 0, presa: false, vida: VIDA_MAX, prox: proximoMarco(0) });
  const [marco, setMarco] = useState<{ id: number; mortes: number; bonus: number } | null>(null);
  const marcoTimer = useRef(0);
  const flashRef = useRef<HTMLDivElement>(null);
  const medidorRef = useRef<HTMLParagraphElement>(null);
  const danoRef = useRef<HTMLDivElement>(null);
  const toque = useRef<Entrada>({ acel: 0, giro: 0, freio: false });
  const resultado = useRef<ResultadoGfa | null>(null);
  const faseRef = useRef<Fase>('intro');
  faseRef.current = fase;

  const trilha = useRef<Trilha | null>(null);
  const velRef = useRef<HTMLDivElement>(null);
  const sireneRef = useRef<HTMLDivElement>(null);
  const sangueRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const t0 = window.setTimeout(() => setFase('corrida'), 2400);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(marcoTimer.current);
    };
  }, []);

  // A trilha ("Fiado Noturno", nossa) toca só durante a corrida e some no fim ou se a tela fechar.
  useEffect(() => {
    if (fase !== 'corrida') return;
    const tr = tocarTrilha();
    trilha.current = tr;
    return () => {
      tr?.parar();
      trilha.current = null;
    };
  }, [fase]);

  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const cv = renderer.domElement as HTMLCanvasElement;
    cv.className = 'gfa-canvas';
    host.appendChild(cv);

    const cena = new THREE.Scene();
    cena.background = texturaCeu();
    cena.fog = new THREE.Fog('#5a2a6a', 40, 140);
    const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.5, 400);
    cena.add(new THREE.HemisphereLight('#ffd7a8', '#3a2a5a', 1.3));
    const sol = new THREE.DirectionalLight('#ffc48a', 1.4);
    sol.position.set(-60, 90, -30);
    cena.add(sol);

    // Chão (asfalto), calçadas e prédios (uma malha instanciada para cada, poucas chamadas de desenho).
    const chao = new THREE.Mesh(new THREE.PlaneGeometry(MUNDO, MUNDO), new THREE.MeshLambertMaterial({ color: '#3a3a48' }));
    chao.rotation.x = -Math.PI / 2;
    chao.position.set(MUNDO / 2, 0, MUNDO / 2);
    cena.add(chao);
    const n = BLOCOS * BLOCOS;
    const lado = BLOCO - RUA;
    const calcadas = new THREE.InstancedMesh(new THREE.BoxGeometry(lado, 0.25, lado), new THREE.MeshLambertMaterial({ color: '#8b8b9b' }), n);
    const predios = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: texturaJanelas() }), n);
    const m4 = new THREE.Matrix4();
    const cores = ['#b86f50', '#c0cbdc', '#e8b796', '#68aed4', '#b55088', '#63c74d', '#feae34', '#8b9bb4'];
    let k = 0;
    for (let i = 0; i < BLOCOS; i++)
      for (let j = 0; j < BLOCOS; j++) {
        const cx = i * BLOCO + RUA + lado / 2;
        const cz = j * BLOCO + RUA + lado / 2;
        m4.makeTranslation(cx, 0.12, cz);
        calcadas.setMatrixAt(k, m4);
        const h = alturaPredio(i, j);
        const larg = lado - CALCADA * 2;
        m4.makeScale(larg, h, larg).setPosition(cx, h / 2, cz);
        predios.setMatrixAt(k, m4);
        predios.setColorAt(k, new THREE.Color(cores[(i * 3 + j * 5) % cores.length]));
        k++;
      }
    cena.add(calcadas, predios);
    // Neon no alto de metade dos prédios (rosa, ciano ou amarelo) e um poste rente a duas quinas de cada prédio
    // (encostado na quina: o carro, que já bate no prédio, quase não chega nele), com o brilho da lâmpada.
    const NEON = ['#ff4fb0', '#2ce8f5', '#fee761'];
    const neons: [number, number, number, number][] = [];
    for (let i = 0; i < BLOCOS; i++)
      for (let j = 0; j < BLOCOS; j++) if ((i * 7 + j * 11) % 2 === 0) neons.push([i, j, alturaPredio(i, j), (i + j) % NEON.length]);
    const neon = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.35, 0.2), new THREE.MeshBasicMaterial({ color: '#ffffff' }), neons.length);
    neons.forEach(([i, j, h, c], q) => {
      const larg = lado - CALCADA * 2;
      m4.makeScale(larg * 0.8, 1, 1).setPosition(i * BLOCO + RUA + lado / 2, h - 0.6, j * BLOCO + RUA + CALCADA - 0.12);
      neon.setMatrixAt(q, m4);
      neon.setColorAt(q, new THREE.Color(NEON[c]));
    });
    cena.add(neon);
    const esquinas: [number, number][] = [];
    for (let i = 0; i < BLOCOS; i++)
      for (let j = 0; j < BLOCOS; j++) esquinas.push([i * BLOCO + RUA + CALCADA - 0.2, j * BLOCO + RUA + CALCADA - 0.2], [i * BLOCO + RUA + lado - CALCADA + 0.2, j * BLOCO + RUA + lado - CALCADA + 0.2]);
    const postes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 6, 0.25), new THREE.MeshLambertMaterial({ color: '#262b44' }), esquinas.length);
    esquinas.forEach(([x, z], q) => {
      m4.makeTranslation(x, 3, z);
      postes.setMatrixAt(q, m4);
    });
    cena.add(postes);
    const escala = { value: 300 };
    const lampadas = lotePontos(esquinas.length * 2, true, escala);
    esquinas.forEach(([x, z], q) => {
      // Lâmpada (miolo forte) e o halo em volta (largo e fraco), cor de sódio.
      for (const [k, t, a] of [
        [q * 2, 0.9, 1],
        [q * 2 + 1, 4.5, 0.22],
      ]) {
        lampadas.pos.set([x, 6.1, z], k * 3);
        lampadas.cor.set([1, 0.55, 0.18, a], k * 4);
        lampadas.tam[k] = t;
      }
    });
    lampadas.geo.setDrawRange(0, esquinas.length * 2);
    cena.add(lampadas.pts);
    // Faixas amarelas no meio das ruas.
    const faixas: [number, number, boolean][] = [];
    for (let i = 0; i <= BLOCOS; i++) for (let s = 2; s < MUNDO; s += 6) faixas.push([i * BLOCO + RUA / 2, s, true], [s, i * BLOCO + RUA / 2, false]);
    const faixa = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.05, 2.4), new THREE.MeshBasicMaterial({ color: '#feae34' }), faixas.length);
    faixas.forEach(([x, z, vert], i) => {
      m4.makeRotationY(vert ? 0 : Math.PI / 2).setPosition(x, 0.03, z);
      faixa.setMatrixAt(i, m4);
    });
    cena.add(faixa);
    // Muro em volta.
    const muroMat = new THREE.MeshLambertMaterial({ color: '#262b44' });
    for (const [x, z, w, d] of [
      [MUNDO / 2, -1, MUNDO + 4, 2],
      [MUNDO / 2, MUNDO + 1, MUNDO + 4, 2],
      [-1, MUNDO / 2, 2, MUNDO + 4],
      [MUNDO + 1, MUNDO / 2, 2, MUNDO + 4],
    ]) {
      const muro = new THREE.Mesh(new THREE.BoxGeometry(w, 5, d), muroMat);
      muro.position.set(x, 2.5, z);
      cena.add(muro);
    }

    // Seu carro, as viaturas e os pedestres.
    const g: Gfa = novoGfa((Math.random() * 2 ** 31) >>> 0, 0, Math.max(1, looks.length));
    // Fatia 6: cenário destrutível. Um InstancedMesh por tipo de objeto (modelo fundido, cor por vértice), um para o
    // entulho que sobra, um para as vitrines e um para os cacos voando: ~13 chamadas de desenho no total.
    const matObjeto = new THREE.MeshLambertMaterial({ vertexColors: true });
    const marcaObj = new Map<number, { mesh: any; i: number }>();
    for (const tipo of TIPOS_OBJETO) {
      const lista = g.objetos.filter((o) => o.tipo === tipo);
      if (!lista.length) continue;
      const mesh = new THREE.InstancedMesh(modeloObjeto(tipo), matObjeto, lista.length);
      lista.forEach((o, i) => {
        m4.makeRotationY(o.ang).setPosition(o.x, 0.24, o.z);
        mesh.setMatrixAt(i, m4);
        marcaObj.set(o.id, { mesh, i });
      });
      cena.add(mesh);
    }
    const entulho = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff' }), Math.max(1, g.objetos.length));
    entulho.frustumCulled = false;
    m4.makeScale(0, 0, 0);
    for (let i = 0; i < g.objetos.length; i++) {
      entulho.setMatrixAt(i, m4);
      entulho.setColorAt(i, new THREE.Color('#5a6988'));
    }
    cena.add(entulho);
    const esconderObjeto = (id: number) => {
      const o = g.objetos[id];
      const h = marcaObj.get(id);
      if (!o || !h) return;
      m4.makeScale(0, 0, 0);
      h.mesh.setMatrixAt(h.i, m4);
      h.mesh.instanceMatrix.needsUpdate = true;
      const [sx, sy, sz] = ENTULHO[o.tipo];
      m4.makeRotationY(o.ang + o.id).scale(new THREE.Vector3(sx, sy, sz)).setPosition(o.x, 0.24 + sy / 2, o.z);
      entulho.setMatrixAt(id, m4);
      entulho.setColorAt(id, new THREE.Color(COR_OBJETO[o.tipo][o.tipo === 'arvore' ? 2 : 1]));
      entulho.instanceMatrix.needsUpdate = true;
      if (entulho.instanceColor) entulho.instanceColor.needsUpdate = true;
    };
    const vitrinas = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1.9, 0.1).translate(0, 0.95, 0),
      new THREE.MeshLambertMaterial({ color: '#68aed4', transparent: true, opacity: 0.75 }),
      Math.max(1, g.vitrines.length),
    );
    const vScale = new THREE.Vector3(1, 1, 1);
    g.vitrines.forEach((vt, i) => {
      m4.makeRotationY(vt.eixo === 'x' ? 0 : Math.PI / 2).scale(vScale.set(vt.comp, 1, 1)).setPosition(vt.x, 0.25, vt.z);
      vitrinas.setMatrixAt(i, m4);
    });
    cena.add(vitrinas);
    const detritosMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff' }), MAX_DETRITOS);
    detritosMesh.frustumCulled = false;
    detritosMesh.count = 0;
    detritosMesh.setColorAt(0, new THREE.Color('#ffffff'));
    cena.add(detritosMesh);
    const dEuler = new THREE.Euler();
    const dQuat = new THREE.Quaternion();
    const dPos = new THREE.Vector3();
    const dEsc = new THREE.Vector3();
    const dCor = new THREE.Color();
    const corDetrito = new Map<string, any>();
    // Traçantes azuis da polícia (todos num LineSegments só, reciclados).
    const POL_TRACOS = 10;
    const polPos = new Float32Array(POL_TRACOS * 6);
    const polGeo = new THREE.BufferGeometry();
    polGeo.setAttribute('position', new THREE.BufferAttribute(polPos, 3));
    const polLinhas = new THREE.LineSegments(polGeo, new THREE.LineBasicMaterial({ color: '#2ce8f5', transparent: true, blending: THREE.AdditiveBlending }));
    polLinhas.frustumCulled = false;
    cena.add(polLinhas);
    const polTraco = Array.from({ length: POL_TRACOS }, () => ({ ate: 0, p: [0, 0, 0, 0, 0, 0] }));
    let proxPol = 0;
    let flashV = 0;
    let danoV = 0;
    const eu = montarCarro('#e43b44', false);
    cena.add(eu.grupo);
    const viaturas: ReturnType<typeof montarCarro>[] = [];
    const quadros = looks.map((L) => [texturaBoneco(L, 'front-a'), texturaBoneco(L, 'front-b'), texturaBoneco(L, 'front')]);
    // Fatia 5: o tronco de quem se despedaçou, os pedaços voando (com o desenho do próprio boneco) e o trânsito.
    looks.forEach((L, i) => quadros[i].push(texturaGrid(cortarGrid(polir(buildBarGridLook(L, 'front')), 31))));
    const texPedaco = new Map<string, unknown>();
    const pedacoTex = (look: number, parte: ParteGfa) => {
      const k = `${look}:${parte}`;
      let t = texPedaco.get(k);
      if (!t) {
        t = texturaGrid(polir(buildPedacoGridLook(looks[look % looks.length], parte)));
        texPedaco.set(k, t);
      }
      return t as { image: HTMLCanvasElement };
    };
    const despedacados = new Set<number>();
    const spritesPedaco = Array.from({ length: MAX_PEDACOS_GFA }, () => {
      const mat = new THREE.SpriteMaterial({ transparent: true });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      cena.add(s);
      return { s, mat };
    });
    const CORES_CIVIS = ['#68aed4', '#63c74d', '#f4f4f4', '#feae34', '#b55088', '#8b9bb4'];
    const civCorpo = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 0.8, 4.2), new THREE.MeshLambertMaterial({ color: '#ffffff' }), N_CIVIS);
    const civCabine = new THREE.InstancedMesh(new THREE.BoxGeometry(1.7, 0.7, 2), new THREE.MeshLambertMaterial({ color: '#262b44' }), N_CIVIS);
    const civRoda = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 8), new THREE.MeshLambertMaterial({ color: '#181425' }), N_CIVIS * 4);
    const civFarol = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.2, 0.1), new THREE.MeshBasicMaterial({ color: '#fee761' }), N_CIVIS);
    g.civis.forEach((v, i) => civCorpo.setColorAt(i, new THREE.Color(CORES_CIVIS[v.cor % CORES_CIVIS.length])));
    cena.add(civCorpo, civCabine, civRoda, civFarol);
    const civEstado: number[] = g.civis.map(() => 0);
    const mCivil = new THREE.Matrix4();
    const mParte = new THREE.Matrix4();
    const mRoda = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
    // Traçantes dos tiros (linhas que somam luz, recicladas).
    const tracantes = Array.from({ length: 6 }, () => {
      const pos = new Float32Array(6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const linha = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#fee761', transparent: true, blending: THREE.AdditiveBlending }));
      linha.visible = false;
      linha.frustumCulled = false;
      cena.add(linha);
      return { linha, geo, pos, ate: 0 };
    });
    let proxTracante = 0;
    let ultimoTiro = { lado: -1, x: 0, z: 0 };
    // Sangue (ou molho) grudado na tela: manchas que escorrem e o pedaço que bateu no vidro.
    type Mancha = { x: number; y: number; r: number; t0: number; cor: string; gotas: { dx: number; vel: number; larg: number }[]; peca: { img: HTMLCanvasElement; rot: number; esc: number } | null };
    const nasTela: Mancha[] = [];
    const telaSangue = sangueRef.current;
    const ctxSangue = telaSangue?.getContext('2d') ?? null;
    let sujaTela = false;
    const placas = g.pedestres.map((p) => {
      const mat = new THREE.SpriteMaterial({ map: quadros[p.look % quadros.length][0], transparent: true });
      const s = new THREE.Sprite(mat);
      s.scale.set(1.4, 2, 1);
      cena.add(s);
      return { s, mat };
    });
    // Manchas no asfalto (sangue ou molho), recicladas.
    const manchaGeo = new THREE.CircleGeometry(1, 8);
    const manchaMat = new THREE.MeshBasicMaterial({ color: gore ? '#73172d' : '#ef7d57', transparent: true, opacity: 0.85 });
    const manchas: unknown[] = [];
    let proxMancha = 0;
    const MAX_MANCHAS = 40;
    // Efeitos: partículas (um lote que soma luz e um que cobre), marcas de pneu recicladas e o tremor da câmera.
    const efx = novoFx((Math.random() * 2 ** 31) >>> 0);
    const brilhos = lotePontos(MAX_PARTICULAS, true, escala);
    const nuvens = lotePontos(MAX_PARTICULAS, false, escala);
    cena.add(nuvens.pts, brilhos.pts);
    const MAX_MARCAS = 220;
    const marcas = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.32, 0.7),
      new THREE.MeshBasicMaterial({ color: '#181425', transparent: true, opacity: 0.55, depthWrite: false }),
      MAX_MARCAS,
    );
    m4.makeScale(0, 0, 0);
    for (let i = 0; i < MAX_MARCAS; i++) marcas.setMatrixAt(i, m4);
    cena.add(marcas);
    let proxMarca = 0;
    const rot = new THREE.Matrix4();
    const corLinear = new Map<string, [number, number, number]>();
    const linear = (hex: string) => {
      let c = corLinear.get(hex);
      if (!c) {
        const k = new THREE.Color(hex);
        c = [k.r, k.g, k.b];
        corLinear.set(hex, c);
      }
      return c;
    };
    // Fatia 7: a preferência do menu do bar (ou o "reduzir movimento" do sistema) e o limite de 3 clarões por segundo.
    const calmo = movimentoReduzido();
    const claroes = new LimiteClarao();
    let nClarao = 0;
    /** Passa as partículas vivas para os dois lotes (posição, cor com opacidade, tamanho). */
    const encher = () => {
      let nb = 0;
      let nn = 0;
      for (const p of efx.p as Particula[]) {
        const f = p.vida / p.dura;
        const L = p.luz ? brilhos : nuvens;
        const k = p.luz ? nb++ : nn++;
        const [r, gg, b] = linear(p.cor);
        L.pos[k * 3] = p.x;
        L.pos[k * 3 + 1] = p.y;
        L.pos[k * 3 + 2] = p.z;
        L.cor[k * 4] = r;
        L.cor[k * 4 + 1] = gg;
        L.cor[k * 4 + 2] = b;
        L.cor[k * 4 + 3] = p.a0 * (1 - f);
        L.tam[k] = p.tam0 + (p.tam1 - p.tam0) * f;
      }
      for (const [L, n2] of [
        [brilhos, nb],
        [nuvens, nn],
      ] as const) {
        L.geo.setDrawRange(0, n2);
        for (const nome of ['position', 'cor', 'tam']) (L.geo.getAttribute(nome) as { needsUpdate: boolean }).needsUpdate = true;
      }
      // Marcas novas no asfalto (as mais velhas dão lugar).
      for (const mk of efx.marcas) {
        rot.makeRotationX(-Math.PI / 2);
        m4.makeRotationY(mk.ang).multiply(rot).setPosition(mk.x, 0.035, mk.z);
        marcas.setMatrixAt(proxMarca, m4);
        proxMarca = (proxMarca + 1) % MAX_MARCAS;
      }
      if (efx.marcas.length) (marcas.instanceMatrix as { needsUpdate: boolean }).needsUpdate = true;
      efx.marcas.length = 0;
    };

    // Teclado.
    const teclas = new Set<string>();
    const desce = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      teclas.add(e.key.toLowerCase());
    };
    const sobe = (e: KeyboardEvent) => teclas.delete(e.key.toLowerCase());
    window.addEventListener('keydown', desce);
    window.addEventListener('keyup', sobe);
    const entrada = (): Entrada => {
      const t = toque.current;
      const cima = teclas.has('w') || teclas.has('arrowup') || t.acel > 0;
      const baixo = teclas.has('s') || teclas.has('arrowdown') || t.acel < 0;
      const esq = teclas.has('a') || teclas.has('arrowleft') || t.giro < 0;
      const dir = teclas.has('d') || teclas.has('arrowright') || t.giro > 0;
      return { acel: cima ? 1 : baixo ? -1 : 0, giro: esq ? 1 : dir ? -1 : 0, freio: teclas.has(' ') || t.freio, tiro: teclas.has('f') || teclas.has('e') || !!t.tiro };
    };

    let acc = 0;
    let derrapa = false;
    let chiadoPneu = 0;
    let antes = performance.now();
    let hudEm = 0;
    let raf = 0;
    const cam = { x: g.carro.x, y: 6, z: g.carro.z - 10 };
    const redimensionar = () => {
      const w = host.clientWidth || 640;
      const h = host.clientHeight || 360;
      // Resolução baixa (~240 linhas) esticada sem suavizar: cara de pixel e leve no celular.
      const esc = Math.max(1, Math.round(h / 240));
      renderer.setSize(Math.ceil(w / esc), Math.ceil(h / esc), false);
      // Tamanho dos pontos em pixels da tela baixa: altura / (2 tan(fov/2)).
      escala.value = Math.ceil(h / esc) / (2 * Math.tan((camera.fov * Math.PI) / 360));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    redimensionar();
    window.addEventListener('resize', redimensionar);

    /** A simulação anda `dt` segundos em passos fixos. */
    const simular = (dt: number, ent: () => Entrada) => {
      acc += dt;
      while (acc >= DT_GFA) {
        const en = ent();
        passoGfa(g, en);
        passoFx(efx, DT_GFA, g, en);
        derrapa = emDerrapagem(g.carro, en);
        acc -= DT_GFA;
        for (const e of g.eventos) {
          if (e.k === 'atropelo') {
            tocar('ko');
            let mm = manchas[proxMancha] as { position: { set: (...a: number[]) => void }; scale: { setScalar: (n: number) => void }; rotation: { x: number } } | undefined;
            if (!mm) {
              mm = new THREE.Mesh(manchaGeo, manchaMat) as typeof mm;
              mm!.rotation.x = -Math.PI / 2;
              cena.add(mm);
              manchas[proxMancha] = mm;
            }
            mm!.position.set(e.x, 0.04, e.z);
            mm!.scale.setScalar(0.8 + Math.min(1.4, e.vel / 20));
            proxMancha = (proxMancha + 1) % MAX_MANCHAS;
            respingo(efx, e.x, e.z, e.vel, g.carro.ang, gore);
            // Fatia 5: atropelo forte despedaça (com o sangue ligado).
            if (e.vel > 9) {
              const p = g.pedestres[e.id];
              despedacar(efx, e.x, e.z, Math.sin(g.carro.ang) * e.vel * 0.8, Math.cos(g.carro.ang) * e.vel * 0.8, p ? p.look : 0, gore);
              if (gore) despedacados.add(e.id);
            }
          } else if (e.k === 'tiro') {
            tocar('tiro');
            clarao(efx, e.x0, e.z0, e.x - e.x0, e.z - e.z0);
            const tr = tracantes[proxTracante];
            proxTracante = (proxTracante + 1) % tracantes.length;
            tr.pos.set([e.x0, 1.45, e.z0, e.x, 1.2, e.z]);
            (tr.geo.getAttribute('position') as { needsUpdate: boolean }).needsUpdate = true;
            tr.ate = performance.now() + 70;
            const c = g.carro;
            ultimoTiro = { lado: (e.x0 - c.x) * Math.cos(c.ang) - (e.z0 - c.z) * Math.sin(c.ang) >= 0 ? 1 : -1, x: e.x, z: e.z };
            if (e.civ !== undefined) faiscas(efx, e.x, e.z, 6);
            if (e.id >= 0) {
              const p = g.pedestres[e.id];
              const d = Math.hypot(e.x - e.x0, e.z - e.z0) || 1;
              respingo(efx, e.x, e.z, 12, Math.atan2(e.x - e.x0, e.z - e.z0), gore);
              despedacar(efx, e.x, e.z, ((e.x - e.x0) / d) * 9, ((e.z - e.z0) / d) * 9, p ? p.look : 0, gore);
              if (gore) despedacados.add(e.id);
              tocar('ko');
            }
          } else if (e.k === 'batida') {
            tocar('parede');
            if (e.forca > 14) tocar('metal');
            faiscas(efx, e.x + Math.sin(g.carro.ang) * 2, e.z + Math.cos(g.carro.ang) * 2, e.forca);
          }
          else if (e.k === 'sirene') tocar('sirene');
          else if (e.k === 'objeto') {
            quebrarFx(efx, e.tipo, e.x, e.z, e.vx, e.vz, e.forca);
            if (e.quebrou) esconderObjeto(e.id);
            tocar(e.quebrou ? 'metal' : 'parede');
          } else if (e.k === 'vitrine') {
            const i = e.id;
            m4.makeScale(0, 0, 0);
            vitrinas.setMatrixAt(i, m4);
            (vitrinas.instanceMatrix as { needsUpdate: boolean }).needsUpdate = true;
            estilhacar(efx, e.x, e.z, e.eixo);
            tocar('vidro');
          } else if (e.k === 'fogo') tocar('grito');
          else if (e.k === 'explosao') {
            explosao(efx, e.x, e.z);
            for (const id of e.mortos) {
              const p = g.pedestres[id];
              if (!p) continue;
              respingo(efx, p.x, p.z, 12, Math.atan2(p.vx, p.vz), gore);
              despedacar(efx, p.x, p.z, p.vx, p.vz, p.look, gore);
              if (gore) despedacados.add(id);
            }
            tocar('parede');
            tocar('metal');
            const dist = Math.hypot(e.x - g.carro.x, e.z - g.carro.z);
            flashV = Math.max(flashV, Math.max(0, 1 - dist / 30) * claroes.fator(`exp${nClarao++}`, performance.now()));
          } else if (e.k === 'tiroPolicia') {
            tocar('tiro');
            const tp = polTraco[proxPol];
            proxPol = (proxPol + 1) % POL_TRACOS;
            tp.p = [e.x0, 1.4, e.z0, e.x, 1.1, e.z];
            tp.ate = performance.now() + 90;
            if (!e.acerto) faiscas(efx, e.x + (Math.random() - 0.5) * 4, e.z + (Math.random() - 0.5) * 4, 3);
          } else if (e.k === 'dano') {
            danoV = Math.min(1, danoV + e.v / 18);
            efx.tremor = Math.min(1, efx.tremor + Math.min(0.35, e.v / 30));
          } else if (e.k === 'marco') {
            tocar('pega');
            if (marcoTimer.current) window.clearTimeout(marcoTimer.current);
            setMarco({ id: e.mortes, mortes: e.mortes, bonus: e.bonus });
            marcoTimer.current = window.setTimeout(() => setMarco(null), 2200);
          } else if (e.k === 'presa' || e.k === 'fim' || e.k === 'destruido') {
            tocar(e.k === 'presa' ? 'sirene' : e.k === 'destruido' ? 'metal' : 'carro');
            resultado.current = { ...premio(g), presa: g.presa, destruido: g.destruido };
            setFase('fim');
          }
        }
        g.eventos.length = 0;
        if (g.acabou) break;
      }
    };
    /** Desenha o quadro (carro, câmera, viaturas, pedestres) e atualiza o painel. */
    const desenhar = (agora: number, dt: number) => {
      // Carro e câmera de perseguição (suave, um pouco acima e atrás).
      const c = g.carro;
      eu.grupo.position.set(c.x, 0, c.z);
      eu.grupo.rotation.y = c.ang;
      const fx = Math.sin(c.ang);
      const fz = Math.cos(c.ang);
      const alvo = { x: c.x - fx * 10, y: 5.5 + Math.abs(c.vel) * 0.06, z: c.z - fz * 10 };
      // Longe demais (entrada, aba que voltou, avanço de teste): pula direto para trás do carro.
      const s = Math.hypot(alvo.x - cam.x, alvo.z - cam.z) > 25 ? 1 : 1 - Math.exp(-dt * 5);
      cam.x += (alvo.x - cam.x) * s;
      cam.y += (alvo.y - cam.y) * s;
      cam.z += (alvo.z - cam.z) * s;
      // Tremor (batida, atropelo): sacode posição e mira; nenhum com o movimento reduzido.
      const tr = calmo ? 0 : efx.tremor * efx.tremor * 0.9;
      const sx = (Math.random() - 0.5) * 2 * tr;
      const sy = (Math.random() - 0.5) * 2 * tr;
      camera.position.set(cam.x + sx, cam.y + sy, cam.z + sx * 0.5);
      camera.lookAt(c.x + fx * 5 + sy, 1, c.z + fz * 5);
      // Viaturas.
      while (viaturas.length < g.viaturas.length) {
        const v = montarCarro('#262b44', true);
        cena.add(v.grupo);
        viaturas.push(v);
      }
      viaturas.forEach((v, i) => {
        const d = g.viaturas[i];
        const grupo = v.grupo as { visible: boolean; position: { set: (...a: number[]) => void }; rotation: { y: number } };
        grupo.visible = !!d;
        if (!d) return;
        grupo.position.set(d.x, 0, d.z);
        grupo.rotation.y = d.ang;
        const pisca = Math.floor(agora / 180) % 2 === 0;
        (v.sirene!.a as { visible: boolean }).visible = pisca;
        (v.sirene!.b as { visible: boolean }).visible = !pisca;
      });
      // Pedestres: andando (2 quadros), voando (girando) e caídos (deitados).
      const passo = Math.floor(agora / 220) % 2;
      g.pedestres.forEach((p, i) => {
        const { s: sp, mat } = placas[i] as { s: { position: { set: (...a: number[]) => void }; scale: { set: (...a: number[]) => void } }; mat: { map: unknown; rotation: number; needsUpdate: boolean } };
        const q = quadros[p.look % quadros.length];
        const deitado = p.estado === 'caido';
        sp.position.set(p.x, deitado ? 0.4 : 1 + p.y, p.z);
        sp.scale.set(deitado ? 2 : 1.4, deitado ? 1.4 : 2, 1);
        if (p.estado === 'anda') despedacados.delete(p.id);
        const mapa = despedacados.has(p.id) ? q[3] : p.estado === 'anda' ? q[passo] : q[2];
        if (mat.map !== mapa) {
          mat.map = mapa;
          mat.needsUpdate = true;
        }
        mat.rotation = p.estado === 'voa' ? (agora / 1000) * p.giro : deitado ? Math.PI / 2 : 0;
      });
      // Fatia 5: pedaços, trânsito, traçantes, vidro e braço do tiro, e o que grudou na tela.
      efx.cam = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
      spritesPedaco.forEach((sp, i) => {
        const pd = efx.pedacos[i];
        const s = sp.s as { visible: boolean; position: { set: (...a: number[]) => void }; scale: { set: (...a: number[]) => void } };
        s.visible = !!pd;
        if (!pd) return;
        const tex = pedacoTex(pd.look, pd.parte);
        if (sp.mat.map !== tex) {
          sp.mat.map = tex;
          sp.mat.needsUpdate = true;
        }
        sp.mat.rotation = pd.rot;
        const [w, h] = pd.parte === 'cabeca' ? [0.95, 0.95] : pd.parte === 'braco' ? [0.4, 0.6] : [0.45, 0.6];
        s.position.set(pd.x, pd.y, pd.z);
        s.scale.set(pd.espelho ? -w : w, h, 1);
      });
      g.civis.forEach((v, i) => {
        mCivil.makeRotationY(v.ang).setPosition(v.x, 0, v.z);
        civCorpo.setMatrixAt(i, mParte.makeTranslation(0, 0.75, 0).premultiply(mCivil));
        civCabine.setMatrixAt(i, mParte.makeTranslation(0, 1.5, -0.3).premultiply(mCivil));
        civFarol.setMatrixAt(i, mParte.makeTranslation(0, 0.8, 2.12).premultiply(mCivil));
        [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]].forEach(([rx, rz], k) => civRoda.setMatrixAt(i * 4 + k, mParte.makeTranslation(rx, 0.42, rz).multiply(mRoda).premultiply(mCivil)));
      });
      for (const im of [civCorpo, civCabine, civRoda, civFarol]) (im.instanceMatrix as { needsUpdate: boolean }).needsUpdate = true;
      // Fatia 6: carcaça queimada (escurece) e, antes de explodir, o carro em chamas fica avermelhado.
      g.civis.forEach((v, i) => {
        const est = v.morto ? 2 : v.fogo ? 1 : 0;
        if (civEstado[i] === est) return;
        civEstado[i] = est;
        civCorpo.setColorAt(i, new THREE.Color(est === 2 ? '#1c1a24' : est === 1 ? '#a8431c' : CORES_CIVIS[v.cor % CORES_CIVIS.length]));
        if (civCorpo.instanceColor) civCorpo.instanceColor.needsUpdate = true;
      });
      // Cacos voando: um cubinho por caco, com a cor e o tamanho dele.
      const nd = efx.detritos.length;
      detritosMesh.count = nd;
      for (let i = 0; i < nd; i++) {
        const d = efx.detritos[i];
        dEuler.set(d.rot, d.rot * 0.7, d.rot * 0.4);
        dQuat.setFromEuler(dEuler);
        m4.compose(dPos.set(d.x, d.y, d.z), dQuat, dEsc.setScalar(d.tam));
        detritosMesh.setMatrixAt(i, m4);
        let cc = corDetrito.get(d.cor);
        if (!cc) {
          cc = new THREE.Color(d.cor);
          corDetrito.set(d.cor, cc);
        }
        detritosMesh.setColorAt(i, dCor.copy(cc));
      }
      if (nd) {
        (detritosMesh.instanceMatrix as { needsUpdate: boolean }).needsUpdate = true;
        if (detritosMesh.instanceColor) detritosMesh.instanceColor.needsUpdate = true;
      }
      // Traçantes azuis da polícia.
      const tAgora = performance.now();
      polTraco.forEach((tp, i) => {
        const vivo = tAgora < tp.ate;
        for (let q = 0; q < 6; q++) polPos[i * 6 + q] = vivo ? tp.p[q] : 0;
      });
      (polGeo.getAttribute('position') as { needsUpdate: boolean }).needsUpdate = true;
      // Clarão da explosão e vermelho do dano (caem sozinhos).
      flashV = Math.max(0, flashV - dt * 2.5);
      danoV = Math.max(0, danoV - dt * 1.6);
      if (flashRef.current) flashRef.current.style.opacity = (calmo ? Math.min(flashV * 0.3, BRILHO_REDUZIDO) : flashV * 0.75).toFixed(2);
      if (danoRef.current) danoRef.current.style.opacity = danoV.toFixed(2);
      const agoraMs = performance.now();
      for (const tr of tracantes) (tr.linha as { visible: boolean }).visible = agoraMs < tr.ate;
      eu.janelas.forEach((j, k) => {
        const lado = k === 0 ? -1 : 1;
        const aberta = lado === ultimoTiro.lado ? g.janela : 0;
        const m = j as { scale: { y: number }; position: { y: number } };
        m.scale.y = Math.max(0.05, 1 - aberta * 0.95);
        m.position.y = 1.55 - aberta * 0.26;
      });
      if (eu.arma) {
        const b = eu.arma as { visible: boolean; position: { set: (...a: number[]) => void }; rotation: { y: number } };
        b.visible = g.janela > 0.85;
        if (b.visible) {
          b.position.set(ultimoTiro.lado * 0.95, 1.45, -0.2);
          b.rotation.y = Math.atan2(ultimoTiro.x - c.x, ultimoTiro.z - c.z) - c.ang;
        }
      }
      for (const n of efx.naTela.splice(0)) {
        const w = telaSangue?.width ?? 320;
        const h = telaSangue?.height ?? 180;
        const r = (n.parte ? 26 : 18) + Math.random() * 22;
        const peca = n.parte ? { img: pedacoTex(n.look, n.parte).image, rot: Math.random() * 6.28, esc: 6 + Math.random() * 3 } : null;
        nasTela.push({
          x: w * (0.2 + Math.random() * 0.6), y: h * (0.15 + Math.random() * 0.5), r, t0: agoraMs, peca,
          cor: n.gore ? '#8a1424' : '#e0552e',
          gotas: Array.from({ length: 3 + Math.floor(Math.random() * 4) }, () => ({ dx: (Math.random() - 0.5) * r * 1.4, vel: 18 + Math.random() * 40, larg: 2 + Math.random() * 4 })),
        });
        if (nasTela.length > 8) nasTela.shift();
        efx.tremor = Math.min(1, efx.tremor + 0.35);
        tocar('parede');
      }
      if (ctxSangue && telaSangue) {
        const W = telaSangue.clientWidth || 640;
        const H = telaSangue.clientHeight || 360;
        if (telaSangue.width !== W || telaSangue.height !== H) {
          telaSangue.width = W;
          telaSangue.height = H;
        }
        if (nasTela.length || sujaTela) ctxSangue.clearRect(0, 0, W, H);
        sujaTela = nasTela.length > 0;
        for (let i = nasTela.length - 1; i >= 0; i--) {
          const s = nasTela[i];
          const vida = (agoraMs - s.t0) / 1000;
          if (vida > 3.6) {
            nasTela.splice(i, 1);
            continue;
          }
          ctxSangue.globalAlpha = vida < 2.6 ? 1 : 1 - (vida - 2.6);
          // O pedaço bate no vidro e escorrega (some em 0,5 s).
          if (s.peca && vida < 0.5) {
            ctxSangue.save();
            ctxSangue.imageSmoothingEnabled = false;
            ctxSangue.translate(s.x, s.y + vida * 60);
            ctxSangue.rotate(s.peca.rot);
            const iw = s.peca.img.width * s.peca.esc;
            const ih = s.peca.img.height * s.peca.esc;
            ctxSangue.globalAlpha *= 1 - vida * 2;
            ctxSangue.drawImage(s.peca.img, -iw / 2, -ih / 2, iw, ih);
            ctxSangue.restore();
            ctxSangue.globalAlpha = vida < 2.6 ? 1 : 1 - (vida - 2.6);
          }
          ctxSangue.fillStyle = s.cor;
          ctxSangue.beginPath();
          ctxSangue.arc(s.x, s.y, s.r * Math.min(1, vida * 12), 0, Math.PI * 2);
          for (let k = 0; k < 7; k++) {
            const a = k * 0.9 + s.r;
            const d = s.r * (0.9 + (k % 3) * 0.35);
            ctxSangue.moveTo(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d);
            ctxSangue.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, s.r * (0.18 + (k % 2) * 0.12), 0, Math.PI * 2);
          }
          ctxSangue.fill();
          // Escorrendo.
          for (const gt of s.gotas) {
            const comp = Math.min(s.r * 4, gt.vel * vida);
            ctxSangue.fillRect(s.x + gt.dx - gt.larg / 2, s.y, gt.larg, comp);
            ctxSangue.beginPath();
            ctxSangue.arc(s.x + gt.dx, s.y + comp, gt.larg * 0.8, 0, Math.PI * 2);
            ctxSangue.fill();
          }
          // Brilho molhado.
          ctxSangue.fillStyle = 'rgba(255,255,255,0.35)';
          ctxSangue.fillRect(s.x - s.r * 0.4, s.y - s.r * 0.5, Math.max(2, s.r * 0.25), 2);
        }
        ctxSangue.globalAlpha = 1;
      }
      // Fora da corrida (intro, fim) as partículas ainda assentam.
      if (faseRef.current !== 'corrida') passoFx(efx, dt);
      encher();
      renderer.render(cena, camera);
      // Pneu cantando, linhas de velocidade, luz da sirene na tela e a trilha mais tensa com a polícia atrás.
      if (derrapa && faseRef.current === 'corrida' && agora > chiadoPneu) {
        chiadoPneu = agora + 260;
        tocar('chiado');
      }
      if (velRef.current) velRef.current.style.opacity = (calmo ? 0 : linhasVelocidade(c.vel, VEL_MAX)).toFixed(2);
      const sir = luzSirene(g, agora);
      if (sireneRef.current) {
        sireneRef.current.style.opacity = (sir.forca * 0.45).toFixed(2);
        sireneRef.current.dataset.cor = sir.cor;
      }
      trilha.current?.tensao(Math.max(g.boletos / 5, g.viaturas.length ? 0.35 + sir.forca * 0.4 : 0));
      if (agora - hudEm > 100) {
        hudEm = agora;
        setHud({
          resta: Math.max(0, Math.ceil((g.fim - g.t) / 1000)),
          atropelos: g.atropelos,
          boletos: g.boletos,
          kmh: Math.round((Math.abs(c.vel) / VEL_MAX) * 180),
          grana: premio(g).grana,
          presa: g.presa,
          vida: Math.ceil(g.vida),
          prox: proximoMarco(g.atropelos),
        });
      }
    };
    // Fatia 7: o mesmo medidor de quadro do bar (?medidor=1); aqui o desenho inclui o three.js.
    const medidor = { ligado: medidorLigado(), m: new Medidor(), em: 0 };
    if (medidorRef.current) medidorRef.current.hidden = !medidor.ligado;
    const quadro = (agora: number) => {
      raf = requestAnimationFrame(quadro);
      const intervalo = agora - antes;
      const t0q = performance.now();
      const dt = Math.min(0.25, (agora - antes) / 1000);
      antes = agora;
      if (faseRef.current === 'corrida') simular(dt, entrada);
      const t0d = performance.now();
      desenhar(agora, dt);
      if (medidor.ligado) {
        const fim = performance.now();
        medidor.m.anotar(intervalo, fim - t0q, fim - t0d);
        if (agora - medidor.em > 500 && medidorRef.current) {
          medidor.em = agora;
          medidorRef.current.textContent = `${textoMedidor(medidor.m.resumo())} · ${renderer.info.render.calls} chamadas`;
        }
      }
    };
    raf = requestAnimationFrame(quadro);
    // Gancho de teste (só em desenvolvimento, como os dos outros portais): o estado, as chamadas de desenho do último
    // quadro e a foto (desenha e lê na hora). No site publicado ele não existe, para ninguém avançar a corrida por fora.
    if (import.meta.env.DEV) (window as unknown as { __gfa?: unknown }).__gfa = {
      g,
      fx: efx,
      entrada,
      info: renderer.info,
      /** Avança a corrida `ms` com os comandos de `ent(i)` (aba escondida não roda o quadro sozinha). */
      avancar: (ms: number, ent: (i: number) => Entrada) => {
        const n = Math.round(ms / 1000 / DT_GFA);
        for (let i = 0; i < n && !g.acabou; i++) simular(DT_GFA, () => ent(i));
      },
      foto: () => {
        desenhar(performance.now(), DT_GFA);
        return cv.toDataURL('image/png');
      },
    };
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', desce);
      window.removeEventListener('keyup', sobe);
      window.removeEventListener('resize', redimensionar);
      renderer.dispose();
      cv.remove();
      delete (window as unknown as { __gfa?: unknown }).__gfa;
    };
    // Monta uma vez por corrida (looks e gore são lidos na entrada; mudar no meio não reinicia nada).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const segura = (k: 'acel' | 'giro', v: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      toque.current = { ...toque.current, [k]: v };
    },
    onPointerUp: () => (toque.current = { ...toque.current, [k]: 0 }),
    onPointerLeave: () => (toque.current = { ...toque.current, [k]: 0 }),
    onPointerCancel: () => (toque.current = { ...toque.current, [k]: 0 }),
  });

  return (
    <div className="gfa" role="dialog" aria-label="Dimensão GFA">
      <div className="gfa-host" ref={hostRef} />
      <div className="gfa-velocidade" ref={velRef} aria-hidden="true" />
      <div className="gfa-sirene" ref={sireneRef} aria-hidden="true" />
      <div className="gfa-flash" ref={flashRef} aria-hidden="true" />
      <p className="medidor-quadro" ref={medidorRef} hidden aria-live="off" />
      <div className="gfa-dano" ref={danoRef} aria-hidden="true" />
      <canvas className="gfa-sangue" ref={sangueRef} aria-hidden="true" />
      <div className="gfa-vinheta" aria-hidden="true" />
      {fase === 'intro' && (
        <div className="gfa-intro">
          <p className="gfa-logo">GRAND FIADO AUTO</p>
          <p>Rocky: — Segura no meu jaleco! A dimensão tá instável e o carro não é meu!</p>
        </div>
      )}
      {marco && (
        <div className="gfa-marco" key={marco.id} role="status">
          <b>+R$ {marco.bonus}!</b>
          <small>{marco.mortes} mortes</small>
        </div>
      )}
      {fase !== 'intro' && (
        <div className="gfa-hud" aria-live="polite">
          <span>⏱ {hud.resta}s</span>
          <span>
            ☠ {hud.atropelos}
            {hud.prox && (
              <small className="gfa-prox">
                {' '}
                (marco {hud.prox.mortes}: +R$ {hud.prox.bonus})
              </small>
            )}
          </span>
          <span className="gfa-vida" role="progressbar" aria-label="Vida do carro" aria-valuemin={0} aria-valuemax={VIDA_MAX} aria-valuenow={hud.vida} data-baixa={hud.vida <= 30 ? 'sim' : 'nao'}>
            <i style={{ width: `${Math.max(0, Math.min(100, (hud.vida / VIDA_MAX) * 100))}%` }} />
            <b>{hud.vida}</b>
          </span>
          <span className="gfa-boletos" aria-label={`${hud.boletos} boletos`}>
            {'💸'.repeat(hud.boletos)}
            {'·'.repeat(5 - hud.boletos)}
          </span>
          <span>{hud.kmh} km/h</span>
          <span>R$ {hud.grana}</span>
        </div>
      )}
      {fase === 'corrida' && (
        <div className="gfa-botoes">
          <button type="button" aria-label="Virar à esquerda" {...segura('giro', -1)}>
            ◀
          </button>
          <button type="button" aria-label="Virar à direita" {...segura('giro', 1)}>
            ▶
          </button>
          <span />
          <button
            type="button"
            className="gfa-tiro"
            aria-label="Parar e atirar (F)"
            onPointerDown={(e) => {
              e.preventDefault();
              toque.current = { ...toque.current, tiro: true };
            }}
            onPointerUp={() => (toque.current = { ...toque.current, tiro: false })}
            onPointerLeave={() => (toque.current = { ...toque.current, tiro: false })}
            onPointerCancel={() => (toque.current = { ...toque.current, tiro: false })}
          >
            🔫
          </button>
          <button type="button" aria-label="Ré e freio" {...segura('acel', -1)}>
            ▼
          </button>
          <button type="button" className="is-gas" aria-label="Acelerar" {...segura('acel', 1)}>
            ▲
          </button>
        </div>
      )}
      {fase === 'fim' && resultado.current && (
        <div className="gfa-fim">
          <p className="gfa-logo">{resultado.current.destruido ? 'CARRO DESTRUÍDO' : resultado.current.presa ? 'PRESO PELOS BOLETOS' : 'FIM DA CORRIDA'}</p>
          <p>
            {resultado.current.mortes} morte{resultado.current.mortes === 1 ? '' : 's'} · R$ {resultado.current.grana} no bolso
            {resultado.current.destruido ? ' (o ferro-velho ficou com metade)' : resultado.current.presa ? ' (a polícia ficou com metade)' : ''}
          </p>
          <p>Rocky: — Arrota… a dimensão vai fechar. Bora, bora, bora!</p>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => onFim(resultado.current!)}>
            Voltar pelo portal
          </button>
        </div>
      )}
    </div>
  );
}

