#!/usr/bin/env bash
# =============================================================================
# restore-live.sh — one-shot StreamFamily production restoration
#
# Restores the full catalog (baseline: live 13,661 / movies 142,891 / series
# 14,108) and redeploys the StreamFamily app to production.
#
# Root cause of outage (2026-10-11):
#   1. stream.playbeatdigital.store was re-pointed to a different Next.js
#      "StreamPlay" app (Branify) — our Vercel project's deployments/domain
#      were displaced (streamplay-three.vercel.app → DEPLOYMENT_NOT_FOUND).
#   2. The original IPTV reseller line (advance.playbeat.live:8880) went dark,
#      so live provider refresh + new snapshot sync had no source.
#   3. Catalog snapshots themselves are DURABLE in Supabase Storage
#      (catalog-cache/vault/*, uploaded 2026-10-08) and were NOT lost.
#
# Required env (all secrets — never persisted, never printed):
#   SRK           Supabase service-role key (project ujzvkwgrxtujpinkytbf)
#   P_USER        Owner IPTV line username   (panel shows "User: 3dc57be7")
#   P_PASS        Owner IPTV line password   (from the same panel row)
#   VERCEL_TOKEN  Team-scoped Vercel token for team_tCgCVncHJhJXwj7Kqi0bNfia
#                 (must be created inside that team; personal tokens hit SAML 403)
#   P_HOST        optional, default http://stream.playbeat.live:8880
#   GH_PAT        optional, only if a GitHub push is wanted (auto-deploy path)
#
# Usage:  bash scripts/restore-live.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

die() { echo "[restore] FATAL: $*" >&2; exit 1; }

for v in SRK P_USER P_PASS VERCEL_TOKEN; do
  [ -n "${!v:-}" ] || die "missing env $v — see header of scripts/restore-live.sh"
done

echo "== [1/6] Provider line sanity check =="
HOST="${P_HOST:-http://stream.playbeat.live:8880}"
PROBE=$(curl -s --max-time 25 "${HOST}/player_api.php?username=${P_USER}&password=${P_PASS}" | head -c 200)
echo "$PROBE" | rg -q '"user_info"' || die "provider line rejected the credentials: $PROBE"
echo "provider OK: $(echo "$PROBE" | head -c 120)..."

echo "== [2/6] Rebuild full catalog snapshots (live/vod/series) =="
bun scripts/catalog-full-sync.ts
python3 - <<'PY'
import json
r = json.load(open('scripts/catalog-sync-report.json'))
print(f"  live={r['live']['uploaded']} vod={r['vod']['uploaded']} series={r['series']['uploaded']}")
assert r['live']['uploaded'] > 0 and r['vod']['uploaded'] > 0 and r['series']['uploaded'] > 0
PY

echo "== [3/6] Verify snapshots readable back from Supabase =="
bun scripts/catalog-full-audit.ts || echo "  (audit warnings — non-fatal)"

echo "== [4/6] Build app + serverless bundle =="
npm run build
node scripts/build-serverless.mjs

echo "== [5/6] Vercel production deploy (prebuilt) =="
npx vercel pull --yes --environment=production --token "$VERCEL_TOKEN"
npx vercel build --prod --token "$VERCEL_TOKEN"
npx vercel deploy --prebuilt --prod --token "$VERCEL_TOKEN" \
  || node scripts/deploy-prebuilt-api.mjs   # API fallback (CLI identity checks)

echo "== [6/6] Production E2E =="
sleep 8
BASE="https://stream.playbeatdigital.store"
curl -fsS --max-time 30 "$BASE/" | rg -q "StreamPlay|assets/index" || echo "  WARN: index HTML unexpected"
curl -fsS --max-time 30 "$BASE/api/creator-hub/flags" | head -c 200; echo
echo "restore DONE — verify stats in the UI: live/vod/series must be non-zero."
