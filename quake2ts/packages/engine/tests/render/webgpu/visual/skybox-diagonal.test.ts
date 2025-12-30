import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Camera } from '../../../../src/render/camera.js';
import { TextureCubeMap } from '../../../../src/render/webgpu/resources.js';
import { SkyboxPipeline } from '../../../../src/render/webgpu/pipelines/skybox.js';
import { createRenderTestSetup, captureTexture } from '@quake2ts/test-utils';
import { mat4 } from 'gl-matrix';

// Visual regression tests require a functioning WebGPU environment (headless via Dawn/Mesa).
// This test file implements the logic described in the docs.
// We use createRenderTestSetup from test-utils to initialize a headless WebGPU context.

describe('Skybox Diagonal Views (Bug Fix)', () => {

    // Helper to create a solid color cubemap for testing
    function createSolidCubemap(device: GPUDevice, color: [number, number, number, number]): TextureCubeMap {
        const size = 1;
        const texture = device.createTexture({
            size: [size, size, 6],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            viewFormats: ['rgba8unorm']
        });

        // Upload single pixel data to all 6 faces
        const data = new Uint8ClampedArray(color.map(c => c * 255));
        for (let i = 0; i < 6; i++) {
             device.queue.writeTexture(
                 { texture, origin: [0, 0, i] },
                 data,
                 { bytesPerRow: 4 },
                 { width: 1, height: 1, depthOrArrayLayers: 1 }
             );
        }

        return {
            texture,
            createView: () => texture.createView({ dimension: 'cube' }),
            destroy: () => texture.destroy()
        } as TextureCubeMap;
    }

    it('renders skybox without error using CameraState', async () => {
        // Setup headless environment WITH DEPTH buffer because SkyboxPipeline expects it in layout
        const setup = await createRenderTestSetup(256, 256, { depth: true });
        const { device } = setup.context;

        const camera = new Camera(800, 600);
        camera.setPosition(0, 0, 50);
        camera.setRotation(45, 45, 0);

        const pipeline = new SkyboxPipeline(device, 'rgba8unorm');

        // Red skybox
        const cubemap = createSolidCubemap(device, [1, 0, 0, 1]);

        // Manually run render pass to ensure depth attachment is correctly handled
        // (Avoiding potential issues with renderAndCapture helper)
        const commandEncoder = device.createCommandEncoder();
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: setup.renderTargetView,
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: setup.depthTargetView!,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'discard'
            }
        });

        pipeline.draw(pass, {
            cameraState: camera.toState(),
            scroll: [0, 0],
            cubemap
        });

        pass.end();
        device.queue.submit([commandEncoder.finish()]);

        // Cleanup
        cubemap.destroy();
        pipeline.destroy();
        await setup.cleanup();
    });

    it('verifies coordinate system direction (visual check)', async () => {
        // Setup headless environment WITH DEPTH
        const setup = await createRenderTestSetup(256, 256, { depth: true });
        const { device } = setup.context;
        const pipeline = new SkyboxPipeline(device, 'rgba8unorm');

        // Create a cubemap with distinct colors per face
        const texture = device.createTexture({
            size: [1, 1, 6],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });

        const colors = [
            [255, 0, 0, 255],   // +X (Right in GL? or Front in Quake?)
            [0, 255, 0, 255],   // -X
            [0, 0, 255, 255],   // +Y
            [255, 255, 0, 255], // -Y
            [0, 255, 255, 255], // +Z
            [255, 0, 255, 255], // -Z
        ];

        for (let i = 0; i < 6; i++) {
             device.queue.writeTexture(
                 { texture, origin: [0, 0, i] },
                 new Uint8ClampedArray(colors[i]),
                 { bytesPerRow: 4 },
                 { width: 1, height: 1, depthOrArrayLayers: 1 }
             );
        }

        const cubemap: TextureCubeMap = {
            texture,
            createView: () => texture.createView({ dimension: 'cube' }),
            destroy: () => texture.destroy()
        };

        const camera = new Camera(256, 256);
        camera.setPosition(0, 0, 0);
        camera.setRotation(0, 0, 0); // Look Forward (+X in Quake)

        // Manual render pass
        const commandEncoder = device.createCommandEncoder();
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: setup.renderTargetView,
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: setup.depthTargetView!,
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'discard'
            }
        });

        pipeline.draw(pass, {
            cameraState: camera.toState(),
            scroll: [0, 0],
            cubemap
        });

        pass.end();
        device.queue.submit([commandEncoder.finish()]);

        // Capture
        const pixels = await captureTexture(device, setup.renderTarget, 256, 256);

        // Center pixel index
        const centerIdx = (128 * 256 + 128) * 4;
        const r = pixels[centerIdx];
        const g = pixels[centerIdx + 1];
        const b = pixels[centerIdx + 2];

        // Expecting +X face color: Red [255, 0, 0]
        expect(r).toBeGreaterThan(200);
        expect(g).toBeLessThan(50);
        expect(b).toBeLessThan(50);

        cubemap.destroy();
        pipeline.destroy();
        await setup.cleanup();
    });
});
