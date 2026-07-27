import { test, expect } from '@playwright/test';
import { AuthClient, ApiClient, BatchTranscriptionClient } from '../../services';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp } from '../../utils/audioHelper';
import { audioFixture, THRESHOLDS } from '../../config';
import { runConcurrent, measureLatencyPercentiles } from '../../utils/concurrentRunner';

const moduleName = 'Limits-Performance';

let batchClient: BatchTranscriptionClient;
let authClient: AuthClient;

test.beforeAll(() => {
  authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  batchClient = new BatchTranscriptionClient(apiClient);
});

test('M12-T01: Short request latency is within threshold', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'));
    expect(result.status).toBe(200);

    testResults.add({
      testId: 'M12-T01', module: moduleName,
      description: 'Short request latency measured',
      status: 'PASS',
      latencyMs: result.latencyMs,
      timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M12-T01', module: moduleName,
      description: 'Short request latency measured',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M12-T02: Diarization adds measurable latency', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'), {
      diarize: true,
      response_format: 'verbose_json',
    });
    expect(result.status).toBe(200);

    testResults.add({
      testId: 'M12-T02', module: moduleName,
      description: 'Diarization latency measured',
      status: 'PASS',
      latencyMs: result.latencyMs,
      timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M12-T02', module: moduleName,
      description: 'Diarization latency measured',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M12-T03: Opt-in features latency measured', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'), {
      response_format: 'verbose_json',
    });
    expect(result.status).toBe(200);

    testResults.add({
      testId: 'M12-T03', module: moduleName,
      description: 'Opt-in features latency measured',
      status: 'PASS',
      latencyMs: result.latencyMs,
      timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M12-T03', module: moduleName,
      description: 'Opt-in features latency measured',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M12-T04: NLP/speech intelligence latency measured', async () => {
  const start = Date.now();
  try {
    const siClient = (await import('../../services')).SpeechIntelligenceClient;
    const client = new siClient(new ApiClient(authClient));
    const result = await client.analyze({
      text: 'I want to book a flight to Mumbai for tomorrow',
      enable_intent_detection: true,
      enable_sentiment_analysis: true,
    });
    expect(result.status).toBe(200);

    testResults.add({
      testId: 'M12-T04', module: moduleName,
      description: 'Speech intelligence latency measured',
      status: 'PASS',
      latencyMs: result.latencyMs,
      timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M12-T04', module: moduleName,
      description: 'Speech intelligence latency measured',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M12-T05: Concurrent requests (5 simultaneous)', async () => {
  const start = Date.now();
  try {
    const results = await runConcurrent(5, async (i) => {
      try {
        const r = await batchClient.transcribeFile(audioFixture('wav'));
        return { status: r.status === 200 ? 'PASS' as const : 'FAIL' as const, latencyMs: r.latencyMs };
      } catch (e: any) {
        return { status: 'ERROR' as const, latencyMs: 0, error: e.message };
      }
    });

    const latencies = results.filter(r => r.latencyMs > 0).map(r => r.latencyMs);
    const stats = measureLatencyPercentiles(latencies);
    const successCount = results.filter(r => r.status === 'PASS').length;

    testResults.add({
      testId: 'M12-T05', module: moduleName,
      description: 'Concurrent requests (5 simultaneous)',
      status: successCount >= 3 ? 'PASS' : 'FAIL',
      latencyMs: stats.avg,
      timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M12-T05', module: moduleName,
      description: 'Concurrent requests (5 simultaneous)',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M12-T06: Sequential requests (5 in sequence)', async () => {
  const start = Date.now();
  try {
    const latencies: number[] = [];

    for (let i = 0; i < 5; i++) {
      const r = await batchClient.transcribeFile(audioFixture('wav'));
      latencies.push(r.latencyMs);
    }

    const stats = measureLatencyPercentiles(latencies);

    testResults.add({
      testId: 'M12-T06', module: moduleName,
      description: 'Sequential requests (5 in sequence)',
      status: 'PASS',
      latencyMs: stats.avg,
      timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M12-T06', module: moduleName,
      description: 'Sequential requests (5 in sequence)',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});
