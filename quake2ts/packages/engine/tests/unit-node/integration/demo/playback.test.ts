
import { describe, it, expect, vi } from 'vitest';
import { DemoPlaybackController, PlaybackState } from '../../../../src/demo/playback.js';
import { NetworkMessageHandler, PROTOCOL_VERSION_RERELEASE } from '../../../../src/demo/parser.js';
import { ServerCommand } from '@quake2ts/shared';
import { BinaryStream } from '@quake2ts/shared';
import pako from 'pako';

// Helper to write a basic Rerelease demo stream
function createRereleaseDemoData(): ArrayBuffer {
  // We need to create a buffer that mimics a .dm2 file
  // Header is handled by DemoReader, but we just need blocks for the Controller
  // Block: Length (4 bytes), Data (N bytes)

  // 1. ServerData (Rerelease)
  // 2. ConfigBlast (Compressed)
  // 3. Frame

  const msgBuffer = new ArrayBuffer(4096);
  const msgView = new DataView(msgBuffer);
  let offset = 0;

  // Helper functions for writing
  const writeByte = (val: number) => { msgView.setUint8(offset, val); offset += 1; };
  const writeShort = (val: number) => { msgView.setInt16(offset, val, true); offset += 2; };
  const writeUShort = (val: number) => { msgView.setUint16(offset, val, true); offset += 2; };
  const writeLong = (val: number) => { msgView.setInt32(offset, val, true); offset += 4; };
  const writeString = (val: string) => {
      for (let i = 0; i < val.length; i++) {
          msgView.setInt8(offset, val.charCodeAt(i));
          offset += 1;
      }
      msgView.setInt8(offset, 0); // null terminator
      offset += 1;
  };

  // --- 1. ServerData (Rerelease) ---
  writeByte(7); // svc_serverdata
  writeLong(PROTOCOL_VERSION_RERELEASE); // Protocol 2023
  writeLong(12345); // spawnCount
  writeByte(1); // demoType = 1 (RECORD_CLIENT)
  writeByte(40); // tickRate = 40
  writeString("baseq2"); // gameDir
  writeShort(0); // playerNum
  writeString("demo1"); // levelName

  // --- 2. ConfigBlast (Compressed) ---
  // Create uncompressed data first
  const uncompressedBuffer = new ArrayBuffer(1024);
  const uView = new DataView(uncompressedBuffer);
  let uOffset = 0;

  // Write some config strings: [Index (UShort), String]
  // Index 0: version
  uView.setUint16(uOffset, 0, true); uOffset += 2;
  const str1 = "Rerelease v1.0";
  for (let i = 0; i < str1.length; i++) uView.setUint8(uOffset + i, str1.charCodeAt(i));
  uView.setUint8(uOffset + str1.length, 0);
  uOffset += str1.length + 1;

  // Index 1: name
  uView.setUint16(uOffset, 1, true); uOffset += 2;
  const str2 = "Player";
  for (let i = 0; i < str2.length; i++) uView.setUint8(uOffset + i, str2.charCodeAt(i));
  uView.setUint8(uOffset + str2.length, 0);
  uOffset += str2.length + 1;

  const uncompressedData = new Uint8Array(uncompressedBuffer, 0, uOffset);
  const compressedData = pako.deflate(uncompressedData);

  writeByte(ServerCommand.configblast); // 22
  writeShort(compressedData.byteLength);
  writeShort(uncompressedData.byteLength);

  // Write compressed bytes
  for (let i = 0; i < compressedData.length; i++) {
      writeByte(compressedData[i]);
  }

  // --- 3. Frame ---
  writeByte(ServerCommand.frame);
  writeLong(1); // ServerFrame
  writeLong(0); // DeltaFrame
  writeByte(0); // SuppressCount
  writeByte(0); // AreaBytes
  // AreaBits (0 bytes)

  // PlayerInfo (REQUIRED after frame in parser logic)
  writeByte(ServerCommand.playerinfo);
  writeShort(0); // Flags (0 means no fields follow)
  writeLong(0); // Stats bits (0)

  // PacketEntities (REQUIRED after playerinfo in parser logic)
  writeByte(ServerCommand.packetentities);
  // parseEntityBits reads header byte, then number byte.
  // 0 header, 0 number = End of packet entities.
  writeByte(0); // Header
  writeByte(0); // Entity Number 0

  // End of message
  // No explicit EOF byte needed, block end implies it.

  const msgLen = offset;
  const finalBuffer = new ArrayBuffer(8 + msgLen);

  const view = new DataView(finalBuffer);
  view.setInt32(0, msgLen, true);

  // Copy message data
  const msgBytes = new Uint8Array(msgBuffer, 0, msgLen);
  const finalBytes = new Uint8Array(finalBuffer);
  finalBytes.set(msgBytes, 4);

  return finalBuffer;
}

