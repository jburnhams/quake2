import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createWebGPURenderer, WebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { TextureCubeMap } from '../../../src/render/webgpu/resources.js';
import { Camera } from '../../../src/render/camera.js';
import { initHeadlessWebGPU, captureTexture } from '@quake2ts/test-utils';

describe('Skybox Pixel Color Verification', () => {
  let renderer: WebGPURenderer;
  let cubemap: TextureCubeMap;

  beforeAll(async () => {
    await initHeadlessWebGPU();
    renderer = await createWebGPURenderer(undefined, {
       width: 256,
       height: 256
    }) as WebGPURenderer;

    const size = 64;
    cubemap = new TextureCubeMap(renderer.device, {
        size,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    const createColorData = (r: number, g: number, b: number) => {
        const data = new Uint8Array(size * size * 4);
        for (let i = 0; i < size * size; i++) {
            data[i * 4] = r;
            data[i * 4 + 1] = g;
            data[i * 4 + 2] = b;
            data[i * 4 + 3] = 255;
        }
        return data;
    };

    // Face 0 (+X in GL): Quake -Y (right) -> Magenta (255, 0, 255)
    cubemap.uploadFace(0, createColorData(255, 0, 255));
    // Face 1 (-X in GL): Quake +Y (left) -> Green (0, 255, 0)
    cubemap.uploadFace(1, createColorData(0, 255, 0));
    // Face 2 (+Y in GL): Quake +Z (up) -> Blue (0, 0, 255)
    cubemap.uploadFace(2, createColorData(0, 0, 255));
    // Face 3 (-Y in GL): Quake -Z (down) -> Yellow (255, 255, 0)
    cubemap.uploadFace(3, createColorData(255, 255, 0));
    // Face 4 (+Z in GL): Quake -X (back) -> Cyan (0, 255, 255)
    cubemap.uploadFace(4, createColorData(0, 255, 255));
    // Face 5 (-Z in GL): Quake +X (forward) -> Red (255, 0, 0)
    cubemap.uploadFace(5, createColorData(255, 0, 0));
  });

  afterAll(async () => {
    // Cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  function getPixelAt(pixels: Uint8Array, width: number, x: number, y: number): [number, number, number] {
    const index = (y * width + x) * 4;
    return [pixels[index], pixels[index + 1], pixels[index + 2]];
  }

  function getColorName(r: number, g: number, b: number): string {
    // Allow some tolerance
    const isHigh = (v: number) => v > 200;
    const isLow = (v: number) => v < 50;

    if (isHigh(r) && isLow(g) && isLow(b)) return 'RED';
    if (isLow(r) && isHigh(g) && isLow(b)) return 'GREEN';
    if (isLow(r) && isLow(g) && isHigh(b)) return 'BLUE';
    if (isHigh(r) && isHigh(g) && isLow(b)) return 'YELLOW';
    if (isLow(r) && isHigh(g) && isHigh(b)) return 'CYAN';
    if (isHigh(r) && isLow(g) && isHigh(b)) return 'MAGENTA';
    return `RGB(${r},${g},${b})`;
  }

  it('yaw=0 (forward): center should be RED', async () => {
    const camera = new Camera();
    camera.setFov(90);
    camera.setAspectRatio(1.0);
    camera.setPosition(0, 0, 0);
    camera.lookAt([10, 0, 0]);

    renderer.renderFrame({ camera, sky: { cubemap } });
    const frameRenderer = (renderer as any).frameRenderer;
    const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

    const center = getPixelAt(pixels, 256, 128, 128);
    console.log('yaw=0 center pixel:', center, getColorName(...center));

    expect(getColorName(...center)).toBe('RED');
  });

  it('yaw=90 (left): center should be GREEN', async () => {
    const camera = new Camera();
    camera.setFov(90);
    camera.setAspectRatio(1.0);
    camera.setPosition(0, 0, 0);
    camera.lookAt([0, 10, 0]);

    renderer.renderFrame({ camera, sky: { cubemap } });
    const frameRenderer = (renderer as any).frameRenderer;
    const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

    const center = getPixelAt(pixels, 256, 128, 128);
    console.log('yaw=90 center pixel:', center, getColorName(...center));

    expect(getColorName(...center)).toBe('GREEN');
  });

  it('yaw=45 (forward-left): should have GREEN on left, RED on right', async () => {
    const camera = new Camera();
    camera.setFov(90);
    camera.setAspectRatio(1.0);
    camera.setPosition(0, 0, 0);
    camera.lookAt([10, 10, 0]);

    renderer.renderFrame({ camera, sky: { cubemap } });
    const frameRenderer = (renderer as any).frameRenderer;
    const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

    // Sample various positions across the screen
    const leftQuarter = getPixelAt(pixels, 256, 64, 128);    // 25% from left
    const center = getPixelAt(pixels, 256, 128, 128);        // center
    const rightQuarter = getPixelAt(pixels, 256, 192, 128);  // 75% from left

    console.log('yaw=45 pixels:');
    console.log('  left quarter (64, 128):', leftQuarter, getColorName(...leftQuarter));
    console.log('  center (128, 128):', center, getColorName(...center));
    console.log('  right quarter (192, 128):', rightQuarter, getColorName(...rightQuarter));

    // Left side should be GREEN (looking at Quake +Y)
    expect(getColorName(...leftQuarter)).toBe('GREEN');
    // Right side should be RED (looking at Quake +X)
    expect(getColorName(...rightQuarter)).toBe('RED');
  });

  it('pitch=-45 (forward-up): should have BLUE on top, RED on bottom', async () => {
    const camera = new Camera();
    camera.setFov(90);
    camera.setAspectRatio(1.0);
    camera.setPosition(0, 0, 0);
    camera.lookAt([10, 0, 10]);

    renderer.renderFrame({ camera, sky: { cubemap } });
    const frameRenderer = (renderer as any).frameRenderer;
    const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

    const topQuarter = getPixelAt(pixels, 256, 128, 64);     // 25% from top
    const center = getPixelAt(pixels, 256, 128, 128);        // center
    const bottomQuarter = getPixelAt(pixels, 256, 128, 192); // 75% from top

    console.log('pitch=-45 pixels:');
    console.log('  top quarter (128, 64):', topQuarter, getColorName(...topQuarter));
    console.log('  center (128, 128):', center, getColorName(...center));
    console.log('  bottom quarter (128, 192):', bottomQuarter, getColorName(...bottomQuarter));

    // Top should be BLUE (looking at Quake +Z)
    expect(getColorName(...topQuarter)).toBe('BLUE');
    // Bottom should be RED (looking at Quake +X)
    expect(getColorName(...bottomQuarter)).toBe('RED');
  });
});
