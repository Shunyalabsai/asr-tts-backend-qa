import { test, expect } from '@playwright/test';
import { HealthClient } from '../../services';
import { AuthClient, ApiClient } from '../../services';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp } from '../../utils/audioHelper';
import type { HealthResponse } from '../../types';

const moduleName = 'Health';

let healthClient: HealthClient;

test.beforeAll(() => {
  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  healthClient = new HealthClient(apiClient);
});

test('M13-T01: /health returns status ok @smoke', async () => {
  const start = Date.now();
  try {
    const result = await healthClient.check();
    const latency = Date.now() - start;

    expect(result.status).toBe(200);
    const body = result.body as any;
    expect(body.status || body.service).toBeTruthy();

    testResults.add({
      testId: 'M13-T01',
      module: moduleName,
      description: '/health returns status ok',
      status: 'PASS',
      latencyMs: latency,
      timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M13-T01',
      module: moduleName,
      description: '/health returns status ok',
      status: 'FAIL',
      latencyMs: Date.now() - start,
      failureReason: err.message,
      timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M13-T02: /health responds in under 2 seconds @smoke', async () => {
  const start = Date.now();
  try {
    const result = await healthClient.check();
    const latency = Date.now() - start;

    expect(result.status).toBe(200);
    expect(latency).toBeLessThan(2000);

    testResults.add({
      testId: 'M13-T02',
      module: moduleName,
      description: '/health responds in under 2 seconds',
      status: 'PASS',
      latencyMs: latency,
      timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M13-T02',
      module: moduleName,
      description: '/health responds in under 2 seconds',
      status: 'FAIL',
      latencyMs: Date.now() - start,
      failureReason: err.message,
      timestamp: getTimestamp(),
    });
    throw err;
  }
});
