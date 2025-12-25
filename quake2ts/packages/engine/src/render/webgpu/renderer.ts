import { FrameRenderer, FrameRenderOptions, FrameRenderStats } from './frame.js';
import { SpriteRenderer } from './pipelines/sprite.js';
import { createWebGPUContext, WebGPUContextOptions, WebGPUContextState } from './context.js';
import { Camera } from '../camera.js';
// Remove the unused import that caused the error
// import { IRenderer } from '../interface.js';

export interface WebGPURenderer {
  readonly type: 'webgpu';
  readonly device: GPUDevice;

  // Core methods
  renderFrame(options: FrameRenderOptions): FrameRenderStats;
  resize(width: number, height: number): void;
  destroy(): void;

  // Pipeline access (for testing/debug)
  readonly pipelines: {
    readonly sprite: SpriteRenderer;
  };
}

export class WebGPURendererImpl implements WebGPURenderer {
  readonly type = 'webgpu';

  constructor(
    private context: WebGPUContextState,
    private frameRenderer: FrameRenderer,
    public readonly pipelines: {
        sprite: SpriteRenderer;
    }
  ) {}

  get device(): GPUDevice {
    return this.context.device;
  }

  renderFrame(options: FrameRenderOptions): FrameRenderStats {
    return this.frameRenderer.renderFrame(options);
  }

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

  destroy(): void {
    // Destroy pipelines
    this.pipelines.sprite.destroy();

    // Destroy device resources if needed (most auto-destroyed with device)
    this.context.device.destroy();
  }
}

export async function createWebGPURenderer(
  canvas?: HTMLCanvasElement,
  options?: WebGPUContextOptions
): Promise<WebGPURenderer> {
  const context = await createWebGPUContext(canvas, options);

  // Initialize Pipelines
  const spriteRenderer = new SpriteRenderer(context.device, context.format);

  // Registry of pipelines
  const pipelines = {
    sprite: spriteRenderer
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
