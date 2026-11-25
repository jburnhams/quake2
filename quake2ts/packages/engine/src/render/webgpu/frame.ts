import { Texture2D, TextureCubeMap, createLinearSampler, Sampler } from './resources.js';
import type { Texture2D as GpuTexture2D } from './resources.js';
import { SpriteRenderer } from './pipelines/sprite.js';
import { SkyboxPipeline, SkyboxBindOptions } from './pipelines/skybox.js';
import { BspSurfacePipeline } from './pipelines/bspPipeline.js';
import { Md2Pipeline } from './pipelines/md2Pipeline.js';
import { PostProcessPipeline } from './pipelines/postProcess.js';
import { ParticleRenderer } from './pipelines/particleSystem.js';
import type { ParticleSystem } from '../particleSystem.js';
import { computeSkyScroll, removeViewTranslation } from '../skybox.js';
import { Camera } from '../camera.js';
import { RenderableEntity } from '../scene.js';
import { WebGPUContextState } from './context.js';
import { mat4 } from 'gl-matrix';
import { DLight } from '../dlight.js';
import type { PackedBspSurface } from '../bsp.js';
import type { WorldRenderState as SharedWorldRenderState } from '../frame.js';
import { calculateEntityLight, MODEL_LIGHT_DIRECTION } from '../light.js';
import { buildWorldDrawList, type BrushModelInstance, type WorldBatch, type WorldDraw } from '../worldDrawList.js';
import { CameraState } from '../types/camera.js';

export type { FrameRenderStats } from '../frame.js';
import type { FrameRenderStats } from '../frame.js';

export type { RenderMode, RenderModeConfig } from '../frame.js';
import type { RenderModeConfig } from '../frame.js';

export interface SkyRenderState {
  readonly scrollSpeeds?: readonly [number, number];
  readonly cubemap?: TextureCubeMap;
}

/** A world surface on WebGPU: the packed CPU data plus the GPU buffers uploadWorld made for it. */
export type WebGPUWorldSurface = PackedBspSurface & {
  gpuVertexBuffer?: GPUBuffer;
  gpuIndexBuffer?: GPUBuffer;
  /** The world's one vertex buffer (PackedBspGeometry.vertices), shared by every face of an uploaded world. */
  worldVertexBuffer?: GPUBuffer;
};

export type WorldRenderState = SharedWorldRenderState<Texture2D, WebGPUWorldSurface>;

export interface FrameRenderOptions {
  readonly camera: Camera;
  readonly cameraState?: CameraState; // New: Optional CameraState for native path
  readonly world?: WorldRenderState;
  readonly sky?: SkyRenderState;
  readonly timeSeconds?: number;
  readonly deltaTime?: number;
  /** Live particles to draw after the world and models (the renderer passes its own system). */
  readonly particles?: ParticleSystem;
  readonly clearColor?: readonly [number, number, number, number];
  readonly renderMode?: RenderModeConfig;
  readonly underwaterWarp?: boolean; // Enable underwater distortion
  readonly bloom?: boolean; // Enable bloom
  readonly bloomIntensity?: number; // Bloom intensity (default 0.5)
  // Callback for drawing 2D elements during the HUD pass
  readonly onDraw2D?: () => void;
  readonly dlights?: readonly DLight[];
  readonly disableLightmaps?: boolean;
  readonly lightmapOnly?: boolean;
  readonly brightness?: number;
  readonly gamma?: number;
  readonly fullbright?: boolean;
  readonly ambient?: number;
  readonly lightStyleOverrides?: Map<number, string>;
  readonly portalState?: ReadonlyArray<boolean>;
  /** Doors, lifts and other brush-model entities, each drawn at its entity's position. */
  readonly brushModels?: readonly BrushModelInstance[];
}

export type { WebGPUContextState };

export interface FrameContext {
  device: GPUDevice;
  commandEncoder: GPUCommandEncoder;
  renderTarget: GPUTextureView;
  depthTexture: GPUTextureView;
  width: number;
  height: number;
}


