/**
 * Language Accuracy Test Runner
 *
 * Reads test case definitions from Google Sheets (Indic Input, CodeSwitch input),
 * transcribes each audio file via the ASR API, computes WER/CER against ground truth,
 * and outputs results as CSV + pushes to Google Sheets.
 *
 * Usage: npx ts-node scripts/run-language-accuracy-tests.ts
 *
 * Environment variables used (from .env):
 *   GOOGLE_SHEET_ID_INDIC_INPUT    — Indic test case definitions
 *   GOOGLE_SHEET_ID_CODESWITCH_INPUT — CodeSwitch test case definitions
 *   GOOGLE_SHEET_ID                — Output spreadsheet (results written here)
 *   ASR_WER_THRESHOLD              — PASS/FAIL WER threshold (default 0.80)
 *   ASR_CER_THRESHOLD              — PASS/FAIL CER threshold (default 0.40)
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env before anything else
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { GoogleSheetsReader, LangTestCase, LangTestResult } from '../src/data/GoogleSheetsReader';
import { AuthClient } from '../src/services/AuthClient';
import { ApiClient } from '../src/services/ApiClient';
import { BatchTranscriptionClient } from '../src/features/transcription/transcription.service';
import { calculateWER } from '../src/utils/werCalculator';
import { calculateCER } from '../src/utils/cerCalculator';
import { getLocalDateStr, getTimestamp } from '../src/utils/audioHelper';
import { DEFAULT_MODEL, THRESHOLDS } from '../src/config';
import { execSync } from 'child_process';

// ─── Audio Conversion ──────────────────────────────────────────────

/**
 * Find an available audio converter: afconvert (macOS) or ffmpeg (Linux/macOS).
 */
function findAudioConverter(): string | null {
  try {
    execSync('which afconvert 2>/dev/null', { stdio: 'pipe' });
    return 'afconvert';
  } catch { /* not available */ }
  // Try ffmpeg-static
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

/**
 * Convert an audio file to WAV for reliable API processing.
 * Returns the path to the converted WAV, or the original path if conversion fails/skipped.
 */
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
      execSync(`afconvert -d pcm:I16@16000 -f WAVE "${inputPath}" "${outPath}"`, { stdio: 'pipe', timeout: 30000 });
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
  /** WER threshold: PASS if WER <= this */
  werThreshold: number;
  /** CER threshold: PASS if CER <= this */
  cerThreshold: number;
  /** Model to use for transcription */
  model: string;
  /** Concurrency limit (how many transcriptions at once) */
  concurrency: number;
}

const ACCURACY_CONFIG: AccuracyConfig = {
  werThreshold: THRESHOLDS.wer,
  cerThreshold: THRESHOLDS.cer,
  model: DEFAULT_MODEL,
  concurrency: 3,
};

// ─── Services ──────────────────────────────────────────────────────

const reader = new GoogleSheetsReader();
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
  // Prepend BOM for Excel compatibility with Unicode
  const bom = '﻿';
  fs.writeFileSync(filePath, bom + csvLines.join('\n'), 'utf-8');
  console.log(`CSV written: ${filePath} (${rows.length} rows)`);
}

// ─── Main Logic ────────────────────────────────────────────────────

async function fetchAllTestCases(): Promise<LangTestCase[]> {
  console.log('\n── Fetching test cases from Google Sheets ──\n');

  const indic = await reader.fetchIndicCases();
  console.log(`Indic Input: ${indic.length} test cases`);

  let codeSwitch: LangTestCase[] = [];
  try {
    codeSwitch = await reader.fetchCodeSwitchCases();
    console.log(`CodeSwitch: ${codeSwitch.length} test cases`);
  } catch (err: any) {
    console.warn(`CodeSwitch sheet error (skipping): ${err.message}`);
  }

  const all = [...indic, ...codeSwitch];
  console.log(`Total: ${all.length} test cases\n`);
  return all;
}

/**
 * Run a single test case: transcribe audio → compute WER/CER → check status.
 */
