import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const DESTINATION_SPREADSHEET_ID = '1hWphhqgyjlgQD39TtnlkpHasDm0Vks1ZmfGYWNicN9c';

function cleanAudioPath(rawPath: string): string {
  if (!rawPath) return '';
  const s = String(rawPath).trim();
  const oldBase = '/Users/unitedwecare/repos/asr-testing/asr-testing/';
  if (s.startsWith(oldBase)) return s.replace(oldBase, '');
  const oldBase2 = '/Users/unitedwecare/repos/asr-testing-v2/';
  if (s.startsWith(oldBase2)) return s.replace(oldBase2, '');
  return s;
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

async function ensureTab(sheets: any, tabName: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: DESTINATION_SPREADSHEET_ID });
  const sheet = (meta.data.sheets || []).find((s: any) => s.properties?.title === tabName);
  if (!sheet) {
    console.log(`Creating tab "${tabName}" in destination spreadsheet...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: DESTINATION_SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  }
}

async function writeTab(sheets: any, tabName: string, headers: string[], rows: (string | number)[][]) {
  await ensureTab(sheets, tabName);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: DESTINATION_SPREADSHEET_ID,
    range: `${tabName}!A1:Z5000`,
  });

  const allValues = [headers, ...rows];
  console.log(`Writing ${allValues.length} rows to "${tabName}"...`);

  const chunkSize = 1000;
  for (let i = 0; i < allValues.length; i += chunkSize) {
    const chunk = allValues.slice(i, i + chunkSize);
    const startRow = i + 1;
    const endRow = i + chunk.length;
    await sheets.spreadsheets.values.update({
      spreadsheetId: DESTINATION_SPREADSHEET_ID,
      range: `${tabName}!A${startRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: chunk },
    });
    console.log(`  Written rows ${startRow} - ${endRow}`);
    await new Promise(r => setTimeout(r, 400));
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId: DESTINATION_SPREADSHEET_ID });
  const sheet = (meta.data.sheets || []).find((s: any) => s.properties?.title === tabName);
  if (sheet?.properties?.sheetId !== undefined) {
    const sid = sheet.properties.sheetId;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: DESTINATION_SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  backgroundColor: { red: 0.15, green: 0.25, blue: 0.45 },
                  horizontalAlignment: 'LEFT',
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)',
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId: sid,
                gridProperties: { frozenRowCount: 1 },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      },
    });
  }

  console.log(`Successfully populated "${tabName}"!`);
}

async function main() {
  console.log('Starting migration of all tabs and columns from external workbook...');
  const sheets = await getSheetsClient();

  const workbook = XLSX.readFile('temp_external.xlsx');
  console.log('Available sheets in source:', workbook.SheetNames);

  for (const tabName of workbook.SheetNames) {
    const sheet = workbook.Sheets[tabName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!data || data.length === 0) continue;

    const rawHeaders: string[] = data[0].map(h => String(h || '').trim());
    const validDataRows = data.slice(1).filter(r => r && r.some(cell => cell !== undefined && String(cell).trim() !== ''));

    if (validDataRows.length === 0) {
      console.log(`Skipping empty tab: "${tabName}"`);
      continue;
    }

    // Clean audio paths in data
    const audioColIdx = rawHeaders.findIndex(h => h.toLowerCase().includes('audio') || h.toLowerCase().includes('file'));

    // Process and clean rows without duplication
    const seenKeys = new Set<string>();
    const rows: (string | number)[][] = [];

    for (const row of validDataRows) {
      // Build a row matching headers length
      const formattedRow: (string | number)[] = rawHeaders.map((_, colIdx) => {
        const val = row[colIdx];
        if (val === undefined || val === null) return '';
        if (colIdx === audioColIdx && typeof val === 'string') {
          return cleanAudioPath(val);
        }
        return val;
      });

      // Deduplication key based on test_case_id + audio path + ground truth
      const key = `${formattedRow[0] || ''}_${formattedRow[audioColIdx] || ''}_${formattedRow[2] || ''}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        rows.push(formattedRow);
      }
    }

    // Target tab naming (standardize tab names if needed)
    let destTabName = tabName;
    if (tabName === 'Feature-Medical-Keyterm-Correct') {
      destTabName = 'Feature-Medical-Keyterms';
    }

    console.log(`\nMigrating "${tabName}" -> Destination: "${destTabName}" (${rows.length} unique test cases, ${rawHeaders.length} columns)`);
    await writeTab(sheets, destTabName, rawHeaders, rows);
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\nAll external tabs, columns, and ground-truth data have been fully migrated without duplicates!');
}

main().catch(err => {
  console.error('Fatal error during sync:', err);
  process.exit(1);
});
