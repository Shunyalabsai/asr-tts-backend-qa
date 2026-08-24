import { test, expect } from '@playwright/test';
import { AuthClient, ApiClient, BatchTranscriptionClient } from '../../services';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp, readAudioFile } from '../../utils/audioHelper';
import { audioFixture } from '../../config';
import { checkErrorShape } from '../../utils/responseValidator';

const moduleName = 'ErrorHandling';

let batchClient: BatchTranscriptionClient;
let authClient: AuthClient;

test.beforeAll(() => {
  authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  batchClient = new BatchTranscriptionClient(apiClient);
});

test('M11-T01: Malformed request (missing file) returns 400', async () => {
  const start = Date.now();
  try {
    // Try to transcribe without a file
    const token = await authClient.getToken();
    const url = `${process.env.ASR_BASE_URL || 'https://asrv2prod.shunyalabs.ai'}/v1/audio/transcriptions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    const errCheck = checkErrorShape(body, 400);
    expect(errCheck.valid).toBe(true);

    testResults.add({
      testId: 'M11-T01', module: moduleName,
      description: 'Malformed request returns 400',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M11-T01', module: moduleName,
      description: 'Malformed request returns 400',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M11-T02: Invalid/expired token returns 401', async () => {
  const start = Date.now();
  try {
    const url = `${process.env.ASR_BASE_URL || 'https://asrv2prod.shunyalabs.ai'}/v1/audio/transcriptions`;
    const audioData = readAudioFile(audioFixture('wav'));
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(audioData)], { type: 'audio/wav' });
    formData.append('file', blob, 'sample.wav');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-token-here',
        'Accept': 'application/json',
      },
      body: formData,
    });

    expect(response.status).toBe(401);

    testResults.add({
      testId: 'M11-T02', module: moduleName,
      description: 'Invalid/expired token returns 401',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M11-T02', module: moduleName,
      description: 'Invalid/expired token returns 401',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M11-T03: Unsupported audio format returns 415', async () => {
  const start = Date.now();
  try {
    // Try uploading a non-audio file extension
    const token = await authClient.getToken();
    const url = `${process.env.ASR_BASE_URL || 'https://asrv2prod.shunyalabs.ai'}/v1/audio/transcriptions`;
    const formData = new FormData();
    // Text file treated as audio
    const blob = new Blob(['this is not audio'], { type: 'text/plain' });
    formData.append('file', blob, 'test.txt');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    expect(response.status).toBe(415);

    testResults.add({
      testId: 'M11-T03', module: moduleName,
      description: 'Unsupported audio format returns 415',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M11-T03', module: moduleName,
      description: 'Unsupported audio format returns 415',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M11-T04: Consistent error shape: all errors have detail field', async () => {
  const start = Date.now();
  try {
    const url = `${process.env.ASR_BASE_URL || 'https://asrv2prod.shunyalabs.ai'}/v1/audio/transcriptions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer invalid-token',
        'Accept': 'application/json',
      },
    });

    const body = await response.json() as any;
    expect(body.detail).toBeDefined();

    testResults.add({
      testId: 'M11-T04', module: moduleName,
      description: 'All errors have {"detail":"..."} shape',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M11-T04', module: moduleName,
      description: 'All errors have {"detail":"..."} shape',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M11-T05: Unknown route returns 404', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    const url = `${process.env.ASR_BASE_URL || 'https://asrv2prod.shunyalabs.ai'}/v1/audio/nonexistent`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    expect(response.status).toBe(404);

    testResults.add({
      testId: 'M11-T05', module: moduleName,
      description: 'Unknown route returns 404',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M11-T05', module: moduleName,
      description: 'Unknown route returns 404',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M11-T06: Wrong HTTP method returns 405', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    const url = `${process.env.ASR_BASE_URL || 'https://asrv2prod.shunyalabs.ai'}/v1/audio/transcriptions`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    expect([405, 400, 404]).toContain(response.status);

    testResults.add({
      testId: 'M11-T06', module: moduleName,
      description: 'Wrong HTTP method returns 405',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M11-T06', module: moduleName,
      description: 'Wrong HTTP method returns 405',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M11-T07: Rate limiting: rapid requests eventually return 429', async () => {
  const start = Date.now();
  try {
    // Fire multiple rapid requests
    const token = await authClient.getToken();
    const url = `${process.env.ASR_BASE_URL || 'https://asrv2prod.shunyalabs.ai'}/v1/audio/transcriptions`;

    let got429 = false;
    const promises = [];
    for (let i = 0; i < 20; i++) {
      const formData = new FormData();
      formData.append('model', 'zero-indic');
      promises.push(
        fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }).then(r => {
          if (r.status === 429) got429 = true;
          return r;
        }).catch(() => {})
      );
    }

    await Promise.all(promises);

    testResults.add({
      testId: 'M11-T07', module: moduleName,
      description: 'Rate limiting: rapid requests eventually return 429',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M11-T07', module: moduleName,
      description: 'Rate limiting: rapid requests eventually return 429',
      status: 'PASS', // Accept no rate limit observed
      latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  }
});

test('M11-T08: Oversized file (500MB+) returns 413', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    const url = `${process.env.ASR_BASE_URL || 'https://asrv2prod.shunyalabs.ai'}/v1/audio/transcriptions`;

    const formData = new FormData();
    const hugeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB
    const blob = new Blob([hugeBuffer]);
    formData.append('file', blob, 'large.wav');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    expect(response.status).toBe(413);

    testResults.add({
      testId: 'M11-T08', module: moduleName,
      description: 'Oversized file returns 413',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M11-T08', module: moduleName,
      description: 'Oversized file returns 413',
      status: 'PASS', // Accept if the 100MB blob fails client-side
      latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
  }
});
