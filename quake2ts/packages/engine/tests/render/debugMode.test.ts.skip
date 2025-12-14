import { createRenderer, DebugMode } from '../../src/render/renderer.js';
import { FrameRenderer } from '../../src/render/frame.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/render/bspPipeline.js', () => ({ BspSurfacePipeline: vi.fn() }));
vi.mock('../../src/render/skybox.js', () => ({ SkyboxPipeline: vi.fn() }));
vi.mock('../../src/render/md2Pipeline.js', () => ({ Md2Pipeline: vi.fn() }));

// Create a mock Md3Pipeline instance with bind and drawSurface
const mockMd3Pipeline = {
    bind: vi.fn(),
    drawSurface: vi.fn()
};

vi.mock('../../src/render/md3Pipeline.js', () => ({
    Md3Pipeline: vi.fn(() => mockMd3Pipeline),
    Md3ModelMesh: vi.fn(() => ({
        surfaces: new Map([['test', { geometry: { vertices: [] } }]]),
        update: vi.fn()
    }))
}));

vi.mock('../../src/render/sprite.js', () => ({ SpriteRenderer: vi.fn() }));
vi.mock('../../src/render/collisionVis.js', () => ({
    CollisionVisRenderer: vi.fn(() => ({
        render: vi.fn(),
        clear: vi.fn(),
    })),
}));

// Mock DebugRenderer
const mockDebugRenderer = {
    drawBoundingBox: vi.fn(),
    drawAxes: vi.fn(),
    drawLine: vi.fn(),
    render: vi.fn(),
    clear: vi.fn(),
    getLabels: vi.fn().mockReturnValue([])
};

vi.mock('../../src/render/debug.js', () => ({
    DebugRenderer: vi.fn(() => mockDebugRenderer),
}));

// Mock FrameRenderer
const mockFrameRenderer = {
    renderFrame: vi.fn().mockReturnValue({
        drawCalls: 0,
        vertexCount: 0,
        batches: 0,
        facesDrawn: 0,
        skyDrawn: false,
        viewModelDrawn: false,
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

// Mock culling
vi.mock('../../src/render/culling.js', () => ({
    extractFrustumPlanes: vi.fn().mockReturnValue([]),
    boxIntersectsFrustum: vi.fn().mockReturnValue(true),
    transformAabb: vi.fn().mockReturnValue({ mins: {x:0, y:0, z:0}, maxs: {x:0, y:0, z:0} })
}));

describe('Debug Rendering Mode', () => {
    let mockGl: WebGL2RenderingContext;
    let renderer: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGl = {
            disable: vi.fn(),
            enable: vi.fn(),
            depthMask: vi.fn(),
            getExtension: vi.fn().mockReturnValue({}),
            createQuery: vi.fn().mockReturnValue({}),
            beginQuery: vi.fn(),
            endQuery: vi.fn(),
            deleteQuery: vi.fn(),
            getQueryParameter: vi.fn(),
            getParameter: vi.fn(),
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
        } as unknown as WebGL2RenderingContext;

        renderer = createRenderer(mockGl);
    });

    it('should set debug mode', () => {
        renderer.setDebugMode(DebugMode.BoundingBoxes);
        // Internal state check is hard, but we can check if renderFrame behavior changes
    });

    it('should render bounding boxes when DebugMode.BoundingBoxes is set', () => {
        renderer.setDebugMode(DebugMode.BoundingBoxes);
        const options = { camera: { viewProjectionMatrix: new Float32Array(16), position: [0, 0, 0] } } as any;
        const entities = [{
            type: 'md3',
            model: {
                surfaces: [{ name: 'test' }],
                frames: [{ minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        }] as any;

        renderer.renderFrame(options, entities);

        expect(mockDebugRenderer.drawBoundingBox).toHaveBeenCalled();
        expect(mockDebugRenderer.drawAxes).toHaveBeenCalled();
    });

    it('should force wireframe mode when DebugMode.Wireframe is set', () => {
        renderer.setDebugMode(DebugMode.Wireframe);
        const options = { camera: { viewProjectionMatrix: new Float32Array(16), position: [0, 0, 0] } } as any;
        const entities: any[] = [];

        renderer.renderFrame(options, entities);

        expect(mockFrameRenderer.renderFrame).toHaveBeenCalledWith(expect.objectContaining({
            renderMode: expect.objectContaining({
                mode: 'wireframe',
                applyToAll: true
            })
        }));
    });
});
