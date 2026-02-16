import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createRenderer } from '../../../src/render/renderer';
import { Camera } from '../../../src/render/camera';
import { CameraState } from '../../../src/render/types/camera';
import { mat4, vec3 } from 'gl-matrix';

// Mock WebGL2RenderingContext
const gl = {
    getExtension: vi.fn(),
    createProgram: vi.fn(() => ({})),
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getProgramParameter: vi.fn(() => true),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    getAttribLocation: vi.fn(() => 0),
    bindAttribLocation: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    createVertexArray: vi.fn(() => ({})),
    bindVertexArray: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    vertexAttribIPointer: vi.fn(),
    drawElements: vi.fn(),
    drawArrays: vi.fn(),
    createFramebuffer: vi.fn(() => ({})),
    deleteFramebuffer: vi.fn(),
    createTexture: vi.fn(() => ({})),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    activeTexture: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    depthMask: vi.fn(),
    blendFunc: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4f: vi.fn(),
    uniform3fv: vi.fn(),
    uniform4fv: vi.fn(),
    createQuery: vi.fn(() => ({})),
    beginQuery: vi.fn(),
    endQuery: vi.fn(),
    getQueryParameter: vi.fn(),
    getParameter: vi.fn(),
    deleteQuery: vi.fn(),
    viewport: vi.fn(),
    deleteShader: vi.fn(),
    deleteProgram: vi.fn(),
    canvas: { width: 800, height: 600 },
    // Constants
    STATIC_DRAW: 0x88E4,
    DYNAMIC_DRAW: 0x88E8,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    LINES: 0x0001,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_BUFFER_BIT: 0x0100,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    DEPTH_TEST: 0x0B71,
    BLEND: 0x0BE2,
    TEXTURE_2D: 0x0DE1,
    TEXTURE0: 0x84C0,
    QUERY_RESULT_AVAILABLE: 0x8867,
    QUERY_RESULT: 0x8866,
} as unknown as WebGL2RenderingContext;

// Mock dependencies
const mockBspBind = vi.fn(() => ({}));
const mockSkyDraw = vi.fn();

// Use paths without extension to match how vite/vitest usually resolves/mocks
vi.mock('../../../src/render/bspPipeline', () => ({
    BspSurfacePipeline: class {
        bind = mockBspBind;
        draw = vi.fn();
        dispose = vi.fn();
        get shaderSize() { return 0; }
    },
    applySurfaceState: vi.fn(),
}));

vi.mock('../../../src/render/skybox', () => ({
    SkyboxPipeline: class {
        bind = vi.fn();
        draw = mockSkyDraw;
        gl = gl;
        get shaderSize() { return 0; }
    },
    computeSkyScroll: vi.fn(() => [0, 0]),
    removeViewTranslation: vi.fn((m) => m),
}));

vi.mock('../../../src/render/md2Pipeline', () => ({
    Md2Pipeline: class {
        bind = vi.fn();
        draw = vi.fn();
        dispose = vi.fn();
        get shaderSize() { return 0; }
    },
    Md2MeshBuffers: class {
        update = vi.fn();
        geometry = { vertices: [], indices: [] };
        vertexArray = { bind: vi.fn() };
        indexBuffer = { bind: vi.fn() };
    }
}));

vi.mock('../../../src/render/md3Pipeline', () => ({
    Md3Pipeline: class {
        bind = vi.fn();
        drawSurface = vi.fn();
        dispose = vi.fn();
        get shaderSize() { return 0; }
    },
    Md3ModelMesh: class {
        surfaces = new Map();
        update = vi.fn();
    }
}));

vi.mock('../../../src/render/sprite', () => ({
    SpriteRenderer: class {
        begin = vi.fn();
        draw = vi.fn();
        drawRect = vi.fn();
        end = vi.fn();
        get shaderSize() { return 0; }
    }
}));

vi.mock('../../../src/render/collisionVis', () => ({
    CollisionVisRenderer: class {
        render = vi.fn();
        clear = vi.fn();
        get shaderSize() { return 0; }
    }
}));

vi.mock('../../../src/render/debug', () => ({
    DebugRenderer: class {
        render = vi.fn();
        clear = vi.fn();
        getLabels = vi.fn(() => []);
        drawLine = vi.fn();
        get shaderSize() { return 0; }
    }
}));

vi.mock('../../../src/render/particleSystem', () => ({
    ParticleSystem: class {
        update = vi.fn();
    },
    ParticleRenderer: class {
        render = vi.fn();
        get shaderSize() { return 0; }
    }
}));

vi.mock('../../../src/render/gpuProfiler', () => ({
    GpuProfiler: class {
        trackShaderMemory = vi.fn();
        trackTextureMemory = vi.fn();
        trackBufferMemory = vi.fn();
        startFrame = vi.fn();
        endFrame = vi.fn();
        getPerformanceReport = vi.fn(() => ({}));
        getMemoryUsage = vi.fn(() => ({}));
        dispose = vi.fn();
    }
}));

