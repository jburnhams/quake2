import { createRenderer } from '../../src/render/renderer.js';
import { FrameRenderer } from '../../src/render/frame.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Md3ModelMesh, Md3Pipeline } from '../../src/render/md3Pipeline.js';

// Mock the pipeline dependencies to prevent WebGL calls
vi.mock('../../src/render/bspPipeline.js', () => ({ BspSurfacePipeline: vi.fn() }));
vi.mock('../../src/render/skybox.js', () => ({ SkyboxPipeline: vi.fn() }));
vi.mock('../../src/render/md2Pipeline.js', () => ({ Md2Pipeline: vi.fn() }));

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
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call the underlying frame renderer', () => {
        const mockGl = {} as WebGL2RenderingContext;
        const renderer = createRenderer(mockGl);
        const options = { camera: { viewProjectionMatrix: new Float32Array(16) } } as any;
        const entities: any[] = [];

        renderer.renderFrame(options, entities);

        expect(mockFrameRenderer.renderFrame).toHaveBeenCalledWith(options);
        expect(mockFrameRenderer.renderFrame).toHaveBeenCalledTimes(1);
    });

    it('should render an MD3 entity', () => {
        const mockGl = {} as WebGL2RenderingContext;
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
});
