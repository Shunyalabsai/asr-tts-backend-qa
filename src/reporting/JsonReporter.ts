import * as fs from 'fs';
import * as path from 'path';
import type { ExecutionSummary } from '../types';
import { getLocalDateStr } from '../utils/audioHelper';

export class JsonReporter {
  private outputDir: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || path.resolve(process.cwd(), 'reports');
  }

  save(summary: ExecutionSummary): string {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const filePath = path.join(this.outputDir, `asr-results-${getLocalDateStr()}.json`);
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`JSON report saved: ${filePath}`);
    return filePath;
  }
}
