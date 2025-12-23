import { describe, it, expect, vi } from 'vitest';
import { initHeadlessWebGPU } from '@quake2ts/test-utils';
import { SpriteRenderer } from '../../../src/render/webgpu/pipelines/sprite.js';

describe('SpriteRenderer', () => {
  it('creates successfully', async () => {
    const { device } = await initHeadlessWebGPU();
    const format = 'rgba8unorm';
    const renderer = new SpriteRenderer(device, format);
    expect(renderer).toBeDefined();
    renderer.destroy();
  });

  it('can begin and end rendering', async () => {
    const { device } = await initHeadlessWebGPU();
    const format = 'rgba8unorm';
    const renderer = new SpriteRenderer(device, format);

    const commandEncoder = device.createCommandEncoder();
    const texture = device.createTexture({
      size: [256, 256],
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    const view = texture.createView();

    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    renderer.begin(pass);
    renderer.end();
    pass.end();

    const commandBuffer = commandEncoder.finish();
    expect(commandBuffer).toBeDefined();

    renderer.destroy();
  });

  it('draws a solid rect', async () => {
     const { device } = await initHeadlessWebGPU();
     const format = 'rgba8unorm';
     const renderer = new SpriteRenderer(device, format);
     renderer.setProjection(256, 256);

     const commandEncoder = device.createCommandEncoder();
     const texture = device.createTexture({
       size: [256, 256],
       format,
       usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
     });
     const view = texture.createView();

     const pass = commandEncoder.beginRenderPass({
       colorAttachments: [{
         view,
         clearValue: { r: 0, g: 0, b: 0, a: 1 },
         loadOp: 'clear',
         storeOp: 'store'
       }]
     });

     renderer.begin(pass);
     // Draw red rect
     renderer.drawSolidRect(0, 0, 256, 256, 1, 0, 0, 1);
     renderer.end();
     pass.end();

     device.queue.submit([commandEncoder.finish()]);

     renderer.destroy();
  });
});
