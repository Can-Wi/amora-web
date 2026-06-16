/* views/auth.js — landing, login, multi-step registration. */
import { api, ApiError } from "../api.js";
import { el, mount, toast, icons } from "../ui.js";

export function renderAuth(root, onAuthed) {
  let mode = "landing"; // landing | login | register

  const screen = el("div.auth");
  mount(root, screen);

  function setMode(m) { mode = m; draw(); }

  function hero() {
    return el("div.auth-hero", {}, [
      el("div.auth-logo", { html: `AET<span class="mag">ERN</span>` }),
      el("div.auth-tag", { text: "Alternative für Dating" }),
    ]);
  }

  function errorBox(msg) { return msg ? el("div.form-error", { text: msg }) : null; }

  /* ---------------- Landing ---------------- */
  function landing() {
    return el("div.auth", {}, [
      hero(),
      el("div.auth-body", {}, [
        el("h1.auth-title", { text: "Eine neue Art zu daten." }),
        el("p.auth-sub", { text: "Kein Swipe wie jeder andere. Menschen, die wirklich zu dir passen — mit Kompatibilitäts-Score, Live-Chat und Privatsphäre, die zählt." }),
        el("div.feat-row", {}, [
          feat("✦", "Smart-Matching"),
          feat("💬", "Live-Chat"),
          feat("🔒", "DSGVO-sicher"),
        ]),
        el("div", { style: { marginTop: "28px" } }, [
          el("button.btn.btn-primary.btn-block", { text: "Konto erstellen", onclick: () => setMode("register") }),
          el("button.btn.btn-ghost.btn-block", { text: "Ich habe schon ein Konto", style: { marginTop: "12px" }, onclick: () => setMode("login") }),
        ]),
        el("p.auth-switch.small", { style: { marginTop: "22px" }, html: "Mit der Nutzung stimmst du unseren <b>Nutzungsbedingungen</b> & dem <b>Datenschutz</b> zu." }),
      ]),
    ]);
  }
  const feat = (ico, t) => el("div.feat", {}, [el("div.ico", { text: ico }), el("div.t", { text: t })]);

  /* ---------------- Login ---------------- */
  function login() {
    let err = "";
    const view = el("div.auth", {}, [
      hero(),
      el("div.auth-body", {}, (() => {
        const emailIn = el("input.input", { type: "email", placeholder: "du@example.com", autocomplete: "email" });
        const passIn = el("input.input", { type: "password", placeholder: "Passwort", autocomplete: "current-password" });
        const errSlot = el("div");
        const btn = el("button.btn.btn-primary.btn-block", { text: "Einloggen" });

        async function submit() {
          mount(errSlot);
          if (!emailIn.value || !passIn.value) { mount(errSlot, errorBox("Bitte E-Mail und Passwort eingeben.")); return; }
          btn.disabled = true; btn.textContent = "Einloggen…";
          try {
            await api.login(emailIn.value.trim(), passIn.value);
            onAuthed();
          } catch (e) {
            mount(errSlot, errorBox(e instanceof ApiError ? e.message : "Login fehlgeschlagen."));
            btn.disabled = false; btn.textContent = "Einloggen";
          }
        }
        btn.addEventListener("click", submit);
        passIn.addEventListener("keydown", (e) => e.key === "Enter" && submit());

        return [
          el("h1.auth-title", { text: "Willkommen zurück" }),
          el("p.auth-sub", { text: "Schön, dich wiederzusehen." }),
          errSlot,
          el("div.field", {}, [el("label", { text: "E-Mail" }), emailIn]),
          el("div.field", {}, [el("label", { text: "Passwort" }), passIn]),
          btn,
          el("p.auth-switch", {}, ["Noch kein Konto? ", el("a", { class: "btn-link", text: "Registrieren", style: { display: "inline" }, onclick: () => setMode("register") })]),
          el("p.center", { style: { marginTop: "6px" } }, [el("a", { class: "btn-link", text: "← Zurück", onclick: () => setMode("landing") })]),
        ];
      })()),
    ]);
    return view;
  }

  /* ---------------- Register (3 steps) ---------------- */
  function register() {
    let step = 0;
    const data = {
      email: "", password: "", display_name: "",
      birthdate: "", gender: "", looking_for: "everyone", bio: "",
      latitude: null, longitude: null,
      accept_terms: false, accept_privacy: false, accept_marketing: false,
    };
    const wrap = el("div.auth", {}, [hero()]);
    const body = el("div.auth-body");
    wrap.appendChild(body);

    function stepper() {
      return el("div.steps", {}, [0, 1, 2].map((i) => el(`div.s${i <= step ? ".on" : ""}`)));
    }
    function nav(prev, next) {
      return el("div.row", { style: { marginTop: "8px" } }, [
        el("button.btn.btn-ghost", { text: prev.label, onclick: prev.fn }),
        el("button.btn.btn-primary", { text: next.label, onclick: next.fn }),
      ]);
    }

    function drawStep() {
      const errSlot = el("div");
      let content;

      if (step === 0) {
        const email = el("input.input", { type: "email", placeholder: "du@example.com", value: data.email, autocomplete: "email" });
        const pass = el("input.input", { type: "password", placeholder: "Mind. 8 Zeichen", value: data.password });
        const name = el("input.input", { type: "text", placeholder: "Dein Vorname", value: data.display_name, maxlength: 50 });
        content = [
          el("h1.auth-title", { text: "Erstelle dein Konto" }),
          el("p.auth-sub", { text: "Schritt 1 von 3 — die Basics." }),
          stepper(), errSlot,
          el("div.field", {}, [el("label", { text: "Anzeigename" }), name]),
          el("div.field", {}, [el("label", { text: "E-Mail" }), email]),
          el("div.field", {}, [el("label", { text: "Passwort" }), pass, el("div.hint", { text: "Wähle ein sicheres Passwort." })]),
          nav(
            { label: "Zurück", fn: () => setMode("landing") },
            { label: "Weiter →", fn: () => {
              mount(errSlot);
              data.email = email.value.trim(); data.password = pass.value; data.display_name = name.value.trim();
              if (!data.display_name) return mount(errSlot, errorBox("Bitte gib einen Namen ein."));
              if (!/.+@.+\..+/.test(data.email)) return mount(errSlot, errorBox("Bitte gib eine gültige E-Mail ein."));
              if (data.password.length < 8) return mount(errSlot, errorBox("Das Passwort braucht mind. 8 Zeichen."));
              step = 1; drawStep();
            } },
          ),
        ];
      } else if (step === 1) {
        const bday = el("input.input", { type: "date", value: data.birthdate, max: maxBirthdate() });
        const bio = el("textarea.textarea", { placeholder: "Erzähl etwas über dich…", maxlength: 500, html: data.bio });
        const genderSeg = segmented(["male", "female", "other"], ["Mann", "Frau", "Divers"], data.gender, (v) => data.gender = v);
        const lookSeg = segmented(["male", "female", "everyone"], ["Männer", "Frauen", "Alle"], data.looking_for, (v) => data.looking_for = v);
        const locBtn = el("button.btn.btn-ghost.btn-block", { html: `${icons.pin()} Standort verwenden`, style: { marginTop: "4px" } });
        const locStatus = el("div.hint");
        locBtn.addEventListener("click", () => {
          locBtn.disabled = true; locStatus.textContent = "Ermittle Standort…";
          navigator.geolocation?.getCurrentPosition(
            (pos) => { data.latitude = pos.coords.latitude; data.longitude = pos.coords.longitude; locStatus.textContent = "✓ Standort gesetzt (für Umkreis-Suche)"; locBtn.disabled = false; },
            () => { locStatus.textContent = "Standort nicht verfügbar — kannst du später setzen."; locBtn.disabled = false; },
            { timeout: 8000 }
          );
        });
        content = [
          el("h1.auth-title", { text: "Über dich" }),
          el("p.auth-sub", { text: "Schritt 2 von 3 — damit wir gut matchen." }),
          stepper(), errSlot,
          el("div.field", {}, [el("label", { text: "Geburtsdatum" }), bday]),
          el("div.field", {}, [el("label", { text: "Ich bin" }), genderSeg]),
          el("div.field", {}, [el("label", { text: "Ich suche" }), lookSeg]),
          el("div.field", {}, [el("label", { text: "Über mich (optional)" }), bio]),
          el("div.field", {}, [el("label", { text: "Standort (optional)" }), locBtn, locStatus]),
          nav(
            { label: "← Zurück", fn: () => { data.bio = bio.value; step = 0; drawStep(); } },
            { label: "Weiter →", fn: () => {
              mount(errSlot);
              data.birthdate = bday.value; data.bio = bio.value;
              if (!data.birthdate) return mount(errSlot, errorBox("Bitte gib dein Geburtsdatum an."));
              if (!data.gender) return mount(errSlot, errorBox("Bitte wähle eine Option bei „Ich bin“."));
              step = 2; drawStep();
            } },
          ),
        ];
      } else {
        const terms = consentRow("Nutzungsbedingungen", "Ich akzeptiere die AGB.", data.accept_terms, (v) => data.accept_terms = v);
        const priv = consentRow("Datenschutz (Art. 9 DSGVO)", "Ich willige ausdrücklich in die Verarbeitung meiner Daten (inkl. besonderer Kategorien) ein.", data.accept_privacy, (v) => data.accept_privacy = v);
        const mkt = consentRow("Marketing (optional)", "Ich möchte Produkt-Updates & Tipps erhalten.", data.accept_marketing, (v) => data.accept_marketing = v);
        const btn = el("button.btn.btn-primary", { text: "Konto erstellen" });
        async function finish() {
          mount(errSlot);
          if (!data.accept_terms || !data.accept_privacy) return mount(errSlot, errorBox("AGB und Datenschutz sind für die Registrierung erforderlich."));
          btn.disabled = true; btn.textContent = "Erstelle Konto…";
          try {
            await api.register(data);
            toast("Konto erstellt! Du wirst eingeloggt…", "ok");
            await api.login(data.email, data.password);
            onAuthed();
          } catch (e) {
            mount(errSlot, errorBox(e instanceof ApiError ? e.message : "Registrierung fehlgeschlagen."));
            btn.disabled = false; btn.textContent = "Konto erstellen";
          }
        }
        btn.addEventListener("click", finish);
        content = [
          el("h1.auth-title", { text: "Einwilligungen" }),
          el("p.auth-sub", { text: "Schritt 3 von 3 — deine Daten, deine Kontrolle." }),
          stepper(), errSlot,
          terms, priv, mkt,
          el("div.row", { style: { marginTop: "12px" } }, [
            el("button.btn.btn-ghost", { text: "← Zurück", onclick: () => { step = 1; drawStep(); } }),
            btn,
          ]),
        ];
      }
      mount(body, ...content);
    }
    drawStep();
    return wrap;
  }

  function segmented(values, labels, current, onPick) {
    const seg = el("div.seg");
    values.forEach((v, i) => {
      const b = el(`button${v === current ? ".on" : ""}`, { text: labels[i], onclick: () => {
        [...seg.children].forEach((c) => c.classList.remove("on")); b.classList.add("on"); onPick(v);
      } });
      seg.appendChild(b);
    });
    return seg;
  }
  function consentRow(title, desc, checked, onChange) {
    const cb = el("input", { type: "checkbox" }); cb.checked = checked;
    cb.addEventListener("change", () => onChange(cb.checked));
    return el("label.consent", {}, [cb, el("div", {}, [el("div.c-t", { text: title }), el("div.c-d", { text: desc })])]);
  }
  function maxBirthdate() { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10); }

  function draw() {
    if (mode === "login") mount(root, login());
    else if (mode === "register") mount(root, register());
    else mount(root, landing());
  }
  draw();
}
