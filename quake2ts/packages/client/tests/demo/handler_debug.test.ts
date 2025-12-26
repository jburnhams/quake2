
import { describe, it, expect, vi } from 'vitest';
import { ClientNetworkHandler } from '../../src/demo/handler.js';
import { FrameData, createEmptyProtocolPlayerState, createEmptyEntityState, U_ORIGIN1, U_FRAME8, U_NUMBER16, U_MODEL } from '@quake2ts/engine';
import { ClientImports } from '../../src/index.js';
import { ClientConfigStrings } from '../../src/configStrings.js';
import { ConfigStringIndex } from '@quake2ts/shared';

describe('ClientNetworkHandler Debug', () => {
    it('should correctly snapshot previousEntities', () => {
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

         // --- Frame 1 ---
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

        console.log('--- Processing Frame 1 ---');
        handler.onFrame(frame1);

        console.log('Entities after Frame 1:', handler.entities.get(1)?.frame);
        console.log('PreviousEntities after Frame 1:', handler.previousEntities.get(1)?.frame);

        expect(handler.entities.get(1)?.frame).toBe(10);
        expect(handler.previousEntities.size).toBe(0);

        // --- Frame 2 ---
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

        console.log('--- Processing Frame 2 ---');
        handler.onFrame(frame2);

        console.log('Entities after Frame 2:', handler.entities.get(1)?.frame);
        console.log('PreviousEntities after Frame 2:', handler.previousEntities.get(1)?.frame);

        expect(handler.entities.get(1)?.frame).toBe(20);

        // This is where it was failing (expected 10, got 20 in the main test?)
        const prevEnt = handler.previousEntities.get(1);
        expect(prevEnt).toBeDefined();
        if (prevEnt) {
            expect(prevEnt.frame).toBe(10);
        }

        const renderables = handler.getRenderableEntities(0.5, configStrings);
        expect(renderables.length).toBe(1);
        const r = renderables[0];

        console.log('Renderable Blend:', r.blend);

        expect(r.blend).toBeDefined();
        if (r.blend) {
            expect(r.blend.frame0).toBe(10);
            expect(r.blend.frame1).toBe(20);
        }
    });
});
