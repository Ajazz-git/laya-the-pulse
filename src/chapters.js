import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

// Chapters sit after the Prelude, Andante and Ensemble, so the first is movement IV.
export const FIRST_CHAPTER = 3;

export function buildChapters(members) {
  return members
    .map((m, i) => {
      const rgb = hexToRgb(m.color).join(',');
      return `
    <section id="ch-${m.id}" class="chapter" data-entrance="${m.entrance}" style="--accent:${m.color};--rgb:${rgb}">
      <div class="chapter__wash"></div>
      ${m.id === 'bass' ? `<canvas id="bassCanvas" aria-label="Interactive bass strings. Drag across them to play."></canvas>` : ''}
      <div class="chapter__head">
        <p class="eyebrow">Movement ${ROMAN[FIRST_CHAPTER + i]} · ${m.chapter}</p>
        <h2 class="chapter__name" aria-label="${m.first}">${[...m.first].map((c) => `<span class="nm"><span class="nm__c">${c}</span></span>`).join('')}</h2>
        <p class="chapter__line">${m.line}</p>
        <p class="chapter__bio">${m.bio}</p>
        ${m.id === 'bass' ? '<p class="chapter__hint"><span>Drag across the strings</span></p>' : ''}
      </div>
      <aside class="chapter__side">
        <div class="portrait"><div class="portrait__in"><img src="${m.img}" alt="${m.name}, ${m.role}" loading="lazy" /></div></div>
        <div class="meta">
          <p class="meta__name">${m.name}</p>
          <p class="meta__role">${m.role}</p>
          <ul class="meta__tags">${m.tags.map((t) => `<li>${t}</li>`).join('')}</ul>
          <p class="meta__brings"><small>Brings to the sound</small>${m.brings}</p>
        </div>
      </aside>
    </section>`;
    })
    .join('');
}

// Each member's portrait arrives differently, always out of the depth and toward the right edge.
const ENTRANCES = {
  rise: { clip: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'], x: 40, y: 120, rot: 0, scale: 0.94, img: 1.5, blur: 10, ease: 'expo.out', dur: 1.9 },
  slam: { clip: ['inset(0% 0% 0% 100%)', 'inset(0% 0% 0% 0%)'], x: 220, y: 0, rot: 0, scale: 0.82, img: 1.35, blur: 14, ease: 'expo.out', dur: 1.5 },
  drift: { clip: ['inset(0% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'], x: 110, y: 30, rot: 0, scale: 0.86, img: 1.18, blur: 26, ease: 'power3.out', dur: 2.4 },
  drop: { clip: ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'], x: 60, y: -140, rot: 0, scale: 0.92, img: 1.5, blur: 10, ease: 'expo.out', dur: 1.8 },
  slice: { clip: ['inset(0% 0% 0% 100%)', 'inset(0% 0% 0% 0%)'], x: 180, y: 40, rot: 5, scale: 0.88, img: 1.4, blur: 12, ease: 'power4.out', dur: 1.7 },
};

export function animateChapters({ reduceMotion, onEnter }) {
  document.querySelectorAll('.chapter').forEach((sec) => {
    const q = (s) => sec.querySelector(s);
    const e = ENTRANCES[sec.dataset.entrance] || ENTRANCES.rise;

    // Colour wash fades in as the chapter approaches.
    gsap.to(sec, { '--wash': 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top 85%', end: 'top 25%', scrub: true } });

    if (reduceMotion) return;

    // Name: letters rise out of a mask.
    const letters = sec.querySelectorAll('.nm__c');
    gsap.set(letters, { yPercent: 115 });
    // Everything else starts hidden.
    gsap.set(sec.querySelectorAll('.eyebrow, .chapter__line, .chapter__bio, .meta > *, .chapter__hint'), { opacity: 0, y: 26 });
    gsap.set(q('.portrait'), { opacity: 0, x: e.x, y: e.y, scale: e.scale, rotate: e.rot, clipPath: e.clip[0], filter: `blur(${e.blur}px)` });
    gsap.set(q('.portrait__in'), { scale: e.img });

    const tl = gsap
      .timeline({ paused: true, defaults: { ease: 'expo.out' } })
      .to(q('.portrait'), { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, clipPath: e.clip[1], filter: 'blur(0px)', duration: e.dur, ease: e.ease })
      .to(q('.portrait__in'), { scale: 1, duration: e.dur * 1.25, ease: 'power3.out' }, 0)
      .to(letters, { yPercent: 0, duration: 1.3, stagger: 0.06 }, 0.15)
      .to(sec.querySelectorAll('.eyebrow, .chapter__line, .chapter__bio, .chapter__hint'), { opacity: 1, y: 0, duration: 1.1, stagger: 0.12 }, 0.45)
      .to(sec.querySelectorAll('.meta > *'), { opacity: 1, y: 0, duration: 1.1, stagger: 0.1 }, 0.8);

    ScrollTrigger.create({
      trigger: sec,
      start: 'top 62%',
      onEnter: () => {
        tl.timeScale(1).play();
        onEnter?.(sec);
      },
      onLeaveBack: () => tl.timeScale(1.8).reverse(),
    });

    // Slow parallax: the portrait floats against the scroll.
    gsap.to(q('.portrait__in img'), {
      yPercent: -6,
      ease: 'none',
      scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}
