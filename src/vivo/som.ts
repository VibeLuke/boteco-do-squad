/**
 * Sons da pancadaria, sintetizados na hora (Web Audio, nenhum arquivo): soco seco, pancada forte, vidro quebrando,
 * corpo na parede e o nocaute. Respeita o "som" geral do jogo.
 */
import { isSoundEnabled } from '../utils/audio';
import type { Disparo, PoderNovo } from './poderes';
import { montarPoder } from './somPoderes';
import { montarRajada } from './somRajada';
import { duracaoVoz, silabas, tocarSilabas, type TipoVoz } from './voz';

let ctx: AudioContext | null = null;
let ruido: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !isSoundEnabled()) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  if (!ruido) {
    ruido = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = ruido.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (s / 0x3fffffff - 1) * 0.9;
    }
  }
  return ctx;
}

/** Vozes (Fatia 6): um barramento com compressor, no máximo 3 falando juntas e ninguém falando por cima de si. */
let barramento: GainNode | null = null;
const caladoAte = new Map<string, number>();
let falando: number[] = [];
export const MAX_VOZES = 3;

/** Fala de alguém (`id` dá o timbre), com volume 0..1 já com a distância. Devolve se tocou. */
export function falarVoz(tipo: TipoVoz, id: string, tamanho: number, vol: number): boolean {
  if (vol <= 0.03) return false;
  const a = audio();
  if (!a || !ruido) return false;
  const agora = a.currentTime;
  if ((caladoAte.get(id) ?? -1) > agora) return false;
  falando = falando.filter((x) => x > agora);
  // Dor e nocaute furam a fila (são curtos e importam); fala comum espera vaga.
  if (falando.length >= MAX_VOZES && (tipo === 'fala' || tipo === 'risada')) return false;
  if (falando.length >= MAX_VOZES + 1) return false;
  if (!barramento) {
    const comp = a.createDynamicsCompressor();
    barramento = a.createGain();
    barramento.gain.value = 0.7;
    barramento.connect(comp).connect(a.destination);
  }
  const s = silabas(tipo, id, tamanho, Math.floor(agora * 1000));
  const fim = agora + 0.01 + duracaoVoz(s);
  caladoAte.set(id, fim + 0.08);
  falando.push(fim);
  tocarSilabas(a, barramento, agora + 0.01, id, s, vol, ruido);
  return true;
}

/** O mesmo contexto de áudio (e o ruído pronto) para a trilha do GFA; null com o som desligado. */
export function contextoAudio(): { a: AudioContext; ruido: AudioBuffer } | null {
  const a = audio();
  return a && ruido ? { a, ruido } : null;
}

function estalo(a: AudioContext, t: number, dur: number, freq: number, q: number, gain: number, tipo: BiquadFilterType = 'lowpass') {
  const src = a.createBufferSource();
  src.buffer = ruido;
  const f = a.createBiquadFilter();
  f.type = tipo;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t, Math.random() * 0.3);
  src.stop(t + dur + 0.02);
}

function grave(a: AudioContext, t: number, de: number, para: number, dur: number, gain: number, tipo: OscillatorType = 'sine') {
  const o = a.createOscillator();
  o.type = tipo;
  o.frequency.setValueAtTime(de, t);
  o.frequency.exponentialRampToValueAtTime(para, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export type Som = 'soco' | 'forte' | 'vidro' | 'parede' | 'ko' | 'pega' | 'cerveja' | 'carro' | 'chiado' | 'metal' | 'grito' | 'latido' | 'sirene' | 'tiro' | 'rajadaCarga' | 'rajadaDisparo';

export function tocar(s: Som) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.005;
  switch (s) {
    case 'soco':
      estalo(a, t, 0.07, 1800, 0.7, 0.35);
      grave(a, t, 150, 60, 0.09, 0.45);
      break;
    case 'forte':
      estalo(a, t, 0.12, 1200, 0.8, 0.5);
      grave(a, t, 110, 38, 0.18, 0.7);
      break;
    case 'vidro':
      estalo(a, t, 0.18, 4200, 3, 0.35, 'highpass');
      for (let i = 0; i < 4; i++) grave(a, t + 0.02 + i * 0.03, 2600 + i * 700, 2200 + i * 500, 0.08, 0.06, 'triangle');
      break;
    case 'parede':
      estalo(a, t, 0.16, 600, 0.6, 0.6);
      grave(a, t, 80, 35, 0.2, 0.7);
      break;
    case 'ko':
      grave(a, t, 420, 70, 0.5, 0.25, 'square');
      estalo(a, t + 0.05, 0.25, 500, 0.5, 0.35);
      break;
    case 'pega':
      grave(a, t, 500, 900, 0.06, 0.12, 'triangle');
      break;
    case 'carro':
      // Buzina de dois tons e a pancada seca no capô.
      grave(a, t, 392, 392, 0.22, 0.12, 'square');
      grave(a, t, 466, 466, 0.22, 0.09, 'square');
      estalo(a, t + 0.04, 0.25, 700, 0.7, 0.7);
      grave(a, t + 0.04, 90, 32, 0.3, 0.8);
      break;
    case 'cerveja':
      estalo(a, t, 0.25, 3000, 1, 0.12, 'bandpass');
      grave(a, t + 0.05, 300, 600, 0.12, 0.1, 'triangle');
      break;
    // Banheiro assombrado.
    case 'chiado':
      estalo(a, t, 0.35, 2600, 0.6, 0.16, 'bandpass');
      break;
    case 'metal':
      for (let i = 0; i < 3; i++) grave(a, t + i * 0.12, 1900 - i * 300, 1300 - i * 200, 0.22, 0.05, 'sawtooth');
      estalo(a, t, 0.5, 5200, 4, 0.08, 'highpass');
      break;
    case 'grito':
      grave(a, t, 1400, 260, 0.7, 0.14, 'sawtooth');
      grave(a, t, 1480, 300, 0.7, 0.08, 'square');
      estalo(a, t, 0.4, 3000, 0.8, 0.2, 'bandpass');
      break;
    case 'sirene':
      for (let i = 0; i < 4; i++) grave(a, t + i * 0.28, i % 2 ? 700 : 960, i % 2 ? 700 : 960, 0.26, 0.07, 'square');
      break;
    // GFA: tiro de dentro do carro (estalo seco e o grave do cano).
    case 'tiro':
      estalo(a, t, 0.06, 2400, 0.8, 0.55, 'highpass');
      grave(a, t, 190, 48, 0.12, 0.6);
      break;
    // Rajada do Fiado (Fatia 5).
    case 'rajadaCarga':
      montarRajada(a, a.destination, t, 'carga');
      break;
    case 'rajadaDisparo':
      montarRajada(a, a.destination, t, 'disparo');
      break;
    case 'latido':
      for (let i = 0; i < 2; i++) {
        grave(a, t + i * 0.22, 520, 180, 0.13, 0.28, 'sawtooth');
        estalo(a, t + i * 0.22, 0.08, 900, 1, 0.3);
      }
      break;
  }
}

/** Carga ou disparo de um dos 10 poderes novos (Fatia 6); `d` acerta as batidas com os alvos do disparo. */
export function tocarPoder(tipo: PoderNovo, parte: 'carga' | 'disparo', d?: Pick<Disparo, 'alvos' | 't0' | 'x' | 'y' | 'cx' | 'cy'>) {
  const a = audio();
  if (!a) return;
  montarPoder(a, a.destination, a.currentTime + 0.005, tipo, parte, d);
}
