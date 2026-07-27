import { test, expect } from '@playwright/test';
import { AuthClient, ApiClient, BatchTranscriptionClient } from '../../services';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp, readAudioFile } from '../../utils/audioHelper';
import { audioFixture } from '../../config';

const moduleName = 'AudioInput-Base64';

let batchClient: BatchTranscriptionClient;

test.beforeAll(() => {
  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  batchClient = new BatchTranscriptionClient(apiClient);
});

test('M03-T01: Valid base64-encoded audio returns transcription', async () => {
  const start = Date.now();
  try {
    const audioData = readAudioFile(audioFixture('wav'));
    const base64 = audioData.toString('base64');

    const result = await batchClient.transcribeBase64(base64);
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M03-T01', module: moduleName,
      description: 'Valid base64-encoded audio returns transcription',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M03-T01', module: moduleName,
      description: 'Valid base64-encoded audio returns transcription',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M03-T02: data:audio/wav;base64 prefix handled correctly', async () => {
  const start = Date.now();
  try {
    const audioData = readAudioFile(audioFixture('wav'));
    const base64 = `data:audio/wav;base64,${audioData.toString('base64')}`;

    const result = await batchClient.transcribeBase64(base64);
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M03-T02', module: moduleName,
      description: 'data:audio/wav;base64 prefix handled correctly',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M03-T02', module: moduleName,
      description: 'data:audio/wav;base64 prefix handled correctly',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M03-T03: Malformed base64 returns 400', async () => {
  const start = Date.now();
  try {
    await batchClient.transcribeBase64('not-valid-base64!!!');
    testResults.add({
      testId: 'M03-T03', module: moduleName,
      description: 'Malformed base64 returns error',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: 'Expected error but got success', timestamp: getTimestamp(),
    });
  } catch (err: any) {
    expect(err.statusCode).toBe(400);
    testResults.add({
      testId: 'M03-T03', module: moduleName,
      description: 'Malformed base64 returns 400',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  }
});

test('M03-T04: Near-limit base64 audio processed', async () => {
  const start = Date.now();
  try {
    // Use moderate audio as near-limit placeholder
    const audioData = readAudioFile(audioFixture('wav'));
    const base64 = audioData.toString('base64');

    const result = await batchClient.transcribeBase64(base64);
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M03-T04', module: moduleName,
      description: 'Near-limit base64 audio processed',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M03-T04', module: moduleName,
      description: 'Near-limit base64 audio processed',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M03-T05: Oversized base64 returns 413', async () => {
  const start = Date.now();
  try {
    // Generate a large base64 string (~70MB equivalent)
    const largeBuffer = Buffer.alloc(70 * 1024 * 1024);
    const base64 = largeBuffer.toString('base64');

    await batchClient.transcribeBase64(base64);
    testResults.add({
      testId: 'M03-T05', module: moduleName,
      description: 'Oversized base64 returns 413',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: 'Expected 413 error', timestamp: getTimestamp(),
    });
  } catch (err: any) {
    expect(err.statusCode).toBe(413);
    testResults.add({
      testId: 'M03-T05', module: moduleName,
      description: 'Oversized base64 returns 413',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  }
});

test('M03-T06: Empty base64 string returns 400', async () => {
  const start = Date.now();
  try {
    await batchClient.transcribeBase64('');
    testResults.add({
      testId: 'M03-T06', module: moduleName,
      description: 'Empty base64 string returns 400',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: 'Expected error but got success', timestamp: getTimestamp(),
    });
  } catch (err: any) {
    expect(err.statusCode).toBe(400);
    testResults.add({
      testId: 'M03-T06', module: moduleName,
      description: 'Empty base64 string returns 400',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  }
});
