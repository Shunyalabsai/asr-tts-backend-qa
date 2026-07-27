# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: authentication/authentication.spec.ts >> M01-T01: Valid API key returns token with expires_at and expires_in @smoke
- Location: src/features/authentication/authentication.spec.ts:28:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 401
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { AuthClient, AuthError } from '../../services/AuthClient';
  3   | import { ASR_BASE_URL, ENDPOINTS } from '../../config';
  4   | import { testResults } from '../../tests/helpers/testSetup';
  5   | import { getTimestamp } from '../../utils/audioHelper';
  6   | import type { TokenResponse, ApiErrorResponse } from '../../types';
  7   | 
  8   | const moduleName = 'Authentication';
  9   | const realApiKey = process.env.ASR_API_KEY || '';
  10  | 
  11  | async function postAuth(apiKey: string): Promise<{ status: number; body: any; latencyMs: number }> {
  12  |   const start = Date.now();
  13  |   const url = `${ASR_BASE_URL}${ENDPOINTS.auth}`;
  14  |   const response = await fetch(url, {
  15  |     method: 'POST',
  16  |     headers: {
  17  |       'Authorization': `Bearer ${apiKey}`,
  18  |       'Accept': 'application/json',
  19  |     },
  20  |   });
  21  |   const latencyMs = Date.now() - start;
  22  |   const body = response.headers.get('content-type')?.includes('json')
  23  |     ? await response.json()
  24  |     : await response.text();
  25  |   return { status: response.status, body, latencyMs };
  26  | }
  27  | 
  28  | test('M01-T01: Valid API key returns token with expires_at and expires_in @smoke', async () => {
  29  |   const start = Date.now();
  30  |   try {
  31  |     const { status, body, latencyMs } = await postAuth(realApiKey);
  32  | 
> 33  |     expect(status).toBe(200);
      |                    ^ Error: expect(received).toBe(expected) // Object.is equality
  34  |     const tb = body as TokenResponse;
  35  |     expect(tb.token).toBeTruthy();
  36  |     expect(typeof tb.token).toBe('string');
  37  |     expect(typeof tb.expires_at).toBe('number');
  38  |     expect(typeof tb.expires_in).toBe('number');
  39  |     expect(tb.expires_in).toBeGreaterThan(0);
  40  | 
  41  |     testResults.add({
  42  |       testId: 'M01-T01', module: moduleName,
  43  |       description: 'Valid API key returns token with expires_at and expires_in',
  44  |       status: 'PASS', latencyMs, timestamp: getTimestamp(),
  45  |     });
  46  |   } catch (err: any) {
  47  |     testResults.add({
  48  |       testId: 'M01-T01', module: moduleName,
  49  |       description: 'Valid API key returns token with expires_at and expires_in',
  50  |       status: 'FAIL', latencyMs: Date.now() - start,
  51  |       failureReason: err.message, timestamp: getTimestamp(),
  52  |     });
  53  |     throw err;
  54  |   }
  55  | });
  56  | 
  57  | test('M01-T02: Missing Authorization header returns 400', async () => {
  58  |   const start = Date.now();
  59  |   try {
  60  |     const url = `${ASR_BASE_URL}${ENDPOINTS.auth}`;
  61  |     const response = await fetch(url, {
  62  |       method: 'POST',
  63  |       headers: { 'Accept': 'application/json' },
  64  |     });
  65  |     const latencyMs = Date.now() - start;
  66  |     const body = await response.json() as ApiErrorResponse;
  67  | 
  68  |     expect(response.status).toBe(400);
  69  |     expect(body.detail).toBeTruthy();
  70  | 
  71  |     testResults.add({
  72  |       testId: 'M01-T02', module: moduleName,
  73  |       description: 'Missing Authorization header returns 400',
  74  |       status: 'PASS', latencyMs, timestamp: getTimestamp(),
  75  |     });
  76  |   } catch (err: any) {
  77  |     testResults.add({
  78  |       testId: 'M01-T02', module: moduleName,
  79  |       description: 'Missing Authorization header returns 400',
  80  |       status: 'FAIL', latencyMs: Date.now() - start,
  81  |       failureReason: err.message, timestamp: getTimestamp(),
  82  |     });
  83  |     throw err;
  84  |   }
  85  | });
  86  | 
  87  | test('M01-T03: Invalid/random API key returns 401', async () => {
  88  |   const start = Date.now();
  89  |   try {
  90  |     const { status, body, latencyMs } = await postAuth('invalid-key-12345');
  91  |     expect(status).toBe(401);
  92  |     expect((body as ApiErrorResponse).detail).toBeTruthy();
  93  | 
  94  |     testResults.add({
  95  |       testId: 'M01-T03', module: moduleName,
  96  |       description: 'Invalid/random API key returns 401',
  97  |       status: 'PASS', latencyMs, timestamp: getTimestamp(),
  98  |     });
  99  |   } catch (err: any) {
  100 |     testResults.add({
  101 |       testId: 'M01-T03', module: moduleName,
  102 |       description: 'Invalid/random API key returns 401',
  103 |       status: 'FAIL', latencyMs: Date.now() - start,
  104 |       failureReason: err.message, timestamp: getTimestamp(),
  105 |     });
  106 |     throw err;
  107 |   }
  108 | });
  109 | 
  110 | test('M01-T04: Empty Bearer value returns 401', async () => {
  111 |   const start = Date.now();
  112 |   try {
  113 |     const { status, body, latencyMs } = await postAuth('');
  114 |     expect([400, 401]).toContain(status);
  115 |     expect((body as ApiErrorResponse).detail).toBeTruthy();
  116 | 
  117 |     testResults.add({
  118 |       testId: 'M01-T04', module: moduleName,
  119 |       description: 'Empty Bearer value returns 400/401',
  120 |       status: 'PASS', latencyMs, timestamp: getTimestamp(),
  121 |     });
  122 |   } catch (err: any) {
  123 |     testResults.add({
  124 |       testId: 'M01-T04', module: moduleName,
  125 |       description: 'Empty Bearer value returns 400/401',
  126 |       status: 'FAIL', latencyMs: Date.now() - start,
  127 |       failureReason: err.message, timestamp: getTimestamp(),
  128 |     });
  129 |     throw err;
  130 |   }
  131 | });
  132 | 
  133 | test('M01-T05: AuthClient caching and refresh works', async () => {
```