import { AuthClient } from './AuthClient';
import { TTS_BASE_URL, TTS_AUTH_URL, ENDPOINTS, TIMEOUTS, AUTH_CONFIG } from '../config';
import type {
  TtsSynthesizeParams,
  TtsOpenAiSpeechParams,
  TtsSynthesizeResponse,
  ApiErrorResponse,
} from '../types';

export class TtsError extends Error {
  public statusCode: number;
  public detail: string;

  constructor(detail: string, statusCode: number) {
    super(`TTS API error [${statusCode}]: ${detail}`);
    this.name = 'TtsError';
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

export interface TtsApiResponse<T> {
  status: number;
  data: T;
  latencyMs: number;
  ok: boolean;
  contentType: string;
  headers: Record<string, string>;
}

export class TtsClient {
  private authClient: AuthClient;
  private baseUrl: string;
  private defaultTimeout: number;

  constructor(
    authClient?: AuthClient,
    baseUrl?: string,
    defaultTimeout?: number
  ) {
    this.authClient =
      authClient ||
      new AuthClient(
        AUTH_CONFIG.apiKey,
        TTS_AUTH_URL,
        ENDPOINTS.tts.auth
      );
    this.baseUrl = baseUrl || TTS_BASE_URL;
    this.defaultTimeout = defaultTimeout || TIMEOUTS.api;
  }

  /**
   * Synthesize speech using Omni Voice endpoint (/v1/omni-voice/synthesize)
   */
  async synthesize(
    params: TtsSynthesizeParams,
    options: { timeout?: number; token?: string } = {}
  ): Promise<TtsApiResponse<Buffer>> {
    return this.postAudio(ENDPOINTS.tts.synthesize, params, options);
  }

  /**
   * Synthesize speech using OpenAI-compatible speech endpoint (/v1/audio/speech)
   */
  async createSpeech(
    params: TtsOpenAiSpeechParams,
    options: { timeout?: number; token?: string } = {}
  ): Promise<TtsApiResponse<Buffer>> {
    return this.postAudio(ENDPOINTS.tts.speech, params, options);
  }

  /**
   * Internal helper to make POST request and return audio binary buffer
   */
  private async postAudio(
    endpoint: string,
    bodyPayload: any,
    options: { timeout?: number; token?: string } = {}
  ): Promise<TtsApiResponse<Buffer>> {
    const token = options.token || (await this.authClient.getToken());
    const start = Date.now();
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': '*/*',
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout ?? this.defaultTimeout
    );

    try {
      let response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      let latencyMs = Date.now() - start;

      // Handle 401 retry with fresh token if caller didn't supply an explicit token
      if (response.status === 401 && !options.token) {
        const freshToken = await this.authClient.forceRefresh();
        headers['Authorization'] = `Bearer ${freshToken}`;
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload),
          signal: controller.signal,
        });
        latencyMs = Date.now() - start;
      }

      const contentType = response.headers.get('content-type') || '';
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      if (!response.ok) {
        let detail = `Request failed with status ${response.status}`;
        try {
          const errJson = (await response.json()) as ApiErrorResponse;
          if (errJson.detail) detail = errJson.detail;
        } catch {
          // ignore parsing error
        }
        return {
          status: response.status,
          data: Buffer.from(detail),
          latencyMs,
          ok: false,
          contentType,
          headers: responseHeaders,
        };
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return {
        status: response.status,
        data: buffer,
        latencyMs,
        ok: true,
        contentType,
        headers: responseHeaders,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new TtsError('TTS request timed out', 408);
      }
      throw new TtsError(err.message || 'TTS network error', 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
