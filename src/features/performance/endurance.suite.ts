/**
 * Endurance Test — 1 request per minute for 60 minutes
 * Measures: long-running stability, token refresh handling, latency drift
 */
import { AuthClient, ApiClient, BatchTranscriptionClient } from '../../services';
import { measureLatencyPercentiles } from '../../utils/concurrentRunner';
import { audioFixture } from '../../config';

const TOTAL_MINUTES = 60;
const INTERVAL_MS = 60_000; // 1 minute

async function main(): Promise<void> {
  console.log('=== Endurance Test ===');
  console.log(`Duration: ${TOTAL_MINUTES} minutes, interval: every minute`);

  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  const batchClient = new BatchTranscriptionClient(apiClient);

  const latencies: number[] = [];
  let errors = 0;

  for (let minute = 0; minute < TOTAL_MINUTES; minute++) {
    const start = Date.now();

    try {
      const result = await batchClient.transcribeFile(audioFixture('wav'));
      latencies.push(result.latencyMs);
      console.log(`[min ${String(minute + 1).padStart(2)}/${TOTAL_MINUTES}] ok: ${result.latencyMs}ms`);
    } catch (err: any) {
      errors++;
      console.log(`[min ${String(minute + 1).padStart(2)}/${TOTAL_MINUTES}] ERROR: ${err.message}`);
    }

    // Wait for remaining time (if we finished early)
    const elapsed = Date.now() - start;
    if (elapsed < INTERVAL_MS && minute < TOTAL_MINUTES - 1) {
      await new Promise(r => setTimeout(r, INTERVAL_MS - elapsed));
    }
  }

  const stats = measureLatencyPercentiles(latencies);
  console.log(`\n=== Endurance Test Results ===`);
  console.log(`Requests: ${latencies.length + errors}, Errors: ${errors}`);
  console.log(`Latency stability:`, stats);

  // Check for latency drift (p95 of first half vs second half)
  const half = Math.floor(latencies.length / 2);
  const firstHalf = measureLatencyPercentiles(latencies.slice(0, half));
  const secondHalf = measureLatencyPercentiles(latencies.slice(half));
  const drift = secondHalf.avg - firstHalf.avg;
  console.log(`First half avg: ${firstHalf.avg.toFixed(0)}ms`);
  console.log(`Second half avg: ${secondHalf.avg.toFixed(0)}ms`);
  console.log(`Drift: ${drift > 0 ? '+' : ''}${drift.toFixed(0)}ms ${drift > 1000 ? '(WARNING)' : '(OK)'}`);

  const passRate = (1 - errors / TOTAL_MINUTES) * 100;
  process.exit(passRate >= 90 ? 0 : 1);
}

main().catch(err => {
  console.error('Endurance test failed:', err);
  process.exit(1);
});
