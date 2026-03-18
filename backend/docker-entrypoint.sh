#!/bin/sh
set -eu

AUTH_DIR="/usr/src/app/.wwebjs_auth"

if [ -d "$AUTH_DIR" ]; then
  find "$AUTH_DIR" \
    \( -name 'Singleton*' \
    -o -name 'LOCK' \
    -o -name '.org.chromium.Chromium*' \
    -o -name 'DevToolsActivePort' \
    -o -name 'BrowserMetrics-spare.pma' \
    -o -name '*.db-journal' \
    -o -name '*.db-wal' \
    -o -name '*.db-shm' \) \
    -delete 2>/dev/null || true
fi

dockerize -wait tcp://${DB_HOST}:3306
npx sequelize db:migrate
exec node dist/server.js
