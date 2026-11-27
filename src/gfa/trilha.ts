/**
 * Trilha da Dimensão GFA: "Fiado Noturno", composição própria no clima synthwave de série policial dos anos 80
 * (bateria eletrônica com caixa estourada, baixo pulsando em colcheias, pad de sintetizador, arpejo e um solo).
 * Tudo sintetizado na hora (Web Audio), sem arquivo. Respeita o som do jogo.
 */
import { contextoAudio } from '../vivo/som';
import { isSoundEnabled } from '../utils/audio';

const BPM = 112;
const SEMI = 60 / BPM / 4; // semicolcheia (s)
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Acordes (1 por compasso): Mi menor, Dó, Ré, Si menor; e a segunda volta sobe para Lá menor, Dó, Ré, Mi menor. */
export const ACORDES: number[][] = [
  [52, 55, 59],
  [48, 52, 55],
  [50, 54, 57],
  [47, 50, 54],
  [45, 48, 52],
  [48, 52, 55],
  [50, 54, 57],
  [52, 55, 59],
];
/** Solo (nota MIDI e duração em semicolcheias; 0 = pausa), 8 compassos de 16. */
export const SOLO: [number, number][] = [
  [76, 6], [74, 2], [71, 4], [0, 4],
  [72, 4], [71, 2], [69, 2], [67, 8],
  [69, 4], [71, 4], [74, 6], [76, 2],
  [74, 8], [0, 8],
  [76, 4], [79, 4], [78, 2], [76, 2], [74, 4],
  [72, 6], [74, 2], [76, 8],
  [74, 4], [72, 4], [71, 4], [69, 4],
  [71, 12], [0, 4],
];

export interface Trilha {
  parar: () => void;
  /** 0 a 1: mais forte com a polícia atrás (sobe o arpejo e o chimbal). */
  tensao: (v: number) => void;
}

export function tocarTrilha(): Trilha | null {
  const c = contextoAudio();
  if (!c) return null;
  const { a, ruido } = c;
  const mestre = a.createGain();
  mestre.gain.value = 0;
  mestre.gain.linearRampToValueAtTime(0.22, a.currentTime + 1.5);
  // "Eco" curto de sala dos anos 80 (atraso com retorno) no pad e no solo.
  const eco = a.createDelay(1);
  eco.delayTime.value = SEMI * 3;
  const volta = a.createGain();
  volta.gain.value = 0.32;
  eco.connect(volta).connect(eco);
  eco.connect(mestre);
  mestre.connect(a.destination);
  let tens = 0;

  const nota = (t: number, f: number, dur: number, tipo: OscillatorType, vol: number, corte: number, comEco = false, desafina = 0) => {
    const o = a.createOscillator();
    o.type = tipo;
    o.frequency.value = f;
    o.detune.value = desafina;
    const fil = a.createBiquadFilter();
    fil.type = 'lowpass';
    fil.frequency.value = corte;
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fil).connect(g).connect(mestre);
    if (comEco) g.connect(eco);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const bumbo = (t: number) => {
    const o = a.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = a.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(mestre);
    o.start(t);
    o.stop(t + 0.32);
  };
  const ruidoEm = (t: number, dur: number, freq: number, vol: number, tipo: BiquadFilterType) => {
    const s = a.createBufferSource();
    s.buffer = ruido;
    const f = a.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = freq;
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(mestre);
    s.start(t, Math.random() * 0.2);
    s.stop(t + dur + 0.02);
  };

  // Agendador com folga (olha 0,25 s à frente), uma semicolcheia por vez.
  let passo = 0;
  let quando = a.currentTime + 0.1;
  const soloPasso: number[] = [];
  {
    let p = 0;
    for (const [n, d] of SOLO) {
      soloPasso[p] = n ? n * 100 + d : 0;
      p += d;
    }
  }
  const agendar = () => {
    // Aba em segundo plano ou travada: pula o que passou (senão as notas perdidas saem todas de uma vez).
    if (quando < a.currentTime - 0.05) quando = a.currentTime + 0.05;
    while (quando < a.currentTime + 0.25) {
      const s16 = passo % 16;
      const compasso = Math.floor(passo / 16) % 8;
      const volta2 = Math.floor(passo / 128) % 2 === 1;
      const ac = ACORDES[compasso];
      // Som desligado no meio da corrida: o tempo anda, mas nada toca.
      if (!isSoundEnabled()) {
        quando += SEMI;
        passo++;
        continue;
      }
      // Bateria: bumbo no 1 e 3 (e um extra), caixa estourada no 2 e 4, chimbal nas colcheias (mais com tensão).
      if (s16 === 0 || s16 === 8 || (s16 === 10 && compasso % 2)) bumbo(quando);
      if (s16 === 4 || s16 === 12) ruidoEm(quando, 0.32, 1800, 0.55, 'bandpass');
      if (s16 % 2 === 0 || tens > 0.5) ruidoEm(quando, 0.04, 8000, 0.12 + tens * 0.1, 'highpass');
      // Baixo pulsando em colcheias (a quinta no fim do compasso).
      if (s16 % 2 === 0) nota(quando, hz(ac[0] - 12 + (s16 >= 12 ? 7 : 0)), SEMI * 1.8, 'sawtooth', 0.32, 700);
      // Pad: o acorde inteiro no começo do compasso, dois osciladores desafinados.
      if (s16 === 0)
        for (const m of ac) {
          nota(quando, hz(m), SEMI * 15.5, 'sawtooth', 0.05, 1400, true, -7);
          nota(quando, hz(m), SEMI * 15.5, 'sawtooth', 0.05, 1400, true, 7);
        }
      // Arpejo em semicolcheias (só na segunda volta, ou com a polícia atrás).
      if (volta2 || tens > 0.3) nota(quando, hz(ac[s16 % 3] + 12 + (s16 % 6 > 2 ? 12 : 0)), SEMI * 0.9, 'square', 0.035 + tens * 0.03, 3000);
      // Solo na segunda volta.
      if (volta2) {
        const sp = soloPasso[passo % 128];
        if (sp) nota(quando, hz(Math.floor(sp / 100)), SEMI * (sp % 100) * 0.95, 'square', 0.07, 2600, true);
      }
      quando += SEMI;
      passo++;
    }
  };
  agendar();
  const timer = window.setInterval(agendar, 60);
  return {
    parar: () => {
      window.clearInterval(timer);
      const t = a.currentTime;
      mestre.gain.cancelScheduledValues(t);
      mestre.gain.setValueAtTime(mestre.gain.value, t);
      mestre.gain.linearRampToValueAtTime(0, t + 0.6);
      window.setTimeout(() => mestre.disconnect(), 800);
    },
    tensao: (v: number) => {
      tens = Math.max(0, Math.min(1, v));
    },
  };
}
