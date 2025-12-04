
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NetworkMessageParser, NetworkMessageHandler } from '../../src/demo/parser.js';
import { BinaryStream } from '@quake2ts/shared';
import { ServerCommand } from '@quake2ts/shared';
import { TempEntity } from '@quake2ts/shared';

// Helper to create a binary stream from bytes
const createStream = (bytes: number[]): BinaryStream => {
  const buffer = new Uint8Array(bytes);
  return new BinaryStream(buffer);
};

// Helper to write values to a byte array (mimicking server writing)
const writeByte = (arr: number[], val: number) => arr.push(val & 0xFF);
const writeShort = (arr: number[], val: number) => {
  arr.push(val & 0xFF);
  arr.push((val >> 8) & 0xFF);
};
const writeLong = (arr: number[], val: number) => {
  arr.push(val & 0xFF);
  arr.push((val >> 8) & 0xFF);
  arr.push((val >> 16) & 0xFF);
  arr.push((val >> 24) & 0xFF);
};
const writeString = (arr: number[], str: string) => {
  for (let i = 0; i < str.length; i++) {
    arr.push(str.charCodeAt(i));
  }
  arr.push(0); // Null terminator
};
const writeCoord = (arr: number[], val: number) => writeShort(arr, Math.floor(val * 8));
const writeAngle = (arr: number[], val: number) => writeByte(arr, Math.floor(val * 256 / 360));
const writeAngle16 = (arr: number[], val: number) => writeShort(arr, Math.floor(val * 65536 / 360));
const writeFloat = (arr: number[], val: number) => {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, val, true);
    for (let i = 0; i < 4; i++) {
        arr.push(view.getUint8(i));
    }
};
const writeDir = (arr: number[], val: {x:number, y:number, z:number}) => {
    // Simplified: just write 0 (up) for tests unless we need precision.
    // The parser just looks up ANORMS index.
    // Let's write 0.
    arr.push(0);
};

