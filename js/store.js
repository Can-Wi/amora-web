/* store.js — shared app state with a tiny pub/sub. */

const listeners = new Map(); // event -> Set<fn>

export const store = {
  me: null,            // own profile (from /auth/me/)
  matches: [],         // [{match_id, user_id, display_name, photo_url, last_message, ...}]
  online: new Set(),   // user_ids currently online (from live WS)
  unread: {},          // { match_id: count }
  interestsCatalog: [], // [{slug,name,icon,category,category_label}]

  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
  },
  emit(event, payload) {
    listeners.get(event)?.forEach((fn) => { try { fn(payload); } catch (e) { console.error(e); } });
    if (event !== "*") this.emit("*", { event, payload });
  },

  totalUnread() {
    return Object.values(this.unread).reduce((a, b) => a + (b || 0), 0);
  },
  setOnline(userId, isOnline) {
    if (isOnline) this.online.add(userId); else this.online.delete(userId);
    this.emit("presence", { userId, isOnline });
  },
  reset() {
    this.me = null; this.matches = []; this.online = new Set();
    this.unread = {}; this.interestsCatalog = [];
  },
};
