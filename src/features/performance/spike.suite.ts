/**
 * Spike Test — Ramp from 1 to 20 concurrent requests in 30 seconds
 * Measures: graceful degradation under sudden load, recovery time
 */
import { AuthClient, ApiClient, BatchTranscriptionClient } from '../../services';
import { runConcurrent, measureLatencyPercentiles } from '../../utils/concurrentRunner';
import { audioFixture } from '../../config';

async function main(): Promise<void> {
  console.log('=== Spike Test ===');
  console.log('Ramping from 1 to 20 concurrent requests');

  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  const batchClient = new BatchTranscriptionClient(apiClient);

  const levels = [1, 2, 5, 10, 15, 20, 15, 10, 5, 2, 1];
  const allLatencies: number[] = [];
  let totalErrors = 0;
  let totalRequests = 0;

  for (const concurrency of levels) {
    const start = Date.now();
    const results = await runConcurrent(concurrency, async (i) => {
      try {
        const r = await batchClient.transcribeFile(audioFixture('wav'));
        return { status: 'PASS' as const, latencyMs: r.latencyMs };
      } catch {
        return { status: 'ERROR' as const, latencyMs: 0, error: 'fail' };
      }
    });

    const elapsed = Date.now() - start;
    const latencies = results.filter(r => r.latencyMs > 0).map(r => r.latencyMs);
    allLatencies.push(...latencies);
    const errors = results.filter(r => r.status !== 'PASS').length;
    totalErrors += errors;
    totalRequests += concurrency;

    const stats = measureLatencyPercentiles(latencies);
    console.log(`Concurrency ${String(concurrency).padStart(2)}: ${results.filter(r => r.status === 'PASS').length}/${concurrency} ok, p95: ${stats.p95.toFixed(0)}ms, time: ${elapsed}ms`);
  }

  const overallStats = measureLatencyPercentiles(allLatencies);
  console.log(`\n=== Spike Test Results ===`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`Latency stats:`, overallStats);

  const passRate = (1 - totalErrors / totalRequests) * 100;
  process.exit(passRate >= 80 ? 0 : 1);
}

main().catch(err => {
  console.error('Spike test failed:', err);
  process.exit(1);
});
