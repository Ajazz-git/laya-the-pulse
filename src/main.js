import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { band } from './data.js';
import { audio } from './audio.js';
import { initBass } from './bass.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */
$('.hero__tag').textContent = band.tagline;

$('#heroMembers').innerHTML = band.members
  .map((m) => `<span><b style="--c:${m.color}"></b>${m.name} · ${m.role}</span>`)
  .join('');

$('#manifestoText').innerHTML = band.manifesto
  .split(' ')
  .map((w) => `<span class="word">${w}</span>`)
  .join(' ');

const PLAYABLE = { bass: '#bass' };
$('#lineupList').innerHTML = band.members
  .map(
    (m, i) => `
    <li style="--c:${m.color}" data-id="${m.id}">
      <a href="${PLAYABLE[m.id] || '#'}" data-cursor="hover">
        <span class="n">0${i + 1}</span>
        <span class="name">${m.name}</span>
        <span class="role">${m.role}</span>
      </a>
    </li>`
  )
  .join('');

$('#eventChips').innerHTML = band.events.map((e) => `<button class="chip" data-cursor="hover">${e}</button>`).join('');
$$('.chip').forEach((chip) =>
  chip.addEventListener('click', () => {
    $$('.chip').forEach((c) => c.classList.toggle('is-on', c === chip));
  })
);

