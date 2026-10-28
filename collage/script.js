// Paper Collage — scraps slap onto the page, hero words drag like magnets, cards get tossed.
(() => {
  const { quickExit, calm, esc } = window.BLOOM_COMMON;
  quickExit(document.getElementById("quickExit"));
  const isCalm = calm(document.getElementById("calmBtn"));
  const rand = (a, b) => a + Math.random() * (b - a);

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

  /* ---------- slap scraps down as they scroll in ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.setProperty("--d", `${i * 80}ms`);
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".place").forEach((el) => io.observe(el));

  /* ---------- hero: parallax depth + draggable word strips ---------- */
  const layers = [...document.querySelectorAll("#hero [data-depth]")].map((el) => ({
    el, depth: parseFloat(el.dataset.depth), px: 0, py: 0, dx: 0, dy: 0,
  }));
  let mx = 0, my = 0;
  window.addEventListener("pointermove", (e) => {
    mx = (e.clientX / innerWidth - 0.5) * 2;
    my = (e.clientY / innerHeight - 0.5) * 2;
  }, { passive: true });
  const tick = () => {
    if (!isCalm() && !document.hidden) {
      for (const l of layers) {
        // ease toward the pointer so the depth feels weighty, not glued to the mouse
        l.px += (mx * 14 * l.depth - l.px) * 0.08;
        l.py += (my * 10 * l.depth - l.py) * 0.08;
        l.el.style.translate = `${(l.px + l.dx).toFixed(1)}px ${(l.py + l.dy).toFixed(1)}px`;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  layers.filter((l) => l.el.classList.contains("word")).forEach((l) => {
    let sx, sy, ox, oy, dragging = false;
    l.el.addEventListener("pointerdown", (e) => {
      if (dragging) return;
      dragging = true; l.el.setPointerCapture(e.pointerId); l.el.classList.add("dragging");
      sx = e.clientX; sy = e.clientY; ox = l.dx; oy = l.dy;
    });
    l.el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      l.dx = ox + e.clientX - sx; l.dy = oy + e.clientY - sy;
      if (isCalm()) l.el.style.translate = `${l.dx}px ${l.dy}px`;
    });
    const end = () => { dragging = false; l.el.classList.remove("dragging"); };
    l.el.addEventListener("pointerup", end);
    l.el.addEventListener("pointercancel", end);
  });

  /* ---------- breathing sticker ---------- */
  const breath = document.getElementById("breath");
  const cue = document.getElementById("breathCue");
  const steps = [["breathe in", "in", 4000], ["hold", "in", 4000], ["breathe out", "out", 6000]];
  let on = false, timer;
  const step = (i) => {
    const [label, state, ms] = steps[i];
    cue.textContent = label;
    breath.classList.toggle("in", state === "in");
    breath.classList.toggle("out", state === "out");
    timer = setTimeout(() => step((i + 1) % steps.length), ms);
  };
  breath.addEventListener("click", () => {
    on = !on; clearTimeout(timer);
    if (on) step(0);
    else { breath.classList.remove("in", "out"); cue.textContent = "tap me"; }
  });

  /* ---------- 5-4-3-2-1 deck: toss the top card ---------- */
  const cards = [...document.querySelectorAll(".card")];
  const topCard = () => cards.filter((c) => !c.classList.contains("tossed")).pop();
  const arm = () => cards.forEach((c) => { c.disabled = c !== topCard(); });
  cards.forEach((c) => c.addEventListener("click", () => {
    const dir = Math.random() < 0.5 ? -1 : 1;
    c.style.setProperty("--tx", `${dir * rand(220, 320)}px`);
    c.style.setProperty("--tr", `${dir * rand(18, 34)}deg`);
    c.classList.add("tossed");
    arm();
    const next = topCard();
    (next || document.getElementById("deckReset")).focus({ preventScroll: true });
  }));
  document.getElementById("deckReset").addEventListener("click", () => {
    cards.forEach((c) => c.classList.remove("tossed"));
    arm();
    topCard().focus({ preventScroll: true });
  });
  arm();

  /* ---------- myths: slap a truth sticker on ---------- */
  document.querySelectorAll(".myth").forEach((m) => m.addEventListener("click", () => {
    const on = m.classList.toggle("slapped");
    m.setAttribute("aria-expanded", String(on));
  }));

  /* ---------- helplines ---------- */
  const icons = {
    call: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    text: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
    web: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  };
  const data = window.BLOOM_HELPLINES;
  const regions = document.getElementById("regions");
  const lines = document.getElementById("lines");
  Object.entries(data).forEach(([key, r], i) => {
    const b = document.createElement("button");
    b.className = "region"; b.role = "tab"; b.dataset.key = key; b.textContent = r.label;
    b.setAttribute("aria-selected", String(i === 0));
    regions.appendChild(b);
  });
  const tabs = [...regions.querySelectorAll(".region")];
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
    show(t.dataset.key);
  }));
  show(tabs[0].dataset.key);

  /* ---------- word magnets ---------- */
  const fridge = document.getElementById("fridge");
  const starter = ["I", "am", "you", "are", "worthy", "enough", "today", "healing", "brave", "allowed", "to", "rest", "eat", "grow", "kind", "slowly", "my", "body", "deserves", "care", "and", "still", "here", "loved", "hope", "is", "real", "one", "step", "at", "a", "time"];
  let own = [];
  try { own = JSON.parse(localStorage.getItem("bloom-magnets") || "[]"); } catch (e) { own = []; }
  const persist = () => { try { localStorage.setItem("bloom-magnets", JSON.stringify(own)); } catch (e) {} };
  const addMagnet = (word, x, y, record) => {
    const m = document.createElement("span");
    m.className = "magnet" + (record ? " own" : "");
    m.textContent = word;
    m.style.setProperty("--r", `${rand(-4, 4).toFixed(1)}deg`);
    fridge.appendChild(m);
    const maxX = Math.max(0, (1 - m.offsetWidth / fridge.clientWidth) * 100);
    const maxY = Math.max(0, (1 - m.offsetHeight / fridge.clientHeight) * 100);
    m.style.left = `${Math.min(x, maxX)}%`; m.style.top = `${Math.min(y, maxY)}%`;
    let sx, sy, ox, oy, dragging = false;
    m.addEventListener("pointerdown", (e) => {
      if (dragging) return;
      dragging = true; m.setPointerCapture(e.pointerId); m.classList.add("dragging");
      sx = e.clientX; sy = e.clientY; ox = m.offsetLeft; oy = m.offsetTop;
    });
    m.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const nx = Math.max(0, Math.min(fridge.clientWidth - m.offsetWidth, ox + e.clientX - sx));
      const ny = Math.max(0, Math.min(fridge.clientHeight - m.offsetHeight, oy + e.clientY - sy));
      m.style.left = `${(nx / fridge.clientWidth) * 100}%`;
      m.style.top = `${(ny / fridge.clientHeight) * 100}%`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; m.classList.remove("dragging");
      if (record) { record.x = parseFloat(m.style.left); record.y = parseFloat(m.style.top); persist(); }
    };
    m.addEventListener("pointerup", end);
    m.addEventListener("pointercancel", end);
  };
  // scatter starters on a loose grid so none hide behind each other
  const cols = fridge.clientWidth < 560 ? 4 : 8;
  starter.forEach((w, i) => addMagnet(w,
    4 + (i % cols) * (92 / cols) + rand(0, 3),
    6 + Math.floor(i / cols) * (88 / Math.ceil(starter.length / cols)) + rand(0, 4)));
  own.forEach((r) => addMagnet(r.text, r.x, r.y, r));
  document.getElementById("magnetForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("magnetInput");
    const text = input.value.trim();
    if (!text) return;
    const r = { text, x: rand(10, 60), y: rand(10, 70) };
    own.push(r); persist(); addMagnet(r.text, r.x, r.y, r);
    input.value = "";
  });
})();
