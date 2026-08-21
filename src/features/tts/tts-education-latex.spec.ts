import { test, expect } from '@playwright/test';
import { TtsClient } from '../../services/TtsClient';
import { AUTH_CONFIG } from '../../config';

test.describe('TTS - Education with LaTeX Processing', () => {
  let ttsClient: TtsClient;

  test.beforeAll(() => {
    test.skip(!AUTH_CONFIG.apiKey, 'Skipping: ASR_API_KEY is not configured');
    ttsClient = new TtsClient();
  });

  test('TTS_LATEX_01: Synthesize math problem with algebraic expression', async () => {
    const res = await ttsClient.synthesize({
      text: 'If $x^2 = 49$, what is the value of x?',
      voice: 'Meera',
      latex: true,
      language: 'en',
    });

    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(1000);

    // Verify WAV format header
    expect(res.data.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(res.data.subarray(8, 12).toString('ascii')).toBe('WAVE');
  });

  test('TTS_LATEX_02: Synthesize fraction and quadratic equation with LaTeX', async () => {
    const res = await ttsClient.synthesize({
      text: 'Solve the quadratic formula $\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$ for roots.',
      voice: 'Meera',
      latex: true,
      language: 'en',
    });

    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(1000);
  });

  test('TTS_LATEX_03: Synthesize Hindi mathematics with LaTeX', async () => {
    const res = await ttsClient.synthesize({
      text: 'यदि $x + y = 10$ और $x - y = 2$ है, तो x का मान ज्ञात कीजिए।',
      voice: 'Arjun',
      latex: true,
      language: 'hi',
    });

    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(1000);
  });
});
