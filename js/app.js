/* app.js — bootstrap, hash router, app shell, live-socket wiring. */
import { api, tokens, config } from "./api.js";
import { store } from "./store.js";
import { liveSocket } from "./ws.js";
import { el, mount, clear, icons, toast } from "./ui.js";
import { renderAuth } from "./views/auth.js";
import { renderDiscover } from "./views/discover.js";
import { renderSearch } from "./views/search.js";
import { renderMatches } from "./views/matches.js";
import { renderChat } from "./views/chat.js";
import { renderProfile, renderProfileEdit, renderPhotos, renderPrompts, renderInterests } from "./views/profile.js";
import { renderSettings, renderVerify, renderSessions, renderBlocks, renderPrivacy, renderDeleteAccount } from "./views/settings.js";
import { celebrate } from "./views/celebrate.js";

const appRoot = document.getElementById("app");
store.apiVersion = config.V;

/* ---------------- Tab definitions ---------------- */
const TABS = [
  { key: "discover", label: "Entdecken", icon: icons.flame, route: "#/discover" },
  { key: "search", label: "Suchen", icon: icons.search, route: "#/search" },
  { key: "matches", label: "Chats", icon: icons.chat, route: "#/matches" },
  { key: "profile", label: "Profil", icon: icons.user, route: "#/profile" },
];

const HEADER_TITLES = { discover: "AETERN", search: "Suchen", matches: "Nachrichten", profile: "Profil" };

/* ---------------- Routes ---------------- */
const ROUTES = {
  "discover": { tab: "discover", render: renderDiscover },
  "search": { tab: "search", render: renderSearch },
  "matches": { tab: "matches", render: renderMatches },
  "profile": { tab: "profile", render: renderProfile },
  "profile/edit": { sub: true, render: renderProfileEdit },
  "profile/photos": { sub: true, render: renderPhotos },
  "profile/prompts": { sub: true, render: renderPrompts },
  "profile/interests": { sub: true, render: renderInterests },
  "settings": { sub: true, render: renderSettings },
  "settings/verify": { sub: true, render: renderVerify },
  "settings/sessions": { sub: true, render: renderSessions },
  "settings/blocks": { sub: true, render: renderBlocks },
  "settings/privacy": { sub: true, render: renderPrivacy },
  "settings/delete": { sub: true, render: renderDeleteAccount },
};

/* ---------------- Shell ---------------- */
let phone, headerSlot, screen, tabbarSlot, currentScreen;

function buildShell() {
  headerSlot = el("div");
  screen = el("div.screen");
  tabbarSlot = el("div");
  phone = el("div.phone", {}, [headerSlot, screen, tabbarSlot]);
  mount(appRoot, phone);
}

function renderHeader(route) {
  clear(headerSlot);
  if (route.tab) {
    const isDiscover = route.tab === "discover";
    headerSlot.appendChild(el("div.app-header", {}, [
      isDiscover
        ? el("div.h-title.brand-gradient-text", { html: `AET<span class="mag">ERN</span>` })
        : el("div.h-title", { text: HEADER_TITLES[route.tab] }),
      el("div.h-actions", {}, route.tab === "matches"
        ? [el("button.icon-btn", { html: icons.search(), onclick: () => location.hash = "#/search" })]
        : route.tab === "profile"
        ? [el("button.icon-btn", { html: icons.settings(), onclick: () => location.hash = "#/settings" })]
        : []),
    ]));
  }
}

function renderTabbar(activeTab) {
  clear(tabbarSlot);
  const bar = el("div.tabbar");
  TABS.forEach((t) => {
    const tab = el(`button.tab${t.key === activeTab ? ".on" : ""}`, { onclick: () => location.hash = t.route }, [
      el("span", { html: t.icon(t.key === activeTab && t.key === "discover" ? { fill: true } : {}) }),
      t.label,
    ]);
    if (t.key === "matches") {
      const n = store.totalUnread();
      if (n) tab.appendChild(el("span.tcount", { text: n > 9 ? "9+" : String(n) }));
    }
    bar.appendChild(tab);
  });
  tabbarSlot.appendChild(bar);
}

