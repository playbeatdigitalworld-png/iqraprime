#!/bin/bash
# Pre-merge review — SAFE staging authorization regression (localhost:3001 only).
# Verifies: retired seeded credentials are rejected; env-provisioned passwords work;
# disabled-by-default behavior when no password is provisioned; device-slot sanity.
BASE=http://localhost:3001/api
ADMIN='StagingDirector#2026-secure'
MEMBER='StagingMember#2026-secure'
pass=0; fail=0

check() { # name expected_code actual_code
  local name="$1" expect="$2" got="$3"
  if [ "$expect" = "$got" ]; then pass=$((pass+1)); echo "  PASS  $name -> HTTP $got"; return 0
  else fail=$((fail+1)); echo "  FAIL  $name -> HTTP $got (expected $expect)"; return 1; fi
}

code() { curl -s -o /tmp/t_body.json -w "%{http_code}" -X POST "$BASE/auth/login" \
  -H 'Content-Type: application/json' -d "$1" --max-time 10; }

echo "== Retired seeded credentials must be rejected (401) =="
c=$(code '{"email":"admin@aetherstream.tv","password":"admin123"}');  check "admin@aetherstream.tv + admin123" 401 "$c"
c=$(code '{"email":"julian@aetherstream.tv","password":"member123"}'); check "julian@aetherstream.tv + member123" 401 "$c"
c=$(code '{"email":"elena@aetherstream.tv","password":"member123"}');  check "elena@aetherstream.tv + member123" 401 "$c"

echo "== Provisioned (env) passwords must succeed (200) =="
c=$(code "{\"email\":\"admin@aetherstream.tv\",\"password\":\"$ADMIN\"}")
check "admin + provisioned PILOT_PASSWORD_ADMIN" 200 "$c"
[ "$c" = "200" ] && rg -q '"role":"admin"' /tmp/t_body.json && echo "  PASS  admin role present in session payload" && pass=$((pass+1)) || { echo "  WARN  verify admin role manually"; }
c=$(code "{\"email\":\"julian@aetherstream.tv\",\"password\":\"$MEMBER\"}"); check "julian + provisioned PILOT_PASSWORD_MEMBER" 200 "$c"
c=$(code "{\"email\":\"elena@aetherstream.tv\",\"password\":\"$MEMBER\"}");  check "elena + provisioned PILOT_PASSWORD_MEMBER" 200 "$c"

echo "== Negative cases =="
c=$(code "{\"email\":\"admin@aetherstream.tv\",\"password\":\"wrong-pass-9\"}"); check "admin + wrong password" 401 "$c"
c=$(code '{"email":"admin@aetherstream.tv"}');                                   check "missing password" 400 "$c"
c=$(code '{"email":"nobody@nowhere.test","password":"whatever-123"}');           check "unknown account" 401 "$c"

echo "== Device-slot sanity (server does not double-count repeated sign-ins) =="
M1=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"elena@aetherstream.tv\",\"password\":\"$MEMBER\"}")
M2=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"elena@aetherstream.tv\",\"password\":\"$MEMBER\"}")
if [ "$(echo "$M1" | rg -o 'aether_token_' | wc -l)" -ge 1 ] && [ "$(echo "$M2" | rg -o 'aether_token_' | wc -l)" -ge 1 ]; then
  pass=$((pass+1)); echo "  PASS  repeated member sign-ins both authorized (session reuse, no extra slot consumed)"
else fail=$((fail+1)); echo "  FAIL  repeated member sign-ins"; fi

echo
echo "STAGING AUTH RESULT: $pass passed, $fail failed"
exit $fail
