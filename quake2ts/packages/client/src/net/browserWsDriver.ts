import { NetDriver } from '@quake2ts/shared';

export class BrowserWebSocketNetDriver implements NetDriver {
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
          const error = new Error('WebSocket connection error');
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
            } else {
              console.warn('Received non-binary message from server');
            }
          }
        };

      } catch (e) {
        reject(e);
      }
    });
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
