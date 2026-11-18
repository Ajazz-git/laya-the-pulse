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
  },

  toggle() {
    if (!ctx) return;
    on = !on;
    master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05);
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
  hit(kind, power = 1) {
    if (!on) return;
    const t = ctx.currentTime;
    if (kind === 'kick' || kind === 'tom') {
      const base = kind === 'kick' ? 130 : 210;
      const end = kind === 'kick' ? 40 : 95;
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
