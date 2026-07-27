# Shunya Labs — Speech-to-Text API Reference

Base URL (batch / HTTP): `https://asrv2prod.shunyalabs.ai`
Base URL (streaming / WebSocket): `wss://asrv2prod.shunyalabs.ai`

Two ways to transcribe:
- **Batch** — `POST /v1/audio/transcriptions`. Upload a file, get the whole transcript in one
  response. Use for pre-recorded audio. Authenticated with a short-lived **access token** (below).
- **Streaming** — `WS /v1/realtime`. Send live PCM frames, receive partial + final results as you go.
  Use for live audio. Authenticated with the **access token** (below) in the first message.

All requests are over TLS (HTTPS / WSS). Every ASR endpoint — batch and streaming — is authenticated
with the short-lived **access token** minted at `/auth/token` (below).

---

## Authentication

You use your **API key once** to obtain a short-lived token, then send that token on every request.
Do not send your API key to the transcription endpoints.

### `POST /auth/token`
Exchange your API key for an access token.

**Request** — send the API key in the `Authorization` header:
```
POST /auth/token
Authorization: Bearer <YOUR_API_KEY>
```


**Example — cURL:**
```bash
curl --location --request POST 'https://asrv2prod.shunyalabs.ai/auth/token' \
  --header 'accept: application/json' \
  --header 'Authorization: Bearer <API_KEY_GENERATED_IN_DASHBOARD>'
```

Use the `token` returned by this request as the Bearer token for transcription and other authenticated ASR endpoints.

**Response** `200 OK`:
```json
{ "token": "<access_token>", "expires_at": 1784745886, "expires_in": 900 }
```
| Field | Type | Description |
|---|---|---|
| `token` | string | The access token to use on ASR requests. |
| `expires_at` | integer | Unix time when the token expires. |
| `expires_in` | integer | Seconds until expiry (typically 900 = 15 min). |

**Errors:** `400` (no key supplied), `401` (invalid key), `402` (insufficient balance),
`429` (too many requests).

**Usage:** cache the token and reuse it until shortly before `expires_at`; request a new one on
expiry or a `401`.

---

## Transcription

### `POST /v1/audio/transcriptions`
Transcribe an audio file.

**Request** — `multipart/form-data`, with the access token:
```
POST /v1/audio/transcriptions
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```
| Field | Type | Required | Description |
|---|---|---|---|
| `file` | file | one of `file`/`audio_base64`/`url` | Audio file (wav, mp3, flac, ogg/opus). Max 50 MB. |
| `audio_base64` | string | — | Base64 audio instead of a file upload. |
| `url` | string | — | URL to fetch the audio from. |
| `model` | string | no | ASR model (e.g. `zero-indic`, `zero-universal`). Defaults to the account model. |
| `language_code` | string | no | Language (e.g. `en`, `hi`) or `auto` to detect. Default `auto`. |
| `diarize` | boolean | no | Return per-speaker segments. Default `false`. |
| `num_speakers` | integer | no | Hint for the number of speakers (improves diarization). |
| `response_format` | string | no | `json` (default) or `verbose_json`. |


**Example — cURL (file upload):**
```bash
curl --location 'https://asrv2prod.shunyalabs.ai/v1/audio/transcriptions' \
  --header 'accept: application/json' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --form 'file=@"/C:/Users/madhu/Downloads/Audio- 24.9 MB.wav"'
```

> Replace `<ACCESS_TOKEN>` with the short-lived token returned by `POST /auth/token`, and replace the example audio path with your local file path.

**Response — `json` (default)** `200 OK`:
```json
{ "text": "the transcribed text" }
```

**Response — `verbose_json`** `200 OK`:
```json
{
  "text": "the transcribed text",
  "audio_duration": 8.0,
  "inference_time_ms": 116.6,
  "request_id": "c1a686efeedf",
  "success": true,
  "segments": [ { "start": 0.0, "end": 2.4, "text": "…", "speaker": "SPEAKER_00" } ],
  "words":    [ { "word": "…", "start": 0.0, "end": 0.3 } ],
  "speakers": [ "SPEAKER_00", "SPEAKER_01" ],
  "speaker_turns": [ { "start": 0.0, "end": 2.4, "speaker": "SPEAKER_00" } ]
}
```
| Field | Type | Description |
|---|---|---|
| `text` | string | Full transcript. |
| `audio_duration` | float | Audio length in seconds. |
| `inference_time_ms` | float | Processing time. |
| `request_id` | string | Identifier for this request (quote it in support tickets). |
| `success` | boolean | Whether transcription succeeded. |
| `segments` | array | Time-stamped segments (with `speaker` when `diarize=true`). |
| `words` | array | Word-level timestamps. |
| `speakers` / `speaker_turns` | array | Present when `diarize=true`. |

**Errors:** `400` (bad request / audio exceeds plan limit), `401` (missing/invalid/expired token),
`403` (token not permitted for this endpoint), `413` (file too large), `415` (unsupported audio),
`429` (rate limit), `504` (timeout).

---

## Realtime streaming

### `WS /v1/realtime`
Live speech-to-text over WebSocket (English + 22 Indic languages). Also reachable at `WS /ws` (same
behaviour). For **pre-recorded** files use the batch endpoint above — it's faster and returns the whole
transcript at once. Streaming is for **live** audio where partial results matter.

```
wss://asrv2prod.shunyalabs.ai/v1/realtime
```

**Authentication** — the **access token** from `/auth/token` (the same token used for batch), sent as:
- a field in the first message: `{"token": "<access_token>", ...}` (the field `api_key` is also
  accepted for the same value), or
- a query parameter: `?token=<access_token>`, or
- an `Authorization: Bearer <access_token>` header on the WebSocket upgrade.

