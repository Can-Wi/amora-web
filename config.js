/*
 * Runtime configuration for the AMORA web client.
 *
 * In Docker this file is REGENERATED from environment variables
 * (API_BASE / WS_BASE / API_VERSION) by docker-entrypoint.sh on container
 * start — so the same built image runs in any environment without a rebuild.
 *
 * Defaults point at the public production API (api.aetern.de). When the app is
 * served from a *.aetern.de subdomain the backend CORS rules already allow it.
 *
 * Local dev: when opened from localhost we assume a same-origin proxy
 * (see dev-proxy.py) for REST to avoid CORS, while WebSockets connect straight
 * to production. A localStorage entry "AMORA_CFG" (JSON) overrides any field —
 * handy for pointing at a local backend during testing.
 */
(function () {
  var host = location.hostname;
  var isLocal = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
  var defaults = isLocal
    ? { apiBase: "", wsBase: "wss://api.aetern.de", apiVersion: "v2", brand: "AETERN" }
    : { apiBase: "https://api.aetern.de", wsBase: "wss://api.aetern.de", apiVersion: "v2", brand: "AETERN" };
  var override = {};
  try { override = JSON.parse(localStorage.getItem("AMORA_CFG") || "{}") || {}; } catch (e) {}
  window.AETERN_CONFIG = Object.assign(defaults, override);
})();
