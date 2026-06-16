/*
 * api.js — thin client over the Aetern (AMORA) REST API.
 *
 * Handles JWT storage, transparent access-token refresh on 401, and exposes
 * one function per backend endpoint. Versioned paths use AETERN_CONFIG.apiVersion.
 */

const CFG = window.AETERN_CONFIG;
const BASE = CFG.apiBase.replace(/\/$/, "");
const V = CFG.apiVersion || "v2";
const PREFIX = `${BASE}/api/${V}`;

const TOKENS_KEY = "amora.tokens";

export const tokens = {
  get access() { return (this._t() || {}).access || null; },
  get refresh() { return (this._t() || {}).refresh || null; },
  _t() { try { return JSON.parse(localStorage.getItem(TOKENS_KEY) || "null"); } catch { return null; } },
  set(access, refresh) {
    const cur = this._t() || {};
    localStorage.setItem(TOKENS_KEY, JSON.stringify({ access, refresh: refresh ?? cur.refresh }));
  },
  clear() { localStorage.removeItem(TOKENS_KEY); },
  get isAuthed() { return !!this.access; },
};

/** Raised for any non-2xx response; `.data` carries the parsed body. */
export class ApiError extends Error {
  constructor(status, data) {
    super(ApiError.firstMessage(data) || `HTTP ${status}`);
    this.status = status;
    this.data = data;
  }
  static firstMessage(data) {
    if (!data) return null;
    if (typeof data === "string") return data;
    if (data.detail) return Array.isArray(data.detail) ? data.detail[0] : data.detail;
    // DRF field errors → first one
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return first[0];
    if (typeof first === "string") return first;
    return null;
  }
}

let refreshing = null;

async function doRefresh() {
  if (!tokens.refresh) throw new ApiError(401, { detail: "Keine Sitzung." });
  if (!refreshing) {
    refreshing = fetch(`${PREFIX}/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    }).then(async (r) => {
      if (!r.ok) { tokens.clear(); throw new ApiError(r.status, await safeJson(r)); }
      const data = await r.json();
      tokens.set(data.access, data.refresh); // refresh rotation enabled server-side
      return data.access;
    }).finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function safeJson(r) {
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) { try { return await r.json(); } catch { return null; } }
  try { return await r.text(); } catch { return null; }
}

/**
 * Core request. `opts`: { method, body, auth, query, raw, isForm }
 */
async function request(path, opts = {}, _retried = false) {
  const { method = "GET", body, auth = true, query, raw = false, isForm = false } = opts;
  let url = path.startsWith("http") ? path : `${PREFIX}${path}`;
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }
  const headers = {};
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  let payload = body;
  if (body && !isForm) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch (networkErr) {
    throw new ApiError(0, { detail: "Netzwerkfehler — ist die API erreichbar?" });
  }

  if (res.status === 401 && auth && !_retried && tokens.refresh) {
    try { await doRefresh(); return request(path, opts, true); }
    catch { tokens.clear(); throw new ApiError(401, { detail: "Sitzung abgelaufen." }); }
  }

  if (raw) {
    if (!res.ok) throw new ApiError(res.status, await safeJson(res));
    return res;
  }
  if (res.status === 204) return null;
  const data = await safeJson(res);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

/* ============================ Endpoints ============================ */
export const api = {
  // meta
  meta: () => request("/meta/", { auth: false }),

  // auth / security
  register: (data) => request("/auth/register/", { method: "POST", body: data, auth: false }),
  async login(email, password) {
    const data = await request("/auth/login/", { method: "POST", body: { email, password }, auth: false });
    tokens.set(data.access, data.refresh);
    return data;
  },
  logout: () => request("/auth/logout/", { method: "POST", body: { refresh: tokens.refresh } }).catch(() => {}),
  sessions: () => request("/auth/sessions/"),
  revokeSession: (id) => request(`/auth/sessions/${id}/revoke/`, { method: "POST" }),
  logoutAll: () => request("/auth/logout-all/", { method: "POST" }),
  verifyRequest: () => request("/auth/verify/request/", { method: "POST" }),
  verifyConfirm: (code) => request("/auth/verify/confirm/", { method: "POST", body: { code } }),

  // me / profile
  me: () => request("/auth/me/"),
  updateMe: (patch) => request("/auth/me/", { method: "PATCH", body: patch }),

  // discover / matching
  discover: (radius) => request("/discover/", { query: { radius } }),
  like: (toUser, action = "like") => request("/like/", { method: "POST", body: { to_user: toUser, action } }),
  matches: () => request("/matches/"),
  unmatch: (id) => request(`/matches/${id}/`, { method: "DELETE" }),

  // chat
  messages: (matchId) => request(`/matches/${matchId}/messages/`),

  // search / interests
  interests: () => request("/interests/"),
  search: (params) => request("/search/", { query: params }),

  // photos
  photos: () => request("/photos/"),
  uploadPhoto: (file, isPrimary = false) => {
    const fd = new FormData();
    fd.append("image", file);
    if (isPrimary) fd.append("is_primary", "true");
    return request("/photos/", { method: "POST", body: fd, isForm: true });
  },
  deletePhoto: (id) => request(`/photos/${id}/`, { method: "DELETE" }),

  // prompts
  prompts: () => request("/prompts/"),
  myPrompts: () => request("/me/prompts/"),
  addPrompt: (promptId, answer) => request("/me/prompts/", { method: "POST", body: { prompt: promptId, answer } }),
  deletePrompt: (id) => request(`/me/prompts/${id}/`, { method: "DELETE" }),

  // safety
  block: (userId) => request("/block/", { method: "POST", body: { user_id: userId } }),
  unblock: (userId) => request("/unblock/", { method: "POST", body: { user_id: userId } }),
  blocks: () => request("/blocks/"),
  report: (userId, reason, detail) => request("/report/", { method: "POST", body: { user_id: userId, reason, detail } }),

  // privacy / DSGVO
  consents: () => request("/privacy/consents/"),
  setConsent: (purpose, granted) => request("/privacy/consents/", { method: "POST", body: { purpose, granted } }),
  processingLog: () => request("/privacy/log/"),
  deleteAccount: (password) => request("/privacy/account/delete/", { method: "POST", body: { password, confirm: true } }),
  async exportData() {
    const res = await request("/privacy/export/", { raw: true });
    return res.blob();
  },
};

export const config = { BASE, PREFIX, V, wsBase: CFG.wsBase.replace(/\/$/, "") };