/* ---------------- Router ---------------- */
function parseHash() {
  const raw = (location.hash || "#/discover").replace(/^#\/?/, "");
  const parts = raw.split("/").filter(Boolean);
  if (parts[0] === "chat" && parts[1]) return { name: "chat", param: parts[1] };
  const key = parts.join("/") || "discover";
  return { name: ROUTES[key] ? key : "discover", param: null };
}

function navigate() {
  if (!tokens.isAuthed) return showAuth();
  const { name, param } = parseHash();

  // teardown previous screen (sockets/listeners)
  if (currentScreen?._cleanup) { try { currentScreen._cleanup(); } catch {} }

  // Chat = fullscreen (own header, no tabbar)
  if (name === "chat") {
    clear(headerSlot); clear(tabbarSlot);
    const full = el("div", { style: { display: "flex", flexDirection: "column", height: "100%" } });
    currentScreen = full;
    mount(screen, full);
    renderChat(full, param);
    return;
  }

  const route = ROUTES[name];
  renderHeader(route);
  renderTabbar(route.tab);
  const host = el("div");
  currentScreen = host;
  mount(screen, host);
  screen.scrollTop = 0;
  route.render(host);
}

/* ---------------- Live socket handlers ---------------- */
function wireLive() {
  store.on("new_match", (data) => {
    // refresh matches in background; celebrate (deduped if liker already saw it)
    api.matches().then((m) => { store.matches = m || []; store.emit("matches_loaded"); refreshChrome(); }).catch(() => {});
    celebrate({ name: data.display_name, display_name: data.display_name, photo_url: data.photo_url, user_id: data.user_id }, data.match_id);
  });

  store.on("new_message", (data) => {
    // update preview + ordering in store.matches
    const m = store.matches.find((x) => x.match_id === data.match_id);
    if (m && data.preview != null) { m.last_message = data.preview; m.last_message_at = data.created_at || new Date().toISOString(); store.matches = [m, ...store.matches.filter((x) => x !== m)]; }
    if (store.activeChat !== data.match_id && data.sender_name) toast(`💬 ${data.sender_name}: ${data.preview || ""}`, "info");
    refreshChrome();
  });

  store.on("presence", refreshChrome);
}

function refreshChrome() {
  // keep the tab badge in sync without a full re-render
  const { name } = parseHash();
  const route = ROUTES[name];
  if (route?.tab) renderTabbar(route.tab);
}

/* ---------------- Auth lifecycle ---------------- */
function showAuth() {
  liveSocket.close();
  if (currentScreen?._cleanup) { try { currentScreen._cleanup(); } catch {} currentScreen = null; }
  renderAuth(appRoot, onAuthed);
}

async function bootstrap() {
  buildShell();
  mount(screen, el("div.loading-center", {}, [el("div.spinner")]));
  try {
    const [me, interests] = await Promise.all([
      api.me(),
      api.interests().catch(() => []),
    ]);
    store.me = me;
    store.interestsCatalog = interests || [];
    api.matches().then((m) => { store.matches = m || []; store.emit("matches_loaded"); refreshChrome(); }).catch(() => {});
  } catch (e) {
    // me may 404 for admin accounts, or 401 if token invalid
    if (e.status === 401) { tokens.clear(); return showAuth(); }
    if (e.status === 404) { toast("Dieses Konto hat kein Dating-Profil (Admin?).", "err"); tokens.clear(); return showAuth(); }
    toast(e.message || "Konnte App nicht laden.", "err");
  }
  liveSocket.connect();
  if (!location.hash || location.hash === "#/") location.hash = "#/discover";
  navigate();
}

function onAuthed() {
  bootstrap();
}

window.__amoraLogout = async () => {
  try { await api.logout(); } catch {}
  liveSocket.close();
  tokens.clear();
  store.reset();
  location.hash = "";
  showAuth();
};

/* ---------------- Init ---------------- */
window.addEventListener("hashchange", () => { if (tokens.isAuthed && phone) navigate(); });
wireLive();

if (tokens.isAuthed) bootstrap();
else { buildShell(); showAuth(); }
