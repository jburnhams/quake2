import { BinaryWriter } from '../io/binaryWriter.js';
import { UserCommand } from './usercmd.js';

export function writeUserCommand(writer: BinaryWriter, cmd: UserCommand): void {
  // msec (byte)
  writer.writeByte(cmd.msec);

  // buttons (byte)
  writer.writeByte(cmd.buttons);

  // angles (short * 3) - Scaled 360 -> 65536
  writer.writeAngle16(cmd.angles.x);
  writer.writeAngle16(cmd.angles.y);
  writer.writeAngle16(cmd.angles.z);

  // forwardmove (short)
  writer.writeShort(cmd.forwardmove);

  // sidemove (short)
  writer.writeShort(cmd.sidemove);

  // upmove (short)
  writer.writeShort(cmd.upmove);

  // impulse (byte)
  writer.writeByte(0); // TODO: Impulse in UserCommand

  // lightlevel (byte)
  writer.writeByte(0); // TODO: Lightlevel
}
