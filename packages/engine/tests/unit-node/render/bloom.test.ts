import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BloomPipeline } from '../../../src/render/bloom.js';
import { Texture2D } from '../../../src/render/resources.js';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

describe('BloomPipeline', () => {
    let gl: any;
    let pipeline: BloomPipeline;

    beforeEach(() => {
        gl = createMockWebGL2Context();

        // Mock specific WebGL functions needed by BloomPipeline
        gl.createVertexArray = vi.fn(() => ({}));
        gl.bindVertexArray = vi.fn();
        gl.createBuffer = vi.fn(() => ({}));
        gl.bindBuffer = vi.fn();
        gl.bufferData = vi.fn();
        gl.enableVertexAttribArray = vi.fn();
        gl.vertexAttribPointer = vi.fn();
        gl.deleteVertexArray = vi.fn();
        gl.uniform1i = vi.fn();
        gl.uniform1f = vi.fn();
        gl.uniform1fv = vi.fn();
        gl.drawArrays = vi.fn();
        gl.activeTexture = vi.fn();
        gl.bindTexture = vi.fn();
        gl.viewport = vi.fn();
        gl.clear = vi.fn();
        gl.enable = vi.fn();
        gl.disable = vi.fn();
        gl.blendFunc = vi.fn();
        gl.bindFramebuffer = vi.fn();

        // Mock uniform locations
        gl.uniformLocations.set('u_texture', {});
        gl.uniformLocations.set('u_threshold', {});
        gl.uniformLocations.set('u_horizontal', {});
        gl.uniformLocations.set('u_weight', {});
        gl.uniformLocations.set('u_intensity', {});

        pipeline = new BloomPipeline(gl as unknown as WebGL2RenderingContext);
    });

    it('initializes correctly', () => {
        expect(gl.createVertexArray).toHaveBeenCalled();
        expect(gl.createProgram).toHaveBeenCalledTimes(3); // Extract, Blur, Composite
    });

    it('resizes framebuffers and textures', () => {
        pipeline.resize(800, 600);

        // Width/Height are halved
        expect(gl.texImage2D).toHaveBeenCalledWith(
            gl.TEXTURE_2D, 0, gl.RGBA, 400, 300, 0, gl.RGBA, gl.UNSIGNED_BYTE, null
        );
    });

    it('renders bloom effect', () => {
        pipeline.resize(800, 600);
        const inputTexture = new Texture2D(gl as unknown as WebGL2RenderingContext);

        // Reset mocks to clear initialization calls
        vi.clearAllMocks();
        gl.uniformLocations.set('u_texture', {});

        pipeline.render(inputTexture, 0.8);

        // 1. Extract pass
        expect(gl.useProgram).toHaveBeenCalled(); // Should be called for extract
        expect(gl.drawArrays).toHaveBeenCalledWith(gl.TRIANGLE_STRIP, 0, 4);

        // 2. Blur pass (4 iterations)
        // We expect drawArrays to be called 4 more times for blur + 1 for extract + 1 for composite = 6 times
        expect(gl.drawArrays).toHaveBeenCalledTimes(1 + 4 + 1);

        // Check ping-pong behavior
        // horizontal uniform should toggle
        expect(gl.uniform1i).toHaveBeenCalledWith(expect.anything(), 1); // horizontal true
        expect(gl.uniform1i).toHaveBeenCalledWith(expect.anything(), 0); // horizontal false

        // 3. Composite pass
        expect(gl.blendFunc).toHaveBeenCalledWith(gl.ONE, gl.ONE);
        expect(gl.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.8); // intensity
    });

    it('disposes resources', () => {
        pipeline.dispose();
        expect(gl.deleteProgram).toHaveBeenCalledTimes(3);
        expect(gl.deleteVertexArray).toHaveBeenCalled();
    });
});
