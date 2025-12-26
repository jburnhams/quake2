import { FrameRenderer } from './frame.js';
import { FrameRenderOptions, FrameRenderStats } from '../frame.js';
import { SpriteRenderer } from './pipelines/sprite.js';
import { createWebGPUContext, WebGPUContextOptions, WebGPUContextState } from './context.js';
import { IRenderer, Pic } from '../interface.js';
import { RenderableEntity } from '../scene.js';
import { RenderOptions } from '../options.js';
import { Texture2D } from './resources.js';
import { PreparedTexture } from '../../assets/texture.js';
import { DebugMode } from '../debugMode.js';
import { Md2Model } from '../../assets/md2.js';
import { Md3Model } from '../../assets/md3.js';
import { InstanceData } from '../instancing.js';
import { CollisionVisRenderer } from '../collisionVis.js';
import { DebugRenderer } from '../debug.js';
import { ParticleSystem } from '../particleSystem.js';
import { RenderStatistics } from '../gpuProfiler.js';
import { MemoryUsage } from '../types.js';
import { parseColorString } from '../colors.js';

export interface WebGPURenderer extends IRenderer {
  readonly type: 'webgpu';
  readonly device: GPUDevice;
}

export class WebGPURendererImpl implements WebGPURenderer {
  readonly type = 'webgpu';
  private current2DEncoder: GPUCommandEncoder | null = null;
  private headlessRenderTarget: GPUTexture | null = null;
  private font: Pic | null = null;

  // Stubs for missing subsystems
  public collisionVis: CollisionVisRenderer = {} as any;
  public debug: DebugRenderer = {} as any;
  public particleSystem: ParticleSystem = {} as any;

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

  get width(): number {
    return this.context.width;
  }

  get height(): number {
    return this.context.height;
  }

