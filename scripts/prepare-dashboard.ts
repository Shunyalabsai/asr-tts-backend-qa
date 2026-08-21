import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

/**
 * Prepares deploy/ directory for local viewing and GitHub Pages deployment.
 * - Copies latest HTML report as deploy/latest-report.html and deploy/reports/index.html
 * - Ensures runs/ directory with index.json is present and includes all historical run JSON files
 * - Automatically pushes to gh-pages if git remote is configured
 */
export function prepareDashboard(autoDeploy: boolean = true): void {
  const rootDir = process.cwd();
  const deployDir = path.resolve(rootDir, 'deploy');
  const reportsDir = path.resolve(rootDir, 'reports');
  const runsDir = path.join(deployDir, 'runs');
  const deployReportsDir = path.join(deployDir, 'reports');

  if (!fs.existsSync(deployDir)) fs.mkdirSync(deployDir, { recursive: true });
  if (!fs.existsSync(runsDir)) fs.mkdirSync(runsDir, { recursive: true });
  if (!fs.existsSync(deployReportsDir)) fs.mkdirSync(deployReportsDir, { recursive: true });

  // 1. Copy latest HTML report
  if (fs.existsSync(reportsDir)) {
    const htmlReports = fs.readdirSync(reportsDir)
      .filter((f: string) => f.startsWith('ASR-Test-Report-') && f.endsWith('.html'))
      .sort()
      .reverse();

    if (htmlReports.length > 0) {
      const latest = htmlReports[0];
      const srcPath = path.join(reportsDir, latest);
      fs.copyFileSync(srcPath, path.join(deployDir, latest));
      fs.copyFileSync(srcPath, path.join(deployDir, 'latest-report.html'));
      fs.copyFileSync(srcPath, path.join(deployReportsDir, 'index.html'));
      fs.copyFileSync(srcPath, path.join(deployReportsDir, latest));
      console.log(`[Dashboard Prep] Copied ${latest} → deploy/latest-report.html and deploy/reports/`);
    }
  }

  // 2. Discover and sync all run JSON files into deploy/runs/
  const runFiles = fs.readdirSync(runsDir)
    .filter((f: string) => f.endsWith('.json') && f !== 'index.json')
    .sort();

  const indexPath = path.join(runsDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify({ runs: runFiles }, null, 2));
  console.log(`[Dashboard Prep] Indexed ${runFiles.length} runs in ${indexPath}`);

  // 3. Auto-deploy to GitHub Pages if autoDeploy is true
  if (autoDeploy) {
    pushToGhPages(deployDir);
  }
}

export function pushToGhPages(deployDir: string): void {
  try {
    console.log('\n🚀 Auto-deploying updated dashboard to GitHub Pages (gh-pages branch)...');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-pages-deploy-'));

    // Copy deploy contents to temp directory
    execSync(`cp -r "${deployDir}/"* "${tempDir}/"`, { stdio: 'ignore' });
    fs.writeFileSync(path.join(tempDir, '.nojekyll'), '');

    // Get origin URL
    let remoteUrl = 'https://github.com/yamini-pal-singh/automation-testing.git';
    try {
      remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    } catch {}

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    execSync(`cd "${tempDir}" && git init -b gh-pages && git config user.name "yamini-pal-singh" && git config user.email "yamini@unitedwecare.com" && git remote add origin "${remoteUrl}" && git add -A && git commit -m "deploy: auto-update STT & TTS dashboard (${now})" && git push -f origin gh-pages`, {
      stdio: 'inherit',
    });

    // Cleanup
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    console.log('✅ GitHub Pages live dashboard updated successfully!');
  } catch (err: any) {
    console.warn(`\n⚠️ Note: GitHub Pages auto-deploy skipped (${err.message || 'network/git error'}). Local dashboard is up to date.`);
  }
}

if (require.main === module) {
  prepareDashboard(true);
}
