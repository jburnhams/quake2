import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResourceInteractionGraph } from '../../src/assets/interactionGraph.js';
import { VisibilityTimeline, FrameResources } from '../../src/assets/visibilityAnalyzer.js';
import { AssetManager } from '../../src/assets/manager.js';
import { createMockAssetManager } from '@quake2ts/test-utils';

describe('ResourceInteractionGraph', () => {
    let graph: ResourceInteractionGraph;
    let mockAssetManager: any;

    beforeEach(() => {
        graph = new ResourceInteractionGraph();
        // Mock AssetManager using centralized factory from test-utils
        mockAssetManager = createMockAssetManager({
            loadMd2Model: vi.fn().mockResolvedValue({
                skins: [{ name: 'models/test/skin.pcx' }]
            })
        });
    });

    it('should build a graph from timeline roots', async () => {
        const timeline: VisibilityTimeline = {
            frames: new Map<number, FrameResources>([
                [1, {
                    models: new Set(['models/test/tris.md2']),
                    sounds: new Set(['sound/test.wav']),
                    textures: new Set(),
                    loaded: new Set(),
                    visible: new Set(),
                    audible: new Set()
                }]
            ]),
            time: new Map()
        };

        const result = await graph.buildGraph(timeline, mockAssetManager as AssetManager);

        expect(result.nodes.has('models/test/tris.md2')).toBe(true);
        expect(result.nodes.has('sound/test.wav')).toBe(true);
        // Verify dependency resolution (MD2 -> Skin)
        expect(result.nodes.has('models/test/skin.pcx')).toBe(true);
        expect(result.edges.get('models/test/tris.md2')?.has('models/test/skin.pcx')).toBe(true);
    });

    it('should calculate transitive dependencies', async () => {
        const timeline: VisibilityTimeline = {
            frames: new Map<number, FrameResources>([
                [1, {
                    models: new Set(['models/test/tris.md2']),
                    sounds: new Set(),
                    textures: new Set(),
                    loaded: new Set(),
                    visible: new Set(),
                    audible: new Set()
                }]
            ]),
            time: new Map()
        };

        await graph.buildGraph(timeline, mockAssetManager as AssetManager);

        const deps = graph.getTransitiveDependencies('models/test/tris.md2');
        expect(deps.has('models/test/skin.pcx')).toBe(true);
    });

    it('should calculate minimal set for a frame including dependencies', async () => {
        const timeline: VisibilityTimeline = {
            frames: new Map<number, FrameResources>([
                [1, {
                    models: new Set(['models/test/tris.md2']),
                    sounds: new Set(['sound/test.wav']),
                    textures: new Set(),
                    loaded: new Set(),
                    visible: new Set(),
                    audible: new Set()
                }]
            ]),
            time: new Map()
        };

        await graph.buildGraph(timeline, mockAssetManager as AssetManager);

        const minSet = graph.getMinimalSetForFrame(1, timeline);
        expect(minSet.has('models/test/tris.md2')).toBe(true);
        expect(minSet.has('models/test/skin.pcx')).toBe(true); // Dependency
        expect(minSet.has('sound/test.wav')).toBe(true);
    });

    it('should calculate minimal set for a range of frames', async () => {
        const timeline: VisibilityTimeline = {
            frames: new Map<number, FrameResources>([
                [1, {
                    models: new Set(['models/test/tris.md2']),
                    sounds: new Set(),
                    textures: new Set(),
                    loaded: new Set(),
                    visible: new Set(),
                    audible: new Set()
                }],
                [2, {
                    models: new Set(),
                    sounds: new Set(['sound/test2.wav']),
                    textures: new Set(),
                    loaded: new Set(),
                    visible: new Set(),
                    audible: new Set()
                }]
            ]),
            time: new Map()
        };

        await graph.buildGraph(timeline, mockAssetManager as AssetManager);

        const minSet = graph.getMinimalSetForRange(1, 2, timeline);
        expect(minSet.has('models/test/tris.md2')).toBe(true);
        expect(minSet.has('models/test/skin.pcx')).toBe(true);
        expect(minSet.has('sound/test2.wav')).toBe(true);
    });
});
