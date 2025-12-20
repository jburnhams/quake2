import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRenderer } from '../../src/render/renderer.js';
import { DebugRenderer } from '../../src/render/debug.js';

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
    getExtension: vi.fn(),
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
vi.mock('../../src/render/bspPipeline.js', () => ({
    BspSurfacePipeline: class { bind = vi.fn(); draw = vi.fn(); dispose = vi.fn(); },
    applySurfaceState: vi.fn(),
}));

vi.mock('../../src/render/skybox.js', () => ({
    SkyboxPipeline: class { bind = vi.fn(); draw = vi.fn(); gl = gl; },
    computeSkyScroll: vi.fn(() => [0, 0]),
    removeViewTranslation: vi.fn((m) => m),
}));

vi.mock('../../src/render/md2Pipeline.js', () => ({
    Md2Pipeline: class { bind = vi.fn(); draw = vi.fn(); dispose = vi.fn(); },
    Md2MeshBuffers: class { update = vi.fn(); geometry = { vertices: [], indices: [] }; vertexArray = { bind: vi.fn() }; indexBuffer = { bind: vi.fn() }; }
}));

vi.mock('../../src/render/md3Pipeline.js', () => ({
    Md3Pipeline: class { bind = vi.fn(); drawSurface = vi.fn(); dispose = vi.fn(); },
    Md3ModelMesh: class { surfaces = new Map(); update = vi.fn(); }
}));

vi.mock('../../src/render/sprite.js', () => ({
    SpriteRenderer: class { begin = vi.fn(); draw = vi.fn(); drawRect = vi.fn(); end = vi.fn(); }
}));

vi.mock('../../src/render/collisionVis.js', () => ({
    CollisionVisRenderer: class { render = vi.fn(); clear = vi.fn(); }
}));

vi.mock('../../src/render/bspTraversal.js', () => ({
    findLeafForPoint: vi.fn(() => -1),
    isClusterVisible: vi.fn(() => true),
    gatherVisibleFaces: vi.fn(() => []),
}));

vi.mock('../../src/render/culling.js', () => ({
    extractFrustumPlanes: vi.fn(() => []),
    boxIntersectsFrustum: vi.fn(() => true),
    transformAabb: vi.fn(() => ({ mins: {x:0,y:0,z:0}, maxs: {x:0,y:0,z:0} })),
}));

vi.mock('../../src/render/light.js', () => ({
    calculateEntityLight: vi.fn(() => 1.0),
}));

describe('LOD Support', () => {
    let renderer: ReturnType<typeof createRenderer>;

    beforeEach(() => {
        vi.clearAllMocks();
        renderer = createRenderer(gl);
    });

    it('should allow setting LOD bias', () => {
        // Just verify the function exists and doesn't crash
        // We can't easily test internal state without exposing it,
        // but this confirms API presence.
        renderer.setLodBias(1.5);
        renderer.setLodBias(0.5);
    });
});
