import type { Reporter, FullConfig, Suite, TestCase, TestResult as PwTestResult, FullResult } from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';
import { SummaryBuilder, JsonReporter, HtmlReporter } from './index';
import type { TestResult } from '../types';
import { getLocalDateStr } from '../utils/audioHelper';
import { prepareDashboard } from '../../scripts/prepare-dashboard';

export default class PlaywrightDashboardReporter implements Reporter {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  onBegin(config: FullConfig, suite: Suite): void {
    this.startTime = Date.now();
    this.results = [];
  }

  onTestEnd(test: TestCase, result: PwTestResult): void {
    // Extract module name from file path, e.g. "src/features/tts/tts-standard.spec.ts" -> "TTS"
    const filePath = test.location?.file || '';
    const moduleLabel = this.getModuleLabel(filePath, test.title);
    const isPassed = result.status === 'passed';
    const isSkipped = result.status === 'skipped';

    this.results.push({
      testId,
      module: moduleLabel,
      description: test.title,
      status: isPassed ? 'PASS' : (isSkipped ? 'SKIP' : 'FAIL'),
      latencyMs: Math.round(result.duration),
      failureReason: (isPassed || isSkipped) ? undefined : (result.error?.message || result.errors?.map(e => e.message).join('; ') || 'Test failed'),
      timestamp: new Date().toISOString(),
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    if (this.results.length === 0) return;

    try {
      const durationMs = Date.now() - this.startTime;
      const builder = new SummaryBuilder();
      const summary = builder.build(this.results, durationMs);

      const reportsDir = path.resolve(process.cwd(), 'reports');
      if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

      // 1. Generate JSON & HTML reports
      const jsonReporter = new JsonReporter(reportsDir);
      jsonReporter.save(summary);

      const htmlReporter = new HtmlReporter(reportsDir);
      htmlReporter.generate(summary);

      // 2. Save run history to deploy/runs/
      this.saveRunHistory(summary);

      // 3. Prepare dashboard assets & auto-deploy to GitHub Pages
      prepareDashboard(true);

      console.log(`\n🎉 [Auto-Dashboard] Dashboard and run history automatically updated and deployed for ${summary.totalTests} tests (${(summary.passRate * 100).toFixed(1)}% pass rate).\n`);
    } catch (err: any) {
      console.warn(`[Auto-Dashboard] Warning: Could not complete auto-dashboard update: ${err.message}`);
    }
  }

  private saveRunHistory(summary: any): void {
    const runDir = path.resolve(process.cwd(), 'deploy', 'runs');
    if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });

    // Format unique run ID with timestamp: RUN-YYYYMMDD-HHMMSS
    const now = new Date();
    const timeTag = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const dateTag = summary.date.replace(/-/g, '');
    const runId = `RUN-${dateTag}-${timeTag}`;
    const isoTimestamp = now.toISOString();

    const run = {
      id: runId,
      date: summary.date,
      startedAt: isoTimestamp,
      completedAt: new Date(now.getTime() + (summary.durationMs || 0)).toISOString(),
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
      tests: summary.results.map((r: any) => ({
        id: r.testId,
        suite: r.module === 'TTS' ? 'TTS Synthesis' : (['Health', 'Authentication', 'AudioInput-File', 'LanguageCode'].includes(r.module) ? 'Core System' : (['SpeakerDiarization', 'WordBoosting', 'ProfanityMasking', 'SpeechIntelligence'].includes(r.module) ? 'Audio Intelligence' : 'Speech Models')),
        module: r.module,
        moduleLabel: r.module,
        feature: r.module,
        title: r.description,
        description: r.description,
        audioPath: 'Direct API Payload / Fixture',
        language: 'Auto / Multilingual',
        groundTruth: r.description,
        predictedText: r.status === 'PASS' ? 'Execution passed' : (r.failureReason || 'Failed'),
        duration: `${(r.latencyMs / 1000).toFixed(2)}s`,
        durationMs: r.latencyMs,
        wer: 'N/A',
        cer: 'N/A',
        accuracy: r.status === 'PASS' ? '100%' : '0%',
        status: r.status === 'PASS' ? 'passed' : (r.status === 'SKIP' ? 'skipped' : 'failed'),
        failureReason: r.failureReason || '',
        priority: 'P0',
        timestamp: isoTimestamp,
      })),
    };

    // Save timestamped run file: 2026-09-01-125315.json and update latest 2026-09-01.json
    const timestampedRunFile = path.join(runDir, `${summary.date}-${timeTag}.json`);
    fs.writeFileSync(timestampedRunFile, JSON.stringify(run, null, 2));

    const latestDateFile = path.join(runDir, `${summary.date}.json`);
    fs.writeFileSync(latestDateFile, JSON.stringify(run, null, 2));

    // Update index.json
    const indexPath = path.join(runDir, 'index.json');
    let existing: string[] = [];
    try {
      existing = JSON.parse(fs.readFileSync(indexPath, 'utf-8')).runs || [];
    } catch {}
    const filename = `${summary.date}-${timeTag}.json`;
    if (!existing.includes(filename)) {
      existing.push(filename);
      existing.sort();
    }
    fs.writeFileSync(indexPath, JSON.stringify({ runs: existing }, null, 2));
  }

  private getModuleLabel(filePath: string, title: string): string {
    if (filePath.includes('/tts/')) return 'TTS';
    if (filePath.includes('/health-check/')) return 'Health';
    if (filePath.includes('/authentication/')) return 'Authentication';
    if (filePath.includes('/transcription/')) return 'AudioInput-File';
    if (filePath.includes('/language-identification/')) return 'LanguageCode';
    if (filePath.includes('/speaker-diarization/')) return 'SpeakerDiarization';
    if (filePath.includes('/word-boosting/')) return 'WordBoosting';
    if (filePath.includes('/profanity-keyword-hashing/')) return 'ProfanityMasking';
    if (filePath.includes('/schema-validation/')) return 'ResponseSchema';
    if (filePath.includes('/speech-intelligence/')) return 'SpeechIntelligence';
    if (filePath.includes('/combination-scenarios/')) return 'CombinationScenarios';
    if (filePath.includes('/error-handling/')) return 'ErrorHandling';
    if (filePath.includes('/security/')) return 'Security-Misc';
    if (filePath.includes('/speaker-management/')) return 'SpeakerManagement';
    if (filePath.includes('/streaming/')) return 'Streaming';

    if (title.startsWith('TTS_')) return 'TTS';
    if (title.startsWith('M01')) return 'Health';
    if (title.startsWith('M02')) return 'Authentication';
    if (title.startsWith('M03')) return 'AudioInput-File';
    if (title.startsWith('M04')) return 'LanguageCode';
    if (title.startsWith('M05')) return 'SpeakerDiarization';
    if (title.startsWith('M06')) return 'WordBoosting';
    if (title.startsWith('M07')) return 'ProfanityMasking';
    if (title.startsWith('M08')) return 'ResponseSchema';
    if (title.startsWith('M09')) return 'SpeechIntelligence';
    if (title.startsWith('M10')) return 'CombinationScenarios';
    if (title.startsWith('M11')) return 'ErrorHandling';
    if (title.startsWith('M12')) return 'Security-Misc';
    if (title.startsWith('M18')) return 'SpeakerManagement';
    if (title.startsWith('M19') || title.startsWith('M20')) return 'Streaming';

    return 'General';
  }
}
