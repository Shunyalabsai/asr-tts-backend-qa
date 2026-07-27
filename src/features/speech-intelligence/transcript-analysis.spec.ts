import { test, expect } from '@playwright/test';
import { AuthClient, ApiClient, SpeechIntelligenceClient } from '../../services';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp } from '../../utils/audioHelper';

const moduleName = 'TranscriptAnalysis';

let siClient: SpeechIntelligenceClient;

test.beforeAll(() => {
  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  siClient = new SpeechIntelligenceClient(apiClient);
});

test('M08-T01: enable_intent_detection=true returns intent analysis', async () => {
  const start = Date.now();
  try {
    const result = await siClient.analyze({
      text: 'I want to book a flight to Mumbai for tomorrow',
      enable_intent_detection: true,
    });
    expect(result.status).toBe(200);
    expect(result.body.analysis?.intent).toBeTruthy();

    testResults.add({
      testId: 'M08-T01', module: moduleName,
      description: 'enable_intent_detection returns intent analysis',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M08-T01', module: moduleName,
      description: 'enable_intent_detection returns intent analysis',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M08-T02: All analysis flags omitted (default behavior)', async () => {
  const start = Date.now();
  try {
    const result = await siClient.analyze({
      text: 'What is the weather like today?',
    });
    expect(result.status).toBe(200);
    expect(result.body.text).toBeTruthy();

    testResults.add({
      testId: 'M08-T02', module: moduleName,
      description: 'All analysis flags omitted returns text',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M08-T02', module: moduleName,
      description: 'All analysis flags omitted returns text',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M08-T03: enable_sentiment_analysis=true returns sentiment', async () => {
  const start = Date.now();
  try {
    const result = await siClient.analyze({
      text: 'I am very happy with the service, it was excellent!',
      enable_sentiment_analysis: true,
    });
    expect(result.status).toBe(200);
    expect(result.body.analysis?.sentiment).toBeTruthy();

    testResults.add({
      testId: 'M08-T03', module: moduleName,
      description: 'enable_sentiment_analysis returns sentiment',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M08-T03', module: moduleName,
      description: 'enable_sentiment_analysis returns sentiment',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M08-T04: Empty text returns 400', async () => {
  const start = Date.now();
  try {
    await siClient.analyze({
      text: '',
      enable_intent_detection: true,
    });
    testResults.add({
      testId: 'M08-T04', module: moduleName,
      description: 'Empty text returns 400',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: 'Expected error but got success', timestamp: getTimestamp(),
    });
  } catch (err: any) {
    expect(err.statusCode).toBe(400);
    testResults.add({
      testId: 'M08-T04', module: moduleName,
      description: 'Empty text returns 400',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  }
});
