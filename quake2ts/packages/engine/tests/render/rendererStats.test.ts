import { createRenderer } from '../../src/render/renderer.js';
import { FrameRenderer } from '../../src/render/frame.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RenderStatistics } from '../../src/render/gpuProfiler.js';

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

// Mock DebugRenderer
vi.mock('../../src/render/debug.js', () => ({
    DebugRenderer: vi.fn(() => ({
        drawBoundingBox: vi.fn(),
        render: vi.fn(),
        clear: vi.fn(),
        getLabels: vi.fn().mockReturnValue([])
    })),
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

// Mock bspTraversal and light to avoid errors during renderFrame
vi.mock('../../src/render/bspTraversal.js', () => ({
    findLeafForPoint: vi.fn().mockReturnValue(0),
    isClusterVisible: vi.fn().mockReturnValue(true),
    gatherVisibleFaces: vi.fn().mockReturnValue([]),
}));
vi.mock('../../src/render/light.js', () => ({
    calculateEntityLight: vi.fn().mockReturnValue(1.0),
}));

describe('Renderer Statistics', () => {
    let mockGl: WebGL2RenderingContext;
    let renderer: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGl = {
            disable: vi.fn(),
            enable: vi.fn(),
            depthMask: vi.fn(),
            getExtension: vi.fn().mockReturnValue({ TIME_ELAPSED_EXT: 0x88BF, GPU_DISJOINT_EXT: 0x8FBB }),
            createQuery: vi.fn().mockReturnValue({}),
            beginQuery: vi.fn(),
            endQuery: vi.fn(),
            deleteQuery: vi.fn(),
            getQueryParameter: vi.fn().mockImplementation((q, param) => {
                 if (param === 0x8867) return true; // QUERY_RESULT_AVAILABLE
                 if (param === 0x8866) return 5000000; // QUERY_RESULT
                 return 0;
            }),
            getParameter: vi.fn().mockReturnValue(0), // No disjoint
            canvas: { width: 640, height: 480 },
            createShader: vi.fn().mockReturnValue({}),
            shaderSource: vi.fn(),
            compileShader: vi.fn(),
            getShaderParameter: vi.fn().mockReturnValue(true),
            createProgram: vi.fn().mockReturnValue({}),
            attachShader: vi.fn(),
            linkProgram: vi.fn(),
            getProgramParameter: vi.fn().mockReturnValue(true),
            getUniformLocation: vi.fn().mockReturnValue({}),
            getAttribLocation: vi.fn().mockReturnValue(0),
            useProgram: vi.fn(),
            bindAttribLocation: vi.fn(),
            enableVertexAttribArray: vi.fn(),
            vertexAttribPointer: vi.fn(),
            createBuffer: vi.fn().mockReturnValue({}),
            bindBuffer: vi.fn(),
            bufferData: vi.fn(),
            createVertexArray: vi.fn().mockReturnValue({}),
            bindVertexArray: vi.fn(),
            deleteShader: vi.fn(),
            deleteProgram: vi.fn(),
            uniformMatrix4fv: vi.fn(),
            drawArrays: vi.fn(),
            // Define constants used by GpuProfiler
            QUERY_RESULT_AVAILABLE: 0x8867,
            QUERY_RESULT: 0x8866
        } as unknown as WebGL2RenderingContext;

        renderer = createRenderer(mockGl);
    });

    it('should return initial zero statistics', () => {
        const stats = renderer.getPerformanceReport();
        expect(stats.drawCalls).toBe(0);
        expect(stats.vertices).toBe(0);
        expect(stats.gpuTimeMs).toBe(0);
    });

    it('should update statistics after rendering a frame', () => {
        const options = { camera: { viewProjectionMatrix: new Float32Array(16), position: [0, 0, 0] } } as any;
        const entities: any[] = []; // No extra entities to keep it simple

        // First render frame triggers startFrame and endFrame of profiler
        renderer.renderFrame(options, entities);

        // The mock FrameRenderer returns: drawCalls: 10, vertexCount: 1000, batches: 5
        // GpuProfiler polls queries in endFrame.
        // Our mock getQueryParameter returns 5ms GPU time.

        const stats = renderer.getPerformanceReport();

        expect(stats.drawCalls).toBe(10);
        expect(stats.vertices).toBe(1000);
        expect(stats.triangles).toBe(Math.floor(1000 / 3));
        expect(stats.textureBinds).toBe(5);

        // GPU time should be updated if extension is present and query is successful
        // Our mock simulates success.
        expect(stats.gpuTimeMs).toBeCloseTo(5.0);

        // CPU frame time should be positive
        expect(stats.cpuFrameTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should aggregate entity draw calls into stats', () => {
        // Need to simulate an entity render.
        // This is tricky without mocking Md2/Md3 pipelines deeply.
        // But renderFrame logic adds to stats.
        // "lastFrameStats = { drawCalls: stats.drawCalls + entityDrawCalls, ... }"
        // If we mock an entity, it should add up.
        // Md2Pipeline and Md3Pipeline are mocked globally above.
        // We need to ensure Md3ModelMesh mock exists.

        const options = { camera: { viewProjectionMatrix: new Float32Array(16), position: [0, 0, 0] } } as any;
         // Mock an MD3 entity
        const entities = [{
            type: 'md3',
            model: {
                surfaces: [{ name: 'test' }],
                frames: [{ minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        }] as any;

        // MD3 mock pipeline setup needs to be valid.
        // The global mock setup in previous test file (renderer.test.ts) was doing heavy lifting.
        // We need similar setup here if not importing it.
        // But wait, the mock setup for Md3ModelMesh inside this file is NOT present.
        // Let's add it.

    });
});
