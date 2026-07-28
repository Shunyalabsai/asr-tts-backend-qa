import * as fs from 'fs';
import * as path from 'path';

/**
 * Prepares deploy/ directory for GitHub Pages.
 * - Keeps index.html as the landing page (NOT overwritten by report)
 * - Copies latest HTML report as report-YYYY-MM-DD.html
 * - Ensures runs/ directory with index.json is present
 */
function main(): void {
  const deployDir = path.resolve(process.cwd(), 'deploy');
  const reportsDir = path.resolve(process.cwd(), 'reports');

  // Ensure deploy dir exists
  if (!fs.existsSync(deployDir)) {
    fs.mkdirSync(deployDir, { recursive: true });
  }

  // Copy latest HTML report (don't overwrite index.html — it's the landing page)
  const htmlReports = fs.readdirSync(reportsDir)
    .filter((f: string) => f.startsWith('ASR-Test-Report-') && f.endsWith('.html'))
    .sort()
    .reverse();

  if (htmlReports.length > 0) {
    const latest = htmlReports[0];
    // Copy as a dated report file
    fs.copyFileSync(path.join(reportsDir, latest), path.join(deployDir, latest));
    console.log(`Copied ${latest} → deploy/`);

    // Also copy as latest-report.html for direct linking
    fs.copyFileSync(
      path.join(reportsDir, latest),
      path.join(deployDir, 'latest-report.html')
    );
    console.log(`Copied → deploy/latest-report.html`);
  }

  // Ensure runs/ directory exists
  const runsDir = path.join(deployDir, 'runs');
  if (!fs.existsSync(runsDir)) {
    fs.mkdirSync(runsDir, { recursive: true });
  }
  if (!fs.existsSync(path.join(runsDir, 'index.json'))) {
    fs.writeFileSync(path.join(runsDir, 'index.json'), JSON.stringify({ runs: [] }, null, 2));
  }

  // Ensure index.html is the landing page (not overwritten)
  if (!fs.existsSync(path.join(deployDir, 'index.html'))) {
    // If no index.html exists, copy landing.html as fallback
    if (fs.existsSync(path.join(deployDir, 'landing.html'))) {
      fs.copyFileSync(path.join(deployDir, 'landing.html'), path.join(deployDir, 'index.html'));
      console.log('landing.html → index.html (fallback)');
    }
  } else {
    // index.html exists — don't overwrite it
    console.log('index.html preserved (landing page)');
  }

  // Deploy directory summary
  console.log(`\nDeploy directory ready: ${deployDir}/`);
  const entries = fs.readdirSync(deployDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      try {
        const files = fs.readdirSync(path.join(deployDir, entry.name));
        console.log(`  📁 ${entry.name}/ (${files.length} files)`);
      } catch { console.log(`  📁 ${entry.name}/`); }
    } else {
      const stat = fs.statSync(path.join(deployDir, entry.name));
      console.log(`  📄 ${entry.name} (${(stat.size / 1024).toFixed(1)} KB)`);
    }
  }
}

main();
