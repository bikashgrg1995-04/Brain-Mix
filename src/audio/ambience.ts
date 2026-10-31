/**
 * Ambient sound for the level map, made entirely in code (Web Audio).
 * No audio files, no recordings, no licences: nothing to credit or to clear.
 *
 * Each place has a "mix": how much wind, river, birds, temple bell and town hum.
 * Moving to another place crossfades the mix over a few seconds.
 *
 * Browsers only allow sound after a tap, so call `start()` from a user gesture.
 */
export interface SoundMix {
  wind: number;
  river: number;
  birds: number;
  bell: number;
  city: number;
}

const SILENT: SoundMix = { wind: 0, river: 0, birds: 0, bell: 0, city: 0 };
const MUTE_KEY = 'shabda.muted';

type Layer = 'wind' | 'river' | 'city';

export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private layers: Partial<Record<Layer, GainNode>> = {};
  private mix: SoundMix = { ...SILENT };
  private muted: boolean;
  private started = false;

  constructor() {
    this.muted = readMuted();
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else if (this.started && !this.muted) void this.ctx.resume();
    });
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Call from a tap/click. Safe to call again; it only starts once. */
  start(): void {
    if (this.started || this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    void this.ctx.resume();
    this.started = true;
    this.scheduleBirds();
    this.scheduleBell();
    this.apply();
  }

  /** Move to a new place's sound. Safe to call before `start()`. */
  setMix(next: SoundMix): void {
    this.mix = { ...next };
    this.apply();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* storage can be unavailable; the choice just will not persist */
    }
    if (!this.ctx || !this.master) {
      if (!muted) this.start();
      return;
    }
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(muted ? 0 : 1, t, 0.25);
    if (muted) {
      void this.ctx.suspend();
    } else {
      void this.ctx.resume();
    }
  }

  // ---------- internals ----------
  private ensure(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 1;
    master.connect(ctx.destination);
    this.master = master;

    const noise = this.makePinkNoise(ctx);

    // wind: filtered noise, volume and pitch drift slowly like gusts
    const windSrc = this.loop(ctx, noise, 0);
    const windBand = ctx.createBiquadFilter();
    windBand.type = 'bandpass';
    windBand.frequency.value = 520;
    windBand.Q.value = 0.55;
    const gust = ctx.createGain();
    gust.gain.value = 0.65;
    const gustLfo = ctx.createOscillator();
    gustLfo.frequency.value = 0.09;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 0.3;
    gustLfo.connect(gustDepth).connect(gust.gain);
    gustLfo.start();
    const pitchLfo = ctx.createOscillator();
    pitchLfo.frequency.value = 0.05;
    const pitchDepth = ctx.createGain();
    pitchDepth.gain.value = 240;
    pitchLfo.connect(pitchDepth).connect(windBand.frequency);
    pitchLfo.start();
    const wind = ctx.createGain();
    wind.gain.value = 0;
    windSrc.connect(windBand).connect(gust).connect(wind).connect(master);
    this.layers.wind = wind;

    // river: brighter, steadier noise with a quick babble
    const riverSrc = this.loop(ctx, noise, 1.7);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 380;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const babble = ctx.createGain();
    babble.gain.value = 0.8;
    const babbleLfo = ctx.createOscillator();
    babbleLfo.frequency.value = 0.45;
    const babbleDepth = ctx.createGain();
    babbleDepth.gain.value = 0.16;
    babbleLfo.connect(babbleDepth).connect(babble.gain);
    babbleLfo.start();
    const river = ctx.createGain();
    river.gain.value = 0;
    riverSrc.connect(hp).connect(lp).connect(babble).connect(river).connect(master);
    this.layers.river = river;

    // town: low murmur
    const citySrc = this.loop(ctx, noise, 3.1);
    const cityLp = ctx.createBiquadFilter();
    cityLp.type = 'lowpass';
    cityLp.frequency.value = 260;
    const city = ctx.createGain();
    city.gain.value = 0;
    citySrc.connect(cityLp).connect(city).connect(master);
    this.layers.city = city;
  }

  private makePinkNoise(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    }
    return buffer;
  }

  private loop(ctx: AudioContext, buffer: AudioBuffer, offset: number): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start(0, offset);
    return src;
  }

  private apply(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const scale: Record<Layer, number> = { wind: 0.5, river: 0.42, city: 0.32 };
    (Object.keys(scale) as Layer[]).forEach((k) => {
      this.layers[k]?.gain.setTargetAtTime(this.mix[k] * scale[k], t, 1.1);
    });
  }

  private after(ms: number, fn: () => void): void {
    window.setTimeout(fn, ms);
  }

  private canPlay(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && !this.muted && !document.hidden;
  }

  private scheduleBirds(): void {
    const tick = () => {
      if (this.canPlay() && this.mix.birds > 0.03) this.chirpPhrase();
      const gap = (2200 + Math.random() * 4800) / (0.25 + this.mix.birds);
      this.after(gap, tick);
    };
    this.after(1500, tick);
  }

  private chirpPhrase(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const notes = 2 + Math.floor(Math.random() * 3);
    const base = 2300 + Math.random() * 1900;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(master);
    for (let i = 0; i < notes; i++) {
      const start = ctx.currentTime + i * (0.11 + Math.random() * 0.05);
      const dur = 0.06 + Math.random() * 0.06;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base * (0.95 + Math.random() * 0.2), start);
      osc.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.35), start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.1 * this.mix.birds + 0.01, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g).connect(pan);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    }
  }

  private scheduleBell(): void {
    const tick = () => {
      if (this.canPlay() && this.mix.bell > 0.03) this.strikeBell();
      const gap = (9000 + Math.random() * 7000) / (0.3 + this.mix.bell);
      this.after(gap, tick);
    };
    this.after(3000, tick);
  }

  private strikeBell(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const base = 250 + Math.random() * 70;
    const ratios = [1, 2.01, 2.76, 4.07, 5.4];
    const gains = [1, 0.5, 0.34, 0.2, 0.12];
    const start = ctx.currentTime + 0.02;
    const decay = 4.5;
    ratios.forEach((ratio, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      const g = ctx.createGain();
      const peak = 0.11 * this.mix.bell * gains[i]!;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak + 0.0002, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + decay / (1 + i * 0.35));
      osc.connect(g).connect(master);
      osc.start(start);
      osc.stop(start + decay + 0.1);
    });
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
