import { FrameRenderer, FrameRenderOptions as WebGPUFrameRenderOptions, FrameRenderStats, type WebGPUWorldSurface, type WorldRenderState as WebGPUWorldRenderState } from './frame.js';
import { SpriteRenderer } from './pipelines/sprite.js';
import { SkyboxPipeline } from './pipelines/skybox.js';
import { BspSurfacePipeline } from './pipelines/bspPipeline.js';
import { Md2Pipeline } from './pipelines/md2Pipeline.js';
import { PostProcessPipeline } from './pipelines/postProcess.js';
import { ParticleRenderer } from './pipelines/particleSystem.js';
import { RandomGenerator } from '@quake2ts/shared';
import { createWebGPUContext, WebGPUContextOptions, WebGPUContextState } from './context.js';
import { Camera } from '../camera.js';
import { IWebGPURenderer, Pic, WebGPUCapabilities, ComputePipeline } from '../interface.js';
import { Texture2D, VertexBuffer, IndexBuffer, setResourceTracker } from './resources.js';
import { PreparedTexture } from '../../assets/texture.js';
import { RenderableEntity } from '../scene.js';
import { CollisionVisRenderer } from '../collisionVis.js';
import { WebGPUDebugRenderer } from './debugRenderer.js';
import { ParticleSystem } from '../particleSystem.js';
import { MemoryUsage } from '../types.js';
import { RenderOptions } from '../options.js';
import { DebugMode } from '../debugMode.js';
import { Md2Model } from '../../assets/md2.js';
import { Md3Model } from '../../assets/md3.js';
import { InstanceData } from '../instancing.js';
import { RenderStatistics } from '../gpuProfiler.js';
import { parseColorString } from '../colors.js';
import { BspSurfaceGeometry } from '../bsp.js';
import { cullLights } from '../lightCulling.js';
import { extractFrustumPlanes } from '../culling.js';
import { FrameRenderOptions, WorldRenderState } from '../frame.js'; // Shared interface
import type { PreparedWorld } from '../prepareWorld.js';
import type { PreparedModels } from '../prepareModels.js';
import { WebGPUProfiler, ProfilingResourceTracker } from './profiling.js';

// WebGPU-specific renderer interface
export interface WebGPURenderer extends IWebGPURenderer {
  // Pipeline access (for testing/debug)
  readonly pipelines: {
    readonly sprite: SpriteRenderer;
    readonly skybox: SkyboxPipeline;
    readonly bsp: BspSurfacePipeline;
    readonly md2: Md2Pipeline;
    readonly postProcess: PostProcessPipeline;
    // TODO: Add md3: Md3PipelineGPU
    // TODO: Add particles: ParticleRenderer
  };

  // Helper methods to upload geometry
  uploadBspGeometry(surfaces: readonly BspSurfaceGeometry[]): void;

  /** Uploads a prepared world (prepareWorld) and returns the state renderFrame draws. */
  uploadWorld(world: PreparedWorld): WorldRenderState;
  uploadModels(world: WorldRenderState, models: PreparedModels): void;
}

export class WebGPURendererImpl implements WebGPURenderer {
  readonly type = 'webgpu';

  // Texture cache for registered pics
  private picCache = new Map<string, Pic>();
  private whiteTexture: Texture2D;
  private font: Pic | null = null;

  // 2D rendering state
  private is2DActive = false;

  // Render state
  private renderState = {
    brightness: 1.0,
    gamma: 1.0,
    fullbright: false,
    ambient: 0.0,
    underwaterWarp: false,
    bloom: false,
    bloomIntensity: 0.5,
    lodBias: 1.0,
    debugMode: DebugMode.None,
  };

  private lightStyleOverrides = new Map<number, string>();
  private highlightedEntities = new Map<number, [number, number, number, number]>();
  private highlightedSurfaces = new Map<number, [number, number, number, number]>();

  // Performance profiler
  private profiler: WebGPUProfiler;

  // Stub implementations for required properties
  readonly collisionVis: CollisionVisRenderer;
  readonly debug: WebGPUDebugRenderer;
  readonly particleSystem: ParticleSystem;

