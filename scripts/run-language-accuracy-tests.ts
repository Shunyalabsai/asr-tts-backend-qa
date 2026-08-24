/**
 * Language Accuracy Test Runner
 *
 * Reads test case definitions from Google Sheets (Indic Input, CodeSwitch input),
 * transcribes each audio file via the ASR API, computes WER/CER against ground truth,
 * and writes results to the correct model/feature tabs in the output sheet.
 *
 * Usage: npx ts-node scripts/run-language-accuracy-tests.ts
 *
 * Environment variables used (from .env):
 *   GOOGLE_SHEET_ID_INDIC_INPUT       — Indic test case definitions
 *   GOOGLE_SHEET_ID_CODESWITCH_INPUT  — CodeSwitch test case definitions
 *   GOOGLE_SHEET_ID                   — Output spreadsheet (results written here)
 *   ASR_WER_THRESHOLD                 — PASS/FAIL WER threshold (default 0.80)
 *   ASR_CER_THRESHOLD                 — PASS/FAIL CER threshold (default 0.40)
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env before anything else
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { AuthClient } from '../src/services/AuthClient';
import { ApiClient } from '../src/services/ApiClient';
import { BatchTranscriptionClient } from '../src/features/transcription/transcription.service';
import { calculateWER } from '../src/utils/werCalculator';
import { calculateCER } from '../src/utils/cerCalculator';
import { getLocalDateStr, getTimestamp } from '../src/utils/audioHelper';
import { DEFAULT_MODEL, THRESHOLDS } from '../src/config';
import { execSync } from 'child_process';

// ─── Audio Conversion ──────────────────────────────────────────────

function findAudioConverter(): string | null {
  try {
    execSync('which afconvert 2>/dev/null', { stdio: 'pipe' });
    return 'afconvert';
  } catch { /* not available */ }
  try {
    const ffpath = require.resolve('ffmpeg-static');
    return ffpath;
  } catch { /* not available */ }
  try {
    execSync('which ffmpeg 2>/dev/null', { stdio: 'pipe' });
    return 'ffmpeg';
  } catch { /* not available */ }
  return null;
}

function convertToWav(inputPath: string): string {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.wav') return inputPath;

  const converter = findAudioConverter();
  if (!converter) {
    console.log(`  ⚠ No audio converter found, using original file (may fail)`);
    return inputPath;
  }

  const tmpDir = path.resolve(process.cwd(), 'reports', '.tmp-audio');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const outName = path.basename(inputPath, ext) + '.wav';
  const outPath = path.join(tmpDir, outName);

  try {
    if (converter === 'afconvert') {
      execSync(`afconvert -d I16@16000 -f WAVE "${inputPath}" "${outPath}"`, { stdio: 'pipe', timeout: 30000 });
    } else {
      const ffmpegPath = converter;
      execSync(`"${ffmpegPath}" -y -i "${inputPath}" -ar 16000 -ac 1 -sample_fmt s16 "${outPath}"`, { stdio: 'pipe', timeout: 30000 });
    }
    return outPath;
  } catch (err: any) {
    console.log(`  ⚠ Audio conversion failed: ${err.message}, using original`);
    return inputPath;
  }
}

// ─── Configuration ─────────────────────────────────────────────────

interface AccuracyConfig {
  werThreshold: number;
  cerThreshold: number;
  model: string;
  concurrency: number;
}

const ACCURACY_CONFIG: AccuracyConfig = {
  werThreshold: THRESHOLDS.wer,
  cerThreshold: THRESHOLDS.cer,
  model: DEFAULT_MODEL,
  concurrency: 3,
};

// ─── Tab Mapping: Input Sheet Tabs → Output Sheet Tabs ────────────

interface TabMapping {
  inputSheetVar: string;  // env var name for the input sheet ID
  inputTab: string;       // tab name in the input sheet
  outputTab: string;      // tab name in the output sheet
  type: 'model' | 'feature';
}

/**
 * Maps input sheet tabs to their corresponding output tabs.
 * Model tabs contain transcription accuracy data (same schema).
 * Feature tabs contain feature-specific test results (different schemas).
 */
