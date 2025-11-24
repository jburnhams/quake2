import { WebSocketServer as WSS, WebSocket } from 'ws';
import { NetServer, NetConnection, WebSocketConnection } from '@quake2ts/shared';

export class WebSocketServer implements NetServer {
  private wss?: WSS;
  private connectCallback?: (connection: NetConnection) => void;

  async listen(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WSS({ port });
      this.wss.on('connection', (ws: WebSocket) => {
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
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.wss) {
        this.wss.close((err) => {
          if (err) reject(err);
          else resolve();
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
