#!/usr/bin/env python3
"""
Seed the live AMORA API with demo profiles so the frontend has something to show
(Discover candidates, ready-made matches, reciprocal likers). Uses ONLY the
public REST API — no privileged DB access.

    python3 seed_demo.py

Creates:
  • demo@aetern.de / AmoraDemo2026!   ← log in with this in the browser
  • 10 demo profiles around Berlin (bios, interests, prompts, locations)
  • some of them like `demo` (→ instant matches / reciprocal badges)

Safe to re-run: existing accounts are reused (login instead of register).
Dev tool — excluded from the Docker image.
"""
import json
import random
import urllib.request
import urllib.error

BASE = "https://api.aetern.de/api/v1"
DEMO = {"email": "demo@aetern.de", "password": "AmoraDemo2026!", "display_name": "Alex"}
PASSWORD = "AmoraDemo2026!"
BERLIN = (52.5200, 13.4050)

PROFILES = [
    ("lena.demo@aetern.de", "Lena", "female", "1998-03-12", "Yoga am Morgen, Wein am Abend. Suche jemanden für Spaziergänge & tiefe Gespräche.", "Yogalehrerin", 168, "long_term"),
    ("jonas.demo@aetern.de", "Jonas", "male", "1995-07-22", "Kletterer & Hobbykoch. Wenn du Berge und gutes Essen magst, passen wir.", "Software-Engineer", 184, "long_open"),
    ("mia.demo@aetern.de", "Mia", "female", "2000-11-03", "Kunststudentin mit Kamera. Immer auf der Suche nach dem perfekten Licht.", "Fotografin", 172, "figuring"),
    ("noah.demo@aetern.de", "Noah", "male", "1996-01-30", "Filme, Fitness und schlechte Wortwitze. Bring Snacks mit.", "Physiotherapeut", 179, "long_term"),
    ("emma.demo@aetern.de", "Emma", "female", "1997-05-18", "Buch in der einen, Kaffee in der anderen Hand. Lass uns ein Café-Hopping machen.", "Lektorin", 165, "long_term"),
    ("luca.demo@aetern.de", "Luca", "male", "1999-09-09", "Surfer im Sommer, Snowboarder im Winter. Spontan & reiselustig.", "Grafikdesigner", 181, "short_open"),
    ("sophie.demo@aetern.de", "Sophie", "female", "1994-12-01", "Tanzen ist meine Therapie. Hundeliebhaberin. Suche Tanzpartner fürs Leben.", "Ärztin", 170, "long_term"),
    ("finn.demo@aetern.de", "Finn", "male", "1998-06-25", "Fußball, Festivals, Freunde. Das Leben ist zu kurz für langweilige Dates.", "Eventmanager", 178, "short_fun"),
    ("clara.demo@aetern.de", "Clara", "female", "2001-02-14", "Malerin & Katzenmama. Introvertiert, aber bei der richtigen Person ein Plappermaul.", "Illustratorin", 163, "long_open"),
    ("ben.demo@aetern.de", "Ben", "male", "1993-10-08", "Marathonläufer und Bücherwurm. Sonntags Brunch ist heilig.", "Lehrer", 186, "long_term"),
]
PROMPT_ANSWERS = [
    "Ein perfekter Sonntag: Markt am Morgen, Park am Nachmittag, Kino am Abend.",
    "Mein Lieblingsort in der Stadt ist ein kleines Café in Kreuzberg.",
    "Ich lache am meisten über schlechte Wortwitze — je schlimmer, desto besser.",
    "Mein größtes Talent: jeden zum Lachen bringen, auch an schlechten Tagen.",
    "Wir verstehen uns, wenn du Spontan-Trips genauso liebst wie ich.",
    "Das Beste an mir? Ich höre wirklich zu.",
]


def call(method, path, token=None, data=None):
    url = BASE + path
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw


