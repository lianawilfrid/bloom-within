// "Try another look" switcher shared by every version of Bloom Within.
// Include with: <script src="<root>shared/switcher.js" data-root="<root>"></script>
(() => {
  const me = document.currentScript;
  const root = me.dataset.root || "./";
  const looks = [
    { name: "Original", href: root },
    { name: "Night to dawn", href: `${root}dawn/` },
    { name: "Living garden", href: `${root}garden/` },
    { name: "Paper collage", href: `${root}collage/` },
  ];
  const here = (href) => new URL(href, location.href).pathname.replace(/index\.html$/, "") === location.pathname.replace(/index\.html$/, "");

  const css = `
  .bw-switch { position: fixed; left: max(16px, env(safe-area-inset-left)); bottom: max(16px, env(safe-area-inset-bottom)); z-index: 70; font: 600 14px/1.2 system-ui, sans-serif; }
  .bw-switch > button { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 10px 16px; border: 0; border-radius: 999px; background: #111; color: #fff; cursor: pointer; box-shadow: 0 8px 20px -8px rgba(0,0,0,.55); transition: transform .16s cubic-bezier(.23,1,.32,1); }
  .bw-switch > button:active { transform: scale(.97); }
  .bw-switch svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .bw-switch ul { position: absolute; left: 0; bottom: calc(100% + 8px); list-style: none; margin: 0; padding: 6px; min-width: 190px; border-radius: 16px; background: #111; box-shadow: 0 16px 30px -12px rgba(0,0,0,.6);
    opacity: 0; transform: translateY(6px) scale(.97); transform-origin: bottom left; pointer-events: none; transition: opacity .18s cubic-bezier(.23,1,.32,1), transform .18s cubic-bezier(.23,1,.32,1); }
  .bw-switch.open ul { opacity: 1; transform: none; pointer-events: auto; }
  .bw-switch a { display: block; padding: 10px 12px; border-radius: 10px; color: #fff; text-decoration: none; }
  .bw-switch a[aria-current="page"] { background: #fff; color: #111; }
  @media (hover: hover) and (pointer: fine) { .bw-switch a:not([aria-current]):hover { background: rgba(255,255,255,.14); } }
  .bw-switch :focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) { .bw-switch ul, .bw-switch > button { transition: none; } }`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = "bw-switch";
  wrap.innerHTML = `<button aria-expanded="false" aria-controls="bwLooks"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h11M4 17h7M15 4l4 3-4 3M11 14l4 3-4 3"/></svg>Try another look</button>
    <ul id="bwLooks">${looks.map((l) => `<li><a href="${l.href}"${here(l.href) ? ' aria-current="page"' : ""}>${l.name}</a></li>`).join("")}</ul>`;
  document.body.appendChild(wrap);
  const btn = wrap.querySelector("button");
  const set = (open) => { wrap.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); };
  btn.addEventListener("click", () => set(!wrap.classList.contains("open")));
  document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
})();
