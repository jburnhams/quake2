import { Texture2D, TextureCubeMap } from './resources.js';
import { SpriteRenderer } from './pipelines/sprite.js';
import { SkyboxPipeline, SkyboxBindOptions } from './pipelines/skybox.js';
import { BspSurfacePipeline, BspSurfaceBindOptions } from './pipelines/bspPipeline.js';
import { computeSkyScroll, removeViewTranslation } from '../skybox.js';
import { Camera } from '../camera.js';
import { WebGPUContextState } from './context.js';
import { mat4 } from 'gl-matrix';
import { DLight } from '../dlight.js';
import { BspSurfaceGeometry } from '../bsp.js';
import { BspMap } from '../../assets/bsp.js';
import { gatherVisibleFaces, VisibleFace } from '../bspTraversal.js';
import { extractFrustumPlanes } from '../culling.js';
import { SURF_SKY, SURF_TRANS33, SURF_TRANS66, SURF_WARP } from '@quake2ts/shared';
import { MaterialManager } from '../materials.js';
import { PreparedTexture } from '../../assets/texture.js';
import { CameraState } from '../types/camera.js';

const USE_NATIVE_COORDINATE_SYSTEM = true;  // Feature flag

// Types ported from WebGL implementation but adapted for WebGPU
export interface FrameRenderStats {
  batches: number;
  facesDrawn: number;
  drawCalls: number;
  skyDrawn: boolean;
  viewModelDrawn: boolean;
  fps: number;
  vertexCount: number;
}

export type RenderMode = 'textured' | 'wireframe' | 'solid' | 'solid-faceted';

export interface RenderModeConfig {
  readonly mode: RenderMode;
  readonly applyToAll: boolean;
  readonly color?: readonly [number, number, number, number];
  readonly generateRandomColor?: boolean;
}

export interface SkyRenderState {
  readonly scrollSpeeds?: readonly [number, number];
  readonly cubemap?: TextureCubeMap;
}

export interface WorldRenderState {
  readonly map: BspMap;
  readonly surfaces: readonly BspSurfaceGeometry[];
  readonly textures?: ReadonlyMap<string, Texture2D>;
  readonly materials?: MaterialManager;
  readonly lightStyles?: ReadonlyArray<number>;
}

export interface FrameRenderOptions {
  readonly camera: Camera;
  readonly cameraState?: CameraState; // New: Optional CameraState for native path
  readonly world?: WorldRenderState;
  readonly sky?: SkyRenderState;
  readonly timeSeconds?: number;
  readonly deltaTime?: number;
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
}

export { WebGPUContextState };

export interface FrameContext {
  device: GPUDevice;
  commandEncoder: GPUCommandEncoder;
  renderTarget: GPUTextureView;
  depthTexture: GPUTextureView;
  width: number;
  height: number;
}

// Helper to evaluate light style pattern at a given time
function evaluateLightStyle(pattern: string, time: number): number {
    if (!pattern) return 1.0;
    const frame = Math.floor(time * 10) % pattern.length;
    const charCode = pattern.charCodeAt(frame);
    return (charCode - 97) / 12.0;
}

// Front-to-back sorting for opaque surfaces
function sortVisibleFacesFrontToBack(faces: readonly VisibleFace[]): VisibleFace[] {
  return [...faces].sort((a, b) => b.sortKey - a.sortKey);
}

// Back-to-front sorting for transparent surfaces
function sortVisibleFacesBackToFront(faces: readonly VisibleFace[]): VisibleFace[] {
  return [...faces].sort((a, b) => a.sortKey - b.sortKey);
}

