import { describe, it, expect, vi } from 'vitest';
import { NetworkMessageParser, createEmptyEntityState, NetworkMessageHandler, ServerCommand, PROTOCOL_VERSION_RERELEASE } from '../../../src/demo/parser.js';
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
    parser.setProtocolVersion(PROTOCOL_VERSION_RERELEASE);
    parser.parseMessage();

    // The parser now internally calls onConfigString for each entry
    expect(handler.onConfigString).toHaveBeenCalledTimes(2);
    expect(handler.onConfigString).toHaveBeenNthCalledWith(1, 1, "string1");
    expect(handler.onConfigString).toHaveBeenNthCalledWith(2, 2, "string2");
  });

  it('should parse svc_spawnbaselineblast', () => {
      const entityNumber = 123;
      const modelIndex = 5;

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
      parser.setProtocolVersion(PROTOCOL_VERSION_RERELEASE);
      parser.parseMessage();

      expect(handler.onSpawnBaseline).toHaveBeenCalledTimes(1);
      const entity = (handler.onSpawnBaseline as any).mock.calls[0][0];
      expect(entity.number).toBe(123);
      expect(entity.modelindex).toBe(5);
  });
});
