
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkMessageParser } from '../../src/demo/parser';
import { BinaryStream, ServerCommand } from '@quake2ts/shared';

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

  addString(str: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    this.parts.push(data);
    this.parts.push([0]); // Null terminator
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

describe('NetworkMessageParser Performance', () => {
    it('should parse 1000 frames with 100 entities each within reasonable time', () => {
        const bb = new ByteBuilder();

        // ServerData to set protocol 34
        bb.addByte(7); // ServerCommand.serverdata (translated)
        bb.addLong(34); // Protocol
        bb.addLong(1); // Server count
        bb.addByte(0); // Attract
        bb.addString("baseq2"); // GameDir
        bb.addShort(0); // PlayerNum
        bb.addString(""); // LevelName

        const FRAMES = 1000;
        const ENTITIES_PER_FRAME = 100;

        for (let f = 0; f < FRAMES; f++) {
            bb.addByte(ServerCommand.frame);
            bb.addLong(f + 1); // serverFrame
            bb.addLong(0); // deltaFrame
            bb.addByte(0); // suppressCount (protocol 34)
            bb.addByte(0); // areaBytes

            // PlayerInfo
            bb.addByte(ServerCommand.playerinfo);
            // Minimal PlayerState
            bb.addShort(0); // flags
            bb.addLong(0); // stats

            // PacketEntities
            bb.addByte(ServerCommand.packetentities);

            for (let e = 1; e <= ENTITIES_PER_FRAME; e++) {
                // Entity header
                // We use U_ORIGIN1 (1) | U_ORIGIN2 (2) = 3

                let bits = 3;
                let number = e;

                // Construct header bits
                // If number >= 256, we need U_NUMBER16 (1<<8)
                // U_NUMBER16 corresponds to bit 0 of the second byte of the header.
                // To read the second byte, the first byte must have U_MOREBITS1 (1<<7) set.

                if (number < 256) {
                    bb.addByte(bits & 0xFF);
                    bb.addByte(number);
                } else {
                    // Set U_MOREBITS1 (0x80) in first byte
                    bb.addByte((bits & 0xFF) | 0x80);
                    // Second byte: U_NUMBER16 (0x01)
                    bb.addByte(0x01);

                    bb.addShort(number);
                }

                // Payload for U_ORIGIN1 and U_ORIGIN2
                bb.addCoord(100); // x
                bb.addCoord(200); // y
            }

            // End of entities (number 0)
            bb.addByte(0); // Header byte 1 -> 0
            bb.addByte(0); // Number -> 0
        }

        const data = bb.build();
        const handler = {
            onServerData: vi.fn(),
            onFrame: vi.fn(),
            onConfigString: vi.fn(),
            onSpawnBaseline: vi.fn(),
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
        } as any;

        const stream = new BinaryStream(data.buffer);
        const parser = new NetworkMessageParser(stream, handler);

        const start = performance.now();
        parser.parseMessage();
        const end = performance.now();
        const duration = end - start;

        console.log(`Parsed ${FRAMES} frames with ${ENTITIES_PER_FRAME} entities each in ${duration.toFixed(2)}ms`);

        expect(duration).toBeLessThan(400); // Setting a reasonable baseline
        expect(handler.onFrame).toHaveBeenCalledTimes(FRAMES);
    });
});
