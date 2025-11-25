import { BinaryStream, ClientCommand, UserCommand } from '@quake2ts/shared';

export interface ClientMessageHandler {
  onMove(checksum: number, lastFrame: number, userCmd: UserCommand): void;
  onUserInfo(info: string): void;
  onStringCmd(cmd: string): void;
  onNop(): void;
  onBad(): void;
}

export class ClientMessageParser {
  private stream: BinaryStream;
  private handler: ClientMessageHandler;

  constructor(stream: BinaryStream, handler: ClientMessageHandler) {
    this.stream = stream;
    this.handler = handler;
  }

  public parseMessage(): void {
    while (this.stream.hasMore()) {
      const cmdId = this.stream.readByte();
      if (cmdId === -1) break;

      switch (cmdId) {
        case ClientCommand.move:
          this.parseMove();
          break;
        case ClientCommand.userinfo:
          this.parseUserInfo();
          break;
        case ClientCommand.stringcmd:
          this.parseStringCmd();
          break;
        case ClientCommand.nop:
          this.handler.onNop();
          break;
        default:
          console.warn(`Unknown client command: ${cmdId}`);
          this.handler.onBad();
          return;
      }
    }
  }

  private parseMove(): void {
    const checksum = this.stream.readByte();
    const lastFrame = this.stream.readLong();

    // Read UserCmd
    // TODO: support delta compression if needed (Q2 uses delta compression for usercmds)
    // For now, assume full UserCmd or implement basic read

    const msec = this.stream.readByte();
    const buttons = this.stream.readByte();
    const angles = {
      x: this.stream.readShort() * (360.0 / 65536.0),
      y: this.stream.readShort() * (360.0 / 65536.0),
      z: this.stream.readShort() * (360.0 / 65536.0),
    };
    const forwardmove = this.stream.readShort();
    const sidemove = this.stream.readShort();
    const upmove = this.stream.readShort();
    const impulse = this.stream.readByte();
    const lightlevel = this.stream.readByte(); // Used for light-based stealth, usually ignored by server logic except for stats

    const userCmd: UserCommand = {
      msec,
      buttons,
      angles,
      forwardmove,
      sidemove,
      upmove
    };

    this.handler.onMove(checksum, lastFrame, userCmd);
  }

  private parseUserInfo(): void {
    const info = this.stream.readString();
    this.handler.onUserInfo(info);
  }

  private parseStringCmd(): void {
    const cmd = this.stream.readString();
    this.handler.onStringCmd(cmd);
  }
}
