import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostProcessPipeline } from '../../../src/render/postprocessing/pipeline.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

describe('PostProcessPipeline', () => {
    let gl: WebGL2RenderingContext;

    beforeEach(() => {
        vi.clearAllMocks();
        gl = createMockWebGL2Context() as unknown as WebGL2RenderingContext;
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
