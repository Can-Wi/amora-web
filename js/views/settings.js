/* views/settings.js — settings menu, email verify, sessions, blocks, privacy/DSGVO. */
import { api } from "../api.js";
import { store } from "../store.js";
import { el, mount, clear, icons, toast, confirmDialog, timeAgo, avatar } from "../ui.js";

const backRow = (title, to = "#/settings") => el("div.detail-back", { onclick: () => location.hash = to }, [icons.back(), title]);

/* ============================ Menu ============================ */
export function renderSettings(screen) {
  const me = store.me;
  const tile = (ico, title, sub, to, color) => el("div.tile", { onclick: () => location.hash = to }, [
    el("div.t-ico", { html: ico, style: color ? { color } : {} }), el("div.t-main", {}, [el("div.t-title", { text: title }), el("div.t-sub", { text: sub })]), el("span.chev", { html: icons.chevron() }),
  ]);
  mount(screen,
    el("div.detail-back", { onclick: () => location.hash = "#/profile" }, [icons.back(), "Einstellungen"]),
    el("div.tile-group", {}, [
      tile(icons.shield(), "E-Mail-Verifizierung", me?.email_verified ? "✓ Verifiziert" : "Nicht verifiziert", "#/settings/verify"),
      tile(icons.device(), "Aktive Sitzungen", "Geräte verwalten & abmelden", "#/settings/sessions"),
      tile(icons.x(), "Blockierte Nutzer", "Blockliste verwalten", "#/settings/blocks"),
    ]),
    el("div.tile-group", {}, [
      tile(icons.lock(), "Privatsphäre & DSGVO", "Einwilligungen, Export, Protokoll", "#/settings/privacy"),
    ]),
    el("div.tile-group", { style: { borderColor: "#ffd9dd" } }, [
      tile(icons.trash(), "Konto löschen", "Alle Daten unwiderruflich löschen", "#/settings/delete", "var(--nope)"),
    ]),
  );
}

/* ============================ Email verify ============================ */
export function renderVerify(screen) {
  const root = el("div");
  mount(screen, backRow("E-Mail-Verifizierung"), root);
  const me = store.me;
  if (me?.email_verified) {
    root.appendChild(el("div.empty", { style: { paddingTop: "60px" } }, [
      el("div.big", { text: "✅" }), el("h3", { text: "Bereits verifiziert" }), el("p", { text: "Deine E-Mail-Adresse ist bestätigt." }),
    ]));
    return;
  }
  const codeIn = el("input.input.code-input", { maxlength: 6, placeholder: "······", inputmode: "numeric" });
  const confirmBtn = el("button.btn.btn-primary.btn-block", { text: "Code bestätigen" });
  const requestBtn = el("button.btn.btn-ghost.btn-block", { text: "Code anfordern" });

  requestBtn.addEventListener("click", async () => {
    requestBtn.disabled = true; requestBtn.textContent = "Sende…";
    try {
      const res = await api.verifyRequest();
      toast(res?.code ? `Dev-Code: ${res.code}` : "Code per E-Mail gesendet.", "ok");
      if (res?.code) codeIn.value = res.code; // dev convenience
    } catch (e) { toast(e.message, "err"); }
    requestBtn.disabled = false; requestBtn.textContent = "Code erneut anfordern";
  });
  confirmBtn.addEventListener("click", async () => {
    if (!codeIn.value.trim()) return toast("Bitte Code eingeben.", "err");
    confirmBtn.disabled = true; confirmBtn.textContent = "Prüfe…";
    try {
      await api.verifyConfirm(codeIn.value.trim());
      store.me = await api.me();
      toast("E-Mail verifiziert ✓", "ok"); location.hash = "#/settings";
    } catch (e) { toast(e.message, "err"); confirmBtn.disabled = false; confirmBtn.textContent = "Code bestätigen"; }
  });

  mount(root, el("div.screen-pad.stack", {}, [
    el("p.muted", { text: `Wir senden einen 6-stelligen Code an ${me?.email || "deine E-Mail"}. Gib ihn unten ein, um dein Konto zu verifizieren.` }),
    requestBtn,
    el("div.field", {}, [el("label", { text: "Bestätigungscode" }), codeIn]),
    confirmBtn,
  ]));
}

