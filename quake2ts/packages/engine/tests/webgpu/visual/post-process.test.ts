import { test, beforeAll } from 'vitest';
import { captureTexture, initHeadlessWebGPU, expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';
import { SpriteRenderer } from '../../../src/render/webgpu/pipelines/sprite.js';
import { PostProcessPipeline } from '../../../src/render/webgpu/pipelines/postProcess.js';

const snapshotDir = path.join(__dirname, '__snapshots__');

beforeAll(async () => {
  await initHeadlessWebGPU();
});

test('pipeline: post-process', async ({ expect }) => {
    // We will manually construct a scene texture and apply post process
    const width = 256;
    const height = 256;

    // Create context
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter!.requestDevice();
    const format = navigator.gpu.getPreferredCanvasFormat();

    const pipeline = new PostProcessPipeline(device, format);
    const spriteRenderer = new SpriteRenderer(device, format);

    // 1. Create source texture with pattern
    const sourceTexture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
    });

    const targetTexture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING
    });

    // Render pattern to source
    const spriteEncoder = device.createCommandEncoder();

    // Explicit clear pass
    const clearPass = spriteEncoder.beginRenderPass({
        colorAttachments: [{
            view: sourceTexture.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: [0.2, 0.2, 0.2, 1]
        }]
    });
    clearPass.end();

    spriteRenderer.setProjection(width, height);
    spriteRenderer.begin(spriteEncoder, sourceTexture.createView());

    // Draw Grid
    const gridSize = 32;
    for (let x = 0; x < width; x += gridSize) {
        spriteRenderer.drawSolidRect(x, 0, 4, height, [1, 1, 1, 1]);
    }
    for (let y = 0; y < height; y += gridSize) {
        spriteRenderer.drawSolidRect(0, y, width, 4, [1, 1, 1, 1]);
    }

    spriteRenderer.end();
    device.queue.submit([spriteEncoder.finish()]);

    // 2. Apply Post Process: Underwater
    const ppEncoder = device.createCommandEncoder();
    const ppPass = ppEncoder.beginRenderPass({
        colorAttachments: [{
            view: targetTexture.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: [0, 0, 0, 1]
        }]
    });

    // Need a sampler
    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });

    pipeline.render(ppPass, sourceTexture.createView(), sampler, {
        time: 1.0,
        strength: 1.0,
        gamma: 1.0,
        brightness: 1.0
    });

    ppPass.end();
    device.queue.submit([ppEncoder.finish()]);

    // Capture result
    const pixels = await captureTexture(device, targetTexture, width, height);
    await expectSnapshot(pixels, {
        name: 'post-underwater',
        width,
        height,
        snapshotDir
    });

    // 3. Apply Post Process: Gamma
    const ppEncoderGamma = device.createCommandEncoder();
    const ppPassGamma = ppEncoderGamma.beginRenderPass({
        colorAttachments: [{
            view: targetTexture.createView(),
            loadOp: 'clear',
            storeOp: 'store'
        }]
    });

    pipeline.render(ppPassGamma, sourceTexture.createView(), sampler, {
        time: 0,
        strength: 0,
        gamma: 2.0,
        brightness: 1.0
    });

    ppPassGamma.end();
    device.queue.submit([ppEncoderGamma.finish()]);

    const pixelsGamma = await captureTexture(device, targetTexture, width, height);
    await expectSnapshot(pixelsGamma, {
        name: 'post-gamma',
        width,
        height,
        snapshotDir
    });

    // 4. Apply Post Process: Brightness
    const ppEncoderBright = device.createCommandEncoder();
    const ppPassBright = ppEncoderBright.beginRenderPass({
        colorAttachments: [{
            view: targetTexture.createView(),
            loadOp: 'clear',
            storeOp: 'store'
        }]
    });

    pipeline.render(ppPassBright, sourceTexture.createView(), sampler, {
        time: 0,
        strength: 0,
        gamma: 1.0,
        brightness: 2.0
    });

    ppPassBright.end();
    device.queue.submit([ppEncoderBright.finish()]);

    const pixelsBright = await captureTexture(device, targetTexture, width, height);
    await expectSnapshot(pixelsBright, {
        name: 'post-brightness',
        width,
        height,
        snapshotDir
    });

    pipeline.destroy();
    spriteRenderer.destroy();
});
