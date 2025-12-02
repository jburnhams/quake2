
import { BinaryWriter } from '../io/binaryWriter.js';
import { ClientCommand, ServerCommand } from './ops.js';
import { UserCommand } from './usercmd.js';
import { writeUserCommand } from './writeUserCmd.js';

//
// Client Commands (clc_) - Sent by Client to Server
//

export const writeClcMove = (writer: BinaryWriter, cmd: UserCommand): void => {
  writer.writeByte(ClientCommand.move);
  // clc_move writes checksums and logic in original, but effectively it wraps usercmd
  // Q2 implementation:
  // MSG_WriteByte (&cls.netchan.message, clc_move);
  // MSG_WriteUsercmd (&cls.netchan.message, cmd, false);
  // In Q2, checksums are part of CL_WriteUsercmd / MSG_WriteUsercmd logic.
  // Here we use our writeUserCommand helper.
  writeUserCommand(writer, cmd);
};

export const writeClcUserInfo = (writer: BinaryWriter, userinfo: string): void => {
  writer.writeByte(ClientCommand.userinfo);
  writer.writeString(userinfo);
};

export const writeClcStringCmd = (writer: BinaryWriter, message: string): void => {
  writer.writeByte(ClientCommand.stringcmd);
  writer.writeString(message);
};

export const writeClcNop = (writer: BinaryWriter): void => {
  writer.writeByte(ClientCommand.nop);
};

//
// Server Commands (svc_) - Sent by Server to Client
//

export const writeSvcNop = (writer: BinaryWriter): void => {
  writer.writeByte(ServerCommand.nop);
};

export const writeSvcPrint = (writer: BinaryWriter, level: number, text: string): void => {
  writer.writeByte(ServerCommand.print);
  writer.writeByte(level);
  writer.writeString(text);
};

export const writeSvcCenterPrint = (writer: BinaryWriter, text: string): void => {
  writer.writeByte(ServerCommand.centerprint);
  writer.writeString(text);
};

export const writeSvcStuffText = (writer: BinaryWriter, text: string): void => {
  writer.writeByte(ServerCommand.stufftext);
  writer.writeString(text);
};

export const writeSvcConfigString = (writer: BinaryWriter, index: number, text: string): void => {
  writer.writeByte(ServerCommand.configstring);
  writer.writeShort(index);
  writer.writeString(text);
};

export const writeSvcServerData = (
  writer: BinaryWriter,
  protocolVersion: number,
  serverCount: number,
  attractLoop: boolean,
  gameDir: string,
  playerNum: number,
  levelName: string
): void => {
  writer.writeByte(ServerCommand.serverdata);
  writer.writeLong(protocolVersion);
  writer.writeLong(serverCount);
  writer.writeByte(attractLoop ? 1 : 0);
  writer.writeString(gameDir);
  writer.writeShort(playerNum);
  writer.writeString(levelName);
};

export const writeSvcSound = (
  writer: BinaryWriter,
  flags: number,
  soundNum: number,
  volume?: number,
  attenuation?: number,
  offset?: number,
  ent?: number,
  pos?: { x: number; y: number; z: number }
): void => {
  if ((flags & 4) && !pos) {
    throw new Error('SND_POS flag (4) set but no position provided');
  }

  writer.writeByte(ServerCommand.sound);
  writer.writeByte(flags);
  writer.writeByte(soundNum);
  if (flags & 1) writer.writeByte(volume ?? 0);
  if (flags & 2) writer.writeByte(attenuation ?? 0);
  if (flags & 16) writer.writeByte(offset ?? 0);
  if (flags & 8) writer.writeShort(ent ?? 0);
  if (flags & 4 && pos) writer.writePos(pos);
};
