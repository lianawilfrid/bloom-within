// Night to Dawn — real sky photographs, preloaded, then choreographed with GSAP + ScrollTrigger.
(() => {
  const { quickExit, calm, esc } = window.BLOOM_COMMON;
  const S = window.BLOOM_SOUND;
  const root = document.documentElement;
  quickExit(document.getElementById("quickExit"));
  let ready = false;
  const isCalm = calm(document.getElementById("calmBtn"), () => { if (ready) build(); });

  /* ---------- photographs (Unsplash, served at the size each screen needs) ---------- */
  const photoURL = (id, w) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=82&w=${w}`;
  // your own photos (data-local) load as they are; Unsplash photos get a size for every screen
  document.querySelectorAll("img[data-local]").forEach((img) => { img.decoding = "async"; img.src = img.dataset.local; });
  const imgs = [...document.querySelectorAll("img[data-photo], img[data-local]")];
  // Any photo shown full-screen somewhere uses the full-screen sizes everywhere,
  // so the browser downloads it once and every copy comes from cache.
  const fullscreen = new Set(
    imgs.filter((i) => i.closest(".sky, .hero-shot, .band")).map((i) => i.dataset.photo)
  );
  imgs.forEach((img) => {
    const id = img.dataset.photo;
    if (!id) return;
    const fixed = Number(img.dataset.w);
    let widths, sizes;
    if (fullscreen.has(id)) { widths = [1280, 1920, 2560, 3200, 3840]; sizes = "110vw"; }
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
  if (hasGSAP) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true }); // the phone's address bar sliding away shouldn't jolt the page
  }
  const touch = window.matchMedia("(pointer: coarse)").matches;
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
          onUpdate: (self) => root.classList.toggle("day", self.progress > 0.7), // dark text only once the pink sunrise gives way to morning
        },
      });
      layers.slice(1).forEach((layer, i) => {
        sky.to(layer, { opacity: 1, duration: 1 }, i);
        if (!still) sky.fromTo(layer, { scale: 1.04 }, { scale: 1, duration: 2 }, i);
      });
      // mist gathers in the blue hour, glows at sunrise, and burns off by morning
      sky.fromTo("#mist", { opacity: 0 }, { opacity: 0.28, duration: 1.2 }, 0.5)
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
          // On phones a finger flick should carry you through in one go: a shorter pin that snaps to its end.
          scrollTrigger: {
            trigger: intro, start: "top top", end: touch ? "+=90%" : "+=170%", pin: true, scrub: touch ? 0.35 : 1, invalidateOnRefresh: true, anticipatePin: 1,
            snap: touch ? { snapTo: [0, 1], duration: { min: 0.25, max: 0.6 }, delay: 0.05, ease: "power2.inOut" } : false,
          },
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
  // the header stays put; it only turns solid once there's page behind it
  window.addEventListener("scroll", () => barEl.classList.toggle("solid", scrollY > 40), { passive: true });

  /* ---------- colour themes: dark (follows the sky), light, pink ---------- */
  const themes = [["dark", "Dark"], ["light", "Light"], ["pink", "Pink"]];
  const themeBtn = document.getElementById("themeBtn");
  const showTheme = () => {
    const cur = root.dataset.theme || "dark", [, label] = themes.find(([k]) => k === cur);
    themeBtn.querySelector(".tool-label").textContent = label;
    themeBtn.setAttribute("aria-label", `Colour theme: ${label}. Tap to change`);
  };
  themeBtn.addEventListener("click", () => {
    const i = themes.findIndex(([k]) => k === (root.dataset.theme || "dark"));
    const next = themes[(i + 1) % themes.length][0];
    if (next === "dark") delete root.dataset.theme; else root.dataset.theme = next;
    try { localStorage.setItem("bloom-theme", next === "dark" ? "" : next); } catch (e) {}
    showTheme();
  });
  showTheme();

  /* ---------- sound panel ---------- */
  const soundBtn = document.getElementById("soundBtn");
  const panel = document.getElementById("soundPanel");
  const sfxT = document.getElementById("sfxToggle"), musicT = document.getElementById("musicToggle"), volT = document.getElementById("volume");
  const setPanel = (open) => { panel.hidden = !open; soundBtn.setAttribute("aria-expanded", String(open)); };
  soundBtn.addEventListener("click", (e) => { e.stopPropagation(); setPanel(panel.hidden); });
  document.addEventListener("click", (e) => { if (!panel.hidden && !e.target.closest(".sound")) setPanel(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setPanel(false); });
  sfxT.addEventListener("change", () => { S.setSfx(sfxT.checked); if (sfxT.checked) S.pop(); });
  musicT.addEventListener("change", () => S.setMusic(musicT.checked));
  volT.addEventListener("input", () => S.setVolume(volT.value / 100));
  document.getElementById("muteAll").addEventListener("click", () => S.muteAll());
  S.onChange((st) => {
    sfxT.checked = st.sfx; musicT.checked = st.music; volT.value = Math.round(st.vol * 100);
    const silent = !st.sfx && !st.music;
    soundBtn.classList.toggle("muted", silent);
    soundBtn.querySelector(".tool-label").textContent = silent ? "Sound off" : "Sound";
    soundBtn.setAttribute("aria-label", silent ? "Sound is off. Open sound settings" : "Sound settings");
  });

  /* ---------- breathing sunrise: the light, a ring and drifting motes show when to breathe ---------- */
  const sunWin = document.getElementById("sunWindow");
  const breath = document.getElementById("breath");
  const cue = document.getElementById("sunCue");
  const ring = document.getElementById("ringFill");
  const guide = [...document.querySelectorAll("#breathGuide .phase")];
  const countEl = document.getElementById("breathCount");
  document.getElementById("motes").innerHTML = Array.from({ length: 14 }, (_, i) =>
    `<i style="--a:${(i * 360) / 14}deg;--d:${(i % 3) * 0.45}s"></i>`).join("");
  const steps = [["Breathe in", "in", 4000], ["Hold", "hold", 4000], ["Breathe out", "out", 6000]];
  let breathing = false, timer, ticker;
  const step = (i) => {
    const [label, state, ms] = steps[i];
    cue.textContent = label;
    breath.dataset.phase = state;
    sunWin.classList.toggle("in", state !== "out");
    sunWin.classList.toggle("out", state === "out");
    guide.forEach((g, k) => g.classList.toggle("on", k === i));
    // the ring fills as you breathe in, stays full while you hold, empties as you breathe out
    ring.style.transitionDuration = state === "hold" ? "0s" : `${ms}ms`;
    ring.style.strokeDashoffset = state === "out" ? "100" : "0";
    // one dot for every second of this breath
    const secs = ms / 1000;
    countEl.innerHTML = Array.from({ length: secs }, () => "<i></i>").join("");
    const dots = [...countEl.children];
    let n = 0;
    clearInterval(ticker);
    dots[0].classList.add("on");
    ticker = setInterval(() => { n++; if (dots[n]) dots[n].classList.add("on"); }, 1000);
    timer = setTimeout(() => step((i + 1) % steps.length), ms);
  };
  sunWin.addEventListener("click", () => {
    breathing = !breathing;
    clearTimeout(timer); clearInterval(ticker);
    breath.classList.toggle("going", breathing);
    if (breathing) step(0);
    else {
      sunWin.classList.remove("in", "out"); delete breath.dataset.phase;
      guide.forEach((g) => g.classList.remove("on")); countEl.innerHTML = "";
      ring.style.transitionDuration = "1s"; ring.style.strokeDashoffset = "100";
      cue.textContent = "Tap the sunrise to begin";
    }
  });

  /* ---------- 5-4-3-2-1 on real water: a full-resolution photo, rippled on the GPU ---------- */
  function startPond() {
    const pond = document.getElementById("pond");
    const photo = document.getElementById("pondPhoto");
    const canvas = document.getElementById("pondCanvas");
    const hit = document.getElementById("pondHit");
    const stepEl = document.getElementById("pondStep");
    const promptEl = document.getElementById("pondPrompt");
    const dotsEl = document.getElementById("pondDots");
    const reset = document.getElementById("pondReset");
    // each sense gets its own stretch of water
    const senses = [
      // [count, prompt, photo, where the water starts in that photo (0 = top, 1 = bottom)]
      [5, "Notice <b>5</b> things you can see", "1533757879476-8f4a3cb1ae4b", 0.66],
      [4, "Notice <b>4</b> things you can touch", "1742301478868-cbea63e8466a", 0],
      [3, "Notice <b>3</b> things you can hear", "1634145124254-f62127c0f5bb", 0.56],
      [2, "Notice <b>2</b> things you can smell", "1748131816092-4468f57ad80e", 0.5],
      [1, "Notice <b>1</b> kind thing you can say to yourself", "1678811871679-2335c4b71d43", 0.52],
    ];
    const photoW = Math.min(2400, Math.round(Math.max(1200, pond.clientWidth * Math.min(2, devicePixelRatio || 1))));
    const photoURL = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=85&w=${photoW}`;
    const loadPhoto = (id) => new Promise((res, rej) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => res(im); im.onerror = rej;
      im.src = photoURL(id);
    });

    // Without WebGL the sharp photo stays, ripples become CSS rings, and the water still changes.
    let drop = (fx, fy, strength = 1) => {
      const ring = document.createElement("span");
      ring.className = "ring";
      ring.style.left = `${fx * 100}%`; ring.style.top = `${fy * 100}%`;
      ring.style.setProperty("--s", strength);
      pond.appendChild(ring);
      setTimeout(() => ring.remove(), 1800);
    };
    let changeWater = (id) => { photo.srcset = ""; photo.src = photoURL(id); };
    let isRunning = () => false, waterline = () => 0;
    const gpu = setupGL();
    if (gpu) ({ drop, changeWater, isRunning, waterline } = gpu);
    else canvas.remove();

    function setupGL() {
      const gl = canvas.getContext("webgl", { antialias: false });
      if (!gl) return null;
      const vs = "attribute vec2 p; varying vec2 v; void main(){ v = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }";
      const fs = `precision mediump float;
        varying vec2 v;
        uniform sampler2D a, b, n;
        uniform vec4 ca, cb;
        uniform float mixAB, ha, hb;
        void main() {
          // ripples only exist on the water, fading in just below each photo's waterline
          float water = mix(smoothstep(ha, ha + .04, v.y * ca.y + ca.w), smoothstep(hb, hb + .04, v.y * cb.y + cb.w), mixAB);
          vec2 g = (texture2D(n, v).rg - .5) * water; // wave slope at this point
          vec2 uv = v + g * .065;                     // refraction bends the photo under the ripple
          vec3 A = texture2D(a, uv * ca.xy + ca.zw).rgb;
          vec3 B = texture2D(b, uv * cb.xy + cb.zw).rgb;
          vec3 c = mix(A, B, mixAB);
          float lit = (g.x - g.y) * .9;               // light catching the ripple crests
          c += max(lit, 0.) * .55 * vec3(1., .97, .9);
          c -= max(-lit, 0.) * .22;
          gl_FragColor = vec4(c, 1.);
        }`;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = (name) => gl.getUniformLocation(prog, name);
      const makeTex = (unit) => {
        const t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      const texA = makeTex(0), texB = makeTex(1), texN = makeTex(2);
      gl.uniform1i(U("a"), 0); gl.uniform1i(U("b"), 1); gl.uniform1i(U("n"), 2);
      const upload = (tex, unit, img) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img); };
      const cover = (img) => {
        const ca = canvas.width / canvas.height, ia = img.naturalWidth / img.naturalHeight;
        return ia > ca ? [ca / ia, 1, (1 - ca / ia) / 2, 0] : [1, ia / ca, 0, (1 - ia / ca) / 2];
      };
      let imgA = null, imgB = null, mixAB = 0, fade = null, running = false, horA = 0, horB = 0;

      // wave height map on a small grid; the GPU interpolates it smoothly across the full-size photo
      let SW = 0, SH = 0, cur, prev, nrm;
      const resize = () => {
        const r = pond.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
        canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
        // more rows than the screen's shape needs, so rings flatten into ellipses like water seen at an angle
        SW = 256; SH = Math.max(160, Math.round(SW * (r.height / r.width) * 2.4));
        cur = new Float32Array(SW * SH); prev = new Float32Array(SW * SH); nrm = new Uint8Array(SW * SH * 4).fill(128);
      };
      const step = () => {
        let energy = 0;
        for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
          const i = y * SW + x;
          let h = (prev[i - 1] + prev[i + 1] + prev[i - SW] + prev[i + SW]) / 2 - cur[i];
          h -= h / 64;                                 // slow damping: rings travel far before settling
          cur[i] = h;
          energy += h < 0 ? -h : h;
        }
        const t = prev; prev = cur; cur = t;
        for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
          const i = y * SW + x, o = i * 4;
          nrm[o] = Math.max(0, Math.min(255, 128 + (prev[i - 1] - prev[i + 1]) * 0.9));
          nrm[o + 1] = Math.max(0, Math.min(255, 128 + (prev[i - SW] - prev[i + SW]) * 0.9));
        }
        return energy;
      };
      const draw = () => {
        if (!imgA) return;
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texN);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SW, SH, 0, gl.RGBA, gl.UNSIGNED_BYTE, nrm);
        gl.uniform4fv(U("ca"), cover(imgA));
        gl.uniform4fv(U("cb"), cover(imgB || imgA));
        gl.uniform1f(U("mixAB"), mixAB);
        gl.uniform1f(U("ha"), horA); gl.uniform1f(U("hb"), horB);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
      const tick = (now) => {
        let energy = 0;
        for (let k = 0; k < 2; k++) energy = step();   // two steps a frame so the rings travel briskly
        if (fade) {
          mixAB = Math.min(1, (now - fade.from) / fade.dur);
          if (mixAB >= 1) { imgA = imgB; horA = horB; upload(texA, 0, imgA); imgB = null; mixAB = 0; fade = null; }
        }
        draw();
        if (energy > SW * SH * 0.015 || fade) requestAnimationFrame(tick);
        else { running = false; nrm.fill(128); cur.fill(0); prev.fill(0); draw(); }
      };
      const start = () => { if (!running && imgA) { running = true; requestAnimationFrame(tick); } };

      resize();
      horA = senses[0][3];
      loadPhoto(senses[0][2]).then((img) => {
        imgA = img; upload(texA, 0, img); draw();
        pond.classList.add("live");
        senses.slice(1).forEach(([, , id]) => loadPhoto(id).catch(() => {})); // warm the cache for each change
      }).catch(() => canvas.remove());
      let rt;
      window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { resize(); draw(); }, 200); });

      return {
        isRunning: () => running,
        // where the waterline sits on screen right now, so taps on the sky land on the water below it
        waterline() { const c = cover(imgA || photo); return Math.max(0, Math.min(.95, (horA - c[3]) / c[1])); },
        drop(fx, fy, strength = 1) {
          const cx = Math.round(fx * SW), cy = Math.round(fy * SH), rad = Math.max(3, Math.round(SW / 34 * Math.sqrt(strength)));
          for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
            const px = cx + x, py = cy + y, d = Math.sqrt(x * x + y * y);
            if (px < 1 || py < 1 || px >= SW - 1 || py >= SH - 1 || d > rad) continue;
            prev[py * SW + px] += 440 * strength * Math.cos((d / rad) * Math.PI / 2);
          }
          start();
        },
        changeWater(id, horizon) {
          loadPhoto(id).then((img) => {
            imgB = img; horB = horizon; upload(texB, 1, img);
            fade = { from: performance.now(), dur: 1600 };
            start();
          }).catch(() => {});
        },
      };
    }

    // --- the guided steps ---
    let stage = 0, count = 0, visible = false;
    const renderDots = () => { dotsEl.innerHTML = Array.from({ length: senses[stage][0] }, (_, i) => `<i class="${i < count ? "on" : ""}"></i>`).join(""); };
    const show = () => { stepEl.textContent = `${stage + 1} of 5`; promptEl.innerHTML = senses[stage][1]; renderDots(); };
    const swap = (fn) => { pond.classList.add("fade"); setTimeout(() => { fn(); pond.classList.remove("fade"); }, 450); };
    hit.addEventListener("click", (e) => {
      if (stage >= senses.length) return;
      const r = pond.getBoundingClientRect();
      const fx = e.detail ? (e.clientX - r.left) / r.width : 0.3 + Math.random() * 0.4;
      const wl = waterline();
      const fy = Math.max(wl + 0.06, e.detail ? (e.clientY - r.top) / r.height : wl + 0.1 + Math.random() * (0.85 - wl));
      drop(fx, fy, 1.2); S.drop(1.2);
      setTimeout(() => drop(fx + (Math.random() - .5) * .05, fy + (Math.random() - .5) * .05, .5), 140); // a little splash-back
      count++;
      renderDots();
      if (count >= senses[stage][0]) {
        setTimeout(() => { drop(0.5, Math.min(0.9, waterline() + (1 - waterline()) * 0.45), 3); S.drop(2.4); }, 260); // one big ripple to close each sense
        stage++; count = 0;
        swap(() => {
          if (stage < senses.length) { show(); changeWater(senses[stage][2], senses[stage][3]); }
          else { stepEl.textContent = "Done"; promptEl.innerHTML = "You're here. Right now. That's enough."; dotsEl.innerHTML = ""; reset.hidden = false; }
        });
      }
    });
    reset.addEventListener("click", () => { stage = 0; count = 0; reset.hidden = true; swap(show); changeWater(senses[0][2], senses[0][3]); hit.focus(); });

    // a raindrop now and then while the pond is on screen, so the water feels alive
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(pond);
    setInterval(() => { if (gpu && visible && !isCalm() && !document.hidden && !isRunning()) { const wl = waterline(); drop(Math.random(), wl + 0.08 + Math.random() * (0.9 - wl), 0.4); S.drop(0.35); } }, 3500);
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

    /* fireflies: they drift around the body, and swarm happily to every part your food lights up */
    const flyCanvas = document.getElementById("fireflies");
    const flyBox = flyCanvas.parentElement;
    const fctx = flyCanvas.getContext("2d");
    let flies = [], flyOn = false, flyVisible = false, fdpr = 1;
    const spotXY = (pk) => {
      const s = spots.querySelector(`[data-k="${pk}"]`).getBoundingClientRect(), b = flyBox.getBoundingClientRect();
      return [s.left + s.width / 2 - b.left, s.top + s.height / 2 - b.top];
    };
    const sizeFlies = () => {
      fdpr = Math.min(2, devicePixelRatio || 1);
      flyCanvas.width = flyBox.clientWidth * fdpr; flyCanvas.height = flyBox.clientHeight * fdpr;
    };
    const spawn = () => ({
      x: Math.random() * flyBox.clientWidth, y: Math.random() * flyBox.clientHeight,
      vx: 0, vy: 0, home: null, joy: 0, phase: Math.random() * 7, rate: 0.6 + Math.random() * 1.4, orbit: 18 + Math.random() * 26, dir: Math.random() < .5 ? -1 : 1,
    });
    const syncFlies = () => {
      const want = 8 + lit.size * 4;
      while (flies.length < want) flies.push(spawn());
      flies.length = Math.min(flies.length, want);
      const homes = [...lit];
      flies.forEach((f, i) => { f.home = homes.length && i % 4 !== 0 ? homes[i % homes.length] : null; });
    };
    const celebrate = (pk) => { flies.forEach((f) => { if (f.home === pk || Math.random() < .35) { f.home = pk; f.joy = 1; } }); wakeFlies(); };
    const flyTick = (now) => {
      if (!flyVisible || document.hidden) { flyOn = false; return; }
      const t = now / 1000, still = isCalm();
      fctx.setTransform(fdpr, 0, 0, fdpr, 0, 0);
      fctx.clearRect(0, 0, flyBox.clientWidth, flyBox.clientHeight);
      fctx.globalCompositeOperation = "lighter";
      for (const f of flies) {
        if (!still) {
          let tx, ty;
          if (f.home) {
            const [hx, hy] = spotXY(f.home), a = t * f.rate * f.dir * (1 + f.joy * 2) + f.phase;
            tx = hx + Math.cos(a) * f.orbit * (1 - f.joy * .3); ty = hy + Math.sin(a * 1.3) * f.orbit * .7;
          } else {
            tx = f.x + Math.cos(t * .7 + f.phase) * 40; ty = f.y + Math.sin(t * .9 + f.phase * 2) * 30;
          }
          f.vx += (tx - f.x) * .004 + (Math.random() - .5) * .35;   // the buzz: tiny restless jitters
          f.vy += (ty - f.y) * .004 + (Math.random() - .5) * .35;
          f.vx *= .93; f.vy *= .93;
          f.x += f.vx; f.y += f.vy;
          f.joy = Math.max(0, f.joy - .004);
        }
        const blink = .45 + .55 * Math.max(0, Math.sin(t * (2.2 + f.joy * 5) + f.phase * 3)) ** 2;
        const r = 3 + f.joy * 3, glow = 16 + f.joy * 14;
        const g = fctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, glow);
        g.addColorStop(0, `rgba(236, 255, 140, ${.9 * blink})`);
        g.addColorStop(.25, `rgba(200, 255, 90, ${.35 * blink})`);
        g.addColorStop(1, "rgba(160, 255, 60, 0)");
        fctx.fillStyle = g;
        fctx.beginPath(); fctx.arc(f.x, f.y, glow, 0, Math.PI * 2); fctx.fill();
        fctx.fillStyle = `rgba(255, 255, 220, ${blink})`;
        fctx.beginPath(); fctx.arc(f.x, f.y, r * .5, 0, Math.PI * 2); fctx.fill();
      }
      fctx.globalCompositeOperation = "source-over";
      requestAnimationFrame(flyTick);
    };
    function wakeFlies() { if (!flyOn && flyVisible) { flyOn = true; requestAnimationFrame(flyTick); } }
    new IntersectionObserver(([en]) => { flyVisible = en.isIntersecting; if (flyVisible) { sizeFlies(); wakeFlies(); } }).observe(flyBox);
    window.addEventListener("resize", sizeFlies);

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
      const fresh = [...nowLit].filter((pk) => !lit.has(pk));
      lit = nowLit;
      syncFlies();
      fresh.forEach(celebrate);
      if (fresh.length) S.twinkle();
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
      if (lit.has(b.dataset.k)) { celebrate(b.dataset.k); S.twinkle(); }
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

  /* ---------- ride the wave: an urge-surfing timer that draws your own wave as you rate it ---------- */
  const surf = (() => {
    const stage = document.getElementById("surfStage");
    const timeEl = document.getElementById("surfTime");
    const msgEl = document.getElementById("surfMsg");
    const level = document.getElementById("surfLevel");
    const levelOut = document.getElementById("surfLevelOut");
    const startBtn = document.getElementById("surfStart");
    const logBtn = document.getElementById("surfLog");
    const doneBtn = document.getElementById("surfDone");
    const countEl = document.getElementById("surfCount");
    const milestones = [
      [0, "You're on the board. Breathe slowly — longer out than in."],
      [60, "One minute. Notice where you feel it. You don't have to do anything with it."],
      [180, "Three minutes. Every wave crests eventually."],
      [300, "Five minutes in. You're doing it."],
      [600, "Ten minutes. For many people the urge is already starting to ease."],
      [900, "Fifteen minutes. Keep breathing. Stay on the board."],
      [1200, "Twenty minutes. You're riding it out."],
      [1800, "Thirty minutes. Look how far you've come."],
    ];
    let t0 = 0, points = [], timer = null, visible = false, said = -1;
    let waves = 0;
    try { waves = Number(localStorage.getItem("bloom-waves") || 0); } catch (e) {}
    const showCount = () => { countEl.textContent = waves ? `Waves you've ridden on this device: ${waves}. Each one counts.` : ""; };
    showCount();
    const elapsed = () => (t0 ? (Date.now() - t0) / 1000 : 0);
    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    const log = () => {
      if (!t0) return;
      points.push({ t: elapsed(), v: Number(level.value) });
      const peak = Math.max(...points.map((p) => p.v)), now = points[points.length - 1].v;
      if (points.length > 1 && now < peak) msgEl.textContent = `It's down from ${peak} to ${now}. The wave is already falling.`;
      else if (points.length > 1 && now >= peak) msgEl.textContent = "This might be the crest. Breathe into it — crests don't last.";
    };
    level.addEventListener("input", () => { levelOut.textContent = level.value; });
    let lt;
    level.addEventListener("change", () => { clearTimeout(lt); lt = setTimeout(log, 400); });
    logBtn.addEventListener("click", log);
    const start = () => {
      t0 = Date.now(); points = []; said = -1;
      log();
      startBtn.hidden = true; logBtn.hidden = false; doneBtn.hidden = false;
      stage.classList.add("riding");
      timer = setInterval(() => {
        const s = elapsed();
        timeEl.textContent = fmt(s);
        const m = milestones.filter(([at]) => s >= at).length - 1;
        if (m > said) { said = m; msgEl.textContent = milestones[m][1]; }
        if (Math.floor(s) > 0 && Math.floor(s) % 120 === 0) { msgEl.textContent = "Check in: how strong is it now? Move the slider."; level.classList.remove("nudge"); void level.offsetWidth; level.classList.add("nudge"); }
      }, 1000);
    };
    startBtn.addEventListener("click", start);
    doneBtn.addEventListener("click", () => {
      log();
      clearInterval(timer);
      const s = elapsed(), first = points[0].v, last = points[points.length - 1].v, peak = Math.max(...points.map((p) => p.v));
      msgEl.textContent = `You rode it for ${fmt(s)}. It went from ${first}${peak > first ? `, up to ${peak},` : ""} to ${last}. That's a wave you didn't have to obey.`;
      waves++; try { localStorage.setItem("bloom-waves", String(waves)); } catch (e) {}
      showCount();
      t0 = 0; startBtn.hidden = false; startBtn.textContent = "Ride another wave"; logBtn.hidden = true; doneBtn.hidden = true;
      stage.classList.remove("riding");
    });

    // the sea: real footage that goes from a calm paddle to breaking waves as the urge rises, and settles again as it falls
    const vids = [...stage.querySelectorAll("video.sea")];
    const ease = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const setSea = () => {
      const v = Number(level.value) / 10;
      const op = [1, ease(0.25, 0.55, v), ease(0.65, 0.9, v)];
      const warm = [0, 0.15, 0.5]; // start fetching the rougher sea a little before it's needed
      vids.forEach((vid, i) => {
        vid.style.opacity = op[i];
        if (visible && v >= warm[i] && !vid.getAttribute("src")) vid.src = vid.dataset.src;
        const hidden = op[i] === 0 || (i < 2 && op[2] === 1) || (i === 0 && op[1] === 1);
        if (visible && !isCalm() && !hidden && vid.getAttribute("src")) vid.play().catch(() => {});
        else if (hidden || !visible || isCalm()) vid.pause();
      });
      S.ocean.set(v);
    };
    level.addEventListener("input", setSea);
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      setSea();
      if (visible) S.ocean.start(); else S.ocean.stop();
    }, { rootMargin: "200px 0px" }).observe(stage);
    document.getElementById("calmBtn").addEventListener("click", () => setTimeout(setSea));
    return { start: () => { if (!t0) start(); } };
  })();

  /* ---------- delay & distract: real ideas with real pictures ---------- */
  (() => {
    const pic = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=900`;
    const ideas = [
      { title: "Call or text someone", img: pic("1758876201450-cf77ab8b95bc"), text: "You don't have to explain everything. \"Can you talk for a bit?\" is enough — or just talk about anything else.", actions: [{ label: "Write a message", href: "sms:?&body=" + encodeURIComponent("Hey, can you talk for a bit? I'm having a hard moment.") }] },
      { title: "Talk it through", img: pic("1488509082528-cefbba5ad692"), text: "Use the gentle check-in below. If you'd like an AI companion, Wysa is an anonymous, evidence-based option — it's no substitute for people or for crisis care.", actions: [{ label: "Start the check-in", go: "companion" }, { label: "Wysa ↗", href: "https://www.wysa.com/", ext: true }] },
      { title: "Dance it out", img: "https://i.ytimg.com/vi/gkstiMe2Ybs/hqdefault.jpg", text: "Put on a Just Dance video and copy the dancers. Silly, sweaty and impossible to do while thinking about food.", actions: [{ label: "Watch on YouTube ↗", href: "https://www.youtube.com/watch?v=gkstiMe2Ybs", ext: true }, { label: "More Just Dance ↗", href: "https://www.youtube.com/@justdancegame", ext: true }] },
      { title: "Make a Pinterest board", img: pic("1763307411452-43cfd9f516ce"), text: "Collect things that make you feel calm, hopeful or excited — places you'd love to visit, colours, art, room ideas, future plans. Keep it free of bodies and diet content.", actions: [{ label: "Open Pinterest ↗", href: "https://www.pinterest.com/", ext: true }, { label: "How to make a board ↗", href: "https://help.pinterest.com/en/article/create-a-board", ext: true }] },
      { title: "Make something", img: pic("1593037515490-c4d56a9ff5ff"), text: "Draw, paint, colour, knit, play an instrument. Busy hands quiet a busy mind — it doesn't have to be good.", actions: [] },
      { title: "Step outside", img: pic("1758438919146-f3f59a6d2544"), text: "Walk around the block. Name five colours you can see. Fresh air and a change of scene can break the loop.", actions: [] },
      { title: "Turn the music up", img: pic("1625786682948-2168238883d2"), text: "One song you love, start to finish, eyes closed. Sing along if you can — it's hard to hold your breath and sing.", actions: [] },
      { title: "Write it out", img: pic("1579017308347-e53e0d2fc5e9"), text: "Ask yourself: what do I actually need right now — rest, comfort, company, or to be heard? Then write the answer.", actions: [] },
      { title: "Cuddle an animal", img: pic("1516366434321-728a48e6b7bf"), text: "A pet, a neighbour's dog, or a few minutes of animal videos. Warm, simple, and good for your nervous system.", actions: [] },
    ];
    document.getElementById("ideas").innerHTML = `
      <div class="delay reveal"><p><b>Try a ten-minute delay.</b> Start the wave timer, pick something below, and check back in when it's done.</p>
      <button class="btn btn-solid" type="button" data-go="surf">Start a 10-minute delay</button></div>` +
      ideas.map((d) => `<article class="idea reveal">
        <span class="idea-pic"><img src="${esc(d.img)}" alt="" loading="lazy"></span>
        <div class="idea-body"><h3>${esc(d.title)}</h3><p>${esc(d.text)}</p>
        <div class="idea-actions">${d.actions.map((a) => a.go
          ? `<button class="chip" type="button" data-go="${a.go}">${esc(a.label)}</button>`
          : `<a class="chip" href="${esc(a.href)}"${a.ext ? ' target="_blank" rel="noopener"' : ""}>${esc(a.label)}</a>`).join("")}</div></div>
      </article>`).join("");
    const goTo = (id) => {
      const el = document.getElementById(id);
      if (lenis) lenis.scrollTo(el, { offset: -80, duration: 1.4 }); else el.scrollIntoView({ behavior: "smooth" });
    };
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-go]"); if (!b) return;
      const where = b.dataset.go;
      if (where === "surf") { goTo("surf"); setTimeout(() => surf.start(), 900); }
      else if (where === "companion") { goTo("companion"); companion.begin(); }
      else goTo(where);
    });
  })();

  /* ---------- talk it through: a small, honest, scripted check-in ---------- */
  const companion = (() => {
    const logEl = document.getElementById("compLog");
    const repliesEl = document.getElementById("compReplies");
    const tree = {
      start: { say: "Hi. I'm a small script, not a person — but I'm here, and I'm not going anywhere. How are you feeling right now? Hard feelings and good ones are both welcome.",
        options: [["Anxious or restless", "anxious"], ["Having an urge", "urge"], ["Sad or lonely", "sad"], ["Numb or empty", "numb"], ["Angry or frustrated", "angry"], ["Overwhelmed", "overwhelmed"],
          ["Guilty after eating", "guilt"], ["Bored", "bored"], ["Tired", "tired"], ["I just need a distraction", "distract"],
          ["Calm", "calm"], ["Hopeful", "hopeful"], ["Proud of myself", "proud"], ["Happy", "happy"], ["Grateful", "grateful"]] },
      angry: { say: "Anger makes sense — it often shows up when something matters or something isn't fair. It's allowed. Let's give it somewhere safe to go.",
        options: [["Snap some chalk", "#asmr"], ["Pop bubbles hard", "#play"], ["Dance it out", "dance"], ["Something else", "start"]] },
      overwhelmed: { say: "When everything is too much, the next step only needs to be tiny. Just this breath. Then the next one.",
        options: [["Breathe with the sunrise", "#breathe"], ["5-4-3-2-1 on the water", "#pond"], ["Talk to a real person", "#help"]] },
      guilt: { say: "That guilt is the eating disorder talking, not the truth. Eating is not something you have to earn or make up for. Your body needed that, and it's already saying thank you.",
        options: [["Show me what my food gave me", "#nourish"], ["Ride out an urge to compensate", "@surf"], ["Something else", "start"]] },
      bored: { say: "Boredom can make urges louder. Let's give your hands and mind something more interesting.",
        options: [["Play the lantern game", "#play"], ["Try the ASMR toys", "#asmr"], ["See all the ideas", "#ideas"]] },
      tired: { say: "Tired is a real need, not a failure. Rest is allowed — and a warm drink and something to eat can be part of rest too.",
        options: [["A slow breathing break", "#breathe"], ["Gentle sounds", "#asmr"], ["Something else", "start"]] },
      calm: { say: "I'm really glad you've found some calm. Let's notice it, so you can find your way back here later.",
        options: [["Leave a note for the morning", "#notes"], ["Breathe and stay here a while", "#breathe"], ["Start over", "start"]] },
      hopeful: { say: "Hope is such a brave thing to feel. Hold onto it — write it down so a harder day can borrow it.",
        options: [["Write it on a note", "#notes"], ["Make a Pinterest board of it", "pinterest"], ["Start over", "start"]] },
      proud: { say: "You should be! Whatever you did, it counts — big steps and tiny ones. I'm proud of you too.",
        options: [["Leave a note for future me", "#notes"], ["Celebrate with a dance", "dance"], ["Start over", "start"]] },
      happy: { say: "That makes me happy too. Let yourself enjoy it — you deserve good moments, fully.",
        options: [["Play something fun", "#play"], ["Turn on calm music", "music"], ["Save it in a note", "#notes"]] },
      grateful: { say: "Gratitude is lovely to sit with. What, or who, are you grateful for? Writing it down makes it stay a little longer.",
        options: [["Write it on a note", "#notes"], ["Message someone to say thanks", "sms-thanks"], ["Start over", "start"]] },
      anxious: { say: "That restless feeling is so hard to sit in. Let's give your body somewhere to put it.",
        options: [["Breathe with the sunrise", "#breathe"], ["Pop some bubbles", "#play"], ["Something else", "start"]] },
      urge: { say: "Thank you for noticing it instead of just acting on it. That takes real strength. Want to ride it out together?",
        options: [["Ride the wave with me", "@surf"], ["Distract me first", "#ideas"], ["I need a real person", "#help"]] },
      sad: { say: "I'm really sorry it feels so heavy. You deserve company in this — not to carry it alone.",
        options: [["Message a friend", "sms"], ["Find a helpline", "#help"], ["Write it out", "#ideas"]] },
      numb: { say: "Numb can feel safer than feeling everything at once. Let's come back gently, one sense at a time.",
        options: [["5-4-3-2-1 on the water", "#pond"], ["Breathe with the sunrise", "#breathe"], ["Something else", "start"]] },
      distract: { say: "Good call. Pick whatever sounds least effort right now:",
        options: [["Play for three minutes", "#play"], ["Dance it out", "dance"], ["See all the ideas", "#ideas"]] },
      after: { say: "Taking you there now. Come back any time — I'll be here.", options: [["Start over", "start"]] },
    };
    let busy = false, begun = false;
    const add = (who, text) => {
      const p = document.createElement("p");
      p.className = `msg ${who}`; p.textContent = text;
      logEl.appendChild(p);
      logEl.scrollTop = logEl.scrollHeight;
      return p;
    };
    const say = (key) => {
      const node = tree[key];
      busy = true; repliesEl.innerHTML = "";
      const typing = add("bot typing", "…");
      setTimeout(() => {
        typing.remove(); add("bot", node.say); busy = false;
        repliesEl.innerHTML = node.options.map(([label, go]) => `<button class="chip" type="button" data-to="${go}">${esc(label)}</button>`).join("");
      }, 650);
    };
    repliesEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-to]"); if (!b || busy) return;
      const to = b.dataset.to;
      add("me", b.textContent);
      if (tree[to]) return say(to);
      say("after");
      setTimeout(() => {
        const target = { "#ideas": "ideas", "#help": "help", "#breathe": "breathe", "#play": "play", "#pond": "pond", "@surf": "surf", "#asmr": "asmr", "#notes": "notes", "#nourish": "nourish" }[to];
        if (to === "sms") location.href = "sms:?&body=" + encodeURIComponent("Hey, can you talk for a bit? I'm having a hard moment.");
        else if (to === "sms-thanks") location.href = "sms:?&body=" + encodeURIComponent("Hey, I was just thinking about you. Thank you for being in my life.");
        else if (to === "pinterest") window.open("https://www.pinterest.com/", "_blank", "noopener");
        else if (to === "music") { S.setMusic(true); }
        else if (to === "dance") window.open("https://www.youtube.com/watch?v=gkstiMe2Ybs", "_blank", "noopener");
        else if (target) {
          const el = document.getElementById(target);
          if (lenis) lenis.scrollTo(el, { offset: -80, duration: 1.4 }); else el.scrollIntoView({ behavior: "smooth" });
          if (to === "@surf") setTimeout(() => surf.start(), 900);
        }
      }, 900);
    });
    const begin = () => { if (!begun) { begun = true; say("start"); } };
    new IntersectionObserver(([en]) => { if (en.isIntersecting) begin(); }, { threshold: 0.4 }).observe(document.getElementById("companion"));
    return { begin };
  })();

  /* ---------- play it out: an original lantern game, and bubble wrap for restless hands ---------- */
  (() => {
    const box = document.getElementById("lanternGame");
    const cv = document.getElementById("lanternCanvas");
    const g = cv.getContext("2d");
    const scoreEl = document.getElementById("lgScore");
    const timeEl = document.getElementById("lgTime");
    const startEl = document.getElementById("lgStart");
    const ROUND = 180;
    let lanterns = [], sparks = [], score = 0, t0 = 0, last = 0, playing = false, nextSpawn = 0, visible = false, speed = 1;
    // speed modes: gentle for a slow mind, up to fast for people used to games
    const pickSpeed = (e) => {
      const b = e.target.closest("[data-speed]"); if (!b) return;
      speed = Number(b.dataset.speed);
      b.parentElement.querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    };
    startEl.addEventListener("click", pickSpeed);
    const size = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = box.clientWidth * d; cv.height = box.clientHeight * d; g.setTransform(d, 0, 0, d, 0, 0); };
    const W = () => box.clientWidth, H = () => box.clientHeight;
    const spawn = (k) => {
      const s = 26 + Math.random() * 18;
      lanterns.push({ x: s + Math.random() * (W() - s * 2), y: H() + s, s, vy: (46 + Math.random() * 34) * (1 + k * 1.4) * speed, sway: Math.random() * 6, lit: 0 });
    };
    const drawLantern = (l, t) => {
      const x = l.x + Math.sin(t * 1.3 + l.sway) * 8, y = l.y, s = l.s;
      if (l.lit) {
        const glow = g.createRadialGradient(x, y, 0, x, y, s * 2.6);
        glow.addColorStop(0, `rgba(255, 190, 90, ${0.55 * (1 - l.fade)})`); glow.addColorStop(1, "rgba(255, 150, 60, 0)");
        g.fillStyle = glow; g.beginPath(); g.arc(x, y, s * 2.6, 0, Math.PI * 2); g.fill();
      }
      const body = g.createLinearGradient(x - s / 2, y, x + s / 2, y);
      const a = l.lit ? 1 - l.fade : 0.85;
      body.addColorStop(0, l.lit ? `rgba(255, 140, 50, ${a})` : `rgba(120, 70, 50, ${a})`);
      body.addColorStop(0.5, l.lit ? `rgba(255, 225, 150, ${a})` : `rgba(170, 110, 80, ${a})`);
      body.addColorStop(1, l.lit ? `rgba(255, 140, 50, ${a})` : `rgba(120, 70, 50, ${a})`);
      g.fillStyle = body;
      g.beginPath();
      g.moveTo(x - s * 0.36, y - s * 0.6); g.lineTo(x + s * 0.36, y - s * 0.6);
      g.quadraticCurveTo(x + s * 0.62, y, x + s * 0.4, y + s * 0.55);
      g.lineTo(x - s * 0.4, y + s * 0.55);
      g.quadraticCurveTo(x - s * 0.62, y, x - s * 0.36, y - s * 0.6);
      g.fill();
      g.fillStyle = `rgba(60, 35, 25, ${a})`; g.fillRect(x - s * 0.3, y + s * 0.55, s * 0.6, s * 0.08);
    };
    const frame = (now) => {
      if (!playing) return;
      const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
      const left = Math.max(0, ROUND - t), k = t / ROUND;
      timeEl.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
      if (t >= nextSpawn) { spawn(k); nextSpawn = t + (Math.max(0.35, 1.4 - k * 1.1) * (0.6 + Math.random() * 0.8)) / Math.sqrt(speed); }
      g.clearRect(0, 0, W(), H());
      lanterns.forEach((l) => {
        l.y -= l.vy * dt * (l.lit ? 2.4 : 1);
        if (l.lit) l.fade = Math.min(1, (l.fade || 0) + dt * 0.5);
        drawLantern(l, t);
      });
      lanterns = lanterns.filter((l) => l.y > -l.s * 2 && !(l.lit && l.fade >= 1));
      sparks.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; p.life -= dt; g.fillStyle = `rgba(255, 220, 140, ${Math.max(0, p.life)})`; g.fillRect(p.x, p.y, 2, 2); });
      sparks = sparks.filter((p) => p.life > 0);
      if (left <= 0) return finish();
      if (visible && !document.hidden) requestAnimationFrame(frame); else pause();
    };
    let pausedAt = 0;
    const pause = () => { pausedAt = performance.now(); };
    const resume = () => { if (playing && pausedAt) { const gap = performance.now() - pausedAt; t0 += gap; last = performance.now(); pausedAt = 0; requestAnimationFrame(frame); } };
    const finish = () => {
      playing = false;
      const speeds = document.getElementById("lgSpeeds").outerHTML;
      startEl.innerHTML = `<h3>You freed ${score} lantern${score === 1 ? "" : "s"}</h3><p>Three minutes, done. How's the urge now — a little quieter?</p>
        ${speeds}<div class="lg-again"><button class="btn btn-solid" id="lgPlay">Play again</button><button class="btn btn-line" type="button" data-go="surf">Ride the wave</button></div>`;
      startEl.hidden = false;
      document.getElementById("lgPlay").addEventListener("click", play);
    };
    function play() {
      size(); lanterns = []; sparks = []; score = 0; scoreEl.textContent = "0 lanterns freed";
      startEl.hidden = true; playing = true; pausedAt = 0; t0 = last = performance.now(); nextSpawn = 0;
      requestAnimationFrame(frame);
    }
    document.getElementById("lgPlay").addEventListener("click", play);
    cv.addEventListener("pointerdown", (e) => {
      if (!playing) return;
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, t = (performance.now() - t0) / 1000;
      for (const l of lanterns) {
        const x = l.x + Math.sin(t * 1.3 + l.sway) * 8;
        if (!l.lit && Math.hypot(px - x, py - l.y) < l.s * 0.9) {
          l.lit = 1; l.fade = 0; score++; S.chime();
          scoreEl.textContent = `${score} lantern${score === 1 ? "" : "s"} freed`;
          for (let i = 0; i < 14; i++) sparks.push({ x, y: l.y, vx: (Math.random() - .5) * 140, vy: (Math.random() - .8) * 120, life: .8 + Math.random() * .5 });
          break;
        }
      }
    });
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { size(); resume(); } }).observe(box);
    window.addEventListener("resize", size);

    const grid = document.getElementById("bubbleGrid");
    const fill = () => {
      grid.innerHTML = Array.from({ length: 48 }, (_, i) => `<button class="bubble" type="button" aria-label="Bubble" style="--i:${i}"></button>`).join("");
    };
    grid.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".bubble");
      if (b && !b.classList.contains("popped")) { b.classList.add("popped"); b.setAttribute("aria-pressed", "true"); S.pop(); }
    });
    grid.addEventListener("keydown", (e) => {
      const b = e.target.closest(".bubble");
      if (b && (e.key === "Enter" || e.key === " ") && !b.classList.contains("popped")) { e.preventDefault(); b.classList.add("popped"); S.pop(); }
    });
    document.getElementById("bubbleReset").addEventListener("click", fill);
    fill();
  })();

  /* ---------- sounds that soothe: small ASMR toys to tap, snap and listen to ---------- */
  (() => {
    const box = document.getElementById("toys");
    const notes = [392, 440, 523.25, 587.33, 659.25];
    const drops = Array.from({ length: 40 }, () => `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--d:${(0.5 + Math.random() * 0.6).toFixed(2)}s;--o:${(Math.random() * 1.5).toFixed(2)}s"></i>`).join("");
    const toys = [
      ["chalk", "Snap the chalk", "Tap to break it. A new stick rolls in.", '<div class="chalk"><i class="half l"></i><i class="half r"></i></div>'],
      ["sand", "Slice the sand", "Tap or swipe to cut a slice of kinetic sand.", '<div class="sand"><div class="sand-block"></div></div>'],
      ["paper", "Scrunch the paper", "Press and drag to crumple it. Let go to smooth it out.", '<div class="paper"><div class="sheet"></div></div>'],
      ["wood", "Tap the wood", "Five warm wooden notes. Any order sounds kind.",
        '<div class="keys">' + notes.map((f, i) => `<button type="button" class="key" data-f="${f}" style="--i:${i}" aria-label="Wooden note ${i + 1}"></button>`).join("") + "</div>"],
      ["bowl", "Ring the bowl", "One tap. Listen until the sound is completely gone.", '<div class="bowl-wrap"><div class="bowl"></div></div>'],
      ["ice", "Clink the ice", "Tap the glass and listen to the ice settle.", '<div class="glass"><i></i><i></i><i></i></div>'],
      ["rain", "Rain on the window", "Tap to start or stop the rain.", `<div class="window">${drops}</div>`],
    ];
    box.innerHTML = toys.map(([k, title, hint, art]) => `<article class="toy toy-${k} reveal" data-toy="${k}">
        <div class="toy-stage"${k === "wood" ? "" : ' role="button" tabindex="0"'} aria-label="${esc(title)}">${art}</div>
        <h3>${esc(title)}</h3><p>${esc(hint)}</p></article>`).join("");
    const card = (k) => box.querySelector(`[data-toy="${k}"] .toy-stage`);
    const press = (el, fn) => {
      el.addEventListener("click", fn);
      el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(e); } });
    };
    const crumbs = (host, n, colour) => {
      for (let i = 0; i < n; i++) {
        const c = document.createElement("span");
        c.className = "crumb";
        c.style.cssText = `--dx:${((Math.random() - 0.5) * 120).toFixed(0)}px;--dy:${(20 + Math.random() * 70).toFixed(0)}px;--s:${(2 + Math.random() * 4).toFixed(1)}px;background:${colour}`;
        host.appendChild(c);
        setTimeout(() => c.remove(), 1200);
      }
    };

    // chalk
    const chalkColours = ["#f7f3ea", "#ffd1dc", "#cde8ff", "#d7f5d0", "#fff1b8", "#e5d4ff"];
    let ci = 0, snapping = false;
    const chalkStage = card("chalk"), chalk = chalkStage.querySelector(".chalk");
    chalk.style.setProperty("--c", chalkColours[0]);
    press(chalkStage, () => {
      if (snapping) return;
      snapping = true; S.chalk();
      chalk.classList.add("snapped");
      crumbs(chalkStage, 16, chalkColours[ci]);
      setTimeout(() => {
        ci = (ci + 1) % chalkColours.length;
        chalk.classList.remove("snapped"); chalk.classList.add("fresh");
        chalk.style.setProperty("--c", chalkColours[ci]);
        setTimeout(() => { chalk.classList.remove("fresh"); snapping = false; }, 500);
      }, 1300);
    });

    // kinetic sand: each cut slices a little off the block, and the slice slumps over
    const sandStage = card("sand"), sandBox = sandStage.querySelector(".sand"), block = sandStage.querySelector(".sand-block");
    const sandColours = ["#f2b8c6", "#b9d8f2", "#c8e6b8", "#f5d49a", "#d6c3f0"];
    let left = 10, si = 0, lastCut = 0;
    block.style.setProperty("--c", sandColours[0]);
    const cut = () => {
      const now = performance.now();
      if (now - lastCut < 180 || left <= 0) return;
      lastCut = now;
      S.sand();
      left--;
      const slice = document.createElement("span");
      slice.className = "slice"; slice.style.setProperty("--c", sandColours[si]); slice.style.left = `${10 + left * 8}%`;
      sandBox.appendChild(slice);
      setTimeout(() => slice.remove(), 1300);
      block.style.width = `${left * 8}%`;
      if (left <= 0) setTimeout(() => { si = (si + 1) % sandColours.length; block.style.setProperty("--c", sandColours[si]); left = 10; block.style.width = "80%"; }, 800);
    };
    press(sandStage, cut);
    sandStage.addEventListener("pointermove", (e) => { if (e.buttons) cut(); });

    // paper
    const paperStage = card("paper"), sheet = paperStage.querySelector(".sheet");
    let scrunch = 0, holding = false, px = 0, py = 0, unfold;
    const shape = () => {
      const j = () => (Math.random() * scrunch * 18).toFixed(1);
      sheet.style.clipPath = `polygon(${j()}% ${j()}%, 50% ${j()}%, ${100 - j()}% ${j()}%, ${100 - j()}% 50%, ${100 - j()}% ${100 - j()}%, 50% ${100 - j()}%, ${j()}% ${100 - j()}%, ${j()}% 50%)`;
      sheet.style.transform = `scale(${(1 - scrunch * 0.45).toFixed(3)}) rotate(${((Math.random() - 0.5) * scrunch * 30).toFixed(1)}deg)`;
      sheet.style.setProperty("--crease", scrunch.toFixed(2));
    };
    const release = () => {
      holding = false;
      clearInterval(unfold);
      unfold = setInterval(() => { scrunch = Math.max(0, scrunch - 0.1); shape(); if (Math.random() < 0.5) S.paper(0.25); if (!scrunch) clearInterval(unfold); }, 140);
    };
    paperStage.addEventListener("pointerdown", (e) => {
      holding = true; px = e.clientX; py = e.clientY; clearInterval(unfold);
      paperStage.setPointerCapture(e.pointerId);
      scrunch = Math.min(1, scrunch + 0.1); shape(); S.paper(0.7);
    });
    paperStage.addEventListener("pointermove", (e) => {
      if (!holding || Math.hypot(e.clientX - px, e.clientY - py) < 14) return;
      px = e.clientX; py = e.clientY;
      scrunch = Math.min(1, scrunch + 0.06); shape(); S.paper(0.5 + scrunch * 0.6);
    });
    paperStage.addEventListener("pointerup", () => holding && release());
    paperStage.addEventListener("pointercancel", () => holding && release());
    paperStage.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault(); scrunch = Math.min(1, scrunch + 0.3); shape(); S.paper(1);
      clearTimeout(paperStage._k); paperStage._k = setTimeout(release, 600);
    });

    // wooden keys
    card("wood").addEventListener("click", (e) => {
      const k = e.target.closest(".key"); if (!k) return;
      S.wood(Number(k.dataset.f));
      k.classList.remove("hit"); void k.offsetWidth; k.classList.add("hit");
    });

    // singing bowl
    const bowlStage = card("bowl"), bowlWrap = bowlStage.querySelector(".bowl-wrap");
    press(bowlStage, () => {
      S.bowl();
      for (let i = 0; i < 3; i++) {
        const r = document.createElement("span"); r.className = "hum"; r.style.animationDelay = `${i * 0.9}s`;
        bowlWrap.appendChild(r);
        setTimeout(() => r.remove(), 5000 + i * 900);
      }
    });

    // ice
    const iceStage = card("ice");
    press(iceStage, () => {
      S.clink(); setTimeout(() => S.clink(), 90 + Math.random() * 120);
      iceStage.classList.remove("clinked"); void iceStage.offsetWidth; iceStage.classList.add("clinked");
    });

    // rain: stops on its own when you scroll away
    const rainStage = card("rain");
    let raining = false;
    const setRain = (on) => { raining = on; rainStage.classList.toggle("raining", on); rainStage.setAttribute("aria-pressed", String(on)); if (on) S.rain.start(); else S.rain.stop(); };
    rainStage.setAttribute("aria-pressed", "false");
    press(rainStage, () => setRain(!raining));
    new IntersectionObserver(([en]) => { if (!en.isIntersecting && raining) setRain(false); }).observe(rainStage);
  })();

  /* ---------- resources: community, bookshelf, podcasts, research ---------- */
  (() => {
    const R = window.BLOOM_RESOURCES;
    if (!R) return;
    document.getElementById("commList").innerHTML = R.communities.map((c) =>
      `<a class="comm reveal" href="${esc(c.url)}" target="_blank" rel="noopener"><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p><span class="go">Open on Reddit ↗</span></a>`).join("");
    document.getElementById("shelf").innerHTML = R.books.map((b) =>
      `<a class="book" href="${esc(b.url || `https://openlibrary.org/isbn/${b.isbn}`)}" target="_blank" rel="noopener">
        <span class="cover"><img src="${esc(b.cover || `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg`)}" alt="Cover of ${esc(b.title)}" loading="lazy"></span>
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

  /* ---------- notes for the morning: colourful, movable, removable ---------- */
  const board = document.getElementById("board");
  const colours = [["butter", "#fff3b0", "Yellow"], ["blush", "#ffd3dd", "Pink"], ["mint", "#cdf0dc", "Green"], ["sky", "#cfe6ff", "Blue"], ["lilac", "#e4d7ff", "Lilac"], ["peach", "#ffdcc2", "Peach"]];
  const colourOf = (c) => (colours.find(([k]) => k === c) || colours[0])[1];
  const rand = (a, b) => a + Math.random() * (b - a);
  let notes = null;
  try { notes = JSON.parse(localStorage.getItem("bloom-notes-v2")); } catch (e) {}
  if (!Array.isArray(notes)) {
    const seed = [
      "You made it through every hard day so far.",
      "Rest is productive.",
      "Food is fuel, comfort and connection.",
      "Progress, not perfection.",
      "Future me is proud of me.",
    ];
    const cols = board.clientWidth < 600 ? 2 : 3, rows = Math.ceil(seed.length / cols);
    notes = seed.map((text, i) => ({ text, c: colours[i % colours.length][0], r: rand(-3, 3), x: 3 + (i % cols) * (96 / cols) + rand(0, 4), y: 5 + Math.floor(i / cols) * (90 / rows) + rand(0, 6) }));
    // keep any notes written before notes had colours
    try { JSON.parse(localStorage.getItem("bloom-notes") || "[]").forEach((o) => notes.push({ text: o.text, c: "butter", r: rand(-3, 3), x: o.x, y: o.y })); } catch (e) {}
  }
  const persist = () => { try { localStorage.setItem("bloom-notes-v2", JSON.stringify(notes)); } catch (e) {} };
  const place = (rec) => {
    const n = document.createElement("div");
    n.className = "note";
    n.style.setProperty("--r", `${(rec.r || 0).toFixed(1)}deg`);
    n.style.setProperty("--note", colourOf(rec.c));
    n.innerHTML = '<span class="note-text"></span><button class="note-x" type="button" aria-label="Remove this note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg></button>';
    n.querySelector(".note-text").textContent = rec.text;
    board.appendChild(n);
    const maxX = Math.max(0, (1 - n.offsetWidth / board.clientWidth) * 100);
    const maxY = Math.max(0, (1 - n.offsetHeight / board.clientHeight) * 100);
    n.style.left = `${Math.min(rec.x, maxX)}%`; n.style.top = `${Math.min(rec.y, maxY)}%`;
    let sx, sy, ox, oy, dragging = false;
    n.addEventListener("pointerdown", (e) => {
      if (dragging || e.target.closest(".note-x")) return;
      dragging = true; n.setPointerCapture(e.pointerId); n.classList.add("dragging");
      board.appendChild(n); // the note you pick up comes to the front
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
      rec.x = parseFloat(n.style.left); rec.y = parseFloat(n.style.top); persist();
    };
    n.addEventListener("pointerup", end);
    n.addEventListener("pointercancel", end);
    n.querySelector(".note-x").addEventListener("click", () => {
      notes = notes.filter((x) => x !== rec); persist();
      S.paper(0.6);
      n.classList.add("gone");
      setTimeout(() => n.remove(), 300);
    });
  };
  notes.forEach(place);

  // pick a colour for the next note
  const swatches = document.getElementById("noteColours");
  let chosen = colours[1][0];
  swatches.innerHTML = colours.map(([k, hex, label]) =>
    `<button type="button" role="radio" class="swatch-btn" data-c="${k}" style="--note:${hex}" aria-label="${label}" aria-checked="${k === chosen}"></button>`).join("");
  swatches.addEventListener("click", (e) => {
    const b = e.target.closest("[data-c]"); if (!b) return;
    chosen = b.dataset.c;
    swatches.querySelectorAll("[data-c]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  });
  document.getElementById("noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("noteInput");
    const t = input.value.trim();
    if (!t) return;
    const rec = { text: t, c: chosen, r: rand(-3, 3), x: rand(5, 60), y: rand(10, 65) };
    notes.push(rec); persist(); place(rec); S.paper(0.4);
    input.value = "";
  });
})();
