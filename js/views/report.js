/* views/report.js — shared "report a user" dialog. */
import { api } from "../api.js";
import { el, modal, toast, closeModal } from "../ui.js";

const REASONS = [
  ["spam", "Spam / Werbung"], ["harassment", "Belästigung"], ["fake", "Fake-Profil"],
  ["inappropriate", "Unangemessene Inhalte"], ["underage", "Minderjährig"], ["other", "Sonstiges"],
];

export function reportDialog(userId, name = "") {
  let reason = "spam";
  const select = el("select.select", {}, REASONS.map(([v, l]) => el("option", { value: v, text: l })));
  select.addEventListener("change", () => (reason = select.value));
  const detail = el("textarea.textarea", { placeholder: "Optional: Was ist passiert?", maxlength: 1000 });
  const btn = el("button.btn.btn-danger.grow", { text: "Meldung senden" });

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      await api.report(userId, reason, detail.value.trim());
      toast("Meldung eingegangen. Danke.", "ok");
      closeModal();
    } catch (e) { toast(e.message || "Fehler beim Melden.", "err"); btn.disabled = false; }
  });

  modal({
    content: [
      el("h3", { text: `${name || "Nutzer"} melden` }),
      el("p", { text: "Deine Meldung wird vertraulich vom Moderationsteam geprüft." }),
      el("div.field", {}, [el("label", { text: "Grund" }), select]),
      el("div.field", {}, [el("label", { text: "Details" }), detail]),
      el("div.flex.gap12", {}, [el("button.btn.btn-ghost.grow", { text: "Abbrechen", onclick: closeModal }), btn]),
    ],
  });
}
