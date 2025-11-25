import { describe, it, expect, vi } from 'vitest';
import { ClientMessageParser, ClientMessageHandler } from '../src/protocol.js';
import { BinaryWriter, BinaryStream, ClientCommand } from '@quake2ts/shared';

describe('ClientMessageParser', () => {
  it('should parse NOP command', () => {
    const writer = new BinaryWriter();
    writer.writeByte(ClientCommand.nop);

    const stream = new BinaryStream(writer.getData().buffer);
    const handler = {
        onMove: vi.fn(),
        onUserInfo: vi.fn(),
        onStringCmd: vi.fn(),
        onNop: vi.fn(),
        onBad: vi.fn()
    };

    const parser = new ClientMessageParser(stream, handler);
    parser.parseMessage();

    expect(handler.onNop).toHaveBeenCalled();
  });

  it('should parse StringCmd', () => {
      const writer = new BinaryWriter();
      writer.writeByte(ClientCommand.stringcmd);
      writer.writeString("status");

      const stream = new BinaryStream(writer.getData().buffer);
      const handler = {
          onMove: vi.fn(),
          onUserInfo: vi.fn(),
          onStringCmd: vi.fn(),
          onNop: vi.fn(),
          onBad: vi.fn()
      };

      const parser = new ClientMessageParser(stream, handler);
      parser.parseMessage();

      expect(handler.onStringCmd).toHaveBeenCalledWith("status");
  });

  it('should parse UserInfo', () => {
      const writer = new BinaryWriter();
      writer.writeByte(ClientCommand.userinfo);
      writer.writeString("\\name\\Player\\skin\\male/grunt");

      const stream = new BinaryStream(writer.getData().buffer);
      const handler = {
          onMove: vi.fn(),
          onUserInfo: vi.fn(),
          onStringCmd: vi.fn(),
          onNop: vi.fn(),
          onBad: vi.fn()
      };

      const parser = new ClientMessageParser(stream, handler);
      parser.parseMessage();

      expect(handler.onUserInfo).toHaveBeenCalledWith("\\name\\Player\\skin\\male/grunt");
  });

  it('should parse Move command (UserCmd)', () => {
    const writer = new BinaryWriter();
    writer.writeByte(ClientCommand.move);
    writer.writeByte(123); // Checksum
    writer.writeLong(100); // LastFrame
    writer.writeByte(50); // msec
    writer.writeByte(1); // buttons
    writer.writeShort(0); // angles x
    writer.writeShort(0); // angles y
    writer.writeShort(0); // angles z
    writer.writeShort(200); // forward
    writer.writeShort(100); // side
    writer.writeShort(50); // up
    writer.writeByte(0); // impulse
    writer.writeByte(0); // lightlevel

    const stream = new BinaryStream(writer.getData().buffer);
    const handler = {
        onMove: vi.fn(),
        onUserInfo: vi.fn(),
        onStringCmd: vi.fn(),
        onNop: vi.fn(),
        onBad: vi.fn()
    };

    const parser = new ClientMessageParser(stream, handler);
    parser.parseMessage();

    expect(handler.onMove).toHaveBeenCalled();
    const [checksum, lastFrame, cmd] = (handler.onMove as unknown as any).mock.calls[0];
    expect(checksum).toBe(123);
    expect(lastFrame).toBe(100);
    expect(cmd.msec).toBe(50);
    expect(cmd.forwardmove).toBe(200);
    expect(cmd.sidemove).toBe(100);
    expect(cmd.upmove).toBe(50);
  });
});
