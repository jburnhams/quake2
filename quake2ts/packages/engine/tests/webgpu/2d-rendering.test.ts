import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createWebGPURenderer } from '@quake2ts/engine/render/webgpu/renderer.js';
import { Camera } from '@quake2ts/engine/render/camera.js';
import { mat4 } from 'gl-matrix';
import { Texture2D } from '@quake2ts/engine/render/webgpu/resources.js';
import { initHeadlessWebGPU, HeadlessWebGPUSetup, captureTexture } from '@quake2ts/test-utils';

describe('WebGPU 2D Rendering Integration', () => {
  let renderer: Awaited<ReturnType<typeof createWebGPURenderer>>;
  let testTexture: Texture2D;
  let frameRenderer: any; // Access to internal frame renderer
  let gpuSetup: HeadlessWebGPUSetup | null = null;
  let gpuAvailable = false;

  beforeAll(async () => {
    // Setup WebGPU for Node.js environment (Dawn)
    try {
      gpuSetup = await initHeadlessWebGPU();
      gpuAvailable = true;
    } catch (e) {
      console.warn('WebGPU not available - skipping integration tests.', e);
      return;
    }
  });

  afterAll(async () => {
    if (gpuSetup) {
      await gpuSetup.cleanup();
    }
  });

  beforeEach(async () => {
    if (!gpuAvailable) return;

    renderer = await createWebGPURenderer(undefined, {
      width: 256,
      height: 256,
      headless: true
    });

    // Access frame renderer for headlessTarget
    frameRenderer = (renderer as any).frameRenderer;

    // Create a simple test texture (8x8 red square)
    testTexture = new Texture2D(renderer.device, {
      width: 8,
      height: 8,
      format: 'rgba8unorm', // Match context default
      label: 'test-texture'
    });

    const redSquare = new Uint8Array(8 * 8 * 4);
    for (let i = 0; i < 8 * 8; i++) {
      redSquare[i * 4 + 0] = 255; // R
      redSquare[i * 4 + 1] = 0;   // G
      redSquare[i * 4 + 2] = 0;   // B
      redSquare[i * 4 + 3] = 255; // A
    }
    testTexture.upload(redSquare);
  });

  afterEach(() => {
    testTexture?.destroy();
    renderer?.destroy();
  });

  it('renders a solid rectangle with drawfillRect', async () => {
    if (!gpuAvailable) return;

    const camera = new Camera(mat4.create());

    renderer.renderFrame({
      camera,
      clearColor: [0, 0, 0, 1],
      onDraw2D: () => {
        renderer.begin2D();
        // Draw a blue rectangle in the center
        renderer.drawfillRect(64, 64, 128, 128, [0, 0, 1, 1]);
        renderer.end2D();
      }
    });

    const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget!, 256, 256);

    // Check that the center pixel is blue
    const centerX = 128;
    const centerY = 128;
    const centerIdx = (centerY * 256 + centerX) * 4;

    // RGBA format: R=0, G=0, B=1, A=1
    expect(pixels[centerIdx + 0]).toBeLessThan(50);     // R channel
    expect(pixels[centerIdx + 1]).toBeLessThan(50);     // G channel
    expect(pixels[centerIdx + 2]).toBeGreaterThan(200); // B channel
  });

  it('renders a textured quad with drawPic', async () => {
    if (!gpuAvailable) return;

    const camera = new Camera(mat4.create());

    renderer.renderFrame({
      camera,
      clearColor: [0, 0, 0, 1],
      onDraw2D: () => {
        renderer.begin2D();
        // Draw the red test texture at 100, 100
        renderer.drawPic(100, 100, testTexture, [1, 1, 1, 1]);
        renderer.end2D();
      }
    });

    const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget!, 256, 256);

    // Check that a pixel in the drawn texture is red
    const testX = 104; // Inside the 8x8 texture at 100, 100
    const testY = 104;
    const testIdx = (testY * 256 + testX) * 4;

    expect(pixels[testIdx + 0]).toBeGreaterThan(200); // R channel
    expect(pixels[testIdx + 1]).toBeLessThan(50);     // G channel
    expect(pixels[testIdx + 2]).toBeLessThan(50);     // B channel
  });

  it('renders with color tinting', async () => {
    if (!gpuAvailable) return;

    const camera = new Camera(mat4.create());

    renderer.renderFrame({
      camera,
      clearColor: [0, 0, 0, 1],
      onDraw2D: () => {
        renderer.begin2D();
        // Draw with green tint
        renderer.drawfillRect(50, 50, 80, 60, [0, 1, 0, 1]);
        renderer.end2D();
      }
    });

    const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget!, 256, 256);

    // Check green color
    const testX = 80;
    const testY = 70;
    const testIdx = (testY * 256 + testX) * 4;

    expect(pixels[testIdx + 0]).toBeLessThan(50);     // R channel
    expect(pixels[testIdx + 1]).toBeGreaterThan(200); // G channel
    expect(pixels[testIdx + 2]).toBeLessThan(50);     // B channel
  });

  it('renders multiple 2D elements in correct order', async () => {
    if (!gpuAvailable) return;

    const camera = new Camera(mat4.create());

    renderer.renderFrame({
      camera,
      clearColor: [0, 0, 0, 1],
      onDraw2D: () => {
        renderer.begin2D();
        // Draw red rectangle first
        renderer.drawfillRect(50, 50, 100, 100, [1, 0, 0, 1]);
        // Draw smaller green rectangle on top
        renderer.drawfillRect(75, 75, 50, 50, [0, 1, 0, 1]);
        renderer.end2D();
      }
    });

    const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget!, 256, 256);

    // Check that the overlapping area is green (drawn last)
    const overlapX = 100;
    const overlapY = 100;
    const overlapIdx = (overlapY * 256 + overlapX) * 4;

    expect(pixels[overlapIdx + 0]).toBeLessThan(50);     // R channel
    expect(pixels[overlapIdx + 1]).toBeGreaterThan(200); // G channel (should be green, not red)
  });

  it('clears the frame buffer with clearColor', async () => {
    if (!gpuAvailable) return;

    const camera = new Camera(mat4.create());

    renderer.renderFrame({
      camera,
      clearColor: [0.5, 0.3, 0.1, 1],
    });

    const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget!, 256, 256);

    // Check clear color in center
    const centerIdx = (128 * 256 + 128) * 4;

    // RGBA format: R=0.5, G=0.3, B=0.1
    expect(pixels[centerIdx + 0]).toBeCloseTo(128, -10); // R ~0.5*255
    expect(pixels[centerIdx + 1]).toBeCloseTo(76, -10);  // G ~0.3*255
    expect(pixels[centerIdx + 2]).toBeCloseTo(25, -10);  // B ~0.1*255
  });

  it('respects begin2D/end2D boundaries', () => {
    if (!gpuAvailable) return;

    const camera = new Camera(mat4.create());

    // Should throw when calling draw methods outside begin2D/end2D
    expect(() => {
      renderer.renderFrame({
        camera,
        onDraw2D: () => {
          // Not calling begin2D
          renderer.drawfillRect(0, 0, 10, 10, [1, 1, 1, 1]);
        }
      });
    }).toThrow('drawfillRect called outside begin2D/end2D');
  });
});
