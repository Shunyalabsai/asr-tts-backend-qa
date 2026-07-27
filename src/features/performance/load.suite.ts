/**
 * Load Test — Sustained 5 concurrent requests for 5 minutes
 * Measures: throughput, latency stability, error rate
 */
import { AuthClient, ApiClient, BatchTranscriptionClient } from '../../services';
import { runConcurrent, measureLatencyPercentiles } from '../../utils/concurrentRunner';
import { audioFixture, PERF_CONFIG } from '../../config';

const DURATION_MS = 5 * 60 * 1000; // 5 minutes
const WINDOW_MS = 10_000; // Report every 10s

async function main(): Promise<void> {
  console.log('=== Load Test ===');
  console.log(`Duration: 5 minutes, Concurrency: ${PERF_CONFIG.concurrentCount}`);

  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  const batchClient = new BatchTranscriptionClient(apiClient);
  const allLatencies: number[] = [];
  let errors = 0;
  let requests = 0;

  const start = Date.now();
  let lastReport = start;

  while (Date.now() - start < DURATION_MS) {
    const batch = await runConcurrent(PERF_CONFIG.concurrentCount, async (i) => {
      try {
        const r = await batchClient.transcribeFile(audioFixture('wav'));
        return { status: 'PASS' as const, latencyMs: r.latencyMs };
      } catch {
        return { status: 'ERROR' as const, latencyMs: 0, error: 'fail' };
      }
    });

    for (const r of batch) {
      if (r.status === 'PASS') {
        allLatencies.push(r.latencyMs);
      } else {
        errors++;
      }
      requests++;
    }

    if (Date.now() - lastReport > WINDOW_MS) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(0);
      const stats = measureLatencyPercentiles(allLatencies);
      console.log(`[${elapsed}s] requests: ${requests}, errors: ${errors}, p95: ${stats.p95.toFixed(0)}ms`);
      lastReport = Date.now();
    }
  }

  const totalMs = Date.now() - start;
  const stats = measureLatencyPercentiles(allLatencies);

  console.log(`\n=== Load Test Results ===`);
  console.log(`Duration: ${(totalMs / 1000).toFixed(0)}s`);
  console.log(`Total requests: ${requests}`);
  console.log(`Throughput: ${(requests / (totalMs / 1000)).toFixed(1)} req/s`);
  console.log(`Errors: ${errors} (${((errors / requests) * 100).toFixed(1)}%)`);
  console.log(`Latency stats:`, stats);

  const passRate = (1 - errors / requests) * 100;
  process.exit(passRate >= 95 ? 0 : 1);
}

main().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