export class FrameRenderer {
  private depthTexture: GPUTexture | null = null;
  private copyTexture: GPUTexture | null = null;
  private intermediateTexture: GPUTexture | null = null;
  // Separate texture for headless output if no context exists
  public headlessTarget: GPUTexture | null = null;
  private sampler: GPUSampler;
  private repeatSampler: GPUSampler;
  private clampSampler: GPUSampler;
  private views = new WeakMap<GpuTexture2D, GPUTextureView>();

  /** One view per texture, so bind groups can be cached by view. */
  private viewOf(texture: GpuTexture2D): GPUTextureView {
    let view = this.views.get(texture);
    if (!view) this.views.set(texture, (view = texture.createView()));
    return view;
  }

  private lastWidth = 0;
  private lastHeight = 0;
  private lastFrameTime = 0;

  // Current frame context (available during frame rendering)
  private currentFrameContext: FrameContext | null = null;

  constructor(
    private context: WebGPUContextState,
    private pipelines: {
      sprite: SpriteRenderer;
      skybox: SkyboxPipeline;
      bsp: BspSurfacePipeline;
      md2: Md2Pipeline;
      postProcess: PostProcessPipeline;
      particles: ParticleRenderer;
      // TODO: Add the MD3 pipeline
    }
  ) {
      this.sampler = createLinearSampler(this.context.device).sampler;
      this.repeatSampler = new Sampler(this.context.device, {
        minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear',
        addressModeU: 'repeat', addressModeV: 'repeat', label: 'world-diffuse-sampler',
      }).sampler;
      this.clampSampler = new Sampler(this.context.device, {
        minFilter: 'linear', magFilter: 'linear',
        addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', label: 'world-lightmap-sampler',
      }).sampler;
  }

  /** The frame's world indices (both passes), in a buffer grown as needed and refilled each frame. */
  private worldIndexBuffer: GPUBuffer | null = null;

  private writeWorldIndices(indices: Uint32Array): GPUBuffer {
    const device = this.context.device;
    if (!this.worldIndexBuffer || this.worldIndexBuffer.size < indices.byteLength) {
      this.worldIndexBuffer?.destroy();
      this.worldIndexBuffer = device.createBuffer({
        label: 'world-indices',
        size: Math.max(indices.byteLength, 64 * 1024),
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
    }
    if (indices.byteLength > 0) device.queue.writeBuffer(this.worldIndexBuffer, 0, indices as unknown as BufferSource);
    return this.worldIndexBuffer;
  }

  private ensureIntermediateTexture(width: number, height: number): GPUTextureView {
      if (this.intermediateTexture && this.lastWidth === width && this.lastHeight === height) {
          return this.intermediateTexture.createView();
      }

      if (this.intermediateTexture) {
          this.intermediateTexture.destroy();
      }

      this.intermediateTexture = this.context.device.createTexture({
          size: [width, height],
          format: this.context.format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
          label: 'intermediate-texture'
      });

      return this.intermediateTexture.createView();
  }

  private ensureDepthTexture(width: number, height: number): GPUTextureView {
    if (this.depthTexture && this.lastWidth === width && this.lastHeight === height) {
      return this.depthTexture.createView();
    }

    if (this.depthTexture) {
      this.depthTexture.destroy();
    }

    this.depthTexture = this.context.device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      label: 'depth-buffer'
    });

    // Also reset copy texture if size changes
    if (this.copyTexture) {
        this.copyTexture.destroy();
        this.copyTexture = null;
    }

    this.lastWidth = width;
    this.lastHeight = height;

    return this.depthTexture.createView();
  }

  private ensureCopyTexture(width: number, height: number): GPUTexture {
      if (this.copyTexture && this.lastWidth === width && this.lastHeight === height) {
          return this.copyTexture;
      }

      if (this.copyTexture) {
          this.copyTexture.destroy();
      }

      this.copyTexture = this.context.device.createTexture({
          size: [width, height],
          format: this.context.format,
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
          label: 'frame-copy-texture'
      });

      return this.copyTexture;
  }

