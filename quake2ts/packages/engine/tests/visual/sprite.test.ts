import { describe, it, expect } from 'vitest';
import { initHeadlessWebGPU } from '@quake2ts/test-utils';
import { SpriteRenderer } from '../../src/render/webgpu/pipelines/sprite.js';
import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

// Helper to save PNG
async function saveTextureAsPng(device: GPUDevice, texture: GPUTexture, path: string) {
    const size = [texture.width, texture.height];
    const bytesPerRow = Math.ceil(size[0] * 4 / 256) * 256; // Align to 256 bytes
    const bufferSize = bytesPerRow * size[1];

    const buffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const commandEncoder = device.createCommandEncoder();
    commandEncoder.copyTextureToBuffer(
        { texture },
        { buffer, bytesPerRow },
        { width: size[0], height: size[1] }
    );
    device.queue.submit([commandEncoder.finish()]);

    await buffer.mapAsync(GPUMapMode.READ);
    const data = new Uint8Array(buffer.getMappedRange());

    // We need to un-pad the rows if bytesPerRow > width * 4
    // And convert to PNG.
    // For now, let's just assert on the raw data in tests, or rely on visual diff tools later.
    // Since we don't have a PNG encoder handy in this snippet without installing more deps or using canvas,
    // we'll skip actual PNG file writing for this pass and focus on pixel validation.

    buffer.unmap();
    return data;
}

describe('Visual Sprite Tests', () => {
    it('renders a red square', async () => {
        const { device } = await initHeadlessWebGPU();
        const format: GPUTextureFormat = 'rgba8unorm'; // Explicitly set format
        const width = 256;
        const height = 256;

        const texture = device.createTexture({
            size: [width, height],
            format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        });

        const renderer = new SpriteRenderer(device, format);
        renderer.setProjection(width, height);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: texture.createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });

        renderer.begin(pass);
        renderer.drawSolidRect(50, 50, 100, 100, 1, 0, 0, 1);
        renderer.end();
        pass.end();

        device.queue.submit([encoder.finish()]);

        // Read back
        const buffer = device.createBuffer({
            size: width * height * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const copyEncoder = device.createCommandEncoder();
        copyEncoder.copyTextureToBuffer(
            { texture },
            { buffer, bytesPerRow: width * 4 },
            { width, height }
        );
        device.queue.submit([copyEncoder.finish()]);

        await buffer.mapAsync(GPUMapMode.READ);
        const data = new Uint8Array(buffer.getMappedRange());

        // Check a pixel inside the rect (50+50 = 100, 50+50=100) -> 100, 100
        const index = (100 * width + 100) * 4;
        expect(data[index]).toBe(255);     // R
        expect(data[index + 1]).toBe(0);   // G
        expect(data[index + 2]).toBe(0);   // B
        expect(data[index + 3]).toBe(255); // A

        // Check a pixel outside (10, 10)
        const indexOutside = (10 * width + 10) * 4;
        expect(data[indexOutside]).toBe(0);

        buffer.unmap();
        renderer.destroy();
    });
});
