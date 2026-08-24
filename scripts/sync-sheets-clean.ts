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

async function syncAllTabsClean(): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error('GOOGLE_SHEET_ID missing in .env');

  const reportsDir = path.resolve(process.cwd(), 'reports');
  const dateStr = '2026-08-25';
  const csvFiles = fs.readdirSync(reportsDir).filter(f => f.endsWith(`-${dateStr}.csv`));

  console.log(`Found ${csvFiles.length} CSV reports to cleanly sync to Google Sheets (ID: ${sheetId})...\n`);

  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });

  for (const file of csvFiles) {
    const outputTab = file.replace(`-${dateStr}.csv`, '');
    const filePath = path.join(reportsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const allParsed = parseCSV(content);
    if (allParsed.length < 2) continue;

    const headers = allParsed[0].map(h => h.trim());
    const rawDataRows = allParsed.slice(1).filter(r => {
      const firstCell = String(r[0] || '').trim();
      return !firstCell.startsWith('═══') && !firstCell.includes('TEST RUN') && !firstCell.startsWith('───');
    });

    const passed = rawDataRows.filter(r => r.some(c => String(c).toUpperCase().includes('PASS'))).length;
    const failed = rawDataRows.filter(r => r.some(c => String(c).toUpperCase().includes('FAIL'))).length;
    const skipped = rawDataRows.filter(r => r.some(c => String(c).toUpperCase().includes('SKIP'))).length;
    const total = rawDataRows.length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0';

    // Summary banner padded strictly to headers.length
    const bannerRow = [
      `═══ TEST RUN: ${dateStr} (LATEST) ═══`,
      `Total: ${total}`,
      `Passed: ${passed}`,
      `Failed: ${failed}`,
      `Skipped: ${skipped}`,
      `Pass Rate: ${passRate}%`,
    ];
    while (bannerRow.length < headers.length) bannerRow.push('');

    // Separator padded strictly to headers.length
    const sepRow = new Array(headers.length).fill('═══════════════════════════════');

    // Current rows padded strictly to headers.length
    const paddedRows = rawDataRows.map(r => {
      const copy = [...r];
      while (copy.length < headers.length) copy.push('');
      return copy.slice(0, headers.length);
    });

    const rowsToWrite = [
      headers,
      bannerRow,
      ...paddedRows,
      sepRow,
    ];

    let sheetObj = (meta.data.sheets || []).find(s => s.properties?.title === outputTab);
    let targetSheetId = sheetObj?.properties?.sheetId || 0;

    if (!sheetObj) {
      const addRes = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: outputTab } } }],
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

    // 1. Wipe the sheet clean
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: sheetId,
        range: `${outputTab}!A1:Z50000`,
      });
    } catch {}

    // 2. Write the clean matrix
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${outputTab}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: rowsToWrite },
    });

    // 3. Format styling
    const formatRequests: any[] = [];
    const bannerRowIndex = 1;
    const dataStartRowIndex = 2;
    const sepRowIndex = dataStartRowIndex + paddedRows.length;

    // Header styling
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

    // Banner styling
    formatRequests.push({
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: bannerRowIndex, endRowIndex: bannerRowIndex + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.20, green: 0.25, blue: 0.33 },
            textFormat: { bold: true, fontSize: 10, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });

    // Separator styling
    formatRequests.push({
      repeatCell: {
        range: { sheetId: targetSheetId, startRowIndex: sepRowIndex, endRowIndex: sepRowIndex + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.90, green: 0.90, blue: 0.90 },
            textFormat: { bold: true, foregroundColor: { red: 0.45, green: 0.45, blue: 0.45 } },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });

    // Status column styling
    const statusColIndex = headers.findIndex(h =>
      ['test_status', 'status', 'status_code', 'state'].includes(h.toLowerCase().trim())
    );

    if (statusColIndex >= 0) {
      for (let r = 0; r < paddedRows.length; r++) {
        const rowVal = String(paddedRows[r][statusColIndex] || '').toUpperCase();
        const curRowIndex = dataStartRowIndex + r;
        if (rowVal.includes('PASS')) {
          formatRequests.push({
            repeatCell: {
              range: {
                sheetId: targetSheetId,
                startRowIndex: curRowIndex,
                endRowIndex: curRowIndex + 1,
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
                startRowIndex: curRowIndex,
                endRowIndex: curRowIndex + 1,
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
                startRowIndex: curRowIndex,
                endRowIndex: curRowIndex + 1,
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

    console.log(`✓ Cleaned and formatted "${outputTab}" (${paddedRows.length} rows)`);
  }

  console.log('\n✅ All Google Sheet tabs completely cleaned and formatted with zero bleed-through!');
}

syncAllTabsClean().catch(err => {
  console.error('Error syncing:', err);
  process.exit(1);
});
