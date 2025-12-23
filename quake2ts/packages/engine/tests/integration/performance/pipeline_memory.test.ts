
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BspSurfacePipeline } from '../../src/render/bspPipeline.js';
import { SkyboxPipeline } from '../../src/render/skybox.js';
import { Md2Pipeline } from '../../src/render/md2Pipeline.js';
import { Md3Pipeline } from '../../src/render/md3Pipeline.js';
import { SpriteRenderer } from '../../src/render/sprite.js';
import { CollisionVisRenderer } from '../../src/render/collisionVis.js';
import { DebugRenderer } from '../../src/render/debug.js';
import { ParticleRenderer, ParticleSystem } from '../../src/render/particleSystem.js';
import { RandomGenerator } from '@quake2ts/shared';

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
    createTexture: vi.fn(() => ({})),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    bindTexture: vi.fn(),
    activeTexture: vi.fn(),
    drawArrays: vi.fn(),
    drawElements: vi.fn(),
    depthMask: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),
    blendFuncSeparate: vi.fn(),
    uniformMatrix4fv: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform3fv: vi.fn(),
    uniform4fv: vi.fn(),
    uniform4f: vi.fn(),
    deleteProgram: vi.fn(),
    deleteQuery: vi.fn(),
    LINEAR: 9729,
    CLAMP_TO_EDGE: 33071,
    TEXTURE0: 33984,
    STATIC_DRAW: 35044,
    DYNAMIC_DRAW: 35048,
    STREAM_DRAW: 35040,
    FLOAT: 5126,
    TRIANGLES: 4,
    LINES: 1,
    UNSIGNED_SHORT: 5123,
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
} as unknown as WebGL2RenderingContext;

describe('Render Pipeline Memory Tracking', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('BspSurfacePipeline should have valid shaderSize', () => {
        const pipeline = new BspSurfacePipeline(gl);
        expect(pipeline.shaderSize).toBeGreaterThan(0);
        expect(Number.isNaN(pipeline.shaderSize)).toBe(false);
    });

    it('SkyboxPipeline should have valid shaderSize', () => {
        const pipeline = new SkyboxPipeline(gl);
        expect(pipeline.shaderSize).toBeGreaterThan(0);
        expect(Number.isNaN(pipeline.shaderSize)).toBe(false);
    });

    it('Md2Pipeline should have valid shaderSize', () => {
        const pipeline = new Md2Pipeline(gl);
        expect(pipeline.shaderSize).toBeGreaterThan(0);
        expect(Number.isNaN(pipeline.shaderSize)).toBe(false);
    });

    it('Md3Pipeline should have valid shaderSize', () => {
        const pipeline = new Md3Pipeline(gl);
        expect(pipeline.shaderSize).toBeGreaterThan(0);
        expect(Number.isNaN(pipeline.shaderSize)).toBe(false);
    });

    it('SpriteRenderer should have valid shaderSize', () => {
        const renderer = new SpriteRenderer(gl);
        expect(renderer.shaderSize).toBeGreaterThan(0);
        expect(Number.isNaN(renderer.shaderSize)).toBe(false);
    });

    it('CollisionVisRenderer should have valid shaderSize', () => {
        const renderer = new CollisionVisRenderer(gl);
        expect(renderer.shaderSize).toBeGreaterThan(0);
        expect(Number.isNaN(renderer.shaderSize)).toBe(false);
    });

    it('DebugRenderer should have valid shaderSize', () => {
        const renderer = new DebugRenderer(gl);
        expect(renderer.shaderSize).toBeGreaterThan(0);
        expect(Number.isNaN(renderer.shaderSize)).toBe(false);
    });

    it('ParticleRenderer should have valid shaderSize', () => {
        const rng = new RandomGenerator({ seed: 123 });
        const system = new ParticleSystem(100, rng);
        const renderer = new ParticleRenderer(gl, system);
        expect(renderer.shaderSize).toBeGreaterThan(0);
        expect(Number.isNaN(renderer.shaderSize)).toBe(false);
    });

    it('Should calculate total shaderBytes without NaN', () => {
        const bspPipeline = new BspSurfacePipeline(gl);
        const skyboxPipeline = new SkyboxPipeline(gl);
        const md2Pipeline = new Md2Pipeline(gl);
        const md3Pipeline = new Md3Pipeline(gl);
        const spriteRenderer = new SpriteRenderer(gl);
        const collisionVis = new CollisionVisRenderer(gl);
        const debugRenderer = new DebugRenderer(gl);
        const particleRng = new RandomGenerator({ seed: 123 });
        const particleSystem = new ParticleSystem(4096, particleRng);
        const particleRenderer = new ParticleRenderer(gl, particleSystem);

        const shaderBytes = bspPipeline.shaderSize +
                            skyboxPipeline.shaderSize +
                            md2Pipeline.shaderSize +
                            md3Pipeline.shaderSize +
                            spriteRenderer.shaderSize +
                            collisionVis.shaderSize +
                            debugRenderer.shaderSize +
                            particleRenderer.shaderSize;

        expect(shaderBytes).toBeGreaterThan(0);
        expect(Number.isNaN(shaderBytes)).toBe(false);
    });
});
