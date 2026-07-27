import { ApiClient } from '../../services/ApiClient';
import { ENDPOINTS } from '../../config';
import type { SpeechIntelligenceParams, SpeechIntelligenceResponse } from '../../types';

export class SpeechIntelligenceClient {
  constructor(private apiClient: ApiClient) {}

  async analyze(
    params: SpeechIntelligenceParams
  ): Promise<{
    status: number;
    body: SpeechIntelligenceResponse;
    latencyMs: number;
  }> {
    const response = await this.apiClient.post<SpeechIntelligenceResponse>(
      ENDPOINTS.speechIntelligence,
      { body: params }
    );

    return {
      status: response.status,
      body: response.body,
      latencyMs: response.latencyMs,
    };
  }
}
