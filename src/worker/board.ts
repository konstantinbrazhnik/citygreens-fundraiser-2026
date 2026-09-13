import { DurableObject } from 'cloudflare:workers';
import type { BoardMessage } from '../../shared/messages';

/**
 * DonationBoard: the single realtime fan-out. Every phone on the landing page
 * and every projector on #/board holds one hibernating WebSocket here; the
 * Worker calls `broadcast()` after each write to D1. The object stores nothing
 * itself: D1 is the record, this is only the megaphone.
 */
export class DonationBoard extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keepalives answered without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    const hello: BoardMessage = {
      type: 'board.hello',
      payload: { clients: this.ctx.getWebSockets().length },
      ts: Date.now(),
    };
    pair[1].send(JSON.stringify(hello));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(_ws: WebSocket, _message: ArrayBuffer | string) {
    // Clients never originate anything but the auto-answered ping.
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code, 'bye');
    } catch {
      // already closed
    }
  }

  async webSocketError(ws: WebSocket) {
    try {
      ws.close(1011, 'error');
    } catch {
      // already closed
    }
  }

  /** RPC from the Worker after every write. Returns how many sockets got it. */
  async broadcast(message: BoardMessage): Promise<number> {
    const raw = JSON.stringify(message);
    let sent = 0;
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(raw);
        sent++;
      } catch {
        // mid-close; hibernation reaps it
      }
    }
    return sent;
  }

  async clients(): Promise<number> {
    return this.ctx.getWebSockets().length;
  }
}
