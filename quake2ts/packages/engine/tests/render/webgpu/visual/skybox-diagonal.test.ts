import { describe, test, expect, vi } from 'vitest';
import { Camera } from '../../../../src/render/camera.js';
import { initHeadlessWebGPU } from '@quake2ts/test-utils/src/setup/webgpu';
import { captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import { SkyboxPipeline } from '../../../../src/render/webgpu/pipelines/skybox.js';
import { TextureCubeMap } from '../../../../src/render/webgpu/resources.js';

const updateBaseline = process.env.UPDATE_VISUAL === '1';

describe('Skybox Diagonal Views (Visual)', () => {
  // Logic check first (always runs)
  test('Camera.toState produces correct angles for diagonal view', () => {
    const camera = new Camera(800, 600);
    camera.setPosition(0, 0, 50);
    camera.setRotation(45, 45, 0);

    const state = camera.toState();
    expect(state.angles[0]).toBe(45); // Pitch
    expect(state.angles[1]).toBe(45); // Yaw
    expect(state.angles[2]).toBe(0);  // Roll
  });

  // Visual check
  test('renders correctly at 45/45 angle', async () => {
    const { device, context } = await initHeadlessWebGPU();
    const width = 256;
    const height = 256;
    const format = 'bgra8unorm';

    // Create pipeline
    const pipeline = new SkyboxPipeline(device, format);

    // Create Camera
    const camera = new Camera(width, height);
    camera.setPosition(0, 0, 0);
    camera.setRotation(45, 45, 0);

    // Create colored cubemap
    const cubemap = new TextureCubeMap(device, {
        size: 1,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    // Cubemap faces mapped via Quake→GL transform in shader:
    // cubemapDir.x=-dir.y, cubemapDir.y=dir.z, cubemapDir.z=-dir.x
    const colors = [
        [255, 0, 255, 255],   // Face 0 (+X in GL): Quake -Y (right) -> Magenta
        [0, 255, 0, 255],     // Face 1 (-X in GL): Quake +Y (left) -> Green
        [0, 0, 255, 255],     // Face 2 (+Y in GL): Quake +Z (up) -> Blue
        [255, 255, 0, 255],   // Face 3 (-Y in GL): Quake -Z (down) -> Yellow
        [0, 255, 255, 255],   // Face 4 (+Z in GL): Quake -X (back) -> Cyan
        [255, 0, 0, 255]      // Face 5 (-Z in GL): Quake +X (forward) -> Red
    ];

    for(let i=0; i<6; i++) {
        cubemap.uploadFace(i, new Uint8Array(colors[i]));
    }

    // Render
    const texture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    const view = texture.createView();

    // Create Depth Texture (Required by SkyboxPipeline)
    const depthTexture = device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    const depthView = depthTexture.createView();

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: view,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 1 }
        }],
        depthStencilAttachment: {
          view: depthView,
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store'
        }
    });

    pipeline.draw(passEncoder, {
        cameraState: camera.toState(),
        scroll: [0, 0],
        cubemap: cubemap
    });

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    // Capture and verify
    const result = await captureTexture(device, texture, width, height);

    // Check if we should update based on Vitest flag
    // Vitest doesn't expose `updateSnapshot` flag directly to code easily,
    // but the test runner we invoke sets env vars or we can assume ALWAYS_SAVE_SNAPSHOTS=1 logic
    // from previous findings in snapshots.ts.

    // We pass explicit object options to match signature:
    // expectSnapshot(pixels, options: SnapshotTestOptions)

    await expectSnapshot(result, {
        name: 'skybox-diagonal-45-45',
        width,
        height,
        updateBaseline,
        snapshotDir: __dirname // Use local dir
    });

    // Cleanup
    pipeline.destroy();
    cubemap.destroy();
    texture.destroy();
    depthTexture.destroy();
    device.destroy();
  });
});
