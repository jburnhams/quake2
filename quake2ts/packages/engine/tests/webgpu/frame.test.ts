import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createWebGPURenderer } from '../../src/render/webgpu/renderer.js';
import { Camera } from '../../src/render/camera.js';
import { mat4 } from 'gl-matrix';
import { PNG } from 'pngjs';
import * as fs from 'fs';
import * as path from 'path';
import { setupHeadlessWebGPUEnv, createWebGPULifecycle } from '@quake2ts/test-utils';

describe('WebGPURenderer Integration (Headless with Dawn)', () => {
  const lifecycle = createWebGPULifecycle();

  beforeAll(async () => {
    // Initialize headless WebGPU environment using shared helper
    // This handles globals injection and navigator.gpu polyfilling
    await setupHeadlessWebGPUEnv();
  });

  afterAll(lifecycle.cleanup);

  it('renders a solid sprite to a texture', async () => {
    // 1. Create Renderer
    const renderer = await createWebGPURenderer();
    lifecycle.trackRenderer(renderer);

    // 2. Setup Scene
    const camera = new Camera(mat4.create());

    // 3. Render Frame with HUD callback
    renderer.renderFrame({
      camera,
      timeSeconds: 0,
      clearColor: [0, 0, 0, 1], // Black background
      onDraw2D: () => {
          // Draw a full-screen red rectangle using proper 2D API
          // Ref: WebGPU renderer 2D drawing requires begin2D/end2D
          renderer.begin2D();
          renderer.drawfillRect(0, 0, 800, 600, [1, 0, 0, 1]);
          renderer.end2D();
      }
    });

    // 4. Read back pixel data
    const frameRenderer = (renderer as any).frameRenderer;
    const texture = frameRenderer.headlessTarget;
    expect(texture).toBeDefined();

    // To read back, we need to copy texture to a buffer
    const device = renderer.device;
    const width = 800;
    const height = 600;

    // Calculate bytes per row (must be multiple of 256)
    // 800 * 4 = 3200 bytes. Nearest multiple of 256 is 3328 (13 * 256).
    const bytesPerRow = 3328;

    const bufferSize = bytesPerRow * height;
    const readBuffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer(
        { texture },
        { buffer: readBuffer, bytesPerRow },
        { width, height }
    );
    device.queue.submit([encoder.finish()]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const data = new Uint8Array(readBuffer.getMappedRange());

    // Check specific pixel (center)
    const row = 300;
    const col = 400;
    const offset = row * bytesPerRow + col * 4;

    const b = data[offset];
    const g = data[offset + 1];
    const r = data[offset + 2];
    const a = data[offset + 3];

    // Expecting Red opaque (BGRA or RGBA with R high)
    expect(a).toBeGreaterThan(250);
    expect(g).toBeLessThan(10);
    // Either R or B should be high depending on format, usually BGRA in headless
    const isRedOrBlue = r > 250 || b > 250;
    expect(isRedOrBlue).toBe(true);

    // 5. Output to PNG
    const png = new PNG({ width, height });

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const srcIdx = y * bytesPerRow + x * 4;
            const dstIdx = (y * width + x) * 4;

            // Source is likely BGRA (Dawn default), PNG wants RGBA
            // If checking fails, verify swap logic
            const sb = data[srcIdx];
            const sg = data[srcIdx + 1];
            const sr = data[srcIdx + 2];
            const sa = data[srcIdx + 3];

            // Assume BGRA source -> RGBA destination
            png.data[dstIdx] = sr;     // R
            png.data[dstIdx + 1] = sg; // G
            png.data[dstIdx + 2] = sb; // B
            png.data[dstIdx + 3] = sa; // A
        }
    }

    const outputDir = path.resolve(__dirname, '../../../../test_output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'webgpu_headless_frame.png');
    fs.writeFileSync(outputPath, PNG.sync.write(png));
    console.log(`Wrote headless frame to ${outputPath}`);

    readBuffer.unmap();
  });

  it('defensively closes 2D pass if end2D() is forgotten', async () => {
    // Test defensive cleanup to prevent GPU resource leaks
    const renderer = await createWebGPURenderer();
    lifecycle.trackRenderer(renderer);

    const camera = new Camera(mat4.create());

    // Spy on console.warn to verify warning is logged
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // Render without calling end2D() - should auto-cleanup
      renderer.renderFrame({
        camera,
        timeSeconds: 0,
        clearColor: [0, 0, 0, 1],
        onDraw2D: () => {
          renderer.begin2D();
          renderer.drawfillRect(0, 0, 800, 600, [1, 0, 0, 1]);
          // Intentionally NOT calling renderer.end2D() to test defensive cleanup
        }
      });

      // Should have logged a warning about auto-closing the pass
      expect(warnSpy).toHaveBeenCalledWith(
        '2D render pass was not properly closed - auto-closing to prevent resource leak'
      );

      // Verify sprite renderer is no longer active after auto-cleanup
      const frameRenderer = (renderer as any).frameRenderer;
      expect(frameRenderer.pipelines.sprite.isActive).toBe(false);

    } finally {
      warnSpy.mockRestore();
    }
  });
});
