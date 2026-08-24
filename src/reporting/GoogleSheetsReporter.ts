import type { TestResult, ExecutionSummary, CategorySummary } from '../types';
import { getLocalDateStr } from '../utils/audioHelper';

const MODULE_NAMES: Record<string, string> = {
  Authentication: 'Auth',
  'AudioInput-File': 'Audio File',
  'AudioInput-Base64': 'Audio Base64',
  LanguageCode: 'Language',
  ResponseFormat: 'Response Format',
  SpeakerDiarization: 'Diarization',
  WordBoosting: 'Word Boosting',
  TranscriptAnalysis: 'Transcript Analysis',
  ProfanityMasking: 'Profanity Masking',
  ResponseSchema: 'Response Schema',
  ErrorHandling: 'Error Handling',
  'Limits-Performance': 'Performance',
  Health: 'Health',
  CombinationScenarios: 'Combinations',
  'Security-Misc': 'Security',
  Streaming: 'Streaming',
  SpeechIntelligence: 'Speech Intelligence',
  SpeakerManagement: 'Speaker Mgmt',
};

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
    console.log(`GoogleSheetsReporter initialized for sheet: ${this.spreadsheetId}`);
  }

  async writeSummary(summary: ExecutionSummary): Promise<void> {
    if (!this.spreadsheetId) {
      console.warn('GoogleSheetsReporter: Skipping summary write (no sheet ID)');
      return;
    }
    try {
      const { google } = await import('googleapis');
      const auth = await this.getAuth();
      const sheets = google.sheets({ version: 'v4', auth });

      // Create/replace Dashboard tab
      await this.ensureSheetNamed(sheets, 'Dashboard');
      await this.clearSheet(sheets, 'Dashboard');

      // ─── SECTION 1: KPI Summary ──────────────────────────────────
      const passRate = summary.totalTests > 0
        ? ((summary.passed / summary.totalTests) * 100).toFixed(1)
        : '0.0';

      const kpiRows = [
        ['ASR Test Framework v2 — Test Report', '', '', '', ''],
        [`Date: ${summary.date}`, '', '', '', ''],
        ['Duration: ' + Math.round(summary.durationMs / 1000) + 's', '', '', '', ''],
        [],
        ['TOTAL TESTS', 'PASSED', 'FAILED', 'SKIPPED', 'PASS RATE'],
        [
          String(summary.totalTests),
          String(summary.passed),
          String(summary.failed),
          String(summary.skipped),
          `${passRate}%`,
        ],
        [],
      ];

      // ─── SECTION 2: Per-Module Breakdown ─────────────────────────
      const headerRow = ['Module', 'Total', 'Passed', 'Failed', 'Skipped', 'Pass Rate', 'Avg Latency', 'P50', 'P95'];
      const moduleRows = summary.categories.map((c: CategorySummary) => {
        const modPassRate = c.total > 0 ? ((c.passed / c.total) * 100).toFixed(1) + '%' : 'N/A';
        return [
          MODULE_NAMES[c.module] || c.module,
          String(c.total),
          String(c.passed),
          String(c.failed),
          String(c.skipped),
          modPassRate,
          c.avgLatencyMs ? `${Math.round(c.avgLatencyMs)}ms` : '-',
          c.p50LatencyMs ? `${Math.round(c.p50LatencyMs)}ms` : '-',
          c.p95LatencyMs ? `${Math.round(c.p95LatencyMs)}ms` : '-',
        ];
      });

      const totalRow = [
        'TOTAL',
        String(summary.totalTests),
        String(summary.passed),
        String(summary.failed),
        String(summary.skipped),
        `${passRate}%`,
        '',
        '',
        '',
      ];

      const allRows = [
        ...kpiRows,
        ['', '', '', '', '', '', '', '', ''],
        ['PER-MODULE BREAKDOWN', '', '', '', '', '', '', '', ''],
        headerRow,
        ...moduleRows,
        totalRow,
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'Dashboard!A1',
        valueInputOption: 'RAW',
        requestBody: { values: allRows },
      });

      // ─── SECTION 3: Failed Tests List ────────────────────────────
      const failedTests = summary.results.filter(r => r.status === 'FAIL');
      if (failedTests.length > 0) {
        const failHeader = ['', '', '', '', '', '', '', '', ''];
        const failTitle = [`ALL FAILURES (${failedTests.length})`, '', '', '', '', '', '', '', ''];
        const failCols = ['Test ID', 'Module', 'Description', 'Status', 'Latency (ms)', 'Failure Reason'];
        const failRows = failedTests.map(r => [
          r.testId,
          MODULE_NAMES[r.module] || r.module,
          r.description,
          r.status,
          String(r.latencyMs),
          r.failureReason || '',
        ]);

        await sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `Dashboard!A${allRows.length + 4}`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [failTitle, failHeader, failCols, ...failRows],
          },
        });
      }

      // ─── FORMATTING ──────────────────────────────────────────────
      await this.applyDashboardFormatting(sheets, allRows.length, summary);
      console.log(`GoogleSheets: Dashboard written (${summary.totalTests} tests, ${summary.failed} failures)`);
    } catch (err: any) {
      console.error(`GoogleSheetsReporter: Failed to write summary: ${err.message}`);
    }
  }

  async writeModuleSheet(sheetName: string, results: TestResult[]): Promise<void> {
    if (!this.spreadsheetId) {
      console.warn(`GoogleSheetsReporter: Skipping sheet "${sheetName}" (no sheet ID)`);
      return;
    }
    if (results.length === 0) {
      console.log(`GoogleSheetsReporter: No results for "${sheetName}", skipping tab`);
      return;
    }

    try {
      const { google } = await import('googleapis');
      const auth = await this.getAuth();
      const sheets = google.sheets({ version: 'v4', auth });

      // Create sheet tab
      await this.ensureSheetNamed(sheets, sheetName);
      await this.clearSheet(sheets, sheetName);

      // Build rows — FAIL rows are doubled: main row + detail row for expand
      const headers = ['Test ID', 'Description', 'Status', 'Latency (ms)', 'Failure Reason', 'WER', 'CER', 'Timestamp'];
      const rows: string[][] = [];
      const failRowIndexes: number[] = []; // track where failures are for grouping

      results.forEach((r, i) => {
        const isFail = r.status === 'FAIL';
        rows.push([
          r.testId,
          r.description,
          r.status,
          String(r.latencyMs),
          isFail ? (r.failureReason || 'Unknown error') : '',
          r.wer != null ? String(r.wer) : '',
          r.cer != null ? String(r.cer) : '',
          r.timestamp || '',
        ]);
        if (isFail) {
          failRowIndexes.push(i + 2); // +2 for header + 0-index → 1-indexed
          // Detail row — shows request/response summary if available
          const detailText = r.requestSummary
            ? `Request: ${r.requestSummary} | Response: ${r.responseSummary || ''}`
            : (r.failureReason || '');
          rows.push([`  └ Error Detail:`, detailText, '', '', '', '', '', '']);
        }
      });

      // Write headers + data
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers, ...rows],
        },
      });

      // Apply formatting (colors, groups)
      await this.applyModuleFormatting(sheets, sheetName, rows.length + 1, failRowIndexes);
      console.log(`GoogleSheets: "${sheetName}" tab: ${results.length} results, ${failRowIndexes.length} failures`);
    } catch (err: any) {
      console.error(`GoogleSheetsReporter: Failed to write module sheet "${sheetName}": ${err.message}`);
    }
  }

  async writeAllFailuresSheet(allResults: TestResult[]): Promise<void> {
    const failedTests = allResults.filter(r => r.status === 'FAIL');
    if (failedTests.length === 0) return;

    try {
      const { google } = await import('googleapis');
      const auth = await this.getAuth();
      const sheets = google.sheets({ version: 'v4', auth });

      await this.ensureSheetNamed(sheets, '⚠ Failures');
      await this.clearSheet(sheets, '⚠ Failures');

      const headers = ['Test ID', 'Module', 'Description', 'Status', 'Latency (ms)', 'Failure Reason'];
      const rows: string[][] = [];

      failedTests.forEach(r => {
        rows.push([
          r.testId,
          MODULE_NAMES[r.module] || r.module,
          r.description,
          r.status,
          String(r.latencyMs),
          r.failureReason || '',
        ]);
        // Expandable detail row
        const detail = r.requestSummary
          ? `Request: ${r.requestSummary} | Response: ${r.responseSummary || ''}`
          : (r.failureReason || '');
        rows.push([`  └ Detail:`, detail, '', '', '', '']);
      });

      // Write
      const sheetTitle = `⚠ Failures`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetTitle}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers, ...rows] },
      });

      // Group failure rows for expand/collapse
      const sheetInfo = await sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const sheet = (sheetInfo.data.sheets || []).find(
        (s: any) => s.properties?.title === sheetTitle
      );
      if (sheet?.properties) {
        const sheetId = sheet.properties.sheetId;
        const groups: any[] = [];
        let rowIdx = 2; // after header
        for (const r of failedTests) {
          groups.push({
            addDimensionGroup: {
              range: {
                sheetId,
                startIndex: rowIdx,
                endIndex: rowIdx + 2,
                dimension: 'ROWS',
              },
            },
          });
          rowIdx += 2;
        }
        if (groups.length > 0) {
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: { requests: groups },
          });
        }
      }

      console.log(`GoogleSheets: "⚠ Failures" tab: ${failedTests.length} failures with expandable details`);
    } catch (err: any) {
      console.error(`GoogleSheetsReporter: Failed to write failures sheet: ${err.message}`);
    }
  }

  async writeEverything(summary: ExecutionSummary): Promise<void> {
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    await this.writeSummary(summary);
    await sleep(350);

    // Write each module's sheet
    const byModule = new Map<string, TestResult[]>();
    for (const r of summary.results) {
      const list = byModule.get(r.module) || [];
      list.push(r);
      byModule.set(r.module, list);
    }
    for (const [module, results] of byModule) {
      const sheetName = MODULE_NAMES[module] || module.replace(/[\/\\*\[\]:?]/g, '_');
      await this.writeModuleSheet(sheetName, results);
      await sleep(350);
    }

    // Write all-failures sheet
    await this.writeAllFailuresSheet(summary.results);
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  private async getAuth() {
    const { google } = await import('googleapis');
    const credsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || 'Google_service_account.json';
    if (!credsJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');

    let credentials: any;
    const fs = await import('fs');
    const path = await import('path');

    // Check multiple potential path locations
    const candidatePaths = [
      path.resolve(process.cwd(), credsJson),
      path.resolve(__dirname, '../../', credsJson),
      path.resolve(__dirname, '../', credsJson),
      path.resolve('/Users/unitedwecare/repos/asr-testing-v2', credsJson),
    ];

    let foundPath: string | null = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    }

    if (foundPath) {
      credentials = JSON.parse(fs.readFileSync(foundPath, 'utf-8'));
    } else if (credsJson.trim().startsWith('{')) {
      credentials = JSON.parse(credsJson);
    } else {
      // Try base64 decoding
      try {
        const decoded = Buffer.from(credsJson, 'base64').toString('utf-8');
        credentials = JSON.parse(decoded);
      } catch {
        throw new Error(`Could not load Google Service Account from file or JSON: ${credsJson}`);
      }
    }

    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  private async ensureSheetNamed(sheets: any, sheetName: string): Promise<void> {
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const existing = spreadsheet.data.sheets.find(
        (s: any) => s.properties.title === sheetName
      );
      if (!existing) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: sheetName } } }],
          },
        });
      }
    } catch {
      console.warn(`GoogleSheets: Could not ensure tab "${sheetName}"`);
    }
  }

  private async clearSheet(sheets: any, sheetName: string): Promise<void> {
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!A1:Z1000`,
      });
    } catch {
      // ignore
    }
  }

  private async applyDashboardFormatting(
    sheets: any,
    rowCount: number,
    summary: ExecutionSummary
  ): Promise<void> {
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const sheet = spreadsheet.data.sheets.find(
        (s: any) => s.properties.title === 'Dashboard'
      );
      if (!sheet) return;
      const sid = sheet.properties.sheetId;

      const requests: any[] = [];

      // Bold header row (row 5: KPI headers)
      requests.push({
        repeatCell: {
          range: { sheetId: sid, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 5 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 11 },
              backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      });

      // KPI value row — green background
      requests.push({
        repeatCell: {
          range: { sheetId: sid, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 0, endColumnIndex: 5 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 14 },
            },
          },
          fields: 'userEnteredFormat(textFormat)',
        },
      });

      // Pass rate cell — green if > 80%, else red
      const passRate = summary.totalTests > 0 ? summary.passed / summary.totalTests : 0;
      const rateColor = passRate >= 0.8
        ? { red: 0.8, green: 0.95, blue: 0.8 }
        : { red: 0.95, green: 0.8, blue: 0.8 };
      requests.push({
        repeatCell: {
          range: { sheetId: sid, startRowIndex: 5, endRowIndex: 6, startColumnIndex: 4, endColumnIndex: 5 },
          cell: {
            userEnteredFormat: {
              backgroundColor: rateColor,
              textFormat: { bold: true, fontSize: 14 },
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      });

      // Failure rows in fail list (row >= ~rowCount + 6)
      const failStart = rowCount + 4; // approximate
      if (summary.failed > 0) {
        requests.push({
          repeatCell: {
            range: { sheetId: sid, startRowIndex: failStart, endRowIndex: failStart + summary.failed + 3 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0.92, blue: 0.92 },
              },
            },
            fields: 'userEnteredFormat.backgroundColor',
          },
        });
      }

      // Module breakdown header
      const modHeaderRow = rowCount > 0 ? rowCount + 2 : 8;
      requests.push({
        repeatCell: {
          range: { sheetId: sid, startRowIndex: modHeaderRow, endRowIndex: modHeaderRow + 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 12 },
              backgroundColor: { red: 0.85, green: 0.85, blue: 0.95 },
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      });

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests },
      });
    } catch (err: any) {
      console.warn(`GoogleSheets: Dashboard formatting skipped: ${err.message}`);
    }
  }

  private async applyModuleFormatting(
    sheets: any,
    sheetName: string,
    rowCount: number,
    failRowIndexes: number[]
  ): Promise<void> {
    try {
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: this.spreadsheetId });
      const sheet = spreadsheet.data.sheets.find(
        (s: any) => s.properties.title === sheetName
      );
      if (!sheet) return;
      const sid = sheet.properties.sheetId;

      const requests: any[] = [];

      // Bold header row
      requests.push({
        repeatCell: {
          range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.2, green: 0.2, blue: 0.2, alpha: 1 },
            },
          },
          fields: 'userEnteredFormat(textFormat,backgroundColor)',
        },
      });

      // Red background for failure rows
      for (const failIdx of failRowIndexes) {
        requests.push({
          repeatCell: {
            range: { sheetId: sid, startRowIndex: failIdx - 1, endRowIndex: failIdx },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0.85, blue: 0.85 },
              },
            },
            fields: 'userEnteredFormat.backgroundColor',
          },
        });
      }

      // Create collapsible row groups for each failure + its detail row
      // This creates the +/- toggle in the sheet row numbers
      for (const failIdx of failRowIndexes) {
        requests.push({
          addDimensionGroup: {
            range: {
              sheetId: sid,
              startIndex: failIdx,  // detail row
              endIndex: failIdx + 1, // just the detail row
              dimension: 'ROWS',
            },
          },
        });
      }

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests },
      });
    } catch (err: any) {
      console.warn(`GoogleSheets: Module formatting skipped for "${sheetName}": ${err.message}`);
    }
  }
}
