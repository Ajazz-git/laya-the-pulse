import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { band } from './data.js';
import { audio } from './audio.js';
import { initBass } from './bass.js';
import { initInstruments } from './instruments.js';
import { flow, initFlow } from './flow.js';
import { createDrumhead } from './intro.js';
import { buildChapters, animateChapters, FIRST_CHAPTER } from './chapters.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const RED = [225, 29, 46];

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */
$('.hero__tag').textContent = band.tagline;

$('#heroMembers').innerHTML = band.members
  .map((m) => `<span><b style="--c:${m.color}"></b>${m.name} · ${m.role}</span>`)
  .join('');

// Manifesto statements: *word|memberId* lights the word in that member's colour.
const parse = (s) =>
  s.replace(/\*([^|*]+)\|(\w+)\*/g, (_, word, id) => {
    const m = band.members.find((x) => x.id === id);
    return `<span class="hl" style="--c:${m ? m.color : '#e11d2e'}">${word}</span>`;
  });
$('#manifestoStage').innerHTML = band.manifesto.map((t) => `<p class="stmt">${parse(t)}</p>`).join('');

$('#lineupList').innerHTML = band.members
  .map(
    (m, i) => `
    <li style="--c:${m.color}" data-id="${m.id}">
      <a href="#ch-${m.id}" data-cursor="hover">
        <span class="n">0${i + 1}</span>
        <span class="name">${m.name}</span>
        <span class="role">${m.role}</span>
      </a>
    </li>`
  )
  .join('');

$('#chapters').innerHTML = buildChapters(band.members);

$('#eventChips').innerHTML = band.events.map((e) => `<button class="chip" data-cursor="hover">${e}</button>`).join('');
$$('.chip').forEach((chip) =>
  chip.addEventListener('click', () => {
    $$('.chip').forEach((c) => c.classList.toggle('is-on', c === chip));
  })
);

const c = band.contact;
const link = (href, label) => `<a href="${href}" data-cursor="hover">${label}</a>`;
const ARROW = '<svg class="reach__arrow" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M5.5 3H13v7.5" /></svg>';
const tel = c.phone ? c.phone.replace(/[^\d+]/g, '') : '';
const ig = c.instagram ? c.instagram.replace('@', '') : '';
const rows = [
  c.email && { k: 'Bookings', v: c.email, href: `mailto:${c.email}`, copy: c.email, color: '#e11d2e' },
  c.phone && { k: 'Call', v: c.phone, href: `tel:${tel}`, copy: c.phone, color: '#ff5a1f' },
  c.instagram && { k: 'Instagram', v: c.instagram, href: `https://instagram.com/${ig}`, ext: true, color: '#ff2d9a' },
  c.youtube || c.spotify
    ? { k: 'Watch & listen', v: c.youtube ? 'YouTube' : 'Spotify', href: c.youtube || c.spotify, ext: true, color: '#3da5ff' }
    : { k: 'Watch & listen', v: 'Coming soon', soon: true, color: '#3da5ff' },
].filter(Boolean);
$('#bookContact').innerHTML = `<ul class="reach">${rows
  .map((r, i) =>
    r.soon
      ? `<li class="reach__row is-soon" style="--c:${r.color}"><span class="reach__k">${r.k}</span><span class="reach__v">${r.v}</span></li>`
      : `<li class="reach__row" style="--c:${r.color}">
          <span class="reach__k"><i>0${i + 1}</i>${r.k}</span>
          <a class="reach__v" href="${r.href}" ${r.ext ? 'target="_blank" rel="noopener"' : ''} data-cursor="hover">${r.v}${ARROW}</a>
          ${r.copy ? `<button class="reach__copy" data-copy="${r.copy}" data-cursor="hover" aria-label="Copy ${r.k}">Copy</button>` : ''}
        </li>`
  )
  .join('')}</ul>`;

$$('.reach__copy').forEach((btn) =>
  btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    btn.textContent = 'Copied';
    btn.classList.add('is-done');
    flow.pulse(0.6);
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('is-done');
    }, 1700);
  })
);

$('#bookCta').addEventListener('click', () => {
  if (!c.email) return;
  const chip = $('.chip.is-on')?.textContent;
  const subject = encodeURIComponent(`Booking enquiry${chip ? ` — ${chip}` : ''}`);
  window.location.href = `mailto:${c.email}?subject=${subject}`;
});

