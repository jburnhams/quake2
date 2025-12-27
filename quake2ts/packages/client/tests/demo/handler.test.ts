import { describe, it, expect, vi } from 'vitest';
import { ClientNetworkHandler } from '../../src/demo/handler.js';
import { DEMO_ITEM_MAPPING } from '../../src/demo/itemMapping.js';
import { WeaponId, PowerupId, AmmoType } from '@quake2ts/game';
import { FrameData, createEmptyProtocolPlayerState, EntityState, createEmptyEntityState, U_ORIGIN1, U_ANGLE1, U_FRAME8, U_MODEL, U_NUMBER16 } from '@quake2ts/engine';
import { ConfigStringIndex } from '@quake2ts/shared';
import { ClientConfigStrings } from '../../src/configStrings.js';
import { ClientImports } from '../../src/index.js';

describe('ClientNetworkHandler', () => {
    it('should trigger onConfigString callback when receiving config string update', () => {
        const handler = new ClientNetworkHandler();
        const callback = vi.fn();
        handler.setCallbacks({
            onConfigString: callback
        });

        const index = 123;
        const value = 'test_string';
        handler.onConfigString(index, value);

        expect(callback).toHaveBeenCalledWith(index, value);
        expect(handler.configstrings[index]).toBe(value);
    });

    it('should map inventory array to PlayerInventory correctly', () => {
        const handler = new ClientNetworkHandler();

        // Mock frame data
        const frame: FrameData = {
            serverFrame: 1,
            deltaFrame: 0,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(),
            playerState: createEmptyProtocolPlayerState(),
            packetEntities: { delta: false, entities: [] }
        };
        handler.onFrame(frame);

        // Create a mock inventory array
        const inventory = new Array(256).fill(0);

        // Find indices for specific items
        const blasterIndex = DEMO_ITEM_MAPPING.findIndex(m => m.type === 'weapon' && m.id === WeaponId.Blaster);
        const shellsIndex = DEMO_ITEM_MAPPING.findIndex(m => m.type === 'ammo' && m.id === AmmoType.Shells);
        const quadIndex = DEMO_ITEM_MAPPING.findIndex(m => m.type === 'powerup' && m.id === PowerupId.QuadDamage);

        // Set values
        if (blasterIndex !== -1) inventory[blasterIndex] = 1;
        if (shellsIndex !== -1) inventory[shellsIndex] = 50;
        if (quadIndex !== -1) inventory[quadIndex] = 300; // 30 seconds (10Hz)

        handler.onInventory(inventory);

        const state = handler.getPredictionState();
        const clientInventory = state.client!.inventory;

        expect(clientInventory.ownedWeapons.has(WeaponId.Blaster)).toBe(true);
        expect(clientInventory.ammo.counts[AmmoType.Shells]).toBe(50);
        expect(clientInventory.powerups.get(PowerupId.QuadDamage)).toBe(300);
    });

    it('should manage previousEntities correctly across frames', () => {
        const handler = new ClientNetworkHandler();

        // Frame 1 with Entity 1
        const ent1 = createEmptyEntityState();
        ent1.number = 1;
        ent1.bits = U_ORIGIN1;
        ent1.origin = { x: 10, y: 10, z: 10 };

        const frame1: FrameData = {
            serverFrame: 1,
            deltaFrame: 0,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(),
            playerState: createEmptyProtocolPlayerState(),
            packetEntities: { delta: false, entities: [ent1] }
        };

        handler.onFrame(frame1);
        expect(handler.entities.get(1)).toBeDefined();
        expect(handler.entities.get(1)?.origin.x).toBe(10);
        expect(handler.previousEntities.size).toBe(0);

        // Frame 2 with Entity 1 moved (delta)
        const ent1Delta = createEmptyEntityState();
        ent1Delta.number = 1;
        ent1Delta.bits = U_ORIGIN1;
        ent1Delta.origin = { x: 20, y: 10, z: 10 };

        const frame2: FrameData = {
            serverFrame: 2,
            deltaFrame: 1,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(),
            playerState: createEmptyProtocolPlayerState(),
            packetEntities: { delta: true, entities: [ent1Delta] }
        };

        handler.onFrame(frame2);

        // Check current entities
        expect(handler.entities.get(1)?.origin.x).toBe(20);

        // Check previous entities (should be Frame 1 state)
        expect(handler.previousEntities.get(1)).toBeDefined();
        expect(handler.previousEntities.get(1)?.origin.x).toBe(10);
    });

    it('should interpolate camera in getDemoCamera', () => {
        const handler = new ClientNetworkHandler();

        // Setup Frame 1
        const ps1 = createEmptyProtocolPlayerState();
        ps1.origin = { x: 0, y: 0, z: 0 };
        ps1.viewangles = { x: 0, y: 0, z: 0 };
        const frame1: FrameData = {
            serverFrame: 1,
            deltaFrame: 0,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(),
            playerState: ps1,
            packetEntities: { delta: false, entities: [] }
        };
        handler.onFrame(frame1);

        // Setup Frame 2
        const ps2 = createEmptyProtocolPlayerState();
        ps2.origin = { x: 100, y: 0, z: 0 };
        ps2.viewangles = { x: 90, y: 0, z: 0 };

        const frame2: FrameData = {
            serverFrame: 2,
            deltaFrame: 1,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(),
            playerState: ps2,
            packetEntities: { delta: true, entities: [] }
        };
        handler.onFrame(frame2);

        // Test Alpha 0.5
        const cam = handler.getDemoCamera(0.5);
        expect(cam.origin.x).toBe(50);
        expect(cam.angles.x).toBe(45);

        // Test Alpha 0.0
        const camStart = handler.getDemoCamera(0.0);
        expect(camStart.origin.x).toBe(0);

        // Test Alpha 1.0
        const camEnd = handler.getDemoCamera(1.0);
        expect(camEnd.origin.x).toBe(100);
    });

    it('should getRenderableEntities using buildRenderableEntities', () => {
         // Mock dependencies
         const mockAssets = {
             getMd2Model: vi.fn().mockImplementation((name) => {
                 return { header: { magic: 844121161 }, name };
             }),
             getMd3Model: vi.fn(),
         };
         const mockImports: ClientImports = {
             engine: {
                 assets: mockAssets as any,
                 renderer: {} as any
             } as any
         };

         const handler = new ClientNetworkHandler(mockImports);
         const configStrings = new ClientConfigStrings();
         const modelIndex = 1;
         configStrings.set(ConfigStringIndex.Models + modelIndex, 'models/test.md2');

         // Frame 1
         const ent1 = createEmptyEntityState();
         ent1.number = 1;
         ent1.bits = U_MODEL | U_FRAME8 | U_ORIGIN1 | U_NUMBER16;
         ent1.modelindex = modelIndex;
         ent1.origin = { x: 0, y: 0, z: 0 };
         ent1.frame = 10;
         ent1.renderfx = 0;

         const frame1: FrameData = {
            serverFrame: 1,
            deltaFrame: 0,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(),
            playerState: createEmptyProtocolPlayerState(),
            packetEntities: { delta: false, entities: [ent1] }
        };
        handler.onFrame(frame1);

        expect(handler.entities.size).toBe(1);

        // Frame 2
        const ent2 = createEmptyEntityState();
        ent2.number = 1;
        ent2.bits = U_ORIGIN1 | U_FRAME8 | U_NUMBER16;
        ent2.origin = { x: 100, y: 0, z: 0 };
        ent2.frame = 20;

        const frame2: FrameData = {
            serverFrame: 2,
            deltaFrame: 1,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(),
            playerState: createEmptyProtocolPlayerState(),
            packetEntities: { delta: true, entities: [ent2] }
        };
        handler.onFrame(frame2);

        // Verify entity state before rendering
        const entity = handler.entities.get(1);
        expect(entity).toBeDefined();
        expect(entity?.modelindex).toBe(1);

        // Verify config strings
        expect(configStrings.getModelName(1)).toBe('models/test.md2');

        const renderables = handler.getRenderableEntities(0.5, configStrings);

        // Check usage of assets
        expect(mockAssets.getMd2Model).toHaveBeenCalledWith('models/test.md2');

        expect(renderables.length).toBe(1);
        const r = renderables[0];

        // Check interpolation
        expect(r.blend).toBeDefined();
        if (r.blend) {
            expect(r.blend.frame0).toBe(10);
            expect(r.blend.frame1).toBe(20);
            expect(r.blend.lerp).toBe(0.5);
        }
    });
});