const TAB_MAPPINGS: TabMapping[] = [
  // ── Model tabs from ASR_TTS_Dataset_Input sheet ──
  { inputSheetVar: 'GOOGLE_SHEET_ID_INDIC_INPUT', inputTab: 'indicvoices_sample',    outputTab: 'zero-indic',       type: 'model' },
  { inputSheetVar: 'GOOGLE_SHEET_ID_INDIC_INPUT', inputTab: 'codeSwitchvoices_sample', outputTab: 'zero-codeswitch',  type: 'model' },
  // ── Model tabs from Datasets_audio sheet ──
  { inputSheetVar: 'GOOGLE_SHEET_ID_CODESWITCH_INPUT', inputTab: 'Zero-Med_sample',         outputTab: 'zero-med',         type: 'model' },
  // ── Feature tabs (TODO: requires feature-specific test logic) ──
  // { inputSheetVar: 'GOOGLE_SHEET_ID_CODESWITCH_INPUT', inputTab: 'Speaker_Diarization_Sample',  outputTab: 'Feat-SpeakerDiarization',  type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_CODESWITCH_INPUT', inputTab: 'Feature-Translation',           outputTab: 'Feat-Translation',         type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_CODESWITCH_INPUT', inputTab: 'Feature-Transliteration',        outputTab: 'Feat-Transliteration',     type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_CODESWITCH_INPUT', inputTab: 'Feature-Summarization',          outputTab: 'Feat-Summarization',       type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_CODESWITCH_INPUT', inputTab: 'Feature-Intent-Detection',       outputTab: 'Feat-IntentDetection',     type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_CODESWITCH_INPUT', inputTab: 'Feature-Constrained-Intent',     outputTab: 'Feat-Constrained-Intent',  type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_CODESWITCH_INPUT', inputTab: 'Feature-Sentiment-Analysis',     outputTab: 'Feat-SentimentAnalysis',   type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_CODESWITCH_INPUT', inputTab: 'Feature-Emotion-Diarization',    outputTab: 'Feat-EmotionDiarization',  type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_CODESWITCH_INPUT', inputTab: 'Feature-Profanity-Hashing',      outputTab: 'Feat-ProfanityHashing',    type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_CODESWITCH_INPUT', inputTab: 'Feature-Custom-Keyword-Hashing', outputTab: 'Feat-CustomKeywordHashing',type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_CODESWITCH_INPUT', inputTab: 'Feature-Keyword-Normalization',  outputTab: 'Feat-KeywordNormalization', type: 'feature' },
  // Feature tabs from ASR_TTS_Dataset_Input:
  // { inputSheetVar: 'GOOGLE_SHEET_ID_INDIC_INPUT', inputTab: 'Feature-Summarization',            outputTab: 'Feat-Summarization',       type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_INDIC_INPUT', inputTab: 'Feature-Keyword-Normalization',     outputTab: 'Feat-KeywordNormalization',type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_INDIC_INPUT', inputTab: 'Feature-Emotion-Diarization',       outputTab: 'Feat-EmotionDiarization',  type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_INDIC_INPUT', inputTab: 'Feature-Profanity-Hashing',         outputTab: 'Feat-ProfanityHashing',    type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_INDIC_INPUT', inputTab: 'Feature-Sentiment-Analysis',        outputTab: 'Feat-SentimentAnalysis',   type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_INDIC_INPUT', inputTab: 'Feature-Custom-Keyword-Hashing',    outputTab: 'Feat-CustomKeywordHashing',type: 'feature' },
  // { inputSheetVar: 'GOOGLE_SHEET_ID_INDIC_INPUT', inputTab: 'Feature-Intent-Detection',          outputTab: 'Feat-IntentDetection',     type: 'feature' },
];

// ─── Services ──────────────────────────────────────────────────────

const authClient = new AuthClient();
const apiClient = new ApiClient(authClient);
const batchClient = new BatchTranscriptionClient(apiClient);

// ─── Helpers ───────────────────────────────────────────────────────

function csvEscape(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function writeCSV(filePath: string, headers: string[], rows: string[][]): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const csvLines = [
    headers.map(h => csvEscape(h)).join(','),
    ...rows.map(r => r.map(v => csvEscape(v)).join(',')),
  ];
  const bom = '﻿';
  fs.writeFileSync(filePath, bom + csvLines.join('\n'), 'utf-8');
  console.log(`CSV written: ${filePath} (${rows.length} rows)`);
}

