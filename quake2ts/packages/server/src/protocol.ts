import {
  BinaryStream,
  ClientCommand,
  CM_ANGLE1,
  CM_ANGLE2,
  CM_ANGLE3,
  CM_BUTTONS,
  CM_FORWARD,
  CM_IMPULSE,
  CM_SIDE,
  CM_UP,
  NULL_USER_COMMAND,
  UserCommand,
} from '@quake2ts/shared';

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

    // SV_ExecuteClientMessage reads three commands, each a delta from the one before, the
    // oldest from the null command (MSG_ReadDeltaUsercmd).
    const oldest = this.readDeltaUserCommand(NULL_USER_COMMAND);
    const old = this.readDeltaUserCommand(oldest);
    const current = this.readDeltaUserCommand(old);

    this.handler.onMove(checksum, lastFrame, { oldest, old, current });
  }

  /** MSG_ReadDeltaUsercmd: `from` with the fields the bit byte names replaced. */
  private readDeltaUserCommand(from: UserCommand): UserCommand {
    const bits = this.stream.readByte();
    const angle = () => this.stream.readShort() * (360.0 / 65536.0);
    const angles = {
      x: bits & CM_ANGLE1 ? angle() : from.angles.x,
      y: bits & CM_ANGLE2 ? angle() : from.angles.y,
      z: bits & CM_ANGLE3 ? angle() : from.angles.z,
    };
    const forwardmove = bits & CM_FORWARD ? this.stream.readShort() : from.forwardmove;
    const sidemove = bits & CM_SIDE ? this.stream.readShort() : from.sidemove;
    const upmove = bits & CM_UP ? this.stream.readShort() : from.upmove;
    const buttons = bits & CM_BUTTONS ? this.stream.readByte() : from.buttons;
    const impulse = bits & CM_IMPULSE ? this.stream.readByte() : from.impulse;
    const msec = this.stream.readByte();
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
