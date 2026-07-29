# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: streaming/streaming.spec.ts >> M16-T05: Wrong token returns error event and socket closes
- Location: src/features/streaming/streaming.spec.ts:204:5

# Error details

```
Error: WebSocket connection failed
```

# Test source

```ts
  1   | import { ASR_BASE_URL, ENDPOINTS } from '../../config';
  2   | import type {
  3   |   StreamingSessionParams,
  4   |   StreamEvent,
  5   |   StreamingReadyEvent,
  6   |   StreamingPartialEvent,
  7   |   StreamingFinalEvent,
  8   |   StreamingErrorEvent,
  9   | } from '../../types';
  10  | import { AuthClient } from '../../services/AuthClient';
  11  | 
  12  | class StreamingSession {
  13  |   public ws: WebSocket;
  14  |   private eventHandlers: {
  15  |     ready: ((ev: StreamingReadyEvent) => void)[];
  16  |     partial: ((ev: StreamingPartialEvent) => void)[];
  17  |     final: ((ev: StreamingFinalEvent) => void)[];
  18  |     error: ((ev: StreamingErrorEvent) => void)[];
  19  |   } = { ready: [], partial: [], final: [], error: [] };
  20  | 
  21  |   constructor(ws: WebSocket) {
  22  |     this.ws = ws;
  23  |     ws.addEventListener('message', (msg: MessageEvent) => {
  24  |       try {
  25  |         const ev = JSON.parse(msg.data as string) as StreamEvent;
  26  |         switch (ev.type) {
  27  |           case 'ready': this.eventHandlers.ready.forEach(h => h(ev)); break;
  28  |           case 'partial': this.eventHandlers.partial.forEach(h => h(ev)); break;
  29  |           case 'final': this.eventHandlers.final.forEach(h => h(ev)); break;
  30  |           case 'error': this.eventHandlers.error.forEach(h => h(ev)); break;
  31  |         }
  32  |       } catch {
  33  |         // ignore non-JSON messages
  34  |       }
  35  |     });
  36  |   }
  37  | 
  38  |   onReady(handler: (ev: StreamingReadyEvent) => void): void {
  39  |     this.eventHandlers.ready.push(handler);
  40  |   }
  41  |   onPartial(handler: (ev: StreamingPartialEvent) => void): void {
  42  |     this.eventHandlers.partial.push(handler);
  43  |   }
  44  |   onFinal(handler: (ev: StreamingFinalEvent) => void): void {
  45  |     this.eventHandlers.final.push(handler);
  46  |   }
  47  |   onError(handler: (ev: StreamingErrorEvent) => void): void {
  48  |     this.eventHandlers.error.push(handler);
  49  |   }
  50  | 
  51  |   sendAudio(data: ArrayBuffer | Buffer | Blob): void {
  52  |     this.ws.send(data);
  53  |   }
  54  | 
  55  |   sendEnd(): void {
  56  |     this.ws.send('end');
  57  |   }
  58  | 
  59  |   close(): void {
  60  |     this.ws.close();
  61  |   }
  62  | 
  63  |   waitForEvent(type: string, timeoutMs: number = 5000): Promise<StreamEvent> {
  64  |     return new Promise((resolve, reject) => {
  65  |       const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type} event`)), timeoutMs);
  66  |       const handler = (ev: StreamEvent) => {
  67  |         clearTimeout(timer);
  68  |         resolve(ev);
  69  |       };
  70  |       switch (type) {
  71  |         case 'ready': this.onReady(handler as any); break;
  72  |         case 'partial': this.onPartial(handler as any); break;
  73  |         case 'final': this.onFinal(handler as any); break;
  74  |         case 'error': this.onError(handler as any); break;
  75  |       }
  76  |     });
  77  |   }
  78  | }
  79  | 
  80  | export class StreamingClient {
  81  |   private baseWsUrl: string;
  82  | 
  83  |   constructor(baseUrl?: string) {
  84  |     const httpBase = baseUrl || ASR_BASE_URL;
  85  |     const host = new URL(httpBase).host;
  86  |     this.baseWsUrl = `wss://${host}`;
  87  |   }
  88  | 
  89  |   async createSession(
  90  |     params: StreamingSessionParams
  91  |   ): Promise<StreamingSession> {
  92  |     const ws = new WebSocket(`${this.baseWsUrl}${ENDPOINTS.streaming}`);
  93  |     const session = new StreamingSession(ws);
  94  | 
  95  |     // Wait for socket open
  96  |     await new Promise<void>((resolve, reject) => {
  97  |       ws.addEventListener('open', () => resolve());
> 98  |       ws.addEventListener('error', () => reject(new Error('WebSocket connection failed')));
      |                                                 ^ Error: WebSocket connection failed
  99  |     });
  100 | 
  101 |     // Send init message
  102 |     ws.send(JSON.stringify(params));
  103 | 
  104 |     return session;
  105 |   }
  106 | 
  107 |   async createSessionWithQueryToken(
  108 |     token: string,
  109 |     params: Omit<StreamingSessionParams, 'token'>
  110 |   ): Promise<StreamingSession> {
  111 |     const ws = new WebSocket(`${this.baseWsUrl}${ENDPOINTS.streaming}?token=${encodeURIComponent(token)}`);
  112 |     const session = new StreamingSession(ws);
  113 | 
  114 |     await new Promise<void>((resolve, reject) => {
  115 |       ws.addEventListener('open', () => resolve());
  116 |       ws.addEventListener('error', () => reject(new Error('WebSocket connection failed')));
  117 |     });
  118 | 
  119 |     // Send params without token (token is in query param)
  120 |     ws.send(JSON.stringify(params));
  121 | 
  122 |     return session;
  123 |   }
  124 | 
  125 |   async createSessionAtAliasEndpoint(
  126 |     params: StreamingSessionParams
  127 |   ): Promise<StreamingSession> {
  128 |     const ws = new WebSocket(`${this.baseWsUrl}${ENDPOINTS.streamingAlias}`);
  129 |     const session = new StreamingSession(ws);
  130 | 
  131 |     await new Promise<void>((resolve, reject) => {
  132 |       ws.addEventListener('open', () => resolve());
  133 |       ws.addEventListener('error', () => reject(new Error('WebSocket connection failed')));
  134 |     });
  135 | 
  136 |     ws.send(JSON.stringify(params));
  137 | 
  138 |     return session;
  139 |   }
  140 | }
  141 | 
```