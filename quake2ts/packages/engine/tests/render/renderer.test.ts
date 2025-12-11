import { createRenderer } from '../../src/render/renderer.js';
import { FrameRenderer, RenderModeConfig } from '../../src/render/frame.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Md3ModelMesh, Md3Pipeline } from '../../src/render/md3Pipeline.js';
import { SpriteRenderer } from '../../src/render/sprite.js';
import { Texture2D } from '../../src/render/resources.js';

// Mock the pipeline dependencies to prevent WebGL calls
vi.mock('../../src/render/bspPipeline.js', () => ({ BspSurfacePipeline: vi.fn() }));
vi.mock('../../src/render/skybox.js', () => ({ SkyboxPipeline: vi.fn() }));
vi.mock('../../src/render/md2Pipeline.js', () => ({ Md2Pipeline: vi.fn() }));
vi.mock('../../src/render/sprite.js', () => ({ SpriteRenderer: vi.fn() }));
// Mock PVS/BSP traversal to avoid complex map data setup
vi.mock('../../src/render/bspTraversal.js', () => ({
    findLeafForPoint: vi.fn().mockReturnValue(0), // Return a valid leaf index
    isClusterVisible: vi.fn().mockReturnValue(true),
    gatherVisibleFaces: vi.fn().mockReturnValue([]),
}));
// Mock light calculation to avoid map entity access
vi.mock('../../src/render/light.js', () => ({
    calculateEntityLight: vi.fn().mockReturnValue(1.0),
}));

// Mock CollisionVisRenderer as it is also instantiated in createRenderer
vi.mock('../../src/render/collisionVis.js', () => ({
    CollisionVisRenderer: vi.fn(() => ({
        render: vi.fn(),
        clear: vi.fn(),
    })),
}));

const mockMd3Pipeline = {
    bind: vi.fn(),
    drawSurface: vi.fn(),
};

// Properly mocked Md3ModelMesh with geometry.vertices for stats tracking
vi.mock('../../src/render/md3Pipeline.js', async () => {
    const actual = await vi.importActual('../../src/render/md3Pipeline.js') as any;
    return {
        ...actual,
        Md3Pipeline: vi.fn(() => mockMd3Pipeline),
        Md3ModelMesh: vi.fn(() => ({
            surfaces: new Map([['test', {
                geometry: { vertices: new Array(10) }, // Mock 10 vertices
                update: vi.fn()
            }]]),
            update: vi.fn(),
        })),
    };
});

// Mock FrameRenderer with stats return
const mockFrameRenderer: FrameRenderer = {
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

// Mock the frame renderer factory
vi.mock('../../src/render/frame.js', () => ({
    createFrameRenderer: vi.fn(() => mockFrameRenderer),
}));


describe('Renderer', () => {
    let mockGl: WebGL2RenderingContext;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGl = {
            disable: vi.fn(),
            enable: vi.fn(),
            depthMask: vi.fn(),
            getExtension: vi.fn().mockReturnValue({}), // Mock extension support for Profiler
            createQuery: vi.fn().mockReturnValue({}),
            beginQuery: vi.fn(),
            endQuery: vi.fn(),
            deleteQuery: vi.fn(),
            getQueryParameter: vi.fn(),
            getParameter: vi.fn(),
            createTexture: vi.fn().mockReturnValue({}),
            canvas: { width: 640, height: 480 },
            // Shader/Program mocks for DebugRenderer
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
    });

    it('should set initial GL state and call the underlying frame renderer', () => {
        const renderer = createRenderer(mockGl);
        const options = { camera: { viewProjectionMatrix: new Float32Array(16), position: [0, 0, 0] } } as any;
        const entities: any[] = [];

        renderer.renderFrame(options, entities);

        expect(mockGl.disable).toHaveBeenCalled();
        expect(mockGl.enable).toHaveBeenCalled();
        expect(mockGl.depthMask).toHaveBeenCalled();
        expect(mockFrameRenderer.renderFrame).toHaveBeenCalledWith(expect.objectContaining({
            camera: options.camera,
            disableLightmaps: false
        }));
    });

    it('should render an MD3 entity', () => {
        const renderer = createRenderer(mockGl);
        const options = { camera: { viewProjectionMatrix: new Float32Array(16), position: [0, 0, 0] } } as any;
        const entities = [{
            type: 'md3',
            model: {
                surfaces: [{ name: 'test' }],
                frames: [
                    { minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }
                ]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        }] as any;

        renderer.renderFrame(options, entities);

        expect(Md3ModelMesh).toHaveBeenCalledTimes(1);
        expect(mockMd3Pipeline.bind).toHaveBeenCalledTimes(1);
        expect(mockMd3Pipeline.drawSurface).toHaveBeenCalledTimes(1);
    });

    it('should bind textures for MD3 entities', () => {
        const renderer = createRenderer(mockGl);
        const mockTexture = { bind: vi.fn() } as unknown as Texture2D;
        const options = {
            camera: { viewProjectionMatrix: new Float32Array(16), position: [0, 0, 0] },
            world: {
                textures: new Map([['test_skin', mockTexture]]),
                // Mock map with basic structure expected by PVS logic
                map: {
                    leafs: [{ cluster: 0 }],
                    visibility: undefined
                },
            }
        } as any;
        const entities = [{
            type: 'md3',
            model: {
                surfaces: [{ name: 'test' }],
                frames: [
                    { minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }
                ]
            },
            skins: new Map([['test', 'test_skin']]),
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        }] as any;

        renderer.renderFrame(options, entities);

        expect(mockTexture.bind).toHaveBeenCalledWith(0);
    });

    it('should pass RenderMode configuration to pipeline when textures are missing and not applyToAll', () => {
        const renderer = createRenderer(mockGl);
        const renderMode: RenderModeConfig = { mode: 'wireframe', applyToAll: false };
        const options = {
            camera: { viewProjectionMatrix: new Float32Array(16), position: [0, 0, 0] },
            renderMode
        } as any;

        const entities = [{
            type: 'md3',
            model: {
                surfaces: [{ name: 'test' }],
                frames: [{ minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
            // Missing skins
        }] as any;

        renderer.renderFrame(options, entities);

        // Verify drawSurface is called with options containing renderMode
        expect(mockMd3Pipeline.drawSurface).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            renderMode: renderMode
        }));
    });

    it('should generate random color when configured for entity with ID', () => {
         const renderer = createRenderer(mockGl);
        const renderMode: RenderModeConfig = {
            mode: 'solid',
            applyToAll: true,
            generateRandomColor: true
        };
        const options = {
            camera: { viewProjectionMatrix: new Float32Array(16), position: [0, 0, 0] },
            renderMode
        } as any;

        const entities = [{
            type: 'md3',
            id: 12345,
            model: {
                surfaces: [{ name: 'test' }],
                frames: [{ minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        }] as any;

        renderer.renderFrame(options, entities);

        expect(mockMd3Pipeline.drawSurface).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            renderMode: expect.objectContaining({
                mode: 'solid',
                color: expect.any(Array) // Should have generated a color array
            })
        }));

        const callArgs = mockMd3Pipeline.drawSurface.mock.calls[0][1];
        expect(callArgs.renderMode.color).toHaveLength(4);
    });
});
