/* ui.js — DOM helpers, icons, toasts, modals, avatars, formatting. */

/** Tiny hyperscript: el("div.cls#id", {attrs}, [children|string]). */
export function el(sel, attrs = {}, children = []) {
  const m = sel.match(/^([a-z0-9]+)?(.*)$/i);
  const tag = m[1] || "div";
  const node = document.createElement(tag);
  const rest = m[2];
  const idM = rest.match(/#([\w-]+)/);
  if (idM) node.id = idM[1];
  const cls = [...rest.matchAll(/\.([\w-]+)/g)].map((x) => x[1]);
  if (cls.length) node.className = cls.join(" ");
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = (node.className + " " + v).trim();
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  appendChildren(node, children);
  return node;
}
function appendChildren(node, children) {
  if (children == null) return;
  if (!Array.isArray(children)) children = [children];
  for (const c of children) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
}
export const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
export const mount = (n, ...kids) => { clear(n); appendChildren(n, kids); return n; };

/* ---------------- Icons (inline SVG, stroke=currentColor) ---------------- */
const I = (p, o = {}) =>
  `<svg viewBox="0 0 24 24" fill="${o.fill || "none"}" stroke="${o.fill ? "none" : "currentColor"}" stroke-width="${o.w || 2}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const icons = {
  flame: (o) => I('<path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-1.5.5-2.5 1-3 .3 1 1 1.5 1.5 1.5C9 8 10 5 12 2z"/>', o),
  heart: (o) => I('<path d="M19.5 5.5a5 5 0 0 0-7.5.6A5 5 0 0 0 4.5 5.5C2.5 7.4 2.4 10.6 5 13l7 7 7-7c2.6-2.4 2.5-5.6.5-7.5z"/>', o),
  x: (o) => I('<path d="M18 6 6 18M6 6l12 12"/>', o),
  search: (o) => I('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', o),
  chat: (o) => I('<path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5A8.5 8.5 0 1 1 21 11.5z"/>', o),
  user: (o) => I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', o),
  settings: (o) => I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', o),
  back: (o) => I('<path d="m15 18-6-6 6-6"/>', o),
  chevron: (o) => I('<path d="m9 18 6-6-6-6"/>', o),
  send: (o) => I('<path d="m22 2-7 20-4-9-9-4 20-7z"/>', o),
  camera: (o) => I('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>', o),
  check: (o) => I('<path d="M20 6 9 17l-5-5"/>', o),
  checks: (o) => I('<path d="m1 12 4 4L13 8M9 16l1 1L22 5"/>', o),
  shield: (o) => I('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', o),
  lock: (o) => I('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', o),
  bell: (o) => I('<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>', o),
  download: (o) => I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', o),
  trash: (o) => I('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>', o),
  logout: (o) => I('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', o),
  info: (o) => I('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>', o),
  star: (o) => I('<path d="M12 2l3 6.5 7 .8-5 4.6 1.4 7L12 17.8 5.6 21l1.4-7-5-4.6 7-.8z"/>', o),
  edit: (o) => I('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>', o),
  filter: (o) => I('<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>', o),
  pin: (o) => I('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', o),
  rewind: (o) => I('<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>', o),
  globe: (o) => I('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>', o),
  device: (o) => I('<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M11 18h2"/>', o),
  spark: (o) => I('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>', o),
};

/* ---------------- Toast ---------------- */
export function toast(message, kind = "info") {
  const layer = document.getElementById("toast-layer");
  const t = el(`div.toast.${kind}`, { text: message });
  layer.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ---------------- Modal ---------------- */
export function modal({ title, body, content, actions, dismissable = true, cls = "" } = {}) {
  const layer = document.getElementById("modal-layer");
  const box = el(`div.modal.${cls}`);
  if (title) box.appendChild(el("h3", { text: title }));
  if (body) box.appendChild(el("p", { text: body }));
  if (content) appendChildren(box, content);
  const close = () => { layer.classList.remove("open"); clear(layer); };
  if (actions) {
    const row = el("div.modal-actions");
    for (const a of actions) {
      row.appendChild(el(`button.btn.${a.cls || "btn-ghost"}`, {
        text: a.label,
        onclick: async () => { if (a.onClick) { const r = await a.onClick(); if (r === false) return; } close(); },
      }));
    }
    box.appendChild(row);
  }
  const backdrop = el("div.modal-backdrop", { onclick: () => dismissable && close() });
  mount(layer, backdrop, box);
  layer.classList.add("open");
  return { close, box };
}
export const closeModal = () => { const l = document.getElementById("modal-layer"); l.classList.remove("open"); clear(l); };

export function confirmDialog({ title, body, confirmLabel = "Bestätigen", danger = false }) {
  return new Promise((resolve) => {
    modal({
      title, body,
      actions: [
        { label: "Abbrechen", cls: "btn-ghost", onClick: () => resolve(false) },
        { label: confirmLabel, cls: danger ? "btn-danger" : "btn-primary", onClick: () => resolve(true) },
      ],
      dismissable: true,
    });
  });
}

/* ---------------- Avatars ---------------- */
const GRADS = [
  ["#ff9a6c", "#ff4d8d"], ["#ff7eb3", "#c4309b"], ["#7b6cff", "#ff6ec4"],
  ["#36d1dc", "#5b86e5"], ["#f6d365", "#fda085"], ["#a18cd1", "#fbc2eb"],
  ["#84fab0", "#8fd3f4"], ["#ff758c", "#ff7eb3"],
];
export function avatarBg(seed = "") {
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const [a, b] = GRADS[Math.abs(h) % GRADS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
export const initials = (name = "?") => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";

/** Avatar element. `photo` URL optional; falls back to gradient + initials. */
export function avatar(name, photo, size = 52, opts = {}) {
  const a = el("div.avatar", {
    style: { width: size + "px", height: size + "px", fontSize: Math.round(size * 0.38) + "px", background: avatarBg(name) },
  });
  if (photo) a.appendChild(el("img", { src: photo, alt: name, loading: "lazy", onerror: function () { this.remove(); a.textContent = initials(name); } }));
  else a.textContent = initials(name);
  if (opts.online) a.appendChild(el("span", { style: { position: "absolute", right: "1px", bottom: "1px", width: size * 0.26 + "px", height: size * 0.26 + "px", borderRadius: "50%", background: "var(--like)", border: "2px solid #fff" } }));
  return a;
}

/* ---------------- Formatting ---------------- */
export function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "jetzt";
  if (s < 3600) return Math.floor(s / 60) + " Min.";
  if (s < 86400) return Math.floor(s / 3600) + " Std.";
  if (s < 604800) return Math.floor(s / 86400) + " T.";
  return d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}
export const clock = (iso) => iso ? new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "";
export const dayLabel = (iso) => {
  const d = new Date(iso), t = new Date();
  const same = (a, b) => a.toDateString() === b.toDateString();
  if (same(d, t)) return "Heute";
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (same(d, y)) return "Gestern";
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
};

/** EncryptedTextField returns this placeholder if a value can't be decrypted. */
export const ENC_PLACEHOLDER = "[nicht entschlüsselbar]";
export const clean = (v) => (v == null || v === ENC_PLACEHOLDER ? "" : v);
export const pct = (v) => (v == null ? null : Math.round(v));

export function compatColor(pct) {
  if (pct == null) return "#bbb";
  if (pct >= 80) return "#2dd4a7";
  if (pct >= 60) return "#7bd44f";
  if (pct >= 40) return "#f0a830";
  return "#ff8a6c";
}

export const LABELS = {
  dating_goal: {
    long_term: "Langfristige Beziehung", long_open: "Langfristig, offen", short_open: "Kurzfristig, offen",
    short_fun: "Etwas Lockeres", friends: "Neue Freund:innen", figuring: "Weiß noch nicht",
  },
  gender: { male: "Mann", female: "Frau", other: "Divers" },
  looking_for: { male: "Männer", female: "Frauen", everyone: "Alle" },
  frequency: { never: "Nie", sometimes: "Manchmal", often: "Oft" },
};

export function confetti() {
  const layer = el("div.confetti");
  const colors = ["#ff4d8d", "#ff7a59", "#c4309b", "#ffd166", "#2dd4a7", "#7b6cff"];
  for (let i = 0; i < 60; i++) {
    layer.appendChild(el("i", { style: {
      left: Math.random() * 100 + "%",
      background: colors[i % colors.length],
      animationDuration: 1.6 + Math.random() * 1.6 + "s",
      animationDelay: Math.random() * 0.4 + "s",
      transform: `rotate(${Math.random() * 360}deg)`,
    } }));
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3600);
}
