import type { ConcurrentResult, LatencyStats, TestStatus } from '../types';

export async function runConcurrent(
  count: number,
  fn: (index: number) => Promise<{ status: TestStatus; latencyMs: number; error?: string }>
): Promise<ConcurrentResult[]> {
  const promises: Promise<ConcurrentResult>[] = [];

  for (let i = 0; i < count; i++) {
    promises.push(
      fn(i)
        .then(r => ({ index: i, ...r }))
        .catch(e => ({ index: i, status: 'ERROR' as TestStatus, latencyMs: 0, error: e.message || String(e) }))
    );
  }

  return Promise.all(promises);
}

export function measureLatencyPercentiles(latencies: number[]): LatencyStats {
  if (latencies.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const n = sorted.length;

  const sum = sorted.reduce((a, b) => a + b, 0);

  return {
    min: sorted[0],
    max: sorted[n - 1],
    avg: sum / n,
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
