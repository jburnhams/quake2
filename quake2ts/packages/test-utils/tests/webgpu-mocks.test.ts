import { describe, it, expect, vi, beforeAll } from 'vitest';
import { globals } from 'webgpu';
import {
  createMockWebGPUContext,
  createMockGPUAdapter,
  createMockGPUDevice
} from '../src/engine/mocks/webgpu';

describe('WebGPU Mocks', () => {
  beforeAll(() => {
    // Ensure WebGPU constants are available
    Object.assign(globalThis, globals);
  });

  it('should create a complete mock context', () => {
    const { adapter, device, queue } = createMockWebGPUContext();
    expect(adapter).toBeDefined();
    expect(device).toBeDefined();
    expect(queue).toBeDefined();

    // Check circular reference logic (device.queue should be the queue)
    expect(device.queue).toBe(queue);
  });

  it('should mock GPUAdapter methods', async () => {
    const adapter = createMockGPUAdapter();
    const device = await adapter.requestDevice();
    expect(adapter.requestDevice).toHaveBeenCalled();
    expect(device).toBeDefined();
  });

  it('should mock GPUDevice resource creation', () => {
    const device = createMockGPUDevice();

    const buffer = device.createBuffer({
      size: 1024,
      usage: GPUBufferUsage.VERTEX
    });
    expect(device.createBuffer).toHaveBeenCalled();
    expect(buffer.size).toBe(1024);

    const texture = device.createTexture({
        size: { width: 100, height: 100 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    expect(device.createTexture).toHaveBeenCalled();
    expect(texture.format).toBe('rgba8unorm');
  });

  it('should mock CommandEncoder and RenderPass', () => {
    const device = createMockGPUDevice();
    const encoder = device.createCommandEncoder();
    expect(device.createCommandEncoder).toHaveBeenCalled();

    const pass = encoder.beginRenderPass({
        colorAttachments: []
    });
    expect(encoder.beginRenderPass).toHaveBeenCalled();

    pass.setPipeline({} as GPURenderPipeline);
    pass.draw(3);
    pass.end();

    expect(pass.draw).toHaveBeenCalledWith(3);
    expect(pass.end).toHaveBeenCalled();

    encoder.finish();
    expect(encoder.finish).toHaveBeenCalled();
  });

  it('should mock Queue operations', () => {
      const device = createMockGPUDevice();
      const queue = device.queue;

      const buffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST });
      queue.writeBuffer(buffer, 0, new Uint8Array([1, 2, 3, 4]));

      expect(queue.writeBuffer).toHaveBeenCalled();
  });
});
