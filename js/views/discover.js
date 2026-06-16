/* views/discover.js — swipeable card deck (the heart of the app). */
import { api, ApiError } from "../api.js";
import { store } from "../store.js";
import { el, mount, clear, icons, toast, avatarBg, initials, compatColor, LABELS, clean } from "../ui.js";
import { showProfileDetail } from "./profileDetail.js";
import { celebrate } from "./celebrate.js";

const SWIPE_THRESHOLD = 110;

export function renderDiscover(screen) {
  let queue = [];
  let history = [];   // for rewind
  let loading = true;

  const deckWrap = el("div.deck-wrap");
  mount(screen, deckWrap);

  const interestChip = (slug) => {
    const it = store.interestsCatalog.find((i) => i.slug === slug);
    return el("span.card-tag", { text: it ? `${it.icon || ""} ${it.name}`.trim() : slug });
  };

  function cardEl(p, index) {
    const card = el("div.card", { dataset: { uid: p.user_id } });
    card.style.zIndex = String(100 - index);
    if (index > 0) { card.style.transform = `scale(${1 - index * 0.04}) translateY(${index * 12}px)`; card.style.filter = "brightness(.96)"; }

    const photo = el("div.card-photo");
    if (p.photo_url) photo.style.backgroundImage = `url("${p.photo_url}")`;
    else {
      photo.style.background = avatarBg(p.name || "x");
      photo.appendChild(el("div", { text: initials(p.name), style: {
        position: "absolute", inset: "0", display: "grid", placeItems: "center",
        fontSize: "120px", fontWeight: "800", color: "rgba(255,255,255,.35)",
      } }));
    }
    card.appendChild(photo);
    card.appendChild(el("div.card-grad"));
    card.appendChild(el("div.stamp.like", { text: "LIKE" }));
    card.appendChild(el("div.stamp.nope", { text: "NOPE" }));

    const top = el("div.card-top");
    top.appendChild(p.compatibility != null
      ? el("div.compat-chip", {}, [el("span.ring", { style: { background: compatColor(p.compatibility) } }), `${p.compatibility}% Match`])
      : el("div"));
    if (p.online) top.appendChild(el("div.card-online", {}, [el("span.dot-online"), "Online"]));
    card.appendChild(top);

    const info = el("div.card-info");
    info.appendChild(el("div.card-name", {}, [
      `${p.name || "Unbekannt"}`,
      p.age != null ? el("span.age", { text: String(p.age) }) : null,
      p.verified ? el("span.badge.badge-verified", { html: `${icons.check({ w: 3 })} Verifiziert` }) : null,
    ]));
    const subBits = [];
    if (p.distance_km != null) subBits.push(`📍 ${Math.max(1, Math.round(p.distance_km))} km`);
    if (clean(p.job_title)) subBits.push(`💼 ${clean(p.job_title)}`);
    if (p.dating_goal && LABELS.dating_goal[p.dating_goal]) subBits.push(`💞 ${LABELS.dating_goal[p.dating_goal]}`);
    if (subBits.length) info.appendChild(el("div.card-sub", {}, subBits.map((t) => el("span", { text: t }))));
    if (clean(p.bio)) info.appendChild(el("div.card-bio", { text: clean(p.bio) }));
    if (p.interests?.length) info.appendChild(el("div.card-tags", {}, p.interests.slice(0, 4).map(interestChip)));
    const firstPrompt = (p.prompts || []).find((pr) => clean(pr.answer));
    if (firstPrompt) info.appendChild(el("div.card-prompt", {}, [el("div.q", { text: firstPrompt.prompt }), el("div.a", { text: clean(firstPrompt.answer) })]));
    card.appendChild(info);

    card.appendChild(el("button.icon-btn.card-expand", {
      html: icons.info(), style: { background: "rgba(0,0,0,.4)", color: "#fff" },
      onclick: (e) => { e.stopPropagation(); openDetail(p); },
    }));

    if (index === 0) makeDraggable(card, p);
    return card;
  }

  function makeDraggable(card, p) {
    let startX = 0, startY = 0, dx = 0, dy = 0, dragging = false;
    const likeStamp = card.querySelector(".stamp.like");
    const nopeStamp = card.querySelector(".stamp.nope");
    const down = (e) => {
      if (e.target.closest(".card-expand")) return;
      dragging = true; card.style.transition = "none";
      const pt = e.touches ? e.touches[0] : e; startX = pt.clientX; startY = pt.clientY;
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    };
    const move = (e) => {
      if (!dragging) return;
      const pt = e.touches ? e.touches[0] : e; dx = pt.clientX - startX; dy = pt.clientY - startY;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 18}deg)`;
      const t = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
      if (dx > 0) { likeStamp.style.opacity = t; nopeStamp.style.opacity = 0; }
      else { nopeStamp.style.opacity = t; likeStamp.style.opacity = 0; }
    };
    const up = () => {
      dragging = false;
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      card.style.transition = "transform .35s ease, opacity .35s ease";
      if (Math.abs(dx) > SWIPE_THRESHOLD) { const dir = dx > 0 ? 1 : -1; flyOut(card, dir); decide(p, dir > 0 ? "like" : "pass"); }
      else { card.style.transform = ""; likeStamp.style.opacity = 0; nopeStamp.style.opacity = 0; }
      dx = dy = 0;
    };
    card.addEventListener("pointerdown", down);
  }

  function flyOut(card, dir) {
    card.style.transition = "transform .35s ease, opacity .35s ease";
    card.style.transform = `translate(${dir * 600}px, -40px) rotate(${dir * 28}deg)`;
    card.style.opacity = "0";
    setTimeout(() => card.remove(), 320);
  }

  function advance(p) { history.push(p); queue = queue.filter((x) => x.user_id !== p.user_id); setTimeout(redraw, 240); }

  async function decide(p, action) {
    advance(p);
    try { const res = await api.like(p.user_id, action); if (res?.matched) celebrate(p, res.match_id); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Aktion fehlgeschlagen.", "err"); }
  }

  function programmaticSwipe(action) {
    const top = deckWrap.querySelector(".card"); const p = queue[0];
    if (!top || !p) return;
    flyOut(top, action === "like" ? 1 : -1); decide(p, action);
  }

  function openDetail(p) {
    showProfileDetail(p, {
      showLike: true,
      onLike: (res) => { const top = deckWrap.querySelector(".card"); if (top) flyOut(top, 1); advance(p); if (res?.matched) celebrate(p, res.match_id); },
      onPass: () => programmaticSwipe("pass"),
      onBlock: () => { const top = deckWrap.querySelector(".card"); if (top) flyOut(top, -1); advance(p); },
    });
  }

  function rewind() {
    const last = history.pop();
    if (!last) return toast("Nichts zum Zurückholen.", "info");
    queue.unshift(last); redraw(); toast("Zurückgeholt ↩︎", "info");
  }

  function redraw() {
    clear(deckWrap);
    const deck = el("div.deck");
    if (loading) { deck.appendChild(el("div.loading-center", {}, [el("div.spinner")])); deckWrap.appendChild(deck); return; }
    if (!queue.length) {
      deckWrap.appendChild(el("div.deck", {}, [el("div.empty", {}, [
        el("div.big", { text: "🌷" }), el("h3", { text: "Das war's erstmal" }),
        el("p", { text: "Du hast alle Profile in deinem Umkreis gesehen. Erweitere den Radius im Profil oder schau später wieder vorbei." }),
        el("button.btn.btn-primary", { text: "Neu laden", onclick: load, style: { marginTop: "8px" } }),
      ])]));
      return;
    }
    queue.slice(0, 3).reverse().forEach((p) => deck.appendChild(cardEl(p, queue.indexOf(p))));
    deckWrap.appendChild(deck);
    deckWrap.appendChild(el("div.deck-actions", {}, [
      el("button.fab.fab-rewind", { html: icons.rewind(), onclick: rewind, title: "Zurückholen" }),
      el("button.fab.fab-nope", { html: icons.x({ w: 2.6 }), onclick: () => programmaticSwipe("pass"), title: "Nope" }),
      el("button.fab.fab-like", { html: icons.heart({ fill: true }), onclick: () => programmaticSwipe("like"), title: "Like" }),
      el("button.fab.fab-info", { html: icons.info(), onclick: () => openDetail(queue[0]), title: "Details" }),
    ]));
  }

  async function load() {
    loading = true; redraw();
    try {
      const data = await api.discover();
      queue = (data || []).map((p) => ({ ...p, name: p.name || p.display_name, compatibility: p.compatibility != null ? Math.round(p.compatibility) : null }));
      history = [];
    } catch (e) {
      queue = [];
      if (e instanceof ApiError && e.status === 400) {
        loading = false; clear(deckWrap);
        deckWrap.appendChild(el("div.empty", {}, [
          el("div.big", { text: "📝" }), el("h3", { text: "Profil vervollständigen" }), el("p", { text: e.message }),
          el("button.btn.btn-primary", { text: "Zum Profil", onclick: () => location.hash = "#/profile" }),
        ]));
        return;
      }
      toast(e.message || "Konnte Profile nicht laden.", "err");
    }
    loading = false; redraw();
  }

  load();
}
