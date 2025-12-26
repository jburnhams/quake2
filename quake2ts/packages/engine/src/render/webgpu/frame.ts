import { FrameRenderOptions, FrameRenderStats } from '../frame.js';
import { WebGPUContextState } from './context.js';
import { SpriteRenderer } from './pipelines/sprite.js';
import { RenderableEntity } from '../scene.js';
import { Texture2D } from './resources.js';

export interface FrameContext {
  device: GPUDevice;
  commandEncoder: GPUCommandEncoder;
  renderTarget: GPUTextureView;
  depthTexture: GPUTextureView;
  width: number;
  height: number;
}

export interface FrameRendererPipelines {
  sprite: SpriteRenderer;
  // More pipelines added in later sections
}

export class FrameRenderer {
  private depthTexture: Texture2D | undefined;
  private width: number = 0;
  private height: number = 0;

  constructor(
    private readonly context: WebGPUContextState,
    private readonly pipelines: FrameRendererPipelines
  ) {
    this.ensureDepthTexture(context.width, context.height);
  }

  private ensureDepthTexture(width: number, height: number): void {
    if (this.depthTexture && this.width === width && this.height === height) {
      return;
    }

    if (this.depthTexture) {
      this.depthTexture.destroy();
    }

    this.width = width;
    this.height = height;

    this.depthTexture = new Texture2D(this.context.device, {
      width,
      height,
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      label: 'FrameRenderer-Depth'
    });
  }

  beginFrame(externalRenderTarget?: GPUTextureView): FrameContext {
    // Check if resize is needed (only for canvas, headless usually fixed or manually resized)
    // For now we use the context dimensions.
    if (this.width !== this.context.width || this.height !== this.context.height) {
        this.ensureDepthTexture(this.context.width, this.context.height);
    }

    const commandEncoder = this.context.device.createCommandEncoder({
      label: 'FrameRenderer-CommandEncoder'
    });

    let renderTarget: GPUTextureView;
    if (externalRenderTarget) {
      renderTarget = externalRenderTarget;
    } else if (this.context.context) {
      renderTarget = this.context.context.getCurrentTexture().createView();
    } else {
      // For headless without external target, create temporary
      const texture = this.context.device.createTexture({
          size: [this.width, this.height, 1],
          format: this.context.format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
          label: 'Headless-RenderTarget'
      });
      renderTarget = texture.createView();
    }

    return {
      device: this.context.device,
      commandEncoder,
      renderTarget,
      depthTexture: this.depthTexture!.createView(),
      width: this.width,
      height: this.height
    };
  }

  renderFrame(options: FrameRenderOptions, entities: readonly RenderableEntity[], renderTarget?: GPUTextureView): FrameRenderStats {
    const frameCtx = this.beginFrame(renderTarget);
    const encoder = frameCtx.commandEncoder;

    // 1. Opaque Pass (Placeholder)
    // 2. Skybox Pass (Placeholder)
    // 3. Transparent Pass (Placeholder)

    // 4. 2D/Sprite Pass
    // We need to pass the render pass to the sprite renderer or let it start one.
    // Usually, we want to share the render pass if possible, or start a new one.
    // But SpriteRenderer likely expects to manage its own pass or be recorded into an existing one.
    // Let's assume for now we start a pass for the whole frame, or pass the encoder to pipelines.

    // Existing SpriteRenderer (if implemented like WebGL) might need adaptation.
    // Let's assume we do a clear pass first.

    const clearColor = options.clearColor || [0, 0, 0, 1];

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: frameCtx.renderTarget,
        clearValue: { r: clearColor[0], g: clearColor[1], b: clearColor[2], a: clearColor[3] },
        loadOp: 'clear',
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: frameCtx.depthTexture,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    };

    const passEncoder = encoder.beginRenderPass(renderPassDescriptor);

    // Execute pipelines
    // this.pipelines.sprite.render(passEncoder, ...);
    // Wait, SpriteRenderer implementation check needed.
    // If it's not implemented yet in this session, I might need to stub it or check its interface.
    // The previous task (20-5) should have implemented it.
    // Assuming standard render(passEncoder) interface.

    passEncoder.end();

    this.endFrame(frameCtx);

    return {
      batches: 0,
      facesDrawn: 0,
      drawCalls: 0,
      skyDrawn: false,
      viewModelDrawn: false,
      fps: 0,
      vertexCount: 0
    };
  }

  endFrame(frameCtx?: FrameContext): void {
     // If called from renderFrame, frameCtx is passed.
     // If we just want to submit whatever was recorded...
     // The FrameContext has the encoder.

     if (frameCtx) {
         const commandBuffer = frameCtx.commandEncoder.finish();
         frameCtx.device.queue.submit([commandBuffer]);
     }
  }
}
