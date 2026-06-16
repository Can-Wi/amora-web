/* views/matches.js — list of matches + "new matches" rail, live-updated. */
import { api, ApiError } from "../api.js";
import { store } from "../store.js";
import { el, mount, clear, avatar, timeAgo, toast, icons } from "../ui.js";

export function renderMatches(screen) {
  let loading = true;
  const root = el("div");
  mount(screen, root);

  function draw() {
    clear(root);
    if (loading) { root.appendChild(el("div.loading-center", { style: { height: "60vh" } }, [el("div.spinner")])); return; }

    const matches = store.matches;
    if (!matches.length) {
      root.appendChild(el("div.empty", { style: { paddingTop: "70px" } }, [
        el("div.big", { text: "💌" }),
        el("h3", { text: "Noch keine Matches" }),
        el("p", { text: "Wenn du und jemand anderes euch gegenseitig liked, erscheint hier euer Match. Auf geht's!" }),
        el("button.btn.btn-primary", { text: "Profile entdecken", onclick: () => location.hash = "#/discover" }),
      ]));
      return;
    }

    // New matches (no message yet) → rail
    const fresh = matches.filter((m) => !m.last_message);
    if (fresh.length) {
      root.appendChild(el("div.section-title", { text: "Neue Matches" }));
      root.appendChild(el("div.rail", {}, fresh.map((m) => el("div.rail-item", { onclick: () => openChat(m.match_id) }, [
        el("div.rail-ring", {}, [avatar(m.display_name, m.photo_url, 58, { online: store.online.has(m.user_id) })]),
        el("div.nm", { text: m.display_name }),
      ]))));
    }

    // Conversations
    const convos = matches.filter((m) => m.last_message);
    root.appendChild(el("div.section-title", { text: convos.length ? "Nachrichten" : "Sag Hallo 👋" }));
    const list = el("div");
    (convos.length ? convos : []).forEach((m) => list.appendChild(rowEl(m)));
    if (!convos.length && fresh.length) {
      list.appendChild(el("div.empty", { style: { padding: "24px" } }, [el("p", { text: "Starte ein Gespräch mit einem deiner neuen Matches oben." })]));
    }
    root.appendChild(list);
  }

  function rowEl(m) {
    const unread = store.unread[m.match_id] || 0;
    const online = store.online.has(m.user_id);
    return el("div.list-item", { dataset: { mid: m.match_id }, onclick: () => openChat(m.match_id) }, [
      avatar(m.display_name, m.photo_url, 56, { online }),
      el("div.li-main", {}, [
        el("div.li-name", {}, [m.display_name, online ? el("span.dot-online") : null]),
        el("div", { class: "li-sub" + (unread ? " unread" : ""), text: m.last_message || "Neues Match — sag Hallo!" }),
      ]),
      el("div.li-meta", {}, [
        el("div.li-time", { text: timeAgo(m.last_message_at || m.created_at) }),
        unread ? el("div.li-unread", { text: unread > 9 ? "9+" : String(unread) }) : null,
      ]),
    ]);
  }

  function openChat(id) { location.hash = `#/chat/${id}`; }

  async function load() {
    try {
      const data = await api.matches();
      store.matches = data || [];
      // sync unread keys (keep counts we already track from live socket)
      store.emit("matches_loaded");
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) toast(e.message || "Matches konnten nicht geladen werden.", "err");
    }
    loading = false; draw();
  }

  // Re-render on live events while this screen is mounted
  const offs = [
    store.on("new_message", draw),
    store.on("new_match", () => load()),
    store.on("presence", draw),
  ];
  screen._cleanup = () => offs.forEach((off) => off());

  draw();
  load();
}
