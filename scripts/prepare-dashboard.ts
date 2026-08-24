import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

export interface DatasetItem {
  tab: string;
  date: string;
  audioPath: string;
  lang: string;
  langCode: string;
  detectedLang: string;
  langMatch: string;
  groundTruth: string;
  predictedText: string;
  duration: string;
  latencyMs: number;
  wer: string;
  cer: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  failureReason: string;
  timestamp: string;
}

export interface DatasetTabSummary {
  tab: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: string;
  avgWer: string;
  avgCer: string;
  avgLatencyMs: number;
}

/**
 * Robust RFC 4180 CSV parser supporting multiline cells and quotes
 */
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentCell);
      if (currentRow.some(c => c.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some(c => c.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses all CSV dataset files in reports/ for a given date
 */
function loadDatasetsForDate(reportsDir: string, dateStr: string): {
  items: DatasetItem[];
  tabSummaries: DatasetTabSummary[];
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: string;
} {
  const allItems: DatasetItem[] = [];
  const tabSummaries: DatasetTabSummary[] = [];

  if (!fs.existsSync(reportsDir)) {
    return { items: [], tabSummaries: [], total: 0, passed: 0, failed: 0, skipped: 0, passRate: '0%' };
  }

  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith(`-${dateStr}.csv`));

  for (const file of files) {
    const tabName = file.replace(`-${dateStr}.csv`, '');
    const filePath = path.join(reportsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const rows = parseCSV(content);
      if (rows.length < 2) continue;

      const headers = rows[0].map(h => h.trim().toLowerCase());
      const audioIdx = headers.indexOf('audio_path');
      const langIdx = headers.indexOf('lang');
      const langCodeIdx = headers.indexOf('lang_code');
      const detLangIdx = headers.indexOf('detected_language');
      const matchIdx = headers.indexOf('lang_code_match');
      const gtIdx = headers.indexOf('ground_truth');
      const predIdx = headers.indexOf('predicted_text');
      const durIdx = headers.indexOf('duration');
      const latIdx = headers.indexOf('latency_ms');
      const werIdx = headers.indexOf('wer');
      const cerIdx = headers.indexOf('cer');
      const statusIdx = headers.indexOf('test_status');
      const failIdx = headers.indexOf('failure_reason');
      const tsIdx = headers.indexOf('timestamp');

      const tabItems: DatasetItem[] = [];
      let tabPassed = 0, tabFailed = 0, tabSkipped = 0;
      let totalWer = 0, werCount = 0;
      let totalCer = 0, cerCount = 0;
      let totalLat = 0, latCount = 0;

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (row.length === 0 || !row[audioIdx]) continue;

        const status = (row[statusIdx] || 'PASS').toUpperCase() as 'PASS' | 'FAIL' | 'SKIP';
        const werStr = row[werIdx] || 'N/A';
        const cerStr = row[cerIdx] || 'N/A';
        const latMs = parseInt(row[latIdx], 10) || 0;

        if (status === 'PASS') tabPassed++;
        else if (status === 'FAIL') tabFailed++;
        else if (status === 'SKIP') tabSkipped++;

        if (werStr !== 'N/A') {
          const val = parseFloat(werStr.replace('%', ''));
          if (!isNaN(val)) { totalWer += val; werCount++; }
        }
        if (cerStr !== 'N/A') {
          const val = parseFloat(cerStr.replace('%', ''));
          if (!isNaN(val)) { totalCer += val; cerCount++; }
        }
        if (latMs > 0) { totalLat += latMs; latCount++; }

        const item: DatasetItem = {
          tab: tabName,
          date: row[0] || dateStr,
          audioPath: row[audioIdx] || '',
          lang: row[langIdx] || '',
          langCode: row[langCodeIdx] || '',
          detectedLang: row[detLangIdx] || '',
          langMatch: row[matchIdx] || 'N/A',
          groundTruth: row[gtIdx] || '',
          predictedText: row[predIdx] || '',
          duration: row[durIdx] || '0',
          latencyMs: latMs,
          wer: werStr,
          cer: cerStr,
          status,
          failureReason: row[failIdx] || '',
          timestamp: row[tsIdx] || new Date().toISOString(),
        };

        tabItems.push(item);
        allItems.push(item);
      }

      const tabTotal = tabItems.length;
      const tabRate = tabTotal > 0 ? ((tabPassed / tabTotal) * 100).toFixed(1) + '%' : 'N/A';
      const avgWer = werCount > 0 ? (totalWer / werCount).toFixed(1) + '%' : 'N/A';
      const avgCer = cerCount > 0 ? (totalCer / cerCount).toFixed(1) + '%' : 'N/A';
      const avgLat = latCount > 0 ? Math.round(totalLat / latCount) : 0;

      tabSummaries.push({
        tab: tabName,
        total: tabTotal,
        passed: tabPassed,
        failed: tabFailed,
        skipped: tabSkipped,
        passRate: tabRate,
        avgWer,
        avgCer,
        avgLatencyMs: avgLat,
      });
    } catch (e: any) {
      console.warn(`  ⚠ Could not parse CSV for ${tabName} (${dateStr}): ${e.message}`);
    }
  }

  const total = allItems.length;
  const passed = allItems.filter(i => i.status === 'PASS').length;
  const failed = allItems.filter(i => i.status === 'FAIL').length;
  const skipped = allItems.filter(i => i.status === 'SKIP').length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) + '%' : '0%';

  return { items: allItems, tabSummaries, total, passed, failed, skipped, passRate };
}