**1. Open the session** — send one JSON message (text or binary frame):
```json
{ "token": "<access_token>", "language": "hi", "sample_rate": 8000, "diarize": true, "num_speakers": 2 }
```
| field | required | notes |
|---|---|---|
| `token` | yes (or query param / Bearer header) | the access token from `/auth/token` |
| `language` | **yes** | `en`, `hi`, `bn`, `gu`, `kn`, `ml`, `mr`, `ta`, `te`, … There is **no auto-detect** — omitting `language` or sending `"auto"` produces wrong output. |
| `sample_rate` | no | of the PCM you will send. Default `16000`; `8000` supported. |
| `diarize` | no | `true` labels each `final` with a speaker. |
| `num_speakers` | no | how many speakers, if known — improves labelling. |

**2. Send audio** — raw binary WebSocket frames: **16-bit signed PCM, little-endian, mono**, at the
`sample_rate` you declared, 20–320 ms per frame (20 ms = 320 bytes at 8 kHz is typical for telephony),
no headers (raw PCM, not WAV/MP3). Pace at roughly realtime (a 20 ms frame every 20 ms).

**3. Finish** — send the text message `end`.

**Response events** (JSON):
```json
{"type":"ready","language":"hi","sample_rate":8000,"diarize":true}
{"type":"partial","seg":3,"delta":"और फिर","text":"हाँ जी बोलिए और फिर","elapsed_ms":8420}
{"type":"final","seg":3,"text":"हाँ जी बोलिए और फिर वो अकाउंट","speaker":"SPEAKER_00","elapsed_ms":11200}
{"type":"error","error":"invalid or missing api key"}
```
| type | meaning |
|---|---|
| `ready` | session open, waiting for audio. Sent once, echoes your settings — check them before streaming. |
| `partial` | in-progress text for the current segment (~every 640 ms). `delta` = new since the last partial; `text` = segment so far. Provisional, may change. |
| `final` | segment closed; its `text` won't change. `seg` increments per segment. |
| `error` | request rejected; the socket closes afterwards. |

Build the transcript by concatenating `final.text` in `seg` order; use `partial` for live display only.
**`speaker`** appears on `final` when `diarize` was set (`SPEAKER_00`, …, stable for the connection);
it may be `null` on a very short segment (treat as unknown, not an error).

**Example (Python):**
```python
import asyncio, json, websockets

async def transcribe(pcm_frames, token, lang="hi", sr=8000):
    url = "wss://asrv2prod.shunyalabs.ai/v1/realtime"
    finals = []
    async with websockets.connect(url, max_size=None) as ws:
        await ws.send(json.dumps({"token": token, "language": lang, "sample_rate": sr}))

        async def read():
            async for msg in ws:
                ev = json.loads(msg)
                if ev.get("type") == "final" and ev.get("text"):
                    finals.append(ev["text"])
                elif ev.get("type") == "error":
                    raise RuntimeError(ev["error"])

        reader = asyncio.create_task(read())
        for frame in pcm_frames:                 # bytes: int16 LE mono
            await ws.send(frame)
            await asyncio.sleep(0.02)             # pace ~realtime
        await ws.send("end")
        await reader
    return " ".join(finals)
```

**Notes:** pace audio at realtime (pushing a long recording as fast as the socket allows can outrun the
decoder and end the connection early); reconnect on unexpected close and resume — transcript already
received via `final` events stays valid.

---

## Speech Intelligence

### `POST /v1/speechintelligence`
Run NLP analysis (intent, summary, sentiment, key terms, …) over text.

**Request** — `application/json`, with the access token:
```json
{ "text": "…", "enable_intent_detection": true, "enable_summarization": true,
  "enable_sentiment_analysis": true }
```

**Response** `200 OK`:
```json
{ "success": true, "text": "…", "analysis": { "intent": "…", "summary": "…", "sentiment": "…" } }
```
**Errors:** `400` (text required), `401`/`403` (auth), `503` (analysis unavailable).

---

## Speaker enrolment

### `POST /v1/speakers/register`
Enrol a named voiceprint so it is recognised in later calls.

**Request** — `multipart/form-data`: `name` (string), `file` (audio), `project` (string, optional).
**Response** `200 OK`: `{ "success": true, "speaker": "<name>", "message": "…" }`

### `DELETE /v1/speakers/delete`
Remove a named voiceprint. **Request:** `name` (string), `project` (optional). **Response:**
`{ "success": true }`

---

## Errors

All errors return JSON `{ "detail": "<message>" }` with the HTTP status:

| Status | Meaning |
|---|---|
| `400` | Bad request (missing/invalid input, or audio exceeds your plan limit). |
| `401` | Missing, invalid, or expired token. Re-mint at `/auth/token`. |
| `402` | Insufficient balance (at `/auth/token`). |
| `403` | Token not authorized for this endpoint. |
| `413` | Upload too large (limit 50 MB). |
| `415` | Unsupported audio format. |
| `429` | Rate limit exceeded. |
| `504` | Request timed out. |

---

## Notes for clients
- **Batch vs streaming:** pre-recorded audio → batch `POST /v1/audio/transcriptions`; live audio →
  streaming `WS /v1/realtime`. **Both authenticate with the access token** from `/auth/token`.
- **Token lifetime:** ~15 minutes. Cache and reuse for both batch and streaming; re-mint on expiry
  or a `401` / streaming `error`.
- **Audio:** batch — wav, mp3, flac, ogg/opus, up to 50 MB per request. Streaming — raw 16-bit PCM,
  LE, mono, at 8 kHz or 16 kHz.
- **`request_id`:** include it when contacting support — it identifies your request in our logs. For a
  streaming session, quote the UTC time, language, and approximate call duration.
