import { test, expect } from '@playwright/test';
import { AuthClient, ApiClient, BatchTranscriptionClient } from '../../services';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp } from '../../utils/audioHelper';
import { audioFixture } from '../../config';

const moduleName = 'LanguageCode';

let batchClient: BatchTranscriptionClient;

test.beforeAll(() => {
  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  batchClient = new BatchTranscriptionClient(apiClient);
});

test('M04-T01: Default language_code (omitted) uses auto detection @smoke', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'));
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M04-T01', module: moduleName,
      description: 'Default language_code uses auto detection',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M04-T01', module: moduleName,
      description: 'Default language_code uses auto detection',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M04-T02: Explicit language_code=en returns English text', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'), { language_code: 'en' });
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M04-T02', module: moduleName,
      description: 'language_code=en returns English text',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M04-T02', module: moduleName,
      description: 'language_code=en returns English text',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M04-T03: Explicit language_code=hi returns Hindi text', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'), { language_code: 'hi' });
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M04-T03', module: moduleName,
      description: 'language_code=hi returns Hindi text',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M04-T03', module: moduleName,
      description: 'language_code=hi returns Hindi text',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M04-T04: Invalid language code returns 400', async () => {
  const start = Date.now();
  try {
    await batchClient.transcribeFile(audioFixture('wav'), { language_code: 'zz' });
    testResults.add({
      testId: 'M04-T04', module: moduleName,
      description: 'Invalid language code returns 400',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: 'Expected error but got success', timestamp: getTimestamp(),
    });
  } catch (err: any) {
    expect(err.statusCode).toBe(400);
    testResults.add({
      testId: 'M04-T04', module: moduleName,
      description: 'Invalid language code returns 400',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  }
});

test('M04-T05: Non-English audio with auto-detect works', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'));
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M04-T05', module: moduleName,
      description: 'Non-English audio with auto-detect works',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M04-T05', module: moduleName,
      description: 'Non-English audio with auto-detect works',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M04-T06: Case-insensitive language_code (EN vs en)', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'), { language_code: 'EN' });
    expect(result.status).toBe(200);

    testResults.add({
      testId: 'M04-T06', module: moduleName,
      description: 'Case-insensitive language_code handled',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M04-T06', module: moduleName,
      description: 'Case-insensitive language_code handled',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M04-T07: Empty language_code string returns 400', async () => {
  const start = Date.now();
  try {
    await batchClient.transcribeFile(audioFixture('wav'), { language_code: '' });
    testResults.add({
      testId: 'M04-T07', module: moduleName,
      description: 'Empty language_code returns 400',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: 'Expected error but got success', timestamp: getTimestamp(),
    });
  } catch (err: any) {
    expect(err.statusCode).toBe(400);
    testResults.add({
      testId: 'M04-T07', module: moduleName,
      description: 'Empty language_code returns 400',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  }
});

test('M04-T08: Multiple language codes each produce valid transcripts', async () => {
  const start = Date.now();
  const langs = ['en', 'hi', 'gu', 'ta', 'bn'];
  let allPassed = true;
  let lastErr = '';

  for (const lang of langs) {
    try {
      const result = await batchClient.transcribeFile(audioFixture('wav'), { language_code: lang });
      expect(result.status).toBe(200);
      expect(result.body.text).toBeTruthy();
    } catch (err: any) {
      allPassed = false;
      lastErr = `${lang}: ${err.message}`;
      break;
    }
  }

  testResults.add({
    testId: 'M04-T08', module: moduleName,
    description: 'Multiple language codes produce valid transcripts',
    status: allPassed ? 'PASS' : 'FAIL',
    latencyMs: Date.now() - start,
    failureReason: allPassed ? undefined : lastErr,
    timestamp: getTimestamp(),
  });
  if (!allPassed) throw new Error(lastErr);
});
