import { audio } from './audio.js';

// Shared plumbing: sizes a canvas to its box, runs a frame loop only while it is on screen.
function runCanvas(canvas, { frame, onResize, onHide }) {
  const ctx = canvas.getContext('2d');
  const st = { w: 0, h: 0, running: false };
  let last = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    st.w = r.width;
    st.h = r.height;
    canvas.width = Math.round(st.w * dpr);
    canvas.height = Math.round(st.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onResize?.(st);
  }
  new ResizeObserver(resize).observe(canvas);

  function loop(now) {
    if (!st.running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    ctx.clearRect(0, 0, st.w, st.h);
    frame(ctx, st, dt, now / 1000);
    requestAnimationFrame(loop);
  }
  new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting && !st.running) {
        st.running = true;
        last = performance.now();
        requestAnimationFrame(loop);
      } else if (!e.isIntersecting && st.running) {
        st.running = false;
        onHide?.();
      }
    },
    { threshold: 0.05 }
  ).observe(canvas);

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  return { ctx, st, pos };
}

const beat = (power) => window.dispatchEvent(new CustomEvent('laya:beat', { detail: { power } }));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isTyping = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '');

/* ------------------------------------------------------------------ */
/* Drums: pads, keys, and a 7/8 groove whose tempo the whole page follows */
/* ------------------------------------------------------------------ */
function initDrums(canvas, section) {
  const V = '166,77,255';
  const PADS = [
    { id: 'hat', label: 'Hi-hat', key: 'A', snd: 'hat', x: 0.09, y: 0.27, r: 0.17 },
    { id: 'snare', label: 'Snare', key: 'S', snd: 'snare', x: 0.22, y: 0.55, r: 0.25 },
    { id: 'kick', label: 'Kick', key: 'D', snd: 'kick', x: 0.44, y: 0.6, r: 0.28 },
    { id: 'tom', label: 'Tom', key: 'F', snd: 'tom', x: 0.64, y: 0.4, r: 0.2 },
    { id: 'tom2', label: 'Floor tom', key: 'J', snd: 'tom2', x: 0.81, y: 0.56, r: 0.22 },
    { id: 'crash', label: 'Crash', key: 'K', snd: 'crash', x: 0.92, y: 0.24, r: 0.17 },
  ].map((p) => ({ ...p, flash: 0, hover: 0 }));
  const byId = Object.fromEntries(PADS.map((p) => [p.id, p]));
  const ripples = [];
  const geo = (p, st) => {
    const u = Math.min(st.h, st.w * 0.38);
    return { cx: p.x * st.w, cy: p.y * st.h, r: p.r * u };
  };
  let hoverId = null;

  const btn = section.querySelector('#grooveBtn');
  const range = section.querySelector('#bpm');
  const out = section.querySelector('#bpmOut');
  const PATTERN = [['kick', 'hat'], ['hat'], ['hat'], ['snare', 'hat'], ['hat'], ['kick', 'tom2'], ['hat']]; // 3 + 2 + 2
  let bpm = 110;
  let playing = false;
  let step = 0;
  let nextAt = 0;
  let timer = 0;

  function hit(p, power = 1) {
    p.flash = 1;
    ripples.push({ id: p.id, age: 0 });
    audio.drum(p.snd, power);
    beat(0.15 + 0.4 * power);
  }

  function tick() {
    PATTERN[step].forEach((id) => hit(byId[id], id === 'hat' ? 0.45 : 1));
    step = (step + 1) % 7;
    nextAt += 60000 / bpm / 2;
    timer = setTimeout(tick, Math.max(0, nextAt - performance.now()));
  }
  function setPlaying(on) {
    if (on === playing) return;
    playing = on;
    clearTimeout(timer);
    btn.textContent = on ? 'Stop groove' : 'Play groove';
    btn.classList.toggle('is-on', on);
    if (on) {
      audio.ensure();
      step = 0;
      nextAt = performance.now();
      tick();
    }
  }
  btn.addEventListener('click', () => setPlaying(!playing));
  range.addEventListener('input', () => {
    bpm = +range.value;
    out.textContent = bpm;
    window.dispatchEvent(new CustomEvent('laya:tempo', { detail: bpm / 110 }));
  });

  const { pos, st } = runCanvas(canvas, {
    onHide: () => setPlaying(false),
    frame(ctx, s, dt) {
      for (const p of PADS) {
        p.flash *= Math.exp(-dt * 5);
        const g = geo(p, s);
        const lit = p.flash;
        const hv = hoverId === p.id ? 1 : 0;
        p.hover += (hv - p.hover) * Math.min(1, dt * 10);
        const grad = ctx.createRadialGradient(g.cx, g.cy, g.r * 0.1, g.cx, g.cy, g.r);
        grad.addColorStop(0, `rgba(${V},${0.1 + lit * 0.55 + p.hover * 0.1})`);
        grad.addColorStop(1, `rgba(${V},${0.02 + lit * 0.18})`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(g.cx, g.cy, g.r * (1 - lit * 0.05), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(${V},${0.45 + lit * 0.55 + p.hover * 0.2})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = `rgba(244,239,232,${0.55 + lit * 0.45})`;
        ctx.textAlign = 'center';
        ctx.font = '500 11px Inter, sans-serif';
        ctx.fillText(p.label.toUpperCase(), g.cx, g.cy + 4);
        ctx.fillStyle = `rgba(${V},1)`;
        ctx.font = '600 10px Inter, sans-serif';
        ctx.fillText(p.key, g.cx, g.cy + g.r * 0.42 + 4);
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.age += dt;
        if (r.age > 0.9) {
          ripples.splice(i, 1);
          continue;
        }
        const g = geo(byId[r.id], s);
        ctx.strokeStyle = `rgba(${V},${1 - r.age / 0.9})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.cx, g.cy, g.r * (1 + r.age * 0.42), 0, Math.PI * 2);
        ctx.stroke();
      }
    },
  });

  function padAt(x, y) {
    return PADS.find((p) => {
      const g = geo(p, st);
      return (x - g.cx) ** 2 + (y - g.cy) ** 2 <= g.r * g.r;
    });
  }
  canvas.addEventListener('pointerdown', (e) => {
    audio.ensure();
    const { x, y } = pos(e);
    const p = padAt(x, y);
    if (p) hit(p, 1);
  });
  canvas.addEventListener('pointermove', (e) => {
    const { x, y } = pos(e);
    hoverId = padAt(x, y)?.id ?? null;
  });
  canvas.addEventListener('pointerleave', () => (hoverId = null));
  window.addEventListener('keydown', (e) => {
    if (!st.running || e.repeat || isTyping(e) || e.metaKey || e.ctrlKey) return;
    const p = PADS.find((x) => x.key === e.key.toUpperCase());
    if (p) hit(p, 1);
  });
}

/* ------------------------------------------------------------------ */
/* Flute: hold to breathe, slide to change the note (Mohanam: Sa Ri Ga Pa Dha) */
/* ------------------------------------------------------------------ */
function initFlute(canvas) {
  const B = '61,165,255';
  const SEMI = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  const NAMES = ['Sa', 'Ri', 'Ga', 'Pa', 'Dha', 'Sa', 'Ri', 'Ga', 'Pa', 'Dha'];
  const freq = (i) => 392 * Math.pow(2, SEMI[i] / 12);
  let down = false;
  let breath = 0;
  let idx = 3;
  let lineY = 0;
  let px = 80;
  let voice = null;
  const bits = [];

  const rowY = (i, h) => h - ((i + 0.5) * h) / SEMI.length;
  const noteAt = (y, h) => clamp(Math.floor(((h - y) / h) * SEMI.length), 0, SEMI.length - 1);

  const { pos } = runCanvas(canvas, {
    onHide: stop,
    onResize: (s) => (lineY = rowY(idx, s.h)),
    frame(ctx, s, dt, t) {
      const { w, h } = s;
      breath += ((down ? 1 : 0) - breath) * Math.min(1, dt * (down ? 5 : 3));
      lineY += (rowY(idx, h) - lineY) * Math.min(1, dt * 9);

      ctx.font = '500 10px Inter, sans-serif';
      ctx.textAlign = 'left';
      for (let i = 0; i < SEMI.length; i++) {
        const y = rowY(i, h);
        const on = i === idx && down;
        ctx.strokeStyle = `rgba(${B},${on ? 0.45 : 0.1})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(44, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.fillStyle = on ? `rgba(${B},1)` : 'rgba(244,239,232,0.42)';
        ctx.fillText(NAMES[i] + (i >= 5 ? '·' : ''), 4, y + 3);
      }

      // The breath: three strands of one wave that tighten and swell with the note.
      const amp = 3 + breath * 26;
      const k = 0.011 + idx * 0.0016;
      for (let strand = 0; strand < 3; strand++) {
        ctx.strokeStyle = `rgba(${B},${0.25 + breath * 0.5 - strand * 0.1})`;
        ctx.lineWidth = 2.2 - strand * 0.5;
        ctx.shadowColor = `rgba(${B},0.9)`;
        ctx.shadowBlur = 4 + breath * 16;
        ctx.beginPath();
        for (let x = 44; x <= w; x += 6) {
          const fall = Math.min(1, (x - 44) / 80);
          const y = lineY + Math.sin(x * k - t * (2 + breath * 7) + strand * 1.3) * amp * fall * (1 - strand * 0.25);
          x === 44 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      if (breath > 0.3 && Math.random() < 0.6) bits.push({ x: px, y: lineY, vx: 40 + Math.random() * 90, vy: (Math.random() - 0.5) * 30, a: 1 });
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.a -= dt * 0.9;
        if (b.a <= 0 || b.x > w) {
          bits.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(${B},${b.a * 0.7})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  });

  function stop() {
    down = false;
    voice?.off();
    voice = null;
  }
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    audio.ensure();
    const { x, y } = pos(e);
    idx = noteAt(y, canvas.getBoundingClientRect().height);
    px = clamp(x, 60, 400);
    down = true;
    voice = audio.voice('flute');
    voice?.on(freq(idx));
    voice?.vib(4);
    beat(0.25);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    const { x, y } = pos(e);
    px = clamp(x, 60, 400);
    const n = noteAt(y, canvas.getBoundingClientRect().height);
    if (n !== idx) {
      idx = n;
      voice?.glide(freq(idx), 0.045);
      beat(0.12);
    }
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => canvas.addEventListener(ev, stop));
}

/* ------------------------------------------------------------------ */
/* Guitar: slide along the neck, pull the string to bend               */
/* ------------------------------------------------------------------ */
function initGuitar(canvas) {
  const M = '255,45,154';
  const NOTES = [329.63, 392, 440, 493.88, 587.33, 659.25, 783.99, 880]; // E minor pentatonic
  const LABEL = ['E', 'G', 'A', 'B', 'D', 'E', 'G', 'A'];
  let down = false;
  let zone = 0;
  let bend = 0;
  let px = 0;
  let py = 0;
  let vx = 0;
  let voice = null;
  const sparks = [];
  const margin = 34;

  const zoneAt = (x, w) => clamp(Math.floor(((x - margin) / (w - margin * 2)) * NOTES.length), 0, NOTES.length - 1);
  const pitch = () => NOTES[zone] * Math.pow(2, (bend * 2) / 12);
  function burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, a: 1 });
    }
  }

  const { pos } = runCanvas(canvas, {
    onHide: stop,
    frame(ctx, s, dt, t) {
      const { w, h } = s;
      const mid = h * 0.5;
      vx *= Math.exp(-dt * 6);
      const zw = (w - margin * 2) / NOTES.length;

      // neck zones
      ctx.font = '500 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      for (let i = 0; i < NOTES.length; i++) {
        const x = margin + i * zw;
        const act = down && i === zone;
        if (act) {
          const g = ctx.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, `rgba(${M},0)`);
          g.addColorStop(0.5, `rgba(${M},0.16)`);
          g.addColorStop(1, `rgba(${M},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x, 0, zw, h);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, h * 0.12);
        ctx.lineTo(x, h * 0.88);
        ctx.stroke();
        ctx.fillStyle = act ? `rgba(${M},1)` : 'rgba(244,239,232,0.4)';
        ctx.fillText(LABEL[i], x + zw / 2, h - 6);
      }

      // two quiet companion strings
      [-0.24, 0.24].forEach((o, i) => {
        ctx.strokeStyle = 'rgba(255,255,255,0.13)';
        ctx.lineWidth = 1 + i * 0.4;
        ctx.beginPath();
        ctx.moveTo(margin, mid + o * h);
        ctx.lineTo(w - margin, mid + o * h);
        ctx.stroke();
      });

      // the lead string: bends toward the pointer, hums while held
      const pull = down ? clamp((py - mid) * 1.5, -h * 0.46, h * 0.46) : 0;
      const hum = down ? Math.sin(t * 55) * (1.2 + Math.abs(vx) * 0.02) : Math.sin(t * 2) * 0.6;
      ctx.shadowColor = `rgba(${M},1)`;
      ctx.shadowBlur = down ? 26 : 8;
      ctx.strokeStyle = `rgba(${M},${down ? 1 : 0.7})`;
      ctx.lineWidth = down ? 3.2 : 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(margin, mid);
      ctx.quadraticCurveTo(down ? px : w / 2, mid + pull + hum, w - margin, mid);
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (down) {
        ctx.fillStyle = `rgba(${M},0.9)`;
        ctx.beginPath();
        ctx.arc(px, mid + pull * 0.5 + hum * 0.5, 5, 0, Math.PI * 2);
        ctx.fill();
        if (Math.random() < 0.5) burst(px, mid + pull * 0.5, 1);
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 260 * dt;
        p.a -= dt * 1.7;
        if (p.a <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = `rgba(255,200,230,${p.a})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      }
    },
  });

  function stop() {
    down = false;
    voice?.off();
    voice = null;
  }
  function update(e) {
    const r = canvas.getBoundingClientRect();
    const { x, y } = pos(e);
    vx = e.movementX || 0;
    px = clamp(x, margin, r.width - margin);
    py = clamp(y, 0, r.height);
    const z = zoneAt(px, r.width);
    const mid = r.height * 0.5;
    bend = clamp((mid - py) / (r.height * 0.4), 0, 1);
    if (z !== zone) {
      zone = z;
      beat(0.18);
    }
    voice?.glide(pitch(), 0.04);
    voice?.vib(clamp(Math.abs(vx) * 0.5, 0, 9));
  }
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    audio.ensure();
    down = true;
    update(e);
    voice = audio.voice('lead');
    voice?.on(pitch());
    burst(px, canvas.getBoundingClientRect().height * 0.5, 22);
    beat(0.5);
  });
  canvas.addEventListener('pointermove', (e) => down && update(e));
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => canvas.addEventListener(ev, stop));
}

