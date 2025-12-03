
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkMessageParser, U_ORIGIN1, U_ORIGIN2, U_ORIGIN3, U_ALPHA, U_SCALE, PROTOCOL_VERSION_RERELEASE } from '../../src/demo/parser';
import { BinaryStream, ServerCommand } from '@quake2ts/shared';

// Helper to create a byte array for testing
class ByteBuilder {
  private parts: (number[] | Uint8Array)[] = [];

  addByte(val: number) {
    this.parts.push([val & 0xFF]);
    return this;
  }

  addShort(val: number) {
    this.parts.push([val & 0xFF, (val >> 8) & 0xFF]);
    return this;
  }

  addLong(val: number) {
    this.parts.push([
      val & 0xFF,
      (val >> 8) & 0xFF,
      (val >> 16) & 0xFF,
      (val >> 24) & 0xFF
    ]);
    return this;
  }

  addFloat(val: number) {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, val, true);
    this.parts.push(new Uint8Array(buffer));
    return this;
  }

  addString(str: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    this.parts.push(data);
    this.parts.push([0]); // Null terminator
    return this;
  }

  addPos(x: number, y: number, z: number) {
    this.addShort(x * 8);
    this.addShort(y * 8);
    this.addShort(z * 8);
    return this;
  }

  addCoord(val: number) {
    this.addShort(val * 8);
    return this;
  }

  addAngle(val: number) {
    // mapped to byte
    this.addByte(Math.floor(val * 256 / 360));
    return this;
  }

  addAngle16(val: number) {
      this.addShort(Math.floor(val * 65536 / 360));
      return this;
  }

  build(): Uint8Array {
    let totalLength = 0;
    for (const p of this.parts) totalLength += p.length;
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const p of this.parts) {
      const arr = Array.isArray(p) ? new Uint8Array(p) : p;
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
}

