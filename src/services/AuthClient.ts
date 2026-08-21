import { ASR_BASE_URL, ENDPOINTS, AUTH_CONFIG } from '../config';
import type { TokenResponse, ApiErrorResponse } from '../types';

export class AuthError extends Error {
  public statusCode: number;
  public detail: string;

  constructor(detail: string, statusCode: number) {
    super(`Auth error [${statusCode}]: ${detail}`);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

export class AuthClient {
  private currentToken: string | null = null;
  private expiresAt: number = 0;
  private refreshBuffer: number;
  private refreshPromise: Promise<string> | null = null;
  private apiKey: string;
  private baseUrl: string;
  private authEndpoint: string;

  constructor(
    apiKey?: string,
    baseUrl?: string,
    authEndpoint?: string,
    refreshBufferSeconds?: number
  ) {
    this.apiKey = apiKey || AUTH_CONFIG.apiKey;
    this.baseUrl = baseUrl || ASR_BASE_URL;
    this.authEndpoint = authEndpoint || ENDPOINTS.auth;
    this.refreshBuffer = refreshBufferSeconds || AUTH_CONFIG.refreshBufferSeconds;
  }

  async getToken(): Promise<string> {
    if (this.currentToken && !this.isExpired()) {
      return this.currentToken;
    }
    return this.refreshToken();
  }

  private async refreshToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<string> {
    const url = `${this.baseUrl}${this.authEndpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'api-key': this.apiKey,
      'Accept': 'application/json',
    };

    let body: string | undefined = undefined;
    if (this.authEndpoint.includes('/api/auth/token')) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ expires_in: 86400 });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      let detail = `Token refresh failed: ${response.status}`;
      try {
        const errorBody = (await response.json()) as ApiErrorResponse;
        if (errorBody.detail) {
          detail = errorBody.detail;
        }
      } catch {
        // ignore parse failure
      }
      throw new AuthError(detail, response.status);
    }

    const data = (await response.json()) as TokenResponse;
    this.currentToken = data.token;
    this.expiresAt = data.expires_at;
    return this.currentToken;
  }

  isExpired(): boolean {
    const now = Math.floor(Date.now() / 1000);
    return (this.expiresAt - this.refreshBuffer) <= now;
  }

  invalidate(): void {
    this.currentToken = null;
    this.expiresAt = 0;
  }

  async forceRefresh(): Promise<string> {
    this.invalidate();
    return this.getToken();
  }
}
