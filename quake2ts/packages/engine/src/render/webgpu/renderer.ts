import { FrameRenderer, FrameRenderOptions as WebGPUFrameRenderOptions, FrameRenderStats } from './frame.js';
import { SpriteRenderer } from './pipelines/sprite.js';
import { SkyboxPipeline } from './pipelines/skybox.js';
import { BspSurfacePipeline } from './pipelines/bspPipeline.js';
import { Md2Pipeline } from './pipelines/md2Pipeline.js';
import { PostProcessPipeline } from './pipelines/postProcess.js';
import { createWebGPUContext, WebGPUContextOptions, WebGPUContextState } from './context.js';
import { Camera } from '../camera.js';
import { IWebGPURenderer, Pic, WebGPUCapabilities, ComputePipeline } from '../interface.js';
import { Texture2D, VertexBuffer, IndexBuffer } from './resources.js';
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
import { FrameRenderOptions } from '../frame.js'; // Shared interface

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
    },
    debugRenderer: WebGPUDebugRenderer
  ) {
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

    // Apply render state to options
    const augmentedOptions: WebGPUFrameRenderOptions = {
        ...localOptions,
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
    return {
      texturesBytes: 0,
      geometryBytes: 0,
      shadersBytes: 0,
      buffersBytes: 0,
      totalBytes: 0
    };
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
   * This is a placeholder for Phase 6 performance profiling
   */
  getTimestampResults(): Promise<number[]> {
    // Timestamp queries require 'timestamp-query' feature
    if (!this.device.features.has('timestamp-query')) {
      return Promise.resolve([]);
    }

    // TODO: Implement timestamp query infrastructure
    // This will require creating query sets and reading back results
    return Promise.resolve([]);
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
    this.pipelines.sprite.destroy();
    this.pipelines.skybox.destroy();
    this.pipelines.bsp.destroy();
    this.pipelines.md2.dispose();
    this.pipelines.postProcess.destroy();
    this.debug.destroy();
    // TODO: Dispose md3 and particle pipelines once added

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
    // TODO: Add MD3 and Particles
  };

  if (canvas) {
      context.width = canvas.width;
      context.height = canvas.height;
  } else {
      context.width = 800;
      context.height = 600;
  }

  const frameRenderer = new FrameRenderer(context, pipelines);

  return new WebGPURendererImpl(context, frameRenderer, pipelines, debugRenderer);
}
