/* views/profile.js — own profile overview + edit, photos, prompts, interests. */
import { api } from "../api.js";
import { store } from "../store.js";
import { el, mount, clear, avatar, icons, toast, LABELS, confirmDialog } from "../ui.js";

const backRow = (title, to = "#/profile") =>
  el("div.detail-back", { onclick: () => location.hash = to }, [icons.back(), title]);

/* ============================ Overview ============================ */
export function renderProfile(screen) {
  const root = el("div");
  mount(screen, root);

  function completeness(me) {
    const checks = [me.bio, me.dating_goal, me.height_cm, me.job_title, me.languages,
      me.interests?.length, me.photo_url, (me.smoking || me.drinking)];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }

  function draw() {
    const me = store.me;
    clear(root);
    if (!me) { root.appendChild(el("div.loading-center", { style: { height: "50vh" } }, [el("div.spinner")])); return; }
    const pct = completeness(me);

    // hero
    const av = avatar(me.display_name, me.photo_url, 104);
    av.style.boxShadow = "0 10px 26px rgba(150,50,95,.28)";
    root.appendChild(el("div.profile-hero", {}, [
      el("div.av-wrap", {}, [av, el("button.edit-cam", { html: icons.camera({ w: 2 }), onclick: () => location.hash = "#/profile/photos" })]),
      el("h2", {}, [`${me.display_name}`, me.age != null ? el("span", { text: `, ${me.age}`, style: { fontWeight: 600 } }) : null]),
      el("div.ph-sub", {}, [me.email, me.is_verified ? el("span.badge.badge-verified", { html: ` ${icons.check({ w: 3 })} Verifiziert`, style: { marginLeft: "6px" } }) : null]),
    ]));

    // completeness
    root.appendChild(el("div.profile-complete", {}, [
      el("div.flex.between.small.b", {}, [el("span", { text: "Profil-Vollständigkeit" }), el("span", { text: pct + "%" })]),
      el("div.pc-bar", { style: { marginTop: "6px" } }, [el("div.pc-fill", { style: { width: pct + "%" } })]),
    ]));

    // email verify banner
    if (!me.email_verified) {
      root.appendChild(el("div.tile-group", { style: { borderColor: "#ffe0c0", background: "#fff8ef" } }, [
        el("div.tile", { onclick: () => location.hash = "#/settings/verify" }, [
          el("div.t-ico", { html: icons.bell(), style: { background: "#fff0db", color: "#b5760a" } }),
          el("div.t-main", {}, [el("div.t-title", { text: "E-Mail bestätigen" }), el("div.t-sub", { text: "Verifiziere dein Konto für mehr Vertrauen." })]),
          el("span.chev", { html: icons.chevron() }),
        ]),
      ]));
    }

    // tiles
    const tile = (ico, title, sub, to, color) => el("div.tile", { onclick: () => location.hash = to }, [
      el("div.t-ico", { html: ico, style: color ? { color } : {} }), el("div.t-main", {}, [el("div.t-title", { text: title }), el("div.t-sub", { text: sub })]), el("span.chev", { html: icons.chevron() }),
    ]);
    root.appendChild(el("div.tile-group", {}, [
      tile(icons.edit(), "Profil bearbeiten", "Bio, Steckbrief, Social & Präferenzen", "#/profile/edit"),
      tile(icons.camera(), "Meine Fotos", "Bilder hochladen & verwalten", "#/profile/photos"),
      tile(icons.chat(), "Steckbrief-Rubriken", "Hinge-Style Fragen beantworten", "#/profile/prompts"),
      tile(icons.spark(), "Interessen", `${me.interests?.length || 0} ausgewählt`, "#/profile/interests"),
    ]));
    root.appendChild(el("div.tile-group", {}, [
      tile(icons.settings(), "Einstellungen", "Konto, Sicherheit & Privatsphäre", "#/settings"),
    ]));

    root.appendChild(el("div", { style: { padding: "8px 16px 30px" } }, [
      el("button.btn.btn-ghost.btn-block", { html: `${icons.logout()} Abmelden`, onclick: async () => {
        if (await confirmDialog({ title: "Abmelden?", body: "Du wirst von diesem Gerät abgemeldet." })) window.__amoraLogout?.();
      } }),
      el("div.center.small.muted", { style: { marginTop: "14px" } }, [`AMORA · ${store.apiVersion || ""}`, me.member_since ? ` · Mitglied seit ${new Date(me.member_since).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}` : ""]),
    ]));
  }

  store._profileRefresh = draw;
  draw();
}

