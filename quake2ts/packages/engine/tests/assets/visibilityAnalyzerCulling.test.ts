import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceVisibilityAnalyzer } from '../../src/assets/visibilityAnalyzer.js';
import { MessageWriter } from '../../src/demo/writer.js';
import { ConfigStringIndex, Vec3 } from '@quake2ts/shared';
import { createEmptyEntityState, createEmptyProtocolPlayerState } from '../../src/demo/parser.js';
import { BspMap, BspLeaf, BspNode, BspPlane, BspModel } from '../../src/assets/bsp.js';

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
    w1.writeConfigString(ConfigStringIndex.Models + 0, "models/test/model1.md2");
    w1.writeConfigString(ConfigStringIndex.Models + 1, "models/test/model2.md2");
    w1.writeConfigString(ConfigStringIndex.Sounds + 0, "sound/test/sound1.wav");
    addBlock(w1);

    // Block 2: Frame 1
    const w2 = new MessageWriter();
    const ent1 = createEmptyEntityState();
    ent1.number = 1;
    ent1.modelindex = entityModelIndex;
    ent1.origin = entityOrigin;
    ent1.sound = 1;

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

// Helper to create a minimal BSP structure
const createMockBsp = (): BspMap => {
    // Simple BSP:
    // 1 Plane at x=50, normal=[1,0,0]
    // 1 Node splitting at plane 0
    // Node 0: children[0] = Leaf 0 (front/pos side), children[1] = Leaf 1 (back/neg side)
    // Leaf 0: cluster 0
    // Leaf 1: cluster 1

    const planes: BspPlane[] = [{
        normal: [1, 0, 0],
        dist: 50,
        type: 0 // Axial X
    }];

    // Nodes
    // children: positive, negative. Leaf indices are negative: -1 - leafIndex
    // Leaf 0 -> -1
    // Leaf 1 -> -2
    const nodes: BspNode[] = [{
        planeIndex: 0,
        children: [-1, -2], // Leaf 0, Leaf 1
        mins: [-1000, -1000, -1000],
        maxs: [1000, 1000, 1000],
        firstFace: 0,
        numFaces: 0
    }];

    const leafs: BspLeaf[] = [
        // Leaf 0
        {
            contents: 0,
            cluster: 0,
            area: 0,
            mins: [50, -1000, -1000],
            maxs: [1000, 1000, 1000],
            firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0
        },
        // Leaf 1
        {
            contents: 0,
            cluster: 1,
            area: 0,
            mins: [-1000, -1000, -1000],
            maxs: [50, 1000, 1000],
            firstLeafFace: 0, numLeafFaces: 0, firstLeafBrush: 0, numLeafBrushes: 0
        }
    ];

    const models: BspModel[] = [{
        mins: [-1000, -1000, -1000],
        maxs: [1000, 1000, 1000],
        origin: [0, 0, 0],
        headNode: 0,
        firstFace: 0,
        numFaces: 0
    }];

    // Visibility: 2 clusters (0 and 1).
    // Cluster 0 sees only Cluster 0.
    // Cluster 1 sees only Cluster 1.
    // PVS row size: ceil(2/8) = 1 byte.
    // Row 0 (Cluster 0): 00000001 (bit 0 set) -> [1]
    // Row 1 (Cluster 1): 00000010 (bit 1 set) -> [2]

    const pvs0 = new Uint8Array([1]);
    const pvs1 = new Uint8Array([2]);

    const visibility = {
        numClusters: 2,
        clusters: [
            { pvs: pvs0, phs: pvs0 },
            { pvs: pvs1, phs: pvs1 }
        ]
    };

    return {
        header: { version: 38, lumps: new Map() },
        entities: { raw: "", entities: [], worldspawn: undefined, getUniqueClassnames: () => [] },
        planes,
        vertices: [],
        nodes,
        texInfo: [],
        faces: [],
        lightMaps: new Uint8Array(0),
        lightMapInfo: [],
        leafs,
        leafLists: { leafFaces: [], leafBrushes: [] },
        edges: [],
        surfEdges: new Int32Array(0),
        models,
        brushes: [],
        brushSides: [],
        visibility,
        pickEntity: () => null
    } as unknown as BspMap;
};

describe('ResourceVisibilityAnalyzer Culling', () => {
    let analyzer: ResourceVisibilityAnalyzer;

    beforeEach(() => {
        analyzer = new ResourceVisibilityAnalyzer();
    });

    it('should include entity if in front of player (default)', async () => {
        const demoData = createSyntheticDemo(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 0, z: 0 },
            1
        );
        const timeline = await analyzer.analyzeDemo(demoData);
        const frame = timeline.frames.get(1);
        expect(frame).toBeDefined();
        expect(frame?.models.has("models/test/model1.md2")).toBe(true);
    });

    it('should exclude entity if behind player', async () => {
        const demoData = createSyntheticDemo(
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
            { x: -1000, y: 0, z: 0 },
            1
        );
        const timeline = await analyzer.analyzeDemo(demoData);
        const frame = timeline.frames.get(1);
        expect(frame?.models.has("models/test/model1.md2")).toBe(false);
    });

    it('should exclude entity if far away for PVS (mocked)', async () => {
        const demoData = createSyntheticDemo(
            { x: 0, y: 0, z: 0 }, // Player at 0 (Leaf 1, Cluster 1)
            { x: 0, y: 0, z: 0 },
            { x: 100, y: 0, z: 0 }, // Entity at 100 (Leaf 0, Cluster 0)
            1
        );

        // Wait, 0 is < 50, so Leaf 1?
        // Plane X=50. Normal 1,0,0. Dist=50.
        // 0*1 - 50 = -50. Back side. Children[1] -> Leaf 1 -> Cluster 1.
        // 100*1 - 50 = 50. Front side. Children[0] -> Leaf 0 -> Cluster 0.

        // Mock BSP says: Cluster 0 sees ONLY Cluster 0. Cluster 1 sees ONLY Cluster 1.
        // So Player (Cluster 1) cannot see Entity (Cluster 0).

        const mockBsp = createMockBsp();

        const timeline = await analyzer.analyzeDemo(demoData, undefined, mockBsp);
        const frame = timeline.frames.get(1);

        expect(frame?.models.has("models/test/model1.md2")).toBe(false);
    });

    it('should include entity if visible in PVS (mocked)', async () => {
        const demoData = createSyntheticDemo(
            { x: 0, y: 0, z: 0 }, // Player at 0 (Cluster 1)
            { x: 0, y: 0, z: 0 },
            { x: 10, y: 0, z: 0 }, // Entity at 10 (Cluster 1, still < 50)
            1
        );

        const mockBsp = createMockBsp();

        const timeline = await analyzer.analyzeDemo(demoData, undefined, mockBsp);
        const frame = timeline.frames.get(1);

        expect(frame?.models.has("models/test/model1.md2")).toBe(true);
    });
});
