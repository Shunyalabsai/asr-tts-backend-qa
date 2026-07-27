import type { TestResult, ExecutionSummary, CategorySummary } from '../types';
import { getLocalDateStr } from '../utils/audioHelper';

export class SummaryBuilder {
  build(results: TestResult[], durationMs?: number): ExecutionSummary {
    const total = results.length;
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;

    const modules = [...new Set(results.map(r => r.module))];
    const categories: CategorySummary[] = modules.map(m => {
      const modResults = results.filter(r => r.module === m);
      const latencies = modResults.map(r => r.latencyMs).filter(l => l > 0).sort((a, b) => a - b);

      return {
        module: m,
        total: modResults.length,
        passed: modResults.filter(r => r.status === 'PASS').length,
        failed: modResults.filter(r => r.status === 'FAIL').length,
        skipped: modResults.filter(r => r.status === 'SKIP').length,
        avgLatencyMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        p50LatencyMs: latencies.length ? this.percentile(latencies, 50) : 0,
        p95LatencyMs: latencies.length ? this.percentile(latencies, 95) : 0,
      };
    });

    return {
      date: getLocalDateStr(),
      totalTests: total,
      passed,
      failed,
      skipped,
      passRate: total > 0 ? passed / total : 0,
      categories,
      results,
      durationMs: durationMs || 0,
    };
  }

  private percentile(sorted: number[], p: number): number {
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }
}
