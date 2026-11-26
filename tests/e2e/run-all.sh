#!/usr/bin/env bash
# Browser, concurrency and load tests against a production build with an
# in-memory-style local database (PGlite) and local file storage.
#
#   npm run build:e2e && npm run test:e2e
#
# Each run starts from empty data. Screenshots go to ./shots (not committed).
set -euo pipefail
cd "$(dirname "$0")/../.."

OUT="${E2E_OUT:-${TMPDIR:-/tmp}/vmr-e2e}"
mkdir -p "$OUT"
export E2E_OUT="$OUT" E2E_SERVER_LOG="$OUT/server.log"
export DB_DRIVER=pglite PGLITE_DIR="$OUT/pgdata" CV_STORAGE=local CV_LOCAL_DIR="$OUT/cvdata" MAIL_TRANSPORT=log
export ADMIN_SETUP_KEY="${ADMIN_SETUP_KEY:-test-setup-key}" CRON_SECRET="${CRON_SECRET:-test-cron-secret-1234567}"
PORT="${PORT:-3000}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:$PORT}"

# Another server on the port would answer the checks below with old data.
if curl -fs "$E2E_BASE_URL/api/health" > /dev/null 2>&1; then echo "Something is already running on $E2E_BASE_URL; stop it first."; exit 1; fi

rm -rf "$PGLITE_DIR" "$CV_LOCAL_DIR"
# Own process group, so stopping it also stops the server process next starts.
setsid npx next start -p "$PORT" > "$E2E_SERVER_LOG" 2>&1 &
SERVER=$!
trap 'kill -- -$SERVER 2>/dev/null || true' EXIT

for i in $(seq 1 60); do
  curl -fs "$E2E_BASE_URL/api/health" > /dev/null 2>&1 && break
  sleep 1
done
curl -fs "$E2E_BASE_URL/api/health" > /dev/null || { echo "server did not start"; tail -20 "$E2E_SERVER_LOG"; exit 1; }

# Order matters: run.js creates the first admin and the base data the others use.
SCRIPTS="${E2E_SCRIPTS:-run phase2 phase3 phase4 phase5 phase6 h1 h2 load}"
failed=0
for s in $SCRIPTS; do
  echo "== $s"
  if node "tests/e2e/$s.js" > "$OUT/$s.log" 2>&1; then status=0; else status=$?; fi
  # Older scripts print their checks; they must finish and report no page errors.
  if [ $status -ne 0 ] || grep -q "^FAIL" "$OUT/$s.log" || (grep -q "^errors:" "$OUT/$s.log" && ! grep -q "^errors: none" "$OUT/$s.log"); then
    echo "   failed (log: $OUT/$s.log)"; tail -15 "$OUT/$s.log"; failed=1
  else
    echo "   ok ($(grep -c '^PASS' "$OUT/$s.log" || true) checks)"
  fi
done
exit $failed