// Warm the portrait cache so the lineup stage never waits on a network request.
band.members.forEach((m) => {
  const i = new Image();
  i.src = m.img;
});

/* ------------------------------------------------------------------ */
/* Smooth scroll                                                       */
/* ------------------------------------------------------------------ */
const lenis = new Lenis({ lerp: 0.075, smoothWheel: !reduceMotion });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();

function scrollToEl(el) {
  const dist = Math.abs(el.getBoundingClientRect().top);
  lenis.scrollTo(el, { duration: Math.min(3, Math.max(1.4, dist / 1500)) });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  e.preventDefault();
  if (id === '#') return;
  const el = $(id);
  if (el) scrollToEl(el);
});

/* ------------------------------------------------------------------ */
/* Flow field, scroll lean, magnetic controls                          */
/* ------------------------------------------------------------------ */
initFlow();
flow.alpha = 0; // the ribbons are born from the drumhead
let ribbonsOn = false;
let pendingAlpha = 0.9;

function tint(rgb, alpha, duration = 1.6) {
  pendingAlpha = alpha;
  gsap.to(flow.color, { 0: rgb[0], 1: rgb[1], 2: rgb[2], duration, ease: 'power2.out', overwrite: true });
  if (ribbonsOn) gsap.to(flow, { alpha, duration, ease: 'power2.out', overwrite: 'auto' });
}

const leanEls = $$('.section-title, .book__cta, .chapter__name');
const leanTo = leanEls.map((el) => gsap.quickTo(el, 'skewY', { duration: 0.7, ease: 'power3' }));
gsap.ticker.add(() => {
  const v = lenis.velocity || 0;
  flow.scroll += (lenis.progress - flow.scroll) * 0.08;
  flow.energy = Math.max(flow.energy, Math.min(1.5, Math.abs(v) / 28));
  if (!reduceMotion) {
    const lean = gsap.utils.clamp(-3, 3, v * -0.1);
    leanTo.forEach((f) => f(lean));
  }
});

