#!/bin/sh
# Offerstack installer: gets the app and its local AI server, installs them, and starts both.
#   curl -fsSL https://raw.githubusercontent.com/abhishek17r/resume-builder/main/install.sh | sh
# Options (environment variables):
#   OFFERSTACK_DIR=path        where to install (default: ./offerstack)
#   OFFERSTACK_NO_START=1      install only; start later with `npm run dev` in <dir>/app
# Re-running updates an existing install.
set -e

DIR="${OFFERSTACK_DIR:-offerstack}"
APP_REPO="${OFFERSTACK_APP_REPO:-https://github.com/abhishek17r/resume-builder.git}"
API_REPO="${OFFERSTACK_API_REPO:-https://github.com/abhishek17r/resume-builder-api.git}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Offerstack needs $1 — $2"; exit 1; }; }
need git "install it from https://git-scm.com"
need node "install Node.js 22 or newer from https://nodejs.org"
need npm "it comes with Node.js"
major=$(node -p 'process.versions.node.split(".")[0]')
[ "$major" -ge 22 ] || { echo "Offerstack needs Node.js 22 or newer (you have $(node -v))."; exit 1; }

mkdir -p "$DIR"
cd "$DIR"
get() {
  if [ -d "$2/.git" ]; then git -C "$2" pull --ff-only --quiet
  else git clone --depth 1 --quiet "$1" "$2"; fi
}
echo "→ Getting Offerstack"
get "$APP_REPO" app
get "$API_REPO" api

echo "→ Installing (this takes a minute)"
(cd app && npm install --silent --no-fund --no-audit)
(cd api && npm install --silent --no-fund --no-audit)
[ -f api/.env ] || cp api/.env.example api/.env

HERE=$(pwd)
echo
echo "✓ Offerstack is installed in $HERE"
echo "  • Open http://localhost:5190 once it starts"
echo "  • AI features: open Integrations in the app and connect OpenAI, Anthropic or Gemini"
echo "  • Start again later: cd $HERE/app && npm run dev"
echo

if [ -z "${OFFERSTACK_NO_START:-}" ]; then
  cd app
  exec npm run dev
fi
