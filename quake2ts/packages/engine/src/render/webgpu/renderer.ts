import { SpriteRenderer } from './pipelines/sprite.js';
import { IRenderer } from '../interface.js';
import { TextureCache } from './resources.js';

export class WebGPURenderer {
  private device: GPUDevice;
  private spriteRenderer: SpriteRenderer;
  private textureCache: TextureCache;
  private width = 0;
  private height = 0;

  // Current render pass
  private currentPass: GPURenderPassEncoder | null = null;
  private currentEncoder: GPUCommandEncoder | null = null;
  private currentView: GPUTextureView | null = null;

  constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat) {
    this.device = device;
    this.spriteRenderer = new SpriteRenderer(device, format);
    this.textureCache = new TextureCache(device);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.spriteRenderer.setProjection(width, height);
  }

  beginFrame(encoder: GPUCommandEncoder, view: GPUTextureView) {
    this.currentEncoder = encoder;
    this.currentView = view;
  }

  endFrame() {
    this.currentEncoder = null;
    this.currentView = null;
  }

  begin2D() {
    if (!this.currentEncoder || !this.currentView) {
        throw new Error("Cannot begin2D without beginFrame");
    }

    // Start a render pass if not already in one?
    // For now assume we start a new pass for 2D.
    // In a real frame graph we might append to existing pass if compatible.

    // We need to clear? Or load?
    // Typically 2D is drawn over 3D, so we load.

    const pass = this.currentEncoder.beginRenderPass({
        colorAttachments: [{
            view: this.currentView,
            loadOp: 'load',
            storeOp: 'store'
        }]
    });

    this.currentPass = pass;
    this.spriteRenderer.begin(pass);
  }

  end2D() {
    if (!this.currentPass) return;
    this.spriteRenderer.end();
    this.currentPass.end();
    this.currentPass = null;
  }

  drawPic(x: number, y: number, w: number, h: number, name: string) {
      const texture = this.textureCache.get(name);
      if (texture) {
          this.spriteRenderer.drawTexturedQuad(x, y, w, h, texture.texture);
      }
  }

  drawfillRect(x: number, y: number, w: number, h: number, color: number) {
      // Color is typically packed RGBA or ARGB?
      // Quake 2 usually uses a palette index or a packed color.
      // If it's a number, we need to know format.
      // Assuming 0xRRGGBBAA or similar.
      // Let's assume standard packed int for now: R G B A (little endian might be A B G R)

      const r = (color & 0xFF) / 255.0;
      const g = ((color >> 8) & 0xFF) / 255.0;
      const b = ((color >> 16) & 0xFF) / 255.0;
      const a = ((color >> 24) & 0xFF) / 255.0;

      this.spriteRenderer.drawSolidRect(x, y, w, h, r, g, b, a);
  }

  destroy() {
      this.spriteRenderer.destroy();
      this.textureCache.destroy();
  }
}
