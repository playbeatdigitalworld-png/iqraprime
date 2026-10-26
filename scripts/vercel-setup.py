#!/usr/bin/env python3
"""StreamPlay -> Vercel project bootstrap (token from env VERCEL_TOKEN).
1. Validate token, get user scope (orgId)
2. Create project 'streamplay' (or reuse existing)
3. Upsert runtime env vars from local .env (never printed)
"""
import json
import os
import pathlib
import sys
import urllib.request

TOKEN = os.environ["VERCEL_TOKEN"]
API = "https://api.vercel.com"
PROJECT = "streamplay"


def call(method: str, path: str, body: dict | None = None) -> tuple[int, dict | list]:
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def main() -> None:
    # 1. token -> user scope
    status, user = call("GET", "/v2/user")
    if status != 200:
        print(f"TOKEN_INVALID status={status}", json.dumps(user)[:200])
        sys.exit(1)
    uid = user["user"].get("uid") or user["user"]["id"]
    uname = user["user"]["username"]
    team = user["user"].get("defaultTeamId") or uid
    scope = f"?teamId={team}" if user["user"].get("defaultTeamId") else ""
    print(f"token OK user={uname} org={team}")

    # 2. project (create or reuse)
    status, proj = call("GET", f"/v9/projects/{PROJECT}{scope}")
    if status == 200:
        print(f"project exists id={proj['id']}")
    else:
        status, proj = call("POST", f"/v2/projects{scope}", {"name": PROJECT, "framework": None})
        if status not in (200, 201):
            print("PROJECT_CREATE_FAILED", json.dumps(proj)[:300])
            sys.exit(1)
        print(f"project created id={proj['id']}")
    pid = proj["id"]

    # 3. env vars from .env (skip runtime-managed keys)
    skip = {"NODE_ENV", "PORT"}
    env: dict[str, str] = {}
    for line in pathlib.Path(".env").read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in skip and not k.startswith("VITE_"):
            env[k] = v
    # Also ship the two public VITE_ vars (belt & braces for cloud builds)
    for line in pathlib.Path(".env").read_text().splitlines():
        if line.strip().startswith("VITE_") and "=" in line:
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip().strip('"').strip("'")

    payload = [
        {"key": k, "value": v, "type": "encrypted",
         "target": ["production", "preview"], "gitBranch": None}
        for k, v in sorted(env.items())
    ]
    status, res = call("POST", f"/v9/projects/{pid}/env?upsert=true{scope.lstrip('?') and '&teamId=' + team if scope else ''}", payload)
    ok = status in (200, 201)
    print(f"env upsert status={status} count={len(payload)} ok={ok}")
    if not ok:
        print(json.dumps(res)[:400])
        sys.exit(1)

    # 4. write CLI link file
    vdir = pathlib.Path(".vercel")
    vdir.mkdir(exist_ok=True)
    (vdir / "project.json").write_text(json.dumps({"projectId": pid, "orgId": team}))
    print("link written .vercel/project.json")


if __name__ == "__main__":
    main()
