import { FrameRenderer, FrameRenderOptions, FrameRenderStats } from './frame.js';
import { SpriteRenderer } from './pipelines/sprite.js';
import { SkyboxPipeline } from './pipelines/skybox.js';
import { createWebGPUContext, WebGPUContextOptions, WebGPUContextState } from './context.js';
import { Camera } from '../camera.js';
import { IRenderer, Pic } from '../interface.js';
import { Texture2D } from './resources.js';
import { PreparedTexture } from '../../assets/texture.js';
import { RenderableEntity } from '../scene.js';
import { CollisionVisRenderer } from '../collisionVis.js';
import { DebugRenderer } from '../debug.js';
import { ParticleSystem } from '../particleSystem.js';
import { MemoryUsage } from '../types.js';
import { RenderOptions } from '../options.js';
import { DebugMode } from '../debugMode.js';
import { Md2Model } from '../../assets/md2.js';
import { Md3Model } from '../../assets/md3.js';
import { InstanceData } from '../instancing.js';
import { RenderStatistics } from '../gpuProfiler.js';
import { parseColorString } from '../colors.js';

// WebGPU-specific renderer interface
export interface WebGPURenderer extends IRenderer {
  readonly type: 'webgpu';
  readonly device: GPUDevice;

  // Pipeline access (for testing/debug)
  readonly pipelines: {
    readonly sprite: SpriteRenderer;
    readonly skybox: SkyboxPipeline;
  };
}

export class WebGPURendererImpl implements WebGPURenderer {
  readonly type = 'webgpu';

  // Texture cache for registered pics
  private picCache = new Map<string, Pic>();
  private whiteTexture: Texture2D;
  private font: Pic | null = null;

  // 2D rendering state
  private is2DActive = false;

  // Stub implementations for required properties
  // TODO: Implement proper collision visualization, debug rendering, and particle system
  readonly collisionVis: CollisionVisRenderer;
  readonly debug: DebugRenderer;
  readonly particleSystem: ParticleSystem;

  constructor(
    private context: WebGPUContextState,
    private frameRenderer: FrameRenderer,
    public readonly pipelines: {
        sprite: SpriteRenderer;
        skybox: SkyboxPipeline;
    }
  ) {
    // Create 1x1 white texture for solid color rendering
    // Ref: WebGL renderer sprite.ts:68-69
    this.whiteTexture = new Texture2D(context.device, {
      width: 1,
      height: 1,
      format: context.format,
      label: 'white-texture'
    });
    this.whiteTexture.upload(new Uint8Array([255, 255, 255, 255]));

    // Create stub instances (TODO: implement properly in later sections)
    this.collisionVis = null as any;
    this.debug = null as any;
    this.particleSystem = null as any;
  }

  get device(): GPUDevice {
    return this.context.device;
  }

  get width(): number {
    return this.context.width;
  }

  get height(): number {
    return this.context.height;
  }

  // =========================================================================
  // Frame Rendering
  // =========================================================================

  renderFrame(
    options: FrameRenderOptions,
    entities: readonly RenderableEntity[] = [],
    renderOptions?: RenderOptions
  ): void {
    // TODO: Process entities and pass to frame renderer
    // For now, just render the frame without entities
    // Note: WebGL renderer doesn't return anything, but we could return stats for debugging
    this.frameRenderer.renderFrame(options);
  }

  // =========================================================================
  // Texture Management
  // Ref: WebGL renderer.ts:725-761
  // =========================================================================

  async registerPic(name: string, data: ArrayBuffer): Promise<Pic> {
    // Check cache first
    if (this.picCache.has(name)) {
      return this.picCache.get(name)!;
    }

    // For now, assume data is raw RGBA8 format
    // TODO: Add proper image decoding (PNG, TGA, etc.)
    // This is a simplified implementation
    const texture = new Texture2D(this.device, {
      width: 256, // TODO: Extract actual dimensions from image data
      height: 256,
      format: this.context.format,
      label: `pic-${name}`
    });

    texture.upload(data);
    this.picCache.set(name, texture);
    return texture;
  }

