#!/usr/bin/env bash
set -euo pipefail

# Phase-1 canary helper for BIA monorepo.
#
# Usage:
#   ./scripts/deploy-backend-canary.sh [repo_or_platform_root]
#
# Optional env flags:
#   AUTO_PROMOTE_MAIN=true   # default: false
#   PUSH_WORK=true           # default: true
#   DRY_RUN=true             # default: false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)"
INPUT_ROOT="${1:-$DEFAULT_ROOT}"

if [[ -z "$INPUT_ROOT" ]]; then
  echo "❌ Could not determine repository root. Pass it explicitly." >&2
  exit 1
fi

ROOT="$(cd "$INPUT_ROOT" && pwd)"
AUTO_PROMOTE_MAIN="${AUTO_PROMOTE_MAIN:-false}"
PUSH_WORK="${PUSH_WORK:-true}"
DRY_RUN="${DRY_RUN:-false}"

run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

if ! command -v git >/dev/null 2>&1; then
  echo "❌ git is required" >&2
  exit 1
fi

if ! command -v railway >/dev/null 2>&1; then
  echo "❌ railway CLI is required (https://docs.railway.com/develop/cli)" >&2
  exit 1
fi

# Support running against either monorepo root (contains /backend)
# or umbrella root (contains /boutique-advisory-platform/backend).
if [[ -d "$ROOT/backend" && -f "$ROOT/backend/railway.json" ]]; then
  PLATFORM_DIR="$ROOT"
elif [[ -d "$ROOT/boutique-advisory-platform/backend" && -f "$ROOT/boutique-advisory-platform/backend/railway.json" ]]; then
  PLATFORM_DIR="$ROOT/boutique-advisory-platform"
else
  echo "❌ Could not locate backend service directory from: $ROOT" >&2
  exit 1
fi

SERVICE_DIR="$PLATFORM_DIR/backend"
GIT_ROOT="$(git -C "$PLATFORM_DIR" rev-parse --show-toplevel)"

cd "$GIT_ROOT"

echo "==> Verifying clean repository state"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "❌ Working tree is dirty. Commit/stash before deploy." >&2
  git status --short
  exit 1
fi

echo "==> Syncing work branch"
run git fetch origin
run git checkout work
run git pull --ff-only origin work
if [[ "$PUSH_WORK" == "true" ]]; then
  run git push origin work
fi

if [[ "$AUTO_PROMOTE_MAIN" == "true" ]]; then
  echo "==> AUTO_PROMOTE_MAIN enabled: fast-forwarding main from work"
  run git checkout main
  run git pull --ff-only origin main
  run git merge --ff-only work
  run git push origin main
  run git checkout work
else
  echo "==> AUTO_PROMOTE_MAIN disabled: skipping main branch promotion"
fi

echo "==> Deploying backend (canary-ready baseline)"
cd "$SERVICE_DIR"

# Reduce upload size before Railway upload (Cloudflare payload limits)
run find . -type d -name node_modules -prune -exec rm -rf {} +
run rm -rf .next dist build

run railway up

echo "✅ Deploy completed"