  constructor(
    private context: WebGPUContextState,
    private frameRenderer: FrameRenderer,
    public readonly pipelines: {
        sprite: SpriteRenderer;
        skybox: SkyboxPipeline;
        bsp: BspSurfacePipeline;
        md2: Md2Pipeline;
        postProcess: PostProcessPipeline;
        particles: ParticleRenderer;
    },
    debugRenderer: WebGPUDebugRenderer,
    profiler?: WebGPUProfiler
  ) {
    // Initialize profiler
    this.profiler = profiler || new WebGPUProfiler(context.device);
    // Create 1x1 white texture for solid color rendering
    this.whiteTexture = new Texture2D(context.device, {
      width: 1,
      height: 1,
      format: context.format,
      label: 'white-texture'
    });
    this.whiteTexture.upload(new Uint8Array([255, 255, 255, 255]));

    // Initialize debug renderer
    this.debug = debugRenderer;

    // Create stub instances for other properties
    this.collisionVis = null as any;
    // The same pool size and seeding as the WebGL renderer's; effects spawn into it.
    this.particleSystem = new ParticleSystem(4096, new RandomGenerator({ seed: Date.now() }));
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
    options: FrameRenderOptions, // From shared interface
    entities: readonly RenderableEntity[] = [],
    renderOptions?: RenderOptions
  ): FrameRenderStats {

    // Cast options to WebGPU options (runtime objects are compatible enough for this usage,
    // mainly mismatch on Texture2D class type which we ignore by casting)
    const localOptions = options as unknown as WebGPUFrameRenderOptions;

    // Perform Light Culling
    let culledLights = localOptions.dlights;
    if (localOptions.dlights && localOptions.dlights.length > 0) {
        const viewProjection = new Float32Array(localOptions.camera.viewProjectionMatrix);
        const frustumPlanes = extractFrustumPlanes(viewProjection);
        const cameraPos = { x: localOptions.camera.position[0], y: localOptions.camera.position[1], z: localOptions.camera.position[2] };

        culledLights = cullLights(
            localOptions.dlights,
            frustumPlanes,
            cameraPos,
            32 // Max lights
        );
    }

    const particles = localOptions.particles ?? this.particleSystem;
    if (localOptions.deltaTime) {
        particles.update(localOptions.deltaTime);
    }

    // Apply render state to options
    const augmentedOptions: WebGPUFrameRenderOptions = {
        ...localOptions,
        particles,
        dlights: culledLights,
        brightness: this.renderState.brightness,
        gamma: this.renderState.gamma,
        fullbright: this.renderState.fullbright,
        ambient: this.renderState.ambient,
        underwaterWarp: this.renderState.underwaterWarp,
        bloom: this.renderState.bloom,
        bloomIntensity: this.renderState.bloomIntensity,
        lightStyleOverrides: this.lightStyleOverrides,
    };

    // For now, pass options to frame renderer.
    return this.frameRenderer.renderFrame(augmentedOptions, entities);
  }

  // =========================================================================
  // Geometry Management
  // =========================================================================

  uploadWorld(world: PreparedWorld): WorldRenderState {
    const surfaces: WebGPUWorldSurface[] = [];
    world.geometry.surfaces.forEach((surface, faceIndex) => {
      if (!surface) return;
      const vb = new VertexBuffer(this.device, { size: surface.vertexData.byteLength, label: `world-vb-${faceIndex}` });
      vb.write(surface.vertexData as unknown as BufferSource);
      const ib = new IndexBuffer(this.device, { size: surface.indexData.byteLength, label: `world-ib-${faceIndex}` });
      ib.write(surface.indexData as unknown as BufferSource);
      surfaces[faceIndex] = { ...surface, gpuVertexBuffer: vb.buffer, gpuIndexBuffer: ib.buffer };
    });

    const lightmaps = world.geometry.lightmaps.map((atlas) => {
      const texture = new Texture2D(this.device, { width: atlas.width, height: atlas.height, format: 'rgba8unorm', label: 'lightmap-atlas' });
      texture.upload(atlas.pixels as unknown as BufferSource);
      return { texture, width: atlas.width, height: atlas.height, pixels: atlas.pixels };
    });

    const textures = new Map<string, Texture2D>();
    for (const [name, prepared] of world.textures) textures.set(name, this.uploadPreparedTexture(name, prepared));

    const state: WebGPUWorldRenderState = { map: world.map, surfaces, lightmaps, textures, lightStyles: world.lightStyles };
    // IRenderer hands the world back to renderFrame as an opaque value typed with WebGL's
    // defaults; renderFrame reads it as the WebGPU state it is.
    return state as unknown as WorldRenderState;
  }