async function runSingleTest(tc: LangTestCase): Promise<LangTestResult> {
  const audioPath = tc.resolvedAudioPath;

  // Check file existence
  if (!audioPath || !fs.existsSync(audioPath)) {
    console.log(`  [SKIP] ${tc.testCaseId} — audio not found: ${audioPath || '(none)'}`);
    return {
      testCaseId: tc.testCaseId,
      language: tc.language,
      expectedLangCode: tc.expectedLanguageCode,
      detectedLangCode: 'FILE_NOT_FOUND',
      langCodeMatch: 'NO',
      groundTruth: tc.groundTruth,
      predictedText: '',
      wer: -1,
      cer: -1,
      latencyMs: 0,
      testStatus: 'SKIP' as any,
    };
  }

  console.log(`  [RUN]  ${tc.testCaseId} (${tc.language}) — ${path.basename(audioPath)}`);

  // Convert non-WAV to WAV for reliable API decoding
  const convertedPath = convertToWav(audioPath);

  try {
    const start = Date.now();
    const response = await batchClient.transcribeFile(convertedPath, {
      model: ACCURACY_CONFIG.model,
      language_code: tc.detectLanguageCode || undefined,
      response_format: 'verbose_json',
    });
    const latencyMs = Date.now() - start;

    // Extract transcribed text
    const body = response.body as any;
    const predictedText = (body.text || '').trim();

    // Calculate WER and CER against ground truth
    const groundTruth = tc.groundTruth || '';
    const wer = groundTruth ? calculateWER(groundTruth, predictedText) : -1;
    const cer = groundTruth ? calculateCER(groundTruth, predictedText) : -1;

    // Try to extract detected language from verbose_json response
    const detectedLangCode = body.language_code || body.detected_language || body.language || '';

    // Determine language code match
    const langCodeMatch = detectedLangCode && tc.expectedLanguageCode
      ? (detectedLangCode === tc.expectedLanguageCode ? 'YES' : 'NO')
      : 'N/A';

    // Determine test status based on WER/CER thresholds
    const werOk = wer < 0 || wer <= ACCURACY_CONFIG.werThreshold;
    const cerOk = cer < 0 || cer <= ACCURACY_CONFIG.cerThreshold;
    const testStatus = (werOk && cerOk) ? 'PASS' : 'FAIL';

    const statusIcon = testStatus === 'PASS' ? '✅' : '❌';
    console.log(`  [${statusIcon}] ${tc.testCaseId} — WER: ${(wer * 100).toFixed(1)}%, CER: ${(cer * 100).toFixed(1)}%, Latency: ${latencyMs}ms`);

    return {
      testCaseId: tc.testCaseId,
      language: tc.language,
      expectedLangCode: tc.expectedLanguageCode,
      detectedLangCode,
      langCodeMatch,
      groundTruth,
      predictedText,
      wer,
      cer,
      latencyMs,
      testStatus,
    };
  } catch (err: any) {
    console.log(`  [❌] ${tc.testCaseId} — Error: ${err.message}`);
    return {
      testCaseId: tc.testCaseId,
      language: tc.language,
      expectedLangCode: tc.expectedLanguageCode,
      detectedLangCode: 'ERROR',
      langCodeMatch: 'NO',
      groundTruth: tc.groundTruth || '',
      predictedText: '',
      wer: -1,
      cer: -1,
      latencyMs: 0,
      testStatus: 'FAIL' as any,
    };
  }
}

/**
 * Process test cases with concurrency control.
 */
