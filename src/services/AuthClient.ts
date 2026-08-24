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

interface CachedToken {
  token: string;
  expiresAt: number;
}

export class AuthClient {
  private static tokenCache: Map<string, CachedToken> = new Map();
  private static refreshPromises: Map<string, Promise<string>> = new Map();

  private refreshBuffer: number;
  private apiKey: string;
  private baseUrl: string;
  private authEndpoint: string;
  private cacheKey: string;

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
    this.cacheKey = `${this.baseUrl}|${this.authEndpoint}|${this.apiKey}`;
  }

  async getToken(): Promise<string> {
    const cached = AuthClient.tokenCache.get(this.cacheKey);
    if (cached && !this.isTokenExpired(cached)) {
      return cached.token;
    }
    return this.refreshToken();
  }

  private async refreshToken(): Promise<string> {
    const existingPromise = AuthClient.refreshPromises.get(this.cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const promise = this.doRefresh().finally(() => {
      AuthClient.refreshPromises.delete(this.cacheKey);
    });

    AuthClient.refreshPromises.set(this.cacheKey, promise);
    return promise;
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
    const expiresAt = data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600);

    AuthClient.tokenCache.set(this.cacheKey, {
      token: data.token,
      expiresAt,
    });

    return data.token;
  }

  private isTokenExpired(cached: CachedToken): boolean {
    const now = Math.floor(Date.now() / 1000);
    return (cached.expiresAt - this.refreshBuffer) <= now;
  }

  isExpired(): boolean {
    const cached = AuthClient.tokenCache.get(this.cacheKey);
    if (!cached) return true;
    return this.isTokenExpired(cached);
  }

  invalidate(): void {
    AuthClient.tokenCache.delete(this.cacheKey);
  }

  async forceRefresh(): Promise<string> {
    this.invalidate();
    return this.refreshToken();
  }
}
