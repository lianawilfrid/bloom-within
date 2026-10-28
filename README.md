# Bloom Within

An animated, gentle help-and-resources site for people affected by eating disorders.

Plain HTML, CSS and JavaScript — no build step. Open `index.html` or host it with GitHub Pages.
Every page has a "Try another look" switcher to compare the four designs:

- `/` — the original (particles, gradients, flip cards)
- `/dawn/` — Night to Dawn: real sky photographs crossfade from midnight to morning as you scroll.
  Uses GSAP + ScrollTrigger (from cdnjs) for the pinned hero-to-grid intro, and waits behind a
  loading screen until every photo is downloaded and decoded (8s maximum, with a skip link).
  Photos are free-licence images from Unsplash, loaded from images.unsplash.com.
- `/garden/` — Living Garden: colour fields, a vine that grows with scroll, swaying flowers
- `/collage/` — Paper Collage: torn-paper zine with draggable word magnets and stickers

Shared pieces live in `shared/`: `helplines.js` (helpline numbers, quick exit, calm mode) and `switcher.js`.
The original page keeps its own helpline list in `script.js`. Re-check all numbers every few months.