async function runWithConcurrency(
  cases: LangTestCase[],
  limit: number
): Promise<LangTestResult[]> {
  const results: LangTestResult[] = [];
  const queue = [...cases];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const tc = queue.shift()!;
      const result = await runSingleTest(tc);
      results.push(result);
    }
  }

  const workers = Array.from({ length: Math.min(limit, cases.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Build per-language summary from individual test results.
 */
function buildLanguageSummary(results: LangTestResult[]): { language: string; total: number; passed: number; avgWer: number; avgCer: number }[] {
  const byLang: Record<string, LangTestResult[]> = {};
  for (const r of results) {
    const lang = r.language || 'unknown';
    if (!byLang[lang]) byLang[lang] = [];
    byLang[lang].push(r);
  }

  const summaries: { language: string; total: number; passed: number; avgWer: number; avgCer: number }[] = [];
  for (const lang of Object.keys(byLang)) {
    const list = byLang[lang];
    const valid = list.filter(r => r.wer >= 0);
    summaries.push({
      language: lang,
      total: list.length,
      passed: list.filter(r => r.testStatus === 'PASS').length,
      avgWer: valid.length ? valid.reduce((s, r) => s + r.wer, 0) / valid.length : -1,
      avgCer: valid.length ? valid.reduce((s, r) => s + r.cer, 0) / valid.length : -1,
    });
  }

  summaries.sort((a, b) => a.avgWer - b.avgWer); // best first
  return summaries;
}

/**
 * Push results to the output Google Sheet.
 */
async function pushToGoogleSheets(
  results: LangTestResult[],
  languageSummaries: { language: string; total: number; passed: number; avgWer: number; avgCer: number }[],
  dateStr: string
): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    console.warn('GoogleSheetsReporter: No GOOGLE_SHEET_ID configured. Skipping push.');
    return;
  }

  try {
    const { google } = await import('googleapis');
    const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credsJson) {
      console.warn('GoogleSheetsReporter: No GOOGLE_SERVICE_ACCOUNT_JSON configured. Skipping push.');
      return;
    }

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
    const sheets = google.sheets({ version: 'v4', auth });

    // ─── Tab 1: Language Accuracy — Per-language summary ──────────
    const accTab = 'Language Accuracy';
    try {
      // Ensure sheet exists
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const existing = spreadsheet.data.sheets?.find((s: any) => s.properties.title === accTab);
      if (!existing) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: accTab } } }],
          },
        });
      }
      // Clear and write summary
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: `${accTab}!A1:E200`,
      });

      const summaryRows = [
        [`Language Accuracy Report — ${dateStr}`, '', '', '', ''],
        ['', '', '', '', ''],
        ['Language', 'Total Tests', 'Passed', 'Avg WER', 'Avg CER'],
        ...languageSummaries.map(s => [
          s.language,
          String(s.total),
          String(s.passed),
          `${(s.avgWer * 100).toFixed(1)}%`,
          `${(s.avgCer * 100).toFixed(1)}%`,
        ]),
        ['', '', '', '', ''],
        ['OVERALL', String(results.length), String(results.filter(r => r.testStatus === 'PASS').length), '', ''],
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${accTab}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: summaryRows },
      });
      console.log(`GoogleSheets: "${accTab}" tab written (${languageSummaries.length} languages)`);
    } catch (err: any) {
      console.warn(`GoogleSheets: Failed to write "${accTab}" tab: ${err.message}`);
    }

    // ─── Tab 2: Lang Details — Per-test-case detailed results ─────
    const detailTab = 'Lang Details';
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      const existing = spreadsheet.data.sheets?.find((s: any) => s.properties.title === detailTab);
      if (!existing) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: detailTab } } }],
          },
        });
      }
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: `${detailTab}!A1:J1000`,
      });

      const detailRows = [
        ['Test Case ID', 'Language', 'Status', 'WER', 'CER', 'Latency (ms)', 'Lang Code Match',
         'Expected Code', 'Detected Code', 'Ground Truth', 'Predicted Text'],
        ...results.map(r => [
          r.testCaseId,
          r.language,
          r.testStatus,
          r.wer >= 0 ? (r.wer * 100).toFixed(1) + '%' : '-',
          r.cer >= 0 ? (r.cer * 100).toFixed(1) + '%' : '-',
          String(r.latencyMs),
          r.langCodeMatch,
          r.expectedLangCode,
          r.detectedLangCode,
          r.groundTruth || '',
          r.predictedText || '',
        ]),
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${detailTab}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: detailRows },
      });
      console.log(`GoogleSheets: "${detailTab}" tab written (${results.length} results)`);
    } catch (err: any) {
      console.warn(`GoogleSheets: Failed to write "${detailTab}" tab: ${err.message}`);
    }
  } catch (err: any) {
    console.error(`GoogleSheetsReporter: Error: ${err.message}`);
  }
}

