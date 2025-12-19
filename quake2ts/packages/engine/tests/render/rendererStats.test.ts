import { createRenderer } from '../../src/render/renderer.js';
import { FrameRenderer } from '../../src/render/frame.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockGL } from '../helpers/mockWebGL.js';

// Mock dependencies
vi.mock('../../src/render/bspPipeline.js', () => ({ BspSurfacePipeline: vi.fn() }));
vi.mock('../../src/render/skybox.js', () => ({ SkyboxPipeline: vi.fn() }));
vi.mock('../../src/render/md2Pipeline.js', () => ({
    Md2Pipeline: vi.fn(() => ({
        bind: vi.fn(),
        draw: vi.fn(),
    })),
    Md2MeshBuffers: vi.fn(() => ({
        update: vi.fn(),
        geometry: { vertices: new Float32Array(30) }
    }))
}));
vi.mock('../../src/render/sprite.js', () => ({ SpriteRenderer: vi.fn() }));
vi.mock('../../src/render/collisionVis.js', () => ({
    CollisionVisRenderer: vi.fn(() => ({
        render: vi.fn(),
        clear: vi.fn(),
    })),
}));

// Mock Md3Pipeline and Md3ModelMesh
vi.mock('../../src/render/md3Pipeline.js', () => ({
    Md3Pipeline: vi.fn(() => ({
        bind: vi.fn(),
        drawSurface: vi.fn(),
    })),
    Md3ModelMesh: vi.fn(() => ({
        update: vi.fn(),
        surfaces: new Map([['test', { geometry: { vertices: new Float32Array(30) } }]])
    }))
}));

// Mock DebugRenderer
vi.mock('../../src/render/debug.js', () => ({
    DebugRenderer: vi.fn(() => ({
        drawBoundingBox: vi.fn(),
        render: vi.fn(),
        clear: vi.fn(),
        getLabels: vi.fn().mockReturnValue([])
    })),
}));

// Mock culling to always verify visibility
vi.mock('../../src/render/culling.js', () => ({
    boxIntersectsFrustum: vi.fn().mockReturnValue(true),
    extractFrustumPlanes: vi.fn().mockReturnValue([]),
    transformAabb: vi.fn().mockReturnValue({ mins: {x:0,y:0,z:0}, maxs: {x:0,y:0,z:0} })
}));

// Mock FrameRenderer with stats return
const mockFrameRenderer: FrameRenderer = {
    renderFrame: vi.fn().mockReturnValue({
        drawCalls: 10,
        vertexCount: 1000,
        batches: 5,
        facesDrawn: 50,
        skyDrawn: true,
        viewModelDrawn: true,
        fps: 60
    }),
};

vi.mock('../../src/render/frame.js', () => ({
    createFrameRenderer: vi.fn(() => mockFrameRenderer),
}));

// Mock bspTraversal and light
vi.mock('../../src/render/bspTraversal.js', () => ({
    findLeafForPoint: vi.fn().mockReturnValue(0),
    isClusterVisible: vi.fn().mockReturnValue(true),
    gatherVisibleFaces: vi.fn().mockReturnValue([]),
}));
vi.mock('../../src/render/light.js', () => ({
    calculateEntityLight: vi.fn().mockReturnValue(1.0),
}));

describe('Renderer Statistics', () => {
    let mockGl: ReturnType<typeof createMockGL>;
    let renderer: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGl = createMockGL();

        // Mock extensions for Profiler
        mockGl.extensions.set('EXT_disjoint_timer_query_webgl2', { TIME_ELAPSED_EXT: 0x88BF, GPU_DISJOINT_EXT: 0x8FBB });
        // The mockGL defaults getQueryParameter to null/0, override for stats
        mockGl.getQueryParameter = vi.fn().mockImplementation((q, param) => {
             if (param === 0x8867) return true; // QUERY_RESULT_AVAILABLE
             if (param === 0x8866) return 5000000; // QUERY_RESULT
             return 0;
        });

        renderer = createRenderer(mockGl as any);
    });

    it('should return initial zero statistics', () => {
        const stats = renderer.getPerformanceReport();
        expect(stats.drawCalls).toBe(0);
        expect(stats.vertices).toBe(0);
        expect(stats.gpuTimeMs).toBe(0);
    });

    it('should update statistics after rendering a frame', () => {
        const viewMatrix = new Float32Array(16);
        const options = {
            camera: {
                viewProjectionMatrix: new Float32Array(16),
                viewMatrix: viewMatrix,
                position: [0, 0, 0]
            }
        } as any;
        const entities: any[] = [];

        renderer.renderFrame(options, entities);

        const stats = renderer.getPerformanceReport();

        expect(stats.drawCalls).toBe(10);
        expect(stats.vertices).toBe(1000);
        expect(stats.triangles).toBe(Math.floor(1000 / 3));
        expect(stats.textureBinds).toBe(5);

        expect(stats.gpuTimeMs).toBeCloseTo(5.0);
        expect(stats.cpuFrameTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should aggregate entity draw calls into stats', () => {
        const viewMatrix = new Float32Array(16);
        const options = {
            camera: {
                viewProjectionMatrix: new Float32Array(16),
                viewMatrix: viewMatrix,
                position: [0, 0, 0]
            }
        } as any;

        const entities = [{
            type: 'md3',
            model: {
                surfaces: [{ name: 'test' }],
                frames: [{ minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
            lighting: {}
        }] as any;

        renderer.renderFrame(options, entities);

        // draw calls: 10 (frame) + 1 (entity) = 11
        // vertices: 1000 (frame) + 30 (entity vertices in mock) = 1030
        const stats = renderer.getPerformanceReport();

        expect(stats.drawCalls).toBe(11);
        expect(stats.vertices).toBe(1030);
    });
});
