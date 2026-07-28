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

  console.log('\n✅ Report generated and pushed to Google Sheets.\n');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
