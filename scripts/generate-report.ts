import * as fs from 'fs';
import * as path from 'path';
import { SummaryBuilder, JsonReporter, HtmlReporter } from '../src/reporting';

async function main(): Promise<void> {
  const reportsDir = path.resolve(process.cwd(), 'reports');

  // Try to load test results from Playwright JSON output
  let results: any[] = [];
  const resultsPath = path.join(reportsDir, 'test-results.json');

  if (fs.existsSync(resultsPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      results = raw.suites?.flatMap((s: any) => s.specs?.map((sp: any) => ({
        testId: sp.title,
        description: sp.title,
        status: sp.ok ? 'PASS' : 'FAIL',
        latencyMs: 0,
        timestamp: new Date().toISOString(),
      })) || []) || [];
    } catch {
      console.warn('Could not parse test-results.json');
    }
  }

  if (results.length === 0) {
    // Try loading from individual JSON result files
    const resultFiles = fs.readdirSync(reportsDir).filter(f => f.startsWith('asr-results-'));
    if (resultFiles.length > 0) {
      const latest = resultFiles.sort().reverse()[0];
      const summary = JSON.parse(fs.readFileSync(path.join(reportsDir, latest), 'utf-8'));
      results = summary.results || [];
    }
  }

  if (results.length === 0) {
    console.log('No test results found. Run tests first.');
    process.exit(0);
  }

  const builder = new SummaryBuilder();
  const summary = builder.build(results);
  const durationMs = process.uptime() * 1000;
  summary.durationMs = durationMs;

  // Save JSON
  const jsonReporter = new JsonReporter();
  jsonReporter.save(summary);

  // Generate HTML
  const htmlReporter = new HtmlReporter();
  htmlReporter.generate(summary);

  console.log(`\nReport generated: ${summary.totalTests} tests, ${summary.passed} passed, ${summary.failed} failed`);
  console.log(`Pass rate: ${(summary.passRate * 100).toFixed(1)}%`);
}

main().catch(err => {
  console.error('Report generation failed:', err);
  process.exit(1);
});
