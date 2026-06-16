/* views/search.js — filtered, ranked search with a results grid. */
import { api } from "../api.js";
import { store } from "../store.js";
import { el, mount, clear, icons, toast, avatarBg, initials, compatColor, clean, pct } from "../ui.js";
import { showProfileDetail } from "./profileDetail.js";

export function renderSearch(screen) {
  const state = { q: "", min_age: "", max_age: "", max_distance: "", interests: new Set(), online: false };
  let filtersOpen = false;
  let results = null; // null=not searched yet
  let loading = false;

  const root = el("div");
  mount(screen, root);

  function draw() {
    clear(root);

    // search bar
    const input = el("input.input", { type: "search", placeholder: "Nach Namen suchen…", value: state.q });
    input.addEventListener("input", () => { state.q = input.value; });
    input.addEventListener("keydown", (e) => e.key === "Enter" && run());
    const filterBtn = el("button.icon-btn", { html: icons.filter(), onclick: () => { filtersOpen = !filtersOpen; draw(); } });
    if (activeFilterCount()) filterBtn.appendChild(el("span.count", { text: String(activeFilterCount()) }));
    root.appendChild(el("div.search-bar", {}, [el("div.grow", {}, [input]), filterBtn, el("button.btn.btn-primary.btn-sm", { text: "Suchen", onclick: run })]));

    if (filtersOpen) root.appendChild(filtersSheet());

    const body = el("div");
    if (loading) body.appendChild(el("div.loading-center", { style: { height: "40vh" } }, [el("div.spinner")]));
    else if (results == null) body.appendChild(el("div.empty", { style: { paddingTop: "60px" } }, [
      el("div.big", { text: "🔍" }), el("h3", { text: "Finde deine Person" }),
      el("p", { text: "Suche nach Namen oder nutze Filter wie Alter, Entfernung, Interessen und Online-Status." }),
      el("button.btn.btn-primary", { text: "Alle anzeigen", onclick: run, style: { marginTop: "8px" } }),
    ]));
    else if (!results.length) body.appendChild(el("div.empty", { style: { paddingTop: "60px" } }, [
      el("div.big", { text: "🪹" }), el("h3", { text: "Keine Treffer" }), el("p", { text: "Versuch es mit weniger Filtern oder einem größeren Radius." }),
    ]));
    else body.appendChild(grid());
    root.appendChild(body);
  }

  function filtersSheet() {
    const sheet = el("div.filters-sheet.stack");
    const minA = el("input.input", { type: "number", min: 18, max: 99, placeholder: "18", value: state.min_age });
    const maxA = el("input.input", { type: "number", min: 18, max: 99, placeholder: "99", value: state.max_age });
    minA.addEventListener("input", () => state.min_age = minA.value);
    maxA.addEventListener("input", () => state.max_age = maxA.value);
    const dist = el("input.input", { type: "number", min: 1, placeholder: "z. B. 50", value: state.max_distance });
    dist.addEventListener("input", () => state.max_distance = dist.value);

    const onlineSw = el("input", { type: "checkbox" }); onlineSw.checked = state.online;
    onlineSw.addEventListener("change", () => state.online = onlineSw.checked);

    // interests chips
    const chips = el("div.chips-scroll");
    store.interestsCatalog.slice(0, 60).forEach((it) => {
      const chip = el(`span.pill${state.interests.has(it.slug) ? ".on" : ""}`, { text: `${it.icon || ""} ${it.name}`.trim(), onclick: () => {
        if (state.interests.has(it.slug)) state.interests.delete(it.slug); else state.interests.add(it.slug);
        chip.classList.toggle("on");
      } });
      chips.appendChild(chip);
    });

    sheet.append(
      el("div.row", {}, [
        el("div.field", { style: { margin: 0 } }, [el("label", { text: "Alter ab" }), minA]),
        el("div.field", { style: { margin: 0 } }, [el("label", { text: "Alter bis" }), maxA]),
      ]),
      el("div.field", { style: { margin: 0 } }, [el("label", { text: "Max. Entfernung (km)" }), dist]),
      el("div.flex.between", {}, [el("label", { class: "b small", text: "Nur Online" }), switchEl(onlineSw)]),
      el("div", {}, [el("label", { class: "b small", text: "Interessen", style: { display: "block", marginBottom: "8px" } }), chips]),
      el("div.flex.gap12", {}, [
        el("button.btn.btn-ghost.grow", { text: "Zurücksetzen", onclick: () => { Object.assign(state, { min_age: "", max_age: "", max_distance: "", online: false }); state.interests = new Set(); filtersOpen = true; draw(); } }),
        el("button.btn.btn-primary.grow", { text: "Anwenden", onclick: run }),
      ]),
    );
    return sheet;
  }
  const switchEl = (input) => el("label.switch", {}, [input, el("span.sl")]);

  function grid() {
    const g = el("div.result-grid");
    results.forEach((p) => {
      const card = el("div.result-card", { onclick: () => openDetail(p) });
      const ph = el("div.rc-photo");
      if (p.photo_url) ph.style.backgroundImage = `url("${p.photo_url}")`;
      else { ph.style.background = avatarBg(p.name); ph.appendChild(el("div", { text: initials(p.name), style: { position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: "44px", fontWeight: "800", color: "rgba(255,255,255,.4)" } })); }
      card.append(ph, el("div.rc-grad"));
      if (p.compatibility != null) card.appendChild(el("div.rc-compat", { style: { color: compatColor(p.compatibility) }, text: `${pct(p.compatibility)}%` }));
      card.appendChild(el("div.rc-info", {}, [
        el("div.rc-name", {}, [`${p.name}${p.age != null ? `, ${p.age}` : ""}`, p.online ? el("span.dot-online") : null, p.verified ? el("span", { text: "✓", style: { color: "#7fd0ff" } }) : null]),
        el("div.rc-sub", { text: p.distance_km != null ? `📍 ${Math.round(p.distance_km)} km` : clean(p.job_title) }),
      ]));
      g.appendChild(card);
    });
    return g;
  }

  function openDetail(p) {
    showProfileDetail(p, {
      showLike: true,
      onLike: () => { results = results.filter((r) => r.user_id !== p.user_id); draw(); },
      onPass: async () => { try { await api.like(p.user_id, "pass"); } catch {} results = results.filter((r) => r.user_id !== p.user_id); draw(); },
      onBlock: () => { results = results.filter((r) => r.user_id !== p.user_id); draw(); },
    });
  }

  function activeFilterCount() {
    return [state.min_age, state.max_age, state.max_distance].filter(Boolean).length + state.interests.size + (state.online ? 1 : 0);
  }

  async function run() {
    filtersOpen = false; loading = true; draw();
    try {
      results = await api.search({
        q: state.q || undefined,
        min_age: state.min_age || undefined,
        max_age: state.max_age || undefined,
        max_distance: state.max_distance || undefined,
        interests: state.interests.size ? [...state.interests].join(",") : undefined,
        online: state.online ? "true" : undefined,
      });
    } catch (e) { toast(e.message || "Suche fehlgeschlagen.", "err"); results = []; }
    loading = false; draw();
  }

  draw();
}
