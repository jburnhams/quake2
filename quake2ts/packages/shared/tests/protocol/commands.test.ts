
import { describe, it, expect } from 'vitest';
import { BinaryWriter } from '../../src/io/binaryWriter.js';
import { BinaryStream } from '../../src/io/binaryStream.js';
import { ClientCommand, ServerCommand } from '../../src/protocol/ops.js';
import {
  writeClcMove,
  writeClcUserInfo,
  writeClcStringCmd,
  writeSvcPrint,
  writeSvcCenterPrint,
  writeSvcStuffText,
  writeSvcConfigString,
  writeSvcServerData,
  writeSvcSound
} from '../../src/protocol/commands.js';
import { UserCommand } from '../../src/protocol/usercmd.js';

describe('Protocol Commands', () => {

  describe('Client Commands (clc_)', () => {
    it('writeClcStringCmd should write opcode and string', () => {
      const writer = new BinaryWriter();
      writeClcStringCmd(writer, "status");

      const reader = new BinaryStream(writer.getData());
      expect(reader.readByte()).toBe(ClientCommand.stringcmd);
      expect(reader.readString()).toBe("status");
    });

    it('writeClcUserInfo should write opcode and string', () => {
        const writer = new BinaryWriter();
        writeClcUserInfo(writer, "\\name\\Player\\skin\\male/grunt");

        const reader = new BinaryStream(writer.getData());
        expect(reader.readByte()).toBe(ClientCommand.userinfo);
        expect(reader.readString()).toBe("\\name\\Player\\skin\\male/grunt");
    });

    it('writeClcMove should write opcode and usercmd', () => {
        const writer = new BinaryWriter();
        const cmd: UserCommand = {
            msec: 50,
            buttons: 1, // attack
            angles: { x: 10, y: 20, z: 0 },
            forwardmove: 200,
            sidemove: -100,
            upmove: 0
        };
        writeClcMove(writer, cmd);

        const reader = new BinaryStream(writer.getData());
        expect(reader.readByte()).toBe(ClientCommand.move);

        // Verification of writeUserCmd details is covered in other tests, but we check first fields
        expect(reader.readByte()).toBe(50); // msec
        expect(reader.readByte()).toBe(1); // buttons
    });
  });

  describe('Server Commands (svc_)', () => {
      it('writeSvcPrint should write opcode, level, and string', () => {
          const writer = new BinaryWriter();
          writeSvcPrint(writer, 2, "Hello Client");

          const reader = new BinaryStream(writer.getData());
          expect(reader.readByte()).toBe(ServerCommand.print);
          expect(reader.readByte()).toBe(2);
          expect(reader.readString()).toBe("Hello Client");
      });

      it('writeSvcCenterPrint should write opcode and string', () => {
          const writer = new BinaryWriter();
          writeSvcCenterPrint(writer, "Center Message");

          const reader = new BinaryStream(writer.getData());
          expect(reader.readByte()).toBe(ServerCommand.centerprint);
          expect(reader.readString()).toBe("Center Message");
      });

      it('writeSvcStuffText should write opcode and string', () => {
        const writer = new BinaryWriter();
        writeSvcStuffText(writer, "disconnect\n");

        const reader = new BinaryStream(writer.getData());
        expect(reader.readByte()).toBe(ServerCommand.stufftext);
        expect(reader.readString()).toBe("disconnect\n");
      });

      it('writeSvcConfigString should write opcode, index, and string', () => {
          const writer = new BinaryWriter();
          writeSvcConfigString(writer, 100, "some value");

          const reader = new BinaryStream(writer.getData());
          expect(reader.readByte()).toBe(ServerCommand.configstring);
          expect(reader.readShort()).toBe(100);
          expect(reader.readString()).toBe("some value");
      });

      it('writeSvcServerData should write full server data packet', () => {
          const writer = new BinaryWriter();
          writeSvcServerData(writer, 34, 12345, true, "baseq2", 1, "q2dm1");

          const reader = new BinaryStream(writer.getData());
          expect(reader.readByte()).toBe(ServerCommand.serverdata);
          expect(reader.readLong()).toBe(34);
          expect(reader.readLong()).toBe(12345);
          expect(reader.readByte()).toBe(1);
          expect(reader.readString()).toBe("baseq2");
          expect(reader.readShort()).toBe(1);
          expect(reader.readString()).toBe("q2dm1");
      });

      it('writeSvcSound should handle flags and optional fields', () => {
          const writer = new BinaryWriter();
          // SND_VOLUME (1) | SND_POS (4) = 5
          const flags = 5;
          const pos = { x: 10, y: 20, z: 30 };
          writeSvcSound(writer, flags, 10, 255, undefined, undefined, undefined, pos);

          const reader = new BinaryStream(writer.getData());
          expect(reader.readByte()).toBe(ServerCommand.sound);
          expect(reader.readByte()).toBe(flags);
          expect(reader.readByte()).toBe(10); // soundNum
          expect(reader.readByte()).toBe(255); // volume

          // Position reading
          const outPos = {x:0, y:0, z:0};
          reader.readPos(outPos);
          expect(outPos.x).toBe(10);
          expect(outPos.y).toBe(20);
          expect(outPos.z).toBe(30);
      });
  });
});
