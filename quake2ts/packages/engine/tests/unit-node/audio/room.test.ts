import { describe, it, expect } from 'vitest';
import { estimateRoomSize, findLeafForPoint, getReverbPresetForVolume } from '../../../src/audio/room.js';
import type { BspMap, BspLeaf, BspNode, BspPlane, Vec3 } from '../../../src/assets/bsp.js';

// Mock BspMap
const mockMap: BspMap = {
    header: {} as any,
    entities: {} as any,
    planes: [
        { normal: [1, 0, 0], dist: 0, type: 0 } // Plane x=0
    ],
    vertices: [],
    nodes: [
        {
            planeIndex: 0,
            children: [-2, -1], // -2 -> leaf 1 (x > 0), -1 -> leaf 0 (x < 0)
            mins: [-100, -100, -100],
            maxs: [100, 100, 100],
            firstFace: 0,
            numFaces: 0
        }
    ],
    texInfo: [],
    faces: [],
    lightMaps: new Uint8Array(),
    lightMapInfo: [],
    leafs: [
        {
            contents: 0,
            cluster: 0,
            area: 0,
            mins: [-100, -100, -100],
            maxs: [0, 100, 100],
            firstLeafFace: 0,
            numLeafFaces: 0,
            firstLeafBrush: 0,
            numLeafBrushes: 0
        },
        {
            contents: 0,
            cluster: 0,
            area: 0,
            mins: [0, -100, -100],
            maxs: [100, 100, 100],
            firstLeafFace: 0,
            numLeafFaces: 0,
            firstLeafBrush: 0,
            numLeafBrushes: 0
        }
    ],
    leafLists: { leafFaces: [], leafBrushes: [] },
    edges: [],
    surfEdges: new Int32Array(),
    models: [],
    brushes: [],
    brushSides: [],
    visibility: undefined,
    pickEntity: () => null
};

describe('Room Size Detection', () => {
    it('finds correct leaf for point', () => {
        const p1: Vec3 = [-50, 0, 0];
        const leaf1 = findLeafForPoint(mockMap, p1);
        expect(leaf1).toBe(mockMap.leafs[0]);

        const p2: Vec3 = [50, 0, 0];
        const leaf2 = findLeafForPoint(mockMap, p2);
        expect(leaf2).toBe(mockMap.leafs[1]);
    });

    it('estimates room size based on cluster volume', () => {
        // Both leaves are in cluster 0
        // Volume 1: 100 * 200 * 200 = 4,000,000
        // Volume 2: 100 * 200 * 200 = 4,000,000
        // Total: 8,000,000

        const volume = estimateRoomSize(mockMap, [50, 0, 0]);
        expect(volume).toBe(8000000);
    });

    it('selects correct reverb preset', () => {
        expect(getReverbPresetForVolume(500000)).toBe('small');
        expect(getReverbPresetForVolume(5000000)).toBe('medium');
        expect(getReverbPresetForVolume(20000000)).toBe('large');
        expect(getReverbPresetForVolume(100000000)).toBe('huge');
    });
});
