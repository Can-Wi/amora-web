/* views/profileDetail.js — shared full-profile modal used by Discover & Search. */
import { api } from "../api.js";
import { store } from "../store.js";
import { el, modal, closeModal, toast, icons, LABELS, confirmDialog, clean, pct } from "../ui.js";
import { reportDialog } from "./report.js";
import { celebrate } from "./celebrate.js";

/**
 * @param {object} p  profile (discover/search shape — uses p.name)
 * @param {object} opts { showLike, onLike, onPass, onBlock }
 */
export function showProfileDetail(p, opts = {}) {
  const name = p.name || p.display_name;
  const s = [];

  s.push(el("div.flex.between", { style: { alignItems: "flex-start" } }, [
    el("h3", { style: { margin: 0 }, html: `${name}${p.age != null ? `, ${p.age}` : ""} ${p.verified ? '<span class="badge badge-verified">✓ Verifiziert</span>' : ""}` }),
    p.online ? el("span.pill.static", { html: `<span class="dot-online"></span> Online` }) : null,
  ]));
  if (p.compatibility != null) s.push(el("div.pill.static", { style: { marginTop: "8px" }, text: `✨ ${pct(p.compatibility)}% Kompatibilität${p.shared_interests ? ` · ${p.shared_interests} gemeinsame Interessen` : ""}` }));
  if (p.reciprocal) s.push(el("div.pill.static", { style: { marginTop: "8px", color: "var(--mag-2)" }, text: "💘 Hat dich bereits geliked!" }));
  if (clean(p.bio)) s.push(el("p", { text: clean(p.bio), style: { color: "var(--ink)", marginTop: "12px" } }));

  const facts = [];
  if (p.distance_km != null) facts.push(["📍", `${Math.round(p.distance_km)} km entfernt`]);
  if (p.height_cm) facts.push(["📏", `${p.height_cm} cm`]);
  if (clean(p.job_title)) facts.push(["💼", clean(p.job_title)]);
  if (clean(p.education)) facts.push(["🎓", clean(p.education)]);
  if (p.dating_goal && LABELS.dating_goal[p.dating_goal]) facts.push(["💞", LABELS.dating_goal[p.dating_goal]]);
  if (clean(p.languages)) facts.push(["🗣️", clean(p.languages)]);
  if (p.smoking && LABELS.frequency[p.smoking]) facts.push(["🚬", `Rauchen: ${LABELS.frequency[p.smoking]}`]);
  if (p.drinking && LABELS.frequency[p.drinking]) facts.push(["🍷", `Trinken: ${LABELS.frequency[p.drinking]}`]);
  if (facts.length) s.push(el("div.stack", { style: { marginTop: "12px" } }, facts.map(([i, t]) => el("div.flex.gap8", { style: { alignItems: "center" } }, [el("span", { text: i }), el("span", { text: t })]))));

  if (p.interests?.length) {
    s.push(el("div.section-title", { text: "Interessen", style: { padding: "12px 0 6px" } }));
    s.push(el("div.chips-scroll", {}, p.interests.map((slug) => {
      const it = store.interestsCatalog.find((i) => i.slug === slug);
      return el("span.pill.static", { text: it ? `${it.icon || ""} ${it.name}` : slug });
    })));
  }
  const cleanPrompts = (p.prompts || []).filter((pr) => clean(pr.answer));
  if (cleanPrompts.length) {
    s.push(el("div.section-title", { text: "Über mich", style: { padding: "12px 0 6px" } }));
    cleanPrompts.forEach((pr) => s.push(el("div.card-prompt", { style: { background: "var(--surface-2)", color: "var(--ink)", marginTop: "8px" } }, [
      el("div.q", { text: pr.prompt, style: { color: "var(--ink-2)" } }), el("div.a", { text: clean(pr.answer) }),
    ])));
  }
  const links = p.social_links || {};
  if (Object.keys(links).length) {
    s.push(el("div.section-title", { text: "Social", style: { padding: "12px 0 6px" } }));
    s.push(el("div.flex.gap8.wrap", {}, Object.entries(links).map(([k, url]) => el("a", { class: "pill", href: url, target: "_blank", rel: "noopener", text: k }))));
  }

  s.push(el("div.divider"));

  if (opts.showLike) {
    s.push(el("div.flex.gap12", {}, [
      el("button.btn.btn-ghost.grow", { html: `${icons.x()} Pass`, onclick: () => { closeModal(); opts.onPass?.(); } }),
      el("button.btn.btn-primary.grow", { html: `${icons.heart({ fill: true })} Like`, onclick: async () => {
        try {
          const res = await api.like(p.user_id, "like");
          closeModal();
          opts.onLike?.(res);
          if (res?.matched) celebrate(p, res.match_id);
          else toast("Like gesendet 💌", "ok");
        } catch (e) { toast(e.message, "err"); }
      } }),
    ]));
  }
  s.push(el("div.flex.gap12", { style: { marginTop: "10px" } }, [
    el("button.btn.btn-ghost.grow", { text: "Melden", onclick: () => { closeModal(); reportDialog(p.user_id, name); } }),
    el("button.btn.btn-danger.grow", { text: "Blockieren", onclick: async () => {
      closeModal();
      if (await confirmDialog({ title: "Blockieren?", body: `${name} wird blockiert und verschwindet aus deinen Vorschlägen.`, confirmLabel: "Blockieren", danger: true })) {
        try { await api.block(p.user_id); toast("Blockiert.", "ok"); opts.onBlock?.(); } catch (e) { toast(e.message, "err"); }
      }
    } }),
  ]));

  modal({ content: s });
}
