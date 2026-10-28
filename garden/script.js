// Living Garden — a vine grows with scroll, flowers bloom and sway, myths get pulled like weeds.
(() => {
  const { quickExit, calm, esc } = window.BLOOM_COMMON;
  const NS = "http://www.w3.org/2000/svg";
  quickExit(document.getElementById("quickExit"));
  const isCalm = calm(document.getElementById("calmBtn"));
  const rand = (a, b) => a + Math.random() * (b - a);
  const PETALS = ["#ff7a5c", "#ffd447", "#c9a8ff", "#ffb3c7", "#fff1dc", "#ff9ec0"];

  // One authored flower: petals around a centre, drawn at (0,0).
  const flowerSVG = (r, n, color, center = "#ffd447") => {
    let s = "";
    for (let i = 0; i < n; i++) {
      const a = (360 / n) * i;
      s += `<ellipse cx="0" cy="${-r * 0.55}" rx="${r * 0.36}" ry="${r * 0.6}" fill="${color}" transform="rotate(${a})"/>`;
    }
    return s + `<circle r="${r * 0.32}" fill="${center}"/><circle r="${r * 0.14}" fill="rgba(43,13,6,.35)"/>`;
  };

  /* ---------- hero bouquet that sways toward the cursor ---------- */
  const bouquet = document.getElementById("bouquet");
  const stems = [
    { x: 300, top: 120, bend: -40, r: 58, n: 8, c: 0 },
    { x: 300, top: 210, bend: -150, r: 46, n: 6, c: 2 },
    { x: 300, top: 190, bend: 130, r: 50, n: 7, c: 1 },
    { x: 300, top: 300, bend: -230, r: 38, n: 5, c: 3 },
    { x: 300, top: 290, bend: 220, r: 42, n: 9, c: 4 },
    { x: 300, top: 70, bend: 60, r: 34, n: 6, c: 5 },
    { x: 300, top: 360, bend: 40, r: 30, n: 5, c: 1 },
  ];
  const swayGroups = [];
  stems.forEach((s, i) => {
    const hx = s.x + s.bend, hy = s.top;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "sway");
    g.style.transformOrigin = "300px 560px";
    g.style.setProperty("--d", `${i * 0.12}s`);
    const midX = s.x + s.bend * 0.15, midY = (560 + hy) / 2;
    g.innerHTML = `
      <path class="stem" pathLength="1" d="M300 560 Q ${midX} ${midY} ${hx} ${hy + s.r * 0.3}"/>
      <g transform="translate(${(300 + hx) / 2} ${midY + 40}) scale(${i % 2 ? -1 : 1} 1)"><path class="bleaf" d="M0 0 c 30 -10 50 -40 46 -70 c -30 4 -46 30 -46 70z"/></g>
      <g transform="translate(${hx} ${hy})"><g class="head">${flowerSVG(s.r, s.n, PETALS[s.c])}</g></g>`;
    bouquet.appendChild(g);
    swayGroups.push({ el: g, k: 0.6 + (i % 3) * 0.25, angle: 0, vel: 0, phase: rand(0, 6) });
  });
  // spring toward a target angle driven by the pointer — decorative, so it may lag naturally
  let target = 0;
  window.addEventListener("pointermove", (e) => { target = (e.clientX / innerWidth - 0.5) * 10; }, { passive: true });
  const swayTick = (t) => {
    if (!isCalm() && !document.hidden) {
      for (const s of swayGroups) {
        const goal = target * s.k + Math.sin(t / 1400 + s.phase) * 1.6;
        s.vel = (s.vel + (goal - s.angle) * 0.02) * 0.9;
        s.angle += s.vel;
        s.el.style.transform = `rotate(${s.angle.toFixed(2)}deg)`;
      }
    }
    requestAnimationFrame(swayTick);
  };
  requestAnimationFrame(swayTick);

  /* ---------- vine that grows down the page as you scroll ---------- */
  const vine = document.getElementById("vine");
  const vinePath = document.getElementById("vinePath");
  const vineLeaves = document.getElementById("vineLeaves");
  let vineLen = 0, leafMarks = [];
  const buildVine = () => {
    if (getComputedStyle(vine).display === "none") return;
    const H = document.documentElement.scrollHeight, W = document.documentElement.clientWidth;
    vine.setAttribute("height", H);
    vine.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const x0 = W * 0.9, amp = Math.min(70, W * 0.05), start = innerHeight * 0.9, step = 260;
    let d = `M ${x0} ${start}`;
    for (let y = start, i = 0; y < H - 200; y += step, i++) {
      const dir = i % 2 ? -1 : 1;
      d += ` C ${x0 + amp * dir} ${y + step * 0.33}, ${x0 + amp * dir} ${y + step * 0.66}, ${x0} ${y + step}`;
    }
    vinePath.setAttribute("d", d);
    vineLen = vinePath.getTotalLength();
    vinePath.style.strokeDasharray = vineLen;
    vineLeaves.innerHTML = "";
    leafMarks = [];
    for (let l = 120, i = 0; l < vineLen; l += 110, i++) {
      const p = vinePath.getPointAtLength(l), q = vinePath.getPointAtLength(Math.min(vineLen, l + 2));
      const ang = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI + (i % 2 ? 60 : -60);
      const el = document.createElementNS(NS, "g");
      if (i % 5 === 4) {
        el.setAttribute("transform", `translate(${p.x} ${p.y})`);
        el.innerHTML = `<g class="vflower">${flowerSVG(22, 6, PETALS[i % PETALS.length])}</g>`;
      } else {
        el.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${ang})`);
        el.innerHTML = `<path class="vleaf" d="M0 0 c 12 -12 32 -12 40 0 c -8 12 -28 12 -40 0z"/>`;
      }
      vineLeaves.appendChild(el);
      leafMarks.push({ at: l, el: el.firstElementChild });
    }
    growVine();
  };
  const growVine = () => {
    if (!vineLen) return;
    // the tip sits a little below the bottom of the screen, so you watch it grow
    const H = document.documentElement.scrollHeight;
    const tipY = scrollY + innerHeight * 0.85;
    const frac = Math.min(1, Math.max(0, (tipY - innerHeight * 0.9) / (H - innerHeight * 0.9 - 200)));
    const drawn = vineLen * frac;
    vinePath.style.strokeDashoffset = vineLen - drawn;
    for (const m of leafMarks) m.el.classList.toggle("grown", m.at < drawn);
  };
  window.addEventListener("scroll", growVine, { passive: true });
  let rT;
  window.addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(buildVine, 200); });
  window.addEventListener("load", buildVine);
  document.fonts && document.fonts.ready.then(buildVine);

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

  /* ---------- reveals ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.setProperty("--d", `${i * 70}ms`);
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------- breathing flower ---------- */
  const budSvg = document.getElementById("budSvg");
  const bud = document.getElementById("bud");
  const cue = document.getElementById("budCue");
  let petals = "";
  for (let i = 0; i < 10; i++) {
    petals += `<g class="petal" style="--a:${i * 36}deg"><ellipse cx="0" cy="-48" rx="22" ry="46" fill="${i % 2 ? "#ffb3c7" : "#ff7a5c"}"/></g>`;
  }
  budSvg.innerHTML = petals + `<circle class="core" r="20" fill="#ffd447"/>`;
  const steps = [["Breathe in…", "open", 4000], ["Hold…", "open", 4000], ["Breathe out…", "closing", 6000]];
  let breathing = false, timer;
  const step = (i) => {
    const [label, state, ms] = steps[i];
    cue.textContent = label;
    bud.classList.toggle("open", state === "open");
    bud.classList.toggle("closing", state === "closing");
    timer = setTimeout(() => step((i + 1) % steps.length), ms);
  };
  bud.addEventListener("click", () => {
    breathing = !breathing;
    clearTimeout(timer);
    if (breathing) step(0);
    else { bud.classList.remove("open", "closing"); cue.textContent = "Tap the flower to begin"; }
  });

  /* ---------- seeds ---------- */
  const seeds = [...document.querySelectorAll(".seed")];
  const seedsDone = document.getElementById("seedsDone");
  seeds.forEach((s) => s.addEventListener("click", () => {
    s.classList.toggle("grown");
    seedsDone.classList.toggle("show", seeds.every((x) => x.classList.contains("grown")));
  }));

  /* ---------- weeds ---------- */
  document.querySelectorAll(".weed").forEach((w) => {
    const btn = w.querySelector("button");
    const bloom = w.querySelector(".bloom-text");
    bloom.tabIndex = -1;
    btn.addEventListener("click", () => {
      w.classList.add("pulled"); btn.setAttribute("aria-expanded", "true");
      bloom.tabIndex = 0; bloom.setAttribute("role", "button"); bloom.focus({ preventScroll: true });
    });
    const replant = () => { w.classList.remove("pulled"); btn.setAttribute("aria-expanded", "false"); bloom.tabIndex = -1; };
    bloom.addEventListener("click", replant);
    bloom.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); replant(); btn.focus(); } });
  });

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

  /* ---------- planted notes ---------- */
  const bed = document.getElementById("bed");
  const seedNotes = [
    "You made it through every hard day so far.",
    "Rest is productive.",
    "Food is fuel, comfort and connection.",
    "Progress, not perfection.",
    "Future me is proud of me.",
  ];
  let saved = [];
  try { saved = JSON.parse(localStorage.getItem("bloom-notes") || "[]"); } catch (e) { saved = []; }
  const persist = () => { try { localStorage.setItem("bloom-notes", JSON.stringify(saved)); } catch (e) {} };
  const plants = [];
  const layout = () => plants.forEach((p, i) => {
    const n = plants.length, at = (i + 0.5) / n;
    p.style.left = `${at * 100}%`;
    p.classList.toggle("edge-l", at < 0.3);
    p.classList.toggle("edge-r", at > 0.7);
    p.style.zIndex = String(n - Math.abs(i - n / 2));
  });
  const plant = (text, delay = 0) => {
    const el = document.createElement("div");
    el.className = "plant";
    const h = rand(90, 150), r = rand(18, 26), c = PETALS[Math.floor(rand(0, PETALS.length))];
    el.style.setProperty("--d", `${delay}s`);
    el.style.setProperty("--sw", `${rand(4, 7).toFixed(1)}s`);
    el.innerHTML = `<span class="bubble" role="status"></span>
      <button aria-label="Read note"><svg viewBox="0 0 72 170" aria-hidden="true"><g class="sway">
        <path class="pstem" pathLength="1" d="M36 170 Q ${36 + rand(-12, 12)} ${170 - h / 2} 36 ${170 - h}"/>
        <g transform="translate(36 ${170 - h})"><g class="phead">${flowerSVG(r, Math.round(rand(5, 9)), c)}</g></g>
      </g></svg></button>`;
    el.querySelector(".bubble").textContent = text;
    el.querySelector("button").addEventListener("click", () => {
      const open = !el.classList.contains("show");
      plants.forEach((p) => p.classList.remove("show"));
      el.classList.toggle("show", open);
    });
    bed.appendChild(el);
    plants.push(el);
    layout();
    return el;
  };
  seedNotes.concat(saved.map((s) => s.text)).forEach((t, i) => plant(t, i * 0.15));
  document.addEventListener("click", (e) => { if (!e.target.closest(".plant")) plants.forEach((p) => p.classList.remove("show")); });
  document.getElementById("noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("noteInput");
    const text = input.value.trim();
    if (!text) return;
    saved.push({ text }); persist();
    const p = plant(text);
    setTimeout(() => { plants.forEach((x) => x.classList.remove("show")); p.classList.add("show"); }, 1300);
    input.value = "";
    buildVine();
  });

  /* ---------- meadow ---------- */
  const meadow = document.getElementById("meadow");
  let blades = "";
  for (let x = 6; x < 1200; x += 14) {
    const h = rand(50, 120), bend = rand(-18, 18);
    blades += `<path class="blade" style="--sw:${rand(2.5, 5).toFixed(1)}s;--sd:-${rand(0, 4).toFixed(1)}s" d="M${x} 140 Q ${x + bend / 2} ${140 - h / 2} ${x + bend} ${140 - h}"/>`;
    if (Math.random() < 0.12) blades += `<g transform="translate(${x + bend} ${140 - h})">${flowerSVG(rand(7, 11), 5, PETALS[Math.floor(rand(0, PETALS.length))])}</g>`;
  }
  meadow.innerHTML = blades;
})();
