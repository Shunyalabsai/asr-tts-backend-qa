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
  category: 'models' | 'features' | 'tts' | 'core';
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: string;
  avgWer: string;
  avgCer: string;
  avgLatencyMs: number;
}

export interface CategorySummary {
  name: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: string;
  avgLatencyMs: number;
  tabsCount: number;
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

function categorizeTab(tabName: string): 'models' | 'features' | 'tts' | 'core' {
  if (tabName.startsWith('zero-tts')) return 'tts';
  if (tabName.startsWith('Core-System') || tabName.startsWith('System-') || tabName === 'Health' || tabName === 'Auth') return 'core';
  if (tabName.startsWith('Feat-') || tabName.startsWith('Feature-')) return 'features';
  return 'models';
}

/**
 * Parses all CSV dataset files in reports/ for a given date
 */
function loadDatasetsForDate(reportsDir: string, dateStr: string): {
  items: DatasetItem[];
  tabSummaries: DatasetTabSummary[];
  categorySummaries: Record<string, CategorySummary>;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: string;
  avgLatencyMs: number;
} {
  const allItems: DatasetItem[] = [];
  const tabSummaries: DatasetTabSummary[] = [];

  if (!fs.existsSync(reportsDir)) {
    return {
      items: [],
      tabSummaries: [],
      categorySummaries: {},
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: '0%',
      avgLatencyMs: 0,
    };
  }

  const files = fs.readdirSync(reportsDir).filter(f => f.endsWith(`-${dateStr}.csv`));

  for (const file of files) {
    const tabName = file.replace(`-${dateStr}.csv`, '');
    const category = categorizeTab(tabName);
    const filePath = path.join(reportsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const rows = parseCSV(content);
      if (rows.length < 2) continue;

      const headers = rows[0].map(h => h.trim().toLowerCase());
      const findCol = (keys: string[]) => headers.findIndex(h => keys.some(k => h.includes(k)));

      const audioIdx = findCol(['audio_path', 'audio_file', 'audio_url', 'identifier', 'test_id']);
      const langIdx = findCol(['lang', 'language', 'category']);
      const langCodeIdx = findCol(['lang_code', 'language_code', 'mode']);
      const detLangIdx = findCol(['detected_language', 'output_script', 'voice']);
      const matchIdx = findCol(['lang_code_match', 'translation_method']);
      const gtIdx = findCol(['ground_truth', 'transcript', 'input_text', 'description', 'original_text']);
      const predIdx = findCol(['transcribed_text', 'predicted_text', 'summary_text', 'clean_text', 'normalized_text', 'corrected_text', 'shunyalabs_transcribed_text', 'shunyalabs_transliterated_text', 'output']);
      const durIdx = findCol(['duration', 'duration_estimate_s', 'compression_ratio']);
      const latIdx = findCol(['latency_ms', 'latency']);
      const werIdx = findCol(['wer']);
      const cerIdx = findCol(['cer']);
      const statusIdx = findCol(['test_status', 'status']);
      const failIdx = findCol(['failure_reason', 'notes']);
      const tsIdx = findCol(['timestamp']);

      const tabItems: DatasetItem[] = [];
      let tabPassed = 0, tabFailed = 0, tabSkipped = 0;
      let totalWer = 0, werCount = 0;
      let totalCer = 0, cerCount = 0;
      let totalLat = 0, latCount = 0;

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (row.length === 0) continue;

        const firstCell = String(row[0] || '').trim();
        // Skip run summary rows or separator lines
        if (firstCell.startsWith('═══') || firstCell.includes('TEST RUN') || firstCell.startsWith('───')) {
          continue;
        }

        const statusRaw = statusIdx >= 0 ? (row[statusIdx] || 'PASS').toUpperCase() : 'PASS';
        const status = (statusRaw.includes('PASS') ? 'PASS' : (statusRaw.includes('SKIP') ? 'SKIP' : 'FAIL')) as 'PASS' | 'FAIL' | 'SKIP';
        const werStr = werIdx >= 0 ? row[werIdx] || 'N/A' : 'N/A';
        const cerStr = cerIdx >= 0 ? row[cerIdx] || 'N/A' : 'N/A';
        const latMs = latIdx >= 0 ? parseInt(row[latIdx], 10) || 0 : 0;

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
          audioPath: audioIdx >= 0 ? row[audioIdx] || '' : '',
          lang: langIdx >= 0 ? row[langIdx] || '' : '',
          langCode: langCodeIdx >= 0 ? row[langCodeIdx] || '' : '',
          detectedLang: detLangIdx >= 0 ? row[detLangIdx] || '' : '',
          langMatch: matchIdx >= 0 ? row[matchIdx] || 'N/A' : 'N/A',
          groundTruth: gtIdx >= 0 ? row[gtIdx] || '' : '',
          predictedText: predIdx >= 0 ? row[predIdx] || '' : '',
          duration: durIdx >= 0 ? row[durIdx] || '0' : '0',
          latencyMs: latMs,
          wer: werStr,
          cer: cerStr,
          status,
          failureReason: failIdx >= 0 ? row[failIdx] || '' : '',
          timestamp: tsIdx >= 0 ? row[tsIdx] || new Date().toISOString() : new Date().toISOString(),
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
        category,
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

  // Aggregate Category Summaries
  const categorySummaries: Record<string, CategorySummary> = {
    models: { name: 'Speech-to-Text Models', total: 0, passed: 0, failed: 0, skipped: 0, passRate: '0%', avgLatencyMs: 0, tabsCount: 0 },
    features: { name: 'Speech Intelligence & Audio Features', total: 0, passed: 0, failed: 0, skipped: 0, passRate: '0%', avgLatencyMs: 0, tabsCount: 0 },
    tts: { name: 'TTS Voice Synthesis', total: 0, passed: 0, failed: 0, skipped: 0, passRate: '0%', avgLatencyMs: 0, tabsCount: 0 },
    core: { name: 'Core System Health & Routing', total: 0, passed: 0, failed: 0, skipped: 0, passRate: '0%', avgLatencyMs: 0, tabsCount: 0 },
  };

  for (const ts of tabSummaries) {
    const cat = categorySummaries[ts.category] || categorySummaries['models'];
    cat.total += ts.total;
    cat.passed += ts.passed;
    cat.failed += ts.failed;
    cat.skipped += ts.skipped;
    cat.tabsCount++;
  }

  for (const key of Object.keys(categorySummaries)) {
    const cat = categorySummaries[key];
    cat.passRate = cat.total > 0 ? ((cat.passed / cat.total) * 100).toFixed(1) + '%' : '0%';
  }

  const total = allItems.length;
  const passed = allItems.filter(i => i.status === 'PASS').length;
  const failed = allItems.filter(i => i.status === 'FAIL').length;
  const skipped = allItems.filter(i => i.status === 'SKIP').length;
  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) + '%' : '0%';
  const totalLat = allItems.reduce((acc, i) => acc + i.latencyMs, 0);
  const avgLatencyMs = total > 0 ? Math.round(totalLat / total) : 0;

  return { items: allItems, tabSummaries, categorySummaries, total, passed, failed, skipped, passRate, avgLatencyMs };
}

/**
 * Prepares deploy/ directory for local viewing and GitHub Pages deployment.
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
      for (const reportFile of htmlReports) {
        fs.copyFileSync(path.join(reportsDir, reportFile), path.join(deployReportsDir, reportFile));
        fs.copyFileSync(path.join(reportsDir, reportFile), path.join(deployDir, reportFile));
      }
      fs.copyFileSync(srcPath, path.join(deployReportsDir, 'index.html'));
      console.log(`[Dashboard Prep] Copied ${latest} → deploy/latest-report.html and deploy/reports/`);
    }
  }

  // 2. Discover all dates from CSV files in reports/
  const discoveredDates = new Set<string>();
  if (fs.existsSync(reportsDir)) {
    const csvFiles = fs.readdirSync(reportsDir).filter(f => f.endsWith('.csv'));
    for (const f of csvFiles) {
      const match = f.match(/-(\d{4}-\d{2}-\d{2})\.csv$/);
      if (match) discoveredDates.add(match[1]);
    }
  }

  // 3. Process each date and write JSON run file
  const runSummaries: any[] = [];
  const sortedDates = Array.from(discoveredDates).sort().reverse();

  for (const dateStr of sortedDates) {
    const dataset = loadDatasetsForDate(reportsDir, dateStr);
    const jsonPath = path.join(runsDir, `${dateStr}.json`);

    let existingData: any = {};
    if (fs.existsSync(jsonPath)) {
      try { existingData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')); } catch {}
    }

    const mergedData = {
      ...existingData,
      date: dateStr,
      generatedAt: new Date().toISOString(),
      masterOverview: {
        totalTestCases: dataset.total,
        passed: dataset.passed,
        failed: dataset.failed,
        skipped: dataset.skipped,
        passRate: dataset.passRate,
        avgLatencyMs: dataset.avgLatencyMs,
        categories: dataset.categorySummaries,
      },
      summary: {
        totalTests: dataset.total,
        passed: dataset.passed,
        failed: dataset.failed,
        skipped: dataset.skipped,
        passRate: dataset.passRate,
        avgLatencyMs: dataset.avgLatencyMs,
      },
      datasetSummaries: dataset.tabSummaries,
      datasetItems: dataset.items,
    };

    fs.writeFileSync(jsonPath, JSON.stringify(mergedData, null, 2), 'utf-8');

    runSummaries.push({
      date: dateStr,
      totalTests: dataset.total,
      passed: dataset.passed,
      failed: dataset.failed,
      skipped: dataset.skipped,
      passRate: dataset.passRate,
      avgLatencyMs: dataset.avgLatencyMs,
      datasetTabCount: dataset.tabSummaries.length,
      categories: dataset.categorySummaries,
      reportUrl: `reports/ASR-Test-Report-${dateStr}.html`,
    });
  }

  // 4. Generate master index.json
  const indexPath = path.join(runsDir, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify(runSummaries, null, 2), 'utf-8');
  console.log(`[Dashboard Prep] Indexed ${runSummaries.length} runs with full master metrics in ${indexPath}`);

  // 5. Ensure index.html and dashboard-v2.html exist
  const srcDashboard = path.join(deployDir, 'dashboard-v2.html');
  const indexHtml = path.join(deployDir, 'index.html');
  if (fs.existsSync(srcDashboard)) {
    fs.copyFileSync(srcDashboard, indexHtml);
  }
}

if (require.main === module) {
  prepareDashboard(false);
}
