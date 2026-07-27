import { test, expect } from '@playwright/test';
import { AuthClient, ApiClient, SpeechIntelligenceClient } from '../../services';
import { testResults } from '../../tests/helpers/testSetup';
import { getTimestamp } from '../../utils/audioHelper';

const moduleName = 'SpeechIntelligence';

let siClient: SpeechIntelligenceClient;

test.beforeAll(() => {
  const authClient = new AuthClient();
  const apiClient = new ApiClient(authClient);
  siClient = new SpeechIntelligenceClient(apiClient);
});

test('M17-T01: Intent detection returns valid intent label', async () => {
  const start = Date.now();
  try {
    const result = await siClient.analyze({
      text: 'I want to book a flight to Mumbai for tomorrow',
      enable_intent_detection: true,
    });
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.analysis?.intent).toBeTruthy();

    testResults.add({
      testId: 'M17-T01', module: moduleName,
      description: 'Intent detection returns valid intent label',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M17-T01', module: moduleName,
      description: 'Intent detection returns valid intent label',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M17-T02: Summarization returns condensed text', async () => {
  const start = Date.now();
  try {
    const result = await siClient.analyze({
      text: 'The patient presented with acute chest pain radiating to the left arm. ' +
        'Symptoms started approximately 2 hours ago. ECG shows ST elevation in leads V1-V4. ' +
        'Patient has a history of hypertension and diabetes. Administered aspirin and nitroglycerin. ' +
        'Recommended immediate cardiology consultation and possible angiography.',
      enable_summarization: true,
    });
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);

    testResults.add({
      testId: 'M17-T02', module: moduleName,
      description: 'Summarization returns condensed text',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M17-T02', module: moduleName,
      description: 'Summarization returns condensed text',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M17-T03: Sentiment analysis returns label and score', async () => {
  const start = Date.now();
  try {
    const result = await siClient.analyze({
      text: 'I am extremely disappointed with the service. The product arrived damaged and customer support was unhelpful.',
      enable_sentiment_analysis: true,
    });
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
    expect(result.body.analysis?.sentiment).toBeTruthy();

    testResults.add({
      testId: 'M17-T03', module: moduleName,
      description: 'Sentiment analysis returns label and score',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M17-T03', module: moduleName,
      description: 'Sentiment analysis returns label and score',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M17-T04: All three flags simultaneously', async () => {
  const start = Date.now();
  try {
    const result = await siClient.analyze({
      text: 'Please schedule a meeting with the engineering team for next Tuesday at 2 PM to discuss the Q3 roadmap.',
      enable_intent_detection: true,
      enable_summarization: true,
      enable_sentiment_analysis: true,
    });
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);

    testResults.add({
      testId: 'M17-T04', module: moduleName,
      description: 'All three analysis flags simultaneously',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M17-T04', module: moduleName,
      description: 'All three analysis flags simultaneously',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M17-T05: Empty text returns 400', async () => {
  const start = Date.now();
  try {
    await siClient.analyze({
      text: '',
      enable_intent_detection: true,
    });
    testResults.add({
      testId: 'M17-T05', module: moduleName,
      description: 'Empty text returns 400',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: 'Expected error but got success', timestamp: getTimestamp(),
    });
  } catch (err: any) {
    expect(err.statusCode).toBe(400);
    testResults.add({
      testId: 'M17-T05', module: moduleName,
      description: 'Empty text returns 400',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  }
});

test('M17-T06: Very long text with summarization', async () => {
  const start = Date.now();
  try {
    const longText = 'This is a test. '.repeat(500); // ~7500 chars
    const result = await siClient.analyze({
      text: longText,
      enable_summarization: true,
    });
    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);

    testResults.add({
      testId: 'M17-T06', module: moduleName,
      description: 'Very long text with summarization',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M17-T06', module: moduleName,
      description: 'Very long text with summarization',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});

test('M17-T07: Missing auth returns 401', async () => {
  const start = Date.now();
  try {
    const url = `${process.env.ASR_BASE_URL || 'https://asrv2prod.shunyalabs.ai'}/v1/speechintelligence`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ text: 'test', enable_intent_detection: true }),
    });

    expect(response.status).toBe(401);

    testResults.add({
      testId: 'M17-T07', module: moduleName,
      description: 'Missing auth returns 401',
      status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
    });
  } catch (err: any) {
    testResults.add({
      testId: 'M17-T07', module: moduleName,
      description: 'Missing auth returns 401',
      status: 'FAIL', latencyMs: Date.now() - start,
      failureReason: err.message, timestamp: getTimestamp(),
    });
    throw err;
  }
});
