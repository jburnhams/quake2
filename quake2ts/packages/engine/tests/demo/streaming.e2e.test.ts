import { describe, it, expect, vi } from 'vitest';
import { StreamingBuffer } from '../../src/stream/streamingBuffer.js';
import { NetworkMessageParser, NetworkMessageHandler } from '../../src/demo/parser.js';
import { DemoStream } from '../../src/demo/demoStream.js';
import { ServerCommand } from '@quake2ts/shared';

// Helper to create synthetic demo blocks
class DemoBuilder {
    private blocks: Uint8Array[] = [];

    startBlock(): BlockBuilder {
        return new BlockBuilder(this);
    }

    addBlock(data: Uint8Array) {
        this.blocks.push(data);
    }

    build(): ArrayBuffer {
        let totalSize = 0;
        for (const block of this.blocks) {
            totalSize += 4 + block.length;
        }
        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        const uint8 = new Uint8Array(buffer);
        let offset = 0;
        for (const block of this.blocks) {
            view.setUint32(offset, block.length, true);
            offset += 4;
            uint8.set(block, offset);
            offset += block.length;
        }
        return buffer;
    }
}

class BlockBuilder {
    private data: number[] = [];

    constructor(private parent: DemoBuilder) {}

    writeByte(b: number): BlockBuilder {
        this.data.push(b & 0xFF);
        return this;
    }

    writeShort(s: number): BlockBuilder {
        this.data.push(s & 0xFF);
        this.data.push((s >> 8) & 0xFF);
        return this;
    }

    writeLong(l: number): BlockBuilder {
        this.data.push(l & 0xFF);
        this.data.push((l >> 8) & 0xFF);
        this.data.push((l >> 16) & 0xFF);
        this.data.push((l >> 24) & 0xFF);
        return this;
    }

    writeString(s: string): BlockBuilder {
        for (let i = 0; i < s.length; i++) {
            this.data.push(s.charCodeAt(i));
        }
        this.data.push(0);
        return this;
    }

    writeBytes(bytes: number[] | Uint8Array): BlockBuilder {
        for (const b of bytes) {
            this.data.push(b);
        }
        return this;
    }

    endBlock(): void {
        this.parent.addBlock(new Uint8Array(this.data));
    }
}

describe('Streaming Parser E2E', () => {
    it('should parse messages spanning multiple blocks', () => {
        const builder = new DemoBuilder();

        // Block 1: ServerData command start
        // Protocol version 34.

        // Block 1: Command + Protocol (partial)
        builder.startBlock()
            .writeByte(ServerCommand.serverdata) // 12
            .writeByte(34) // Protocol 34 (byte 1)
            .endBlock();

        // Block 2: Protocol (rest) + ServerCount + AttractLoop + GameDir (partial)
        builder.startBlock()
            .writeByte(0).writeByte(0).writeByte(0) // Protocol (rest of long) -> 34
            .writeLong(123) // ServerCount
            .writeByte(1) // AttractLoop
            .writeString("baseq2") // GameDir
            .writeShort(0) // PlayerNum
            .writeString("maps/test") // LevelName
            .endBlock();

        // Block 3: ConfigString
        // Protocol 34 svc_configstring is 13 or 14?
        // 14 is configstring in Q2.
        // But writer test expects 13? No, writer.test.ts defines WIRE_CONFIGSTRING=14.
        // Wait, e2e test wrote 13 in original.
        // Let's use ServerCommand.configstring (13 in shared enum).
        // If I write 13, and Parser (legacy) maps 13 to serverdata (LegacyProtocolHandler translates 13->serverdata).
        // Wait, `LegacyProtocolHandler`:
        // if (cmd===7) serverdata
        // if (cmd===12) serverdata
        // if (cmd===0) bad
        // translated = cmd + 5.
        // if (13) -> 18 (packetentities).
        // So 13 is NOT configstring in Legacy.
        // 14 is configstring. 14+5=19 (deltapacketentities??).
        // Let's check `LegacyProtocolHandler`.
        // translated = cmd + 5.
        // `ServerCommand` enum:
        // configstring = 13.
        // Legacy wire = 14.
        // If I send 13: 13+5 = 18 = packetentities.
        // If I send 14: 14+5 = 19 = deltapacketentities.
        // Something is wrong with Legacy mapping or I am misremembering.
        // `LegacyProtocolHandler`:
        // `PROTO34_MAP` in `quake2.ts` (which is used for version 34) handles 34.
        // `LegacyProtocolHandler` (for older) uses `cmd+5`.
        // `streaming.e2e` sets protocol 34.
        // So it uses `Quake2ProtocolHandler` (which has `PROTO34_MAP`).
        // `PROTO34_MAP` maps 14 -> `ServerCommand.configstring` (13).
        // So we should write 14.

        builder.startBlock()
            .writeByte(14) // svc_configstring (Wire 14)
            .writeShort(1)
            .writeString("gamename")
            .endBlock();

        const demoData = builder.build();
        const demoStream = new DemoStream(demoData);
        demoStream.loadComplete(); // Load all blocks into streaming buffer

        const handler = {
            onServerData: vi.fn(),
            onConfigString: vi.fn(),
            onFrame: vi.fn(),
            onPrint: vi.fn(),
            onCenterPrint: vi.fn(),
            onSound: vi.fn(),
            onTempEntity: vi.fn(),
            onLayout: vi.fn(),
            onInventory: vi.fn(),
            onMuzzleFlash: vi.fn(),
            onMuzzleFlash2: vi.fn(),
            onDisconnect: vi.fn(),
            onReconnect: vi.fn(),
            onDownload: vi.fn(),
            onStuffText: vi.fn(),
        };

        const parser = new NetworkMessageParser(demoStream.getBuffer(), handler, true);
        parser.parseMessage();

        expect(handler.onServerData).toHaveBeenCalledTimes(1);
        expect(handler.onServerData).toHaveBeenCalledWith(34, 123, 1, "baseq2", 0, "maps/test", undefined, undefined);

        expect(handler.onConfigString).toHaveBeenCalledTimes(1);
        expect(handler.onConfigString).toHaveBeenCalledWith(1, "gamename");
    });

    it('should handle split string across blocks', () => {
        const builder = new DemoBuilder();

        // Setup Protocol 34 first
        builder.startBlock()
            .writeByte(ServerCommand.serverdata)
            .writeLong(34)
            .writeLong(1)
            .writeByte(0)
            .writeString("base")
            .writeShort(0)
            .writeString("map")
            .endBlock();

        // Split Print command
        // Block 2: Command + Level + Part of string
        // Protocol 34 print = 11.
        builder.startBlock()
            .writeByte(11) // ServerCommand.print (Wire 11)
            .writeByte(1) // Level
            .writeBytes([ 'H'.charCodeAt(0), 'e'.charCodeAt(0) ])
            .endBlock();

        // Block 3: Rest of string
        builder.startBlock()
            .writeBytes([ 'l'.charCodeAt(0), 'l'.charCodeAt(0), 'o'.charCodeAt(0), 0 ])
            .endBlock();

        const demoStream = new DemoStream(builder.build());
        demoStream.loadComplete();

        const handler = {
            onServerData: vi.fn(),
            onPrint: vi.fn(),
            onConfigString: vi.fn(),
            onFrame: vi.fn(),
            onCenterPrint: vi.fn(),
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

        const parser = new NetworkMessageParser(demoStream.getBuffer(), handler, true);
        parser.parseMessage();

        expect(handler.onPrint).toHaveBeenCalledWith(1, "Hello");
    });
});
