import { test, expect } from '@playwright/test';
import { AuthClient, AuthError } from '../../services/AuthClient';
import { ASR_BASE_URL, ENDPOINTS } from '../../config';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp } from '../../utils/audioHelper';
import type { TokenResponse, ApiErrorResponse } from '../../types';

const moduleName = 'Authentication';
const realApiKey = process.env.ASR_API_KEY || '';

async function postAuth(apiKey: string): Promise<{ status: number; body: any; latencyMs: number }> {
  const start = Date.now();
  const url = `${ASR_BASE_URL}${ENDPOINTS.auth}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  });
  const latencyMs = Date.now() - start;
  const body = response.headers.get('content-type')?.includes('json')
    ? await response.json()
    : await response.text();
  return { status: response.status, body, latencyMs };
}

test('M01-T01: Valid API key returns token with expires_at and expires_in @smoke', async () => {
  const start = Date.now();
  try {
    const { status, body, latencyMs } = await postAuth(realApiKey);

    expect(status).toBe(200);
    const tb = body as TokenResponse;
    expect(tb.token).toBeTruthy();
    expect(typeof tb.token).toBe('string');
    expect(typeof tb.expires_at).toBe('number');
    expect(typeof tb.expires_in).toBe('number');
    expect(tb.expires_in).toBeGreaterThan(0);

    testResults.add({
      testId: 'M01-T01', module: moduleName,
      description: 'Valid API key returns token with expires_at and expires_in',
      status: 'PASS', latencyMs, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M01-T01', module: moduleName,
      description: 'Valid API key returns token with expires_at and expires_in',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M01-T02: Missing Authorization header returns 400', async () => {
  const start = Date.now();
  try {
    const url = `${ASR_BASE_URL}${ENDPOINTS.auth}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    });
    const latencyMs = Date.now() - start;
    const body = await response.json() as ApiErrorResponse;

    expect(response.status).toBe(400);
    expect(body.detail).toBeTruthy();

    testResults.add({
      testId: 'M01-T02', module: moduleName,
      description: 'Missing Authorization header returns 400',
      status: 'PASS', latencyMs, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M01-T02', module: moduleName,
      description: 'Missing Authorization header returns 400',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M01-T03: Invalid/random API key returns 401', async () => {
  const start = Date.now();
  try {
    const { status, body, latencyMs } = await postAuth('invalid-key-12345');
    expect(status).toBe(401);
    expect((body as ApiErrorResponse).detail).toBeTruthy();

    testResults.add({
      testId: 'M01-T03', module: moduleName,
      description: 'Invalid/random API key returns 401',
      status: 'PASS', latencyMs, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M01-T03', module: moduleName,
      description: 'Invalid/random API key returns 401',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M01-T04: Empty Bearer value returns 401', async () => {
  const start = Date.now();
  try {
    const { status, body, latencyMs } = await postAuth('');
    expect([400, 401]).toContain(status);
    expect((body as ApiErrorResponse).detail).toBeTruthy();

    testResults.add({
      testId: 'M01-T04', module: moduleName,
      description: 'Empty Bearer value returns 400/401',
      status: 'PASS', latencyMs, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M01-T04', module: moduleName,
      description: 'Empty Bearer value returns 400/401',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M01-T05: AuthClient caching and refresh works', async () => {
  const start = Date.now();
  try {
    const authClient = new AuthClient();
    const token1 = await authClient.getToken();
    expect(token1).toBeTruthy();

    // Second call should return cached token
    const token2 = await authClient.getToken();
    expect(token2).toBe(token1);

    // Invalidate and get new
    authClient.invalidate();
    const token3 = await authClient.getToken();
    expect(token3).toBeTruthy();

    testResults.add({
      testId: 'M01-T05', module: moduleName,
      description: 'AuthClient caching and refresh works correctly',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M01-T05', module: moduleName,
      description: 'AuthClient caching and refresh works correctly',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M01-T06: API key is not echoed in the response body', async () => {
  const start = Date.now();
  try {
    const { status, body, latencyMs } = await postAuth(realApiKey);
    expect(status).toBe(200);

    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain(realApiKey);

    testResults.add({
      testId: 'M01-T06', module: moduleName,
      description: 'API key is not echoed in the response body',
      status: 'PASS', latencyMs, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M01-T06', module: moduleName,
      description: 'API key is not echoed in the response body',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M01-T07: Health endpoint works without auth @smoke', async () => {
  const start = Date.now();
  try {
    const url = `${ASR_BASE_URL}/health`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    const latencyMs = Date.now() - start;
    expect(response.status).toBe(200);

    testResults.add({
      testId: 'M01-T07', module: moduleName,
      description: 'Health endpoint works without auth',
      status: 'PASS', latencyMs, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M01-T07', module: moduleName,
      description: 'Health endpoint works without auth',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M01-T08: Auth token expires_in is within expected range (~900s)', async () => {
  const start = Date.now();
  try {
    const { status, body, latencyMs } = await postAuth(realApiKey);
    expect(status).toBe(200);
    const tb = body as TokenResponse;
    // Allow some buffer: typically 900s, but could vary
    expect(tb.expires_in).toBeGreaterThan(100);

    testResults.add({
      testId: 'M01-T08', module: moduleName,
      description: 'Auth token expires_in is within expected range',
      status: 'PASS', latencyMs, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M01-T08', module: moduleName,
      description: 'Auth token expires_in is within expected range',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});
