/**
 * Som dos 10 poderes novos (Fatia 6), sintetizado na hora como o da Rajada: nenhum arquivo, nada de som com dono.
 * Cada poder tem a sua carga (zumbido que sobe, na cor do poder) e o seu disparo, marcado nas mesmas horas do
 * efeito (a tampinha que cai, o raio que desce, a bandejada, a implosão). Monta num contexto qualquer (o do jogo ou
 * um OfflineAudioContext para medir) e passa por um compressor (sem clipar).
 */
import { PODER, vooPinga, type Disparo, type PoderNovo } from './poderes';

const ruidos = new WeakMap<BaseAudioContext, AudioBuffer>();

function ruidoDe(a: BaseAudioContext): AudioBuffer {
  let b = ruidos.get(a);
  if (b) return b;
  b = a.createBuffer(1, Math.floor(a.sampleRate * 1.5), a.sampleRate);
  const d = b.getChannelData(0);
  let s = 192837465;
  for (let i = 0; i < d.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x3fffffff - 1) * 0.9;
  }
  ruidos.set(a, b);
  return b;
}

/** Sorteio fixo (o mesmo som em todo aparelho para o mesmo disparo). */
function sorteio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Tom de base da carga de cada poder (Hz) e o brilho por cima. */
const TOM: Record<PoderNovo, [number, number]> = {
  tampinhas: [98, 1320],
  arroto: [55, 520],
  furacao: [73, 1100],
  chope: [65, 880],
  pagode: [49, 660],
  raio: [82, 1980],
  torresmo: [61, 740],
  garcom: [110, 990],
  pinga: [69, 1480],
  ima: [58, 1170],
};

/** Duração (s) de cada parte de cada poder. */
export function duracaoSomPoder(tipo: PoderNovo, parte: 'carga' | 'disparo'): number {
  const def = PODER[tipo];
  return parte === 'carga' ? def.carga / 1000 : def.dura / 1000 + 0.6;
}

/** Alvos que um disparo teve (Raio, Garçom); sem disparo, o máximo do poder. */
function quantos(tipo: PoderNovo, d?: Pick<Disparo, 'alvos'>): number {
  return d ? d.alvos.length : (PODER[tipo].p.n ?? 0);
}

