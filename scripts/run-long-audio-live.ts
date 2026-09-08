import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as FormData from 'form-data';
import * as dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const ASR_BASE_URL = process.env.ASR_BASE_URL || 'https://asr.shunyalabs.ai/v1';
const API_KEY = process.env.ASR_API_KEY || '';
const INPUT_SPREADSHEET_ID = process.env.INPUT_SPREADSHEET_ID || '1hWphhqgyjlgQD39TtnlkpHasDm0Vks1ZmfGYWNicN9c';

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/speaker\s*\d+\s*:/gi, ' ')
    .replace(/[^\w\sऀ-ॿ઀-૿଀-୿஀-௿ఀ-౿ಀ-೿ഀ-ൿ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateWER(ref: string, hyp: string): number {
  const refWords = normalizeText(ref).split(' ').filter(Boolean);
  const hypWords = normalizeText(hyp).split(' ').filter(Boolean);
  if (refWords.length === 0) return hypWords.length === 0 ? 0 : 1;

  const m = refWords.length;
  const n = hypWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (refWords[i - 1] === hypWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n] / refWords.length;
}

function calculateCER(ref: string, hyp: string): number {
  const refChars = normalizeText(ref).replace(/\s/g, '').split('');
  const hypChars = normalizeText(hyp).replace(/\s/g, '').split('');
  if (refChars.length === 0) return hypChars.length === 0 ? 0 : 1;

  const m = refChars.length;
  const n = hypChars.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (refChars[i - 1] === hypChars[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n] / refChars.length;
}

async function getSheetRows() {
  const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  let credentials: any;
  try {
    const resolvedPath = path.resolve(process.cwd(), credsJson || '');
    if (fs.existsSync(resolvedPath)) {
      credentials = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
    } else {
      credentials = JSON.parse(credsJson || '{}');
    }
  } catch {
    credentials = JSON.parse(credsJson || '{}');
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: INPUT_SPREADSHEET_ID,
    range: 'Long_Audio_Files!A1:Z50',
  });
  return res.data.values || [];
}

async function run() {
  console.log('=== RUNNING LONG AUDIO TEST CASES AGAINST UPDATED SHEET ===\n');
  const rows = await getSheetRows();
  if (rows.length <= 1) {
    console.log('No test cases found in Long_Audio_Files tab.');
    return;
  }

  const results: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const testId = row[0] || `LONG_${String(i).padStart(4, '0')}`;
    const rawAudioPath = row[1] || '';
    const gtText = row[2] || '';

    // Find local audio file
    let audioPath = path.resolve(process.cwd(), rawAudioPath);
    if (!fs.existsSync(audioPath)) {
      const fileName = path.basename(rawAudioPath);
      // Search recursively in input
      const findFile = (dir: string): string | null => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const found = findFile(full);
            if (found) return found;
          } else if (entry.name === fileName) {
            return full;
          }
        }
        return null;
      };
      const found = findFile(path.resolve(process.cwd(), 'input'));
      if (found) audioPath = found;
    }

    if (!fs.existsSync(audioPath)) {
      console.log(`[${i}/${rows.length - 1}] ${testId}: File not found (${rawAudioPath})`);
      results.push({ testId, status: 'SKIPPED', error: 'File not found' });
      continue;
    }

    console.log(`[${i}/${rows.length - 1}] Executing ${testId}: ${path.basename(audioPath)}...`);
    const form = new FormData();
    form.append('file', fs.createReadStream(audioPath));
    form.append('model', 'zero-indic');
    form.append('language_code', 'auto');

    const startTime = Date.now();
    try {
      const res = await axios.post(`${ASR_BASE_URL}/transcribe`, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${API_KEY}`,
        },
        timeout: 300000,
      });

      const latency = (Date.now() - startTime) / 1000;
      const predText = res.data.text || res.data.transcript || '';
      const wer = calculateWER(gtText, predText);
      const cer = calculateCER(gtText, predText);
      const pass = wer <= 0.35 || cer <= 0.35;

      console.log(`  ✓ HTTP ${res.status} | Latency: ${latency.toFixed(1)}s | Transcribed: ${predText.length} chars`);
      console.log(`  WER: ${(wer * 100).toFixed(1)}% | CER: ${(cer * 100).toFixed(1)}% | Status: ${pass ? 'PASS ✅' : 'FAIL ❌'}`);
      console.log(`  GT length: ${gtText.length} | Pred length: ${predText.length}`);
      console.log(`  GT Sample:   ${JSON.stringify(gtText.substring(0, 75))}`);
      console.log(`  Pred Sample: ${JSON.stringify(predText.substring(0, 75))}\n`);

      results.push({
        testId,
        audio: path.basename(audioPath),
        latency,
        wer: (wer * 100).toFixed(1) + '%',
        cer: (cer * 100).toFixed(1) + '%',
        status: pass ? 'PASS' : 'FAIL',
      });
    } catch (err: any) {
      console.error(`  ❌ Error executing ${testId}:`, err.response?.data || err.message);
      results.push({ testId, status: 'ERROR', error: err.message });
    }
  }

  console.log('═════════════════════════════════════════════════════════════');
  console.log('                 FINAL RESULTS SUMMARY                       ');
  console.log('═════════════════════════════════════════════════════════════');
  console.table(results);
}

run().catch(console.error);
