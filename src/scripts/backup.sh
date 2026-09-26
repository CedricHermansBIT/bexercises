#!/usr/bin/env bash
set -euo pipefail
umask 077

bitlab_root=${BITLAB_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}
backup_root=${BITLAB_BACKUP_DIR:-"$bitlab_root/backups"}
mkdir -p "$backup_root"
snapshot=$(mktemp -d "$backup_root/bitlab-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")

# SQLite's online backup includes committed WAL transactions without stopping BITLab.
sqlite3 "$bitlab_root/data/exercises.db" ".backup '$snapshot/exercises.db'"
test "$(sqlite3 "$snapshot/exercises.db" 'PRAGMA integrity_check;')" = ok

tar -C "$bitlab_root" -czf "$snapshot/fixtures.tar.gz" fixtures
if [[ -f "$bitlab_root/.env" ]]; then
  cp -p "$bitlab_root/.env" "$snapshot/env.backup"
fi
printf '%s\n' "$snapshot"
