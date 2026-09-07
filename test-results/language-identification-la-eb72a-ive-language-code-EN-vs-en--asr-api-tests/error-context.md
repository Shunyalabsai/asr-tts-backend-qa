# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: language-identification/language-code.spec.ts >> M04-T06: Case-insensitive language_code (EN vs en)
- Location: src/features/language-identification/language-code.spec.ts:129:5

# Error details

```
ApiError: API error [408]: Request timed out
```

# Test source

```ts
  9   |   constructor(detail: string, statusCode: number) {
  10  |     super(`API error [${statusCode}]: ${detail}`);
  11  |     this.name = 'ApiError';
  12  |     this.statusCode = statusCode;
  13  |     this.detail = detail;
  14  |   }
  15  | }
  16  | 
  17  | export interface ApiResponse<T> {
  18  |   status: number;
  19  |   body: T;
  20  |   latencyMs: number;
  21  |   ok: boolean;
  22  |   headers: Record<string, string>;
  23  | }
  24  | 
  25  | export class ApiClient {
  26  |   constructor(
  27  |     private authClient: AuthClient,
  28  |     private baseUrl: string = ASR_BASE_URL,
  29  |     private defaultTimeout: number = TIMEOUTS.api
  30  |   ) {}
  31  | 
  32  |   async post<T>(
  33  |     path: string,
  34  |     options: {
  35  |       body?: any;
  36  |       formData?: Record<string, any>;
  37  |       headers?: Record<string, string>;
  38  |       timeout?: number;
  39  |       contentType?: string;
  40  |     } = {}
  41  |   ): Promise<ApiResponse<T>> {
  42  |     const token = await this.authClient.getToken();
  43  |     const start = Date.now();
  44  |     const url = `${this.baseUrl}${path}`;
  45  | 
  46  |     const headers: Record<string, string> = {
  47  |       ...options.headers,
  48  |       'Authorization': `Bearer ${token}`,
  49  |     };
  50  | 
  51  |     let fetchBody: any = undefined;
  52  |     const contentType = options.contentType;
  53  | 
  54  |     if (options.formData) {
  55  |       // FormData for multipart
  56  |       const fd = new FormData();
  57  |       for (const [key, value] of Object.entries(options.formData)) {
  58  |         if (value instanceof Blob || value instanceof File) {
  59  |           fd.append(key, value);
  60  |         } else if (typeof value === 'object' && value?.buffer) {
  61  |           // It's a Buffer-like object
  62  |           const blob = new Blob([value as any]);
  63  |           fd.append(key, blob, value.filename || key);
  64  |         } else {
  65  |           fd.append(key, String(value));
  66  |         }
  67  |       }
  68  |       fetchBody = fd;
  69  |       // Let fetch set Content-Type with boundary
  70  |     } else if (options.body) {
  71  |       headers['Content-Type'] = contentType || 'application/json';
  72  |       fetchBody = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  73  |     }
  74  | 
  75  |     const controller = new AbortController();
  76  |     const timeoutId = setTimeout(
  77  |       () => controller.abort(),
  78  |       options.timeout ?? this.defaultTimeout
  79  |     );
  80  | 
  81  |     try {
  82  |       const response = await fetch(url, {
  83  |         method: 'POST',
  84  |         headers,
  85  |         body: fetchBody,
  86  |         signal: controller.signal,
  87  |       });
  88  | 
  89  |       const latencyMs = Date.now() - start;
  90  | 
  91  |       // Handle 401 — retry once with fresh token
  92  |       if (response.status === 401) {
  93  |         const newToken = await this.authClient.forceRefresh();
  94  |         headers['Authorization'] = `Bearer ${newToken}`;
  95  |         const retryResponse = await fetch(url, {
  96  |           method: 'POST',
  97  |           headers,
  98  |           body: fetchBody,
  99  |           signal: controller.signal,
  100 |         });
  101 |         const retryLatency = Date.now() - start;
  102 |         return this.parseResponse<T>(retryResponse, retryLatency);
  103 |       }
  104 | 
  105 |       return this.parseResponse<T>(response, latencyMs);
  106 |     } catch (err: any) {
  107 |       if (err instanceof ApiError) throw err;
  108 |       if (err.name === 'AbortError') {
> 109 |         throw new ApiError('Request timed out', 408);
      |               ^ ApiError: API error [408]: Request timed out
  110 |       }
  111 |       throw new ApiError(err.message || 'Network error', 0);
  112 |     } finally {
  113 |       clearTimeout(timeoutId);
  114 |     }
  115 |   }
  116 | 
  117 |   async get<T>(
  118 |     path: string,
  119 |     options: {
  120 |       headers?: Record<string, string>;
  121 |       timeout?: number;
  122 |     } = {}
  123 |   ): Promise<ApiResponse<T>> {
  124 |     const token = await this.authClient.getToken();
  125 |     const start = Date.now();
  126 |     const url = `${this.baseUrl}${path}`;
  127 | 
  128 |     const headers: Record<string, string> = {
  129 |       ...options.headers,
  130 |       'Authorization': `Bearer ${token}`,
  131 |     };
  132 | 
  133 |     const controller = new AbortController();
  134 |     const timeoutId = setTimeout(
  135 |       () => controller.abort(),
  136 |       options.timeout ?? this.defaultTimeout
  137 |     );
  138 | 
  139 |     try {
  140 |       const response = await fetch(url, { method: 'GET', headers, signal: controller.signal });
  141 |       const latencyMs = Date.now() - start;
  142 |       return this.parseResponse<T>(response, latencyMs);
  143 |     } catch (err: any) {
  144 |       if (err instanceof ApiError) throw err;
  145 |       if (err.name === 'AbortError') {
  146 |         throw new ApiError('Request timed out', 408);
  147 |       }
  148 |       throw new ApiError(err.message || 'Network error', 0);
  149 |     } finally {
  150 |       clearTimeout(timeoutId);
  151 |     }
  152 |   }
  153 | 
  154 |   async delete<T>(
  155 |     path: string,
  156 |     options: {
  157 |       body?: any;
  158 |       formData?: Record<string, any>;
  159 |       headers?: Record<string, string>;
  160 |       timeout?: number;
  161 |     } = {}
  162 |   ): Promise<ApiResponse<T>> {
  163 |     const token = await this.authClient.getToken();
  164 |     const start = Date.now();
  165 |     const url = `${this.baseUrl}${path}`;
  166 | 
  167 |     const headers: Record<string, string> = {
  168 |       ...options.headers,
  169 |       'Authorization': `Bearer ${token}`,
  170 |     };
  171 | 
  172 |     let fetchBody: any = undefined;
  173 |     if (options.formData) {
  174 |       const fd = new FormData();
  175 |       for (const [key, value] of Object.entries(options.formData)) {
  176 |         if (value instanceof Blob || value instanceof File) {
  177 |           fd.append(key, value);
  178 |         } else {
  179 |           fd.append(key, String(value));
  180 |         }
  181 |       }
  182 |       fetchBody = fd;
  183 |     } else if (options.body) {
  184 |       headers['Content-Type'] = 'application/json';
  185 |       fetchBody = JSON.stringify(options.body);
  186 |     }
  187 | 
  188 |     const controller = new AbortController();
  189 |     const timeoutId = setTimeout(
  190 |       () => controller.abort(),
  191 |       options.timeout ?? this.defaultTimeout
  192 |     );
  193 | 
  194 |     try {
  195 |       const response = await fetch(url, {
  196 |         method: 'DELETE',
  197 |         headers,
  198 |         body: fetchBody,
  199 |         signal: controller.signal,
  200 |       });
  201 |       const latencyMs = Date.now() - start;
  202 |       return this.parseResponse<T>(response, latencyMs);
  203 |     } catch (err: any) {
  204 |       if (err instanceof ApiError) throw err;
  205 |       if (err.name === 'AbortError') {
  206 |         throw new ApiError('Request timed out', 408);
  207 |       }
  208 |       throw new ApiError(err.message || 'Network error', 0);
  209 |     } finally {
```