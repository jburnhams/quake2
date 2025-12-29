
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRenderer, Renderer } from '@quake2ts/engine';

// Mock WebGL2RenderingContext
const gl = {
    getExtension: vi.fn(),
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    deleteShader: vi.fn(),
    useProgram: vi.fn(),
    getUniformLocation: vi.fn(),
    getAttribLocation: vi.fn(),
    bindAttribLocation: vi.fn(),
    createVertexArray: vi.fn(() => ({})),
    bindVertexArray: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    drawElements: vi.fn(),
    drawArrays: vi.fn(),
    createFramebuffer: vi.fn(() => ({})),
    deleteFramebuffer: vi.fn(),
    createTexture: vi.fn(() => ({})),
    activeTexture: vi.fn(),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform3fv: vi.fn(),
    uniform4fv: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),
    blendFuncSeparate: vi.fn(),
    depthMask: vi.fn(),
    viewport: vi.fn(),
    clear: vi.fn(),
    canvas: { width: 800, height: 600 },
    LINEAR: 9729,
    CLAMP_TO_EDGE: 33071,
    TEXTURE0: 33984,
    STATIC_DRAW: 35044,
    FLOAT: 5126,
    TRIANGLES: 4,
    LINES: 1,
    UNSIGNED_SHORT: 5123,
} as unknown as WebGL2RenderingContext;

describe('Renderer Memory Tracking', () => {
    let renderer: Renderer;

    beforeEach(() => {
        vi.restoreAllMocks(); // Use restore instead of clear to reset mock implementations
        vi.clearAllMocks();
        // Since createRenderer is a factory that internally instantiates pipelines and profiler,
        // we test the public API.
        renderer = createRenderer(gl);
    });

    it('should track shader memory', () => {
        const memory = renderer.getMemoryUsage();
        // Check that shaderBytes is a valid number and greater than 0
        expect(Number.isFinite(memory.shadersBytes)).toBe(true);
        expect(memory.shadersBytes).toBeGreaterThan(0);
    });

    it('should track texture memory', async () => {
        // Mock createImageBitmap
        const mockBitmap = { width: 100, height: 100, close: vi.fn() } as unknown as ImageBitmap;
        global.createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

        const data = new ArrayBuffer(100);
        await renderer.registerPic('test.png', data);

        const memory = renderer.getMemoryUsage();
        // 100 * 100 * 4 bytes per pixel = 40000
        expect(memory.texturesBytes).toBe(40000);
    });

    it('should report total memory correctly', async () => {
        const mockBitmap = { width: 10, height: 10, close: vi.fn() } as unknown as ImageBitmap; // 400 bytes
        global.createImageBitmap = vi.fn().mockResolvedValue(mockBitmap);

        await renderer.registerPic('test2.png', new ArrayBuffer(10));

        const memory = renderer.getMemoryUsage();
        expect(memory.totalBytes).toBe(
            memory.texturesBytes + memory.geometryBytes + memory.shadersBytes
        );
        expect(memory.texturesBytes).toBe(400);
    });
});