  public ensureHeadlessTarget(width: number, height: number): GPUTextureView {
      if (this.headlessTarget && this.headlessTarget.width === width && this.headlessTarget.height === height) {
          return this.headlessTarget.createView();
      }

      if (this.headlessTarget) {
          this.headlessTarget.destroy();
      }

      // For headless, we need COPY_SRC to read back the image
      this.headlessTarget = this.context.device.createTexture({
          size: [width, height],
          format: this.context.format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
          label: 'headless-render-target'
      });

      return this.headlessTarget.createView();
  }

  beginFrame(): FrameContext {
    const { device, context, width, height } = this.context;
    const commandEncoder = device.createCommandEncoder({ label: 'frame-command-encoder' });

    let renderTarget: GPUTextureView;

    if (context) {
        renderTarget = context.getCurrentTexture().createView();
    } else {
        // Handle headless mode by creating/reusing a standalone texture
        renderTarget = this.ensureHeadlessTarget(width, height);
    }

    const depthTexture = this.ensureDepthTexture(width, height);

    return {
      device,
      commandEncoder,
      renderTarget,
      depthTexture,
      width,
      height
    };
  }

  /**
   * Begin 2D rendering pass. Called by WebGPURenderer.begin2D()
   */
  begin2DPass(): void {
    if (!this.currentFrameContext) {
      throw new Error('begin2DPass called outside of renderFrame');
    }

    const { commandEncoder, renderTarget, width, height } = this.currentFrameContext;
    this.pipelines.sprite.setProjection(width, height);
    this.pipelines.sprite.begin(commandEncoder, renderTarget);
  }

  /**
   * End 2D rendering pass. Called by WebGPURenderer.end2D()
   */
  end2DPass(): void {
    this.pipelines.sprite.end();
  }

