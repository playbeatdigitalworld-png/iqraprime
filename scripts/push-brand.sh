#!/bin/bash
# Curated zero-destruction push: origin/main tree + only the real brand-file delta.
set -e
cd /home/z/my-project
export GIT_INDEX_FILE=/home/z/my-project/.git/push-index
rm -f "$GIT_INDEX_FILE"

git read-tree origin/main

FILES=(
  src/components/common/StreamPlayLogo.tsx
  public/icon.svg
  public/logo-horizontal.svg
  public/pwa-512x512.png
  public/pwa-192x192.png
  public/pwa-maskable-512x512.png
  public/apple-touch-icon.png
  public/favicon.ico
  scripts/gen-streamplay-icons.py
  worklog.md
)
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    h=$(git hash-object -w "$f")
    git update-index --add --cacheinfo "100644,$h,$f"
  fi
done

tree=$(git write-tree)
commit=$(printf 'brand: folded-ribbon S mark per approved StreamPlay logo sheet\n\n- Rebuilt StreamPlayMark SVG: interlocking angular ribbon folds with facet faces\n- Ported to icon.svg + logo-horizontal.svg (+tagline row)\n- Regenerated PWA/apple/favicon rasters; circle tiles for favicon/PWA, rounded square for app/mobile, maskable safe zone\n- No functional changes\n' | git commit-tree "$tree" -p origin/main)
echo "COMMIT=$commit"

git update-ref refs/heads/main "$commit"
unset GIT_INDEX_FILE