/* ============================ Edit ============================ */
export function renderProfileEdit(screen) {
  const me = store.me;
  const root = el("div");
  mount(screen, backRow("Profil bearbeiten"), root);
  if (!me) { root.appendChild(el("div.loading-center", { style: { height: "40vh" } }, [el("div.spinner")])); return; }

  const f = {};
  const inp = (key, attrs = {}) => { const e = el("input.input", { value: me[key] ?? "", ...attrs }); f[key] = () => e.value; return e; };
  const txt = (key, attrs = {}) => { const e = el("textarea.textarea", { html: me[key] ?? "", ...attrs }); f[key] = () => e.value; return e; };
  const sel = (key, options) => {
    const e = el("select.select", {}, [el("option", { value: "", text: "—" }), ...options.map(([v, l]) => el("option", { value: v, text: l }))]);
    e.value = me[key] ?? ""; f[key] = () => e.value; return e;
  };

  const name = inp("display_name", { maxlength: 50 });
  const bio = txt("bio", { maxlength: 500, placeholder: "Erzähl etwas über dich…" });
  const goal = sel("dating_goal", Object.entries(LABELS.dating_goal));
  const height = inp("height_cm", { type: "number", min: 120, max: 230, placeholder: "z. B. 178" });
  const job = inp("job_title", { placeholder: "z. B. Designerin" });
  const edu = inp("education", { placeholder: "z. B. TU Berlin" });
  const langs = inp("languages", { placeholder: "Deutsch, Englisch" });
  const smoking = sel("smoking", Object.entries(LABELS.frequency));
  const drinking = sel("drinking", Object.entries(LABELS.frequency));
  const look = sel("looking_for", Object.entries(LABELS.looking_for));
  const insta = inp("instagram", { placeholder: "@handle" });
  const snap = inp("snapchat", { placeholder: "username" });
  const spotify = inp("spotify", { placeholder: "spotify-user-id" });
  const youtube = inp("youtube", { placeholder: "@handle" });
  const photoUrl = inp("photo_url", { placeholder: "https://…", type: "url" });

  const minAge = inp("pref_min_age", { type: "number", min: 18, max: 99 });
  const maxAge = inp("pref_max_age", { type: "number", min: 18, max: 99 });
  const maxDist = inp("pref_max_distance_km", { type: "number", min: 1, max: 500 });
  const visible = el("input", { type: "checkbox" }); visible.checked = me.is_visible !== false;

  const locStatus = el("div.hint", { text: me.latitude ? "✓ Standort gesetzt" : "Kein Standort gesetzt" });
  let lat = me.latitude, lng = me.longitude;
  const locBtn = el("button.btn.btn-ghost.btn-block", { html: `${icons.pin()} Standort aktualisieren`, onclick: () => {
    locBtn.disabled = true; locStatus.textContent = "Ermittle…";
    navigator.geolocation?.getCurrentPosition(
      (pos) => { lat = pos.coords.latitude; lng = pos.coords.longitude; locStatus.textContent = "✓ Neuer Standort gesetzt (beim Speichern übernommen)"; locBtn.disabled = false; },
      () => { locStatus.textContent = "Standort nicht verfügbar."; locBtn.disabled = false; }, { timeout: 8000 });
  } });

  const group = (title, ...kids) => el("div", {}, [el("div.section-title", { text: title }), el("div.screen-pad", { style: { paddingTop: 0 } }, [el("div.stack", {}, kids)])]);
  const field = (label, node, hint) => el("div.field", { style: { margin: 0 } }, [el("label", { text: label }), node, hint ? el("div.hint", { text: hint }) : null]);

  const saveBtn = el("button.btn.btn-primary.btn-block", { text: "Speichern" });
  saveBtn.addEventListener("click", async () => {
    const patch = {
      display_name: f.display_name(), bio: f.bio(), dating_goal: f.dating_goal() || "",
      height_cm: f.height_cm() ? Number(f.height_cm()) : null,
      job_title: f.job_title(), education: f.education(), languages: f.languages(),
      smoking: f.smoking() || "", drinking: f.drinking() || "", looking_for: f.looking_for() || "everyone",
      instagram: f.instagram(), snapchat: f.snapchat(), spotify: f.spotify(), youtube: f.youtube(),
      photo_url: f.photo_url(),
      pref_min_age: Number(f.pref_min_age()) || 18, pref_max_age: Number(f.pref_max_age()) || 99,
      pref_max_distance_km: Number(f.pref_max_distance_km()) || 100,
      is_visible: visible.checked,
    };
    if (lat != null && lng != null) { patch.latitude = lat; patch.longitude = lng; }
    saveBtn.disabled = true; saveBtn.textContent = "Speichere…";
    try {
      store.me = await api.updateMe(patch);
      toast("Profil gespeichert ✓", "ok");
      location.hash = "#/profile";
    } catch (e) { toast(e.message || "Speichern fehlgeschlagen.", "err"); saveBtn.disabled = false; saveBtn.textContent = "Speichern"; }
  });

  mount(root,
    group("Über dich",
      field("Anzeigename", name),
      field("Über mich", bio),
      field("Foto-URL (optional)", photoUrl, "Oder lade Fotos unter „Meine Fotos“ hoch."),
    ),
    group("Steckbrief",
      field("Ich suche", look),
      field("Dating-Ziel", goal),
      el("div.row", {}, [field("Größe (cm)", height), field("Sprachen", langs)]),
      field("Job", job),
      field("Ausbildung", edu),
      el("div.row", {}, [field("Rauchen", smoking), field("Trinken", drinking)]),
    ),
    group("Social",
      el("div.row", {}, [field("Instagram", insta), field("Snapchat", snap)]),
      el("div.row", {}, [field("Spotify", spotify), field("YouTube", youtube)]),
    ),
    group("Präferenzen & Standort",
      el("div.row", {}, [field("Alter ab", minAge), field("Alter bis", maxAge)]),
      field("Max. Entfernung (km)", maxDist),
      el("label.consent", {}, [visible, el("div", {}, [el("div.c-t", { text: "Profil sichtbar" }), el("div.c-d", { text: "Wenn aus, erscheinst du in keiner Suche/Discover." })])]),
      locBtn, locStatus,
    ),
    el("div.screen-pad", {}, [saveBtn]),
  );
}

