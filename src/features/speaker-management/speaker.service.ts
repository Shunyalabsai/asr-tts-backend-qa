import * as fs from 'fs';
import * as path from 'path';
import { ApiClient } from '../../services/ApiClient';
import { ENDPOINTS } from '../../config';
import type { SpeakerRegisterResponse, SpeakerDeleteResponse, SpeakerDeleteParams } from '../../types';

export class SpeakerClient {
  constructor(private apiClient: ApiClient) {}

  async register(
    name: string,
    audioFilePath: string,
    project?: string
  ): Promise<{
    status: number;
    body: SpeakerRegisterResponse;
    latencyMs: number;
  }> {
    const absolutePath = path.isAbsolute(audioFilePath)
      ? audioFilePath
      : path.resolve(process.cwd(), audioFilePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Audio file not found: ${absolutePath}`);
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const fileBlob = new Blob([fileBuffer], { type: 'audio/wav' });
    const fileName = path.basename(absolutePath);

    const formData: Record<string, any> = {
      name,
      file: new File([fileBlob], fileName, { type: 'audio/wav' }),
    };
    if (project) formData.project = project;

    const response = await this.apiClient.post<SpeakerRegisterResponse>(
      ENDPOINTS.speakers.register,
      { formData }
    );

    return {
      status: response.status,
      body: response.body,
      latencyMs: response.latencyMs,
    };
  }

  async deleteSpeaker(
    params: SpeakerDeleteParams
  ): Promise<{
    status: number;
    body: SpeakerDeleteResponse;
    latencyMs: number;
  }> {
    // DELETE with form body
    const response = await this.apiClient.delete<SpeakerDeleteResponse>(
      `${ENDPOINTS.speakers.delete}?name=${encodeURIComponent(params.name)}${params.project ? `&project=${encodeURIComponent(params.project)}` : ''}`
    );

    return {
      status: response.status,
      body: response.body,
      latencyMs: response.latencyMs,
    };
  }
}