/* ============================ Sessions ============================ */
export function renderSessions(screen) {
  const root = el("div");
  mount(screen, backRow("Aktive Sitzungen"), root);
  const list = el("div");
  root.appendChild(list);

  async function load() {
    clear(list); list.appendChild(el("div.loading-center", { style: { height: "120px" } }, [el("div.spinner")]));
    let sessions = [];
    try { sessions = await api.sessions(); } catch (e) { toast(e.message, "err"); }
    clear(list);
    if (!sessions.length) { list.appendChild(el("div.empty", { style: { paddingTop: "40px" } }, [el("p", { text: "Keine aktiven Sitzungen." })])); return; }
    const group = el("div.tile-group", {});
    sessions.forEach((s) => group.appendChild(el("div.tile", {}, [
      el("div.t-ico", { html: icons.device() }),
      el("div.t-main", {}, [el("div.t-title", { text: s.device || "Unbekanntes Gerät" }), el("div.t-sub", { text: `${s.ip || "—"} · zuletzt ${timeAgo(s.last_seen || s.created_at)}` })]),
      el("button.btn.btn-danger.btn-sm", { text: "Beenden", onclick: async () => {
        try { await api.revokeSession(s.id); toast("Sitzung beendet.", "ok"); load(); } catch (e) { toast(e.message, "err"); }
      } }),
    ])));
    list.appendChild(group);
    list.appendChild(el("div.screen-pad", {}, [el("button.btn.btn-ghost.btn-block", { text: "Alle anderen abmelden", onclick: async () => {
      if (await confirmDialog({ title: "Alle abmelden?", body: "Alle Sitzungen (inkl. dieser) werden beendet.", confirmLabel: "Abmelden", danger: true })) {
        try { await api.logoutAll(); toast("Alle Sitzungen beendet.", "ok"); window.__amoraLogout?.(); } catch (e) { toast(e.message, "err"); }
      }
    } })]));
  }
  load();
}

/* ============================ Blocks ============================ */
export function renderBlocks(screen) {
  const root = el("div");
  mount(screen, backRow("Blockierte Nutzer"), root);
  const list = el("div");
  root.appendChild(list);
  async function load() {
    clear(list); list.appendChild(el("div.loading-center", { style: { height: "120px" } }, [el("div.spinner")]));
    let blocks = [];
    try { blocks = await api.blocks(); } catch (e) { toast(e.message, "err"); }
    clear(list);
    if (!blocks.length) { list.appendChild(el("div.empty", { style: { paddingTop: "50px" } }, [el("div.big", { text: "🤝" }), el("h3", { text: "Niemand blockiert" }), el("p", { text: "Blockierte Nutzer erscheinen hier." })])); return; }
    blocks.forEach((b) => list.appendChild(el("div.list-item", {}, [
      avatar(b.display_name || "?", null, 48),
      el("div.li-main", {}, [el("div.li-name", { text: b.display_name || `Nutzer #${b.user_id}` }), el("div.li-sub", { text: `blockiert ${timeAgo(b.created_at)}` })]),
      el("button.btn.btn-ghost.btn-sm", { text: "Entsperren", onclick: async () => {
        try { await api.unblock(b.user_id); toast("Entsperrt.", "ok"); load(); } catch (e) { toast(e.message, "err"); }
      } }),
    ])));
  }
  load();
}

