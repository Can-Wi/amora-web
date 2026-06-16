/* views/celebrate.js — shared "It's a Match!" celebration. */
import { store } from "../store.js";
import { el, mount, clear, avatar, confetti } from "../ui.js";

const shown = new Set(); // dedup: liker sees it from the like-response, recipient from the live socket

export function celebrate(partner, matchId) {
  if (matchId != null) { if (shown.has(matchId)) return; shown.add(matchId); }
  confetti();
  const layer = document.getElementById("modal-layer");
  const me = store.me;
  const close = () => { layer.classList.remove("open"); clear(layer); };

  const partnerAv = avatar(partner.name || partner.display_name, partner.photo_url, 84);
  partnerAv.style.marginLeft = "-18px";
  partnerAv.style.border = "3px solid #fff";

  const box = el("div.modal.match-modal", {}, [
    el("div.match-cele", {}, [
      el("div.mc-title", { text: "It's a Match! 💞" }),
      el("div.mc-sub", { text: `Du und ${partner.name || partner.display_name} mögt euch gegenseitig.` }),
      el("div.flex", { style: { justifyContent: "center", marginBottom: "24px" } }, [
        avatar(me?.display_name || "Ich", me?.photo_url, 84),
        partnerAv,
      ]),
      el("button.btn.btn-block", { text: "Nachricht senden", style: { background: "#fff", color: "var(--mag-deep)" },
        onclick: () => { close(); location.hash = `#/chat/${matchId}`; } }),
      el("button.btn.btn-link.btn-block", { text: "Weiter entdecken", style: { color: "#fff", marginTop: "6px" }, onclick: close }),
    ]),
  ]);
  mount(layer, el("div.modal-backdrop", { onclick: close }), box);
  layer.classList.add("open");
}
