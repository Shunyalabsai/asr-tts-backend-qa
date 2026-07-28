import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { SummaryBuilder, JsonReporter, HtmlReporter } from '../src/reporting';
import { GoogleSheetsReporter } from '../src/reporting';
import type { TestResult } from '../src/types';

interface PlaywrightSuites {
  suites?: {
    file: string;
    title?: string;
    specs?: {
      title: string;
      ok: boolean;
      tests?: {
        results?: {
          status: string;
          duration: number;
          error?: { message?: string };
        }[];
      }[];
    }[];
  }[];
}

/**
 * Run each test module independently to avoid cascade failures (e.g. streaming timeout
 * holding the worker and breaking subsequent tests).
 */
const MODULES = [
  { name: 'health-check', label: 'Health' },
  { name: 'authentication', label: 'Authentication' },
  { name: 'transcription', label: 'AudioInput-File' },
  { name: 'language-identification', label: 'LanguageCode' },
  { name: 'speaker-diarization', label: 'SpeakerDiarization' },
  { name: 'word-boosting', label: 'WordBoosting' },
  { name: 'profanity-keyword-hashing', label: 'ProfanityMasking' },
  { name: 'schema-validation', label: 'ResponseSchema' },
  { name: 'speech-intelligence', label: 'SpeechIntelligence' },
  { name: 'combination-scenarios', label: 'CombinationScenarios' },
  { name: 'error-handling', label: 'ErrorHandling' },
  { name: 'security', label: 'Security-Misc' },
  { name: 'speaker-management', label: 'SpeakerManagement' },
  { name: 'streaming', label: 'Streaming' },
];

/** Parse Playwright JSON output into our TestResult format */
function parsePlaywrightResults(jsonPath: string, moduleName: string, moduleLabel: string): TestResult[] {
  if (!fs.existsSync(jsonPath)) return [];
  const raw: PlaywrightSuites = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const results: TestResult[] = [];
  for (const suite of raw.suites || []) {
    for (const spec of suite.specs || []) {
      const testResult = spec.tests?.[0]?.results?.[0];
      const passed = spec.ok;
      results.push({
        testId: spec.title.match(/^(M\d+-T\d+)/)?.[0] || spec.title,
        module: moduleLabel,
        description: spec.title,
        status: passed ? 'PASS' : 'FAIL',
        latencyMs: testResult?.duration ? Math.round(testResult.duration / 1000) : 0,
        failureReason: passed ? undefined : (testResult?.error?.message || 'Unknown error'),
        timestamp: new Date().toISOString(),
      });
    }
  }
  return results;
}

async function main(): Promise<void> {
  const reportsDir = path.resolve(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const allResults: TestResult[] = [];

  console.log('═══════════════════════════════════════════════');
  console.log('  ASR Test Framework v2 — Module-by-Module Run');
  console.log('═══════════════════════════════════════════════\n');

  for (const mod of MODULES) {
    const jsonPath = path.join(reportsDir, `_module-${mod.name}.json`);
    console.log(`▶ ${mod.label} ...`);

    try {
      execSync(
        `npx playwright test "src/features/${mod.name}/" --reporter=json --workers=1 2>/dev/null > "${jsonPath}"`,
        { cwd: process.cwd(), timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'] }
      );
    } catch {
      // exit code 1 is normal (failing tests)
    }

    const results = parsePlaywrightResults(jsonPath, mod.name, mod.label);
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`  ${passed} passed, ${failed} failed (${results.length} total)`);
    allResults.push(...results);

    // Clean up temp file
    try { fs.unlinkSync(jsonPath); } catch { /* ignore */ }
  }

  // ─── Build summary ─────────────────────────────────────────────
  const builder = new SummaryBuilder();
  const summary = builder.build(allResults, process.uptime() * 1000);

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  TOTAL: ${summary.totalTests} tests`);
  console.log(`  PASS:  ${summary.passed}`);
  console.log(`  FAIL:  ${summary.failed}`);
  console.log(`  RATE:  ${(summary.passRate * 100).toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════\n');

  // ─── Save reports ──────────────────────────────────────────────
  const jsonReporter = new JsonReporter();
  jsonReporter.save(summary);

  const htmlReporter = new HtmlReporter();
  htmlReporter.generate(summary);

  // ─── Push to Google Sheets ─────────────────────────────────────
  const gs = new GoogleSheetsReporter();
  await gs.initialize();
  await gs.writeEverything(summary);

  // ─── Save run history to deploy/runs/ for dashboard ────────────
  saveRunHistory(summary);

  console.log('\n✅ Reports generated, Google Sheets pushed, run history saved.\n');
}

/**
 * Save a run-history JSON file (for the dashboard) and update runs/index.json.
 */
function saveRunHistory(summary: any): void {
  const runDir = path.resolve(process.cwd(), 'deploy', 'runs');
  if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

  const run = {
    date: summary.date,
    totalTests: summary.totalTests,
    passed: summary.passed,
    failed: summary.failed,
    skipped: summary.skipped,
    passRate: (summary.passRate * 100).toFixed(1),
    durationMs: summary.durationMs || 0,
    modules: summary.categories.map((c: any) => ({
      module: c.module,
      total: c.total,
      passed: c.passed,
      failed: c.failed,
      skipped: c.skipped,
      avgLatencyMs: c.avgLatencyMs,
      p50LatencyMs: c.p50LatencyMs,
      p95LatencyMs: c.p95LatencyMs,
    })),
    failures: summary.results.filter((r: any) => r.status === 'FAIL').map((r: any) => ({
      testId: r.testId,
      module: r.module,
      description: r.description,
      failureReason: r.failureReason,
      latencyMs: r.latencyMs,
    })),
  };

  const runFile = path.join(runDir, `${summary.date}.json`);
  fs.writeFileSync(runFile, JSON.stringify(run, null, 2));
  console.log(`Run history saved: ${runFile}`);

  // Update index.json with chronological list of run files
  const indexPath = path.join(runDir, 'index.json');
  let existing: string[] = [];
  try {
    existing = JSON.parse(fs.readFileSync(indexPath, 'utf-8')).runs || [];
  } catch { /* fresh start */ }
  const filename = `${summary.date}.json`;
  if (!existing.includes(filename)) {
    existing.push(filename);
    existing.sort(); // chronological ascending
  }
  fs.writeFileSync(indexPath, JSON.stringify({ runs: existing }, null, 2));
  console.log(`Run index updated: ${existing.length} runs tracked`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
