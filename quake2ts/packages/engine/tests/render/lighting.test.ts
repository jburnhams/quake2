import { createRenderer } from '../../src/render/renderer.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebugMode } from '../../src/render/debugMode.js';

describe('Renderer Lighting Control', () => {
    let mockGl: WebGL2RenderingContext;
    let renderer: ReturnType<typeof createRenderer>;

    beforeEach(() => {
        // Mock WebGL context
        mockGl = {
            createProgram: vi.fn(() => ({})), // Return object for program
            createShader: vi.fn(() => ({})), // Return object for shader
            shaderSource: vi.fn(),
            compileShader: vi.fn(),
            attachShader: vi.fn(),
            linkProgram: vi.fn(),
            deleteShader: vi.fn(),
            deleteProgram: vi.fn(),
            getProgramParameter: vi.fn(() => true),
            getShaderParameter: vi.fn(() => true),
            useProgram: vi.fn(),
            getUniformLocation: vi.fn((_, name) => name), // Return name as location for verification
            getAttribLocation: vi.fn(),
            bindAttribLocation: vi.fn(),
            uniform1f: vi.fn(),
            uniform1i: vi.fn(),
            uniform3fv: vi.fn(),
            uniform4fv: vi.fn(),
            uniformMatrix4fv: vi.fn(),
            activeTexture: vi.fn(),
            bindTexture: vi.fn(),
            createTexture: vi.fn(() => ({})), // Return object
            deleteTexture: vi.fn(),
            texImage2D: vi.fn(),
            texParameteri: vi.fn(),
            generateMipmap: vi.fn(),
            createVertexArray: vi.fn(() => ({})), // Return object
            deleteVertexArray: vi.fn(),
            bindVertexArray: vi.fn(),
            createBuffer: vi.fn(() => ({})), // Return object
            bindBuffer: vi.fn(),
            deleteBuffer: vi.fn(),
            bufferData: vi.fn(),
            enableVertexAttribArray: vi.fn(),
            vertexAttribPointer: vi.fn(),
            drawElements: vi.fn(),
            getExtension: vi.fn(),
            createFramebuffer: vi.fn(() => ({})),
            deleteFramebuffer: vi.fn(),
            canvas: { width: 800, height: 600 },
            VERTEX_SHADER: 35633, // Valid GL constants needed
            FRAGMENT_SHADER: 35632,
            COMPILE_STATUS: 35713,
            LINK_STATUS: 35714,
            STATIC_DRAW: 35044,
            TEXTURE_2D: 3553,
            TEXTURE_CUBE_MAP: 34067,
            TEXTURE0: 33984
        } as unknown as WebGL2RenderingContext;

        renderer = createRenderer(mockGl);
    });

    it('should set brightness', () => {
        expect(() => renderer.setBrightness(1.5)).not.toThrow();
    });

    it('should clamp brightness values', () => {
        // Brightness is clamped 0.0 - 2.0
        renderer.setBrightness(-0.5);
        renderer.setBrightness(2.5);
    });

    it('should set gamma', () => {
         expect(() => renderer.setGamma(2.2)).not.toThrow();
    });

    it('should set fullbright', () => {
         expect(() => renderer.setFullbright(true)).not.toThrow();
    });

    it('should set ambient', () => {
         expect(() => renderer.setAmbient(0.5)).not.toThrow();
    });

    it('should set light style overrides', () => {
         expect(() => renderer.setLightStyle(0, "m")).not.toThrow();
         expect(() => renderer.setLightStyle(1, null)).not.toThrow(); // Clear
    });
});
