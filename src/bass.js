import { audio } from './audio.js';

// 5-string bass, low B at the top (as the player sees it).
const TUNING = [
  { note: 'B', freq: 30.87 },
  { note: 'E', freq: 41.2 },
  { note: 'A', freq: 55.0 },
  { note: 'D', freq: 73.42 },
  { note: 'G', freq: 98.0 },
];

const ACCENT = '255, 90, 31'; // Tomson's stage-fire orange

export function initBass() {
  const canvas = document.getElementById('bassCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let w = 0;
  let h = 0;
  let padX = 0;
  let running = false;
  let last = 0;

  const strings = TUNING.map((s, i) => ({
    ...s,
    amp: 0,
    t: 0,
    glow: 0,
    cool: 0,
    y: 0,
    hz: 9 + i * 1.6, // visual vibration rate (not the audio pitch)
    width: 5.2 - i * 0.85,
  }));

  const pointer = { x: 0, y: 0, px: null, py: null, inside: false };

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    padX = Math.max(24, w * 0.06);
    const top = h * 0.4;
    const bottom = h * 0.86;
    strings.forEach((s, i) => (s.y = top + ((bottom - top) * i) / (strings.length - 1)));
  }

  function pluck(s, speed) {
    const strength = Math.min(1, speed / 70);
    s.amp = Math.max(s.amp, 10 + strength * 46);
    s.t = 0;
    s.glow = 1;
    s.cool = 0.08;
    audio.pluck(s.freq, 0.25 + strength * 0.75);
  }

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    pointer.x = x;
    pointer.y = y;
    pointer.inside = true;
    if (pointer.py !== null && x > padX && x < w - padX) {
      const speed = Math.abs(y - pointer.py);
      for (const s of strings) {
        const crossed = (pointer.py - s.y) * (y - s.y) < 0;
        if (crossed && s.cool <= 0) pluck(s, speed);
      }
    }
    pointer.px = x;
    pointer.py = y;
  }

  function onLeave() {
    pointer.inside = false;
    pointer.px = null;
    pointer.py = null;
  }

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerup', onLeave);
  window.addEventListener('resize', resize);
  resize();

  function draw(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    ctx.clearRect(0, 0, w, h);

    // fret-ish guide marks
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const x = padX + ((w - padX * 2) * i) / 5;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.34);
      ctx.lineTo(x, h * 0.92);
      ctx.stroke();
    }

    const N = 72;
    for (const s of strings) {
      s.t += dt;
      s.cool = Math.max(0, s.cool - dt);
      s.amp *= Math.exp(-dt * 1.7);
      s.glow *= Math.exp(-dt * 2.4);

      // magnetic pull toward the pointer when it hovers close to a string
      const dy = pointer.inside ? pointer.y - s.y : 999;
      const near = Math.abs(dy) < 70 && pointer.x > padX && pointer.x < w - padX;
      const pull = near ? dy * 0.55 * (1 - Math.abs(dy) / 70) : 0;

      const alpha = 0.5 + s.glow * 0.5;
      ctx.strokeStyle = `rgba(${ACCENT}, ${alpha})`;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.shadowColor = `rgba(${ACCENT}, 0.95)`;
      ctx.shadowBlur = 6 + s.glow * 26;

      ctx.beginPath();
      for (let k = 0; k <= N; k++) {
        const u = k / N;
        const x = padX + (w - padX * 2) * u;
        const vib = s.amp * Math.sin(Math.PI * u) * Math.cos(s.t * s.hz * Math.PI * 2);
        const bend = pull * Math.exp(-Math.pow(x - pointer.x, 2) / (2 * 170 * 170));
        const y = s.y + vib + bend;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // note label
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(244,239,232,${0.35 + s.glow * 0.65})`;
      ctx.font = '500 12px Inter, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.note, padX - 22, s.y);
    }
    ctx.shadowBlur = 0;

    requestAnimationFrame(draw);
  }

  // Only animate while the chapter is on screen.
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !running) {
        running = true;
        last = performance.now();
        requestAnimationFrame(draw);
      } else if (!entry.isIntersecting) {
        running = false;
      }
    },
    { threshold: 0.05 }
  );
  io.observe(canvas);
}
