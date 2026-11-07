import { settings } from './settings';
import type { WeaponId } from './weapons';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let musicStarted = false;

export function applyVolumes() {
  if (!ctx || !master || !sfxBus || !musicBus) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.master * 0.5, t, 0.05);
  sfxBus.gain.setTargetAtTime(settings.sfx, t, 0.05);
  musicBus.gain.setTargetAtTime(settings.music * 0.55, t, 0.1);
}

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      sfxBus = ctx.createGain();
      musicBus = ctx.createGain();
      sfxBus.connect(master);
      musicBus.connect(master);
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVolumes();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    startMusic();
  } catch {
    /* audio not available */
  }
}

/** Мрачный эмбиент: дрон + ветер + редкие низкие удары */
function startMusic() {
  if (musicStarted || !ctx || !musicBus || !noiseBuf) return;
  musicStarted = true;
  const c = ctx;
  const out = c.createGain();
  out.gain.value = 0.6;
  out.connect(musicBus);

  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 260;
  filt.Q.value = 4;
  filt.connect(out);
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoG = c.createGain();
  lfoG.gain.value = 140;
  lfo.connect(lfoG);
  lfoG.connect(filt.frequency);
  lfo.start();

  const freqs = [55, 55.4, 82.4, 110.3];
  freqs.forEach((f, i) => {
    const o = c.createOscillator();
    o.type = i < 2 ? 'sawtooth' : 'triangle';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.value = i < 2 ? 0.16 : 0.1;
    o.connect(g);
    g.connect(filt);
    o.start();
  });

  // ветер
  const wind = c.createBufferSource();
  wind.buffer = noiseBuf;
  wind.loop = true;
  const wf = c.createBiquadFilter();
  wf.type = 'bandpass';
  wf.frequency.value = 500;
  wf.Q.value = 0.6;
  const wl = c.createOscillator();
  wl.frequency.value = 0.11;
  const wlg = c.createGain();
  wlg.gain.value = 260;
  wl.connect(wlg);
  wlg.connect(wf.frequency);
  wl.start();
  const wg = c.createGain();
  wg.gain.value = 0.06;
  wind.connect(wf);
  wf.connect(wg);
  wg.connect(out);
  wind.start();

  // редкие удары
  const thump = () => {
    if (!ctx || !musicBus) return;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(70, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(30, c.currentTime + 1.2);
    const g = c.createGain();
    g.gain.setValueAtTime(0.35, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.4);
    o.connect(g);
    g.connect(out);
    o.start();
    o.stop(c.currentTime + 1.5);
    setTimeout(thump, 6000 + Math.random() * 9000);
  };
  setTimeout(thump, 4000);
}

function noise(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'lowpass', slideTo?: number, delay = 0) {
  if (!ctx || !sfxBus || !noiseBuf) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  src.start(t0, Math.random() * 0.5, dur + 0.05);
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', slideTo?: number, delay = 0) {
  if (!ctx || !sfxBus) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g);
  g.connect(sfxBus);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  shot(kind: WeaponId) {
    switch (kind) {
      case 'pistol':
        noise(0.14, 2400, 0.7, 0.8);
        tone(160, 0.1, 0.4, 'triangle', 60);
        break;
      case 'aps':
        noise(0.1, 2600, 0.7, 0.6);
        tone(170, 0.08, 0.35, 'triangle', 65);
        break;
      case 'revolver':
        noise(0.28, 1500, 0.6, 1.0);
        tone(100, 0.22, 0.6, 'triangle', 40);
        break;
      case 'smg':
        noise(0.09, 2800, 0.7, 0.6);
        tone(180, 0.07, 0.3, 'triangle', 70);
        break;
      case 'silsmg':
        noise(0.05, 5200, 1, 0.22, 'highpass');
        tone(300, 0.04, 0.1, 'square', 200);
        break;
      case 'sawedoff':
        noise(0.4, 1200, 0.6, 1.2);
        tone(80, 0.3, 0.8, 'triangle', 32);
        break;
      case 'shotgun':
        noise(0.35, 1400, 0.6, 1.1);
        tone(90, 0.25, 0.7, 'triangle', 35);
        break;
      case 'autoshotgun':
        noise(0.28, 1600, 0.6, 1.0);
        tone(100, 0.2, 0.6, 'triangle', 40);
        break;
      case 'carbine':
        noise(0.24, 1700, 0.7, 1.0);
        tone(110, 0.2, 0.6, 'triangle', 42);
        break;
      case 'glock':
      case 'uzi':
      case 'mp5':
      case 'p90':
        noise(0.09, 2700, 0.7, 0.55);
        tone(175, 0.07, 0.3, 'triangle', 68);
        break;
      case 'deagle':
        noise(0.3, 1400, 0.6, 1.0);
        tone(95, 0.24, 0.65, 'triangle', 38);
        break;
      case 'doublebarrel':
      case 'spas':
        noise(0.36, 1300, 0.6, 1.1);
        tone(85, 0.26, 0.7, 'triangle', 34);
        break;
      case 'mosin':
        noise(0.45, 1200, 0.6, 1.1);
        tone(75, 0.35, 0.75, 'triangle', 30);
        break;
      case 'akm':
      case 'm4':
      case 'pkm':
        noise(0.15, 1900, 0.7, 0.9);
        tone(115, 0.13, 0.5, 'triangle', 44);
        break;
      case 'vss':
        noise(0.05, 5000, 1, 0.2, 'highpass');
        tone(280, 0.04, 0.1, 'square', 190);
        break;
      case 'rifle':
        noise(0.16, 2000, 0.7, 0.9);
        tone(120, 0.14, 0.5, 'triangle', 45);
        break;
      case 'lmg':
        noise(0.14, 1800, 0.7, 0.9);
        tone(105, 0.12, 0.55, 'triangle', 42);
        break;
      case 'minigun':
        noise(0.07, 2200, 0.7, 0.65);
        tone(130, 0.05, 0.35, 'triangle', 60);
        break;
      case 'sniper':
        noise(0.55, 1100, 0.6, 1.2);
        tone(70, 0.4, 0.8, 'triangle', 28);
        break;
      case 'amr':
        noise(0.8, 900, 0.6, 1.4);
        tone(55, 0.55, 1, 'triangle', 22);
        break;
      case 'railgun':
        tone(1800, 0.35, 0.35, 'sawtooth', 120);
        noise(0.4, 6000, 1, 0.5, 'highpass', 500);
        tone(60, 0.4, 0.7, 'sine', 25);
        break;
      case 'plasma':
        tone(900, 0.14, 0.3, 'square', 260);
        tone(420, 0.12, 0.2, 'sawtooth', 160);
        break;
      case 'tesla':
        noise(0.12, 3800, 3, 0.55, 'bandpass', 900);
        tone(240, 0.1, 0.28, 'sawtooth', 1200);
        break;
      case 'flamer':
        noise(0.12, 900, 0.5, 0.55, 'lowpass', 400);
        break;
      case 'rpg':
        noise(0.5, 1400, 0.6, 1.0, 'lowpass', 300);
        tone(130, 0.4, 0.6, 'sawtooth', 40);
        break;
      case 'cryo':
        noise(0.12, 7000, 1.5, 0.35, 'highpass', 3000);
        tone(1400, 0.1, 0.18, 'sine', 600);
        break;
      case 'blackhole':
        tone(400, 0.7, 0.4, 'sine', 40);
        tone(200, 0.7, 0.3, 'sawtooth', 30);
        break;
      case 'swarm':
        for (let i = 0; i < 6; i++) noise(0.3, 1500, 0.6, 0.45, 'lowpass', 400, i * 0.045);
        break;
      case 'nuke':
        tone(220, 0.9, 0.7, 'sawtooth', 40);
        noise(0.9, 1000, 0.6, 1.2, 'lowpass', 150);
        break;
      default:
        noise(0.1, 2000, 0.7, 0.5);
    }
  },
  explosion(radius = 120) {
    const k = Math.min(3, radius / 120);
    noise(0.5 + k * 0.5, 1100, 0.6, 1.2, 'lowpass', 90);
    tone(90, 0.5 + k * 0.4, 0.9, 'triangle', 24);
    if (k > 1.5) tone(40, 1.8, 1, 'sine', 18);
  },
  enemyShot() {
    noise(0.12, 1800, 0.7, 0.35);
  },
  spit() {
    noise(0.18, 1400, 2, 0.4, 'bandpass', 600);
    tone(380, 0.15, 0.2, 'sine', 160);
  },
  scream() {
    tone(620, 0.9, 0.3, 'sawtooth', 1100);
    tone(930, 0.9, 0.18, 'square', 1500);
    noise(0.8, 2400, 2, 0.25, 'bandpass', 1600);
  },
  roar() {
    tone(70, 1.2, 0.7, 'sawtooth', 38);
    noise(1.0, 400, 1, 0.5, 'lowpass', 120);
  },
  stomp() {
    tone(60, 0.5, 0.9, 'sine', 20);
    noise(0.4, 500, 1, 0.8, 'lowpass', 100);
  },
  leap() {
    noise(0.2, 1200, 1, 0.4, 'bandpass', 3000);
  },
  hit() {
    noise(0.07, 700, 1, 0.35);
  },
  clang() {
    tone(1200, 0.08, 0.2, 'square', 900);
    noise(0.04, 5000, 2, 0.25, 'highpass');
  },
  zombieDie() {
    tone(150, 0.35, 0.25, 'sawtooth', 50);
    noise(0.2, 500, 1, 0.25);
  },
  hurt() {
    tone(110, 0.2, 0.5, 'square', 60);
    noise(0.12, 400, 1, 0.4);
  },
  empty() {
    noise(0.03, 5000, 2, 0.4, 'highpass');
  },
  reload() {
    noise(0.04, 4000, 2, 0.5, 'highpass');
    setTimeout(() => noise(0.05, 3000, 2, 0.5, 'highpass'), 380);
  },
  reloadDone() {
    noise(0.05, 3500, 2, 0.6, 'highpass');
    tone(220, 0.05, 0.2, 'square', 140);
  },
  pickup() {
    tone(660, 0.08, 0.25, 'triangle');
    setTimeout(() => tone(880, 0.1, 0.25, 'triangle'), 60);
  },
  buy() {
    tone(520, 0.08, 0.3, 'square');
    setTimeout(() => tone(780, 0.14, 0.3, 'square'), 80);
  },
  deny() {
    tone(150, 0.18, 0.4, 'square', 100);
  },
  wave() {
    tone(90, 0.8, 0.5, 'sawtooth', 60);
  },
  boss() {
    tone(55, 1.6, 0.8, 'sawtooth', 30);
    tone(82, 1.6, 0.5, 'square', 40);
    noise(1.4, 300, 1, 0.5, 'lowpass', 80);
  },
  flare() {
    noise(0.5, 2500, 1, 0.55, 'highpass', 800);
    tone(500, 0.3, 0.2, 'sawtooth', 200);
  },
  plane() {
    // низкий гул пролетающего самолёта
    noise(6, 260, 1.2, 0.5, 'lowpass', 180);
    tone(95, 6, 0.22, 'sawtooth', 70);
    tone(98, 6, 0.18, 'sawtooth', 72);
  },
  crateLand() {
    noise(0.4, 700, 1, 0.9, 'lowpass', 120);
    tone(70, 0.3, 0.7, 'sine', 30);
  },
  tick() {
    tone(900, 0.04, 0.12, 'square');
  },
  crateOpen() {
    noise(0.3, 3000, 1, 0.5, 'highpass');
    tone(440, 0.15, 0.3, 'triangle', 880);
    tone(660, 0.3, 0.3, 'triangle', 1320, 0.12);
    tone(880, 0.5, 0.3, 'triangle', 1760, 0.26);
  },
  click() {
    tone(520, 0.05, 0.18, 'square', 380);
  },
  hover() {
    tone(1000, 0.025, 0.06, 'triangle');
  },
  start() {
    tone(90, 0.7, 0.5, 'sawtooth', 45);
    noise(0.6, 600, 1, 0.5, 'lowpass', 200);
  },
};
