import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { WebSocketServer } from '../../src/net/ws-server.js';
import { WebSocketConnection } from '@quake2ts/shared';
import WebSocket from 'isomorphic-ws';

describe('Network Integration', () => {
  let server: WebSocketServer;
  let clientSocket: WebSocket;
  const PORT = 8089;

  beforeEach(async () => {
    server = new WebSocketServer();
    await server.listen(PORT);
  });

  afterEach(async () => {
    if (clientSocket && clientSocket.readyState === WebSocket.OPEN) {
      clientSocket.close();
    }
    await server.close();
  });

  it('should connect and exchange messages', async () => {
    return new Promise<void>((resolve, reject) => {
      const serverReceived: Uint8Array[] = [];

      server.onConnect((conn) => {
        conn.onMessage((data) => {
          serverReceived.push(data);
          // Echo back
          conn.send(data);
        });
      });

      clientSocket = new WebSocket(`ws://localhost:${PORT}`);
      clientSocket.binaryType = 'arraybuffer';

      const clientConn = new WebSocketConnection(clientSocket);

      clientSocket.onopen = () => {
        const msg = new Uint8Array([1, 2, 3, 4]);
        clientConn.send(msg);
      };

      clientConn.onMessage((data) => {
        try {
          expect(data).toEqual(new Uint8Array([1, 2, 3, 4]));
          expect(serverReceived.length).toBe(1);
          expect(serverReceived[0]).toEqual(new Uint8Array([1, 2, 3, 4]));
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      clientSocket.onerror = (e) => reject(e);
    });
  });
});