  renderFrame(options: FrameRenderOptions, entities: readonly RenderableEntity[] = []): FrameRenderStats {
    const now = performance.now();
    const fps = this.lastFrameTime > 0 ? 1000 / (now - this.lastFrameTime) : 0;
    this.lastFrameTime = now;

    const stats: FrameRenderStats = {
      batches: 0,
      facesDrawn: 0,
      drawCalls: 0,
      skyDrawn: false,
      viewModelDrawn: false,
      fps: Math.round(fps),
      vertexCount: 0,
    };

    const frameCtx = this.beginFrame();
    this.currentFrameContext = frameCtx; // Store for 2D rendering
    const { commandEncoder, renderTarget, depthTexture } = frameCtx;
    const {
        clearColor = [0, 0, 0, 1],
        world,
        camera,
        timeSeconds = 0,
        dlights,
        renderMode,
        disableLightmaps,
        lightmapOnly,
        brightness,
        gamma,
        fullbright,
        ambient,
        lightStyleOverrides,
        portalState,
        underwaterWarp
    } = options;

    // Determine if post processing is needed
    const usePostProcess = underwaterWarp || (gamma !== undefined && gamma !== 1.0) || (brightness !== undefined && brightness !== 1.0);

    let renderPassTarget = renderTarget;
    let intermediateView: GPUTextureView | null = null;

    if (usePostProcess) {
        intermediateView = this.ensureIntermediateTexture(frameCtx.width, frameCtx.height);
        renderPassTarget = intermediateView;
    }

    const viewProjection = new Float32Array(options.camera.viewProjectionMatrix);

    // --- Pass 1: Opaque & Skybox ---
    // Clears the screen and draws solid geometry
    const opaquePassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: renderPassTarget,
        clearValue: [...clearColor],
        loadOp: 'clear',
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: depthTexture,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      },
      label: 'opaque-render-pass'
    };

    const opaquePass = commandEncoder.beginRenderPass(opaquePassDescriptor);

    // Render Skybox
    if (options.sky && options.sky.cubemap) {
        const cameraState = options.cameraState ?? options.camera.toState();
        const scroll = computeSkyScroll(options.timeSeconds ?? 0, options.sky.scrollSpeeds ?? [0.01, 0.02]);
        this.pipelines.skybox.draw(opaquePass, {
            cameraState,
            scroll,
            cubemap: options.sky.cubemap
        });
        stats.skyDrawn = true;
    }

    if (world) {
        this.pipelines.bsp.beginFrame();
        const drawList = buildWorldDrawList(world, {
          cameraPosition: { x: camera.position[0] ?? 0, y: camera.position[1] ?? 0, z: camera.position[2] ?? 0 },
          viewProjection,
          timeSeconds,
          portalState,
          lightStyleOverrides,
          renderMode,
          disableLightmaps,
          hasTexture: (name) => Boolean(world.textures?.get(name)),
          brushModels: options.brushModels,
        });
        stats.batches = drawList.batches;
        stats.vertexCount = drawList.vertexCount;
        const cameraState = options.cameraState ?? options.camera.toState();

        // One write of the frame's indices; each batch is then one draw from the world's buffer.
        const worldIndices = drawList.indices && renderMode?.mode !== 'wireframe' ? this.writeWorldIndices(drawList.indices) : undefined;

        const runPass = (draws: readonly WorldDraw<WebGPUWorldSurface>[], batches: readonly WorldBatch[], pass: GPURenderPassEncoder) => {
            for (const batch of batches) {
                // Every draw in a batch shares the values bound here (the front end's batch key).
                const draw = draws[batch.first];
                const geometry = draw.surface;
                const diffuse = (world.materials?.getMaterial(geometry.texture)?.texture as unknown as GpuTexture2D | null | undefined)
                    ?? world.textures?.get(draw.texture);
                const lightmap = draw.lightmapAtlas !== undefined ? world.lightmaps?.[draw.lightmapAtlas]?.texture : undefined;
                this.pipelines.bsp.bind(pass, {
                    cameraState,
                    styleIndices: draw.styleIndices,
                    styleLayers: draw.styleLayers,
                    styleValues: drawList.lightStyles,
                    surfaceFlags: geometry.surfaceFlags,
                    timeSeconds,
                    texScroll: draw.texScroll,
                    warp: draw.warp,
                    diffuseTexture: diffuse ? this.viewOf(diffuse) : undefined,
                    diffuseSampler: this.repeatSampler,
                    lightmapTexture: lightmap ? this.viewOf(lightmap) : undefined,
                    lightmapSampler: this.clampSampler,
                    dlights,
                    renderMode: draw.renderMode,
                    lightmapOnly,
                    brightness,
                    gamma,
                    fullbright,
                    ambient,
                    cameraPosition: options.camera.position as Float32Array,
                    modelMatrix: draw.transform,
                });
                stats.facesDrawn += batch.count;
                if (worldIndices && geometry.worldVertexBuffer) {
                    this.pipelines.bsp.drawRange(pass, geometry.worldVertexBuffer, worldIndices, batch.firstIndex, batch.indexCount);
                    stats.drawCalls++;
                } else {
                    // Faces built by hand (no world buffer), or wireframe: one draw a face.
                    for (let i = batch.first; i < batch.first + batch.count; i++) {
                        this.pipelines.bsp.draw(pass, draws[i].surface, draws[i].renderMode);
                        stats.drawCalls++;
                    }
                }
            }
        };

        runPass(drawList.opaque, drawList.opaqueBatches, opaquePass);

        // Render Entities (MD2)
        this.pipelines.md2.beginFrame();
        for (const entity of entities) {
            // Handle MD2
            if (entity.type === 'md2') {
                const model = entity.model;
                // Calculate Model Matrix from transform
                // RenderableMd2 has a `transform` property which is a Mat4 (array of 16 numbers)
                // We can use it directly as the model matrix.
                const modelMatrix = entity.transform as Float32List;

                // Setup Bind Options
                // Always provide CameraState for native coordinate system
                const cameraState = options.cameraState ?? options.camera.toState();

                // Frame Blend
                // RenderableMd2 has `blend` property of type Md2FrameBlend { frame0, frame1, lerp }
                const blend = entity.blend;

                // Get texture
                // RenderableMd2 has `skin` property which is a string (texture name).
                // We need to resolve this to a Texture2D from the world texture cache.
                // Wait, options.world.textures is ReadonlyMap<string, Texture2D>.
                let texture: Texture2D | undefined;
                if (entity.skin && options.world?.textures) {
                    texture = options.world.textures.get(entity.skin);
                }

                // Fallback to model skin if available?
                if (!texture && model.skins.length > 0 && options.world?.textures) {
                    texture = options.world.textures.get(model.skins[0].name);
                }

                if (!texture) continue;

                const mesh = this.pipelines.md2.getMesh(model);
                mesh.update(model, blend);

                // Convert RenderModeConfig from WebGPU to Engine (shared) type if needed
                // Currently they are compatible types but TS might complain if strict
                // We use 'as any' or compatible cast if needed.
                const pipelineRenderMode = renderMode as any;

                this.pipelines.md2.bind(opaquePass, {
                    cameraState,
                    modelViewProjection: viewProjection, // Fallback if cameraState not used
                    modelMatrix: modelMatrix,
                    lightDirection: MODEL_LIGHT_DIRECTION,
                    // The light under the model, as the WebGL backend (and R_LightPoint) takes it.
                    ambientLight: entity.ambientLight ?? calculateEntityLight(options.world?.map, {
                        x: modelMatrix[12], y: modelMatrix[13], z: modelMatrix[14],
                    }),
                    dlights: options.dlights,
                    renderMode: pipelineRenderMode,
                    brightness: options.brightness,
                    gamma: options.gamma,
                    fullbright: options.fullbright,
                    ambient: options.ambient,
                    tint: entity.tint
                }, texture, blend.lerp);

                this.pipelines.md2.draw(opaquePass, mesh);
                stats.drawCalls++;
            }
            // TODO: Handle MD3 rendering
        }

        opaquePass.end();

        // --- Pass 2: Transparent ---
        const transparentPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [{
              view: renderPassTarget,
              loadOp: 'load',
              storeOp: 'store'
            }],
            depthStencilAttachment: {
              view: depthTexture,
              depthLoadOp: 'load',
              depthStoreOp: 'store'
            },
            label: 'transparent-render-pass'
        };

        const transparentPass = commandEncoder.beginRenderPass(transparentPassDescriptor);

        runPass(drawList.transparent, drawList.transparentBatches, transparentPass);

        transparentPass.end();
    } else {
        opaquePass.end();
    }

    // --- Particles: after the world and models, depth tested, writing no depth ---
    if (options.particles && options.particles.aliveCount() > 0) {
        const particlePass = commandEncoder.beginRenderPass({
            colorAttachments: [{ view: renderPassTarget, loadOp: 'load', storeOp: 'store' }],
            depthStencilAttachment: { view: depthTexture, depthLoadOp: 'load', depthStoreOp: 'store' },
            label: 'particle-render-pass'
        });
        const cameraState = options.cameraState ?? options.camera.toState();
        this.pipelines.particles.render(particlePass, viewProjection, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, options.particles, undefined, cameraState);
        particlePass.end();
    }

    // --- Pass 3: Post Processing (Bloom, Warp) ---
    if (usePostProcess && intermediateView) {
        const ppPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: renderTarget,
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: [0, 0, 0, 1]
            }],
            label: 'post-process-pass'
        });

        this.pipelines.postProcess.render(
            ppPass,
            intermediateView,
            this.sampler,
            {
                time: timeSeconds || 0,
                strength: underwaterWarp ? 1.0 : 0.0,
                gamma: gamma ?? 1.0,
                brightness: brightness ?? 1.0
            }
        );
        ppPass.end();
    }

    // --- Pass 4: 2D / HUD ---
    if (options.onDraw2D) {
        options.onDraw2D();
    }

    // Defensive cleanup
    if (this.pipelines.sprite.isActive) {
        console.warn('2D render pass was not properly closed - auto-closing to prevent resource leak');
        this.end2DPass();
    }

    // Finalize
    this.context.device.queue.submit([commandEncoder.finish()]);

    // Clear frame context
    this.currentFrameContext = null;

    return stats;
  }
}
