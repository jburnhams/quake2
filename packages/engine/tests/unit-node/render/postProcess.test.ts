import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostProcessPipeline } from '../../../src/render/postprocessing/pipeline.js';

// Mock WebGL2RenderingContext
const gl = {
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    getAttribLocation: vi.fn(() => 0),
    bindAttribLocation: vi.fn(),
    createVertexArray: vi.fn(() => ({})),
    bindVertexArray: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    activeTexture: vi.fn(),
    bindTexture: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    drawArrays: vi.fn(),
    deleteProgram: vi.fn(),
    deleteShader: vi.fn(),
    deleteVertexArray: vi.fn(),
    deleteBuffer: vi.fn(),
    TRIANGLES: 0x0004,
    TRIANGLE_STRIP: 0x0005,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88E4,
    FLOAT: 0x1406,
    TEXTURE0: 0x84C0,
    TEXTURE_2D: 0x0DE1,
} as unknown as WebGL2RenderingContext;

describe('PostProcessPipeline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize correctly', () => {
        const pipeline = new PostProcessPipeline(gl);
        expect(gl.createProgram).toHaveBeenCalled();
        expect(gl.createVertexArray).toHaveBeenCalled();
        expect(gl.createBuffer).toHaveBeenCalled();
    });

    it('should render with correct GL calls', () => {
        const pipeline = new PostProcessPipeline(gl);
        const texture = {} as WebGLTexture;
        const time = 123.45;
        const strength = 0.5;

        pipeline.render(texture, time, strength);

        expect(gl.useProgram).toHaveBeenCalled();
        expect(gl.activeTexture).toHaveBeenCalledWith(gl.TEXTURE0);
        expect(gl.bindTexture).toHaveBeenCalledWith(gl.TEXTURE_2D, texture);
        expect(gl.uniform1f).toHaveBeenCalledTimes(2); // time and strength
        expect(gl.bindVertexArray).toHaveBeenCalled();
        expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLE_STRIP, 0, 4);
    });

    it('should dispose resources', () => {
        const pipeline = new PostProcessPipeline(gl);
        pipeline.dispose();
        expect(gl.deleteVertexArray).toHaveBeenCalled();
    });
});
