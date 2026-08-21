import { test, expect } from '@playwright/test';
import { TtsClient } from '../../services/TtsClient';
import { AUTH_CONFIG } from '../../config';

test.describe('TTS - Negative Testing & Error Handling', () => {
  let ttsClient: TtsClient;

  test.beforeAll(() => {
    ttsClient = new TtsClient();
  });

  test('TTS_ERR_01: Request without authentication returns 401', async () => {
    const res = await ttsClient.synthesize(
      {
        text: 'Unauthorized request test.',
        voice: 'Meera',
      },
      { token: 'invalid-or-missing-token' }
    );

    expect(res.status).toBe(401);
    expect(res.ok).toBe(false);
  });

  test('TTS_ERR_02: Empty text input returns 400 or 422 Bad Request', async () => {
    test.skip(!AUTH_CONFIG.apiKey, 'Skipping: ASR_API_KEY is not configured');

    const res = await ttsClient.synthesize({
      text: '',
      voice: 'Meera',
    });

    expect([400, 422]).toContain(res.status);
    expect(res.ok).toBe(false);
  });

  test('TTS_ERR_03: OpenAI speech endpoint without input returns 400 or 422', async () => {
    test.skip(!AUTH_CONFIG.apiKey, 'Skipping: ASR_API_KEY is not configured');

    const res = await ttsClient.createSpeech({
      model: 'tts-1',
      input: '',
      voice: 'Meera',
    });

    expect([400, 422]).toContain(res.status);
    expect(res.ok).toBe(false);
  });
});
