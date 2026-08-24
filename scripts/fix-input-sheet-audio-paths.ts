import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const INPUT_SPREADSHEET_ID = '1hWphhqgyjlgQD39TtnlkpHasDm0Vks1ZmfGYWNicN9c';

// Build an index of all audio files in the repo for instant lookup
function buildLocalAudioIndex(): Map<string, string> {
  const index = new Map<string, string>(); // basename -> relative path

  function scanDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.wav', '.mp3', '.ogg', '.flac', '.mp4', '.mpeg', '.m4a'].includes(ext)) {
          const relativePath = path.relative(process.cwd(), fullPath);
          index.set(entry.name.toLowerCase(), relativePath);
        }
      }
    }
  }

  scanDir(path.resolve(process.cwd(), 'input'));
  return index;
}

async function getSheetsClient() {
  const credsJson = fs.readFileSync(path.resolve(__dirname, '../Google_service_account.json'), 'utf-8');
  const credentials = JSON.parse(credsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function main() {
  console.log(`Connecting to Google Input Sheet: ${INPUT_SPREADSHEET_ID}`);
  const sheets = await getSheetsClient();
  const audioIndex = buildLocalAudioIndex();
  console.log(`Indexed ${audioIndex.size} local audio files in input/ directory.\n`);

  const meta = await sheets.spreadsheets.get({ spreadsheetId: INPUT_SPREADSHEET_ID });
  const tabs = meta.data.sheets || [];

  let totalUpdatedAcrossAllTabs = 0;

  for (const tab of tabs) {
    const tabName = tab.properties?.title;
    if (!tabName) continue;

    const data = await sheets.spreadsheets.values.get({
      spreadsheetId: INPUT_SPREADSHEET_ID,
      range: `${tabName}!A1:Z5000`,
    });

    const rows = data.data.values || [];
    if (rows.length < 2) continue;

    const headers = rows[0].map(h => String(h).trim().toLowerCase());
    const audioColIdx = headers.findIndex(h =>
      h.includes('audio') || h.includes('file') || h.includes('url')
    );

    if (audioColIdx < 0) continue;

    console.log(`Checking Tab "${tabName}" (Audio column: "${rows[0][audioColIdx]}" at col ${audioColIdx + 1})...`);
    let tabUpdates = 0;

    for (let r = 1; r < rows.length; r++) {
      const originalVal = String(rows[r][audioColIdx] || '').trim();
      if (!originalVal) continue;

      // Clean old absolute prefixes
      let cleanVal = originalVal
        .replace('/Users/unitedwecare/repos/asr-testing/asr-testing/', '')
        .replace('/Users/unitedwecare/repos/asr-testing-v2/', '');

      // Check if file exists as-is
      if (!fs.existsSync(cleanVal)) {
        const base = path.basename(cleanVal).toLowerCase();
        if (audioIndex.has(base)) {
          const newRelativePath = audioIndex.get(base)!;
          if (newRelativePath !== originalVal) {
            rows[r][audioColIdx] = newRelativePath;
            tabUpdates++;
          }
        }
      } else if (cleanVal !== originalVal) {
        rows[r][audioColIdx] = cleanVal;
        tabUpdates++;
      }
    }

    if (tabUpdates > 0) {
      console.log(`  Updating ${tabUpdates} audio path(s) in "${tabName}"...`);
      await sheets.spreadsheets.values.update({
        spreadsheetId: INPUT_SPREADSHEET_ID,
        range: `${tabName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: rows },
      });
      totalUpdatedAcrossAllTabs += tabUpdates;
      await new Promise(res => setTimeout(res, 500));
    } else {
      console.log(`  All audio paths in "${tabName}" are valid.`);
    }
  }

  console.log(`\nDone! Successfully updated ${totalUpdatedAcrossAllTabs} audio URLs in the Google Input Sheet.`);
}

main().catch(err => {
  console.error('Error fixing input sheet audio paths:', err);
  process.exit(1);
});
