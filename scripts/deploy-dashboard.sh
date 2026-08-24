#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════════════"
echo "  Deploying Dashboard & Run History to GitHub Pages"
echo "═══════════════════════════════════════════════"

# 1. Ensure latest dashboard assets and reports are prepared
npx ts-node scripts/prepare-dashboard.ts

# 2. Push deploy/ directory to gh-pages branch
TEMP_DIR=$(mktemp -d)
cp -r deploy/* "$TEMP_DIR/"
touch "$TEMP_DIR/.nojekyll"

CURRENT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "https://github.com/yamini-pal-singh/automation-testing.git")
PERSONAL_REMOTE=$(git remote get-url personal 2>/dev/null || echo "")

cd "$TEMP_DIR"
git init -b gh-pages
git config user.name "yamini-pal-singh"
git config user.email "yamini@shunyalabs.ai"
git remote add origin "$CURRENT_REMOTE"
if [ -n "$PERSONAL_REMOTE" ]; then
  git remote add personal "$PERSONAL_REMOTE"
fi
git add -A
git commit -m "deploy: update STT & TTS dashboard and run history ($(date +'%Y-%m-%d %H:%M:%S'))"

echo "Pushing to origin (gh-pages)..."
git push -f origin gh-pages || true

if [ -n "$PERSONAL_REMOTE" ]; then
  echo "Pushing to personal (gh-pages)..."
  git push -f personal gh-pages || true
fi

cd - > /dev/null
rm -rf "$TEMP_DIR"

echo "═══════════════════════════════════════════════"
echo "✅ GitHub Pages Dashboard successfully updated!"
echo "═══════════════════════════════════════════════"
