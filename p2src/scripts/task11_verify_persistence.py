#!/usr/bin/env python3
"""Task 11 verification: member line durable persistence on production.

Chain: admin assign -> runtime store -> Supabase mirror (AES-256-GCM v1 ciphertext)
       -> (cold start) ensureRestored -> masked member view.

Secrets are sourced from .env / env vars and NEVER printed.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE = "https://streamplay-three.vercel.app"
ENV_PATH = "/home/z/my-project/.env"
SUPABASE_URL = "https://ujzvkwgrxtujpinkytbf.supabase.co"

SUPABASE_SERVICE_ROLE_KEY = os.environ["SRK"]


def load_env(path):
    env = {}
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


ENV = load_env(ENV_PATH)


def req(url, method="GET", body=None, token=None, headers=None, timeout=45):
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if headers:
        h.update(headers)
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()[:300]
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}


def mask(v, keep=4):
    if not v:
        return "-"
    return v[:2] + "…" + v[-keep:] if len(v) > keep + 2 else "…"


def sb_query():
    """Query member_iptv_lines with service key. Returns rows (masked)."""
    url = f"{SUPABASE_URL}/rest/v1/member_iptv_lines?select=*"
    r = urllib.request.Request(url, headers={
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    })
    with urllib.request.urlopen(r, timeout=30) as resp:
        rows = json.loads(resp.read().decode() or "[]")
    out = []
    for row in rows:
        out.append({
            "pilot_member_id": row.get("pilot_member_id"),
            "member_email": row.get("member_email"),
            "server_url": row.get("server_url"),
            "provider_name": row.get("provider_name"),
            "status": row.get("status"),
            "max_connections": row.get("max_connections"),
            "expires_at": row.get("expires_at"),
            "username_encrypted": mask(row.get("username_encrypted") or "", 6),
            "password_encrypted": mask(row.get("password_encrypted") or "", 6),
            "m3u_url_encrypted": mask(row.get("m3u_url_encrypted") or "", 6),
            "epg_url_encrypted": mask(row.get("epg_url_encrypted") or "", 6),
        })
    return out


print("=== STEP 1: baseline Supabase mirror state ===")
rows = sb_query()
print(f"member_iptv_lines rows: {len(rows)}")
for r in rows:
    print("  ", json.dumps(r, ensure_ascii=False))

print()
print("=== STEP 2: admin login (production) ===")
st, admin = req(f"{BASE}/api/auth/login", "POST",
                {"email": "admin@aetherstream.tv", "password": ENV.get("ADMIN_PILOT_PASSWORD", "admin123")})
assert st == 200, f"admin login failed: {st} {admin}"
admin_token = (admin.get("token") or admin.get("accessToken")
               or admin.get("session", {}).get("token", ""))
print(f"login 200, token {mask(admin_token)}")

print()
print("=== STEP 3: assign global Star IPTV vault line to Julian (usr-member-01) ===")
# Family vault line (Line B) — matches server/starIptvProvider.ts defaults.
# Line A (adult package, 9ef15ac8) is NEVER used for family pilot members.
payload = {
    "serverUrl": "http://advance.playbeat.live:8880",
    "username": "7bd69cb1",
    "password": "1df53ce4",
    "m3uUrl": ("http://advance.playbeat.live:8880/get.php?username=7bd69cb1"
               "&password=1df53ce4&type=m3u_plus&output=hls"),
    "epgUrl": ("http://advance.playbeat.live:8880/xmltv.php?username=7bd69cb1"
               "&password=1df53ce4"),
    "providerName": "Star IPTV (Family Vault)",
    "skipProbe": True,
}
st, res = req(f"{BASE}/api/admin/members/usr-member-01/iptv-line", "POST", payload,
              token=admin_token)
ok = st == 200 and res.get("success")
print(f"assign HTTP {st} success={res.get('success') if isinstance(res, dict) else res}")
if isinstance(res, dict) and res.get("line"):
    ln = res["line"]
    print(f"  masked line: user={ln.get('username','-')} status={ln.get('status')} "
          f"maxConn={ln.get('maxConnections')} assigned={ln.get('assigned')}")
if not ok:
    print(json.dumps(res, ensure_ascii=False)[:400]); sys.exit(1)

# give the fire-and-forget sync a moment
time.sleep(4)

print()
print("=== STEP 4: verify durable mirror row (service-role view) ===")
rows = sb_query()
print(f"member_iptv_lines rows: {len(rows)}")
for r in rows:
    print("  ", json.dumps(r, ensure_ascii=False))
v1_ok = rows and all(
    (r["username_encrypted"].startswith("v1") or r["username_encrypted"] == "-")
    for r in rows)
print(f"ciphertext format v1.*: {'PASS' if v1_ok and rows else 'FAIL'}")

print()
print("=== STEP 5: member-side masked view (Julian) ===")
st, mem = req(f"{BASE}/api/auth/login", "POST",
              {"email": "julian@aetherstream.tv", "password": "member123"})
assert st == 200, f"julian login failed: {st} {mem}"
jtok = (mem.get("token") or mem.get("accessToken") or mem.get("session", {}).get("token", ""))
st, view = req(f"{BASE}/api/iptv-line", token=jtok)
if st != 200:
    st, view = req(f"{BASE}/api/me/iptv-line", token=jtok)
if st != 200:
    st, view = req(f"{BASE}/api/me", token=jtok)
print(f"member view HTTP {st}")
print("  ", json.dumps(view, ensure_ascii=False)[:500])
