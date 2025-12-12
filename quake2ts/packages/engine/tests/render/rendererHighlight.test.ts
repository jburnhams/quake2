import { createRenderer } from '../../src/render/renderer.js';
import { FrameRenderer, RenderModeConfig } from '../../src/render/frame.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Md3ModelMesh, Md3Pipeline } from '../../src/render/md3Pipeline.js';
import { Texture2D } from '../../src/render/resources.js';

// Mock the pipeline dependencies to prevent WebGL calls
vi.mock('../../src/render/bspPipeline.js', () => ({ BspSurfacePipeline: vi.fn() }));
vi.mock('../../src/render/skybox.js', () => ({ SkyboxPipeline: vi.fn() }));
vi.mock('../../src/render/md2Pipeline.js', () => ({ Md2Pipeline: vi.fn() }));
vi.mock('../../src/render/sprite.js', () => ({ SpriteRenderer: vi.fn() }));
vi.mock('../../src/render/bspTraversal.js', () => ({
    findLeafForPoint: vi.fn().mockReturnValue(0),
    isClusterVisible: vi.fn().mockReturnValue(true),
    gatherVisibleFaces: vi.fn().mockReturnValue([]),
}));
vi.mock('../../src/render/light.js', () => ({
    calculateEntityLight: vi.fn().mockReturnValue(1.0),
}));
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

vi.mock('../../src/render/md3Pipeline.js', async () => {
    const actual = await vi.importActual('../../src/render/md3Pipeline.js') as any;
    return {
        ...actual,
        Md3Pipeline: vi.fn(() => mockMd3Pipeline),
        Md3ModelMesh: vi.fn(() => ({
            surfaces: new Map([['test', {
                geometry: { vertices: new Array(10) },
                update: vi.fn()
            }]]),
            update: vi.fn(),
        })),
    };
});

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

vi.mock('../../src/render/frame.js', () => ({
    createFrameRenderer: vi.fn(() => mockFrameRenderer),
}));

describe('Renderer Highlighting', () => {
    let mockGl: WebGL2RenderingContext;

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
            createTexture: vi.fn().mockReturnValue({}),
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
    });

    it('should render highlighted entity with a second wireframe pass', () => {
        const renderer = createRenderer(mockGl);
        const options = { camera: { viewProjectionMatrix: new Float32Array(16), position: [0, 0, 0] } } as any;
        const entityId = 123;
        const highlightColor: [number, number, number, number] = [1, 0, 0, 1]; // Red

        const entities = [{
            type: 'md3',
            id: entityId,
            model: {
                surfaces: [{ name: 'test' }],
                frames: [
                    { minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }
                ]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        }] as any;

        // Set Highlight
        renderer.setEntityHighlight(entityId, highlightColor);

        renderer.renderFrame(options, entities);

        // Expect drawSurface to be called twice:
        // 1. Normal render (default mode or textured)
        // 2. Highlight render (wireframe with red color)
        expect(mockMd3Pipeline.drawSurface).toHaveBeenCalledTimes(2);

        const firstCall = mockMd3Pipeline.drawSurface.mock.calls[0];
        const secondCall = mockMd3Pipeline.drawSurface.mock.calls[1];

        // First call should be normal
        // The renderMode might be undefined or default depending on setup, but typically undefined for textured
        // In the test setup, we don't have skins, so logic might default.
        // But we specifically check the second call for the highlight config.

        const secondCallConfig = secondCall[1]?.renderMode;
        expect(secondCallConfig).toBeDefined();
        expect(secondCallConfig?.mode).toBe('wireframe');
        expect(secondCallConfig?.color).toEqual(highlightColor);
        expect(secondCallConfig?.applyToAll).toBe(true);
    });

    it('should clear highlight and stop rendering second pass', () => {
        const renderer = createRenderer(mockGl);
        const options = { camera: { viewProjectionMatrix: new Float32Array(16), position: [0, 0, 0] } } as any;
        const entityId = 123;
        const highlightColor: [number, number, number, number] = [0, 1, 0, 1];

        const entities = [{
            type: 'md3',
            id: entityId,
            model: {
                surfaces: [{ name: 'test' }],
                frames: [{ minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        }] as any;

        renderer.setEntityHighlight(entityId, highlightColor);
        renderer.clearEntityHighlight(entityId);

        renderer.renderFrame(options, entities);

        // Expect drawSurface to be called once (normal render only)
        expect(mockMd3Pipeline.drawSurface).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple highlighted entities', () => {
        const renderer = createRenderer(mockGl);
        const options = { camera: { viewProjectionMatrix: new Float32Array(16), position: [0, 0, 0] } } as any;

        const entity1 = {
            type: 'md3',
            id: 1,
            model: { surfaces: [{ name: 'test' }], frames: [{ minBounds: {x: -1, y: -1, z: -1}, maxBounds: {x: 1, y: 1, z: 1} }] },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        };
        const entity2 = {
            type: 'md3',
            id: 2,
            model: { surfaces: [{ name: 'test' }], frames: [{ minBounds: {x: -1, y: -1, z: -1}, maxBounds: {x: 1, y: 1, z: 1} }] },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        };

        const color1: [number, number, number, number] = [1, 0, 0, 1];
        const color2: [number, number, number, number] = [0, 0, 1, 1];

        renderer.setEntityHighlight(1, color1);
        renderer.setEntityHighlight(2, color2);

        renderer.renderFrame(options, [entity1, entity2] as any);

        // 2 entities * 2 passes each = 4 calls
        expect(mockMd3Pipeline.drawSurface).toHaveBeenCalledTimes(4);

        // Verify calls contain correct highlight colors
        const calls = mockMd3Pipeline.drawSurface.mock.calls;

        // Find highlight calls (mode=wireframe)
        const highlightCalls = calls.filter((call: any) => call[1]?.renderMode?.mode === 'wireframe');
        expect(highlightCalls).toHaveLength(2);

        const colorsFound = highlightCalls.map((call: any) => call[1].renderMode.color);
        expect(colorsFound).toContainEqual(color1);
        expect(colorsFound).toContainEqual(color2);
    });
});
