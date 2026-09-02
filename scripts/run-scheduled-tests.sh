#!/bin/bash
set -eo pipefail

# Scheduled execution wrapper for ASR & TTS tests
PROJECT_DIR="/Users/unitedwecare/repos/asr-testing-v2"
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export HOME="/Users/unitedwecare"

TIMESTAMP=$(date "+%Y-%m-%d_%H-%M-%S")
LOG_FILE="$LOG_DIR/scheduled_run_${TIMESTAMP}.log"

echo "========================================================" >> "$LOG_FILE"
echo "  Scheduled Test Run Started: $(date)" >> "$LOG_FILE"
echo "========================================================" >> "$LOG_FILE"

cd "$PROJECT_DIR"

# Run tests and auto-deploy
npx playwright test >> "$LOG_FILE" 2>&1 || true

echo "========================================================" >> "$LOG_FILE"
echo "  Scheduled Test Run Finished: $(date)" >> "$LOG_FILE"
echo "========================================================" >> "$LOG_FILE"
