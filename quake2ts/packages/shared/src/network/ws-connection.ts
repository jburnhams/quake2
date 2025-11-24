import WebSocket from 'isomorphic-ws';
import { NetConnection } from './types.js';

export class WebSocketConnection implements NetConnection {
  private ws: WebSocket;
  private messageCallback?: (data: Uint8Array) => void;
  private closeCallback?: () => void;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.binaryType = 'arraybuffer';

    this.ws.onmessage = (event: WebSocket.MessageEvent) => {
      if (this.messageCallback) {
        if (event.data instanceof ArrayBuffer) {
           this.messageCallback(new Uint8Array(event.data));
        } else if (Array.isArray(event.data)) { // Node Buffer[]?
            // Should not happen with binaryType arraybuffer usually
            // But 'ws' in node might behave differently?
            // isomorphic-ws unifies this?
            // 'ws' event.data can be Buffer, ArrayBuffer, or Buffer[].
            // If it is Buffer, we convert.
             const buf = event.data as unknown as Buffer; // Cast for Node
             if (buf.buffer) {
                 this.messageCallback(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
             }
        } else {
             // Handle Buffer (Node) directly if not ArrayBuffer
             // 'ws' package returns Buffer by default?
             // Setting binaryType='arraybuffer' on 'ws' client should make it ArrayBuffer?
             // Actually, 'ws' documentation says:
             // "binaryType" property ...
             // If 'node', 'ws' might return Buffer.
             // Let's safe cast.
             const data = event.data as any;
             if (data instanceof ArrayBuffer) {
                 this.messageCallback(new Uint8Array(data));
             } else if (data instanceof Uint8Array) {
                  this.messageCallback(data);
             } else {
                  // Text?
                  // console.warn('Received non-binary data');
             }
        }
      }
    };

    this.ws.onclose = () => {
      if (this.closeCallback) {
        this.closeCallback();
      }
    };
  }

  send(data: Uint8Array): void {
    if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(data);
    }
  }

  close(): void {
    this.ws.close();
  }

  onMessage(callback: (data: Uint8Array) => void): void {
    this.messageCallback = callback;
  }

  onClose(callback: () => void): void {
    this.closeCallback = callback;
  }
}
