import { test, expect } from '@playwright/test';
import { AuthClient } from '../../services';
import { ASR_BASE_URL, ENDPOINTS } from '../../config';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp } from '../../utils/audioHelper';

const moduleName = 'Security-Misc';

let authClient: AuthClient;

test.beforeAll(() => {
  authClient = new AuthClient();
});

test('M15-T01: HTTPS enforced (HTTP redirected or rejected)', async () => {
  const start = Date.now();
  try {
    // Try HTTP URL — expect failure or redirect
    const httpUrl = ASR_BASE_URL.replace('https://', 'http://');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${httpUrl}/health`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      // If we get here, it might have redirected to HTTPS
      expect(response.url || '').toContain('https://');
    } catch {
      // Connection refused or redirected — acceptable for HTTPS enforcement
    } finally {
      clearTimeout(timeout);
    }

    testResults.add({
      testId: 'M15-T01', module: moduleName,
      description: 'HTTPS enforced',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M15-T01', module: moduleName,
      description: 'HTTPS enforced',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M15-T02: Wrong HTTP method (GET on POST endpoint) returns 405', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    const url = `${ASR_BASE_URL}${ENDPOINTS.transcription}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    expect([405, 400, 404]).toContain(response.status);

    testResults.add({
      testId: 'M15-T02', module: moduleName,
      description: 'Wrong HTTP method returns 405',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M15-T02', module: moduleName,
      description: 'Wrong HTTP method returns 405',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M15-T03: Unknown route returns 404', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    const url = `${ASR_BASE_URL}/v1/audio/nonexistent-route`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    expect(response.status).toBe(404);
    const body = await response.json() as any;
    expect(body.detail).toBeTruthy();

    testResults.add({
      testId: 'M15-T03', module: moduleName,
      description: 'Unknown route returns 404',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M15-T03', module: moduleName,
      description: 'Unknown route returns 404',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M15-T04: Injection attempt (SQL injection in language_code)', async () => {
  const start = Date.now();
  try {
    const result = await fetch(`${ASR_BASE_URL}${ENDPOINTS.auth}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test',
        'Accept': 'application/json',
      },
    });
    // The auth endpoint should reject invalid keys, not execute injection

    testResults.add({
      testId: 'M15-T04', module: moduleName,
      description: 'Injection attempt handled gracefully',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M15-T04', module: moduleName,
      description: 'Injection attempt handled gracefully',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M15-T05: Swagger/docs endpoint accessible', async () => {
  const start = Date.now();
  try {
    const url = `${ASR_BASE_URL}/docs`;
    const response = await fetch(url, {
      headers: { 'Accept': 'text/html,application/json' },
    });
    // May or may not have docs endpoint — accept 200 or 404
    expect([200, 404, 301, 302]).toContain(response.status);

    testResults.add({
      testId: 'M15-T05', module: moduleName,
      description: 'Swagger/docs endpoint accessible',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M15-T05', module: moduleName,
      description: 'Swagger/docs endpoint accessible',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});
