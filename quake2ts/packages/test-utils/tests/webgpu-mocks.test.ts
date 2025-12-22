import { describe, it, expect, vi } from 'vitest';
import {
    createMockWebGPUContext,
    createMockGPUDevice,
    createMockGPUBuffer,
    setupWebGPUMocks
} from '../src/engine/mocks/webgpu';

describe('WebGPU Mocks', () => {

    it('should setup global mocks', async () => {
        const { mockGpu } = setupWebGPUMocks();
        expect(navigator.gpu).toBeDefined();
        expect(navigator.gpu.requestAdapter).toBeDefined();

        const adapter = await navigator.gpu.requestAdapter();
        expect(adapter).toBeDefined();
        expect(mockGpu.requestAdapter).toHaveBeenCalled();

        // Check constants
        expect((global as any).GPUBufferUsage).toBeDefined();
        expect((global as any).GPUBufferUsage.UNIFORM).toBeDefined();
    });

    it('should create a complete mock context', () => {
        const { adapter, device, queue } = createMockWebGPUContext();
        expect(adapter).toBeDefined();
        expect(device).toBeDefined();
        expect(queue).toBeDefined();
        expect(device.queue).toBe(queue);
    });

    it('should mock GPUBuffer creation', () => {
        const device = createMockGPUDevice();
        const buffer = device.createBuffer({
            size: 1024,
            usage: (global as any).GPUBufferUsage.UNIFORM
        });

        expect(buffer).toBeDefined();
        expect(buffer.size).toBe(1024);
        expect(device.createBuffer).toHaveBeenCalledWith(expect.objectContaining({ size: 1024 }));
    });

    it('should mock GPUTexture creation', () => {
        const device = createMockGPUDevice();
        const texture = device.createTexture({
            size: { width: 256, height: 256 },
            format: 'rgba8unorm',
            usage: (global as any).GPUTextureUsage.TEXTURE_BINDING
        });

        expect(texture).toBeDefined();
        expect(texture.width).toBe(256);
        expect(texture.height).toBe(256);
        expect(texture.createView).toBeDefined();
    });

    it('should mock command encoding', () => {
        const device = createMockGPUDevice();
        const encoder = device.createCommandEncoder();

        expect(encoder).toBeDefined();
        expect(encoder.beginRenderPass).toBeDefined();

        const pass = encoder.beginRenderPass({ colorAttachments: [] });
        expect(pass).toBeDefined();
        expect(pass.setPipeline).toBeDefined();
        expect(pass.draw).toBeDefined();

        pass.end();
        expect(pass.end).toHaveBeenCalled();

        const buffer = encoder.finish();
        expect(buffer).toBeDefined();
    });

    it('should mock queue operations', () => {
        const device = createMockGPUDevice();
        const buffer = createMockGPUBuffer(16, 0);

        device.queue.writeBuffer(buffer, 0, new Float32Array([1, 2, 3, 4]));
        expect(device.queue.writeBuffer).toHaveBeenCalled();
    });
});
