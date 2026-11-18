// The "orchestra" behind the page: a field of slow ribbons that breathes with scroll speed,
// leans toward the cursor, flares on every beat, and takes on the colour of the current movement.
export const flow = {
  color: [225, 29, 46],
  alpha: 0.9,
  energy: 0,
  tempo: 1, // set by the drum chapter: the whole page follows Balaraman's tempo
  scroll: 0,
  mx: -9999,
  my: -9999,
  pulse(amount = 0.5) {
    this.energy = Math.min(2, this.energy + amount);
  },
};

export function initFlow() {
  const cv = document.getElementById('flow');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = 12;
  let w = 0;
  let h = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = innerWidth;
    h = innerHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener('resize', () => {
    resize();
    if (reduce) frame(performance.now());
  });
  addEventListener('pointermove', (e) => {
    flow.mx = e.clientX;
    flow.my = e.clientY;
  });
  addEventListener('laya:tempo', (e) => (flow.tempo = e.detail ?? 1));
  addEventListener('laya:beat', (e) => flow.pulse(e.detail?.power ?? 0.4));

  let last = performance.now();
  let t = 4;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    flow.energy *= Math.exp(-dt * 1.8);
    t += dt * (0.3 + flow.energy * 0.9) * flow.tempo;

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';

    const [r, g, b] = flow.color.map(Math.round);
    const step = 14;

    for (let i = 0; i < N; i++) {
      const d = i / (N - 1);
      const base = h * (0.1 + 0.8 * d);
      const amp = (24 + 72 * d) * (0.65 + flow.energy * 0.7);
      const f1 = 0.0022 + d * 0.0016;
      const f2 = 0.0061 - d * 0.002;
      const ph = t * (0.8 + d * 0.5) + i * 0.9 + flow.scroll * 7;

      const a = (0.15 + 0.32 * (1 - Math.abs(d - 0.5) * 2)) * flow.alpha;
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
      grad.addColorStop(0.5, `rgba(${r},${g},${b},${a})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1 + d * 1.3;

      ctx.beginPath();
      for (let x = -step; x <= w + step; x += step) {
        let y = base + Math.sin(x * f1 + ph) * amp + Math.sin(x * f2 - ph * 1.3) * amp * 0.35;
        const dx = x - flow.mx;
        const dy = flow.my - base;
        const pull = Math.exp(-(dx * dx) / (2 * 180 * 180)) * Math.exp(-(dy * dy) / (2 * 220 * 220));
        y += dy * 0.35 * pull;
        if (x === -step) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (!reduce) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
