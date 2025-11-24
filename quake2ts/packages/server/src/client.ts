import { NetConnection } from '@quake2ts/shared';

export enum ClientState {
  Free,       // Not used
  Connected,  // Connection established, waiting for challenge
  Primed,     // Client has sent info, waiting for prespawn
  Active      // In game
}

export class Client {
  public state: ClientState = ClientState.Free;
  public connection: NetConnection | null = null;
  public name: string = '';
  public userinfo: string = '';
  public lastMessageTime: number = 0;
  public messageBuffer: Uint8Array[] = [];

  constructor() {}

  public reset(): void {
    this.state = ClientState.Free;
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.name = '';
    this.userinfo = '';
    this.lastMessageTime = 0;
    this.messageBuffer = [];
  }

  public connect(connection: NetConnection): void {
    this.reset();
    this.state = ClientState.Connected;
    this.connection = connection;

    this.connection.onMessage((data) => {
      this.messageBuffer.push(data);
      this.lastMessageTime = Date.now();
    });

    this.connection.onClose(() => {
      this.disconnect();
    });
  }

  public disconnect(): void {
    if (this.state !== ClientState.Free) {
      console.log(`Client ${this.name} disconnected`);
      this.reset();
    }
  }

  public send(data: Uint8Array): void {
    if (this.connection && this.state !== ClientState.Free) {
      this.connection.send(data);
    }
  }
}
