import { test, expect } from '@playwright/test';
import { AuthClient, ApiClient, BatchTranscriptionClient } from '../../services';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp } from '../../utils/audioHelper';
import { audioFixture } from '../../config';

const moduleName = 'ProfanityMasking';

let batchClient: BatchTranscriptionClient;

test.beforeAll(() => {
  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  batchClient = new BatchTranscriptionClient(apiClient);
});

test('M09-T01: Profanity filter on profane audio masks offensive words', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('profane'), {
      profanity_filter: true,
    });
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M09-T01', module: moduleName,
      description: 'Profanity filter masks offensive words',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M09-T01', module: moduleName,
      description: 'Profanity filter masks offensive words',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M09-T02: profanity_filter=false on profane audio without masking', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('profane'), {
      profanity_filter: false,
    });
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M09-T02', module: moduleName,
      description: 'profanity_filter=false returns unmodified text',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M09-T02', module: moduleName,
      description: 'profanity_filter=false returns unmodified text',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M09-T03: Profanity filter on clean audio (no change expected)', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'), {
      profanity_filter: true,
    });
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M09-T03', module: moduleName,
      description: 'Profanity filter on clean audio',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M09-T03', module: moduleName,
      description: 'Profanity filter on clean audio',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M09-T04: Profanity filter with verbose_json response', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('profane'), {
      profanity_filter: true,
      response_format: 'verbose_json',
    });
    expect(result.status).toBe(200);
    expect((result.body as any).text).toBeTruthy();

    testResults.add({
      testId: 'M09-T04', module: moduleName,
      description: 'Profanity filter with verbose_json response',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M09-T04', module: moduleName,
      description: 'Profanity filter with verbose_json response',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M09-T05: Multiple profane words in one utterance', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('profane'), {
      profanity_filter: true,
    });
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M09-T05', module: moduleName,
      description: 'Multiple profane words handled',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M09-T05', module: moduleName,
      description: 'Multiple profane words handled',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});