export class FrameRenderer {
  private depthTexture: GPUTexture | null = null;
  private copyTexture: GPUTexture | null = null;
  // Separate texture for headless output if no context exists
  public headlessTarget: GPUTexture | null = null;

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
      // Future pipelines: md2, etc.
    }
  ) {}

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

  renderFrame(options: FrameRenderOptions): FrameRenderStats {
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
        portalState
    } = options;

    const viewProjection = new Float32Array(options.camera.viewProjectionMatrix);

    // --- Pass 1: Opaque & Skybox ---
    // Clears the screen and draws solid geometry
    const opaquePassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: renderTarget,
        clearValue: clearColor,
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
        if (USE_NATIVE_COORDINATE_SYSTEM) {
             // New path (22-4)
            const cameraState = options.cameraState ?? options.camera.toState();
            const scroll = computeSkyScroll(options.timeSeconds ?? 0, options.sky.scrollSpeeds ?? [0.01, 0.02]);
            this.pipelines.skybox.draw(opaquePass, {
                cameraState,  // NEW: let pipeline build matrices
                scroll,
                cubemap: options.sky.cubemap
            });
        } else {
             // Legacy path removed or unsupported in this refactor
             // The SkyboxPipeline signature has changed to require CameraState.
             // If we needed to support both, SkyboxPipeline would need to support both inputs.
             // For now, we enforce the new path.
             const cameraState = options.cameraState ?? options.camera.toState();
             const scroll = computeSkyScroll(options.timeSeconds ?? 0, options.sky.scrollSpeeds ?? [0.01, 0.02]);
             this.pipelines.skybox.draw(opaquePass, {
                 cameraState,
                 scroll,
                 cubemap: options.sky.cubemap
             });
        }
        stats.skyDrawn = true;
    }

    // Render BSP Opaque
    const opaqueFaces: VisibleFace[] = [];
    const transparentFaces: VisibleFace[] = [];

    if (world) {
        // Update materials (if any logic needed)
        world.materials?.update(timeSeconds);

        const frustum = extractFrustumPlanes(Array.from(viewProjection));
        const cameraPosition = {
          x: camera.position[0] ?? 0,
          y: camera.position[1] ?? 0,
          z: camera.position[2] ?? 0,
        };
        const visibleFaces = gatherVisibleFaces(world.map, cameraPosition, frustum, portalState);

        for (const face of visibleFaces) {
            const geometry = world.surfaces[face.faceIndex];
            if (!geometry) continue;

            const isTransparent = (geometry.surfaceFlags & (SURF_TRANS33 | SURF_TRANS66 | SURF_WARP)) !== 0;

            if (isTransparent) {
                transparentFaces.push(face);
            } else {
                opaqueFaces.push(face);
            }
        }

        const sortedOpaque = sortVisibleFacesFrontToBack(opaqueFaces);

        // Prepare effective light styles
        let effectiveLightStyles: ReadonlyArray<number> = world.lightStyles || [];
        if (lightStyleOverrides && lightStyleOverrides.size > 0) {
            const styles = [...(world.lightStyles || [])];
            for (const [index, pattern] of lightStyleOverrides) {
               while (styles.length <= index) styles.push(1.0);
               styles[index] = evaluateLightStyle(pattern, timeSeconds);
            }
            effectiveLightStyles = styles;
        }

        // Draw Opaque Batch
        const drawSurfaceBatch = (faces: VisibleFace[], pass: GPURenderPassEncoder, lightStyles: ReadonlyArray<number>) => {
             for (const { faceIndex } of faces) {
                  const geometry = world.surfaces[faceIndex];
                  if (!geometry) continue;
                  if ((geometry.surfaceFlags & SURF_SKY) !== 0) continue;

                  const faceStyles = world.map.faces[faceIndex]?.styles;

                  // Resolve Textures (Simplified for WebGPU POC)
                  // const diffuse = world.textures?.get(geometry.texture);

                  // Bind Pipeline
                  this.pipelines.bsp.bind(pass, {
                      modelViewProjection: viewProjection,
                      styleIndices: faceStyles,
                      styleValues: lightStyles,
                      surfaceFlags: geometry.surfaceFlags,
                      timeSeconds,
                      // diffuseTexture: diffuse?.gpuTexture.createView(), // Need view
                      // diffuseSampler: ...
                      // lightmapTexture: ...
                      // lightmapSampler: ...
                      dlights,
                      renderMode,
                      lightmapOnly,
                      brightness,
                      gamma,
                      fullbright,
                      ambient,
                      cameraPosition: options.camera.position as Float32Array
                  });

                  this.pipelines.bsp.draw(pass, geometry, renderMode);
                  stats.facesDrawn++;
                  stats.drawCalls++;
                  stats.vertexCount += geometry.vertexCount;
             }
        };

        // Draw opaque
        drawSurfaceBatch(sortedOpaque, opaquePass, effectiveLightStyles);

        // Placeholder: Render MD2/MD3
        // this.pipelines.md2.draw(opaquePass, ...);

        opaquePass.end();

        // --- Pass 2: Transparent ---
        const transparentPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [{
              view: renderTarget,
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

        if (transparentFaces.length > 0) {
            const sortedTransparent = sortVisibleFacesBackToFront(transparentFaces);
            drawSurfaceBatch(sortedTransparent, transparentPass, effectiveLightStyles);
        }

        transparentPass.end();
    } else {
        opaquePass.end();
    }

    // --- Pass 3: Post Processing (Bloom, Warp) ---
    if (options.underwaterWarp || options.bloom) {
         // Placeholder
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