  registerTexture(name: string, texture: PreparedTexture): Pic {
    // Check cache first
    if (this.picCache.has(name)) {
      return this.picCache.get(name)!;
    }

    // Create WebGPU texture from PreparedTexture
    const gpuTexture = new Texture2D(this.device, {
      width: texture.width,
      height: texture.height,
      format: this.context.format,
      mipLevelCount: texture.levels.length,
      label: `texture-${name}`
    });

    // Upload all mip levels
    // Ref: PreparedTexture structure from assets/texture.ts:13-18
    for (const mipLevel of texture.levels) {
      gpuTexture.upload(mipLevel.rgba as BufferSource, {
        width: mipLevel.width,
        height: mipLevel.height,
        mipLevel: mipLevel.level
      });
    }

    this.picCache.set(name, gpuTexture);
    return gpuTexture;
  }

  // =========================================================================
  // 2D Drawing API
  // Ref: WebGL renderer.ts:763-830
  // =========================================================================

  begin2D(): void {
    // Begin 2D rendering pass through frame renderer
    // Ref: WebGL renderer.ts:763-773
    this.frameRenderer.begin2DPass();
    this.is2DActive = true;
  }

  end2D(): void {
    // End 2D rendering session
    // Ref: WebGL renderer.ts:775-779
    this.frameRenderer.end2DPass();
    this.is2DActive = false;
  }

  drawPic(
    x: number,
    y: number,
    pic: Pic,
    color: [number, number, number, number] = [1, 1, 1, 1]
  ): void {
    if (!this.is2DActive) {
      throw new Error('drawPic called outside begin2D/end2D');
    }

    // Use sprite renderer to draw textured quad
    // Ref: WebGL renderer.ts:781-784
    this.pipelines.sprite.drawTexturedQuad(
      x, y,
      pic.width, pic.height,
      pic as Texture2D,
      0, 0, 1, 1, // Full texture UVs
      color
    );
  }

  drawfillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: [number, number, number, number]
  ): void {
    if (!this.is2DActive) {
      throw new Error('drawfillRect called outside begin2D/end2D');
    }

    // Use sprite renderer with solid color
    // Ref: WebGL renderer.ts:827-829
    this.pipelines.sprite.drawSolidRect(x, y, width, height, color);
  }

  drawString(
    x: number,
    y: number,
    text: string,
    color: [number, number, number, number] = [1, 1, 1, 1]
  ): void {
    if (!this.is2DActive) {
      throw new Error('drawString called outside begin2D/end2D');
    }

    if (!this.font) {
      // Font not loaded yet - skip drawing
      return;
    }

    // Parse color codes and render text
    // Ref: WebGL renderer.ts:805-818
    const segments = parseColorString(text);
    let currentX = x;
    const charWidth = 8;
    const charHeight = 8;

    for (const segment of segments) {
      const segmentColor = segment.color || color;
      for (const char of segment.text) {
        const code = char.charCodeAt(0);
        const col = code % 16;
        const row = Math.floor(code / 16);
        const u0 = col / 16;
        const v0 = row / 16;
        const u1 = (col + 1) / 16;
        const v1 = (row + 1) / 16;

        this.pipelines.sprite.drawTexturedQuad(
          currentX, y,
          charWidth, charHeight,
          this.font as Texture2D,
          u0, v0, u1, v1,
          segmentColor
        );
        currentX += charWidth;
      }
    }
  }

  drawCenterString(y: number, text: string): void {
    if (!this.is2DActive) {
      throw new Error('drawCenterString called outside begin2D/end2D');
    }

    // Calculate centered X position
    // Ref: WebGL renderer.ts:820-825
    const stripped = text.replace(/\^[0-9]/g, '');
    const charWidth = 8;
    const width = stripped.length * charWidth;
    const x = (this.width - width) / 2;
    this.drawString(x, y, text);
  }

  // =========================================================================
  // Entity Highlighting (Stubs)
  // TODO: Implement in later sections
  // =========================================================================

  setEntityHighlight(entityId: number, color: [number, number, number, number]): void {
    // TODO: Implement entity highlighting
  }

  clearEntityHighlight(entityId: number): void {
    // TODO: Implement entity highlight clearing
  }

  highlightSurface(faceIndex: number, color: [number, number, number, number]): void {
    // TODO: Implement surface highlighting
  }

  removeSurfaceHighlight(faceIndex: number): void {
    // TODO: Implement surface highlight removal
  }

  // =========================================================================
  // Render Settings (Stubs)
  // TODO: Implement in later sections
  // =========================================================================

  setDebugMode(mode: DebugMode): void {
    // TODO: Implement debug mode
  }

  setBrightness(value: number): void {
    // TODO: Implement brightness
  }

  setGamma(value: number): void {
    // TODO: Implement gamma
  }

  setFullbright(enabled: boolean): void {
    // TODO: Implement fullbright
  }

  setAmbient(value: number): void {
    // TODO: Implement ambient lighting
  }

  setLightStyle(index: number, pattern: string | null): void {
    // TODO: Implement light styles
  }

  setUnderwaterWarp(enabled: boolean): void {
    // TODO: Implement underwater warp
  }

  setBloom(enabled: boolean): void {
    // TODO: Implement bloom
  }

  setBloomIntensity(value: number): void {
    // TODO: Implement bloom intensity
  }

  setLodBias(bias: number): void {
    // TODO: Implement LOD bias
  }

  // =========================================================================
  // Instanced Rendering (Stub)
  // TODO: Implement in later sections
  // =========================================================================

  renderInstanced(model: Md2Model | Md3Model, instances: InstanceData[]): void {
    // TODO: Implement instanced rendering
  }

  // =========================================================================
  // Performance and Memory
  // =========================================================================

  getPerformanceReport(): RenderStatistics {
    // TODO: Implement GPU profiling
    // Ref: gpuProfiler.ts:8-26
    return {
      frameTimeMs: 0,
      gpuTimeMs: 0,
      cpuFrameTimeMs: 0,
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      textureBinds: 0,
      shaderSwitches: 0,
      visibleSurfaces: 0,
      culledSurfaces: 0,
      visibleEntities: 0,
      culledEntities: 0,
      memoryUsageMB: {
        textures: 0,
        geometry: 0,
        total: 0
      }
    };
  }

  getMemoryUsage(): MemoryUsage {
    // TODO: Implement memory tracking
    // Ref: types.ts:27-32
    return {
      texturesBytes: 0,
      geometryBytes: 0,
      shadersBytes: 0,
      buffersBytes: 0,
      totalBytes: 0
    };
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  resize(width: number, height: number): void {
    if (this.context.context && !this.context.isHeadless) {
        // In browser, canvas resize usually handled externally, but we might need to update swap chain config
        this.context.width = width;
        this.context.height = height;
    } else {
        // Headless
        this.context.width = width;
        this.context.height = height;
    }
  }

  dispose(): void {
    // Destroy pipelines
    this.pipelines.sprite.destroy();
    this.pipelines.skybox.destroy();

    // Destroy cached textures
    for (const texture of this.picCache.values()) {
      (texture as Texture2D).destroy();
    }
    this.picCache.clear();

    // Destroy white texture
    this.whiteTexture.destroy();

    // Destroy device resources if needed (most auto-destroyed with device)
    this.context.device.destroy();
  }

  destroy(): void {
    this.dispose();
  }
}

export async function createWebGPURenderer(
  canvas?: HTMLCanvasElement,
  options?: WebGPUContextOptions
): Promise<WebGPURenderer> {
  const context = await createWebGPUContext(canvas, options);

  // Initialize Pipelines
  const spriteRenderer = new SpriteRenderer(context.device, context.format);
  const skyboxPipeline = new SkyboxPipeline(context.device, context.format);

  // Registry of pipelines
  const pipelines = {
    sprite: spriteRenderer,
    skybox: skyboxPipeline
  };

  // Create Frame Renderer
  // Note: We need to pass the context state which includes width/height
  if (canvas) {
      context.width = canvas.width;
      context.height = canvas.height;
  } else {
      context.width = 800; // Default headless size
      context.height = 600;
  }

  const frameRenderer = new FrameRenderer(context, pipelines);

  return new WebGPURendererImpl(context, frameRenderer, pipelines);
}
