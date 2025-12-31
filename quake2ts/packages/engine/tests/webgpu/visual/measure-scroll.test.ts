import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createWebGPURenderer, WebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { TextureCubeMap } from '../../../src/render/webgpu/resources.js';
import { Camera } from '../../../src/render/camera.js';
import { setupHeadlessWebGPUEnv, createWebGPULifecycle, captureTexture } from '@quake2ts/test-utils';

describe('Skybox Scroll Distance Measurement', () => {
  const lifecycle = createWebGPULifecycle();
  let renderer: WebGPURenderer;
  let cubemap: TextureCubeMap;

  beforeAll(async () => {
    await setupHeadlessWebGPUEnv();
    renderer = await createWebGPURenderer(undefined, {
       width: 256,
       height: 256
    }) as WebGPURenderer;
    lifecycle.trackRenderer(renderer);

    const size = 64;
    cubemap = new TextureCubeMap(renderer.device, {
        size,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    // Create a distinct pattern with vertical stripes (easier to measure horizontal scrolling)
    const createVerticalStripes = () => {
        const data = new Uint8Array(size * size * 4);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = y * size + x;
                // 8-pixel wide vertical stripes
                const stripeIndex = Math.floor(x / 8);
                const colors = [
                    [255, 0, 0],    // Red
                    [0, 255, 0],    // Green
                    [0, 0, 255],    // Blue
                    [255, 255, 0],  // Yellow
                    [255, 0, 255],  // Magenta
                    [0, 255, 255],  // Cyan
                    [255, 128, 0],  // Orange
                    [128, 0, 255],  // Purple
                ];
                const color = colors[stripeIndex % 8];
                data[i * 4] = color[0];
                data[i * 4 + 1] = color[1];
                data[i * 4 + 2] = color[2];
                data[i * 4 + 3] = 255;
            }
        }
        return data;
    };

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

    // Upload vertical stripes to front face for easy scroll measurement
    cubemap.uploadFace(0, createColorData(255, 0, 255)); // Right
    cubemap.uploadFace(1, createColorData(0, 255, 0));   // Left
    cubemap.uploadFace(2, createColorData(0, 0, 255));   // Top
    cubemap.uploadFace(3, createColorData(255, 255, 0)); // Bottom
    cubemap.uploadFace(4, createColorData(0, 255, 255)); // Back
    cubemap.uploadFace(5, createVerticalStripes());      // Front - vertical stripes
  });

  afterAll(lifecycle.cleanup);

  it('measures horizontal scroll distance with different speeds', async () => {
    const camera = new Camera();
    camera.setFov(90);
    camera.setAspectRatio(1.0);
    camera.setPosition(0, 0, 0);
    camera.setRotation(0, 0, 0); // Look straight forward to see front face clearly

    // Test different scroll speeds
    const testSpeeds = [1.0, 5.0, 10.0, 20.0, 50.0];

    for (const speed of testSpeeds) {
        // Render at t=0
        renderer.renderFrame({
            camera,
            sky: {
                cubemap,
                scrollSpeeds: [speed, 0.0] // Only horizontal scroll
            },
            timeSeconds: 0
        });

        const frameRenderer = (renderer as any).frameRenderer;
        const pixels0 = await captureTexture(
            renderer.device,
            frameRenderer.headlessTarget,
            256,
            256
        );

        // Render at t=2.0
        renderer.renderFrame({
            camera,
            sky: {
                cubemap,
                scrollSpeeds: [speed, 0.0]
            },
            timeSeconds: 2.0
        });

        const pixels2 = await captureTexture(
            renderer.device,
            frameRenderer.headlessTarget,
            256,
            256
        );

        // Count different pixels
        let differentPixels = 0;
        for (let i = 0; i < pixels0.length; i += 4) {
            if (pixels0[i] !== pixels2[i] || pixels0[i+1] !== pixels2[i+1] || pixels0[i+2] !== pixels2[i+2]) {
                differentPixels++;
            }
        }

        const totalPixels = pixels0.length / 4;
        const percentDifferent = (differentPixels / totalPixels) * 100;

        console.log(`Speed ${speed.toFixed(1)}: ${percentDifferent.toFixed(2)}% pixels changed`);

        // For measuring actual stripe shift, look at the center row
        const centerY = 128;
        const rowStart = centerY * 256;

        // Sample colors at specific x positions to detect stripe shift
        const sampleX = [64, 128, 192]; // Sample at 1/4, 1/2, 3/4 width
        for (const x of sampleX) {
            const idx0 = (rowStart + x) * 4;
            const idx2 = (rowStart + x) * 4;
            const color0 = [pixels0[idx0], pixels0[idx0+1], pixels0[idx0+2]];
            const color2 = [pixels2[idx2], pixels2[idx2+1], pixels2[idx2+2]];
            const changed = color0[0] !== color2[0] || color0[1] !== color2[1] || color0[2] !== color2[2];
            if (changed) {
                console.log(`  At x=${x}: color changed from [${color0}] to [${color2}]`);
            }
        }
    }

    // Based on the output, we can determine which speed gives us exactly 2 stripe widths (16 pixels) of movement
    expect(true).toBe(true);
  });
});
