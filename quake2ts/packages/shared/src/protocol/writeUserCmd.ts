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
  writer.writeByte(cmd.impulse);

  // lightlevel (byte)
  writer.writeByte(0); // TODO: Lightlevel
}

/** The command a client has not got: nothing pressed and no time, as id's zeroed `nullcmd`. */
export const NULL_USER_COMMAND: UserCommand = Object.freeze({
  msec: 0,
  buttons: 0,
  angles: Object.freeze({ x: 0, y: 0, z: 0 }),
  forwardmove: 0,
  sidemove: 0,
  upmove: 0,
  sequence: 0,
  lightlevel: 0,
  impulse: 0,
});

/**
 * clc_move's three commands, as CL_SendCmd (client/cl_input.c) writes them: the two before this
 * one, then this one, so the server can run the commands of up to two lost packets from the
 * next one that arrives (SV_ExecuteClientMessage). `history` ends with the command being sent;
 * missing older ones go as NULL_USER_COMMAND. id delta-compresses each against the one before
 * (MSG_WriteDeltaUsercmd); the port writes each whole.
 */
export function writeMoveCommands(writer: BinaryWriter, history: readonly UserCommand[]): void {
  const at = (back: number) => history[history.length - 1 - back] ?? NULL_USER_COMMAND;
  writeUserCommand(writer, at(2));
  writeUserCommand(writer, at(1));
  writeUserCommand(writer, at(0));
}
