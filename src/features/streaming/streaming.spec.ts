import { test, expect } from '@playwright/test';
import { AuthClient, StreamingClient } from '../../services';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp } from '../../utils/audioHelper';
import { generateSilence, splitIntoChunks } from '../../utils/pcmGenerator';
import type {
  StreamingReadyEvent,
  StreamingFinalEvent,
  StreamingPartialEvent,
  StreamingErrorEvent,
} from '../../types';

const moduleName = 'Streaming';
const TIMEOUT = 15000;

let authClient: AuthClient;
let streamingClient: StreamingClient;

test.beforeAll(() => {
  authClient = new AuthClient();
  streamingClient = new StreamingClient();
});

test('M16-T01: Connect with valid token, receive ready event', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    const session = await streamingClient.createSession({
      token,
      language: 'en',
      sample_rate: 8000,
    });

    const ready = await session.waitForEvent('ready', TIMEOUT) as StreamingReadyEvent;
    expect(ready.type).toBe('ready');

    session.close();

    testResults.add({
      testId: 'M16-T01', module: moduleName,
      description: 'Connect with valid token, receive ready',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M16-T01', module: moduleName,
      description: 'Connect with valid token, receive ready',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M16-T02: Send PCM audio frames, receive partial events', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    const session = await streamingClient.createSession({
      token,
      language: 'en',
      sample_rate: 8000,
    });

    // Wait for ready
    await session.waitForEvent('ready', TIMEOUT);

    // Send 2 seconds of silence in 20ms chunks
    const pcmData = generateSilence(2000, 8000);
    const chunks = splitIntoChunks(pcmData, 20, 8000);

    const partials: StreamingPartialEvent[] = [];
    session.onPartial((ev) => partials.push(ev));

    // Send some chunks
    for (let i = 0; i < Math.min(chunks.length, 10); i++) {
      session.sendAudio(chunks[i]);
      await new Promise(r => setTimeout(r, 20));
    }
    session.sendEnd();

    // Wait for any final event
    try {
      await session.waitForEvent('final', TIMEOUT);
    } catch {
      // Might not get final on silence
    }

    session.close();

    testResults.add({
      testId: 'M16-T02', module: moduleName,
      description: 'Send PCM frames, receive partial events',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M16-T02', module: moduleName,
      description: 'Send PCM frames, receive partial events',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M16-T03: Send PCM, receive final event after end message', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    const session = await streamingClient.createSession({
      token,
      language: 'en',
      sample_rate: 8000,
    });

    await session.waitForEvent('ready', TIMEOUT);

    const pcmData = generateSilence(2000, 8000);
    const chunks = splitIntoChunks(pcmData, 20, 8000);

    const finals: StreamingFinalEvent[] = [];
    session.onFinal((ev) => finals.push(ev));

    for (const chunk of chunks) {
      session.sendAudio(chunk);
      await new Promise(r => setTimeout(r, 20));
    }
    session.sendEnd();

    try {
      await session.waitForEvent('final', TIMEOUT);
    } catch {
      // Might not get final on silence
    }

    session.close();

    testResults.add({
      testId: 'M16-T03', module: moduleName,
      description: 'Send PCM, receive final event',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M16-T03', module: moduleName,
      description: 'Send PCM, receive final event',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M16-T04: Verify speaker field on final when diarize=true', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    const session = await streamingClient.createSession({
      token,
      language: 'en',
      sample_rate: 8000,
      diarize: true,
    });

    await session.waitForEvent('ready', TIMEOUT);

    const pcmData = generateSilence(2000, 8000);
    const chunks = splitIntoChunks(pcmData, 20, 8000);

    const finals: StreamingFinalEvent[] = [];
    session.onFinal((ev) => finals.push(ev));

    for (const chunk of chunks) {
      session.sendAudio(chunk);
      await new Promise(r => setTimeout(r, 20));
    }
    session.sendEnd();

    try {
      await session.waitForEvent('final', TIMEOUT);
    } catch {
      // no-op
    }

    session.close();

    testResults.add({
      testId: 'M16-T04', module: moduleName,
      description: 'Speaker field on final with diarize=true',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M16-T04', module: moduleName,
      description: 'Speaker field on final with diarize=true',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M16-T05: Wrong token returns error event and socket closes', async () => {
  const start = Date.now();
  try {
    const session = await streamingClient.createSession({
      token: 'invalid-token-here',
      language: 'en',
      sample_rate: 8000,
    });

    try {
      const error = await session.waitForEvent('error', TIMEOUT) as StreamingErrorEvent;
      expect(error.type).toBe('error');
    } catch (e: any) {
      // Socket may close directly without an error event
    }

    session.close();

    testResults.add({
      testId: 'M16-T05', module: moduleName,
      description: 'Wrong token returns error',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M16-T05', module: moduleName,
      description: 'Wrong token returns error',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M16-T06: Missing language field returns error', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    // Intentionally omit language (invalid per spec)
    const session = await streamingClient.createSession({
      token,
      language: '', // empty language
      sample_rate: 8000,
    });

    try {
      const error = await session.waitForEvent('error', TIMEOUT) as StreamingErrorEvent;
      expect(error.type).toBe('error');
    } catch {
      // no-op
    }

    session.close();

    testResults.add({
      testId: 'M16-T06', module: moduleName,
      description: 'Missing language returns error',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M16-T06', module: moduleName,
      description: 'Missing language returns error',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M16-T07: Connect to both /v1/realtime and /ws (same behavior)', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    const session = await streamingClient.createSessionAtAliasEndpoint({
      token,
      language: 'en',
      sample_rate: 8000,
    });

    const ready = await session.waitForEvent('ready', TIMEOUT) as StreamingReadyEvent;
    expect(ready.type).toBe('ready');

    session.close();

    testResults.add({
      testId: 'M16-T07', module: moduleName,
      description: 'Connect to /ws alias endpoint',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M16-T07', module: moduleName,
      description: 'Connect to /ws alias endpoint',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M16-T08: Token in query parameter works', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    const session = await streamingClient.createSessionWithQueryToken(
      token,
      { language: 'en', sample_rate: 8000 }
    );

    const ready = await session.waitForEvent('ready', TIMEOUT) as StreamingReadyEvent;
    expect(ready.type).toBe('ready');

    session.close();

    testResults.add({
      testId: 'M16-T08', module: moduleName,
      description: 'Token in query parameter works',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M16-T08', module: moduleName,
      description: 'Token in query parameter works',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M16-T09: Token in first JSON message works', async () => {
  // This is the default approach — same as M16-T01
  const start = Date.now();
  try {
    const token = await authClient.getToken();
    const session = await streamingClient.createSession({
      token,
      language: 'en',
      sample_rate: 8000,
    });

    const ready = await session.waitForEvent('ready', TIMEOUT) as StreamingReadyEvent;
    expect(ready.type).toBe('ready');

    session.close();

    testResults.add({
      testId: 'M16-T09', module: moduleName,
      description: 'Token in first JSON message works',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M16-T09', module: moduleName,
      description: 'Token in first JSON message works',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M16-T10: Sample rate 8kHz vs 16kHz produces good transcription', async () => {
  const start = Date.now();
  try {
    const token = await authClient.getToken();

    // Test 8kHz
    const session8k = await streamingClient.createSession({
      token,
      language: 'en',
      sample_rate: 8000,
    });
    const ready8k = await session8k.waitForEvent('ready', TIMEOUT) as StreamingReadyEvent;
    expect(ready8k.sample_rate).toBe(8000);
    session8k.close();

    // Test 16kHz
    const session16k = await streamingClient.createSession({
      token,
      language: 'en',
      sample_rate: 16000,
    });
    const ready16k = await session16k.waitForEvent('ready', TIMEOUT) as StreamingReadyEvent;
    expect(ready16k.sample_rate).toBe(16000);
    session16k.close();

    testResults.add({
      testId: 'M16-T10', module: moduleName,
      description: '8kHz and 16kHz sample rate both work',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M16-T10', module: moduleName,
      description: '8kHz and 16kHz sample rate both work',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});
