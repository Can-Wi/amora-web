/* views/chat.js — realtime 1:1 chat (history + WebSocket). */
import { api, ApiError } from "../api.js";
import { ChatSocket } from "../ws.js";
import { store } from "../store.js";
import { el, mount, clear, avatar, icons, clock, dayLabel, toast, confirmDialog, modal, closeModal } from "../ui.js";
import { reportDialog } from "./report.js";

export function renderChat(root, matchId) {
  matchId = Number(matchId);
  const meId = store.me?.id;
  let match = store.matches.find((m) => m.match_id === matchId);
  let socket = null;
  let lastDay = null;
  let typingTimer = null;
  let theyTyping = false;

  store.activeChat = matchId;
  store.unread[matchId] = 0;
  store.emit("new_message", { match_id: matchId }); // refresh badges elsewhere

  const head = el("div.chat-head");
  const scroll = el("div.chat-scroll");
  const inputWrap = el("div.chat-input");
  const container = el("div", { style: { display: "flex", flexDirection: "column", height: "100%" } }, [head, scroll, inputWrap]);
  mount(root, container);

  /* ---------- header ---------- */
  function drawHead() {
    const online = match && store.online.has(match.user_id);
    clear(head);
    head.appendChild(el("button.icon-btn", { html: icons.back(), onclick: () => history.length > 1 ? history.back() : (location.hash = "#/matches") }));
    head.appendChild(avatar(match?.display_name || "Chat", match?.photo_url, 42, { online }));
    head.appendChild(el("div.grow", {}, [
      el("div.nm", { text: match?.display_name || "Chat" }),
      el("div", { class: "st" + (online ? " online" : ""), text: online ? "Online" : "Offline" }),
    ]));
    head.appendChild(el("button.icon-btn", { html: icons.info(), onclick: openMenu }));
  }

  function openMenu() {
    modal({ content: [
      el("h3", { text: match?.display_name || "Optionen" }),
      el("div.stack", { style: { marginTop: "10px" } }, [
        el("button.btn.btn-ghost.btn-block", { text: "Match auflösen", onclick: async () => {
          closeModal();
          if (await confirmDialog({ title: "Match auflösen?", body: "Das Match und alle Nachrichten werden gelöscht.", confirmLabel: "Auflösen", danger: true })) {
            try { await api.unmatch(matchId); store.matches = store.matches.filter((m) => m.match_id !== matchId); toast("Match aufgelöst.", "ok"); location.hash = "#/matches"; }
            catch (e) { toast(e.message, "err"); }
          }
        } }),
        el("button.btn.btn-ghost.btn-block", { text: "Melden", onclick: () => { closeModal(); reportDialog(match?.user_id, match?.display_name); } }),
        el("button.btn.btn-danger.btn-block", { text: "Blockieren", onclick: async () => {
          closeModal();
          if (await confirmDialog({ title: "Blockieren?", body: "Ihr seht euch nicht mehr und könnt nicht mehr schreiben.", confirmLabel: "Blockieren", danger: true })) {
            try { await api.block(match?.user_id); store.matches = store.matches.filter((m) => m.match_id !== matchId); toast("Blockiert.", "ok"); location.hash = "#/matches"; }
            catch (e) { toast(e.message, "err"); }
          }
        } }),
      ]),
    ] });
  }

  /* ---------- messages ---------- */
  function addMessage(m, { animate = false } = {}) {
    const mine = m.sender_id === meId;
    const created = m.created_at;
    const day = dayLabel(created);
    if (day !== lastDay) { scroll.appendChild(el("div.day-sep", { text: day })); lastDay = day; }

    const isRead = m.read_at != null || m.read === true;
    const bubble = el(`div.msg.${mine ? "me" : "them"}`, { dataset: { id: m.id || "" } }, [
      el("div", { text: m.body }),
      el("div.msg-time", {}, [
        clock(created),
        mine ? el("span.receipt", { html: isRead ? icons.checks({ w: 2.4 }) : icons.check({ w: 2.4 }), style: { color: isRead ? "#bfe9dd" : "inherit" } }) : null,
      ]),
    ]);
    if (animate) bubble.style.animation = "toastIn .2s ease";
    // insert before typing indicator if present
    const typingEl = scroll.querySelector(".typing");
    if (typingEl) scroll.insertBefore(bubble, typingEl); else scroll.appendChild(bubble);
    scrollDown();
  }

  function markMineRead() {
    scroll.querySelectorAll(".msg.me .receipt").forEach((r) => { r.innerHTML = icons.checks({ w: 2.4 }); r.style.color = "#bfe9dd"; });
  }

  function setTyping(on) {
    theyTyping = on;
    scroll.querySelector(".typing")?.remove();
    if (on) { scroll.appendChild(el("div.typing", {}, [el("span"), el("span"), el("span")])); scrollDown(); }
  }
  const scrollDown = () => requestAnimationFrame(() => { scroll.scrollTop = scroll.scrollHeight; });

  /* ---------- input ---------- */
  function drawInput() {
    const ta = el("textarea", { placeholder: "Nachricht…", rows: 1 });
    const send = el("button.send-btn", { html: icons.send({ w: 2.2 }), disabled: true });
    const autoGrow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; send.disabled = !ta.value.trim(); };
    let typingSent = 0;
    ta.addEventListener("input", () => {
      autoGrow();
      const now = Date.now();
      if (now - typingSent > 1500) { socket?.sendTyping(); typingSent = now; }
    });
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } });
    function doSend() {
      const body = ta.value.trim();
      if (!body) return;
      socket?.sendMessage(body);          // server echoes back → rendered then
      ta.value = ""; autoGrow();
    }
    send.addEventListener("click", doSend);
    mount(inputWrap, ta, send);
  }

  /* ---------- socket ---------- */
  function openSocket() {
    socket = new ChatSocket(matchId, {
      onMessage: (m) => {
        addMessage({ id: m.id, body: m.body, sender_id: m.sender_id, created_at: m.created_at, read_at: null }, { animate: true });
        if (m.sender_id !== meId) socket.sendRead(); // we're looking → mark read
        // keep matches list fresh
        if (match) { match.last_message = m.body; match.last_message_at = m.created_at; }
      },
      onTyping: () => { setTyping(true); clearTimeout(typingTimer); typingTimer = setTimeout(() => setTyping(false), 2500); },
      onRead: () => markMineRead(),
      onStatus: (s) => { if (s === "open") socket.sendRead(); },
    });
    socket.connect();
  }

  async function load() {
    drawHead(); drawInput();
    scroll.appendChild(el("div.loading-center", { style: { width: "100%" } }, [el("div.spinner")]));
    if (!match) { try { store.matches = await api.matches(); match = store.matches.find((m) => m.match_id === matchId); drawHead(); } catch {} }
    try {
      const msgs = await api.messages(matchId);
      clear(scroll); lastDay = null;
      (msgs || []).forEach((m) => addMessage(m));
      if (!msgs?.length) scroll.appendChild(el("div.empty", { style: { margin: "auto" } }, [
        el("div.big", { text: "👋" }), el("h3", { text: "Sag Hallo!" }),
        el("p", { text: `Brich das Eis mit ${match?.display_name || "deinem Match"}.` }),
      ]));
      openSocket();
    } catch (e) {
      clear(scroll);
      scroll.appendChild(el("div.empty", {}, [el("div.big", { text: "⚠️" }), el("h3", { text: "Chat nicht verfügbar" }), el("p", { text: e.message || "" })]));
    }
  }

  // presence updates while open
  const offPres = store.on("presence", drawHead);

  root._cleanup = () => { store.activeChat = null; socket?.close(); offPres(); };
  load();
}
