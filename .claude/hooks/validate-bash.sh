#!/usr/bin/env bash
# Pre-tool hook: validates bash commands before Claude executes them.
# Blocks destructive or dangerous operations.

set -euo pipefail

# Read the command from stdin (Claude Code passes tool input as JSON)
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('command',''))" 2>/dev/null || echo "")

if [ -z "$COMMAND" ]; then
  exit 0
fi

# ---------- Block list ----------

# Prevent recursive force-delete of root or critical dirs
if echo "$COMMAND" | grep -qE 'rm\s+-rf\s+(/|~|\$HOME|/etc|/usr|/var)\b'; then
  echo "BLOCKED: Refusing to rm -rf system directories." >&2
  exit 1
fi

# Prevent force push to main/master
if echo "$COMMAND" | grep -qE 'git push.*--force.*\b(main|master)\b'; then
  echo "BLOCKED: Force-pushing to main/master is not allowed." >&2
  exit 1
fi

# Prevent hard reset
if echo "$COMMAND" | grep -qE 'git reset\s+--hard'; then
  echo "BLOCKED: git reset --hard requires explicit user confirmation. Run it manually." >&2
  exit 1
fi

# Prevent piping remote scripts directly to bash (supply chain risk)
if echo "$COMMAND" | grep -qE 'curl.+\|\s*(ba)?sh|wget.+\|\s*(ba)?sh'; then
  echo "BLOCKED: Piping remote scripts to shell is not allowed." >&2
  exit 1
fi

# Prevent dropping production database tables
if echo "$COMMAND" | grep -qiE 'DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE\s+TABLE'; then
  echo "BLOCKED: Destructive SQL statements must be run manually after review." >&2
  exit 1
fi

# Prevent exposing secrets via echo/print to logs
if echo "$COMMAND" | grep -qE 'echo\s+\$ANTHROPIC_API_KEY|echo\s+\$JWT_SECRET|echo\s+\$DATABASE_URL'; then
  echo "BLOCKED: Do not echo secrets to stdout." >&2
  exit 1
fi

# ---------- Warn list (non-blocking) ----------

if echo "$COMMAND" | grep -qE 'git push\b'; then
  echo "NOTICE: Pushing to remote. Ensure branch and target are correct." >&2
fi

if echo "$COMMAND" | grep -qE 'prisma migrate (reset|dev)'; then
  echo "NOTICE: Prisma migrate reset/dev will drop and recreate the database. Confirm environment." >&2
fi

exit 0
