# AMORA — Web-Frontend

Vollständiges, mobil-first **Dating-Web-Frontend** für die [Aetern/AMORA-API](https://api.aetern.de).
Kein Build-Step: reine ES-Module + CSS, ausgeliefert von **nginx** in einem schlanken
Docker-Image. Spricht **alle** REST-Endpunkte und **beide** WebSockets der API an.

> Marke: **AMORA** · Design: warm, romantisch, glasig (Coral → Pink → Magenta), Handy-App-Optik,
> auf dem Desktop zentriert als Phone-Column.

## Features (deckt die komplette API ab)

| Bereich | Funktion | Endpunkte |
|---|---|---|
| **Auth** | Login, 3-Schritt-Registrierung (mit DSGVO-Einwilligungen + Geo), Auto-Token-Refresh | `auth/login` `auth/register` `auth/refresh` `auth/logout` |
| **Entdecken** | Swipe-Deck (Drag + Buttons), Kompatibilitäts-Score, Online-Punkt, Verified-Badge, Prompts, „It's a Match!"-Feier, Rewind | `discover` `like` |
| **Suchen** | Volltext + Filter (Alter, Distanz, Interessen, Online), gerankte Ergebnis-Grid | `search` `interests` |
| **Chats** | Match-Liste mit Live-Vorschau/Ungelesen-Badges, Realtime-Chat (Tippt-Anzeige, Lesebestätigung, Präsenz), Unmatch | `matches` `matches/<id>/messages` · WS `chat` + `live` |
| **Profil** | Übersicht + Vollständigkeit, Bearbeiten (Bio/Steckbrief/Social/Präferenzen/Standort), Fotos (Upload/Moderation), Hinge-Rubriken, Interessen | `auth/me` `photos` `prompts` `me/prompts` |
| **Sicherheit** | Blockieren/Entsperren, Melden, E-Mail-Verifizierung, aktive Sitzungen verwalten | `block` `unblock` `blocks` `report` `auth/verify/*` `auth/sessions/*` |
| **DSGVO** | Einwilligungen togglen, Datenexport (JSON-Download), Verarbeitungsprotokoll, Konto löschen | `privacy/consents` `privacy/export` `privacy/log` `privacy/account/delete` |

## Konfiguration (Runtime)

`config.js` setzt `window.AETERN_CONFIG`. Im Docker-Image wird die Datei beim Start aus
**Environment-Variablen** neu erzeugt (`docker-entrypoint.sh`), damit dasselbe Image überall
ohne Rebuild läuft:

| Variable | Default | Zweck |
|---|---|---|
| `API_BASE` | `https://api.aetern.de` | REST-Basis-URL |
| `WS_BASE` | `wss://api.aetern.de` | WebSocket-Basis-URL |
| `API_VERSION` | `v2` | API-Version (`v1`/`v2`) |

> **CORS:** Das Backend erlaubt nur `*.aetern.de`. Deshalb muss das Frontend unter einer
> **aetern.de-Subdomain** laufen (z. B. `app.aetern.de`), damit die REST-Aufrufe durchgehen.
> WebSockets prüfen keinen Origin und funktionieren unabhängig davon.

## Lokale Entwicklung

Das Backend-CORS lässt `localhost` nicht zu, daher gibt es einen kleinen Same-Origin-Proxy:

```bash
python3 dev-proxy.py 3200                 # REST → https://api.aetern.de
python3 dev-proxy.py 3201 http://127.0.0.1:8001   # gegen lokales Backend
```

Dann `http://localhost:3200` öffnen. Optional im Browser ein lokales Backend ansteuern:
`localStorage.setItem("AMORA_CFG", JSON.stringify({apiBase:"", wsBase:"ws://localhost:8001"}))`.

`seed_demo.py` legt über die öffentliche API Demo-Profile + Matches an (für eine belebte Demo).

## Deployment (Coolify, neue Resource)

Statisches Image, lauscht auf **Port 3000**, Healthcheck unter `/healthz`.

1. **DNS:** AAAA-Record für die gewählte Subdomain (z. B. `app.aetern.de`) auf die
   Server-IPv6 `2a01:4f8:1c19:f528::1` zeigen lassen (gleiche wie `api.aetern.de`).
2. **Coolify → New Resource → Dockerfile** (Build-Pack „Dockerfile"), Quelle: dieses Repo.
3. **Domain** auf die Subdomain setzen, Port **3000**. Coolify übernimmt TLS (Let's Encrypt).
4. **Environment** (optional, Defaults passen schon für `api.aetern.de`):
   `API_BASE`, `WS_BASE`, `API_VERSION`.
5. Deploy. Fertig — die App lädt die Live-API und ist sofort nutzbar.

### Lokal als Container testen
```bash
docker build -t amora-web .
docker run --rm -p 3000:3000 amora-web
# → http://localhost:3000  (nutzt api.aetern.de; CORS greift nur unter *.aetern.de)
```

## Struktur

```
index.html        App-Shell
config.js         Runtime-Config (im Docker aus ENV regeneriert)
css/styles.css    Design-System
js/
  api.js          REST-Client (Token-Refresh, alle Endpunkte)
  ws.js           Live- + Chat-WebSockets
  store.js        App-State + Pub/Sub
  ui.js           DOM-Helfer, Icons, Toasts, Modals, Avatare
  app.js          Bootstrap, Hash-Router, Shell, Live-Wiring
  views/          auth · discover · search · matches · chat · profile · settings · …
Dockerfile · nginx.conf · docker-entrypoint.sh
dev-proxy.py · seed_demo.py   (nur Dev, nicht im Image)
```
