import { describe, it, expect } from 'vitest';
import { WorldStateOptimizer } from '../../src/demo/worldStateOptimizer';
import { WorldState } from '../../src/demo/clipper';
import { Message, FrameMessage, SoundMessage, ConfigStringMessage } from '../../src/demo/message';
import { ConfigStringIndex, MAX_MODELS, ServerCommand } from '@quake2ts/shared';
import { createEmptyEntityState, createEmptyProtocolPlayerState, EntityState, U_MODEL, U_SOUND } from '../../src/demo/parser';

describe('WorldStateOptimizer', () => {
    const optimizer = new WorldStateOptimizer();

    const createMockWorldState = (): WorldState => ({
        serverData: {
            protocol: 34,
            serverCount: 1,
            attractLoop: 0,
            gameDir: 'baseq2',
            playerNum: 0,
            levelName: 'q2dm1'
        },
        configStrings: new Map([
            [ConfigStringIndex.Name, 'Player'],
            [ConfigStringIndex.Models + 1, 'models/weapons/v_rocket/tris.md2'],
            [ConfigStringIndex.Models + 2, 'models/items/armor/shard/tris.md2'], // Unused
            [ConfigStringIndex.Sounds + 1, 'weapons/rocklf1a.wav'],
            [ConfigStringIndex.Sounds + 2, 'misc/item_pkup.wav'], // Unused
            [ConfigStringIndex.Images + 1, 'pics/colormap.pcx'], // Images kept by default
        ]),
        entityBaselines: new Map(),
        playerState: createEmptyProtocolPlayerState(),
        currentEntities: new Map()
    });

    const createEntity = (num: number, modelindex: number, sound: number = 0): EntityState => {
        const ent = createEmptyEntityState();
        ent.number = num;
        ent.modelindex = modelindex;
        ent.sound = sound;
        return ent;
    };

    it('should keep entities and resources referenced in currentEntities', () => {
        const ws = createMockWorldState();
        // Entity 1 uses Model 1
        ws.currentEntities.set(1, createEntity(1, 1));
        // Baseline 1 exists
        ws.entityBaselines.set(1, createEntity(1, 1));
        // Baseline 2 exists (unused)
        ws.entityBaselines.set(2, createEntity(2, 2));

        const clipMessages: Message[] = []; // Empty clip

        const optimized = optimizer.optimizeForClip(ws, clipMessages);

        // Baseline 1 should be kept (referenced by currentEntities)
        expect(optimized.entityBaselines.has(1)).toBe(true);
        // Baseline 2 should be removed (unused)
        expect(optimized.entityBaselines.has(2)).toBe(false);

        // Model 1 configstring should be kept
        expect(optimized.configStrings.has(ConfigStringIndex.Models + 1)).toBe(true);
        // Model 2 configstring should be removed
        expect(optimized.configStrings.has(ConfigStringIndex.Models + 2)).toBe(false);
    });

    it('should keep entities and resources referenced in clip messages', () => {
        const ws = createMockWorldState();
        // Baseline 1 (referenced in clip)
        ws.entityBaselines.set(1, createEntity(1, 1));
        // Baseline 2 (unused)
        ws.entityBaselines.set(2, createEntity(2, 2));

        // Clip Frame referencing Entity 1 with sound 1
        const ent1 = createEntity(1, 1, 1);
        ent1.bits = U_MODEL | U_SOUND; // Assume everything updated

        const frameMsg: FrameMessage = {
            type: ServerCommand.frame,
            data: {
                serverFrame: 1, deltaFrame: 0, surpressCount: 0, areaBytes: 0, areaBits: new Uint8Array(),
                playerState: createEmptyProtocolPlayerState(),
                packetEntities: {
                    delta: false,
                    entities: [ent1]
                }
            }
        };

        const optimized = optimizer.optimizeForClip(ws, [frameMsg]);

        // Baseline 1 kept
        expect(optimized.entityBaselines.has(1)).toBe(true);
        // Baseline 2 removed
        expect(optimized.entityBaselines.has(2)).toBe(false);

        // Model 1 kept
        expect(optimized.configStrings.has(ConfigStringIndex.Models + 1)).toBe(true);
        // Sound 1 kept
        expect(optimized.configStrings.has(ConfigStringIndex.Sounds + 1)).toBe(true);
    });

    it('should keep player gun model', () => {
        const ws = createMockWorldState();
        const frameMsg: FrameMessage = {
            type: ServerCommand.frame,
            data: {
                serverFrame: 1, deltaFrame: 0, surpressCount: 0, areaBytes: 0, areaBits: new Uint8Array(),
                playerState: {
                    ...createEmptyProtocolPlayerState(),
                    gun_index: 1 // Uses Model 1
                },
                packetEntities: { delta: false, entities: [] }
            }
        };

        const optimized = optimizer.optimizeForClip(ws, [frameMsg]);

        expect(optimized.configStrings.has(ConfigStringIndex.Models + 1)).toBe(true);
    });

    it('should keep sound resources from sound commands', () => {
        const ws = createMockWorldState();
        const soundMsg: SoundMessage = {
            type: ServerCommand.sound,
            flags: 0,
            soundNum: 1, // Uses Sound 1
            ent: 1
        };

        const optimized = optimizer.optimizeForClip(ws, [soundMsg]);

        expect(optimized.configStrings.has(ConfigStringIndex.Sounds + 1)).toBe(true);
        // Note: Entity 1 is referenced by sound command, so its baseline (if exists) should be kept?
        // Logic check: `referencedEntities.add(snd.ent)`
        // If baseline 1 exists, it should be kept.
        ws.entityBaselines.set(1, createEntity(1, 1));
        const opt2 = optimizer.optimizeForClip(ws, [soundMsg]);
        expect(opt2.entityBaselines.has(1)).toBe(true);
    });

    it('should always keep essential config strings', () => {
        const ws = createMockWorldState();
        const essentialIndices = [
            ConfigStringIndex.Name,
            ConfigStringIndex.Sky,
            ConfigStringIndex.MaxClients,
            ConfigStringIndex.Players + 0
        ];

        const optimized = optimizer.optimizeForClip(ws, []);

        essentialIndices.forEach(idx => {
             // Mock world state has Name but not others populated,
             // but `optimizeForClip` filters EXISTING configStrings.
             // So we must ensure they exist in mock if we want to test they are KEPT.
             // Wait, the logic is: `if (referencedConfigStrings.has(idx))` then keep from original.
             // So if original doesn't have it, it won't be in result.
             // Let's add them to mock.
        });

        ws.configStrings.set(ConfigStringIndex.Sky, 'unit1_sky');
        const optimized2 = optimizer.optimizeForClip(ws, []);
        expect(optimized2.configStrings.has(ConfigStringIndex.Sky)).toBe(true);
    });
});