const c = band.contact;
const link = (href, label) => `<a href="${href}" data-cursor="hover">${label}</a>`;
$('#bookContact').innerHTML = `
  <div class="contact"><small>Bookings</small>${
    c.email ? link(`mailto:${c.email}`, c.email) : c.phone ? c.phone : '<span>Add email / phone</span>'
  }</div>
  <div class="contact"><small>Instagram</small>${
    c.instagram ? link(`https://instagram.com/${c.instagram.replace('@', '')}`, c.instagram) : '<span>Add handle</span>'
  }</div>
  <div class="contact"><small>YouTube / Spotify</small>${
    c.youtube || c.spotify
      ? [c.youtube && link(c.youtube, 'YouTube'), c.spotify && link(c.spotify, 'Spotify')].filter(Boolean).join(' · ')
      : '<span>Add links</span>'
  }</div>
  <div class="contact"><small>Based in</small>Kerala, India</div>`;

$('#bookCta').addEventListener('click', () => {
  if (!c.email) return;
  const chip = $('.chip.is-on')?.textContent;
  const subject = encodeURIComponent(`Booking enquiry${chip ? ` — ${chip}` : ''}`);
  window.location.href = `mailto:${c.email}?subject=${subject}`;
});

/* ------------------------------------------------------------------ */
/* Smooth scroll                                                       */
/* ------------------------------------------------------------------ */
const lenis = new Lenis({ lerp: 0.09, smoothWheel: !reduceMotion });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  e.preventDefault();
  if (id === '#') return;
  const el = $(id);
  if (el) lenis.scrollTo(el, { duration: 1.6 });
});

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
soundBtn.addEventListener('click', () => {
  if (!audio.ready) audio.enable();
  else audio.toggle();
  soundBtn.classList.toggle('is-off', !audio.enabled);
});

/* ------------------------------------------------------------------ */
/* Intro                                                               */
/* ------------------------------------------------------------------ */
gsap.set('#pulse', { transformOrigin: '50% 50%' });

const introTl = gsap.timeline({ delay: 0.3 });
introTl
  .to('#pulsePath', { strokeDashoffset: 0, duration: 1.7, ease: 'power2.inOut' })
  .to('#pulse', { scaleY: 1.5, duration: 0.14, yoyo: true, repeat: 3, ease: 'power1.inOut' }, '-=0.5')
  .fromTo(
    '.intro-word span',
    { yPercent: 50, opacity: 0, filter: 'blur(16px)' },
    { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, stagger: 0.12, ease: 'expo.out' },
    '-=0.2'
  )
  .to('#pulsePath', { opacity: 0.2, duration: 1 }, '<')
  .to('.intro-sub', { opacity: 1, duration: 0.8 }, '-=0.5')
  .fromTo('.intro-actions', { y: 16 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.4');

let entered = false;
function enter(withSound) {
  if (entered) return;
  entered = true;
  introTl.kill();

  if (withSound) {
    audio.enable();
    audio.kick();
  } else {
    soundBtn.classList.add('is-off');
  }

  gsap
    .timeline()
    .to('.intro-actions, .intro-sub', { opacity: 0, duration: 0.3 })
    .to('.intro-word', { scale: 1.2, opacity: 0, duration: 0.7, ease: 'power2.in' }, '<')
    .to('#pulsePath', { opacity: 0, duration: 0.4 }, '<')
    .to('#intro', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=0.2')
    .add(() => {
      lenis.start();
      $('#intro').remove();
    })
    .add(heroIn, '-=0.7');
}

$$('[data-sound]').forEach((b) => b.addEventListener('click', () => enter(b.dataset.sound === 'on')));

function heroIn() {
  gsap
    .timeline()
    .from('.hero__word .ch', { yPercent: 110, rotate: 5, opacity: 0, duration: 1.4, stagger: 0.1, ease: 'expo.out' })
    .from('.hero .eyebrow, .hero__tag', { y: 20, opacity: 0, duration: 1, stagger: 0.15 }, '-=0.9')
    .from('#heroMembers span', { y: 16, opacity: 0, stagger: 0.08, duration: 0.8 }, '-=0.7')
    .from('.scroll-hint', { opacity: 0, duration: 1 }, '-=0.5')
    .to('.nav, .sound-toggle', { opacity: 1, duration: 1 }, '-=1.2');
}

if (reduceMotion) {
  introTl.kill();
  $('#intro').remove();
  soundBtn.classList.add('is-off');
  gsap.set('.nav, .sound-toggle', { opacity: 1 });
  lenis.start();
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */
// Letters drift apart and fade as you scroll away.
gsap.to('.hero__word', {
  yPercent: -22,
  gap: '0.7em',
  opacity: 0,
  ease: 'none',
  scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true },
});

// Subtle mouse parallax, each letter at a different depth.
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
/* Manifesto: pinned word reveal + 7/8 meter                           */
/* ------------------------------------------------------------------ */
const dotsWrap = $('#meterDots');
const ACCENTS = [0, 3, 5]; // 3 + 2 + 2
dotsWrap.innerHTML = Array.from({ length: 7 }, (_, i) => `<i class="${ACCENTS.includes(i) ? 'is-accent' : ''}"></i>`).join('');
const dots = $$('i', dotsWrap);
let beat = 0;
gsap.to({}, {
  duration: 0.26,
  repeat: -1,
  onRepeat() {
    dots.forEach((d, i) => d.classList.toggle('is-on', i === beat));
    beat = (beat + 1) % dots.length;
  },
});

gsap
  .timeline({
    scrollTrigger: { trigger: '#manifesto', start: 'top top', end: '+=170%', pin: true, scrub: 0.6 },
  })
  .to('.manifesto__text .word', { opacity: 1, stagger: 0.12, ease: 'none' });

/* ------------------------------------------------------------------ */
/* Lineup                                                              */
/* ------------------------------------------------------------------ */
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
  const prev = $('#lineupPreview');
  const prevImg = $('img', prev);
  gsap.set(prev, { scale: 0.85 });
  const px = gsap.quickTo(prev, 'x', { duration: 0.6, ease: 'power3' });
  const py = gsap.quickTo(prev, 'y', { duration: 0.6, ease: 'power3' });

  list.addEventListener('pointermove', (e) => {
    px(e.clientX + 36);
    py(e.clientY - prev.offsetHeight / 2);
  });

  $$('li', list).forEach((li) => {
    const m = band.members.find((x) => x.id === li.dataset.id);
    li.addEventListener('pointerenter', () => {
      list.classList.add('has-hover');
      li.classList.add('is-active');
      prevImg.src = m.img;
      prev.style.setProperty('--c', m.color);
      gsap.to(prev, { opacity: 1, scale: 1, duration: 0.45, ease: 'expo.out' });
    });
    li.addEventListener('pointerleave', () => {
      li.classList.remove('is-active');
    });
  });
  list.addEventListener('pointerleave', () => {
    list.classList.remove('has-hover');
    gsap.to(prev, { opacity: 0, scale: 0.85, duration: 0.3 });
  });
}

/* ------------------------------------------------------------------ */
/* Bass chapter                                                        */
/* ------------------------------------------------------------------ */
gsap.to('#bass', {
  '--wash': 1,
  ease: 'none',
  scrollTrigger: { trigger: '#bass', start: 'top 85%', end: 'top 25%', scrub: true },
});
gsap.from('.chapter--bass .chapter__head > *', {
  y: 70,
  opacity: 0,
  duration: 1.3,
  stagger: 0.12,
  ease: 'expo.out',
  scrollTrigger: { trigger: '#bass', start: 'top 55%' },
});
initBass();

/* ------------------------------------------------------------------ */
/* Book                                                                */
/* ------------------------------------------------------------------ */
gsap.from('.book__cta, .chips .chip, .book__contact .contact', {
  y: 50,
  opacity: 0,
  duration: 1,
  stagger: 0.06,
  ease: 'expo.out',
  scrollTrigger: { trigger: '#book', start: 'top 65%' },
});