  getPerformanceReport(): RenderStatistics {
    return {
        frameTimeMs: 16,
        gpuTimeMs: 0,
        cpuFrameTimeMs: 16,
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

  private getRenderTargetView(): GPUTextureView {
      if (this.context.context && !this.context.isHeadless) {
          return this.context.context.getCurrentTexture().createView();
      }

      // Headless management
      if (!this.headlessRenderTarget ||
          this.headlessRenderTarget.width !== this.width ||
          this.headlessRenderTarget.height !== this.height) {

          if (this.headlessRenderTarget) {
              this.headlessRenderTarget.destroy();
          }

          this.headlessRenderTarget = this.device.createTexture({
              size: [this.width, this.height, 1],
              format: this.context.format,
              usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
              label: 'WebGPURenderer-HeadlessTarget'
          });
      }
      return this.headlessRenderTarget.createView();
  }

  renderFrame(options: FrameRenderOptions, entities: readonly RenderableEntity[], renderOptions?: RenderOptions): void {
    const renderTarget = this.getRenderTargetView();
    this.frameRenderer.renderFrame(options, entities, renderTarget);
  }

  resize(width: number, height: number): void {
    this.context.width = width;
    this.context.height = height;
    // Headless target will be recreated on next getRenderTargetView
  }

  registerPic(name: string, data: ArrayBuffer): Promise<Pic> {
      return new Promise((resolve, reject) => {
          const blob = new Blob([data]);
          createImageBitmap(blob).then(imageBitmap => {
              const texture = new Texture2D(this.device, {
                  width: imageBitmap.width,
                  height: imageBitmap.height,
                  format: 'rgba8unorm', // Standard format for uploaded images
                  label: name
              });
              texture.upload(imageBitmap);

              if (name.includes('conchars')) {
                  this.font = texture as unknown as Pic; // Cast until Texture2D fully implements Pic
              }
              resolve(texture as unknown as Pic);
          }).catch(reject);
      });
  }

  registerTexture(name: string, texture: PreparedTexture): Pic {
      // Assuming Level 0 is available
      const level = texture.levels[0];
      const tex = new Texture2D(this.device, {
          width: level.width,
          height: level.height,
          format: 'rgba8unorm',
          label: name
      });
      tex.upload(level.rgba as any);

      if (name.includes('conchars')) {
          this.font = tex as unknown as Pic;
      }
      return tex as unknown as Pic;
  }

  begin2D(): void {
      if (this.current2DEncoder) {
          console.warn('begin2D called while already in 2D mode');
          return;
      }
      this.current2DEncoder = this.device.createCommandEncoder({ label: '2D-CommandEncoder' });
      const view = this.getRenderTargetView();

      this.pipelines.sprite.setProjection(this.width, this.height);
      this.pipelines.sprite.begin(this.current2DEncoder, view);
  }

  end2D(): void {
      if (!this.current2DEncoder) {
          console.warn('end2D called without begin2D');
          return;
      }

      this.pipelines.sprite.end();
      this.device.queue.submit([this.current2DEncoder.finish()]);
      this.current2DEncoder = null;
  }

  drawPic(x: number, y: number, pic: Pic, color?: [number, number, number, number]): void {
      // Cast Pic back to Texture2D (WebGPU)
      const texture = pic as unknown as Texture2D;
      this.pipelines.sprite.drawTexturedQuad(x, y, pic.width, pic.height, texture, 0, 0, 1, 1, color);
  }

  drawChar(x: number, y: number, char: number, color?: [number, number, number, number]): void {
        if (!this.font) {
            return;
        }

        const charWidth = 8;
        const charHeight = 8;
        const numCols = this.font.width / charWidth;

        const charIndex = char & 255;
        const u0 = ((charIndex % numCols) * charWidth) / this.font.width;
        const v0 = (Math.floor(charIndex / numCols) * charHeight) / this.font.height;
        const u1 = u0 + charWidth / this.font.width;
        const v1 = v0 + charHeight / this.font.height;

        const texture = this.font as unknown as Texture2D;
        this.pipelines.sprite.drawTexturedQuad(x, y, charWidth, charHeight, texture, u0, v0, u1, v1, color);
  }

  drawString(x: number, y: number, text: string, color?: [number, number, number, number]): void {
        const segments = parseColorString(text);
        let currentX = x;
        const charWidth = 8;

        for (const segment of segments) {
            const segmentColor = segment.color || color;
            for (let i = 0; i < segment.text.length; i++) {
                this.drawChar(currentX, y, segment.text.charCodeAt(i), segmentColor);
                currentX += charWidth;
            }
        }
  }

  drawCenterString(y: number, text: string): void {
        const charWidth = 8;
        const stripped = text.replace(/\^[0-9]/g, '');
        const width = stripped.length * charWidth;
        const x = (this.width - width) / 2;
        this.drawString(x, y, text);
  }

  drawfillRect(x: number, y: number, width: number, height: number, color: [number, number, number, number]): void {
      this.pipelines.sprite.drawSolidRect(x, y, width, height, color);
  }

  // Stubs for now
  setEntityHighlight(entityId: number, color: [number, number, number, number]): void {}
  clearEntityHighlight(entityId: number): void {}
  highlightSurface(faceIndex: number, color: [number, number, number, number]): void {}
  removeSurfaceHighlight(faceIndex: number): void {}

  setDebugMode(mode: DebugMode): void {}
  setBrightness(value: number): void {}
  setGamma(value: number): void {}
  setFullbright(enabled: boolean): void {}
  setAmbient(value: number): void {}
  setLightStyle(index: number, pattern: string | null): void {}
  setUnderwaterWarp(enabled: boolean): void {}
  setBloom(enabled: boolean): void {}
  setBloomIntensity(value: number): void {}
  setLodBias(bias: number): void {}
  setAreaPortalState(portalNum: number, open: boolean): void {}

  renderInstanced(model: Md2Model | Md3Model, instances: InstanceData[]): void {}

  dispose(): void {
    this.destroy();
  }

  destroy(): void {
    // Destroy pipelines
    this.pipelines.sprite.destroy();

    if (this.headlessRenderTarget) {
        this.headlessRenderTarget.destroy();
    }

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
