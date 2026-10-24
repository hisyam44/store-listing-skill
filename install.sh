#!/usr/bin/env bash
# Install the store-listing skill for Claude Code.
#   ./install.sh            user-level: ~/.claude/skills/store-listing (all projects)
#   ./install.sh <project>  project-level: <project>/.claude/skills/store-listing
# The skill is symlinked, so editing this repo (or `git pull`) updates the installed skill.
set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
SKILL="$REPO/store-listing"

if [[ $# -ge 1 ]]; then DEST="$(cd "$1" && pwd)/.claude/skills"; else DEST="$HOME/.claude/skills"; fi

echo "==> Installing script dependencies (Playwright + Chromium)…"
(cd "$SKILL" && npm install --no-audit --no-fund)

echo "==> Linking skill into $DEST"
mkdir -p "$DEST"
if [[ -e "$DEST/store-listing" && ! -L "$DEST/store-listing" ]]; then
  echo "    $DEST/store-listing exists and is not a symlink; leaving it alone." >&2
  exit 1
fi
ln -sfn "$SKILL" "$DEST/store-listing"

echo "==> Checking your system"
node "$SKILL/scripts/doctor.mjs" || true

cat <<MSG

Done. Restart Claude Code (or start a new session) so it picks up the skill, then in any
web app or game project that ships to the stores, ask something like:

  "Make the Google Play and App Store listing for this app: screenshots, feature graphic and descriptions"
MSG
