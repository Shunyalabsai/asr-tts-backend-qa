# Text-to-Speech (TTS) Test Suite

Comprehensive automated test suite for Shunya Labs Text-to-Speech API endpoints based on the official [ShunyaLabs TTS API Integration Guide](../../Project_doc/ShunyaLabs_TTS_API_Integration_Guide%20(1).pdf).

---

## Endpoints Covered

| Endpoint | Method | Purpose | Spec File |
|---|---|---|---|
| `/v1/omni-voice/synthesize` | POST | Standard speech synthesis (multilingual, multi-voice, formats) | `tts-standard-synthesize.spec.ts` |
| `/v1/omni-voice/synthesize` | POST | Education TTS with LaTeX mathematical expression processing | `tts-education-latex.spec.ts` |
| `/v1/audio/speech` | POST | Voice Agent / OpenAI-compatible speech synthesis (`tts-1`) | `tts-openai-speech.spec.ts` |
| Negative / Errors | POST | 401 Unauthorized, 400 Bad Request, empty text validation | `tts-error-handling.spec.ts` |

---

## Authentication

- Token endpoint: `POST https://app.shunyalabs.ai/api/auth/token`
- Header: `api-key: <YOUR_API_KEY>` or `Authorization: Bearer <API_KEY>`
- Body: `{"expires_in": 86400}`
- Returns Bearer token used for all TTS calls.

---

## Running TTS Tests

```bash
# Run all TTS tests
npx playwright test src/features/tts/

# Run individual TTS specs
npx playwright test src/features/tts/tts-standard-synthesize.spec.ts
npx playwright test src/features/tts/tts-education-latex.spec.ts
npx playwright test src/features/tts/tts-openai-speech.spec.ts
npx playwright test src/features/tts/tts-error-handling.spec.ts
```
