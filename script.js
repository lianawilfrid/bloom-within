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
      drawChart();
    };
    level.addEventListener("input", () => { levelOut.textContent = level.value; });
    let lt;
    level.addEventListener("change", () => { clearTimeout(lt); lt = setTimeout(log, 400); });
    logBtn.addEventListener("click", log);
    const start = () => {
      t0 = Date.now(); points = []; said = -1;
      log();
      startBtn.hidden = true; logBtn.hidden = false; doneBtn.hidden = false;
      scNote.textContent = "Move the slider whenever it changes";
      stage.classList.add("riding");
      timer = setInterval(() => {
        const s = elapsed();
        timeEl.textContent = fmt(s);
        const m = milestones.filter(([at]) => s >= at).length - 1;
        if (m > said) { said = m; msgEl.textContent = milestones[m][1]; }
        drawChart();
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
      scNote.textContent = `Started at ${first}, peaked at ${peak}, ended at ${last}`;
      drawChart();
    });

    // the sea: real footage that goes from a calm paddle to breaking waves as the urge rises, and settles again as it falls
    // a small chart of your own wave, kept under the footage so the sea stays clear
    const chart = document.getElementById("surfChartCanvas"), cctx = chart.getContext("2d"), scNote = document.getElementById("scNote");
    function drawChart() {
      const d = Math.min(2, devicePixelRatio || 1), w = chart.clientWidth, h = chart.clientHeight;
      if (!w) return;
      if (chart.width !== Math.round(w * d) || chart.height !== Math.round(h * d)) { chart.width = Math.round(w * d); chart.height = Math.round(h * d); }
      cctx.setTransform(d, 0, 0, d, 0, 0); cctx.clearRect(0, 0, w, h);
      const css = getComputedStyle(root), ink = css.getPropertyValue("--ink").trim(), line = css.getPropertyValue("--line").trim(), sun = css.getPropertyValue("--sun").trim();
      const L = 26, R = 12, T = 10, B = 22;
      const lastT = points.length ? points[points.length - 1].t : 0;
      const span = Math.max(60, (Math.max(elapsed(), lastT) + 10) * 1.2);
      const X = (t) => L + (t / span) * (w - L - R), Y = (v) => T + (1 - v / 10) * (h - T - B);
      cctx.font = "11px Figtree, system-ui, sans-serif"; cctx.lineWidth = 1;
      [0, 5, 10].forEach((v) => {
        cctx.strokeStyle = line; cctx.beginPath(); cctx.moveTo(L, Y(v)); cctx.lineTo(w - R, Y(v)); cctx.stroke();
        cctx.fillStyle = ink; cctx.globalAlpha = 0.65; cctx.fillText(String(v), 4, Y(v) + 4); cctx.globalAlpha = 1;
      });
      const every = span > 1500 ? 600 : span > 400 ? 120 : 30;
      cctx.fillStyle = ink; cctx.globalAlpha = 0.65;
      for (let t = every; t < span; t += every) cctx.fillText(t < 60 ? `${t}s` : `${Math.round(t / 60)}m`, X(t) - 8, h - 6);
      cctx.globalAlpha = 1;
      if (!points.length) return;
      const pts = points.map((p) => [X(p.t), Y(p.v)]);
      if (t0) pts.push([X(elapsed()), Y(points[points.length - 1].v)]);
      const path = () => {
        cctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2; cctx.bezierCurveTo(mx, y0, mx, y1, x1, y1); }
      };
      const g = cctx.createLinearGradient(0, T, 0, h - B);
      g.addColorStop(0, sun); g.addColorStop(1, "transparent");
      cctx.beginPath(); path(); cctx.lineTo(pts[pts.length - 1][0], h - B); cctx.lineTo(pts[0][0], h - B); cctx.closePath();
      cctx.globalAlpha = 0.35; cctx.fillStyle = g; cctx.fill(); cctx.globalAlpha = 1;
      cctx.beginPath(); path(); cctx.strokeStyle = sun; cctx.lineWidth = 2.4; cctx.stroke();
      cctx.fillStyle = sun;
      points.forEach((p) => { cctx.beginPath(); cctx.arc(X(p.t), Y(p.v), 3.2, 0, Math.PI * 2); cctx.fill(); });
    }
    window.addEventListener("resize", () => drawChart());
    new IntersectionObserver(([en]) => { if (en.isIntersecting) drawChart(); }).observe(chart);
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
      grid.innerHTML = Array.from({ length: 48 }, (_, i) => { const sz = Math.random(); return `<button class="bubble" type="button" aria-label="Bubble" data-sz="${sz.toFixed(2)}" style="--i:${i};--sz:${(0.74 + sz * 0.26).toFixed(2)}"></button>`; }).join("");
    };
    grid.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".bubble");
      if (b && !b.classList.contains("popped")) { b.classList.add("popped"); b.setAttribute("aria-pressed", "true"); S.pop(Number(b.dataset.sz)); }
    });
    grid.addEventListener("keydown", (e) => {
      const b = e.target.closest(".bubble");
      if (b && (e.key === "Enter" || e.key === " ") && !b.classList.contains("popped")) { e.preventDefault(); b.classList.add("popped"); S.pop(Number(b.dataset.sz)); }
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
      ["paper", "Scrunch the paper", "Press and drag to crumple it. Let go to smooth it out.", '<div class="paper-toy"><div class="sheet"></div></div>'],
      ["wood", "Tap the wood", "Five warm wooden notes. Any order sounds kind.",
        '<div class="keys">' + notes.map((f, i) => `<button type="button" class="key" data-f="${f}" style="--i:${i}" aria-label="Wooden note ${i + 1}"></button>`).join("") + "</div>"],
      ["bowl", "Ring the bowl", "One tap. Listen until the sound is completely gone.", '<div class="bowl-wrap"><div class="bowl"></div></div>'],
      ["ice", "Clink the ice", "Tap the glass and listen to the ice settle.", '<div class="glass"><i></i><i></i><i></i></div>'],
      ["rain", "Rain on the window", "Tap to start or stop the rain.", `<div class="window">${drops}</div>`],
      ["keys", "Clicky keyboard", "Type anything. Thock, thock, clack.",
        '<div class="kb">' + ["Q", "W", "E", "R", "A", "S", "D", "F", "Z", "X", "C", "V"].map((k) => `<button type="button" class="kc">${k}</button>`).join("") + "</div>"],
      ["slime", "Squish the slime", "Press and drag. It's very squishy.", '<div class="slime"><i></i></div>'],
      ["stick", "Tip the rain stick", "Tap to turn it over and listen to the seeds fall.", '<div class="stick"><i></i></div>'],
      ["chimes", "Wind chimes", "Brush across them, or tap one.",
        '<div class="chimes">' + [784, 880, 1046.5, 1174.7, 1318.5, 1568].map((f, i) => `<i data-f="${f}" style="--i:${i}"></i>`).join("") + "</div>"],
      ["soda", "Open a fizzy drink", "Tap the can. Pssst… then listen to it fizz.", '<div class="can"><i class="tab"></i><span class="fizz"></span></div>'],
      ["match", "Strike a match", "Tap to strike. Watch it glow, then fade.", '<div class="match"><i class="flame"></i></div>'],
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

    // clicky keyboard: each key goes down with a thock and comes up with a clack
    const kb = card("keys");
    kb.removeAttribute("role"); kb.removeAttribute("tabindex");
    kb.addEventListener("pointerdown", (e) => { const k = e.target.closest(".kc"); if (!k) return; k.classList.add("down"); S.key(); });
    const keyUp = (e) => { const k = e.target.closest(".kc"); if (!k || !k.classList.contains("down")) return; k.classList.remove("down"); S.key(true); };
    kb.addEventListener("pointerup", keyUp); kb.addEventListener("pointerleave", () => kb.querySelectorAll(".down").forEach((k) => k.classList.remove("down")));
    kb.addEventListener("keydown", (e) => { const k = e.target.closest(".kc"); if (k && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); S.key(); k.classList.add("down"); setTimeout(() => { k.classList.remove("down"); S.key(true); }, 90); } });

    // slime: it follows your finger, stretches, and squelches
    const slimeStage = card("slime"), blob = slimeStage.querySelector(".slime i");
    let squishing = false, lastSquish = 0, sx0 = 0, sy0 = 0;
    const squish = (e) => {
      const r = slimeStage.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      blob.style.transform = `translate(${dx * 40}px, ${dy * 30}px) scale(${1 + Math.abs(dx) * 0.6}, ${1 - Math.abs(dx) * 0.35 + Math.abs(dy) * 0.3})`;
      blob.style.setProperty("--px", `${50 + dx * 60}%`); blob.style.setProperty("--py", `${50 + dy * 60}%`);
      const now = performance.now(), moved = Math.hypot(e.clientX - sx0, e.clientY - sy0);
      if (now - lastSquish > 110 && moved > 6) { lastSquish = now; sx0 = e.clientX; sy0 = e.clientY; S.slime(Math.min(1, moved / 40)); }
    };
    slimeStage.addEventListener("pointerdown", (e) => { squishing = true; slimeStage.setPointerCapture(e.pointerId); blob.classList.add("pressed"); sx0 = e.clientX; sy0 = e.clientY; S.slime(0.8); squish(e); });
    slimeStage.addEventListener("pointermove", (e) => { if (squishing) squish(e); });
    const unsquish = () => { if (!squishing) return; squishing = false; blob.classList.remove("pressed"); blob.style.transform = ""; S.slime(0.4); };
    slimeStage.addEventListener("pointerup", unsquish); slimeStage.addEventListener("pointercancel", unsquish);
    slimeStage.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); blob.classList.add("pressed"); S.slime(1); setTimeout(() => blob.classList.remove("pressed"), 300); } });

    // rain stick
    const stickStage = card("stick"), stick = stickStage.querySelector(".stick");
    let tipped = false, tipping = false;
    press(stickStage, () => {
      if (tipping) return;
      tipping = true; tipped = !tipped;
      stick.classList.toggle("tipped", tipped);
      S.rainstick();
      setTimeout(() => { tipping = false; }, 1200);
    });

    // wind chimes: brush across them with a finger or the mouse
    const chimes = card("chimes");
    let lastChime = null;
    const ring = (c) => {
      if (!c || c === lastChime) return;
      lastChime = c; setTimeout(() => { if (lastChime === c) lastChime = null; }, 250);
      S.windchime(Number(c.dataset.f));
      c.classList.remove("swing"); void c.offsetWidth; c.classList.add("swing");
    };
    chimes.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.buttons) ring(document.elementFromPoint(e.clientX, e.clientY)?.closest(".chimes i")); });
    chimes.addEventListener("pointerdown", (e) => { chimes.releasePointerCapture?.(e.pointerId); ring(e.target.closest(".chimes i")); });
    chimes.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      [...chimes.querySelectorAll("i")].forEach((c, i) => setTimeout(() => { lastChime = null; ring(c); }, i * 140));
    });

    // fizzy drink
    const sodaStage = card("soda"), can = sodaStage.querySelector(".can");
    let opened = false;
    press(sodaStage, () => {
      if (opened) { opened = false; can.classList.remove("open"); return; } // a fresh can
      opened = true; S.soda();
      can.classList.add("open");
    });

    // strike a match
    const matchStage = card("match"), m = matchStage.querySelector(".match");
    let burning = false;
    press(matchStage, () => {
      if (burning) return;
      burning = true; S.match();
      m.classList.add("lit");
      setTimeout(() => { m.classList.remove("lit"); m.classList.add("out"); }, 4200);
      setTimeout(() => { m.classList.remove("out"); burning = false; }, 5600);
    });

  })();

  /* ---------- night drive: a gentle driving game — collect stars, steer round cones, nothing ever crashes ---------- */
  (() => {
    const box = document.getElementById("racer"), cv = document.getElementById("racerCanvas"), g = cv.getContext("2d");
    const scoreEl = document.getElementById("rcScore"), timeEl = document.getElementById("rcTime"), startEl = document.getElementById("rcStart");
    const ROUND = 120, LANES = 3;
    let playing = false, visible = false, t0 = 0, last = 0, speed = 1, lane = 1, carX = 0, items = [], stars = 0, road = 0, nextItem = 0, slow = 0, wobble = 0, pausedAt = 0;
    const W = () => box.clientWidth, H = () => box.clientHeight;
    const size = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = W() * d; cv.height = H() * d; g.setTransform(d, 0, 0, d, 0, 0); };
    const roadL = () => W() * 0.12, roadW = () => W() * 0.76, laneX = (i) => roadL() + roadW() * (i + 0.5) / LANES;
    startEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-speed]"); if (!b) return;
      speed = Number(b.dataset.speed);
      b.parentElement.querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    });
    const steer = (dir) => { if (playing) lane = Math.max(0, Math.min(LANES - 1, lane + dir)); };
    cv.addEventListener("pointerdown", (e) => { const r = cv.getBoundingClientRect(); steer(e.clientX - r.left < r.width / 2 ? -1 : 1); });
    document.addEventListener("keydown", (e) => {
      if (!playing || !visible) return;
      if (e.key === "ArrowLeft" || e.key === "a") { steer(-1); e.preventDefault(); }
      if (e.key === "ArrowRight" || e.key === "d") { steer(1); e.preventDefault(); }
    });

    const star = (x, y, r, spin) => {
      g.beginPath();
      for (let i = 0; i < 10; i++) { const a = spin + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.sin(a) * rr, y - Math.cos(a) * rr); }
      g.closePath();
    };
    const draw = (t) => {
      const w = W(), h = H(), rl = roadL(), rw = roadW();
      // night, verges, road
      const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#0b1030"); sky.addColorStop(1, "#141a3a");
      g.fillStyle = sky; g.fillRect(0, 0, w, h);
      g.fillStyle = "#13261f"; g.fillRect(0, 0, rl - 6, h); g.fillRect(rl + rw + 6, 0, w - rl - rw - 6, h);
      g.fillStyle = "#262a3b"; g.fillRect(rl, 0, rw, h);
      g.fillStyle = "rgba(255,255,255,.75)"; g.fillRect(rl - 6, 0, 4, h); g.fillRect(rl + rw + 2, 0, 4, h);
      g.fillStyle = "rgba(255,255,255,.55)";
      for (let i = 1; i < LANES; i++) { const x = rl + (rw * i) / LANES - 2; for (let y = (road % 60) - 60; y < h; y += 60) g.fillRect(x, y, 4, 30); }
      // street lamps pooling warm light on the verges
      for (let y = (road * 1 % 220) - 220; y < h + 40; y += 220) [rl - 20, rl + rw + 20].forEach((x) => {
        const glow = g.createRadialGradient(x, y, 0, x, y, 70); glow.addColorStop(0, "rgba(255,200,120,.45)"); glow.addColorStop(1, "rgba(255,200,120,0)");
        g.fillStyle = glow; g.beginPath(); g.arc(x, y, 70, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ffe2a8"; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
      });
      // stars to collect, cones to dodge
      items.forEach((it) => {
        if (it.got) return;
        const x = laneX(it.lane);
        if (it.type === "star") {
          const glow = g.createRadialGradient(x, it.y, 0, x, it.y, 30); glow.addColorStop(0, "rgba(255,235,140,.6)"); glow.addColorStop(1, "rgba(255,235,140,0)");
          g.fillStyle = glow; g.beginPath(); g.arc(x, it.y, 30, 0, Math.PI * 2); g.fill();
          g.fillStyle = "#ffe680"; star(x, it.y, 13, t * 2); g.fill();
        } else {
          g.fillStyle = "#ff8a3d"; g.beginPath(); g.moveTo(x, it.y - 18); g.lineTo(x + 13, it.y + 14); g.lineTo(x - 13, it.y + 14); g.closePath(); g.fill();
          g.fillStyle = "#fff"; g.fillRect(x - 7, it.y - 2, 14, 5);
          g.fillStyle = "#c95a1d"; g.fillRect(x - 16, it.y + 13, 32, 5);
        }
      });
      // your car, with headlights reaching up the road
      const cy = h * 0.8, cx = carX + Math.sin(t * 30) * wobble * 4;
      const beam = g.createLinearGradient(0, cy - 160, 0, cy - 30); beam.addColorStop(0, "rgba(255,250,210,0)"); beam.addColorStop(1, "rgba(255,250,210,.35)");
      g.fillStyle = beam; g.beginPath(); g.moveTo(cx - 12, cy - 30); g.lineTo(cx - 46, cy - 170); g.lineTo(cx + 46, cy - 170); g.lineTo(cx + 12, cy - 30); g.closePath(); g.fill();
      g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.ellipse(cx, cy + 30, 22, 8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#ff6f8e"; g.beginPath(); g.roundRect(cx - 19, cy - 32, 38, 64, 10); g.fill();
      g.fillStyle = "#1b2035"; g.beginPath(); g.roundRect(cx - 14, cy - 18, 28, 14, 4); g.fill(); g.beginPath(); g.roundRect(cx - 14, cy + 10, 28, 11, 4); g.fill();
      g.fillStyle = "#fff8d0"; g.fillRect(cx - 15, cy - 32, 8, 4); g.fillRect(cx + 7, cy - 32, 8, 4);
      g.fillStyle = "#ff3355"; g.fillRect(cx - 15, cy + 29, 8, 3); g.fillRect(cx + 7, cy + 29, 8, 3);
    };
    const frame = (now) => {
      if (!playing) return;
      const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
      const left = Math.max(0, ROUND - t), k = t / ROUND;
      timeEl.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
      const v = (230 + k * 170) * speed * (slow > 0 ? 0.5 : 1);
      slow = Math.max(0, slow - dt); wobble = Math.max(0, wobble - dt * 2);
      road += v * dt;
      carX += (laneX(lane) - carX) * Math.min(1, dt * 12);
      if (t >= nextItem) {
        const free = [0, 1, 2].filter((l) => !items.some((it) => it.lane === l && it.y < 60));
        if (free.length) items.push({ lane: free[Math.floor(Math.random() * free.length)], y: -30, type: Math.random() < 0.62 ? "star" : "cone" });
        nextItem = t + Math.max(0.35, 0.95 - k * 0.4) / Math.sqrt(speed) * (0.7 + Math.random() * 0.6);
      }
      const cy = H() * 0.8;
      items.forEach((it) => {
        it.y += v * dt;
        if (!it.got && Math.abs(it.y - cy) < 34 && Math.abs(laneX(it.lane) - carX) < 30) {
          it.got = true;
          if (it.type === "star") { stars++; S.twinkle(); scoreEl.textContent = `${stars} star${stars === 1 ? "" : "s"}`; }
          else { slow = 0.8; wobble = 1; S.bump(); }
        }
      });
      items = items.filter((it) => it.y < H() + 40);
      draw(t);
      if (left <= 0) return finish();
      if (visible && !document.hidden) requestAnimationFrame(frame); else pausedAt = performance.now();
    };
    const resume = () => { if (playing && pausedAt) { t0 += performance.now() - pausedAt; last = performance.now(); pausedAt = 0; requestAnimationFrame(frame); } };
    const finish = () => {
      playing = false;
      const speeds = document.getElementById("rcSpeeds").outerHTML;
      startEl.innerHTML = `<h3>${stars} star${stars === 1 ? "" : "s"} collected</h3><p>Two minutes of open road. How are you feeling now?</p>
        ${speeds}<div class="lg-again"><button class="btn btn-solid" id="rcPlay">Drive again</button></div>`;
      startEl.hidden = false;
      document.getElementById("rcPlay").addEventListener("click", play);
    };
    function play() {
      size(); items = []; stars = 0; lane = 1; carX = laneX(1); slow = wobble = 0; road = 0; scoreEl.textContent = "0 stars";
      startEl.hidden = true; playing = true; pausedAt = 0; t0 = last = performance.now(); nextItem = 0.6;
      requestAnimationFrame(frame);
    }
    document.getElementById("rcPlay").addEventListener("click", play);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { size(); if (!playing) { carX = laneX(1); draw(0); } resume(); } }).observe(box);
    window.addEventListener("resize", () => { size(); if (!playing) { carX = laneX(lane); draw(0); } });
  })();

  /* ---------- make a pizza: pick a topping, tap to place it, bake ---------- */
  (() => {
    const base = document.getElementById("pzBase"), tops = document.getElementById("pzTops"), tray = document.getElementById("pzTray"), msg = document.getElementById("pzMsg");
    const toppings = [["pepperoni", "Pepperoni"], ["mushroom", "Mushroom"], ["olive", "Olives"], ["pepper", "Peppers"], ["basil", "Basil"],
      ["onion", "Red onion"], ["pineapple", "Pineapple"], ["corn", "Sweetcorn"], ["tomato", "Tomato"], ["paneer", "Paneer"]];
    let current = toppings[0][0], baked = false, baking = false;
    tray.innerHTML = toppings.map(([k, label], i) => `<button type="button" role="radio" data-t="${k}" aria-checked="${i === 0}"><i class="tp tp-${k}"></i><span>${label}</span></button>`).join("");
    tray.addEventListener("click", (e) => {
      const b = e.target.closest("[data-t]"); if (!b) return;
      current = b.dataset.t;
      tray.querySelectorAll("[data-t]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    });
    const place = (x, y) => {
      if (baking) return;
      if (Math.hypot(x - 50, y - 50) > 41) return; // keep toppings off the crust
      const t = document.createElement("i");
      t.className = `tp tp-${current} placed`;
      t.style.left = `${x}%`; t.style.top = `${y}%`; t.style.setProperty("--r", `${Math.round(Math.random() * 360)}deg`);
      tops.appendChild(t);
      S.pop(0.9);
      if (baked) { baked = false; base.classList.remove("baked"); msg.textContent = "Adding more? Bake it again when you're ready."; }
    };
    base.addEventListener("click", (e) => {
      const r = base.getBoundingClientRect();
      place(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
    });
    document.getElementById("pzSprinkle").addEventListener("click", () => {
      for (let i = 0; i < 7; i++) setTimeout(() => { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 38; place(50 + Math.cos(a) * d, 50 + Math.sin(a) * d); }, i * 70);
    });
    document.getElementById("pzBake").addEventListener("click", () => {
      if (baking) return;
      baking = true; base.classList.remove("baked"); base.classList.add("baking");
      msg.textContent = "Into the oven…";
      S.sizzle();
      setTimeout(() => {
        baking = false; baked = true;
        base.classList.remove("baking"); base.classList.add("baked");
        const n = tops.children.length;
        const kinds = new Set([...tops.children].map((t) => t.classList[1])).size;
        msg.textContent = n
          ? `Golden and bubbling, with ${kinds} kind${kinds === 1 ? "" : "s"} of topping. You made that.`
          : "A classic cheese pizza, golden and bubbling. You made that.";
        S.chime();
      }, 2400);
    });
    document.getElementById("pzNew").addEventListener("click", () => {
      if (baking) return;
      tops.innerHTML = ""; baked = false; base.classList.remove("baked");
      msg.textContent = "Fresh dough, ready for toppings.";
    });
  })();

  /* ---------- colour it in: line-art pictures where every shape can be tapped and filled ---------- */
  (() => {
    const art = document.getElementById("colourArt"), pal = document.getElementById("palette"), pages = document.getElementById("colourPages");
    const colours = ["#ffffff", "#ffd1dc", "#ff8fab", "#e8455f", "#ffb38a", "#ffd166", "#fff1a8", "#c8e6a0", "#7cc68d", "#2f9e7a",
      "#a8dcf0", "#5aa9e6", "#3d5a99", "#cdb4f5", "#9b72cf", "#8a5a44", "#f4e3c8", "#2b2540"];
    let colour = colours[2], page = "mandala", seed = 1;
    pal.innerHTML = colours.map((c, i) => `<button type="button" role="radio" style="--c:${c}" data-c="${c}" aria-label="${i === 0 ? "White (rubber)" : `Colour ${i}`}" aria-checked="${c === colour}"></button>`).join("");
    pal.addEventListener("click", (e) => {
      const b = e.target.closest("[data-c]"); if (!b) return;
      colour = b.dataset.c;
      pal.querySelectorAll("[data-c]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    });
    const rng = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
    const petal = (r0, r1, w) => `M0 ${-r0}C${w} ${-(r0 + (r1 - r0) * 0.25)} ${w} ${-(r0 + (r1 - r0) * 0.8)} 0 ${-r1}C${-w} ${-(r0 + (r1 - r0) * 0.8)} ${-w} ${-(r0 + (r1 - r0) * 0.25)} 0 ${-r0}Z`;
    const ring = (n, d, off = 0) => Array.from({ length: n }, (_, i) => `<path class="rg" d="${d}" transform="translate(200 200) rotate(${off + (i * 360) / n})"/>`).join("");
    const dots = (n, rad, size, off = 0) => Array.from({ length: n }, (_, i) => { const a = ((off + (i * 360) / n) * Math.PI) / 180; return `<circle class="rg" cx="${200 + Math.sin(a) * rad}" cy="${200 - Math.cos(a) * rad}" r="${size}"/>`; }).join("");
    const circ = (r) => `<circle class="rg" cx="200" cy="200" r="${r}"/>`;
    const make = {
      mandala(r) {
        const n1 = pick(r, [12, 14, 16, 18]), n2 = pick(r, [8, 10, 12]), n3 = pick(r, [6, 8]);
        return `<rect class="rg" width="400" height="400"/>` + circ(192) + dots(n1, 182, 6, 180 / n1) +
          ring(n1, petal(104, 186, 24 + r() * 8)) + ring(n1, petal(98, 160, 14), 180 / n1) + circ(108) +
          dots(n2 * 2, 96, 5) + ring(n2, petal(48, 104, 22 + r() * 6)) + ring(n2, petal(46, 84, 11), 180 / n2) + circ(50) +
          ring(n3, petal(14, 48, 13)) + circ(15) + `<circle class="rg" cx="200" cy="200" r="6"/>`;
      },
      flower(r) {
        const n = pick(r, [8, 10, 12]), cx = 200, cy = 150;
        const petals = Array.from({ length: n }, (_, i) => `<ellipse class="rg" cx="${cx}" cy="${cy - 52}" rx="22" ry="44" transform="rotate(${(i * 360) / n} ${cx} ${cy})"/>`).join("");
        const small = (x, y, k) => Array.from({ length: k }, (_, i) => `<ellipse class="rg" cx="${x}" cy="${y - 14}" rx="8" ry="13" transform="rotate(${(i * 360) / k} ${x} ${y})"/>`).join("") + `<circle class="rg" cx="${x}" cy="${y}" r="7"/>`;
        const grass = Array.from({ length: 16 }, (_, i) => { const x = i * 26 + 4; return `<path class="rg" d="M${x} 300L${x + 8} ${268 - (i % 3) * 8}L${x + 16} 300Z"/>`; }).join("");
        const rays = Array.from({ length: 10 }, (_, i) => `<path class="rg" d="M336 22L344 4L352 22Z" transform="rotate(${i * 36} 344 64)"/>`).join("");
        return `<rect class="rg" width="400" height="300"/><rect class="rg" y="296" width="400" height="104"/>` + rays + `<circle class="rg" cx="344" cy="64" r="28"/>` +
          `<path class="rg" d="M40 80a22 22 0 0 1 40-12a26 26 0 0 1 48 8a18 18 0 0 1 2 34H44a20 20 0 0 1-4-30z"/>` +
          `<path class="rg" d="M194 196C190 250 204 300 198 360h10C214 300 200 250 206 196z"/>` +
          `<path class="rg" d="M202 268C230 236 270 232 292 246C268 272 230 282 202 268z"/><path class="rg" d="M200 300C172 270 132 268 110 282C134 306 172 314 200 300z"/>` +
          grass + petals + `<circle class="rg" cx="${cx}" cy="${cy}" r="30"/><circle class="rg" cx="${cx}" cy="${cy}" r="14"/>` +
          small(70, 330, 5 + Math.floor(r() * 2)) + small(330, 340, 5 + Math.floor(r() * 2)) + small(285, 315, 6);
      },
      butterfly(r) {
        const spots = (side) => Array.from({ length: 3 + Math.floor(r() * 2) }, (_, i) => {
          const x = 200 + side * (60 + i * 26 + r() * 10), y = 140 + i * 14 + r() * 20;
          return `<circle class="rg" cx="${x}" cy="${y}" r="${9 + r() * 7}"/>`;
        }).join("");
        const wing = (side) => {
          const s = (x) => 200 + side * x;
          return `<path class="rg" d="M${s(8)} 190C${s(40)} 120 ${s(110)} 50 ${s(170)} 70C${s(200)} 90 ${s(180)} 160 ${s(130)} 196C${s(90)} 214 ${s(40)} 210 ${s(8)} 200Z"/>` +
            `<path class="rg" d="M${s(20)} 188C${s(50)} 140 ${s(100)} 100 ${s(140)} 108C${s(150)} 140 ${s(120)} 176 ${s(80)} 192Z"/>` +
            `<path class="rg" d="M${s(8)} 208C${s(50)} 212 ${s(130)} 220 ${s(140)} 270C${s(146)} 316 ${s(90)} 330 ${s(60)} 300C${s(36)} 276 ${s(20)} 240 ${s(8)} 214Z"/>` +
            `<path class="rg" d="M${s(26)} 222C${s(60)} 226 ${s(110)} 240 ${s(112)} 270C${s(112)} 296 ${s(80)} 296 ${s(64)} 276Z"/>` + spots(side);
        };
        return `<rect class="rg" width="400" height="400"/>` + wing(-1) + wing(1) +
          `<path class="ln" d="M196 120C188 96 176 80 160 70M204 120C212 96 224 80 240 70"/><circle class="rg" cx="160" cy="70" r="5"/><circle class="rg" cx="240" cy="70" r="5"/>` +
          `<ellipse class="rg" cx="200" cy="210" rx="9" ry="78"/><circle class="rg" cx="200" cy="124" r="13"/>`;
      },
    };
    const draw = () => {
      art.innerHTML = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A ${page} to colour in">${make[page](rng(seed))}</svg>`;
    };
    art.addEventListener("click", (e) => {
      const shape = e.target.closest(".rg"); if (!shape) return;
      shape.style.fill = colour;
      S.pop(0.95);
    });
    pages.addEventListener("click", (e) => {
      const b = e.target.closest("[data-page]"); if (!b) return;
      page = b.dataset.page;
      pages.querySelectorAll("[data-page]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      draw();
    });
    document.getElementById("colourNew").addEventListener("click", () => { seed = Math.floor(Math.random() * 1e9); draw(); });
    document.getElementById("colourClear").addEventListener("click", () => art.querySelectorAll(".rg").forEach((el) => { el.style.fill = ""; }));
    // save as a picture: the drawing is turned into a PNG the browser downloads
    document.getElementById("colourSave").addEventListener("click", () => {
      const svg = art.querySelector("svg").cloneNode(true);
      svg.setAttribute("width", "1200"); svg.setAttribute("height", "1200");
      svg.querySelectorAll(".rg").forEach((el) => { el.setAttribute("fill", el.style.fill || "#ffffff"); el.setAttribute("stroke", "#2b2540"); el.setAttribute("stroke-width", "1.6"); el.setAttribute("stroke-linejoin", "round"); });
      svg.querySelectorAll(".ln").forEach((el) => { el.setAttribute("fill", "none"); el.setAttribute("stroke", "#2b2540"); el.setAttribute("stroke-width", "2"); });
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = c.height = 1200;
        c.getContext("2d").drawImage(img, 0, 0);
        c.toBlob((blob) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob); a.download = `bloom-${page}.png`;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        });
      };
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    });
    draw();
  })();

  /* ---------- something gentle to watch, and a karaoke zone ---------- */
  (() => {
    const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const groups = [
      { title: "Breathe and settle", note: "Short guided meditations for anxious moments.", more: ["More meditations", yt("10 minute guided meditation for anxiety")],
        videos: [["syx3a1_LeFo", "Daily Calm: 10-minute mindfulness, letting go", "Calm"], ["sG7DBA-mgFY", "10-minute meditation to reframe stress", "Headspace"], ["O-6f5wQXSu8", "10-minute meditation for anxiety", "Goodful"]] },
      { title: "Drift off with Michael Sealey", note: "Gentle sleep hypnotherapy. Listen lying down — never while driving.", more: ["Michael Sealey's channel", "https://www.youtube.com/@MichaelSealey"],
        videos: [["hvOgpzRJxJg", "Sleep hypnosis for anxiety reduction", "Michael Sealey"], ["twJyV6EX49E", "Sleep hypnosis to calm an anxious mind", "Michael Sealey"], ["L15yjmB7uHM", "Fall asleep fast, release all thoughts (rain)", "Michael Sealey"]] },
      { title: "Just smile", note: "Giggling babies and very small dogs. Medicine of a different kind.", more: ["More cute videos", yt("cute puppies and babies laughing compilation")],
        videos: [["ZndDultZUKg", "Babies laughing with pets", "The Pet Collective"], ["TisotBmWaps", "The best baby laughing compilation", "5-Minute Fails"], ["pxn0wL_uSm4", "30 minutes of the cutest puppies", "The Pet Collective"]] },
    ];
    document.getElementById("watchGroups").innerHTML = groups.map((gr) => `<div class="watch-group reveal">
        <div class="wg-head"><div><h3>${esc(gr.title)}</h3><p>${esc(gr.note)}</p></div><a class="chip" href="${esc(gr.more[1])}" target="_blank" rel="noopener">${esc(gr.more[0])} ↗</a></div>
        <div class="vids">${gr.videos.map(([id, title, by]) => `<a class="vid" href="https://www.youtube.com/watch?v=${id}" target="_blank" rel="noopener">
          <span class="vid-thumb"><img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy"><i class="vid-play" aria-hidden="true"></i></span>
          <span class="vid-title">${esc(title)}</span><span class="vid-by">${esc(by)}</span></a>`).join("")}</div></div>`).join("");

    const songs = [["Closer", "The Chainsmokers ft. Halsey"], ["Cheap Thrills", "Sia"], ["Cake by the Ocean", "DNCE"], ["Can't Stop the Feeling!", "Justin Timberlake"],
      ["This Is What You Came For", "Calvin Harris ft. Rihanna"], ["Work from Home", "Fifth Harmony"], ["Treat You Better", "Shawn Mendes"], ["Into You", "Ariana Grande"],
      ["Send My Love (To Your New Lover)", "Adele"], ["Starboy", "The Weeknd ft. Daft Punk"], ["Don't Let Me Down", "The Chainsmokers ft. Daya"], ["Love Yourself", "Justin Bieber"],
      ["Hymn for the Weekend", "Coldplay"], ["7 Years", "Lukas Graham"], ["Side to Side", "Ariana Grande ft. Nicki Minaj"], ["Cold Water", "Major Lazer ft. Justin Bieber & MØ"]];
    const list = document.getElementById("karList");
    list.innerHTML = songs.map(([t, a]) => `<li><a href="${esc(yt(`${t} ${a} karaoke lyrics`))}" target="_blank" rel="noopener">
        <span class="kar-title">${esc(t)}</span><span class="kar-artist">${esc(a)}</span><span class="kar-go" aria-hidden="true">Sing ↗</span></a></li>`).join("");
    document.getElementById("karShuffle").addEventListener("click", () => {
      const items = [...list.children];
      items.forEach((li) => li.classList.remove("picked"));
      let n = 0;
      const pick = Math.floor(Math.random() * items.length), spins = 10 + pick;
      const tick = () => {                                           // a little spotlight roulette before it lands
        items.forEach((li) => li.classList.remove("flash"));
        items[n % items.length].classList.add("flash");
        S.key(true);
        if (n < spins) { n++; setTimeout(tick, 40 + n * 6); }
        else { items[n % items.length].classList.remove("flash"); items[n % items.length].classList.add("picked"); items[n % items.length].querySelector("a").focus({ preventScroll: true }); S.chime(); }
      };
      tick();
    });
  })();

  /* ---------- resources: community, bookshelf, podcasts, research ---------- */
  (() => {
    const R = window.BLOOM_RESOURCES;
    if (!R) return;
    document.getElementById("commList").innerHTML = R.communities.map((c) =>
      `<a class="comm reveal" href="${esc(c.url)}" target="_blank" rel="noopener"><span class="logo reddit" aria-hidden="true">r/</span><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p><span class="go">Open on Reddit ↗</span></a>`).join("");
    document.getElementById("shelf").innerHTML = R.books.map((b) =>
      `<a class="book" href="${esc(b.url || `https://openlibrary.org/isbn/${b.isbn}`)}" target="_blank" rel="noopener">
        <span class="cover"><img src="${esc(b.cover || `https://covers.openlibrary.org/b/isbn/${b.isbn}-L.jpg`)}" alt="Cover of ${esc(b.title)}" loading="lazy"></span>
        <h3>${esc(b.title)}</h3><p class="by">${esc(b.author)}</p><p>${esc(b.note)}</p></a>`).join("");
    document.getElementById("podList").innerHTML = R.podcasts.map((p) =>
      `<a class="pod reveal" href="${esc(p.url)}" target="_blank" rel="noopener">
        <span class="pod-cover"><img src="${esc(p.cover)}" alt="" loading="lazy"></span>
        <span class="pod-body"><h3>${esc(p.name)}</h3><p class="by">${esc(p.host)}</p><p>${esc(p.desc)}</p></span>
        <span class="go">Listen on Spotify ↗</span></a>`).join("");
    document.getElementById("papers").innerHTML = R.research.map((r) =>
      `<li class="paper reveal"><span class="topic">${esc(r.topic)}</span>
        <h3>${esc(r.title)}</h3>
        <p class="plain">${esc(r.plain)}</p>
        <p class="meta">${esc(r.authors)} · ${esc(r.journal)} · ${r.year}</p>
        <a class="chip" href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener">Read the paper ↗</a></li>`).join("");

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

  /* ---------- gentle email check-ins and pay-what-you-can donations (settings live in shared/config.js) ---------- */
  (() => {
    const C = window.BLOOM_CONFIG || {};
    const form = document.getElementById("stayForm"), smsg = document.getElementById("stayMsg");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!C.emailFormAction) {
        smsg.textContent = "Thank you for wanting to stay in touch. Email check-ins are opening very soon — your address hasn't been saved or sent anywhere yet.";
        return;
      }
      // hand the sign-up to the email service in a new tab, so its own confirmation step can run
      const f = document.createElement("form");
      f.method = "post"; f.action = C.emailFormAction; f.target = "_blank";
      const add = (name, value) => { const i = document.createElement("input"); i.type = "hidden"; i.name = name; i.value = value; f.appendChild(i); };
      add("email", form.email.value.trim());
      if (form.checkin.checked) add("tag", "check-in");
      if (form.updates.checked) add("tag", "updates");
      document.body.appendChild(f); f.submit(); f.remove();
      smsg.textContent = "Nearly there — check your inbox to confirm. Thank you for being here.";
      form.reset();
    });

    const currencies = { USD: ["$", [3, 5, 10, 25]], GBP: ["£", [3, 5, 10, 25]], EUR: ["€", [3, 5, 10, 25]], INR: ["₹", [100, 250, 500, 1000]], AUD: ["A$", [5, 10, 20, 40]], CAD: ["C$", [5, 10, 20, 40]] };
    const zone = (Intl.DateTimeFormat().resolvedOptions().timeZone || ""), lang = navigator.language || "";
    let cur = /Kolkata|Calcutta/.test(zone) ? "INR" : /London/.test(zone) || /-GB/.test(lang) ? "GBP" : /^Australia/.test(zone) ? "AUD"
      : /Toronto|Vancouver|Edmonton|Winnipeg|Halifax/.test(zone) ? "CAD" : /^Europe/.test(zone) ? "EUR" : "USD";
    let amount = null;
    const curEl = document.getElementById("currency"), amtEl = document.getElementById("amounts"), custom = document.getElementById("customAmt");
    const dmsg = document.getElementById("donateMsg"), upiBtn = document.getElementById("payUpi");
    const render = () => {
      const [sym, list] = currencies[cur];
      curEl.innerHTML = Object.keys(currencies).map((k) => `<button type="button" role="radio" data-cur="${k}" aria-checked="${k === cur}">${k}</button>`).join("");
      amtEl.innerHTML = list.map((a) => `<button type="button" role="radio" data-amt="${a}" aria-checked="${a === amount}">${sym}${a}</button>`).join("");
      document.getElementById("curSym").textContent = sym;
      upiBtn.hidden = !(cur === "INR" && C.upiId);
    };
    curEl.addEventListener("click", (e) => { const b = e.target.closest("[data-cur]"); if (!b) return; cur = b.dataset.cur; amount = null; custom.value = ""; render(); });
    amtEl.addEventListener("click", (e) => { const b = e.target.closest("[data-amt]"); if (!b) return; amount = Number(b.dataset.amt); custom.value = ""; render(); });
    custom.addEventListener("input", () => { amount = Number(custom.value) > 0 ? Number(custom.value) : null; amtEl.querySelectorAll("[data-amt]").forEach((x) => x.setAttribute("aria-checked", "false")); });
    const soon = () => { dmsg.textContent = "Thank you so much for thinking of it. Donations are opening very soon."; };
    document.getElementById("payPal").addEventListener("click", () => {
      if (!C.paypalMe) return soon();
      const url = `https://www.paypal.com/paypalme/${encodeURIComponent(C.paypalMe)}${amount ? `/${amount}${cur}` : ""}`;
      window.open(url, "_blank", "noopener");
      dmsg.textContent = "PayPal has opened in a new tab. Thank you — truly.";
    });
    upiBtn.addEventListener("click", () => {
      if (!C.upiId) return soon();
      location.href = `upi://pay?pa=${encodeURIComponent(C.upiId)}&pn=${encodeURIComponent(C.upiName || "Bloom Within")}&cu=INR${amount ? `&am=${amount}` : ""}`;
      dmsg.textContent = "Opening your UPI app… (this works on phones with a UPI app installed). Thank you!";
    });
    render();
  })();
})();
