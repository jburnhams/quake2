import { describe, it, expect } from 'vitest';
import { MessageWriter } from '../../../src/demo/writer.js';
import { createEmptyEntityState, createEmptyProtocolPlayerState, FrameData } from '../../../src/demo/parser.js';
import { BinaryStream, ServerCommand, U_MOREBITS1, U_ORIGIN1, U_ANGLE1, U_MODEL } from '@quake2ts/shared';

// Legacy Protocol 34 Constants for testing
const WIRE_FRAME = 5;
const WIRE_INVENTORY = 6;
const WIRE_LAYOUT = 7;
const WIRE_MUZZLEFLASH = 8;
const WIRE_TEMP_ENTITY = 9;
const WIRE_SOUND = 10;
const WIRE_PRINT = 11;
const WIRE_STUFFTEXT = 12;
const WIRE_SERVERDATA = 13;
const WIRE_CONFIGSTRING = 14;
const WIRE_SPAWNBASELINE = 15;
const WIRE_CENTERPRINT = 16;
const WIRE_PLAYERINFO = 17;
const WIRE_PACKETENTITIES = 18;
const WIRE_DELTAPACKETENTITIES = 19;
const WIRE_MUZZLEFLASH2 = 20;

describe('MessageWriter', () => {
    it('writes server data', () => {
        const writer = new MessageWriter();
        // Pass protocol 34 to force legacy opcode if implemented, else check what is written
        writer.writeServerData(34, 123, 1, 'baseq2', 0, 'q2dm1');
        const data = writer.getData();
        const reader = new BinaryStream(data.buffer);

        // MessageWriter.writeServerData handles protocol 34 by writing 13
        const cmd = reader.readByte();
        expect(cmd).toBe(WIRE_SERVERDATA); // 13

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

        expect(reader.readByte()).toBe(WIRE_PLAYERINFO);

        // Flags
        const flags = reader.readShort();
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

        expect(reader.readByte()).toBe(WIRE_PACKETENTITIES);

        // Entity 1 against the null baseline, as MSG_WriteDeltaEntity writes a new entity:
        // only the changed model, plus old_origin (U_OLDORIGIN, bit 24), so all four header bytes.
        expect(reader.readByte()).toBe(U_MOREBITS1); // 0x80
        expect(reader.readByte()).toBe(0x88); // U_MODEL (bit 11) | U_MOREBITS2 (bit 15)
        expect(reader.readByte()).toBe(0x80); // U_MOREBITS3 (bit 23)
        expect(reader.readByte()).toBe(0x01); // U_OLDORIGIN (bit 24)

        expect(reader.readByte()).toBe(1); // number
        expect(reader.readByte()).toBe(10); // modelindex
        expect(reader.readShort()).toBe(0); // old_origin
        expect(reader.readShort()).toBe(0);
        expect(reader.readShort()).toBe(0);

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

        expect(reader.readByte()).toBe(WIRE_FRAME); // 5
        expect(reader.readLong()).toBe(100);
        expect(reader.readLong()).toBe(99);
        expect(reader.readByte()).toBe(0); // surpress
        expect(reader.readByte()).toBe(0); // areaBytes

        expect(reader.readByte()).toBe(WIRE_PLAYERINFO); // 17
        // Player state (empty) -> flags=0, stats=0
        expect(reader.readShort()).toBe(0); // flags
        expect(reader.readLong()).toBe(0); // statbits

        expect(reader.readByte()).toBe(WIRE_DELTAPACKETENTITIES); // 19
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

        expect(reader.readByte()).toBe(WIRE_STUFFTEXT); // 12
        expect(reader.readString()).toBe('cmd\n');

        expect(reader.readByte()).toBe(WIRE_CENTERPRINT); // 16
        expect(reader.readString()).toBe('Hello');

        expect(reader.readByte()).toBe(WIRE_PRINT); // 11
        expect(reader.readByte()).toBe(2);
        expect(reader.readString()).toBe('Message');

        expect(reader.readByte()).toBe(WIRE_LAYOUT); // 7
        expect(reader.readString()).toBe('layout');

        expect(reader.readByte()).toBe(WIRE_INVENTORY); // 6
        expect(reader.readShort()).toBe(1);
        expect(reader.readShort()).toBe(2);
        for(let i=2; i<256; i++) expect(reader.readShort()).toBe(0);

        expect(reader.readByte()).toBe(WIRE_MUZZLEFLASH); // 8
        expect(reader.readShort()).toBe(10);
        expect(reader.readByte()).toBe(5);

        expect(reader.readByte()).toBe(WIRE_MUZZLEFLASH2); // 20
        expect(reader.readShort()).toBe(20);
        expect(reader.readByte()).toBe(6);
    });
});
