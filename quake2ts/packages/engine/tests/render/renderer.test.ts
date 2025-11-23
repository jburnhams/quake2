import { createRenderer } from '../../src/render/renderer.js';
import { FrameRenderer } from '../../src/render/frame.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Md3ModelMesh, Md3Pipeline } from '../../src/render/md3Pipeline.js';
import { SpriteRenderer } from '../../src/render/sprite.js';
import { Texture2D } from '../../src/render/resources.js';

// Mock the pipeline dependencies to prevent WebGL calls
vi.mock('../../src/render/bspPipeline.js', () => ({ BspSurfacePipeline: vi.fn() }));
vi.mock('../../src/render/skybox.js', () => ({ SkyboxPipeline: vi.fn() }));
vi.mock('../../src/render/md2Pipeline.js', () => ({ Md2Pipeline: vi.fn() }));
vi.mock('../../src/render/sprite.js', () => ({ SpriteRenderer: vi.fn() }));
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
vi.mock('../../src/render/md3Pipeline.js', async () => {
    const actual = await vi.importActual('../../src/render/md3Pipeline.js') as any;
    return {
        ...actual,
        Md3Pipeline: vi.fn(() => mockMd3Pipeline),
        Md3ModelMesh: vi.fn(() => ({
            surfaces: new Map([['test', {}]]),
            update: vi.fn(),
        })),
    };
});


const mockFrameRenderer: FrameRenderer = {
    renderFrame: vi.fn(),
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
            canvas: { width: 640, height: 480 },
        } as unknown as WebGL2RenderingContext;
    });

    it('should set initial GL state and call the underlying frame renderer', () => {
        const renderer = createRenderer(mockGl);
        const options = { camera: { viewProjectionMatrix: new Float32Array(16) } } as any;
        const entities: any[] = [];

        renderer.renderFrame(options, entities);

        expect(mockGl.disable).toHaveBeenCalled();
        expect(mockGl.enable).toHaveBeenCalled();
        expect(mockGl.depthMask).toHaveBeenCalled();
        expect(mockFrameRenderer.renderFrame).toHaveBeenCalledWith(options);
    });

    it('should render an MD3 entity', () => {
        const renderer = createRenderer(mockGl);
        const options = { camera: { viewProjectionMatrix: new Float32Array(16) } } as any;
        const entities = [{
            type: 'md3',
            model: { surfaces: [{ name: 'test' }] },
            blend: {},
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
            camera: { viewProjectionMatrix: new Float32Array(16) },
            world: {
                textures: new Map([['test_skin', mockTexture]]),
            }
        } as any;
        const entities = [{
            type: 'md3',
            model: { surfaces: [{ name: 'test' }] },
            skins: new Map([['test', 'test_skin']]),
            blend: {},
            transform: new Float32Array(16),
        }] as any;

        renderer.renderFrame(options, entities);

        expect(mockTexture.bind).toHaveBeenCalledWith(0);
    });
});
