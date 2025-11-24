import { NetDriver } from '@quake2ts/shared';
import WebSocket from 'ws';

export class WebSocketNetDriver implements NetDriver {
  private socket: WebSocket | null = null;
  private messageCallback: ((data: Uint8Array) => void) | null = null;
  private closeCallback: (() => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(url);
        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
          resolve();
        };

        this.socket.onerror = (event) => {
          const error = new Error('WebSocket connection error ' + event.message);
          if (this.errorCallback) {
            this.errorCallback(error);
          }
          reject(error);
        };

        this.socket.onclose = () => {
          if (this.closeCallback) {
            this.closeCallback();
          }
          this.socket = null;
        };

        this.socket.onmessage = (event) => {
          if (this.messageCallback) {
            if (event.data instanceof ArrayBuffer) {
              this.messageCallback(new Uint8Array(event.data));
            } else if (Buffer.isBuffer(event.data)) {
               // ws in Node might return Buffer
               this.messageCallback(new Uint8Array(event.data));
            } else if (Array.isArray(event.data)) {
                // Buffer[]
                 const totalLength = event.data.reduce((acc, buf) => acc + buf.length, 0);
                 const result = new Uint8Array(totalLength);
                 let offset = 0;
                 for (const buf of event.data) {
                     result.set(buf, offset);
                     offset += buf.length;
                 }
                 this.messageCallback(result);
            } else {
              console.warn('Received non-binary message from server', typeof event.data);
            }
          }
        };

      } catch (e) {
        reject(e);
      }
    });
  }

  // Method to attach an existing socket (server-side incoming connection)
  attach(socket: WebSocket) {
      this.socket = socket;
      this.socket.binaryType = 'arraybuffer';

      this.socket.onclose = () => {
          if (this.closeCallback) this.closeCallback();
          this.socket = null;
      };

      this.socket.onerror = (event) => {
          if (this.errorCallback) this.errorCallback(new Error(event.message));
      };

      this.socket.onmessage = (event) => {
          if (this.messageCallback) {
             if (event.data instanceof ArrayBuffer) {
                  this.messageCallback(new Uint8Array(event.data));
             } else if (Buffer.isBuffer(event.data)) {
                 this.messageCallback(new Uint8Array(event.data));
             } else if (Array.isArray(event.data)) { // ws specific
                 // handle fragmentation if necessary, usually it's Buffer[]
                 const totalLength = event.data.reduce((acc: number, buf: Buffer) => acc + buf.length, 0);
                 const result = new Uint8Array(totalLength);
                 let offset = 0;
                 for (const buf of event.data) {
                     result.set(buf, offset);
                     offset += buf.length;
                 }
                 this.messageCallback(result);
             }
          }
      };
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send(data: Uint8Array): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    } else {
      console.warn('Attempted to send data on closed or connecting socket');
    }
  }

  onMessage(callback: (data: Uint8Array) => void): void {
    this.messageCallback = callback;
  }

  onClose(callback: () => void): void {
    this.closeCallback = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallback = callback;
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}
