import { ASR_BASE_URL, ENDPOINTS } from '../../config';
import type {
  StreamingSessionParams,
  StreamEvent,
  StreamingReadyEvent,
  StreamingPartialEvent,
  StreamingFinalEvent,
  StreamingErrorEvent,
} from '../../types';
import { AuthClient } from '../../services/AuthClient';
import WS from 'ws';

// Universal WebSocket implementation across Node / CI environments
const WebSocketImpl: typeof WebSocket = (typeof WebSocket !== 'undefined' ? WebSocket : (WS as any));

class StreamingSession {
  public ws: any;
  private eventHandlers: {
    ready: ((ev: StreamingReadyEvent) => void)[];
    partial: ((ev: StreamingPartialEvent) => void)[];
    final: ((ev: StreamingFinalEvent) => void)[];
    error: ((ev: StreamingErrorEvent) => void)[];
  } = { ready: [], partial: [], final: [], error: [] };

  constructor(ws: any) {
    this.ws = ws;

    const onMessage = (data: any) => {
      try {
        const rawStr = typeof data === 'string' ? data : (data.data !== undefined ? data.data.toString() : data.toString());
        const ev = JSON.parse(rawStr) as StreamEvent;
        switch (ev.type) {
          case 'ready': this.eventHandlers.ready.forEach(h => h(ev)); break;
          case 'partial': this.eventHandlers.partial.forEach(h => h(ev)); break;
          case 'final': this.eventHandlers.final.forEach(h => h(ev)); break;
          case 'error': this.eventHandlers.error.forEach(h => h(ev)); break;
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    if (typeof ws.addEventListener === 'function') {
      ws.addEventListener('message', onMessage);
    } else if (typeof ws.on === 'function') {
      ws.on('message', onMessage);
    }
  }

  onReady(handler: (ev: StreamingReadyEvent) => void): void {
    this.eventHandlers.ready.push(handler);
  }
  onPartial(handler: (ev: StreamingPartialEvent) => void): void {
    this.eventHandlers.partial.push(handler);
  }
  onFinal(handler: (ev: StreamingFinalEvent) => void): void {
    this.eventHandlers.final.push(handler);
  }
  onError(handler: (ev: StreamingErrorEvent) => void): void {
    this.eventHandlers.error.push(handler);
  }

  sendAudio(data: ArrayBuffer | Buffer | Blob): void {
    this.ws.send(data);
  }

  sendEnd(): void {
    this.ws.send('end');
  }

  close(): void {
    this.ws.close();
  }

  waitForEvent(type: string, timeoutMs: number = 5000): Promise<StreamEvent> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${type} event`)), timeoutMs);
      const handler = (ev: StreamEvent) => {
        clearTimeout(timer);
        resolve(ev);
      };
      switch (type) {
        case 'ready': this.onReady(handler as any); break;
        case 'partial': this.onPartial(handler as any); break;
        case 'final': this.onFinal(handler as any); break;
        case 'error': this.onError(handler as any); break;
      }
    });
  }
}

export class StreamingClient {
  private baseWsUrl: string;

  constructor(baseUrl?: string) {
    const httpBase = baseUrl || ASR_BASE_URL;
    const host = new URL(httpBase).host;
    this.baseWsUrl = `wss://${host}`;
  }

  private attachOpenHandlers(ws: any): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (typeof ws.addEventListener === 'function') {
        ws.addEventListener('open', () => resolve());
        ws.addEventListener('error', () => reject(new Error('WebSocket connection failed')));
      } else if (typeof ws.on === 'function') {
        ws.on('open', () => resolve());
        ws.on('error', (err: any) => reject(err || new Error('WebSocket connection failed')));
      } else {
        resolve();
      }
    });
  }

  async createSession(
    params: StreamingSessionParams
  ): Promise<StreamingSession> {
    const ws = new WebSocketImpl(`${this.baseWsUrl}${ENDPOINTS.streaming}`);
    const session = new StreamingSession(ws);

    // Wait for socket open
    await this.attachOpenHandlers(ws);

    // Send init message
    ws.send(JSON.stringify(params));

    return session;
  }

  async createSessionWithQueryToken(
    token: string,
    params: Omit<StreamingSessionParams, 'token'>
  ): Promise<StreamingSession> {
    const ws = new WebSocketImpl(`${this.baseWsUrl}${ENDPOINTS.streaming}?token=${encodeURIComponent(token)}`);
    const session = new StreamingSession(ws);

    await this.attachOpenHandlers(ws);

    // Send params without token (token is in query param)
    ws.send(JSON.stringify(params));

    return session;
  }

  async createSessionAtAliasEndpoint(
    params: StreamingSessionParams
  ): Promise<StreamingSession> {
    const ws = new WebSocketImpl(`${this.baseWsUrl}${ENDPOINTS.streamingAlias}`);
    const session = new StreamingSession(ws);

    await this.attachOpenHandlers(ws);

    ws.send(JSON.stringify(params));

    return session;
  }
}