if (finePointer && !reduceMotion) {
  $$('.btn, .chip, .sound-toggle, .nav nav a').forEach((el) => {
    const mx = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
    const my = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      mx((e.clientX - r.left - r.width / 2) * 0.32);
      my((e.clientY - r.top - r.height / 2) * 0.32);
    });
    el.addEventListener('pointerleave', () => {
      mx(0);
      my(0);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Cursor                                                              */
/* ------------------------------------------------------------------ */
if (finePointer) {
  const cur = $('.cursor');
  const cx = gsap.quickTo(cur, 'x', { duration: 0.25, ease: 'power3' });
  const cy = gsap.quickTo(cur, 'y', { duration: 0.25, ease: 'power3' });
  addEventListener('pointermove', (e) => {
    cx(e.clientX);
    cy(e.clientY);
  });
  document.addEventListener('pointerover', (e) => {
    cur.classList.toggle('is-hover', !!e.target.closest('[data-cursor="hover"], a, button'));
  });
}

/* ------------------------------------------------------------------ */
/* Sound toggle                                                        */
/* ------------------------------------------------------------------ */
const soundBtn = $('#soundToggle');
audio.onchange(() => soundBtn.classList.toggle('is-off', !audio.enabled));
soundBtn.addEventListener('click', () => {
  if (!audio.ready) audio.enable();
  else audio.toggle();
  soundBtn.classList.toggle('is-off', !audio.enabled);
});

/* ------------------------------------------------------------------ */
/* Intro: the drumhead                                                 */
/* ------------------------------------------------------------------ */
let entered = false;
let drum = null;

function heroIn() {
  gsap
    .timeline()
    .from('.hero__word .ch', { yPercent: 110, rotate: 5, opacity: 0, duration: 1.4, stagger: 0.1, ease: 'expo.out' })
    .from('.hero .eyebrow, .hero__tag', { y: 20, opacity: 0, duration: 1, stagger: 0.15 }, '-=0.9')
    .from('#heroMembers span', { y: 16, opacity: 0, stagger: 0.08, duration: 0.8 }, '-=0.7')
    .from('.scroll-hint', { opacity: 0, duration: 1 }, '-=0.5')
    .to('.nav, .sound-toggle, .movements, .movement-label', { opacity: 1, duration: 1.2 }, '-=1.2');
}

function finishIntro() {
  gsap
    .timeline()
    .to('#intro', { opacity: 0, duration: 0.9, ease: 'power2.inOut' })
    .add(() => {
      document.body.classList.remove('is-intro');
      lenis.start();
      drum?.stop();
      $('#intro').remove();
      heroIn();
    }, '-=0.45');
}

function onBeat({ index, power }) {
  if (index === 0) audio.hit('kick', power);
  else if (index === 3 || index === 5) audio.hit('tom', power * 0.8);
  else audio.hit('tick', power);
}

function onBurst() {
  audio.hit('kick', 1.2);
  ribbonsOn = true;
  gsap.to(flow, { alpha: pendingAlpha, duration: 2.4, ease: 'power2.out' });
  flow.pulse(1.2);
  gsap
    .timeline()
    .fromTo(
      '.intro-word span',
      { yPercent: 50, opacity: 0, filter: 'blur(16px)' },
      { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1.3, stagger: 0.11, ease: 'expo.out' }
    )
    .to('.intro-sub', { opacity: 1, duration: 0.9 }, '-=0.7');
  gsap.delayedCall(2.5, finishIntro);
}

function enter(withSound) {
  if (entered) return;
  entered = true;
  if (withSound) audio.enable();
  else soundBtn.classList.add('is-off');
  gsap.to('.intro-start', { opacity: 0, y: 10, duration: 0.5, ease: 'power2.in' });
  drum.play();
}

if (reduceMotion) {
  $('#intro').remove();
  document.body.classList.remove('is-intro');
  soundBtn.classList.add('is-off');
  ribbonsOn = true;
  flow.alpha = pendingAlpha;
  gsap.set('.nav, .sound-toggle, .movements, .movement-label', { opacity: 1 });
  lenis.start();
} else {
  drum = createDrumhead($('#drumhead'), { onBeat, onBurst });
  gsap.fromTo('.intro-start', { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 1.2, delay: 1.6, ease: 'power2.out' });
  $$('[data-sound]').forEach((b) => b.addEventListener('click', () => enter(b.dataset.sound === 'on')));
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
gsap.to('.hero__word', {
  yPercent: -22,
  gap: '0.7em',
  opacity: 0,
  ease: 'none',
  scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
});

if (finePointer && !reduceMotion) {
  const letters = $$('.hero__word .ch').map((el, i) => ({
    x: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3' }),
    y: gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3' }),
    depth: 6 + i * 5,
  }));
  $('#hero').addEventListener('pointermove', (e) => {
    const nx = e.clientX / innerWidth - 0.5;
    const ny = e.clientY / innerHeight - 0.5;
    letters.forEach((l) => {
      l.x(nx * l.depth);
      l.y(ny * l.depth);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Manifesto: three statements, a 7-beat wheel                         */
/* ------------------------------------------------------------------ */
const ACCENTS = [0, 3, 5]; // the 7 is felt as 3 + 2 + 2
const tala = $('#tala');
{
  const R0 = 120;
  const pts = Array.from({ length: 7 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 7;
    return [Math.cos(a) * R0, Math.sin(a) * R0];
  });
  let svg = '<circle class="ring" r="150"/><circle class="ring" r="75"/><circle class="ring" r="120"/>';
  [[0, 2], [3, 4], [5, 6]].forEach(([a, b]) => {
    const [x1, y1] = pts[a];
    const [x2, y2] = pts[b];
    svg += `<path class="arc" style="stroke:rgba(225,29,46,.55);stroke-width:2" d="M${x1} ${y1} A${R0} ${R0} 0 0 1 ${x2} ${y2}"/>`;
  });
  pts.forEach(([x, y], i) => {
    const acc = ACCENTS.includes(i);
    svg += `<circle class="node ${acc ? 'is-accent' : ''}" cx="${x}" cy="${y}" r="${acc ? 8 : 5}"/>`;
  });
  tala.innerHTML = svg;
}
const nodes = $$('.node', tala);
let beat = 0;
let beatLive = false;
const beatTween = gsap.to({}, {
  duration: 0.26,
  repeat: -1,
  onRepeat() {
    nodes.forEach((n, i) => n.classList.toggle('is-on', i === beat));
    if (beatLive && ACCENTS.includes(beat)) flow.pulse(beat === 0 ? 0.35 : 0.18);
    beat = (beat + 1) % 7;
  },
});

addEventListener('laya:tempo', (e) => beatTween.timeScale(e.detail ?? 1));

const STMT_TINT = [RED, hexToRgb('#a64dff'), hexToRgb('#3da5ff')];

function setupManifesto() {
  const stmts = $$('.stmt');
  if (reduceMotion) {
    $('#manifesto').classList.add('manifesto--static');
    return;
  }
  gsap.set(tala, { yPercent: -50 });
  const splits = stmts.map((el) => SplitText.create(el, { type: 'lines', mask: 'lines' }));
  splits.forEach((s) =>
    (s.masks || []).forEach((m) => {
      m.style.paddingBottom = '0.16em';
      m.style.marginBottom = '-0.16em';
      m.style.paddingRight = '0.12em';
    })
  );
  splits.forEach((s) => gsap.set(s.lines, { yPercent: 118 }));

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.to(tala, { rotation: 140, duration: 9.4 }, 0);
  tl.to(tala, { scale: 1.12, duration: 9.4 }, 0);
  splits.forEach((s, i) => {
    const t = i * 3;
    tl.to(s.lines, { yPercent: 0, duration: 1, stagger: 0.14, ease: 'power3.out' }, t);
    if (i < splits.length - 1) {
      tl.to(s.lines, { yPercent: -118, duration: 0.9, stagger: 0.1, ease: 'power3.in' }, t + 2.15);
    }
  });
  tl.set({}, {}, 9.4);

  let cur = -1;
  ScrollTrigger.create({
    trigger: '#manifesto',
    start: 'top top',
    end: '+=330%',
    pin: true,
    refreshPriority: 10, // measure the pin first so everything below is placed after it
    animation: tl,
    scrub: 0.8,
    onToggle: (self) => (beatLive = self.isActive),
    onUpdate: (self) => {
      const idx = Math.min(2, Math.floor(self.progress * 3));
      if (idx !== cur) {
        cur = idx;
        flow.pulse(0.6);
        tint(STMT_TINT[idx], 0.5, 1.4);
      }
    },
  });
}
(document.fonts?.ready || Promise.resolve()).then(() => {
  setupManifesto();
  ScrollTrigger.refresh();
});

/* ------------------------------------------------------------------ */
/* Lineup: a weightless portrait stage                                 */
/* ------------------------------------------------------------------ */
gsap.from('.section-title', {
  clipPath: 'inset(0 0 100% 0)',
  y: 70,
  duration: 1.4,
  ease: 'expo.out',
  scrollTrigger: { trigger: '.section-title', start: 'top 85%' },
});
gsap.from('.lineup__list li', {
  y: 60,
  opacity: 0,
  duration: 1,
  stagger: 0.1,
  ease: 'expo.out',
  scrollTrigger: { trigger: '.lineup__list', start: 'top 80%' },
});

if (finePointer) {
  const list = $('#lineupList');
  const stage = $('#stage');
  const layers = $$('.stage__img', stage);
  let front = 0;
  let currentId = null;
  let visible = false;
  let settle;

  const sw = () => stage.offsetWidth;
  const sh = () => stage.offsetHeight;
  const px = gsap.quickTo(stage, 'x', { duration: 1.25, ease: 'power3' });
  const py = gsap.quickTo(stage, 'y', { duration: 1.25, ease: 'power3' });
  const pr = gsap.quickTo(stage, 'rotation', { duration: 1.4, ease: 'power3' });

  function showMember(m) {
    if (m.id === currentId) return;
    currentId = m.id;
    const next = 1 - front;
    $('img', layers[next]).src = m.img;
    gsap.fromTo(
      layers[next],
      { opacity: 0, scale: 1.14, filter: 'blur(16px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.3, ease: 'power3.out', overwrite: true }
    );
    gsap.to(layers[front], { opacity: 0, scale: 0.95, filter: 'blur(12px)', duration: 1, ease: 'power2.inOut', overwrite: true });
    front = next;
  }

  function place(e, instant) {
    const x = e.clientX - sw() / 2 + sw() * 0.34;
    const y = e.clientY - sh() / 2;
    if (instant) gsap.set(stage, { x, y });
    else {
      px(x);
      py(y);
    }
  }

  list.addEventListener('pointerenter', (e) => {
    if (!visible) {
      place(e, true);
      visible = true;
      gsap.to(stage, { opacity: 1, duration: 1.1, ease: 'power2.out', overwrite: 'auto' });
    }
  });
  list.addEventListener('pointermove', (e) => {
    place(e, false);
    pr(gsap.utils.clamp(-7, 7, e.movementX * 0.22));
    clearTimeout(settle);
    settle = setTimeout(() => pr(0), 90);
  });
  list.addEventListener('pointerleave', () => {
    visible = false;
    currentId = null;
    list.classList.remove('has-hover');
    $$('li', list).forEach((l) => l.classList.remove('is-active'));
    gsap.to(stage, { opacity: 0, duration: 1.3, ease: 'power2.out', overwrite: 'auto' });
    tint(RED, 0.6, 1.4);
  });

  $$('li', list).forEach((li) => {
    const m = band.members.find((x) => x.id === li.dataset.id);
    li.addEventListener('pointerenter', () => {
      list.classList.add('has-hover');
      $$('li', list).forEach((l) => l.classList.toggle('is-active', l === li));
      showMember(m);
      tint(hexToRgb(m.color), 0.85, 0.9);
    });
    li.addEventListener('click', () => {
      flow.pulse(1.2);
      gsap.to(stage, { scale: 1.2, opacity: 0, duration: 0.9, ease: 'power3.in', onComplete: () => gsap.set(stage, { scale: 1 }) });
    });
  });
}

/* ------------------------------------------------------------------ */
/* Chapters                                                            */
/* ------------------------------------------------------------------ */
animateChapters({ reduceMotion, onEnter: () => flow.pulse(0.9) });
initBass();
initInstruments();

/* ------------------------------------------------------------------ */
/* Book                                                                */
/* ------------------------------------------------------------------ */
gsap.from('.book__cta, .chips .chip, .reach__row', {
  y: 50,
  opacity: 0,
  duration: 1,
  stagger: 0.06,
  ease: 'expo.out',
  scrollTrigger: { trigger: '#book', start: 'top 65%' },
});

const emblem = $('#emblem');
if (emblem && !reduceMotion) {
  gsap.fromTo(emblem, { yPercent: 14, scale: 0.92, opacity: 0 }, { yPercent: -6, scale: 1, opacity: 0.95, ease: 'none', scrollTrigger: { trigger: '#book', start: 'top 85%', end: 'top 10%', scrub: 0.8 } });
  let emblemLive = false;
  ScrollTrigger.create({ trigger: '#book', start: 'top 90%', onToggle: (self) => (emblemLive = self.isActive) });
  gsap.ticker.add(() => {
    if (emblemLive) emblem.style.setProperty('--g', (22 + flow.energy * 46).toFixed(1));
  });
}

gsap.from('.foot__mark span', {
  yPercent: 70,
  opacity: 0,
  duration: 1.6,
  stagger: 0.1,
  ease: 'expo.out',
  scrollTrigger: { trigger: '.foot', start: 'top 92%' },
});

/* ------------------------------------------------------------------ */
/* Movements: the page as a score                                      */
/* ------------------------------------------------------------------ */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const MOVEMENTS = [
  { id: 'hero', name: 'Prelude', color: RED, alpha: 0.9 },
  { id: 'manifesto', name: 'Andante', color: [214, 74, 86], alpha: 0.4 },
  { id: 'lineup', name: 'Ensemble', color: RED, alpha: 0.6 },
  ...band.members.map((m) => ({ id: `ch-${m.id}`, name: m.chapter, color: hexToRgb(m.color), alpha: 0.4 })),
  { id: 'book', name: 'Coda', color: RED, alpha: 0.85 },
].map((m, i) => ({ ...m, n: ROMAN[i] }));
void FIRST_CHAPTER;

const mvWrap = $('#movements');
const mvLabel = $('#movementLabel');
mvWrap.innerHTML = MOVEMENTS.map((m) => `<a href="#${m.id}" aria-label="${m.name}" data-cursor="hover">${m.n}</a>`).join('');
const mvLinks = $$('a', mvWrap);

MOVEMENTS.forEach((m, i) => {
  const enter = () => {
    mvLinks.forEach((a, j) => a.classList.toggle('is-active', i === j));
    mvLabel.innerHTML = `<b>${m.n}</b>${m.name}`;
    tint(m.color, m.alpha);
  };
  ScrollTrigger.create({ trigger: `#${m.id}`, start: 'top 55%', end: 'bottom 55%', onEnter: enter, onEnterBack: enter });
});