// ─── Entry Point ───────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════');
  console.log('  Language Accuracy Test Runner');
  console.log('═══════════════════════════════════════════════\n');

  const dateStr = getLocalDateStr();

  // Step 1: Fetch test cases
  const allCases = await fetchAllTestCases();
  if (allCases.length === 0) {
    console.log('No test cases found. Exiting.');
    return;
  }

  // Step 2: Filter to cases that have audio files
  const validCases = allCases.filter(tc => {
    if (!tc.resolvedAudioPath || !fs.existsSync(tc.resolvedAudioPath)) {
      return false;
    }
    return true;
  });

  const skippedCount = allCases.length - validCases.length;
  console.log(`Audio files found: ${validCases.length} / ${allCases.length} (${skippedCount} skipped — files missing)\n`);

  if (validCases.length === 0) {
    console.log('No valid test cases with audio files. Exiting.');
    return;
  }

  // Step 3: Run accuracy tests with concurrency
  console.log(`── Running accuracy tests (concurrency: ${ACCURACY_CONFIG.concurrency}) ──\n`);

  const startTime = Date.now();
  const results = await runWithConcurrency(validCases, ACCURACY_CONFIG.concurrency);
  const totalDurationMs = Date.now() - startTime;

  // Step 4: Build summary
  const passed = results.filter(r => r.testStatus === 'PASS').length;
  const failed = results.filter(r => r.testStatus === 'FAIL').length;
  const skipped = results.filter(r => r.testStatus === 'SKIP').length;

  const avgWer = results
    .filter(r => r.wer >= 0)
    .reduce((s, r) => s + r.wer, 0) / Math.max(1, results.filter(r => r.wer >= 0).length);

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  RESULTS`);
  console.log(`  Total:   ${results.length}`);
  console.log(`  PASS:    ${passed}`);
  console.log(`  FAIL:    ${failed}`);
  console.log(`  SKIP:    ${skipped}`);
  console.log(`  Avg WER: ${(avgWer * 100).toFixed(1)}%`);
  console.log(`  Time:    ${Math.round(totalDurationMs / 1000)}s`);
  console.log('═══════════════════════════════════════════════\n');

  // Step 5: Build per-language summary
  const languageSummaries = buildLanguageSummary(results);

  console.log('── Per-Language Accuracy ──\n');
  console.log('  Language'.padEnd(20), 'Tests', 'Passed', 'Avg WER'.padEnd(10), 'Avg CER');
  console.log('  ' + '-'.repeat(60));
  for (const s of languageSummaries) {
    console.log(
      `  ${s.language.padEnd(20)} ${String(s.total).padEnd(5)} ${String(s.passed).padEnd(6)} ` +
      `${(s.avgWer * 100).toFixed(1)}%`.padEnd(10) + `${(s.avgCer * 100).toFixed(1)}%`
    );
  }

  // Step 6: Write CSV files
  const reportsDir = path.resolve(process.cwd(), 'reports');

  // Detailed results CSV
  const detailCsvPath = path.join(reportsDir, `language-accuracy-${dateStr}.csv`);
  writeCSV(
    detailCsvPath,
    ['Test Case ID', 'Language', 'Status', 'WER', 'CER', 'Latency (ms)', 'Lang Code Match',
     'Expected Code', 'Detected Code', 'Ground Truth', 'Predicted Text'],
    results.map(r => [
      r.testCaseId,
      r.language,
      r.testStatus,
      r.wer >= 0 ? (r.wer * 100).toFixed(1) + '%' : '-',
      r.cer >= 0 ? (r.cer * 100).toFixed(1) + '%' : '-',
      String(r.latencyMs),
      r.langCodeMatch,
      r.expectedLangCode,
      r.detectedLangCode,
      r.groundTruth || '',
      r.predictedText || '',
    ])
  );

  // Summary CSV
  const summaryCsvPath = path.join(reportsDir, `language-accuracy-summary-${dateStr}.csv`);
  writeCSV(
    summaryCsvPath,
    ['Language', 'Total Tests', 'Passed', 'Failed', 'Avg WER', 'Avg CER'],
    languageSummaries.map(s => [
      s.language,
      String(s.total),
      String(s.passed),
      String(s.total - s.passed),
      `${(s.avgWer * 100).toFixed(1)}%`,
      `${(s.avgCer * 100).toFixed(1)}%`,
    ])
  );

  // Also write to deploy directory for dashboard to read
  const deployReportsDir = path.resolve(process.cwd(), 'deploy', 'reports');
  const deployDetailPath = path.join(deployReportsDir, `language-accuracy-${dateStr}.csv`);
  const deploySummaryPath = path.join(deployReportsDir, `language-accuracy-summary-${dateStr}.csv`);

  if (!fs.existsSync(deployReportsDir)) fs.mkdirSync(deployReportsDir, { recursive: true });
  fs.copyFileSync(detailCsvPath, deployDetailPath);
  fs.copyFileSync(summaryCsvPath, deploySummaryPath);
  console.log(`\nCopied reports to deploy/reports/`);

  // Save JSON version for the dashboard to consume
  const jsonPath = path.join(deployReportsDir, `language-accuracy-${dateStr}.json`);
  const dashboardData = {
    date: dateStr,
    totalTests: results.length,
    passed,
    failed,
    skipped,
    avgWer: (avgWer * 100).toFixed(1) + '%',
    durationMs: totalDurationMs,
    languages: languageSummaries,
    results: results.map(r => ({
      testCaseId: r.testCaseId,
      language: r.language,
      status: r.testStatus,
      wer: r.wer >= 0 ? Number((r.wer * 100).toFixed(1)) : -1,
      cer: r.cer >= 0 ? Number((r.cer * 100).toFixed(1)) : -1,
      latencyMs: r.latencyMs,
    })),
  };
  fs.writeFileSync(jsonPath, JSON.stringify(dashboardData, null, 2));
  console.log(`JSON written: ${jsonPath}`);

  // Update index
  const indexPath = path.join(deployReportsDir, 'index.json');
  let existingIndex: string[] = [];
  try {
    existingIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8')).runs || [];
  } catch { /* fresh start */ }
  const filename = `language-accuracy-${dateStr}.json`;
  if (!existingIndex.includes(filename)) {
    existingIndex.push(filename);
    existingIndex.sort();
  }
  fs.writeFileSync(indexPath, JSON.stringify({ runs: existingIndex }, null, 2));

  // Step 7: Push to Google Sheets output
  console.log('\n── Pushing results to Google Sheets ──\n');
  await pushToGoogleSheets(results, languageSummaries, dateStr);

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