/**
 * Prepares deploy/ directory for local viewing and GitHub Pages deployment.
 * - Copies latest HTML report as deploy/latest-report.html and deploy/reports/index.html
 * - Enriches all run JSON files in deploy/runs/ with dataset records from CSV reports
 * - Generates deploy/runs/index.json with complete metadata for date dropdown & calendar
 * - Pushes to gh-pages if git remote is configured
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

  // 2. Discover all run dates from existing run JSONs and CSVs
  const runFiles = fs.readdirSync(runsDir)
    .filter((f: string) => f.endsWith('.json') && f !== 'index.json')
    .sort();

  const allDates = new Set<string>();
  for (const rf of runFiles) {
    allDates.add(rf.replace('.json', ''));
  }
  if (fs.existsSync(reportsDir)) {
    for (const f of fs.readdirSync(reportsDir)) {
      const match = f.match(/(\d{4}-\d{2}-\d{2})\.(csv|json|html)$/);
      if (match) allDates.add(match[1]);
    }
  }

  const sortedDates = Array.from(allDates).sort().reverse();
  const indexMetadata: any[] = [];

  for (const dateStr of sortedDates) {
    const runFilePath = path.join(runsDir, `${dateStr}.json`);
    let runData: any = {};

    if (fs.existsSync(runFilePath)) {
      try {
        runData = JSON.parse(fs.readFileSync(runFilePath, 'utf-8'));
      } catch (e) {
        runData = {};
      }
    }

    runData.date = dateStr;
    if (!runData.totalTests) runData.totalTests = 0;
    if (!runData.modules) runData.modules = [];
    if (!runData.failures) runData.failures = [];

    // Parse CSV dataset test cases for this date
    const datasets = loadDatasetsForDate(reportsDir, dateStr);
    runData.datasets = datasets.items;
    runData.datasetSummaries = datasets.tabSummaries;
    runData.datasetStats = {
      total: datasets.total,
      passed: datasets.passed,
      failed: datasets.failed,
      skipped: datasets.skipped,
      passRate: datasets.passRate,
    };

    // Include dataset failures in a combined/dedicated structure
    const datasetFailures = datasets.items.filter(i => i.status === 'FAIL').map(i => ({
      tab: i.tab,
      audioPath: i.audioPath,
      lang: i.lang,
      groundTruth: i.groundTruth,
      predictedText: i.predictedText,
      wer: i.wer,
      cer: i.cer,
      failureReason: i.failureReason,
      latencyMs: i.latencyMs,
      timestamp: i.timestamp,
    }));
    runData.datasetFailures = datasetFailures;

    fs.writeFileSync(runFilePath, JSON.stringify(runData, null, 2));

    indexMetadata.push({
      file: `${dateStr}.json`,
      date: dateStr,
      totalTests: runData.totalTests,
      passed: runData.passed,
      failed: runData.failed,
      passRate: runData.passRate || (runData.totalTests > 0 ? ((runData.passed / runData.totalTests) * 100).toFixed(1) : '100.0'),
      datasetTotal: datasets.total,
      datasetPassed: datasets.passed,
      datasetFailed: datasets.failed,
      datasetPassRate: datasets.passRate,
      hasDatasets: datasets.total > 0,
      durationMs: runData.durationMs || 0,
    });
  }

  const indexPath = path.join(runsDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify({
    runs: indexMetadata.map(m => m.file),
    metadata: indexMetadata,
    latestDate: sortedDates[0] || '',
  }, null, 2));

  console.log(`[Dashboard Prep] Indexed ${indexMetadata.length} runs with full dataset information in ${indexPath}`);

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

    // Get origin and personal remote URLs
    let originUrl = 'https://github.com/Shunyalabsai/asr-tts-backend-qa.git';
    try {
      originUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    } catch {}

    let personalUrl = '';
    try {
      personalUrl = execSync('git remote get-url personal', { encoding: 'utf-8' }).trim();
    } catch {}

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    execSync(`cd "${tempDir}" && git init -b gh-pages && git config user.name "yamini-pal-singh" && git config user.email "yamini@shunyalabs.ai" && git remote add origin "${originUrl}" && git add -A && git commit -m "deploy: update STT & TTS dashboard with history & datasets (${now})"`, {
      stdio: 'inherit',
    });

    console.log('Pushing to origin (gh-pages)...');
    try {
      execSync(`cd "${tempDir}" && git push -f origin gh-pages`, { stdio: 'inherit' });
    } catch (e: any) {
      console.warn(`  origin push warning: ${e.message}`);
    }

    if (personalUrl) {
      console.log('Pushing to personal (gh-pages)...');
      try {
        execSync(`cd "${tempDir}" && git remote add personal "${personalUrl}" && git push -f personal gh-pages`, { stdio: 'inherit' });
      } catch (e: any) {
        console.warn(`  personal push warning: ${e.message}`);
      }
    }

    // Cleanup
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    console.log('✅ GitHub Pages live dashboard updated successfully!');
  } catch (err: any) {
    console.warn(`\n⚠️ Note: GitHub Pages auto-deploy skipped (${err.message || 'network/git error'}). Local dashboard is up to date.`);
  }
}

if (require.main === module) {
  prepareDashboard(false);
}
