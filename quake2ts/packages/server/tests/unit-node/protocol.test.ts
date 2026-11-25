import { describe, it, expect, vi } from 'vitest';
import { ClientMessageParser, ClientMessageHandler } from '../../src/protocol.js';
import { BinaryWriter, BinaryStream, ClientCommand } from '@quake2ts/shared';
import { writeMoveCommands } from '@quake2ts/shared';

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

  it('reads delta-encoded commands back as they were sent (MSG_ReadDeltaUsercmd)', () => {
    const writer = new BinaryWriter();
    writer.writeByte(ClientCommand.move);
    writer.writeByte(0);
    writer.writeLong(0);
    const history = [
      { msec: 25, buttons: 0, angles: { x: 0, y: 90, z: 0 }, forwardmove: 400, sidemove: 0, upmove: 0, impulse: 0, lightlevel: 0, sequence: 0 },
      { msec: 25, buttons: 2, angles: { x: 0, y: 90, z: 0 }, forwardmove: 400, sidemove: 0, upmove: 0, impulse: 0, lightlevel: 0, sequence: 0 },
      { msec: 16, buttons: 2, angles: { x: -10, y: 135, z: 0 }, forwardmove: 0, sidemove: -200, upmove: 200, impulse: 7, lightlevel: 0, sequence: 0 },
    ];
    writeMoveCommands(writer, history);
    const bytes = writer.getData();

    const handler = { onMove: vi.fn(), onUserInfo: vi.fn(), onStringCmd: vi.fn(), onNop: vi.fn(), onBad: vi.fn() };
    new ClientMessageParser(new BinaryStream(bytes.buffer), handler).parseMessage();
    const { oldest, old, current } = handler.onMove.mock.calls[0][2];
    for (const [got, want] of [[oldest, history[0]], [old, history[1]], [current, history[2]]] as const) {
      expect(got.msec).toBe(want.msec);
      expect(got.buttons).toBe(want.buttons);
      expect(got.forwardmove).toBe(want.forwardmove);
      expect(got.sidemove).toBe(want.sidemove);
      expect(got.upmove).toBe(want.upmove);
      expect(got.impulse).toBe(want.impulse);
      expect(got.angles.y).toBeCloseTo(want.angles.y, 1);
      expect(got.angles.x).toBeCloseTo(want.angles.x, 1);
    }
    // 6 header bytes, then each command's bit byte, its changed fields, and msec and light:
    // the oldest changes yaw and forward, the old only buttons, the newest pitch, yaw, the
    // three moves and impulse.
    expect(bytes.length).toBe(6 + (1 + 2 + 2 + 2) + (1 + 1 + 2) + (1 + 2 + 2 + 2 + 2 + 2 + 1 + 2));
  });

  it('should parse Move command (UserCmd)', () => {
    const writer = new BinaryWriter();
    writer.writeByte(ClientCommand.move);
    writer.writeByte(123); // Checksum
    writer.writeLong(100); // LastFrame
    // Three commands, oldest first, each a delta from the one before, as CL_SendCmd sends them.
    const makeCmd = (msec: number) => ({
      msec, buttons: 1, angles: { x: 0, y: 0, z: 0 }, forwardmove: 200, sidemove: 100, upmove: 50,
      impulse: 0, lightlevel: 0, sequence: 0,
    });
    writeMoveCommands(writer, [makeCmd(30), makeCmd(40), makeCmd(50)]);

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
    const [checksum, lastFrame, commands] = (handler.onMove as unknown as any).mock.calls[0];
    expect(checksum).toBe(123);
    expect(lastFrame).toBe(100);
    expect(commands.oldest.msec).toBe(30);
    expect(commands.old.msec).toBe(40);
    const cmd = commands.current;
    expect(cmd.msec).toBe(50);
    expect(cmd.forwardmove).toBe(200);
    expect(cmd.sidemove).toBe(100);
    expect(cmd.upmove).toBe(50);
  });
});
