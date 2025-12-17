import { describe, it, expect } from 'vitest';
import { MessageWriter } from '../../src/demo/writer.js';
import { createEmptyEntityState, createEmptyProtocolPlayerState, FrameData } from '../../src/demo/parser.js';
import { BinaryStream, ServerCommand } from '@quake2ts/shared';

describe('MessageWriter', () => {
    it('writes server data', () => {
        const writer = new MessageWriter();
        writer.writeServerData(34, 123, 1, 'baseq2', 0, 'q2dm1');
        const data = writer.getData();
        const reader = new BinaryStream(data.buffer);
        expect(reader.readByte()).toBe(ServerCommand.serverdata);
        expect(reader.readLong()).toBe(34);
        expect(reader.readLong()).toBe(123);
        expect(reader.readByte()).toBe(1);
        expect(reader.readString()).toBe('baseq2');
        expect(reader.readShort()).toBe(0);
        expect(reader.readString()).toBe('q2dm1');
    });

    it('writes player state', () => {
        const writer = new MessageWriter();
        const ps = createEmptyProtocolPlayerState();
        ps.pm_type = 1;
        ps.origin.x = 100;
        ps.viewangles.y = 90;

        writer.writePlayerState(ps);

        const data = writer.getData();
        const reader = new BinaryStream(data.buffer);

        // Flags
        const flags = reader.readShort();
        // 1 (pm_type) | 2 (origin) | 256 (viewangles) = 1 | 2 | 256 = 259
        expect(flags).toBe(259);

        // Fields in order
        if (flags & 1) expect(reader.readByte()).toBe(1);
        if (flags & 2) {
            expect(reader.readShort()).toBe(100 * 8); // x
            expect(reader.readShort()).toBe(0); // y
            expect(reader.readShort()).toBe(0); // z
        }
        if (flags & 256) {
             expect(reader.readShort()).toBe(0); // x
             expect(reader.readShort()).toBe(Math.trunc(90 * 65536 / 360)); // y = 16384
             expect(reader.readShort()).toBe(0); // z
        }

        // Stat bits
        expect(reader.readLong()).toBe(0);
    });

    it('writes packet entities', () => {
        const writer = new MessageWriter();
        const ent = createEmptyEntityState();
        ent.number = 1;
        ent.modelindex = 10;

        writer.writePacketEntities([ent], false, 34);

        const data = writer.getData();
        const reader = new BinaryStream(data.buffer);

        expect(reader.readByte()).toBe(ServerCommand.packetentities);

        // Entity 1
        const bitsByte = reader.readByte();
        expect(bitsByte & 0x80).toBe(128); // Expect U_MOREBITS1

        // Read next byte
        const bitsByte2 = reader.readByte();
        expect(bitsByte2 & 8).toBe(8);

        // Number
        expect(reader.readByte()).toBe(1);

        // Model
        expect(reader.readByte()).toBe(10);

        // Terminator (0)
        expect(reader.readShort()).toBe(0);
    });

    it('writes frame', () => {
        const writer = new MessageWriter();
        const frame: FrameData = {
            serverFrame: 100,
            deltaFrame: 99,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(0),
            playerState: createEmptyProtocolPlayerState(),
            packetEntities: { delta: true, entities: [] }
        };

        writer.writeFrame(frame, 34);

        const data = writer.getData();
        const reader = new BinaryStream(data.buffer);

        expect(reader.readByte()).toBe(ServerCommand.frame);
        expect(reader.readLong()).toBe(100);
        expect(reader.readLong()).toBe(99);
        expect(reader.readByte()).toBe(0); // surpress
        expect(reader.readByte()).toBe(0); // areaBytes

        expect(reader.readByte()).toBe(ServerCommand.playerinfo);
        // Player state (empty) -> flags=0, stats=0
        expect(reader.readShort()).toBe(0); // flags
        expect(reader.readLong()).toBe(0); // statbits

        expect(reader.readByte()).toBe(ServerCommand.deltapacketentities);
        expect(reader.readShort()).toBe(0); // terminator
    });

    it('writes misc commands', () => {
        const writer = new MessageWriter();
        writer.writeStuffText('cmd\n');
        writer.writeCenterPrint('Hello');
        writer.writePrint(2, 'Message');
        writer.writeLayout('layout');
        writer.writeInventory([1, 2]);
        writer.writeMuzzleFlash(10, 5);
        writer.writeMuzzleFlash2(20, 6);

        const data = writer.getData();
        const reader = new BinaryStream(data.buffer);

        expect(reader.readByte()).toBe(ServerCommand.stufftext);
        expect(reader.readString()).toBe('cmd\n');

        expect(reader.readByte()).toBe(ServerCommand.centerprint);
        expect(reader.readString()).toBe('Hello');

        expect(reader.readByte()).toBe(ServerCommand.print);
        expect(reader.readByte()).toBe(2);
        expect(reader.readString()).toBe('Message');

        expect(reader.readByte()).toBe(ServerCommand.layout);
        expect(reader.readString()).toBe('layout');

        expect(reader.readByte()).toBe(ServerCommand.inventory);
        expect(reader.readShort()).toBe(1);
        expect(reader.readShort()).toBe(2);
        for(let i=2; i<256; i++) expect(reader.readShort()).toBe(0);

        expect(reader.readByte()).toBe(ServerCommand.muzzleflash);
        expect(reader.readShort()).toBe(10);
        expect(reader.readByte()).toBe(5);

        expect(reader.readByte()).toBe(ServerCommand.muzzleflash2);
        expect(reader.readShort()).toBe(20);
        expect(reader.readByte()).toBe(6);
    });
});