// Mock bsp traversal
vi.mock('../../../src/render/bspTraversal', () => ({
    findLeafForPoint: vi.fn(() => 0),
    isClusterVisible: vi.fn(() => true),
    gatherVisibleFaces: vi.fn(() => [{ faceIndex: 0, sortKey: 0 }]),
    calculateReachableAreas: vi.fn(() => null)
}));

vi.mock('../../../src/render/culling', () => ({
    extractFrustumPlanes: vi.fn(() => []),
    boxIntersectsFrustum: vi.fn(() => true),
    transformAabb: vi.fn(() => ({ mins: {x:0,y:0,z:0}, maxs: {x:0,y:0,z:0} })),
}));

// Helper to check if matrices are close
function expectToBeCloseToMat4(actual: Float32Array | mat4, expected: Float32Array | mat4, precision = 1e-5) {
    if (!actual) throw new Error("Actual matrix is undefined/null");
    if (!expected) throw new Error("Expected matrix is undefined/null");
    expect(actual.length).toBe(expected.length);
    for (let i = 0; i < actual.length; i++) {
        expect(actual[i]).toBeCloseTo(expected[i], -Math.log10(precision));
    }
}

describe('WebGL Adapter Integration', () => {
    let renderer: any;

    beforeEach(async () => {
        vi.resetModules(); // Important to reset modules for fresh mocks
        vi.clearAllMocks();
        const { createRenderer } = await import('../../../src/render/renderer.js');
        renderer = createRenderer(gl);
    });

    test('adapter matrices are used in pipeline when rendering', () => {
        const camera = new Camera(800, 600);
        camera.setPosition(100, 200, 50);
        camera.setRotation(30, 45, 0);

        // Dummy world data to trigger BSP rendering
        // Even if findLeafForPoint mock fails (and real one runs), providing valid structure prevents crash
        const dummyWorld: any = {
             map: {
                 models: [{ headNode: -1 }], // -1 = Leaf 0. Avoids traversing nodes.
                 nodes: [],
                 planes: [],
                 leafs: [{ cluster: 0, area: 0 }],
                 faces: [{}], // 1 face
                 visibility: { numClusters: 1, clusters: [{ pvs: new Uint8Array(1) }] },
                 areas: []
             },
             surfaces: [{ faceIndex: 0, surfaceFlags: 0, texture: 'tex', vertexCount: 10 }],
             materials: { getMaterial: () => null, update: () => {} },
             textures: new Map(),
        };

        // Render frame
        renderer.renderFrame({
            camera,
            world: dummyWorld,
            timeSeconds: 0
        }, []);

        expect(mockBspBind).toHaveBeenCalled();
        const callArgs = mockBspBind.mock.calls[0][0];

        // The bspPipeline now calculates matrices from cameraState internally
        // So modelViewProjection passed to bind() might be undefined unless overridden
        const receivedState = callArgs.cameraState;

        expect(receivedState).toBeDefined();
        // Check position and angles
        for (let i = 0; i < 3; i++) {
            expect(receivedState.position[i]).toBeCloseTo(camera.position[i]);
            expect(receivedState.angles[i]).toBeCloseTo(camera.angles[i]);
        }
    });

    test('explicit CameraState overrides Camera object in rendering pipeline', () => {
        const camera = new Camera(800, 600);

        // Explicit state different from camera
        // Camera default is 0,0,0
        // State puts it at 100,0,0
        const explicitState: CameraState = {
            position: vec3.fromValues(100, 0, 0),
            angles: vec3.fromValues(0, 0, 0),
            fov: 90,
            aspect: 800/600,
            near: 0.1,
            far: 1000
        };

        const dummyWorld: any = {
             map: {
                 models: [{ headNode: -1 }], // -1 = Leaf 0
                 nodes: [],
                 planes: [],
                 leafs: [{ cluster: 0, area: 0 }],
                 faces: [{}],
                 visibility: { numClusters: 1, clusters: [{ pvs: new Uint8Array(1) }] },
                 areas: []
             },
             surfaces: [{ faceIndex: 0, surfaceFlags: 0, texture: 'tex', vertexCount: 10 }],
             materials: { getMaterial: () => null, update: () => {} },
             textures: new Map(),
        };

        renderer.renderFrame({
            camera,
            cameraState: explicitState, // Override
            world: dummyWorld,
            timeSeconds: 0
        }, []);

        expect(mockBspBind).toHaveBeenCalled();
        const callArgs = mockBspBind.mock.calls[0][0];

        // Verify explicit state was passed
        expect(callArgs.cameraState).toBe(explicitState);
    });
});