/* ============================ Photos ============================ */
export function renderPhotos(screen) {
  const root = el("div");
  mount(screen, backRow("Meine Fotos"), root);
  const grid = el("div.photo-grid");
  root.appendChild(el("p.screen-pad.muted.small", { style: { paddingBottom: 0 }, text: "Lade bis zu 6 Fotos hoch. Neue Fotos werden vom Team geprüft, bevor sie sichtbar sind." }));
  root.appendChild(grid);

  const fileInput = el("input", { type: "file", accept: "image/*", style: { display: "none" } });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0]; if (!file) return;
    toast("Lade hoch…", "info");
    try { await api.uploadPhoto(file); toast("Foto hochgeladen — wird geprüft.", "ok"); load(); }
    catch (e) { toast(e.message || "Upload fehlgeschlagen.", "err"); }
    fileInput.value = "";
  });
  root.appendChild(fileInput);

  async function load() {
    clear(grid);
    grid.appendChild(el("div.loading-center", { style: { gridColumn: "1/-1", height: "120px" } }, [el("div.spinner")]));
    let photos = [];
    try { photos = await api.photos(); } catch (e) { toast(e.message, "err"); }
    clear(grid);
    photos.forEach((ph) => {
      const cell = el("div.photo-cell", { style: { border: "none" } });
      if (ph.url) cell.appendChild(el("img", { src: ph.url, alt: "" }));
      cell.appendChild(el("div", { class: "ph-status " + ph.status, text: { pending: "In Prüfung", approved: "Aktiv", rejected: "Abgelehnt" }[ph.status] || ph.status }));
      cell.appendChild(el("button.ph-del", { html: icons.trash({ w: 2 }), onclick: async () => {
        if (await confirmDialog({ title: "Foto löschen?", confirmLabel: "Löschen", danger: true })) {
          try { await api.deletePhoto(ph.id); toast("Gelöscht.", "ok"); load(); } catch (e) { toast(e.message, "err"); }
        }
      } }));
      grid.appendChild(cell);
    });
    if (photos.length < 6) grid.appendChild(el("div.photo-cell.photo-add", { onclick: () => fileInput.click() }, [el("div.center", {}, [el("div.plus", { text: "+" }), el("div.small.b", { text: "Hinzufügen" })])]));
  }
  load();
}

