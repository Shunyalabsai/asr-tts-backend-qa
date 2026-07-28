# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transcription/audio-file-upload.spec.ts >> M02-T13: Audio URL input returns transcription
- Location: src/features/transcription/audio-file-upload.spec.ts:286:5

# Error details

```
ApiError: API error [400]: could not fetch `url`: HTTPStatusError
```

# Test source

```ts
  149 |     } finally {
  150 |       clearTimeout(timeoutId);
  151 |     }
  152 |   }
  153 | 
  154 |   async delete<T>(
  155 |     path: string,
  156 |     options: {
  157 |       body?: any;
  158 |       headers?: Record<string, string>;
  159 |       timeout?: number;
  160 |     } = {}
  161 |   ): Promise<ApiResponse<T>> {
  162 |     const token = await this.authClient.getToken();
  163 |     const start = Date.now();
  164 |     const url = `${this.baseUrl}${path}`;
  165 | 
  166 |     const headers: Record<string, string> = {
  167 |       ...options.headers,
  168 |       'Authorization': `Bearer ${token}`,
  169 |     };
  170 | 
  171 |     if (options.body) {
  172 |       headers['Content-Type'] = 'application/json';
  173 |     }
  174 | 
  175 |     const controller = new AbortController();
  176 |     const timeoutId = setTimeout(
  177 |       () => controller.abort(),
  178 |       options.timeout ?? this.defaultTimeout
  179 |     );
  180 | 
  181 |     try {
  182 |       const response = await fetch(url, {
  183 |         method: 'DELETE',
  184 |         headers,
  185 |         body: options.body ? JSON.stringify(options.body) : undefined,
  186 |         signal: controller.signal,
  187 |       });
  188 |       const latencyMs = Date.now() - start;
  189 |       return this.parseResponse<T>(response, latencyMs);
  190 |     } catch (err: any) {
  191 |       if (err instanceof ApiError) throw err;
  192 |       if (err.name === 'AbortError') {
  193 |         throw new ApiError('Request timed out', 408);
  194 |       }
  195 |       throw new ApiError(err.message || 'Network error', 0);
  196 |     } finally {
  197 |       clearTimeout(timeoutId);
  198 |     }
  199 |   }
  200 | 
  201 |   async requestWithoutAuth<T>(
  202 |     url: string,
  203 |     method: string,
  204 |     options: {
  205 |       headers?: Record<string, string>;
  206 |       timeout?: number;
  207 |     } = {}
  208 |   ): Promise<ApiResponse<T>> {
  209 |     const start = Date.now();
  210 |     const controller = new AbortController();
  211 |     const timeoutId = setTimeout(
  212 |       () => controller.abort(),
  213 |       options.timeout ?? this.defaultTimeout
  214 |     );
  215 | 
  216 |     try {
  217 |       const response = await fetch(url, {
  218 |         method,
  219 |         headers: options.headers || { 'Accept': 'application/json' },
  220 |         signal: controller.signal,
  221 |       });
  222 |       const latencyMs = Date.now() - start;
  223 |       return this.parseResponse<T>(response, latencyMs);
  224 |     } catch (err: any) {
  225 |       if (err instanceof ApiError) throw err;
  226 |       if (err.name === 'AbortError') {
  227 |         throw new ApiError('Request timed out', 408);
  228 |       }
  229 |       throw new ApiError(err.message || 'Network error', 0);
  230 |     } finally {
  231 |       clearTimeout(timeoutId);
  232 |     }
  233 |   }
  234 | 
  235 |   private async parseResponse<T>(response: Response, latencyMs: number): Promise<ApiResponse<T>> {
  236 |     const headers: Record<string, string> = {};
  237 |     response.headers.forEach((v, k) => { headers[k] = v; });
  238 | 
  239 |     let body: any = null;
  240 |     const contentType = response.headers.get('content-type') || '';
  241 |     if (contentType.includes('application/json')) {
  242 |       body = await response.json() as T;
  243 |     } else {
  244 |       body = await response.text() as any;
  245 |     }
  246 | 
  247 |     if (!response.ok) {
  248 |       const detail = body?.detail || `HTTP ${response.status}`;
> 249 |       throw new ApiError(detail, response.status);
      |             ^ ApiError: API error [400]: could not fetch `url`: HTTPStatusError
  250 |     }
  251 | 
  252 |     return {
  253 |       status: response.status,
  254 |       body,
  255 |       latencyMs,
  256 |       ok: true,
  257 |       headers,
  258 |     };
  259 |   }
  260 | }
  261 | 
```