  uploadModels(world: WorldRenderState, models: PreparedModels): void {
    const textures = world.textures as unknown as Map<string, Texture2D> | undefined;
    if (!textures) throw new Error('uploadModels: the world has no texture map (upload it with uploadWorld)');
    for (const [name, prepared] of models.textures) {
      if (!textures.has(name)) textures.set(name, this.uploadPreparedTexture(name, prepared));
    }
  }

  private uploadPreparedTexture(name: string, prepared: PreparedTexture): Texture2D {
    const texture = new Texture2D(this.device, {
      width: prepared.width,
      height: prepared.height,
      format: 'rgba8unorm',
      mipLevelCount: prepared.levels.length,
      label: `world-${name}`,
    });
    for (const level of prepared.levels) {
      texture.upload(level.rgba as unknown as BufferSource, { mipLevel: level.level, width: level.width, height: level.height });
    }
    return texture;
  }

  uploadBspGeometry(surfaces: readonly BspSurfaceGeometry[]): void {
      for (const surface of surfaces) {
          // Check if already uploaded
          if (surface.gpuVertexBuffer && surface.gpuIndexBuffer) continue;

          // Create GPU buffers using our resource abstraction
          const vb = new VertexBuffer(this.device, {
              size: surface.vertexData.byteLength,
              label: `bsp-surface-vb-${surface.texture}`
          });
          // Explicit cast to BufferSource
          vb.write(surface.vertexData as unknown as BufferSource);

          const ib = new IndexBuffer(this.device, {
              size: surface.indexData.byteLength,
              label: `bsp-surface-ib-${surface.texture}`
          });
          // Explicit cast to BufferSource
          ib.write(surface.indexData as unknown as BufferSource);

          // Assign to surface properties (casting to write readonly/extended props)
          const mutableSurface = surface as any;
          mutableSurface.gpuVertexBuffer = vb.buffer;
          mutableSurface.gpuIndexBuffer = ib.buffer;
      }
  }

  // =========================================================================
  // Texture Management
  // =========================================================================

  async registerPic(name: string, data: ArrayBuffer): Promise<Pic> {
    if (this.picCache.has(name)) {
      return this.picCache.get(name)!;
    }

    const texture = new Texture2D(this.device, {
      width: 256,
      height: 256,
      format: this.context.format,
      label: `pic-${name}`
    });

    texture.upload(data);
    this.picCache.set(name, texture);
    return texture;
  }