/* ============================ Prompts ============================ */
export function renderPrompts(screen) {
  const root = el("div");
  mount(screen, backRow("Steckbrief-Rubriken"), root);
  const list = el("div");
  root.appendChild(el("p.screen-pad.muted.small", { style: { paddingBottom: 0 }, text: "Beantworte bis zu 3 Fragen, um dein Profil lebendiger zu machen." }));
  root.appendChild(list);

  async function load() {
    clear(list);
    list.appendChild(el("div.loading-center", { style: { height: "120px" } }, [el("div.spinner")]));
    let mine = [], catalog = [];
    try { [mine, catalog] = await Promise.all([api.myPrompts(), api.prompts()]); } catch (e) { toast(e.message, "err"); }
    clear(list);
    mine.forEach((pp) => {
      list.appendChild(el("div.tile-group", { style: { margin: "12px 16px" } }, [
        el("div", { style: { padding: "14px 16px" } }, [
          el("div.q.small.b", { text: pp.prompt_text, style: { color: "var(--ink-2)" } }),
          el("div", { text: pp.answer, style: { marginTop: "4px", fontSize: "15px" } }),
          el("button.btn.btn-link", { text: "Entfernen", style: { color: "var(--nope)", marginTop: "8px", padding: 0 }, onclick: async () => {
            try { await api.deletePrompt(pp.id); toast("Entfernt.", "ok"); load(); } catch (e) { toast(e.message, "err"); }
          } }),
        ]),
      ]));
    });
    if (mine.length < 3) {
      const usedIds = new Set(mine.map((m) => m.prompt));
      const available = catalog.filter((c) => !usedIds.has(c.id));
      const sel = el("select.select", {}, [el("option", { value: "", text: "Frage wählen…" }), ...available.map((c) => el("option", { value: c.id, text: c.text }))]);
      const ans = el("textarea.textarea", { placeholder: "Deine Antwort…", maxlength: 300 });
      const add = el("button.btn.btn-primary.btn-block", { text: "Rubrik hinzufügen", onclick: async () => {
        if (!sel.value) return toast("Bitte eine Frage wählen.", "err");
        if (!ans.value.trim()) return toast("Bitte eine Antwort eingeben.", "err");
        try { await api.addPrompt(Number(sel.value), ans.value.trim()); toast("Hinzugefügt ✓", "ok"); load(); } catch (e) { toast(e.message, "err"); }
      } });
      list.appendChild(el("div.screen-pad.stack", {}, [el("div.section-title", { text: "Neue Rubrik", style: { padding: 0 } }), sel, ans, add]));
    } else {
      list.appendChild(el("p.screen-pad.muted.small.center", { text: "Maximum von 3 Rubriken erreicht." }));
    }
  }
  load();
}

/* ============================ Interests ============================ */
export function renderInterests(screen) {
  const me = store.me;
  const selected = new Set(me?.interests || []);
  const root = el("div");
  mount(screen, backRow("Interessen"), root);

  const counter = el("div.section-title", { text: `${selected.size} ausgewählt` });
  const body = el("div.screen-pad");
  const saveBtn = el("button.btn.btn-primary.btn-block", { text: "Speichern" });
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true; saveBtn.textContent = "Speichere…";
    try { store.me = await api.updateMe({ interests: [...selected] }); toast("Interessen gespeichert ✓", "ok"); location.hash = "#/profile"; }
    catch (e) { toast(e.message, "err"); saveBtn.disabled = false; saveBtn.textContent = "Speichern"; }
  });
  mount(root, counter, body, el("div.screen-pad", { style: { paddingTop: 0 } }, [saveBtn]));

  // group by category
  const cats = {};
  for (const it of store.interestsCatalog) { (cats[it.category_label || it.category || "Sonstiges"] ||= []).push(it); }
  for (const [label, items] of Object.entries(cats)) {
    const block = el("div.cat-block", {}, [el("div.cat-label", { text: label })]);
    const chips = el("div.chips-scroll");
    items.forEach((it) => {
      const chip = el(`span.pill${selected.has(it.slug) ? ".on" : ""}`, { text: `${it.icon || ""} ${it.name}`.trim(), onclick: () => {
        if (selected.has(it.slug)) selected.delete(it.slug); else selected.add(it.slug);
        chip.classList.toggle("on"); counter.textContent = `${selected.size} ausgewählt`;
      } });
      chips.appendChild(chip);
    });
    block.appendChild(chips);
    body.appendChild(block);
  }
  if (!store.interestsCatalog.length) body.appendChild(el("p.muted", { text: "Interessen-Katalog konnte nicht geladen werden." }));
}
