import { BinaryStream, ClientCommand, UserCommand } from '@quake2ts/shared';

/** The three commands of one clc_move, oldest first. */
export interface MoveCommands {
  readonly oldest: UserCommand;
  readonly old: UserCommand;
  readonly current: UserCommand;
}

export interface ClientMessageHandler {
  /**
   * clc_move: the oldest, the older and the newest command (CL_SendCmd sends three, so the
   * commands of lost packets arrive in the next one).
   */
  onMove(checksum: number, lastFrame: number, commands: MoveCommands): void;
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

    // SV_ExecuteClientMessage reads three commands: oldest, old, new. id delta-compresses them
    // (MSG_ReadDeltaUsercmd); the port's client writes each whole (writeMoveCommands).
    const oldest = this.readUserCommand();
    const old = this.readUserCommand();
    const current = this.readUserCommand();

    this.handler.onMove(checksum, lastFrame, { oldest, old, current });
  }

  private readUserCommand(): UserCommand {
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
    const lightlevel = this.stream.readByte();

    return {
      msec,
      buttons,
      angles,
      forwardmove,
      sidemove,
      upmove,
      impulse,
      lightlevel,
      sequence: 0, // the server tracks sequence itself; it is not on the wire
    };
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
