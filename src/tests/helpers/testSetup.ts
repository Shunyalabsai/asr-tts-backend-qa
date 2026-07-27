import type { TestResult, ExecutionSummary, CategorySummary } from '../../types';
import { getLocalDateStr } from '../../utils/audioHelper';

export class TestResultsAccumulator {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  add(result: TestResult): void {
    this.results.push(result);
  }

  getAll(): TestResult[] {
    return [...this.results];
  }

  getByModule(module: string): TestResult[] {
    return this.results.filter(r => r.module === module);
  }

  buildSummary(): ExecutionSummary {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    // Per-category
    const moduleNames = [...new Set(this.results.map(r => r.module))];
    const categories: CategorySummary[] = moduleNames.map(module => {
      const modResults = this.results.filter(r => r.module === module);
      const latencies = modResults.map(r => r.latencyMs).filter(l => l > 0).sort((a, b) => a - b);

      return {
        module,
        total: modResults.length,
        passed: modResults.filter(r => r.status === 'PASS').length,
        failed: modResults.filter(r => r.status === 'FAIL').length,
        skipped: modResults.filter(r => r.status === 'SKIP').length,
        avgLatencyMs: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        p50LatencyMs: latencies.length ? latencies[Math.floor(latencies.length * 0.5)] : 0,
        p95LatencyMs: latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0,
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
      results: this.results,
      durationMs: Date.now() - this.startTime,
    };
  }
}

// Singleton used across test suites
export const testResults = new TestResultsAccumulator();
