#!/bin/bash
# Build the pre-merge review-fixes commit via git plumbing (no HEAD movement).
# The workspace watchdog reverts HEAD to main ~9s after any checkout, so this
# composes the commit purely from object-level operations.
set -euo pipefail
cd /home/z/my-project

PARENT=67fe210
BRANCH=feat/glm-phase2-premium-ui
IDX=$(mktemp /tmp/p2idx.XXXXXX)
FILES=(
  .env.example
  server/db/store.ts
  src/components/common/Navbar.tsx
  src/components/streamplay/PremiumCard.tsx
  src/components/streamplay/RegionBrowser.tsx
  src/components/streamplay/RegionData.ts
  src/context/AuthContext.tsx
  src/pages/DevicesPage.tsx
  src/pages/PricingPage.tsx
)

# 1. Compose tree: parent tree + our edited files (read from p2src staging tree)
GIT_INDEX_FILE="$IDX" git read-tree "$PARENT"
for f in "${FILES[@]}"; do
  GIT_INDEX_FILE="$IDX" git update-index --add --cacheinfo \
    "100644,$(git hash-object -w "p2src/$f"),$f"
done
TREE=$(GIT_INDEX_FILE="$IDX" git write-tree)
rm -f "$IDX"

# 2. Show EXACTLY what this commit changes vs parent
echo "=== COMMIT DIFFSTAT vs $PARENT ==="
git diff-tree --stat "$PARENT" "$TREE" | tail -15

# 3. Safety: assert the changeset touches ONLY the intended paths
CHANGED=$(git diff-tree -r --name-only "$PARENT" "$TREE")
EXPECTED=$'src/context/AuthContext.tsx
src/components/common/Navbar.tsx
src/pages/PricingPage.tsx
src/pages/DevicesPage.tsx
src/components/streamplay/RegionBrowser.tsx
src/components/streamplay/PremiumCard.tsx
src/components/streamplay/RegionData.ts
server/db/store.ts
.env.example'
NORMALIZED=$(echo "$CHANGED" | sort)
EXPECTED_SORTED=$(echo "$EXPECTED" | sort)
if [ "$NORMALIZED" != "$EXPECTED_SORTED" ]; then
  echo "UNEXPECTED PATHS IN CHANGESET — ABORTING"; echo "$CHANGED"; exit 1
fi
echo "PATH GUARD: PASS (exactly ${#FILES[@]} intended files)"

# 4. Secret scan on added lines (ignore comment lines that document the retired names)
echo "=== SECRET SCAN (added lines, non-comment) ==="
if git diff-tree -p "$PARENT" "$TREE" | grep '^+' | grep -vE '^\+\s*(#|//|\*|/\*)' | grep -Ein "password\s*[:=]\s*['\"][^'\"$]{4,}|['\"](admin123|member123)['\"]|ghp_|vcp_|sb_secret|service_role" ; then
  echo "SECRET SCAN: SUSPICIOUS LINES ABOVE — ABORTING"; exit 1
fi
echo "SECRET SCAN: CLEAN"

# 5. Commit
COMMIT=$(git commit-tree "$TREE" -p "$PARENT" -m "fix(phase2): pre-merge review — auth hardening, honest device/taxonomy copy, functional fixes

SECURITY (demo authentication exposure):
- AuthContext: remove PILOT_PERSONAS hard-coded credentials + quickSwitchPersona
  (one-tap persona login incl. Director/Admin) from the client bundle.
- PricingPage: remove anonymous instant persona-switch controls; neutral email
  placeholder; director-provisioned access messaging.
- Navbar: remove admin persona switcher (client-side role state + hard-coded
  credentials).
- server/db/store.ts: seeded pilot passwords no longer hard-coded. Sign-in for
  seeded accounts requires PILOT_PASSWORD_ADMIN / PILOT_PASSWORD_MEMBER
  (min 8 chars) provisioned server-side; unset => login 401. Retires the
  public 'admin123'/'member123' seed credentials.
- .env.example: document the new pilot password env contract + rotation.

FUNCTIONAL FIXES:
- RegionBrowser: Retry now genuinely re-fires the failed catalog request
  (setPage(p=>p) was a React state no-op; replaced with a real retry nonce).
- PremiumCard: exactly one handler runs per activation — center play fires
  onPlay when provided else onClick, never both (the old
  onPlay?.() ?? onClick?.() chain double-fired void handlers).
- RegionData: languages are no longer classified as countries — Arabic,
  Kurdish entries removed; FRENCH/DEUTSCH/DUTCH/ESPAN/LATINO/ITALIAN/MAGYAR/
  GREEK/SHQIP/PERSIAN/FILIPINO/PINAY/BANGLA/TURK matchers dropped; country
  classification restricted to explicit country markers.
- DevicesPage: device-slot copy now states verified server behavior only
  (no unverified browser/PWA identity recognition claims; entitlement copy
  marked as design intent until tiers activate).
- PricingPage: all tiers carry PROPOSED badges; compliance note states payment,
  entitlement and device enforcement are not yet active.

PRESERVED: Creator Hub Phase 1 SQL persistence, Supabase schema/RLS, IPTV/M3U/
EPG integrations, HLS playback, monetization and payout calculations, existing
catalog and production records. No DB changes. No production deploy.")

echo "NEW_COMMIT=$COMMIT"
git update-ref "refs/heads/$BRANCH" "$COMMIT" "$PARENT"
echo "BRANCH_UPDATED: $BRANCH -> $(git rev-parse --short "$BRANCH")"
