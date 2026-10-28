// Night to Dawn — the sky follows the visitor's scroll from midnight to morning.
(() => {
  const { quickExit, calm, esc } = window.BLOOM_COMMON;
  const root = document.documentElement;
  quickExit(document.getElementById("quickExit"));
  let skyReady = false;
  const isCalm = calm(document.getElementById("calmBtn"), () => { if (skyReady) { loop(); requestDraw(); } });

  /* ---------- sky ---------- */
  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  const palettes = [
    { p: 0.00, top: [6, 8, 28], bot: [24, 20, 66] },      // midnight
    { p: 0.22, top: [14, 18, 64], bot: [52, 36, 104] },   // deep night
    { p: 0.42, top: [44, 40, 112], bot: [178, 86, 124] }, // first light
    { p: 0.58, top: [104, 98, 168], bot: [255, 150, 112] }, // dawn
    { p: 0.76, top: [134, 182, 236], bot: [255, 206, 160] }, // sunrise
    { p: 1.00, top: [150, 208, 255], bot: [232, 246, 255] }, // morning
  ];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const skyAt = (p) => {
    let i = 0;
    while (i < palettes.length - 2 && p > palettes[i + 1].p) i++;
    const a = palettes[i], b = palettes[i + 1];
    const t = smooth(0, 1, (p - a.p) / (b.p - a.p));
    return { top: mix(a.top, b.top, t), bot: mix(a.bot, b.bot, t) };
  };
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  let W = 0, H = 0, dpr = 1, stars = [], clouds = [];
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = canvas.width = Math.round(innerWidth * dpr);
    H = canvas.height = Math.round(innerHeight * dpr);
    const count = Math.round(Math.min(240, innerWidth * innerHeight / 6000));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.92,
      r: (Math.random() ** 2 * 1.6 + 0.4) * dpr,
      depth: Math.random() * 0.6 + 0.2,
      phase: Math.random() * Math.PI * 2, speed: 0.6 + Math.random() * 1.6,
    }));
    clouds = Array.from({ length: 6 }, (_, i) => ({
      x: Math.random() * W, y: H * (0.18 + i * 0.12) + Math.random() * 40 * dpr,
      w: (220 + Math.random() * 260) * dpr, h: (40 + Math.random() * 40) * dpr,
      v: (0.08 + Math.random() * 0.18) * dpr,
    }));
    requestDraw();
  };

  let progress = 0;
  const pointer = { x: -1e4, y: -1e4 };
  let shooting = null, nextShoot = performance.now() + 4000;

  const draw = (now) => {
    const p = progress;
    const sky = skyAt(p);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(sky.top));
    g.addColorStop(1, rgb(sky.bot));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // warm glow on the horizon, strongest at dawn
    const glow = smooth(0.3, 0.6, p) * (1 - smooth(0.85, 1, p) * 0.6);
    if (glow > 0.01) {
      const hg = ctx.createRadialGradient(W * 0.7, H * 1.05, 0, W * 0.7, H * 1.05, Math.max(W, H) * 0.9);
      hg.addColorStop(0, `rgba(255,170,110,${0.55 * glow})`);
      hg.addColorStop(0.5, `rgba(255,120,120,${0.18 * glow})`);
      hg.addColorStop(1, "rgba(255,120,120,0)");
      ctx.fillStyle = hg;
      ctx.fillRect(0, 0, W, H);
    }

    // stars fade as the sky brightens
    const starVis = 1 - smooth(0.32, 0.62, p);
    if (starVis > 0.01) {
      const t = now / 1000;
      const scrollShift = window.scrollY * dpr;
      const near = [];
      for (const s of stars) {
        const y = ((s.y - scrollShift * s.depth * 0.08) % H + H) % H;
        let a = (0.55 + 0.45 * Math.sin(t * s.speed + s.phase)) * starVis;
        const d = Math.hypot(s.x - pointer.x, y - pointer.y);
        if (d < 150 * dpr) { a = Math.min(1, a + (1 - d / (150 * dpr)) * 0.8 * starVis); near.push([s.x, y]); }
        ctx.globalAlpha = a;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      // the cursor draws its own constellation from nearby stars
      if (near.length > 1) {
        ctx.globalAlpha = 0.35 * starVis;
        ctx.strokeStyle = "#fff"; ctx.lineWidth = dpr;
        ctx.beginPath();
        near.sort((a, b) => a[0] - b[0]);
        near.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      }
      // occasional shooting star
      if (!isCalm() && !shooting && now > nextShoot && starVis > 0.5) {
        shooting = { x: Math.random() * W * 0.6 + W * 0.2, y: Math.random() * H * 0.3, t0: now };
      }
      if (shooting) {
        const k = (now - shooting.t0) / 900;
        if (k >= 1) { shooting = null; nextShoot = now + 5000 + Math.random() * 7000; }
        else {
          const len = 160 * dpr, x = shooting.x + k * 380 * dpr, y = shooting.y + k * 160 * dpr;
          const sg = ctx.createLinearGradient(x, y, x - len, y - len * 0.42);
          sg.addColorStop(0, `rgba(255,255,255,${(1 - k) * starVis})`);
          sg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.globalAlpha = 1; ctx.strokeStyle = sg; ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len, y - len * 0.42); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // the sun climbs from below the horizon
    const rise = smooth(0.4, 1, p);
    if (rise > 0) {
      const r = Math.min(W, H) * 0.085;
      const sx = W * 0.74, sy = H * (1.12 - rise * 0.82);
      const halo = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, r * 5);
      halo.addColorStop(0, "rgba(255,214,150,.55)");
      halo.addColorStop(1, "rgba(255,214,150,0)");
      ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
      const disc = ctx.createRadialGradient(sx, sy - r * 0.2, 0, sx, sy, r);
      disc.addColorStop(0, "#fff6dc"); disc.addColorStop(0.55, "#ffc983"); disc.addColorStop(1, "#ff9a6a");
      ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
    }

    // soft clouds catch the light after first light
    const cloudVis = smooth(0.35, 0.75, p);
    if (cloudVis > 0.01) {
      const tint = mix(sky.bot, [255, 255, 255], 0.55);
      for (const c of clouds) {
        if (!isCalm()) c.x = (c.x + c.v + c.w) % (W + c.w * 2) - c.w;
        const cg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.w / 2);
        cg.addColorStop(0, rgb(tint, 0.5 * cloudVis));
        cg.addColorStop(1, rgb(tint, 0));
        ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, c.h / c.w * 2); ctx.translate(-c.x, -c.y);
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(c.x, c.y, c.w / 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }
    return sky;
  };

  /* ---------- ink follows the sky so text always stays readable ---------- */
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const LIGHT = [243, 239, 255], DARK = [29, 24, 56];
  let inkDark = null;
  const updateInk = (sky) => {
    const mid = mix(sky.top, sky.bot, 0.5);
    const L = lum(mid);
    const cLight = (lum(LIGHT) + 0.05) / (L + 0.05);
    const cDark = (L + 0.05) / (lum(DARK) + 0.05);
    const dark = cDark > cLight;
    if (dark === inkDark) return;
    inkDark = dark;
    const ink = dark ? DARK : LIGHT, paper = dark ? LIGHT : DARK;
    root.style.setProperty("--ink", rgb(ink));
    root.style.setProperty("--ink-soft", rgb(ink, dark ? 0.8 : 0.78));
    root.style.setProperty("--line", rgb(ink, 0.22));
    root.style.setProperty("--paper", rgb(paper));
    document.body.style.backgroundColor = rgb(dark ? [232, 246, 255] : [11, 13, 38]);
  };

  /* ---------- clock: 11:48 pm → 7:30 am across the page ---------- */
  const clock = document.getElementById("clock");
  const clockBar = document.getElementById("clockBar");
  const setClock = (p) => {
    const mins = Math.round(23 * 60 + 48 + p * 462) % 1440;
    const h = Math.floor(mins / 60), m = mins % 60;
    clock.textContent = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
    clockBar.style.setProperty("--p", p.toFixed(3));
  };

  let drawQueued = false;
  function requestDraw() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame((t) => { drawQueued = false; frame(t); });
  }
  // The header borrows the top of the sky so text never scrolls under bare words.
  const barEl = document.getElementById("bar");
  let barColor = "";
  const frame = (t) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    const sky = draw(t);
    updateInk(sky);
    setClock(progress);
    const c = scrollY > 40 ? rgb(sky.top, 0.92) : "transparent";
    if (c !== barColor) { barColor = c; barEl.style.backgroundColor = c; }
  };
  // Continuous animation unless calm mode is on; calm mode redraws only on scroll.
  let looping = false;
  function loop() {
    if (looping || isCalm()) return;
    looping = true;
    requestAnimationFrame(function tick(n) {
      if (isCalm() || document.hidden) { looping = false; return; }
      frame(n);
      requestAnimationFrame(tick);
    });
  }
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", () => { if (isCalm()) requestDraw(); }, { passive: true });
  document.addEventListener("visibilitychange", loop);
  window.addEventListener("pointermove", (e) => { pointer.x = e.clientX * dpr; pointer.y = e.clientY * dpr; }, { passive: true });
  document.addEventListener("pointerleave", () => { pointer.x = pointer.y = -1e4; });
  resize();
  skyReady = true;
  loop();

  /* ---------- header ---------- */
  const bar = document.getElementById("bar");
  const menuBtn = document.getElementById("menuBtn");
  const menu = document.getElementById("menu");
  const setMenu = (open) => { menu.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", String(open)); };
  menuBtn.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  let lastY = scrollY;
  window.addEventListener("scroll", () => {
    const y = scrollY;
    bar.classList.toggle("tucked", y > lastY && y > 240 && !menu.classList.contains("open"));
    lastY = y;
  }, { passive: true });

  /* ---------- whispered affirmations ---------- */
  const whisper = document.getElementById("whisper");
  const words = [
    "You deserve nourishment and rest.",
    "Your worth was never measured in numbers.",
    "Small steps still move you forward.",
    "It's okay to ask for help today.",
    "A hard day is not a failed recovery.",
    "You are allowed to take up space.",
  ];
  let wi = 0;
  setInterval(() => {
    whisper.classList.add("swap");
    setTimeout(() => { wi = (wi + 1) % words.length; whisper.textContent = words[wi]; whisper.classList.remove("swap"); }, 400);
  }, 4200);

  /* ---------- reveal on scroll, staggered within each group ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.setProperty("--d", `${i * 70}ms`);
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------- breathing sun ---------- */
  const stage = document.getElementById("sunStage");
  const cue = document.getElementById("sunCue");
  const steps = [["Breathe in…", "up", 4000], ["Hold…", "up", 4000], ["Breathe out…", "down", 6000]];
  let breathing = false, timer;
  const step = (i) => {
    const [label, dir, ms] = steps[i];
    cue.textContent = label;
    stage.classList.toggle("up", dir === "up");
    stage.classList.toggle("down", dir === "down");
    timer = setTimeout(() => step((i + 1) % steps.length), ms);
  };
  stage.addEventListener("click", () => {
    breathing = !breathing;
    clearTimeout(timer);
    if (breathing) step(0);
    else { stage.classList.remove("up", "down"); cue.textContent = "Tap the sun to begin"; }
  });

  /* ---------- 5-4-3-2-1 constellation ---------- */
  const starsEls = [...document.querySelectorAll(".star")];
  const constLine = document.getElementById("constLine");
  const pts = constLine.getAttribute("points").split(" ").map((s) => s.split(",").map(Number));
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  const groundDone = document.getElementById("groundDone");
  starsEls.forEach((s) => s.addEventListener("click", () => {
    s.classList.toggle("lit");
    const lit = starsEls.filter((x) => x.classList.contains("lit")).length;
    const drawn = seg.slice(0, Math.max(0, lit - 1)).reduce((a, b) => a + b, 0) / total;
    constLine.style.strokeDashoffset = String(1 - drawn);
    groundDone.classList.toggle("show", lit === starsEls.length);
  }));

  /* ---------- myths ---------- */
  document.querySelectorAll(".myth button").forEach((b) => b.addEventListener("click", () => {
    const li = b.closest(".myth");
    const on = li.classList.toggle("struck");
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

  /* ---------- notes floating in the sky ---------- */
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
    n.style.left = `${x}%`; n.style.top = `${y}%`;
    n.style.setProperty("--dur", `${rand(7, 12).toFixed(1)}s`);
    n.style.setProperty("--dx", `${rand(-14, 14).toFixed(0)}px`);
    n.style.setProperty("--dy", `${rand(-12, 12).toFixed(0)}px`);
    board.appendChild(n);
    // keep the note fully inside the board, whatever the screen width
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
  seed.forEach((t, i) => place(t,
    3 + (i % cols) * (96 / cols) + rand(0, 4),
    5 + Math.floor(i / cols) * (90 / rows) + rand(0, 6)));
  saved.forEach((r) => place(r.text, r.x, r.y, r));
  document.getElementById("noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("noteInput");
    const text = input.value.trim();
    if (!text) return;
    const r = { text, x: rand(5, 60), y: rand(10, 65) };
    saved.push(r); persist(); place(r.text, r.x, r.y, r);
    input.value = "";
  });
})();
