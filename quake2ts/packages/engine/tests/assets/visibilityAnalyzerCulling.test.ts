import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceVisibilityAnalyzer } from '../../src/assets/visibilityAnalyzer.js';
import { MessageWriter } from '../../src/demo/writer.js';
import { ConfigStringIndex, Vec3 } from '@quake2ts/shared';
import { createEmptyEntityState, createEmptyProtocolPlayerState } from '../../src/demo/parser.js';
import { BspLoader } from '../../src/loaders/bsp.js';

// Helper to create synthetic demo data with Writer
const createSyntheticDemo = (
    playerOrigin: Vec3 = { x: 0, y: 0, z: 0 },
    playerAngles: Vec3 = { x: 0, y: 0, z: 0 },
    entityOrigin: Vec3 = { x: 100, y: 0, z: 0 }, // In front of player
    entityModelIndex: number = 1
): Uint8Array => {
    // We need to create blocks format: Length(4) + Data
    const blocks: Uint8Array[] = [];

    const addBlock = (writer: MessageWriter) => {
        const data = writer.getData();
        const block = new Uint8Array(4 + data.length);
        const view = new DataView(block.buffer);
        view.setUint32(0, data.length, true);
        block.set(data, 4);
        blocks.push(block);
    };

    // Block 1: ServerData + ConfigStrings
    const w1 = new MessageWriter();
    w1.writeServerData(34, 1, 0, "baseq2", 0, "map1");
    // CS_MODELS starts at index 0 relative to base? No, ConfigStringIndex.Models is base.
    // writeConfigString takes absolute index.
    w1.writeConfigString(ConfigStringIndex.Models + 0, "models/test/model1.md2"); // Index 1
    w1.writeConfigString(ConfigStringIndex.Models + 1, "models/test/model2.md2"); // Index 2
    w1.writeConfigString(ConfigStringIndex.Sounds + 0, "sound/test/sound1.wav"); // Index 1
    addBlock(w1);

    // Block 2: Frame 1
    const w2 = new MessageWriter();
    const ent1 = createEmptyEntityState();
    ent1.number = 1;
    ent1.modelindex = entityModelIndex;
    ent1.origin = entityOrigin;
    ent1.sound = 1;      // "sound/test/sound1.wav"

    const playerState = createEmptyProtocolPlayerState();
    playerState.origin = playerOrigin;
    playerState.viewangles = playerAngles;

    w2.writeFrame({
        serverFrame: 1,
        deltaFrame: 0,
        surpressCount: 0,
        areaBytes: 0,
        areaBits: new Uint8Array(0),
        playerState: playerState,
        packetEntities: { delta: false, entities: [ent1] }
    }, 34);
    addBlock(w2);

    // Combine blocks
    let totalLen = 0;
    blocks.forEach(b => totalLen += b.length);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    blocks.forEach(b => {
        combined.set(b, offset);
        offset += b.length;
    });

    return combined;
};

describe('ResourceVisibilityAnalyzer Culling', () => {
    let analyzer: ResourceVisibilityAnalyzer;

    beforeEach(() => {
        analyzer = new ResourceVisibilityAnalyzer();
    });

    it('should include entity if in front of player (default)', async () => {
        // Player at 0,0,0 looking at 0,0,0 (Down X?).
        // Quake angles: Pitch, Yaw, Roll.
        // Yaw 0 is East (X+).
        const demoData = createSyntheticDemo(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 }, // Looking X+
            { x: 100, y: 0, z: 0 }, // Entity at X=100
            1
        );
        const timeline = await analyzer.analyzeDemo(demoData);
        const frame = timeline.frames.get(1);
        expect(frame).toBeDefined();
        // Should be visible
        expect(frame?.models.has("models/test/model1.md2")).toBe(true);
    });

    it('should exclude entity if behind player', async () => {
        // Player at 0,0,0 looking X+ (Yaw 0)
        // Entity at -1000, 0, 0 (Behind and definitely out of the 256 box)
        const demoData = createSyntheticDemo(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
            { x: -1000, y: 0, z: 0 },
            1
        );
        const timeline = await analyzer.analyzeDemo(demoData);
        const frame = timeline.frames.get(1);
        // Should NOT be visible if frustum culling is working
        expect(frame?.models.has("models/test/model1.md2")).toBe(false);
    });

    it('should exclude entity if far away for PVS (mocked)', async () => {
        const demoData = createSyntheticDemo(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 0, z: 0 }, // In front, so Frustum allows it
            1
        );

        // Mock BSP Loader
        const mockBspLoader = {
            findLeaf: vi.fn((pos: Vec3) => {
                if (pos.x === 0 && pos.y === 0 && pos.z === 0) {
                    return { cluster: 0 }; // Player at cluster 0
                }
                return { cluster: 1 }; // Entity at cluster 1
            }),
            isClusterVisible: vi.fn((from: number, to: number) => {
                return from === to; // Only visible if same cluster
            })
        } as unknown as BspLoader;

        const timeline = await analyzer.analyzeDemo(demoData, undefined, mockBspLoader);
        const frame = timeline.frames.get(1);

        // PVS says no (cluster 0 -> cluster 1 is false)
        expect(frame?.models.has("models/test/model1.md2")).toBe(false);
        expect(mockBspLoader.isClusterVisible).toHaveBeenCalledWith(0, 1);
    });

    it('should include entity if visible in PVS (mocked)', async () => {
        const demoData = createSyntheticDemo(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 0, z: 0 },
            1
        );

        const mockBspLoader = {
            findLeaf: vi.fn((pos: Vec3) => {
                return { cluster: 0 }; // Both in cluster 0
            }),
            isClusterVisible: vi.fn((from: number, to: number) => {
                return true;
            })
        } as unknown as BspLoader;

        const timeline = await analyzer.analyzeDemo(demoData, undefined, mockBspLoader);
        const frame = timeline.frames.get(1);

        expect(frame?.models.has("models/test/model1.md2")).toBe(true);
    });
});