  registerTexture(name: string, texture: PreparedTexture): Pic {
    if (this.picCache.has(name)) {
      return this.picCache.get(name)!;
    }

    const gpuTexture = new Texture2D(this.device, {
      width: texture.width,
      height: texture.height,
      format: this.context.format,
      mipLevelCount: texture.levels.length,
      label: `texture-${name}`
    });

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
  // =========================================================================

  begin2D(): void {
    this.frameRenderer.begin2DPass();
    this.is2DActive = true;
  }

  end2D(): void {
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
    this.pipelines.sprite.drawTexturedQuad(
      x, y,
      pic.width, pic.height,
      pic as Texture2D,
      0, 0, 1, 1,
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
      return;
    }

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
    const stripped = text.replace(/\^[0-9]/g, '');
    const charWidth = 8;
    const width = stripped.length * charWidth;
    const x = (this.width - width) / 2;
    this.drawString(x, y, text);
  }

  // =========================================================================
  // Entity Highlighting
  // =========================================================================

  setEntityHighlight(entityId: number, color: [number, number, number, number]): void {
    this.highlightedEntities.set(entityId, color);
  }

  clearEntityHighlight(entityId: number): void {
    this.highlightedEntities.delete(entityId);
  }

  highlightSurface(faceIndex: number, color: [number, number, number, number]): void {
    this.highlightedSurfaces.set(faceIndex, color);
  }

  removeSurfaceHighlight(faceIndex: number): void {
    this.highlightedSurfaces.delete(faceIndex);
  }

  // =========================================================================
  // Render Settings
  // =========================================================================

  setDebugMode(mode: DebugMode): void {
    this.renderState.debugMode = mode;
  }

  setBrightness(value: number): void {
    this.renderState.brightness = Math.max(0.0, Math.min(2.0, value));
  }

  setGamma(value: number): void {
    this.renderState.gamma = Math.max(0.5, Math.min(3.0, value));
  }

  setFullbright(enabled: boolean): void {
    this.renderState.fullbright = enabled;
  }

  setAmbient(value: number): void {
    this.renderState.ambient = Math.max(0.0, Math.min(1.0, value));
  }

  setLightStyle(index: number, pattern: string | null): void {
    if (pattern === null) {
      this.lightStyleOverrides.delete(index);
    } else {
      this.lightStyleOverrides.set(index, pattern);
    }
  }

  setUnderwaterWarp(enabled: boolean): void {
    this.renderState.underwaterWarp = enabled;
  }

  setBloom(enabled: boolean): void {
    this.renderState.bloom = enabled;
  }

  setBloomIntensity(value: number): void {
    this.renderState.bloomIntensity = Math.max(0.0, Math.min(1.0, value));
  }

  setLodBias(bias: number): void {
    this.renderState.lodBias = Math.max(0.0, Math.min(2.0, bias));
  }

  // =========================================================================
  // Instanced Rendering
  // =========================================================================

  renderInstanced(model: Md2Model | Md3Model, instances: InstanceData[]): void {
    // TODO: Implement instanced rendering for WebGPU
    // This will require adding instancing support to the pipelines
    console.warn('Instanced rendering not yet implemented for WebGPU');
  }

  // =========================================================================
  // Performance and Memory
  // =========================================================================

  getPerformanceReport(): RenderStatistics {
    return this.profiler.getPerformanceReport();
  }

  getMemoryUsage(): MemoryUsage {
    return this.profiler.getMemoryUsage();
  }

  /**
   * Get the profiler instance for advanced profiling operations
   */
  getProfiler(): WebGPUProfiler {
    return this.profiler;
  }

  // =========================================================================
  // WebGPU-Specific Extensions
  // =========================================================================

  /**
   * Get WebGPU device capabilities and limits
   */
  getCapabilities(): WebGPUCapabilities {
    const limits = this.device.limits;
    const features = this.device.features;

    return {
      maxTextureDimension2D: limits.maxTextureDimension2D,
      maxTextureDimension3D: limits.maxTextureDimension3D,
      maxTextureArrayLayers: limits.maxTextureArrayLayers,
      maxBindGroups: limits.maxBindGroups,
      maxDynamicUniformBuffersPerPipelineLayout: limits.maxDynamicUniformBuffersPerPipelineLayout,
      maxDynamicStorageBuffersPerPipelineLayout: limits.maxDynamicStorageBuffersPerPipelineLayout,
      maxSampledTexturesPerShaderStage: limits.maxSampledTexturesPerShaderStage,
      maxSamplersPerShaderStage: limits.maxSamplersPerShaderStage,
      maxStorageBuffersPerShaderStage: limits.maxStorageBuffersPerShaderStage,
      maxStorageTexturesPerShaderStage: limits.maxStorageTexturesPerShaderStage,
      maxUniformBuffersPerShaderStage: limits.maxUniformBuffersPerShaderStage,
      maxUniformBufferBindingSize: limits.maxUniformBufferBindingSize,
      maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
      maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX,
      maxComputeWorkgroupSizeY: limits.maxComputeWorkgroupSizeY,
      maxComputeWorkgroupSizeZ: limits.maxComputeWorkgroupSizeZ,
      maxComputeInvocationsPerWorkgroup: limits.maxComputeInvocationsPerWorkgroup,
      maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension,

      // Optional features
      timestampQuery: features.has('timestamp-query'),
      pipelineStatisticsQuery: features.has('pipeline-statistics-query'),
      textureCompressionBC: features.has('texture-compression-bc'),
      textureCompressionETC2: features.has('texture-compression-etc2'),
      textureCompressionASTC: features.has('texture-compression-astc'),
      depthClipControl: features.has('depth-clip-control'),
      depth32floatStencil8: features.has('depth32float-stencil8'),
    };
  }

  /**
   * Dispatch a compute shader (for Phase 6 compute pipelines)
   */
  dispatchCompute(
    pipeline: ComputePipeline,
    bindGroup: GPUBindGroup,
    workgroups: [number, number, number]
  ): void {
    const commandEncoder = this.device.createCommandEncoder({ label: 'compute-command-encoder' });
    const computePass = commandEncoder.beginComputePass({ label: 'compute-pass' });

    computePass.setPipeline(pipeline.pipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(workgroups[0], workgroups[1], workgroups[2]);
    computePass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Get timestamp query results (if supported)
   * Returns array of timing measurements in milliseconds
   */
  getTimestampResults(): Promise<number[]> {
    // Poll for any pending results
    return this.profiler.pollResults().then(() => {
      return this.profiler.getTimestampResults();
    });
  }

  /**
   * Capture the current frame's command buffer for debugging
   * This is a placeholder for advanced debugging tools
   */
  captureFrame(): Promise<GPUCommandBuffer> {
    // TODO: Implement frame capture infrastructure
    // This would require intercepting the command encoder
    return Promise.reject(new Error('Frame capture not yet implemented'));
  }

  // =========================================================================
  // Lifecycle
  // =========================================================================

  resize(width: number, height: number): void {
    if (this.context.context && !this.context.isHeadless) {
        this.context.width = width;
        this.context.height = height;
    } else {
        this.context.width = width;
        this.context.height = height;
    }
  }

  dispose(): void {
    this.profiler.dispose();
    this.pipelines.sprite.destroy();
    this.pipelines.skybox.destroy();
    this.pipelines.bsp.destroy();
    this.pipelines.md2.dispose();
    this.pipelines.postProcess.destroy();
    this.pipelines.particles.dispose();
    this.debug.destroy();
    // TODO: Dispose the md3 pipeline once added

    for (const texture of this.picCache.values()) {
      (texture as Texture2D).destroy();
    }
    this.picCache.clear();
    this.whiteTexture.destroy();
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

  // Initialize resource tracker for memory profiling
  const resourceTracker = new ProfilingResourceTracker();
  setResourceTracker(resourceTracker);

  // Initialize profiler
  const profiler = new WebGPUProfiler(context.device);

  // Initialize Pipelines
  const spriteRenderer = new SpriteRenderer(context.device, context.format);
  const skyboxPipeline = new SkyboxPipeline(context.device, context.format);

  // Use context.depthFormat for the BSP pipeline
  // Ensure we are passing correct formats
  const depthFormat = context.depthFormat || 'depth24plus';
  const bspPipeline = new BspSurfacePipeline(
      context.device,
      context.format,
      depthFormat
  );

  const md2Pipeline = new Md2Pipeline(context.device, context.format);
  const particleRenderer = new ParticleRenderer(context.device, context.format, depthFormat);
  const postProcessPipeline = new PostProcessPipeline(context.device, context.format);

  // Initialize Debug Renderer
  const debugRenderer = new WebGPUDebugRenderer(context.device, context.format, depthFormat);

  // Registry of pipelines
  const pipelines = {
    sprite: spriteRenderer,
    skybox: skyboxPipeline,
    bsp: bspPipeline,
    md2: md2Pipeline,
    postProcess: postProcessPipeline,
    particles: particleRenderer,
    // TODO: Add MD3
  };

  if (canvas) {
      context.width = canvas.width;
      context.height = canvas.height;
  } else {
      context.width = 800;
      context.height = 600;
  }

  const frameRenderer = new FrameRenderer(context, pipelines);

  return new WebGPURendererImpl(context, frameRenderer, pipelines, debugRenderer, profiler);
}
