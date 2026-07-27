import { test, expect } from '@playwright/test';
import { AuthClient, ApiClient, BatchTranscriptionClient } from '../../services';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp } from '../../utils/audioHelper';
import { audioFixture } from '../../config';

const moduleName = 'CombinationScenarios';

let batchClient: BatchTranscriptionClient;

test.beforeAll(() => {
  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  batchClient = new BatchTranscriptionClient(apiClient);
});

test('M14-T01: All params simultaneously (diarize + num_speakers + verbose_json + language)', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'), {
      language_code: 'en',
      diarize: true,
      num_speakers: 2,
      response_format: 'verbose_json',
    });
    expect(result.status).toBe(200);
    expect((result.body as any).text).toBeTruthy();
    expect((result.body as any).segments).toBeDefined();

    testResults.add({
      testId: 'M14-T01', module: moduleName,
      description: 'All params simultaneously (diarize+num+verbose+lang)',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M14-T01', module: moduleName,
      description: 'All params simultaneously',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M14-T02: num_speakers + response_format=json (diarize without verbose_json)', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'), {
      diarize: true,
      num_speakers: 2,
      response_format: 'json',
    });
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M14-T02', module: moduleName,
      description: 'diarize+num_speakers+response_format=json',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M14-T02', module: moduleName,
      description: 'diarize+num_speakers+response_format=json',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M14-T03: Non-English + diarization + word boosting', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'), {
      language_code: 'hi',
      diarize: true,
      boost_phrases: 'प्रौद्योगिकी',
      response_format: 'verbose_json',
    });
    expect(result.status).toBe(200);
    expect((result.body as any).text).toBeTruthy();

    testResults.add({
      testId: 'M14-T03', module: moduleName,
      description: 'Non-English + diarization + word boosting',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M14-T03', module: moduleName,
      description: 'Non-English + diarization + word boosting',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M14-T04: Profanity filter + verbose_json response', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('profane'), {
      profanity_filter: true,
      response_format: 'verbose_json',
    });
    expect(result.status).toBe(200);
    expect((result.body as any).text).toBeTruthy();

    testResults.add({
      testId: 'M14-T04', module: moduleName,
      description: 'Profanity filter + verbose_json',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M14-T04', module: moduleName,
      description: 'Profanity filter + verbose_json',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M14-T05: Invalid param value among valid params', async () => {
  const start = Date.now();
  try {
    await batchClient.transcribeFile(audioFixture('wav'), {
      language_code: 'en',
      num_speakers: -1, // invalid
    });
    testResults.add({
      testId: 'M14-T05', module: moduleName,
      description: 'Invalid param among valid params returns error',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: 'Expected error for invalid num_speakers', timestamp: getTimestamp(),
    });
  } catch (err: any) {
    expect(err.statusCode).toBe(400);
    testResults.add({
      testId: 'M14-T05', module: moduleName,
      description: 'Invalid param among valid params returns 400',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  }
});

test('M14-T06: Base64 audio + all parameters', async () => {
  const start = Date.now();
  try {
    const audioData = require('fs').readFileSync(audioFixture('wav'));
    const base64 = audioData.toString('base64');

    const result = await batchClient.transcribeBase64(base64, {
      language_code: 'en',
      diarize: true,
      response_format: 'verbose_json',
    });
    expect(result.status).toBe(200);
    expect((result.body as any).text).toBeTruthy();

    testResults.add({
      testId: 'M14-T06', module: moduleName,
      description: 'Base64 audio + all parameters',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M14-T06', module: moduleName,
      description: 'Base64 audio + all parameters',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});
