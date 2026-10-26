#!/usr/bin/env bash
# IQRAPRIME — single-call boot & verify for the sandbox preview (port 3000).
set -u
APP=/home/z/my-project/iqraprime
LOG=$APP/dev.log

port_in_use() { ss -tln 2>/dev/null | grep -q ':3000 '; }

# If the current :3000 process is not iqraprime, stop it.
if port_in_use; then
  PID=$(ss -tlnp 2>/dev/null | grep ':3000 ' | grep -oP 'pid=\K[0-9]+' | head -1)
  if [ -n "${PID:-}" ]; then
    CMD=$(tr '\0' ' ' < /proc/$PID/cmdline 2>/dev/null || true)
    if ! echo "$CMD" | grep -q "$APP"; then
      kill "$PID" 2>/dev/null || true
      sleep 1.5
    fi
  fi
fi

if ! port_in_use; then
  cd "$APP" || exit 1
  nohup bun run dev > "$LOG" 2>&1 &
  sleep 6
fi

for i in $(seq 1 25); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 4 http://localhost:3000/ || true)
  if [ "$CODE" = "200" ]; then echo "READY http://localhost:3000/ -> $CODE"; exit 0; fi
  sleep 2
done
echo "NOT READY (last code: ${CODE:-none})"; tail -25 "$LOG" 2>/dev/null; exit 1