function resolveAudioPath(audioUrl: string): string {
  if (!audioUrl) return '';
  // Try the path as-is
  if (fs.existsSync(audioUrl)) return audioUrl;

  // Try within the current project's input/ directory
  const oldBase = '/Users/unitedwecare/repos/asr-testing/asr-testing';
  const relative = audioUrl.replace(oldBase, '').replace(/^\/+/, '');
  const newPath = path.resolve(process.cwd(), relative);
  if (fs.existsSync(newPath)) return newPath;

  // Try under input/ directly
  const inputRelative = relative.replace(/^input\//, '');
  const altPath = path.resolve(process.cwd(), 'input', inputRelative);
  if (fs.existsSync(altPath)) return altPath;

  // Try under Long_Medical_files
  const fileName = path.basename(audioUrl);
  const longMedPath = path.resolve(process.cwd(), 'input/indicvoices_data/audio/Long_Medical_files', fileName);
  if (fs.existsSync(longMedPath)) return longMedPath;

  // Try under audio reference
  const refPath = path.resolve(process.cwd(), 'input/audio/reference', fileName);
  if (fs.existsSync(refPath)) return refPath;

  return audioUrl;
}

// ─── Google Sheets Helpers ─────────────────────────────────────────

async function getSheetsClient() {
  const { google } = await import('googleapis');
  const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credsJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');

  let credentials: any;
  try {
    const resolvedPath = path.resolve(process.cwd(), credsJson);
    if (fs.existsSync(resolvedPath)) {
      credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
    } else {
      credentials = JSON.parse(credsJson);
    }
  } catch {
    credentials = JSON.parse(credsJson);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Read test cases from a specific tab in an input sheet using the Sheets API.
 * Parses by header name for flexibility across different tab formats.
 */
async function fetchTabCases(sheetId: string, tabName: string): Promise<{ testCaseId: string; audioUrl: string; resolvedAudioPath: string; language: string; detectLanguageCode: string; expectedLanguageCode: string; groundTruth: string }[]> {
  const sheets = await getSheetsClient();

  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabName}!A:Z`,
  });

  const rows = data.data.values || [];
  if (rows.length < 2) {
    console.log(`  ${tabName}: No data rows found`);
    return [];
  }

  // Use header row to find columns by name
  const headers = rows[0].map(h => String(h).trim().toLowerCase());
  console.log(`  ${tabName}: Headers found: [${rows[0].join(' | ')}]`);

  const idx = (name: string) => headers.findIndex(h => h.includes(name.toLowerCase()));
  const idIdx = idx('test case id') >= 0 ? idx('test case id') : idx('test_case_id');
  const audioIdx = idx('audio file') >= 0 ? idx('audio file') : (idx('audio url') >= 0 ? idx('audio url') : idx('audio_url'));
  const gtIdx = idx('expected text') >= 0 ? idx('expected text') : (idx('ground_truth') >= 0 ? idx('ground_truth') : (idx('ground truth') >= 0 ? idx('ground truth') : idx('reference')));
  const langIdx = idx('expected language') >= 0 ? idx('expected language') : idx('language');
  const detectIdx = idx('detect_language_code') >= 0 ? idx('detect_language_code') : idx('detect language code');
  const expectIdx = idx('expected_language_code') >= 0 ? idx('expected_language_code') : idx('expected language code');

  if (idIdx < 0 || audioIdx < 0) {
    console.warn(`  ${tabName}: Cannot find required columns (test case id, audio file/url) — skipping`);
    return [];
  }

  const cases: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const testCaseId = String(row[idIdx] || '').trim();
    if (!testCaseId || testCaseId.startsWith('test_case_id')) continue;

    const audioUrl = String(row[audioIdx] || '').trim();
    if (!audioUrl) continue;

    cases.push({
      testCaseId,
      audioUrl,
      resolvedAudioPath: resolveAudioPath(audioUrl),
      language: langIdx >= 0 ? String(row[langIdx] || '').trim() : '',
      detectLanguageCode: detectIdx >= 0 ? String(row[detectIdx] || '').trim() : '',
      expectedLanguageCode: expectIdx >= 0 ? String(row[expectIdx] || '').trim() : '',
      groundTruth: gtIdx >= 0 ? String(row[gtIdx] || '').trim() : '',
    });
  }

  console.log(`  ${tabName}: ${cases.length} test cases loaded`);
  return cases;
}

/**
 * Append results to a model tab in the output sheet.
 * Model tab schema: date | audio_path | lang | lang_code | detected_language | lang_code_match |
 *   Transcript / ground_truth_text | Shunyalabs_transcribed_text | duration | latency_ms |
 *   wer | cer | test_status | failure_reason | timestamp
 */
async function appendToModelTab(
  outputTab: string,
  results: { testCaseId: string; audioUrl: string; language: string; expectedLangCode: string; detectedLangCode: string; langCodeMatch: string; groundTruth: string; predictedText: string; duration: string; latencyMs: number; wer: number; cer: number; testStatus: string; failureReason: string; timestamp: string }[]
): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId || results.length === 0) return;

  const sheets = await getSheetsClient();
  const dateStr = getLocalDateStr();

  // Format rows for model tab schema
  const formattedRows = results.map(r => [
    dateStr,
    r.audioUrl,
    r.language,
    r.expectedLangCode,
    r.detectedLangCode,
    r.langCodeMatch,
    r.groundTruth,
    r.predictedText,
    r.duration,
    String(r.latencyMs),
    r.wer >= 0 ? (r.wer * 100).toFixed(1) + '%' : 'N/A',
    r.cer >= 0 ? (r.cer * 100).toFixed(1) + '%' : 'N/A',
    r.testStatus,
    r.failureReason || '',
    r.timestamp,
  ]);

  try {
    // Ensure the output tab exists
    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetMeta = meta.data.sheets?.find((s: any) => s.properties.title === outputTab);
    if (!sheetMeta) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: outputTab } } }],
        },
      });
      console.log(`  Created output tab "${outputTab}"`);

      // Write header row first
      const modelHeaders = ['date', 'audio_path', 'lang', 'lang_code', 'detected_language', 'lang_code_match',
        'Transcript / ground_truth_text', 'Shunyalabs_transcribed_text', 'duration', 'latency_ms',
        'wer', 'cer', 'test_status', 'failure_reason', 'timestamp'];
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${outputTab}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [modelHeaders] },
      });
    }

    // Find the last non-empty row to append after
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${outputTab}!A:O`,
    });
    const existingRows = existing.data.values || [];
    const startRow = Math.max(existingRows.length, 1); // row 1 = header, data starts at row 2

    if (existingRows.length <= 1) {
      // Only header exists — write starting at row 2
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${outputTab}!A${startRow + 1}`,
        valueInputOption: 'RAW',
        requestBody: { values: formattedRows },
      });
    } else {
      // Append after existing data (leave a blank row separator)
      const appendRow = existingRows.length + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${outputTab}!A${appendRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: formattedRows },
      });
    }

    console.log(`  ✓ ${outputTab}: ${formattedRows.length} results appended`);
  } catch (err: any) {
    console.error(`  ✗ Failed to write to "${outputTab}": ${err.message}`);
  }
}

// ─── Test Runner ───────────────────────────────────────────────────

interface TestCase {
  testCaseId: string;
  audioUrl: string;
  resolvedAudioPath: string;
  language: string;
  detectLanguageCode: string;
  expectedLanguageCode: string;
  groundTruth: string;
}

interface TestResult {
  testCaseId: string;
  audioUrl: string;
  language: string;
  expectedLangCode: string;
  detectedLangCode: string;
  langCodeMatch: string;
  groundTruth: string;
  predictedText: string;
  duration: string;
  latencyMs: number;
  wer: number;
  cer: number;
  testStatus: string;
  failureReason: string;
  timestamp: string;
}

async function runSingleTest(tc: TestCase): Promise<TestResult> {
  const timestamp = getTimestamp();

  // Check file existence
  if (!tc.resolvedAudioPath || !fs.existsSync(tc.resolvedAudioPath)) {
    console.log(`  [SKIP] ${tc.testCaseId} — audio not found: ${tc.resolvedAudioPath || '(none)'}`);
    return {
      testCaseId: tc.testCaseId,
        audioUrl: tc.audioUrl,
        language: tc.language,
        expectedLangCode: tc.expectedLanguageCode,
        groundTruth: tc.groundTruth,
      detectedLangCode: 'FILE_NOT_FOUND',
      langCodeMatch: 'NO',
      predictedText: '',
      duration: '0',
      latencyMs: 0,
      wer: -1,
      cer: -1,
      testStatus: 'SKIP',
      failureReason: 'Audio file not found',
      timestamp,
    };
  }

  console.log(`  [RUN]  ${tc.testCaseId} (${tc.language}) — ${path.basename(tc.resolvedAudioPath)}`);

  const convertedPath = convertToWav(tc.resolvedAudioPath);

  try {
    const start = Date.now();
    const response = await batchClient.transcribeFile(convertedPath, {
      model: ACCURACY_CONFIG.model,
      language_code: tc.detectLanguageCode || undefined,
      response_format: 'verbose_json',
    });
    const latencyMs = Date.now() - start;

    const body = response.body as any;
    const predictedText = (body.text || '').trim();
    const duration = body.duration ? String(body.duration) : '0';

    const groundTruth = tc.groundTruth || '';
    const wer = groundTruth ? calculateWER(groundTruth, predictedText) : -1;
    const cer = groundTruth ? calculateCER(groundTruth, predictedText) : -1;

    const detectedLangCode = body.language_code || body.detected_language || body.language || '';
    const langCodeMatch = detectedLangCode && tc.expectedLanguageCode
      ? (detectedLangCode === tc.expectedLanguageCode ? 'YES' : 'NO')
      : 'N/A';

    const werOk = wer < 0 || wer <= ACCURACY_CONFIG.werThreshold;
    const cerOk = cer < 0 || cer <= ACCURACY_CONFIG.cerThreshold;
    const testStatus = (werOk && cerOk) ? 'PASS' : 'FAIL';

    let failureReason = '';
    if (testStatus === 'FAIL') {
      if (!predictedText && groundTruth) {
        failureReason = `Empty transcription returned by API (WER: 100%, CER: 100%)`;
      } else if (!werOk && !cerOk) {
        failureReason = `WER ${(wer * 100).toFixed(1)}% (max ${(ACCURACY_CONFIG.werThreshold * 100)}%) and CER ${(cer * 100).toFixed(1)}% (max ${(ACCURACY_CONFIG.cerThreshold * 100)}%) exceeded`;
      } else if (!werOk) {
        failureReason = `WER ${(wer * 100).toFixed(1)}% exceeded threshold (max ${(ACCURACY_CONFIG.werThreshold * 100)}%)`;
      } else if (!cerOk) {
        failureReason = `CER ${(cer * 100).toFixed(1)}% exceeded threshold (max ${(ACCURACY_CONFIG.cerThreshold * 100)}%)`;
      }
    }

    const statusIcon = testStatus === 'PASS' ? '✅' : '❌';
    console.log(`  [${statusIcon}] WER: ${(wer * 100).toFixed(1)}%, CER: ${(cer * 100).toFixed(1)}%, Latency: ${latencyMs}ms`);

    return {
      testCaseId: tc.testCaseId,
      audioUrl: tc.audioUrl,
      language: tc.language,
      expectedLangCode: tc.expectedLanguageCode,
      groundTruth: tc.groundTruth,
      detectedLangCode,
      langCodeMatch,
      predictedText,
      duration,
      latencyMs,
      wer,
      cer,
      testStatus,
      failureReason,
      timestamp,
    };
  } catch (err: any) {
    console.log(`  [❌] ${tc.testCaseId} — Error: ${err.message}`);
    return {
      testCaseId: tc.testCaseId,
        audioUrl: tc.audioUrl,
        language: tc.language,
        expectedLangCode: tc.expectedLanguageCode,
        groundTruth: tc.groundTruth,
      detectedLangCode: 'ERROR',
      langCodeMatch: 'NO',
      predictedText: '',
      duration: '0',
      latencyMs: 0,
      wer: -1,
      cer: -1,
      testStatus: 'FAIL',
      failureReason: err.message || 'Unknown error',
      timestamp,
    };
  }
}

async function runWithConcurrency(
  cases: TestCase[],
  limit: number,
  onResult?: (result: TestResult) => void
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const queue = [...cases];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const tc = queue.shift()!;
      const result = await runSingleTest(tc);
      results.push(result);
      if (onResult) onResult(result);
    }
  }

  const workers = Array.from({ length: Math.min(limit, cases.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

// ─── Entry Point ───────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════');
  console.log('  Language Accuracy Test Runner');
  console.log('═══════════════════════════════════════════════\n');

  const dateStr = getLocalDateStr();

  // De-duplicate tab mappings (same output tab may appear from multiple input sheets)
  const uniqueMappings = new Map<string, TabMapping[]>();
  for (const mapping of TAB_MAPPINGS) {
    const sheetId = process.env[mapping.inputSheetVar];
    if (!sheetId) {
      console.log(`Skipping ${mapping.inputTab} (env var ${mapping.inputSheetVar} not configured)`);
      continue;
    }
    const key = `${sheetId}::${mapping.inputTab}`;
    if (!uniqueMappings.has(key)) {
      uniqueMappings.set(key, []);
    }
    uniqueMappings.get(key)!.push(mapping);
  }

  let totalAllTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  // Process each unique input tab
  for (const [key, mappings] of uniqueMappings) {
    const [sheetId, inputTab] = key.split('::');
    const outputTab = mappings[0].outputTab;
    const tabType = mappings[0].type;

    console.log(`\n─── Processing: "${inputTab}" → "${outputTab}" ───\n`);

    // Step 1: Fetch test cases
    const cases = await fetchTabCases(sheetId, inputTab);
    if (cases.length === 0) {
      console.log(`  No test cases found.`);
      continue;
    }

    // Step 2: Filter to valid cases
    const validCases = cases.filter(tc => {
      if (!tc.resolvedAudioPath || !fs.existsSync(tc.resolvedAudioPath)) {
        console.log(`  [SKIP] ${tc.testCaseId} — audio not found: ${tc.resolvedAudioPath}`);
        return false;
      }
      return true;
    });

    const skipped = cases.length - validCases.length;
    console.log(`  Audio files found: ${validCases.length}/${cases.length} (${skipped} skipped)\n`);

    if (validCases.length === 0) continue;

	    // Step 3: Run accuracy tests — write to sheet in batches of 10
	    let batchBuffer: TestResult[] = [];
	    const FLUSH_BATCH = 10;

	    const results = await runWithConcurrency(validCases, ACCURACY_CONFIG.concurrency, (result) => {
	      batchBuffer.push(result);
	      if (batchBuffer.length >= FLUSH_BATCH) {
	        appendToModelTab(outputTab, batchBuffer).catch(e => console.error(`  ⚠ Batch write failed: ${e.message}`));
	        batchBuffer = [];
	      }
	    });

	    // Flush remaining
	    if (batchBuffer.length > 0) {
	      await appendToModelTab(outputTab, batchBuffer);
	    }

	    const passed = results.filter(r => r.testStatus === "PASS").length;
	    const failed = results.filter(r => r.testStatus === "FAIL").length;
	    const skipCount = results.filter(r => r.testStatus === "SKIP").length;

	    totalAllTests += results.length;
	    totalPassed += passed;
	    totalFailed += failed;
	    totalSkipped += skipCount;

	    console.log(`\n  Results for "${outputTab}": ${passed} passed, ${failed} failed, ${skipCount} skipped`);

	    // Step 5: Write CSV locally
    const reportsDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

    const csvPath = path.join(reportsDir, `${outputTab}-${dateStr}.csv`);
    writeCSV(
      csvPath,
      ['date', 'audio_path', 'lang', 'lang_code', 'detected_language', 'lang_code_match',
       'ground_truth', 'predicted_text', 'duration', 'latency_ms', 'wer', 'cer', 'test_status', 'failure_reason', 'timestamp'],
      results.map(r => [
        dateStr, r.audioUrl, r.language, r.expectedLangCode, r.detectedLangCode,
        r.langCodeMatch, r.groundTruth, r.predictedText, r.duration, String(r.latencyMs),
        r.wer >= 0 ? (r.wer * 100).toFixed(1) + '%' : 'N/A',
        r.cer >= 0 ? (r.cer * 100).toFixed(1) + '%' : 'N/A',
        r.testStatus, r.failureReason, r.timestamp,
      ])
    );
  }

  // ─── Overall Summary ───
  console.log('\n═══════════════════════════════════════════════');
  console.log(`  OVERALL RESULTS`);
  console.log(`  Total:  ${totalAllTests}`);
  console.log(`  PASS:   ${totalPassed}`);
  console.log(`  FAIL:   ${totalFailed}`);
  console.log(`  SKIP:   ${totalSkipped}`);
  console.log(`  Rate:   ${totalAllTests > 0 ? ((totalPassed / totalAllTests) * 100).toFixed(1) : 'N/A'}%`);
  console.log('═══════════════════════════════════════════════\n');

  // Clean up temp audio files
  const tmpDir = path.resolve(process.cwd(), 'reports', '.tmp-audio');
  if (fs.existsSync(tmpDir)) {
    const files = fs.readdirSync(tmpDir);
    for (const f of files) {
      try { fs.unlinkSync(path.join(tmpDir, f)); } catch { /* ignore */ }
    }
    try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
    console.log('Temporary audio files cleaned up.');
  }

  console.log('\n✅ Language accuracy tests complete.');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
