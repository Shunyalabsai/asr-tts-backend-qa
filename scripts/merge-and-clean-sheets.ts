import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell);
      if (currentRow.some(c => c.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some(c => c.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

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

const CANONICAL_TABS = [
  'Core-System-Tests',
  'zero-indic',
  'zero-codeswitch',
  'zero-med',
  'zero-stt',
  'zero-indic-long-audio',
  'zero-indic-concurrent',
  'zero-indic-sequential',
  'Feat-SpeakerDiarization',
  'Feat-Summarization',
  'Feat-IntentDetection',
  'Feat-SentimentAnalysis',
  'Feat-EmotionDiarization',
  'Feat-ProfanityHashing',
  'Feat-CustomKeywordHashing',
  'Feat-KeywordNormalization',
  'Feat-MedicalCorrection',
  'Feat-Translation',
  'Feat-Transliteration',
  'zero-tts-synthesis',
];

const STALE_TABS_TO_DELETE = [
  'Health',
  'Auth',
  'Audio File',
  'Language',
  'Diarization',
  'Word Boosting',
  'Profanity Masking',
  'Response Schema',
  'Speech Intelligence',
  'Combinations',
  'Error Handling',
  'Security',
  'Speaker Mgmt',
  'Streaming',
  'TTS',
];

async function mergeAndCleanSheets(): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error('GOOGLE_SHEET_ID missing');

  const sheets = await getSheetsClient();
  const reportsDir = path.resolve(process.cwd(), 'reports');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Merging 2026-08-25 & 2026-08-24 Runs into Canonical Tabs');
  console.log('═══════════════════════════════════════════════════════════\n');

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const allSheets = meta.data.sheets || [];

  // 1. Process each canonical tab
  for (const tabName of CANONICAL_TABS) {
    const file25 = path.join(reportsDir, `${tabName}-2026-08-25.csv`);
    const file24 = path.join(reportsDir, `${tabName}-2026-08-24.csv`);

    let parsed25: string[][] = [];
    let parsed24: string[][] = [];

    if (fs.existsSync(file25)) {
      parsed25 = parseCSV(fs.readFileSync(file25, 'utf-8'));
    }
    if (fs.existsSync(file24)) {
      parsed24 = parseCSV(fs.readFileSync(file24, 'utf-8'));
    }

    if (parsed25.length === 0 && parsed24.length === 0) {
      console.warn(`  ⚠ No CSV data found for "${tabName}"`);
      continue;
    }

    // Determine standard headers
    const headerRow = (parsed25[0] || parsed24[0] || []).map(h => h.trim());
    const headerCount = headerRow.length;

    // Filter clean data rows for 2026-08-25
    const dataRows25 = parsed25.slice(1).filter(r => {
      const c0 = String(r[0] || '').trim();
      return !c0.startsWith('═══') && !c0.includes('TEST RUN') && !c0.startsWith('───');
    }).map(r => {
      const copy = [...r];
      while (copy.length < headerCount) copy.push('');
      return copy.slice(0, headerCount);
    });

    // Filter clean data rows for 2026-08-24
    const dataRows24 = parsed24.slice(1).filter(r => {
      const c0 = String(r[0] || '').trim();
      return !c0.startsWith('═══') && !c0.includes('TEST RUN') && !c0.startsWith('───');
    }).map(r => {
      const copy = [...r];
      // Ensure date column is explicitly 2026-08-24
      copy[0] = '2026-08-24';
      while (copy.length < headerCount) copy.push('');
      return copy.slice(0, headerCount);
    });

    // Stats for 2026-08-25
    const p25 = dataRows25.filter(r => r.some(c => String(c).toUpperCase().includes('PASS'))).length;
    const f25 = dataRows25.filter(r => r.some(c => String(c).toUpperCase().includes('FAIL'))).length;
    const s25 = dataRows25.filter(r => r.some(c => String(c).toUpperCase().includes('SKIP'))).length;
    const t25 = dataRows25.length;
    const rate25 = t25 > 0 ? ((p25 / t25) * 100).toFixed(1) : '0';

    // Stats for 2026-08-24
    const p24 = dataRows24.filter(r => r.some(c => String(c).toUpperCase().includes('PASS'))).length;
    const f24 = dataRows24.filter(r => r.some(c => String(c).toUpperCase().includes('FAIL'))).length;
    const s24 = dataRows24.filter(r => r.some(c => String(c).toUpperCase().includes('SKIP'))).length;
    const t24 = dataRows24.length;
    const rate24 = t24 > 0 ? ((p24 / t24) * 100).toFixed(1) : '0';

    // 25th Banner Row
    const banner25 = [
      `═══ TEST RUN: 2026-08-25 (LATEST) ═══`,
      `Total: ${t25}`,
      `Passed: ${p25}`,
      `Failed: ${f25}`,
      `Skipped: ${s25}`,
      `Pass Rate: ${rate25}%`,
    ];
    while (banner25.length < headerCount) banner25.push('');

    // 24th Banner Row
    const banner24 = [
      `═══ TEST RUN: 2026-08-24 ═══`,
      `Total: ${t24}`,
      `Passed: ${p24}`,
      `Failed: ${f24}`,
      `Skipped: ${s24}`,
      `Pass Rate: ${rate24}%`,
    ];
    while (banner24.length < headerCount) banner24.push('');

    const sepRow = new Array(headerCount).fill('═══════════════════════════════');

    // Build the combined multi-run matrix (Latest 25th run at top, 24th run below)
    const rowsToWrite: any[][] = [
      headerRow,
      banner25,
      ...dataRows25,
      sepRow,
      banner24,
      ...dataRows24,
      sepRow,
    ];

    // Find or create sheet
    let sheetObj = allSheets.find(s => s.properties?.title === tabName);
    let targetSheetId = sheetObj?.properties?.sheetId || 0;

    if (!sheetObj) {
      const addRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: tabName } } }],
        },
      });
      targetSheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId || 0;
    }

    const currentMaxRows = sheetObj?.properties?.gridProperties?.rowCount || 1000;
    const neededRows = rowsToWrite.length + 50;

    if (neededRows > currentMaxRows) {
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{
              appendDimension: {
                sheetId: targetSheetId,
                dimension: 'ROWS',
                length: Math.max(500, neededRows - currentMaxRows + 100),
              },
            }],
          },
        });
      } catch (err: any) {
        console.warn(`  Could not expand rows: ${err.message}`);
      }
    }

    // 1. Wipe sheet clean
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: `${tabName}!A1:Z50000`,
      });
    } catch {}

    // 2. Write combined matrix
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: rowsToWrite },
    });

    // 3. Formatting
    const formatRequests: any[] = [];
    const banner25RowIndex = 1;
    const sep1RowIndex = 2 + dataRows25.length;
    const banner24RowIndex = sep1RowIndex + 1;
    const sep2RowIndex = banner24RowIndex + 1 + dataRows24.length;

    // Header styling (Row 1)
    formatRequests.push({
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.10, green: 0.20, blue: 0.38 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });

    // Banner 25 styling
    formatRequests.push({
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: banner25RowIndex, endRowIndex: banner25RowIndex + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.20, green: 0.25, blue: 0.33 },
            textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });

    // Separator 1 styling
    formatRequests.push({
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: sep1RowIndex, endRowIndex: sep1RowIndex + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.90, green: 0.90, blue: 0.90 },
            textFormat: { bold: true, foregroundColor: { red: 0.45, green: 0.45, blue: 0.45 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });

    // Banner 24 styling
    formatRequests.push({
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: banner24RowIndex, endRowIndex: banner24RowIndex + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.28, green: 0.32, blue: 0.38 },
            textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });

    // Separator 2 styling
    formatRequests.push({
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: sep2RowIndex, endRowIndex: sep2RowIndex + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.90, green: 0.90, blue: 0.90 },
            textFormat: { bold: true, foregroundColor: { red: 0.45, green: 0.45, blue: 0.45 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });

    // Status Column Styling
    const statusColIndex = headerRow.findIndex(h =>
      ['test_status', 'status', 'status_code', 'state'].includes(h.toLowerCase().trim())
    );

    if (statusColIndex >= 0) {
      for (let r = 0; r < rowsToWrite.length; r++) {
        const rowVal = String(rowsToWrite[r][statusColIndex] || '').toUpperCase();
        if (rowVal.includes('PASS')) {
          formatRequests.push({
            repeatCell: {
              range: {
                sheetId: targetSheetId,
                startRowIndex: r,
                endRowIndex: r + 1,
                startColumnIndex: statusColIndex,
                endColumnIndex: statusColIndex + 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.85, green: 0.93, blue: 0.83 },
                  textFormat: { bold: true, foregroundColor: { red: 0.15, green: 0.45, blue: 0.15 } },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          });
        } else if (rowVal.includes('FAIL')) {
          formatRequests.push({
            repeatCell: {
              range: {
                sheetId: targetSheetId,
                startRowIndex: r,
                endRowIndex: r + 1,
                startColumnIndex: statusColIndex,
                endColumnIndex: statusColIndex + 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.96, green: 0.80, blue: 0.80 },
                  textFormat: { bold: true, foregroundColor: { red: 0.65, green: 0.10, blue: 0.10 } },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          });
        } else if (rowVal.includes('SKIP')) {
          formatRequests.push({
            repeatCell: {
              range: {
                sheetId: targetSheetId,
                startRowIndex: r,
                endRowIndex: r + 1,
                startColumnIndex: statusColIndex,
                endColumnIndex: statusColIndex + 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 1.0, green: 0.95, blue: 0.80 },
                  textFormat: { bold: true, foregroundColor: { red: 0.60, green: 0.40, blue: 0.05 } },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          });
        }
      }
    }

    if (formatRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: formatRequests },
      });
    }

    console.log(`✓ Synced "${tabName}": 2026-08-25 (${t25} cases) on top + 2026-08-24 (${t24} cases) below.`);
  }

  // 2. Delete Stale Legacy Tabs
  console.log('\nCleaning up old duplicate tabs...');
  const deleteRequests: any[] = [];
  for (const staleTab of STALE_TABS_TO_DELETE) {
    const sObj = allSheets.find(s => s.properties?.title === staleTab);
    if (sObj && sObj.properties?.sheetId !== undefined) {
      deleteRequests.push({
        deleteSheet: { sheetId: sObj.properties.sheetId },
      });
      console.log(`  - Queued deletion for legacy tab "${staleTab}"`);
    }
  }

  if (deleteRequests.length > 0) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { requests: deleteRequests },
      });
      console.log(`✓ Deleted ${deleteRequests.length} legacy duplicate tabs.`);
    } catch (err: any) {
      console.warn(`  ⚠ Could not delete some legacy tabs: ${err.message}`);
    }
  }

  console.log('\n✅ Master Synchronization Complete! All 24th and 25th runs are combined in the exact same sheet tabs.');
}

mergeAndCleanSheets().catch(err => {
  console.error('Fatal error during merge:', err);
  process.exit(1);
});