// Helper to write a basic Vanilla (Protocol 34) demo stream
function createVanillaDemoData(): ArrayBuffer {
  const msgBuffer = new ArrayBuffer(1024);
  const msgView = new DataView(msgBuffer);
  let offset = 0;

  // Helper functions for writing
  const writeByte = (val: number) => { msgView.setUint8(offset, val); offset += 1; };
  const writeShort = (val: number) => { msgView.setInt16(offset, val, true); offset += 2; };
  const writeLong = (val: number) => { msgView.setInt32(offset, val, true); offset += 4; };
  const writeString = (val: string) => {
      for (let i = 0; i < val.length; i++) {
          msgView.setInt8(offset, val.charCodeAt(i));
          offset += 1;
      }
      msgView.setInt8(offset, 0); // null terminator
      offset += 1;
  };

  // --- 1. ServerData (Vanilla) ---
  // Protocol 34 svc_serverdata is 13 (Wire).
  // The parser translates initial cmd 13 to ServerCommand.serverdata (12).
  writeByte(13); // svc_serverdata
  writeLong(34); // Protocol 34
  writeLong(12345); // serverCount
  writeByte(0); // attractLoop (0=game, 1=demo)
  writeString("baseq2"); // gameDir
  writeShort(0); // playerNum
  writeString("demo1"); // levelName

  // --- 2. ConfigString ---
  // Protocol 34 svc_configstring is 14 (Wire).
  // ServerCommand.configstring is 13.
  // Parser maps 14 -> 13.
  writeByte(14); // svc_configstring (Wire 14)
  writeShort(0); // index
  writeString("Vanilla v3.20");

  // --- 3. Frame ---
  // Protocol 34 svc_frame is 5.
  // ServerCommand.frame is 20.
  // Parser maps 5 -> 20.
  writeByte(5); // svc_frame (Wire 5)
  writeLong(1); // ServerFrame
  writeLong(0); // DeltaFrame
  writeByte(0); // SuppressCount
  writeByte(0); // AreaBytes
  // AreaBits (0 bytes)

  // PlayerInfo (REQUIRED after frame in parser logic)
  writeByte(ServerCommand.playerinfo);
  writeShort(0); // Flags
  writeLong(0); // Stats bits

  // PacketEntities (REQUIRED after playerinfo in parser logic)
  // Protocol 34 svc_packetentities is 18.
  writeByte(18); // svc_packetentities (Wire 18)
  writeByte(0); // Header
  writeByte(0); // Entity Number 0

  const msgLen = offset;
  const finalBuffer = new ArrayBuffer(8 + msgLen);
  const view = new DataView(finalBuffer);
  view.setInt32(0, msgLen, true);

  const msgBytes = new Uint8Array(msgBuffer, 0, msgLen);
  const finalBytes = new Uint8Array(finalBuffer);
  finalBytes.set(msgBytes, 4);

  return finalBuffer;
}

describe('DemoPlaybackController Integration', () => {
  it('should parse Rerelease ServerData and ConfigBlast', () => {
    const buffer = createRereleaseDemoData();
    const controller = new DemoPlaybackController();

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
    };

    controller.setHandler(handler);
    controller.loadDemo(buffer);
    controller.play();

    // Trigger update to parse the block
    controller.update(0.15); // > 100ms frame duration

    // 1. Verify ServerData
    expect(handler.onServerData).toHaveBeenCalled();
    const callArgs = (handler.onServerData as any).mock.calls[0];
    expect(callArgs[0]).toBe(PROTOCOL_VERSION_RERELEASE);
    expect(callArgs[6]).toBe(40); // TickRate

    // 2. Verify ConfigBlast (should trigger onConfigString)
    expect(handler.onConfigString).toHaveBeenCalledTimes(2);
    expect(handler.onConfigString).toHaveBeenCalledWith(0, "Rerelease v1.0");
    expect(handler.onConfigString).toHaveBeenCalledWith(1, "Player");

    // 3. Verify Frame
    expect(handler.onFrame).toHaveBeenCalled();
    const frameArgs = (handler.onFrame as any).mock.calls[0][0];
    expect(frameArgs.serverFrame).toBe(1);
  });

  it('should parse Vanilla (Protocol 34) ServerData', () => {
      const buffer = createVanillaDemoData();
      const controller = new DemoPlaybackController();

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
      };

      controller.setHandler(handler);
      controller.loadDemo(buffer);
      controller.play();

      controller.update(0.15);

      // 1. Verify ServerData
      expect(handler.onServerData).toHaveBeenCalled();
      const callArgs = (handler.onServerData as any).mock.calls[0];
      expect(callArgs[0]).toBe(34); // Protocol 34
      expect(callArgs[3]).toBe("baseq2");

      // 2. Verify ConfigString
      expect(handler.onConfigString).toHaveBeenCalledWith(0, "Vanilla v3.20");

      // 3. Verify Frame
      expect(handler.onFrame).toHaveBeenCalled();
  });
});
