import { describe, test, expect } from 'vitest';
import { Camera } from '../../../../src/render/camera.js';
import { createHeadlessWebGPURenderer, captureFramebuffer } from '../../../../src/render/webgpu/headless.js';
import { TextureCubeMap } from '../../../../src/render/webgpu/resources.js';

// We need to mock resources if we don't have real assets
// But integration tests usually run with real or generated assets.
// Let's assume we can create a simple colored cubemap or use a mock.

// Helper to create a solid color texture
const createSolidTexture = (device: GPUDevice, color: [number, number, number, number]) => {
    const size = [1, 1];
    const texture = device.createTexture({
        size: [1, 1, 6], // 6 layers for cubemap
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        dimension: '2d',
    });

    // Upload data for each face
    const data = new Uint8Array(color.map(c => c * 255));
    for (let i = 0; i < 6; i++) {
        device.queue.writeTexture(
            { texture, origin: [0, 0, i] },
            data,
            { bytesPerRow: 4, rowsPerImage: 1 },
            [1, 1]
        );
    }

    return texture;
};

// Mock Cubemap wrapper
class MockTextureCubeMap implements TextureCubeMap {
    constructor(public gpuTexture: GPUTexture) {}
    createView() { return this.gpuTexture.createView({ dimension: 'cube' }); }
    destroy() { this.gpuTexture.destroy(); }
    get width() { return 1; }
    get height() { return 1; }
}


describe('Skybox Diagonal Views (Bug Fix)', () => {
  // Only run if WebGPU is supported/mocked appropriately
  test.skipIf(process.env.TEST_TYPE !== 'webgpu')('renders correctly at 45/45 angle', async () => {
    const { renderer, device, width, height } = await createHeadlessWebGPURenderer(256, 256);

    const camera = new Camera(width, height);
    camera.setPosition(0, 0, 50);
    camera.setRotation(45, 45, 0);

    const texture = createSolidTexture(device, [1, 0, 0, 1]); // Red skybox
    const cubemap = new MockTextureCubeMap(texture);

    renderer.renderFrame({
      camera,
      cameraState: camera.toState(), // Ensure we use the new state
      sky: { cubemap: cubemap }
    });

    const pixels = await captureFramebuffer(renderer);
    expect(pixels).toMatchImageSnapshot();
  });
});
