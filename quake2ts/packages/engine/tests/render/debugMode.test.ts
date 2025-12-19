import { createRenderer } from '../../src/render/renderer.js';
import { DebugMode } from '../../src/render/debugMode.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockGL } from '../helpers/mockWebGL.js';

// Mock dependencies
vi.mock('../../src/render/bspPipeline.js', () => ({ BspSurfacePipeline: vi.fn() }));
vi.mock('../../src/render/skybox.js', () => ({ SkyboxPipeline: vi.fn() }));
vi.mock('../../src/render/md2Pipeline.js', () => ({ Md2Pipeline: vi.fn() }));
vi.mock('../../src/render/sprite.js', () => ({ SpriteRenderer: vi.fn() }));
vi.mock('../../src/render/collisionVis.js', () => ({
    CollisionVisRenderer: vi.fn(() => ({
        render: vi.fn(),
        clear: vi.fn(),
    })),
}));

// Properly mock Md3Pipeline and Md3ModelMesh
vi.mock('../../src/render/md3Pipeline.js', async (importOriginal) => {
    // const actual = await importOriginal(); // Not needed if we mock everything used
    return {
        Md3Pipeline: vi.fn(() => ({
            bind: vi.fn(),
            drawSurface: vi.fn(),
        })),
        Md3ModelMesh: vi.fn(() => ({
            update: vi.fn(),
            surfaces: new Map(), // Mock empty surfaces
        })),
    };
});

// Mock FrameRenderer
vi.mock('../../src/render/frame.js', () => ({
    createFrameRenderer: vi.fn(() => ({
        renderFrame: vi.fn().mockReturnValue({
            drawCalls: 0,
            vertexCount: 0,
            batches: 0,
            facesDrawn: 0,
            skyDrawn: false,
            viewModelDrawn: false,
            fps: 60
        }),
    })),
}));

// Mock DebugRenderer
const mockDebugRenderer = {
    drawBoundingBox: vi.fn(),
    drawAxes: vi.fn(),
    render: vi.fn(),
    clear: vi.fn(),
    getLabels: vi.fn().mockReturnValue([]),
    drawLine: vi.fn(), // Needed for PVS/Normals
};

vi.mock('../../src/render/debug.js', () => ({
    DebugRenderer: vi.fn(() => mockDebugRenderer),
}));

// Mock culling and traversal
vi.mock('../../src/render/culling.js', () => ({
    boxIntersectsFrustum: vi.fn().mockReturnValue(true),
    extractFrustumPlanes: vi.fn().mockReturnValue([]),
    transformAabb: vi.fn().mockReturnValue({ mins: {x:0,y:0,z:0}, maxs: {x:0,y:0,z:0} })
}));

vi.mock('../../src/render/bspTraversal.js', () => ({
    findLeafForPoint: vi.fn().mockReturnValue(0),
    isClusterVisible: vi.fn().mockReturnValue(true),
    gatherVisibleFaces: vi.fn().mockReturnValue([]),
}));

vi.mock('../../src/render/light.js', () => ({
    calculateEntityLight: vi.fn().mockReturnValue(1.0),
}));

describe('DebugMode Integration', () => {
    let mockGl: ReturnType<typeof createMockGL>;
    let renderer: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGl = createMockGL();
        renderer = createRenderer(mockGl as any);
    });

    it('should trigger debug rendering in renderFrame', () => {
        renderer.setDebugMode(DebugMode.BoundingBoxes);
        const options = {
            camera: { viewProjectionMatrix: new Float32Array(16), viewMatrix: new Float32Array(16), position: [0, 0, 0] }
        } as any;
        const entities = [{
            type: 'md3',
            model: {
                frames: [{ minBounds: {x:-10,y:-10,z:-10}, maxBounds: {x:10,y:10,z:10} }],
                surfaces: [{ name: 'test' }]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        }] as any;

        renderer.renderFrame(options, entities);

        expect(mockDebugRenderer.drawBoundingBox).toHaveBeenCalled();
        expect(mockDebugRenderer.render).toHaveBeenCalled();
        expect(mockDebugRenderer.clear).toHaveBeenCalled();
    });

    it('should handle PVSClusters mode without crashing', () => {
        const options = {
            camera: { viewProjectionMatrix: new Float32Array(16), viewMatrix: new Float32Array(16), position: [0, 0, 0] },
            world: {
                // map must have structure expected by renderer loop
                map: {
                    leafs: [{ cluster: 0 }],
                    visibility: undefined
                },
                surfaces: []
            }
        } as any;

        renderer.setDebugMode(DebugMode.PVSClusters);
        expect(() => renderer.renderFrame(options, [])).not.toThrow();
    });

    it('should handle Lightmaps mode without crashing', () => {
        const options = {
            camera: { viewProjectionMatrix: new Float32Array(16), viewMatrix: new Float32Array(16), position: [0, 0, 0] },
            world: {
                map: {
                    leafs: [{ cluster: 0 }],
                    visibility: undefined
                },
                surfaces: []
            }
        } as any;

        renderer.setDebugMode(DebugMode.Lightmaps);
        expect(() => renderer.renderFrame(options, [])).not.toThrow();
    });
});
