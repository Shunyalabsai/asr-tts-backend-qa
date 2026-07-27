# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: language-identification/language-code.spec.ts >> M04-T01: Default language_code (omitted) uses auto detection @smoke
- Location: src/features/language-identification/language-code.spec.ts:17:5

# Error details

```
AuthError: Auth error [401]: invalid api key
```

# Test source

```ts
  1  | import { ASR_BASE_URL, ENDPOINTS, AUTH_CONFIG } from '../config';
  2  | import type { TokenResponse, ApiErrorResponse } from '../types';
  3  | 
  4  | export class AuthError extends Error {
  5  |   public statusCode: number;
  6  |   public detail: string;
  7  | 
  8  |   constructor(detail: string, statusCode: number) {
  9  |     super(`Auth error [${statusCode}]: ${detail}`);
  10 |     this.name = 'AuthError';
  11 |     this.statusCode = statusCode;
  12 |     this.detail = detail;
  13 |   }
  14 | }
  15 | 
  16 | export class AuthClient {
  17 |   private currentToken: string | null = null;
  18 |   private expiresAt: number = 0;
  19 |   private refreshBuffer: number;
  20 |   private refreshPromise: Promise<string> | null = null;
  21 |   private apiKey: string;
  22 |   private baseUrl: string;
  23 |   private authEndpoint: string;
  24 | 
  25 |   constructor(
  26 |     apiKey?: string,
  27 |     baseUrl?: string,
  28 |     authEndpoint?: string,
  29 |     refreshBufferSeconds?: number
  30 |   ) {
  31 |     this.apiKey = apiKey || AUTH_CONFIG.apiKey;
  32 |     this.baseUrl = baseUrl || ASR_BASE_URL;
  33 |     this.authEndpoint = authEndpoint || ENDPOINTS.auth;
  34 |     this.refreshBuffer = refreshBufferSeconds || AUTH_CONFIG.refreshBufferSeconds;
  35 |   }
  36 | 
  37 |   async getToken(): Promise<string> {
  38 |     if (this.currentToken && !this.isExpired()) {
  39 |       return this.currentToken;
  40 |     }
  41 |     return this.refreshToken();
  42 |   }
  43 | 
  44 |   private async refreshToken(): Promise<string> {
  45 |     if (this.refreshPromise) {
  46 |       return this.refreshPromise;
  47 |     }
  48 |     this.refreshPromise = this.doRefresh().finally(() => {
  49 |       this.refreshPromise = null;
  50 |     });
  51 |     return this.refreshPromise;
  52 |   }
  53 | 
  54 |   private async doRefresh(): Promise<string> {
  55 |     const url = `${this.baseUrl}${this.authEndpoint}`;
  56 | 
  57 |     const response = await fetch(url, {
  58 |       method: 'POST',
  59 |       headers: {
  60 |         'Authorization': `Bearer ${this.apiKey}`,
  61 |         'Accept': 'application/json',
  62 |       },
  63 |     });
  64 | 
  65 |     if (!response.ok) {
  66 |       let detail = `Token refresh failed: ${response.status}`;
  67 |       try {
  68 |         const errorBody = (await response.json()) as ApiErrorResponse;
  69 |         if (errorBody.detail) {
  70 |           detail = errorBody.detail;
  71 |         }
  72 |       } catch {
  73 |         // ignore parse failure
  74 |       }
> 75 |       throw new AuthError(detail, response.status);
     |             ^ AuthError: Auth error [401]: invalid api key
  76 |     }
  77 | 
  78 |     const data = (await response.json()) as TokenResponse;
  79 |     this.currentToken = data.token;
  80 |     this.expiresAt = data.expires_at;
  81 |     return this.currentToken;
  82 |   }
  83 | 
  84 |   isExpired(): boolean {
  85 |     const now = Math.floor(Date.now() / 1000);
  86 |     return (this.expiresAt - this.refreshBuffer) <= now;
  87 |   }
  88 | 
  89 |   invalidate(): void {
  90 |     this.currentToken = null;
  91 |     this.expiresAt = 0;
  92 |   }
  93 | 
  94 |   async forceRefresh(): Promise<string> {
  95 |     this.invalidate();
  96 |     return this.getToken();
  97 |   }
  98 | }
  99 | 
```