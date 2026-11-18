// The opening: a drumhead made of dots. Seven beats (3+2+2) ripple across the skin,
// the second measure hits harder, then the head bursts outward and becomes the ribbons.
const ACCENT = [0, 3, 5]; // beat indexes that open each group of the 7
const EIGHTH = 0.23; // seconds per beat
const MEASURES = 2;

export function createDrumhead(canvas, { onBeat, onBurst } = {}) {
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let R = 0;
  let dots = [];
  const ripples = [];
  let state = 'idle'; // idle -> beats -> burst
  let reveal = 0; // dots fade in from the centre
  let burst = 0;
  let energy = 0; // overall excitement, builds across the beats
  let t0 = 0;
  let nextBeat = 0;
  let lastHover = 0;
  let raf = 0;
  const pointer = { x: -1, y: -1 };

  function build() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(w, h) * 0.36;
    const gap = Math.max(7, R / 34);
    dots = [];
    for (let r = 0; r <= R; r += gap) {
      const n = r === 0 ? 1 : Math.max(6, Math.round((Math.PI * 2 * r) / gap));
      const rot = Math.random() * 6.28;
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2;
        dots.push({
          x: Math.cos(a) * r,
          y: Math.sin(a) * r,
          r,
          a,
          seed: Math.random(),
          rim: r > R - gap * 0.8,
        });
      }
    }
  }

  function addRipple(x, y, amp) {
    ripples.push({ x, y, age: 0, amp });
    if (ripples.length > 9) ripples.shift();
  }

  function hit(i, measure) {
    const accent = ACCENT.includes(i);
    const power = (accent ? 1 : 0.55) * (measure === 0 ? 0.7 : 1.05);
    // Accents land in the middle of the skin, the lighter hits near the rim, like a player moving around the head.
    const ang = (i / 7) * Math.PI * 2 + 0.6;
    const rad = accent ? (i === 0 ? 0 : R * 0.22) : R * 0.55;
    addRipple(Math.cos(ang) * rad, Math.sin(ang) * rad, power);
    energy = Math.min(1.4, energy + power * 0.22);
    onBeat?.({ index: i, accent, power, measure });
  }

  function draw(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    ctx.clearRect(0, 0, w, h);

    if (state === 'idle') reveal = Math.min(1, reveal + dt / 1.6);
    energy *= Math.exp(-dt * 0.9);

    if (state === 'beats') {
      const el = (now - t0) / 1000;
      while (nextBeat < 7 * MEASURES && el >= nextBeat * EIGHTH) {
        hit(nextBeat % 7, Math.floor(nextBeat / 7));
        nextBeat++;
      }
      if (el >= 7 * MEASURES * EIGHTH + 0.12) {
        state = 'burst';
        onBurst?.();
      }
    }
    if (state === 'burst') burst = Math.min(1, burst + dt / 1.5);

    for (const rp of ripples) rp.age += dt;
    while (ripples.length && ripples[0].age > 2.6) ripples.shift();

    ctx.save();
    ctx.translate(w / 2, h / 2);
    const breathe = 1 + Math.sin(now / 1400) * 0.006;
    ctx.scale(breathe, breathe);

    const speed = R * 1.25;
    const wid = R * 0.16;
    const bb = burst * burst;

    for (const d of dots) {
      // Reveal from the centre outward.
      const rv = Math.min(1, Math.max(0, (reveal * 1.4 - d.r / R) / 0.4));
      if (rv <= 0) continue;

      let lift = 0;
      let ox = 0;
      let oy = 0;
      for (const rp of ripples) {
        const dx = d.x - rp.x;
        const dy = d.y - rp.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const front = rp.age * speed;
        const k = (dist - front) / wid;
        const wave = Math.exp(-k * k) * Math.exp(-rp.age * 1.7) * rp.amp;
        if (wave > 0.002) {
          lift += wave;
          ox += (dx / dist) * wave * 7;
          oy += (dy / dist) * wave * 7;
        }
      }

      let x = d.x + ox;
      let y = d.y + oy;
      let alpha = rv;
      if (bb > 0) {
        // Burst: the skin lets go. Dots spiral away at different speeds and fade.
        const push = 1 + bb * (1.3 + d.seed * 3.2);
        const swirl = bb * (d.seed - 0.5) * 1.1;
        const ca = Math.cos(swirl);
        const sa = Math.sin(swirl);
        x = (d.x * ca - d.y * sa) * push;
        y = (d.x * sa + d.y * ca) * push;
        alpha *= Math.max(0, 1 - burst * (0.9 + d.seed * 0.4));
      }
      if (alpha <= 0.01) continue;

      const heat = Math.min(1, lift * 1.15 + energy * 0.18);
      const size = (d.rim ? 2.1 : 1.45) + lift * 2.6 + energy * 0.5;
      const r = 225 + 30 * heat;
      const g = 29 + 205 * heat;
      const b = 46 + 185 * heat;
      const a = alpha * (d.rim ? 0.75 : 0.28 + heat * 0.72);

      // Pointer sparkle while the head is idle.
      let extra = 0;
      if (state === 'idle' && pointer.x >= 0) {
        const px = x + w / 2 - pointer.x;
        const py = y + h / 2 - pointer.y;
        extra = Math.exp(-(px * px + py * py) / (2 * 70 * 70)) * 0.6;
      }

      ctx.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${Math.min(1, a + extra)})`;
      const s = size + extra * 1.4;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.restore();

    if (state !== 'done') raf = requestAnimationFrame(draw);
  }

  let last = performance.now();
  build();
  addEventListener('resize', build);
  canvas.parentElement.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    const now = performance.now();
    if (state === 'idle' && reveal > 0.8 && now - lastHover > 320) {
      lastHover = now;
      addRipple(e.clientX - w / 2, e.clientY - h / 2, 0.22);
    }
  });
  raf = requestAnimationFrame(draw);

  return {
    play() {
      if (state !== 'idle') return;
      state = 'beats';
      reveal = 1;
      t0 = performance.now() + 450;
      nextBeat = 0;
    },
    stop() {
      state = 'done';
      cancelAnimationFrame(raf);
      removeEventListener('resize', build);
    },
  };
}