describe('NetworkMessageParser', () => {

  it('should parse svc_serverdata and set protocol version', () => {
    const data: number[] = [];
    writeByte(data, ServerCommand.serverdata);
    writeLong(data, 34); // Protocol 34
    writeLong(data, 123); // Server count
    writeByte(data, 1); // isDemo (RECORD_CLIENT)
    writeString(data, "baseq2");
    writeShort(data, 1); // Player num
    writeString(data, "q2dm1");

    const stream = createStream(data);
    const parser = new NetworkMessageParser(stream);

    // We can't inspect private state easily without casting to any or adding getters,
    // but we can verify it parses without error and advances stream.
    parser.parseMessage();
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_frame for protocol 34 (skipping extra byte)', () => {
    // Protocol 34 should read an extra byte in parseFrame
    const data: number[] = [];

    // First set protocol to 34 via serverdata
    writeByte(data, ServerCommand.serverdata);
    writeLong(data, 34);
    writeLong(data, 0); writeByte(data, 0); writeString(data, ""); writeShort(data, 0); writeString(data, "");

    // Now svc_frame
    writeByte(data, ServerCommand.frame);
    writeLong(data, 100); // seq1
    writeLong(data, 99); // seq2
    writeByte(data, 0); // UK_B1 (surpress count) - READ ONLY IF NOT PROTOCOL 26
    writeByte(data, 0); // Area count
    // No area bytes since count is 0

    // svc_playerinfo MUST follow svc_frame in this parser implementation
    writeByte(data, ServerCommand.playerinfo);
    writeShort(data, 0); // flags
    writeLong(data, 0); // stats

    const stream = createStream(data);
    const parser = new NetworkMessageParser(stream);
    parser.parseMessage();
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_frame for protocol 26 (NOT skipping extra byte)', () => {
    // Protocol 26 should NOT read an extra byte
    const data: number[] = [];

    // Set protocol to 26
    writeByte(data, ServerCommand.serverdata);
    writeLong(data, 26);
    writeLong(data, 0); writeByte(data, 0); writeString(data, ""); writeShort(data, 0); writeString(data, "");

    // svc_frame
    writeByte(data, ServerCommand.frame);
    writeLong(data, 100);
    writeLong(data, 99);
    // Protocol 26 skips suppressCount reading.

    writeByte(data, 0); // Area count

    // svc_playerinfo MUST follow svc_frame
    writeByte(data, ServerCommand.playerinfo);
    writeShort(data, 0); // flags
    writeLong(data, 0); // stats

    const stream = createStream(data);
    const parser = new NetworkMessageParser(stream);
    parser.parseMessage();
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_playerinfo', () => {
    const data: number[] = [];
    writeByte(data, ServerCommand.playerinfo);

    const flags = 2 | 256; // ORIGIN (2) + VIEWANGLES (256)
    writeShort(data, flags);

    // ORIGIN
    writeShort(data, 10); writeShort(data, 20); writeShort(data, 30);

    // VIEWANGLES
    writeAngle16(data, 0); writeAngle16(data, 90); writeAngle16(data, 180);

    // STATS
    writeLong(data, 0); // No stats

    const stream = createStream(data);
    const parser = new NetworkMessageParser(stream);
    parser.parseMessage();
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_packetentities with termination', () => {
    const data: number[] = [];
    writeByte(data, ServerCommand.packetentities);

    // Entity 1: minimal bits (number 8bit)
    // bits = 0 (implies number 8bit comes next)
    // Actually bits is first byte.
    // U_NUMBER16 is 1<<8. So if high bit not set, number is byte.
    // Let's send bits=0 (only bits 0-7), followed by number=1
    writeByte(data, 0);
    writeByte(data, 1); // Number 1

    // Entity 0: termination
    writeByte(data, 0); // bits=0
    writeByte(data, 0); // number=0 -> Break

    const stream = createStream(data);
    const parser = new NetworkMessageParser(stream);
    parser.parseMessage();
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_temp_entity', () => {
      const data: number[] = [];
      writeByte(data, ServerCommand.temp_entity);
      writeByte(data, TempEntity.EXPLOSION1);
      writeCoord(data, 100); writeCoord(data, 200); writeCoord(data, 300);

      const stream = createStream(data);
      const parser = new NetworkMessageParser(stream);
      parser.parseMessage();
      expect(stream.hasMore()).toBe(false);
  });

  it('should be resilient to unknown commands', () => {
      const data: number[] = [];
      writeByte(data, 255); // Unknown command
      // Should stop or log warning but not crash
      // (in our impl we return on unknown cmd to avoid desync, or we consume if we knew length)
      // Since we don't know length, we return.

      const stream = createStream(data);
      const parser = new NetworkMessageParser(stream);
      parser.parseMessage();
      // It should have stopped reading.
      expect(stream.hasMore()).toBe(false); // It consumed the byte and returned
  });

  it('should parse complex sequence: frame -> playerinfo -> packetentities', () => {
      const data: number[] = [];
      // svc_frame (proto 34 default)
      writeByte(data, ServerCommand.frame);
      writeLong(data, 1); writeLong(data, 1); writeByte(data, 0); writeByte(data, 0);

      // svc_playerinfo
      writeByte(data, ServerCommand.playerinfo);
      writeShort(data, 0); // No flags
      writeLong(data, 0); // No stats

      // svc_packetentities
      writeByte(data, ServerCommand.packetentities);
      writeByte(data, 0); writeByte(data, 0); // Terminate

      const stream = createStream(data);
      const parser = new NetworkMessageParser(stream);
      parser.parseMessage();
      expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_muzzleflash3', () => {
      const data: number[] = [];
      writeByte(data, ServerCommand.muzzleflash3);
      writeShort(data, 123); // Ent
      writeShort(data, 5); // Weapon (short in muzzleflash3)

      const stream = createStream(data);
      const handlerMock = {
          onMuzzleFlash3: vi.fn(),
          // Implement others as no-ops if needed by implicit calls
      } as unknown as NetworkMessageHandler;

      const parser = new NetworkMessageParser(stream, handlerMock);
      parser.parseMessage();

      expect(handlerMock.onMuzzleFlash3).toHaveBeenCalledWith(123, 5);
      expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_level_restart', () => {
      const data: number[] = [];
      writeByte(data, ServerCommand.level_restart);

      const stream = createStream(data);
      const handlerMock = {
          onLevelRestart: vi.fn(),
      } as unknown as NetworkMessageHandler;

      const parser = new NetworkMessageParser(stream, handlerMock);
      parser.parseMessage();

      expect(handlerMock.onLevelRestart).toHaveBeenCalled();
      expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_serverdata with Rerelease Protocol 2023', () => {
    const data: number[] = [];
    writeByte(data, ServerCommand.serverdata);
    writeLong(data, 2023); // Protocol 2023 (Rerelease)
    writeLong(data, 456); // Spawn count
    writeByte(data, 1); // DemoType (1=demo)
    writeByte(data, 40); // TickRate
    writeString(data, "baseq2"); // GameDir
    writeShort(data, 2); // Player num
    writeString(data, "q2dm1"); // Level Name

    const stream = createStream(data);
    const handlerMock = {
        onServerData: vi.fn(),
    } as unknown as NetworkMessageHandler;

    const parser = new NetworkMessageParser(stream, handlerMock);
    parser.parseMessage();

    expect(handlerMock.onServerData).toHaveBeenCalledWith(2023, 456, 0, "baseq2", 2, "q2dm1", 40, 1);
    expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_fog', () => {
      const data: number[] = [];
      writeByte(data, ServerCommand.fog);
      // bits: BIT_DENSITY(1) | BIT_R(2) = 3.
      // Not writing 0x80 (BIT_MORE_BITS), so single byte.
      writeByte(data, 3);

      // BIT_DENSITY: float density, byte skyfactor
      writeFloat(data, 0.5);
      writeByte(data, 128); // skyfactor

      // BIT_R: byte red
      writeByte(data, 255);

      const stream = createStream(data);
      const handlerMock = {
          onFog: vi.fn(),
      } as unknown as NetworkMessageHandler;

      const parser = new NetworkMessageParser(stream, handlerMock);
      parser.parseMessage();

      expect(handlerMock.onFog).toHaveBeenCalledWith(expect.objectContaining({
          density: expect.closeTo(0.5),
          skyfactor: 128,
          red: 255
      }));
      expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_fog with more bits', () => {
      const data: number[] = [];
      writeByte(data, ServerCommand.fog);
      // Low byte with 0x80 (MORE_BITS) | BIT_DENSITY(1) = 129
      writeByte(data, 129);
      // High byte: BIT_HEIGHTFOG_START_R (1<<0 of high byte -> 1<<8 total) = 1
      writeByte(data, 1);

      // Total bits: BIT_DENSITY | BIT_HEIGHTFOG_START_R | BIT_MORE_BITS

      // BIT_DENSITY fields
      writeFloat(data, 0.1);
      writeByte(data, 50);

      // BIT_HEIGHTFOG_START_R fields
      writeByte(data, 100);

      const stream = createStream(data);
      const handlerMock = {
          onFog: vi.fn(),
      } as unknown as NetworkMessageHandler;

      const parser = new NetworkMessageParser(stream, handlerMock);
      parser.parseMessage();

      expect(handlerMock.onFog).toHaveBeenCalledWith(expect.objectContaining({
          density: expect.closeTo(0.1),
          skyfactor: 50,
          hf_start_r: 100
      }));
      expect(stream.hasMore()).toBe(false);
  });

  it('should parse svc_damage', () => {
      const data: number[] = [];
      writeByte(data, ServerCommand.damage);
      writeByte(data, 1); // 1 indicator

      // Indicator 1
      // damage=10 (0x0A), health=true (0x20) -> 0x2A
      writeByte(data, 0x2A);
      writeDir(data, {x:0, y:0, z:1}); // Up

      const stream = createStream(data);
      const handlerMock = {
          onDamage: vi.fn(),
      } as unknown as NetworkMessageHandler;

      const parser = new NetworkMessageParser(stream, handlerMock);
      parser.parseMessage();

      expect(handlerMock.onDamage).toHaveBeenCalledTimes(1);
      const indicators = (handlerMock.onDamage as any).mock.calls[0][0];
      expect(indicators).toHaveLength(1);
      expect(indicators[0]).toEqual(expect.objectContaining({
          damage: 10,
          health: true,
          armor: false,
          power: false,
          // dir checked roughly
      }));
      expect(stream.hasMore()).toBe(false);
  });

});
