import { test, expect } from '@playwright/test';
import { AuthClient, ApiClient, BatchTranscriptionClient } from '../../services';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp } from '../../utils/audioHelper';
import { audioFixture } from '../../config';
import { validateJsonResponse, checkContentType } from '../../utils/responseValidator';

const moduleName = 'ResponseFormat';

let batchClient: BatchTranscriptionClient;

test.beforeAll(() => {
  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  batchClient = new BatchTranscriptionClient(apiClient);
});

test('M05-T01: Default response_format returns json with only text field @smoke', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'));
    expect(result.status).toBe(200);

    const validation = validateJsonResponse(result.body);
    expect(validation.valid).toBe(true);

    testResults.add({
      testId: 'M05-T01', module: moduleName,
      description: 'Default response_format returns json with only text',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M05-T01', module: moduleName,
      description: 'Default response_format returns json with only text',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M05-T02: Explicit response_format=json returns only text', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'), { response_format: 'json' });
    expect(result.status).toBe(200);

    const validation = validateJsonResponse(result.body);
    expect(validation.valid).toBe(true);

    testResults.add({
      testId: 'M05-T02', module: moduleName,
      description: 'response_format=json returns only text',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M05-T02', module: moduleName,
      description: 'response_format=json returns only text',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M05-T03: response_format=verbose_json returns full schema', async () => {
  const start = Date.now();
  try {
    const result = await batchClient.transcribeFile(audioFixture('wav'), {
      response_format: 'verbose_json',
    });
    expect(result.status).toBe(200);

    const body = result.body as any;
    expect(body.text).toBeTruthy();
    expect(body.audio_duration).toBeDefined();
    expect(body.inference_time_ms).toBeDefined();
    expect(body.request_id).toBeDefined();
    expect(body.segments).toBeDefined();
    expect(Array.isArray(body.segments)).toBe(true);

    testResults.add({
      testId: 'M05-T03', module: moduleName,
      description: 'response_format=verbose_json returns full schema',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M05-T03', module: moduleName,
      description: 'response_format=verbose_json returns full schema',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M05-T04: Invalid response_format value returns 400', async () => {
  const start = Date.now();
  try {
    await batchClient.transcribeFile(audioFixture('wav'), {
      response_format: 'xml' as any,
    });
    testResults.add({
      testId: 'M05-T04', module: moduleName,
      description: 'Invalid response_format returns 400',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: 'Expected 400 error', timestamp: getTimestamp(),
    });
  } catch (err: any) {
    expect(err.statusCode).toBe(400);
    testResults.add({
      testId: 'M05-T04', module: moduleName,
      description: 'Invalid response_format returns 400',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  }
});
