/**
 * Som da Rajada do Fiado (Fatia 5), sintetizado na hora: nenhum arquivo, nada de áudio de anime.
 * - carga (2 s): zumbido grave que sobe, um brilho que treme cada vez mais rápido, ar sendo puxado e estalos de
 *   energia que se adensam no fim;
 * - disparo (1,4 s): estrondo, o rugido do feixe (ruído e quatro dentes de serra com vibrato), um assobio que cai e o
 *   estouro no fim.
 * Monta num contexto qualquer (o do jogo ou um OfflineAudioContext para medir) e passa por um compressor (sem clipar).
 */

const ruidos = new WeakMap<BaseAudioContext, AudioBuffer>();

function ruidoDe(a: BaseAudioContext): AudioBuffer {
  let b = ruidos.get(a);
  if (b) return b;
  b = a.createBuffer(1, Math.floor(a.sampleRate * 1.5), a.sampleRate);
  const d = b.getChannelData(0);
  let s = 987654321;
  for (let i = 0; i < d.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x3fffffff - 1) * 0.9;
  }
  ruidos.set(a, b);
  return b;
}

/** Duração de cada parte (s). */
export const DURACAO_RAJADA = { carga: 2.0, disparo: 1.4 } as const;

export function montarRajada(a: BaseAudioContext, destino: AudioNode, t: number, parte: 'carga' | 'disparo') {
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  const mestre = a.createGain();
  mestre.gain.value = 0.7;
  comp.connect(mestre).connect(destino);
  const ruido = ruidoDe(a);

  const env = (g: GainNode, pts: [number, number][]) => {
    g.gain.setValueAtTime(Math.max(0.0001, pts[0][1]), t + pts[0][0]);
    for (const [dt, v] of pts.slice(1)) g.gain.linearRampToValueAtTime(v, t + dt);
  };
  const osc = (tipo: OscillatorType, f0: number, f1: number, ini: number, fim: number, destinoNo: AudioNode, curva: 'exp' | 'lin' = 'exp') => {
    const o = a.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t + ini);
    if (curva === 'exp') o.frequency.exponentialRampToValueAtTime(f1, t + fim);
    else o.frequency.linearRampToValueAtTime(f1, t + fim);
    o.connect(destinoNo);
    o.start(t + ini);
    o.stop(t + fim + 0.05);
    return o;
  };
  const ruidoEm = (ini: number, dur: number, tipo: BiquadFilterType, f0: number, f1: number, q: number, pts: [number, number][]) => {
    const s = a.createBufferSource();
    s.buffer = ruido;
    s.loop = true;
    const f = a.createBiquadFilter();
    f.type = tipo;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t + ini);
    f.frequency.exponentialRampToValueAtTime(f1, t + ini + dur);
    const g = a.createGain();
    env(g, pts.map(([x, v]) => [ini + x, v]));
    s.connect(f).connect(g).connect(comp);
    s.start(t + ini);
    s.stop(t + ini + dur + 0.05);
  };
  const estrondo = (ini: number, forca: number) => {
    const g = a.createGain();
    env(g, [[ini, forca], [ini + 0.55, 0.0001]]);
    g.connect(comp);
    osc('sine', 130, 28, ini, ini + 0.55, g);
    ruidoEm(ini, 0.45, 'lowpass', 1600, 200, 0.7, [[0, forca * 0.8], [0.45, 0.0001]]);
  };

  if (parte === 'carga') {
    const D = DURACAO_RAJADA.carga;
    // Zumbido grave que sobe (três dentes de serra desafinados num passa-baixa que abre).
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 4;
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.exponentialRampToValueAtTime(3200, t + D);
    const gz = a.createGain();
    env(gz, [[0, 0.0001], [D * 0.9, 0.22], [D, 0.3]]);
    lp.connect(gz).connect(comp);
    for (const det of [-9, 0, 11]) osc('sawtooth', 55 * 2 ** (det / 1200), 220 * 2 ** (det / 1200), 0, D, lp);
    // Brilho com tremolo que acelera.
    const gb = a.createGain();
    env(gb, [[0, 0.0001], [D, 0.09]]);
    const trem = a.createGain();
    trem.gain.value = 0.5;
    const lfo = a.createOscillator();
    lfo.frequency.setValueAtTime(4, t);
    lfo.frequency.linearRampToValueAtTime(19, t + D);
    const prof = a.createGain();
    prof.gain.value = 0.5;
    lfo.connect(prof).connect(trem.gain);
    lfo.start(t);
    lfo.stop(t + D + 0.05);
    gb.connect(trem).connect(comp);
    osc('sine', 880, 1760, 0, D, gb);
    // Ar sendo puxado.
    ruidoEm(0, D, 'bandpass', 300, 4200, 2.5, [[0, 0.0001], [D, 0.16]]);
    // Grave do chão.
    const gs = a.createGain();
    env(gs, [[0, 0.0001], [D, 0.35]]);
    gs.connect(comp);
    osc('sine', 38, 46, 0, D, gs, 'lin');
    // Estalos de energia, cada vez mais juntos.
    let x = 0.5;
    for (let i = 0; i < 26 && x < D; i++) {
      ruidoEm(x, 0.03, 'highpass', 3500, 6000, 1, [[0, 0.25], [0.03, 0.0001]]);
      x += 0.12 * (1 - x / (D + 0.4)) + 0.025;
    }
    return;
  }
  const D = DURACAO_RAJADA.disparo;
  estrondo(0, 1);
  // Rugido do feixe.
  ruidoEm(0, D, 'lowpass', 1400, 500, 3, [[0, 0.0001], [0.04, 0.55], [D - 0.25, 0.45], [D, 0.0001]]);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1900;
  const gr = a.createGain();
  env(gr, [[0, 0.0001], [0.05, 0.13], [D - 0.25, 0.11], [D, 0.0001]]);
  lp.connect(gr).connect(comp);
  const vib = a.createOscillator();
  vib.frequency.value = 7;
  const vibG = a.createGain();
  vibG.gain.value = 6;
  vib.connect(vibG);
  vib.start(t);
  vib.stop(t + D + 0.05);
  for (const f of [70, 105, 140, 210]) {
    const o = osc('sawtooth', f, f * 0.94, 0, D, lp, 'lin');
    vibG.connect(o.frequency);
  }
  // Assobio que cai.
  const ga = a.createGain();
  env(ga, [[0, 0.0001], [0.05, 0.05], [D, 0.0001]]);
  ga.connect(comp);
  osc('sine', 1300, 520, 0, D, ga);
  // O estouro lá no fim do feixe.
  estrondo(D - 0.25, 0.7);
}
