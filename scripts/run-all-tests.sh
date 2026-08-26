#!/bin/bash
set -e

echo "=========================================="
echo "  ASR Testing Framework — Full Suite Run"
echo "=========================================="
echo ""

REPORT_DIR="reports"
mkdir -p "$REPORT_DIR"

# ─── Phase 1: Core (sequential) ──────────────────────────────
echo "⊢ Phase 1: Core Endpoints"

echo "  ⊢ Health Check..."
npx playwright test src/features/health-check/ --reporter=list 2>&1 | tail -3

echo "  ⊢ Authentication..."
npx playwright test src/features/authentication/ --reporter=list 2>&1 | tail -3

# ─── Phase 2: Audio Input ────────────────────────────────────
echo "⊢ Phase 2: Audio Input"

echo "  ⊢ Transcription (File Upload)..."
npx playwright test src/features/transcription/ --reporter=list 2>&1 | tail -3

echo "  ⊢ Language Identification..."
npx playwright test src/features/language-identification/ --reporter=list 2>&1 | tail -3

echo "  ⊢ Speaker Diarization..."
npx playwright test src/features/speaker-diarization/ --reporter=list 2>&1 | tail -3

# ─── Phase 3: Response Features ──────────────────────────────
echo "⊢ Phase 3: Response Features"

echo "  ⊢ Word Boosting..."
npx playwright test src/features/word-boosting/ --reporter=list 2>&1 | tail -3

echo "  ⊢ Profanity & Keyword Hashing..."
npx playwright test src/features/profanity-keyword-hashing/ --reporter=list 2>&1 | tail -3

echo "  ⊢ Schema Validation..."
npx playwright test src/features/schema-validation/ --reporter=list 2>&1 | tail -3

# ─── Phase 4: Speech Intelligence ────────────────────────────
echo "⊢ Phase 4: Speech Intelligence"

echo "  ⊢ Speech Intelligence (Intent/Sentiment/Summarization)..."
npx playwright test src/features/speech-intelligence/ --reporter=list 2>&1 | tail -3

# ─── Phase 5: Validation ────────────────────────────────────
echo "⊢ Phase 5: Validation & Edge Cases"

echo "  ⊢ Error Handling..."
npx playwright test src/features/error-handling/ --reporter=list 2>&1 | tail -3

echo "  ⊢ Security..."
npx playwright test src/features/security/ --reporter=list 2>&1 | tail -3

echo "  ⊢ Combination Scenarios..."
npx playwright test src/features/combination-scenarios/ --reporter=list 2>&1 | tail -3

# ─── Phase 6: New Endpoints ──────────────────────────────────
echo "⊢ Phase 6: Streaming & Speaker Management"

echo "  ⊢ Streaming..."
npx playwright test src/features/streaming/ --reporter=list 2>&1 | tail -3

echo "  ⊢ Speaker Management..."
npx playwright test src/features/speaker-management/ --reporter=list 2>&1 | tail -3

# ─── Phase 7: Performance ───────────────────────────────────
echo "⊢ Phase 7: Performance"

echo "  ⊢ Latency Performance..."
npx playwright test src/features/performance/latency-performance.spec.ts --reporter=list 2>&1 | tail -3

# ─── Phase 8: Text-to-Speech (TTS) ──────────────────────────
echo "⊢ Phase 8: Text-to-Speech (TTS)"

echo "  ⊢ Standard, Education LaTeX & OpenAI Speech TTS..."
npx playwright test src/features/tts/ --reporter=list 2>&1 | tail -3

# ─── Phase 9: Google Input Sheet Test Cases ─────────────────
echo "⊢ Phase 9: Google Input Sheet Dataset Execution"

echo "  ⊢ Running all test cases from Google Input Sheet..."
npx ts-node scripts/run-language-accuracy-tests.ts

# ─── Phase 10: Reports & Dashboard ──────────────────────────
echo ""
echo "⊢ Phase 10: Generating Reports & Updating Live Dashboard"
npx ts-node scripts/generate-report.ts 2>&1 | tail -5
bash scripts/deploy-dashboard.sh

echo ""
echo "=========================================="
echo "  Suite run complete!"
echo "  Reports saved to $REPORT_DIR/"
echo "  Live Dashboard: https://shunyalabsai.github.io/asr-tts-backend-qa/"
echo "=========================================="
