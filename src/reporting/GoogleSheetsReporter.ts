import type { TestResult } from '../types';
import { getLocalDateStr } from '../utils/audioHelper';

const MODULES = [
  'Authentication', 'AudioInput-File', 'AudioInput-Base64', 'LanguageCode',
  'ResponseFormat', 'SpeakerDiarization', 'WordBoosting', 'TranscriptAnalysis',
  'ProfanityMasking', 'ResponseSchema', 'ErrorHandling', 'Limits-Performance',
  'Health', 'CombinationScenarios', 'Security-Misc', 'Streaming',
  'SpeechIntelligence', 'SpeakerManagement',
];

export class GoogleSheetsReporter {
  private spreadsheetId: string;

  constructor(spreadsheetId?: string) {
    this.spreadsheetId = spreadsheetId || process.env.GOOGLE_SHEET_ID || '';
  }

  async initialize(): Promise<void> {
    if (!this.spreadsheetId) {
      console.warn('GoogleSheetsReporter: No spreadsheet ID configured. Skipping initialization.');
      return;
    }
    // Sheets initialization can be done via sheets API
    console.log(`GoogleSheetsReporter initialized for sheet: ${this.spreadsheetId}`);
  }

  async writeResults(category: string, results: TestResult[]): Promise<void> {
    if (!this.spreadsheetId) {
      console.warn(`GoogleSheetsReporter: Skipping sheet write for ${category} (no sheet ID)`);
      return;
    }

    try {
      const { google } = await import('googleapis');
      const auth = await this.getAuth();

      const sheets = google.sheets({ version: 'v4', auth });

      // Ensure the sheet tab exists
      await this.createSheetIfNotExists(sheets, category);

      // Headers
      const headers = ['date', 'test_id', 'description', 'status', 'latency_ms', 'wer', 'cer', 'failure_reason', 'timestamp'];

      // Build rows
      const rows = results.map(r => [
        getLocalDateStr(),
        r.testId,
        r.description,
        r.status,
        r.latencyMs,
        r.wer ?? '',
        r.cer ?? '',
        r.failureReason || '',
        r.timestamp,
      ]);

      // Write to sheet
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${category}!A1:I${rows.length + 1}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers, ...rows],
        },
      });

      // Apply formatting
      try {
        await this.applySheetFormatting(sheets, category, rows.length + 1);
      } catch {
        // Formatting is optional
      }

      console.log(`GoogleSheets: Wrote ${results.length} results to "${category}" tab`);
    } catch (err: any) {
      console.error(`GoogleSheetsReporter: Failed to write "${category}": ${err.message}`);
    }
  }

  private async getAuth() {
    const { google } = await import('googleapis');

    const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credsJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
    }

    let credentials: any;
    try {
      // Check if it's a file path
      const fs = await import('fs');
      const path = await import('path');
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

    return auth;
  }

  private async createSheetIfNotExists(sheets: any, sheetName: string): Promise<void> {
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const existingSheet = spreadsheet.data.sheets.find(
        (s: any) => s.properties.title === sheetName
      );

      if (!existingSheet) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title: sheetName },
                },
              },
            ],
          },
        });
        console.log(`GoogleSheets: Created new tab "${sheetName}"`);
      }
    } catch {
      console.warn(`GoogleSheets: Could not check/create tab "${sheetName}"`);
    }
  }

  private async applySheetFormatting(sheets: any, sheetName: string, rowCount: number): Promise<void> {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    const sheet = spreadsheet.data.sheets.find(
      (s: any) => s.properties.title === sheetName
    );
    if (!sheet) return;

    const sheetId = sheet.properties.sheetId;

    // Bold headers
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor)',
            },
          },
        ],
      },
    });
  }
}
