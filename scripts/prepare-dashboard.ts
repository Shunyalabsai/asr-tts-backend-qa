import * as fs from 'fs';
import * as path from 'path';
import { SummaryBuilder, JsonReporter, HtmlReporter } from '../src/reporting';

/**
 * Prepares the deploy directory for GitHub Pages.
 * Copies the latest HTML report as index.html and creates a landing page.
 */
async function main(): Promise<void> {
  const reportsDir = path.resolve(process.cwd(), 'reports');
  const deployDir = path.resolve(process.cwd(), 'deploy');

  // Ensure deploy directory exists
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }

  // Check if we have raw test results to build a fresh report
  const resultsPath = path.join(reportsDir, 'test-results.json');
  let reportGenerated = false;

  if (fs.existsSync(resultsPath)) {
    // Generate fresh report from Playwright output
    const { execSync } = require('child_process');
    try {
      execSync('npx ts-node scripts/generate-report.ts', { cwd: process.cwd(), stdio: 'inherit' });
      reportGenerated = true;
    } catch {
      console.warn('Report generation had errors, trying fallback...');
    }
  }

  // Find the latest HTML report
  const htmlReports = fs.readdirSync(reportsDir)
    .filter(f => f.startsWith('ASR-Test-Report-') && f.endsWith('.html'))
    .sort()
    .reverse();

  if (htmlReports.length > 0) {
    const latest = htmlReports[0];
    fs.copyFileSync(
      path.join(reportsDir, latest),
      path.join(deployDir, 'index.html')
    );
    console.log(`Copied ${latest} → deploy/index.html`);

    // Also copy the dated version for history
    fs.copyFileSync(
      path.join(reportsDir, latest),
      path.join(deployDir, latest)
    );
    console.log(`Copied ${latest} → deploy/${latest}`);

    reportGenerated = true;
  }

  // Create or update landing page
  const landingHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ASR Test Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .card {
      background: #1e293b;
      border-radius: 1rem;
      padding: 3rem;
      border: 1px solid #334155;
      max-width: 600px;
      width: 100%;
      text-align: center;
    }
    h1 {
      font-size: 1.8rem;
      margin-bottom: 0.5rem;
      color: #f8fafc;
    }
    p {
      color: #94a3b8;
      margin-bottom: 2rem;
      line-height: 1.6;
    }
    .btn {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      border-radius: 0.5rem;
      font-weight: 600;
      font-size: 1rem;
      transition: background 0.2s;
    }
    .btn:hover { background: #2563eb; }
    .reports {
      margin-top: 2rem;
      text-align: left;
    }
    .reports h3 {
      color: #64748b;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }
    .reports a {
      display: block;
      color: #60a5fa;
      text-decoration: none;
      padding: 0.4rem 0;
      font-size: 0.9rem;
      border-bottom: 1px solid #1e293b;
    }
    .reports a:hover { color: #93c5fd; }
    .status {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
    }
    .status.active { background: #065f46; color: #22c55e; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status active">● LIVE</div>
    <h1>ASR Test Dashboard</h1>
    <p>Automated test results for the Shunyalabs Speech-to-Text API v2.<br>
    Reports are generated after each test run.</p>
    <a href="./index.html" class="btn">View Latest Report</a>
    <div class="reports">
      <h3>Recent Reports</h3>
      ${htmlReports.slice(0, 10).map(f =>
        `<a href="./${f}">${f.replace('ASR-Test-Report-', '').replace('.html', '')}</a>`
      ).join('\n      ')}
      ${htmlReports.length === 0 ? '<p style="color:#64748b;font-size:0.85rem;">No reports generated yet. Run the test suite first.</p>' : ''}
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(deployDir, 'landing.html'), landingHtml, 'utf-8');

  // If no index.html yet, use the landing page
  if (!fs.existsSync(path.join(deployDir, 'index.html'))) {
    fs.writeFileSync(path.join(deployDir, 'index.html'), landingHtml, 'utf-8');
    console.log('Created landing page as index.html');
  }

  if (!reportGenerated) {
    console.log('\n⚠ No test results found. Run tests first with: npm run test:all');
    console.log('  The dashboard landing page has been created anyway.\n');
  }

  console.log(`\nDeploy directory ready: ${deployDir}/`);
  console.log('  Contents:');
  fs.readdirSync(deployDir).forEach(f => {
    const size = fs.statSync(path.join(deployDir, f)).size;
    console.log(`    ${f} (${(size / 1024).toFixed(1)} KB)`);
  });
}

main().catch(err => {
  console.error('Failed to prepare dashboard:', err);
  process.exit(1);
});
