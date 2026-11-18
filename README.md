# LAYA — The Pulse

An immersive, scroll-driven portfolio site for **Laya**, a five-piece progressive & folk rock band from Kerala, India.

The site's tempo is the band's name: everything moves on a shared beat, and scrolling is how you play it.

## Draft 1 (this build)
- Pulse-line intro with opt-in sound
- LAYA hero with per-letter mouse parallax
- Pinned manifesto with word-by-word reveal and a 7/8 meter counter
- Lineup index with hover photo reveal
- Interactive bass chapter (Tomson): drag across five strings, WebAudio plucks
- Booking section

## Stack
Vite · GSAP + ScrollTrigger · Lenis · Canvas 2D · WebAudio

## Run
```bash
npm install
npm run dev
```

## Content
Edit `src/data.js` (members, colors, tagline, contact links). Member photos live in `public/members/`.

## Roadmap
Drums, flute, lead guitar and vocals chapters · band mixer · "why book Laya" stacked cards · real photos, audio and video · booking form
