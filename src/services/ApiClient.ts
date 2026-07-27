import { AuthClient } from './AuthClient';
import { ASR_BASE_URL, TIMEOUTS } from '../config';
import type { ApiErrorResponse } from '../types';

export class ApiError extends Error {
  public statusCode: number;
  public detail: string;

  constructor(detail: string, statusCode: number) {
    super(`API error [${statusCode}]: ${detail}`);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

export interface ApiResponse<T> {
  status: number;
  body: T;
  latencyMs: number;
  ok: boolean;
  headers: Record<string, string>;
}

export class ApiClient {
  constructor(
    private authClient: AuthClient,
    private baseUrl: string = ASR_BASE_URL,
    private defaultTimeout: number = TIMEOUTS.api
  ) {}

  async post<T>(
    path: string,
    options: {
      body?: any;
      formData?: Record<string, any>;
      headers?: Record<string, string>;
      timeout?: number;
      contentType?: string;
    } = {}
  ): Promise<ApiResponse<T>> {
    const token = await this.authClient.getToken();
    const start = Date.now();
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    let fetchBody: any = undefined;
    const contentType = options.contentType;

    if (options.formData) {
      // FormData for multipart
      const fd = new FormData();
      for (const [key, value] of Object.entries(options.formData)) {
        if (value instanceof Blob || value instanceof File) {
          fd.append(key, value);
        } else if (typeof value === 'object' && value?.buffer) {
          // It's a Buffer-like object
          const blob = new Blob([value as any]);
          fd.append(key, blob, value.filename || key);
        } else {
          fd.append(key, String(value));
        }
      }
      fetchBody = fd;
      // Let fetch set Content-Type with boundary
    } else if (options.body) {
      headers['Content-Type'] = contentType || 'application/json';
      fetchBody = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout ?? this.defaultTimeout
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: fetchBody,
        signal: controller.signal,
      });

      const latencyMs = Date.now() - start;

      // Handle 401 — retry once with fresh token
      if (response.status === 401) {
        const newToken = await this.authClient.forceRefresh();
        headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(url, {
          method: 'POST',
          headers,
          body: fetchBody,
          signal: controller.signal,
        });
        const retryLatency = Date.now() - start;
        return this.parseResponse<T>(retryResponse, retryLatency);
      }

      return this.parseResponse<T>(response, latencyMs);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out', 408);
      }
      throw new ApiError(err.message || 'Network error', 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async get<T>(
    path: string,
    options: {
      headers?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    const token = await this.authClient.getToken();
    const start = Date.now();
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout ?? this.defaultTimeout
    );

    try {
      const response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
      const latencyMs = Date.now() - start;
      return this.parseResponse<T>(response, latencyMs);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out', 408);
      }
      throw new ApiError(err.message || 'Network error', 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async delete<T>(
    path: string,
    options: {
      body?: any;
      headers?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    const token = await this.authClient.getToken();
    const start = Date.now();
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    if (options.body) {
      headers['Content-Type'] = 'application/json';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout ?? this.defaultTimeout
    );

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      const latencyMs = Date.now() - start;
      return this.parseResponse<T>(response, latencyMs);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out', 408);
      }
      throw new ApiError(err.message || 'Network error', 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async requestWithoutAuth<T>(
    url: string,
    method: string,
    options: {
      headers?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<ApiResponse<T>> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options.timeout ?? this.defaultTimeout
    );

    try {
      const response = await fetch(url, {
        method,
        headers: options.headers || { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      const latencyMs = Date.now() - start;
      return this.parseResponse<T>(response, latencyMs);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out', 408);
      }
      throw new ApiError(err.message || 'Network error', 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async parseResponse<T>(response: Response, latencyMs: number): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {};
    response.headers.forEach((v, k) => { headers[k] = v; });

    let body: any = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await response.json() as T;
    } else {
      body = await response.text() as any;
    }

    if (!response.ok) {
      const detail = body?.detail || `HTTP ${response.status}`;
      throw new ApiError(detail, response.status);
    }

    return {
      status: response.status,
      body,
      latencyMs,
      ok: true,
      headers,
    };
  }
}
