export interface NetDriver {
  connect(url: string): Promise<void>;
  disconnect(): void;
  send(data: Uint8Array): void;
  onMessage(callback: (data: Uint8Array) => void): void;
  onClose(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
  isConnected(): boolean;
}
