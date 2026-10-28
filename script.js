// Bloom Within — interactions & animations
(() => {
  const body = document.body;
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- calm mode (respects OS setting, remembered per device) ---------- */
  const motionBtn = document.getElementById("motionBtn");
  let calm = reduceQuery.matches;
  try { const saved = localStorage.getItem("bloom-calm"); if (saved !== null) calm = saved === "1"; } catch (e) {}
  const setCalm = (on) => {
    calm = on;
    body.classList.toggle("calm", on);
    motionBtn.setAttribute("aria-pressed", String(on));
    motionBtn.textContent = on ? "Calm mode on" : "Calm mode";
    try { localStorage.setItem("bloom-calm", on ? "1" : "0"); } catch (e) {}
  };
  setCalm(calm);
  motionBtn.addEventListener("click", () => setCalm(!calm));

  /* ---------- quick exit: Esc twice ---------- */
  let lastEsc = 0;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const now = Date.now();
    if (now - lastEsc < 600) window.location.replace(document.getElementById("quickExit").href);
    lastEsc = now;
  });
  document.getElementById("quickExit").addEventListener("click", (e) => {
    e.preventDefault();
    window.location.replace(e.currentTarget.href);
  });

  /* ---------- mobile nav + hide on scroll ---------- */
  const nav = document.getElementById("nav");
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }));
  let lastY = 0;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    nav.classList.toggle("hide", y > lastY && y > 300 && !navLinks.classList.contains("open"));
    lastY = y;
  }, { passive: true });

  /* ---------- animated particle / constellation background ---------- */
  const canvas = document.getElementById("bg");
  const ctx = canvas.getContext("2d");
  const colors = ["#b79cff", "#ffb4a2", "#8ef0c9", "#8ec5ff"];
  let W, H, particles = [];
  const mouse = { x: -9999, y: -9999 };
  const resize = () => {
    W = canvas.width = window.innerWidth * devicePixelRatio;
    H = canvas.height = window.innerHeight * devicePixelRatio;
    const count = Math.min(90, Math.floor(window.innerWidth / 14));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - .5) * .4 * devicePixelRatio, vy: (Math.random() - .5) * .4 * devicePixelRatio,
      r: (Math.random() * 2 + 1) * devicePixelRatio, c: colors[Math.floor(Math.random() * colors.length)],
    }));
  };
  resize();
  window.addEventListener("resize", resize);
  const link = 130 * devicePixelRatio;
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    for (const p of particles) {
      if (!calm) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 160 * devicePixelRatio) { p.x += dx / d * 1.6; p.y += dy / d * 1.6; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c; ctx.globalAlpha = .8; ctx.fill();
    }
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i], b = particles[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < link) {
          ctx.globalAlpha = (1 - d / link) * .25;
          ctx.strokeStyle = a.c; ctx.lineWidth = devicePixelRatio;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  };
  draw();

  /* ---------- cursor glow (smoothed) ---------- */
  const glow = document.querySelector(".cursor-glow");
  let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy;
  window.addEventListener("pointermove", (e) => {
    tx = e.clientX; ty = e.clientY;
    mouse.x = e.clientX * devicePixelRatio; mouse.y = e.clientY * devicePixelRatio;
  });
  const glowLoop = () => {
    gx += (tx - gx) * .12; gy += (ty - gy) * .12;
    glow.style.transform = `translate(${gx - 210}px, ${gy - 210}px)`;
    requestAnimationFrame(glowLoop);
  };
  glowLoop();

  /* ---------- hero: split letters ---------- */
  let delay = 0;
  document.querySelectorAll(".split").forEach((el) => {
    const text = el.textContent;
    el.textContent = "";
    for (const ch of text) {
      const s = document.createElement("span");
      s.className = "char";
      s.setAttribute("aria-hidden", "true");
      s.textContent = ch === " " ? " " : ch;
      s.style.animationDelay = `${delay}ms`;
      delay += 45;
      el.appendChild(s);
    }
  });

  /* ---------- hero: rotating affirmations ---------- */
  const affirmations = [
    "you deserve nourishment and rest.",
    "your worth was never measured in numbers.",
    "small steps still move you forward.",
    "it's okay to ask for help — today.",
    "your body is not the problem.",
    "a hard day is not a failed recovery.",
    "you are allowed to take up space.",
  ];
  const rot = document.getElementById("rotator");
  let ai = 0;
  setInterval(() => {
    rot.classList.add("out");
    setTimeout(() => {
      ai = (ai + 1) % affirmations.length;
      rot.textContent = affirmations[ai];
      rot.classList.remove("out");
    }, 500);
  }, 3800);

  /* ---------- scroll reveal ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en, i) => {
      if (en.isIntersecting) {
        setTimeout(() => en.target.classList.add("in"), (i % 6) * 90);
        io.unobserve(en.target);
      }
    });
  }, { threshold: .15 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------- parallax blobs ---------- */
  const blobs = document.querySelectorAll(".blob");
  window.addEventListener("scroll", () => {
    if (calm) return;
    const y = window.scrollY;
    blobs.forEach((b, i) => { b.style.translate = `0 ${y * (0.15 + i * 0.1)}px`; });
  }, { passive: true });

  /* ---------- magnetic buttons ---------- */
  document.querySelectorAll(".magnetic").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      if (calm) return;
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${x * .25}px, ${y * .35}px)`;
      btn.firstElementChild.style.transform = `translate(${x * .12}px, ${y * .15}px)`;
    });
    btn.addEventListener("pointerleave", () => {
      btn.style.transform = ""; btn.firstElementChild.style.transform = "";
    });
  });

  /* ---------- 3D tilt cards ---------- */
  document.querySelectorAll("[data-tilt]").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", `${px * 100}%`);
      card.style.setProperty("--my", `${py * 100}%`);
      if (!calm) card.style.transform = `rotateX(${(.5 - py) * 14}deg) rotateY(${(px - .5) * 14}deg) translateZ(10px)`;
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });

  /* ---------- flip cards ---------- */
  document.querySelectorAll(".flip").forEach((f) => f.addEventListener("click", () => f.classList.toggle("flipped")));

  /* ---------- breathing ---------- */
  const orb = document.getElementById("breathe-orb");
  const bText = document.getElementById("breatheText");
  const bBtn = document.getElementById("breatheBtn");
  orb.classList.add("breathe-idle");
  let breathing = false, bTimer;
  const steps = [
    { label: "Breathe in…", cls: "expand", ms: 4000 },
    { label: "Hold…", cls: "expand", ms: 4000 },
    { label: "Breathe out…", cls: "exhale", ms: 6000 },
  ];
  const runStep = (i) => {
    const s = steps[i];
    bText.textContent = s.label;
    orb.classList.toggle("expand", s.cls === "expand");
    orb.classList.toggle("exhale", s.cls === "exhale");
    bTimer = setTimeout(() => runStep((i + 1) % steps.length), s.ms);
  };
  const toggleBreath = () => {
    breathing = !breathing;
    clearTimeout(bTimer);
    if (breathing) {
      orb.classList.remove("breathe-idle");
      bBtn.textContent = "Stop";
      runStep(0);
    } else {
      orb.classList.remove("expand", "exhale");
      orb.classList.add("breathe-idle");
      bText.textContent = "Tap to begin";
      bBtn.textContent = "Start breathing";
    }
  };
  bBtn.addEventListener("click", toggleBreath);
  orb.addEventListener("click", toggleBreath);

  /* ---------- grounding ---------- */
  const groundCards = document.querySelectorAll(".ground-card");
  const groundDone = document.getElementById("groundDone");
  groundCards.forEach((c) => c.addEventListener("click", () => {
    c.classList.toggle("done");
    groundDone.classList.toggle("show", [...groundCards].every((x) => x.classList.contains("done")));
  }));

  /* ---------- helplines ---------- */
  const helplines = {
    us: [
      { tag: "Eating disorders", name: "ANAD Helpline", desc: "Free peer support for anyone affected by an eating disorder, Mon–Fri.", contact: "888-375-7767", href: "tel:+18883757767", site: "anad.org" },
      { tag: "24/7 crisis", name: "988 Lifeline", desc: "Call or text any time if you're in crisis or thinking about harming yourself.", contact: "Call or text 988", href: "tel:988", site: "988lifeline.org" },
      { tag: "Text support", name: "Crisis Text Line", desc: "Free, confidential support by text, 24/7.", contact: "Text HOME to 741741", href: "sms:741741?body=HOME", site: "crisistextline.org" },
      { tag: "Information", name: "NEDA", desc: "Screening tool, treatment finder and education resources.", contact: "Visit website", href: "https://www.nationaleatingdisorders.org", site: "nationaleatingdisorders.org" },
    ],
    uk: [
      { tag: "Eating disorders", name: "Beat Adult Helpline", desc: "UK's eating disorder charity — helpline, web chat and support groups.", contact: "0808 801 0677", href: "tel:08088010677", site: "beateatingdisorders.org.uk" },
      { tag: "24/7 listening", name: "Samaritans", desc: "Talk to someone any time, about anything.", contact: "116 123", href: "tel:116123", site: "samaritans.org" },
      { tag: "Text support", name: "Shout", desc: "Free, confidential text support, 24/7.", contact: "Text SHOUT to 85258", href: "sms:85258?body=SHOUT", site: "giveusashout.org" },
    ],
    ca: [
      { tag: "Eating disorders", name: "NEDIC", desc: "Canada's national eating disorder helpline and live chat.", contact: "1-866-633-4220", href: "tel:+18666334220", site: "nedic.ca" },
      { tag: "24/7 crisis", name: "9-8-8 Canada", desc: "Suicide crisis helpline — call or text any time.", contact: "Call or text 988", href: "tel:988", site: "988.ca" },
      { tag: "Youth", name: "Kids Help Phone", desc: "24/7 support for young people by phone or text.", contact: "1-800-668-6868", href: "tel:+18006686868", site: "kidshelpphone.ca" },
    ],
    au: [
      { tag: "Eating disorders", name: "Butterfly Foundation", desc: "National helpline for eating disorders and body image concerns.", contact: "1800 33 4673", href: "tel:1800334673", site: "butterfly.org.au" },
      { tag: "24/7 crisis", name: "Lifeline", desc: "Crisis support and suicide prevention, any time.", contact: "13 11 14", href: "tel:131114", site: "lifeline.org.au" },
      { tag: "Youth", name: "Kids Helpline", desc: "Free counselling for ages 5–25, 24/7.", contact: "1800 55 1800", href: "tel:1800551800", site: "kidshelpline.com.au" },
    ],
    intl: [
      { tag: "Directory", name: "Find a Helpline", desc: "Free, verified helplines in over 130 countries.", contact: "Search by country", href: "https://findahelpline.com", site: "findahelpline.com" },
      { tag: "Families", name: "F.E.A.S.T.", desc: "Global support and education for parents and carers.", contact: "Visit website", href: "https://www.feast-ed.org", site: "feast-ed.org" },
      { tag: "Recovery", name: "Project HEAL", desc: "Helps people access eating disorder treatment and recovery support.", contact: "Visit website", href: "https://www.theprojectheal.org", site: "theprojectheal.org" },
    ],
  };
  const panels = document.getElementById("helpPanels");
  const tabs = document.querySelectorAll(".tab");
  const pill = document.getElementById("tabPill");
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const renderRegion = (key) => {
    panels.innerHTML = helplines[key].map((h, i) => {
      const ext = h.href.startsWith("http") ? ' target="_blank" rel="noopener"' : "";
      return `<article class="help-card" style="--i:${i}">
        <span class="badge">${esc(h.tag)}</span>
        <h3>${esc(h.name)}</h3>
        <p>${esc(h.desc)}</p>
        <a class="contact" href="${esc(h.href)}"${ext}>${esc(h.contact)}</a>
        <a class="site" href="https://${esc(h.site)}" target="_blank" rel="noopener">${esc(h.site)} ↗</a>
      </article>`;
    }).join("");
  };
  const movePill = (tab) => {
    pill.style.left = `${tab.offsetLeft}px`;
    pill.style.width = `${tab.offsetWidth}px`;
  };
  tabs.forEach((t) => t.addEventListener("click", () => {
    tabs.forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-selected", "false"); });
    t.classList.add("active"); t.setAttribute("aria-selected", "true");
    movePill(t); renderRegion(t.dataset.region);
  }));
  renderRegion("us");
  requestAnimationFrame(() => movePill(document.querySelector(".tab.active")));
  window.addEventListener("resize", () => movePill(document.querySelector(".tab.active")));
  document.fonts && document.fonts.ready.then(() => movePill(document.querySelector(".tab.active")));

  /* ---------- draggable note board ---------- */
  const board = document.getElementById("noteBoard");
  const noteColors = ["#ffb4a2", "#b79cff", "#8ef0c9", "#8ec5ff", "#ffe29a"];
  const defaults = [
    "You made it through 100% of your hardest days.",
    "Rest is productive.",
    "Food is fuel, comfort and connection.",
    "Progress, not perfection.",
    "Future me is proud of me.",
  ];
  let notes = [];
  try { notes = JSON.parse(localStorage.getItem("bloom-notes") || "[]"); } catch (e) { notes = []; }
  const saveNotes = () => { try { localStorage.setItem("bloom-notes", JSON.stringify(notes)); } catch (e) {} };

  const addNote = (text, x, y, color, rot, i = 0) => {
    const el = document.createElement("div");
    el.className = "note";
    el.textContent = text;
    el.style.background = color;
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    el.style.transform = `rotate(${rot}deg)`;
    el.style.animationDelay = `${i * 120}ms`;
    board.appendChild(el);
    makeDraggable(el);
    return el;
  };
  const makeDraggable = (el) => {
    let sx, sy, ox, oy;
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      el.classList.add("dragging");
      sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop;
    });
    el.addEventListener("pointermove", (e) => {
      if (!el.classList.contains("dragging")) return;
      const maxX = board.clientWidth - el.offsetWidth, maxY = board.clientHeight - el.offsetHeight;
      const nx = Math.max(0, Math.min(maxX, ox + e.clientX - sx));
      const ny = Math.max(0, Math.min(maxY, oy + e.clientY - sy));
      el.style.left = `${nx / board.clientWidth * 100}%`;
      el.style.top = `${ny / board.clientHeight * 100}%`;
    });
    el.addEventListener("pointerup", () => {
      el.classList.remove("dragging");
      const idx = [...board.children].indexOf(el) - defaults.length;
      if (idx >= 0 && notes[idx]) {
        notes[idx].x = parseFloat(el.style.left); notes[idx].y = parseFloat(el.style.top);
        saveNotes();
      }
    });
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  defaults.forEach((t, i) => addNote(t, 4 + (i % 3) * 30 + rand(0, 6), 6 + Math.floor(i / 3) * 44 + rand(0, 8), noteColors[i % noteColors.length], rand(-7, 7), i));
  notes.forEach((n, i) => addNote(n.text, n.x, n.y, n.color, n.rot, i));

  document.getElementById("noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("noteInput");
    const text = input.value.trim();
    if (!text) return;
    const n = { text, x: rand(5, 65), y: rand(5, 60), color: noteColors[Math.floor(Math.random() * noteColors.length)], rot: rand(-8, 8) };
    notes.push(n); saveNotes();
    addNote(n.text, n.x, n.y, n.color, n.rot);
    input.value = "";
  });
})();
