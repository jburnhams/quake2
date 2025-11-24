import { WebSocketServer as WSS, WebSocket } from 'ws';
import { NetServer, NetConnection, WebSocketConnection } from '@quake2ts/shared';

export class WebSocketServer implements NetServer {
  private wss?: WSS;
  private connectCallback?: (connection: NetConnection) => void;
  private connections: Set<WebSocket> = new Set();

  async listen(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WSS({ port });
      this.wss.on('connection', (ws: WebSocket) => {
        this.connections.add(ws);

        ws.on('close', () => {
          this.connections.delete(ws);
        });

        // ws in 'ws' package is compatible with isomorphic-ws interface mostly
        // but TypeScript might complain about exact type match if isomorphic-ws types are slightly different.
        // We cast to any or compatible type for now.
        const connection = new WebSocketConnection(ws as any);
        if (this.connectCallback) {
          this.connectCallback(connection);
        }
      });

      this.wss.on('listening', () => {
        resolve();
      });

      this.wss.on('error', (err) => {
        // console.error('[Server] Error:', err);
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Force close all active connections to prevent hang
      for (const ws of this.connections) {
        ws.terminate();
      }
      this.connections.clear();

      if (this.wss) {
        this.wss.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  onConnect(callback: (connection: NetConnection) => void): void {
    this.connectCallback = callback;
  }
}
