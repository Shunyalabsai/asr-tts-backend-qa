import dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ── Base URL ────────────────────────────────────────────────────
export const ASR_BASE_URL =
  process.env.ASR_BASE_URL || 'https://asrv2prod.shunyalabs.ai';

// ── Endpoints ───────────────────────────────────────────────────
export const ENDPOINTS = {
  auth: process.env.AUTH_TOKEN_ENDPOINT || '/auth/token',
  transcription: '/v1/audio/transcriptions',
  streaming: '/v1/realtime',
  streamingAlias: '/ws',
  speechIntelligence: '/v1/speechintelligence',
  speakers: {
    register: '/v1/speakers/register',
    delete: '/v1/speakers/delete',
  },
  health: '/health',
  docs: '/docs',
};

// ── Auth Config ─────────────────────────────────────────────────
export const AUTH_CONFIG = {
  apiKey: process.env.ASR_API_KEY || '',
  refreshBufferSeconds: parseInt(process.env.TOKEN_REFRESH_BUFFER_SECONDS || '120', 10),
};

// ── Timeouts ────────────────────────────────────────────────────
export const TIMEOUTS = {
  default: parseInt(process.env.DEFAULT_TIMEOUT_MS || '600000', 10),
  api: parseInt(process.env.API_TIMEOUT_MS || '120000', 10),
  health: parseInt(process.env.HEALTH_TIMEOUT_MS || '5000', 10),
  streaming: parseInt(process.env.STREAMING_TIMEOUT_MS || '60000', 10),
};

// ── Model ───────────────────────────────────────────────────────
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'zero-indic';

// ── Accuracy Thresholds ─────────────────────────────────────────
export const THRESHOLDS = {
  wer: parseFloat(process.env.ASR_WER_THRESHOLD || '0.80'),
  cer: parseFloat(process.env.ASR_CER_THRESHOLD || '0.40'),
  latencyP50: parseInt(process.env.LATENCY_P50_THRESHOLD_MS || '5000', 10),
  latencyP95: parseInt(process.env.LATENCY_P95_THRESHOLD_MS || '15000', 10),
};

// ── Performance ─────────────────────────────────────────────────
export const PERF_CONFIG = {
  concurrentCount: parseInt(process.env.CONCURRENT_REQUEST_COUNT || '5', 10),
  stressCount: parseInt(process.env.STRESS_REQUEST_COUNT || '50', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '1000', 10),
};

// ── Audio Fixtures ──────────────────────────────────────────────
export const AUDIO_DIR = process.env.AUDIO_FIXTURES_DIR || 'input/audio';

export function resolveAudioPath(relativePath: string): string {
  if (path.isAbsolute(relativePath)) return relativePath;
  // Try from project root
  const fromRoot = path.resolve(process.cwd(), relativePath);
  if (require('fs').existsSync(fromRoot)) return fromRoot;
  // Try from audio fixtures dir
  return path.resolve(process.cwd(), AUDIO_DIR, relativePath);
}

export function audioFixture(name: keyof typeof AUDIO_FIXTURE_PATHS): string {
  return resolveAudioPath(AUDIO_FIXTURE_PATHS[name]);
}

const AUDIO_FIXTURE_PATHS = {
  wav: process.env.TEST_AUDIO_FILE_WAV || 'input/audio/reference/hi_in_0.wav',
  flac: process.env.TEST_AUDIO_FILE_FLAC || 'input/audio/reference/hi_in_0.wav',   // fallback to WAV
  ogg: process.env.TEST_AUDIO_FILE_OGG || 'input/audio/reference/hinglish_arti.wav', // fallback
  sample8khz: process.env.TEST_AUDIO_FILE_8KHZ || 'input/audio/reference/hi_in_0.wav',
  sample16khz: process.env.TEST_AUDIO_FILE_16KHZ || 'input/audio/reference/hi_in_0.wav',
  stereo: process.env.TEST_AUDIO_FILE_STEREO || 'input/audio/reference/hinglish_arti.wav',
  large: process.env.TEST_AUDIO_FILE_LARGE || 'input/audio/reference/hinglish_arti.wav',
  oversized: process.env.TEST_AUDIO_FILE_OVERSIZED || 'input/audio/reference/hinglish_arti.wav',
  corrupted: process.env.TEST_AUDIO_FILE_CORRUPTED || 'input/audio/edge/corrupted.wav',
  empty: process.env.TEST_AUDIO_FILE_EMPTY || 'input/audio/edge/empty.wav',
  silent: process.env.TEST_AUDIO_FILE_SILENT || 'input/audio/reference/hi_in_1.wav',
  profane: process.env.TEST_AUDIO_FILE_PROFANE || 'input/audio/reference/hinglish_arti.wav',
  short: process.env.TEST_AUDIO_FILE_SHORT || 'input/audio/edge/short.wav',
};

export const TEST_AUDIO_URL = process.env.TEST_AUDIO_URL || '';

// ── Google Sheets ───────────────────────────────────────────────
export const GOOGLE_SHEETS = {
  spreadsheetId: process.env.GOOGLE_SHEET_ID || '',
  credentials: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
};

// ── Email ───────────────────────────────────────────────────────
export const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || '',
  to: process.env.REPORT_EMAIL_TO || '',
  from: process.env.REPORT_EMAIL_FROM || '',
  baseUrl: process.env.REPORT_BASE_URL || '',
};
