import { test, expect } from '@playwright/test';
import { TtsClient } from '../../services/TtsClient';
import { AUTH_CONFIG } from '../../config';

test.describe('TTS - Standard Omni Voice Synthesis', () => {
  let ttsClient: TtsClient;

  test.beforeAll(() => {
    test.skip(!AUTH_CONFIG.apiKey, 'Skipping: ASR_API_KEY is not configured');
    ttsClient = new TtsClient();
  });

  test('TTS_01: Synthesize English speech with default voice (Meera)', async () => {
    const res = await ttsClient.synthesize({
      text: 'Hello, welcome to Shunya Labs speech synthesis.',
      voice: 'Meera',
    });

    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(1000);
    expect(res.contentType).toContain('audio');

    // Verify WAV RIFF header
    const riff = res.data.subarray(0, 4).toString('ascii');
    const wave = res.data.subarray(8, 12).toString('ascii');
    expect(riff).toBe('RIFF');
    expect(wave).toBe('WAVE');
  });

  test('TTS_02: Synthesize Hindi speech with named voice (Arjun)', async () => {
    const res = await ttsClient.synthesize({
      text: 'नमस्ते, शून्या लैब्स में आपका स्वागत है।',
      voice: 'Arjun',
      language: 'hi',
    });

    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.data.length).toBeGreaterThan(1000);
  });

  test('TTS_03: Synthesize with different supported voices', async () => {
    const voices = ['Meera', 'Arushi', 'Kabir', 'Nisha'];
    for (const voice of voices) {
      const res = await ttsClient.synthesize({
        text: `Testing voice rendering for ${voice}.`,
        voice,
      });
      expect(res.status).toBe(200);
      expect(res.ok).toBe(true);
      expect(res.data.length).toBeGreaterThan(500);
    }
  });

  test('TTS_04: Synthesize with different response formats (wav, mp3, flac, pcm)', async () => {
    // WAV
    const wavRes = await ttsClient.synthesize({
      text: 'Testing audio format response.',
      voice: 'Meera',
      response_format: 'wav',
    });
    expect(wavRes.status).toBe(200);
    expect(wavRes.data.subarray(0, 4).toString('ascii')).toBe('RIFF');

    // MP3
    const mp3Res = await ttsClient.synthesize({
      text: 'Testing audio format response in MP3.',
      voice: 'Meera',
      response_format: 'mp3',
    });
    expect(mp3Res.status).toBe(200);
    expect(mp3Res.data.length).toBeGreaterThan(500);

    // PCM
    const pcmRes = await ttsClient.synthesize({
      text: 'Testing audio format response in raw PCM.',
      voice: 'Meera',
      response_format: 'pcm',
    });
    expect(pcmRes.status).toBe(200);
    expect(pcmRes.data.length).toBeGreaterThan(500);
  });

  test('TTS_05: Synthesize with speed adjustment parameter', async () => {
    const normalRes = await ttsClient.synthesize({
      text: 'The quick brown fox jumps over the lazy dog.',
      voice: 'Meera',
      speed: 1.0,
    });
    expect(normalRes.status).toBe(200);

    const fastRes = await ttsClient.synthesize({
      text: 'The quick brown fox jumps over the lazy dog.',
      voice: 'Meera',
      speed: 1.5,
    });
    expect(fastRes.status).toBe(200);
    expect(fastRes.data.length).toBeGreaterThan(500);
  });
});
