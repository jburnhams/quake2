
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRenderer, Renderer } from '../../src/render/renderer.js';
import { InstanceData } from '../../src/render/instancing.js';
import { Md2Model } from '../../src/assets/md2.js';
import { Md3Model } from '../../src/assets/md3.js';

// Mock shared
vi.mock('@quake2ts/shared', async () => {
    return {
        ...await vi.importActual('@quake2ts/shared'),
        fromRotationTranslationScale: vi.fn(),
        Vec3: {},
        Mat4: {}
    };
});

describe('Renderer Instancing API', () => {
  let renderer: Renderer;
  let mockGl: Partial<WebGL2RenderingContext>;

  beforeEach(() => {
    mockGl = {
      canvas: { width: 800, height: 600 } as HTMLCanvasElement,
      getExtension: vi.fn().mockReturnValue(null),
      createProgram: vi.fn(),
      createShader: vi.fn(),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn().mockReturnValue(true),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn().mockReturnValue(true),
      useProgram: vi.fn(),
      createBuffer: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      createVertexArray: vi.fn(),
      bindVertexArray: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      getUniformLocation: vi.fn(),
      uniform1i: vi.fn(),
      uniform1f: vi.fn(),
      uniform3f: vi.fn(),
      uniform3fv: vi.fn(),
      uniform4fv: vi.fn(),
      uniformMatrix4fv: vi.fn(),
      activeTexture: vi.fn(),
      createTexture: vi.fn(),
      bindTexture: vi.fn(),
      texImage2D: vi.fn(),
      texParameteri: vi.fn(),
      pixelStorei: vi.fn(),
      viewport: vi.fn(),
      clear: vi.fn(),
      clearColor: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      depthFunc: vi.fn(),
      blendFunc: vi.fn(),
      drawElements: vi.fn(),
      deleteBuffer: vi.fn(),
      deleteVertexArray: vi.fn(),
      deleteProgram: vi.fn(),
      deleteShader: vi.fn(),
      deleteTexture: vi.fn(),
      bindAttribLocation: vi.fn(),
      createFramebuffer: vi.fn(),
      bindFramebuffer: vi.fn(),
      framebufferTexture2D: vi.fn(),
      deleteFramebuffer: vi.fn(),
      checkFramebufferStatus: vi.fn().mockReturnValue(36053), // gl.FRAMEBUFFER_COMPLETE
    };

    // Mock shader creation
    (mockGl.createShader as any).mockReturnValue({});
    (mockGl.createProgram as any).mockReturnValue({});
    (mockGl.createVertexArray as any).mockReturnValue({});
    (mockGl.createBuffer as any).mockReturnValue({});
    (mockGl.createTexture as any).mockReturnValue({});
    (mockGl.createFramebuffer as any).mockReturnValue({});

    renderer = createRenderer(mockGl as WebGL2RenderingContext);
  });

  it('should expose renderInstanced method', () => {
    expect(renderer.renderInstanced).toBeDefined();
    expect(typeof renderer.renderInstanced).toBe('function');
  });

  it('should accept MD2 model and instances', () => {
    const mockModel = {
       header: { skinWidth: 64, skinHeight: 64 },
       frames: [],
       glCommands: [],
       triangles: [],
       texCoords: []
    } as unknown as Md2Model;

    const instances: InstanceData[] = [
        {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
        }
    ];

    // No expectation of console.warn as implementation is now functional (queued)
    renderer.renderInstanced(mockModel, instances);
  });

  it('should accept MD3 model and instances', () => {
    const mockMd3Model = {
      header: {},
      surfaces: [],
      frames: [],
      tags: [],
    } as unknown as Md3Model;

    const instances: InstanceData[] = [
      {
        position: { x: 10, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      }
    ];

    // Should not throw and verify type detection internally if we could inspect state
    // For now just verify no crash
    renderer.renderInstanced(mockMd3Model, instances);
  });
});
