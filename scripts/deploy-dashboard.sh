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

cd "$TEMP_DIR"
git init -b gh-pages
git config user.name "yamini-pal-singh"
git config user.email "yamini@unitedwecare.com"
git remote add origin "$CURRENT_REMOTE"
git add -A
git commit -m "deploy: update STT & TTS dashboard and run history ($(date +'%Y-%m-%d %H:%M:%S'))"

echo "Pushing to gh-pages..."
git push -f origin gh-pages

cd - > /dev/null
rm -rf "$TEMP_DIR"

echo "═══════════════════════════════════════════════"
echo "✅ GitHub Pages Dashboard successfully updated!"
echo "═══════════════════════════════════════════════"
