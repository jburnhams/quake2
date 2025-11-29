import { describe, it, expect } from 'vitest';
import { BinaryWriter, ServerCommand, TempEntity, Vec3 } from '@quake2ts/shared';
import { writeServerCommand } from '../../src/protocol/write.js';
import { Entity } from '@quake2ts/game';

describe('writeServerCommand', () => {
    it('writes ServerCommand.print', () => {
        const writer = new BinaryWriter();
        writeServerCommand(writer, ServerCommand.print, 1, "Hello World\n");
        const data = writer.getData();

        // Expect: [cmd (10), level (1), string ("Hello World\n")]
        expect(data[0]).toBe(ServerCommand.print);
        expect(data[1]).toBe(1);

        // String check: 'H' is 72 ...
        expect(String.fromCharCode(data[2])).toBe('H');
    });

    it('writes ServerCommand.muzzleflash', () => {
        const writer = new BinaryWriter();
        writeServerCommand(writer, ServerCommand.muzzleflash, 42, 128);
        const data = writer.getData();

        // Expect: [cmd (1), ent (42, short), flash (128, byte)]
        expect(data[0]).toBe(ServerCommand.muzzleflash);
        // short 42 = 42, 0
        expect(data[1]).toBe(42);
        expect(data[2]).toBe(0);
        expect(data[3]).toBe(128);
    });

    it('writes TempEntity.ROCKET_EXPLOSION', () => {
        const writer = new BinaryWriter();
        const pos: Vec3 = { x: 10, y: 20, z: 30 };
        writeServerCommand(writer, ServerCommand.temp_entity, TempEntity.ROCKET_EXPLOSION, pos);
        const data = writer.getData();

        // Expect: [cmd (3), type (7), pos (x, y, z as shorts * 8)]
        expect(data[0]).toBe(ServerCommand.temp_entity);
        expect(data[1]).toBe(TempEntity.ROCKET_EXPLOSION);

        // 10 * 8 = 80
        expect(data[2]).toBe(80);
        expect(data[3]).toBe(0);
    });

    it('writes TempEntity.PARASITE_ATTACK', () => {
        const writer = new BinaryWriter();
        const ent = { index: 99 } as Entity;
        const start: Vec3 = { x: 1, y: 1, z: 1 };
        const end: Vec3 = { x: 2, y: 2, z: 2 };

        writeServerCommand(writer, ServerCommand.temp_entity, TempEntity.PARASITE_ATTACK, ent, start, end);
        const data = writer.getData();

        // Expect: [cmd, type, short ent, pos start, pos end]
        expect(data[0]).toBe(ServerCommand.temp_entity);
        expect(data[1]).toBe(TempEntity.PARASITE_ATTACK);

        // Ent index 99
        expect(data[2]).toBe(99);
        expect(data[3]).toBe(0);
    });
});
