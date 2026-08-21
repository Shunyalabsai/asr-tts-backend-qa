// ─── Auth Types ──────────────────────────────────────────────────

export interface TokenResponse {
  token: string;
  expires_at: number;
  expires_in: number;
}

export interface AuthError {
  detail: string;
}

// ─── Transcription Types ────────────────────────────────────────

export interface TranscriptionParams {
  file?: string;         // file path
  audio_base64?: string;
  url?: string;
  model?: string;
  language_code?: string;
  diarize?: boolean;
  num_speakers?: number;
  response_format?: 'json' | 'verbose_json';
  boost_phrases?: string;
  boost_weight?: number;
  profanity_filter?: boolean;
}

export interface TranscriptionResponse {
  text: string;
}

export interface VerboseTranscriptionResponse extends TranscriptionResponse {
  audio_duration: number;
  inference_time_ms: number;
  request_id: string;
  success: boolean;
  segments: Segment[];
  words: Word[];
  speakers?: string[];
  speaker_turns?: SpeakerTurn[];
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
  confidence?: number;
  nbest?: string[];
}

export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface SpeakerTurn {
  start: number;
  end: number;
  speaker: string;
}

// ─── Streaming Types ────────────────────────────────────────────

export interface StreamingSessionParams {
  token: string;
  language: string;
  sample_rate?: number;
  diarize?: boolean;
  num_speakers?: number;
  api_key?: string;   // alternate field name accepted
}

export interface StreamingReadyEvent {
  type: 'ready';
  language: string;
  sample_rate: number;
  diarize: boolean;
}

export interface StreamingPartialEvent {
  type: 'partial';
  seg: number;
  delta: string;
  text: string;
  elapsed_ms: number;
}

export interface StreamingFinalEvent {
  type: 'final';
  seg: number;
  text: string;
  speaker?: string;
  elapsed_ms: number;
}

export interface StreamingErrorEvent {
  type: 'error';
  error: string;
}

export type StreamEvent =
  | StreamingReadyEvent
  | StreamingPartialEvent
  | StreamingFinalEvent
  | StreamingErrorEvent;

// ─── Speech Intelligence Types ──────────────────────────────────

export interface SpeechIntelligenceParams {
  text: string;
  enable_intent_detection?: boolean;
  enable_summarization?: boolean;
  enable_sentiment_analysis?: boolean;
}

export interface SpeechIntelligenceResponse {
  success: boolean;
  text: string;
  analysis?: SpeechAnalysis;
}

export interface SpeechAnalysis {
  intent?: string;
  summary?: string;
  sentiment?: string;
}

// ─── Speaker Types ──────────────────────────────────────────────

export interface SpeakerRegisterResponse {
  success: boolean;
  speaker: string;
  message: string;
}

export interface SpeakerDeleteResponse {
  success: boolean;
}

export interface SpeakerDeleteParams {
  name: string;
  project?: string;
}

// ─── Health Types ───────────────────────────────────────────────

export interface HealthResponse {
  ok: boolean;
  model_tier?: {
    url: string;
    reachable: boolean;
    latency_ms: number;
    detail: string;
  };
  stages?: Record<string, boolean | string[]>;
  features?: {
    available: string[];
    defaults_on: string[];
    notes: string[];
  };
}

// ─── TTS Types ──────────────────────────────────────────────────

export type TtsAudioFormat = 'wav' | 'pcm' | 'mp3' | 'flac' | 'ogg' | 'ogg_opus' | 'mulaw' | 'alaw' | 'aac';

export interface TtsSynthesizeParams {
  text: string;
  voice?: string;
  latex?: boolean;
  language?: string;
  response_format?: TtsAudioFormat;
  speed?: number;
  rate?: number;
  sample_rate?: number;
  silence_padding?: number;
  ambient_sound?: string;
}

export interface TtsOpenAiSpeechParams {
  model?: string;
  input: string;
  voice: string;
  response_format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';
  speed?: number;
}

export interface TtsSynthesizeResponse {
  audioBuffer: Buffer;
  contentType: string;
  sizeBytes: number;
  latencyMs: number;
}

export interface TtsTokenResponse {
  token: string;
  expires_at: number;
  expires_in: number;
  allowed_voices?: string[];
  features?: Record<string, any>;
  limits?: {
    max_file_mb?: number;
    max_audio_s?: number;
    max_characters?: number;
  };
}

// ─── Error Types ────────────────────────────────────────────────

export interface ApiErrorResponse {
  detail: string;
}

// ─── Test Result Types ──────────────────────────────────────────

export type TestStatus = 'PASS' | 'FAIL' | 'ERROR' | 'SKIP';

export interface TestResult {
  testId: string;
  module: string;
  description: string;
  status: TestStatus;
  latencyMs: number;
  wer?: number;
  cer?: number;
  failureReason?: string;
  timestamp: string;
  requestSummary?: string;
  responseSummary?: string;
}

export interface CategorySummary {
  module: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
}

export interface ExecutionSummary {
  date: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  categories: CategorySummary[];
  results: TestResult[];
  durationMs: number;
}

export interface TestCase {
  category: string;
  testId: string;
  description: string;
  priority: string;
  params: Record<string, any>;
  expectedStatus: number;
  expectedBehavior: string;
  audioFile?: string;
  groundTruth?: string;
}

// ─── Concurrent Runner Types ────────────────────────────────────

export interface ConcurrentResult {
  index: number;
  status: TestStatus;
  latencyMs: number;
  error?: string;
}

export interface LatencyStats {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}
