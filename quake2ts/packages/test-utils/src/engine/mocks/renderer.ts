import { vi } from 'vitest';
import {
  Renderer,
  FrameRenderer,
  BspSurfacePipeline,
  Md2Pipeline,
  Md3Pipeline,
  SpriteRenderer,
  SkyboxPipeline,
  RenderableEntity,
  FrameRenderOptions,
  RenderOptions,
  FrameRenderStats,
  SurfaceRenderState,
  Md2MeshBuffers,
  Md3SurfaceMesh,
  Md3SurfaceMaterial,
  SkyboxBindOptions,
  BspSurfaceBindOptions,
  Md2BindOptions,
  RenderModeConfig,
  Texture2D,
  IndexBuffer
} from '@quake2ts/engine';
import { createMockWebGL2Context } from './webgl.js';

export function createMockRenderer(overrides?: Partial<Renderer>): Renderer {
  return {
    width: 800,
    height: 600,
    collisionVis: {
      render: vi.fn(),
      clear: vi.fn(),
      shaderSize: 0,
      dispose: vi.fn(),
    } as any,
    debug: {
      render: vi.fn(),
      clear: vi.fn(),
      drawLine: vi.fn(),
      drawBoundingBox: vi.fn(),
      drawAxes: vi.fn(),
      getLabels: vi.fn().mockReturnValue([]),
      shaderSize: 0,
      dispose: vi.fn(),
    } as any,
    particleSystem: {
        update: vi.fn(),
        emit: vi.fn(),
        clear: vi.fn(),
        count: 0
    } as any,
    getPerformanceReport: vi.fn().mockReturnValue({}),
    getMemoryUsage: vi.fn().mockReturnValue({}),
    renderFrame: vi.fn(),
    registerPic: vi.fn().mockResolvedValue({} as any),
    registerTexture: vi.fn().mockReturnValue({} as any),
    getTexture: vi.fn().mockReturnValue(undefined),
    getTextures: vi.fn().mockReturnValue(new Map()),
    begin2D: vi.fn(),
    end2D: vi.fn(),
    drawPic: vi.fn(),
    drawString: vi.fn(),
    drawCenterString: vi.fn(),
    drawfillRect: vi.fn(),
    setEntityHighlight: vi.fn(),
    clearEntityHighlight: vi.fn(),
    highlightSurface: vi.fn(),
    removeSurfaceHighlight: vi.fn(),
    setDebugMode: vi.fn(),
    setBrightness: vi.fn(),
    setGamma: vi.fn(),
    setFullbright: vi.fn(),
    setAmbient: vi.fn(),
    setLightStyle: vi.fn(),
    setUnderwaterWarp: vi.fn(),
    setBloom: vi.fn(),
    setBloomIntensity: vi.fn(),
    setLodBias: vi.fn(),
    setAreaPortalState: vi.fn(),
    renderInstanced: vi.fn(),
    uploadBspGeometry: vi.fn().mockReturnValue({ surfaces: [], lightmaps: [] }),
    dispose: vi.fn(),
    ...overrides,
  };
}

export function createMockFrameRenderer(overrides?: Partial<FrameRenderer>): FrameRenderer {
  return {
    renderFrame: vi.fn().mockReturnValue({
      batches: 0,
      facesDrawn: 0,
      drawCalls: 0,
      skyDrawn: false,
      viewModelDrawn: false,
      fps: 60,
      vertexCount: 0,
    } as FrameRenderStats),
    ...overrides,
  };
}

export function createMockBspPipeline(overrides?: Partial<BspSurfacePipeline>): BspSurfacePipeline {
  const gl = createMockWebGL2Context();
  return {
    gl,
    program: {
        use: vi.fn(),
        dispose: vi.fn(),
        sourceSize: 0,
        getUniformLocation: vi.fn().mockReturnValue(null),
    } as any,
    shaderSize: 0,
    bind: vi.fn().mockReturnValue({} as SurfaceRenderState),
    draw: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as unknown as BspSurfacePipeline;
}

export function createMockMd2Pipeline(overrides?: Partial<Md2Pipeline>): Md2Pipeline {
  const gl = createMockWebGL2Context();
  return {
    gl,
    program: {
        use: vi.fn(),
        dispose: vi.fn(),
        sourceSize: 0,
        getUniformLocation: vi.fn().mockReturnValue(null),
    } as any,
    shaderSize: 0,
    bind: vi.fn(),
    draw: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as unknown as Md2Pipeline;
}

export function createMockMd3Pipeline(overrides?: Partial<Md3Pipeline>): Md3Pipeline {
  const gl = createMockWebGL2Context();
  return {
    gl,
    program: {
        use: vi.fn(),
        dispose: vi.fn(),
        sourceSize: 0,
        getUniformLocation: vi.fn().mockReturnValue(null),
    } as any,
    shaderSize: 0,
    bind: vi.fn(),
    drawSurface: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as unknown as Md3Pipeline;
}

export function createMockSpritePipeline(overrides?: Partial<SpriteRenderer>): SpriteRenderer {
  const gl = createMockWebGL2Context();
  return {
    gl,
    program: {
        use: vi.fn(),
        dispose: vi.fn(),
        sourceSize: 0,
        getUniformLocation: vi.fn().mockReturnValue(null),
    } as any,
    shaderSize: 0,
    vao: {
        bind: vi.fn(),
        dispose: vi.fn(),
        configureAttributes: vi.fn()
    } as any,
    vbo: {
        bind: vi.fn(),
        dispose: vi.fn(),
        upload: vi.fn()
    } as any,
    whiteTexture: {
        bind: vi.fn(),
        upload: vi.fn()
    } as unknown as Texture2D,
    begin: vi.fn(),
    draw: vi.fn(),
    drawRect: vi.fn(),
    ...overrides,
  } as unknown as SpriteRenderer;
}

export function createMockSkyboxPipeline(overrides?: Partial<SkyboxPipeline>): SkyboxPipeline {
  const gl = createMockWebGL2Context();
  return {
    gl,
    program: {
        use: vi.fn(),
        dispose: vi.fn(),
        sourceSize: 0,
        getUniformLocation: vi.fn().mockReturnValue(null),
    } as any,
    vao: {
        bind: vi.fn(),
        dispose: vi.fn(),
        configureAttributes: vi.fn()
    } as any,
    vbo: {
        bind: vi.fn(),
        dispose: vi.fn(),
        upload: vi.fn()
    } as any,
    cubemap: {
        bind: vi.fn(),
        dispose: vi.fn(),
        setParameters: vi.fn(),
        upload: vi.fn()
    } as any,
    shaderSize: 0,
    bind: vi.fn(),
    draw: vi.fn(),
    dispose: vi.fn(),
    ...overrides,
  } as unknown as SkyboxPipeline;
}
