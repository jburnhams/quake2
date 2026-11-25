import { describe, it, expect, vi, afterEach } from 'vitest';
import { DedicatedServer } from '../../src/dedicated.js';
import * as gameModule from '@quake2ts/game';
import { createMockCollisionEntityIndex } from '@quake2ts/test-utils';

vi.mock('@quake2ts/shared', async () => {
    const actual = await vi.importActual<typeof import('@quake2ts/shared')>('@quake2ts/shared');
    return {
        ...actual,
        CollisionEntityIndex: class {
            constructor() {
                return createMockCollisionEntityIndex();
            }
        }
    };
});

// PF_setmodel: a submodel ("*1", a door) gets its bounds from the map and is linked there, so a
// door spawned from the map's entity string has a size to travel by.
describe('DedicatedServer setmodel', () => {
    let server: DedicatedServer;

    afterEach(() => {
        if ((server as any)?.game && !(server as any).game.shutdown) (server as any).game.shutdown = vi.fn();
        server?.stop();
        vi.restoreAllMocks();
    });

    it("gives a submodel its bounds from the map and links it, and a plain model only its index", async () => {
        const createGameSpy = vi.spyOn(gameModule, 'createGame');
        server = new DedicatedServer(27997);
        await server.start('test.bsp');
        const imports = createGameSpy.mock.calls[0]![0] as gameModule.GameImports;
        (server as any).sv.collisionModel = {
            bmodels: [
                { mins: { x: -1, y: -1, z: -1 }, maxs: { x: 1, y: 1, z: 1 } },
                { mins: { x: -1120, y: 1560, z: -48 }, maxs: { x: -1104, y: 1704, z: 80 } },
            ],
        };
        const link = (server as any).entityIndex.link;
        link.mockClear();

        const door = { index: 40, origin: { x: 0, y: 0, z: 0 }, mins: { x: 0, y: 0, z: 0 }, maxs: { x: 0, y: 0, z: 0 }, solid: 3, modelindex: 0 } as any;
        imports.setmodel!(door, '*1');
        expect(door.mins).toEqual({ x: -1120, y: 1560, z: -48 });
        expect(door.maxs).toEqual({ x: -1104, y: 1704, z: 80 });
        expect(door.modelindex).toBeGreaterThan(0);
        expect(link).toHaveBeenCalledWith(expect.objectContaining({ id: 40, mins: door.mins, maxs: door.maxs }));

        const gun = { index: 41, mins: { x: 0, y: 0, z: 0 }, maxs: { x: 0, y: 0, z: 0 }, modelindex: 0 } as any;
        link.mockClear();
        imports.setmodel!(gun, 'models/weapons/g_shotg/tris.md2');
        expect(gun.modelindex).toBeGreaterThan(0);
        expect(gun.mins).toEqual({ x: 0, y: 0, z: 0 });
        expect(link).not.toHaveBeenCalled();
        expect(() => imports.setmodel!(gun, '*9')).toThrow(/no submodel/);
    });
});