/* ============================ Privacy / DSGVO ============================ */
export function renderPrivacy(screen) {
  const root = el("div");
  mount(screen, backRow("Privatsphäre & DSGVO"), root);
  const content = el("div");
  root.appendChild(content);

  async function load() {
    clear(content); content.appendChild(el("div.loading-center", { style: { height: "120px" } }, [el("div.spinner")]));
    let data, logs = [];
    try { [data, logs] = await Promise.all([api.consents(), api.processingLog().catch(() => [])]); }
    catch (e) { clear(content); content.appendChild(el("p.screen-pad.muted", { text: e.message })); return; }
    clear(content);

    // Consents
    const essential = new Set(data.essential || []);
    const consentGroup = el("div.tile-group", {});
    Object.entries(data.purposes || {}).forEach(([key, label]) => {
      const granted = !!data.consents?.[key];
      const sw = el("input", { type: "checkbox" }); sw.checked = granted;
      const isEssential = essential.has(key);
      sw.addEventListener("change", async () => {
        if (isEssential && !sw.checked) {
          const ok = await confirmDialog({ title: "Sicher?", body: "Widerrufst du eine essenzielle Einwilligung, wird dein Konto pausiert.", confirmLabel: "Widerrufen", danger: true });
          if (!ok) { sw.checked = true; return; }
        }
        try {
          const res = await api.setConsent(key, sw.checked);
          toast("Gespeichert.", "ok");
          if (res.account_restricted) { toast("Konto pausiert.", "info"); }
        } catch (e) { toast(e.message, "err"); sw.checked = granted; }
      });
      consentGroup.appendChild(el("div.tile", {}, [
        el("div.t-main", {}, [el("div.t-title", { text: label }), el("div.t-sub", { text: isEssential ? "Essenziell" : "Optional" })]),
        el("label.switch", {}, [sw, el("span.sl")]),
      ]));
    });
    content.append(el("div.section-title", { text: "Einwilligungen" }), consentGroup);
    content.appendChild(el("p.screen-pad.muted.small", { style: { paddingTop: "6px", paddingBottom: 0 }, text: `Datenschutz-Version ${data.policy_version || "1.0"}` }));

    // Export
    content.append(el("div.section-title", { text: "Deine Daten" }), el("div.screen-pad.stack", {}, [
      el("button.btn.btn-ghost.btn-block", { html: `${icons.download()} Daten exportieren (JSON)`, onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true;
        try {
          const blob = await api.exportData();
          const url = URL.createObjectURL(blob);
          const a = el("a", { href: url, download: "amora-meine-daten.json" }); document.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(url); toast("Export heruntergeladen ✓", "ok");
        } catch (err) { toast(err.message, "err"); }
        b.disabled = false;
      } }),
    ]));

    // Processing log
    content.appendChild(el("div.section-title", { text: "Verarbeitungsprotokoll" }));
    if (!logs.length) content.appendChild(el("p.screen-pad.muted.small", { text: "Keine Einträge." }));
    else {
      const lg = el("div.tile-group", {});
      logs.slice(0, 30).forEach((l) => lg.appendChild(el("div.tile", {}, [
        el("div.t-main", {}, [el("div.t-title", { text: l.action }), el("div.t-sub", { text: `${l.detail ? l.detail + " · " : ""}${new Date(l.created_at).toLocaleString("de-DE")}` })]),
      ])));
      content.appendChild(lg);
    }
  }
  load();
}

/* ============================ Account deletion ============================ */
export function renderDeleteAccount(screen) {
  const root = el("div");
  mount(screen, backRow("Konto löschen"), root);
  const pass = el("input.input", { type: "password", placeholder: "Passwort bestätigen" });
  const btn = el("button.btn.btn-danger.btn-block", { text: "Konto endgültig löschen" });
  btn.addEventListener("click", async () => {
    if (!pass.value) return toast("Bitte Passwort eingeben.", "err");
    const ok = await confirmDialog({ title: "Wirklich löschen?", body: "Dein Konto und ALLE Daten (Matches, Chats, Fotos) werden unwiderruflich gelöscht.", confirmLabel: "Ja, löschen", danger: true });
    if (!ok) return;
    btn.disabled = true; btn.textContent = "Lösche…";
    try {
      await api.deleteAccount(pass.value);
      toast("Konto gelöscht.", "ok");
      window.__amoraLogout?.();
    } catch (e) { toast(e.message, "err"); btn.disabled = false; btn.textContent = "Konto endgültig löschen"; }
  });
  mount(root, el("div.screen-pad.stack", {}, [
    el("div.form-error", { html: "<b>Achtung:</b> Diese Aktion kann nicht rückgängig gemacht werden (Art. 17 DSGVO — Recht auf Löschung)." }),
    el("p.muted", { text: "Zur Sicherheit bestätige bitte dein Passwort." }),
    el("div.field", {}, [el("label", { text: "Passwort" }), pass]),
    btn,
  ]));
}