def ensure_account(email, name, gender, birthdate, lat, lng):
    """Register (or reuse) and return an access token + user_id."""
    payload = {
        "email": email, "password": PASSWORD, "display_name": name,
        "birthdate": birthdate, "gender": gender, "looking_for": "everyone",
        "latitude": lat, "longitude": lng, "accept_terms": True,
        "accept_privacy": True, "accept_marketing": False,
    }
    st, _ = call("POST", "/auth/register/", data=payload)
    if st not in (201, 400):
        print(f"  ! register {email}: {st}")
    st, login = call("POST", "/auth/login/", data={"email": email, "password": PASSWORD})
    if st != 200:
        print(f"  ! login {email}: {st} {login}")
        return None, None
    token = login["access"]
    _, me = call("GET", "/auth/me/", token=token)
    return token, (me or {}).get("id")


def main():
    random.seed(7)
    # catalogs (need a token) — create demo first
    print("→ demo account…")
    dlat, dlng = BERLIN
    demo_token, demo_id = ensure_account(DEMO["email"], DEMO["display_name"], "male", "1995-04-20", dlat, dlng)
    if not demo_token:
        print("FATAL: could not create demo account"); return
    print(f"  demo id={demo_id}")
    _, interests = call("GET", "/interests/", token=demo_token)
    _, prompts = call("GET", "/prompts/", token=demo_token)
    slugs = [i["slug"] for i in (interests or [])]
    prompt_ids = [p["id"] for p in (prompts or [])]
    print(f"  catalog: {len(slugs)} interests, {len(prompt_ids)} prompts")

    # give demo a nice profile too
    call("PATCH", "/auth/me/", token=demo_token, data={
        "bio": "Hi, ich bin Alex! Neugierig, reiselustig und immer für einen guten Kaffee zu haben.",
        "dating_goal": "long_term", "job_title": "Produktdesigner", "height_cm": 180,
        "languages": "Deutsch, Englisch", "smoking": "never", "drinking": "sometimes",
        "interests": random.sample(slugs, min(6, len(slugs))) if slugs else [],
        "pref_min_age": 18, "pref_max_age": 99, "pref_max_distance_km": 200,
    })

    created = []
    for i, (email, name, gender, bday, bio, job, height, goal) in enumerate(PROFILES):
        lat = BERLIN[0] + random.uniform(-0.15, 0.15)
        lng = BERLIN[1] + random.uniform(-0.20, 0.20)
        print(f"→ {name} ({email})…")
        token, uid = ensure_account(email, name, gender, bday, lat, lng)
        if not token:
            continue
        call("PATCH", "/auth/me/", token=token, data={
            "bio": bio, "dating_goal": goal, "job_title": job, "height_cm": height,
            "languages": random.choice(["Deutsch", "Deutsch, Englisch", "Deutsch, Englisch, Spanisch"]),
            "smoking": random.choice(["never", "sometimes"]), "drinking": random.choice(["never", "sometimes", "often"]),
            "instagram": "@" + name.lower(),
            "interests": random.sample(slugs, min(random.randint(4, 7), len(slugs))) if slugs else [],
        })
        # add up to 2 prompts
        for pid in random.sample(prompt_ids, min(2, len(prompt_ids))) if prompt_ids else []:
            call("POST", "/me/prompts/", token=token, data={"prompt": pid, "answer": random.choice(PROMPT_ANSWERS)})
        created.append((name, token, uid))

    # Some demo profiles like `demo` → reciprocal badges + instant matches when demo likes back.
    likers = created[:4]
    for name, token, uid in likers:
        st, res = call("POST", "/like/", token=token, data={"to_user": demo_id, "action": "like"})
        print(f"  {name} likes demo → {st} {res}")

    # Make 2 of them full matches now (demo likes back) so the Chats tab isn't empty.
    for name, token, uid in likers[:2]:
        st, res = call("POST", "/like/", token=demo_token, data={"to_user": uid, "action": "like"})
        print(f"  demo likes {name} → {st} {res}")

    print("\n✅ Done. Log in at the frontend with:")
    print(f"   {DEMO['email']} / {PASSWORD}")


if __name__ == "__main__":
    main()
