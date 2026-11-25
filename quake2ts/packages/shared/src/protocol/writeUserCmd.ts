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

/** usercmd delta bits (qcommon.h CM_*): which fields follow. */
export const CM_ANGLE1 = 1 << 0;
export const CM_ANGLE2 = 1 << 1;
export const CM_ANGLE3 = 1 << 2;
export const CM_FORWARD = 1 << 3;
export const CM_SIDE = 1 << 4;
export const CM_UP = 1 << 5;
export const CM_BUTTONS = 1 << 6;
export const CM_IMPULSE = 1 << 7;

/**
 * MSG_WriteDeltaUsercmd (qcommon/common.c): a bit byte naming the fields that differ from
 * `from`, those fields, then msec and lightlevel, which always go.
 */
export function writeDeltaUserCommand(writer: BinaryWriter, from: UserCommand, cmd: UserCommand): void {
  let bits = 0;
  if (cmd.angles.x !== from.angles.x) bits |= CM_ANGLE1;
  if (cmd.angles.y !== from.angles.y) bits |= CM_ANGLE2;
  if (cmd.angles.z !== from.angles.z) bits |= CM_ANGLE3;
  if (cmd.forwardmove !== from.forwardmove) bits |= CM_FORWARD;
  if (cmd.sidemove !== from.sidemove) bits |= CM_SIDE;
  if (cmd.upmove !== from.upmove) bits |= CM_UP;
  if (cmd.buttons !== from.buttons) bits |= CM_BUTTONS;
  if (cmd.impulse !== from.impulse) bits |= CM_IMPULSE;

  writer.writeByte(bits);
  if (bits & CM_ANGLE1) writer.writeAngle16(cmd.angles.x);
  if (bits & CM_ANGLE2) writer.writeAngle16(cmd.angles.y);
  if (bits & CM_ANGLE3) writer.writeAngle16(cmd.angles.z);
  if (bits & CM_FORWARD) writer.writeShort(cmd.forwardmove);
  if (bits & CM_SIDE) writer.writeShort(cmd.sidemove);
  if (bits & CM_UP) writer.writeShort(cmd.upmove);
  if (bits & CM_BUTTONS) writer.writeByte(cmd.buttons);
  if (bits & CM_IMPULSE) writer.writeByte(cmd.impulse);
  writer.writeByte(cmd.msec);
  writer.writeByte(cmd.lightlevel ?? 0);
}

/**
 * clc_move's three commands, as CL_SendCmd (client/cl_input.c) writes them: the two before this
 * one, then this one, so the server can run the commands of up to two lost packets from the
 * next one that arrives (SV_ExecuteClientMessage). Each is a delta from the one before, the
 * oldest from the null command (MSG_WriteDeltaUsercmd). `history` ends with the command being
 * sent; missing older ones are NULL_USER_COMMAND.
 */
export function writeMoveCommands(writer: BinaryWriter, history: readonly UserCommand[]): void {
  const at = (back: number) => history[history.length - 1 - back] ?? NULL_USER_COMMAND;
  const oldest = at(2);
  const old = at(1);
  writeDeltaUserCommand(writer, NULL_USER_COMMAND, oldest);
  writeDeltaUserCommand(writer, oldest, old);
  writeDeltaUserCommand(writer, old, at(0));
}
