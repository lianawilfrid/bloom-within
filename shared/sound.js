// Every sound on the page is made live with the Web Audio API — no recordings to download.
// Effects and music each have their own switch, and one button turns everything off.
window.BLOOM_SOUND = (() => {
  const st = { sfx: true, music: false, vol: 0.7 };
  try { Object.assign(st, JSON.parse(localStorage.getItem("bloom-sound") || "{}")); } catch (e) {}
  const save = () => { try { localStorage.setItem("bloom-sound", JSON.stringify(st)); } catch (e) {} };
  const subs = [];
  const changed = () => { save(); subs.forEach((fn) => fn(st)); };

  let ctx = null, master, sfxBus, sfxWet, musicBus, musicWet, white, brown;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // a soft room: decaying noise as the reverb's impulse response
  const impulse = (secs, decay) => {
    const len = Math.round(ctx.sampleRate * secs), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  };
  const noiseBuffer = (secs, kind) => {
    const len = Math.round(ctx.sampleRate * secs), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  };
  const bus = (wetAmount) => {
    const dry = ctx.createGain(), verb = ctx.createConvolver(), wet = ctx.createGain();
    verb.buffer = impulse(3.4, 2.4); wet.gain.value = wetAmount;
    wet.connect(verb); verb.connect(dry); dry.connect(master);
    return [dry, wet];
  };

  function ensure() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = st.vol;
    master.connect(comp); comp.connect(ctx.destination);
    [sfxBus, sfxWet] = bus(1);
    [musicBus, musicWet] = bus(1);
    sfxBus.gain.value = st.sfx ? 1 : 0;
    musicBus.gain.value = 0;
    white = noiseBuffer(2, "white"); brown = noiseBuffer(6, "brown");
    if (st.music) music.start();
    return ctx;
  }
  // browsers only allow sound after a tap or key press
  const unlock = () => { ensure(); };
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));

  const ready = () => st.sfx && st.vol > 0 && ensure();

  // ---- building blocks ----
  const tone = ({ f, to, type = "sine", at = 0, a = 0.005, d = 0.3, g = 0.3, wet = 0.2, out }) => {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), v = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + Math.min(d, 0.12));
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + a); v.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    o.connect(v); v.connect(out ? out[0] : sfxBus);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; v.connect(w); w.connect(out ? out[1] : sfxWet); }
    o.start(t); o.stop(t + a + d + 0.05);
  };
  const hiss = ({ at = 0, dur = 0.05, type = "bandpass", f = 2000, fTo, q = 1, g = 0.5, a = 0.002, wet = 0.1 }) => {
    const t = ctx.currentTime + at, s = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), v = ctx.createGain();
    s.buffer = white; s.loop = true;
    flt.type = type; flt.frequency.setValueAtTime(f, t); flt.Q.value = q;
    if (fTo) flt.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + a); v.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
    s.connect(flt); flt.connect(v); v.connect(sfxBus);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; v.connect(w); w.connect(sfxWet); }
    s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
  };

  // ---- effects ----
  const fx = {
    // a drop landing on still water: the pitch rises as the bubble closes
    drop(strength = 1) {
      if (!ready()) return;
      const f = rand(380, 560) / Math.sqrt(strength);
      tone({ f, to: f * rand(2.4, 3.2), d: 0.09 + strength * 0.05, g: 0.28 * Math.min(1.4, strength), wet: 0.45 });
      hiss({ dur: 0.04, f: 1200, q: 0.7, g: 0.05 * strength, wet: 0.2 });
    },
    // bubble wrap: a tight click, a puff of escaping air and a soft thump, tuned by bubble size (0 small → 1 big)
    pop(size = Math.random()) {
      if (!ready()) return;
      const kind = Math.random();
      const bright = 1 - size;
      hiss({ dur: 0.004, type: "highpass", f: 3500, g: 0.9, wet: 0.02 });                                  // the skin giving way
      hiss({ dur: 0.02 + size * 0.05, f: 900 + bright * 2600 + rand(-200, 200), q: 1.1, g: 0.75, wet: 0.12 }); // air rushing out
      tone({ f: 90 + bright * 140 + rand(-15, 15), to: 45, d: 0.05 + size * 0.05, g: 0.28 + size * 0.2, wet: 0 }); // the thump in your fingers
      if (kind < 0.18) tone({ f: rand(1400, 2200), to: rand(2600, 3400), at: 0.004, d: 0.05, g: 0.05, wet: 0.1 }); // a squeaky one
      else if (kind < 0.32) {                                                                                  // a double pop
        hiss({ at: rand(0.035, 0.07), dur: 0.018, f: 1400 + bright * 2000, q: 1.2, g: 0.45, wet: 0.1 });
      }
      hiss({ at: 0.01, dur: 0.09, type: "lowpass", f: 700, g: 0.08, wet: 0.25 });                              // a little room tail
    },
    // a mechanical keyboard: a deep thock going down, a lighter clack coming up
    key(up = false) {
      if (!ready()) return;
      if (up) { hiss({ dur: 0.008, f: rand(3000, 4200), q: 2, g: 0.25, wet: 0.03 }); return; }
      hiss({ dur: 0.012, f: rand(1800, 2600), q: 1.6, g: 0.6, wet: 0.04 });
      tone({ f: rand(150, 190), to: 95, d: 0.06, g: 0.32, wet: 0 });
    },
    // slime: wet squelches with little bubbles bursting
    slime(amount = 1) {
      if (!ready()) return;
      hiss({ dur: 0.12 + amount * 0.1, type: "lowpass", f: 300, fTo: 1300, q: 3, g: 0.35 * amount, a: 0.02, wet: 0.05 });
      for (let i = 0; i < 2 + amount * 3; i++) { const f = rand(220, 520); tone({ f, to: f * rand(1.6, 2.4), at: Math.random() * 0.15, d: 0.045, g: 0.08, wet: 0.08 }); }
    },
    // a rain stick tipping over: thousands of seeds tumbling, thinning out as they settle
    rainstick() {
      if (!ready()) return;
      const len = 2.6;
      hiss({ dur: len, type: "bandpass", f: 5200, q: 0.8, g: 0.06, a: 0.3, wet: 0.3 });
      for (let i = 0; i < 160; i++) { const at = Math.pow(Math.random(), 1.6) * len; hiss({ at, dur: 0.006, f: rand(2500, 8000), q: 4, g: rand(0.04, 0.16) * (1 - at / len * 0.7), wet: 0.25 }); }
    },
    // wind chimes: metal tubes with long, shimmering rings
    windchime(f) {
      if (!ready()) return;
      [[1, 0.14, 3.2], [2.76, 0.05, 1.8], [5.4, 0.025, 0.9]].forEach(([m, g, d]) => { tone({ f: f * m, d, g, wet: 0.7 }); tone({ f: f * m * 1.003, d, g: g * 0.6, wet: 0.7 }); });
    },
    // opening a fizzy can: a pssst, then bubbles rising
    soda() {
      if (!ready()) return;
      hiss({ dur: 0.012, type: "highpass", f: 2000, g: 0.7, wet: 0.02 });
      hiss({ at: 0.01, dur: 0.45, type: "highpass", f: 3000, fTo: 5000, g: 0.4, a: 0.004, wet: 0.08 });
      for (let i = 0; i < 90; i++) hiss({ at: 0.3 + Math.random() * 3, dur: 0.004, f: rand(3000, 9000), q: 5, g: rand(0.03, 0.1), wet: 0.15 });
    },
    // striking a match: a rough scrape, the flare, then quiet crackles
    match() {
      if (!ready()) return;
      hiss({ dur: 0.16, type: "bandpass", f: 1600, fTo: 3200, q: 1.5, g: 0.5, a: 0.01, wet: 0.05 });
      for (let i = 0; i < 14; i++) hiss({ at: Math.random() * 0.16, dur: 0.006, f: rand(2000, 6000), q: 3, g: rand(0.1, 0.3), wet: 0 });
      hiss({ at: 0.15, dur: 0.6, type: "lowpass", f: 500, fTo: 1400, g: 0.45, a: 0.03, wet: 0.1 });
      for (let i = 0; i < 10; i++) hiss({ at: 0.5 + Math.random() * 1.6, dur: 0.005, f: rand(1500, 4000), q: 4, g: rand(0.05, 0.15), wet: 0.05 });
    },
    // a pizza in a hot oven
    sizzle() {
      if (!ready()) return;
      hiss({ dur: 2.2, type: "highpass", f: 4000, g: 0.12, a: 0.3, wet: 0.1 });
      for (let i = 0; i < 70; i++) hiss({ at: Math.random() * 2.4, dur: 0.005, f: rand(3000, 8000), q: 4, g: rand(0.04, 0.14), wet: 0.05 });
    },
    // a soft bump in the driving game
    bump() {
      if (!ready()) return;
      tone({ f: 120, to: 60, d: 0.12, g: 0.35, wet: 0.05 });
      hiss({ dur: 0.05, type: "lowpass", f: 900, g: 0.3, wet: 0 });
    },
    // a lantern catching light: a small bell
    chime() {
      if (!ready()) return;
      const f = pick([523.25, 587.33, 659.25, 783.99, 880, 1046.5]);
      [[1, 0.22, 2.4], [2.76, 0.06, 1.2], [5.4, 0.025, 0.6]].forEach(([m, g, d]) => tone({ f: f * m, a: 0.004, d, g, wet: 0.6 }));
    },
    // fireflies saying thank you
    twinkle() {
      if (!ready()) return;
      [0, 0.07, 0.15].forEach((at, i) => tone({ f: pick([1760, 2093, 2349, 2637]) * (1 + i * 0.01), at, d: 0.35, g: 0.05, wet: 0.7 }));
    },
    // chalk: a sharp crack, then crumbs
    chalk() {
      if (!ready()) return;
      hiss({ dur: 0.018, type: "highpass", f: 2600, g: 1, wet: 0.15 });
      hiss({ dur: 0.05, f: 4200, q: 6, g: 0.35, wet: 0.1 });
      tone({ f: 1900, to: 1200, d: 0.04, g: 0.12, wet: 0 });
      for (let i = 0; i < 12; i++) hiss({ at: 0.03 + Math.random() * 0.35, dur: 0.008, f: rand(2500, 7000), q: 3, g: rand(0.05, 0.22), wet: 0.05 });
    },
    // scrunching paper: clusters of tiny crackles
    paper(amount = 1) {
      if (!ready()) return;
      const n = Math.round(4 + amount * 6);
      for (let i = 0; i < n; i++) hiss({ at: Math.random() * 0.12, dur: rand(0.004, 0.015), type: "highpass", f: rand(1800, 5000), g: rand(0.08, 0.35) * amount, wet: 0.08 });
    },
    // tapping a wooden block / marimba bar
    wood(f = 600) {
      if (!ready()) return;
      tone({ f, d: 0.45, g: 0.35, wet: 0.25 });
      tone({ f: f * 3.93, d: 0.08, g: 0.08, wet: 0 });
      hiss({ dur: 0.012, f: f * 2, q: 4, g: 0.25, wet: 0 });
    },
    // a singing bowl: slow, beating partials
    bowl() {
      if (!ready()) return;
      const f = 196;
      [[1, 0.18, 7], [2.71, 0.08, 5], [5.15, 0.035, 3.2], [8.1, 0.015, 2]].forEach(([m, g, d]) => {
        tone({ f: f * m, a: 0.01, d, g, wet: 0.5 });
        tone({ f: f * m + 0.7 * m, a: 0.01, d, g: g * 0.8, wet: 0.5 });
      });
    },
    // slicing kinetic sand: a soft, grainy swish
    sand() {
      if (!ready()) return;
      hiss({ dur: 0.32, type: "lowpass", f: 900, fTo: 2400, q: 0.5, g: 0.4, a: 0.05, wet: 0.08 });
      for (let i = 0; i < 18; i++) hiss({ at: Math.random() * 0.35, dur: 0.006, f: rand(800, 2600), q: 2, g: rand(0.04, 0.14), wet: 0 });
    },
    // ice cubes in a glass
    clink() {
      if (!ready()) return;
      const f = rand(2200, 2800);
      [[1, 0.12, 0.5], [1.48, 0.06, 0.35], [2.1, 0.04, 0.25]].forEach(([m, g, d]) => tone({ f: f * m, d, g, wet: 0.35 }));
      hiss({ dur: 0.01, type: "highpass", f: 4000, g: 0.2, wet: 0 });
    },
  };

  // ---- loops: rain on a window, the ocean ----
  const loop = (setup) => {
    let nodes = null;
    return {
      start(...args) { if (!ready() || nodes) return; nodes = setup(...args); },
      stop() { if (!nodes) return; const n = nodes; nodes = null; n.out.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => n.stop(), 1600); },
      set(v) { nodes && nodes.set && nodes.set(v); },
      get on() { return !!nodes; },
    };
  };
  const rain = loop(() => {
    const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), out = ctx.createGain();
    s.buffer = white; s.loop = true;
    hp.type = "highpass"; hp.frequency.value = 700; lp.type = "lowpass"; lp.frequency.value = 5200;
    out.gain.value = 0; out.gain.setTargetAtTime(0.16, ctx.currentTime, 0.6);
    s.connect(hp); hp.connect(lp); lp.connect(out); out.connect(sfxBus);
    s.start();
    const drops = setInterval(() => { if (st.sfx) hiss({ dur: 0.01, f: rand(2000, 6000), q: 5, g: rand(0.03, 0.12), wet: 0.3 }); }, 70);
    return { out, stop() { clearInterval(drops); s.stop(); } };
  });
  const ocean = loop(() => {
    const s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), out = ctx.createGain(), swell = ctx.createGain();
    const lfo = ctx.createOscillator(), depth = ctx.createGain(), fDepth = ctx.createGain();
    s.buffer = brown; s.loop = true;
    lp.type = "lowpass"; lp.frequency.value = 700; lp.Q.value = 0.4;
    lfo.frequency.value = 0.11;                       // one breaking wave about every nine seconds
    depth.gain.value = 0.35; fDepth.gain.value = 500;
    lfo.connect(depth); depth.connect(swell.gain);
    lfo.connect(fDepth); fDepth.connect(lp.frequency);
    swell.gain.value = 0.55;
    out.gain.value = 0; out.gain.setTargetAtTime(0.5, ctx.currentTime, 1);
    s.connect(lp); lp.connect(swell); swell.connect(out); out.connect(sfxBus);
    s.start(); lfo.start();
    return {
      out,
      set(level) { // calmer urge, calmer sea
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(0.25 + level * 0.45, t, 1.5);
        lfo.frequency.setTargetAtTime(0.08 + level * 0.07, t, 2);
        lp.frequency.setTargetAtTime(450 + level * 700, t, 2);
      },
      stop() { s.stop(); lfo.stop(); },
    };
  });

  // ---- serene music: a slow pad in D, with a soft bell melody drifting over it ----
  const music = (() => {
    const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const chords = [[50, 57, 64, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 59, 61]]; // Dadd9 · Bm7 · Gmaj7 · A6
    const melody = [74, 76, 78, 81, 83, 86];
    let timer = null, next = 0, chord = 0, nextNote = 0;
    const pad = (notes, at, len) => {
      const lp = ctx.createBiquadFilter(), v = ctx.createGain();
      lp.type = "lowpass"; lp.frequency.value = 900;
      v.gain.setValueAtTime(0, at); v.gain.linearRampToValueAtTime(0.05, at + 3.5); v.gain.setValueAtTime(0.05, at + len - 1); v.gain.linearRampToValueAtTime(0, at + len + 3);
      lp.connect(v); v.connect(musicBus);
      const w = ctx.createGain(); w.gain.value = 0.6; v.connect(w); w.connect(musicWet);
      notes.forEach((n) => [-4, 4].forEach((cents) => {
        const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = N(n); o.detune.value = cents;
        o.connect(lp); o.start(at); o.stop(at + len + 3.2);
      }));
    };
    const bell = (n, at) => {
      const o = ctx.createOscillator(), v = ctx.createGain(), w = ctx.createGain();
      o.frequency.value = N(n);
      v.gain.setValueAtTime(0, at); v.gain.linearRampToValueAtTime(0.045, at + 0.02); v.gain.exponentialRampToValueAtTime(0.0001, at + 3.5);
      w.gain.value = 0.9;
      o.connect(v); v.connect(musicBus); v.connect(w); w.connect(musicWet);
      o.start(at); o.stop(at + 3.6);
    };
    const schedule = () => {
      const now = ctx.currentTime;
      while (next < now + 1) { pad(chords[chord].map((n) => n), next, 11); chord = (chord + 1) % chords.length; next += 11; }
      while (nextNote < now + 1) { if (Math.random() < 0.8) bell(pick(melody), nextNote); nextNote += pick([1.6, 2.4, 3.2, 4]); }
    };
    return {
      start() {
        if (!ensure() || timer) return;
        next = nextNote = ctx.currentTime + 0.1;
        musicBus.gain.cancelScheduledValues(ctx.currentTime);
        musicBus.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
        schedule(); timer = setInterval(schedule, 400);
      },
      stop() {
        if (!timer) return;
        clearInterval(timer); timer = null;
        musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
      },
    };
  })();

  return {
    state: st,
    onChange(fn) { subs.push(fn); fn(st); },
    setSfx(on) {
      st.sfx = on;
      if (ctx) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
      changed();
    },
    setMusic(on) { st.music = on; if (on) music.start(); else if (ctx) music.stop(); changed(); },
    setVolume(v) { st.vol = v; if (ctx) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); changed(); },
    muteAll() { st.sfx = false; st.music = false; if (ctx) { sfxBus.gain.setTargetAtTime(0, ctx.currentTime, 0.05); music.stop(); } changed(); },
    ...fx, rain, ocean,
  };
})();