describe('NetworkMessageParser Synthetic Tests', () => {
  let handler: any;

  beforeEach(() => {
    handler = {
      onServerData: vi.fn(),
      onConfigString: vi.fn(),
      onSpawnBaseline: vi.fn(),
      onFrame: vi.fn(),
      onPrint: vi.fn(),
      onCenterPrint: vi.fn(),
      onSound: vi.fn(),
      onTempEntity: vi.fn(),
      onLayout: vi.fn(),
      onInventory: vi.fn(),
      onMuzzleFlash: vi.fn(),
      onDisconnect: vi.fn(),
      onReconnect: vi.fn(),
      onDownload: vi.fn(),
      onSplitClient: vi.fn(),
      onLevelRestart: vi.fn(),
      onLocPrint: vi.fn(),
      onWaitingForPlayers: vi.fn(),
      onBotChat: vi.fn(),
      onPoi: vi.fn(),
      onHelpPath: vi.fn(),
      onMuzzleFlash3: vi.fn(),
      onAchievement: vi.fn(),
    };
  });

  const createParser = (data: Uint8Array) => {
    const stream = new BinaryStream(data.buffer);
    return new NetworkMessageParser(stream, handler);
  };

  it('should parse Rerelease ServerData', () => {
    const bb = new ByteBuilder();
    bb.addByte(ServerCommand.serverdata); // command (which is 7 in vanilla but translated by parser if known, here we init)
    // Actually the parser expects the first byte to be the command.
    // If protocolVersion is 0, it translates 7 or 12 to serverdata.
    // Rerelease protocol is 2023.

    // serverdata body
    bb.addLong(PROTOCOL_VERSION_RERELEASE);
    bb.addLong(1234); // spawncount
    bb.addByte(0); // demoType (0=game)
    bb.addByte(1); // tickRate
    bb.addString("baseq2"); // gameDir
    bb.addShort(0); // playerNum
    bb.addString("maps/base1.bsp"); // levelName

    const parser = createParser(bb.build());
    parser.parseMessage();

    expect(handler.onServerData).toHaveBeenCalledWith(
        PROTOCOL_VERSION_RERELEASE,
        1234,
        0,
        "baseq2",
        0,
        "maps/base1.bsp",
        1,
        0
    );
  });

  it('should parse Vanilla ServerData', () => {
      const bb = new ByteBuilder();
      bb.addByte(7); // serverdata command for vanilla

      bb.addLong(34); // protocol version
      bb.addLong(1234); // server count
      bb.addByte(0); // attract loop
      bb.addString("baseq2");
      bb.addShort(0); // playerNum
      bb.addString("maps/base1.bsp");

      const parser = createParser(bb.build());
      parser.parseMessage();

      expect(handler.onServerData).toHaveBeenCalledWith(
          34, 1234, 0, "baseq2", 0, "maps/base1.bsp"
      );
  });

  it('should parse Rerelease Entity Delta with extensions', () => {
    // First we need to set protocol version to Rerelease
    const bb = new ByteBuilder();
    // ServerData to switch mode
    bb.addByte(ServerCommand.serverdata);
    bb.addLong(PROTOCOL_VERSION_RERELEASE);
    bb.addLong(0); bb.addByte(0); bb.addByte(0); bb.addString(""); bb.addShort(0); bb.addString("");

    // svc_frame (Protocol 2023 requires packetentities INSIDE frame)
    bb.addByte(ServerCommand.frame);
    bb.addLong(1); // serverFrame
    bb.addLong(0); // deltaFrame
    bb.addByte(0); // suppressCount
    bb.addByte(0); // areaBytes
    // no areaBits

    // svc_playerinfo (Required inside frame)
    bb.addByte(ServerCommand.playerinfo);
    bb.addShort(0); // flags
    bb.addLong(0); // stats

    // Now PacketEntities (Inside frame)
    bb.addByte(ServerCommand.packetentities);

    // Entity 1
    // Bits: U_ORIGIN1 | U_ALPHA | U_SCALE | U_MOREBITS1 | U_MOREBITS2 | U_MOREBITS4
    // U_ORIGIN1 = 1<<0 = 1
    // U_ALPHA = 1<<13
    // U_SCALE = 1<<28
    // U_MOREBITS1 = 1<<7
    // U_MOREBITS2 = 1<<15
    // U_MOREBITS4 = 1<<31

    // Byte 1: U_ORIGIN1 (1) | U_MOREBITS1 (128) = 129
    // Byte 2: (U_ALPHA >> 8) | 0x80 = (0x2000 >> 8) | 0x80 = 0x20 | 0x80 = 0xA0
    // Byte 3: 0 | 0x80 = 0x80
    // Byte 4: (U_SCALE >> 24) = (1<<28 >> 24) = 1<<4 = 0x10. No U_MOREBITS4 this time.

    // Entity Header
    bb.addByte(0x81); // Byte 1
    bb.addByte(0xA0); // Byte 2
    bb.addByte(0x80); // Byte 3
    bb.addByte(0x10); // Byte 4

    bb.addByte(1); // Entity Number (8-bit because U_NUMBER16 not set)

    // Now payload data
    // U_ORIGIN1 -> 1 coord
    bb.addCoord(10.5);

    // U_ALPHA -> 1 byte
    bb.addByte(128); // 128/255 approx 0.5

    // U_SCALE -> 1 float
    bb.addFloat(2.5);

    // End of packetentities (entity num 0)
    // We need a header that results in entity num 0.
    // 0x00 works (no morebits, no number16, num=0)
    // Actually, parseEntityBits reads 'total' then checks U_NUMBER16.
    // If total=0, number=readByte()=0.
    bb.addByte(0); // Header byte 1 -> 0
    bb.addByte(0); // Number -> 0

    const parser = createParser(bb.build());
    parser.parseMessage(); // Parses serverdata and frame

    // We expect onFrame to be called with packet entities
    expect(handler.onFrame).toHaveBeenCalled();
    const callArgs = handler.onFrame.mock.calls[0][0];
    expect(callArgs.packetEntities.entities).toHaveLength(1);
    const ent = callArgs.packetEntities.entities[0];

    expect(ent.number).toBe(1);
    expect(ent.origin.x).toBe(10.5);
    expect(ent.alpha).toBeCloseTo(128/255, 4);
    expect(ent.scale).toBe(2.5);
  });

  it('should parse Rerelease svc_muzzleflash3', () => {
    // Protocol switch
    const bb = new ByteBuilder();
    bb.addByte(ServerCommand.serverdata);
    bb.addLong(PROTOCOL_VERSION_RERELEASE);
    bb.addLong(0); bb.addByte(0); bb.addByte(0); bb.addString(""); bb.addShort(0); bb.addString("");

    // MuzzleFlash3
    bb.addByte(ServerCommand.muzzleflash3);
    bb.addShort(42); // ent
    bb.addShort(5); // weapon

    const parser = createParser(bb.build());
    parser.parseMessage();

    expect(handler.onMuzzleFlash3).toHaveBeenCalledWith(42, 5);
  });

  it('should parse Rerelease svc_locprint', () => {
      // Protocol switch
      const bb = new ByteBuilder();
      bb.addByte(ServerCommand.serverdata);
      bb.addLong(PROTOCOL_VERSION_RERELEASE);
      bb.addLong(0); bb.addByte(0); bb.addByte(0); bb.addString(""); bb.addShort(0); bb.addString("");

      // LocPrint
      bb.addByte(ServerCommand.locprint);
      bb.addByte(1); // flags
      bb.addString("You killed %s"); // base
      bb.addByte(1); // numArgs
      bb.addString("Strogg"); // arg1

      const parser = createParser(bb.build());
      parser.parseMessage();

      expect(handler.onLocPrint).toHaveBeenCalledWith(1, "You killed %s", ["Strogg"]);
  });

});
