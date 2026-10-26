#!/bin/bash
# One-shot verification: ensure dev server is up inside THIS shell call,
# then run agent-browser checks. Because the sandbox reaps daemons between
# tool calls, server + checks must share a single Bash invocation.
set -u
PORT_OK=$(ss -tln 2>/dev/null | grep -c ":3000")
if [ "$PORT_OK" = "0" ]; then
  cd /home/z/my-project
  setsid nohup bun run dev >> /home/z/my-project/dev.log 2>&1 < /dev/null &
  disown
  for i in $(seq 1 25); do
    sleep 2
    if curl -s -o /dev/null -m 2 http://localhost:3000/; then break; fi
  done
fi
echo "SERVER: $(curl -s -o /dev/null -w '%{http_code}' -m 3 http://localhost:3000/)"
