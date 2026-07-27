# ASR Testing Framework v2

Greenfield reimplementation of the Shunyalabs ASR API automation testing framework.

**API Reference:** [Shunya Labs Speech-to-Text API v2](Project_doc/Shunya_Labs_Speech_to_Text_API_Reference_with_curl.md)  
**Test Cases:** [97 Manual Test Cases (Google Sheet)](https://docs.google.com/spreadsheets/d/149Mok2syZ-DygoP6t0ziST97rucN0qYuo2ZfO66tVVA)

---

## Project Structure — Feature-based

```
src/
├── config/                    # API endpoints, thresholds, model configs
├── types/                     # All TypeScript interfaces
├── features/                  # Organized by capability — each feature has its own folder
│   │
│   ├── authentication/        # API key → JWT token flow
│   ├── transcription/         # File upload, base64, URL input, response formats
│   ├── language-identification/  # language_code param (auto, en, hi, all codes)
│   ├── speaker-diarization/   # diarize + num_speakers (1, 2, auto-detect)
│   ├── word-boosting/         # boost_phrases + boost_weight
│   ├── profanity-keyword-hashing/ # profanity_filter boolean masking
│   ├── schema-validation/     # Response schema (segments, words, timestamps)
│   ├── speech-intelligence/   # Intent detection, sentiment analysis, summarization
│   ├── streaming/             # WebSocket /v1/realtime + /ws alias
│   ├── speaker-management/    # Register/delete speakers
│   ├── error-handling/        # 400/401/413/415/429/404/405 + error shape
│   ├── health-check/          # GET /health
│   ├── security/              # HTTPS, method validation, injection
│   ├── combination-scenarios/ # Multi-parameter edge cases
│   ├── performance/           # Latency, stress, load, spike, endurance
│   │
│   ├── translation/           # (v1 only — not in v2 API)
│   ├── transliteration/       # (v1 only — not in v2 API)
│   ├── speaker-identification/ # (v1 only — not in v2 API)
│   ├── emotional-diarization/ # (v1 only — not in v2 API)
│   ├── keyword-normalization/ # (v1 only — not in v2 API)
│   └── medical-keyword-correction/ # (v1 only — not in v2 API)
│
├── services/                  # Shared: AuthClient, ApiClient (used by all features)
├── utils/                     # Shared: WER/CER, audio helpers, PCM gen, validators
├── reporting/                 # Google Sheets, HTML, JSON, Email reporters
└── tests/helpers/             # Test setup & shared fixtures
```

## Auth Flow

1. POST `/auth/token` with `Authorization: Bearer <API_KEY>` → short-lived access token
2. Use the access token on all ASR endpoints (`Authorization: Bearer <token>`)
3. Token auto-refreshes ~2 minutes before expiry; retries once on 401

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env   # Add your API key and config
```

## Run Tests by Feature

```bash
# Full suite (phased execution)
npm run test:all

# Individual features
npm run test:health             # Quick sanity check
npm run test:auth               # Authentication tests
npm run test:transcription      # File upload + base64 + response formats
npm run test:language-identification  # Language code validation
npm run test:speaker-diarization     # Speaker diarization tests
npm run test:word-boosting          # Word boosting tests
npm run test:profanity              # Profanity filter tests
npm run test:schema                 # Response schema validation
npm run test:speech-intelligence    # Intent + sentiment + summarization
npm run test:streaming              # WebSocket streaming tests
npm run test:speaker                # Speaker management tests
npm run test:errors                 # Error handling tests
npm run test:security               # Security tests
npm run test:combinations           # Combination scenarios
npm run test:performance            # Latency performance tests

# Performance suites
npm run test:stress              # 50 concurrent requests
npm run test:load                # 5 min sustained load
npm run test:spike               # Ramping concurrency
npm run test:endurance           # 60 min endurance

# Reporting
npm run report                   # Generate HTML + JSON reports
npm run report:open              # Open HTML report
npm run report:email             # Send email report
```

## API Coverage

| Endpoint | Method | Feature | Tests |
|---|---|---|---|
| `/auth/token` | POST | Authentication | 8 |
| `/v1/audio/transcriptions` | POST | Transcription, Language, Diarization, Word Boost, Profanity, Schema | ~60 |
| `/v1/realtime` (WS) | WS | Streaming | 10 |
| `/v1/speechintelligence` | POST | Speech Intelligence | 11 |
| `/v1/speakers/register` | POST | Speaker Management | 3 |
| `/v1/speakers/delete` | DELETE | Speaker Management | 3 |
| `/health` | GET | Health Check | 2 |
| `/docs` | GET | Security | 1 |

**Total: ~110 automated tests across 15 feature areas**

## Feature Mapping (v1 → v2)

| # | Feature | v1 API | v2 API | Status |
|---|---|---|---|---|
| 1 | **Authentication** | x-api-key header | Bearer token via /auth/token | ✅ Updated |
| 2 | **Language Identification** | language_code param | language_code param | ✅ Updated |
| 3 | **Speaker Diarization** | diarize + num_speakers | diarize + num_speakers | ✅ Updated |
| 4 | **Word Timestamps** | verbose_json response | verbose_json response | ✅ Updated |
| 5 | **Profanity Filter** | custom keyword hashing | profanity_filter boolean | ✅ Updated |
| 6 | **Intent Detection** | Separate endpoint | Moved to Speech Intelligence | ✅ Merged |
| 7 | **Sentiment Analysis** | Separate endpoint | Moved to Speech Intelligence | ✅ Merged |
| 8 | **Summarization** | Separate endpoint | Moved to Speech Intelligence | ✅ Merged |
| 9 | **Word Boosting** | N/A | boost_phrases + boost_weight | 🆕 New |
| 10 | **Streaming** | N/A | WebSocket /v1/realtime | 🆕 New |
| 11 | **Speaker Management** | N/A | Register/delete endpoints | 🆕 New |
| 12 | **Translation** | /v1/translate | **Removed** | ❌ Dropped |
| 13 | **Transliteration** | /v1/transliterate | **Removed** | ❌ Dropped |
| 14 | **Speaker Identification** | /v1/speakers/identify | **Removed** | ❌ Dropped |
| 15 | **Emotional Diarization** | emotion_diarize | **Removed** | ❌ Dropped |
| 16 | **Keyword Normalization** | keyword_normalization | **Removed** | ❌ Dropped |
| 17 | **Medical Keyword Correction** | medical_correction | **Removed** | ❌ Dropped |

## Configuration

Key environment variables (see `.env.example`):

```
ASR_BASE_URL=https://asrv2prod.shunyalabs.ai
ASR_API_KEY=<your-api-key>
GOOGLE_SHEET_ID=<output-spreadsheet-id>
SMTP_HOST/ PORT/ USER/ PASS  # Email reports
```

## Test Report Dashboard (GitHub Pages)

Test results are automatically deployed to **GitHub Pages** after each scheduled run.

**Live at:** `https://yamini-pal-singh.github.io/automation-testing/`

### How it works

1. The `deploy-dashboard.yml` workflow runs after each full test suite
2. `scripts/prepare-dashboard.ts` copies the latest HTML report to `deploy/` as `index.html`
3. The report is pushed to the `gh-pages` branch
4. GitHub Pages serves the report as a live dashboard

### Manual deployment

```bash
# Run tests
npm run test:all

# Generate report
npm run report

# Prepare deployment directory
npm run dashboard:prepare

# View locally before deploying
npm run dashboard:open
```

Deployed reports include:
- **Pass/Fail banner** with overall status
- **KPI cards** (pass rate, passed/total, failed, skipped)
- **Per-feature latency table** (avg, P50, P95)
- **Failed tests detail** with error reasons
- **Full results table** with WER/CER scores

### GitHub Pages setup required

To enable the dashboard, configure your repo:

1. Go to **Settings → Pages** in your repository
2. Under "Source", select **"GitHub Actions"**
3. The `deploy-dashboard.yml` workflow will handle the rest

## CI/CD

| Workflow | Trigger | Scope |
|---|---|---|
| `ci.yml` | PR/push | Smoke tests (@smoke tagged) |
| `scheduled-tests.yml` | Weekdays 9 AM IST | Full suite + reports + email |
| `hourly-tests.yml` | Every 3 hours | Health + auth + batch smoke |
| `deploy-dashboard.yml` | Weekdays + manual | Full suite + deploy to GitHub Pages |

## Coverage Note

The markdown API reference at `Project_doc/Shunya_Labs_Speech_to_Text_API_Reference_with_curl.md` is the **definitive source of truth** for all endpoint specs, parameters, and auth flow. The [Google Sheet](https://docs.google.com/spreadsheets/d/149Mok2syZ-DygoP6t0ziST97rucN0qYuo2ZfO66tVVA) provides test case definitions (scenarios, expected results, priorities).
