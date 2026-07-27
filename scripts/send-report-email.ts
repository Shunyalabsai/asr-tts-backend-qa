import * as fs from 'fs';
import * as path from 'path';
import { SummaryBuilder, HtmlReporter, EmailReporter } from '../src/reporting';

async function main(): Promise<void> {
  const reportsDir = path.resolve(process.cwd(), 'reports');

  // Find latest JSON results
  const resultFiles = fs.readdirSync(reportsDir).filter(f => f.startsWith('asr-results-'));

  if (resultFiles.length === 0) {
    console.log('No results found. Run generate-report first.');
    process.exit(0);
  }

  const latest = resultFiles.sort().reverse()[0];
  const summaryData = JSON.parse(fs.readFileSync(path.join(reportsDir, latest), 'utf-8'));
  const builder = new SummaryBuilder();
  const summary = builder.build(summaryData.results || []);
  summary.durationMs = summaryData.durationMs || 0;

  // Generate HTML report
  const htmlReporter = new HtmlReporter();
  const htmlPath = htmlReporter.generate(summary);

  // Send email
  const emailReporter = new EmailReporter();
  await emailReporter.sendDailyReport(summary, htmlPath);

  console.log('Email report sent successfully.');
}

main().catch(err => {
  console.error('Failed to send email report:', err);
  process.exit(1);
});