export function montarPoder(
  a: BaseAudioContext,
  destino: AudioNode,
  t: number,
  tipo: PoderNovo,
  parte: 'carga' | 'disparo',
  d?: Pick<Disparo, 'alvos' | 't0' | 'x' | 'y' | 'cx' | 'cy'>,
) {
  const def = PODER[tipo];
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  const mestre = a.createGain();
  mestre.gain.value = 0.65;
  comp.connect(mestre).connect(destino);
  const ruido = ruidoDe(a);
  const rnd = sorteio((d?.t0 ?? 7) ^ tipo.length * 977);

  const env = (g: GainNode, pts: [number, number][]) => {
    g.gain.setValueAtTime(Math.max(0.0001, pts[0][1]), t + pts[0][0]);
    for (const [dt, v] of pts.slice(1)) g.gain.linearRampToValueAtTime(v, t + dt);
  };
  const ganho = (pts: [number, number][]) => {
    const g = a.createGain();
    env(g, pts);
    g.connect(comp);
    return g;
  };
  const osc = (forma: OscillatorType, f0: number, f1: number, ini: number, fim: number, no: AudioNode, curva: 'exp' | 'lin' = 'exp') => {
    const o = a.createOscillator();
    o.type = forma;
    o.frequency.setValueAtTime(f0, t + ini);
    if (curva === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + fim);
    else o.frequency.linearRampToValueAtTime(f1, t + fim);
    o.connect(no);
    o.start(t + ini);
    o.stop(t + fim + 0.05);
    return o;
  };
  const ruidoEm = (ini: number, dur: number, filtro: BiquadFilterType, f0: number, f1: number, q: number, pts: [number, number][]) => {
    const s = a.createBufferSource();
    s.buffer = ruido;
    s.loop = true;
    const f = a.createBiquadFilter();
    f.type = filtro;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t + ini);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + ini + dur);
    const g = a.createGain();
    env(g, pts.map(([x, v]) => [ini + x, v]));
    s.connect(f).connect(g).connect(comp);
    s.start(t + ini, rnd() * 0.5);
    s.stop(t + ini + dur + 0.05);
    return f;
  };
  const estrondo = (ini: number, forca: number, f0 = 130) => {
    osc('sine', f0, 28, ini, ini + 0.6, ganho([[ini, forca], [ini + 0.6, 0.0001]]));
    ruidoEm(ini, 0.5, 'lowpass', 1800, 180, 0.7, [[0, forca * 0.8], [0.5, 0.0001]]);
  };
  const tim = (ini: number, f: number, dur: number, vol: number, forma: OscillatorType = 'triangle') =>
    osc(forma, f, f * 0.93, ini, ini + dur, ganho([[ini, vol], [ini + dur, 0.0001]]));

  if (parte === 'carga') {
    const D = def.carga / 1000;
    const [base, brilho] = TOM[tipo];
    // Zumbido que sobe (dois dentes de serra desafinados num passa-baixa que abre).
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 5;
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.exponentialRampToValueAtTime(2800, t + D);
    lp.connect(ganho([[0, 0.0001], [D * 0.85, 0.2], [D, 0.26]]));
    for (const det of [-12, 10]) osc('sawtooth', base * 2 ** (det / 1200), base * 3 * 2 ** (det / 1200), 0, D, lp);
    // Brilho do poder com tremolo que acelera.
    const gb = ganho([[0, 0.0001], [D, 0.07]]);
    const trem = a.createGain();
    trem.gain.value = 0.5;
    trem.connect(gb);
    const lfo = a.createOscillator();
    lfo.frequency.setValueAtTime(5, t);
    lfo.frequency.linearRampToValueAtTime(22, t + D);
    const prof = a.createGain();
    prof.gain.value = 0.5;
    lfo.connect(prof).connect(trem.gain);
    lfo.start(t);
    lfo.stop(t + D + 0.05);
    osc(tipo === 'garcom' ? 'sine' : 'triangle', brilho, brilho * 1.5, 0, D, trem);
    // Ar sendo puxado e o tique do fim.
    ruidoEm(0, D, 'bandpass', 260, 3800, 2.2, [[0, 0.0001], [D, 0.13]]);
    tim(Math.max(0, D - 0.12), brilho * 2, 0.1, 0.08, 'square');
    return;
  }

  switch (tipo) {
    case 'tampinhas': {
      // Uma tampinha tilintando por alvo e dezenas em volta, entre 0,2 e 1,6 s.
      for (let i = 0; i < 34; i++) {
        const x = 0.2 + rnd() * 1.4;
        tim(x, 2600 + rnd() * 2600, 0.05 + rnd() * 0.05, 0.05 + rnd() * 0.05);
        if (i % 3 === 0) tim(x + 0.04, 3800 + rnd() * 1800, 0.04, 0.03, 'square');
      }
      ruidoEm(0, 1.8, 'highpass', 5200, 7000, 0.8, [[0, 0.0001], [0.3, 0.05], [1.6, 0.04], [1.8, 0.0001]]);
      estrondo(0, 0.25, 90);
      break;
    }
    case 'arroto': {
      // Arroto: dente de serra grave com garganta (dois formantes) e um tremido; depois o vento.
      const f1 = a.createBiquadFilter();
      f1.type = 'bandpass';
      f1.frequency.value = 420;
      f1.Q.value = 3;
      const f2 = a.createBiquadFilter();
      f2.type = 'bandpass';
      f2.frequency.value = 900;
      f2.Q.value = 4;
      const g = ganho([[0, 0.0001], [0.04, 0.9], [0.55, 0.5], [0.8, 0.0001]]);
      f1.connect(g);
      f2.connect(g);
      const o = osc('sawtooth', 92, 58, 0, 0.8, f1);
      o.connect(f2);
      const lfo = a.createOscillator();
      lfo.frequency.value = 23;
      const prof = a.createGain();
      prof.gain.value = 14;
      lfo.connect(prof).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + 0.85);
      ruidoEm(0.05, 0.9, 'bandpass', 700, 240, 1.2, [[0, 0.3], [0.9, 0.0001]]);
      estrondo(0, 0.3, 80);
      break;
    }
    case 'furacao': {
      // Vento que gira: ruído num passa-faixa que sobe e desce três vezes por segundo.
      const D = def.dura / 1000;
      const f = ruidoEm(0, D, 'bandpass', 500, 900, 3, [[0, 0.0001], [0.2, 0.45], [D - 0.4, 0.4], [D, 0.0001]]);
      const lfo = a.createOscillator();
      lfo.frequency.value = 3.2;
      const prof = a.createGain();
      prof.gain.value = 650;
      lfo.connect(prof).connect(f.frequency);
      lfo.start(t);
      lfo.stop(t + D + 0.05);
      ruidoEm(0, D, 'lowpass', 300, 160, 0.7, [[0, 0.0001], [0.3, 0.25], [D, 0.0001]]);
      osc('sine', 180, 120, 0, D, ganho([[0, 0.0001], [0.3, 0.06], [D, 0.0001]]));
      break;
    }
    case 'chope': {
      // A onda: espuma estourando (ruído) e bolhas que sobem.
      ruidoEm(0, 1.5, 'lowpass', 3200, 500, 0.6, [[0, 0.0001], [0.05, 0.55], [1.2, 0.2], [1.5, 0.0001]]);
      ruidoEm(0, 1.5, 'highpass', 2500, 4500, 0.8, [[0, 0.0001], [0.1, 0.15], [1.5, 0.0001]]);
      for (let i = 0; i < 26; i++) {
        const x = rnd() * 1.4;
        const f0 = 300 + rnd() * 500;
        osc('sine', f0, f0 * 2.4, x, x + 0.06, ganho([[x, 0.07], [x + 0.06, 0.0001]]));
      }
      estrondo(0, 0.35, 70);
      break;
    }
    case 'pagode': {
      // TUM-TCHÁ duas vezes (surdo e caixa) e o chão rachando.
      for (const [x, forte] of [[0, 1], [0.32, 0.7], [0.5, 0.85], [0.82, 0.6]] as const) {
        osc('sine', 125, 38, x, x + 0.4, ganho([[x, 0.9 * forte], [x + 0.4, 0.0001]]));
        ruidoEm(x + 0.16, 0.14, 'highpass', 1800, 2600, 0.9, [[0, 0.45 * forte], [0.14, 0.0001]]);
      }
      ruidoEm(0, 1.1, 'lowpass', 220, 90, 0.8, [[0, 0.5], [1.1, 0.0001]]);
      for (let i = 0; i < 8; i++) ruidoEm(0.1 + rnd() * 0.8, 0.05, 'bandpass', 900, 600, 2, [[0, 0.2], [0.05, 0.0001]]);
      break;
    }
    case 'raio': {
      // Cada raio: estalo agudo, zap que cai e o trovão grave.
      const n = Math.max(1, quantos(tipo, d));
      for (let i = 0; i < n; i++) {
        const x = (def.p.atraso! + i * def.p.passo!) / 1000;
        ruidoEm(x, 0.08, 'highpass', 4000, 7000, 0.7, [[0, 0.6], [0.08, 0.0001]]);
        osc('sawtooth', 3200, 140, x, x + 0.18, ganho([[x, 0.18], [x + 0.18, 0.0001]]));
        estrondo(x + 0.03, 0.4, 100);
      }
      ruidoEm(0, 1.8, 'lowpass', 160, 70, 0.6, [[0, 0.0001], [0.4, 0.35], [1.8, 0.0001]]);
      break;
    }
    case 'torresmo': {
      // Assobio de queda (0,9 s), o estrondo do impacto e o chiado da gordura.
      const x = def.p.atraso! / 1000;
      osc('sine', 2100, 260, 0, x, ganho([[0, 0.0001], [0.2, 0.12], [x, 0.16]]));
      ruidoEm(0, x, 'bandpass', 1200, 400, 2, [[0, 0.0001], [x, 0.18]]);
      estrondo(x, 1, 150);
      estrondo(x + 0.07, 0.5, 70);
      ruidoEm(x + 0.1, 1.2, 'highpass', 3000, 5200, 0.8, [[0, 0.12], [1.2, 0.0001]]);
      break;
    }
    case 'garcom': {
      // Voz do além (seno com vibrato largo) e uma bandejada por alvo.
      const D = def.dura / 1000;
      const gv = ganho([[0, 0.0001], [0.15, 0.09], [D - 0.2, 0.07], [D, 0.0001]]);
      const o = osc('sine', 620, 380, 0, D, gv, 'lin');
      const lfo = a.createOscillator();
      lfo.frequency.value = 6;
      const prof = a.createGain();
      prof.gain.value = 40;
      lfo.connect(prof).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + D + 0.05);
      const n = Math.max(1, quantos(tipo, d));
      for (let i = 0; i < n; i++) {
        const x = (def.p.atraso! + i * def.p.passo!) / 1000;
        for (let k = 0; k < 3; k++) tim(x, 1700 - k * 320, 0.3, 0.06, 'sawtooth');
        ruidoEm(x, 0.08, 'bandpass', 2400, 1800, 1.5, [[0, 0.35], [0.08, 0.0001]]);
        osc('sine', 160, 60, x, x + 0.15, ganho([[x, 0.4], [x + 0.15, 0.0001]]));
      }
      break;
    }
    case 'pinga': {
      // Bola de fogo voando (lufada que sobe) e a explosão com o fogo estalando.
      const x = d ? vooPinga(d as Disparo) / 1000 : 0.6;
      ruidoEm(0, Math.max(0.1, x), 'bandpass', 600, 1500, 1.4, [[0, 0.0001], [0.05, 0.4], [Math.max(0.1, x), 0.3]]);
      estrondo(x, 0.9, 120);
      ruidoEm(x, 1.3, 'bandpass', 1400, 900, 0.9, [[0, 0.35], [1.3, 0.0001]]);
      for (let i = 0; i < 14; i++) ruidoEm(x + 0.1 + rnd() * 1.1, 0.025, 'highpass', 3000, 5000, 1, [[0, 0.22], [0.025, 0.0001]]);
      break;
    }
    case 'ima': {
      // O puxão (grave que cai e tremido que acelera), o silêncio de um instante e a implosão.
      const x = def.p.atraso! / 1000;
      const gp = ganho([[0, 0.0001], [0.1, 0.3], [x - 0.05, 0.35], [x, 0.0001]]);
      const o = osc('square', 420, 70, 0, x, gp);
      const lfo = a.createOscillator();
      lfo.frequency.setValueAtTime(6, t);
      lfo.frequency.linearRampToValueAtTime(28, t + x);
      const prof = a.createGain();
      prof.gain.value = 30;
      lfo.connect(prof).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + x + 0.05);
      ruidoEm(0, x, 'bandpass', 4000, 300, 2, [[0, 0.0001], [x - 0.05, 0.25], [x, 0.0001]]);
      osc('sine', 40, 180, x - 0.05, x + 0.05, ganho([[x - 0.05, 0.6], [x + 0.05, 0.0001]]));
      estrondo(x + 0.05, 1, 160);
      break;
    }
  }
}
