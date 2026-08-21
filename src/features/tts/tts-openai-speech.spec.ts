import { test, expect } from '@playwright/test';
import { TtsClient } from '../../services/TtsClient';
import { AUTH_CONFIG } from '../../config';

test.describe('TTS - Voice Agent / OpenAI-Compatible Endpoint (/v1/audio/speech)', () => {
  let ttsClient: TtsClient;

  test.beforeAll(() => {
    test.skip(!AUTH_CONFIG.apiKey, 'Skipping: ASR_API_KEY is not configured');
    ttsClient = new TtsClient();
  });

  test('TTS_OPENAI_01: Synthesize with tts-1 model and Meera voice', async () => {
    const res = await ttsClient.createSpeech({
      model: 'tts-1',
      input: 'Voice agent integration test using OpenAI compatible endpoint.',
      voice: 'Meera',
      response_format: 'mp3',
    });

    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(500);
  });

  test('TTS_OPENAI_02: Synthesize raw PCM output for low-latency streaming pipeline', async () => {
    const res = await ttsClient.createSpeech({
      model: 'tts-1',
      input: 'Testing raw PCM output for voice agent audio pipelines.',
      voice: 'Meera',
      response_format: 'pcm',
    });

    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(1000);
  });

  test('TTS_OPENAI_03: Synthesize with OpenAI standard voice aliases (e.g. nova, alloy)', async () => {
    const res = await ttsClient.createSpeech({
      model: 'tts-1',
      input: 'Testing alias routing with nova voice.',
      voice: 'nova',
      response_format: 'mp3',
    });

    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(500);
  });

  test('TTS_OPENAI_04: Synthesize with speed parameter variations', async () => {
    const res = await ttsClient.createSpeech({
      model: 'tts-1',
      input: 'Speed test for voice agent pipeline.',
      voice: 'Meera',
      speed: 1.25,
    });

    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(500);
  });
});
