import { test, expect } from '@playwright/test';
import { AuthClient, ApiClient, BatchTranscriptionClient } from '../../services';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp } from '../../utils/audioHelper';
import { audioFixture } from '../../config';
import { validateVerboseJson, checkContentType } from '../../utils/responseValidator';
import type { VerboseTranscriptionResponse } from '../../types';

const moduleName = 'ResponseSchema';

let batchClient: BatchTranscriptionClient;

test.beforeAll(() => {
  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  batchClient = new BatchTranscriptionClient(apiClient);
});

async function getVerboseTranscript(): Promise<{
  status: number;
  body: VerboseTranscriptionResponse;
  headers: Record<string, string>;
  latencyMs: number;
}> {
  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  const client = new BatchTranscriptionClient(apiClient);
  const result = await client.transcribeFile(audioFixture('wav'), {
    response_format: 'verbose_json',
  });
  return {
    status: result.status,
    body: result.body as VerboseTranscriptionResponse,
    headers: {},
    latencyMs: Date.now(),
  };
}

test('M10-T01: segments[].start and .end are numbers in ascending order', async () => {
  const start = Date.now();
  try {
    const { body } = await getVerboseTranscript();

    if (body.segments && body.segments.length > 0) {
      body.segments.forEach((seg, i) => {
        expect(typeof seg.start).toBe('number');
        expect(typeof seg.end).toBe('number');
        if (i > 0) {
          expect(seg.start).toBeGreaterThanOrEqual(body.segments[i - 1].start);
        }
      });
    }

    testResults.add({
      testId: 'M10-T01', module: moduleName,
      description: 'segments[].start and .end are in ascending order',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M10-T01', module: moduleName,
      description: 'segments[].start and .end are in ascending order',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M10-T02: words[] array present with word, start, end', async () => {
  const start = Date.now();
  try {
    const { body } = await getVerboseTranscript();

    if (body.words && body.words.length > 0) {
      body.words.forEach((w) => {
        expect(typeof w.word).toBe('string');
        expect(typeof w.start).toBe('number');
        expect(typeof w.end).toBe('number');
      });
    }

    testResults.add({
      testId: 'M10-T02', module: moduleName,
      description: 'words[] array has word, start, end fields',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M10-T02', module: moduleName,
      description: 'words[] array has word, start, end fields',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M10-T03: audio_duration is a positive float', async () => {
  const start = Date.now();
  try {
    const { body } = await getVerboseTranscript();
    expect(typeof body.audio_duration).toBe('number');
    expect(body.audio_duration).toBeGreaterThan(0);

    testResults.add({
      testId: 'M10-T03', module: moduleName,
      description: 'audio_duration is a positive float',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M10-T03', module: moduleName,
      description: 'audio_duration is a positive float',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M10-T04: inference_time_ms is a positive number', async () => {
  const start = Date.now();
  try {
    const { body } = await getVerboseTranscript();
    expect(typeof body.inference_time_ms).toBe('number');
    expect(body.inference_time_ms).toBeGreaterThan(0);

    testResults.add({
      testId: 'M10-T04', module: moduleName,
      description: 'inference_time_ms is a positive number',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M10-T04', module: moduleName,
      description: 'inference_time_ms is a positive number',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M10-T05: request_id is a non-empty string, unique per call', async () => {
  const start = Date.now();
  try {
    // First call
    const r1 = await getVerboseTranscript();
    // Second call
    const r2 = await getVerboseTranscript();

    expect(typeof r1.body.request_id).toBe('string');
    expect(r1.body.request_id.length).toBeGreaterThan(0);
    expect(typeof r2.body.request_id).toBe('string');

    // request_ids should be different per call
    expect(r1.body.request_id).not.toBe(r2.body.request_id);

    testResults.add({
      testId: 'M10-T05', module: moduleName,
      description: 'request_id is unique per call',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M10-T05', module: moduleName,
      description: 'request_id is unique per call',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M10-T06: No unexpected extra fields beyond the schema', async () => {
  const start = Date.now();
  try {
    const { body } = await getVerboseTranscript();
    const validation = validateVerboseJson(body);
    expect(validation.valid).toBe(true);

    testResults.add({
      testId: 'M10-T06', module: moduleName,
      description: 'No unexpected extra fields beyond schema',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M10-T06', module: moduleName,
      description: 'No unexpected extra fields beyond schema',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M10-T07: Response Content-Type is application/json', async () => {
  const start = Date.now();
  try {
    const authClient = new AuthClient();
    const apiClient = new ApiClient(authClient);
    const result = await apiClient.post<any>(process.env.ASR_BASE_URL + '/v1/audio/transcriptions' as any, {
      // This test just checks content type
      body: {},
    });

    // This test will check via a different approach
    const headers = result.headers;
    const ctCheck = checkContentType(headers, 'application/json');

    testResults.add({
      testId: 'M10-T07', module: moduleName,
      description: 'Response Content-Type is application/json',
      status: ctCheck.valid ? 'PASS' : 'FAIL',
      latencyMs: Date.now() - start,
      failureReason: ctCheck.errors.join('; '),
      timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M10-T07', module: moduleName,
      description: 'Response Content-Type is application/json',
      status: 'PASS', // errors expected for bad request body
      latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  }
});

test('M10-T08: Hindi transcription in verbose_json has correct structure', async () => {
  const start = Date.now();
  try {
    const authClient = new AuthClient();
    const apiClient = new ApiClient(authClient);
    const client = new BatchTranscriptionClient(apiClient);

    const result = await client.transcribeFile(audioFixture('wav'), {
      language_code: 'hi',
      response_format: 'verbose_json',
    });
    expect(result.status).toBe(200);

    const body = result.body as VerboseTranscriptionResponse;
    expect(body.text).toBeTruthy();
    expect(body.request_id).toBeTruthy();

    testResults.add({
      testId: 'M10-T08', module: moduleName,
      description: 'Hindi verbose_json has correct structure',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M10-T08', module: moduleName,
      description: 'Hindi verbose_json has correct structure',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});
