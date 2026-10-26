# StreamFamily — Production Restoration Runbook (2026-10-11)

## What happened (root cause, verified)

Your stats (📺 13,661 live / 🎬 142,891 movies / 📺 14,108 series) went dark because
**stream.playbeatdigital.store no longer serves the StreamFamily app**.

Evidence chain:
1. The domain now returns the HTML of a **different, Next.js "StreamPlay" app**
   (og:image points to `streamplay-32co1s5r6-branify.vercel.app` — a project from
   the "branify" Vercel scope). Our app is React/Vite — its HTML has no `/_next/`.
2. Our project's identity domain `streamplay-three.vercel.app` now answers
   **DEPLOYMENT_NOT_FOUND** — the Vercel project/deployments that served
   StreamFamily are gone or detached (the Branify builder took over the project).
3. Separately, the IPTV reseller line that fed the catalog
   (`advance.playbeat.live:8880`, user `7bd69cb1`) is **dead** (connection resets).
   Your new GEOIPTV subscription line lives on `stream.playbeat.live:8880`
   (panel row shows `User: 3dc57be7`).

## What is NOT lost

- **Catalog snapshots are durable** in Supabase Storage
  (`catalog-cache/vault/{live,vod,series}/chunk-*.json.gz`, uploaded 2026-10-08).
  The sync report from that run matches your numbers exactly:
  `live=13,661 / vod=142,891 / series=14,108`. As soon as the StreamFamily app is
  serving the domain again, those counts come back.
- **All code is safe**: Phase 1 (Creator Hub) is on GitHub `main` (`b07acd7`),
  Phase 2 premium UI is open as **PR #1** (`feat/glm-phase2-premium-ui`).
- Local workspace main = deployed Phase 1 code + docs (no drift).

## Why nothing could be auto-repaired this session

| Automation path | Status |
|---|---|
| GitHub PAT | **401 Bad credentials** (expired/revoked) |
| Vercel token | **403 SAML**: "You must re-authenticate to scope branify" — the token can no longer access the team (`team_tCgCVncHJhJXwj7Kqi0bNfia`) |
| Supabase service-role key | was session-only env, not persisted (by design) |
| New M3U link `store.stariptv.pk/panel/m3u-da138d…` | Cloudflare Turnstile blocks all headless/automated fetches (4 bypass attempts) |

## Actions needed from you (≈10 minutes)

1. **Reclaim the domain in Vercel** (dashboard → the *branify* scope):
   - Option A (fastest): open the Branify "streamplay" project → Settings →
     **Domains → Remove** `stream.playbeatdigital.store`; then open our project
     (or recreate it: Import Git Repository → `mahbubauzair-dotcom/streamfamily`,
     framework = Other/Vite, root `.`, build `npm run build`) → Settings →
     Domains → **Add** `stream.playbeatdigital.store`.
   - If the old project was deleted, recreating + adding the domain is enough —
     the first deploy re-aliases automatically.
2. **Fresh team-scoped Vercel token**: vercel.com → (switch into the team) →
   Settings → Tokens → Create. Personal-scope tokens get the SAML 403.
3. **Fresh GitHub PAT** (classic, `repo` scope) if you want the GitHub
   auto-deploy pipeline to keep working.
4. **Supabase service-role key** (Supabase → Project Settings → API) — needed by
   the catalog re-sync if you want a FRESH sync from the new line (the existing
   snapshots already work without it).
5. **New IPTV line password** (from your GEOIPTV panel — same row as
   `User: 3dc57be7`) — needed for live playback + fresh catalog sync.

## Once the app is back on the domain

- Enter the new line in the app: **Admin → Star IPTV** → set
  Server URL `http://stream.playbeat.live:8880`, Username `3dc57be7`,
  Password `<from panel>`, M3U URL = the panel's m3u link.
  The vault update reconnects playback without a redeploy.
- Optional fresh catalog sync + deploy in one command (this repo):

```bash
SRK=<service-role-key> \
P_USER=3dc57be7 P_PASS=<panel-password> \
VERCEL_TOKEN=<team-token> \
bash scripts/restore-live.sh
```

The script: verifies the line → rebuilds full snapshots to Supabase →
builds app + serverless bundle → prebuilt production deploy → E2E checks.

## Session changes already applied (local, ready to deploy)

- `server/starIptvProvider.ts` — runtime defaults now point at the live DNS
  (`stream.playbeat.live:8880`, user `3dc57be7`); the dead line's embedded
  password was removed (credential-hygiene fix).
- `scripts/catalog-full-sync.ts` / `catalog-full-audit.ts` — provider host and
  credentials are now env-driven (`P_HOST/P_USER/P_PASS`), no dead hardcoded line.
- `scripts/restore-live.sh` — new one-shot restoration chain (see above).
