
export interface NetConnection {
  send(data: Uint8Array): void;
  close(): void;
  onMessage(callback: (data: Uint8Array) => void): void;
  onClose(callback: () => void): void;
}

export interface NetServer {
  listen(port: number): Promise<void>;
  close(): Promise<void>;
  onConnect(callback: (connection: NetConnection) => void): void;
}
