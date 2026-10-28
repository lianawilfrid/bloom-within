// Night to Dawn — real sky photographs, preloaded, then choreographed with GSAP + ScrollTrigger.
(() => {
  const { quickExit, calm, esc } = window.BLOOM_COMMON;
  const root = document.documentElement;
  quickExit(document.getElementById("quickExit"));
  let ready = false;
  const isCalm = calm(document.getElementById("calmBtn"), () => { if (ready) build(); });

  /* ---------- photographs (Unsplash, served at the size each screen needs) ---------- */
  const photoURL = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=82&w=${w}`;
  const imgs = [...document.querySelectorAll("img[data-photo]")];
  // Any photo shown full-screen somewhere uses the full-screen sizes everywhere,
  // so the browser downloads it once and every copy comes from cache.
  const fullscreen = new Set(
    imgs.filter((i) => i.closest(".sky, .hero-shot, .band")).map((i) => i.dataset.photo)
  );
  imgs.forEach((img) => {
    const id = img.dataset.photo;
    const fixed = Number(img.dataset.w);
    let widths, sizes;
    if (fullscreen.has(id)) { widths = [1280, 1920, 2560, 3200]; sizes = "100vw"; }
    else if (fixed) { widths = [Math.round(fixed * 0.66), fixed]; sizes = `${Math.round(fixed / 2.6)}px`; }
    else { widths = [640, 1080, 1600]; sizes = "(max-width: 820px) 50vw, 25vw"; }
    img.sizes = sizes;
    img.srcset = widths.map((w) => `${photoURL(id, w)} ${w}w`).join(", ");
    img.src = photoURL(id, widths[1]);
    img.decoding = "async";
  });

  /* ---------- loading screen: wait until every photo is downloaded and decoded ---------- */
  const loader = document.getElementById("loader");
  const bar = document.getElementById("loaderBar");
  const text = document.getElementById("loaderText");
  const skip = document.getElementById("loaderSkip");
  let loaded = 0;
  const tickLoad = () => {
    loaded++;
    bar.style.transform = `scaleX(${loaded / imgs.length})`;
    text.textContent = loaded < imgs.length ? `Waiting for the sky… ${Math.round((loaded / imgs.length) * 100)}%` : "Here comes the night.";
  };
  const whenReady = (img) => new Promise((resolve) => {
    const finish = () => { tickLoad(); resolve(); };
    const decode = () => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()).then(finish);
    if (img.complete && img.naturalWidth) decode();
    else {
      img.addEventListener("load", decode, { once: true });
      img.addEventListener("error", finish, { once: true });
    }
  });
  // Someone in distress should never be stuck behind a loading screen: cap it, and offer a way past.
  const cap = new Promise((r) => setTimeout(r, 8000));
  const skipped = new Promise((r) => skip.addEventListener("click", r, { once: true }));
  setTimeout(() => { skip.hidden = false; }, 2500);
  const allPhotos = Promise.all(imgs.map(whenReady));
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([Promise.all([allPhotos, fonts]), cap, skipped]).then(() => {
    loader.classList.add("done");
    root.classList.remove("loading");
    ready = true;
    build();
    startPond();
  });

  /* ---------- scroll choreography ---------- */
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);
  let ctx;

  /* ---------- Lenis: weighted, smooth scrolling that drives ScrollTrigger from GSAP's own clock ---------- */
  let lenis = null;
  const lenisTick = (time) => lenis && lenis.raf(time * 1000);
  const setSmoothScroll = (on) => {
    if (!window.Lenis || !hasGSAP) return;
    if (on && !lenis) {
      lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(lenisTick);
      gsap.ticker.lagSmoothing(0);
    } else if (!on && lenis) {
      gsap.ticker.remove(lenisTick);
      lenis.destroy();
      lenis = null;
    }
  };
  // In-page links glide with Lenis instead of jumping.
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || !lenis) return;
    const target = a.getAttribute("href") === "#top" ? 0 : document.querySelector(a.getAttribute("href"));
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: 1.6 });
  });

  /* ---------- Blur text (after React Bits' BlurText): words come into focus one by one ---------- */
  const splitWords = (el) => {
    if (el.dataset.split) return el.querySelectorAll(".w");
    el.dataset.split = "1";
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    [...el.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
        const w = document.createElement("span");
        w.className = "w"; w.setAttribute("aria-hidden", "true"); w.textContent = part;
        frag.appendChild(w);
      });
      node.replaceWith(frag);
    });
    return el.querySelectorAll(".w");
  };
  const blurIn = (words, vars = {}) => gsap.fromTo(words,
    { opacity: 0, filter: "blur(12px)", y: "0.3em" },
    { opacity: 1, filter: "blur(0px)", y: 0, duration: 1, stagger: 0.07, ease: "power3.out", clearProps: "filter", ...vars });

  /* ---------- Vanta fog: faint, drifting mist blended over the real photographs at blue hour and dawn ---------- */
  let mist = null;
  const loadScript = (src) => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  const setMist = async (on) => {
    // WebGL fog is costly: desktop pointers only, and never in calm mode.
    const capable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (on && capable && !mist) {
      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js");
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/vanta/0.5.24/vanta.fog.min.js");
        if (isCalm() || mist) return;
        mist = window.VANTA.FOG({
          el: "#mist", mouseControls: false, touchControls: false, gyroControls: false,
          highlightColor: 0xffc9a6, midtoneColor: 0x8a8fc0, lowlightColor: 0x262a55, baseColor: 0x000000,
          blurFactor: 0.72, speed: 0.7, zoom: 0.65,
        });
      } catch (e) { /* the photographs carry the page on their own */ }
    } else if (!on && mist) {
      mist.destroy();
      mist = null;
    }
  };

  function build() {
    if (!hasGSAP) {
      // GSAP failed to load: show everything as a plain page.
      document.querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
      return;
    }
    if (ctx) ctx.revert();
    const still = isCalm();
    setSmoothScroll(!still);
    setMist(!still);
    ctx = gsap.context(() => {
      // 1. The sky: each photograph fades in over the last, midnight → morning.
      const layers = gsap.utils.toArray(".sky-layer");
      const sky = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          start: 0, end: "max", scrub: 1.2,
          onUpdate: (self) => root.classList.toggle("day", self.progress > 0.62),
        },
      });
      layers.slice(1).forEach((layer, i) => {
        sky.to(layer, { opacity: 1, duration: 1 }, i);
        if (!still) sky.fromTo(layer, { scale: 1.08 }, { scale: 1, duration: 2 }, i);
      });
      // mist gathers in the blue hour, glows at sunrise, and burns off by morning
      sky.fromTo("#mist", { opacity: 0 }, { opacity: 0.6, duration: 1.2 }, 0.5)
        .to("#mist", { opacity: 0, duration: 1.2 }, 2.6);

      // Headings come into focus word by word, like eyes adjusting to the light.
      if (!still) {
        blurIn(splitWords(document.querySelector(".hero-copy h1")), { delay: 0.15 });
        gsap.utils.toArray(".chapter-head h2, .close-big").forEach((h) => {
          blurIn(splitWords(h), { scrollTrigger: { trigger: h, start: "top 86%", once: true } });
        });
      }

      // 2. Intro: the full-screen night photo settles into its place in the grid.
      const intro = document.getElementById("intro");
      const shot = document.getElementById("heroShot");
      const shotImg = shot.querySelector("img");
      const tile = document.getElementById("heroTile");
      const copy = document.getElementById("heroCopy");
      const others = gsap.utils.toArray(".mosaic .tile:not(.t-hero)");
      if (!still) {
        const insetToTile = () => {
          const s = intro.getBoundingClientRect(), t = tile.getBoundingClientRect();
          return `inset(${t.top - s.top}px ${s.right - t.right}px ${s.bottom - t.bottom}px ${t.left - s.left}px round 16px)`;
        };
        gsap.set(shot, { clipPath: "inset(0px 0px 0px 0px round 0px)" });
        gsap.set(shotImg, { scale: 1.04 });
        gsap.set(others, { opacity: 0, y: 48, scale: 0.94 });
        gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: intro, start: "top top", end: "+=170%", pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
        })
          .to(copy, { opacity: 0, y: -70, duration: 0.3, ease: "power1.in" }, 0)
          .to(shot, { clipPath: insetToTile, duration: 1, ease: "power3.inOut" }, 0.05)
          .to(shotImg, { scale: 1, duration: 1, ease: "power3.inOut" }, 0.05)
          .to(others, { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.07, ease: "power2.out" }, 0.55)
          .to(shot, { opacity: 0, duration: 0.15 }, 1.0)
          .to({}, { duration: 0.25 }); // a beat of stillness before the page moves on
      } else {
        gsap.set(".mosaic", { display: "none" });
      }

      // 3. Text eases in as it arrives.
      if (!still) {
        gsap.set(".reveal", { opacity: 0, y: 24 });
        ScrollTrigger.batch(".reveal", {
          start: "top 88%", once: true,
          onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, ease: "power3.out", overwrite: true }),
        });
      } else {
        gsap.set(".reveal", { opacity: 1, y: 0 });
      }

      // 4. Nature photographs drift slower than the page, like looking through a window.
      if (!still) {
        gsap.utils.toArray(".band").forEach((band) => {
          gsap.fromTo(band.querySelector("img"), { yPercent: -9 }, {
            yPercent: 9, ease: "none",
            scrollTrigger: { trigger: band, start: "top bottom", end: "bottom top", scrub: true },
          });
        });
      }
    });
    ScrollTrigger.refresh();
  }

  /* ---------- header ---------- */
  const barEl = document.getElementById("bar");
  const menuBtn = document.getElementById("menuBtn");
  const menu = document.getElementById("menu");
  const setMenu = (open) => { menu.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", String(open)); };
  menuBtn.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  let lastY = scrollY;
  window.addEventListener("scroll", () => {
    const y = scrollY;
    barEl.classList.toggle("solid", y > 40);
    barEl.classList.toggle("tucked", y > lastY && y > 240 && !menu.classList.contains("open"));
    lastY = y;
  }, { passive: true });

  /* ---------- breathing sunrise ---------- */
  const sunWin = document.getElementById("sunWindow");
  const cue = document.getElementById("sunCue");
  const steps = [["Breathe in…", "in", 4000], ["Hold…", "in", 4000], ["Breathe out…", "out", 6000]];
  let breathing = false, timer;
  const step = (i) => {
    const [label, state, ms] = steps[i];
    cue.textContent = label;
    sunWin.classList.toggle("in", state === "in");
    sunWin.classList.toggle("out", state === "out");
    timer = setTimeout(() => step((i + 1) % steps.length), ms);
  };
  sunWin.addEventListener("click", () => {
    breathing = !breathing;
    clearTimeout(timer);
    if (breathing) step(0);
    else { sunWin.classList.remove("in", "out"); cue.textContent = "Tap the sunrise to begin"; }
  });

  /* ---------- 5-4-3-2-1 on still water: each noticing drops a real-looking ripple ---------- */
  function startPond() {
    const pond = document.getElementById("pond");
    const photo = document.getElementById("pondPhoto");
    const canvas = document.getElementById("pondCanvas");
    const hit = document.getElementById("pondHit");
    const stepEl = document.getElementById("pondStep");
    const promptEl = document.getElementById("pondPrompt");
    const dotsEl = document.getElementById("pondDots");
    const reset = document.getElementById("pondReset");
    const senses = [
      [5, "Notice <b>5</b> things you can see"],
      [4, "Notice <b>4</b> things you can touch"],
      [3, "Notice <b>3</b> things you can hear"],
      [2, "Notice <b>2</b> things you can smell"],
      [1, "Notice <b>1</b> kind thing you can say to yourself"],
    ];
    let stage = 0, count = 0;

    // Water simulation: two height maps; each frame a wave spreads to its neighbours and slowly settles.
    const ctx2 = canvas.getContext("2d", { willReadFrequently: true });
    let W = 0, H = 0, cur, prev, tex = null, out, running = false, visible = false;
    const size = () => {
      const r = pond.getBoundingClientRect();
      W = Math.max(160, Math.round(Math.min(420, r.width / 2)));
      H = Math.max(100, Math.round(W * (r.height / r.width)));
      canvas.width = W; canvas.height = H;
      cur = new Float32Array(W * H); prev = new Float32Array(W * H);
      out = ctx2.createImageData(W, H);
      // sample the photograph at the simulation's size, cropped like object-fit: cover
      try {
        const iw = photo.naturalWidth, ih = photo.naturalHeight, s = Math.max(W / iw, H / ih);
        ctx2.drawImage(photo, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s);
        tex = ctx2.getImageData(0, 0, W, H).data;
      } catch (e) { tex = null; } // photo blocked from reading: ripples fall back to light rings only
    };
    const drop = (fx, fy, strength = 1) => {
      const cx = Math.round(fx * W), cy = Math.round(fy * H), rad = Math.max(3, Math.round(W / 48));
      for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
        const px = cx + x, py = cy + y;
        if (px < 1 || py < 1 || px >= W - 1 || py >= H - 1 || x * x + y * y > rad * rad) continue;
        prev[py * W + px] += 240 * strength * (1 - Math.sqrt(x * x + y * y) / (rad + 1));
      }
      if (!running) { running = true; requestAnimationFrame(tick); }
    };
    const tick = () => {
      let energy = 0;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        let v = (prev[i - 1] + prev[i + 1] + prev[i - W] + prev[i + W]) / 2 - cur[i];
        v -= v / 34;
        cur[i] = v;
        energy += v < 0 ? -v : v;
      }
      const t = prev; prev = cur; cur = t;
      const d = out.data;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const dx = prev[i - 1] - prev[i + 1], dy = prev[i - W] - prev[i + W];
        const sx = Math.min(W - 1, Math.max(0, x + (dx >> 3))), sy = Math.min(H - 1, Math.max(0, y + (dy >> 3)));
        const si = (sy * W + sx) * 4, o = i * 4, light = (dx - dy) * 0.12;
        if (tex) { d[o] = tex[si] + light; d[o + 1] = tex[si + 1] + light; d[o + 2] = tex[si + 2] + light; d[o + 3] = 255; }
        else { d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = Math.min(160, Math.abs(light) * 3); }
      }
      ctx2.putImageData(out, 0, 0);
      if (energy > W * H * 0.02) requestAnimationFrame(tick);
      else running = false;
    };
    const paint = () => { if (!tex) return; const img = ctx2.createImageData(W, H); img.data.set(tex); ctx2.putImageData(img, 0, 0); };

    const renderDots = () => {
      const [n] = senses[stage];
      dotsEl.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < count ? "on" : ""}"></i>`).join("");
    };
    const show = () => {
      stepEl.textContent = `${stage + 1} of 5`;
      promptEl.innerHTML = senses[stage][1];
      renderDots();
    };
    const swap = (fn) => { pond.classList.add("fade"); setTimeout(() => { fn(); pond.classList.remove("fade"); }, 450); };
    hit.addEventListener("click", (e) => {
      if (stage >= senses.length) return;
      const r = pond.getBoundingClientRect();
      const fx = e.detail ? (e.clientX - r.left) / r.width : 0.3 + Math.random() * 0.4;
      const fy = e.detail ? (e.clientY - r.top) / r.height : 0.55 + Math.random() * 0.2;
      drop(fx, fy, 1);
      count++;
      renderDots();
      if (count >= senses[stage][0]) {
        setTimeout(() => drop(0.5, 0.62, 2.2), 260); // one larger ripple to close each sense
        stage++; count = 0;
        swap(() => {
          if (stage < senses.length) show();
          else {
            stepEl.textContent = "Done";
            promptEl.innerHTML = "You're here. Right now. That's enough.";
            dotsEl.innerHTML = "";
            reset.hidden = false;
          }
        });
      }
    });
    reset.addEventListener("click", () => { stage = 0; count = 0; reset.hidden = true; swap(show); hit.focus(); });

    // a raindrop now and then while the pond is on screen, so the water feels alive
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(pond);
    setInterval(() => { if (visible && !isCalm() && !document.hidden && !running) drop(Math.random(), 0.45 + Math.random() * 0.5, 0.35); }, 3800);

    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { size(); paint(); }, 200); });
    const ready = () => { size(); paint(); pond.classList.add("live"); };
    if (photo.complete && photo.naturalWidth) ready(); else photo.addEventListener("load", ready, { once: true });
    show();
  }

  /* ---------- what your food gives back (no numbers, on purpose) ---------- */
  (() => {
    const N = window.BLOOM_NOURISH;
    if (!N) return;
    const pantry = document.getElementById("pantry");
    const plateEl = document.getElementById("plate");
    const clearBtn = document.getElementById("plateClear");
    const field = document.getElementById("nutrientField");
    const nNote = document.getElementById("nutrientNote");
    const spots = document.getElementById("bodySpots");
    const bNote = document.getElementById("bodyNote");
    const list = document.getElementById("foodList");
    const plate = new Map(); // name -> food
    let lit = new Set();

    N.foods.forEach((f) => {
      const b = document.createElement("button");
      b.className = "food"; b.type = "button"; b.textContent = f.name; b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => toggle(f));
      f.btn = b;
      pantry.appendChild(b);
      list.insertAdjacentHTML("beforeend", `<option value="${esc(f.name)}">`);
    });
    const groups = [["macro", "The big five"], ["micro", "Vitamins & minerals"], ["joy", "And something more"]];
    field.innerHTML = groups.map(([g, title]) => `<div class="n-group"><p class="n-title">${title}</p><div class="n-row">${
      Object.entries(N.nutrients).filter(([, n]) => n.group === g)
        .map(([k, n]) => `<button class="nut" type="button" data-k="${k}" style="--lvl:0">${esc(n.label)}</button>`).join("")
    }</div></div>`).join("");
    spots.innerHTML = Object.entries(N.parts).map(([k, p]) =>
      `<button class="spot" type="button" data-k="${k}" style="left:${p.x}%;top:${p.y}%;--lvl:0" aria-label="${esc(p.label)}"><span>${esc(p.label)}</span></button>`).join("");

    const foodsWith = (k) => [...plate.values()].filter((f) => f.has.includes(k)).map((f) => f.name.toLowerCase());
    const listWords = (arr) => arr.length < 2 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;

    function render() {
      plateEl.innerHTML = plate.size
        ? [...plate.values()].map((f) => `<button class="on-plate" type="button" data-n="${esc(f.name)}">${esc(f.name)}<span aria-hidden="true">×</span><span class="sr"> remove</span></button>`).join("")
        : '<p class="plate-empty">Your plate is waiting. Tap a few foods above.</p>';
      clearBtn.hidden = !plate.size;
      const total = Math.max(1, plate.size);
      const level = {};
      Object.keys(N.nutrients).forEach((k) => {
        level[k] = plate.size ? Math.min(1, foodsWith(k).length / Math.min(total, 3)) : 0;
        field.querySelector(`[data-k="${k}"]`).style.setProperty("--lvl", level[k].toFixed(2));
      });
      const nowLit = new Set();
      Object.entries(N.parts).forEach(([pk]) => {
        const lv = Math.max(0, ...Object.entries(N.nutrients).filter(([, n]) => n.parts.includes(pk)).map(([k]) => level[k]));
        const el = spots.querySelector(`[data-k="${pk}"]`);
        el.style.setProperty("--lvl", lv.toFixed(2));
        if (lv > 0) nowLit.add(pk);
        if (lv > 0 && !lit.has(pk)) { el.classList.remove("thank"); void el.offsetWidth; el.classList.add("thank"); }
      });
      lit = nowLit;
      if (!plate.size) { nNote.textContent = "Choose a food to see what it brings."; bNote.textContent = "Your whole body is listening."; }
      else bNote.textContent = `${lit.size} ${lit.size === 1 ? "part of you is" : "parts of you are"} glowing. Tap one to hear what it's saying.`;
    }
    function toggle(f) {
      if (plate.has(f.name)) plate.delete(f.name); else plate.set(f.name, f);
      if (f.btn) f.btn.setAttribute("aria-pressed", String(plate.has(f.name)));
      render();
    }
    plateEl.addEventListener("click", (e) => {
      const b = e.target.closest(".on-plate");
      if (b) toggle(plate.get(b.dataset.n));
    });
    clearBtn.addEventListener("click", () => { plate.forEach((f) => f.btn && f.btn.setAttribute("aria-pressed", "false")); plate.clear(); render(); });
    field.addEventListener("click", (e) => {
      const b = e.target.closest(".nut"); if (!b) return;
      const n = N.nutrients[b.dataset.k], from = foodsWith(b.dataset.k);
      nNote.innerHTML = `<b>${esc(n.label)}</b> — ${esc(n.does)}${from.length ? ` <span class="from">On your plate: ${esc(listWords(from))}.</span>` : ""}`;
    });
    spots.addEventListener("click", (e) => {
      const b = e.target.closest(".spot"); if (!b) return;
      const p = N.parts[b.dataset.k];
      const helpers = [...new Set(Object.entries(N.nutrients).filter(([k, n]) => n.parts.includes(b.dataset.k) && foodsWith(k).length).flatMap(([k]) => foodsWith(k)))];
      bNote.innerHTML = helpers.length
        ? `<b>${esc(p.label)}:</b> "${esc(p.thanks)}" <span class="from">Thanks to ${esc(listWords(helpers))}.</span>`
        : `<b>${esc(p.label)}</b> is waiting for something on your plate that it loves.`;
    });
    document.getElementById("foodAdd").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("foodInput");
      const q = input.value.trim().toLowerCase();
      if (!q) return;
      const f = N.foods.find((x) => x.name.toLowerCase() === q) || N.foods.find((x) => x.name.toLowerCase().includes(q));
      if (f) { if (!plate.has(f.name)) toggle(f); }
      else {
        const own = { name: input.value.trim(), has: ["joy"] };
        plate.set(own.name, own); render();
        nNote.innerHTML = `<b>${esc(own.name)}</b> isn't in our pantry yet — but it still nourishes you, and it still counts.`;
      }
      input.value = "";
    });
    render();
  })();

  /* ---------- resources: community, bookshelf, podcasts, research ---------- */
  (() => {
    const R = window.BLOOM_RESOURCES;
    if (!R) return;
    document.getElementById("commList").innerHTML = R.communities.map((c) =>
      `<a class="comm reveal" href="${esc(c.url)}" target="_blank" rel="noopener"><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p><span class="go">Open on Reddit ↗</span></a>`).join("");
    document.getElementById("shelf").innerHTML = R.books.map((b) =>
      `<a class="book" href="https://openlibrary.org/isbn/${b.isbn}" target="_blank" rel="noopener">
        <span class="cover"><img src="https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg" alt="Cover of ${esc(b.title)}" loading="lazy"></span>
        <h3>${esc(b.title)}</h3><p class="by">${esc(b.author)}</p><p>${esc(b.note)}</p></a>`).join("");
    document.getElementById("podList").innerHTML = R.podcasts.map((p) =>
      `<a class="pod reveal" href="${esc(p.url)}" target="_blank" rel="noopener">
        <span class="pod-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M7 15.5c3-1 7-.8 10 .6M6.5 12.3c3.5-1.2 8-1 11.5.8M6 9c4-1.4 9-1.1 13 1"/></svg></span>
        <span class="pod-body"><h3>${esc(p.name)}</h3><p class="by">${esc(p.host)}</p><p>${esc(p.desc)}</p></span>
        <span class="go">Listen on Spotify ↗</span></a>`).join("");
    document.getElementById("papers").innerHTML = R.research.map((r) =>
      `<li class="paper reveal"><span class="topic">${esc(r.topic)}</span>
        <a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener">${esc(r.title)}</a>
        <p>${esc(r.authors)} · <i>${esc(r.journal)}</i>, ${r.year}</p></li>`).join("");

    // drag the bookshelf sideways like a real shelf (touch already scrolls natively)
    const shelf = document.getElementById("shelf");
    let down = false, sx = 0, sl = 0, moved = false;
    shelf.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") return; down = true; moved = false; sx = e.clientX; sl = shelf.scrollLeft; shelf.classList.add("grabbing"); });
    window.addEventListener("pointermove", (e) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) moved = true; shelf.scrollLeft = sl - dx; });
    window.addEventListener("pointerup", () => { down = false; shelf.classList.remove("grabbing"); });
    shelf.addEventListener("click", (e) => { if (moved) { e.preventDefault(); moved = false; } }, true);
    shelf.addEventListener("dragstart", (e) => e.preventDefault());

    // highlight where you are in the resources
    const links = [...document.querySelectorAll("#resNav a")];
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) links.forEach((a) => a.classList.toggle("here", a.getAttribute("href") === `#${en.target.id}`));
    }), { rootMargin: "-45% 0px -50% 0px" });
    ["steps", "community", "books", "podcasts", "research"].forEach((id) => io.observe(document.getElementById(id)));
  })();

  /* ---------- myths ---------- */
  document.querySelectorAll(".myth button").forEach((b) => b.addEventListener("click", () => {
    const on = b.closest(".myth").classList.toggle("struck");
    b.setAttribute("aria-expanded", String(on));
  }));

  /* ---------- helplines ---------- */
  const icons = {
    call: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    text: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    web: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  };
  const data = window.BLOOM_HELPLINES;
  const regions = document.getElementById("regions");
  const pill = document.getElementById("regionPill");
  const lines = document.getElementById("lines");
  Object.entries(data).forEach(([key, r], i) => {
    const b = document.createElement("button");
    b.className = "region"; b.role = "tab"; b.dataset.key = key; b.textContent = r.label;
    b.setAttribute("aria-selected", String(i === 0));
    regions.appendChild(b);
  });
  const tabs = [...regions.querySelectorAll(".region")];
  const movePill = (t) => { pill.style.width = `${t.offsetWidth}px`; pill.style.transform = `translateX(${t.offsetLeft}px)`; };
  const show = (key) => {
    lines.innerHTML = data[key].lines.map((h, i) => {
      const ext = h.type === "web" ? ' target="_blank" rel="noopener"' : "";
      return `<article class="helpline" style="--i:${i}">
        <div><small>${esc(h.kind)}</small><h3>${esc(h.name)}</h3></div>
        <p>${esc(h.desc)}</p>
        <a class="reach" href="${esc(h.href)}"${ext}>${icons[h.type]}${esc(h.contact)}</a>
      </article>`;
    }).join("");
  };
  tabs.forEach((t) => t.addEventListener("click", () => {
    tabs.forEach((x) => x.setAttribute("aria-selected", String(x === t)));
    movePill(t); show(t.dataset.key);
  }));
  show(tabs[0].dataset.key);
  const syncPill = () => movePill(regions.querySelector('[aria-selected="true"]'));
  requestAnimationFrame(syncPill);
  window.addEventListener("resize", syncPill);
  document.fonts && document.fonts.ready.then(syncPill);

  /* ---------- notes pinned to the board ---------- */
  const board = document.getElementById("board");
  const seed = [
    "You made it through every hard day so far.",
    "Rest is productive.",
    "Food is fuel, comfort and connection.",
    "Progress, not perfection.",
    "Future me is proud of me.",
  ];
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem("bloom-notes") || "[]"); } catch (e) { saved = []; }
  const persist = () => { try { localStorage.setItem("bloom-notes", JSON.stringify(saved)); } catch (e) {} };
  const rand = (a, b) => a + Math.random() * (b - a);
  const place = (text, x, y, record) => {
    const n = document.createElement("div");
    n.className = "note"; n.textContent = text;
    n.style.setProperty("--r", `${rand(-3, 3).toFixed(1)}deg`);
    board.appendChild(n);
    const maxX = Math.max(0, (1 - n.offsetWidth / board.clientWidth) * 100);
    const maxY = Math.max(0, (1 - n.offsetHeight / board.clientHeight) * 100);
    n.style.left = `${Math.min(x, maxX)}%`; n.style.top = `${Math.min(y, maxY)}%`;
    let sx, sy, ox, oy, dragging = false;
    n.addEventListener("pointerdown", (e) => {
      if (dragging) return;
      dragging = true; n.setPointerCapture(e.pointerId); n.classList.add("dragging");
      sx = e.clientX; sy = e.clientY; ox = n.offsetLeft; oy = n.offsetTop;
    });
    n.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const nx = Math.max(0, Math.min(board.clientWidth - n.offsetWidth, ox + e.clientX - sx));
      const ny = Math.max(0, Math.min(board.clientHeight - n.offsetHeight, oy + e.clientY - sy));
      n.style.left = `${(nx / board.clientWidth) * 100}%`;
      n.style.top = `${(ny / board.clientHeight) * 100}%`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; n.classList.remove("dragging");
      if (record) { record.x = parseFloat(n.style.left); record.y = parseFloat(n.style.top); persist(); }
    };
    n.addEventListener("pointerup", end);
    n.addEventListener("pointercancel", end);
  };
  const cols = board.clientWidth < 600 ? 2 : 3;
  const rows = Math.ceil(seed.length / cols);
  seed.forEach((t, i) => place(t, 3 + (i % cols) * (96 / cols) + rand(0, 4), 5 + Math.floor(i / cols) * (90 / rows) + rand(0, 6)));
  saved.forEach((r) => place(r.text, r.x, r.y, r));
  document.getElementById("noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("noteInput");
    const t = input.value.trim();
    if (!t) return;
    const r = { text: t, x: rand(5, 60), y: rand(10, 65) };
    saved.push(r); persist(); place(r.text, r.x, r.y, r);
    input.value = "";
  });
})();
