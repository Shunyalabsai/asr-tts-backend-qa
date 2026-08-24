import * as fs from 'fs';
import * as path from 'path';
import { ApiClient } from '../../services/ApiClient';
import { ENDPOINTS } from '../../config';
import type {
  TranscriptionParams,
  TranscriptionResponse,
  VerboseTranscriptionResponse,
} from '../../types';

export class BatchTranscriptionClient {
  constructor(private apiClient: ApiClient) {}

  async transcribeFile(
    filePath: string,
    params?: Omit<TranscriptionParams, 'file' | 'audio_base64' | 'url'>
  ): Promise<{
    status: number;
    body: TranscriptionResponse | VerboseTranscriptionResponse;
    latencyMs: number;
  }> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Audio file not found: ${absolutePath}`);
    }

    const fileBuffer = fs.readFileSync(absolutePath);
    const fileName = path.basename(absolutePath);
    const fileBlob = new Blob([fileBuffer], { type: this.mimeType(fileName) });

    const formData: Record<string, any> = { file: fileBlob };
    if (params?.model) formData.model = params.model;
    if (params?.language_code) formData.language_code = params.language_code;
    if (params?.diarize !== undefined) formData.diarize = String(params.diarize);
    if (params?.num_speakers !== undefined) formData.num_speakers = String(params.num_speakers);
    if (params?.response_format) formData.response_format = params.response_format;
    if (params?.boost_phrases) formData.boost_phrases = params.boost_phrases;
    if (params?.boost_weight !== undefined) formData.boost_weight = String(params.boost_weight);
    if (params?.profanity_filter !== undefined) formData.profanity_filter = String(params.profanity_filter);

    const response = await this.apiClient.post<TranscriptionResponse | VerboseTranscriptionResponse>(
      ENDPOINTS.transcription,
      { formData, timeout: 25000 }
    );

    return {
      status: response.status,
      body: response.body,
      latencyMs: response.latencyMs,
    };
  }

  async transcribeBase64(
    audioBase64: string,
    params?: Omit<TranscriptionParams, 'file' | 'audio_base64' | 'url'>
  ): Promise<{
    status: number;
    body: TranscriptionResponse | VerboseTranscriptionResponse;
    latencyMs: number;
  }> {
    const formData: Record<string, any> = { audio_base64: audioBase64 };
    if (params?.model) formData.model = params.model;
    if (params?.language_code) formData.language_code = params.language_code;
    if (params?.diarize !== undefined) formData.diarize = String(params.diarize);
    if (params?.num_speakers !== undefined) formData.num_speakers = String(params.num_speakers);
    if (params?.response_format) formData.response_format = params.response_format;

    const response = await this.apiClient.post<TranscriptionResponse | VerboseTranscriptionResponse>(
      ENDPOINTS.transcription,
      { formData, timeout: 25000 }
    );

    return {
      status: response.status,
      body: response.body,
      latencyMs: response.latencyMs,
    };
  }

  async transcribeUrl(
    audioUrl: string,
    params?: Omit<TranscriptionParams, 'file' | 'audio_base64' | 'url'>
  ): Promise<{
    status: number;
    body: TranscriptionResponse | VerboseTranscriptionResponse;
    latencyMs: number;
  }> {
    const formData: Record<string, any> = { url: audioUrl };
    if (params?.model) formData.model = params.model;
    if (params?.language_code) formData.language_code = params.language_code;
    if (params?.diarize !== undefined) formData.diarize = String(params.diarize);
    if (params?.num_speakers !== undefined) formData.num_speakers = String(params.num_speakers);
    if (params?.response_format) formData.response_format = params.response_format;

    const response = await this.apiClient.post<TranscriptionResponse | VerboseTranscriptionResponse>(
      ENDPOINTS.transcription,
      { formData, timeout: 25000 }
    );

    return {
      status: response.status,
      body: response.body,
      latencyMs: response.latencyMs,
    };
  }

  private mimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.wav': return 'audio/wav';
      case '.mp3': return 'audio/mpeg';
      case '.flac': return 'audio/flac';
      case '.ogg': return 'audio/ogg';
      default: return 'application/octet-stream';
    }
  }
}
