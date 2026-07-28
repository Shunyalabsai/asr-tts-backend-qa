import * as fs from 'fs';
import * as path from 'path';

export interface LangTestCase {
  testCaseId: string;
  audioUrl: string;         // path from sheet
  resolvedAudioPath: string; // actual local path
  englishPhrase: string;
  englishTransliteration: string;
  groundTruth: string;       // expected transcript
  language: string;
  detectLanguageCode: string;
  expectedLanguageCode: string;
}

export interface LangTestResult {
  testCaseId: string;
  language: string;
  expectedLangCode: string;
  detectedLangCode: string;
  langCodeMatch: 'YES' | 'NO' | 'N/A';
  groundTruth: string;
  predictedText: string;
  wer: number;
  cer: number;
  latencyMs: number;
  testStatus: 'PASS' | 'FAIL' | 'SKIP';
}

/**
 * Reads test case definitions from a Google Sheet CSV export.
 * Maps old project audio paths to the current project structure.
 */
export class GoogleSheetsReader {
  constructor(
    private oldProjectBase: string = '/Users/unitedwecare/repos/asr-testing/asr-testing',
    private newProjectBase: string = process.cwd()
  ) {}

  async fetchFromSheet(sheetId: string, sheetName: string = 'Sheet1'): Promise<LangTestCase[]> {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    console.log(`Fetching: ${url}`);

    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn(`Failed to fetch sheet ${sheetId}: ${resp.status}`);
      return [];
    }

    const csvText = await resp.text();
    return this.parseCSV(csvText);
  }

  private parseCSV(csvText: string): LangTestCase[] {
    const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return [];

    const headers = this.parseLine(lines[0]);
    const cases: LangTestCase[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseLine(lines[i]);
      if (values.length < 5) continue;

      const testCaseId = this.unquote(values[0] || '');
      if (!testCaseId || testCaseId.startsWith('test_case_id')) continue;

      const audioUrl = this.unquote(values[1] || '');
      if (!audioUrl || !audioUrl.includes('/input/')) continue;

      const resolvedAudioPath = this.resolveAudioPath(audioUrl);

      cases.push({
        testCaseId,
        audioUrl,
        resolvedAudioPath,
        englishPhrase: this.unquote(values[2] || ''),
        englishTransliteration: this.unquote(values[3] || ''),
        groundTruth: this.unquote(values[4] || ''),
        language: this.unquote(values[6] || ''),
        detectLanguageCode: this.unquote(values[7] || ''),
        expectedLanguageCode: this.unquote(values[8] || ''),
      });
    }

    return cases;
  }

  private parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  private unquote(s: string): string {
    return s.replace(/^"+|"+$/g, '').trim();
  }

  /**
   * Map old project path (/Users/.../asr-testing/...) to current project path.
   */
  private resolveAudioPath(audioUrl: string): string {
    // Try direct path first
    if (fs.existsSync(audioUrl)) return audioUrl;

    // Replace old base with current project base
    const relative = audioUrl.replace(this.oldProjectBase, '').replace(/^\/+/, '');
    const newPath = path.resolve(this.newProjectBase, relative);
    if (fs.existsSync(newPath)) return newPath;

    // Try under input/ directly
    const inputRelative = relative.replace(/^input\//, '');
    const altPath = path.resolve(this.newProjectBase, 'input', inputRelative);
    if (fs.existsSync(altPath)) return altPath;

    // Return original path (will fail at test time)
    return audioUrl;
  }

  async fetchIndicCases(): Promise<LangTestCase[]> {
    const sheetId = process.env.GOOGLE_SHEET_ID_INDIC_INPUT || '1WHFy727EKWzukegA8JN3flwBi9GMFBRoTBULjNcdilY';
    return this.fetchFromSheet(sheetId);
  }

  async fetchCodeSwitchCases(): Promise<LangTestCase[]> {
    const sheetId = process.env.GOOGLE_SHEET_ID_CODESWITCH_INPUT || '1kFTumbmJKUEoy4gmscqwjiwK3TXNUeqNh49-p9x4NGk';
    return this.fetchFromSheet(sheetId);
  }
}
