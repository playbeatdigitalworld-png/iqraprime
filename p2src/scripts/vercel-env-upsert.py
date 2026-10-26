#!/usr/bin/env python3
"""Upsert specific env vars on the Vercel project (values from env, never printed).
Usage: VERCEL_TOKEN=... VAR1=value1 VAR2=value2 python3 scripts/vercel-env-upsert.py VAR1 VAR2
"""
import json
import os
import sys
import urllib.request

TOKEN = os.environ["VERCEL_TOKEN"]
API = "https://api.vercel.com"
PROJECT = "prj_QznLATdIdlXJXOfOXEouDfoUdpRk"
TEAM = "team_tCgCVncHJhJXwj7Kqi0bNfia"


def call(method: str, path: str, body=None):
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def main() -> None:
    names = sys.argv[1:]
    if not names:
        print("no vars requested")
        sys.exit(1)
    payload = []
    for name in names:
        value = os.environ.get(name)
        if not value:
            print(f"MISSING_ENV {name}")
            sys.exit(1)
        payload.append({
            "key": name,
            "value": value,
            "type": "encrypted",
            "target": ["production", "preview"],
            "gitBranch": None,
        })
    status, res = call("POST", f"/v9/projects/{PROJECT}/env?upsert=true&teamId={TEAM}", payload)
    ok = status in (200, 201)
    print(f"env upsert status={status} count={len(payload)} ok={ok}")
    if not ok:
        print(json.dumps(res)[:300])
        sys.exit(1)
    # verify presence (values never returned by the API)
    status, lst = call("GET", f"/v9/projects/{PROJECT}/env?teamId={TEAM}")
    if status == 200:
        present = {e["key"] for e in lst.get("envs", [])}
        for name in names:
            print(f"present[{name}]={'YES' if name in present else 'NO'}")


if __name__ == "__main__":
    main()