/* ------------------------------------------------------------------ */
/* Vocals: a searchlight finds the words; sing into the mic to move the bars */
/* ------------------------------------------------------------------ */
function initVocals(canvas, section) {
  const G = '255,217,160';
  const lit = section.querySelector('.lyrics__lit');
  const btn = section.querySelector('#micBtn');
  let inside = false;
  let mx = 0;
  let my = 0;
  let idleSince = performance.now();
  let analyser = null;
  let micCtx = null;
  let stream = null;
  let data = null;
  let lastBeat = 0;
  let level = 0;

  async function toggleMic() {
    if (analyser) {
      stream.getTracks().forEach((t) => t.stop());
      micCtx.close();
      analyser = null;
      btn.textContent = 'Sing into it';
      btn.classList.remove('is-on');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AC = window.AudioContext || window.webkitAudioContext;
      micCtx = new AC();
      analyser = micCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      micCtx.createMediaStreamSource(stream).connect(analyser); // analysed only, never played back
      data = new Uint8Array(analyser.frequencyBinCount);
      btn.textContent = 'Stop mic';
      btn.classList.add('is-on');
    } catch {
      btn.textContent = 'Mic unavailable';
    }
  }
  btn.addEventListener('click', toggleMic);

  const { pos } = runCanvas(canvas, {
    onHide: () => analyser && toggleMic(),
    frame(ctx, s, dt, t) {
      const { w, h } = s;
      if (analyser) {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length * 0.6; i++) sum += data[i];
        level = sum / (data.length * 0.6 * 255);
        if (level > 0.22 && performance.now() - lastBeat > 140) {
          lastBeat = performance.now();
          beat(Math.min(0.8, level * 1.4));
        }
      } else level *= 0.9;

      // The searchlight: follows the pointer, wanders by itself when left alone.
      const idle = !inside && performance.now() - idleSince > 1200;
      const lx = idle || !inside ? w * (0.5 + 0.42 * Math.sin(t * 0.55)) : mx;
      const ly = idle || !inside ? h * (0.22 + 0.1 * Math.sin(t * 0.9)) : my;
      lit.style.setProperty('--mx', `${lx}px`);
      lit.style.setProperty('--my', `${ly}px`);

      const N = Math.max(20, Math.floor(w / 10));
      const base = h * 0.86;
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const x = u * w;
        let v = 0.1 + 0.07 * (0.5 + 0.5 * Math.sin(i * 0.33 + t * 2.1)) * (0.6 + 0.4 * Math.sin(t * 0.7 + i * 0.05));
        if (inside) v += 0.28 * Math.exp(-((x - mx) ** 2) / (2 * 80 * 80));
        if (analyser) v += (data[Math.floor(u * data.length * 0.6)] / 255) * 0.7;
        const bh = v * h * 0.5;
        const a = 0.25 + Math.min(0.7, v * 1.2);
        ctx.fillStyle = `rgba(${G},${a})`;
        ctx.fillRect(x - 1.5, base - bh / 2, 3, bh);
      }
    },
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pos(e);
    mx = p.x;
    my = p.y;
    inside = true;
    idleSince = performance.now();
    if (Math.random() < 0.04) beat(0.12);
  });
  canvas.addEventListener('pointerleave', () => {
    inside = false;
    idleSince = performance.now();
  });
}

export function initInstruments() {
  const map = { drums: initDrums, flute: initFlute, guitar: initGuitar, vocals: initVocals };
  document.querySelectorAll('canvas[data-instrument]').forEach((canvas) => {
    const fn = map[canvas.dataset.instrument];
    if (fn) fn(canvas, canvas.closest('.chapter'));
  });
}
