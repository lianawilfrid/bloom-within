# Bloom Within

A gentle help-and-resources site for people affected by eating disorders. Real sky photographs
crossfade from midnight to morning as you scroll.

Plain HTML, CSS and JavaScript — no build step. Open `index.html` or host it with GitHub Pages.

- `index.html` — page content
- `style.css` — design
- `script.js` — photo loading, scroll animation (GSAP + ScrollTrigger from cdnjs), breathing, helplines, notes
- `shared/helplines.js` — helpline numbers, quick exit and calm mode

The page waits behind a loading screen until every photo is downloaded and decoded
(8 seconds maximum, with a skip link). Photos are free-licence images from Unsplash,
loaded from images.unsplash.com.

Re-check the helpline numbers in `shared/helplines.js` every few months.
