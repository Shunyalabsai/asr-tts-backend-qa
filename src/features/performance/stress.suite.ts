/**
 * Stress Test Suite — 50 concurrent transcription requests
 * Measures: error rate, latency percentiles, system resilience
 */
import { AuthClient, ApiClient, BatchTranscriptionClient } from '../../services';
import { runConcurrent, measureLatencyPercentiles } from '../../utils/concurrentRunner';
import { audioFixture, PERF_CONFIG } from '../../config';

async function main(): Promise<void> {
  console.log('=== Stress Test ===');
  console.log(`Concurrent requests: ${PERF_CONFIG.stressCount}`);

  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  const batchClient = new BatchTranscriptionClient(apiClient);

  const start = Date.now();

  const results = await runConcurrent(PERF_CONFIG.stressCount, async (i) => {
    try {
      const r = await batchClient.transcribeFile(audioFixture('wav'));
      return { status: r.status === 200 ? 'PASS' as const : 'FAIL' as const, latencyMs: r.latencyMs };
    } catch (e: any) {
      return { status: 'ERROR' as const, latencyMs: 0, error: e.message };
    }
  });

  const totalMs = Date.now() - start;
  const latencies = results.filter(r => r.latencyMs > 0).map(r => r.latencyMs);
  const stats = measureLatencyPercentiles(latencies);
  const errors = results.filter(r => r.status !== 'PASS');

  console.log(`Total time: ${totalMs}ms`);
  console.log(`Success: ${results.filter(r => r.status === 'PASS').length}/${PERF_CONFIG.stressCount}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Latency stats:`, stats);

  if (errors.length > 0) {
    console.log('First error:', errors[0].error);
  }

  const passRate = (results.filter(r => r.status === 'PASS').length / PERF_CONFIG.stressCount) * 100;
  console.log(`\nResult: ${passRate >= 80 ? 'PASS' : 'FAIL'} (${passRate.toFixed(1)}% success rate)`);

  process.exit(passRate >= 80 ? 0 : 1);
}

main().catch(err => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
