import { Texture2D } from './resources.js';
import { SpriteRenderer } from './pipelines/sprite.js';
import { Camera } from '../camera.js';
import { WebGPUContextState } from './context.js';
import { mat4 } from 'gl-matrix';

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

export interface FrameRenderOptions {
  readonly camera: Camera;
  readonly timeSeconds?: number;
  readonly deltaTime?: number;
  readonly clearColor?: readonly [number, number, number, number];
  readonly renderMode?: RenderModeConfig;
  readonly underwaterWarp?: boolean; // Enable underwater distortion
  readonly bloom?: boolean; // Enable bloom
  readonly bloomIntensity?: number; // Bloom intensity (default 0.5)
  // Callback for drawing 2D elements during the HUD pass
  readonly onDraw2D?: () => void;
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
      // Future pipelines: bsp, skybox, md2, etc.
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
    const { clearColor = [0, 0, 0, 1] } = options;

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

    // Placeholder: Render Skybox
    // this.pipelines.skybox.draw(opaquePass, ...);

    // Placeholder: Render BSP Opaque
    // this.pipelines.bsp.drawOpaque(opaquePass, ...);

    // Placeholder: Render MD2/MD3
    // this.pipelines.md2.draw(opaquePass, ...);

    opaquePass.end();


    // --- Intermediate: Copy for Refraction/Warp if needed ---
    // In WebGL we copied to texture here if transparent surfaces need background.
    // In WebGPU we would resolve or copy texture.
    // if (hasTransparentSurfaces) {
    //    this.copyToTexture(commandEncoder, context.getCurrentTexture(), this.ensureCopyTexture(...));
    // }


    // --- Pass 2: Transparent ---
    // Loads the result of Pass 1 and draws transparent geometry on top
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

    // Placeholder: Render BSP Transparent
    // this.pipelines.bsp.drawTransparent(transparentPass, ...);

    transparentPass.end();

    // --- Pass 3: Post Processing (Bloom, Warp) ---
    // TODO: Implement Ping-Pong Rendering for PostFX
    // For now, placeholders.
    if (options.underwaterWarp || options.bloom) {
         // Copy current render target to texture for input
         // Apply effects
    }

    // --- Pass 4: 2D / HUD ---
    // The onDraw2D callback should call renderer.begin2D() which will
    // set up the sprite pipeline and projection
    // Ref: WebGL renderer.ts:605-608
    if (options.onDraw2D) {
        options.onDraw2D();
    }

    // Defensive cleanup: If 2D pass was started but not ended, close it
    // to prevent GPU resource leaks when the command encoder is finalized
    // Ref: User should call renderer.end2D(), but this handles forgotten calls
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
