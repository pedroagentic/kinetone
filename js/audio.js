import { midiToFreq, clamp } from "./util.js";

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.kit = null;
    this.ready = false;
    this.volume = 0.82;
  }

  init() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = this.volume;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.16;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2.5;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.05;

    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.18;
    const delayGain = ctx.createGain();
    delayGain.gain.value = 0.12;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = "lowpass";
    delayFilter.frequency.value = 2400;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.18;

    master.connect(comp);
    comp.connect(limiter);
    limiter.connect(ctx.destination);

    master.connect(delay);
    delay.connect(delayFilter);
    delayFilter.connect(delayGain);
    delayGain.connect(limiter);
    delay.connect(feedback);
    feedback.connect(delay);

    this.ctx = ctx;
    this.master = master;
    this.delay = delay;
    this.delayGain = delayGain;
    this.delayFilter = delayFilter;
    this.shaper = this.makeShaper();
    this.ready = true;
  }

  makeShaper() {
    const shaper = this.ctx.createWaveShaper();
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 2.6);
    }
    shaper.curve = curve;
    shaper.oversample = "2x";
    return shaper;
  }

  async resume() {
    this.init();
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  setKit(kit) {
    this.kit = kit;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.delay.delayTime.setTargetAtTime(kit.delay, t, 0.05);
    this.delayGain.gain.setTargetAtTime(
      kit.timbre === "lush" ? 0.2 : kit.timbre === "harsh" ? 0.06 : 0.12,
      t,
      0.05
    );
    this.delayFilter.frequency.setTargetAtTime(kit.filter, t, 0.05);
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.master) {
      this.master.gain.setTargetAtTime(
        this.volume,
        this.ctx.currentTime,
        0.02
      );
    }
  }

  now() {
    return this.ctx.currentTime + 0.003;
  }

  osc(type, freq, t0) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t0);
    return o;
  }

  gain(t0, v = 0) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(v, t0);
    return g;
  }

  filter(type, freq, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  noise(duration) {
    const n = Math.max(1, Math.ceil(this.ctx.sampleRate * duration));
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  karplus(freq, duration, decay) {
    const sr = this.ctx.sampleRate;
    const period = Math.max(2, Math.floor(sr / freq));
    const n = Math.floor(sr * duration);
    const buf = this.ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < period; i++) d[i] = Math.random() * 2 - 1;
    for (let i = period; i < n; i++) {
      const a = d[i - period];
      const b = i - period + 1 < n ? d[i - period + 1] : a;
      d[i] = ((a + b) * 0.5) * decay;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  env(g, t0, peak, a, d) {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  out(node, wet = false) {
    if (this.kit?.timbre === "harsh") {
      node.connect(this.shaper);
      this.shaper.connect(this.master);
    } else {
      node.connect(this.master);
    }
  }

  note(index, octave = 0) {
    const scale = this.kit.scale;
    const i = ((index % scale.length) + scale.length) % scale.length;
    return midiToFreq(scale[i] + octave * 12);
  }

  oscType() {
    switch (this.kit.timbre) {
      case "acid":
        return "square";
      case "digital":
        return "sawtooth";
      case "harsh":
        return "sawtooth";
      case "lofi":
        return "triangle";
      case "warm":
        return "sine";
      case "crystal":
        return "sine";
      case "organic":
        return "triangle";
      case "lush":
        return "sawtooth";
      default:
        return "sine";
    }
  }

  play(voice) {
    if (!this.ctx || !this.kit) return;
    const t0 = this.now();
    const k = this.kit;
    switch (voice) {
      case "kick":
        return this.kick(t0, k);
      case "snare":
        return this.snare(t0, k);
      case "hat":
        return this.hat(t0, k);
      case "clap":
        return this.clap(t0, k);
      case "tom":
        return this.tom(t0, k);
      case "rim":
        return this.rim(t0, k);
      case "cymbal":
        return this.cymbal(t0, k);
      case "perc":
        return this.perc(t0, k);
      case "shaker":
        return this.shaker(t0, k);
      case "noise":
        return this.noiseHit(t0, k);
      case "bass0":
        return this.bass(t0, k, 0);
      case "bass1":
        return this.bass(t0, k, 2);
      case "bass2":
        return this.bass(t0, k, 4);
      case "pluck0":
        return this.pluck(t0, k, 0);
      case "pluck1":
        return this.pluck(t0, k, 2);
      case "pluck2":
        return this.pluck(t0, k, 4);
      case "pluck3":
        return this.pluck(t0, k, 6);
      case "bell0":
        return this.bell(t0, k, 3);
      case "bell1":
        return this.bell(t0, k, 5);
      case "lead0":
        return this.lead(t0, k, 1);
      case "lead1":
        return this.lead(t0, k, 3);
      case "lead2":
        return this.lead(t0, k, 5);
      case "lead3":
        return this.lead(t0, k, 7);
      case "chord":
        return this.chord(t0, k);
      case "laser":
        return this.laser(t0, k);
      case "whoosh":
        return this.whoosh(t0, k);
      case "arp0":
        return this.arp(t0, k, 0);
      case "arp1":
        return this.arp(t0, k, 2);
      case "arp2":
        return this.arp(t0, k, 4);
      case "arp3":
        return this.arp(t0, k, 6);
      case "pad":
        return this.pad(t0, k);
      case "glass":
        return this.glass(t0, k);
      case "sub":
        return this.sub(t0, k);
      case "reverse":
        return this.reverse(t0, k);
      case "drip":
        return this.drip(t0, k);
      case "sting":
        return this.sting(t0, k);
      case "wipe":
        return this.wipe(t0, k);
      default:
        return this.pluck(t0, k, 0);
    }
  }

  kick(t0, k) {
    const o = this.osc("sine", 170 * k.kickPitch, t0);
    o.frequency.exponentialRampToValueAtTime(42 * k.kickPitch, t0 + 0.11);
    const g = this.gain(t0);
    this.env(g, t0, 1.05, 0.004, 0.32 * k.decay);
    o.connect(g);
    this.out(g);
    o.start(t0);
    o.stop(t0 + 0.4 * k.decay);

    const click = this.osc("square", 1400 * k.brightness, t0);
    const cg = this.gain(t0);
    this.env(cg, t0, 0.07, 0.001, 0.025);
    const hp = this.filter("highpass", 900);
    click.connect(hp);
    hp.connect(cg);
    cg.connect(this.master);
    click.start(t0);
    click.stop(t0 + 0.04);
  }

  snare(t0, k) {
    const n = this.noise(0.35);
    const bp = this.filter("bandpass", 1800 * k.brightness, 0.9);
    const hp = this.filter("highpass", 700);
    const ng = this.gain(t0);
    this.env(ng, t0, 0.55, 0.002, 0.18 * k.decay);
    n.connect(hp);
    hp.connect(bp);
    bp.connect(ng);
    ng.connect(this.master);
    n.start(t0);
    n.stop(t0 + 0.35);

    const t = this.osc("triangle", 186, t0);
    t.frequency.exponentialRampToValueAtTime(140, t0 + 0.08);
    const tg = this.gain(t0);
    this.env(tg, t0, 0.35, 0.002, 0.14 * k.decay);
    t.connect(tg);
    tg.connect(this.master);
    t.start(t0);
    t.stop(t0 + 0.2);
  }

  hat(t0, k) {
    const n = this.noise(0.15);
    const hp = this.filter("highpass", 7000 * Math.min(k.brightness, 1.4));
    const g = this.gain(t0);
    this.env(g, t0, 0.28, 0.001, 0.055 * k.decay);
    n.connect(hp);
    hp.connect(g);
    g.connect(this.master);
    n.start(t0);
    n.stop(t0 + 0.12);
  }

  clap(t0, k) {
    const bursts = [0, 0.012, 0.024, 0.048];
    bursts.forEach((off, i) => {
      const n = this.noise(0.2);
      const bp = this.filter("bandpass", 1200, 0.8);
      const g = this.gain(t0 + off);
      this.env(g, t0 + off, i === bursts.length - 1 ? 0.5 : 0.22, 0.001, 0.12 * k.decay);
      n.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      n.start(t0 + off);
      n.stop(t0 + off + 0.2);
    });
  }

  tom(t0, k) {
    const o = this.osc("sine", 220 * k.kickPitch, t0);
    o.frequency.exponentialRampToValueAtTime(90 * k.kickPitch, t0 + 0.16);
    const g = this.gain(t0);
    this.env(g, t0, 0.7, 0.004, 0.28 * k.decay);
    o.connect(g);
    this.out(g);
    o.start(t0);
    o.stop(t0 + 0.35);
  }

  rim(t0, k) {
    const o = this.osc("square", 820, t0);
    const bp = this.filter("bandpass", 1400, 4);
    const g = this.gain(t0);
    this.env(g, t0, 0.22, 0.001, 0.05);
    o.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.08);
    const n = this.noise(0.06);
    const ng = this.gain(t0);
    this.env(ng, t0, 0.15, 0.001, 0.04);
    const hp = this.filter("highpass", 2000);
    n.connect(hp);
    hp.connect(ng);
    ng.connect(this.master);
    n.start(t0);
    n.stop(t0 + 0.06);
  }

  cymbal(t0, k) {
    const n = this.noise(1.1);
    const bp = this.filter("bandpass", 5000 * k.brightness, 0.6);
    const hp = this.filter("highpass", 4000);
    const g = this.gain(t0);
    this.env(g, t0, 0.32, 0.002, 0.7 * k.decay);
    n.connect(hp);
    hp.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    n.start(t0);
    n.stop(t0 + 1.0);
  }

  perc(t0, k) {
    const f = this.note(4, 1);
    const o = this.osc("triangle", f, t0);
    o.frequency.exponentialRampToValueAtTime(f * 0.7, t0 + 0.08);
    const g = this.gain(t0);
    this.env(g, t0, 0.4, 0.002, 0.16 * k.decay);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.2);
  }

  shaker(t0, k) {
    const n = this.noise(0.18);
    const bp = this.filter("bandpass", 6000, 1.2);
    const g = this.gain(t0);
    this.env(g, t0, 0.22, 0.004, 0.1);
    n.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    n.start(t0);
    n.stop(t0 + 0.18);
  }

  noiseHit(t0, k) {
    const n = this.noise(0.5);
    const f = this.filter("lowpass", 800 * k.brightness);
    f.frequency.setValueAtTime(2400, t0);
    f.frequency.exponentialRampToValueAtTime(280, t0 + 0.28);
    const g = this.gain(t0);
    this.env(g, t0, 0.4, 0.01, 0.32 * k.decay);
    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    n.start(t0);
    n.stop(t0 + 0.5);
  }

  bass(t0, k, idx) {
    const f = this.note(idx, -1);
    const type = k.timbre === "acid" ? "square" : k.timbre === "organic" ? "sine" : this.oscType();
    const o = this.osc(type, f, t0);
    const o2 = this.osc("sine", f * 0.5, t0);
    const lp = this.filter("lowpass", k.filter * 0.45, 1.1);
    if (k.timbre === "acid") {
      lp.Q.value = 8;
      lp.frequency.setValueAtTime(400, t0);
      lp.frequency.exponentialRampToValueAtTime(k.filter, t0 + 0.08);
      lp.frequency.exponentialRampToValueAtTime(280, t0 + 0.28);
    }
    const g = this.gain(t0);
    this.env(g, t0, 0.55, 0.008, 0.34 * k.decay);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    this.out(g);
    o.start(t0);
    o2.start(t0);
    o.stop(t0 + 0.45);
    o2.stop(t0 + 0.45);
  }

  pluck(t0, k, idx) {
    const f = this.note(idx, 0);
    if (k.timbre === "organic") {
      const src = this.karplus(f, 0.7, 0.992);
      const g = this.gain(t0);
      this.env(g, t0, 0.5, 0.002, 0.45 * k.decay);
      const bp = this.filter("lowpass", k.filter);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(t0);
      src.stop(t0 + 0.7);
      return;
    }
    const o = this.osc(this.oscType(), f, t0);
    const o2 = this.osc("sine", f * 2, t0);
    const lp = this.filter("lowpass", k.filter, 0.8);
    const g = this.gain(t0);
    this.env(g, t0, 0.38, 0.004, 0.28 * k.decay);
    const g2 = this.gain(t0);
    this.env(g2, t0, 0.12, 0.002, 0.12);
    o.connect(lp);
    lp.connect(g);
    o2.connect(g2);
    g.connect(this.master);
    g2.connect(this.master);
    o.start(t0);
    o2.start(t0);
    o.stop(t0 + 0.4);
    o2.stop(t0 + 0.2);
  }

  bell(t0, k, idx) {
    const f = this.note(idx, 1);
    const ratios = [1, 2.76, 5.4, 8.93];
    const gains = [0.28, 0.16, 0.08, 0.04];
    ratios.forEach((r, i) => {
      const o = this.osc("sine", f * r, t0);
      const g = this.gain(t0);
      this.env(g, t0, gains[i] * k.brightness, 0.004, (0.55 - i * 0.08) * k.decay);
      o.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + 0.8);
    });
  }

  lead(t0, k, idx) {
    const f = this.note(idx, 1);
    const o = this.osc(this.oscType(), f, t0);
    const o2 = this.osc(this.oscType(), f * 1.005, t0);
    const lp = this.filter("lowpass", k.filter * 0.9, 0.9);
    const g = this.gain(t0);
    this.env(g, t0, 0.28, 0.01, 0.32 * k.decay);
    o.connect(lp);
    o2.connect(lp);
    lp.connect(g);
    this.out(g);
    o.start(t0);
    o2.start(t0);
    o.stop(t0 + 0.45);
    o2.stop(t0 + 0.45);
  }

  chord(t0, k) {
    [0, 2, 4].forEach((idx, i) => {
      const f = this.note(idx, 0);
      const o = this.osc(k.timbre === "lush" ? "sawtooth" : "sine", f, t0);
      const g = this.gain(t0);
      this.env(g, t0, 0.16, 0.03, 0.55 * k.decay);
      const lp = this.filter("lowpass", k.filter * 0.7);
      o.connect(lp);
      lp.connect(g);
      g.connect(this.master);
      o.start(t0);
      o.stop(t0 + 0.7);
    });
  }

  laser(t0, k) {
    const o = this.osc("square", this.note(8, 2), t0);
    o.frequency.exponentialRampToValueAtTime(this.note(0, 0), t0 + 0.22);
    const g = this.gain(t0);
    this.env(g, t0, 0.22, 0.004, 0.22);
    const lp = this.filter("lowpass", 2800);
    o.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.28);
  }

  whoosh(t0, k) {
    const n = this.noise(0.7);
    const f = this.filter("bandpass", 400, 2);
    f.frequency.setValueAtTime(300, t0);
    f.frequency.exponentialRampToValueAtTime(2400 * k.brightness, t0 + 0.25);
    f.frequency.exponentialRampToValueAtTime(500, t0 + 0.55);
    const g = this.gain(t0);
    this.env(g, t0, 0.35, 0.04, 0.5 * k.decay);
    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    n.start(t0);
    n.stop(t0 + 0.7);
  }

  arp(t0, k, idx) {
    const f = this.note(idx, 1);
    const o = this.osc(k.timbre === "acid" ? "square" : "triangle", f, t0);
    const g = this.gain(t0);
    this.env(g, t0, 0.26, 0.003, 0.14 * k.decay);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.2);
  }

  pad(t0, k) {
    [0, 2, 4, 6].forEach((idx) => {
      const f = this.note(idx, 0);
      const o = this.osc("sawtooth", f, t0);
      const o2 = this.osc("sawtooth", f * 1.007, t0);
      const lp = this.filter("lowpass", k.filter * 0.5, 0.4);
      const g = this.gain(t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.07, t0 + 0.12);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9 * k.decay);
      o.connect(lp);
      o2.connect(lp);
      lp.connect(g);
      g.connect(this.master);
      o.start(t0);
      o2.start(t0);
      o.stop(t0 + 1.0);
      o2.stop(t0 + 1.0);
    });
  }

  glass(t0, k) {
    const f = this.note(7, 2);
    const o = this.osc("sine", f, t0);
    const m = this.osc("sine", f * 2.2, t0);
    const gmod = this.gain(t0, f * 1.4);
    m.connect(gmod);
    gmod.connect(o.frequency);
    const g = this.gain(t0);
    this.env(g, t0, 0.22, 0.004, 0.5 * k.decay);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    m.start(t0);
    o.stop(t0 + 0.6);
    m.stop(t0 + 0.6);
  }

  sub(t0, k) {
    const f = this.note(0, -2);
    const o = this.osc("sine", Math.max(32, f), t0);
    const g = this.gain(t0);
    this.env(g, t0, 0.7, 0.02, 0.4 * k.decay);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.5);
  }

  reverse(t0, k) {
    const n = this.noise(0.55);
    const f = this.filter("lowpass", 400);
    f.frequency.setValueAtTime(200, t0);
    f.frequency.exponentialRampToValueAtTime(5000 * k.brightness, t0 + 0.42);
    const g = this.gain(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    n.start(t0);
    n.stop(t0 + 0.55);
  }

  drip(t0, k) {
    const f = this.note(6, 2);
    const o = this.osc("sine", f * 1.6, t0);
    o.frequency.exponentialRampToValueAtTime(f, t0 + 0.12);
    const g = this.gain(t0);
    this.env(g, t0, 0.28, 0.004, 0.22 * k.decay);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + 0.28);
  }

  sting(t0, k) {
    const f = this.note(8, 1);
    const o = this.osc("sawtooth", f, t0);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, t0 + 0.18);
    const g = this.gain(t0);
    this.env(g, t0, 0.3, 0.002, 0.28 * k.decay);
    const lp = this.filter("lowpass", k.filter);
    o.connect(lp);
    lp.connect(g);
    this.out(g);
    o.start(t0);
    o.stop(t0 + 0.35);
  }

  wipe(t0, k) {
    const n = this.noise(0.45);
    const f = this.filter("bandpass", 900, 1.4);
    f.frequency.setValueAtTime(400, t0);
    f.frequency.exponentialRampToValueAtTime(2200, t0 + 0.28);
    const g = this.gain(t0);
    this.env(g, t0, 0.22, 0.02, 0.32);
    n.connect(f);
    f.connect(g);
    g.connect(this.master);
    n.start(t0);
    n.stop(t0 + 0.45);
  }
}
