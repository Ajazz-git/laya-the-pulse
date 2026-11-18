// Tiny WebAudio synth. Audio is opt-in: nothing plays until enable() is called from a user gesture.
let ctx = null;
let master = null;
let on = false;

export const audio = {
  get enabled() {
    return on;
  },

  get ready() {
    return !!ctx;
  },

  listeners: [],
  onchange(fn) {
    this.listeners.push(fn);
  },

  // Turn sound on from a user gesture if it has never been enabled. Respects an explicit mute.
  ensure() {
    if (!ctx) this.enable();
    return on;
  },

  enable() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    on = true;
    this.listeners.forEach((f) => f());
  },

  toggle() {
    if (!ctx) return;
    on = !on;
    master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05);
    this.listeners.forEach((f) => f());
  },

  // Soft kick used for the entrance "thump".
  kick() {
    if (!on) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.45);
  },

  // Hits for the opening drumhead. kind: 'kick' | 'tom' | 'tick'
  hit(kind, power = 1, pitch = 1) {
    if (!on) return;
    const t = ctx.currentTime;
    if (kind === 'kick' || kind === 'tom') {
      const base = (kind === 'kick' ? 130 : 210) * pitch;
      const end = (kind === 'kick' ? 40 : 95) * pitch;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(end, t + 0.18);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.85 * power, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'kick' ? 0.45 : 0.3));
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.5);
      return;
    }
    // tick: a short filtered noise burst, like a rim or shaker
    const len = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 5200;
    f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = 0.32 * power;
    src.connect(f).connect(g).connect(master);
    src.start(t);
  },

  // Full kit for the drum chapter. kind: kick | snare | hat | openhat | tom | tom2 | crash
  drum(kind, power = 1) {
    if (!on) return;
    const t = ctx.currentTime;
    if (kind === 'kick') return this.hit('kick', power);
    if (kind === 'tom') return this.hit('tom', power, 1);
    if (kind === 'tom2') return this.hit('tom', power, 0.72);
    const noise = (dur, type, freq, q, gain) => {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain * power;
      src.connect(f).connect(g).connect(master);
      src.start(t);
    };
    if (kind === 'snare') {
      noise(0.22, 'bandpass', 2100, 0.8, 0.55);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(230, t);
      o.frequency.exponentialRampToValueAtTime(150, t + 0.1);
      g.gain.setValueAtTime(0.5 * power, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.2);
    } else if (kind === 'hat') noise(0.06, 'highpass', 7500, 0.7, 0.3);
    else if (kind === 'openhat') noise(0.3, 'highpass', 7000, 0.7, 0.26);
    else if (kind === 'crash') noise(1.3, 'highpass', 5200, 0.6, 0.34);
  },

  // A sustained, glideable voice. kind: 'flute' | 'lead'. Returns { on, glide, vib, off } or null when muted.
  voice(kind) {
    if (!on) return null;
    const flute = kind === 'flute';
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = flute ? 4200 : 3200;
    filt.Q.value = flute ? 0.7 : 3;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = flute ? 5.2 : 5.8;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0;
    lfo.connect(lfoG);

    const parts = flute
      ? [{ type: 'triangle', mult: 1, gain: 1 }, { type: 'sine', mult: 2, gain: 0.16 }]
      : [{ type: 'sawtooth', mult: 1, gain: 0.8 }, { type: 'square', mult: 1.006, gain: 0.35 }];
    const oscs = parts.map((p) => {
      const o = ctx.createOscillator();
      o.type = p.type;
      const g = ctx.createGain();
      g.gain.value = p.gain;
      lfoG.connect(o.frequency);
      o.connect(g);
      return { o, g, mult: p.mult };
    });

    let shaper = null;
    if (!flute) {
      shaper = ctx.createWaveShaper();
      const n = 1024;
      const curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * 7);
      }
      shaper.curve = curve;
      oscs.forEach((x) => x.g.connect(shaper));
      shaper.connect(filt);
    } else {
      oscs.forEach((x) => x.g.connect(filt));
      // breath: a little band-passed noise riding on the tone
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const ns = ctx.createBufferSource();
      ns.buffer = buf;
      ns.loop = true;
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass';
      nf.frequency.value = 3200;
      nf.Q.value = 0.9;
      const ng = ctx.createGain();
      ng.gain.value = 0.05;
      ns.connect(nf).connect(ng).connect(filt);
      ns.start();
      oscs.noise = ns;
    }
    filt.connect(out).connect(master);

    const peak = flute ? 0.5 : 0.26;
    let started = false;
    let dead = false;
    return {
      on(freq) {
        const t = ctx.currentTime;
        oscs.forEach((x) => x.o.frequency.setValueAtTime(freq * x.mult, t));
        if (!started) {
          oscs.forEach((x) => x.o.start(t));
          lfo.start(t);
          started = true;
        }
        out.gain.cancelScheduledValues(t);
        out.gain.setTargetAtTime(peak, t, flute ? 0.07 : 0.015);
        if (!flute) {
          filt.frequency.setValueAtTime(5200, t);
          filt.frequency.setTargetAtTime(3000, t, 0.25);
        }
      },
      glide(freq, tc = 0.06) {
        if (!started || dead) return;
        const t = ctx.currentTime;
        oscs.forEach((x) => x.o.frequency.setTargetAtTime(freq * x.mult, t, tc));
      },
      vib(depthHz) {
        if (!started || dead) return;
        lfoG.gain.setTargetAtTime(depthHz, ctx.currentTime, 0.12);
      },
      off() {
        if (dead) return;
        dead = true;
        const t = ctx.currentTime;
        out.gain.cancelScheduledValues(t);
        out.gain.setTargetAtTime(0.0001, t, flute ? 0.12 : 0.08);
        setTimeout(() => {
          try {
            oscs.forEach((x) => x.o.stop());
            lfo.stop();
            oscs.noise?.stop();
          } catch {}
        }, 900);
      },
    };
  },

  // Plucked bass string. Upper partial added so small speakers can still hear it.
  pluck(freq, velocity = 0.6) {
    if (!on) return;
    const t = ctx.currentTime;
    const v = Math.min(1, Math.max(0.15, velocity));

    const body = ctx.createOscillator();
    body.type = 'sawtooth';
    body.frequency.value = freq;

    const upper = ctx.createOscillator();
    upper.type = 'triangle';
    upper.frequency.value = freq * 2;
    const upperGain = ctx.createGain();
    upperGain.gain.value = 0.45;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 4;
    filter.frequency.setValueAtTime(1100, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + 0.9);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);

    body.connect(filter);
    upper.connect(upperGain).connect(filter);
    filter.connect(env).connect(master);

    body.start(t);
    upper.start(t);
    body.stop(t + 2.3);
    upper.stop(t + 2.3);
  },
};
