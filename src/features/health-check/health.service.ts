import { ApiClient } from '../../services/ApiClient';
import { ASR_BASE_URL, ENDPOINTS, TIMEOUTS } from '../../config';
import type { HealthResponse } from '../../types';

export class HealthClient {
  constructor(private apiClient: ApiClient) {}

  async check(): Promise<{
    status: number;
    body: HealthResponse;
    latencyMs: number;
  }> {
    const response = await this.apiClient.requestWithoutAuth<HealthResponse>(
      `${ASR_BASE_URL}${ENDPOINTS.health}`,
      'GET',
      { timeout: TIMEOUTS.health }
    );

    return {
      status: response.status,
      body: response.body,
      latencyMs: response.latencyMs,
    };
  }
}
