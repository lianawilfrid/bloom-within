// Helpline data for Bloom Within.
// Every number and link checked against the services' own websites on 29 October 2026.
// Re-check these numbers every few months — services change.
window.BLOOM_HELPLINES = {
  us: { label: "USA", lines: [
    { kind: "Eating disorders", name: "ANAD Helpline", desc: "Free peer support for anyone affected by an eating disorder. Mon–Fri, 9am–9pm Central; messages left after hours are returned.", contact: "888-375-7767", href: "tel:+18883757767", type: "call", site: "anad.org" },
    { kind: "24/7 crisis", name: "988 Lifeline", desc: "Call or text any time if you're in crisis or thinking about harming yourself.", contact: "Call or text 988", href: "tel:988", type: "call", site: "988lifeline.org" },
    { kind: "Text support", name: "Crisis Text Line", desc: "Free, confidential support by text, 24/7.", contact: "Text HOME to 741741", href: "sms:741741?body=HOME", type: "text", site: "crisistextline.org" },
    { kind: "Information", name: "NEDA", desc: "Screening tool, treatment finder and education resources.", contact: "nationaleatingdisorders.org", href: "https://www.nationaleatingdisorders.org", type: "web", site: "nationaleatingdisorders.org" },
  ] },
  uk: { label: "UK", lines: [
    { kind: "Eating disorders", name: "Beat Helpline", desc: "The UK's eating disorder charity. Open 3pm–8pm, Mon–Fri. Number shown is for England — Scotland 0808 801 0432, Wales 0808 801 0433, Northern Ireland 0808 801 0434.", contact: "0808 801 0677", href: "tel:08088010677", type: "call", site: "beateatingdisorders.org.uk" },
    { kind: "24/7 listening", name: "Samaritans", desc: "Talk to someone any time, about anything.", contact: "116 123", href: "tel:116123", type: "call", site: "samaritans.org" },
    { kind: "Text support", name: "Shout", desc: "Free, confidential text support, 24/7.", contact: "Text SHOUT to 85258", href: "sms:85258?body=SHOUT", type: "text", site: "giveusashout.org" },
  ] },
  ca: { label: "Canada", lines: [
    { kind: "Eating disorders", name: "NEDIC", desc: "Canada's national eating disorder helpline and live chat.", contact: "1-866-633-4220", href: "tel:+18666334220", type: "call", site: "nedic.ca" },
    { kind: "24/7 crisis", name: "9-8-8 Canada", desc: "Suicide crisis helpline — call or text any time.", contact: "Call or text 988", href: "tel:988", type: "call", site: "988.ca" },
    { kind: "Youth", name: "Kids Help Phone", desc: "24/7 support for young people by phone or text.", contact: "1-800-668-6868", href: "tel:+18006686868", type: "call", site: "kidshelpphone.ca" },
  ] },
  au: { label: "Australia", lines: [
    { kind: "Eating disorders", name: "Butterfly Foundation", desc: "National helpline for eating disorders and body image concerns. 8am–midnight (AEST/AEDT), 7 days a week.", contact: "1800 33 4673", href: "tel:1800334673", type: "call", site: "butterfly.org.au" },
    { kind: "24/7 crisis", name: "Lifeline", desc: "Crisis support and suicide prevention, any time.", contact: "13 11 14", href: "tel:131114", type: "call", site: "lifeline.org.au" },
    { kind: "Youth", name: "Kids Helpline", desc: "Free counselling for ages 5–25, 24/7.", contact: "1800 55 1800", href: "tel:1800551800", type: "call", site: "kidshelpline.com.au" },
  ] },
  in: { label: "India", lines: [
    { kind: "24/7 government helpline", name: "Tele-MANAS", desc: "Free, round-the-clock mental health counselling from the Government of India, with referrals to specialist care. Also 1-800-891-4416.", contact: "Call 14416", href: "tel:14416", type: "call", site: "telemanas.mohfw.gov.in" },
    { kind: "24/7 call or WhatsApp", name: "Vandrevala Foundation", desc: "Free mental health support any hour of the day or night, by phone or WhatsApp, from anywhere in India.", contact: "+91 9999 666 555", href: "tel:+919999666555", type: "call", site: "vandrevalafoundation.com" },
    { kind: "Professional counselling", name: "iCall (TISS)", desc: "Trained counsellors from the Tata Institute of Social Sciences. Mon–Sat, 8am–9pm. Email icall@tiss.ac.in.", contact: "9152987821", href: "tel:+919152987821", type: "call", site: "icallhelpline.org" },
    { kind: "Eating & body image", name: "Find a Helpline — India", desc: "Free, confidential services across Indian states that support eating and body image concerns.", contact: "findahelpline.com", href: "https://findahelpline.com/countries/in/topics/eating-body-image", type: "web", site: "findahelpline.com" },
  ] },
  intl: { label: "Worldwide", lines: [
    { kind: "Directory", name: "Find a Helpline", desc: "More than 1,700 free helplines in over 175 countries.", contact: "findahelpline.com", href: "https://findahelpline.com", type: "web", site: "findahelpline.com" },
    { kind: "Families", name: "F.E.A.S.T.", desc: "Global support and education for parents and carers.", contact: "feast-ed.org", href: "https://www.feast-ed.org", type: "web", site: "feast-ed.org" },
    { kind: "Recovery", name: "Project HEAL", desc: "Helps people access eating disorder treatment and recovery support.", contact: "theprojectheal.org", href: "https://www.theprojectheal.org", type: "web", site: "theprojectheal.org" },
  ] },
};

// Quick exit (button + Esc twice) and calm-mode preference.
window.BLOOM_COMMON = {
  quickExit(link) {
    const go = () => window.location.replace(link.href);
    link.addEventListener("click", (e) => { e.preventDefault(); go(); });
    let last = 0;
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const now = Date.now();
      if (now - last < 600) go();
      last = now;
    });
  },
  calm(button, onChange) {
    let on = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    try { const s = localStorage.getItem("bloom-calm"); if (s !== null) on = s === "1"; } catch (e) {}
    const apply = () => {
      document.documentElement.classList.toggle("calm", on);
      button.setAttribute("aria-pressed", String(on));
      button.textContent = on ? "Calm mode on" : "Calm mode";
      try { localStorage.setItem("bloom-calm", on ? "1" : "0"); } catch (e) {}
      onChange && onChange(on);
    };
    button.addEventListener("click", () => { on = !on; apply(); });
    apply();
    return () => on;
  },
  esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  },
};
