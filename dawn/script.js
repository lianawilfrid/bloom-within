// Night to Dawn — real sky photographs, preloaded, then choreographed with GSAP + ScrollTrigger.
(() => {
  const { quickExit, calm, esc } = window.BLOOM_COMMON;
  const root = document.documentElement;
  quickExit(document.getElementById("quickExit"));
  let ready = false;
  const isCalm = calm(document.getElementById("calmBtn"), () => { if (ready) build(); });

  /* ---------- photographs (Unsplash, served at the size each screen needs) ---------- */
  const photoURL = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=75&w=${w}`;
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
    if (fullscreen.has(id)) { widths = [960, 1600, 2400]; sizes = "100vw"; }
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
  });

  /* ---------- scroll choreography ---------- */
  const hasGSAP = !!(window.gsap && window.ScrollTrigger);
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);
  let ctx;

  function build() {
    if (!hasGSAP) {
      // GSAP failed to load: show everything as a plain page.
      document.querySelectorAll(".reveal").forEach((el) => { el.style.opacity = 1; el.style.transform = "none"; });
      return;
    }
    if (ctx) ctx.revert();
    const still = isCalm();
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
        gsap.set(shotImg, { scale: 1.12 });
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

  /* ---------- 5-4-3-2-1 ---------- */
  const checks = [...document.querySelectorAll("#groundList input")];
  const groundDone = document.getElementById("groundDone");
  checks.forEach((c) => c.addEventListener("change", () => groundDone.classList.toggle("show", checks.every((x) => x.checked))));

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
