/*
 * ws.js — WebSocket managers.
 *
 *  liveSocket  → app-wide channel  /ws/<v>/live/?token=    (presence, new msgs, new matches)
 *  ChatSocket  → per-match channel /ws/<v>/chat/<id>/?token= (messages, typing, read)
 *
 * Both auto-reconnect with backoff and re-auth using the current access token.
 */
import { tokens, config } from "./api.js";
import { store } from "./store.js";

const WS_PREFIX = `${config.wsBase}/ws/${config.V}`;

/* ----------------------------- Live socket ----------------------------- */
class LiveSocket {
  constructor() { this.ws = null; this.retry = 0; this.closed = false; }

  connect() {
    this.closed = false;
    if (!tokens.access) return;
    this._open();
  }
  _open() {
    if (this.closed) return;
    try { this.ws = new WebSocket(`${WS_PREFIX}/live/?token=${encodeURIComponent(tokens.access)}`); }
    catch { return this._scheduleReconnect(); }

    this.ws.onopen = () => { this.retry = 0; };
    this.ws.onmessage = (e) => this._onMessage(e);
    this.ws.onclose = () => { if (!this.closed) this._scheduleReconnect(); };
    this.ws.onerror = () => { try { this.ws.close(); } catch {} };
  }
  _scheduleReconnect() {
    this.retry = Math.min(this.retry + 1, 6);
    setTimeout(() => this._open(), 600 * this.retry);
  }
  _onMessage(e) {
    let data; try { data = JSON.parse(e.data); } catch { return; }
    switch (data.type) {
      case "presence_snapshot":
        store.online = new Set(data.online || []);
        store.emit("presence", { snapshot: true });
        break;
      case "presence":
        store.setOnline(data.user_id, data.online);
        break;
      case "new_message":
        // Bump unread unless the user is currently viewing that chat.
        if (store.activeChat !== data.match_id) {
          store.unread[data.match_id] = (store.unread[data.match_id] || 0) + 1;
        }
        store.emit("new_message", data);
        break;
      case "new_match":
        store.emit("new_match", data);
        break;
    }
  }
  close() { this.closed = true; try { this.ws && this.ws.close(); } catch {} this.ws = null; }
}
export const liveSocket = new LiveSocket();

/* ----------------------------- Chat socket ----------------------------- */
export class ChatSocket {
  constructor(matchId, handlers = {}) {
    this.matchId = matchId;
    this.h = handlers;           // { onMessage, onTyping, onRead, onStatus }
    this.ws = null; this.retry = 0; this.closed = false;
  }
  connect() { this.closed = false; this._open(); }
  _open() {
    if (this.closed || !tokens.access) return;
    try { this.ws = new WebSocket(`${WS_PREFIX}/chat/${this.matchId}/?token=${encodeURIComponent(tokens.access)}`); }
    catch { return this._scheduleReconnect(); }
    this.ws.onopen = () => { this.retry = 0; this.h.onStatus?.("open"); };
    this.ws.onmessage = (e) => {
      let d; try { d = JSON.parse(e.data); } catch { return; }
      if (d.type === "typing") this.h.onTyping?.(d);
      else if (d.type === "read") this.h.onRead?.(d);
      else this.h.onMessage?.(d); // chat.message events arrive without a wrapping type key
    };
    this.ws.onclose = () => { this.h.onStatus?.("closed"); if (!this.closed) this._scheduleReconnect(); };
    this.ws.onerror = () => { try { this.ws.close(); } catch {} };
  }
  _scheduleReconnect() { this.retry = Math.min(this.retry + 1, 6); setTimeout(() => this._open(), 500 * this.retry); }
  _send(obj) { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj)); }
  sendMessage(body) { this._send({ type: "message", body }); }
  sendTyping() { this._send({ type: "typing" }); }
  sendRead() { this._send({ type: "read" }); }
  close() { this.closed = true; try { this.ws && this.ws.close(); } catch {} this.ws = null; }
}
