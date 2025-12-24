import { describe, it, expect, vi } from 'vitest';
import { NetworkMessageParser, createEmptyEntityState, NetworkMessageHandler, ServerCommand, PROTOCOL_VERSION_RERELEASE } from '../../src/demo/parser.js';
import { BinaryStream } from '@quake2ts/shared';
import pako from 'pako';

describe('NetworkMessageParser', () => {
  it('should parse svc_configblast', () => {
    const configStrings = [
        { index: 1, str: "string1" },
        { index: 2, str: "string2" }
    ];

    // Create uncompressed buffer
    const uncompressedData = [];
    for (const cs of configStrings) {
        // Write short (index)
        uncompressedData.push(cs.index & 0xFF, (cs.index >> 8) & 0xFF);
        // Write string (null terminated)
        for (let i = 0; i < cs.str.length; i++) {
            uncompressedData.push(cs.str.charCodeAt(i));
        }
        uncompressedData.push(0);
    }

    const compressed = pako.deflate(new Uint8Array(uncompressedData));

    // Construct the full message
    const buffer = [];
    // ServerCommand.configblast = 22
    buffer.push(22);

    // Compressed size (short)
    buffer.push(compressed.length & 0xFF, (compressed.length >> 8) & 0xFF);

    // Uncompressed size (short)
    buffer.push(uncompressedData.length & 0xFF, (uncompressedData.length >> 8) & 0xFF);

    // Compressed data
    for (const b of compressed) {
        buffer.push(b);
    }

    const stream = new BinaryStream(new Uint8Array(buffer).buffer);
    const handler: NetworkMessageHandler = {
        onServerData: vi.fn(),
        onConfigString: vi.fn(),
        onSpawnBaseline: vi.fn(),
        onFrame: vi.fn(),
        onCenterPrint: vi.fn(),
        onStuffText: vi.fn(),
        onPrint: vi.fn(),
        onSound: vi.fn(),
        onTempEntity: vi.fn(),
        onLayout: vi.fn(),
        onInventory: vi.fn(),
        onMuzzleFlash: vi.fn(),
        onMuzzleFlash2: vi.fn(),
        onDisconnect: vi.fn(),
        onReconnect: vi.fn(),
        onDownload: vi.fn(),
        onConfigBlast: vi.fn() // Unused by implementation
    };

    const parser = new NetworkMessageParser(stream, handler);
    // Force protocol to Rerelease to avoid translation if needed (though 22 maps to 22)
    // Actually we need to set protocolVersion.
    // We can simulate it by reading a serverdata packet first, or just relying on default mapping
    // where unknown commands are returned as-is (which matches current logic if version=0).

    parser.parseMessage();

    // The parser now internally calls onConfigString for each entry
    expect(handler.onConfigString).toHaveBeenCalledTimes(2);
    expect(handler.onConfigString).toHaveBeenNthCalledWith(1, 1, "string1");
    expect(handler.onConfigString).toHaveBeenNthCalledWith(2, 2, "string2");
  });

  it('should parse svc_spawnbaselineblast', () => {
      // Mock some baseline data
      // svc_spawnbaseline uses parseEntityBits -> parseDelta
      // Let's create a simple entity delta.
      // parseEntityBits reads: [byte] bits ... [short/byte] number
      // parseDelta reads: ...

      // Let's create a dummy baseline for entity 1.
      // Bits: U_NUMBER16 (1<<8) -> byte 1 must have bit 8 set? No, parseEntityBits is weird.
      // total = readByte(). if total & U_NUMBER16 (1<<8), wait U_NUMBER16 is 256.
      // U_NUMBER16 is (1<<8). parseEntityBits reads byte.
      // U_NUMBER16 is > 255. So checking `total & U_NUMBER16` on a byte read is impossible unless bits are shifted.

      // Look at parseEntityBits:
      // let total = this.stream.readByte();
      // if (total & U_MOREBITS1) total |= (readByte() << 8); ...

      // U_NUMBER16 = (1 << 8). So we need U_MOREBITS1 (1<<7) set in first byte.

      const entityNumber = 123;
      const modelIndex = 5;

      // We want to construct valid bitstream for parseSpawnBaseline.
      // Let's try minimal bits.
      // First byte: 0 (number is byte, no more bits)
      // Number: entityNumber (must be < 256 for byte)
      // Delta bits: U_MODEL (1<<11). Needs U_MOREBITS1 in delta bits?
      // parseDelta: to.bits = bits.
      // It uses bits to read properties.

      // Let's encode:
      // Entity Header:
      // Byte 1: 0 (No more bits for header).
      // Byte 2: entityNumber (123).
      // Wait, parseEntityBits:
      // total = readByte(). If total & U_MOREBITS1...
      // if (total & U_NUMBER16) ... else readByte().
      // If we send 0x00, total=0. U_NUMBER16 is false. ReadByte -> number.
      // So Entity Header = [0x00, 123].
      // Bits passed to parseDelta is 0x00.

      // But we want to test that it actually parses something.
      // Let's set U_MODEL (1<<11).
      // Header needs to be 2 bytes to hold bit 11?
      // No, parseEntityBits returns { number, bits }.
      // The 'bits' returned is the 'total' read from 1-4 bytes.
      // To have bit 11 (U_MODEL) set:
      // Byte 1: 0x80 (U_MOREBITS1).
      // Byte 2: 0x08 (0x08 << 8 = 0x800 = 2048 = 1<<11).
      // Total = 0x80 | 0x800 = 0x880.
      // U_MODEL is 1<<11 = 2048. 0x800 is 2048.
      // So byte 2 should be 0x08.
      // And we need U_MOREBITS1 (0x80) in byte 1.

      // Entity Header: [0x80, 0x08].
      // Number: readByte() (since U_NUMBER16 is 1<<8=256, and 0x880 & 256 is 0? 0x880 = 1000 1000 0000. Bit 8 is 0.
      // 256 is 0x100. 0x880 has bit 11 and bit 7 set.
      // So number is readByte().
      // Let's say entity 123.

      // Content:
      // parseDelta sees U_MODEL. Reads byte.
      // Let's say modelIndex 5.

      const baselineData = [
          0x80, 0x08, // Header (U_MOREBITS1 | U_MODEL)
          123,        // Entity Number
          5           // Model Index
      ];

      const compressed = pako.deflate(new Uint8Array(baselineData));

      const buffer = [];
      buffer.push(23); // svc_spawnbaselineblast

      buffer.push(compressed.length & 0xFF, (compressed.length >> 8) & 0xFF);
      buffer.push(baselineData.length & 0xFF, (baselineData.length >> 8) & 0xFF);

      for (const b of compressed) {
          buffer.push(b);
      }

      const stream = new BinaryStream(new Uint8Array(buffer).buffer);
      const handler: NetworkMessageHandler = {
          onServerData: vi.fn(),
          onConfigString: vi.fn(),
          onSpawnBaseline: vi.fn(),
          onFrame: vi.fn(),
          onCenterPrint: vi.fn(),
          onStuffText: vi.fn(),
          onPrint: vi.fn(),
          onSound: vi.fn(),
          onTempEntity: vi.fn(),
          onLayout: vi.fn(),
          onInventory: vi.fn(),
          onMuzzleFlash: vi.fn(),
          onMuzzleFlash2: vi.fn(),
          onDisconnect: vi.fn(),
          onReconnect: vi.fn(),
          onDownload: vi.fn(),
          onConfigBlast: vi.fn()
      };

      const parser = new NetworkMessageParser(stream, handler);
      parser.parseMessage();

      expect(handler.onSpawnBaseline).toHaveBeenCalledTimes(1);
      const entity = (handler.onSpawnBaseline as any).mock.calls[0][0];
      expect(entity.number).toBe(123);
      expect(entity.modelindex).toBe(5);
  });
});
